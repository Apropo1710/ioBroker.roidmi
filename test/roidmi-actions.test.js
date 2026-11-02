const test = require("node:test");
const assert = require("node:assert/strict");
const { buildVacuumAction, getActionResponseError, getActionFailureStatus } = require("../build/lib/roidmi-actions.js");
test("starts whole-map cleaning through the sweep service", () => {
    assert.deepEqual(buildVacuumAction("start"), { siid: 14, aiid: 1, in: [1, ""] });
});
test("uses the documented pause and resume actions", () => {
    assert.deepEqual(buildVacuumAction("pause"), { siid: 8, aiid: 8 });
    assert.deepEqual(buildVacuumAction("resume"), { siid: 8, aiid: 5 });
});
test("returns to dock through the battery service", () => {
    assert.deepEqual(buildVacuumAction("dock"), { siid: 3, aiid: 1 });
});
test("supports explicit stop cleaning", () => {
    assert.deepEqual(buildVacuumAction("stop"), { siid: 2, aiid: 2 });
});

test("accepts successful MIoT action response",()=>{assert.equal(getActionResponseError([{code:0}]),null);});
test("reports non-zero MIoT action result code",()=>{assert.equal(getActionResponseError([{code:7}]),"MIoT action rejected (code 7)");});
test("does not reject unknown response shape without a code",()=>{assert.equal(getActionResponseError({ok:true}),null);});

test("classifies local MIoT timeout as unknown outcome and never suggests retry", () => {
    assert.deepEqual(getActionFailureStatus(new Error("miIO request timed out"), "local"), {
        status: "Timeout: no MIoT acknowledgement; command outcome unknown (it may have reached the robot)",
        uncertain: true
    });
});
test("classifies Xiaomi Cloud timeout separately with unknown outcome", () => {
    assert.deepEqual(getActionFailureStatus(new Error("Request timed out"), "cloud"), {
        status: "Timeout: Xiaomi Cloud did not confirm the command; outcome unknown (it may have reached the robot)",
        uncertain: true
    });
});
test("reports missing cloud session as a setup issue, not a command timeout", () => {
    assert.deepEqual(getActionFailureStatus(new Error("Xiaomi Cloud session is unavailable; sign in first"), "cloud"), {
        status: "Cloud session unavailable: sign in and complete Xiaomi verification first",
        uncertain: false
    });
});
test("preserves explicit MIoT action rejection as a failure", () => {
    assert.deepEqual(getActionFailureStatus(new Error("MIoT action rejected (code 7)"), "local"), {
        status: "Failed: MIoT action rejected (code 7)",
        uncertain: false
    });
});
