export interface ParsedCleaningSchedule {
    timeSeconds: number;
    timeText: string;
    enabled: boolean;
    fanSpeed: number;
    fanSpeedText: string;
    cleaningMode: number;
    weekdays: number[];
    weekdaysText: string;
    waterLevel: number;
    waterLevelText: string;
    roomIds: number[];
    trailingValue: unknown;
}
export declare function parseCleaningSchedules(json: string): ParsedCleaningSchedule[];
