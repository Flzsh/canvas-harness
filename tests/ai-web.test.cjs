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
 let rangeTarget,collapsed=true;
 document.createRange=()=>({selectNodeContents(node){rangeTarget=node;collapsed=false;},collapse(){collapsed=true;}});
 view.getSelection=()=>({removeAllRanges(){},addRange(){}});
 // An uncollapsed range over the whole editor is replaced, as insertText does in a browser.
 document.execCommand=(command,ui,text)=>{assert.equal(command,'insertText');assert.equal(ui,false);if(!collapsed)rangeTarget.textContent='';rangeTarget.appendChild(document.createTextNode(text));return true;};
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
test('an editor that discards the input never reports successful injection',()=>{
 const editor=new Textarea({id:'prompt-textarea'},'Original question');editor.onEvent=e=>{if(e.type==='input')editor._value='Original question';};
 assert.equal(injector(dom([editor]))('Selected material').status,'no-editor');
 assert.equal(editor.value,'Original question');
});

test('cold composer replacement is detected before writing and can be retried safely',async()=>{
 const editor=new Textarea({id:'prompt-textarea'}),fixture=dom([editor]);let waits=0;
 fixture.document.defaultView.setTimeout=callback=>{waits++;editor.isConnected=false;callback();};
 const result=await injector(fixture)('Selected material');
 assert.equal(result.status,'no-editor');assert.equal(result.retryable,true);assert.equal(editor.nativeWrites,0);assert.equal(waits,1);
});

test('framework hydration restoring the exact original draft permits a bounded retry',()=>{
 const editor=new Textarea({id:'prompt-textarea'},'Original question');editor.onEvent=e=>{if(e.type==='input')editor._value='Original question';};
 const result=injector(dom([editor]))('Selected material');assert.equal(result.retryable,true);
 editor.onEvent=null;assert.equal(injector(dom([editor]))('Selected material').status,'injected');
 assert.equal(editor.value.split('Selected material').length,2);
});

