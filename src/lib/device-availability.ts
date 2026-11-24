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

/**
 * The instance is connected when at least one robot is enabled and every enabled
 * robot is reachable. Disabled robots are not part of the map.
 */
export function isInstanceConnected(enabledRobots: Record<string, boolean>): boolean {
    const values = Object.values(enabledRobots);
    return values.length > 0 && values.every(Boolean);
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** Events older than this are discarded. */
export const STATS_RETENTION_MS = 7 * DAY_MS;
/** Upper bound per event list, protects the persisted JSON during long outages. */
export const STATS_MAX_EVENTS = 5000;

export interface ConnectionStatsSnapshot {
    timeouts24h: number;
    timeouts7d: number;
    failedPolls24h: number;
    failedPolls7d: number;
    restarts24h: number;
    restarts7d: number;
    lastRestart: string;
}

export interface ConnectionStatsEvents {
    timeouts: number[];
    failedPolls: number[];
    restarts: number[];
}

/**
 * Per-robot connection counters over rolling windows (last 24 hours, last 7 days).
 * A rolling window always covers the evening and night before, whenever it is read.
 * Event timestamps are kept for 7 days and can be persisted as JSON.
 */
export class ConnectionStats {
    private readonly events: ConnectionStatsEvents;
    private lastRestart: string;

    public constructor(seed: { events?: Partial<ConnectionStatsEvents>; lastRestart?: string } = {}, now = Date.now()) {
        const clean = (list?: unknown): number[] =>
            Array.isArray(list) ? list.filter((value): value is number => typeof value === "number" && Number.isFinite(value)) : [];
        this.events = {
            timeouts: clean(seed.events?.timeouts),
            failedPolls: clean(seed.events?.failedPolls),
            restarts: clean(seed.events?.restarts)
        };
        this.lastRestart = seed.lastRestart ?? "";
        this.prune(now);
    }

    /** Parses the persisted JSON; invalid content yields empty lists. */
    public static fromJson(json: unknown, lastRestart?: string, now = Date.now()): ConnectionStats {
        let events: Partial<ConnectionStatsEvents> | undefined;
        if (typeof json === "string" && json) {
            try { events = JSON.parse(json) as Partial<ConnectionStatsEvents>; } catch { events = undefined; }
        }
        return new ConnectionStats({ events, lastRestart }, now);
    }

    private prune(now: number): void {
        const limit = now - STATS_RETENTION_MS;
        for (const key of ["timeouts", "failedPolls", "restarts"] as const) {
            let list = this.events[key].filter((at) => at > limit);
            if (list.length > STATS_MAX_EVENTS) list = list.slice(list.length - STATS_MAX_EVENTS);
            this.events[key] = list;
        }
    }

    /** One request that ran into a timeout (also when the retry succeeded). */
    public recordTimeout(now = Date.now()): void {
        this.events.timeouts.push(now);
        this.prune(now);
    }

    /** One poll that failed after its retry. */
    public recordFailedPoll(now = Date.now()): void {
        this.events.failedPolls.push(now);
        this.prune(now);
    }

    public recordRestart(restart: DeviceRestart, now = Date.now()): void {
        this.events.restarts.push(restart.startedAt);
        this.lastRestart = new Date(restart.startedAt).toISOString();
        this.prune(now);
    }

    public snapshot(now = Date.now()): ConnectionStatsSnapshot {
        this.prune(now);
        const count = (list: number[], windowMs: number): number => list.filter((at) => at > now - windowMs).length;
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

    public toJson(): string {
        return JSON.stringify(this.events);
    }
}

/** Marker appended to a retry error when the device answered the handshake but not the request. */
export const HANDSHAKE_ONLY_MARK = "device answered the handshake but not the request";

/**
 * True if a miIO trace shows a successful handshake followed by a timeout of the
 * encrypted request. Typical cause besides radio loss: the token changed, e.g.
 * after the robot's WLAN was reconfigured in the vendor app.
 */
export function answersHandshakeOnly(trace: readonly string[]): boolean {
    return trace.some((line) => line.includes("fresh handshake parsed")) &&
        trace.some((line) => line.includes("timeout while waiting for RPC response"));
}

/** Log hint for persistent handshake-only failures. */
export function tokenHint(robot: "evePlus" | "x20Plus", message: string, succeededSinceStart: boolean): string {
    // A wrong token makes every request fail. Once a request has succeeded with the current
    // token (the adapter restarts after a token change), a handshake-only failure is a lost or
    // unanswered packet, not a token problem.
    return !succeededSinceStart && message.includes(HANDSHAKE_ONLY_MARK)
        ? ` – if the robot's WLAN was reconfigured, its token has probably changed: press ${robot}.control.refreshToken`
        : "";
}
