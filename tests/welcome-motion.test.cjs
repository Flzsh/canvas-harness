'use strict';

// Deterministic browser-like fixture: no installed browser, Canvas data, npm
// dependencies, network access, or real timers. A frame advances only when the
// test explicitly advances the rAF/film clock. Most cases stub only the generated
// drawing boundary; one integration case loads the actual supplied drawing.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Motion=require('../extension/motion.js');
const Nav=require('../extension/canvas-nav.js');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
 const roomArt={};
 vm.runInNewContext(read('welcome-room.js'),roomArt,{filename:'welcome-room.js'});
 const roomUI=roomArt.ReserveWelcomeRoom.UI;
const settle=async()=>{for(let i=0;i<24;i++)await new Promise(resolve=>setImmediate(resolve));};
const INTRO_END=5.503,INTRO_READY=5.103;
const PONY_NIGHT_FILTER='brightness(.74) saturate(.72) sepia(.16)';
const PONY_UNLIT_FILTER='brightness(.34) saturate(.35)';
const ROOM_RECTS={
 address:[196,78,1120,36],go:[1336,72,132,48],content:[28,126,1544,746],tab:[124,36,320,32],
 winL:[150,130,300,340],plateL:[210,520,180,46],winR:[1150,130,300,340],plateR:[1210,520,180,46],
 pony:[800,742,0,0],ponyNight:[1040,772,0,0],title:[800,92,0,0],toggle:[1150,556,230,56],
 finish:[1150,630,270,66],bubble:[880,560,0,0]
};

class FilmClock{
 constructor(frameHz=60){this.now=0;this.jobs=new Map();this.cancelled=new Set();this.serial=0;this.frame=1000/frameHz;this.requestedFrames=0;}
 enqueue(kind,fn,delay,repeat=0){
  const id=++this.serial;
  this.jobs.set(id,{id,kind,fn,at:this.now+Math.max(0,Number(delay)||0),repeat});
  return id;
 }
 setTimeout(fn,delay){return this.enqueue('timeout',fn,delay);}
 clearTimeout(id){this.cancelled.add(id);this.jobs.delete(id);}
 setInterval(fn,delay){return this.enqueue('interval',fn,delay,Math.max(1,Number(delay)||1));}
 clearInterval(id){this.clearTimeout(id);}
 requestAnimationFrame(fn){this.requestedFrames++;return this.enqueue('frame',()=>fn(this.now),this.frame);}
 cancelAnimationFrame(id){this.clearTimeout(id);}
 get timerCount(){return [...this.jobs.values()].filter(job=>job.kind!=='frame').length;}
 get frameCount(){return [...this.jobs.values()].filter(job=>job.kind==='frame').length;}
 advance(milliseconds){
  const until=this.now+milliseconds;
  for(let iterations=0;iterations<20000;iterations++){
   const next=[...this.jobs.values()].filter(job=>job.at<=until+1e-7).sort((a,b)=>a.at-b.at||a.id-b.id)[0];
   if(!next){this.now=until;return;}
   this.now=next.at;
   this.jobs.delete(next.id);
   next.fn();
   if(next.repeat&&this.jobs.get(next.id)===undefined){
    // A repeated job remains cancelled if its callback cleared its id.
    if(!this.cancelled.has(next.id))this.jobs.set(next.id,{...next,at:this.now+next.repeat});
   }
  }
  throw Error('A motion callback made an unbounded timer/frame loop');
 }
}