test('partially changed text never permits an automatic write retry',()=>{
 const editor=new Textarea({id:'prompt-textarea'},'Original question');editor.onEvent=e=>{if(e.type==='input')editor._value='Changed while sending';};
 const result=injector(dom([editor]))('Selected material');assert.equal(result.status,'no-editor');assert.notEqual(result.retryable,true);assert.equal(editor.value,'Changed while sending');
});
test('current ChatGPT markdown composer is recognized without a legacy id or test id',()=>{
 const editor=new Element('div',{contenteditable:'true',role:'textbox','aria-multiline':'true',class:'ProseMirror','data-composer-markdown':'','aria-label':'Ask ChatGPT'});
 const draft=new Element('p',{},'Keep this question.');editor.appendChild(draft);
 const body=new Element('div',{'data-composer-body':''}),input=new Element('div',{'data-composer-input':''});body.appendChild(input);input.appendChild(editor);
 const legacy=new Textarea({id:'prompt-textarea'});legacy.hidden=true;
 const insert=injector(dom([editor,legacy]));
 assert.equal(insert('Selected assignment instructions').status,'injected');
 assert.equal(editor.children[0],draft);assert.ok(editor.innerText.startsWith('Keep this question.'));
 const first=editor.innerText;assert.equal(insert('Selected assignment instructions').status,'injected');assert.equal(editor.innerText,first);
 assert.equal(legacy.nativeWrites,0);
});
test('browser paragraph line breaks do not duplicate rich ChatGPT context on retry',()=>{
 const editor=new Element('div',{contenteditable:'true',role:'textbox','data-composer-markdown':''},'Question');new Element('div',{'data-composer-body':''}).appendChild(editor);
 const raw=()=>editor._text+editor.children.map(n=>n.textContent).join('');
 Object.defineProperty(editor,'textContent',{get(){return raw().replace(/\n/g,'');}});
 Object.defineProperty(editor,'innerText',{get(){return raw().replace(/\n/g,'\n\n');}});
 const insert=injector(dom([editor]));
 assert.equal(insert('First line\nSecond line').status,'injected');const first=editor.innerText;
 assert.equal(insert('First line\nSecond line').status,'injected');assert.equal(editor.innerText,first);
 assert.equal(editor.events.filter(e=>e.type==='input').length,1);
});
test('modern ChatGPT matching is scoped to its composer and independent of translated labels',()=>{
 const attrs={contenteditable:'true',role:'textbox','data-composer-markdown':'','aria-label':'Pregunta a ChatGPT'};
 const unrelated=new Element('div',attrs,'Untouched document');
 assert.equal(injector(dom([unrelated]))('Context').status,'no-editor');
 assert.equal(unrelated.innerText,'Untouched document');
 const editor=new Element('div',attrs,'Question');new Element('div',{'data-composer-body':''}).appendChild(editor);
 assert.equal(injector(dom([editor,unrelated]))('Context').status,'injected');
 assert.equal(unrelated.innerText,'Untouched document');
});
test('current ChatGPT composer retains search, dialog, and authentication exclusions',()=>{
 for(const wrapper of [{role:'search'},{role:'dialog'}]){
  const editor=new Element('div',{contenteditable:'true',role:'textbox','data-composer-markdown':''},'Keep');
  const body=new Element('div',{'data-composer-body':''});body.appendChild(editor);new Element('div',wrapper).appendChild(body);
  assert.equal(injector(dom([editor]))('Context').status,'no-editor');assert.equal(editor.innerText,'Keep');
 }
 const editor=new Element('div',{contenteditable:'true',role:'textbox','data-composer-markdown':''},'Keep');new Element('div',{'data-composer-body':''}).appendChild(editor);
 const email=new Element('input',{type:'email'});Object.defineProperty(email,'value',{get(){throw Error('Do not read credentials');}});
 assert.equal(injector(dom([editor,email]))('Context').status,'no-editor');assert.equal(editor.innerText,'Keep');
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
 for(const text of ['',null,' '.repeat(3),'x'.repeat(2100001)])assert.equal(insert(text).status,'error');
 assert.equal(insert('context',{id:'chatgpt',origin:'https://evil.test',expectedURL:'https://chatgpt.com/'}).status,'error');
 assert.equal(insert('context',{id:'chatgpt',origin:'https://chatgpt.com',expectedURL:'https://chatgpt.com/c/another'}).status,'error');
 assert.equal(editor.nativeWrites,0);
});
test('the text size boundary is accepted but composer maxlength cannot truncate an existing draft',()=>{
 const editor=new Textarea({id:'prompt-textarea'},'My draft');editor.maxLength=20;
 assert.equal(injector(dom([editor]))('A longer reference').status,'no-editor');assert.equal(editor.value,'My draft');
 editor.maxLength=-1;assert.equal(injector(dom([editor]))('x'.repeat(140000)).status,'injected');assert.ok(editor.value.startsWith('My draft'));
});

