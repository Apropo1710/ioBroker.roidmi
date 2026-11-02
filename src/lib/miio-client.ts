import { createSocket } from "node:dgram";
import { buildHandshakePacket, buildMiioRequest, parseMiioHeader, parseMiioResponse } from "./miio-packet";

export interface MiioClientOptions {
    host: string;
    token: string;
    port?: number;
    timeoutMs?: number;
}

export interface MiioRpcResponse {
    id?: number;
    result?: unknown;
    error?: { code?: number; message?: string };
}

/** Minimal one-shot local miIO UDP RPC client. Never logs or exposes the token. */
export class MiioClient {
    private requestId = 0;

    public constructor(private readonly options: MiioClientOptions) {}

    public async call(method: string, params: unknown[] = [], timeoutOverrideMs?: number): Promise<unknown> {
        if (!method.trim()) throw new Error("miIO method must not be empty");
        const port = this.options.port ?? 54321;
        const timeoutMs = timeoutOverrideMs ?? this.options.timeoutMs ?? 4000;
        const socket = createSocket("udp4");

        return new Promise<unknown>((resolve, reject) => {
            let finished = false;
            let handshakeHeader: ReturnType<typeof parseMiioHeader> | undefined;
            const timer = setTimeout(() => finish(new Error("miIO request timed out")), timeoutMs);

            const finish = (error?: Error, result?: unknown): void => {
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                try { socket.close(); } catch { /* socket may already be closed */ }
                if (error) reject(error);
                else resolve(result);
            };

            socket.on("error", (error) => finish(new Error(`miIO UDP error: ${error.message}`)));
            socket.on("message", (message) => {
                try {
                    if (!handshakeHeader) {
                        handshakeHeader = parseMiioHeader(message);
                        if (handshakeHeader.deviceId === 0) throw new Error("Robot returned an invalid device ID");
                        this.requestId = (this.requestId % 9998) + 1;
                        const request = buildMiioRequest(method, params, this.requestId, this.options.token, handshakeHeader);
                        socket.send(request, port, this.options.host, (error) => {
                            if (error) finish(new Error(`Could not send miIO request: ${error.message}`));
                        });
                        return;
                    }

                    const response = parseMiioResponse(message, this.options.token) as MiioRpcResponse;
                    if (response && typeof response === "object" && response.error) {
                        finish(new Error(`miIO error ${response.error.code ?? "unknown"}: ${response.error.message ?? "request rejected"}`));
                        return;
                    }
                    finish(undefined, response && typeof response === "object" && "result" in response
                        ? response.result
                        : response);
                } catch (error) {
                    finish(error instanceof Error ? error : new Error("Could not parse miIO response"));
                }
            });

            const handshake = buildHandshakePacket();
            socket.send(handshake, port, this.options.host, (error) => {
                if (error) finish(new Error(`Could not send miIO handshake: ${error.message}`));
            });
        });
    }
}
