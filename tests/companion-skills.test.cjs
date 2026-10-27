'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),E=require('../extension/biscuit-engine.js'),B=require('../extension/pony-brain.js');
const now=Date.parse('2026-10-22T22:00Z'),world=patch=>({now,timeZone:'America/New_York',settings:{bedtime:'22:30'},pageKind:'materials',assignments:[],...patch});
for(const [skill,kind,patch,state]of [
 ['focus','break',{focus:{completedAt:now-60000,completedMinutes:25}},{}],
 ['wellbeing','stretch',{activity:{active:46*60000}},{stretchDue:true}],
 ['planner','plan',{lastAction:'submission'},{}],
 ['planner','plan',{pageKind:'assignment',itemId:'1',assignments:[{id:'1',title:'Lab',dueAt:now+86400000}]},{}],
 ['planner','plan',{pageKind:'dashboard',assignments:[{id:'1',title:'Lab',dueAt:now+86400000}]},{}],
 ['deadline','next',{assignments:[{id:'1',title:'Lab',dueAt:now+60000}]},{}],
 ['inbox','inbox',{unreadAnnouncements:2},{}],
 ['reminders','reminder',{reminders:[{id:'r',text:'Bring notes',at:now-60000}]},{}]
])test(skill+' switch blocks active '+kind+' offer '+(patch.pageKind||''),()=>{
 const s=world(patch);assert.equal(E.offer(s,state)?.kind,kind);assert.equal(E.offer({...s,pet:{skills:{[skill]:false}}},state),null);
});
test('announcement offers keep their saved delivery limit and wait behind planning',()=>{const s=world({unreadAnnouncements:2});const offer=E.offer(s);assert.equal(offer?.action,'inbox');assert.equal(E.offer(s,{}, {brain:{nudges:{items:['biscuit:'+offer.id]}}}),null);assert.equal(E.offer({...s,lastAction:'submission'})?.kind,'plan');});
for(const [skill,action]of [['focus','focus'],['focus','break'],['planner','plan'],['reminders','remind']])test(skill+' switch blocks its scheduled '+action+' offer',()=>{const s=world({routines:[{id:'r',name:'Routine',action,days:[4],minute:1000}]});assert.equal(E.offer(s)?.kind,'routine');assert.equal(E.offer({...s,skills:{[skill]:false}}),null);});
test('Night owl guard controls after-bedtime offers',()=>{const s=world({now:Date.parse('2026-10-23T03:00Z'),lastAction:'submission'});assert.equal(E.offer(s),null);assert.equal(E.offer({...s,pet:{skills:{night:false}}})?.kind,'plan');});

function widgets(){
 const data={settings:{timeZone:'America/New_York'},pet:{enabled:true,skills:B.cleanSkills(),brain:B.cleanLearning(),routines:[],reminders:[]},tasks:{},focus:{minutes:25}},calls=[],items=[];let options;const off=new Set();
 class Clock extends Date{static now(){return now;}}
 const doc={addEventListener(){},removeEventListener(){},defaultView:{addEventListener(){},removeEventListener(){}}},container={ownerDocument:doc,querySelector:()=>null,querySelectorAll:()=>[]},env=vm.createContext({console,Date:Clock,Map,Set,Promise,Intl,ReserveFeatures:{enabled:id=>!off.has(id)},ReservePonyBrain:B,ReservePetArt:{},ReservePets:{DEFAULTS:{},clean:v=>structuredClone(v),create:o=>{options=o;return {sync(){},setFocus(){},destroy(){}};}},setInterval:()=>1,clearInterval(){},setTimeout(){},clearTimeout(){}});
 for(const file of ['planner-model.js','widgets.js'])vm.runInContext(fs.readFileSync('extension/'+file,'utf8'),env,{filename:file});
 const context=()=>({s:data.settings,items,local:data.tasks,courses:[{id:'2',name:'Chemistry'}],now,theme:'light',unreadAnnouncements:2}),save=async fn=>{fn(data);return true;};
 const c=env.ReserveWidgets.create({container,store:{get:()=>data},save,rerender(){},getContext:context,helpers:()=>({dayKey:()=> '2026-10-22',complete:x=>!!x.done}),announcements:()=>{calls.push(['inbox']);return true;}});c.sync();return {data,c,calls,off,info:()=>options.info(),get actions(){return options.actions;}};
}
test('Inbox watch rechecks announcement handoffs',()=>{const f=widgets();try{assert.equal(f.actions.inbox(),true);f.data.pet.skills.inbox=false;assert.equal(f.actions.inbox(),false);assert.equal(f.calls.length,1);}finally{f.c.destroy();}});
test('announcement offers follow the course hub feature',()=>{const f=widgets();try{assert.equal(f.info().unreadAnnouncements,2);f.off.add('course-hub');assert.equal(f.info().unreadAnnouncements,0);assert.equal(f.actions.inbox(),false);assert.deepEqual(f.calls,[]);}finally{f.c.destroy();}});