function webHarness({granted=true,failPopup=false,clock}={}){
 const stored={},tabs=new Map(),calls=[],sender={id:'extension-id',tab:{id:12},frameId:0};let nextId=100;
 const chrome={runtime:{id:'extension-id',getURL:p=>'chrome-extension://extension-id/'+p},storage:{session:{async get(key){return {[key]:structuredClone(stored[key])};},async set(values){Object.assign(stored,structuredClone(values));},async remove(key){delete stored[key];}}},permissions:{async contains(details){calls.push(['contains',details]);return granted;},async request(){throw new Error('Permission request requires the separate page');}},tabs:{async create(details){calls.push(['tab-create',details]);const tab={id:nextId++,windowId:5,url:details.url};tabs.set(tab.id,tab);return {...tab};},async get(id){calls.push(['get',id]);if(!tabs.has(id))throw new Error('Tab closed');return {...tabs.get(id)};},async update(id,details){calls.push(['update',id,details]);if(!tabs.has(id))throw new Error('Tab closed');return {...tabs.get(id)};},async query(){throw new Error('Must not reuse random tabs');}},windows:{async create(details){calls.push(['window-create',details]);if(failPopup)throw new Error('Popup unavailable');const tab={id:nextId++,windowId:nextId++,url:details.url};tabs.set(tab.id,tab);return {id:tab.windowId,tabs:[{...tab}]};},async update(id,details){calls.push(['window-update',id,details]);return {id};}},scripting:{async executeScript(details){calls.push(['execute',details]);return [{frameId:0,result:{status:'injected',message:'Review your draft.'}}];}}};
 const sourceTabs=new Map([[12,{id:12,windowId:5,index:2,incognito:false}],[13,{id:13,windowId:5,index:3,incognito:false}]]);
 const windows=new Map([[5,{id:5,type:'normal',incognito:false}],[9,{id:9,type:'popup',incognito:false}]]);
 const get=chrome.tabs.get;
 chrome.tabs.get=async id=>sourceTabs.has(id)?{...sourceTabs.get(id)}:get(id);
 chrome.tabs.create=async details=>{
  calls.push(['tab-create',details]);
  const windowId=details.windowId??9; // A provider app was last focused.
  const tab={id:nextId++,windowId,url:details.url,incognito:Boolean(windows.get(windowId)?.incognito)};
  tabs.set(tab.id,tab);return {...tab};
 };
 chrome.tabs.update=async(id,details)=>{calls.push(['update',id,details]);if(!tabs.has(id))throw Error('Tab closed');Object.assign(tabs.get(id),details);return {...tabs.get(id)};};
 chrome.windows.get=async id=>{calls.push(['window-get',id]);if(!windows.has(id))throw Error('Window closed');return {...windows.get(id)};};
 chrome.windows.create=async details=>{
  calls.push(['window-create',details]);if(failPopup)throw Error('Window unavailable');
  const win={id:nextId++,type:details.type,incognito:Boolean(details.incognito)};
  windows.set(win.id,win);const tab={id:nextId++,windowId:win.id,url:details.url,incognito:win.incognito};tabs.set(tab.id,tab);
  return {...win,tabs:[{...tab}]};
 };
 const context=vm.createContext({chrome,URL,...(clock?{setTimeout:clock}:{})});context.importScripts=(...files)=>{for(const file of files)vm.runInContext(source(file),context);};
 vm.runInContext(source('ai-web.js'),context);
 const handle=(action,provider='chatgpt',text,customSender=sender,extra={},options={})=>context.CanvasHarnessWeb.handle({type:'ch-ai-web',action,provider,text,...extra},customSender,options);
 return {handle,chrome,calls,stored,tabs,sender,windows,sourceTabs,grant(value){granted=value;}};
}

test('automatic web insertion creates and navigates a background tab without activating a window',async()=>{const h=webHarness();assert.equal((await h.handle('inject','chatgpt','Automatic question',h.sender,{automatic:true})).status,'injected');assert.equal(h.calls.find(c=>c[0]==='tab-create')[1].active,false);assert.equal(h.calls.some(c=>c[0]==='update'&&c[2].active===true),false);assert.equal(h.calls.some(c=>c[0]==='window-update'),false);});
test('automatic insertion into an existing provider tab preserves foreground focus',async()=>{const h=webHarness();await h.handle('open');h.calls.length=0;assert.equal((await h.handle('inject','chatgpt','Automatic follow-up',h.sender,{automatic:true})).status,'injected');assert.equal(h.calls.some(c=>c[0]==='tab-create'||c[0]==='window-update'||c[0]==='update'&&c[2].active===true),false);});
test('an automatic run from an app opens its browser window without focusing it',async()=>{const h=webHarness();h.sourceTabs.get(12).windowId=9;assert.equal((await h.handle('inject','chatgpt','Automatic question',h.sender,{automatic:true})).status,'injected');assert.equal(h.calls.find(c=>c[0]==='window-create')[1].focused,false);assert.equal(h.calls.some(c=>c[0]==='window-update'),false);});
test('requested web insertion still activates its provider tab and window',async()=>{const h=webHarness();assert.equal((await h.handle('inject','chatgpt','Requested question',h.sender,{automatic:false})).status,'injected');assert.equal(h.calls.find(c=>c[0]==='tab-create')[1].active,true);assert.ok(h.calls.some(c=>c[0]==='window-update'&&c[2].focused===true));});
test('the final asynchronous consent gate runs before provider insertion',async()=>{const h=webHarness();const result=await h.handle('inject','chatgpt','Private context',h.sender,{}, {beforeSend:async()=>{throw Error('Consent changed');}});assert.equal(result.status,'error');assert.equal(h.calls.some(c=>c[0]==='execute'),false);});

