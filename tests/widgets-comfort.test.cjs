'use strict';
require('../extension/site.js');
// Roadmap item 9, round 2 (4.2): "Widgets: more customizable and more comfortable. They often snap oddly and don't keep
// the shape the student wanted." Each cause below was seen first on the fake Canvas (widgets-42-report.md), then fixed.
// The rule: where the student puts a module and the width they give it are kept unless it truly cannot fit; then it
// takes the nearest shape that fits, and it returns to the student's shape when there is room again.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const M=require('../extension/workspace-arrange.js'),G=require('../extension/workspace-gestures.js'),{fixture}=require('./gesture-fixture.cjs');
const Customization=require('../extension/customization-model.js');
const clone=v=>JSON.parse(JSON.stringify(v));
const L0={axis:'x',children:['context','work','reader']};
const L1={axis:'y',children:[{axis:'x',children:['week','timer','notes','clock']},L0]};
const L2={axis:'y',children:[{axis:'x',children:['week','timer','clock','notes']},L0,{axis:'x',children:['handin','bookmarks','grades','messages']},{axis:'x',children:['pet','review','impact']}]};
// What the browser makes of the grid: the columns shared out after the gaps, a module as wide as its tracks and the gaps inside
// it, less the few pixels of margin that set it to its own box (customize.css).
function drawnWidths(g,width,gap){
 // (as CSS grid does: flex factors adding up to less than 1 get only that part of the free space)
 const fr=g.columns.split(' ').map(c=>Number(/,([\d.]+)fr\)/.exec(c)[1])),sum=Math.max(1,fr.reduce((a,b)=>a+b,0)),tracks=fr.map(f=>(width-gap*(fr.length-1))*f/sum);
 return Object.fromEntries(Object.entries(g.cells).map(([key,c])=>{const [a,b]=c.column.split(' / ').map(Number);return [key,tracks.slice(a-1,b-1).reduce((x,y)=>x+y,0)+gap*(b-a-1)-(c.inset?.[0]||0)-(c.inset?.[1]||0)];}));
}

// Cause 1 (seen: 1366 px window, sidebar; Course information 284 px wide with the three panels alone, 255 px once a row of
// four modules was added above them, Up next 319 -> 350 px). The desk is one CSS grid, and every edge of every row was a
// column with a 32 px gap of its own, so a module's width depended on how many edges of OTHER rows fell inside it.
test('a module keeps its width whatever the other rows hold, and a width picked in one row leaves the other rows alone',()=>{
 const gap=32,width=986,core=tree=>{const g=M.grid(M.drawn({workspaceLayout:tree}),width,{},gap),w=drawnWidths(g,width,gap);return ['context','work','reader'].map(k=>w[k]);};
 const alone=core(L0),withRow=core(L1),withAll=core(L2);
 for(const [i,key] of ['context','work','reader'].entries()){
  assert.ok(Math.abs(alone[i]-withRow[i])<=1,`${key}: ${alone[i].toFixed(0)} px alone, ${withRow[i].toFixed(0)} px under a row of four (was 284 -> 255)`);
  assert.ok(Math.abs(alone[i]-withAll[i])<=1,`${key}: ${alone[i].toFixed(0)} px alone, ${withAll[i].toFixed(0)} px with every module`);
 }
 const before=drawnWidths(M.grid(M.drawn({workspaceLayout:L1}),width,{},gap),width,gap),after=drawnWidths(M.grid(M.drawn({workspaceLayout:L1}),width,{notes:'l'},gap),width,gap);
 assert.ok(after.notes>before.notes+40,'Notes is wider');
 for(const key of ['context','work','reader'])assert.ok(Math.abs(after[key]-before[key])<=1,`${key} keeps its width when Notes is made Wide (${before[key].toFixed(0)} -> ${after[key].toFixed(0)})`);
});
test('what the browser draws is each module\'s own share of its row, gaps included, in every arrangement',()=>{
 const trees=[L0,L1,L2,M.dock(L1,'notes','reader','bottom'),M.dock(L2,'grades','work','right'),M.dock(M.dock(L1,'clock','context','bottom'),'timer','clock','right')];
 for(const tree of trees)for(const [width,gap] of [[986,32],[1300,32],[1600,44]]){
  const g=M.grid(M.drawn({workspaceLayout:tree}),width,{week:'l',timer:'s'},gap),drawn=drawnWidths(g,width,gap);
  for(const [key,box] of Object.entries(g.boxes))assert.ok(Math.abs(drawn[key]-box.w)<=.5,`${key} at ${width} px: drawn ${drawn[key].toFixed(1)}, its share ${box.w.toFixed(1)}`);
  for(const c of Object.values(g.cells))assert.ok(Math.abs(c.inset[0])<=gap&&Math.abs(c.inset[1])<=gap,'the margins that set a module to its box stay within a gap');
 }
});

