/**
 * Firmware-validated room-clean payload builder for Xiaomi X20+ (C102GL).
 * Inputs correspond to MIoT action 4/1, verified in upstream C102GL profile.
 */
export interface XiaomiRoomSelection {
    segmentId: number;
    repeat?: number;
    suction?: number;
    water?: number;
}

export interface XiaomiRoomCleanAction {
    siid: 4;
    aiid: 1;
    inputs: Array<{ piid: 1 | 10; value: number | string }>;
}

export function buildXiaomiRoomCleanAction(rooms: XiaomiRoomSelection[]): XiaomiRoomCleanAction {
    if (!Array.isArray(rooms) || rooms.length === 0) throw new Error("Mindestens ein Raum muss ausgewählt sein");
    const seen = new Set<number>();
    const selects = rooms.map((room, index) => {
        if (!Number.isSafeInteger(room.segmentId) || room.segmentId <= 0) throw new Error("segmentId muss eine positive ganze Zahl sein");
        if (seen.has(room.segmentId)) throw new Error("Raumsegment darf nicht doppelt vorkommen");
        seen.add(room.segmentId);
        const repeat = room.repeat ?? 1;
        const suction = room.suction ?? 1;
        const water = room.water ?? 2;
        if (!Number.isInteger(repeat) || repeat < 1 || repeat > 3) throw new Error("repeat muss zwischen 1 und 3 liegen");
        if (!Number.isInteger(suction) || suction < 0 || suction > 3) throw new Error("suction muss zwischen 0 und 3 liegen");
        if (!Number.isInteger(water) || water < 1 || water > 3) throw new Error("water muss zwischen 1 und 3 liegen");
        return [room.segmentId, repeat, suction, water, index + 1];
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
export function parseXiaomiRoomCleanRequest(json: string): XiaomiRoomCleanAction {
    let value: unknown;
    try { value = JSON.parse(json); } catch { throw new Error("Raumreinigung erwartet gültiges JSON"); }
    if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray((value as {rooms?:unknown}).rooms)) {
        throw new Error("JSON muss ein Objekt mit rooms-Array enthalten");
    }
    return buildXiaomiRoomCleanAction((value as {rooms: XiaomiRoomSelection[]}).rooms);
}
