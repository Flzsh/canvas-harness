'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=()=>require('../extension/gpa-model.js');
const course=(id,grade,extra={})=>({id:String(id),name:'Course '+id,grade,score:null,scoreScope:'overall',overallGrade:grade,overallScore:null,...extra});
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-10,`${actual} should equal ${expected}`);

test('A and B with equal credits give 3.5 on both unweighted scales',()=>{
 const result=model().calculate([course(1,'A'),course(2,'B')]);
 near(result.unweighted.scale4,3.5);near(result.unweighted.scale43,3.5);
 assert.equal(result.countedCourses,2);assert.equal(result.totalCredits,2);assert.equal(result.weighted,null);
});
test('A+ and A distinguish the 4.0 cap from the 4.3 table',()=>{
 const result=model().calculate([course(1,'A+'),course(2,'A')]);
 near(result.unweighted.scale4,4);near(result.unweighted.scale43,4.15);
});
test('credit weighting is shared by unweighted and level-weighted results',()=>{
 const prefs=model().defaults();prefs.weighted=true;prefs.courses['1']={credits:2,level:'ap'};
 const result=model().calculate([course(1,'A'),course(2,'B')],prefs);
 near(result.unweighted.scale4,11/3);near(result.weighted.scale4,13/3);
 near(result.weighted.scale43,13/3);assert.equal(result.totalCredits,3);
});
test('every default cutoff is inclusive without rounding the percentage',()=>{
 const g=model();
 for(const rule of g.defaults().rules){
  const result=g.calculate([course(1,null,{score:rule.min,overallScore:rule.min})]);
  assert.equal(result.rows[0].letter,rule.letter);near(result.unweighted.scale4,rule.points4);
 }
 const result=g.calculate([course(1,null,{overallScore:92.999999})]);
 assert.equal(result.rows[0].letter,'A-');near(result.unweighted.scale4,3.7);
 assert.equal(g.calculate([course(1,null,{overallScore:110})]).rows[0].letter,'A+');
});
test('an exact Canvas letter wins over a conflicting percentage',()=>{
 const result=model().calculate([course(1,'B',{overallScore:99})]);
 assert.equal(result.rows[0].source,'canvas-letter');near(result.unweighted.scale4,3);
 assert.equal(model().calculate([course(1,'A (Excellent)',{overallScore:91})]).rows[0].letter,'A-');
});
test('null, blank, undefined, booleans, NaN and infinity never become zero or F',()=>{
 for(const score of [null,'',' ',undefined,false,true,NaN,Infinity,-Infinity,-2]){
  const result=model().calculate([course(1,null,{score,overallScore:score})]);
  assert.equal(result.countedCourses,0,String(score));assert.equal(result.unweighted.scale4,null);
 }
 assert.equal(model().calculate([course(1,null,{overallScore:0})]).unweighted.scale4,0);
});
test('pass, satisfactory, incomplete and other non-GPA grades ignore numeric scores',()=>{
 for(const grade of ['P','Pass','S','Incomplete','I','W','CR','NP','Satisfactory','In progress']){
  const result=model().calculate([course(1,grade,{score:98,overallScore:98})]);
  assert.equal(result.countedCourses,0,grade);assert.equal(result.rows[0].reason,'non-gpa');
 }
});
test('a deliberate manual letter permits a what-if estimate for a non-GPA course',()=>{
 const prefs=model().defaults();prefs.courses['1']={override:'A',included:true};
 const result=model().calculate([course(1,'P',{overallScore:100})],prefs);
 assert.equal(result.countedCourses,1);assert.equal(result.whatIfCount,1);
 assert.equal(result.rows[0].source,'manual');assert.equal(result.rows[0].canvasLabel,'P');near(result.unweighted.scale4,4);
});
test('hidden grades cannot be used by any scope, explicit inclusion, or manual override',()=>{
 for(const marker of [{hideFinalGrades:true},{scoreScope:'hidden'}])for(const scope of ['overall','current-period']){
  const prefs=model().defaults();prefs.scope=scope;prefs.courses['1']={included:true,override:'A+'};
  const result=model().calculate([course(1,'A',{score:99,overallScore:99,...marker})],prefs);
  assert.equal(result.countedCourses,0);assert.equal(result.exclusions.hidden,1);
  for(const key of ['letter','percent','canvasLabel','canvasPercent','points4','points43'])assert.equal(result.rows[0][key],null,key);
 }
});
test('current-period mode never falls back to overall grades',()=>{
 const prefs=model().defaults();prefs.scope='current-period';
 const result=model().calculate([
  course(1,null,{scoreScope:'current-period',overallGrade:'A',overallScore:95,gradingPeriodTitle:'Fall'}),
  course(2,'A',{scoreScope:'overall',score:95}),
  course(3,'B',{scoreScope:'current-period',overallGrade:'A',gradingPeriodTitle:'Fall'})
 ],prefs);
 assert.equal(result.countedCourses,1);near(result.unweighted.scale4,3);
 assert.equal(result.rows[0].reason,'missing');assert.equal(result.rows[1].reason,'period-unavailable');
});
test('overall mode never borrows a current-period grade but permits same-scope legacy fields',()=>{
 const result=model().calculate([
  course(1,'A',{scoreScope:'current-period',overallGrade:null,overallScore:null}),
  course(2,'B',{scoreScope:'overall',overallGrade:undefined,overallScore:undefined})
 ]);
 assert.equal(result.countedCourses,1);near(result.unweighted.scale4,3);assert.equal(result.rows[0].letter,null);
});
test('overall and current-period averages use their chosen source consistently',()=>{
 const courses=[course(1,'C',{scoreScope:'current-period',overallGrade:'A',gradingPeriodTitle:'Term 1'})];
 near(model().calculate(courses).unweighted.scale4,4);
 near(model().calculate(courses,{scope:'current-period'}).unweighted.scale4,2);
});
test('different counted current periods are disclosed, not labelled as one period',()=>{
 const courses=[course(1,'A',{scoreScope:'current-period',gradingPeriodTitle:'Fall',gradingPeriodId:'a'}),course(2,'B',{scoreScope:'current-period',gradingPeriodTitle:'Spring',gradingPeriodId:'b'})];
 const result=model().calculate(courses,{scope:'current-period'});
 assert.equal(result.mixedPeriods,true);assert.deepEqual(result.periods,['Fall','Spring']);
 assert.equal(model().calculate(courses).mixedPeriods,false);
 courses[1].gradingPeriodTitle='Fall';assert.equal(model().calculate(courses,{scope:'current-period'}).mixedPeriods,false);
});
test('non-academic and unselected courses start excluded; no course-name level inference',()=>{
 const result=model().calculate([course(1,'A',{academic:false}),course(2,'B',{selected:false}),course(3,'A',{name:'AP Honors Biology'})],{weighted:true});
 assert.equal(result.countedCourses,1);near(result.weighted.scale4,4);
 assert.equal(result.exclusions['non-academic'],1);assert.equal(result.exclusions.unselected,1);
 const explicit=model().calculate([course(1,'A',{academic:false})],{courses:{'1':{included:true}}});assert.equal(explicit.countedCourses,1);
});
test('explicit exclusions and zero credits are counted separately and never divide by zero',()=>{
 const result=model().calculate([course(1,'A'),course(2,'B')],{courses:{'1':{included:false},'2':{credits:0}}});
 assert.equal(result.totalCredits,0);assert.equal(result.countedCourses,0);
 assert.equal(result.exclusions.excluded,1);assert.equal(result.exclusions['zero-credits'],1);
 assert.equal(result.unweighted.scale4,null);assert.equal(result.unweighted.scale43,null);
 const empty=model().calculate([],{weighted:true});assert.equal(empty.weighted.scale4,null);
});
test('F receives no level bonus unless explicitly enabled',()=>{
 const prefs=model().defaults();prefs.weighted=true;prefs.courses['1']={level:'ap'};
 near(model().calculate([course(1,'F')],prefs).weighted.scale4,0);
 prefs.bonusOnFail=true;near(model().calculate([course(1,'F')],prefs).weighted.scale4,1);
});
test('custom bonuses, editable presets, and optional per-course weighted cap work',()=>{
 const prefs=model().defaults();prefs.weighted=true;prefs.presets.honors=0.7;
 prefs.courses={'1':{credits:2,level:'honors'},'2':{credits:1,level:'custom',bonus:2}};
 let result=model().calculate([course(1,'A'),course(2,'A+')],prefs);
 near(result.weighted.scale4,(4.7*2+6)/3);near(result.weighted.scale43,(4.7*2+6.3)/3);
 prefs.weightedCap=5;result=model().calculate([course(1,'A'),course(2,'A+')],prefs);
 near(result.weighted.scale4,(4.7*2+5)/3);near(result.unweighted.scale43,(4*2+4.3)/3);
});
test('custom thresholds and point tables affect results while preserving fractional precision',()=>{
 const prefs=model().defaults();prefs.rules[0].min=98;prefs.rules[1].min=94;prefs.rules[1].points4=3.9;prefs.rules[1].points43=4.1;
 const result=model().calculate([course(1,null,{overallScore:94})],prefs);
 assert.equal(result.customRules,true);near(result.unweighted.scale4,3.9);near(result.unweighted.scale43,4.1);
 assert.equal(model().calculate([course(1,null,{overallScore:93.999})],prefs).rows[0].letter,'A-');
});
test('defaults and normalized preferences are independent copies and contain only supported fields',()=>{
 const g=model(),a=g.defaults(),b=g.defaults();a.rules[0].min=100;a.presets.honors=3;
 assert.equal(b.rules[0].min,97);assert.equal(b.presets.honors,0.5);
 const input={weighted:true,unused:'discard',courses:{'1':{credits:'2.5',level:'custom',bonus:'0.25',override:'b+',unknown:77}}};
 const prefs=g.cleanPreferences(input);assert.equal(prefs.courses['1'].credits,2.5);assert.equal(prefs.courses['1'].override,'B+');
 assert.equal('unused' in prefs,false);assert.equal('unknown' in prefs.courses['1'],false);
 assert.deepEqual(input.courses['1'].credits,'2.5');assert.deepEqual(g.cleanPreferences(undefined),b);
});
test('invalid preferences reject rather than silently replacing saved good rules',()=>{
 const g=model(),good=g.defaults(),before=JSON.stringify(good);
 for(const input of [{scope:'latest'},{weighted:'yes'},{weightedCap:3},{weightedCap:11},{weightedCap:''},{presets:{honors:6}},{courses:{'1':{credits:31}}},{courses:{'1':{credits:''}}},{courses:{'1':{credits:-1}}},{courses:{'1':{bonus:6}}},{courses:{'1':{override:'P'}}},{courses:{'1':{included:'false'}}},{courses:{'1':{level:'auto'}}},[],false])assert.throws(()=>g.cleanPreferences(input));
 assert.equal(JSON.stringify(good),before);
});
test('conversion table must have all fixed letters, descending unique cutoffs, and a zero floor',()=>{
 const g=model();
 for(const mutate of [p=>p.rules.pop(),p=>p.rules[0].min=93,p=>p.rules[2].min=99,p=>p.rules.at(-1).min=1,p=>p.rules[0].min='',p=>p.rules[0].points4=-1,p=>p.rules[0].points43=11,p=>p.rules[0].letter='Z']){
  const prefs=g.defaults();mutate(prefs);assert.throws(()=>g.cleanPreferences(prefs));
 }
});
test('malformed identifiers, prototype keys and duplicate records cannot corrupt or double-count',()=>{
 const g=model();assert.throws(()=>g.cleanPreferences(JSON.parse('{"courses":{"__proto__":{"credits":2}}}')));
 const result=g.calculate([null,{name:'No ID',grade:'A'},course(1,'A'),course(1,'F')]);
 assert.equal(result.countedCourses,1);near(result.unweighted.scale4,4);assert.equal({}.credits,undefined);
});
test('calculation never mutates the supplied records or preferences',()=>{
 const courses=[course(1,'A')],prefs=model().defaults(),before=JSON.stringify({courses,prefs});
 model().calculate(courses,prefs);assert.equal(JSON.stringify({courses,prefs}),before);
});
test('opaque identifiers matching inherited property names remain ordinary courses',()=>{
 for(const id of ['toString','valueOf','hasOwnProperty']){
  const result=model().calculate([course(id,'A')]);assert.equal(result.countedCourses,1,id);near(result.unweighted.scale4,4);
 }
});

