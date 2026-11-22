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
