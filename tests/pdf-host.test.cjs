// PDF mark-up tools adapted from HarryX081125's work, issue #53.
// Adapted from Gary Wu's pull request #47 to Canvas Harness.
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
function fixture({allowed=true,vanilla=true,href,download=()=>response(),failFetch=null,width=650,origin=canvas,metadata=null,viewer='reader',readyState='complete'}={}){
 const listeners=new Map(),els=[],timers=new Map(),timerDelays=new Map(),intervals=new Map(),sessionValues=new Map(viewer==='canvas'?[['reserve:pdf-viewer','canvas']]:[]),calls={storageReads:0,storageWrites:[],fetches:0,profileReads:0,metadataReads:[],messages:[],focus:[],destinations:[]};
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
 const document={body,head,activeElement:body,readyState,createElement:element,getElementById:id=>id==='wrapper'?wrapper:null,
  fullscreenElement:null,querySelector:selector=>body.querySelector(selector)||head.querySelector(selector),
  addEventListener(type,fn,capture){listeners.set(type,{fn,capture});},removeEventListener(type){listeners.delete(type);}};
 const root={document,location:{origin,href:href||(vanilla?origin+'/courses/7/assignments/9':origin+'/profile'),assign:url=>calls.destinations.push(url)},innerWidth:1200,
  sessionStorage:{getItem:key=>sessionValues.get(key)??null,setItem:(key,value)=>sessionValues.set(key,value),removeItem:key=>sessionValues.delete(key)},
  ReserveSite:{supported:()=>allowed,vanillaPage:()=>vanilla},ReservePdfModel:require('../extension/pdf-model.js'),
  ReservePdfArt:{divider:'<svg>stitched</svg>',grip:'<svg>handle</svg>'},
  chrome:{runtime:{id:'abc123',getURL:file=>'chrome-extension://abc123/'+file},storage:{local:{
   get:async key=>{calls.storageReads++;return {[key]:key==='reserve:pdf-width'?width:{theme:'dark'}};},
   set:async data=>calls.storageWrites.push(data)}}},
  crypto:{randomUUID:()=> 'token-1234567890abc',subtle:require('node:crypto').webcrypto.subtle},fetch:async(...args)=>{
   if(String(args[0]).includes('/api/v1/users/self/profile')){calls.profileReads++;return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'7'})};}
   if(/\/api\/v1\/files\/\d+$/.test(String(args[0]))){calls.metadataReads.push({url:args[0],options:args[1]});return typeof metadata==='function'?metadata(...args):{ok:true,headers:{get:()=> 'application/json'},json:async()=>metadata||{}};}
   calls.fetches++;if(failFetch)throw failFetch;return typeof download==='function'?download():download;
  },
  addEventListener(name,fn){listeners.set('window:'+name,{fn});},removeEventListener(name){listeners.delete('window:'+name);},
  setTimeout(fn,delay){const id=++timerId;timers.set(id,fn);timerDelays.set(id,delay);return id;},clearTimeout:id=>timers.delete(id),
  setInterval(fn,delay){const id=++timerId;intervals.set(id,{fn,delay});return id;},clearInterval:id=>intervals.delete(id)};
 const host=Host.create({root});
 const emit=(name,data={})=>listeners.get(name)?.fn(data);
 const message=(type,data={})=>emit('window:message',{origin:'chrome-extension://abc123',source:host.active()?.frame?.contentWindow,data:{type,token:'token-1234567890abc',...data}});
 const ready=()=>message('reserve-pdf-ready');
 return {root,host,calls,listeners,body,head,wrapper,timers,timerDelays,intervals,sessionValues,emit,message,ready};
}
test('local course PDFs use the workspace reader on a custom Canvas site with AI off and release their Blob URL',async()=>{
 const origin='https://canvas.my-school.edu',f=fixture({origin}),made=[],revoked=[];
  let aiMounts=0;f.root.CanvasHarnessAISource={mount(){aiMounts++;}};
 f.root.URL={createObjectURL:blob=>{made.push(blob);return 'blob:'+origin+'/saved-pdf';},revokeObjectURL:url=>revoked.push(url)};
 const blob=new Blob(['%PDF-1.7 local bytes'],{type:'application/pdf'});
 assert.equal(await f.host.openLocal({blob,id:'cf-local-notes',name:'My notes.pdf',owner:{origin,accountId:'7'}}),true);
 await tick();f.ready();await tick();
 const payload=f.calls.messages.find(x=>x.msg.type==='reserve-pdf-init').msg;
 assert.equal(payload.local,true);assert.equal(payload.fileId,'cf-local-notes');assert.equal(payload.accountId,'7');
 assert.equal(payload.name,'My notes.pdf');assert.equal(payload.url,'blob:'+origin+'/saved-pdf');assert.equal(payload.aiEnabled,false);
 assert.equal(new TextDecoder().decode(payload.bytes),'%PDF-1.7 local bytes');assert.equal(f.calls.fetches,0);
 assert.ok(f.calls.profileReads>0);assert.equal(made[0],blob);assert.deepEqual(revoked,[]);
  const profiles=f.calls.profileReads;f.message('reserve-pdf-ai',{text:'private saved text',page:0});await tick();
  assert.equal(aiMounts,0);assert.equal(f.calls.profileReads,profiles,'local text never enters the AI account/context path');
 f.host.destroy();assert.deepEqual(revoked,['blob:'+origin+'/saved-pdf']);
});
test('local PDF opening rejects a different owner or invalid bytes before displaying anything',async()=>{
 const f=fixture(),blob=new Blob(['%PDF-1.7']);
 await assert.rejects(f.host.openLocal({blob,id:'cf-local-notes',owner:{origin:'https://another.instructure.com',accountId:'7'}}),/site|account|origin/i);
 await assert.rejects(f.host.openLocal({blob:new Blob(['not a PDF']),id:'cf-local-notes',owner:{origin:canvas,accountId:'7'}}),/PDF/);
 f.root.fetch=async()=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'8'})});
 await assert.rejects(f.host.openLocal({blob,id:'cf-local-notes',owner:{origin:canvas,accountId:'7'}}),/account.*changed/i);
 assert.equal(f.host.active(),null);assert.equal(f.body.children.length,0);f.host.destroy();
});
test('local PDF identities, secure owners and byte limits are checked before account or download requests',async t=>{
 const f=fixture(),blob=new Blob(['%PDF-1.7']),owner={origin:canvas,accountId:'7'};t.after(()=>f.host.destroy());
 for(const id of ['42','cf-a','cf-../../private'])await assert.rejects(f.host.openLocal({blob,id,owner}),/link|invalid/i);
 for(const origin of ['http://school.instructure.com',canvas+'/courses/7','https://user@school.instructure.com'])await assert.rejects(f.host.openLocal({blob,id:'cf-private-notes',owner:{origin,accountId:'7'}}),/origin|site|account/i);
 await assert.rejects(f.host.openLocal({blob:{size:8,arrayBuffer:async()=>new ArrayBuffer(8)},id:'cf-private-notes',owner}),/PDF/);
 class LargeBlob extends Blob{get size(){return Host.MAX_BYTES+1;}}
 await assert.rejects(f.host.openLocal({blob:new LargeBlob(['%PDF-1.7']),id:'cf-private-notes',owner}),/limit/);
 assert.equal(f.calls.profileReads,0);assert.equal(f.calls.fetches,0);assert.equal(f.host.active(),null);
});
test('local reader failure revokes its Blob URL without replaying a Canvas click',async t=>{
 const f=fixture(),revoked=[],element=anchor();t.after(()=>f.host.destroy());
 f.root.URL={createObjectURL:()=> 'blob:'+canvas+'/failed-local',revokeObjectURL:url=>revoked.push(url)};
 await f.host.openLocal({blob:new Blob(['%PDF-1.7']),id:'cf-private-notes',owner:{origin:canvas,accountId:'7'},element});await tick();f.ready();
 f.message('reserve-pdf-error',{message:'The saved PDF is damaged.'});
 assert.equal(f.host.active(),null);assert.equal(element.clicks,0);assert.equal(f.calls.fetches,0);assert.deepEqual(revoked,['blob:'+canvas+'/failed-local']);
 assert.match(f.body.textContent,/damaged/);
});
test('a slower saved Blob cannot replace a newer verified local PDF',async t=>{
 const f=fixture(),owner={origin:canvas,accountId:'7'};let finish;t.after(()=>f.host.destroy());
 f.root.URL={createObjectURL:()=> 'blob:'+canvas+'/newest',revokeObjectURL:()=>{}};
 class SlowBlob extends Blob{arrayBuffer(){return new Promise(resolve=>{finish=resolve;});}}
 const older=f.host.openLocal({blob:new SlowBlob(['%PDF-1.7']),id:'cf-older-notes',owner});await tick();
 assert.equal(await f.host.openLocal({blob:new Blob(['%PDF-1.7']),id:'cf-newer-notes',owner}),true);
 finish(new TextEncoder().encode('%PDF-1.7').buffer);assert.equal(await older,false);assert.equal(f.host.active().info.fileId,'cf-newer-notes');
});
test('local PDF handoff waits for saved annotations and keeps its Blob URL when closing is refused',async()=>{
 const f=fixture(),revoked=[];let sequence=0;
 f.root.URL={createObjectURL:()=> 'blob:'+canvas+'/'+(++sequence),revokeObjectURL:url=>revoked.push(url)};
 const open=id=>f.host.openLocal({blob:new Blob(['%PDF-1.7']),id,name:id+'.pdf',owner:{origin:canvas,accountId:'7'}});
 await open('cf-first-notes');await tick();f.ready();const first=f.host.active();
 const refused=open('cf-next-notes');await tick();
 f.message('reserve-pdf-close-result',{requestId:first.closeRequest.requestId,ok:false});
 assert.equal(await refused,false);assert.equal(f.host.active(),first);assert.deepEqual(revoked,[]);
 const accepted=open('cf-next-notes');await tick();
 f.message('reserve-pdf-close-result',{requestId:first.closeRequest.requestId,ok:true});
 assert.equal(await accepted,true);assert.notEqual(f.host.active(),first);assert.deepEqual(revoked,['blob:'+canvas+'/1']);
 f.host.destroy();assert.deepEqual(revoked,['blob:'+canvas+'/1','blob:'+canvas+'/2']);
});
test('an account change closes an already-open local PDF rather than exposing it under the new account',async()=>{
 const f=fixture(),revoked=[];
 f.root.URL={createObjectURL:()=> 'blob:'+canvas+'/private',revokeObjectURL:url=>revoked.push(url)};
 await f.host.openLocal({blob:new Blob(['%PDF-1.7']),id:'cf-private-notes',owner:{origin:canvas,accountId:'7'}});await tick();f.ready();
 f.root.fetch=async()=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'8'})});
 f.message('reserve-pdf-account',{requestId:3});await tick();
 assert.equal(f.host.active(),null);assert.deepEqual(revoked,['blob:'+canvas+'/private']);
 assert.equal(f.calls.messages.some(x=>x.msg.type==='reserve-pdf-account-result'&&x.msg.accountId==='8'),false);f.host.destroy();
});
test('dashboard cleanup closes only its own local PDF and waits for the reader save guard',async()=>{
 const f=fixture(),owner={origin:canvas,accountId:'7'};
 f.root.URL={createObjectURL:()=> 'blob:'+canvas+'/private',revokeObjectURL:()=>{}};
 await f.host.openLocal({blob:new Blob(['%PDF-1.7']),id:'cf-private-notes',owner});await tick();f.ready();const state=f.host.active();
 assert.equal(await f.host.closeLocal({...owner,accountId:'8'}),false);assert.equal(f.host.active(),state);
 const closing=f.host.closeLocal(owner);assert.equal(f.host.active(),state);assert.equal(state.panel.hidden,true);assert.equal(state.scope.textContent,'');
 f.message('reserve-pdf-close-result',{requestId:state.closeRequest.requestId,ok:true});
 assert.equal(await closing,true);assert.equal(f.host.active(),null);f.host.destroy();
});
test('cleanup keeps unsaved local marks hidden until their verified owner reopens the reader',async()=>{
 const f=fixture(),owner={origin:canvas,accountId:'7'};
 f.root.URL={createObjectURL:()=> 'blob:'+canvas+'/private',revokeObjectURL:()=>{}};
 const open=()=>f.host.openLocal({blob:new Blob(['%PDF-1.7']),id:'cf-private-notes',owner});
 await open();await tick();f.ready();const state=f.host.active(),closing=f.host.closeLocal(owner);
 f.message('reserve-pdf-close-result',{requestId:state.closeRequest.requestId,ok:false});assert.equal(await closing,false);assert.equal(state.panel.hidden,true);
 const reopening=open();await tick();f.message('reserve-pdf-close-result',{requestId:state.closeRequest.requestId,ok:false});
 assert.equal(await reopening,false);assert.equal(state.panel.hidden,false);assert.notEqual(state.scope.textContent,'');f.host.destroy();
});
test('dashboard cleanup cancels a local PDF that is still reading its Blob',async()=>{
 const f=fixture(),owner={origin:canvas,accountId:'7'};let finish;
 const bytes=new TextEncoder().encode('%PDF-1.7').buffer;
 class SlowBlob extends Blob{arrayBuffer(){return new Promise(resolve=>{finish=resolve;});}}
 const opening=f.host.openLocal({blob:new SlowBlob(['%PDF-1.7']),id:'cf-private-notes',owner});await tick();
 await f.host.closeLocal(owner);finish(bytes);assert.equal(await opening,false);assert.equal(f.host.active(),null);f.host.destroy();
});
test('dashboard teardown cancels a local PDF queued behind the previous reader save guard',async()=>{
 const f=fixture(),owner={origin:canvas,accountId:'7'},created=[];
 f.root.URL={createObjectURL:blob=>{created.push(blob);return 'blob:'+canvas+'/queued';},revokeObjectURL:()=>{}};
 await tick();f.emit('click',click(anchor()));await tick();await tick();f.ready();const previous=f.host.active();
 const opening=f.host.openLocal({blob:new Blob(['%PDF-1.7']),id:'cf-queued-notes',owner});await tick();
 assert.ok(previous.closeRequest,'the local open reached the existing reader save guard');
 await f.host.closeLocal(owner);
 f.message('reserve-pdf-close-result',{requestId:previous.closeRequest.requestId,ok:true});
 assert.equal(await opening,false);assert.equal(f.host.active(),null);assert.deepEqual(created,[]);f.host.destroy();
});
for(const queuedFirst of [false,true])test('a retired local PDF cannot block another verified owner (queued first='+queuedFirst+')',async()=>{
 const f=fixture(),owner={origin:canvas,accountId:'7'},other={origin:canvas,accountId:'8'},revoked=[];let urls=0;
 f.root.URL={createObjectURL:()=> 'blob:'+canvas+'/'+(++urls),revokeObjectURL:url=>revoked.push(url)};
 const open=who=>f.host.openLocal({blob:new Blob(['%PDF-1.7']),id:'cf-private-notes',owner:who});
 await open(owner);await tick();f.ready();const previous=f.host.active();
 f.root.fetch=async()=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'8'})});
 let opening;if(queuedFirst){opening=open(other);await tick();assert.ok(previous.closeRequest);}
 const closing=f.host.closeLocal(owner);assert.equal(previous.panel.hidden,true);
 f.message('reserve-pdf-close-result',{requestId:previous.closeRequest.requestId,ok:false});assert.equal(await closing,false);
 if(!queuedFirst)opening=open(other);
 assert.equal(await opening,true);assert.equal(f.host.active().info.owner.accountId,'8');assert.equal(previous.closed,true);
 assert.deepEqual(revoked,['blob:'+canvas+'/1']);f.host.destroy();
});
test('boot is dormant except for one delegated capture click; unrelated routes do nothing',()=>{
 const f=fixture();assert.equal(f.listeners.get('click')?.capture,true);
 assert.equal(f.body.children.length,0);assert.equal(f.head.children.length,0);
 assert.equal(f.calls.storageReads,0);assert.equal(f.calls.fetches,0);
 for(const f2 of [fixture({allowed:false}),fixture({vanilla:false})])assert.equal(f2.listeners.size,0);
 f.host.destroy();assert.equal(f.listeners.size,0);
});
test('registered custom-site pages leave ordinary Canvas links alone while local PDFs use the reader',()=>{
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
const readingRoutes=['/','/dashboard','/courses/7','/courses/7/files','/courses/7/files/folder/Readings','/courses/7/files/42/preview','/files/42/preview','/courses/7/modules','/courses/7/pages/reading','/courses/7/announcements/9','/courses/7/discussion_topics/9','/courses/7/assignments/syllabus'];
test('each new route opens the existing reader only after a PDF click and replays the same click on failure',async()=>{
 for(const route of readingRoutes)for(const fail of [false,true]){
  const f=fixture({href:canvas+route,...(fail?{failFetch:new TypeError('CORS')}:{})});await tick();assert.ok(f.host,route);assert.equal(f.calls.fetches,0);assert.equal(f.body.children.length,0);
  const link=anchor(),e=click(link);f.emit('click',e);await tick();await tick();assert.equal(e.prevented,true,route);assert.equal(e.stopped,true);assert.equal(f.calls.fetches,1);
  if(fail){assert.equal(link.clicks,1);assert.equal(f.host.active(),null);}else{assert.ok(f.host.active());f.ready();assert.equal(f.calls.messages[0].msg.type,'reserve-pdf-init');assert.equal(f.calls.messages[0].msg.fileId,'42');assert.equal(new TextDecoder().decode(f.calls.messages[0].transfer[0]),'%PDF-1.7');}
  f.host.destroy();
 }
});
test('dashboard shadow-root rows and Linked materials use the same reader and preserve replay targets',async()=>{
 for(const materials of [false,true])for(const fail of [false,true]){
  const f=fixture({href:canvas+'/dashboard',...(fail?{failFetch:new TypeError('CORS')}:{})});await tick();const link=anchor();
  if(materials){const attrs={'data-pdf-file-id':'42','data-pdf-course-id':'7','data-pdf-name':'Reading.pdf','data-pdf-mime':'application/pdf'};link.tagName='BUTTON';delete link.href;link.className='';link.getAttribute=key=>attrs[key]??null;}
  const outside={closest:()=>null},e=click(outside,{composedPath:()=>[{closest:()=>link},link,{},outside]});f.emit('click',e);await tick();await tick();assert.equal(e.prevented,true);assert.equal(e.stopped,true);
  if(fail){assert.equal(link.clicks,1);assert.equal(f.host.active(),null);}else{f.ready();assert.equal(f.calls.messages[0].msg.fileId,'42');}
  f.host.destroy();
 }
});
test('module item links resolve with a bounded read-only Canvas GET before reading file bytes',async()=>{
 const f=fixture({href:canvas+'/courses/7/modules'}),requests=[];await tick();const fetching=f.root.fetch;
 f.root.fetch=async(url,options)=>{requests.push({url,options});return url.includes('/modules/items/')?{ok:true,url:canvas+'/courses/7/files/42?module_item_id=123'}:fetching(url,options);};
 const link=anchor({href:canvas+'/courses/7/modules/items/123'}),e=click(link);f.emit('click',e);await tick();await tick();f.ready();assert.equal(e.prevented,true);assert.equal(requests.length,2);assert.equal(requests[0].url,link.href);assert.equal(requests[0].options.method,'GET');assert.equal(requests[0].options.credentials,'same-origin');assert.equal(requests[1].url,canvas+'/files/42/download');assert.equal(f.calls.messages[0].msg.fileId,'42');assert.equal(link.clicks,0);f.host.destroy();
});
test('module resolution failures, wrong destinations and timeouts replay Canvas exactly once',async()=>{
 for(const kind of ['denied','external','page','rejected','timeout','invalid-pdf']){
  const f=fixture({href:canvas+'/courses/7/modules'});await tick();const fetching=f.root.fetch;let signal;
  f.root.fetch=async(url,options)=>{if(!url.includes('/modules/items/'))return kind==='invalid-pdf'?response('Not PDF'):fetching(url,options);signal=options.signal;if(kind==='timeout')return new Promise(()=>{});if(kind==='rejected')throw new TypeError('CORS');return {ok:kind!=='denied',url:kind==='external'?'https://evil.example/files/42':kind==='page'?canvas+'/courses/7/pages/42':canvas+'/courses/7/files/42'};};
  const link=anchor({href:canvas+'/courses/7/modules/items/123'}),e=click(link);f.emit('click',e);if(kind==='timeout'){const timer=[...f.timers.keys()].find(id=>f.timerDelays.get(id)===20000);assert.ok(timer);f.timers.get(timer)();}
  await tick();await tick();assert.equal(e.prevented,true);assert.equal(link.clicks,1,kind);assert.equal(f.host.active(),null,kind);assert.equal(signal.aborted,true);f.host.destroy();
 }
});
test('teardown cancels module lookup and route or feature changes during lookup leave Canvas in charge',async()=>{
 for(const kind of ['destroy','route','feature']){
  const f=fixture({href:canvas+'/courses/7/modules'});await tick();let resolve,signal;f.root.fetch=(_,options)=>{signal=options.signal;return new Promise(done=>{resolve=done;});};const link=anchor({href:canvas+'/courses/7/modules/items/123'});f.emit('click',click(link));
  if(kind==='destroy')f.host.destroy();else if(kind==='route')f.root.location.href=canvas+'/profile';else f.root.ReserveFeatures={enabled:()=>false};
  resolve({ok:true,url:canvas+'/courses/7/files/42'});await tick();await tick();assert.equal(f.host.active(),null);assert.equal(link.clicks,kind==='destroy'?0:1);assert.equal(signal.aborted,true);assert.equal(f.calls.fetches,0);f.host.destroy();
 }
});
test('route changes between clicks are supported without reload and disabled PDF clicks stay native',async()=>{
 const f=fixture();await tick();f.root.location.href=canvas+'/dashboard';const e=click(anchor());f.emit('click',e);await tick();await tick();assert.equal(e.prevented,true);assert.ok(f.host.active());f.host.destroy();
 const off=fixture();await tick();off.root.ReserveFeatures={enabled:()=>false};const untouched=click(anchor());off.emit('click',untouched);assert.equal(untouched.prevented,false);assert.equal(off.calls.fetches,0);off.host.destroy();
});
test('a fallback replay bubbles to Canvas without recursively reopening the dashboard reader',async()=>{
 const f=fixture({href:canvas+'/dashboard',failFetch:new TypeError('CORS')});await tick();const link=anchor();let nativeClicks=0;
 link.click=()=>{link.clicks++;const replay=click({closest:()=>null},{composedPath:()=>[link,{}]});f.emit('click',replay);if(!replay.prevented)nativeClicks++;};
 f.emit('click',click({closest:()=>null},{composedPath:()=>[link,{}]}));await tick();await tick();assert.equal(nativeClicks,1);assert.equal(link.clicks,1);assert.equal(f.calls.fetches,1);assert.equal(f.host.active(),null);f.host.destroy();
});
test('a detached file link falls back to its original Canvas preview destination',async()=>{
 const download=deferred(),f=fixture({download:()=>download.promise}),destinations=[];await tick();f.root.location.assign=url=>destinations.push(url);const link=anchor({href:canvas+'/courses/7/files/42?schoolp=1#preview'});f.emit('click',click(link));link.isConnected=false;download.reject(new TypeError('CORS'));await tick();await tick();assert.deepEqual(destinations,[link.href]);assert.equal(link.clicks,0);f.host.destroy();
});
test('detached relative file links preserve the destination resolved by Canvas and its document base',async()=>{
 const download=deferred(),f=fixture({href:canvas+'/courses/7/files/41',download:()=>download.promise}),destinations=[];await tick();f.root.location.assign=url=>destinations.push(url);const link=anchor({href:canvas+'/courses/7/files/42?schoolp=1#preview'}),attribute=link.getAttribute;link.getAttribute=key=>key==='href'?'42?schoolp=1#preview':attribute(key);f.emit('click',click(link));assert.equal(f.host.active()?.info.fileId,'42');link.isConnected=false;download.reject(new TypeError('CORS'));await tick();await tick();assert.deepEqual(destinations,[link.href]);f.host.destroy();
});
test('an obsolete PDF failure cannot replay over a newer pending module lookup',async()=>{
 for(const failedLookup of [false,true]){
  const download=deferred(),lookup=deferred(),f=fixture({download:()=>download.promise});await tick();const fetching=f.root.fetch;f.root.fetch=(url,options)=>url.includes('/modules/items/')?lookup.promise:url.includes('/files/43/')?Promise.resolve(response()):fetching(url,options);
  const first=anchor(),next=anchor({href:canvas+'/courses/7/modules/items/123',name:'Next.pdf'});f.emit('click',click(first));f.emit('click',click(next));download.reject(new TypeError('CORS'));await tick();await tick();assert.equal(first.clicks,0,'the superseded click must never navigate away');
  if(failedLookup)lookup.reject(new TypeError('CORS'));else lookup.resolve({ok:true,url:canvas+'/courses/7/files/43?module_item_id=123'});await tick();await tick();
  if(failedLookup){assert.equal(next.clicks,1);assert.equal(f.host.active(),null);}else{assert.equal(next.clicks,0);assert.equal(f.host.active()?.info.fileId,'43');}
  f.host.destroy();
 }
});
test('an obsolete PDF failure releases a queued replacement without losing the newer click',async()=>{
 const download=deferred(),f=fixture({download:()=>download.promise});await tick();const fetching=f.root.fetch;f.root.fetch=(url,options)=>url.includes('/files/43/')?Promise.resolve(response()):fetching(url,options);const first=anchor(),next=anchor({href:canvas+'/files/43',name:'Next.pdf'});f.emit('click',click(first));f.emit('click',click(next));download.reject(new TypeError('CORS'));await tick();await tick();assert.equal(first.clicks,0);assert.equal(next.clicks,0);assert.equal(f.host.active()?.info.fileId,'43');f.host.destroy();
});
test('a refused replacement leaves the surviving reader eligible for its own later fallback',async()=>{
 const f=fixture(),state=await openReader(f),next=anchor({href:canvas+'/files/43',name:'Next.pdf'});f.emit('click',click(next));await tick();const request=f.calls.messages.at(-1).msg;f.message('reserve-pdf-close-result',{requestId:request.requestId,ok:false});await tick();assert.equal(f.host.active(),state);f.message('reserve-pdf-error',{message:'Reader failure'});assert.equal(state.trigger.clicks,1);assert.equal(next.clicks,0);assert.equal(f.host.active(),null);f.host.destroy();
});
test('a failed module lookup leaves the surviving reader eligible for its own later fallback',async()=>{
 const f=fixture(),state=await openReader(f),fetching=f.root.fetch;f.root.fetch=async(url,options)=>url.includes('/modules/items/')?{ok:false,url}:fetching(url,options);
 const item=anchor({href:canvas+'/courses/7/modules/items/123'});f.emit('click',click(item));await tick();await tick();assert.equal(item.clicks,1);assert.equal(f.host.active(),state);
 f.message('reserve-pdf-error',{message:'Reader failure'});assert.equal(state.trigger.clicks,1,'the open reader still hands its own click back to Canvas');assert.equal(f.host.active(),null);f.host.destroy();
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

for(const readiness of ['never ready','already ready','ready while waiting'])test('replacement timeout only releases a reader that never became ready: '+readiness,async t=>{
 const f=fixture();t.after(()=>f.host.destroy());await tick();f.emit('click',click(anchor()));await tick();if(readiness==='already ready')f.ready();
 const state=f.host.active();f.emit('click',click(anchor({href:canvas+'/files/43/download'})));const waiting=state.closeRequest;
 if(readiness==='ready while waiting')f.ready();
 const deadline=[...f.timers].find(([id])=>f.timerDelays.get(id)>0&&f.timerDelays.get(id)<=3000);
 assert.ok(deadline,'a short close deadline survives the init transfer');
 let settled=false;waiting.promise.then(()=>{settled=true;});deadline[1]();await tick();await tick();const safe=readiness==='never ready';assert.equal(settled,safe);assert.equal(state.closed,safe);
 assert.equal(f.host.active().info.fileId,safe?'43':'42');assert.equal(f.calls.fetches,safe?2:1);assert.equal(state.trigger.clicks,0,'timeout does not replay Canvas');
 const current=f.host.active();f.emit('window:message',{origin:state.extensionOrigin,source:state.frame.contentWindow,data:{type:'reserve-pdf-close-result',token:state.token,requestId:waiting.requestId,ok:true}});
 await tick();if(safe)assert.equal(f.host.active(),current,'late replies cannot close the replacement');else{assert.equal(await waiting.promise,true);assert.equal(f.host.active().info.fileId,'43','a slow save still releases the latest replacement after confirmation');}
});

test('a slow guarded save cannot lose annotations or an AI draft when the replacement deadline expires',async t=>{
 const f=fixture();t.after(()=>f.host.destroy());const state=await openReader(f);let destroyed=0;state.ai={draft:'Keep this draft',destroy(){destroyed++;}};f.emit('click',click(anchor({href:canvas+'/files/43/download'})));const request=state.closeRequest;f.timers.get(request.timer)();await tick();
 assert.equal(state.closeRequest,request);assert.equal(state.closed,false);assert.equal(f.host.active()===state,true);assert.equal(state.ai.draft,'Keep this draft');assert.equal(destroyed,0);assert.equal(f.calls.fetches,1);
 f.message('reserve-pdf-close-result',{requestId:request.requestId,ok:true});await tick();assert.equal(await request.promise,true);assert.equal(f.host.active().info.fileId,'43');assert.equal(destroyed,1);
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


test('an encrypted local PDF keeps a verified named download after its reader closes',async()=>{
 const f=fixture(),made=[],revoked=[],downloads=[],owner={origin:canvas,accountId:'7'};
 f.root.URL={createObjectURL:blob=>{made.push(blob);return 'blob:'+canvas+'/encrypted-'+made.length;},revokeObjectURL:url=>revoked.push(url)};
 const create=f.root.document.createElement;f.root.document.createElement=tag=>{const element=create(tag);if(tag==='a')element.click=()=>downloads.push({href:element.href,name:element.download});return element;};
 await f.host.openLocal({blob:new Blob(['%PDF-1.7 encrypted']),id:'cf-secret-notes',name:'Private notes.pdf',owner});await tick();f.ready();
 f.message('reserve-pdf-error',{message:'Password-protected PDF: download the saved file to open it.'});
 assert.equal(f.host.active(),null);const button=f.body.querySelector('.reserve-pdf-fallback button');assert.ok(button,'a download remains available after reader failure');
 await button.handlers.get('click')();assert.equal(downloads.length,1);assert.equal(downloads[0].name,'Private notes.pdf');assert.equal(downloads[0].href,'blob:'+canvas+'/encrypted-2');assert.equal(f.calls.fetches,0);
 await f.host.closeLocal(owner);assert.equal(f.body.querySelector('.reserve-pdf-fallback'),null);assert.deepEqual(revoked,['blob:'+canvas+'/encrypted-1','blob:'+canvas+'/encrypted-2']);f.host.destroy();
});


test('a failed local PDF cannot download after its Canvas account changes',async()=>{
 const f=fixture(),made=[],owner={origin:canvas,accountId:'7'};
 f.root.URL={createObjectURL:blob=>{made.push(blob);return 'blob:'+canvas+'/private-'+made.length;},revokeObjectURL(){}};
 await f.host.openLocal({blob:new Blob(['%PDF-1.7 encrypted']),id:'cf-secret-notes',name:'Private.pdf',owner});await tick();f.ready();f.message('reserve-pdf-error',{message:'Password required.'});
 const button=f.body.querySelector('.reserve-pdf-fallback button');assert.ok(button);f.root.fetch=async()=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'8'})});
 await button.handlers.get('click')();assert.equal(made.length,1,'no download URL is created for the changed account');assert.match(f.body.textContent,/account changed/i);assert.equal(f.body.querySelector('.reserve-pdf-fallback button'),null);f.host.destroy();
});

test('Files preview rows and PDF File module labels preserve their original destinations',()=>{
 for(const path of ['/files?preview=42','/courses/7/files?preview=42','/courses/7/files/folder/Readings?preview=42']){
  const link=anchor({href:canvas+path}),info=Host.matchPdfClick(click(link),canvas);assert.equal(info.fileId,'42');assert.equal(info.originalURL,link.href);assert.equal(info.url,canvas+'/files/42/download');
 }
 for(const path of ['/courses/7/pages?preview=42','/courses/7/files?preview=no','/courses/7/files?preview=-42','/other/files?preview=42'])assert.equal(Host.matchPdfClick(click(anchor({href:canvas+path})),canvas),null);
 const module=anchor({href:canvas+'/courses/7/modules/items/9',name:'PDF File Chapter one'}),info=Host.matchPdfClick(click(module),canvas);
 assert.equal(info.moduleURL,module.href);assert.equal(info.name,'Chapter one.pdf');assert.equal(info.originalURL,module.href);
 const row={className:'quiz',getAttribute:key=>key==='data-module-type'?'Quiz':null};module.closest=selector=>selector.includes('a[')?module:selector==='.context_module_item,.ef-item-row'?row:null;
 assert.equal(Host.matchPdfClick(click(module),canvas),null);assert.equal(Host.matchCanvasFile(click(module),canvas),null);
});

test('file-address arrivals verify one metadata GET before opening and watch only Files addresses',async()=>{
 for(const path of ['/files/42','/files/42/preview','/files/42/file_preview','/courses/7/files/42','/courses/7/files/42/preview','/files?preview=42','/courses/7/files?preview=42','/courses/7/files/folder/Readings?preview=42']){
  const f=fixture({href:canvas+path,metadata:{id:'42',display_name:'On arrival.pdf','content-type':'application/pdf'}});await tick();await tick();
  assert.equal(f.calls.metadataReads.length,1,path);assert.equal(f.calls.fetches,1,path);assert.equal(f.host.active()?.info.fileId,'42',path);assert.equal(f.intervals.size,1,path);
  const lookup=f.calls.metadataReads[0];assert.equal(lookup.url,canvas+'/api/v1/files/42');assert.equal(lookup.options.method,'GET');assert.equal(lookup.options.credentials,'same-origin');assert.equal(lookup.options.redirect,'error');assert.equal(lookup.options.cache,'no-store');assert.equal(lookup.options.signal.aborted,true);
  f.ready();assert.equal(f.calls.messages[0].msg.name,'On arrival.pdf');f.host.destroy();assert.equal(f.intervals.size,0);assert.equal(f.listeners.size,0);assert.equal(f.timers.size,0);
 }
 for(const path of ['/dashboard','/courses/7/modules','/courses/7/pages/reading','/courses/7/assignments/9']){
  const f=fixture({href:canvas+path});assert.equal(f.listeners.size,1,path);assert.equal(f.intervals.size,0,path);assert.equal(f.timers.size,0,path);assert.equal(f.calls.metadataReads.length,0,path);assert.equal(f.calls.storageReads,0,path);f.host.destroy();
 }
 for(const path of ['/courses/7/quizzes/4','/courses/7/quizzes/4/take','/courses/7/assignments','/profile']){
  const f=fixture({href:canvas+path});assert.equal(f.host,null,path);assert.equal(f.listeners.size,0,path);assert.equal(f.intervals.size,0,path);assert.equal(f.calls.metadataReads.length,0,path);
 }
});

test('address loading waits for DOM readiness and teardown removes the pending callback',async()=>{
 const options={href:canvas+'/files/42',readyState:'loading',metadata:{id:'42',filename:'Ready.pdf'}};
 const f=fixture(options);assert.equal(f.calls.metadataReads.length,0);f.emit('DOMContentLoaded');await tick();await tick();assert.equal(f.host.active()?.info.fileId,'42');assert.equal(f.listeners.has('DOMContentLoaded'),false);f.host.destroy();
 const retired=fixture(options);retired.host.destroy();retired.emit('DOMContentLoaded');await tick();assert.equal(retired.calls.metadataReads.length,0);assert.equal(retired.intervals.size,0);assert.equal(retired.listeners.size,0);
});

test('a Files address change replaces through the save guard and leaving Files retires its watcher',async()=>{
 const f=fixture({href:canvas+'/courses/7/files?preview=42',metadata:url=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:url.split('/').pop(),filename:'Address.pdf'})})});await tick();await tick();f.ready();const first=f.host.active(),watch=[...f.intervals.values()][0].fn;
 f.root.location.href=canvas+'/courses/7/files/folder/Readings?preview=43';watch();await tick();await tick();assert.equal(f.host.active(),first);assert.ok(first.closeRequest);
 f.message('reserve-pdf-close-result',{requestId:first.closeRequest.requestId,ok:false});await tick();assert.equal(f.host.active(),first);assert.equal(f.calls.fetches,1);
 f.root.location.href=canvas+'/courses/7/files?preview=44';watch();await tick();await tick();f.message('reserve-pdf-close-result',{requestId:first.closeRequest.requestId,ok:true});await tick();await tick();assert.equal(f.host.active()?.info.fileId,'44');assert.equal(f.calls.fetches,2);
 const reads=f.calls.metadataReads.length;f.root.location.href=canvas+'/courses/7/quizzes/4/take';watch();await tick();assert.equal(f.intervals.size,0);assert.equal(f.calls.metadataReads.length,reads);f.host.destroy();
});

