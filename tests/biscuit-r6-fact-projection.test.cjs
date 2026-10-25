'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Facts=require('../extension/biscuit-facts.js');
const now=Date.parse('2028-03-06T12:00:00Z'),state=extra=>({now,timeZone:'UTC',showGrades:true,teacherFeedback:true,selectedItemId:'source',...extra}),record=extra=>({id:'source',kind:'assignment',courseId:'north',title:'Evidence notebook',text:'Loaded source instructions.',fields:{itemId:'source'},...extra}),read=(line,row,s=state())=>Facts.resolve(line,s,{},[row]);

test('long exact date requests distinguish due, opening and closing metadata regardless of key order',()=>{
 const dates={dueAt:now+300000,unlockAt:'2028-03-07T07:15:00Z',lockAt:now+900000},queries=[['Please show the exact due date and time for the selected assignment.','dueAt'],['Please show when the selected assignment submission window first opens.','unlockAt'],['Please show the closing time when the selected assignment stops accepting uploads.','lockAt']];
 for(const fields of [dates,Object.fromEntries(Object.entries(dates).reverse())])for(const [line,key]of queries){const result=read(line,record(fields));assert.equal(result.next.fields.answerField,key,line);assert.equal(result.next.fields[key],dates[key]);assert.equal(result.items[0].id,'source');}
});
test('request focus chooses the primary fact while an explicit multi-field request retains both values',()=>{
 const row=record({lockAt:now+900000,dueAt:now+300000,unlockAt:now+100000}),closing=read('The due date is already clear; please show the closing time for this task.',row),both=read('Show the opening and closing times for the submission window.',row);assert.equal(closing.next.fields.answerField,'lockAt');assert.equal(closing.next.fields.dueAt,undefined);assert.equal(both.next.fields.answerField,'unlockAt');assert.equal(both.next.fields.unlockAt,row.unlockAt);assert.equal(both.next.fields.lockAt,row.lockAt);
});
test('opening and closing aliases preserve source keys and never substitute for one another',()=>{
 const row=record({availableFrom:now+100000,availableUntil:now+900000});assert.equal(read('When does the upload open?',row).next.fields.answerField,'availableFrom');assert.equal(read('When does the upload close?',row).next.fields.answerField,'availableUntil');assert.equal(read('When does the upload close?',record({availableFrom:now+100000})),null);assert.equal(read('When does the upload open?',record({lockAt:now+900000})),null);
});
test('earned score and maximum form a composite fact and preserve a zero score',()=>{
 const row=record({kind:'grade',score:0,pointsPossible:24}),result=read('Please show my earned score out of the maximum possible for this returned work.',row);assert.equal(result.next.fields.answerField,'scoreAndPossible');assert.equal(result.next.fields.score,0);assert.equal(result.next.fields.pointsPossible,24);assert.match(result.message,/0/);assert.match(result.message,/24/);
 const hidden=read('Show my score out of the maximum possible.',row,state({showGrades:false}));assert.equal(hidden.action,'none');assert.equal(hidden.items.length,0);assert.doesNotMatch(hidden.message,/24/);
});
test('a missing maximum remains missing rather than becoming a fabricated composite',()=>{
 const result=read('Show my earned score out of its maximum possible.',record({kind:'grade',score:0,possible:null,pointsPossible:undefined}));assert.equal(result.next.fields.score,0);assert.equal(result.next.fields.answerField,'score');assert.equal(result.next.fields.pointsPossible,undefined);assert.equal(result.next.fields.possible,undefined);
});
test('grade aliases retain their actual values and the public score answer classification',()=>{
 const single=read('Show my earned score.',record({kind:'grade',value:0})),composite=read('Show my earned score out of the maximum possible.',record({kind:'grade',value:0,possible:18}));assert.equal(single.next.fields.answerField,'score');assert.equal(single.next.fields.value,0);assert.equal(single.next.fields.score,undefined);assert.equal(composite.next.fields.answerField,'scoreAndPossible');assert.equal(composite.next.fields.value,0);assert.equal(composite.next.fields.possible,18);
});
test('word-count rules project literal instructions, both bounds and a false reference-list flag',()=>{
 const row=record({instructions:'Write 280–360 words, excluding the source list.',wordCountMin:280,wordCountMax:360,referencesCount:false}),result=read('Show the actual word-count range and whether the source list counts before I shorten this draft.',row);assert.equal(result.next.fields.answerField,'instructions');assert.equal(result.next.fields.instructions,row.instructions);assert.equal(result.next.fields.wordCountMin,280);assert.equal(result.next.fields.wordCountMax,360);assert.equal(result.next.fields.referencesCount,false);
});
test('submission options preserve arrays and genuinely empty extension lists without claiming an upload',()=>{
 const row=record({submissionTypes:['online_text_entry','online_upload'],allowedExtensions:[],cloudProviders:['School Drive']}),before=JSON.stringify(row),result=read('Show the actual submission types, allowed file extensions and cloud provider choices.',row);assert.equal(result.next.fields.answerField,'submissionTypes');assert.deepEqual(result.next.fields.submissionTypes,row.submissionTypes);assert.deepEqual(result.next.fields.allowedExtensions,[]);assert.deepEqual(result.next.fields.cloudProviders,['School Drive']);assert.equal(result.next.action,'find');assert.equal(result.next.fields.operation,undefined);assert.equal(result.next.fields.manualStep,undefined);assert.equal(JSON.stringify(row),before);
});
test('remaining attempts use explicit values or complete count evidence and retain zero',()=>{
 for(const extra of [{attemptsLeft:0},{attemptsAllowed:3,attemptsUsed:3}]){const result=read('How many attempts remain for this selected assignment?',record(extra));assert.equal(result.next.fields.answerField,'attemptsLeft');assert.equal(result.next.fields.attemptsLeft,0);assert.equal(result.next.fields.operation,undefined);}
 assert.equal(read('How many attempts remain for this selected assignment?',record({attemptsUsed:2})),null);
});
test('public rubric rows and original feedback use their real schema fields and privacy gates',()=>{
 const rubric=[{id:'evidence',description:'Cite two observations.',points:8}],rubricResult=read('Show the original rubric rows for this assignment.',record({rubric}));assert.equal(rubricResult.next.fields.answerField,'rubric');assert.deepEqual(rubricResult.next.fields.rubric,rubric);
 const row=record({kind:'grade',feedback:'Label the second observation.'}),result=read('Show the original feedback for this returned work.',row);assert.equal(result.next.fields.answerField,'feedback');assert.equal(result.next.fields.feedback,row.feedback);assert.equal(read('Show the original feedback for this returned work.',row,state({teacherFeedback:false})).action,'none');
});
test('manual media sources project admitted captions and transcript metadata alongside their prose',()=>{
 const media=record({id:'video',kind:'page',title:'Loaded recording',provider:'Campus Studio',captions:['English','Spanish'],transcript:'The instrument was aligned before recording.',durationSeconds:180,text:'Use the caption menu or read the transcript.'}),rows=[record({id:'elsewhere'}),media],s=state({selectedItemId:'elsewhere',activeCourseId:'unrelated'}),result=Facts.resolve('Open the recording and show the caption tracks and transcript.',s,{},rows);assert.equal(result.items[0].id,'video');assert.deepEqual(result.next.fields.captions,media.captions);assert.equal(result.next.fields.transcript,media.transcript);assert.match(result.message,/caption menu/);assert.equal(result.next.action,'find');
});
test('source projection respects the selected correction and preserves disabled replies',()=>{
 const old=record({id:'old',kind:'announcement',title:'Lab briefing',repliesAllowed:true}),current=record({id:'current',kind:'announcement',title:'Lab briefing correction',supersedesId:'old',repliesAllowed:false,startAt:now+3600000,location:'room 214'}),s=state({selectedItemId:'old'}),rows=[old,current],reply=Facts.resolve('Show whether replies are allowed under the corrected announcement.',s,{},rows),time=Facts.resolve('Where and when is the corrected announcement briefing?',s,{},rows);assert.equal(reply.items[0].id,'current');assert.equal(reply.next.fields.repliesAllowed,false);assert.equal(reply.answer.value,'No');assert.equal(time.next.fields.startAt,current.startAt);assert.equal(time.next.fields.location,'room 214');
});
test('a selected container keeps admitted attachments when projecting its requested deadline',()=>{
 const row=record({kind:'message',title:'Source decision',dueAt:now+900000,attachments:['file','hidden']}),file=record({id:'file',kind:'file',title:'Source sheet'}),result=Facts.resolve('Show the message deadline and its attachment.',state({messages:[row],files:[file,record({id:'hidden',kind:'file'})]}),{},[row,file]);assert.deepEqual(result.items.map(value=>value.id),['source','file']);assert.equal(result.next.fields.dueAt,row.dueAt);assert.equal(result.next.fields.itemId,'source');
});
test('module facts keep the container, actual requirements, zero counts and declared neighbour order',()=>{
 const row=record({kind:'canvas-module',items:[{contentId:'before'},{contentId:'here'},{contentId:'after'}],currentItemId:'here',requirements:['view','submit'],prerequisite:'Complete the earlier unit.',completedCount:0,complete:false}),result=read('Show the module requirements, prerequisite and completion count.',row),neighbours=read('Please show the previous and next items in this selected module.',row);assert.equal(result.items[0].id,'source');assert.deepEqual(result.next.fields.requirements,row.requirements);assert.equal(result.next.fields.prerequisite,row.prerequisite);assert.equal(result.next.fields.completedCount,0);assert.equal(result.next.fields.complete,false);assert.equal(neighbours.next.fields.previousItemId,'before');assert.equal(neighbours.next.fields.nextItemId,'after');assert.equal(neighbours.next.fields.itemId,'source');
});
test('missing module neighbours remain absent instead of becoming stringified placeholder identifiers',()=>{
 const result=read('Prev/next?',record({kind:'canvas-module',currentItemId:'here',items:[null,{id:'here'},{}]}));assert.equal(result.next.fields.currentItemId,'here');assert.equal(result.next.fields.previousItemId,undefined);assert.equal(result.next.fields.nextItemId,undefined);assert.deepEqual(result.next.fields.items,[null,{id:'here'},{}]);
});
test('terse UI facts preserve false and empty arrays while conceptual followups stay unhandled',()=>{
 const row=record({kind:'page',highContrast:false,device:'Android',tabs:[],captions:[],provider:'Campus Studio',durationSeconds:0});assert.equal(read('Mobile contrast?',row).next.fields.highContrast,false);assert.deepEqual(read('Home tabs?',row).next.fields.tabs,[]);assert.deepEqual(read('Studio captions.',row).next.fields.captions,[]);for(const line of ['Why?','Overestimate?','Explain the caption choice.','Generate new captions.','Remind me about captions tomorrow.'])assert.equal(read(line,row),null,line);
});
test('long conceptual requests defer to AI instead of being captured by matching manual metadata',()=>{
 const row=record({kind:'page',provider:'Campus Studio',captions:['English'],durationSeconds:120,text:'A recording of two approaches to the problem.'});assert.equal(read('Compare the approaches described in this recording and assess their assumptions.',row),null);
});
test('explicit course scope and excluded source objects outrank selected-source projection',()=>{
 const north=record({kind:'grade',score:5,pointsPossible:10}),south=record({id:'other',kind:'grade',courseId:'south',title:'Returned analysis',score:7,pointsPossible:12}),s=state({courses:[{id:'north',name:'Chemistry'},{id:'south',name:'History'}],activeCourseId:'north'}),result=Facts.resolve('Show my earned History score out of its maximum, not Chemistry.',s,{},[north,south]);assert.equal(result.items[0].id,'other');assert.equal(result.next.fields.score,7);assert.equal(Facts.resolve('Show my earned History score out of its maximum.',s,{},[north]),null);
});
test('projection reads only finite admitted fields and ignores label evidence and arbitrary numeric metadata',()=>{
 const row=record({unregisteredMetric:91,expected:{score:999},coverageEvidence:{dueAt:1},pendingOperations:[{action:'find',fields:{score:888}}]}),session={expected:{score:777},coverageEvidence:{score:666},pendingOperations:[{fields:{score:555}}]};assert.equal(read('Unregistered metric?',row),null);assert.equal(Facts.resolve('Score?',state(),session,[row]),null);assert.equal(read('coverageEvidence?',row),null);
});
test('manual compose state exposes the existing recipient and denied approval without creating an operation',()=>{
 const row=record({kind:'page',pageType:'control',recipient:'Course teacher',extensionGranted:false,text:'New Message has a blank subject and body. No extension has been granted.'}),result=read('Open the teacher Inbox compose route and show its recipient and approval status.',row);assert.equal(result.next.fields.recipient,'Course teacher');assert.equal(result.next.fields.extensionGranted,false);assert.equal(result.next.fields.approvedDueAt,undefined);for(const key of ['operation','manualNextStep','manualStep','nextStep','requests'])assert.equal(result.next.fields[key],undefined);assert.equal(result.next.action,'find');
});
test('a pending decision cannot promote an approval timestamp or substitute the ordinary deadline',()=>{
 const row=record({kind:'message',extensionApproved:false,approvedDueAt:now+900000,dueAt:now+300000,text:'The request is pending; no extension has been granted.'}),result=read('Show the approved extension deadline in this message.',row);assert.equal(result.next.fields.approvedDueAt,undefined);assert.equal(result.next.fields.dueAt,undefined);assert.equal(result.next.fields.operation,undefined);assert.match(result.message,/pending/);
});
test('choosing an eligible source does not format or serialize another source rubric',()=>{
 let otherSerializations=0;const chosen=record({title:'Notebook source',rubric:[{description:'Cite the observations.'}]}),other=record({id:'other',title:'Other source',rubric:[{toJSON(){otherSerializations++;return {description:'Unselected observations.'};}}]}),result=Facts.resolve('Show the actual rubric for Notebook source.',state({selectedItemId:'not-loaded'}),{},[other,chosen]);assert.equal(result.items[0].id,'source');assert.deepEqual(result.next.fields.rubric,chosen.rubric);assert.equal(otherSerializations,0);
});

