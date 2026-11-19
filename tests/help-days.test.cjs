'use strict';
// Help days and ranking (owner, 2026-10-28: "I should be able to know each day's AI content, the cards are also ranked
// in importance order"): every saved day can be seen again from the band, and each day's cards come most important first.
const {test}=require('node:test'),assert=require('node:assert/strict');
const Band=require('../extension/study-band.js'),UI=require('../extension/study-ui.js'),Writes=require('../extension/study-writes.js'),Results=require('../extension/ai-results.js');
const {dom,storage,descendants}=require('./study-fixture.cjs');
const scope='https://school.instructure.com|7',key='reserve:study:https://school.instructure.com:7',zone='America/New_York',now=Date.parse('2026-10-28T16:00:00Z'),H=36e5,D=864e5,iso=ms=>new Date(ms).toISOString();
const ask=(headline,extra={})=>({v:1,kind:'ask',title:headline,headline,size:'l',importance:2,points:[{text:headline+' first.',src:'Canvas'}],next:'',gaps:[],...extra});
const help=(headline,{day,at=now,itemId='',courseId='',data={},...rest}={})=>({v:1,kind:data.kind||'ask',title:headline,itemId,courseId,savedAt:at,...(day?{day}:{}),progress:{},prepare:true,data:ask(headline,data),...rest});
const all=(root,cls)=>descendants(root).filter(n=>String(n.className||'').split(' ').includes(cls));
const btn=(root,label)=>descendants(root).find(n=>n.tagName==='BUTTON'&&n.textContent===label);
function band(aids,options={}){const d=dom(),host=new d.Element('div'),local=options.local||storage(),env={document:d.document,chrome:{storage:{local}},matchMedia:()=>({matches:false})},progress=[],store=UI.createStore(env),view=Band.renderBand(host,aids,{env,scope,store,timeZone:zone,now:()=>now,onProgress:(k,p)=>progress.push([k,p]),...options});
 return {d,host,view,store,progress,label:()=>all(host,'ch-band-day-label')[0].textContent,headlines:()=>[...new Set(all(host,'ch-band-headline'))].map(n=>n.textContent)};}
const order=(aids,facts)=>Band.pack(Band.stacksFrom(Band.cardsFrom(aids,{now,zone,facts,done:true}))).flat().map(s=>s.cards.map(c=>c.data.headline)).flat();

