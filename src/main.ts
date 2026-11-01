import { Adapter } from "@iobroker/adapter-core";

interface RoidmiPilotConfig {
    host?: string;
    token?: string;
    pollIntervalSeconds?: number;
}

class RoidmiPilot extends Adapter {
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

        // Device communication remains disabled until the local protocol has
        // been validated against the physical EVE Plus.
        const message = "Configuration saved. Local device protocol validation is pending.";
        await this.setStateAsync("info.connectionText", { val: message, ack: true });
        this.log.info(message);
    }

    private onUnload(callback: () => void): void {
        this.setState("info.connection", false, true);
        callback();
    }
}

export default RoidmiPilot;
new RoidmiPilot();
