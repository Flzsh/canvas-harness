'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const extension=path.join(__dirname,'../extension');
const source=name=>fs.readFileSync(path.join(extension,name),'utf8');

// Small DOM double: selectors, native textarea setter, text nodes and cancellable
// InputEvents are modeled; no HTML parsing, credentials, click or submit is allowed.
class Element {
 constructor(tag='div',attrs={},text=''){this.tagName=tag.toUpperCase();this.attrs={...attrs};this.children=[];this.parentElement=null;this._text=text;this.events=[];this.isConnected=true;this.hidden=false;this.disabled=false;this.readOnly=false;this.style={};}
 getAttribute(name){return this.attrs[name]??null;}
 setAttribute(name,value){this.attrs[name]=String(value);}
 get isContentEditable(){return this.attrs.contenteditable==='true';}
 get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
 get innerText(){return this.textContent;}
 set textContent(value){this._text=value;this.children=[];}
 set innerHTML(_){throw new Error('HTML insertion is forbidden');}
 appendChild(child){child.parentElement=this;this.children.push(child);return child;}
 getClientRects(){return this.hidden?[]:[{width:400,height:90}];}
 matches(selector){
  selector=selector.trim();const attrs=[...selector.matchAll(/\[([^\]=*]+)(\*?=)?(?:"([^"]*)"|'([^']*)'|([^\]]+))?\]/g)];
  const bare=selector.replace(/\[[^\]]+\]/g,'');
  const tag=bare.match(/^[a-z][\w-]*/i);if(tag&&this.tagName!==tag[0].toUpperCase())return false;
  const id=bare.match(/#([\w-]+)/);if(id&&this.attrs.id!==id[1])return false;
  for(const c of bare.matchAll(/\.([\w-]+)/g))if(!(this.attrs.class||'').split(/\s+/).includes(c[1]))return false;
  for(const [,name,op,a,b,c] of attrs){const value=this.getAttribute(name),want=a??b??c;if(value===null)return false;if(op==='='&&value!==want)return false;if(op==='*='&&!value.includes(want))return false;}
  return true;
 }
 closest(selectors){for(let node=this;node;node=node.parentElement)if(selectors.split(',').some(s=>node.matches(s)))return node;return null;}
 focus(){this.ownerDocument.activeElement=this;if(this.onfocus)this.onfocus();}
 dispatchEvent(event){this.events.push(event);if(this.onEvent)this.onEvent(event);return !event.defaultPrevented;}
 click(){throw new Error('Auto-click is forbidden');}
 submit(){throw new Error('Auto-submit is forbidden');}
}
class Textarea extends Element {
 constructor(attrs={},value=''){super('textarea',attrs);this._value=value;this.nativeWrites=0;this.maxLength=-1;}
 get value(){return this._value;}
 set value(value){this.nativeWrites++;this._value=value;}
 setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}
}
class DraftInputEvent {
 constructor(type,options={}){this.type=type;Object.assign(this,options);this.defaultPrevented=false;}
 preventDefault(){if(this.cancelable)this.defaultPrevented=true;}
}
function dom(nodes=[],url='https://chatgpt.com/'){
 const location=new URL(url);
 const view={HTMLTextAreaElement:Textarea,InputEvent:DraftInputEvent,Event:DraftInputEvent,getComputedStyle:node=>({display:node.hidden?'none':'block',visibility:node.style.visibility||'visible'})};
 const document={defaultView:view,activeElement:null,querySelectorAll(selectors){return nodes.filter(node=>selectors.split(',').some(selector=>{
  const pieces=selector.trim().match(/(?:\[[^\]]+\]|[^\s[])+/g);if(!node.matches(pieces.pop()))return false;
  let ancestor=node.parentElement;for(let i=pieces.length-1;i>=0;i--){while(ancestor&&!ancestor.matches(pieces[i]))ancestor=ancestor.parentElement;if(!ancestor)return false;ancestor=ancestor.parentElement;}return true;
 }));},createTextNode(text){return {nodeType:3,textContent:text};}};
 for(const node of nodes)node.ownerDocument=document;
 const self={};return {document,location,URL,InputEvent:DraftInputEvent,Event:DraftInputEvent,HTMLTextAreaElement:Textarea,window:view,self,top:self};
}
function injector(fixture){
 const context=vm.createContext(fixture);vm.runInContext(source('ai-inject.js'),context);
 // Chrome serializes func, so intentionally evaluate it without its module closure.
 const serialized=String(context.CanvasHarnessInject.insertDraft);
 return (text,provider='chatgpt')=>vm.runInContext(`(${serialized})(__text,__provider)`,vm.createContext({...fixture,__text:text,__provider:provider}));
}