test('website launch stays in the live Canvas window even when an app was last focused',async()=>{
 const h=webHarness();h.sourceTabs.get(12).windowId=6;h.windows.set(6,{id:6,type:'normal',incognito:false});
 assert.equal((await h.handle('inject','chatgpt','Synthetic question only')).status,'injected');
 const created=h.calls.find(c=>c[0]==='tab-create')[1];assert.equal(created.windowId,6);assert.equal(created.openerTabId,12);
 assert.equal(created.url,'about:blank');
 const navigation=h.calls.find(c=>c[0]==='update'&&c[2].url);assert.equal(navigation[2].url,'https://chatgpt.com/');
 assert.equal(h.calls.find(c=>c[0]==='execute')[1].target.tabId,navigation[1]);
 assert.equal(h.calls.some(c=>c[0]==='window-update'&&c[1]===9),false);
});

test('Canvas inside an app gets a normal browser window with matching private mode',async()=>{
 const h=webHarness();h.sourceTabs.get(12).windowId=9;h.sourceTabs.get(12).incognito=true;h.windows.get(9).incognito=true;
 assert.equal((await h.handle('inject','chatgpt','Synthetic context')).status,'injected');
 const created=h.calls.find(c=>c[0]==='window-create')[1];assert.equal(created.type,'normal');assert.equal(created.incognito,true);
 assert.equal(created.url,'about:blank');assert.equal(h.calls.some(c=>c[0]==='tab-create'),false);
});

test('an existing provider tab moved into an app is never focused or injected',async()=>{
 const h=webHarness();await h.handle('open');const first=[...h.tabs.values()][0];first.windowId=9;h.calls.length=0;
 const result=await h.handle('inject','chatgpt','Private draft');assert.equal(result.status,'error');assert.match(result.message,/browser tab|window/i);
 assert.equal(h.calls.some(c=>c[0]==='execute'||c[0]==='update'||c[0]==='window-update'),false);
 assert.equal((await h.handle('open')).status,'opened');assert.equal(h.tabs.size,2);assert.equal(first.windowId,9);
});

test('a source that disappeared never falls back to the last focused app',async()=>{
 const h=webHarness();h.sourceTabs.delete(12);
 assert.equal((await h.handle('open')).status,'error');assert.equal(h.calls.some(c=>['tab-create','window-create','execute'].includes(c[0])),false);
});

test('a newly created tab intercepted into an app is rejected before navigating or storing a target',async()=>{
 const h=webHarness(),create=h.chrome.tabs.create;
 h.chrome.tabs.create=async details=>{const tab=await create(details);h.tabs.get(tab.id).windowId=9;return {...tab,windowId:9};};
 assert.equal((await h.handle('inject','chatgpt','Private material')).status,'error');
 assert.equal(h.calls.some(c=>c[0]==='execute'||c[0]==='update'),false);assert.equal(Object.keys(h.stored).length,0);
});

test('permission pages use the source browser window and never contain the draft',async()=>{
 const h=webHarness({granted:false});await h.handle('inject','chatgpt','Private draft');
 const permission=h.calls.find(c=>c[0]==='tab-create')[1];assert.equal(permission.windowId,5);
 assert.equal(JSON.stringify(h.stored).includes('Private draft'),false);
});

