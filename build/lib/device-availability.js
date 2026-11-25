"use strict";
/**
 * Classifies short outages of a robot so the log names the actual cause.
 *
 * Background: the miIO handshake carries a device stamp that counts seconds since the
 * device's network stack started. If a fresh handshake reports a stamp clearly smaller
 * than the previous stamp plus the elapsed wall-clock time, the device has restarted.
 * Both robots restart on their own from time to time (the X20+ once per night); they
 * are unreachable for about 30 seconds while doing so.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HANDSHAKE_ONLY_MARK = exports.ConnectionStats = exports.STATS_MAX_EVENTS = exports.STATS_RETENTION_MS = exports.OutageReporter = exports.OUTAGE_WARN_AFTER_MS = exports.RESTART_TOLERANCE_SECONDS = void 0;
exports.detectDeviceRestart = detectDeviceRestart;
exports.isInstanceConnected = isInstanceConnected;
exports.answersHandshakeOnly = answersHandshakeOnly;
exports.tokenHint = tokenHint;
/** Allowed deviation between the device clock and the host clock before a restart is assumed. */
exports.RESTART_TOLERANCE_SECONDS = 60;
/**
 * Returns the detected restart when the current stamp is clearly lower than the
 * previous stamp advanced by the elapsed time; otherwise undefined.
 */