test('requested property presence cannot admit an anonymous source from a larger pool',()=>{
 const cases=[['Show the deadline.',{dueAt:now+60000}],['Where is the location?',{kind:'event',location:'Room 9'}],['Show the actual instructions.',{instructions:'Keep both observations.'}],['Show the procedure steps.',{steps:['Read','Compare']}],['Price?',{kind:'market-item',price:0}],['Show my earned score.',{kind:'grade',score:0}]];
 for(const [line,extra]of cases){const first=record(extra),second=record({id:'other',kind:first.kind,title:'Other loaded record'}),s=state({selectedItemId:'not-loaded'});for(const rows of [[first,second],[second,first]])assert.equal(Facts.resolve(line,s,{},rows),null,line);}
});
test('a missing selected fact cannot be borrowed from another row or inspected while choosing',()=>{
 let reads=0;const selected=record(),other=record({id:'other',title:'Other loaded assignment'});Object.defineProperty(other,'dueAt',{enumerable:true,get(){reads++;return now+60000;}});const result=Facts.resolve('Show the selected assignment deadline.',state(),{},[selected,other]);assert.equal(result,null);assert.equal(reads,0);
});
test('a single admitted row can project a real zero-valued date without selection',()=>{
 const result=read('Show the deadline.',record({dueAt:0}),state({selectedItemId:'not-loaded'}));assert.equal(result.items[0].id,'source');assert.equal(result.next.fields.dueAt,0);assert.equal(result.next.fields.answerField,'dueAt');
});
test('a unique explicit source name admits that source before its properties are considered',()=>{
 const named=record({id:'named',title:'Eastern exercise',lockAt:now+120000}),selected=record({lockAt:now+60000}),result=Facts.resolve('Show the closing time for Eastern exercise.',state(),{},[selected,named]);assert.equal(result.items[0].id,'named');assert.equal(result.next.fields.lockAt,named.lockAt);assert.equal(result.next.fields.answerField,'lockAt');
 const withoutClosing={...named,lockAt:undefined};assert.equal(Facts.resolve('Show the closing time for Eastern exercise.',state(),{},[selected,withoutClosing]),null);
});
test('duplicate explicit source names do not gain admission from a field or row order',()=>{
 const first=record({title:'Eastern exercise',lockAt:now+60000}),second=record({id:'other',title:'Eastern exercise'}),s=state({selectedItemId:'not-loaded'});for(const rows of [[first,second],[second,first]])assert.equal(Facts.resolve('Show the closing time for Eastern exercise.',s,{},rows),null);
});
test('duplicate named rubric sources remain ambiguous even if only one exposes rubric metadata',()=>{
 const first=record({title:'Source checklist',kind:'rubric',rubric:['Cite observations.']}),second=record({id:'other',title:'Source checklist',kind:'rubric'});assert.equal(Facts.resolve('Show the actual rubric for Source checklist.',state({selectedItemId:'not-loaded'}),{},[first,second]),null);
});
test('teacher, reviewer and group questions cannot be rewritten into course authorship',()=>{
 const course=record({kind:'course',teacher:'Dana Holt'}),rows=[course,record({id:'review',kind:'peer-review',title:'Assigned review',text:'Lee reviews your draft.'}),record({id:'teacher',kind:'teacher',title:'Dana Holt'}),record({id:'group',kind:'group',title:'Project team',members:['Dana','Lee']})];for(const line of ['Who reviews me?','Who is my course teacher?','Who else is in my group?'])assert.equal(Facts.resolve(line,state(),{},rows),null,line);
 const profile=record({id:'teacher',kind:'teacher',title:'Dana Holt',email:'dana@example.invalid'}),contact=Facts.resolve('Show the teacher profile email.',state(),{},[course,profile]);assert.equal(contact.items[0].id,'teacher');assert.equal(contact.next.fields.email,profile.email);assert.equal(contact.next.fields.answerField,'email');
});
test('authorship aliases belong to their actual source family rather than course or recipient metadata',()=>{
 assert.equal(read('Show this source author.',record({kind:'course',teacher:'Dana Holt'})),null);assert.equal(read('Show this source author.',record({kind:'page',fromName:'Recipient only'})),null);
 const announcement=read('Who posted this announcement?',record({kind:'announcement',teacher:'Dana Holt'}));assert.equal(announcement.next.fields.teacher,'Dana Holt');assert.equal(announcement.next.fields.answerField,'author');
 const message=read('Who sent this message?',record({kind:'message',fromName:'Lee Chen'}));assert.equal(message.next.fields.fromName,'Lee Chen');assert.equal(message.next.fields.answerField,'author');
 const recipient=read('Who sent this message?',record({kind:'message',teacher:'Recipient only'}));assert.equal(recipient.next.fields.teacher,undefined);assert.notEqual(recipient.next.fields.answerField,'author');
 const page=read('Read the exact source author.',record({kind:'page',authorName:'Avery Finch'}));assert.equal(page.next.fields.authorName,'Avery Finch');assert.equal(page.next.fields.answerField,'author');
});
test('a policy source resolves before incidental assignment instructions and keeps its actual metadata',()=>{
 const selected=record({instructions:'Follow this assignment protocol.'}),policy=record({id:'policy',kind:'syllabus',title:'Standing work policy',instructions:'A retake requires a conference.',text:'The standing rule applies to every retake.'});for(const line of ['Show the standing policy retake rule.','Show the standing retake policy rule for this assignment.']){const result=Facts.resolve(line,state(),{},[selected,policy]);assert.equal(result.items[0].id,'policy');assert.equal(result.next.fields.instructions,policy.instructions);assert.match(result.message,/standing rule/);assert.doesNotMatch(result.message,/assignment protocol/);assert.equal(Facts.resolve(line,state(),{},[selected]),null);}
});
test('module prerequisite and step requests retain the container over a selected child instruction field',()=>{
 const child=record({instructions:'Write a separate reflection.'}),container=record({id:'module',kind:'canvas-module',title:'Loaded unit',prerequisite:'Finish the introductory unit.',requirements:['view','submit'],items:['source']}),result=Facts.resolve('Show the module prerequisite and steps.',state(),{},[child,container]);assert.equal(result.items[0].id,'module');assert.equal(result.next.fields.prerequisite,container.prerequisite);assert.deepEqual(result.next.fields.requirements,container.requirements);assert.equal(result.next.fields.instructions,undefined);assert.doesNotMatch(result.message,/separate reflection/);
});
test('a named UI source admits control metadata before an unrelated selected event location',()=>{
 const event=record({kind:'event',location:'Gymnasium'}),panel=record({id:'panel',kind:'page',pageType:'control',title:'Accessibility panel',controls:[{label:'Contrast',value:false}],currentValue:false,uiPath:['Settings','Accessibility']}),result=Facts.resolve('Where is the Accessibility panel control? Show its current value.',state(),{},[event,panel]);assert.equal(result.items[0].id,'panel');assert.equal(result.next.fields.currentValue,false);assert.deepEqual(result.next.fields.uiPath,panel.uiPath);assert.deepEqual(result.next.fields.controls,panel.controls);assert.equal(result.next.fields.location,undefined);assert.equal(result.next.action,'find');assert.equal(result.next.fields.operation,undefined);
 assert.equal(Facts.resolve('Where is the interface control?',state(),{},[event]),null);
});
test('specific quiz policy facets still project the selected quiz rather than a standing-policy page',()=>{
 const quiz=record({kind:'quiz',scoringPolicy:'Highest submitted attempt.',calculatorAllowed:false}),policy=record({id:'policy',kind:'syllabus',title:'Course standing policy',instructions:'Follow the published procedures.'}),rows=[quiz,policy],scoring=Facts.resolve('Show this quiz scoring policy.',state(),{},rows),calculator=Facts.resolve('Show calculator policy for the selected quiz.',state(),{},rows);assert.equal(scoring.items[0].id,'source');assert.equal(scoring.next.fields.scoringPolicy,quiz.scoringPolicy);assert.equal(scoring.next.fields.answerField,'scoringPolicy');assert.equal(calculator.items[0].id,'source');assert.equal(calculator.next.fields.calculatorAllowed,false);assert.equal(calculator.next.fields.instructions,undefined);
});
test('prepared descriptors stay within one resolve and cannot retain an earlier request field',()=>{
 const row=record({dueAt:now+60000,price:0}),s=state(),due=read('Show the selected assignment deadline.',row,s),price=read('Price?',row,s);assert.equal(due.next.fields.dueAt,row.dueAt);assert.equal(due.next.fields.price,undefined);assert.equal(price.next.fields.price,0);assert.equal(price.next.fields.answerField,'price');assert.equal(price.next.fields.dueAt,undefined);
});

