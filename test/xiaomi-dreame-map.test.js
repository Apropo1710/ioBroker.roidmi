const test = require("node:test");
const assert = require("node:assert/strict");
const { parseXiaomiFdsAnnouncement } = require("../build/lib/xiaomi-dreame-map.js");

test("X20+ FDS announcement extracts object name and 16-character suffix", () => {
  assert.deepEqual(parseXiaomiFdsAnnouncement('["12345/987654321/1,abcdefghijklmnop"]'), {
    objectName: "12345/987654321/1",
    suffix: "abcdefghijklmnop"
  });
});

test("X20+ FDS announcement accepts a direct value and rejects malformed data", () => {
  assert.deepEqual(parseXiaomiFdsAnnouncement("123/456/2,0123456789abcdef"), {
    objectName: "123/456/2",
    suffix: "0123456789abcdef"
  });
  assert.throws(() => parseXiaomiFdsAnnouncement("not-a-map"), /announcement/i);
});
