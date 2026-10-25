'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),I=require('../extension/biscuit-intent.js');
const snapshot=patch=>({courses:[{id:'course',name:'Comparative Literature'}],assignments:[{id:'work',title:'Compare two narrators',courseId:'course'}],pages:[{id:'source',title:'Reading extract',text:'A public extract comparing the narrator with the speaker, with the original wording and its stated publication details.'}],selectedItemId:'source',...patch}),choose=(line,predicted='open/find',s=snapshot(),probability=.9)=>I.choose(line,s,{},predicted,probability);

test('planning requires allocating or choosing work rather than mentioning a schedule',()=>{
 for(const line of ['Plan my afternoon','Please allocate study time','Split preparation across three evenings','Put study blocks around dinner','Choose which assignment I should start','Protect 18 minutes for this course at 16:00'])assert.equal(I.scheduleRequest(line),true,line);
 for(const line of ['The lesson plan lists the chapters.','How do I plan a presentation?','Schedule a reminder in 12 minutes.','Can you explain why these numbers fit together?','The worksheets are spread out while I check the instructions.','Fit more cards on this screen.','Show the current study plan.','Which task is shorter and due earlier?'])assert.equal(I.scheduleRequest(line),false,line);
 assert.equal(choose('Explain why the numbers fit together.','ai'),'ai');
 assert.equal(choose('Fit more cards on this screen.','setting'),'setting');
 assert.equal(choose('Schedule a reminder in 12 minutes.','plan'),'reminder');
 assert.equal(choose('Remind me at 08:00; plus 12 minutes on this course at 09:00.','plan'),'plan');
});

test('verb polarity is scoped to each occurrence and preserves note payloads',()=>{
 for(const line of ['Do not save the old link; save this page.','Save this page, do not save the old link.','Save this page dont save the old link.']){assert.equal(I.positive(line,'bookmark'),true,line);assert.equal(I.negated(line,'bookmark'),false,line);}
 for(const line of ['Can you not disable the feature?','I do not want you to disable the feature.']){assert.equal(I.positive(line,'feature'),false,line);assert.equal(I.negated(line,'feature'),true,line);}
 assert.equal(I.positive('Please do not save or pin that source.','bookmark'),false);
 assert.equal(I.negated('Please do not save or pin that source.','bookmark'),true);
 assert.equal(I.negated('Do not compare these approaches.','ai'),true);
 assert.equal(choose('Note: do not explain or plan this sentence.','ai'),'note');
 assert.equal(choose('Write these exact words into a personal note: remember the original wording.','ai'),'note');
 assert.equal(I.positive('Write this in my own notes: ask about the source.','note'),true);
});

test('manual next steps and background confusion do not become AI instructions',()=>{
 for(const line of ['Please open the message composer so I can write the explanation myself.','I keep mixing the documents, so could you show the published instructions before I revise the draft?','Show the points I earned so I can write the result down.','Can you show how many attempts remain?'])assert.equal(choose(line,'ai'),'open/find',line);
 for(const line of ['My extension?','Updated venue?','Assigned reviewer?','Edition?','The quiz closes?'])assert.equal(choose(line,'open/find',snapshot(),.72),'open/find',line);
 assert.equal(choose('Find useful lecture notes.','ai'),'ai');
 assert.equal(choose('Read this with me and explain the contrast.','ai'),'ai');
 assert.equal(choose('Explain the rubric.','open/find'),'ai');
 assert.equal(choose('Draft outline deadline?','open/find',snapshot(),.72),'open/find');
});

test('conceptual comparisons and causal questions differ from recorded comparisons',()=>{
 for(const line of ['Compare two methods for establishing a causal claim.','Could you contrast these theories?','Two typefaces or one for a poster: which would improve readability?','The input doubles but the output triples, why does this happen?'])assert.equal(choose(line,'open/find'),'ai',line);
 for(const line of ['Compare the two published due dates.','Compare the recorded grades.','Compare the saved counts.','Which assignment asks us to compare two theories?','Show why the quiz is locked.'])assert.equal(choose(line,'open/find'),'open/find',line);
});

test('course destinations and saved plans use available context without changing factual requests',()=>{
 assert.equal(choose('Open Comparative Literature.'),'navigate');
 assert.equal(choose('Show the deadline for Comparative Literature.'),'open/find');
 assert.equal(choose('Show materials library.','navigate'),'navigate');
 assert.equal(choose('Show grades.','setting'),'setting');
 assert.equal(choose('Display the existing study plan.','plan',snapshot({planner:[{id:'block',title:'Reading time'}]})),'navigate');
 const s=snapshot({pages:[{id:'source',title:'Saved planner',text:'An existing saved study plan.'}],planner:[{id:'block',title:'Reading time'}]});
 assert.equal(choose('Open the saved planner.','plan',s),'open/find');
});

test('saving a source has an explicit bookmark meaning and keeping focus does not',()=>{
 for(const line of ['Pin this page.','Save this thread so I can return to it.','Please retain this event in my saved links.','Keep.','Shelve.'])assert.equal(choose(line,'open/find'),'bookmark',line);
 assert.equal(choose('Keep focus on the task.','focus'),'focus');
 assert.equal(choose('Find the saved bookmark, not a new save.','open/find',snapshot(),.55),'open/find');
 assert.equal(choose('Keep.','none',snapshot({selectedItemId:''})),'none');
});

test('starting named work and controlling an existing clock remain distinct',()=>{
 const s=snapshot({selectedItemId:'work',focus:{running:true,remainingMinutes:8}});
 assert.equal(choose('Focus on the selected work for 12 minutes.','focus-control',s),'focus');
 assert.equal(choose('Start 12 minutes on this task.','open/find',s),'focus');
 assert.equal(choose('Add 5 minutes to the current focus session.','focus',s),'focus-control');
 assert.equal(choose('Pause that timer.','focus',s),'focus-control');
 assert.equal(choose('Begin a 3-minute break.','focus',s),'focus-control');
 assert.equal(choose('Begin a 3-minute break.','focus-control',snapshot({focus:{running:false,minutes:25}})),'focus');
 assert.equal(I.positive('Start 12 minutes on this task.','focus'),true);
});

test('explicit conversation and retraction leave uncertain source phrases with the model',()=>{
 assert.equal(choose('I am only venting, not asking for a study plan.','plan'),'none');
 assert.equal(choose('Virtual high-five.','open/find',snapshot(),.5),'chat');
 assert.equal(choose('What can you do?','open/find',snapshot(),.5),'chat');
 assert.equal(choose('Unclear source phrase.','none',snapshot(),.3),'none');
 assert.equal(choose('If I bookmark this, what happens?','bookmark'),'none');
 assert.equal(choose('How do I explain this contrast?','open/find'),'ai');
});
