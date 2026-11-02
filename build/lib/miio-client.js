"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiioClient = void 0;
const node_dgram_1 = require("node:dgram");
const miio_packet_1 = require("./miio-packet");
/** Minimal one-shot local miIO UDP RPC client. Never logs or exposes the token. */
class MiioClient {
    options;
    requestId = 0;
    constructor(options) {
        this.options = options;
    }
    async call(method, params = [], timeoutOverrideMs) {
        if (!method.trim())
            throw new Error("miIO method must not be empty");
        const port = this.options.port ?? 54321;
        const timeoutMs = timeoutOverrideMs ?? this.options.timeoutMs ?? 4000;
        const socket = (0, node_dgram_1.createSocket)("udp4");
        return new Promise((resolve, reject) => {
            let finished = false;
            let handshakeHeader;
            const timer = setTimeout(() => finish(new Error("miIO request timed out")), timeoutMs);
            const finish = (error, result) => {
                if (finished)
                    return;
                finished = true;
                clearTimeout(timer);
                try {
                    socket.close();
                }
                catch { /* socket may already be closed */ }
                if (error)
                    reject(error);
                else
                    resolve(result);
            };
            socket.on("error", (error) => finish(new Error(`miIO UDP error: ${error.message}`)));
            socket.on("message", (message) => {
                try {
                    if (!handshakeHeader) {
                        handshakeHeader = (0, miio_packet_1.parseMiioHeader)(message);
                        if (handshakeHeader.deviceId === 0)
                            throw new Error("Robot returned an invalid device ID");
                        this.requestId = (this.requestId % 9998) + 1;
                        const request = (0, miio_packet_1.buildMiioRequest)(method, params, this.requestId, this.options.token, handshakeHeader);
                        socket.send(request, port, this.options.host, (error) => {
                            if (error)
                                finish(new Error(`Could not send miIO request: ${error.message}`));
                        });
                        return;
                    }
                    const response = (0, miio_packet_1.parseMiioResponse)(message, this.options.token);
                    if (response && typeof response === "object" && response.error) {
                        finish(new Error(`miIO error ${response.error.code ?? "unknown"}: ${response.error.message ?? "request rejected"}`));
                        return;
                    }
                    finish(undefined, response && typeof response === "object" && "result" in response
                        ? response.result
                        : response);
                }
                catch (error) {
                    finish(error instanceof Error ? error : new Error("Could not parse miIO response"));
                }
            });
            const handshake = (0, miio_packet_1.buildHandshakePacket)();
            socket.send(handshake, port, this.options.host, (error) => {
                if (error)
                    finish(new Error(`Could not send miIO handshake: ${error.message}`));
            });
        });
    }
}
exports.MiioClient = MiioClient;
