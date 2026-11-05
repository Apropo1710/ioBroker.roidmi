import { gunzipSync } from "node:zlib";

/**
 * Parser for the Roidmi V60 compressed map payload.
 *
 * Xiaomi Cloud Map Extractor documents a gzip payload with a 16-byte prefix,
 * a raster section terminated by 0x7f 0x7b, then JSON map metadata.
 * Room IDs and names are supplied by autoArea (or autoAreaValue).
 */
export interface RoidmiMapRoom {
    id: number;
    name: string;
    x?: number;
    y?: number;
    /** Room-specific cleaning profile fields supplied by Xiaomi's map metadata. */
    fanLevel?: number;
    waterPump?: number;
    cleanOrder?: number;
}

export interface RoidmiMapMetadata {
    width: number;
    height: number;
    resolution: number;
    mapId?: number;
    xMin?: number;
    yMin?: number;
    rooms: RoidmiMapRoom[];
}

export function parseRoidmiMapPayload(payload: Uint8Array): RoidmiMapMetadata {
    if (payload.length < 20) {
        throw new Error("Roidmi map payload is too short");
    }

    const marker = findMarker(payload, 16);
    if (marker < 0) {
        throw new Error("Roidmi map metadata marker was not found");
    }

    // The 0x7f marker is followed directly by the opening '{' byte.
    const jsonStart = marker + 1;
    let raw: unknown;
    try {
        raw = JSON.parse(new TextDecoder().decode(payload.subarray(jsonStart)));
    } catch {
        throw new Error("Roidmi map metadata is not valid JSON");
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error("Roidmi map metadata must be an object");
    }

    const data = raw as Record<string, unknown>;
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
    const profileById = new Map<number, Record<string, unknown>>();
    if (Array.isArray(data.autoAreaValue)) {
        for (const entry of data.autoAreaValue) {
            if (entry && typeof entry === "object" && !Array.isArray(entry)) {
                const profile = entry as Record<string, unknown>;
                try { profileById.set(positiveInteger(profile.id, "profile.id"), profile); } catch { /* Ignore malformed optional profile entries. */ }
            }
        }
    }
    const rooms = areas.map((entry, index): RoidmiMapRoom => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            throw new Error(`Room entry ${index} is invalid`);
        }
        const area = entry as Record<string, unknown>;
        const id = positiveInteger(area.id, `room[${index}].id`);
        if (typeof area.name !== "string" || area.name.trim().length === 0) {
            throw new Error(`Room ${index} has no valid name`);
        }
        const room: RoidmiMapRoom = { id, name: area.name.trim() };
        if (Array.isArray(area.pos) && area.pos.length >= 2) {
            if (typeof area.pos[0] === "number" && Number.isFinite(area.pos[0])) room.x = area.pos[0];
            if (typeof area.pos[1] === "number" && Number.isFinite(area.pos[1])) room.y = area.pos[1];
        }
        // Xiaomi's original Roidmi plugin reads these from autoAreaValue.
        // Keep values read-only and omit them when metadata does not contain them.
        const profile = profileById.get(id) ?? area;
        if (typeof profile.fanLevel === "number" && Number.isFinite(profile.fanLevel)) room.fanLevel = profile.fanLevel;
        if (typeof profile.waterPump === "number" && Number.isFinite(profile.waterPump)) room.waterPump = profile.waterPump;
        if (typeof profile.cleanOrder === "number" && Number.isFinite(profile.cleanOrder)) room.cleanOrder = profile.cleanOrder;
        return room;
    });

    // node-xmihome's V60 implementation reads mapId directly from these
    // metadata and passes it through parseInt; accept digit-only strings too.
    // Do not infer it from file names, DID, or segment IDs.
    let mapId: number | undefined;
    try {
        mapId = data.mapId === undefined || data.mapId === null
            ? undefined
            : positiveInteger(data.mapId, "mapId");
    } catch {
        mapId = undefined;
    }

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

function findMarker(data: Uint8Array, start: number): number {
    for (let i = start; i < data.length - 1; i++) {
        if (data[i] === 0x7f && data[i + 1] === 0x7b) return i;
    }
    return -1;
}

function positiveInteger(value: unknown, field: string): number {
    const normalized = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
    if (typeof normalized !== "number" || !Number.isSafeInteger(normalized) || normalized <= 0) {
        throw new Error(`Roidmi map ${field} must be a positive integer`);
    }
    return normalized;
}

function finiteOptionalNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function positiveNumber(value: unknown, field: string): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        throw new Error(`Roidmi map ${field} must be a positive number`);
    }
    return value;
}

/** Decompresses a Xiaomi Cloud Map Extractor-compatible Roidmi .gz archive and parses its metadata. */
export function parseRoidmiMapArchive(archive: Uint8Array): RoidmiMapMetadata {
    let decompressed: Buffer;
    try {
        decompressed = gunzipSync(archive);
    } catch {
        throw new Error("Roidmi map archive is not valid gzip data");
    }
    return parseRoidmiMapPayload(decompressed);
}
