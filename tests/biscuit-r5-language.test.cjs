'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),L=require('../extension/biscuit-language.js'),data=require('../extension/biscuit-rules/school-language.json');
const now=Date.UTC(2026,9,22,16),world=patch=>({now,courses:[{id:'m',name:'MATH 221: AP Calculus BC - Section 02 - Dr. Imani Frost',teacher:'Dr. Imani Frost'},{id:'g',name:'Honors Geometry - Rowan Kline [S1]',teacher:'Rowan Kline'},{id:'p',name:'IBDP Geography HL (Section 4)'},{id:'b',name:'BIO 101: Biology - Dr. Sora Elian',teacher:'Dr. Sora Elian'}],...patch});
test('school abbreviation families are supplied by the packaged dictionary',()=>{
 for(const alias of ['calc','precalc','bio','chem','phys','apush','ap lang','ap lit','eng','lit','hist','gov','econ','psych','stats','cs','comp sci','span','alg','geo','trig','env sci','apes','pe','pc','apcsa','apcsp','engr','robo','journ','yrbk','hlth','fin','acct','mktg','anat','a&p','physio','marine bio','astro','earth sci','whap','apwh','euro','apeh','apgov','hug','aphg','ushist','civ','macro','micro','socio','phil','alg 1','alg 2','calc ab','calc bc','multi','multivar','lin alg','ap stat','discrete','eng 9','eng 12','lang','comp','rhet','cw','fr','lat','mand','chin','ger','jpn','asl','apstudio','orch','choir','band','theater','theatre'])assert.ok(L.analyze(alias).references.length,alias);
});
test('everyday shorthand expands whole tokens and keeps unknown words unchanged',()=>{
 assert.equal(L.normalize('hw asgn assn proj pres qz rdg lab rpt tmrw tmr 2moro tn tonite b4 w/ w/o wk wknd mins hr asap rn'),'homework assignment assignment project presentation quiz reading lab report tomorrow tomorrow tomorrow tonight tonight before with without week weekend minutes hours as soon as possible right now');
 assert.equal(L.normalize('florbizzle homeworkish'), 'florbizzle homeworkish');assert.equal(L.normalize('calc'),'calculus');
});
test('short names retain subject and essential level while removing school decorations',()=>{
 const s=world();assert.equal(L.shortName(s.courses[0]),'Calculus BC');assert.equal(L.shortName(s.courses[1]),'Geometry');assert.equal(L.shortName(s.courses[2]),'Geography');assert.equal(L.shortName({name:'A-level Mathematics — Section 3'}),'Mathematics');assert.equal(L.shortName({name:'GCSE English Literature (Term 2)'}),'English Literature');assert.equal(L.shortName({name:'CL English: Coast Narratives & Ecology-Varela',teacher:'Varela'}),'English: Coast Narratives & Ecology');assert.equal(L.shortName({name:'MATH221 Calculus'}),'Calculus');assert.equal(L.shortName({name:'AP Biology',nickname:'Life Lab'}),'Life Lab');
});
test('math can identify a calculus course even when no course is literally named math',()=>{
 const s=world({courses:[world().courses[0]]}),result=L.resolveCourses('math',s);assert.equal(result.courseId,'m');assert.equal(result.matches[0].shortName,'Calculus BC');assert.equal(result.matches[0].subject,1);assert.equal(L.resolveCourses('derivatives',s).courseId,'m');assert.equal(L.resolveCourses('integrals',s).courseId,'m');
});
test('general subjects select only existing descendants across the taxonomy',()=>{
 for(const [query,name]of [['science','Marine Biology'],['history','Government and Politics'],['social studies','Economics'],['ELA','Creative Writing'],['world languages','Français III'],['arts','Orchestra'],['tech','Robotics'],['math','Statistics'],['science','Anatomy and Physiology']])assert.equal(L.resolveCourses(query,{courses:[{id:'invented',name}]}).courseId,'invented',query+' -> '+name);
 const result=L.resolveCourses('science',{courses:[{id:'m',name:'Calculus BC'}]});assert.equal(result.courseId,'');assert.deepEqual(result.matches,[]);assert.match(result.message,/No matching course/);
});
test('geo remains ambiguous when both geometry and geography are real courses',()=>{
 const s=world({courses:world().courses.filter(v=>['g','p'].includes(v.id))}),result=L.resolveCourses('geo',s);assert.equal(result.ambiguous,true);assert.equal(result.courseId,'');assert.deepEqual(result.matches.map(v=>v.id).sort(),['g','p']);assert.match(result.message,/Which course/);assert.equal(L.normalize('geo',s),'geo');
});
test('a single real course constrains a colliding dictionary alias',()=>{
 for(const [courseId,normalized]of [['g','geometry'],['p','geography']]){const s=world({courses:world().courses.filter(v=>v.id===courseId)});assert.equal(L.resolveCourses('geo',s).courseId,courseId);assert.equal(L.normalize('geo',s),normalized);}
});
test('topic evidence disambiguates geo independently of an unrelated open course',()=>{
 const s=world({activeCourseId:'p',assignments:[{id:'triangles',courseId:'g',title:'Triangles and similarity'},{id:'population',courseId:'p',title:'Population pyramids and maps'}]});assert.equal(L.resolveCourses('geo triangles',s).courseId,'g');assert.equal(L.resolveCourses('geo population pyramids',s).courseId,'p');assert.equal(L.resolveCourses('geo cartography',s).courseId,'p');
});
test('active course, open item and last-mentioned course resolve otherwise equal collisions',()=>{
 const s=world({courses:world().courses.filter(v=>['g','p'].includes(v.id))});assert.equal(L.resolveCourses('geo',{...s,activeCourseId:'p'}).courseId,'p');assert.equal(L.resolveCourses('geo',s,{lastCourseId:'g'}).courseId,'g');const page={...s,selectedItemId:'map',assignments:[{id:'map',courseId:'p',title:'Regional survey'}]};assert.equal(L.resolveCourses('geo',page).courseId,'p');assert.equal(L.resolveCourses('geo',{...page,selectedItemId:undefined},{lastItemId:'map'}).courseId,'p');
});
test('due-soon context applies only after course evidence and retains alternatives',()=>{
 const s=world({courses:world().courses.filter(v=>['g','p'].includes(v.id)),assignments:[{id:'map',courseId:'p',title:'Regional survey',dueAt:new Date(now+3600000).toISOString()}]}),result=L.resolveCourses('geo',s);assert.equal(result.courseId,'p');assert.ok(result.matches[0].soon>0);assert.equal(result.alternatives[0].id,'g');assert.equal(L.resolveCourses('unfamiliarquantum',s).matches.length,0);
});
test('finished assignments cannot supply due-soon evidence for a collision',()=>{
 const s=world({courses:world().courses.filter(v=>['g','p'].includes(v.id)),assignments:[{id:'map',courseId:'p',title:'Regional survey',dueAt:now+1000,completed:true}]});assert.equal(L.resolveCourses('geo',s).ambiguous,true);
});
test('local module and assignment titles provide evidence for invented course names and topics',()=>{
 const s={now,courses:[{id:'k',name:'Kestrel Inquiry Studio'},{id:'f',name:'Marigold Inquiry Studio'}],modules:[{id:'module-k',courseId:'k',title:'Pulseflower navigation'}],assignments:[{id:'assignment-f',courseId:'f',title:'Circular lantern survey'}]};let result=L.resolveCourses('pulseflower',s);assert.equal(result.courseId,'k');assert.equal(result.matches[0].moduleEvidence,1);result=L.resolveCourses('circular lantern',s);assert.equal(result.courseId,'f');assert.equal(result.matches[0].assignmentEvidence,1);assert.equal(result.matches[0].evidence.find(v=>v.kind==='assignment')?.id,'assignment-f');
});
test('course-owned nested module item titles and Canvas snake-case IDs provide topic evidence',()=>{
 const s={courses:[{id:0,name:'Juniper Inquiry',modules:[{id:'m0',title:'Copper Meadow',items:[{id:'item-0',title:'Lanternfrost observations'}]}]},{id:2,name:'Tansy Inquiry'}],modules:[{id:'m2',course_id:2,title:'Oceanspire cartography'}]};assert.equal(L.resolveCourses('lanternfrost',s).courseId,'0');assert.equal(L.resolveCourses('oceanspire',s).courseId,'2');
});
test('course names can be in other languages and can attach department codes directly to numbers',()=>{
 for(const [query,name]of [['math','CBSE Matemáticas II'],['science','IGCSE Biologie'],['world languages','NCEA Français III'],['science','CHEM101: Chimie'],['math','Algebra2'],['math','数学'],['science','化学'],['world languages','日本語']])assert.equal(L.resolveCourses(query,{courses:[{id:'international',name}]}).courseId,'international',name);
});
test('school-independent initials, local nicknames, and bounded syllable prefixes are derived',()=>{
 const s={courses:[{id:'x',name:'H Xylophonic Cartography and Archive Design'},{id:'f',name:'Fable Gardening',nickname:'Sprout Lab'}]};for(const query of ['xcad','xyl','xylop','Xylophonic Cartography and Archive Design'])assert.equal(L.resolveCourses(query,s).courseId,'x',query);assert.equal(L.resolveCourses('sprout lab',s).courseId,'f');assert.ok(L.courseAliases(s.courses[0]).includes('xcad'));assert.equal(L.resolveCourses('xylophonics',s).matches.length,0);
});
test('unfamiliar single words and none cannot borrow page, course, or due context',()=>{
 const s=world({activeCourseId:'b',selectedItemId:'lab',assignments:[{id:'lab',courseId:'b',title:'Leaf microscopy',dueAt:now+1000}]});for(const query of ['none','florbizzle','quuxomatic','celestialunknown']){const result=L.resolveCourses(query,s,{lastCourseId:'m'});assert.deepEqual(result.matches,[],query);assert.equal(result.unknownSingle,true,query);assert.equal(result.courseId,'',query);}
});
test('known topic-to-subject relationships cover sciences and US history',()=>{
 for(const [query,name]of [['photosynthesis','Biology'],['stoichiometry','Chemistry'],['Civil War','AP US History'],['rhetorical analysis','AP English Language and Composition'],['eigenvalues','Linear Algebra']])assert.equal(L.resolveCourses(query,{courses:[{id:'specific',name}]}).courseId,'specific',query);
});
test('subject specialization and actual levels distinguish AB/BC, algebra I/II, and IB SL/HL',()=>{
 for(const [query,courses,expected]of [['calc bc',[{id:'ab',name:'AP Calculus AB'},{id:'bc',name:'AP Calculus BC'}],'bc'],['alg 2',[{id:'one',name:'Algebra I'},{id:'two',name:'Algebra II'}],'two'],['IB HL math',[{id:'sl',name:'IB Math SL'},{id:'hl',name:'IB Math HL'}],'hl']])assert.equal(L.resolveCourses(query,{courses}).courseId,expected,query);
});
test('course metadata mutation invalidates derived names and taxonomy evidence',()=>{
 const s={courses:[{id:'a',name:'Calculus BC'}]};assert.equal(L.resolveCourses('math',s).courseId,'a');s.courses[0].name='Marine Biology';assert.equal(L.resolveCourses('math',s).matches.length,0);assert.equal(L.resolveCourses('science',s).courseId,'a');
});
test('language evidence does not scan grade values, feedback bodies, or unrelated hidden fields',()=>{
 const s={courses:[{id:'b',name:'Biology',score:98}],grades:[{id:'secret',courseId:'b',title:'Aurumprivate',value:98}],feedback:[{id:'secret-feedback',courseId:'b',title:'Argentprivate',text:'Silverbloom'}],assignments:[{id:'a',courseId:'b',title:'Leaf microscopy',description:'Privatebodyfield'}]};for(const query of ['aurumprivate','argentprivate','silverbloom','privatebodyfield'])assert.equal(L.resolveCourses(query,s).matches.length,0,query);
});
test('learn merges language and optional semantics features and reuses prepared language evidence',()=>{
 const Learn=require('../extension/biscuit-learn.js'),previous=globalThis.ReserveBiscuitSemantics,s=world({courses:[{id:'m',name:'Calculus BC'}]}),row={id:'m',kind:'course',title:'Calculus BC'},rows=[row];let preparedSeen;globalThis.ReserveBiscuitSemantics={actionFeatures:()=>({'fixture:semanticAction':1}),itemFeatures:(input,row,s,session,rows,prepared)=>{preparedSeen=prepared;return {'fixture:semanticItem':1};}};try{const action=Learn.actionFeatures('calc hw',s,{}, {charMax:0,parseCues:{}});assert.equal(action['w:calc'],1);assert.equal(action['lang:subject:calculus'],1);assert.equal(action['lang:w:homework'],1);assert.equal(action['fixture:semanticAction'],1);const prepared=Learn.context('math',s,{},rows),features=Learn.itemFeatures('math',row,s,{},rows,prepared);assert.equal(features['lang:subject'],1);assert.equal(features['lang:course:course'],1);assert.equal(features['fixture:semanticItem'],1);assert.equal(preparedSeen,prepared);assert.equal(prepared.language.courseId,'m');}finally{if(previous)globalThis.ReserveBiscuitSemantics=previous;else delete globalThis.ReserveBiscuitSemantics;}
});
test('a browser-style runtime can install the same JSON through a supplied offline reader',async()=>{
 const context=vm.createContext({}),source=fs.readFileSync(path.join(__dirname,'../extension/biscuit-language.js'),'utf8');vm.runInContext(source,context);const language=context.ReserveBiscuitLanguage;assert.equal(language.ready,false);await language.load(file=>{assert.equal(file,L.DATA_FILE);return data;});assert.equal(language.ready,true);assert.equal(language.shortName({name:'AP Calculus BC'}),'Calculus BC');assert.equal(language.resolveCourses('math',{courses:[{id:'m',name:'Calculus BC'}]}).courseId,'m');
});
test('automatic browser loading reads only a packaged extension URL',async()=>{
 const requested=[],context=vm.createContext({chrome:{runtime:{getURL:file=>'chrome-extension://invented-language/'+file}},fetch:async url=>{requested.push(url);return {ok:true,json:async()=>data};}}),source=fs.readFileSync(path.join(__dirname,'../extension/biscuit-language.js'),'utf8');vm.runInContext(source,context);await context.ReserveBiscuitLanguage.load();assert.deepEqual(requested,['chrome-extension://invented-language/'+L.DATA_FILE]);assert.equal(context.ReserveBiscuitLanguage.ready,true);
});