test('provider registry exposes the three primary websites and rejects unknown or inherited IDs',()=>{
 const context=vm.createContext({URL});vm.runInContext(source('ai-providers.js'),context);
 const P=context.CanvasHarnessProviders;
 assert.deepEqual(Array.from(P.list.filter(p=>p.primary),p=>p.id),['chatgpt','claude','gemini']);
 for(const id of ['grok','deepseek','kimi','qwen','zai'])assert.ok(P.get(id));
 for(const id of ['__proto__','constructor','https://evil.test','zlm',{},null])assert.equal(P.get(id),null);
 assert.equal(P.get('qwen').url,'https://chat.qwen.ai/');
 assert.equal(P.get('zai').url,'https://chat.z.ai/');
 assert.equal(P.get('kimi').url,'https://www.kimi.com/');
 for(const p of P.list){assert.equal(new URL(p.url).protocol,'https:');assert.deepEqual(Array.from(p.origins),[new URL(p.url).origin+'/*']);}
 assert.ok(Object.isFrozen(P.list));
});
test('textarea append preserves exact draft and context as literal text, notifying its framework without sending',()=>{
 const editor=new Textarea({id:'prompt-textarea'},'My own question  \n');
 const search=new Textarea({placeholder:'Search chats'},'search unchanged');
 const insert=injector(dom([editor,search]));
 assert.equal(insert('<img src=x onerror=steal()>\nCanvas context').status,'injected');
 assert.ok(editor.value.startsWith('My own question  \n\n\n'));
 assert.ok(editor.value.includes('<img src=x onerror=steal()>\nCanvas context'));
 assert.equal(search.value,'search unchanged');assert.equal(editor.nativeWrites,1);
 assert.deepEqual(editor.events.map(e=>e.type),['beforeinput','input']);
 assert.equal(editor.events[1].inputType,'insertText');assert.equal(editor.events[1].bubbles,true);
});
test('exact repeat is idempotent; altered injected text and user text are never removed',()=>{
 const editor=new Textarea({id:'prompt-textarea'},'Question');const insert=injector(dom([editor]));
 insert('Reference');const first=editor.value;insert('Reference');assert.equal(editor.value,first);assert.equal(editor.nativeWrites,1);
 editor._value=first.replace('Reference','My edited reference')+'\nMy addition';
 const modified=editor.value;insert('Reference');assert.ok(editor.value.startsWith(modified));assert.equal(editor.nativeWrites,2);
 insert('Different reference');assert.ok(editor.value.includes('My edited reference'));assert.ok(editor.value.includes('Different reference'));
});
test('contenteditable preserves rich draft nodes and appends only a plain text node',()=>{
 const editor=new Element('div',{class:'ProseMirror',contenteditable:'true','data-placeholder':'Reply to Claude'});
 const old=new Element('p',{},'A formatted draft');editor.appendChild(old);
 const insert=injector(dom([editor],'https://claude.ai/new'));
 assert.equal(insert('<b>Literal context</b>','claude').status,'injected');
 assert.equal(editor.children[0],old);assert.equal(editor.children[1].nodeType,3);assert.ok(editor.innerText.startsWith('A formatted draft\n\n'));
 assert.equal(insert('<b>Literal context</b>','claude').status,'injected');assert.equal(editor.children.length,2);
});
test('ambiguous composers, hidden or disabled editors, and arbitrary search fields refuse insertion',()=>{
 const a=new Textarea({id:'prompt-textarea'}),b=new Element('div',{id:'prompt-textarea',contenteditable:'true'});
 assert.equal(injector(dom([a,b]))('context').status,'no-editor');assert.equal(a.nativeWrites,0);
 for(const node of [new Textarea({placeholder:'Search'}),new Element('input',{id:'prompt-textarea'}),new Element('div',{contenteditable:'true',role:'textbox'})])assert.equal(injector(dom([node]))('context').status,'no-editor');
 for(const setting of ['hidden','disabled','readOnly']){const node=new Textarea({id:'prompt-textarea'});node[setting]=true;assert.equal(injector(dom([node]))('context').status,'no-editor');}
 const hidden=new Textarea({id:'prompt-textarea'});hidden.hidden=true;assert.equal(injector(dom([a,hidden]))('context').status,'injected');
});
test('all allowlisted providers can insert into their recognized composer, and provider origin is mandatory',()=>{
 const gemini=new Element('div',{class:'ql-editor',contenteditable:'true',role:'textbox'});new Element('rich-textarea').appendChild(gemini);
 const cases=[['gemini','https://gemini.google.com/app',gemini],['grok','https://grok.com/',new Textarea({placeholder:'What do you want to know?'})],['deepseek','https://chat.deepseek.com/',new Textarea({id:'chat-input'})],['kimi','https://www.kimi.com/',new Element('div',{class:'chat-input-editor',contenteditable:'true'})],['qwen','https://chat.qwen.ai/',new Textarea({id:'chat-input'})],['zai','https://chat.z.ai/',new Textarea({id:'chat-input'})]];
 for(const [id,url,node] of cases){assert.equal(injector(dom([node],url))('context',id).status,'injected',id);}
 const editor=new Textarea({id:'prompt-textarea'});
 for(const url of ['https://chatgpt.com.evil.test/','http://chatgpt.com/','https://evil.test/','https://chatgpt.com:444/'])assert.equal(injector(dom([editor],url))('context').status,'error');
 for(const id of ['__proto__','constructor','unknown'])assert.equal(injector(dom([editor]))('context',id).status,'error');
 assert.equal(editor.nativeWrites,0);
});
test('generic vendor rich text editors outside the recognized chat composer are refused',()=>{
 const claude=new Element('div',{class:'ProseMirror',contenteditable:'true','data-placeholder':'Edit document title'});
 const gemini=new Element('div',{class:'ql-editor',contenteditable:'true',role:'textbox'});
 assert.equal(injector(dom([claude],'https://claude.ai/new'))('context','claude').status,'no-editor');
 assert.equal(injector(dom([gemini],'https://gemini.google.com/app'))('context','gemini').status,'no-editor');
 assert.equal(claude.children.length,0);assert.equal(gemini.children.length,0);
});
test('sign-in routes, visible password fields and nested frames are refused without reading credentials',()=>{
 const editor=new Textarea({id:'prompt-textarea'}),password=new Element('input',{type:'password'});
 Object.defineProperty(password,'value',{get(){throw new Error('Credential read');}});
 assert.equal(injector(dom([editor,password]))('context').status,'no-editor');
 for(const route of ['auth/login','login','signin','signup'])assert.equal(injector(dom([editor],'https://chatgpt.com/'+route))('context').status,'no-editor');
 const fixture=dom([editor]);fixture.top={};assert.equal(injector(fixture)('context').status,'error');assert.equal(editor.nativeWrites,0);
});
test('a visible email or verification sign-in form blocks insertion even over an existing composer',()=>{
 for(const attrs of [{type:'email'},{autocomplete:'username'},{autocomplete:'one-time-code'}]){
  const editor=new Textarea({id:'prompt-textarea'}),credential=new Element('input',attrs);
  Object.defineProperty(credential,'value',{get(){throw new Error('Credential read');}});
  assert.equal(injector(dom([editor,credential]))('context').status,'no-editor');assert.equal(editor.nativeWrites,0);
  credential.hidden=true;assert.equal(injector(dom([editor,credential]))('context').status,'injected');
 }
});
test('contenteditable repeat detection works even when rendered whitespace collapses',()=>{
 const editor=new Element('div',{class:'ProseMirror',contenteditable:'true','data-placeholder':'Reply to Claude'});
 Object.defineProperty(editor,'innerText',{get(){return this.textContent.replace(/\s+/g,' ');}});
 const insert=injector(dom([editor],'https://claude.ai/new'));assert.equal(insert('Line one\nLine two','claude').status,'injected');
 assert.equal(insert('Line one\nLine two','claude').status,'injected');
 assert.equal(editor.children.length,1,'the literal appended block prevents duplicate insertion');
});
test('cancelled beforeinput or a draft/navigation change during focus aborts without overwriting',()=>{
 const editor=new Textarea({id:'prompt-textarea'},'Question');editor.onEvent=e=>{if(e.type==='beforeinput')e.preventDefault();};
 assert.equal(injector(dom([editor]))('context').status,'no-editor');assert.equal(editor.value,'Question');
 editor.onEvent=e=>{if(e.type==='beforeinput')editor._value='User typing now';};
 assert.equal(injector(dom([editor]))('context').status,'no-editor');assert.equal(editor.value,'User typing now');
 const fixture=dom([editor]);editor.onfocus=()=>{fixture.location.href='https://evil.test/';};editor.onEvent=null;
 assert.equal(injector(fixture)('context',{id:'chatgpt',origin:'https://chatgpt.com',expectedURL:'https://chatgpt.com/'}).status,'error');assert.equal(editor.nativeWrites,0);
});
test('injection rejects oversized or empty text and a changed execution document',()=>{
 const editor=new Textarea({id:'prompt-textarea'});const insert=injector(dom([editor]));
 for(const text of ['',null,' '.repeat(3),'x'.repeat(140001)])assert.equal(insert(text).status,'error');
 assert.equal(insert('context',{id:'chatgpt',origin:'https://evil.test',expectedURL:'https://chatgpt.com/'}).status,'error');
 assert.equal(insert('context',{id:'chatgpt',origin:'https://chatgpt.com',expectedURL:'https://chatgpt.com/c/another'}).status,'error');
 assert.equal(editor.nativeWrites,0);
});
test('the text size boundary is accepted but composer maxlength cannot truncate an existing draft',()=>{
 const editor=new Textarea({id:'prompt-textarea'},'My draft');editor.maxLength=20;
 assert.equal(injector(dom([editor]))('A longer reference').status,'no-editor');assert.equal(editor.value,'My draft');
 editor.maxLength=-1;assert.equal(injector(dom([editor]))('x'.repeat(140000)).status,'injected');assert.ok(editor.value.startsWith('My draft'));
});

