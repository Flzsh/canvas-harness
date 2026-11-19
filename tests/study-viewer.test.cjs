'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const UI=require('../extension/study-ui.js');
const {dom,practice,reading,lab,descendants,button,tick,panelFixture,wrap}=require('./study-fixture.cjs');
function fixture(data,progress={}){const f=dom(),host=new f.Element('div'),saved=[],errors=[],env={document:f.document,print(){}};UI.renderViewer(host,{title:data.title,kind:data.kind,data,progress},{env,onProgress:value=>saved.push(value),onError:e=>errors.push(e)});return {...f,host,saved,errors,env};}
for(const kind of ['practice','flashcards']){
 const sample=()=>kind==='practice'?{...practice(),items:practice().items.slice(0,2)}:{kind,title:'Cards',cards:[{front:'First front',back:'First back',src:'p. 1'},{front:'Second front',back:'Second back',src:'p. 2'}],gaps:[]};
 test(kind+' before is one safe text line below the header and persists through interactions',()=>{
  const data={...sample(),before:' \tRead  <img src=x onerror=alert(1)> & <script>alert(2)</script>\r\n first.\u00a0 '},f=fixture(data),note=descendants(f.host).find(n=>n.className==='ch-study-before');
  const check=(view,expected=note)=>{const root=view.host.children[0],lines=descendants(root).filter(n=>n.className==='ch-study-before');assert.equal(lines.length,1);assert.equal(lines[0],expected);assert.equal(expected.tagName,'P');assert.equal(expected.textContent,'Read <img src=x onerror=alert(1)> & <script>alert(2)</script> first.');assert.equal(expected.children.length,0);assert.equal(expected.hidden,false);assert.equal(root.children[1].tagName,'H2');assert.equal(root.children[2].textContent,UI.LABELS[kind]);assert.equal(root.children[3],expected);assert.equal(root.children[4].className,'ch-study-content');assert.equal(root.children[4].hidden,false);assert.ok(descendants(root.children[4]).some(n=>n.tagName===(kind==='practice'?'H3':'BUTTON')));assert.ok(!descendants(root).some(n=>['IMG','SCRIPT'].includes(n.tagName)));};
  check(f);
  if(kind==='practice'){
   button(f.host,'a').fire('click');check(f);button(f.host,'Next').fire('click');check(f);assert.match(f.host.textContent,/Question 1/);
   button(f.host,'b').fire('click');button(f.host,'Next').fire('click');check(f);assert.match(f.host.textContent,/Score: 1 \/ 2/);
   button(f.host,'Missed ones again').fire('click');check(f);assert.match(f.host.textContent,/Question 0/);button(f.host,'b').fire('click');button(f.host,'Next').fire('click');check(f);
  }else{
   const card=descendants(f.host).find(n=>n.className==='ch-study-card');card.fire('click');check(f);assert.match(card.textContent,/First back/);card.fire('click');check(f);assert.equal(card.textContent,'First front');
   button(f.host,'I knew it').fire('click');check(f);assert.equal(card.textContent,'Second front');card.fire('click');check(f);assert.match(card.textContent,/Second back/);button(f.host,'Skip').fire('click');check(f);assert.equal(card.textContent,'First front');
  }
  const restored=fixture(data,f.saved.at(-1));check(restored,descendants(restored.host).find(n=>n.className==='ch-study-before'));assert.deepEqual(f.errors,[]);
 });
 test(kind+' omits empty, whitespace-only and legacy absent before without adding a placeholder',()=>{
  for(const extra of [{},{before:''},{before:' \t\r\n\u00a0 '}]){const f=fixture({...sample(),...extra}),root=f.host.children[0];assert.equal(descendants(root).filter(n=>n.className==='ch-study-before').length,0);assert.deepEqual(root.children.map(n=>n.tagName),['BUTTON','H2','P','DIV','SECTION']);assert.equal(root.children[3].className,'ch-study-content');}
 });
}

