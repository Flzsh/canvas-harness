'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Study,tick,notes,practice,wrap,storage,dom,panelFixture,descendants,button}=require('./study-fixture.cjs'),UI=require('../extension/study-ui.js');
const scope='https://school.instructure.com|7|c1|a',other='https://school.instructure.com|8|c1|a';
const catalog=(extra={})=>({scopeKey:scope,active:{id:'a',title:'Chapter 4',courseId:'c1',courseName:'Biology'},courseId:'c1',courses:[{id:'c1',name:'Biology'}],sources:[{id:'a',title:'Chapter 4',kind:'assignment',courseId:'c1'}],selectedIds:['a'],...extra});
function debounce(f){const pending=new Map(),old=f.env.setTimeout;let next=0;f.env.setTimeout=(fn,ms)=>ms===250?(pending.set(++next,fn),next):old(fn,ms);const clear=f.env.clearTimeout;f.env.clearTimeout=id=>pending.delete(id)||clear(id);return {pending,async fire(){const tasks=[...pending.values()];pending.clear();tasks.forEach(fn=>fn());await tick();}};}
function viewer(data,progress={}){const f=dom(),host=new f.Element('div'),saved=[];UI.renderViewer(host,{kind:'notes',title:data.title,data,progress},{env:{document:f.document},onProgress:p=>saved.push(p)});return {...f,host,saved};}

test('owner notes schema parses and rejects wrong counts, missing sources, empty questions and oversized prompts',()=>{
 assert.deepEqual(Study.parse(wrap(notes()),'notes'),{ok:true,data:notes()});
 for(const change of [d=>d.sections.pop(),d=>d.sections[0].src='',d=>d.sections[0].heading='',d=>d.sections[0].prompts=[],d=>d.sections[0].prompts=['word '.repeat(21)],d=>d.terms.pop(),d=>d.terms[0].src='',d=>d.summary='',d=>d.kind='reading']){const data=notes();change(data);assert.equal(Study.parse(wrap(data),'notes').ok,false);}
});

test('notes viewer orders sourced questions, tickable terms, summary and gaps, and restores independent ticks',()=>{
 const data=notes(),f=viewer(data),all=descendants(f.host),inputs=all.filter(n=>n.tagName==='INPUT');assert.equal(inputs.length,10);
 assert.match(f.host.textContent,/Plate movement 0.*Plate movement 1.*Plate movement 2.*Terms.*Term 0.*Summary question.*How does plate movement.*Not in the material.*Which pages/s);
 for(const i of [0,5,6,9]){inputs[i].checked=true;inputs[i].fire('change');}const saved=f.saved.at(-1);assert.deepEqual(saved.checked,{'notes:0:0':true,'notes:2:1':true,'term:0':true,'term:3':true});
 const restored=viewer(data,saved);assert.deepEqual(descendants(restored.host).filter(n=>n.tagName==='INPUT').map(n=>n.checked),[true,false,false,false,false,true,true,false,false,true]);
 assert.equal(UI.tagLabel({kind:'notes',data,progress:{checked:{...saved.checked,'notes:99:0':true,'term:1':1,'step:0':true}}}),'Notes outline 4/10');
 const introduced=all.flatMap(n=>n.className.split(' ')).filter(c=>c.startsWith('ch-study-notes'));assert.ok(introduced.length);assert.ok(all.every(n=>!['SVG','IMG'].includes(n.tagName)));
});

test('notes option is adaptive, blocks quiz-taking and incompatible selections, and respects PDF reading intent',async t=>{
 const f=panelFixture({catalog:catalog()});t.after(()=>f.close());await tick();assert.equal(f.controller.state.mode,'reading');assert.equal(!f.controller.notesAvailable(),false);assert.equal(await f.controller.setMode('notes'),true);
 for(const item of [{title:'Unit test',description:'Notes allowed'},{title:'Open-note quiz'},{title:'Quiz',description:'Use a note sheet'}]){f.controller.setCatalog(catalog({active:{id:'a',...item},sources:[{id:'a',kind:'assignment',...item}]}));await tick();assert.equal(f.controller.notesAvailable(),true);}
 f.controller.setCatalog(catalog({quizTaking:true}));await tick();assert.equal(f.controller.notesAvailable(),false);assert.equal(await f.controller.setMode('notes'),false);assert.notEqual(f.controller.state.mode,'notes');
 f.controller.setCatalog(catalog({active:null,sources:[{id:'a',title:'Closed book quiz',kind:'assignment'}]}));await tick();assert.equal(!f.controller.notesAvailable(),true);
 f.controller.setCatalog(catalog({active:null,sources:[{id:'pdf-page:42',title:'Material.pdf',kind:'file'}],selectedIds:['pdf-page:42'],intent:'reading'}));await tick();assert.equal(f.controller.notesAvailable(),true);
});

