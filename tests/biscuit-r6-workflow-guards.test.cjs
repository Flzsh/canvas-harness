'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),E=require('../extension/biscuit-engine.js'),I=require('../extension/biscuit-intent.js'),C=require('../extension/biscuit-control-request.js'),D=require('../extension/biscuit-details.js'),Facts=require('../extension/biscuit-facts.js'),Inference=require('../extension/biscuit-inference.js');
const MIN=60000,NOW=Date.parse('2029-04-18T12:00:00Z'),state=extra=>({now:NOW,timeZone:'UTC',courses:[{id:'studio',name:'Investigation Studio'}],...extra}),active=extra=>state({focus:{running:true,endsAt:NOW+14*MIN},...extra}),controls=(rows,extra={})=>state({selectedItemId:'panel',pages:[{id:'panel',title:'Loaded preference panel',controls:rows}],...extra});
function flat(result,actions){assert.equal(result.next.action,'batch');assert.ok(Array.isArray(result.requests));assert.deepEqual(result.requests.map(v=>v.action),actions);assert.ok(result.requests.every(v=>!v.requests&&v.next.action!=='batch'));assert.deepEqual(result.next.fields.steps.map(v=>({action:v.action,fields:v.fields})),result.requests.map(v=>({action:v.next.action,fields:v.next.fields})));}
test('active focus cannot capture composition explanations or artifact status/session fields',()=>{
 const s=active({selectedItemId:'journal',pages:[{id:'journal',title:'Investigation record',text:'The observations are complete. The alternative account still needs evidence.'}]});
 for(const line of ['Write a brief status overview of the investigation record.','My reviewer wants a concise update, so could you summarise the record in a short status paragraph?','Explain what the session status in this conference transcript means.','Show the recorded status of these two submissions.','Show the session status from the loaded conference transcript.','Write a status summary about the focus experiment and its remaining uncertainties.','Show the focus journal status from the loaded source.'])assert.equal(I.timerRequest(line,s),null,line);
});
test('actual timer objects retain the public status action through Details',()=>{
 const s=active();
 for(const line of ['Show my focus clock status.','What is left on the timer?','How much time is remaining on my clock?','Is the timer running or paused?','Status of the countdown?']){const intent=I.timerRequest(line,s);assert.deepEqual(intent,{action:'focus-control',text:'show focus timer status'},line);const result=D.resolve(intent.action,intent.text,s);assert.equal(result.action,'focus-status');assert.equal(result.next.fields.remainingMinutes,14);}
});
test('short status ellipsis needs active timer context and excludes a generic session',()=>{
 for(const line of ['Status?','Time left?','How much time is left?','Is it paused?']){assert.ok(I.timerRequest(line,active()),line);assert.equal(I.timerRequest(line,state()),null,line);}
 for(const line of ['Session status?','Status of the workshop session?','A status paragraph?'])assert.equal(I.timerRequest(line,active()),null,line);
 assert.deepEqual(I.timerRequest('seven-left',active()),{action:'focus-control',text:'set countdown to 7 minutes remaining'});
});
test('literal payloads and hypothetical timer language remain data',()=>{
 for(const line of ['Save a personal note exactly "show timer status".','If I check the timer status, could I leave early?','Do not show my timer status.','Explain the countdown status.'])assert.equal(I.timerRequest(line,active()),null,line);
});
test('quote-aware request cues recognize a colon after arbitrary descriptive namespaces',()=>{
 assert.equal(I.requestGoal('Fit audit, contain or cover: find the banner fit chooser before I pick one.'),'find the banner fit chooser before I pick one.');
 assert.equal(I.requestGoal('Please write a personal note exactly "Palette: show both values; then hide it".'),'write a personal note exactly "Palette: show both values; then hide it".');
 assert.equal(I.requestGoal('The source quotes "could you show timer status", so please summarise its conclusion.'),'summarise its conclusion.');
});
test('all twelve Help products expose the assistant directive after narrative task verbs',()=>{
 const directives=[['ask','simplify the explanation of this observation.'],['practice','quiz me on the concepts in this reading.'],['reading','guide me through the argument in this chapter.'],['lab','prepare a lab checklist from these instructions.'],['rubric','review my draft against the listed criteria.'],['fixes','convert these comments into a fix list.'],['steps','guide me through the first doable steps for this project.'],['outline','outline the argument for this response.'],['message','draft a polite question to my teacher.'],['summary','recap the important changes in these announcements.'],['notes','structure a notes outline for this reading.'],['flashcards','prepare flashcards from these definitions.']],leads=['When I review the apparatus record I start at its listed opening time and check each measurement, ','After I outline the oral report I plan the next revision and mark the remaining gaps, '];
 for(const [product,directive] of directives)for(const lead of leads){const line=lead+'could you '+directive;assert.equal(I.requestGoal(line),directive,product);assert.equal(I.requestGoal(lead+'would you please '+directive),directive,product);}
 assert.equal(I.requestGoal('I could start at the recorded opening time but I cannot choose an order, so could you guide me through the preparation steps.'),'guide me through the preparation steps.');
});
test('shared assistance directives split independent clauses while preserving literal payloads',()=>{
 const line='Bookmark this assignment, then outline the response from its prompt, then guide me through its first step.';assert.deepEqual(I.workflowParts(line).map(v=>v.text),['Bookmark this assignment','outline the response from its prompt','guide me through its first step.']);
 assert.equal(I.requestGoal('First outline the response from this prompt.'),'outline the response from this prompt.');assert.equal(I.requestSpan('Guide me through the draft; I will revise it later.'),'Guide me through the draft');
 const note='Note: could you guide me through the outline; then prepare flashcards';assert.equal(I.requestGoal(note),note);assert.equal(I.workflowParts(note).length,1);
});
test('a narrative assistance carrier reaches learned dispatch before any early metadata projection',t=>{
 t.mock.method(Facts,'resolve',()=>assert.fail('A contextual opening time is not the requested help product.'));t.mock.method(Inference,'evaluate',()=>{throw Error('learned-assistance-boundary');});
 const s=state({selectedItemId:'record',pages:[{id:'record',title:'Apparatus review',text:'The setup opened at the recorded time. The first measurement still needs an explanation.',startAt:NOW+30*MIN}]});
 for(const directive of ['guide me through the first preparation steps.','outline the explanation for this report.'])assert.throws(()=>E.create({pack:{}}).evaluate('When I look at the apparatus record I start with its opening time and review each measurement, could you '+directive,s),/learned-assistance-boundary/);
});
test('assistance vocabulary does not turn bare source titles or navigation into AI requests',()=>{
 const s=state({selectedItemId:'guide-file',files:[{id:'guide-file',title:'Guide',text:'The loaded source has the exact directions for the activity.'},{id:'outline-file',title:'Outline',text:'The saved source lists the agreed section headings.'}]});
 for(const title of ['Guide','Outline']){assert.equal(I.requestGoal(title),title);assert.equal(I.choose(title,s,{},'open/find',0),'open/find');const result=E.create().evaluate('Open '+title,s);assert.ok(['find','open'].includes(result.action));assert.equal(result.items[0].title,title);}
 const goal=I.requestGoal('While I outline the revision plan, could you take me to the planner?');assert.equal(goal,'take me to the planner?');assert.equal(I.choose(goal,s,{},'navigate',0),'navigate');
});
test('finite enum inspection after a namespace opens the real source without choosing a value',()=>{
 const s=controls([{key:'bannerFit',label:'banner fit',availableValues:['contain','cover'],availableOperations:['inspect','reset']}]);
 for(const line of ['Design audit: show contain and cover for banner fit side by side in the chooser.','Fit audit, contain or cover: find the banner fit chooser before I pick one.','Draft comparison: inspect the available banner fit values.']){const result=E.create().evaluate(line,s);assert.equal(result.action,'find',line);assert.equal(result.next.fields.itemId,'panel');assert.equal(result.next.fields.value,undefined);assert.equal(result.next.fields.operation,undefined);assert.equal(C.resolve('setting',line,s),null);}
});
test('boolean show/hide sequences retain both public requests and executable steps',()=>{
 const s=controls([{key:'showCourseInformation',label:'course information',availableValues:[true,false],availableOperations:['set']}]),result=E.create().evaluate('Show course information for review, then hide course information during recording.',s);flat(result,['setting','setting']);assert.deepEqual(result.requests.map(v=>v.next.fields.key),['showCourseInformation','showCourseInformation']);assert.deepEqual(result.requests.map(v=>v.next.fields.value),[true,false]);
});
test('loaded boolean on/off aliases split without requiring literal true/false',()=>{
 const s=controls([{key:'showCourseStrip',label:'course strip',availableValues:[true,false],availableOperations:['set']}]),result=E.create().evaluate('Turn course strip off for narrow review, then on for wide review.',s);flat(result,['setting','setting']);assert.deepEqual(result.requests.map(v=>v.next.fields.value),[false,true]);
});
test('typed finite controls keep their target through Spanish and English continuations',()=>{
 const s=controls([{key:'pageTint',label:'page tint',availableValues:['sand','sage'],availableOperations:['inspect','reset']},{key:'density',label:'density',availableValues:['compact','comfortable'],availableOperations:['set']}]);
 for(const line of ['Sand page tint primero para el ensayo, luego sage para la segunda captura.','Set page tint sand first, then sage for the comparison.']){const result=C.surface(line,s);flat(result,['setting','setting']);assert.deepEqual(result.requests.map(v=>v.next.fields.key),['pageTint','pageTint']);assert.deepEqual(result.requests.map(v=>v.next.fields.value),['sand','sage']);}
});
test('an immediate pronoun toggle uses the actual preceding setting key',()=>{
 const result=E.create().evaluate('Disable open at once for the capture, then enable it again now.',state());flat(result,['setting','setting']);assert.deepEqual(result.requests.map(v=>v.next.fields.key),['quickOpen','quickOpen']);assert.deepEqual(result.requests.map(v=>v.next.fields.value),['off','on']);
 assert.equal(C.surface('Enable it again now.',state()),null);
});
test('conditional inherited toggles remain visible manual steps without scheduling future changes',()=>{
 for(const line of ['Turn quick open off for rehearsal, then turn it on again after the rehearsal ends.','Disable open at once for the capture, then enable it again afterward.']){const result=E.create().evaluate(line,state());flat(result,['setting','none']);assert.equal(result.requests[1].clarify,true);assert.equal(result.next.fields.steps[1].manual,true);assert.equal(result.next.fields.steps[1].action,'none');assert.deepEqual(result.next.fields.steps[1].fields,{});assert.match(result.next.fields.steps[1].message,/not been scheduled/);assert.notEqual(result.requests[0].next.fields.key,'pet.enabled');}
});
test('conditional finite replacements and later inspection handoffs retain following preview steps',()=>{
 const s=controls([{key:'density',label:'density',availableValues:['compact','comfortable'],availableOperations:['set']}]),conditional=C.surface('Set density compact first, then comfortable after the review ends.',s);flat(conditional,['setting','none']);assert.equal(conditional.next.fields.steps[1].manual,true);
 const line='Set density compact, then inspect the density chooser, then set density comfortable.';for(const inspected of [C.surface(line,s),E.create().evaluate(line,s)]){flat(inspected,['setting','find','setting']);assert.equal(inspected.next.fields.steps[1].manual,true);assert.equal(inspected.next.fields.steps[1].fields.itemId,'panel');assert.equal(inspected.requests[2].next.fields.value,'comfortable');}
});
