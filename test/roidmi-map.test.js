const test = require("node:test");
const assert = require("node:assert/strict");
const { gzipSync } = require("node:zlib");
const { parseRoidmiMapPayload, parseRoidmiMapArchive } = require("../build/lib/roidmi-map.js");

function payload(metadata) {
    const json = Buffer.from(JSON.stringify(metadata), "utf8");
    return Buffer.concat([Buffer.alloc(16), Buffer.from([0x01, 0x02, 0x7f, 0x7b]), json]);
}

test("parses room IDs and names from autoArea", () => {
    const result = parseRoidmiMapPayload(payload({
        width: 120,
        height: 80,
        resolution: 0.05,
        autoArea: [
            { id: 3, name: "Wohnzimmer", pos: [10, 20] },
            { id: 7, name: "Küche" }
        ]
    }));
    assert.deepEqual(result.rooms, [
        { id: 3, name: "Wohnzimmer", x: 10, y: 20 },
        { id: 7, name: "Küche" }
    ]);
    assert.equal(result.width, 120);
    assert.equal(result.height, 80);
});

test("supports autoAreaValue and optional mapId", () => {
    const result = parseRoidmiMapPayload(payload({
        width: 10, height: 10, resolution: 0.1, mapId: 12345,
        autoAreaValue: [{ id: 2, name: "Bad" }]
    }));
    assert.equal(result.mapId, 12345);
    assert.deepEqual(result.rooms, [{ id: 2, name: "Bad" }]);
});

test("rejects malformed payloads and room entries", () => {
    assert.throws(() => parseRoidmiMapPayload(Buffer.alloc(8)), /too short/);
    assert.throws(() => parseRoidmiMapPayload(Buffer.concat([Buffer.alloc(16), Buffer.from([1, 2])])), /marker/);
    assert.throws(() => parseRoidmiMapPayload(payload({
        width: 1, height: 1, resolution: 1, autoArea: [{ id: 0, name: "Bad" }]
    })), /room\[0\]\.id/);
});

test("decompresses and parses a gzip map archive", () => {
    const raw = payload({
        width: 20, height: 15, resolution: 0.05,
        autoArea: [{ id: 4, name: "Flur" }]
    });
    const result = parseRoidmiMapArchive(gzipSync(raw));
    assert.deepEqual(result.rooms, [{ id: 4, name: "Flur" }]);
    assert.throws(() => parseRoidmiMapArchive(Buffer.from("not gzip")), /not valid gzip/);
});
