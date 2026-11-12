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

const DAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MODE_NAMES: Record<number, string> = {
    0: "Nur Saugen",
    1: "Saugen und Wischen",
    2: "Nur Wischen",
    3: "Individuell"
};
const FAN_NAMES: Record<number, string> = {
    0: "Leise",
    1: "Standard",
    2: "Mittel",
    3: "Turbo"
};
const WATER_NAMES: Record<number, string> = {
    32: "Niedrig",
    64: "Mittel",
    96: "Hoch"
};

/**
 * Parse the C102GL schedule string returned by MIoT SIID 8 / PIID 2.
 * Example: 1-1-08:30-1111111-1-2-1-64-3
 *
 * The source format stores weekdays Monday..Sunday as a seven-character bit string.
 */
export function parseXiaomiCleaningSchedules(value: unknown, roomNames: Map<number, string> = new Map()): XiaomiCleaningSchedule[] {
    let entries: unknown[] = [];
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return [];
        try {
            const decoded: unknown = JSON.parse(trimmed);
            if (Array.isArray(decoded)) entries = decoded;
            else if (typeof decoded === "string") entries = decoded.split(";");
            else entries = [trimmed];
        } catch {
            entries = trimmed.split(";");
        }
    } else if (Array.isArray(value)) {
        entries = value;
    } else if (value !== null && value !== undefined) {
        entries = [value];
    }

    return entries.map((item, index): XiaomiCleaningSchedule => {
        const raw = typeof item === "string" ? item.trim() : String(item ?? "");
        const parts = raw.split("-", 9);
        if (parts.length !== 9) {
            return {
                id: String(index + 1), enabled: false, time: "", weekdays: [], weekdaysText: "",
                repeat: false, cleaningMode: -1, cleaningModeText: "Unbekannt",
                fanSpeed: -1, fanSpeedText: "Unbekannt", waterLevel: -1, waterLevelText: "Unbekannt",
                roomIds: [], roomsText: "", raw, parseError: "Unerwartetes Zeitplanformat"
            };
        }

        const [id, enabledRaw, time, daysRaw, repeatRaw, modeRaw, fanRaw, waterRaw, roomsRaw] = parts;
        // C102GL bitmap: rightmost bit = Sunday, leftmost bit = Saturday.
        const days = daysRaw.length === 7
            ? [...daysRaw].flatMap((bit, day) => bit === "1" ? [day === 6 ? 6 : 5 - day] : []).sort((a, b) => a - b)
            : [];
        const roomIds = roomsRaw.split(",").map((entry) => Number(entry.trim())).filter((entry) => Number.isInteger(entry) && entry >= 0);
        const mode = Number(modeRaw);
        const fan = Number(fanRaw);
        const water = Number(waterRaw);
        const roomsText = roomIds.length === 1 && roomIds[0] === 0 ? "Alle Bereiche" : roomIds.map((roomId) => roomNames.get(roomId) ?? String(roomId)).join(", ");

        return {
            id,
            enabled: enabledRaw === "1",
            time,
            weekdays: days,
            weekdaysText: days.length === 7 ? "Täglich" : days.map((day) => DAY_NAMES[day]).join(", ") || "Einmalig",
            repeat: repeatRaw === "1",
            cleaningMode: Number.isFinite(mode) ? mode : -1,
            cleaningModeText: MODE_NAMES[mode] ?? "Unbekannt (" + modeRaw + ")",
            fanSpeed: Number.isFinite(fan) ? fan : -1,
            fanSpeedText: FAN_NAMES[fan] ?? "Unbekannt (" + fanRaw + ")",
            waterLevel: Number.isFinite(water) ? water : -1,
            waterLevelText: WATER_NAMES[water] ?? "Unbekannt (" + waterRaw + ")",
            roomIds,
            roomsText: roomsText || "Keine Raumangabe",
            raw
        };
    });
}

/** Return the same Xiaomi Home schedule list with only one entry's enable flag changed. */
export function setXiaomiCleaningScheduleEnabled(value: unknown, scheduleId: string, enabled: boolean): string {
    if (typeof scheduleId !== "string" || !scheduleId.trim()) throw new Error("A schedule ID is required.");
    if (typeof enabled !== "boolean") throw new Error("Schedule enabled value must be boolean.");
    let source: string;
    if (typeof value === "string") {
        source = value.trim();
        if (source.startsWith("[") || source.startsWith('"')) {
            try {
                const decoded: unknown = JSON.parse(source);
                if (Array.isArray(decoded) && decoded.every(item => typeof item === "string")) source = decoded.join(";");
                else if (typeof decoded === "string") source = decoded;
            } catch { /* Keep the original raw MIoT value for validation below. */ }
        }
    } else if (Array.isArray(value) && value.every(item => typeof item === "string")) {
        source = value.join(";");
    } else {
        throw new Error("Xiaomi schedule data is not a supported string list.");
    }
    const entries = source.split(";");
    const index = entries.findIndex(entry => entry.trim().split("-", 9)[0] === scheduleId);
    if (index < 0) throw new Error("Schedule " + scheduleId + " was not found in the current Xiaomi Home data.");
    const parts = entries[index].trim().split("-", 9);
    if (parts.length !== 9) throw new Error("Schedule " + scheduleId + " has an invalid format; nothing was written.");
    parts[1] = enabled ? "1" : "0";
    entries[index] = parts.join("-");
    return entries.join(";");
}

/** Verify a schedule write by its stored fields, not by the raw serialization. */
export function verifyXiaomiCleaningScheduleUpdate(before: unknown, after: unknown, scheduleId: string, enabled: boolean): void {
    const previous = parseXiaomiCleaningSchedules(before);
    const stored = parseXiaomiCleaningSchedules(after);
    if (!previous.length || previous.some(entry => entry.parseError) || stored.some(entry => entry.parseError)) {
        throw new Error("Xiaomi returned an empty or malformed schedule list during readback.");
    }
    if (previous.length !== stored.length || previous.some((entry, index) => entry.id !== stored[index]?.id)) {
        throw new Error("Xiaomi changed the schedule list or its order during the update.");
    }
    if (previous.filter(entry => entry.id === scheduleId).length !== 1) {
        throw new Error("Schedule " + scheduleId + " is missing or duplicated in the original schedule list.");
    }
    for (let index = 0; index < previous.length; index++) {
        const oldParts = previous[index].raw.split("-");
        const newParts = stored[index].raw.split("-");
        if (oldParts.length !== 9 || newParts.length !== 9) {
            throw new Error("Schedule " + previous[index].id + " has an invalid format during readback.");
        }
        if (previous[index].id === scheduleId) {
            const expectedFlag = enabled ? "1" : "0";
            if (newParts[1] !== expectedFlag) {
                throw new Error("Xiaomi readback shows schedule " + scheduleId + " is still " + (newParts[1] === "1" ? "active" : "inactive") + "; requested state was " + (enabled ? "active" : "inactive") + ".");
            }
            oldParts[1] = expectedFlag;
        }
        if (oldParts.some((part, partIndex) => part !== newParts[partIndex])) {
            throw new Error("Xiaomi readback changed fields other than the requested activation flag for schedule " + previous[index].id + ".");
        }
    }
}
