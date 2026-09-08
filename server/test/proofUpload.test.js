import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import express from 'express';
import { createProofUploadHandler, createProofUploadRateLimiter } from '../src/middleware/proofUploadMiddleware.js';
import { receiveImage } from '../src/middleware/uploadMiddleware.js';
import ApiError from '../src/utils/ApiError.js';

const waitFor = async predicate => {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for upload state');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
};
const listen = async (t, app) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}`;
};
const errors = (error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: { message: error.message, details: error.details } });
const post = async (base, user, options = {}) => {
  const body = new FormData(); body.append('image', new Blob(['receipt'], { type: 'image/png' }), 'receipt.png');
  const response = await fetch(base + '/proof', { method: 'POST', headers: { 'X-User': user }, body, ...options });
  return { status: response.status, body: await response.json(), retry: response.headers.get('Retry-After') };
};
const proofApp = ({ prepare = async () => {}, submit = async (_req, res) => res.status(201).json({ ok: true }), receive = receiveImage, ...options } = {}) => {
  const app = express();
  app.use((req, _res, next) => { req.user = { _id: req.get('X-User') || 'student' }; next(); });
  app.post('/proof', createProofUploadHandler({ prepare, submit, receive, ...options }));
  app.use(errors);
  return app;
};

test('50 students sharing one IP: two uploads admitted, excess rejected before buffering, then retries succeed', async t => {
  const held = Promise.withResolvers();
  let running = 0, peak = 0, parsed = 0, hold = true;
  const base = await listen(t, proofApp({
    receive: (req, res, next) => { parsed++; receiveImage(req, res, next); },
    submit: async (_req, res) => {
      running++; peak = Math.max(peak, running);
      if (hold) await held.promise;
      running--; res.status(201).json({ ok: true });
    },
  }));
  t.after(() => held.resolve());
  const a = post(base, 'a'), b = post(base, 'b');
  await waitFor(() => running === 2);
  const others = await Promise.all(Array.from({ length: 48 }, (_, i) => post(base, `student-${i}`)));
  assert.ok(others.every(r => r.status === 503 && r.retry === '5' && r.body.error.details.code === 'PROOF_UPLOAD_BUSY'));
  assert.equal(parsed, 2);
  hold = false; held.resolve();
  assert.deepEqual((await Promise.all([a, b])).map(r => r.status), [201, 201]);
  assert.equal((await post(base, 'student-0')).status, 201);
  assert.equal(peak, 2);
});

test('same account cannot occupy both slots; invalid preflight never reads image bytes', async t => {
  const held = Promise.withResolvers(); let started = false, parsed = 0;
  const base = await listen(t, proofApp({
    prepare: async req => { if (req.user._id === 'invalid') throw new ApiError(409, 'Order is closed'); },
    receive: (req, res, next) => { parsed++; receiveImage(req, res, next); },
    submit: async (req, res) => { if (req.user._id === 'first') { started = true; await held.promise; } res.status(201).json({ ok: true }); },
  }));
  t.after(() => held.resolve());
  const first = post(base, 'first'); await waitFor(() => started);
  const duplicate = await post(base, 'first');
  assert.equal(duplicate.status, 429); assert.equal(duplicate.body.error.details.code, 'PROOF_UPLOAD_IN_PROGRESS');
  assert.equal((await post(base, 'invalid')).status, 409); assert.equal(parsed, 1);
  assert.equal((await post(base, 'another')).status, 201);
  held.resolve(); assert.equal((await first).status, 201);
});

test('failed parser and failed processing both release capacity', async t => {
  const base = await listen(t, proofApp({ maxConcurrent: 1, submit: async (req, res) => {
    if (req.user._id === 'broken') throw new ApiError(502, 'Storage failed');
    res.status(201).json({ ok: true });
  } }));
  const bad = await fetch(base + '/proof', { method: 'POST', headers: { 'Content-Type': 'multipart/form-data' }, body: 'missing boundary' });
  await bad.text(); assert.equal(bad.status, 400);
  assert.equal((await post(base, 'broken')).status, 502);
  assert.equal((await post(base, 'ok')).status, 201);
});

test('client disconnect during processing does not release a still-busy slot', async t => {
  const held = Promise.withResolvers(); let started = false, finished = false;
  const base = await listen(t, proofApp({ maxConcurrent: 1, submit: async (req, res) => {
    if (req.user._id === 'first') { started = true; await held.promise; finished = true; }
    res.status(201).json({ ok: true });
  } }));
  t.after(() => held.resolve());
  const controller = new AbortController();
  const first = post(base, 'first', { signal: controller.signal }).catch(() => null);
  await waitFor(() => started); controller.abort(); await first;
  assert.equal((await post(base, 'another')).status, 503);
  held.resolve(); await waitFor(() => finished);
  assert.equal((await post(base, 'another')).status, 201);
});

test('unfinished multipart request times out and frees its slot', async t => {
  let receiving = false;
  const base = await listen(t, proofApp({ maxConcurrent: 1, receiveTimeoutMs: 100,
    receive: (req, res, next) => { receiving = true; receiveImage(req, res, next); },
  }));
  const ended = Promise.withResolvers();
  const req = http.request(base + '/proof', { method: 'POST', headers: {
    'Content-Type': 'multipart/form-data; boundary=slow', 'X-User': 'slow',
  } });
  req.on('error', () => ended.resolve());
  req.on('close', () => ended.resolve());
  req.write('--slow\r\nContent-Disposition: form-data; name="image"; filename="receipt.png"\r\nContent-Type: image/png\r\n\r\npartial');
  t.after(() => req.destroy());
  await waitFor(() => receiving);
  assert.equal((await post(base, 'another')).status, 503);
  await ended.promise;
  assert.equal((await post(base, 'another')).status, 201);
});

test('rate limits count failed attempts per account, expose retry delay, and reset', async t => {
  const app = express();
  const limiter = createProofUploadRateLimiter({ windowMs: 60000, limit: 2 });
  app.use((req, _res, next) => { req.user = { _id: req.get('X-User') || 'student' }; next(); });
  app.post('/proof', limiter, (_req, res) => res.status(400).json({ invalid: true })); app.use(errors);
  const base = await listen(t, app);
  assert.equal((await post(base, 'a')).status, 400);
  assert.equal((await post(base, 'a')).status, 400);
  const blocked = await post(base, 'a');
  assert.equal(blocked.status, 429); assert.equal(blocked.body.error.details.code, 'PROOF_UPLOAD_RATE_LIMITED');
  assert.ok(Number(blocked.retry) >= 1 && Number(blocked.retry) <= 60);
  assert.equal((await post(base, 'b')).status, 400);
  await limiter.resetKey('a'); assert.equal((await post(base, 'a')).status, 400);
});

test('server-busy rejections do not consume the account rate allowance', async t => {
  const app = express(); let busy = true;
  const limiter = createProofUploadRateLimiter({ windowMs: 60000, limit: 2 });
  app.use((req, _res, next) => { req.user = { _id: 'same-student' }; next(); });
  app.post('/proof', limiter, (_req, res) => {
    if (busy) { res.locals.proofUploadNotAttempt = true; return res.status(503).json({ busy: true }); }
    res.status(201).json({ ok: true });
  }); app.use(errors);
  const base = await listen(t, app);
  for (let i = 0; i < 6; i++) assert.equal((await post(base, 'a')).status, 503);
  busy = false;
  assert.equal((await post(base, 'a')).status, 201);
  assert.equal((await post(base, 'a')).status, 201);
  assert.equal((await post(base, 'a')).status, 429);
});
