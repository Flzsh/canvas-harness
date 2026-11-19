'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Kind=require('../extension/study-kind.js');
const now='2026-10-23T15:00:00Z',rubric=[{description:'Use evidence and explain each source.'}],draft='The amendment protects equal treatment under the law.';
const contexts={
 quiz:{page:'assignment',item:{id:'q',title:'Unit quiz',type:'quiz',instructions:'Two attempts; the average counts.'}},
 exam:{page:'assignment',item:{id:'e',title:'Unit exam',type:'test'}},
 writing:{page:'assignment',item:{id:'w',title:'Annotated bibliography',type:'essay',instructions:'Write an annotation for each source.',rubric},draft},
 discussion:{page:'assignment',item:{id:'d',title:'Chapter discussion',type:'discussion',submissionTypes:['discussion_topic'],instructions:'Write an initial post and reply to classmates.'}},
 reading:{page:'reader',item:{id:'r',title:'Read chapter 4',type:'reading'},selectedText:'Equal protection of the laws.'},
 review:{page:'notes',item:{id:'n',title:'Chapter notes',courseId:'c'},now,nextAssessment:{title:'Unit test',courseId:'c',dueAt:'2026-10-24T15:00:00Z'},preference:'practice'},
 returned:{page:'feedback',item:{id:'f',title:'Returned quiz',type:'quiz'},now,feedback:{text:'Review the explanation and improve your next attempt.',returnedAt:'2026-10-22T15:00:00Z'},preference:'fixes'},
 lab:{page:'assignment',item:{id:'l',title:'Pre-lab quiz',type:'lab',instructions:'Latest attempt counts; prepare the equipment.'}}
};
const confident=(context,shape)=>{const result=Kind.inferHelp(context);assert.equal(result.shape,shape,JSON.stringify({context,result}));assert.ok(result.confidence>=0.8,JSON.stringify(result));assert.ok(result.sources.includes('typed'),JSON.stringify(result));assert.equal(Kind.requestedHelp(context),shape,JSON.stringify(context));};
const questions=['should i retake the quiz','can i retake to get better','is this worth doing','when is the bibliography due','is it worth it','do i have to do this','what happens if i skip it','how many tries do i get'];
for(const [name,context]of Object.entries(contexts))for(const question of questions)test('direct question overrides '+name+' context: '+question,()=>{for(const field of ['typed','question'])for(const value of [question,question.toUpperCase()+'?'])confident({...context,[field]:value},'ask');});

for(const typed of ['should we submit it today','could i try again tomorrow','is the discussion required','does this count toward completion','when do replies close','where is the deadline listed','what happens if we submit late','how many attempts are allowed','how often can we retry','may i hand it in late','would i lose credit if i skipped the reading','do we need to finish the chapter','when is the reading guide due','when are the flashcards due','should i do practice questions'])test('question grammar handles related wording: '+typed,()=>{for(const context of Object.values(contexts))confident({...context,typed},'ask');});

for(const [name,typed,shape]of [
 ['quiz','can i get three practice questions','practice'],
 ['reading','could we have practice problems with the answers hidden','practice'],
 ['quiz','can you quiz me about whether i should retake','practice'],
 ['reading','could i have a reading guide','reading'],
 ['quiz','can you guide me through the reading','reading'],
 ['reading','can i get a summary of the chapter','reading'],
 ['reading','can i get notes outline','notes'],
 ['writing','can you outline my essay','outline'],
 ['reading','can i have flashcards','flashcards'],
 ['returned','can i get a prioritized to-do list from their notes','fixes'],
 ['returned','could you repair the returned spreadsheet','fixes'],
 ['writing','did i get all the parts in','rubric'],
 ['writing','does my draft meet the requirements','rubric'],
 ['lab','can i get a checklist for the lab','lab'],
 ['lab','what order do i do the lab steps','lab'],
 ['lab','where do i even start','steps'],
 ['writing','where do i start','steps'],
 ['writing','how long will this take','steps'],
 ['returned','what did i get wrong','fixes'],
 ['returned','where did i go wrong','fixes'],
 ['reading','what did i miss','summary'],
 ['writing','could i get an email to my teacher','message'],
 ['writing','can you summarize the announcements','summary'],
 ['writing','when is the bibliography due and outline my essay','outline'],
 ['reading','should i retake the quiz and give me a reading guide','reading']
])test('question wording preserves an explicit '+shape+' request: '+typed,()=>confident({...contexts[name],typed},shape));

for(const [typed,shape]of [
 ["don't quiz me; should i retake the quiz?",'ask'],
 ["don't summarize the chapter; when is the bibliography due?",'ask'],
 ['quiz me; actually, should i retake the quiz?','ask'],
 ['make a reading guide; scratch that, is it worth it?','ask'],
 ['should i retake the quiz; actually, quiz me','practice'],
 ['when is the bibliography due; scratch that, summarize the chapter','reading'],
 ['should i retake the quiz; give me practice questions instead','practice'],
 ['quiz me; should i retake the quiz instead?','ask'],
 ['when is the bibliography due; instead, make flashcards','flashcards'],
 ["don't explain it; quiz me",'practice'],
 ['earlier i asked when the bibliography is due; now quiz me','practice'],
 ['i used to ask whether i should retake; make a reading guide','reading']
])test('direct-question routing respects negation and corrections: '+typed,()=>confident({...contexts.returned,typed},shape));