// A small event-capable DOM double tests privacy, edits and lifecycle without
// launching a browser. It deliberately refuses HTML rendering.
class Node {
 constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.parentNode=null;this.dataset={};this.attributes={};this.listeners=new Map();this._text='';this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.open=false;this.scrollTop=0;this.selectionStart=0;this.selectionEnd=0;}
 set textContent(value){this._text=String(value);this.children.forEach(c=>c.parentNode=null);this.children=[];}
 get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
 set innerHTML(_){throw Error('HTML rendering is not allowed');}
 append(...items){for(const item of items){const node=typeof item==='string'?this.ownerDocument.createTextNode(item):item;node.parentNode=this;this.children.push(node);}}
 replaceChildren(...items){this.textContent='';this.append(...items);}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}
 setAttribute(key,value){this.attributes[key]=String(value);if(key==='id')this.id=String(value);}
 getAttribute(key){return this.attributes[key]??null;}
 removeAttribute(key){delete this.attributes[key];}
 addEventListener(type,fn){const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list);}
 removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(f=>f!==fn));}
 contains(node){return this===node||this.children.some(c=>c.contains(node));}
 get isConnected(){return !!this.ownerDocument.root?.contains(this);}
 focus(){this.ownerDocument.activeElement=this;}
 setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;}
 closest(selector){for(let node=this;node;node=node.parentNode){if(selector==='[data-gpa-action]'&&node.dataset.gpaAction)return node;}return null;}
 dispatch(type){const event={type,target:this,preventDefault(){this.defaultPrevented=true;}};for(let node=this;node;node=node.parentNode)for(const fn of [...(node.listeners.get(type)||[])])fn(event);}
}
const walk=node=>[node,...node.children.flatMap(walk)];
const settle=async()=>{await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));};
function uiFixture(options={}){
 const doc={activeElement:null,createElement(tag){return new Node(tag,this);},createTextNode(text){const node=new Node('#text',this);node.textContent=text;return node;}};
 const container=doc.createElement('section'),listeners=new Set();doc.root=container;
 const fixture={ctx:{s:{showGrades:false},courses:[course(1,'A')],...options.ctx},writes:0,failSave:false,failRead:false};
 fixture.data={gpa:model().defaults(),settings:{showGrades:false},customTasks:[{id:'keep'}],...options.data};
 fixture.store={owner:{origin:'https://school.instructure.com',accountId:'one'},get(){if(fixture.failRead)throw Error('Storage read unavailable');return structuredClone(fixture.data);},subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);},async update(fn){if(fixture.failSave)throw Error('Save failed');const next=structuredClone(fixture.data);fn(next);fixture.writes++;fixture.data=next;listeners.forEach(fn=>fn());return structuredClone(next);}};
 fixture.container=container;fixture.doc=doc;fixture.listeners=listeners;
 fixture.create=()=>require('../extension/gpa-ui.js').create({container,store:fixture.store,getContext:()=>fixture.ctx,onRefresh:options.onRefresh?()=>options.onRefresh(fixture):undefined});
 fixture.ui=fixture.create();
 fixture.control=key=>walk(container).find(n=>n.dataset.gpaControl===key);
 fixture.action=key=>walk(container).find(n=>n.dataset.gpaAction===key);
 fixture.click=async key=>{const node=fixture.action(key);assert.ok(node,'action '+key);assert.equal(node.disabled,false,'enabled '+key);node.dispatch('click');await settle();};
 fixture.change=async(key,value)=>{const node=fixture.control(key);assert.ok(node,'control '+key);if(node.type==='checkbox')node.checked=value;else node.value=String(value);node.dispatch('change');await settle();};
 fixture.input=(key,value)=>{const node=fixture.control(key);assert.ok(node,'control '+key);node.value=String(value);node.focus();node.dispatch('input');return node;};
 return fixture;
}