test('file arrivals with non-PDF metadata or denied reads keep the existing native viewer without navigation',async()=>{
 for(const kind of ['non-pdf','denied','invalid-bytes','cors']){
  const f=fixture({href:canvas+'/files/42',metadata:kind==='non-pdf'?{id:'42',filename:'Other.txt'}:kind==='denied'?()=>({ok:false}):{id:'42',filename:'Reading.pdf'},...(kind==='invalid-bytes'?{download:()=>response('Not a PDF')}:kind==='cors'?{failFetch:new TypeError('CORS')}:{})});
  await tick();await tick();assert.equal(f.host.active(),null,kind);assert.deepEqual(f.calls.destinations,[],kind);assert.equal(f.calls.profileReads,0);assert.equal(f.calls.fetches,kind==='non-pdf'||kind==='denied'?0:1);f.host.destroy();
 }
});

test('an unlabeled Canvas link performs one read-only metadata GET then opens verified PDF bytes',async()=>{
 const f=fixture({metadata:{id:'42',display_name:'Verified.pdf','content-type':'application/pdf'}}),link=anchor({href:canvas+'/courses/7/files/42',name:'Read this document'}),event=click(link);
 assert.equal(Host.matchPdfClick(event,canvas),null);assert.equal(Host.matchCanvasFile(event,canvas)?.fileId,'42');f.emit('click',event);await tick();await tick();f.ready();
 assert.equal(event.prevented,true);assert.equal(f.calls.metadataReads.length,1);assert.equal(f.calls.metadataReads[0].options.method,'GET');assert.equal(f.calls.fetches,1);assert.equal(link.clicks,0);assert.equal(f.calls.messages[0].msg.name,'Verified.pdf');assert.equal(f.calls.profileReads,0);f.host.destroy();
});