// ---- days: navigation ----
test('the band opens on the newest day; the drawn arrows step through the days that have help, empty days left out',async()=>{
 const f=band({t:help('Today card',{day:'2026-10-28'}),y:help('Yesterday card',{day:'2026-10-27',at:now-D}),o:help('Older card',{day:'2026-10-25',at:now-3*D})});await f.view.loaded;
 const prev=btn(f.host,'Previous day'),next=btn(f.host,'Next day'),group=all(f.host,'ch-band-day')[0];
 assert.equal(group.getAttribute('role'),'group');assert.equal(group.getAttribute('aria-label'),'Help day');assert.equal(all(f.host,'ch-band-day-label')[0].getAttribute('aria-live'),'polite');
 assert.equal(f.label(),'Today');assert.deepEqual(f.headlines(),['Today card']);assert.deepEqual(f.view.state.days,['2026-10-28','2026-10-27','2026-10-25'],'Oct 26 had no help');
 assert.equal(next.disabled,true);assert.equal(prev.disabled,false);assert.equal(f.view.element.dataset.day,'today');
 prev.fire('click');assert.equal(f.label(),'Yesterday');assert.deepEqual(f.headlines(),['Yesterday card']);assert.equal(f.view.element.dataset.day,'earlier');
 prev.fire('click');assert.equal(f.label(),'Sun, Oct 25');assert.equal(all(f.host,'ch-band-day-label')[0].getAttribute('datetime'),'2026-10-25');assert.equal(prev.disabled,true,'the oldest day');assert.deepEqual(f.headlines(),['Older card']);
 f.view.element.fire('keydown',{key:'ArrowRight',target:next});assert.equal(f.label(),'Yesterday','arrow keys on the day arrows step days');
 f.view.element.fire('keydown',{key:'ArrowRight',target:next});assert.equal(f.label(),'Today');assert.equal(f.view.state.day,'2026-10-28');
 f.view.element.fire('keydown',{key:'ArrowRight',target:next});assert.equal(f.label(),'Today','no day after today');
});
test('with no help yet today the newest earlier day shows by its name; one day alone has no arrows; no help hides the day',async()=>{
 const f=band({y:help('Yesterday card',{day:'2026-10-27',at:now-D})});await f.view.loaded;
 assert.equal(f.label(),'Yesterday');assert.equal(btn(f.host,'Previous day').hidden,true);assert.equal(btn(f.host,'Next day').hidden,true);assert.equal(all(f.host,'ch-band-day')[0].hidden,false);
 const empty=band({});await empty.view.loaded;assert.equal(all(empty.host,'ch-band-day')[0].hidden,true);assert.equal(empty.view.state.day,'');
});
test('pages belong to their day: the count, the dots and the saved page are the day\'s own',async()=>{
 const f=band({a:help('Today 1',{day:'2026-10-28'}),b:help('Today 2',{day:'2026-10-28',at:now-60e3}),c:help('Yesterday 1',{day:'2026-10-27',at:now-D})});await f.view.loaded;
 assert.equal(all(f.host,'ch-band-status')[0].textContent,'1 / 2');btn(f.host,'Next page').fire('click');assert.equal(f.view.state.page,1);
 btn(f.host,'Previous day').fire('click');assert.equal(all(f.host,'ch-band-status')[0].textContent,'1 / 1');assert.equal(all(f.host,'ch-band-dot').length,1);
 await new Promise(r=>setImmediate(r));assert.equal((await f.store.getBandState(scope)).page,1,'the newest day keeps its page while another day is open');
 btn(f.host,'Next day').fire('click');assert.equal(f.view.state.page,1,'back on the newest day, on the page it was left on');
});
test('a day the student turned to stays while new help arrives; following the newest day moves to the new day',async()=>{
 const aids={y:help('Yesterday card',{day:'2026-10-27',at:now-D})},f=band(aids);await f.view.loaded;
 f.view.update({...aids,t:help('Today card',{day:'2026-10-28'})});assert.equal(f.label(),'Today','the band follows the newest day');
 btn(f.host,'Previous day').fire('click');assert.equal(f.label(),'Yesterday');
 f.view.update({...aids,t:help('Today card',{day:'2026-10-28'}),u:help('Another today',{day:'2026-10-28',at:now+1})});assert.equal(f.label(),'Yesterday','the chosen day stays');
 f.view.prepare({id:'run-9',state:'scanning',revision:1});f.view.prepare({id:'run-9',state:'cards-ready',revision:2});assert.equal(f.label(),'Today','a run the band watched finish shows the newest day');
});
test('a card opened from elsewhere opens on its day and page',async()=>{
 const f=band({t:help('Today card',{day:'2026-10-28'}),y:help('Yesterday card',{day:'2026-10-27',at:now-D})},{selectedKey:'y'});await f.view.loaded;
 assert.equal(f.label(),'Yesterday');assert.deepEqual(f.headlines(),['Yesterday card']);
});

