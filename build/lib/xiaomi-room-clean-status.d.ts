/**
 * Room-clean command execution observation for Xiaomi X20+.
 * MIoT action responses only acknowledge receipt; require an observed status transition.
 */
export declare const XIAOMI_X20_PLUS_CLEANING_STATUSES: readonly [1, 7, 12];
export type RoomCleanObservation = {
    state: "pending" | "observed" | "not-observed" | "ambiguous";
    message: string;
};
export interface RoomCleanObservationTracker {
    baselineStatus: number | null;
    pollsRemaining: number;
    state: "pending" | "observed" | "not-observed" | "ambiguous";
}
export declare function createRoomCleanObservationTracker(baselineStatus: number | null, maxPolls?: number): RoomCleanObservationTracker;
export declare function observeRoomCleanStatus(tracker: RoomCleanObservationTracker, currentStatus: number | null): RoomCleanObservation;
