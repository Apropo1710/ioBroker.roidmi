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

export function buildRoomCleaningAction(mapId: number, segmentIds: number[]): RoomCleaningAction {
    if (!Number.isSafeInteger(mapId) || mapId <= 0) {
        throw new Error("mapId must be a positive safe integer");
    }
    if (!Array.isArray(segmentIds) || segmentIds.length === 0) {
        throw new Error("At least one room segment ID is required");
    }
    if (segmentIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
        throw new Error("Every room segment ID must be a positive safe integer");
    }

    return {
        siid: 14,
        aiid: 1,
        params: [2, JSON.stringify({ mapId, segmentId: [...new Set(segmentIds)] })]
    };
}


/** Parse the writable control.cleanRooms JSON payload. */
export function parseRoomCleaningRequest(value: string): RoomCleaningAction {
    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch {
        throw new Error("Room-cleaning command must be valid JSON");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Room-cleaning command must be a JSON object");
    }
    const request = parsed as Record<string, unknown>;
    if (!Array.isArray(request.roomIds)) {
        throw new Error("Room-cleaning command requires a roomIds array");
    }
    return buildRoomCleaningAction(request.mapId as number, request.roomIds as number[]);
}
