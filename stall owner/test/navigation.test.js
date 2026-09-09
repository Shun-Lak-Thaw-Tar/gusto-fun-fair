import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = relPath => readFileSync(new URL(`../src/${relPath}`, import.meta.url), 'utf8');

test('BrowserRouter carries the basename so internal routes stay relative', () => {
 const main = read('main.jsx');
 assert.match(main, /<BrowserRouter basename="\/stall-owner">/);
});

test('no React Router navigation reference hardcodes the /stall-owner basename', () => {
 for (const file of ['main.jsx', 'stall-owner.jsx']) {
  const source = read(file);
  const badNav = /(?:to|href)=(["'`])\/stall-owner\//g;
  assert.equal(badNav.test(source), false, `${file} still hardcodes /stall-owner in a navigation path`);
 }
});

test('backend /api/stall-owner/* calls are untouched', () => {
 const source = read('stall-owner.jsx');
 assert.match(source, /api\('\/stall-owner\/dashboard'\)/);
 assert.match(source, /api\('\/stall-owner\/sales'\)/);
 assert.match(source, /api\('\/stall-owner\/orders'\)/);
 assert.match(source, /api\('\/stall-owner\/foods'\)/);
 assert.match(source, /api\('\/stall-owner\/share'\)/);
});
