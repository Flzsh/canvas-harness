'use strict';
// Hand-written pages of the eight AI websites AI help offers (ChatGPT, Claude, Gemini, Grok, DeepSeek, Kimi, Qwen,
// Z.ai): each signed in, signed out, at its usage limit, with an answer streaming and with an answer done. They are
// written from the selectors already in extension/ai-inject.js and from what each site is known to show; none was
// fetched, and none is a copy of a real page. A site marked look:true needs a live look (W report checklist) before
// its signed-out and limit pages can be trusted as today's.
// The page runs the real serialized functions of ai-inject.js in a vm, on a small DOM double: a short HTML parser,
// the CSS selectors those functions use (lists, descendants, tag, #id, .class, [attr], = *= ^= $= and the i flag),
// visibility, text, a textarea value, contenteditable insertion and clicks. No network, no real site.
const vm=require('node:vm');

class Text{constructor(data){this.nodeType=3;this.data=String(data);this.parentNode=null;}get textContent(){return this.data;}set textContent(v){this.data=String(v);}get parentElement(){return this.parentNode;}}
class Element{
 constructor(tag,attrs={}){this.nodeType=1;this.tagName=String(tag).toUpperCase();this.attrs={...attrs};this.childNodes=[];this.parentNode=null;this.events=[];this.clicks=0;}
 get parentElement(){return this.parentNode instanceof Element?this.parentNode:null;}
 get children(){return this.childNodes.filter(n=>n.nodeType===1);}
 getAttribute(name){return Object.hasOwn(this.attrs,name)?this.attrs[name]:null;}
 setAttribute(name,value){this.attrs[name]=String(value);}
 hasAttribute(name){return Object.hasOwn(this.attrs,name);}
 removeAttribute(name){delete this.attrs[name];}
 get id(){return this.attrs.id||'';}
 get className(){return this.attrs.class||'';}
 get hidden(){return this.hasAttribute('hidden');}
 get disabled(){return this.hasAttribute('disabled');}
 get readOnly(){return this.hasAttribute('readonly');}
 get href(){try{return new URL(this.attrs.href||'',this.ownerDocument?.location?.href).href;}catch{return '';}}
 get isContentEditable(){for(let n=this;n;n=n.parentElement){const v=n.getAttribute('contenteditable');if(v==='true'||v==='')return true;if(v==='false')return false;}return false;}
 get isConnected(){let n=this;while(n.parentNode)n=n.parentNode;return !!this.ownerDocument&&n===this.ownerDocument.documentElement;}
 get textContent(){return this.childNodes.map(n=>n.textContent).join('');}
 set textContent(value){for(const n of this.childNodes)n.parentNode=null;this.childNodes=[];if(String(value))this.appendChild(new Text(value));}
 get innerText(){const shown=n=>n.nodeType===3?n.data:n.nodeType===1&&!n.hidden&&n.style().display!=='none'?n.childNodes.map(shown).join(''):'';return this.childNodes.map(shown).join('');}
 style(){const s=String(this.attrs.style||'');return {display:/display\s*:\s*none/i.test(s)?'none':'block',visibility:/visibility\s*:\s*hidden/i.test(s)?'hidden':'visible'};}
 appendChild(child){if(child.parentNode)child.parentNode.childNodes=child.parentNode.childNodes.filter(n=>n!==child);child.parentNode=this;this.childNodes.push(child);adopt(child,this.ownerDocument);return child;}
 remove(){if(this.parentNode)this.parentNode.childNodes=this.parentNode.childNodes.filter(n=>n!==this);this.parentNode=null;}
 contains(other){for(let n=other;n;n=n.parentNode)if(n===this)return true;return false;}
 descendants(){const out=[];const walk=n=>{for(const c of n.childNodes)if(c.nodeType===1){out.push(c);walk(c);}};walk(this);return out;}
 compareDocumentPosition(other){const all=[this.ownerDocument.documentElement,...this.ownerDocument.documentElement.descendants()],a=all.indexOf(this),b=all.indexOf(other);return b>a?4|(this.contains(other)?16:0):2|(other.contains(this)?8:0);}
 querySelectorAll(selector){const list=parseList(selector);return this.descendants().filter(n=>list.some(s=>matchComplex(n,s)));}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 matches(selector){return parseList(selector).some(s=>matchComplex(this,s));}
 closest(selector){const list=parseList(selector);for(let n=this;n;n=n.parentElement)if(list.some(s=>matchComplex(n,s)))return n;return null;}
 getClientRects(){for(let n=this;n;n=n.parentElement)if(n.hidden||n.style().display==='none')return [];return [{width:200,height:24}];}
 focus(){if(this.ownerDocument)this.ownerDocument.activeElement=this;}
 dispatchEvent(event){this.events.push(event);return !event.defaultPrevented;}
 click(){this.clicks++;if(typeof this.onclick==='function')this.onclick();}
}
class Textarea extends Element{
 constructor(attrs={}){super('textarea',attrs);this._value='';this.maxLength=-1;}
 get value(){return this._value;}
 set value(v){this._value=String(v);}
 get textContent(){return this._value;}
 set textContent(v){this._value=String(v);}
 setSelectionRange(){}
}
function adopt(node,doc){node.ownerDocument=doc;for(const c of node.childNodes||[])adopt(c,doc);}

