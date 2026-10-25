#!/usr/bin/env node
'use strict';
/* R6 scoring retained from reference SHA-256 03863564a705605db32b749d33d57bdfe88e33c3e50e245704cbd4f6b935eab4. Public validation is read-only and explicitly selected at runtime. */
const fs=require('node:fs'),path=require('node:path'),E=require('./biscuit-eval.cjs'),L=require('./biscuit-labels.cjs'),R5=require('./biscuit-r5-eval.cjs'),Short=require('./biscuit-short-policy.cjs');
const ROOT=R5.ROOT,TIERS=R5.TIERS,own=(value,key)=>Object.hasOwn(value,key),record=value=>!!value&&typeof value==='object'&&!Array.isArray(value),pct=R5.pct;
const SCORING=Object.freeze({top1:'Qualifying top1 retains legacy action/target top1 for single-action rows. Fully labelled compounds require every executable action, target, declared field and pipeline label. firstAction retains the separate legacy scores.',compound:'Explicit expected.actions (aliases operations/steps or batch.fields.steps) and unambiguous exact pending queues on compound-tagged independent/turn1 requests label workflows. Ordered by default; ordered:false requires a one-to-one match. Missing, extra, malformed or inconsistent executable steps fail. Cards/top3 and expected.alternatives never supply steps.',coverage:'Under the owner override, only compound-tagged rows with no turn or turn1 promote exact pending action/field labels. Conditional when/manualOperation records, unknown queue semantics and turn2/3 queues remain partial. No steps are inferred from text or predictions. Partial workflows have no completion-accuracy denominator.',episodes:'Three independent supplied snapshots are evaluated once per turn. An episode succeeds only when all three labelled turns satisfy top1, fields and declared pipeline labels. This does not establish runtime replay or completion of unlabelled pending work.',session:'Inference excludes expected, coverageEvidence and pendingOperations recursively. Original session evidence is retained only in evaluationSession for coverage accounting.',primary:'Supplemental public control rows are excluded from primary, including controlId rows in the new short source. Prior heldout split names are preserved; the separately reserved validation directory is never training.',short:'1-4 whitespace words; long=9+. Every diagnostic retains short primary/action/strict fields. Explicit ambiguous short labels require actual clarification or 2-3 legitimate choices with no executable guessed action.',privacy:'Residuals contain aggregate counters, canonical Help kinds and fixed steps only. Source/episode text, target IDs, prompts and exception contents are not copied to reports.'});
function fail(message){throw R5.error('BISCUIT_R6_SCHEMA',message);}
function isPrimary(row){return !Short.supplemental(row);}
function canonicalRow(source){
 const row=L.convertRow(require('./biscuit-capability-labels.cjs').row(source),{shareWorld:true}),session=row.evaluationSession||row.session||{},queue=session.pendingOperations,turn=session.turn??row.turn,tags=row.tags||[];
 if(row.expected.actions||!tags.some(value=>typeof value==='string'&&value.startsWith('compound:'))||!Array.isArray(queue)||!queue.length)return row;
 if(turn!==undefined&&turn!==1)return {...row,pendingLabelStatus:'continuation-only'};
 const known=new Set(['action','itemId','fields','route','context','help','order']);
 if(queue.some(value=>!record(value)))fail('Invalid pending operation');
 if(queue.some(value=>Object.keys(value).some(key=>!known.has(key))))return {...row,pendingLabelStatus:'conditional-or-manual'};
 const counts=tags.filter(value=>/^compound:\d+$/.test(value)).map(value=>Number(value.slice(9)));if(counts.some(value=>value!==queue.length+1))fail('Compound count conflicts with exact queue');
 const steps=queue.map((value,index)=>{if(typeof value.action!=='string'||!L.ACTIONS.includes(L.normalizeAction(value.action))||own(value,'fields')&&!record(value.fields)||own(value,'order')&&value.order!==index+2)fail('Invalid exact pending action or order');const step=require('./biscuit-capability-labels.cjs').expected(value);delete step.order;return step;});
 const legacyExpected=structuredClone(row.expected),expected={...row.expected,actions:[structuredClone(row.expected),...steps]};delete expected.alternatives;
 const converted=L.convertRow({...row,expected},{shareWorld:true});return {...converted,legacyExpected,pendingLabelStatus:'exact-queue-promoted'};
}
function firstExpected(row){
 if(row.legacyExpected)return row.legacyExpected;const variants=L.compoundVariants(row.expected);if(!variants)return row.expected;
 const root={...row.expected};delete root.actions;delete root.ordered;delete root.alternatives;
 const choices=variants.flatMap(value=>L.expectedVariants({...root,...value.actions[0]})),[first,...alternatives]=choices;return {...first,...(alternatives.length?{alternatives}:{})};
}
function validateRows(data,rows,options={}){
 const ids=new Set(),episodes=new Map();
 for(const row of rows){
  if(!record(row)||typeof row.id!=='string'||!row.id||!['tune','heldout'].includes(row.split)||typeof row.line!=='string'||!record(row.moment)||!row.world||!record(row.expected)||own(row,'session')&&!record(row.session))fail('Invalid situation metadata');
  const key=JSON.stringify([row.source||'',row.id]);if(ids.has(key))fail('Duplicate situation identity');ids.add(key);
  if(own(row,'tags')&&(!Array.isArray(row.tags)||row.tags.some(value=>typeof value!=='string'||/^(?:family|need|control|feature):(?:__proto__|prototype|constructor)$/.test(value))))fail('Invalid tags');
  if(own(row,'source')&&(typeof row.source!=='string'||!row.source||['__proto__','prototype','constructor'].includes(row.source)))fail('Invalid source identity');
  const snapshot=row.snapshot||E.resolveWorld(data,row,{copy:false});if(!record(snapshot)||!snapshot.timeZone||!Number.isFinite(snapshot.now))fail('Invalid materialized world');
  if(row.shortAmbiguity){const a=row.shortAmbiguity;if(!record(a)||a.mode!=='ask'||typeof a.reason!=='string'||!Array.isArray(a.options)||a.options.length!==0&&a.options.length<2||a.options.some(v=>!record(v)||typeof v.itemId!=='string'||!['find','ai'].includes(v.action))||new Set(a.options.map(v=>v.itemId)).size!==a.options.length||row.expected.action!=='none'||row.expected.alternatives||row.expected.actions)fail('Invalid short ambiguity contract');}
  L.pipelineLabels(row);L.compoundVariants(row.expected);
  for(const variant of L.expectedVariants(row.expected))if(variant.action===undefined&&variant.itemId===undefined||variant.action!==undefined&&!L.ACTIONS.includes(L.normalizeAction(variant.action))||own(variant,'fields')&&!record(variant.fields))fail('Invalid expected action or fields');
  const episode=L.episodeLabel(row);if(!episode)continue;
  const groupKey=JSON.stringify([row.source||'',episode.id]),group=episodes.get(groupKey)||{turns:new Set(),split:row.split};
  if(group.split!==row.split||group.turns.has(episode.turn))fail('Episode turns must be unique and confined to one split');group.turns.add(episode.turn);episodes.set(groupKey,group);
 }
 if(options.completeEpisodes&&[...episodes.values()].some(value=>value.turns.size!==3))fail('Serialized episodes require all three turns');
 return rows;
}
function fixtureData(bytes){
 const parsed=JSON.parse(bytes.toString('utf8'));if(!record(parsed)||parsed.schemaVersion!==1||!record(parsed.worlds)||!Array.isArray(parsed.situations)||!Array.isArray(parsed.offers))fail('Unsupported fixture schema');
 const data={...parsed,situations:parsed.situations.map(canonicalRow),offers:parsed.offers.map(row=>L.convertRow(row,{shareWorld:true}))};validateRows(data,data.situations,{completeEpisodes:true});return data;
}
function familyTags(row,snapshot){
 const Language=require('../extension/biscuit-language.js'),Registry=require('../extension/biscuit-registry.js'),prepared=Language.prepare(row.line,snapshot,row.session||{},row.entries||Registry.entries(snapshot)),tags=new Set(row.tags||[]),tokens=prepared.tokens||[],contains=phrase=>{const words=Language.words(phrase);return words.length&&tokens.some((_,index)=>words.every((word,offset)=>tokens[index+offset]===word));},dictionary=prepared.references?.some(value=>value.targets.some(target=>target.kind==='abbreviation')),everyday=Array.isArray(prepared.normalized)&&prepared.normalized.join(' ')!==tokens.join(' '),profiles=prepared.index?.courses?[...prepared.index.courses.values()]:[],derived=profiles.some(profile=>[...profile.aliases].some(([phrase,strength])=>strength<1&&strength!==.75&&contains(phrase))||[profile.course.nickname,profile.course.nickName,profile.course.course_code,profile.course.code].some(value=>value&&contains(value)&&Language.words(value).join(' ')!==Language.words(profile.name).join(' ')));
 if(dictionary||everyday||derived||prepared.matches?.some(value=>value.abbreviation))tags.add('family:abbreviation');if(dictionary)tags.add('family:abbreviation-dictionary');if(everyday)tags.add('family:abbreviation-everyday');if(derived)tags.add('family:abbreviation-own-course');
 if(prepared.matches?.some(value=>value.subject||value.topic||value.moduleEvidence||value.assignmentEvidence))tags.add('family:subject-relationship');if(prepared.matches?.some(value=>value.subject))tags.add('family:subject-general');if(prepared.matches?.some(value=>value.topic))tags.add('family:subject-topic');if(prepared.matches?.some(value=>value.moduleEvidence||value.assignmentEvidence))tags.add('family:subject-title');
 if(L.workflowCoverage(row).eligible)tags.add('family:compound');if(L.episodeLabel(row))tags.add('family:episode');return {...row,tags:[...tags]};
}
const pipelineCorrect=scored=>(!scored.routing.eligible||scored.routing.correct)&&(!scored.context.eligible||scored.context.exact)&&(!scored.kind.eligible||scored.kind.correct);
const turnCorrect=scored=>scored.ranking.top1&&(!scored.fields.eligible||scored.fields.correct)&&pipelineCorrect(scored)&&(!scored.compound?.eligible||scored.compound.correct);
function episodeMetrics(metrics,rows,indices){
 const groups=new Map(),byTurn={};for(const index of indices){const label=L.episodeLabel(rows[index]);if(!label)continue;const key=JSON.stringify([rows[index].source||'',label.id]),group=groups.get(key)||[];group.push(index);groups.set(key,group);const turn=byTurn[label.turn]||={eligible:0,correct:0};turn.eligible++;turn.correct+=Number(turnCorrect(metrics.perRow[index]));}
 const out={count:groups.size,eligible:0,correct:0,incomplete:0,partialWorkflow:0,byTurn};
 for(const group of groups.values()){if(group.some(index=>L.workflowCoverage(rows[index]).partial))out.partialWorkflow++;if(group.length!==3||new Set(group.map(index=>L.episodeLabel(rows[index]).turn)).size!==3){out.incomplete++;continue;}out.eligible++;out.correct+=Number(group.every(index=>turnCorrect(metrics.perRow[index])));}
 out.accuracyPct=pct(out.correct,out.eligible);for(const turn of Object.values(byTurn))turn.accuracyPct=pct(turn.correct,turn.eligible);return out;
}
function aggregate(metrics,legacy,rows,observations,indices,firstRows=rows){
 const out=R5.aggregateRows(metrics,firstRows,observations,indices),first=R5.aggregateRows(legacy,firstRows,observations,indices),compound={eligible:0,correct:0,requiredActions:0,correctActions:0},workflowCoverage={eligible:0,fullyLabelled:0,partial:0,promoted:0,conditionalOrManual:0,continuationOnly:0},residualFailures={top1:0,top3:0,action:0,fields:0,route:0,context:0,kind:0,compound:0,errors:0};
 for(const index of indices){const scored=metrics.perRow[index],coverage=L.workflowCoverage(rows[index]);for(const key of ['eligible','fullyLabelled','partial'])workflowCoverage[key]+=Number(coverage[key]);for(const [key,status]of [['promoted','exact-queue-promoted'],['conditionalOrManual','conditional-or-manual'],['continuationOnly','continuation-only']])workflowCoverage[key]+=Number(rows[index].pendingLabelStatus===status);if(scored.compound?.eligible){compound.eligible++;compound.correct+=Number(scored.compound.correct&&pipelineCorrect(scored));compound.requiredActions+=scored.compound.required;compound.correctActions+=scored.compound.matched;}
  for(const [key,value]of Object.entries({top1:!scored.ranking.top1,top3:!scored.ranking.top3,action:!scored.action.correct,fields:scored.fields.eligible&&!scored.fields.correct,route:scored.routing.eligible&&!scored.routing.correct,context:scored.context.eligible&&!scored.context.exact,kind:scored.kind.aiEligible&&!scored.kind.correct,compound:scored.compound?.eligible&&(!scored.compound.correct||!pipelineCorrect(scored)),errors:observations[index].failed}))residualFailures[key]+=Number(!!value);
 }
 compound.accuracyPct=pct(compound.correct,compound.eligible);compound.actions={eligible:compound.requiredActions,correct:compound.correctActions,accuracyPct:pct(compound.correctActions,compound.requiredActions)};out.compound=compound;out.workflowCoverage=workflowCoverage;out.episodes=episodeMetrics(metrics,rows,indices);out.firstAction={count:first.count,top1:first.top1,top3:first.top3,top1Pct:first.top1Pct,top3Pct:first.top3Pct,byStep:first.byStep};out.qualifying={eligible:out.count,correct:out.top1,accuracyPct:out.top1Pct};
 Object.assign(out.byStep,{firstAction:{eligible:first.count,correct:first.top1,accuracyPct:first.top1Pct},compound:{eligible:compound.eligible,correct:compound.correct,accuracyPct:compound.accuracyPct},episode:{eligible:out.episodes.eligible,correct:out.episodes.correct,accuracyPct:out.episodes.accuracyPct}});out.residualFailures=residualFailures;out.wrongAction=residualFailures.action;out.wrongActionPct=pct(out.wrongAction,out.count);const mutations=indices.filter(index=>rows[index].mutation===true);out.mutationCount=mutations.length;out.wrongMutationAction=mutations.filter(index=>!metrics.perRow[index].action.correct).length;out.wrongMutationActionPct=pct(out.wrongMutationAction,out.mutationCount);out.mutationTargetErrors=mutations.filter(index=>metrics.perRow[index].action.correct&&!metrics.perRow[index].ranking.top1).length;return out;
}
function scoreSituations(data,rows,engine){
 const converted=rows.map(source=>{const row=canonicalRow(source),snapshot=row.snapshot||E.resolveWorld(data,row,{copy:false});return familyTags({...row,evaluationSession:row.evaluationSession||row.session||{},session:L.inferenceSession(row.session||{}),world:snapshot,moment:{}},snapshot);});validateRows(data,converted);
 const observations=[],categories=[],firstRows=converted.map(row=>({...row,expected:firstExpected(row)})),proxy={evaluate(...args){try{const result=engine.evaluate(...args);observations.push({result,failed:!record(result)||typeof result.action!=='string'||!Array.isArray(result.items)||typeof result.then==='function'});return result;}catch(cause){observations.push({result:null,failed:true});throw cause;}}},metrics=E.scoreSituations(data,firstRows,proxy,{onRow:(index,category)=>{categories[index]=category;}});
 metrics.perRow.forEach((scored,index)=>{const observed=observations[index],row=converted[index];scored.byField=R5.scorePerField(firstRows[index].expected,observed.result,observed.failed);Object.assign(scored,R5.scoreControl(row,scored,observed));});
 const legacy={perRow:structuredClone(metrics.perRow),timing:metrics.timing};
 metrics.perRow.forEach((scored,index)=>{
  const observed=observations[index],full=E.scoreCompound(converted[index].expected,observed.result,observed.failed);if(!full.eligible)return;scored.compound=full;const correct=full.correct&&pipelineCorrect(scored);scored.ranking={eligible:true,top1:correct,top3:correct,targetError:full.actionCorrect&&!full.rankingCorrect};scored.action={eligible:true,correct:full.actionCorrect};scored.fields={eligible:full.fieldsEligible,correct:full.fieldsEligible?full.fieldsCorrect:null};scored.byField={};
  const variant=L.compoundVariants(converted[index].expected)[full.variantIndex||0],actual=E.observedActions(observed.result);variant.actions.forEach((expected,step)=>{const actualIndex=full.perAction[step]?.observedIndex??step;for(const [key,value]of Object.entries(R5.scorePerField(expected,actual.steps[actualIndex],observed.failed||!actual.valid)))scored.byField['/actions/'+step+key]=value;});Object.assign(scored,R5.scoreControl(converted[index],scored,observed));
 });
 metrics.perRow.forEach((scored,index)=>{const label=converted[index].shortAmbiguity;if(!label)return;const correct=Short.ambiguityCorrect(label,observations[index].result);scored.ambiguity={eligible:true,correct};scored.ranking.top1=correct;scored.ranking.top3=correct;scored.action.correct=correct;});
 const indices=converted.map((_,index)=>index),group=items=>aggregate(metrics,legacy,converted,observations,items,firstRows),out={...metrics,...group(indices)},details=R5.groupedMetrics(metrics,firstRows,observations,indices);
 for(const key of ['coverage','specialFamilies','byControl','byControlOperation','failuresByFamily'])out[key]=details[key];
 function grouped(keyOf){const buckets=new Map();for(const index of indices)for(const key of new Set(keyOf(converted[index],index))){const bucket=buckets.get(key)||[];bucket.push(index);buckets.set(key,bucket);}return Object.fromEntries([...buckets].map(([key,items])=>[key,group(items)]));}
 out.byFamily=grouped(row=>(row.tags||[]).filter(value=>value.startsWith('family:')).map(value=>value.slice(7)));out.byNeed=grouped(row=>(row.tags||[]).filter(value=>value.startsWith('need:')).map(value=>value.slice(5)));out.byAction=grouped((row,index)=>[firstRows[index].expected.action||'item-only']);out.byCategory=grouped((row,index)=>[categories[index]||'item-only']);for(const [key,value]of Object.entries(out.byCategory))value.replySpecifics=metrics.byCategory[key]?.replySpecifics;out.bySplit=grouped(row=>[row.split]);out.bySource=grouped(row=>[row.source||'unspecified']);
 for(const [source,value]of Object.entries(out.bySource)){const selected=indices.filter(index=>(converted[index].source||'unspecified')===source);value.bySplit=Object.fromEntries([...new Set(selected.map(index=>converted[index].split))].map(split=>[split,group(selected.filter(index=>converted[index].split===split))]));}
 out.byHelp=Object.fromEntries(L.HELP_KINDS.map(kind=>[kind,group(indices.filter(index=>L.pipelineLabels(converted[index]).help?.kinds.length===1&&L.pipelineLabels(converted[index]).help.kinds[0]===kind))]));out.primary=group(indices.filter(index=>isPrimary(converted[index])));
 out.lengthStrata=Object.fromEntries([['short',Short.isShort],['medium',row=>!Short.isShort(row)&&!Short.isLong(row)],['long',Short.isLong]].map(([name,test])=>[name,group(indices.filter(index=>test(converted[index])))]));out.primary.lengthStrata=Object.fromEntries([['short',Short.isShort],['long',Short.isLong]].map(([name,test])=>[name,group(indices.filter(index=>isPrimary(converted[index])&&test(converted[index])))]));out.ambiguity={eligible:metrics.perRow.filter(r=>r.ambiguity).length,correct:metrics.perRow.filter(r=>r.ambiguity?.correct).length};
 for(const [family,value]of Object.entries(out.byFamily))if(out.failuresByFamily[family])Object.assign(out.failuresByFamily[family],{compound:value.residualFailures.compound,episode:value.episodes.eligible-value.episodes.correct,partialWorkflows:value.workflowCoverage.partial});
 out.scoring=SCORING;return out;
}
function score(rows,pack){const Engine=require('../extension/biscuit-engine.js');return scoreSituations({schemaVersion:1,worlds:{},offers:[]},rows.map(row=>({...row,world:row.snapshot||row.world,moment:row.snapshot?{}:row.moment,split:row.split||'tune'})),Engine.create({pack}));}

