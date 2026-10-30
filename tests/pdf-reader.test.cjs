// PDF mark-up tools adapted from HarryX081125's work, issue #53.
// Adapted from Gary Wu's pull request #47 to Canvas Harness.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {RenderQueue,occurrences,smoothPath,createReader}=require('../extension/pdf-reader.js');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

test('PDF render queue serializes mocked PDF.js tasks and discards stale zoom jobs',async()=>{
 const started=[],gate=deferred();let simultaneous=0,maximum=0,cancelled=0;
 const queue=new RenderQueue(async(job,{current,setCancel})=>{
  started.push(job);maximum=Math.max(maximum,++simultaneous);
  if(job==='old'){setCancel(()=>{cancelled++;gate.resolve();});await gate.promise;assert.equal(current(),false);}
  simultaneous--;
 });
 queue.set(['old','discard']);queue.cancel();await queue.set(['new','thumbnail']);
 assert.deepEqual(started,['old','new','thumbnail']);assert.equal(maximum,1);assert.equal(cancelled,1);
});

test('hidden PDF render queue cancels active work, does not render queued jobs and resumes explicitly',async()=>{
 const gate=deferred(),started=[];let cancelled=0;
 const queue=new RenderQueue(async(job,{setCancel})=>{started.push(job);if(job===1){setCancel(()=>{cancelled++;gate.resolve();});await gate.promise;}});
 queue.set([1,2]);queue.pause(true);await queue.set([3]);assert.deepEqual(started,[1]);assert.equal(cancelled,1);
 await queue.pause(false);assert.deepEqual(started,[1,3]);
});

test('a failed PDF page does not break the serialized queue',async()=>{
 const errors=[],done=[];const queue=new RenderQueue(async job=>{if(job===1)throw Error('bad page');done.push(job);},(error,job)=>errors.push([error.message,job]));
 await queue.set([1,2]);assert.deepEqual(done,[2]);assert.deepEqual(errors,[['bad page',1]]);
});

test('search finds literal case-insensitive spans and smoothed ink has finite SVG coordinates',()=>{
 assert.deepEqual(occurrences('Hello helLO hello','hello'),[{start:0,end:5},{start:6,end:11},{start:12,end:17}]);
 assert.deepEqual(occurrences('[a] . [a]','[a]'),[{start:0,end:3},{start:6,end:9}]);assert.deepEqual(occurrences('a',''),[]);
 assert.equal(smoothPath([]),'');assert.match(smoothPath([[1,2],[3,4],[5,6]]),/^M 1 2 Q 3 4 4 5 L 5 6$/);
});

// Deliberately small DOM/PDF.js doubles: no browser, network, real worker or PDF.
function lockFixture(){const tails=new Map();return {request(key,fn){const next=(tails.get(key)||Promise.resolve()).catch(()=>{}).then(fn);tails.set(key,next);return next;}};}
function fixture(shared={}){
 const origin=shared.origin||'https://school.instructure.com';
 const listeners=new Map(),ids=new Map(),observers=[],resizeObservers=[],frames=new Map(),timers=new Map(),timerDelays=new Map(),sent=[],storage=shared.storage||{},renders=[],workers=[],cleanup=[];let seq=0,doc;const subscribers=shared.subscribers||new Set(),locks=shared.locks||lockFixture();
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};this.className='';this.hidden=false;this.style={setProperty(k,v){this[k]=v;}};this.handlers=new Map();this.value='';this.width=0;this.height=0;this.scrollTop=0;this.scrollLeft=0;this.disabled=false;this._text='';}
  get classList(){return {toggle:(name,on)=>{const set=new Set(this.className.split(' ').filter(Boolean));if(on??!set.has(name))set.add(name);else set.delete(name);this.className=[...set].join(' ');},contains:name=>this.className.split(' ').includes(name)};}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}set textContent(value){this._text=String(value);this.children=[];}
  append(...nodes){for(const node of nodes){node.remove();this.children.push(node);node.parentNode=this;}}prepend(node){node.remove();this.children.unshift(node);node.parentNode=this;}
  removeEventListener(type,fn){this.handlers.set(type,(this.handlers.get(type)||[]).filter(h=>h.fn!==fn));}
  click(){return this.fire('click');}
  remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}}
  replaceChildren(...nodes){for(const child of [...this.children])child.remove();this._text='';this.append(...nodes);}
  get isConnected(){return this===doc.body||this===doc.documentElement||Boolean(this.parentNode?.isConnected)||ids.get(this.id)===this;}
  get tabIndex(){return this.attrs.tabindex!==undefined?Number(this.attrs.tabindex):['BUTTON','INPUT','TEXTAREA','SELECT'].includes(this.tagName)?0:-1;}set tabIndex(value){this.setAttribute('tabindex',value);}
  setAttribute(name,value){this.attrs[name]=String(value);if(name==='class')this.className=String(value);if(name==='id')this.id=String(value);}getAttribute(name){return this.attrs[name];}removeAttribute(name){delete this.attrs[name];}
  addEventListener(type,fn,options={}){const list=this.handlers.get(type)||[];list.push({fn,signal:options.signal});this.handlers.set(type,list);}
  async fire(type,extra={}){if(type==='close')this.open=false;for(const h of this.handlers.get(type)||[])if(!h.signal?.aborted)await h.fn({target:this,preventDefault(){},stopPropagation(){},...extra});}
  matches(selector){if(selector==='span:not(.markedContent)')return this.tagName==='SPAN'&&!this.classList.contains('markedContent');if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));if(selector.startsWith('#'))return this.id===selector.slice(1);const match=/^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(selector);if(match){const value=match[1].startsWith('data-')?this.dataset[match[1].slice(5)]??this.attrs[match[1]]:this.attrs[match[1]];return match[2]===undefined?value!==undefined:value===match[2];}return this.tagName===selector.toUpperCase();}
  closest(selector){return selector.split(',').some(s=>this.matches(s))?this:this.parentNode?.closest(selector)||null;}
  querySelectorAll(selector){return this.children.flatMap(c=>[...(c.matches(selector)?[c]:[]),...c.querySelectorAll(selector)]);}querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  get clientWidth(){return this._clientWidth??(this.id==='page-scroll'?700:parseFloat(this.style.width)||110);}get clientHeight(){return this.id==='page-scroll'?800:parseFloat(this.style.height)||154;}
  get offsetHeight(){return this.clientHeight;}get offsetTop(){if(this.className==='pdf-page'){const siblings=this.parentNode.children;return 20+siblings.slice(0,siblings.indexOf(this)).reduce((n,s)=>n+s.offsetHeight+20,0);}return 20;}
  getBoundingClientRect(){const top=this.className==='pdf-page'?this.offsetTop-(ids.get('page-scroll')?.scrollTop||0):0;return {top,left:0,width:this.clientWidth,height:this.clientHeight,right:this.clientWidth,bottom:top+this.clientHeight};}
  getContext(){return {}; }focus(){doc.activeElement=this;}select(){}setPointerCapture(id){this.pointer=id;}hasPointerCapture(id){return this.pointer===id;}releasePointerCapture(){this.pointer=null;}showModal(){this.open=true;}close(value){this.open=false;this.returnValue=value;}
 }
 const get=id=>{if(!ids.has(id)){const node=new Element(id==='find-input'?'input':'div');node.id=id;ids.set(id,node);}return ids.get(id);};
 doc={hidden:false,documentElement:new Element('html'),body:new Element('body'),getElementById:get,createElement:tag=>new Element(tag),createElementNS:(_ns,tag)=>new Element(tag),createTextNode:text=>{const e=new Element('#text');e.textContent=text;return e;},addEventListener(type,fn){listeners.set(type,fn);}};
 for(const id of ['side-view','find-bar','pen-palette','selection-menu','outline','marks'])get(id).hidden=true;
 const env={document:doc,location:{search:'?parentOrigin='+encodeURIComponent(origin)+'&token=test'},parent:{postMessage:(message,targetOrigin)=>{sent.push({message,origin:targetOrigin});if(message.type==='reserve-pdf-account')void Promise.resolve().then(()=>env.accountResponse()).then(accountId=>listeners.get('message')({source:env.parent,origin,data:{type:'reserve-pdf-account-result',token:'test',requestId:message.requestId,accountId}}));}},innerWidth:800,innerHeight:1000,devicePixelRatio:3,accountId:'7',accountResponse:()=>env.accountId,
  addEventListener(type,fn){listeners.set(type,fn);},setTimeout:(fn,delay)=>{const id=++seq;timers.set(id,fn);timerDelays.set(id,delay);return id;},clearTimeout:id=>{timers.delete(id);timerDelays.delete(id);},
  requestAnimationFrame:fn=>{const id=++seq;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
  IntersectionObserver:class{constructor(callback,options){this.callback=callback;this.options=options;this.nodes=[];observers.push(this);}observe(node){this.nodes.push(node);}disconnect(){this.nodes=[];this.disconnected=true;}},
  ResizeObserver:class{constructor(callback){this.callback=callback;resizeObservers.push(this);}observe(){}disconnect(){}},Worker:class{constructor(url,options){this.url=url;this.options=options;workers.push(this);}terminate(){this.terminated=true;}},
  chrome:{runtime:{getURL:path=>'chrome-extension://test/'+path},storage:{local:{get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,storage[key]])),set:async values=>{const changes={};for(const [key,newValue]of Object.entries(values)){changes[key]={oldValue:storage[key],newValue};storage[key]=newValue;}for(const fn of subscribers)fn(changes,'local');},remove:async key=>{const oldValue=storage[key];delete storage[key];for(const fn of subscribers)fn({[key]:{oldValue}},'local');}},onChanged:{addListener:fn=>{env.storageChanged=fn;subscribers.add(fn);},removeListener:fn=>{subscribers.delete(fn);if(env.storageChanged===fn)env.storageChanged=null;}}}},
  ReservePdfArt:{icons:new Proxy({},{get:()=>'<svg></svg>'}),pens:{yellow:'#F6DE7A',green:'#B5DE9A',pink:'#F5B3C2',blue:'#A9D3F0'}},navigator:{locks,clipboard:{writeText:async()=>{}}},getSelection:()=>null};
 const pages=Array.from({length:12},(_,index)=>({getViewport:({scale})=>({width:600*scale,height:800*scale,scale,convertToPdfPoint:(x,y)=>[x/scale,800-y/scale],convertToViewportPoint:(x,y)=>[x*scale,(800-y)*scale]}),render(options){renders.push({index,options});return {promise:Promise.resolve(),cancel(){}};},getTextContent:async()=>({items:[{str:'Page '+(index+1)+' text'}]}),cleanup(){cleanup.push(index);}}));
 const library={AnnotationMode:{ENABLE:1},GlobalWorkerOptions:{},PDFWorker:class{destroy(){env.wrapperDestroyed=true;}},getDocument(options){env.documentOptions=options;return {promise:Promise.resolve({numPages:12,getPage:async number=>pages[number-1],getOutline:async()=>null}),destroy:async()=>{await env.destroyPdf?.();}};},TextLayer:class{constructor(options){this.options=options;}render(){for(const item of this.options.textContentSource.items){if(!item.str)continue;const span=new Element('span');span.textContent=item.str;this.options.container.append(span);}return Promise.resolve();}cancel(){}}};
 const model=require('../extension/pdf-model.js'),reader=createReader(env,{library,model});
 const initialise=(extra={})=>reader.initialise({bytes:new ArrayBuffer(8),origin,fileId:'42',name:'Algebra.pdf',url:origin+'/files/42/download',appearance:{theme:'dark'},...extra});
 const settle=async()=>{for(let i=0;i<35;i++){await Promise.resolve();await reader.queue.done;}};
 return {env,doc,get,reader,initialise,settle,observers,resizeObservers,frames,sent,storage,renders,workers,cleanup,timers,timerDelays,listeners,pages};
}

