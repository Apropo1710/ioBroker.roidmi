const test = require("node:test");
const assert = require("node:assert/strict");
const {
  XIAOMI_X20_PLUS_MODEL,
  XIAOMI_X20_PLUS_PROPERTIES,
  XIAOMI_X20_PLUS_STATUS,
  getXiaomiX20PlusStatusText
} = require("../build/lib/xiaomi-x20plus-profile.js");

test("Xiaomi X20+ model profile stays model-specific", () => {
  assert.equal(XIAOMI_X20_PLUS_MODEL, "xiaomi.vacuum.c102gl");
  assert.deepEqual(XIAOMI_X20_PLUS_PROPERTIES.battery, { siid: 3, piid: 1 });
  assert.deepEqual(XIAOMI_X20_PLUS_PROPERTIES.status, { siid: 2, piid: 1 });
});

test("Xiaomi X20+ status labels map known firmware values", () => {
  assert.equal(getXiaomiX20PlusStatusText(1), "Saugen");
  assert.equal(getXiaomiX20PlusStatusText(6), "Lädt");
  assert.equal(getXiaomiX20PlusStatusText(12), "Saugen und Wischen");
  assert.equal(getXiaomiX20PlusStatusText(13), "Ladung abgeschlossen");
  assert.equal(getXiaomiX20PlusStatusText(8), "Trocknet");
});

test("unknown Xiaomi statuses remain explicit", () => {
  assert.equal(getXiaomiX20PlusStatusText(77), "Unbekannter Xiaomi-Status (77)");
  assert.ok(Object.keys(XIAOMI_X20_PLUS_STATUS).length > 10);
});
