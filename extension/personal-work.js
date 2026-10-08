/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function(root,factory){
  'use strict';
  const api=factory();
  root.ReservePersonalWork=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const ORIGIN=(globalThis.ReserveSite.origin());
  const PERSONAL_COLOR='#7c718d';
  const SOURCE_KINDS=new Set(['message','announcement','material','course-home','link']);

  function record(value){
    if(value===null||typeof value!=='object'||Array.isArray(value))return false;
    const proto=Object.getPrototypeOf(value);
    return proto===Object.prototype||proto===null;
  }

  function safeSource(value){
    if(!record(value))return null;
    const kind=typeof value.kind==='string'?value.kind.trim():'';
    if(!SOURCE_KINDS.has(kind))return null;
    if(value.title!==undefined&&typeof value.title!=='string')return null;
    const title=(value.title||'').trim();
    if(title.length>200||typeof value.url!=='string')return null;
    const target=value.url.trim();
    if(!target||target.length>2048||target.startsWith('//')||/[\\\u0000-\u001f\u007f]/.test(target))return null;
    let url;
    try{
      if(target.startsWith('/')){url=new URL(target,ORIGIN);if(url.origin!==ORIGIN)return null;}
      else url=new URL(target);
    }catch{return null;}
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.href.length>2048)return null;
    return {kind,title,url:url.href};
  }

  function optionalDate(value){
    if(value===null||value===undefined||value==='')return null;
    if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))return null;
    return value;
  }

  function normalize(personal,courses){
    if(!record(personal)||!Array.isArray(personal.customTasks))return [];
    const visible=new Map();
    if(Array.isArray(courses))for(const course of courses){
      if(!record(course))continue;
      const id=String(course.id==null?'':course.id);
      if(!/^\d+$/.test(id))continue;
      visible.set(id,{name:typeof course.name==='string'?course.name:'',color:typeof course.color==='string'?course.color:''});
    }
    const states=record(personal.tasks)?personal.tasks:{};
    const seen=new Set(),out=[];
    for(const item of personal.customTasks){
      try{
        if(!record(item)||typeof item.id!=='string'||!/^local-[\w-]+$/.test(item.id)||seen.has(item.id))continue;
        if(typeof item.name!=='string'||!item.name.trim())continue;
        const courseId=item.courseId==='personal'?'personal':String(item.courseId==null?'':item.courseId);
        let course;
        if(courseId==='personal')course={name:'Personal',color:PERSONAL_COLOR};
        else{
          if(!/^\d+$/.test(courseId))continue;
          course=visible.get(courseId);
          if(!course)continue;
        }
        seen.add(item.id);
        const source=item.source==null?null:safeSource(item.source);
        const state=record(states[item.id])&&states[item.id].progress==='done'?'done':'personal';
        const normalized={
          id:item.id,
          name:item.name.slice(0,200),
          courseId,
          courseName:course.name,
          color:course.color,
          courseColor:course.color,
          personal:true,
          state,
          dueAt:optionalDate(item.dueAt),
          createdAt:optionalDate(item.createdAt),
          url:'',
          description:'',
          points:null,
          score:null,
          grade:null,
          submissionTypes:[],
          rubric:[],
          missing:false,
          redoRequested:false,
          submittedAt:null,
        };
        if(source)normalized.source=source;
        out.push(normalized);
      }catch{}
    }
    return out;
  }

  return {normalize,safeSource};
});