test('local PDFs preserve their own download name, disable AI and keep annotations separate from Canvas migration',async()=>{
 const h=fixture(),legacy='reserve:pdf:https://school.instructure.com:42',key='reserve:pdf:https://school.instructure.com:7:cf-private-notes';
 h.storage[legacy]={version:1,annotations:[{id:'old',type:'note',page:0,point:[2,3],text:'Canvas note'}]};
 await h.initialise({local:true,accountId:'7',fileId:'cf-private-notes',name:'My private notes.pdf',url:'blob:https://school.instructure.com/local-pdf',aiEnabled:true});await h.settle();
 assert.ok(h.renders.length);assert.equal(h.reader.state.annotations.annotations.length,0);
 const download=h.get('heading-actions').children.find(x=>x.tagName==='A');assert.equal(download.download,'My private notes.pdf');
 const ai=h.get('toolbar').children.find(x=>x.attrs['aria-label']==='Ask AI about pages of this PDF');assert.equal(ai.hidden,true);
 await ai.fire('click');assert.equal(h.sent.some(x=>x.message.type==='reserve-pdf-ai'),false);assert.equal(h.doc.body.querySelector('#ai-range'),null);
 const noteTool=h.get('tool-buttons').children.find(x=>x.attrs['aria-label']==='Sticky note');await noteTool.fire('click');
 const slot=h.reader.state.slots[0];await h.get('pages').fire('pointerdown',{target:slot.node,button:0,clientX:20,clientY:slot.node.getBoundingClientRect().top+40});
 h.get('note-text').value='Local note';h.get('note-editor').returnValue='save';await h.get('note-editor').fire('close');await h.reader.close();
 assert.equal(h.storage[key].annotations[0].text,'Local note');assert.equal(h.storage[legacy].annotations[0].text,'Canvas note');
 assert.equal(h.storage['reserve:pdf-migration:https://school.instructure.com'],undefined);
});
test('local PDFs cannot load a foreign Blob URL or adopt another account after becoming visible',async()=>{
 const bad=fixture();await assert.rejects(bad.initialise({local:true,accountId:'7',fileId:'cf-private-notes',url:'blob:https://other.instructure.com/local-pdf'}),/site|origin|address/i);assert.equal(bad.renders.length,0);bad.reader.destroy();
 const h=fixture();await h.initialise({local:true,accountId:'7',fileId:'cf-private-notes',url:'blob:https://school.instructure.com/local-pdf'});await h.settle();
 h.doc.hidden=true;h.listeners.get('visibilitychange')();assert.equal(h.get('pages').hidden,true);
 const download=h.get('heading-actions').children.find(x=>x.tagName==='A');assert.equal(download.hidden,true);
 h.env.accountId='8';h.doc.hidden=false;h.listeners.get('visibilitychange')();await h.settle();
 assert.equal(h.get('pages').hidden,true);assert.ok(h.sent.some(x=>x.message.type==='reserve-pdf-error'&&/account.*changed/i.test(x.message.message)));
 assert.equal(h.storage['reserve:pdf:https://school.instructure.com:8:cf-private-notes'],undefined);h.reader.destroy();
});
test('saved PDFs accept a custom Canvas parent and read bytes without fetching the Blob URL',async t=>{
 const origin='https://canvas.my-school.edu',h=fixture({origin});t.after(()=>h.reader.destroy());
 h.env.fetch=()=>{throw Error('Local PDF bytes must not be fetched.');};
 await h.initialise({local:true,accountId:'7',fileId:'cf-private-notes',url:'blob:'+origin+'/saved-pdf',name:'My saved reading.pdf'});await h.settle();
 assert.ok(h.renders.length);assert.ok(h.env.documentOptions.data instanceof Uint8Array);assert.equal(h.env.documentOptions.url,undefined);
 const download=h.get('heading-actions').children.find(x=>x.tagName==='A');assert.equal(download.href,'blob:'+origin+'/saved-pdf');assert.equal(download.download,'My saved reading.pdf');assert.equal(download.hidden,false);assert.equal(download.target,'');
 assert.ok(h.sent.every(x=>x.origin===origin));
});
test('a local PDF is not parsed or rendered when the initial account differs from its owner',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());h.env.accountId='8';
 await h.initialise({local:true,accountId:'7',fileId:'cf-private-notes',url:'blob:https://school.instructure.com/local-pdf'});await h.settle();
 assert.equal(h.renders.length,0);assert.equal(h.workers.length,0);assert.equal(h.env.documentOptions,undefined);assert.equal(h.get('reader-layout').hidden,true);
 assert.equal(h.get('heading-actions').children.find(x=>x.tagName==='A').hidden,true);
 assert.ok(h.sent.some(x=>x.message.type==='reserve-pdf-error'&&/account.*changed/i.test(x.message.message)));assert.deepEqual(h.storage,{});
});
test('hiding during the initial local account check cannot start parsing unverified bytes',async t=>{
 const h=fixture(),gate=deferred();t.after(()=>h.reader.destroy());h.env.accountResponse=()=>gate.promise;
 const opening=h.initialise({local:true,accountId:'7',fileId:'cf-private-notes',url:'blob:https://school.instructure.com/local-pdf'});
 h.doc.hidden=true;h.listeners.get('visibilitychange')();gate.resolve('7');await opening;await h.settle();
 assert.equal(h.workers.length,0);assert.equal(h.env.documentOptions,undefined);assert.equal(h.renders.length,0);assert.equal(h.get('pages').hidden,true);
 assert.ok(h.sent.some(x=>x.message.type==='reserve-pdf-error'));
});
test('a verified local PDF remains readable when its annotation record is invalid and preserves that record',async t=>{
 const h=fixture(),key='reserve:pdf:https://school.instructure.com:7:cf-private-notes',saved={version:99,annotations:[]};t.after(()=>h.reader.destroy());h.storage[key]=saved;
 await h.initialise({local:true,accountId:'7',fileId:'cf-private-notes',url:'blob:https://school.instructure.com/local-pdf'});await h.settle();
 assert.ok(h.renders.length);assert.equal(h.get('reader-layout').hidden,false);assert.equal(h.get('heading-actions').children.find(x=>x.tagName==='A').hidden,false);
 assert.equal(h.get('tool-buttons').children.find(x=>x.attrs['aria-label']==='Sticky note').disabled,true);assert.equal(h.storage[key],saved);
 assert.equal(h.sent.some(x=>x.message.type==='reserve-pdf-error'),false);
});

test('mocked reader initially draws visible ±1 at capped DPR, frees distant canvases and terminates on close',async()=>{
 const h=fixture();await h.initialise();await h.settle();
 assert.deepEqual(h.renders.map(r=>r.index),[0,1]);assert.equal(h.reader.state.slots[0].canvas.width,Math.ceil(h.reader.state.slots[0].viewport.width*2));
 assert.equal(h.doc.documentElement.dataset.theme,'dark');assert.equal(h.env.documentOptions.isEvalSupported,false);assert.equal(h.env.documentOptions.enableXfa,false);
 h.observers[0].callback([{target:h.reader.state.slots[0].node,isIntersecting:false},{target:h.reader.state.slots[7].node,isIntersecting:true}]);await h.settle();
 assert.equal(h.reader.state.slots[0].canvas,null);assert.equal(h.reader.state.slots[1].canvas,null);assert.ok(h.reader.state.slots[7].canvas);assert.ok(h.cleanup.includes(0));
 await h.reader.close();assert.equal(h.workers[0].terminated,true);assert.equal(h.env.storageChanged,null);assert.equal(h.sent.at(-1).message.type,'reserve-pdf-close');assert.equal(h.sent.at(-1).origin,'https://school.instructure.com');
});

test('reader rejects spoofed parent messages, suspends while hidden and sends the chosen pages text only on Ask AI',async()=>{
 const h=fixture();await h.listeners.get('message')({source:{},origin:'https://evil.invalid',data:{type:'reserve-pdf-init',token:'test',bytes:new ArrayBuffer(8)}});assert.equal(h.renders.length,0);
 await h.initialise();await h.settle();h.doc.hidden=true;h.listeners.get('visibilitychange')();const before=h.renders.length;
 h.observers[0].callback([{target:h.reader.state.slots[10].node,isIntersecting:true}]);await h.settle();assert.equal(h.renders.length,before);assert.equal(h.reader.queue.paused,true);
 h.doc.hidden=false;h.listeners.get('visibilitychange')();await h.settle();
 assert.equal(h.sent.filter(s=>s.message.type==='reserve-pdf-ai').length,0);
 const ai=h.get('toolbar').children.find(n=>n.attrs['aria-label']==='Ask AI about pages of this PDF');await ai.fire('click');await h.settle();
 assert.equal(h.sent.filter(s=>s.message.type==='reserve-pdf-ai').length,0,'the button first asks which pages');
 const all=node=>[node,...(node.children||[]).flatMap(all)],menu=h.doc.body.children.find(n=>n.attrs?.id==='ai-range');assert.ok(menu&&!menu.hidden,'the range menu opens');
 await menu.fire('submit',{preventDefault(){}});await h.settle();
 assert.equal(h.sent.at(-1).message.type,'reserve-pdf-ai');assert.equal(h.sent.at(-1).message.text,'Page 1 text');assert.equal(h.sent.at(-1).message.name,'Algebra.pdf');assert.equal(h.sent.at(-1).message.page,0);assert.equal(h.sent.at(-1).message.endPage,0);
 // the whole document: every page's words, each marked with its page
 await ai.fire('click');await h.settle();all(menu).find(n=>n.attrs?.value==='all').checked=true;await menu.fire('submit',{preventDefault(){}});for(let i=0;i<8;i++)await h.settle();
 const whole=h.sent.at(-1).message,pages=h.reader.state.slots.length;
 assert.equal(whole.page,0);assert.equal(whole.endPage,pages-1);assert.ok(whole.text.startsWith('[Page 1]\nPage 1 text\n\n[Page 2]\nPage 2 text'),whole.text.slice(0,80));assert.ok(whole.text.endsWith('[Page '+pages+']\nPage '+pages+' text'));
 h.env.storageChanged({'reserve:appearance':{newValue:{theme:'light'}}},'local');assert.equal(h.doc.documentElement.dataset.theme,'light');h.reader.destroy();
});

test('the AI page menu contains only page choices and keeps keyboard navigation local',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();
 const ai=h.get('toolbar').children.find(n=>n.attrs['aria-label']==='Ask AI about pages of this PDF');await ai.fire('click');
 const menu=h.doc.body.querySelector('#ai-range'),from=menu.querySelector('[aria-label="From page"]');
 assert.equal(menu.classList.contains('paper-popover'),true);assert.equal(menu.querySelector('[value="page"]').checked,true);
 assert.equal(menu.querySelector('.ai-range-go').textContent,'Ask AI');assert.deepEqual(menu.querySelectorAll('select'),[]);
 const page=h.reader.state.currentPage,scroll=h.get('page-scroll').scrollTop;
 for(const key of ['ArrowDown','ArrowRight','Home'])h.listeners.get('keydown')({key,target:from});
 assert.equal(h.reader.state.currentPage,page);assert.equal(h.get('page-scroll').scrollTop,scroll);
 const inputs=menu.querySelectorAll('input');assert.deepEqual(inputs.map(n=>n.attrs.name||n.attrs['aria-label']),['ai-range','ai-range','From page','To page','ai-range']);
 h.listeners.get('keydown')({key:'Escape',target:from,preventDefault(){}});
 assert.equal(menu.hidden,true);assert.equal(h.doc.activeElement,ai);assert.equal(h.sent.some(s=>s.message.type==='reserve-pdf-close'),false);
});

