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
 constructor(value,document){this.nodeType=3;this._data=String(value);this.ownerDocument=document;this.parentNode=null;}
 get data(){return this._data;}
 set data(value){const oldValue=this._data;this._data=String(value);this.ownerDocument.mutation({type:'characterData',target:this,oldValue});}
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
 get rel(){return this.getAttribute('rel')||'';}
 set rel(value){this.setAttribute('rel',value);}
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
 contains(node){return node===this||this.childNodes.some(child=>child===node||child.contains?.(node));}
 matches(selector){return matches(this,selector);}
 closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
 querySelectorAll(selector){const found=[];const visit=node=>{for(const child of node.children){if(matches(child,selector,this))found.push(child);visit(child);}};visit(this);return found;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 get textContent(){return this._html.replace(/<[^>]*>/g,'')+this.childNodes.map(node=>node.textContent).join('');}
 set textContent(value){this.innerHTML='';if(String(value))this.append(String(value));}
 get innerHTML(){return this._html+this.childNodes.map(node=>node.nodeType===3?node.data:node.outerHTML).join('');}
 set innerHTML(value){for(const node of [...this.childNodes])this.removeChild(node);this._html=String(value);this.ownerDocument.mutation({type:'childList',target:this,addedNodes:[],removedNodes:[]});}
 get outerHTML(){return '<'+this.tagName.toLowerCase()+[...this.attrs].map(([key,value])=>' '+key+'="'+value+'"').join('')+'>'+this.innerHTML+'</'+this.tagName.toLowerCase()+'>';}
}

function fixture({url='https://school.instructure.com/courses/7/modules',modules=true,readyState='complete',appearance}={}){
 const observers=[],observations=[],mutations=[],created=[],storageReads=[],storageWrites=[],storageListeners=new Set(),requestedURLs=[];
 const document=new Events();document.nodeType=9;document.readyState=readyState;
 document.mutation=record=>{
  record={addedNodes:[],removedNodes:[],...record};mutations.push(record);
  for(const observer of observers)for(const {target,options}of observer.targets){
   if(record.target!==target&&!(options.subtree&&target.contains(record.target)))continue;
   if(record.type==='childList'?options.childList:record.type==='characterData'?options.characterData:options.attributes&&(!options.attributeFilter||options.attributeFilter.includes(record.attributeName)))observer.records.push(record);
  }
 };
 document.createElement=tag=>{const node=new Element(tag,document);created.push(node);return node;};
 document.createTextNode=value=>{const node=new TextNode(value,document);created.push(node);return node;};
 const el=(tag,attrs={},...children)=>{const node=document.createElement(tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);node.append(...children);return node;};
 document.documentElement=el('html',{class:'canvas-page'});document.head=el('head');document.body=el('body');document.documentElement.append(document.head,document.body);
 document.querySelector=selector=>matches(document.documentElement,selector)?document.documentElement:document.documentElement.querySelector(selector);
 document.querySelectorAll=selector=>[...(matches(document.documentElement,selector)?[document.documentElement]:[]),...document.documentElement.querySelectorAll(selector)];
 document.getElementById=id=>document.querySelector('#'+id);
 const list=el('div',{id:modules?'context_modules':'unrelated_modules'}),items=el('ul',{class:'context_module_items'});list.append(items);document.body.append(list);
 const addItem=({className='assignment',parent=items,nestedRow=false}={})=>{
  const li=el('li',{class:'context_module_item '+className,'data-canvas-value':'kept'});
  const canvasIcon=el('i',{class:'icon-canvas-original','aria-hidden':'true'}),host=el('span',{class:'ig-type-icon'},canvasIcon);
  const label=el('a',{class:'ig-title',href:'/courses/7/pages/item'},'Canvas item'),row=el('div',{class:'ig-row'},host,label);
  // A descendant row before the direct row catches an overbroad .ig-row query.
  const descendant=nestedRow?el('div',{class:'ig-row'}):null;
  if(descendant)li.append(el('div',{class:'canvas-details'},descendant));
  li.append(row);parent.append(li);return {li,row,host,canvasIcon,label,descendant};
 };
 const data={[APPEARANCE]:appearance};
 const sandbox={document,console,URL,location:new URL(url),
  MutationObserver:class{
   constructor(callback){this.callback=callback;this.targets=[];this.records=[];this.deliveries=0;observers.push(this);}
   observe(target,options){this.targets.push({target,options});observations.push({target,options});}
   disconnect(){this.targets=[];this.records=[];}
   takeRecords(){return this.records.splice(0);}
  },
  chrome:{runtime:{getURL:name=>{requestedURLs.push(name);return 'chrome-extension://test/'+name;}},storage:{
   local:{get(keys){storageReads.push(keys);return Promise.resolve(structuredClone(data));},set(values){storageWrites.push(values);return Promise.resolve();}},
   onChanged:{addListener:fn=>storageListeners.add(fn),removeListener:fn=>storageListeners.delete(fn)}
  }}
 };
 sandbox.window=sandbox;sandbox.self=sandbox;sandbox.top=sandbox;
 const context=vm.createContext(sandbox);
 vm.runInContext(read('site.js'),context,{filename:'site.js',timeout:1000});
 vm.runInContext(read('course-nav-art.js'),context,{filename:'course-nav-art.js',timeout:1000});
 const run=()=>vm.runInContext(read('modules-page.js'),context,{filename:'modules-page.js',timeout:1000});
 async function flush(){
  // Deliver mutations caused by Canvas and the decorations themselves. A loop
  // that redecorates its own insertions must fail rather than hang the suite.
  for(let round=0;round<30;round++){
   await new Promise(setImmediate);let work=false;
   for(const observer of observers){const records=observer.takeRecords();if(records.length){work=true;observer.deliveries++;observer.callback(records,observer);}}
   if(!work)return;
  }
  assert.fail('Modules-page mutations did not settle within 30 deliveries');
 }
 async function start(){run();await flush();}
 async function changeAppearance(value,area='local',key=APPEARANCE){data[key]=value;for(const listener of storageListeners)listener({[key]:{newValue:value}},area);await flush();}
 return {context,document,html:document.documentElement,list,items,addItem,el,observers,observations,mutations,created,storageReads,storageWrites,storageListeners,requestedURLs,run,start,flush,changeAppearance};
}

