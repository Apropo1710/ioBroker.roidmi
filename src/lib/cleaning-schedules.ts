export interface ParsedCleaningSchedule {
    timeSeconds: number; timeText: string; enabled: boolean;
    fanSpeed: number; fanSpeedText: string; cleaningMode: number;
    weekdays: number[]; weekdaysText: string; waterLevel: number;
    waterLevelText: string; roomIds: number[]; trailingValue: unknown;
}
const FAN: Record<number,string> = {0:"Aus",1:"Leise",2:"Standard",3:"Stark",4:"Maximal"};
const WATER: Record<number,string> = {0:"Aus / kein Wasser",1:"Niedrig",2:"Mittel",3:"Hoch",4:"Zusatzstufe"};
const DAYS: Record<number,string> = {0:"So",1:"Mo",2:"Di",3:"Mi",4:"Do",5:"Fr",6:"Sa"};
function num(a: unknown[], i:number, label:string):number {
 const v=a[i]; if(typeof v!=="number" || !Number.isFinite(v)) throw new Error("Ungültiger Zeitplan: "+label);
 return v;
}
export function parseCleaningSchedules(json:string):ParsedCleaningSchedule[] {
 const root:unknown=JSON.parse(json);
 if(!root || typeof root!=="object" || !Array.isArray((root as {time?:unknown}).time)) throw new Error("Zeitplan-JSON ohne time-Array");
 return ((root as {time:unknown[]}).time).map((entry,index)=>{
  if(!Array.isArray(entry)||entry.length<8) throw new Error("Ungültiger Zeitplan-Eintrag "+index);
  const secs=num(entry,0,"Uhrzeit"), fan=num(entry,2,"Saugstufe"), mode=num(entry,3,"Modus"), water=num(entry,5,"Wasser");
  const days=entry[4], rooms=entry[6];
  if(!Array.isArray(days)||!days.every(x=>typeof x==="number")) throw new Error("Ungültige Wochentage im Eintrag "+index);
  if(!Array.isArray(rooms)||!rooms.every(x=>typeof x==="number")) throw new Error("Ungültige Raum-IDs im Eintrag "+index);
  const h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60);
  return {timeSeconds:secs,timeText:String(h).padStart(2,"0")+":"+String(m).padStart(2,"0"),enabled:num(entry,1,"Aktivierung")===1,
   fanSpeed:fan,fanSpeedText:FAN[fan]??"Unbekannt ("+fan+")",cleaningMode:mode,
   weekdays:days as number[],weekdaysText:(days as number[]).length===7?"täglich":(days as number[]).map(d=>DAYS[d]??"Tag "+d).join(", "),
   waterLevel:water,waterLevelText:WATER[water]??"Unbekannt ("+water+")",roomIds:rooms as number[],trailingValue:entry[7]};
 });
}
