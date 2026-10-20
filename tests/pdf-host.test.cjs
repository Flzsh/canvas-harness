'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Host=require('../extension/pdf-host.js');
const tick=()=>new Promise(setImmediate);
const canvas='https://school.instructure.com';
function anchor({href=canvas+'/courses/7/files/42/download',name='Reading.pdf',type='File',title='',preview=false}={}){
 const attrs={href,'data-api-returntype':type,title};
 const el={tagName:'A',href,textContent:name,dataset:{apiReturntype:type},className:preview?'file_preview_link':'instructure_file_link',
  isConnected:true,clicks:0,focused:0,getAttribute:key=>attrs[key]??null,
  closest(selector){return selector.includes('a[')?this:null;},click(){this.clicks++;},focus(){this.focused++;}};
 return el;
}
function click(el,overrides={}){
 return {target:el,button:0,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,defaultPrevented:false,
  prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...overrides};
}
function response(bytes='%PDF-1.7',extra={}){
 const data=new TextEncoder().encode(bytes),chunks=[data.subarray(0,2),data.subarray(2)],reader={
  read:async()=>chunks.length?{done:false,value:chunks.shift()}:{done:true},cancel:async()=>{},releaseLock:()=>{}};
 return {ok:true,status:200,type:'basic',url:canvas+'/files/42/download',headers:{get:key=>key==='content-length'?String(data.length):'application/pdf'},body:{getReader:()=>reader},...extra};
}
test('only primary plain PDF links and PDF preview toggles match; other input remains native',()=>{
 const pdf=anchor(),hit=Host.matchPdfClick(click(pdf),canvas);
 assert.equal(hit.fileId,'42');assert.equal(hit.name,'Reading.pdf');assert.equal(hit.url,canvas+'/files/42/download');
 for(const mods of [{button:1},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{defaultPrevented:true}]){
  assert.equal(Host.matchPdfClick(click(pdf,mods),canvas),null);
 }
 assert.equal(Host.matchPdfClick(click(anchor({name:'Homework.docx'})),canvas),null);
 assert.equal(Host.matchPdfClick(click(anchor({name:'Some document',title:'application/pdf'})),canvas)?.fileId,'42');
 assert.equal(Host.matchPdfClick(click(anchor({href:'https://evil.example/files/42',name:'X.pdf'})),canvas),null);
 const preview=anchor({name:'Preview',title:'Preview report.pdf',preview:true});
 assert.equal(Host.matchPdfClick(click(preview),canvas)?.fileId,'42');
 const sibling=anchor({name:'My reading.pdf'}),holder={querySelector:()=>sibling,getAttribute:()=>null};
 const toggle=anchor({href:'#',name:'Preview file',title:'Preview file',preview:true});
 toggle.closest=selector=>selector==='.instructure_file_link_holder'?holder:selector.includes('.file_preview_link')?toggle:toggle;
 assert.equal(Host.matchPdfClick(click(toggle),canvas)?.fileId,'42','Canvas preview controls inherit filename and ID from the file link holder');
});
test('credentialed same-origin streaming enforces PDF signature and 32 MiB budget',async()=>{
 const calls=[];
 const bytes=await Host.readVerifiedPdf({origin:canvas,fileId:'42',fetchImpl:async(url,options)=>{calls.push({url,options});return response();}});
 assert.equal(new TextDecoder().decode(bytes),'%PDF-1.7');
 assert.equal(calls[0].url,canvas+'/files/42/download');
 assert.equal(calls[0].options.credentials,'same-origin');
 assert.equal(calls[0].options.redirect,'follow');
 assert.equal(calls[0].options.referrerPolicy,'no-referrer');
 await assert.rejects(Host.readVerifiedPdf({origin:canvas,fileId:'42',fetchImpl:async()=>response('Not PDF')}),/PDF/);
 await assert.rejects(Host.readVerifiedPdf({origin:canvas,fileId:'42',maxBytes:5,fetchImpl:async()=>response()}),/32 MiB|size|limit/i);
 await assert.rejects(Host.readVerifiedPdf({origin:canvas,fileId:'42',fetchImpl:async()=>{throw new TypeError('Failed to fetch');}}),/inst-fs|CORS/i);
});
function fixture({allowed=true,vanilla=true,download=()=>response(),failFetch=null,width=650,origin=canvas}={}){
 const listeners=new Map(),els=[],timers=new Map(),timerDelays=new Map(),calls={storageReads:0,storageWrites:[],fetches:0,profileReads:0,messages:[],focus:[]};
 let timerId=0;
 // Only the element/descendant selectors used by the host UI are needed here.
 function matches(node,selector){
  const parts=selector.trim().split(/\s+/);
  const simple=(el,part)=>{
   const tag=part.match(/^[\w-]+/)?.[0];
   return (!tag||el.tagName===tag.toUpperCase())&&
    [...part.matchAll(/([.#])([\w-]+)/g)].every(([,kind,value])=>kind==='#'?el.id===value:el.classList.contains(value));
  };
  if(!simple(node,parts.pop()))return false;
  let parent=node.parentNode;
  while(parts.length){const part=parts.pop();while(parent&&!simple(parent,part))parent=parent.parentNode;if(!parent)return false;parent=parent.parentNode;}
  return true;
 }
 function element(tag){
  let ownText='';
  const e={tagName:tag.toUpperCase(),title:'',children:[],attrs:new Map(),style:{},dataset:{},isConnected:true,
   get id(){return this.getAttribute('id')||'';},set id(value){this.setAttribute('id',value);},
   get className(){return this.getAttribute('class')||'';},set className(value){this.setAttribute('class',value);},
   get attributes(){return [...this.attrs].map(([name,value])=>({name,value}));},
   get textContent(){return ownText+this.children.map(child=>child.textContent).join('');},
   set textContent(value){this.replaceChildren();ownText=String(value);},
   contentWindow:tag==='iframe'?{postMessage:(msg,origin,transfer)=>calls.messages.push({msg,origin,transfer})}:undefined,
   addEventListener(type,fn){(this.handlers??=new Map()).set(type,fn);},removeEventListener(type){this.handlers?.delete(type);},
   setAttribute(key,value){this.attrs.set(key,String(value));},getAttribute(key){return this.attrs.get(key)??null;},removeAttribute(key){this.attrs.delete(key);},
   append(...children){for(const child of children){if(child.parentNode)child.remove();child.parentNode=this;child.isConnected=this.isConnected;this.children.push(child);}},
   replaceChildren(...children){for(const child of [...this.children])child.remove();ownText='';this.append(...children);},
   querySelectorAll(selector){
    const found=[],selectors=selector.split(',');
    const walk=node=>{for(const child of node.children){if(selectors.some(part=>matches(child,part)))found.push(child);walk(child);}};
    walk(this);return found;
   },
   querySelector(selector){return this.querySelectorAll(selector)[0]||null;},
   cloneNode(deep=false){const copy=element(tag);for(const [name,value] of this.attrs)copy.setAttribute(name,value);copy.textContent=ownText;if(deep)copy.append(...this.children.map(child=>child.cloneNode(true)));return copy;},
   click(){this.handlers?.get('click')?.(click(this));},
   remove(){this.isConnected=false;if(this.parentNode){const i=this.parentNode.children.indexOf(this);if(i>=0)this.parentNode.children.splice(i,1);this.parentNode=null;}},
   focus(){calls.focus.push(this);},setPointerCapture(){this.captured=true;},releasePointerCapture(){this.captured=false;},
   set innerHTML(value){this.html=value;},get innerHTML(){return this.html||'';}};
  e.classList={
   contains:name=>e.className.split(/\s+/).includes(name),
   add(...names){e.className=[...new Set([...e.className.split(/\s+/).filter(Boolean),...names])].join(' ');},
   remove(...names){e.className=e.className.split(/\s+/).filter(name=>name&&!names.includes(name)).join(' ');},
   toggle(name,force){const on=force??!this.contains(name);if(on)this.add(name);else this.remove(name);return on;}
  };
  els.push(e);return e;
 }
 const body=element('body'),head=element('head'),wrapper=element('div');wrapper.id='wrapper';wrapper.setAttribute('style','width: 100%; color: navy');
 const document={body,head,activeElement:body,createElement:element,getElementById:id=>id==='wrapper'?wrapper:null,
  fullscreenElement:null,querySelector:selector=>body.querySelector(selector)||head.querySelector(selector),
  addEventListener(type,fn,capture){listeners.set(type,{fn,capture});},removeEventListener(type){listeners.delete(type);}};
 const root={document,location:{origin,href:origin+'/courses/7/assignments/9'},innerWidth:1200,
  ReserveSite:{supported:()=>allowed,vanillaPage:()=>vanilla},ReservePdfModel:require('../extension/pdf-model.js'),
  ReservePdfArt:{divider:'<svg>stitched</svg>',grip:'<svg>handle</svg>'},
  chrome:{runtime:{id:'abc123',getURL:file=>'chrome-extension://abc123/'+file},storage:{local:{
   get:async key=>{calls.storageReads++;return {[key]:key==='reserve:pdf-width'?width:{theme:'dark'}};},
   set:async data=>calls.storageWrites.push(data)}}},
  crypto:{randomUUID:()=> 'token-1234567890abc'},fetch:async(...args)=>{
   if(String(args[0]).includes('/api/v1/users/self/profile')){calls.profileReads++;return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'7'})};}
   calls.fetches++;if(failFetch)throw failFetch;return typeof download==='function'?download():download;
  },
  addEventListener(name,fn){listeners.set('window:'+name,{fn});},removeEventListener(name){listeners.delete('window:'+name);},
  setTimeout(fn,delay){const id=++timerId;timers.set(id,fn);timerDelays.set(id,delay);return id;},clearTimeout:id=>timers.delete(id)};
 const host=Host.create({root});
 const emit=(name,data={})=>listeners.get(name)?.fn(data);
 const message=(type,data={})=>emit('window:message',{origin:'chrome-extension://abc123',source:host.active()?.frame?.contentWindow,data:{type,token:'token-1234567890abc',...data}});
 const ready=()=>message('reserve-pdf-ready');
 return {root,host,calls,listeners,body,head,wrapper,timers,timerDelays,emit,message,ready};
}
test('boot is dormant except for one delegated capture click; unrelated routes do nothing',()=>{
 const f=fixture();assert.equal(f.listeners.get('click')?.capture,true);
 assert.equal(f.body.children.length,0);assert.equal(f.head.children.length,0);
 assert.equal(f.calls.storageReads,0);assert.equal(f.calls.fetches,0);
 for(const f2 of [fixture({allowed:false}),fixture({vanilla:false})])assert.equal(f2.listeners.size,0);
 f.host.destroy();assert.equal(f.listeners.size,0);
});
test('registered custom-site pages leave Canvas links alone without wildcard PDF reader exposure',()=>{
 const f=fixture({origin:'https://canvas.my-school.edu'}),e=click(anchor({href:'https://canvas.my-school.edu/courses/7/files/42/download'}));
 f.emit('click',e);assert.equal(e.prevented,false);assert.equal(f.calls.fetches,0);
 assert.equal(f.body.children.length,0);f.host.destroy();
});
test('trusted token handshake transfers the verified bytes, clamps resize and restores page on close',async()=>{
 const f=fixture(),origin=anchor(),event=click(origin);f.emit('click',event);await tick();await tick();
 assert.equal(event.prevented,true);assert.equal(event.stopped,true);
 assert.equal(f.host.active().frame.src.includes('parentOrigin='+encodeURIComponent(canvas)),true);
 assert.equal(f.wrapper.getAttribute('style'),'width: 100%; color: navy');
 assert.equal(f.calls.messages.length,0,'bytes wait for authenticated ready');
 f.emit('window:message',{origin:'https://evil.example',source:f.host.active().frame.contentWindow,data:{type:'reserve-pdf-ready',token:'token-1234567890abc'}});
 f.emit('window:message',{origin:'chrome-extension://abc123',source:{},data:{type:'reserve-pdf-ready',token:'token-1234567890abc'}});
 f.emit('window:message',{origin:'chrome-extension://abc123',source:f.host.active().frame.contentWindow,data:{type:'reserve-pdf-ready',token:'wrong-token'}});
 assert.equal(f.calls.messages.length,0);
 f.ready();assert.equal(f.calls.messages.length,1);
 assert.equal(f.timers.size,0,'completed transfers clear the deadline so later Ask AI requests are not aborted');
 assert.match(f.head.children.find(node=>node.tagName==='STYLE').textContent,/@media\(prefers-reduced-motion:reduce\).*transition:none!important/);
 const payload=f.calls.messages[0];assert.equal(payload.msg.type,'reserve-pdf-init');assert.equal(payload.msg.origin,canvas);
 assert.equal(payload.msg.appearance.theme,'dark');assert.equal(payload.msg.fileId,'42');assert.equal(payload.origin,'chrome-extension://abc123');
 assert.equal(new TextDecoder().decode(payload.transfer[0]),'%PDF-1.7');
 const grip=f.host.active().grip;
 grip.handlers.get('keydown')({key:'ArrowLeft',shiftKey:false,preventDefault(){}});await tick();
 assert.ok(f.calls.storageWrites.some(write=>write['reserve:pdf-width']>650));
 const widthBeforeDrag=f.host.active().width;
 grip.handlers.get('pointerdown')({button:0,pointerId:7,clientX:600,preventDefault(){}});
 assert.equal(grip.captured,true);
 grip.handlers.get('pointermove')({pointerId:7,clientX:520});
 assert.ok(f.host.active().width>widthBeforeDrag);
 grip.handlers.get('pointerup')({pointerId:7});assert.equal(grip.captured,false);
 await tick();assert.ok(f.calls.storageWrites.some(write=>write['reserve:pdf-width']>=f.host.active().width));
 f.emit('window:message',{origin:'chrome-extension://abc123',source:f.host.active().frame.contentWindow,data:{type:'reserve-pdf-close',token:'token-1234567890abc'}});
 assert.equal(f.host.active(),null);assert.equal(f.body.children.length,0);assert.equal(f.head.children.length,0);
 assert.equal(f.wrapper.getAttribute('style'),'width: 100%; color: navy');assert.equal(origin.focused,1);
 f.host.destroy();assert.equal(f.listeners.size,0);
});
test('a CORS redirect failure replays the original Canvas interaction and clears host state',async()=>{
 const f=fixture({failFetch:new TypeError('CORS')}),link=anchor(),e=click(link);f.emit('click',e);await tick();await tick();
 assert.equal(e.prevented,true);assert.equal(f.host.active(),null);assert.equal(link.clicks,1);
 assert.equal(f.body.children.some(node=>node.id==='reserve-pdf-host'),false);
 assert.equal(f.wrapper.getAttribute('style'),'width: 100%; color: navy');
 f.host.destroy();
});
test('PDF selection opens the existing AI panel source transport with explicit page text only',async()=>{
 const f=fixture(),source=anchor(),mounted=[];
 f.root.CanvasHarnessAISource={mount:options=>{mounted.push(options);return {destroy(){}};}};
 f.emit('click',click(source));await tick();await tick();f.ready();
 assert.equal(f.calls.profileReads,0);
 f.emit('window:message',{origin:'chrome-extension://abc123',source:f.host.active().frame.contentWindow,
  data:{type:'reserve-pdf-ai',token:'token-1234567890abc',text:' The selected sentence. ',page:2}});
 await tick();await tick();
 assert.equal(mounted.length,1);assert.equal(mounted[0].pdfHandoff.text,'The selected sentence.');
 assert.equal(mounted[0].pdfHandoff.page,2);assert.equal(mounted[0].pdfHandoff.fileId,'42');
 assert.equal(mounted[0].pdfHandoff.origin,canvas);
 assert.equal(mounted[0].pdfHandoff.accountId,'7');assert.equal(f.calls.profileReads,1);
 f.host.destroy();
});
test('chosen pages cross the verified PDF host handoff without unrelated message fields',async t=>{
 const f=fixture(),mounted=[];t.after(()=>f.host.destroy());
 f.root.CanvasHarnessAISource={mount:options=>{mounted.push(options);return {destroy(){}};}};
 await openReader(f);f.message('reserve-pdf-ai',{text:'[Page 3]\nSelected reading',page:2,endPage:4,autoSend:true,untrusted:'ignored'});await tick();await tick();
 assert.equal(mounted.length,1);assert.deepEqual(mounted[0].pdfHandoff,{
  origin:canvas,accountId:'7',fileId:'42',name:'Reading.pdf',text:'[Page 3]\nSelected reading',page:2,endPage:4,appearance:{theme:'dark'}
 });
 assert.equal(f.calls.profileReads,1);assert.equal(f.calls.fetches,1);
});

test('the PDF host reports missing AI source transport without fetching a profile',async t=>{
 const f=fixture();t.after(()=>f.host.destroy());
 await openReader(f);f.message('reserve-pdf-ai',{text:'Selected text',page:0});await tick();await tick();
 assert.equal(f.calls.profileReads,0);assert.equal(f.calls.messages[0].msg.aiEnabled,false);
 assert.match(f.host.active().status.textContent,/AI setup is unavailable/);
});

test('AI handoff uses source catalog and explicit collection with no other Canvas fetch',async()=>{
 const ai=require('../extension/ai-source.js');
 const source=ai.createPdfHandoff({origin:canvas,accountId:'7',fileId:'42',name:'Study.pdf',page:2,text:'Annotated selection',appearance:{theme:'dark'}});
 const catalog=await source.catalog();assert.equal(catalog.selectedIds.length,1);assert.equal(catalog.theme,'dark');
 assert.equal(catalog.scopeKey.split('|')[0],canvas);assert.equal(catalog.scopeKey.split('|')[1],'7');
 const extracted=await source.collect({ids:catalog.selectedIds});
 assert.match(extracted.text,/Annotated selection/);assert.match(extracted.text,/page 3/);
 assert.deepEqual(extracted.included.map(item=>item.id),catalog.selectedIds);
 await assert.rejects(source.collect({ids:['foreign']}),/selection/i);
 source.destroy();
 await assert.rejects(source.collect({ids:catalog.selectedIds}),/closed|unavailable/i);
});

async function openReader(f){
 f.emit('click',click(anchor()));await tick();await tick();f.ready();
 assert.ok(f.host.active(),'the PDF reader mounted through the delegated Canvas click');
 return f.host.active();
}
function deferred(){
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
}
function snapshot(node){
 return {tagName:node.tagName,attributes:[...node.attrs],textContent:node.textContent,children:node.children.map(snapshot)};
}

test('opening another PDF waits for the authenticated guarded-close result',async t=>{
 const f=fixture();t.after(()=>f.host.destroy());const state=await openReader(f),next=anchor({href:canvas+'/files/43/download',name:'Next.pdf'});
 f.emit('click',click(next));await tick();
 assert.equal(f.host.active(),state);assert.equal(f.calls.fetches,1);assert.equal(state.closed,false);
 const request=f.calls.messages.at(-1).msg;assert.equal(request.type,'reserve-pdf-request-close');assert.ok(Number.isSafeInteger(request.requestId));
 for(const override of [{origin:'https://evil.example'},{source:{}},{data:{type:'reserve-pdf-close-result',token:'wrong',requestId:request.requestId,ok:true}}]){
  f.emit('window:message',{origin:state.extensionOrigin,source:state.frame.contentWindow,data:{type:'reserve-pdf-close-result',token:state.token,requestId:request.requestId,ok:true},...override});await tick();assert.equal(f.host.active(),state);
 }
 f.message('reserve-pdf-close-result',{requestId:request.requestId+1,ok:true});await tick();assert.equal(f.host.active(),state);
 f.message('reserve-pdf-close-result',{requestId:request.requestId,ok:'true'});await tick();assert.equal(f.host.active(),state);
 f.message('reserve-pdf-close-result',{requestId:request.requestId,ok:true});await tick();await tick();
 assert.notEqual(f.host.active(),state);assert.equal(state.closed,true);assert.equal(f.host.active().info.fileId,'43');assert.equal(f.calls.fetches,2);
});

test('failed guarded close preserves the reader, its save error and AI draft, and can be retried',async t=>{
 const f=fixture(),destroyed=[];t.after(()=>f.host.destroy());const state=await openReader(f);
 state.status.textContent='Annotation storage is full';state.ai={draft:'Keep this draft',destroy(){destroyed.push(true);}};
 const before=snapshot(state.panel),next=anchor({href:canvas+'/files/43/download',name:'Next.pdf'});
 f.emit('click',click(next));const first=f.calls.messages.at(-1).msg,deadline=[...f.timers.keys()];
 f.message('reserve-pdf-close-result',{requestId:first.requestId,ok:false});await tick();
 assert.ok(deadline.every(id=>!f.timers.has(id)),'an explicit save failure cancels the close deadline');
 assert.equal(f.host.active(),state);assert.equal(state.closed,false);assert.equal(state.abort.signal.aborted,false);assert.equal(f.calls.fetches,1);
 assert.equal(state.status.textContent,'Annotation storage is full');assert.deepEqual(snapshot(state.panel),before);assert.equal(state.ai.draft,'Keep this draft');assert.deepEqual(destroyed,[]);
 f.emit('click',click(next));const retry=f.calls.messages.at(-1).msg;assert.notEqual(retry.requestId,first.requestId);
 f.message('reserve-pdf-close-result',{requestId:first.requestId,ok:true});await tick();assert.equal(f.host.active(),state);
 f.message('reserve-pdf-close-result',{requestId:retry.requestId,ok:true});await tick();assert.equal(f.host.active().info.fileId,'43');assert.deepEqual(destroyed,[true]);
});

test('rapid PDF clicks share one guarded close and only the latest PDF opens',async t=>{
 const f=fixture();t.after(()=>f.host.destroy());const state=await openReader(f);
 f.emit('click',click(anchor({href:canvas+'/files/43/download'})));f.emit('click',click(anchor({href:canvas+'/files/44/download'})));
 const requests=f.calls.messages.filter(call=>call.msg.type==='reserve-pdf-request-close');assert.equal(requests.length,1);assert.equal(f.host.active(),state);
 f.message('reserve-pdf-close-result',{requestId:requests[0].msg.requestId,ok:true});await tick();await tick();
 assert.equal(f.host.active().info.fileId,'44');assert.equal(f.calls.fetches,2);
});

test('replacement before reader readiness queues one guarded close for the latest PDF',async t=>{
 const f=fixture();t.after(()=>f.host.destroy());f.emit('click',click(anchor()));await tick();const state=f.host.active();
 f.emit('click',click(anchor({href:canvas+'/files/43/download'})));f.emit('click',click(anchor({href:canvas+'/files/44/download'})));
 assert.equal(f.calls.messages.length,0,'no close is posted to the unready frame');assert.equal(f.host.active(),state);
 f.ready();f.ready();const requests=f.calls.messages.filter(call=>call.msg.type==='reserve-pdf-request-close');
 assert.equal(requests.length,1);assert.equal(f.calls.messages[0].msg.type,'reserve-pdf-init');
 const waiting=state.closeRequest,deadline=[...f.timers.keys()];
 f.message('reserve-pdf-close-result',{requestId:requests[0].msg.requestId,ok:true});await tick();await tick();
 assert.equal(await waiting.promise,true);assert.equal(state.closed,true);assert.equal(f.host.active().info.fileId,'44');assert.equal(f.calls.fetches,2);
 assert.ok(deadline.every(id=>!f.timers.has(id)),'settling a close removes its timer');
});

for(const readiness of ['never ready','already ready','ready while waiting'])test('replacement settles after a short unanswered close timeout: '+readiness,async t=>{
 const f=fixture();t.after(()=>f.host.destroy());f.emit('click',click(anchor()));await tick();if(readiness==='already ready')f.ready();
 const state=f.host.active();f.emit('click',click(anchor({href:canvas+'/files/43/download'})));const waiting=state.closeRequest;
 if(readiness==='ready while waiting')f.ready();
 const deadline=[...f.timers].find(([id])=>f.timerDelays.get(id)>0&&f.timerDelays.get(id)<=3000);
 assert.ok(deadline,'a short close deadline survives the init transfer');
 deadline[1]();await tick();await tick();assert.equal(await waiting.promise,true);assert.equal(state.closed,true);
 assert.equal(f.host.active().info.fileId,'43');assert.equal(f.calls.fetches,2);assert.equal(state.trigger.clicks,0,'timeout does not replay Canvas');
 const current=f.host.active();f.emit('window:message',{origin:state.extensionOrigin,source:state.frame.contentWindow,data:{type:'reserve-pdf-close-result',token:state.token,requestId:waiting.requestId,ok:true}});
 await tick();assert.equal(f.host.active(),current,'late replies cannot close the replacement');
});

for(const failure of ['removed frame','missing window','post failure'])test('replacement treats an unreachable reader as closed: '+failure,async t=>{
 const f=fixture();t.after(()=>f.host.destroy());const state=await openReader(f);
 if(failure==='removed frame')state.frame.remove();
 else if(failure==='missing window')state.frame.contentWindow=null;
 else state.frame.contentWindow.postMessage=()=>{throw Error('Frame is gone');};
 f.emit('click',click(anchor({href:canvas+'/files/43/download'})));await tick();await tick();
 assert.equal(state.closed,true);assert.equal(f.host.active().info.fileId,'43');assert.equal(f.calls.fetches,2);
});

test('host teardown cancels pending replacement without mounting another PDF',async()=>{
 const f=fixture(),state=await openReader(f);f.emit('click',click(anchor({href:canvas+'/files/43/download'})));
 const waiting=state.closeRequest;f.host.destroy();await tick();assert.equal(await waiting.promise,false);assert.equal(f.timers.size,0);assert.equal(f.host.active(),null);assert.equal(state.closed,true);assert.equal(f.calls.fetches,1);assert.equal(f.body.children.length,0);
});

test('reader account requests verify the current Canvas profile without cache and authenticate replies',async t=>{
 const f=fixture(),reads=[];t.after(()=>f.host.destroy());const state=await openReader(f);
 f.root.fetch=async(url,options)=>{reads.push({url,options});return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'71'})};};
 f.emit('window:message',{origin:'https://evil.example',source:state.frame.contentWindow,data:{type:'reserve-pdf-account',token:state.token,requestId:1}});
 f.emit('window:message',{origin:state.extensionOrigin,source:{},data:{type:'reserve-pdf-account',token:state.token,requestId:1}});
 for(const requestId of [undefined,'1',-1,1.5])f.message('reserve-pdf-account',{requestId});await tick();assert.equal(reads.length,0);
 f.message('reserve-pdf-account',{requestId:2});await tick();await tick();
 assert.equal(reads.length,1);assert.equal(reads[0].url,canvas+'/api/v1/users/self/profile');
 assert.equal(reads[0].options.cache,'no-store');assert.equal(reads[0].options.credentials,'same-origin');assert.equal(reads[0].options.redirect,'error');assert.equal(reads[0].options.signal,state.abort.signal);
 assert.deepEqual(f.calls.messages.at(-1),{msg:{type:'reserve-pdf-account-result',token:state.token,requestId:2,accountId:'71'},origin:state.extensionOrigin,transfer:undefined});
});

