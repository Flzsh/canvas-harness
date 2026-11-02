'use strict';
// A small fake Canvas behind the real client, scan and runner, so a situation test sees the prompt the AI would get.
// Every call is a GET; anything else fails the test. Names here are neutral samples.
const assert=require('node:assert/strict');
globalThis.ReserveUI||={escapeHTML:s=>String(s)};
const API=require('../extension/api.js'),Canvas=require('../extension/ai-canvas.js'),Runner=require('../extension/ai-runner.js'),Site=require('../extension/site.js');
const origin=Site.origin(),scope=origin+'|7',now=Date.parse('2026-10-21T16:00:00Z'),day=864e5,at=days=>new Date(now+days*day).toISOString();
function reply(value,{status=200,headers={},url}={}){const text=typeof value==='string'?value:JSON.stringify(value),h=Object.fromEntries(Object.entries({'content-type':'application/json',...headers}).map(([k,v])=>[k.toLowerCase(),String(v)]));return {ok:status>=200&&status<300,status,url,headers:{get:k=>h[String(k).toLowerCase()]??null},json:async()=>JSON.parse(text),text:async()=>text};}
const fileBody=text=>{const bytes=new TextEncoder().encode(text);let done=false;return {getReader:()=>({read:async()=>{if(done)return {done:true};done=true;return {done:false,value:bytes};},cancel:async()=>{done=true;},releaseLock(){}})};};
// spec: courses, assignments {cid:[...]}, pages {cid:[...]}, files {cid:[...]}, bodies {fileId:text}, modules {cid:[...]},
// announcements {cid:[...]}, syllabus {cid:html}, front {cid:page}, routes [{match,status,body,headers,times}] (first match wins).
function world(spec={}){
 const courses=spec.courses||[{id:'1',name:'Sample Science',teachers:[{id:'2'}],enrollments:[{type:'student',enrollment_state:'active'}]}],calls=[],routes=(spec.routes||[]).map(r=>({...r,used:0}));
 const of=(table,cid)=>(table||{})[cid]||[];
 const fetchImpl=async(url,options={})=>{assert.equal(options.method||'GET','GET','Canvas is read-only');const u=new URL(url),p=u.pathname,full=p+decodeURIComponent(u.search);calls.push(full);
  for(const r of routes)if(r.match.test(full)&&(r.times==null||r.used<r.times)){r.used++;return reply(r.body??{errors:[{message:'unavailable'}]},{status:r.status??200,headers:r.headers,url:String(url)});}
  let m,value=[];
  if(p==='/api/v1/users/self/profile')value={id:'7',name:'Sample Student'};
  else if(p==='/api/v1/courses')value=courses;
  else if((m=p.match(/^\/api\/v1\/courses\/(\d+)$/)))value={id:m[1],name:courses.find(c=>String(c.id)===m[1])?.name,syllabus_body:spec.syllabus?.[m[1]]??null};
  else if((m=p.match(/^\/api\/v1\/courses\/(\d+)\/assignments$/)))value=of(spec.assignments,m[1]);
  else if((m=p.match(/^\/api\/v1\/courses\/(\d+)\/assignments\/(\d+)$/))){value=of(spec.assignments,m[1]).find(a=>String(a.id)===m[2]);if(!value)return reply({errors:[{message:'not found'}]},{status:404,url:String(url)});}
  else if((m=p.match(/^\/api\/v1\/courses\/(\d+)\/pages$/)))value=of(spec.pages,m[1]).map(({body,...row})=>row);
  else if((m=p.match(/^\/api\/v1\/courses\/(\d+)\/pages\/([^/]+)$/))){value=of(spec.pages,m[1]).find(x=>x.url===decodeURIComponent(m[2]));if(!value)return reply({errors:[{message:'not found'}]},{status:404,url:String(url)});}
  else if((m=p.match(/^\/api\/v1\/courses\/(\d+)\/front_page$/))){value=spec.front?.[m[1]];if(!value)return reply({message:'No front page has been set'},{status:404,url:String(url)});}
  else if((m=p.match(/^\/api\/v1\/courses\/(\d+)\/files$/)))value=of(spec.files,m[1]);
  else if((m=p.match(/^\/api\/v1\/courses\/(\d+)\/files\/(\d+)$/))){value=of(spec.files,m[1]).find(f=>String(f.id)===m[2]);if(!value)return reply({errors:[{message:'not found'}]},{status:404,url:String(url)});}
  else if((m=p.match(/^\/api\/v1\/courses\/(\d+)\/modules$/)))value=of(spec.modules,m[1]);
  else if(p==='/api/v1/announcements')value=of(spec.announcements,/course_(\d+)/.exec(full)?.[1]);
  else if((m=p.match(/^\/files\/(\d+)\/download$/))){const body=spec.bodies?.[m[1]];if(body==null)return reply('',{status:404,url:String(url)});const text=typeof body==='string'?body:body.text;return {...reply(text,{headers:{'content-type':body.type||'text/plain'},url:String(url)}),body:fileBody(text)};}
  return reply(value,{url:String(url)});
 };
 return {fetchImpl,calls,routes};
}
function harness(spec={}){
 const w=world(spec),client=spec.client||API.createClient({origin,fetchImpl:w.fetchImpl,retryDelays:spec.retryDelays||[],wait:async()=>{},requestLimit:spec.requestLimit});
 const data={settings:{timeZone:spec.zone||'America/New_York',showGrades:false},customTasks:[],tasks:{},toolbox:{agent:{settings:{on:true}},aiTeacherFeedback:false}},store={get:()=>data,sync:async()=>{}};
 const canvas=Canvas.create({client,store,scope,local:{get:async()=>({})},fetchImpl:w.fetchImpl,now:()=>now,parsePDF:spec.parsePDF});let turn=0,saved=null;
 const runner=Runner.create({canvas,account:store,results:{saveCards:async(run,cards,refs,{at=0}={})=>{saved=[...(at?(saved||[]).slice(0,at):[]),...cards];return cards.length;}},adapter:{},docs:{read:async()=>({error:'paste'})},now:()=>now,uuid:()=>'u'+(++turn)});
 const ctx={save:async r=>r,guard:async()=>{},signal:new AbortController().signal};
 // Steps a run to the prompt it would send; a thrown error is the run stopping.
 async function drive(run){for(let n=0;n<200&&run.state!=='awaiting-reply'&&run.state!=='unchanged';n++)await runner.step(run,ctx);return run;}
 const base=extra=>({id:'run',scope,state:'queued',turns:[],errors:[],instructions:{standingText:''},settings:{},day:'2026-10-21',entry:'manual',...extra});
 return {...w,client,canvas,data,drive,step:run=>runner.step(run,ctx),saved:()=>saved,
  async prepare(){const run=await drive(base({}));return {run,prompt:String(run.messages?.[0]?.content||''),brief:run.snapshot?.brief?.text||''};},
  async help(itemId,courseId='1',title='This item'){const run=await drive(base({kind:'ask',make:'auto',question:'',itemId:String(itemId),courseId,itemTitle:title}));return {run,prompt:String(run.messages?.[0]?.content||'')};},
  async ask(question){const run=await drive(base({kind:'ask',question}));return {run,prompt:String(run.messages?.[0]?.content||'')};},
  scan:()=>canvas.scan(base({}),new AbortController().signal)};
}
const task=(o={})=>({id:'21',name:'Sample task',description:'<p>Finish the sample task.</p>',due_at:at(2),points_possible:10,submission_types:['online_upload'],published:true,course_id:'1',...o});
module.exports={world,harness,reply,task,origin,scope,now,at,day};
