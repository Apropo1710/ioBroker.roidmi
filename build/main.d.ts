import { Adapter } from "@iobroker/adapter-core";
declare class RoidmiAdapter extends Adapter {
    private pollTimer?;
    private stopping;
    private lastPollError;
    private commandRunning;
    private cloudLoginRunning;
    private client?;
    private readonly cloudMapClient;
    private roomMapConfig?;
    private readonly lastKnownSettings;
    constructor();
    private onReady;
    private applyRoomMapConfig;
    /** Publish room profile values from the Xiaomi map archive. This is only called during explicit cloud map refresh. */
    private applyRoomProfiles;
    private onStateChange;
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
    private onUnload;
}
export default RoidmiAdapter;
