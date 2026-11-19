'use strict';
const {randomUUID}=require('node:crypto');
const Study=require('../extension/study-prompts.js');
const tick=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));};
const question=(type,i)=>type==='mc'?{type,q:`Question ${i}?`,choices:['a','b','c','d'],answer:1,why:'Because.',miss:['Wrong idea.','','Other idea.','Another idea.'],src:'p. 1',level:1}:type==='tf'?{type,q:`Statement ${i}.`,answer:false,why:'Because.',src:'p. 2',level:2}:{type,q:`Short ${i}?`,answer:'A short answer.',why:'Because.',src:'p. 1',level:2};
const practice=()=>({v:1,kind:'practice',title:'Practice',items:['mc','mc','mc','mc','mc','short','short','short','tf','tf'].map(question),gaps:['Missing detail.']});
const reading=()=>({v:1,kind:'reading',title:'Reading',points:Array.from({length:5},(_,i)=>({text:'Point '+i,src:'p. '+i})),terms:Array.from({length:4},(_,i)=>({term:'Term '+i,means:'Meaning '+i,src:'p. '+i})),check:Array.from({length:4},(_,i)=>({q:'Check '+i,answer:'Answer '+i,src:'p. '+i})),gaps:[]});
const lab=()=>({v:1,kind:'lab',title:'Lab',materials:['String'],safety:['Wear goggles.'],steps:[{text:'Tie the mass.',src:'Step 1'}],tables:[{title:'Length',columns:['Length (m)','Period (s)'],rows:5},{title:'Other',columns:['Time (s)'],rows:2}],prelab:[{q:'What changes?',answer:'The length.',src:'Q'},{q:'Two?',answer:'Two trials.',src:'Q'},{q:'Three?',answer:'x',src:'Q'}],gaps:['No further details.']});
const wrap=data=>'```chstudy\n'+JSON.stringify(data)+'\n```';
const rubric=()=>({v:1,kind:'rubric',title:'Essay rubric',requirements:[{text:'Include a title',src:'Assignment'},{text:'Include references',src:'Instructions'}],criteria:[{name:'Evidence',points:'8',checks:['Cite the sources','Explain each example'],up:'Connect evidence to the claim',src:'Rubric row 1'},{name:'Organization',points:'',checks:['Order the sections'],up:'',src:'Rubric row 2'}],gaps:['Word count']});
const notes=()=>({v:1,kind:'notes',title:'Plate tectonics notes',sections:Array.from({length:3},(_,i)=>({heading:'Plate movement '+i,src:'p. '+(i+1),prompts:['Why do the plates move?','How does the evidence connect?']})),terms:Array.from({length:4},(_,i)=>({term:'Term '+i,src:'p. '+(i+1)})),summary:'How does plate movement change the surface?',gaps:['Which pages are assigned?']});
function storage(){const saved={},writes=[];return {saved,writes,async get(key){return structuredClone({[key]:saved[key]});},async set(values){writes.push(structuredClone(values));Object.assign(saved,structuredClone(values));}};}
function dom(){
 const nodes=[],ids=new Map();
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};this.handlers=new Map();this.value='';this.hidden=false;this.disabled=false;this.className='';this._text='';nodes.push(this);}
  get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}set textContent(value){this._text=String(value);this.children=[];}
  set innerHTML(_value){throw Error('HTML sink used');}set outerHTML(_value){throw Error('HTML sink used');}insertAdjacentHTML(){throw Error('HTML sink used');}
  append(...values){for(const n of values){n.parentNode=this;this.children.push(n);}}replaceChildren(...values){this.children=[];this._text='';this.append(...values);}
  setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}
  addEventListener(name,fn){this.handlers.set(name,fn);}focus(){document.activeElement=this;}select(){}
  fire(name,extra={}){if(name==='click'&&this.disabled)return;return this.handlers.get(name)?.({target:this,preventDefault(){},...extra});}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}
  get classList(){return {toggle:(key,on)=>{const names=new Set(this.className.split(' ').filter(Boolean));if(on)names.add(key);else names.delete(key);this.className=[...names].join(' ');}};}
 }
 const document={documentElement:new Element('html'),body:new Element('body'),getElementById(id){if(!ids.has(id))ids.set(id,new Element());return ids.get(id);},createElement:tag=>new Element(tag),querySelectorAll:()=>[],querySelector:()=>null};
 return {document,nodes,get:id=>document.getElementById(id),Element};
}
function panelFixture(options={}){
 const d=dom(),saved=options.storage||storage(),requests=[],messages=[],disconnects=[],events=new Map(),copied=[],permissionRequests=[],timeouts=[];
 const catalog=options.catalog||{scopeKey:'https://school.instructure.com|7|c1|a',active:{id:'a',title:'Assignment A',courseId:'c1',courseName:'Biology',due:'2026-10-21'},courseId:'c1',courses:[{id:'c1',name:'Biology'}],sources:[{id:'a',title:'Instructions A',kind:'assignment',courseId:'c1'},{id:'b',title:'Reading B',kind:'page',courseId:'c1'}]};
 if(options.apiSettings)catalog.apiSettings=options.apiSettings;if(options.overnightSettings)catalog.overnightSettings=options.overnightSettings;
 const receive=message=>messages.forEach(fn=>fn(message));
 const collect=options.collect||((data)=>({scopeKey:catalog.scopeKey,text:data.ids.map(id=>'Body '+id).join('\n'),included:data.ids.map(id=>({id,title:catalog.sources.find(s=>s.id===id)?.title||id})),sources:data.ids.map(id=>({id,label:catalog.sources.find(s=>s.id===id)?.title||id,text:'Body '+id})),omitted:[]}));
 const port={onMessage:{addListener:fn=>messages.push(fn),removeListener(){}},onDisconnect:{addListener:fn=>disconnects.push(fn),removeListener(){}},disconnect(){},postMessage(request){requests.push(request);queueMicrotask(async()=>{try{const result=request.action==='catalog'?catalog:request.action==='collect'?await collect(request):request.action==='web'?options.web?await options.web(request):{status:options.webStatus||'injected'}:request.action==='api'&&options.api?await options.api(request):request.action==='overnight'&&options.overnight?await options.overnight(request):request.action==='agent'&&options.agent?await options.agent(request):{};receive({id:request.id,ok:true,result});}catch(e){receive({id:request.id,ok:false,error:e.message});}});}};
 const env={document:d.document,CanvasHarnessStudy:Study,CanvasHarnessStudyUI:require('../extension/study-ui.js'),crypto:{randomUUID},setTimeout(fn,ms){timeouts.push(ms);return setTimeout(fn,ms);},clearTimeout,location:{origin:'chrome-extension://test'},navigator:{clipboard:{async writeText(text){if(options.clipboardFail)throw Error('No clipboard');copied.push(text);}}},addEventListener:(name,fn)=>events.set(name,fn),chrome:{runtime:{id:'test',connect:()=>port},storage:{local:saved},permissions:{request:(value,fn)=>{permissionRequests.push(value);fn(options.permission!==false);}}}};
 const controller=require('../extension/ai-panel.js').mount(env);
 return {...d,env,storage:saved,controller,requests,copied,catalog,receive,permissionRequests,timeouts,disconnect(){disconnects.forEach(fn=>fn());},close(){events.get('pagehide')();}};
}
const descendants=node=>[node,...node.children.flatMap(descendants)];
const button=(node,label)=>descendants(node).find(n=>n.tagName==='BUTTON'&&n.textContent===label);
module.exports={Study,tick,practice,reading,lab,rubric,notes,wrap,storage,dom,panelFixture,descendants,button};
