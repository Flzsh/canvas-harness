const test=require('node:test');
const assert=require('node:assert/strict');
const Materials=require('../extension/material-model.js');

test('exports CommonJS and ReserveMaterials APIs and safeURL rejects hostile URLs',()=>{
  assert.equal(global.ReserveMaterials,Materials);
  for(const name of ['normalizeCatalog','safeURL','classify','suggestions','filter'])assert.equal(typeof Materials[name],'function',name);
  assert.equal(Materials.safeURL('/courses/7/pages/vectors'),'https://school.instructure.com/courses/7/pages/vectors');
  assert.equal(Materials.safeURL('https://docs.google.com/document/d/abc'),'https://docs.google.com/document/d/abc');
  assert.equal(Materials.safeURL('javascript:alert(1)'),'');
  assert.equal(Materials.safeURL('https://user:pass@example.com/secret'),'');
});

test('classification distinguishes answers, schedules, slides, readings and links',()=>{
  assert.equal(Materials.classify('Gas Stoichiometry with Answers.pdf','File'),'Worksheet + answers');
  assert.equal(Materials.classify('Unit 1 Answer Key.pdf','File'),'Answer key');
  assert.equal(Materials.classify('Cycle Sheet','Page'),'Schedule');
  assert.equal(Materials.classify('Lesson Slides.pptx','File'),'Slides');
  assert.equal(Materials.classify('Chapter 3 Reading.pdf','File'),'Reading');
  assert.equal(Materials.classify('Reference site','ExternalUrl'),'Link');
});

test('normalizeCatalog honors published/deleted/locked state, uses Canvas links for locked module items, and deduplicates standalone content',()=>{
  const items=Materials.normalizeCatalog({
    courseId:'7',
    modules:[
      {id:'10',name:'Unit 1',published:true,items:[
        {id:'100',type:'File',title:'Worksheet.pdf',content_id:'55',html_url:'https://school.instructure.com/courses/7/files/55'},
        {id:'101',type:'Page',title:'Vectors',page_url:'vectors',html_url:'https://school.instructure.com/courses/7/pages/vectors'},
        {id:'102',type:'ExternalUrl',title:'Private reference',external_url:'https://example.com/private',content_details:{locked_for_user:true}},
        {id:'103',type:'Assignment',title:'Vector Homework',content_id:'501',html_url:'https://school.instructure.com/courses/7/assignments/501'},
        {id:'104',type:'File',title:'Deleted.pdf',content_id:'99',workflow_state:'deleted'},
      ]},
      {id:'11',name:'Hidden unit',published:false,items:[{id:'200',type:'File',title:'Hidden.pdf',content_id:'77'}]},
    ],
    pages:[
      {page_id:'70',url:'vectors',title:'Vectors',html_url:'https://school.instructure.com/courses/7/pages/vectors'},
      {page_id:'71',url:'extra',title:'Extra page',html_url:'https://school.instructure.com/courses/7/pages/extra',published:true},
    ],
    files:[
      {id:'55',display_name:'Worksheet.pdf',url:'https://school.instructure.com/files/55/download'},
      {id:'56',display_name:'Reference.pdf',url:'https://school.instructure.com/files/56/download'},
    ],
    frontPage:{page_id:'72',url:'home',title:'Course home',html_url:'https://school.instructure.com/courses/7/pages/home'},
  });

  assert.equal(new Set(items.map(item=>item.id)).size,items.length);
  assert.equal(items.filter(item=>item.contentId==='55').length,1);
  assert.equal(items.filter(item=>item.pageUrl==='vectors').length,1);
  assert.ok(items.some(item=>item.title==='Extra page'&&item.moduleId===null));
  assert.ok(items.some(item=>item.title==='Reference.pdf'&&item.moduleId===null));
  assert.ok(items.some(item=>item.kind==='FrontPage'&&item.title==='Course home'));
  assert.ok(items.some(item=>item.kind==='Assignment'&&item.contentId==='501'));
  assert.ok(!items.some(item=>item.title==='Deleted.pdf'||item.title==='Hidden.pdf'));
  const locked=items.find(item=>item.title==='Private reference');
  assert.equal(locked.locked,true);
  assert.equal(locked.url,'https://school.instructure.com/courses/7/modules/items/102');
});

test('locked modules never expose their external direct URLs',()=>{
  const [item]=Materials.normalizeCatalog({courseId:'12',modules:[{id:'5',name:'Locked',state:'locked',items:[{id:'9',type:'ExternalUrl',title:'Secret',external_url:'https://example.com/secret'}]}]});
  assert.equal(item.locked,true);
  assert.equal(item.url,'https://school.instructure.com/courses/12/modules/items/9');
});

