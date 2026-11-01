import { Adapter } from "@iobroker/adapter-core";
declare class RoidmiAdapter extends Adapter {
    private pollTimer?;
    private stopping;
    private lastPollError;
    private commandRunning;
    private client?;
    private readonly cloudMapClient;
    private roomMapConfig?;
    private readonly lastKnownSettings;
    constructor();
    private onReady;
    private applyRoomMapConfig;
    private onStateChange;
    /**
     * Read the stored schedule JSON only when explicitly requested.
     * This is deliberately excluded from the fast status polling cycle.
     */
    private refreshTiming;
    private onMessage;
    private persistCloudSession;
    private refreshCloudMap;
    private sendProperty;
    private sendAction;
    private onUnload;
}
export default RoidmiAdapter;
