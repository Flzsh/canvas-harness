/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
// Assignment-group loading adapted from Gary Wu's pull requests.
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function (root) {
  'use strict';
  class CanvasError extends Error { constructor(message, code = 'network') { super(message); this.name = 'CanvasError'; this.code = code; } }
  // Canvas may throttle with a 403 rate-limit response or a 429.
  // Wait and retry those twice before reporting them; other errors fail at once.
  const throttleRetries = [1000, 4000];
  function waitForRetry(ms, signal) {
    return new Promise(resolve => {
      const finish = () => { clearTimeout(timer); signal?.removeEventListener('abort', finish); resolve(); };
      const timer = setTimeout(finish, ms);
      signal?.addEventListener('abort', finish, {once:true});
      if (signal?.aborted) finish();
    });
  }
  function createClient({
    origin = (globalThis.ReserveSite.origin()),
    fetchImpl = root.fetch.bind(root),
    timeout = 15000,
    retryDelays = throttleRetries,
    wait = waitForRetry,
    requestLimit = 1200
  } = {}) {
    if (!globalThis.ReserveSite.supported(origin)) throw new CanvasError('Use your school’s HTTPS Canvas site.', 'origin');
    const base = new URL(origin),requestCeiling=Math.min(1200,Number.isSafeInteger(requestLimit)&&requestLimit>0?requestLimit:1200);let requestCount=0,requestEpoch=Date.now();
    // One ceiling covers API reads and authorized document downloads, including retries.
    function reserveRead(){
      if(Date.now()-requestEpoch>=300000){requestCount=0;requestEpoch=Date.now();}
      if(requestCount>=requestCeiling)throw new CanvasError('Canvas source request limit reached. Wait a few minutes, then gather again.','limit');
      requestCount++;
    }
    const allowed = [
      /^\/api\/v1\/users\/self\/profile\/?$/,
      /^\/api\/v1\/users\/self\/(?:course_nicknames|groups)\/?$/,
      /^\/api\/v1\/courses\/?$/,
      /^\/api\/v1\/courses\/\d+\/?$/,
      /^\/api\/v1\/courses\/\d+\/assignments(?:\/\d+)?\/?$/,
      /^\/api\/v1\/courses\/\d+\/assignment_groups\/?$/,
      /^\/api\/v1\/courses\/\d+\/peer_reviews\/?$/,
      /^\/api\/v1\/courses\/\d+\/quizzes\/?$/,
      /^\/api\/v1\/courses\/\d+\/late_policy\/?$/,
      /^\/api\/v1\/courses\/\d+\/folders\/?$/,
      /^\/api\/v1\/courses\/\d+\/assignments\/\d+\/submissions\/self\/?$/,
      /^\/api\/v1\/courses\/\d+\/modules(?:\/\d+)?\/?$/,
      /^\/api\/v1\/courses\/\d+\/modules\/\d+\/items\/?$/,
      /^\/api\/v1\/courses\/\d+\/pages\/?$/,
      /^\/api\/v1\/courses\/\d+\/pages\/[^/]+\/?$/,
      /^\/api\/v1\/courses\/\d+\/front_page\/?$/,
      /^\/api\/v1\/courses\/\d+\/files(?:\/\d+)?\/?$/,
      /^\/api\/v1\/courses\/\d+\/tabs\/?$/,
      /^\/api\/v1\/announcements\/?$/,
      /^\/api\/v1\/calendar_events\/?$/,
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
      if(/^\/api\/v1\/conversations\/\d+\/?$/.test(url.pathname)&&(url.searchParams.getAll('auto_mark_as_read').length!==1||url.searchParams.get('auto_mark_as_read')!=='false'))
        throw new CanvasError('Message previews must preserve read status.', 'endpoint');
      return url;
    }
    async function throttled(response) {
      if (response.status === 429) return true;
      if (response.status !== 403) return false;
      const remaining = response.headers.get('x-rate-limit-remaining');
      if (remaining != null && remaining !== '' && Number(remaining) <= 0) return true;
      try { return /rate limit exceeded/i.test(String(await response.text?.()).slice(0, 2000)); } catch { return false; }
    }
    function retryAfter(response) {
      const seconds = Number(response.headers.get('retry-after'));
      return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 10000) : null;
    }
    const availability=new Map();
    function sourceErrors(){return [...availability.values()].map(e=>({...e}));}
    function recordFailure(path,error){
      try{
        const u=new URL(path,base),
          m=u.pathname.match(/^\/api\/v1\/courses\/(\d+)(?:\/([^/]+))?/),
          cid=m?.[1]||/^course_(\d+)$/.exec(u.searchParams.get('context_codes[]')||'')?.[1],
          source=m?.[2]||(u.pathname.split('/').at(-1)||'Canvas');
        if(u.origin!==base.origin)return;
        availability.set(u.pathname,{...(cid?{courseId:cid}:{}),source,code:String(error.code||''),message:String(error.message||'Source unavailable').slice(0,200)});
        if(availability.size>80)availability.delete(availability.keys().next().value);
      }catch{}
    }
    async function request(path, options = {}) {
      for (let retry = 0; ; retry++) {
        try { return await attempt(path, options); } catch (error) {
          if (error?.code !== 'rate' || retry >= retryDelays.length){
            if(!/^(?:auth|account|cancelled)$/.test(error?.code||''))recordFailure(path,error);else if(/^(?:auth|account)$/.test(error?.code||''))sourceCache.clear();
            throw error;
          }
          await wait(error.retryAfter ?? retryDelays[retry], options.signal);
          if (options.signal?.aborted) throw new CanvasError('Refresh cancelled.', 'cancelled');
        }
      }
    }
    async function attempt(path, {signal} = {}) {
      if (signal?.aborted) throw new CanvasError('Refresh cancelled.', 'cancelled');
      const url = urlFor(path), controller = new AbortController();
      const abort = () => controller.abort();
      if (signal?.aborted) controller.abort();
      signal?.addEventListener('abort', abort, {once:true});
      const timer = setTimeout(abort, timeout);
      try {
        const fetchOptions = {method:'GET', credentials:'same-origin', headers:{Accept:'application/json+canvas-string-ids'}, signal:controller.signal, redirect:'error'};
        if (url.pathname === '/api/v1/users/self/profile') {
          fetchOptions.cache = 'no-store';
          fetchOptions.priority = 'high';
        }
        reserveRead();const response = await fetchImpl(url.href, fetchOptions);
        if (response?.redirected || response?.type === 'opaqueredirect') throw new CanvasError('Canvas redirected this read request unexpectedly.', 'redirect');
        if (signal?.aborted) throw new CanvasError('Refresh cancelled.', 'cancelled');
        if (response.status === 401) throw new CanvasError('Sign in to Canvas, then refresh Canvas Harness.', 'auth');
        if (await throttled(response)) throw Object.assign(new CanvasError('Canvas is receiving too many requests. Wait a minute, then refresh.', 'rate'), {retryAfter: retryAfter(response)});
        if (!response.ok)
          throw new CanvasError(response.status === 403 ? 'Canvas did not allow this course to be read.' : `Canvas could not load this information (${response.status}).`, String(response.status));
        if (!(response.headers.get('content-type') || '').includes('json')) throw new CanvasError('Your Canvas session needs attention. Open Canvas and sign in again.', 'auth');
        let data;
        try { data = await response.json(); } catch (error) { if(controller.signal.aborted) throw error; throw new CanvasError('Canvas returned unreadable data. Try refreshing.', 'data'); }
        if (signal?.aborted) throw new CanvasError('Refresh cancelled.', 'cancelled');
        return {data, link:response.headers.get('link') || ''};
      } catch (error) {
        if (signal?.aborted) throw new CanvasError('Refresh cancelled.', 'cancelled');
        if (error instanceof CanvasError || error?.code==='canvas-page-unavailable') throw error;
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
    const verifiedProfiles=new WeakMap(),authScopes=new WeakMap();
    async function profile(options) {
      const {data} = await request('/api/v1/users/self/profile', options);
      if (!data || data.id == null) throw new CanvasError('Could not identify the signed-in Canvas account.', 'auth');
      // Only the account ID and the name for the greeting are kept. Email, login and SIS IDs, the picture and the
      // private calendar feed address are dropped here, so they never reach a saved snapshot.
      const user = {id:data.id};
      for (const key of ['name','short_name']) if (typeof data[key] === 'string') user[key] = data[key];
      verifiedProfiles.set(user,{at:Date.now(),id:String(user.id)});
      return user;
    }
    function createReadScope(found,signal){
      const verified=verifiedProfiles.get(found);
      if(!verified||Date.now()-verified.at>5000)return null;
      const scope={};
      authScopes.set(scope,{found,id:verified.id,signal,at:Date.now()});
      return scope;
    }
    function endReadScope(scope){if(scope)authScopes.delete(scope);}
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
    const instructionCache=new Map(),instructionPending=new Map(),assignmentBodies=new Map(),resourceCache=new Map(),resourcePending=new Map();
    // Pending reads share a cancellation scope; completed reads share only their account/data scope.
    async function cachedRead(cache,pending,key,signal,read){
      if(signal?.aborted)throw new CanvasError('Refresh cancelled.','cancelled');
      const old=cache.get(key);if(old&&Date.now()-old.at<300000)return old.value;
      const scopes=pending.get(key)||new Map();pending.set(key,scopes);if(scopes.has(signal))return scopes.get(signal);
      const op=Promise.resolve().then(read).then(value=>{
        if(signal?.aborted)throw new CanvasError('Refresh cancelled.','cancelled');
        if(pending.get(key)===scopes)cache.set(key,{at:Date.now(),value});
        return value;
      }).finally(()=>{
        scopes.delete(signal);
        if(pending.get(key)===scopes&&!scopes.size)pending.delete(key);
      });
      scopes.set(signal,op);
      return op;
    }
    // Account-scoped instructional lists are shared by refresh and Help, never one GET per assignment.
    async function instructions(path,user,signal,single=false){
      return cachedRead(
        instructionCache,
        instructionPending,
        String(user.id)+'|'+path,
        signal,
        ()=> (single?request(path,{signal}).then(r=>r.data):list(path,{signal})).catch(error=>{
        if(fatalSourceError(error))throw error;
        return single?null:[];
      }));
    }
    function withQuizzes(rows,quizzes,id){
      const byId=new Map(quizzes.map(q=>[String(q.id),q])),assigned=new Set(rows.map(a=>String(a.quiz_id||'')));
      return [
        ...rows.map(a=>({...a,...(byId.has(String(a.quiz_id))?{quiz:byId.get(String(a.quiz_id))}:{})})),
        ...quizzes.filter(q=>q.published!==false&&q.workflow_state!=='deleted'&&!q.assignment_id&&!assigned.has(String(q.id))).map(q=>
          ({
            id:'quiz-'+q.id,
            course_id:id,
            name:q.title,
            description:q.description,
            html_url:q.html_url||base.origin+'/courses/'+id+'/quizzes/'+q.id,
            due_at:q.due_at,
            unlock_at:q.unlock_at,
            lock_at:q.lock_at,
            locked_for_user:q.locked_for_user,
            submission_types:['online_quiz'],
            quiz_id:q.id,
            quiz:q,
            grading_type:q.quiz_type==='survey'||q.quiz_type==='practice_quiz'?'not_graded':'points',
            points_possible:q.points_possible
          }))
      ];
    }
    async function verifyExpectedUser(id, signal, previousId, authScope) {
      if(signal?.aborted)throw new CanvasError('Refresh cancelled.','cancelled');
      const scoped=authScope&&authScopes.get(authScope);
      if(scoped&&scoped.signal===signal&&Date.now()-scoped.at<5000&&scoped.id===id&&(previousId==null||String(previousId)===id))return scoped.found;
      const found=await profile({signal});
      if (String(found.id)!==id || (previousId != null && String(found.id)!==String(previousId))) {
        instructionCache.clear();instructionPending.clear();resourceCache.clear();resourcePending.clear();assignmentBodies.clear();
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
    async function loadCourseResources(value,options={}){
      const id=courseId(value),
        account=expectedUser(options.user),
        prefix=account+'|'+id+'|',
        rows=Array.isArray(options.assignments)?options.assignments:assignmentBodies.get(account+'|'+id)||[];
      const assignmentHTML=rows.filter(a=>
        a&&
          String(a.course_id??a.courseId??id)===id&&
          a.published!==false&&
          !a.locked_for_user&&
          !a.locked&&
          (!(a.due_at??a.dueAt)||Date.parse(a.due_at??a.dueAt)<Date.now()+43*86400000)).map(a=>
        String(a.description||'')),
        key=prefix+JSON.stringify(assignmentHTML);
      // Refresh must detach old pending reads too, so they cannot restore stale instructional data.
      if(options.force){
        sourceCache.clear();
        for(const cache of [resourceCache,resourcePending])for(const k of cache.keys())if(k.startsWith(prefix))cache.delete(k);
        for(const cache of [instructionCache,instructionPending])for(const k of cache.keys())if(k.startsWith(account+'|/api/v1/courses/'+id+'/'))cache.delete(k);
      }
      const old=resourceCache.get(key);
      if(old&&Date.now()-old.at<300000){await verifyExpectedUser(account,options.signal);const result=old.value;await verifyExpectedUser(account,options.signal);return result;}
      return cachedRead(
        resourceCache,
        resourcePending,
        key,
        options.signal,
        ()=>courseResources(id,{...options,assignmentHTML,needsPeerReviews:rows.some(a=>a.peer_reviews===true||a.peerReviews===true)}));
    }
    async function courseResources(value,{user,signal,assignmentHTML=[],needsPeerReviews=false}={}) {
      const id=courseId(value), accountId=expectedUser(user);
      const initialUser=await verifyExpectedUser(accountId,signal);
      const errors=[];
      let modules=[],pages=[],files=[],frontPage=null,syllabusBody='',quizzes=[],assignmentGroups=[],latePolicy=null,folders=[],peerReviews=[];
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
        async()=>{if(needsPeerReviews)peerReviews=await instructions(`/api/v1/courses/${id}/peer_reviews?per_page=100`,user,signal);},
        async()=>{folders=await instructions(`/api/v1/courses/${id}/folders?per_page=100`,user,signal);},
        async()=>{assignmentGroups=await instructions(`/api/v1/courses/${id}/assignment_groups?per_page=100`,user,signal);},
        async()=>{const raw=await instructions(`/api/v1/courses/${id}/late_policy`,user,signal,true);latePolicy=raw&&Object.hasOwn(raw,'late_policy')?raw.late_policy:raw;},
        async()=>{quizzes=await instructions(`/api/v1/courses/${id}/quizzes?per_page=100`,user,signal);},
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
        ()=>source('syllabus',async()=>{
          const result=await request(`/api/v1/courses/${id}?include[]=syllabus_body`,{signal});
          syllabusBody=typeof result.data?.syllabus_body==='string'?result.data.syllabus_body:'';
        }),
      ];
      await runLimited(tasks,3);
      const byFolder=new Map(folders.filter(f=>
        !f.locked_for_user&&!f.hidden_for_user&&!f.hidden&&!f.locked&&(f.context_id==null||String(f.context_id)===id)&&(!f.context_type||f.context_type==='Course')).map(f=>
        [String(f.id),f])),
        folderPath=value=>{
        const parts=[],seen=new Set();
        let f=byFolder.get(String(value));
        while(f&&!seen.has(String(f.id))&&parts.length<30){
          seen.add(String(f.id));
          if(f.full_name){parts.unshift(String(f.full_name));break;}
          parts.unshift(String(f.name||''));
          f=byFolder.get(String(f.parent_folder_id));
        }
        return parts.join('/');
      };
      files=files.map(f=>({...f,folderPath:folderPath(f.folder_id)}));
      // Resolve only instructional page dependencies; a page list contains titles, not bodies.
      let frontier=[syllabusBody,frontPage?.body,...assignmentHTML],seenPages=new Set();
      for(let depth=0;depth<3;depth++){
        const next=[];
        for(const html of frontier)for(const match of String(html||'').matchAll(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)){
          let slug;
          try{
            const u=new URL((match[1]||match[2]).replace(/&amp;/g,'&'),base);
            if(u.origin!==base.origin||u.username||u.password)continue;
            const m=u.pathname.match(/^\/courses\/(\d+)\/pages\/([^/]+)\/?$/);
            if(!m||m[1]!==id)continue;
            slug=pageSlug(decodeURIComponent(m[2]));
          }catch{continue;}
          if(seenPages.has(slug)||seenPages.size>=100)continue;seenPages.add(slug);
          const prior=pages.find(p=>p.url===slug);if(prior?.locked_for_user||prior?.published===false)continue;
          const p=await instructions(`/api/v1/courses/${id}/pages/${encodeURIComponent(slug)}`,user,signal,true);
          if(!p||p.locked_for_user||p.locked||p.published===false||p.course_id!=null&&String(p.course_id)!==id)continue;
          if(prior)Object.assign(prior,p);else pages.push(p);next.push(p.body);
        }
        frontier=next;
      }
      await verifyExpectedUser(accountId,signal,initialUser.id);
      return {
        origin:base.origin,
        accountId,
        courseId:id,
        modules,
        pages,
        files,
        frontPage,
        syllabusBody,
        quizzes,
        assignmentGroups,
        latePolicy,
        folders,
        peerReviews:peerReviews.filter(r=>String(r.assessor_id)===accountId).map(r=>
          ({asset_id:r.asset_id,asset_type:r.asset_type,assessor_id:r.assessor_id,workflow_state:r.workflow_state})),
        errors,
        fetchedAt:new Date().toISOString()
      };
    }
    async function readCoursePage(courseValue,slugValue,{user,signal,authScope}={}) {
      const id=courseId(courseValue), slug=pageSlug(slugValue), accountId=expectedUser(user);
      const initialUser=await verifyExpectedUser(accountId,signal,undefined,authScope);
      const {data}=await request(`/api/v1/courses/${id}/pages/${encodeURIComponent(slug)}`,{signal});
      if(!data||typeof data!=='object')throw new CanvasError('Canvas returned an unexpected page.','data');
      if(data.locked_for_user||data.published===false)throw new CanvasError('This page is not available to your account.','403');
      await verifyExpectedUser(accountId,signal,initialUser.id,authScope);
      return typeof data.body==='string'?data.body:'';
    }
    async function readAssignment(courseValue,assignmentValue,{user,signal,authScope}={}) {
      const id=courseId(courseValue),assignmentId=courseId(assignmentValue),accountId=expectedUser(user);
      await verifyExpectedUser(accountId,signal,undefined,authScope);
      const {data}=await request(`/api/v1/courses/${id}/assignments/${assignmentId}`,{signal});
      if(!data||String(data.id)!==assignmentId||data.course_id!=null&&String(data.course_id)!==id||data.locked_for_user||data.published===false)
        throw new CanvasError('This assignment is not available.','403');
      await verifyExpectedUser(accountId,signal,undefined,authScope);
      return data;
    }
    async function readSubmissionFeedback(courseValue,assignmentValue,{user,signal}={}) {
      const id=courseId(courseValue),assignmentId=courseId(assignmentValue),accountId=expectedUser(user);
      await verifyExpectedUser(accountId,signal);
      const {data}=await request(`/api/v1/courses/${id}/assignments/${assignmentId}/submissions/self?include[]=submission_comments&include[]=rubric_assessment`,{signal});
      if(!data||
        typeof data!=='object'||
        Array.isArray(data)||
        data.user_id!=null&&String(data.user_id)!==accountId||
        data.assignment_id!=null&&String(data.assignment_id)!==assignmentId)
        throw new CanvasError('This feedback is not available to your account.','auth');
      await verifyExpectedUser(accountId,signal);
      const submission_comments=(Array.isArray(data.submission_comments)?data.submission_comments:[]).map(c=>
        ({
          comment:typeof c?.comment==='string'?c.comment:'',
          author_id:String(c?.author_id??c?.author?.id??''),
          created_at:typeof c?.created_at==='string'?c.created_at:'',
          attachment:Array.isArray(c?.attachments)&&c.attachments.length>0||!!c?.media_comment,
          ...(Array.isArray(c?.attachments)&&c.attachments.length?
            {
              attachments:c.attachments.filter(f=>
                /^\d+$/.test(String(f?.id))&&!f.locked_for_user&&!f.hidden_for_user&&!f.locked&&!f.hidden&&(f.course_id==null||String(f.course_id)===id)).map(f=>
                ({id:String(f.id),filename:String(f.display_name||f.filename||'Feedback document').slice(0,200)}))
            }:
            {})
        })),
        rubric_assessment={};
      for(const [key,row]of Object.entries(data.rubric_assessment&&typeof data.rubric_assessment==='object'&&!Array.isArray(data.rubric_assessment)?data.rubric_assessment:{}))
        if(typeof row?.comments==='string')Object.defineProperty(rubric_assessment,key,{value:{comments:row.comments},enumerable:true});
      return {submission_comments,rubric_assessment};
    }
    async function loadGradeImpact(value,{user,signal}={}) {
      const id=courseId(value),accountId=expectedUser(user);
      const initialUser=await verifyExpectedUser(accountId,signal);
      const {data:course}=await request(`/api/v1/courses/${id}?include[]=total_scores&include[]=current_grading_period_scores`,{signal});
      if(!course||typeof course!=='object'||Array.isArray(course)||String(course.id)!==id||course.access_restricted_by_date||course.workflow_state==='deleted')
        throw new CanvasError('Canvas returned incomplete course grading information.','data');
      const enrollments=Array.isArray(course.enrollments)?course.enrollments:[];
      const periods=course.multiple_grading_periods_enabled!==false||
        course.current_grading_period_id!=null||
        course.grading_period_set_id!=null||
        course.grading_periods_enabled===true||
        course.has_grading_periods===true||
        course.grading_periods_weighted===true||
        Array.isArray(course.grading_periods)&&course.grading_periods.length>0||
        enrollments.some(row=>row?.current_grading_period_id!=null||row?.grading_period_id!=null||row?.multiple_grading_periods_enabled===true);
      let groups=[],assignments=[];
      if(course.hide_final_grades===false&&!course.restrict_quantitative_data&&!periods&&typeof course.apply_assignment_group_weights==='boolean'){
        groups=await list(`/api/v1/courses/${id}/assignment_groups?per_page=100`,{signal});
        assignments=await list(`/api/v1/courses/${id}/assignments?include[]=submission&per_page=100`,{signal});
      }
      await verifyExpectedUser(accountId,signal,initialUser.id);
      return {origin:base.origin,accountId,courseId:id,course,groups,assignments,fetchedAt:new Date().toISOString()};
    }
    // linked: the file is linked from an assignment the student can see, so "hidden in Files" does not block it.
    async function readFile(courseValue,fileValue,{user,signal,authScope,linked=false}={}) {
      const id=courseId(courseValue),fileId=courseId(fileValue),accountId=expectedUser(user);
      await verifyExpectedUser(accountId,signal,undefined,authScope);
      const {data}=await request(`/api/v1/courses/${id}/files/${fileId}`,{signal});
      if(!data||
        String(data.id)!==fileId||
        data.course_id!=null&&String(data.course_id)!==id||
        data.locked_for_user||
        !linked&&(data.hidden_for_user||data.hidden)||
        data.locked||
        data.published===false)
        throw new CanvasError('This file is not available.','403');
      await verifyExpectedUser(accountId,signal,undefined,authScope);
      return data;
    }
    function readableAgentSource(data,id,sourceId){
      return !!data&&
        typeof data==='object'&&
        !Array.isArray(data)&&
        String(data.id)===sourceId&&
        (data.course_id==null||String(data.course_id)===id)&&
        (!data.context_code||String(data.context_code)===`course_${id}`)&&
        data.published!==false&&
        data.locked!==true&&
        data.locked_for_user!==true&&
        data.hidden!==true&&
        data.hidden_for_user!==true&&
        data.user_can_see_posts!==false&&
        data.workflow_state!=='deleted'&&
        data.workflow_state!=='unpublished'&&
        data.state!=='locked';
    }
    async function readModule(courseValue,moduleValue,{user,signal,authScope}={}){
      const id=courseId(courseValue),moduleId=courseId(moduleValue),accountId=expectedUser(user);
      await verifyExpectedUser(accountId,signal,undefined,authScope);
      const {data}=await request(`/api/v1/courses/${id}/modules/${moduleId}?include[]=items&include[]=content_details`,{signal});
      if(!readableAgentSource(data?.state==='locked'?{...data,state:undefined}:data,id,moduleId))throw new CanvasError('This module is not available.','403');
      // A visible locked module exposes availability, never its child contents.
      if(data.state==='locked'){
        await verifyExpectedUser(accountId,signal,undefined,authScope);
        return {
          id:data.id,
          course_id:id,
          name:data.name,
          state:'locked',
          unlock_at:data.unlock_at,
          prerequisite_module_ids:data.prerequisite_module_ids,
          require_sequential_progress:data.require_sequential_progress,
          metadataOnly:true,
          items:[]
        };
      }
      let items=Array.isArray(data.items)?data.items:[];
      if(!Array.isArray(data.items)||Number.isFinite(Number(data.items_count))&&Number(data.items_count)>items.length)
        items=await list(`/api/v1/courses/${id}/modules/${moduleId}/items?include[]=content_details&per_page=100`,{signal});
      await verifyExpectedUser(accountId,signal,undefined,authScope);
      return {...data,items:items.filter(item=>item&&item.published!==false&&!item.locked_for_user&&!item.locked&&!item.hidden_for_user&&!item.hidden)};
    }
    async function readDiscussion(courseValue,discussionValue,{user,signal,authScope}={}){
      const id=courseId(courseValue),discussionId=courseId(discussionValue),accountId=expectedUser(user);
      await verifyExpectedUser(accountId,signal,undefined,authScope);
      const {data}=await request(`/api/v1/courses/${id}/discussion_topics/${discussionId}`,{signal});
      if(!readableAgentSource(data?.require_initial_post===true?{...data,user_can_see_posts:true}:data,id,discussionId)||data.is_announcement===true)
        throw new CanvasError('This discussion is not available.','403');/* Post-first hides replies, not the teacher's prompt. Never request its thread. */
      if(data.user_can_see_posts===false){await verifyExpectedUser(accountId,signal,undefined,authScope);return {...data,view:[],entries:[],replies:[]};}
      const {data:thread}=await request(`/api/v1/courses/${id}/discussion_topics/${discussionId}/view`,{signal});
      if(!thread||!Array.isArray(thread.view))throw new CanvasError('Canvas returned an unexpected discussion thread.','data');
      await verifyExpectedUser(accountId,signal,undefined,authScope);
      return {...data,view:thread.view};
    }
    async function readAnnouncement(courseValue,announcementValue,{user,signal,authScope}={}){
      const id=courseId(courseValue),announcementId=courseId(announcementValue),accountId=expectedUser(user);
      await verifyExpectedUser(accountId,signal,undefined,authScope);
      const {data}=await request(`/api/v1/courses/${id}/discussion_topics/${announcementId}`,{signal});
      if(!readableAgentSource(data,id,announcementId)||data.is_announcement!==true)throw new CanvasError('This announcement is not available.','403');
      await verifyExpectedUser(accountId,signal,undefined,authScope);
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
    // `verifiedAt`: when the caller last had Canvas confirm this account (session.js). Within 5 seconds of that, the
    // load trusts it instead of asking again, at its start and at its end; a longer load checks again before it returns.
    async function loadSnapshot({signal,onProgress = () => {},user:knownUser,verifiedAt = 0} = {}) {
      const trusted = () => !!knownUser && /^\d+$/.test(String(knownUser.id ?? '')) && Date.now() - verifiedAt < 5000;
      const user = trusted() ? knownUser : await profile({signal});
      if (knownUser && String(knownUser.id) !== String(user.id)) throw new CanvasError('Your Canvas account changed. Reopen Canvas Harness to load the new account.', 'auth');
      // include[]=term adds each course's term name, so "Default Term" (school resources such as a name-pronunciation tool) is known by name
      // as well as by enrollment_term_id (ReserveCore.nonAcademicCourseIds). Still one GET.
      const courses = await list('/api/v1/courses?enrollment_state=active&enrollment_type=student&include[]=total_scores&include[]=current_grading_period_scores&include[]=term&per_page=100', {signal});
      const [nicknames,myGroups]=await Promise.all([instructions('/api/v1/users/self/course_nicknames?per_page=100',user,signal),instructions('/api/v1/users/self/groups?per_page=100',user,signal)]);
      for(const c of courses){
        const n=nicknames.find(n=>String(n.course_id)===String(c.id));
        if(n)c.nickname=String(n.nickname||n.name||'');
        c.myGroups=myGroups.filter(g=>String(g.course_id)===String(c.id)).map(g=>
          ({id:String(g.id),name:String(g.name||''),groupCategoryId:g.group_category_id==null?null:String(g.group_category_id)}));
      }
      const errors = [], assignments = []; let cursor=0, completed=0, fatal=null;
      async function worker() {
        while (cursor < courses.length && !fatal) {
          if(signal?.aborted) throw new CanvasError('Refresh cancelled.', 'cancelled');
          const course = courses[cursor++];
          if (!/^\d+$/.test(String(course.id))) { errors.push({courseId:String(course.id),courseName:course.name,message:'Canvas returned an invalid course identifier.'}); continue; }
          try {
            const rows = await list(`/api/v1/courses/${course.id}/assignments?include[]=submission&per_page=100`, {signal});
            assignmentBodies.set(String(user.id)+'|'+String(course.id),rows);
            const quizzes=await instructions(`/api/v1/courses/${course.id}/quizzes?per_page=100`,user,signal);
            const groups=await instructions(`/api/v1/courses/${course.id}/assignment_groups?per_page=100`,user,signal),policy=await instructions(`/api/v1/courses/${course.id}/late_policy`,user,signal,true);
            course.late_policy=policy&&Object.hasOwn(policy,'late_policy')?policy.late_policy:policy;
            for (const row of withQuizzes(rows,quizzes,course.id).map(a=>({...a,assignment_group:groups.find(g=>String(g.id)===String(a.assignment_group_id))})))
              if (row.published !== false && row.workflow_state !== 'deleted') assignments.push({...row,course_id:course.id});
          } catch(error) {
            if (error.code === 'auth' || error.code === 'cancelled') {fatal=error;throw error;}
            errors.push({courseId:String(course.id),courseName:String(course.name || 'Course'),message:error.message});
          }
          if(!fatal && !signal?.aborted) onProgress({completed:++completed,total:courses.length,courseName:course.name});
        }
      }
      await Promise.all(Array.from({length:Math.min(3,courses.length)},worker));
      const finalUser = trusted() ? knownUser : await profile({signal});
      if(String(finalUser.id)!==String(user.id)){
        instructionCache.clear();
        instructionPending.clear();
        resourceCache.clear();
        resourcePending.clear();
        assignmentBodies.clear();
        throw new CanvasError('Your Canvas account changed during refresh. Reopen Canvas Harness.', 'auth');
      }
      return {origin:base.origin,user,courses,assignments,errors,partial:errors.length>0,fetchedAt:new Date().toISOString()};
    }
    // Completed source reads share their account scope across Help and agent tasks.
    const sourceCache=new Map();
    async function sourceRead(kind,cid,id,options,read){
      const account=expectedUser(options.user),
        revision=kind==='assignment'?assignmentBodies.get(account+'|'+cid)?.find(a=>String(a.id)===String(id)):null,
        key=JSON.stringify([account,kind,String(cid),String(id),revision?.updated_at||'',revision?.description||'']),
        old=sourceCache.get(key);
      if(old&&Date.now()-old.at<300000){await verifyExpectedUser(account,options.signal,undefined,options.authScope);return old.value;}
      const value=await read();
      sourceCache.set(key,{at:Date.now(),value});
      if(sourceCache.size>512)sourceCache.delete(sourceCache.keys().next().value);
      return value;
    }
    const shared=(kind,read)=>(cid,id,options={})=>sourceRead(kind,cid,id,options,()=>read(cid,id,options));
    return {
      origin:base.origin,
      reserveRead,
      createReadScope,
      endReadScope,
      sourceErrors,
      invalidateSources:()=>sourceCache.clear(),
      list,
      profile,
      loadSnapshot,
      loadCourseResources,
      readCoursePage:shared('page',readCoursePage),
      readAssignment:shared('assignment',readAssignment),
      readSubmissionFeedback,
      loadGradeImpact,
      readFile:shared('file',readFile),
      readModule:shared('module',readModule),
      readDiscussion:shared('discussion',readDiscussion),
      readAnnouncement:shared('announcement',readAnnouncement),
      loadCourseUpdates,
      listInbox,
      readConversation
    };
  }
  const api = { CanvasError, createClient };
  root.ReserveAPI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
