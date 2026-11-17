'use strict';
// The dashboard on a small DOM (job X): its own node, plus a separate node for anything appended to it (the change
// note). Used by selection-band-steady.test.cjs and change-note.test.cjs. fixture(personalData, extraAssignments).
const vm=require('node:vm'),fs=require('node:fs');
const View=require('../extension/dashboard-view.js');
function fixture(personalData={},extraAssignments=[]){
 const Core=require('../extension/core.js'),Model=require('../extension/dashboard-model.js');let subscriber;const timers=[];
 const events={},saved=new Map(),frames=new Map();let frame=0;let data={settings:{theme:'light'},tasks:{},...personalData};
 const appended=[];
 const element={className:'',dataset:{},style:{setProperty(){}},setAttribute(){},addEventListener:(k,v)=>events[k]=v,removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],remove(){},innerHTML:'',append:n=>{n.parentNode=element;appended.push(n);},hasAttribute:()=>false};
 class Fake{constructor(tag){this.tagName=String(tag).toUpperCase();this.attrs=new Map();this.children=[];this.className='';this.hidden=false;this.textContent='';this._html='';this.listeners={};this.parentNode=null;this.dataset={};}
  setAttribute(k,v){this.attrs.set(k,String(v));}getAttribute(k){return this.attrs.has(k)?this.attrs.get(k):null;}removeAttribute(k){this.attrs.delete(k);}hasAttribute(k){return this.attrs.has(k);}
  append(...nodes){for(const n of nodes){n.parentNode=this;this.children.push(n);}}addEventListener(k,fn){this.listeners[k]=fn;}
  set innerHTML(v){this._html=v;}get innerHTML(){return this._html;}replaceChildren(){this._html='';}
  querySelectorAll(sel){if(sel==='[data-note-id]')return [...this._html.matchAll(/data-note-id="([^"]+)"/g)].map(m=>({getAttribute:()=>m[1],setAttribute(){}})).concat(...this.children.map(c=>c.querySelectorAll(sel)));return [];}
  querySelector(){return null;}contains(){return false;}matches(){return false;}
  get html(){return this.children.map(c=>c._html).join('');}}
 let made=0;
 const store={owner:{origin:'https://school.instructure.com',accountId:'5'},get:()=>structuredClone(data),subscribe:fn=>{subscriber=fn;return ()=>{};},update:async fn=>{if(store.fail)throw Error('Storage is full');fn(data);subscriber(structuredClone(data));}};
 const context={ReserveSite:{...require('../extension/site.js'),origin:()=>'https://school.instructure.com'},URL,Intl,Date,Map,Set,matchMedia:()=>({matches:false}),document:{createElement:tag=>made++===0?element:new Fake(tag),addEventListener(){},removeEventListener(){}},sessionStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},localStorage:{getItem:k=>saved.get('ls:'+k)??null,setItem:(k,v)=>saved.set('ls:'+k,v)},setInterval:()=>0,clearInterval(){},
  setTimeout:(fn,ms)=>{if(ms){timers.push({fn,ms});return 1e6+timers.length;}const id=++frame;frames.set(id,fn);setImmediate(()=>{if(frames.delete(id))fn();});return id;},clearTimeout:id=>{frames.delete(id);if(id>1e6&&timers[id-1e6-1])timers[id-1e6-1].fn=null;},   // (a delayed timer's id never equals a next-turn one's: clearing one must not cancel the other)
 
  ReservePersonalWork:{normalize:(d,courses)=>require('../extension/personal-work.js').normalize(structuredClone(d),structuredClone(courses))},ReserveUI:require('../extension/ui-utils.js'),ReserveCore:Core,ReserveDashboardModel:Model,ReserveWorkModel:require('../extension/work-model.js'),ReserveSettingsDock:require('../extension/settings-dock.js'),ReserveDashboardView:View,ReserveCustomizeUI:require('../extension/customize-ui.js'),
  ReserveToolbox:{create:()=>({update(){},destroy(){},close(){},open(){},isOpen:()=>false})}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../extension/dashboard.js'),'utf8'),context);
 const soon=new Date(Date.now()+86400000).toISOString();
 const snapshot={courses:[{id:'7',name:'Chemistry',enrollments:[{type:'student'}]},{id:'8',name:'English',enrollments:[{type:'student'}]}],assignments:[{id:'17',course_id:'7',name:'Gas laws',due_at:soon,submission_types:['online_upload'],submission:{workflow_state:'unsubmitted'}},{id:'18',course_id:'8',name:'Essay draft',due_at:soon,submission_types:['online_upload'],submission:{workflow_state:'unsubmitted'}},{id:'19',course_id:'7',name:'Rates lab',due_at:soon,submission_types:['on_paper'],submission:{workflow_state:'unsubmitted'}},...extraAssignments]};
 const view=context.ReserveDashboard.mount({append(){}},{snapshot,store,initialState:{workspace:'work'}});
 const click=(action,id)=>events.click({detail:0,target:{closest:()=>({dataset:{rdAction:action,id}})}});
 const note=()=>appended.find(n=>n.className==='rd-note')||null;
 const fire=ms=>{for(const t of timers)if(t.ms===ms&&t.fn){const fn=t.fn;t.fn=null;fn();}};
 return {view,element,click,note,fire,saved,store,get data(){return data;}};
}
const idle=()=>new Promise(setImmediate);
module.exports={fixture,idle};
