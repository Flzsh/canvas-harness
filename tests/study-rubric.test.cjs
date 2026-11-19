'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const UI=require('../extension/study-ui.js'),{createPdfHandoff}=require('../extension/ai-source.js');
const {Study,tick,rubric,lab,practice,reading,wrap,storage,dom,panelFixture,descendants,button}=require('./study-fixture.cjs');
function viewer(data,progress={}){const f=dom(),host=new f.Element('div'),saved=[];UI.renderViewer(host,{kind:'rubric',title:data.title,data,progress},{env:{document:f.document},onProgress:p=>saved.push(p)});return {...f,host,saved};}

test('rubric option follows lab and its preview is the exact message copied and sent',async t=>{
 const html=fs.readFileSync('extension/ai-panel.html','utf8');assert.doesNotMatch(html,/ch-study-mode|What for/);
 const f=panelFixture();t.after(()=>f.close());await tick();f.controller.setDraft('Keep this question');assert.equal(await f.controller.setMode('rubric'),true);await tick();
 const preview=f.get('ch-study-preview').textContent;assert.equal(f.controller.state.mode,'rubric');assert.match(preview,/"kind":"rubric"/);assert.match(preview,/Body a/);assert.equal(preview,Study.build('rubric',{level:'high school',course:'Biology',item:'Assignment A',due:'2026-10-21',sources:[{label:'Instructions A',text:'Body a'}]}));
 assert.equal(await f.controller.copy(),true);assert.equal(f.copied.at(-1),preview);assert.equal(await f.controller.inject(),true);assert.equal(f.requests.findLast(r=>r.op==='inject').text,preview);assert.equal(f.get('ch-study-paste').hidden,false);
 await f.controller.setMode('ask');assert.equal(f.get('prompt').value,'Keep this question');
});

test('rubric viewer shows requirements, sourced rows, points and only nonempty top level labels with persistent ticks',()=>{
 const data=rubric(),f=viewer(data),all=descendants(f.host),content=all.find(n=>n.className==='ch-study-content');
 assert.ok(all.some(n=>n.tagName==='H3'&&n.textContent==='Requirements'));assert.match(f.host.textContent,/Include a title.*Assignment.*Include references.*Instructions/s);
 const sections=content.children.filter(n=>n.tagName==='SECTION');assert.equal(sections.length,2);assert.match(sections[0].textContent,/Evidence.*8.*Cite the sources.*Explain each example.*To reach the top level.*Connect evidence to the claim.*Rubric row 1/s);assert.match(sections[1].textContent,/Organization.*Order the sections.*Rubric row 2/s);assert.doesNotMatch(sections[1].textContent,/To reach the top level/);
 assert.equal(all.filter(n=>n.tagName==='SMALL'&&n.textContent==='To reach the top level').length,1);assert.match(f.host.textContent,/Not in the material.*Word count/s);
 const ticks=all.filter(n=>n.tagName==='INPUT');assert.equal(ticks.length,5);assert.ok(ticks.every(n=>n.type==='checkbox'));for(const i of [0,2,4]){ticks[i].checked=true;ticks[i].fire('change');}
 assert.deepEqual(f.saved.at(-1).checked,{'req:0':true,'check:0:0':true,'check:1:0':true});const restored=viewer(data,f.saved.at(-1));assert.deepEqual(descendants(restored.host).filter(n=>n.tagName==='INPUT').map(n=>n.checked),[true,false,true,false,true]);
 const changed=descendants(restored.host).find(n=>n.tagName==='INPUT');changed.checked=false;changed.fire('change');assert.equal(restored.saved.at(-1).checked['req:0'],false);
 const empty=viewer({...data,requirements:[],gaps:[]});assert.ok(descendants(empty.host).some(n=>n.tagName==='H3'&&n.textContent==='Requirements'));assert.equal(descendants(empty.host).find(n=>n.className==='ch-study-gaps').hidden,true);
});

