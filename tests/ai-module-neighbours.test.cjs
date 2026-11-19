'use strict';
// AI plan step 10, the cheap half: a thin item or a generic quiz is built from its unit, so the pages, files and
// discussions beside it in its module lead the course files the AI may ask for, nearest first and marked as such.
// Nothing extra is read. Made-up content only.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,task,at}=require('./ai-situations-fixture.cjs');
const course=(id,name)=>({id,name,teachers:[{id:'2'}],enrollments:[{type:'student',enrollment_state:'active'}]});
const file=(id,name,days)=>({id,display_name:name,filename:name,size:900,'content-type':'text/plain',url:'/files/'+id+'/download',updated_at:at(days)});
const list=prompt=>{const i=prompt.indexOf('Course files you can ask for (their text');return i<0?[]:prompt.slice(i).split('\n\n')[0].split('\n').slice(1);};

test('a quiz\'s module neighbours come first among the files the AI may ask for, ahead of newer files; a locked one stays out',async()=>{
 const files=[file('55','Unit 3 review.txt',-30),file('56','Unit 3 answers.txt',-30),...Array.from({length:45},(_,i)=>file(String(600+i),'Handout '+i+'.txt',-1))];
 const spec={courses:[course('1','Chemistry')],assignments:{1:[task({id:21,name:'Unit 3 quiz',description:'<p>Quiz.</p>'})]},files:{1:files},pages:{1:[{page_id:301,url:'unit-3-notes',title:'Unit 3 notes',updated_at:at(-30)}]},
  modules:{1:[{id:9,name:'Unit 3',items:[{id:101,type:'Page',title:'Unit 3 notes',page_url:'unit-3-notes',content_id:301},{id:102,type:'Assignment',title:'Unit 3 quiz',content_id:21},{id:103,type:'File',title:'Unit 3 review.txt',content_id:55},{id:104,type:'File',title:'Unit 3 answers.txt',content_id:56,content_details:{locked_for_user:true}}]}]}};
 const {run,prompt}=await harness(spec).help('21','1','Unit 3 quiz'),rows=list(prompt);
 assert.deepEqual(rows.slice(0,2),['L1: Unit 3 notes (same module as this item)','L2: Unit 3 review.txt (same module as this item)'],'the one before it, then the one after it');
 assert.ok(!rows.some(r=>/Unit 3 answers/.test(r)&&/same module/.test(r)),'a locked neighbour is not offered as one');
 assert.ok(rows.length<=40);assert.equal(run.turns.length,1,'nothing was read for this');
});
