const test = require("node:test");
const assert = require("node:assert/strict");
const { mapLegacyStateId, LEGACY_EMPTY_FOLDERS } = require("../build/lib/object-tree-migration.js");

test("legacy Roidmi paths map under evePlus", () => {
  assert.equal(mapLegacyStateId("battery"), "evePlus.status.battery");
  assert.equal(mapLegacyStateId("control.start"), "evePlus.control.start");
  assert.equal(mapLegacyStateId("map.cloudSession"), "evePlus.map.cloudSession");
  assert.equal(mapLegacyStateId("rooms.room1"), "evePlus.rooms.room1");
  assert.equal(mapLegacyStateId("timing.schedule"), "evePlus.timing.schedule");
  assert.equal(mapLegacyStateId("info.connection"), "evePlus.info.connection");
});

test("legacy Xiaomi paths map under x20Plus", () => {
  assert.equal(mapLegacyStateId("xiaomi.battery"), "x20Plus.battery");
  assert.equal(mapLegacyStateId("xiaomi.statusText"), "x20Plus.statusText");
});

test("unknown paths are ignored and legacy folders are listed", () => {
  assert.equal(mapLegacyStateId("unrelated"), undefined);
  assert.deepEqual(LEGACY_EMPTY_FOLDERS, ["control", "map", "rooms", "timing", "xiaomi"]);
});
