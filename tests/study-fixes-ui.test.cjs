'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const UI=require('../extension/study-ui.js'),Inject=require('../extension/ai-inject.js');
const {Study,tick,wrap,dom,panelFixture,descendants,button}=require('./study-fixture.cjs');
const fixes=()=>({v:1,kind:'fixes',title:'Essay fix list',fixes:[{text:'Explain each quotation.',why:'The teacher asked for explanation.',for:'next',src:'Teacher comment 1'},{text:'Add the missing citation.',why:'The revision needs a source.',for:'rewrite',src:'Rubric: Evidence'},{text:'Read the draft aloud.',why:'The teacher noticed unclear sentences.',for:'next',src:'Teacher comment 2'}],keep:[{text:'Keep the clear topic sentences.',src:'Teacher comment 3'}],gaps:['Ask which paragraph needs more detail.']});
function viewer(data=fixes(),progress={}){const f=dom(),host=new f.Element('div'),saved=[];UI.renderViewer(host,{kind:'fixes',title:data.title,data,progress},{env:{document:f.document},onProgress:p=>saved.push(p)});return {...f,host,saved};}
function feedbackCatalog(teacherFeedback=false){return {scopeKey:'https://school.instructure.com|7|c1|a',selectedIds:['a'],active:{id:'a',assignmentId:'a',title:'Essay',hasRubric:true,courseId:'c1'},courseId:'c1',courses:[{id:'c1',name:'English'}],teacherFeedback,sources:[{id:'a',assignmentId:'a',title:'Essay',hasRubric:true,kind:'assignment',courseId:'c1'},{id:'b',assignmentId:'b',title:'Other essay',kind:'assignment',courseId:'c1'},{id:'feedback:c1:a',assignmentId:'a',title:'Teacher feedback: Essay',kind:'feedback',courseId:'c1'},{id:'feedback:c1:b',assignmentId:'b',title:'Teacher feedback: Other essay',kind:'feedback',courseId:'c1'}]};}

test('Fix list follows Rubric checklist and preview, photos, Copy and Send share the exact study message',async t=>{
 const html=fs.readFileSync('extension/ai-panel.html','utf8');assert.doesNotMatch(html,/ch-study-mode|What for/);
 const f=panelFixture();t.after(()=>f.close());await tick();f.controller.setDraft('Keep this question');f.controller.addPhoto('Teacher annotations');assert.equal(await f.controller.setMode('fixes'),true);await tick();
 const preview=f.get('ch-study-preview').textContent;assert.equal(f.controller.state.mode,'fixes');assert.match(preview,/"kind":"fixes"/);assert.match(preview,/Body a/);assert.match(preview,/Photo 1: Teacher annotations/);
 assert.equal(await f.controller.copy(),true);assert.equal(f.copied.at(-1),preview);assert.equal(await f.controller.inject(),true);assert.equal(f.requests.findLast(r=>r.op==='inject').text,preview);assert.equal(f.requests.findLast(r=>r.op==='inject').studyKind,'fixes');assert.equal(f.get('ch-study-paste').hidden,false);
 await f.controller.setMode('ask');assert.equal(f.get('prompt').value,'Keep this question');
});

test('fixes viewer groups only populated destinations, preserves original tick indexes, and shows sourced praise and gaps',()=>{
 const f=viewer(),all=descendants(f.host);assert.deepEqual(all.filter(n=>n.tagName==='H3').map(n=>n.textContent),['For the rewrite','For next time','Keep doing','Not in the material']);
 const ticks=all.filter(n=>n.tagName==='INPUT');assert.equal(ticks.length,3);assert.ok(ticks.every(n=>n.type==='checkbox'));assert.match(f.host.textContent,/Add the missing citation.*The revision needs a source.*Rubric: Evidence/s);assert.match(f.host.textContent,/Keep doing.*Keep the clear topic sentences.*Teacher comment 3/s);
 assert.ok(all.some(n=>n.tagName==='SMALL'&&n.textContent==='The revision needs a source.'));ticks[0].checked=true;ticks[0].fire('change');ticks[2].checked=true;ticks[2].fire('change');assert.deepEqual(f.saved.at(-1).checked,{'fix:1':true,'fix:2':true});
 const restored=viewer(fixes(),f.saved.at(-1));assert.deepEqual(descendants(restored.host).filter(n=>n.tagName==='INPUT').map(n=>n.checked),[true,false,true]);const one=viewer({...fixes(),fixes:fixes().fixes.filter(f=>f.for==='next'),keep:[],gaps:[]});assert.doesNotMatch(one.host.textContent,/For the rewrite|Keep doing/);assert.equal(descendants(one.host).find(n=>n.className==='ch-study-gaps').hidden,true);
});