test('rubric tag counts only real requirements and checks with true ticks',()=>{
 const data={...rubric(),requirements:Array.from({length:2},()=>({text:'Requirement',src:'Assignment'})),criteria:Array.from({length:3},()=>({name:'Row',points:'',checks:['a','b','c','d'],up:'',src:'Rubric'}))},aid={kind:'rubric',data,progress:{checked:{'req:0':true,'check:0:1':true,'check:2:3':true,'check:9:0':true,'req:9':true,'req:1':1,'material:0':true}}};
 assert.equal(UI.tagLabel(aid),'Rubric checklist 3/14');assert.equal(UI.tagLabel({kind:'rubric',data:{requirements:[],criteria:[]}}),'Rubric checklist 0/0');assert.equal(UI.tagLabel({kind:'future'}),'');
});

test('rubric parses, saves, reopens and restores persisted progress through the shared Saved list',async t=>{
 const parsed=Study.parse('Reply\n'+wrap(rubric()),'rubric');assert.equal(parsed.ok,true);assert.deepEqual(parsed.data,rubric());
 const f=panelFixture();t.after(()=>f.close());await tick();await f.controller.setMode('rubric');await f.controller.copy();f.controller.setAnswer(wrap(rubric()));assert.equal(await f.controller.readAnswer(),true);assert.equal(f.get('ch-study-viewer').hidden,false);
 const ticks=descendants(f.get('ch-study-viewer')).filter(n=>n.tagName==='INPUT');ticks[0].checked=true;ticks[0].fire('change');ticks[3].checked=true;ticks[3].fire('change');await tick();assert.match(f.get('ch-study-saved-list').textContent,/Essay rubric.*Rubric checklist.*Open.*Remove/s);
 const map=Object.values(f.storage.saved)[0];assert.equal(map['rubric:a'].item,'Assignment A');assert.deepEqual(map['rubric:a'].progress.checked,{'req:0':true,'check:0:1':true});
 const next=panelFixture({storage:f.storage});t.after(()=>next.close());await tick();button(next.get('ch-study-saved-list'),'Open').fire('click');assert.equal(next.get('ch-study-viewer').hidden,false);assert.deepEqual(descendants(next.get('ch-study-viewer')).filter(n=>n.tagName==='INPUT').map(n=>n.checked),[true,false,false,true,false]);
 await button(next.get('ch-study-saved-list'),'Remove').fire('click');await tick();assert.equal(next.get('ch-study-saved-list').children.length,0);
});

test('rubric shares the existing store cap with old aid kinds',async()=>{
 const local=storage(),store=UI.createStore({chrome:{storage:{local}}}),scope='https://school.instructure.com|7|c1|a';
 for(let i=0;i<40;i++)await store.save(scope,{kind:'lab',itemId:String(i),title:'Old lab',savedAt:i,data:lab(),progress:{}});
 await store.save(scope,{kind:'rubric',itemId:'a',title:'Rubric',savedAt:40,data:rubric(),progress:{}});const map=await store.list(scope);assert.equal(Object.keys(map).length,40);assert.equal(map['lab:0'],undefined);assert.equal(map['rubric:a'].kind,'rubric');assert.equal(Object.keys(local.saved).length,1);
});

test('old saved aids reopen and unknown saved kinds stay out of the Saved list',async t=>{
 const local=storage(),key=UI.storageKey('https://school.instructure.com|7');local.saved[key]=Object.fromEntries([practice(),reading(),lab()].map(data=>[data.kind+':a',{kind:data.kind,title:data.title,data,progress:{},savedAt:1}]));local.saved[key]['future:a']={kind:'future',title:'Unknown aid',data:{},savedAt:2};
 const f=panelFixture({storage:local});t.after(()=>f.close());await tick();assert.equal(f.get('ch-study-saved-list').children.length,3);assert.doesNotMatch(f.get('ch-study-saved-list').textContent,/Unknown aid/);assert.equal(f.controller.openAid('future:a'),false);for(const kind of ['practice','reading','lab'])assert.equal(f.controller.openAid(kind+':a'),true);assert.equal(await f.controller.setMode('future'),false);
});

test('PDF handoff keeps rubric out of its purpose intents',()=>{
 const source=createPdfHandoff({origin:'https://school.instructure.com',accountId:'7',fileId:'42',name:'Assignment.pdf',text:'Selected words',page:0,intent:'rubric'});assert.equal(source.summary().intent,undefined);source.destroy();const html=fs.readFileSync('extension/pdf-reader.html','utf8');assert.doesNotMatch(html,/<option[^>]*value="rubric"/);
});
