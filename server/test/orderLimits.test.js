import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Stall from '../src/models/Stall.js';
import Food from '../src/models/Food.js';
import StallFood from '../src/models/StallFood.js';
import EventConfig from '../src/models/EventConfig.js';
import Order from '../src/models/Order.js';
import { createOrder } from '../src/controllers/orderController.js';
import { cancelOrder, releaseExpiredReservations } from '../src/services/orderLifecycleService.js';
import { maxOrderQuantity } from '../src/services/orderPolicy.js';
import { presentEvent } from '../src/services/eventService.js';

const response = () => ({ status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('fair ordering limits and atomic stock restoration', async t => {
  assert.ok(process.env.TEST_MONGODB_URI, 'Run npm test with the isolated replica set');
  await mongoose.connect(process.env.TEST_MONGODB_URI, { dbName: `order_limits_${process.pid}` });
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  const now = Date.now();
  const config = await EventConfig.create({ eventName: 'Fair', eventDate: new Date(now + 86400000 * 2), preorderOpenAt: new Date(now - 86400000), preorderCloseAt: new Date(now + 86400000), orderingEnabled: true, orderReservationMinutes: 60 });
  const stall = await Stall.create({ stallName: 'Stall', batch: 'A' });
  const foods = await Food.create([{ name: 'Food A' }, { name: 'Food B' }]);
  const entries = await StallFood.create(foods.map(food => ({ stallId: stall._id, foodId: food._id, eventDayPrice: 1000, ticketLimit: 20 })));
  const users = await User.create(['Alice', 'Bob', 'Carol', 'Dan'].map(name => ({ name, nameNormalized: name.toLowerCase(), passwordHash: 'unused' })));
  const item = (index = 0, quantity = 1) => ({ stallFoodId: String(entries[index]._id), quantity });
  const place = async (items = [item()], user = users[0]) => { const res = response(); await createOrder({ user, body: { items } }, res); return res.body; };
  const reset = async (stock = 20) => { await Order.deleteMany({}); await StallFood.updateMany({}, { ticketLimit: stock, reservedTickets: 0, soldTickets: 0 }); };
  const rejected = (promise, code) => assert.rejects(promise, error => error.details?.code === code);

  await t.test('stock boundaries are 0, 1, 1, 1, 2, 2 at 0, 1, 4, 5, 6, 20', () => {
    assert.deepEqual([0, 1, 4, 5, 6, 20].map(maxOrderQuantity), [0, 1, 1, 1, 2, 2]);
    assert.equal(presentEvent(config).orderReservationMinutes, 30);
  });
  await t.test('duplicate lines and legacy aliases cannot bypass the two-item cap', async () => {
    await reset();
    const legacy = new mongoose.Types.ObjectId();
    await StallFood.collection.updateOne({ _id: entries[0]._id }, { $set: { legacyFoodItemId: legacy } });
    await rejected(place([item(0, 2), item()]), 'ORDER_QUANTITY_LIMIT');
    await rejected(place([item(0, 2), { foodItemId: String(legacy), quantity: 1 }]), 'ORDER_QUANTITY_LIMIT');
    assert.equal(await Order.countDocuments(), 0);
    assert.equal((await StallFood.findById(entries[0]._id)).reservedTickets, 0);
    const result = await place([item(), item()]);
    assert.equal(result.order.items.length, 1); assert.equal(result.order.totalQuantity, 2);
    assert.ok(Math.abs(result.order.reservationExpiresAt - result.order.createdAt - 1800000) < 1000);
  });
  await t.test('exactly five remaining only permits one', async () => {
    await reset(5);
    await rejected(place([item(0, 2)]), 'ORDER_QUANTITY_LIMIT');
    await place();
    assert.equal((await StallFood.findById(entries[0]._id)).reservedTickets, 1);
  });
  await t.test('racing two-item orders recheck the low-stock threshold after conflict', async () => {
    await reset(6);
    const results = await Promise.allSettled(users.slice(0, 2).map(user => place([item(0, 2)], user)));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.find(result => result.status === 'rejected').reason.details.code, 'ORDER_QUANTITY_LIMIT');
    assert.equal((await StallFood.findById(entries[0]._id)).reservedTickets, 2);
  });
  await t.test('parallel checkouts only place three orders and other accounts still work', async () => {
    await reset();
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => place()));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 3);
    for (const result of results.filter(result => result.status === 'rejected')) {
      assert.equal(result.reason.statusCode, 429);
      assert.equal(result.reason.details.code, 'ORDER_RATE_LIMITED');
      assert.ok(result.reason.details.retryAfterSeconds > 0);
    }
    assert.equal((await StallFood.findById(entries[0]._id)).reservedTickets, 3);
    for (const order of await Order.find({ userId: users[0]._id })) await cancelOrder(order);
    await rejected(place(), 'ORDER_RATE_LIMITED');
    await place([item()], users[1]);
    // Advancing historical timestamps simulates the rolling-hour allowance reopening.
    await Order.collection.updateMany({ userId: users[0]._id }, { $set: { createdAt: new Date(Date.now() - 3601000) } });
    await place();
  });
  await t.test('failure in a later stock line rolls back earlier reservations and user allowance', async () => {
    await reset();
    const sorted = [...entries].sort((a, b) => String(a._id).localeCompare(String(b._id)));
    await StallFood.updateOne({ _id: sorted[1]._id }, { ticketLimit: 0 });
    await rejected(place(sorted.map(entry => ({ stallFoodId: String(entry._id), quantity: 1 }))), 'ORDER_QUANTITY_LIMIT');
    assert.equal((await StallFood.findById(sorted[0]._id)).reservedTickets, 0);
    assert.equal(await Order.countDocuments(), 0);
  });
  await t.test('order insert failure rolls back reserved stock', async t => {
    await reset();
    const mock = t.mock.method(Order, 'create', async () => { throw new Error('Simulated write failure'); });
    await assert.rejects(place(), /Simulated write failure/);
    mock.mock.restore();
    assert.equal((await StallFood.findById(entries[0]._id)).reservedTickets, 0);
    assert.equal(await Order.countDocuments(), 0);
  });
  await t.test('concurrent expiry restores unpaid and missing-proof stock exactly once', async () => {
    await reset();
    const unpaid = (await place()).order;
    const missingProof = (await place()).order;
    await Order.updateOne({ _id: unpaid._id }, { reservationExpiresAt: new Date(0) });
    await Order.updateOne({ _id: missingProof._id }, { status: 'PAYMENT_DECLARED', paymentProofExpiresAt: new Date(0) });
    await Promise.all([releaseExpiredReservations(), releaseExpiredReservations()]);
    assert.equal((await StallFood.findById(entries[0]._id)).reservedTickets, 0);
    assert.equal((await Order.findById(unpaid._id)).status, 'EXPIRED');
    assert.equal((await Order.findById(missingProof._id)).status, 'PAYMENT_EVIDENCE_EXPIRED');
  });
  await t.test('failed multi-food release leaves both order and stock unchanged for retry', async () => {
    await reset();
    const order = (await place([item(), item(1)])).order;
    await Order.updateOne({ _id: order._id }, { reservationExpiresAt: new Date(0) });
    await StallFood.updateOne({ _id: entries[1]._id }, { reservedTickets: 0 });
    await assert.rejects(releaseExpiredReservations());
    assert.equal((await Order.findById(order._id)).inventoryStatus, 'RESERVED');
    assert.equal((await StallFood.findById(entries[0]._id)).reservedTickets, 1);
    await StallFood.updateOne({ _id: entries[1]._id }, { reservedTickets: 1 });
    await releaseExpiredReservations();
    assert.equal((await StallFood.findById(entries[0]._id)).reservedTickets, 0);
  });
});
