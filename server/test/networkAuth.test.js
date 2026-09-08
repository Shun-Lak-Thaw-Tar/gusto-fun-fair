import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { networkConfig, trustLocalNginx } from '../src/config/network.js';
import { AUTH_LIMITS, createAuthLimiters } from '../src/middleware/authRateLimit.js';

const serve = async (t, app, host = '127.0.0.1') => {
  const server = app.listen(0, host);
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
};

test('production listens on IPv4 loopback and trusts exactly one local proxy', async t => {
  const config = networkConfig('production');
  const app = express(); app.set('trust proxy', config.trustProxy);
  app.get('/', (req, res) => res.json({ ip: req.ip, protocol: req.protocol }));
  const { server, base } = await serve(t, app, config.host);
  assert.equal(server.address().address, '127.0.0.1');
  const result = await fetch(base, { headers: { 'X-Forwarded-For': '203.0.113.99, 198.51.100.20', 'X-Forwarded-Proto': 'https' } });
  assert.deepEqual(await result.json(), { ip: '198.51.100.20', protocol: 'https' });
  assert.equal(trustLocalNginx('127.0.0.1', 0), true);
  assert.equal(trustLocalNginx('127.0.0.1', 1), false);
  assert.equal(trustLocalNginx('10.0.0.5', 0), false);
  assert.equal(trustLocalNginx('198.51.100.20', 0), false);
});

test('development ignores spoofed forwarding headers', async t => {
  const app = express(); app.set('trust proxy', networkConfig('development').trustProxy);
  app.get('/', (req, res) => res.json({ ip: req.ip, protocol: req.protocol }));
  const { base } = await serve(t, app);
  const response = await fetch(base, { headers: { 'X-Forwarded-For': '203.0.113.99', 'X-Forwarded-Proto': 'https' } });
  assert.deepEqual(await response.json(), { ip: '127.0.0.1', protocol: 'http' });
});

const authApp = settings => {
  const app = express(), limits = createAuthLimiters(settings);
  let calls = 0;
  app.set('trust proxy', trustLocalNginx);
  app.use(express.json());
  const handler = (req, res) => { calls++; res.status(req.body.success ? 200 : 401).json({ ok: !!req.body.success }); };
  app.post('/login', limits.sharedIp, limits.login, handler);
  app.post('/register', limits.sharedIp, limits.register, handler);
  return { app, getCalls: () => calls };
};
const attempt = async (base, path, name, success = false, ip = '198.51.100.20') => {
  const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ name, success }) });
  return { status: response.status, body: await response.json(), retry: Number(response.headers.get('Retry-After')) };
};

test('failed logins are limited before handler; normalized names match, other students remain independent', async t => {
  const { app, getCalls } = authApp(AUTH_LIMITS), { base } = await serve(t, app);
  for (let i = 0; i < 15; i++) assert.equal((await attempt(base, '/login', '  Alice   Smith  ')).status, 401);
  const blocked = await attempt(base, '/login', 'alice smith');
  assert.equal(blocked.status, 429); assert.equal(getCalls(), 15);
  assert.equal(blocked.body.error.details.code, 'AUTH_RATE_LIMITED');
  assert.ok(blocked.retry >= 1 && blocked.retry <= 900);
  assert.equal((await attempt(base, '/login', 'Bob')).status, 401);
  assert.equal((await attempt(base, '/login', 'Alice Smith', false, '198.51.100.21')).status, 401);
});

test('successful logins do not consume the failed-login allowance', async t => {
  const { app } = authApp({ ...AUTH_LIMITS, loginFailures: 2 }), { base } = await serve(t, app);
  for (let i = 0; i < 5; i++) assert.equal((await attempt(base, '/login', 'Alice', true)).status, 200);
  assert.equal((await attempt(base, '/login', 'Alice')).status, 401);
  assert.equal((await attempt(base, '/login', 'Alice')).status, 401);
  assert.equal((await attempt(base, '/login', 'Alice')).status, 429);
});

test('registration counts all repeated attempts but does not block other names on campus', async t => {
  const { app, getCalls } = authApp(AUTH_LIMITS), { base } = await serve(t, app);
  for (let i = 0; i < 5; i++) assert.equal((await attempt(base, '/register', 'Alice', true)).status, 200);
  assert.equal((await attempt(base, '/register', 'alice')).status, 429);
  assert.equal(getCalls(), 5);
  assert.equal((await attempt(base, '/register', 'Bob', true)).status, 200);
});

test('shared IP ceiling covers both endpoints even if names change', async t => {
  const { app, getCalls } = authApp({ ...AUTH_LIMITS, ipAttempts: 3 }), { base } = await serve(t, app);
  await attempt(base, '/login', 'A'); await attempt(base, '/register', 'B'); await attempt(base, '/login', 'C');
  assert.equal((await attempt(base, '/register', 'D')).status, 429); assert.equal(getCalls(), 3);
  assert.equal((await attempt(base, '/register', 'D', true, '198.51.100.21')).status, 200);
});

test('rotating IPv6 addresses within one subnet does not bypass the shared limit', async t => {
  const { app } = authApp({ ...AUTH_LIMITS, ipAttempts: 1 }), { base } = await serve(t, app);
  assert.equal((await attempt(base, '/login', 'A', false, '2001:db8:1234::1')).status, 401);
  assert.equal((await attempt(base, '/login', 'B', false, '2001:db8:1234::2')).status, 429);
});
