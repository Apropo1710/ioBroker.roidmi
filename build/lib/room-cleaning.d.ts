/**
 * Roidmi EVE Plus room-cleaning MIoT action.
 *
 * The action shape is reported for model roidmi.vacuum.v60:
 * service 14 / action 1 / inputs [2, JSON.stringify({ mapId, segmentId })].
 * Whether this action is accepted over local LAN or requires Xiaomi cloud
 * execution depends on firmware/account path and must be verified on-device.
 */
export interface RoomCleaningAction {
    siid: 14;
    aiid: 1;
    params: [2, string];
}
export declare function buildRoomCleaningAction(mapId: number, segmentIds: number[]): RoomCleaningAction;
/** Parse the writable control.cleanRooms JSON payload. */
export declare function parseRoomCleaningRequest(value: string): RoomCleaningAction;
