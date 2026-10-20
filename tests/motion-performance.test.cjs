'use strict';

// Synthetic DOM/WAAPI in a VM: no browser, account, dependencies, real timers or production test hooks.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../extension/motion.js'),'utf8'),plain=value=>JSON.parse(JSON.stringify(value));
function fixture({motion='gentle',vars=false}={}){
 const events=[],animations=[],microtasks=[],ceilings=[],intervals=new Map(),media={matches:false};let clock=100,serial=0;
 const math=Object.create(Math);math.ceil=value=>{ceilings.push(value);return Math.ceil(value);};
 const log=(kind,type,node,extra={})=>events.push({kind,type,node:node?.name,...extra});
 const split=(s,separator)=>{let depth=0,start=0;const out=[];for(let i=0;i<s.length;i++){if('(['.includes(s[i]))depth++;if(')]'.includes(s[i]))depth--;if(!depth&&separator(s[i])){if(s.slice(start,i).trim())out.push(s.slice(start,i).trim());start=i+1;}}if(s.slice(start).trim())out.push(s.slice(start).trim());return out;};
 function matches(node,selector,scope=node){
  if(!node)return false;const groups=split(selector,c=>c===',');if(groups.length>1)return groups.some(s=>matches(node,s,scope));
  const child=split(selector,c=>c==='>');if(child.length>1)return matches(node,child.pop(),scope)&&matches(node.parentNode,child.join('>'),scope);
  const parts=split(selector,c=>/\s/.test(c));if(parts.length>1){if(!matches(node,parts.pop(),scope))return false;for(let p=node.parentNode;p;p=p.parentNode)if(matches(p,parts.join(' '),scope))return true;return false;}
  selector=selector.replace(/:(is|not)\(([^()]*)\)/g,(_,kind,s)=>(kind==='is'?matches(node,s,scope):!matches(node,s,scope))?'':'!');
  if(selector.includes(':scope')){if(node!==scope)return false;selector=selector.replace(':scope','');}if(/[:!]/.test(selector))return false;
  let valid=true;selector=selector.replace(/\[([\w-]+)(?:="([^"]*)")?\]/g,(_,key,value)=>{if(node.getAttribute(key)===null||value!==undefined&&node.getAttribute(key)!==value)valid=false;return '';});
  selector=selector.replace(/\.([\w-]+)/g,(_,c)=>{if(!node.classList.contains(c))valid=false;return '';});return valid&&(!selector||selector==='*'||node.tagName.toLowerCase()===selector.toLowerCase());
 }
 class Node{
  constructor(tag,name,attrs={}){
   this.tagName=tag.toUpperCase();this.name=name;this.attrs={...attrs};this.children=[];this.parentNode=null;this.played=[];this.computed={};this.textContent='';this.innerHTML='';this.outerHTML='<svg></svg>';this.isConnected=true;
   this.rect={left:0,top:20,width:300,height:100,right:300,bottom:120};this.bounds={x:0,y:0,width:30,height:30};this.total=100;this.layout={offsetLeft:0,offsetTop:0,offsetWidth:100,offsetHeight:40,clientWidth:100,scrollLeft:0};
   const values={};this.style=new Proxy({getPropertyValue:k=>values[k]||'',setProperty:(k,v)=>{values[k]=String(v);log('write','style',this,{key:k,value:String(v)});},removeProperty:k=>{delete values[k];log('write','style',this,{key:k});}},{get:(o,k)=>k in o?o[k]:values[k]||'',set:(o,k,v)=>{values[k]=v;log('write','style',this,{key:k,value:v});return true;}});
   this.dataset=new Proxy({},{get:(_,k)=>this.attrs['data-'+String(k).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())],set:(_,k,v)=>{this.attrs['data-'+String(k).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())]=String(v);log('write','dataset',this,{key:k,value:v});return true;},deleteProperty:(_,k)=>{delete this.attrs['data-'+String(k).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())];log('write','dataset',this,{key:k});return true;}});
   this.classList={contains:c=>(this.attrs.class||'').split(/\s+/).includes(c)};
  }
  get parentElement(){return this.parentNode;}get offsetParent(){log('read','offsetParent',this);return this.parentNode;}
  append(...nodes){for(const n of nodes){this.children.push(n);n.parentNode=this;}}
  getAttribute(k){return this.attrs[k]??null;}setAttribute(k,v){this.attrs[k]=String(v);}
  contains(node){for(let n=node;n;n=n.parentNode)if(n===this)return true;return false;}
  matches(s){return matches(this,s);}closest(s){for(let n=this;n;n=n.parentNode)if(matches(n,s))return n;return null;}
  querySelectorAll(s){const out=[];const walk=n=>{for(const c of n.children){if(matches(c,s,this))out.push(c);walk(c);}};walk(this);return out;}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  getBoundingClientRect(){log('read','rect',this);return {...this.rect};}getClientRects(){log('read','clientRects',this);return this.isConnected?[this.rect]:[];}
  getBBox(){log('read','bbox',this);if(this.failBox)throw Error('No box');return {...this.bounds};}
  getTotalLength(){log('read','length',this);if(this.failLength)throw Error('No length');return this.total;}
  getPointAtLength(t){log('read','point',this,{at:t});if(this.failPoint)throw Error('No point');return this.point?this.point(t):{x:t*.8,y:t*.6};}
  getAnimations(){log('read','animations',this);return this.played.filter(a=>a.playState!=='idle');}
  animate(frames,options){
   log('write','animate',this,{id:options.id});if(this.failAnimate)throw Error('Animation unavailable');
   let state='running',time=0;const handlers=new Map(),a={node:this,frames:plain(frames),options:plain(options),finished:new Promise(()=>{}),
    effect:{target:this,getComputedTiming:()=>{log('read','timing',this,{id:options.id});return {endTime:(options.delay||0)+(options.duration||0)*(options.iterations??1)};},getTiming:()=>options,getKeyframes:()=>frames},
    addEventListener:(type,fn)=>{if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(fn);},
    pause:()=>{state='paused';log('write','pause',this);},play:()=>{state='running';log('write','play',this);},
    cancel:()=>{state='idle';a.cancelled=true;Object.assign(this.computed,this.cancelReset);log('write','cancel',this);for(const fn of handlers.get('cancel')||[])fn();},finish:()=>{state='finished';}
   };
   Object.defineProperties(a,{playState:{get:()=>{log('read','state',this);return state;}},currentTime:{get:()=>{log('read','time',this);return time;},set:v=>{time=v;log('write','time',this,{value:v});}}});this.played.push(a);animations.push(a);return a;
  }
 }
 for(const key of ['offsetLeft','offsetTop','offsetWidth','offsetHeight','clientWidth','scrollLeft'])Object.defineProperty(Node.prototype,key,{get(){log('read',key,this);return this.layout[key];},set(v){this.layout[key]=v;log('write',key,this,{value:v});}});
 class SVGNode extends Node{}
 const make=(parent,tag,name,attrs={})=>{const n=new (['svg','path','g'].includes(tag)?SVGNode:Node)(tag,name,attrs);parent?.append(n);return n;};
 const container=make(null,'div','root',{class:'rd','data-input':'pointer','data-motion-style':motion}),shell=make(container,'div','shell',{class:'rd-shell'});
 const env=vm.createContext({module:{exports:{}},Math:math,performance:{now:()=>clock},innerHeight:1000,document:{visibilityState:'visible',addEventListener(){},removeEventListener(){}},addEventListener(){},removeEventListener(){},queueMicrotask:fn=>microtasks.push(fn),SVGElement:SVGNode,...(vars?{CSS:{registerProperty(){}}}:{}),
  getComputedStyle(node,pseudo){log('read','style',node,{pseudo});return {...{opacity:'1',transform:'none',visibility:'hidden',stroke:'black',strokeWidth:'1',strokeDasharray:'none',strokeDashoffset:'0',fill:'none',display:'inline',pointerEvents:'none'},...node.computed,getPropertyValue:k=>node.computed[k]||''};}});
 vm.runInContext(source,env,{filename:'extension/motion.js'});const Motion=env.module.exports,controller=Motion.create(container,{media,ResizeObserverImpl:null,IntersectionObserverImpl:null,setIntervalImpl:fn=>{const id=++serial;intervals.set(id,fn);return id;},clearIntervalImpl:id=>{intervals.delete(id);log('write','park',container);}});
 function row(name,selected=false){
  const rail=container.querySelector('.rd-course-rail')||make(shell,'div','rail',{class:'rd-course-rail'}),row=make(rail,'button',name,{class:'rd-rail-course','data-selected':String(selected)}),frame=make(row,'span',name+'.frame',{class:'rd-frame'});
  frame.computed={'--f-guide':'#bbc','--f-ink':'#335',color:'#335'};
  const main=make(frame,'svg',name+'.main',{class:'rd-frame-main'}),ink=make(main,'path',name+'.ink',{class:'rd-frame-ink',d:'M0 0L80 60'}),wash=make(frame,'span',name+'.wash',{class:'rd-frame-wash'});
  const extra=make(frame,'svg',name+'.extra',{class:'rd-frame-extra'});extra.style.setProperty('--at','.25');
  const extraInk=make(extra,'path',name+'.extraInk',{d:'M0 0L80 60'}),extraSecond=make(extra,'path',name+'.extraSecond',{d:'M0 0L40 30'});extraSecond.total=50;
  const dashed=make(extra,'path',name+'.dashed',{d:'M0 0L80 60'});dashed.computed.strokeDasharray='2 3';dashed.computed.opacity='.6';
  const ornament=make(frame,'svg',name+'.ornament',{class:'rd-frame-orn','data-o':'0'}),fill=make(ornament,'path',name+'.fill',{d:'M0 0L10 10'}),stroke=make(ornament,'path',name+'.stroke',{d:'M0 0L10 10'});
  fill.computed.fill='black';fill.computed.opacity='.8';const move=make(frame,'g',name+'.move',{class:'o-move'});move.computed.transform='matrix(1, 0, 0, 1, 2, 0)';
  return {row,frame,main,ink,wash,extra,extraInk,extraSecond,dashed,ornament,fill,stroke,move};
 }
 function select(from,to){const snap=controller.snapshot(to.row);from.row.attrs['data-selected']='false';to.row.attrs['data-selected']='true';return snap;}
 function art({mini=false,wide=false,loop=false}={}){
  const parent=make(shell,'div','artFrame',{class:mini?'rd-rail-art':'rd-heading-art'}),svg=make(parent,'svg','art',{class:mini?'rd-mini':'rd-art',viewBox:wide?'0 0 960 240':'0 0 480 240','data-wide':String(wide),'data-place':'heading','data-cycle':loop?'3':'0'});
  svg.rect={left:0,top:20,width:wide?960:360,height:240,right:wide?960:360,bottom:260};const parts={};
  for(const name of ['ground','key','wash','head','ink','dots','solid','grain']){const group=make(svg,'g',name,{class:'art-'+name});parts[name]=[];for(let i=0;i<(wide?2:1);i++){const p=make(group,'path',name+i,{d:'M0 0L80 60',opacity:name==='head'?'.7':'.9'});p.bounds={x:wide?(i?120:700):0,y:0,width:30,height:30};parts[name].push(p);}}
  if(loop)make(svg,'g','loop',{class:'art-loop','data-loop':'bob','data-period':'3'});
  container.dataset.entrance='';return {svg,parts};
 }
 return {Motion,controller,container,shell,make,row,select,art,events,animations,microtasks,ceilings,intervals,media,flush(){while(microtasks.length)microtasks.shift()();},tick(ms){clock+=ms;for(const fn of [...intervals.values()])fn();},reset(){events.length=ceilings.length=0;},finish(){for(const a of animations)a.finish();},advance(ms){clock+=ms;}};
}
const geometry=e=>e.kind==='read'&&['rect','bbox','length','point','style','offsetParent','offsetLeft','offsetTop','offsetWidth','offsetHeight'].includes(e.type);
function readsBeforeAnimation(events){const first=events.findIndex(e=>e.kind==='write'&&(e.type==='animate'||e.type==='style'));assert.ok(first>=0,'the pass actually starts animations');assert.deepEqual([...new Set(events.slice(first).filter(geometry).map(e=>e.type+':'+e.node))],[],'all style, bbox and length reads precede animation/style writes');}
const played=(f,id)=>f.animations.filter(a=>a.options.id===id);

