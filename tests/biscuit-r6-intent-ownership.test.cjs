'use strict';
// Independently authored BEFORE implementation. AUTHORED_UNRUN: do not treat as RED/GREEN.
const test=require('node:test'),assert=require('node:assert/strict');
const load=file=>require('../'+file),I=load('extension/biscuit-intent.js');
const NOW=Date.parse('2029-07-09T10:00:00Z'),MIN=60000;
const state=extra=>({now:NOW,timeZone:'UTC',courses:[{id:'studio',name:'Inquiry Studio'}],selectedItemId:'record',pages:[{id:'record',kind:'page',title:'Observation record',courseId:'studio',text:'The public record explains the observation procedure and compares alternative accounts of the result.'}],...extra});
const choose=(line,prediction='open/find',probability=.96,s=state(),session={})=>I.choose(line,s,session,prediction,probability);

test('declarative modal subjects do not own a later payload noun',()=>{
 for(const line of ['Observing a nest can change its behaviour; explain the warning in the public guide.','The instrument could change the recorded alert. Explain its meaning.','This observer will change what it sees, so explain the notification in the manual.']){
  assert.doesNotMatch(I.requestGoal(line),/^(?:change|set|save)\b/i,line);
  assert.equal(choose(line,'ai',.997),'ai',line);
 }
 assert.equal(choose('Watching the flock can change what it does explain that warning in the field manual','ai',.997),'ai');
});

test('a warning inside another direct object cannot own reminder mutation',()=>{
 for(const line of ['Change the explanation of that warning in the public guide.','Make a comparison of the alert methods in this reading.'])assert.equal(choose(line,'ai',.997),'ai',line);
 assert.equal(choose('Set a reminder in 19 minutes: can you show the timer status?','ai'),'reminder');
 assert.equal(choose('Remove the old reminder.','open/find'),'reminder');
});

test('second-person and boundary subjectless request carriers remain available',()=>{
 assert.equal(I.requestGoal('The apparatus can change its state, could you explain the warning?'),'explain the warning?');
 assert.equal(I.requestGoal('We need the official instructions; could show the posted page?'),'show the posted page?');
 assert.equal(I.requestGoal('Can show Sent in Inbox?'),'show Sent in Inbox?');
 assert.equal(I.requestGoal('While I outline my report, would you please guide me through the rubric?'),'guide me through the rubric?');
});

test('a temporal reminder head owns its colon payload and original delay',()=>{
 const line='The culture must settle; in 37 minutes remind me: inspect the labelled jars';
 assert.equal(I.requestGoal(line),'in 37 minutes remind me: inspect the labelled jars');
 assert.equal(I.requestSpan(line),'in 37 minutes remind me: inspect the labelled jars');
 assert.equal(choose(line,'reminder',.984),'reminder');
 assert.equal(choose(line,'open/find',.99),'reminder');
});

test('time prefixes retain compact spelling, wall clocks, and literal Unicode',()=>{
 for(const goal of ['in37minutes remind me: inspect Ångström jars 🧪','At 16:45 remind me: open the cabinet','Tomorrow at 10:15 remind me: read the labels']){
  assert.equal(I.requestGoal('The preparation is done; '+goal),goal,goal);
  assert.equal(choose(goal,'open/find'),'reminder',goal);
 }
});

test('reminder payload requests cannot replace the actual reminder act',()=>{
 const line='In 19 minutes remind me: explain why the alarm can change; can you show the timer status?';
 assert.equal(I.requestGoal(line),line);
 assert.equal(choose(line,'ai'),'reminder');
});

test('future student language within literal payloads stays literal',()=>{
 const line='Write a personal note exactly "I will inspect the jars; so I can explain it later".';
 assert.equal(I.requestSpan(line),'Write a personal note exactly "I will inspect the jars; so I can explain it later".');
 assert.equal(I.literalNotePayload(line).text,'I will inspect the jars; so I can explain it later');
});

test('preserve, copy and transcribe with an explicit note destination are local acts',()=>{
 for(const line of ['Preserve the sentence "Return the blue lens" in a new note titled Lens return.','Copy these exact words "Check the Δ scale" into my personal notes.','Please transcribe "Read the café sign" as a new personal note.','Put the sentence "Bring a ruler" into a personal note.']){
  assert.equal(I.literalNoteRequest(line),true,line);
  assert.equal(choose(line,'ai',.99),'note',line);
 }
});

test('literal note titles and payloads preserve original Unicode and interior spacing',()=>{
 const text='Café Δ — don’t “correct” this;  x  +  y 🧪',title='Échantillons Δ';
 const payload=I.literalNotePayload('Preserve the sentence "'+text+'" in a new note titled '+title+'. I need its exact wording.');
 assert.equal(payload.text,text);
 assert.equal(payload.title,title);
 assert.equal(I.requestGoal('Please preserve "'+text+'" in a new personal note.'),'preserve "'+text+'" in a new personal note.');
});