test('suggestions prioritize exact assignment module membership, then conservative title matches',()=>{
  const items=Materials.normalizeCatalog({courseId:'7',modules:[
    {id:'1',name:'Bridge',items:[
      {id:'10',type:'Assignment',title:'Bridge writeup',content_id:'900'},
      {id:'11',type:'File',title:'Bridge Building Competition.pdf',content_id:'51',html_url:'https://school.instructure.com/files/51'},
    ]},
    {id:'2',name:'Gas',items:[
      {id:'20',type:'File',title:'Gas Stoichiometry with Answers.pdf',content_id:'52',html_url:'https://school.instructure.com/files/52'},
    ]},
  ]});
  const same=Materials.suggestions(items,{id:'900',name:'Bridge writeup'},{limit:4});
  assert.equal(same[0].title,'Bridge Building Competition.pdf');
  assert.equal(same[0].reason,'Same module');

  const title=Materials.suggestions(items,{id:'901',name:'Gas Stoich Odds'},{limit:4});
  assert.equal(title[0].title,'Gas Stoichiometry with Answers.pdf');
  assert.equal(title[0].reason,'Title match');
  assert.ok(!title.some(item=>item.kind==='Assignment'));
});

test('filter supports category and normalized text search across title and module',()=>{
  const items=[
    {id:'1',title:'Gas Stoichiometry with Answers',category:'Worksheet + answers',moduleName:'Unit 1A'},
    {id:'2',title:'Cycle Sheet',category:'Schedule',moduleName:'English'},
  ];
  assert.deepEqual(Materials.filter(items,{query:'unit 1a'}).map(x=>x.id),['1']);
  assert.deepEqual(Materials.filter(items,{category:'Schedule'}).map(x=>x.id),['2']);
  assert.deepEqual(Materials.filter(items,{query:'stoichiometry',category:'Worksheet + answers'}).map(x=>x.id),['1']);
});
test('assignments reused in several modules suggest resources from every associated module',()=>{
 const items=Materials.normalizeCatalog({courseId:'7',modules:[
  {id:'1',name:'Overview',items:[{id:'10',type:'Assignment',title:'Writeup',content_id:'900'}]},
  {id:'2',name:'Build',items:[{id:'20',type:'Assignment',title:'Writeup',content_id:'900'},{id:'21',type:'Page',title:'Construction requirements',page_url:'requirements'}]}
 ]});
 const result=Materials.suggestions(items,{id:'900',name:'Writeup'});assert.equal(result[0].title,'Construction requirements');assert.equal(result[0].reason,'Same module');
});

// How teacher materials read in a list (the student's Chemistry › Unit 1b and Engineering › Materials).
test('displayTitle drops extensions, "Copy of" and duplicate markers, tidies separators and quiets shouted phrases, keeping acronyms',()=>{
  const cases=[
    ['Copy of Unit 1-2 Syllabus - 2026-27 School Year.docx','Unit 1-2 Syllabus — 2026-27 School Year'],
    ['AP CHEM-Chapter 14 Lecture.ppt','AP CHEM — Chapter 14 Lecture'],
    ['HW WS 1.pdf','HW WS 1'],
    ['HW WS 1-ANSWER KEY.pdf','HW WS 1 — Answer key'],
    ['Rate Law Summary.pdf','Rate Law Summary'],
    ['CL Kinetics WS - Integrated Rate Law (1).docx','CL Kinetics WS — Integrated Rate Law'],
    ['Integrate Rate Law WS - ANSWER KEY.pdf','Integrate Rate Law WS — Answer key'],
    ['Crystal Violet Fading Kinetics Lab (1).pdf','Crystal Violet Fading Kinetics Lab'],
    ['ENGINEERING DESIGN PROCESS POSTER.pdf','Engineering design process poster'],
    ['UNIT 1A TEST CORRECTIONS FORM.pdf','Unit 1A test corrections form'],
    ['Notes - Copy (2).xlsx','Notes'],['Copy of Copy of Lab Notebook.pages','Lab Notebook'],['HW_WS_3.key','HW WS 3'],
    ['Magic 8-Ball','Magic 8-Ball'],['Self-Assessment','Self-Assessment'],['COVID-19 Rules','COVID-19 Rules'],['What Is Engineering?','What Is Engineering?'],
    ['PART A','Part A'],['Ovid DRN 1.1-10.pdf','Ovid DRN 1.1-10'],['Unit 3 v2.1','Unit 3 v2.1'],['',''],
  ];
  for(const [raw,clean] of cases)assert.equal(Materials.displayTitle(raw),clean,raw);
});

