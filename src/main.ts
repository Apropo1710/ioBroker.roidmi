import { Adapter } from "@iobroker/adapter-core";
import { MiioClient } from "./lib/miio-client";
import { XIAOMI_X20_PLUS_PROPERTIES, getXiaomiX20PlusStatusText } from "./lib/xiaomi-x20plus-profile";
import { parseRoomCleaningRequest } from "./lib/room-cleaning";
import { validateConfig } from "./lib/config";
import { buildVacuumAction, getActionResponseError, getActionFailureStatus } from "./lib/roidmi-actions";
import { parseRoomMapConfig, RoomMapConfig } from "./lib/room-map";
import { getRoidmiSetting } from "./lib/roidmi-settings";
import { parseCleaningSchedules } from "./lib/cleaning-schedules";
import { XiaomiCloudMapClient } from "./lib/xiaomi-cloud-map";
import { RoidmiMapMetadata } from "./lib/roidmi-map";
import { getVacuumStateText, getChargingStateText, getRoidmiErrorText } from "./lib/roidmi-status";

interface RoidmiAdapterConfig {
    host?: string;
    did?: string;
    token?: string;
    pollIntervalSeconds?: number;
    cloudEnabled?: boolean;
    cloudControlEnabled?: boolean;
    cloudUsername?: string;
    cloudPassword?: string;
    cloudCountry?: string;
    cloudSession?: string;
    enableRoidmi?: boolean;
    enableXiaomi?: boolean;
    xiaomiHost?: string;
    xiaomiDid?: string;
    xiaomiToken?: string;
}

interface MiotPropertyWrite {
    siid: number;
    piid: number;
    min: number;
    max: number;
}

interface MiotAction {
    siid: number;
    aiid: number;
    in?: unknown[];
}

class RoidmiAdapter extends Adapter {
    private pollTimer?: NodeJS.Timeout;
    private xiaomiPollTimer?: NodeJS.Timeout;
    private xiaomiPollRunning = false;
    private stopping = false;
    private lastPollError = "";
    private commandRunning = false;
    private cloudLoginRunning = false;
    private client?: MiioClient;
    private readonly cloudMapClient = new XiaomiCloudMapClient();
    private roomMapConfig?: RoomMapConfig;
    private readonly lastKnownSettings: Record<string, number> = {};

    public constructor() {
        super({ name: "roidmi" });
        this.on("ready", () => void this.onReady());
        this.on("message", (obj) => void this.onMessage(obj));
        this.on("stateChange", (id, state) => void this.onStateChange(id, state));
        this.on("unload", (callback) => this.onUnload(callback));
    }