// Cause 2 (seen at 1024 px: Clock drawn 126 px wide, Focus 136 px, below the narrowest they can be used at). A row was
// thought to fit when the modules' narrowest widths fitted, the gaps between them left out; and Narrow had no floor.
test('no module is drawn below its narrowest useful width while the row fits, Narrow included',()=>{
 for(const [width,sizes] of [[986,{timer:'s',clock:'s'}],[760,{}],[650,{}],[520,{}],[1300,{timer:'s',notes:'s',week:'s',clock:'s'}]])for(const tree of [L1,L2]){
  const g=M.grid(M.drawn({workspaceLayout:tree}),width,sizes,32);
  for(const [key,box] of Object.entries(g.boxes))if(M.MIN_WIDTH[key]<=width)assert.ok(box.w>=M.MIN_WIDTH[key]-.5,`${key} at ${width} px is ${box.w.toFixed(0)} px, its narrowest is ${M.MIN_WIDTH[key]}`);
 }
 const row={axis:'x',children:['week','timer','notes','clock']};// narrowest 800 px, 896 px with the three gaps
 assert.equal(M.resolve(row,880,{},32).axis,'y','880 px cannot hold them with their gaps: the row wraps');
 assert.deepEqual(M.resolve(row,900,{},32),row,'900 px can');
});
// Cause 3 (seen at 1024 px): a row that could not fit kept as many modules as fitted and put the last one alone on a row of
// its own, stretched across the page (Clock 650 px wide). It now breaks into the fewest rows, as even as they can be.
test('a row that cannot fit wraps into even rows, and the student\'s row comes back when there is room again',()=>{
 const tree=M.drawn({workspaceLayout:L1});
 const narrow=M.resolve(tree,650,{},32);
 assert.deepEqual(narrow.children[1],{axis:'y',children:[{axis:'x',children:['week','timer']},{axis:'x',children:['notes','clock']}]},'two and two, not three and one');
 // (seen at 1024 px after the first fix: Up next and Course information exchanged, then Up next alone on a row 648 px wide;
 // of two splits as even, the one with more on the earlier row is the student's row read left to right)
 assert.deepEqual(M.resolve({axis:'x',children:['work','context','reader']},648,{},32),{axis:'y',children:[{axis:'x',children:['work','context']},'reader']});
 assert.deepEqual(M.resolve(tree,1300,{},32),tree,'wide again: exactly the student\'s arrangement');
 const settings={workspaceLayout:clone(L1),moduleSize:{notes:'l'}},kept=clone(settings);M.grid(M.drawn(settings),520,settings.moduleSize,32);
 assert.deepEqual(settings,kept,'a narrow window never writes its wrapped shape back');
});

// A width as its own command (menu, edge, corner, keyboard): the owner's open question stays a one-line switch.
function withSwitch(on){
 const source=fs.readFileSync(path.join(__dirname,'../extension/workspace-arrange.js'),'utf8'),flipped=source.replace('const WIDTH_IS_UNDO_STEP=false;',`const WIDTH_IS_UNDO_STEP=${on};`);
 assert.notEqual(flipped===source,on,'the switch is one line in workspace-arrange.js');
 const sandbox={module:{exports:{}},require,globalThis:{}};sandbox.globalThis=sandbox;vm.runInNewContext(flipped,sandbox);return sandbox.module.exports;
}
test('picking a width: not an undo step as built (the owner has not decided); one line makes it one',()=>{
 assert.equal(M.WIDTH_IS_UNDO_STEP,false,'as built: the 4.0.165 behaviour');
 for(const on of [false,true]){
  const A=withSwitch(on),s={};A.change(s,{type:'add',key:'notes'});A.change(s,{type:'dock',key:'notes',target:'reader',edge:'bottom'});const moved=clone(A.snapshot(s).layout);
  assert.equal(A.change(s,{type:'size',key:'notes',value:'l'}),true);assert.equal(s.moduleSize.notes,'l');
  assert.equal(A.change(s,{type:'size',key:'notes',value:'l'}),false,'the same width again changes nothing');
  assert.equal(A.change(s,{type:'undo'}),true);
  const now=clone(A.snapshot(s).layout);
  if(on){assert.deepEqual(now,moved,'switch on: Undo takes back the width only');assert.equal(s.moduleSize.notes,undefined);}
  else{assert.equal(A.leaves(now).includes('notes'),true);assert.notDeepEqual(now,moved,'switch off: Undo takes back the last move, as since 4.0.165');assert.equal(s.moduleSize.notes,undefined,'with the widths Home had before it');}
 }
 const s={};assert.equal(M.change(s,{type:'size',key:'reader',value:'huge'}),false);assert.equal(M.change(s,{type:'size',key:'nothing',value:'l'}),false);
 assert.equal(M.change(s,{type:'size',key:'reader',value:'s'}),true);assert.equal(M.change(s,{type:'size',key:'reader',value:'m'}),true);assert.deepEqual(s.moduleSize,{},'Normal is written as no entry, as the menu always did');
});

