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
}

export interface RoidmiMapMetadata {
    width: number;
    height: number;
    resolution: number;
    mapId?: number;
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

    const jsonStart = marker + 2;
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

    const areas = Array.isArray(data.autoArea)
        ? data.autoArea
        : Array.isArray(data.autoAreaValue)
            ? data.autoAreaValue
            : [];
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
        return room;
    });

    const mapId = typeof data.mapId === "number" && Number.isSafeInteger(data.mapId) && data.mapId > 0
        ? data.mapId
        : undefined;

    return { width, height, resolution, ...(mapId === undefined ? {} : { mapId }), rooms };
}

function findMarker(data: Uint8Array, start: number): number {
    for (let i = start; i < data.length - 1; i++) {
        if (data[i] === 0x7f && data[i + 1] === 0x7b) return i;
    }
    return -1;
}

function positiveInteger(value: unknown, field: string): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`Roidmi map ${field} must be a positive integer`);
    }
    return value;
}

function positiveNumber(value: unknown, field: string): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        throw new Error(`Roidmi map ${field} must be a positive number`);
    }
    return value;
}