const VOID=new Set(['meta','link','input','img','br','hr','path','circle','rect','ellipse','line','polyline','polygon','stop','use']);
function attrsOf(source){
 const attrs={};
 for(const match of source.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[match[1]]=match[2]??match[3]??match[4]??'';
 return attrs;
}
function matchesAtom(node,part){
 if(!node?.tagName)return false;
 part=part.replace(/:scope\b/g,'').trim();
 if(part.includes(':first-child')){if(node.parent?.firstElementChild!==node)return false;part=part.replace(/:first-child/g,'');}
 if(!part||part==='*')return true;
 if(/:[\w-]+/.test(part))return false;
 const tag=part.match(/^[a-z][\w-]*/i)?.[0];
 if(tag&&node.tagName.toLowerCase()!==tag.toLowerCase())return false;
 for(const [,id] of part.matchAll(/#([\w-]+)/g))if(node.id!==id)return false;
 for(const [,name] of part.matchAll(/\.([\w-]+)/g))if(!node.classList.contains(name))return false;
 for(const [,key,,value] of part.matchAll(/\[([\w-]+)(?:=(['"])(.*?)\2)?\]/g)){
  const found=node.getAttribute(key);
  if(found===null||(value!==undefined&&found!==value))return false;
 }
 return true;
}
function matchesSelector(node,selector){
 return selector.split(',').some(item=>{
  const atoms=item.trim().replace(/\s*>\s*/g,' ').split(/\s+/).filter(Boolean);
  if(!atoms.length||!matchesAtom(node,atoms.at(-1)))return false;
  let ancestor=node.parent;
  for(let i=atoms.length-2;i>=0;i--){
   while(ancestor&&!matchesAtom(ancestor,atoms[i]))ancestor=ancestor.parent;
   if(!ancestor)return false;
   ancestor=ancestor.parent;
  }
  return true;
 });
}

function fixture({reduced=false,still=false,personal=false,hidden=false,grant=true,openFails=false,savedValues={},preferenceRead=null,preferenceFails=false,width=1280,height=800,frameHz=60,actualIntro=false,introFails=false,holdRoom=false}={}){
 const clock=new FilmClock(frameHz),ids=new Map(),animations=[],styleWrites=[],artCalls=[],introCalls=[],roomCalls=[],nightCalls=[],finishCalls=[],opened=[],openedAt=[],requests=[],writes=[];
 const documentHandlers=new Map(),windowHandlers=new Map(),storageHandlers=new Set(),mediaHandlers=new Set();
 const storage={'reserve:school':'https://school.instructure.com',...savedValues};
 const listeners=(map,type,fn)=>{if(!map.has(type))map.set(type,new Set());map.get(type).add(fn);};
 const unlisten=(map,type,fn)=>map.get(type)?.delete(fn);
 let document;

 class Element{
  constructor(tag,attrs={}){
   this.tagName=tag.toUpperCase();this.attrs={...attrs};this.id=attrs.id||'';
   this.children=[];this.parent=null;this.events=new Map();this.dataset={};
   this.type=attrs.type||'';this.value=attrs.value||'';this.checked='checked'in attrs;
   this.disabled='disabled'in attrs;this.hidden='hidden'in attrs;this.inert='inert'in attrs;this.readOnly='readonly'in attrs;
   this._text='';this._html='';this.animations=[];this._classes=new Set((attrs.class||'').split(/\s+/).filter(Boolean));
   const classes=this._classes;
   this.classList={add:(...names)=>names.forEach(name=>classes.add(name)),remove:(...names)=>names.forEach(name=>classes.delete(name)),contains:name=>classes.has(name),toggle:(name,force)=>{if(force??!classes.has(name))classes.add(name);else classes.delete(name);return classes.has(name);}};
   const properties={};
   this.style=new Proxy({setProperty:(key,value)=>{properties[key]=String(value);},getPropertyValue:key=>properties[key]||'',removeProperty:key=>delete properties[key]},
    {set:(style,key,value)=>{style[key]=value;styleWrites.push({node:this,key,value,at:clock.now});return true;}});
   for(const [key,value] of Object.entries(attrs))if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;
   if(this.id)ids.set(this.id,this);
  }
  get ownerDocument(){return document;}
  get parentElement(){return this.parent;}
  get firstChild(){return this.children[0]||null;}
  get firstElementChild(){return this.children.find(child=>child instanceof Element)||null;}
  get offsetWidth(){return 440;}
  get offsetHeight(){return 220;}
  get className(){return this.getAttribute('class');}
  set className(value){this.setAttribute('class',value);}
  get textContent(){return this._text+this.children.map(child=>child?.textContent||'').join('');}
  set textContent(value){this._text=String(value??'');for(const child of this.children)if(child?.parent===this)child.parent=null;this.children=[];}
  get innerHTML(){return this._html;}
  set innerHTML(value){this._html=String(value??'');this._text='';for(const child of this.children)if(child?.parent===this)child.parent=null;this.children=[];parse(this._html,this);}
  getAttribute(key){
   if(key==='class')return [...this.classNames()].join(' ');
   if(key.startsWith('data-'))return this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]??null;
   return this.attrs[key]??null;
  }
  classNames(){return [...this._classes];}
  setAttribute(key,value){
   this.attrs[key]=String(value);
   if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);
   if(key==='class'){this._classes.clear();for(const name of String(value).split(/\s+/).filter(Boolean))this._classes.add(name);}
  }
  removeAttribute(key){delete this.attrs[key];if(key.startsWith('data-'))delete this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())];}
  append(...items){for(const child of items){
   if(child?.parent){const siblings=child.parent.children;const index=siblings.indexOf(child);if(index!==-1)siblings.splice(index,1);}
   this.children.push(child);if(child&&typeof child==='object')child.parent=this;
  }}
  appendChild(item){this.append(item);return item;}
  insertAdjacentHTML(position,markup){
   this.insertedHTML=(this.insertedHTML||'')+markup;
   const parts=parse(String(markup));
   if(position==='beforeend')this.append(...parts);
   else if(position==='afterbegin'){for(const part of parts)part.parent=this;this.children.unshift(...parts);}
   else if(this.parent){for(const part of parts)part.parent=this.parent;const index=this.parent.children.indexOf(this);this.parent.children.splice(position==='beforebegin'?index:index+1,0,...parts);}
  }
  replaceChildren(...items){for(const child of this.children)if(child?.parent===this)child.parent=null;this.children=[];this.append(...items);}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=null;}}
  addEventListener(type,fn){listeners(this.events,type,fn);}
  removeEventListener(type,fn){unlisten(this.events,type,fn);}
  getDescendants(){return this.children.flatMap(child=>child instanceof Element?[child,...child.getDescendants()]:[]);}
  querySelectorAll(selector){return this.getDescendants().filter(node=>matchesSelector(node,selector));}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  matches(selector){return matchesSelector(this,selector);}
  closest(selector){for(let node=this;node;node=node.parent)if(node.matches(selector))return node;return null;}
  getBoundingClientRect(){return this.id==='brand-logo'?{left:51,top:24,right:79,bottom:52,width:28,height:28,x:51,y:24}:{left:0,top:0,right:440,bottom:220,width:440,height:220,x:0,y:0};}
  getClientRects(){return [this.getBoundingClientRect()];}
  getTotalLength(){return 120;}
  focus(){
   if(this.disabled||document.activeElement===this)return;
   for(let node=this;node;node=node.parent)if(node.inert)return;
   document.activeElement?.fire('blur');document.activeElement=this;this.fire('focus');
  }
  animate(frames,options={}){
   let resolve;
   const animation={node:this,frames,options,playState:'running',_time:0,
    effect:{getComputedTiming:()=>({endTime:options.duration||0})},
    finished:new Promise(done=>{resolve=done;}),
    pause(){this.playState='paused';this.pauseCalls=(this.pauseCalls||0)+1;},
    play(){this.playState='running';},
    cancel(){this.playState='idle';this.cancelled=true;resolve();},
    finish(){this.playState='finished';this._time=options.duration||0;resolve();}
   };
   Object.defineProperty(animation,'currentTime',{get(){return this._time;},set(value){this._time=value;if(Number.isFinite(options.duration)&&value>=options.duration&&options.iterations!==Infinity)resolve();}});
   animations.push(animation);this.animations.push(animation);
   return animation;
  }
  getAnimations({subtree=false}={}){return [...this.animations,...(subtree?this.getDescendants().flatMap(node=>node.animations):[])].filter(a=>!a.cancelled);}
  fire(type,detail={}){
   const event=eventOf({...detail,type,target:detail.target||this});
   // Document capture listeners run before the clicked control. In particular,
   // a pointerdown that skips the opening must swallow the subsequent click.
   for(const fn of documentHandlers.get(type)||[]){fn(event);if(event.immediateStopped)return event;}
   if(event.propagationStopped)return event;
   for(const fn of this.events.get(type)||[]){fn(event);if(event.immediateStopped)break;}
   return event;
  }
 }
 function parse(source,parent=null){
  const roots=[],stack=parent?[parent]:[];
  let cursor=0;
  for(const token of source.matchAll(/<\/?([a-z][\w:-]*)\b([^>]*)>/gi)){
   if(stack.length&&token.index>cursor)stack.at(-1)._text+=source.slice(cursor,token.index);
   cursor=token.index+token[0].length;
   const name=token[1].toLowerCase();
   if(token[0].startsWith('</')){
    const index=stack.findLastIndex(node=>node.tagName.toLowerCase()===name);
    if(index>=0)stack.length=index;
    continue;
   }
   const node=new Element(name,attrsOf(token[2]));
   if(stack.length)stack.at(-1).append(node);else roots.push(node);
   if(!VOID.has(name)&&!token[0].endsWith('/>'))stack.push(node);
  }
  return roots;
 }
 function eventOf(detail={}){
  return {key:'',type:'',timeStamp:clock.now,repeat:false,defaultPrevented:false,propagationStopped:false,immediateStopped:false,
   preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.propagationStopped=true;},
   stopImmediatePropagation(){this.immediateStopped=true;this.propagationStopped=true;},...detail};
 }
 const roots=parse(read('welcome.html'));
 const html=roots.find(node=>node.tagName==='HTML')||roots[0];
 if(still)ids.get('tour').dataset.still='true';
 document={documentElement:html,body:html.querySelector('body'),activeElement:null,title:'',
  get hidden(){return hidden;},get visibilityState(){return hidden?'hidden':'visible';},
  getElementById:id=>ids.get(id)||null,
  querySelectorAll:selector=>[html,...html.getDescendants()].filter(node=>matchesSelector(node,selector)),
  querySelector:selector=>document.querySelectorAll(selector)[0]||null,
  createElement:tag=>new Element(tag),createElementNS:(_ns,tag)=>new Element(tag),
  createTextNode:value=>({textContent:String(value),parent:null}),
  addEventListener:(type,fn)=>listeners(documentHandlers,type,fn),
  removeEventListener:(type,fn)=>unlisten(documentHandlers,type,fn)};
 const media={matches:reduced,addEventListener:(_event,fn)=>mediaHandlers.add(fn),removeEventListener:(_event,fn)=>mediaHandlers.delete(fn)};
 let shouldFailOpen=openFails,permissionGranted=grant;
 const chrome={
  runtime:{getManifest:()=>({name:personal?'CH+':'Canvas Harness',version:'9.8.7',optional_host_permissions:personal?undefined:['https://*/*']}),getURL:name=>'chrome-extension://fixture/'+name,
   async sendMessage(message){return {ok:true,origin:message.origin};}},
  storage:{onChanged:{addListener:fn=>storageHandlers.add(fn),removeListener:fn=>storageHandlers.delete(fn)},local:{
   async get(keys){
    const wanted=Array.isArray(keys)?keys:[keys];
    if(wanted.includes('reserve:appearance')){
     await preferenceRead;
     if(preferenceFails)throw Error('Appearance preferences could not load');
    }
    return Object.fromEntries(wanted.map(key=>[key,storage[key]]));
   },
   async set(values){writes.push(values);const changed={};for(const [key,value]of Object.entries(values)){changed[key]={newValue:value,oldValue:storage[key]};storage[key]=value;}for(const fn of storageHandlers)fn(changed,'local');},
   async remove(key){delete storage[key];}}},
  tabs:{async query(){return [{url:'https://school.instructure.com/'}];},async create(value){if(shouldFailOpen)throw Error('Opening a tab failed');opened.push(value);openedAt.push(clock.now);}},
  permissions:{async contains(){return true;},request(value){requests.push(value);return Promise.resolve(permissionGranted);},async remove(){return true;}}
 };
 const art={mini(course,options){artCalls.push({method:'mini',course,options});return `<svg class="rd-mini" data-art="${course.id}" viewBox="0 0 48 48"><g class="art-loop" data-loop="sway" data-period="3"><path d="M2 5H36"/></g></svg>`;},
  scene(course,options){artCalls.push({method:'scene',course,options});return '<svg class="rd-art" data-cycle="3" viewBox="0 0 480 240"><g class="art-ink"><path d="M1 12H120"/></g><g class="art-loop" data-loop="bob" data-period="3" data-amp="3"><path d="M30 20H40"/></g><g class="art-wash"><rect x="10" y="10" width="80" height="40"/></g></svg>';}};
 const intro={END:INTRO_END,READY:INTRO_READY,mount(el){
  if(introFails)throw Error('Drawing unavailable');
  introCalls.push({method:'mount',el,at:clock.now});
  el.innerHTML='<svg class="intro-art" viewBox="0 0 1600 900" aria-hidden="true"><g class="startb"></g></svg>';
  const svg=el.querySelector('svg'),button=el.querySelector('.startb');let hovered=false;
  button.getBoundingClientRect=()=>{
   const w=context.innerWidth,h=context.innerHeight,scale=(svg.getAttribute('preserveAspectRatio')==='xMidYMid slice'?Math.max:Math.min)(w/1600,h/900);
   return {left:(w-1600*scale)/2+700*scale,top:(h-900*scale)/2+(670-(hovered?3:0))*scale,width:200*scale,height:56*scale};
  };
  return {END:INTRO_END,READY:INTRO_READY,button,hover(on){hovered=on;introCalls.push({method:'hover',on,at:clock.now});},setT(t){introCalls.push({method:'setT',t,at:clock.now});},idle(t){introCalls.push({method:'idle',t,at:clock.now});}};
 }};
 let roomHeld=holdRoom,roomInstance;
 const roomQueue=[];
 const settleRoom=done=>{
  if(!roomHeld){done();return Promise.resolve();}
  return new Promise(resolve=>roomQueue.push(()=>{done();resolve();}));
 };
 const room={UI:roomUI,SCHOOLHOUSE:'<svg viewBox="0 0 800 600" aria-hidden="true"></svg>',mount(stage,options={}){
  roomCalls.push({method:'mount',stage,options,at:clock.now});
  stage.innerHTML='<div class="wr-room"><svg class="wr-room-art" aria-hidden="true"></svg></div><div class="wr-pc"><div class="wr-pc-content"></div></div><div class="wr-meadow"></div>';
  let shot='room',theme=options.theme||'light';
  const pcContent=stage.querySelector('.wr-pc-content');
  const controller={pcContent,get shot(){return shot;},get theme(){return theme;},
   enter(){roomCalls.push({method:'enter',at:clock.now});return settleRoom(()=>{shot='pc';});},
   go(name,{animate=true}={}){
    roomCalls.push({method:'go',name,animate,at:clock.now});
    return settleRoom(()=>{shot=name;});
   },
   setTheme(value,{animate=true}={}){
    roomCalls.push({method:'setTheme',theme:value,animate,at:clock.now});
    return settleRoom(()=>{theme=value;});
   },
   hover(value){roomCalls.push({method:'hover',theme:value,at:clock.now});},
   plate(theme,on){roomCalls.push({method:'plate',theme,on,at:clock.now});},
   ponyLight(lit=true){roomCalls.push({method:'ponyLight',lit,at:clock.now});return theme==='dark'?(lit?PONY_NIGHT_FILTER:PONY_UNLIT_FILTER):'none';},
   litFilter(lit=true){roomCalls.push({method:'litFilter',lit,at:clock.now});return theme==='dark'?(lit?PONY_NIGHT_FILTER:PONY_UNLIT_FILTER):'none';},
   rect(name){
    roomCalls.push({method:'rect',name,at:clock.now});
    const [x,y,w,h]=ROOM_RECTS[name==='pony'&&theme==='dark'?'ponyNight':name]||[];
    if(x===undefined)throw Error('Unknown room rectangle: '+name);
    const W=context.innerWidth,H=context.innerHeight;
    const left=x*W/1600,top=y*H/900,width=w*W/1600,height=h*H/900;
    return {x:left,y:top,w:width,h:height,left,top,width,height,right:left+width,bottom:top+height};
   },
   idle(seconds){roomCalls.push({method:'idle',seconds,at:clock.now});},
   layout(){roomCalls.push({method:'layout',at:clock.now});}
  };
  roomInstance=controller;return controller;
 }};
 const finish={mount(el){
  finishCalls.push({method:'mount',el,at:clock.now});
  el.innerHTML='<svg class="finish-art" aria-hidden="true"></svg>';
  return {END:3,fire:(x,y)=>finishCalls.push({method:'fire',x,y,at:clock.now}),setT:t=>finishCalls.push({method:'setT',t,at:clock.now})};
 }};
 const context=vm.createContext({document,chrome,URL,Intl,structuredClone,console,innerWidth:width,innerHeight:height,
  ReserveCourseArt:art,ReserveCanvasNav:{drawings:Nav.DRAWINGS},ReserveWelcomeRoom:room,
  matchMedia:()=>media,performance:{now:()=>clock.now},Date:class extends Date{static now(){return clock.now;}},
  setTimeout:(fn,delay)=>clock.setTimeout(fn,delay),clearTimeout:id=>clock.clearTimeout(id),
  setInterval:(fn,delay)=>clock.setInterval(fn,delay),clearInterval:id=>clock.clearInterval(id),
  requestAnimationFrame:fn=>clock.requestAnimationFrame(fn),cancelAnimationFrame:id=>clock.cancelAnimationFrame(id),
  getComputedStyle:node=>({opacity:'1',transform:'none',getPropertyValue:key=>{
   const keys=['--paper','--background','--ink','--clay','--muted','--rule','--line','--card'];
   const values=html.dataset.theme==='dark'?['#222320','#191A18','#D2C8B2','#E2A785','#B1AD9F','#54564C','#D2C8B2','#2C2E29']:['#FAF9F5','#F3F0E8','#141413','#A9522F','#625F59','#DED9CE','#34312C','#FFFDF8'];
   return values[keys.indexOf(key)]||'';
  }}),
  addEventListener:(type,fn)=>listeners(windowHandlers,type,fn),removeEventListener:(type,fn)=>unlisten(windowHandlers,type,fn)});
 context.window=context;
 if(!actualIntro)context.ReserveWelcomeIntro=intro;
 const skipped=new Set(['subject-art-data.js','generic-art.js','subject-art.js','course-art.js','canvas-nav.js','welcome-room.js','welcome-scenes.js',...(!actualIntro?['welcome-intro.js']:[])]);
 const scripts=[...read('welcome.html').matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(([,file])=>path.basename(file));
 for(const script of scripts){
  if(script==='welcome.js')context.ReserveWelcomeScenes={finish,night:(el,theme,value)=>nightCalls.push({el,theme,value,at:clock.now})};
  if(!skipped.has(script))vm.runInContext(read(script),context,{filename:script});
 }
  return {clock,animations,styleWrites,artCalls,introCalls,roomCalls,nightCalls,finishCalls,ids,document,media,storage,opened,openedAt,requests,writes,chrome,context,scripts,
  get room(){return roomInstance;},
  holdRoom(){roomHeld=true;},releaseRoom(){roomHeld=false;for(const resolve of roomQueue.splice(0))resolve();},
  active:()=>document.querySelector('.tour-step.is-current')?.dataset.step,
  documentEvent:(type,details={})=>{const event=eventOf({...details,type,target:details.target||ids.get('intro-title')});for(const fn of documentHandlers.get(type)||[]){fn(event);if(event.immediateStopped)break;}return event;},
  setHidden(value){hidden=value;this.documentEvent('visibilitychange',{target:document});},
  setReduced(value){media.matches=value;for(const fn of mediaHandlers)fn({matches:value});},
  resize(w,h){context.innerWidth=w;context.innerHeight=h;for(const fn of windowHandlers.get('resize')||[])fn(eventOf({type:'resize'}));},
  setOpenFails(value){shouldFailOpen=value;},setGrant(value){permissionGranted=value;},
  async next(){
   const step=this.active();
   if(step==='intro')ids.get('intro-start').fire('click');
   else if(step==='school')ids.get('school-form').fire('submit');
   else if(step==='companion')ids.get('finish-board').fire('click');
   else if(step==='appearance'){
    // a window is clicked first; only then does its sign read Continue
    const theme=document.documentElement.dataset.theme,plate=document.querySelector('[data-theme-continue="'+theme+'"]');
    if(plate.hidden){document.querySelector('[data-theme-choice="'+theme+'"]').fire('click');await settle();}
    plate.fire('click');
   }
   else ids.get('next').fire('click');
   await settle();
   if(step==='intro'||step==='school'){this.clock.advance(450);await settle();}
  },
  async back(){ids.get('back').fire('click');await settle();},
  cleanup(){for(const fn of windowHandlers.get('pagehide')||[])fn();}
 };
}

function noFilmWork(h,label){
 assert.equal(h.clock.frameCount,0,label+' must not queue a frame');
 assert.equal(h.clock.timerCount,0,label+' must not queue a motion timer');
}
const roomCalls=(h,method)=>h.roomCalls.filter(call=>call.method===method);
const appearanceWrites=h=>h.writes.filter(write=>Object.hasOwn(write,'reserve:appearance'));
const cssRule=(css,selector)=>Object.assign({},...[...css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([,selectors])=>selectors.split(',').some(value=>value.trim()===selector)).map(([, ,body])=>Object.fromEntries(body.split(';').filter(value=>value.includes(':')).map(value=>{const colon=value.indexOf(':');return [value.slice(0,colon).trim(),value.slice(colon+1).trim()];}))));
function assertGoState(h,active){
 const go=h.ids.get('school-go');
 assert.equal(h.ids.get('room-stage').classList.contains('wr-no-go'),!active,'painted Go is visible only in the school spotlight');
 assert.equal(go.hidden,!active,'the Go hit target follows the painted strap');
 assert.equal(go.disabled,!active,'hidden Go cannot receive keyboard activation');
}
async function reachStep(h,name){
 await settle();
 if(h.ids.get('tour').dataset.opening==='true')h.documentEvent('keydown',{key:'Escape'});
 for(let i=0;i<5&&h.active()!==name;i++)await h.next();
 assert.equal(h.active(),name,'tour can reach '+name);
}

test('one room controller supplies the static schoolhouse and all scene locations through a single stage',async()=>{
 const source=read('welcome-room.js'),html=read('welcome.html'),h=fixture({reduced:true});
 await settle();
 assert.match(source,/SCHOOLHOUSE/);assert.match(source,/root\.ReserveWelcomeRoom=\{\s*mount,\s*SCHOOLHOUSE/);
 assert.equal(roomCalls(h,'mount').length,1,'mount happens once for the whole tour');
 assert.equal(h.ids.get('room-stage').getAttribute('aria-hidden'),'true');
 assert.equal(h.room.pcContent.classList.contains('wr-pc-content'),true);
 assert.equal(h.ids.get('room-stage').querySelectorAll('svg.wr-room-art').length,1);
 for(const name of ['intro','school','navigation','appearance','companion']){
  assert.equal(h.document.querySelectorAll('[data-step="'+name+'"]').length,1,name+' is a unique accessible step');
 }
 assert.equal(html.includes('id="school-start-page"'),true);
 assert.equal(roomCalls(h,'go').length,0,'the initial view is the intro');
 assert.equal(h.room.shot,'room');
 h.cleanup();
});

test('the standard tour is intro, school, navigation, appearance, companion with four counted steps',async()=>{
 const h=fixture({reduced:true});await settle();
 assert.equal(h.ids.get('step-count').textContent,'Step 1 of 4');
 assert.equal(h.document.querySelector('.tour-footer').hidden,true);
 await h.next();assert.equal(h.active(),'school');
 assert.equal(h.ids.get('step-count').textContent,'Step 1 of 4');
 assert.equal(h.ids.get('back').hidden,true);assert.equal(h.ids.get('next').hidden,true);
 await h.next();assert.equal(h.active(),'navigation');assert.equal(h.ids.get('step-count').textContent,'Step 2 of 4');
 assert.equal(h.ids.get('next').hidden,false);
 await h.next();assert.equal(h.active(),'appearance');assert.equal(h.ids.get('step-count').textContent,'Step 3 of 4');
 assert.equal(h.ids.get('next').hidden,true);assert.equal(h.ids.get('back').hidden,false);
 await h.next();assert.equal(h.active(),'companion');assert.equal(h.ids.get('step-count').textContent,'Step 4 of 4');
 assert.equal(h.ids.get('next').hidden,true);assert.equal(h.ids.get('finish-board').hidden,false);
 assert.deepEqual(roomCalls(h,'go').map(({name})=>name),['pc','room','meadow'],'school and navigation share the PC view');
 assert.ok(roomCalls(h,'go').every(call=>call.animate===false),'reduced motion skips transitions');
 assert.equal(roomCalls(h,'enter').length,0,'reduced motion does not use enter()');
 assert.equal(h.document.activeElement,h.ids.get('companion-title'),'heading receives focus after the camera is ready');
 h.cleanup();
});

test('CH+ skips school and retains keyboard Back, including return to intro',async()=>{
 const h=fixture({personal:true,reduced:true});await settle();
 assert.equal(h.document.querySelector('[data-step="school"]').hidden,true);
 await h.next();assert.equal(h.active(),'navigation');
 assert.equal(h.ids.get('step-count').textContent,'Step 1 of 3');
 const back=h.ids.get('back');
 assert.equal(back.hidden,false);
 h.documentEvent('keydown',{key:'ArrowLeft',target:h.ids.get('navigation-title')});
 await settle();assert.equal(h.active(),'intro');assert.equal(h.document.activeElement,h.ids.get('intro-start'));
 await h.next();await h.next();assert.equal(h.active(),'appearance');
 await h.next();assert.equal(h.active(),'companion');
 await h.back();assert.equal(h.active(),'appearance');assert.equal(roomCalls(h,'go').at(-1).name,'room');
 await h.back();assert.equal(h.active(),'navigation');assert.equal(roomCalls(h,'go').at(-1).name,'pc');
 h.cleanup();
});

test('Start waits for room.enter while fading intro for 400 ms and keeps room mounted when revisiting the PC',async()=>{
 const h=fixture();await settle();h.documentEvent('keydown',{key:'Escape'});
 const start=h.ids.get('intro-start');
 start.fire('click');await settle();
 assert.equal(roomCalls(h,'enter').length,1,'normal-motion Start calls the entrance exactly once');
 assert.equal(h.ids.get('intro-art').classList.contains('is-away'),true);
 assertLayerFade(h);
 h.clock.advance(399);await settle();
 assert.equal(h.ids.get('intro-art').hidden,false,'intro remains through the fade');
 h.clock.advance(1);await settle();
 assert.equal(h.active(),'school');assert.equal(h.room.shot,'pc');
 assert.equal(h.ids.get('intro-art').hidden,true);
 const cameras=roomCalls(h,'go').length;
 await h.next();assert.equal(h.active(),'navigation');
 assert.equal(roomCalls(h,'go').length,cameras,'school -> navigation does not move the camera');
 await h.next();assert.equal(h.active(),'appearance');assert.equal(roomCalls(h,'go').at(-1).name,'room');
 await h.next();assert.equal(h.active(),'companion');assert.equal(roomCalls(h,'go').at(-1).name,'meadow');
 await h.back();await h.back();assert.equal(h.active(),'navigation');
 assert.equal(roomCalls(h,'go').at(-1).name,'pc');
 await h.back();assert.equal(h.active(),'school');
 assert.equal(roomCalls(h,'go').at(-1).name,'pc','navigation -> school shares the same PC camera');
 assert.equal(roomCalls(h,'mount').length,1,'Back never remounts the artwork');
 h.cleanup();
});

test('moving the school and navigation panels follows DOM move semantics and never puts accessible content below aria-hidden art',async()=>{
 const h=fixture({reduced:true});await settle();await h.next();
 const stage=h.ids.get('room-stage'),pc=h.room.pcContent,school=h.document.querySelector('[data-step="school"]');
 const nav=h.document.querySelector('[data-step="navigation"]');
 assert.notEqual(pc.closest('#room-stage'),stage,'the interactive container must leave the aria-hidden stage');
 assert.equal(pc.parentElement?.closest('#room-stage'),null);
 assert.equal(school.parentElement,pc);
 assert.equal(nav.parentElement,pc);
 assert.equal(school.parentElement.children.filter(item=>item===school).length,1,'moving nodes never duplicates them');
 assert.equal(h.ids.get('school-form').closest('#room-stage'),null);
 assert.equal(h.ids.get('school-form').hidden,false);
 assert.equal(h.ids.get('school-form').inert,false);
 assert.equal(h.document.activeElement,h.ids.get('school-url'),'school entry focuses the address described by the note');
 await h.next();assert.equal(school.inert,true);assert.equal(nav.inert,false);
 assert.equal(h.document.activeElement,h.ids.get('navigation-title'));
 assert.equal(pc.inert,false,'the PC container remains accessible while a PC step is active');
 await h.next();
 assert.equal(pc.inert,true,'camera travel hides PC controls from keyboard navigation');
 h.cleanup();
});

test('school input and submit hit area align with room.rect and custom permission is requested synchronously',async()=>{
 const h=fixture();await reachStep(h,'school');
 const input=h.ids.get('school-url'),go=h.ids.get('school-go'),form=h.ids.get('school-form');
 for(const [node,key] of [[input,'address'],[go,'go']]){
  const box=h.room.rect(key);
  for(const side of ['left','top','width','height'])assert.equal(node.style[side],box[side]+'px',key+' '+side+' uses page coordinates');
 }
 input.value='http://not-secure.school.edu';form.fire('submit');await settle();
 assert.equal(input.getAttribute('aria-invalid'),'true');assert.equal(h.requests.length,0);
 input.value='https://canvas.school.edu/subdir';input.fire('input');
 form.fire('submit');assert.equal(h.requests.length,1,'permission must precede the first await');
 assert.equal(h.requests[0].origins[0],'https://canvas.school.edu/*');
 await settle();assert.equal(h.active(),'school');
 assert.equal(input.readOnly,true,'the accepted origin stays read-only after its spotlight clears');
 assert.equal(h.ids.get('address-loading').hidden,false);
 h.clock.advance(299);await settle();assert.equal(h.active(),'school');
 h.clock.advance(1);await settle();assert.equal(h.active(),'navigation');
 assert.equal(h.storage['reserve:school'],'https://canvas.school.edu');
 await h.back();assert.equal(h.active(),'school');assert.equal(input.readOnly,false,'Back deliberately reopens the school spotlight for edits');
 assert.equal(input.value,'https://canvas.school.edu');assert.equal(h.document.activeElement,input);assertGoState(h,true);
 assert.equal(h.opened.length,0,'school setup never opens a browser tab');
 h.cleanup();
});

test('school entry spotlights the address and Go union with 10 px padding and focuses the described input',async t=>{
 const h=fixture({reduced:true,width:1280,height:708});t.after(()=>h.cleanup());await settle();
 const hole=h.ids.get('school-spotlight'),note=h.ids.get('school-note'),input=h.ids.get('school-url');
 assert.ok(hole);assert.ok(note);assert.equal(hole.hidden,true);assert.equal(note.hidden,true);assertGoState(h,false);
 await reachStep(h,'school');
 assert.equal(hole.hidden,false);assert.equal(note.hidden,false);assertGoState(h,true);
 assert.equal(hole.getAttribute('aria-hidden'),'true');
 assert.equal(hole.parentElement,note.parentElement,'the note is a sibling outside the spotlight hole');
 assert.equal(note.closest('#room-stage'),null,'the instruction is outside hidden artwork');
 assert.equal(note.textContent.trim(),"Paste your school's Canvas address, then press Go.");
 assert.ok(note.querySelector('svg path'),'the note includes its drawn arrow');
 assert.match(input.getAttribute('aria-describedby'),/\bschool-note\b/);assert.equal(h.document.activeElement,input);
 for(const [size,want] of [[[1280,708],{left:146.8,top:46.64,width:1037.6,height:57.76}],[[960,720],{left:107.6,top:47.6,width:783.2,height:58.4}]]){
  h.resize(...size);
  for(const [key,value] of Object.entries(want))assert.ok(Math.abs(parseFloat(hole.style[key])-value)<1e-7,key+' clears both art rectangles plus padding');
  assert.ok(parseFloat(note.style.top)>=parseFloat(hole.style.top)+parseFloat(hole.style.height),'the note sits below the cleared controls');
 }
});

test('school spotlight has a 14 px rounded clear hole, 24 px feather and a taped paper instruction',()=>{
 const css=read('welcome.css'),hole=cssRule(css,'#school-spotlight'),note=cssRule(css,'#school-note');
 assert.equal(hole.position,'fixed');assert.equal(hole['pointer-events'],'none');assert.equal(hole['border-radius'],'14px');
 assert.match(hole['box-shadow']||'',/0 0 0 \S+ rgba\(20,\s*20,\s*19,\s*\.55\)/,'the outside mask uses the specified dim ink');
 assert.ok(/0 0 24px(?: 0(?:px)?)? rgba\(20,\s*20,\s*19,\s*\.55\)/.test(hole['box-shadow']||'')||hole.filter==='blur(12px)','the hole feathers across 24 px with a shadow or a 12 px blur on both sides');
 for(const selector of ['#school-spotlight','#school-note'])assert.match(cssRule(css,selector).transition||'',/opacity\s+300ms/);
 assert.equal(cssRule(css,'#school-spotlight.is-clearing').opacity,'0');assert.equal(cssRule(css,'#school-note.is-clearing').opacity,'0');
 assert.equal(note.position,'fixed');assert.ok(note.background);assert.ok(note.border,'the instruction has a paper edge');
 const tape=cssRule(css,'#school-note::before');assert.ok(tape.content);assert.ok(tape.background);assert.equal(tape.position,'absolute');
 assert.ok(cssRule(css,'#school-note svg').stroke,'the arrow remains visible against the note');
});

test('successful Go and Enter clear the spotlight and note after 300 ms while hiding both Go targets',async t=>{
 for(const action of ['Go','Enter']){
  const h=fixture();t.after(()=>h.cleanup());await reachStep(h,'school');
  const input=h.ids.get('school-url'),hole=h.ids.get('school-spotlight'),note=h.ids.get('school-note');
  input.value='https://canvas.school.edu/courses';
  h.ids.get(action==='Go'?'school-go':'school-form').fire(action==='Go'?'click':'submit');
  assert.equal(h.requests.length,1,action+' asks permission before yielding');
  await settle();assert.equal(input.value,'https://canvas.school.edu');assert.equal(input.readOnly,true);assertGoState(h,false);
  assert.equal(hole.hidden,false);assert.equal(note.hidden,false,'the paper stays mounted during its fade');
  h.clock.advance(299);await settle();assert.equal(hole.hidden,false);assert.equal(note.hidden,false);
  h.clock.advance(1);await settle();assert.equal(hole.hidden,true);assert.equal(note.hidden,true);
  assert.equal(input.getAttribute('aria-describedby'),'status','the hidden note no longer describes the field');
  assert.equal(h.active(),'navigation','the completed 300 ms fade releases navigation');assert.equal(input.readOnly,true);assertGoState(h,false);
  for(const name of ['appearance','companion']){await h.next();assert.equal(h.active(),name);assertGoState(h,false);}
  h.ids.get('school-go').fire('click');assert.equal(h.requests.length,1,'a stale hidden Go activation cannot resubmit');
 }
});

test('CH+ never exposes the school spotlight or Go when moving forward and Back',async t=>{
 const h=fixture({personal:true,reduced:true});t.after(()=>h.cleanup());await settle();
 for(const name of ['intro','navigation','appearance','companion']){
  if(name!=='intro')await h.next();assert.equal(h.active(),name);assertGoState(h,false);
  assert.equal(h.ids.get('school-spotlight').hidden,true);assert.equal(h.ids.get('school-note').hidden,true);
 }
 for(const name of ['appearance','navigation','intro']){await h.back();assert.equal(h.active(),name);assertGoState(h,false);}
});

test('the school Go overlay highlights the artwork with either mouse hover or keyboard focus',async()=>{
 const h=fixture({reduced:true});await reachStep(h,'school');
 const stage=h.ids.get('room-stage'),go=h.ids.get('school-go');
 assert.equal(stage.classList.contains('wr-go-hover'),false);
 go.fire('pointerenter');assert.equal(stage.classList.contains('wr-go-hover'),true);
 go.fire('focus');go.fire('pointerleave');assert.equal(stage.classList.contains('wr-go-hover'),true,'keyboard focus keeps the painted hover');
 go.fire('blur');assert.equal(stage.classList.contains('wr-go-hover'),false);
 go.fire('focus');assert.equal(stage.classList.contains('wr-go-hover'),true);
 go.fire('pointerenter');go.fire('blur');assert.equal(stage.classList.contains('wr-go-hover'),true,'pointer hover survives loss of focus');
 go.fire('pointerleave');assert.equal(stage.classList.contains('wr-go-hover'),false);
 h.cleanup();
});

test('Go and Enter submit the approved school flow before yielding and ignore duplicate submissions',async()=>{
 for(const action of ['Go','Enter']){
  const h=fixture();await reachStep(h,'school');
  h.ids.get('school-url').value='https://canvas.school.edu/courses';
  const form=h.ids.get('school-form');
  if(action==='Go')h.ids.get('school-go').fire('click');
  else form.fire('submit'); // Native Enter in the URL field submits its form.
  assert.equal(h.requests.length,1,action+' requests permission in the original gesture');
  assert.equal(h.requests[0].origins[0],'https://canvas.school.edu/*');
  form.fire('submit');assert.equal(h.requests.length,1,'busy submissions do not ask again');
  await settle();assert.equal(h.ids.get('address-loading').hidden,false);
  h.clock.advance(300);await settle();
  assert.equal(h.active(),'navigation');assert.equal(h.ids.get('school-url').value,'https://canvas.school.edu');
  assert.equal(h.ids.get('school-url').readOnly,true);assert.equal(h.opened.length,0);
  h.cleanup();
 }
});

test('resize repositions PC controls, both windows and every meadow overlay from fresh room rectangles',async()=>{
 const h=fixture({reduced:true});await reachStep(h,'school');
 const check=(node,name)=>{
  const rect=h.room.rect(name);
  for(const key of ['left','top','width','height'])assert.equal(node.style[key],rect[key]+'px',name+' '+key);
 };
 const before=h.ids.get('school-url').style.width;
 h.resize(960,720);
 check(h.ids.get('school-url'),'address');check(h.ids.get('school-go'),'go');check(h.room.pcContent,'content');
 assert.notEqual(h.ids.get('school-url').style.width,before);
 await h.next();h.resize(1440,810);check(h.room.pcContent,'content');check(h.ids.get('school-url'),'address');
 await h.next();h.resize(1280,900);
 for(const [theme,win,plate] of [['light','winL','plateL'],['dark','winR','plateR']]){
  check(h.document.querySelector('[data-theme-choice="'+theme+'"]'),win);
  check(h.document.querySelector('[data-theme-continue="'+theme+'"]'),plate);
 }
 h.document.querySelector('[data-theme-choice="dark"]').fire('click');await settle();
 await h.next();h.resize(1600,900);
 check(h.ids.get('finish-board'),'finish');check(h.document.querySelector('.pet-toggle'),'toggle');
 const title=h.room.rect('title');
 assert.equal(h.ids.get('companion-title').style.left,title.x+'px');assert.equal(h.ids.get('companion-title').style.top,title.y+'px');
 const actor=h.ids.get('pet-actor'),pony=h.room.rect('pony');
 assert.equal(parseFloat(actor.style.left)+parseFloat(actor.style.width)/2,pony.x);
 assert.equal(parseFloat(actor.style.top)+parseFloat(actor.style.height)*60/64,pony.y);
 const bubble=h.document.querySelector('.tour-bubble'),height=parseFloat(actor.style.height);
 const bb=bubble.getBoundingClientRect(),bw=bb.width,width=parseFloat(actor.style.width),hx=pony.x+width*.3,hy=pony.y-height*60/64+height*.04;
 assert.equal(bubble.style.left,Math.max(8,Math.min(hx-bw*(h.room.theme==='dark'?.7:.3),h.context.innerWidth-bw-8))+'px');assert.equal(bubble.style.top,Math.max(bb.height+8,Math.min(hy-2,h.context.innerHeight-8))+'px');
 h.cleanup();
});

test('denied school permissions restore editability and preserve keyboard focus',async()=>{
 const h=fixture({reduced:true,grant:false});await reachStep(h,'school');
 const school=h.ids.get('school-url');school.value='https://canvas.school.edu';
 const form=h.ids.get('school-form');form.fire('submit');
 assert.equal(h.requests.length,1,'form submission triggers permission in the user gesture');
 await settle();assert.equal(h.active(),'school');assert.equal(school.disabled,false);
 assert.equal(school.readOnly,false);assert.equal(h.document.activeElement,school);
 assertGoState(h,true);assert.equal(h.ids.get('school-spotlight').hidden,false);assert.equal(h.ids.get('school-note').hidden,false);
 assert.equal(school.getAttribute('aria-invalid'),'true');assert.match(h.ids.get('status').textContent,/allowed|permission|denied/i);
 assert.equal(h.storage['reserve:sites'],undefined);
 h.cleanup();
});

test('a preference read failure after school approval restores the editable spotlight and allows retry',async t=>{
 const h=fixture({reduced:true,preferenceFails:true});t.after(()=>h.cleanup());await reachStep(h,'school');
 const input=h.ids.get('school-url');input.value='https://canvas.school.edu';h.ids.get('school-form').fire('submit');await settle();
 assert.equal(h.active(),'school');assert.equal(input.disabled,false);assert.equal(input.readOnly,false);assert.equal(h.document.activeElement?.id,'school-url');
 assertGoState(h,true);assert.equal(h.ids.get('school-spotlight').hidden,false);assert.equal(h.ids.get('school-note').hidden,false);
 assert.match(h.ids.get('status').textContent,/could not load/i);
 h.clock.advance(400);await settle();assert.equal(h.ids.get('school-note').hidden,false,'a stale fade cannot hide the restored retry instruction');
 h.chrome.storage.local.get=async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,h.storage[key]]));
 h.ids.get('school-form').fire('submit');await settle();assert.equal(h.active(),'navigation');assert.equal(input.readOnly,true);assertGoState(h,false);
});

