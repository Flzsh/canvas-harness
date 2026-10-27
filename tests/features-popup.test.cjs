'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
const plain=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const settle=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));};
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const IDS=require('../extension/features.js').presets.full;
const LITE=['dashboard','planner','grades','math','gpa','tools','arrange','native-appearance'];

// A DOM/storage boundary fixture: real popup and catalogue, no browser launch.
// Unrelated school, page-preference and appearance controllers stay outside it.
async function fixture(t,{saved={},readGate=null,failReads=0,missingAPI=false,label=null,publicBuild=true}={}){
 const data=plain(saved),writes=[],reads=[],effects=[],events=new Set(),handlers=new Map(),timers=new Set();
 const state={readGate,failReads,writePlan:[],destroyed:0};let document;
 const dataKey=name=>name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());
 class Element{
  constructor(tag,attrs={}){
   this.tagName=tag.toUpperCase();this.attrs={...attrs};this.children=[];this.parentElement=null;this.events=new Map();this.dataset={};this._text='';
   this.type=attrs.type||'';this.value=attrs.value||'';this.disabled='disabled'in attrs;this.hidden='hidden'in attrs;this.checked='checked'in attrs;
   this.style={setProperty(){}};
   for(const [name,value]of Object.entries(attrs))if(name.startsWith('data-'))this.dataset[dataKey(name)]=value;
   const change=(name,on)=>{const classes=new Set(this.className.split(/\s+/).filter(Boolean));if(on)classes.add(name);else classes.delete(name);this.className=[...classes].join(' ');};
   this.classList={contains:name=>this.className.split(/\s+/).includes(name),add:(...names)=>names.forEach(name=>change(name,true)),remove:(...names)=>names.forEach(name=>change(name,false)),toggle:(name,on)=>change(name,on??!this.classList.contains(name))};
  }
  get id(){return this.attrs.id||'';}set id(value){this.attrs.id=value;}
  get className(){return this.attrs.class||'';}set className(value){this.attrs.class=value;}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set textContent(value){this.replaceChildren();this._text=String(value);}
  get firstChild(){return this.children[0]||null;}
  set innerHTML(value){this.replaceChildren();this._text=String(value);}
  get innerHTML(){return this.textContent;}
  getAttribute(name){if(name.startsWith('data-'))return this.dataset[dataKey(name)]??null;return this.attrs[name]??null;}
  setAttribute(name,value){if(name.startsWith('data-'))this.dataset[dataKey(name)]=String(value);else this.attrs[name]=String(value);}
  removeAttribute(name){delete this.attrs[name];}
  addEventListener(name,fn){if(!this.events.has(name))this.events.set(name,new Set());this.events.get(name).add(fn);}
  append(...nodes){for(const node of nodes){if(node.parentElement)node.parentElement.children.splice(node.parentElement.children.indexOf(node),1);node.parentElement=this;this.children.push(node);}}
  appendChild(node){this.append(node);return node;}
  replaceChildren(...nodes){this._text='';for(const child of this.children)child.parentElement=null;this.children=[];this.append(...nodes);}
  replaceWith(node){const parent=this.parentElement;if(!parent)return;parent.children[parent.children.indexOf(this)]=node;node.parentElement=parent;this.parentElement=null;}
  querySelectorAll(selector){return select(descendants(this),selector);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  closest(selector){return matches(this,selector)?this:this.parentElement?.closest(selector)||null;}
  focus(){if(!this.disabled)document.activeElement=this;}
  fire(type,extra={}){if(this.disabled)return;for(const fn of this.events.get(type)||[])fn({target:this,preventDefault(){},...extra});}
 }
 const descendants=node=>node.children.flatMap(child=>[child,...descendants(child)]);
 function part(node,selector){
  if(node.tagName==='#TEXT')return false;
  const tag=selector.match(/^[a-z][\w-]*/i);if(tag&&node.tagName!==tag[0].toUpperCase())return false;
  for(const match of selector.matchAll(/([#.])([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g)){
   if(match[1]==='#'&&node.id!==match[2])return false;
   if(match[1]==='.'&&!node.classList.contains(match[2]))return false;
   if(match[3]&&(node.getAttribute(match[3])===null||(match[4]!==undefined&&node.getAttribute(match[3])!==match[4])))return false;
  }
  return true;
 }
 function matches(node,selector){
  const parts=selector.trim().split(/\s+/);if(!part(node,parts.pop()))return false;
  for(let i=parts.length-1;i>=0;i--){node=node.parentElement;while(node&&!part(node,parts[i]))node=node.parentElement;if(!node)return false;}
  return true;
 }
 const select=(nodes,selector)=>nodes.filter(node=>selector.split(',').some(value=>matches(node,value)));
 const root=new Element('document'),stack=[root];
 for(const token of read('popup.html').match(/<[^>]*>|[^<]+/g)||[]){
  if(token.startsWith('</')){const tag=token.match(/^<\/([\w-]+)/)?.[1].toUpperCase(),index=stack.findLastIndex(node=>node.tagName===tag);if(index>0)stack.length=index;continue;}
  if(!token.startsWith('<')){const text=new Element('#text');text._text=token;stack.at(-1).append(text);continue;}
  const match=token.match(/^<([a-z][\w-]*)\b([^>]*)>/i);if(!match)continue;
  const attrs={};for(const attr of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g))attrs[attr[1]]=attr[2]??'';
  const node=new Element(match[1],attrs);stack.at(-1).append(node);
  if(!['meta','link','input','img','br','hr','path','circle','rect'].includes(match[1])&&!token.endsWith('/>'))stack.push(node);
 }
 document={documentElement:select(descendants(root),'html')[0],activeElement:null,getElementById:id=>descendants(root).find(node=>node.id===id)||null,
  querySelectorAll:selector=>select(descendants(root),selector),querySelector:selector=>select(descendants(root),selector)[0]||null,createElement:tag=>new Element(tag),
  addEventListener:(name,fn)=>handlers.set(name,fn)};
 const get=selector=>{const node=document.querySelector(selector);assert.ok(node,'Missing '+selector);return node;};
 const emit=(value,area='local')=>{for(const fn of events)fn({'reserve:features':{newValue:plain(value)}},area);};
 const chrome={runtime:{getManifest:()=>({name:'Canvas Harness',version:'3.7.0',optional_host_permissions:publicBuild?['https://*/*']:[]}),getURL:file=>'chrome-extension://fixture/'+file,reload:()=>effects.push('reload')},
  storage:{onChanged:{addListener:fn=>events.add(fn),removeListener:fn=>events.delete(fn)},local:{async get(keys){
   reads.push(plain(keys));const result=Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,plain(data[key])]));
   if(keys==='reserve:features'){const fail=state.failReads-->0;await state.readGate;if(fail)throw Error('read failed');}return result;
  },async set(values){
   writes.push(plain(values));const plan=state.writePlan.shift()||{};await plan.gate;if(plan.fail)throw Error('write failed');
   Object.assign(data,plain(values));if('reserve:features'in values)emit(values['reserve:features']);
  }}},tabs:{async query(){return [{url:'https://school.instructure.com/'}];},async create(value){effects.push(value);}}};
 let pagePrefs={theme:'light',motion:'gentle',nightArt:0,pet:true,...data['reserve:appearance']},nativePrefs={theme:'original',readingWidth:'comfortable'};
 const context=vm.createContext({document,chrome,URL,console,matchMedia:()=>({matches:false}),
  ReservePagePreferences:{create:()=>({subscribe(){},load:async()=>pagePrefs,get:()=>pagePrefs,set:async patch=>{pagePrefs={...pagePrefs,...patch};},destroy(){state.destroyed++;}})},
  ReserveNativeAppearance:{create:options=>({async start(){options.apply(nativePrefs);},async set(patch){nativePrefs={...nativePrefs,...patch};options.apply(nativePrefs);},get:()=>nativePrefs,destroy(){state.destroyed++;}})},
  ReserveNativePage:{browserAdapter:()=>({})},ReservePetArt:{svg:()=>'',COATS:{oat:{}},HARNESS:{red:''}},ReserveSite:{supported:()=>true,origin:()=>''},
  ReserveSchool:{list:async()=>[],saved:async()=>'https://school.instructure.com',open:async()=>{effects.push('school open');return {ok:true};}},
  setTimeout(fn,delay){const timer={fn,delay};timers.add(timer);return timer;},clearTimeout:timer=>timers.delete(timer),addEventListener:(name,fn)=>handlers.set(name,fn)});
 context.window=context;
 vm.runInContext(read('features.js'),context,{filename:'features.js'});
 if(label)context.ReserveFeatures.catalogue[0].label=label;
 if(missingAPI)context.ReserveFeatures=undefined;
 vm.runInContext(read('popup.js'),context,{filename:'popup.js'});
 const switches=()=>document.querySelectorAll('[data-feature]');
 const checked=()=>switches().filter(node=>node.checked).map(node=>node.dataset.feature);
 const active=()=>document.querySelectorAll('[data-feature-preset]').find(node=>node.checked)?.value;
 const preset=async value=>{const input=get('[data-feature-preset][value="'+value+'"]');input.focus();input.checked=true;input.fire('change');await settle();};
 const toggle=async(id,on)=>{const input=get('[data-feature="'+id+'"]');input.focus();input.checked=on;input.fire('change');await settle();};
 const close=()=>handlers.get('pagehide')?.();t.after(close);await settle();
 return {document,get,data,writes,reads,effects,events,state,switches,checked,active,preset,toggle,close,context,
  async open(){get('[data-detail="features"]').fire('click');await settle();},
  external(value,area='local'){if(area==='local')data['reserve:features']=plain(value);emit(value,area);},
  key(key){let prevented=false;handlers.get('keydown')?.({key,preventDefault(){prevented=true;}});return prevented;}};
}

