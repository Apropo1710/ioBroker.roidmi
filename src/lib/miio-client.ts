import { createSocket } from "node:dgram";
import { buildHandshakePacket, buildMiioRequest, parseMiioHeader, parseMiioResponse } from "./miio-packet";

export interface MiioClientOptions {
    host: string;
    token: string;
    port?: number;
    timeoutMs?: number;
    debug?: boolean;
    onDebug?: (message: string) => void;
}

export interface MiioRpcResponse {
    id?: number;
    result?: unknown;
    error?: { code?: number; message?: string };
}

/** Minimal one-shot local miIO UDP RPC client. Never logs or exposes the token. */
export class MiioClient {
    // Serialize local miIO transactions across both robots. Some vacuum firmware
    // drops RPC replies when requests from multiple clients overlap.
    private static requestQueue: Promise<void> = Promise.resolve();
    private requestId = 0;
    private lastSuccessfulRpcAt?: number;

    public constructor(private readonly options: MiioClientOptions) {}

    public async call(method: string, params: unknown[] = [], timeoutOverrideMs?: number): Promise<unknown> {
        const previous = MiioClient.requestQueue;
        let release!: () => void;
        MiioClient.requestQueue = new Promise<void>((resolve) => { release = resolve; });
        await previous;
        try {
            return await this.callUnlocked(method, params, timeoutOverrideMs);
        } finally {
            release();
        }
    }

    private async callUnlocked(method: string, params: unknown[] = [], timeoutOverrideMs?: number): Promise<unknown> {
        if (!method.trim()) throw new Error("miIO method must not be empty");
        const port = this.options.port ?? 54321;
        const timeoutMs = timeoutOverrideMs ?? this.options.timeoutMs ?? 4000;
        const socket = createSocket("udp4");
        const startedAt = Date.now();
        const debug = (message: string): void => { this.options.onDebug?.(`${method}: +${Date.now() - startedAt}ms ${message}`); };
        let stage = "handshake";
        const sinceLastSuccess = this.lastSuccessfulRpcAt === undefined ? "no previous successful RPC" : `${Date.now() - this.lastSuccessfulRpcAt}ms since last successful RPC`;
        debug(`starting RPC to ${this.options.host}:${port} (timeout ${timeoutMs}ms; ${sinceLastSuccess})`);

        return new Promise<unknown>((resolve, reject) => {
            let finished = false;
            let handshakeHeader: ReturnType<typeof parseMiioHeader> | undefined;
            let expectedRequestId: number | undefined;
            let expectedDeviceId: number | undefined;
            let timer: ReturnType<typeof setTimeout> | undefined;
            const armStageTimeout = (): void => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    debug(`timeout while waiting for ${stage}`);
                    finish(new Error("miIO request timed out"));
                }, timeoutMs);
            };
            armStageTimeout();

            const finish = (error?: Error, result?: unknown): void => {
                if (finished) return;
                finished = true;
                if (timer) clearTimeout(timer);
                try { socket.close(); } catch { /* socket may already be closed */ }
                if (error) reject(error);
                else resolve(result);
            };

            socket.on("error", (error) => { debug(`UDP socket error: ${error.message}`); finish(new Error(`miIO UDP error: ${error.message}`)); });
            socket.on("message", (message, remoteInfo) => {
                try {
                    if (remoteInfo.address !== this.options.host) {
                        debug(`ignored UDP packet from unexpected address ${remoteInfo.address}`);
                        return;
                    }
                    if (!handshakeHeader) {
                        debug(`received handshake packet (${message.length} bytes)`);
                        handshakeHeader = parseMiioHeader(message);
                        // Give the RPC response its own full timeout window. A slow
                        // handshake must not consume the robot's RPC response time.
                        stage = "RPC response";
                        armStageTimeout();
                        // The device stamp uses the robot's own clock domain and
                        // must not be compared directly with the host Unix epoch.
                        debug(`handshake parsed; device ID ${handshakeHeader.deviceId}; device stamp ${handshakeHeader.stamp}`);
                        if (handshakeHeader.deviceId === 0) throw new Error("Robot returned an invalid device ID");
                        this.requestId = (this.requestId % 9998) + 1;
                        expectedRequestId = this.requestId;
                        expectedDeviceId = handshakeHeader.deviceId;
                        const request = buildMiioRequest(method, params, expectedRequestId, this.options.token, handshakeHeader);
                        debug(`sending RPC packet (${request.length} bytes; request ID ${expectedRequestId}; request stamp ${request.readUInt32BE(12)})`);
                        socket.send(request, port, this.options.host, (error) => {
                            if (error) { debug(`RPC send failed: ${error.message}`); finish(new Error(`Could not send miIO request: ${error.message}`)); }
                            else debug("RPC packet sent successfully");
                        });
                        return;
                    }

                    debug(`received RPC response packet (${message.length} bytes) from ${remoteInfo.address}`);
                    const responseHeader = parseMiioHeader(message);
                    if (expectedRequestId === undefined || expectedDeviceId === undefined) {
                        throw new Error("miIO response received before request initialization");
                    }
                    if (responseHeader.deviceId !== expectedDeviceId) {
                        debug(`ignored RPC response with unexpected device ID ${responseHeader.deviceId}; expected ${expectedDeviceId}`);
                        return;
                    }
                    const response = parseMiioResponse(message, this.options.token) as MiioRpcResponse;
                    if (!response || typeof response !== "object" || typeof response.id !== "number") {
                        throw new Error("miIO response did not contain a numeric request ID");
                    }
                    if (response.id !== expectedRequestId) {
                        debug(`ignored RPC response with unexpected request ID ${response.id}; expected ${expectedRequestId}`);
                        return;
                    }
                    debug("RPC response parsed successfully");
                    if (response && typeof response === "object" && response.error) {
                        debug(`RPC returned error code ${response.error.code ?? "unknown"}`);
                        finish(new Error(`miIO error ${response.error.code ?? "unknown"}: ${response.error.message ?? "request rejected"}`));
                        return;
                    }
                    debug("RPC completed successfully");
                    this.lastSuccessfulRpcAt = Date.now();
                    finish(undefined, response && typeof response === "object" && "result" in response
                        ? response.result
                        : response);
                } catch (error) {
                    debug(`packet processing failed: ${error instanceof Error ? error.message : "unknown error"}`);
                    finish(error instanceof Error ? error : new Error("Could not parse miIO response"));
                }
            });

            const handshake = buildHandshakePacket();
            debug(`sending handshake packet (${handshake.length} bytes)`);
            socket.send(handshake, port, this.options.host, (error) => {
                if (error) { debug(`handshake send failed: ${error.message}`); finish(new Error(`Could not send miIO handshake: ${error.message}`)); }
                else debug("handshake packet sent successfully");
            });
        });
    }
}
