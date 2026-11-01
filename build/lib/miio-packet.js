"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildHandshakePacket = buildHandshakePacket;
exports.parseMiioHeader = parseMiioHeader;
exports.buildMiioRequest = buildMiioRequest;
exports.parseMiioResponse = parseMiioResponse;
const node_crypto_1 = require("node:crypto");
function buildHandshakePacket() {
    const packet = Buffer.alloc(32, 0xff);
    packet[0] = 0x21;
    packet[1] = 0x31;
    packet.writeUInt16BE(32, 2);
    return packet;
}
function parseMiioHeader(packet) {
    if (packet.length < 32 || packet[0] !== 0x21 || packet[1] !== 0x31) {
        throw new Error("Invalid miIO response header");
    }
    return {
        deviceId: packet.readUInt32BE(8),
        stamp: packet.readUInt32BE(12)
    };
}
function buildMiioRequest(method, params, id, tokenHex, header) {
    const token = Buffer.from(tokenHex, "hex");
    if (token.length !== 16)
        throw new Error("miIO token must contain exactly 32 hexadecimal characters");
    if (!/^[0-9a-f]+$/i.test(tokenHex))
        throw new Error("miIO token must be hexadecimal");
    const payload = Buffer.from(JSON.stringify({ id, method, params }), "utf8");
    const key = (0, node_crypto_1.createHash)("md5").update(token).digest();
    const iv = (0, node_crypto_1.createHash)("md5").update(key).update(token).digest();
    const cipher = (0, node_crypto_1.createCipheriv)("aes-128-cbc", key, iv);
    const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
    const packetHeader = Buffer.alloc(32);
    packetHeader[0] = 0x21;
    packetHeader[1] = 0x31;
    packetHeader.writeUInt16BE(32 + encrypted.length, 2);
    packetHeader.writeUInt32BE(header.deviceId, 8);
    packetHeader.writeUInt32BE(header.stamp, 12);
    const checksum = (0, node_crypto_1.createHash)("md5")
        .update(packetHeader.subarray(0, 16))
        .update(token)
        .update(encrypted)
        .digest();
    checksum.copy(packetHeader, 16);
    return Buffer.concat([packetHeader, encrypted]);
}
function parseMiioResponse(packet, tokenHex) {
    const token = Buffer.from(tokenHex, "hex");
    if (token.length !== 16 || !/^[0-9a-f]+$/i.test(tokenHex)) {
        throw new Error("miIO token must contain exactly 32 hexadecimal characters");
    }
    if (packet.length < 48 || packet[0] !== 0x21 || packet[1] !== 0x31) {
        throw new Error("Invalid or empty miIO response");
    }
    const encrypted = packet.subarray(32);
    const expected = (0, node_crypto_1.createHash)("md5")
        .update(packet.subarray(0, 16))
        .update(token)
        .update(encrypted)
        .digest();
    if (!expected.equals(packet.subarray(16, 32))) {
        throw new Error("miIO response checksum mismatch (wrong token or corrupted packet)");
    }
    const key = (0, node_crypto_1.createHash)("md5").update(token).digest();
    const iv = (0, node_crypto_1.createHash)("md5").update(key).update(token).digest();
    const decipher = (0, node_crypto_1.createDecipheriv)("aes-128-cbc", key, iv);
    const clear = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const text = clear.toString("utf8").replace(/\0+$/, "");
    try {
        return JSON.parse(text);
    }
    catch {
        throw new Error("miIO response did not contain valid JSON");
    }
}