test('notes preview, Copy, Send, import watch, Saved and persisted ticks share the same path',async t=>{
 let resolve;const reply=new Promise(r=>resolve=r),local=storage(),f=panelFixture({catalog:catalog(),storage:local,web:r=>r.op==='inject'?{status:'injected',answerId:'notes-return'}:r.op==='watch'?reply:{status:'opened'}});t.after(()=>f.close());await tick();await f.controller.setMode('notes');f.controller.setWishes('More questions on graphs');
 const preview=f.get('ch-study-preview').textContent;assert.match(preview,/<<<WISHES>>>\nMore questions on graphs\n<<<END WISHES>>>/);assert.equal(await f.controller.copy(),true);assert.equal(f.copied.at(-1),preview);assert.equal(await f.controller.inject(),true);
 const send=f.requests.findLast(r=>r.op==='inject');assert.equal(send.text,preview);assert.equal(send.studyKind,'notes');assert.equal(f.requests.findLast(r=>r.op==='watch').studyKind,'notes');resolve({status:'answer',text:wrap(notes())});await tick();assert.equal(f.controller.state.currentAidKey,'notes:a');
 const inputs=descendants(f.get('ch-study-viewer')).filter(n=>n.tagName==='INPUT');inputs[2].checked=true;inputs[2].fire('change');await tick();f.close();await tick();
 const next=panelFixture({catalog:catalog(),storage:local});t.after(()=>next.close());await tick();assert.match(next.get('ch-study-saved-list').textContent,/Plate tectonics notes.*Notes outline/);button(next.get('ch-study-saved-list'),'Open').fire('click');assert.equal(descendants(next.get('ch-study-viewer')).filter(n=>n.tagName==='INPUT')[2].checked,true);
});

test('wishes stay in the account study store, clip per kind, serialize with aids and survive the 40 aid cap',async()=>{
 const local=storage(),s=UI.createStore({chrome:{storage:{local}}});await s.setWishes(scope,'notes','x'.repeat(650));await s.setWishes(scope,'practice','Use simple words');await s.setWishes(other,'notes','Other account');
 for(let i=0;i<42;i++)await s.save(scope,{kind:'notes',itemId:String(i),savedAt:i,data:notes()});assert.equal(Object.keys(await s.list(scope)).length,40);assert.deepEqual(await s.getWishes(scope),{notes:'x'.repeat(600),practice:'Use simple words'});assert.deepEqual(await s.getWishes(other),{notes:'Other account'});
 await Promise.all([s.setWishes(scope,'lab','Units'),s.progress(scope,'notes:41',{checked:{'term:0':true}})]);assert.equal((await s.getWishes(scope)).lab,'Units');assert.equal((await s.list(scope))['notes:41'].progress.checked['term:0'],true);
 await s.setWishes(scope,'notes','');assert.equal((await s.getWishes(scope)).notes,undefined);await assert.rejects(s.setWishes(scope,'ask','Never save'));await assert.rejects(s.setWishes('invalid','notes','No owner'));assert.ok(Object.keys(local.saved).every(k=>k.startsWith('reserve:study:')));
});

