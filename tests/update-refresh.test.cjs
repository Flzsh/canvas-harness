'use strict';
// 4.2.0: Canvas Harness updated under an open Canvas tab leaves this copy running without its extension (chrome.runtime.id gone),
// and what lives in the extension's own frames (Soul Passage's land under the panels) stands still until the tab is refreshed.
// content.js notices and loads the new version: by itself on Canvas Harness's own page when nothing is being written, through a
// slip where something is and on Canvas's own pages.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../extension/content.js'),'utf8');
// (the watcher as content.js ships it: from its setting to the end of its own function)
const watcher=(()=>{const a=source.indexOf("  const UPDATE_REFRESH='"),b=source.indexOf('\n  })();\n',source.indexOf('function updateWatch()'));assert.ok(a>0&&b>a,'content.js has the update watcher');return source.slice(a,b+'\n  })();\n'.length);})();
function fixture({pathname='/',mode=null,hasId=true}={}){
 const listeners={doc:{},win:{}},on=(map,name,fn)=>{(map[name]||=[]).push(fn);};let ticks=[],reloads=0;
 const el=(tag,props={})=>({tagName:tag,children:[],attrs:{},append(...n){for(const c of n){this.children.push(c);c.parentNode=this;}},remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(c=>c!==this);this.parentNode=null;},...props});
 const documentElement=el('HTML');
 const document={visibilityState:'visible',activeElement:null,documentElement,
  createElement:tag=>{const node=el(tag.toUpperCase(),{handlers:[],addEventListener(type,fn){this.handlers.push(fn);},click(){for(const fn of this.handlers)fn();}});
   node.attachShadow=()=>{const row=el('DIV'),root={set innerHTML(html){this.html=html;},querySelector(sel){return sel==='.r'?row:row.children.find(k=>'.'+k.className===sel)||null;}};node.shadowRoot=root;return root;};return node;},
  addEventListener:(name,fn)=>on(listeners.doc,name,fn)};
 const chrome={runtime:hasId?{id:'canvas-harness'}:{}};
 const context={document,window:{addEventListener:(name,fn)=>on(listeners.win,name,fn)},location:{pathname,reload(){reloads++;}},chrome,globalThis:null,
  setInterval:(fn)=>{ticks.push(fn);return ticks.length;},setTimeout:()=>0,console};
 context.globalThis=context;
 vm.runInNewContext((mode?watcher.replace("const UPDATE_REFRESH='auto'","const UPDATE_REFRESH='"+mode+"'"):watcher),context);
 const slip=()=>documentElement.children.find(n=>n.id==='reserve-update-slip')||null;
 return {document,chrome,listeners,slip,tick:()=>{for(const fn of ticks)fn();},get reloads(){return reloads;},
  update:()=>{delete chrome.runtime.id;},
  type:()=>{const field={tagName:'TEXTAREA'};for(const fn of listeners.doc.input||[])fn({composedPath:()=>[field],target:field});},
  show:state=>{document.visibilityState=state;for(const fn of listeners.doc.visibilitychange||[])fn();}};
}
test('Canvas Harness updated under its own page, nothing being written: the page loads the new version by itself',()=>{
 const f=fixture();f.tick();assert.equal(f.reloads,0,'nothing before the update');
 f.update();f.tick();assert.equal(f.reloads,1,'the next look reloads');assert.equal(f.slip(),null,'no slip');
});
test('where something is being written, or on Canvas\'s own pages, a slip asks first; Reload reloads, Later puts it away',()=>{
 const typed=fixture();typed.type();typed.update();typed.tick();assert.equal(typed.reloads,0,'text typed on the page: no reload by itself');
 const slip=typed.slip();assert.ok(slip,'the slip');assert.match(slip.shadowRoot.html,/role="status"/);assert.match(slip.shadowRoot.html,/<b>Canvas Harness was updated<\/b>/);assert.doesNotMatch(slip.shadowRoot.html,new RegExp(['CH\\+','Fol'+'io'].join('|')),'the public name only');
 typed.tick();assert.equal(typed.document.documentElement.children.filter(n=>n.id==='reserve-update-slip').length,1,'one slip');
 slip.shadowRoot.querySelector('.go').click();assert.equal(typed.reloads,1,'Reload reloads');
 const later=fixture();later.type();later.update();later.tick();later.slip().shadowRoot.querySelector('.no').click();assert.equal(later.slip(),null,'Later puts it away');assert.equal(later.reloads,0);
 later.show('hidden');later.show('visible');assert.ok(later.slip(),'and it asks again when the tab is shown again');
 const focused=fixture();focused.document.activeElement={tagName:'INPUT',type:'text'};focused.update();focused.tick();assert.equal(focused.reloads,0);assert.ok(focused.slip(),'a field being written in');
 const canvas=fixture({pathname:'/courses/7/modules'});canvas.update();canvas.tick();assert.equal(canvas.reloads,0);assert.ok(canvas.slip(),'a Canvas page asks');
});
test('the choice flips in one place: \'ask\' puts the slip everywhere; a hidden tab waits; a copy that never had its extension does nothing',()=>{
 const ask=fixture({mode:'ask'});ask.update();ask.tick();assert.equal(ask.reloads,0);assert.ok(ask.slip());
 const hidden=fixture();hidden.update();hidden.document.visibilityState='hidden';hidden.tick();assert.equal(hidden.reloads,0,'not while hidden');hidden.show('visible');assert.equal(hidden.reloads,1,'when it is shown');
 const none=fixture({hasId:false});none.tick();assert.equal(none.reloads,0);assert.equal(none.slip(),null);
});
test('the slip is drawn in the house style: paper, ink, a strip of tape, a drawn button; no plain box',()=>{
 const f=fixture();f.type();f.update();f.tick();const html=f.slip().shadowRoot.html;
 // the house palette and hand (sheet #FFFDF8, ink #141413, clay #A9522F, kraft tape), the sheet and its ink line cut by the dock
 // shelf's own drawn shapes (two mask pictures, carried inline: the extension is gone when the slip shows), a drawn offset shadow
 for(const want of [/\.s::before\{[^}]*background:#FFFDF8;-webkit-mask-box-image:url\("data:image\/svg\+xml,/,/\.s::after\{[^}]*background:#141413;-webkit-mask-box-image:url\("data:image\/svg\+xml,/,/\.s>i\{[^}]*translate:3px 4px;background:rgb\(20 20 19\/\.12\)/,/\.s>u\{[^}]*rgb\(212 162 127\/\.82\)/,/rotate\(-\.6deg\)/,/\.go\{background:#A9522F/,/\.no\{/])assert.match(html,want);
 assert.doesNotMatch(html,/chrome-extension:|url\((?!"data:)/,'nothing in it is loaded from the extension');
 const keys=f.slip().shadowRoot.querySelector('.r').children.map(k=>[k.className,k.textContent,k.type]);assert.deepEqual(keys,[['no','Later','button'],['go','Reload','button']]);
});