test('Ask AI hands off every word of the chosen range using the plain pages message',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();
 const ai=h.get('toolbar').children.find(n=>n.attrs['aria-label']==='Ask AI about pages of this PDF');await ai.fire('click');
 const menu=h.doc.body.querySelector('#ai-range');menu.querySelector('[value="range"]').checked=true;
 menu.querySelector('[aria-label="From page"]').value='2';menu.querySelector('[aria-label="To page"]').value='4';
 await menu.fire('submit');for(let i=0;i<3;i++)await h.settle();
 assert.deepEqual(h.sent.filter(s=>s.message.type==='reserve-pdf-ai').map(s=>s.message),[{
  type:'reserve-pdf-ai',token:'test',text:'[Page 2]\nPage 2 text\n\n[Page 3]\nPage 3 text\n\n[Page 4]\nPage 4 text',page:1,endPage:3,name:'Algebra.pdf'
 }]);
 assert.equal(menu.hidden,true);
});

test('Ask AI keeps the existing range size limit and empty-page handling',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();
 const ai=h.get('toolbar').children.find(n=>n.attrs['aria-label']==='Ask AI about pages of this PDF');await ai.fire('click');
 const menu=h.doc.body.querySelector('#ai-range');
 menu.querySelector('[value="range"]').checked=true;menu.querySelector('[aria-label="From page"]').value='1';menu.querySelector('[aria-label="To page"]').value='2';
 h.pages[0].getTextContent=async()=>({items:[{str:'x'.repeat(60000)}]});h.pages[1].getTextContent=async()=>({items:[{str:'y'.repeat(60000)}]});
 await menu.fire('submit');for(let i=0;i<3;i++)await h.settle();
 assert.equal(menu.hidden,false);assert.equal(menu.querySelector('.ai-range-go').disabled,false);
 assert.match(menu.querySelector('.ai-range-note').textContent,/Pages 1 to 2.*100,000.*Pages 1 to 1 fit/);
 assert.equal(h.sent.some(s=>s.message.type==='reserve-pdf-ai'),false);
 menu.querySelector('[value="range"]').checked=false;h.pages[0].getTextContent=async()=>({items:[]});
 await menu.fire('submit');await h.settle();assert.match(menu.querySelector('.ai-range-note').textContent,/no selectable text/);
 assert.equal(h.sent.some(s=>s.message.type==='reserve-pdf-ai'),false);
});

test('a reader without its AI source transport keeps AI actions unavailable',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise({aiEnabled:false});await h.settle();
 const ai=h.get('toolbar').children.find(n=>n.attrs['aria-label']==='Ask AI about pages of this PDF');assert.equal(ai.hidden,true);
 await ai.fire('click');assert.equal(h.doc.body.querySelector('#ai-range'),null);assert.equal(h.sent.some(s=>s.message.type==='reserve-pdf-ai'),false);
});

test('a note is stored in PDF units; quota failure keeps the reader open and retry preserves the note',async()=>{
 const h=fixture();await h.initialise();await h.settle();
 const noteTool=h.get('tool-buttons').children.find(n=>n.attrs['aria-label']==='Sticky note');await noteTool.fire('click');
 const slot=h.reader.state.slots[0];await h.get('pages').fire('pointerdown',{target:slot.node,button:0,clientX:30,clientY:slot.node.getBoundingClientRect().top+40});
 h.get('note-text').value='My private note';h.get('note-editor').returnValue='save';await h.get('note-editor').fire('close');
 const note=h.reader.state.annotations.annotations[0];assert.equal(note.type,'note');assert.equal(note.text,'My private note');assert.ok(Math.abs(note.point[0]-30/h.reader.state.zoom)<.01);
 const save=h.env.chrome.storage.local.set;h.env.chrome.storage.local.set=async()=>{throw Error('QUOTA_BYTES');};await h.reader.close();
 assert.match(h.get('status').textContent,/storage is full or unavailable/);assert.equal(h.sent.filter(s=>s.message.type==='reserve-pdf-close').length,0);assert.equal(h.workers[0].terminated,undefined);
 h.env.chrome.storage.local.set=save;await h.reader.close();const record=Object.values(h.storage).find(v=>v?.version===1);assert.equal(record.annotations[0].text,'My private note');assert.equal(h.workers[0].terminated,true);
});

test('thumbnails wait for idle time, share the render queue and are freed when the side view closes',async()=>{
 const h=fixture();await h.initialise();await h.settle();const before=h.renders.length;
 const side=h.get('toolbar').children.find(n=>n.attrs['aria-label']==='Show page navigation');await side.fire('click');
 const thumbnail=h.get('thumbnails').children[0];h.observers[1].callback([{target:thumbnail,isIntersecting:true}]);await h.settle();assert.equal(h.renders.length,before);
 const [id,run]=h.timers.entries().next().value;h.timers.delete(id);run();await h.settle();
 assert.ok(h.reader.state.slots[0].thumbnail);assert.ok(h.renders.at(-1).options.viewport.width<=100);
 await side.fire('click');await h.settle();assert.equal(h.reader.state.slots[0].thumbnail,null);assert.equal(h.timers.size,0);h.reader.destroy();
});

test('incremental document search navigates to a later page and selection AI receives only the chosen text',async()=>{
 const h=fixture();await h.initialise();await h.settle();h.get('find-input').value='Page 8';await h.get('find-input').fire('input');
 for(let step=0;step<14;step++){const timer=h.timers.entries().next().value;if(timer){h.timers.delete(timer[0]);timer[1]();}await h.settle();}
 assert.equal(h.reader.state.matches.length,1);assert.equal(h.reader.state.matches[0].page,7);assert.equal(h.reader.state.currentPage,7);assert.equal(h.get('find-count').textContent,'1 / 1');
 const slot=h.reader.state.slots[7],bounds=slot.node.getBoundingClientRect(),rect={left:10,right:100,top:bounds.top+20,bottom:bounds.top+35,width:90,height:15};
 h.env.getSelection=()=>({isCollapsed:false,rangeCount:1,toString:()=>'Only this selected line',getRangeAt:()=>({intersectsNode:node=>node===slot.textLayer,getClientRects:()=>[rect],getBoundingClientRect:()=>rect})});
 h.listeners.get('pointerup')({target:slot.textLayer});const ai=h.get('selection-menu').children.find(b=>b.textContent==='Ask AI');await ai.fire('click');
 const message=h.sent.at(-1).message;assert.equal(message.type,'reserve-pdf-ai');assert.equal(message.text,'Only this selected line');assert.equal(message.page,7);assert.equal(message.name,'Algebra.pdf');assert.equal(message.annotations,undefined);h.reader.destroy();
});

test('zoom during an active PDF.js render retries the visible page rather than leaving it blank',async()=>{
 const h=fixture(),gate=deferred(),original=h.pages[0].render;let once=true,cancellations=0;
 h.pages[0].render=options=>{const task=original(options);if(!once)return task;once=false;return {promise:gate.promise,cancel(){cancellations++;const error=Error('zoom');error.name='RenderingCancelledException';gate.reject(error);}};};
 await h.initialise();for(let i=0;i<10;i++)await Promise.resolve();assert.equal(h.reader.state.slots[0].rendering,true);
 const zoomIn=h.get('toolbar').children.find(n=>n.attrs['aria-label']==='Zoom in (+)');await zoomIn.fire('click');await h.settle();
 assert.equal(cancellations,1);assert.equal(h.reader.state.slots[0].rendered,true);assert.ok(h.reader.state.slots[0].viewport.scale>1.2);h.reader.destroy();
});

test('hiding the tab cancels a PDF.js text stream and resuming reconstructs the visible text layer',async()=>{
 const h=fixture(),gate=deferred();let cancellations=0,unlocked=0;
 h.pages[0].streamTextContent=()=>({getReader:()=>({read:()=>gate.promise,cancel(reason){assert.ok(reason instanceof Error);cancellations++;gate.resolve({done:true});return Promise.resolve();},releaseLock(){unlocked++;}})});
 await h.initialise();for(let i=0;i<12;i++)await Promise.resolve();assert.equal(h.reader.state.slots[0].rendering,true);
 h.doc.hidden=true;h.listeners.get('visibilitychange')();await h.settle();assert.equal(cancellations,1);assert.equal(unlocked,1);assert.equal(h.reader.state.slots[0].canvas,null);
 delete h.pages[0].streamTextContent;h.doc.hidden=false;h.listeners.get('visibilitychange')();await h.settle();assert.equal(h.reader.state.slots[0].rendered,true);assert.ok(h.reader.state.slots[0].textLayer);h.reader.destroy();
});

test('failed annotation restore disables editing and never replaces the existing saved record',async()=>{
 const h=fixture(),model=require('../extension/pdf-model.js'),key=model.storageKey('https://school.instructure.com','7','42');
 const saved={version:99,annotations:[{text:'Preserve this original'}]};h.storage[key]=saved;await h.initialise();await h.settle();
 const note=h.get('tool-buttons').children.find(n=>n.attrs['aria-label']==='Sticky note');assert.equal(note.disabled,true);await note.fire('click');
 await h.get('pages').fire('pointerdown',{target:h.reader.state.slots[0].node,button:0,clientX:30,clientY:40});assert.equal(h.get('note-editor').open,undefined);assert.match(h.get('status').textContent,/protect the existing record/);
 await h.reader.close();assert.equal(h.storage[key],saved);assert.equal(h.workers[0].terminated,true);
});

test('reopening a saved note clears the prior dialog result so Escape cannot save a draft',async()=>{
 const h=fixture();await h.initialise();await h.settle();const button=h.get('tool-buttons').children.find(n=>n.attrs['aria-label']==='Sticky note');await button.fire('click');
 await h.get('pages').fire('pointerdown',{target:h.reader.state.slots[0].node,button:0,clientX:30,clientY:40});h.get('note-text').value='Saved';h.get('note-editor').returnValue='save';await h.get('note-editor').fire('close');
 await h.reader.state.slots[0].overlay.querySelector('.note-marker').fire('click');assert.equal(h.get('note-editor').returnValue,'');h.get('note-text').value='Draft to cancel';await h.get('note-editor').fire('close');assert.equal(h.reader.state.annotations.annotations[0].text,'Saved');await h.reader.close();
});

test('PDF teardown awaits its Terminate reply before destroying the worker wrapper and external worker',async()=>{
 const h=fixture(),gate=deferred();await h.initialise();await h.settle();h.env.destroyPdf=()=>gate.promise;
 const close=h.reader.close();for(let i=0;i<8;i++)await Promise.resolve();assert.equal(h.workers[0].terminated,undefined);assert.equal(h.env.wrapperDestroyed,undefined);
 gate.resolve();await close;assert.equal(h.workers[0].terminated,true);assert.equal(h.env.wrapperDestroyed,true);assert.equal(h.timers.size,0);
});

test('zoom cancels intervening text extraction and user units reach text-layer scale',async()=>{
 const h=fixture(),gate=deferred();let cancelled=0;
 const originalViewport=h.pages[0].getViewport;h.pages[0].getViewport=options=>({...originalViewport(options),userUnit:2});
 h.pages[0].streamTextContent=()=>({getReader:()=>({read:()=>gate.promise,cancel(reason){assert.ok(reason instanceof Error);cancelled++;gate.resolve({done:true});return Promise.resolve();},releaseLock(){}})});
 await h.initialise();for(let i=0;i<12;i++)await Promise.resolve();delete h.pages[0].streamTextContent;
 await h.get('toolbar').children.find(n=>n.attrs['aria-label']==='Zoom in (+)').fire('click');await h.settle();assert.equal(cancelled,1);assert.equal(h.reader.state.slots[0].rendered,true);assert.equal(h.reader.state.slots[0].node.style['--total-scale-factor'],h.reader.state.zoom*2);await h.reader.close();
});

