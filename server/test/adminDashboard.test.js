import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import env from '../src/config/env.js';
import FoodItem from '../src/models/FoodItem.js';
import Order from '../src/models/Order.js';
import Stall from '../src/models/Stall.js';
import Ticket from '../src/models/Ticket.js';
import User from '../src/models/User.js';

const databaseUri = 'mongodb://127.0.0.1:27017/funfair_admin_dashboard_test';

test('Admin Dashboard metrics and authorization', async (t) => {
  await mongoose.connect(databaseUri);
  await mongoose.connection.dropDatabase();

  const [admin, user] = await User.create([
    { name: 'Dashboard Admin', nameNormalized: 'dashboard admin', passwordHash: 'test', role: 'admin' },
    { name: 'Dashboard User', nameNormalized: 'dashboard user', passwordHash: 'test', role: 'user' },
  ]);
  const [stallA, stallB, inactiveStall] = await Stall.create([
    { stallName: 'Dashboard A', batch: 'A', discount: { type: 'fixed', value: 0 }, isActive: true },
    { stallName: 'Dashboard B', batch: 'B', discount: { type: 'fixed', value: 0 }, isActive: true },
    { stallName: 'Dashboard Inactive', batch: 'C', discount: { type: 'fixed', value: 0 }, isActive: false },
  ]);
  await FoodItem.create([
    { stallId: stallA._id, name: 'Available A', eventDayPrice: 1000, ticketLimit: 10, isAvailable: true },
    { stallId: stallB._id, name: 'Available B', eventDayPrice: 1000, ticketLimit: 10, isAvailable: true },
    { stallId: stallA._id, name: 'Unavailable', eventDayPrice: 1000, ticketLimit: 10, isAvailable: false },
    { stallId: inactiveStall._id, name: 'Inactive Stall Food', eventDayPrice: 1000, ticketLimit: 10, isAvailable: true },
  ]);

  const makeOrder = (status, sequence, totalQuantity = 1, totalAmount = 1000, stall = stallA) => ({
    userId: user._id,
    items: [{ stallId: stall._id, foodItemId: new mongoose.Types.ObjectId(), stallName: stall.stallName, foodName: `Food ${sequence}`, quantity: totalQuantity, unitPrice: totalAmount / totalQuantity, subtotal: totalAmount }],
    totalQuantity,
    totalAmount,
    status,
    inventoryStatus: status === 'PAYMENT_APPROVED' ? 'SOLD' : ['AWAITING_PAYMENT', 'PAYMENT_DECLARED', 'PAYMENT_SUBMITTED'].includes(status) ? 'RESERVED' : 'RELEASED',
    paymentReference: `FF-ORDER-DASH${sequence}`,
    reservationExpiresAt: new Date(Date.now() + 60_000),
  });
  const orders = await Order.create([
    makeOrder('AWAITING_PAYMENT', 1),
    makeOrder('PAYMENT_DECLARED', 2),
    makeOrder('PAYMENT_SUBMITTED', 3),
    makeOrder('PAYMENT_APPROVED', 4, 3, 3000, stallA),
    makeOrder('PAYMENT_APPROVED', 5, 2, 2000, stallB),
    makeOrder('PAYMENT_APPROVED', 6, 1, 1000, stallA),
    makeOrder('PAYMENT_REJECTED', 7),
    makeOrder('EXPIRED', 8),
    makeOrder('PAYMENT_EVIDENCE_EXPIRED', 9),
    makeOrder('CANCELLED', 10),
  ]);
  await Ticket.create([
    { orderId: orders[3]._id, userId: user._id, code: 'FF30-DASH01', status: 'ACTIVE' },
    { orderId: orders[4]._id, userId: user._id, code: 'FF30-DASH02', status: 'REDEEMED' },
    { orderId: orders[5]._id, userId: user._id, code: 'FF30-DASH03', status: 'REDEEMED' },
  ]);

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/api/admin/dashboard`;
  const token = (account) => jwt.sign({ role: account.role }, env.jwtSecret, { subject: String(account._id), expiresIn: '5m' });

  await t.test('unauthenticated request is denied', async () => assert.equal((await fetch(url)).status, 401));
  await t.test('normal user is denied', async () => assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${token(user)}` } })).status, 403));

  const response = await fetch(url, { headers: { Authorization: `Bearer ${token(admin)}` } });
  const { dashboard } = await response.json();
  await t.test('Admin can access Dashboard', () => assert.equal(response.status, 200));
  await t.test('totalOrders counts all orders', () => assert.equal(dashboard.totalOrders, 10));
  await t.test('awaitingPayment counts correctly', () => assert.equal(dashboard.awaitingPayment, 1));
  await t.test('paymentDeclared counts correctly', () => assert.equal(dashboard.paymentDeclared, 1));
  await t.test('pendingPaymentReview counts submitted orders', () => assert.equal(dashboard.pendingPaymentReview, 1));
  await t.test('approvedOrders counts correctly', () => assert.equal(dashboard.approvedOrders, 3));
  await t.test('rejectedOrders counts correctly', () => assert.equal(dashboard.rejectedOrders, 1));
  await t.test('expiredOrders combines both expiry states', () => assert.equal(dashboard.expiredOrders, 2));
  await t.test('cancelledOrders counts correctly', () => assert.equal(dashboard.cancelledOrders, 1));
  await t.test('approvedRevenue excludes non-approved orders', () => assert.equal(dashboard.approvedRevenue, 6000));
  await t.test('foodTicketsSold sums approved item quantities', () => assert.equal(dashboard.foodTicketsSold, 6));
  await t.test('digitalTicketsIssued counts Ticket records', () => assert.equal(dashboard.digitalTicketsIssued, 3));
  await t.test('digitalTicketsRedeemed counts redeemed tickets', () => assert.equal(dashboard.digitalTicketsRedeemed, 2));
  await t.test('physicalTicketsIssued sums redeemed order quantities', () => assert.equal(dashboard.physicalTicketsIssued, 3));
  await t.test('activeStalls is dynamic', () => assert.equal(dashboard.activeStalls, 2));
  await t.test('availableFoodItems excludes unavailable foods and inactive stalls', () => assert.equal(dashboard.availableFoodItems, 2));

  await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
