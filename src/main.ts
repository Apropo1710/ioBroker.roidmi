import { Adapter } from "@iobroker/adapter-core";
import { MiioClient } from "./lib/miio-client";

interface RoidmiPilotConfig {
    host?: string;
    token?: string;
    pollIntervalSeconds?: number;
}

class RoidmiPilot extends Adapter {
    private pollTimer?: NodeJS.Timeout;
    public constructor() {
        super({ name: "roidmipilot" });
        this.on("ready", () => void this.onReady());
        this.on("unload", (callback) => this.onUnload(callback));
    }

    private async onReady(): Promise<void> {
        await this.setObjectNotExistsAsync("info.connection", {
            type: "state",
            common: {
                name: "Device connection",
                type: "boolean",
                role: "indicator.reachable",
                read: true,
                write: false
            },
            native: {}
        });
        await this.setObjectNotExistsAsync("info.connectionText", {
            type: "state",
            common: {
                name: "Connection status",
                type: "string",
                role: "text",
                read: true,
                write: false
            },
            native: {}
        });

        const config = this.config as RoidmiPilotConfig;
        const errors: string[] = [];
        if (config.host && !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(config.host)) {
            errors.push("The configured host is not a valid IPv4 address.");
        }
        if (config.pollIntervalSeconds !== undefined &&
            (!Number.isInteger(config.pollIntervalSeconds) ||
             config.pollIntervalSeconds < 5 ||
             config.pollIntervalSeconds > 3600)) {
            errors.push("Polling interval must be between 5 and 3600 seconds.");
        }

        await this.setStateAsync("info.connection", { val: false, ack: true });
        if (errors.length > 0) {
            const message = errors.join(" ");
            await this.setStateAsync("info.connectionText", { val: message, ack: true });
            this.log.error(message);
            return;
        }

        if (!config.host || !config.token) {
            const message = "Configuration incomplete: enter the robot IP address and MIoT/miIO token.";
            await this.setStateAsync("info.connectionText", { val: message, ack: true });
            this.log.info(message);
            return;
        }

        const client = new MiioClient({ host: config.host, token: config.token });
        const properties = [
            { id: "battery", siid: 3, piid: 1, name: "Battery level", type: "number", unit: "%" },
            { id: "charging", siid: 3, piid: 2, name: "Charging state", type: "number" },
            { id: "state", siid: 2, piid: 1, name: "Vacuum state", type: "number" },
            { id: "errorCode", siid: 2, piid: 2, name: "Error code", type: "number" }
        ] as const;

        for (const property of properties) {
            await this.setObjectNotExistsAsync(property.id, {
                type: "state",
                common: {
                    name: property.name,
                    type: property.type,
                    role: "value",
                    unit: "unit" in property ? property.unit : undefined,
                    read: true,
                    write: false
                },
                native: { siid: property.siid, piid: property.piid }
            });
        }

        const poll = async (): Promise<void> => {
            try {
                const result = await client.call("get_properties", properties.map((property) => ({
                    did: "roidmipilot",
                    siid: property.siid,
                    piid: property.piid
                })));
                if (!Array.isArray(result)) throw new Error("Robot returned an unexpected MIoT property response");
                for (let index = 0; index < properties.length; index++) {
                    const item = result[index] as { code?: number; value?: unknown } | undefined;
                    if (item && item.code === 0 && typeof item.value === "number") {
                        await this.setStateAsync(properties[index].id, { val: item.value, ack: true });
                    }
                }
                await this.setStateAsync("info.connection", { val: true, ack: true });
                await this.setStateAsync("info.connectionText", { val: "Local miIO connection established", ack: true });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown local miIO error";
                await this.setStateAsync("info.connection", { val: false, ack: true });
                await this.setStateAsync("info.connectionText", { val: message, ack: true });
                this.log.warn(message);
            }
        };

        await poll();
        this.pollTimer = setInterval(() => void poll(), (config.pollIntervalSeconds ?? 30) * 1000);
    }

    private onUnload(callback: () => void): void {
        this.setState("info.connection", false, true);
        callback();
    }
}

export default RoidmiPilot;
new RoidmiPilot();
