'use strict';
// A small DOM/WAAPI fixture for the real dashboard and film controller. No browser.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture({courseId='10',assignments=[],setup=()=>{}}={}){
 let clock=100,sequence=0;const timers=new Map(),animations=[],observers=[],events=new Map();
 const counts={scenes:0,titles:0,timers:0};
 const epoch=Date.UTC(2026,9,17,10);
 class FixtureDate extends Date{constructor(...args){super(...(args.length?args:[epoch+clock]));}static now(){return epoch+clock;}}
 const split=(value,separator)=>{let depth=0,start=0,out=[];for(let i=0;i<value.length;i++){if('(['.includes(value[i]))depth++;if(')]'.includes(value[i]))depth--;if(!depth&&separator(value[i])){if(value.slice(start,i).trim())out.push(value.slice(start,i).trim());start=i+1;}}if(value.slice(start).trim())out.push(value.slice(start).trim());return out;};
 const decode=value=>String(value).replace(/&(?:amp|lt|gt|quot|#39);/g,e=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[e]));
 function matches(node,selector,scope){
  if(node.nodeType!==1)return false;
  const groups=split(selector,c=>c===',');if(groups.length>1)return groups.some(s=>matches(node,s,scope));
  const child=split(selector,c=>c==='>');if(child.length>1)return matches(node,child.pop(),scope)&&matches(node.parentElement||{},child.join('>'),scope);
  const parts=split(selector,c=>/\s/.test(c));if(parts.length>1){const last=parts.pop();if(!matches(node,last,scope))return false;for(let p=node.parentElement;p;p=p.parentElement)if(matches(p,parts.join(' '),scope))return true;return false;}
  if(selector.includes(':focus')){if(document.activeElement!==node)return false;selector=selector.replace(':focus','');}
  if(selector.includes(':scope')){if(node!==scope)return false;selector=selector.replace(':scope','');}
  selector=selector.replace(/:(is|not)\(([^()]*)\)/g,(_,kind,inside)=>{const result=matches(node,inside,scope);return (kind==='is'?result:!result)?'':'!';});
  if(selector.includes(':')||selector.includes('!'))return false;
  let valid=true;selector=selector.replace(/\[([\w-]+)(?:="?([^"\]]+)"?)?\]/g,(_,key,value)=>{if(!node.hasAttribute(key)||value!==undefined&&node.getAttribute(key)!==value)valid=false;return '';});
  selector=selector.replace(/#([\w-]+)/g,(_,id)=>{if(node.id!==id)valid=false;return '';}).replace(/\.([\w-]+)/g,(_,cls)=>{if(!node.classList.contains(cls))valid=false;return '';});
  return valid&&(!selector||selector==='*'||node.nodeName===selector.toUpperCase());
 }
 class Node{
  constructor(name,attrs={},type=1){this.nodeName=name.toUpperCase();this.nodeType=type;this.attrs={...attrs};this.childNodes=[];this.parentNode=null;this.ownerDocument=document;this.events=new Map();this.scrollTop=0;this.scrollLeft=0;this.value=attrs.value||'';this.checked='checked'in attrs;this.open='open'in attrs;this.played=[];
   this.style={setProperty(k,v){this[k]=String(v);},removeProperty(k){delete this[k];},getPropertyValue(k){return this[k]||'';}};
   this.dataset=new Proxy({}, {get:(_,k)=>this.attrs['data-'+String(k).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())],set:(_,k,v)=>{this.setAttribute('data-'+String(k).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),v);return true;},deleteProperty:(_,k)=>{this.removeAttribute('data-'+String(k).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()));return true;}});
   this.classList={contains:c=>this.className.split(/\s+/).includes(c),add:(...cs)=>{this.className=[...new Set([...this.className.split(/\s+/),...cs])].join(' ');},remove:(...cs)=>{this.className=this.className.split(/\s+/).filter(c=>!cs.includes(c)).join(' ');},toggle:(c,on)=>{const yes=on??!this.classList.contains(c);this.classList[yes?'add':'remove'](c);return yes;}};
  }
  get tagName(){return this.nodeName;}get id(){return this.attrs.id||'';}get className(){return this.attrs.class||'';}set className(v){this.attrs.class=v;}
  get attributes(){return Object.entries(this.attrs).map(([name,value])=>({name,value}));}
  get children(){return this.childNodes.filter(n=>n.nodeType===1);}get firstChild(){return this.childNodes[0]||null;}get firstElementChild(){return this.children[0]||null;}
  get parentElement(){return this.parentNode?.nodeType===1?this.parentNode:null;}get nextSibling(){return this.parentNode?.childNodes[this.parentNode.childNodes.indexOf(this)+1]||null;}
  get isConnected(){return this===document.documentElement||!!this.parentNode?.isConnected;}
  get hidden(){return this.hasAttribute('hidden');}set hidden(v){this.toggleAttribute('hidden',v);}
  get textContent(){return this.nodeType===3?this.nodeValue:this.childNodes.map(n=>n.textContent).join('');}set textContent(value){this.replaceChildren();if(value)this.append(text(String(value)));}
  get innerHTML(){return this.childNodes.map(n=>n.outerHTML).join('');}set innerHTML(value){const target=this.nodeName==='TEMPLATE'?this.content:this;target.replaceChildren();parse(String(value),target);}
  get outerHTML(){return this.nodeType===3?this.nodeValue:`<${this.nodeName.toLowerCase()}${this.attributes.map(a=>` ${a.name}="${a.value}"`).join('')}>${this.innerHTML}</${this.nodeName.toLowerCase()}>`;}
  get clientWidth(){return 1000;}get clientHeight(){return 700;}get scrollHeight(){return 1500;}get offsetWidth(){return 100;}get offsetHeight(){return 40;}get offsetLeft(){return 0;}get offsetTop(){return 0;}
  getAttribute(k){return this.attrs[k]??null;}hasAttribute(k){return k in this.attrs;}setAttribute(k,v){this.attrs[k]=String(v);}removeAttribute(k){delete this.attrs[k];}toggleAttribute(k,on){if(on??!this.hasAttribute(k))this.setAttribute(k,'');else this.removeAttribute(k);}
  append(...nodes){for(const node of nodes)this.insertBefore(node,null);}appendChild(n){this.append(n);return n;}prepend(n){this.insertBefore(n,this.firstChild);}
  after(node){if(this.parentNode)this.parentNode.insertBefore(node,this.nextSibling);}
  insertBefore(node,before){if(node===before)return;if(before&&before.parentNode!==this)throw Error('NotFoundError: insertion reference is not a child');if(node===this||node.contains(this))throw Error('HierarchyRequestError: insertion would create a DOM cycle');if(node.nodeType===11){for(const child of [...node.childNodes])this.insertBefore(child,before);return;}node.remove();const i=before?this.childNodes.indexOf(before):this.childNodes.length;this.childNodes.splice(i,0,node);node.parentNode=this;}
  replaceChildren(...nodes){for(const child of this.childNodes)child.parentNode=null;this.childNodes=[];this.append(...nodes);}
  remove(){if(this.parentNode){this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this),1);this.parentNode=null;}}
  contains(node){for(let n=node;n;n=n.parentNode)if(n===this)return true;return false;}
  matches(s){return matches(this,s,this);}closest(s){for(let n=this;n;n=n.parentElement)if(matches(n,s,n))return n;return null;}
  querySelectorAll(s){const out=[];const walk=n=>{for(const child of n.childNodes){if(matches(child,s,this))out.push(child);walk(child);}};walk(this);return out;}
  querySelector(s){const find=n=>{for(const child of n.childNodes){if(matches(child,s,this))return child;const found=find(child);if(found)return found;}return null;};return find(this);}
  getBoundingClientRect(){return {left:0,top:20,right:480,bottom:260,width:480,height:240};}getClientRects(){return this.isConnected&&!this.hidden?[this.getBoundingClientRect()]:[];}getBBox(){return {x:0,y:0,width:30,height:30};}getTotalLength(){return 100;}
  getRootNode(){return document;}focus(options){document.activeElement=this;this.focusOptions=options;}setSelectionRange(){}scrollIntoView(){}
  addEventListener(k,fn){this.events.set(k,fn);}removeEventListener(k){this.events.delete(k);}click(){container.events.get('click')?.({detail:0,target:this,preventDefault(){}});}
  cloneNode(deep){const n=new Node(this.nodeName,this.attrs,this.nodeType);n.nodeValue=this.nodeValue;if(deep)for(const c of this.childNodes)n.append(c.cloneNode(true));return n;}
  getAnimations({subtree=false}={}){return [...this.played,...(subtree?this.children.flatMap(n=>n.getAnimations({subtree:true})):[])].filter(a=>a.playState!=='idle');}
  animate(frames,options){const a={node:this,frames,options,currentTime:0,playState:'running',effect:{getComputedTiming:()=>({endTime:options.duration+(options.delay||0)}),getTiming:()=>options,getKeyframes:()=>frames},finished:new Promise(()=>{}),pause(){this.playState='paused';},play(){this.playState='running';},cancel(){this.playState='idle';this.cancelled=true;},finish(){this.playState='finished';}};this.played.push(a);animations.push(a);return a;}
 }
 const document={activeElement:null,visibilityState:'visible',createElement(name){const n=new Node(name);if(name==='template')n.content=new Node('#fragment',{},11);return n;},addEventListener:(k,f)=>events.set(k,f),removeEventListener:k=>events.delete(k)};
 document.documentElement=new Node('html');document.body=new Node('body');document.documentElement.append(document.body);document.scrollingElement=document.documentElement;
 const text=value=>{const n=new Node('#text',{},3);n.nodeValue=value;return n;};
 function parse(html,parent){const stack=[parent],voids=new Set(['INPUT','IMG','BR','HR','META','LINK','WBR']);for(const match of html.matchAll(/<!--[\s\S]*?-->|<\/?[\w-]+\b[^>]*>|[^<]+/g)){const raw=match[0];if(raw.startsWith('<!--'))continue;if(raw.startsWith('</')){const name=raw.slice(2,-1).trim().toUpperCase(),i=stack.findLastIndex(n=>n.nodeName===name);if(i>0)stack.length=i;continue;}if(raw.startsWith('<')){const [,name,body]=raw.match(/^<([\w-]+)([\s\S]*?)\/?\s*>$/),attrs={};for(const a of body.matchAll(/([\w:-]+)(?:="([^"]*)"|'([^']*)'|=([^\s>]+))?/g))attrs[a[1]]=decode(a[2]??a[3]??a[4]??'');const n=new Node(name,attrs);stack.at(-1).append(n);if(!voids.has(n.nodeName)&&!raw.endsWith('/>'))stack.push(n);}else stack.at(-1).append(text(decode(raw)));}}
 class Observer{constructor(fn){this.fn=fn;this.nodes=new Set();observers.push(this);}observe(n){this.nodes.add(n);}unobserve(n){this.nodes.delete(n);}disconnect(){this.nodes.clear();}}
 const timeout=(fn,delay=0,repeat=false)=>{const id=++sequence;timers.set(id,{fn,at:clock+delay,delay,repeat});counts.timers++;return id;};
 const env=vm.createContext({URL,TextEncoder,AbortController,Intl,Date:FixtureDate,document,console,performance:{now:()=>clock},innerWidth:1400,innerHeight:1000,
  setTimeout:(fn,d)=>timeout(fn,d),clearTimeout:id=>timers.delete(id),setInterval:(fn,d)=>timeout(fn,d,true),clearInterval:id=>timers.delete(id),
  addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),ResizeObserver:Observer,IntersectionObserver:Observer,
  getComputedStyle:()=>({pointerEvents:'none',overflowY:'auto',getPropertyValue:()=>''}),
  ReserveCustomizeUI:{render:()=>'<div class="rd-appearance"><div class="t-acc-panel"><div class="t-acc-panel-inner"></div></div></div>'},
  ReservePlannerUI:{render:()=>'<section class="rd-page-heading"><h2>Planner</h2></section>'}});
 for(const file of ['site.js','core.js','ui-utils.js','dashboard-model.js','work-model.js','grades-view.js','dashboard-view.js','motion.js','dashboard.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension',file),'utf8'),env,{filename:file});
 env.ReserveCourseArt={scene(course){counts.scenes++;return `<svg class="rd-art" data-place="heading" data-cycle="10" data-rd-key="scene-${course.id}" viewBox="0 0 480 240"><g class="art-loop" data-loop="bob" data-period="10"><path d="M0 0L100 100" stroke="black"/></g></svg>`;},titleFrame(course){counts.titles++;return `<span class="rd-title-art"><svg class="rd-art" data-crop="title" data-cycle="10" data-place="heading" data-rd-key="title-${course.id}" viewBox="0 0 480 240"><g class="art-loop" data-loop="pulse" data-period="10"><path d="M0 0L100 100" stroke="black"/></g></svg></span>`;},titleStyle:()=>'',kind:()=>'',frame:()=>'',mini:()=>''};
 let personal={settings:{motion:'gentle',livingArt:'on',theme:'light',timeZone:'UTC',coursePrefs:{}}};const subscriptions=new Set();
 const store={get:()=>personal,subscribe:fn=>{subscriptions.add(fn);return()=>subscriptions.delete(fn);},update:async fn=>{fn(personal);for(const callback of subscriptions)callback(personal);}};
 const snapshot={user:{id:'1',short_name:'Student'},courses:[{id:'10',name:'Chemistry'},{id:'20',name:'History'}],assignments};
 setup({env,store,snapshot});
 const dashboard=env.ReserveDashboard.mount(document.body,{snapshot,store,demo:true,initialState:{courseId,workspace:'work'}}),container=document.body.querySelector('.rd');
 const tick=ms=>{clock+=ms;for(const [id,t]of [...timers])if(t.at<=clock){if(t.repeat)t.at=clock+t.delay;else timers.delete(id);t.fn();}};
 const click=(action,data={},{pointer=true}={})=>{const target=container.querySelector(`[data-rd-action="${action}"]${data.tab?`[data-tab="${data.tab}"]`:''}${data.id?`[data-id="${data.id}"]`:''}`);if(!target)throw Error('No action '+action+JSON.stringify(data));if(pointer)container.events.get('pointerdown')?.({target});target.focus({preventScroll:true});container.events.get('click')({detail:pointer?1:0,target,preventDefault(){}});return target;};
 return {env,document,container,dashboard,store,snapshot,animations,observers,timers,counts,tick,click,events};
}
module.exports={fixture};