test('classify adds syllabus and lab kinds; format tags come from the file or what the item is in Canvas',()=>{
  assert.equal(Materials.classify('CL Robotics Syllabus.pdf','File'),'Syllabus');
  assert.equal(Materials.classify('2026 Daily Syllabus','ExternalUrl'),'Schedule','a daily syllabus is still the schedule');
  assert.equal(Materials.classify('Crystal Violet Fading Kinetics Lab (1).pdf','File'),'Lab');
  assert.equal(Materials.classify('Lab Answer Key.pdf','File'),'Answer key');
  const f=(title,kind,url)=>Materials.formatOf({title,kind,url});
  assert.deepEqual([f('HW WS 1.pdf','File'),f('Report.docx','File'),f('AP CHEM-Chapter 14 Lecture.ppt','File'),f('Data.xlsx','File'),f('Lecture.mp4','File'),f('Scan','File')],['PDF','Word','Slides','Sheet','Video','File']);
  assert.deepEqual([f('Engineering Associations','Page'),f('Home','FrontPage'),f('What Is Engineering?','ExternalUrl','https://www.nae.edu/'),f('Notes','ExternalUrl','https://docs.google.com/document/d/1/edit'),f('Deck','ExternalUrl','https://docs.google.com/presentation/d/1'),f('Clip','ExternalUrl','https://youtu.be/abc'),f('Syllabus','ExternalTool'),f('Quiz 1','Quiz')],['Page','Page','Link','Doc','Slides','Video','','']);
  const k=(title,kind)=>Materials.kindOf({title,kind,category:Materials.classify(title,kind)});
  assert.deepEqual([k('HW WS 1-ANSWER KEY.pdf','File'),k('AP CHEM-Chapter 14 Lecture.ppt','File'),k('Lecture slides.pdf','File'),k('Kinetics Lab (1).pdf','File'),k('Copy of Unit 1-2 Syllabus.docx','ExternalTool'),k('Google Assignments','ExternalTool'),k('HW WS 1.pdf','File'),k('Rate Law Summary.pdf','File'),k('Front','FrontPage')],['Answer key','','Slides','Lab','Syllabus','Class tool','','','Home page'],'a kind word only where it adds meaning, never Slides twice or File');
  assert.match(Materials.searchText({title:'HW WS 1-ANSWER KEY.pdf',kind:'File',category:'Answer key'}),/HW WS 1-ANSWER KEY\.pdf[\s\S]*HW WS 1 — Answer key[\s\S]*PDF/,'search reads the original name, the clean name and the tags');
});

test('present pairs an answer key with its worksheet when their titles match; unmatched keys stay rows of their own',()=>{
  const item=(id,title)=>({id,title,kind:'File',category:Materials.classify(title,'File'),url:'https://school.instructure.com/courses/7/files/'+id});
  const rows=Materials.present([item('1','HW WS 1.pdf'),item('2','HW WS 1-ANSWER KEY.pdf'),item('3','Rate Law Summary.pdf'),item('4','Stoichiometry Practice Answer Key.pdf'),item('5','Stoichiometry Practice.docx'),item('6','Integrate Rate Law WS - ANSWER KEY.pdf'),item('7','CL Kinetics WS - Integrated Rate Law (1).docx')]);
  assert.deepEqual(rows.map(r=>[r.title,r.format,r.kind,r.key?.item.id||null]),[
    ['HW WS 1','PDF','','2'],['Rate Law Summary','PDF','',null],['Stoichiometry Practice','Word','','4'],['Integrate Rate Law WS — Answer key','PDF','Answer key',null],['CL Kinetics WS — Integrated Rate Law','Word','',null]
  ]);
  assert.equal(rows[0].original,'HW WS 1.pdf','the original name stays with the row');
});

test('outline: one chapter per module in Canvas order, then course resources; numbered only when the teacher has not numbered them; single same-title chapters flagged',()=>{
  const it=(id,title,moduleId,moduleName,kind='Page')=>({id,title,kind,moduleId,moduleName,category:Materials.classify(title,kind)});
  const all=[it('a','Magic 8-Ball','1','Magic 8-Ball'),it('b','Final Project 2026','2','Final Project'),it('c','CL Robotics Syllabus.pdf','3','Course Description and Syllabus','File'),it('d','Engineering Associations','3','Course Description and Syllabus'),it('e','Supply List',null,'')];
  const book=Materials.outline(all);
  assert.deepEqual(book.map(c=>[c.key,c.name,c.number,c.single,c.items.length]),[['module-1','Magic 8-Ball',1,true,1],['module-2','Final Project',2,false,1],['module-3','Course Description and Syllabus',3,false,2],['resources','Course resources',0,false,1]]);
  const found=Materials.outline(all,[all[3]]);
  assert.deepEqual(found.map(c=>[c.name,c.number,c.items.length]),[['Course Description and Syllabus',3,1]],'a search keeps its chapter and its Canvas number');
  const units=Materials.outline([it('x','HW WS 1.pdf','9','Unit 1b','File'),it('y','Notes','8','Unit 1a')]);
  assert.deepEqual(units.map(c=>c.number),[0,0],'Unit 1b and Unit 1a carry their own numbers');
  assert.deepEqual(Materials.outline(all,all,{numbers:false}).map(c=>c.number),[0,0,0,0]);
});