test('non-PDF, denied, malformed and expired metadata replay the original unlabeled click once',async()=>{
 for(const kind of ['non-pdf','denied','wrong-file','wrong-type','invalid-json','rejected','timeout']){
  let signal;const meta=deferred(),f=fixture({metadata:(_,options)=>{signal=options.signal;if(kind==='timeout')return meta.promise;if(kind==='rejected')throw new TypeError('CORS');return {ok:kind!=='denied',headers:{get:()=>kind==='wrong-type'?'text/html':'application/json'},json:async()=>{if(kind==='invalid-json')throw Error('Invalid JSON');return {id:kind==='wrong-file'?'43':'42',filename:kind==='non-pdf'?'Document.txt':'Document.pdf'};}};}}),link=anchor({href:canvas+'/files/42',name:'Open the document'});
  let native=0;link.click=()=>{link.clicks++;const event=click(link);f.emit('click',event);if(!event.prevented)native++;};f.emit('click',click(link));
  if(kind==='timeout'){const timer=[...f.timers.keys()].find(id=>f.timerDelays.get(id)===15000);assert.ok(timer);f.timers.get(timer)();}
  await tick();await tick();assert.equal(f.calls.metadataReads.length,1,kind);assert.equal(f.calls.fetches,0,kind);assert.equal(f.host.active(),null,kind);assert.equal(link.clicks,1,kind);assert.equal(native,1,kind);assert.equal(signal.aborted,true,kind);f.host.destroy();
 }
});

