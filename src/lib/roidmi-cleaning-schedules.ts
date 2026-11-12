export interface RoidmiCleaningScheduleUpdate {
    timeSeconds?: number;
    enabled?: boolean;
    fanSpeed?: number;
    cleaningMode?: number;
    weekdays?: number[];
    waterLevel?: number;
    roomIds?: number[];
}

type ScheduleRoot = Record<string, unknown> & { time: unknown[] };

function parseRoot(raw: string): ScheduleRoot {
    let value: unknown;
    try {
        value = JSON.parse(raw);
    } catch {
        throw new Error("Schedule JSON is invalid");
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Schedule JSON root must be an object");
    }
    const root = value as Record<string, unknown>;
    if (!Array.isArray(root.time)) throw new Error("Schedule JSON has no time array");
    return root as ScheduleRoot;
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

function validateUpdate(update: RoidmiCleaningScheduleUpdate): void {
    if (!update || typeof update !== "object" || Array.isArray(update)) {
        throw new Error("Schedule update must be an object");
    }
    const keys = Object.keys(update);
    if (!keys.length) throw new Error("Schedule update contains no fields");
    const allowed = new Set(["timeSeconds", "enabled", "fanSpeed", "cleaningMode", "weekdays", "waterLevel", "roomIds"]);
    for (const key of keys) if (!allowed.has(key)) throw new Error("Unsupported schedule field: " + key);
    if (Object.prototype.hasOwnProperty.call(update, "timeSeconds") && !isIntegerInRange(update.timeSeconds, 0, 86399)) {
        throw new Error("timeSeconds must be an integer between 0 and 86399");
    }
    if (Object.prototype.hasOwnProperty.call(update, "enabled") && typeof update.enabled !== "boolean") {
        throw new Error("enabled must be a boolean");
    }
    if (Object.prototype.hasOwnProperty.call(update, "fanSpeed") && !isIntegerInRange(update.fanSpeed, 0, 4)) {
        throw new Error("fanSpeed must be an integer between 0 and 4");
    }
    if (Object.prototype.hasOwnProperty.call(update, "cleaningMode") && !isIntegerInRange(update.cleaningMode, 0, 255)) {
        throw new Error("cleaningMode must be an integer between 0 and 255");
    }
    if (Object.prototype.hasOwnProperty.call(update, "waterLevel") && !isIntegerInRange(update.waterLevel, 0, 4)) {
        throw new Error("waterLevel must be an integer between 0 and 4");
    }
    if (Object.prototype.hasOwnProperty.call(update, "weekdays")) {
        if (!Array.isArray(update.weekdays) || update.weekdays.some(day => !isIntegerInRange(day, 0, 6)) ||
            new Set(update.weekdays).size !== update.weekdays.length) {
            throw new Error("weekdays must contain unique integers from 0 to 6");
        }
    }
    if (Object.prototype.hasOwnProperty.call(update, "roomIds")) {
        if (!Array.isArray(update.roomIds) || update.roomIds.length === 0 ||
            update.roomIds.some(roomId => !isIntegerInRange(roomId, 0, Number.MAX_SAFE_INTEGER)) ||
            new Set(update.roomIds).size !== update.roomIds.length) {
            throw new Error("roomIds must contain unique non-negative integers and at least one room");
        }
    }
}

function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        const result: Record<string, unknown> = {};
        for (const key of Object.keys(record).sort()) result[key] = canonicalize(record[key]);
        return result;
    }
    return value;
}

function equalJson(left: unknown, right: unknown): boolean {
    return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

/** Compares snapshots semantically, ignoring JSON whitespace and object-key order. */
export function areRoidmiScheduleSnapshotsEqual(leftRaw: string, rightRaw: string): boolean {
    return equalJson(parseRoot(leftRaw), parseRoot(rightRaw));
}

/** Changes only explicitly supplied fields in one existing EVE Plus schedule. */
export function updateRoidmiCleaningSchedule(raw: string, index: number, update: RoidmiCleaningScheduleUpdate): string {
    if (!Number.isSafeInteger(index) || index < 0) throw new Error("Schedule index must be a non-negative integer");
    validateUpdate(update);
    const root = parseRoot(raw);
    if (index >= root.time.length) throw new Error("Schedule index is out of range");
    const entry = root.time[index];
    if (!Array.isArray(entry) || entry.length < 8) throw new Error("Schedule entry is invalid or incomplete");
    const changed = entry.slice();
    if (Object.prototype.hasOwnProperty.call(update, "timeSeconds")) changed[0] = update.timeSeconds;
    if (Object.prototype.hasOwnProperty.call(update, "enabled")) changed[1] = update.enabled ? 1 : 0;
    if (Object.prototype.hasOwnProperty.call(update, "fanSpeed")) changed[2] = update.fanSpeed;
    if (Object.prototype.hasOwnProperty.call(update, "cleaningMode")) changed[3] = update.cleaningMode;
    if (Object.prototype.hasOwnProperty.call(update, "weekdays")) changed[4] = update.weekdays;
    if (Object.prototype.hasOwnProperty.call(update, "waterLevel")) changed[5] = update.waterLevel;
    if (Object.prototype.hasOwnProperty.call(update, "roomIds")) changed[6] = update.roomIds;
    root.time[index] = changed;
    return JSON.stringify(root);
}

/** Verifies that only the requested fields of the selected entry changed. */
export function verifyRoidmiCleaningScheduleUpdate(
    beforeRaw: string,
    afterRaw: string,
    index: number,
    update: RoidmiCleaningScheduleUpdate
): boolean {
    const expected = parseRoot(updateRoidmiCleaningSchedule(beforeRaw, index, update));
    const actual = parseRoot(afterRaw);
    return equalJson(expected, actual);
}
