'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const art=require('../extension/course-art.js');
const course=name=>({id:'123',name});

test('common subject keywords choose the complete matching artwork set',()=>{
 const cases={algebra1:'Honors Algebra I',geometry:'Geometry 10',algebra2:'ALGEBRA II — Section B',precalculus:'Pre-Calculus Honors','calculus-ab':'AP Calculus AB','calculus-bc':'Calculus BC',biology:'Biology 101','ap-biology':'Advanced Placement Biology',chemistry:'General Chemistry','ap-chemistry':'AP Chemistry — Period 3',physics:'Honors Physics','ap-physics':'AP Physics C: Mechanics',english:'English Literature',writing:'Creative Writing',reading:'Reading Workshop',latin:'Latin III',spanish:'Spanish 2',french:'French I','eastern-history':'East Asian History','western-history':'Western Civilization','us-history':'AP U.S. History','world-history':'World History'};
 for(const [expected,name] of Object.entries(cases)){
  const c=course(name);assert.equal(art.kind(c),expected,name);
  assert.ok(art.scene(c,{crop:'wide'}).includes(`data-art="${expected}"`),name+' banner');
  assert.ok(art.mini(c).includes(`data-art="${expected}"`),name+' icon');
  assert.ok(art.frame(expected,c.id,c).includes(`data-kind="${expected}"`),name+' border');
  assert.match(art.scene(c),/data-loop=/,name+' animated banner');
 }
});

test('specific subjects win over generic words and short codes match only at boundaries',()=>{
 for(const [name,expected] of [['Precalculus','precalculus'],['Calculus BC','calculus-bc'],['AP English Language and Composition','writing'],['AP English Literature and Composition','english'],['Latin American History','world-history'],['Applied Biology','biology'],['World Geography and History','world-history'],['French Revolution: European History','western-history'],['Biographical Studies','home'],['Calculating Art Budgets','home'],['General Studies','home'],['Chemistry of Life','chemistry']])assert.equal(art.kind(course(name)),expected,name);
 assert.equal(art.kind({id:'7',name:'Period 2',code:'APBIO-2'}),'ap-biology');
 assert.equal(art.kind({id:'7',name:'Period 3',code:'CHEM101'}),'chemistry');
 assert.equal(art.kind({id:'7',name:'My lab',originalName:'Honors Chemistry',code:'CHM101'}),'chemistry');
 assert.equal(art.kind({id:'folio-home',name:'All courses',code:'CHEM'}),'home');
 assert.equal(art.kind({id:'folio-bookmarks',name:'Chemistry'}),'bookmarks');
});

test('art lettering never replaces a renamed or more specific course title',()=>{
 assert.ok(art.titleFrame(course('Chemistry')).includes('data-crop="title"'));
 assert.equal(art.titleFrame(course('Organic Chemistry Seminar')),'');
 assert.equal(art.titleFrame({id:'7',name:'My lab',originalName:'Chemistry'}),'');
 assert.equal(art.titleFrame({...course('Chemistry'),artPrefs:{bannerArt:{}}}),'');
});

test('custom uploads still take priority over automatically matched artwork',()=>{
 const custom=require('../extension/custom-art.js');globalThis.ReserveCustomArt=custom;
 const asset=kind=>custom.importSVG(custom.template(kind),kind+'.svg');
 const c={...course('Chemistry'),artPrefs:{bannerArt:asset('banner'),iconArt:asset('icon'),borderArt:asset('border')},artMotion:false};
 assert.match(art.scene(c),/ch-custom-banner/);assert.match(art.mini(c),/ch-custom-icon/);assert.match(art.frame('chemistry',c.id,c),/ch-custom-border/);
});