// ---- days: ticked cards ----
test('a ticked card waits in its day\'s done pile, pressed Done; pressing Done again brings it back; Undo still works',async()=>{
 const f=band({a:help('Quiz prep',{day:'2026-10-28',data:{size:'s'}}),b:help('Reading guide',{day:'2026-10-28',at:now-60e3,data:{size:'s'}})});await f.view.loaded;
 assert.deepEqual(f.headlines(),['Quiz prep','Reading guide']);
 descendants(all(f.host,'ch-band-card')[0]).find(n=>n.dataset?.act==='done').fire('click');
 assert.deepEqual(f.progress.at(-1),['a',{archived:true}]);assert.equal(all(f.host,'ch-band-status')[0].textContent,'Archived');
 const done=all(f.host,'ch-band-card').find(c=>c.dataset.done==='true');assert.ok(done,'the ticked card is still on its day');assert.match(done.textContent,/Quiz prep/);
 assert.equal(all(f.host,'ch-band-card')[0].dataset.done,undefined,'the help still to do comes first');
 const pressed=descendants(done).find(n=>n.dataset?.act==='done');assert.equal(pressed.getAttribute('aria-pressed'),'true');assert.equal(all(done,'ch-band-when').length,0,'a done card carries no Now tag');
 pressed.fire('click');assert.deepEqual(f.progress.at(-1),['a',{}]);assert.ok(!all(f.host,'ch-band-card').some(c=>c.dataset.done==='true'));assert.deepEqual(f.headlines(),['Quiz prep','Reading guide']);
 descendants(all(f.host,'ch-band-card')[1]).find(n=>n.dataset?.act==='done').fire('click');btn(f.host,'Undo').fire('click');assert.deepEqual(f.progress.at(-1),['b',{}]);
});
test('ticked cards of earlier days are found in those days\' done piles, together in one slot',async()=>{
 const f=band({t:help('Today card',{day:'2026-10-28'}),x:help('Ticked Monday',{day:'2026-10-26',at:now-2*D,progress:{archived:true},courseId:'1'}),y:help('Also ticked Monday',{day:'2026-10-26',at:now-2*D-60e3,progress:{archived:true},courseId:'2'})});await f.view.loaded;
 assert.deepEqual(f.view.state.days,['2026-10-28','2026-10-26']);btn(f.host,'Previous day').fire('click');assert.equal(f.label(),'Mon, Oct 26');
 const piles=all(f.host,'ch-band-lap');assert.equal(piles.length,1,'one slot');assert.equal(piles[0].dataset.done,'true');assert.ok(all(f.host,'ch-band-card').every(c=>c.dataset.done==='true'));assert.deepEqual(all(f.host,'ch-band-lap-tab').map(t=>t.getAttribute('aria-selected')),['true','false'],'lapped, the first in front');
 assert.equal(Band.cardsFrom({x:help('gone',{progress:{archived:true}})}).length,0,'the active cards still leave ticked ones out');
});