function assertIcon(item,kind){
 assert.equal(item.li.getAttribute('data-md-icon'),kind,'the item records the selected kind');
 const icons=item.li.querySelectorAll('.md-icon');assert.equal(icons.length,1,'exactly one icon for '+kind);
 const icon=icons[0];assert.equal(icon.tagName,'SPAN');assert.equal(icon.parentElement,item.host);
 assert.equal(icon.innerHTML,Art.icons[kind],'uses the supplied '+kind+' SVG verbatim');assert.equal(icon.getAttribute('aria-hidden'),'true');
 assert.ok(item.row.classList.contains('cn-i'),'the direct row hosts the icon action');
 assert.equal(item.canvasIcon.parentElement,item.host,'the Canvas icon keeps its original parent');
 assert.deepEqual(item.host.querySelectorAll('i'),[item.canvasIcon],'the original Canvas icon is retained');
 return icon;
}
function assertSheets(f){
 const links=f.document.querySelectorAll('link[rel="stylesheet"]');
 assert.equal(links.length,2);
 assert.deepEqual(links.map(link=>link.href).sort(),['chrome-extension://test/course-nav-art.css','chrome-extension://test/modules-page.css']);
 for(const link of links){assert.equal(link.parentElement,f.document.head);assert.equal(link.rel,'stylesheet');}
 return links;
}
function assertInactive(f){
 assert.equal(f.html.classList.contains('reserve-modules'),false);assert.equal(f.html.dataset.mdMotion,undefined);assert.equal(f.context.ReserveModulesPage,undefined);
 assert.equal(f.document.head.children.length,0);assert.equal(f.document.querySelectorAll('.md-icon').length,0);assert.equal(f.document.querySelectorAll('[data-md-icon]').length,0);
 assert.equal(f.document.querySelectorAll('.cn-i').length,0);assert.deepEqual(f.requestedURLs,[]);assert.deepEqual(f.storageReads,[]);assert.deepEqual(f.storageWrites,[]);
 assert.equal(f.storageListeners.size,0);assert.equal(f.observers.length,0);
}
function snapshot(f){return {html:f.html.outerHTML,mutations:f.mutations.length,created:f.created.length};}
function assertUntouched(f,before){
 assert.equal(f.html.outerHTML,before.html,'the Canvas DOM is unchanged');
 assert.equal(f.mutations.length,before.mutations,'no DOM mutation, even a same-value attribute write');
 assert.equal(f.created.length,before.created,'no DOM nodes created');
}

