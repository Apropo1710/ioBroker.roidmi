"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeXiaomiCleaningMode = mergeXiaomiCleaningMode;
exports.buildXiaomiRoomCleanAction = buildXiaomiRoomCleanAction;
exports.parseXiaomiRoomCleanRequest = parseXiaomiRoomCleanRequest;
/** Replace only the cleaning-mode bits in the packed SIID 4 / PIID 23 value. */
function mergeXiaomiCleaningMode(rawValue, cleaningMode) {
    if (!Number.isSafeInteger(rawValue) || rawValue < 0)
        throw new Error("Gültiger Rohwert für Reinigungssetting erforderlich");
    if (!Number.isInteger(cleaningMode) || cleaningMode < 0 || cleaningMode > 3)
        throw new Error("cleaningMode muss zwischen 0 und 3 liegen");
    return (rawValue & ~0x03) | (cleaningMode & 0x03);
}
function buildXiaomiRoomCleanAction(rooms) {
    if (!Array.isArray(rooms) || rooms.length === 0)
        throw new Error("Mindestens ein Raum muss ausgewählt sein");
    const seen = new Set();
    const selects = rooms.map((room, index) => {
        if (!Number.isSafeInteger(room.segmentId) || room.segmentId <= 0)
            throw new Error("segmentId muss eine positive ganze Zahl sein");
        if (seen.has(room.segmentId))
            throw new Error("Raumsegment darf nicht doppelt vorkommen");
        seen.add(room.segmentId);
        const repeat = room.repeat ?? 1;
        const suction = room.suction ?? 1;
        const water = room.water ?? 2;
        if (!Number.isInteger(repeat) || repeat < 1 || repeat > 3)
            throw new Error("repeat muss zwischen 1 und 3 liegen");
        if (!Number.isInteger(suction) || suction < 0 || suction > 3)
            throw new Error("suction muss zwischen 0 und 3 liegen");
        if (!Number.isInteger(water) || water < 1 || water > 3)
            throw new Error("water muss zwischen 1 und 3 liegen");
        // Live X20+ hardware tests (14–15 Nov 2026): every room row must use slot 1.
        return [room.segmentId, repeat, suction, water, 1];
    });
    return {
        siid: 4,
        aiid: 1,
        inputs: [
            { piid: 1, value: 18 },
            { piid: 10, value: JSON.stringify({ selects }) }
        ]
    };
}
/** JSON shape: {"rooms":[{"segmentId":1,"repeat":1,"suction":1,"water":2}]} */
function parseXiaomiRoomCleanRequest(json) {
    let value;
    try {
        value = JSON.parse(json);
    }
    catch {
        throw new Error("Raumreinigung erwartet gültiges JSON");
    }
    if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.rooms)) {
        throw new Error("JSON muss ein Objekt mit rooms-Array enthalten");
    }
    return buildXiaomiRoomCleanAction(value.rooms);
}
