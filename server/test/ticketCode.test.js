import assert from 'node:assert/strict';
import test from 'node:test';
import generateTicketCode from '../src/utils/generateTicketCode.js';

test('ticket codes are formatted and non-sequential', () => {
  const codes = new Set(Array.from({ length: 100 }, generateTicketCode));
  assert.equal(codes.size, 100);
  for (const code of codes) assert.match(code, /^FF\d{2}-[A-HJ-NP-Z2-9]{6}$/);
});