test('decorated module items keep empty due dates current after text edits, removals and child replacement',async()=>{
 const f=fixture(),item=f.addItem(),due=f.el('span',{class:'due_date_display'},'   ');item.row.append(due);await f.start();
 const icon=assertIcon(item,'assignments');assert.equal(due.classList.contains('md-empty'),true);
 due.firstChild.data='Due tomorrow';await f.flush();assert.equal(due.classList.contains('md-empty'),false);assert.equal(assertIcon(item,'assignments'),icon);
 due.removeChild(due.firstChild);await f.flush();assert.equal(due.classList.contains('md-empty'),true);
 due.append(f.el('span',{},'Due next week'));await f.flush();assert.equal(due.classList.contains('md-empty'),false);
 due.children[0].remove();await f.flush();assert.equal(due.classList.contains('md-empty'),true);
 const replacement=f.el('span',{class:'due_date_display'},'Due Friday');item.row.append(replacement);await f.flush();assert.equal(replacement.classList.contains('md-empty'),false);
 replacement.textContent='';await f.flush();assert.equal(replacement.classList.contains('md-empty'),true);assert.equal(assertIcon(item,'assignments'),icon);assertSheets(f);
});

test('the modules route decorates every item kind, loads both sheets once and preserves Canvas content',async()=>{
 const f=fixture(),kinds=[
  ['assignment','assignments'],['quiz','quizzes'],['lti-quiz','quizzes'],['discussion_topic','discussions'],
  ['wiki_page','pages'],['attachment','files'],['external_url','tool'],['context_external_tool','tool'],['unknown_canvas_tool','tool']
 ];
 const entries=kinds.map(([className,kind],index)=>({kind,...f.addItem({className,nestedRow:index===0})}));
 const outside=f.addItem({parent:f.document.body}),order=[...f.items.children],labels=entries.map(item=>item.label.outerHTML);
 await f.start();
 assert.ok(f.html.classList.contains('reserve-modules'));assert.ok(f.html.classList.contains('canvas-page'));assertSheets(f);
 assert.deepEqual(f.requestedURLs,['course-nav-art.css','modules-page.css']);assert.deepEqual(f.items.children,order);
 for(const [index,item]of entries.entries()){
  assertIcon(item,item.kind);assert.equal(item.label.outerHTML,labels[index]);assert.equal(item.li.dataset.canvasValue,'kept');
  assert.equal(item.label.parentElement,item.row);assert.equal(item.canvasIcon.className,'icon-canvas-original');
  if(item.descendant)assert.equal(item.descendant.classList.contains('cn-i'),false,'only the direct row gets cn-i');
 }
 assert.equal(f.list.querySelectorAll('.md-icon').length,entries.length);
 assert.equal(outside.li.querySelector('.md-icon'),null);assert.equal(outside.li.dataset.mdIcon,undefined);assert.equal(outside.row.classList.contains('cn-i'),false);
 assert.deepEqual(f.storageWrites,[]);
});

