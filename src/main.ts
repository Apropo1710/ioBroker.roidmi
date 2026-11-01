import { Adapter } from "@iobroker/adapter-core";
import { MiioClient } from "./lib/miio-client";

interface RoidmiAdapterConfig {
    host?: string;
    did?: string;
    token?: string;
    pollIntervalSeconds?: number;
}

interface MiotAction {
    siid: number;
    aiid: number;
    in?: unknown[];
}

class RoidmiAdapter extends Adapter {
    private pollTimer?: NodeJS.Timeout;
    private stopping = false;
    private lastPollError = "";
    private commandRunning = false;
    private client?: MiioClient;

    public constructor() {
        super({ name: "roidmi" });
        this.on("ready", () => void this.onReady());
        this.on("stateChange", (id, state) => void this.onStateChange(id, state));
        this.on("unload", (callback) => this.onUnload(callback));
    }

    private async onReady(): Promise<void> {
        await this.setObjectNotExistsAsync("info.connection", {
            type: "state",
            common: { name: "Device connection", type: "boolean", role: "indicator.reachable", read: true, write: false },
            native: {}
        });
        await this.setObjectNotExistsAsync("info.connectionText", {
            type: "state",
            common: { name: "Connection status", type: "string", role: "text", read: true, write: false },
            native: {}
        });

        const config = this.config as RoidmiAdapterConfig;
        const errors: string[] = [];
        if (config.host && !/^(?:\\d{1,3}\\.){3}\\d{1,3}$/.test(config.host)) errors.push("The configured host is not a valid IPv4 address.");
        if (config.did && !/^\\d{1,20}$/.test(config.did)) errors.push("The Xiaomi device DID must be numeric.");
        if (config.pollIntervalSeconds !== undefined &&
            (!Number.isInteger(config.pollIntervalSeconds) || config.pollIntervalSeconds < 5 || config.pollIntervalSeconds > 3600)) {
            errors.push("Polling interval must be between 5 and 3600 seconds.");
        }

        await this.setStateChangedAsync("info.connection", { val: false, ack: true });
        if (errors.length) {
            const message = errors.join(" ");
            await this.setStateChangedAsync("info.connectionText", { val: message, ack: true });
            this.log.error(message);
            return;
        }
        if (!config.host || !config.did || !config.token) {
            const message = "Configuration incomplete: enter robot IP, numeric Xiaomi device DID and MIoT/miIO token.";
            await this.setStateChangedAsync("info.connectionText", { val: message, ack: true });
            this.log.info(message);
            return;
        }

        this.client = new MiioClient({ host: config.host, token: config.token });

        const properties = [
            { id: "battery", siid: 3, piid: 1, name: "Battery level", unit: "%" },
            { id: "charging", siid: 3, piid: 2, name: "Charging state" },
            { id: "state", siid: 2, piid: 1, name: "Vacuum state" },
            { id: "errorCode", siid: 2, piid: 2, name: "Error code" }
        ] as const;

        for (const property of properties) {
            await this.setObjectNotExistsAsync(property.id, {
                type: "state",
                common: {
                    name: property.name, type: "number", role: "value",
                    ...("unit" in property ? { unit: property.unit } : {}),
                    read: true, write: false
                },
                native: { siid: property.siid, piid: property.piid }
            });
        }

        const controls = [
            { id: "start", name: "Start full cleaning" },
            { id: "pause", name: "Pause cleaning" },
            { id: "resume", name: "Resume cleaning" },
            { id: "dock", name: "Return to charging dock" }
        ] as const;
        for (const control of controls) {
            await this.setObjectNotExistsAsync(`control.${control.id}`, {
                type: "state",
                common: { name: control.name, type: "boolean", role: "button", read: false, write: true, def: false },
                native: {}
            });
            await this.subscribeStatesAsync(`control.${control.id}`);
        }

        const poll = async (): Promise<void> => {
            if (!this.client || this.stopping) return;
            try {
                // Conservative V60 profile: one property per RPC, no overlapping cycles.
                for (const property of properties) {
                    const result = await this.client.call("get_properties", [{
                        did: config.did, siid: property.siid, piid: property.piid
                    }]);
                    if (!Array.isArray(result)) throw new Error("Unexpected MIoT property response");
                    const item = result[0] as { code?: number; value?: unknown } | undefined;
                    if (item?.code === 0 && typeof item.value === "number") {
                        await this.setStateChangedAsync(property.id, { val: item.value, ack: true });
                    } else if (item && typeof item.code === "number" && item.code !== 0) {
                        throw new Error(`MIoT property read failed (SIID ${property.siid}, PIID ${property.piid}, code ${item.code})`);
                    }
                }
                await this.setStateChangedAsync("info.connection", { val: true, ack: true });
                await this.setStateChangedAsync("info.connectionText", { val: "Local miIO connection established", ack: true });
                this.lastPollError = "";
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown local miIO error";
                await this.setStateChangedAsync("info.connection", { val: false, ack: true });
                await this.setStateChangedAsync("info.connectionText", { val: message, ack: true });
                if (message !== this.lastPollError) this.log.warn(message);
                this.lastPollError = message;
            }
        };

        const baseIntervalMs = (config.pollIntervalSeconds ?? 30) * 1000;
        let consecutiveFailures = 0;
        const scheduleNext = (delayMs: number): void => {
            if (this.stopping) return;
            this.pollTimer = setTimeout(async () => {
                await poll();
                if (this.lastPollError) consecutiveFailures++;
                else consecutiveFailures = 0;
                const nextDelay = this.lastPollError
                    ? Math.min(baseIntervalMs * (2 ** Math.min(consecutiveFailures, 6)), 300000)
                    : baseIntervalMs;
                scheduleNext(nextDelay);
            }, delayMs);
        };

        await poll();
        scheduleNext(this.lastPollError ? Math.min(baseIntervalMs * 2, 300000) : baseIntervalMs);
    }

