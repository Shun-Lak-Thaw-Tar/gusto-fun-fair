import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultDevelopmentMongoUri, defaultTestMongoUri, selectMongoUri } from '../src/config/env.js';

test('development selects its local database variable', () => {
  assert.equal(selectMongoUri('development', { MONGODB_URI_DEVELOPMENT: 'mongodb://development.example/funfair' }), 'mongodb://development.example/funfair');
});

test('production selects its Atlas database variable', () => {
  assert.equal(selectMongoUri('production', { MONGODB_URI_PRODUCTION: 'mongodb+srv://private.example/funfair' }), 'mongodb+srv://private.example/funfair');
});

test('production never falls back when its URI is missing', () => {
  assert.throws(() => selectMongoUri('production', { MONGODB_URI_DEVELOPMENT: 'mongodb://localhost/funfair' }), /MONGODB_URI_PRODUCTION is not configured/);
});

test('test environment preserves an explicitly isolated test URI', () => {
  assert.equal(selectMongoUri('test', { MONGODB_URI: 'mongodb://localhost/funfair_isolated_test' }), 'mongodb://localhost/funfair_isolated_test');
});

test('test environment never falls through to a production URI', () => {
  assert.equal(selectMongoUri('test', { MONGODB_URI_PRODUCTION: 'production-only-value' }), defaultTestMongoUri);
});

test('development safely defaults to the documented local database', () => {
  assert.equal(selectMongoUri('development', {}), defaultDevelopmentMongoUri);
});
