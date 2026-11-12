const test = require("node:test");
const assert = require("node:assert/strict");
const { parseXiaomiCleaningSchedules } = require("../build/lib/xiaomi-cleaning-schedules.js");

test("parses C102GL schedule fields and weekday bitmap", () => {
    const schedules = parseXiaomiCleaningSchedules("1-3-08:30-1111100-1-2-1-64-3,8", new Map([[3, "Flur"], [8, "Küche"]]));
    assert.equal(schedules.length, 1);
    assert.equal(schedules[0].enabled, true);
    assert.equal(schedules[0].time, "08:30");
    assert.equal(schedules[0].weekdaysText, "Mo, Di, Mi, Do, Fr");
    assert.equal(schedules[0].cleaningModeText, "Saugen und Wischen");
    assert.equal(schedules[0].fanSpeedText, "Standard");
    assert.equal(schedules[0].waterLevelText, "Mittel");
    assert.equal(schedules[0].roomsText, "Flur, Küche");
});

test("parses multiple schedules separated by semicolon and disabled state", () => {
    const schedules = parseXiaomiCleaningSchedules("1-3-08:30-1111111-1-2-1-64-3;2-0-19:00-0000011-0-0-0-32-8");
    assert.equal(schedules.length, 2);
    assert.equal(schedules[0].weekdaysText, "Täglich");
    assert.equal(schedules[1].enabled, false);
    assert.equal(schedules[1].weekdaysText, "Sa, So");
    assert.equal(schedules[1].roomsText, "8");
});

test("accepts a JSON-encoded schedule array and keeps malformed entries visible", () => {
    const schedules = parseXiaomiCleaningSchedules(JSON.stringify(["1-3-07:00-1111100-1-0-0-32-3", "invalid"]));
    assert.equal(schedules.length, 2);
    assert.equal(schedules[0].time, "07:00");
    assert.ok(schedules[1].parseError);
});

test("empty schedule property produces an empty list", () => {
    assert.deepEqual(parseXiaomiCleaningSchedules(""), []);
});