test('practice grades choices, explains the wrong choice, restores progress and retries only missed questions',()=>{
 const data=practice(),f=fixture(data),first=descendants(f.host).find(n=>n.className==='ch-study-feedback');assert.equal(first.getAttribute('aria-live'),'polite');assert.match(f.host.textContent,/1 \/ 10/);
 button(f.host,'a').fire('click');assert.match(first.textContent,/Wrong.*Because.*Wrong idea/s);assert.equal(button(f.host,'a').dataset.result,'wrong');assert.equal(button(f.host,'b').disabled,true);
 button(f.host,'Next').fire('click');assert.match(f.host.textContent,/2 \/ 10/);assert.equal(f.document.activeElement.tagName,'H3');
 const p=f.saved.at(-1);for(let i=1;i<10;i++)p.practice.answers[i]={correct:true,choice:i<5?1:false};p.practice.at=10;
 const end=fixture(data,p);assert.match(end.host.textContent,/Score: 9 \/ 10/);button(end.host,'Missed ones again').fire('click');assert.match(end.host.textContent,/1 \/ 1/);assert.match(end.host.textContent,/Question 0/);
 button(end.host,'b').fire('click');button(end.host,'Next').fire('click');assert.match(end.host.textContent,/Score: 1 \/ 1/);assert.equal(button(end.host,'Missed ones again').disabled,true);
 const restored=fixture(data,f.saved[0]);assert.match(restored.host.textContent,/Wrong.*Wrong idea/s);assert.equal(button(restored.host,'a').disabled,true);
});
test('short answer reveals the answer and explanation then records the student rating; true/false grades booleans',()=>{
 const data=practice(),f=fixture(data,{practice:{at:5,order:data.items.map((_,i)=>i),answers:{}}});
 const input=descendants(f.host).find(n=>n.tagName==='TEXTAREA');input.value='My answer';input.fire('input');assert.equal(f.saved.at(-1).practice.answers[5].draft,'My answer');
 assert.equal(button(f.host,'Next').disabled,true);button(f.host,'Show answer').fire('click');assert.match(f.host.textContent,/A short answer.*Because/s);button(f.host,'Not yet').fire('click');assert.equal(f.saved.at(-1).practice.answers[5].correct,false);
 const tf=fixture(data,{practice:{at:8,order:data.items.map((_,i)=>i),answers:{}}});assert.ok(button(tf.host,'True'));button(tf.host,'False').fire('click');assert.equal(tf.saved.at(-1).practice.answers[8].correct,true);assert.match(tf.host.textContent,/Right.*Because/s);
});
test('reading keeps ordered points and term sources and reveals answers with persisted progress',()=>{
 const f=fixture(reading());assert.equal(descendants(f.host).filter(n=>n.tagName==='OL')[0].children.length,5);assert.equal(descendants(f.host).filter(n=>n.className==='ch-study-term').length,4,'each term is a row that opens to its meaning');
 const show=button(f.host,'Show answer');show.fire('click');assert.match(f.host.textContent,/Answer 0/);assert.equal(f.saved.at(-1).revealed['check:0'],true);assert.match(f.host.textContent,/p\. 4/);
 const gaps=descendants(f.host).find(n=>n.className==='ch-study-gaps');assert.equal(gaps.hidden,true);
});
test('lab checkboxes save ticks, prelab answers are nonempty, and print contains only the selected empty table',()=>{
 const f=fixture(lab()),ticks=descendants(f.host).filter(n=>n.tagName==='INPUT');assert.equal(ticks.length,2);
 ticks[0].checked=true;ticks[0].fire('change');ticks[1].checked=true;ticks[1].fire('change');assert.deepEqual(f.saved.at(-1).checked,{'material:0':true,'step:0':true});
 const restored=fixture(lab(),f.saved.at(-1));assert.ok(descendants(restored.host).filter(n=>n.tagName==='INPUT').every(n=>n.checked));
 button(f.host,'Show answer').fire('click');assert.match(f.host.textContent,/The length/);assert.doesNotMatch(f.host.textContent,/Find out in the lab/);assert.match(f.host.textContent,/Not in the material.*No further details/s);
 const tables=descendants(f.host).filter(n=>n.tagName==='TABLE');assert.equal(tables.length,2);assert.equal(tables[0].children.find(n=>n.tagName==='TBODY').children.length,5);assert.equal(descendants(tables[0]).filter(n=>n.tagName==='TD').length,10);
 let printed=0;f.env.print=()=>{printed++;const root=f.document.body.children[0];assert.equal(root.className,'ch-study-print-root');assert.equal(descendants(root).filter(n=>n.tagName==='TABLE').length,1);assert.match(root.textContent,/Length \(m\)/);assert.doesNotMatch(root.textContent,/Other|Wear goggles|Steps/);assert.match(f.document.body.className,/ch-study-printing/);};button(f.host,'Print table').fire('click');assert.equal(printed,1);assert.equal(f.document.body.children.length,0);assert.doesNotMatch(f.document.body.className,/ch-study-printing/);
});
test('mounted Saved list opens/removes an aid and progress survives remount',async t=>{
 const f=panelFixture();t.after(()=>f.close());await tick();await f.controller.setMode('practice');await f.controller.copy();f.controller.setAnswer(wrap(practice()));await f.controller.readAnswer();
 button(f.get('ch-study-viewer'),'a').fire('click');await tick();assert.match(f.get('ch-study-saved-list').textContent,/Practice.*Practice set.*Open.*Remove/s);
 const next=panelFixture({storage:f.storage});t.after(()=>next.close());await tick();button(next.get('ch-study-saved-list'),'Open').fire('click');assert.match(next.get('ch-study-viewer').textContent,/Wrong.*Wrong idea/s);
 await button(next.get('ch-study-saved-list'),'Remove').fire('click');await tick();assert.equal(next.get('ch-study-viewer').hidden,true);assert.equal(next.get('ch-study-saved-list').children.length,0);
});
