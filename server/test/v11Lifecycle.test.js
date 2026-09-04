import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { mediaStorage } from '../src/services/mediaService.js';
import EventConfig from '../src/models/EventConfig.js';
import Food from '../src/models/Food.js';
import StallFood from '../src/models/StallFood.js';
import Notification from '../src/models/Notification.js';
import Order from '../src/models/Order.js';
import Payment from '../src/models/Payment.js';
import Stall from '../src/models/Stall.js';
import Ticket from '../src/models/Ticket.js';
import User from '../src/models/User.js';
import { assertOrderingOpen, derivePreorderStatus } from '../src/services/eventService.js';
import { convertReservedToSold, releaseInventory, reserveInventory, ticketsRemaining } from '../src/services/inventoryService.js';
import { cancelOrder, declarePayment, releaseExpiredReservations } from '../src/services/orderLifecycleService.js';
import { reviewPayment } from '../src/services/paymentService.js';
import { createOrder } from '../src/controllers/orderController.js';
import { submitPayment } from '../src/controllers/paymentController.js';

const uri = process.env.TEST_MONGODB_URI;
const ids = {
  stallA: new mongoose.Types.ObjectId('700000000000000000000001'), stallB: new mongoose.Types.ObjectId('700000000000000000000002'),
  foodA: new mongoose.Types.ObjectId('710000000000000000000001'), foodB: new mongoose.Types.ObjectId('710000000000000000000002'), foodC: new mongoose.Types.ObjectId('710000000000000000000003'),
  genericA: new mongoose.Types.ObjectId('720000000000000000000001'), genericB: new mongoose.Types.ObjectId('720000000000000000000002'), genericC: new mongoose.Types.ObjectId('720000000000000000000003'),
};
const response = () => ({ statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const expectStatus = async (promise, statusCode) => assert.rejects(promise, (error) => error.statusCode === statusCode);

test('Backend V1.1 lifecycle', async (t) => {
  if (!uri) throw new Error('Run npm test to use the isolated test database');
  await mongoose.connect(uri, { dbName: `funfair_v11_test_${process.pid}` });
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  t.mock.method(mediaStorage, 'put', async () => {});
  const file = { buffer: await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer(), mimetype: 'image/png' };
  const now = new Date();
  await EventConfig.create({ configKey: 'current', eventName: 'Test Event', eventDate: new Date(now.getTime() + 10 * 86_400_000), preorderOpenAt: new Date(now.getTime() - 86_400_000), preorderCloseAt: new Date(now.getTime() + 9 * 86_400_000), orderingEnabled: true, orderReservationMinutes: 60, paymentProofGraceMinutes: 30, kbzAccountName: 'Test', kbzAccountNumber: '000', paymentInstructions: 'Test only' });
  await Stall.create([{ _id: ids.stallA, stallName: 'A', batch: 'A', discount: { type: 'percentage', value: 10 }, isActive: true }, { _id: ids.stallB, stallName: 'B', batch: 'B', discount: { type: 'fixed', value: 500 }, isActive: true }]);
  await Food.create([{ _id: ids.genericA, name: 'Burger' }, { _id: ids.genericB, name: 'Tea' }, { _id: ids.genericC, name: 'Unavailable' }]);
  await StallFood.create([{ _id: ids.foodA, stallId: ids.stallA, foodId: ids.genericA, eventDayPrice: 5000, discount: { type: 'percentage', value: 10 }, ticketLimit: 5, isAvailable: true }, { _id: ids.foodB, stallId: ids.stallB, foodId: ids.genericB, eventDayPrice: 2500, discount: { type: 'fixed', value: 500 }, ticketLimit: 3, isAvailable: true }, { _id: ids.foodC, stallId: ids.stallA, foodId: ids.genericC, eventDayPrice: 1000, discount: { type: 'percentage', value: 10 }, ticketLimit: 2, isAvailable: false }]);
  const [user, other, admin] = await User.create([{ name: 'User', nameNormalized: 'user', passwordHash: 'x', role: 'user' }, { name: 'Other', nameNormalized: 'other', passwordHash: 'x', role: 'user' }, { name: 'Admin', nameNormalized: 'admin', passwordHash: 'x', role: 'admin' }]);

  await t.test('event is open inside its window', () => assert.equal(derivePreorderStatus({ orderingEnabled: true, preorderOpenAt: new Date(now - 1), preorderCloseAt: new Date(now.getTime() + 1) }, now), 'OPEN'));
  await t.test('event is upcoming before opening', () => assert.equal(derivePreorderStatus({ orderingEnabled: true, preorderOpenAt: new Date(now.getTime() + 1), preorderCloseAt: new Date(now.getTime() + 2) }, now), 'UPCOMING'));
  await t.test('event is closed at the closing instant', () => assert.equal(derivePreorderStatus({ orderingEnabled: true, preorderOpenAt: new Date(now - 2), preorderCloseAt: now }, now), 'CLOSED'));
  await t.test('disabled ordering takes precedence', () => assert.equal(derivePreorderStatus({ orderingEnabled: false, preorderCloseAt: new Date(now.getTime() + 1) }, now), 'DISABLED'));
  await t.test('closed event rejects order eligibility', () => assert.throws(() => assertOrderingOpen({ orderingEnabled: true, preorderCloseAt: now }, now), { statusCode: 409 }));
  await t.test('disabled event rejects order eligibility', () => assert.throws(() => assertOrderingOpen({ orderingEnabled: false, preorderCloseAt: new Date(now.getTime() + 1) }, now), { statusCode: 409 }));
  await t.test('remaining inventory includes reserved and sold', () => assert.equal(ticketsRemaining({ ticketLimit: 10, reservedTickets: 2, soldTickets: 3 }), 5));
  await t.test('remaining inventory never reports negative', () => assert.equal(ticketsRemaining({ ticketLimit: 1, reservedTickets: 2, soldTickets: 3 }), 0));

  let created;
  await t.test('order creation consolidates duplicates and reserves inventory', async () => {
    const res = response();
    await createOrder({ user, body: { items: [{ stallFoodId: String(ids.foodA), quantity: 1 }, { stallFoodId: String(ids.foodA), quantity: 2 }, { stallFoodId: String(ids.foodB), quantity: 1 }] } }, res);
    created = res.body.order;
    assert.equal(res.statusCode, 201); assert.equal(created.items.length, 2); assert.equal(created.totalQuantity, 4); assert.equal(created.inventoryStatus, 'RESERVED');
  });
  await t.test('multi-stall order stores authoritative prices', () => { assert.deepEqual(created.items.map((item) => item.unitPrice).sort(), [2000, 4500]); assert.equal(created.totalAmount, 15500); });
  await t.test('reservation deadline uses configured 60 minutes', () => assert.ok(Math.abs(created.reservationExpiresAt - created.createdAt - 3_600_000) < 1000));
  await t.test('order has a distinct readable payment reference', () => assert.match(created.paymentReference, /^FF-ORDER-[A-HJ-NP-Z2-9]{6}$/));
  await t.test('inventory counters reflect the reservation', async () => { const foods = await StallFood.find({ _id: { $in: [ids.foodA, ids.foodB] } }).sort({ _id: 1 }); assert.deepEqual(foods.map((food) => food.reservedTickets), [3, 1]); });
  await t.test('insufficient inventory is rejected atomically', () => expectStatus(reserveInventory([{ stallFoodId: ids.foodA, foodName: 'Burger', quantity: 3 }]), 409));
  await t.test('unavailable item cannot be reserved', () => expectStatus(reserveInventory([{ stallFoodId: ids.foodC, foodName: 'Unavailable', quantity: 1 }]), 409));
  await t.test('concurrent reservations cannot oversell', async () => { const outcomes = await Promise.allSettled([reserveInventory([{ stallFoodId: ids.foodB, quantity: 2 }]), reserveInventory([{ stallFoodId: ids.foodB, quantity: 2 }])]); assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 1); assert.equal((await StallFood.findById(ids.foodB)).reservedTickets, 3); });
  await t.test('multi-item failure compensates earlier items', async () => { await releaseInventory([{ stallFoodId: ids.foodB, quantity: 2 }]); const before = (await StallFood.findById(ids.foodB)).reservedTickets; await expectStatus(reserveInventory([{ stallFoodId: ids.foodB, quantity: 1 }, { stallFoodId: ids.foodC, quantity: 3 }]), 409); assert.equal((await StallFood.findById(ids.foodB)).reservedTickets, before); });
  await t.test('invalid quantity is rejected by order validation', () => expectStatus(createOrder({ user, body: { items: [{ stallFoodId: String(ids.foodA), quantity: 0 }] } }, response()), 400));

  await t.test('payment declaration changes state and keeps inventory reserved', async () => { created = await declarePayment(await Order.findById(created._id), now); assert.equal(created.status, 'PAYMENT_DECLARED'); assert.equal(created.inventoryStatus, 'RESERVED'); assert.equal(created.paymentDeclaredAt.getTime(), now.getTime()); });
  await t.test('proof deadline uses configured 30 minutes', () => assert.equal(created.paymentProofExpiresAt - created.paymentDeclaredAt, 1_800_000));
  await t.test('repeated payment declaration is rejected', () => expectStatus(declarePayment(created, now), 409));
  await t.test('cancellation after declaration is rejected', () => expectStatus(cancelOrder(created), 409));
  await t.test('valid proof submission moves order to submitted while reserved', async () => { const res = response(); await submitPayment({ file, user, params: { orderId: String(created._id) }, body: { paymentProof: { url: '/proof/test.jpg' } } }, res); created = res.body.order; assert.equal(created.status, 'PAYMENT_SUBMITTED'); assert.equal(created.inventoryStatus, 'RESERVED'); });
  await t.test('submitted orders do not expire through cleanup', async () => { await Order.updateOne({ _id: created._id }, { reservationExpiresAt: new Date(0), paymentProofExpiresAt: new Date(0) }); await releaseExpiredReservations(); assert.equal((await Order.findById(created._id)).status, 'PAYMENT_SUBMITTED'); });
  await t.test('admin approval converts reserved inventory to sold', async () => { const payment = await Payment.findOne({ orderId: created._id }); const before = await StallFood.findById(ids.foodA); const result = await reviewPayment({ paymentId: payment._id, decision: 'APPROVED', adminId: admin._id }); const after = await StallFood.findById(ids.foodA); assert.equal(result.order.status, 'PAYMENT_APPROVED'); assert.equal(after.reservedTickets, before.reservedTickets - 3); assert.equal(after.soldTickets, before.soldTickets + 3); assert.equal(ticketsRemaining(after), ticketsRemaining(before)); });
  await t.test('approval creates exactly one ticket', async () => assert.equal(await Ticket.countDocuments({ orderId: created._id }), 1));
  await t.test('repeated approval does not double-sell or duplicate ticket', async () => { const payment = await Payment.findOne({ orderId: created._id }); const before = await StallFood.findById(ids.foodA); await reviewPayment({ paymentId: payment._id, decision: 'APPROVED', adminId: admin._id }); const after = await StallFood.findById(ids.foodA); assert.equal(after.soldTickets, before.soldTickets); assert.equal(await Ticket.countDocuments({ orderId: created._id }), 1); assert.equal(await Notification.countDocuments({ orderId: created._id, type: 'PAYMENT_APPROVED' }), 1); });
  await t.test('approved order cannot be cancelled', () => expectStatus(cancelOrder(created), 409));

  let cancellable;
  await t.test('awaiting-payment owner can cancel and release once', async () => { await reserveInventory([{ stallFoodId: ids.foodB, quantity: 1 }]); cancellable = await Order.create({ userId: user._id, items: [{ stallId: ids.stallB, stallFoodId: ids.foodB, stallName: 'B', foodName: 'Tea', quantity: 1, unitPrice: 2000, subtotal: 2000 }], totalQuantity: 1, totalAmount: 2000, paymentReference: 'FF-ORDER-CANCEL', reservationExpiresAt: new Date(Date.now() + 10000) }); const before = (await StallFood.findById(ids.foodB)).reservedTickets; cancellable = await cancelOrder(cancellable); assert.equal(cancellable.status, 'CANCELLED'); assert.equal(cancellable.inventoryStatus, 'RELEASED'); assert.equal((await StallFood.findById(ids.foodB)).reservedTickets, before - 1); });
  await t.test('repeated cancellation cannot release twice', async () => { const before = (await StallFood.findById(ids.foodB)).reservedTickets; await expectStatus(cancelOrder(cancellable), 409); assert.equal((await StallFood.findById(ids.foodB)).reservedTickets, before); });
  await t.test('another user cannot find an owned order using owner filter', async () => assert.equal(await Order.findOne({ _id: cancellable._id, userId: other._id }), null));

  let expiring;
  await t.test('awaiting-payment expiry releases inventory', async () => { await reserveInventory([{ stallFoodId: ids.foodB, quantity: 1 }]); expiring = await Order.create({ userId: user._id, items: [{ stallId: ids.stallB, stallFoodId: ids.foodB, stallName: 'B', foodName: 'Tea', quantity: 1, unitPrice: 2000, subtotal: 2000 }], totalQuantity: 1, totalAmount: 2000, paymentReference: 'FF-ORDER-EXPIRE', reservationExpiresAt: new Date(0) }); const before = (await StallFood.findById(ids.foodB)).reservedTickets; await releaseExpiredReservations(); expiring = await Order.findById(expiring._id); assert.equal(expiring.status, 'EXPIRED'); assert.equal(expiring.inventoryStatus, 'RELEASED'); assert.equal((await StallFood.findById(ids.foodB)).reservedTickets, before - 1); });
  await t.test('expired order cannot declare payment', () => expectStatus(declarePayment(expiring), 409));
  await t.test('repeated expiry cleanup does not double-release', async () => { const before = (await StallFood.findById(ids.foodB)).reservedTickets; await releaseExpiredReservations(); assert.equal((await StallFood.findById(ids.foodB)).reservedTickets, before); });

  let evidenceExpired;
  await t.test('evidence deadline expiry uses distinct status and releases', async () => { await reserveInventory([{ stallFoodId: ids.foodB, quantity: 1 }]); evidenceExpired = await Order.create({ userId: user._id, items: [{ stallId: ids.stallB, stallFoodId: ids.foodB, stallName: 'B', foodName: 'Tea', quantity: 1, unitPrice: 2000, subtotal: 2000 }], totalQuantity: 1, totalAmount: 2000, paymentReference: 'FF-ORDER-EVIDENCE', reservationExpiresAt: new Date(Date.now() + 10000), status: 'PAYMENT_DECLARED', paymentDeclaredAt: new Date(0), paymentProofExpiresAt: new Date(0) }); await releaseExpiredReservations(); evidenceExpired = await Order.findById(evidenceExpired._id); assert.equal(evidenceExpired.status, 'PAYMENT_EVIDENCE_EXPIRED'); assert.equal(evidenceExpired.inventoryStatus, 'RELEASED'); });
  await t.test('late proof upload is rejected', () => expectStatus(submitPayment({ file, user, params: { orderId: String(evidenceExpired._id) }, body: { paymentProof: { url: '/late.jpg' } } }, response()), 409));
  await t.test('evidence-expired order cannot be cancelled', () => expectStatus(cancelOrder(evidenceExpired), 409));

  let rejected;
  await t.test('admin rejection releases reserved inventory and creates no ticket', async () => { await reserveInventory([{ stallFoodId: ids.foodB, quantity: 1 }]); rejected = await Order.create({ userId: user._id, items: [{ stallId: ids.stallB, stallFoodId: ids.foodB, stallName: 'B', foodName: 'Tea', quantity: 1, unitPrice: 2000, subtotal: 2000 }], totalQuantity: 1, totalAmount: 2000, paymentReference: 'FF-ORDER-REJECT', reservationExpiresAt: new Date(Date.now() + 10000), status: 'PAYMENT_SUBMITTED' }); const payment = await Payment.create({ orderId: rejected._id, userId: user._id, paymentProof: { url: '/proof.jpg' } }); const result = await reviewPayment({ paymentId: payment._id, decision: 'REJECTED', rejectionReason: 'Unreadable proof', adminId: admin._id }); rejected = result.order; assert.equal(rejected.status, 'PAYMENT_REJECTED'); assert.equal(rejected.inventoryStatus, 'RELEASED'); assert.equal(await Ticket.countDocuments({ orderId: rejected._id }), 0); });
  await t.test('repeated rejection has no duplicate release or notification', async () => { const payment = await Payment.findOne({ orderId: rejected._id }); const before = (await StallFood.findById(ids.foodB)).reservedTickets; await reviewPayment({ paymentId: payment._id, decision: 'REJECTED', rejectionReason: 'Unreadable proof', adminId: admin._id }); assert.equal((await StallFood.findById(ids.foodB)).reservedTickets, before); assert.equal(await Notification.countDocuments({ orderId: rejected._id, type: 'PAYMENT_REJECTED' }), 1); });
  await t.test('rejected order cannot later be approved', async () => { const payment = await Payment.findOne({ orderId: rejected._id }); await expectStatus(reviewPayment({ paymentId: payment._id, decision: 'APPROVED', adminId: admin._id }), 409); });
  await t.test('rejected order cannot be cancelled', () => expectStatus(cancelOrder(rejected), 409));

});