test('Escape closes the innermost layer first: selection actions, then search, then the reader',async()=>{
 const h=fixture();await h.initialise();await h.settle();h.get('find-bar').hidden=false;h.get('selection-menu').hidden=false;let prevented=0;
 const escape=async()=>{h.listeners.get('keydown')({key:'Escape',target:h.get('page-scroll'),preventDefault(){prevented++;}});await h.settle();};
 const closed=()=>h.sent.some(entry=>entry.message.type==='reserve-pdf-close');
 await escape();assert.equal(h.get('selection-menu').hidden,true);assert.equal(h.get('find-bar').hidden,false);assert.equal(closed(),false);
 await escape();assert.equal(h.get('find-bar').hidden,true);assert.equal(closed(),false,'the reader stays open while search closes');
 await escape();assert.equal(prevented,3);assert.equal(h.sent.at(-1).message.type,'reserve-pdf-close');assert.equal(h.workers[0].terminated,true);
});

test('closing the search bar clears its marks and reopening searches the kept words again',async()=>{
 const h=fixture();await h.initialise();await h.settle();
 const run=async()=>{for(let step=0;step<14;step++){const timer=h.timers.entries().next().value;if(timer){h.timers.delete(timer[0]);timer[1]();}await h.settle();}};
 h.listeners.get('keydown')({key:'f',ctrlKey:true,target:h.get('page-scroll'),preventDefault(){}});await h.settle();
 h.get('find-input').value='Page 8';await h.get('find-input').fire('input');await run();
 assert.equal(h.reader.state.matches.length,1);
 h.listeners.get('keydown')({key:'Escape',target:h.get('find-input'),preventDefault(){}});await h.settle();
 assert.equal(h.get('find-bar').hidden,true);assert.equal(h.reader.state.matches.length,0,'no marks stay on the pages');assert.equal(h.get('find-count').textContent,'');
 assert.equal(h.sent.some(entry=>entry.message.type==='reserve-pdf-close'),false,'the reader stays open');
 h.listeners.get('keydown')({key:'f',ctrlKey:true,target:h.get('page-scroll'),preventDefault(){}});await h.settle();await run();
 assert.equal(h.get('find-input').value,'Page 8');assert.equal(h.reader.state.matches.length,1,'reopening finds the words again');h.reader.destroy();
});

test('shrinking then restoring the reader before the 160 ms settle restores every page to the real zoom',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();
 assert.equal(h.reader.state.zoom,1.11);
 const resize=width=>{
  h.get('page-scroll')._clientWidth=width;h.resizeObservers[0].callback([{target:h.get('page-scroll')}]);
  const pending=[...h.frames];h.frames.clear();for(const [,run]of pending)run();
 };
 resize(420);
 assert.equal(h.reader.state.slots[0].node.style.width,'386px','the intermediate width really stretches the pages');
 assert.equal(h.reader.state.slots[0].canvas.style.width,'386px');
 const settleTimer=[...h.timers].find(([id])=>h.timerDelays.get(id)===160);assert.ok(settleTimer);
 resize(700); // No settle callback has run between these two observer notifications.
 assert.equal(h.timers.size,1);assert.equal(h.reader.state.zoom,1.11);
 h.timers.delete(settleTimer[0]);settleTimer[1]();await h.settle();
 assert.equal(h.reader.state.slots.length,12);
 for(const slot of h.reader.state.slots){
  assert.ok(Math.abs(parseFloat(slot.node.style.width)-666)<1e-9,'page '+(slot.index+1));
  assert.ok(Math.abs(parseFloat(slot.node.style.height)-888)<1e-9);
  assert.equal(slot.node.style['--total-scale-factor'],1.11);
  if(slot.canvas){
   assert.ok(Math.abs(parseFloat(slot.canvas.style.width)-666)<1e-9);assert.ok(Math.abs(parseFloat(slot.canvas.style.height)-888)<1e-9);
   assert.ok(Math.abs(slot.viewport.width-666)<1e-9);assert.equal(slot.viewport.scale,1.11);
  }
 }
 assert.equal(h.get('zoom-label').textContent,'111%');
});

for(const cancel of ['Cancel','Escape'])test('closing the Ask AI range menu with '+cancel+' suppresses an in-flight text read',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();
 const gate=deferred(),started=deferred();
 h.pages[0].getTextContent=()=>{started.resolve();return gate.promise;};
 const ai=h.get('toolbar').children.find(n=>n.attrs['aria-label']==='Ask AI about pages of this PDF');
 await ai.fire('click');const menu=h.doc.body.children.find(n=>n.attrs.id==='ai-range');
 await menu.fire('submit');await started.promise;
 assert.equal(menu.querySelector('.ai-range-go').disabled,true,'the read is still pending');
 if(cancel==='Cancel')await menu.querySelectorAll('button').find(n=>n.textContent==='Cancel').fire('click');
 else h.listeners.get('keydown')({key:'Escape',target:h.doc.activeElement,preventDefault(){}});
 assert.equal(menu.hidden,true);assert.equal(h.doc.activeElement,ai);
 gate.resolve({items:[{str:'Cancelled text must never be sent'}]});await h.settle();
 assert.deepEqual(h.sent.filter(s=>s.message.type==='reserve-pdf-ai'),[]);
 assert.equal(menu.hidden,true);
});

for(const order of ['stale first','fresh first'])test('reopening and resubmitting Ask AI only sends the new read ('+order+')',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();
 const old=deferred(),fresh=deferred(),oldStarted=deferred(),freshStarted=deferred();let reads=0;
 h.pages[0].getTextContent=()=>{if(++reads===1){oldStarted.resolve();return old.promise;}freshStarted.resolve();return fresh.promise;};
 const ai=h.get('toolbar').children.find(n=>n.attrs['aria-label']==='Ask AI about pages of this PDF');
 await ai.fire('click');const menu=h.doc.body.children.find(n=>n.attrs.id==='ai-range');
 await menu.fire('submit');await oldStarted.promise;
 await ai.fire('click');assert.equal(menu.hidden,false);assert.equal(menu.querySelector('.ai-range-go').disabled,false);
 await menu.fire('submit');await freshStarted.promise;
 const messages=()=>h.sent.filter(s=>s.message.type==='reserve-pdf-ai');
 const finishOld=()=>old.resolve({items:[{str:'Stale selection'}]}),finishFresh=()=>fresh.resolve({items:[{str:'Fresh selection'}]});
 if(order==='stale first'){
  finishOld();await h.settle();assert.deepEqual(messages(),[],'an old read cannot send while its replacement is pending');
  assert.equal(menu.hidden,false);assert.equal(menu.querySelector('.ai-range-go').disabled,true);
  finishFresh();
 }else{finishFresh();await h.settle();assert.equal(messages().length,1);finishOld();}
 await h.settle();assert.equal(reads,2);
 assert.deepEqual(messages().map(s=>s.message),[{type:'reserve-pdf-ai',token:'test',text:'Fresh selection',page:0,endPage:0,name:'Algebra.pdf'}]);
 assert.equal(menu.hidden,true);
});

test('an eraser click with no coalesced events removes just the mark under it and can be undone',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());
 const key=require('../extension/pdf-model.js').storageKey('https://school.instructure.com','7','42');
 h.storage[key]={version:1,annotations:[
  {id:'under-click',type:'highlight',page:0,rects:[[20,740,90,780]]},
  {id:'untouched',type:'underline',page:0,rects:[[200,500,280,520]]}
 ]};
 await h.initialise();await h.settle();const slot=h.reader.state.slots[0],zoom=h.reader.state.zoom;let batches=0;
 h.doc.elementsFromPoint=()=>[slot.node];
 await h.get('tool-buttons').children.find(n=>n.attrs['aria-label']==='Eraser').fire('click');
 const event={target:slot.node,button:0,pointerId:7,clientX:40*zoom,clientY:slot.node.getBoundingClientRect().top+40*zoom,getCoalescedEvents(){batches++;return [];}};
 await h.get('pages').fire('pointerdown',event);
 assert.equal(slot.overlay.querySelector('[data-annotation="under-click"]').style.display,'none');
 await h.get('pages').fire('pointerup',event);
 assert.equal(batches,1);assert.deepEqual(h.reader.state.annotations.annotations.map(a=>a.id),['untouched']);
 assert.equal(slot.node.hasPointerCapture(7),false);
 await h.get('history-buttons').children.find(n=>n.attrs['aria-label']==='Undo').fire('click');
 assert.deepEqual(h.reader.state.annotations.annotations.map(a=>a.id),['under-click','untouched']);
});

test('pen moves with no coalesced events still record the pointer points in PDF coordinates',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();
 await h.get('tool-buttons').children.find(n=>n.attrs['aria-label']==='Pen').fire('click');
 const slot=h.reader.state.slots[0],zoom=h.reader.state.zoom,top=slot.node.getBoundingClientRect().top;let batches=0;
 const event=(x,y)=>({target:slot.node,button:0,pointerId:9,clientX:x*zoom,clientY:top+y*zoom,getCoalescedEvents(){batches++;return [];}});
 await h.get('pages').fire('pointerdown',event(20,20));
 await h.get('pages').fire('pointermove',event(40,40));await h.get('pages').fire('pointermove',event(60,60));
 await h.get('pages').fire('pointerup',event(60,60));
 assert.equal(batches,2);assert.equal(slot.node.hasPointerCapture(9),false);
 const marks=h.reader.state.annotations.annotations;assert.equal(marks.length,1);assert.equal(marks[0].type,'pen');assert.equal(marks[0].page,0);
 assert.equal(marks[0].points.length,3);
 for(const [index,want]of [[20,780],[40,760],[60,740]].entries())for(let axis=0;axis<2;axis++)assert.ok(Math.abs(marks[0].points[index][axis]-want[axis])<1e-9);
 assert.ok(slot.overlay.querySelector('[data-annotation="'+marks[0].id+'"]'));
});

test('highlight, underline and pen handles open their menus with Enter and regain focus on Escape',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());
 const key=require('../extension/pdf-model.js').storageKey('https://school.instructure.com','7','42');
 h.storage[key]={version:1,annotations:[
  {id:'highlight-handle',type:'highlight',page:0,rects:[[20,740,90,780]],text:'Highlighted words'},
  {id:'underline-handle',type:'underline',page:0,rects:[[120,640,190,680]],text:'Underlined words'},
  {id:'pen-handle',type:'pen',page:0,points:[[220,580],[250,550]]}
 ]};
 await h.initialise();await h.settle();const handles=h.reader.state.slots[0].overlay.querySelectorAll('.mark-handle');
 assert.equal(handles.length,3);assert.deepEqual(handles.map(n=>n.dataset.annotation),['highlight-handle','underline-handle','pen-handle']);
 for(const [index,handle]of handles.entries()){
  assert.equal(handle.tagName,'BUTTON');assert.equal(handle.disabled,false);assert.equal(handle.tabIndex,0);
  assert.match(handle.attrs['aria-label'],[/^Highlight:/,/^Underline:/,/^Drawing\./][index]);
  handle.focus();let prevented=false;
  await handle.fire('keydown',{key:'Enter',preventDefault(){prevented=true;}});
  const menu=h.doc.body.querySelector('#mark-menu');assert.ok(menu);assert.equal(menu.hidden,false);assert.equal(prevented,true);
  assert.equal(h.doc.activeElement,menu.querySelector('.mark-remove'));
  h.listeners.get('keydown')({key:'Escape',target:h.doc.activeElement,preventDefault(){}});
  assert.equal(menu.hidden,true);assert.equal(h.doc.activeElement,handle,'focus returns to '+handle.dataset.annotation);
  assert.equal(h.sent.some(s=>s.message.type==='reserve-pdf-close'),false);
 }
});

