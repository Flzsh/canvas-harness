/* Authored source only. Parent owns RED/proposed execution after official CV.
   No fixture, label, validation, sealed data, fitted pack or network input. */
'use strict';
const nodeTest=require('node:test'),cases=[],test=(name,fn)=>cases.push([name,fn]);
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..'),EXT=path.join(ROOT,'extension');
const VARIANT='actual';
assert.ok(['before','proposed','actual'].includes(VARIANT));
const overlay=new Set(['biscuit-language.js','biscuit-engine.js']);
const plain=value=>JSON.parse(JSON.stringify(value));
const runtimes=new Map();
function runtime(variant){
 if(runtimes.has(variant))return runtimes.get(variant);
 const cache=new Map(),context=vm.createContext({console,URL,URLSearchParams,TextEncoder,TextDecoder,structuredClone,performance,setTimeout,clearTimeout});
 function load(request,parent=path.join(EXT,'entry.js')){
  if(request.startsWith('node:'))return require(request);
  const resolved=path.resolve(path.dirname(parent),request);
  assert.ok(resolved.startsWith(EXT+path.sep),'Extension dependencies only');
  assert.ok(/\.(?:js|json)$/.test(resolved),'Explicit extension dependency');
  if(cache.has(resolved))return cache.get(resolved).exports;
  if(resolved.endsWith('.json')){
   assert.equal(resolved,path.join(EXT,'biscuit-rules','school-language.json'),'No model or fixture JSON');
   const module={exports:JSON.parse(fs.readFileSync(resolved,'utf8'))};cache.set(resolved,module);return module.exports;
  }
  const source=resolved;
  const module={exports:{}};cache.set(resolved,module);
  const wrapper=vm.runInContext('(function(module,exports,require,__filename,__dirname){\n'+fs.readFileSync(source,'utf8')+'\n})',context,{filename:source});
  wrapper(module,module.exports,child=>load(child,resolved),source,path.dirname(source));return module.exports;
 }
 const result={language:load('./biscuit-language.js'),engine:load('./biscuit-engine.js'),rules:load('./biscuit-rules.js')};runtimes.set(variant,result);return result;
}
// A transparent fixed pack deliberately favors generic assignment rows. It is
// synthetic, not fitted, and gives active/course scope a genuine counterfactual.
function tinyPack(){return {
 schemaVersion:1,tier:'basic',features:{charMax:0,learnedContext:false},patterns:[],thresholds:{context:.5},
 models:{
  action:{labels:['open/find','none'],scale:1,weights:{bias:[8,0],'w:homework':[2,0]}},
  item:{labels:['yes'],scale:1,weights:{bias:[0],'kind:assignment':[1],'lang:preferred':[2],'lang:active':[1]}},
  kind:{labels:['ask'],scale:1,weights:{bias:[0]}},
  context:{labels:['yes'],scale:1,weights:{bias:[-8]}}
 }
};}
const aliases=['zora','velin','mavro','tulip','neska','pavo','lumen','sorel','quint','darvo','wexel','falin','kesto','rynth'];
const names=['Amber','Cobalt','Indigo','Violet','Ochre','Silver','Copper','Maroon','Ivory','Sienna','Umber','Azure','Crimson','Coral'];
const codes=['KRVQ','BNDX','FSZP','GQMT','HXBW','JPTC','LVZG','MFRK','NWSJ','PXDL','QGHB','RZVN','SXFK','TQPR'];
function world(){
 const courses=aliases.map((nickname,i)=>({id:'synth-course-'+i,name:'Workshop '+names[i],nickname,shortName:codes[i],course_code:codes[i]}));
 const workItems=courses.flatMap((course,i)=>[
  {id:'synth-hw-'+i,courseId:course.id,title:'Shared Homework',workKind:'homework',genre:'hw',description:'A neutral practice prompt; unrelated alias zora may appear in prose.',dueAt:1894147200000+i*3600000},
  {id:'synth-quiz-'+i,courseId:course.id,title:'Shared Quiz',workKind:'quiz',description:'A neutral review prompt.'}
 ]);
 const files=courses.flatMap((course,i)=>[
  {id:'synth-file-'+i,courseId:course.id,title:'Shared Packet.pdf',text:'Neutral packet.'},
  {id:'synth-other-file-'+i,courseId:course.id,title:'Shared Worksheet.pdf',text:'Neutral worksheet.'}
 ]);
 return {now:1893456000000,timeZone:'UTC',view:'home',activeCourseId:courses[13].id,courses,workItems,files,
  settings:{showGrades:true},privacy:{grades:true},ai:true,teacherFeedback:true,notes:[],messages:[],pages:[],announcements:[]};
}
function request(rt,input,s=world()){
 assert.equal(typeof rt.language.courseAliasRequest,'function','new bounded resolver API must be present');
 return plain(rt.language.courseAliasRequest(input,s,rt.engine.prepare(s)));
}
function evaluate(rt,input,s=world(),session={},usePack=true,explicitPack=tinyPack()){
 const options=usePack?{pack:rt.rules.validate(explicitPack,'basic')}:{};
 return plain(rt.engine.create(options).evaluate(input,plain(s),plain(session)));
}
function target(result,courseId,itemId,exclusive=true){
 assert.ok(['find','open'].includes(result.action),JSON.stringify(result));
 assert.equal(result.next.fields.courseId,courseId);assert.equal(result.next.fields.itemId,itemId);
 assert.equal(result.items[0].courseId,courseId);assert.equal(result.items[0].id,itemId);
 assert.equal(result.route,'local');if(exclusive&&result.courseAlias)assert.ok(result.items.every(row=>row.courseId===courseId));
}
function abstain(result){assert.equal(result.action,'none',JSON.stringify(result));assert.deepEqual(result.items,[]);assert.ok(!result.next.fields.itemId);}
let rt;
test('independent world has 14 courses, repeated titles and multiple types in every course',()=>{
 const s=world();assert.equal(s.courses.length,14);assert.equal(new Set(s.workItems.map(v=>v.title)).size,2);
 assert.ok(s.courses.every(c=>s.workItems.filter(v=>v.courseId===c.id).length===2));
});
for(const [i,alias]of aliases.entries()){
 const variants={extra:alias+'h',deletion:alias.slice(0,-1),transposition:alias[1]+alias[0]+alias.slice(2),substitution:alias.slice(0,-1)+'j'};
 for(const [operation,typo]of Object.entries(variants))test(operation+' of invented alias '+alias+' scopes inactive homework',()=>{
  const s=world();s.activeCourseId=s.courses[(i+5)%14].id;
  const q=request(rt,typo+' hw',s);assert.ok(['typo','relationship'].includes(q.status));assert.equal(q.courseId,s.courses[i].id);
  target(evaluate(rt,typo+' hw',s),s.courses[i].id,'synth-hw-'+i,q.status!=='relationship');
 });
}
test('loaded two-letter nickname can recover an extra letter; one-letter guesses cannot',()=>{
 const s=world();s.courses[0].nickname='qx';
 assert.equal(request(rt,'qxh hw',s).courseId,s.courses[0].id);
 assert.equal(request(rt,'q hw',s).status,'unknown');
 target(evaluate(rt,'qxh hw',s),s.courses[0].id,'synth-hw-0');
});
test('loaded code and whole single-token course name are eligible, not subject dictionary entries',()=>{
 const s=world();s.courses[0].name='Verdant';
 assert.equal(request(rt,'krv homework',s).courseId,s.courses[0].id);
 assert.equal(request(rt,'verdnat homework',s).courseId,s.courses[0].id);
 s.courses[0].subject='crypta';assert.equal(request(rt,'cryptx homework',s).status,'unknown');
 s.courses[0].name='Observatory Workshop';assert.equal(request(rt,'observ homework',s).status,'relationship');
});
test('exact whole loaded name scopes work and unrelated phrases remain unsupported',()=>{
 const s=world();target(evaluate(rt,'open Workshop Amber homework',s),s.courses[0].id,'synth-hw-0');
 assert.equal(request(rt,'unrelatedalphabet homework',s).status,'unknown');
});
test('exact loaded valid alias wins over several one-edit aliases',()=>{
 const s=world();s.courses[1].nickname='zori';s.courses[7].nickname='zorx';
 const q=request(rt,'zorx hw',s);assert.equal(q.status,'exact');assert.equal(q.courseId,s.courses[7].id);
 target(evaluate(rt,'zorx hw',s),s.courses[7].id,'synth-hw-7');
});
test('counterfactual tied nearest courses abstain regardless of active/recent/row order',()=>{
 for(const active of [0,1,13])for(const reverse of [false,true]){
  const s=world();s.courses[1].nickname='zori';s.activeCourseId=s.courses[active].id;
  const session={lastCourseId:s.courses[0].id,lastItemId:'synth-hw-0',items:[{id:'synth-hw-0'}]};
  if(reverse){s.courses.reverse();s.workItems.reverse();}
  const q=request(rt,'zorx homework',s);assert.equal(q.status,'ambiguous');assert.equal(q.courseIds.length,2);
  abstain(evaluate(rt,'zorx homework',s,session));
 }
});
test('course alias ambiguity cannot be decided by a lone loaded file',()=>{
 const s=world();s.courses[1].nickname='zori';s.files=s.files.filter(v=>v.id==='synth-file-0');
 abstain(evaluate(rt,'zorx file',s));
});
test('duplicate exact alias across courses also abstains',()=>{
 const s=world();s.courses[1].nickname='zora';assert.equal(request(rt,'zora hw',s).status,'ambiguous');abstain(evaluate(rt,'zora hw',s));
});
test('multiple nearby aliases owned by the same course are one course, not a false tie',()=>{
 const s=world();s.courses[0].aliases=['zori'];assert.equal(request(rt,'zorx hw',s).status,'typo');
 target(evaluate(rt,'zorx hw',s),s.courses[0].id,'synth-hw-0');
});
test('loaded metadata removal and movement change the target, without reading work titles',()=>{
 const s=world();s.courses[0].nickname='unrelated';assert.equal(request(rt,'zorx hw',s).status,'unknown');abstain(evaluate(rt,'zorx hw',s));
 s.courses[8].nickname='zora';target(evaluate(rt,'zorx hw',s),s.courses[8].id,'synth-hw-8');
});
test('fresh snapshot and same-object metadata edits do not retain an old alias universe',()=>{
 const s=world();assert.equal(request(rt,'zorx hw',s).courseId,s.courses[0].id);
 s.courses[0].nickname='unrelated';s.courses[4].nickname='zora';
 assert.equal(request(rt,'zorx hw',s).courseId,s.courses[4].id);
});
test('unknown alias never falls back to active course',()=>{
 for(const line of ['glxzz hw','blorf homework','zorzz homework']){assert.equal(request(rt,line).status,'unknown');abstain(evaluate(rt,line));}
});
test('digits and other scripts are exact-only, with no edit, accent folding or transliteration guess',()=>{
 const s=world();for(const alias of ['zor4','z\u043era','z\u03bfra','z\u00f3ra']){
  assert.equal(request(rt,alias+' hw',s).status,'unknown');abstain(evaluate(rt,alias+' hw',s));
 }
 s.courses[0].course_code='Q42';assert.equal(request(rt,'Q42 hw',s).status,'exact');
 target(evaluate(rt,'Q42 hw',s),s.courses[0].id,'synth-hw-0');
 assert.equal(request(rt,'Q43 hw',s).status,'unknown');
});
test('work/source noun is required and no noun or verb is itself repaired',()=>{
 for(const line of ['zorx','open zorx','zorx thing','zorx homwork','zorx fiels'])assert.equal(request(rt,line),null);
});
test('supported retrieval wrappers, noun-first shape and packaged work abbreviation',()=>{
 for(const line of ['zorx hw','open zorx homework','please show me the zorx homework','homework for zorx','read zorx homework please']){
  target(evaluate(rt,line),world().courses[0].id,'synth-hw-0');
 }
});
test('file retrieval requires a resolved course and abstains on multiple same-course files',()=>{
 const s=world();abstain(evaluate(rt,'zorx file',s));
 s.files=s.files.filter(v=>v.id!=='synth-other-file-0');target(evaluate(rt,'zorx file',s),s.courses[0].id,'synth-file-0');
 s.files=s.files.filter(v=>v.courseId!==s.courses[0].id);abstain(evaluate(rt,'zorx file',s));
});
test('several homework rows do not acquire an arbitrary preferred item',()=>{
 const s=world();s.workItems.push({...s.workItems[0],id:'synth-extra-hw',title:'Another Homework'});abstain(evaluate(rt,'zorx hw',s));
});
// 4.0: the 4.0 design replaces the 3.x behaviour this case pinned (see the ported 4.0 tests for the new behaviour).
test('an abstaining homework question still offers that course\'s matches to tap',()=>{
 const s=world();s.workItems.push({...s.workItems[0],id:'synth-extra-hw',title:'Another Homework'});const r=evaluate(rt,'zorx hw',s);abstain(r);
 assert.equal(r.clarify,true);assert.deepEqual(r.choices.map(row=>row.id).sort(),['synth-extra-hw','synth-hw-0']);assert.ok(r.choices.every(row=>row.courseId===s.courses[0].id));
});
test('work subtype metadata has precedence over misleading title nouns',()=>{
 const s=world();s.workItems[0].title='Misleading Homework';s.workItems[0].workKind='project';
 abstain(evaluate(rt,'zorx hw',s));target(evaluate(rt,'zorx project',s),s.courses[0].id,'synth-hw-0');
});
test('rules-only actual Engine path also respects unique scope and ambiguity',()=>{
 const s=world();target(evaluate(rt,'zorx hw',s,{},false),s.courses[0].id,'synth-hw-0');
 s.courses[1].nickname='zori';abstain(evaluate(rt,'zorx hw',s,{},false));
});
const untouched=[
 'note: zorx hw; keep this exact sentence',
 'write down zorx hw',
 'draft a message saying "zorx hw"',
 'reply with "zorx homework"',
 'open "zorx hw"',
 'open \u201czorx homework\u201d',
 'do not open zorx homework',
 'never open zorx homework',
 'not zorx homework',
 'open velin homework, not zorx',
 'open velin homework rather than zorx',
 'open velin homework except zorx',
 'open velin homework without zorx',
 'open this assignment',
 'open that assignment',
 'open second result',
 'open the actual attachment from that message',
 'read the original announcement',
 'explain zorx homework',
 'steps zorx homework'
];
// 4.0: with Your AI, "draft a message ..." and "explain ..." lines go to AI with the loaded course instead of staying local.
for(const line of untouched.filter(line=>!/^(?:draft a message saying|explain) "?zorx/.test(line)))test('guard/reference path stays outside loaded-course typo repair: '+line,()=>{
 const s=world(),session={lastItemId:'missing-synthetic-id',items:[{id:'also-missing'}]};
 assert.equal(request(rt,line,s),null);
 const original=plain({s,session}),result=evaluate(rt,line,s,session);assert.equal(result.route,'local');assert.ok(!result.courseAlias);assert.deepEqual(plain({s,session}),original);
});
test('literal note payload bytes survive actual Engine unchanged',()=>{
 const text='zorx hw; do NOT change "zora" / Q42';const result=evaluate(rt,'note: '+text);
 assert.equal(result.action,'note');assert.equal(result.next.fields.text,text);
});
test('exact named actual-source title keeps its existing reference owner',()=>{
 const s=world();s.workItems[2].title='Zorx Homework';s.workItems[2].workKind='project';
 target(evaluate(rt,'open zorx homework',s),s.workItems[2].courseId,s.workItems[2].id,false);
});
test('stale selected/prior IDs and unrelated active work cannot fill a missing scoped item',()=>{
 const s=world(),courseId=s.courses[0].id;s.workItems=s.workItems.filter(v=>v.courseId!==courseId);
 s.selectedItemId='synth-hw-0';abstain(evaluate(rt,'zorx hw',s,{lastItemId:'synth-hw-0',lastCourseId:courseId}));
});
test('existing grade-access admission guard is still applied to scoped rows',()=>{
 const s=world();s.privacy.grades=false;s.settings.showGrades=false;
 s.workItems[0].gradeAccess=true;s.workItems[0].description='SECRET_PRIVATE_OWN_SOURCE';
 const result=evaluate(rt,'zorx hw',s);abstain(result);assert.ok(!JSON.stringify(result).includes('SECRET_PRIVATE_OWN_SOURCE'));
});
test('feedback privacy sanitization survives course recovery',()=>{
 const s=world();s.teacherFeedback=false;s.privacy.feedback=false;s.workItems[0].feedback='SECRET_FEEDBACK_OWN_SOURCE';
 const result=evaluate(rt,'zorx hw',s);target(result,s.courses[0].id,'synth-hw-0');
 assert.ok(!JSON.stringify(result).includes('SECRET_FEEDBACK_OWN_SOURCE'));
});
test('input snapshot, session, loaded aliases and literal strings are not mutated',()=>{
 const s=world(),session={lastItemId:'synth-hw-13'},snapshot=JSON.stringify(s),memory=JSON.stringify(session);
 request(rt,'zorx hw',s);rt.engine.create({pack:tinyPack()}).evaluate('zorx hw',s,session);
 assert.equal(JSON.stringify(s),snapshot);assert.equal(JSON.stringify(session),memory);
});

