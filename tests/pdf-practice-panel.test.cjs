'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Study,tick,panelFixture}=require('./study-fixture.cjs'),{createPdfHandoff}=require('../extension/ai-source.js');
for(const intent of ['practice','reading','lab'])test('mounted PDF '+intent+' handoff selects the study mode and previews exactly the selected pages',async t=>{
 const source=createPdfHandoff({origin:'https://school.instructure.com',accountId:'7',fileId:'42',name:'Reading.pdf',text:'Every word of the selected reading.',page:1,endPage:3,intent});t.after(()=>source.destroy());
 const f=panelFixture({catalog:source.summary(),collect:data=>source.collect(data)});t.after(()=>f.close());await tick();
 assert.equal(f.controller.state.mode,intent);assert.equal(f.get('selection-summary').textContent,Study.KINDS[intent]&&(intent==='practice'?'Practice set':intent==='lab'?'Lab checklist':'Reading guide')+' from pages 2–4');assert.equal(f.get('prompt').hidden,false);assert.equal(f.get('ch-study-preview').hidden,false);assert.equal(f.get('auto-send').checked,false);
 const context=await source.collect({ids:source.summary().selectedIds}),expected=Study.build(intent,{level:'high school',course:'',item:'',due:'',sources:context.sources});assert.equal(f.get('ch-study-preview').textContent,expected);assert.equal(f.requests.some(r=>r.action==='web'),false);
 f.get('composer').fire('submit');await tick();assert.equal(f.requests.find(r=>r.op==='inject').text,expected);assert.equal(f.get('ch-study-paste').hidden,false);
});
test('mounted ordinary PDF Ask panel retains its empty editable question',async t=>{
 const source=createPdfHandoff({origin:'https://school.instructure.com',accountId:'7',fileId:'42',name:'Reading.pdf',text:'PDF text.',page:0});t.after(()=>source.destroy());const f=panelFixture({catalog:source.summary(),collect:data=>source.collect(data)});t.after(()=>f.close());await tick();
 assert.equal(f.get('selection-summary').textContent,'From your PDF');assert.equal(f.get('prompt').value,'');assert.equal(f.get('prompt').hidden,false);assert.equal(f.get('prompt').placeholder,'Ask about these pages…');assert.deepEqual(f.requests.map(r=>r.action),['catalog','collect']);
});
