'use strict';
/* INDEPENDENT SYNTHETIC CONTRACTS, AUTHORED BEFORE THE PROPOSAL. UNRUN.
   Parent alone executes. No corpus, fitted/shipping pack, application, child,
   benchmark, network, or subprocess is loaded/launched by this file.
   Select BISCUIT_ENGINE_REFERENCE_VARIANT=before|proposed|actual (default proposed).
   Test-only exposure keeps the real legacy function bodies and all consumers. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const STAGE=__dirname,ROOT=path.resolve(STAGE,'..'),ACTUAL=path.join(ROOT,'extension'),variant='actual';
assert.ok(['before','proposed','actual'].includes(variant),'Unknown Engine variant');
const engineFile=path.join(variant==='actual'?ACTUAL:path.join(STAGE,variant,'extension'),'biscuit-engine.js'),realRequire=createRequire(path.join(ACTUAL,'biscuit-engine.js'));
const Selection=realRequire('./biscuit-selection.js'),Details=realRequire('./biscuit-details.js'),Registry=realRequire('./biscuit-registry.js');
const boundary='return {register:Registry.register,prepare,search,evaluate,offer,normalizeInput:everyday};';
const code=fs.readFileSync(engineFile,'utf8');
assert.equal(code.split(boundary).length,2,'Legacy capture boundary must occur exactly once');
const context={module:{exports:{}},require:realRequire,console};
vm.runInNewContext(code.replace(boundary,'return {register:Registry.register,prepare,search,evaluate,offer,normalizeInput:everyday,__contracts:{understand,evaluateRules,reference}};'),context,{filename:engineFile});
const Engine=context.module.exports,plain=value=>JSON.parse(JSON.stringify(value)),fields=result=>result?.next?.fields;
const NOW=Date.parse('2031-04-18T12:00:00Z');
const A={id:'synthetic-estuary',title:'Estuary Observations',courseId:'synthetic-earth',text:'Compare the salinity samples.',dueAt:NOW+86400000};
const B={id:'synthetic-archive',title:'Archive Commentary',courseId:'synthetic-history',text:'Annotate the source register.',dueAt:NOW+172800000};
const C={id:'synthetic-cello',title:'Cello Rehearsal',courseId:'synthetic-music',text:'Rehearse the final movement.',dueAt:NOW+259200000};
const courses=[{id:A.courseId,name:'Earth Inquiry'},{id:B.courseId,name:'Historical Inquiry'},{id:C.courseId,name:'Ensemble'}];
const state=(extra={})=>({now:NOW,timeZone:'UTC',ai:true,showGrades:false,courses,assignments:[A,B,C],selectedItemId:A.id,...extra});
const memory=(extra={})=>({lastItemId:B.id,itemId:C.id,items:[B,A,C],...extra});
const head=labels=>({labels,scale:1000,weights:{bias:labels.map(()=>0)}});
function pack(weights={bias:[0]}){return {schemaVersion:1,tier:'basic',features:{charMax:0},patterns:[],thresholds:{context:.5},models:{action:head(['bookmark']),kind:head(['ask']),context:head(['yes']),item:{...head(['yes']),weights}}};}
const legacy=(text,s=state(),m=memory())=>Engine.create({pack:pack()}).__contracts.evaluateRules(text,s,m);
function bookmark(text,id,s=state(),m=memory()){
 const result=legacy(text,s,m);assert.equal(result.action,'bookmark',text);assert.equal(result.next.action,'bookmark',text);assert.equal(fields(result).itemId,id,text);assert.equal(result.items[0]?.id,id,text);return result;
}
function denied(result){assert.equal(result?.action,'none');assert.equal(result.next.action,'none');for(const key of ['itemId','courseId','blockId','targetId','operation'])assert.equal(fields(result)?.[key],undefined,key);}
function focus(text,id,s=state(),m=memory()){const result=legacy(text,s,m);assert.equal(result.action,'focus');assert.equal(fields(result).itemId,id);assert.equal(fields(result).minutes,17);assert.equal(fields(result).operation,'start');return result;}

// Wrong ownership, precedence, identity validation, or fallback-to-search breaks these.
for(const phrase of ['this','this assignment','the selected assignment','the assignment on this page'])test('legacy bookmark uses current UI rather than prior: '+phrase,()=>{bookmark('Bookmark '+phrase+'.',A.id);});
test('selectedItemId outranks another current itemId pointer',()=>{bookmark('Bookmark this.',A.id,state({itemId:B.id,page:{itemId:C.id}}));});
test('a missing higher current pointer permits the actual itemId',()=>{bookmark('Bookmark this assignment.',C.id,state({selectedItemId:undefined,itemId:C.id}));});
test('page.itemId remains a current owner when higher pointers are absent',()=>{bookmark('Bookmark this assignment.',C.id,state({selectedItemId:undefined,page:{itemId:C.id}}));});
for(const phrase of ['that assignment','it','the same task','the previous assignment'])test('legacy bookmark uses the conversation owner: '+phrase,()=>{bookmark('Bookmark '+phrase+'.',B.id);});
for(const [phrase,id]of [['the first card',B.id],['the second result',A.id],['the third one',C.id],['the last card',C.id],['the middle result',A.id],['the 2nd card',A.id]])test('legacy bookmark uses the displayed ordinal: '+phrase,()=>{bookmark('Bookmark '+phrase+'.',id);});
test('a named target wins over positive current and prior pointers',()=>{bookmark('Bookmark Cello Rehearsal.',C.id);});
test('a positive named target wins after a rejected current reference',()=>{bookmark('Bookmark Cello Rehearsal instead of this assignment.',C.id);});
test('negative prior names do not acquire current ownership',()=>{bookmark('Bookmark this assignment, not Archive Commentary.',A.id);});
test('an excluded first card does not compete with the positive second card',()=>{bookmark('Bookmark the second card rather than the first card.',A.id);});
test('an excluded selected source cannot return through a search fallback',()=>{denied(legacy('Bookmark this assignment, excluding Estuary Observations.'));});
test('a stale selected pointer cannot fall through to itemId, page, or prior',()=>{denied(legacy('Bookmark this assignment.',state({selectedItemId:'synthetic-gone',itemId:A.id,page:{itemId:A.id}})));});
test('an absent explicit current owner cannot borrow the conversation',()=>{denied(legacy('Bookmark this assignment.',state({selectedItemId:undefined})));});
test('a stale prior pointer cannot fall through to another prior field or current UI',()=>{denied(legacy('Bookmark that assignment.',state(),memory({lastItemId:'synthetic-gone'})));});
test('a typed prior reference without history cannot borrow the current source',()=>{denied(legacy('Bookmark that assignment.',state(),{}));});
test('an out-of-range card cannot fall through to a current source or singleton',()=>{denied(legacy('Bookmark the third card.',state(),{items:[B]}));});
test('two positive owner choices require disambiguation',()=>{denied(legacy('Bookmark this or that.'));});
test('two positive ordinals require disambiguation',()=>{denied(legacy('Bookmark the first card or the second card.'));});
test('a selected ID shared across courses is ambiguous',()=>{denied(legacy('Bookmark this assignment.',state({assignments:[A,B,C,{...C,id:A.id}]})));});
test('a selected ID shared across source kinds is ambiguous',()=>{denied(legacy('Bookmark this assignment.',state({files:[{id:A.id,courseId:A.courseId,title:'Separate Source Manual',text:'A different source.'}]})));});
test('a named title repeated across courses requires a loaded active-course distinction',()=>{const twin={...B,title:A.title},s=state({assignments:[A,twin,C],activeCourseId:B.courseId});bookmark('Bookmark Estuary Observations.',B.id,s);});
test('an unqualified repeated title without a course distinction cannot choose the first record',()=>{denied(legacy('Bookmark Estuary Observations.',state({assignments:[A,{...B,title:A.title},C]})));});
test('an excluded course blocks its selected source',()=>{denied(legacy('Bookmark this assignment, excluding Earth Inquiry.'));});
test('a private selected grade cannot borrow a public source',()=>{const secret={id:'synthetic-private-grade',courseId:A.courseId,title:'Private Returned Assessment',score:91,text:'Private percentile.'},s=state({selectedItemId:secret.id,grades:[secret]});denied(legacy('Bookmark this assignment.',s));});

// These assert real mutation consumers and field contracts, not the resolver alone.
test('legacy source ownership feeds the actual typed focus consumer',()=>{focus('Start a 17-minute focus for this assignment.',A.id);focus('Start a 17-minute focus for that assignment.',B.id);focus('Start a 17-minute focus for the third card.',C.id);});
test('the typed focus consumer rejects a current file instead of using prior work',()=>{const file={id:'synthetic-focus-file',courseId:A.courseId,title:'Equipment Reference',text:'Read-only reference.'};denied(legacy('Start a 17-minute focus for this file.',state({selectedItemId:file.id,files:[file]})));});
test('a standalone timer stays local without an incidental current or prior work target',()=>{const result=legacy('Start a 17-minute focus timer.');assert.equal(result.action,'focus');assert.equal(fields(result).local,true);assert.equal(fields(result).itemId,undefined);assert.equal(fields(result).minutes,17);});
test('current course focus keeps course fields and no invented itemId',()=>{const result=legacy('Start a 17-minute focus for this course.',state({selectedItemId:undefined,activeCourseId:A.courseId}));assert.equal(result.action,'focus');assert.equal(fields(result).courseId,A.courseId);assert.equal(fields(result).itemId,undefined);assert.equal(fields(result).minutes,17);});
test('a real linked planner mutation keeps block identity distinct from assignment identity',()=>{const block={id:'synthetic-plan-block',itemId:A.id,courseId:A.courseId,title:'Estuary Study Window',startAt:NOW+3600000,endAt:NOW+4800000,minutes:20},s=state({planner:[block]}),result=Details.resolve('plan','Move the block for this assignment 7 minutes later.',s,memory(),Registry.entries(s));assert.equal(result.action,'plan');assert.equal(fields(result).blockId,block.id);assert.notEqual(fields(result).blockId,A.id);assert.ok(result.items.some(row=>row.id===A.id&&row.kind==='assignment'));assert.equal(fields(result).startAt,block.startAt+420000);assert.equal(fields(result).preserveAssignmentDeadline,true);});
test('a real reminder consumer keeps explicit current versus prior source IDs',()=>{for(const [phrase,id]of [['this assignment',A.id],['that assignment',B.id]]){const s=state(),result=Details.resolve('reminder','Remind me about '+phrase+' in 11 minutes.',s,memory(),Registry.entries(s));assert.equal(result.action,'reminder');assert.equal(fields(result).itemId,id);assert.equal(fields(result).operation,'create');}});
test('public Engine evaluation preserves negative bookmark speech acts',()=>{const result=Engine.create().evaluate('Do not bookmark this assignment.',state(),memory());assert.notEqual(result.next.action,'bookmark');assert.equal(fields(result).itemId,undefined);});
test('public Engine evaluation uses the current assignment for a bare bookmark',()=>{const result=Engine.create().evaluate('Bookmark this.',state(),memory());assert.equal(result.next.action,'bookmark');assert.equal(fields(result).itemId,A.id);});

// Read and allocation fallbacks must not reintroduce the legacy prior-first helper.
for(const [text,id]of [['Open this assignment.',A.id],['Open that assignment.',B.id],['Open the third card.',C.id],['What does this require?',A.id],['What does it require?',B.id]])test('legacy read preserves the shared owner: '+text,()=>{const result=legacy(text);assert.ok(['open','find'].includes(result.action));assert.equal(result.items[0]?.id,id);assert.equal(fields(result).itemId,id);});
test('a stale explicit read cannot choose a ranked source',()=>{denied(legacy('Open this assignment.',state({selectedItemId:'synthetic-gone'})));});
for(const [phrase,id]of [['this assignment',A.id],['that assignment',B.id],['the third card',C.id]])test('legacy allocation delegates exact ownership to the real plan consumer: '+phrase,()=>{const result=legacy('Schedule '+phrase+' for 17 minutes tomorrow at 16:10.');assert.equal(result.action,'plan');assert.equal(fields(result).itemId,id);assert.equal(fields(result).minutes,17);assert.equal(fields(result).preserveAssignmentDeadline,true);});
test('a stale explicit allocation cannot become a generic or alternate-work plan',()=>{denied(legacy('Schedule this assignment for 17 minutes tomorrow at 16:10.',state({selectedItemId:'synthetic-gone'})));});
test('the plan consumer retains an explicitly named multi-work allocation',()=>{const result=legacy('Schedule Estuary Observations and Archive Commentary for 17 minutes tomorrow at 16:10.');assert.equal(result.action,'plan');assert.deepEqual(Array.from(fields(result).itemIds),[A.id,B.id]);assert.equal(fields(result).minutes,17);});

// Legacy AI source binding uses the same ownership without adding implicit sources.

// The public search API must retain its explicit actor/default read-only behavior.
test('public search defaults to read-only source ranking even with timer words',()=>{const s=state({assignments:[{id:'synthetic-timer-work',courseId:A.courseId,title:'Focus 17 minutes notes',text:'Timer reference.'}],files:[{id:'synthetic-timer-guide',courseId:A.courseId,title:'Focus 17 minutes guide',text:'Timer reference.'}]});const engine=Engine.create({pack:pack({bias:[0],'role:open/find|title|file':[100000],'role:focus|title|assignment':[100000]})});assert.equal(engine.search('focus 17 minutes',s)[0].id,'synthetic-timer-guide');assert.equal(engine.search('focus 17 minutes',s,{},'focus 17 minutes','focus')[0].id,'synthetic-timer-work');});
test('the shared resolver and the legacy bookmark consumer agree for current prior ordinal and named owners',()=>{for(const [text,id]of [['Bookmark this assignment.',A.id],['Bookmark that assignment.',B.id],['Bookmark the third card.',C.id],['Bookmark Cello Rehearsal.',C.id]]){const s=state(),m=memory(),owned=Selection.reference(text,Registry.entries(s),s,m,{actor:'bookmark'});assert.equal(owned.row?.id,id);assert.equal(owned.explicit,true);bookmark(text,id,s,m);}});
test('legacy ownership neither mutates source snapshots nor session memory',()=>{const s=state(),m=memory(),before=plain({s,m});bookmark('Bookmark this assignment.',A.id,s,m);assert.deepEqual(plain({s,m}),before);});

test('a bare title shared across courses still returns searchable source choices',()=>{const twin={...B,title:A.title},s=state({assignments:[A,twin,C],selectedItemId:undefined}),result=Engine.create().evaluate(A.title,s,{});assert.notEqual(result.action,'none');assert.deepEqual(new Set(result.items.slice(0,2).map(row=>row.id)),new Set([A.id,twin.id]));});
test('a displayed choice from ambiguous bare-title search remains a real later ordinal target',()=>{const twin={...B,title:A.title},s=state({assignments:[A,twin,C],selectedItemId:undefined}),engine=Engine.create(),initial=engine.evaluate(A.title,s,{});assert.ok(initial.items.length>=2);const result=engine.evaluate('Move the second one to tomorrow.',s,{items:initial.items,query:A.title});assert.equal(result.action,'move');assert.equal(result.next.fields.itemId,initial.items[1].id);assert.equal(result.next.fields.date,'2031-04-19');});

test('relative plan clauses and temporal that do not invent a prior source slot',()=>{const e=Engine.create();for(const text of ['Build a preparation plan that ends tomorrow evening.','Help me plan the report before that.'])assert.equal(e.__contracts.reference(text,state(),memory()).explicit,false,text);});
test('pronominal factual questions retain their actual shared current and prior sources',()=>{const e=Engine.create();assert.equal(e.__contracts.reference('What does this require?',state(),memory()).row.id,A.id);assert.equal(e.__contracts.reference('When is it due?',state(),memory()).row.id,B.id);});

test('legacy move aliases bind the prior pronoun through shared reference checks',()=>{for(const verb of ['push','bump','shift','postpone']){const r=legacy(verb+' it in eleven minutes.');assert.equal(r.next.action,'move',verb);assert.equal(r.next.fields.itemId,B.id,verb);assert.equal(r.next.fields.time,'12:11',verb);}});
test('legacy completion pronouns use their real prior source and retain stale rejection',()=>{const owned=Engine.create().__contracts.reference('Done with it.',state(),memory());assert.equal(owned.owner,'prior');assert.equal(owned.row.id,B.id);assert.equal(legacy('Done with it.').next.fields.itemId,B.id);denied(legacy('Push it in eleven minutes.',state(),memory({lastItemId:'gone'})));});
test('an actual named source keeps precedence over a command-looking title',()=>{const file={id:'authored-command-title',title:'Push It',courseId:A.courseId,text:'A source title.'},r=Engine.create().__contracts.reference('Push It',state({files:[file]}),memory());assert.equal(r.row.id,file.id);assert.equal(r.owner,'named');});
