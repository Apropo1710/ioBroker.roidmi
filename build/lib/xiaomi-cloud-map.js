"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XiaomiCloudMapClient = void 0;
const node_crypto_1 = require("node:crypto");
const roidmi_map_1 = require("./roidmi-map");
class CookieStore {
    values = new Map();
    add(headers) {
        const lines = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [headers.get("set-cookie") ?? ""];
        for (const line of lines) {
            const first = line.split(";")[0], index = first.indexOf("=");
            if (index > 0)
                this.values.set(first.slice(0, index).trim(), first.slice(index + 1).trim());
        }
    }
    header() { return [...this.values].map(([k, v]) => `${k}=${v}`).join("; "); }
    get(name) { return this.values.get(name); }
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
    agent = "Android-7.1.1-1.0.0-ROIDMIIOBROKER APP/xiaomi.smarthome APPV/62830";
    async fetchMap(o) {
        if (!o.username.trim() || !o.password || !o.mapName.trim())
            throw new Error("Xiaomi cloud username, password and map name are required");
        const first = await this.request("https://account.xiaomi.com/pass/serviceLogin?sid=xiaomiio&_json=true", { headers: { Cookie: `userId=${encodeURIComponent(o.username)}` } });
        const init = this.json(await first.text());
        if (typeof init._sign !== "string")
            throw new Error("Xiaomi login could not be initialized");
        const fields = new URLSearchParams({ sid: "xiaomiio", hash: (0, node_crypto_1.createHash)("md5").update(o.password).digest("hex").toUpperCase(), callback: "https://sts.api.io.mi.com/sts", qs: "%3Fsid%3Dxiaomiio%26_json%3Dtrue", user: o.username, _sign: init._sign, _json: "true" });
        const login = await this.request("https://account.xiaomi.com/pass/serviceLoginAuth2", { method: "POST", body: fields.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        const auth = this.json(await login.text());
        if (typeof auth.ssecurity !== "string") {
            if (typeof auth.notificationUrl === "string")
                throw new Error("XIAOMI_2FA:" + auth.notificationUrl);
            throw new Error("Xiaomi login failed. Check account, password and region.");
        }
        this.ssecurity = auth.ssecurity;
        this.userId = String(auth.userId ?? "");
        if (typeof auth.location !== "string")
            throw new Error("Xiaomi login returned no authentication location");
        await this.request(auth.location);
        this.serviceToken = this.cookies.get("serviceToken") ?? "";
        if (!this.serviceToken)
            throw new Error("Xiaomi login did not provide a service token");
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
    async api(url, params) {
        const millis = Date.now(), nonce = Buffer.concat([(0, node_crypto_1.randomBytes)(8), Buffer.from(Math.floor(millis / 60000).toString(16).padStart(8, "0"), "hex")]).toString("base64");
        const signed = signedNonce(this.ssecurity, nonce), enc = { ...params };
        enc.rc4_hash__ = encSignature(url, "POST", signed, enc);
        for (const [k, v] of Object.entries(enc))
            enc[k] = crypt(signed, Buffer.from(v)).toString("base64");
        const signature = encSignature(url, "POST", signed, enc);
        const query = new URLSearchParams({ ...enc, signature, ssecurity: this.ssecurity, _nonce: nonce });
        const response = await this.request(url + "?" + query.toString(), { method: "POST", headers: { "Accept-Encoding": "identity", "Content-Type": "application/x-www-form-urlencoded", "x-xiaomi-protocal-flag-cli": "PROTOCAL-HTTP2", "MIOT-ENCRYPT-ALGORITHM": "ENCRYPT-RC4", Cookie: `userId=${this.userId}; yetAnotherServiceToken=${this.serviceToken}; serviceToken=${this.serviceToken}; locale=en_GB; timezone=GMT+01:00; channel=MI_APP_STORE` } });
        const plain = crypt(signed, Buffer.from(await response.text(), "base64"), true).toString("utf8");
        try {
            return JSON.parse(plain);
        }
        catch {
            throw new Error("Xiaomi cloud returned an unreadable encrypted response");
        }
    }
    async request(url, init = {}) {
        const headers = new Headers(init.headers);
        headers.set("User-Agent", this.agent);
        const cookie = this.cookies.header();
        if (cookie && !headers.has("Cookie"))
            headers.set("Cookie", cookie);
        let current = url;
        for (let hop = 0; hop < 6; hop++) {
            const response = await fetch(current, { ...init, headers, redirect: "manual", signal: AbortSignal.timeout(15000) });
            this.cookies.add(response.headers);
            if ([301, 302, 303, 307, 308].includes(response.status)) {
                const location = response.headers.get("location");
                if (!location)
                    throw new Error("Xiaomi authentication redirect had no location");
                current = new URL(location, current).toString();
                if (response.status === 303 || (response.status === 302 && init.method === "POST")) {
                    init = { ...init, method: "GET", body: undefined };
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
    json(text) { try {
        return JSON.parse(text.replace(/^&&&START&&&/, ""));
    }
    catch {
        throw new Error("Xiaomi account returned an invalid login response");
    } }
}
exports.XiaomiCloudMapClient = XiaomiCloudMapClient;