test('failed reader account checks reply with an error and late checks cannot reply after close',async t=>{
 const f=fixture();t.after(()=>f.host.destroy());const state=await openReader(f);
 f.root.fetch=async()=>({ok:false});f.message('reserve-pdf-account',{requestId:1});await tick();
 const reply=f.calls.messages.at(-1).msg;assert.equal(reply.type,'reserve-pdf-account-result');assert.equal(reply.requestId,1);assert.match(reply.error,/sign-in/);assert.equal(reply.accountId,undefined);assert.equal(f.host.active(),state);
 const pending=deferred();f.root.fetch=()=>pending.promise;f.message('reserve-pdf-account',{requestId:2});
 const before=f.calls.messages.length;f.host.destroy();pending.resolve({ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'7'})});await tick();await tick();assert.equal(f.calls.messages.length,before);
});

for(const staleFailure of [false,true])test('a stale '+(staleFailure?'failed':'successful')+' Ask AI account check preserves the latest context and draft',async t=>{
 const f=fixture(),mounted=[],destroyed=[],pending=[];t.after(()=>f.host.destroy());
 f.root.CanvasHarnessAISource={mount:options=>{const panel={options,draft:'Latest unsent draft',destroy(){destroyed.push(panel);}};mounted.push(panel);return panel;}};
 const state=await openReader(f);f.root.fetch=()=>{const task=deferred();pending.push(task);return task.promise;};
 f.message('reserve-pdf-ai',{text:'Old selection',page:0});f.message('reserve-pdf-ai',{text:'Latest selection',page:1});
 const profile={ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'7'})};
 pending[1].resolve(profile);await tick();await tick();assert.equal(mounted.length,1);assert.equal(mounted[0].options.pdfHandoff.text,'Latest selection');
 const shell=state.aiShell,status=state.status.textContent,hidden=state.status.hidden;
 if(staleFailure)pending[0].reject(Error('Old request failed'));else pending[0].resolve(profile);await tick();await tick();
 assert.equal(mounted.length,1);assert.deepEqual(destroyed,[]);assert.equal(state.ai,mounted[0]);assert.equal(state.aiShell,shell);assert.equal(state.ai.draft,'Latest unsent draft');assert.equal(state.status.textContent,status);assert.equal(state.status.hidden,hidden);
});

