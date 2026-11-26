'use strict';
require('../extension/site.js');
// fix-42 (review-42 finding 2): Help's width is kept on its own (settings.helpSize), beside the layout as Help's place is,
// never in moduleSize: Canvas Harness 4.0.194 refuses a whole record whose moduleSize names a module it does not know, so rolling
// back, or restoring a 4.2 backup into an older build, failed on the whole record. Records a 4.2 preview already wrote
// with Help in moduleSize load and are moved over. The older build here is 4.0.194's own storage code, byte for byte
// (tests/fixtures/older-4.0.194/extension, the files storage.js loads to read a record), run as Canvas runs it: page scripts in
// one world of their own, so nothing of this build's modules is seen by it. (Sample data only.)
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHash}=require('node:crypto');
const A=require('../extension/workspace-arrange.js'),Storage=require('../extension/storage.js'),Core=require('../extension/core.js');
const OLD=path.join(__dirname,'fixtures','older-4.0.194','extension');
const OLD_FILES={'gpa-model.js':'b7c60c1b57ac03ba54198d8e508ff04babfe1da455db84432bd6a780d728e5b6','personal-work.js':'9ca9058a0bd4699b1e94b9cc41f9313c745a1ce6ff7f95cb3a11add8f8af5ba4','page-preferences.js':'1e23ad1a33cf5f75af241fc2701212f4f059e2ebb6598e8b73aaedef3c454ebe','workspace-arrange.js':'b1164b5bbdb93567d488fccffc981ee76f73f03938110d4c0801f1e27c4f84e8','customization-model.js':'a0302883dc53d89cd8a2bfe08eb893d0fa98aacd933242e9709e25db30badc4f','storage.js':'4e04a178a5288d46c2a2ce671204601f49956f71a50d5651d756280c21d59e5c'};
const json=v=>JSON.parse(JSON.stringify(v));
function memory(){const data={};return {data,read:async k=>structuredClone(data[k]),write:async(k,v)=>{data[k]=structuredClone(v);}};}
function olderBuild(){
 const ctx=vm.createContext({console,structuredClone,TextEncoder,TextDecoder,crypto:globalThis.crypto,setTimeout,clearTimeout,URL});
 for(const file of Object.keys(OLD_FILES))vm.runInContext(fs.readFileSync(path.join(OLD,file),'utf8'),ctx,{filename:'chp-194/'+file});
 return ctx.ReserveStorage;
}
const helpIn=widths=>Object.hasOwn(widths||{},'help');
// what 4.2 saves, as it is in the account's storage (not what the store hands back)
const record=adapter=>adapter.data[Object.keys(adapter.data).find(k=>k.startsWith('reserve:v1:'))];


test('Help moved beside Up next and made Wide: 4.2 draws it wide; the record and its backup load in 4.0.194',async()=>{
 const adapter=memory(),store=Storage.createStore({accountId:'1',adapter});await store.load();
 await store.update(data=>{A.change(data.settings,{type:'dock',key:'help',target:'work',edge:'left'});A.setSize(data.settings,'help','l');A.setSize(data.settings,'reader','s');});
 const s=store.get().settings;
 assert.deepEqual(A.sizes(s),{reader:'s',help:'l'},'drawn: Help wide, Assignment details narrow');assert.equal(s.helpSize,'l');assert.equal(helpIn(s.moduleSize),false);
 const saved=record(adapter).settings;assert.equal(saved.helpSize,'l');assert.equal(helpIn(saved.moduleSize),false);assert.equal(helpIn(saved.workspaceUndo?.moduleSize),false,'nor in the undo copy');
 assert.notEqual(A.grid(A.drawn(s),1400,A.sizes(s)).columns,A.grid(A.drawn(s),1400,{reader:'s'}).columns,'the width is laid out');
 // 4.0.194: the same account storage, and the backup
 const old=olderBuild(),oldStore=old.createStore({accountId:'1',adapter}),back=await oldStore.load();
 assert.deepEqual(json(back.settings.moduleSize),{reader:'s'},'4.0.194 keeps the widths it knows');assert.deepEqual(json(back.settings.workspaceLayout),json(s.workspaceLayout),'and the layout');
 const restored=old.validateBackup(JSON.stringify(store.exportBackup()));assert.deepEqual(json(restored.settings.moduleSize),{reader:'s'});
 // 4.0.194 saves (it knows neither Help's place nor its width, and lets both go); back in 4.2 nothing is refused and
 // Help is drawn where it always was, at its normal width
 await oldStore.update(data=>{data.tasks['7']={notes:'Saved in 4.0.194'};});oldStore.destroy?.();
 const again=await Storage.createStore({accountId:'1',adapter}).load();assert.equal(again.tasks['7'].notes,'Saved in 4.0.194');assert.equal(again.settings.helpSize,undefined);assert.equal(again.settings.helpLayout,undefined);
 assert.equal(A.drawn(again.settings).children[0],'help');assert.deepEqual(A.sizes(again.settings),{reader:'s'});store.destroy?.();
});

