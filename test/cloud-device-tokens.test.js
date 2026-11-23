const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCloudDevices, findCloudDevice } = require("../build/lib/xiaomi-cloud-map.js");

// Fictitious DIDs, tokens and addresses only.
const list = [
    { did: "100000001", token: "0123456789ABCDEF0123456789ABCDEF", model: "roidmi.vacuum.v60", localip: "192.0.2.10" },
    { did: "200000002", token: "fedcba9876543210fedcba9876543210", model: "xiaomi.vacuum.c102gl", localip: "192.0.2.20" },
    { did: "300000003", token: "", model: "other", localip: "192.0.2.30" },
    { did: "400000004", token: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", model: "dup", localip: "192.0.2.40" },
    { did: "500000005", token: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", model: "dup", localip: "192.0.2.40" },
    null
];

test("parseCloudDevices keeps only devices with a valid DID and token and lowercases the token", () => {
    const devices = parseCloudDevices(list);
    assert.deepEqual(devices.map((d) => d.did), ["100000001", "200000002", "400000004", "500000005"]);
    assert.equal(devices[0].token, "0123456789abcdef0123456789abcdef");
    assert.equal(devices[1].localIp, "192.0.2.20");
    assert.deepEqual(parseCloudDevices(undefined), []);
});

test("findCloudDevice matches by DID when one is configured", () => {
    const devices = parseCloudDevices(list);
    assert.equal(findCloudDevice(devices, "200000002", "192.0.2.10").model, "xiaomi.vacuum.c102gl");
    assert.equal(findCloudDevice(devices, "999", "192.0.2.10"), undefined);
});

test("findCloudDevice falls back to an unambiguous IP match without DID", () => {
    const devices = parseCloudDevices(list);
    assert.equal(findCloudDevice(devices, "", "192.0.2.10").did, "100000001");
    assert.equal(findCloudDevice(devices, "", "192.0.2.40"), undefined);
    assert.equal(findCloudDevice(devices, "", "192.0.2.99"), undefined);
    assert.equal(findCloudDevice(devices, "", ""), undefined);
});