test('sub-headers get no icon and repeated starts and observer deliveries do not duplicate decorations',async()=>{
 const f=fixture(),heading=f.addItem({className:'context_module_sub_header'}),item=f.addItem(),predecorated=f.addItem({className:'quiz'});
 const existing=f.el('span',{class:'md-icon','aria-hidden':'true'});existing.innerHTML=Art.icons.quizzes;
 predecorated.host.append(existing);predecorated.li.dataset.mdIcon='quizzes';predecorated.row.classList.add('cn-i');
 await f.start();const icon=assertIcon(item,'assignments'),links=assertSheets(f),observer=f.observers[0],api=f.context.ReserveModulesPage;
 assert.equal(assertIcon(predecorated,'quizzes'),existing);
 const reads=f.storageReads.length,listeners=f.storageListeners.size,observations=f.observations.length;
 await f.start();
 assert.equal(f.context.ReserveModulesPage,api);assert.equal(f.observers.length,1);assert.equal(f.observations.length,observations);
 assert.equal(f.storageReads.length,reads);assert.equal(f.storageListeners.size,listeners);assert.deepEqual(f.document.head.children,links);
 assert.deepEqual(f.requestedURLs,['course-nav-art.css','modules-page.css']);
 item.row.append(f.el('span',{class:'canvas-status'},'Published'));await f.flush();
 assert.ok(observer.deliveries>0,'a later Canvas mutation reruns decoration');
 assert.equal(assertIcon(item,'assignments'),icon);assert.equal(assertIcon(predecorated,'quizzes'),existing);assertSheets(f);
 assert.equal(heading.li.dataset.mdIcon,'');assert.equal(heading.li.querySelector('.md-icon'),null);
 assert.equal(heading.row.classList.contains('cn-i'),false);assert.equal(heading.canvasIcon.parentElement,heading.host);
});

test('pre-existing stylesheet links are reused individually and together',async()=>{
 for(const files of [['course-nav-art.css'],['modules-page.css'],['course-nav-art.css','modules-page.css']]){
  const f=fixture(),existing=files.map(file=>f.el('link',{rel:'stylesheet',href:'chrome-extension://test/'+file}));
  f.document.head.append(...existing);const item=f.addItem();await f.start();const links=assertSheets(f);
  for(const link of existing)assert.ok(links.includes(link),'the existing link is reused by identity');
  assertIcon(item,'assignments');await f.start();assert.deepEqual(f.document.head.children,links);
 }
});

test('the observer decorates items appended later, including items inside a newly loaded module',async()=>{
 const f=fixture(),first=f.addItem();await f.start();const firstIcon=assertIcon(first,'assignments');
 assert.equal(f.observers.length,1);assert.equal(f.observations.length,1);
 const {target,options}=f.observations[0];assert.equal(target,f.list);assert.equal(options.childList,true);assert.equal(options.subtree,true);
 const later=f.addItem({className:'attachment'}),newModule=f.el('ul',{class:'context_module_items'});
 const nested=f.addItem({className:'discussion_topic',parent:newModule}),heading=f.addItem({className:'context_module_sub_header',parent:newModule});
 f.list.append(newModule);
 assert.equal(later.li.querySelector('.md-icon'),null,'the observer has not been delivered yet');
 await f.flush();
 const laterIcon=assertIcon(later,'files'),nestedIcon=assertIcon(nested,'discussions');assert.equal(assertIcon(first,'assignments'),firstIcon);
 assert.equal(heading.li.querySelector('.md-icon'),null);assert.equal(heading.row.classList.contains('cn-i'),false);
 assert.ok(f.observers[0].deliveries>=2,'also delivers feedback from inserted icons');
 f.observers[0].callback([{type:'childList',target:f.items,addedNodes:[later.li],removedNodes:[]}]);await f.flush();
 assert.equal(assertIcon(later,'files'),laterIcon);assert.equal(assertIcon(nested,'discussions'),nestedIcon);assertSheets(f);
});

for(const url of [
 'https://school.instructure.com/courses/7/assignments/12',
 'https://school.instructure.com/courses/7/assignments/12/submissions/3',
 'https://school.instructure.com/courses/7/files',
 'https://example.com/courses/7/modules'
])test('route gating leaves '+url+' untouched',async()=>{
 const f=fixture({url}),item=f.addItem(),before=snapshot(f);await f.start();assertInactive(f);assertUntouched(f,before);
 assert.equal(item.canvasIcon.parentElement,item.host);assert.equal(f.document.listeners.size,0);
});

