import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePreorderPrice } from '../src/services/pricingService.js';

test('calculates percentage discounts', () => assert.equal(calculatePreorderPrice(5000, { type: 'percentage', value: 10 }), 4500));
test('calculates fixed discounts', () => assert.equal(calculatePreorderPrice(5000, { type: 'fixed', value: 500 }), 4500));
test('never calculates a negative price', () => assert.equal(calculatePreorderPrice(200, { type: 'fixed', value: 500 }), 0));