test('popup keeps author and branding, shows 3.7.0, and loads the catalogue before its controls',()=>{
 const html=read('popup.html'),scripts=[...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(match=>match[1]);
 assert.match(html,/<meta name="author" content="Flzsh">/);assert.match(html,/id="version"[^>]*>3.7.0</);
 assert.ok(scripts.indexOf('features.js')>=0&&scripts.indexOf('features.js')<scripts.indexOf('popup.js'));
 assert.match(html,/id="welcome-tour" href="welcome.html" target="_blank" rel="noopener"/);
 assert.match(read('popup.js'),/@preserve Canvas Harness original creator: Flzsh/);
});

test('Full defaults without saving and renders only catalogue labels in reusable drawn switch groups',async t=>{
 const h=await fixture(t);await h.open();assert.equal(h.active(),'full');assert.deepEqual(h.checked(),IDS);assert.deepEqual(h.writes,[]);
 assert.equal(h.get('#detail-title').textContent,'Features');assert.equal(h.get('#features-value').textContent,'Full');
 assert.equal(h.get('#features-panel').getAttribute('aria-busy'),'false');
 const catalogue=h.context.ReserveFeatures.catalogue;
 assert.deepEqual(h.document.querySelectorAll('#feature-groups legend').map(node=>node.textContent),['Study','Personalize','Drawings','Canvas','Extras']);
 for(const input of h.switches()){
  const row=input.closest('label'),record=catalogue.find(item=>item.id===input.dataset.feature);
  assert.equal(input.type,'checkbox');assert.equal(input.getAttribute('role'),'switch');assert.equal(input.disabled,false);
  assert.ok(row.classList.contains('setting-row')&&row.classList.contains('switch'));assert.ok(row.closest('.rows').classList.contains('drawn'));
  assert.equal(row.querySelector('b').textContent,record.label||record.name);assert.equal(row.querySelector('small'),null);
  assert.equal(row.querySelector('.switch-track').getAttribute('aria-hidden'),'true');
 }
 assert.deepEqual(h.document.querySelectorAll('[data-feature-preset]').map(input=>input.value),['full','lite','custom']);
 assert.deepEqual(h.effects,[]);
});

test('catalogue labels remain text and both public and registered-school builds expose Features',async t=>{
 for(const publicBuild of [true,false]){
  const h=await fixture(t,{publicBuild,label:'<img src=x onerror=bad()> & name'});await h.open();
  const row=h.get('[data-feature="dashboard"]').closest('label');assert.equal(row.querySelector('b').textContent,'<img src=x onerror=bad()> & name');assert.equal(row.querySelector('img'),null);
  assert.equal(h.get('#school-section').hidden,!publicBuild);assert.equal(h.get('[data-detail="features"]').hidden,false);
 }
});

test('Lite saves only extension-wide features, retains school/account data, and asks for a Canvas reload',async t=>{
 const untouched={'reserve:school':'https://canvas.school.edu','reserve:appearance':{theme:'dark',pet:false},'reserve:v1:school:1':{draft:'keep',plans:[1],svg:'keep'}};
 const h=await fixture(t,{saved:untouched});await h.open();await h.preset('lite');
 assert.equal(h.active(),'lite');assert.deepEqual(h.checked(),LITE);assert.equal(h.data['reserve:features'].preset,'lite');
 assert.deepEqual(h.writes.map(write=>Object.keys(write)),[['reserve:features']]);
 for(const [key,value]of Object.entries(untouched))assert.deepEqual(h.data[key],value);
 assert.ok(h.reads.every(keys=>(Array.isArray(keys)?keys:[keys]).every(key=>!key.startsWith('reserve:v1:'))));
 assert.equal(h.get('#features-status').textContent,'Saved.');assert.match(h.get('#features-reload').textContent,/Reload Canvas to apply\./);
 assert.deepEqual(h.effects,[]);
});

for(const custom of [['math'],[]])test('Full and Lite preserve Custom '+JSON.stringify(custom),async t=>{
 const h=await fixture(t,{saved:{'reserve:features':{preset:'custom',custom}}});await h.open();
 for(const preset of ['full','lite','custom']){await h.preset(preset);assert.equal(h.active(),preset);assert.deepEqual(h.data['reserve:features'].custom,custom);}
 assert.deepEqual(h.checked(),custom);
});

test('editing Lite seeds Custom from effective Lite rather than a previously stored Custom',async t=>{
 const h=await fixture(t,{saved:{'reserve:features':{preset:'lite',custom:['pdf']}}});await h.open();await h.toggle('motion',true);
 assert.equal(h.active(),'custom');assert.deepEqual(h.checked(),[...LITE.slice(0,7),'motion','native-appearance']);
 assert.deepEqual(h.data['reserve:features'],{preset:'custom',custom:[...LITE,'motion']});
});

test('Pony enables its requirements and disabling Planner removes its transitive dependents',async t=>{
 const h=await fixture(t,{saved:{'reserve:features':{preset:'custom',custom:[]}}});await h.open();await h.toggle('pony',true);
 assert.deepEqual(h.checked(),['dashboard','planner','pony']);assert.deepEqual(h.data['reserve:features'].custom,['pony']);
 await h.toggle('planner',false);assert.deepEqual(h.checked(),[]);assert.deepEqual(h.data['reserve:features'].custom,[]);
 await h.toggle('pony',true);await h.toggle('dashboard',false);assert.deepEqual(h.checked(),[]);
});

test('artwork and Tools dependencies turn off predictably while unrelated Custom choices survive',async t=>{
 const h=await fixture(t,{saved:{'reserve:features':{preset:'custom',custom:['customization','course-art','math','ai','gpa','unknown','math']}}});await h.open();
 assert.deepEqual(h.checked(),['dashboard','math','gpa','tools','customization','course-art','ai']);
 await h.toggle('customization',false);assert.deepEqual(h.data['reserve:features'].custom,['course-art','math','ai','gpa']);
 assert.deepEqual(h.checked(),['math','gpa','tools','course-art','ai']);
 await h.toggle('tools',false);assert.deepEqual(h.checked(),['math','course-art']);assert.deepEqual(h.data['reserve:features'].custom,['course-art','math']);
});

test('a rejected save rolls controls and preset back to durable choices and leaves retry usable',async t=>{
 const prefs={preset:'custom',custom:['math']},h=await fixture(t,{saved:{'reserve:features':prefs}});await h.open();
 h.state.writePlan.push({fail:true});await h.preset('lite');assert.deepEqual(h.data['reserve:features'],prefs);
 assert.equal(h.active(),'custom');assert.deepEqual(h.checked(),['math']);assert.equal(h.get('#features-value').textContent,'Custom');
 assert.equal(h.get('#features-error').hidden,false);assert.equal(h.get('#features-error').getAttribute('role'),'alert');assert.match(h.get('#features-error').textContent,/Could not save/);
 assert.equal(h.get('#features-panel').getAttribute('aria-busy'),'false');assert.ok(h.switches().every(input=>!input.disabled));
 await h.preset('lite');assert.equal(h.active(),'lite');assert.equal(h.get('#features-error').hidden,true);assert.equal(h.get('#features-status').textContent,'Saved.');
});

test('fast saves serialize, ignore older storage echoes and retain controls and keyboard focus',async t=>{
 const h=await fixture(t),gate=deferred();t.after(gate.resolve);await h.open();h.state.writePlan.push({gate:gate.promise});
 const math=h.get('[data-feature="math"]');await h.preset('lite');await h.preset('full');await h.toggle('math',false);
 assert.equal(h.writes.length,1);assert.equal(h.active(),'custom');assert.equal(math.checked,false);assert.equal(h.document.activeElement,math);
 assert.equal(h.get('#features-panel').getAttribute('aria-busy'),'true');assert.ok(h.switches().every(input=>!input.disabled));
 gate.resolve();await settle();assert.equal(h.writes.length,3);assert.deepEqual(h.writes.slice(0,2).map(write=>write['reserve:features'].preset),['lite','full']);
 assert.equal(h.data['reserve:features'].custom.includes('math'),false);assert.equal(math.checked,false);assert.equal(h.get('[data-feature="math"]'),math);
 assert.equal(h.document.activeElement,math);assert.equal(h.get('#features-panel').getAttribute('aria-busy'),'false');assert.equal(h.get('#features-status').textContent,'Saved.');
});

for(const failFirst of [true,false])test('queued '+(failFirst?'success recovers after rejection':'rejection restores the most recent successful save'),async t=>{
 const h=await fixture(t),gate=deferred();t.after(gate.resolve);await h.open();
 h.state.writePlan.push({gate:gate.promise,fail:failFirst},{fail:!failFirst});await h.preset('lite');await h.preset('full');gate.resolve();await settle();
 assert.equal(h.writes.length,2);assert.equal(h.active(),failFirst?'full':'lite');assert.equal(h.data['reserve:features'].preset,failFirst?'full':'lite');
 assert.equal(h.get('#features-error').hidden,failFirst);assert.equal(h.get('#features-panel').getAttribute('aria-busy'),'false');
});

test('failed initial reads cannot overwrite preferences and can be retried',async t=>{
 const h=await fixture(t,{failReads:1,saved:{'reserve:features':{preset:'custom',custom:['math']}}});await h.open();
 assert.ok(h.switches().every(input=>input.disabled));assert.equal(h.get('#features-retry').hidden,false);assert.match(h.get('#features-error').textContent,/Could not load/);
 assert.deepEqual(h.writes,[]);h.get('#features-retry').fire('click');await settle();assert.deepEqual(h.checked(),['math']);assert.equal(h.active(),'custom');assert.equal(h.get('#features-error').hidden,true);
});

test('external changes beat a stale initial read and do not write back',async t=>{
 const gate=deferred(),h=await fixture(t,{readGate:gate.promise});t.after(gate.resolve);await h.open();
 assert.equal(h.get('#features-panel').getAttribute('aria-busy'),'true');assert.ok(h.document.querySelectorAll('[data-feature-preset]').every(input=>input.disabled));
 h.external({preset:'custom',custom:['pony']});gate.resolve();await settle();assert.equal(h.active(),'custom');assert.deepEqual(h.checked(),['dashboard','planner','pony']);
 h.external({preset:'custom',custom:[]},'sync');assert.deepEqual(h.checked(),['dashboard','planner','pony']);
 h.external(undefined);assert.equal(h.active(),'full');assert.deepEqual(h.checked(),IDS);assert.deepEqual(h.writes,[]);
});

test('native radio and switch changes keep focus, and Escape and Back return to the Features row',async t=>{
 const h=await fixture(t);await h.open();assert.equal(h.document.activeElement,h.get('#back'));
 const preset=h.get('[data-feature-preset][value="lite"]');assert.equal(preset.type,'radio');assert.equal(preset.getAttribute('name'),'features-preset');assert.ok(preset.closest('.segments'));
 await h.preset('lite');assert.equal(h.document.activeElement,preset);await h.toggle('pony',true);const pony=h.get('[data-feature="pony"]');assert.equal(h.document.activeElement,pony);
 assert.equal(h.key('Escape'),true);assert.equal(h.get('#detail-view').hidden,true);assert.equal(h.document.activeElement,h.get('[data-detail="features"]'));
 await h.open();h.get('#back').fire('click');assert.equal(h.get('#main-view').hidden,false);assert.equal(h.document.activeElement,h.get('[data-detail="features"]'));
});

test('close detaches storage and prevents a late read from enabling or changing the panel',async t=>{
 const gate=deferred(),h=await fixture(t,{readGate:gate.promise});t.after(gate.resolve);await h.open();h.close();
 const before=h.get('#features-panel').textContent;gate.resolve();await settle();assert.equal(h.events.size,0);assert.equal(h.state.destroyed,2);
 assert.equal(h.get('#features-panel').textContent,before);assert.ok(h.switches().every(input=>input.disabled));assert.deepEqual(h.writes,[]);
});

test('close during a save leaves no late DOM updates or further queued writes',async t=>{
 const h=await fixture(t),gate=deferred();t.after(gate.resolve);await h.open();h.state.writePlan.push({gate:gate.promise});await h.preset('lite');await h.preset('full');
 h.close();const before=h.get('#features-panel').textContent;gate.resolve();await settle();assert.equal(h.events.size,0);assert.equal(h.get('#features-panel').textContent,before);assert.equal(h.writes.length,1);
});

test('missing catalogue reports an integration error while the rest of the popup still initializes',async t=>{
 const h=await fixture(t,{missingAPI:true});await h.open();assert.match(h.get('#features-error').textContent,/unavailable/i);assert.equal(h.get('#features-error').hidden,false);
 assert.equal(h.get('#version').textContent,'3.7.0');assert.equal(h.get('#enabled').disabled,false);assert.deepEqual(h.writes,[]);
});

test('feature layout reuses light/dark drawn rows, native switches and segments without a separate skin',()=>{
 const css=read('popup.css');assert.match(css,/\.rows\{[^}]*background:/);assert.match(css,/\.drawn:after\{/);assert.match(css,/\.switch input:checked\+\.switch-track\{/);
 assert.match(css,/html\[data-theme=dark\] \.rows\{/);assert.match(css,/html\[data-theme=dark\] \.switch-track\{/);assert.match(css,/html\[data-theme=dark\] \.segments/);
 assert.match(css,/#feature-groups\{[^}]*overflow-y:auto/);assert.match(css,/\.feature-switch \.switch-track\{[^}]*position:relative/);
 assert.match(css,/\.feature-switch\{[^}]*white-space:normal/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
