"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRoidmiMapPayload = parseRoidmiMapPayload;
exports.parseRoidmiMapArchive = parseRoidmiMapArchive;
const node_zlib_1 = require("node:zlib");
function parseRoidmiMapPayload(payload) {
    if (payload.length < 20) {
        throw new Error("Roidmi map payload is too short");
    }
    const marker = findMarker(payload, 16);
    if (marker < 0) {
        throw new Error("Roidmi map metadata marker was not found");
    }
    // The 0x7f marker is followed directly by the opening '{' byte.
    const jsonStart = marker + 1;
    let raw;
    try {
        raw = JSON.parse(new TextDecoder().decode(payload.subarray(jsonStart)));
    }
    catch {
        throw new Error("Roidmi map metadata is not valid JSON");
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error("Roidmi map metadata must be an object");
    }
    const data = raw;
    const width = positiveInteger(data.width, "width");
    const height = positiveInteger(data.height, "height");
    const resolution = positiveNumber(data.resolution, "resolution");
    const xMin = finiteOptionalNumber(data.x_min);
    const yMin = finiteOptionalNumber(data.y_min);
    const areas = Array.isArray(data.autoArea)
        ? data.autoArea
        : Array.isArray(data.autoAreaValue)
            ? data.autoAreaValue
            : [];
    const rooms = areas.map((entry, index) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            throw new Error(`Room entry ${index} is invalid`);
        }
        const area = entry;
        const id = positiveInteger(area.id, `room[${index}].id`);
        if (typeof area.name !== "string" || area.name.trim().length === 0) {
            throw new Error(`Room ${index} has no valid name`);
        }
        const room = { id, name: area.name.trim() };
        if (Array.isArray(area.pos) && area.pos.length >= 2) {
            if (typeof area.pos[0] === "number" && Number.isFinite(area.pos[0]))
                room.x = area.pos[0];
            if (typeof area.pos[1] === "number" && Number.isFinite(area.pos[1]))
                room.y = area.pos[1];
        }
        return room;
    });
    const mapId = typeof data.mapId === "number" && Number.isSafeInteger(data.mapId) && data.mapId > 0
        ? data.mapId
        : undefined;
    return {
        width,
        height,
        resolution,
        ...(mapId === undefined ? {} : { mapId }),
        ...(xMin === undefined ? {} : { xMin }),
        ...(yMin === undefined ? {} : { yMin }),
        rooms
    };
}
function findMarker(data, start) {
    for (let i = start; i < data.length - 1; i++) {
        if (data[i] === 0x7f && data[i + 1] === 0x7b)
            return i;
    }
    return -1;
}
function positiveInteger(value, field) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`Roidmi map ${field} must be a positive integer`);
    }
    return value;
}
function finiteOptionalNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function positiveNumber(value, field) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        throw new Error(`Roidmi map ${field} must be a positive number`);
    }
    return value;
}
/** Decompresses a Xiaomi Cloud Map Extractor-compatible Roidmi .gz archive and parses its metadata. */
function parseRoidmiMapArchive(archive) {
    let decompressed;
    try {
        decompressed = (0, node_zlib_1.gunzipSync)(archive);
    }
    catch {
        throw new Error("Roidmi map archive is not valid gzip data");
    }
    return parseRoidmiMapPayload(decompressed);
}