// This public entry point has exactly one fixture. There is no dataset discovery,
// fitting path, fresh-set option or writable report/ledger destination.
const VALIDATION='tests/validation/biscuit-short-r6-validation.json',Public=require('./biscuit-public-filter.cjs');
function isSealed(file){return /(?:^|[\\/])set6(?:[\\/]|$)|biscuit-situations-set6/i.test(path.resolve(file));}
function validationPath(referenceRoot){
 if(!referenceRoot)throw R5.error('BISCUIT_PUBLIC_REFERENCE','--reference-root is required');
 const lexicalRoot=path.resolve(referenceRoot),lexical=path.resolve(lexicalRoot,VALIDATION);
 if(isSealed(lexical))throw R5.error('BISCUIT_PUBLIC_SEALED','Set6 access is prohibited');
 const root=fs.realpathSync(lexicalRoot),file=fs.realpathSync(lexical);
 if(isSealed(file)||!R5.within(file,root)||R5.identity(file)!==R5.identity(path.resolve(root,VALIDATION)))throw R5.error('BISCUIT_PUBLIC_PATH','Reserved validation path must be direct and inside the reference root');return {root,file};
}
function loadShortValidation(options={}){
 const {root,file}=validationPath(options.referenceRoot||options.root),bytes=fs.readFileSync(file),data=fixtureData(bytes);
 if(data.validationOnly!==true)fail('Reserved validation marker required');
 const filtered=Public.filterRows(data.situations,options.capabilities||Public.capabilities(),{includeUnavailable:options.includeUnavailable===true}),source=VALIDATION;
 const rows=filtered.rows.map(row=>({...row,source,validationOnly:true,trainingPartition:'validation'}));
 return {data,rows,source,sha256:R5.hash(bytes),filtering:filtered.filtering,referenceRoot:root};
}
function summarize(value){
 return {count:value.count,top1:value.top1,top1Pct:value.top1Pct,top3Pct:value.top3Pct,actionAccuracyPct:value.actionAccuracyPct,fieldsAccuracyPct:value.fieldsAccuracyPct,qualifying:value.qualifying,firstAction:value.firstAction,compound:value.compound,workflowCoverage:value.workflowCoverage,episodes:value.episodes,ambiguity:value.ambiguity,byStep:value.byStep,residualFailures:value.residualFailures,errors:value.errors,timing:{unit:'ms',count:value.timing?.count,mean:value.timing?.mean,p95:value.timing?.p95,max:value.timing?.max}};
}
function run(options={}){
 const tier=options.tier||'basic',split=options.split||'all';
 if(!TIERS.includes(tier)||!['all','tune','heldout'].includes(split))throw R5.error('BISCUIT_PUBLIC_OPTIONS','Invalid tier or split');
 for(const key of Object.keys(options))if(!['tier','split','referenceRoot','root','filterOnly','capabilities','includeUnavailable'].includes(key))throw R5.error('BISCUIT_PUBLIC_OPTIONS','Unsupported public evaluation option');
 const validation=loadShortValidation(options),rows=validation.rows.filter(row=>split==='all'||row.split===split),report={schemaVersion:1,round:6,tier,training:false,validationOnly:true,sealed:false,scope:options.includeUnavailable?'all-local-labels':'public-compatible-labels',source:validation.source,fixtureSha256:validation.sha256,filtering:validation.filtering,selectedRows:rows.length,split,scoring:SCORING,shortPolicy:{words:'1-4 whitespace words',longWords:'9+',ambiguity:'Clarification or 2-3 legitimate choices; no executable guessed action',supplementalControlRowsExcludedFromPrimary:true}};
 if(options.filterOnly)return report;if(!rows.length)throw R5.error('BISCUIT_PUBLIC_EMPTY','Public validation selection is empty');
 // R5.loadEngine uses requireFreshTier: every loaded ancestor must have its actual
 // requested .tier, validated resolved models, and the declared residual ancestry.
 const loaded=R5.loadEngine(tier),scores=scoreSituations(validation.data,rows,loaded.engine);
 report.loadedTier=tier;report.metrics={...summarize(scores),primary:{...summarize(scores.primary),lengthStrata:Object.fromEntries(Object.entries(scores.primary.lengthStrata).map(([name,value])=>[name,summarize(value)]))},lengthStrata:Object.fromEntries(Object.entries(scores.lengthStrata).map(([name,value])=>[name,summarize(value)]))};
 report.cost=R5.finishCost(loaded.cost,[scores]);return report;
}
function parseArgs(argv){
 const options={};for(let i=0;i<argv.length;i++){
  const arg=argv[i];if(['--help','-h'].includes(arg))return {help:true};
  if(arg==='--include-unavailable'&&!options.includeUnavailable){options.includeUnavailable=true;continue;}
  if(arg==='--filter-only'&&!options.filterOnly){options.filterOnly=true;continue;}
  const key={'--reference-root':'referenceRoot','--tier':'tier','--split':'split'}[arg];if(!key||own(options,key)||!argv[i+1]||argv[i+1].startsWith('--'))throw R5.error('BISCUIT_PUBLIC_OPTIONS','Use --reference-root PATH [--tier basic|more|most] [--split all|tune|heldout] [--filter-only] [--include-unavailable]');options[key]=argv[++i];
 }return options;
}
function main(argv=process.argv.slice(2)){
 try{const options=parseArgs(argv);if(options.help){process.stdout.write('node scripts/biscuit-r6-eval.cjs --reference-root PATH [--tier basic|more|most] [--split all|tune|heldout] [--filter-only] [--include-unavailable]\nReads only the reserved tests/validation/biscuit-short-r6-validation.json. Reports go to stdout. No training or sealed input access.\n');return;}
  const report=run(options);process.stdout.write(JSON.stringify(report,null,2)+'\n');if(report.metrics?.errors)process.exitCode=2;
 }catch(error){process.stderr.write('Public R6 evaluation refused or failed ('+(/^[A-Z0-9_]+$/.test(error.code||'')?error.code:'BISCUIT_PUBLIC_FAILURE')+'); no fixture contents logged.\n');process.exitCode=1;}
}
module.exports={ROOT,TIERS,VALIDATION,SCORING,isSealed,validationPath,isPrimary,canonicalRow,firstExpected,validateRows,fixtureData,loadShortValidation,familyTags,episodeMetrics,aggregate,scoreSituations,score,run,summarize,parseArgs,main};
if(require.main===module)main();
