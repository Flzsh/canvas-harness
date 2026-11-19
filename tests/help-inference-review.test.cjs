'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Kind=require('../extension/study-kind.js');
const now='2026-10-22T15:00:00Z',reminder='Remember to ask about this.',draft='A higher temperature speeds diffusion because the particles move faster. The concentration gradient determines the net direction of movement.',rubric=[{description:'Explain the mechanism and support the claim with evidence.',points:4}];
const work={page:'assignment',item:{id:'budget',title:'Returned household budget',type:'spreadsheet'},now,feedback:{text:'Rows 4 and 9 use the wrong rate. Revise those formulas.',returnedAt:'2026-10-21T15:00:00Z'}},blank={page:'assignment',item:{id:'new',title:'Untitled work',type:'assignment'}},lab={page:'assignment',item:{title:'Dilution experiment',type:'lab'}};
const confident=(context,shape)=>{const result=Kind.inferHelp(context);assert.equal(result.shape,shape,JSON.stringify(context));assert.ok(result.confidence>=Kind.HELP_THRESHOLD,JSON.stringify(result));return result;},undecided=context=>{const result=Kind.inferHelp(context);assert.ok(result.confidence>=0&&result.confidence<Kind.HELP_THRESHOLD,JSON.stringify({context,result}));return result;},noRubric=context=>{const result=Kind.inferHelp(context);assert.notEqual(result.shape,'rubric',JSON.stringify({context,result}));return result;};

for(const typed of [
 'Help me fix the returned spreadsheet and understand the comments.',
 'Help me understand the comments and repair the returned spreadsheet.',
 'Repair the returned spreadsheet. I do not understand the incorrect formulas.',
 'Please revise my returned spreadsheet so the feedback is easier to understand.'
])test('review 6: concrete returned-work repair outranks generic understanding: '+typed,()=>{const result=confident({...work,typed},'fixes');assert.ok(result.sources.includes('typed'));});
test('review 6: question input uses the same specificity rules as typed input',()=>confident({...work,question:'Correct the returned spreadsheet and help me understand the comments.'},'fixes'));
test('review 6: understanding feedback alone remains a direct explanation request',()=>confident({...work,typed:'Help me understand the teacher comments.'},'ask'));
test('review 6: repair remains an explicit intent when feedback collection is off',()=>confident({...work,teacherFeedback:false,typed:'Repair the returned spreadsheet and help me understand the mistake.'},'fixes'));

for(const [context,typed,shape]of [
 [blank,'Quiz me and help me understand the topic.','practice'],
 [blank,'Summarize the article and help me understand it.','reading'],
 [lab,'Make a checklist for the experiment and help me understand it.','lab'],
 [{...blank,draft,rubric},'Check my draft against the rubric and help me understand the result.','rubric']
])test('review 6: generic understanding does not replace the requested '+shape+' output',()=>confident({...context,typed},shape));

for(const [context,first,second]of [
 [blank,'Quiz me','Summarize the chapter'],
 [work,'Repair the returned spreadsheet','Quiz me'],
 [{...blank,draft},'Check my draft','Summarize the article'],
 [lab,'Make a checklist for the experiment','Quiz me'],
 [work,'Explain why the denominator changes','Repair the returned spreadsheet']
])for(const [a,b]of [[first,second],[second,first]])for(const join of [' and ','; '])test('review 6: equally specific incompatible requests defer regardless of order: '+a+join+b,()=>undecided({...context,typed:a+join+b+'.'}));
test('review 6: ambiguous explicit requests stay below threshold despite feedback, rubric, draft and preference',()=>undecided({...work,draft,rubric,preference:'fixes',typed:'Repair the returned spreadsheet or quiz me.'}));

for(const [context,typed,shape]of [
 [work,"Don't quiz me; repair the returned spreadsheet.",'fixes'],
 [work,"Don't summarize the article; repair the returned spreadsheet.",'fixes'],
 [{...work,draft},"Don't check my draft; repair the returned spreadsheet.",'fixes'],
 [lab,"Don't make a checklist; quiz me.",'practice'],
 [work,"Don't repair the returned spreadsheet; quiz me.",'practice'],
 [work,"Don't explain it; repair the returned spreadsheet.",'fixes'],
 [work,"Don't quiz me or summarize the article; repair the returned spreadsheet.",'fixes']
])test('review 6: denied intents do not create a tie or override a positive request: '+typed,()=>confident({...context,typed},shape));
for(const [typed,shape]of [
 ['Quiz me; actually, repair the returned spreadsheet.','fixes'],
 ['Repair the returned spreadsheet; actually, just explain it.','ask'],
 ['Summarize the chapter; scratch that, quiz me.','practice'],
 ['Quiz me instead of a summary.','practice']
])test('review 6: explicit corrections resolve earlier requests: '+typed,()=>confident({...work,typed},shape));
for(const context of [lab,{...lab,now,feedback:{text:'Check units',returnedAt:'2026-10-22'}}])test('review 6: trailing instead preserves a complete correction over lab and feedback signals: '+JSON.stringify(context),()=>confident({...context,typed:'quiz me instead'},'practice'));
for(const typed of ['Repair the returned spreadsheet. Quiz me instead.','Repair the returned spreadsheet; instead, quiz me.','Repair the returned spreadsheet instead quiz me.'])test('review 6: instead replaces the earlier request with the specified alternative: '+typed,()=>confident({...work,typed},'practice'));
for(const [typed,shape]of [['Quiz me and give me three practice questions.','practice'],['Summarize the article and give me its main ideas.','reading']])test('review 6: compatible requests for one output stay confident: '+typed,()=>confident({...blank,typed},shape));

