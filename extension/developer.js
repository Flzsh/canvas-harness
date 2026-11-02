/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
// Developer tools: one read-only tab in Tools that shows what is running, what broke and what it cost, and copies all of it as a
// report that is safe to paste in public. The idea of a developer view came from issue #65 on GitHub; this is written fresh.
// Data rules: the rows come from an allowlist, so nothing is cleaned after the fact. No names, titles, coursework, messages,
// stack text, school address, user id, storage keys or addresses ever reach a row. Course and assignment ids show in the panel
// for one item and leave only one at a time, on a press; they are never in the report. Nothing is saved and nothing is sent.
(function(root){
 'use strict';
 const MAX_ERRORS=20,MAX_RENDERS=200,REPORT_ERRORS=10,MB=1e6,BUDGET={personal:4,cache:4,materials:2,changes:2},AREAS=Object.keys(BUDGET);
 const errors=new Map(),renders=[],watchers=new Set();let opened=0,dropped=0;
 const changed=()=>{for(const fn of watchers){try{fn();}catch{}}};

 // ---- capture: only errors thrown in this extension's own files, by type, file and line. The message is never read.
 const base=()=>{try{return root.chrome?.runtime?.getURL?.('')||'';}catch{return '';}};
 const place=(url,line)=>{
  const b=base(),u=String(url||'');
  if(!b||!u.startsWith(b))return null;
  const file=u.slice(b.length);
  return /^[\w./-]{1,80}\.m?js$/.test(file)&&Number.isInteger(line)?{file,line}:null;
 };
 function fromStack(error){
  const b=base();
  if(!b)return null;
  let stack='';
  try{stack=String(error?.stack||'');}catch{return null;}
  for(const row of stack.split('\n')){
   if(!/^\s+at /.test(row))continue;
   const at=row.indexOf(b);
   if(at<0)continue;
   const m=/^([\w./-]{1,80}\.m?js):(\d{1,7}):/.exec(row.slice(at+b.length));
   if(m)return {file:m[1],line:Number(m[2])};
  }
  return null;
 }
 const typeOf=name=>{const n=typeof name==='string'?name:'';return /^[A-Z][A-Za-z]{0,30}Error$/.test(n)?n:'Error';};
 function note(name,at){const key=`${typeOf(name)} ${at.file}:${at.line}`;if(errors.has(key)||errors.size<MAX_ERRORS)errors.set(key,(errors.get(key)||0)+1);else dropped++;changed();}
 function onError(event){if(!event?.isTrusted)return;const at=place(event.filename,event.lineno);if(at)note(event.error?.name,at);}
 function onRejection(event){if(!event?.isTrusted)return;const at=fromStack(event.reason);if(at)note(event.reason?.name,at);}
 function caught(error){const at=fromStack(error);if(at)note(error?.name,at);}
 function rendered(ms){
  if(!Number.isFinite(ms))return;
  if(!opened)opened=Math.round(root.performance?.now?.()||0);
  renders.push(Math.max(0,Math.round(ms)));
  if(renders.length>MAX_RENDERS)renders.shift();
  changed();
 }
 const errorList=()=>[...errors].map(([key,count])=>{
  const [type,where]=key.split(' '),cut=where.lastIndexOf(':');
  return {type,file:where.slice(0,cut),line:Number(where.slice(cut+1)),count};
 }).sort((a,b)=>b.count-a.count||a.file.localeCompare(b.file)||a.line-b.line);

 // ---- pure: everything comes in as arguments, so it runs the same in Node
 const same=(a,b)=>{try{return JSON.stringify(a)===JSON.stringify(b);}catch{return false;}};
 const mins=n=>Math.max(0,Math.round(n));
 function offsetText(minutesBehind){
  if(!Number.isFinite(minutesBehind))return 'UTC';
  const ahead=-minutesBehind,h=Math.trunc(Math.abs(ahead)/60),m=Math.abs(ahead)%60;
  return `UTC${ahead<0?'-':'+'}${h}${m?':'+String(m).padStart(2,'0'):''}`;
 }
 function browserOf(ua){const s=String(ua||''),edge=/Edg\/(\d{1,4})/.exec(s),chrome=edge?null:/Chrome\/(\d{1,4})/.exec(s);return edge?`Edge ${edge[1]}`:chrome?`Chrome ${chrome[1]}`:'other';}
 function median(list){if(!list.length)return null;const s=[...list].sort((a,b)=>a-b),i=s.length>>1;return s.length%2?s[i]:Math.round((s[i-1]+s[i])/2);}
 function facts(input={}){
  const m=input.manifest||{},f=input.features||{},cfg=input.settings||{},cache=input.cache||null,speed=input.speed||{},sizes=input.storage||{};
  const on=new Set(Array.isArray(f.enabled)?f.enabled:[]),full=new Set(Array.isArray(f.full)?f.full:[]);
  const settings=[],defaults=cfg.defaults||{},values=cfg.values||{},enums=cfg.enums||{};
  for(const name of Object.keys(defaults)){
   if(!(name in values)||same(values[name],defaults[name]))continue;
   const v=values[name],d=defaults[name];
   settings.push(typeof d==='boolean'&&typeof v==='boolean'||Array.isArray(enums[name])&&typeof v==='string'&&enums[name].includes(v)?{name,value:v}:{name});
  }
  const codes={};
  for(const e of Array.isArray(cache?.errors)?cache.errors:[]){let c='';try{c=String(e?.code??'');}catch{}const k=/^[a-z0-9-]{1,16}$/i.test(c)?c.toLowerCase():'other';codes[k]=(codes[k]||0)+1;}
  const fetched=Date.parse(cache?.fetchedAt||''),now=Number.isFinite(input.now)?input.now:Date.now();
  const list=Array.isArray(speed.renders)?speed.renders.filter(Number.isFinite):[];
  return {
   build:{version:String(m.version_name||m.version||'?').slice(0,24),install:m.update_url?'store':'unpacked',browser:browserOf(input.userAgent),offset:offsetText(input.offset)},
   features:{preset:String(f.preset||'?').replace(/[^a-z-]/g,'').slice(0,16)||'?',added:[...on].filter(id=>!full.has(id)).sort(),removed:[...full].filter(id=>!on.has(id)).sort()},
   settings,
   canvas:{
    synced:Number.isFinite(fetched)?mins((now-fetched)/60000):null,
    courses:Number.isInteger(input.courses)?input.courses:null,
    items:Number.isInteger(input.items)?input.items:null,
    partial:!!cache?.partial,
    codes
   },
   speed:{
    open:Number.isFinite(speed.open)&&speed.open>0?Math.round(speed.open):null,
    median:median(list),
    worst:list.length?Math.max(...list):null,
    renders:list.length
   },
   storage:Object.fromEntries(AREAS.map(a=>[a,Number.isFinite(sizes[a])?sizes[a]:null])),
   errors:(Array.isArray(input.errors)?input.errors:[]).map(e=>
    ({type:typeOf(e.type),file:String(e.file).replace(/[^\w./-]/g,'').slice(0,80),line:Number.isInteger(e.line)?e.line:0,count:Number.isInteger(e.count)?e.count:1})),
   dropped:Number.isInteger(input.dropped)?input.dropped:0
  };
 }
 const ago=n=>n==null?'not synced':n<1?'synced just now':n<120?`synced ${n} min ago`:`synced ${Math.round(n/60)} h ago`;
 const size=n=>n==null?'?':n<MB?`${Math.round(n/1000)} KB`:`${(n/MB).toFixed(n<MB*10?1:0)} MB`;
 function rows(f,{errorRows=MAX_ERRORS}={}){
  const b=f.build,fe=f.features,c=f.canvas,s=f.speed,codes=Object.entries(c.codes).sort((a,z)=>z[1]-a[1]).map(([k,n])=>`${k} x${n}`);
  const diff=[...fe.added.map(id=>'+'+id),...fe.removed.map(id=>'-'+id)].join(' ');
  const errorText=f.errors.slice(0,errorRows).map(e=>`${e.type} ${e.file}:${e.line} x${e.count}`),more=f.errors.length-errorText.length+f.dropped;
  return [
   ['Build',[b.version,b.install,b.browser,b.offset]],
   ['Features',[fe.preset,...(diff?['Full',...diff.split(' ')]:['same as Full'])]],
   ['Settings',f.settings.length?f.settings.map(x=>'value' in x?`${x.name}=${x.value}`:x.name):['defaults']],
   ['Canvas',[ago(c.synced),c.courses==null?null:`${c.courses} courses`,c.items==null?null:`${c.items} items`,c.partial?'partial':null,...codes].filter(Boolean)],
   ['Speed',s.renders?[s.open==null?null:`open ${s.open} ms`,`render ${s.median} ms`,`worst ${s.worst} ms`,`${s.renders} renders`].filter(Boolean):['no renders yet']],
   ['Storage',AREAS.map(a=>`${a} ${size(f.storage[a])} of ${BUDGET[a]} MB`)],
   ['Errors',errorText.length?[...errorText,...(more>0?[`+${more} more`]:[])]:['none']]
  ];
 }
 function report(f){
  const list=rows(f,{errorRows:REPORT_ERRORS}),w=Math.max(...list.map(([n])=>n.length))+2;
  return '### Canvas Harness report\n\n```text\n'+list.map(([n,v])=>n.padEnd(w)+v.join(' · ')).join('\n')+'\n```\n';
 }

 // ---- the item open now: ids that are all digits, from the reader or the address. Shown in the panel only.
 function itemOf({reader,items,pathname}){
  const id=String(reader||'');
  if(/^\d{1,15}$/.test(id)){
   const it=(Array.isArray(items)?items:[]).find(x=>String(x?.id)===id),course=String(it?.courseId||'');
   return {course:/^\d{1,15}$/.test(course)?course:null,assignment:id};
  }
  const m=/^\/courses\/(\d{1,15})(?:\/assignments\/(\d{1,15}))?(?:\/|$)/.exec(String(pathname||''));return m?{course:m[1],assignment:m[2]||null}:null;
 }

 // ---- panel
 const STYLE=`.ch-dev{display:grid;gap:10px;padding:4px 2px 8px;color:var(--rd-ink,#2B2A27);font:13px/1.45 var(--rd-font,system-ui,sans-serif)}
.ch-dev-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px}.ch-dev-head h3{margin:0;font:600 15px/1.2 var(--rd-display,Georgia,serif)}
.ch-dev-rows{display:grid;grid-template-columns:max-content 1fr;gap:0 14px;margin:0}
.ch-dev-rows dt,.ch-dev-rows dd{margin:0;padding:6px 0;border-bottom:1px solid var(--rd-line,rgba(43,42,39,.14))}
.ch-dev-rows dt{font-weight:600;color:var(--rd-muted,#5E5B55)}.ch-dev-rows dd,.ch-dev-build{display:flex;flex-wrap:wrap;column-gap:14px;row-gap:2px;min-width:0;overflow:hidden}
.ch-dev-v{position:relative;margin-left:-14px;padding-left:14px;white-space:nowrap;max-width:100%;overflow-wrap:anywhere}.ch-dev-v::before{content:"·";position:absolute;left:4px;color:var(--rd-muted,#5E5B55)}.ch-dev-v[data-long]{white-space:normal}
.ch-dev-rows dd.ch-dev-item{column-gap:8px;row-gap:6px;overflow:visible;padding:5px 0}.ch-dev-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.ch-dev-said{color:var(--rd-muted,#5E5B55)}.ch-dev-copy{width:100%;min-height:9em;font:12px/1.4 ui-monospace,Consolas,monospace}`;
 function create({container,page,store,getContext}={}){
  if(!container)return null;const UI=root.ReserveUI,E=v=>UI?.escapeHTML?UI.escapeHTML(v):String(v).replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
  let dead=false,last='',timer=0,cacheAt=0,cacheFacts=null,sizes={},sizing=false,said=0;
  const style=root.document.createElement('style');style.textContent=STYLE;const box=root.document.createElement('div');box.className='ch-dev';container.replaceChildren(style,box);
  const shown=()=>!dead&&box.isConnected&&box.getClientRects().length>0;
  async function readSizes(){
   if(sizing||!store?.sizes)return;
   sizing=true;
   try{sizes=await store.sizes()||{};}catch{sizes={};}finally{sizing=false;}
   if(!dead)schedule();
  }
  async function readCache(){
   if(!store?.readCache)return;
   try{
    const c=await store.readCache();
    cacheFacts=c?{fetchedAt:c.fetchedAt,partial:!!c.partial,errors:(Array.isArray(c.errors)?c.errors:[]).map(e=>({code:e?.code}))}:null;
   }catch{cacheFacts=null;}
   if(!dead)schedule();
  }
  function input(){
   const F=root.ReserveFeatures,C=root.ReserveCustomization,ctx=(()=>{try{return getContext?.()||null;}catch{return null;}})();
   let values={};
   try{values=store?.get?.()?.settings||{};}catch{}
   let manifest={};try{manifest=root.chrome?.runtime?.getManifest?.()||{};}catch{}
   return {manifest,userAgent:root.navigator?.userAgent,offset:new Date().getTimezoneOffset(),now:Date.now(),
    features:{preset:F?.current?.preset,enabled:F?.current?.enabled,full:F?.resolve?.({preset:'full'})?.enabled},
    settings:{defaults:C?.defaults,enums:C?.enums,values},
    cache:cacheFacts,
    courses:Array.isArray(ctx?.courses)?ctx.courses.length:null,
    items:Array.isArray(ctx?.items)?ctx.items.length:null,
    speed:{open:opened,renders},storage:sizes,errors:errorList(),dropped,ctx};
  }
  function paint(){
   if(!shown())return;const now=Date.now();if(now-cacheAt>30000){cacheAt=now;readCache();readSizes();}
   const inp=input(),f=facts(inp),list=rows(f),item=itemOf({reader:page?.querySelector?.('.rd-reader[data-id]')?.dataset?.id,items:inp.ctx?.items,pathname:root.location?.pathname});
   const piece=v=>`<span class="ch-dev-v"${String(v).length>32?' data-long':''}>${E(v)}</span>`;
   const html=`<div class="ch-dev-head"><h3>Developer</h3><span class="ch-dev-build">${list[0][1].map(piece).join('')}</span></div>
<dl class="ch-dev-rows">${list.slice(1).map(([n,v])=>`<dt>${E(n)}</dt><dd>${v.map(piece).join('')}</dd>`).join('')}
${item?`<dt>This item</dt><dd class="ch-dev-item">${item.course?`<button type="button" class="rd-button" data-dev="copy-id" data-value="${E(item.course)}">Course ${E(item.course)}</button>`:''}${item.assignment?`<button type="button" class="rd-button" data-dev="copy-id" data-value="${E(item.assignment)}">Assignment ${E(item.assignment)}</button>`:''}${item.course?`<a class="rd-button" target="_blank" rel="noopener" href="/api/v1/courses/${E(item.course)}${item.assignment?`/assignments/${E(item.assignment)}`:''}">API</a>`:''}</dd>`:''}</dl>
<div class="ch-dev-foot"><button type="button" class="rd-button" data-dev="copy-report">Copy report</button><span class="ch-dev-said" role="status">${said&&now-said<2500?'Copied':''}</span></div>`;
   if(html!==last){
    const focus=box.contains(root.document.activeElement)?root.document.activeElement?.dataset?.dev:null;
    box.innerHTML=html;
    last=html;
    if(focus)box.querySelector(`[data-dev="${focus}"]`)?.focus();
   }
  }
  function schedule(){if(dead||timer)return;timer=root.setTimeout(()=>{timer=0;paint();},800);}
  async function copy(text){
   try{
    await root.navigator.clipboard.writeText(text);
    said=Date.now();
    last='';
    paint();
    root.setTimeout(()=>{if(!dead){last='';paint();}},2600);
   }catch{const t=root.document.createElement('textarea');t.className='ch-dev-copy';t.readOnly=true;t.value=text;box.append(t);t.focus();t.select();}
  }
  function onClick(event){
   if(!event.isTrusted)return;
   const b=event.target?.closest?.('[data-dev]');
   if(!b||!box.contains(b))return;
   if(b.dataset.dev==='copy-report')copy(report(facts(input())));else if(b.dataset.dev==='copy-id'&&/^\d{1,15}$/.test(b.dataset.value||''))copy(b.dataset.value);
  }
  box.addEventListener('click',onClick);watchers.add(schedule);paint();
  return {update(){
   last='';
   paint();
  },focus(){box.querySelector('[data-dev="copy-report"]')?.focus();},destroy(){dead=true;root.clearTimeout(timer);watchers.delete(schedule);box.removeEventListener('click',onClick);}};
 }

 const api={facts,rows,report,itemOf,create,rendered,caught,_errors:{onError,onRejection,place,fromStack,list:errorList,reset(){
  errors.clear();
  renders.length=0;
  opened=0;
  dropped=0;
 }}};
 if(typeof module==='object'&&module.exports){module.exports=api;return;}
 if(root.ReserveSite?.vanillaPage?.(root.location))return;
 root.addEventListener?.('error',onError,true);root.addEventListener?.('unhandledrejection',onRejection);
 root.ReserveDeveloper=api;
})(globalThis);
