#!/usr/bin/env node
'use strict';
/* Reproducible projection of the disclosed Biscuit packs (round 6 and later). This script never trains or reads datasets. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),I=require('./biscuit-control-inventory.cjs'),Public=require('./biscuit-public-filter.cjs');
const ROOT=path.resolve(__dirname,'..'),TIERS=['basic','more','most'],sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
// The packs must carry no school identity. The names are checked by hash so this public file does not spell them:
// every run of one to three words is hashed and compared.
const PRIVATE_NAMES=new Set(['4e77286b10e764e3','3f8241542bc6f98e','10cad13cb7b23284']);
const forbidden={test(text){const words=String(text).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);for(let n=1;n<=3;n++)for(let i=0;i+n<=words.length;i++)if(PRIVATE_NAMES.has(sha(words.slice(i,i+n).join(' ')).slice(0,16)))return true;return false;}};
function auditVocabulary(vocabulary){
 assert.equal(vocabulary.schemaVersion,1);assert.ok(Array.isArray(vocabulary.subjects));
 const issues=[];function visit(value,where){if(typeof value==='string'){if(forbidden.test(value))issues.push(where);}else if(Array.isArray(value))value.forEach((v,i)=>visit(v,where+'/'+i));else if(value&&typeof value==='object')for(const [key,v]of Object.entries(value)){if(forbidden.test(key)||/^(?:teachers?|instructors?|schools?|institutions?|roster)$/i.test(key))issues.push(where+'/'+key);visit(v,where+'/'+key);}}
 visit(vocabulary,'');if(issues.length)throw Error('School-specific vocabulary must be reviewed before porting: '+issues.join(', '));
 return {subjects:vocabulary.subjects.length,everydayAbbreviations:Object.values(vocabulary.everyday).reduce((n,rows)=>n+rows.length,0),subjectAbbreviations:vocabulary.subjects.reduce((n,s)=>n+(s.abbr?.length||0),0),schoolOrTeacherFields:0,schoolOriginMatches:0,removed:0,note:'Generic subjects, historical/scientific topic names, examination boards and abbreviations are retained. No school/teacher roster is present.'};
}
function labelReasons(name,label,caps){
 if(name==='kind')return ['help-kind-required'];if(name==='action')return label==='ai'?['ai-required']:[];
 if(!name.startsWith('detail:'))return [];const fields=JSON.parse(label);return [...Public.operationReasons({action:name.slice(7),fields},caps)];
}
const publicFeature=key=>!/(?:\bask ai\b|ai-engine)/i.test(key);
function projectModel(model,indices){
 const projected={...model,labels:indices.map(i=>model.labels[i]),weights:Object.fromEntries(Object.entries(model.weights).filter(([key])=>publicFeature(key)).map(([key,values])=>[key,indices.map(i=>values[i])]))};
 if(model.trees)projected.trees={...model.trees,bias:indices.map(i=>model.trees.bias[i]),trees:model.trees.trees.map(tree=>({...tree,values:tree.values.map(values=>indices.map(i=>values[i]))}))};
 return projected;
}
function projectPack(source,caps,sourceSha256){
 const pack=structuredClone(source),removed={},reasons={},removedFeatureKeys={};
 for(const [name,model]of Object.entries(source.models)){
  const indices=[];model.labels.forEach((label,index)=>{const why=labelReasons(name,label,caps);if(!why.length)indices.push(index);else{removed[name]=(removed[name]||0)+1;for(const reason of why)reasons[reason]=(reasons[reason]||0)+1;}});
  const dropped=Object.keys(model.weights).filter(key=>!publicFeature(key)).length;if(dropped)removedFeatureKeys[name]=dropped;if(indices.length===model.labels.length&&!dropped)continue;if(!indices.length)delete pack.models[name];else pack.models[name]=projectModel(model,indices);
 }
 const patterns=pack.patterns.length;pack.patterns=pack.patterns.filter(rule=>!Public.operationReasons(rule,caps).size);
 const training=pack.training||{};for(const key of ['helpProfile','helpTraining','helpTrainingRows','contextCalibration','contextConditioning','residualTargets'])delete training[key];
 if(training.headFeatures)delete training.headFeatures.kind;if(training.shortObjective)delete training.shortObjective.kind;
 if(Array.isArray(training.rankingActors))training.rankingActors=training.rankingActors.filter(actor=>actor!=='ai');
 pack.publicPort={method:'public-control-label-projection-v1',sourceSha256,retrained:false,sourceTrainingRows:source.training?.rows??null,trainingMetadata:'Remaining aggregate training metadata describes the original source fit; no examples were copied or refitted.',removedLabels:removed,removedFeatureKeys,removalReasons:reasons,removedPatterns:patterns-pack.patterns.length};
 return pack;
}
function validateProjection(source,pack,caps){
 assert.equal(pack.tier,source.tier);assert.equal(pack.extends,source.extends);assert.equal(pack.r6FitSignature,source.r6FitSignature);assert.equal(pack.r6TrainingFingerprint,source.r6TrainingFingerprint);
 for(const [name,model]of Object.entries(pack.models)){
  assert.ok(model.labels.length);assert.equal(new Set(model.labels).size,model.labels.length);const original=source.models[name],indices=model.labels.map(label=>original.labels.indexOf(label));
  assert.ok(indices.every(index=>index>=0));assert.deepEqual(model,projectModel(original,indices));
  for(const label of model.labels)assert.equal(labelReasons(name,label,caps).length,0,'Unsupported output label');
  for(const values of Object.values(model.weights))assert.ok(values.length===model.labels.length&&values.every(Number.isFinite));
  if(model.trees){assert.equal(model.trees.bias.length,model.labels.length);for(const tree of model.trees.trees){assert.equal(tree.values.length,2**tree.bits.length);for(const values of tree.values)assert.ok(values.length===model.labels.length&&values.every(Number.isFinite));}}
 }
 assert.ok(!pack.models.kind);assert.ok(!pack.models.action.labels.includes('ai'));assert.ok(!forbidden.test(JSON.stringify(pack)),'School-specific pack content');assert.ok(!/(?:\bask ai\b|ai-engine)/i.test(JSON.stringify(pack)),'Unsupported handoff feature');return true;
}
// Release audit: shipped JSON keeps every line short. The packs are written as compact JSON broken after commas outside
// strings (continuation lines start with two spaces); the data is unchanged. A check compares the parsed data and line lengths.
const LINE_BYTES=2400,MAX_LINE_BYTES=3000,charBytes=code=>code<0x80?1:code<0x800||code>=0xD800&&code<=0xDFFF?2:3;
function wrapJSON(value){
 const text=JSON.stringify(value),lines=[];let start=0,bytes=0,comma=-1,commaBytes=0,quoted=false,escaped=false;
 for(let i=0;i<text.length;i++){const c=text[i];bytes+=charBytes(text.charCodeAt(i));
  if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
  if(c==='"'){quoted=true;continue;}if(c!==',')continue;
  if(bytes>LINE_BYTES-2&&comma>=start){lines.push(text.slice(start,comma+1));start=comma+1;bytes-=commaBytes;}comma=i;commaBytes=bytes;
 }
 lines.push(text.slice(start));const output=lines.join('\n  ')+'\n';
 assert.ok(output.split('\n').every(line=>Buffer.byteLength(line)<=MAX_LINE_BYTES),'A generated line is too long');assert.equal(JSON.stringify(JSON.parse(output)),text);return Buffer.from(output);
}
function sameData(file,value){
 if(!fs.existsSync(file))return false;const text=fs.readFileSync(file,'utf8');
 return text.split('\n').every(line=>Buffer.byteLength(line)<=MAX_LINE_BYTES)&&JSON.stringify(JSON.parse(text))===JSON.stringify(value);
}
function run({referenceRoot,write=false}={}){
 if(!referenceRoot)throw Error('--reference-root is required; only the four disclosed extension/biscuit-rules JSON files are read.');
 const ref=fs.realpathSync(path.resolve(referenceRoot)),caps=Public.capabilities(),destination=path.join(ROOT,'extension/biscuit-rules'),report={schemaVersion:1,retrained:false,files:{}};
 if(write)fs.mkdirSync(destination,{recursive:true});const packs=[];
 for(const tier of TIERS){const file=path.join(ref,'extension/biscuit-rules',tier+'.json'),bytes=fs.readFileSync(file),source=JSON.parse(bytes),pack=projectPack(source,caps,sha(bytes));validateProjection(source,pack,caps);packs.push(pack);
  const target=path.join(destination,tier+'.json');if(write)fs.writeFileSync(target,wrapJSON(pack));else assert.ok(sameData(target,pack),'Public pack is stale: '+tier);
  const output=fs.readFileSync(target);report.files[tier]={sourceSha256:sha(bytes),publicSha256:sha(output),bytes:output.length,...pack.publicPort};
 }
 for(let index=1;index<packs.length;index++)for(const [name,model]of Object.entries(packs[index].models))if(model.delta){const previous=packs[index-1].models[name];assert.ok(previous);assert.deepEqual(model.labels,previous.labels);assert.equal(model.scale,previous.scale);}
 const vocabularyBytes=fs.readFileSync(path.join(ref,'extension/biscuit-rules/school-language.json')),vocabulary=JSON.parse(vocabularyBytes);report.vocabulary={...auditVocabulary(vocabulary),sha256:sha(vocabularyBytes),bytes:vocabularyBytes.length};
 // the public vocabulary keeps its readable layout while its data matches the reference
 const target=path.join(destination,'school-language.json');if(!sameData(target,vocabulary)){assert.ok(write,'Vocabulary changed');fs.writeFileSync(target,wrapJSON(vocabulary));}return report;
}
function parseArgs(argv){const options={};for(let i=0;i<argv.length;i++){const arg=argv[i];if(arg==='--write'){options.write=true;continue;}if(arg==='--check')continue;if(arg==='--reference-root'&&!options.referenceRoot&&argv[i+1]){options.referenceRoot=argv[++i];continue;}throw Error('Use --reference-root PATH [--write|--check].');}return options;}
module.exports={auditVocabulary,labelReasons,projectModel,projectPack,validateProjection,run,parseArgs};
if(require.main===module)try{process.stdout.write(JSON.stringify(run(parseArgs(process.argv.slice(2))),null,2)+'\n');}catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
