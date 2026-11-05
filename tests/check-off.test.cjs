const {test}=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../extension/core.js');
const Model=require('../extension/dashboard-model.js');
const Work=require('../extension/work-model.js');
const {createStore,validateBackup}=require('../extension/storage.js');
const now=Date.parse('2026-09-27T16:00:00Z');
const paper={id:'1',courseId:'7',name:'Bring a translation',dueAt:'2026-09-26T12:00:00Z',state:'unsubmitted',submissionTypes:['on_paper'],missing:true};
const upload={...paper,id:'2',name:'Upload report',submissionTypes:['online_upload']};

test('checked-off homework leaves every active queue and counts without changing Canvas state',()=>{
 const local={'1':{checkedOff:true},'2':{progress:'in-progress'}};
 const options={local,now,timeZone:'America/New_York'};
 for(const mode of ['actionable','overdue','missing','planned','ready'])assert.ok(!Model.filterAssignments([paper,upload],{...options,mode}).items.some(x=>x.id==='1'),mode);
 assert.equal(Model.summary([paper],options).overdue,0);
 assert.deepEqual(Model.filterAssignments([paper,upload],{...options,mode:'completed'}).items.map(x=>x.id),['1']);
 assert.equal(Work.insights([paper],local,options).missing.length,0);
 assert.equal(Work.insights([paper],local,options).next,null);
 assert.equal(Core.isComplete(paper),false);
 assert.equal(paper.missing,true);
 assert.deepEqual(Model.filterAssignments([paper],{...options,local:{},mode:'actionable'}).items,[paper]);
});

test('ready to submit stays actionable until explicitly checked off; search and archive still find checked work',()=>{
 const local={'2':{progress:'done'}};
 assert.equal(Model.filterAssignments([upload],{local,now}).items.length,1);
 assert.equal(Work.insights([upload],local,{now}).ready.length,1);
 local['2'].checkedOff=true;
 assert.equal(Model.filterAssignments([upload],{local,now}).items.length,0);
 assert.equal(Work.insights([upload],local,{now}).ready.length,0);
 assert.equal(Model.filterAssignments([upload],{local,now,query:'Upload'}).items.length,1);
 assert.equal(Model.filterAssignments([upload],{local,now,mode:'dated'}).items.length,1);
});

test('check-off state persists per account, exports in backup, and undo preserves the plan',async()=>{
 const records={};const adapter={read:async key=>records[key],write:async(key,value)=>{records[key]=structuredClone(value);}};
 const store=createStore({accountId:'7',adapter});await store.load();
 await store.update(data=>{data.tasks['1']={checkedOff:true,notes:'Bring paper copy',progress:'in-progress',plannedDate:'2026-09-28'};});
 const reload=createStore({accountId:'7',adapter});await reload.load();
 assert.equal(reload.get().tasks['1'].checkedOff,true);
 assert.equal(validateBackup(reload.exportBackup()).tasks['1'].checkedOff,true);
 assert.equal((await createStore({accountId:'8',adapter}).load()).tasks['1'],undefined);
 await reload.update(data=>{data.tasks['1'].checkedOff=false;});
 assert.equal(reload.get().tasks['1'].notes,'Bring paper copy');
 assert.equal(reload.get().tasks['1'].progress,'in-progress');
 assert.equal(reload.get().tasks['1'].checkedOff,false);
});
