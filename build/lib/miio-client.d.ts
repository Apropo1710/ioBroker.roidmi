import { type DeviceRestart } from "./device-availability";
export interface MiioClientOptions {
    host: string;
    token: string;
    port?: number;
    timeoutMs?: number;
    debug?: boolean;
    onDebug?: (message: string) => void;
    /** Experimental: reuse the last device handshake and extrapolate its clock. */
    reuseHandshake?: boolean;
}
export interface MiioRpcResponse {
    id?: number;
    result?: unknown;
    error?: {
        code?: number;
        message?: string;
    };
}
/** Minimal one-shot local miIO UDP RPC client. Never logs or exposes the token. */
export declare class MiioClient {
    private readonly options;
    private static requestQueue;
    private requestId;
    private lastSuccessfulRpcAt?;
    private cachedHandshake?;
    private lastStampObservation?;
    private detectedRestart?;
    constructor(options: MiioClientOptions);
    /**
     * Returns and clears the device restart detected from fresh handshakes since the
     * last call. Uses no extra requests; it only compares handshake stamps.
     */
    consumeDetectedRestart(): DeviceRestart | undefined;
    private observeHandshakeStamp;
    call(method: string, params?: unknown, timeoutOverrideMs?: number, forceFreshHandshake?: boolean): Promise<unknown>;
    private callUnlocked;
}
