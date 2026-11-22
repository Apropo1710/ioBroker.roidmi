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
