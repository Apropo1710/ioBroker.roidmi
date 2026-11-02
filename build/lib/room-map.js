"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRoomMapConfig = parseRoomMapConfig;
/**
 * Parse JSON supplied to control.importRooms.
 * Example: {"mapId":123456,"rooms":[{"id":1,"name":"Kitchen"},{"id":2,"name":"Living room"}]}
 */
function parseRoomMapConfig(value) {
    let parsed;
    try {
        parsed = JSON.parse(value);
    }
    catch {
        throw new Error("Room-map import must be valid JSON");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Room-map import must be a JSON object");
    }
    const input = parsed;
    if (!Number.isSafeInteger(input.mapId) || input.mapId <= 0) {
        throw new Error("mapId must be a positive safe integer");
    }
    if (!Array.isArray(input.rooms) || input.rooms.length === 0 || input.rooms.length > 50) {
        throw new Error("rooms must contain between 1 and 50 entries");
    }
    const seen = new Set();
    const rooms = input.rooms.map((entry, index) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            throw new Error(`Room at index ${index} must be an object`);
        }
        const room = entry;
        if (!Number.isSafeInteger(room.id) || room.id <= 0) {
            throw new Error(`Room at index ${index} has an invalid segment ID`);
        }
        const id = room.id;
        if (seen.has(id))
            throw new Error(`Duplicate room segment ID: ${id}`);
        seen.add(id);
        if (typeof room.name !== "string" || !room.name.trim() || room.name.trim().length > 64) {
            throw new Error(`Room ${id} must have a name between 1 and 64 characters`);
        }
        return { id, name: room.name.trim() };
    });
    return { mapId: input.mapId, rooms };
}