test('public resolver results do not expose mutable noun templates',()=>{
 const first=rt.language.courseAliasRequest('zorx hw',world());first.kinds.push('file');first.work.push('project');
 const second=request(rt,'zorx hw');assert.deepEqual(second.kinds,['assignment']);assert.deepEqual(second.work,['homework']);
});

test('an exact loaded code wins over nearby nicknames from other courses',()=>{
 const s=world();s.courses[1].nickname='zori';s.courses[7].course_code='ZORX';
 const q=request(rt,'zorx hw',s);assert.equal(q.status,'exact');assert.equal(q.courseId,s.courses[7].id);
 target(evaluate(rt,'zorx hw',s),s.courses[7].id,'synth-hw-7');
});
test('an explicitly requested loaded inactive course is not replaced by the active course',()=>{
 const s=world();s.courses[0].active=false;s.courses[0].archived=true;
 target(evaluate(rt,'zorx hw',s),s.courses[0].id,'synth-hw-0');
});

// Compatibility worlds use no nickname or shortName on any of 14 courses.
// These are independent authored assertions, not runtime fixture labels.
function relationshipWorld(){
 const s=world();for(const course of s.courses){delete course.nickname;delete course.nickName;delete course.shortName;delete course.aliases;}
 s.courses[0].name='AP Calculus BC';s.courses[0].course_code='MATH BC';
 s.courses[1].name='Research Biology';s.courses[1].course_code='RBL QX';s.courses[1].topics=['osmosis'];
 s.workItems.push({id:'synth-topic-lab',courseId:s.courses[1].id,title:'Cell membrane lab',workKind:'lab',description:'Track osmosis across selectively permeable membranes.'});
 return s;
}
function relationshipPack(){
 const pack=tinyPack();pack.models.item.weights={bias:[0],title:[5],body:[6],'kind:assignment':[1],'lang:preferred':[2],'lang:name':[4],'lang:abbreviation':[4],'lang:subject':[4],'lang:topic':[4]};return pack;
}
function existingOwnerTarget(line,s,courseId,itemId){
 const result=evaluate(rt,line,s,{},true,relationshipPack());target(result,courseId,itemId,false);
 assert.ok(!result.courseAlias,'existing owner handoff, not new deterministic course selection');
}
test('14-course no-nickname world preserves calc hw for AP Calculus BC / MATH BC',()=>{
 const s=relationshipWorld();assert.equal(s.courses.length,14);assert.ok(s.courses.every(course=>!course.nickname&&!course.shortName));
 assert.ok(!['name','course_code','code'].some(field=>s.courses[0][field]?.toLowerCase()==='calc'));
 const q=request(rt,'calc hw',s);assert.equal(q.status,'relationship');assert.equal(q.courseId,s.courses[0].id);
 assert.ok(q.relationshipEvidence.some(proof=>['derived-alias','subject'].includes(proof.kind)));
 existingOwnerTarget('calc hw',s,s.courses[0].id,'synth-hw-0');
});
test('unique derived calc alias precedes a near raw alias owned by another course',()=>{
 const s=relationshipWorld();s.courses[7].nickname='calx';assert.equal(request(rt,'calc hw',s).status,'relationship');
 existingOwnerTarget('calc hw',s,s.courses[0].id,'synth-hw-0');
});
test('exact raw alias retains priority over an existing derived subject alias',()=>{
 const s=relationshipWorld();s.courses[7].nickname='calc';const q=request(rt,'calc hw',s);
 assert.equal(q.status,'exact');assert.equal(q.courseId,s.courses[7].id);target(evaluate(rt,'calc hw',s),s.courses[7].id,'synth-hw-7');
});
test('osmosis lab preserves the existing topic/work owner without inventing a course',()=>{
 const s=relationshipWorld();assert.ok(!s.courses.some(course=>course.name.toLowerCase()==='osmosis'));
 const q=request(rt,'osmosis lab',s);assert.equal(q.status,'relationship');assert.equal(q.courseId,s.courses[1].id);
 assert.ok(q.relationshipEvidence.some(proof=>proof.kind==='topic'));assert.ok(q.relationshipEvidence.some(proof=>proof.kind==='work'));
 existingOwnerTarget('osmosis lab',s,s.courses[1].id,'synth-topic-lab');
});
test('loaded work body alone can preserve an existing topic relation without course topics',()=>{
 const s=relationshipWorld();delete s.courses[1].topics;
 const q=request(rt,'osmosis lab',s);assert.equal(q.status,'relationship');assert.ok(q.relationshipEvidence.some(proof=>proof.kind==='work'));
 existingOwnerTarget('osmosis lab',s,s.courses[1].id,'synth-topic-lab');
});
test('a second unrelated lab in the same course does not erase a unique proven topic target',()=>{
 const s=relationshipWorld();s.workItems.push({id:'synth-different-lab',courseId:s.courses[1].id,title:'Generic lab',workKind:'lab',description:'A separate enzyme investigation.'});
 existingOwnerTarget('osmosis lab',s,s.courses[1].id,'synth-topic-lab');
});
test('derived-alias course collisions abstain without choosing the active or recent calculus course',()=>{
 for(const active of [0,2,13]){
  const s=relationshipWorld();s.courses[2].name='Honors Calculus';s.activeCourseId=s.courses[active].id;
  const q=request(rt,'calc hw',s);assert.equal(q.status,'ambiguous');assert.ok(q.courseIds.includes(s.courses[0].id));assert.ok(q.courseIds.includes(s.courses[2].id));
  abstain(evaluate(rt,'calc hw',s,{lastCourseId:s.courses[0].id,lastItemId:'synth-hw-0'}));
 }
});
test('topic course collisions abstain even if only one course has the requested lab',()=>{
 const s=relationshipWorld();s.courses[2].topics=['osmosis'];assert.equal(request(rt,'osmosis lab',s).status,'ambiguous');
 abstain(evaluate(rt,'osmosis lab',s));
});
test('two work-grounded topic courses abstain after removing all course topic fields',()=>{
 const s=relationshipWorld();delete s.courses[1].topics;s.workItems.push({id:'synth-other-topic-lab',courseId:s.courses[2].id,title:'Other lab',workKind:'lab',description:'Measure osmosis during the investigation.'});
 assert.equal(request(rt,'osmosis lab',s).status,'ambiguous');abstain(evaluate(rt,'osmosis lab',s));
});
test('two topic-proven lab targets in one course abstain rather than using row order',()=>{
 const s=relationshipWorld();s.workItems.push({id:'synth-duplicate-topic-lab',courseId:s.courses[1].id,title:'Another membrane lab',workKind:'lab',description:'Measure osmosis.'});
 for(const reverse of [false,true]){if(reverse)s.workItems.reverse();const r=evaluate(rt,'osmosis lab',s,{lastItemId:'synth-topic-lab'});assert.equal(r.action,'none');assert.ok(!r.next.fields.itemId);assert.deepEqual(r.items.map(row=>row.id).sort(),['synth-duplicate-topic-lab','synth-topic-lab']);}
});
test('a grounded course alias with two homework targets still abstains',()=>{
 const s=relationshipWorld();s.workItems.push({...s.workItems[0],id:'synth-second-calc-hw'});const r=evaluate(rt,'calc hw',s);assert.equal(r.action,'none');assert.ok(!r.next.fields.itemId);assert.deepEqual(r.items.map(row=>row.id).sort(),['synth-hw-0','synth-second-calc-hw']);
});
test('teacher fields, teacher-bearing name suffixes and body mentions do not supply relationship proof',()=>{
 const s=relationshipWorld();s.courses[1].teacher='Dr. Kelrex';s.courses[1].name='Research Biology - Dr. Kelrex';
 s.workItems.find(row=>row.id==='synth-topic-lab').description='Dr. Kelrex posted the procedure.';
 for(const line of ['kelrex lab','kel homework']){assert.equal(request(rt,line,s).status,'unknown');abstain(evaluate(rt,line,s));}
});
test('a lone file and a packaged topic association without loaded topic/work evidence cannot create course scope',()=>{
 const s=relationshipWorld();delete s.courses[1].topics;s.workItems=s.workItems.filter(row=>row.id!=='synth-topic-lab');
 s.files=[{id:'synth-lone-topic-file',courseId:s.courses[1].id,title:'Osmosis guide.pdf',text:'Study osmosis.'}];
 assert.equal(request(rt,'osmosis lab',s).status,'unknown');abstain(evaluate(rt,'osmosis lab',s));
});
test('the compatibility handoff does not admit nonsense or suppress a two-near-alias question',()=>{
 const s=relationshipWorld();assert.equal(request(rt,'glxzz hw',s).status,'unknown');abstain(evaluate(rt,'glxzz hw',s));
 s.courses[4].nickname='zora';s.courses[5].nickname='zori';assert.equal(request(rt,'zorx hw',s).status,'ambiguous');abstain(evaluate(rt,'zorx hw',s));
});
test('exact source-title priority remains ahead of a derived alias or topic handoff',()=>{
 const s=relationshipWorld();s.workItems[4].title='Osmosis Lab';s.workItems[4].workKind='project';
 target(evaluate(rt,'open osmosis lab',s,{},true,relationshipPack()),s.workItems[4].courseId,s.workItems[4].id,false);
});

