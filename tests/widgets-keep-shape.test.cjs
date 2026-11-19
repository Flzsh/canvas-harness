'use strict';
// Roadmap item 9 (owner, 2026-11): Home modules "often snap oddly and don't keep the shape the student wanted".
// Each test below is one proven cause, written before its fix.
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../extension/workspace-arrange.js'),G=require('../extension/workspace-gestures.js'),{fixture}=require('./gesture-fixture.cjs');
const customization=require('../extension/customization-model.js'),storage=require('../extension/storage.js');

// The gesture fixture with a ResizeObserver the test drives, and heights the test chooses for each module.
function desk(nav,layout,heights){
 const f=fixture();f.controller.destroy();if(nav)f.container.dataset.courseNavigation=nav;f.settings.workspaceLayout=layout;
 const node=f.container.querySelector('.rd-main'),win=f.container.ownerDocument.defaultView,observers=[];
 win.ResizeObserver=class{constructor(fn){this.fn=fn;this.nodes=new Set();observers.push(this);}observe(n){this.nodes.add(n);}unobserve(n){this.nodes.delete(n);}disconnect(){this.nodes.clear();}};
 for(const [key,panel] of Object.entries(f.panels)){panel.rect={...panel.rect,height:heights[key]??400};Object.defineProperty(panel,'offsetHeight',{get:()=>panel.rect.height});}
 for(const n of [node,...Object.values(f.panels)])n.style.getPropertyValue=k=>n.style[k]||'';
 const controller=G.create({container:f.container,getSettings:()=>f.settings,onChange:()=>true},M);
 const observe=()=>{for(const o of observers)o.fn([...o.nodes].map(target=>({target,contentRect:{width:target.rect.width,height:target.rect.height},borderBoxSize:[{inlineSize:target.rect.width,blockSize:target.rect.height}]})));};
 controller.sync();observe();
 const top=key=>{const m=/^(\d+) \/ span (\d+)$/.exec(f.panels[key].style['--rd-panel-row']||'');return m?(Number(m[1])-1)*2:null;};
 return {f,node,controller,observe,top};
}

// Cause 1. With the course dock or the top bar, Home rows were laid out as fractions of the tallest column, and the CSS
// for those two navigations (responsive-layout.css: grid-template-rows:none) turned them into automatic rows. A module
// stacked under a short one then waited for the tall module beside them: measured on 4.0.164 in Edge, 1600x1000,
// layout [Up next | Course information over Assignment details]: course information ends at 949 px, assignment details
// started at 1305 px with the dock and 1317 px with the top bar, but at 968 px with the sidebar.
for(const nav of ['dock','topbar'])test(nav+': a module stacked under another starts right below it, whatever its neighbour column holds',()=>{
 const d=desk(nav,{axis:'x',children:['work',{axis:'y',children:['context','reader']}]},{work:2075,context:949,reader:445});
 assert.equal(d.node.dataset.rows,'measured','rows follow the modules\' own heights, as with the sidebar');
 const gap=d.top('reader')-949;
 assert.ok(gap>=28&&gap<=36,`assignment details start one gap below course information (gap ${gap} px, the dock's 32 px gap)`);
 assert.equal(d.top('context'),0);assert.equal(d.top('work'),0);
 assert.ok(Object.values(d.f.panels).every(n=>n.style['--rd-panel-grow']==='0px'),'outlines keep their own height with the dock, as before');
 // content that grows moves the module below it, and only that
 d.f.panels.context.rect.height=1200;d.observe();const after=d.top('reader')-1200;assert.ok(after>=28&&after<=36,'a longer module pushes the one below it');
 d.controller.destroy();
});
test('the sidebar keeps its measured rows and its 18 px stack gap',()=>{
 const d=desk('sidebar',{axis:'x',children:['work',{axis:'y',children:['context','reader']}]},{work:2075,context:949,reader:445});
 assert.equal(d.node.dataset.rows,'measured');const gap=d.top('reader')-949;assert.ok(gap>=16&&gap<=20,'gap '+gap);d.controller.destroy();
});

// Cause 2. A module the saved layout names but the page does not draw (its feature is off, an AI module that has
// gone, Lite) still took its share of the width: an empty column beside the drawn ones, and wrapping too early.
test('a saved module that is not drawn leaves no empty column, and the saved layout keeps it',()=>{
 const layout={axis:'x',children:['context','work','reader','ai-gone']};
 const d=desk('sidebar',layout,{context:500,work:600,reader:400});
 const tracks=(d.node.style['--rd-layout-columns']||'').split(' minmax').length;
 assert.equal(tracks,3,'three drawn modules, three columns: '+d.node.style['--rd-layout-columns']);
 assert.equal(d.f.panels.reader.style['--rd-panel-column'],'3 / 4');
 assert.deepEqual(d.f.settings.workspaceLayout,layout,'nothing is saved: the module comes back where it was when it is drawn again');
 d.controller.destroy();
});

