import { Adapter } from "@iobroker/adapter-core";
import { MiioClient } from "./lib/miio-client";
import { mapLegacyStateId, LEGACY_EMPTY_FOLDERS } from "./lib/object-tree-migration";
import { XIAOMI_X20_PLUS_PROPERTIES, XIAOMI_X20_PLUS_CONSUMABLE_PROPERTIES, XIAOMI_X20_PLUS_OPTIONAL_SETTINGS, XIAOMI_X20_PLUS_LIFETIME_PROPERTIES, XIAOMI_X20_PLUS_CONSUMABLE_POLL_INTERVAL_MS, getXiaomiX20PlusStatusText } from "./lib/xiaomi-x20plus-profile";
import { parseRoomCleaningRequest } from "./lib/room-cleaning";
import { parseXiaomiRoomCleanRequest } from "./lib/xiaomi-room-cleaning";
import { createRoomCleanObservationTracker, observeRoomCleanStatus, RoomCleanObservationTracker } from "./lib/xiaomi-room-clean-status";
import { filterXiaomiHomeRooms } from "./lib/xiaomi-dreame-map";
import { validateConfig, validateRoidmiConfig, validateXiaomiConfig, isRoidmiEnabled, isXiaomiEnabled } from "./lib/config";
import { buildVacuumAction, getActionResponseError, getActionFailureStatus } from "./lib/roidmi-actions";
import { parseRoomMapConfig, RoomMapConfig } from "./lib/room-map";
import { getRoidmiSetting } from "./lib/roidmi-settings";
import { parseCleaningSchedules } from "./lib/cleaning-schedules";
import { areRoidmiScheduleSnapshotsEqual, updateRoidmiCleaningSchedule, verifyRoidmiCleaningScheduleUpdate, RoidmiCleaningScheduleUpdate } from "./lib/roidmi-cleaning-schedules";
import { parseXiaomiCleaningSchedules, setXiaomiCleaningScheduleEnabled, verifyXiaomiCleaningScheduleUpdate, updateXiaomiCleaningSchedule, verifyXiaomiCleaningScheduleDetailsUpdate, XiaomiCleaningScheduleUpdate } from "./lib/xiaomi-cleaning-schedules";
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
    private xiaomiScheduleTimer?: NodeJS.Timeout;
    private xiaomiPollRunning = false;
    private xiaomiCommandRunning = false;
    private xiaomiClient?: MiioClient;
    private xiaomiRoomCleanTracker?: RoomCleanObservationTracker;
    private readonly xiaomiMiioTrace: string[] = [];
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
            { id: "x20Plus.status", name: "Status" },
            { id: "x20Plus.control", name: "Steuerung" },
            { id: "x20Plus.rooms", name: "Xiaomi X20+ Räume" }
        ];
        for (const channel of deviceChannels) {
            await this.setObjectNotExistsAsync(channel.id, {
                type: "channel", common: { name: channel.name }, native: {}
            });
        }
        // Create the Xiaomi mop diagnostic state during the awaited adapter startup,
        // before the independent poller is launched. This avoids a race with startup
        // object-tree initialization on existing installations.
        await this.setObjectNotExistsAsync("x20Plus.info.mopModeReadback", {
            type: "state",
            common: {
                name: "Raw MIoT read result for mop water level",
                type: "string",
                role: "json",
                read: true,
                write: false
            },
            native: {}
        });
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
        // Cloud session storage is needed even when only the Xiaomi X20+ is enabled.
        await this.setObjectNotExistsAsync("evePlus.map.cloudSession", {
            type: "state",
            common: { name: "Encrypted Xiaomi Cloud session (internal persistence)", type: "string", role: "text", read: false, write: false },
            native: {}
        });
        // Start Xiaomi independently before Roidmi-specific validation/early returns.
        // This allows Xiaomi-only installations and prevents one robot's config from blocking the other.
        if (isXiaomiEnabled(config)) void this.startXiaomiPolling(config);
        // Restore the existing Xiaomi Cloud session before device-specific early returns.
        // This also makes cloud control available in Xiaomi-only installations.
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

        const globalErrors = validateConfig(config);

        await this.setStateChangedAsync("evePlus.info.connection", { val: false, ack: true });
        if (globalErrors.length) {
            const message = globalErrors.join(" ");
            await this.setStateChangedAsync("evePlus.info.connectionText", { val: message, ack: true });
            this.log.error(message);
            return;
        }

        // Xiaomi-only mode must not initialize the Roidmi client or poller.
        if (!isRoidmiEnabled(config)) {
            await this.setStateChangedAsync("evePlus.info.connectionText", {
                val: "Roidmi EVE Plus disabled in configuration.", ack: true
            });
            return;
        }

        const roidmiErrors = validateRoidmiConfig(config);
        if (roidmiErrors.length) {
            const message = roidmiErrors.join(" ");
            await this.setStateChangedAsync("evePlus.info.connectionText", { val: message, ack: true });
            this.log.error(message);
            return;
        }

        // Keep a small miIO trace in memory and only emit it when a request fails.
        // This avoids flooding the ioBroker log during normal polling.
        const miioTrace: string[] = [];
        this.client = new MiioClient({
            host: config.host!,
            token: config.token!,
            debug: true,
            onDebug: (message) => {
                miioTrace.push(message);
                if (miioTrace.length > 20) miioTrace.shift();
            }
        });
        const maintenanceProperties = [
            { id: "filterLife", siid: 10, piid: 1, name: "Filter life", kind: "percent" },
            { id: "filterLeftMinutes", siid: 10, piid: 2, name: "Filter remaining time", kind: "minutes" },
            { id: "mainBrushLife", siid: 11, piid: 2, name: "Main brush life", kind: "percent" },
            { id: "mainBrushLeftMinutes", siid: 11, piid: 1, name: "Main brush remaining time", kind: "minutes" },
            { id: "sideBrushLife", siid: 12, piid: 2, name: "Side brush life", kind: "percent" },
            { id: "sideBrushLeftMinutes", siid: 12, piid: 1, name: "Side brush remaining time", kind: "minutes" },
            { id: "sensorDirtyLife", siid: 15, piid: 2, name: "Sensor cleaning life", kind: "percent" },
            { id: "sensorDirtyLeftMinutes", siid: 15, piid: 1, name: "Sensor cleaning remaining time", kind: "minutes" }
        ] as const;

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

        for (const property of maintenanceProperties) {
            await this.setObjectNotExistsAsync("evePlus.status." + property.id, {
                type: "state",
                common: { name: property.name, type: "number", role: "value", read: true, write: false },
                native: { siid: property.siid, piid: property.piid }
            });
        }

        const controls = [
            { id: "resetFilter", name: "Reset filter life" },
            { id: "resetMainBrush", name: "Reset main brush life" },
            { id: "resetSideBrush", name: "Reset side brush life" },
            { id: "resetSensors", name: "Reset sensor cleaning life" },
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
        await this.setObjectNotExistsAsync("evePlus.control.updateSchedule", {
            type: "state",
            common: { name: "Update an existing EVE Plus schedule (JSON: index, expectedRaw, update)", type: "string", role: "json", read: false, write: true, def: "" },
            native: {}
        });
        await this.subscribeStatesAsync("evePlus.control.updateSchedule");
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

        let lastMaintenancePoll = 0;
        const poll = async (): Promise<void> => {
            if (!this.client || this.stopping || this.commandRunning) return;
            this.commandRunning = true;
            try {
                // Roidmi EVE Plus local MIoT also drops oversized property batches.
                // Independent HA reports use max_properties=6 for this model.
                // Use a single batch when possible, otherwise split into two calls.
                miioTrace.length = 0;
                const maxPropertiesPerRequest = 6;
                for (let offset = 0; offset < properties.length; offset += maxPropertiesPerRequest) {
                    const batchProperties = properties.slice(offset, offset + maxPropertiesPerRequest);
                    const batchLabel = `EVE Plus batch ${Math.floor(offset / maxPropertiesPerRequest) + 1}/${Math.ceil(properties.length / maxPropertiesPerRequest)} [${batchProperties.map(p => `s${p.siid}p${p.piid}:${p.id}`).join(", ")}]`;
                    miioTrace.length = 0;
                    let result: unknown;
                    try {
                        result = await this.client.call("get_properties", batchProperties.map((property) => ({
                            did: config.did, siid: property.siid, piid: property.piid
                        })));
                    } catch (firstError) {
                        const firstMessage = firstError instanceof Error ? firstError.message : String(firstError);
                        if (!firstMessage.includes("timed out")) throw firstError;
                        this.log.warn(`[miIO] ${batchLabel} timed out; retrying this batch once`);
                        for (const line of miioTrace) this.log.debug(`[miIO] ${batchLabel} first attempt: ${line}`);
                        miioTrace.length = 0;
                        try {
                            result = await this.client.call("get_properties", batchProperties.map((property) => ({
                                did: config.did, siid: property.siid, piid: property.piid
                            })));
                        } catch (retryError) {
                            const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
                            this.log.warn(`[miIO] ${batchLabel} retry failed: ${retryMessage}`);
                            for (const line of miioTrace) this.log.debug(`[miIO] ${batchLabel} retry trace: ${line}`);
                            throw retryError;
                        }
                    }
                    if (!Array.isArray(result)) throw new Error("Unexpected MIoT property response");
                    for (let index = 0; index < batchProperties.length; index++) {
                    const property = batchProperties[index];
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
                }
                if (Date.now() - lastMaintenancePoll >= 300_000) {
                    for (let offset = 0; offset < maintenanceProperties.length; offset += maxPropertiesPerRequest) {
                        const batch = maintenanceProperties.slice(offset, offset + maxPropertiesPerRequest);
                        const result = await this.client.call("get_properties", batch.map(property => ({
                            did: config.did, siid: property.siid, piid: property.piid
                        })));
                        if (!Array.isArray(result)) throw new Error("Unexpected EVE Plus maintenance response");
                        for (let index = 0; index < batch.length; index++) {
                            const property = batch[index];
                            const item = result[index] as { code?: number; value?: unknown } | undefined;
                            if (item?.code === 0 && typeof item.value === "number") {
                                await this.setStateChangedAsync("evePlus.status." + property.id, { val: item.value, ack: true });
                            } else if (item && typeof item.code === "number" && item.code !== 0) {
                                throw new Error(`EVE Plus maintenance read failed (SIID ${property.siid}, PIID ${property.piid}, code ${item.code})`);
                            }
                        }
                    }
                    lastMaintenancePoll = Date.now();
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
        const view = await this.getObjectViewAsync("system", "state", {
            startkey: this.namespace + ".",
            endkey: this.namespace + ".\u9999"
        });
        for (const row of view.rows ?? []) {
            const oldFullId = row.id;
            if (!oldFullId.startsWith(this.namespace + ".")) continue;
            const oldId = oldFullId.slice(this.namespace.length + 1);
            const newId = mapLegacyStateId(oldId);
            if (!newId) continue;

            const oldObject = row.value;
            if (!oldObject) continue;
            const existingNewObject = await this.getObjectAsync(newId);
            if (!existingNewObject) {
                const { _id: _legacyObjectId, ...migratedObject } = oldObject;
                await this.setObjectAsync(newId, migratedObject);
            }

            // Merge state values independently of object metadata. A target object
            // may already exist from a previous partial migration or adapter startup.
            // Preserve a valid target state; copy the legacy value only when absent.
            const oldState = await this.getStateAsync(oldId);
            if (oldState) {
                const existingNewState = await this.getStateAsync(newId);
                if (!existingNewState) await this.setStateAsync(newId, oldState);
            }
            await this.delObjectAsync(oldId);
        }
        // Remove empty legacy folders left behind by old versions.
        for (const folder of LEGACY_EMPTY_FOLDERS) {
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
        // Ensure the control channel independently inside Xiaomi initialization as well.
        // This makes the object tree resilient to interrupted legacy migrations or
        // installations where the top-level channel creation was incomplete.
        await this.setObjectNotExistsAsync(prefix + "control", {
            type: "channel", common: { name: "Xiaomi X20+ Steuerung" }, native: {}
        });
        const infoStates = [
            ["info.connection", "Xiaomi X20+ connection", "boolean", "indicator.reachable"],
            ["info.connectionText", "Xiaomi X20+ connection status", "string", "text"],
            ["info.lastPoll", "Xiaomi X20+ last successful poll", "string", "date"],
            ["info.pollCount", "Xiaomi X20+ successful poll count", "number", "value"],
            ["info.mopModeReadback", "Raw local MIoT read result for mop water level", "string", "json"],
            ["info.cleanSettingReadback", "Raw local MIoT read result for packed clean settings (SIID 4 / PIID 23)", "string", "json"],
            ["info.mopModeCloudReadback", "Raw Xiaomi Cloud MIoT read result for mop water level (manual)", "string", "json"]
        ] as const;
        for (const [id, name, type, role] of infoStates) {
            const objectId = prefix + id;
            await this.setObjectNotExistsAsync(objectId, {
                type: "state",
                common: { name, type, role, read: true, write: false },
                native: {}
            });
            // Also update metadata on existing installations; setObjectNotExistsAsync
            // alone would leave the diagnostic state missing on older object trees.
            await this.extendObjectAsync(objectId, {
                common: { name, type, role, read: true, write: false }
            });
        }
        // Ensure the diagnostic state exists even on installations where the
        // info channel was created by an older adapter version. Use setObjectAsync
        // here because this is a dedicated diagnostic object whose metadata must
        // be present before the first poll writes its raw response.
        await this.setObjectAsync(prefix + "info.mopModeReadback", {
            type: "state",
            common: {
                name: "Raw MIoT read result for mop water level",
                type: "string",
                role: "json",
                read: true,
                write: false
            },
            native: {}
        });
        // Older Xiaomi poller versions created flat x20Plus.* states. Move those
        // values into the single status channel and remove the obsolete duplicates.
        const legacyXiaomiFields = [
            "status", "fault", "suction", "battery", "chargingState", "cleaningTime",
            "cleaningArea", "cleaningMode", "mopMode", "waterboxStatus", "taskStatus",
            "dryLeftTime", "workMode", "mainBrushLeft", "mainBrushLife", "sideBrushLeft",
            "sideBrushLife", "filterLife", "filterLeft", "mopLife", "mopLeft", "statusText"
        ];
        for (const oldField of legacyXiaomiFields) {
            const oldId = "x20Plus." + oldField;
            const newField = oldField === "status" ? "vacuumState" : oldField;
            const newId = "x20Plus.status." + newField;
            const oldObject = await this.getObjectAsync(oldId);
            if (!oldObject || oldObject.type !== "state") continue;
            await this.setObjectNotExistsAsync(newId, oldObject);
            const oldState = await this.getStateAsync(oldId);
            if (oldState && !(await this.getStateAsync(newId))) {
                await this.setStateAsync(newId, oldState);
            }
            await this.delObjectAsync(oldId);
        }

        // Remove the obsolete nested x20Plus.status.status state left by earlier builds.
        // The channel is x20Plus.status, so the actual vacuum status belongs in vacuumState.
        const obsoleteStatusId = "x20Plus.status.status";
        const obsoleteStatusObject = await this.getObjectAsync(obsoleteStatusId);
        if (obsoleteStatusObject?.type === "state") {
            const oldStatus = await this.getStateAsync(obsoleteStatusId);
            if (oldStatus && !(await this.getStateAsync("x20Plus.status.vacuumState"))) {
                await this.setStateAsync("x20Plus.status.vacuumState", oldStatus);
            }
            await this.delObjectAsync(obsoleteStatusId);
            this.log.info("Removed obsolete Xiaomi X20+ duplicate status state");
        }

        // A legacy installation may have used x20Plus.status as a state object.
        // The flat-state migration above deletes that object after moving its value,
        // which also removes the status channel created earlier in onReady(). Recreate
        // the channel now so the migrated status fields retain the intended hierarchy.
        await this.setObjectNotExistsAsync(prefix + "status", {
            type: "channel", common: { name: "Xiaomi X20+ Status" }, native: {}
        });

        const fastFields = Object.entries(XIAOMI_X20_PLUS_PROPERTIES);
        const consumableFields = Object.entries(XIAOMI_X20_PLUS_CONSUMABLE_PROPERTIES);
        const lifetimeFields = Object.entries(XIAOMI_X20_PLUS_LIFETIME_PROPERTIES);
        const optionalSettingsFields = Object.entries(XIAOMI_X20_PLUS_OPTIONAL_SETTINGS);
        // Maintenance and lifetime counters are read on the slow cycle only.
        const fields = [...fastFields, ...consumableFields, ...lifetimeFields, ...optionalSettingsFields];
        for (const [key, property] of fields) {
            // MIoT property "status" is the vacuum state; avoid creating status.status.
            const stateKey = key === "status" ? "vacuumState" : key;
            await this.setObjectNotExistsAsync(prefix + "status." + stateKey, {
                type: "state",
                common: { name: "Xiaomi X20+ " + key, type: "number", role: "value", read: true, write: false },
                native: { siid: property.siid, piid: property.piid }
            });
        }
        await this.setObjectNotExistsAsync(prefix + "status.statusText", {
            type: "state", common: { name: "Xiaomi X20+ status text", type: "string", role: "text", read: true, write: false }, native: {}
        });
        // X20+ controls: only commands with model-specific evidence are exposed.
        await this.setObjectNotExistsAsync(prefix + "control.start", {
            type: "state",
            common: { name: "Start whole-house cleaning", type: "boolean", role: "button", read: false, write: true, def: false },
            native: { siid: 2, aiid: 1 }
        });
        await this.subscribeStatesAsync(prefix + "control.start");
        // The X20+ locate action did not work reliably; remove the obsolete state from existing installations.
        await this.delObjectAsync(prefix + "control.locate").catch(() => undefined);
        await this.setObjectNotExistsAsync(prefix + "rooms.mapStatus", {
            type: "state", common: { name: "X20+ map refresh status", type: "string", role: "text", read: true, write: false }, native: {}
        });
        await this.setObjectNotExistsAsync(prefix + "rooms.roomsJson", {
            type: "state", common: { name: "X20+ room list (JSON)", type: "string", role: "json", read: true, write: false }, native: {}
        });
        await this.setObjectNotExistsAsync(prefix + "rooms.lastUpdate", {
            type: "state", common: { name: "X20+ map last update", type: "string", role: "date", read: true, write: false }, native: {}
        });
        await this.setObjectNotExistsAsync(prefix + "control.refreshRooms", {
            type: "state", common: { name: "Refresh Xiaomi X20+ room map from cloud", type: "boolean", role: "button", read: false, write: true, def: false }, native: {}
        });
        await this.subscribeStatesAsync(prefix + "control.refreshRooms");
        await this.setObjectNotExistsAsync(prefix + "control.cleanRooms", {
            type: "state",
            common: { name: "X20+ ausgewählte Räume reinigen (JSON: rooms mit segmentId/repeat/suction/water)", type: "string", role: "json", read: false, write: true, def: "" },
            native: { siid: 4, aiid: 1 }
        });
        await this.subscribeStatesAsync(prefix + "control.cleanRooms");
        await this.setObjectNotExistsAsync(prefix + "control.cleanRoomsStatus", { type: "state", common: { name: "X20+ room-clean command status", type: "string", role: "text", read: true, write: false }, native: {} });
        // Xiaomi Home remains the source of truth. Schedules are read only on demand.
        await this.setObjectNotExistsAsync(prefix + "control.refreshSchedules", {
            type: "state", common: { name: "Read cleaning schedules from Xiaomi Home", type: "boolean", role: "button", read: false, write: true, def: false }, native: {}
        });
        await this.subscribeStatesAsync(prefix + "control.refreshSchedules");
        await this.setObjectNotExistsAsync(prefix + "control.setScheduleEnabled", {
            type: "state",
            common: { name: "Enable or disable one saved Xiaomi Home schedule (JSON: id, enabled)", type: "string", role: "json", read: false, write: true, def: "" },
            native: { siid: 8, piid: 2 }
        });
        await this.subscribeStatesAsync(prefix + "control.setScheduleEnabled");
        await this.setObjectNotExistsAsync(prefix + "control.updateSchedule", {
            type: "state",
            common: { name: "Edit one existing Xiaomi Home schedule (JSON)", type: "string", role: "json", read: false, write: true, def: "" },
            native: { siid: 8, piid: 2 }
        });
        await this.subscribeStatesAsync(prefix + "control.updateSchedule");
        await this.setObjectNotExistsAsync(prefix + "timing.raw", {
            type: "state", common: { name: "Raw Xiaomi X20+ schedules (SIID 8 / PIID 2)", type: "string", role: "json", read: true, write: false }, native: { siid: 8, piid: 2 }
        });
        await this.setObjectNotExistsAsync(prefix + "timing.parsed", {
            type: "state", common: { name: "Decoded Xiaomi X20+ schedules", type: "string", role: "json", read: true, write: false }, native: {}
        });
        await this.setObjectNotExistsAsync(prefix + "timing.summary", {
            type: "state", common: { name: "Xiaomi X20+ schedule overview", type: "string", role: "text", read: true, write: false }, native: {}
        });
        await this.setObjectNotExistsAsync(prefix + "timing.status", {
            type: "state", common: { name: "Xiaomi X20+ schedule read status", type: "string", role: "text", read: true, write: false }, native: {}
        });
        await this.setObjectNotExistsAsync(prefix + "timing.lastUpdate", {
            type: "state", common: { name: "Last schedule synchronization with Xiaomi Home", type: "string", role: "date", read: true, write: false }, native: {}
        });
        // Expose the standard C102GL MIoT actions for hardware testing.
        // Different references report local/cloud firmware behavior differently;
        // the real robot test decides whether these actions execute on this firmware.
        const x20Controls = [
            { id: "resetMainBrush", name: "Reset main brush life", siid: 9, aiid: 1 },
            { id: "resetSideBrush", name: "Reset side brush life", siid: 10, aiid: 1 },
            { id: "resetFilter", name: "Reset filter life", siid: 11, aiid: 1 },
            { id: "resetMop", name: "Reset mop life", siid: 18, aiid: 1 },
            { id: "pause", name: "Pause cleaning", siid: 2, aiid: 2 },
            { id: "returnToDock", name: "Return to dock / finish cleaning", siid: 3, aiid: 1 }
        ];
        // Remove the obsolete stop alias from existing installations.
        await this.delObjectAsync(prefix + "control.stop").catch(() => undefined);
        for (const control of x20Controls) {
            await this.setObjectNotExistsAsync(prefix + "control." + control.id, {
                type: "state",
                common: { name: control.name, type: "boolean", role: "button", read: false, write: true, def: false },
                native: { siid: control.siid, aiid: control.aiid }
            });
            await this.subscribeStatesAsync(prefix + "control." + control.id);
        }
        await this.delObjectAsync(prefix + "info.unsupportedCommands").catch(() => undefined);
        await this.setObjectNotExistsAsync(prefix + "control.suction", {
            type: "state",
            common: { name: "Suction power", type: "number", role: "level", min: 0, max: 3, states: { 0: "Leise", 1: "Standard", 2: "Stark", 3: "Turbo" }, read: true, write: true },
            native: { siid: 2, piid: 3 }
        });
        await this.subscribeStatesAsync(prefix + "control.suction");
        await this.setObjectNotExistsAsync(prefix + "status.mopMode", {
            type: "state",
            common: { name: "Wasserfluss beim Wischen", type: "number", role: "level", min: 1, max: 3, states: { 1: "Niedrig", 2: "Mittel", 3: "Hoch" }, read: true, write: false },
            native: { siid: 4, piid: 23, mask: 0x30000, shift: 16 }
        });
        await this.extendObjectAsync(prefix + "status.mopMode", {
            common: { name: "Wasserfluss beim Wischen", type: "number", role: "level", min: 1, max: 3, states: { 1: "Niedrig", 2: "Mittel", 3: "Hoch" }, read: true, write: false },
            native: { siid: 4, piid: 23, mask: 0x30000, shift: 16 }
        });
        await this.setObjectNotExistsAsync(prefix + "control.cleaningMode", {
            type: "state",
            common: { name: "Reinigungsart", type: "number", role: "level", min: 0, max: 3, states: { 0: "Saugen und Wischen", 1: "Wischen", 2: "Saugen", 3: "Saugen vor Wischen" }, read: true, write: true },
            native: { siid: 4, piid: 23, mask: 0x03, shift: 0 }
        });
        // Correct old installations too: cleaningMode is intensity, not vacuum/mop mode.
        // Preserve the stored value while updating only common/native metadata.
        const cleaningModeId = prefix + "control.cleaningMode";
        const cleaningModeObject = await this.getObjectAsync(cleaningModeId);
        if (cleaningModeObject) {
            await this.setObjectAsync(cleaningModeId, {
                ...cleaningModeObject,
                common: {
                    ...cleaningModeObject.common,
                    name: "Reinigungsart",
                    type: "number",
                    role: "level",
                    min: 0,
                    max: 3,
                    states: { 0: "Saugen und Wischen", 1: "Wischen", 2: "Saugen", 3: "Saugen vor Wischen" },
                    read: true,
                    write: true
                },
                native: { ...cleaningModeObject.native, siid: 4, piid: 23, mask: 0x03, shift: 0 }
            } as ioBroker.StateObject);
        }
        await this.subscribeStatesAsync(prefix + "control.cleaningMode");
        // Optional C102GL settings are read on the slow cycle only. These
        // property ids are spec-based and remain unverified on this robot firmware.
        for (const [key, property] of Object.entries(XIAOMI_X20_PLUS_OPTIONAL_SETTINGS)) {
            await this.setObjectNotExistsAsync(prefix + "status." + key, {
                type: "state", common: { name: "Xiaomi X20+ " + key, type: "boolean", role: "indicator", read: true, write: false },
                native: { siid: property.siid, piid: property.piid, provisional: true }
            });
            await this.setObjectNotExistsAsync(prefix + "control." + key, {
                type: "state", common: { name: "Xiaomi X20+ " + key, type: "boolean", role: "switch", read: true, write: true },
                native: { siid: property.siid, piid: property.piid, provisional: true }
            });
            await this.extendObjectAsync(prefix + "status." + key, { common: { type: "boolean", role: "indicator", read: true, write: false }, native: { siid: property.siid, piid: property.piid, provisional: true } });
            await this.extendObjectAsync(prefix + "control." + key, { common: { type: "boolean", role: "switch", read: true, write: true }, native: { siid: property.siid, piid: property.piid, provisional: true } });
            await this.subscribeStatesAsync(prefix + "control." + key);
        }

        await this.setObjectNotExistsAsync(prefix + "control.mopMode", {
            type: "state",
            common: { name: "Wasserfluss beim Wischen", type: "number", role: "level", min: 1, max: 3, states: { 1: "Niedrig", 2: "Mittel", 3: "Hoch" }, read: true, write: true },
            native: { siid: 4, piid: 5 }
        });
        // Correct metadata on existing installations as well (setObjectNotExists
        // does not update common metadata). Keep the value and native data intact.
        await this.extendObjectAsync(prefix + "control.mopMode", {
            common: { name: "Wasserfluss beim Wischen", min: 1, max: 3, states: { 1: "Niedrig", 2: "Mittel", 3: "Hoch" }, read: true, write: true },
            native: { siid: 4, piid: 23, mask: 0x30000, shift: 16 }
        });
        await this.subscribeStatesAsync(prefix + "control.mopMode");
        await this.setObjectNotExistsAsync(prefix + "control.readMopModeCloud", {
            type: "state",
            common: {
                name: "Read mop water level once via Xiaomi Cloud (diagnostic)",
                type: "boolean",
                role: "button",
                read: false,
                write: true,
                def: false
            },
            native: {}
        });
        await this.subscribeStatesAsync(prefix + "control.readMopModeCloud");

        await this.setStateChangedAsync(prefix + "info.connection", { val: false, ack: true });

        const xiaomiErrors = validateXiaomiConfig(config);
        if (xiaomiErrors.length) {
            const message = xiaomiErrors.join(" ");
            await this.setStateChangedAsync(prefix + "info.connectionText", { val: message, ack: true });
            this.log.warn("Xiaomi X20+ configuration invalid: " + message);
            return;
        }
        // Keep a bounded trace of the Xiaomi UDP handshake/RPC so a timeout can
        // be diagnosed (handshake vs. MIoT response) without logging tokens.
        const client = new MiioClient({
            host: config.xiaomiHost!,
            token: config.xiaomiToken!,
            // Reuse the last successful device handshake; MiioClient seeds the
            // response state so the RPC reply is not mistaken for a new handshake.
            reuseHandshake: true,
            debug: true,
            onDebug: (message) => {
                this.xiaomiMiioTrace.push(message);
                if (this.xiaomiMiioTrace.length > 20) this.xiaomiMiioTrace.shift();
            }
        });
        this.xiaomiClient = client;
        const interval = (config.pollIntervalSeconds ?? 30) * 1000;
        let pollCount = 0;
        let lastConsumablesPoll = 0;
        let failures = 0;
        let lastError = "";
        const poll = async (): Promise<void> => {
            if (this.stopping || this.xiaomiPollRunning || this.xiaomiCommandRunning) return;
            this.xiaomiPollRunning = true;
            try {
                const includeConsumables = Date.now() - lastConsumablesPoll >= XIAOMI_X20_PLUS_CONSUMABLE_POLL_INTERVAL_MS;
                const requestedFields = includeConsumables ? fields : fastFields;
                // C102GL firmware silently drops oversized get_properties responses.
                // Independent integrations have verified batches of 10; use 8 to
                // leave room for larger values and avoid UDP response truncation.
                const maxPropertiesPerRequest = 8;
                for (let offset = 0; offset < requestedFields.length; offset += maxPropertiesPerRequest) {
                    const batchFields = requestedFields.slice(offset, offset + maxPropertiesPerRequest);
                    const batchLabel = `Xiaomi X20+ batch ${Math.floor(offset / maxPropertiesPerRequest) + 1}/${Math.ceil(requestedFields.length / maxPropertiesPerRequest)} [${batchFields.map(([key, p]) => `${key}:s${p.siid}p${p.piid}`).join(", ")}]`;
                    this.xiaomiMiioTrace.length = 0;
                    let result: unknown;
                    try {
                        result = await client.call("get_properties", batchFields.map(([, property]) => ({
                            did: config.xiaomiDid!, siid: property.siid, piid: property.piid
                        })));
                    } catch (firstError) {
                        const firstMessage = firstError instanceof Error ? firstError.message : String(firstError);
                        if (!firstMessage.includes("timed out")) throw firstError;
                        this.log.warn(`[miIO] ${batchLabel} timed out; retrying this batch once`);
                        for (const line of this.xiaomiMiioTrace) this.log.debug(`[miIO] ${batchLabel} first attempt: ${line}`);
                        this.xiaomiMiioTrace.length = 0;
                        try {
                            result = await client.call("get_properties", batchFields.map(([, property]) => ({
                                did: config.xiaomiDid!, siid: property.siid, piid: property.piid
                            })));
                        } catch (retryError) {
                            const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
                            this.log.warn(`[miIO] ${batchLabel} retry failed: ${retryMessage}`);
                            for (const line of this.xiaomiMiioTrace) this.log.debug(`[miIO] ${batchLabel} retry trace: ${line}`);
                            throw retryError;
                        }
                    }
                    if (!Array.isArray(result)) throw new Error("Unexpected Xiaomi MIoT property response");
                    // MIoT responses carry the requested service/property identifiers.
                    // Match by SIID/PIID instead of assuming the firmware preserves request
                    // order; this is especially important for settings such as mopMode.
                    const responseByProperty = new Map<string, { code?: number; value?: unknown }>();
                    for (const entry of result as Array<{ siid?: number; piid?: number; code?: number; value?: unknown }>) {
                        if (typeof entry?.siid === "number" && typeof entry?.piid === "number") {
                            responseByProperty.set(`${entry.siid}/${entry.piid}`, entry);
                        }
                    }
                    for (let index = 0; index < batchFields.length; index++) {
                    const [key, requestedProperty] = batchFields[index];
                    const item = responseByProperty.get(`${requestedProperty.siid}/${requestedProperty.piid}`)
                        ?? result[index] as { code?: number; value?: unknown } | undefined;
                    // Expose the existing poll response for mopMode without issuing an extra
                    // robot request or flooding the log. This distinguishes stale device data
                    // from a state-update/mapping problem.
                    if (key === "mopMode") {
                        await this.setStateChangedAsync(prefix + "info.mopModeReadback", {
                            val: JSON.stringify({ siid: requestedProperty.siid, piid: requestedProperty.piid, code: item?.code ?? null, value: item?.value ?? null }),
                            ack: true
                        });
                    }
                    // cleaningMode already belongs to the regular fast poll. Preserve
                    // its complete packed value for diagnosis; the public control state
                    // below continues exposing only the documented low two mode bits.
                    if (requestedProperty.siid === 4 && requestedProperty.piid === 23) {
                        await this.setStateChangedAsync(prefix + "info.cleanSettingReadback", {
                            val: JSON.stringify({ siid: requestedProperty.siid, piid: requestedProperty.piid, code: item?.code ?? null, value: item?.value ?? null, readAt: new Date().toISOString() }),
                            ack: true
                        });
                        // Decode the water level by the MIoT property identity, not by
                        // the public cleaningMode state key. Both controls share packed
                        // property 4/23, and this keeps water-level synchronization
                        // independent from the low-bit cleaning-mode mapping.
                        if (item?.code === 0 && typeof item.value === "number") {
                            const waterLevel = (item.value >>> 16) & 0x03;
                            if (waterLevel >= 1 && waterLevel <= 3) {
                                await this.setStateChangedAsync(prefix + "status.mopMode", { val: waterLevel, ack: true });
                                await this.setStateChangedAsync(prefix + "control.mopMode", { val: waterLevel, ack: true });
                            }
                        }
                    }
                    if (item?.code === 0 && (typeof item.value === "number" || typeof item.value === "boolean")) {
                        const rawValue = typeof item.value === "boolean" ? Number(item.value) : item.value;
                        const value = key === "cleaningMode" && typeof rawValue === "number" ? rawValue & 0x03 : rawValue;
                        // The MIoT property is named "status", but "status" is already
                        // the channel. Store the value as vacuumState to avoid status.status.
                        const stateKey = key === "status" ? "vacuumState" : key;
                        const optionalBooleanSetting = key === "childLock" || key === "carpetBoost" || key === "resumeAfterCharging";
                        await this.setStateChangedAsync(prefix + "status." + stateKey, { val: optionalBooleanSetting ? Boolean(value) : value, ack: true });
                        if (optionalBooleanSetting) {
                            await this.setStateChangedAsync(prefix + "control." + key, { val: Boolean(value), ack: true });
                        }
                        if (key === "suction" || key === "cleaningMode") {
                            const controlValue = key === "cleaningMode" ? Number(value) & 0x03 : value;
                            await this.setStateChangedAsync(prefix + "control." + key, { val: controlValue, ack: true });
                        }
                        if (key === "vacuumState") {
                            await this.setStateChangedAsync(prefix + "status.statusText", {
                                val: getXiaomiX20PlusStatusText(value), ack: true
                            });
                            if (this.xiaomiRoomCleanTracker) {
                                const observation = observeRoomCleanStatus(this.xiaomiRoomCleanTracker, value);
                                await this.setStateChangedAsync(prefix + "control.cleanRoomsStatus", { val: observation.message, ack: true });
                                if (observation.state !== "pending") this.xiaomiRoomCleanTracker = undefined;
                            }
                        }
                    }
                    }
                }
                pollCount++;
                if (includeConsumables) lastConsumablesPoll = Date.now();
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
                if (message !== lastError) {
                    this.log.warn("Xiaomi X20+ poll failed: " + message);
                    // Emit trace only on failure; normal successful polls remain quiet.
                    for (const traceLine of this.xiaomiMiioTrace) this.log.debug("Xiaomi miIO trace: " + traceLine);
                }
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

        // Read-only Xiaomi Home schedule sync: one cloud property read every 30 minutes.
        // If another Xiaomi command is active, defer by one minute instead of overlapping it.
        const scheduleSyncInterval = 30 * 60 * 1000;
        const scheduleSync = (): void => {
            if (this.stopping) return;
            this.xiaomiScheduleTimer = setTimeout(async () => {
                if (this.stopping) return;
                if (this.xiaomiCommandRunning) {
                    this.log.debug("Xiaomi X20+ schedule sync deferred because another command is running");
                    this.xiaomiScheduleTimer = setTimeout(scheduleSync, 60 * 1000);
                    return;
                }
                if (!this.cloudMapClient.hasSession()) {
                    await this.setStateChangedAsync(prefix + "timing.status", {
                        val: "Automatische Synchronisierung übersprungen: Xiaomi-Cloud-Sitzung nicht verfügbar.",
                        ack: true
                    });
                    scheduleSync();
                    return;
                }
                await this.setStateAsync(prefix + "control.refreshSchedules", { val: true, ack: false });
                scheduleSync();
            }, scheduleSyncInterval);
        };
        scheduleSync();
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

        const xiaomiControlPrefix = this.namespace + ".x20Plus.control.";
        if (id.startsWith(xiaomiControlPrefix)) {
            const command = id.slice(xiaomiControlPrefix.length);
            if (command === "readMopModeCloud") {
                if (state.val === true) {
                    const config = this.config as RoidmiAdapterConfig;
                    try {
                        if (!config.xiaomiDid) throw new Error("Xiaomi X20+ DID is missing from adapter configuration.");
                        if (!this.cloudMapClient.hasSession()) {
                            throw new Error("Xiaomi Cloud session is unavailable. Use the existing Xiaomi Cloud login first.");
                        }
                        if (this.xiaomiCommandRunning) {
                            throw new Error("Another Xiaomi command is running; retry the manual cloud read afterwards.");
                        }
                        this.xiaomiCommandRunning = true;
                        const result = await this.cloudMapClient.getProperties(
                            config.cloudCountry || "de",
                            config.xiaomiDid,
                            [{ siid: 4, piid: 5 }],
                            async () => {
                                await this.setStateAsync("evePlus.map.cloudSession", {
                                    val: this.encrypt(this.cloudMapClient.exportSession()), ack: true
                                });
                            },
                            2
                        );
                        const snapshot = {
                            source: "Xiaomi Cloud MIoT /v2/miotspec/prop/get",
                            datasource: 2,
                            requestedAt: new Date().toISOString(),
                            siid: 4,
                            piid: 5,
                            result
                        };
                        await this.setStateAsync("x20Plus.info.mopModeCloudReadback", {
                            val: JSON.stringify(snapshot),
                            ack: true
                        });
                        this.log.info("Xiaomi X20+ mopMode cloud read completed: " + JSON.stringify(result));
                    } catch (error) {
                        const message = error instanceof Error ? error.message : "Unknown Xiaomi Cloud read error";
                        await this.setStateAsync("x20Plus.info.mopModeCloudReadback", {
                            val: JSON.stringify({ source: "Xiaomi Cloud MIoT", requestedAt: new Date().toISOString(), error: message }),
                            ack: true
                        });
                        this.log.warn("Xiaomi X20+ mopMode cloud read failed: " + message);
                    } finally {
                        this.xiaomiCommandRunning = false;
                    }
                }
                await this.setStateAsync("x20Plus.control.readMopModeCloud", { val: false, ack: true });
                return;
            }
            if (command === "updateSchedule") {
                if (typeof state.val === "string" && state.val.trim()) {
                    const config = this.config as RoidmiAdapterConfig;
                    let acquired = false; let id = "unknown";
                    try {
                        if (!config.xiaomiDid || !this.cloudMapClient.hasSession()) throw new Error("Xiaomi Cloud session unavailable.");
                        if (this.xiaomiCommandRunning) throw new Error("Another Xiaomi command is running.");
                        const request=JSON.parse(state.val) as {id?:unknown;update?:XiaomiCleaningScheduleUpdate};
                        if(typeof request.id!=="string"||!request.update) throw new Error("Invalid schedule edit request.");
                        id=request.id;this.xiaomiCommandRunning=true;acquired=true;
                        await this.setStateAsync("x20Plus.timing.status",{val:"Bearbeite Zeitplan #"+id+" in Xiaomi Home…",ack:true});
                        const country=config.cloudCountry||"de",persist=async()=>this.persistCloudSession();
                        const read=await this.cloudMapClient.getProperties(country,config.xiaomiDid,[{siid:8,piid:2}],persist,2);
                        const current=Array.isArray(read)?read[0] as {code?:number;value?:unknown}:undefined;
                        if(!current||current.code!==0||typeof current.value!=="string") throw new Error("Direct robot schedule read failed.");
                        const updated=updateXiaomiCleaningSchedule(current.value,id,request.update);
                        const write=await this.cloudMapClient.setProperties(country,config.xiaomiDid,[{siid:8,piid:2,value:updated}],persist);
                        const result=Array.isArray(write)?write[0] as {code?:number}:undefined;
                        if(!result||result.code!==0) throw new Error("Xiaomi rejected schedule edit (MIoT "+String(result?.code??"unknown")+").");
                        // The write is accepted. Publish the requested state immediately; a slow
                        // direct readback must not turn a successful write into a false failure.
                        const roomState=await this.getStateAsync("x20Plus.rooms.roomsJson");let roomNames=new Map<number,string>();
                        if(typeof roomState?.val==="string") try {const rooms=JSON.parse(roomState.val) as Array<{segmentId?:number;name?:string}>;roomNames=new Map(rooms.filter(x=>Number.isInteger(x.segmentId)&&typeof x.name==="string").map(x=>[x.segmentId!,x.name!]));}catch{/* keep IDs */}
                        const intended=parseXiaomiCleaningSchedules(updated,roomNames);
                        const intendedSummary=intended.map(e=>"#"+e.id+" | "+(e.enabled?"Aktiv":"Deaktiviert")+" | "+e.time+" | "+e.weekdaysText+" | "+e.cleaningModeText+" | "+e.fanSpeedText+" | Wasser "+e.waterLevelText+" | Räume: "+e.roomsText).join("\\n");
                        await this.setStateChangedAsync("x20Plus.timing.raw",{val:updated,ack:true});
                        await this.setStateChangedAsync("x20Plus.timing.parsed",{val:JSON.stringify(intended,null,2),ack:true});
                        await this.setStateChangedAsync("x20Plus.timing.summary",{val:intendedSummary,ack:true});
                        await this.setStateChangedAsync("x20Plus.timing.lastUpdate",{val:new Date().toISOString(),ack:true});
                        await this.setStateAsync("x20Plus.timing.status",{val:"Änderung für Zeitplan #"+id+" von Xiaomi angenommen; direkte Bestätigung wird nachgeholt.",ack:true});
                        try {
                            const readback=await this.cloudMapClient.getProperties(country,config.xiaomiDid,[{siid:8,piid:2}],persist,2);
                            const verified=Array.isArray(readback)?readback[0] as {code?:number;value?:unknown}:undefined;
                            if(!verified||verified.code!==0||typeof verified.value!=="string") throw new Error("MIoT "+String(verified?.code??"unknown"));
                            verifyXiaomiCleaningScheduleDetailsUpdate(current.value,verified.value,id,request.update);
                            const confirmed=parseXiaomiCleaningSchedules(verified.value,roomNames);
                            const confirmedSummary=confirmed.map(e=>"#"+e.id+" | "+(e.enabled?"Aktiv":"Deaktiviert")+" | "+e.time+" | "+e.weekdaysText+" | "+e.cleaningModeText+" | "+e.fanSpeedText+" | Wasser "+e.waterLevelText+" | Räume: "+e.roomsText).join("\\n");
                            await this.setStateChangedAsync("x20Plus.timing.raw",{val:verified.value,ack:true});
                            await this.setStateChangedAsync("x20Plus.timing.parsed",{val:JSON.stringify(confirmed,null,2),ack:true});
                            await this.setStateChangedAsync("x20Plus.timing.summary",{val:confirmedSummary,ack:true});
                            await this.setStateAsync("x20Plus.timing.status",{val:"Zeitplan #"+id+" bearbeitet und direkt am Roboter bestätigt.",ack:true});
                        } catch(readError) {
                            const detail=readError instanceof Error?readError.message:"Timeout";
                            await this.setStateAsync("x20Plus.timing.status",{val:"Änderung für Zeitplan #"+id+" von Xiaomi angenommen; direkte Bestätigung steht noch aus ("+detail+"). Bitte später aktualisieren.",ack:true});
                            this.log.info("Xiaomi X20+ schedule #"+id+" write accepted; direct readback is pending: "+detail);
                        }
                    } catch(error) {
                        const message=error instanceof Error?error.message:"Unknown schedule edit error";
                        await this.setStateAsync("x20Plus.timing.status",{val:"Zeitplanbearbeitung fehlgeschlagen: "+message,ack:true});
                        this.log.warn("Xiaomi X20+ schedule edit failed: "+message);
                    } finally {if(acquired)this.xiaomiCommandRunning=false;}
                }
                await this.setStateAsync("x20Plus.control.updateSchedule",{val:"",ack:true});return;
            }
            if (command === "setScheduleEnabled") {
                if (typeof state.val === "string" && state.val.trim()) {
                    const config = this.config as RoidmiAdapterConfig;
                    let commandLockAcquired = false;
                    try {
                        if (!config.xiaomiDid) throw new Error("Xiaomi X20+ DID is missing from adapter configuration.");
                        if (!this.cloudMapClient.hasSession()) throw new Error("Xiaomi Cloud session unavailable. Sign in through the existing Xiaomi Cloud login first.");
                        if (this.xiaomiCommandRunning) throw new Error("Another Xiaomi command is running; retry the schedule change afterwards.");
                        const request = JSON.parse(state.val) as { id?: unknown; enabled?: unknown };
                        if (typeof request.id !== "string" || !request.id.trim() || typeof request.enabled !== "boolean") {
                            throw new Error("Schedule command must contain a string id and boolean enabled value.");
                        }
                        this.xiaomiCommandRunning = true;
                        commandLockAcquired = true;
                        await this.setStateAsync("x20Plus.timing.status", { val: "Ändere Zeitplan #" + request.id + " in Xiaomi Home…", ack: true });
                        const country = config.cloudCountry || "de";
                        const onSessionChanged = async () => this.persistCloudSession();
                        const currentResult = await this.cloudMapClient.getProperties(country, config.xiaomiDid, [{ siid: 8, piid: 2 }], onSessionChanged, 2);
                        if (!Array.isArray(currentResult)) throw new Error("Unexpected Xiaomi schedule response before write.");
                        const current = currentResult[0] as { code?: number; value?: unknown } | undefined;
                        if (!current || current.code !== 0 || current.value === undefined) throw new Error("Could not read the current Xiaomi schedules (MIoT code " + String(current?.code ?? "unknown") + ").");
                        this.log.info("Xiaomi X20+ schedule #"+request.id+" write: reading current value directly from robot (datasource 2).");
                        const updatedRaw = setXiaomiCleaningScheduleEnabled(current.value, request.id, request.enabled);
                        const writeResult = await this.cloudMapClient.setProperties(country, config.xiaomiDid, [{ siid: 8, piid: 2, value: updatedRaw }], onSessionChanged);
                        const writeItems = Array.isArray(writeResult) ? writeResult : [];
                        if (!writeItems[0] || (writeItems[0] as { code?: number }).code !== 0) {
                            throw new Error("Xiaomi rejected the schedule update (MIoT code " + String((writeItems[0] as { code?: number } | undefined)?.code ?? "unknown") + ").");
                        }
                        const verifyResult = await this.cloudMapClient.getProperties(country, config.xiaomiDid, [{ siid: 8, piid: 2 }], onSessionChanged, 2);
                        this.log.info("Xiaomi X20+ schedule #"+request.id+" write: readback received directly from robot (datasource 2).");
                        if (!Array.isArray(verifyResult)) throw new Error("Unexpected Xiaomi schedule readback response.");
                        const verified = verifyResult[0] as { code?: number; value?: unknown } | undefined;
                        if (!verified || verified.code !== 0 || typeof verified.value !== "string") throw new Error("Schedule write was sent, but Xiaomi readback failed (MIoT code " + String(verified?.code ?? "unknown") + ").");
                        verifyXiaomiCleaningScheduleUpdate(current.value, verified.value, request.id, request.enabled);
                        let roomNames = new Map<number, string>();
                        const roomsState = await this.getStateAsync("x20Plus.rooms.roomsJson");
                        if (typeof roomsState?.val === "string" && roomsState.val.trim()) {
                            try {
                                const rooms = JSON.parse(roomsState.val) as Array<{ segmentId?: number; name?: string }>;
                                roomNames = new Map(rooms.filter((room) => Number.isInteger(room.segmentId) && typeof room.name === "string").map((room): [number, string] => [room.segmentId!, room.name!]));
                            } catch { this.log.debug("Xiaomi X20+ room map unavailable while updating schedule display."); }
                        }
                        const parsed = parseXiaomiCleaningSchedules(verified.value, roomNames);
                        const summary = parsed.map(entry => "#" + entry.id + " | " + (entry.enabled ? "Aktiv" : "Deaktiviert") + " | " + entry.time + " | " + entry.weekdaysText + " | " + entry.cleaningModeText + " | " + entry.fanSpeedText + " | Wasser " + entry.waterLevelText + " | Räume: " + entry.roomsText).join("\\n") || "Keine Zeitpläne in Xiaomi Home gespeichert.";
                        await this.setStateChangedAsync("x20Plus.timing.raw", { val: verified.value, ack: true });
                        await this.setStateChangedAsync("x20Plus.timing.parsed", { val: JSON.stringify(parsed, null, 2), ack: true });
                        await this.setStateChangedAsync("x20Plus.timing.summary", { val: summary, ack: true });
                        await this.setStateChangedAsync("x20Plus.timing.lastUpdate", { val: new Date().toISOString(), ack: true });
                        await this.setStateAsync("x20Plus.timing.status", { val: "Zeitplan #" + request.id + " in Xiaomi Home dauerhaft " + (request.enabled ? "aktiviert" : "deaktiviert") + " und per Readback bestätigt.", ack: true });
                        this.log.info("Xiaomi X20+ schedule #" + request.id + " " + (request.enabled ? "enabled" : "disabled") + " and verified via SIID 8 / PIID 2.");
                    } catch (error) {
                        const message = error instanceof Error ? error.message : "Unknown Xiaomi schedule write error";
                        await this.setStateAsync("x20Plus.timing.status", { val: "Zeitplanänderung fehlgeschlagen: " + message, ack: true });
                        this.log.warn("Xiaomi X20+ schedule update failed: " + message);
                    } finally {
                        if (commandLockAcquired) this.xiaomiCommandRunning = false;
                    }
                }
                await this.setStateAsync("x20Plus.control.setScheduleEnabled", { val: "", ack: true });
                return;
            }
            if (command === "refreshSchedules") {
                if (state.val === true) {
                    const config = this.config as RoidmiAdapterConfig;
                    try {
                        if (!config.xiaomiDid) throw new Error("Xiaomi X20+ DID is missing from adapter configuration.");
                        if (!this.cloudMapClient.hasSession()) throw new Error("Xiaomi Cloud session unavailable. Sign in through the existing Xiaomi Cloud login first.");
                        if (this.xiaomiCommandRunning) throw new Error("Another Xiaomi command is running; retry the schedule read afterwards.");
                        this.xiaomiCommandRunning = true;
                        await this.setStateAsync("x20Plus.timing.status", { val: "Lese Zeitpläne aus Xiaomi Home…", ack: true });
                        const onSessionChanged = async () => this.persistCloudSession();
                        // Compare Xiaomi's server cache (datasource 1) with a direct device RPC
                        // (datasource 2). This is a manual refresh only; datasource 2 is used
                        // for the displayed schedule list because it returns the device's latest value.
                        const cachedResult = await this.cloudMapClient.getProperties(
                            config.cloudCountry || "de", config.xiaomiDid, [{ siid: 8, piid: 2 }], onSessionChanged, 1
                        );
                        if (!Array.isArray(cachedResult)) throw new Error("Unexpected Xiaomi cached schedule response.");
                        const cachedItem = cachedResult[0] as { code?: number; value?: unknown } | undefined;
                        if (!cachedItem || cachedItem.code !== 0 || cachedItem.value === undefined) {
                            throw new Error("Xiaomi cached schedule read failed (MIoT code " + String(cachedItem?.code ?? "unknown") + ").");
                        }
                        // Datasource 2 bypasses Xiaomi's possibly stale server cache and asks the robot directly.
                        const freshResult = await this.cloudMapClient.getProperties(
                            config.cloudCountry || "de", config.xiaomiDid, [{ siid: 8, piid: 2 }], onSessionChanged, 2
                        );
                        if (!Array.isArray(freshResult)) throw new Error("Unexpected direct Xiaomi schedule response.");
                        const item = freshResult[0] as { code?: number; value?: unknown } | undefined;
                        if (!item || item.code !== 0 || item.value === undefined) {
                            throw new Error("Direct robot schedule read failed (MIoT code " + String(item?.code ?? "unknown") + "); cached data was not used to avoid showing stale schedules.");
                        }
                        const cachedRaw = typeof cachedItem.value === "string" ? cachedItem.value : JSON.stringify(cachedItem.value);
                        const freshRaw = typeof item.value === "string" ? item.value : JSON.stringify(item.value);
                        const cacheDiffers = cachedRaw !== freshRaw;
                        this.log.info(
                            "Xiaomi X20+ schedule sources compared: datasource 1 (server cache) " +
                            (cacheDiffers ? "DIFFERS" : "matches") +
                            " datasource 2 (direct robot read); using datasource 2 as current source."
                        );
                        let roomNames = new Map<number, string>();
                        const roomsState = await this.getStateAsync("x20Plus.rooms.roomsJson");
                        if (typeof roomsState?.val === "string" && roomsState.val.trim()) {
                            try {
                                const rooms = JSON.parse(roomsState.val) as Array<{ segmentId?: number; name?: string }>;
                                roomNames = new Map(rooms.filter((room) => Number.isInteger(room.segmentId) && typeof room.name === "string").map((room): [number, string] => [room.segmentId!, room.name!]));
                            } catch { this.log.debug("Xiaomi X20+ room map unavailable while decoding schedule room names."); }
                        }
                        const parsed = parseXiaomiCleaningSchedules(item.value, roomNames);
                        const raw = typeof item.value === "string" ? item.value : JSON.stringify(item.value);
                        const summary = parsed.map((entry) => "#" + entry.id + " | " + (entry.enabled ? "Aktiv" : "Deaktiviert") + " | " + entry.time + " | " + entry.weekdaysText + " | " + entry.cleaningModeText + " | " + entry.fanSpeedText + " | Wasser " + entry.waterLevelText + " | Räume: " + entry.roomsText).join("\\n") || "Keine Zeitpläne in Xiaomi Home gespeichert.";
                        await this.setStateChangedAsync("x20Plus.timing.raw", { val: raw, ack: true });
                        await this.setStateChangedAsync("x20Plus.timing.parsed", { val: JSON.stringify(parsed, null, 2), ack: true });
                        await this.setStateChangedAsync("x20Plus.timing.summary", { val: summary, ack: true });
                        await this.setStateChangedAsync("x20Plus.timing.lastUpdate", { val: new Date().toISOString(), ack: true });
                        const status = parsed.some((entry) => entry.parseError) ? "Zeitpläne gelesen; mindestens ein Eintrag konnte nicht vollständig dekodiert werden." : parsed.length + " Zeitplan(e) aus Xiaomi Home gelesen.";
                        await this.setStateAsync("x20Plus.timing.status", { val: status, ack: true });
                        this.log.info("Xiaomi X20+ schedules synchronized from Xiaomi Home (SIID 8 / PIID 2): " + parsed.length + " entries.");
                    } catch (error) {
                        const message = error instanceof Error ? error.message : "Unknown Xiaomi schedule read error";
                        await this.setStateAsync("x20Plus.timing.status", { val: "Zeitplan-Synchronisierung fehlgeschlagen: " + message, ack: true });
                        this.log.warn("Xiaomi X20+ schedule synchronization failed: " + message);
                    } finally { this.xiaomiCommandRunning = false; }
                }
                await this.setStateAsync("x20Plus.control.refreshSchedules", { val: false, ack: true });
                return;
            }
            if (command === "refreshRooms") {
                if (state.val === true) {
                    const config = this.config as RoidmiAdapterConfig;
                    try {
                        if (!this.cloudMapClient.hasSession()) {
                            throw new Error("Xiaomi Cloud session is unavailable. Sign in through the existing EVE Plus cloud-map login first.");
                        }
                        if (!config.xiaomiDid) throw new Error("Xiaomi X20+ DID is missing from adapter configuration.");
                        await this.setStateAsync("x20Plus.rooms.mapStatus", { val: "Refreshing saved X20+ map from Xiaomi Cloud…", ack: true });
                        const rooms = await this.cloudMapClient.fetchXiaomiRooms(config.cloudCountry || "de", config.xiaomiDid, async () => {
                            await this.persistCloudSession();
                        });
                        // Only Xiaomi Home rooms have a roomId. Exclude outdoor/window false-positive segments.
                        const selectableRooms = filterXiaomiHomeRooms(rooms);
                        const json = JSON.stringify(selectableRooms, null, 2);
                        await this.setStateAsync("x20Plus.rooms.roomsJson", { val: json, ack: true });
                        const oldSegments = await this.getObjectAsync("x20Plus.rooms.segments");
                        if (oldSegments) await this.delObjectAsync("x20Plus.rooms.segments", { recursive: true });
                        await this.setObjectNotExistsAsync("x20Plus.rooms.segments", { type: "channel", common: { name: "Selectable Xiaomi Home rooms" }, native: {} });
                        for (const room of selectableRooms) {
                            const channel = "x20Plus.rooms.segments." + room.segmentId;
                            await this.setObjectNotExistsAsync(channel, { type: "channel", common: { name: room.name }, native: { segmentId: room.segmentId, roomId: room.roomId, source: "Xiaomi FDS map" } });
                            await this.setObjectNotExistsAsync(channel + ".name", { type: "state", common: { name: "Room name", type: "string", role: "text", read: true, write: false }, native: {} });
                            await this.setStateAsync(channel + ".name", { val: room.name, ack: true });
                            await this.setObjectNotExistsAsync(channel + ".roomId", { type: "state", common: { name: "Xiaomi Home room ID", type: "string", role: "text", read: true, write: false }, native: {} });
                            await this.setStateAsync(channel + ".roomId", { val: room.roomId!, ack: true });
                        }
                        await this.setStateAsync("x20Plus.rooms.lastUpdate", { val: new Date().toISOString(), ack: true });
                        await this.setStateAsync("x20Plus.rooms.mapStatus", { val: "Map refreshed: " + selectableRooms.length + " named Xiaomi Home rooms (filtered " + (rooms.length - selectableRooms.length) + " unnamed/outdoor segments).", ack: true });
                        this.log.info("Xiaomi X20+ saved room map refreshed from Xiaomi FDS: " + selectableRooms.length + " named rooms; filtered " + (rooms.length - selectableRooms.length) + " false-positive segments.");
                    } catch (error) {
                        const message = error instanceof Error ? error.message : "Unknown map refresh error";
                        await this.setStateAsync("x20Plus.rooms.mapStatus", { val: "Map refresh failed: " + message, ack: true });
                        this.log.warn("Xiaomi X20+ room map refresh failed: " + message);
                    }
                }
                await this.setStateAsync("x20Plus.control.refreshRooms", { val: false, ack: true });
                return;
            }
            if (command === "cleanRooms") {
                if (typeof state.val === "string" && state.val.trim()) {
                    try {
                        const roomAction = parseXiaomiRoomCleanRequest(state.val);
                        const roomMapState = await this.getStateAsync("x20Plus.rooms.roomsJson");
                        if (typeof roomMapState?.val !== "string" || !roomMapState.val.trim()) {
                            throw new Error("X20+ room map is not imported yet. Press control.refreshRooms first.");
                        }
                        const knownRooms = JSON.parse(roomMapState.val) as Array<{ segmentId: number; name: string }>;
                        const requested = JSON.parse(state.val) as { rooms?: Array<{ segmentId: number }> };
                        const knownIds = new Set(knownRooms.map((room) => room.segmentId));
                        for (const room of requested.rooms ?? []) {
                            if (!knownIds.has(room.segmentId)) throw new Error("Unknown X20+ room segmentId " + room.segmentId + ". Refresh the map and use an ID from roomsJson.");
                        }
                        if (!this.xiaomiClient || this.xiaomiCommandRunning || this.xiaomiPollRunning) {
                            const message = "Room-clean command skipped: Xiaomi client unavailable or MIoT busy; no command sent.";
                            this.log.warn(message);
                            await this.setStateAsync("x20Plus.control.cleanRoomsStatus", { val: message, ack: true });
                        } else {
                            this.xiaomiCommandRunning = true;
                            // Keep command diagnostics separate from the preceding status poll.
                            // Emit the bounded UDP trace only if this command fails.
                            this.xiaomiMiioTrace.length = 0;
                            try {
                                const baselineState = await this.getStateAsync("x20Plus.status.vacuumState");
                                const baselineStatus = typeof baselineState?.val === "number" ? baselineState.val : null;
                                const config = this.config as RoidmiAdapterConfig;
                                // Room cleaning needs the firmware-specific two-input form.
                                // Xiaomi Cloud validates against the published one-input MIoT
                                // schema and rejects it; send locally like the hardware-validated
                                // C102GL implementation. Force a fresh handshake because the
                                // cached one timed out during the previous room-clean attempt.
                                const result = await this.xiaomiClient.call("action", {
                                    did: String(config.xiaomiDid),
                                    siid: roomAction.siid,
                                    aiid: roomAction.aiid,
                                    in: roomAction.inputs
                                }, undefined, true);
                                const responseError = getActionResponseError(result);
                                if (responseError) throw new Error(responseError);
                                this.xiaomiRoomCleanTracker = createRoomCleanObservationTracker(baselineStatus, 3);
                                const initialObservation = this.xiaomiRoomCleanTracker.state === "ambiguous"
                                    ? observeRoomCleanStatus(this.xiaomiRoomCleanTracker, baselineStatus)
                                    : { state: "pending", message: "MIoT accepted the room-clean action; waiting for normal status polling (execution not yet verified)." };
                                if (initialObservation.state !== "pending") this.xiaomiRoomCleanTracker = undefined;
                                const message = initialObservation.message + " via local MIoT. Response: " + JSON.stringify(result);
                                this.log.info("Xiaomi X20+ " + message);
                                await this.setStateAsync("x20Plus.control.cleanRoomsStatus", { val: message, ack: true });
                            } finally {
                                this.xiaomiCommandRunning = false;
                            }
                        }
                    } catch (error) {
                        const message = "Room-clean request rejected/failed: " + (error instanceof Error ? error.message : "unknown error");
                        this.log.warn("Xiaomi X20+ " + message);
                        for (const traceLine of this.xiaomiMiioTrace) this.log.debug("Xiaomi X20+ room-clean miIO trace: " + traceLine);
                        await this.setStateAsync("x20Plus.control.cleanRoomsStatus", { val: message, ack: true });
                    }
                }
                await this.setStateAsync("x20Plus.control.cleanRooms", { val: "", ack: true });
                return;
            }
            const actionMap: Record<string, { siid: number; aiid: number }> = {
                resetMainBrush: { siid: 9, aiid: 1 },
                resetSideBrush: { siid: 10, aiid: 1 },
                resetFilter: { siid: 11, aiid: 1 },
                resetMop: { siid: 18, aiid: 1 },
                start: { siid: 2, aiid: 1 },
                pause: { siid: 2, aiid: 2 },
                returnToDock: { siid: 3, aiid: 1 }
            };
            if (command in actionMap) {
                if (state.val === true) {
                    if (!this.xiaomiClient || this.xiaomiCommandRunning || this.xiaomiPollRunning) {
                        this.log.warn("Xiaomi X20+ command skipped: device unavailable or another MIoT request is running");
                    } else {
                        this.xiaomiCommandRunning = true;
                        try {
                            const action = actionMap[command];
                            let actionResult: unknown;
                            const config = this.config as RoidmiAdapterConfig;
                            if (this.cloudMapClient.hasSession()) {
                                actionResult = await this.cloudMapClient.callAction(config.cloudCountry || "de", {
                                    did: config.xiaomiDid!,
                                    siid: action.siid,
                                    aiid: action.aiid,
                                    in: []
                                }, async () => {
                                    await this.setStateAsync("evePlus.map.cloudSession", {
                                        val: this.encrypt(this.cloudMapClient.exportSession()), ack: true
                                    });
                                });
                                this.log.info(`Xiaomi X20+ ${command} command sent via Xiaomi Cloud MIoT (${action.siid}/${action.aiid}); response: ${JSON.stringify(actionResult)}`);
                            } else {
                                actionResult = await this.xiaomiClient.call("miIO.miotspecv2", [{
                                    method: "action",
                                    params: {
                                        did: config.xiaomiDid,
                                        siid: action.siid,
                                        aiid: action.aiid,
                                        in: []
                                    }
                                }]);
                                this.log.info(`Xiaomi X20+ ${command} command sent via local MIoT (${action.siid}/${action.aiid}); response: ${JSON.stringify(actionResult)}`);
                            }
                        } catch (error) {
                            this.log.warn(`Xiaomi X20+ ${command} command failed: ${error instanceof Error ? error.message : "unknown error"}`);
                        } finally {
                            this.xiaomiCommandRunning = false;
                        }
                    }
                }
                await this.setStateAsync("x20Plus.control." + command, { val: false, ack: true });
                return;
            }
            const propertyMap: Record<string, { siid: number; piid: number; min: number; max: number; statusKey: string; mask?: number; shift?: number }> = {
                suction: { siid: 2, piid: 3, min: 0, max: 3, statusKey: "suction" },
                cleaningMode: { siid: 4, piid: 23, min: 0, max: 3, statusKey: "cleaningMode", mask: 0x03, shift: 0 },
                // The user's three live app measurements confirmed water level in bits 16-17 of 4/23.
                mopMode: { siid: 4, piid: 23, min: 1, max: 3, statusKey: "mopMode", mask: 0x30000, shift: 16 }
            };
            const optionalSetting = XIAOMI_X20_PLUS_OPTIONAL_SETTINGS[command as keyof typeof XIAOMI_X20_PLUS_OPTIONAL_SETTINGS];
            if (optionalSetting) {
                if (typeof state.val !== "boolean") {
                    const current = await this.getStateAsync("x20Plus.status." + command);
                    if (typeof current?.val === "boolean") await this.setStateAsync("x20Plus.control." + command, { val: current.val, ack: true });
                    this.log.warn(`Xiaomi X20+ ${command} rejected: expected boolean`);
                } else if (!this.xiaomiClient || this.xiaomiCommandRunning || this.xiaomiPollRunning) {
                    const current = await this.getStateAsync("x20Plus.status." + command);
                    if (typeof current?.val === "boolean") await this.setStateAsync("x20Plus.control." + command, { val: current.val, ack: true });
                    this.log.warn(`Xiaomi X20+ ${command} skipped: robot unavailable or MIoT busy`);
                } else {
                    this.xiaomiCommandRunning = true;
                    try {
                        // MIoT 4.12 carpet-press is uint8 (0 = Close, 1 = Open),
                        // although the public ioBroker control is exposed as boolean.
                        const writeValue = command === "carpetBoost" ? Number(state.val) : state.val;
                        const result = await this.xiaomiClient.call("set_properties", [{ did: (this.config as RoidmiAdapterConfig).xiaomiDid, siid: optionalSetting.siid, piid: optionalSetting.piid, value: writeValue }]);
                        if (!Array.isArray(result) || !result.length || (result[0] as { code?: number })?.code !== 0) throw new Error("MIoT rejected optional setting write: " + JSON.stringify(result));
                        // Confirm the actual device value instead of acknowledging the requested value.
                        const verifyResult = await this.xiaomiClient.call("get_properties", [{ did: (this.config as RoidmiAdapterConfig).xiaomiDid, siid: optionalSetting.siid, piid: optionalSetting.piid }]);
                        const verified = Array.isArray(verifyResult) ? verifyResult[0] as { code?: number; value?: unknown } | undefined : undefined;
                        if (!verified || verified.code !== 0 || (command === "carpetBoost" && verified.value !== 0 && verified.value !== 1)) {
                            throw new Error("MIoT optional setting read-back failed: " + JSON.stringify(verifyResult));
                        }
                        const verifiedValue = command === "carpetBoost" ? Boolean(verified.value) : state.val;
                        await this.setStateAsync("x20Plus.status." + command, { val: verifiedValue, ack: true });
                        await this.setStateAsync("x20Plus.control." + command, { val: verifiedValue, ack: true });
                        this.log.info(`Xiaomi X20+ ${command} write verified at ${verifiedValue}`);
                    } catch (error) {
                        const current = await this.getStateAsync("x20Plus.status." + command);
                        if (typeof current?.val === "boolean") await this.setStateAsync("x20Plus.control." + command, { val: current.val, ack: true });
                        this.log.warn(`Xiaomi X20+ ${command} failed: ${error instanceof Error ? error.message : "unknown error"}`);
                    } finally { this.xiaomiCommandRunning = false; }
                }
                return;
            }
            if (command in propertyMap) {
                const property = propertyMap[command];
                if (typeof state.val !== "number" || !Number.isInteger(state.val) || state.val < property.min || state.val > property.max) {
                    const current = await this.getStateAsync("x20Plus.status." + property.statusKey);
                    if (typeof current?.val === "number") await this.setStateAsync("x20Plus.control." + command, { val: current.val, ack: true });
                    this.log.warn(`Xiaomi X20+ ${command} setting rejected: expected ${property.min}..${property.max}`);
                } else if (!this.xiaomiClient || this.xiaomiCommandRunning || this.xiaomiPollRunning) {
                    const current = await this.getStateAsync("x20Plus.status." + property.statusKey);
                    if (typeof current?.val === "number") await this.setStateAsync("x20Plus.control." + command, { val: current.val, ack: true });
                    this.log.warn(`Xiaomi X20+ ${command} setting skipped: device unavailable or another MIoT request is running`);
                } else {
                    this.xiaomiCommandRunning = true;
                    try {
                        let writeValue = state.val;
                        if (property.mask !== undefined) {
                            const currentResult = await this.xiaomiClient.call("get_properties", [{
                                did: (this.config as RoidmiAdapterConfig).xiaomiDid,
                                siid: property.siid,
                                piid: property.piid
                            }]);
                            const currentItem = Array.isArray(currentResult) ? currentResult[0] as { code?: number; value?: unknown } | undefined : undefined;
                            if (!currentItem || currentItem.code !== 0 || typeof currentItem.value !== "number") {
                                throw new Error("Could not read current packed cleaning settings before update");
                            }
                            const shift = property.shift ?? 0;
                            writeValue = (currentItem.value & ~property.mask) | ((state.val << shift) & property.mask);
                        }
                        const result = await this.xiaomiClient.call("set_properties", [{
                            did: (this.config as RoidmiAdapterConfig).xiaomiDid,
                            siid: property.siid,
                            piid: property.piid,
                            value: writeValue
                        }]);
                        // Do not acknowledge a setting as applied if MIoT returned an error.
                        // Some firmwares resolve the RPC successfully but include a non-zero
                        // per-property code in the response.
                        if (!Array.isArray(result) || !result.length) {
                            throw new Error("Unexpected MIoT property-write response");
                        }
                        const writeResult = result[0] as { code?: number } | undefined;
                        if (!writeResult || typeof writeResult.code !== "number" || writeResult.code !== 0) {
                            throw new Error(`MIoT write rejected (SIID ${property.siid}, PIID ${property.piid}, code ${writeResult?.code ?? "missing"})`);
                        }
                        // A successful set_properties response only confirms that the
                        // command was accepted. Read this single property back once so the
                        // states reflect the value the robot actually applied.
                        const verifyResult = await this.xiaomiClient.call("get_properties", [{
                            did: (this.config as RoidmiAdapterConfig).xiaomiDid,
                            siid: property.siid,
                            piid: property.piid
                        }]);
                        if (!Array.isArray(verifyResult) || !verifyResult.length) {
                            throw new Error("Unexpected MIoT read-back response after setting write");
                        }
                        const verified = verifyResult[0] as { code?: number; value?: unknown } | undefined;
                        if (!verified || verified.code !== 0 || typeof verified.value !== "number" || !Number.isInteger(verified.value)) {
                            throw new Error("MIoT read-back did not return a valid numeric value: " + JSON.stringify(verifyResult));
                        }
                        const verifiedValue = property.mask !== undefined
                            ? (verified.value & property.mask) >>> (property.shift ?? 0)
                            : verified.value;
                        await this.setStateAsync("x20Plus.status." + property.statusKey, { val: verifiedValue, ack: true });
                        await this.setStateAsync("x20Plus.control." + command, { val: verifiedValue, ack: true });
                        if (verifiedValue !== state.val) {
                            this.log.warn(`Xiaomi X20+ ${command}: requested ${state.val}, robot reports ${verifiedValue} after write`);
                        } else {
                            this.log.info(`Xiaomi X20+ ${command} verified at ${verifiedValue}; write response: ${JSON.stringify(result)}`);
                        }
                    } catch (error) {
                        const current = await this.getStateAsync("x20Plus.status." + property.statusKey);
                        if (typeof current?.val === "number") {
                            await this.setStateAsync("x20Plus.control." + command, { val: current.val, ack: true });
                        }
                        this.log.warn(`Xiaomi X20+ ${command} setting failed: ${error instanceof Error ? error.message : "unknown error"}`);
                    } finally {
                        this.xiaomiCommandRunning = false;
                    }
                }
                return;
            }
        }

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
        const updateTimingId = this.namespace + ".evePlus.control.updateSchedule";
        if (id === updateTimingId) {
            if (typeof state.val === "string" && state.val.trim()) {
                try {
                    const request = JSON.parse(state.val) as { index?: unknown; expectedRaw?: unknown; update?: unknown };
                    if (!Number.isSafeInteger(request.index) || typeof request.expectedRaw !== "string" ||
                        !request.update || typeof request.update !== "object" || Array.isArray(request.update)) {
                        throw new Error("Request must contain index, expectedRaw and update");
                    }
                    await this.updateTimingSchedule(request.index as number, request.expectedRaw, request.update as RoidmiCleaningScheduleUpdate);
                } catch (error) {
                    const message = error instanceof Error ? error.message : "Invalid schedule update";
                    await this.setStateChangedAsync("evePlus.control.lastCommandStatus", { val: "Schedule update rejected: " + message, ack: true });
                    await this.setStateChangedAsync("evePlus.control.lastCommandTime", { val: new Date().toISOString(), ack: true });
                    this.log.warn("EVE Plus schedule update rejected: " + message);
                }
            }
            await this.setStateAsync("evePlus.control.updateSchedule", { val: "", ack: true });
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
        const maintenanceActions: Record<string, { siid: number; aiid: number; label: string }> = {
            resetFilter: { siid: 10, aiid: 1, label: "filter" },
            resetMainBrush: { siid: 11, aiid: 1, label: "main brush" },
            resetSideBrush: { siid: 12, aiid: 1, label: "side brush" },
            resetSensors: { siid: 15, aiid: 1, label: "sensor cleaning" }
        };
        if (command in maintenanceActions) {
            const action = maintenanceActions[command];
            try {
                if (!this.client || this.commandRunning) throw new Error("Roidmi is unavailable or another command is running");
                this.commandRunning = true;
                const result = await this.client.call("action", [{ did: config.did, siid: action.siid, aiid: action.aiid, in: [] }]);
                const responseError = getActionResponseError(result);
                if (responseError) throw new Error(responseError);
                await this.setStateChangedAsync("evePlus.control.lastCommand", { val: command, ack: true });
                await this.setStateChangedAsync("evePlus.control.lastCommandStatus", { val: "Reset action accepted; check the next maintenance readback", ack: true });
                await this.setStateChangedAsync("evePlus.control.lastCommandTime", { val: new Date().toISOString(), ack: true });
                this.log.info(`Roidmi ${action.label} maintenance reset accepted; response: ${JSON.stringify(result)}`);
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown maintenance reset error";
                await this.setStateChangedAsync("evePlus.control.lastCommandStatus", { val: message, ack: true });
                this.log.warn(`Roidmi ${action.label} reset failed: ${message}`);
            } finally {
                this.commandRunning = false;
                await this.setStateAsync("evePlus.control." + command, { val: false, ack: true });
            }
            return;
        }
        if (command === "start" || command === "pause" || command === "resume" || command === "dock" || command === "stop") {
            await this.sendAction(command, buildVacuumAction(command), "evePlus.control." + command, false);
            return;
        }
        await this.setStateAsync("evePlus.control." + command, { val: false, ack: true });
    }
    /**
     * Updates one existing EVE Plus schedule on explicit request only.
     * The caller must provide the snapshot shown in the UI; a fresh device read
     * is compared before writing to avoid overwriting a concurrent app change.
     */
    private async updateTimingSchedule(index: number, expectedRaw: string, update: RoidmiCleaningScheduleUpdate): Promise<void> {
        const config = this.config as RoidmiAdapterConfig;
        if (!this.client || !config.did || this.commandRunning) {
            throw new Error("Roidmi is unavailable or another command is running");
        }
        this.commandRunning = true;
        let writeAccepted = false;
        try {
            const beforeResult = await this.client.call("get_properties", [{ did: config.did, siid: 8, piid: 6 }]);
            if (!Array.isArray(beforeResult)) throw new Error("Unexpected MIoT schedule response before update");
            const beforeItem = beforeResult[0] as { code?: number; value?: unknown } | undefined;
            if (!beforeItem || beforeItem.code !== 0 || typeof beforeItem.value !== "string") {
                throw new Error("Could not read the current EVE Plus schedules before update");
            }
            if (!areRoidmiScheduleSnapshotsEqual(expectedRaw, beforeItem.value)) {
                throw new Error("Schedules changed since they were displayed; refresh the schedule list and retry");
            }
            const updatedRaw = updateRoidmiCleaningSchedule(beforeItem.value, index, update);
            const writeResult = await this.client.call("set_properties", [{
                did: config.did, siid: 8, piid: 6, value: updatedRaw
            }]);
            if (!Array.isArray(writeResult) || !writeResult.length) throw new Error("Unexpected MIoT schedule-write response");
            const writeItem = writeResult[0] as { code?: number } | undefined;
            if (!writeItem || writeItem.code !== 0) {
                throw new Error("MIoT schedule write rejected (code " + (writeItem?.code ?? "missing") + ")");
            }
            writeAccepted = true;

            const verifyResult = await this.client.call("get_properties", [{ did: config.did, siid: 8, piid: 6 }]);
            if (!Array.isArray(verifyResult)) throw new Error("Unexpected MIoT schedule read-back response");
            const verifyItem = verifyResult[0] as { code?: number; value?: unknown } | undefined;
            if (!verifyItem || verifyItem.code !== 0 || typeof verifyItem.value !== "string") {
                throw new Error("Schedule write was accepted, but the robot did not return a valid read-back");
            }
            if (!verifyRoidmiCleaningScheduleUpdate(beforeItem.value, verifyItem.value, index, update)) {
                throw new Error("Schedule write was accepted, but read-back differs from the requested update or changed unrelated data");
            }

            const parsed = parseCleaningSchedules(verifyItem.value);
            const formatted = JSON.stringify(JSON.parse(verifyItem.value), null, 2);
            await this.setStateChangedAsync("evePlus.timing.raw", { val: formatted, ack: true });
            await this.setStateChangedAsync("evePlus.timing.parsed", { val: JSON.stringify(parsed, null, 2), ack: true });
            await this.setStateChangedAsync("evePlus.timing.summary", {
                val: parsed.map((entry, entryIndex) => (entryIndex + 1) + ". " + entry.timeText + " | " +
                    (entry.enabled ? "aktiv" : "deaktiviert") + " | Saugstufe " + entry.fanSpeedText +
                    " | Modus " + entry.cleaningMode + " | Wasser " + entry.waterLevelText +
                    " | Raum-IDs " + entry.roomIds.join(", ") + " | " + entry.weekdaysText).join("\\n") || "Keine Zeitpläne gespeichert",
                ack: true
            });
            await this.setStateChangedAsync("evePlus.timing.lastUpdate", { val: new Date().toISOString(), ack: true });
            await this.setStateChangedAsync("evePlus.control.lastCommand", { val: "updateSchedule", ack: true });
            await this.setStateChangedAsync("evePlus.control.lastCommandStatus", { val: "Schedule update verified by robot read-back", ack: true });
            await this.setStateChangedAsync("evePlus.control.lastCommandTime", { val: new Date().toISOString(), ack: true });
            this.log.info("EVE Plus schedule " + (index + 1) + " updated and verified by robot read-back");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown schedule update error";
            const status = writeAccepted
                ? "Write was accepted; read-back could not confirm the result. Refresh schedules manually before another write: " + message
                : message;
            await this.setStateChangedAsync("evePlus.control.lastCommandStatus", { val: status, ack: true });
            await this.setStateChangedAsync("evePlus.control.lastCommandTime", { val: new Date().toISOString(), ack: true });
            this.log.warn("EVE Plus schedule update " + (writeAccepted ? "confirmation incomplete: " : "failed: ") + message);
            // The detailed status above distinguishes a rejected write from an
            // accepted write whose read-back is still unconfirmed. Do not overwrite it.
        } finally {
            this.commandRunning = false;
        }
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
        if (this.xiaomiScheduleTimer) clearTimeout(this.xiaomiScheduleTimer);
        this.setState("evePlus.info.connection", false, true);
        this.setState("x20Plus.info.connection", false, true);
        callback();
    }
}

export default RoidmiAdapter;
new RoidmiAdapter();