test('a teacher-only name cannot generate a subject-like prefix relationship',()=>{
 const s=relationshipWorld();s.courses[1].name='Kelrex';s.courses[1].teacher='Dr. Kelrex';
 assert.equal(request(rt,'kel homework',s).status,'unknown');abstain(evaluate(rt,'kel homework',s));
});

test('a generic work noun in loaded work text does not become course proof',()=>{
 const s=relationshipWorld();s.workItems.find(row=>row.id==='synth-topic-lab').description='Discuss homework in this lab.';
 assert.equal(request(rt,'homework lab',s).status,'unknown');abstain(evaluate(rt,'homework lab',s));
});

test('workspace navigation wrappers retain their filter and destination owner',()=>{for(const line of ['Take me to unread messages.','go to assignments','jump to pages','bring me to files'])assert.equal(request(rt,line),null);});

test('generative cue words and typed two-noun phrases remain outside course typo repair',()=>{for(const line of ['fix zora essay','guide zora hw','outline zora essay','zora quiz practice','flashcards zora vocab'])assert.equal(request(rt,line),null,line);});
test('a linked scheduled representation is not a second coursework target',()=>{const s=world();s.planner=[{id:'synthetic-block',itemId:'synth-hw-0',courseId:s.courses[0].id,title:'Shared Homework',startAt:s.now+3600000,endAt:s.now+7200000}];const q=request(rt,'zorx hw',s),items=rt.language.courseAliasCandidates(q,rt.engine.prepare(s));assert.equal(items.length,1);assert.equal(items[0].id,'synth-hw-0');target(evaluate(rt,'zorx hw',s),s.courses[0].id,'synth-hw-0');});

test('a repeated loaded alias also asks for short exact-detail and Inbox readings',()=>{const s=world();s.courses[1].course_code='ZORA';for(const line of ['zora quiz points','zora quiz attempts','annc zora','inbox zora']){const r=evaluate(rt,line,s);abstain(r);assert.match(r.message,/\?/);}});

nodeTest('short loaded-course contracts in one disposable realm group',async t=>{rt=runtime(VARIANT);try{for(const [name,fn]of cases)await t.test(name,fn);}finally{runtimes.clear();rt=null;cases.length=0;}});