// "Reset this widget" in every module's menu.
test('Reset this widget: back where it goes by itself, Normal width, one step that Undo move takes back',()=>{
 // an added module: back to the row of added modules
 let s={workspaceLayout:clone(L1),moduleSize:{notes:'l'}};M.change(s,{type:'dock',key:'notes',target:'reader',edge:'bottom'});
 const before={layout:clone(s.workspaceLayout),sizes:clone(s.moduleSize)};
 assert.equal(M.change(s,{type:'reset-module',key:'notes'}),true);
 assert.deepEqual(s.workspaceLayout,{axis:'y',children:[{axis:'x',children:['week','timer','clock','notes']},L0]});assert.equal(s.moduleSize.notes,undefined);
 assert.equal(M.change(s,{type:'undo'}),true);assert.deepEqual({layout:s.workspaceLayout,sizes:s.moduleSize},before,'Undo move gives back the place and the width');
 // one of the three panels: beside its neighbour in the first arrangement
 s={workspaceLayout:clone(L1)};M.change(s,{type:'dock',key:'work',target:'week',edge:'bottom'});
 assert.equal(M.change(s,{type:'reset-module',key:'work'}),true);assert.deepEqual(s.workspaceLayout,L1);
 s={workspaceLayout:clone(L1)};M.change(s,{type:'dock',key:'context',target:'reader',edge:'right'});M.change(s,{type:'reset-module',key:'context'});assert.deepEqual(s.workspaceLayout,L1);
 // Help: on top across the width again (no place of its own), Normal width
 s={workspaceLayout:clone(L1),moduleSize:{help:'s'}};M.change(s,{type:'dock',key:'help',target:'reader',edge:'bottom'});assert.ok(s.helpLayout);
 assert.equal(M.change(s,{type:'reset-module',key:'help'}),true);assert.equal(s.helpLayout,undefined);assert.equal(s.moduleSize.help,undefined);assert.deepEqual(M.drawn(s),M.split('y',['help',L1]));
 // already as it goes by itself: nothing to do
 s={workspaceLayout:clone(L1)};assert.equal(M.change(s,{type:'reset-module',key:'help'}),false);assert.equal(M.change(s,{type:'reset-module',key:'week'}),false);
 // only the width changed: the width comes back
 s={workspaceLayout:clone(L1),moduleSize:{week:'s'}};assert.equal(M.change(s,{type:'reset-module',key:'week'}),true);assert.deepEqual(s.moduleSize,{});assert.deepEqual(s.workspaceLayout,L1);
});