// ---- days: storage, pruning, migration ----
test('a study map keeps every Help card from the 30 days before its newest, other aids the newest 40, and near its size limit the oldest go first',()=>{
 const map={$notes:[{id:'n',scope:'all',text:'x'}]};for(let i=0;i<45;i++)map['practice:'+i]={kind:'practice',savedAt:now-i*60e3,data:{}};for(let i=0;i<40;i++)map['prepare:r'+i+':0']={prepare:true,savedAt:now-i*D,data:{}};
 Writes.trim(map);const keys=Object.keys(map);assert.equal(keys.filter(k=>k.startsWith('practice:')).length,40);assert.ok(map['practice:0']&&!map['practice:44']);
 assert.equal(keys.filter(k=>k.startsWith('prepare:')).length,31,'the newest day and the 30 before it');assert.ok(map['prepare:r30:0']&&!map['prepare:r31:0']);assert.ok(map.$notes);
 const big={};for(let i=0;i<12;i++)big['prepare:b'+i+':0']={prepare:true,savedAt:now-i*H,data:{text:'x'.repeat(100000)}};
 Writes.trim(big);assert.ok(JSON.stringify(big).length<=Writes.BUDGET);assert.deepEqual(Object.keys(big).sort(),[0,1,2,3,4,5,6,7].map(i=>'prepare:b'+i+':0').sort(),'the oldest give way first');
 const one={'prepare:huge:0':{prepare:true,savedAt:now,data:{text:'x'.repeat(950000)}}};Writes.trim(one);assert.ok(one['prepare:huge:0'],'the newest Help card always stays');
});
test('saving other aids from the page never pushes a day\'s Help out',async()=>{
 const local=storage(),s=UI.createStore({chrome:{storage:{local}}}),seed={};for(let i=0;i<20;i++)seed['prepare:r'+i+':0']={prepare:true,runId:'r'+i,savedAt:now-i*D,day:'d',data:{kind:'ask'},progress:{}};await local.set({[key]:seed});
 for(let n=0;n<42;n++)await s.save(scope,{v:1,kind:'practice',itemId:String(n),courseId:'c1',title:'Set '+n,savedAt:now+n,data:{},progress:{}});
 const map=await s.list(scope);assert.equal(Object.keys(map).filter(k=>k.startsWith('prepare:')).length,20);assert.equal(Object.keys(map).filter(k=>k.startsWith('practice:')).length,40);
 const writer=Writes.create({local});await writer.commit(key,await local.get(key).then(r=>r[key]),{...map,'prepare:new:0':{prepare:true,savedAt:now+11*D+1,data:{}}});const after=(await local.get(key))[key];
 assert.ok(after['prepare:new:0']);assert.equal(Object.keys(after).filter(k=>k.startsWith('prepare:r')).length,19,'the worker\'s writer prunes by the same rule: the card older than 30 days before the newest goes');
});
test('a new Daily AI help run keeps earlier days, replaces only the same day\'s card for an item it covers again, and stamps day, rank, due and the item\'s facts',async()=>{
 let stored={'prepare:old:0':help('Yesterday',{day:'2026-10-27',at:now-D,runId:'old',itemId:'1',courseId:'10'}),'prepare:same:0':help('Earlier today',{day:'2026-10-28',at:now-H,runId:'same',itemId:'1',courseId:'10'}),'prepare:same:1':help('Earlier today, other item',{day:'2026-10-28',at:now-H,runId:'same',itemId:'2',courseId:'10'}),'prepare:tick:0':help('Ticked today',{day:'2026-10-28',at:now-2*H,runId:'tick',itemId:'1',courseId:'10',progress:{archived:true}})};
 const external={get:async()=>structuredClone(stored),set:async(_k,v)=>{stored=structuredClone(v);}},results=Results.create({store:{update:async()=>{},get:()=>({})},external,now:()=>now});
 const run={id:'run-2',scope,day:'2026-10-28',settings:{},snapshot:{snapshot:{items:[{id:'assignment:10:1',dueAt:iso(now+20*H),points:50,kind:'test',assignmentGroup:{weight:40}}]},index:[['assignment:10:1',{item:{id:'1',courseId:'10',dueAt:iso(now+20*H)}}]]}};
 await results.saveCards(run,[{kind:'test',title:'Unit 3 Test',headline:'Chem: Unit 3 Test',ref:'A1'},{kind:'reading',title:'Chapter 4',headline:'Eng: Chapter 4',ref:'A2'}],{A1:{id:'1',courseId:'10',title:'Unit 3 Test'},A2:{id:'3',courseId:'11',title:'Chapter 4'}});
 assert.ok(stored['prepare:old:0'],'yesterday stays');assert.ok(!stored['prepare:same:0'],'today\'s earlier card for the same item gives way');assert.ok(stored['prepare:same:1'],'today\'s card for another item stays');assert.ok(stored['prepare:tick:0'],'a ticked card stays');
 const a=stored['prepare:run-2:0'],b=stored['prepare:run-2:1'];assert.deepEqual([a.day,a.rank,b.day,b.rank],['2026-10-28',1,'2026-10-28',2]);assert.equal(a.dueAt,iso(now+20*H));assert.deepEqual(a.facts,{points:50,weight:40,kind:'test'});assert.equal(b.facts,undefined);assert.equal(b.dueAt,undefined);
});
test('answers to questions stay by day: at most twelve a day, other days untouched',async()=>{
 let stored={};for(let i=0;i<12;i++)stored['ask:a'+i+':0']=help('Mon '+i,{day:'2026-10-27',at:now-D+i,ask:true,runId:'a'+i});for(let i=0;i<11;i++)stored['ask:b'+i+':0']=help('Tue '+i,{day:'2026-10-28',at:now-H+i,ask:true,runId:'b'+i});
 const external={get:async()=>structuredClone(stored),set:async(_k,v)=>{stored=structuredClone(v);}},results=Results.create({store:{update:async()=>{},get:()=>({})},external,now:()=>now});
 await results.saveCards({id:'q',scope,day:'2026-10-28',question:'Why?',settings:{}},[{kind:'ask',headline:'One',points:[{text:'a'}],gaps:[]},{kind:'ask',headline:'Two',points:[{text:'b'}],gaps:[]}],{},{ask:true});
 const keys=Object.keys(stored);assert.equal(keys.filter(k=>stored[k].day==='2026-10-27').length,12);assert.equal(keys.filter(k=>stored[k].day==='2026-10-28').length,12);assert.ok(!stored['ask:b0:0'],'the oldest of today gives way');assert.ok(stored['ask:q:0']&&stored['ask:q:1']);
});
test('cards saved before days were kept take their day from when they were saved, in the student\'s time zone',()=>{
 const late=Date.parse('2026-10-27T02:30:00Z');
 assert.equal(Band.cardsFrom({a:help('Old',{at:late})},{now,zone})[0].day,'2026-10-26','10:30 pm on Oct 26 in New York');
 assert.equal(Band.cardsFrom({a:help('Old',{at:late})},{now,zone:'UTC'})[0].day,'2026-10-27');
 assert.equal(Band.cardsFrom({a:help('Stamped',{at:late,day:'2026-10-27'})},{now,zone})[0].day,'2026-10-27','a stamped day wins');
 assert.equal(Band.dayName('2026-10-28','2026-10-28'),'Today');assert.equal(Band.dayName('2026-10-27','2026-10-28'),'Yesterday');assert.equal(Band.dayName('2026-10-21','2026-10-28'),'Wed, Oct 21');
});
test('a run saved before ranks were kept still reads in the AI\'s pick order, most valuable first',()=>{
 const aids=Object.fromEntries([0,1,2].map(i=>['prepare:run-1:'+i,help('Pick '+(i+1),{at:now+i,runId:'run-1',day:'2026-10-28',itemId:String(100+i),courseId:String(10+i),data:{kind:'examples',importance:1}})]));
 assert.deepEqual(order(aids),['Pick 1','Pick 2','Pick 3']);
});