test('Help made Wide, moved, then taken off: the undo copy keeps its width beside the layout; 4.0.194 still loads the record',async()=>{
 const adapter=memory(),store=Storage.createStore({accountId:'2',adapter});await store.load();
 await store.update(data=>{A.setSize(data.settings,'help','l');A.change(data.settings,{type:'dock',key:'help',target:'work',edge:'left'});});
 await store.update(data=>{A.change(data.settings,{type:'remove',key:'help'});});
 const saved=record(adapter).settings;assert.equal(saved.showHelp,false);assert.equal(helpIn(saved.moduleSize),false);assert.equal(helpIn(saved.workspaceUndo.moduleSize),false);assert.equal(saved.workspaceUndo.helpSize,'l');
 const old=olderBuild();await assert.doesNotReject(old.createStore({accountId:'2',adapter}).load());assert.doesNotThrow(()=>old.validateBackup(JSON.stringify(store.exportBackup())));
 // Undo move in 4.2 gives Help back with its width
 await store.update(data=>{assert.equal(A.change(data.settings,{type:'undo'}),true);});
 const s=store.get().settings;assert.equal(s.showHelp,true);assert.equal(A.sizes(s).help,'l');store.destroy?.();
});

test('a record a 4.2 preview saved with Help in moduleSize loads, keeps the width, and is moved over on the next save',async()=>{
 const layout={axis:'x',children:['help','context','work','reader']},stripped={axis:'x',children:['context','work','reader']};
 const preview={settings:{moduleSize:{help:'l',reader:'s'},workspaceLayout:stripped,helpLayout:layout,workspaceOrder:['context','work','reader'],workspaceMode:'side-by-side',showHelp:true,
  workspaceUndo:{order:['context','work','reader','notes'],mode:'side-by-side',layout:{axis:'x',children:['context','work','reader','notes']},courseNavigation:'sidebar',dockSize:'medium',showCourseInformation:true,showCourseStrip:true,showHelp:true,moduleSize:{help:'s',notes:'l'}}}};
 assert.throws(()=>olderBuild().validateBackup({format:'reserve-backup',version:1,data:json(preview)}),/Invalid moduleSize/,'(as the review found it)');
 // read by this build: the width is Help's, in its own place
 const clean=Storage.validateBackup({format:'reserve-backup',version:1,data:json(preview)}).settings;
 assert.deepEqual(clean.moduleSize,{reader:'s'});assert.equal(clean.helpSize,'l');assert.deepEqual(clean.workspaceUndo.moduleSize,{notes:'l'});assert.equal(clean.workspaceUndo.helpSize,'s');
 assert.deepEqual(A.sizes(clean),{reader:'s',help:'l'});assert.deepEqual(A.sizes(preview.settings),{reader:'s',help:'l'},'and as it stands, before any cleaning');
 // in the account's storage: loaded as it is, written back without it by the next save, then 4.0.194 reads it
 const adapter=memory(),key='reserve:v1:https://school.instructure.com:3';adapter.data[key]=json(preview);
 const store=Storage.createStore({accountId:'3',adapter});const loaded=await store.load();assert.equal(A.sizes(loaded.settings).help,'l');
 await store.update(data=>{A.setSize(data.settings,'work','l');});
 const saved=adapter.data[key].settings;assert.equal(helpIn(saved.moduleSize),false);assert.equal(saved.helpSize,'l');assert.equal(helpIn(saved.workspaceUndo.moduleSize),false);
 await assert.doesNotReject(olderBuild().createStore({accountId:'3',adapter}).load());
 // Undo in this build gives back the undo copy's widths, Help's included (the undo copy is the preview's)
 await store.update(data=>{A.change(data.settings,{type:'undo'});});assert.deepEqual(A.sizes(store.get().settings),{notes:'l',help:'s'});store.destroy?.();
});

