'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Kind=require('../extension/study-kind.js');
const now='2026-10-23T15:00:00Z',rubric=[{description:'Explain the claim with evidence.'}],draft='The solution cooled because energy transferred to the surroundings.';
const contexts=[
 {page:'assignment',item:{title:'Calorimetry experiment',type:'lab',hasRubric:true}},
 {page:'assignment',item:{title:'Argument essay',type:'essay',rubric},draft,preference:'rubric'},
 {page:'reader',item:{title:'Read the river article',type:'reading'},preference:'reading'},
 {page:'assignment',item:{title:'Unit quiz',type:'quiz'},preference:'practice'},
 {page:'feedback',item:{title:'Returned report',type:'report'},feedback:{text:'Explain the energy transfer.',returnedAt:'2026-10-22'},now,preference:'fixes'}
];
const requested=(context,shape)=>{
 const result=Kind.inferHelp(context);assert.equal(result.shape,shape,JSON.stringify({context,result}));assert.equal(Kind.requestedHelp(context),shape,JSON.stringify(context));assert.ok(result.confidence>=Kind.HELP_THRESHOLD,JSON.stringify(result));assert.ok(result.sources.includes('typed'));
};

for(const [shape,requests]of [
 ['ask',['What volume did trial two use?','When is my personal due date?','Can I access the starter code?','What should go in the fitness log?','What time is the bus?']],
 ['steps',['Just the setup, please.','Just the setup at the bench.','Help set up the conservation equation.','How do I start?','What comes before recording the results?','Break this into steps.','List the steps.','setup','steps']],
 ['rubric',['Check my draft against the rubric.','Before I upload, check that every requirement is covered.','Check this against the rubric.','Check my draft.']],
 ['practice',['Quiz me.','Quiz me about the setup.','Give me practice questions.','Practice','Test tomorrow help','Help me prepare for the exam.']],
 ['flashcards',['Make three cards.','Cards','Make flashcards.']],
 ['outline',['Outline my report.','Plan my essay.','Help me plan my discussion post.','Plan my talk.','Make an oral cue sheet.','Spanish oral cues, keywords only.']],
 ['message',['Email my teacher about the deadline.','Draft a message to my teacher.']],
 ['fixes',['What should I fix?','Turn the returned feedback into a fix list.']],
 ['lab',['Make a lab checklist.','Bench checklist only.','Help with the pre-lab.','Prelab']],
 ['reading',['Help me understand this reading.','Help me understand the article.','Guide me through the chapter.']]
])for(const typed of requests)test('section C: '+typed+' overrides conflicting item defaults',()=>{
 for(const context of contexts)for(const field of ['typed','question'])requested({...context,[field]:typed},shape);
});

test('section C: an explicit check preserves rubric routing when the rubric and draft are unavailable',()=>{
 const context={typed:'Check my draft against the rubric.',item:{title:'Poster',description:'The rubric is unavailable.'},photos:['Photo of a draft']},before=structuredClone(context),result=Kind.inferHelp(context);
 requested(context,'rubric');assert.deepEqual(context,before);assert.deepEqual(result.sources,['typed','photos']);assert.equal(Object.hasOwn(context,'rubric'),false);assert.equal(Object.hasOwn(context,'draft'),false);
});

test('section C: unclear typed help asks instead of falling through to item or remembered defaults',()=>{
 for(const typed of ['help','Please help.','I need help with this.','???','This one, please.'])for(const context of contexts){const result=Kind.inferHelp({...context,typed});assert.equal(result.shape,'ask',JSON.stringify({typed,context,result}));assert.ok(result.confidence<Kind.HELP_THRESHOLD);}
});

test('section C: rubric evidence alone and a generic reading surface do not request those outputs',()=>{
 for(const context of [{page:'reader'},{page:'pdf',selectedText:'A selected sentence.'},{page:'notes',item:{title:'Untitled work'}},{item:{title:'Essay',type:'essay',rubric},draft},{rubric,preference:'rubric'}])assert.equal(Kind.inferHelp(context).shape,'ask',JSON.stringify(context));
});