test('rail relax and draw gather geometry before animation writes and keep their exact animation order',()=>{
 const f=fixture(),old=f.row('old',true),next=f.row('next');f.controller.place();const snap=f.select(old,next);old.ornament.computed.opacity='.2';old.ornament.computed.transform='matrix(1, 0, 0, 1, 0, 0)';f.reset();f.controller.place(true,snap);
 const a=played(f,'rd-frame');assert.deepEqual(a.map(a=>a.node.name),['old.ink','old.ornament','next.main','next.ink','next.extraInk','next.extraSecond','next.dashed','next.fill','next.stroke','next.move','next.wash']);
 assert.deepEqual(a.map(a=>a.options.duration),[280,240,660,660,450,450,370,350,240,320,300]);assert.equal(a.at(-1).options.delay,60);assert.ok(a.every(a=>a.options.fill==='backwards'));
 assert.deepEqual(a[1].frames,[{opacity:'1',transform:'none'},{opacity:'.2',transform:'matrix(1, 0, 0, 1, 0, 0)'}]);assert.equal(a[3].frames[0].strokeDashoffset,102);readsBeforeAnimation(f.events);f.controller.destroy();
});
test('interrupted frames read the current ink before cancellation and ornament styles after cancellation',()=>{
 const f=fixture({vars:true}),old=f.row('old',true),next=f.row('next');next.ornament.attrs.class+=' o-move';next.ornament.computed.transform='matrix(1, 0, 0, 1, 2, 0)';f.controller.place();f.controller.place(true,f.select(old,next));const prior=played(f,'rd-frame');
 next.ink.computed={visibility:'visible',strokeDasharray:'71 71',strokeDashoffset:'23'};next.ink.cancelReset={visibility:'hidden',strokeDashoffset:'0'};next.ornament.computed.opacity='.37';next.ornament.cancelReset={opacity:'.81'};
 const snap=f.select(next,old);f.reset();f.controller.place(true,snap);assert.ok(prior.every(a=>a.cancelled));const ink=played(f,'rd-frame').filter(a=>a.node===next.ink).at(-1),orn=played(f,'rd-frame').filter(a=>a.node===next.ornament).at(-1);
 assert.equal(ink.options.duration,160);assert.equal(ink.frames[0].strokeDasharray,'71 71');assert.equal(ink.frames[0].strokeDashoffset,'23');assert.equal(ink.frames[1].strokeDashoffset,'23');assert.equal(orn.frames[1]['--rd-op'],'.81');
 assert.ok(f.events.findIndex(e=>e.type==='style'&&e.node==='next.ink')<f.events.findIndex(e=>e.type==='cancel'&&e.node==='next.ink'));assert.equal(f.events.filter(e=>e.type==='length'&&e.node==='next.ink').length,0);readsBeforeAnimation(f.events.filter(e=>e.type!=='cancel'&&!(e.type==='style'&&e.kind==='write'&&f.events.indexOf(e)<f.events.findIndex(e=>e.type==='animate'))));f.controller.destroy();
});
test('stretched ink caches path samples across SVG sizes, invalidates changed d, and shares each SVG rect',()=>{
 const f=fixture(),a=f.row('a',true),b=f.row('b');f.controller.place();const choose=(from,to)=>{f.finish();f.controller.place(true,f.select(from,to));};f.reset();choose(a,b);
 const count=(node,type)=>f.events.filter(e=>e.node===node.name&&e.type===type).length;assert.equal(count(b.extra,'rect'),1,'both extra strokes reuse the same-pass SVG box');assert.equal(count(b.ink,'point'),161);assert.equal(count(b.extraInk,'length'),1);
 choose(b,a);choose(a,b);assert.equal(count(b.ink,'length'),1);assert.equal(count(b.ink,'point'),161);assert.equal(count(b.extraInk,'length'),1);
 b.ink.attrs.d='M0 0L160 120';b.ink.total=200;choose(b,a);assert.equal(count(b.ink,'length'),2);assert.equal(count(b.ink,'point'),322);
 b.main.rect.width=600;choose(a,b);assert.equal(count(b.ink,'length'),2);b.main.rect.height=200;choose(b,a);assert.equal(count(b.ink,'length'),2);assert.equal(count(b.ink,'point'),322,'resizing only scales the same own-unit samples');
 const unwind=played(f,'rd-frame').filter(x=>x.node===b.ink).at(-1);assert.equal(unwind.frames[0].strokeDasharray,'402 402');f.controller.destroy();
});
test('recent path data reuse samples across unlimited sizes while obsolete paths are bounded',()=>{
 const f=fixture(),a=f.row('a',true),b=f.row('b');let selected=a;f.controller.place();f.reset();const turn=()=>{const next=selected===a?b:a;f.finish();f.controller.place(true,f.select(selected,next));selected=next;},count=()=>f.events.filter(e=>e.node==='b.ink'&&e.type==='length').length;
 turn();b.main.rect.width=600;turn();assert.equal(count(),1);b.main.rect.width=300;turn();assert.equal(count(),1,'returning to the earlier rendered size needs no new samples');
 b.ink.attrs.d='M0 0L160 120';b.ink.total=200;turn();assert.equal(count(),2);b.ink.attrs.d='M0 0L80 60';b.ink.total=100;turn();assert.equal(count(),2,'earlier path data is still cached');
 for(let i=0;i<20;i++){b.main.rect.width=700+i;b.main.rect.height=100+i;turn();}assert.equal(count(),2,'new sizes never resample unchanged path data');for(let i=0;i<8;i++){b.ink.attrs.d='M0 0L'+(200+i)+' 60';turn();}const recent=count();turn();assert.equal(count(),recent,'the newest path is retained');b.ink.attrs.d='M0 0L80 60';turn();assert.equal(count(),recent+1,'obsolete path samples cannot accumulate indefinitely');f.controller.destroy();
});
test('cached curved paths use the original 160 intervals with exactly equal scaled lengths at every size',()=>{
 const f=fixture(),b=f.row('b'),point=t=>({x:t*.7+Math.sin(t/7)*3.5,y:t*.2+Math.cos(t/11)*9});b.ink.attrs.d='M0 9C20 25 70 10 100 0';b.ink.point=point;f.controller.place();let sampled=[];
 for(const [width,height]of [[300,100],[600,100],[300,200],[451.3,69.7],[0,100],[300,0],[960,240],[.001,.002],[300,100]]){b.row.attrs['data-selected']='false';const snap=f.controller.snapshot(b.row);b.row.attrs['data-selected']='true';b.main.rect.width=width;b.main.rect.height=height;f.finish();f.reset();f.controller.place(true,snap);let expected=0,a=point(0);for(let i=1;i<=160;i++){const p=point(100*i/160);expected+=Math.hypot((p.x-a.x)*(width/300),(p.y-a.y)*(height/100));a=p;}assert.equal(f.ceilings[0],expected,'the unrounded screen length is identical at '+width+' x '+height);const ink=played(f,'rd-frame').filter(a=>a.node===b.ink).at(-1);assert.equal(ink.frames[0].strokeDashoffset,Math.ceil(expected)+2);sampled.push(...f.events.filter(e=>e.node==='b.ink'&&e.type==='point').map(e=>e.at));}
 assert.deepEqual(sampled,Array.from({length:161},(_,i)=>100*i/160),'all sizes share the original equally spaced own-unit points');f.controller.destroy();
});
test('failed path geometry is retried and never caches partial or invalid samples',()=>{
 for(const failure of ['failLength','failPoint','invalidPoint']){const f=fixture(),a=f.row('a',true),b=f.row('b');f.controller.place();if(failure==='invalidPoint')b.ink.point=()=>({x:NaN,y:0});else b.ink[failure]=true;f.reset();f.controller.place(true,f.select(a,b));assert.equal(played(f,'rd-frame').some(a=>a.node===b.ink),false,'unavailable ink is skipped');b.ink.failLength=b.ink.failPoint=false;delete b.ink.point;f.finish();f.controller.place(true,f.select(b,a));f.finish();f.controller.place(true,f.select(a,b));const ink=played(f,'rd-frame').filter(a=>a.node===b.ink).at(-1);assert.equal(ink.frames[0].strokeDashoffset,102,'the next valid measurement recovers');f.reset();b.main.rect.width=600;f.finish();f.controller.place(true,f.select(b,a));assert.equal(f.events.filter(e=>e.node==='b.ink'&&['point','length'].includes(e.type)).length,0,'recovered samples remain reusable after resize');f.controller.destroy();}
});
for(const variant of [{},{wide:true},{mini:true},{vars:true}])test('art reveal batches bloom, pen and head geometry before writes '+JSON.stringify(variant),()=>{
 const f=fixture(variant),{parts}=f.art(variant);f.reset();f.controller.syncTabs();const a=played(f,'rd-art');assert.ok(a.length>=8);readsBeforeAnimation(f.events.filter(e=>e.node!=='shell'));
 const firstTiming=f.events.findIndex(e=>e.type==='timing'),lastWrite=f.events.findLastIndex(e=>e.type==='animate'&&e.id==='rd-art');assert.ok(firstTiming>lastWrite,'endOf reads real animations only after the queue flushes');
 assert.deepEqual(a.slice(0,8).map(a=>a.node.name),variant.mini?['ground0','key0','wash0','ink0','head0','dots0','grain0','solid0']:['ground0','key0','wash0','ink0','head0','dots0','solid0',...(variant.wide?['ground1']:['grain0'])]);
 assert.ok(a.every(a=>a.options.fill==='backwards'));assert.equal(a.find(a=>a.node===parts.head[0]).frames.at(-1)[variant.vars?'--rd-op':'opacity'],variant.vars?'0.7':.7);f.controller.destroy();
});
test('art head overlap, fallback, delays and loop handoff retain the reveal timing',()=>{
 const f=fixture(),{svg,parts}=f.art({loop:true});const other=f.make(parts.head[0].parentNode,'path','unmatched',{opacity:'.4'});other.bounds={x:200,y:0,width:10,height:10};f.reset();f.controller.syncTabs();
 const a=played(f,'rd-art'),ink=a.find(a=>a.node===parts.ink[0]),head=a.find(a=>a.node===parts.head[0]),fallback=a.find(a=>a.node===other),grain=a.find(a=>a.node===parts.grain[0]);
 assert.deepEqual(ink.options,{duration:1636,delay:346,easing:f.Motion.easings.pen,id:'rd-art',fill:'backwards'});assert.equal(head.options.delay,837);assert.equal(fallback.options.delay,320);assert.equal(grain.options.delay,1982);assert.equal(grain.options.duration,400);
 const loop=played(f,'rd-art-loop');assert.equal(loop.length,1);assert.equal(loop[0].options.delay,2382);assert.equal(loop[0].currentTime,0);assert.equal(loop[0].playState,'paused');
 assert.ok(f.events.findIndex(e=>e.type==='animate'&&e.id==='rd-art-loop')>f.events.findLastIndex(e=>e.type==='timing'&&e.id==='rd-art'));assert.equal(svg.style.getPropertyValue('opacity'),'');f.controller.destroy();
});
test('a failed animation or unavailable bbox does not stop the rest of the reveal queue',()=>{
 const f=fixture({vars:true}),{parts}=f.art();parts.key[0].failAnimate=true;parts.head[0].failBox=true;f.reset();f.controller.syncTabs();const a=played(f,'rd-art');assert.equal(a.some(a=>a.node===parts.key[0]),false);assert.ok(a.some(a=>a.node===parts.grain[0]));assert.equal(a.find(a=>a.node===parts.head[0]).options.delay,320);assert.equal(parts.key[0].style.getPropertyValue('--rd-tf'),'');f.controller.destroy();
});
test('Still art flushes its fade immediately and no living loop is introduced',()=>{
 const f=fixture({motion:'still'}),{svg}=f.art({loop:true});f.reset();f.controller.syncTabs();const a=played(f,'rd-art');assert.equal(a.length,1);assert.equal(a[0].node,svg);assert.deepEqual(a[0].frames,[{opacity:0},{opacity:1}]);assert.deepEqual(a[0].options,{duration:320,delay:133,easing:f.Motion.easings.fade,id:'rd-art',fill:'backwards'});assert.equal(played(f,'rd-art-loop').length,0);f.controller.destroy();
});
test('syncTabs measures selection surfaces once before pill/scroll writes and keeps the pill snap flush',()=>{
 const f=fixture(),tabs=f.make(f.shell,'div','tabs',{class:'t-tabs'}),pill=f.make(tabs,'span','pill',{class:'t-tabs-pill'}),tab=f.make(tabs,'button','tab',{class:'t-tab','aria-selected':'true','data-tab':'work'});
 tab.layout.offsetLeft=150;tab.layout.offsetWidth=80;tabs.layout.clientWidth=100;const group=f.make(f.shell,'div','filters',{class:'rd-filter-group'}),on=f.make(group,'button','filter',{class:'rd-filter','aria-pressed':'true'});on.layout.offsetLeft=20;on.layout.offsetWidth=90;f.reset();f.controller.syncTabs();
 const indices=f.events.map((e,i)=>({e,i})),reads=indices.filter(({e})=>e.node==='filter'&&e.kind==='read');assert.equal(reads.filter(({e})=>e.type==='offsetWidth').length,1);const firstWrite=f.events.findIndex(e=>e.kind==='write');assert.ok(reads.every(({i})=>i<firstWrite),'surface geometry is read before scrolling or writing the pill');
 assert.equal(tabs.layout.scrollLeft,134);assert.equal(pill.style.transform,'translateX(150px)');assert.equal(pill.style.width,'80px');const flush=f.events.findIndex(e=>e.node==='pill'&&e.type==='offsetWidth');assert.ok(flush>f.events.findIndex(e=>e.node==='pill'&&e.key==='width'));assert.ok(flush<f.events.findLastIndex(e=>e.node==='pill'&&e.key==='transition'));f.controller.destroy();
});
test('surface snap writes are grouped before pseudo flushes; glides and crossfade options stay intact',()=>{
 const f=fixture(),group=f.make(f.shell,'div','filters',{class:'rd-filter-group'}),filter=f.make(group,'button','filter',{class:'rd-filter','aria-pressed':'true'}),list=f.make(f.shell,'div','assignments',{class:'rd-assignment-list'}),pick=f.make(list,'button','pick',{class:'rd-assignment rd-assignment--selected'}),tabs=f.make(f.shell,'div','readerTabs',{class:'rd-reader-tabs'});f.make(tabs,'button','readerTab',{class:'rd-reader-tab','aria-pressed':'true'});
 f.reset();f.controller.place();const flush=f.events.findIndex(e=>e.type==='style'&&e.pseudo),last=f.events.findLastIndex(e=>e.kind==='write'&&e.key?.startsWith('--rd-sel-'));assert.ok(flush>last);const style=f.shell.style;assert.equal(style.getPropertyValue('--rd-sel-flt-w'),'100px');
 filter.layout.offsetLeft=50;f.controller.place(true);assert.equal(style.getPropertyValue('--rd-sel-flt-dur'),'350ms');assert.equal(f.animations.length,0);pick.layout.offsetTop=300;f.controller.place(true);const a=f.animations;assert.deepEqual(a.map(a=>a.options),[{pseudoElement:'::before',duration:220,easing:f.Motion.easings.fade},{pseudoElement:'::after',duration:200,easing:f.Motion.easings.release}]);f.controller.destroy();
});