const noteRecord=(id,text=id)=>({id,type:'note',page:0,point:[30,760],text});
async function addFixtureNote(h,text){await h.get('tool-buttons').children.find(n=>n.attrs['aria-label']==='Sticky note').fire('click');const slot=h.reader.state.slots[0];await h.get('pages').fire('pointerdown',{target:slot.node,button:0,clientX:30,clientY:slot.node.getBoundingClientRect().top+40});h.get('note-text').value=text;h.get('note-editor').returnValue='save';await h.get('note-editor').fire('close');}
const parentMessage=(h,data)=>h.listeners.get('message')({source:h.env.parent,origin:'https://school.instructure.com',data:{token:'test',...data}});
async function saveFixture(h){for(const [id,run]of [...h.timers])if(h.timerDelays.get(id)===450){h.timers.delete(id);run();}await h.settle();}

test('marks are not read before verification; legacy marks move once to the first verified account',async t=>{
 const shared={storage:{},locks:lockFixture(),subscribers:new Set()},a=fixture(shared),b=fixture(shared),M=require('../extension/pdf-model.js'),legacy=M.legacyStorageKey('https://school.instructure.com','42');
 t.after(()=>{a.reader.destroy();b.reader.destroy();});shared.storage[legacy]={version:1,annotations:[noteRecord('legacy-private')]};
 const gate=deferred();a.env.accountResponse=()=>gate.promise;let reads=0;const get=a.env.chrome.storage.local.get;a.env.chrome.storage.local.get=async keys=>{reads++;return get(keys);};
 const opening=a.initialise();await Promise.resolve();assert.equal(reads,0);assert.equal(a.reader.state.annotations.annotations.length,0);
 gate.resolve('7');await opening;await a.settle();assert.equal(shared.storage[legacy],undefined);assert.equal(a.reader.state.annotations.annotations[0].id,'legacy-private');
 b.env.accountId='8';await b.initialise();await b.settle();assert.deepEqual(b.reader.state.annotations.annotations,[]);assert.equal(shared.storage[M.storageKey('https://school.instructure.com','7','42')].annotations[0].id,'legacy-private');
});

test('simultaneous account migrations claim the legacy record only once',async t=>{
 const shared={storage:{},locks:lockFixture(),subscribers:new Set()},a=fixture(shared),b=fixture(shared),M=require('../extension/pdf-model.js');t.after(()=>{a.reader.destroy();b.reader.destroy();});
 shared.storage[M.legacyStorageKey('https://school.instructure.com','42')]={version:1,annotations:[noteRecord('first-account-only')]};b.env.accountId='8';await Promise.all([a.initialise(),b.initialise()]);await Promise.all([a.settle(),b.settle()]);
 assert.equal(a.reader.state.annotations.annotations.length+b.reader.state.annotations.annotations.length,1);assert.equal(shared.storage[M.legacyStorageKey('https://school.instructure.com','42')],undefined);
});

test('returning to the tab hides private marks until reverified and switches accounts without leaking notes',async t=>{
 const h=fixture(),M=require('../extension/pdf-model.js');t.after(()=>h.reader.destroy());h.storage[M.storageKey('https://school.instructure.com','7','42')]={version:1,annotations:[noteRecord('private-account-seven')]};
 await h.initialise();await h.settle();assert.ok(h.reader.state.slots[0].overlay.querySelector('.note-marker'));
 h.doc.hidden=true;h.listeners.get('visibilitychange')();assert.equal(h.reader.state.slots[0].overlay,null);
 const gate=deferred();h.env.accountResponse=()=>gate.promise;h.doc.hidden=false;h.listeners.get('visibilitychange')();await h.settle();
 assert.equal(h.reader.state.slots[0].overlay,null);assert.equal(h.get('tool-buttons').children.find(n=>n.attrs['aria-label']==='Sticky note').disabled,true);
 gate.resolve('8');await h.settle();assert.deepEqual(h.reader.state.annotations.annotations,[]);assert.equal(h.reader.state.slots[0].overlay.querySelector('.note-marker'),null);
 h.doc.hidden=true;h.listeners.get('visibilitychange')();h.env.accountResponse=()=>null;h.doc.hidden=false;h.listeners.get('visibilitychange')();await h.settle();assert.equal(h.reader.state.slots[0].overlay,null);assert.match(h.get('status').textContent,/sign-in/);
});

test('a failed legacy deletion cannot expose migrated marks to a second account',async t=>{
 const shared={storage:{},locks:lockFixture(),subscribers:new Set()},a=fixture(shared),b=fixture(shared),M=require('../extension/pdf-model.js'),legacy=M.legacyStorageKey('https://school.instructure.com','42');t.after(()=>{a.reader.destroy();b.reader.destroy();});
 shared.storage[legacy]={version:1,annotations:[noteRecord('claimed')]};a.env.chrome.storage.local.remove=async()=>{throw Error('remove failed');};await a.initialise();await a.settle();assert.equal(shared.storage[legacy].migratedTo,M.storageKey('https://school.instructure.com','7','42'));
 b.env.accountId='8';await b.initialise();await b.settle();assert.deepEqual(b.reader.state.annotations.annotations,[]);assert.equal(shared.storage[legacy],undefined);
});

test('two tabs serialize mutations and reconcile adds, edits, erasure and undo without whole-record loss',async t=>{
 const shared={storage:{},locks:lockFixture(),subscribers:new Set()},a=fixture(shared),b=fixture(shared),M=require('../extension/pdf-model.js'),key=M.storageKey('https://school.instructure.com','7','42');t.after(()=>{a.reader.destroy();b.reader.destroy();});
 await Promise.all([a.initialise(),b.initialise()]);await Promise.all([a.settle(),b.settle()]);await addFixtureNote(a,'from A');await addFixtureNote(b,'from B');
 await Promise.all([saveFixture(a),saveFixture(b)]);await Promise.all([a.settle(),b.settle()]);
 assert.deepEqual(shared.storage[key].annotations.map(n=>n.text).sort(),['from A','from B']);for(const h of [a,b])assert.equal(h.reader.state.annotations.annotations.length,2);
 const first=a.reader.state.annotations.annotations.find(n=>n.text==='from A');await a.reader.state.slots[0].overlay.querySelector('[data-annotation="'+first.id+'"]').fire('click');a.get('note-text').value='A edited';a.get('note-editor').returnValue='save';await a.get('note-editor').fire('close');await saveFixture(a);await b.settle();assert.ok(b.reader.state.annotations.annotations.some(n=>n.text==='A edited'));
 await b.get('history-buttons').children.find(n=>n.attrs['aria-label']==='Undo').fire('click');await saveFixture(b);await a.settle();assert.deepEqual(a.reader.state.annotations.annotations.map(n=>n.text),['A edited']);assert.deepEqual(shared.storage[key].annotations.map(n=>n.text),['A edited']);
});

test('a host replacement request leaves the reader open after a failed save and reports its guarded result',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();await addFixtureNote(h,'keep this draft');const save=h.env.chrome.storage.local.set;h.env.chrome.storage.local.set=async()=>{throw Error('quota');};
 parentMessage(h,{type:'reserve-pdf-request-close',requestId:20});await h.settle();assert.deepEqual(h.sent.at(-1).message,{type:'reserve-pdf-close-result',token:'test',requestId:20,ok:false});assert.equal(h.workers[0].terminated,undefined);assert.match(h.get('status').textContent,/storage is full or unavailable/);
 h.env.chrome.storage.local.set=save;parentMessage(h,{type:'reserve-pdf-request-close',requestId:21});await h.settle();assert.equal(h.sent.at(-1).message.ok,true);assert.equal(h.sent.at(-1).message.requestId,21);assert.equal(h.workers[0].terminated,true);
});

test('PDF pages and thumbnails render embedded static annotations while keeping executable content disabled',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();assert.ok(h.renders.length);assert.ok(h.renders.every(r=>r.options.annotationMode===1));
 await h.get('toolbar').children.find(n=>n.attrs['aria-label']==='Show page navigation').fire('click');h.observers[1].callback([{target:h.get('thumbnails').children[0],isIntersecting:true}]);for(const [id,run]of [...h.timers]){h.timers.delete(id);run();}await h.settle();
 assert.ok(h.renders.some(r=>r.options.viewport.width<=100));assert.ok(h.renders.every(r=>r.options.annotationMode===1));assert.equal(h.env.documentOptions.isEvalSupported,false);assert.equal(h.env.documentOptions.enableXfa,false);
 const slot=h.reader.state.slots[0];assert.ok(slot.node.children.indexOf(slot.overlay)>slot.node.children.indexOf(slot.canvas));assert.equal(slot.node.querySelector('a'),null);assert.equal(slot.node.querySelector('input'),null);
});

for(const streaming of [true,false])test('hiding during Ask AI restores controls and rejects stale extraction (streaming='+streaming+')',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();const gate=deferred(),started=deferred();
 if(streaming)h.pages[0].streamTextContent=()=>({getReader:()=>({read(){started.resolve();return gate.promise;},cancel(){gate.resolve({done:true});return Promise.resolve();},releaseLock(){}})});else h.pages[0].getTextContent=()=>{started.resolve();return gate.promise;};
 const ai=h.get('toolbar').children.find(n=>n.attrs['aria-label']==='Ask AI about pages of this PDF');await ai.fire('click');const menu=h.doc.body.querySelector('#ai-range');await menu.fire('submit');await started.promise;assert.equal(menu.querySelector('.ai-range-go').disabled,true);
 h.doc.hidden=true;h.listeners.get('visibilitychange')();assert.equal(menu.querySelector('.ai-range-go').disabled,false);assert.equal(menu.querySelector('.ai-range-note').textContent,'');
 h.doc.hidden=false;h.listeners.get('visibilitychange')();if(!streaming)gate.resolve({items:[{str:'stale hidden text'}]});await h.settle();assert.equal(menu.querySelector('.ai-range-go').disabled,false);assert.equal(menu.querySelector('.ai-range-note').textContent,'');assert.deepEqual(h.sent.filter(s=>s.message.type==='reserve-pdf-ai'),[]);
});

test('search collapses whitespace and line breaks and maps cross-line matches back to the actual spans',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());h.pages[0].getTextContent=async()=>({items:[{str:'Leading alpha',hasEOL:true},{str:'  beta\t\t'},{str:'gamma trailing'}]});await h.initialise();await h.settle();h.get('find-input').value='alpha \n beta  gamma';await h.get('find-input').fire('input');
 for(let step=0;step<16;step++){const timer=h.timers.entries().next().value;if(timer){h.timers.delete(timer[0]);timer[1]();}await h.settle();}
 assert.equal(h.reader.state.matches.length,1);assert.equal(h.reader.state.matches[0].start,8);assert.equal(h.reader.state.matches[0].end,26);
 const layer=h.reader.state.slots[0].textLayer;assert.deepEqual(layer.querySelectorAll('mark').map(n=>n.textContent),['alpha','  beta\t\t','gamma']);assert.equal(layer.textContent,'Leading alpha  beta\t\tgamma trailing');
});

