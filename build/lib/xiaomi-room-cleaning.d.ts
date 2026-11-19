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
    inputs: Array<{
        piid: 1 | 10;
        value: number | string;
    }>;
}
/** Replace only the cleaning-mode bits in the packed SIID 4 / PIID 23 value. */
export declare function mergeXiaomiCleaningMode(rawValue: number, cleaningMode: number): number;
export declare function buildXiaomiRoomCleanAction(rooms: XiaomiRoomSelection[]): XiaomiRoomCleanAction;
/** JSON shape: {"rooms":[{"segmentId":1,"repeat":1,"suction":1,"water":2}]} */
export declare function parseXiaomiRoomCleanRequest(json: string): XiaomiRoomCleanAction;