test('room window hotspots save theme and mirror focus, hover and aria-pressed while preserving night artwork',async()=>{
 const h=fixture({reduced:true,savedValues:{'reserve:appearance':{theme:'dark',nightArt:23}}});
 await reachStep(h,'appearance');
 const light=h.document.querySelector('[data-theme-choice="light"]'),dark=h.document.querySelector('[data-theme-choice="dark"]');
 for(const [button,win] of [[light,'winL'],[dark,'winR']]){
  const box=h.room.rect(win);
  for(const side of ['left','top','width','height'])assert.equal(button.style[side],box[side]+'px',win+' hotspot covers only its window');
 }
 assert.equal(light.getAttribute('aria-label'),'Light mode');assert.equal(dark.getAttribute('aria-label'),'Dark mode');
 assert.equal(dark.getAttribute('aria-pressed'),'true');
 dark.fire('pointerenter');assert.equal(roomCalls(h,'hover').at(-1).theme,'dark');
 dark.fire('focus');dark.fire('pointerleave');assert.equal(roomCalls(h,'hover').at(-1).theme,'dark','focus retains the halo');
 dark.fire('blur');assert.equal(roomCalls(h,'hover').at(-1).theme,null);
 light.fire('focus');assert.equal(roomCalls(h,'hover').at(-1).theme,'light');
 light.fire('click');await settle();
 assert.equal(h.storage['reserve:appearance'].theme,'light');
 assert.equal(h.storage['reserve:appearance'].nightArt,23);
 assert.equal(roomCalls(h,'setTheme').at(-1).theme,'light');
 assert.equal(roomCalls(h,'setTheme').at(-1).animate,false);
 assert.equal(light.getAttribute('aria-pressed'),'true');assert.equal(dark.getAttribute('aria-pressed'),'false');
 for(const key of ['winL','plateL','winR','plateR'])assert.ok(roomCalls(h,'rect').some(call=>call.name===key),key+' guides the real overlay');
 h.cleanup();
});

test('room theme changes animate on ordinary motion and are placed by the window geometry',async()=>{
 const h=fixture();await reachStep(h,'appearance');
 const dark=h.document.querySelector('[data-theme-choice="dark"]');
 dark.fire('click');await settle();
 assert.equal(h.storage['reserve:appearance'].theme,'dark');
 const calls=roomCalls(h,'setTheme');
 assert.equal(calls.at(-1).theme,'dark');assert.equal(calls.at(-1).animate,true);
 assert.ok(!h.animations.some(animation=>animation.id==='tour-nightfall'),'in the room the drawing carries the change; the page palette switches at once');
 assert.equal(h.document.documentElement.dataset.theme,'dark');
 h.setReduced(true);await settle();
 h.document.querySelector('[data-theme-choice="light"]').fire('click');await settle();
 assert.equal(roomCalls(h,'setTheme').at(-1).animate,false);
 h.cleanup();
});