// Cause 3. Moving modules beside and below each other nests the layout one level per move. From the fifth level the
// saved record was refused: the undo copy of a five-level layout passed the storage check's limit of 12 nested
// levels ("Backup nesting is too deep"), and from the sixth the layout check itself ("Invalid workspaceLayout"). The
// drop was not saved and Home snapped back to the old arrangement ("The change could not be saved").
function deepMoves(){
 const s={};
 for(const [key,target,edge] of [['notes','reader','bottom'],['clock','notes','right'],['timer','clock','bottom'],['week','timer','right'],['grades','week','bottom'],['bookmarks','grades','right']])assert.equal(M.change(s,{type:'dock',key,target,edge}),true);
 return s;
}
const depth=node=>typeof node==='string'?0:1+Math.max(...node.children.map(depth));
test('an arrangement nested by six moves is saved, read back, and its undo still works',async()=>{
 const s=deepMoves();assert.ok(depth(s.workspaceLayout)>=6,'the moves nest six levels deep');
 const clean=customization.cleanSettings(s);assert.deepEqual(clean.workspaceLayout,s.workspaceLayout);
 const raw=new Map(),adapter={read:async key=>structuredClone(raw.get(key)),write:async(key,value)=>raw.set(key,structuredClone(value))};
 const account={accountId:'37',origin:'https://school.instructure.com',adapter},first=storage.createStore(account);await first.load();
 await first.update(data=>{Object.assign(data.settings,deepMoves());});
 const again=storage.createStore(account),data=await again.load();
 assert.deepEqual(data.settings.workspaceLayout,s.workspaceLayout,'the layout survives a reload');
 await again.update(record=>{assert.equal(M.change(record.settings,{type:'undo'}),true);});
 assert.equal(M.leaves(again.get().settings.workspaceLayout).includes('bookmarks'),false,'undo takes back the last move');
 first.destroy();again.destroy();
});
test('backups are still bounded: an absurdly deep or large layout is refused',()=>{
 let tree='context';const extra=['work','reader',...M.EXTRA];for(let i=0;i<extra.length;i++)tree={axis:i%2?'x':'y',children:[tree,extra[i]]};
 assert.ok(depth(tree)>=13);assert.doesNotThrow(()=>M.cleanLayout(tree),'every module nested one level each is still a real arrangement');
 let deep={axis:'x',children:['context',{axis:'y',children:['work','reader']}]};for(let i=0;i<30;i++)deep={axis:i%2?'y':'x',children:[deep,'ai-n'+i]};
 assert.throws(()=>M.cleanLayout(deep),/Invalid workspaceLayout/);
});

// Cause 4. With the course dock or the top bar the Canvas page itself does not scroll (startup.css reserve-fit: body
// overflow hidden); Home scrolls inside its work area (dock) or its shell (top bar). Holding a module at the bottom edge
// scrolled the page, which could not move, so a place below the visible part of Home could not be reached.
for(const [nav,sel] of [['dock','.rd-workspace'],['topbar','.rd-shell']])test(nav+': a module held at the bottom edge scrolls Home, so any place can be reached',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.container.dataset.courseNavigation=nav;
 const doc=f.container.ownerDocument,shell=f.container.querySelector('.rd-shell'),desk=f.container.querySelector('.rd-main');
 let area=shell;if(sel==='.rd-workspace'){area=doc.createElement();area.className='rd-workspace';desk.remove();area.append(desk);shell.append(area);}
 area.rect={left:0,top:60,width:1400,height:900,right:1400,bottom:960};area.scrollTop=0;Object.defineProperty(area,'scrollHeight',{value:3000});Object.defineProperty(area,'clientHeight',{value:900});
 f.controller.pointerdown(f.event('work',450,120));t.mock.timers.tick(430);assert.equal(f.controller.dragging(),true);
 f.controller.pointermove({...f.event('work'),clientX:450,clientY:940});f.tick(20);
 assert.ok(area.scrollTop>0,'Home scrolled under the held module');assert.equal(doc.scrollingElement.scrollTop,0,'the page that cannot scroll is left alone');
 f.controller.pointercancel({pointerId:1});f.controller.destroy();
});

// Cause 1, narrowed after measuring (2026-11-14): measured rows cost a second layout pass whenever a module's height changes.
// Only a stack beside other modules can leave the hole, so every other dock or top-bar arrangement keeps 4.0.164's fitted
// rows exactly (this test passes on 4.0.164 too).
for(const nav of ['dock','topbar'])test(nav+': modules side by side without a stack keep the fitted rows of 4.0.164, and a growing module writes nothing',()=>{
 const d=desk(nav,{axis:'x',children:['context','work','reader']},{context:600,work:2000,reader:400});
 const rows=()=>Object.fromEntries(Object.entries(d.f.panels).map(([key,n])=>[key,n.style['--rd-panel-row']]));
 assert.notEqual(d.node.dataset.rows,'measured');assert.equal(d.node.style['--rd-layout-rows'],'minmax(0,1fr)');
 assert.deepEqual(rows(),{context:'1 / 2',work:'1 / 2',reader:'1 / 2'});
 const before=JSON.stringify([d.node.style,rows()]);d.f.panels.work.rect.height=3600;d.observe();
 assert.equal(JSON.stringify([d.node.style,rows()]),before,'nothing is laid out again when a module grows');
 d.controller.destroy();
});