    private async onReady(): Promise<void> {
        await this.migrateLegacyStateTree();
        const deviceChannels: Array<{ id: string; name: string }> = [
            { id: "evePlus", name: "Roidmi EVE Plus" },
            { id: "evePlus.info", name: "Information" },
            { id: "evePlus.status", name: "Status" },
            { id: "evePlus.control", name: "Steuerung" },
            { id: "evePlus.map", name: "Karte" },
            { id: "evePlus.rooms", name: "Räume" },
            { id: "evePlus.timing", name: "Zeitpläne" },
            { id: "x20Plus", name: "Xiaomi X20+" },
            { id: "x20Plus.info", name: "Information" },
            { id: "x20Plus.status", name: "Status" }
        ];
        for (const channel of deviceChannels) {
            await this.setObjectNotExistsAsync(channel.id, {
                type: "channel", common: { name: channel.name }, native: {}
            });
        }
        await this.setObjectNotExistsAsync("evePlus.info.connection", {
            type: "state",
            common: { name: "Device connection", type: "boolean", role: "indicator.reachable", read: true, write: false },
            native: {}
        });
        await this.setObjectNotExistsAsync("evePlus.info.connectionText", {
            type: "state",
            common: { name: "Connection status", type: "string", role: "text", read: true, write: false },
            native: {}
        });
        await this.setObjectNotExistsAsync("evePlus.info.lastPoll", {
            type: "state",
            common: { name: "Last successful status poll", type: "string", role: "date", read: true, write: false },
            native: {}
        });
        await this.setObjectNotExistsAsync("evePlus.info.pollCount", {
            type: "state",
            common: { name: "Successful status polls since adapter start", type: "number", role: "value", read: true, write: false },
            native: {}
        });
        // Always create the new cleaning-option states, even when adapter configuration
        // is incomplete. The rest of onReady() may return early before device polling.
        const earlyCleaningOptions: Array<{ id: string; name: string; siid: number; piid: number; min: number; max: number; states: Record<string, string> }> = [
            { id: "doubleClean", name: "Double cleaning", siid: 8, piid: 20, min: 0, max: 1, states: { 0: "Aus", 1: "Ein" } },
            { id: "pathType", name: "Mopping pattern", siid: 13, piid: 8, min: 0, max: 2, states: { 0: "Normal", 1: "Y-Weg", 2: "Wiederholen" } },
            { id: "individual", name: "Individual room settings", siid: 13, piid: 7, min: 0, max: 1, states: { 0: "Aus", 1: "Ein" } }
        ];
        for (const property of earlyCleaningOptions) {
            await this.setObjectNotExistsAsync("evePlus.status." + property.id, {
                type: "state",
                common: { name: property.name, type: "number", role: "level", min: property.min, max: property.max, states: property.states, read: true, write: true },
                native: { siid: property.siid, piid: property.piid }
            });
            await this.subscribeStatesAsync("evePlus.status." + property.id);
        }

        let successfulPollCount = 0;

        const config = this.config as RoidmiAdapterConfig;
        // Start Xiaomi independently before Roidmi-specific validation/early returns.
        // This allows Xiaomi-only installations and prevents one robot's config from blocking the other.
        if (config.enableXiaomi === true) void this.startXiaomiPolling(config);
        const errors = validateConfig(config);

        await this.setStateChangedAsync("evePlus.info.connection", { val: false, ack: true });
        if (errors.length) {
            const message = errors.join(" ");
            await this.setStateChangedAsync("evePlus.info.connectionText", { val: message, ack: true });
            this.log.error(message);
            return;
        }
        if (!config.host || !config.did || !config.token) {
            const message = "Configuration incomplete: enter robot IP, numeric Xiaomi device DID and MIoT/miIO token.";
            await this.setStateChangedAsync("evePlus.info.connectionText", { val: message, ack: true });
            this.log.info(message);
            return;
        }

        // Keep a small miIO trace in memory and only emit it when a request fails.
        // This avoids flooding the ioBroker log during normal polling.
        const miioTrace: string[] = [];
        this.client = new MiioClient({
            host: config.host,
            token: config.token,
            debug: true,
            onDebug: (message) => {
                miioTrace.push(message);
                if (miioTrace.length > 20) miioTrace.shift();
            }
        });
        const storedCloudSession = await this.getStateAsync("evePlus.map.cloudSession");
        const encryptedCloudSession = typeof storedCloudSession?.val === "string" && storedCloudSession.val
            ? storedCloudSession.val
            : config.cloudSession;
        if (encryptedCloudSession) {
            try {
                this.cloudMapClient.restoreSession(this.decrypt(encryptedCloudSession));
                this.log.info("Stored Xiaomi Cloud session restored");
            } catch {
                this.cloudMapClient.clearSession();
                this.log.warn("Stored Xiaomi Cloud session could not be restored; a new Xiaomi login is required");
            }
        }

        const properties = [
            { id: "battery", siid: 3, piid: 1, name: "Battery level", unit: "%" },
            { id: "charging", siid: 3, piid: 2, name: "Charging state" },
            { id: "state", siid: 2, piid: 1, name: "Vacuum state" },
            { id: "errorCode", siid: 2, piid: 2, name: "Error code" },
            { id: "fanSpeed", siid: 2, piid: 4, name: "Suction power", min: 0, max: 4, states: { 0: "Aus", 1: "Leise (Silent)", 2: "Standard (Basic)", 3: "Stark (Strong)", 4: "Maximal (Full Speed)" } },
            { id: "sweepType", siid: 2, piid: 8, name: "Cleaning type", min: 0, max: 1, states: { 0: "Saugen", 1: "Wischen" } },
            { id: "waterLevel", siid: 8, piid: 11, name: "Water level", min: 0, max: 4, states: { 0: "Aus", 1: "Niedrig", 2: "Mittel", 3: "Maximal", 4: "Zusatzstufe (Fourth)" } },
            { id: "doubleClean", siid: 8, piid: 20, name: "Double cleaning", min: 0, max: 1, states: { 0: "Aus", 1: "Ein" } },
            { id: "pathType", siid: 13, piid: 8, name: "Mopping pattern", min: 0, max: 2, states: { 0: "Normal", 1: "Y-Weg", 2: "Wiederholen" } },
            { id: "individual", siid: 13, piid: 7, name: "Individual room settings", min: 0, max: 1, states: { 0: "Aus", 1: "Ein" } }
        ] as const;

        await this.setObjectNotExistsAsync("evePlus.status.stateText", { type: "state", common: { name: "Vacuum state (human-readable, empirical)", type: "string", role: "text", read: true, write: false }, native: {} });
        await this.setObjectNotExistsAsync("evePlus.status.errorCodeText", { type: "state", common: { name: "Robot error (human-readable)", type: "string", role: "text", read: true, write: false }, native: {} });
        await this.setObjectNotExistsAsync("evePlus.status.chargingText", { type: "state", common: { name: "Charging state (human-readable, empirical)", type: "string", role: "text", read: true, write: false }, native: {} });
        for (const property of properties) {
            await this.setObjectNotExistsAsync("evePlus.status." + property.id, {
                type: "state",
                common: {
                    name: property.name, type: "number", role: "level",
                    ...("min" in property ? { min: property.min, max: property.max } : {}),
                    ...("unit" in property ? { unit: property.unit } : {}),
                    ...("states" in property ? { states: property.states } : {}),
                    read: true, write: "min" in property
                },
                native: { siid: property.siid, piid: property.piid }
            });
            if ("min" in property) await this.subscribeStatesAsync("evePlus.status." + property.id);
        }

        const controls = [
            { id: "start", name: "Start full cleaning" },
            { id: "pause", name: "Pause cleaning" },
            { id: "resume", name: "Resume cleaning" },
            { id: "dock", name: "Return to charging dock" },            { id: "stop", name: "Stop cleaning" }
        ] as const;
        for (const control of controls) {
            await this.setObjectNotExistsAsync(`evePlus.control.${control.id}`, {
                type: "state",
                common: { name: control.name, type: "boolean", role: "button", read: false, write: true, def: false },
                native: {}
            });
            await this.subscribeStatesAsync(`evePlus.control.${control.id}`);
        }

        await this.setObjectNotExistsAsync("evePlus.control.lastCommand", { type: "state", common: { name: "Last robot command", type: "string", role: "text", read: true, write: false }, native: {} });
        await this.setObjectNotExistsAsync("evePlus.control.lastCommandStatus", { type: "state", common: { name: "Last robot command result", type: "string", role: "text", read: true, write: false }, native: {} });
        await this.setObjectNotExistsAsync("evePlus.control.lastCommandTime", { type: "state", common: { name: "Last robot command time", type: "string", role: "date", read: true, write: false }, native: {} });

        await this.setObjectNotExistsAsync("evePlus.control.cleanRooms", {
            type: "state",
            common: { name: "Clean selected rooms (JSON: mapId and roomIds)", type: "string", role: "json", read: false, write: true, def: "" },
            native: {}
        });
        await this.subscribeStatesAsync("evePlus.control.cleanRooms");

        await this.setObjectNotExistsAsync("evePlus.control.refreshTiming", {
            type: "state",
            common: { name: "Read saved cleaning schedules and room selections", type: "boolean", role: "button", read: false, write: true, def: false },
            native: {}
        });
        await this.subscribeStatesAsync("evePlus.control.refreshTiming");
        await this.setObjectNotExistsAsync("evePlus.timing.raw", {
            type: "state",
            common: { name: "Raw saved Roidmi cleaning schedules (read on demand)", type: "string", role: "json", read: true, write: false },
            native: { siid: 8, piid: 6 }
        });
        await this.setObjectNotExistsAsync("evePlus.timing.parsed", { type: "state", common: { name: "Decoded cleaning schedules (read-only)", type: "string", role: "json", read: true, write: false }, native: {} });
        await this.setObjectNotExistsAsync("evePlus.timing.summary", { type: "state", common: { name: "Cleaning schedule summary (read-only)", type: "string", role: "text", read: true, write: false }, native: {} });
        await this.setObjectNotExistsAsync("evePlus.timing.lastUpdate", {
            type: "state",
            common: { name: "Last schedule read", type: "string", role: "date", read: true, write: false },
            native: {}
        });

        await this.setObjectNotExistsAsync("evePlus.control.importRooms", {
            type: "state",
            common: { name: "Import room map (JSON: mapId and rooms)", type: "string", role: "json", read: false, write: true, def: "" },
            native: {}
        });
        await this.subscribeStatesAsync("evePlus.control.importRooms");
        await this.setObjectNotExistsAsync("evePlus.map.cloudSession", { type: "state", common: { name: "Encrypted Xiaomi Cloud session (internal persistence)", type: "string", role: "text", read: false, write: false }, native: {} });
        await this.setObjectNotExistsAsync("evePlus.map.config", {
            type: "state",
            common: { name: "Persisted room map configuration", type: "string", role: "json", read: true, write: false },
            native: {}
        });
        await this.setObjectNotExistsAsync("evePlus.map.roomsJson", {
            type: "state",
            common: { name: "Imported room list", type: "string", role: "json", read: true, write: false },
            native: {}
        });
        await this.setObjectNotExistsAsync("evePlus.map.roomProfilesJson", {
            type: "state",
            common: { name: "Room-specific suction and water profiles from Xiaomi map metadata (read-only)", type: "string", role: "json", read: true, write: false },
            native: {}
        });
        await this.setObjectNotExistsAsync("evePlus.control.refreshMap", { type: "state", common: { name: "Fetch map and rooms from Xiaomi Cloud (manual)", type: "boolean", role: "button", read: false, write: true, def: false }, native: {} });
        await this.subscribeStatesAsync("evePlus.control.refreshMap");
        for (const [id, name, role] of [["evePlus.map.cloudStatus","Xiaomi Cloud map retrieval status","text"],["evePlus.map.cloudAuthUrl","Xiaomi two-factor authentication URL","text"],["evePlus.map.cloudLastUpdate","Last successful Xiaomi Cloud map retrieval","date"]]) await this.setObjectNotExistsAsync(id,{type:"state",common:{name,type:"string",role,read:true,write:false},native:{}});
        // Remove the former 2FA datapoint; verification is handled in the adapter configuration UI.
        await this.delObjectAsync("evePlus.map.cloudVerificationCode").catch(() => undefined);
        const savedMap = await this.getStateAsync("evePlus.map.config");
        if (savedMap && typeof savedMap.val === "string" && savedMap.val.trim()) {
            try {
                await this.applyRoomMapConfig(parseRoomMapConfig(savedMap.val));
            } catch (error) {
                const message = error instanceof Error ? error.message : "Stored room map is invalid";
                this.log.warn("Stored room map could not be restored: " + message);
            }
        }

        const poll = async (): Promise<void> => {
            if (!this.client || this.stopping || this.commandRunning) return;
            this.commandRunning = true;
            try {
                // Read all status properties in one MIoT RPC to minimize UDP traffic and robot wakeups.
                miioTrace.length = 0;
                const result = await this.client.call("get_properties", properties.map((property) => ({
                    did: config.did, siid: property.siid, piid: property.piid
                })));
                if (!Array.isArray(result)) throw new Error("Unexpected MIoT property response");
                for (let index = 0; index < properties.length; index++) {
                    const property = properties[index];
                    const item = result[index] as { code?: number; value?: unknown } | undefined;
                    if (item?.code === 0 && (typeof item.value === "number" || typeof item.value === "boolean")) {
                        const propertyValue = typeof item.value === "boolean" ? Number(item.value) : item.value;
                        await this.setStateChangedAsync("evePlus.status." + property.id, { val: propertyValue, ack: true });
                        if (property.id === "state") await this.setStateChangedAsync("evePlus.status.stateText", { val: getVacuumStateText(propertyValue), ack: true });
                        if (property.id === "errorCode") await this.setStateChangedAsync("evePlus.status.errorCodeText", { val: getRoidmiErrorText(propertyValue), ack: true });
                        if (property.id === "charging") await this.setStateChangedAsync("evePlus.status.chargingText", { val: getChargingStateText(propertyValue), ack: true });
                        if (getRoidmiSetting(property.id)) this.lastKnownSettings[property.id] = propertyValue;
                    } else if (item && typeof item.code === "number" && item.code !== 0) {
                        throw new Error(`MIoT property read failed (SIID ${property.siid}, PIID ${property.piid}, code ${item.code})`);
                    }
                }
                successfulPollCount++;
                await this.setStateChangedAsync("evePlus.info.lastPoll", { val: new Date().toISOString(), ack: true });
                await this.setStateChangedAsync("evePlus.info.pollCount", { val: successfulPollCount, ack: true });
                await this.setStateChangedAsync("evePlus.info.connection", { val: true, ack: true });
                await this.setStateChangedAsync("evePlus.info.connectionText", { val: "Local miIO connection established", ack: true });
                this.lastPollError = "";
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown local miIO error";
                if (message.includes("timed out") && miioTrace.length) {
                    this.log.debug("[miIO timeout] Diagnostic trace for the failed request:");
                    for (const line of miioTrace) this.log.debug("[miIO timeout] " + line);
                    miioTrace.length = 0;
                }
                await this.setStateChangedAsync("evePlus.info.connection", { val: false, ack: true });
                await this.setStateChangedAsync("evePlus.info.connectionText", { val: message, ack: true });
                if (message !== this.lastPollError) this.log.warn(message);
                this.lastPollError = message;
            } finally {
                this.commandRunning = false;
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


    /**
     * Move the original single-Roidmi object tree and the first Xiaomi tree into
     * the per-device folders. Values and object metadata are retained. This runs
     * once naturally: only legacy paths are considered, never the new folders.
     */
    private async migrateLegacyStateTree(): Promise<void> {
        const legacyStatusIds = new Set([
            "battery", "charging", "state", "errorCode", "fanSpeed", "sweepType",
            "waterLevel", "doubleClean", "pathType", "individual",
            "stateText", "errorCodeText", "chargingText"
        ]);
        const view = await this.getObjectViewAsync("system", "state", {
            startkey: this.namespace + ".",
            endkey: this.namespace + ".\u9999"
        });
        for (const row of view.rows ?? []) {
            const oldFullId = row.id;
            if (!oldFullId.startsWith(this.namespace + ".")) continue;
            const oldId = oldFullId.slice(this.namespace.length + 1);
            let newId: string | undefined;
            if (oldId.startsWith("xiaomi.")) {
                newId = "x20Plus." + oldId.slice("xiaomi.".length);
            } else if (oldId.startsWith("control.")) {
                newId = "evePlus.control." + oldId.slice("control.".length);
            } else if (oldId.startsWith("map.")) {
                newId = "evePlus.map." + oldId.slice("map.".length);
            } else if (oldId.startsWith("rooms.")) {
                newId = "evePlus.rooms." + oldId.slice("rooms.".length);
            } else if (oldId.startsWith("timing.")) {
                newId = "evePlus.timing." + oldId.slice("timing.".length);
            } else if (oldId.startsWith("info.")) {
                newId = "evePlus." + oldId;
            } else if (legacyStatusIds.has(oldId)) {
                newId = "evePlus.status." + oldId;
            }
            if (!newId) continue;

            const oldObject = row.value;
            if (!oldObject) continue;
            const existingNewObject = await this.getObjectAsync(newId);
            if (!existingNewObject) {
                const { _id: _legacyObjectId, ...migratedObject } = oldObject;
                await this.setObjectAsync(newId, migratedObject);
                const oldState = await this.getStateAsync(oldId);
                if (oldState) await this.setStateAsync(newId, oldState);
            }
            await this.delObjectAsync(oldId);
        }
        // Remove empty legacy folders left behind by old versions.
        for (const folder of ["control", "map", "rooms", "timing", "xiaomi"]) {
            await this.delObjectAsync(folder, { recursive: true }).catch(() => undefined);
        }
        this.log.info("Legacy Roidmi/Xiaomi object tree migration completed");
    }

    /**
     * Independent read-only Xiaomi X20+ status poller. It has its own client,
     * connection states and timer so a Xiaomi failure cannot affect Roidmi.
     */
    private async startXiaomiPolling(config: RoidmiAdapterConfig): Promise<void> {
        const prefix = "x20Plus.";
        const infoStates = [
            ["info.connection", "Xiaomi X20+ connection", "boolean", "indicator.reachable"],
            ["info.connectionText", "Xiaomi X20+ connection status", "string", "text"],
            ["info.lastPoll", "Xiaomi X20+ last successful poll", "string", "date"],
            ["info.pollCount", "Xiaomi X20+ successful poll count", "number", "value"]
        ] as const;
        for (const [id, name, type, role] of infoStates) {
            await this.setObjectNotExistsAsync(prefix + id, {
                type: "state", common: { name, type, role, read: true, write: false }, native: {}
            });
        }
        const fields = Object.entries(XIAOMI_X20_PLUS_PROPERTIES);
        for (const [key, property] of fields) {
            await this.setObjectNotExistsAsync(prefix + "status." + key, {
                type: "state",
                common: { name: "Xiaomi X20+ " + key, type: "number", role: "value", read: true, write: false },
                native: { siid: property.siid, piid: property.piid }
            });
        }
        await this.setObjectNotExistsAsync(prefix + "status.statusText", {
            type: "state", common: { name: "Xiaomi X20+ status text", type: "string", role: "text", read: true, write: false }, native: {}
        });
        await this.setStateChangedAsync(prefix + "info.connection", { val: false, ack: true });

        if (!config.xiaomiHost || !config.xiaomiDid || !config.xiaomiToken ||
            !/^\d{1,20}$/.test(config.xiaomiDid) || !/^[0-9a-fA-F]{32}$/.test(config.xiaomiToken)) {
            await this.setStateChangedAsync(prefix + "info.connectionText", {
                val: "Xiaomi X20+ enabled, but IP, numeric DID or 32-character token is missing/invalid.", ack: true
            });
            this.log.warn("Xiaomi X20+ enabled but its connection credentials are incomplete or invalid");
            return;
        }
        const client = new MiioClient({ host: config.xiaomiHost, token: config.xiaomiToken });
        const interval = (config.pollIntervalSeconds ?? 30) * 1000;
        let pollCount = 0;
        let failures = 0;
        let lastError = "";
        const poll = async (): Promise<void> => {
            if (this.stopping || this.xiaomiPollRunning) return;
            this.xiaomiPollRunning = true;
            try {
                const result = await client.call("get_properties", fields.map(([, property]) => ({
                    did: config.xiaomiDid, siid: property.siid, piid: property.piid
                })));
                if (!Array.isArray(result)) throw new Error("Unexpected Xiaomi MIoT property response");
                for (let index = 0; index < fields.length; index++) {
                    const [key] = fields[index];
                    const item = result[index] as { code?: number; value?: unknown } | undefined;
                    if (item?.code === 0 && (typeof item.value === "number" || typeof item.value === "boolean")) {
                        const value = typeof item.value === "boolean" ? Number(item.value) : item.value;
                        await this.setStateChangedAsync(prefix + "status." + key, { val: value, ack: true });
                        if (key === "status") {
                            await this.setStateChangedAsync(prefix + "status.statusText", {
                                val: getXiaomiX20PlusStatusText(value), ack: true
                            });
                        }
                    }
                }
                pollCount++;
                failures = 0;
                lastError = "";
                await this.setStateChangedAsync(prefix + "info.connection", { val: true, ack: true });
                await this.setStateChangedAsync(prefix + "info.connectionText", { val: "Local Xiaomi miIO connection established", ack: true });
                await this.setStateChangedAsync(prefix + "info.lastPoll", { val: new Date().toISOString(), ack: true });
                await this.setStateChangedAsync(prefix + "info.pollCount", { val: pollCount, ack: true });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown Xiaomi miIO error";
                failures++;
                await this.setStateChangedAsync(prefix + "info.connection", { val: false, ack: true });
                await this.setStateChangedAsync(prefix + "info.connectionText", { val: message, ack: true });
                if (message !== lastError) this.log.warn("Xiaomi X20+ poll failed: " + message);
                lastError = message;
            } finally {
                this.xiaomiPollRunning = false;
            }
        };
        const schedule = (delay: number): void => {
            if (this.stopping) return;
            this.xiaomiPollTimer = setTimeout(async () => {
                await poll();
                schedule(lastError ? Math.min(interval * (2 ** Math.min(failures, 5)), 300000) : interval);
            }, delay);
        };
        await poll();
        schedule(lastError ? Math.min(interval * 2, 300000) : interval);
    }

    private async applyRoomMapConfig(config: RoomMapConfig): Promise<void> {
        const previous = this.roomMapConfig;
        this.roomMapConfig = config;
        await this.setObjectNotExistsAsync("evePlus.map.mapId", {
            type: "state",
            common: { name: "Active map ID", type: "number", role: "value", read: true, write: false },            native: {}
        });
        await this.setObjectNotExistsAsync("evePlus.map.roomsJson", {
            type: "state",
            common: { name: "Imported room list", type: "string", role: "json", read: true, write: false },
            native: {}
        });
        await this.setStateAsync("evePlus.map.config", { val: JSON.stringify(config), ack: true });
        await this.setStateChangedAsync("evePlus.map.mapId", { val: config.mapId, ack: true });
        await this.setStateChangedAsync("evePlus.map.roomsJson", { val: JSON.stringify(config.rooms), ack: true });
        for (const room of config.rooms) {
            await this.setObjectNotExistsAsync(`evePlus.rooms.${room.id}.name`, {
                type: "state",
                common: { name: "Room name", type: "string", role: "text", read: true, write: false },
                native: { segmentId: room.id }
            });
            await this.setStateChangedAsync(`evePlus.rooms.${room.id}.name`, { val: room.name, ack: true });
            await this.setObjectNotExistsAsync(`evePlus.rooms.${room.id}.clean`, {
                type: "state",
                common: { name: `Clean ${room.name}`, type: "boolean", role: "button", read: false, write: true, def: false },
                native: { segmentId: room.id }
            });
            await this.subscribeStatesAsync(`evePlus.rooms.${room.id}.clean`);
        }
        if (previous) {
            const currentIds = new Set(config.rooms.map((room) => room.id));
            for (const room of previous.rooms) {
                if (!currentIds.has(room.id)) {
                    await this.delObjectAsync(`evePlus.rooms.${room.id}.name`);
                    await this.delObjectAsync(`evePlus.rooms.${room.id}.clean`);
                }
            }
        }
        this.log.info(`Loaded room map ${config.mapId} with ${config.rooms.length} rooms`);
    }

    /** Publish room profile values from the Xiaomi map archive. This is only called during explicit cloud map refresh. */
    private async applyRoomProfiles(rooms: RoidmiMapMetadata["rooms"]): Promise<void> {
        const profiles = rooms.filter((room) => room.fanLevel !== undefined || room.waterPump !== undefined || room.cleanOrder !== undefined)
            .map((room) => ({
                id: room.id,
                name: room.name,
                ...(room.fanLevel === undefined ? {} : { fanLevel: room.fanLevel }),
                ...(room.waterPump === undefined ? {} : { waterPump: room.waterPump }),
                ...(room.cleanOrder === undefined ? {} : { cleanOrder: room.cleanOrder })
            }));
        await this.setStateChangedAsync("evePlus.map.roomProfilesJson", { val: JSON.stringify(profiles, null, 2), ack: true });
        for (const room of profiles) {
            if (room.fanLevel !== undefined) {
                const id = `evePlus.rooms.${room.id}.profile.fanLevel`;
                await this.setObjectNotExistsAsync(id, {
                    type: "state",
                    common: { name: `Room suction profile - ${room.name}`, type: "number", role: "value", read: true, write: false },
                    native: { segmentId: room.id, source: "Xiaomi map metadata" }
                });
                await this.setStateChangedAsync(id, { val: room.fanLevel, ack: true });
            }
            if (room.waterPump !== undefined) {
                const id = `evePlus.rooms.${room.id}.profile.waterPump`;
                await this.setObjectNotExistsAsync(id, {
                    type: "state",
                    common: { name: `Room mop water profile - ${room.name}`, type: "number", role: "value", read: true, write: false },
                    native: { segmentId: room.id, source: "Xiaomi map metadata" }
                });
                await this.setStateChangedAsync(id, { val: room.waterPump, ack: true });
            }
            if (room.cleanOrder !== undefined) {
                const id = `evePlus.rooms.${room.id}.profile.cleanOrder`;
                await this.setObjectNotExistsAsync(id, {
                    type: "state",
                    common: { name: `Room cleaning order - ${room.name}`, type: "number", role: "value", read: true, write: false },
                    native: { segmentId: room.id, source: "Xiaomi map metadata" }
                });
                await this.setStateChangedAsync(id, { val: room.cleanOrder, ack: true });
            }
        }
        this.log.info(`Read room-specific cleaning profiles from Xiaomi map metadata: ${profiles.length} rooms`);
    }

    private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
        if (!state || state.ack) return;

        const importId = this.namespace + ".evePlus.control.importRooms";
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
            await this.setStateAsync("evePlus.control.importRooms", { val: "", ack: true });
            return;
        }

        if (id === this.namespace + ".evePlus.control.refreshMap") { if(state.val===true) await this.refreshCloudMap(); await this.setStateAsync("evePlus.control.refreshMap",{val:false,ack:true}); return; }
        const refreshTimingId = this.namespace + ".evePlus.control.refreshTiming";
        if (id === refreshTimingId) {
            if (state.val === true) await this.refreshTiming();
            await this.setStateAsync("evePlus.control.refreshTiming", { val: false, ack: true });
            return;
        }

        const roomPrefix = this.namespace + ".evePlus.rooms.";
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
            }, `evePlus.rooms.${room.id}.clean`);
            return;
        }

        const propertyPrefix = this.namespace + ".evePlus.status.";
        const propertyId = id.startsWith(propertyPrefix) ? id.slice(propertyPrefix.length) : "";
        const property = propertyId ? getRoidmiSetting(propertyId) : undefined;
        if (property) {
            if (typeof state.val !== "number" || !Number.isInteger(state.val) || state.val < property.min || state.val > property.max) {
                this.log.warn("Setting rejected: value out of range for " + id);
                await this.setStateAsync(id, { val: this.lastKnownSettings[propertyId] ?? 0, ack: true });
                return;
            }
            await this.sendProperty(id, property, state.val);
            return;
        }

        const prefix = this.namespace + ".evePlus.control.";
        if (!id.startsWith(prefix)) return;
        const command = id.slice(prefix.length);
        const config = this.config as RoidmiAdapterConfig;

        if (command === "cleanRooms") {
            if (typeof state.val !== "string" || !state.val.trim()) {
                await this.setStateAsync("evePlus.control.cleanRooms", { val: "", ack: true });
                return;
            }
            try {
                const roomAction = parseRoomCleaningRequest(state.val);
                await this.sendAction("cleanRooms", { siid: roomAction.siid, aiid: roomAction.aiid, in: roomAction.params }, "evePlus.control.cleanRooms", "");
            } catch (error) {
                const message = error instanceof Error ? error.message : "Invalid room-cleaning request";
                this.log.warn("Room-cleaning request rejected: " + message);
                await this.setStateAsync("evePlus.control.cleanRooms", { val: "", ack: true });
            }
            return;
        }

        if (state.val !== true) return;
        if (command === "start" || command === "pause" || command === "resume" || command === "dock" || command === "stop") {
            await this.sendAction(command, buildVacuumAction(command), "evePlus.control." + command, false);
            return;
        }
        await this.setStateAsync("evePlus.control." + command, { val: false, ack: true });
    }
    /**
     * Read the stored schedule JSON only when explicitly requested.
     * This is deliberately excluded from the fast status polling cycle.
     */
    private async refreshTiming(): Promise<void> {
        const config = this.config as RoidmiAdapterConfig;
        if (!this.client || !config.did || this.commandRunning) {
            this.log.warn("Schedule read skipped: device unavailable or another command is running");
            return;
        }
        this.commandRunning = true;
        try {
            const result = await this.client.call("get_properties", [{
                did: config.did, siid: 8, piid: 6
            }]);
            if (!Array.isArray(result)) throw new Error("Unexpected MIoT schedule response");
            const item = result[0] as { code?: number; value?: unknown } | undefined;
            if (!item || item.code !== 0 || typeof item.value !== "string") {
                throw new Error("MIoT schedule read failed or returned an unsupported value");
            }
            let formatted = item.value;
            try {
                formatted = JSON.stringify(JSON.parse(item.value), null, 2);
            } catch {
                // Preserve the exact device response if firmware returns non-JSON text.
            }
            await this.setStateChangedAsync("evePlus.timing.raw", { val: formatted, ack: true });
            const parsed = parseCleaningSchedules(item.value);
            await this.setStateChangedAsync("evePlus.timing.parsed", { val: JSON.stringify(parsed, null, 2), ack: true });
            await this.setStateChangedAsync("evePlus.timing.summary", { val: parsed.map((entry, index) => `${index + 1}. ${entry.timeText} | ${entry.enabled ? "aktiv" : "deaktiviert"} | Saugstufe ${entry.fanSpeedText} | Modus ${entry.cleaningMode} | Wasser ${entry.waterLevelText} | Raum-IDs ${entry.roomIds.join(", ")} | ${entry.weekdaysText}`).join("\\n") || "Keine Zeitpläne gespeichert", ack: true });
            await this.setStateChangedAsync("evePlus.timing.lastUpdate", { val: new Date().toISOString(), ack: true });
            this.log.info("Saved cleaning schedules read from robot (SIID 8 / PIID 6)");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown schedule read error";
            this.log.warn("Could not read saved cleaning schedules: " + message);
        } finally {
            this.commandRunning = false;
        }
    }

    private async onMessage(obj: ioBroker.Message): Promise<void> {
        if (!obj || (obj.command !== "cloudStartLogin" && obj.command !== "cloudSubmitCode")) return;
        const payload = (obj.message && typeof obj.message === "object" ? obj.message : {}) as Record<string, unknown>;
        const credentials = {
            username: typeof payload.username === "string" ? payload.username : "",
            password: typeof payload.password === "string" ? payload.password : "",
            country: typeof payload.country === "string" ? payload.country : "de",
            token: typeof payload.token === "string" ? payload.token : ""
        };
        const code = obj.command === "cloudSubmitCode" && typeof payload.code === "string" ? payload.code.trim() : undefined;
        try {
            if (obj.command === "cloudStartLogin") {
                // Do not update system.adapter.<instance> during login: changing native config restarts this adapter.
                this.cloudMapClient.clearSession();
            }
            if (!credentials.username || !credentials.password || !credentials.token) {
                throw new Error("Bitte Xiaomi-Benutzername, Passwort und Roboter-Token in der Adapterkonfiguration eintragen.");
            }
            if (obj.command === "cloudSubmitCode" && !code) throw new Error("Bitte zuerst den Xiaomi-Bestätigungscode eingeben.");
            await this.refreshCloudMap(code, credentials);
            const state = await this.getStateAsync("evePlus.map.cloudStatus");
            const message = typeof state?.val === "string" ? state.val : "Xiaomi-Cloud-Anfrage abgeschlossen.";
            this.sendTo(obj.from, obj.command, { text: message, ok: !/fehlgeschlagen|abgelehnt|fehlt|ungültig/i.test(message) }, obj.callback);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Xiaomi-Cloud-Anmeldung fehlgeschlagen.";
            this.sendTo(obj.from, obj.command, { text: message, ok: false }, obj.callback);
        }
    }

    private async persistCloudSession(): Promise<void> {
        if (!this.cloudMapClient.hasSession()) return;
        const encrypted = this.encrypt(this.cloudMapClient.exportSession());
        // Store independently of adapter native config: Admin config saves may replace
        // native fields and must never wipe a valid Xiaomi session.
        // Persist the session only in its dedicated state. Updating system.adapter
        // native configuration can trigger an ioBroker instance restart during
        // the cloud map refresh.
        await this.setStateAsync("evePlus.map.cloudSession", { val: encrypted, ack: true });
    }

    private async clearPersistedCloudSession(): Promise<void> {
        // Do not modify system.adapter native configuration: that can restart
        // this adapter and interrupt the explicit cloud operation.
        await this.setStateAsync("evePlus.map.cloudSession", { val: "", ack: true });
    }

    private async refreshCloudMap(verificationCode?: string, supplied?: { username: string; password: string; country: string; token: string }): Promise<void> {
        const config = { ...(this.config as RoidmiAdapterConfig), ...(supplied ?? {}) };
        if (!config.cloudEnabled) {
            await this.setStateAsync("evePlus.map.cloudStatus", { val: "Optional Xiaomi Cloud access is disabled in adapter settings.", ack: true });
            return;
        }
        if (!config.cloudUsername || !config.cloudPassword || !config.token || !this.client || this.commandRunning) {
            await this.setStateAsync("evePlus.map.cloudStatus", { val: "Cloud credentials, local robot token or an idle adapter are missing.", ack: true });
            return;
        }

        this.commandRunning = true;
        await this.setStateAsync("evePlus.map.cloudAuthUrl", { val: "", ack: true });
        try {
            // The EVE Plus uses Xiaomi's V60-family Cloud V2 map API.
            // The upstream Xiaomi Cloud Map Extractor explicitly does not query a
            // map name from the robot for this API (should_get_map_from_vacuum=false);
            // the cloud archive key uses "0". Avoiding get_map_v1 also prevents a
            // firmware-specific user-ack timeout and saves an unnecessary robot RPC.
            const mapName = "0";
            await this.setStateAsync("evePlus.map.cloudStatus", {
                val: "Roidmi EVE Plus cloud map: connecting to Xiaomi Cloud…",
                ack: true
            });
            const result = await this.cloudMapClient.fetchMap({
                username: config.cloudUsername,
                password: config.cloudPassword,
                country: config.cloudCountry || "de",
                token: config.token,
                mapName
            }, verificationCode, (message) => {
                void this.setStateAsync("evePlus.map.cloudStatus", { val: message, ack: true });
                this.log.info(message);
            }, async () => {
                // Save immediately after login/session renewal, before any later
                // cloud API call can fail and leave the session unpersisted.
                await this.persistCloudSession();
            });
            const rooms = result.metadata.rooms;
            const profiles = rooms.map((room) => ({
                id: room.id, name: room.name,
                ...(room.fanLevel === undefined ? {} : { fanLevel: room.fanLevel }),
                ...(room.waterPump === undefined ? {} : { waterPump: room.waterPump }),
                ...(room.cleanOrder === undefined ? {} : { cleanOrder: room.cleanOrder })
            }));
            await this.setStateChangedAsync("evePlus.map.roomProfilesJson", { val: JSON.stringify(profiles, null, 2), ack: true });
            if (!rooms.length) throw new Error("Downloaded map contains no named rooms.");
            await this.applyRoomProfiles(rooms);

            await this.setStateChangedAsync("evePlus.map.roomsJson", { val: JSON.stringify(rooms), ack: true });
            if (result.metadata.mapId) {
                await this.applyRoomMapConfig({
                    mapId: result.metadata.mapId,
                    rooms: rooms.map(({ id, name }) => ({ id, name }))
                });
                await this.setStateAsync("evePlus.map.cloudStatus", {
                    val: `Map and ${rooms.length} rooms imported. Map ID: ${result.metadata.mapId}`,
                    ack: true
                });
            } else {
                await this.setStateAsync("evePlus.map.cloudStatus", {
                    val: `Found ${rooms.length} rooms. The archive lacks the separate cleaning mapId; enter that ID once via control.importRooms to enable room-clean buttons.`,
                    ack: true
                });
            }
            await this.setStateChangedAsync("evePlus.map.cloudLastUpdate", { val: new Date().toISOString(), ack: true });
            this.log.info(`Xiaomi Cloud map read succeeded: ${rooms.length} rooms`);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown Xiaomi Cloud map error";
            if (message.startsWith("XIAOMI_2FA_CODE:")) {
                await this.setStateAsync("evePlus.map.cloudStatus", { val: message.slice("XIAOMI_2FA_CODE:".length), ack: true });
            } else if (message.startsWith("XIAOMI_2FA:")) {
                await this.setStateAsync("evePlus.map.cloudAuthUrl", { val: message.slice(11), ack: true });
                await this.setStateAsync("evePlus.map.cloudStatus", {
                    val: "Two-factor authentication required. Open map.cloudAuthUrl from a device on the same internet connection, complete verification, then press refreshMap again.",
                    ack: true
                });
            } else {                await this.setStateAsync("evePlus.map.cloudStatus", { val: message, ack: true });
                this.log.warn("Xiaomi Cloud map retrieval failed: " + message);
            }
        } finally {
            try { await this.persistCloudSession(); }
            catch { this.log.warn("Xiaomi Cloud session could not be stored securely"); }
            this.commandRunning = false;
        }
    }

    private async sendProperty(stateId: string, property: MiotPropertyWrite, value: number): Promise<void> {
        const config = this.config as RoidmiAdapterConfig;
        const propertyKey = stateId.startsWith(this.namespace + ".evePlus.status.")
            ? stateId.slice((this.namespace + ".evePlus.status.").length)
            : stateId.slice(this.namespace.length + 1);
        const previousValue = this.lastKnownSettings[propertyKey] ?? 0;
        if (!this.client || !config.did || this.commandRunning) {
            this.log.warn("Property write ignored because the device is unavailable or another command is running");
            await this.setStateAsync(stateId, { val: previousValue, ack: true });
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
            this.lastKnownSettings[propertyKey] = value;
            this.log.info("Robot setting updated: " + propertyKey + " = " + value);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown property write error";
            this.log.warn("Robot setting failed: " + message);
            await this.setStateAsync(stateId, { val: previousValue, ack: true });
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
            const result = config.cloudControlEnabled
                ? await this.cloudMapClient.callAction(config.cloudCountry || "de", {
                    did: config.did, siid: action.siid, aiid: action.aiid,
                    ...(action.in ? { in: action.in } : {})
                }, async () => {
                    // Persist refreshed Xiaomi serviceToken/passToken after cloud actions,
                    // so a renewal survives adapter restarts and future Admin saves.
                    await this.persistCloudSession();
                })
                : await this.client.call("action", [{
                    did: config.did, siid: action.siid, aiid: action.aiid,
                    ...(action.in ? { in: action.in } : {})
                }]);
            const responseError = getActionResponseError(result);
            if (responseError) throw new Error(responseError);
            await this.setStateChangedAsync("evePlus.control.lastCommand", { val: command, ack: true });
            await this.setStateChangedAsync("evePlus.control.lastCommandStatus", { val: "Accepted by robot", ack: true });
            await this.setStateChangedAsync("evePlus.control.lastCommandTime", { val: new Date().toISOString(), ack: true });
            this.log.info("Robot command " + command + " accepted by " + (config.cloudControlEnabled ? "Xiaomi Cloud MIoT" : "local MIoT"));
            this.log.debug("MIoT action response: " + JSON.stringify(result));
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown command error";
            const failure = getActionFailureStatus(error, config.cloudControlEnabled ? "cloud" : "local");
            const status = failure.status;
            this.log.warn("Robot command " + command + (failure.uncertain
                ? " failed without confirmation; command outcome is unknown"
                : " failed: " + message));
            await this.setStateChangedAsync("evePlus.control.lastCommand", { val: command, ack: true });
            await this.setStateChangedAsync("evePlus.control.lastCommandStatus", { val: status, ack: true });
            await this.setStateChangedAsync("evePlus.control.lastCommandTime", { val: new Date().toISOString(), ack: true });
        } finally {
            this.commandRunning = false;
            await this.setStateAsync(stateId, { val: resetValue, ack: true });
        }
    }

    private onUnload(callback: () => void): void {
        this.stopping = true;
        if (this.pollTimer) clearTimeout(this.pollTimer);
        if (this.xiaomiPollTimer) clearTimeout(this.xiaomiPollTimer);
        this.setState("evePlus.info.connection", false, true);
        callback();
    }
}

export default RoidmiAdapter;
new RoidmiAdapter();