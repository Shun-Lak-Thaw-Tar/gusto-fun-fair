import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import env from '../src/config/env.js';
import EventConfig from '../src/models/EventConfig.js';
import Food from '../src/models/Food.js';
import StallFood from '../src/models/StallFood.js';
import Order from '../src/models/Order.js';
import Stall from '../src/models/Stall.js';
import Ticket from '../src/models/Ticket.js';
import User from '../src/models/User.js';

const uri = 'mongodb://127.0.0.1:27017/funfair_v13_test';

test('Backend V1.3 Admin and Stall Owner system', async (t) => {
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  await Promise.all([User.init(), Stall.init()]);
  const eventDate = new Date('2032-06-20T09:00:00.000Z');
  await EventConfig.create({ configKey: 'current', eventName: 'V1.3 Test Event', eventDate, preorderOpenAt: new Date('2032-01-01T00:00:00.000Z'), preorderCloseAt: new Date(eventDate.getTime() - 86_400_000), orderingEnabled: true, kbzAccountName: 'Test', kbzAccountNumber: '000', paymentInstructions: 'Test', orderReservationMinutes: 60, paymentProofGraceMinutes: 30 });
  const [admin, user] = await User.create([{ name: 'V13 Admin', nameNormalized: 'v13 admin', passwordHash: 'test', role: 'admin' }, { name: 'V13 User', nameNormalized: 'v13 user', passwordHash: 'test', role: 'user' }]);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = (account) => jwt.sign({ role: account.role }, env.jwtSecret, { subject: String(account._id), expiresIn: '10m' });
  const adminHeaders = { Authorization: `Bearer ${token(admin)}` };
  const userHeaders = { Authorization: `Bearer ${token(user)}` };
  const request = async (path, { method = 'GET', headers = {}, body } = {}) => {
    const response = await fetch(`${base}${path}`, { method, headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: await response.json() };
  };

  await t.test('unauthenticated callers cannot manage stalls', async () => assert.equal((await request('/admin/stalls')).status, 401));
  await t.test('normal users cannot manage stalls', async () => assert.equal((await request('/admin/stalls', { headers: userHeaders })).status, 403));
  const stallBody = { stallName: 'Owner Food Hub', batch: 'Batch 13', description: 'Test stall', image: { url: '/stall.jpg', provider: 'test', storageKey: '' } };
  const stallAResponse = await request('/admin/stalls', { method: 'POST', headers: adminHeaders, body: stallBody });
  const stallA = stallAResponse.body.stall;
  await t.test('Admin creates a stall with a generated slug', () => { assert.equal(stallAResponse.status, 201); assert.equal(stallA.slug, 'owner-food-hub'); });
  const stallBResponse = await request('/admin/stalls', { method: 'POST', headers: adminHeaders, body: { ...stallBody, batch: 'Batch 14' } });
  const stallB = stallBResponse.body.stall;
  await t.test('duplicate stall names receive unique slugs', () => assert.equal(stallB.slug, 'owner-food-hub-2'));
  await t.test('stall-wide discounts are rejected', async () => assert.equal((await request('/admin/stalls', { method: 'POST', headers: adminHeaders, body: { ...stallBody, discount: { type: 'percentage', value: 10 } } })).status, 400));
  await t.test('Admin lists a dynamic number of stalls', async () => assert.equal((await request('/admin/stalls', { headers: adminHeaders })).body.stalls.length, 2));
  const renamed = await request(`/admin/stalls/${stallA._id}`, { method: 'PATCH', headers: adminHeaders, body: { stallName: 'Renamed Owner Hub' } });
  await t.test('Admin edits a stall while its slug remains stable', () => { assert.equal(renamed.body.stall.stallName, 'Renamed Owner Hub'); assert.equal(renamed.body.stall.slug, stallA.slug); });
  await t.test('Admin deactivates a stall', async () => assert.equal((await request(`/admin/stalls/${stallA._id}/status`, { method: 'PATCH', headers: adminHeaders, body: { isActive: false } })).body.stall.isActive, false));
  await t.test('deactivated stall disappears from public listing', async () => assert.equal((await request('/stalls')).body.stalls.some((stall) => stall._id === stallA._id), false));
  await t.test('no hard-delete Stall endpoint exists', async () => assert.equal((await request(`/admin/stalls/${stallA._id}`, { method: 'DELETE', headers: adminHeaders })).status, 404));
  await request(`/admin/stalls/${stallA._id}/status`, { method: 'PATCH', headers: adminHeaders, body: { isActive: true } });

  const foodBody = { name: 'Owner Burger', description: 'Test food', category: 'Main', isActive: true, image: { url: '/food.jpg' } };
  await t.test('generic food creation rejects stall-owned fields', async () => assert.equal((await request('/admin/foods', { method: 'POST', headers: adminHeaders, body: { ...foodBody, stallId: stallA._id } })).status, 400));
  await t.test('generic food creation rejects pricing fields', async () => assert.equal((await request('/admin/foods', { method: 'POST', headers: adminHeaders, body: { ...foodBody, eventDayPrice: 1 } })).status, 400));
  const foodAResponse = await request('/admin/foods', { method: 'POST', headers: adminHeaders, body: foodBody });
  const foodA = foodAResponse.body.food;
  const foodBResponse = await request('/admin/foods', { method: 'POST', headers: adminHeaders, body: { ...foodBody, name: 'Other Tea' } });
  const foodB = foodBResponse.body.food;
  await t.test('Admin creates independent generic foods', () => assert.equal(foodAResponse.status, 201));
  const stallFoodAResponse = await request('/admin/stall-foods', { method: 'POST', headers: adminHeaders, body: { stallId: stallA._id, foodId: foodA._id, eventDayPrice: 5000, discount: { type: 'percentage', value: 10 }, ticketLimit: 10, isAvailable: true } });
  const stallFoodA = stallFoodAResponse.body.stallFood;
  const stallFoodBResponse = await request('/admin/stall-foods', { method: 'POST', headers: adminHeaders, body: { stallId: stallB._id, foodId: foodB._id, eventDayPrice: 2500, discount: { type: 'fixed', value: 500 }, ticketLimit: 10, isAvailable: true } });
  const stallFoodB = stallFoodBResponse.body.stallFood;
  await t.test('Admin creates StallFood with calculated preorder price', () => { assert.equal(stallFoodAResponse.status, 201); assert.equal(stallFoodA.preorderPrice, 4500); });
  await StallFood.updateOne({ _id: stallFoodA._id }, { reservedTickets: 2, soldTickets: 3 });
  await t.test('ticket limit below reserved plus sold is rejected', async () => assert.equal((await request(`/admin/stall-foods/${stallFoodA._id}`, { method: 'PATCH', headers: adminHeaders, body: { ticketLimit: 4 } })).status, 409));
  await t.test('ticket limit may decrease to reserved plus sold', async () => assert.equal((await request(`/admin/stall-foods/${stallFoodA._id}`, { method: 'PATCH', headers: adminHeaders, body: { ticketLimit: 5 } })).status, 200));
  await t.test('ticket limit may increase', async () => assert.equal((await request(`/admin/stall-foods/${stallFoodA._id}`, { method: 'PATCH', headers: adminHeaders, body: { ticketLimit: 20 } })).body.stallFood.ticketLimit, 20));
  await t.test('Admin edits and disables StallFood', async () => { const result = await request(`/admin/stall-foods/${stallFoodA._id}`, { method: 'PATCH', headers: adminHeaders, body: { eventDayPrice: 6000, isAvailable: false } }); assert.equal(result.body.stallFood.preorderPrice, 5400); assert.equal(result.body.stallFood.isAvailable, false); });
  await t.test('disabled StallFood disappears from public ordering', async () => assert.equal((await request('/foods')).body.foods.some((food) => food.stallFoodId === stallFoodA._id), false));
  await request(`/admin/stall-foods/${stallFoodA._id}`, { method: 'PATCH', headers: adminHeaders, body: { isAvailable: true } });

  const orderItem = (stall, food, stallFood, quantity, subtotal) => ({ stallId: stall._id, foodId: food._id, stallFoodId: stallFood._id, stallName: stall.stallName, foodName: food.name, quantity, unitPrice: subtotal / quantity, subtotal });
  const makeOrder = (status, reference, items) => ({ userId: user._id, items, totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0), totalAmount: items.reduce((sum, item) => sum + item.subtotal, 0), status, inventoryStatus: status === 'PAYMENT_APPROVED' ? 'SOLD' : 'RESERVED', paymentReference: reference, reservationExpiresAt: new Date(Date.now() + 60_000) });
  const [approvedOrder, secondApproved, submittedOrder] = await Order.create([
    makeOrder('PAYMENT_APPROVED', 'FF-ORDER-V13A', [orderItem(stallA, foodA, stallFoodA, 2, 9000), orderItem(stallB, foodB, stallFoodB, 4, 8000)]),
    makeOrder('PAYMENT_APPROVED', 'FF-ORDER-V13B', [orderItem(stallA, foodA, stallFoodA, 1, 7000)]),
    makeOrder('PAYMENT_SUBMITTED', 'FF-ORDER-V13C', [orderItem(stallA, foodA, stallFoodA, 10, 100)]),
  ]);
  const snapshot = (await Order.findById(approvedOrder._id)).items[0].unitPrice;
  await request(`/admin/stall-foods/${stallFoodA._id}`, { method: 'PATCH', headers: adminHeaders, body: { eventDayPrice: 8000 } });
  await t.test('food edits do not alter historical order prices', async () => assert.equal((await Order.findById(approvedOrder._id)).items[0].unitPrice, snapshot));
  await t.test('Admin lists all orders', async () => assert.equal((await request('/admin/orders', { headers: adminHeaders })).body.orders.length, 3));
  await t.test('Admin filters orders by status', async () => { const result = await request('/admin/orders?status=PAYMENT_SUBMITTED', { headers: adminHeaders }); assert.equal(result.body.orders.length, 1); assert.equal(result.body.orders[0].status, 'PAYMENT_SUBMITTED'); });
  await t.test('Admin opens order details with payment and ticket fields', async () => { const result = await request(`/admin/orders/${approvedOrder._id}`, { headers: adminHeaders }); assert.equal(result.status, 200); assert.ok('payment' in result.body); assert.ok('ticket' in result.body); });
  await t.test('normal user cannot list Admin orders', async () => assert.equal((await request('/admin/orders', { headers: userHeaders })).status, 403));
  await t.test('no arbitrary order status update exists', async () => assert.equal((await request(`/admin/orders/${approvedOrder._id}`, { method: 'PATCH', headers: adminHeaders, body: { status: 'CANCELLED' } })).status, 404));

  const stallStats = await request('/admin/statistics/stalls', { headers: adminHeaders });
  await t.test('stall statistics count approved snapshots only', () => { const a = stallStats.body.stalls.find((stall) => stall.stallId === stallA._id); assert.equal(a.approvedQuantity, 3); assert.equal(a.approvedRevenue, 16000); });
  await t.test('food statistics count approved snapshots only', async () => { const result = await request('/admin/statistics/foods', { headers: adminHeaders }); const a = result.body.foods.find((food) => food.stallFoodId === stallFoodA._id); assert.equal(a.approvedQuantity, 3); assert.equal(a.approvedRevenue, 16000); });
  await t.test('statistics overview is available', async () => assert.equal((await request('/admin/statistics/overview', { headers: adminHeaders })).status, 200));

  await t.test('Admin reads EventConfig', async () => assert.equal((await request('/admin/event', { headers: adminHeaders })).body.event.configKey, 'current'));
  await t.test('normal user cannot update EventConfig', async () => assert.equal((await request('/admin/event', { method: 'PATCH', headers: userHeaders, body: { orderingEnabled: false } })).status, 403));
  await t.test('invalid EventConfig date order is rejected', async () => assert.equal((await request('/admin/event', { method: 'PATCH', headers: adminHeaders, body: { preorderOpenAt: eventDate } })).status, 400));
  await t.test('close date may be more than one day before event', async () => assert.equal((await request('/admin/event', { method: 'PATCH', headers: adminHeaders, body: { preorderCloseAt: new Date(eventDate.getTime() - 2 * 86_400_000).toISOString() } })).status, 200));
  await t.test('Admin updates orderingEnabled', async () => assert.equal((await request('/admin/event', { method: 'PATCH', headers: adminHeaders, body: { orderingEnabled: false } })).body.event.orderingEnabled, false));
  await t.test('EventConfig edits do not change existing order history', async () => { const order = await Order.findById(approvedOrder._id); assert.equal(order.totalAmount, 17000); assert.equal(order.reservationExpiresAt.getTime(), approvedOrder.reservationExpiresAt.getTime()); });

  const ownerResponse = await request(`/admin/stalls/${stallA._id}/owner`, { method: 'POST', headers: adminHeaders, body: { name: 'owner_13', password: 'OwnerPassword13' } });
  const owner = ownerResponse.body.owner;
  await t.test('Admin creates linked stall owner with automatic role', () => { assert.equal(ownerResponse.status, 201); assert.equal(owner.role, 'stall_owner'); assert.equal(owner.stallId, stallA._id); });
  await t.test('owner password is hashed and never returned', async () => { assert.equal('passwordHash' in owner, false); const stored = await User.findById(owner._id).select('+passwordHash'); assert.equal(await bcrypt.compare('OwnerPassword13', stored.passwordHash), true); });
  await t.test('one owner per stall is enforced', async () => assert.equal((await request(`/admin/stalls/${stallA._id}/owner`, { method: 'POST', headers: adminHeaders, body: { name: 'second_owner', password: 'OwnerPassword13' } })).status, 409));
  await t.test('owner username shares global uniqueness', async () => assert.equal((await request(`/admin/stalls/${stallB._id}/owner`, { method: 'POST', headers: adminHeaders, body: { name: 'owner_13', password: 'OwnerPassword13' } })).status, 409));
  await t.test('Admin views owner without password hash', async () => { const result = await request(`/admin/stalls/${stallA._id}/owner`, { headers: adminHeaders }); assert.equal(result.body.owner.name, 'owner_13'); assert.equal('passwordHash' in result.body.owner, false); });
  await t.test('public registration cannot choose stall_owner role', async () => { const result = await request('/auth/register', { method: 'POST', body: { name: 'Public Attempt', password: 'PublicPassword13', role: 'stall_owner', stallId: stallB._id } }); assert.equal(result.body.user.role, 'user'); });
  await t.test('Admin resets owner password', async () => { await request(`/admin/stalls/${stallA._id}/owner/password`, { method: 'PATCH', headers: adminHeaders, body: { password: 'NewOwnerPassword13' } }); const login = await request('/auth/login', { method: 'POST', body: { name: 'owner_13', password: 'NewOwnerPassword13' } }); assert.equal(login.status, 200); });
  await t.test('Admin disables owner account', async () => assert.equal((await request(`/admin/stalls/${stallA._id}/owner/status`, { method: 'PATCH', headers: adminHeaders, body: { isActive: false } })).body.owner.isActive, false));
  const disabledOwner = await User.findById(owner._id);
  await t.test('disabled owner cannot use owner APIs', async () => assert.equal((await request('/stall-owner/dashboard', { headers: { Authorization: `Bearer ${token(disabledOwner)}` } })).status, 403));
  await request(`/admin/stalls/${stallA._id}/owner/status`, { method: 'PATCH', headers: adminHeaders, body: { isActive: true } });
  const enabledOwner = await User.findById(owner._id);
  const ownerHeaders = { Authorization: `Bearer ${token(enabledOwner)}` };
  await t.test('unauthenticated caller receives 401 on owner API', async () => assert.equal((await request('/stall-owner/dashboard')).status, 401));
  await t.test('normal user receives 403 on owner API', async () => assert.equal((await request('/stall-owner/dashboard', { headers: userHeaders })).status, 403));
  await t.test('Admin is not treated as a stall owner', async () => assert.equal((await request('/stall-owner/dashboard', { headers: adminHeaders })).status, 403));
  await t.test('owner dashboard returns only linked stall summary', async () => { const result = await request('/stall-owner/dashboard', { headers: ownerHeaders }); assert.equal(result.body.stall._id, stallA._id); assert.deepEqual(result.body.summary, { approvedRevenue: 16000, foodTicketsSold: 3 }); });
  await t.test('owner sees own stall', async () => assert.equal((await request('/stall-owner/stall', { headers: ownerHeaders })).body.stall._id, stallA._id));
  await t.test('owner sees only own foods', async () => { const foods = (await request('/stall-owner/foods', { headers: ownerHeaders })).body.foods; assert.equal(foods.every((food) => food.stallId === stallA._id), true); assert.equal(foods.some((food) => food.stallFoodId === stallFoodB._id), false); });
  await t.test('owner sales use approved historical stall items only', async () => { const result = await request('/stall-owner/sales', { headers: ownerHeaders }); assert.deepEqual(result.body.summary, { approvedRevenue: 16000, foodTicketsSold: 3 }); assert.equal(result.body.foods.length, 1); });
  await t.test('private owner API accepts no arbitrary stall ID', async () => assert.equal((await request(`/stall-owner/stalls/${stallB._id}`, { headers: ownerHeaders })).status, 404));
  await t.test('owner responses expose no customer or payment proof', async () => { const text = JSON.stringify((await request('/stall-owner/dashboard', { headers: ownerHeaders })).body); assert.doesNotMatch(text, /passwordHash|paymentProof|customer/i); });
  await t.test('share data is scoped and frontend-ready', async () => { const share = (await request('/stall-owner/share', { headers: ownerHeaders })).body.share; assert.equal(share.slug, stallA.slug); assert.equal(share.publicPath, `/stalls/${stallA.slug}`); assert.equal(share.foodNames.includes('Other Tea'), false); });

  const publicStall = await request(`/stalls/by-slug/${stallA.slug}`);
  await t.test('public stall slug endpoint returns public stall and calculated foods', () => { assert.equal(publicStall.status, 200); assert.equal(publicStall.body.stall._id, stallA._id); assert.ok('preorderPrice' in publicStall.body.foods[0]); });
  await t.test('public slug response exposes no private owner sales', () => assert.doesNotMatch(JSON.stringify(publicStall.body), /approvedRevenue|owner_13|passwordHash/));
  await request(`/admin/stalls/${stallA._id}/status`, { method: 'PATCH', headers: adminHeaders, body: { isActive: false } });
  await t.test('inactive stall cannot be loaded publicly by slug', async () => assert.equal((await request(`/stalls/by-slug/${stallA.slug}`)).status, 404));
  await request(`/admin/stalls/${stallA._id}/status`, { method: 'PATCH', headers: adminHeaders, body: { isActive: true } });

  const activeTicket = await Ticket.create({ orderId: approvedOrder._id, userId: user._id, code: 'FF32-V13AAA', status: 'ACTIVE' });
  const invalidTicket = await Ticket.create({ orderId: submittedOrder._id, userId: user._id, code: 'FF32-V13BBB', status: 'ACTIVE' });
  await t.test('dedicated Admin ticket lookup returns whole-order quantities', async () => { const result = await request(`/admin/tickets/${activeTicket.code}`, { headers: adminHeaders }); assert.equal(result.status, 200); assert.equal(result.body.ticket.orderId.totalQuantity, 6); });
  await t.test('normal user cannot use Admin ticket namespace', async () => assert.equal((await request(`/admin/tickets/${activeTicket.code}`, { headers: userHeaders })).status, 403));
  await t.test('approved ACTIVE ticket is redeemable as a whole order', async () => { const result = await request(`/admin/tickets/${activeTicket.code}/redeem`, { method: 'POST', headers: adminHeaders }); assert.equal(result.status, 200); assert.equal(result.body.ticket.status, 'REDEEMED'); assert.equal(result.body.ticket.orderId.totalQuantity, 6); });
  await t.test('repeat redemption is blocked', async () => assert.equal((await request(`/admin/tickets/${activeTicket.code}/redeem`, { method: 'POST', headers: adminHeaders })).status, 409));
  await t.test('ticket linked to non-approved order cannot be redeemed', async () => assert.equal((await request(`/admin/tickets/${invalidTicket.code}/redeem`, { method: 'POST', headers: adminHeaders })).status, 409));
  await t.test('old compatible ticket lookup remains available', async () => assert.equal((await request(`/tickets/${activeTicket.code}`, { headers: adminHeaders })).status, 200));

});