test('Fit recalculates on page changes and when a newly loaded page has wider dimensions',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());h.pages[1].getViewport=({scale})=>({width:900*scale,height:600*scale,scale});h.pages[5].getViewport=({scale})=>({width:1200*scale,height:600*scale,scale});await h.initialise();await h.settle();assert.equal(h.reader.state.zoom,1.11);
 const input=h.get('toolbar').querySelector('input');input.value='2';await input.fire('change');await h.settle();assert.ok(Math.abs(h.reader.state.zoom-666/900)<1e-9);
 input.value='6';await input.fire('change');await h.settle();assert.ok(Math.abs(h.reader.state.zoom-666/1200)<1e-9);assert.ok(Math.abs(parseFloat(h.reader.state.slots[5].canvas.style.width)-666)<1e-9);assert.equal(h.get('toolbar').children.find(n=>n.attrs['aria-label']==='Fit page width').attrs['aria-pressed'],'true');
});

test('Escape restores a maximised reader to split view before a second Escape closes it',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();parentMessage(h,{type:'reserve-pdf-fullscreen-state',on:true});
 h.listeners.get('keydown')({key:'Escape',target:h.get('page-scroll'),preventDefault(){}});await h.settle();assert.equal(h.sent.at(-1).message.type,'reserve-pdf-fullscreen');assert.equal(h.workers[0].terminated,undefined);
 parentMessage(h,{type:'reserve-pdf-fullscreen-state',on:false});h.listeners.get('keydown')({key:'Escape',target:h.get('page-scroll'),preventDefault(){}});await h.settle();assert.equal(h.sent.at(-1).message.type,'reserve-pdf-close');assert.equal(h.workers[0].terminated,true);
});


test('an account reply from a previous visible turn cannot restore another account marks',async t=>{
 const h=fixture(),M=require('../extension/pdf-model.js');t.after(()=>h.reader.destroy());h.storage[M.storageKey('https://school.instructure.com','7','42')]={version:1,annotations:[noteRecord('seven')]};h.storage[M.storageKey('https://school.instructure.com','8','42')]={version:1,annotations:[noteRecord('eight')]};await h.initialise();await h.settle();
 const old=deferred(),fresh=deferred();h.doc.hidden=true;h.listeners.get('visibilitychange')();h.env.accountResponse=()=>old.promise;h.doc.hidden=false;h.listeners.get('visibilitychange')();await h.settle();
 h.doc.hidden=true;h.listeners.get('visibilitychange')();h.env.accountResponse=()=>fresh.promise;h.doc.hidden=false;h.listeners.get('visibilitychange')();await h.settle();fresh.resolve('8');await h.settle();assert.deepEqual(h.reader.state.annotations.annotations.map(a=>a.id),['eight']);
 old.resolve('7');await h.settle();assert.deepEqual(h.reader.state.annotations.annotations.map(a=>a.id),['eight']);assert.equal(h.reader.state.slots[0].overlay.querySelectorAll('.note-marker').length,1);
});


function crowdedAnnotations(){return {version:1,annotations:Array.from({length:103},(_,i)=>noteRecord('remote-'+i,'x'.repeat(10000)))};}
test('a quota conflict with another tab keeps undo available and coalesces the pending add and undo before checking size',async t=>{
 const h=fixture(),M=require('../extension/pdf-model.js'),key=M.storageKey('https://school.instructure.com','7','42'),saved=M.createAnnotations(crowdedAnnotations()).serialise();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();await addFixtureNote(h,'y'.repeat(10000));
 await h.env.chrome.storage.local.set({[key]:saved});const undo=h.get('history-buttons').children.find(n=>n.attrs['aria-label']==='Undo');assert.equal(undo.disabled,false);assert.equal(h.get('tool-buttons').children.find(n=>n.attrs['aria-label']==='Eraser').disabled,false);assert.equal(h.reader.state.annotations.annotations.length,1);assert.match(h.get('status').textContent,/1 MiB/);
 assert.equal(await h.reader.close(),false);assert.equal(h.workers[0].terminated,undefined);assert.deepEqual(h.storage[key],saved);
 await undo.fire('click');assert.equal(h.reader.state.annotations.annotations.length,103);assert.equal(await h.reader.close(),true);assert.deepEqual(h.storage[key],saved);assert.equal(h.workers[0].terminated,true);
});

test('quota-rejected undo does not leave an untracked mark that bypasses guarded close',async t=>{
 const h=fixture(),M=require('../extension/pdf-model.js'),key=M.storageKey('https://school.instructure.com','7','42'),saved=M.createAnnotations(crowdedAnnotations()).serialise();t.after(()=>h.reader.destroy());h.storage[key]=saved;await h.initialise();await h.settle();
 const removed=saved.annotations[0];h.reader.state.annotations.erase(removed.id);const remote={version:1,annotations:[...saved.annotations.slice(1),{...removed,id:'replacement'}]};await h.env.chrome.storage.local.set({[key]:remote});
 const before=h.reader.state.annotations.serialise();await h.get('history-buttons').children.find(n=>n.attrs['aria-label']==='Undo').fire('click');assert.match(h.get('status').textContent,/1 MiB/);assert.deepEqual(h.reader.state.annotations.serialise(),before);assert.equal(await h.reader.close(),true);assert.deepEqual(M.createAnnotations(h.storage[key]).serialise(),before);
});

test('an update after the initialization read but before the lock resolves is immediately visible',async t=>{
 const locks=lockFixture(),M=require('../extension/pdf-model.js'),key=M.storageKey('https://school.instructure.com','7','42');let h,once=false;
 const shared={locks:{request(name,fn){return locks.request(name,fn).then(async value=>{if(name===key&&!once){once=true;await locks.request(key,()=>h.env.chrome.storage.local.set({[key]:{version:1,annotations:[noteRecord('initial'),noteRecord('concurrent')]}}));}return value;});}}};h=fixture(shared);t.after(()=>h.reader.destroy());h.storage[key]={version:1,annotations:[noteRecord('initial')]};await h.initialise();await h.settle();assert.deepEqual(h.reader.state.annotations.annotations.map(a=>a.id),['initial','concurrent']);assert.equal(h.reader.state.slots[0].overlay.querySelectorAll('.note-marker').length,2);
});


for(const drag of [false,true])test('erase then remote edit then undo preserves the newer note through pending saves (drag='+drag+')',async t=>{
 const shared={storage:{},locks:lockFixture(),subscribers:new Set()},a=fixture(shared),b=fixture(shared),M=require('../extension/pdf-model.js'),key=M.storageKey('https://school.instructure.com','7','42');
 t.after(()=>{a.reader.destroy();b.reader.destroy();});shared.storage[key]={version:1,annotations:[noteRecord('shared-note','original')]};
 await Promise.all([a.initialise(),b.initialise()]);await Promise.all([a.settle(),b.settle()]);
 await a.get('tool-buttons').children.find(n=>n.attrs['aria-label']==='Eraser').fire('click');
 const slot=a.reader.state.slots[0];
 if(drag){
  const marker=slot.overlay.querySelector('[data-annotation="shared-note"]');a.doc.elementsFromPoint=()=>[marker,slot.node];const event={target:slot.node,button:0,pointerId:7,clientX:30*a.reader.state.zoom,clientY:slot.node.getBoundingClientRect().top+40*a.reader.state.zoom};
  await a.get('pages').fire('pointerdown',event);await a.get('pages').fire('pointerup',event);
 }else await slot.overlay.querySelector('[data-annotation="shared-note"]').fire('click');
 assert.deepEqual(a.reader.state.annotations.annotations,[]);
 await b.reader.state.slots[0].overlay.querySelector('[data-annotation="shared-note"]').fire('click');b.get('note-text').value='newer from B';b.get('note-editor').returnValue='save';await b.get('note-editor').fire('close');await saveFixture(b);await a.settle();
 assert.equal(shared.storage[key].annotations[0].text,'newer from B');assert.deepEqual(a.reader.state.annotations.annotations,[],'the pending erase is still applied locally');
 const undo=a.get('history-buttons').children.find(n=>n.attrs['aria-label']==='Undo');await undo.fire('click');await saveFixture(a);await b.settle();
 assert.equal(shared.storage[key].annotations[0].text,'newer from B');
 for(const h of [a,b])assert.equal(h.reader.state.annotations.annotations[0].text,'newer from B');
 assert.equal(a.reader.state.annotations.undo(),false,'the conflicting erase undo step is gone');
 await a.reader.close();assert.equal(shared.storage[key].annotations[0].text,'newer from B');
});

const toolButton=(h,label)=>h.get('tool-buttons').children.find(n=>n.attrs['aria-label']===label);
const optionButton=(h,label)=>h.get('pen-palette').children.find(n=>n.attrs['aria-label']===label);
const readerKey=(h,key,extra={})=>h.listeners.get('keydown')({target:h.get('page-scroll'),key,preventDefault(){},...extra});
async function drawFixture(h,label){
 await toolButton(h,label).fire('click');const slot=h.reader.state.slots[h.reader.state.currentPage],top=slot.node.getBoundingClientRect().top;
 const event=(x,y)=>({target:slot.node,button:0,pointerId:31,clientX:x,clientY:top+y});
 await h.get('pages').fire('pointerdown',event(20,30));await h.get('pages').fire('pointermove',event(80,90));await h.get('pages').fire('pointerup',event(80,90));
}

test('the dock remembers independent tool colours, widths and text sizes across switches and reopen',async t=>{
 const shared={storage:{}},h=fixture(shared);t.after(()=>h.reader.destroy());await h.initialise();await h.settle();
 await toolButton(h,'Pen').fire('click');await optionButton(h,'red').fire('click');await optionButton(h,'Bold line').fire('click');
 await toolButton(h,'Highlighter pen').fire('click');await optionButton(h,'green').fire('click');await optionButton(h,'Thin line').fire('click');
 await toolButton(h,'Text box').fire('click');await optionButton(h,'purple').fire('click');await optionButton(h,'Large text').fire('click');
 await toolButton(h,'Pen').fire('click');assert.equal(optionButton(h,'red').attrs['aria-pressed'],'true');assert.equal(optionButton(h,'Bold line').attrs['aria-pressed'],'true');
 await toolButton(h,'Pen').fire('click');await drawFixture(h,'Pen');await drawFixture(h,'Highlighter pen');
 const [pen,marker]=h.reader.state.annotations.annotations;assert.equal(pen.width,3);assert.equal(pen.color,'#C8372D');assert.equal(marker.width,7);assert.equal(marker.opacity,.42);assert.equal(marker.color,'#B5DE9A');
 await h.reader.close();const reopened=fixture(shared);t.after(()=>reopened.reader.destroy());await reopened.initialise();await reopened.settle();
 await toolButton(reopened,'Text box').fire('click');assert.equal(optionButton(reopened,'purple').attrs['aria-pressed'],'true');assert.equal(optionButton(reopened,'Large text').attrs['aria-pressed'],'true');
 await toolButton(reopened,'Highlighter pen').fire('click');assert.equal(optionButton(reopened,'green').attrs['aria-pressed'],'true');assert.equal(optionButton(reopened,'Thin line').attrs['aria-pressed'],'true');
});

test('invalid stored tool options cannot break the dock or inject styles',async t=>{
 const h=fixture({storage:{'reserve:pdf-tools':{pen:{color:7,width:Infinity},shape:{color:'url(https://example.org)',shape:'script',width:-2},text:{size:1e9}}}});t.after(()=>h.reader.destroy());await h.initialise();await h.settle();
 await toolButton(h,'Pen').fire('click');assert.equal(optionButton(h,'blue').attrs['aria-pressed'],'true');assert.equal(optionButton(h,'Medium line').attrs['aria-pressed'],'true');
 await toolButton(h,'Shapes').fire('click');assert.equal(optionButton(h,'Box').attrs['aria-pressed'],'true');
});