test('appearance entry names both windows; the clicked one turns into Continue and stays so on Back',async()=>{
 for(const options of [{},{reduced:true},{savedValues:{'reserve:appearance':{motion:'still'}}}])for(const theme of ['light','dark']){
  const h=fixture({...options,savedValues:{'reserve:appearance':{...options.savedValues?.['reserve:appearance'],theme}}});
  await reachStep(h,'navigation');
  assert.equal(roomCalls(h,'plate').length,0,'plates wait until appearance entry');
  await h.next();
  const other=theme==='light'?'dark':'light',chosen=h.document.querySelector('[data-theme-continue="'+theme+'"]'),inactive=h.document.querySelector('[data-theme-continue="'+other+'"]');
  const turns=()=>roomCalls(h,'plate').map(({theme,on})=>[theme,on]);
  const expected=[[theme,true],[other,false]];
  assert.deepEqual(turns(),[[theme,false],[other,false]],'both signs name their mode on entry');
  assert.equal(h.document.activeElement,h.ids.get('appearance-title'),'entry keeps the normal heading focus');
  assert.equal(h.ids.get('next').hidden,true);assert.equal(h.ids.get('back').hidden,false);assert.equal(h.ids.get('back').disabled,false);
  for(const button of [chosen,inactive]){assert.equal(button.hidden,true);assert.equal(button.inert,true);assert.equal(button.getAttribute('aria-hidden'),'true');}
  chosen.fire('click');await settle();assert.equal(h.active(),'appearance','a hidden Continue does nothing');
  h.document.querySelector('[data-theme-choice="'+theme+'"]').fire('click');await settle();
  assert.deepEqual(turns().slice(-2),expected,'the clicked window turns into Continue');
  assert.equal(h.document.activeElement,chosen,'focus moves to the new Continue');h.ids.get('appearance-title').focus();
  for(const [button,active] of [[chosen,true],[inactive,false]]){
   assert.equal(button.tagName,'BUTTON');assert.equal(button.type,'button');assert.equal(button.className,'room-hit');
   assert.equal(button.getAttribute('aria-label'),'Continue');assert.equal(button.getAttribute('aria-hidden'),String(!active));
   assert.equal(button.hidden,!active);assert.equal(button.inert,!active);assert.equal(button.disabled,!active);
   assert.equal(button.getAttribute('tabindex'),active?'0':'-1');
  }
  inactive.focus();inactive.fire('click');assert.equal(h.active(),'appearance');
  assert.equal(h.document.activeElement,h.ids.get('appearance-title'));
  chosen.fire('click');await settle();assert.equal(h.active(),'companion','the selected Continue advances');
  assert.equal(chosen.disabled,true);assert.equal(chosen.inert,true);
  await h.back();assert.equal(h.active(),'appearance');assert.deepEqual(turns().slice(-2),expected,'Back keeps the chosen window on Continue');
  assert.equal(h.document.activeElement,h.ids.get('appearance-title'),'Back does not focus Continue');
  assert.equal(appearanceWrites(h).length,1,'only the window click saves');assert.equal(h.storage['reserve:appearance'].theme,theme);
  h.cleanup();
 }
});

test('window choices save, turn both plates and transfer focus to the new Continue button',async()=>{
 for(const reduced of [false,true]){
  const h=fixture({reduced});await reachStep(h,'appearance');
  for(const theme of ['dark','light','light']){
   const before=h.roomCalls.length,other=theme==='light'?'dark':'light';
   const window=h.document.querySelector('[data-theme-choice="'+theme+'"]'),chosen=h.document.querySelector('[data-theme-continue="'+theme+'"]'),inactive=h.document.querySelector('[data-theme-continue="'+other+'"]');
   window.focus();window.fire('click');
   assert.equal(chosen.disabled,true,'Continue waits for the theme save');
   chosen.fire('click');assert.equal(h.active(),'appearance');
   await settle();assert.equal(h.active(),'appearance','choosing a window does not advance');
   assert.equal(h.storage['reserve:appearance'].theme,theme);assert.equal(h.document.activeElement,chosen);
   assert.equal(chosen.disabled,false);assert.equal(chosen.hidden,false);assert.equal(chosen.inert,false);assert.equal(chosen.getAttribute('aria-hidden'),'false');
   assert.equal(inactive.hidden,true);assert.equal(inactive.inert,true);assert.equal(inactive.disabled,true);assert.equal(inactive.getAttribute('aria-hidden'),'true');
   const calls=h.roomCalls.slice(before),set=calls.findIndex(call=>call.method==='setTheme');
   assert.ok(set>=0);assert.equal(calls[set].theme,theme);assert.equal(calls[set].animate,!reduced);
   assert.deepEqual(calls.filter(call=>call.method==='plate').map(({theme,on})=>[theme,on]),[[theme,true],[other,false]]);
   assert.ok(calls.findIndex(call=>call.method==='plate')>set,'the theme updates before its plate turns');
  }
  await h.next();assert.equal(h.active(),'companion');h.cleanup();
 }
});

test('only the active Continue plate lifts on hover or focus and clears its lift when leaving',async()=>{
 const h=fixture({reduced:true});await reachStep(h,'appearance');
 const stage=h.ids.get('room-stage'),light=h.document.querySelector('[data-theme-continue="light"]'),dark=h.document.querySelector('[data-theme-continue="dark"]');
 const lifted=()=>stage.classList.contains('wr-plate-hover');
 light.fire('pointerenter');assert.equal(lifted(),false,'no sign lifts before a window is chosen');light.fire('pointerleave');
 h.document.querySelector('[data-theme-choice="light"]').fire('click');await settle();h.ids.get('back').focus();
 dark.fire('pointerenter');dark.fire('focus');assert.equal(lifted(),false);
 dark.fire('pointerleave');dark.fire('blur');
 light.fire('pointerenter');assert.equal(lifted(),true);
 light.focus();light.fire('pointerleave');assert.equal(lifted(),true,'focus keeps Continue lifted');
 h.ids.get('back').focus();assert.equal(lifted(),false);
 light.fire('pointerenter');assert.equal(lifted(),true);
 h.document.querySelector('[data-theme-choice="dark"]').fire('click');assert.equal(lifted(),false,'busy and inactive plates cannot lift');
 await settle();assert.equal(lifted(),true,'the chosen plate receives focus');
 light.fire('pointerleave');assert.equal(lifted(),true,'the old plate cannot clear the newly focused plate');
 dark.fire('pointerenter');h.ids.get('back').focus();assert.equal(lifted(),true,'pointer hover survives blur');
 dark.fire('pointerleave');assert.equal(lifted(),false);
 dark.focus();dark.fire('click');await settle();assert.equal(h.active(),'companion');assert.equal(lifted(),false);
 await h.back();assert.equal(lifted(),false,'returning starts without stale plate hover');h.cleanup();
});

test('appearance tab order is both windows, chosen Continue, then Back for either theme',async()=>{
 const h=fixture({reduced:true});await reachStep(h,'appearance');
 const light=h.document.querySelector('[data-theme-choice="light"]'),dark=h.document.querySelector('[data-theme-choice="dark"]');
 for(const theme of ['light','dark','light']){
  h.document.querySelector('[data-theme-choice="'+theme+'"]').fire('click');await settle();
  const tabStops=h.document.querySelectorAll('button,input').filter(button=>{
   if(button.disabled||button.getAttribute('tabindex')==='-1')return false;
   for(let node=button;node;node=node.parentElement)if(node.hidden||node.inert)return false;
   return true;
  });
  const chosen=h.document.querySelector('[data-theme-continue="'+theme+'"]');
  assert.deepEqual(tabStops,[light,dark,chosen,h.ids.get('back')]);
  for(const button of tabStops){button.focus();assert.equal(h.document.activeElement,button);}
 }
 h.cleanup();
});

test('a failed theme save restores the previous plates without moving focus',async()=>{
 const h=fixture({reduced:true});await reachStep(h,'appearance');
 const dark=h.document.querySelector('[data-theme-choice="dark"]'),lightPlate=h.document.querySelector('[data-theme-continue="light"]'),darkPlate=h.document.querySelector('[data-theme-continue="dark"]');
 const original=h.chrome.storage.local.set;
 h.chrome.storage.local.set=async values=>{if(Object.hasOwn(values,'reserve:appearance'))throw Error('Save failed');return original(values);};
 dark.focus();dark.fire('click');await settle();
 assert.match(h.ids.get('status').textContent,/Could not save that theme/);
 assert.equal(h.document.documentElement.dataset.theme,'light');assert.equal(h.active(),'appearance');assert.equal(h.document.activeElement,dark);
 // nothing was chosen before, so both windows name their mode again
 assert.equal(lightPlate.hidden,true);assert.equal(darkPlate.inert,true);assert.equal(darkPlate.hidden,true);
 assert.deepEqual(roomCalls(h,'plate').slice(-2).map(({theme,on})=>[theme,on]),[['light',false],['dark',false]]);
 // after a chosen window, a failed change keeps the earlier Continue
 h.chrome.storage.local.set=original;h.document.querySelector('[data-theme-choice="light"]').fire('click');await settle();
 h.chrome.storage.local.set=async values=>{if(Object.hasOwn(values,'reserve:appearance'))throw Error('Save failed');return original(values);};
 dark.focus();dark.fire('click');await settle();assert.equal(h.document.activeElement,dark);
 assert.equal(lightPlate.disabled,false);assert.equal(lightPlate.hidden,false);assert.equal(darkPlate.hidden,true);
 assert.deepEqual(roomCalls(h,'plate').slice(-2).map(({theme,on})=>[theme,on]),[['light',true],['dark',false]]);
 h.cleanup();
});

test('companion artwork overlays align to title, toggle, and finish, with a usable pony scale',async()=>{
 const h=fixture({reduced:true});await reachStep(h,'companion');
 const heading=h.ids.get('companion-title'),actor=h.ids.get('pet-actor'),bubble=h.document.querySelector('.tour-bubble');
 const toggle=h.document.querySelector('.pet-toggle'),finish=h.ids.get('finish-board');
 const title=h.room.rect('title'),pony=h.room.rect('pony');
 assert.equal(heading.style.left,title.left+'px');
 assert.equal(heading.style.top,title.top+'px');
 const height=Number.parseFloat(actor.style.height||actor.style.getPropertyValue('--pony-height'));
 assert.ok(height>=h.context.innerHeight*.11&&height<=h.context.innerHeight*.17,'pony is around 14% viewport height');
 assert.ok(Math.abs(Number.parseFloat(actor.style.left)+Number.parseFloat(actor.style.width)/2-pony.left)<.01,'pony actor centers on the named point');
 assert.ok(Math.abs(Number.parseFloat(actor.style.top)+height*60/64-pony.top)<.01,'feet land on the named ground point');
 assert.ok(bubble);assert.ok(toggle);assert.ok(finish);
 const bb=bubble.getBoundingClientRect(),hx=pony.x+height*72/64*.3,hy=pony.y-height*60/64+height*.04;
 assert.equal(bubble.style.left,Math.max(8,Math.min(hx-bb.width*(h.room.theme==='dark'?.7:.3),h.context.innerWidth-bb.width-8))+'px','the tail points at the head');
 assert.equal(bubble.style.top,Math.max(bb.height+8,Math.min(hy-2,h.context.innerHeight-8))+'px','the tail tip sits just above the head');
 for(const [node,name] of [[toggle,'toggle'],[finish,'finish']]){
  const box=h.room.rect(name);
  for(const side of ['left','top','width','height'])assert.equal(node.style[side],box[side]+'px',name+' click target tracks the artwork');
 }
 assert.ok(toggle.querySelector('.pet-toggle-label'));
 assert.match(read('welcome.html'),/class="pet-toggle-label">Keep Biscuit<\/span>/,'companion uses the visible toggle label');
 assert.equal(finish.tagName,'BUTTON');
 assert.equal(finish.getAttribute('aria-label'),'Open my Canvas');
 assert.equal(finish.closest('#room-stage'),null);
 finish.fire('pointerenter');assert.equal(h.ids.get('room-stage').classList.contains('wr-finish-hover'),true);
 finish.fire('focus');finish.fire('pointerleave');assert.equal(h.ids.get('room-stage').classList.contains('wr-finish-hover'),true);
 finish.fire('blur');assert.equal(h.ids.get('room-stage').classList.contains('wr-finish-hover'),false);
 assert.ok(roomCalls(h,'rect').some(call=>call.name==='finish'));
 h.cleanup();
});

test('companion entry lights the actor and the whole toggle label, leaves speech unfiltered and clears the actor on leave',async()=>{
 for(const options of [{},{reduced:true},{savedValues:{'reserve:appearance':{motion:'still'}}}])for(const theme of ['light','dark']){
  const appearance={...options.savedValues?.['reserve:appearance'],theme};
  const h=fixture({...options,savedValues:{'reserve:appearance':appearance}});
  await reachStep(h,'companion');
  const actor=h.ids.get('pet-actor'),bubble=h.document.querySelector('.tour-bubble'),toggle=h.document.querySelector('.pet-toggle');
  const expected=theme==='dark'?PONY_NIGHT_FILTER:'none';
  assert.equal(actor.style.filter,expected,'entry retains lighting after the pony rig resets');
  assert.equal(toggle.style.filter,expected,'the generated switch and its label share the meadow lighting');
  assert.ok(roomCalls(h,'litFilter').some(call=>call.lit===true));
  assert.equal(bubble.style.filter||'','');assert.equal(h.ids.get('meadow').style.filter||'','');
  h.ids.get('back').fire('click');assert.equal(actor.style.filter,'','leaving clears the inline filter immediately');
  await settle();assert.equal(h.active(),'appearance');
  h.resize(960,720);assert.equal(actor.style.filter,'','layout outside companion leaves the filter clear');
  await h.next();assert.equal(actor.style.filter,expected,'returning reapplies the room lighting');
  h.cleanup();
 }
});

test('companion theme changes and layout refresh pony lighting and both actor and bubble positions',async()=>{
 for(const options of [{},{reduced:true},{savedValues:{'reserve:appearance':{motion:'still'}}}]){
  const h=fixture(options);await reachStep(h,'companion');
  h.clock.advance(2000);await settle();
  const actor=h.ids.get('pet-actor'),bubble=h.document.querySelector('.tour-bubble');
  const check=()=>{
   const pony=h.room.rect('pony'),height=h.context.innerHeight*.14,width=height*72/64;
   assert.equal(actor.style.left,(pony.x-width/2)+'px');
   assert.equal(actor.style.top,(pony.y-height*60/64)+'px');
   assert.equal(actor.style.width,width+'px');assert.equal(actor.style.height,height+'px');
   const bounds=bubble.getBoundingClientRect();
   const hx=pony.x+parseFloat(actor.style.width)*.3;
   assert.equal(bubble.style.left,Math.max(8,Math.min(hx-bounds.width*(h.room.theme==='dark'?.7:.3),h.context.innerWidth-bounds.width-8))+'px');
   assert.equal(bubble.style.top,Math.max(bounds.height+8,Math.min(pony.y-height*60/64+height*.04-2,h.context.innerHeight-8))+'px');
   assert.equal(actor.style.filter,h.room.theme==='dark'?PONY_NIGHT_FILTER:'none');assert.equal(bubble.style.filter||'','');
   assert.equal(h.document.querySelector('.pet-toggle').style.filter,h.room.theme==='dark'?PONY_NIGHT_FILTER:'none');
  };
  check();
  for(const theme of ['dark','light','dark']){
   const before=[actor.style.left,actor.style.top,bubble.style.left,bubble.style.top];
   await h.chrome.storage.local.set({'reserve:appearance':{...h.storage['reserve:appearance'],theme}});await settle();
   assert.equal(h.active(),'companion');assert.equal(h.room.theme,theme);
   assert.ok(before.every((value,i)=>value!==[actor.style.left,actor.style.top,bubble.style.left,bubble.style.top][i]),'both overlays follow the new theme point');
   check();
  }
  h.resize(960,720);check();
  h.cleanup();
 }
});

