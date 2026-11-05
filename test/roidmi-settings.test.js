const test = require("node:test");
const assert = require("node:assert/strict");
const { buildSettingWrite, getRoidmiSetting } = require("../build/lib/roidmi-settings.js");

test("maps suction power, cleaning type and water level to their V60 MIoT properties", () => {
  assert.deepEqual(buildSettingWrite("123456", "fanSpeed", 3), {
    method: "set_properties",
    params: [{ did: "123456", siid: 2, piid: 4, value: 3 }]
  });
  assert.deepEqual(buildSettingWrite("123456", "sweepType", 1).params[0], {
    did: "123456", siid: 2, piid: 8, value: 1
  });
  assert.throws(() => buildSettingWrite("123456", "sweepType", 2), /between 0 and 1/);
  assert.deepEqual(buildSettingWrite("123456", "waterLevel", 4).params[0], {
    did: "123456", siid: 8, piid: 11, value: 4
  });
});

test("exposes supported ranges and rejects invalid values or unknown settings", () => {
  assert.deepEqual(getRoidmiSetting("fanSpeed"), { siid: 2, piid: 4, min: 0, max: 4 });
  assert.throws(() => buildSettingWrite("123456", "fanSpeed", 5), /between 0 and 4/);
  assert.throws(() => buildSettingWrite("123456", "waterLevel", -1), /between 0 and 4/);
  assert.throws(() => buildSettingWrite("123456", "sweepType", 1.5), /integer/);
  assert.throws(() => buildSettingWrite("abc", "fanSpeed", 1), /numeric/);
  assert.throws(() => buildSettingWrite("123456", "other", 1), /Unknown/);
});