for(const [typed,shape]of [
 ["Don't give me steps; make a lab checklist.",'lab'],
 ["Don't make a lab checklist; just the setup.",'steps'],
 ["Don't check the rubric; quiz me.",'practice'],
 ["Don't quiz me; check against the rubric.",'rubric'],
 ["No cards; plan my talk.",'outline'],
 ['Make an oral cue sheet; actually, make cards.','flashcards'],
 ['Make cards; scratch that, make an oral cue sheet.','outline'],
 ['Make a checklist; instead, show the setup.','steps'],
 ['Steps instead of a rubric check.','steps'],
 ['Check against the rubric instead of steps.','rubric'],
 ['Earlier I asked for steps; now make cards.','flashcards'],
 ['What comes before the quiz?','steps'],
 ['When are the oral cue sheets due?','ask'],
 ['Do I need to upload the flashcards?','ask'],
 ['Should I read the rubric before I upload?','ask'],
 ['帮我列一个口语提纲','outline'],
 ['Ayúdame a planear mi respuesta.','outline'],
 ['¿Cómo empiezo?','steps'],
 ['Comment commencer ?','steps'],
 ['不要列口语提纲; quiz me.','practice']
])test('section C: negation, correction, questions and languages: '+typed,()=>requested({...contexts[0],typed},shape));

test('section C: incompatible requests still ask and cancellation does not restore a default',()=>{
 for(const typed of ['Make cards and plan my essay.','Check against the rubric and quiz me.','List the steps; actually, cancel.']){const result=Kind.inferHelp({...contexts[1],typed});assert.equal(result.shape,'ask',JSON.stringify({typed,result}));assert.ok(result.confidence<Kind.HELP_THRESHOLD);}
});

for(const [typed,shape]of [
 ['Quiz me one formula at a time and wait while I explain my answer.','practice'],
 ['Check my outline before I upload and tell me which required parts are actually missing.','rubric'],
 ['Use the teacher feedback to fix my explanation so it matches what the diagram actually shows.','fixes'],
 ['Give me practice questions to see whether I actually remember the method.','practice'],
 ['What required pieces are missing from my proposal?','rubric'],
 ['What are my next edits for the recording?','fixes'],
 ['Help me read this: where do I look in each part?','reading']
])test('section C: substantive intent survives narration and references: '+typed,()=>requested({...contexts[4],typed},shape));

test('section C: routing stays pure and does not inspect private grades, peers or submissions',()=>{
 const item={title:'Returned essay',type:'essay',rubric};for(const key of ['grades','score','grade','points','submission','submissions','classmates','peers'])Object.defineProperty(item,key,{get(){throw Error('private field read: '+key);}});
 const context=Object.freeze({item:Object.freeze(item),typed:'Check this against the rubric.'}),first=Kind.inferHelp(context);assert.equal(first.shape,'rubric');assert.deepEqual(Kind.inferHelp(context),first);
});

for(const [context,typed,shape]of [
 [contexts[0],"Quiz me; actually no, make it a checklist.",'lab'],
 [contexts[0],"Make a checklist, sorry don't include a title.",'lab'],
 [contexts[0],'Put the actions in boxes I can tick as we do them.','lab'],
 [contexts[0],'Lay out what my partner does while I measure, in order.','lab'],
 [contexts[2],'Where do I look in each part?','reading'],
 [contexts[2],'These pages make no sense walk me through them.','reading'],
 [contexts[2],'Break the section into its main ideas and explain the terms as they appear.','reading'],
 [contexts[3],'Give me examples where I name the category and explain my choice. Hold answers till the end.','practice'],
 [contexts[4],'redo','fixes'],
 [contexts[1],'check','rubric']
])test('section C: natural task wording retains a specific request: '+typed,()=>requested({...context,typed},shape));
