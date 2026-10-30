'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {panelFixture,tick,button}=require('./study-fixture.cjs');

test('the photo rule is part of H4 in the shared frame',()=>{
 const text=fs.readFileSync('extension/study-prompts.js','utf8'),S=require('../extension/study-prompts.js'),ctx={sources:[{label:'Notes',text:'x'}]};
 for(const message of [S.build('practice',ctx),S.buildChoice(['lab','reading'],ctx)])assert.match(message,/\nH4\.[^\n]*Course facts come only from the material below\.[^\n]* Photos named in the material are attached in this chat; use them as material\.\nH5\./);
 assert.equal(text.split('Photos named in the material').length,2);
});

test('photo chips add literal descriptions, remove, enforce six and 80 characters, and clear with PDFs',async t=>{
 const f=panelFixture();t.after(()=>f.close());await tick();f.controller.setSelection('a',false);
 f.get('photo-description').value='<img src=x> worksheet';f.get('photo-add').fire('click');
 assert.equal(f.get('photo-description').value,'');assert.equal(f.get('photo-list').children[0].children[0].textContent,'Photo 1: <img src=x> worksheet');assert.equal(f.get('send').disabled,false);
 assert.equal(f.controller.addPhoto('   '),false);f.controller.addPhoto('x'.repeat(81));assert.equal(f.controller.state.photos[1].text.length,80);
 for(let i=2;i<6;i++)assert.equal(f.controller.addPhoto('Page '+i),true);
 assert.equal(f.controller.addPhoto('Too many'),false);assert.equal(f.get('photo-add').disabled,true);assert.equal(f.get('photo-description').disabled,true);
 button(f.get('photo-list').children[0],'Remove').fire('click');assert.equal(f.controller.state.photos.length,5);assert.equal(f.get('photo-add').disabled,false);assert.equal(f.get('photo-list').children[0].children[0].textContent,'Photo 1: '+'x'.repeat(80));
 f.controller.state.pdfs.push({id:'pdf:old'});f.controller.setCatalog({...f.catalog,scopeKey:'https://school.instructure.com|8|c1|a'});await tick();
 assert.deepEqual(f.controller.state.photos,[]);assert.deepEqual(f.controller.state.pdfs,[]);assert.equal(f.get('photo-list').children.length,0);
 const html=fs.readFileSync('extension/ai-panel.html','utf8');assert.match(html,/id="photo-description"[^>]*maxlength="80"[^>]*placeholder="What is in it\?"/);
});

for(const kind of ['ask','practice','reading','lab','rubric'])test('photos are individual '+kind+' sources in preview, copy and Send with exact reminders',async t=>{
 const f=panelFixture();t.after(()=>f.close());await tick();f.controller.addPhoto('Worksheet');f.controller.addPhoto('n'.repeat(80));await f.controller.setMode(kind);await f.controller.preview();
 const context=f.controller.state.context,expected='The student attaches this photo in this chat. Read it as part of the material. If it is missing or cannot be read, say so '+(kind==='ask'?'at the start of the answer.':'in "gaps".');
 assert.deepEqual(context.sources.slice(0,2),[{label:'Photo 1: Worksheet',text:expected},{label:'Photo 2: '+'n'.repeat(80),text:expected}]);
 assert.equal(context.included.filter(s=>s.kind==='photo').length,2);assert.match(f.get('context-text').textContent,/Photo 1: Worksheet/);
 await f.controller.copy();const message=f.copied.at(-1);assert.ok(message.includes('Photo 1: Worksheet'));assert.ok(message.includes('Photo 2: '+'n'.repeat(80)));assert.equal(message.split(expected).length,3);
 if(kind!=='ask'){assert.equal(f.get('ch-study-preview').textContent,message);assert.ok(message.includes('<<<SOURCE 1: Photo 1: Worksheet>>>'));assert.match(message,/H4\.[^\n]+ Photos named in the material are attached in this chat; use them as material\.\nH5\./);}
 assert.ok(f.get('notice').textContent.endsWith('Attach Photo 1, Photo 2 in ChatGPT before sending.'));
 f.controller.setProvider('claude');f.controller.setAutoSend(true);assert.equal(await f.controller.inject(),true);const sent=f.requests.findLast(r=>r.op==='inject');assert.equal(sent.text,message);assert.equal(sent.autoSend,false);assert.ok(f.get('notice').textContent.endsWith('Attach Photo 1, Photo 2 in Claude before sending.'));
 f.controller.removePhoto(f.controller.state.photos[0].id);await tick();await f.controller.copy();assert.ok(f.copied.at(-1).includes('Photo 1: '+'n'.repeat(80)));assert.ok(!f.copied.at(-1).includes('Worksheet'));assert.ok(f.get('notice').textContent.endsWith('Attach Photo 1 in Claude before sending.'));
});

test('photos survive study material truncation, and fallback drafts retain the attachment reminder',async t=>{
 const f=panelFixture({clipboardFail:true,webStatus:'no-editor',collect:()=>({scopeKey:'https://school.instructure.com|7|c1|a',text:'x'.repeat(100000),included:[{id:'a',title:'Long'}],sources:[{id:'a',label:'Long',text:'x'.repeat(30000)}],omitted:[]})});t.after(()=>f.close());await tick();
 for(let i=0;i<6;i++)f.controller.addPhoto('Page '+i);await f.controller.setMode('lab');await tick();
 assert.ok(f.controller.state.studyMessage.includes('Photo 6: Page 5'));assert.ok(f.controller.state.context.characters<=500000);
 f.controller.acceptIssues(true);assert.equal(await f.controller.inject(),false);assert.match(f.get('notice').textContent,/Attach Photo 1, Photo 2, Photo 3, Photo 4, Photo 5, Photo 6 in ChatGPT before sending\./);
 assert.equal(await f.controller.copy(),false);assert.equal(f.controller.state.manualCopy,true);assert.match(f.get('notice').textContent,/Attach Photo 1/);
});
