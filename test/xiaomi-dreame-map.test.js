const test = require("node:test");
const assert = require("node:assert/strict");
const { deflateSync } = require("node:zlib");
const { parseXiaomiFdsAnnouncement, filterXiaomiHomeRooms, parseXiaomiLiveMapSelection } = require("../build/lib/xiaomi-dreame-map.js");

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

test("X20+ live map frame decodes selected room segment IDs", () => {
  const metadata = Buffer.from(JSON.stringify({ sa: [[1, 1, 2, 3, 0], [4, 1, 2, 3, 1], [1, 2, 2, 3, 2]] }));
  const frame = Buffer.alloc(28 + metadata.length);
  frame.writeUInt16LE(1, 19);
  frame.writeUInt16LE(1, 21);
  frame[27] = 0;
  metadata.copy(frame, 28);
  const encoded = deflateSync(frame).toString("base64url");
  assert.deepEqual(parseXiaomiLiveMapSelection(encoded), [1, 4]);
});

test("X20+ live map frame rejects invalid compressed data", () => {
  assert.throws(() => parseXiaomiLiveMapSelection("not-a-valid-frame"), /live map frame/i);
});
