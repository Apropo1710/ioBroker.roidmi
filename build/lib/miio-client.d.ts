export interface MiioClientOptions {
    host: string;
    token: string;
    port?: number;
    timeoutMs?: number;
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
    private requestId;
    constructor(options: MiioClientOptions);
    call(method: string, params?: unknown[], timeoutOverrideMs?: number): Promise<unknown>;
}
