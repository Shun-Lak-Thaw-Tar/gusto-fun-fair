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

const runStatistics = async (results) => {
  const originalAggregate = Order.aggregate;
  Order.aggregate = async () => results;
  try {
    let body;
    await bestSellingStall({}, { json(value) { body = value; } });
    return body;
  } finally { Order.aggregate = originalAggregate; }
};

test('best-selling stall ranks higher quantity first', async () => {
  const body = await runStatistics([{ stallName: 'A', quantitySold: 12, revenue: 12000 }, { stallName: 'B', quantitySold: 10, revenue: 50000 }]);
  assert.equal(body.stall.stallName, 'A');
  assert.deepEqual(body.leaders.map((leader) => leader.stallName), ['A']);
  assert.equal(body.isTie, false);
});

test('best-selling stall uses approved revenue as quantity tie-breaker', async () => {
  const body = await runStatistics([{ stallName: 'B', quantitySold: 10, revenue: 30000 }, { stallName: 'A', quantitySold: 10, revenue: 20000 }]);
  assert.equal(body.stall.stallName, 'B');
  assert.equal(body.isTie, false);
});

test('best-selling response returns every exact tied leader', async () => {
  const body = await runStatistics([
    { _id: 'a', stallName: 'A', quantitySold: 10, revenue: 20000 },
    { _id: 'b', stallName: 'B', quantitySold: 10, revenue: 20000 },
    { _id: 'c', stallName: 'C', quantitySold: 9, revenue: 30000 },
  ]);
  assert.equal(body.stall.stallName, 'A');
  assert.deepEqual(body.leaders.map((leader) => leader.stallName), ['A', 'B']);
  assert.equal(body.isTie, true);
});
