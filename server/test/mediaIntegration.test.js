import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import app from '../src/app.js';
import env from '../src/config/env.js';
import EventConfig from '../src/models/EventConfig.js';
import User from '../src/models/User.js';
import Order from '../src/models/Order.js';
import Payment from '../src/models/Payment.js';
import Food from '../src/models/Food.js';
import StallFood from '../src/models/StallFood.js';
import Stall from '../src/models/Stall.js';
import Ticket from '../src/models/Ticket.js';
import Memory from '../src/models/Memory.js';
import MemoryReaction from '../src/models/MemoryReaction.js';
import MediaAsset from '../src/models/MediaAsset.js';
import { mediaStorage, cleanupMedia } from '../src/services/mediaService.js';
import { releaseExpiredReservations } from '../src/services/orderLifecycleService.js';
import { MAX_IMAGE_BYTES } from '../src/middleware/uploadMiddleware.js';

test('media and payment HTTP integration', { timeout: 120_000 }, async (t) => {
  if (!process.env.TEST_MONGODB_URI) throw new Error('Run npm test for an isolated database');
  await mongoose.connect(process.env.TEST_MONGODB_URI, { dbName: `funfair_media_test_${process.pid}` });
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  const originalSecret = env.jwtSecret;
  env.jwtSecret = 'test-only-signing-secret';
  t.after(() => { env.jwtSecret = originalSecret; });
  const objects = new Map();
  t.mock.method(mediaStorage, 'put', async (asset, buffer) => { objects.set(asset.storageKey, buffer); });
  t.mock.method(mediaStorage, 'get', async asset => ({ Body: Readable.from([objects.get(asset.storageKey)]) }));
  t.mock.method(mediaStorage, 'delete', async asset => { objects.delete(asset.storageKey); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const users = {};
  for (const [name, role] of [['owner', 'user'], ['buyer', 'user'], ['other', 'user'], ['race', 'user'], ['admin', 'admin']]) {
    const user = await User.create({ name, nameNormalized: name, passwordHash: 'test', role });
    users[name] = { ...user.toObject(), token: jwt.sign({ sub: String(user._id) }, env.jwtSecret) };
  }
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'blue' } }).png().toBuffer();
  const request = async (path, { user, method = 'GET', json, file, caption, mime = 'image/png' } = {}) => {
    const headers = user ? { Authorization: `Bearer ${users[user].token}` } : {};
    let body;
    if (file) {
      body = new FormData();
      body.append('image', new Blob([file], { type: mime }), 'photo.png');
      if (caption !== undefined) body.append('caption', caption);
    } else if (json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    }
    const response = await fetch(base + path, { method, headers, body });
    const type = response.headers.get('content-type') || '';
    const data = response.status === 204 ? null : type.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
    return { status: response.status, data, headers: response.headers };
  };
  const expectStatus = (result, status) => { assert.equal(result.status, status, JSON.stringify(result.data)); return result.data; };
  const now = Date.now();
  const event = await EventConfig.create({ eventName: 'Media test', eventDate: new Date(now + 10 * 86400_000), preorderOpenAt: new Date(now - 86400_000), preorderCloseAt: new Date(now + 8 * 86400_000), orderingEnabled: true });
  const stall = await Stall.create({ stallName: 'Test Stall', batch: 'A', discount: { type: 'fixed', value: 0 } });
  const genericFood = await Food.create({ name: 'Rice' });
  const food = await StallFood.create({ stallId: stall._id, foodId: genericFood._id, eventDayPrice: 1000, ticketLimit: 100, reservedTickets: 0, soldTickets: 0 });
  let orderNumber = 0;
  const makeOrder = async (user, status = 'PAYMENT_DECLARED', eventId = event._id) => {
    const approved = status === 'PAYMENT_APPROVED';
    if (!approved) await StallFood.updateOne({ _id: food._id }, { $inc: { reservedTickets: 2 } });
    return Order.create({ userId: users[user]._id, eventId, status, inventoryStatus: approved ? 'SOLD' : 'RESERVED', items: [{ stallId: stall._id, stallFoodId: food._id, stallName: 'Test Stall', foodName: 'Rice', quantity: 2, unitPrice: 1000, subtotal: 2000 }], totalQuantity: 2, totalAmount: 2000, paymentReference: `FF-MEDIA-${++orderNumber}`, reservationExpiresAt: new Date(now + 60_000), paymentProofExpiresAt: new Date(now + 60_000) });
  };
  const openWindow = { opensAt: new Date(now - 60_000).toISOString(), closesAt: new Date(now + 3600_000).toISOString() };
  let ownerPhoto, buyerPhoto;
  await t.test('window is public, not configured by default, and admin protected', async () => {
    assert.equal(expectStatus(await request('/memories/window'), 200).snaps.status, 'NOT_CONFIGURED');
    expectStatus(await request('/memories', { user: 'owner', method: 'POST', file: png }), 409);
    expectStatus(await request('/admin/memories/window', { user: 'owner', method: 'PUT', json: openWindow }), 403);
    expectStatus(await request('/admin/memories/window', { method: 'PUT', json: openWindow }), 401);
    expectStatus(await request('/admin/memories/window', { user: 'admin', method: 'PUT', json: { opensAt: '2030-01-01T10:00:00', closesAt: '2030-01-01T11:00:00' } }), 400);
    expectStatus(await request('/admin/memories/window', { user: 'admin', method: 'PUT', json: { opensAt: openWindow.closesAt, closesAt: openWindow.opensAt } }), 400);
    expectStatus(await request('/admin/memories/window', { user: 'admin', method: 'PUT', json: openWindow }), 200);
  });
  await t.test('upload requires login, actual image bytes, and a valid caption', async () => {
    expectStatus(await request('/memories', { method: 'POST', file: png }), 401);
    expectStatus(await request('/memories', { user: 'owner', method: 'POST', json: { image: { url: 'https://example.com/fake.png' } } }), 400);
    expectStatus(await request('/memories', { user: 'owner', method: 'POST', file: Buffer.from('not an image') }), 400);
    expectStatus(await request('/memories', { user: 'owner', method: 'POST', file: png, mime: 'image/jpeg' }), 400);
    expectStatus(await request('/memories', { user: 'owner', method: 'POST', file: png, caption: 'x'.repeat(301) }), 400);
    expectStatus(await request('/memories', { user: 'owner', method: 'POST', file: Buffer.alloc(MAX_IMAGE_BYTES + 1) }), 413);
    assert.equal(await MediaAsset.countDocuments(), 0);
  });
  await t.test('nonbuyer can post one photo, immediately visible with account name and caption', async () => {
    ownerPhoto = expectStatus(await request('/memories', { user: 'owner', method: 'POST', file: png, caption: 'Fun day' }), 201).memory;
    const gallery = expectStatus(await request('/memories'), 200);
    assert.equal(gallery.memories[0].accountName, 'owner');
    assert.equal(gallery.memories[0].caption, 'Fun day');
    assert.equal(gallery.memories[0].likes, 0);
    const image = await request(`/memories/${ownerPhoto.id}/image`);
    expectStatus(image, 200);
    assert.equal(image.headers.get('cache-control'), 'no-store');
    expectStatus(await request('/memories', { user: 'owner', method: 'POST', file: png }), 409);
    assert.equal(expectStatus(await request('/memories/allowance', { user: 'owner' }), 200).snaps.remaining, 0);
  });
  await t.test('unpaid or another-event approved orders do not unlock extra photos', async () => {
    await makeOrder('owner');
    await makeOrder('owner', 'PAYMENT_APPROVED', new mongoose.Types.ObjectId());
    assert.equal(expectStatus(await request('/memories/allowance', { user: 'owner' }), 200).snaps.allowance, 1);
  });
  await t.test('approved orders unlock two total photos, never two per order', async () => {
    await makeOrder('buyer', 'PAYMENT_APPROVED');
    await makeOrder('buyer', 'PAYMENT_APPROVED');
    buyerPhoto = expectStatus(await request('/memories', { user: 'buyer', method: 'POST', file: png }), 201).memory;
    expectStatus(await request('/memories', { user: 'buyer', method: 'POST', file: png }), 201);
    expectStatus(await request('/memories', { user: 'buyer', method: 'POST', file: png }), 409);
    assert.equal(expectStatus(await request('/memories/allowance', { user: 'buyer' }), 200).snaps.allowance, 2);
  });
  await t.test('simultaneous uploads cannot exceed a one-photo allowance', async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => request('/memories', { user: 'race', method: 'POST', file: png })));
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409, 409, 409]);
    assert.equal(await Memory.countDocuments({ userId: users.race._id, status: 'ACTIVE' }), 1);
  });
  await t.test('reactions require login, are idempotent, switch and undo', async () => {
    const path = `/memories/${ownerPhoto.id}/reaction`;
    expectStatus(await request(path, { method: 'PUT', json: { reaction: 'LIKE' } }), 401);
    expectStatus(await request(path, { user: 'other', method: 'PUT', json: { reaction: 'LOVE' } }), 400);
    for (let i = 0; i < 2; i++) expectStatus(await request(path, { user: 'other', method: 'PUT', json: { reaction: 'LIKE' } }), 200);
    assert.equal(await MemoryReaction.countDocuments({ memoryId: ownerPhoto.id }), 1);
    expectStatus(await request(path, { user: 'other', method: 'PUT', json: { reaction: 'DISLIKE' } }), 200);
    assert.equal(expectStatus(await request(path, { user: 'other' }), 200).reaction, 'DISLIKE');
    const gallery = expectStatus(await request('/memories'), 200).memories.find(item => item.id === ownerPhoto.id);
    assert.equal(gallery.likes, 0); assert.equal(gallery.dislikes, 1);
    expectStatus(await request(path, { user: 'other', method: 'PUT', json: { reaction: null } }), 200);
    assert.equal(await MemoryReaction.countDocuments({ memoryId: ownerPhoto.id }), 0);
  });
  await t.test('concurrent reactions from one account stay unique', async () => {
    const path = `/memories/${ownerPhoto.id}/reaction`;
    const results = await Promise.all(Array.from({ length: 4 }, () => request(path, { user: 'other', method: 'PUT', json: { reaction: 'LIKE' } })));
    for (const result of results) expectStatus(result, 200);
    assert.equal(await MemoryReaction.countDocuments({ memoryId: ownerPhoto.id, userId: users.other._id }), 1);
  });
  await t.test('gallery uses bounded cursor pagination', async () => {
    const first = expectStatus(await request('/memories?limit=1'), 200);
    const second = expectStatus(await request(`/memories?limit=1&before=${first.nextCursor}`), 200);
    assert.notEqual(first.memories[0].id, second.memories[0].id);
    expectStatus(await request('/memories?limit=9999'), 400);
    expectStatus(await request('/memories?before=invalid'), 400);
  });
  await t.test('only owner can self-delete, freeing a replacement slot and blocking old image access', async () => {
    expectStatus(await request(`/memories/${ownerPhoto.id}`, { user: 'other', method: 'DELETE' }), 404);
    expectStatus(await request(`/memories/${ownerPhoto.id}`, { user: 'owner', method: 'DELETE' }), 204);
    expectStatus(await request(`/memories/${ownerPhoto.id}/image`), 404);
    assert.equal(await MemoryReaction.countDocuments({ memoryId: ownerPhoto.id }), 0);
    ownerPhoto = expectStatus(await request('/memories', { user: 'owner', method: 'POST', file: png }), 201).memory;
  });
  await t.test('admin removal consumes a slot and owner cannot undo moderation', async () => {
    expectStatus(await request(`/admin/memories/${ownerPhoto.id}`, { user: 'other', method: 'DELETE' }), 403);
    expectStatus(await request(`/admin/memories/${ownerPhoto.id}`, { user: 'admin', method: 'DELETE' }), 204);
    expectStatus(await request(`/memories/${ownerPhoto.id}`, { user: 'owner', method: 'DELETE' }), 404);
    expectStatus(await request('/memories', { user: 'owner', method: 'POST', file: png }), 409);
    expectStatus(await request(`/memories/${ownerPhoto.id}/image`), 404);
    expectStatus(await request(`/memories/${ownerPhoto.id}/reaction`, { user: 'other', method: 'PUT', json: { reaction: 'LIKE' } }), 404);
    assert.equal(expectStatus(await request('/memories/mine', { user: 'owner' }), 200).memories[0].status, 'ADMIN_REMOVED');
  });

  const order = await makeOrder('other');
  const proofPath = `/payments/orders/${order._id}`;
  let payment;
  await t.test('only the order owner can submit actual proof bytes', async () => {
    expectStatus(await request(proofPath, { user: 'owner', method: 'POST', file: png }), 404);
    expectStatus(await request(proofPath, { user: 'other', method: 'POST', json: { paymentProof: { url: 'https://example.com/proof.png' } } }), 400);
    payment = expectStatus(await request(proofPath, { user: 'other', method: 'POST', file: png }), 201).payment;
    assert.equal(payment.proofVersion, 1); assert.equal(payment.status, 'SUBMITTED');
    expectStatus(await request(proofPath, { user: 'other', method: 'POST', file: png }), 409);
  });
  await t.test('payment proof is private to owner and admins', async () => {
    const path = `/payments/${payment.id}/proofs/1`;
    expectStatus(await request(path), 401);
    expectStatus(await request(path, { user: 'owner' }), 404);
    expectStatus(await request(path, { user: 'other' }), 200);
    expectStatus(await request(path, { user: 'admin' }), 200);
    const gallery = JSON.stringify(expectStatus(await request('/memories'), 200));
    assert.ok(!gallery.includes(payment.id));
  });
  const reviewPath = () => `/admin/payments/${payment.id}/review`;
  const review = (decision, reason = 'Wrong screenshot', proofVersion = payment.proofVersion) => request(reviewPath(), { user: 'admin', method: 'PATCH', json: { decision, reason, proofVersion } });
  await t.test('requesting replacement requires admin, reason and current proof version', async () => {
    expectStatus(await request(reviewPath(), { user: 'other', method: 'PATCH', json: { decision: 'REUPLOAD_REQUESTED', reason: 'Wrong', proofVersion: 1 } }), 403);
    expectStatus(await request(reviewPath(), { user: 'admin', method: 'PATCH', json: { decision: 'REUPLOAD_REQUESTED', proofVersion: 1 } }), 400);
    expectStatus(await review('REUPLOAD_REQUESTED', 'Wrong', 0), 409);
    const before = await StallFood.findById(food._id);
    payment = expectStatus(await review('REUPLOAD_REQUESTED'), 200).payment;
    assert.equal(payment.canReupload, true);
    assert.equal(payment.reuploadReason, 'Wrong screenshot');
    const after = await StallFood.findById(food._id);
    assert.equal(after.reservedTickets, before.reservedTickets);
    assert.equal(after.soldTickets, before.soldTickets);
    expectStatus(await review('APPROVED'), 409);
  });
  await t.test('replacement has no deadline, preserves history, and consumes one chance under concurrency', async () => {
    await Order.updateOne({ _id: order._id }, { reservationExpiresAt: new Date(0), paymentProofExpiresAt: new Date(0) });
    await releaseExpiredReservations(new Date(Date.now() + 100 * 86400_000));
    assert.equal((await Order.findById(order._id)).inventoryStatus, 'RESERVED');
    const results = await Promise.all([request(proofPath, { user: 'other', method: 'POST', file: png }), request(proofPath, { user: 'other', method: 'POST', file: png })]);
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
    payment = results.find(r => r.status === 201).data.payment;
    assert.equal(payment.proofVersion, 2); assert.equal(payment.proofs.length, 2);
    assert.equal(payment.reviewHistory[0].reason, 'Wrong screenshot');
    expectStatus(await request(`/payments/${payment.id}/proofs/1`, { user: 'admin' }), 200);
    expectStatus(await request(proofPath, { user: 'other', method: 'POST', file: png }), 409);
    expectStatus(await review('APPROVED', '', 1), 409);
  });
  await t.test('each further replacement needs another explicit admin request', async () => {
    payment = expectStatus(await review('REUPLOAD_REQUESTED', 'Still unreadable'), 200).payment;
    payment = expectStatus(await request(proofPath, { user: 'other', method: 'POST', file: png }), 201).payment;
    assert.equal(payment.proofVersion, 3); assert.equal(payment.proofs.length, 3);
    assert.equal(payment.reviewHistory.length, 2);
    assert.equal(expectStatus(await request(proofPath, { user: 'other' }), 200).payment.proofVersion, 3);
  });
  await t.test('approval alone sells stock, unlocks second snap and issues exactly one ticket', async () => {
    const before = await StallFood.findById(food._id);
    payment = expectStatus(await review('APPROVED', ''), 200).payment;
    expectStatus(await review('APPROVED', ''), 200);
    const after = await StallFood.findById(food._id);
    assert.equal(after.reservedTickets, before.reservedTickets - 2);
    assert.equal(after.soldTickets, before.soldTickets + 2);
    assert.equal(await Ticket.countDocuments({ orderId: order._id }), 1);
    assert.equal(expectStatus(await request('/memories/allowance', { user: 'other' }), 200).snaps.allowance, 2);
    expectStatus(await request(proofPath, { user: 'other', method: 'POST', file: png }), 409);
  });
  await t.test('failed inventory settlement rolls back the review completely', async () => {
    const pending = await makeOrder('race');
    const submitted = expectStatus(await request(`/payments/orders/${pending._id}`, { user: 'race', method: 'POST', file: png }), 201).payment;
    await Order.updateOne({ _id: pending._id }, { 'items.0.quantity': 1000 });
    expectStatus(await request(`/admin/payments/${submitted.id}/review`, { user: 'admin', method: 'PATCH', json: { decision: 'APPROVED', proofVersion: 1 } }), 409);
    assert.equal((await Payment.findById(submitted.id)).status, 'SUBMITTED');
    assert.equal((await Order.findById(pending._id)).status, 'PAYMENT_SUBMITTED');
    assert.equal(await Ticket.countDocuments({ orderId: pending._id }), 0);
    await Order.updateOne({ _id: pending._id }, { 'items.0.quantity': 2 });
    expectStatus(await request(`/admin/payments/${submitted.id}/review`, { user: 'admin', method: 'PATCH', json: { decision: 'REUPLOAD_REQUESTED', proofVersion: 1, reason: 'Need correct receipt' } }), 200);
    const before = await StallFood.findById(food._id);
    expectStatus(await request(`/admin/payments/${submitted.id}/review`, { user: 'admin', method: 'PATCH', json: { decision: 'REJECTED', proofVersion: 1, reason: 'Payment invalid' } }), 200);
    assert.equal((await StallFood.findById(food._id)).reservedTickets, before.reservedTickets - 2);
  });
  await t.test('first-submission deadline still applies', async () => {
    const expired = await makeOrder('race');
    await Order.updateOne({ _id: expired._id }, { paymentProofExpiresAt: new Date(0) });
    expectStatus(await request(`/payments/orders/${expired._id}`, { user: 'race', method: 'POST', file: png }), 410);
    assert.equal((await Order.findById(expired._id)).inventoryStatus, 'RELEASED');
  });
  await t.test('closed window blocks uploads and owner deletion, but permits admin moderation and reactions', async () => {
    expectStatus(await request('/admin/memories/window', { user: 'admin', method: 'PUT', json: { opensAt: new Date(now - 120_000).toISOString(), closesAt: new Date(now - 60_000).toISOString() } }), 200);
    expectStatus(await request('/memories', { user: 'other', method: 'POST', file: png }), 409);
    expectStatus(await request(`/memories/${buyerPhoto.id}`, { user: 'buyer', method: 'DELETE' }), 409);
    expectStatus(await request(`/memories/${buyerPhoto.id}/reaction`, { user: 'other', method: 'PUT', json: { reaction: 'LIKE' } }), 200);
    expectStatus(await request(`/admin/memories/${buyerPhoto.id}`, { user: 'admin', method: 'DELETE' }), 204);
  });
  await t.test('cleanup retries failed deletion without deleting attached proofs', async () => {
    const pending = await MediaAsset.countDocuments({ status: 'DELETE_PENDING' });
    assert.ok(pending > 0);
    const failure = t.mock.method(mediaStorage, 'delete', async () => { throw new Error('R2 unavailable'); });
    const first = await cleanupMedia();
    assert.equal(first.pending, pending);
    failure.mock.restore();
    const result = await cleanupMedia();
    assert.equal(result.pending, 0);
    assert.ok(result.deleted > 0);
    expectStatus(await request(`/payments/${payment.id}/proofs/1`, { user: 'other' }), 200);
  });
});