test('closing the AI sidebar invalidates an account check still waiting to replace it',async t=>{
 const f=fixture(),mounted=[];t.after(()=>f.host.destroy());f.root.CanvasHarnessAISource={mount:options=>{mounted.push(options);return {destroy(){}};}};
 const state=await openReader(f);f.message('reserve-pdf-ai',{text:'First selection',page:0});await tick();await tick();assert.equal(mounted.length,1);
 const pending=deferred();f.root.fetch=()=>pending.promise;f.message('reserve-pdf-ai',{text:'Pending selection',page:1});mounted[0].onClose();
 pending.resolve({ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'7'})});await tick();await tick();
 assert.equal(mounted.length,1);assert.equal(state.ai,null);assert.equal(state.aiShell,null);assert.equal(state.panel.classList.contains('has-ai'),false);assert.equal(state.status.hidden,true);
});

test('fullscreen Assignment card sanitizes active content and attributes while preserving the original Canvas tree',async t=>{
 const f=fixture();t.after(()=>f.host.destroy());
 const make=(tag,attrs={},text='')=>{
  const node=f.root.document.createElement(tag);
  for(const [name,value] of Object.entries(attrs))node.setAttribute(name,value);
  node.textContent=text;return node;
 };
 const source=make('section',{id:'assignment_show',style:'color: red',onclick:'attack()'});
 const heading=make('h1',{class:'title',id:'assignment-title'},'Read the chapter');
 const paragraph=make('p',{style:'display: block',onclick:'attack()'},'Keep these assignment instructions.');
 const safeLink=make('a',{href:'https://x/',id:'safe-link',style:'color: green',onclick:'attack()',target:'_self',rel:'opener'},'Safe reference');
 const unsafeLink=make('a',{href:'javascript:attack()',onclick:'attack()'},'Unsafe reference text');
 const image=make('img',{src:'https://x/a.png',alt:'Assignment diagram',onerror:'attack()',id:'diagram',style:'width: 99px',srcset:'javascript:attack() 2x'});
 const unsafeImage=make('img',{src:'javascript:attack()',alt:'Unsafe image',onerror:'attack()'});
 const form=make('form',{action:'https://evil.example/submit'},'Do not copy this form');
 form.append(make('input',{name:'secret',value:'original input',onchange:'attack()'}));
 source.append(heading,paragraph,safeLink,unsafeLink,image,unsafeImage,
  make('script',{},'script attack payload'),make('iframe',{src:'https://evil.example/frame'}),
  make('object',{data:'https://evil.example/object'}),make('embed',{src:'https://evil.example/embed'}),form);
 f.body.append(source);
 const before=snapshot(source),originalNodes=[source,...source.querySelectorAll('*')];
 const state=await openReader(f);
 f.message('reserve-pdf-fullscreen');
 const tab=state.panel.querySelector('.reserve-pdf-assignment-tab'),card=state.panel.querySelector('.reserve-pdf-assignment-card');
 assert.equal(tab.hidden,false);assert.equal(state.panel.classList.contains('is-full'),true);
 tab.click();assert.equal(card.hidden,false);assert.equal(tab.getAttribute('aria-expanded'),'true');
 const copy=card.querySelector('.reserve-pdf-assignment-body').children[0];
 assert.notEqual(copy,source);assert.equal(copy.tagName,'SECTION');
 assert.doesNotMatch(copy.textContent,/Read the chapter/,'the title shows once, in the card heading');assert.match(copy.textContent,/Keep these assignment instructions\./);
 const links=copy.querySelectorAll('a');
 assert.equal(links.length,2,'sanitizing an unsafe link retains its readable label');
 assert.equal(links[0].getAttribute('href'),'https://x/');assert.equal(links[0].textContent,'Safe reference');
 assert.equal(links[1].textContent,'Unsafe reference text');assert.equal(links[1].getAttribute('href'),null);
 for(const link of links){assert.equal(link.getAttribute('target'),'_blank');assert.equal(link.getAttribute('rel'),'noopener noreferrer');}
 const images=copy.querySelectorAll('img');assert.equal(images.length,2);
 assert.equal(images[0].getAttribute('src'),'https://x/a.png');assert.equal(images[0].getAttribute('alt'),'Assignment diagram');
 assert.equal(images[1].getAttribute('src'),null);
 assert.equal(copy.querySelectorAll('script,iframe,object,embed,form,input').length,0);
 assert.doesNotMatch(copy.textContent,/script attack payload|Do not copy this form/);
 for(const node of [copy,...copy.querySelectorAll('*')]){
  for(const {name} of node.attributes){
   assert.equal(/^on/i.test(name),false,'copied '+node.tagName+' has no inline '+name+' handler');
   assert.equal(['id','style','srcset','action','formaction','xlink:href'].includes(name.toLowerCase()),false,'copied '+node.tagName+' has no '+name+' attribute');
  }
 }
 assert.deepEqual(snapshot(source),before,'opening the card leaves all Canvas text, nested nodes and attributes unchanged');
 assert.equal(source.parentNode,f.body);assert.equal(f.root.document.querySelector('#assignment_show'),source);
 const afterNodes=[source,...source.querySelectorAll('*')];
 assert.equal(afterNodes.length,originalNodes.length);
 originalNodes.forEach((node,index)=>assert.equal(afterNodes[index],node,'Canvas keeps original node '+index));
});