test('existing Still and reduced-motion overrides continue to disable CSS transitions',()=>{
 const css=read('welcome.css');
 assert.match(css,/\.tour\[data-still=true\][^{]*\{[^}]*transition:none!important/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\s*\*,\*::before,\*::after\{[^}]*transition:none!important/);
});

test('the night pony starts unlit and brightens with ease-in for the entire 1900 ms walk, pausing while hidden',async t=>{
 const h=fixture({savedValues:{'reserve:appearance':{theme:'dark'}}});t.after(()=>h.cleanup());await reachStep(h,'companion');
 const actor=h.ids.get('pet-actor'),lighting=h.animations.findLast(a=>a.node===actor&&a.frames.some(frame=>Object.hasOwn(frame,'filter')));
 const travel=h.animations.findLast(a=>a.node===actor&&a.frames.some(frame=>Object.hasOwn(frame,'transform')));
 assert.ok(lighting,'arrival has a filter animation on the real actor');assert.ok(travel);
 assert.deepEqual(structuredClone(lighting.frames),[{filter:PONY_UNLIT_FILTER},{filter:PONY_NIGHT_FILTER}]);
 assert.equal(lighting.options.duration,1900);assert.equal(lighting.options.delay,0);assert.equal(lighting.options.easing,'ease-in');
 assert.equal(travel.options.duration,1900);assert.equal(travel.options.delay,0);
 assert.equal(lighting.playState,'paused');assert.equal(lighting.currentTime,0,'the first rendered pose uses the dark filter immediately');
 assert.ok(roomCalls(h,'ponyLight').some(call=>call.lit===false));assert.ok(roomCalls(h,'ponyLight').some(call=>call.lit===true));
 const writes=h.styleWrites.filter(write=>write.node===actor&&['transition','filter'].includes(write.key));
 assert.ok(writes.some((write,i)=>write.key==='filter'&&write.value===PONY_UNLIT_FILTER&&writes[i-1]?.key==='transition'&&writes[i-1].value==='none'&&writes[i+1]?.value===PONY_NIGHT_FILTER),'the dark reset precedes the lit target without a second CSS transition');
 h.clock.advance(500);await settle();assert.ok(lighting.currentTime>0&&lighting.currentTime<1900);
 const elapsed=lighting.currentTime;h.setHidden(true);h.clock.advance(10000);await settle();
 assert.equal(lighting.currentTime,elapsed,'hidden wall time does not advance lighting');
 h.setHidden(false);h.clock.advance(100);await settle();
 assert.ok(lighting.currentTime>elapsed&&lighting.currentTime<elapsed+150,'resuming advances visible time without a jump');
 h.clock.advance(1500);await settle();assert.equal(actor.style.filter,PONY_NIGHT_FILTER);assert.equal(lighting.currentTime,1900);
 assert.equal(h.ids.get('meadow').classList.contains('is-arrived'),true);
});

test('turning the pony off holds its light for the 500 ms wave, then darkens over the 1500 ms trot and reverses on return',async t=>{
 for(const theme of ['light','dark']){
  const h=fixture({savedValues:{'reserve:appearance':{theme}}});t.after(()=>h.cleanup());await reachStep(h,'companion');h.clock.advance(2000);await settle();
  const actor=h.ids.get('pet-actor'),checkbox=h.ids.get('pet-enabled'),label=h.document.querySelector('.pet-toggle');
  const lit=theme==='dark'?PONY_NIGHT_FILTER:'none',unlit=theme==='dark'?PONY_UNLIT_FILTER:'none';
  const before=h.animations.length;checkbox.checked=false;checkbox.fire('change');await settle();
  const added=h.animations.slice(before),lighting=added.find(a=>a.node===actor&&a.frames.some(frame=>Object.hasOwn(frame,'filter')));
  const travel=added.find(a=>a.node===actor&&a.frames.some(frame=>Object.hasOwn(frame,'transform')));
  assert.ok(lighting);assert.ok(travel);assert.deepEqual(structuredClone(lighting.frames),[{filter:lit},{filter:unlit}]);
  assert.equal(lighting.options.delay,500);assert.equal(lighting.options.duration,1500);assert.equal(lighting.options.easing,'ease-out');
  assert.equal(travel.options.delay,500);assert.equal(travel.options.duration,1500);
  assert.ok(added.some(a=>a.node===h.ids.get('tour-pet').querySelector('.pet-head')&&a.options.duration>0&&a.options.duration<=500),'the head waves before departure');
  assert.equal(label.style.filter,lit,'turning off Biscuit never darkens the switch label');
  h.clock.advance(499);await settle();assert.equal(h.ids.get('tour-pet').dataset.pose,'stand');assert.ok(lighting.currentTime<500);
  h.clock.advance(50);await settle();assert.equal(h.ids.get('tour-pet').dataset.pose,'trot');assert.ok(lighting.currentTime>=500);
  h.clock.advance(1500);await settle();assert.equal(actor.style.filter,unlit);assert.equal(h.ids.get('meadow').classList.contains('is-off'),true);
  checkbox.checked=true;checkbox.fire('change');await settle();
  const returning=h.animations.findLast(a=>a.node===actor&&a.frames.some(frame=>Object.hasOwn(frame,'filter')));
  assert.deepEqual(structuredClone(returning.frames),[{filter:unlit},{filter:lit}]);assert.equal(returning.options.duration,1900);assert.equal(returning.options.delay,0);assert.equal(returning.options.easing,'ease-in');
 }
});

test('saved disabled pony and reduced motion settle the correct final filter without a walk',async t=>{
 for(const theme of ['light','dark'])for(const enabled of [false,true])for(const motion of [{reduced:true},{savedValues:{motion:'still'}}]){
  const h=fixture({reduced:motion.reduced,savedValues:{'reserve:appearance':{...motion.savedValues,theme,pet:enabled}}});t.after(()=>h.cleanup());await reachStep(h,'companion');
  assert.equal(h.ids.get('pet-actor').style.filter,theme==='dark'?(enabled?PONY_NIGHT_FILTER:PONY_UNLIT_FILTER):'none');
  assert.equal(h.document.querySelector('.pet-toggle').style.filter,theme==='dark'?PONY_NIGHT_FILTER:'none');
  assert.equal(h.animations.some(a=>a.node===h.ids.get('pet-actor')&&a.frames.some(frame=>Object.hasOwn(frame,'filter'))),false);
  assert.equal(h.ids.get('pet-switch').classList.contains('is-on'),enabled);
 }
});

test('idle updates at 12 fps after intro and halts on hide, reduced motion, finish and pagehide',async()=>{
 const h=fixture();await reachStep(h,'navigation');
 const seen=roomCalls(h,'idle').length;h.clock.advance(1000);await settle();
 const idle=roomCalls(h,'idle').slice(seen);
 assert.equal(idle.length,12,'the room only draws 12 idle frames per visible second');
 for(let i=1;i<idle.length;i++)assert.ok(Math.abs(idle[i].seconds-idle[i-1].seconds-1/12)<.02);
 h.setHidden(true);noFilmWork(h,'hidden room');
 const count=roomCalls(h,'idle').length;h.clock.advance(10000);assert.equal(roomCalls(h,'idle').length,count);
 h.setHidden(false);h.clock.advance(250);await settle();assert.equal(roomCalls(h,'idle').length,count+3);
 const layouts=roomCalls(h,'layout').length;
 h.resize(640,800);assert.ok(roomCalls(h,'layout').length>layouts,'resize recomputes room layout');
 h.setReduced(true);noFilmWork(h,'reduced room');
 const still=roomCalls(h,'idle').length;h.clock.advance(1000);assert.equal(roomCalls(h,'idle').length,still);
 h.cleanup();noFilmWork(h,'pagehide room');
});
test('the source motion API exposes a 24 fps scene clock and authored seamless loop frames',()=>{
 assert.equal(Motion.art.filmFps.scene,24);
 const group={getAttribute:name=>({'data-loop':'sway','data-amp':'5','data-period':'3'}[name]??null)};
 const spec=Motion.loopSpec(group,3);
 const frames=Motion.loopFrames(spec);
 assert.equal(spec.type,'sway');assert.equal(spec.period,3);
 assert.equal(frames[0].offset,0);assert.equal(frames.at(-1).offset,1);
 assert.equal(frames[0].transform,frames.at(-1).transform,'a living loop rejoins its rest pose');
 assert.ok(frames.some(frame=>frame.transform!==frames[0].transform),'a loop has actual motion');
});

const calls=(h,method)=>h.introCalls.filter(call=>call.method===method);
const pose=h=>calls(h,'setT').at(-1);
const opening=h=>h.document.querySelector('.intro-layer');
const complete=async h=>{h.clock.advance(INTRO_END*1000+50);await settle();};
function assertFinal(h){
 assert.equal(pose(h)?.t,INTRO_END,'the supplied END pose is sampled exactly');
 assert.ok(calls(h,'setT').every(call=>Number.isFinite(call.t)&&call.t>=0&&call.t<=INTRO_END),'playback never samples outside the supplied timeline');
 assert.equal(h.ids.get('tour').dataset.opening,'false');
 assert.equal(opening(h).hidden,false,'settled artwork stays visible on the intro');
 assert.equal(opening(h).classList.contains('is-settled'),true);
 assertReady(h);
}
function assertReady(h){
 assert.equal(h.ids.get('intro-start').disabled,false,'the drawn Start has an enabled native button');
 assert.equal(h.document.querySelector('.tour-footer').hidden,true,'the footer stays hidden throughout intro');
 assert.equal(h.animations.filter(a=>a.id==='tour-intro-reveal').length,0,'the drawing owns the tagline and Start reveal');
}
function assertOverlay(h){
 const rect=opening(h).querySelector('.startb').getBoundingClientRect(),button=h.ids.get('intro-start');
 for(const key of ['left','top','width','height'])assert.equal(button.style[key],rect[key]+'px',key+' follows the drawn button');
}
function assertLayerFade(h){
 const layer=opening(h);
 const fade=h.animations.findLast(a=>a.node===layer&&Number(a.frames[0]?.opacity)===1&&Number(a.frames.at(-1)?.opacity)===0);
 if(fade){assert.equal(fade.options.duration,400);return;}
 // A CSS opacity transition is equally valid. Verify both its real state change
 // and stylesheet duration; the deterministic fixture does not render CSS.
 assert.equal(layer.classList.contains('is-away'),true,'Start puts the layer in its fading state');
 const css=read('welcome.css'),rule=css.match(/\.intro-layer\s*\{([^}]+)\}/)?.[1]||'';
 const transition=rule.match(/(?:^|;)\s*transition\s*:\s*([^;]+)/)?.[1]||'';
 const opacity=transition.match(/(?:^|,)\s*opacity\s+([\d.]+)(ms|s)\b/);
 assert.ok(opacity,'the layer has an opacity transition');
 assert.equal(Number(opacity[1])*(opacity[2]==='s'?1000:1),400);
 assert.match(css,/\.intro-layer\.is-away\s*\{[^}]*\bopacity\s*:\s*0(?:\s*[;}])/,'the fading state reaches opacity zero');
}

test('each fresh load mounts supplied opening art and starts at zero before rAF advances visible seconds',async()=>{
 for(let run=0;run<2;run++){
  const h=fixture();await settle();
  assert.equal(calls(h,'mount').length,1,'the art mounts once on each new page');
  assert.equal(opening(h).querySelectorAll('svg.intro-art').length,1);
  assert.equal(opening(h).querySelector('svg.intro-art').getAttribute('viewBox'),'0 0 1600 900');
  assert.equal(calls(h,'setT')[0]?.t,0,'a fresh opening starts at its first pose');
  assert.equal(h.ids.get('tour').dataset.opening,'true');assert.equal(h.active(),'intro');
  assert.equal(h.ids.get('intro-start').disabled,true);assert.notEqual(h.document.activeElement,h.ids.get('intro-start'));
  h.ids.get('intro-start').focus();assert.notEqual(h.document.activeElement,h.ids.get('intro-start'),'disabled Start cannot take focus');
  assert.equal(h.document.querySelector('.tour-footer').hidden,true);assertOverlay(h);
  assert.equal(h.clock.frameCount,1,'opening playback is driven by requestAnimationFrame');
  h.clock.advance(1000);await settle();
  assert.ok(pose(h).t>=.95&&pose(h).t<=1.001,'setT receives seconds of visible playback');
  assert.equal(calls(h,'idle').length,0,'twinkle waits for END');h.cleanup();
 }
});

test('240Hz rAF skips drawing frames less than 15ms after the previous sample',async()=>{
 const h=fixture({frameHz:240});await settle();h.clock.advance(1000);await settle();
 const samples=calls(h,'setT');assert.ok(samples.length>=50,'high refresh still draws regularly');
 assert.ok(samples.length<=62,'drawing is capped near 60 fps on a 240Hz display');
 for(let i=1;i<samples.length;i++)assert.ok(samples[i].at-samples[i-1].at>=15-1e-7,'too-close rAF callbacks must not redraw');
 assert.ok(pose(h).t>=.98&&pose(h).t<=1.001,'skipping draws does not slow visible time');h.cleanup();
});

test('the opening keeps playing through reveal to exact supplied END and keeps the final layer visible',async()=>{
 const h=fixture();await settle();h.clock.advance(INTRO_READY*1000+30);await settle();
 assert.equal(h.ids.get('tour').dataset.opening,'reveal','the intro is revealed while the drawing finishes');
 assert.ok(pose(h)?.t<INTRO_END);h.clock.advance(450);await settle();assertFinal(h);
 assert.equal(h.clock.frameCount,0,'rAF stops at END');
 const count=calls(h,'setT').length;h.clock.advance(1000);await settle();
 assert.equal(calls(h,'setT').length,count,'idle never replays or overshoots setT');h.cleanup();
});

test('READY enables and focuses native Start while the full-screen drawing finishes its own reveal',async()=>{
 const h=fixture();await settle();h.clock.advance(INTRO_READY*1000-10);
 assert.equal(h.ids.get('tour').dataset.opening,'true');
 assert.equal(h.ids.get('intro-start').disabled,true);
 h.clock.advance(30);await settle();
 assert.equal(h.ids.get('tour').dataset.opening,'reveal');assertReady(h);assertOverlay(h);
 assert.equal(h.document.activeElement,h.ids.get('intro-start'),'Start is focused when READY is drawn');
 assert.ok(pose(h).t>=INTRO_READY&&pose(h).t<INTRO_END,'the picture is still playing during the reveal');
 assert.equal(h.clock.frameCount,1);assert.equal(calls(h,'idle').length,0,'idle waits until END');
 const css=read('welcome.css'),layer=css.match(/\.intro-layer\s*\{([^}]*)\}/)?.[1];
 assert.match(layer,/position:fixed;inset:0/);assert.doesNotMatch(layer,/display:grid|padding|transform/);
 assert.match(css,/\.intro-layer svg\{width:100%;height:100%;display:block\}/);
 assert.doesNotMatch(css,/mask-(?:image|composite)|\.intro-layer\.is-settled\s*\{\s*\}/);
 assert.equal(h.ids.get('intro-start').querySelectorAll('svg').length,0,'control decoration does not draw a second button');
 h.cleanup();
});

test('pointer and focus hover move the drawn bounds and keep the overlay aligned during reveal and after END',async()=>{
 const h=fixture();await settle();const button=h.ids.get('intro-start');
 button.fire('pointerenter');button.fire('pointerleave');assert.equal(calls(h,'hover').length,0,'disabled Start cannot hover the drawing');
 h.clock.advance(INTRO_READY*1000+30);assertReady(h);assertOverlay(h);
 assert.equal(calls(h,'hover').at(-1).on,true,'automatic keyboard focus lifts the drawing');button.fire('blur');assertOverlay(h);
 const top=button.style.top;
 button.fire('pointerenter');assert.equal(calls(h,'hover').at(-1).on,true);assert.notEqual(button.style.top,top);assertOverlay(h);
 button.fire('focus');button.fire('pointerleave');assert.equal(calls(h,'hover').at(-1).on,true);assertOverlay(h);
 h.clock.advance(500);assertFinal(h);assertOverlay(h);
 button.fire('blur');assert.equal(calls(h,'hover').at(-1).on,false);assert.equal(button.style.top,top);assertOverlay(h);
 button.fire('focus');assert.equal(calls(h,'hover').at(-1).on,true);assertOverlay(h);
 h.resize(600,900);assertOverlay(h);button.fire('blur');assertOverlay(h);h.cleanup();
});

test('native Start keeps Enter and Space activation available after READY and Back returns focus to it',async()=>{
 for(const key of ['Enter',' ']){
  const h=fixture({personal:true});await settle();h.clock.advance(INTRO_READY*1000+30);
  const button=h.ids.get('intro-start'),event=h.documentEvent('keydown',{key,target:button});
  assert.equal(h.document.activeElement,button);assert.equal(event.defaultPrevented,false,'native keyboard activation remains available');
  assert.equal(h.active(),'intro','keydown leaves activation to the native button');
  button.fire('click',{detail:0});await settle();h.clock.advance(400);await settle();
  assert.equal(h.active(),'navigation');assert.equal(roomCalls(h,'enter').length,1);
  await h.back();assertFinal(h);assert.equal(h.document.activeElement,button);assertOverlay(h);
  assert.equal(h.clock.frameCount,0);h.cleanup();
 }
});

test('a failed drawing still exposes a working native Start with no opening clock',async()=>{
 const h=fixture({introFails:true,personal:true});await settle();const button=h.ids.get('intro-start');
 assert.equal(h.ids.get('tour').dataset.opening,'false');assert.equal(button.disabled,false);assert.equal(h.document.activeElement,button);
 assert.equal(button.classList.contains('is-fallback'),true);assert.equal(opening(h).hidden,true);noFilmWork(h,'failed opening');
 await h.next();assert.equal(h.active(),'navigation');assert.equal(h.document.querySelector('.tour-footer').hidden,false);
 await h.back();assert.equal(button.disabled,false);assert.equal(h.document.activeElement,button);h.cleanup();
});

