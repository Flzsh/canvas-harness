'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Kind=require('../extension/study-kind.js');

const contexts=[
 ['no item',{}],
 ['Spanish oral',{item:{title:'Spanish oral response',type:'assignment'},preference:'steps'}],
 ['French speech',{item:{title:'French speech',type:'presentation'},preference:'steps'}],
 ['Chinese oral assessment',{item:{title:'中文口语考试',type:'quiz'},preference:'practice'}],
 ['reading',{page:'reader',item:{title:'Read the article',type:'reading'},preference:'reading'}],
 ['lab',{item:{title:'Dilution experiment',type:'lab'},preference:'lab'}],
 ['returned draft',{
  item:{title:'Returned essay',type:'essay',rubric:[{description:'Support the claim.'}]},
  draft:'The evidence supports the claim because both measurements increased.',
  feedback:{text:'Explain the second measurement.',returnedAt:'2026-10-22'},
  now:'2026-10-23T15:00:00Z',preference:'fixes'
 }]
];

function requested(context,shape){
 const decision=Kind.inferHelp(context),label=JSON.stringify({context,decision});
 assert.equal(decision.shape,shape,label);
 assert.equal(Kind.requestedHelp(context),shape,label);
 assert.ok(decision.confidence>=Kind.HELP_THRESHOLD,label);
 assert.ok(decision.sources.includes('typed'),label);
}
function uncertain(context){
 const decision=Kind.inferHelp(context),label=JSON.stringify({context,decision});
 assert.equal(decision.shape,'ask',label);
 assert.equal(Kind.requestedHelp(context),'',label);
 assert.ok(decision.confidence<Kind.HELP_THRESHOLD,label);
}

// These explicit choices must survive item defaults and either user-input field.
for(const [shape,requests]of [
 ['outline',[
  'esquema','ESQUEMA','esquema pa hablar','esquema para hablar',
  'Necesito un esquema para mi presentación.','Hazme un esquema.',
  'plan','un plan','plan de discours','un plan pour mon discours',
  'Fais un plan de mon discours.','Préparer un plan.','Aide-moi à faire un plan.',
  '提纲','大纲','口语提纲','演讲大纲','帮我列一个口语提纲','请给我一个大纲'
 ]],
 ['flashcards',[
  'tarjetas','TARJETAS','tarjetas de estudio','Hazme tarjetas.','tarjetas de repaso',
  'fichas de estudio','cartes','cartes de révision','Fais des cartes mémoire.',
  '卡片','记忆卡片','单词卡','帮我做词汇卡片'
 ]],
 ['steps',[
  'pasos','los pasos','Dame los pasos.','étapes','les étapes',
  'Montre-moi les étapes.','步骤','给我步骤','一步一步'
 ]],
 ['practice',[
  'practicar','Quiero practicar.','Vamos a practicar.','práctica',
  'Hazme preguntas.','Hazme un quiz.','Pregúntame.','Ponme a prueba.',
  'Ponme preguntas.','Examíname.','Interrógame.',
  'entraînement','Entraîne-moi.','Pose-moi des questions.',
  'Fais-moi un quiz.','Interroge-moi.','Teste-moi.',
  '练习','我要练习','考考我','测测我','向我提问','问我问题'
 ]],
 ['summary',['resumen','Resume esto.','résumé','Résume ceci.','总结','帮我总结','摘要']],
 ['reading',['guía de lectura','guide de lecture','阅读指南']],
 ['lab',['lista de laboratorio','liste de vérification pour le labo','实验清单']],
 ['rubric',['Revisa mi borrador.','Vérifie mon brouillon.','检查我的草稿']],
 ['fixes',['Corrige mi respuesta.','Corrige ma réponse.','修改我的答案']],
 ['message',['mensaje al profesor','Écris un message au professeur.','给老师写邮件']],
 ['ask',['Explícame esto.','Explique-moi cela.','解释这个']]
])for(const typed of requests)test('multilingual explicit '+shape+': '+typed,()=>{
 for(const [,context]of contexts)for(const field of ['typed','question'])requested({...context,[field]:typed},shape);
});

