'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
const roomArt={};
vm.runInNewContext(read('welcome-room.js'),roomArt,{filename:'welcome-room.js'});
const settle=async()=>{for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve));};
const INTRO_END=5.503,INTRO_READY=5.103;
const PONY_NIGHT_FILTER='brightness(.74) saturate(.72) sepia(.16)',PONY_UNLIT_FILTER='brightness(.34) saturate(.35)';
const start=async h=>{const button=h.ids.get('intro-start');assert.ok(button,'intro has its own Start button');assert.equal(button.disabled,false,'Start is ready before activation');button.fire('click');await settle();};
const nextStep=async h=>{
 assert.equal(h.document.querySelector('.tour-footer').hidden,false,'forward controls are used after leaving the intro');
 const room=h.ids.get('tour').dataset.currentStep==='appearance',theme=h.document.documentElement.dataset.theme;
 // In the room a window is clicked first; only then does its sign read Continue.
 if(room&&h.nodes.find(n=>n.dataset.themeContinue===theme).hidden){h.nodes.find(n=>n.dataset.themeChoice===theme).fire('click');await settle();}
 const button=room?h.nodes.find(n=>n.dataset.themeContinue===h.document.documentElement.dataset.theme):h.ids.get('next');
 assert.equal(button.hidden,false);assert.equal(button.disabled,false);button.fire('click');await settle();
};
const completeSchool=async h=>{
 await settle();
 // The real school handoff holds its spotlight and loading line for 300 ms. This
 // fixture intentionally has no wall clock: execute only that one timer.
 for(const timer of [...h.timers])if(timer.delay===300){h.timers.delete(timer);timer.fn();}
 await settle();
};
const submitSchool=async h=>{h.ids.get('school-form').fire('submit');await completeSchool(h);};
const advanceTo=async(h,name)=>{
 await start(h);if(name==='school')return;
 if(!h.personal){await submitSchool(h);if(name==='navigation')return;}
 else if(name==='navigation')return;
 if(name==='appearance'){await nextStep(h);return;}
 await nextStep(h);await nextStep(h);
};
const cssRule=(css,selector)=>Object.assign({},...[...css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([,selectors])=>selectors.split(',').some(value=>value.trim()===selector)).map(([, ,body])=>Object.fromEntries(body.split(';').filter(value=>value.includes(':')).map(value=>{const colon=value.indexOf(':');return [value.slice(0,colon).trim(),value.slice(colon+1).trim()];}))));
// These cases exercise page/storage/focus behavior. Motion has its own clocked
// suite, so welcome fixtures default to the OS reduced-motion path.
function fixture({personal=false,page="popup",reduced=page==='welcome',savedValues={},grant=true,schoolRead=null,messageReply=null}={}){
 const nodes=[],ids=new Map(),handlers=new Map(),storageEvents=new Set(),timers=new Set(),writes=[],requests=[],opened=[],introCalls=[],roomCalls=[];
 const saved={'reserve:school':'https://school.instructure.com',...savedValues};
 const classes=new WeakMap();
 const matches=(node,selector)=>{if(!node.attrs)return false;const attr=selector.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);if(attr)return attr[1] in node.attrs&&(attr[2]===undefined||node.attrs[attr[1]]===attr[2]);if(selector.startsWith('#'))return node.id===selector.slice(1);if(selector.startsWith('.'))return (node.attrs.class||'').split(' ').includes(selector.slice(1));return node.tagName?.toLowerCase()===selector;};
 const select=(pool,selector)=>pool.filter(node=>selector.split(',').some(part=>matches(node,part.trim())));
 const descendants=node=>node.children.flatMap(child=>[child,...descendants(child)]);
 class Element{
  constructor(tag,attrs={}){this.tagName=tag.toUpperCase();this.attrs=attrs;this.id=attrs.id;this.type=attrs.type||'';this.value=attrs.value||'';this.disabled='disabled'in attrs;this.hidden='hidden'in attrs;this.inert='inert'in attrs;this.checked='checked'in attrs;this.textContent='';this.dataset={};this.events=new Map();this.children=[];this.style={setProperty(key,value){this[key]=String(value);},getPropertyValue(key){return this[key]||'';}};classes.set(this,new Set((attrs.class||'').split(' ')));this.classList={add:(...names)=>names.forEach(name=>classes.get(this).add(name)),remove:(...names)=>names.forEach(name=>classes.get(this).delete(name)),contains:name=>classes.get(this).has(name),toggle:(name,on)=>{const set=classes.get(this);if(on??!set.has(name))set.add(name);else set.delete(name);}};for(const [key,value]of Object.entries(attrs))if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;}
  addEventListener(name,fn){this.events.set(name,fn);}
  setAttribute(name,value){this.attrs[name]=value;}
  getAttribute(name){return this.attrs[name]??null;}
  removeAttribute(name){delete this.attrs[name];}
  querySelectorAll(selector){return select(descendants(this),selector);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  closest(selector){return select([this],selector).length?this:this.parent?.closest?.(selector)??null;}
  get parentElement(){return this.parent||null;}
  get firstElementChild(){return this.children.find(n=>n.attrs)||this.firstChild||null;}
  append(...values){for(const value of values){if(value.parent){const siblings=value.parent.children,index=siblings.indexOf(value);if(index!==-1)siblings.splice(index,1);}value.parent=this;this.children.push(value);}}
  appendChild(value){this.append(value);return value;}
  replaceChildren(...values){for(const child of this.children)child.parent=null;this.children=[];this.append(...values);}
  set innerHTML(value){this.html=value;this.firstChild=value?{}:null;}
  insertAdjacentHTML(_position,value){this.insertedHTML=(this.insertedHTML||'')+value;}
  getBoundingClientRect(){return {left:0,top:0,width:440,height:220,right:440,bottom:220,x:0,y:0};}
  focus(){if(!this.disabled&&!this.inert)document.activeElement=this;}
  fire(name,event={}){if(name==='click'&&this.disabled)return;return this.events.get(name)?.({preventDefault(){},...event,target:this});}
 }
 const stack=[];
 for(const match of read(page+'.html').matchAll(/<\/?([a-z][\w-]*)\b([^>]*)>/gi)){
  if(match[0].startsWith('</')){const index=stack.findLastIndex(node=>node.tagName===match[1].toUpperCase());if(index>=0)stack.length=index;continue;}
  const attrs={};for(const attr of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g))attrs[attr[1]]=attr[2]??'';
  const element=new Element(match[1],attrs);nodes.push(element);if(element.id)ids.set(element.id,element);
  if(stack.length){element.parent=stack.at(-1);element.parent.children.push(element);}
  if(!['meta','link','input','img','br','hr','path','circle','rect'].includes(match[1])&&!match[0].endsWith('/>'))stack.push(element);
 }
 const document={documentElement:nodes.find(n=>n.tagName==='HTML'),body:nodes.find(n=>n.tagName==='BODY'),hidden:false,visibilityState:'visible',getElementById:id=>ids.get(id),querySelectorAll:selector=>select(nodes,selector),querySelector:selector=>select(nodes,selector)[0]||null,createElement:tag=>new Element(tag),createElementNS:(_ns,tag)=>new Element(tag),createTextNode:text=>({textContent:text,children:[]}),addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:(name,fn)=>{if(handlers.get(name)===fn)handlers.delete(name);}};
 let firstSchoolRead=true;
 const chrome={runtime:{async sendMessage(message){return messageReply?messageReply(message):{ok:true,origin:message.origin};},getManifest:()=>({name:personal?'CH+':'Canvas Harness',version:'9.8.7',optional_host_permissions:personal?[]:['https://*/*']}),getURL:p=>'chrome-extension://test/'+p,reload(){}},storage:{onChanged:{addListener:fn=>storageEvents.add(fn),removeListener:fn=>storageEvents.delete(fn)},local:{async get(keys){if(keys==='reserve:school'&&firstSchoolRead){firstSchoolRead=false;await schoolRead;}return Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,saved[key]]));},async set(values){writes.push(values);const changes={};for(const [key,value]of Object.entries(values)){saved[key]=value;changes[key]={newValue:value};}for(const fn of storageEvents)fn(changes,'local');},async remove(key){delete saved[key];}}},tabs:{async query(){return [{url:'https://school.instructure.com/'}];},async create(value){opened.push(value);}},permissions:{async contains(){return true;},request(value){requests.push(value);return Promise.resolve(grant);},async remove(){return true;}}};

 const introButton=new Element('g',{class:'startb'});
 introButton.getBoundingClientRect=()=>({left:480.25,top:600.5,width:320.5,height:72.25});
 const intro={END:INTRO_END,READY:INTRO_READY,mount(el){
  const svg=new Element('svg',{class:'intro-art',viewBox:'0 0 1600 900'});svg.append(introButton);el.replaceChildren(svg);
  introCalls.push({method:'mount',el});
  return {END:INTRO_END,READY:INTRO_READY,button:introButton,setT:t=>introCalls.push({method:'setT',t}),idle:t=>introCalls.push({method:'idle',t}),hover:on=>introCalls.push({method:'hover',on})};
 }};
 const room={UI:roomArt.ReserveWelcomeRoom.UI,SCHOOLHOUSE:'<svg viewBox="0 0 800 600"></svg>',mount(stage,options={}){
  roomCalls.push({method:'mount',stage,options});
  const pcContent=new Element('div',{class:'wr-pc-content'});stage.append(pcContent);
  let theme=options.theme||'light';
  const ponyLight=(lit=true)=>{roomCalls.push({method:'ponyLight',lit});return theme==='dark'?(lit?PONY_NIGHT_FILTER:PONY_UNLIT_FILTER):'none';};
  const litFilter=(lit=true)=>{roomCalls.push({method:'litFilter',lit});return theme==='dark'?(lit?PONY_NIGHT_FILTER:PONY_UNLIT_FILTER):'none';};
  const rects={address:[156.8,69.3,896,32],go:[1068.8,64,105.6,42.7],content:[22.4,112,1235.2,663.1],winL:[120,116,240,302],plateL:[168,462,144,41],winR:[920,116,240,302],plateR:[968,462,144,41],title:[640,82,0,0],pony:[640,660,0,0],bubble:[704,498,0,0],toggle:[920,494,184,50],finish:[920,560,216,59]};
  return {pcContent,ponyLight,litFilter,get theme(){return theme;},enter(){roomCalls.push({method:'enter'});return Promise.resolve();},go(name,opts={}){roomCalls.push({method:'go',name,opts});return Promise.resolve();},setTheme(value,opts={}){theme=value;roomCalls.push({method:'setTheme',theme:value,opts});return Promise.resolve();},hover(theme){roomCalls.push({method:'hover',theme});},plate(theme,on){roomCalls.push({method:'plate',theme,on});},rect(name){roomCalls.push({method:'rect',name});const [left,top,width,height]=rects[name]||[0,0,0,0];return {left,top,width,height,x:left,y:top,w:width,h:height,right:left+width,bottom:top+height};},idle(t){roomCalls.push({method:'idle',t});},layout(){roomCalls.push({method:'layout'});}};
 }};
 const scenes={night(){},finish:{mount(el){el.replaceChildren(new Element('svg',{class:'finish-art'}));return {END:3,fire(){},setT(){}};}}};
 const context=vm.createContext({document,ReserveWelcomeIntro:intro,ReserveWelcomeRoom:room,ReserveWelcomeScenes:scenes,innerWidth:1280,innerHeight:800,addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:(name,fn)=>{if(handlers.get(name)===fn)handlers.delete(name);},chrome,URL,Intl,structuredClone,console,matchMedia:()=>({matches:reduced,addEventListener(){},removeEventListener(){}}),setTimeout(fn,delay){const id={fn,delay};timers.add(id);return id;},clearTimeout:id=>timers.delete(id),requestAnimationFrame(fn){const id={fn,delay:1000/60,kind:'frame'};timers.add(id);return id;},cancelAnimationFrame:id=>timers.delete(id)});
 context.window=context;
 const scripts=[...read(page+'.html').matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(([,file])=>path.basename(file));
 for(const file of scripts)if(!['welcome-intro.js','welcome-scenes.js','welcome-room.js'].includes(file))vm.runInContext(read(file),context,{filename:file});
 return {ids,nodes,personal,saved,writes,requests,opened,introCalls,introButton,roomCalls,handlers,document,timers,chrome,cleanup(){handlers.get('pagehide')?.();}};
}
test('popup has six detail rows, manifest branding, and a replay link',async()=>{
 const h=fixture();await settle();assert.equal(h.nodes.filter(n=>'detail'in n.dataset).length,6);assert.equal(h.ids.get('version').textContent,'9.8.7');assert.equal(h.ids.get('school-section').hidden,false);
 for(const name of ['features','look','menu','pony','native','addons'])assert.ok(h.nodes.some(n=>n.dataset.detail===name));
 assert.ok(h.ids.get('market-open'),'Market has its own first-use permission button');
 const tour=h.ids.get('welcome-tour');assert.equal(tour.attrs.href,'welcome.html');assert.equal(tour.attrs.target,'_blank');await tour.fire('click');assert.equal(h.opened[0].url,'chrome-extension://test/welcome.html');
 const row=h.nodes.find(n=>n.dataset.detail==='menu');row.fire('click');assert.equal(h.ids.get('main-view').hidden,true);assert.equal(h.ids.get('detail-title').textContent,'Canvas menu bar');h.handlers.get('keydown')({key:'Escape',preventDefault(){}});assert.equal(h.ids.get('main-view').hidden,false);assert.equal(h.document.activeElement,row);h.cleanup();
 const personal=fixture({personal:true});await settle();assert.equal(personal.ids.get('school-section').hidden,true);personal.cleanup();
});
test('popup controls write dashboard theme, exact motion values, night artwork and pet.enabled',async()=>{
 const h=fixture();await settle();const dark=h.nodes.find(n=>n.dataset.preference==='theme'&&n.value==='dark');await dark.fire('change');await settle();
 const key='reserve:appearance';assert.equal(h.saved[key].theme,'dark');assert.equal(h.ids.get('night-art-control').hidden,false);
 const motion=h.nodes.find(n=>n.dataset.preference==='motion'&&n.value==='still');await motion.fire('change');await settle();assert.equal(h.saved[key].motion,'still');
 const slider=h.ids.get('night-art');slider.value='64';await slider.fire('change');await settle();assert.equal(h.saved[key].nightArt,64);
 const pony=h.ids.get('pet-enabled');pony.checked=false;await pony.fire('change');await settle();assert.equal(h.saved[key].pet,false);assert.match(h.ids.get('pony-value').textContent,/Off.*Biscuit/);
 const enabled=h.ids.get('enabled');enabled.checked=false;await enabled.fire('change');assert.equal(h.saved['reserve:enabled'],false);h.cleanup();
});
test('popup picture choices save all four canvasNav values and native controls retain their storage key',async()=>{
 const h=fixture();await settle();for(const value of ['drawn','shown','top','original']){const choice=h.nodes.find(n=>n.dataset.nav===value);await choice.fire('click');assert.equal(h.saved['reserve:canvasNav'],value);assert.equal(choice.attrs['aria-pressed'],'true');}
 const accent=h.nodes.find(n=>n.dataset.native==='accent');accent.value='ocean';accent.fire('change');await settle();assert.equal(h.saved['folio:native-appearance'].accent,'ocean');h.cleanup();
});
test('popup requests custom-site permission within the original click, before yielding',async()=>{
 const h=fixture();await settle();h.ids.get('school-url').value='https://canvas.school.edu';const pending=h.ids.get('open').fire('click');assert.equal(h.requests.length,1);assert.equal(h.requests[0].origins[0],'https://canvas.school.edu/*');await pending;h.cleanup();
});
test('the two extension pages use local external scripts and explicitly respect reduced motion',()=>{
 for(const name of ['popup','welcome']){const html=read(name+'.html'),css=read(name+'.css');assert.doesNotMatch(html,/<script\b(?![^>]*\bsrc=)[^>]*>\s*\S/i);assert.doesNotMatch(html,/(?:src|href)="(?:https?:)?\/\//i);assert.doesNotMatch(html,/\son\w+=/i);assert.match(css,/@media\s*\(prefers-reduced-motion:\s*reduce\)/);}
 const popup=read('popup.html');assert.doesNotMatch(popup,/<option value="system"|class="intro"/);
});

test('welcome uses one hidden art stage with accessible school, navigation and companion controls',async()=>{
 const h=fixture({page:'welcome'});await settle();
 const html=read('welcome.html'),scripts=[...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(([,name])=>name);
 assert.equal(h.ids.get('room-stage').attrs['aria-hidden'],'true');
 assert.ok(scripts.indexOf('welcome-room.js')>scripts.indexOf('welcome-intro.js'));
 assert.ok(scripts.indexOf('welcome-room.js')<scripts.indexOf('welcome.js'));
 assert.ok(h.ids.get('school-start-page'));
 assert.equal(h.ids.get('school-form').tagName,'FORM');
 assert.equal(h.ids.get('school-url').tagName,'INPUT');
 assert.equal(h.ids.get('school-go').type,'submit');
 assert.equal(h.ids.get('finish-board').tagName,'BUTTON');
 assert.equal(h.ids.get('finish-board').attrs['aria-label'],'Open my Canvas');
 assert.equal(h.roomCalls.filter(call=>call.method==='mount').length,1);
 assert.ok(h.nodes.some(n=>n.dataset.navChoice==='original'));
 assert.ok(h.nodes.some(n=>n.dataset.themeChoice==='light'));
 assert.ok(h.nodes.some(n=>n.dataset.themeChoice==='dark'));
 assert.ok(h.nodes.some(n=>n.id==='pet-enabled'));
 for(const file of ['subject-art-data.js','generic-art.js','subject-art.js','course-art.js'])assert.equal(scripts.includes(file),false);
 assert.doesNotMatch(html,/address-desk|address-transfer|look-scene|school-scene|meadow-scene|mini-dashboard/);
 h.cleanup();
});

test('intro Start is a disabled native button until its opening reaches READY',async t=>{
 const h=fixture({page:'welcome',reduced:false});t.after(()=>h.cleanup());
 const button=h.ids.get('intro-start');
 assert.equal(button.tagName,'BUTTON');assert.equal(button.type,'button');
 assert.equal(button.closest('[data-step]').dataset.step,'intro');
 assert.match(read('welcome.html'),/id="intro-start"[^>]*disabled/);
 assert.equal(button.disabled,true);assert.equal(h.document.querySelector('.tour-footer').hidden,true);
 button.focus();assert.notEqual(h.document.activeElement,button);
 await settle();assert.equal(button.disabled,true);assert.equal(h.ids.get('tour').dataset.opening,'true');
});

test('settled intro focuses Start on the real drawn bounds and retains keyboard semantics',async t=>{
 const h=fixture({page:'welcome'});t.after(()=>h.cleanup());await settle();
 const button=h.ids.get('intro-start'),panel=h.nodes.find(n=>n.dataset.step==='intro');
 assert.equal(button.disabled,false);assert.equal(button.hidden,false);
 assert.notEqual(button.attrs['aria-hidden'],'true');
 assert.notEqual(panel.attrs['aria-hidden'],'true');
 assert.equal(h.document.activeElement,button);
 assert.equal(h.ids.get('tour').dataset.opening,'false');
 assert.equal(h.document.querySelector('.tour-footer').hidden,true);
 assert.equal(panel.querySelector('.subtitle')?.classList.contains('sr-only'),true);
 const rect=h.introButton.getBoundingClientRect();
 for(const key of ['left','top','width','height'])assert.equal(button.style[key],rect[key]+'px');
 assert.doesNotMatch(button.insertedHTML||'',/pen-outline|choice-tick/);
 await start(h);assert.equal(h.ids.get('tour').dataset.currentStep,'school');
 assert.equal(h.document.activeElement,h.ids.get('school-url'));
 assert.equal(h.ids.get('back').hidden,true);
});

test('intro art has fixed bounds and Start has transparent keyboard focus styling',()=>{
 const css=read('welcome.css'),layer=cssRule(css,'.intro-layer'),art=cssRule(css,'.intro-layer svg'),button=cssRule(css,'.intro-start'),focus=cssRule(css,'.intro-start:focus-visible');
 assert.equal(layer.position,'fixed');assert.equal(layer.inset,'0');
 assert.equal(art.width,'100%');assert.equal(art.height,'100%');
 assert.equal(button.position,'fixed');assert.equal(button.background,'transparent');
 assert.equal(button.border,'0');assert.equal(button.color,'transparent');
 assert.match(focus.outline||'',/2px solid var\(--clay\)/);
});

test('CH+ keyboard Back restores intro focus and reuses the original drawing',async t=>{
 const h=fixture({page:'welcome',personal:true});t.after(()=>h.cleanup());await settle();
 const first=h.introCalls.filter(call=>call.method==='mount').length;
 await start(h);assert.equal(h.ids.get('tour').dataset.currentStep,'navigation');
 h.ids.get('back').fire('click');await settle();
 assert.equal(h.ids.get('tour').dataset.currentStep,'intro');
 assert.equal(h.document.querySelector('.tour-footer').hidden,true);
 assert.equal(h.ids.get('intro-art').hidden,false);
 assert.equal(h.ids.get('intro-start').disabled,false);
 assert.equal(h.document.activeElement,h.ids.get('intro-start'));
 assert.equal(h.introCalls.filter(call=>call.method==='mount').length,first);
});

test('Start forwards hover to the supplied drawing for both pointer and focus',async t=>{
 const h=fixture({page:'welcome'});t.after(()=>h.cleanup());await settle();
 const button=h.ids.get('intro-start'),hovered=()=>h.introCalls.filter(call=>call.method==='hover').at(-1)?.on;
 for(const type of ['pointerenter','pointerleave','focus','blur'])assert.ok(button.events.has(type));
 button.fire('blur');assert.equal(hovered(),false);
 button.fire('pointerenter');assert.equal(hovered(),true);
 button.fire('focus');button.fire('pointerleave');assert.equal(hovered(),true);
 button.fire('blur');assert.equal(hovered(),false);
 button.fire('focus');button.fire('pointerenter');button.fire('blur');assert.equal(hovered(),true);
 button.fire('pointerleave');assert.equal(hovered(),false);
});

test('standard onboarding follows school, navigation, appearance and companion and saves every setting',async()=>{
 const h=fixture({page:'welcome'});await settle();
 assert.deepEqual(h.nodes.filter(n=>n.dataset.step).map(n=>n.dataset.step),['intro','school','navigation','appearance','companion']);
 assert.equal(h.ids.get('step-count').textContent,'Step 1 of 4');
 await start(h);assert.equal(h.ids.get('tour').dataset.currentStep,'school');
 await submitSchool(h);assert.equal(h.ids.get('tour').dataset.currentStep,'navigation');
 assert.equal(h.ids.get('step-count').textContent,'Step 2 of 4');
 for(const value of ['drawn','shown','top','original']){
  h.nodes.find(n=>n.dataset.navChoice===value).fire('click');await settle();
  assert.equal(h.saved['reserve:canvasNav'],value);assert.equal(h.ids.get('menu-demo').dataset.layout,value);
 }
 await nextStep(h);assert.equal(h.ids.get('tour').dataset.currentStep,'appearance');
 h.nodes.find(n=>n.dataset.themeChoice==='dark').fire('click');await settle();
 assert.equal(h.saved['reserve:appearance'].theme,'dark');
 await nextStep(h);assert.equal(h.ids.get('tour').dataset.currentStep,'companion');
 const pony=h.ids.get('pet-enabled');pony.checked=false;pony.fire('change');await settle();
 assert.equal(h.saved['reserve:appearance'].pet,false);
 assert.equal(h.opened.length,0);
 assert.equal(h.ids.get('next').hidden,true);
 h.ids.get('finish-board').fire('click');await settle();
 assert.equal(h.opened.length,1);
 assert.equal(h.opened[0].url,'https://school.instructure.com/?reserve=open');
 h.cleanup();
});

test('reduced-motion school setup focuses the noted address, advances without a fade timer and reopens on Back',async t=>{
 const h=fixture({page:'welcome'});t.after(()=>h.cleanup());await settle();
 const stage=h.ids.get('room-stage'),input=h.ids.get('school-url'),go=h.ids.get('school-go'),note=h.ids.get('school-note'),spotlight=h.ids.get('school-spotlight');
 assert.equal(stage.classList.contains('wr-no-go'),true);assert.equal(go.hidden,true);assert.equal(go.disabled,true);
 await start(h);assert.equal(h.document.activeElement?.id,'school-url');assert.equal(input.readOnly,false);
 assert.equal(note.hidden,false);assert.equal(spotlight.hidden,false);assert.match(input.attrs['aria-describedby'],/\bschool-note\b/);
 assert.equal(stage.classList.contains('wr-no-go'),false);assert.equal(go.hidden,false);assert.equal(go.disabled,false);
 input.value='https://canvas.school.edu/path';go.fire('click');assert.equal(h.requests.length,1);await settle();
 assert.equal(h.ids.get('tour').dataset.currentStep,'navigation');assert.equal(input.value,'https://canvas.school.edu');assert.equal(input.readOnly,true);
 assert.equal(h.timers.size,0,'reduced motion skips both the spotlight fade and loading delay');
 assert.equal(spotlight.hidden,true);assert.equal(note.hidden,true);assert.equal(go.hidden,true);assert.equal(go.disabled,true);assert.equal(stage.classList.contains('wr-no-go'),true);
 h.ids.get('back').fire('click');await settle();assert.equal(h.ids.get('tour').dataset.currentStep,'school');
 assert.equal(input.value,'https://canvas.school.edu');assert.equal(input.readOnly,false);assert.equal(h.document.activeElement?.id,'school-url');
 assert.equal(note.hidden,false);assert.equal(spotlight.hidden,false);assert.equal(go.hidden,false);assert.equal(go.disabled,false);assert.equal(stage.classList.contains('wr-no-go'),false);
});

test('the generated pony switch stays synchronized with its focusable native switch and saved preferences',async t=>{
 for(const theme of ['light','dark']){
  const h=fixture({page:'welcome',savedValues:{'reserve:appearance':{theme,nightArt:64,pet:false}}});t.after(()=>h.cleanup());await settle();await advanceTo(h,'companion');
  const input=h.ids.get('pet-enabled'),wrapper=h.ids.get('pet-switch'),label=input.closest('label');
  assert.equal(input.tagName,'INPUT');assert.equal(input.type,'checkbox');assert.equal(input.attrs.role,'switch');assert.equal(label.attrs.for,input.id);
  assert.equal(wrapper.parentElement,label);assert.equal(wrapper.html,roomArt.ReserveWelcomeRoom.UI.toggle);assert.equal(wrapper.attrs['aria-hidden'],'true');
  assert.equal(wrapper.classList.contains('wr-toggle-wrap'),true);assert.equal(wrapper.classList.contains('is-on'),false);assert.equal(input.checked,false);
  assert.equal(input.hidden,false);assert.notEqual(input.attrs.tabindex,'-1');assert.notEqual(input.attrs['aria-hidden'],'true');
  input.focus();assert.equal(h.document.activeElement?.id,'pet-enabled','the visually hidden native switch remains keyboard focusable');
  const filter=theme==='dark'?PONY_NIGHT_FILTER:'none';assert.equal(label.style.filter,filter);
  assert.ok(h.roomCalls.some(call=>call.method==='litFilter'&&call.lit===true));
  for(const enabled of [true,false]){
   input.checked=enabled;input.fire('change');await settle();assert.equal(h.saved['reserve:appearance'].pet,enabled);
   assert.equal(h.saved['reserve:appearance'].nightArt,64);assert.equal(wrapper.classList.contains('is-on'),enabled);assert.equal(label.style.filter,filter);
  }
  await h.chrome.storage.local.set({'reserve:appearance':{theme,nightArt:64,pet:true}});await settle();
  assert.equal(input.checked,true);assert.equal(wrapper.classList.contains('is-on'),true,'external saved state updates the generated switch');
 }
 const css=read('welcome.css'),native=cssRule(css,'.pet-toggle input'),focus=cssRule(css,'.pet-toggle input:focus-visible+.wr-toggle-wrap');
 assert.equal(native.opacity,'0');assert.notEqual(native.display,'none');assert.notEqual(native.visibility,'hidden');
 assert.match(focus.outline||'',/3px solid/);assert.ok(focus['outline-offset'],'keyboard focus is drawn around the generated switch wrapper');
});

test('school form validates, requests permission in the submit gesture, and waits for approval',async()=>{
 const h=fixture({page:'welcome'});await settle();await start(h);
 const school=h.ids.get('school-url'),form=h.ids.get('school-form');
 school.value='http://bad.school.edu';form.fire('submit');await settle();
 assert.equal(school.attrs['aria-invalid'],'true');assert.equal(h.requests.length,0);
 school.value='https://canvas.school.edu';
 form.fire('submit');assert.equal(h.requests.length,1,'request must precede the first await');
 assert.equal(h.requests[0].origins[0],'https://canvas.school.edu/*');
 await completeSchool(h);assert.equal(h.opened.length,0);
 assert.equal(h.saved['reserve:school'],'https://canvas.school.edu');
 assert.equal(h.ids.get('tour').dataset.currentStep,'navigation');
 assert.equal(school.readOnly,true);
 const denied=fixture({page:'welcome',grant:false});await settle();await start(denied);
 denied.ids.get('school-url').value='https://canvas.school.edu';
 denied.ids.get('school-form').fire('submit');await settle();
 assert.equal(denied.ids.get('school-url').attrs['aria-invalid'],'true');
 assert.equal(denied.ids.get('school-url').readOnly,false);
 assert.equal(denied.saved['reserve:sites'],undefined);
 h.cleanup();denied.cleanup();
});

test('CH+ skips school and keyboard Back restores navigation from appearance',async()=>{
 const h=fixture({page:'welcome',personal:true});await settle();
 assert.equal(h.nodes.find(n=>n.dataset.step==='school').hidden,true);
 await start(h);assert.equal(h.ids.get('tour').dataset.currentStep,'navigation');
 assert.equal(h.ids.get('step-count').textContent,'Step 1 of 3');
 await nextStep(h);assert.equal(h.ids.get('tour').dataset.currentStep,'appearance');
 h.handlers.get('keydown')({key:'ArrowLeft',target:h.ids.get('appearance-title'),preventDefault(){}});
 await settle();assert.equal(h.ids.get('tour').dataset.currentStep,'navigation');
 assert.equal(h.document.activeElement,h.ids.get('navigation-title'));h.cleanup();
});

test('reduced motion settles intro and uses static room poses without queueing animation',async()=>{
 const h=fixture({page:'welcome',reduced:true});await settle();
 assert.equal(h.ids.get('tour').dataset.opening,'false');
 assert.equal(h.ids.get('intro-start').disabled,false);
 assert.equal(h.document.activeElement,h.ids.get('intro-start'));
 assert.equal(h.timers.size,0);
 assert.equal(h.introCalls.filter(c=>c.method==='mount').length,1);
 assert.ok(h.introCalls.some(c=>c.method==='setT'&&c.t===INTRO_END));
 assert.equal(h.introCalls.filter(c=>c.method==='idle').length,0);
 await start(h);await submitSchool(h);await nextStep(h);await nextStep(h);
 assert.equal(h.ids.get('tour').dataset.currentStep,'companion');
 assert.equal(h.roomCalls.filter(call=>call.method==='enter').length,0);
 assert.ok(h.roomCalls.filter(call=>call.method==='go').every(call=>call.opts.animate===false));
 assert.equal(h.ids.get('meadow').classList.contains('is-arrived'),true);
 assert.equal(h.timers.size,0);h.cleanup();
 const css=read('welcome.css');assert.match(css,/@media\s*\(prefers-reduced-motion\s*:\s*reduce\)/);
});

test('school field waits for its saved value without overwriting typed input',async()=>{
 let release;const gate=new Promise(resolve=>release=resolve),h=fixture({page:'welcome',schoolRead:gate});
 await settle();const school=h.ids.get('school-url');school.value='https://typed.instructure.com';school.fire('input');release();await settle();
 assert.equal(school.value,'https://typed.instructure.com');assert.equal(h.saved['reserve:appearance'],undefined);
 assert.equal(h.nodes.find(n=>n.dataset.themeChoice==='light').attrs['aria-pressed'],'true');h.cleanup();
 const untouched=fixture({page:'welcome'});await settle();
 assert.equal(untouched.ids.get('school-url').value,'https://school.instructure.com');untouched.cleanup();
});

test('validation and permission errors restore school editability before focusing the input',async()=>{
 for(const value of ['http://bad.school.edu','https://canvas.school.edu']){
  const h=fixture({page:'welcome',grant:false});await settle();await start(h);
  const school=h.ids.get('school-url');school.value=value;h.ids.get('school-form').fire('submit');await settle();
  assert.equal(school.disabled,false);assert.equal(school.readOnly,false);
  assert.equal(h.document.activeElement?.id,school.id);h.cleanup();
 }
});

test('final Canvas opening uses the approved origin after school edits and navigation',async()=>{
 const h=fixture({page:'welcome'});await settle();await start(h);
 h.ids.get('school-url').value='https://chosen.instructure.com/path';await submitSchool(h);
 h.ids.get('school-url').value='https://different.instructure.com';
 await nextStep(h);await nextStep(h);
 h.ids.get('finish-board').fire('click');await settle();
 assert.equal(h.opened[0]?.url,'https://chosen.instructure.com/?reserve=open');h.cleanup();
});

test('popup appearance loads without a chosen school and responds to external preference changes',async()=>{
 const h=fixture({savedValues:{'reserve:school':''}});await settle();
 await h.chrome.storage.local.set({'reserve:appearance':{theme:'dark',motion:'off',nightArt:45,pet:false}});await settle();
 assert.match(h.ids.get('look-value').textContent,/Dark.*motion off/);
 assert.equal(h.ids.get('night-art').value,45);assert.equal(h.ids.get('pet-enabled').checked,false);
 assert.equal(h.writes.some(write=>Object.keys(write).some(key=>key.startsWith('reserve:v1:'))),false);h.cleanup();
});

test('final opening waits for script registration and handles rejection and timeout without opening',async()=>{
 for(const outcome of ['success','failure','timeout']){
  const h=fixture({page:'welcome'});await settle();await start(h);
  h.ids.get('school-url').value='https://canvas.school.edu';await submitSchool(h);
  await nextStep(h);await nextStep(h);
  let release;h.chrome.runtime.sendMessage=()=>new Promise(done=>release=done);
  h.ids.get('finish-board').fire('click');await settle();assert.equal(h.opened.length,0);
  if(outcome==='timeout'){
   const timer=[...h.timers].find(item=>item.delay===10000);
   assert.ok(timer,'registering a custom Canvas site has a timeout');
   timer.fn();await settle();assert.match(h.ids.get('status').textContent,/registration.*long|register.*long/i);
  }else{release({ok:outcome==='success',origin:'https://canvas.school.edu',error:'Registration failed'});await settle();}
  assert.equal(h.opened.length,outcome==='success'?1:0);
  assert.equal(h.ids.get('finish-board').disabled,outcome==='success','finished state blocks repeat opening while errors remain retryable');
  if(outcome==='failure')assert.match(h.ids.get('status').textContent,/Registration failed/);
  if(outcome==='timeout'){release({ok:true,origin:'https://canvas.school.edu'});await settle();assert.equal(h.opened.length,0);}
  h.cleanup();
 }
});

test('explicit tour themes preserve saved night artwork or default Chalk without forcing a theme at startup',async()=>{
 for(const saved of [undefined,{theme:'dark',nightArt:73}]){
  const h=fixture({page:'welcome',savedValues:saved?{'reserve:appearance':saved}:{}});await settle();await advanceTo(h,'appearance');
  assert.equal(h.writes.some(write=>Object.hasOwn(write,'reserve:appearance')),false);
  assert.equal(h.nodes.some(node=>node.type==='range'),false,'the tour has no artwork slider');
  for(const theme of ['light','dark']){
   h.nodes.find(n=>n.dataset.themeChoice===theme).fire('click');await settle();
   assert.equal(h.saved['reserve:appearance'].theme,theme);assert.equal(h.saved['reserve:appearance'].nightArt,saved?.nightArt??0);
  }
  h.cleanup();
 }
});

test('personal tour waits for a saved school origin before leaving intro',async()=>{
 let release;const gate=new Promise(resolve=>release=resolve),h=fixture({page:'welcome',personal:true,schoolRead:gate});
 await settle();await start(h);assert.equal(h.ids.get('tour').dataset.currentStep,'intro');
 release();await settle();await start(h);
 assert.equal(h.ids.get('tour').dataset.currentStep,'navigation');h.cleanup();
});

test('the interactive PC panel is moved away from the hidden stage and retains real DOM ancestry',async()=>{
 const h=fixture({page:'welcome'});await settle();await start(h);
 const stage=h.ids.get('room-stage'),school=h.nodes.find(n=>n.dataset.step==='school');
 const navigation=h.nodes.find(n=>n.dataset.step==='navigation');
 assert.equal(school.parentElement,navigation.parentElement);
 assert.ok(school.parentElement.classList.contains('wr-pc-content'));
 assert.equal(school.closest('#room-stage'),null);
 assert.equal(navigation.closest('#room-stage'),null);
 assert.equal(h.ids.get('school-form').closest('#room-stage'),null);
 assert.equal(stage.getAttribute('aria-hidden'),'true');
 assert.equal(h.document.activeElement,h.ids.get('school-url'));
 h.cleanup();
});

test('theme buttons and companion finish are real named controls, not art-only click targets',async()=>{
 const h=fixture({page:'welcome'});await settle();await advanceTo(h,'appearance');
 assert.equal(h.ids.get('next').hidden,true);assert.equal(h.ids.get('back').hidden,false);
 assert.deepEqual(h.roomCalls.filter(c=>c.method==='plate').map(({theme,on})=>[theme,on]),[['light',false],['dark',false]],'both windows name their mode until one is clicked');
 assert.ok(h.nodes.filter(n=>n.dataset.themeContinue).every(n=>n.hidden&&n.inert),'no Continue before a choice');
 for(const [theme,label] of [['light','Light mode'],['dark','Dark mode']]){
  const button=h.nodes.find(n=>n.dataset.themeChoice===theme);
  assert.equal(button.tagName,'BUTTON');assert.equal(button.attrs['aria-label'],label);
 }
 const dark=h.nodes.find(n=>n.dataset.themeChoice==='dark');
 dark.fire('pointerenter');assert.equal(h.roomCalls.filter(c=>c.method==='hover').at(-1)?.theme,'dark');
 dark.fire('click');await settle();assert.equal(h.saved['reserve:appearance'].theme,'dark');
 const chosen=h.nodes.find(n=>n.dataset.themeContinue==='dark'),inactive=h.nodes.find(n=>n.dataset.themeContinue==='light');
 assert.equal(chosen.tagName,'BUTTON');assert.equal(chosen.attrs['aria-label'],'Continue');assert.equal(chosen.hidden,false);assert.equal(chosen.inert,false);
 assert.equal(inactive.hidden,true);assert.equal(inactive.inert,true);assert.equal(inactive.attrs['aria-hidden'],'true');
 assert.equal(h.document.activeElement,chosen);
 assert.deepEqual(h.roomCalls.filter(c=>c.method==='plate').slice(-2).map(({theme,on})=>[theme,on]),[['dark',true],['light',false]]);
 await nextStep(h);assert.equal(h.ids.get('tour').dataset.currentStep,'companion');
 assert.equal(h.ids.get('finish-board').tagName,'BUTTON');assert.equal(h.ids.get('finish-board').attrs['aria-label'],'Open my Canvas');
 assert.ok(h.nodes.find(n=>n.attrs.class?.includes('pet-toggle-label')),'the toggle has a label span');
 assert.match(read('welcome.html'),/class="pet-toggle-label">Keep Biscuit<\/span>/,'the label has explicit visible text');
 h.cleanup();
});

test('quick keyboard steps on the night slider save the last value even while earlier saves finish',async()=>{
 const h=fixture({savedValues:{'reserve:appearance':{theme:'dark',motion:'gentle',nightArt:50,pet:true}}});await settle();
 const set=h.chrome.storage.local.set,gates=[];
 h.chrome.storage.local.set=values=>Object.hasOwn(values,'reserve:appearance')?new Promise(resolve=>gates.push(()=>resolve(set(values)))):set(values);
 const slider=h.ids.get('night-art');
 const press=async()=>{slider.value=String(Number(slider.value)+1);slider.fire('change');await settle();};
 await press();await press();
 gates.shift()();await settle();// the first save finishes while two more presses follow
 assert.equal(Number(slider.value),52,'a finishing save does not move the slider back');
 await press();while(gates.length){gates.shift()();await settle();}
 assert.equal(h.saved['reserve:appearance'].nightArt,53);assert.equal(Number(slider.value),53);assert.equal(h.ids.get('night-art-value').textContent,'53%');
 h.cleanup();
});
