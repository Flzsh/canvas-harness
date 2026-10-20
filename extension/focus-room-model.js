/* Canvas Harness focus room: the rules, without any page. The Home timer and the full-screen focus room share one
   session (personal data `focus`): a plain timer, Pomodoro rounds with short and long breaks, or an open session that
   counts up. Finished sessions go to a small log (`focusLog`) for the room's numbers; the room's own choices (scene,
   dimming, sounds, round lengths, the distraction guard of focus-guard-model.js) are `focusRoom`. Everything stays on this device. Nothing here writes to Canvas. */
(function(root){
 'use strict';
 const MODES=['timer','pomodoro','open'],PHASES=['focus','short','long'];
 const SCENES=['rain','night','ocean','lamp','starry','lilies','ink','course','photo','video','plain'];
 const SOUNDS=['white','pink','brown','rain','own'];
 // Lengths a student can choose, in minutes. The Home module's 15/25/45/60 chips sit inside the timer range.
 const LIMITS={minutes:[5,120],work:[5,120],short:[1,30],long:[5,60],every:[2,8],dim:[0,85],blur:[0,24]};
 // Media a student adds for the backdrop or as a sound. Kept in the extension's own storage on this device.
 const MEDIA={photo:{types:['image/jpeg','image/png','image/webp','image/gif','image/avif'],max:25*1024*1024},
  video:{types:['video/mp4','video/webm','video/quicktime'],max:100*1024*1024},
  audio:{types:['audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/wav','audio/x-wav','audio/webm','audio/flac','audio/x-m4a'],max:30*1024*1024}};
 const LOG_MAX=400,LOG_DAYS=120,GOAL_MAX=140,DAY=864e5;
 const DEFAULT_ROOM={scene:'rain',dim:35,blur:0,work:25,short:5,long:15,every:4,auto:false,chime:true,
  sound:{on:false,volume:.5,white:0,pink:0,brown:.6,rain:0,own:0},media:{photo:null,video:null,audio:null},guard:{on:false,sites:[]}};
 // The guard's rules live in focus-guard-model.js, which loads just after this file.
 const Guard=()=>root.ReserveFocusGuardModel||(typeof module==='object'&&module.exports&&typeof require==='function'?require('./focus-guard-model.js'):null);

 const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const int=(v,[lo,hi],fallback)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.round(v))):fallback;
 const unit=(v,fallback)=>Number.isFinite(v)?Math.max(0,Math.min(1,Math.round(v*100)/100)):fallback;
 const text=(v,max)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max):'';

 function cleanMedia(v){
  if(!isRecord(v))return null;
  const name=text(v.name,120).trim(),type=text(v.type,60),size=Number.isFinite(v.size)?Math.max(0,Math.round(v.size)):0;
  return name&&type&&size?{name,type,size}:null;
 }
 function cleanRoom(v){
  const r=isRecord(v)?v:{},d=DEFAULT_ROOM,s=isRecord(r.sound)?r.sound:{},m=isRecord(r.media)?r.media:{};
  const sound={on:s.on===true,volume:unit(s.volume,d.sound.volume)};
  for(const k of SOUNDS)sound[k]=unit(s[k],d.sound[k]??0);
  return {scene:SCENES.includes(r.scene)?r.scene:d.scene,dim:int(r.dim,LIMITS.dim,d.dim),blur:int(r.blur,LIMITS.blur,d.blur),
   work:int(r.work,LIMITS.work,d.work),short:int(r.short,LIMITS.short,d.short),long:int(r.long,LIMITS.long,d.long),every:int(r.every,LIMITS.every,d.every),
   auto:r.auto===true,chime:r.chime!==false,sound,media:{photo:cleanMedia(m.photo),video:cleanMedia(m.video),audio:cleanMedia(m.audio)},
   guard:Guard()?Guard().cleanGuard(r.guard):{on:false,sites:[]}};
 }
 // The session record. The first five fields are the ones the Home timer always had; the room's fields are stored only
 // when they say something (cleanFocus), so a plain timer's data is exactly what it was before the room. full() is the
 // same record with every field, which the rules below work on.
 function cleanFocus(v){
  const f=full(v),out={minutes:f.minutes,remaining:f.remaining,endsAt:f.endsAt,itemId:f.itemId,sessions:f.sessions};
  if(f.mode!=='timer')out.mode=f.mode;if(f.phase!=='focus')out.phase=f.phase;if(f.round!==1)out.round=f.round;if(f.goal)out.goal=f.goal;
  if(f.startedAt)out.startedAt=f.startedAt;if(f.elapsed)out.elapsed=f.elapsed;
  return out;
 }
 function full(v){
  const f=isRecord(v)?v:{},mode=MODES.includes(f.mode)?f.mode:'timer',phase=mode==='pomodoro'&&PHASES.includes(f.phase)?f.phase:'focus';
  const minutes=Number.isInteger(f.minutes)&&f.minutes>=1&&f.minutes<=120?f.minutes:25;
  return {minutes,remaining:Number.isFinite(f.remaining)?Math.max(0,Math.min(7200,f.remaining)):minutes*60,endsAt:Number.isFinite(f.endsAt)?f.endsAt:null,
   itemId:text(f.itemId,100)||null,sessions:Number.isInteger(f.sessions)?Math.max(0,f.sessions):0,
   mode,phase,round:Number.isInteger(f.round)?Math.max(1,Math.min(8,f.round)):1,goal:text(f.goal,GOAL_MAX),
   startedAt:mode==='open'&&Number.isFinite(f.startedAt)?f.startedAt:null,elapsed:Number.isFinite(f.elapsed)?Math.max(0,Math.min(86400,Math.round(f.elapsed))):0};
 }
 function cleanLog(v,now=Date.now()){
  if(!Array.isArray(v))return [];
  const oldest=now-LOG_DAYS*DAY,out=[];
  for(const e of v.slice(-LOG_MAX*2)){
   if(!isRecord(e)||!Number.isFinite(e.at)||e.at<oldest||e.at>now+DAY)continue;
   const m=Number.isFinite(e.m)&&e.m>=1?Math.min(600,Math.round(e.m)):0;if(!m)continue;
   out.push({at:Math.round(e.at),m,i:text(e.i,100)||null,g:text(e.g,GOAL_MAX)});
  }
  return out.sort((a,b)=>a.at-b.at).slice(-LOG_MAX);
 }

 // What the timer shows now. `left` counts down; an open session counts up in `elapsed`.
 function state(focus,now=Date.now()){
  const f=full(focus),total=f.minutes*60;
  if(f.mode==='open'){
   const elapsed=f.elapsed+(f.startedAt?Math.max(0,Math.floor((now-f.startedAt)/1000)):0);
   return {...f,total:3600,running:!!f.startedAt,left:elapsed,elapsed,progress:(elapsed%3600)/3600,shown:elapsed,brk:false};
  }
  const running=!!f.endsAt,raw=running?Math.max(0,Math.ceil((f.endsAt-now)/1000)):Math.max(0,Math.min(total,f.remaining));
  const left=raw||(!running?total:0);
  return {...f,total,running,left,elapsed:total-left,progress:1-left/total,shown:left,brk:f.phase!=='focus'};
 }
 const lengthOf=(phase,room)=>phase==='short'?room.short:phase==='long'?room.long:room.work;
 // Pick how the next session runs. Changing mode never throws away the sessions count, the goal or the chosen work.
 function setMode(focus,mode,roomValue){
  const f=full(focus),room=cleanRoom(roomValue);if(!MODES.includes(mode))return f;
  const minutes=mode==='pomodoro'?room.work:mode==='timer'?(f.mode==='timer'?f.minutes:room.work):f.minutes;
  return {...f,mode,phase:'focus',round:1,minutes,remaining:minutes*60,endsAt:null,startedAt:null,elapsed:0};
 }
 function setMinutes(focus,minutes){
  const f=full(focus),m=int(minutes,LIMITS.minutes,f.minutes);
  return {...f,mode:f.mode==='open'?'timer':f.mode,phase:'focus',minutes:m,remaining:m*60,endsAt:null,startedAt:null,elapsed:0};
 }
 function start(focus,now=Date.now()){
  const f=full(focus);
  if(f.mode==='open')return f.startedAt?f:{...f,startedAt:now};
  if(f.endsAt)return f;
  const s=state(f,now);return {...f,remaining:s.left,endsAt:now+s.left*1000};
 }
 function pause(focus,now=Date.now()){
  const f=full(focus),s=state(f,now);
  if(f.mode==='open')return {...f,startedAt:null,elapsed:s.elapsed};
  return f.endsAt?{...f,remaining:s.left,endsAt:null}:f;
 }
 function reset(focus){const f=full(focus);return {...f,remaining:f.minutes*60,endsAt:null,startedAt:null,elapsed:0};}
 function logEntry(data,minutes,at,focus){
  if(minutes<1)return;
  data.focusLog=cleanLog([...(Array.isArray(data.focusLog)?data.focusLog:[]),{at,m:minutes,i:focus.itemId,g:focus.goal}],Math.max(at,Date.now()));
 }
 // A timed phase that has run out. Returns 'focus' when a work session finished (the pony celebrates, the log grows),
 // 'break' when a break finished, or false. Pomodoro moves on by itself: a break starts as soon as work ends, and the
 // next round starts after it only when the student asked for that. A phase that ended long ago (the page was closed)
 // is recorded but the next one waits, so nobody comes back to a round that ran without them.
 function settle(data,now=Date.now()){
  const f=full(data&&data.focus);if(!f.endsAt||now<f.endsAt)return false;
  const room=cleanRoom(data.focusRoom),ended=f.endsAt,fresh=now-ended<60000;
  if(f.phase==='focus'){
   logEntry(data,f.minutes,ended,f);
   const next={...f,sessions:f.sessions+1,endsAt:null,remaining:0};
   if(f.mode==='pomodoro'){
    const phase=f.round>=room.every?'long':'short',minutes=lengthOf(phase,room);
    Object.assign(next,{phase,minutes,remaining:minutes*60,endsAt:fresh?ended+minutes*60000:null});
   }
   data.focus=next;return 'focus';
  }
  const round=f.phase==='long'?1:Math.min(8,f.round+1),minutes=room.work;
  data.focus={...f,phase:'focus',round,minutes,remaining:minutes*60,endsAt:fresh&&room.auto?ended+minutes*60000:null};
  return 'break';
 }
 // "Finish now": log what was actually worked (whole minutes), then get ready for the next session.
 function finish(data,now=Date.now()){
  const f=full(data&&data.focus),s=state(f,now),room=cleanRoom(data.focusRoom);
  if(s.brk){data.focus={...f,phase:'focus',round:f.phase==='long'?1:Math.min(8,f.round+1),minutes:room.work,remaining:room.work*60,endsAt:null};return false;}
  const minutes=Math.floor(s.elapsed/60);
  logEntry(data,minutes,now,f);
  data.focus={...reset(f),sessions:f.sessions+(minutes>=1?1:0)};
  return minutes>=1?'focus':false;
 }

 // The room's numbers. dayOf turns a time into a 'YYYY-MM-DD' day in the student's time zone; courseOf turns an
 // assignment id into a course id (or null).
 function stats(logValue,{now=Date.now(),dayOf=t=>new Date(t).toISOString().slice(0,10),courseOf=()=>null}={}){
  const log=cleanLog(logValue,now),today=dayOf(now),days=new Map();
  for(const e of log)days.set(dayOf(e.at),(days.get(dayOf(e.at))||0)+e.m);
  let streak=0;
  for(let i=days.has(today)?0:1;i<400;i++){if(days.has(dayOf(now-i*DAY)))streak++;else break;}
  const week=[],weekDays=new Set(Array.from({length:7},(_,i)=>dayOf(now-i*DAY))),courses=new Map();
  for(const e of log)if(weekDays.has(dayOf(e.at))){const c=e.i?courseOf(e.i):null,key=c==null?'':String(c);courses.set(key,(courses.get(key)||0)+e.m);}
  for(const [courseId,minutes] of courses)week.push({courseId:courseId||null,minutes});
  week.sort((a,b)=>b.minutes-a.minutes);
  return {today:days.get(today)||0,streak,week,weekTotal:week.reduce((n,x)=>n+x.minutes,0),recent:log.slice(-5).reverse()};
 }
 // Why a file can't be used, or '' when it can.
 function checkMedia(kind,file){
  const rule=MEDIA[kind];if(!rule||!file)return 'Choose a file.';
  if(!rule.types.includes(String(file.type||'').toLowerCase().split(';')[0].trim()))return kind==='photo'?'Use a JPG, PNG, WebP, GIF or AVIF picture.':kind==='video'?'Use an MP4, WebM or MOV video.':'Use an MP3, M4A, AAC, OGG, WAV, WebM or FLAC sound.';
  if(!(file.size>0))return 'That file is empty.';
  if(file.size>rule.max)return `That file is larger than ${Math.round(rule.max/1048576)} MB.`;
  return '';
 }
 const clock=seconds=>{const s=Math.max(0,Math.floor(seconds)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),pad=n=>String(n).padStart(2,'0');return h?`${h}:${pad(m)}:${pad(s%60)}`:`${pad(m)}:${pad(s%60)}`;};
 const minutesText=m=>m<60?`${m} min`:`${Math.floor(m/60)} h${m%60?` ${m%60} min`:''}`;

 const api={MODES,PHASES,SCENES,SOUNDS,LIMITS,MEDIA,DEFAULT_ROOM,cleanRoom,cleanFocus,full,cleanLog,state,setMode,setMinutes,start,pause,reset,settle,finish,stats,checkMedia,clock,minutesText};
 root.ReserveFocusRoomModel=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