function webHarness({granted=true,failPopup=false}={}){
 const stored={},tabs=new Map(),calls=[],sender={id:'extension-id',tab:{id:12},frameId:0};let nextId=100;
 const chrome={runtime:{id:'extension-id',getURL:p=>'chrome-extension://extension-id/'+p},storage:{session:{async get(key){return {[key]:structuredClone(stored[key])};},async set(values){Object.assign(stored,structuredClone(values));},async remove(key){delete stored[key];}}},permissions:{async contains(details){calls.push(['contains',details]);return granted;},async request(){throw new Error('Permission request requires the separate page');}},tabs:{async create(details){calls.push(['tab-create',details]);const tab={id:nextId++,windowId:5,url:details.url};tabs.set(tab.id,tab);return {...tab};},async get(id){calls.push(['get',id]);if(!tabs.has(id))throw new Error('Tab closed');return {...tabs.get(id)};},async update(id,details){calls.push(['update',id,details]);if(!tabs.has(id))throw new Error('Tab closed');return {...tabs.get(id)};},async query(){throw new Error('Must not reuse random tabs');}},windows:{async create(details){calls.push(['window-create',details]);if(failPopup)throw new Error('Popup unavailable');const tab={id:nextId++,windowId:nextId++,url:details.url};tabs.set(tab.id,tab);return {id:tab.windowId,tabs:[{...tab}]};},async update(id,details){calls.push(['window-update',id,details]);return {id};}},scripting:{async executeScript(details){calls.push(['execute',details]);return [{frameId:0,result:{status:'injected',message:'Review your draft.'}}];}}};
 const context=vm.createContext({chrome,URL});context.importScripts=(...files)=>{for(const file of files)vm.runInContext(source(file),context);};
 vm.runInContext(source('ai-web.js'),context);
 const handle=(action,provider='chatgpt',text,customSender=sender)=>context.CanvasHarnessWeb.handle({type:'ch-ai-web',action,provider,text},customSender);
 return {handle,chrome,calls,stored,tabs,sender,grant(value){granted=value;}};
}
test('launcher creates only controlled provider windows and reuses by source Canvas tab plus provider',async()=>{
 const h=webHarness();assert.equal((await h.handle('open')).status,'opened');assert.equal((await h.handle('open')).status,'opened');
 assert.equal(h.calls.filter(c=>c[0]==='window-create').length,1);
 await h.handle('open','claude');await h.handle('open','chatgpt',undefined,{...h.sender,tab:{id:13}});
 assert.equal(h.calls.filter(c=>c[0]==='window-create').length,3);
 assert.equal(h.calls.find(c=>c[0]==='window-create')[1].type,'popup');
 assert.equal(h.calls.filter(c=>c[0]==='execute').length,0);
 assert.equal(Object.keys(h.stored).length,3);
});
test('concurrent opens share one controlled window and unavailable popups fall back to a normal tab',async()=>{
 const h=webHarness();await Promise.all([h.handle('open'),h.handle('open'),h.handle('open')]);assert.equal(h.tabs.size,1);
 const fallback=webHarness({failPopup:true});assert.equal((await fallback.handle('open')).status,'opened');assert.equal(fallback.calls.filter(c=>c[0]==='tab-create').length,1);
});
test('status is read-only and malformed requests or providers never open, grant, or execute',async()=>{
 const h=webHarness();await h.handle('status');assert.equal(h.tabs.size,0);assert.equal(Object.keys(h.stored).length,0);
 for(const provider of ['constructor','__proto__','https://evil.test',null,{}])assert.equal((await h.handle('open',provider)).status,'error');
 for(const action of ['send','paste','unknown'])assert.equal((await h.handle(action)).status,'error');
 assert.equal((await h.handle('open','chatgpt',undefined,{tab:{id:12},frameId:1})).status,'error');
 assert.equal((await h.handle('open','chatgpt',undefined,{...h.sender,id:'another-extension'})).status,'error');
 assert.equal(h.tabs.size,0);
});
test('only explicit inject executes against the stored tab, with main-frame and document guards',async()=>{
 const h=webHarness();await h.handle('open');await h.handle('status');
 assert.equal((await h.handle('inject','chatgpt','private Canvas context')).status,'injected');
 const execution=h.calls.find(c=>c[0]==='execute')[1];assert.deepEqual(Array.from(execution.target.frameIds),[0]);
 assert.equal(execution.target.tabId,[...h.tabs.keys()][0]);assert.equal(execution.world,'ISOLATED');assert.equal(execution.args[0],'private Canvas context');
 assert.equal(execution.args[1].origin,'https://chatgpt.com');assert.equal(execution.args[1].expectedURL,'https://chatgpt.com/');
 assert.ok(!JSON.stringify(h.stored).includes('private Canvas context'));
});
test('permission denial opens only a provider-only permission page and never retains or later inserts context',async()=>{
 const h=webHarness({granted:false});await h.handle('open');
 assert.equal((await h.handle('inject','chatgpt','TOP SECRET MATERIAL')).status,'needs-permission');
 const permission=h.calls.find(c=>c[0]==='tab-create')[1];const url=new URL(permission.url);
 assert.equal(url.pathname,'/ai-permission.html');assert.equal(url.search,'?provider=chatgpt');assert.equal(url.hash,'');
 assert.ok(!JSON.stringify(h.stored).includes('TOP SECRET'));assert.equal(h.calls.filter(c=>c[0]==='execute').length,0);
 await h.handle('inject','chatgpt','different context');assert.equal(h.calls.filter(c=>c[0]==='tab-create').length,1);
 h.grant(true);await h.handle('status');await h.handle('open');assert.equal(h.calls.filter(c=>c[0]==='execute').length,0);
 assert.equal((await h.handle('inject','chatgpt','new explicit context')).status,'injected');
});
test('closed, cross-origin, credential-bearing, or navigating targets refuse injection; reopen creates a fresh tab',async()=>{
 for(const url of ['https://evil.test/','https://chatgpt.com.evil.test/','http://chatgpt.com/','https://u:p@chatgpt.com/']){
  const h=webHarness();await h.handle('open');const tab=[...h.tabs.values()][0];tab.url=url;
  assert.equal((await h.handle('inject','chatgpt','context')).status,'error',url);assert.equal(h.calls.filter(c=>c[0]==='execute').length,0);
  assert.equal((await h.handle('open')).status,'opened');assert.equal(h.tabs.size,2);
 }
 const h=webHarness();await h.handle('open');const tab=[...h.tabs.values()][0];tab.pendingUrl='https://chatgpt.com/c/another';
 assert.equal((await h.handle('inject','chatgpt','context')).status,'error');assert.equal(h.calls.filter(c=>c[0]==='execute').length,0);
 h.tabs.clear();assert.equal((await h.handle('inject','chatgpt','context')).status,'error');assert.equal(h.tabs.size,0);
});
test('tampered stored target origins cannot authorize script execution',async()=>{
 const h=webHarness();await h.handle('open');const key=Object.keys(h.stored)[0];h.stored[key].origin='https://evil.test';
 assert.equal((await h.handle('inject','chatgpt','context')).status,'error');assert.equal(h.calls.filter(c=>c[0]==='execute').length,0);
});
test('navigation during executeScript is blocked by the serialized function itself',async()=>{
 for(const destination of ['https://evil.test/','https://chatgpt.com/c/different-document']){
  const h=webHarness();await h.handle('open');const editor=new Textarea({id:'prompt-textarea'},'Keep this draft');const fixture=dom([editor],destination);
  h.chrome.scripting.executeScript=async options=>{
   const result=vm.runInContext(`(${String(options.func)})(__text,__provider)`,vm.createContext({...fixture,__text:options.args[0],__provider:options.args[1]}));
   return [{frameId:0,result}];
  };
  assert.equal((await h.handle('inject','chatgpt','Private context')).status,'error');assert.equal(editor.value,'Keep this draft');assert.equal(editor.nativeWrites,0);
 }
});
test('web entry rejects text beyond 140000 characters before any browser side effect',async()=>{
 const h=webHarness();assert.equal((await h.handle('inject','chatgpt','x'.repeat(140001))).status,'error');assert.equal(h.calls.length,0);
 for(const value of [undefined,null,{},'','   '])assert.equal((await h.handle('inject','chatgpt',value)).status,'error');
 assert.equal(h.calls.length,0);
});
test('script permission rejection and no-editor results are surfaced without retries or auto-send',async()=>{
 const h=webHarness();await h.handle('open');h.chrome.scripting.executeScript=async()=>[{frameId:0,result:{status:'no-editor',message:'Sign in, then click Insert draft again.'}}];
 assert.equal((await h.handle('inject','chatgpt','context')).status,'no-editor');
 h.chrome.scripting.executeScript=async()=>{throw new Error('Permission denied');};assert.equal((await h.handle('inject','chatgpt','context')).status,'error');
 assert.equal(h.tabs.size,1);
});

