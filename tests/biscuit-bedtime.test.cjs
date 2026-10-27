'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('../extension/biscuit-engine.js'),P=require('../extension/biscuit-planner.js'),C=require('../extension/agent-clock.js');
const MIN=60000,DAY=86400000,at=clock=>Date.parse('2026-10-23T'+clock+':00Z'),world=(bedtime,time)=>{const now=at(time);return {now,timeZone:'UTC',settings:{bedtime},pageKind:'dashboard',assignments:[{id:'1',title:'Lab',estimate:30,dueAt:now+DAY}],unreadAnnouncements:2};};
// Separate planning from other offers so a quiet result cannot hide a broken window.
for(const [bedtime,kinds]of [['22:30',['plan',null,null,null,'inbox']],['23:59',['plan','plan',null,null,'inbox']],['00:00',['plan','plan',null,null,'inbox']],['00:30',['plan','plan','plan',null,'inbox']],['02:00',['plan','plan','plan','plan','inbox']]])for(const [i,time]of ['21:00','23:00','00:15','01:00','07:00'].entries())test('bedtime '+bedtime+' offers at '+time,()=>{
 const s=world(bedtime,time),kind=kinds[i];assert.equal(E.offer(s)?.kind??null,kind);assert.equal(E.offer(s,{pendingBreak:true})?.kind??null,kind?'break':null);
 if(kind==='plan'){const p=P.build(s),day=time<'06:00'||bedtime>='06:00'?'2026-10-23':'2026-10-24',end=Date.parse(day+'T'+bedtime+':00Z');assert.equal(p.window.start,s.now);assert.equal(p.window.end,end);assert.ok(p.workMinutes>0);assert.ok(p.blocks.every(b=>b.start>=s.now&&b.end<=end));}
});
for(const bedtime of ['22:30','23:59','00:00','00:30','02:00'])test('bedtime '+bedtime+' stops at bedtime and releases night at 06:00',()=>{
 const s=world(bedtime,bedtime);assert.equal(E.offer(s),null);assert.equal(E.offer({...s,skills:{night:false}})?.kind,'inbox');assert.equal(E.offer(world(bedtime,'05:59'),{pendingBreak:true}),null);assert.equal(E.offer(world(bedtime,'06:00'),{pendingBreak:true})?.kind,'break');
});
for(const bedtime of ['00:00','00:30','02:00'])test('exact plans cross midnight only up to '+bedtime,()=>{
 const s=world(bedtime,'23:00'),end=Date.parse('2026-10-24T'+bedtime+':00Z'),request={itemIds:['1'],window:{start:s.now,end}},p=P.build(s,request);assert.equal(p.window.end,end);assert.ok(p.workMinutes>0);assert.equal(P.build(s,{...request,window:{start:s.now,end:end+MIN}}).blocks.length,0);
 for(const request of [{until:bedtime},{line:'plan tonight until '+bedtime}])assert.equal(P.build(s,request).window.end,end);
 const late=world(bedtime,bedtime),closed=P.build(late);assert.equal(closed.blocks.length,0);assert.equal(closed.window.start,closed.window.end);
});
test('an earlier post-midnight end still shortens the evening window',()=>{const s=world('02:00','23:00'),end=Date.parse('2026-10-24T00:15Z');for(const request of [{until:'00:15'},{line:'plan tonight until 00:15'}])assert.equal(P.build(s,request).window.end,end);});
test('post-midnight bedtime stays on the local calendar across a DST change',()=>{
 const s={...world('00:30','21:00'),now:Date.parse('2026-11-01T12:00Z'),timeZone:'America/New_York'},p=P.build(s),local=C.calendar(s.timeZone);assert.deepEqual(local(p.window.end),{day:'2026-11-02',minute:30,second:0});assert.equal(p.window.end,Date.parse('2026-11-02T05:30Z'));
});