// Saved layouts from older builds load unchanged, and are drawn in the same places at a wide desk.
test('Home arrangements saved by older builds load exactly as saved',()=>{
 const {records}=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/home-layouts-older.json'),'utf8'));
 const today=t=>typeof t==='string'?t:M.split(t.axis,t.children.map(today).filter(c=>c!=='today'));
 for(const {from,settings} of records){
  const input=clone(settings),clean=Customization.cleanSettings(clone(settings));
  assert.deepEqual(settings,input,from+': nothing written to the record on load');
  if(input.workspaceLayout)assert.deepEqual(clean.workspaceLayout,today(input.workspaceLayout),from+': the layout as saved (the retired Today module left out, as every build since 4.0.150)');
  // (join-42c: fix-42 keeps Help's own width beside the others as helpSize, so a build before 4.2 can read the record; the
  // widths themselves are as saved)
  const {help:helpWidth,...widths}=input.moduleSize||{};
  assert.deepEqual(clean.moduleSize,widths,from+': the widths as saved');assert.equal(clean.helpSize,helpWidth,from+': the width of Help as saved, kept as helpSize');
  if(input.helpLayout)assert.deepEqual(clean.helpLayout,input.helpLayout,from+': Help\'s place as saved');
  if(input.workspaceUndo)assert.deepEqual(M.leaves(clean.workspaceUndo.layout),M.leaves(input.workspaceUndo.layout),from+': the undo copy as saved');
  const drawn=M.drawn(clean);assert.deepEqual(M.resolve(drawn,1900,clean.moduleSize,32),drawn,from+': a wide desk draws the arrangement itself');
  // what the new commands write is what any build since 4.0.165 reads: the same keys, the same three widths
  const next=clone(clean);M.change(next,{type:'size',key:'reader',value:'l'});M.change(next,{type:'reset-module',key:'reader'});
  const known=new Set(['workspaceOrder','workspaceMode','workspaceLayout','helpLayout','workspaceUndo','moduleSize','courseOrder','courseNavigation','dockSize','showCourseInformation','showCourseStrip','showHelp','deskOrder','dashboardLayout']);
  assert.deepEqual(Object.keys(next).filter(k=>!Object.hasOwn(clean,k)&&!known.has(k)),[],from+': no setting an older build does not know');
  assert.ok(Object.values(next.moduleSize||{}).every(v=>['s','l'].includes(v)));assert.doesNotThrow(()=>Customization.cleanSettings(clone(next)));
 }
});