test('source admission relations distinguish explicit names, scoped selection and single-row projection',()=>{
 const row=record({title:'Eastern exercise',lockAt:now+60000}),other=record({id:'other',title:'Western exercise',lockAt:now+120000}),selected=Facts.resolve('Show the closing time.',state(),{},[row,other]),named=Facts.resolve('Show the closing time for Eastern exercise.',state({selectedItemId:'other'}),{},[row,other]),single=read('Show the closing time.',row,state({selectedItemId:'not-loaded'}));assert.equal(selected.relation,'selected-fact');assert.equal(selected.next.fields.lockAt,row.lockAt);assert.equal(named.relation,'named-fact');assert.equal(named.items[0].id,row.id);assert.equal(named.next.fields.lockAt,row.lockAt);assert.equal(single.relation,'metadata-fact');assert.equal(single.next.fields.lockAt,row.lockAt);assert.equal(Facts.resolve('Show the closing time.',state({selectedItemId:'not-loaded'}),{},[row,other]),null);
});
test('typed source admission is retained for prose and projected fields while explicit names remain distinct',()=>{
 const selected=record({instructions:'An unrelated task procedure.'}),policy=record({id:'policy',kind:'syllabus',title:'Published rules',instructions:'A retake follows a conference.',text:'The policy is available on this loaded page.'}),rows=[selected,policy],prose=Facts.resolve('Show the standing policy.',state(),{},rows),projected=Facts.resolve('Show the standing policy rule.',state(),{},rows),named=Facts.resolve('Show the Published rules policy.',state(),{},rows);for(const result of [prose,projected]){assert.equal(result.relation,'typed-fact');assert.equal(result.items[0].id,'policy');assert.match(result.message,/loaded page/);}assert.equal(prose.next.fields.instructions,undefined);assert.equal(projected.next.fields.instructions,policy.instructions);assert.equal(named.relation,'named-fact');assert.equal(named.items[0].id,'policy');
});
