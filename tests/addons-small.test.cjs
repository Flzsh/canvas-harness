'use strict';
// The small helpers: New since your last visit, Late cost now, heavy days, Easy read, the reading ruler.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../extension/dashboard-model.js'),S=require('../extension/storage.js');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
const hour=3600000,day=24*hour,due=Date.parse('2026-11-01T12:00:00Z'),policy=(extra={})=>({late_submission_deduction_enabled:true,late_submission_deduction:10,late_submission_interval:'day',...extra}),item={points:10,dueAt:new Date(due).toISOString()};

test('late cost counts every started day, like Canvas',()=>{
 assert.deepEqual(M.lateCost(item,policy(),due+hour),{percent:10,best:9,points:10,nextPercent:20,nextAt:due+day});
 assert.equal(M.lateCost(item,policy(),due+26*hour).percent,20);
 assert.equal(M.lateCost(item,policy({late_submission_interval:'hour',late_submission_deduction:2}),due+90*60000).percent,4);
});
test('late cost stops at the floor and says nothing past it',()=>{
 const v=M.lateCost(item,policy({late_submission_minimum_percent_enabled:true,late_submission_minimum_percent:50}),due+20*day);
 assert.deepEqual(v,{percent:50,best:5,points:10,nextPercent:null,nextAt:null});
 assert.equal(M.lateCost(item,policy(),due+30*day).best,0);
});
test('late cost stays quiet when nothing is taken or nothing is late',()=>{
 for(const [a,b,c] of [[item,policy(),due-1],[item,policy(),due],[item,null,due+day],[item,policy({late_submission_deduction_enabled:false}),due+day],[item,policy({late_submission_deduction:0}),due+day],[{dueAt:item.dueAt},policy(),due+day],[{points:10},policy(),due+day]])assert.equal(M.lateCost(a,b,c),null);
});
test('the New view shows only what it is given and is never restored from a saved view',()=>{
 const rows=[{id:1,name:'a',dueAt:null},{id:2,name:'b',dueAt:null},{id:3,name:'c',dueAt:null}];
 const out=M.filterAssignments(rows,{mode:'new',newIds:new Set(['2']),now:due,timeZone:'UTC',local:{},courseId:'all'});
 assert.deepEqual(out.items.map(v=>v.id),[2]);
 assert.equal(M.filterAssignments(rows,{mode:'new',now:due,timeZone:'UTC',local:{},courseId:'all'}).items.length,0);
 assert.ok(read('dashboard.js').includes("if(state.mode==='new'&&!newShown)state.mode='actionable';"));
});
test('Easy read is a saved reading choice and survives a backup',()=>{
 const v=S.validateBackup({format:'reserve-backup',version:1,data:{settings:{readingFont:'easy'}}});assert.equal(v.settings.readingFont,'easy');
 assert.throws(()=>S.validateBackup({format:'reserve-backup',version:1,data:{settings:{readingFont:'comic'}}}));
 assert.match(read('refresh.css'),/\.rd\[data-reading-font=easy\]/);assert.match(read('dashboard.js'),/\['interface','easy'\]\.includes\(ctx\.s\.readingFont\)/);
});
test('the reading ruler never takes a click and moves only by transform',()=>{
 const css=read('pdf-reader.css'),js=read('pdf-reader.js');
 assert.match(css,/#reading-ruler\{[^}]*pointer-events:none/);assert.match(js,/rulerBand\.style\.transform=/);assert.doesNotMatch(js,/rulerBand\.style\.top/);
 assert.match(js,/icons\.ruler=/);
});
test('a heavy day is marked in words as well as in ink',()=>{
 assert.match(read('dashboard-view.js'),/a heavy day/);assert.match(read('planner-ui.js'),/a heavy day/);
});
test('the late rate comes from a students own late work, because Canvas keeps the policy from them',()=>{
 const row=(points,deducted,hours,extra={})=>({courseId:'9',late:true,points,pointsDeducted:deducted,secondsLate:hours*3600,score:points-deducted,...extra});
 assert.deepEqual(M.lateHistory([row(10,1,20),row(20,4,30)],'9').policy,{late_submission_deduction_enabled:true,late_submission_deduction:10,late_submission_interval:'day'});
 assert.equal(M.lateHistory([row(10,1,1),row(10,5,5)],'9').policy.late_submission_interval,'hour');
 assert.equal(M.lateHistory([row(10,1,20),row(10,7,30)],'9'),null,'rates that disagree say nothing');
 assert.deepEqual(M.lateHistory([row(10,0,20)],'9'),{clean:true});
 assert.equal(M.lateHistory([row(10,1,20)],'8'),null);
 assert.equal(M.lateHistory([],'9'),null);
 assert.doesNotMatch(read('api.js'),/readLatePolicy/);
});

test('thinking effort: only where the site has it, off by default, and restored after the send',()=>{
 const I=require('../extension/ai-inject.js');
 assert.match(read('study-band.js'),/EFFORTS=\{chatgpt:\[\['instant','Instant'\],\['medium','Medium'\],\['high','High'\],\['extra','Extra high'\]\],claude:\[\['low','Low'\],\['medium','Medium'\],\['high','High'\],\['extra','Extra'\]\]\}/);
 assert.match(read('ai-inject.js'),/want === 'max'/,'Claude\'s Max costs several times the usage and is never chosen for the student');
 assert.equal(typeof I.setEffort,'function');
 // (the public tree spreads long lines over several, whitespace only: the code is read without the breaks)
 const web=read('ai-delivery-web.js').replace(/\n[ \t]*/g,'');assert.match(web,/inject\.setEffort,run\.settings\?\.effort\?\{id:run\.provider,value:run\.settings\.effort\}/);assert.match(web,/inject\.setEffort,\{id:run\.provider,\.\.\.\(Number\.isInteger\(receipt\.effortBefore\)\?\{index:receipt\.effortBefore\}:\{value:receipt\.effortBefore\}\)\}/);
});
