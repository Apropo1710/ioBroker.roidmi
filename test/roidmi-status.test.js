const test = require("node:test"); const assert = require("node:assert/strict");
const {getVacuumStateText,getChargingStateText}=require("../build/lib/roidmi-status.js");
test("observed vacuum state labels",()=>{assert.equal(getVacuumStateText(4),"Cleaning (observed)");assert.equal(getVacuumStateText(5),"Returning to dock (observed, provisional)");assert.equal(getVacuumStateText(77),"Unknown state (77)");});
test("charging labels do not imply charging",()=>{assert.match(getChargingStateText(1),/not yet confirmed/);});
