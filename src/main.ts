import { Adapter } from "@iobroker/adapter-core";
import { MiioClient } from "./lib/miio-client";
import { parseRoomCleaningRequest } from "./lib/room-cleaning";
import { validateConfig } from "./lib/config";
import { buildVacuumAction } from "./lib/roidmi-actions";
import { parseRoomMapConfig, RoomMapConfig } from "./lib/room-map";
import { getRoidmiSetting } from "./lib/roidmi-settings";

interface RoidmiAdapterConfig {
    host?: string;
    did?: string;
    token?: string;
    pollIntervalSeconds?: number;
}

interface MiotPropertyWrite {
    siid: number;
    piid: number;
    value: number;
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
    private roomMapConfig?: RoomMapConfig;

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
        const errors = validateConfig(config);

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
            { id: "errorCode", siid: 2, piid: 2, name: "Error code" },
            { id: "fanSpeed", siid: 2, piid: 4, name: "Suction power", min: 0, max: 4 },
            { id: "sweepType", siid: 2, piid: 8, name: "Cleaning type", min: 0, max: 2 },
            { id: "waterLevel", siid: 8, piid: 11, name: "Water level", min: 0, max: 4 }
        ] as const;

        for (const property of properties) {
            await this.setObjectNotExistsAsync(property.id, {
                type: "state",
                common: {
                    name: property.name, type: "number", role: "level",
                    ...("min" in property ? { min: property.min, max: property.max } : {}),
                    ...("unit" in property ? { unit: property.unit } : {}),
                    read: true, write: "min" in property
                },
                native: { siid: property.siid, piid: property.piid }
            });
            if ("min" in property) await this.subscribeStatesAsync(property.id);
        }

        const controls = [
            { id: "start", name: "Start full cleaning" },
            { id: "pause", name: "Pause cleaning" },
            { id: "resume", name: "Resume cleaning" },
            { id: "dock", name: "Return to charging dock" },
            { id: "stop", name: "Stop cleaning" }
        ] as const;
        for (const control of controls) {
            await this.setObjectNotExistsAsync(`control.${control.id}`, {
                type: "state",
                common: { name: control.name, type: "boolean", role: "button", read: false, write: true, def: false },
                native: {}
            });
            await this.subscribeStatesAsync(`control.${control.id}`);
        }

        await this.setObjectNotExistsAsync("control.cleanRooms", {
            type: "state",
            common: { name: "Clean selected rooms (JSON: mapId and roomIds)", type: "string", role: "json", read: false, write: true, def: "" },
            native: {}
        });
        await this.subscribeStatesAsync("control.cleanRooms");

        await this.setObjectNotExistsAsync("control.importRooms", {
            type: "state",
            common: { name: "Import room map (JSON: mapId and rooms)", type: "string", role: "json", read: false, write: true, def: "" },
            native: {}
        });
        await this.subscribeStatesAsync("control.importRooms");
        await this.setObjectNotExistsAsync("map.config", {
            type: "state",
            common: { name: "Persisted room map configuration", type: "string", role: "json", read: true, write: false },
            native: {}
        });
        const savedMap = await this.getStateAsync("map.config");
        if (savedMap && typeof savedMap.val === "string" && savedMap.val.trim()) {
            try {
                await this.applyRoomMapConfig(parseRoomMapConfig(savedMap.val));
            } catch (error) {
                const message = error instanceof Error ? error.message : "Stored room map is invalid";
                this.log.warn("Stored room map could not be restored: " + message);
            }
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

    private async applyRoomMapConfig(config: RoomMapConfig): Promise<void> {
        const previous = this.roomMapConfig;
        this.roomMapConfig = config;
        await this.setObjectNotExistsAsync("map.mapId", {
            type: "state",
            common: { name: "Active map ID", type: "number", role: "value", read: true, write: false },
            native: {}
        });
        await this.setObjectNotExistsAsync("map.roomsJson", {
            type: "state",
            common: { name: "Imported room list", type: "string", role: "json", read: true, write: false },
            native: {}
        });
        await this.setStateAsync("map.config", { val: JSON.stringify(config), ack: true });
        await this.setStateChangedAsync("map.mapId", { val: config.mapId, ack: true });
        await this.setStateChangedAsync("map.roomsJson", { val: JSON.stringify(config.rooms), ack: true });
        for (const room of config.rooms) {
            await this.setObjectNotExistsAsync(`rooms.${room.id}.name`, {
                type: "state",
                common: { name: "Room name", type: "string", role: "text", read: true, write: false },
                native: { segmentId: room.id }
            });
            await this.setStateChangedAsync(`rooms.${room.id}.name`, { val: room.name, ack: true });
            await this.setObjectNotExistsAsync(`rooms.${room.id}.clean`, {
                type: "state",
                common: { name: `Clean ${room.name}`, type: "boolean", role: "button", read: false, write: true, def: false },
                native: { segmentId: room.id }
            });
            await this.subscribeStatesAsync(`rooms.${room.id}.clean`);
        }
        if (previous) {
            const currentIds = new Set(config.rooms.map((room) => room.id));
            for (const room of previous.rooms) {
                if (!currentIds.has(room.id)) {
                    await this.delObjectAsync(`rooms.${room.id}.name`);
                    await this.delObjectAsync(`rooms.${room.id}.clean`);
                }
            }
        }
        this.log.info(`Loaded room map ${config.mapId} with ${config.rooms.length} rooms`);
    }

    private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
        if (!state || state.ack) return;

        const importId = this.namespace + ".control.importRooms";
        if (id === importId) {
            if (typeof state.val === "string" && state.val.trim()) {
                try {
                    const config = parseRoomMapConfig(state.val);
                    await this.applyRoomMapConfig(config);
                } catch (error) {
                    const message = error instanceof Error ? error.message : "Invalid room map";
                    this.log.warn("Room-map import rejected: " + message);
                }
            }
            await this.setStateAsync("control.importRooms", { val: "", ack: true });
            return;
        }

        const roomPrefix = this.namespace + ".rooms.";
        if (id.startsWith(roomPrefix) && id.endsWith(".clean")) {
            const roomIdText = id.slice(roomPrefix.length, -".clean".length);
            const roomId = Number(roomIdText);
            if (state.val !== true) return;
            const room = this.roomMapConfig?.rooms.find((entry) => entry.id === roomId);
            if (!room || !this.roomMapConfig) {
                this.log.warn("Room command ignored: room map is not configured");
                await this.setStateAsync(id, { val: false, ack: true });
                return;
            }
            await this.sendAction("room-" + room.name, {
                siid: 14, aiid: 1,
                in: [2, JSON.stringify({ mapId: this.roomMapConfig.mapId, segmentId: [room.id] })]
            }, `rooms.${room.id}.clean`);
            return;
        }

        const propertyId = id.slice(this.namespace.length + 1);
        const property = id.startsWith(this.namespace + ".") ? getRoidmiSetting(propertyId) : undefined;
        if (property) {
            if (typeof state.val !== "number" || !Number.isInteger(state.val) || state.val < property.min || state.val > property.max) {
                this.log.warn("Setting rejected: value out of range for " + id);
                const current = await this.getStateAsync(id);
                await this.setStateAsync(id, { val: current?.val ?? 0, ack: true });
                return;
            }
            await this.sendProperty(id, property, state.val);
            return;
        }

        const prefix = this.namespace + ".control.";
        if (!id.startsWith(prefix)) return;
        const command = id.slice(prefix.length);
        const config = this.config as RoidmiAdapterConfig;

        if (command === "cleanRooms") {
            if (typeof state.val !== "string" || !state.val.trim()) {
                await this.setStateAsync("control.cleanRooms", { val: "", ack: true });
                return;
            }
            try {
                const roomAction = parseRoomCleaningRequest(state.val);
                await this.sendAction("cleanRooms", { siid: roomAction.siid, aiid: roomAction.aiid, in: roomAction.params }, "control.cleanRooms", "");
            } catch (error) {
                const message = error instanceof Error ? error.message : "Invalid room-cleaning request";
                this.log.warn("Room-cleaning request rejected: " + message);
                await this.setStateAsync("control.cleanRooms", { val: "", ack: true });
            }
            return;
        }

        if (state.val !== true) return;
        if (command === "start" || command === "pause" || command === "resume" || command === "dock" || command === "stop") {
            await this.sendAction(command, buildVacuumAction(command), "control." + command, false);
            return;
        }
        await this.setStateAsync("control." + command, { val: false, ack: true });
    }

    private async sendProperty(stateId: string, property: MiotPropertyWrite, value: number): Promise<void> {
        const config = this.config as RoidmiAdapterConfig;
        const current = await this.getStateAsync(stateId);
        if (!this.client || !config.did || this.commandRunning) {
            this.log.warn("Property write ignored because the device is unavailable or another command is running");
            await this.setStateAsync(stateId, { val: current?.val ?? 0, ack: true });
            return;
        }
        this.commandRunning = true;
        try {
            const result = await this.client.call("set_properties", [{
                did: config.did, siid: property.siid, piid: property.piid, value
            }]);
            if (Array.isArray(result)) {
                const item = result[0] as { code?: number } | undefined;
                if (item && typeof item.code === "number" && item.code !== 0) {
                    throw new Error(`MIoT property write failed (SIID ${property.siid}, PIID ${property.piid}, code ${item.code})`);
                }
            }
            await this.setStateAsync(stateId, { val: value, ack: true });
            this.log.info("Robot setting updated: " + stateId.slice(this.namespace.length + 1) + " = " + value);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown property write error";
            this.log.warn("Robot setting failed: " + message);
            await this.setStateAsync(stateId, { val: current?.val ?? 0, ack: true });
        } finally {
            this.commandRunning = false;
        }
    }

    private async sendAction(command: string, action: MiotAction, stateId: string, resetValue: boolean | string = false): Promise<void> {
        const config = this.config as RoidmiAdapterConfig;
        if (!this.client || !config.did) {
            this.log.warn("Control command ignored: " + command + " is unavailable");
            await this.setStateAsync(stateId, { val: resetValue, ack: true });
            return;
        }
        if (this.commandRunning) {
            this.log.warn("Control command ignored because another command is still running");
            await this.setStateAsync(stateId, { val: resetValue, ack: true });
            return;
        }

        this.commandRunning = true;
        try {
            const result = await this.client.call("action", [{
                did: config.did, siid: action.siid, aiid: action.aiid,
                ...(action.in ? { in: action.in } : {})
            }]);
            this.log.info("Robot command " + command + " sent");
            this.log.debug("MIoT action response: " + JSON.stringify(result));
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown command error";
            this.log.warn("Robot command " + command + " failed: " + message);
            await this.setStateChangedAsync("info.connectionText", { val: message, ack: true });
        } finally {
            this.commandRunning = false;
            await this.setStateAsync(stateId, { val: resetValue, ack: true });
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
