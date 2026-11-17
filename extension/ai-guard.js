/* AI help's safety limits: how much Canvas Harness may ask of an AI website, and what makes it wait.
   Every number the owner may want to change is in LIMITS below; nothing else in the AI code repeats them. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CanvasHarnessAIGuard=api;
})(globalThis,function(root){
 'use strict';
 const HOUR=3600e3,DAY=24*HOUR;
 const LIMITS=Object.freeze({
   // Daily AI help that starts on its own (a Canvas visit, no click): at most this many runs an hour and a day,
   // counted when they start, whatever happens to them afterwards.
   autoRunsPerHour:1,
   autoRunsPerDay:3,
   // Messages typed into the AI website by any run, clicked or not, from every Canvas tab together.
   sendsPerHour:20,
   sendsPerDay:60,
   // The same, for each AI website on its own (ChatGPT, Claude, Gemini, Grok, DeepSeek, Kimi, Qwen, Z.ai). Set equal to
   // the totals above, so one site may use them all; lower them to keep every site further from its own limits.
   sendsPerSitePerHour:20,
   sendsPerSitePerDay:60,
   // An automatic run that stopped on a problem: the next automatic run waits this long (a click still runs).
   pauseAfterProblem:2*HOUR,
   // Stop pressed: automatic runs wait until the next day (a click still runs).
   stopPausesRestOfDay:true,
   // ChatGPT's and Claude's own chat record: read at most once in this long for one message.
   recordReadEvery:30e3,
   // The one automatic retry in a fresh chat waits this long first (doubled for each retry before it).
   retryWait:30e3,
   maxAutoRetries:1,
   // A run that has not moved for this long while it was meant to be working: the computer slept, or the browser
   // stopped the extension. It does not carry on by itself into anything new.
   sleepGap:5*60e3
 });
 const KEY='ch-ai-guard:v1';
 const MESSAGES={
   paused:'Daily AI help is paused after a problem. It starts again on its own later; a click on Daily AI help runs it now.',
   stopped:'Daily AI help is stopped for today. A click on Daily AI help runs it now.',
   signedOut:'Your AI website is signed out. Sign in there, then use Daily AI help.',
   hour:'Daily AI help already ran this hour. It starts again on its own later.',
   day:'Daily AI help ran as often as it may today.',
   sendsHour:'Canvas Harness sent your AI as many messages as it may this hour. Try again later.',
   sendsDay:'Canvas Harness sent your AI as many messages as it may today. Try again tomorrow.',
   siteHour:'Canvas Harness sent {site} as many messages as it may this hour. Try again later, or choose another AI in Your AI.',
   siteDay:'Canvas Harness sent {site} as many messages as it may today. Try again tomorrow, or choose another AI in Your AI.',
   busy:'Your AI is still working on the last request. Wait for it, or press Stop.',
   slept:'Your computer went to sleep while this help was being made. Nothing more was sent. Press Continue to carry on.'
 };
 const endOfDay=at=>{const d=new Date(at);d.setHours(24,0,0,0);return d.getTime();};
 const blank=()=>({v:1,sends:[],sendsBy:{},autoRuns:[],pausedUntil:0,pauseReason:'',signedOutSites:{}});
 // Each AI website by its id (its messages, and whether it was found signed out); the id is a plain short word.
 const siteId=id=>typeof id==='string'&&/^[\w.-]{1,40}$/.test(id)?id:'';
 const bySite=(value,fn)=>
  Object.fromEntries(Object.entries(value&&typeof value==='object'&&!Array.isArray(value)?value:{}).filter(([k])=>siteId(k)).slice(0,20).map(([k,v])=>[k,fn(v)]));
 function clean(value,at){
   const s=value&&typeof value==='object'&&value.v===1?value:blank(),recent=list=>
     (Array.isArray(list)?list:[]).filter(t=>Number.isFinite(t)&&t>at-DAY&&t<=at+60e3).slice(-500);
   // (an older record kept one signed-out site as signedOut:{provider,at})
   const old=s.signedOut&&typeof s.signedOut.provider==='string'?{[s.signedOut.provider||'any']:Number(s.signedOut.at)||at}:{};
   return {
     v:1,
     sends:recent(s.sends),
     sendsBy:Object.fromEntries(Object.entries(bySite(s.sendsBy,recent)).filter(([,list])=>list.length)),
     autoRuns:recent(s.autoRuns),
     pausedUntil:Number(s.pausedUntil)>at?Number(s.pausedUntil):0,
     pauseReason:Number(s.pausedUntil)>at?String(s.pauseReason||''):'',
     signedOutSites:Object.fromEntries(Object.entries(bySite({...old,...(s.signedOutSites||{})},t=>Number(t)||at)))
   };
 }
 function create({storage=root.chrome?.storage?.local,now=()=>Date.now(),limits=LIMITS}={}){
  let queue=Promise.resolve(),memory=null;
  const read=async()=>{
    if(!storage)return clean(memory,now());
    try{return clean((await storage.get(KEY))[KEY],now());}catch{return clean(memory,now());}
  };
  const write=async value=>{memory=value;if(storage)try{await storage.set({[KEY]:value});}catch{}};
  // One change at a time, so two Canvas tabs never both take the last allowed start.
  const change=fn=>{
    const work=queue.catch(()=>{}).then(async()=>{
      const s=await read(),before=JSON.stringify(s),result=fn(s,now());
      if(JSON.stringify(s)!==before)await write(s);
      return result;
    });
    queue=work;
    return work;
  };
  const within=(list,span,at)=>list.filter(t=>t>at-span).length;
  return {
    limits,
    MESSAGES,
    state:read,
    // An automatic Daily AI help may start (and is counted) only when nothing above says wait; dry: only asks.
    takeAutoRun:(provider,{dry=false}={})=>change((s,at)=>{
      const out=Object.keys(s.signedOutSites);
      if(siteId(provider)?out.includes(provider):out.length>0)return {ok:false,reason:'signed-out',message:MESSAGES.signedOut};
      if(s.pausedUntil>at)return {ok:false,reason:'paused',message:s.pauseReason==='stopped'?MESSAGES.stopped:MESSAGES.paused};
      if(within(s.autoRuns,HOUR,at)>=limits.autoRunsPerHour)return {ok:false,reason:'hour',message:MESSAGES.hour};
      if(within(s.autoRuns,DAY,at)>=limits.autoRunsPerDay)return {ok:false,reason:'day',message:MESSAGES.day};
      if(!dry)s.autoRuns.push(at);
      return {ok:true};
    }),
    // A message about to go into an AI website (counted when allowed): all sites together, then that site on its own.
    takeSend:provider=>change((s,at)=>{
      if(within(s.sends,HOUR,at)>=limits.sendsPerHour)return {ok:false,reason:'sends-hour',message:MESSAGES.sendsHour};
      if(within(s.sends,DAY,at)>=limits.sendsPerDay)return {ok:false,reason:'sends-day',message:MESSAGES.sendsDay};
      const site=siteId(provider),mine=site?s.sendsBy[site]||[]:[],name=root.CanvasHarnessProviders?.get?.(site)?.label||'your AI';
      if(site&&within(mine,HOUR,at)>=limits.sendsPerSitePerHour)return {ok:false,reason:'site-hour',message:MESSAGES.siteHour.replace('{site}',name)};
      if(site&&within(mine,DAY,at)>=limits.sendsPerSitePerDay)return {ok:false,reason:'site-day',message:MESSAGES.siteDay.replace('{site}',name)};
      s.sends.push(at);if(site)s.sendsBy[site]=[...mine,at];
      return {ok:true};
    }),
    pause:(reason='problem',span=limits.pauseAfterProblem)=>change((s,at)=>{
      const until=reason==='stopped'&&limits.stopPausesRestOfDay?endOfDay(at):at+span;
      if(until>s.pausedUntil){s.pausedUntil=until;s.pauseReason=reason;}
    }),
    // Remembered for each site on its own: a sign-out found on Gemini keeps Gemini's automatic help off, not ChatGPT's.
    signedOut:provider=>change((s,at)=>{s.signedOutSites[siteId(provider)||'any']=at;}),
    signedIn:provider=>change(s=>{delete s.signedOutSites[siteId(provider)||'any'];}),
    retryWait:retries=>limits.retryWait*2**Math.max(0,Number(retries||1)-1)
  };
 }
 return {create,LIMITS,MESSAGES,KEY,endOfDay};
});
