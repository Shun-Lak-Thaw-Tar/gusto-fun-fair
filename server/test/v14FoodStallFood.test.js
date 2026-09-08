import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import env from '../src/config/env.js';
import EventConfig from '../src/models/EventConfig.js';
import Food from '../src/models/Food.js';
import FoodItem from '../src/models/FoodItem.js';
import Order from '../src/models/Order.js';
import Stall from '../src/models/Stall.js';
import StallFood from '../src/models/StallFood.js';
import User from '../src/models/User.js';
import { migrateLegacyFoodItems } from '../src/services/foodMigrationService.js';

const uri = 'mongodb://127.0.0.1:27017/funfair_v14_test';

test('Backend V1.4 Food and StallFood redesign', async (t) => {
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  await Promise.all([Food.init(), Stall.init(), StallFood.init(), User.init()]);
  const now = Date.now();
  await EventConfig.create({ configKey: 'current', eventName: 'V1.4 Test', eventDate: new Date(now + 10 * 86_400_000), preorderOpenAt: new Date(now - 86_400_000), preorderCloseAt: new Date(now + 9 * 86_400_000), orderingEnabled: true, kbzAccountName: 'Test', kbzAccountNumber: '000', paymentInstructions: 'Test', orderReservationMinutes: 60, paymentProofGraceMinutes: 30 });
  const [admin, customer] = await User.create([{ name: 'V14 Admin', nameNormalized: 'v14 admin', passwordHash: 'x', role: 'admin' }, { name: 'V14 Customer', nameNormalized: 'v14 customer', passwordHash: 'x', role: 'user' }]);
  const [stallA, stallB] = await Stall.create([{ stallName: 'V14 Golden Bites', batch: 'A', slug: 'v14-golden-bites' }, { stallName: 'V14 Tea Garden', batch: 'B', slug: 'v14-tea-garden' }]);
  const owner = await User.create({ name: 'V14 Owner', nameNormalized: 'v14 owner', passwordHash: 'x', role: 'stall_owner', stallId: stallA._id });
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const headers = (account) => ({ Authorization: `Bearer ${jwt.sign({ role: account.role }, env.jwtSecret, { subject: String(account._id), expiresIn: '10m' })}` });
  const request = async (path, { method = 'GET', account, body } = {}) => { const response = await fetch(`${base}${path}`, { method, headers: { ...(account ? headers(account) : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: response.status, body: await response.json() }; };

  const foodResponse = await request('/admin/foods', { method: 'POST', account: admin, body: { name: 'Shared Chicken Burger', description: 'One reusable identity', category: 'Main' } });
  const burger = foodResponse.body.food;
  await t.test('Food and Stall exist independently before assignment', () => { assert.equal(foodResponse.status, 201); assert.equal('stallId' in burger, false); assert.ok(stallA._id); });
  await t.test('non-admin roles cannot manage the Food catalog', async () => { assert.equal((await request('/admin/foods', { account: customer })).status, 403); assert.equal((await request('/admin/foods', { account: owner })).status, 403); });
  await t.test('Food catalog rejects selling fields', async () => assert.equal((await request('/admin/foods', { method: 'POST', account: admin, body: { name: 'Bad', eventDayPrice: 1 } })).status, 400));
  await t.test('Admin can list and update generic Food', async () => { assert.equal((await request('/admin/foods', { account: admin })).body.foods.length, 1); const result = await request(`/admin/foods/${burger._id}`, { method: 'PATCH', account: admin, body: { description: 'Updated identity' } }); assert.equal(result.body.food.description, 'Updated identity'); });

  const menuAResponse = await request('/admin/stall-foods', { method: 'POST', account: admin, body: { stallId: String(stallA._id), foodId: burger._id, eventDayPrice: 5000, discount: { type: 'percentage', value: 10 }, ticketLimit: 100, isAvailable: true } });
  const menuBResponse = await request('/admin/stall-foods', { method: 'POST', account: admin, body: { stallId: String(stallB._id), foodId: burger._id, eventDayPrice: 5500, discount: { type: 'percentage', value: 15 }, ticketLimit: 50, isAvailable: true } });
  const menuA = menuAResponse.body.stallFood; const menuB = menuBResponse.body.stallFood;
  await t.test('same Food links to two stalls with independent selling data', () => { assert.equal(menuA.foodId._id, burger._id); assert.equal(menuB.foodId._id, burger._id); assert.equal(menuA.preorderPrice, 4500); assert.equal(menuB.preorderPrice, 4675); assert.equal(menuA.ticketLimit, 100); assert.equal(menuB.ticketLimit, 50); });
  await t.test('duplicate stall and Food assignment is rejected', async () => assert.equal((await request('/admin/stall-foods', { method: 'POST', account: admin, body: { stallId: String(stallA._id), foodId: burger._id, eventDayPrice: 1, discount: { type: 'percentage', value: 0 }, ticketLimit: 1 } })).status, 409));
  await t.test('StallFood supports list filters and strict internal fields', async () => { assert.equal((await request(`/admin/stall-foods?stallId=${stallA._id}`, { account: admin })).body.stallFoods.length, 1); assert.equal((await request(`/admin/stall-foods?foodId=${burger._id}`, { account: admin })).body.stallFoods.length, 2); assert.equal((await request(`/admin/stall-foods/${menuA._id}`, { method: 'PATCH', account: admin, body: { reservedTickets: 99 } })).status, 400); });

  const fries = (await request('/admin/foods', { method: 'POST', account: admin, body: { name: 'V14 Fries' } })).body.food;
  const tea = (await request('/admin/foods', { method: 'POST', account: admin, body: { name: 'V14 Milk Tea' } })).body.food;
  const friesMenu = (await request('/admin/stall-foods', { method: 'POST', account: admin, body: { stallId: String(stallA._id), foodId: fries._id, eventDayPrice: 3000, discount: { type: 'percentage', value: 5 }, ticketLimit: 30 } })).body.stallFood;
  const teaMenu = (await request('/admin/stall-foods', { method: 'POST', account: admin, body: { stallId: String(stallA._id), foodId: tea._id, eventDayPrice: 2500, discount: { type: 'percentage', value: 0 }, ticketLimit: 20 } })).body.stallFood;
  await t.test('one stall has independent 10%, 5%, and 0% food discounts', () => { assert.equal(menuA.preorderPrice, 4500); assert.equal(friesMenu.preorderPrice, 2850); assert.equal(teaMenu.preorderPrice, 2500); });

  await t.test('public API returns enriched sellable entries without raw counters', async () => { const result = await request('/foods'); const entry = result.body.foods.find((item) => item.stallFoodId === menuA._id); assert.equal(entry.food.name, burger.name); assert.equal(entry.stallName, stallA.stallName); assert.equal(entry.ticketsRemaining, 100); assert.equal(entry.preorderPrice, 4500); assert.equal('reservedTickets' in entry, false); assert.equal('soldTickets' in entry, false); });
  await t.test('inactive Food, inactive Stall, and unavailable StallFood are excluded', async () => { await Food.updateOne({ _id: tea._id }, { isActive: false }); await Stall.updateOne({ _id: stallB._id }, { isActive: false }); await StallFood.updateOne({ _id: friesMenu._id }, { isAvailable: false }); const ids = (await request('/foods')).body.foods.map((entry) => entry.stallFoodId); assert.equal(ids.includes(teaMenu._id), false); assert.equal(ids.includes(menuB._id), false); assert.equal(ids.includes(friesMenu._id), false); await Food.updateOne({ _id: tea._id }, { isActive: true }); await Stall.updateOne({ _id: stallB._id }, { isActive: true }); await StallFood.updateOne({ _id: friesMenu._id }, { isAvailable: true }); });

  await t.test('canonical order rejects client pricing fields', async () => assert.equal((await request('/orders', { method: 'POST', account: customer, body: { items: [{ stallFoodId: menuA._id, quantity: 1, subtotal: 1 }] } })).status, 400));
  const orderResponse = await request('/orders', { method: 'POST', account: customer, body: { items: [{ stallFoodId: menuA._id, quantity: 2 }] } });
  const orderId = orderResponse.body.order._id;
  await t.test('canonical order uses authoritative StallFood pricing and snapshots', () => { const item = orderResponse.body.order.items[0]; assert.equal(orderResponse.status, 201); assert.equal(item.stallFoodId, menuA._id); assert.equal(item.foodId, burger._id); assert.equal(item.unitPrice, 4500); assert.equal(item.subtotal, 9000); assert.equal(orderResponse.body.order.totalAmount, 9000); });
  await t.test('ordering one stall leaves the other stall inventory unchanged', async () => { const [a, b] = await Promise.all([StallFood.findById(menuA._id), StallFood.findById(menuB._id)]); assert.equal(a.reservedTickets, 2); assert.equal(b.reservedTickets, 0); });
  await t.test('ticket-limit safety uses reserved plus sold', async () => { await StallFood.updateOne({ _id: menuA._id }, { soldTickets: 3 }); assert.equal((await request(`/admin/stall-foods/${menuA._id}`, { method: 'PATCH', account: admin, body: { ticketLimit: 4 } })).status, 409); assert.equal((await request(`/admin/stall-foods/${menuA._id}`, { method: 'PATCH', account: admin, body: { ticketLimit: 5 } })).status, 200); });
  await t.test('later identity and pricing edits do not alter historical snapshots', async () => { await Food.updateOne({ _id: burger._id }, { name: 'Renamed Burger' }); await Stall.updateOne({ _id: stallA._id }, { stallName: 'Renamed Stall' }); await StallFood.updateOne({ _id: menuA._id }, { eventDayPrice: 9999, discount: { type: 'percentage', value: 0 } }); const order = await Order.findById(orderId).lean(); assert.equal(order.items[0].foodName, 'Shared Chicken Burger'); assert.equal(order.items[0].stallName, 'V14 Golden Bites'); assert.equal(order.items[0].unitPrice, 4500); assert.equal(order.items[0].subtotal, 9000); assert.equal(order.totalAmount, 9000); });
  await t.test('stall owner sees only populated menu entries and has no write route', async () => { const result = await request('/stall-owner/foods', { account: owner }); assert.equal(result.body.foods.every((entry) => entry.stallId === String(stallA._id)), true); assert.ok(result.body.foods[0].food.name); assert.equal(result.body.foods.some((entry) => entry.stallFoodId === menuB._id), false); assert.equal((await request(`/stall-owner/foods/${menuA._id}`, { method: 'PATCH', account: owner, body: { eventDayPrice: 1 } })).status, 404); });

  const legacyStall = await Stall.create({ stallName: 'Legacy Stall', batch: 'L', slug: 'legacy-stall', discount: { type: 'fixed', value: 250 } });
  const legacy = await FoodItem.create({ stallId: legacyStall._id, name: 'Legacy Food', description: 'Preserve me', eventDayPrice: 4000, ticketLimit: 12, reservedTickets: 2, soldTickets: 3, isAvailable: false });
  const historical = await Order.create({ userId: customer._id, items: [{ foodItemId: legacy._id, stallId: legacyStall._id, stallName: 'Legacy Stall', foodName: 'Legacy Food', quantity: 1, unitPrice: 3750, subtotal: 3750 }], totalQuantity: 1, totalAmount: 3750, status: 'PAYMENT_APPROVED', inventoryStatus: 'SOLD', paymentReference: 'FF-V14-LEGACY', reservationExpiresAt: new Date(now + 60_000) });
  const firstMigration = await migrateLegacyFoodItems(); const secondMigration = await migrateLegacyFoodItems();
  await t.test('migration copies legacy data and stall discount without repricing history', async () => { const migratedFood = await Food.findOne({ legacyFoodItemId: legacy._id }); const migratedMenu = await StallFood.findOne({ legacyFoodItemId: legacy._id }); const migratedOrder = await Order.findById(historical._id); assert.equal(firstMigration.foodsCreated, 1); assert.equal(migratedFood.name, 'Legacy Food'); assert.equal(migratedMenu.eventDayPrice, 4000); assert.deepEqual(migratedMenu.discount.toObject(), { type: 'fixed', value: 250 }); assert.equal(migratedMenu.ticketLimit, 12); assert.equal(migratedMenu.reservedTickets, 2); assert.equal(migratedMenu.soldTickets, 3); assert.equal(migratedMenu.isAvailable, false); assert.equal(migratedOrder.items[0].unitPrice, 3750); assert.equal(migratedOrder.totalAmount, 3750); assert.ok(migratedOrder.items[0].stallFoodId); assert.ok(migratedOrder.items[0].foodId); });
  await t.test('migration rerun is idempotent', async () => { assert.equal(secondMigration.foodsCreated, 0); assert.equal(secondMigration.stallFoodsCreated, 0); assert.equal(secondMigration.orderItemsBackfilled, 0); assert.equal(await Food.countDocuments({ legacyFoodItemId: legacy._id }), 1); assert.equal(await StallFood.countDocuments({ legacyFoodItemId: legacy._id }), 1); });
});