test('Fill the window: the reader takes the whole browser window, the Assignment tab appears, and the button or Escape brings the split back',async t=>{
 const f=fixture();t.after(()=>f.host.destroy());const state=await openReader(f);
 const tab=state.panel.querySelector('.reserve-pdf-assignment-tab'),card=state.panel.querySelector('.reserve-pdf-assignment-card');
 assert.equal(tab.hidden,true);
 f.message('reserve-pdf-fullscreen');
 assert.equal(state.panel.classList.contains('is-maximized'),true);assert.equal(state.panel.classList.contains('is-full'),true);
 assert.equal(tab.hidden,false);assert.equal(f.calls.messages.at(-1).msg.on,true);
 tab.click();assert.equal(card.hidden,false);
 f.message('reserve-pdf-fullscreen');
 assert.equal(state.panel.classList.contains('is-maximized'),false);assert.equal(tab.hidden,true);assert.equal(card.hidden,true);assert.equal(f.calls.messages.at(-1).msg.on,false);
 f.message('reserve-pdf-fullscreen');f.emit('keydown',{key:'Escape'});
 assert.equal(state.panel.classList.contains('is-maximized'),false,'Escape returns to the split');assert.equal(f.calls.messages.at(-1).msg.on,false);
});

test('replacing an open AI sidebar then closing restores the original student width without persisting temporary widening',async t=>{
 const f=fixture({width:500}),mounted=[],destroyed=[];t.after(()=>f.host.destroy());
 f.root.CanvasHarnessAISource={mount:options=>{const index=mounted.push(options)-1;return {destroy(){destroyed.push(index);}};}};
 const state=await openReader(f),originalWidth=state.width;
 assert.equal(originalWidth,500);assert.deepEqual(f.calls.storageWrites,[]);
 f.message('reserve-pdf-ai',{text:'First selection',page:0});await tick();await tick();
 assert.equal(mounted.length,1);const firstShell=state.aiShell,wide=state.width;
 assert.ok(wide>originalWidth,'the fixture must actually widen the reader for AI');
 assert.ok(firstShell);assert.equal(state.panel.classList.contains('has-ai'),true);assert.deepEqual(f.calls.storageWrites,[]);
 f.message('reserve-pdf-ai',{text:'Second selection',page:1});await tick();await tick();
 assert.equal(mounted.length,2);assert.equal(mounted[1].pdfHandoff.text,'Second selection');
 assert.notEqual(state.aiShell,firstShell);assert.equal(firstShell.isConnected,false);assert.deepEqual(destroyed,[0]);
 assert.ok(state.width>originalWidth);assert.deepEqual(f.calls.storageWrites,[],'replacing AI does not save the widened split');
 mounted[1].onClose();await tick();
 assert.equal(state.width,originalWidth,'closing the replacement returns to the width before the first AI sidebar');
 assert.equal(state.aiShell,null);assert.equal(state.ai,null);assert.equal(state.panel.classList.contains('has-ai'),false);
 assert.deepEqual(destroyed,[0,1]);assert.deepEqual(f.calls.storageWrites,[],'temporary widening and restoration never overwrite the student preference');
});

