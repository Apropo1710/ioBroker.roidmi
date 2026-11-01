const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRoomCleaningAction } = require('../build/lib/room-cleaning.js');

test('builds the documented single-room MIoT action', () => {
  assert.deepEqual(buildRoomCleaningAction(1627839123, [3]), {
    siid: 14,
    aiid: 1,
    params: [2, '{"mapId":1627839123,"segmentId":[3]}']
  });
});

test('supports multiple rooms in one action and removes duplicates', () => {
  const action = buildRoomCleaningAction(123456, [1, 2, 2, 5]);
  assert.deepEqual(JSON.parse(action.params[1]), {
    mapId: 123456,
    segmentId: [1, 2, 5]
  });
});

test('rejects missing or invalid map and room identifiers', () => {
  assert.throws(() => buildRoomCleaningAction(0, [1]), /mapId/);
  assert.throws(() => buildRoomCleaningAction(1, []), /At least one/);
  assert.throws(() => buildRoomCleaningAction(1, [1, 0]), /segment ID/);
});
