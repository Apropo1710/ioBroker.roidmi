/**
 * Classifies short outages of a robot so the log names the actual cause.
 *
 * Background: the miIO handshake carries a device stamp that counts seconds since the
 * device's network stack started. If a fresh handshake reports a stamp clearly smaller
 * than the previous stamp plus the elapsed wall-clock time, the device has restarted.
 * Both robots restart on their own from time to time (the X20+ once per night); they
 * are unreachable for about 30 seconds while doing so.
 */

export interface StampObservation {
    /** Device stamp from a fresh handshake (seconds since device start). */
    stamp: number;
    /** Wall-clock time of the observation in milliseconds. */
    at: number;
}

export interface DeviceRestart {
    /** Estimated wall-clock time of the device start in milliseconds. */
    startedAt: number;
    /** Device uptime at the time of detection in seconds. */
    uptimeSeconds: number;
}

/** Allowed deviation between the device clock and the host clock before a restart is assumed. */
export const RESTART_TOLERANCE_SECONDS = 60;

/**
 * Returns the detected restart when the current stamp is clearly lower than the
 * previous stamp advanced by the elapsed time; otherwise undefined.
 */
export function detectDeviceRestart(
    previous: StampObservation | undefined,
    current: StampObservation,
    toleranceSeconds = RESTART_TOLERANCE_SECONDS
): DeviceRestart | undefined {
    if (!previous) return undefined;
    const elapsedSeconds = Math.max(0, (current.at - previous.at) / 1000);
    const expectedStamp = previous.stamp + elapsedSeconds;
    if (current.stamp >= expectedStamp - toleranceSeconds) return undefined;
    return { startedAt: current.at - current.stamp * 1000, uptimeSeconds: current.stamp };
}

export type AvailabilityEvent =
    | { level: "none" }
    | { level: "debug" | "info" | "warn"; message: string };

function clock(ms: number): string {
    const date = new Date(ms);
    const pad = (value: number): string => String(value).padStart(2, "0");
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
export class OutageReporter {
    private outage?: { since: number; firstMessage: string; failedPolls: number; warned: boolean };

    public constructor(private readonly deviceName: string) {}

    /** True while an outage is open (at least one failed poll since the last success). */
    public get isOutageOpen(): boolean {
        return this.outage !== undefined;
    }

    public onPollFailed(message: string, now = Date.now()): AvailabilityEvent {
        if (!this.outage) {
            this.outage = { since: now, firstMessage: message, failedPolls: 1, warned: false };
            return { level: "debug", message: `${this.deviceName} poll failed; waiting for the next poll before reporting: ${message}` };
        }
        this.outage.failedPolls++;
        if (this.outage.warned) return { level: "none" };
        this.outage.warned = true;
        return {
            level: "warn",
            message: `${this.deviceName} unreachable since ${clock(this.outage.since)} (${this.outage.failedPolls} polls failed): ${message}`
        };
    }

    public onPollSucceeded(restart: DeviceRestart | undefined, now = Date.now()): AvailabilityEvent {
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

/** Local calendar day (host time zone) as YYYY-MM-DD. */
export function localDayKey(ms: number): string {
    const date = new Date(ms);
    const pad = (value: number): string => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The instance is connected when at least one robot is enabled and every enabled
 * robot is reachable. Disabled robots are not part of the map.
 */
export function isInstanceConnected(enabledRobots: Record<string, boolean>): boolean {
    const values = Object.values(enabledRobots);
    return values.length > 0 && values.every(Boolean);
}

export interface ConnectionStatsSnapshot {
    timeoutsToday: number;
    failedPollsToday: number;
    restartsToday: number;
    lastRestart: string;
}

export interface ConnectionStatsSeed {
    timeoutsToday?: { value: number; at: number };
    failedPollsToday?: { value: number; at: number };
    restartsToday?: { value: number; at: number };
    lastRestart?: string;
}

/**
 * Per-robot daily counters for connection quality. Counters reset at local midnight.
 * Seed values are taken over only if they were written on the same local day,
 * so an adapter restart during the day keeps the counts.
 */
export class ConnectionStats {
    private day: string;
    private timeouts: number;
    private failedPolls: number;
    private restarts: number;
    private lastRestart: string;

    public constructor(seed: ConnectionStatsSeed = {}, now = Date.now()) {
        this.day = localDayKey(now);
        const sameDay = (entry?: { value: number; at: number }): number =>
            entry && localDayKey(entry.at) === this.day && Number.isFinite(entry.value) ? entry.value : 0;
        this.timeouts = sameDay(seed.timeoutsToday);
        this.failedPolls = sameDay(seed.failedPollsToday);
        this.restarts = sameDay(seed.restartsToday);
        this.lastRestart = seed.lastRestart ?? "";
    }

    private roll(now: number): void {
        const day = localDayKey(now);
        if (day === this.day) return;
        this.day = day;
        this.timeouts = 0;
        this.failedPolls = 0;
        this.restarts = 0;
    }

    /** One request that ran into a timeout (also when the retry succeeded). */
    public recordTimeout(now = Date.now()): void {
        this.roll(now);
        this.timeouts++;
    }

    /** One poll that failed after its retry. */
    public recordFailedPoll(now = Date.now()): void {
        this.roll(now);
        this.failedPolls++;
    }

    public recordRestart(restart: DeviceRestart, now = Date.now()): void {
        this.roll(now);
        this.restarts++;
        this.lastRestart = new Date(restart.startedAt).toISOString();
    }

    public snapshot(now = Date.now()): ConnectionStatsSnapshot {
        this.roll(now);
        return {
            timeoutsToday: this.timeouts,
            failedPollsToday: this.failedPolls,
            restartsToday: this.restarts,
            lastRestart: this.lastRestart
        };
    }
}
