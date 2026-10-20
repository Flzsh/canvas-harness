'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'../extension',name),'utf8');
const artContext=vm.createContext({});
vm.runInContext(read('course-nav-art.js'),artContext,{filename:'course-nav-art.js',timeout:1000});
const Art=artContext.ReserveCourseNavArt;
const APPEARANCE='reserve:appearance';

// Only the DOM operations used by this content script. SVG markup stays opaque:
// these tests check the exact supplied art, not a second SVG parser or rendering.
class Events{
 constructor(){this.listeners=new Map();}
 addEventListener(type,fn,options={}){
  const entries=this.listeners.get(type)||[];
  if(!entries.some(entry=>entry.fn===fn))entries.push({fn,once:!!options?.once});
  this.listeners.set(type,entries);
 }
 removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(entry=>entry.fn!==fn));}
 dispatchEvent(event){
  event.target??=this;event.currentTarget=this;
  for(const entry of [...this.listeners.get(event.type)||[]]){
   if(entry.once)this.removeEventListener(event.type,entry.fn);
   entry.fn.call(this,event);
  }
  if(event.bubbles)this.parentNode?.dispatchEvent(event);
  return true;
 }
}
class TextNode{
 constructor(value,document){this.nodeType=3;this.data=String(value);this.ownerDocument=document;this.parentNode=null;}
 get textContent(){return this.data;}
 set textContent(value){this.data=String(value);}
 get parentElement(){return this.parentNode?.nodeType===1?this.parentNode:null;}
}
function selectorParts(selector){
 const parts=[];let start=0,depth=0,quote='';
 for(let i=0;i<selector.length;i++){
  const c=selector[i];
  if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue;}
  if(c==='"'||c==="'")quote=c;
  else if(c==='['||c==='(')depth++;
  else if(c===']'||c===')')depth--;
  else if(!depth&&(c===','||c==='>'||/\s/.test(c))){
   if(selector.slice(start,i).trim())parts.push(selector.slice(start,i).trim());
   if(c===','||c==='>')parts.push(c);
   start=i+1;
  }
 }
 if(selector.slice(start).trim())parts.push(selector.slice(start).trim());
 return parts;
}
function simpleMatch(el,selector,scope){
 if(!el||el.nodeType!==1)return false;
 let match;
 if(selector.includes(':scope')){if(el!==scope)return false;selector=selector.replace(':scope','');}
 let excluded=false;
 selector=selector.replace(/:not\(([^()]*)\)/g,(_all,part)=>{if(matches(el,part,scope))excluded=true;return '';});
 // Do not silently accept unsupported selectors in the fake.
 if(excluded)return false;
 let remainder=selector.replace(/\[([\w-]+)(?:(\^=|\*=|=)["']?([^\]"']*)["']?)?\]/g,(_all,name,op,value)=>{
  const actual=el.getAttribute(name);
  if(actual===null||(op==='='&&actual!==value)||(op==='^='&&!actual?.startsWith(value))||(op==='*='&&!actual?.includes(value)))match=false;
  return '';
 });
 if(match===false)return false;
 remainder=remainder.replace(/([.#])([\w-]+)/g,(_all,prefix,value)=>{
  if(prefix==='#'?el.id!==value:!el.classList.contains(value))match=false;
  return '';
 });
 if(match===false)return false;
 assert.match(remainder,/^(?:[\w-]+|\*)?$/,'Unsupported fake DOM selector: '+selector);
 return !remainder||remainder==='*'||el.tagName.toLowerCase()===remainder.toLowerCase();
}
function matches(el,selector,scope=el){
 const parts=selectorParts(selector);
 if(parts.includes(',')){
  let start=0;
  for(let i=0;i<=parts.length;i++)if(i===parts.length||parts[i]===','){
   if(matches(el,parts.slice(start,i).join(' '),scope))return true;
   start=i+1;
  }
  return false;
 }
 let at=parts.length-1,node=el;
 if(!simpleMatch(node,parts[at--],scope))return false;
 while(at>=0){
  if(parts[at]==='>'){if(!simpleMatch(node=node.parentElement,parts[--at],scope))return false;at--;}
  else{const part=parts[at--];do{node=node.parentElement;}while(node&&!simpleMatch(node,part,scope));if(!node)return false;}
 }
 return true;
}
class Element extends Events{
 constructor(tag,document){
  super();this.nodeType=1;this.tagName=tag.toUpperCase();this.ownerDocument=document;this.parentNode=null;this.childNodes=[];this.attrs=new Map();this._html='';
  this.style={setProperty(name,value){this[name]=String(value);},removeProperty(name){delete this[name];}};
  const classes=()=>this.className.split(/\s+/).filter(Boolean);
  this.classList={contains:name=>classes().includes(name),add:(...names)=>{this.className=[...new Set([...classes(),...names])].join(' ');},remove:(...names)=>{this.className=classes().filter(name=>!names.includes(name)).join(' ');},toggle:(name,force)=>{const on=force??!classes().includes(name);this.classList[on?'add':'remove'](name);return on;},[Symbol.iterator]:()=>classes()[Symbol.iterator]()};
  this.dataset=new Proxy({}, {get:(_target,key)=>this.attrs.get('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())),set:(_target,key,value)=>{this.setAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),value);return true;},deleteProperty:(_target,key)=>{this.removeAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()));return true;}});
 }
 get children(){return this.childNodes.filter(node=>node.nodeType===1);}
 get parentElement(){return this.parentNode?.nodeType===1?this.parentNode:null;}
 get firstChild(){return this.childNodes[0]||null;}
 get firstElementChild(){return this.children[0]||null;}
 get className(){return this.attrs.get('class')||'';}
 set className(value){this.setAttribute('class',value);}
 get id(){return this.attrs.get('id')||'';}
 set id(value){this.setAttribute('id',value);}
 get href(){return this.getAttribute('href')||'';}
 set href(value){this.setAttribute('href',value);}
 get hidden(){return this.hasAttribute('hidden');}
 set hidden(value){if(value)this.setAttribute('hidden','');else this.removeAttribute('hidden');}
 get attributes(){return [...this.attrs].map(([name,value])=>({name,value}));}
 setAttribute(name,value){const oldValue=this.getAttribute(name);this.attrs.set(name,String(value));this.ownerDocument.mutation({type:'attributes',target:this,attributeName:name,oldValue});}
 getAttribute(name){return this.attrs.get(name)??null;}
 hasAttribute(name){return this.attrs.has(name);}
 removeAttribute(name){const oldValue=this.getAttribute(name);if(this.attrs.delete(name))this.ownerDocument.mutation({type:'attributes',target:this,attributeName:name,oldValue});}
 append(...nodes){for(const node of nodes)this.appendChild(node);}
 prepend(...nodes){for(const node of nodes.reverse())this.insertBefore(node,this.firstChild);}
 appendChild(node){return this.insertBefore(node,null);}
 insertBefore(node,before){
  if(typeof node==='string')node=this.ownerDocument.createTextNode(node);
  assert.ok(before===null||this.childNodes.includes(before),'insertBefore requires a child');
  node.parentNode?.removeChild(node);node.parentNode=this;
  const index=before===null?this.childNodes.length:this.childNodes.indexOf(before);this.childNodes.splice(index,0,node);
  this.ownerDocument.mutation({type:'childList',target:this,addedNodes:[node],removedNodes:[]});return node;
 }
 removeChild(node){const index=this.childNodes.indexOf(node);assert.ok(index>=0);this.childNodes.splice(index,1);node.parentNode=null;this.ownerDocument.mutation({type:'childList',target:this,addedNodes:[],removedNodes:[node]});return node;}
 remove(){this.parentNode?.removeChild(this);}
 contains(node){return node===this||this.children.some(child=>child.contains(node));}
 matches(selector){return matches(this,selector);}
 closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
 querySelectorAll(selector){const found=[];const visit=node=>{for(const child of node.children){if(matches(child,selector,this))found.push(child);visit(child);}};visit(this);return found;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 get textContent(){return this._html.replace(/<[^>]*>/g,'')+this.childNodes.map(node=>node.textContent).join('');}
 set textContent(value){this.innerHTML='';if(String(value))this.append(String(value));}
 get innerHTML(){return this._html+this.childNodes.map(node=>node.nodeType===3?node.data:node.outerHTML).join('');}
 set innerHTML(value){for(const node of [...this.childNodes])this.removeChild(node);this._html=String(value);}
 get outerHTML(){return '<'+this.tagName.toLowerCase()+[...this.attrs].map(([key,value])=>' '+key+'="'+value+'"').join('')+'>'+this.innerHTML+'</'+this.tagName.toLowerCase()+'>';}
}

function fixture({menu='left',readyState='complete',appearance,osDark=false,storageRead}={}){
 const observers=[],observations=[],storageReads=[],storageWrites=[],storageListeners=new Set(),mediaQueries=[],requestedURLs=[],timers=new Map();let timerId=0;
 const document=new Events();document.nodeType=9;document.readyState=readyState;
 document.mutation=record=>{record={addedNodes:[],removedNodes:[],...record};for(const observer of observers)for(const {target,options}of observer.targets){
  if(record.target!==target&&!(options.subtree&&target.contains(record.target)))continue;
  if(record.type==='childList'?options.childList:options.attributes&&(!options.attributeFilter||options.attributeFilter.includes(record.attributeName)))observer.records.push(record);
 }};
 document.createElement=tag=>new Element(tag,document);document.createTextNode=value=>new TextNode(value,document);
 const el=(tag,attrs={},...children)=>{const node=document.createElement(tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);node.append(...children);return node;};
 document.documentElement=el('html');document.head=el('head');document.body=el('body');document.documentElement.append(document.head,document.body);
 document.querySelector=selector=>matches(document.documentElement,selector)?document.documentElement:document.documentElement.querySelector(selector);
 document.querySelectorAll=selector=>[...(matches(document.documentElement,selector)?[document.documentElement]:[]),...document.documentElement.querySelectorAll(selector)];
 document.getElementById=id=>document.querySelector('#'+id);
 const list=el('ul',{id:'section-tabs',class:'list-view'}),wrapper=menu==='labelled'?el('nav',{'aria-label':'Courses Navigation Menu'}):el('div',{id:menu==='left'?'left-side':'right-side'});
 if(menu!=='none'){wrapper.append(list);document.body.append(wrapper);}
 const outside=el('a',{class:'home',href:'/courses/99'},'Outside the menu');document.body.append(outside);
 const addItem=({className='',onLi=false,label='Canvas label',plainLabel=false,href='/courses/7/pages/intro',active=false,hidden=false,badge}={})=>{
  const li=el('li',{class:'section '+(onLi?className:'')+(hidden?' section-hidden':'')});
  const anchor=el('a',{class:(onLi?'':className)+(active?' active':'')+(hidden?' section-hidden disabled':''),href,title:label,'data-canvas-value':'kept'});
  const labelNode=plainLabel?document.createTextNode(label):el('span',{class:'canvas-label'},label);anchor.append(labelNode);
  let badgeNode,numberNode;
  if(badge!==undefined){badgeNode=el('span',{class:'nav-badge'});numberNode=document.createTextNode(badge);badgeNode.append(numberNode);anchor.append(badgeNode);}
  if(hidden)li.hidden=true;li.append(anchor);list.append(li);return {li,anchor,labelNode,badge:badgeNode,numberNode};
 };
 const data={[APPEARANCE]:appearance};
 const sandbox={document,console,URL,location:new URL('https://school.instructure.com/courses/7/modules'),
  MutationObserver:class{
   constructor(callback){this.callback=callback;this.targets=[];this.records=[];observers.push(this);}
   observe(target,options){this.targets.push({target,options});observations.push({target,options});}
   disconnect(){this.targets=[];this.records=[];}
   takeRecords(){return this.records.splice(0);}
  },
  chrome:{runtime:{getURL:name=>{requestedURLs.push(name);return 'chrome-extension://test/'+name;}},storage:{
   local:{get(keys,callback){storageReads.push(keys);const result=storageRead?storageRead():structuredClone(data);if(callback)Promise.resolve(result).then(callback);return Promise.resolve(result);},set(values){storageWrites.push(values);return Promise.resolve();}},
   onChanged:{addListener:fn=>storageListeners.add(fn),removeListener:fn=>storageListeners.delete(fn)}
  }},
  matchMedia(query){mediaQueries.push(query);return {matches:query.includes('prefers-reduced-motion')?false:osDark,media:query,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}};},
  setTimeout(fn,delay=0){const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),
  requestAnimationFrame(fn){const id=++timerId;timers.set(id,{fn,delay:0});return id;},cancelAnimationFrame:id=>timers.delete(id)
 };
 const windowEvents=new Events();sandbox.addEventListener=windowEvents.addEventListener.bind(windowEvents);sandbox.removeEventListener=windowEvents.removeEventListener.bind(windowEvents);sandbox.window=sandbox;sandbox.self=sandbox;sandbox.top=sandbox;
 const context=vm.createContext(sandbox);
 vm.runInContext(read('site.js'),context,{filename:'site.js',timeout:1000});
 vm.runInContext(read('course-nav-art.js'),context,{filename:'course-nav-art.js',timeout:1000});
 const run=()=>vm.runInContext(read('course-nav.js'),context,{filename:'course-nav.js',timeout:1000});
 async function flush(){
  // Deliver real childList feedback from inserted decorations, with a hard bound
  // so an observer that redecorates its own insertions fails instead of hanging.
  for(let round=0;round<30;round++){
   await new Promise(setImmediate);let work=false;
   for(const observer of observers){const records=observer.takeRecords();if(records.length){work=true;observer.callback(records,observer);}}
   for(const [id,timer]of [...timers])if(timer.delay===0){timers.delete(id);timer.fn();work=true;}
   if(!work)return;
  }
  assert.fail('Course-menu mutation/timer work did not settle within 30 deliveries');
 }
 async function start(){run();await flush();}
 async function changeAppearance(value,area='local',key=APPEARANCE){data[key]=value;for(const listener of storageListeners)listener({[key]:{newValue:value}},area);await flush();}
 async function finishTimers(){for(let round=0;round<20;round++){if(!timers.size)return;for(const [id,timer]of [...timers]){timers.delete(id);timer.fn();}await flush();}assert.fail('Course-menu timers did not settle');}
 return {context,document,html:document.documentElement,list,wrapper,outside,addItem,el,observers,observations,storageReads,storageWrites,storageListeners,mediaQueries,requestedURLs,run,start,flush,changeAppearance,finishTimers,pendingTimers:()=>timers.size};
}

function assertIcon(anchor,kind){
 const icons=anchor.querySelectorAll('.cn-icon[data-cn-icon]');assert.equal(icons.length,1,'exactly one icon for '+kind);
 const icon=icons[0];assert.equal(icon.tagName,'SPAN');assert.equal(icon.dataset.cnIcon,kind);assert.equal(icon.innerHTML,Art.icons[kind],'uses the supplied '+kind+' art verbatim');assert.equal(icon.getAttribute('aria-hidden'),'true');return icon;
}
function assertUnstarted(f){
 assert.equal(f.context.ReserveCourseNav,undefined);
 assert.equal(f.document.head.children.length,0);assert.deepEqual(f.requestedURLs,[]);assert.deepEqual(f.storageReads,[]);assert.deepEqual(f.storageWrites,[]);assert.equal(f.storageListeners.size,0);assert.equal(f.observers.length,0);
}
function assertInactive(f){
 assert.equal(f.html.classList.contains('reserve-course-nav'),false);assertUnstarted(f);
}

test('the shared vanilla-page guard runs before any DOM, storage, media or listener access',()=>{
 const touches=[],location=new URL('https://school.instructure.com/courses/7/assignments/12/submissions/new');let guarded=0;
 const blocked=name=>{touches.push(name);throw Error('Forbidden before vanilla-page guard: '+name);};
 const sandbox={location,ReserveSite:{supported:()=>true,vanillaPage(value){guarded++;assert.equal(value,location);return true;}}};
 for(const name of ['document','chrome','localStorage','sessionStorage','MutationObserver','matchMedia','addEventListener','setTimeout','requestAnimationFrame'])Object.defineProperty(sandbox,name,{get:()=>blocked(name)});
 sandbox.window=sandbox;sandbox.self=sandbox;sandbox.top=sandbox;sandbox.ReserveCourseNavArt=Art;
 assert.doesNotThrow(()=>vm.runInNewContext(read('course-nav.js'),sandbox,{filename:'course-nav.js',timeout:1000}));
 assert.ok(guarded>0,'consults ReserveSite.vanillaPage');assert.deepEqual(touches,[]);assert.equal(sandbox.ReserveCourseNav,undefined);
});

test('pages without a scoped course menu do not load styles, storage or observers',async()=>{
 for(const menu of ['none','outside']){
  const f=fixture({menu});const item=f.addItem({className:'home'});await f.start();assertInactive(f);assert.equal(item.anchor.querySelector('.cn-icon'),null);
 }
});

test('DOMContentLoaded activates a loading document only when its course menu is ready',async()=>{
 const f=fixture({readyState:'loading'}),item=f.addItem({className:'home'});await f.start();assert.ok(f.html.classList.contains('reserve-course-nav'));assertUnstarted(f);assert.equal(item.anchor.querySelector('.cn-icon'),null);
 f.document.readyState='interactive';f.document.dispatchEvent({type:'DOMContentLoaded'});await f.flush();assertIcon(item.anchor,'home');assert.ok(f.html.classList.contains('reserve-course-nav'));assert.equal(typeof f.context.ReserveCourseNav?.kindOf,'function');
 const links=[...f.document.head.children];f.document.dispatchEvent({type:'DOMContentLoaded'});await f.flush();assert.deepEqual(f.document.head.children,links);assertIcon(item.anchor,'home');
});

test('the course class is added at script start and removed at DOMContentLoaded without a menu or after navigation to an assignment',async()=>{
 for(const menu of ['none','left']){
  const f=fixture({menu,readyState:'loading'}),item=f.addItem({className:'home',active:true,badge:'2'});
  assert.equal(f.html.classList.contains('reserve-course-nav'),false);
  f.run();assert.ok(f.html.classList.contains('reserve-course-nav'),'eligible routes opt in synchronously');assertUnstarted(f);
  assert.equal(item.anchor.querySelector('.cn-icon, .cn-tab, .cn-seal'),null);
  if(menu==='none')assert.equal(f.document.querySelector('#section-tabs'),null);
  else f.context.location=new URL('https://school.instructure.com/courses/7/assignments/12');
  f.document.readyState='interactive';f.document.dispatchEvent({type:'DOMContentLoaded'});await f.flush();
  assertInactive(f);assert.equal(item.anchor.querySelector('.cn-icon, .cn-tab, .cn-seal'),null);assert.equal(item.anchor.classList.contains('cn-i'),false);
 }
});

for(const onLi of [false,true])test('every art-map class on '+(onLi?'the list item':'the anchor')+' selects its exact icon and retains Canvas content',async()=>{
 const f=fixture(),entries=Object.entries(Art.map);assert.ok(entries.length>0);
 const items=entries.map(([className,kind],index)=>({kind,...f.addItem({className,onLi,label:'Course item '+index,plainLabel:index%2===0,href:'/courses/7/'+className+'?view=all#canvas',hidden:index===2})}));
 const unknown=f.addItem({className:'unrecognised_canvas_tool',label:'Custom school tool'});items.push({kind:'tool',...unknown});
 const order=[...f.list.children],snapshots=items.map(({li,anchor,labelNode})=>({li,anchor,labelNode,label:anchor.textContent,href:anchor.getAttribute('href'),liClass:li.className,anchorClass:anchor.className,hidden:li.hidden}));
 await f.start();
 assert.deepEqual(f.list.children,order,'keeps item identity and order');assert.equal(f.list.parentElement,f.wrapper);
 for(let index=0;index<items.length;index++){
  const item=items[index],before=snapshots[index];assert.equal(item.anchor.parentElement,item.li);assert.equal(item.labelNode.parentElement,item.anchor);assert.equal(item.anchor.textContent,before.label);assert.equal(item.anchor.getAttribute('href'),before.href);assert.equal(item.anchor.getAttribute('title'),before.label);assert.equal(item.anchor.dataset.canvasValue,'kept');assert.equal(item.li.hidden,before.hidden);
  for(const name of before.liClass.split(/\s+/).filter(Boolean))assert.ok(item.li.classList.contains(name),'keeps Canvas li class '+name);
  for(const name of before.anchorClass.split(/\s+/).filter(Boolean))assert.ok(item.anchor.classList.contains(name),'keeps Canvas anchor class '+name);
  assertIcon(item.anchor,item.kind);assert.equal(f.context.ReserveCourseNav.kindOf(item.anchor),item.kind);
 }
 assert.equal(f.outside.querySelector('.cn-icon'),null,'never decorates an unrelated Canvas link');assert.deepEqual(f.storageWrites,[]);
});

test('both supported course-menu containers conditionally load only the art stylesheet at runtime',async()=>{
 for(const menu of ['left','labelled']){
  const f=fixture({menu});f.addItem({className:'modules'});await f.start();
  assert.equal(f.html.classList.contains('reserve-course-nav'),true);assert.equal(typeof f.context.ReserveCourseNav?.kindOf,'function');
  const links=f.document.head.querySelectorAll('link');assert.equal(links.length,1);assert.deepEqual(links.map(link=>link.href),['chrome-extension://test/course-nav-art.css']);assert.deepEqual(f.requestedURLs,['course-nav-art.css']);
  for(const link of links)assert.equal(link.rel||link.getAttribute('rel'),'stylesheet');
 }
});

test('active links gain a decorative tab and badges keep their original number node behind a seal',async()=>{
 const f=fixture(),active=f.addItem({className:'grades',active:true,badge:'12'}),other=f.addItem({className:'assignments',badge:'3'});
 const number=active.numberNode;await f.start();
 assert.ok(active.anchor.classList.contains('active'));assert.ok(active.anchor.classList.contains('is-current'));assert.equal(other.anchor.classList.contains('is-current'),false);assert.equal(other.anchor.querySelector('.cn-tab'),null);
 const tab=active.anchor.querySelector('.cn-tab');assert.ok(tab);assert.equal(tab.innerHTML,Art.tab);assert.equal(tab.getAttribute('aria-hidden'),'true');
 for(const item of [active,other]){
  const seals=item.badge.querySelectorAll('.cn-seal');assert.equal(seals.length,1);assert.equal(seals[0].innerHTML,Art.seal);assert.equal(seals[0].getAttribute('aria-hidden'),'true');assert.equal(item.numberNode.parentNode,item.badge);assert.equal(item.badge.textContent,item===active?'12':'3');
 }
 assert.equal(active.badge.childNodes.includes(number),true,'the Canvas number node is not replaced');
});

test('only the first external-tool item is marked as the start of that group',async()=>{
 const f=fixture();f.addItem({className:'home'});
 const first=f.addItem({className:'context_external_tool_17'});f.addItem({className:'pages'});const second=f.addItem({className:'context_external_tool_22',onLi:true});const third=f.addItem({className:'context_external_tool_31'});
 await f.start();
 const marked=f.list.querySelectorAll('.cn-external-start');assert.equal(marked.length,1);assert.ok(marked[0]===first.anchor||marked[0]===first.li);
 for(const item of [second,third]){assert.equal(item.anchor.classList.contains('cn-external-start'),false);assert.equal(item.li.classList.contains('cn-external-start'),false);}
 for(const item of [first,second,third])assertIcon(item.anchor,'tool');
 f.list.prepend(third.li);await f.flush();assert.equal(f.list.querySelectorAll('.cn-external-start').length,1);assert.ok(third.li.classList.contains('cn-external-start')||third.anchor.classList.contains('cn-external-start'));assert.equal(first.li.classList.contains('cn-external-start'),false);assert.equal(first.anchor.classList.contains('cn-external-start'),false);
 third.li.remove();await f.flush();const restored=f.list.querySelectorAll('.cn-external-start');assert.equal(restored.length,1);assert.ok(restored[0]===first.li||restored[0]===first.anchor);
});

test('the observer watches only the menu and later items and badges are decorated once',async()=>{
 const f=fixture(),first=f.addItem({className:'home',active:true,badge:'2'});await f.start();
 assert.ok(f.observations.length>0,'observes subsequent Canvas changes');
 for(const {target,options}of f.observations){assert.equal(target,f.list,'no document/body/sidebar observer');assert.equal(options.childList,true);assert.equal(options.subtree,true);}
 const icon=assertIcon(first.anchor,'home'),tab=first.anchor.querySelector('.cn-tab'),seal=first.badge.querySelector('.cn-seal');
 const later=f.addItem({className:'files',onLi:true,label:'Added later'}),external=f.addItem({className:'context_external_tool_81'});await f.flush();
 const laterIcon=assertIcon(later.anchor,'files');assertIcon(external.anchor,'tool');
 const badge=f.el('span',{class:'nav-badge'},'47');later.anchor.append(badge);await f.flush();assert.equal(badge.querySelectorAll('.cn-seal').length,1);assert.equal(badge.textContent,'47');
 // Trigger another full childList delivery, including mutations caused by art.
 later.anchor.append(f.el('span',{class:'canvas-status'},' '));await f.flush();
 assert.equal(assertIcon(first.anchor,'home'),icon);assert.equal(assertIcon(later.anchor,'files'),laterIcon);assert.equal(first.anchor.querySelectorAll('.cn-tab').length,1);assert.equal(first.anchor.querySelector('.cn-tab'),tab);assert.equal(first.badge.querySelectorAll('.cn-seal').length,1);assert.equal(first.badge.querySelector('.cn-seal'),seal);assert.equal(badge.querySelectorAll('.cn-seal').length,1);
 assert.equal(f.list.querySelectorAll('.cn-external-start').length,1);assert.equal(f.document.head.querySelectorAll('link').length,1);
});

test('the menu stays light like the Canvas page in either theme; motion follows the device preference',async()=>{
 for(const [theme,osDark]of [['dark',false],['light',true],[undefined,true],['system',true]]){
  const f=fixture({appearance:theme===undefined?undefined:{theme},osDark});f.addItem({className:'home'});await f.start();
  assert.equal(f.html.dataset.cnTheme,undefined,'no dark menu on a light Canvas page');assert.ok(f.storageReads.length>0);assert.ok(f.storageReads.some(keys=>typeof keys==='string'?keys===APPEARANCE:Array.isArray(keys)?keys.includes(APPEARANCE):keys&&Object.hasOwn(keys,APPEARANCE)),'reads reserve:appearance');
  assert.ok(f.storageListeners.size>0,'subscribes to preference changes');
  await f.changeAppearance({theme:'dark',motion:'off'});assert.equal(f.html.dataset.cnTheme,undefined);assert.equal(f.html.dataset.cnMotion,'off');
  await f.changeAppearance({theme:'light',motion:'gentle'},'sync');assert.equal(f.html.dataset.cnMotion,'off','ignores another storage area');
  await f.changeAppearance({theme:'light',motion:'gentle'},'local','unrelated');assert.equal(f.html.dataset.cnMotion,'off','ignores unrelated preferences');
  await f.changeAppearance({theme:'light',motion:'gentle'});assert.equal(f.html.dataset.cnMotion,'on');await f.changeAppearance(undefined);assert.equal(f.html.dataset.cnMotion,'on');
  assert.equal(f.mediaQueries.some(query=>query.includes('prefers-color-scheme')),false);assert.deepEqual(f.storageWrites,[]);
 }
});

test('assignment routes and a route changing before DOMContentLoaded stay vanilla with the real site guard',async()=>{
 for(const pathname of ['/courses/7/assignments/12','/courses/7/assignments/12/submissions/new','/courses/7/assignments/12/submissions/42']){
  const f=fixture();f.addItem({className:'home'});f.context.location=new URL('https://school.instructure.com'+pathname+'?module_item_id=25#details');await f.start();assertInactive(f);assert.equal(f.document.listeners.size,0);
 }
 const f=fixture({readyState:'loading'});f.addItem({className:'home'});await f.start();f.context.location=new URL('https://school.instructure.com/courses/7/assignments/12');f.document.dispatchEvent({type:'DOMContentLoaded'});await f.flush();assertInactive(f);
});

test('a late appearance read cannot overwrite a newer preference change, and a failed read keeps Canvas usable',async()=>{
 let release;
 const delayed=new Promise(resolve=>{release=resolve;}),f=fixture({storageRead:()=>delayed});f.addItem({className:'home'});await f.start();
 await f.changeAppearance({motion:'off'});release({[APPEARANCE]:{motion:'gentle'}});await f.flush();assert.equal(f.html.dataset.cnMotion,'off');
 const failed=fixture({storageRead:()=>Promise.reject(Error('Storage unavailable'))}),item=failed.addItem({className:'modules'});await failed.start();assertIcon(item.anchor,'modules');assert.equal(failed.html.dataset.cnMotion,'on');assert.deepEqual(failed.storageWrites,[]);
});

test('the current icon finishes its opening action after the art stylesheet loads and reinitializing adds nothing',async()=>{
 const f=fixture(),item=f.addItem({className:'modules',active:true});await f.start();
 const links=[...f.document.head.children],icon=assertIcon(item.anchor,'modules'),tab=item.anchor.querySelector('.cn-tab');assert.ok(item.anchor.classList.contains('cn-opening'));
 assert.equal(links.length,1);assert.equal(links[0].href,'chrome-extension://test/course-nav-art.css');assert.equal(f.pendingTimers(),0,'the opening action waits for the art stylesheet');
 links[0].onload();await f.flush();assert.ok(f.pendingTimers()>0);assert.ok(item.anchor.classList.contains('cn-opening'),'the action remains until its timer finishes');await f.finishTimers();assert.equal(item.anchor.classList.contains('cn-opening'),false);assert.ok(item.anchor.classList.contains('is-current'));assert.equal(item.anchor.querySelector('.cn-tab'),tab);
 const observations=f.observations.length,reads=f.storageReads.length;f.run();await f.flush();assert.deepEqual(f.document.head.children,links);assert.equal(f.observations.length,observations);assert.equal(f.storageReads.length,reads);assert.equal(assertIcon(item.anchor,'modules'),icon);assert.equal(f.pendingTimers(),0);
});

// Read rule blocks and selector lists outside strings/functions. This is a
// source audit of the custom CSS and supplied actions, not a CSS layout engine.
function punctuation(text,marks){
 const out=[];let quote='',depth=0;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue;}
  if(c==='"'||c==="'"){quote=c;continue;}
  if(c==='('||c==='[')depth++;else if(c===')'||c===']')depth--;
  else if(!depth&&marks.includes(c))out.push({char:c,index:i});
 }
 assert.equal(quote,'');assert.equal(depth,0);return out;
}
function cssRules(source,parents=[],out=[]){
 const css=source.replace(/\/\*[\s\S]*?\*\//g,''),tokens=punctuation(css,'{};');let start=0;
 for(let i=0;i<tokens.length;i++){
  const token=tokens[i],prelude=css.slice(start,token.index).trim();assert.equal(token.char,'{','Expected CSS rule: '+prelude);let depth=1,end=i;
  while(depth&&++end<tokens.length){if(tokens[end].char==='{')depth++;else if(tokens[end].char==='}')depth--;}
  assert.equal(depth,0,'Unclosed CSS rule');const body=css.slice(token.index+1,tokens[end].index);
  if(/^@(media|supports|container|layer)\b/.test(prelude))cssRules(body,[...parents,prelude],out);
  else if(prelude.startsWith('@'))assert.match(prelude,/^@(?:-webkit-)?keyframes\b/,'Unexpected unscoped at-rule');
  else{
   let from=0;
   for(const mark of [...punctuation(prelude,','),{index:prelude.length}]){out.push({selector:prelude.slice(from,mark.index).trim(),body,parents});from=mark.index+1;}
  }
  start=tokens[end].index+1;i=end;
 }
 assert.equal(css.slice(start).trim(),'','Unparsed CSS');return out;
}
const declaration=(body,name)=>body.match(new RegExp('(?:^|;)\\s*'+name+'\\s*:\\s*([^;]+)'))?.[1].trim()||'';

test('custom course-menu CSS requires its html gate, no dark palette and reduced-motion suppression',async()=>{
 const css=read('course-nav.css'),rules=cssRules(css);assert.ok(rules.length>0);
 for(const {selector}of rules)assert.match(selector,/^html(?:\.reserve-course-nav|:where\(\.reserve-course-nav\))(?=[\s.#[:>+~]|$)/,'Ungated custom selector: '+selector);
 assert.ok(!rules.some(rule=>/data-cn-theme/.test(rule.selector)),'no dark menu: it matches the light Canvas page');assert.doesNotMatch(css,/prefers-color-scheme/i);
 assert.ok(rules.some(rule=>rule.parents.some(parent=>/prefers-reduced-motion\s*:\s*reduce/.test(parent))&&/svg\s+\*/.test(rule.selector)&&/^none\s*!important$/.test(declaration(rule.body,'animation'))),'OS reduced motion suppresses generated icon actions');
 assert.ok(rules.some(rule=>/\[data-cn-motion=['"]?off['"]?\]/.test(rule.selector)&&/^none\s*!important$/.test(declaration(rule.body,'animation'))),'the device motion preference also suppresses actions');
 const f=fixture({appearance:{motion:'off'}});f.addItem({className:'home'});await f.start();assert.equal(f.html.dataset.cnMotion,'off');await f.changeAppearance({motion:'gentle'});assert.equal(f.html.dataset.cnMotion,'on');await f.changeAppearance({motion:'still'});assert.equal(f.html.dataset.cnMotion,'off');
});

test('each supplied hover/focus action has a current-page opening action with a single iteration',()=>{
 const generated=cssRules(read('course-nav-art.css')),custom=cssRules(read('course-nav.css')),all=[...generated,...custom];
 const actions=generated.filter(rule=>/:hover/.test(rule.selector)&&declaration(rule.body,'animation'));assert.ok(actions.length>0);
 for(const action of actions){
  assert.match(action.selector,/:focus-visible/,'keyboard focus has the same action as hover');
  const target=action.selector.trim().split(/\s+/).at(-1),animation=declaration(action.body,'animation'),name=animation.split(/\s+/)[0];
  assert.ok(all.some(rule=>rule.selector.trim().endsWith(' '+target)&&/\.(?:is-current|cn-opening)\b/.test(rule.selector)&&declaration(rule.body,'animation').split(/\s+/)[0]===name),'opening action for '+target);
  const iterations=animation.replace(/[\w-]+\([^)]*\)/g,'').split(/\s+/).filter(value=>/^\d+(?:\.\d+)?$/.test(value));
  if(iterations.some(value=>Number(value)>1))assert.ok(custom.some(rule=>rule.selector.trim().endsWith(' '+target)&&declaration(rule.body,'animation-iteration-count')==='1'),'repeating supplied action is limited to one iteration: '+target);
 }
 for(const rule of all)assert.doesNotMatch(declaration(rule.body,'animation')+' '+declaration(rule.body,'animation-iteration-count'),/\binfinite\b/,'No looping icon actions: '+rule.selector);
});
