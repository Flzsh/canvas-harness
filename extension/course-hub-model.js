/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function(root,factory){
  'use strict';
  var api=factory();
  root.ReserveCourseHubModel=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var ORIGIN=(globalThis.ReserveSite.origin());

  function text(value){return value==null?'':String(value);}
  function safeURL(value){
    if(typeof value!=='string'||!value.trim())return '';
    try{
      var url=new URL(value.trim(),ORIGIN+'/');
      if(url.origin!==ORIGIN||url.protocol!=='https:'||url.username||url.password)return '';
      if(/^\/api(?:\/|$)/i.test(url.pathname))return '';
      return url.href;
    }catch(_error){return '';}
  }
  function iso(value){
    if(value==null||value==='')return null;
    var date=new Date(value);
    return Number.isFinite(date.getTime())?date.toISOString():null;
  }
  function compareRecent(left,right,field){
    var a=left[field]?Date.parse(left[field]):NaN,b=right[field]?Date.parse(right[field]):NaN;
    if(Number.isFinite(a)&&Number.isFinite(b)&&a!==b)return b-a;
    if(Number.isFinite(a)!==Number.isFinite(b))return Number.isFinite(a)?-1:1;
    var leftId=text(left.id),rightId=text(right.id);
    return leftId<rightId?-1:leftId>rightId?1:0;
  }
  function courseURL(value,courseId){
    var href=safeURL(value);
    if(!href)return '';
    try{
      var url=new URL(href),prefix='/courses/'+encodeURIComponent(courseId);
      return url.pathname===prefix||url.pathname.startsWith(prefix+'/')?href:'';
    }catch(_error){return '';}
  }
  function announcementVisible(value){
    return !!value&&value.published!==false&&value.workflow_state!=='deleted'&&!value.deleted_at&&value.locked!==true&&value.locked_for_user!==true&&value.user_can_see_posts!==false;
  }
  function authorName(value){
    if(typeof value?.user_name==='string')return value.user_name;
    if(typeof value?.author?.display_name==='string')return value.author.display_name;
    if(typeof value?.author?.name==='string')return value.author.name;
    if(typeof value?.author_name==='string')return value.author_name;
    return '';
  }
  function normalizeUpdates(raw){
    raw=raw&&typeof raw==='object'?raw:{};
    var courseId=/^\d+$/.test(text(raw.courseId))?text(raw.courseId):'';
    var announcements=(Array.isArray(raw.announcements)?raw.announcements:[]).filter(announcementVisible).map(function(item){
      return {
        id:text(item.id),
        title:text(item.title),
        body:typeof item.message==='string'?item.message:typeof item.body==='string'?item.body:'',
        author:authorName(item),
        postedAt:iso(item.posted_at),
        url:courseId?courseURL(item.html_url,courseId):'',
        unread:item.read_state==='unread',
      };
    }).filter(item=>item.id).sort(function(a,b){return compareRecent(a,b,'postedAt');});

    var seen=new Set();
    var tabs=(Array.isArray(raw.tabs)?raw.tabs:[]).filter(function(tab){
      if(!tab||tab.hidden===true)return false;
      var visibility=text(tab.visibility).toLowerCase();
      return visibility!=='admins'&&visibility!=='none';
    }).map(function(tab,index){
      var url=courseId?courseURL(tab.html_url,courseId):'';
      return {id:text(tab.id),label:text(tab.label),url,type:text(tab.type),position:Number.isFinite(Number(tab.position))?Number(tab.position):Number.MAX_SAFE_INTEGER,index};
    }).filter(function(tab){
      if(!tab.id||!tab.label||!tab.url||seen.has(tab.id))return false;
      seen.add(tab.id);return true;
    }).sort(function(a,b){return a.position-b.position||a.index-b.index;}).map(function(tab){return {id:tab.id,label:tab.label,url:tab.url,type:tab.type};});
    return {announcements,tabs};
  }
  function normalizeInbox(raw){
    var source=Array.isArray(raw)?raw:Array.isArray(raw?.conversations)?raw.conversations:[];
    return source.map(function(item){
      var id=text(item?.id);
      if(!/^\d+$/.test(id))return null;
      var context=text(item.context_code),match=/^course_(\d+)$/.exec(context);
      var courseId=match?match[1]:null;
      return {
        id,
        subject:text(item.subject),
        excerpt:text(item.last_message),
        updatedAt:iso(item.last_message_at),
        url:ORIGIN+'/conversations/'+encodeURIComponent(id),
        unread:item.workflow_state==='unread',
        courseId,
        courseName:text(item.context_name),
      };
    }).filter(Boolean).sort(function(a,b){return compareRecent(a,b,'updatedAt');});
  }
  return {normalizeUpdates,normalizeInbox,safeURL};
});
