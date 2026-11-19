import { RoidmiMapMetadata } from "./roidmi-map";
export interface XiaomiCloudMapOptions {
    username: string;
    password: string;
    country: string;
    token: string;
    mapName: string;
}
export interface XiaomiCloudMapResult {
    metadata: RoidmiMapMetadata;
    mapName: string;
    deviceId: string;
    userId: string;
}
export interface XiaomiCloudAction {
    did: string;
    siid: number;
    aiid: number;
    in?: unknown[];
}
export interface XiaomiCloudPropertyWrite {
    siid: number;
    piid: number;
    value: unknown;
}
export declare class XiaomiCloudMapClient {
    private readonly cookies;
    private ssecurity;
    private userId;
    private serviceToken;
    private cUserId;
    private passToken;
    private pendingFlag;
    private pendingTrust;
    private maskedDestination;
    private readonly agent;
    hasSession(): boolean;
    exportSession(): string;
    restoreSession(serialized: string): void;
    clearSession(): void;
    callAction(country: string, action: XiaomiCloudAction, onSessionChanged?: () => Promise<void>): Promise<unknown>;
    /** Read MIoT properties through Xiaomi Cloud on explicit request (never part of polling). */
    getProperties(country: string, did: string, properties: Array<{
        siid: number;
        piid: number;
    }>, onSessionChanged?: () => Promise<void>, datasource?: 1 | 2): Promise<unknown>;
    /** Write MIoT properties through Xiaomi Cloud on explicit user request (never part of polling). */
    setProperties(country: string, did: string, properties: XiaomiCloudPropertyWrite[], onSessionChanged?: () => Promise<void>): Promise<unknown>;
    /** Read the newest live map-history frame (MIoT property 6.1), on explicit request only. */
    fetchXiaomiLiveRoomSelection(country: string, did: string, onSessionChanged?: () => Promise<void>): Promise<{
        timestamp: number;
        segmentIds: number[];
    }>;
    /** Fetch the C102GL saved room map from Xiaomi FDS. This is explicit/manual and never part of polling. */
    fetchXiaomiRooms(country: string, did: string, onSessionChanged?: () => Promise<void>): Promise<Array<{
        segmentId: number;
        name: string;
        roomId?: string;
    }>>;
    fetchMap(o: XiaomiCloudMapOptions, verificationCode?: string, onProgress?: (message: string) => void, onSessionChanged?: () => Promise<void>): Promise<XiaomiCloudMapResult>;
    private identityCookie;
    private startTwoFactor;
    private finishLogin;
    /**
     * Xiaomi serviceToken is not permanent. Renew it using the long-lived
     * account passToken before falling back to a password/2FA login.
     * This is the same flow used by current Xiaomi cloud integrations.
     */
    private renewSessionWithPassToken;
    private api;
    private request;
    private json;
}
