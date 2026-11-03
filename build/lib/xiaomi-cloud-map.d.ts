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