// The gestures on the desk: the desk's own gap, the drop place, the edge and corner, the keyboard.
function sized(extra={}){
 const f=fixture();f.controller.destroy();Object.assign(f.settings,extra);
 const win=f.container.ownerDocument.defaultView;win.getComputedStyle=()=>({columnGap:'32px'});
 const desk=f.container.querySelector('.rd-main');for(const n of [desk,...Object.values(f.panels)])n.style.getPropertyValue=k=>n.style[k]||'';
 const calls=[],controller=G.create({container:f.container,getSettings:()=>f.settings,onChange:c=>{calls.push(c);M.change(f.settings,c);return true;}},M);controller.sync();
 const at=(key,x,y,extra={})=>({target:f.panels[key],button:0,buttons:0,isPrimary:true,pointerId:7,clientX:x,clientY:y,preventDefault(){},stopImmediatePropagation(){},...extra});
 return {f,desk,controller,calls,at};
}
test('the grid is worked out with the desk\'s own column gap',()=>{
 const t=sized(),g=M.grid(M.DEFAULT.layout,1200,{},32);// (the fixture draws the three panels only)
 assert.equal(t.desk.style['--rd-layout-columns'],g.columns,'columns from the gap-aware arithmetic (32 px read from the desk)');
 for(const k of M.PANELS)assert.equal(t.f.panels[k].style['--rd-panel-inset-l'],g.cells[k].inset[0]+'px');t.controller.destroy();
 // a 900 px desk: the three panels' narrowest widths (860 px) fit only without their two 32 px gaps, so they wrap
 const f=fixture();f.controller.destroy();f.container.ownerDocument.defaultView.getComputedStyle=()=>({columnGap:'32px'});
 const desk=f.container.querySelector('.rd-main');desk.rect={...desk.rect,width:900};for(const n of [desk,...Object.values(f.panels)])n.style.getPropertyValue=k=>n.style[k]||'';
 const c=G.create({container:f.container,getSettings:()=>f.settings,onChange:()=>true},M);c.sync();
 assert.notEqual(f.panels.reader.style['--rd-panel-row'],f.panels.context.style['--rd-panel-row'],'Assignment details goes to a row of its own');
 assert.equal(desk.style['--rd-layout-columns'],M.grid(M.DEFAULT.layout,900,{},32).columns);assert.notEqual(desk.style['--rd-layout-columns'],M.grid(M.DEFAULT.layout,900,{},0).columns);c.destroy();
});
test('a desk with side padding (a theme\'s) shares out the width inside it',()=>{
 const f=fixture();f.controller.destroy();f.container.ownerDocument.defaultView.getComputedStyle=()=>({columnGap:'44px',paddingLeft:'22px',paddingRight:'22px'});
 const desk=f.container.querySelector('.rd-main');for(const n of [desk,...Object.values(f.panels)])n.style.getPropertyValue=k=>n.style[k]||'';
 const controller=G.create({container:f.container,getSettings:()=>f.settings,onChange:()=>true},M);controller.sync();
 assert.equal(desk.style['--rd-layout-columns'],M.grid(M.DEFAULT.layout,1200-44,{},44).columns);
 // Course information's share of the 1,156 px inside the padding, after its two 44 px gaps: (1156-88)*1/3.24 px
 const first=Number(/minmax\(0,([\d.]+)fr\)/.exec(desk.style['--rd-layout-columns'])[1]);
 assert.ok(Math.abs(first*(1156-88)-(1156-88)/3.24)<1,`Course information ${(first*(1156-88)).toFixed(1)} px of the width inside the padding`);
 const all=(desk.style['--rd-layout-columns'].match(/[\d.]+fr/g)||[]).reduce((n,v)=>n+parseFloat(v),0);
 assert.ok(Math.abs(all-1)<.001,'the columns share out all the room after the gaps (under 1 fr, CSS would leave the rest empty)');controller.destroy();
 // a 990 px desk with that padding: 946 px inside, less than the three panels' 860 px and two 44 px gaps (948): they wrap
 const g=fixture();g.controller.destroy();g.container.ownerDocument.defaultView.getComputedStyle=()=>({columnGap:'44px',paddingLeft:'22px',paddingRight:'22px'});
 const d=g.container.querySelector('.rd-main');d.rect={...d.rect,width:990};for(const n of [d,...Object.values(g.panels)])n.style.getPropertyValue=k=>n.style[k]||'';
 const c=G.create({container:g.container,getSettings:()=>g.settings,onChange:()=>true},M);c.sync();
 assert.notEqual(g.panels.reader.style['--rd-panel-row'],g.panels.context.style['--rd-panel-row'],'Assignment details wraps to a row of its own');c.destroy();
});
test('the drop place carries its name on a tag while a module is carried',()=>{
 const t=sized();t.controller.keydown({key:' ',target:t.f.grips.reader,preventDefault(){}});assert.equal(t.controller.dragging(),true);
 t.controller.keydown({key:'ArrowDown',target:t.f.grips.reader,preventDefault(){}});
 const slot=t.f.toolbar.children.find(n=>n.className==='rd-snap-preview'),tag=slot?.children.find(n=>n.className==='rd-snap-tag');
 assert.equal(slot.hidden,false);assert.ok(tag,'a tag on the drop place');assert.match(tag.textContent,/^Below /);
 t.controller.keydown({key:'Escape',target:t.f.grips.reader,preventDefault(){}});t.controller.destroy();
});
test('pulling a module\'s right edge or corner steps its width (Narrow, Normal, Wide), saved when let go',()=>{
 for(const [where,y] of [['edge',300],['corner',492]]){
  const t=sized(),r=t.f.panels.work.rect;// 400..780 x 100..500
  t.controller.pointermove(t.at('work',r.right-4,y));t.f.tick(20);assert.equal(t.f.panels.work.dataset.sizeGrab,where,'the pointer shows the '+where);
  assert.equal(t.controller.pointerdown(t.at('work',r.right-4,y)),true,'pressed there: a width, not a move');assert.equal(t.controller.sizing(),true);
  t.controller.pointermove(t.at('work',r.right+200,y,{buttons:1}));assert.equal(t.calls.length,0,'nothing saved while pulling');
  assert.notEqual(t.desk.style['--rd-layout-columns'],M.grid(M.DEFAULT.layout,1200,{},32).columns,'the new width is laid out live');
  t.controller.pointerup(t.at('work',r.right+200,y));assert.deepEqual(t.calls.at(-1),{type:'size',key:'work',value:'l'});assert.equal(t.f.settings.moduleSize.work,'l');
  t.controller.destroy();
 }
 const t=sized(),r=t.f.panels.work.rect;t.controller.pointerdown(t.at('work',r.right-4,300));t.controller.pointermove(t.at('work',r.right-130,300,{buttons:1}));t.controller.pointerup(t.at('work',r.right-130,300));
 assert.deepEqual(t.calls.at(-1),{type:'size',key:'work',value:'s'},'pulled in: Narrow');t.controller.destroy();
});
test('Escape while pulling puts the width back and saves nothing; a press inside a module still holds to move',t=>{
 const s=sized(),r=s.f.panels.work.rect,columns=s.desk.style['--rd-layout-columns'];
 s.controller.pointerdown(s.at('work',r.right-4,300));s.controller.pointermove(s.at('work',r.right+200,300,{buttons:1}));
 assert.equal(s.controller.keydown({key:'Escape',preventDefault(){}}),true);assert.equal(s.controller.sizing(),false);assert.equal(s.calls.length,0);assert.equal(s.desk.style['--rd-layout-columns'],columns);s.controller.destroy();
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();assert.equal(f.controller.pointerdown(f.event('work',450,120)),true);t.mock.timers.tick(430);assert.equal(f.controller.dragging(),true,'the hold to move is unchanged');f.controller.pointercancel({pointerId:1});f.controller.destroy();
});
test('Shift+Right and Shift+Left on a module\'s grip: one step wider or narrower, for every module',()=>{
 const t=sized(),key=(k,grip)=>t.controller.keydown({key:k,shiftKey:true,target:grip,preventDefault(){}});
 assert.equal(key('ArrowRight',t.f.grips.context),true);assert.deepEqual(t.calls.at(-1),{type:'size',key:'context',value:'l'});
 assert.equal(key('ArrowRight',t.f.grips.context),true,'already Wide: said, nothing saved');assert.equal(t.calls.length,1);
 key('ArrowLeft',t.f.grips.context);key('ArrowLeft',t.f.grips.context);assert.equal(t.f.settings.moduleSize.context,'s');
 for(const k of M.PANELS){key('ArrowRight',t.f.grips[k]);}assert.ok(M.PANELS.every(k=>['l','m'].includes(t.f.settings.moduleSize[k]||'m')));
 assert.equal(t.controller.keydown({key:'ArrowRight',shiftKey:false,target:t.f.grips.work,preventDefault(){}}),false,'plain arrows stay the page\'s');
 t.controller.destroy();
});