for(const [pose,identity]of [
 ['matrix(2, 3, 4, 5, 6, 7)','matrix(1,0,0,1,0,0)'],
 ['matrix3d(2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17)','matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)'],
 ['translate(12px,-3%) rotate(0.5turn) skew(2deg,3grad) scale(2,3) scaleX(4) scaleY(5) scaleZ(6) scale3d(2,3,4)','translate(0px,0%) rotate(0turn) skew(0deg,0grad) scale(1,1) scaleX(1) scaleY(1) scaleZ(1) scale3d(1,1,1)'],
 ['matrix(2,0,0,3,4,5) translate3d(2px,3%,4px) rotate3d(1,0,0,2rad)','matrix(1,0,0,1,0,0) translate3d(0px,0%,0px) rotate3d(0,0,0,0rad)'],
 ['translate3d( 2px   3% 4px ) scale3d( 2 3 4 ) rotate3d(1 0 0 2rad)','translate3d(0px,0%,0px) scale3d(1,1,1) rotate3d(0,0,0,0rad)'],
 ['translate( 12px -3% ) skew(2deg 3grad) scale(2 3)','translate(0px,0%) skew(0deg,0grad) scale(1,1)']
])test('SVG hover settles to the function-specific transform identity: '+pose,()=>{
 const f=fixture({vars:true}),old=f.row('old',true),next=f.row('next');next.move.computed.transform=pose;f.controller.place();f.controller.place(true,f.select(old,next));const a=played(f,'rd-frame').find(a=>a.node===next.move);assert.ok(a,'hover settlement is animated through custom properties');assert.deepEqual(a.frames,[{'--rd-tf':pose},{'--rd-tf':identity}]);a.cancel();assert.equal(next.move.style.getPropertyValue('--rd-tf'),'');assert.equal(next.move.style.transform,'');f.controller.destroy();
});
for(const setting of ['living','still','off','reduced','css'])test('CSS rail twins return to their base pose before the film parks: '+setting,()=>{
 const f=fixture({vars:true}),row=f.row('row',true),target=row.move,rail=row.row.parentNode,name='rd-fl-sway';target.style.setProperty('transform','translate(3px)');target.style.setProperty('opacity','.6');target.computed.animationName=name;const css=target.animate([{transform:'rotate(0deg)',opacity:1},{transform:'rotate(4deg)',opacity:.8}],{duration:3000,iterations:Infinity,easing:'linear',fill:'none'});css.animationName=name;rail.getAnimations=()=>f.animations.filter(a=>rail.contains(a.node)&&a.playState!=='idle');f.art({loop:true});f.controller.syncTabs();f.flush();f.tick(2000);const twin=f.animations.find(a=>a.node===target&&a!==css);assert.ok(twin,'the native CSS loop was taken over');assert.equal(css.playState,'idle');assert.equal(target.style.transform,'var(--rd-tf)');assert.ok(f.intervals.size);f.reset();
 if(setting==='living')f.container.dataset.livingArt='off';else if(setting==='reduced')f.media.matches=true;else if(setting!=='css')f.container.dataset.motionStyle=setting;target.computed.animationName='none';
 f.controller.syncTabs();f.flush();assert.equal(twin.playState,'idle','the CSS twin is cancelled in this render');assert.equal(target.style.transform,'translate(3px)');assert.equal(target.style.opacity,'.6');assert.equal(target.style.getPropertyValue('--rd-tf'),'');assert.equal(target.style.getPropertyValue('--rd-op'),'');if(setting!=='css'){assert.equal(f.intervals.size,0,'no clock remains after loops stop');assert.ok(f.events.findIndex(e=>e.type==='cancel'&&e.node===target.name)<f.events.findIndex(e=>e.type==='park'),'the twin releases its pose before the last scene parks');}f.controller.destroy();assert.equal(f.intervals.size,0);
});
