// The Assignments page shows every assignment (the "All" view), owner 2026-11-05: what needs you first - late work,
// then by deadline, new work leading its group - then work without a date, work waiting for a grade, and the done work
// kept as history, newest first. Home keeps Up next.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.join(__dirname,'..','extension');
const read=file=>fs.readFileSync(path.join(dir,file),'utf8');
const sandbox={console,Intl,Date,Math,JSON,Number,String,Object,Array,Set,Map};sandbox.globalThis=sandbox;sandbox.window=sandbox;sandbox.self=sandbox;
vm.createContext(sandbox);
for(const f of ['site.js','core.js','dashboard-model.js'])vm.runInContext(read(f),sandbox,{filename:f});
const Model=sandbox.ReserveDashboardModel||sandbox.CanvasReserveDashboardModel||Object.values(sandbox).find(v=>v&&typeof v.filterAssignments==='function');
const DAY=864e5,now=Date.parse('2026-11-05T15:00:00Z'),at=d=>new Date(now+d*DAY).toISOString();
const items=[
  {id:'graded-old',courseId:'1',name:'Graded old',dueAt:at(-30),state:'graded',score:9,points:10},
  {id:'graded-new',courseId:'1',name:'Graded new',dueAt:at(-3),state:'graded',score:8,points:10},
  {id:'waiting',courseId:'1',name:'Waiting for a grade',dueAt:at(-2),state:'submitted',score:null,points:10},
  {id:'late-old',courseId:'1',name:'Late long ago',dueAt:at(-40),state:'unsubmitted',missing:true,points:10},
  {id:'late-new',courseId:'1',name:'Late yesterday',dueAt:at(-1),state:'unsubmitted',missing:true,points:10},
  {id:'soon',courseId:'1',name:'Due soon',dueAt:at(0.3),state:'unsubmitted',points:10},
  {id:'later',courseId:'1',name:'Due later',dueAt:at(6),state:'unsubmitted',points:10},
  {id:'later-new',courseId:'1',name:'Due later, new',dueAt:at(9),state:'unsubmitted',points:10},
  {id:'undated',courseId:'1',name:'No date',dueAt:null,state:'unsubmitted',points:10},
  {id:'other',courseId:'2',name:'Another course',dueAt:at(1),state:'unsubmitted',points:10},
];
const all=opts=>Model.filterAssignments(items,{mode:'all',now,timeZone:'America/New_York',...opts}).items.map(x=>x.id);

test('All lists every piece of work in the course, the old done work and long-late work too',()=>{
  const ids=all({courseId:'1'});
  assert.equal(ids.length,9);
  assert.ok(ids.includes('graded-old')&&ids.includes('late-old'),'history and old late work stay');
  assert.ok(!ids.includes('other'),'only the chosen course');
  assert.equal(all({courseId:'all'}).length,10);
});

test('late work first (newest late first), then by deadline with new work leading, then undated, waiting, done',()=>{
  assert.deepEqual(all({courseId:'1',newIds:new Set(['later-new'])}),
    ['late-new','late-old','later-new','soon','later','undated','waiting','graded-new','graded-old']);
  assert.deepEqual(all({courseId:'1'}),['late-new','late-old','soon','later','later-new','undated','waiting','graded-new','graded-old']);
});

test('All is a known view, so a saved Assignments page keeps it',()=>{
  assert.equal(Model.cleanState({mode:'all'}).mode,'all');
});

test('the page wiring: the Assignments page opens on All with its own segment; Home keeps Up next',()=>{
  const view=read('dashboard-view.js').replace(/\n\s*/g,''),dash=read('dashboard.js').replace(/\n\s*/g,'');
  assert.match(view,/const modes=\[\.\.\.\(c\.workPage==='assignments'\?\[\['all','All'\]\]:\[\]\),\['actionable','Up next'\]/);
  assert.match(view,/finished\(item\)\?state\.mode==='all'\?waitingGrade\(item\)\?'Waiting for a grade':'Done':'Completed work'/);
  assert.match(dash,/const pageDefault=\(\)=>workspace==='work'&&workPage==='assignments'\?'all':'actionable';/);
  assert.match(dash,/workPage=nextPage;fitPageMode\(\);/);
  assert.match(dash,/state=Model\.cleanState\(next\);fitPageMode\(\);/);
});