test('repeated Assignment card openings through fullscreen messages and UI toggles do not grow state.dispose',async t=>{
 const f=fixture();t.after(()=>f.host.destroy());
 const source=f.root.document.createElement('section');source.id='assignment_show';source.textContent='Original assignment instructions';f.body.append(source);
 const state=await openReader(f),initialDisposers=state.dispose.length;
 assert.ok(initialDisposers>0);
 const tab=state.panel.querySelector('.reserve-pdf-assignment-tab'),card=state.panel.querySelector('.reserve-pdf-assignment-card');
 for(let turn=0;turn<40;turn++){
  f.message('reserve-pdf-fullscreen');assert.equal(tab.hidden,false);
  tab.click();assert.equal(card.hidden,false);assert.match(card.textContent,/Original assignment instructions/);
  card.querySelector('button').click();assert.equal(card.hidden,true);assert.equal(tab.getAttribute('aria-expanded'),'false');
  tab.click();assert.equal(card.hidden,false);tab.click();assert.equal(card.hidden,true);
  tab.click();assert.equal(card.hidden,false);
  f.message('reserve-pdf-fullscreen');assert.equal(card.hidden,true);assert.equal(tab.hidden,true);
  assert.equal(tab.getAttribute('aria-expanded'),'false');
  assert.equal(state.dispose.length,initialDisposers,'Assignment opening '+(turn*3+3)+' must not retain another disposer');
 }
 assert.equal(source.textContent,'Original assignment instructions');
});