function permissionHarness({granted=false,answer=true,query='?provider=chatgpt'}={}){
 let gesture=false,closed=0;const requests=[],removals=[],listeners={},nodes={};
 for(const id of ['provider-name','permission-status','grant-access','revoke-access','close-page','provider-origin'])nodes[id]={textContent:'',hidden:false,disabled:false,addEventListener(type,fn){listeners[id+':'+type]=fn;}};
 const chrome={permissions:{async contains(){return granted;},request(details){assert.equal(gesture,true,'request must be called synchronously from click');requests.push(details);granted=answer;return Promise.resolve(answer);},async remove(details){removals.push(details);granted=false;return true;}}};
 const context=vm.createContext({chrome,URL,URLSearchParams,location:{search:query},document:{getElementById:id=>nodes[id]},window:{close(){closed++;}}});
 vm.runInContext(source('ai-providers.js'),context);vm.runInContext(source('ai-permission.js'),context);
 return {nodes,requests,removals,closed:()=>closed,async click(id){gesture=true;let promise;try{promise=listeners[id+':click']();}finally{gesture=false;}await promise;},async settle(){await Promise.resolve();await Promise.resolve();}};
}
test('permission page requests selected provider access only on its own button and returns manually after grant',async()=>{
 const h=permissionHarness();await h.settle();assert.equal(h.requests.length,0);
 await h.click('grant-access');assert.equal(h.requests.length,1);
 assert.deepEqual(Array.from(h.requests[0].permissions),['scripting']);assert.deepEqual(Array.from(h.requests[0].origins),['https://chatgpt.com/*']);
 assert.equal(h.closed(),0);assert.match(h.nodes['permission-status'].textContent,/Canvas|return/i);
 await h.click('close-page');assert.equal(h.closed(),1);assert.equal(h.requests.length,1);
});
test('permission denial and revocation leave context transfer entirely manual',async()=>{
 const denied=permissionHarness({answer:false});await denied.settle();await denied.click('grant-access');assert.match(denied.nodes['permission-status'].textContent,/denied|not granted/i);assert.equal(denied.closed(),0);
 const allowed=permissionHarness({granted:true});await allowed.settle();await allowed.click('revoke-access');assert.deepEqual(Array.from(allowed.removals[0].origins),['https://chatgpt.com/*']);
 assert.equal(allowed.removals[0].permissions,undefined,'other providers may still need scripting');
 const invalid=permissionHarness({query:'?provider=__proto__'});await invalid.settle();assert.equal(invalid.nodes['grant-access'].disabled,true);assert.equal(invalid.requests.length,0);
});
