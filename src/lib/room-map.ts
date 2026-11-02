/** Validated, persistable room-map import format for the Roidmi EVE Plus. */
export interface RoomMapEntry {
    id: number;
    name: string;
}
export interface RoomMapConfig {
    mapId: number;
    rooms: RoomMapEntry[];
}

/**
 * Parse JSON supplied to control.importRooms.
 * Example: {"mapId":123456,"rooms":[{"id":1,"name":"Kitchen"},{"id":2,"name":"Living room"}]}
 */
export function parseRoomMapConfig(value: string): RoomMapConfig {
    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch {
        throw new Error("Room-map import must be valid JSON");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Room-map import must be a JSON object");
    }
    const input = parsed as Record<string, unknown>;
    if (!Number.isSafeInteger(input.mapId) || (input.mapId as number) <= 0) {
        throw new Error("mapId must be a positive safe integer");
    }
    if (!Array.isArray(input.rooms) || input.rooms.length === 0 || input.rooms.length > 50) {
        throw new Error("rooms must contain between 1 and 50 entries");
    }
    const seen = new Set<number>();
    const rooms = input.rooms.map((entry, index): RoomMapEntry => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            throw new Error(`Room at index ${index} must be an object`);
        }
        const room = entry as Record<string, unknown>;
        if (!Number.isSafeInteger(room.id) || (room.id as number) <= 0) {
            throw new Error(`Room at index ${index} has an invalid segment ID`);
        }
        const id = room.id as number;
        if (seen.has(id)) throw new Error(`Duplicate room segment ID: ${id}`);
        seen.add(id);
        if (typeof room.name !== "string" || !room.name.trim() || room.name.trim().length > 64) {
            throw new Error(`Room ${id} must have a name between 1 and 64 characters`);
        }
        return { id, name: room.name.trim() };
    });
    return { mapId: input.mapId as number, rooms };
}