test('UI privacy gate creates no grade/course values until an explicit local reveal',async()=>{
 const f=uiFixture({ctx:{s:{showGrades:false},courses:[course(1,'A',{name:'Private seminar',overallScore:96.237})]},data:{gpa:{courses:{'1':{override:'B',credits:2.71}}}}});
 assert.ok(f.container.textContent.includes('Show GPA here'));
 assert.equal(f.container.textContent.includes('Private seminar'),false);
 assert.equal(walk(f.container).some(n=>String(n.value).includes('2.71')),false);
 assert.equal(f.control('course:1:override'),undefined);
 await f.click('reveal');assert.ok(f.container.textContent.includes('Private seminar'));assert.ok(f.container.textContent.includes('What-if'));
 assert.equal(f.writes,0);assert.equal(f.data.settings.showGrades,false);
 f.ui.destroy();f.ui=f.create();assert.equal(f.control('course:1:override'),undefined);f.ui.destroy();
});
test('UI follows global grade privacy and removes previously rendered values when it is hidden',()=>{
 const f=uiFixture({ctx:{s:{showGrades:true},courses:[course(1,'B',{name:'Visible seminar'})]}});
 assert.ok(f.container.textContent.includes('Visible seminar'));
 f.ctx.s.showGrades=false;f.ui.update();assert.equal(f.container.textContent.includes('Visible seminar'),false);
 assert.equal(f.control('course:1:credits'),undefined);f.ui.destroy();
});
test('UI disclosure is reset when its account identity changes',async()=>{
 const f=uiFixture();await f.click('reveal');assert.ok(f.control('scope'));
 f.store.owner.accountId='two';f.ui.update();assert.equal(f.control('scope'),undefined);assert.ok(f.action('reveal'));f.ui.destroy();
});
test('UI credits, inclusion, level and what-if edits persist through only the account GPA preferences',async()=>{
 const f=uiFixture({ctx:{s:{showGrades:true},courses:[course(1,'A'),course(2,'P')]}});
 await f.change('course:1:credits','2');await f.change('weighted',true);await f.change('course:1:level','ap');
 await f.change('course:2:override','B');
 assert.equal(f.data.gpa.courses['1'].credits,2);assert.equal(f.data.gpa.courses['1'].level,'ap');
 assert.equal(f.data.gpa.courses['2'].override,'B');assert.equal(f.data.gpa.courses['2'].included,true);
 assert.deepEqual(f.data.customTasks,[{id:'keep'}]);assert.equal(f.data.settings.showGrades,false);
 near(model().calculate(f.ctx.courses,f.data.gpa).weighted.scale4,13/3);
 await f.change('course:1:included',false);assert.equal(f.data.gpa.courses['1'].included,false);f.ui.destroy();
});
test('UI rejects blank or out-of-range credits and keeps the last saved valid preferences',async()=>{
 const f=uiFixture({ctx:{s:{showGrades:true}}});const saved=JSON.stringify(f.data.gpa);
 await f.change('course:1:credits','');assert.equal(f.writes,0);assert.equal(JSON.stringify(f.data.gpa),saved);
 assert.match(f.container.textContent,/credits.*number/i);
 await f.change('course:1:credits','31');assert.equal(f.writes,0);
 await f.change('course:1:credits','0.5');assert.equal(f.data.gpa.courses['1'].credits,0.5);f.ui.destroy();
});
test('UI rule drafts survive updates and invalid rules cannot replace the saved conversion table',async()=>{
 const f=uiFixture({ctx:{s:{showGrades:true}}});const before=JSON.stringify(f.data.gpa);
 f.input('rule:0:min','93');f.ui.update();assert.equal(f.control('rule:0:min').value,'93');
 await f.click('apply-rules');assert.equal(JSON.stringify(f.data.gpa),before);assert.match(f.container.textContent,/decrease|duplicate/i);
 f.input('rule:0:min','96');await f.click('apply-rules');assert.equal(f.data.gpa.rules[0].min,96);f.ui.destroy();
});
test('UI preserves a focused, uncommitted input across parent updates',()=>{
 const f=uiFixture({ctx:{s:{showGrades:true}}}),input=f.input('course:1:credits','2.75');
 input.selectionStart=1;input.selectionEnd=3;f.ui.update();
 assert.ok(f.doc.activeElement===f.control('course:1:credits'),'focus remains on the edited credits control');assert.equal(f.control('course:1:credits').value,'2.75');
 assert.equal(f.writes,0);assert.equal(f.data.gpa.courses['1'],undefined);f.ui.destroy();
});
test('UI restores input focus after an asynchronous save and store notification',async()=>{
 const f=uiFixture({ctx:{s:{showGrades:true}}});f.control('course:1:credits').focus();
 await f.change('course:1:credits','2.5');assert.ok(f.doc.activeElement===f.control('course:1:credits'),'save restores the live credits control');assert.equal(f.doc.activeElement.value,'2.5');f.ui.destroy();
});

