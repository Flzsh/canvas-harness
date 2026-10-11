'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Arrange=require('../extension/workspace-arrange.js');
const customization=require('../extension/customization-model.js');
const storage=require('../extension/storage.js');

test('all three panels can be moved before and after any other panel without losing one',()=>{
 const old=['context','work','reader'];
 assert.deepEqual(Arrange.relocate(old,'context','reader','after'),['work','reader','context']);
 assert.deepEqual(Arrange.relocate(old,'reader','context','before'),['reader','context','work']);
 assert.deepEqual(Arrange.relocate(old,'work','reader','after'),['context','reader','work']);
 assert.deepEqual(old,['context','work','reader'],'the source array is never mutated');
 assert.deepEqual(Arrange.relocate(old,'work','unknown'),old,'invalid targets are ignored');
});

test('one-step undo restores a previous complete arrangement and reset keeps unrelated prefs',()=>{
 const settings={...customization.defaults,theme:'dark',accent:'ocean',bannerSize:'large',coursePrefs:{'42':{name:'My course',color:'#123456'}},showGrades:false};
 assert.equal(Arrange.change(settings,{type:'move',key:'context',target:'reader',position:'after'}),true);
 assert.deepEqual(settings.workspaceOrder,['work','reader','context']);
 assert.equal(Arrange.change(settings,{type:'mode',value:'stacked'}),true);
 assert.equal(settings.workspaceMode,'stacked');
 assert.equal(Arrange.change(settings,{type:'hide-context'}),true);
 assert.equal(settings.showCourseInformation,false);
 assert.equal(Arrange.change(settings,{type:'undo'}),true);
 assert.equal(settings.showCourseInformation,true);
 assert.equal(settings.workspaceMode,'stacked');
 assert.equal(Arrange.change(settings,{type:'undo'}),false,'undo is consumed after use');
 assert.equal(Arrange.change(settings,{type:'navigation',value:'topbar'}),true);
 assert.equal(settings.courseNavigation,'topbar');
 assert.equal(Arrange.change(settings,{type:'reset'}),true);
 assert.deepEqual(Arrange.snapshot(settings),Arrange.DEFAULT);
 assert.deepEqual(settings.coursePrefs['42'],{name:'My course',color:'#123456'});
 assert.equal(settings.theme,'dark');assert.equal(settings.accent,'ocean');
 assert.equal(settings.bannerSize,'large');assert.equal(settings.showGrades,false);
 assert.equal(Arrange.change(settings,{type:'undo'}),true,'reset can be undone');
 assert.equal(settings.courseNavigation,'topbar');
});

test('backups reject invalid or duplicate workspace ordering and malformed undo history',()=>{
 assert.deepEqual(Arrange.cleanSaved({deskOrder:'work-first'}).workspaceOrder,['work','reader','context']);
 assert.equal(Arrange.cleanSaved({deskOrder:'stacked'}).workspaceMode,'stacked');
 for(const order of [['context','work','work'],['context','work'],['context','script','reader'],'context,work,reader']){
  assert.throws(()=>customization.cleanSettings({workspaceOrder:order}),/Invalid workspaceOrder/);
 }
 assert.throws(()=>customization.cleanSettings({workspaceMode:'anything'}),/Invalid workspaceMode/);
 assert.throws(()=>customization.cleanSettings({workspaceUndo:{order:['context','work','reader'],mode:'stacked',courseNavigation:'sidebar'}}),/Invalid workspaceUndo/);
});

test('saved order, course rail and focus visibility reopen in same account and backup without changing schoolwork',async()=>{
 const raw=new Map(),adapter={read:async key=>structuredClone(raw.get(key)),write:async(key,value)=>raw.set(key,structuredClone(value))};
 const account={accountId:'37',origin:'https://school.instructure.com',adapter};
 const first=storage.createStore(account);await first.load();
 await first.update(data=>{
  data.tasks['12']={notes:'Keep my draft',pinned:true};
  data.settings.coursePrefs['42']={name:'Special topic',color:'#123456'};
  data.settings.accent='rose';
  Arrange.change(data.settings,{type:'move',key:'reader',target:'context',position:'before'});
  Arrange.change(data.settings,{type:'navigation',value:'topbar'});
  Arrange.change(data.settings,{type:'hide-context'});
 });
 const next=storage.createStore(account),data=await next.load();
 assert.deepEqual(data.settings.workspaceOrder,['reader','context','work']);
 assert.equal(data.settings.courseNavigation,'topbar');
 assert.equal(data.settings.showCourseInformation,false);
 assert.equal(data.settings.accent,'rose');
 assert.equal(data.tasks['12'].notes,'Keep my draft');assert.equal(data.tasks['12'].pinned,true);
 assert.deepEqual(storage.validateBackup(next.exportBackup(),next.owner),data);
 await next.update(record=>Arrange.change(record.settings,{type:'undo'}));
 assert.equal(next.get().settings.showCourseInformation,true);
 assert.equal(next.get().settings.courseNavigation,'topbar');
 first.destroy();next.destroy();
});
