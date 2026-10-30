'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

// A DOM boundary fixture, following the controller tests. It models connected
// node identity, bubbling, focus and attributes; it cannot verify remote embeds.
function dom(){
 const decode=s=>s.replace(/&(?:amp|lt|gt|quot|#39);/g,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"})[x]);
 const document={activeElement:null,events:{},attributeWrites:[]};
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.ownerDocument=document;this.attrs={};this.children=[];this.events={};this._text='';this.dataset={};this.disconnects=0;this.sourceWrites=0;this.scrollWidth=0;this.clientWidth=0;this.scrollTop=0;this.focusCalls=0;const styles=new Map();this.style={setProperty:(k,v)=>styles.set(k,v),getPropertyValue:k=>styles.get(k)||'',getPropertyPriority:()=>'',removeProperty:k=>styles.delete(k)};}
  get className(){return this.attrs.class||'';}set className(v){this.setAttribute('class',v);}
  get classList(){return {contains:v=>this.className.split(/\s+/).includes(v)};}
  get isConnected(){return document.body.contains(this);}
  get hidden(){return this.hasAttribute('hidden');}set hidden(v){v?this.setAttribute('hidden',''):this.removeAttribute('hidden');}
  get open(){return this.hasAttribute('open');}set open(v){v?this.setAttribute('open',''):this.removeAttribute('open');}
  get disabled(){return this.hasAttribute('disabled');}set disabled(v){v?this.setAttribute('disabled',''):this.removeAttribute('disabled');}
  get src(){return this.getAttribute('src');}set src(v){this.setAttribute('src',v);}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}set textContent(v){this.clear();this._text=String(v);}
  get value(){if(this._value!==undefined)return this._value;if(this.tagName==='TEXTAREA')return this.textContent;if(this.tagName==='SELECT'){const opts=this.querySelectorAll('option');return (opts.find(x=>x.hasAttribute('selected'))||opts[0])?.value||'';}return this.getAttribute('value')||'';}set value(v){this._value=String(v);}
  setAttribute(k,v){document.attributeWrites.push({node:this,key:k,value:String(v)});this.attrs[k]=String(v);if(k==='src'&&this.tagName==='IFRAME')this.sourceWrites++;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);}
  getAttribute(k){if(k.startsWith('data-'))return this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]??null;return this.attrs[k]??null;}
  hasAttribute(k){return this.getAttribute(k)!==null;}removeAttribute(k){document.attributeWrites.push({node:this,key:k,value:null});delete this.attrs[k];if(k.startsWith('data-'))delete this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())];}
  append(...nodes){for(const node of nodes){if(node.parentElement)node.remove();node.parentElement=this;this.children.push(node);}}
  insertBefore(node,before){if(node.parentElement)node.remove();const index=before?this.children.indexOf(before):this.children.length;assert.ok(index>=0);node.parentElement=this;this.children.splice(index,0,node);}
  clear(){for(const node of [...this.children])node.remove();this._text='';}
  remove(){if(!this.parentElement)return;if(this.isConnected)for(const frame of [this,...this.querySelectorAll('iframe')].filter(n=>n.tagName==='IFRAME'))frame.disconnects++;this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;}
  contains(node){return this===node||this.children.some(c=>c.contains(node));}
  set innerHTML(html){
   this.clear();const stack=[this],voids=new Set(['INPUT','BR','HR','IMG','LINK','META']);
   for(const token of html.match(/<[^>]+>|[^<]+/g)||[]){
    if(token.startsWith('</')){stack.pop();continue;}
    if(!token.startsWith('<')){stack.at(-1)._text+=decode(token);continue;}
    const [,tag,attrs]=token.match(/^<([\w-]+)([\s\S]*?)\/?\s*>$/)||[];if(!tag)continue;
    const node=new Element(tag);for(const a of attrs.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))node.setAttribute(a[1],decode(a[2]??a[3]??a[4]??''));
    stack.at(-1).append(node);if(!voids.has(node.tagName))stack.push(node);
   }
  }
  matches(selector){
   return selector.split(',').some(s=>{
    s=s.trim();if(s===':focus')return document.activeElement===this;
    let ok=true;s=s.replace(/\[([\w-]+)(?:(\^?=)(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/g,(_,k,op,a,b,c)=>{const want=a??b??c,actual=this.getAttribute(k);ok&&=op==='='?actual===want:op==='^='?actual?.startsWith(want):actual!==null;return '';});
    s=s.replace(/([.#])([\w-]+)/g,(_,kind,v)=>{ok&&=kind==='.'?this.classList.contains(v):this.getAttribute('id')===v;return '';});
    return ok&&(!s||s==='*'||s.toUpperCase()===this.tagName);
   });
  }
  querySelectorAll(selector){
   const descendants=this.children.flatMap(c=>[c,...c.querySelectorAll('*')]);
   return descendants.filter(node=>selector.split(',').some(part=>{
    const bits=part.trim().split(/\s+(?=(?:[^"]*"[^"]*")*[^"]*$)/);if(!node.matches(bits.pop()))return false;let p=node.parentElement;
    while(bits.length){const want=bits.pop();while(p&&!p.matches(want))p=p.parentElement;if(!p)return false;p=p.parentElement;}return true;
   }));
  }
  querySelector(s){return this.querySelectorAll(s)[0]||null;}closest(s){return this.matches(s)?this:this.parentElement?.closest(s)||null;}
  getRootNode(){return document;}getBoundingClientRect(){return {left:0,right:100};}scrollIntoView(){}
  setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;}
  focus(){this.focusCalls++;let p=this;while(p){if(p.hidden||p.tagName==='DIALOG'&&!p.open)return;p=p.parentElement;}if(this.isConnected&&!this.disabled)document.activeElement=this;}
  show(){this.showCalls=(this.showCalls||0)+1;this.open=true;}
  showModal(){assert.fail('Toolbox must never call showModal');}
  close(){this.open=false;}
  addEventListener(k,fn){(this.events[k]??=[]).push(fn);}
  removeEventListener(k,fn){this.events[k]=(this.events[k]||[]).filter(f=>f!==fn);}
  dispatch(type,props={}){const e={type,target:this,defaultPrevented:false,stopped:false,key:'',preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...props};let p=this;while(p){for(const fn of p.events[type]||[])fn(e);if(e.stopped)break;p=p.parentElement;}if(!e.stopped)for(const fn of document.events[type]||[])fn(e);return e;}
  click(){return this.dispatch('click');}
 }
 document.body=new Element('body');document.createElement=tag=>new Element(tag);document.addEventListener=(k,fn)=>(document.events[k]??=[]).push(fn);
 return document;
}

function fixture(t,{failSave=false,callback=true,resize=false,configure=()=>{},items=[],courses=[{id:'7',name:'Latin'}]}={}){
 const document=dom(),container=document.createElement('main'),trigger=document.createElement('button'),pageInput=document.createElement('input');document.body.append(trigger,container,pageInput);
 const events=[],navigation=[],listeners=new Set(),timers=new Map();let nextTimer=0;
 let data={settings:{timeZone:'America/New_York'},toolbox:{scratchpad:'',recent:[]},focus:{minutes:25,remaining:1500,endsAt:null,itemId:null,sessions:0},customTasks:[],tasks:{},resourcePins:[]};
 const store={owner:{origin:'https://school.instructure.com',accountId:'5'},get:()=>structuredClone(data),subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},async update(change){if(failSave)throw Error('Storage unavailable');const next=structuredClone(data);change(next);data=next;for(const fn of listeners)fn(store.get());}};
 const root={document,URL,Intl,Date,Map,Set,crypto:require('node:crypto').webcrypto,ReserveIcon:()=>'',setTimeout:fn=>{const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>1,clearInterval(){},addEventListener(){},FormData:class{constructor(form){this.fields=form.querySelectorAll('input,textarea,select');}get(k){return this.fields.find(n=>n.getAttribute('name')===k)?.value??null;}}};
 const windowEvents=new Map();Object.assign(root,{innerWidth:1400,innerHeight:900,addEventListener:(type,fn)=>{if(!windowEvents.has(type))windowEvents.set(type,new Set());windowEvents.get(type).add(fn);},removeEventListener:(type,fn)=>windowEvents.get(type)?.delete(fn),dispatch:type=>{for(const fn of windowEvents.get(type)||[])fn({type});}});document.defaultView=root;
 for(const file of ['site','core','ui-utils','personal-work','quick-open','material-model',...(resize?['toolbox-resize']:[]),'toolbox'])vm.runInNewContext(fs.readFileSync(require.resolve('../extension/'+file+'.js'),'utf8'),root,{filename:file+'.js'});
 configure(root);
 const toolbox=root.ReserveToolbox.create({container,store,getContext:()=>({s:data.settings,courses,items,courseId:'7'}),onNavigate:v=>navigation.push(['navigate',v]),onPreview:v=>navigation.push(['preview',v]),onPlanner:v=>navigation.push(['planner',v]),onCustomize:()=>navigation.push(['customize']),...(callback?{onDockChange:s=>events.push({...s})}:{})});
 t.after(()=>toolbox.destroy());
 const q=s=>container.querySelector(s),click=s=>{const node=q(s);assert.ok(node,'Missing control: '+s);node.click();return node;},type=(selector,value)=>{const node=q(selector);assert.ok(node,'Missing field: '+selector);node.value=value;node.dispatch('input');return node;};
 return {toolbox,document,container,trigger,pageInput,events,navigation,store,timers,root,q,click,type,get dialog(){return q('.rd-utility-dialog');}};
}
const flush=()=>new Promise(setImmediate);

// 4.0: the 3.x AI draft handoff is replaced by Your AI's question handoff (ai-panel tests).

// 4.0: the 3.x AI draft handoff is replaced by Your AI's question handoff (ai-panel tests).

test('quick search writes selection ARIA only when pointer or keyboard selection changes',t=>{
 const f=fixture(t,{items:Array.from({length:60},(_,i)=>({id:String(i+1),name:'Synthetic assignment '+i,courseId:'7'}))});f.toolbox.open('quick');
 const input=f.type('[data-ui-field="quick"]','Synthetic assignment'),rows=f.dialog.querySelectorAll('[data-quick-index]');assert.equal(rows.length,50);
 const aria=()=>f.document.attributeWrites.filter(write=>write.key==='aria-selected'||write.key==='aria-activedescendant');f.document.attributeWrites.length=0;
 for(let i=0;i<100;i++)rows[0].children[0].dispatch('pointermove');assert.equal(aria().length,0);
 rows[1].dispatch('pointermove');assert.deepEqual(aria().map(write=>[write.key,write.value]),[['aria-activedescendant','rd-quick-1'],['aria-selected','false'],['aria-selected','true']]);
 f.document.attributeWrites.length=0;input.dispatch('keydown',{key:'ArrowUp'});assert.equal(input.getAttribute('aria-activedescendant'),'rd-quick-0');assert.equal(aria().length,3);
 f.document.attributeWrites.length=0;input.dispatch('keydown',{key:'ArrowUp'});assert.equal(input.getAttribute('aria-activedescendant'),'rd-quick-49');assert.equal(aria().length,3);
 f.type('[data-ui-field="quick"]','zzzz-no-synthetic-results');assert.equal(input.getAttribute('aria-activedescendant'),null);f.document.attributeWrites.length=0;input.dispatch('keydown',{key:'ArrowDown'});assert.equal(aria().length,0);
 f.type('[data-ui-field="quick"]','Synthetic assignment');const replacement=f.q('[data-quick-index="0"]');assert.notStrictEqual(replacement,rows[0]);assert.equal(replacement.getAttribute('aria-selected'),'true');assert.equal(input.getAttribute('aria-activedescendant'),'rd-quick-0');
 f.document.attributeWrites.length=0;replacement.dispatch('pointermove');assert.equal(aria().length,0);
});

test('AI, GPA and calculators initialize on demand and stay attached until one cleanup',t=>{
 const calls={ai:0,gpa:0,aiDestroy:0,gpaDestroy:0},f=fixture(t,{configure(root){
  root.CanvasHarnessAISource={mount(options){calls.ai++;assert.equal(options.embedded,true);assert.equal(options.container.dataset.toolPanel,'ai');return {update(){},focus(){},destroy(){calls.aiDestroy++;}};}};
  root.CanvasHarnessGPAUI={create(){calls.gpa++;return {update(){},focus(){},destroy(){calls.gpaDestroy++;}};}};
 }});
 assert.deepEqual(calls,{ai:0,gpa:0,aiDestroy:0,gpaDestroy:0});assert.equal(f.dialog,null);
 f.toolbox.open('quick');assert.equal(calls.ai,0);assert.equal(calls.gpa,0);assert.equal(f.q('iframe'),null);
 f.toolbox.open('ai');const panel=f.q('[data-tool-panel="ai"]');assert.equal(calls.ai,1);
 f.toolbox.open('gpa');assert.equal(calls.gpa,1);assert.equal(panel.hidden,true);assert.equal(panel.isConnected,true);
 f.toolbox.open('calculator');const graph=f.q('[data-calculator-panel="graphing"] iframe');assert.ok(graph);assert.equal(f.q('[data-calculator-panel="scientific"] iframe'),null);
 f.toolbox.collapse();f.toolbox.expand();f.toolbox.close();f.toolbox.open('ai');assert.equal(calls.ai,1);assert.strictEqual(f.q('[data-tool-panel="ai"]'),panel);
 f.toolbox.open('calculator');assert.strictEqual(f.q('[data-calculator-panel="graphing"] iframe'),graph);assert.equal(graph.disconnects,0);assert.equal(graph.sourceWrites,1);
 f.toolbox.destroy();f.toolbox.destroy();assert.equal(calls.aiDestroy,1);assert.equal(calls.gpaDestroy,1);assert.equal(f.dialog,null);f.toolbox.open('ai');assert.equal(calls.ai,1);
});

test('disabled tools and optional AI or GPA retain their feature gates',t=>{
 const calls=[];const f=fixture(t,{configure(root){root.ReserveFeatures={enabled:id=>!['ai','gpa'].includes(id)};root.CanvasHarnessAISource={mount:()=>calls.push('ai')};root.CanvasHarnessGPAUI={create:()=>calls.push('gpa')};}});
 f.toolbox.open('ai');assert.equal(f.dialog.dataset.tool,'quick');f.toolbox.open('gpa');assert.equal(f.dialog.dataset.tool,'quick');assert.deepEqual(calls,[]);
 f.toolbox.destroy();f.root.ReserveFeatures={enabled:()=>false};assert.equal(f.root.ReserveToolbox.create({container:f.container}),null);
});

