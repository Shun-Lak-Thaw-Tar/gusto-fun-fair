import assert from 'node:assert/strict';
import test from 'node:test';
import Food from '../src/models/Food.js';
import StallFood from '../src/models/StallFood.js';
import Order from '../src/models/Order.js';
import { priceOrderItems } from '../src/services/pricingService.js';
import { presentOrderWithImages } from '../src/services/orderPresentationService.js';

const result = (rows) => ({ select: () => ({ lean: async () => rows }) });

test('checkout snapshots an independent image reference and preserves its price', () => {
  const entry = { _id: '111111111111111111111111', stallId: { _id: '222222222222222222222222', stallName: 'A', isActive: true }, foodId: { _id: '333333333333333333333333', name: 'Burger', isActive: true, image: { url: '/burger.jpg', provider: 'r2' } }, isAvailable: true, eventDayPrice: 1000, discount: { type: 'percentage', value: 10 } };
  const [item] = priceOrderItems([{ stallFoodId: entry._id, quantity: 2 }], [entry]);
  entry.foodId.image.url = '/replacement.jpg';
  const order = new Order({ items: [item] });
  assert.equal(order.items[0].foodImage.url, '/burger.jpg');
  assert.equal(item.unitPrice, 900);
  assert.equal(item.subtotal, 1800);
});

test('stored order images win without querying the current catalog', async (t) => {
  t.mock.method(Food, 'find', () => { throw new Error('Unexpected lookup'); });
  const original = { items: [{ foodId: 'f', foodName: 'Original name', foodImage: { url: '/original.jpg' }, unitPrice: 100, quantity: 2, subtotal: 200 }] };
  const shown = await presentOrderWithImages(original);
  assert.equal(shown.items[0].foodImage.url, '/original.jpg');
  assert.equal(shown.items[0].subtotal, 200);
  assert.notEqual(shown.items[0], original.items[0]);
});

test('legacy images resolve by ID including inactive items without repricing or mutation', async (t) => {
  t.mock.method(StallFood, 'find', query => { assert.deepEqual(query, { _id: { $in: ['listing-b'] } }); return result([{ _id: 'listing-b', foodId: 'food-b' }]); });
  t.mock.method(Food, 'find', query => {
    assert.deepEqual(query, { _id: { $in: ['food-a', 'food-b', 'deleted'] } });
    return result([{ _id: 'food-a', image: { url: '/a.jpg' }, isActive: false }, { _id: 'food-b', image: { url: '/b.jpg' } }]);
  });
  const original = { totalAmount: 700, items: [{ foodId: 'food-a', foodName: 'Same name', unitPrice: 100, quantity: 2, subtotal: 200 }, { stallFoodId: 'listing-b', foodName: 'Same name', unitPrice: 200, quantity: 1, subtotal: 200 }, { foodId: 'deleted', foodName: 'Gone', unitPrice: 300, quantity: 1, subtotal: 300 }, { foodName: 'No reference' }] };
  const before = structuredClone(original);
  const shown = await presentOrderWithImages(original);
  assert.deepEqual(shown.items.map(item => item.foodImage?.url ?? null), ['/a.jpg', '/b.jpg', null, null]);
  assert.deepEqual(original, before);
  assert.equal(shown.totalAmount, 700);
  assert.deepEqual(shown.items.map(({ foodImage, ...item }) => item), original.items);
});
