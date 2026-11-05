const {test}=require('node:test'),assert=require('node:assert/strict');
const Model=require('../extension/dashboard-model.js');
test('assignment memory keeps each course filter, selection and reader distinct',()=>{
 const memory=Model.createCourseMemory();
 memory.remember('7',{query:'gas',mode:'dated',selectedId:'42',readerTab:'plan',readerOpen:true,readerScroll:380,limit:180});
 memory.remember('8',{query:'vectors',mode:'undated',selectedId:'43',readerTab:'details',readerScroll:92});
 assert.deepEqual(memory.recall('7'),{courseId:'7',query:'gas',mode:'dated',day:'',limit:180,selectedId:'42',readerTab:'plan',readerOpen:true,readerScroll:380});
 assert.equal(memory.recall('8').query,'vectors');assert.equal(memory.recall('8').readerScroll,92);
});
test('new courses inherit only explicitly supplied view defaults and retain safe old-state compatibility',()=>{
 const memory=Model.createCourseMemory();const next=memory.recall('9',{mode:'today',query:'',limit:60});assert.equal(next.mode,'today');assert.equal(next.selectedId,null);assert.equal(next.readerOpen,false);
 const old=Model.cleanCourseView({query:'old search',mode:'pinned',selectedId:'55'},'all');assert.equal(old.selectedId,'55');assert.equal(old.readerTab,'details');assert.equal(old.readerScroll,0);
});
test('navigation snapshots round-trip without notes, grades or unchecked fields',()=>{
 const memory=Model.createCourseMemory();memory.remember('all',{selectedId:'local-reminder',readerOpen:true,readerTab:'plan',notes:'private',score:99,gradeVisibilityOverride:true});
 const serialized=JSON.stringify(memory.serialize());assert.doesNotMatch(serialized,/private|score|gradeVisibilityOverride/);const restored=Model.createCourseMemory(JSON.parse(serialized));assert.equal(restored.recall('all').selectedId,'local-reminder');assert.equal(restored.recall('all').readerTab,'plan');
});
test('returned navigation data cannot mutate stored selections or another instance',()=>{
 const one=Model.createCourseMemory();one.remember('7',{selectedId:'12',query:'original'});const view=one.recall('7');view.query='mutated';const exported=one.serialize();exported[0][1].selectedId='13';assert.equal(one.recall('7').query,'original');assert.equal(one.recall('7').selectedId,'12');assert.equal(Model.createCourseMemory().recall('7').selectedId,null);
});
test('hidden and removed course memories are pruned without deleting All courses',()=>{
 const memory=Model.createCourseMemory();for(const id of ['all','7','8','9'])memory.remember(id,{selectedId:'12'});memory.prune(['8']);assert.deepEqual(memory.serialize().map(x=>x[0]),['all','8']);assert.equal(memory.recall('7').selectedId,null);
});
test('invalid saved selections, scrolls and course identifiers cannot become UI state',()=>{
 const memory=Model.createCourseMemory([['__proto__',{selectedId:'42'}],['7',{selectedId:'<img>',readerScroll:Infinity,readerTab:'<script>',readerOpen:'yes',mode:'bad',query:'x'.repeat(500),limit:50000}],['not-a-course',{}],['8']]);
 const value=memory.recall('7');assert.equal(memory.serialize().length,1);assert.equal(value.selectedId,null);assert.equal(value.readerScroll,0);assert.equal(value.readerTab,'details');assert.equal(value.readerOpen,false);assert.equal(value.mode,'actionable');assert.equal(value.query.length,200);assert.equal(value.limit,500);
});
test('course navigation memory is bounded and recently revisited courses are retained',()=>{
 const memory=Model.createCourseMemory();for(let i=1;i<=64;i++)memory.remember(String(i),{});memory.remember('1',{query:'keep'});memory.remember('65',{});const ids=memory.serialize().map(x=>x[0]);assert.equal(ids.length,64);assert.ok(ids.includes('1'));assert.ok(!ids.includes('2'));assert.equal(memory.recall('1').query,'keep');
});
