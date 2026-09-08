import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import env from '../src/config/env.js';
import EventConfig from '../src/models/EventConfig.js';
import Stall from '../src/models/Stall.js';
import User from '../src/models/User.js';
import { assertOrderingOpen, derivePreorderStatus } from '../src/services/eventService.js';

const uri = 'mongodb://127.0.0.1:27017/funfair_v131_test';

test('Backend V1.3.1 event schedule and feature controls', async (t) => {
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  await Promise.all([EventConfig.init(), Stall.init(), User.init()]);
  const eventDate = new Date('2032-09-11T03:00:00.000Z');
  const openAt = new Date('2032-09-08T03:00:00.000Z');
  const closeAt = new Date('2032-09-10T08:30:00.000Z');
  const event = await EventConfig.create({ configKey: 'current', eventName: 'V1.3.1 Event', eventDate, preorderOpenAt: openAt, preorderCloseAt: closeAt, orderingEnabled: true });
  const stall = await Stall.create({ stallName: 'Event Control Stall', batch: 'Batch 13', slug: 'event-control-stall', discount: { type: 'percentage', value: 0 } });
  const [admin, user, owner] = await User.create([
    { name: 'Event Admin', nameNormalized: 'event admin', passwordHash: 'test', role: 'admin' },
    { name: 'Event User', nameNormalized: 'event user', passwordHash: 'test', role: 'user' },
    { name: 'Event Owner', nameNormalized: 'event owner', passwordHash: 'test', role: 'stall_owner', stallId: stall._id },
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
  const headers = (account) => ({ Authorization: `Bearer ${jwt.sign({ role: account.role }, env.jwtSecret, { subject: String(account._id), expiresIn: '10m' })}` });
  const request = async (path, { method = 'GET', auth, body } = {}) => {
    const response = await fetch(`${base}${path}`, { method, headers: { ...(auth || {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: await response.json() };
  };

  await t.test('timezone and feature flags have safe defaults', () => {
    assert.equal(event.eventTimezone, 'Asia/Yangon');
    assert.equal(event.featureFlags.memoriesEnabled, false);
    assert.equal(event.featureFlags.eventPageEnabled, false);
    assert.equal(event.featureFlags.crushLettersEnabled, false);
  });
  await t.test('before opening plus ordering on is UPCOMING and rejected', () => {
    assert.equal(derivePreorderStatus(event, new Date(openAt.getTime() - 1)), 'UPCOMING');
    assert.throws(() => assertOrderingOpen(event, new Date(openAt.getTime() - 1)), { statusCode: 409 });
  });
  await t.test('inside window plus ordering on is OPEN and allowed', () => {
    assert.equal(derivePreorderStatus(event, openAt), 'OPEN');
    assert.doesNotThrow(() => assertOrderingOpen(event, openAt));
  });
  await t.test('inside window plus ordering off is DISABLED and rejected', () => {
    const config = { ...event.toObject(), orderingEnabled: false };
    assert.equal(derivePreorderStatus(config, openAt), 'DISABLED');
    assert.throws(() => assertOrderingOpen(config, openAt), { statusCode: 409 });
  });
  await t.test('after close plus ordering on is CLOSED and rejected', () => {
    assert.equal(derivePreorderStatus(event, closeAt), 'CLOSED');
    assert.throws(() => assertOrderingOpen(event, closeAt), { statusCode: 409 });
  });
  await t.test('after close plus ordering off keeps DISABLED precedence', () => {
    const config = { ...event.toObject(), orderingEnabled: false };
    assert.equal(derivePreorderStatus(config, closeAt), 'DISABLED');
    assert.throws(() => assertOrderingOpen(config, closeAt), { statusCode: 409 });
  });
  await t.test('close need not be exactly 24 hours before event', async () => assert.doesNotReject(event.validate()));
  await t.test('close must be before event', async () => {
    event.preorderCloseAt = eventDate;
    await assert.rejects(event.validate(), /close before the event/);
    event.preorderCloseAt = closeAt;
  });
  await t.test('open must be before close', async () => {
    event.preorderOpenAt = closeAt;
    await assert.rejects(event.validate(), /opening must be before closing/);
    event.preorderOpenAt = openAt;
  });
  await t.test('unsupported timezone is rejected', async () => assert.equal((await request('/admin/event', { method: 'PATCH', auth: headers(admin), body: { eventTimezone: 'UTC' } })).status, 400));
  await t.test('unauthenticated feature update receives 401', async () => assert.equal((await request('/admin/event', { method: 'PATCH', body: { featureFlags: { memoriesEnabled: true } } })).status, 401));
  await t.test('normal user feature update receives 403', async () => assert.equal((await request('/admin/event', { method: 'PATCH', auth: headers(user), body: { featureFlags: { memoriesEnabled: true } } })).status, 403));
  await t.test('stall owner feature update receives 403', async () => assert.equal((await request('/admin/event', { method: 'PATCH', auth: headers(owner), body: { featureFlags: { memoriesEnabled: true } } })).status, 403));
  await t.test('unknown feature flag is rejected', async () => assert.equal((await request('/admin/event', { method: 'PATCH', auth: headers(admin), body: { featureFlags: { unknownEnabled: true } } })).status, 400));
  await t.test('Admin enables Memories', async () => assert.equal((await request('/admin/event', { method: 'PATCH', auth: headers(admin), body: { featureFlags: { memoriesEnabled: true } } })).body.event.featureFlags.memoriesEnabled, true));
  await t.test('updating Event Page preserves Memories', async () => {
    const result = await request('/admin/event', { method: 'PATCH', auth: headers(admin), body: { featureFlags: { eventPageEnabled: true } } });
    assert.deepEqual(result.body.event.featureFlags, { memoriesEnabled: true, eventPageEnabled: true, crushLettersEnabled: false });
  });
  await t.test('Admin independently disables Memories', async () => {
    const result = await request('/admin/event', { method: 'PATCH', auth: headers(admin), body: { featureFlags: { memoriesEnabled: false } } });
    assert.deepEqual(result.body.event.featureFlags, { memoriesEnabled: false, eventPageEnabled: true, crushLettersEnabled: false });
  });
  await t.test('Admin independently disables Event Page', async () => {
    const result = await request('/admin/event', { method: 'PATCH', auth: headers(admin), body: { featureFlags: { eventPageEnabled: false } } });
    assert.deepEqual(result.body.event.featureFlags, { memoriesEnabled: false, eventPageEnabled: false, crushLettersEnabled: false });
  });
  await t.test('ordering changes independently from feature flags', async () => {
    const result = await request('/admin/event', { method: 'PATCH', auth: headers(admin), body: { orderingEnabled: false } });
    assert.equal(result.body.event.orderingEnabled, false);
    assert.deepEqual(result.body.event.featureFlags, { memoriesEnabled: false, eventPageEnabled: false, crushLettersEnabled: false });
  });
  await t.test('payment and redemption toggle fields are not accepted', async () => {
    assert.equal((await request('/admin/event', { method: 'PATCH', auth: headers(admin), body: { paymentReviewEnabled: false } })).status, 400);
    assert.equal((await request('/admin/event', { method: 'PATCH', auth: headers(admin), body: { ticketRedemptionEnabled: false } })).status, 400);
  });
  await t.test('public event response exposes only safe feature state', async () => {
    const result = await request('/event');
    assert.equal(result.status, 200);
    assert.equal(result.body.event.eventTimezone, 'Asia/Yangon');
    assert.deepEqual(result.body.event.featureFlags, { memoriesEnabled: false, eventPageEnabled: false, crushLettersEnabled: false });
    assert.equal('kbzAccountNumber' in result.body.event, false);
    assert.equal('updatedAt' in result.body.event, false);
  });

});