test('UI preserves focus inside a shadow root without pulling focus from another tool',()=>{
 const f=uiFixture({ctx:{s:{showGrades:true}}}),input=f.input('course:1:credits','2.75');
 const host=f.doc.createElement('div'),shadow={host,activeElement:input};
 f.doc.activeElement=host;f.container.getRootNode=()=>shadow;
 f.ui.update();assert.equal(f.doc.activeElement,f.control('course:1:credits'));
 assert.equal(f.control('course:1:credits').value,'2.75');
 const elsewhere=f.doc.createElement('button');shadow.activeElement=elsewhere;f.doc.activeElement=host;
 f.ui.update();assert.equal(f.doc.activeElement,host,'another shadow-root control keeps focus');f.ui.destroy();
});
test('UI can edit an opaque course identifier without touching inherited properties',async()=>{
 const f=uiFixture({ctx:{s:{showGrades:true},courses:[course('toString','A')]}});
 await f.change('course:toString:credits','2');assert.equal(f.data.gpa.courses.toString.credits,2);
 assert.equal(Object.prototype.toString.credits,undefined);f.ui.destroy();
});
test('UI save errors keep the previous results and expose the actual error',async()=>{
 const f=uiFixture({ctx:{s:{showGrades:true}}});f.failSave=true;
 await f.change('weighted',true);assert.equal(f.data.gpa.weighted,false);assert.match(f.container.textContent,/Save failed/);
 assert.equal(f.control('weighted').checked,false);f.ui.destroy();
});
test('UI reset changes only calculator preferences and local reveal is not persisted',async()=>{
 const f=uiFixture({data:{gpa:{weighted:true,courses:{'1':{override:'B',credits:2}}}}});
 await f.click('reveal');await f.click('reset');assert.deepEqual(f.data.gpa,model().defaults());
 assert.deepEqual(f.data.customTasks,[{id:'keep'}]);assert.equal(f.data.settings.showGrades,false);assert.ok(f.control('scope'));f.ui.destroy();
});
test('UI refresh exposes busy state, observes refreshed context, and handles callback errors',async()=>{
 let finish;const f=uiFixture({ctx:{s:{showGrades:true}},onRefresh:async fx=>{await new Promise(resolve=>finish=resolve);fx.ctx.courses=[course(2,'B',{name:'Refreshed course'})];}});
 f.action('refresh').dispatch('click');assert.equal(f.action('refresh').disabled,true);
 finish();await settle();assert.equal(f.action('refresh').disabled,false);assert.ok(f.container.textContent.includes('Refreshed course'));f.ui.destroy();
 const broken=uiFixture({ctx:{s:{showGrades:true}},onRefresh:()=>Promise.reject(Error('Canvas refresh failed'))});
 await broken.click('refresh');assert.match(broken.container.textContent,/Canvas refresh failed/);broken.ui.destroy();
 const absent=uiFixture({ctx:{s:{showGrades:true}}});await absent.click('refresh');assert.match(absent.container.textContent,/Refresh Canvas to update grades/);absent.ui.destroy();
});
test('UI does not show a zero GPA for an empty set, and hidden raw grades never enter controls',()=>{
 const f=uiFixture({ctx:{s:{showGrades:true},courses:[course(1,'SECRET-GRADE',{hideFinalGrades:true,overallScore:98.7654})]}});
 assert.match(f.container.textContent,/No courses|No eligible|Nothing to calculate/i);
 assert.equal(f.container.textContent.includes('SECRET-GRADE'),false);assert.equal(f.container.textContent.includes('98.7654'),false);
 assert.equal(f.control('course:1:override').disabled,true);f.ui.destroy();
});
test('UI uses actual scope and labels what-if edits without changing a Canvas grade',async()=>{
 const f=uiFixture({ctx:{s:{showGrades:true},courses:[course(1,'B',{scoreScope:'current-period',overallGrade:'A',gradingPeriodTitle:'Spring'})]}});
 await f.change('scope','current-period');assert.equal(f.data.gpa.scope,'current-period');assert.ok(f.container.textContent.includes('Spring'));
 await f.change('course:1:override','A+');assert.equal(f.ctx.courses[0].grade,'B');assert.match(f.container.textContent,/What-if/);f.ui.destroy();
});
test('UI renders untrusted course names as literal text and releases listeners on destroy',()=>{
 const f=uiFixture({ctx:{s:{showGrades:true},courses:[course(1,'A',{name:'<img src=x onerror=alert(1)>'})]}});
 assert.ok(f.container.textContent.includes('<img src=x onerror=alert(1)>'));assert.equal(walk(f.container).some(n=>n.tagName==='IMG'),false);
 f.ui.destroy();assert.equal(f.container.textContent,'');assert.equal(f.listeners.size,0);f.ui.update();assert.equal(f.container.textContent,'');
});