// The menu behind a module's three dots has "Reset this widget".
test('the module menu resets a widget, and the width picks go through the same width command',()=>{
 const A=M,env={ReserveWorkspaceArrange:A,ReservePlanner:require('../extension/planner-model.js'),ReserveUI:require('../extension/ui-utils.js'),setTimeout,clearTimeout,setInterval,clearInterval,addEventListener(){},removeEventListener(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../extension/widgets.js'),'utf8'),env);
 const data={settings:{workspaceLayout:clone(L1)},toolbox:{}},doc={addEventListener(){},removeEventListener(){},defaultView:env},container={ownerDocument:doc,querySelector:()=>null,querySelectorAll:()=>[]};
 const view=env.ReserveWidgets.create({container,store:{get:()=>data},save:async fn=>{fn(data);return true;},rerender(){},getContext:()=>({personal:data,s:{timeZone:'UTC'},items:[],local:{},courses:[],courseMap:new Map(),now:0}),helpers:()=>({E:require('../extension/ui-utils.js').escapeHTML,formatDate:()=>'',dayKey:()=>'2026-11-22',complete:()=>false})});
 const click=(action,key,value)=>view.click({target:{closest:selector=>selector==='[data-rd-action]'?{dataset:{rdAction:action,widget:key,value}}:null}});
 click('module-size','notes','l');assert.equal(data.settings.moduleSize.notes,'l');
 A.change(data.settings,{type:'dock',key:'notes',target:'reader',edge:'bottom'});click('module-reset','notes');
 assert.deepEqual(data.settings.workspaceLayout,{axis:'y',children:[{axis:'x',children:['week','timer','clock','notes']},L0]});assert.equal(data.settings.moduleSize.notes,undefined);
 assert.ok(data.toolbox.agentPins.includes('notes'),'a widget the student reset is theirs: the AI does not move it');
 const source=fs.readFileSync(path.join(__dirname,'../extension/widgets.js'),'utf8');assert.match(source,/data-rd-action="module-reset" data-widget="\$\{key\}">Reset this widget<\/button>/);
 view.destroy();
});

// Cause 4 (seen: Week carried to the right end of its row exchanged places with Clock, which jumped to the row's start;
// Course information carried to the right of Assignment details came back as a swap). Across another module, only its
// middle exchanges places; its left or right third puts the carried module beside it, on that side.
test('carried across a module: its middle exchanges places, its left or right third puts the module beside it',async t=>{
 for(const [x,want] of [[1150,{type:'dock',key:'context',target:'reader',edge:'right'}],[990,{type:'swap',key:'context',target:'reader'}],[820,{type:'dock',key:'context',target:'reader',edge:'left'}]]){
  t.mock.timers.enable({apis:['setTimeout']});const f=fixture();
  f.controller.pointerdown(f.event('context',20,120));t.mock.timers.tick(430);assert.equal(f.controller.dragging(),true);
  f.controller.pointermove(f.event('context',x,130));f.tick(20);f.controller.pointerup(f.event('context',x,130));await Promise.resolve();await Promise.resolve();
  assert.deepEqual(f.calls[0],want,`let go at x ${x}`);f.controller.destroy();t.mock.timers.reset();
 }
});
test('the module under the pointer is the target, not the first one within reach',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();
 // Course information a full row on top; Up next and Assignment details side by side below it, 18 px lower
 f.panels.context.rect={left:0,top:100,right:1180,bottom:300,width:1180,height:200};f.panels.work.rect={left:0,top:318,right:580,bottom:700,width:580,height:382};f.panels.reader.rect={left:600,top:318,right:1180,bottom:700,width:580,height:382};
 f.controller.pointerdown(f.event('reader',620,330));t.mock.timers.tick(430);
 f.controller.pointermove(f.event('reader',300,322));f.tick(20);f.controller.pointerup(f.event('reader',300,322));await Promise.resolve();await Promise.resolve();
 assert.deepEqual(f.calls[0],{type:'swap',key:'reader',target:'work'},'in place of Up next, which the pointer is on (4.0.194: swapped with Course information, 22 px above it)');f.controller.destroy();
});
test('by keyboard: Tab offers the chosen module\'s place, arrows put the module beside, above or below it',async()=>{
 const f=fixture(),k=key=>f.controller.keydown({key,target:f.grips.reader,preventDefault(){}});
 k(' ');k('Tab');assert.match(f.toolbar.querySelector('.rd-snap-preview').attrs['aria-label'],/^Swap Assignment details with Up next$/);
 k('ArrowRight');assert.match(f.toolbar.querySelector('.rd-snap-preview').attrs['aria-label'],/to the right of Up next/);
 k('Enter');await Promise.resolve();await Promise.resolve();assert.deepEqual(f.calls[0],{type:'dock',key:'reader',target:'work',edge:'right'});f.controller.destroy();
});
// Cause 5 (seen at 1366 px: This week carried onto the right end of Clock, the last module of its row, became a whole column
// on the right of Home; the same for Course information onto Assignment details and Clock onto the left end of This week).
// The desk's own edges began 10-12 px inside the outer modules.
test('a module\'s own edge is the module\'s, even at the edge of Home; Home\'s edges begin outside the modules',async t=>{
 for(const [x,want] of [[1176,{type:'dock',key:'context',target:'reader',edge:'right'}],[1200,{type:'dock',key:'context',target:'*',edge:'right'}]]){
  t.mock.timers.enable({apis:['setTimeout']});const f=fixture(),desk=f.container.querySelector('.rd-main');desk.rect={left:0,top:100,right:1180,bottom:500,width:1180,height:400};
  f.controller.pointerdown(f.event('context',20,120));t.mock.timers.tick(430);
  f.controller.pointermove(f.event('context',x,300));f.tick(20);f.controller.pointerup(f.event('context',x,300));await Promise.resolve();await Promise.resolve();
  assert.deepEqual(f.calls[0],want,`let go at x ${x} (the desk ends at 1180)`);f.controller.destroy();t.mock.timers.reset();
 }
});
// Cause 6 (seen at 1366 px with the courses on the left: a module held at the bottom of the window did not scroll Home, so
// "below Assignment details" and "a row across the bottom" could not be reached). On a wide window Home's work column
// scrolls by itself there too (dashboard.js reserve-fit when its overflow is auto); 4.0.165 taught only the dock and the
// top bar to scroll it.
test('courses on the left: a module held at the bottom edge scrolls Home\'s own column',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.container.dataset.courseNavigation='sidebar';
 const doc=f.container.ownerDocument,shell=f.container.querySelector('.rd-shell'),desk=f.container.querySelector('.rd-main');
 const area=doc.createElement();area.className='rd-workspace';desk.remove();area.append(desk);shell.append(area);
 doc.defaultView.getComputedStyle=node=>({overflowY:node===area?'auto':'visible'});
 area.rect={left:0,top:60,width:1400,height:900,right:1400,bottom:960};area.scrollTop=0;Object.defineProperty(area,'scrollHeight',{value:3000});Object.defineProperty(area,'clientHeight',{value:900});
 f.controller.pointerdown(f.event('work',450,120));t.mock.timers.tick(430);assert.equal(f.controller.dragging(),true);
 f.controller.pointermove({...f.event('work'),clientX:450,clientY:940});f.tick(20);
 assert.ok(area.scrollTop>0,'Home\'s column scrolled under the held module');assert.equal(doc.scrollingElement.scrollTop,0);
 const was=area.scrollTop;f.controller.pointermove({...f.event('work'),clientX:450,clientY:1000});f.tick(20);assert.ok(area.scrollTop>was,'held below the column\'s edge, nearer the window\'s: it goes on scrolling');
 f.controller.pointercancel({pointerId:1});f.controller.destroy();
});
// Cause 7 (seen at 1366 and 1707 px: "Assignment details as a full row at the top" was shown on top of Help and landed
// under it; "Notes as a column on the left" was shown beside Help and landed below it). With Help drawn on top and no place
// of its own, a whole row or column of the desk is laid out from Home as it is drawn, as the preview is.
test('a whole row or column of Home lands where its preview showed it, with Help on top',()=>{
 for(const edge of ['top','left','right','bottom']){
  const s={workspaceLayout:clone(L1)},key=edge==='top'?'reader':'notes',preview=M.dock(M.drawn(s),key,M.ROOT,edge);
  assert.equal(M.change(s,{type:'dock',key,target:M.ROOT,edge}),true);assert.deepEqual(M.drawn(s),preview,edge);
  assert.deepEqual(M.leaves(s.workspaceLayout).includes('help'),false,'the layout older builds read never names Help');
  assert.equal(M.change(s,{type:'undo'}),true);assert.deepEqual(M.drawn(s),M.drawn({workspaceLayout:L1}),'Undo move: as before, Help on top again');
 }
});
// Cause 8 (seen at 1707 px: Up next brought up to the bottom of This week exchanged places with it). Only a module carried
// down to another's bottom went below it; brought up or across, it swapped.
test('the bottom of a module means below it, from whichever side the carried module comes',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();
 f.controller.pointerdown(f.event('context',20,480));t.mock.timers.tick(430);
 f.controller.pointermove(f.event('context',590,470));f.tick(20);f.controller.pointerup(f.event('context',590,470));await Promise.resolve();await Promise.resolve();
 assert.deepEqual(f.calls[0],{type:'dock',key:'context',target:'work',edge:'bottom'});f.controller.destroy();
});
// Cause 9 (seen in the after run at 1024 px: This week carried to the right end of Clock landed beside Focus, the module that had
// been under that point before Home scrolled). The places are measured at the lift; a scroll that was not the held module's own
// (the wheel, or the browser keeping its place while a preview changes heights above the view) left them where they had been.
test('Home scrolled during a carry by anything but the held module: the places move with it',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();const doc=f.container.ownerDocument;
 // two rows: Course information over Up next on the left; Assignment details on the right, lower down
 f.panels.context.rect={left:0,top:100,right:580,bottom:400,width:580,height:300};f.panels.work.rect={left:0,top:418,right:580,bottom:900,width:580,height:482};f.panels.reader.rect={left:600,top:100,right:1180,bottom:900,width:580,height:800};
 f.controller.pointerdown(f.event('reader',620,120));t.mock.timers.tick(430);
 // the page scrolls 300 px by itself: Up next now shows at 118..600, Course information above the window
 doc.scrollingElement.scrollTop=300;for(const k of ['context','work','reader']){const r=f.panels[k].rect;f.panels[k].rect={...r,top:r.top-300,bottom:r.bottom-300};}
 f.controller.pointermove(f.event('reader',290,140));f.tick(20);f.controller.pointerup(f.event('reader',290,140));await Promise.resolve();await Promise.resolve();
 assert.deepEqual(f.calls[0],{type:'swap',key:'reader',target:'work'},'in place of Up next, which is under the pointer now (4.0.194: Course information, which had been there)');f.controller.destroy();
});
// Cause 10 (seen in the after run: Shift+Right on a grip did nothing on the page). The page listens for keys on the document, so
// the event's target is the shadow host; the focused grip is the first element of the event's path.
test('Shift+arrows work when the key is heard on the document (the grip is first in the event\'s path)',()=>{
 const t=sized(),host={closest:()=>null};
 assert.equal(t.controller.keydown({key:'ArrowRight',shiftKey:true,target:host,composedPath:()=>[t.f.grips.work,host],preventDefault(){}}),true);
 assert.deepEqual(t.calls.at(-1),{type:'size',key:'work',value:'l'});t.controller.destroy();
});
