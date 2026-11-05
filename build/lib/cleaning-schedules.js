"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCleaningSchedules = parseCleaningSchedules;
const FAN = { 0: "Aus", 1: "Leise", 2: "Standard", 3: "Stark", 4: "Maximal" };
const WATER = { 0: "Aus / kein Wasser", 1: "Niedrig", 2: "Mittel", 3: "Hoch", 4: "Zusatzstufe" };
const DAYS = { 0: "So", 1: "Mo", 2: "Di", 3: "Mi", 4: "Do", 5: "Fr", 6: "Sa" };
function num(a, i, label) {
    const v = a[i];
    if (typeof v !== "number" || !Number.isFinite(v))
        throw new Error("Ungültiger Zeitplan: " + label);
    return v;
}
function parseCleaningSchedules(json) {
    const root = JSON.parse(json);
    if (!root || typeof root !== "object" || !Array.isArray(root.time))
        throw new Error("Zeitplan-JSON ohne time-Array");
    return (root.time).map((entry, index) => {
        if (!Array.isArray(entry) || entry.length < 8)
            throw new Error("Ungültiger Zeitplan-Eintrag " + index);
        const secs = num(entry, 0, "Uhrzeit"), fan = num(entry, 2, "Saugstufe"), mode = num(entry, 3, "Modus"), water = num(entry, 5, "Wasser");
        const days = entry[4], rooms = entry[6];
        if (!Array.isArray(days) || !days.every(x => typeof x === "number"))
            throw new Error("Ungültige Wochentage im Eintrag " + index);
        if (!Array.isArray(rooms) || !rooms.every(x => typeof x === "number"))
            throw new Error("Ungültige Raum-IDs im Eintrag " + index);
        const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
        return { timeSeconds: secs, timeText: String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0"), enabled: num(entry, 1, "Aktivierung") === 1,
            fanSpeed: fan, fanSpeedText: FAN[fan] ?? "Unbekannt (" + fan + ")", cleaningMode: mode,
            weekdays: days, weekdaysText: days.length === 7 ? "täglich" : days.map(d => DAYS[d] ?? "Tag " + d).join(", "),
            waterLevel: water, waterLevelText: WATER[water] ?? "Unbekannt (" + water + ")", roomIds: rooms, trailingValue: entry[7] };
    });
}
