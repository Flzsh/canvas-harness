'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'..');
const I=require(path.join(root,'extension/biscuit-intent.js')),W=require(path.join(root,'extension/biscuit-workflow.js')),C=require(path.join(root,'extension/biscuit-controls.js')),E=require(path.join(root,'extension/biscuit-engine.js'));
const NOW=Date.parse('2030-03-11T12:00:00Z'),state=extra=>({now:NOW,timeZone:'UTC',ai:true,courses:[],...extra}),parts=line=>I.workflowParts(line).map(v=>v.text),linear=label=>({labels:[label],weights:{bias:[1]},scale:1}),pack=action=>({tier:'basic',features:{charMax:0},patterns:[],models:{action:{...linear(action),weights:{bias:[1],'w:focus':[0],'w:break':[0],'w:timer':[0]}},item:linear('yes'),kind:linear('ask')}}),engine=()=>E.create({pack:pack('focus')});
function flat(r,actions){assert.equal(r.next.action,'batch');assert.deepEqual(r.requests.map(v=>v.action),actions);assert.ok(r.requests.every(v=>!v.requests&&v.next.action!=='batch'));assert.deepEqual(r.next.fields.steps.map(v=>({action:v.action,fields:v.fields})),r.requests.map(v=>({action:v.next.action,fields:v.next.fields})));}
function whole(line){assert.deepEqual(parts(line),[line],line);assert.equal(W.layout(line,state()).mode,'whole',line);}