test('a quoted title cannot become the note body',()=>{
 const p=I.literalNotePayload('Create a personal note titled "Café log" containing exactly "Keep the µ label".');
 assert.equal(p.title,'Café log');assert.equal(p.text,'Keep the µ label');
 assert.equal(I.literalNotePayload('Create a note titled "Only a title".'),null);
});

test('single and curly quote payloads retain apostrophes and accented text',()=>{
 const a=I.literalNotePayload('Copy the sentence ‘Don’t alter the café label’ into my notes.');
 assert.equal(a.text,'Don’t alter the café label');
 const b=I.literalNotePayload("Preserve the sentence 'Don't alter Ångström' in a personal note.");
 assert.equal(b.text,"Don't alter Ångström");
});

test('quoted literal padding belongs to the saved text',()=>{
 assert.equal(I.literalNotePayload('Copy "  Café Δ  " into a new note.').text,'  Café Δ  ');
 assert.equal(I.literalNotePayload('Copy "   " into a new note.'),null);
});

test('explanatory note generation and exact teacher retrieval remain distinct',()=>{
 for(const line of ['Create a note explaining the warning in this guide.','Write a note comparing the two mechanisms.']){
  assert.equal(I.literalNoteRequest(line),false,line);assert.equal(choose(line,'ai'),'ai',line);
 }
 assert.equal(choose('Bring back the exact teacher wording; do not rewrite it.','ai'),'open/find');
 assert.equal(I.literalNoteRequest('Copy the original teacher wording.'),false);
 assert.equal(choose('Explain the original teacher wording.','open/find'),'ai');
});

test('literal sentences mentioning generation and controls do not ask for those acts',()=>{
 const line='Preserve the sentence "Explain the alert; then hide the timer" in a new note.';
 assert.equal(choose(line,'ai'),'note');
 assert.equal(I.timerRequest(line,state({focus:{running:true,endsAt:NOW+MIN}})),null);
 assert.equal(I.workflowParts(line).length,1);
});

test('negative literal-copy requests remain guarded even under a confident model',()=>{
 for(const line of ['Do not preserve "Open the cabinet" in a new note.','Never copy "Turn the timer off" into my notes.']){
  assert.equal(I.literalNoteRequest(line),false,line);
  assert.equal(I.literalNotePayload(line),null,line);
  assert.equal(I.negated(line,'note'),true,line);
 }
});

test('learner question acts generate a question even if its payload names factual fields',()=>{
 for(const line of ['Ask me what would count as evidence for a competing account.','Ask what would count as evidence in a fresh mini-case.','Quiz me on when the alarm is useful.','Test us on which assumptions the model makes.','Drill me on the difference between accuracy and precision.'])assert.equal(choose(line,'open/find',.99),'ai',line);
});

test('novel practice shorthand and learner autonomy remain generation',()=>{
 const line='fresh migration mini-case pls 🐦 ask what would count as dispersal evidence';
 assert.equal(choose(line,'ai',.71),'ai');
 assert.equal(choose('Give me a new scenario and let me try before you show the explanation.','open/find'),'ai');
});

test('negative question generation is still a real AI guard',()=>{
 assert.equal(I.negated('Do not ask me a practice question.','ai'),true);
 assert.equal(I.negated('Do not quiz us on this guide.','ai'),true);
 assert.equal(I.negated('Do not ask about the old draft; explain this new argument.','ai'),false);
});

test('recorded questions, example sources and quiz deadlines stay retrieval',()=>{
 for(const line of ['Show the recorded question in the guide.','Find the saved practice examples.','Which quiz asks us to compare two explanations?','Show how many attempts remain.','Open the source containing "quiz me on the warning".'])assert.equal(choose(line,'open/find',.99),'open/find',line);
 assert.equal(choose('Ask my teacher for the published deadline.','open/find'),'open/find');
});

test('qualified Inbox destinations do not navigate to the entire shell',()=>{
 for(const line of ['Show Sent in Inbox.','Open the Inbox composer.','Open that Inbox conversation.','Show the Unread filter in Canvas Inbox.','Open the PDF attached to the Inbox reply.'])assert.equal(choose(line,'navigate',.99),'open/find',line);
});

test('nominal Inbox subpages remain model-owned retrieval',()=>{
 for(const line of ['Starred Inbox','Unread filter in Canvas Inbox','Sent in Inbox'])assert.equal(choose(line,'open/find',.9),'open/find',line);
});

test('bare Inbox shell navigation and unread collection shortcuts still work',()=>{
 for(const line of ['Open Inbox.','Show my Inbox.','Unread inbox','Open unread messages.','Messages non lus'])assert.equal(choose(line,'open/find'),'navigate',line);
});

test('background Inbox nouns cannot own unrelated positive acts',()=>{
 assert.equal(choose('Explain the warning in the Inbox message.','open/find'),'ai');
 assert.equal(choose('In 17 minutes remind me: open the Inbox composer.','navigate'),'reminder');
 assert.equal(choose('Note: show the Unread filter in Inbox.','navigate'),'note');
});

