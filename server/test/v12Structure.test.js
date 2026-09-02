import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../src/app.js';
import legacyAdminRoutes from '../src/routes/adminRoutes.js';
import adminRoutes from '../src/routes/admin/index.js';
import Order from '../src/models/Order.js';
import { bestSellingStall } from '../src/controllers/admin/adminStatisticsController.js';

test('legacy and modular admin imports resolve to one router', () => assert.equal(legacyAdminRoutes, adminRoutes));

test('application and protected admin structure load without route errors', async (t) => {
  const server = app.listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const health = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(health.status, 200);
  const placeholder = await fetch(`http://127.0.0.1:${port}/api/admin/dashboard`);
  assert.equal(placeholder.status, 401);
  const implemented = await fetch(`http://127.0.0.1:${port}/api/admin/payments`);
  assert.equal(implemented.status, 401);
});

test('best-selling response returns every exact tied leader', async (t) => {
  const originalAggregate = Order.aggregate;
  t.after(() => { Order.aggregate = originalAggregate; });
  Order.aggregate = async () => [
    { _id: 'a', stallName: 'A', quantitySold: 10, revenue: 20000 },
    { _id: 'b', stallName: 'B', quantitySold: 10, revenue: 20000 },
    { _id: 'c', stallName: 'C', quantitySold: 9, revenue: 30000 },
  ];
  let body;
  await bestSellingStall({}, { json(value) { body = value; } });
  assert.equal(body.stall.stallName, 'A');
  assert.deepEqual(body.leaders.map((leader) => leader.stallName), ['A', 'B']);
  assert.equal(body.isTie, true);
});
