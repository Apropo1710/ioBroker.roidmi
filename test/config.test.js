const test = require('node:test');
const assert = require('node:assert/strict');
const { validateConfig, redactSecret, describeStartup } = require('../build/lib/config.js');

test('accepts an empty initial configuration', () => {
  assert.deepEqual(validateConfig({}), []);
});

test('rejects invalid IPv4 host strings', () => {
  assert.deepEqual(validateConfig({ host: 'robot.local' }), ['host must be an IPv4 address']);
});

test('validates numeric Xiaomi DID', () => {
  assert.deepEqual(validateConfig({ did: 'not-a-device-id' }), ['did must be a numeric Xiaomi device ID']);
  assert.deepEqual(validateConfig({ did: '441963123' }), []);
});

test('validates polling interval bounds', () => {
  assert.deepEqual(validateConfig({ pollIntervalSeconds: 2 }), [
    'pollIntervalSeconds must be an integer between 5 and 3600'
  ]);
});

test('never returns a configured token from redaction helper', () => {
  assert.equal(redactSecret('secret-token'), '[REDACTED]');
});

test('startup description does not expose credentials', () => {
  assert.equal(describeStartup({ host: '192.168.1.20', token: 'secret' }),
    'Roidmi adapter scaffold ready; device host: 192.168.1.20');
});
