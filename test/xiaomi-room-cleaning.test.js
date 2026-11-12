const test = require("node:test");
const assert = require("node:assert/strict");
const { buildXiaomiRoomCleanAction, parseXiaomiRoomCleanRequest } = require("../build/lib/xiaomi-room-cleaning.js");

test("X20+ room-clean payload includes required work-mode and room selection inputs", () => {
  const action = buildXiaomiRoomCleanAction([
    { segmentId: 4, repeat: 2, suction: 1, water: 3 },
    { segmentId: 7, repeat: 1, suction: 2, water: 1 }
  ]);
  assert.equal(action.siid, 4);
  assert.equal(action.aiid, 1);
  assert.deepEqual(action.inputs[0], { piid: 1, value: 18 });
  assert.deepEqual(JSON.parse(action.inputs[1].value), {
    selects: [[4, 2, 1, 3, 1], [7, 1, 2, 1, 2]]
  });
});

test("X20+ room clean request parses JSON with defaults", () => {
  const action = parseXiaomiRoomCleanRequest('{"rooms":[{"segmentId":2}]}');
  assert.deepEqual(JSON.parse(action.inputs[1].value), { selects: [[2, 1, 1, 2, 1]] });
});

test("X20+ room-clean request validates IDs, duplicate rooms and parameter ranges", () => {
  assert.throws(() => buildXiaomiRoomCleanAction([]), /mindestens/i);
  assert.throws(() => buildXiaomiRoomCleanAction([{ segmentId: 0 }]), /segmentId/i);
  assert.throws(() => buildXiaomiRoomCleanAction([{ segmentId: 2 }, { segmentId: 2 }]), /doppelt/i);
  assert.throws(() => buildXiaomiRoomCleanAction([{ segmentId: 1, suction: 4 }]), /suction/i);
  assert.throws(() => parseXiaomiRoomCleanRequest("not json"), /JSON/i);
});

test("X20+ MIoT action transport sends ordered values, not piid/value descriptors", () => {
  const { getXiaomiRoomCleanActionParams } = require("../build/lib/xiaomi-room-cleaning.js");
  const action = buildXiaomiRoomCleanAction([{ segmentId: 8 }]);
  const params = getXiaomiRoomCleanActionParams(action);
  assert.equal(params.length, 2);
  assert.equal(params[0], 18);
  assert.deepEqual(JSON.parse(params[1]), { selects: [[8, 1, 1, 2, 1]] });
});
