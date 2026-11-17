'use strict';
// What a plan says must be plainly right (2026-11-14): not in the middle of the night, no sliver of work before a break,
// late work called late, and a plan edited by item can keep the time the student named as busy.
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../extension/biscuit-planner.js'),Clock=require('../extension/agent-clock.js');
const zone='America/New_York',local=Clock.calendar(zone),wall=(y,mo,d,h,mi)=>Date.UTC(y,mo-1,d,h+5,mi),DAY=864e5;
const rows=(now)=>[['a','Equilibrium Worksheet',0.8],['b','Partial Derivatives Practice Set',1.5],['c','Plate Count Data Sheet',1.6],['d','Homework for Monday, 11/9/2026',-3]].map(([id,title,d])=>({id,title,courseId:'10',kind:'assignment',dueAt:new Date(now+d*DAY).toISOString(),points:20,missing:d<0}));
const world=now=>({now,timeZone:zone,settings:{bedtime:'22:30'},assignments:rows(now),courses:[{id:'10',name:'Chemistry 11'}]});
const minute=at=>local(at).minute;

test('a day plan asked between midnight and 6 AM starts when that day starts, not now',()=>{
 const sat=wall(2026,11,14,0,50),p=P.build(world(sat),{local:true,line:'plan my day'});
 assert.equal(minute(p.blocks[0].start),600,'Saturday: 10:00 AM');assert.equal(p.night,true);
 const wed=wall(2026,11,11,1,20),q=P.build(world(wed),{local:true,line:'plan my day'});
 assert.equal(minute(q.blocks[0].start),930,'weekday: 3:30 PM');
});
test('saying now keeps a night plan at the time it was asked; daytime plans are unchanged',()=>{
 const sat=wall(2026,11,14,0,50),p=P.build(world(sat),{local:true,line:'plan my day now'});assert.ok(minute(p.blocks[0].start)<60);assert.equal(p.night,undefined);
 const day=wall(2026,11,11,16,30),q=P.build(world(day),{local:true,line:'plan my day'});assert.equal(minute(q.blocks[0].start),990);assert.equal(q.night,undefined);
});
test('a new piece of work never starts with a few minutes squeezed in just before a break',()=>{
 const p=P.build(world(wall(2026,11,11,16,30)),{local:true,line:'plan my day'});
 for(let i=1;i<p.blocks.length-1;i++){const b=p.blocks[i],before=p.blocks[i-1],after=p.blocks[i+1];if(b.kind!=='break'&&before.kind!=='break'&&before.itemId!==b.itemId&&after.kind==='break')assert.ok(b.minutes>=10,'block '+i+' is '+b.minutes+' min');}
});
test('the plan sentence says which work is already late',()=>{
 const now=wall(2026,11,11,16,30),p=P.build(world(now),{local:true,line:'plan catch up'});
 assert.match(p.message,/Homework for Monday, 11\/9\/2026 \(late, \d+ min\)/);assert.doesNotMatch(p.message,/Equilibrium Worksheet \(late/);
});
test('a plan scoped to chosen work keeps the busy time the student named',()=>{
 const now=wall(2026,11,11,16,30),start=wall(2026,11,11,17,0),end=wall(2026,11,11,18,0);
 const p=P.build(world(now),{local:true,line:'plan my day',itemIds:['b','a'],avoid:[{start,end}]});
 assert.ok(p.blocks.length,'built');assert.equal(p.blocks[0].itemId,'b','in the chosen order');
 for(const b of p.blocks)assert.ok(b.end<=start||b.start>=end,'nothing inside the busy hour');
});
