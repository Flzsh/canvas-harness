'use strict';
// Shared 3.2 DOM/clock fixture. All controller timers and listeners stay inside this VM.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture({hz=60,extra=false,observers=true,hidden=false,frame='pen',rule=null,paddock=false,roam='page',initialBlocker=false,motion='full',mediaReduced=false,pet:petFields={},info={}}={}){
 let clock=0,seq=0,random=[],pet={enabled:true,roam,...petFields},infoValue=info,trace=[],reads={rect:0,style:0,hit:0,range:0,offset:0},writes=[],rafCalls=0,enumerations=0,layoutEnumerations=0,scans=0,callbacks=0;
 const timers=new Map(),resizes=[],mutations=[],eventTargets=new Set(),animations=[],box=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
 const schedule=(fn,delay=0,repeat=0,kind='task')=>{const id=++seq;timers.set(id,{fn,at:clock+Math.max(0,delay),repeat,kind});return id;};
 const events=target=>{eventTargets.add(target);target.events=new Map();target.addEventListener=(key,fn)=>{if(!target.events.has(key))target.events.set(key,new Set());target.events.get(key).add(fn);};target.removeEventListener=(key,fn)=>target.events.get(key)?.delete(fn);target.emit=(key,event={})=>{for(const fn of [...target.events.get(key)||[]])fn({...event,type:key,target:event.target||target});};return target;};
 class Element{
  constructor(cls='',data={}){events(this);this.className=cls;this.dataset=new Proxy({...data},{set:(o,k,v)=>{if(o[k]!==v)writes.push({t:clock,el:this,key:'data-'+String(k),value:v});o[k]=v;return true;}});this.children=[];this.childNodes=[];this.parentNode=null;this.connected=false;this.rect=box(0,0,300,120);this.attrs={};this.borders={};this.style=new Proxy({setProperty:(k,v)=>{this.style[k]=v;}},{set:(o,k,v)=>{writes.push({t:clock,el:this,key:k,value:v});trace.push({kind:'write',el:this,key:k});o[k]=v;return true;}});}
  get ownerDocument(){return doc;}get nodeType(){return 1;}get parentElement(){return this.parentNode;}get firstElementChild(){return this.children[0]||null;}get isConnected(){return this.connected||!!this.parentNode?.isConnected;}get offsetWidth(){reads.offset++;trace.push({kind:'read',read:'offset'});return this.rect.width;}get offsetHeight(){reads.offset++;trace.push({kind:'read',read:'offset'});return this.rect.height;}
  append(el){el.remove();el.parentNode=this;this.children.push(el);this.childNodes.push(el);}remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode.childNodes=this.parentNode.childNodes.filter(n=>n!==this);this.parentNode=null;}}
  contains(el){if(el!=null&&!(el instanceof Element)&&!el.nodeType)throw new TypeError("Failed to execute 'contains' on 'Node': parameter 1 is not of type 'Node'.");for(let n=el;n;n=n.parentNode)if(n===this)return true;return false;}getRootNode(){return doc;}getBoundingClientRect(){reads.rect++;trace.push({kind:'read',read:'rect'});return {...this.rect};}
  setAttribute(k,v){this.attrs[k]=String(v);}setPointerCapture(){}releasePointerCapture(){}focus(){doc.activeElement=this;}
  matches(sel){
   if(sel==='.rd-main > [data-arrange-key]')return this.kind==='panel';
   return sel.split(',').some(s=>{
    s=s.trim();if(s==='button')return this.control;if(s==='svg')return this.className==='pet-svg';
    if(s.startsWith('.'))return this.className.split(/\s+/).includes(s.slice(1));
    const data=/^\[data-([\w-]+)\]$/.exec(s);
    return !!data&&data[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase()) in this.dataset;
   });
  }
  closest(sel){for(let n=this;n;n=n.parentNode)if(n.matches(sel))return n;return null;}
  querySelectorAll(sel){if(this===container){if(sel==='[data-pet-ledge]'){scans++;return this.ledges||[];}if(sel==='.rd-main > [data-arrange-key]')return panels.filter(p=>p.isConnected);if(sel.includes(':is(section,'))return lines.filter(p=>p.isConnected);return [];}
   if(this.className==='pet-bubble'&&sel==='.pet-item:not([disabled])')return this.children.filter(n=>n.className==='pet-item'&&!n.disabled);
   const classes={'.pet-up':['pet-up'],'.pet-neck':['pet-neck'],'.pet-head':['pet-head'],'.pet-leg.lf,.pet-leg.lh2':['lf','lh2'],'.pet-leg.lh,.pet-leg.lf2':['lh','lf2'],'.pet-legs':['pet-legs'],'.pet-tuck,.pet-tuck2':['pet-tuck','pet-tuck2'],'.pet-shadow':['pet-shadow']};return this.children.filter(n=>(classes[sel]||[]).includes(n.className));}
  querySelector(sel){return this.querySelectorAll(sel)[0]||null;}
  set innerHTML(html){this.html=html;this.children=[];this.childNodes=[];if(this.className==='pet-layer'){const n=new Element('pet',{pose:'stand',face:'right'});n.control=true;this.append(n);}else if(this.className==='pet-bubble'){for(const [,attrs,label] of html.matchAll(/<button([^>]*)>(.*?)<\/button>/g)){const b=new Element('pet-item',{petAction:/data-pet-action="([^"]+)"/.exec(attrs)[1]});b.control=true;b.disabled=/\bdisabled\b/.test(attrs);b.label=label;this.append(b);}}else if(this.className==='pet'){for(const cls of ['pet-up','pet-neck','pet-head','lf','lh2','lh','lf2','pet-legs','pet-tuck','pet-tuck2','pet-shadow'])this.append(new Element(cls));}}
  getAnimations(){if(this.className==='pet')enumerations++;else layoutEnumerations++;return this.layoutAnimations||(this.className==='pet'?animations:[]);}
 }
 const motionMedia=events({matches:mediaReduced});
 const win=events({innerWidth:1800,innerHeight:1000,performance:{now:()=>clock},matchMedia:()=>motionMedia,requestAnimationFrame:fn=>{rafCalls++;return schedule(()=>{trace.push({kind:'raf'});fn(clock);trace.push({kind:'paint'});},1000/hz,0,'raf');},cancelAnimationFrame:id=>timers.delete(id),getComputedStyle:el=>{reads.style++;return {borderTopWidth:'0',borderBottomWidth:'0',borderTopStyle:'none',borderBottomStyle:'none',...el.borders};}});
 const doc=events({defaultView:win,hidden,createElement:()=>new Element(),elementsFromPoint:(x,y)=>{reads.hit++;trace.push({kind:'read',read:'hit'});return blockers.filter(n=>x>=n.rect.left&&x<=n.rect.right&&y>=n.rect.top&&y<=n.rect.bottom);},createRange:()=>({selectNodeContents(n){this.text=n;},getClientRects(){reads.range++;return [this.text.rect];}}),fonts:events({})});
 const container=new Element('rd',{panelFrame:frame,motionStyle:motion}),host=new Element('host'),panels=[new Element('panel',{arrangeKey:'work'})],lines=[],blockers=[];host.connected=true;host.append(container);panels[0].kind='panel';panels[0].rect=box(100,300,1400,350);container.append(panels[0]);
 if(extra){const other=new Element('panel',{arrangeKey:'context'});other.kind='panel';other.rect=box(100,600,1400,150);panels.push(other);container.append(other);}
 if(rule){const line=new Element('line');line.rect=box(150,450,1000,40);line.borders=rule==='bottom'?{borderBottomWidth:'1px',borderBottomStyle:'solid',borderBottomColor:'rgb(20, 20, 20)'}:{borderTopWidth:'1px',borderTopStyle:'solid',borderTopColor:rule==='transparent'?'rgba(0, 0, 0, 0)':'rgb(20, 20, 20)'};lines.push(line);panels[0].append(line);}
 if(paddock){const pen=new Element('paddock',{petLedge:'inside'});pen.rect=box(100,700,1400,132);container.ledges=[pen];container.append(pen);}
 if(initialBlocker){const used=new Element('initial control');used.control=true;used.rect=box(130,930,100,70);blockers.push(used);container.append(used);}
 class ResizeObserver{constructor(fn){this.fn=fn;this.nodes=new Set();resizes.push(this);}observe(n){this.nodes.add(n);}unobserve(n){this.nodes.delete(n);}disconnect(){this.nodes.clear();}}
 class MutationObserver{constructor(fn){this.fn=fn;this.target=null;mutations.push(this);}observe(n,options){this.target=n;this.options=options;}disconnect(){this.target=null;}}
 if(observers){win.ResizeObserver=ResizeObserver;win.MutationObserver=MutationObserver;}
 const math=Object.create(Math);math.random=()=>random.length?random.shift():.5;
 const env=vm.createContext({console,Math:math,Date,Map,Set,WeakMap,setTimeout:(fn,ms)=>schedule(fn,ms),clearTimeout:id=>timers.delete(id),setInterval:(fn,ms)=>schedule(fn,ms,ms),clearInterval:id=>timers.delete(id),...win,document:doc});
 for(const file of ['pet-art.js','pets.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension',file),'utf8'),env,{filename:file});
 const controller=env.ReservePets.create({container,getPet:()=>pet,savePet:p=>{pet=p;},info:()=>infoValue,now:()=>clock});
 const advance=ms=>{const end=clock+ms;let count=0;for(;;){const ready=[...timers].filter(([,t])=>t.at<=end+1e-7).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!ready)break;if(++count>50000)throw Error('Timer loop');clock=Math.max(clock,ready[1].at);if(ready[1].repeat)ready[1].at=clock+ready[1].repeat;else timers.delete(ready[0]);callbacks++;ready[1].fn();}clock=end;};
 const stall=ms=>{clock+=ms;const due=[...timers].filter(([,t])=>t.at<=clock);for(const [id,t]of due){if(!timers.has(id))continue;if(t.repeat)t.at=clock+t.repeat;else timers.delete(id);callbacks++;t.fn();}};
 const node=()=>container.children.find(n=>n.className==='pet-layer')?.firstElementChild;
 const paint=()=>{const ready=[...timers].filter(([,t])=>t.kind==='raf').sort((a,b)=>a[1].at-b[1].at)[0];assert.ok(ready,'a postpaint geometry frame is pending');clock=Math.max(clock,ready[1].at);timers.delete(ready[0]);callbacks++;ready[1].fn();};
 const f={controller,container,host,panels,lines,blockers,win,doc,motionMedia,timers,resizes,mutations,animations,Element,box,advance,stall,paint,postpaint:()=>{paint();advance(0);},get bubble(){return container.children.find(n=>n.className==='pet-layer')?.children.find(n=>n.className==='pet-bubble');},get node(){return node();},get clock(){return clock;},get reads(){return reads;},get writes(){return writes;},get trace(){return trace;},get rafCalls(){return rafCalls;},get enumerations(){return enumerations;},get layoutEnumerations(){return layoutEnumerations;},get scans(){return scans;},get callbacks(){return callbacks;},get listenerCount(){let count=0;for(const target of eventTargets)for(const handlers of target.events.values())count+=handlers.size;return count;},random:(...r)=>{random=r;},clear:()=>{reads={rect:0,style:0,hit:0,range:0,offset:0};writes=[];trace=[];rafCalls=enumerations=layoutEnumerations=scans=callbacks=0;},mutate:(records)=>{for(const o of mutations)if(o.target)o.fn(records);},setInfo:value=>{infoValue=value;},get pet(){return pet;},get live(){return container.children.find(n=>n.className==='pet-layer')?.children.find(n=>n.className==='pet-live');},resize:(el=panels[0])=>{for(const o of resizes)if(o.nodes.has(el))o.fn([{target:el}]);},setPet:p=>{pet={...pet,...p};controller.sync();}};
 f.startWalk=(trot=false)=>{advance(1400);random=[.1,...Array(9).fill(trot?.98:.65)];advance(6000);assert.ok(timers.size,'a walk is scheduled');return node()._x;};return f;
}

function teardown(f){
 f.controller.destroy();
 assert.equal(f.timers.size,0,'all pet timers are cancelled');
 assert.equal(f.listenerCount,0,'all pet listeners are removed, including detached bubbles');
 assert.ok(f.resizes.every(observer=>!observer.nodes.size),'resize observers are disconnected');
 assert.ok(f.mutations.every(observer=>!observer.target),'mutation observers are disconnected');
}
module.exports={fixture,teardown};