test('fix list tag counts only real fix keys with true ticks',()=>{
 const data={...fixes(),fixes:Array.from({length:6},()=>fixes().fixes[0])};assert.equal(UI.tagLabel({kind:'fixes',data,progress:{checked:{'fix:0':true,'fix:5':true,'fix:1':1,'fix:9':true,'req:0':true}}}),'Fix list 2/6');assert.equal(UI.tagLabel({kind:'fixes',data:{fixes:[]}}),'Fix list 0/0');
});

test('fix list parses, saves, restores ticks, reopens and removes through the panel Saved flow',async t=>{
 const f=panelFixture();t.after(()=>f.close());await tick();assert.equal(await f.controller.setMode('fixes'),true);await f.controller.copy();f.controller.setAnswer(wrap(fixes()));assert.equal(await f.controller.readAnswer(),true);assert.equal(f.get('ch-study-viewer').hidden,false);
 const ticks=descendants(f.get('ch-study-viewer')).filter(n=>n.tagName==='INPUT');ticks[0].checked=true;ticks[0].fire('change');ticks[2].checked=true;ticks[2].fire('change');await tick();assert.match(f.get('ch-study-saved-list').textContent,/Essay fix list.*Fix list.*Open.*Remove/s);
 const map=Object.values(f.storage.saved)[0];assert.equal(map['fixes:a'].item,'Assignment A');assert.deepEqual(map['fixes:a'].data,fixes());assert.deepEqual(map['fixes:a'].progress.checked,{'fix:1':true,'fix:2':true});
 const next=panelFixture({storage:f.storage});t.after(()=>next.close());await tick();button(next.get('ch-study-saved-list'),'Open').fire('click');assert.equal(next.get('ch-study-viewer').hidden,false);assert.deepEqual(descendants(next.get('ch-study-viewer')).filter(n=>n.tagName==='INPUT').map(n=>n.checked),[true,false,true]);await button(next.get('ch-study-saved-list'),'Remove').fire('click');await tick();assert.equal(next.get('ch-study-saved-list').children.length,0);
});

test('malicious fix list text stays literal in the viewer and Saved list',async t=>{
 const evil='<img src=x onerror=alert(1)>',data=fixes();data.title=evil;data.fixes[0]={text:evil,why:evil,for:'next',src:evil};data.keep=[{text:evil,src:evil}];data.gaps=[evil];assert.equal(Study.parse(wrap(data),'fixes').ok,true);
 const f=panelFixture();t.after(()=>f.close());await tick();await f.controller.setMode('fixes');await f.controller.copy();f.controller.setAnswer(wrap(data));assert.equal(await f.controller.readAnswer(),true);assert.ok(f.get('ch-study-viewer').textContent.includes(evil));assert.ok(f.get('ch-study-saved-list').textContent.includes(evil));assert.equal(descendants(f.get('ch-study-viewer')).some(n=>['IMG','SCRIPT'].includes(n.tagName)),false);
});

test('Teacher feedback defaults off, persists only a boolean and never selects or fetches a feedback source by enabling',async t=>{
 const catalog=feedbackCatalog(),f=panelFixture({catalog});t.after(()=>f.close());await tick();assert.equal(f.controller.state.teacherFeedback,false);assert.equal(f.get('teacher-feedback').checked,false);assert.equal(f.get('teacher-feedback-list').children.length,0);assert.deepEqual([...f.controller.state.selected],['a']);assert.equal(f.requests.filter(r=>r.action==='collect').length,1);assert.equal(f.controller.state.mode,'outline');
 f.get('teacher-feedback').checked=true;f.get('teacher-feedback').fire('change');await tick();assert.equal(f.controller.state.teacherFeedback,true);assert.deepEqual(f.requests.find(r=>r.action==='preference').teacherFeedback,true);assert.equal(f.requests.find(r=>r.action==='preference').text,undefined);assert.equal(f.get('teacher-feedback-list').children.length,1);assert.match(f.get('teacher-feedback-list').textContent,/Teacher feedback: Essay/);assert.doesNotMatch(f.get('teacher-feedback-list').textContent,/Other essay/);assert.deepEqual([...f.controller.state.selected],['a']);assert.ok(f.requests.filter(r=>r.action==='collect').every(r=>!r.ids.some(id=>id.startsWith('feedback:'))));
 f.controller.setCatalog({...catalog,teacherFeedback:false});assert.equal(f.controller.state.teacherFeedback,true);assert.equal(f.get('teacher-feedback').checked,true);
});