test('hidden playback cancels work, freezes visible seconds and resumes without a wall-time jump',async()=>{
 const h=fixture();await settle();h.clock.advance(1000);await settle();
 assert.ok(pose(h),'playback samples the supplied drawing before hiding');
 const before=calls(h,'setT').length,t=pose(h).t;
 h.setHidden(true);noFilmWork(h,'hidden opening');
 h.clock.advance(15000);await settle();
 assert.equal(calls(h,'setT').length,before);assert.equal(calls(h,'idle').length,0);
 assert.equal(h.ids.get('tour').dataset.opening,'true');
 h.setHidden(false);assert.equal(h.clock.frameCount,1);
 h.clock.advance(500);await settle();
 assert.ok(pose(h).t>=t+.45&&pose(h).t<=t+.55,'only resumed visible time advances setT');
 h.clock.advance(INTRO_READY*1000-1500+30);await settle();assert.equal(h.ids.get('tour').dataset.opening,'reveal');
 h.setHidden(true);noFilmWork(h,'hidden reveal');const revealed=calls(h,'setT').length;
 h.clock.advance(5000);await settle();assert.equal(calls(h,'setT').length,revealed);
 assert.equal(h.ids.get('tour').dataset.opening,'reveal');assert.equal(calls(h,'idle').length,0);
 h.setHidden(false);
 h.clock.advance(450);await settle();assertFinal(h);h.cleanup();
});

test('an initially hidden page queues no opening or film work until it becomes visible',async()=>{
 const h=fixture({hidden:true});await settle();
 assert.equal(calls(h,'mount').length,1);noFilmWork(h,'startup hidden');assert.equal(h.clock.requestedFrames,0);
 const samples=calls(h,'setT').length;h.clock.advance(10000);await settle();
 assert.equal(calls(h,'setT').length,samples);assert.equal(calls(h,'idle').length,0);
 h.setHidden(false);h.clock.advance(500);await settle();
 assert.ok(pose(h).t>0&&pose(h).t<=.501,'startup hidden time is excluded');h.cleanup();
});

test('any key jumps to END and consumes its event without moving the intro step',async()=>{
 for(const key of ['Escape','a','ArrowRight',' ','PageDown','Tab','Enter','Shift']){
  const h=fixture();await settle();h.clock.advance(200);
  const event=h.documentEvent('keydown',{key,target:h.ids.get('next')});
  assert.equal(event.defaultPrevented,true,key+' is consumed');assert.equal(event.propagationStopped,true);
  assertFinal(h);assert.equal(h.document.activeElement,h.ids.get('intro-start'));assertOverlay(h);
  assert.equal(h.active(),'intro');assert.equal(h.clock.frameCount,0);h.cleanup();
 }
});

test('a click anywhere before READY skips to END and is consumed before normal navigation',async()=>{
 const h=fixture();await settle();
 const event=h.documentEvent('click',{target:opening(h)});await settle();
 assert.equal(event.defaultPrevented,true);assert.equal(event.propagationStopped,true);
 assertFinal(h);assert.equal(h.document.activeElement,h.ids.get('intro-start'));assert.equal(h.active(),'intro');
 await h.next();assert.equal(h.active(),'school');h.cleanup();
});

test('a Start click during reveal navigates to the next step and stops opening playback',async()=>{
 const h=fixture();await settle();h.clock.advance(INTRO_READY*1000+50);await settle();
 assert.equal(h.ids.get('tour').dataset.opening,'reveal');assert.equal(h.active(),'intro');
 assert.ok(pose(h).t<INTRO_END);assert.equal(calls(h,'idle').length,0);
 const event=h.ids.get('intro-start').fire('click');await settle();
 assert.equal(event.defaultPrevented,false,'Start is not consumed during reveal');
 assert.equal(event.propagationStopped,false);
 h.clock.advance(400);await settle();assert.equal(h.active(),'school');
 assert.equal(pose(h).t,INTRO_END,'leaving intro samples END exactly');
 assert.equal(h.ids.get('tour').dataset.opening,'false');
 const count=h.introCalls.length;h.clock.advance(1000);await settle();
 assert.equal(h.introCalls.length,count,'leaving intro stops both opening playback and idle');h.cleanup();
});

test('pointerdown jumps to END and swallows only its paired Start click',async()=>{
 const h=fixture();await settle();
 const event=h.documentEvent('pointerdown',{target:opening(h),pointerId:1});
 assert.equal(event.defaultPrevented,true);assert.equal(event.propagationStopped,true);assertFinal(h);
 const click=h.ids.get('intro-start').fire('click',{pointerId:1});await settle();
 assert.equal(click.defaultPrevented,true);assert.equal(h.active(),'intro','paired click cannot navigate');
 await h.next();assert.equal(h.active(),'school','the following deliberate click navigates exactly once');h.cleanup();
});

test('right and middle button skips do not suppress the next deliberate Start click',async()=>{
 for(const detail of [{button:2},{button:1}]){
  const h=fixture();await settle();
  const down=h.documentEvent('pointerdown',{target:opening(h),pointerId:1,...detail});
  assert.equal(down.defaultPrevented,true);assertFinal(h);
  const click=h.ids.get('intro-start').fire('click',{button:0,isPrimary:true});await settle();
  assert.equal(click.defaultPrevented,false,'a skip without a primary click must not leave click suppression armed');
   h.clock.advance(400);await settle();assert.equal(h.active(),'school');h.cleanup();
 }
});

test('pointercancel clears the skipped gesture latch before a later Start click',async()=>{
 const h=fixture();await settle();
 h.documentEvent('pointerdown',{target:opening(h),pointerId:1,button:0,isPrimary:true});assertFinal(h);
 h.ids.get('intro-start').fire('pointercancel',{pointerId:1});
 const click=h.ids.get('intro-start').fire('click',{button:0,isPrimary:true});await settle();
 assert.equal(click.defaultPrevented,false,'a cancelled gesture cannot consume a later click');
 h.clock.advance(400);await settle();assert.equal(h.active(),'school');h.cleanup();
});

test('a new pointerdown clears stale skip suppression before its own Start click',async()=>{
 const h=fixture();await settle();
 h.documentEvent('pointerdown',{target:opening(h),pointerId:1,button:0,isPrimary:true});assertFinal(h);
 const down=h.ids.get('intro-start').fire('pointerdown',{pointerId:2,button:0,isPrimary:true});
 assert.equal(down.defaultPrevented,false,'the new gesture starts after opening playback has settled');
 const click=h.ids.get('intro-start').fire('click',{pointerId:2,button:0,isPrimary:true});await settle();
 assert.equal(click.defaultPrevented,false,'a fresh gesture cannot inherit suppression from an abandoned skip');
 h.clock.advance(400);await settle();assert.equal(h.active(),'school');h.cleanup();
});

test('END idles at 8fps only while the visible intro remains active',async()=>{
 const h=fixture();await settle();await complete(h);
 const before=calls(h,'idle').length;h.clock.advance(1000);await settle();
 const samples=calls(h,'idle').slice(before);assert.equal(samples.length,8,'one visible second has eight idle samples');
 for(let i=1;i<samples.length;i++){
  assert.ok(Math.abs(samples[i].at-samples[i-1].at-125)<.001,'idle samples are 125ms apart');
  assert.ok(Math.abs(samples[i].t-samples[i-1].t-.125)<.001,'idle receives seconds');
 }
 assert.equal(h.clock.frameCount,0,'settled twinkle must not maintain an rAF loop');
 h.setHidden(true);noFilmWork(h,'hidden settled intro');const count=calls(h,'idle').length;
 h.clock.advance(5000);assert.equal(calls(h,'idle').length,count);
 h.setHidden(false);h.clock.advance(500);assert.equal(calls(h,'idle').length,count+4);
 await h.next();const left=calls(h,'idle').length;h.clock.advance(1000);
 assert.equal(calls(h,'idle').length,left,'idle stops as soon as Start leaves intro');h.cleanup();
});

test('Start keeps the intro fade visible for 400 ms and CH+ Back restores the settled drawing',async()=>{
 const h=fixture({personal:true});await settle();await complete(h);
 h.ids.get('intro-start').fire('click');await settle();
 assert.equal(opening(h).hidden,false,'the drawing stays visible during its exit fade');
 assertLayerFade(h);
 h.clock.advance(399);await settle();assert.equal(opening(h).hidden,false);
 h.clock.advance(1);await settle();assert.equal(opening(h).hidden,true);
 assert.equal(h.active(),'navigation');
 await h.back();assert.equal(h.active(),'intro');assertFinal(h);
 assert.equal(h.document.activeElement,h.ids.get('intro-start'));assertOverlay(h);
 const before=calls(h,'setT').length;h.clock.advance(750);await settle();
 assert.ok(calls(h,'setT').slice(before).every(call=>call.t===INTRO_END));
 assert.equal(calls(h,'mount').length,1,'Back does not remount intro');h.cleanup();
});

test('camera transitions block input until the controller Promise settles, then focus the heading',async()=>{
 const h=fixture({personal:true,holdRoom:true});await settle();
 h.documentEvent('keydown',{key:'Escape'});
 h.ids.get('intro-start').fire('click');await settle();
 assert.equal(roomCalls(h,'enter').length,1);
 assert.equal(h.ids.get('back').disabled,true);
 assert.equal(h.ids.get('next').disabled,true);
 const before=roomCalls(h,'go').length;
 h.ids.get('next').fire('click');h.ids.get('back').fire('click');
 assert.equal(roomCalls(h,'go').length,before,'input during camera travel has no effect');
 h.clock.advance(400);await settle();
 assert.notEqual(h.active(),'navigation','the step is not interactable before the camera finishes');
 h.releaseRoom();await settle();
 assert.equal(h.active(),'navigation');
 assert.equal(h.document.activeElement,h.ids.get('navigation-title'));
 assert.equal(h.ids.get('next').disabled,false);
 h.cleanup();
});

test('returning to intro restores fixed Start and re-arms the full 400 ms fade',async()=>{
 const h=fixture({personal:true});await settle();
 assert.equal(opening(h).classList.contains('is-restored'),false);
 h.documentEvent('keydown',{key:'Escape'});await h.next();assert.equal(h.active(),'navigation');
 await h.back();assertFinal(h);
 assert.equal(opening(h).classList.contains('is-restored'),true);
 assert.match(read('welcome.css'),/\.intro-layer\.is-restored\s*\{[^}]*\btransition\s*:\s*none\s*(?:[;}]|!important)/);
 h.ids.get('intro-start').fire('click');await settle();
 assertLayerFade(h);assert.equal(opening(h).classList.contains('is-restored'),false);
 h.clock.advance(399);await settle();assert.equal(opening(h).hidden,false);
 h.clock.advance(1);await settle();assert.equal(opening(h).hidden,true);
 assert.equal(h.active(),'navigation');h.cleanup();
});

test('delayed saved Still preferences mount pose zero but never queue rAF or idle before or after loading',async t=>{
 let release;const gate=new Promise(resolve=>release=resolve);
 const h=fixture({preferenceRead:gate,savedValues:{'reserve:appearance':{theme:'light',motion:'still',nightArt:0,pet:true}}});
 t.after(()=>{release();h.cleanup();});await settle();
 assert.equal(calls(h,'mount').length,1);assert.equal(pose(h)?.t,0,'the drawing mounts immediately while preferences load');
 assert.equal(h.clock.requestedFrames,0,'a saved Still preference must not allow even one startup rAF');
 noFilmWork(h,'preferences still loading');
 h.clock.advance(10000);await settle();
 assert.equal(pose(h)?.t,0);assert.equal(calls(h,'idle').length,0);
 release();await settle();assertFinal(h);
 assert.equal(h.clock.requestedFrames,0);noFilmWork(h,'loaded saved Still');
 h.clock.advance(10000);assert.equal(calls(h,'idle').length,0);
});

test('skipping while saved Still preferences are delayed cannot start idle before their result is known',async t=>{
 let release;const gate=new Promise(resolve=>release=resolve);
 const h=fixture({preferenceRead:gate,savedValues:{'reserve:appearance':{theme:'light',motion:'still',nightArt:0,pet:true}}});
 t.after(()=>{release();h.cleanup();});await settle();h.documentEvent('keydown',{key:'Escape'});assertFinal(h);
 h.clock.advance(500);await settle();
 assert.equal(calls(h,'idle').length,0,'a pre-load skip cannot run twinkle against an unknown preference');
 assert.equal(h.clock.requestedFrames,0);release();await settle();
 assertFinal(h);noFilmWork(h,'saved Still after an early skip');
 h.clock.advance(10000);assert.equal(calls(h,'idle').length,0);
});

test('a delayed preference-load failure releases the motion gate and starts fallback playback',async t=>{
 let release;const gate=new Promise(resolve=>release=resolve);
 const h=fixture({preferenceRead:gate,preferenceFails:true});t.after(()=>{release();h.cleanup();});await settle();
 assert.equal(h.clock.requestedFrames,0,'fallback also waits for the preference result');
 h.clock.advance(5000);await settle();assert.equal(pose(h)?.t,0);assert.equal(calls(h,'idle').length,0);
 release();await settle();assert.equal(h.clock.frameCount,1,'failed preferences must not leave playback waiting forever');
 h.clock.advance(500);await settle();
 assert.ok(pose(h).t>=.45&&pose(h).t<=.501,'fallback starts from zero after the failed load');
 await complete(h);assertFinal(h);h.clock.advance(250);assert.ok(calls(h,'idle').length>0);
});

test('OS reduced motion or an initial Still dataset mounts END immediately without rAF or idle',async()=>{
 for(const options of [{reduced:true},{still:true,savedValues:{'reserve:appearance':{theme:'light',motion:'still',nightArt:0,pet:true}}}]){
  const h=fixture(options);await settle();assert.equal(calls(h,'mount').length,1);assertFinal(h);
  assert.ok(calls(h,'setT').every(call=>call.t===INTRO_END),'no intermediate opening poses are drawn');
  assert.equal(h.clock.requestedFrames,0);assert.equal(h.animations.length,0);noFilmWork(h,'reduced startup');
  h.clock.advance(10000);assert.equal(calls(h,'idle').length,0);
  for(let i=0;i<4;i++)await h.next();assert.equal(h.active(),'companion');
  assert.equal(h.animations.length,0);noFilmWork(h,'reduced later steps');h.cleanup();
 }
});

test('saved Still preference settles an initialized opening and cancels every active effect',async()=>{
 const h=fixture({savedValues:{'reserve:appearance':{theme:'light',motion:'still',nightArt:0,pet:true}}});await settle();
 assert.equal(h.ids.get('tour').dataset.still,'true');assertFinal(h);
 assert.ok(h.animations.every(a=>a.cancelled));noFilmWork(h,'saved Still');
 h.clock.advance(10000);assert.equal(calls(h,'idle').length,0);h.cleanup();
});

test('reducing motion during playback or idle settles and stops future opening work',async()=>{
 for(const at of [500,INTRO_READY*1000+100,INTRO_END*1000+500]){
  const h=fixture();await settle();h.clock.advance(at);await settle();h.setReduced(true);await settle();
  assertFinal(h);noFilmWork(h,'new reduced-motion preference');
  const count=h.introCalls.length;h.clock.advance(10000);await settle();assert.equal(h.introCalls.length,count);h.cleanup();
 }
});

test('pagehide cancels playback and idle with no later generated-art calls',async()=>{
 for(const at of [500,INTRO_END*1000+500]){
  const h=fixture();await settle();h.clock.advance(at);await settle();
  assert.ok(calls(h,at<1000?'setT':'idle').length>0,'pagehide interrupts active generated-art work');
  h.cleanup();noFilmWork(h,'pagehide');
  const count=h.introCalls.length;h.clock.advance(10000);await settle();assert.equal(h.introCalls.length,count);
 }
});

test('art uses meet outside aspect ratios 1.25 to 2.1 and slice within them, keeping Start aligned on resize',async()=>{
 for(const [width,height,want] of [[320,640,'meet'],[999,800,'meet'],[1000,800,'slice'],[1600,900,'slice'],[1680,800,'slice'],[1681,800,'meet'],[2560,900,'meet']]){
  const h=fixture({width,height});await settle();const svg=opening(h).querySelector('svg.intro-art');assert.ok(svg);
  assert.equal(svg.getAttribute('preserveAspectRatio'),'xMidYMid '+want);
  assertOverlay(h);
  h.resize(600,900);assert.equal(svg.getAttribute('preserveAspectRatio'),'xMidYMid meet');
  assertOverlay(h);
  h.resize(1500,900);assert.equal(svg.getAttribute('preserveAspectRatio'),'xMidYMid slice');
  assertOverlay(h);
  h.resize(2560,900);assert.equal(svg.getAttribute('preserveAspectRatio'),'xMidYMid meet');assertOverlay(h);
  assert.equal(calls(h,'mount').length,1,'resize changes framing without remounting');h.cleanup();
 }
});

