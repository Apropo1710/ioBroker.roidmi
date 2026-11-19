"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseXiaomiLiveMapSelection = parseXiaomiLiveMapSelection;
exports.parseXiaomiDreameFdsMap = parseXiaomiDreameFdsMap;
exports.filterXiaomiHomeRooms = filterXiaomiHomeRooms;
exports.parseXiaomiFdsAnnouncement = parseXiaomiFdsAnnouncement;
const node_crypto_1 = require("node:crypto");
const node_zlib_1 = require("node:zlib");
const MAP_HEADER_SIZE = 27;
const MAX_MAP_SIZE = 8 * 1024 * 1024;
const C102GL_FDS_IV = Buffer.from("4f46554c6b39546f3337715264585933", "hex");
function inflateBounded(data) {
    const result = (0, node_zlib_1.inflateSync)(data, { maxOutputLength: MAX_MAP_SIZE });
    if (result.length > MAX_MAP_SIZE)
        throw new Error("X20+ map exceeds the safety size limit");
    return result;
}
function decodeGrid(data) {
    if (data.length < MAP_HEADER_SIZE)
        throw new Error("X20+ map frame is too short");
    const width = data.readUInt16LE(19);
    const height = data.readUInt16LE(21);
    const pixels = width * height;
    if (!width || !height || pixels > MAX_MAP_SIZE || MAP_HEADER_SIZE + pixels >= data.length) {
        throw new Error("X20+ map frame has invalid dimensions");
    }
    const jsonStart = MAP_HEADER_SIZE + pixels;
    let json;
    try {
        json = JSON.parse(data.subarray(jsonStart).toString("utf8"));
    }
    catch {
        throw new Error("X20+ map frame JSON is invalid");
    }
    if (!json || typeof json !== "object" || Array.isArray(json))
        throw new Error("X20+ map frame metadata is invalid");
    return json;
}
function decodeBase64UrlZlib(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    return inflateBounded(Buffer.from(normalized, "base64"));
}
/** Decode the active-room selection (sa) from a live C102GL map-history frame. */
function parseXiaomiLiveMapSelection(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const compressed = Buffer.from(normalized, "base64");
    let frame;
    try {
        frame = inflateBounded(compressed);
    }
    catch (error) {
        throw new Error("X20+ live map frame compression is invalid", { cause: error });
    }
    if (frame.length < MAP_HEADER_SIZE)
        throw new Error("X20+ live map frame is too short");
    const width = frame.readUInt16LE(19);
    const height = frame.readUInt16LE(21);
    const jsonStart = MAP_HEADER_SIZE + width * height;
    if (jsonStart > frame.length)
        throw new Error("X20+ live map frame dimensions are invalid");
    let metadata;
    try {
        metadata = JSON.parse(frame.subarray(jsonStart).toString("utf8"));
    }
    catch {
        throw new Error("X20+ live map frame metadata is invalid");
    }
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
        return [];
    const raw = metadata.sa;
    if (!Array.isArray(raw))
        return [];
    const segments = [];
    for (const entry of raw) {
        if (!Array.isArray(entry) || entry.length === 0)
            continue;
        const id = Number(entry[0]);
        if (Number.isSafeInteger(id) && id > 0 && !segments.includes(id))
            segments.push(id);
    }
    return segments;
}
/** Decode C102GL FDS saved-map room metadata. This parser is separate from the EVE Plus map parser. */
function parseXiaomiDreameFdsMap(body, suffix) {
    if (!/^[\x20-\x7e]{16}$/.test(suffix))
        throw new Error("X20+ map encryption suffix is invalid");
    const encoded = Buffer.isBuffer(body) ? body.toString("ascii").trim() : body.trim();
    const ciphertext = Buffer.from(encoded, "base64");
    if (ciphertext.length < 32 || ciphertext.length % 16 !== 0)
        throw new Error("X20+ FDS map ciphertext is invalid");
    const key = Buffer.from((0, node_crypto_1.createHash)("sha256").update(suffix, "utf8").digest("hex").slice(0, 32), "ascii");
    const decipher = (0, node_crypto_1.createDecipheriv)("aes-256-cbc", key, C102GL_FDS_IV);
    const compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const frame = inflateBounded(compressed);
    const metadata = decodeGrid(frame);
    const rism = metadata.rism;
    if (typeof rism !== "string" || !rism)
        throw new Error("X20+ saved map has no room segmentation (rism)");
    const saved = decodeGrid(decodeBase64UrlZlib(rism));
    const segmentInfo = saved.seg_inf;
    if (!segmentInfo || typeof segmentInfo !== "object" || Array.isArray(segmentInfo)) {
        throw new Error("X20+ saved map has no segment metadata");
    }
    const rooms = [];
    for (const [rawId, rawInfo] of Object.entries(segmentInfo)) {
        const segmentId = Number(rawId);
        if (!Number.isSafeInteger(segmentId) || segmentId <= 0 || !rawInfo || typeof rawInfo !== "object" || Array.isArray(rawInfo))
            continue;
        const info = rawInfo;
        let name = "Room " + segmentId;
        if (typeof info.name === "string" && info.name) {
            try {
                const decoded = Buffer.from(info.name, "base64").toString("utf8").trim();
                if (decoded)
                    name = decoded;
            }
            catch { /* keep safe fallback */ }
        }
        rooms.push({ segmentId, name, ...(info.roomID == null ? {} : { roomId: String(info.roomID) }) });
    }
    rooms.sort((a, b) => a.segmentId - b.segmentId);
    if (!rooms.length)
        throw new Error("X20+ map contains no room segments");
    return rooms;
}
/** Keep only segments explicitly assigned to a Xiaomi Home room; outdoor/window phantom segments lack roomID. */
function filterXiaomiHomeRooms(rooms) {
    return rooms.filter((room) => typeof room.roomId === "string" && room.roomId.trim().length > 0);
}
/** Extract the FDS object announcement (object path + per-object suffix) from MIoT 6.3 history. */
function parseXiaomiFdsAnnouncement(value) {
    let raw = value;
    if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (trimmed.startsWith("[")) {
            try {
                raw = JSON.parse(trimmed);
            }
            catch {
                throw new Error("X20+ FDS map announcement JSON is invalid");
            }
        }
    }
    if (Array.isArray(raw))
        raw = raw[0];
    if (typeof raw !== "string")
        throw new Error("X20+ cloud has no FDS map announcement");
    const [objectName, suffix, ...extra] = raw.trim().split(",");
    if (!objectName || !objectName.includes("/") || !suffix || extra.length || suffix.length !== 16) {
        throw new Error("X20+ FDS map announcement has an invalid format");
    }
    return { objectName, suffix };
}
