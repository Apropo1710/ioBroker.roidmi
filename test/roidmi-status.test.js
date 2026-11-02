const test = require("node:test"); const assert = require("node:assert/strict");
const {getVacuumStateText,getChargingStateText,getRoidmiErrorText}=require("../build/lib/roidmi-status.js");
test("observed vacuum state labels",()=>{assert.equal(getVacuumStateText(4),"Cleaning (observed)");assert.equal(getVacuumStateText(5),"Returning to dock (observed, provisional)");assert.equal(getVacuumStateText(77),"Unknown state (77)");});
test("charging labels do not imply charging",()=>{assert.match(getChargingStateText(1),/not yet confirmed/);});

test("maps known Roidmi fault codes to readable messages",()=>{assert.equal(getRoidmiErrorText(0),"No error");assert.equal(getRoidmiErrorText(16),"Robot is trapped");assert.equal(getRoidmiErrorText(24),"Failed to return to dock");});
test("keeps unknown fault codes explicit",()=>{assert.equal(getRoidmiErrorText(99),"Unknown error code (99)");});