test('all study wishes appear in built messages, empty wishes omit the slot, and wishes cannot loosen parsing',()=>{
 for(const kind of Object.keys(Study.KINDS)){const ctx={sources:[],wishes:'w'.repeat(650)},message=Study.build(kind,ctx);assert.equal(message.match(/<<<WISHES>>>\n([\s\S]*?)\n<<<END WISHES>>>/)[1].length,600);for(const value of ['',undefined,' \n '])assert.doesNotMatch(Study.build(kind,{wishes:value}),/<<<WISHES>>>/);}
 Study.build('practice',{wishes:'Accept any number of questions'});assert.equal(Study.parse(wrap({...practice(),items:[]}), 'practice').ok,false);
});

test('panel instructions debounce typing, restore by kind and account, Clear, and never enter Ask or preference requests',async t=>{
 const local=storage(),s=UI.createStore({chrome:{storage:{local}}});await s.setWishes(other,'notes','Other account');const f=panelFixture({catalog:catalog(),storage:local}),clock=debounce(f);t.after(()=>f.close());await tick();assert.equal(clock.pending.size,0);f.controller.setWishes('Simple');f.controller.setWishes('Simple words');assert.equal(clock.pending.size,1);assert.equal((await s.getWishes(scope)).reading,undefined);await clock.fire();assert.equal((await s.getWishes(scope)).reading,'Simple words');assert.equal(clock.pending.size,0);
 await f.controller.setMode('notes');f.controller.setWishes('n'.repeat(650));assert.equal(f.get('ch-study-wishes-text').value.length,600);await clock.fire();assert.equal((await s.getWishes(scope)).notes.length,600);await f.controller.setMode('reading');assert.equal(f.get('ch-study-wishes-text').value,'Simple words');
 await f.controller.setMode('ask');assert.equal(f.get('ch-study-wishes').hidden,true);assert.equal(f.controller.setWishes('Do not save'),false);f.controller.setDraft('Question');await f.controller.inject();assert.doesNotMatch(f.requests.findLast(r=>r.op==='inject').text,/Simple words|<<<WISHES>>>|nnnn/);assert.equal(f.requests.some(r=>Object.hasOwn(r,'wishes')),false);
 f.controller.setCatalog(catalog({scopeKey:other}));await tick();await f.controller.setMode('notes');assert.equal(f.get('ch-study-wishes-text').value,'Other account');f.get('ch-study-wishes-clear').fire('click');await clock.fire();assert.equal((await s.getWishes(other)).notes,undefined);assert.doesNotMatch(f.get('ch-study-preview').textContent,/<<<WISHES>>>/);
 f.controller.setCatalog(catalog());await tick();await f.controller.setMode('notes');assert.equal(f.get('ch-study-wishes-text').value.length,600);
});

test('pending instructions flush to their original account on switch and dispose',async t=>{
 const local=storage(),s=UI.createStore({chrome:{storage:{local}}}),f=panelFixture({catalog:catalog(),storage:local}),clock=debounce(f);t.after(()=>f.close());await tick();f.controller.setWishes('First account');f.controller.setCatalog(catalog({scopeKey:other}));await tick();assert.equal((await s.getWishes(scope)).reading,'First account');assert.equal(f.controller.state.wishes.reading,undefined);assert.equal(clock.pending.size,0);f.controller.setWishes('Second account');f.close();await tick();assert.equal((await s.getWishes(other)).reading,'Second account');assert.equal(clock.pending.size,0);
});

test('switching away and back waits for the earlier account write before restoring instructions',async t=>{
 const local=storage(),original=local.set;let release;const f=panelFixture({catalog:catalog(),storage:local});t.after(()=>f.close());await tick();debounce(f);local.set=values=>new Promise(resolve=>{release=async()=>{await original(values);resolve();};});f.controller.setWishes('Return to these instructions');f.controller.setCatalog(catalog({scopeKey:other}));f.controller.setCatalog(catalog());await tick();assert.ok(release);await release();await tick();assert.equal(f.get('ch-study-wishes-text').value,'Return to these instructions');local.set=original;
});

