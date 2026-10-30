'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Band=require('../extension/study-band.js'),UI=require('../extension/study-ui.js');
const {dom,storage,tick,descendants,button,practice,reading,lab,rubric,notes,wrap,panelFixture}=require('./study-fixture.cjs');
const scope='https://school.instructure.com|7',ask=(size='s',extra={})=>({v:1,kind:'ask',title:'Answer',headline:'22.50 mL',size,importance:1,points:[{text:'Subtract the first reading.',src:'Table'}],next:'Compare trials.',gaps:[],...extra});
const aid=data=>({kind:data.kind,title:data.title,data,savedAt:100,progress:{}});
function fixture(aids,options={}){const d=dom(),host=new d.Element('div'),saved=[],errors=[],env={document:d.document,chrome:{storage:{local:options.storage||storage()}},matchMedia:()=>({matches:!!options.reduced}),...options.env},store=UI.createStore(env),view=Band.renderBand(host,aids,{env,scope,store,onProgress:(key,p)=>saved.push([key,p]),onError:e=>errors.push(e),...options});return {...d,host,view,env,store,saved,errors};}
test('all size mixes pack into four quarters with no duplicates, loss or excess',()=>{
 for(let length=1;length<=6;length++)for(let code=0;code<4**length;code++){let n=code;const cards=Array.from({length},(_,i)=>{const size=['s','m','l','xl'][n%4];n=Math.floor(n/4);return {key:i,data:ask(size,{grid:4}),importance:1,due:Infinity,created:1,index:i};}),pages=Band.pack(cards),flat=pages.flat();assert.equal(flat.length,length);assert.equal(new Set(flat.map(c=>c.key)).size,length);for(const page of pages){const used=page.reduce((sum,c)=>sum+Band.sizes[c.size],0);assert.ok(used>=1&&used<=4);}}
 assert.deepEqual(Band.sizes,{s:1,m:2,l:3,xl:4});
});
test('importance, due time and newest answer order globally before packing leftover quarters',()=>{
 const q=(size,extra)=>ask(size,{grid:4,...extra}),aids={reference:aid(q('s',{importance:3})),later:{...aid(q('m',{importance:2})),dueAt:'2026-10-28'},now:{...aid(q('m')),dueAt:'2026-10-24'},small:{...aid(q('s')),savedAt:101,dueAt:'2026-10-24'},newer:{...aid(q('l',{importance:2})),savedAt:105,dueAt:'2026-10-28'}};
 const pages=Band.pack(Band.cardsFrom(aids));assert.deepEqual(pages.map(p=>p.map(c=>c.key)),[['small','now','reference'],['newer'],['later']],'the least important small card fills the last quarter of the first page');
 const fill=Band.pack(Band.cardsFrom({a:aid(q('l')),b:aid(q('m')),c:aid(q('s',{importance:3}))}));assert.deepEqual(fill.map(p=>p.map(c=>c.key)),[['a','c'],['b']]);
});
test('cards saved in thirds take the next size up in quarters, never narrower; quarter cards keep their size',()=>{
 for(const [old,now] of [['s','m'],['m','l'],['l','xl']])assert.equal(Band.fallbackSize({kind:'steps',size:old}),now,old);
 for(const size of ['s','m','l','xl'])assert.equal(Band.fallbackSize({kind:'steps',size,grid:4}),size);
 assert.equal(Band.fallbackSize({kind:'test',grid:4}),'l');assert.equal(Band.fallbackSize({kind:'translate',grid:4}),'xl');assert.equal(Band.fallbackSize({kind:'ask',grid:4}),'s');
 assert.equal(Band.cardsFrom({a:aid(ask('l'))})[0].size,'xl');assert.equal(Band.cardsFrom({a:aid(ask('s'))})[0].size,'m');
});
test('G2 fallbacks and flashcard front/back lists remain single cards',()=>{
 for(const kind of ['ask','message'])assert.equal(Band.fallbackSize({kind,size:'huge'}),'m','an old small card, one size up');
 for(const kind of ['steps','practice','flashcards','fixes','rubric','lab','reading','notes','summary'])assert.equal(Band.fallbackSize({kind}),'l');
 assert.equal(Band.fallbackSize({kind:'outline',sections:[1,2,3,4]}),'xl');assert.equal(Band.fallbackSize({kind:'outline',sections:[1,2,3]}),'l');assert.equal(Band.fallbackSize({kind:'today'}),'xl');
 assert.equal(Band.cardsFrom({a:aid({kind:'flashcards',cards:[{front:'A',back:'B'}]})}).length,1);
});
test('pull/push and page flips persist per account, keyboard stays out of content inputs, reduced motion is explicit',async()=>{
 const local=storage(),aids={a:aid(ask('l')),b:aid(ask('l')),c:aid(ask('l'))},f=fixture(aids,{storage:local,reduced:true});await f.view.loaded;
 button(f.host,'Next page').fire('click');assert.equal(f.view.state.page,1);f.view.element.fire('keydown',{key:'ArrowRight',target:f.view.element});assert.equal(f.view.state.page,2);f.view.element.fire('keydown',{key:'ArrowLeft',target:{tagName:'INPUT'}});assert.equal(f.view.state.page,2);
 assert.equal(button(f.host,'Next page').disabled,true);button(f.host,'Push Help up').fire('click');assert.equal(f.view.state.open,false);assert.equal(f.view.element.dataset.reducedMotion,'true');await tick();
 const restored=fixture(aids,{storage:local});await restored.view.loaded;assert.equal(restored.view.state.open,false);assert.equal(restored.view.state.page,2);assert.equal((await f.store.list(scope)).$band,undefined);assert.equal((await f.store.getBandState('https://school.instructure.com|8')).open,true);
 button(restored.host,'Pull Help down').fire('click');button(restored.host,'Previous page').fire('click');assert.equal(restored.view.state.page,1);assert.equal(restored.view.state.open,true);
 assert.match(fs.readFileSync('extension/study-band.css','utf8'),/prefers-reduced-motion:reduce/);assert.match(fs.readFileSync('extension/study-band.css','utf8'),/\.ch-band-scroll\{[^}]*overflow:auto/);
});
test('band uses existing practice rounds, wrong-answer retry and saved progress across page flips',async()=>{
 const data=practice();data.items=data.items.slice(0,2);data.before='Use LockDown.';const a=aid({...data,size:'l',importance:1}),f=fixture({a,b:aid(ask('l'))});await f.view.loaded;
 button(f.host,'a').fire('click');button(f.host,'Next').fire('click');button(f.host,'b').fire('click');button(f.host,'Next').fire('click');assert.match(f.host.textContent,/Score: 1 \/ 2/);button(f.host,'Missed ones again').fire('click');assert.match(f.host.textContent,/1 \/ 1/);assert.match(f.host.textContent,/Use LockDown/);
 f.view.flip(1);f.view.flip(0);assert.match(f.host.textContent,/1 \/ 1/);assert.ok(a.progress.practice.order.length===1);assert.ok(f.saved.length);
});
test('late preference reads cannot undo a fresh pull/push or page choice',async()=>{
 let finish;const writes=[],store={getBandState:()=>new Promise(resolve=>{finish=resolve;}),setBandState:async(_scope,value)=>writes.push(value)},f=fixture({a:aid(ask('l')),b:aid(ask('l'))},{store});
 f.view.setOpen(false);f.view.flip(1);finish({open:true,page:0});await f.view.loaded;await tick();assert.equal(f.view.state.open,false);assert.equal(f.view.state.page,1);assert.deepEqual(writes.at(-1),{open:false,page:1});
});
test('flashcards flip side by side and remember known ticks',async()=>{
 const data={kind:'flashcards',title:'Terms',size:'m',cards:[{front:'uno',back:'one',src:'p1'},{front:'dos',back:'two',src:'p2'}],gaps:[]},f=fixture({a:aid(data)});await f.view.loaded;
 const faces=descendants(f.host).filter(n=>n.className==='ch-study-card');assert.equal(faces.length,2);faces[0].fire('click');assert.equal(faces[0].textContent,'one');faces[1].fire('click');assert.equal(faces[1].textContent,'two');
 const tickbox=descendants(f.host).find(n=>n.tagName==='INPUT');tickbox.checked=true;tickbox.fire('change');f.view.flip(0);assert.equal(descendants(f.host).find(n=>n.tagName==='INPUT').checked,true);
});
test('all viewers live inside bounded cards with reveals, ticks, before, example and show',async()=>{
 const samples=[reading(),lab(),rubric(),notes(),{kind:'steps',title:'Start',steps:[{text:'Substitute.',done:'Equation ready',minutes:5,src:'p1',example:'2(3) = 6'}],handin:'Upload.',gaps:[]},{kind:'outline',title:'Essay',thesis:'Your claim?',sections:[{part:'Evidence',purpose:'Connect data.',example:'Trial 2: why?',evidence:[{text:'Data',src:'Table'}]}],gaps:[]},{kind:'fixes',title:'Fix',fixes:[{for:'rewrite',text:'Make it precise.',why:'More clear.',src:'Draft',show:'This → that'}],keep:[],gaps:[]},{kind:'message',title:'Question',to:'Teacher',subject:'Conflict',body:'Which date?',asks:['Date'],gaps:[]},{kind:'summary',title:'Read',points:[{text:'Claim',src:'Text'}],todo:[{text:'Read again',due:'',src:'Text'}],gaps:[]},ask()];
 for(const data of samples){const f=fixture({a:aid({...data,size:'l'})});await f.view.loaded;assert.ok(descendants(f.host).some(n=>n.className==='ch-band-scroll'));const reveal=button(f.host,'Show answer');if(reveal){reveal.fire('click');assert.ok(f.saved.length);}const checkbox=descendants(f.host).find(n=>n.tagName==='INPUT');if(checkbox){checkbox.checked=true;checkbox.fire('change');f.view.flip(0);assert.equal(descendants(f.host).find(n=>n.tagName==='INPUT').checked,true);}if(data.kind==='steps')assert.match(f.host.textContent,/2\(3\) = 6/);if(data.kind==='fixes')assert.match(f.host.textContent,/This → that/);if(['steps','outline'].includes(data.kind))assert.ok(descendants(f.host).some(n=>n.className==='ch-band-columns'));assert.deepEqual(f.errors,[]);}
});
test('day actions become a large Today timeline and small timed reminders sorted with Help',async()=>{
 const aids=Band.agentAids({runs:[{id:'r',at:100,actions:[{outcome:'kept',action:{tool:'say',text:'Start Physics, then prepare Spanish.'}},{outcome:'kept',action:{tool:'today',items:[{title:'Physics',next:'Draw diagram',why:'Quiz tomorrow'}]}},{outcome:'done',action:{tool:'remind',text:'Bring goggles',at:'2026-10-25T08:00'}},{outcome:'undone',action:{tool:'plan',title:'Removed'}}]}]});assert.equal(Object.keys(aids).length,2);const f=fixture(aids);await f.view.loaded;assert.ok(f.view.pages.flat().some(c=>c.size==='xl'));assert.ok(f.view.pages.flat().some(c=>c.size==='s'),'a timed reminder is a quarter');assert.ok(Object.values(aids).every(a=>a.data.grid===4),'agent cards are written in quarters');assert.equal(Band.fallbackSize(Band.agentAids({runs:[{id:'q',at:1,actions:[{outcome:'card',action:{tool:'note',title:'A tip',text:'Do this.'}}]}]})['agent:q:suggestion:0'].data),'s','a one-line suggestion stays a quarter');f.view.flip(f.view.pages.findIndex(rows=>rows.some(c=>c.data.kind==='today')));assert.ok(descendants(f.host).some(n=>n.className==='ch-band-timeline'));
});
test('real panel parses multi-card answers into independent saved viewers and keeps prior answers',async t=>{
 const f=panelFixture();t.after(()=>f.close());await tick();await f.controller.copy();f.controller.setAnswer(wrap({v:1,cards:[ask(),{v:1,kind:'steps',title:'Method',size:'m',headline:'Compare trials',importance:2,steps:[{text:'Compare',done:'Recorded',minutes:5,src:'Table'}],handin:'',gaps:[]}]}));assert.equal(await f.controller.readAnswer(),true);assert.equal(Object.keys(f.controller.state.saved).length,2);assert.match(f.get('ch-study-viewer').textContent,/22.50 mL.*Compare/s);f.controller.setAnswer(wrap(ask()));assert.equal(await f.controller.readAnswer(),true);assert.equal(Object.keys(f.controller.state.saved).length,3);
});
test('say-only agent answers stay visible in their own card',async()=>{
 const aids=Band.agentAids({runs:[{id:'reply',at:200,actions:[{outcome:'kept',action:{tool:'say',text:'Start with the class practice bank.'}}]}]});const f=fixture(aids);await f.view.loaded;assert.equal(f.view.pages.flat().length,1);assert.match(f.host.textContent,/Start with the class practice bank/);
});
test('saved due times follow the answered assignment rather than another open assignment',async t=>{
 const due='2026-10-29T18:00:00Z',f=panelFixture({catalog:{scopeKey:'https://school.instructure.com|7|10|a',courseId:'10',active:{id:'a',title:'Open',courseId:'10',dueAt:'2026-10-25T18:00:00Z'},courses:[{id:'10',name:'Science'}],sources:[{id:'a',title:'Open',kind:'assignment',courseId:'10'},{id:'b',title:'Picked',kind:'assignment',courseId:'10',dueAt:due}]}});t.after(()=>f.close());await tick();f.controller.setSelection('a',false);f.controller.setSelection('b',true);await f.controller.copy();f.controller.setAnswer(wrap(ask()));assert.equal(await f.controller.readAnswer(),true);assert.equal(f.controller.state.currentAid.itemId,'b');assert.equal(f.controller.state.currentAid.dueAt,due);
});
