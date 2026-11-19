'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Study,tick,practice,reading,lab,rubric,wrap,panelFixture,descendants}=require('./study-fixture.cjs');

test('panel packages study scripts in order, all controller DOM targets exist, and viewers have no HTML sinks',()=>{
 const fs=require('node:fs'),path=require('node:path'),read=name=>fs.readFileSync(path.join(__dirname,'../extension',name),'utf8'),html=read('ai-panel.html'),panel=read('ai-panel.js'),ui=read('study-ui.js');
 const scripts=[...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(m=>m[1]);assert.ok(scripts.indexOf('study-prompts.js')<scripts.indexOf('study-ui.js'));assert.ok(scripts.indexOf('study-ui.js')<scripts.indexOf('ai-panel.js'));for(const file of scripts)assert.ok(fs.existsSync(path.join(__dirname,'../extension',file)));
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));for(const [,id]of panel.matchAll(/byId\('([^']+)'\)/g))assert.ok(ids.has(id),'Missing panel element '+id);
 assert.doesNotMatch(panel+ui,/\.(?:innerHTML|outerHTML|insertAdjacentHTML)\b/);assert.doesNotMatch(html,/ch-study-mode|What for/);
});

for(const kind of ['practice','reading','lab','rubric'])test('study '+kind+' previews and sends exactly build for individual selected sources',async t=>{
 const f=panelFixture();t.after(()=>f.close());await tick();f.controller.setDraft('Keep my Ask question');f.controller.setSelection('b',true);
 await f.controller.setMode(kind);await tick();
 const expected=Study.build(kind,{level:'high school',course:'Biology',item:'Assignment A',due:'2026-10-21',sources:[{label:'Instructions A',text:'Body a'},{label:'Reading B',text:'Body b'}]});
 assert.equal(f.get('ch-study-preview').textContent,expected);assert.equal(f.get('prompt').hidden,false);assert.equal(f.get('ch-study-preview').hidden,false);
 assert.equal(await f.controller.inject(),true);assert.equal(f.requests.find(r=>r.op==='inject').text,expected);assert.equal(f.get('ch-study-paste').hidden,false);
 assert.equal(await f.controller.copy(),true);assert.equal(f.copied.at(-1),expected);
 await f.controller.setMode('ask');assert.equal(f.get('prompt').value,'Keep my Ask question');assert.equal(f.get('prompt').hidden,false);
});
test('paste failures show the strict reader errors, keep text, and never save partial data',async t=>{
 const f=panelFixture();t.after(()=>f.close());await tick();await f.controller.setMode('practice');await f.controller.copy();
 const bad=wrap({...practice(),items:[...practice().items,practice().items[0]]});f.get('ch-study-answer').value=bad;f.get('ch-study-answer').fire('input');await f.get('ch-study-read').fire('click');await tick();
 assert.equal(f.get('ch-study-answer').value,bad);assert.deepEqual(f.get('ch-study-errors').children.map(n=>n.textContent),Study.parse(bad,'practice').errors);assert.equal(f.storage.writes.length,0);
 f.get('ch-study-answer').value=wrap(practice());f.get('ch-study-answer').fire('input');await f.get('ch-study-read').fire('click');await tick();
 assert.equal(f.get('ch-study-viewer').hidden,false);assert.match(f.get('ch-study-viewer').textContent,/Question 0/);assert.equal(Object.values(f.storage.saved)[0]['practice:a'].item,'Assignment A');
});
test('selection changes rebuild study preview and copies respect issue review',async t=>{
 const f=panelFixture({collect:data=>({scopeKey:'https://school.instructure.com|7|c1|a',text:'Available',included:data.ids.map(id=>({id,title:id})),sources:data.ids.map(id=>({id,label:id,text:'Body '+id})),omitted:[{title:'Missing PDF',reason:'Unreadable'}]})});t.after(()=>f.close());await tick();await f.controller.setMode('reading');
 assert.equal(await f.controller.copy(),false);assert.equal(f.copied.length,0);f.controller.acceptIssues(true);assert.equal(await f.controller.copy(),true);
 f.controller.setSelection('b',true);await tick();assert.equal(f.controller.state.mode,'ask');await f.controller.setMode('reading');assert.match(f.get('ch-study-preview').textContent,/SOURCE 2: b/);assert.equal(await f.controller.copy(),false);assert.equal(f.copied.length,1);
});
test('study material beyond the supplied build limit must be reviewed before sending',async t=>{
 const f=panelFixture({collect:()=>({scopeKey:'https://school.instructure.com|7|c1|a',text:'x'.repeat(510000),included:[{id:'a',title:'a'}],sources:[{id:'a',label:'a',text:'x'.repeat(510000)}],omitted:[]})});t.after(()=>f.close());await tick();await f.controller.setMode('practice');
 assert.ok(f.controller.state.context.issues.some(i=>/500,000|500000/.test(i.reason)));assert.equal(await f.controller.inject(),false);f.controller.acceptIssues(true);assert.equal(await f.controller.inject(),true);
});
test('clipboard fallback reveals paste and failed injection does not claim an answer was sent',async t=>{
 const f=panelFixture({clipboardFail:true,webStatus:'no-editor'});t.after(()=>f.close());await tick();await f.controller.setMode('lab');assert.equal(await f.controller.inject(),false);assert.equal(f.get('ch-study-paste').hidden,true);
 assert.equal(await f.controller.copy(),false);assert.equal(f.controller.state.manualCopy,true);assert.equal(f.get('ch-study-paste').hidden,false);assert.equal(f.get('fallback-text').value,f.get('ch-study-preview').textContent);
});
test('mode and item changes cannot save a reply under a different request',async t=>{
 const f=panelFixture();t.after(()=>f.close());await tick();await f.controller.setMode('practice');await f.controller.copy();f.controller.setAnswer(wrap(practice()));
 await f.controller.setMode('reading');assert.equal(f.get('ch-study-paste').hidden,true);assert.equal(await f.controller.readAnswer(),false);assert.equal(f.storage.writes.length,0);
});
test('a rejected save still shows the aid (said plainly it was not saved) and keeps the answer',async t=>{
 const f=panelFixture();t.after(()=>f.close());await tick();await f.controller.setMode('lab');await f.controller.copy();const answer=wrap(lab());f.controller.setAnswer(answer);f.storage.set=async()=>{throw Error('Storage full');};
 assert.equal(await f.controller.readAnswer(),true);assert.equal(f.get('ch-study-answer').value,answer);assert.equal(f.get('ch-study-viewer').hidden,false);assert.match(f.get('notice').textContent,/Not saved: Storage full/);assert.equal(f.controller.state.currentAidKey,null);
});
test('saved metadata uses the Canvas assignment ID and retains course and item title',async t=>{
 const f=panelFixture();t.after(()=>f.close());await tick();f.catalog.active.assignmentId='42';f.controller.setCatalog(f.catalog);await f.controller.setMode('reading');await f.controller.copy();f.controller.setAnswer(wrap(reading()));assert.equal(await f.controller.readAnswer(),true);
 const aid=Object.values(f.storage.saved)[0]['reading:42'];assert.ok(aid);assert.equal(aid.itemId,'42');assert.equal(aid.courseId,'c1');assert.equal(aid.item,'Assignment A');assert.equal(aid.v,1);assert.deepEqual(aid.progress,{});
});
test('attached PDFs each keep their own filename and a removal updates the exact study message',async t=>{
 const f=panelFixture();t.after(()=>f.close());await tick();f.controller.state.pdfs.push({id:'pdf:x',title:'Handout.pdf',text:'Local PDF words',pages:1,totalPages:1,warnings:[],truncated:false});await f.controller.setMode('lab');
 const expected=Study.build('lab',{level:'high school',course:'Biology',item:'Assignment A',due:'2026-10-21',sources:[{label:'Instructions A',text:'Body a'},{label:'Handout.pdf',text:'Local PDF words'}]});assert.equal(f.get('ch-study-preview').textContent,expected);
 f.controller.removePDF('pdf:x');await tick();assert.doesNotMatch(f.get('ch-study-preview').textContent,/Local PDF words|Handout\.pdf/);
});
test('all AI text in all viewers remains literal with no HTML elements or links',async t=>{
 const payload='<img src=x onerror=alert(1)>';
 for(const data of [practice(),reading(),lab(),rubric()]){
  const f=panelFixture();t.after(()=>f.close());await tick();await f.controller.setMode(data.kind);await f.controller.copy();
  const poison=value=>typeof value==='string'?payload:Array.isArray(value)?value.map(poison):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,['kind','type'].includes(k)?v:poison(v)])):value;
  const reply=poison(data);f.controller.setAnswer(wrap(reply));assert.equal(await f.controller.readAnswer(),true);
  assert.match(f.get('ch-study-viewer').textContent,/<img src=x onerror=alert\(1\)>/);assert.equal(f.nodes.filter(n=>['IMG','A','SCRIPT'].includes(n.tagName)).length,0);
  assert.equal(descendants(f.get('ch-study-viewer')).some(n=>n.tagName==='H3'),true);
 }
});
