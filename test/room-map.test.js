const test = require("node:test");
const assert = require("node:assert/strict");
const { parseRoomMapConfig } = require("../build/lib/room-map.js");

test("parses and normalizes a room map for persistent import", () => {
  assert.deepEqual(parseRoomMapConfig('{"mapId":123456,"rooms":[{"id":1,"name":" Kitchen "},{"id":2,"name":"Living room"}]}'), {
    mapId: 123456,
    rooms: [{ id: 1, name: "Kitchen" }, { id: 2, name: "Living room" }]
  });
});

test("rejects invalid map IDs, empty room lists, duplicate IDs and unsafe names", () => {
  assert.throws(() => parseRoomMapConfig('{"mapId":0,"rooms":[{"id":1,"name":"A"}]}'), /mapId/);
  assert.throws(() => parseRoomMapConfig('{"mapId":1,"rooms":[]}'), /between 1 and 50/);
  assert.throws(() => parseRoomMapConfig('{"mapId":1,"rooms":[{"id":1,"name":"A"},{"id":1,"name":"B"}]}'), /Duplicate/);
  assert.throws(() => parseRoomMapConfig('{"mapId":1,"rooms":[{"id":1,"name":" " }]}'), /name/);
  assert.throws(() => parseRoomMapConfig("{bad"), /valid JSON/);
});
