const test = require("node:test");
const assert = require("node:assert/strict");
const { createSocket } = require("node:dgram");
const { createCipheriv, createHash } = require("node:crypto");
const { MiioClient } = require("../build/lib/miio-client.js");
const { parseMiioResponse } = require("../build/lib/miio-packet.js");

const token = "0123456789abcdef0123456789abcdef";
const deviceId = 123456;

function responsePacket(id, result, responseDeviceId = deviceId) {
    const payload = Buffer.from(JSON.stringify({ id, result }), "utf8");
    const tokenBuffer = Buffer.from(token, "hex");
    const key = createHash("md5").update(tokenBuffer).digest();
    const iv = createHash("md5").update(key).update(tokenBuffer).digest();
    const cipher = createCipheriv("aes-128-cbc", key, iv);
    const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
    const header = Buffer.alloc(32);
    header[0] = 0x21;
    header[1] = 0x31;
    header.writeUInt16BE(32 + encrypted.length, 2);
    header.writeUInt32BE(responseDeviceId, 8);
    header.writeUInt32BE(987655, 12);
    createHash("md5").update(header.subarray(0, 16)).update(tokenBuffer).update(encrypted).digest().copy(header, 16);
    return Buffer.concat([header, encrypted]);
}

test("ignores miIO replies with a foreign device ID or request ID", async () => {
    const server = createSocket("udp4");
    await new Promise((resolve) => server.bind(0, "127.0.0.1", resolve));
    const port = server.address().port;
    const debug = [];
    const client = new MiioClient({
        host: "127.0.0.1",
        port,
        token,
        timeoutMs: 1000,
        onDebug: (message) => debug.push(message)
    });

    server.on("message", (message, remote) => {
        if (message.length === 32 && message[0] === 0x21 && message[1] === 0x31) {
            const handshake = Buffer.alloc(32);
            handshake[0] = 0x21;
            handshake[1] = 0x31;
            handshake.writeUInt16BE(32, 2);
            handshake.writeUInt32BE(deviceId, 8);
            handshake.writeUInt32BE(987654, 12);
            server.send(handshake, remote.port, remote.address);
            return;
        }
        const request = parseMiioResponse(message, token);
        const requestId = request.id;
        server.send(responsePacket(requestId + 1, ["wrong-request"]), remote.port, remote.address);
        server.send(responsePacket(requestId, ["wrong-device"], deviceId + 1), remote.port, remote.address);
        setTimeout(() => {
            server.send(responsePacket(requestId, ["accepted"]), remote.port, remote.address);
        }, 10);
    });

    try {
        const result = await client.call("get_properties", []);
        assert.deepEqual(result, ["accepted"]);
        assert.ok(debug.some((line) => line.includes("unexpected request ID")));
        assert.ok(debug.some((line) => line.includes("unexpected device ID")));
        assert.ok(debug.some((line) => line.includes("RPC completed successfully")));
    } finally {
        server.close();
    }
});


test("gives a delayed handshake and RPC response separate timeout windows", async () => {
    const server = createSocket("udp4");
    await new Promise((resolve) => server.bind(0, "127.0.0.1", resolve));
    const port = server.address().port;
    const client = new MiioClient({
        host: "127.0.0.1",
        port,
        token,
        timeoutMs: 200
    });

    server.on("message", (message, remote) => {
        if (message.length === 32 && message[0] === 0x21 && message[1] === 0x31) {
            const handshake = Buffer.alloc(32);
            handshake[0] = 0x21;
            handshake[1] = 0x31;
            handshake.writeUInt16BE(32, 2);
            handshake.writeUInt32BE(deviceId, 8);
            handshake.writeUInt32BE(987654, 12);
            setTimeout(() => server.send(handshake, remote.port, remote.address), 120);
            return;
        }
        const request = parseMiioResponse(message, token);
        setTimeout(() => {
            server.send(responsePacket(request.id, ["accepted"]), remote.port, remote.address);
        }, 120);
    });

    try {
        const result = await client.call("get_properties", []);
        assert.deepEqual(result, ["accepted"]);
    } finally {
        server.close();
    }
});


test("reuses a successful handshake without treating the RPC reply as a handshake or sending twice", async () => {
    const server = createSocket("udp4");
    await new Promise((resolve) => server.bind(0, "127.0.0.1", resolve));
    const port = server.address().port;
    let handshakeCount = 0;
    let rpcCount = 0;
    const debug = [];
    const client = new MiioClient({
        host: "127.0.0.1",
        port,
        token,
        timeoutMs: 500,
        reuseHandshake: true,
        onDebug: (message) => debug.push(message)
    });

    server.on("message", (message, remote) => {
        if (message.length === 32 && message[0] === 0x21 && message[1] === 0x31 &&
            message.readUInt32BE(8) === 0xffffffff) {
            handshakeCount++;
            const handshake = Buffer.alloc(32);
            handshake[0] = 0x21;
            handshake[1] = 0x31;
            handshake.writeUInt16BE(32, 2);
            handshake.writeUInt32BE(deviceId, 8);
            handshake.writeUInt32BE(987654, 12);
            server.send(handshake, remote.port, remote.address);
            return;
        }

        rpcCount++;
        const request = parseMiioResponse(message, token);
        server.send(responsePacket(request.id, [{ call: rpcCount }]), remote.port, remote.address);
    });

    try {
        assert.deepEqual(await client.call("get_properties", []), [{ call: 1 }]);
        assert.deepEqual(await client.call("get_properties", []), [{ call: 2 }]);
        assert.equal(handshakeCount, 1, "only the first RPC should perform a handshake");
        assert.equal(rpcCount, 2, "each call must send exactly one RPC");
        assert.ok(debug.some((line) => line.includes("reusing handshake")));
        assert.equal(debug.filter((line) => line.includes("fresh handshake parsed")).length, 1);
    } finally {
        server.close();
    }
});


test("forceFreshHandshake bypasses an existing cached handshake", async () => {
    const server = createSocket("udp4");
    await new Promise((resolve) => server.bind(0, "127.0.0.1", resolve));
    const port = server.address().port;
    let handshakeCount = 0;
    let rpcCount = 0;
    const debug = [];
    const client = new MiioClient({
        host: "127.0.0.1",
        port,
        token,
        timeoutMs: 500,
        reuseHandshake: true,
        onDebug: (message) => debug.push(message)
    });

    server.on("message", (message, remote) => {
        if (message.length === 32 && message[0] === 0x21 && message[1] === 0x31 &&
            message.readUInt32BE(8) === 0xffffffff) {
            handshakeCount++;
            const handshake = Buffer.alloc(32);
            handshake[0] = 0x21;
            handshake[1] = 0x31;
            handshake.writeUInt16BE(32, 2);
            handshake.writeUInt32BE(deviceId, 8);
            handshake.writeUInt32BE(987654, 12);
            server.send(handshake, remote.port, remote.address);
            return;
        }

        rpcCount++;
        const request = parseMiioResponse(message, token);
        server.send(responsePacket(request.id, [{ call: rpcCount }]), remote.port, remote.address);
    });

    try {
        assert.deepEqual(await client.call("get_properties", []), [{ call: 1 }]);
        assert.deepEqual(await client.call("get_properties", []), [{ call: 2 }]);
        assert.deepEqual(await client.call("get_properties", [], undefined, true), [{ call: 3 }]);
        assert.equal(handshakeCount, 2, "forced fresh handshake must send a second handshake packet");
        assert.equal(rpcCount, 3, "each call must send exactly one RPC");
        assert.ok(debug.some((line) => line.includes("fresh handshake")));
    } finally {
        server.close();
    }
});
