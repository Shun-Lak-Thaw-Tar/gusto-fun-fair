import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import env from '../src/config/env.js';
import CrushLetter from '../src/models/CrushLetter.js';
import EventConfig from '../src/models/EventConfig.js';
import Stall from '../src/models/Stall.js';
import User from '../src/models/User.js';
import { crushLetterSubmissionLimiter } from '../src/middleware/crushLetterRateLimit.js';

const uri = 'mongodb://127.0.0.1:27017/funfair_crush_letter_test';

test('Crush Letter V1.1', async (t) => {
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  await Promise.all([CrushLetter.init(), EventConfig.init(), Stall.init(), User.init()]);
  await EventConfig.create({ configKey: 'current', eventName: 'Crush Test Event', eventDate: new Date('2032-09-11T09:00:00Z'), preorderOpenAt: new Date('2032-09-08T09:00:00Z'), preorderCloseAt: new Date('2032-09-10T09:00:00Z'), featureFlags: { memoriesEnabled: true, eventPageEnabled: true } });
  const stall = await Stall.create({ stallName: 'Crush Test Stall', batch: 'Test', slug: 'crush-test-stall', discount: { type: 'percentage', value: 0 } });
  const [admin, user, owner] = await User.create([
    { name: 'Crush Admin', nameNormalized: 'crush admin', passwordHash: 'test', role: 'admin' },
    { name: 'Crush User', nameNormalized: 'crush user', passwordHash: 'test', role: 'user' },
    { name: 'Crush Owner', nameNormalized: 'crush owner', passwordHash: 'test', role: 'stall_owner', stallId: stall._id },
  ]);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    server.close();
    server.closeAllConnections();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const auth = (account) => ({ Authorization: `Bearer ${jwt.sign({ role: account.role }, env.jwtSecret, { subject: String(account._id), expiresIn: '10m' })}` });
  const request = async (path, { method = 'GET', headers = {}, body } = {}) => {
    const response = await fetch(`${base}${path}`, { method, headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: await response.json() };
  };
  const resetRateLimit = () => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].forEach((key) => crushLetterSubmissionLimiter.resetKey(key));
  const validBody = { recipientName: 'TEST Recipient', message: 'TEST anonymous message' };

  await t.test('Crush Letters default OFF and public event exposes the flag', async () => {
    const event = (await request('/event')).body.event;
    assert.equal(event.featureFlags.crushLettersEnabled, false);
    assert.equal(event.featureFlags.memoriesEnabled, true);
    assert.equal(event.featureFlags.eventPageEnabled, true);
  });
  await t.test('feature OFF blocks anonymous submission', async () => {
    const result = await request('/crush-letters', { method: 'POST', body: validBody });
    assert.equal(result.status, 409);
    assert.match(result.body.error.message, /currently closed/i);
  });
  await t.test('only Admin may enable the feature', async () => {
    assert.equal((await request('/admin/event', { method: 'PATCH', body: { featureFlags: { crushLettersEnabled: true } } })).status, 401);
    assert.equal((await request('/admin/event', { method: 'PATCH', headers: auth(user), body: { featureFlags: { crushLettersEnabled: true } } })).status, 403);
    assert.equal((await request('/admin/event', { method: 'PATCH', headers: auth(owner), body: { featureFlags: { crushLettersEnabled: true } } })).status, 403);
    const result = await request('/admin/event', { method: 'PATCH', headers: auth(admin), body: { featureFlags: { crushLettersEnabled: true } } });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.event.featureFlags, { memoriesEnabled: true, eventPageEnabled: true, crushLettersEnabled: true });
  });
  await t.test('anonymous submission is accepted without login and becomes PENDING', async () => {
    const result = await request('/crush-letters', { method: 'POST', body: validBody });
    assert.equal(result.status, 201);
    assert.equal(result.body.crushLetter.status, 'PENDING');
    assert.equal('__v' in result.body.crushLetter, false);
    const stored = await CrushLetter.findById(result.body.crushLetter.id).lean();
    assert.equal(stored.isAnonymous, true);
    assert.equal(stored.status, 'PENDING');
    assert.equal('userId' in stored, false);
    assert.equal('senderName' in stored, false);
  });
  await t.test('client cannot alter anonymity and unknown fields are rejected', async () => {
    assert.equal((await request('/crush-letters', { method: 'POST', body: { ...validBody, isAnonymous: false } })).status, 400);
    assert.equal((await request('/crush-letters', { method: 'POST', body: { ...validBody, unexpected: true } })).status, 400);
  });
  await t.test('required, whitespace, and length validation is enforced', async () => {
    const invalidBodies = [
      { message: 'x' }, { recipientName: 'x' }, { recipientName: ' ', message: 'x' }, { recipientName: 'x', message: ' ' },
      { recipientName: 'x'.repeat(101), message: 'x' }, { recipientName: 'x', message: 'x'.repeat(1001) },
    ];
    for (const body of invalidBodies) assert.equal((await request('/crush-letters', { method: 'POST', body })).status, 400);
  });

  const now = Date.now();
  const [approvedOld, approvedNew, pending, rejected, hidden] = await CrushLetter.create([
    { recipientName: 'Approved Old', message: 'old', status: 'APPROVED', createdAt: new Date(now - 2000) },
    { recipientName: 'Approved New', message: 'new', status: 'APPROVED', createdAt: new Date(now - 1000) },
    { recipientName: 'Pending', message: 'pending' },
    { recipientName: 'Rejected', message: 'rejected', status: 'REJECTED' },
    { recipientName: 'Hidden', message: 'hidden', status: 'HIDDEN' },
  ]);
  await t.test('public listing returns only approved letters newest first', async () => {
    const result = await request('/crush-letters');
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.crushLetters.map((letter) => letter.recipientName), ['Approved New', 'Approved Old']);
    assert.equal(result.body.crushLetters.some((letter) => ['Pending', 'Rejected', 'Hidden', 'TEST Recipient'].includes(letter.recipientName)), false);
  });
  await t.test('public response excludes internal and moderation fields', async () => {
    const letter = (await request('/crush-letters')).body.crushLetters[0];
    assert.deepEqual(Object.keys(letter).sort(), ['createdAt', 'id', 'message', 'recipientName']);
  });
  await t.test('public pagination defaults to 20 and supports bounded pages', async () => {
    const defaults = await request('/crush-letters');
    assert.equal(defaults.body.pagination.limit, 20);
    assert.equal(defaults.body.pagination.total, 2);
    const page = await request('/crush-letters?page=2&limit=1');
    assert.equal(page.body.crushLetters.length, 1);
    assert.equal(page.body.pagination.totalPages, 2);
    assert.equal((await request('/crush-letters?limit=51')).status, 400);
    assert.equal((await request('/crush-letters?unknown=true')).status, 400);
  });
  await t.test('public listing remains available when submissions are OFF', async () => {
    await request('/admin/event', { method: 'PATCH', headers: auth(admin), body: { featureFlags: { crushLettersEnabled: false } } });
    assert.equal((await request('/crush-letters')).status, 200);
    assert.equal((await request('/crush-letters', { method: 'POST', body: validBody })).status, 409);
    const event = await EventConfig.findOne({ configKey: 'current' }).lean();
    assert.equal(event.featureFlags.memoriesEnabled, true);
    assert.equal(event.featureFlags.eventPageEnabled, true);
  });

  await t.test('Admin moderation list authorization is enforced', async () => {
    assert.equal((await request('/admin/crush-letters')).status, 401);
    assert.equal((await request('/admin/crush-letters', { headers: auth(user) })).status, 403);
    assert.equal((await request('/admin/crush-letters', { headers: auth(owner) })).status, 403);
    assert.equal((await request('/admin/crush-letters', { headers: auth(admin) })).status, 200);
  });
  await t.test('Admin list is paginated and filters exact statuses', async () => {
    const all = await request('/admin/crush-letters?limit=2', { headers: auth(admin) });
    assert.equal(all.body.crushLetters.length, 2);
    assert.equal(all.body.pagination.total >= 6, true);
    const filtered = await request('/admin/crush-letters?status=REJECTED', { headers: auth(admin) });
    assert.equal(filtered.body.crushLetters.every((letter) => letter.status === 'REJECTED'), true);
    assert.equal((await request('/admin/crush-letters?status=INVALID', { headers: auth(admin) })).status, 400);
  });
  await t.test('Admin gets moderation detail', async () => {
    const result = await request(`/admin/crush-letters/${pending._id}`, { headers: auth(admin) });
    assert.equal(result.status, 200);
    assert.equal(result.body.crushLetter.message, 'pending');
    assert.equal(result.body.crushLetter.status, 'PENDING');
  });
  await t.test('PENDING transitions to APPROVED with audit metadata', async () => {
    const result = await request(`/admin/crush-letters/${pending._id}/review`, { method: 'PATCH', headers: auth(admin), body: { decision: 'APPROVED' } });
    assert.equal(result.status, 200);
    assert.equal(result.body.crushLetter.status, 'APPROVED');
    const stored = await CrushLetter.findById(pending._id).lean();
    assert.ok(stored.reviewedAt);
    assert.equal(String(stored.reviewedBy), String(admin._id));
  });
  await t.test('PENDING transitions to REJECTED', async () => {
    const newPending = await CrushLetter.create({ recipientName: 'Review Reject', message: 'reject me' });
    const result = await request(`/admin/crush-letters/${newPending._id}/review`, { method: 'PATCH', headers: auth(admin), body: { decision: 'REJECTED' } });
    assert.equal(result.body.crushLetter.status, 'REJECTED');
  });
  await t.test('invalid review decisions and nonexistent IDs are handled', async () => {
    assert.equal((await request(`/admin/crush-letters/${approvedOld._id}/review`, { method: 'PATCH', headers: auth(admin), body: { decision: 'approve' } })).status, 400);
    assert.equal((await request(`/admin/crush-letters/${new mongoose.Types.ObjectId()}`, { headers: auth(admin) })).status, 404);
    assert.equal((await request('/admin/crush-letters/not-an-id', { headers: auth(admin) })).status, 400);
  });
  await t.test('APPROVED can be hidden and HIDDEN can be restored', async () => {
    const hide = await request(`/admin/crush-letters/${approvedNew._id}/visibility`, { method: 'PATCH', headers: auth(admin), body: { hidden: true } });
    assert.equal(hide.body.crushLetter.status, 'HIDDEN');
    assert.equal((await request('/crush-letters')).body.crushLetters.some((letter) => letter.id === String(approvedNew._id)), false);
    const restore = await request(`/admin/crush-letters/${approvedNew._id}/visibility`, { method: 'PATCH', headers: auth(admin), body: { hidden: false } });
    assert.equal(restore.body.crushLetter.status, 'APPROVED');
  });
  await t.test('invalid visibility transitions are rejected', async () => {
    assert.equal((await request(`/admin/crush-letters/${rejected._id}/visibility`, { method: 'PATCH', headers: auth(admin), body: { hidden: true } })).status, 409);
    assert.equal((await request(`/admin/crush-letters/${hidden._id}/visibility`, { method: 'PATCH', headers: auth(admin), body: { hidden: true } })).status, 409);
  });
  await t.test('legacy status-less letters are treated as pending, never public', async () => {
    const legacy = await CrushLetter.collection.insertOne({ recipientName: 'Legacy', message: 'legacy', isAnonymous: true, createdAt: new Date(), updatedAt: new Date() });
    assert.equal((await request('/crush-letters')).body.crushLetters.some((letter) => letter.id === String(legacy.insertedId)), false);
    const pendingList = await request('/admin/crush-letters?status=PENDING', { headers: auth(admin) });
    assert.equal(pendingList.body.crushLetters.some((letter) => letter.id === String(legacy.insertedId)), true);
  });
  await t.test('rate limiter counts only successful submissions and blocks the thirty-first', async () => {
    resetRateLimit();
    await request('/admin/event', { method: 'PATCH', headers: auth(admin), body: { featureFlags: { crushLettersEnabled: false } } });
    for (let index = 0; index < 3; index += 1) assert.equal((await request('/crush-letters', { method: 'POST', body: validBody })).status, 409);
    await request('/admin/event', { method: 'PATCH', headers: auth(admin), body: { featureFlags: { crushLettersEnabled: true } } });
    for (let index = 0; index < 3; index += 1) assert.equal((await request('/crush-letters', { method: 'POST', body: { recipientName: ' ', message: 'invalid' } })).status, 400);
    for (let index = 0; index < 30; index += 1) assert.equal((await request('/crush-letters', { method: 'POST', body: { recipientName: `Rate ${index}`, message: 'TEST rate message' } })).status, 201);
    assert.equal((await request('/crush-letters', { method: 'POST', body: validBody })).status, 429);
    resetRateLimit();
  });
});
