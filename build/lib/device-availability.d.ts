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
export declare const RESTART_TOLERANCE_SECONDS = 60;
/**
 * Returns the detected restart when the current stamp is clearly lower than the
 * previous stamp advanced by the elapsed time; otherwise undefined.
 */
export declare function detectDeviceRestart(previous: StampObservation | undefined, current: StampObservation, toleranceSeconds?: number): DeviceRestart | undefined;
export type AvailabilityEvent = {
    level: "none";
} | {
    level: "debug" | "info" | "warn";
    message: string;
};
/**
 * Tracks one robot's poll results and decides what to log.
 *
 * - A single failed poll is not logged as a warning right away. The decision is made
 *   at the next poll: if that poll succeeds and the device has restarted, the outage is
 *   reported as info; without a restart it is reported as a warning (as before).
 * - If the next poll fails as well, a warning is logged once for the whole outage, and
 *   recovery is reported as info.
 */
export declare class OutageReporter {
    private readonly deviceName;
    private outage?;
    constructor(deviceName: string);
    /** True while an outage is open (at least one failed poll since the last success). */
    get isOutageOpen(): boolean;
    onPollFailed(message: string, now?: number): AvailabilityEvent;
    onPollSucceeded(restart: DeviceRestart | undefined, now?: number): AvailabilityEvent;
}
/**
 * The instance is connected when at least one robot is enabled and every enabled
 * robot is reachable. Disabled robots are not part of the map.
 */
export declare function isInstanceConnected(enabledRobots: Record<string, boolean>): boolean;
/** Events older than this are discarded. */
export declare const STATS_RETENTION_MS: number;
/** Upper bound per event list, protects the persisted JSON during long outages. */
export declare const STATS_MAX_EVENTS = 5000;
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
export declare class ConnectionStats {
    private readonly events;
    private lastRestart;
    constructor(seed?: {
        events?: Partial<ConnectionStatsEvents>;
        lastRestart?: string;
    }, now?: number);
    /** Parses the persisted JSON; invalid content yields empty lists. */
    static fromJson(json: unknown, lastRestart?: string, now?: number): ConnectionStats;
    private prune;
    /** One request that ran into a timeout (also when the retry succeeded). */
    recordTimeout(now?: number): void;
    /** One poll that failed after its retry. */
    recordFailedPoll(now?: number): void;
    recordRestart(restart: DeviceRestart, now?: number): void;
    snapshot(now?: number): ConnectionStatsSnapshot;
    toJson(): string;
}
