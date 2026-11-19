'use strict';
// Roadmap item 6 (owner, 2026-11): "Check that Undo move actually works". Undo move takes Home back to the arrangement
// before the last move: every module's place AND its width (Narrow / Normal / Wide), after a reload too.
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../extension/workspace-arrange.js'),G=require('../extension/workspace-gestures.js'),{fixture}=require('./gesture-fixture.cjs');
const customization=require('../extension/customization-model.js'),storage=require('../extension/storage.js');
const home=s=>({layout:M.snapshot(s).layout,sizes:{...(s.moduleSize||{})},info:s.showCourseInformation!==false});
// A width choice from the module menu, as widgets.js saves it (module-size).
const resize=(s,key,size)=>{const sizes={...(s.moduleSize||{})};if(size==='m')delete sizes[key];else sizes[key]=size;s.moduleSize=sizes;};
function store(){const raw=new Map(),adapter={read:async key=>structuredClone(raw.get(key)),write:async(key,value)=>raw.set(key,structuredClone(value))};return {accountId:'37',origin:'https://school.instructure.com',adapter};}

test('a move then Undo move gives back the exact earlier layout, widths included',()=>{
 const s={...customization.defaults};M.change(s,{type:'add',key:'notes'});resize(s,'notes','l');resize(s,'work','s');
 const before=home(s);assert.equal(M.change(s,{type:'dock',key:'notes',target:'reader',edge:'bottom'}),true);assert.notDeepEqual(home(s),before);
 assert.equal(M.change(s,{type:'undo'}),true);assert.deepEqual(home(s),before);assert.equal(s.workspaceUndo,null,'one step: the undo is used up');
});
test('Undo move after several moves takes back only the last one',()=>{
 const s={};M.change(s,{type:'swap',key:'context',target:'reader'});const afterFirst=home(s);
 M.change(s,{type:'dock',key:'work',target:'reader',edge:'bottom'});M.change(s,{type:'undo'});
 assert.deepEqual(home(s),afterFirst);assert.equal(M.change(s,{type:'undo'}),false);
});
test('a width changed after the move is taken back with it: Home returns to the arrangement it had before the move',()=>{
 const s={};M.change(s,{type:'add',key:'clock'});const before=home(s);
 M.change(s,{type:'dock',key:'clock',target:'work',edge:'bottom'});resize(s,'clock','l');resize(s,'reader','s');
 assert.equal(M.change(s,{type:'undo'}),true);assert.deepEqual(home(s),before,'places and widths both as before the move');
});
test('a width changed before the move stays: Undo move only takes back the move',()=>{
 const s={};M.change(s,{type:'add',key:'clock'});resize(s,'clock','s');const before=home(s);
 M.change(s,{type:'swap',key:'clock',target:'reader'});M.change(s,{type:'undo'});assert.deepEqual(home(s),before);
});
test('Undo move works after a reload, widths included',async()=>{
 const account=store(),first=storage.createStore(account);await first.load();let before;
 await first.update(data=>{M.change(data.settings,{type:'add',key:'week'});resize(data.settings,'week','l');before=home(data.settings);M.change(data.settings,{type:'dock',key:'week',target:'context',edge:'bottom'});resize(data.settings,'week','s');});
 const again=storage.createStore(account),data=await again.load();assert.ok(data.settings.workspaceUndo);
 await again.update(record=>{assert.equal(M.change(record.settings,{type:'undo'}),true);});
 assert.deepEqual(home(again.get().settings),before);first.destroy();again.destroy();
});
test('backups: an undo record without widths (made before 4.0.165) still loads and undoes the places only',()=>{
 const s={};M.change(s,{type:'swap',key:'context',target:'work'});const old={...s,workspaceUndo:{...s.workspaceUndo}};delete old.workspaceUndo.moduleSize;old.moduleSize={work:'l'};
 const clean=customization.cleanSettings(old);assert.equal(M.change(clean,{type:'undo'}),true);assert.deepEqual(M.snapshot(clean).layout,M.DEFAULT.layout);assert.deepEqual(clean.moduleSize,{work:'l'});
 assert.throws(()=>customization.cleanSettings({...s,workspaceUndo:{...s.workspaceUndo,moduleSize:{work:'huge'}}}),/Invalid moduleSize/);
});
test('widths given back belong only to modules in the layout given back (an expired AI module leaves no width behind)',()=>{
 const s={};M.change(s,{type:'add',key:'ai-old'});resize(s,'ai-old','l');M.change(s,{type:'swap',key:'context',target:'work'});
 // the AI module expires: agent-home.js expire() removes it, its width and its place in the undo copy
 M.change(s,{type:'remove',key:'ai-old'});delete s.moduleSize['ai-old'];s.workspaceUndo.layout=M.prune(s.workspaceUndo.layout,'ai-old');s.workspaceUndo.order=M.leaves(s.workspaceUndo.layout);
 assert.equal(M.change(s,{type:'undo'}),true);assert.equal(Object.hasOwn(s.moduleSize,'ai-old'),false);
});
// The Undo move button itself (gestures action -> save -> layout drawn).
test('the Undo move button lays the earlier columns out again at once, even right after a width was picked',async()=>{
 const f=fixture(),desk=f.container.querySelector('.rd-main');for(const n of [desk,...Object.values(f.panels)])n.style.getPropertyValue=k=>n.style[k]||'';
 f.controller.sync();const columns=desk.style['--rd-layout-columns'];
 M.change(f.settings,{type:'swap',key:'context',target:'reader'});f.controller.previewSize('work','l');resize(f.settings,'work','l');f.controller.sync();
 assert.notEqual(desk.style['--rd-layout-columns'],columns);
 assert.equal(f.controller.action({dataset:{rdAction:'arrange-undo'}}),true);await Promise.resolve();await Promise.resolve();
 assert.deepEqual(f.calls.at(-1),{type:'undo'});assert.equal(desk.style['--rd-layout-columns'],columns,'the earlier widths are drawn, not the width picked a moment ago');
 assert.equal(f.panels.context.style['--rd-panel-column'],'1 / 2');f.controller.destroy();
});
