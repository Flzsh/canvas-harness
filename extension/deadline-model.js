/*! Canvas Harness · Deadline observations · Original creator Flzsh · GPL-3.0-only. */
(function(root){'use strict';
 const LIMIT=100,BASELINE_LIMIT=10000,RETENTION=30*86400000,ID=/^\d{1,20}$/;
 const text=(v,n)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n);
 const instant=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
 const empty=()=>({version:1,observedAt:null,baseline:[],history:[]});
 function clean(value){
  if(value==null)return empty();
  if(value.version!==1||!Array.isArray(value.baseline)||!Array.isArray(value.history)||value.baseline.length>BASELINE_LIMIT||value.history.length>LIMIT)throw Error('Saved deadline observations could not be read.');
  const observedAt=instant(value.observedAt),seen=new Set();
  const baseline=value.baseline.map(a=>{if(!a||!ID.test(a.id)||!ID.test(a.courseId)||a.dueAt!==null&&!instant(a.dueAt))throw Error('Invalid saved deadline.');const key=a.courseId+':'+a.id;if(seen.has(key))throw Error('Duplicate saved deadline.');seen.add(key);return {id:a.id,courseId:a.courseId,dueAt:a.dueAt===null?null:instant(a.dueAt)};});
  const ids=new Set(),history=value.history.map(h=>{if(!h||!ID.test(h.assignmentId)||!ID.test(h.courseId)||typeof h.id!=='string'||h.id.length>100||ids.has(h.id)||!instant(h.observedAt)||h.before!==null&&!instant(h.before)||h.after!==null&&!instant(h.after))throw Error('Invalid deadline change.');ids.add(h.id);return {id:h.id,assignmentId:h.assignmentId,courseId:h.courseId,title:text(h.title,250),course:text(h.course,180),before:h.before===null?null:instant(h.before),after:h.after===null?null:instant(h.after),observedAt:instant(h.observedAt),read:h.read===true};});
  if((baseline.length||history.length)&&!observedAt)throw Error('Saved deadline observation date is invalid.');
  return {version:1,observedAt,baseline,history};
 }
 function observe(value,snapshot,now=Date.now()){
  const previous=clean(value),observedAt=instant(snapshot?.fetchedAt),stamp=Date.parse(observedAt);
  if(!observedAt||stamp>now+300000||previous.observedAt&&stamp<=Date.parse(previous.observedAt))return previous;
  if(!Array.isArray(snapshot.courses)||!Array.isArray(snapshot.assignments))throw Error('A fresh Canvas snapshot is required.');
  const failed=new Set((snapshot.errors||[]).map(e=>String(e.courseId))),courses=new Map(snapshot.courses.filter(c=>ID.test(String(c.id))).map(c=>[String(c.id),c]));
  // An unexplained partial response cannot authoritatively update any course baseline.
  if(snapshot.partial&&(!failed.size||failed.has('undefined')))return previous;
  const safeCourses=new Set([...courses.keys()].filter(id=>!failed.has(id))),old=new Map(previous.baseline.map(a=>[a.courseId+':'+a.id,a])),next=new Map(old),seen=new Set(),changes=[];
  for(const a of snapshot.assignments){const id=String(a.id),courseId=String(a.course_id);if(!ID.test(id)||!safeCourses.has(courseId))continue;const key=courseId+':'+id;if(seen.has(key))throw Error('Canvas returned duplicate assignments.');seen.add(key);
   if(!Object.prototype.hasOwnProperty.call(a,'due_at')||a.due_at!==null&&!instant(a.due_at)){safeCourses.delete(courseId);continue;}
   const dueAt=a.due_at==null?null:instant(a.due_at),before=old.get(key);
   if(before&&before.dueAt!==dueAt)changes.push({id:courseId+':'+id+':'+stamp,assignmentId:id,courseId,title:text(a.name,250)||'Assignment',course:text(courses.get(courseId).name,180)||'Course',before:before.dueAt,after:dueAt,observedAt,read:false});
   next.set(key,{id,courseId,dueAt});
  }
  // Invalid or failed courses retain their entire previous baseline, not a partial list.
  for(const [key,a]of next)if(!safeCourses.has(a.courseId)){if(old.has(key))next.set(key,old.get(key));else next.delete(key);}else if(!seen.has(key))next.delete(key);
  if(!snapshot.partial)for(const [key,a]of next)if(!courses.has(a.courseId))next.delete(key);
  const history=[...changes.filter(c=>safeCourses.has(c.courseId)),...previous.history].filter(h=>Date.parse(h.observedAt)>=now-RETENTION).sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt)||a.id.localeCompare(b.id)).slice(0,LIMIT);
  if(next.size>BASELINE_LIMIT)throw Error('There are too many assignments to track deadline changes.');
  return clean({version:1,observedAt,baseline:[...next.values()],history});
 }
 function acknowledge(value,ids){const next=clean(value),seen=new Set(ids);next.history=next.history.map(h=>seen.has(h.id)?{...h,read:true}:h);return next;}
 const api=Object.freeze({empty,clean,observe,acknowledge,LIMIT,RETENTION});root.ReserveDeadlineModel=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