// ---- ranking ----
const item=(id,courseId,name,due,extra={})=>({id,courseId,name,dueAt:due===null?null:iso(due),points:10,state:'unsubmitted',missing:false,submissionTypes:['online_upload'],...extra});
const on=(headline,itemId,courseId,extra={})=>help(headline,{day:'2026-10-28',itemId,courseId,data:{kind:'examples',size:'s'},...extra});
test('missing work first, then what is due within 36 hours, this week, later, with no date, and handed-in work last',()=>{
 const facts=[item('1','10','Problem set 4',now-2*D,{missing:true}),item('2','11','Homework 5',now+20*H),item('3','12','Worksheet 6',now+3*D),item('4','13','Homework 7',now+10*D),item('5','14','Homework 3',now-D,{state:'submitted'}),item('6','15','Homework 8',null)];
 const aids={e:on('Handed in','5','14'),d:on('Later','4','13'),n:on('No date','6','15'),c:on('This week','3','12'),b:on('Tomorrow','2','11'),a:on('Missing','1','10')};
 assert.deepEqual(order(aids,facts),['Missing','Tomorrow','This week','Later','No date','Handed in']);
});
test('in the same window tests, quizzes, exams and projects come before homework, and homework before reading',()=>{
 const facts=[item('1','10','Homework 5',now+20*H),item('2','11','Unit 2 Quiz',now+30*H,{submissionTypes:['online_quiz']}),item('3','12','Read Chapter 6',now+22*H,{submissionTypes:['none']}),item('4','13','Research project',now+26*H),item('5','14','Midterm',now+34*H)];
 const aids={r:on('Reading','3','12',{data:{kind:'reading',size:'s'}}),h:on('Homework','1','10'),q:on('Quiz','2','11',{data:{kind:'test',size:'s'}}),p:on('Project','4','13'),m:on('Midterm','5','14')};
 assert.deepEqual(order(aids,facts),['Project','Quiz','Midterm','Homework','Reading'],'tests and projects first (among them the sooner), then homework, then reading');
 assert.deepEqual(order({h:on('Homework','1','10'),t:on('Practice test card','9','19',{data:{kind:'test',size:'s'}})},[item('1','10','Homework 5',now+20*H),item('9','19','Homework 9',now+21*H)]),['Practice test card','Homework'],'a practice test card is test preparation');
});
test('then the heavier weighted grade group, then more points: one order whatever the input order',()=>{
 const facts=[item('1','10','Homework 1',now+3*D,{points:10}),item('2','11','Homework 2',now+3*D+H,{points:100}),item('3','12','Homework 3',now+3*D+2*H,{points:5,assignmentGroup:{weight:40,weighted:true}}),item('4','13','Homework 4',now+3*D+3*H,{points:50,assignmentGroup:{weight:10,weighted:true}})];
 assert.deepEqual(order({a:on('10 points','1','10'),b:on('100 points','2','11')},facts),['100 points','10 points']);
 assert.deepEqual(order({c:on('Weight 40','3','12'),d:on('Weight 10','4','13')},facts),['Weight 40','Weight 10']);
 // A course that does not weight its groups: Canvas still sends group_weight, and it means nothing.
 const plain=[item('5','14','Homework 5',now+3*D,{points:5,assignmentGroup:{weight:90,weighted:false}}),item('6','15','Homework 6',now+3*D+H,{points:50})];
 assert.deepEqual(order({e:on('Unweighted 90','5','14'),f:on('Fifty points','6','15')},plain),['Fifty points','Unweighted 90']);
 // The review's cycle (A weight 40 / 5 points, B weight 10 / 50 points, C no group / 20 points) sorts one way only.
 const cyc=[item('7','16','A',now+3*D,{points:5,assignmentGroup:{weight:40,weighted:true}}),item('8','17','B',now+3*D,{points:50,assignmentGroup:{weight:10,weighted:true}}),item('9','18','C',now+3*D,{points:20})];
 const cards=Band.cardsFrom({a:on('A','7','16'),b:on('B','8','17'),c:on('C','9','18')},{now,zone,facts:cyc}),perms=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
 assert.deepEqual([...new Set(perms.map(p=>p.map(i=>cards[i]).sort(Band.compare).map(c=>c.data.headline).join()))],['A,B,C']);
});
test('work the student marked done in CH ranks with handed-in work and loses its Now tag',()=>{
 const facts=[item('1','10','Homework 1',now+10*H,{checkedOff:true}),item('2','11','Homework 2',now+3*D),item('3','12','Homework 3',now+5*H,{progress:'done'})];
 assert.deepEqual(order({a:on('Checked off','1','10'),b:on('Open','2','11'),c:on('Progress done','3','12')},facts),['Open','Progress done','Checked off'],'both done ones last, the sooner first');
 const c=Band.cardsFrom({a:on('Checked off','1','10')},{now,zone,facts});assert.equal(c[0].tier,5);assert.notEqual(c[0].importance,1);
});
test('then the sooner due time, then the AI\'s own order; exact ties keep the newest answer first, then the saved order',()=>{
 const facts=[item('1','10','Homework 1',now+3*D),item('2','11','Homework 2',now+3*D+H),item('3','12','Homework 3',now+3*D),item('4','13','Homework 4',now+3*D)];
 assert.deepEqual(order({b:on('Later today','2','11'),a:on('Sooner','1','10')},facts),['Sooner','Later today']);
 assert.deepEqual(order({x:on('AI second','3','12',{rank:2}),y:on('AI first','4','13',{rank:1})},facts),['AI first','AI second']);
 const asks={p:help('Asked importance 3',{data:{importance:3,size:'s'}}),q:help('Asked importance 1',{data:{importance:1,size:'s'}})};assert.deepEqual(order(asks),['Asked importance 1','Asked importance 3'],'an answer card keeps the importance the AI gave it');
 assert.deepEqual(order({o:help('Older',{at:now-60e3,data:{size:'s'}}),n:help('Newer',{data:{size:'s'}})}),['Newer','Older']);
 assert.deepEqual(order({f:help('First saved',{data:{size:'s'}}),s:help('Second saved',{data:{size:'s'}})}),['First saved','Second saved']);
});
test('live Canvas data wins over what was saved with the card, and the Now / This week tag follows it',async()=>{
 const facts=[item('1','10','Homework 1',now+10*H),item('2','11','Homework 2',now+4*D),item('3','12','Homework 3',now+12*D),item('4','13','Homework 4',now-3*D,{missing:true})];
 const plain={data:{kind:'ask',size:'s',grid:4}},aids={c:on('Due in 12 days','3','12',{dueAt:iso(now+H),...plain}),b:on('Due in 4 days','2','11',plain),a:on('Due in 10 hours','1','10',{dueAt:iso(now+20*D),...plain}),d:on('Missing','4','13',plain),n:help('No date, AI says now',{data:{importance:1,size:'s',grid:4}})};
 assert.deepEqual(order(aids,facts),['Missing','Due in 10 hours','Due in 4 days','Due in 12 days','No date, AI says now']);
 const f=band(aids,{itemFacts:()=>facts});await f.view.loaded;const tag=h=>{const card=all(f.host,'ch-band-card').find(c=>c.textContent.includes(h));const when=all(card,'ch-band-when')[0];return when?when.textContent:'';};
 assert.deepEqual(['Missing','Due in 10 hours','Due in 4 days','Due in 12 days'].map(tag),['Now','Now','This week','']);
 btn(f.host,'Next page').fire('click');assert.deepEqual(['No date, AI says now'].map(tag),['Now']);
});
test('the order holds inside a same-kind stack and inside each page',()=>{
 const facts=[item('1','10','Homework 1',now+5*D),item('2','10','Homework 2',now+20*H),item('3','11','Unit Quiz',now+2*D,{submissionTypes:['online_quiz']}),item('4','12','Read pages 4-9',now+30*H)];
 const big=due=>({runId:'r7',data:{kind:'examples',size:'l',grid:4,dueAt:iso(due)}}),cards=Band.cardsFrom({a:on('HW 1','','10',big(now+5*D)),b:on('HW 2','','10',big(now+20*H)),c:on('Quiz','3','11',{data:{kind:'test',size:'s',grid:4}}),d:on('Reading','4','12',{data:{kind:'reading',size:'s',grid:4}})},{now,zone,facts}),stacks=Band.stacksFrom(cards);
 const hw=stacks.find(s=>s.cards.length===2);assert.deepEqual(hw.cards.map(c=>c.data.headline),['HW 2','HW 1'],'the stack shows its most important card on top');
 assert.deepEqual(Band.pack(stacks).map(p=>p.map(s=>s.cards[0].data.headline)),[['HW 2','Reading'],['Quiz']]);
});
test('only the most important card of the day carries the drawn pennant, named for screen readers',async()=>{
 const f=band({a:help('First',{data:{importance:1,size:'s'}}),b:help('Second',{data:{importance:2,size:'s'}})});await f.view.loaded;
 const marks=all(f.host,'ch-band-top');assert.equal(marks.length,1);assert.equal(marks[0].getAttribute('role'),'img');assert.equal(marks[0].getAttribute('aria-label'),'Most important');assert.equal(marks[0].textContent,'','a drawing, not words');
 assert.ok(all(all(f.host,'ch-band-card')[0],'ch-band-top').length===1);
 const one=band({a:help('Alone',{data:{size:'s'}})});await one.view.loaded;assert.equal(all(one.host,'ch-band-top').length,0,'one card needs no mark');
});