test('hypothetical mutations and Canvas how-to questions retain existing gates',()=>{
 for(const [line,predicted] of [['If I create a note, what happens?','note'],['Suppose I set a warning, when would it appear?','reminder'],['If I bookmark this, what happens?','bookmark']])assert.equal(choose(line,predicted),'none',line);
 assert.equal(choose('How do I submit this assignment?','open/find'),'open/find');
 assert.equal(choose('What time does the published reminder say?','open/find'),'open/find');
});

test('a completed hypothetical sentence cannot veto an independent explanation',()=>{
 assert.equal(choose('If I set a reminder, would it notify me? Please explain the public warning.','open/find'),'ai');
 assert.equal(choose('If the label changes, delete the reminder.','reminder'),'none');
});

test('negative private-field exclusions and requested scopes are retained',()=>{
 assert.equal(choose('Show the next due task, not my private marks.','open/find'),'open/find');
 assert.equal(I.withoutPrivateExclusions('Show the due task without my private grades').includes('grades'),false);
 assert.equal(I.requestSpan('Open the composer so I can explain the delay myself.'),'Open the composer');
 assert.equal(choose('Open the composer so I can explain the delay myself.','ai'),'open/find');
});

test('quote masks and source spans keep current, prior and named references visible',()=>{
 const text='The earlier Inbox conversation has the decision. Explain that warning.';
 const span=I.sourceSpan(text);assert.match(span,/earlier Inbox conversation/);assert.match(span,/Explain that warning/);
 assert.equal(I.requestGoal('Please explain this page.'),'explain this page.');
 assert.equal(I.requestGoal('Could you explain the previous source?'),'explain the previous source?');
 const quote='“Can you remove the reminder?”';assert.equal(I.workflowMask(quote).length,quote.length);assert.doesNotMatch(I.workflowMask(quote),/remove/);
});

test('compound boundaries preserve independent commands and quoted note content',()=>{
 const line='Preserve the sentence "Explain the warning; then hide the timer" in a new note, then bookmark this assignment';
 const parts=I.workflowParts(line);assert.equal(parts.length,2);assert.equal(parts[1].text,'bookmark this assignment');
 assert.equal(I.literalNotePayload(parts[0].text).text,'Explain the warning; then hide the timer');
 assert.equal(I.workflowParts('Note: explain the warning; then hide the timer').length,1);
 assert.equal(choose('Remind me at 08:00; plus 18 minutes on this course at 09:00.','plan'),'plan');
});

test('new copy and temporal-reminder heads retain their own compound steps',()=>{
 assert.equal(I.workflowParts('Bookmark this assignment, then copy "Bring the lens" into my notes').length,2);
 const parts=I.workflowParts('Bookmark this assignment; in 21 minutes remind me: read the label');
 assert.equal(parts.length,2);assert.equal(parts[1].text,'in 21 minutes remind me: read the label');
 assert.equal(I.workflowParts('In 21 minutes remind me: read the label; then bookmark this assignment').length,2);
});

test('deferred controls, typed inspection and direct local commands retain ownership',()=>{
 assert.equal(I.conditionalControl('Later restore the timer module.',{control:true}),true);
 assert.equal(I.requestGoal('Fit audit, contain or cover: find the banner fit chooser before I pick one.'),'find the banner fit chooser before I pick one.');
 const s=state({selectedItemId:'work',assignments:[{id:'work',title:'Observation analysis',courseId:'studio'}],focus:{running:true,endsAt:NOW+10*MIN}});
 assert.equal(choose('Pause the timer.','focus',.99,s),'focus-control');
 assert.equal(choose('Focus on this assignment for 12 minutes.','open/find',.99,s),'focus');
 assert.equal(choose('Mark Observation analysis done.','ai',.99,s),'complete');
 assert.equal(choose('Plan my afternoon.','ai',.99,s),'plan');
 assert.equal(choose('Pin this page.','ai',.99,s),'bookmark');
});

test('selected or prior context is not mutated while deciding ownership',()=>{
 const s=state(),session={lastItemId:'earlier',lastAction:{action:'open/find',itemId:'earlier'}},before=JSON.stringify({s,session});
 choose('Explain the warning on this page.','open/find',.99,s,session);
 assert.equal(JSON.stringify({s,session}),before);
});

test('raw reminder delays still reach the existing exact parser',()=>{
 const P=load('extension/biscuit-parse.js'),raw='The sediment is settling; in 37 minutes remind me: inspect the jars';
 const found=P.localReminder(I.requestGoal(raw),state());
 assert.equal(found[0].fields.title,'inspect the jars');assert.equal(found[0].fields.at,NOW+37*MIN);
 const invalid=P.localReminder(I.requestGoal('in 0 minutes remind me: inspect the jars'),state());assert.equal(invalid.length,0);
});
