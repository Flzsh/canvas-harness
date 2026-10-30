const {test}=require('node:test'),assert=require('node:assert/strict');
const {bookmarkItems,deadlineTone}=require('../extension/dashboard-view.js');
const Model=require('../extension/dashboard-model.js');
function context(courseId='all'){
 return {state:{courseId},courses:[{id:'7'},{id:'8'}],local:{'1':{pinned:true},'2':{pinned:true},'3':{pinned:true}},items:[{id:'1',courseId:'7',name:'Chemistry task'},{id:'2',courseId:'8',name:'Latin task'},{id:'3',courseId:'9',name:'Hidden task'}],resourcePins:[{id:'file:1',courseId:'7',title:'Chemistry worksheet',url:'https://school.instructure.com/courses/7/files/1'},{id:'file:1',courseId:'8',title:'Latin worksheet',url:'https://school.instructure.com/courses/8/files/1'}]};
}
test('one saved set supplies All courses and the matching course, without hidden-course leakage',()=>{
 const c=context(),before=JSON.stringify(c);
 assert.deepEqual(bookmarkItems(c).map(x=>x.title),['Chemistry task','Latin task','Chemistry worksheet','Latin worksheet']);
 assert.deepEqual(bookmarkItems({...c,state:{courseId:'7'}}).map(x=>x.title),['Chemistry task','Chemistry worksheet']);
 assert.deepEqual(bookmarkItems({...c,state:{courseId:'8'}}).map(x=>x.title),['Latin task','Latin worksheet']);
 assert.deepEqual(bookmarkItems({...c,state:{courseId:'9'}}),[]);
 assert.equal(JSON.stringify(c),before,'rendering never mutates saved state');
});
test('resource bookmarks reject unsafe URLs and credentials, canonicalize module links, and deduplicate within a course',()=>{
 const c=context();c.items=[];c.resourcePins.push(...['javascript:alert(1)','data:text/html,hello','https://user:secret@example.com/a','file:///etc/passwd','not a URL'].map((url,i)=>({id:'bad'+i,courseId:'7',url})),{...c.resourcePins[0]},{id:'module:10:11',courseId:'7',title:'Teacher document',url:'https://docs.google.com/document/d/example/edit'});
 const rows=bookmarkItems(c);assert.equal(rows.length,3);assert.equal(rows[2].url,'https://school.instructure.com/courses/7/modules/items/11');
});
test('bookmarked completed assignments remain available, but unbookmarked work does not appear',()=>{
 const c=context('7');c.items[0].state='graded';c.items.push({id:'4',courseId:'7',name:'Unsaved'});
 assert.equal(bookmarkItems(c).filter(x=>x.kind==='assignment').length,1);
 c.local['1'].pinned=false;assert.equal(bookmarkItems(c).filter(x=>x.kind==='assignment').length,0);
});
test('a personal reminder bookmark appears in All courses without being assigned to a class',()=>{
 const c=context();c.local['local-note']={pinned:true};c.items.push({id:'local-note',courseId:'personal',personal:true,name:'Bring calculator'});
 assert.ok(bookmarkItems(c).some(x=>x.id==='local-note'));
 assert.ok(!bookmarkItems({...c,state:{courseId:'7'}}).some(x=>x.id==='local-note'));
});
test('deadline color uses elapsed 24 hours across midnight and DST boundaries',()=>{
 for(const now of [Date.parse('2026-10-01T23:00:00-04:00'),Date.parse('2026-11-01T00:00:00-04:00')]){
  const tone=delta=>deadlineTone({dueAt:new Date(now+delta).toISOString()},now);
  assert.equal(tone(-1),'overdue');assert.equal(tone(0),'soon');assert.equal(tone(864e5),'soon');assert.equal(tone(864e5+1),'later');
  assert.equal(deadlineTone({dueAt:new Date(now-1).toISOString()},now,true),'done');
 }
 assert.equal(deadlineTone({dueAt:'invalid'},Date.now()),'none');
});
test('saving a bookmark does not reorder the Home deadline queue',()=>{
 const now=Date.parse('2026-10-01T12:00:00Z'),items=[{id:'1',courseId:'7',name:'Soon',state:'unsubmitted',dueAt:new Date(now+360e4).toISOString()},{id:'2',courseId:'7',name:'Later',state:'unsubmitted',dueAt:new Date(now+864e5).toISOString()}];
 assert.deepEqual(Model.filterAssignments(items,{now,local:{'2':{pinned:true}},prioritizePins:false}).items.map(x=>x.id),['1','2']);
});
