import { createDecipheriv, createHash } from "node:crypto";
import { inflateSync } from "node:zlib";

export interface XiaomiDreameRoom {
    segmentId: number;
    name: string;
    roomId?: string;
}

const MAP_HEADER_SIZE = 27;
const MAX_MAP_SIZE = 8 * 1024 * 1024;
const C102GL_FDS_IV = Buffer.from("4f46554c6b39546f3337715264585933", "hex");

function inflateBounded(data: Buffer): Buffer {
    const result = inflateSync(data, { maxOutputLength: MAX_MAP_SIZE });
    if (result.length > MAX_MAP_SIZE) throw new Error("X20+ map exceeds the safety size limit");
    return result;
}

function decodeGrid(data: Buffer): Record<string, unknown> {
    if (data.length < MAP_HEADER_SIZE) throw new Error("X20+ map frame is too short");
    const width = data.readUInt16LE(19);
    const height = data.readUInt16LE(21);
    const pixels = width * height;
    if (!width || !height || pixels > MAX_MAP_SIZE || MAP_HEADER_SIZE + pixels >= data.length) {
        throw new Error("X20+ map frame has invalid dimensions");
    }
    const jsonStart = MAP_HEADER_SIZE + pixels;
    let json: unknown;
    try { json = JSON.parse(data.subarray(jsonStart).toString("utf8")); }
    catch { throw new Error("X20+ map frame JSON is invalid"); }
    if (!json || typeof json !== "object" || Array.isArray(json)) throw new Error("X20+ map frame metadata is invalid");
    return json as Record<string, unknown>;
}

function decodeBase64UrlZlib(value: string): Buffer {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    return inflateBounded(Buffer.from(normalized, "base64"));
}


/** Decode the active-room selection (sa) from a live C102GL map-history frame. */
export function parseXiaomiLiveMapSelection(value: string): number[] {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const compressed = Buffer.from(normalized, "base64");
    let frame: Buffer;
    try { frame = inflateBounded(compressed); }
    catch (error) {
        throw new Error("X20+ live map frame compression is invalid", { cause: error });
    }
    if (frame.length < MAP_HEADER_SIZE) throw new Error("X20+ live map frame is too short");
    const width = frame.readUInt16LE(19);
    const height = frame.readUInt16LE(21);
    const jsonStart = MAP_HEADER_SIZE + width * height;
    if (jsonStart > frame.length) throw new Error("X20+ live map frame dimensions are invalid");
    let metadata: unknown;
    try { metadata = JSON.parse(frame.subarray(jsonStart).toString("utf8")); }
    catch { throw new Error("X20+ live map frame metadata is invalid"); }
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
    const raw = (metadata as Record<string, unknown>).sa;
    if (!Array.isArray(raw)) return [];
    const segments: number[] = [];
    for (const entry of raw) {
        if (!Array.isArray(entry) || entry.length === 0) continue;
        const id = Number(entry[0]);
        if (Number.isSafeInteger(id) && id > 0 && !segments.includes(id)) segments.push(id);
    }
    return segments;
}

/** Decode C102GL FDS saved-map room metadata. This parser is separate from the EVE Plus map parser. */
export function parseXiaomiDreameFdsMap(body: Buffer | string, suffix: string): XiaomiDreameRoom[] {
    if (!/^[\x20-\x7e]{16}$/.test(suffix)) throw new Error("X20+ map encryption suffix is invalid");
    const encoded = Buffer.isBuffer(body) ? body.toString("ascii").trim() : body.trim();
    const ciphertext = Buffer.from(encoded, "base64");
    if (ciphertext.length < 32 || ciphertext.length % 16 !== 0) throw new Error("X20+ FDS map ciphertext is invalid");
    const key = Buffer.from(createHash("sha256").update(suffix, "utf8").digest("hex").slice(0, 32), "ascii");
    const decipher = createDecipheriv("aes-256-cbc", key, C102GL_FDS_IV);
    const compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const frame = inflateBounded(compressed);
    const metadata = decodeGrid(frame);
    const rism = metadata.rism;
    if (typeof rism !== "string" || !rism) throw new Error("X20+ saved map has no room segmentation (rism)");
    const saved = decodeGrid(decodeBase64UrlZlib(rism));
    const segmentInfo = saved.seg_inf;
    if (!segmentInfo || typeof segmentInfo !== "object" || Array.isArray(segmentInfo)) {
        throw new Error("X20+ saved map has no segment metadata");
    }
    const rooms: XiaomiDreameRoom[] = [];
    for (const [rawId, rawInfo] of Object.entries(segmentInfo as Record<string, unknown>)) {
        const segmentId = Number(rawId);
        if (!Number.isSafeInteger(segmentId) || segmentId <= 0 || !rawInfo || typeof rawInfo !== "object" || Array.isArray(rawInfo)) continue;
        const info = rawInfo as Record<string, unknown>;
        let name = "Room " + segmentId;
        if (typeof info.name === "string" && info.name) {
            try {
                const decoded = Buffer.from(info.name, "base64").toString("utf8").trim();
                if (decoded) name = decoded;
            } catch { /* keep safe fallback */ }
        }
        rooms.push({ segmentId, name, ...(info.roomID == null ? {} : { roomId: String(info.roomID) }) });
    }
    rooms.sort((a, b) => a.segmentId - b.segmentId);
    if (!rooms.length) throw new Error("X20+ map contains no room segments");
    return rooms;
}

/** Keep only segments explicitly assigned to a Xiaomi Home room; outdoor/window phantom segments lack roomID. */
export function filterXiaomiHomeRooms(rooms: XiaomiDreameRoom[]): XiaomiDreameRoom[] {
    return rooms.filter((room) => typeof room.roomId === "string" && room.roomId.trim().length > 0);
}

/** Extract the FDS object announcement (object path + per-object suffix) from MIoT 6.3 history. */
export function parseXiaomiFdsAnnouncement(value: unknown): { objectName: string; suffix: string } {
    let raw = value;
    if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (trimmed.startsWith("[")) {
            try { raw = JSON.parse(trimmed); } catch { throw new Error("X20+ FDS map announcement JSON is invalid"); }
        }
    }
    if (Array.isArray(raw)) raw = raw[0];
    if (typeof raw !== "string") throw new Error("X20+ cloud has no FDS map announcement");
    const [objectName, suffix, ...extra] = raw.trim().split(",");
    if (!objectName || !objectName.includes("/") || !suffix || extra.length || suffix.length !== 16) {
        throw new Error("X20+ FDS map announcement has an invalid format");
    }
    return { objectName, suffix };
}
