const test = require("node:test");
const assert = require("node:assert/strict");
const { createRoomCleanObservationTracker, observeRoomCleanStatus } = require("../build/lib/xiaomi-room-clean-status.js");
test("recognizes idle-to-cleaning transition", () => { const t=createRoomCleanObservationTracker(2); assert.equal(observeRoomCleanStatus(t,1).state,"observed"); });
test("already cleaning is ambiguous", () => { const t=createRoomCleanObservationTracker(1); assert.equal(observeRoomCleanStatus(t,12).state,"ambiguous"); });
test("does not infer failure after normal polls", () => { const t=createRoomCleanObservationTracker(2,2); assert.equal(observeRoomCleanStatus(t,2).state,"pending"); const r=observeRoomCleanStatus(t,2); assert.equal(r.state,"not-observed"); assert.match(r.message,/unverified/i); });
test("maintenance states are not cleaning", () => { const t=createRoomCleanObservationTracker(2); assert.equal(observeRoomCleanStatus(t,22).state,"pending"); });
