const test = require("node:test");
const assert = require("node:assert/strict");
const {
    buildHandshakePacket, parseMiioHeader, buildMiioRequest, parseMiioResponse
} = require("../build/lib/miio-packet.js");

const token = "0123456789abcdef0123456789abcdef";
const header = { deviceId: 123456, stamp: 987654 };

test("builds the 32-byte miIO handshake packet", () => {
    const packet = buildHandshakePacket();
    assert.equal(packet.length, 32);
    assert.deepEqual(packet.subarray(0, 4), Buffer.from([0x21, 0x31, 0, 32]));
    assert.equal(packet.readUInt32BE(8), 0xffffffff);
});

test("parses device ID and timestamp from miIO header", () => {
    const packet = Buffer.alloc(32);
    packet[0] = 0x21; packet[1] = 0x31;
    packet.writeUInt32BE(header.deviceId, 8);
    packet.writeUInt32BE(header.stamp, 12);
    assert.deepEqual(parseMiioHeader(packet), header);
});

test("encrypts and validates a miIO JSON packet", () => {
    const request = buildMiioRequest("get_properties", [{ siid: 3, piid: 1 }], 7, token, header);
    assert.equal(request.readUInt32BE(12), header.stamp + 1);
    const parsed = parseMiioResponse(request, token);
    assert.deepEqual(parsed, {
        id: 7,
        method: "get_properties",
        params: [{ siid: 3, piid: 1 }]
    });
});

test("rejects wrong tokens, malformed packets and invalid tokens", () => {
    const packet = buildMiioRequest("miIO.info", [], 1, token, header);
    assert.throws(() => parseMiioResponse(packet, "ffffffffffffffffffffffffffffffff"), /checksum/);
    assert.throws(() => parseMiioResponse(Buffer.alloc(32), token), /Invalid/);
    assert.throws(() => buildMiioRequest("miIO.info", [], 1, "bad", header), /32 hexadecimal/);
});


test("increments the miIO request timestamp with 32-bit wraparound", () => {
    const request = buildMiioRequest("miIO.info", [], 8, token, { deviceId: header.deviceId, stamp: 0xffffffff });
    assert.equal(request.readUInt32BE(12), 0);
});

test("serializes native MIoT action RPC with object params", () => {
    const actionParams = {
        did: "123456789",
        siid: 4,
        aiid: 1,
        in: [{ piid: 1, value: 18 }, { piid: 10, value: JSON.stringify({ selects: [[8, 1, 1, 2, 1]] }) }]
    };
    const request = buildMiioRequest("action", actionParams, 9, token, header);
    assert.deepEqual(parseMiioResponse(request, token), {
        id: 9,
        method: "action",
        params: actionParams
    });
});
