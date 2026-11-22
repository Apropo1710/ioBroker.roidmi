const test = require("node:test");
const assert = require("node:assert/strict");
const { detectDeviceRestart, OutageReporter } = require("../build/lib/device-availability.js");

test("detectDeviceRestart compares the stamp with the elapsed wall-clock time", () => {
    const previous = { stamp: 88000, at: 0 };
    assert.equal(detectDeviceRestart(undefined, { stamp: 10, at: 1000 }), undefined);
    assert.equal(detectDeviceRestart(previous, { stamp: 88030, at: 30_000 }), undefined);
    // small clock drift is tolerated
    assert.equal(detectDeviceRestart(previous, { stamp: 87990, at: 30_000 }), undefined);
    const restart = detectDeviceRestart(previous, { stamp: 55, at: 600_000 });
    assert.deepEqual(restart, { startedAt: 600_000 - 55_000, uptimeSeconds: 55 });
});

test("single failed poll followed by a restart is reported as info, not as warning", () => {
    const reporter = new OutageReporter("Xiaomi X20+");
    const failed = reporter.onPollFailed("retry failed: miIO request timed out", 0);
    assert.equal(failed.level, "debug");
    const ok = reporter.onPollSucceeded({ startedAt: 10_000, uptimeSeconds: 50 }, 60_000);
    assert.equal(ok.level, "info");
    assert.match(ok.message, /restarted/);
    assert.match(ok.message, /60 s/);
});

test("single failed poll without restart is still reported as warning", () => {
    const reporter = new OutageReporter("EVE Plus");
    reporter.onPollFailed("retry failed: miIO request timed out", 0);
    const ok = reporter.onPollSucceeded(undefined, 30_000);
    assert.equal(ok.level, "warn");
    assert.match(ok.message, /no device restart detected/);
    assert.match(ok.message, /retry failed/);
});

test("longer outage warns once and reports recovery as info", () => {
    const reporter = new OutageReporter("EVE Plus");
    assert.equal(reporter.onPollFailed("timeout", 0).level, "debug");
    const second = reporter.onPollFailed("timeout", 60_000);
    assert.equal(second.level, "warn");
    assert.match(second.message, /unreachable since/);
    assert.equal(reporter.onPollFailed("timeout", 180_000).level, "none");
    const ok = reporter.onPollSucceeded(undefined, 900_000);
    assert.equal(ok.level, "info");
    assert.match(ok.message, /reachable again after about 900 s/);
    assert.equal(reporter.isOutageOpen, false);
});

test("restart between two successful polls is reported as info", () => {
    const reporter = new OutageReporter("EVE Plus");
    assert.equal(reporter.onPollSucceeded(undefined, 0).level, "none");
    const ok = reporter.onPollSucceeded({ startedAt: 5_000, uptimeSeconds: 20 }, 25_000);
    assert.equal(ok.level, "info");
    assert.match(ok.message, /no poll was affected/);
});

const { ConnectionStats, isInstanceConnected, localDayKey } = require("../build/lib/device-availability.js");

test("instance is connected only if all enabled robots are connected", () => {
    assert.equal(isInstanceConnected({}), false);
    assert.equal(isInstanceConnected({ evePlus: true }), true);
    assert.equal(isInstanceConnected({ evePlus: true, x20Plus: false }), false);
    assert.equal(isInstanceConnected({ evePlus: true, x20Plus: true }), true);
});

test("connection stats count per local day and reset at midnight", () => {
    const morning = new Date(2026, 10, 22, 8, 0, 0).getTime();
    const evening = new Date(2026, 10, 22, 22, 0, 0).getTime();
    const nextDay = new Date(2026, 10, 23, 0, 5, 0).getTime();
    const stats = new ConnectionStats({}, morning);
    stats.recordTimeout(morning);
    stats.recordTimeout(evening);
    stats.recordFailedPoll(evening);
    stats.recordRestart({ startedAt: evening - 30_000, uptimeSeconds: 30 }, evening);
    assert.deepEqual(stats.snapshot(evening), {
        timeoutsToday: 2, failedPollsToday: 1, restartsToday: 1,
        lastRestart: new Date(evening - 30_000).toISOString()
    });
    const after = stats.snapshot(nextDay);
    assert.equal(after.timeoutsToday, 0);
    assert.equal(after.restartsToday, 0);
    assert.equal(after.lastRestart, new Date(evening - 30_000).toISOString(), "last restart survives midnight");
});

test("connection stats keep same-day seed values after an adapter restart", () => {
    const now = new Date(2026, 10, 22, 12, 0, 0).getTime();
    const yesterday = new Date(2026, 10, 21, 23, 0, 0).getTime();
    const stats = new ConnectionStats({
        timeoutsToday: { value: 4, at: now - 3_600_000 },
        failedPollsToday: { value: 7, at: yesterday },
        restartsToday: { value: 1, at: now - 60_000 },
        lastRestart: "2026-11-22T02:42:20.000Z"
    }, now);
    const snap = stats.snapshot(now);
    assert.equal(snap.timeoutsToday, 4);
    assert.equal(snap.failedPollsToday, 0, "value from another day is not taken over");
    assert.equal(snap.restartsToday, 1);
    assert.equal(localDayKey(now), "2026-11-22");
});
