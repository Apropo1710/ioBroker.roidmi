const test = require('node:test');
const assert = require('node:assert/strict');
const { validateConfig, validateRoidmiConfig, validateXiaomiConfig, isRoidmiEnabled, isXiaomiEnabled, redactSecret, describeStartup } = require('../build/lib/config.js');

test('accepts an empty initial configuration', () => {
  assert.deepEqual(validateConfig({}), []);
});

test('rejects hostnames and invalid IPv4 octets', () => {
  assert.deepEqual(validateConfig({ host: 'robot.local' }), ['host must be a valid IPv4 address']);
  assert.deepEqual(validateConfig({ host: '192.168.1.999' }), ['host must be a valid IPv4 address']);
  assert.deepEqual(validateConfig({ host: '256.1.1.1' }), ['host must be a valid IPv4 address']);
  assert.deepEqual(validateConfig({ host: '192.168.1' }), ['host must be a valid IPv4 address']);
  assert.deepEqual(validateConfig({ host: '192.168.1.20' }), []);
});

test('validates numeric Xiaomi DID', () => {
  assert.deepEqual(validateConfig({ did: 'not-a-device-id' }), ['did must be a numeric Xiaomi device ID']);
  assert.deepEqual(validateConfig({ did: '441963123' }), []);
});

test('validates a 32-character hexadecimal miIO token', () => {
  assert.deepEqual(validateConfig({ token: 'not-a-token' }), [
    'token must contain exactly 32 hexadecimal characters'
  ]);
  assert.deepEqual(validateConfig({ token: '0123456789abcdef0123456789abcdef' }), []);
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

test('robot configuration validation is isolated', () => {
  const goodRoidmi = { host: '192.168.1.10', did: '123456', token: '0123456789abcdef0123456789abcdef' };
  const goodXiaomi = { xiaomiHost: '192.168.1.11', xiaomiDid: '654321', xiaomiToken: 'abcdef0123456789abcdef0123456789' };

  assert.deepEqual(validateRoidmiConfig(goodRoidmi), []);
  assert.deepEqual(validateXiaomiConfig(goodXiaomi), []);

  // Xiaomi credentials must not make Roidmi's own config invalid and vice versa.
  assert.deepEqual(validateRoidmiConfig(goodRoidmi), []);
  assert.deepEqual(validateXiaomiConfig({ ...goodXiaomi, host: 'bad' }), []);

  assert.equal(isRoidmiEnabled({}), true); // backwards-compatible legacy instance
  assert.equal(isRoidmiEnabled({ enableRoidmi: false }), false);
  assert.equal(isXiaomiEnabled({ enableXiaomi: true }), true);
  assert.equal(isXiaomiEnabled({ enableXiaomi: false }), false);
});

test('global config only rejects when both robots are disabled', () => {
  assert.deepEqual(validateConfig({ enableRoidmi: false, enableXiaomi: false }), [
    'Enable at least one robot (Roidmi EVE Plus or Xiaomi X20+).'
  ]);
  assert.deepEqual(validateConfig({ enableRoidmi: false, enableXiaomi: true }), []);
  assert.deepEqual(validateConfig({ enableRoidmi: true, enableXiaomi: false }), []);
});