for(const [typed,shape]of [
 ["Don't make tarjetas; esquema pa hablar instead.",'outline'],
 ["No esquema; tarjetas instead.",'flashcards'],
 ["Don't give me pasos; practicar instead.",'practice'],
 ["Do not practicar; pasos instead.",'steps'],
 ['Sin tarjetas; esquema.','outline'],
 ['Sin esquema; practicar.','practice'],
 ['No quiero tarjetas; quiero practicar.','practice'],
 ['Sans cartes de révision; plan de discours.','outline'],
 ['Pas de plan de discours; tarjetas.','flashcards'],
 ['不要卡片; 提纲','outline'],
 ['不要提纲; 卡片','flashcards'],
 ['不用步骤; 练习','practice'],
 ['别练习; 步骤','steps'],
 ['Tarjetas; actually, esquema pa hablar.','outline'],
 ['Esquema; scratch that, practicar.','practice'],
 ['Practicar; actually, pasos.','steps'],
 ['Plan de discours; wait, tarjetas.','flashcards'],
 ['卡片; actually, 提纲','outline'],
 ['提纲; scratch that, 卡片','flashcards'],
 ['Tarjetas actually esquema pa hablar.','outline'],
 ['Esquema actually practicar.','practice'],
 ['Quiz me actually plan de discours.','outline'],
 ['Tarjetas actually 步骤','steps'],
 ['Tarjetas actually práctica.','practice'],
 ['Make cards actually dame los pasos.','steps'],
 ['Tarjetas instead of esquema.','flashcards'],
 ['Esquema instead of tarjetas.','outline'],
 ['Earlier I asked for tarjetas; now practicar.','practice'],
 ['Earlier I asked for practicar; now esquema.','outline'],
 ['Esquema; actually, quiz me.','practice'],
 ['Make cards; actually, plan de discours.','outline'],
 ['Tarjetas de práctica.','flashcards'],
 ['练习卡片','flashcards'],
 ['Esquema and help me understand it.','outline'],
 ['Revisa mi borrador and help me understand it.','rubric'],
 ['Check my esquema against the rubric.','rubric'],
 ['Check my plan de discours against the rubric.','rubric'],
 ['When are the tarjetas due?','ask'],
 ['Do I need to upload the plan de discours?','ask']
])test('multilingual choices preserve negation and precedence: '+typed,()=>{
 for(const [,context]of contexts)requested({...context,typed},shape);
});

for(const typed of [
 'Esquema and practicar.','Practicar and esquema.',
 'Quiz me and esquema.','Esquema and quiz me.',
 'Pasos; actually, cancel.','Tarjetas; scratch that.',
 "Don't give me tarjetas.",'Sin tarjetas.','Sans cartes de révision.',
 '不要卡片','不要提纲','别练习',
 'Sin tarjetas ni pasos.','Sans cartes de révision ni plan de discours.',
 '不要卡片和提纲','不用步骤或练习','不想要卡片','Sin práctica.',
 'The word tarjetas.','Earlier I asked for esquema.'
])test('multilingual ambiguous, historical and cancelled choices ask: '+typed,()=>{
 for(const [,context]of contexts)uncertain({...context,typed});
});

for(const [typed,shape]of [
 ['Plan my presentation.','steps'],
 ['Help me plan my practice log.','steps'],['Reading plan.','reading'],
 ['Plan my essay.','outline'],['Plan my talk.','outline'],
 ['Check my plan against the rubric.','rubric'],
 ['Explain the plan.','ask'],['What is the plan for tomorrow?','ask'],
 ['Quiz me.','practice'],['Make flashcards.','flashcards'],
 ['Steps.','steps'],['Make a lab checklist.','lab'],
 ['Make an oral cue sheet.','outline'],['Make a reading guide.','reading'],
 ['Summarize the announcements.','summary'],['Email my teacher.','message']
])test('multilingual additions preserve English requests: '+typed,()=>{
 for(const [,context]of contexts)requested({...context,typed},shape);
});

test('English project planning retains its existing context-free steps route',()=>requested({typed:'Plan my project.'},'steps'));

for(const typed of [
 'I have a plan.','We plan to meet tomorrow.','The lesson plan is attached.',
 'The floor plan is attached.','A planetary model.','The airplane arrived.',
 'esquematico','tarjetasextra','pasoslargos','practicarlo','cartesien'
])test('multilingual tokens stay bounded: '+typed,()=>uncertain({typed}));

test('item text alone does not become an explicit multilingual request',()=>{
 const context={item:{title:'esquema tarjetas pasos practicar 提纲 卡片 步骤 练习',type:'assignment'}};
 assert.equal(Kind.requestedHelp(context),'');
 assert.equal(Kind.inferHelp(context).shape,'ask');
});

test('multilingual inference is pure with frozen context and deterministic without external services',()=>{
 const context=Object.freeze({
  typed:'帮我做词汇卡片',preference:'rubric',
  item:Object.freeze({title:'French speech',type:'presentation'})
 }),before=JSON.stringify(context),first=Kind.inferHelp(context);
 requested(context,'flashcards');
 assert.deepEqual(Kind.inferHelp(context),first);
 assert.equal(JSON.stringify(context),before);
});
