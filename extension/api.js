/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function (root) {
  'use strict';
  class CanvasError extends Error { constructor(message, code = 'network') { super(message); this.name = 'CanvasError'; this.code = code; } }
  function createClient({origin = (globalThis.ReserveSite.origin()), fetchImpl = root.fetch.bind(root), timeout = 15000} = {}) {
    if (!globalThis.ReserveSite.supported(origin)) throw new CanvasError('Use your school’s HTTPS Canvas site on instructure.com.', 'origin');
    const base = new URL(origin);
    const allowed = [
      /^\/api\/v1\/users\/self\/profile\/?$/,
      /^\/api\/v1\/courses\/?$/,
      /^\/api\/v1\/courses\/\d+\/?$/,
      /^\/api\/v1\/courses\/\d+\/assignments(?:\/\d+)?\/?$/,
      /^\/api\/v1\/courses\/\d+\/modules\/?$/,
      /^\/api\/v1\/courses\/\d+\/modules\/\d+\/items\/?$/,
      /^\/api\/v1\/courses\/\d+\/pages\/?$/,
      /^\/api\/v1\/courses\/\d+\/pages\/[^/]+\/?$/,
      /^\/api\/v1\/courses\/\d+\/front_page\/?$/,
      /^\/api\/v1\/courses\/\d+\/files(?:\/\d+)?\/?$/,
      /^\/api\/v1\/courses\/\d+\/tabs\/?$/,
      /^\/api\/v1\/announcements\/?$/,
      /^\/api\/v1\/conversations\/?$/,
      /^\/api\/v1\/conversations\/\d+\/?$/,
    ];
    function unsafeRawPath(value) {
      const text=String(value == null ? '' : value);
      return /%2f|%5c|%2e/i.test(text) || /\\/.test(text) || /(?:^|\/)\.{1,2}(?:\/|\?|#|$)/.test(text);
    }
    function urlFor(path) {
      if (unsafeRawPath(path)) throw new CanvasError('Unsupported Canvas endpoint path.', 'endpoint');
      const url = new URL(path, base);
      if (url.origin !== base.origin) throw new CanvasError('Canvas returned a page outside the allowed origin.', 'origin');
      if (!allowed.some(pattern=>pattern.test(url.pathname)) || url.username || url.password) throw new CanvasError('Unsupported Canvas endpoint path.', 'endpoint');
      if(/^\/api\/v1\/conversations\/\d+\/?$/.test(url.pathname)&&(url.searchParams.getAll('auto_mark_as_read').length!==1||url.searchParams.get('auto_mark_as_read')!=='false'))throw new CanvasError('Message previews must preserve read status.', 'endpoint');
      return url;
    }
    async function request(path, {signal} = {}) {
      if (signal?.aborted) throw new CanvasError('Refresh cancelled.', 'cancelled');
      const url = urlFor(path), controller = new AbortController();
      const abort = () => controller.abort();
      if (signal?.aborted) controller.abort();
      signal?.addEventListener('abort', abort, {once:true});
      const timer = setTimeout(abort, timeout);
      try {
        const response = await fetchImpl(url.href, {method:'GET', credentials:'same-origin', headers:{Accept:'application/json+canvas-string-ids'}, signal:controller.signal, redirect:'error'});
        if (response?.redirected || response?.type === 'opaqueredirect') throw new CanvasError('Canvas redirected this read request unexpectedly.', 'redirect');
        if (signal?.aborted) throw new CanvasError('Refresh cancelled.', 'cancelled');
        if (response.status === 401) throw new CanvasError('Sign in to Canvas, then refresh Canvas Harness.', 'auth');
        if (response.status === 429) throw new CanvasError('Canvas is receiving too many requests. Wait a minute, then refresh.', 'rate');
        if (!response.ok) throw new CanvasError(response.status === 403 ? 'Canvas did not allow this course to be read.' : `Canvas could not load this information (${response.status}).`, String(response.status));
        if (!(response.headers.get('content-type') || '').includes('json')) throw new CanvasError('Your Canvas session needs attention. Open Canvas and sign in again.', 'auth');
        let data;
        try { data = await response.json(); } catch (error) { if(controller.signal.aborted) throw error; throw new CanvasError('Canvas returned unreadable data. Try refreshing.', 'data'); }
        if (signal?.aborted) throw new CanvasError('Refresh cancelled.', 'cancelled');
        return {data, link:response.headers.get('link') || ''};
      } catch (error) {
        if (signal?.aborted) throw new CanvasError('Refresh cancelled.', 'cancelled');
        if (error instanceof CanvasError) throw error;
        if (controller.signal.aborted) throw new CanvasError('Canvas took too long to respond. Refresh to try again.', 'timeout');
        throw new CanvasError('Could not connect to Canvas. Check your connection and sign-in, then refresh.', 'network');
      } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
    }
    async function list(path, options = {}) {
      let next = urlFor(path).href; const result = [], visited = new Set();
      while (next) {
        if (visited.has(next) || visited.size >= 100) throw new CanvasError('Canvas returned an incomplete set of pages. Refresh or open the course in Canvas.', 'pagination');
        visited.add(next);
        const {data,link} = await request(next, options);
        if (!Array.isArray(data)) throw new CanvasError('Canvas returned an unexpected list. Refresh to try again.', 'data');
        result.push(...data);
        const match = link.match(/<([^>]+)>\s*;\s*rel="next"/);
        next = match ? urlFor(match[1]).href : null;
      }
      return result;
    }
    async function profile(options) {
      const {data} = await request('/api/v1/users/self/profile', options);
      if (!data || data.id == null) throw new CanvasError('Could not identify the signed-in Canvas account.', 'auth');
      return data;
    }
    function courseId(value) {
      const id=String(value == null ? '' : value);
      if (!/^\d+$/.test(id)) throw new CanvasError('Invalid Canvas course identifier.', 'endpoint');
      return id;
    }
    function expectedUser(value) {
      if (!value || value.id == null || !/^\d+$/.test(String(value.id))) throw new CanvasError('A verified Canvas account is required to load course materials.', 'auth');
      return String(value.id);
    }
    function pageSlug(value) {
      if (typeof value !== 'string') throw new CanvasError('Invalid Canvas page identifier.', 'endpoint');
      const slug=value.trim();
      if (!slug || slug.length>500 || /[\\/\u0000-\u001f\u007f]/.test(slug) || /%2f|%5c|%2e/i.test(slug) || slug==='.' || slug==='..') {
        throw new CanvasError('Invalid Canvas page identifier.', 'endpoint');
      }
      return slug;
    }
    function fatalSourceError(error) {
      return error?.code === 'auth' || error?.code === 'cancelled';
    }
    async function verifyExpectedUser(id, signal, previousId) {
      const found=await profile({signal});
      if (String(found.id)!==id || (previousId != null && String(found.id)!==String(previousId))) {
        throw new CanvasError('Your Canvas account changed. Reopen Canvas Harness before loading course materials.', 'auth');
      }
      return found;
    }
    async function runLimited(tasks, limit) {
      let cursor=0,fatal=null;
      async function worker(){
        while(cursor<tasks.length&&!fatal){
          const task=tasks[cursor++];
          try{await task();}
          catch(error){if(fatalSourceError(error)){fatal=error;throw error;}throw error;}
        }
      }
      await Promise.all(Array.from({length:Math.min(limit,tasks.length)},worker));
    }
    async function loadCourseResources(value,{user,signal}={}) {
      const id=courseId(value), accountId=expectedUser(user);
      const initialUser=await verifyExpectedUser(accountId,signal);
      const errors=[];
      let modules=[],pages=[],files=[],frontPage=null,syllabusBody='';
      function record(source,error){errors.push({source,message:String(error?.message||'Canvas could not load this source.')});}
      async function source(sourceName,fn,{ignore404=false}={}){
        try{await fn();}
        catch(error){
          if(fatalSourceError(error))throw error;
          if(ignore404&&error?.code==='404')return;
          record(sourceName,error);
        }
      }
      const tasks=[
        ()=>source('modules',async()=>{
          const rows=await list(`/api/v1/courses/${id}/modules?include[]=items&include[]=content_details&per_page=100`,{signal});
          modules=rows.map(module=>({...module,items:Array.isArray(module?.items)?module.items.slice():module?.items}));
          for(let index=0;index<modules.length;index++){
            const module=modules[index];
            const inline=Array.isArray(module?.items)?module.items:[];
            const count=Number(module?.items_count);
            const incomplete=!Array.isArray(module?.items)||(Number.isFinite(count)&&count>inline.length);
            if(!incomplete)continue;
            const moduleId=String(module?.id??'');
            if(!/^\d+$/.test(moduleId)){record('modules',new CanvasError('Canvas returned an invalid module identifier.','data'));continue;}
            try{
              const moduleItems=await list(`/api/v1/courses/${id}/modules/${moduleId}/items?include[]=content_details&per_page=100`,{signal});
              modules[index]={...module,items:moduleItems};
            }catch(error){
              if(fatalSourceError(error))throw error;
              record('modules',error);
              modules[index]={...module,items:inline};
            }
          }
        }),
        ()=>source('pages',async()=>{pages=await list(`/api/v1/courses/${id}/pages?per_page=100`,{signal});}),
        ()=>source('files',async()=>{files=await list(`/api/v1/courses/${id}/files?per_page=100`,{signal});}),
        ()=>source('frontPage',async()=>{const result=await request(`/api/v1/courses/${id}/front_page`,{signal});frontPage=result.data&&typeof result.data==='object'?result.data:null;},{ignore404:true}),
        ()=>source('syllabus',async()=>{const result=await request(`/api/v1/courses/${id}?include[]=syllabus_body`,{signal});syllabusBody=typeof result.data?.syllabus_body==='string'?result.data.syllabus_body:'';}),
      ];
      await runLimited(tasks,3);
      await verifyExpectedUser(accountId,signal,initialUser.id);
      return {origin:base.origin,accountId,courseId:id,modules,pages,files,frontPage,syllabusBody,errors,fetchedAt:new Date().toISOString()};
    }
    async function readCoursePage(courseValue,slugValue,{user,signal}={}) {
      const id=courseId(courseValue), slug=pageSlug(slugValue), accountId=expectedUser(user);
      const initialUser=await verifyExpectedUser(accountId,signal);
      const {data}=await request(`/api/v1/courses/${id}/pages/${encodeURIComponent(slug)}`,{signal});
      if(!data||typeof data!=='object')throw new CanvasError('Canvas returned an unexpected page.','data');
      if(data.locked_for_user||data.published===false)throw new CanvasError('This page is not available to your account.','403');
      await verifyExpectedUser(accountId,signal,initialUser.id);
      return typeof data.body==='string'?data.body:'';
    }
    async function readAssignment(courseValue,assignmentValue,{user,signal}={}) {
      const id=courseId(courseValue),assignmentId=courseId(assignmentValue),accountId=expectedUser(user);
      await verifyExpectedUser(accountId,signal);
      const {data}=await request(`/api/v1/courses/${id}/assignments/${assignmentId}`,{signal});
      if(!data||String(data.id)!==assignmentId||data.course_id!=null&&String(data.course_id)!==id||data.locked_for_user||data.published===false)throw new CanvasError('This assignment is not available.','403');
      await verifyExpectedUser(accountId,signal);
      return data;
    }
    async function readFile(courseValue,fileValue,{user,signal}={}) {
      const id=courseId(courseValue),fileId=courseId(fileValue),accountId=expectedUser(user);
      await verifyExpectedUser(accountId,signal);
      const {data}=await request(`/api/v1/courses/${id}/files/${fileId}`,{signal});
      if(!data||String(data.id)!==fileId||data.locked_for_user||data.hidden_for_user||data.locked||data.hidden)throw new CanvasError('This file is not available.','403');
      await verifyExpectedUser(accountId,signal);
      return data;
    }
    function availableAnnouncement(value,id) {
      if(!value||typeof value!=='object')return false;
      if(value.published===false||value.workflow_state==='deleted'||value.locked===true||value.locked_for_user===true||value.user_can_see_posts===false)return false;
      if(value.context_code&&String(value.context_code)!==`course_${id}`)return false;
      return true;
    }
    function visibleCourseTab(value) {
      if(!value||typeof value!=='object'||value.hidden===true)return false;
      const visibility=String(value.visibility||'').toLowerCase();
      return visibility!=='admins'&&visibility!=='none';
    }
    async function loadCourseUpdates(value,{user,signal}={}) {
      const id=courseId(value),accountId=expectedUser(user);
      const initialUser=await verifyExpectedUser(accountId,signal);
      const errors=[];
      let announcements=[],tabs=[];
      function record(source,error){errors.push({source,message:String(error?.message||'Canvas could not load this source.')});}
      async function source(sourceName,fn){
        try{await fn();}
        catch(error){if(fatalSourceError(error))throw error;record(sourceName,error);}
      }
      await runLimited([
        ()=>source('announcements',async()=>{
          const rows=await list(`/api/v1/announcements?context_codes[]=course_${id}&active_only=true&per_page=100`,{signal});
          announcements=rows.filter(row=>availableAnnouncement(row,id));
        }),
        ()=>source('tabs',async()=>{
          const rows=await list(`/api/v1/courses/${id}/tabs?per_page=100`,{signal});
          tabs=rows.filter(visibleCourseTab);
        }),
      ],3);
      await verifyExpectedUser(accountId,signal,initialUser.id);
      return {origin:base.origin,accountId,courseId:id,announcements,tabs,errors,fetchedAt:new Date().toISOString()};
    }
    async function listInbox({user,signal}={}) {
      const accountId=expectedUser(user);
      const initialUser=await verifyExpectedUser(accountId,signal);
      const errors=[];
      let conversations=[],truncated=false;
      try{
        const {data,link}=await request('/api/v1/conversations?per_page=100',{signal});
        if(!Array.isArray(data))throw new CanvasError('Canvas returned an unexpected inbox list. Refresh to try again.','data');
        truncated=data.length>100||/<([^>]+)>\s*;\s*rel="next"/.test(link);
        conversations=data.slice(0,100);
      }catch(error){
        if(fatalSourceError(error))throw error;
        errors.push({source:'conversations',message:String(error?.message||'Canvas could not load inbox summaries.')});
      }
      await verifyExpectedUser(accountId,signal,initialUser.id);
      return {origin:base.origin,accountId,conversations,errors,truncated,fetchedAt:new Date().toISOString()};
    }
    async function readConversation(value,{user,signal}={}){
      const id=courseId(value),accountId=expectedUser(user);
      const initialUser=await verifyExpectedUser(accountId,signal);
      const {data}=await request(`/api/v1/conversations/${id}?auto_mark_as_read=false`,{signal});
      if(!data||String(data.id)!==id||!Array.isArray(data.messages))throw new CanvasError('Canvas returned an unexpected conversation.', 'data');
      await verifyExpectedUser(accountId,signal,initialUser.id);
      return {origin:base.origin,accountId,conversation:data};
    }
    async function loadSnapshot({signal,onProgress = () => {},user:knownUser} = {}) {
      const user = await profile({signal});
      if (knownUser && String(knownUser.id) !== String(user.id)) throw new CanvasError('Your Canvas account changed. Reopen Canvas Harness to load the new account.', 'auth');
      // include[]=term adds each course's term name, so "Default Term" (school resources such as NameCoach) is known by name
      // as well as by enrollment_term_id (ReserveCore.nonAcademicCourseIds). Still one GET.
      const courses = await list('/api/v1/courses?enrollment_state=active&enrollment_type=student&include[]=total_scores&include[]=current_grading_period_scores&include[]=term&per_page=100', {signal});
      const errors = [], assignments = []; let cursor=0, completed=0, fatal=null;
      async function worker() {
        while (cursor < courses.length && !fatal) {
          if(signal?.aborted) throw new CanvasError('Refresh cancelled.', 'cancelled');
          const course = courses[cursor++];
          if (!/^\d+$/.test(String(course.id))) { errors.push({courseId:String(course.id),courseName:course.name,message:'Canvas returned an invalid course identifier.'}); continue; }
          try {
            const rows = await list(`/api/v1/courses/${course.id}/assignments?include[]=submission&per_page=100`, {signal});
            for (const row of rows) if (row.published !== false && row.workflow_state !== 'deleted') assignments.push({...row,course_id:course.id});
          } catch(error) {
            if (error.code === 'auth' || error.code === 'cancelled') {fatal=error;throw error;}
            errors.push({courseId:String(course.id),courseName:String(course.name || 'Course'),message:error.message});
          }
          if(!fatal && !signal?.aborted) onProgress({completed:++completed,total:courses.length,courseName:course.name});
        }
      }
      await Promise.all(Array.from({length:Math.min(3,courses.length)},worker));
      const finalUser = await profile({signal});
      if(String(finalUser.id)!==String(user.id)) throw new CanvasError('Your Canvas account changed during refresh. Reopen Canvas Harness.', 'auth');
      return {origin:base.origin,user,courses,assignments,errors,partial:errors.length>0,fetchedAt:new Date().toISOString()};
    }
    return {origin:base.origin,list,profile,loadSnapshot,loadCourseResources,readCoursePage,readAssignment,readFile,loadCourseUpdates,listInbox,readConversation};
  }
  const api = { CanvasError, createClient };
  root.ReserveAPI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
