"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const adapter_core_1 = require("@iobroker/adapter-core");
const miio_client_1 = require("./lib/miio-client");
const room_cleaning_1 = require("./lib/room-cleaning");
const config_1 = require("./lib/config");
const roidmi_actions_1 = require("./lib/roidmi-actions");
const room_map_1 = require("./lib/room-map");
const roidmi_settings_1 = require("./lib/roidmi-settings");
const xiaomi_cloud_map_1 = require("./lib/xiaomi-cloud-map");
const roidmi_status_1 = require("./lib/roidmi-status");
class RoidmiAdapter extends adapter_core_1.Adapter {
    pollTimer;
    stopping = false;
    lastPollError = "";
    commandRunning = false;
    cloudLoginRunning = false;
    client;
    cloudMapClient = new xiaomi_cloud_map_1.XiaomiCloudMapClient();
    roomMapConfig;
    lastKnownSettings = {};
    constructor() {
        super({ name: "roidmi" });
        this.on("ready", () => void this.onReady());
        this.on("message", (obj) => void this.onMessage(obj));
        this.on("stateChange", (id, state) => void this.onStateChange(id, state));
        this.on("unload", (callback) => this.onUnload(callback));
    }
    async onReady() {
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
        await this.setObjectNotExistsAsync("info.lastPoll", {
            type: "state",
            common: { name: "Last successful status poll", type: "string", role: "date", read: true, write: false },
            native: {}
        });
        await this.setObjectNotExistsAsync("info.pollCount", {
            type: "state",
            common: { name: "Successful status polls since adapter start", type: "number", role: "value", read: true, write: false },
            native: {}
        });
        let successfulPollCount = 0;
        const config = this.config;
        const errors = (0, config_1.validateConfig)(config);
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
        this.client = new miio_client_1.MiioClient({ host: config.host, token: config.token, debug: true, onDebug: (message) => this.log.debug("[miIO] " + message) });
        if (config.cloudSession) {
            try {
                this.cloudMapClient.restoreSession(this.decrypt(config.cloudSession));
                this.log.info("Stored Xiaomi Cloud session restored");
            }
            catch {
                this.cloudMapClient.clearSession();
                this.log.warn("Stored Xiaomi Cloud session could not be restored; a new Xiaomi login is required");
            }
        }
        const properties = [
            { id: "battery", siid: 3, piid: 1, name: "Battery level", unit: "%" },
            { id: "charging", siid: 3, piid: 2, name: "Charging state" },
            { id: "state", siid: 2, piid: 1, name: "Vacuum state" },
            { id: "errorCode", siid: 2, piid: 2, name: "Error code" },
            { id: "fanSpeed", siid: 2, piid: 4, name: "Suction power", min: 0, max: 4 },
            { id: "sweepType", siid: 2, piid: 8, name: "Cleaning type", min: 0, max: 2 },
            { id: "waterLevel", siid: 8, piid: 11, name: "Water level", min: 0, max: 4 }
        ];
        await this.setObjectNotExistsAsync("stateText", { type: "state", common: { name: "Vacuum state (human-readable, empirical)", type: "string", role: "text", read: true, write: false }, native: {} });
        await this.setObjectNotExistsAsync("errorCodeText", { type: "state", common: { name: "Robot error (human-readable)", type: "string", role: "text", read: true, write: false }, native: {} });
        await this.setObjectNotExistsAsync("chargingText", { type: "state", common: { name: "Charging state (human-readable, empirical)", type: "string", role: "text", read: true, write: false }, native: {} });
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
            if ("min" in property)
                await this.subscribeStatesAsync(property.id);
        }
        const controls = [
            { id: "start", name: "Start full cleaning" },
            { id: "pause", name: "Pause cleaning" },
            { id: "resume", name: "Resume cleaning" },
            { id: "dock", name: "Return to charging dock" }, { id: "stop", name: "Stop cleaning" }
        ];
        for (const control of controls) {
            await this.setObjectNotExistsAsync(`control.${control.id}`, {
                type: "state",
                common: { name: control.name, type: "boolean", role: "button", read: false, write: true, def: false },
                native: {}
            });
            await this.subscribeStatesAsync(`control.${control.id}`);
        }
        await this.setObjectNotExistsAsync("control.lastCommand", { type: "state", common: { name: "Last robot command", type: "string", role: "text", read: true, write: false }, native: {} });
        await this.setObjectNotExistsAsync("control.lastCommandStatus", { type: "state", common: { name: "Last robot command result", type: "string", role: "text", read: true, write: false }, native: {} });
        await this.setObjectNotExistsAsync("control.lastCommandTime", { type: "state", common: { name: "Last robot command time", type: "string", role: "date", read: true, write: false }, native: {} });
        await this.setObjectNotExistsAsync("control.cleanRooms", {
            type: "state",
            common: { name: "Clean selected rooms (JSON: mapId and roomIds)", type: "string", role: "json", read: false, write: true, def: "" },
            native: {}
        });
        await this.subscribeStatesAsync("control.cleanRooms");
        await this.setObjectNotExistsAsync("control.refreshTiming", {
            type: "state",
            common: { name: "Read saved cleaning schedules and room selections", type: "boolean", role: "button", read: false, write: true, def: false },
            native: {}
        });
        await this.subscribeStatesAsync("control.refreshTiming");
        await this.setObjectNotExistsAsync("timing.raw", {
            type: "state",
            common: { name: "Raw saved Roidmi cleaning schedules (read on demand)", type: "string", role: "json", read: true, write: false },
            native: { siid: 8, piid: 6 }
        });
        await this.setObjectNotExistsAsync("timing.lastUpdate", {
            type: "state",
            common: { name: "Last schedule read", type: "string", role: "date", read: true, write: false },
            native: {}
        });
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
        await this.setObjectNotExistsAsync("map.roomsJson", {
            type: "state",
            common: { name: "Imported room list", type: "string", role: "json", read: true, write: false },
            native: {}
        });
        await this.setObjectNotExistsAsync("control.refreshMap", { type: "state", common: { name: "Fetch map and rooms from Xiaomi Cloud (manual)", type: "boolean", role: "button", read: false, write: true, def: false }, native: {} });
        await this.subscribeStatesAsync("control.refreshMap");
        for (const [id, name, role] of [["map.cloudStatus", "Xiaomi Cloud map retrieval status", "text"], ["map.cloudAuthUrl", "Xiaomi two-factor authentication URL", "text"], ["map.cloudLastUpdate", "Last successful Xiaomi Cloud map retrieval", "date"]])
            await this.setObjectNotExistsAsync(id, { type: "state", common: { name, type: "string", role, read: true, write: false }, native: {} });
        // Remove the former 2FA datapoint; verification is handled in the adapter configuration UI.
        await this.delObjectAsync("map.cloudVerificationCode").catch(() => undefined);
        const savedMap = await this.getStateAsync("map.config");
        if (savedMap && typeof savedMap.val === "string" && savedMap.val.trim()) {
            try {
                await this.applyRoomMapConfig((0, room_map_1.parseRoomMapConfig)(savedMap.val));
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "Stored room map is invalid";
                this.log.warn("Stored room map could not be restored: " + message);
            }
        }
        const poll = async () => {
            if (!this.client || this.stopping || this.commandRunning)
                return;
            this.commandRunning = true;
            try {
                // Read all status properties in one MIoT RPC to minimize UDP traffic and robot wakeups.
                const result = await this.client.call("get_properties", properties.map((property) => ({
                    did: config.did, siid: property.siid, piid: property.piid
                })));
                if (!Array.isArray(result))
                    throw new Error("Unexpected MIoT property response");
                for (let index = 0; index < properties.length; index++) {
                    const property = properties[index];
                    const item = result[index];
                    if (item?.code === 0 && typeof item.value === "number") {
                        await this.setStateChangedAsync(property.id, { val: item.value, ack: true });
                        if (property.id === "state")
                            await this.setStateChangedAsync("stateText", { val: (0, roidmi_status_1.getVacuumStateText)(item.value), ack: true });
                        if (property.id === "errorCode")
                            await this.setStateChangedAsync("errorCodeText", { val: (0, roidmi_status_1.getRoidmiErrorText)(item.value), ack: true });
                        if (property.id === "charging")
                            await this.setStateChangedAsync("chargingText", { val: (0, roidmi_status_1.getChargingStateText)(item.value), ack: true });
                        if ((0, roidmi_settings_1.getRoidmiSetting)(property.id))
                            this.lastKnownSettings[property.id] = item.value;
                    }
                    else if (item && typeof item.code === "number" && item.code !== 0) {
                        throw new Error(`MIoT property read failed (SIID ${property.siid}, PIID ${property.piid}, code ${item.code})`);
                    }
                }
                successfulPollCount++;
                await this.setStateChangedAsync("info.lastPoll", { val: new Date().toISOString(), ack: true });
                await this.setStateChangedAsync("info.pollCount", { val: successfulPollCount, ack: true });
                await this.setStateChangedAsync("info.connection", { val: true, ack: true });
                await this.setStateChangedAsync("info.connectionText", { val: "Local miIO connection established", ack: true });
                this.lastPollError = "";
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "Unknown local miIO error";
                await this.setStateChangedAsync("info.connection", { val: false, ack: true });
                await this.setStateChangedAsync("info.connectionText", { val: message, ack: true });
                if (message !== this.lastPollError)
                    this.log.warn(message);
                this.lastPollError = message;
            }
            finally {
                this.commandRunning = false;
            }
        };
        const baseIntervalMs = (config.pollIntervalSeconds ?? 30) * 1000;
        let consecutiveFailures = 0;
        const scheduleNext = (delayMs) => {
            if (this.stopping)
                return;
            this.pollTimer = setTimeout(async () => {
                await poll();
                if (this.lastPollError)
                    consecutiveFailures++;
                else
                    consecutiveFailures = 0;
                const nextDelay = this.lastPollError
                    ? Math.min(baseIntervalMs * (2 ** Math.min(consecutiveFailures, 6)), 300000)
                    : baseIntervalMs;
                scheduleNext(nextDelay);
            }, delayMs);
        };
        await poll();
        scheduleNext(this.lastPollError ? Math.min(baseIntervalMs * 2, 300000) : baseIntervalMs);
    }
    async applyRoomMapConfig(config) {
        const previous = this.roomMapConfig;
        this.roomMapConfig = config;
        await this.setObjectNotExistsAsync("map.mapId", {
            type: "state",
            common: { name: "Active map ID", type: "number", role: "value", read: true, write: false }, native: {}
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
    async onStateChange(id, state) {
        if (!state || state.ack)
            return;
        const importId = this.namespace + ".control.importRooms";
        if (id === importId) {
            if (typeof state.val === "string" && state.val.trim()) {
                try {
                    const config = (0, room_map_1.parseRoomMapConfig)(state.val);
                    await this.applyRoomMapConfig(config);
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Invalid room map";
                    this.log.warn("Room-map import rejected: " + message);
                }
            }
            await this.setStateAsync("control.importRooms", { val: "", ack: true });
            return;
        }
        if (id === this.namespace + ".control.refreshMap") {
            if (state.val === true)
                await this.refreshCloudMap();
            await this.setStateAsync("control.refreshMap", { val: false, ack: true });
            return;
        }
        const refreshTimingId = this.namespace + ".control.refreshTiming";
        if (id === refreshTimingId) {
            if (state.val === true)
                await this.refreshTiming();
            await this.setStateAsync("control.refreshTiming", { val: false, ack: true });
            return;
        }
        const roomPrefix = this.namespace + ".rooms.";
        if (id.startsWith(roomPrefix) && id.endsWith(".clean")) {
            const roomIdText = id.slice(roomPrefix.length, -".clean".length);
            const roomId = Number(roomIdText);
            if (state.val !== true)
                return;
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
        const property = id.startsWith(this.namespace + ".") ? (0, roidmi_settings_1.getRoidmiSetting)(propertyId) : undefined;
        if (property) {
            if (typeof state.val !== "number" || !Number.isInteger(state.val) || state.val < property.min || state.val > property.max) {
                this.log.warn("Setting rejected: value out of range for " + id);
                await this.setStateAsync(id, { val: this.lastKnownSettings[propertyId] ?? 0, ack: true });
                return;
            }
            await this.sendProperty(id, property, state.val);
            return;
        }
        const prefix = this.namespace + ".control.";
        if (!id.startsWith(prefix))
            return;
        const command = id.slice(prefix.length);
        const config = this.config;
        if (command === "cleanRooms") {
            if (typeof state.val !== "string" || !state.val.trim()) {
                await this.setStateAsync("control.cleanRooms", { val: "", ack: true });
                return;
            }
            try {
                const roomAction = (0, room_cleaning_1.parseRoomCleaningRequest)(state.val);
                await this.sendAction("cleanRooms", { siid: roomAction.siid, aiid: roomAction.aiid, in: roomAction.params }, "control.cleanRooms", "");
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "Invalid room-cleaning request";
                this.log.warn("Room-cleaning request rejected: " + message);
                await this.setStateAsync("control.cleanRooms", { val: "", ack: true });
            }
            return;
        }
        if (state.val !== true)
            return;
        if (command === "start" || command === "pause" || command === "resume" || command === "dock" || command === "stop") {
            await this.sendAction(command, (0, roidmi_actions_1.buildVacuumAction)(command), "control." + command, false);
            return;
        }
        await this.setStateAsync("control." + command, { val: false, ack: true });
    }
    /**
     * Read the stored schedule JSON only when explicitly requested.
     * This is deliberately excluded from the fast status polling cycle.
     */
    async refreshTiming() {
        const config = this.config;
        if (!this.client || !config.did || this.commandRunning) {
            this.log.warn("Schedule read skipped: device unavailable or another command is running");
            return;
        }
        this.commandRunning = true;
        try {
            const result = await this.client.call("get_properties", [{
                    did: config.did, siid: 8, piid: 6
                }]);
            if (!Array.isArray(result))
                throw new Error("Unexpected MIoT schedule response");
            const item = result[0];
            if (!item || item.code !== 0 || typeof item.value !== "string") {
                throw new Error("MIoT schedule read failed or returned an unsupported value");
            }
            let formatted = item.value;
            try {
                formatted = JSON.stringify(JSON.parse(item.value), null, 2);
            }
            catch {
                // Preserve the exact device response if firmware returns non-JSON text.
            }
            await this.setStateChangedAsync("timing.raw", { val: formatted, ack: true });
            await this.setStateChangedAsync("timing.lastUpdate", { val: new Date().toISOString(), ack: true });
            this.log.info("Saved cleaning schedules read from robot (SIID 8 / PIID 6)");
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown schedule read error";
            this.log.warn("Could not read saved cleaning schedules: " + message);
        }
        finally {
            this.commandRunning = false;
        }
    }
    async onMessage(obj) {
        if (!obj || (obj.command !== "cloudStartLogin" && obj.command !== "cloudSubmitCode"))
            return;
        const payload = (obj.message && typeof obj.message === "object" ? obj.message : {});
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
            if (obj.command === "cloudSubmitCode" && !code)
                throw new Error("Bitte zuerst den Xiaomi-Bestätigungscode eingeben.");
            await this.refreshCloudMap(code, credentials);
            const state = await this.getStateAsync("map.cloudStatus");
            const message = typeof state?.val === "string" ? state.val : "Xiaomi-Cloud-Anfrage abgeschlossen.";
            this.sendTo(obj.from, obj.command, { text: message, ok: !/fehlgeschlagen|abgelehnt|fehlt|ungültig/i.test(message) }, obj.callback);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Xiaomi-Cloud-Anmeldung fehlgeschlagen.";
            this.sendTo(obj.from, obj.command, { text: message, ok: false }, obj.callback);
        }
    }
    async persistCloudSession() {
        if (!this.cloudMapClient.hasSession())
            return;
        const encrypted = this.encrypt(this.cloudMapClient.exportSession());
        await this.extendForeignObjectAsync("system.adapter." + this.namespace, { native: { cloudSession: encrypted } });
        this.config.cloudSession = encrypted;
    }
    async clearPersistedCloudSession() {
        await this.extendForeignObjectAsync("system.adapter." + this.namespace, { native: { cloudSession: "" } });
        this.config.cloudSession = "";
    }
    async refreshCloudMap(verificationCode, supplied) {
        const config = { ...this.config, ...(supplied ?? {}) };
        if (!config.cloudEnabled) {
            await this.setStateAsync("map.cloudStatus", { val: "Optional Xiaomi Cloud access is disabled in adapter settings.", ack: true });
            return;
        }
        if (!config.cloudUsername || !config.cloudPassword || !config.token || !this.client || this.commandRunning) {
            await this.setStateAsync("map.cloudStatus", { val: "Cloud credentials, local robot token or an idle adapter are missing.", ack: true });
            return;
        }
        this.commandRunning = true;
        await this.setStateAsync("map.cloudAuthUrl", { val: "", ack: true });
        try {
            // The EVE Plus uses Xiaomi's V60-family Cloud V2 map API.
            // The upstream Xiaomi Cloud Map Extractor explicitly does not query a
            // map name from the robot for this API (should_get_map_from_vacuum=false);
            // the cloud archive key uses "0". Avoiding get_map_v1 also prevents a
            // firmware-specific user-ack timeout and saves an unnecessary robot RPC.
            const mapName = "0";
            await this.setStateAsync("map.cloudStatus", {
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
                void this.setStateAsync("map.cloudStatus", { val: message, ack: true });
                this.log.info(message);
            });
            const rooms = result.metadata.rooms;
            if (!rooms.length)
                throw new Error("Downloaded map contains no named rooms.");
            await this.setStateChangedAsync("map.roomsJson", { val: JSON.stringify(rooms), ack: true });
            if (result.metadata.mapId) {
                await this.applyRoomMapConfig({
                    mapId: result.metadata.mapId,
                    rooms: rooms.map(({ id, name }) => ({ id, name }))
                });
                await this.setStateAsync("map.cloudStatus", {
                    val: `Map and ${rooms.length} rooms imported. Map ID: ${result.metadata.mapId}`,
                    ack: true
                });
            }
            else {
                await this.setStateAsync("map.cloudStatus", {
                    val: `Found ${rooms.length} rooms. The archive lacks the separate cleaning mapId; enter that ID once via control.importRooms to enable room-clean buttons.`,
                    ack: true
                });
            }
            await this.setStateChangedAsync("map.cloudLastUpdate", { val: new Date().toISOString(), ack: true });
            this.log.info(`Xiaomi Cloud map read succeeded: ${rooms.length} rooms`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown Xiaomi Cloud map error";
            if (message.startsWith("XIAOMI_2FA_CODE:")) {
                await this.setStateAsync("map.cloudStatus", { val: message.slice("XIAOMI_2FA_CODE:".length), ack: true });
            }
            else if (message.startsWith("XIAOMI_2FA:")) {
                await this.setStateAsync("map.cloudAuthUrl", { val: message.slice(11), ack: true });
                await this.setStateAsync("map.cloudStatus", {
                    val: "Two-factor authentication required. Open map.cloudAuthUrl from a device on the same internet connection, complete verification, then press refreshMap again.",
                    ack: true
                });
            }
            else {
                await this.setStateAsync("map.cloudStatus", { val: message, ack: true });
                this.log.warn("Xiaomi Cloud map retrieval failed: " + message);
            }
        }
        finally {
            try {
                await this.persistCloudSession();
            }
            catch {
                this.log.warn("Xiaomi Cloud session could not be stored securely");
            }
            this.commandRunning = false;
        }
    }
    async sendProperty(stateId, property, value) {
        const config = this.config;
        const previousValue = this.lastKnownSettings[stateId.slice(this.namespace.length + 1)] ?? 0;
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
                const item = result[0];
                if (item && typeof item.code === "number" && item.code !== 0) {
                    throw new Error(`MIoT property write failed (SIID ${property.siid}, PIID ${property.piid}, code ${item.code})`);
                }
            }
            await this.setStateAsync(stateId, { val: value, ack: true });
            this.lastKnownSettings[stateId.slice(this.namespace.length + 1)] = value;
            this.log.info("Robot setting updated: " + stateId.slice(this.namespace.length + 1) + " = " + value);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown property write error";
            this.log.warn("Robot setting failed: " + message);
            await this.setStateAsync(stateId, { val: previousValue, ack: true });
        }
        finally {
            this.commandRunning = false;
        }
    }
    async sendAction(command, action, stateId, resetValue = false) {
        const config = this.config;
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
                })
                : await this.client.call("action", [{
                        did: config.did, siid: action.siid, aiid: action.aiid,
                        ...(action.in ? { in: action.in } : {})
                    }]);
            const responseError = (0, roidmi_actions_1.getActionResponseError)(result);
            if (responseError)
                throw new Error(responseError);
            await this.setStateChangedAsync("control.lastCommand", { val: command, ack: true });
            await this.setStateChangedAsync("control.lastCommandStatus", { val: "Accepted by robot", ack: true });
            await this.setStateChangedAsync("control.lastCommandTime", { val: new Date().toISOString(), ack: true });
            this.log.info("Robot command " + command + " accepted by " + (config.cloudControlEnabled ? "Xiaomi Cloud MIoT" : "local MIoT"));
            this.log.debug("MIoT action response: " + JSON.stringify(result));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown command error";
            const failure = (0, roidmi_actions_1.getActionFailureStatus)(error, config.cloudControlEnabled ? "cloud" : "local");
            const status = failure.status;
            this.log.warn("Robot command " + command + (failure.uncertain
                ? " failed without confirmation; command outcome is unknown"
                : " failed: " + message));
            await this.setStateChangedAsync("control.lastCommand", { val: command, ack: true });
            await this.setStateChangedAsync("control.lastCommandStatus", { val: status, ack: true });
            await this.setStateChangedAsync("control.lastCommandTime", { val: new Date().toISOString(), ack: true });
        }
        finally {
            this.commandRunning = false;
            await this.setStateAsync(stateId, { val: resetValue, ack: true });
        }
    }
    onUnload(callback) {
        this.stopping = true;
        if (this.pollTimer)
            clearTimeout(this.pollTimer);
        this.setState("info.connection", false, true);
        callback();
    }
}
exports.default = RoidmiAdapter;
new RoidmiAdapter();
