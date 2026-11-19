'use strict';
// Audit B1 (2026-11-14, Home dashboard and its pages): the shared fixture of the tests/audit-b1-*.test.cjs files.
// The dashboard mounted the way tests/dashboard-interactions.test.cjs mounts it, with two courses, the page's
// localStorage (the New view's seen record) and a fixed clock. B1_ROOT may point the tests at another copy (the untouched
// baseline) to see them fail there. The suite runs in one process: modules are shared, never reloaded.
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const ROOT=process.env.B1_ROOT?path.resolve(process.env.B1_ROOT):path.join(__dirname,'..');
const ext=file=>path.join(ROOT,'extension',file);
const req=file=>require(ext(file));

// Thursday 2026-11-05 15:00 in New York (20:00 UTC).
const NOW=Date.parse('2026-11-05T20:00:00Z');
class FixedDate extends Date{constructor(...a){super(...(a.length?a:[NOW]));}static now(){return NOW;}}
const at=hours=>new Date(NOW+hours*3600000).toISOString();

function mount({initialState={},assignments,personal={},seen,courses,extra={}}={}){
 const Core=req('core.js'),Model=req('dashboard-model.js');let subscriber;
 const events={},saved=new Map(),local=new Map(),frames=new Map();let frame=0;let data={settings:{theme:'light'},tasks:{},...personal};
 if(seen)local.set('reserve:seen-work:5',JSON.stringify(seen));
 const element={className:'',dataset:{},style:{setProperty(){},getPropertyValue(){return '';}},setAttribute(){},getAttribute(){return null;},addEventListener:(k,v)=>events[k]=v,removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],remove(){},innerHTML:''};
 const store={owner:{origin:'https://school.instructure.com',accountId:'5'},get:()=>structuredClone(data),subscribe:fn=>{subscriber=fn;return ()=>{};},update:async fn=>{fn(data);subscriber(structuredClone(data));}};
 const context={ReserveSite:{...require(ext('site.js')),origin:()=>'https://school.instructure.com'},URL,Intl,Date:FixedDate,Map,Set,matchMedia:()=>({matches:false}),document:{createElement:()=>element,addEventListener(){},removeEventListener(){}},
  sessionStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},localStorage:{getItem:k=>local.has(k)?local.get(k):null,setItem:(k,v)=>local.set(k,String(v))},
  setInterval:()=>0,clearInterval(){},setTimeout:(fn,ms)=>{if(ms)return 0;const id=++frame;frames.set(id,fn);setImmediate(()=>{if(frames.delete(id))fn();});return id;},clearTimeout:id=>frames.delete(id),
  ReservePersonalWork:{normalize:(d,c)=>req('personal-work.js').normalize(structuredClone(d),structuredClone(c))},ReserveUI:req('ui-utils.js'),ReserveCore:Core,ReserveDashboardModel:Model,ReserveWorkModel:req('work-model.js'),ReserveDashboardView:req('dashboard-view.js')};
 context.ReserveCourseHubUI={create:()=>({getCourse:()=>null,renderHub:()=>'',loadCourse(){},renderDeck:()=>'',loadDeck(){},destroy(){}})};
 Object.assign(context,extra);
 vm.runInNewContext(fs.readFileSync(ext('dashboard.js'),'utf8'),context);
 const snapshot={user:{id:'5'},courses:courses||[{id:'7',name:'Chemistry',enrollments:[{type:'student'}]},{id:'8',name:'History',enrollments:[{type:'student'}]}],
  assignments:assignments||[{id:'17',course_id:'7',name:'Gas laws',due_at:at(30),submission_types:['online_upload'],submission:{workflow_state:'unsubmitted'}},{id:'18',course_id:'8',name:'Essay draft',due_at:at(50),submission_types:['online_upload'],submission:{workflow_state:'unsubmitted'}}]};
 const view=context.ReserveDashboard.mount({append(){}},{snapshot,store,initialState:{workspace:'work',...initialState}});
 const click=(action,dataset={})=>events.click({detail:0,target:{closest:selector=>selector==='[data-rd-action]'?{dataset:{rdAction:action,...dataset},getAttribute:()=>null}:null}});
 return {view,element,events,click,local,get data(){return data;},html:()=>element.innerHTML};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

module.exports={ROOT,ext,req,NOW,at,mount,settle};