test('feedback is opt-in even for pony fixes, stays selected across metadata refresh, and removes on option off or assignment removal',async t=>{
 const catalog={...feedbackCatalog(true),selectedIds:['a','feedback:c1:a'],ponyStudy:{id:'new',kind:'fixes',itemId:'a'}},f=panelFixture({catalog});t.after(()=>f.close());await tick();assert.equal(f.controller.state.mode,'fixes');assert.deepEqual([...f.controller.state.selected],['a']);assert.ok(f.requests.filter(r=>r.action==='collect').every(r=>!r.ids.some(id=>id.startsWith('feedback:'))));
 const feedbackTick=()=>descendants(f.get('teacher-feedback-list')).find(n=>n.tagName==='INPUT');feedbackTick().checked=true;feedbackTick().fire('change');await tick();assert.ok(f.controller.state.selected.has('feedback:c1:a'));assert.ok(f.requests.filter(r=>r.action==='collect').some(r=>r.ids.includes('feedback:c1:a')));
 f.controller.setCatalog({...catalog});await tick();assert.ok(f.controller.state.selected.has('feedback:c1:a'));descendants(f.get('selected-items')).find(n=>n.tagName==='BUTTON'&&n.dataset.sourceId==='feedback:c1:a').fire('click');await tick();assert.equal(f.controller.state.selected.has('feedback:c1:a'),false);
 feedbackTick().checked=true;feedbackTick().fire('change');await tick();f.controller.setTeacherFeedback(false);await tick();assert.equal(f.get('teacher-feedback-list').children.length,0);assert.equal(f.controller.state.selected.has('feedback:c1:a'),false);assert.equal(f.requests.findLast(r=>r.action==='preference').teacherFeedback,false);assert.ok(!f.requests.filter(r=>r.action==='collect').at(-1).ids.includes('feedback:c1:a'));
 f.controller.setTeacherFeedback(true);await tick();feedbackTick().checked=true;feedbackTick().fire('change');await tick();f.controller.setSelection('a',false);await tick();assert.equal(f.controller.state.selected.has('feedback:c1:a'),false);assert.equal(f.get('teacher-feedback-list').children.length,0);
});

test('feedback catalog with no comment sources offers nothing and feedback titles are text only',async t=>{
 const catalog=feedbackCatalog(true);catalog.sources=catalog.sources.filter(s=>s.kind!=='feedback');const f=panelFixture({catalog});t.after(()=>f.close());await tick();assert.equal(f.get('teacher-feedback-list').children.length,0);
 const evil='<img src=x onerror=alert(1)>',source={...feedbackCatalog(true).sources[2],title:evil};f.controller.setCatalog({...catalog,sources:[...catalog.sources,source]});await tick();assert.equal(f.get('teacher-feedback-list').textContent,evil);assert.equal(descendants(f.get('teacher-feedback-list')).some(n=>n.tagName==='IMG'),false);
});

test('automatic fixes answer returns, strictly parses and saves; explicit Bring it in can recover after invalid data',async t=>{
 let resolve;const waiting=new Promise(done=>{resolve=done;});const f=panelFixture({web:r=>r.op==='inject'?{status:'injected',answerId:'fix-return'}:r.op==='watch'?waiting:r.op==='read'?{status:'answer',text:wrap(fixes())}:{status:'opened'}});t.after(()=>f.close());await tick();await f.controller.setMode('fixes');assert.equal(await f.controller.inject(),true);await tick();assert.equal(f.controller.state.waiting,true);assert.equal(f.requests.find(r=>r.op==='watch').studyKind,'fixes');resolve({status:'answer',text:wrap({...fixes(),fixes:[]})});await tick();assert.ok(f.controller.state.studyErrors.length);assert.equal(Object.keys(f.storage.saved).length,0);assert.equal(await f.controller.bringAnswer(),true);assert.equal(f.controller.state.currentAid.kind,'fixes');assert.equal(f.controller.state.currentAidKey,'fixes:a');assert.deepEqual(Object.values(f.storage.saved)[0]['fixes:a'].data,fixes());
});