// Selectors: a list of complex selectors; each is compounds joined by descendant spaces.
const cache=new Map();
function parseList(text){
 if(cache.has(text))return cache.get(text);
 const parts=[];let depth=0,quote='',start=0;
 for(let i=0;i<text.length;i++){const c=text[i];if(quote){if(c===quote)quote='';continue;}if(c==='"'||c==='\'')quote=c;else if(c==='[')depth++;else if(c===']')depth--;else if(c===','&&!depth){parts.push(text.slice(start,i));start=i+1;}}
 parts.push(text.slice(start));
 const list=parts.map(p=>p.trim()).filter(Boolean).map(parseComplex);cache.set(text,list);return list;
}
function parseComplex(text){
 const compounds=[];let i=0;
 while(i<text.length){
  while(text[i]===' ')i++;if(i>=text.length)break;
  const c={tag:'',ids:[],classes:[],attrs:[]};
  while(i<text.length&&text[i]!==' '){
   const rest=text.slice(i);let m;
   if((m=/^[a-zA-Z][\w-]*/.exec(rest))&&!c.tag&&!c.ids.length&&!c.classes.length&&!c.attrs.length){c.tag=m[0].toUpperCase();i+=m[0].length;}
   else if((m=/^#([\w-]+)/.exec(rest))){c.ids.push(m[1]);i+=m[0].length;}
   else if((m=/^\.([\w-]+)/.exec(rest))){c.classes.push(m[1]);i+=m[0].length;}
   else if((m=/^\[\s*([\w:-]+)\s*(?:([*^$~|]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+))\s*(i)?)?\s*\]/.exec(rest))){c.attrs.push({name:m[1],op:m[2]||'',value:m[3]??m[4]??m[5]??'',fold:!!m[6]});i+=m[0].length;}
   else throw Error('Selector the page double does not know: '+text);
  }
  compounds.push(c);
 }
 return compounds;
}
function matchCompound(n,c){
 if(c.tag&&n.tagName!==c.tag)return false;
 for(const id of c.ids)if(n.getAttribute('id')!==id)return false;
 const classes=String(n.getAttribute('class')||'').split(/\s+/);for(const k of c.classes)if(!classes.includes(k))return false;
 for(const a of c.attrs){let v=n.getAttribute(a.name);if(v===null)return false;if(!a.op)continue;let want=a.value;if(a.fold){v=v.toLowerCase();want=want.toLowerCase();}
  if(a.op==='='&&v!==want||a.op==='*='&&!v.includes(want)||a.op==='^='&&!v.startsWith(want)||a.op==='$='&&!v.endsWith(want)||a.op==='~='&&!v.split(/\s+/).includes(want))return false;}
 return true;
}
function matchComplex(n,compounds){
 if(!matchCompound(n,compounds.at(-1)))return false;
 let at=n.parentElement;
 for(let i=compounds.length-2;i>=0;i--){while(at&&!matchCompound(at,compounds[i]))at=at.parentElement;if(!at)return false;at=at.parentElement;}
 return true;
}

// A short HTML parser for these hand-written pages (no scripts, no styles, quoted attributes).
const VOID=new Set(['input','br','img','hr','meta']);
const decode=s=>String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,'\'').replace(/&amp;/g,'&');
function parse(html,doc){
 const root=new Element('body');root.ownerDocument=doc;const stack=[root];
 const tokens=/<!--[\s\S]*?-->|<\/([\w-]+)\s*>|<([\w-]+)((?:\s+[\w:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>|([^<]+)/g;let m;
 while((m=tokens.exec(html))){
  if(m[1]){const tag=m[1].toUpperCase();while(stack.length>1&&stack.at(-1).tagName!==tag)stack.pop();if(stack.length>1)stack.pop();continue;}
  if(m[2]){const attrs={};for(const a of (m[3]||'').matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[a[1]]=decode(a[2]??a[3]??a[4]??'');
   const el=m[2].toLowerCase()==='textarea'?new Textarea(attrs):new Element(m[2],attrs);stack.at(-1).appendChild(el);if(!VOID.has(m[2].toLowerCase()))stack.push(el);continue;}
  if(m[4]&&m[4].trim())stack.at(-1).appendChild(new Text(decode(m[4])));
 }
 return root;
}

class DraftEvent{constructor(type,options={}){this.type=type;Object.assign(this,options);this.defaultPrevented=false;}preventDefault(){if(this.cancelable)this.defaultPrevented=true;}}

// The eight sites. composer/send/user/assistant/stop follow ai-inject.js; out and limit are each site's signed-out and
// usage-limit page as far as is known without a live look.
const SITES={
 chatgpt:{label:'ChatGPT',start:'https://chatgpt.com/?temporary-chat=true',chat:null,
  composer:'<div id="prompt-textarea" contenteditable="true" role="textbox"></div>',send:'<button data-testid="send-button" aria-label="Send prompt">Send</button>',
  user:t=>'<div data-message-author-role="user"><div class="whitespace-pre-wrap">'+t+'</div></div>',assistant:t=>'<div data-message-author-role="assistant"><div class="markdown">'+t+'</div></div>',
  stop:'<button data-testid="stop-button" aria-label="Stop streaming">Stop</button>',account:'<button aria-label="Open profile menu">S</button>',
  out:{controls:'<button data-testid="login-button">Log in</button><button data-testid="signup-button">Sign up for free</button>'},
  limit:{notice:'<div class="text-token-text-error">You\'ve reached our limit of messages per hour. Please try again later.</div>',where:'composer'},look:true},
 claude:{label:'Claude',start:'https://claude.ai/new?incognito',chat:'https://claude.ai/chat/0f3a9c2e-1b7d-4e55-a1c2-77aa00bb11cc',
  composer:'<div class="ProseMirror" contenteditable="true" data-placeholder="How can I help you today?"></div>',send:'<button aria-label="Send message">Send</button>',
  user:t=>'<div data-testid="user-message">'+t+'</div>',assistant:t=>'<div data-testid="assistant-message">'+t+'</div>',
  stop:'<button aria-label="Stop response">Stop</button>',account:'<button data-testid="user-menu-button">S</button>',
  out:{url:'https://claude.ai/login',page:'<main><h1>Log in or sign up</h1><form><input type="email" autocomplete="email" placeholder="Enter your email"><button>Continue with email</button></form></main>'},
  limit:{notice:'<div class="text-sm">You are out of free messages until 4:00 PM</div>',where:'composer'},look:true},
 gemini:{label:'Gemini',start:'https://gemini.google.com/app',chat:'https://gemini.google.com/app/1a2b3c4d5e6f7a8b',
  composer:'<rich-textarea><div class="ql-editor" contenteditable="true" role="textbox"></div></rich-textarea>',send:'<button class="send-button" aria-label="Send message">Send</button>',
  user:t=>'<user-query><div class="query-text">'+t+'</div></user-query>',assistant:t=>'<model-response><message-content>'+t+'</message-content></model-response>',
  stop:'<button class="stop" aria-label="Stop response">Stop</button>',account:'<a href="https://accounts.google.com/SignOutOptions?hl=en" aria-label="Google Account">S</a>',
  out:{controls:'<a href="https://accounts.google.com/ServiceLogin?passive=true&amp;continue=https://gemini.google.com/app">Sign in</a>'},
  limit:{notice:'<div role="alert">You\'ve reached your limit for this model until 5:00 PM. Try again later.</div>',where:'top'},look:true},
 grok:{label:'Grok',start:'https://grok.com/',chat:'https://grok.com/c/5e2b7c1a-9d3f-4c11-8e00-123456789abc',
  composer:'<textarea aria-label="Ask Grok" placeholder="What do you want to know?"></textarea>',send:'<button aria-label="Submit">Send</button>',
  user:t=>'<div data-message-author-role="user">'+t+'</div>',assistant:t=>'<div data-message-author-role="assistant">'+t+'</div>',
  stop:'<button aria-label="Stop model response">Stop</button>',account:'<button aria-label="Account">S</button>',
  out:{controls:'<a href="/sign-in">Sign in</a><a href="/sign-up">Sign up</a>'},
  limit:{notice:'<div class="toast">You\'ve reached your limit of 15 questions per 2 hours for now.</div>',where:'top'},look:true},
 deepseek:{label:'DeepSeek',start:'https://chat.deepseek.com/',chat:'https://chat.deepseek.com/a/chat/s/7c1d2e3f-4a5b-6c7d-8e9f-0a1b2c3d4e5f',
  composer:'<textarea id="chat-input" placeholder="Message DeepSeek"></textarea>',send:'<button aria-label="Send message">Send</button>',
  user:t=>'<div class="ds-message" data-role="user">'+t+'</div>',assistant:t=>'<div class="ds-message ds-message--assistant">'+t+'</div>',
  stop:'<button aria-label="Stop generating">Stop</button>',account:'<button aria-label="Profile">S</button>',
  out:{url:'https://chat.deepseek.com/sign_in',page:'<main><form><input type="tel" placeholder="Phone number"><input type="password" placeholder="Password"><button>Log in</button></form></main>'},
  limit:{notice:'<div class="composer-tip">You have reached the daily limit of messages. Please come back tomorrow.</div>',where:'composer'},look:true},
 kimi:{label:'Kimi',start:'https://www.kimi.com/',chat:'https://www.kimi.com/chat/d3fa1b2c3d4e5f6a7b8c',
  composer:'<div class="chat-input"><div class="chat-input-editor" contenteditable="true"></div></div>',send:'<button aria-label="Send message">Send</button>',
  user:t=>'<div class="segment segment-user"><div class="user-message">'+t+'</div></div>',assistant:t=>'<div class="segment segment-assistant">'+t+'</div>',
  stop:'<button aria-label="Stop">Stop</button>',account:'<div class="user-avatar">S</div>',
  out:{controls:'<aside><button>Log In</button></aside>'},
  limit:{notice:'<div class="notice">当前模型对话次数已达上限，请稍后再试。</div>',where:'top'},look:true},
 qwen:{label:'Qwen',start:'https://chat.qwen.ai/',chat:'https://chat.qwen.ai/c/2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e',
  composer:'<textarea id="chat-input" placeholder="How can I help you today?"></textarea>',send:'<button id="send-message-button" aria-label="Send message">Send</button>',
  user:t=>'<div data-role="user">'+t+'</div>',assistant:t=>'<div data-role="assistant">'+t+'</div>',
  stop:'<button aria-label="Stop">Stop</button>',account:'<button aria-label="User menu">S</button>',
  out:{url:'https://chat.qwen.ai/auth?action=signin',page:'<main><form><input type="email" autocomplete="email"><input type="password" autocomplete="current-password"><button>Sign in</button></form></main>'},
  limit:{notice:'<div role="status">You have reached the usage limit for this model. Please try again later.</div>',where:'top'},look:true},
 zai:{label:'Z.ai (GLM)',start:'https://chat.z.ai/',chat:'https://chat.z.ai/c/3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
  composer:'<textarea id="chat-input" placeholder="Send a Message"></textarea>',send:'<button id="send-message-button" aria-label="Send message">Send</button>',
  user:t=>'<div data-role="user">'+t+'</div>',assistant:t=>'<div data-role="assistant">'+t+'</div>',
  stop:'<button aria-label="Stop">Stop</button>',account:'<button aria-label="User menu">S</button>',
  out:{controls:'<button>Sign in</button>'},
  limit:{notice:'<div class="toast">Too many requests, please try again later.</div>',where:'top'},look:true}
};
const IDS=Object.keys(SITES);
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
// A side bar with chat titles that only look like trouble, so a page is never read by its titles.
const SIDEBAR='<nav><a href="/c/aaaaaaaa1111">You\'ve reached the summit: essay notes</a><a href="/c/bbbbbbbb2222">Too many requests? HTTP 429 homework</a><a href="/c/cccccccc3333">Log in</a></nav>';
// One page of one site. state: 'in' (signed in), 'out' (signed out), 'limit' (at its usage limit).
function page(id,{state='in',url}={}){
 const s=SITES[id];if(!s)throw Error('No such site: '+id);
 const view={getComputedStyle:n=>n.style(),HTMLTextAreaElement:Textarea,InputEvent:DraftEvent,Event:DraftEvent,getSelection:()=>selection};
 let range=null;const selection={removeAllRanges(){range=null;},addRange(r){range=r;}};
 const doc={defaultView:view,activeElement:null,location:null,
  createRange:()=>({node:null,collapsed:true,selectNodeContents(n){this.node=n;this.collapsed=false;},collapse(){this.collapsed=true;}}),
  createTextNode:t=>new Text(t),
  execCommand(command,ui,text){if(command!=='insertText'||!range?.node)return false;if(!range.collapsed)range.node.textContent='';range.node.appendChild(new Text(text));return true;},
  querySelectorAll:selector=>doc.documentElement.querySelectorAll(selector),querySelector:selector=>doc.documentElement.querySelector(selector)};
 const out=state==='out'&&s.out.url;
 const where=new URL(out?s.out.url:url||s.start);
 // A page that keeps the chat box (signed-out ChatGPT, Gemini, Grok, Kimi, Z.ai) shows its sign-in control beside it.
 const header='<header>'+(state==='out'&&s.out.controls?s.out.controls:s.account)+'</header>';
 const notice=state==='limit'?s.limit.notice:'';
 const html=out?s.out.page:header+SIDEBAR+'<main>'+(s.limit.where==='top'?notice:'')+'<div class="thread"></div><form class="composer">'+(s.limit.where==='composer'?notice:'')+s.composer+s.send+'</form><p>AI can make mistakes.</p></main>';
 const root=new Element('html');root.ownerDocument=doc;doc.documentElement=root;root.appendChild(parse(html,doc));adopt(root,doc);
 const self={},context=vm.createContext({document:doc,location:where,top:self,self,URL,window:view,console,Promise,Date});
 doc.location=where;
 const p={id,site:s,document:doc,context,
  get url(){return context.location.href;},
  go(next){context.location=new URL(next);doc.location=context.location;},
  composer(){return doc.querySelector('#prompt-textarea, .ProseMirror, .ql-editor, textarea, .chat-input-editor');},
  typed(){const c=p.composer();return c?(c.tagName==='TEXTAREA'?c.value:c.textContent):'';},
  sendButton(){const form=doc.querySelector('form.composer');return form?form.children.find(n=>n.tagName==='BUTTON'):null;},
  thread(){return doc.querySelector('.thread');},
  // Run one of ai-inject.js's serialized functions in this page, as chrome.scripting.executeScript does.
  async run(func,args){context.args=structuredClone(args);return vm.runInContext('('+func.toString()+').apply(null,args)',context);},
  add(html){const parsed=parse(html,doc);for(const n of [...parsed.childNodes])p.thread().appendChild(n);},
  // What the site shows next: an answer streaming, the answer done, its usage limit instead of an answer.
  reply(kind,text='{"cards":[{"kind":"notes","title":"Study notes","body":"Read chapter 3."}]}'){
   for(const n of doc.querySelectorAll('[data-fixture="reply"]'))n.remove();
   if(kind==='streaming'){p.add('<div data-fixture="reply">'+s.assistant('{"cards":[{"kind":"notes","ti')+'</div>');doc.querySelector('form.composer').appendChild(parse(s.stop,doc).childNodes[0]);}
   if(kind==='done'){for(const n of doc.querySelectorAll('[aria-label^="Stop" i], [data-testid="stop-button"]'))n.remove();p.add('<div data-fixture="reply">'+s.assistant(esc(text))+'</div>');}
   if(kind==='limit'){for(const n of doc.querySelectorAll('[aria-label^="Stop" i], [data-testid="stop-button"]'))n.remove();const box=parse('<div data-fixture="reply">'+s.limit.notice+'</div>',doc).childNodes[0];doc.querySelector(s.limit.where==='composer'?'form.composer':'main').appendChild(box);}
  }
 };
 // Send on the site: the chat box's text becomes the student's turn, the box empties, and a new chat gets its address.
 const button=p.sendButton();if(button)button.onclick=()=>{const said=p.typed();if(!said.trim())return;const c=p.composer();if(c.tagName==='TEXTAREA')c.value='';else c.textContent='';p.add(s.user(esc(said)));if(s.chat)p.go(s.chat);};
 return p;
}
module.exports={SITES,IDS,page,parse,Element,Textarea};
