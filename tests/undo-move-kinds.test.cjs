'use strict';
require('../extension/site.js');
// Roadmap item 6 (owner, 2026-11): "Check that Undo move actually works". Every kind of move, the way the student makes
// it: a module's menu (widgets.js click, as Home runs it) and a drag (the change the gestures save), then Undo move (the
// change the Undo move control saves, workspace-gestures.js 'arrange-undo' -> {type:'undo'}). Undo move is offered only
// while there is something to undo (dashboard.js hasLayoutUndo = settings.workspaceUndo).
// What is NOT a move, and so leaves Undo move as it is: picking a width alone (the owner's open decision since 4.0.165,
// unchanged here) and Pin / Unpin.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A=require('../extension/workspace-arrange.js');
const clone=v=>JSON.parse(JSON.stringify(v));
// widgets.js over a plain store, as agent-ui.test.cjs runs it: a menu press saves through the same functions Home uses
function home(settings={}){
 const env={ReserveWorkspaceArrange:A,ReservePlanner:require('../extension/planner-model.js'),ReserveUI:require('../extension/ui-utils.js'),setTimeout,clearTimeout,setInterval,clearInterval,addEventListener(){},removeEventListener(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../extension/widgets.js'),'utf8'),env);
 const data={settings:clone(settings),toolbox:{}},doc={addEventListener(){},removeEventListener(){},defaultView:env},container={ownerDocument:doc,querySelector:()=>null,querySelectorAll:()=>[]};
 const view=env.ReserveWidgets.create({container,store:{get:()=>data},save:async fn=>{fn(data);return true;},rerender(){},getContext:()=>({personal:data,s:{timeZone:'UTC'},items:[],local:{},courses:[],courseMap:new Map(),now:Date.UTC(2026,10,22)}),helpers:()=>({E:require('../extension/ui-utils.js').escapeHTML,formatDate:()=>'',dayKey:()=>'2026-11-22',complete:()=>false})});
 const click=(action,key,value)=>view.click({target:{closest:selector=>selector==='[data-rd-action]'?{dataset:{rdAction:action,widget:key,value}}:null}});
 const undo=()=>A.change(data.settings,{type:'undo'});
 const place=()=>({layout:A.drawn(data.settings),sizes:{...(data.settings.moduleSize||{})},help:data.settings.showHelp!==false,info:data.settings.showCourseInformation!==false});
 return {data,click,undo,place,canUndo:()=>!!data.settings.workspaceUndo,destroy:()=>view.destroy()};
}

test('a module moved from its menu (Top / Bottom / Left / Right): Undo move gives back its place, once',()=>{
 for(const edge of ['top','bottom','left','right']){
  // (Week starts under Assignment details, so every edge is a real move; a menu press that changes nothing is no move,
  // and Undo move then still takes back the move before it)
  const h=home();h.click('widget-add','week');A.change(h.data.settings,{type:'dock',key:'week',target:'reader',edge:'bottom'});const before=h.place();
  h.click('module-dock','week',edge);assert.notDeepEqual(h.place(),before,edge);assert.equal(h.canUndo(),true,'Undo move is offered');
  assert.equal(h.undo(),true);assert.deepEqual(h.place(),before,edge);assert.equal(h.canUndo(),false,'then it is gone');h.destroy();
 }
 // Top for a module under Help puts it above Help, as carrying it to the desk's top edge does (owner, 2026-11-23: the
 // menu matches the drag; until then the menu's row went in under Help and this press changed nothing).
 const h=home();h.click('widget-add','week');const added=h.place();assert.deepEqual(A.leaves(added.layout).slice(0,2),['help','week']);
 h.click('module-dock','week','top');const above=h.place();assert.deepEqual(A.leaves(above.layout).slice(0,2),['week','help'],'above Help');
 const dragged=home();dragged.click('widget-add','week');A.change(dragged.data.settings,{type:'dock',key:'week',target:A.ROOT,edge:'top'});assert.deepEqual(dragged.place().layout,above.layout,'the same place as the drag');dragged.destroy();
 for(const edge of ['bottom','left','right']){const m=home(),d=home();m.click('widget-add','week');d.click('widget-add','week');m.click('module-dock','week',edge);A.change(d.data.settings,{type:'dock',key:'week',target:A.ROOT,edge});assert.deepEqual(m.place().layout,d.place().layout,edge+': menu and drag agree');m.destroy();d.destroy();}
 // a press that changes nothing (Top again) is no move: Undo move still takes back the one before
 h.click('module-dock','week','top');assert.deepEqual(h.place(),above);
 assert.equal(h.undo(),true);assert.deepEqual(h.place(),added,'the move before it is what Undo move takes back');assert.equal(h.canUndo(),false);h.destroy();
});

test('a module dragged beside, below or onto another: Undo move gives back the arrangement before the drag',()=>{
 const h=home();h.click('widget-add','notes');h.click('widget-add','clock');
 for(const drag of [{type:'dock',key:'notes',target:'reader',edge:'right'},{type:'dock',key:'clock',target:'work',edge:'bottom'},{type:'swap',key:'context',target:'notes'},{type:'dock',key:'work',target:'reader',edge:'top'}]){
  const before=h.place();assert.equal(A.change(h.data.settings,drag),true,JSON.stringify(drag));assert.notDeepEqual(h.place(),before);
  assert.equal(h.undo(),true);assert.deepEqual(h.place(),before,JSON.stringify(drag));assert.equal(h.canUndo(),false);
 }
 // a module taken off Home (its switch in Edit Home, or its remove button) comes back with Undo move too
 const before=h.place();h.click('widget-remove','notes');assert.equal(A.leaves(A.drawn(h.data.settings)).includes('notes'),false);
 assert.equal(h.undo(),true);assert.deepEqual(h.place(),before);h.destroy();
});

test('Help moved from its menu or dragged: Undo move puts the band back where it was (on top, across the width)',()=>{
 const h=home();const before=h.place();assert.equal(before.layout.children[0],'help','Help starts on top');
 h.click('module-dock','help','bottom');assert.deepEqual(A.leaves(h.place().layout).at(-1),'help');assert.ok(h.data.settings.helpLayout,'its place is kept beside the saved layout');
 assert.equal(h.undo(),true);assert.deepEqual(h.place(),before);assert.equal(h.data.settings.helpLayout,undefined,'no stale place left behind');
 assert.equal(A.change(h.data.settings,{type:'dock',key:'help',target:'reader',edge:'right'}),true);const placed=h.place();
 A.change(h.data.settings,{type:'dock',key:'context',target:'help',edge:'bottom'});assert.equal(h.undo(),true);assert.deepEqual(h.place(),placed,'a move after Help was placed gives back Help’s place too');
 // Help taken off from its own bar comes back with Undo move, still switched on (showHelp)
 h.click('widget-remove','help');assert.equal(h.data.settings.showHelp,false);assert.equal(h.undo(),true);assert.equal(h.data.settings.showHelp,true);assert.deepEqual(h.place(),placed);h.destroy();
});

test('a width picked alone is not a move: no Undo move appears; after a move, Undo move takes the later width back with it',()=>{
 const h=home();h.click('widget-add','week');h.data.settings.workspaceUndo=null;
 h.click('module-size','week','l');assert.equal(h.data.settings.moduleSize.week,'l');assert.equal(h.canUndo(),false,'nothing to undo after a width alone (owner’s open decision, unchanged)');
 h.click('module-size','help','s');assert.equal(h.canUndo(),false,'Help’s width is the same');
 const before=h.place();h.click('module-dock','week','right');h.click('module-size','week','s');
 assert.equal(h.undo(),true);assert.deepEqual(h.place(),before,'place and width as before the move');
 // a width picked before a move stays when that move is undone
 h.click('module-size','reader','l');const sized=h.place();A.change(h.data.settings,{type:'swap',key:'context',target:'week'});h.undo();assert.deepEqual(h.place(),sized);h.destroy();
});


test('Undo move survives a backup round trip of the settings, and takes back only the last move',()=>{
 const Customization=require('../extension/customization-model.js');
 const h=home();h.click('widget-add','week');h.click('module-dock','week','bottom');const middle=h.place();h.click('module-dock','help','right');
 const restored=Customization.cleanSettings(clone(h.data.settings));assert.ok(restored.workspaceUndo);
 assert.equal(A.change(restored,{type:'undo'}),true);assert.deepEqual(A.drawn(restored),middle.layout);assert.equal(A.change(restored,{type:'undo'}),false);h.destroy();
});