test('dock undo and keyboard redo survive a save; a new edit clears redo and typing ignores tool shortcuts',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();await drawFixture(h,'Pen');await saveFixture(h);
 const undo=h.get('history-buttons').children.find(n=>n.attrs['aria-label']==='Undo'),redo=h.get('history-buttons').children.find(n=>n.attrs['aria-label']==='Redo');assert.equal(undo.disabled,false);assert.equal(redo.disabled,true);
 await undo.fire('click');assert.equal(h.reader.state.annotations.annotations.length,0);assert.equal(redo.disabled,false);await saveFixture(h);readerKey(h,'z',{ctrlKey:true,shiftKey:true});assert.equal(h.reader.state.annotations.annotations.length,1);
 readerKey(h,'z',{metaKey:true});assert.equal(h.reader.state.annotations.annotations.length,0);await drawFixture(h,'Shapes');assert.equal(redo.disabled,true);assert.equal(h.reader.state.annotations.annotations[0].type,'shape');
 h.listeners.get('keydown')({target:h.get('find-input'),key:'h',preventDefault(){throw Error('typing shortcut was intercepted');}});assert.equal(h.doc.body.className,'tool-shape');
 for(const [key,tool]of Object.entries({h:'highlight',u:'underline',k:'strike',p:'pen',m:'marker',t:'text',n:'note',r:'shape',e:'eraser'})){readerKey(h,key);assert.equal(h.doc.body.className,'tool-'+tool);}
});

test('Marks lists every kind by page, navigates and exports matching clipboard and Markdown notes',async t=>{
 const M=require('../extension/pdf-model.js'),key=M.storageKey('https://school.instructure.com','7','42'),h=fixture();t.after(()=>h.reader.destroy());
 h.storage[key]={version:1,annotations:[{id:'later-note',type:'note',page:3,point:[20,700],text:'Later note'},
  {id:'selected-strike',type:'strike',page:0,rects:[[20,700,100,720]],text:'Old words',color:'#C8372D'},
  {id:'typed-text',type:'text',page:0,point:[20,650],text:'Typed words',color:'#222222',size:12},
  {id:'drawn-box',type:'shape',shape:'rect',page:1,points:[[10,20],[50,60]],width:3,color:'#C8372D'},
  {id:'drawn-marker',type:'pen',page:2,points:[[10,20],[50,60]],width:12,opacity:.42,color:'#F6DE7A'}]};
 h.env.ReservePdfStudyNotes=require('../extension/pdf-study-notes.js');
 let copied='',blob=null,download=null;h.env.navigator.clipboard.writeText=async value=>{copied=value;};h.env.Blob=class{constructor(parts,options){this.parts=parts;this.type=options.type;}};h.env.URL={createObjectURL(value){blob=value;return 'blob:test-notes';},revokeObjectURL(){}};
 const create=h.doc.createElement;h.doc.createElement=tag=>{const node=create(tag);if(tag==='a')node.click=()=>{download=node.download;};return node;};
 await h.initialise();await h.settle();await h.get('toolbar').children.find(n=>n.attrs['aria-label']==='Show page navigation').fire('click');await h.get('marks-tab').fire('click');
 assert.equal(h.get('marks-count').textContent,'5');assert.deepEqual(h.get('marks-list').querySelectorAll('.marks-page').map(n=>n.textContent),['Page 1','Page 2','Page 3','Page 4']);
 const items=h.get('marks-list').querySelectorAll('.mark-item');assert.equal(items.length,5);assert.match(items[3].textContent,/Highlighter pen/);await items[4].fire('click');assert.equal(h.reader.state.currentPage,3);
 await h.get('marks-copy').fire('click');assert.match(copied,/## Page 1/);assert.match(copied,/Old words/);assert.match(copied,/2 drawings or marks without text omitted/);assert.match(copied,/Typed words/);assert.doesNotMatch(copied,/Box|Highlighter pen/);assert.match(copied,/Later note/);
 await h.get('marks-download').fire('click');assert.equal(blob.type,'text/markdown;charset=utf-8');assert.equal(blob.parts[0],copied);assert.equal(download,'Algebra-study-notes.md');
 h.doc.hidden=true;h.listeners.get('visibilitychange')();assert.equal(h.get('marks-list').children.length,0);assert.equal(h.get('marks-copy').disabled,true);
});

test('reopen restores the last page per account and local file while an explicit page takes precedence',async t=>{
 const shared={storage:{}},h=fixture(shared);t.after(()=>h.reader.destroy());await h.initialise();await h.settle();readerKey(h,'PageDown');readerKey(h,'PageDown');assert.equal(h.reader.state.currentPage,2);await h.reader.close();
 const reopened=fixture(shared);t.after(()=>reopened.reader.destroy());await reopened.initialise();for(const [id,run]of [...reopened.frames]){reopened.frames.delete(id);run();}await reopened.settle();assert.equal(reopened.reader.state.currentPage,2);
 const other=fixture(shared);t.after(()=>other.reader.destroy());other.env.accountId='8';await other.initialise();for(const run of [...other.frames.values()])run();await other.settle();assert.equal(other.reader.state.currentPage,0);
 const linked=fixture(shared);t.after(()=>linked.reader.destroy());await linked.initialise({page:4});for(const run of [...linked.frames.values()])run();await linked.settle();assert.equal(linked.reader.state.currentPage,4);
 const local=fixture(shared);t.after(()=>local.reader.destroy());const extra={local:true,accountId:'7',fileId:'cf-private-notes',url:'blob:https://school.instructure.com/local-pdf'};await local.initialise(extra);await local.settle();readerKey(local,'PageDown');await local.reader.close();
 const again=fixture(shared);t.after(()=>again.reader.destroy());await again.initialise(extra);for(const run of [...again.frames.values()])run();await again.settle();assert.equal(again.reader.state.currentPage,1);
});

test('text commits before close and Canvas handoff refuses to discard unsaved edits',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();await toolButton(h,'Text box').fire('click');const slot=h.reader.state.slots[0];await h.get('pages').fire('pointerdown',{target:slot.node,button:0,clientX:40,clientY:slot.node.getBoundingClientRect().top+60});
 slot.node.querySelector('.text-editor').value='Keep this typed text';const set=h.env.chrome.storage.local.set;h.env.chrome.storage.local.set=async()=>{throw Error('quota');};
 const canvas=h.get('heading-actions').children.find(n=>n.attrs['aria-label']==="Open in Canvas's own viewer");await canvas.fire('click');assert.equal(h.sent.some(n=>n.message.type==='reserve-pdf-canvas'),false);assert.equal(h.reader.state.annotations.annotations[0].text,'Keep this typed text');
 assert.equal(await h.reader.close(),false);h.env.chrome.storage.local.set=set;await canvas.fire('click');assert.equal(h.sent.at(-1).message.type,'reserve-pdf-canvas');assert.equal(await h.reader.close(),true);
});

test('Ctrl and Command zoom, fit and pinch preserve bounded reader zoom',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();const fit=h.reader.state.zoom;readerKey(h,'+',{ctrlKey:true});assert.ok(h.reader.state.zoom>fit);readerKey(h,'0',{metaKey:true});assert.equal(h.reader.state.zoom,fit);
 await h.get('page-scroll').fire('wheel',{ctrlKey:true,deltaY:-1000,clientX:100,clientY:100});assert.equal(h.reader.state.zoom,5);await h.get('page-scroll').fire('wheel',{metaKey:true,deltaY:1000,clientX:100,clientY:100});assert.equal(h.reader.state.zoom,.2);
});

function remoteFixture(shared={},granted=false){
 const h=fixture(shared),calls={contains:[],requests:[],fetches:[]};
 h.env.chrome.permissions={contains:async access=>{calls.contains.push(access);return granted;},request:async access=>{calls.requests.push(access);return granted;}};
 h.env.fetch=async(url,options)=>{calls.fetches.push({url,options});const bytes=new TextEncoder().encode('%PDF-1.7');return {ok:true,url,headers:{get:()=>null},body:{getReader:()=>{let read=false;return {read:async()=>read?{done:true}:(read=true,{done:false,value:bytes}),cancel:async()=>{},releaseLock(){}};}}};};
 const extra={origin:'https://school.instructure.com',bytes:null,fetchInReader:true,fileId:'remote-'+'a'.repeat(64),remote:'https://example.org/reading.pdf',name:'Reading.pdf',url:'https://example.org/reading.pdf',page:3};
 return {...h,calls,extra,grant(value){granted=value;}};
}

test('external PDF permission is an exact-site user choice; decline is remembered and falls back without a fetch',async t=>{
 const shared={storage:{}},h=remoteFixture(shared);t.after(()=>h.reader.destroy());
 parentMessage(h,{type:'reserve-pdf-init',...h.extra});await h.settle();assert.equal(h.calls.requests.length,0);assert.equal(h.calls.fetches.length,0);
 assert.deepEqual(h.get('status').children.map(n=>n.textContent),['Allow example.org','Open normally']);await h.get('status').children[0].fire('click');await h.settle();
 assert.deepEqual(h.calls.requests,[{origins:['https://example.org/*']}]);assert.equal(h.sent.at(-1).message.type,'reserve-pdf-error');assert.equal(h.calls.fetches.length,0);
 const again=remoteFixture(shared);t.after(()=>again.reader.destroy());parentMessage(again,{type:'reserve-pdf-init',...again.extra});await again.settle();
 assert.equal(again.calls.requests.length,0);assert.equal(again.get('status').children.length,0);assert.equal(again.sent.at(-1).message.type,'reserve-pdf-error');assert.equal(again.calls.fetches.length,0);
});

test('Open normally declines without a browser prompt and concurrent readers share one site decision',async t=>{
 const shared={storage:{},locks:lockFixture()},a=remoteFixture(shared),b=remoteFixture(shared);t.after(()=>{a.reader.destroy();b.reader.destroy();});
 parentMessage(a,{type:'reserve-pdf-init',...a.extra});parentMessage(b,{type:'reserve-pdf-init',...b.extra});await a.settle();await b.settle();
 const prompting=[a,b].filter(h=>h.get('status').children.length===2);assert.equal(prompting.length,1);await prompting[0].get('status').children[1].fire('click');await a.settle();await b.settle();
 for(const h of [a,b]){assert.equal(h.calls.requests.length,0);assert.equal(h.calls.fetches.length,0);assert.equal(h.sent.at(-1).message.type,'reserve-pdf-error');}
});

test('granted external PDF access omits credentials, opens the link page, isolates marks and hides Canvas and AI actions',async t=>{
 const shared={storage:{}},h=remoteFixture(shared);t.after(()=>h.reader.destroy());let opening=h.initialise(h.extra);await h.settle();h.grant(true);await h.get('status').children[0].fire('click');await opening;for(const run of [...h.frames.values()])run();await h.settle();
 assert.equal(h.calls.requests.length,1);assert.equal(h.calls.fetches[0].options.credentials,'omit');assert.equal(h.calls.fetches[0].url,'https://example.org/reading.pdf');assert.equal(h.reader.state.currentPage,3);
 assert.equal(h.get('heading-actions').children.find(n=>n.attrs['aria-label']==="Open in Canvas's own viewer").hidden,true);assert.equal(h.get('toolbar').children.find(n=>n.attrs['aria-label']==='Ask AI about pages of this PDF').hidden,true);
 await addFixtureNote(h,'Outside file note');await h.reader.close();const key=require('../extension/pdf-model.js').storageKey('https://school.instructure.com','7',h.extra.fileId);assert.equal(shared.storage[key].annotations[0].text,'Outside file note');
 const again=remoteFixture(shared,true);t.after(()=>again.reader.destroy());await again.initialise(again.extra);await again.settle();assert.equal(again.calls.requests.length,0);assert.equal(again.calls.fetches.length,1);
});

