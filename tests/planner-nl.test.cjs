'use strict';
// The Planner's quick add reads what students type (4.2). The corpus (planner-nl-corpus.cjs) is 248 lines a student
// really types plus 60 held-out lines; every one must read as the student meant: name, day, deadline, time, length,
// course, repeat and importance. Local and deterministic: the same words read the same way, with no request anywhere.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const P=require('../extension/planner-model.js'),K=require('./planner-nl-corpus.cjs');
const read=text=>P.parseQuick(text,K.TODAY,{courses:K.COURSES,now:K.NOW});
function score(cases){const misses=[];for(const c of cases){const bad=K.check(read(c[0]),c,P.repeatKey);if(bad.length)misses.push(`${c[0]} -> ${bad.join('; ')}`);}return misses;}

test('the corpus is at least 200 real lines, each with an expected reading',()=>{
 assert.ok(K.CASES.length>=200,`only ${K.CASES.length} lines`);assert.ok(K.HELD.length>=50);
 assert.equal(new Set(K.CASES.map(c=>c[0])).size,K.CASES.length,'no line twice');
 for(const c of [...K.CASES,...K.HELD]){assert.equal(typeof c[0],'string');assert.equal(typeof c[1],'string');assert.ok(c[2]===''||/^\d{4}-\d{2}-\d{2}$/.test(c[2]),c[0]);}
});
test('every corpus line reads as the student meant',()=>{const misses=score(K.CASES);assert.deepEqual(misses,[],`${misses.length} of ${K.CASES.length} read wrong:\n${misses.join('\n')}`);});
test('every held-out line reads as the student meant',()=>{const misses=score(K.HELD);assert.deepEqual(misses,[],`${misses.length} of ${K.HELD.length} read wrong:\n${misses.join('\n')}`);});
test('the same words always read the same way, and nothing in the reader can reach a network',()=>{
 for(const c of K.CASES.slice(0,60))assert.deepEqual(read(c[0]),read(c[0]));
 const src=fs.readFileSync(path.join(__dirname,'..','extension','planner-model.js'),'utf8');
 for(const word of ['fetch(','XMLHttpRequest','WebSocket','chrome.runtime','sendMessage','navigator.','import('])assert.ok(!src.includes(word),word);
});
test('a word taken back stays in the name and is no longer read',()=>{
 const all=read('essay due fri 5pm 45m chem');assert.equal(all.name,'essay chem','a course word stays in the name');assert.equal(all.day,'2026-11-20');assert.equal(all.at,'17:00');assert.equal(all.estimate,45);assert.equal(all.courseId,'101');assert.equal(all.due,true);
 const noDate=P.parseQuick('essay due fri 5pm',K.TODAY,{courses:K.COURSES,now:K.NOW,ignore:['date']});assert.equal(noDate.name,'essay due fri');assert.equal(noDate.at,'17:00');assert.equal(noDate.day,'2026-11-18');assert.equal(noDate.due,false);
 const noTime=P.parseQuick('call mom at 5 tmr',K.TODAY,{now:K.NOW,ignore:['time']});assert.equal(noTime.name,'call mom at 5');assert.equal(noTime.at,'');assert.equal(noTime.day,'2026-11-19');
 const noLength=P.parseQuick('read 45m',K.TODAY,{ignore:['duration']});assert.equal(noLength.name,'read 45m');assert.equal(noLength.estimate,0);
 const noCourse=P.parseQuick('chem lab',K.TODAY,{courses:K.COURSES,ignore:['course']});assert.equal(noCourse.courseId,'');
 const noRepeat=P.parseQuick('piano every mon',K.TODAY,{ignore:['repeat']});assert.equal(noRepeat.repeat,null);assert.equal(noRepeat.name,'piano');assert.equal(noRepeat.day,'2026-11-23');
 const plain=P.parseQuick('pay fee asap',K.TODAY,{ignore:['priority']});assert.equal(plain.priority,'');assert.equal(plain.name,'pay fee asap');
});
test('the spans say which typed characters were read as what, inside the text',()=>{
 const text='Essay due Fri 5pm 45m #chem',r=read(text);
 const kinds=r.spans.map(s=>s.kind).sort();assert.deepEqual(kinds,['course','date','duration','time'],'("due" goes with the day it leads)');
 for(const s of r.spans){assert.ok(s.start>=0&&s.end<=text.length&&s.end>s.start);}
 assert.equal(text.slice(r.spans.find(s=>s.kind==='date').start,r.spans.find(s=>s.kind==='date').end),'due Fri');
});
test('the old quick add (no options) still reads days, lengths and #hints the way it did',()=>{
 const r=P.parseQuick('Read chapter 3 fri 45m #chem','2026-11-18');assert.equal(r.name,'Read chapter 3');assert.equal(r.day,'2026-11-20');assert.equal(r.estimate,45);assert.equal(r.course,'chem');
 assert.equal(P.matchCourse('chem',[{id:'1',name:'Chemistry'}]).id,'1');assert.equal(P.matchCourse('',[{id:'1',name:'Chemistry'}]),null);
 assert.equal(P.parseQuick('',K.TODAY).name,'');assert.equal(P.parseQuick('   ',K.TODAY).day,'');
 const long=P.parseQuick('x'.repeat(900),K.TODAY);assert.ok(long.name.length<=200);
 const noToday=P.parseQuick('essay fri 30m','');assert.equal(noToday.day,'');assert.equal(noToday.estimate,30);
});
test('reading is fast enough to run on every key press',()=>{
 const t=process.hrtime.bigint();for(let i=0;i<3;i++)for(const c of K.CASES)read(c[0]);const ms=Number(process.hrtime.bigint()-t)/1e6/(3*K.CASES.length);
 assert.ok(ms<2,`${ms.toFixed(3)} ms a line`);
});
