'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Study:S,panelFixture,tick,wrap}=require('./study-fixture.cjs');

test('short direct answers and Help choices accept bounded prose paragraphs',()=>{
 for(const answer of ['The bus leaves at 15:30.','Your personal deadline is Friday at 23:59.','The chstudy format stores your study answer.']){
  for(const read of [text=>S.parse(text,'ask'),text=>S.parseChosen(text,['steps','outline','ask'])]){
   const r=read(answer);assert.equal(r.ok,true);assert.deepEqual(r.data.points,[{text:answer,src:'AI answer'}]);
   assert.equal(r.data.kind,'ask');assert.equal(r.data.next,'');assert.deepEqual(r.data.gaps,[]);
  }
 }
 const r=S.parse('First paragraph.\r\n\r\nSecond paragraph.\r\n \r\nThird paragraph.\n\nFourth paragraph.','ask');
 assert.deepEqual(r.data.points.map(p=>p.text),['First paragraph.','Second paragraph.','Third paragraph.']);
 const long='a'.repeat(1200),read=S.parse(long,'ask');assert.equal(read.ok,true);assert.equal(read.data.points[0].text,long);
 assert.equal(S.parse(wrap(read.data),'ask',{storedPlainAnswer:true}).ok,true,'normalized saved prose must reopen');
 assert.equal(S.parse(wrap(read.data),'ask').ok,false,'remote structured replies keep their strict contract');
});

test('prose fallback cannot conceal malformed structured answers or relax other kinds',()=>{
 const invalid=['','   ','x'.repeat(1201),'```chstudy\n{"v":1','```chstudy\nnot JSON\n```','~~~js\nalert(1)\n~~~','```\nJust prose\n```','chstudy\n{"kind":','{"kind":','["partial"'];
 for(const answer of invalid){assert.equal(S.parse(answer,'ask').ok,false,answer);assert.equal(S.parseChosen(answer,['steps','ask']).ok,false,answer);}
 for(const kind of Object.keys(S.SHAPES).filter(k=>k!=='ask'))assert.equal(S.parse('The bus leaves at 15:30.',kind).ok,false,kind);
 const bad={v:1,kind:'ask',title:'Answer',points:[{text:'Missing source'}],next:'',gaps:[]};
 assert.equal(S.parse(wrap(bad),'ask').ok,false);assert.equal(S.parseChosen(wrap(bad),['steps','ask']).ok,false);
 assert.equal(S.parseChosen(wrap({...bad,kind:'outline'}),['steps','ask']).ok,false);
 const good={...bad,points:[{text:'The bus leaves at 15:30.',src:'AI answer'}],next:'Bring your bag.'};
 assert.equal(S.parse(wrap(good),'ask').ok,true);
 assert.equal(S.parse(wrap({...good,next:''}),'ask').ok,false,'empty next remains invalid in an incoming block');
 assert.equal(S.parse(wrap({...good,points:[{text:'a'.repeat(701),src:'AI answer'}]}),'ask').ok,false,'structured point limits remain strict');
});

test('plain answers apply the shared privacy filter with explicit grade consent',()=>{
 const text='The bus leaves at 15:30.\n\nI got 52% on my quiz.\n\nPartner: Alice Example',privacy={peers:['Alice Example'],allowed:[]};
 for(const read of [text=>S.parse(text,'ask',{privacy}),text=>S.parseChosen(text,['steps','ask'],{privacy})]){
  const r=read(text);assert.equal(r.ok,true);assert.doesNotMatch(JSON.stringify(r.data),/52%|Alice Example/);assert.match(JSON.stringify(r.data),/15:30/);
 }
 const consent=S.parse(text,'ask',{privacy,showGrades:true});assert.match(JSON.stringify(consent.data),/52%/);assert.doesNotMatch(JSON.stringify(consent.data),/Alice Example/);
});

for(const choice of [false,true])test('Help '+(choice?'choice':'Ask')+' prose saves, renders literally and reopens',async t=>{
 const item={id:'a',title:'Travel permission form',kind:'assignment',courseId:'c1'},f=panelFixture({catalog:{scopeKey:'https://school.instructure.com|7|c1|a',active:item,courseId:'c1',courses:[{id:'c1',name:'Advisory'}],selectedIds:['a'],sources:[item],showGrades:false,privacy:{peers:['Alice Example'],allowed:[]},helpContext:{requested:true,active:item}}});t.after(()=>f.close());
 await tick();f.controller.setDraft(choice?'help':'when is this actually due for me');await tick();
 assert.equal(f.controller.state.helpChoice,choice);assert.equal(await f.controller.copy(),true);
 f.controller.setAnswer('The bus leaves at 15:30. <img src=x onerror=alert(1)>\n\nI got 52% on my quiz. Partner: Alice Example');
 assert.equal(await f.controller.readAnswer(),true);assert.deepEqual(f.controller.state.studyErrors,[]);
 const aid=f.controller.state.currentAid;assert.equal(aid.kind,'ask');assert.doesNotMatch(JSON.stringify(aid.data),/52%|Alice Example/);
 assert.match(f.get('ch-study-viewer').textContent,/<img src=x onerror=alert\(1\)>/);assert.equal(f.nodes.some(n=>['IMG','SCRIPT','A'].includes(n.tagName)),false);
 assert.equal(f.controller.openAid(f.controller.state.currentAidKey),true);assert.equal(f.storage.writes.length>0,true);
 f.controller.setAnswer('a'.repeat(1200));assert.equal(await f.controller.readAnswer(),true);
 assert.equal(f.controller.openAid(f.controller.state.currentAidKey),true);assert.equal(f.controller.state.currentAid.data.points[0].text.length,1200);
});