test('unlabeled links preserve modified clicks, downloads and unrelated targets without a lookup',()=>{
 const f=fixture();
 for(const options of [{button:1},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{defaultPrevented:true}]){const event=click(anchor({href:canvas+'/files/42',name:'A document'}),options);f.emit('click',event);assert.equal(event.prevented,false);}
 for(const href of [canvas+'/files/42/download','https://other.example.test/files/42',canvas+'/courses/7/quizzes/4',canvas+'/courses/7/pages/42']){const event=click(anchor({href,name:'A document'}));f.emit('click',event);assert.equal(event.prevented,false);}
 const link=anchor({href:canvas+'/files/42',name:'A document'}),attr=link.getAttribute;link.getAttribute=key=>key==='download'?'':attr(key);const event=click(link);f.emit('click',event);assert.equal(event.prevented,false);assert.equal(f.calls.metadataReads.length,0);assert.equal(f.calls.fetches,0);f.host.destroy();
});

test('stale metadata cannot replace a newer reader or act after teardown, route or feature changes',async()=>{
 for(const kind of ['newer','destroy','route','feature']){
  const lookup=deferred(),f=fixture({metadata:()=>lookup.promise}),link=anchor({href:canvas+'/files/42',name:'A document'});f.emit('click',click(link));
  if(kind==='newer')f.emit('click',click(anchor({href:canvas+'/files/43',name:'Newer.pdf'})));else if(kind==='destroy')f.host.destroy();else if(kind==='route')f.root.location.href=canvas+'/courses/7/quizzes/4/take';else f.root.ReserveFeatures={enabled:()=>false};
  lookup.resolve({ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'42',filename:'Old.pdf'})});await tick();await tick();assert.equal(f.host.active()?.info.fileId,kind==='newer'?'43':undefined,kind);assert.equal(link.clicks,kind==='feature'?1:0,kind);assert.equal(f.calls.fetches,kind==='newer'?1:0,kind);f.host.destroy();
 }
});