test('old course drawings, flying minis and header-logo opening animations are absent',async()=>{
 const h=fixture();await settle();await complete(h);
 for(let i=0;i<4;i++)await h.next();
 assert.equal(h.artCalls.length,0,'the tour never requests any course art');
 assert.doesNotMatch(read('welcome.js'),/ReserveCourseArt|folio-home|renderArtwork|data-course-minis/);
 assert.equal(h.ids.get('home-scene')?.querySelectorAll('svg').length||0,0);
 for(const id of ['light-banner','dark-banner','menu-banner']){
  assert.equal(h.ids.has(id),false,id+' is removed');
 }
 assert.equal(h.artCalls.filter(call=>call.method==='mini'&&call.options?.place==='welcome-opening').length,0);
 assert.equal(h.document.querySelectorAll('.opening-subject').length,0);
 const logo=h.ids.get('brand-logo');assert.ok(logo,'static header mark remains');
 assert.equal(h.animations.filter(a=>a.node===logo||a.node.closest?.('#brand-logo')).length,0,'header mark never hosts the opening animation');
 assert.equal(h.animations.filter(a=>/^tour-(logo-settle|hammer-strike|ring-split|subject-flight)$/.test(a.id)).length,0);h.cleanup();
});

test('the actual generated script loads in document order and poses its real SVG through END',async()=>{
 const h=fixture({actualIntro:true});await settle();
 assert.ok(h.scripts.includes('welcome-intro.js'),'welcome.html loads the supplied local script');
 assert.ok(h.scripts.indexOf('welcome-intro.js')<h.scripts.indexOf('welcome.js'),'the drawing API exists before welcome starts');
 const svg=opening(h).querySelector('svg.intro-art');assert.ok(svg,'actual mount supplies its SVG');
 assert.equal(svg.getAttribute('viewBox'),'0 0 1600 900');
 const hammer=svg.querySelector('.hammer'),initial=hammer.getAttribute('transform');
 h.clock.advance(750);await settle();assert.notEqual(hammer.getAttribute('transform'),initial,'real setT poses the hammer');
 h.clock.advance(1500);await settle();assert.equal(svg.querySelector('.whole').style.display,'none');
 assert.equal(svg.querySelector('.broke').style.display,'');
 assert.ok(h.context.ReserveWelcomeIntro.READY<h.context.ReserveWelcomeIntro.END);
 h.clock.advance(h.context.ReserveWelcomeIntro.READY*1000-2250+30);await settle();assertReady(h);assertOverlay(h);
 assert.equal(h.document.activeElement,h.ids.get('intro-start'));
 assert.match(svg.querySelector('.startb').getAttribute('transform'),/^translate\(0 -3\)/,'real focus calls the supplied hover API and preserves the authored pose');
 assert.equal(svg.querySelector('.startb').style.display,'');assert.ok(Number(svg.querySelector('.blabel').getAttribute('opacity'))>0);
 h.clock.advance(500);await settle();
 assert.equal(h.ids.get('tour').dataset.opening,'false');assert.equal(opening(h).hidden,false);
 assert.equal(opening(h).classList.contains('is-settled'),true);
 const letters=svg.querySelectorAll('.hl');assert.ok(letters.length>0,'the real title contains authored letter rigs');
 assert.ok(letters.every(node=>node.style.display===''),'the real final title is assembled');
 assert.ok(Number(svg.querySelector('.wiper').getAttribute('width'))>0,'the painted word is revealed');h.cleanup();
});

test('the actual room module exports SVG schoolhouse art and promises for every camera/theme API',()=>{
 const source=read('welcome-room.js'),sandbox={};
 vm.runInNewContext(source,sandbox,{filename:'welcome-room.js'});
 const api=sandbox.ReserveWelcomeRoom;
 assert.equal(typeof api.mount,'function');
 assert.match(api.SCHOOLHOUSE,/<svg\b/);
 assert.match(api.SCHOOLHOUSE,/<\/svg>/);
 assert.ok(api.SCHOOLHOUSE.length>100,'the illustrated school start page is a real SVG');
 for(const name of ['ROOM','MEADOW','PC'])assert.ok(api.D[name],'exported art geometry includes '+name);
 assert.ok(source.includes('return {go,enter,setTheme,hover,plate,rect,idle,layout'),'the art controller exposes all promised methods');
});

test('in the room, theme choices switch the page palette at once (no per-frame palette fade) and call room.setTheme',async()=>{
 const h=fixture();await reachStep(h,'appearance');const root=h.document.documentElement;
 for(const theme of ['dark','light']){
  h.document.querySelector('[data-theme-choice="'+theme+'"]').fire('click');await settle();
  assert.equal(root.dataset.theme,theme);
  assert.ok(!h.animations.some(a=>a.id==='tour-nightfall'&&a.node===root),'no palette interpolation over the room');
  assert.equal(roomCalls(h,'setTheme').at(-1).theme,theme);
 }
 h.cleanup();
});

