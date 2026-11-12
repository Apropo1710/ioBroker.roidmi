const test = require("node:test");
const assert = require("node:assert/strict");
const { parseXiaomiCleaningSchedules, setXiaomiCleaningScheduleEnabled, verifyXiaomiCleaningScheduleUpdate, updateXiaomiCleaningSchedule, verifyXiaomiCleaningScheduleDetailsUpdate } = require("../build/lib/xiaomi-cleaning-schedules.js");

test("parses C102GL schedule fields and weekday bitmap", () => {
    const schedules = parseXiaomiCleaningSchedules("1-1-08:30-0111110-1-1-1-64-3,8", new Map([[3, "Flur"], [8, "Küche"]]));
    assert.equal(schedules.length, 1);
    assert.equal(schedules[0].enabled, true);
    assert.equal(schedules[0].time, "08:30");
    assert.equal(schedules[0].weekdaysText, "Mo, Di, Mi, Do, Fr");
    assert.equal(schedules[0].cleaningModeText, "Nur Saugen");
    assert.equal(schedules[0].fanSpeedText, "Standard");
    assert.equal(schedules[0].waterLevelText, "Mittel");
    assert.equal(schedules[0].roomsText, "Flur, Küche");
});

test("parses multiple schedules separated by semicolon and disabled state", () => {
    const schedules = parseXiaomiCleaningSchedules("1-1-08:30-1111111-1-1-1-64-3;2-0-19:00-1000001-0-0-0-32-8");
    assert.equal(schedules.length, 2);
    assert.equal(schedules[0].weekdaysText, "Täglich");
    assert.equal(schedules[1].enabled, false);
    assert.equal(schedules[1].weekdaysText, "Sa, So");
    assert.equal(schedules[1].roomsText, "8");
});

test("accepts a JSON-encoded schedule array and keeps malformed entries visible", () => {
    const schedules = parseXiaomiCleaningSchedules(JSON.stringify(["1-1-07:00-0111110-1-0-0-32-3", "invalid"]));
    assert.equal(schedules.length, 2);
    assert.equal(schedules[0].time, "07:00");
    assert.ok(schedules[1].parseError);
});

test("empty schedule property produces an empty list", () => {
    assert.deepEqual(parseXiaomiCleaningSchedules(""), []);
});

test("decodes observed X20+ schedule bit order, cleaning mode and all-area marker", () => {
    const schedules = parseXiaomiCleaningSchedules("1-0-09:00-0111110-1-1-1-32-0;2-0-10:00-1000001-1-1-1-32-0;3-0-12:09-0000000-0-1-1-32-0");
    assert.equal(schedules[0].weekdaysText, "Mo, Di, Mi, Do, Fr");
    assert.equal(schedules[1].weekdaysText, "Sa, So");
    assert.equal(schedules[0].cleaningModeText, "Nur Saugen");
    assert.equal(schedules[0].roomsText, "Alle Bereiche");
    assert.equal(schedules[2].weekdaysText, "Einmalig");
});

test("changes only the selected schedule enabled flag and preserves all other fields", () => {
    const raw = "1-1-08:30-0111110-1-1-1-64-3;2-0-19:00-1000001-0-0-0-32-8";
    assert.equal(setXiaomiCleaningScheduleEnabled(raw, "2", true), "1-1-08:30-0111110-1-1-1-64-3;2-1-19:00-1000001-0-0-0-32-8");
    assert.equal(setXiaomiCleaningScheduleEnabled(raw, "1", false), "1-0-08:30-0111110-1-1-1-64-3;2-0-19:00-1000001-0-0-0-32-8");
});

test("rejects unknown or malformed schedule entries without changing the source", () => {
    const raw = "1-0-09:00-0111110-1-1-1-32-0";
    assert.throws(() => setXiaomiCleaningScheduleEnabled(raw, "2", true), /was not found/);
    assert.throws(() => setXiaomiCleaningScheduleEnabled("1-0-09:00", "1", true), /invalid format/);
});


test("verifies schedule activation despite harmless whitespace normalization", () => {
    const before = "1-1-09:00-0111110-1-1-1-32-0;2-0-10:00-1000001-1-1-1-32-0";
    const after = "1-1-09:00-0111110-1-1-1-32-0; 2-1-10:00-1000001-1-1-1-32-0 ";
    assert.doesNotThrow(() => verifyXiaomiCleaningScheduleUpdate(before, after, "2", true));
});

test("rejects readback when requested activation was not stored", () => {
    const before = "1-0-09:00-0111110-1-1-1-32-0";
    const unchanged = "1-0-09:00-0111110-1-1-1-32-0";
    assert.throws(() => verifyXiaomiCleaningScheduleUpdate(before, unchanged, "1", true), /still inactive/);
});

test("rejects readback that changes another schedule field", () => {
    const before = "1-0-09:00-0111110-1-1-1-32-0;2-1-10:00-1000001-1-1-1-32-0";
    const changed = "1-1-09:00-0111110-1-1-2-32-0;2-1-10:00-1000001-1-1-1-32-0";
    assert.throws(() => verifyXiaomiCleaningScheduleUpdate(before, changed, "1", true), /changed fields other than/);
});


test("decodes automatic water adjustment reported by Xiaomi Home", () => {
    const schedules = parseXiaomiCleaningSchedules("3-0-13:11-0000000-0-3-0-0-0");
    assert.equal(schedules[0].waterLevel, 0);
    assert.equal(schedules[0].waterLevelText, "Automatische Anpassung");
});

test("edits supported fields of one schedule and preserves other schedules",()=>{
 const raw="1-1-08:30-0111110-1-1-1-64-3,8;2-0-19:00-1000001-0-0-0-32-8";
 const u={time:"07:45",weekdays:[0,2,4],repeat:true,cleaningMode:4,fanSpeed:3,waterLevel:0,roomIds:[8,3]};
 const expected="1-1-07:45-0101010-1-4-3-0-8,3;2-0-19:00-1000001-0-0-0-32-8";
 assert.equal(updateXiaomiCleaningSchedule(raw,"1",u),expected);
 assert.doesNotThrow(()=>verifyXiaomiCleaningScheduleDetailsUpdate(raw,expected,"1",u));
});
test("supports one-time schedule edits and rejects invalid values",()=>{
 const raw="3-0-12:09-0000000-0-3-0-0-0";
 const u={time:"13:11",weekdays:[],repeat:false,cleaningMode:3,fanSpeed:0,waterLevel:0,roomIds:[0]};
 assert.equal(updateXiaomiCleaningSchedule(raw,"3",u),"3-0-13:11-0000000-0-3-0-0-0");
 assert.throws(()=>updateXiaomiCleaningSchedule(raw,"3",{...u,time:"25:00"}),/Invalid schedule time/);
 assert.throws(()=>updateXiaomiCleaningSchedule(raw,"3",{...u,weekdays:[1]}),/one-time schedule/);
 assert.throws(()=>updateXiaomiCleaningSchedule(raw,"3",{...u,waterLevel:16}),/Unsupported/);
});

test("maps all five Xiaomi Home cleaning modes", () => {
    const schedules = parseXiaomiCleaningSchedules("1-0-09:00-0000000-0-0-0-0-0;2-0-09:00-0000000-0-1-0-0-0;3-0-09:00-0000000-0-2-0-0-0;4-0-09:00-0000000-0-3-0-0-0;5-0-09:00-0000000-0-4-0-0-0");
    assert.deepEqual(schedules.map(x => x.cleaningModeText), ["Automatische Anpassung", "Nur Saugen", "Saugen und Wischen", "Nur Wischen", "Saugen vor Wischen"]);
});