test('the course home is decorated only when context_modules exists',async()=>{
 for(const modules of [true,false]){
  const f=fixture({url:'https://school.instructure.com/courses/7',modules}),item=f.addItem(),before=snapshot(f);await f.start();
  if(modules){assert.ok(f.html.classList.contains('reserve-modules'));assertIcon(item,'assignments');assertSheets(f);}
  else{assertInactive(f);assertUntouched(f,before);}
 }
});

test('a modules page without context_modules never mutates or creates DOM, even at DOMContentLoaded',async()=>{
 for(const readyState of ['complete','loading']){
  const f=fixture({modules:false,readyState});f.addItem();const before=snapshot(f);await f.start();assertInactive(f);assertUntouched(f,before);
  f.document.readyState='interactive';f.document.dispatchEvent({type:'DOMContentLoaded'});await f.flush();
  assertInactive(f);assertUntouched(f,before);
 }
});

test('a loading page waits for DOMContentLoaded and finds modules that are present by then',async()=>{
 const f=fixture({modules:false,readyState:'loading'}),item=f.addItem(),before=snapshot(f);
 await f.start();assertInactive(f);assertUntouched(f,before);
 f.list.id='context_modules';f.document.readyState='interactive';f.document.dispatchEvent({type:'DOMContentLoaded'});await f.flush();
 const icon=assertIcon(item,'assignments'),links=assertSheets(f);assert.ok(f.html.classList.contains('reserve-modules'));
 f.document.dispatchEvent({type:'DOMContentLoaded'});await f.flush();assert.equal(assertIcon(item,'assignments'),icon);assert.deepEqual(f.document.head.children,links);assert.equal(f.observers.length,1);
});

test('a route that becomes vanilla before DOMContentLoaded stays untouched',async()=>{
 const f=fixture({readyState:'loading'});f.addItem();await f.start();const before=snapshot(f);
 f.context.location=new URL('https://school.instructure.com/courses/7/assignments/12/submissions/3');
 f.document.dispatchEvent({type:'DOMContentLoaded'});await f.flush();assertInactive(f);assertUntouched(f,before);
});

for(const [appearance,expected]of [[{motion:'still'},'off'],[{motion:'off'},'off'],[{motion:'gentle'},'on'],[{},'on'],[undefined,'on']]){
 test('initial motion '+JSON.stringify(appearance)+' maps to '+expected,async()=>{
  const f=fixture({appearance});f.addItem();await f.start();assert.equal(f.html.dataset.mdMotion,expected);
  assert.deepEqual(f.storageReads,[APPEARANCE]);assert.equal(f.storageListeners.size,1);assert.deepEqual(f.storageWrites,[]);
 });
}

test('local appearance changes update motion; other areas and keys are ignored',async()=>{
 const f=fixture({appearance:{motion:'gentle'}});f.addItem();await f.start();assert.equal(f.html.dataset.mdMotion,'on');
 for(const area of ['sync','session']){const before=snapshot(f);await f.changeAppearance({motion:'off'},area);assert.equal(f.html.dataset.mdMotion,'on');assertUntouched(f,before);}
 const before=snapshot(f);await f.changeAppearance({motion:'off'},'local','unrelated');assert.equal(f.html.dataset.mdMotion,'on');assertUntouched(f,before);
 await f.changeAppearance({motion:'still'});assert.equal(f.html.dataset.mdMotion,'off');
 await f.changeAppearance({motion:'gentle'});assert.equal(f.html.dataset.mdMotion,'on');
 await f.changeAppearance({motion:'off'});assert.equal(f.html.dataset.mdMotion,'off');
 await f.changeAppearance(undefined);assert.equal(f.html.dataset.mdMotion,'on','removing the preference restores default motion');
 assert.deepEqual(f.storageWrites,[]);
});