function detectDeviceRestart(previous, current, toleranceSeconds = exports.RESTART_TOLERANCE_SECONDS) {
    if (!previous)
        return undefined;
    const elapsedSeconds = Math.max(0, (current.at - previous.at) / 1000);
    const expectedStamp = previous.stamp + elapsedSeconds;
    if (current.stamp >= expectedStamp - toleranceSeconds)
        return undefined;
    return { startedAt: current.at - current.stamp * 1000, uptimeSeconds: current.stamp };
}
function clock(ms) {
    const date = new Date(ms);
    const pad = (value) => String(value).padStart(2, "0");
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
/**
 * Tracks one robot's poll results and decides what to log.
 *
 * - A single failed poll is not logged as a warning right away. The decision is made
 *   at the next poll: if that poll succeeds and the device has restarted, the outage is
 *   reported as info; without a restart it is reported as a warning (as before).
 * - If the next poll fails as well, a warning is logged once for the whole outage, and
 *   recovery is reported as info.
 */
/** Outages shorter than this are logged at debug level only; the statistics still count them. */
exports.OUTAGE_WARN_AFTER_MS = 5 * 60_000;
class OutageReporter {
    deviceName;
    warnAfterMs;
    outage;
    constructor(deviceName, warnAfterMs = exports.OUTAGE_WARN_AFTER_MS) {
        this.deviceName = deviceName;
        this.warnAfterMs = warnAfterMs;
    }
    /** True while an outage is open (at least one failed poll since the last success). */
    get isOutageOpen() {
        return this.outage !== undefined;
    }
    onPollFailed(message, now = Date.now()) {
        if (!this.outage) {
            this.outage = { since: now, firstMessage: message, failedPolls: 1, warned: false };
            return { level: "debug", message: `${this.deviceName} poll failed; waiting before reporting: ${message}` };
        }
        this.outage.failedPolls++;
        if (this.outage.warned)
            return { level: "none" };
        if (now - this.outage.since < this.warnAfterMs) {
            return { level: "debug", message: `${this.deviceName} still unreachable (${this.outage.failedPolls} polls failed): ${message}` };
        }
        this.outage.warned = true;
        return {
            level: "warn",
            message: `${this.deviceName} unreachable since ${clock(this.outage.since)} (${this.outage.failedPolls} polls failed): ${message}`
        };
    }
    onPollSucceeded(restart, now = Date.now()) {
        const outage = this.outage;
        this.outage = undefined;
        const restartText = restart ? `${this.deviceName} restarted at about ${clock(restart.startedAt)}` : "";
        if (!outage) {
            return restart ? { level: "info", message: `${restartText}; no poll was affected` } : { level: "none" };
        }
        const seconds = Math.max(1, Math.round((now - outage.since) / 1000));
        if (restart) {
            return { level: "info", message: `${restartText} and was unreachable for about ${seconds} s; reachable again` };
        }
        if (outage.warned) {
            return { level: "info", message: `${this.deviceName} reachable again after about ${seconds} s` };
        }
        return {
            level: "debug",
            message: `${this.deviceName} reachable again after about ${seconds} s (short outage, no device restart detected): ${outage.firstMessage}`
        };
    }
}
exports.OutageReporter = OutageReporter;
/**
 * The instance is connected when at least one robot is enabled and every enabled
 * robot is reachable. Disabled robots are not part of the map.
 */
function isInstanceConnected(enabledRobots) {
    const values = Object.values(enabledRobots);
    return values.length > 0 && values.every(Boolean);
}
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** Events older than this are discarded. */
exports.STATS_RETENTION_MS = 7 * DAY_MS;
/** Upper bound per event list, protects the persisted JSON during long outages. */
exports.STATS_MAX_EVENTS = 5000;
/**
 * Per-robot connection counters over rolling windows (last 24 hours, last 7 days).
 * A rolling window always covers the evening and night before, whenever it is read.
 * Event timestamps are kept for 7 days and can be persisted as JSON.
 */
class ConnectionStats {
    events;
    lastRestart;
    constructor(seed = {}, now = Date.now()) {
        const clean = (list) => Array.isArray(list) ? list.filter((value) => typeof value === "number" && Number.isFinite(value)) : [];
        this.events = {
            timeouts: clean(seed.events?.timeouts),
            failedPolls: clean(seed.events?.failedPolls),
            restarts: clean(seed.events?.restarts)
        };
        this.lastRestart = seed.lastRestart ?? "";
        this.prune(now);
    }
    /** Parses the persisted JSON; invalid content yields empty lists. */
    static fromJson(json, lastRestart, now = Date.now()) {
        let events;
        if (typeof json === "string" && json) {
            try {
                events = JSON.parse(json);
            }
            catch {
                events = undefined;
            }
        }
        return new ConnectionStats({ events, lastRestart }, now);
    }
    prune(now) {
        const limit = now - exports.STATS_RETENTION_MS;
        for (const key of ["timeouts", "failedPolls", "restarts"]) {
            let list = this.events[key].filter((at) => at > limit);
            if (list.length > exports.STATS_MAX_EVENTS)
                list = list.slice(list.length - exports.STATS_MAX_EVENTS);
            this.events[key] = list;
        }
    }
    /** One request that ran into a timeout (also when the retry succeeded). */
    recordTimeout(now = Date.now()) {
        this.events.timeouts.push(now);
        this.prune(now);
    }
    /** One poll that failed after its retry. */
    recordFailedPoll(now = Date.now()) {
        this.events.failedPolls.push(now);
        this.prune(now);
    }
    recordRestart(restart, now = Date.now()) {
        this.events.restarts.push(restart.startedAt);
        this.lastRestart = new Date(restart.startedAt).toISOString();
        this.prune(now);
    }
    snapshot(now = Date.now()) {
        this.prune(now);
        const count = (list, windowMs) => list.filter((at) => at > now - windowMs).length;
        return {
            timeouts24h: count(this.events.timeouts, DAY_MS),
            timeouts7d: this.events.timeouts.length,
            failedPolls24h: count(this.events.failedPolls, DAY_MS),
            failedPolls7d: this.events.failedPolls.length,
            restarts24h: count(this.events.restarts, DAY_MS),
            restarts7d: this.events.restarts.length,
            lastRestart: this.lastRestart
        };
    }
    toJson() {
        return JSON.stringify(this.events);
    }
}
exports.ConnectionStats = ConnectionStats;
/** Marker appended to a retry error when the device answered the handshake but not the request. */
exports.HANDSHAKE_ONLY_MARK = "device answered the handshake but not the request";
/**
 * True if a miIO trace shows a successful handshake followed by a timeout of the
 * encrypted request. Typical cause besides radio loss: the token changed, e.g.
 * after the robot's WLAN was reconfigured in the vendor app.
 */
function answersHandshakeOnly(trace) {
    return trace.some((line) => line.includes("fresh handshake parsed")) &&
        trace.some((line) => line.includes("timeout while waiting for RPC response"));
}
/** Log hint for persistent handshake-only failures. */
function tokenHint(robot, message, succeededSinceStart) {
    // A wrong token makes every request fail. Once a request has succeeded with the current
    // token (the adapter restarts after a token change), a handshake-only failure is a lost or
    // unanswered packet, not a token problem.
    return !succeededSinceStart && message.includes(exports.HANDSHAKE_ONLY_MARK)
        ? ` – if the robot's WLAN was reconfigured, its token has probably changed: press ${robot}.control.refreshToken`
        : "";
}
