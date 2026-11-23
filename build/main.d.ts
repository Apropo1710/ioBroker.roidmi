import { Adapter } from "@iobroker/adapter-core";
declare class RoidmiAdapter extends Adapter {
    private pollTimer?;
    private timingTimer?;
    private xiaomiPollTimer?;
    private xiaomiScheduleTimer?;
    private xiaomiPollRunning;
    private xiaomiCommandRunning;
    private xiaomiClient?;
    private xiaomiRoomCleanTracker?;
    private readonly xiaomiMiioTrace;
    private stopping;
    private lastPollError;
    private commandRunning;
    private cloudLoginRunning;
    private client?;
    private readonly cloudMapClient;
    private roomMapConfig?;
    private readonly lastKnownSettings;
    /** Connection state of the enabled robots; disabled robots are not listed. */
    private readonly enabledRobotConnection;
    constructor();
    private onReady;
    /**
     * Move the original single-Roidmi object tree and the first Xiaomi tree into
     * the per-device folders. Values and object metadata are retained. This runs
     * once naturally: only legacy paths are considered, never the new folders.
     */
    private migrateLegacyStateTree;
    /**
     * Independent read-only Xiaomi X20+ status poller. It has its own client,
     * connection states and timer so a Xiaomi failure cannot affect Roidmi.
     */
    private startXiaomiPolling;
    private applyRoomMapConfig;
    /** Publish room profile values from the Xiaomi map archive. This is only called during explicit cloud map refresh. */
    private applyRoomProfiles;
    private onStateChange;
    /**
     * Updates one existing EVE Plus schedule on explicit request only.
     * The caller must provide the snapshot shown in the UI; a fresh device read
     * is compared before writing to avoid overwriting a concurrent app change.
     */
    private updateTimingSchedule;
    /**
     * Read the stored schedule JSON only when explicitly requested.
     * This is deliberately excluded from the fast status polling cycle.
     */
    private refreshTiming;
    private onMessage;
    private persistCloudSession;
    private clearPersistedCloudSession;
    private refreshCloudMap;
    private sendProperty;
    private sendAction;
    private createTokenRefreshObjects;
    /**
     * Reads the robot's current miIO token from the Xiaomi Cloud device list (matched by DID)
     * and stores it encrypted in the instance configuration. Changing the configuration makes
     * js-controller restart the adapter, which then uses the new token. The token is never logged.
     */
    private refreshTokenFromCloud;
    private setRobotConnection;
    private static readonly CONNECTION_STATS_OBJECTS;
    private createConnectionStatsObjects;
    private loadConnectionStats;
    private writeConnectionStats;
    private logAvailability;
    private onUnload;
}
export default RoidmiAdapter;