test('an out-of-order file-address lookup cannot reopen a stale preview',async()=>{
 const pending=[],f=fixture({href:canvas+'/courses/7/files?preview=42',metadata:()=>{const value=deferred();pending.push(value);return value.promise;}}),watch=[...f.intervals.values()][0].fn;
 f.root.location.href=canvas+'/courses/7/files?preview=43';watch();assert.equal(pending.length,2);
 pending[1].resolve({ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'43',filename:'Latest.pdf'})});await tick();await tick();assert.equal(f.host.active()?.info.fileId,'43');
 pending[0].resolve({ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'42',filename:'Old.pdf'})});await tick();await tick();assert.equal(f.host.active()?.info.fileId,'43');assert.equal(f.calls.fetches,1);f.host.destroy();
});

test('external PDF matching keeps the original fragment, plain-click policy and download exclusions',()=>{
 const url='https://files.example.test/Chapter.PDF?version=2#page=5',link=anchor({href:url,name:'Chapter \u2197'}),info=Host.matchPdfClick(click(link),canvas);
 assert.equal(info.remote,'https://files.example.test/Chapter.PDF?version=2');assert.equal(info.url,info.remote);assert.equal(info.originalURL,url);assert.equal(info.page,4);assert.equal(info.name,'Chapter.pdf');assert.equal(info.fileId,undefined);
 for(const href of ['http://files.example.test/chapter.pdf','https://user@files.example.test/chapter.pdf','https://files.example.test/chapter.docx','https://files.example.test/%ZZ.pdf','https://files.example.test/chapter.pdf.exe'])assert.equal(Host.matchPdfClick(click(anchor({href})),canvas),null);
 for(const hash of ['#page=0','#page=-1','#page=NaN','#page=1.5','#page=9007199254740992'])assert.equal(Host.matchPdfClick(click(anchor({href:info.remote+hash})),canvas).page,null);
 for(const options of [{button:1},{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{defaultPrevented:true}])assert.equal(Host.matchPdfClick(click(link,options),canvas),null);
 const attr=link.getAttribute;link.getAttribute=key=>key==='download'?'':attr(key);assert.equal(Host.matchPdfClick(click(link),canvas),null);
});

test('external identity uses the canonical URL SHA-256 in a separate namespace and ignores page fragments',async()=>{
 const url='https://files.example.test/chapter.pdf?version=2',crypto=require('node:crypto'),first=await Host.remoteFileId(url+'#page=2',crypto.webcrypto),next=await Host.remoteFileId(url+'#page=9',crypto.webcrypto);
 assert.equal(first,'remote-'+crypto.createHash('sha256').update(url).digest('hex'));assert.equal(first,next);assert.match(first,/^remote-[0-9a-f]{64}$/);assert.notEqual(first,await Host.remoteFileId(url+'3',crypto.webcrypto));
 await assert.rejects(Host.remoteFileId('http://files.example.test/chapter.pdf',crypto.webcrypto),/secure/);await assert.rejects(Host.remoteFileId(url,{}),/identity/);
});

async function openRemoteReader(f,href='https://files.example.test/notes.pdf#page=3'){
 f.root.crypto.subtle={digest:async(_,input)=>Uint8Array.from(require('node:crypto').createHash('sha256').update(input).digest()).buffer};
 const link=anchor({href,name:'External notes'}),event=click(link);f.emit('click',event);await tick();await tick();f.ready();return {link,event,state:f.host.active()};
}

test('external PDFs use the authenticated reader fetch interface without host fetch or permission calls',async()=>{
 const f=fixture(),permissions=[];f.root.chrome.permissions={request:request=>{permissions.push(request);return Promise.resolve(true);}};
 const {link,event,state}=await openRemoteReader(f),init=f.calls.messages.find(call=>call.msg.type==='reserve-pdf-init');assert.ok(state);assert.equal(event.prevented,true);assert.equal(init.msg.bytes,null);assert.deepEqual(init.transfer,[]);
 assert.equal(init.msg.remote,'https://files.example.test/notes.pdf');assert.equal(init.msg.url,init.msg.remote);assert.equal(init.msg.fetchInReader,true);assert.equal(init.msg.page,2);assert.equal(init.msg.fileId,'remote-'+require('node:crypto').createHash('sha256').update(init.msg.remote).digest('hex'));assert.equal(init.msg.aiEnabled,false);assert.equal(init.msg.local,undefined);assert.deepEqual(permissions,[]);assert.equal(f.calls.fetches,0);assert.equal(f.calls.metadataReads.length,0);assert.equal(link.clicks,0);
 f.message('reserve-pdf-ai',{text:'External text',page:0});await tick();assert.equal(f.calls.profileReads,0);f.message('reserve-pdf-canvas');assert.equal(f.host.active(),state);f.host.destroy();
});

test('external permission declines and reader fetch errors replay the original external click exactly once',async()=>{
 for(const message of ['Access to this PDF site was not granted.','The external PDF exceeds the 32 MiB reading limit.','The external PDF fetch failed.']){
  const f=fixture(),{link,state}=await openRemoteReader(f);let native=0;link.click=()=>{link.clicks++;const event=click(link);f.emit('click',event);if(!event.prevented)native++;};
  f.emit('window:message',{origin:'https://other.example.test',source:state.frame.contentWindow,data:{type:'reserve-pdf-error',token:state.token,message}});assert.equal(f.host.active(),state);
  f.message('reserve-pdf-error',{message});f.message('reserve-pdf-error',{message});await tick();assert.equal(f.host.active(),null);assert.equal(link.clicks,1);assert.equal(native,1);assert.equal(f.calls.fetches,0);assert.equal(f.calls.metadataReads.length,0);assert.equal(f.timers.size,1);f.host.destroy();assert.equal(f.timers.size,0);
 }
 const f=fixture(),{link}=await openRemoteReader(f);link.isConnected=false;f.message('reserve-pdf-error',{message:'Access was not granted.'});assert.deepEqual(f.calls.destinations,[link.href]);f.host.destroy();
});

test('native Canvas escape authenticates the message, remembers the tab choice and offers a paper return control',async()=>{
 const f=fixture(),state=await openReader(f);f.emit('window:message',{origin:'https://other.example.test',source:state.frame.contentWindow,data:{type:'reserve-pdf-canvas',token:state.token}});assert.equal(f.host.active(),state);
 f.emit('window:message',{origin:state.extensionOrigin,source:{},data:{type:'reserve-pdf-canvas',token:state.token}});assert.equal(f.host.active(),state);f.message('reserve-pdf-canvas',{token:'wrong-token'});assert.equal(f.host.active(),state);
 f.message('reserve-pdf-canvas');assert.equal(f.host.active(),null);assert.equal(state.trigger.clicks,1);assert.equal(f.sessionValues.get('reserve:pdf-viewer'),'canvas');
 const bar=f.body.querySelector('.reserve-pdf-switch'),buttons=bar.querySelectorAll('button');assert.equal(buttons[0].textContent,'Open in Harness reader');assert.equal(buttons[1].textContent,'Hide');assert.equal(buttons[0].className,'rd-text-button');assert.match(bar.style.cssText,/#fffdf8/);assert.match(bar.style.cssText,/1\.6px solid #141413/);assert.equal(bar.querySelectorAll('svg').length,0);
 const next=anchor({href:canvas+'/files/43',name:'Next.pdf'}),event=click(next);f.emit('click',event);assert.equal(event.prevented,false);assert.equal(f.calls.fetches,1);assert.equal(f.body.querySelectorAll('.reserve-pdf-switch').length,1);
 f.body.querySelector('.reserve-pdf-switch button').click();await tick();await tick();assert.equal(f.host.active()?.info.fileId,'43');assert.equal(f.sessionValues.has('reserve:pdf-viewer'),false);assert.equal(f.body.querySelector('.reserve-pdf-switch'),null);f.host.destroy();
});

test('native file-address choice offers a return without downloads and a failed return keeps Canvas visible',async()=>{
 const f=fixture({href:canvas+'/files/42',viewer:'canvas',metadata:{id:'42',filename:'Native.pdf'},failFetch:new TypeError('CORS')});await tick();await tick();assert.equal(f.host.active(),null);assert.equal(f.calls.metadataReads.length,1);assert.equal(f.calls.fetches,0);
 const bar=f.body.querySelector('.reserve-pdf-switch');assert.ok(bar);bar.querySelector('button').click();await tick();await tick();assert.equal(f.host.active(),null);assert.equal(f.calls.metadataReads.length,1);assert.equal(f.calls.fetches,1);assert.deepEqual(f.calls.destinations,[]);f.host.destroy();
});

test('a native return remains usable when the same file address changes its fragment',async()=>{
 const f=fixture({href:canvas+'/files/42',viewer:'canvas',metadata:{id:'42',filename:'Native.pdf'}});await tick();await tick();
 f.root.location.href=canvas+'/files/42#page=3';[...f.intervals.values()][0].fn();f.body.querySelector('.reserve-pdf-switch button').click();await tick();await tick();assert.equal(f.host.active()?.info.fileId,'42');assert.equal(f.host.active()?.info.addressHref,f.root.location.href);assert.equal(f.calls.metadataReads.length,1);f.host.destroy();
});

test('native Canvas escape from an address reveals the native file and Hide removes its return control',async()=>{
 const f=fixture({href:canvas+'/courses/7/files?preview=42',metadata:{id:'42',filename:'Preview.pdf'}});await tick();await tick();f.ready();f.message('reserve-pdf-canvas');assert.equal(f.host.active(),null);assert.deepEqual(f.calls.destinations,[]);
 const buttons=f.body.querySelector('.reserve-pdf-switch').querySelectorAll('button');buttons[1].click();assert.equal(f.body.querySelector('.reserve-pdf-switch'),null);f.host.destroy();assert.equal(f.intervals.size,0);
});

test('saved local PDFs and readers awaiting readiness cannot switch to the native Canvas viewer',async()=>{
 const f=fixture();f.emit('click',click(anchor()));await tick();f.message('reserve-pdf-canvas');assert.ok(f.host.active());assert.equal(f.sessionValues.has('reserve:pdf-viewer'),false);f.host.destroy();
 const local=fixture();local.root.URL={createObjectURL:()=> 'blob:'+canvas+'/native-test',revokeObjectURL(){}};await local.host.openLocal({blob:new Blob(['%PDF-1.7']),id:'cf-native-notes',owner:{origin:canvas,accountId:'7'}});await tick();local.ready();const state=local.host.active();local.message('reserve-pdf-canvas');assert.equal(local.host.active(),state);assert.equal(local.body.querySelector('.reserve-pdf-switch'),null);assert.equal(local.sessionValues.has('reserve:pdf-viewer'),false);local.host.destroy();
});
