import test from 'node:test';
import assert from 'node:assert/strict';
import { PUBLIC_SITE_URL, publicStallUrl } from '../src/api.js';

test('the customer destination is never derived from window.location', () => {
 assert.equal(PUBLIC_SITE_URL, 'https://funfair.gustocollegeprojects.com');
});
test('publicStallUrl builds the exact existing customer Stall route', () => {
 assert.equal(publicStallUrl('22-potatoes-and-chin-chin'), 'https://funfair.gustocollegeprojects.com/stalls/22-potatoes-and-chin-chin');
 assert.equal(publicStallUrl('another-slug'), 'https://funfair.gustocollegeprojects.com/stalls/another-slug');
});