test('finite nominal settings split in either order across explicit sequencing',()=>{
 for(const join of ['; ',' then ', ', then ', ' and then ', ' after that '])for(const [a,b] of [['dark mode','grades off'],['grades off','dark mode'],['density compact','motion still'],['motion off','compact density']])assert.deepEqual(parts(a+join+b),[a,b],a+join+b);
});
test('each setting owns its entire clause in a multiple-setting request',()=>{
 const line='dark mode; grades off; motion still; density compact';assert.deepEqual(parts(line),['dark mode','grades off','motion still','density compact']);
 const r=engine().evaluate(line,state());flat(r,['setting','setting','setting','setting']);assert.deepEqual(r.requests.map(v=>v.next.fields),[{key:'theme',value:'dark'},{key:'showGrades',value:false},{key:'motion',value:'still'},{key:'density',value:'compact'}]);
});
test('nominal scalar actions keep alternate surface orders and exact public fields',()=>{
 for(const [line,fields]of [['dark mode; grades off',[{key:'theme',value:'dark'},{key:'showGrades',value:false}]],['grades off; light theme',[{key:'showGrades',value:false},{key:'theme',value:'light'}]],['sand page tint; accent ocean',[{key:'pageTint',value:'sand'},{key:'accent',value:'ocean'}]],['night art 37; motion still',[{key:'nightArt',value:37},{key:'motion',value:'still'}]]]){const r=engine().evaluate(line,state());flat(r,['setting','setting']);assert.deepEqual(r.requests.map(v=>v.next.fields),fields,line);}
});
test('nominal feature and optional Home module proposals stay in their operation families',()=>{
 const line='Math tools feature off; Clock module off; grades off',r=engine().evaluate(line,state());assert.deepEqual(parts(line),['Math tools feature off','Clock module off','grades off']);flat(r,['feature','module','setting']);assert.deepEqual(r.requests.map(v=>v.next.fields),[{id:'math',on:false},{key:'clock',action:'hide'},{key:'showGrades',value:false}]);
});
test('literal conjunctions inside a registered feature name do not break its clause',()=>{
 const line='dark mode; Quick open and study tools feature off; grades off';assert.deepEqual(parts(line),['dark mode','Quick open and study tools feature off','grades off']);
});
test('timer and scalar requests retain their alternate order and separate exact quantities',()=>{
 for(const minutes of [1,17,28.5,1440])for(const [a,b]of [['focus '+minutes,'grades off'],['grades off','focus '+minutes]]){assert.deepEqual(parts(a+'; '+b),[a,b]);const r=engine().evaluate(a+'; '+b,state());flat(r,a.startsWith('focus')?['focus','setting']:['setting','focus']);assert.equal(r.requests.find(v=>v.action==='focus').next.fields.minutes,minutes);assert.deepEqual(r.requests.find(v=>v.action==='setting').next.fields,{key:'showGrades',value:false});}
 const r=engine().evaluate('focus 23 minutes; break 7 minutes; grades off',state());flat(r,['focus','break','setting']);assert.equal(r.requests[0].next.fields.minutes,23);assert.equal(r.requests[1].next.fields.minutes,7);
});
test('explicit finite timer counterfactuals split independently of particular values',()=>{
 for(const line of ['focus 13; break 4','break 11; focus 31','focus 2 hours; grades off','grades off then break 9 minutes'])assert.equal(parts(line).length,2,line);
});
test('plain and only admits a nominal continuation after a concrete timer or scalar',()=>{
 for(const [a,b]of [['focus 17','grades off'],['dark mode','grades off'],['Set density compact','motion still']])assert.deepEqual(parts(a+' and '+b),[a,b]);
 for(const line of ['Explain focus 20 and break 5','Explain dark mode and grades off','Compare density compact and motion still','Show my focus journal and grades off'])whole(line);
});
test('natural focus plus recovery cycles remain a single atomic request',()=>{
 for(const line of ['focus 20 break 5','focus 31 break 7','focus 20 and break 5','Start focus for 20 minutes with a 5-minute break'])whole(line);
});
test('unknown invalid and surplus noun phrases are never scalar command evidence',()=>{
 for(const line of ['volcanic mode; grades off','dark mode; volcanic mode','theme violet; grades off','theme dark journal; grades off','density compact document; grades off','focus research; grades off','dark mode; focus research','dark mode; system theme','dark mode; unknown feature off','dark mode; Up next module off'])whole(line);
});
test('nonpositive out-of-range and nonfinite durations never establish timer evidence',()=>{
 for(const value of ['0','-3','1441','NaN','Infinity','1e309'])for(const line of ['grades off; focus '+value,'grades off; break '+value])whole(line);
});
test('quotes questions reported future conditional and student-purpose language stay protected',()=>{
 for(const line of ['"dark mode; grades off"','dark mode; "grades off"','dark mode?; grades off','What does dark mode mean; grades off?','If I choose dark mode; grades off','Do not choose dark mode; grades off','Never focus 17; grades off','The teacher said: focus 17; grades off','The guide says dark mode; grades off','I will focus 17; grades off','Tomorrow focus 17; grades off','When I finish, focus 17; grades off','Show the guide so I can focus 17; grades off','Show the guide in order that I can focus 17 and grades off','Explain focus 17 and break 5'])whole(line);
});
test('new nominal admission does not carve reminder payload tails into actions',()=>{
 for(const line of ['Remind me in 12 minutes: dark mode; grades off','Remind me in 12 minutes to focus 17; grades off','In 19 minutes remind me: explain why the alarm can change; can you show the timer status?'])whole(line);
});
test('literal note bodies retain internal quoted words rather than replacing the body',()=>{
 for(const text of ['zorx hw; do NOT change "zora"','caf\u00e9 \u03b2; keep \u201clabel\u201d and all  spacing','first "quoted" then focus 17; grades off','"opening" followed by unquoted words; grades off','record says "one" and "two"']){const line='note: '+text;whole(line);assert.deepEqual(I.literalNotePayload(line),{text});const r=engine().evaluate(line,state());assert.equal(r.next.action,'note');assert.deepEqual(r.next.fields,{operation:'create',text});}
});
test('a literal body internal quotation cannot authorize a following old imperative',()=>{
 const line='Note: keep "x"; then hide grades';whole(line);assert.equal(I.literalNotePayload(line).text,'keep "x"; then hide grades');
});
test('multiline unquoted literal note payloads retain all lines and punctuation',()=>{
 const text='first "label"\nsecond; grades off\nthird: focus 17',line='Note: '+text;whole(line);assert.deepEqual(I.literalNotePayload(line),{text});
});
test('quoted body and title envelopes keep their separate roles and quoted padding',()=>{
 for(const [line,expected]of [['Note: "  Caf\u00e9 \u03b2  ".',{text:'  Caf\u00e9 \u03b2  '}],['Create a personal note titled "Caf\u00e9 log" containing exactly "Keep the \u03b2 label".',{title:'Caf\u00e9 log',text:'Keep the \u03b2 label'}],['Create a note titled "Lab": keep "original" text; grades off',{title:'Lab',text:'keep "original" text; grades off'}],['Copy "  Caf\u00e9 \u03b2  " into a new note.',{text:'  Caf\u00e9 \u03b2  '}],['Preserve the sentence \u201cDon\u2019t alter the caf\u00e9 label\u201d in a new note titled \u00c9chantillons.',{title:'\u00c9chantillons',text:'Don\u2019t alter the caf\u00e9 label'}]])assert.deepEqual(I.literalNotePayload(line),expected,line);
 assert.equal(I.literalNotePayload('Create a note titled "Only a title".'),null);assert.equal(I.literalNotePayload('Copy "   " into a new note.'),null);
});
test('a wholly quoted note still permits an explicit independent continuation',()=>{
 const line='Save a personal note exactly "Explain the warning; then hide the timer", then bookmark this assignment',p=I.workflowParts(line);assert.equal(p.length,2);assert.equal(I.literalNotePayload(p[0].text).text,'Explain the warning; then hide the timer');assert.equal(p[1].text,'bookmark this assignment');
});
test('old negative literal and explanatory note contracts remain intact',()=>{
 for(const line of ['Do not copy "Open the cabinet" into a personal note.','If I create a personal note, what happens?'])assert.equal(I.literalNotePayload(line),null,line);
 for(const line of ['Create a note explaining the warning in this guide.','Write a note comparing the two mechanisms.'])assert.equal(I.literalNoteRequest(line),false,line);
});
test('old conditional control and inherited numeric continuation contracts remain intact',()=>{
 const line='Hide Clock module now; when I restore it after rehearsal, move it to the top';assert.deepEqual(parts(line),['Hide Clock module now','when I restore it after rehearsal, move it to the top']);assert.equal(parts('Set night art at 25, then 0 for the plain view and 100 for the comparison').length,3);assert.equal(parts('Pause; seven-left; resume.').length,3);
});
test('layout and its lazy public scalar check do not mutate state or session',()=>{
 const s=state({features:[{id:'math',name:'Math tools'}]}),session={workflowAction:{action:'setting',fields:{key:'theme',value:'light'}}},before=structuredClone({s,session});assert.equal(W.layout('dark mode; Math tools feature off; grades off',s,session).mode,'split');assert.deepEqual({s,session},before);assert.deepEqual(C.propose('Math tools feature off',s,session).next.fields,{id:'math',on:false});
});

