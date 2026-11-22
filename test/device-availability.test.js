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

const { ConnectionStats, isInstanceConnected } = require("../build/lib/device-availability.js");

test("instance is connected only if all enabled robots are connected", () => {
    assert.equal(isInstanceConnected({}), false);
    assert.equal(isInstanceConnected({ evePlus: true }), true);
    assert.equal(isInstanceConnected({ evePlus: true, x20Plus: false }), false);
    assert.equal(isInstanceConnected({ evePlus: true, x20Plus: true }), true);
});

const HOUR = 3_600_000;

test("connection stats use rolling 24 h and 7 day windows", () => {
    const now = Date.UTC(2026, 10, 23, 7, 0, 0);          // morning
    const stats = new ConnectionStats({}, now - 10 * 24 * HOUR);
    stats.recordTimeout(now - 9 * 24 * HOUR);              // older than 7 days -> dropped
    stats.recordTimeout(now - 3 * 24 * HOUR);              // within 7 days
    stats.recordTimeout(now - 10 * HOUR);                  // yesterday evening -> within 24 h
    stats.recordFailedPoll(now - 10 * HOUR);
    stats.recordRestart({ startedAt: now - 4 * HOUR, uptimeSeconds: 30 }, now - 4 * HOUR);
    assert.deepEqual(stats.snapshot(now), {
        timeouts24h: 1, timeouts7d: 2,
        failedPolls24h: 1, failedPolls7d: 1,
        restarts24h: 1, restarts7d: 1,
        lastRestart: new Date(now - 4 * HOUR).toISOString()
    });
    const later = stats.snapshot(now + 21 * HOUR);
    assert.equal(later.timeouts24h, 0, "yesterday evening leaves the 24 h window");
    assert.equal(later.timeouts7d, 2);
});

test("connection stats survive an adapter restart via JSON", () => {
    const now = Date.UTC(2026, 10, 23, 7, 0, 0);
    const stats = new ConnectionStats({}, now);
    stats.recordTimeout(now - HOUR);
    stats.recordFailedPoll(now - 2 * HOUR);
    const restored = ConnectionStats.fromJson(stats.toJson(), "2026-11-23T02:42:20.000Z", now);
    const snap = restored.snapshot(now);
    assert.equal(snap.timeouts24h, 1);
    assert.equal(snap.failedPolls24h, 1);
    assert.equal(snap.lastRestart, "2026-11-23T02:42:20.000Z");
    assert.equal(ConnectionStats.fromJson("not json", undefined, now).snapshot(now).timeouts7d, 0);
});
