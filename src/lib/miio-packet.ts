import { createCipheriv, createDecipheriv, createHash } from "node:crypto";

export interface MiioHeader {
    deviceId: number;
    stamp: number;
}

export function buildHandshakePacket(): Buffer {
    const packet = Buffer.alloc(32, 0xff);
    packet[0] = 0x21;
    packet[1] = 0x31;
    packet.writeUInt16BE(32, 2);
    return packet;
}

export function parseMiioHeader(packet: Buffer): MiioHeader {
    if (packet.length < 32 || packet[0] !== 0x21 || packet[1] !== 0x31) {
        throw new Error("Invalid miIO response header");
    }
    return {
        deviceId: packet.readUInt32BE(8),
        stamp: packet.readUInt32BE(12)
    };
}

export function buildMiioRequest(method: string, params: unknown[], id: number, tokenHex: string, header: MiioHeader): Buffer {
    const token = Buffer.from(tokenHex, "hex");
    if (token.length !== 16) throw new Error("miIO token must contain exactly 32 hexadecimal characters");
    if (!/^[0-9a-f]+$/i.test(tokenHex)) throw new Error("miIO token must be hexadecimal");

    const payload = Buffer.from(JSON.stringify({ id, method, params }), "utf8");
    const key = createHash("md5").update(token).digest();
    const iv = createHash("md5").update(key).update(token).digest();
    const cipher = createCipheriv("aes-128-cbc", key, iv);
    const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);

    const packetHeader = Buffer.alloc(32);
    packetHeader[0] = 0x21;
    packetHeader[1] = 0x31;
    packetHeader.writeUInt16BE(32 + encrypted.length, 2);
    packetHeader.writeUInt32BE(header.deviceId, 8);
    // miIO expects the request timestamp to advance beyond the device timestamp
    // returned by the handshake. This also avoids stale timestamps when the
    // handshake and RPC cross a device-clock second boundary.
    packetHeader.writeUInt32BE((header.stamp + 1) >>> 0, 12);
    const checksum = createHash("md5")
        .update(packetHeader.subarray(0, 16))
        .update(token)
        .update(encrypted)
        .digest();
    checksum.copy(packetHeader, 16);
    return Buffer.concat([packetHeader, encrypted]);
}

export function parseMiioResponse(packet: Buffer, tokenHex: string): unknown {
    const token = Buffer.from(tokenHex, "hex");
    if (token.length !== 16 || !/^[0-9a-f]+$/i.test(tokenHex)) {
        throw new Error("miIO token must contain exactly 32 hexadecimal characters");
    }
    if (packet.length < 48 || packet[0] !== 0x21 || packet[1] !== 0x31) {
        throw new Error("Invalid or empty miIO response");
    }

    const encrypted = packet.subarray(32);
    const expected = createHash("md5")
        .update(packet.subarray(0, 16))
        .update(token)
        .update(encrypted)
        .digest();
    if (!expected.equals(packet.subarray(16, 32))) {
        throw new Error("miIO response checksum mismatch (wrong token or corrupted packet)");
    }

    const key = createHash("md5").update(token).digest();
    const iv = createHash("md5").update(key).update(token).digest();
    const decipher = createDecipheriv("aes-128-cbc", key, iv);
    const clear = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const text = clear.toString("utf8").replace(/\0+$/, "");
    try {
        return JSON.parse(text) as unknown;
    } catch {
        throw new Error("miIO response did not contain valid JSON");
    }
}
