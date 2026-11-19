/**
 * Room-clean command execution observation for Xiaomi X20+.
 * MIoT action responses only acknowledge receipt; require an observed status transition.
 */
export const XIAOMI_X20_PLUS_CLEANING_STATUSES = [1, 7, 12] as const;
export type RoomCleanObservation = { state: "pending" | "observed" | "not-observed" | "ambiguous"; message: string };
export interface RoomCleanObservationTracker {
    baselineStatus: number | null;
    pollsRemaining: number;
    state: "pending" | "observed" | "not-observed" | "ambiguous";
}
export function createRoomCleanObservationTracker(baselineStatus: number | null, maxPolls = 3): RoomCleanObservationTracker {
    if (baselineStatus !== null && isCleaningStatus(baselineStatus)) return { baselineStatus, pollsRemaining: 0, state: "ambiguous" };
    return { baselineStatus, pollsRemaining: Math.max(1, maxPolls), state: "pending" };
}
export function observeRoomCleanStatus(tracker: RoomCleanObservationTracker, currentStatus: number | null): RoomCleanObservation {
    if (tracker.state === "observed") return { state: "observed", message: "Room-clean start observed in normal status polling." };
    if (tracker.state === "not-observed") return { state: "not-observed", message: "Room-clean start was not observed in normal status polling; command outcome remains unverified." };
    if (tracker.state === "ambiguous") return { state: "ambiguous", message: "Robot was already cleaning before the command; execution cannot be attributed to this request." };
    if (currentStatus !== null && isCleaningStatus(currentStatus) && tracker.baselineStatus !== null && !isCleaningStatus(tracker.baselineStatus)) {
        tracker.state = "observed";
        return { state: "observed", message: "Room-clean start observed in normal status polling." };
    }
    tracker.pollsRemaining--;
    if (tracker.pollsRemaining <= 0) {
        tracker.state = "not-observed";
        return { state: "not-observed", message: "Room-clean start was not observed in normal status polling; command outcome remains unverified." };
    }
    return { state: "pending", message: "MIoT accepted the room-clean action; waiting for normal status polling (execution not yet verified)." };
}
function isCleaningStatus(status: number): boolean {
    return (XIAOMI_X20_PLUS_CLEANING_STATUSES as readonly number[]).includes(status);
}
