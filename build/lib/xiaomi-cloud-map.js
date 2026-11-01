"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XiaomiCloudMapClient = void 0;
const node_crypto_1 = require("node:crypto");
const roidmi_map_1 = require("./roidmi-map");
class CookieStore {
    values = new Map();
    add(headers) {
        // Node 20 exposes getSetCookie(). Keep the fallback for compatible runtimes,
        // while never logging cookie contents.
        const lines = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [headers.get("set-cookie") ?? ""];
        for (const line of lines) {
            const first = line.split(";")[0], index = first.indexOf("=");
            if (index > 0)
                this.values.set(first.slice(0, index).trim(), first.slice(index + 1).trim());
        }
    }
    header() { return [...this.values].map(([k, v]) => `${k}=${v}`).join("; "); }
    get(name) { return this.values.get(name); }
    export() { return [...this.values.entries()]; }
    restore(values) {
        this.values.clear();
        for (const [name, value] of values) {
            if (typeof name === "string" && typeof value === "string")
                this.values.set(name, value);
        }
    }
}
function rc4(key, input) {
    const s = new Uint8Array(256);
    for (let i = 0; i < 256; i++)
        s[i] = i;
    let j = 0;
    for (let i = 0; i < 256; i++) {
        j = (j + s[i] + key[i % key.length]) & 255;
        [s[i], s[j]] = [s[j], s[i]];
    }
    const out = Buffer.alloc(input.length);
    let i = 0;
    j = 0;
    for (let n = 0; n < input.length; n++) {
        i = (i + 1) & 255;
        j = (j + s[i]) & 255;
        [s[i], s[j]] = [s[j], s[i]];
        out[n] = input[n] ^ s[(s[i] + s[j]) & 255];
    }
    return out;
}
function crypt(signed, value, decode = false) {
    const input = decode ? Buffer.from([...Buffer.alloc(1024), ...value]) : Buffer.concat([Buffer.alloc(1024), value]);
    return rc4(Buffer.from(signed, "base64"), input).subarray(1024);
}
function signedNonce(security, nonce) {
    return (0, node_crypto_1.createHash)("sha256").update(Buffer.concat([Buffer.from(security, "base64"), Buffer.from(nonce, "base64")])).digest("base64");
}
function encSignature(url, method, signed, params) {
    const path = new URL(url).pathname.replace("/app/", "/");
    return (0, node_crypto_1.createHash)("sha1").update([method.toUpperCase(), path, ...Object.entries(params).map(([k, v]) => `${k}=${v}`), signed].join("&")).digest("base64");
}
class XiaomiCloudMapClient {
    cookies = new CookieStore();
    ssecurity = "";
    userId = "";
    serviceToken = "";
    cUserId = "";
    passToken = "";
    pendingFlag = "";
    maskedDestination = "";
    agent = "Android-7.1.1-1.0.0-ROIDMIIOBROKER APP/xiaomi.smarthome APPV/62830";
    hasSession() { return Boolean(this.ssecurity && this.serviceToken && this.userId); }
    exportSession() {
        return JSON.stringify({
            cookies: this.cookies.export(), ssecurity: this.ssecurity, userId: this.userId,
            serviceToken: this.serviceToken, cUserId: this.cUserId, passToken: this.passToken
        });
    }
    restoreSession(serialized) {
        const value = JSON.parse(serialized);
        if (!Array.isArray(value.cookies) || typeof value.ssecurity !== "string" ||
            typeof value.userId !== "string" || typeof value.serviceToken !== "string" ||
            !value.ssecurity || !value.userId || !value.serviceToken) {
            throw new Error("Stored Xiaomi cloud session is incomplete");
        }
        const cookies = value.cookies.filter((entry) => Array.isArray(entry) && entry.length === 2 && typeof entry[0] === "string" && typeof entry[1] === "string");
        this.cookies.restore(cookies);
        this.ssecurity = value.ssecurity;
        this.userId = value.userId;
        this.serviceToken = value.serviceToken;
        this.cUserId = typeof value.cUserId === "string" ? value.cUserId : "";
        this.passToken = typeof value.passToken === "string" ? value.passToken : "";
    }
    clearSession() {
        this.cookies.restore([]);
        this.ssecurity = "";
        this.userId = "";
        this.serviceToken = "";
        this.cUserId = "";
        this.passToken = "";
        this.pendingFlag = "";
        this.maskedDestination = "";
    }
    async fetchMap(o, verificationCode) {
        if (!o.username.trim() || !o.password || !o.mapName.trim())
            throw new Error("Xiaomi cloud username, password and map name are required");
        if (!this.serviceToken || !this.ssecurity) {
            if (this.pendingFlag) {
                if (!verificationCode?.trim())
                    throw new Error("XIAOMI_2FA_CODE:Enter the verification code sent by Xiaomi.");
                const method = this.pendingFlag === "8" ? "Email" : "Phone";
                // Xiaomi's reference flow uses the exact URL-encoded _flag/ticket/trust fields
                // and the identity_session cookie established by identity/list.
                const verify = await this.request("https://account.xiaomi.com/identity/auth/verify" + method, {
                    method: "POST",
                    body: new URLSearchParams({ _flag: this.pendingFlag, ticket: verificationCode.trim(), trust: "false", _json: "true" }).toString(),
                    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: this.identityCookie() }
                });
                const verified = this.json(await verify.text());
                if (typeof verified.location !== "string" || !verified.location) {
                    throw new Error("Xiaomi rejected the verification code. Please request a new code.");
                }
                await this.finishLogin(verified.location);
                this.pendingFlag = "";
            }
            else {
                // Use Xiaomi's returned qs/callback/sid values instead of hard-coded
                // equivalents, and provide the deviceId cookie expected by Xiaomi.
                const deviceId = (0, node_crypto_1.randomBytes)(8).toString("hex");
                const first = await this.request("https://account.xiaomi.com/pass/serviceLogin?_json=true&sid=xiaomiio", {
                    headers: { Cookie: `userId=${encodeURIComponent(o.username)}; deviceId=${deviceId}` }
                });
                const init = this.json(await first.text());
                if (typeof init._sign !== "string" || typeof init.sid !== "string" || typeof init.callback !== "string" || typeof init.qs !== "string") {
                    throw new Error("Xiaomi login initialization response was incomplete");
                }
                const fields = new URLSearchParams({
                    _json: "true",
                    hash: (0, node_crypto_1.createHash)("md5").update(o.password).digest("hex").toUpperCase(),
                    sid: init.sid,
                    callback: init.callback,
                    _sign: init._sign,
                    qs: init.qs,
                    user: o.username
                });
                const login = await this.request("https://account.xiaomi.com/pass/serviceLoginAuth2", {
                    method: "POST",
                    body: fields.toString(),
                    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: `deviceId=${deviceId}` }
                });
                const auth = this.json(await login.text());
                if (typeof auth.notificationUrl === "string") {
                    await this.startTwoFactor(auth.notificationUrl);
                    throw new Error("XIAOMI_2FA_CODE:Code sent to " + this.maskedDestination + ". Enter it in map.cloudVerificationCode.");
                }
                if (typeof auth.location !== "string" || !auth.location) {
                    throw new Error("Xiaomi login failed. Check account, password and region.");
                }
                if (typeof auth.ssecurity === "string")
                    this.ssecurity = auth.ssecurity;
                if (typeof auth.userId === "string" || typeof auth.userId === "number")
                    this.userId = String(auth.userId);
                if (typeof auth.passToken === "string")
                    this.passToken = auth.passToken;
                await this.finishLogin(auth.location);
            }
        }
        if (!this.serviceToken || !this.ssecurity || !this.userId) {
            const missing = [!this.ssecurity && "ssecurity", !this.serviceToken && "serviceToken", !this.userId && "userId"].filter(Boolean).join(", ");
            throw new Error("Xiaomi login session is incomplete (missing " + missing + ")");
        }
        const base = `https://${o.country === "cn" ? "" : o.country + "."}api.io.mi.com/app`;
        const devices = await this.api(base + "/home/device_list", { data: '{"getVirtualModel":false,"getHuamiDevices":0}' });
        const list = devices?.result?.list;
        if (!Array.isArray(list))
            throw new Error("Xiaomi cloud did not return a device list");
        const device = list.find((d) => typeof d.token === "string" && d.token.toLowerCase() === o.token.toLowerCase());
        if (!device)
            throw new Error("Roidmi device was not found in this Xiaomi account / region");
        const deviceId = String(device.did), userId = String(device.uid ?? this.userId);
        const file = await this.api(base + "/v2/home/get_interim_file_url", { data: JSON.stringify({ obj_name: `${userId}/${deviceId}/${o.mapName}` }) });
        if (typeof file?.result?.url !== "string")
            throw new Error("Xiaomi cloud did not provide a map download URL");
        const archiveResponse = await this.request(file.result.url);
        const archive = Buffer.from(await archiveResponse.arrayBuffer());
        if (!archive.length || archive.length > 20 * 1024 * 1024)
            throw new Error("Downloaded map archive has an invalid size");
        return { metadata: (0, roidmi_map_1.parseRoidmiMapArchive)(archive), mapName: o.mapName, deviceId, userId };
    }
    identityCookie() {
        const value = this.cookies.get("identity_session");
        if (!value)
            throw new Error("Xiaomi 2FA session expired. Start the cloud login again.");
        return "identity_session=" + value;
    }
    async startTwoFactor(notificationUrl) {
        const listUrl = notificationUrl.replace("/fe/service/identity/authStart", "/identity/list");
        const listResponse = await this.request(listUrl);
        const list = this.json(await listResponse.text());
        const flag = String(list.flag ?? "");
        const identitySession = this.cookies.get("identity_session");
        if ((flag !== "4" && flag !== "8") || !identitySession) {
            // Do not include response content, URLs, cookie values or credentials.
            throw new Error(`Xiaomi 2FA response incomplete (verification method ${flag === "4" || flag === "8" ? "available" : "missing"}, identity session ${identitySession ? "present" : "missing"}).`);
        }
        this.pendingFlag = flag;
        const method = flag === "8" ? "Email" : "Phone";
        const cookieHeader = this.identityCookie();
        const optionsResponse = await this.request("https://account.xiaomi.com/identity/auth/verify" + method + "?_flag=" + flag + "&_json=true", {
            headers: { Cookie: cookieHeader }
        });
        const options = this.json(await optionsResponse.text());
        this.maskedDestination = String(flag === "8" ? options.maskedEmail ?? "your email" : options.maskedPhone ?? "your phone");
        const sent = await this.request("https://account.xiaomi.com/identity/auth/send" + method + "Ticket", {
            method: "POST",
            body: new URLSearchParams({ _json: "true", icode: "", retry: "0" }).toString(),
            headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieHeader }
        });
        const result = this.json(await sent.text());
        if (result.code !== 0)
            throw new Error("Xiaomi could not send the verification code (code " + String(result.code ?? "unknown") + ").");
    }
    async finishLogin(location) {
        // request() walks redirects manually, retaining every Set-Cookie and
        // Extension-Pragma header. This mirrors go2rtc's response history scan.
        await this.request(location);
        this.userId = this.cookies.get("userId") ?? this.userId;
        this.cUserId = this.cookies.get("cUserId") ?? this.cUserId;
        this.serviceToken = this.cookies.get("serviceToken") ?? "";
        this.passToken = this.cookies.get("passToken") ?? this.passToken;
        const missing = [!this.ssecurity && "ssecurity", !this.serviceToken && "serviceToken", !this.userId && "userId"];
        if (missing.some(Boolean)) {
            throw new Error("Xiaomi verification completed but session data is incomplete (missing " + missing.filter(Boolean).join(", ") + ").");
        }
    }
    async api(url, params) {
        const millis = Date.now(), nonce = Buffer.concat([(0, node_crypto_1.randomBytes)(8), Buffer.from(Math.floor(millis / 60000).toString(16).padStart(8, "0"), "hex")]).toString("base64");
        const signed = signedNonce(this.ssecurity, nonce), enc = { ...params };
        enc.rc4_hash__ = encSignature(url, "POST", signed, enc);
        for (const [k, v] of Object.entries(enc))
            enc[k] = crypt(signed, Buffer.from(v)).toString("base64");
        const signature = encSignature(url, "POST", signed, enc);
        const query = new URLSearchParams({ ...enc, signature, ssecurity: this.ssecurity, _nonce: nonce });
        const cookieHeader = [
            `userId=${this.userId}`,
            ...(this.cUserId ? [`cUserId=${this.cUserId}`] : []),
            `yetAnotherServiceToken=${this.serviceToken}`,
            `serviceToken=${this.serviceToken}`,
            "locale=en_GB", "timezone=GMT+01:00", "channel=MI_APP_STORE"
        ].join("; ");
        const response = await this.request(url + "?" + query.toString(), {
            method: "POST",
            headers: { "Accept-Encoding": "identity", "Content-Type": "application/x-www-form-urlencoded", "x-xiaomi-protocal-flag-cli": "PROTOCAL-HTTP2", "MIOT-ENCRYPT-ALGORITHM": "ENCRYPT-RC4", Cookie: cookieHeader }
        });
        const plain = crypt(signed, Buffer.from(await response.text(), "base64"), true).toString("utf8");
        let parsed;
        try {
            parsed = JSON.parse(plain);
        }
        catch {
            throw new Error("Xiaomi cloud returned an unreadable encrypted response");
        }
        if (parsed?.code !== 0)
            throw new Error("Xiaomi cloud API request failed (code " + String(parsed?.code ?? "unknown") + ").");
        return parsed;
    }
    async request(url, init = {}) {
        const headers = new Headers(init.headers);
        headers.set("User-Agent", this.agent);
        const cookie = this.cookies.header();
        if (cookie && !headers.has("Cookie"))
            headers.set("Cookie", cookie);
        let current = url;
        let requestInit = { ...init };
        for (let hop = 0; hop < 10; hop++) {
            const response = await fetch(current, { ...requestInit, headers, redirect: "manual", signal: AbortSignal.timeout(15000) });
            this.cookies.add(response.headers);
            // Preserve all account and STS cookies; Xiaomi can place security
            // state on a non-final redirect response.
            const extension = response.headers.get("Extension-Pragma");
            if (extension) {
                try {
                    const parsed = JSON.parse(extension);
                    if (typeof parsed.ssecurity === "string")
                        this.ssecurity = parsed.ssecurity;
                }
                catch {
                    throw new Error("Xiaomi returned an invalid cloud security header");
                }
            }
            if ([301, 302, 303, 307, 308].includes(response.status)) {
                const location = response.headers.get("location");
                if (!location)
                    throw new Error("Xiaomi authentication redirect had no location");
                current = new URL(location, current).toString();
                if (response.status === 303 || ((response.status === 301 || response.status === 302) && requestInit.method === "POST")) {
                    requestInit = { ...requestInit, method: "GET", body: undefined };
                }
                const updatedCookie = this.cookies.header();
                if (updatedCookie)
                    headers.set("Cookie", updatedCookie);
                continue;
            }
            if (!response.ok)
                throw new Error(`Xiaomi cloud request failed (HTTP ${response.status})`);
            return response;
        }
        throw new Error("Xiaomi authentication redirected too many times");
    }
    json(text) {
        try {
            return JSON.parse(text.replace(/^&&&START&&&/, ""));
        }
        catch {
            throw new Error("Xiaomi account returned an invalid login response");
        }
    }
}
exports.XiaomiCloudMapClient = XiaomiCloudMapClient;
