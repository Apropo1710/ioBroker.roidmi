/** Maps legacy ioBroker state IDs to the current device-specific tree. */
const LEGACY_STATUS_IDS = new Set([
  "battery", "charging", "state", "errorCode", "fanSpeed", "sweepType",
  "waterLevel", "doubleClean", "pathType", "individual",
  "stateText", "errorCodeText", "chargingText"
]);

export function mapLegacyStateId(oldId: string): string | undefined {
  if (oldId.startsWith("xiaomi.")) return "x20Plus." + oldId.slice("xiaomi.".length);
  if (oldId.startsWith("control.")) return "evePlus.control." + oldId.slice("control.".length);
  if (oldId.startsWith("map.")) return "evePlus.map." + oldId.slice("map.".length);
  if (oldId.startsWith("rooms.")) return "evePlus.rooms." + oldId.slice("rooms.".length);
  if (oldId.startsWith("timing.")) return "evePlus.timing." + oldId.slice("timing.".length);
  if (oldId.startsWith("info.")) return "evePlus." + oldId;
  if (LEGACY_STATUS_IDS.has(oldId)) return "evePlus.status." + oldId;
  return undefined;
}

export const LEGACY_EMPTY_FOLDERS = ["control", "map", "rooms", "timing", "xiaomi"] as const;
