import assert from 'node:assert/strict';
import test from 'node:test';
import EventConfig from '../src/models/EventConfig.js';
import FoodItem from '../src/models/FoodItem.js';
import Order from '../src/models/Order.js';
import Payment from '../src/models/Payment.js';
import { requireAdmin } from '../src/middleware/adminMiddleware.js';
import generatePaymentReference from '../src/utils/generatePaymentReference.js';

test('EventConfig defaults reservation time to 60 minutes', () => assert.equal(new EventConfig().orderReservationMinutes, 60));
test('EventConfig defaults proof grace to 30 minutes', () => assert.equal(new EventConfig().paymentProofGraceMinutes, 30));
test('EventConfig allows closing less than one day before the event', async () => {
  const event = new EventConfig({ eventName: 'X', eventDate: new Date('2030-01-02'), preorderOpenAt: new Date('2029-01-01'), preorderCloseAt: new Date('2030-01-01T12:00:00Z') });
  await assert.doesNotReject(event.validate());
});
test('FoodItem rejects negative reserved inventory', () => assert.ok(new FoodItem({ reservedTickets: -1 }).validateSync()?.errors.reservedTickets));
test('FoodItem rejects fractional sold inventory', () => assert.ok(new FoodItem({ soldTickets: 1.5 }).validateSync()?.errors.soldTickets));
test('Order rejects an unknown lifecycle status', () => assert.ok(new Order({ status: 'REFUNDED' }).validateSync()?.errors.status));
test('Payment rejects automatic gateway methods', () => assert.ok(new Payment({ paymentMethod: 'CARD' }).validateSync()?.errors.paymentMethod));
test('payment references are readable and non-ticket identifiers', () => { const reference = generatePaymentReference(); assert.match(reference, /^FF-ORDER-[A-HJ-NP-Z2-9]{6}$/); assert.doesNotMatch(reference, /^FF\d{2}-/); });
test('non-admin users are denied admin operations', () => { let error; requireAdmin({ user: { role: 'user' } }, null, (value) => { error = value; }); assert.equal(error.statusCode, 403); });
test('admins pass admin authorization', () => { let error = 'not called'; requireAdmin({ user: { role: 'admin' } }, null, (value) => { error = value; }); assert.equal(error, undefined); });
