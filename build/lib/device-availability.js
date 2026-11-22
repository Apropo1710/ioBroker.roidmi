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
exports.OutageReporter = exports.RESTART_TOLERANCE_SECONDS = void 0;
exports.detectDeviceRestart = detectDeviceRestart;
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
class OutageReporter {
    deviceName;
    outage;
    constructor(deviceName) {
        this.deviceName = deviceName;
    }
    /** True while an outage is open (at least one failed poll since the last success). */
    get isOutageOpen() {
        return this.outage !== undefined;
    }
    onPollFailed(message, now = Date.now()) {
        if (!this.outage) {
            this.outage = { since: now, firstMessage: message, failedPolls: 1, warned: false };
            return { level: "debug", message: `${this.deviceName} poll failed; waiting for the next poll before reporting: ${message}` };
        }
        this.outage.failedPolls++;
        if (this.outage.warned)
            return { level: "none" };
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
            level: "warn",
            message: `${this.deviceName} poll failed, reachable again after about ${seconds} s (no device restart detected): ${outage.firstMessage}`
        };
    }
}
exports.OutageReporter = OutageReporter;
