// Adapted from Gary Wu's pull request #45 to Canvas Harness.
const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('../extension/hand-in.js'),Core=require('../extension/core.js'),Storage=require('../extension/storage.js'),Arrange=require('../extension/workspace-arrange.js');
const now=Date.parse('2026-10-21T16:00:00Z'),item=(id,dueAt,over={})=>({id:String(id),name:'Work '+id,courseId:'7',dueAt,state:'unsubmitted',submissionTypes:['online_upload'],...over});
const context=(items,local={})=>({items,local,now,s:{timeZone:'America/New_York'},courseMap:new Map([['7',{name:'Course'}]])});
test('handin weeks end Sunday, including Sunday itself',()=>{
 assert.deepEqual(H.weekEnds('2026-10-21'),{thisWeek:'2026-10-25',nextWeek:'2026-11-01'});
 assert.deepEqual(H.weekEnds('2026-10-25'),{thisWeek:'2026-10-25',nextWeek:'2026-11-01'});
});
test('handin groups missing, overdue and due soon without dropping old or undated missing work',()=>{
 const c=context([item(1,'2026-09-01',{missing:true}),item(2,null,{missing:true}),item(3,'2026-10-20'),item(4,'2026-10-23'),item(5,'2026-10-30'),item(6,'2026-11-03'),item(7,'2026-10-23',{submissionTypes:['on_paper']}),item(8,'2026-10-23',{submissionTypes:['online_quiz']}),item(9,'2026-10-23',{state:'submitted'}),item(10,null),item(11,'2026-10-23',{state:'excused',missing:true})]);
 const l=H.lists(c);assert.deepEqual(l.missing.map(x=>x.id),['2','1']);assert.deepEqual(l.overdue.map(x=>x.id),['3']);assert.deepEqual(l.thisWeek.map(x=>x.id),['4']);assert.deepEqual(l.nextWeek.map(x=>x.id),['5']);
});
test('handin uses current completion semantics for graded missing and redo work',()=>{
 const l=H.lists(context([item(1,'2026-10-20',{state:'graded',missing:true}),item(2,'2026-10-20',{state:'submitted',redoRequested:true}),item(3,'2026-10-20',{state:'graded'})]));
 assert.deepEqual(l.missing.map(x=>x.id),['1','2']);assert.equal(l.overdue.length,0);
});
test('handin dismissals remain recoverable beyond their original date window and after Canvas changes',()=>{
 const work=item(1,'2026-12-01',{state:'graded'}),c=context([work],{'1':{checkedOff:true,doneReason:'paper'}}),l=H.lists(c);
 assert.equal(l.hidden.length,1);assert.equal(l.hidden[0].reason,'paper');assert.equal(H.lists({...c,local:{'1':{checkedOff:false}}}).hidden.length,0);
 const hidden=H.lists(context([item(2,'2026-10-20')],{'2':{checkedOff:true}}));assert.equal(hidden.hidden.length,1,'shared Mark done is also recoverable');
});
test('handin respects course scope and calendar boundaries in the student timezone',()=>{
 const l=H.lists({...context([item(1,'2026-10-26T02:00:00Z'),item(2,'2026-10-26T06:00:00Z'),item(3,'2026-10-23',{courseId:'8'})]),state:{courseId:'7'}});
 assert.deepEqual(l.thisWeek.map(x=>x.id),['1']);assert.deepEqual(l.nextWeek.map(x=>x.id),['2']);
});
test('handin renders escaped labels, recoverable undo and all four reasons without artwork',()=>{
 const h={E:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),dayKey:Core.dayKey,complete:Core.isComplete,formatDate:value=>value},action=(name,text,attrs)=>`<button data-rd-action="${name}" ${attrs}>${text}</button>`;
 const html=H.render(context([item(1,'2026-10-23',{name:'<script>'}),item(2,'2026-10-20')],{'2':{checkedOff:true,doneReason:'class'}}),h,{action});
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|<svg|style=/);assert.match(html,/handin-undo/);for(const [reason]of H.REASONS)assert.match(html,new RegExp(`data-value="${reason}"`));
});
test('handin completion reasons stay account bound and roundtrip in backups with shared undo',async()=>{
 const data=new Map(),adapter={read:async key=>structuredClone(data.get(key)),write:async(key,value)=>data.set(key,structuredClone(value))},a=Storage.createStore({accountId:'1',adapter}),b=Storage.createStore({accountId:'2',adapter});await a.load();await b.load();
 await a.update(s=>{s.tasks['1']={checkedOff:true,doneReason:'paper',notes:'Keep'};});assert.equal(Core.isWorkComplete(item(1,null),a.get().tasks['1']),true);assert.equal(b.get().tasks['1'],undefined);assert.equal(Storage.validateBackup(a.exportBackup()).tasks['1'].doneReason,'paper');
 await a.update(s=>{s.tasks['1'].checkedOff=false;delete s.tasks['1'].doneReason;});assert.equal(a.get().tasks['1'].notes,'Keep');assert.equal(Core.isWorkComplete(item(1,null),a.get().tasks['1']),false);
 const bad=a.exportBackup();bad.data.tasks['1'].doneReason='unknown';assert.equal(Storage.validateBackup(bad).tasks['1'].doneReason,undefined);a.destroy();b.destroy();
});
test('handin is an independently arranged Planner module',()=>{
 assert.ok(Arrange.EXTRA.includes('handin'));assert.equal(Arrange.label('handin'),'To hand in');const settings={};Arrange.change(settings,{type:'add',key:'handin'});assert.ok(Arrange.snapshot(settings).order.includes('handin'));
});
