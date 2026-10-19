'use strict';
// The Modules page upgrade (extension/modules-plus.js): what counts as done, module progress, and "Continue".
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const M=require('../extension/modules-plus.js'),src=fs.readFileSync(path.join(__dirname,'..','extension','modules-plus.js'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'..','extension','manifest.json'),'utf8'));

const subs=M.submissions([
 {id:1,submission:{submitted_at:'2026-10-10T12:00:00Z',workflow_state:'submitted'}},
 {id:2,submission:{workflow_state:'unsubmitted',missing:true}},
 {id:3,quiz_id:30,submission:{workflow_state:'graded',score:9}},// graded without an online hand-in (in class)
 {id:4,discussion_topic:{id:40},submission:{excused:true}}]);

test('what counts as done: Canvas first, then submissions, then your own marks',()=>{
 assert.deepEqual(M.statusOf({type:'SubHeader'},subs),null);
 assert.equal(M.statusOf({type:'Page',completion_requirement:{completed:true}},subs).by,'canvas');
 assert.equal(M.statusOf({type:'Assignment',content_id:1},subs).by,'submitted');
 assert.equal(M.statusOf({type:'Quiz',content_id:30},subs).done,true);
 assert.equal(M.statusOf({type:'Discussion',content_id:40},subs).done,true);
 const open=M.statusOf({type:'Assignment',content_id:2},subs,'opened');
 assert.equal(open.done,false,'opening an assignment is not finishing it');
 assert.equal(M.statusOf({type:'Assignment',content_id:2},subs,'done').by,'you');
 assert.equal(M.statusOf({type:'File',content_id:9},subs,'opened').by,'opened');
 assert.equal(M.statusOf({type:'File',content_id:9},subs,'undone').done,false);
 assert.equal(M.statusOf({type:'Assignment',content_id:1},subs,'undone').canToggle,false,'Canvas-confirmed items stay done');
});

test('module progress skips headers; Continue finds the first unfinished, unlocked item',()=>{
 const modules=[
  {id:1,state:'completed',items:[{id:11,type:'SubHeader'},{id:12,type:'Assignment',content_id:1},{id:13,type:'File',content_id:5}]},
  {id:2,state:'locked',items:[{id:21,type:'Page'}]},
  {id:3,state:'unlocked',items:[{id:31,type:'Page',content_details:{locked_for_user:true}},{id:32,type:'ExternalUrl'}]}];
 assert.deepEqual(M.progress(modules[0].items,subs,{}),{done:1,total:2});
 assert.equal(M.nextItem(modules,subs,{}).id,13);
 assert.equal(M.nextItem(modules,subs,{13:'opened'}).id,32,'skips locked modules and locked items');
 assert.equal(M.nextItem(modules,subs,{13:'opened',32:'done'}),null);
});

test('read-only toward Canvas, its own names, only on a Modules page, and off while Canvas Harness is off',()=>{
 assert.doesNotMatch(src,/method:\s*['"](POST|PUT|PATCH|DELETE)/i,'it only reads from Canvas');
 assert.match(src,/\/api\/v1\/courses\/\$\{c\}\/modules\?include\[\]=items&include\[\]=content_details/);
 assert.match(src,/const KEY='reserve:moduleProgress',PREF='reserve:modulesHideDone';/,'marks stay in the Canvas page\u2019s own storage');
 assert.doesNotMatch(src,/['".]ch-/,'the workspace\u2019s reserve- names');
 assert.match(src,/const list=document\.getElementById\('context_modules'\);const c=course\(\);if\(!list\|\|!c\|\|list\.dataset\.reserveMods\)return;/,'nothing happens without Canvas\u2019s module list');
 assert.ok(src.indexOf("getElementById('context_modules')")<src.indexOf("st.id='reserve-mods-style'"),'its styles are added only on a Modules page');
 assert.match(src,/root\.chrome\.storage\.local\.get\('reserve:enabled'\)\.then\(v=>\{if\(v\['reserve:enabled'\]!==false\)go\(\);\}\)/);
 const js=manifest.content_scripts.find(c=>c.js.includes('content.js')).js;
 assert.ok(js.includes('modules-plus.js'));assert.equal(js.at(-1),'content.js');
});