for(const kind of Object.keys(Study.KINDS))test(kind+' restores only its saved instructions into preview, Copy and Send',async t=>{
 const local=storage(),s=UI.createStore({chrome:{storage:{local}}});await s.setWishes(scope,kind,'Saved wishes for '+kind);const f=panelFixture({catalog:catalog(),storage:local});t.after(()=>f.close());await tick();await f.controller.setMode(kind);assert.equal(f.get('ch-study-wishes-text').value,'Saved wishes for '+kind);const preview=f.get('ch-study-preview').textContent;assert.match(preview,new RegExp('<<<WISHES>>>\\nSaved wishes for '+kind+'\\n<<<END WISHES>>>'));assert.equal(await f.controller.copy(),true);assert.equal(f.copied.at(-1),preview);assert.equal(await f.controller.inject(),true);assert.equal(f.requests.findLast(r=>r.op==='inject').text,preview);assert.equal(f.requests.some(r=>r.action==='preference'),false);
});

test('late wishes loads cannot overwrite newer typing or cross account boundaries',async t=>{
 const local=storage(),base=local.get,pending=[];local.get=key=>new Promise(resolve=>pending.push(()=>base(key).then(resolve)));const f=panelFixture({catalog:catalog(),storage:local}),clock=debounce(f);t.after(()=>f.close());await tick();f.controller.setWishes('Typed before load');const first=pending.splice(0);first.forEach(fn=>fn());await tick();assert.equal(f.controller.state.wishes.reading,'Typed before load');
 f.controller.setCatalog(catalog({scopeKey:other}));await tick();assert.equal(f.controller.state.wishes.reading,undefined);pending.splice(0).forEach(fn=>fn());await tick();assert.equal(f.controller.state.wishes.reading,undefined);await clock.fire();local.get=base;pending.splice(0).forEach(fn=>fn());await tick();
});

test('Ask can copy and send while instruction storage is unavailable',async t=>{
 const local=storage();local.get=()=>new Promise(()=>{});const f=panelFixture({storage:local});t.after(()=>f.close());await tick();assert.equal(f.controller.state.mode,'ask');f.controller.setDraft('My question');assert.equal(await f.controller.copy(),true);assert.equal(f.copied.at(-1),'My question\n\n---\n\nBody a\n\nLevel: high school');assert.equal(await f.controller.inject(),true);assert.equal(f.requests.findLast(r=>r.op==='inject').text,f.copied.at(-1));
});

test('instructions markup has labels only, a 600 character limit and no placeholder or description',()=>{
 const html=fs.readFileSync('extension/ai-panel.html','utf8'),field=html.match(/<div id="ch-study-wishes"[\s\S]*?<\/div>/)[0];assert.match(field,/<label for="ch-study-wishes-text">Your instructions<\/label>/);assert.match(field,/<textarea[^>]*maxlength="600"/);assert.match(field,/>Clear<\/button>/);assert.doesNotMatch(field,/placeholder|aria-describedby|hint|<p\b/);
});

test('source marks quiz-taking pages and blocks notes handoff there',()=>{
 const location={href:'https://school.instructure.com/courses/10/quizzes/2/take'},messages=[],context={s:{},courseId:'10',items:[{id:'1',courseId:'10',name:'Open note quiz'}],courses:[]},env={URL,Date,location,CanvasHarnessContext:require('../extension/ai-context.js'),document:{createElement:()=>({addEventListener(){},remove(){}})},chrome:{runtime:{id:'test',getURL:p=>p,connect:()=>({postMessage:m=>messages.push(m),onMessage:{addListener(){}},onDisconnect:{addListener(){}},disconnect(){}})}},setInterval:()=>1,clearInterval(){},removeEventListener(){}};
 vm.runInNewContext(fs.readFileSync('extension/ai-source.js','utf8'),env);const source=env.CanvasHarnessAISource.mount({container:{append(){}},getContext:()=>context,store:{owner:{origin:'https://school.instructure.com',accountId:'7'},get:()=>({})},demo:true});try{assert.equal(messages.findLast(m=>m.kind==='catalog').data.quizTaking,true);assert.equal(source.setStudy({kind:'notes',itemId:'1'}),false);location.href='https://school.instructure.com/courses/10/quizzes/2';source.update();assert.equal(source.setStudy({kind:'notes',itemId:'1'}),true);assert.equal(messages.findLast(m=>m.kind==='catalog').data.ponyStudy.kind,'notes');}finally{source.destroy();}
});