test('setting a width: Normal is no entry, Help\'s never goes into moduleSize, a width this build does not know is dropped',()=>{
 const s={moduleSize:{reader:'l'}};assert.equal(A.setSize(s,'help','s'),true);assert.deepEqual(s,{moduleSize:{reader:'l'},helpSize:'s'});
 A.setSize(s,'help','m');assert.deepEqual(s,{moduleSize:{reader:'l'}});A.setSize(s,'notes','s');A.setSize(s,'reader','m');assert.deepEqual(s,{moduleSize:{notes:'s'}});
 assert.equal(A.setSize(s,'nope','l'),false);assert.equal(A.setSize(s,'help','xl'),false);assert.deepEqual(s,{moduleSize:{notes:'s'}});
 const legacy={moduleSize:{help:'l'},helpSize:'s'};A.setSize(legacy,'help','m');assert.deepEqual(A.sizes(legacy),{},'Normal chosen over a preview\'s Wide');assert.deepEqual(legacy,{moduleSize:{}});
 assert.deepEqual(A.cleanSaved({helpSize:'xl'}).helpSize,undefined,'a later build\'s width: dropped, never a refusal');assert.doesNotThrow(()=>A.cleanSaved({helpSize:7}));
 // the writers and readers in Home use these
 const src=f=>fs.readFileSync(path.join(__dirname,'../extension',f),'utf8');
 assert.match(src('widgets.js'),/if\(action==='wide'\)A\.setSize\(data\.settings,'help','l'\);/);assert.match(src('widgets.js'),/save\(data=>\{A\.setSize\(data\.settings,key,size\);pinModule\(data,key\);\}\)/);
 assert.match(src('widgets.js'),/const A=Arrange\(\),size=A\.sizes\(ctx\(\)\.s\)\[key\]\|\|'m'/);assert.match(src('workspace-gestures.js'),/const saved=M\.sizes\?M\.sizes\(getSettings\(\)\):/);
 assert.doesNotMatch(src('widgets.js'),/moduleSize,help:'l'/);
});

test('Biscuit\'s "make Help wide" goes through the same writer: the saved record carries no Help in moduleSize',async()=>{
 const adapter=memory(),store=Storage.createStore({accountId:'4',adapter});await store.load();
 let captured;const doc={addEventListener(){},removeEventListener(){},defaultView:{addEventListener(){},removeEventListener(){}}},container={ownerDocument:doc,querySelector:()=>null,querySelectorAll:()=>[]},save=fn=>store.update(fn).then(()=>true);
 const env=vm.createContext({console,Date,Intl,Map,Set,Promise,URL,ReserveCore:Core,ReserveWorkspaceArrange:A,ReserveFeatures:{enabled:()=>true},ReservePetArt:{},ReservePets:{clean:v=>({...v}),create:o=>{captured=o;return {sync(){},setFocus(){},destroy(){}};}},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}});
 for(const file of ['planner-model.js','widgets.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension',file),'utf8'),env,{filename:file});
 const w=env.ReserveWidgets.create({container,store,save,rerender(){},getContext:()=>({s:store.get().settings,personal:store.get(),items:[],courses:[],local:store.get().tasks,now:Date.now()}),helpers:()=>({dayKey:Core.dayKey,complete:Core.isComplete})});w.sync();
 await captured.actions.module({key:'help',action:'wide'});
 const saved=record(adapter).settings;assert.equal(saved.helpSize,'l');assert.equal(helpIn(saved.moduleSize),false);assert.equal(A.sizes(store.get().settings).help,'l');
 await assert.doesNotReject(olderBuild().createStore({accountId:'4',adapter}).load());w.destroy?.();store.destroy?.();
});