test('a finite natural focus and recovery cycle remains whole before an independent setting',()=>{
 for(const cycle of ['focus 20 break 5','focus 31 and break 7','focus 19 minutes with break 4 minutes'])assert.deepEqual(parts(cycle+'; grades off'),[cycle,'grades off']);
});
test('registered finite names containing temporal vocabulary remain scalar settings',()=>{
 for(const line of ['open at once off; grades off','quick open preference on; density compact'])assert.equal(parts(line).length,2,line);
});
test('the public scalar admission path never calls back into workflow layout',t=>{
 t.mock.method(W,'layout',()=>assert.fail('Scalar admission must not reenter Workflow.layout'));assert.deepEqual(parts('dark mode; grades off'),['dark mode','grades off']);
});

test('a note colon owns leading filler and title-like words as literal body text',()=>{
 for(const text of ['the words "zora" stay unchanged; grades off','with "original" wording intact','note titled "Data" is part of this body']){const line='Note: '+text;whole(line);assert.deepEqual(I.literalNotePayload(line),{text});}
});
test('a direct quoted write-down keeps its explicit note destination outside the payload',()=>{
 assert.deepEqual(I.literalNotePayload('Write down "Keep the caf\u00e9 label" in my notes.'),{text:'Keep the caf\u00e9 label'});
});

test('literal notes and already admitted imperative boundaries never need the scalar proposer',t=>{
 t.mock.method(C,'propose',()=>assert.fail('This boundary needs no scalar proposal'));assert.equal(parts('Note: keep "x"; then hide grades').length,1);assert.deepEqual(parts('Bookmark this assignment; explain the warning'),['Bookmark this assignment','explain the warning']);
});
test('new scalar admission never strips a negative numeric sign or a negative directive',()=>{
 for(const line of ['dark mode; night art -3','grades off; night art +3','dark mode; Do not show grades','grades off; Never enable Math tools feature'])whole(line);
});
