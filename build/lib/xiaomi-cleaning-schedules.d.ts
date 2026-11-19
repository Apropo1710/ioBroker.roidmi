export interface XiaomiCleaningSchedule {
    id: string;
    enabled: boolean;
    time: string;
    weekdays: number[];
    weekdaysText: string;
    repeat: boolean;
    cleaningMode: number;
    cleaningModeText: string;
    fanSpeed: number;
    fanSpeedText: string;
    waterLevel: number;
    waterLevelText: string;
    roomIds: number[];
    roomsText: string;
    raw: string;
    parseError?: string;
}
/**
 * Parse the C102GL schedule string returned by MIoT SIID 8 / PIID 2.
 * Example: 1-1-08:30-1111111-1-2-1-64-3
 *
 * The source format stores weekdays Sunday..Monday as a seven-character bit string.
 */
export declare function parseXiaomiCleaningSchedules(value: unknown, roomNames?: Map<number, string>): XiaomiCleaningSchedule[];
/** Return the same Xiaomi Home schedule list with only one entry's enable flag changed. */
export declare function setXiaomiCleaningScheduleEnabled(value: unknown, scheduleId: string, enabled: boolean): string;
/** Verify a schedule write by its stored fields, not by the raw serialization. */
export declare function verifyXiaomiCleaningScheduleUpdate(before: unknown, after: unknown, scheduleId: string, enabled: boolean): void;
export interface XiaomiCleaningScheduleUpdate {
    time: string;
    weekdays: number[];
    repeat: boolean;
    cleaningMode: number;
    fanSpeed: number;
    waterLevel: number;
    roomIds: number[];
}
export declare function updateXiaomiCleaningSchedule(value: unknown, id: string, u: XiaomiCleaningScheduleUpdate): string;
export declare function verifyXiaomiCleaningScheduleDetailsUpdate(before: unknown, after: unknown, id: string, u: XiaomiCleaningScheduleUpdate): void;
