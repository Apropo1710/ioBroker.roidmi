export interface RoidmiCleaningScheduleUpdate {
    timeSeconds?: number;
    enabled?: boolean;
    fanSpeed?: number;
    cleaningMode?: number;
    weekdays?: number[];
    waterLevel?: number;
    roomIds?: number[];
}
/** Compares snapshots semantically, ignoring JSON whitespace and object-key order. */
export declare function areRoidmiScheduleSnapshotsEqual(leftRaw: string, rightRaw: string): boolean;
/** Changes only explicitly supplied fields in one existing EVE Plus schedule. */
export declare function updateRoidmiCleaningSchedule(raw: string, index: number, update: RoidmiCleaningScheduleUpdate): string;
/** Verifies that only the requested fields of the selected entry changed. */
export declare function verifyRoidmiCleaningScheduleUpdate(beforeRaw: string, afterRaw: string, index: number, update: RoidmiCleaningScheduleUpdate): boolean;