    private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
        if (!state || state.ack || state.val !== true || !id.startsWith(`${this.namespace}.control.`)) return;
        const command = id.slice(`${this.namespace}.control.`.length);
        const config = this.config as RoidmiAdapterConfig;
        // Action IDs follow the Roidmi V60 MIoT mapping. Real-device validation is still pending.
        const actions: Record<string, MiotAction> = {
            start: { siid: 2, aiid: 1 },
            pause: { siid: 8, aiid: 8 },
            resume: { siid: 8, aiid: 5 },
            dock: { siid: 8, aiid: 9 }
        };
        const action = actions[command];
        if (!action || !this.client || !config.did) {
            this.log.warn(`Control command ignored: ${command} is unavailable`);
            await this.setStateAsync(`control.${command}`, { val: false, ack: true });
            return;
        }
        if (this.commandRunning) {
            this.log.warn("Control command ignored because another command is still running");
            await this.setStateAsync(`control.${command}`, { val: false, ack: true });
            return;
        }

        this.commandRunning = true;
        try {
            const result = await this.client.call("action", [{
                did: config.did, siid: action.siid, aiid: action.aiid,
                ...(action.in ? { in: action.in } : {})
            }]);
            this.log.info(`Robot command '${command}' sent`);
            this.log.debug(`MIoT action response: ${JSON.stringify(result)}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown command error";
            this.log.warn(`Robot command '${command}' failed: ${message}`);
            await this.setStateChangedAsync("info.connectionText", { val: message, ack: true });
        } finally {
            this.commandRunning = false;
            await this.setStateAsync(`control.${command}`, { val: false, ack: true });
        }
    }

    private onUnload(callback: () => void): void {
        this.stopping = true;
        if (this.pollTimer) clearTimeout(this.pollTimer);
        this.setState("info.connection", false, true);
        callback();
    }
}

export default RoidmiAdapter;
new RoidmiAdapter();
