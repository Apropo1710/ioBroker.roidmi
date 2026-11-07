const test = require("node:test");
const assert = require("node:assert/strict");
const { parseXiaomiFdsAnnouncement, filterXiaomiHomeRooms } = require("../build/lib/xiaomi-dreame-map.js");

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

test("X20+ room filtering excludes outdoor phantom segments without Xiaomi Home room IDs", () => {
  const rooms = [
    { segmentId: 1, name: "Toilette", roomId: "386001053016" },
    { segmentId: 3, name: "Room 3" },
    { segmentId: 4, name: "Wohnzimmer", roomId: "386001053014" },
    { segmentId: 5, name: "Room 5", roomId: "" },
    { segmentId: 8, name: "Flur unten", roomId: "386001053017" }
  ];
  assert.deepEqual(filterXiaomiHomeRooms(rooms).map(room => room.segmentId), [1, 4, 8]);
});