test('valid automatic fixes answer opens and saves without a paste or Bring it in click',async t=>{
 let resolve;const waiting=new Promise(done=>{resolve=done;});const f=panelFixture({web:r=>r.op==='inject'?{status:'injected',answerId:'automatic-fixes'}:r.op==='watch'?waiting:{status:'opened'}});t.after(()=>f.close());await tick();await f.controller.setMode('fixes');await f.controller.inject();await tick();resolve({status:'answer',text:'Outside envelope\n'+wrap(fixes())});await tick();assert.equal(f.controller.state.waiting,false);assert.equal(f.controller.state.currentAidKey,'fixes:a');assert.equal(f.get('ch-study-viewer').hidden,false);assert.deepEqual(Object.values(f.storage.saved)[0]['fixes:a'].data,fixes());assert.doesNotMatch(JSON.stringify(f.storage.saved),/Outside envelope|automatic-fixes|```/);assert.equal(f.requests.some(r=>r.op==='read'),false);
});

test('serialized code-block reader accepts fixes and ignores other kinds and nested kind markers',()=>{
 const self={},nodes=['{"kind":"reading"}','{"nested":{"kind":"fixes"}}',wrap(fixes())].map(text=>({textContent:text,contains(){return false;}})),run=guard=>vm.runInNewContext('('+Inject.readStudyBlock.toString()+')(guard)',{guard:{id:'chatgpt',origin:'https://chatgpt.com',kind:'fixes',after:0,...guard},document:{querySelectorAll:selector=>selector.startsWith('pre, code')?nodes:[]},URL,location:new URL('https://chatgpt.com/c/fixes'),self,top:self});
 assert.equal(run({countOnly:true}).count,3);assert.equal(run({}).text,wrap(fixes()));assert.equal(run({after:3}).status,'waiting');nodes.pop();assert.equal(run({}).status,'waiting');
});

test('provider bridge captures a fixes target and permits one immediate answer read with the same kind',async()=>{
 const scripts=[],session={'ch-ai-web:v1:1:chatgpt':{sourceTab:1,provider:'chatgpt',tabId:42,origin:'https://chatgpt.com'}},chrome={runtime:{id:'test'},storage:{session:{async get(key){return {[key]:session[key]};}}},permissions:{async contains(){return true;}},tabs:{async get(){return {id:42,url:'https://chatgpt.com/c/fixes',windowId:1};},async update(){}},windows:{async get(){return {type:'normal'};},async update(){}},scripting:{async executeScript(options){scripts.push(options);return [{frameId:0,result:options.func.name==='insertDraft'?{status:'injected',message:'Ready'}:options.args[0].countOnly?{count:0}:{status:'answer',text:wrap(fixes()),index:0}}];}}};
 const context=vm.createContext({chrome,URL,Map,Promise,Date,setTimeout,clearTimeout,CanvasHarnessProviders:require('../extension/ai-providers.js'),CanvasHarnessInject:Inject});vm.runInContext(fs.readFileSync('extension/ai-web.js','utf8'),context);const bridge=context.CanvasHarnessWeb,sender={id:'test',tab:{id:1},frameId:0},common={type:'ch-ai-web',provider:'chatgpt',scopeKey:'https://school.instructure.com|7|10|1',studyKind:'fixes',answerId:'fixes-read'};
 const injected=await bridge.handle({...common,action:'inject',text:'Fix list',bringAnswers:true},sender,{owner:'panel'});assert.equal(injected.answerId,'fixes-read');assert.equal(scripts[0].args[0].kind,'fixes');const read=await bridge.handle({...common,action:'read'},sender,{owner:'panel'});assert.equal(read.status,'answer');assert.equal(read.text,wrap(fixes()));assert.equal(scripts.at(-1).args[0].kind,'fixes');bridge.forget('panel');
});
