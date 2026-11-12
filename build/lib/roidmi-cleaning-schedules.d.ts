export interface RoidmiCleaningScheduleUpdate {
    timeSeconds?: number;
    enabled?: boolean;
    fanSpeed?: number;
    cleaningMode?: number;
    weekdays?: number[];
    waterLevel?: number;
    roomIds?: number[];
}
export declare function areRoidmiScheduleSnapshotsEqual(leftRaw: string, rightRaw: string): boolean;
export declare function updateRoidmiCleaningSchedule(raw: string, index: number, update: RoidmiCleaningScheduleUpdate): string;
export declare function verifyRoidmiCleaningScheduleUpdate(beforeRaw: string, afterRaw: string, index: number, update: RoidmiCleaningScheduleUpdate): boolean;
