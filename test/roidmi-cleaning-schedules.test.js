const test = require("node:test");
const assert = require("node:assert/strict");
const {
    areRoidmiScheduleSnapshotsEqual,
    updateRoidmiCleaningSchedule,
    verifyRoidmiCleaningScheduleUpdate
} = require("../build/lib/roidmi-cleaning-schedules.js");

const raw = JSON.stringify({
    time: [
        [35280, 0, 2, 0, [1, 2, 3, 4, 5, 6, 0], 0, [1], 0],
        [17700, 0, 3, 2, [1, 2, 3, 4, 5], 3, [3], 0]
    ],
    tz: 1,
    tzs: 3600,
    futureField: { keep: true }
});

test("updates only selected EVE Plus schedule fields and preserves unknown data", () => {
    const updated = JSON.parse(updateRoidmiCleaningSchedule(raw, 1, {
        timeSeconds: 18000,
        enabled: true,
        weekdays: [1, 3, 5]
    }));
    assert.deepEqual(updated.time[0], JSON.parse(raw).time[0]);
    assert.deepEqual(updated.time[1], [18000, 1, 3, 2, [1, 3, 5], 3, [3], 0]);
    assert.equal(updated.tz, 1);
    assert.equal(updated.tzs, 3600);
    assert.deepEqual(updated.futureField, { keep: true });
});

test("leaves all unselected entry fields and trailing values untouched", () => {
    const source = JSON.stringify({ time: [[3600, 0, 2, 7, [1], 0, [4], 99, "future"]], tz: 2 });
    const updated = JSON.parse(updateRoidmiCleaningSchedule(source, 0, { fanSpeed: 4 }));
    assert.deepEqual(updated.time[0], [3600, 0, 4, 7, [1], 0, [4], 99, "future"]);
    assert.equal(updated.tz, 2);
});

test("accepts semantic snapshot equality despite whitespace and object key order", () => {
    assert.equal(areRoidmiScheduleSnapshotsEqual('{"time":[],"tz":1}', '{ "tz": 1, "time": [] }'), true);
});

test("verifies exact requested changes and rejects unrelated changes", () => {
    const updated = updateRoidmiCleaningSchedule(raw, 0, { waterLevel: 2 });
    assert.equal(verifyRoidmiCleaningScheduleUpdate(raw, updated, 0, { waterLevel: 2 }), true);
    const altered = JSON.parse(updated);
    altered.time[1][0] = 1;
    assert.equal(verifyRoidmiCleaningScheduleUpdate(raw, JSON.stringify(altered), 0, { waterLevel: 2 }), false);
});

test("rejects invalid indexes, empty updates and unsafe field values", () => {
    assert.throws(() => updateRoidmiCleaningSchedule(raw, -1, { fanSpeed: 2 }), /index/);
    assert.throws(() => updateRoidmiCleaningSchedule(raw, 0, {}), /no fields/);
    assert.throws(() => updateRoidmiCleaningSchedule(raw, 0, { timeSeconds: 86400 }), /timeSeconds/);
    assert.throws(() => updateRoidmiCleaningSchedule(raw, 0, { weekdays: [1, 1] }), /weekdays/);
    assert.throws(() => updateRoidmiCleaningSchedule(raw, 0, { roomIds: [] }), /roomIds/);
    assert.throws(() => updateRoidmiCleaningSchedule('[]', 0, { fanSpeed: 2 }), /root/);
});