// Review 2026-10-28: pages keep the importance order; a run started from a card stays on that card's day.
test('a card from a lower band never moves ahead of a more important one to fill a page; one of the same band may fill a hole',()=>{
 const card=(h,id,due,size)=>on(h,id,'1'+id,{data:{kind:'examples',size,grid:4}}),facts=[item('1','11','HW 1',now+1*D),item('2','12','HW 2',now+2*D),item('3','13','HW 3',now+10*D)];
 const pages=Band.pack(Band.stacksFrom(Band.cardsFrom({a:card('Due in 1 day','1',0,'m'),b:card('Due in 2 days','2',0,'l'),c:card('Due in 10 days','3',0,'m')},{now,zone,facts})));
 assert.deepEqual(pages.map(p=>p.map(s=>s.cards[0].data.headline)),[['Due in 1 day'],['Due in 2 days'],['Due in 10 days']],'a later card never jumps a this-week one (review 2026-10-28)');
 const week=[item('1','11','HW 1',now+3*D),item('2','12','HW 2',now+4*D),item('3','13','HW 3',now+5*D)];
 assert.deepEqual(Band.pack(Band.stacksFrom(Band.cardsFrom({a:card('In 3 days','1',0,'m'),b:card('In 4 days','2',0,'l'),c:card('In 5 days','3',0,'m')},{now,zone,facts:week}))).map(p=>p.map(s=>s.cards[0].data.headline)),[['In 3 days','In 5 days'],['In 4 days']],'within one band a smaller card fills the hole');
});
test('Ask on an earlier day\'s card keeps the band on that day when the answer lands',async()=>{
 let n=0;const f=band({t:help('Today card',{day:'2026-10-28'}),y:help('Yesterday card',{day:'2026-10-27',at:now-D})},{onAsk:async()=>({ok:true,run:{id:'card-run-'+(++n),state:'scanning',revision:1}})});await f.view.loaded;
 btn(f.host,'Previous day').fire('click');assert.equal(f.label(),'Yesterday');
 descendants(f.host).find(x=>x.dataset?.act==='ask').fire('click');const input=all(f.host,'ch-band-drawer-input')[0];input.value='Why?';input.fire('keydown',{key:'Enter',preventDefault(){},stopPropagation(){}});await new Promise(r=>setImmediate(r));
 f.view.prepare({id:'card-run-1',state:'cards-ready',revision:2});assert.equal(f.label(),'Yesterday','the answer sits in that card, on its day');
});
test('the same Canvas facts in a new list rank nothing again',async()=>{
 const facts=[item('1','10','Homework 1',now+3*D)];let list=facts;const f=band({a:on('Card','1','10')},{itemFacts:()=>list});await f.view.loaded;const before=all(f.host,'ch-band-card')[0];
 list=facts.map(x=>({...x}));assert.equal(f.view.refresh(),false);assert.equal(all(f.host,'ch-band-card')[0],before,'the same card nodes stay');
 list=[{...facts[0],dueAt:iso(now+5*H)}];assert.equal(f.view.refresh(),true,'a due date that moved ranks again');
});