test('moving a provider into an app while it is focused cancels insertion',async()=>{
 const h=webHarness();await h.handle('open');const update=h.chrome.tabs.update;
 h.chrome.tabs.update=async(id,details)=>{const result=await update(id,details);h.tabs.get(id).windowId=9;return result;};
 assert.equal((await h.handle('inject','chatgpt','Private draft')).status,'error');
 assert.equal(h.calls.some(c=>c[0]==='execute'),false);
});

test('failure to create a browser window never falls back to a provider app',async()=>{
 const h=webHarness({failPopup:true});h.sourceTabs.get(12).windowId=9;
 assert.equal((await h.handle('inject','chatgpt','Private draft')).status,'error');
 assert.equal(h.tabs.size,0);assert.equal(h.calls.some(c=>c[0]==='execute'||c[0]==='tab-create'),false);
});
test('one explicit Inject opens a normal provider tab and inserts without a separate Open action',async()=>{
 const h=webHarness();assert.equal((await h.handle('inject','chatgpt','My question\nSelected reference')).status,'injected');
 assert.equal(h.calls.filter(c=>c[0]==='tab-create').length,1);
 assert.equal(h.calls.filter(c=>c[0]==='window-create').length,0);
 assert.equal(h.calls.filter(c=>c[0]==='execute').length,1);
 assert.ok(!JSON.stringify(h.stored).includes('Selected reference'));
 assert.equal(h.calls.find(c=>c[0]==='tab-create')[1].url,'about:blank');
 assert.equal(h.calls.find(c=>c[0]==='update'&&c[2].url)[2].url,'https://chatgpt.com/');
});
test('Inject waits for the fresh website and its composer without repeatedly stealing focus',async()=>{
 let ticks=0,executions=0;
 const h=webHarness({clock(callback,ms){assert.equal(ms,500);ticks++;for(const tab of h.tabs.values())tab.status='complete';queueMicrotask(callback);}});
 const create=h.chrome.tabs.create;
 h.chrome.tabs.create=async details=>{const tab=await create(details);h.tabs.get(tab.id).status='loading';return tab;};
 h.chrome.scripting.executeScript=async()=>[{frameId:0,result:++executions===1?{status:'no-editor',message:'Loading composer',retryable:true}:{status:'injected',message:'Ready to review'}}];
 assert.equal((await h.handle('inject','chatgpt','Question with selected material')).status,'injected');
 assert.equal(ticks,2);assert.equal(executions,2);
 assert.equal(h.calls.filter(c=>c[0]==='update'&&!c[2].url).length,1);
 assert.equal(h.calls.filter(c=>c[0]==='tab-create').length,1);
 assert.ok(!JSON.stringify(h.stored).includes('selected material'));
});
test('missing composer retries are bounded and leave no stored context or scheduled insertion',async()=>{
 let ticks=0,executions=0;
 const h=webHarness({clock(callback){ticks++;queueMicrotask(callback);}});
 h.chrome.scripting.executeScript=async()=>{executions++;return [{frameId:0,result:{status:'no-editor',message:'Still loading',retryable:true}}];};
 assert.equal((await h.handle('inject','chatgpt','Temporary context')).status,'no-editor');
 assert.equal(executions,40);assert.equal(ticks,39);
 assert.equal(h.calls.filter(c=>c[0]==='update'&&!c[2].url).length,1);
 assert.ok(!JSON.stringify(h.stored).includes('Temporary context'));
 await Promise.resolve();assert.equal(executions,40);
});
test('launcher creates only controlled normal provider tabs and reuses by source Canvas tab plus provider',async()=>{
 const h=webHarness();assert.equal((await h.handle('open')).status,'opened');assert.equal((await h.handle('open')).status,'opened');
 assert.equal(h.calls.filter(c=>c[0]==='tab-create').length,1);
 await h.handle('open','claude');await h.handle('open','chatgpt',undefined,{...h.sender,tab:{id:13}});
 assert.equal(h.calls.filter(c=>c[0]==='tab-create').length,3);
 assert.equal(h.calls.some(c=>c[0]==='window-create'),false);
 assert.equal(h.calls.filter(c=>c[0]==='execute').length,0);
 assert.equal(Object.keys(h.stored).length,3);
});
test('concurrent opens share one controlled normal tab',async()=>{
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
 const permission=h.calls.find(c=>c[0]==='tab-create'&&c[1].url.includes('ai-permission.html'))[1];const url=new URL(permission.url);
 assert.equal(url.pathname,'/ai-permission.html');assert.equal(url.search,'?provider=chatgpt');assert.equal(url.hash,'');
 assert.ok(!JSON.stringify(h.stored).includes('TOP SECRET'));assert.equal(h.calls.filter(c=>c[0]==='execute').length,0);
 await h.handle('inject','chatgpt','different context');assert.equal(h.calls.filter(c=>c[0]==='tab-create'&&c[1].url.includes('ai-permission.html')).length,1);
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
test('web entry rejects text beyond 2100000 characters before any browser side effect',async()=>{
 const h=webHarness();assert.equal((await h.handle('inject','chatgpt','x'.repeat(2100001))).status,'error');assert.equal(h.calls.length,0);
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

test('opt-in automatic send clicks once after verified insertion and guards repeated clicks',async()=>{
 const editor=new Textarea({id:'prompt-textarea'}),button=new Element('button',{'aria-label':'Send',type:'submit'});let clicks=0;
 button.click=()=>{clicks++;editor._value='';};const insert=injector(dom([editor,button]));
 const provider={id:'chatgpt',origin:'https://chatgpt.com',expectedURL:'https://chatgpt.com/',autoSend:true};
 assert.equal((await insert('Question one',provider)).status,'sent');assert.equal(clicks,1);
 assert.equal((await insert('Question one',provider)).status,'send-uncertain');assert.equal(clicks,1);assert.equal(editor.value,'');
 assert.equal((await insert('Question two',provider)).status,'sent');assert.equal(clicks,2);
});
test('automatic send protects existing drafts, disabled buttons and ambiguous send controls',async()=>{
 const provider={id:'chatgpt',origin:'https://chatgpt.com',expectedURL:'https://chatgpt.com/',autoSend:true};
 for(const mode of ['existing','disabled','ambiguous','off']){
  const editor=new Textarea({id:'prompt-textarea'},mode==='existing'?'Unrelated unsent draft':''),button=new Element('button',{'aria-label':'Send',type:'submit'});let clicks=0;button.click=()=>{clicks++;};button.disabled=mode==='disabled';
  const nodes=[editor,button];if(mode==='ambiguous')nodes.push(new Element('button',{'aria-label':'Send',type:'submit'}));
  const result=await injector(dom(nodes))('Question',{...provider,autoSend:mode!=='off'});
  assert.equal(result.status,'injected',mode);assert.equal(clicks,0,mode);assert.ok(editor.value.includes('Question'));
 }
});
test('a draft left over from earlier Canvas Harness questions is replaced and sent; student text still blocks auto-send',async()=>{
 const provider={id:'chatgpt',origin:'https://chatgpt.com',expectedURL:'https://chatgpt.com/',autoSend:true};
 const old='\n\n\n[[Canvas Harness agent 1c92487e-b0]]\n[[Canvas Harness context 9a1f-12-1c92487e-b0]]\nOld question\n[[End Canvas Harness context 9a1f-12-1c92487e-b0]]\n\n[[Canvas Harness context 77b-3]]\nOld\n[[End Canvas Harness context 77b-3]]';
 for(const kind of ['textarea','rich']){
  const editor=kind==='textarea'?new Textarea({id:'prompt-textarea'},old):new Element('div',{contenteditable:'true',role:'textbox','data-composer-markdown':''},old);
  if(kind==='rich')new Element('div',{'data-composer-body':''}).appendChild(editor);
  const read=()=>kind==='textarea'?editor.value:editor.innerText,clear=()=>{if(kind==='textarea')editor._value='';else editor.textContent='';};
  const button=new Element('button',{'aria-label':'Send',type:'submit'});let clicks=0;button.click=()=>{clicks++;clear();};
  const result=await injector(dom([editor,button]))('New question',provider);
  assert.equal(result.status,'sent',kind);assert.equal(clicks,1,kind);
 }
 for(const draft of [old+'\nmy own note','my own note '+old]){
  const editor=new Textarea({id:'prompt-textarea'},draft),button=new Element('button',{'aria-label':'Send',type:'submit'});let clicks=0;button.click=()=>{clicks++;};
  const result=await injector(dom([editor,button]))('New question',provider);
  assert.equal(result.status,'injected');assert.equal(clicks,0);assert.ok(editor.value.startsWith(draft));assert.ok(editor.value.includes('New question'));
 }
 const editor=new Textarea({id:'prompt-textarea'},old);await injector(dom([editor]))('New question',{...provider,autoSend:false});
 assert.ok(!editor.value.includes('Old question'));assert.ok(editor.value.includes('New question'));
});
test('a composer that turns links into separate lines still counts as keeping the draft and auto-sends it',async()=>{
 const editor=new Element('div',{contenteditable:'true',role:'textbox','data-composer-markdown':''});new Element('div',{'data-composer-body':''}).appendChild(editor);
 const raw=()=>editor._text+editor.children.map(n=>n.textContent).join('');
 Object.defineProperty(editor,'innerText',{get(){return raw().replace(/\(https:/g,'(\nhttps:').replace(/\n/g,'\n\n');}});
 const button=new Element('button',{'aria-label':'Send',type:'submit'});let clicks=0;button.click=()=>{clicks++;editor.textContent='';};
 const result=await injector(dom([editor,button]))('Read [the handout](https://school.instructure.com/courses/1/files/2) first',{id:'chatgpt',origin:'https://chatgpt.com',expectedURL:'https://chatgpt.com/',autoSend:true});
 assert.equal(result.status,'sent',result.message);assert.equal(clicks,1);
});
test('a long sent message that the site shows cut short and formatted still confirms the send, but only for the same text',async()=>{
 const text='Plan **this week**\n- read chapter 2\n'+'Course material line. '.repeat(4000);let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619)>>>0;
 const turnId='turn-1234abcd',key=hash.toString(16)+'-'+text.length+'-'+turnId,shown='[[Canvas Harness agent '+turnId+']] [[Canvas Harness context '+key+']] Plan this week read chapter 2 '+text.slice(40,9000);
 const run=bubbleText=>{const bubble=new Element('div',{'data-user-message-bubble':'true'},bubbleText);const fixture=dom([bubble]);const context=vm.createContext(fixture);vm.runInContext(source('ai-inject.js'),context);
  return vm.runInContext('('+String(context.CanvasHarnessInject.inspectTurn)+')(__g)',vm.createContext({...fixture,__g:{id:'chatgpt',origin:'https://chatgpt.com',expectedURL:'https://chatgpt.com/',turnId,text,kind:'agent'}}));};
 assert.equal(run(shown).status,'sent');
 assert.notEqual(run(shown.replace(key,'0badf00d-'+text.length+'-'+turnId)).status,'sent','a different text with the same turn id is not this send');
});
test('a click with unconfirmed delivery is never automatically retried',async()=>{
 const editor=new Textarea({id:'prompt-textarea'}),button=new Element('button',{'aria-label':'Send',type:'submit'});let clicks=0;button.click=()=>clicks++;
 const insert=injector(dom([editor,button])),provider={id:'chatgpt',origin:'https://chatgpt.com',expectedURL:'https://chatgpt.com/',autoSend:true};
 assert.equal((await insert('Question',provider)).status,'send-uncertain');assert.equal((await insert('Question',provider)).status,'send-uncertain');assert.equal(clicks,1);
});
