/* Shared local calendar helpers for local Biscuit reminders and routines. */
(function(root){
 'use strict';
 const MIN=60000,DAY=86400000,validDay=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 function defaultTimeZone(){
  const zones=[];try{zones.push(root.ReserveSite?.timeZone?.());}catch{}try{zones.push(Intl.DateTimeFormat().resolvedOptions().timeZone);}catch{}
  for(const zone of zones)if(typeof zone==='string'&&zone)try{new Intl.DateTimeFormat('en-US',{timeZone:zone});return zone;}catch{}
  return 'UTC';
 }
 function calendar(zone){
  const options={year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'};let f;
  try{f=new Intl.DateTimeFormat('en-US',{...options,timeZone:typeof zone==='string'&&zone?zone:defaultTimeZone()});}catch{f=new Intl.DateTimeFormat('en-US',{...options,timeZone:defaultTimeZone()});}
  return at=>{const p={};for(const v of f.formatToParts(at))p[v.type]=v.value;return {day:`${p.year}-${p.month}-${p.day}`,minute:Number(p.hour)*60+Number(p.minute),second:Number(p.second)};};
 }
 /* Round-trip all nearby offsets so gaps fail and folds choose the next real instant. */
 function wall(day,minute,zone,after=-Infinity){if(!validDay(day)||!Number.isInteger(minute)||minute<0||minute>=1440)return null;const local=calendar(zone),base=Date.parse(day+'T00:00:00Z')+minute*MIN,offsets=new Set();for(const delta of [-DAY,0,DAY]){const probe=base+delta,p=local(probe);offsets.add(Date.parse(p.day+'T00:00:00Z')+p.minute*MIN+p.second*1000-probe);}const matches=[...offsets].map(o=>base-o).filter(at=>{const p=local(at);return p.day===day&&p.minute===minute&&at>after;}).sort((a,b)=>a-b);return matches[0]??null;}
 const api=Object.freeze({calendar,wall,defaultTimeZone});root.CanvasHarnessAgentClock=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
