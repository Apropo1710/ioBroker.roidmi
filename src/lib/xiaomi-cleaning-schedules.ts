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
    1: "Nur Wischen",
    2: "Saugen und Wischen",
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
 * Example: 1-3-08:30-1111111-1-2-1-64-3
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
        const days = daysRaw.length === 7
            ? [...daysRaw].flatMap((bit, day) => bit === "1" ? [day] : [])
            : [];
        const roomIds = roomsRaw.split(",").map((entry) => Number(entry.trim())).filter((entry) => Number.isInteger(entry) && entry >= 0);
        const mode = Number(modeRaw);
        const fan = Number(fanRaw);
        const water = Number(waterRaw);
        const roomsText = roomIds.map((roomId) => roomNames.get(roomId) ?? String(roomId)).join(", ");

        return {
            id,
            enabled: enabledRaw === "3",
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