for(const context of [{...blank,draft:reminder},{...blank,item:{...blank.item,draft:reminder}},{...blank,draft:'   '}])test('review 7: reminder-only or empty draft does not force rubric: '+JSON.stringify(context),()=>{assert.equal(undecided(context).shape,'ask');});
for(const [context,shape]of [
 [{page:'reader',item:{title:'Read the river delta article',type:'reading'},draft:reminder},'reading'],
 [{...lab,draft:reminder},'lab'],
 [{...blank,item:{title:'Cell division quiz',type:'quiz'},draft:reminder},'practice'],
 [{...work,draft:reminder},'fixes']
])test('review 7: reminder text preserves actual '+shape+' work signals',()=>confident(context,shape));
for(const typed of ['', 'Help.', 'Help me understand this.'])test('review 7: substantive draft still needs a check request when rubric evidence is absent: '+typed,()=>noRubric({...blank,draft,typed}));
for(const typed of ['Check this.','Review it.','Look over this.','Is anything missing?'])test('review 7: an unspecified check does not turn a reminder into substantive work: '+typed,()=>noRubric({...blank,draft:reminder,typed}));
test('section C: an explicit draft check keeps its shape despite a reminder-only draft',()=>{const result=confident({...blank,draft:reminder,typed:'Check my draft.'},'rubric');assert.ok(!result.sources.includes('draft'));});
test('section C: an unattached draft is a gap for the requested check',()=>{const result=confident({...blank,typed:'Check my draft.'},'rubric');assert.ok(!result.sources.includes('draft'));assert.ok(!result.sources.includes('rubric'));});

for(const typed of ['Check this.','Review it.','Look over this.','Assess my answer.','Evaluate my work.','Compare my answer against the criteria.','Score my answer.','Grade my answer.','Proofread my draft.'])test('review 7: substantive work plus a checking request supports rubric: '+typed,()=>confident({...blank,draft,typed},'rubric'));
test('review 7: item draft is substantive evidence for a checking request',()=>confident({...blank,item:{...blank.item,draft},typed:'Check this.'},'rubric'));
test('review 7: a brief substantive answer is not mistaken for a reminder',()=>confident({...blank,draft:'Friction opposes the direction of motion.',typed:'Review my answer.'},'rubric'));
for(const evidence of [{rubric},{item:{...blank.item,rubric}},{item:{...blank.item,hasRubric:true}}])test('section C: rubric evidence supports a requested check but does not request it: '+JSON.stringify(evidence),()=>{const context={...blank,...evidence,draft:reminder};assert.equal(undecided(context).shape,'ask');confident({...context,typed:'Check this against the rubric.'},'rubric');});
test('section C: labeled criteria support a requested check but do not request it',()=>{const context={...blank,item:{...blank.item,instructions:'Criteria: explain the mechanism and support your claim with evidence.'},draft:reminder};assert.equal(undecided(context).shape,'ask');confident({...context,typed:'Check this against the criteria.'},'rubric');});
test('review 7: instructions saying no rubric is available do not supply rubric evidence',()=>noRubric({...blank,item:{...blank.item,instructions:'No rubric is available.'},draft:reminder}));
for(const evidence of [{rubric:[]},{rubric:{}},{item:{...blank.item,rubric:[]}},{item:{...blank.item,hasRubric:false}}])test('review 7: empty rubric data is not rubric evidence: '+JSON.stringify(evidence),()=>{assert.equal(undecided({...blank,...evidence,draft:reminder}).shape,'ask');});
for(const title of ['Essay','Report'])test('review 7: writing title alone does not supply rubric evidence: '+title,()=>noRubric({...blank,item:{...blank.item,title},draft:reminder}));
test('review 7: a writing instruction alone does not supply rubric criteria',()=>noRubric({...blank,item:{...blank.item,instructions:'Write a paragraph about the river.'},draft:reminder}));
for(const preference of [{preference:'rubric'},{preferences:{assignment:'rubric'}}])test('review 7: remembered rubric preference does not manufacture missing evidence: '+JSON.stringify(preference),()=>noRubric({...blank,...preference,draft:reminder}));
test('review 7: a photo description alone does not supply rubric or substantive draft evidence',()=>noRubric({...blank,photos:['Photo of my essay draft']}));
test('section C: a photo label preserves the requested check without establishing a draft',()=>{const result=confident({...blank,photos:['Photo of my essay draft'],typed:'Check my draft.'},'rubric');assert.ok(!result.sources.includes('draft'));});
test('review 7: rejecting draft checking also blocks rubric fallback without an alternative request',()=>noRubric({...blank,draft,rubric,typed:"Don't check my draft."}));
test('review 7: explicit rejection of checking is respected with substantive draft and rubric evidence',()=>confident({...blank,draft,rubric,typed:"Don't check my draft; explain why diffusion speeds up."},'ask'));