test('reader-side downloads keep the 32 MiB bound and reject insecure redirects without broad storage prompts',async t=>{
 for(const insecure of [false,true]){
  const h=remoteFixture({},true);t.after(()=>h.reader.destroy());let cancelled=0;
  h.env.fetch=async()=>({ok:true,url:insecure?'http://example.org/reading.pdf':'https://example.org/reading.pdf',headers:{get:()=>null},body:{getReader:()=>({read:async()=>({done:false,value:new Uint8Array(32*1024*1024+1)}),cancel:async()=>{cancelled++;},releaseLock(){}})}});
  await assert.rejects(h.initialise(h.extra),insecure?/secure/:/32 MiB/);assert.equal(h.calls.requests.length,0);assert.equal(cancelled,insecure?0:1);
 }
});

test('highlight, underline, strike and sticky notes keep their own colours when selected text is marked',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();
 const slot=h.reader.state.slots[0],top=slot.node.getBoundingClientRect().top,rect={left:20,right:110,top:top+30,bottom:top+45,width:90,height:15};
 h.env.getSelection=()=>({isCollapsed:false,rangeCount:1,toString:()=>'Selected words',removeAllRanges(){},getRangeAt:()=>({intersectsNode:node=>node===slot.textLayer,getClientRects:()=>[rect],getBoundingClientRect:()=>rect})});
 for(const [label,colour,type,value]of [['Highlight','pink','highlight','#F5B3C2'],['Underline','blue','underline','#2457C5'],['Strike through','green','strike','#2E7D46']]){
  await toolButton(h,label).fire('click');await optionButton(h,colour).fire('click');h.listeners.get('pointerup')({target:slot.textLayer});const mark=h.reader.state.annotations.annotations.at(-1);assert.equal(mark.type,type);assert.equal(mark.color,value);assert.equal(mark.text,'Selected words');
 }
 await toolButton(h,'Sticky note').fire('click');await optionButton(h,'blue').fire('click');await toolButton(h,'Highlight').fire('click');assert.equal(optionButton(h,'pink').attrs['aria-pressed'],'true');
 await toolButton(h,'Underline').fire('click');assert.equal(optionButton(h,'blue').attrs['aria-pressed'],'true');await toolButton(h,'Strike through').fire('click');assert.equal(optionButton(h,'green').attrs['aria-pressed'],'true');await toolButton(h,'Sticky note').fire('click');assert.equal(optionButton(h,'blue').attrs['aria-pressed'],'true');
});

test('eraser reaches broad marker middles and arrow heads and restores them with undo',async t=>{
 const h=fixture(),key=require('../extension/pdf-model.js').storageKey('https://school.instructure.com','7','42');t.after(()=>h.reader.destroy());h.storage[key]={version:1,annotations:[
  {id:'broad-marker',type:'pen',page:0,points:[[20,700],[200,700]],width:40,opacity:.42,color:'#F6DE7A'},
  {id:'arrow-head',type:'shape',page:0,shape:'arrow',points:[[220,600],[280,600]],width:6,color:'#C8372D'}]};
 await h.initialise();await h.settle();await toolButton(h,'Eraser').fire('click');const slot=h.reader.state.slots[0];h.doc.elementsFromPoint=()=>[slot.node];
 const erase=async(x,y)=>{const event={target:slot.node,button:0,pointerId:52,clientX:x,clientY:slot.node.getBoundingClientRect().top+y};await h.get('pages').fire('pointerdown',event);await h.get('pages').fire('pointerup',event);};
 const z=h.reader.state.zoom;await erase(100*z,118*z);assert.deepEqual(h.reader.state.annotations.annotations.map(a=>a.id),['arrow-head']);
 await erase(280*z-24*z*Math.cos(.45),200*z-24*z*Math.sin(.45));assert.equal(h.reader.state.annotations.annotations.length,0);readerKey(h,'z',{ctrlKey:true});readerKey(h,'z',{ctrlKey:true});assert.equal(h.reader.state.annotations.annotations.length,2);
});

test('closing before a saved-page animation frame cancels that navigation',async()=>{
 const key=require('../extension/pdf-model.js').storageKey('https://school.instructure.com','7','42'),h=fixture({storage:{[key+':place']:{page:5}}});await h.initialise();assert.ok(h.frames.size);await h.reader.close();for(const run of [...h.frames.values()])assert.doesNotThrow(run);assert.equal(h.frames.size,0);
});

test('study-sheet download rechecks the account and cannot release the previous account marks',async t=>{
 const M=require('../extension/pdf-model.js'),key=M.storageKey('https://school.instructure.com','7','42'),h=fixture();t.after(()=>h.reader.destroy());h.env.ReservePdfStudyNotes=require('../extension/pdf-study-notes.js');
 h.storage[key]={version:1,annotations:[{id:'private',type:'note',page:0,point:[20,700],text:'Private account seven note'}]};let downloads=0;h.env.URL={createObjectURL(){downloads++;return 'blob:blocked';},revokeObjectURL(){}};
 await h.initialise();await h.settle();const checks=h.sent.filter(x=>x.message.type==='reserve-pdf-account').length;h.env.accountId='8';await h.get('marks-download').fire('click');
 assert.equal(h.sent.filter(x=>x.message.type==='reserve-pdf-account').length,checks+1);assert.equal(downloads,0);assert.match(h.get('status').textContent,/account could not be confirmed/);assert.equal(h.storage[key].annotations[0].text,'Private account seven note');
});

async function typeTextBox(h,text){
 await toolButton(h,'Text box').fire('click');const slot=h.reader.state.slots[0];
 await h.get('pages').fire('pointerdown',{target:slot.node,button:0,clientX:40,clientY:slot.node.getBoundingClientRect().top+60});
 const area=slot.node.querySelector('.text-editor');area.value=text;return {slot,area};
}
test('a text box the annotation quota refuses stays open with its draft and close waits until it is saved or cleared',async t=>{
 const M=require('../extension/pdf-model.js'),key=M.storageKey('https://school.instructure.com','7','42'),h=fixture();t.after(()=>h.reader.destroy());
 h.storage[key]=M.createAnnotations(crowdedAnnotations()).serialise();await h.initialise();await h.settle();
 const draft='UNSAVED DRAFT: '+'y'.repeat(9985),{slot,area}=await typeTextBox(h,draft);await area.fire('blur');
 assert.match(h.get('status').textContent,/1 MiB/);assert.equal(slot.node.querySelector('.text-editor'),area,'the refused draft stays open');assert.equal(area.value,draft);
 assert.equal(h.reader.state.annotations.annotations.some(a=>a.type==='text'),false);
 assert.equal(await h.reader.close(),false,'closing does not treat the draft as saved');assert.equal(h.workers[0].terminated,undefined);assert.equal(slot.node.querySelector('.text-editor'),area);
 // a zoom keeps the open draft on its spot on the page
 const before={zoom:h.reader.state.zoom,left:parseFloat(area.style.left),top:parseFloat(area.style.top)};
 await h.get('toolbar').children.find(n=>n.attrs['aria-label']==='Zoom in (+)').fire('click');await h.settle();const k=h.reader.state.zoom/before.zoom;
 assert.ok(k>1);assert.equal(slot.node.querySelector('.text-editor'),area);assert.ok(Math.abs(parseFloat(area.style.left)-before.left*k)<.01&&Math.abs(parseFloat(area.style.top)-before.top*k)<.01);assert.equal(area.style.fontSize,12*h.reader.state.zoom+'px');
 area.value='';await area.fire('blur');assert.equal(slot.node.querySelector('.text-editor'),null,'clearing the box discards it deliberately');
 assert.equal(await h.reader.close(),true);
});

test('text size and colour chosen while typing apply to the open text box and keep it open',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();
 const {slot,area}=await typeTextBox(h,'Resize this text');
 // As in a browser, pressing a dock button moves focus to it (blurring the box) unless its mousedown is prevented.
 const press=async label=>{const button=optionButton(h,label);let kept=false;await button.fire('mousedown',{button:0,preventDefault(){kept=true;}});if(!kept)await area.fire('blur');await button.fire('click');};
 await press('Large text');await press('red');assert.equal(slot.node.querySelector('.text-editor'),area,'the box stays open for more typing');
 await area.fire('blur');let marks=h.reader.state.annotations.annotations.filter(a=>a.type==='text');
 assert.equal(marks.length,1);assert.equal(marks[0].text,'Resize this text');assert.equal(marks[0].size,18);assert.equal(marks[0].color,'#C8372D');
 // the same for a saved box reopened from the keyboard
 await slot.node.querySelector('.text-box').fire('keydown',{key:'Enter'});const again=slot.node.querySelector('.text-editor');
 const small=optionButton(h,'Small text');let kept=false;await small.fire('mousedown',{button:0,preventDefault(){kept=true;}});if(!kept)await again.fire('blur');await small.fire('click');await again.fire('blur');
 marks=h.reader.state.annotations.annotations.filter(a=>a.type==='text');assert.equal(marks.length,1);assert.equal(marks[0].size,9);
 // another tool's options leave focus to move as before: they never apply to the text box
 await toolButton(h,'Pen').fire('click');await slot.node.querySelector('.text-box').fire('keydown',{key:'Enter'});assert.ok(slot.node.querySelector('.text-editor'));
 kept=false;await optionButton(h,'blue').fire('mousedown',{button:0,preventDefault(){kept=true;}});assert.equal(kept,false);await slot.node.querySelector('.text-editor').fire('blur');
});

test('a marked copy that finishes after the reader is hidden or closed is never downloaded',async t=>{
 for(const ending of ['open','hidden','closed']){
  const h=fixture();t.after(()=>h.reader.destroy());const started=deferred(),finish=deferred();let downloads=0;
  h.env.Blob=Blob;h.env.URL={createObjectURL(){downloads++;return 'blob:marked';},revokeObjectURL(){}};
  h.env.ReservePdfExport={withMarks:async()=>{started.resolve();return finish.promise;}};
  await h.initialise();await h.settle();
  await h.get('heading-actions').children.find(n=>n.attrs['aria-label']==='Save a copy with my marks').fire('click');await started.promise;
  if(ending!=='open'){h.doc.hidden=true;h.listeners.get('visibilitychange')();h.env.accountId='8';}
  if(ending==='hidden'){h.doc.hidden=false;h.listeners.get('visibilitychange')();await h.settle();}
  if(ending==='closed')assert.equal(await h.reader.close(),true);
  finish.resolve({bytes:new Uint8Array([37,80,68,70]),name:'old.pdf'});await new Promise(resolve=>setImmediate(resolve));await h.settle();
  assert.equal(downloads,ending==='open'?1:0,ending);
 }
});

test('the reader tells the host only once a document has actually loaded',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();
 assert.equal(h.sent.filter(x=>x.message.type==='reserve-pdf-opened').length,1);
 const refused=fixture();t.after(()=>refused.reader.destroy());refused.env.accountId='8';
 await refused.initialise({local:true,accountId:'7',fileId:'cf-private-notes',url:'blob:https://school.instructure.com/local-pdf'});await refused.settle();
 assert.equal(refused.sent.filter(x=>x.message.type==='reserve-pdf-opened').length,0);
});