test('appearance offers no range control or slider overlay in either theme',async t=>{
 const h=fixture({reduced:true});t.after(()=>h.cleanup());await reachStep(h,'appearance');
 for(const theme of ['light','dark']){
  h.document.querySelector('[data-theme-choice="'+theme+'"]').fire('click');await settle();
  assert.equal(h.document.querySelector('input[type="range"]'),null);
  assert.equal(h.ids.has('night-control'),false);assert.equal(h.ids.has('night-art'),false);
 }
 assert.equal(roomCalls(h,'rect').some(call=>call.name==='slider'),false,'removed artwork never receives an overlay');
 assert.doesNotMatch(read('welcome.css'),/\.night-control\b|\.wr-slider\b/);
 assert.doesNotMatch(read('welcome.js'),/['"]night-(?:art|control)['"]|saveNight\b/);
});

test('theme writes preserve saved night artwork and default to Chalk without writes on entry or pagehide',async()=>{
 for(const saved of [undefined,{theme:'dark',nightArt:0},{theme:'dark',nightArt:73},{theme:'light',nightArt:100}]){
  const h=fixture({reduced:true,savedValues:saved?{'reserve:appearance':saved}:{}});await reachStep(h,'appearance');
  assert.equal(appearanceWrites(h).length,0,'visiting appearance does not save defaults over the existing settings');
  for(const theme of ['dark','light','dark']){
   h.document.querySelector('[data-theme-choice="'+theme+'"]').fire('click');await settle();
   const stored=h.storage['reserve:appearance'];assert.equal(stored.theme,theme);assert.equal(stored.nightArt,saved?.nightArt??0);
  }
  const writes=appearanceWrites(h).length;h.cleanup();await settle();h.clock.advance(1000);await settle();
  assert.equal(appearanceWrites(h).length,writes,'pagehide does not introduce a removed slider save');noFilmWork(h,'appearance cleanup');
 }
});

test('external artwork preferences survive later theme and pony writes',async t=>{
 const h=fixture({reduced:true,savedValues:{'reserve:appearance':{theme:'dark',nightArt:15}}});t.after(()=>h.cleanup());await reachStep(h,'appearance');
 await h.chrome.storage.local.set({'reserve:appearance':{theme:'dark',motion:'still',nightArt:86,pet:false}});await settle();
 h.document.querySelector('[data-theme-choice="light"]').fire('click');await settle();
 assert.deepEqual({...h.storage['reserve:appearance']},{theme:'light',motion:'still',nightArt:86,pet:false,sceneTheme:''});
 await h.next();const checkbox=h.ids.get('pet-enabled');checkbox.checked=true;checkbox.fire('change');await settle();
 assert.deepEqual({...h.storage['reserve:appearance']},{theme:'light',motion:'still',nightArt:86,pet:true,sceneTheme:''});
});

test('finish celebration starts only from the real finish-board and uses its top-center point',async()=>{
 const h=fixture();await reachStep(h,'companion');
 const layer=h.ids.get('finish-fx'),button=h.ids.get('finish-board');
 assert.equal(layer.getAttribute('aria-hidden'),'true');assert.equal(layer.hidden,true);
 assert.equal(h.finishCalls.length,0,'previous steps do not mount celebration art');
 button.getBoundingClientRect=()=>({left:713.5,top:682.25,width:207.5,height:48});
 button.fire('click');
 assert.deepEqual(h.finishCalls.map(call=>call.method),['mount','fire','setT']);
 assert.deepEqual(h.finishCalls[1],{method:'fire',x:817.25,y:682.25,at:h.clock.now});
 assert.equal(h.finishCalls[0].el,layer);
 assert.equal(layer.querySelectorAll('svg.finish-art').length,1);
 assert.equal(layer.hidden,false);assert.equal(h.finishCalls[2].t,0);
 assert.equal(h.opened.length,0);
 button.fire('click');assert.equal(h.finishCalls.length,3,'busy finish clicks cannot run twice');
 h.cleanup();await settle();assert.equal(layer.hidden,true);noFilmWork(h,'finish cleanup');
});

test('finish stamp fires at 260 ms and keeps Canvas opening 1.5 seconds after the click',async()=>{
 const h=fixture();await reachStep(h,'companion');
 const button=h.ids.get('finish-board'),start=h.clock.now;
 button.fire('click');await settle();
 h.clock.advance(259);assert.equal(button.classList.contains('is-stamped'),false);
 h.clock.advance(1);assert.equal(button.classList.contains('is-stamped'),true);
 h.clock.advance(219);assert.equal(button.classList.contains('is-stamped'),true);
 h.clock.advance(1);assert.equal(button.classList.contains('is-stamped'),false);
 h.clock.advance(1019);await settle();assert.equal(h.opened.length,0);
 h.clock.advance(1);await settle();assert.equal(h.opened.length,1);assert.equal(h.openedAt[0]-start,1500);
 assert.equal(h.ids.get('finish-fx').hidden,false);
 const roomIdles=roomCalls(h,'idle').length;
 h.clock.advance(1600);noFilmWork(h,'complete finish');
 assert.equal(roomCalls(h,'idle').length,roomIdles,'finished tours stop room idle while celebration ends');
 assert.equal(h.ids.get('finish-fx').hidden,true);h.cleanup();
});

test('finish art caps samples at 60 fps and stops at END',async()=>{
 for(const frameHz of [60,144,240]){
  const h=fixture({frameHz});await reachStep(h,'companion');
  h.ids.get('finish-board').fire('click');await settle();
  h.clock.advance(1500);await settle();h.clock.advance(1600);
  const samples=h.finishCalls.filter(call=>call.method==='setT');
  assert.equal(samples[0].t,0);assert.equal(samples.at(-1).t,3);
  assert.ok(samples.every(call=>call.t>=0&&call.t<=3));assert.ok(samples.length<=182);
  for(let i=1;i<samples.length;i++)assert.ok(samples[i].at-samples[i-1].at>=1000/60-1e-7);
  assert.equal(h.ids.get('finish-fx').hidden,true);noFilmWork(h,'finish at '+frameHz+'Hz');
  h.cleanup();
 }
});

test('a 1.5 s finish delay counts from click even if school registration is still pending',async()=>{
 for(const readyAt of [900,1900]){
  const h=fixture();await reachStep(h,'school');
  h.ids.get('school-url').value='https://canvas.school.edu';await h.next();
  await h.next();await h.next();assert.equal(h.active(),'companion');
  assert.equal(h.requests.length,1);
  let resolve;h.chrome.runtime.sendMessage=()=>new Promise(done=>{resolve=done;});
  const start=h.clock.now;h.ids.get('finish-board').fire('click');await settle();
  h.clock.advance(readyAt);await settle();assert.equal(h.opened.length,0);
  resolve({ok:true,origin:'https://canvas.school.edu'});await settle();
  if(readyAt<1500){h.clock.advance(1500-readyAt-1);await settle();assert.equal(h.opened.length,0);h.clock.advance(1);await settle();}
  assert.equal(h.opened.length,1);
  assert.equal(h.openedAt[0]-start,Math.max(readyAt,1500));
  assert.equal(h.requests.length,1);h.cleanup();
 }
});

test('reduced motion skips finish animation and opens the approved Canvas immediately',async()=>{
 for(const options of [{reduced:true},{savedValues:{'reserve:appearance':{motion:'still',pet:true}}}]){
  const h=fixture(options);await reachStep(h,'companion');
  const start=h.clock.now;h.ids.get('finish-board').fire('click');await settle();
  assert.equal(h.opened.length,1);assert.equal(h.openedAt[0],start);
  assert.equal(h.finishCalls.length,0);
  assert.equal(h.ids.get('finish-fx').hidden,true);
  assert.equal(h.ids.get('finish-board').classList.contains('is-stamped'),false);h.cleanup();
 }
});

test('reducing motion during the finish stamp releases the opening delay',async()=>{
 const h=fixture();await reachStep(h,'companion');
 const start=h.clock.now;h.ids.get('finish-board').fire('click');await settle();h.clock.advance(300);
 assert.equal(h.ids.get('finish-board').classList.contains('is-stamped'),true);
 h.setReduced(true);await settle();
 assert.equal(h.ids.get('finish-fx').hidden,true);
 assert.equal(h.ids.get('finish-board').classList.contains('is-stamped'),false);
 assert.equal(h.opened.length,1);assert.equal(h.openedAt[0]-start,300);
 noFilmWork(h,'reduced while finishing');h.cleanup();
});

test('open failures cancel celebration work and allow replay without remounting',async()=>{
 for(const failure of ['result','registration','tab']){
  const h=fixture({openFails:failure==='tab'});await reachStep(h,'companion');
  const School=h.context.ReserveSchool;
  if(failure!=='tab')h.context.ReserveSchool={...School,open:()=>failure==='result'?Promise.resolve({ok:false,message:'Could not open Canvas'}):Promise.reject(Error('Registration failed'))};
  h.ids.get('finish-board').fire('click');await settle();
  if(failure==='tab'){h.clock.advance(1500);await settle();}
  assert.equal(h.ids.get('finish-fx').hidden,true);
  assert.equal(h.ids.get('finish-board').disabled,false);
  assert.equal(h.ids.get('status').dataset.tone,'error');
  assert.equal(h.opened.length,0);
  const count=h.finishCalls.length;h.clock.advance(4000);assert.equal(h.finishCalls.length,count);
  h.context.ReserveSchool=School;h.setOpenFails(false);
  h.ids.get('finish-board').fire('click');await settle();
  assert.equal(h.finishCalls.filter(call=>call.method==='mount').length,1);
  assert.equal(h.finishCalls.filter(call=>call.method==='fire').length,2);
  h.clock.advance(1500);await settle();assert.equal(h.opened.length,1);
  h.clock.advance(1600);noFilmWork(h,'replayed finish');h.cleanup();
 }
});

test('a validated origin survives intervening edits and remains retryable after a failed tab open',async()=>{
 const h=fixture({reduced:true,openFails:true});await reachStep(h,'school');
 h.ids.get('school-url').value='https://chosen.school.edu/canvas';await h.next();
 h.ids.get('school-url').value='https://changed.school.edu';
 await h.next();await h.next();assert.equal(h.active(),'companion');
 h.ids.get('finish-board').fire('click');await settle();
 assert.equal(h.opened.length,0);assert.equal(h.ids.get('finish-board').disabled,false);
 assert.match(h.ids.get('status').textContent,/could not|failed|try again/i);
 h.setOpenFails(false);h.ids.get('finish-board').fire('click');await settle();
 assert.equal(h.opened[0].url,'https://chosen.school.edu/?reserve=open');
 assert.equal(h.ids.get('tour').dataset.finished,'true');h.cleanup();
});

test('the full tour preserves school, four menu layouts, theme and pony toggle settings',async()=>{
 const h=fixture({reduced:true});await reachStep(h,'school');
 const school=h.ids.get('school-url');school.value='http://unsafe.school.edu';await h.next();
 assert.equal(school.getAttribute('aria-invalid'),'true');assert.equal(h.requests.length,0);
 school.value='https://canvas.school.edu';await h.next();
 assert.equal(h.requests.length,1);assert.equal(h.storage['reserve:school'],'https://canvas.school.edu');
 assert.equal(h.active(),'navigation');
 for(const choice of ['drawn','shown','top','original']){
  h.document.querySelector('[data-nav-choice="'+choice+'"]').fire('click');await settle();
  assert.equal(h.storage['reserve:canvasNav'],choice);
  assert.equal(h.ids.get('menu-demo').dataset.layout,choice);
 }
 await h.next();assert.equal(h.active(),'appearance');
 h.document.querySelector('[data-theme-choice="dark"]').fire('click');await settle();
 assert.equal(h.storage['reserve:appearance'].theme,'dark');
 await h.next();assert.equal(h.active(),'companion');
 const pony=h.ids.get('pet-enabled');pony.checked=false;pony.fire('change',{target:pony});await settle();
 assert.equal(h.storage['reserve:appearance'].pet,false);
 pony.checked=true;pony.fire('change',{target:pony});await settle();
 assert.equal(h.storage['reserve:appearance'].pet,true);
 assert.equal(h.opened.length,0);h.cleanup();
});

test('progress rivets mark only earlier steps done and the active step current, forward and back',async()=>{
 for(const personal of [false,true]){
  const h=fixture({reduced:true,personal});await settle();
  const steps=[...(personal?[]:['school']),'navigation','appearance','companion'];
  const band=h.ids.get('progress-band'),count=h.ids.get('step-count');
  const rivets=band.querySelectorAll('.wr-rivet');
  assert.equal(band.querySelectorAll('.wr-progress').length,1);
  assert.equal(rivets.length,steps.length);
  assert.equal(band.getAttribute('aria-hidden'),'true');
  assert.equal(count.classList.contains('sr-only'),true);
  assert.equal(count.getAttribute('aria-live'),'polite');
  assert.equal(count.getAttribute('aria-atomic'),'true');
  function marks(current){
   assert.equal(count.textContent,'Step '+(current+1)+' of '+steps.length);
   rivets.forEach((rivet,k)=>{
    assert.equal(rivet.classList.contains('is-done'),k<current,'done rivet '+k+' at '+h.active());
    assert.equal(rivet.classList.contains('is-current'),k===current,'current rivet '+k+' at '+h.active());
   });
  }
  marks(0);
  for(const [k,name] of steps.entries()){
   await h.next();assert.equal(h.active(),name);marks(k);
  }
  for(let k=steps.length-2;k>=0;k--){
   await h.back();assert.equal(h.active(),steps[k]);marks(k);
  }
  if(personal){await h.back();assert.equal(h.active(),'intro');marks(0);}
  h.cleanup();
 }
});

test('footer straps use supplied SVGs with native accessible buttons and no paper outlines',async()=>{
 const h=fixture({reduced:true});await reachStep(h,'navigation');
 for(const [id,label] of [['back','Back'],['next','Next']]){
  const button=h.ids.get(id);
  assert.equal(button.tagName,'BUTTON');assert.equal(button.type,'button');
  assert.equal(button.className,'wr-strap-button');
  assert.equal(button.getAttribute('aria-label'),label);
  assert.equal(button.innerHTML,roomUI[id].replace('{LABEL}',label));
  assert.equal(button.querySelectorAll('svg.wr-strap').length,1);
  assert.equal(button.querySelector('svg').getAttribute('aria-hidden'),'true');
  assert.equal(button.querySelector('.pen-outline'),null);
  assert.equal(button.disabled,false);
 }
 await h.next();assert.equal(h.active(),'appearance');
 assert.equal(h.ids.get('next').hidden,true);
 assert.equal(h.ids.get('back').hidden,false);
 await h.back();assert.equal(h.active(),'navigation');
 h.cleanup();
});

test('PC Back and Next sit in the content bottom corners 18 px inside its bounds and follow resize',async t=>{
 const h=fixture({reduced:true,width:1280,height:708});t.after(()=>h.cleanup());await reachStep(h,'school');
 const footer=h.document.querySelector('.tour-footer'),css=read('welcome.css');
 for(const name of ['school','navigation']){
  if(name==='navigation')await h.next();
  for(const [width,height] of [[1280,708],[960,720],[1600,900]]){
   h.resize(width,height);const content=h.room.rect('content');
   assert.equal(footer.hidden,false);assert.equal(footer.classList.contains('is-pc'),true);
   const ui=Math.max(1,Math.min(1.6,Math.min(width/1280,height/800)));
   const want={left:content.left+18*ui,top:content.top+content.height-(18+44)*ui,width:content.width-36*ui,height:44*ui};
   for(const [key,value] of Object.entries(want))assert.ok(Math.abs(parseFloat(footer.style[key])-value)<1e-7,key+' is anchored to content, not the outer bezel');
  }
 }
 assert.equal(cssRule(css,'.tour-footer.is-pc').padding,'0');
 assert.equal(cssRule(css,'.tour-footer.is-pc>.wr-strap-button').height,'calc(44px*var(--ui,1))');
 assert.equal(cssRule(css,'#back')['grid-column'],'1');assert.equal(cssRule(css,'#back')['justify-self'],'start');
 assert.equal(cssRule(css,'#next')['grid-column'],'3');assert.equal(cssRule(css,'#next')['justify-self'],'end');
 await h.next();assert.equal(h.active(),'appearance');assert.equal(footer.classList.contains('is-pc'),false);
 for(const key of ['left','top','width','height'])assert.equal(footer.style[key],'','non-PC steps clear the content geometry');
});

test('all four picture choices use generated layout art, named buttons, exclusive pressed state and a one-line description',async t=>{
 const h=fixture({reduced:true,width:1280,height:708});t.after(()=>h.cleanup());await reachStep(h,'navigation');
 const choices=h.document.querySelectorAll('[data-nav-choice]');assert.equal(choices.length,4);
 const descriptions={drawn:'Move to the left edge to reveal the menu.',shown:'The whole menu stays in view on the left.',top:'Your menu runs across the top.',original:'Keep Canvas’s original dark menu.'};
 const labels={drawn:'From the left edge',shown:'Full height',top:'Across the top',original:'Canvas’s own'};
 for(const [value,label] of Object.entries(labels)){
  const button=h.document.querySelector('[data-nav-choice="'+value+'"]');
  assert.equal(button.tagName,'BUTTON');assert.equal(button.type,'button');assert.equal(button.classList.contains('wr-choice'),true);
  assert.equal(button.querySelector('span').textContent,label);
  assert.equal(button.insertedHTML,roomUI.layouts[value],'the option uses its supplied drawing without regenerated approximations');
  assert.equal(button.querySelectorAll('svg.wr-layout').length,1);assert.ok(button.querySelector('.wr-sel'));
  assert.equal(button.querySelector('svg').getAttribute('aria-hidden'),'true');assert.equal(button.querySelector('.pen-outline'),null);assert.equal(button.querySelector('.choice-tick'),null);
  button.focus();assert.equal(h.document.activeElement,button);button.fire('click');await settle();
  assert.equal(h.storage['reserve:canvasNav'],value);assert.equal(h.ids.get('menu-demo').dataset.layout,value);
  for(const other of choices){const selected=other===button;assert.equal(other.getAttribute('aria-pressed'),String(selected));assert.equal(other.classList.contains('is-selected'),selected);}
  const description=h.ids.get('nav-description');assert.equal(description.textContent,descriptions[value]);assert.equal(description.getAttribute('aria-live'),'polite');assert.doesNotMatch(description.textContent,/[\r\n]/);
 }
});

test('navigation pictures form one centered row of 170 to 200 px choices within the 1280 by 708 PC content',()=>{
 const css=read('welcome.css'),row=cssRule(css,'.nav-options'),choice=cssRule(css,'.nav-options .wr-choice'),picture=cssRule(css,'.nav-options .wr-layout');
 assert.equal(row.display,'flex');assert.equal(row['flex-wrap'],'nowrap');assert.equal(row['justify-content'],'center');
 const width=Number(choice.flex?.match(/([\d.]+)px$/)?.[1]),gap=parseFloat(row.gap);
 assert.ok(width>=170&&width<=200,'each authored picture has a readable laptop-size basis');assert.ok(parseFloat(choice['max-width'])<=200);assert.equal(choice['min-width'],'0');
 assert.ok(width*4+gap*3<1235.2-96,'four choices and their gaps fit the laptop content after horizontal padding');
 assert.ok(parseFloat(picture['max-height'])<=100,'pictures reserve vertical space for the preview and description');
 assert.equal(picture.width,'100%');
 assert.match(cssRule(read('welcome-room.css'),'.wr-choice:focus-visible').outline||'',/2px solid/);
});

test('navigation demo animates authored x-* icon parts and FLIP layout changes',async()=>{
 const h=fixture();await reachStep(h,'navigation');
 h.clock.advance(700);await settle();
 const pointer=h.ids.get('menu-demo').querySelector('.demo-pointer');
 assert.ok(h.animations.some(a=>a.id==='tour-menu-pointer'&&a.node===pointer));
 assert.ok(h.animations.some(a=>a.id==='tour-nav-hover'));
 h.document.querySelector('[data-nav-choice="top"]').fire('click');await settle();
 assert.equal(h.ids.get('menu-demo').dataset.layout,'top');
 assert.ok(h.animations.some(a=>a.id==='tour-menu-layout'));
 h.cleanup();
});

test('pony gait, cheer, exit and return stay tied to the visible film clock',async()=>{
 const h=fixture();await reachStep(h,'companion');
 assert.ok(h.animations.some(a=>a.id==='tour-pony-travel'));
 h.clock.advance(540);await settle();
 const foreleg=h.ids.get('tour-pet').querySelector('.pet-leg.lf');
 assert.match(foreleg.style.transform,/rotate\(/);
 h.clock.advance(2600);await settle();
 assert.equal(h.ids.get('tour-pet').dataset.pose,'cheer');
 h.clock.advance(1500);await settle();assert.equal(h.ids.get('tour-pet').dataset.pose,'stand');
 const checkbox=h.ids.get('pet-enabled');checkbox.checked=false;checkbox.fire('change');await settle();
 h.clock.advance(2100);await settle();
 assert.equal(h.ids.get('meadow').classList.contains('is-off'),true);
 checkbox.checked=true;checkbox.fire('change');await settle();h.clock.advance(550);
 assert.equal(h.ids.get('tour-pet').dataset.pose,'trot');
 h.clock.advance(1450);assert.equal(h.ids.get('meadow').classList.contains('is-arrived'),true);
 assert.equal(h.storage['reserve:appearance'].pet,true);h.cleanup();
});

test('interrupting a pony walk preserves its translation from the positioned room baseline in both themes',async t=>{
 for(const theme of ['light','dark']){
  const h=fixture({width:1280,height:708,savedValues:{'reserve:appearance':{theme}}});t.after(()=>h.cleanup());await reachStep(h,'companion');
  h.clock.advance(450);await settle();
  const actor=h.ids.get('pet-actor'),translation=-137.25;
  actor.getBoundingClientRect=()=>({left:parseFloat(actor.style.left)+translation,top:parseFloat(actor.style.top),width:parseFloat(actor.style.width),height:parseFloat(actor.style.height)});
  const before=h.animations.length,checkbox=h.ids.get('pet-enabled');checkbox.checked=false;checkbox.fire('change');await settle();
  const travel=h.animations.slice(before).find(a=>a.node===actor&&a.frames.some(frame=>Object.hasOwn(frame,'transform')));
  assert.ok(travel);assert.equal(travel.frames[0].transform,'translateX(-137.25px)',theme+' interruption keeps the rendered position without a jump');
 }
});

for(const outcome of ['success','failure'])test('saving the focused pony switch restores keyboard focus after browser blur on '+outcome,async t=>{
 const h=fixture({reduced:true});t.after(()=>h.cleanup());await reachStep(h,'companion');
 const checkbox=h.ids.get('pet-enabled');let disabled=checkbox.disabled,blurs=0;
 Object.defineProperty(checkbox,'disabled',{get:()=>disabled,set:value=>{disabled=!!value;if(disabled&&h.document.activeElement===checkbox){h.document.activeElement=null;blurs++;}}});
 if(outcome==='failure'){
  const set=h.chrome.storage.local.set;h.chrome.storage.local.set=async values=>{if(Object.hasOwn(values,'reserve:appearance'))throw Error('Save failed');return set(values);};
 }
 checkbox.focus();checkbox.checked=false;checkbox.fire('change');
 assert.equal(blurs,1,'disabling the focused native input simulates the browser blur');assert.notEqual(h.document.activeElement,checkbox);
 await settle();assert.equal(checkbox.disabled,false);assert.equal(h.document.activeElement?.id,'pet-enabled','unlocking the switch restores focus for keyboard continuation');
 assert.equal(checkbox.checked,outcome==='failure');assert.equal(h.ids.get('pet-switch').classList.contains('is-on'),checkbox.checked);
 if(outcome==='failure')assert.match(h.ids.get('status').textContent,/Could not save your pony setting/);
});

test('the welcome uses a decorative logo, hidden product name and drawn progress with every layout control',()=>{
 const html=read('welcome.html'),js=read('welcome.js'),css=read('welcome.css');
 const h=fixture({reduced:true}),brand=h.document.querySelector('.tour-brand');
 assert.equal(brand.getAttribute('aria-hidden'),'true');
 assert.equal(brand.children.length,1);assert.equal(brand.firstElementChild.id,'brand-logo');
 assert.equal(h.ids.get('product-name').classList.contains('sr-only'),true);
 assert.equal(h.ids.get('product-name').closest('[aria-hidden="true"]'),null);
 assert.equal(h.document.querySelectorAll('#product-name').length,1);
 assert.equal(h.ids.get('product-name').textContent,'Canvas Harness');
 assert.match(js,/UI\.progress\(stepNames\.length-1\)/);
 assert.doesNotMatch(html+js+css,/progress-ink|progress-line|progress-guide|next-label|back-button|next-button/);
 assert.doesNotMatch(css,/\.tour-brand[^{}]*\{[^}]*background|\.tour-progress[^{}]*\{[^}]*background/);
 assert.match(css,/@media\(max-width:759px\)\{\s*\.tour-footer>\.wr-strap-button\{width:114px;height:38px\}/);
 assert.match(read('welcome-room.css'),/\.wr-strap-button\{[^}]*width:132px;height:44px/);
 for(const choice of ['drawn','shown','top','original'])assert.match(html,new RegExp('data-nav-choice="'+choice+'"'));
 for(const theme of ['light','dark'])assert.match(html,new RegExp('data-theme-choice="'+theme+'"'));
 assert.match(html,/id="finish-board"[^>]*aria-label="Open my Canvas"/);
 assert.match(html,/id="school-form"/);
 assert.match(html,/id="school-start-page"/);
 assert.match(html,/id="room-stage"[^>]*aria-hidden="true"/);
 h.cleanup();
});

test('all four Canvas navigation layouts reuse their supplied SVG rigs',()=>{
 const html=read('welcome.html'),js=read('welcome.js');
 const kinds=[...html.matchAll(/data-demo-icon="([a-z]+)"/g)].map(([,kind])=>kind);
 assert.ok(kinds.length>=5);
 for(const kind of kinds){
  const drawing=Nav.DRAWINGS[kind];assert.ok(drawing,kind+' is a live menu drawing');
  assert.ok(html.replace(/>\s+</g,'><').includes(drawing.replace(/>\s+</g,'><')),kind+' uses the actual exported drawing');
 }
 assert.match(js,/function renderMenuArt\(/);
 assert.match(js,/function animateMenuLayout\(/);
 assert.match(js,/tour-menu-layout/);
 assert.match(js,/\.x-(?:needle|lean|rings|circle|flag|wave)/);
});

test('pony SVG keeps rigged legs, tail and blinking eyes and a persistent saved toggle',()=>{
 const art=read('pet-art.js'),js=read('welcome.js');
 const svg=require('../extension/pet-art.js').svg();
 for(const part of ['pet-leg','pet-tail','pet-eye','pet-lid'])
  assert.match(svg,new RegExp('class="[^"]*\\b'+part+'\\b'));
 assert.match(art,/transform-origin/);
 for(const fn of ['paintPony','enterPony','setPonyEnabled'])assert.match(js,new RegExp('function '+fn+'\\('));
 assert.match(js,/prefs\.set\(\{pet:value\}\)/);
 assert.match(js,/pony-cheer/);assert.match(js,/dataset\.pose='cheer'/);
 assert.match(js,/dataset\.finished='true'/);
});

test('picture choices keep visible focus and the built-in menu preview without legacy pen decorations',async()=>{
 const h=fixture();await reachStep(h,'navigation');
 const top=h.document.querySelector('[data-nav-choice="top"]');
 top.fire('pointerenter');
 top.focus();assert.equal(h.document.activeElement,top);assert.ok(top.querySelector('svg.wr-layout'));
 assert.equal(top.querySelector('.pen-outline'),null);
 top.fire('click');await settle();
 assert.equal(top.querySelector('.choice-tick'),null);assert.ok(top.querySelector('.wr-sel'));
 assert.equal(top.getAttribute('aria-pressed'),'true');
 assert.equal(h.ids.get('menu-demo').dataset.layout,'top');
 assert.equal(h.artCalls.length,0,'no legacy course art is ever requested');
 h.cleanup();
});
