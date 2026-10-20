/* Canvas Harness distraction guard: the rules, without any page. A student who switches the guard on in the focus room
   lists sites (youtube.com) that should wait while they focus. While a focus session runs (not a break, not paused),
   a page on one of those sites shows a short reminder instead (focus-guard-page.js), with a way to continue for five
   minutes. The room keeps the switch and the list in `focusRoom.guard`; storage.js copies a small record of the
   running session to its own key (KEY) so the background can add the reminder only to those sites, only then.
   Canvas and the student's school sites are never covered. */
(function(root){
 'use strict';
 const KEY='reserve:focusGuard',SNOOZE_KEY='reserve:focusGuardSnooze';
 const MAX_SITES=50,SNOOZE_MS=5*60000,GOAL_MAX=140;
 // An open session has no end time; the guard lets go after a day in case it was never stopped.
 const OPEN_MAX=864e5;
 // Canvas and the files it serves are never covered, whatever the list says.
 const NEVER=['instructure.com','canvas-user-content.com'];
 const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const text=(v,max)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max):'';
 const covers=(site,host)=>host===site||host.endsWith('.'+site);
 const never=host=>NEVER.some(n=>covers(n,host));

 // The plain host name in what a student typed or pasted: 'YouTube.com', 'https://www.youtube.com/watch?v=1' and
 // 'm.youtube.com' are all fine; 'www.' is dropped so one entry covers the whole site. '' when it is not a web site.
 function hostOf(value){
  let s=typeof value==='string'?value.trim().toLowerCase():'';
  if(!s||s.length>300)return '';
  if(/^[a-z][a-z0-9+.-]*:/.test(s)&&!/^[^/]+:\d+(?:[/?#]|$)/.test(s)){
   if(!/^https?:\/\//.test(s))return '';
   s=s.replace(/^https?:\/\//,'');
  }
  s=s.split(/[/?#]/)[0];
  if(s.includes('@'))return '';
  s=s.replace(/:\d*$/,'').replace(/^\*\./,'');
  try{s=new URL('https://'+s).hostname;}catch{return '';}
  s=s.replace(/\.$/,'').replace(/^www\./,'');
  if(s.length>253||!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s))return '';
  return s;
 }
 const cleanHost=value=>{const h=hostOf(value);return h&&!never(h)?h:'';};
 function cleanSites(v){
  const out=[];
  for(const value of Array.isArray(v)?v:[]){const h=cleanHost(value);if(h&&!out.includes(h))out.push(h);if(out.length>=MAX_SITES)break;}
  return out;
 }
 function cleanGuard(v){const g=isRecord(v)?v:{};return {on:g.on===true,sites:cleanSites(g.sites)};}
 // The school's own Canvas sites, as host names, from origins or host names.
 function protectedHosts(list){
  const out=[];
  for(const value of Array.isArray(list)?list:[]){try{const h=new URL(/^https?:\/\//i.test(value)?value:'https://'+value).hostname.toLowerCase();if(h&&!out.includes(h))out.push(h);}catch{}}
  return out;
 }
 // Whether a site can go on the list. protect: the Canvas sites the student uses (never covered, not even by a parent
 // domain such as school.edu for canvas.school.edu).
 function check(value,list=[],protect=[]){
  const host=hostOf(value);
  if(!host)return {host:'',problem:'Enter a site such as youtube.com.'};
  if(never(host)||protectedHosts(protect).some(p=>covers(host,p)))return {host:'',problem:'Canvas and your school’s sites are never covered.'};
  if(list.includes(host))return {host:'',problem:`${host} is already on the list.`};
  if(list.length>=MAX_SITES)return {host:'',problem:`The list holds up to ${MAX_SITES} sites.`};
  return {host,problem:''};
 }

 // The record the background and the reminder work from: until when the guard holds, the session's goal, and the
 // sites. A paused session, a break, a guard that is off or has no sites: until is 0 and nothing is covered.
 const OFF=()=>({until:0,goal:'',sites:[],open:false});
 function record(data){
  const room=isRecord(data?.focusRoom)?data.focusRoom:{},guard=cleanGuard(room.guard),f=isRecord(data?.focus)?data.focus:{};
  if(!guard.on||!guard.sites.length)return OFF();
  const goal=text(f.goal,GOAL_MAX).trim();
  if(f.mode==='open')return Number.isFinite(f.startedAt)?{until:f.startedAt+OPEN_MAX,goal,sites:guard.sites,open:true}:OFF();
  if((f.phase||'focus')!=='focus'||!Number.isFinite(f.endsAt))return OFF();
  return {until:f.endsAt,goal,sites:guard.sites,open:false};
 }
 function cleanRecord(v){
  const r=isRecord(v)?v:{},until=Number.isFinite(r.until)&&r.until>0?Math.round(r.until):0;
  return until?{until,goal:text(r.goal,GOAL_MAX).trim(),sites:cleanSites(r.sites),open:r.open===true}:OFF();
 }
 // "Continue anyway": a site the student opened for five minutes. Only times still ahead are kept.
 function cleanSnooze(v,now=Date.now()){
  const out={};if(!isRecord(v))return out;
  for(const [site,until] of Object.entries(v).slice(0,MAX_SITES*2)){
   const h=cleanHost(site);
   if(h&&h===site&&Number.isFinite(until)&&until>now&&until<=now+SNOOZE_MS)out[h]=until;
  }
  return out;
 }
 const snooze=(v,site,now=Date.now())=>({...cleanSnooze(v,now),[site]:now+SNOOZE_MS});
 // What the guard does on a page: blocked (show the reminder), the list entry that matched, and when to look again
 // (the session's end, or the end of a five-minute pass). Only https pages; never Canvas or a school site.
 function status(recordValue,url,{now=Date.now(),snooze:passes={},protect=[]}={}){
  const none={blocked:false,site:'',wake:0},r=cleanRecord(recordValue);
  if(!(r.until>now)||!r.sites.length)return none;
  let host;try{const u=new URL(url);if(u.protocol!=='https:')return none;host=u.hostname.toLowerCase().replace(/\.$/,'');}catch{return none;}
  if(never(host)||protectedHosts(protect).includes(host))return none;
  const site=r.sites.find(s=>covers(s,host));if(!site)return none;
  const pass=Number(passes?.[site])||0;
  if(pass>now)return {blocked:false,site,wake:Math.min(pass,r.until)};
  return {blocked:true,site,wake:r.until};
 }
 // Chrome match patterns for the listed sites ('*.' also matches the site itself).
 const matches=sites=>cleanSites(sites).map(s=>`https://*.${s}/*`);

 const api={KEY,SNOOZE_KEY,MAX_SITES,SNOOZE_MS,OPEN_MAX,NEVER,hostOf,cleanHost,cleanSites,cleanGuard,check,record,cleanRecord,cleanSnooze,snooze,status,matches,covers};
 root.ReserveFocusGuardModel=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
