"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRoomCleaningAction = buildRoomCleaningAction;
exports.parseRoomCleaningRequest = parseRoomCleaningRequest;
function buildRoomCleaningAction(mapId, segmentIds) {
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
function parseRoomCleaningRequest(value) {
    let parsed;
    try {
        parsed = JSON.parse(value);
    }
    catch {
        throw new Error("Room-cleaning command must be valid JSON");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Room-cleaning command must be a JSON object");
    }
    const request = parsed;
    if (!Array.isArray(request.roomIds)) {
        throw new Error("Room-cleaning command requires a roomIds array");
    }
    return buildRoomCleaningAction(request.mapId, request.roomIds);
}
