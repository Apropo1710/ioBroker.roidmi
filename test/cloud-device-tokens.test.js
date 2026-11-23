const test = require("node:test");
const assert = require("node:assert/strict");
const { pickDeviceTokens } = require("../build/lib/xiaomi-cloud-map.js");

test("pickDeviceTokens returns the current token per requested DID", () => {
    const list = [
        { did: "100000001", token: "ABCDEF0123456789ABCDEF0123456789", model: "xiaomi.vacuum.c102gl", localip: "192.168.1.96" },
        { did: "200000002", token: "00112233445566778899aabbccddeeff", model: "roidmi.vacuum.v60" },
        { did: "999", token: "ffffffffffffffffffffffffffffffff" },
        { did: "1234", token: "not-a-token" },
        null
    ];
    const tokens = pickDeviceTokens(list, ["100000001", "200000002", "1234"]);
    assert.equal(tokens.size, 2, "unrequested and invalid entries are ignored");
    assert.deepEqual(tokens.get("100000001"), {
        did: "100000001", token: "abcdef0123456789abcdef0123456789", model: "xiaomi.vacuum.c102gl", localIp: "192.168.1.96"
    });
    assert.equal(tokens.get("200000002").localIp, "");
    assert.equal(pickDeviceTokens(undefined, ["1"]).size, 0);
});
