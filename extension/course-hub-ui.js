/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function(root){
  'use strict';
  function create({store,user,client,materials,onChange=()=>{},onAuthError=()=>{},onCapture=()=>{}}){
    const U=root.ReserveUI,E=U.escapeHTML,M=root.ReserveCourseHubModel,origin=(globalThis.ReserveSite.origin());
    const controller=new AbortController(),courses=new Map(),pending=new Map(),richCache=new Map(),threads=new Map(),saveCourses=new Map();
    let dead=false,inbox=null,inboxPending=null,query='',unreadOnly=false,saveNotice='',availableCourses=[],inboxCourse='all';
    const expanded=new Set();// teacher text opened with "Read more"
    const modulesOpen=new Set();// long modules showing every item ("Show all 42"), as course:module
    let focusRequest=null;
    const change=()=>{if(!dead)onChange();};
    const safe=value=>{if(typeof value!=='string'||!value.trim())return '';const url=U.safeURL(value);return url==='#'?'':url;};
    // Teacher materials share Materials' chapter design (materials-ui.js row, material-model.js outline):
    // a serif chapter head, one-line rows with the title in the reading face and quiet tags at the right.
    const LONG=8,PREVIEW=5;
    const newTab=url=>!String(url).startsWith(origin+'/');
    const moduleChapter=(id,m)=>{const items=root.ReserveMaterials.normalizeCatalog({courseId:id,modules:[m]});return {items,chapter:root.ReserveMaterials.outline(items,items,{numbers:false})[0]||null};};
    function teacherRow(entry,key,{head=false,url=safe(entry.item.url),tab=newTab}={}){
      const away=tab(url);
      let open=`<a class="rd-row-open" href="${E(url)}"${away?' target="_blank" rel="noopener noreferrer"':''}${root.ReserveMaterialsUI?.tip?.(entry)||''}>${E(entry.title)}${away?'&nbsp;<span aria-hidden="true">↗</span>':''}</a>`;
      if(head)open=`<span class="rd-chapter-head"><span class="rd-chapter-mark" aria-hidden="true"></span>${open}</span>`;
      const item=entry.item,courseId=String(item.courseId||''),saved=(store.get?.()?.resourcePins||[]).some(p=>p.id===item.id&&String(p.courseId)===courseId);
      const actions=!item.locked&&/^\d+$/.test(courseId)?`<span class="rd-material-actions"><button type="button" class="rd-text-button" data-rd-action="material-pin" data-resource="${E(item.id)}" data-course="${E(courseId)}" aria-label="${saved?'Remove bookmark:':'Bookmark'} ${E(entry.title)}" title="${saved?'Remove bookmark':'Bookmark'}" aria-pressed="${saved}">${root.ReserveIcon?.('bookmark')||''}<span class="rd-sr-only">${saved?'Bookmarked':'Bookmark'}</span></button></span>`:'';
      return root.ReserveMaterialsUI?.row?.(entry,{open,actions,key,newTab:tab,tag:head?'div':'li',rowClass:head?'rd-chapter-row':''})||`<${head?'div':'li'} class="rd-teacher-row" data-rd-key="${E(key)}">${open}</${head?'div':'li'}>`;
    }
    // Short course labels (normalizeData); the full Canvas name stays in tooltips and search.
    const short=course=>course?.shortName||course?.name||'',detail=course=>[course?.subject,course?.teacher,course?.sub].filter(Boolean).join(' · '),option=course=>[short(course),detail(course)].filter(Boolean).join(' — ');
    const full=course=>course.originalName&&course.originalName!==course.name?`${course.name} · ${course.originalName}`:course.name;
    // A course's colour and its text-safe ink (ReserveCore.courseInk), set on every element that holds its art.
    const tone=course=>/^#[0-9a-f]{6}$/i.test(course?.color||'')?` style="--rd-course:${course.color};--rd-course-ink:${root.ReserveCore?.courseInk?.(course.color)||course.color}"`:'';
    function owned(raw,id){
      if(raw.origin!==store.owner.origin||String(raw.accountId)!==String(store.owner.accountId)||(id&&String(raw.courseId)!==String(id)))throw Object.assign(Error('Your Canvas account changed. Reload Canvas.'),{code:'auth'});
    }
    function destroy(){dead=true;controller.abort();materials?.destroy?.();courses.clear();pending.clear();inbox=null;inboxPending=null;richCache.clear();threads.clear();saveCourses.clear();expanded.clear();modulesOpen.clear();focusRequest=null;}
    function fail(error){if(error.code==='auth'){destroy();onAuthError(error);return true;}return false;}
    async function loadCourse(id,{force=false}={}){
      id=String(id);if(dead||!/^\d+$/.test(id))return;if(pending.has(id))return pending.get(id);
      const prior=courses.get(id);if(!force&&prior?.loadedAt&&Date.now()-prior.loadedAt<300000)return;
      // Register before notifying: a render may ask for the same pending course.
      let finish;const op=new Promise(resolve=>{finish=resolve;});pending.set(id,op);
      courses.set(id,{...prior,loading:true,error:''});change();
      const homeRead=(async()=>{try{await materials?.load(id,{force});}catch(error){if(!dead)fail(error);}})();
      const updateRead=(async()=>{
        try{
          const raw=await client.loadCourseUpdates(id,{user,signal:controller.signal});
          if(dead)return;owned(raw,id);courses.set(id,{raw,...M.normalizeUpdates(raw),loadedAt:Date.now(),loading:false});
        }catch(error){if(dead)return;if(!fail(error))courses.set(id,{...prior,loading:false,error:error.message||'Course updates could not load.'});}
        finally{change();}
      })();
      Promise.all([homeRead,updateRead]).finally(()=>{pending.delete(id);finish();});return op;
    }
    async function loadInbox({force=false}={}){
      if(dead)return;if(inboxPending)return inboxPending;if(!force&&inbox?.loadedAt&&Date.now()-inbox.loadedAt<300000)return;
      let finish;const op=new Promise(resolve=>{finish=resolve;});inboxPending=op;
      inbox={...inbox,loading:true,error:''};change();
      (async()=>{
        try{const raw=await client.listInbox({user,signal:controller.signal});if(dead)return;owned(raw);if(!raw.errors?.length)threads.clear();const normalized=M.normalizeInbox(raw);inbox={raw,items:Array.isArray(normalized)?normalized:normalized.conversations||normalized.items||[],loadedAt:Date.now(),loading:false,error:raw.errors?.map(e=>e.message).join(' ')||''};}
        catch(error){if(dead)return;if(!fail(error))inbox={...inbox,loading:false,error:error.message||'Messages could not load.'};}
        finally{inboxPending=null;change();finish();}
      })();return op;
    }
    async function loadDeck(courseId,{force=false}={}){
      const id=String(courseId);if(dead||!/^\d+$/.test(id))return;
      // These reads share the hub/Inbox caches and never change either view's filters.
      await Promise.all([loadCourse(id,{force}),loadInbox({force})]);
    }
    function rich(body){
      body=String(body||'');if(richCache.has(body))return richCache.get(body);
      const template=document.createElement('template');template.innerHTML=body;
      const embeds=[...template.content.querySelectorAll('iframe[src]')].map(el=>({url:safe(el.getAttribute('src')),title:el.getAttribute('title')||'Open embedded class document'})).filter(x=>x.url);
      const html=U.safeRichHTML(body)+embeds.map(x=>`<a class="rd-document-link" href="${E(x.url)}" target="_blank" rel="noopener noreferrer">${root.ReserveIcon?.('external','rd-icon')||''}${E(x.title)}</a>`).join('');
      if(richCache.size>80)richCache.clear();richCache.set(body,html);return html;
    }
    const button=(action,label,id='',extra='')=>`<button type="button" class="rd-text-button" data-rd-action="hub-${action}" data-course="${E(id)}" ${extra}>${label}</button>`;
    const date=value=>{if(value==null||value==='')return 'Date unavailable';const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'Date unavailable';};
    // Relative day for lists: "Today", "Yesterday", "Sep 27" (the year only when it differs).
    const day=value=>{const d=new Date(value??'');if(!Number.isFinite(d.getTime()))return 'Date unavailable';const at=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime(),n=Math.round((at(new Date())-at(d))/864e5);return n===0?'Today':n===1?'Yesterday':d.toLocaleDateString('en-US',{month:'short',day:'numeric',...(d.getFullYear()!==new Date().getFullYear()?{year:'numeric'}:{})});};
    // The course's small drawing (course-art.js), placed only through its API.
    const mini=(course,place)=>course?.id?root.ReserveCourseArt?.mini?.(course,{place})||'':'';
    const ring='<span class="rd-sync-ring" aria-hidden="true"></span>';
    // First loads show three quiet ghost rows that breathe (no shimmer) beside the words.
    const ghosts='<div class="rd-ghost-rows" aria-hidden="true"><i></i><i></i><i></i></div>';
    function courseTools(id,entry){
      const tabs=entry?.tabs||[];
      return `<details class="rd-course-tools" data-rd-section="native-tools-${id}"><summary>All tools<span class="rd-sr-only"> in Canvas</span> ${root.ReserveIcon?.('chevron','rd-icon')||''}</summary><nav aria-label="Original Canvas course tools">${tabs.map(t=>`<a href="${E(safe(t.url))}">${E(t.label)}</a>`).join('')}<a href="${origin}/calendar?include_contexts=course_${id}">Course calendar</a><a href="${origin}/courses/${id}?view=feed">Course stream</a><a href="${origin}/courses/${id}?view=notifications">Course notifications</a>${!tabs.length?`<a href="${origin}/courses/${id}">Open full course navigation</a>`:''}</nav></details>`;
    }
    function sourceError(entry,sources){return entry?.error||(entry?.raw?.errors||[]).filter(error=>!error.source||sources.includes(error.source)).map(error=>error.message||'This source could not load.').join(' ');}
    function home(course,{deck=false}={}){
      const id=String(course.id),entry=materials?.getCourse(id),raw=entry?.raw,view=course.defaultView;
      if(!raw)return `<p class="rd-hub-notice" role="status">${entry?.error?E(entry.error):'Loading the teacher’s home page…'}</p><a class="rd-document-link" href="${origin}/courses/${id}">Open course home in Canvas ↗</a>`;
      const error=sourceError(entry,view==='wiki'?['frontPage']:view==='syllabus'?['syllabus']:!view?['frontPage','syllabus','modules']:['modules']);
      const warning=error?`<p class="rd-hub-notice" role="status">${E(error)}</p>`:'';
      if((view==='wiki'||!view)&&raw.frontPage){
        if(raw.frontPage.locked_for_user||raw.frontPage.published===false)return warning+'<p class="rd-hub-notice">This home page is unavailable. Check its current availability in Canvas.</p>';
        return warning+(raw.frontPage.body?`<div class="rd-rich-text rd-home-body">${rich(raw.frontPage.body)}</div>`:'<p class="rd-hub-notice">This home page has no readable text. Open the original for embedded content.</p>');
      }
      if(view==='syllabus'||(!view&&raw.syllabusBody))return warning+(raw.syllabusBody?`<div class="rd-rich-text rd-home-body">${rich(raw.syllabusBody)}</div>`:'<p class="rd-hub-notice">Open the original syllabus for its course schedule and embedded content.</p>');
      if(view==='assignments')return warning+`<p class="rd-hub-notice">This teacher uses the assignment list as the course home.</p><a class="rd-document-link" href="${origin}/courses/${id}/assignments">Open the teacher’s assignment list ↗</a>`;
      if(view==='feed')return warning+`<p class="rd-hub-notice">This teacher uses the course activity stream as the home page.</p><a class="rd-document-link" href="${origin}/courses/${id}?view=feed">Open the course stream ↗</a>`;
      const modules=(raw.modules||[]).filter(m=>m.published!==false&&m.workflow_state!=='deleted');
      // Each module is a chapter: a disclosure whose head is the serif name and its count (the first
      // opens), its items one line each; a long module opens on its first few items.
      if(modules.length)return warning+`<div class="rd-chapters rd-home-chapters">${modules.map((m,i)=>{
        const {items,chapter}=moduleChapter(id,m),count=items.length,rows=chapter?.rows||[],chevron=root.ReserveIcon?.('chevron','rd-icon')||'';
        // A module that is one item of its own name reads as that one row (no disclosure around it).
        if(chapter?.single&&rows.length===1)return `<div class="rd-chapter rd-chapter--single" data-rd-key="home-module-${E(m.id)}">${teacherRow(rows[0],`hub-row-${id}-${rows[0].item.id}`,{head:true})}</div>`;
        const folded=rows.length>LONG&&!modulesOpen.has(id+':'+m.id),shown=folded?rows.slice(0,PREVIEW):rows,list=`rd-home-${id}-${m.id}-items`;
        const more=rows.length>LONG?`<button type="button" class="rd-chapter-more" data-rd-action="hub-module-more" data-course="${E(id)}" data-entry="${E(m.id)}" aria-expanded="${!folded}" aria-controls="${E(list)}">${folded?`Show all ${count}`:'Show fewer'}${chevron}</button>`:'';
        return `<details class="rd-home-module rd-chapter" data-rd-section="home-module-${E(m.id)}" ${i===0?'open':''}><summary class="rd-chapter-head">${chevron}<span class="rd-chapter-name">${E(m.name)}</span><span class="rd-chapter-count">${count} ${count===1?'item':'items'}</span></summary>${shown.length?`<ul class="rd-chapter-items" id="${E(list)}">${shown.map(row=>teacherRow(row,`hub-row-${id}-${row.item.id}`)).join('')}</ul>${more}`:'<p class="rd-hub-notice">No visible items were returned for this module.</p>'}</details>`;
      }).join('')}</div>`;
      if(deck)return warning+(error?'':'<p class="rd-hub-notice">No readable home content was returned. Check the original course home for instructions.</p>');
      return warning+`<div class="rd-hub-empty">${root.ReserveIcon?.('home','rd-icon')||''}<h3>No readable home content was returned</h3><p>Check the original course home and Inbox for instructions. This does not mean there is no homework.</p><a href="${origin}/courses/${id}">Open course home ↗</a></div>`;
    }
    function deckDocuments(id,entry,course){
      const saved=(store.get?.()?.resourcePins||[]).filter(item=>String(item.courseId)===id&&item.category!=='Message'&&!String(item.id).startsWith('message:'));
      const catalog=(entry?.items||materials?.getItems?.(id)||[]).filter(item=>String(item.courseId)===id&&!['Assignment','Quiz','Discussion','FrontPage'].includes(item.kind));
      const seenIds=new Set(),seenURLs=new Set(),rows=[];
      // The first module is already expanded in the home section. Do not repeat
      // those same documents in a second panel; closed modules remain discoverable.
      if(course?.defaultView==='modules'){
        const first=(entry?.raw?.modules||[]).find(item=>item.published!==false&&item.workflow_state!=='deleted');
        if(first)for(const item of root.ReserveMaterials.normalizeCatalog({courseId:id,modules:[first]})){const url=safe(item.url);seenIds.add(item.id);if(url)seenURLs.add(url);}
      }
      const shownAtHome=seenURLs.size;
      function append(item,isSaved){
        const module=String(item.id).match(/^module:\d+:(\d+)$/);
        const url=isSaved&&module?`${origin}/courses/${id}/modules/items/${module[1]}`:safe(item.url);
        if(!url||seenIds.has(item.id)||seenURLs.has(url))return;
        seenIds.add(item.id);seenURLs.add(url);
        rows.push({...item,title:item.title||'Course document',url,saved:isSaved});
      }
      saved.forEach(item=>append(item,true));
      // Schedules are useful without an assignment selection; keep catalog order otherwise.
      const relevant=catalog.filter(item=>['Schedule','Syllabus'].includes(item.category)).concat(catalog.filter(item=>!['Schedule','Syllabus'].includes(item.category)));
      let added=0;for(const item of relevant){const before=rows.length;append(item,false);if(rows.length>before&&++added===6)break;}
      const error=sourceError(entry,['modules','pages','files','syllabus']),loading=entry?.loading||(!entry&&courses.get(id)?.loading);
      if(!rows.length&&shownAtHome&&!loading&&!error)return '';
      // The same one-line rows as the modules; a saved shortcut says so in its kind.
      const list=root.ReserveMaterials.present(rows).map(entry=>teacherRow(entry.item.saved?{...entry,kind:['Saved',entry.kind].filter(Boolean).join(' · ')}:entry,`deck-document-${id}-${entry.item.id}`,{url:entry.item.url,tab:()=>true})).join('');
      return `${loading?'<p class="rd-hub-notice" role="status">Loading course documents…</p>':''}${error?`<p class="rd-hub-notice" role="alert">${E(error)}</p>`:''}${list?`<ul class="rd-chapter-items rd-deck-documents">${list}</ul>`:''}${!rows.length&&!loading&&!error?`<p class="rd-hub-notice">${entry?.raw?'No document links were returned for this course.':'Course documents have not loaded yet.'}</p>`:''}`;
    }
    function renderDeckHeader(course){
      if(dead||!course||!/^\d+$/.test(String(course.id)))return '';
      const id=String(course.id),entry=courses.get(id),material=materials?.getCourse(id);
      return `<header class="rd-deck-header" data-rd-key="deck-heading"${tone(course)}><div><h2>${root.ReserveCourseArt?.mini?.(course,{place:'deck'})||''}Course information</h2><p title="${E(full(course))}">${E(short(course))}${detail(course)?` · ${E(detail(course))}`:''}</p></div><div class="rd-heading-actions"><a href="${origin}/courses/${id}">Original course ↗</a>${button('refresh-deck','Refresh',id,entry?.loading||material?.loading||inbox?.loading?'aria-disabled="true"':'')}</div></header>`;
    }
    function renderDeck(course,{header=true}={}){
      if(dead)return '';
      if(!course||!/^\d+$/.test(String(course.id)))return '<section class="rd-course-deck rd-hub-empty rd-deck-empty" data-rd-section="course-deck-empty"><p>Pick a course to see its updates here.</p></section>';
      const id=String(course.id),entry=courses.get(id),material=materials?.getCourse(id),announcements=(entry?.announcements||[]).slice(0,3),messages=(inbox?.items||[]).filter(item=>String(item.courseId)===id).slice(0,3);
      // Section heads are plain serif titles (no icon tiles) with one quiet "In Canvas ↗" link.
      const section=(name,title,source,url,body,actions='')=>`<section class="rd-deck-section rd-deck-${name}" data-rd-section="course-deck-${id}-${name}" aria-label="${E(title)}"><div class="rd-sheet-heading"><h3><span>${E(title)}</span></h3><div class="rd-source-actions">${actions}<a href="${E(url)}" aria-label="${E(title)} in Canvas" title="${E(source)}">In Canvas <span aria-hidden="true">↗</span></a></div></div>${body}</section>`;
      // In-progress requests ("Loading…") breathe slowly beside a dotted ring; results do not.
      const notice=(text,role='status')=>`<p class="rd-hub-notice" role="${role}"${role==='status'&&text.endsWith('…')?' data-loading="true"':''}>${role==='status'&&text.endsWith('…')?ring:''}${E(text)}</p>`;
      // Long teacher text is clamped to four lines with a plain "Read more".
      const clamp=(key,html,text)=>String(text||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().length>320?`<div class="rd-clamp" data-open="${expanded.has(key)}">${html}</div>${button('read-more',expanded.has(key)?'Show less':'Read more',id,`data-entry="${E(key)}" aria-expanded="${expanded.has(key)}"`)}`:html;
      const homeLoading=material?.loading||(!material&&entry?.loading);
      const homeBody=material?.raw?(homeLoading?notice('Refreshing the teacher’s home page…'):'')+home(course,{deck:true}):material?.error?notice(material.error,'alert'):notice(homeLoading?'Loading the teacher’s home page…':'The teacher’s home page has not loaded yet.');
      const updateError=sourceError(entry,['announcements']);
      const updatesBody=(entry?.loading?notice('Checking course updates…'):'')+(updateError?notice(updateError,'alert'):'')+announcements.map(item=>`<article class="rd-announcement" data-rd-section="deck-announcement-${id}-${E(item.id)}" data-unread="${!!item.unread}"><header><p class="rd-announcement-meta">${E(day(item.postedAt))}${item.unread?' · Unread':''} · ${E(item.author||'Course announcement')}</p><h4>${E(item.title||'Course announcement')}</h4></header>${clamp('announcement-'+item.id,`<div class="rd-rich-text">${item.body?rich(item.body):'<p>No readable announcement body was returned.</p>'}</div>`,item.body)}<div class="rd-source-actions"><a href="${E(safe(item.url)||`${origin}/courses/${id}/announcements`)}">Original announcement ↗</a>${button('capture-announcement','Add to my plan',id,`data-announcement="${E(item.id)}"`)}</div></article>`).join('')+(!announcements.length&&!entry?.loading&&!updateError?notice(entry?.loadedAt?'No announcements were returned for the past 14 days.':'Course announcements have not loaded yet.'):'');
      const messagesBody=(inbox?.loading?notice('Loading message summaries…'):'')+(inbox?.error?notice(inbox.error,'alert'):'')+(inbox?.raw?.truncated?notice('Older conversations remain in the full Canvas Inbox.'):'')+(saveNotice?notice(saveNotice,'alert'):'')+messages.map(item=>{
        const thread=threads.get(item.id),full=!!thread?.data;
        return `<article class="rd-message" data-rd-section="deck-message-${id}-${E(item.id)}" data-unread="${!!item.unread}"><header><p class="rd-announcement-meta">${full?'Conversation':'Message summary'} · ${E(day(item.updatedAt))} · <span data-unread="${!!item.unread}">${item.unread?'Unread':'Read'}</span></p><h4>${E(item.subject||'Untitled conversation')}</h4></header><div class="rd-message-body">${messageBody(item)||notice('No readable message text was returned.')}${!thread&&!item.excerpt?notice('No message excerpt was returned. Read the conversation for its contents.'):''}</div><div class="rd-source-actions"><a href="${E(safe(item.url)||origin+'/conversations')}">Original conversation ↗</a>${!thread?button('read-message','Read full conversation',id,`data-message="${E(item.id)}"`):''}</div>${messageShortcut(item)}</article>`;
      }).join('')+(!messages.length&&!inbox?.loading&&!inbox?.error?notice(inbox?.loadedAt?'No course-associated summaries were returned in the recent Inbox.':'Message summaries have not loaded yet.'):'');
      const documents=deckDocuments(id,material,course);
      return `<aside class="rd-course-deck" data-rd-section="course-deck-${id}" aria-label="Course information">${header?renderDeckHeader(course):''}<div class="rd-deck-secondary">${section('updates','Recent announcements','Canvas announcements',origin+'/courses/'+id+'/announcements',updatesBody)}${section('messages','Course messages','Canvas Inbox',origin+'/conversations',messagesBody)}</div><div class="rd-deck-primary">${section('home','Teacher’s home page','Course home',origin+'/courses/'+id,homeBody,button('capture-home','Plan from this page',id))}${documents?section('documents','More course documents','Canvas materials',origin+'/courses/'+id+'/modules',documents):''}</div></aside>`;
    }
    function renderHub(course){
      if(!course)return '<section class="rd-hub-empty"><h2>Choose a course</h2><p>Its home page, teacher updates and Canvas tools will appear here.</p></section>';
      const id=String(course.id),entry=courses.get(id),announcements=entry?.announcements||[];
      // A card-less banner: the serif title on the desk, the course's wide scene at the right,
      // one quiet line of Canvas pages (All tools opens the full list), then the teacher's page as the paper.
      const pages=[['modules','Modules'],['assignments','Assignments'],['grades','Grades'],['files','Files'],['users','People']].map(([path,label])=>`<a href="${origin}/courses/${id}/${path}">${label}</a>`).join('<span aria-hidden="true"> · </span>');
      const named=root.ReserveCourseArt?.titleFrame?.(course,{place:'banner'})||'';// the course name as artwork (course-art.js; refresh.css 9), last in the banner
      // The banner's own style carries the piece's width (the room's box starts where the piece ends), beside the course colour.
      const nameW=named?root.ReserveCourseArt.titleStyle?.(course)||'':'',paint=tone(course),look=!nameW?paint:paint?paint.replace(/"$/,`;${nameW}"`):` style="${nameW}"`;
      // Beside a lettered title the level tag ("CL") stands in the h1; where the name is artwork the h1 is only read
      // aloud, so the tag leads the subtitle instead (a visual copy: refresh.css 9 shows it only there).
      const tagged=named&&course.tag?`<small class="rd-course-tag" aria-hidden="true">${E(course.tag)}</small>`:'';
      return `<section class="rd-hub" aria-label="Course hub"><header class="rd-page-heading rd-course-banner"${named?' data-titled="true"':''}${look}><div class="rd-banner-art" aria-hidden="true">${root.ReserveCourseArt?.scene?.(course,{crop:'wide'})||''}</div><div><h1 title="${E(full(course))}">${E(course.shortName||course.name)}</h1><p><strong class="rd-course-detail">${E(short(course))}</strong> · ${tagged}${detail(course)?`<strong class="rd-course-detail">${E(detail(course))}</strong> · `:''}Home, teacher updates & course tools</p><div class="rd-hub-links">${pages}<span aria-hidden="true"> · </span>${courseTools(id,entry)}</div></div><div class="rd-heading-actions"><a class="rd-button rd-button--outline" href="${origin}/courses/${id}">Original course <span aria-hidden="true">↗</span></a><button type="button" class="rd-icon-button" data-rd-action="hub-refresh" data-course="${E(id)}" aria-label="Refresh this course" title="Refresh this course" ${entry?.loading?'aria-disabled="true" aria-busy="true"':''}>${root.ReserveIcon?.('refresh','rd-icon')||''}${ring}</button></div>${named}</header>${entry?.error?`<p role="alert" class="rd-hub-notice">${E(entry.error)} ${button('refresh','Try again',id)}</p>`:''}${entry?.raw?.errors?.length?'<p role="status" class="rd-hub-notice">Some course updates could not load. Use the original course or try refreshing.</p>':''}<div class="rd-hub-grid"><section class="rd-home-sheet" aria-label="Teacher course home"><div class="rd-sheet-heading"><h2>Teacher’s home page</h2><div class="rd-source-actions">${button('capture-home','Plan from this page',id)}<a href="${origin}/courses/${id}">Open original <span aria-hidden="true">↗</span></a></div></div>${home(course)}</section><aside class="rd-course-updates" aria-label="Teacher updates"><div class="rd-sheet-heading"><h2>Recent announcements</h2><span class="rd-n">${announcements.length}</span></div>${entry?.loading?`<p class="rd-hub-notice" role="status" data-loading="true">${ring}Checking course updates…</p>${announcements.length?'':ghosts}`:''}${announcements.length?announcements.map(a=>`<details class="rd-announcement" data-rd-section="announcement-${E(a.id)}" data-unread="${!!a.unread}"><summary><span class="rd-announcement-meta">${E(day(a.postedAt))}${a.unread?' · Unread':''} · ${E(a.author||'Course announcement')}</span><strong>${E(a.title)}</strong></summary><div class="rd-announcement-body"><div class="rd-rich-text">${rich(a.body)}</div><div class="rd-source-actions"><a class="rd-text-button" href="${E(safe(a.url)||`${origin}/courses/${id}/announcements`)}">Open announcement in Canvas <span aria-hidden="true">↗</span></a>${button('capture-announcement','Add to my plan',id,`data-announcement="${E(a.id)}"`)}</div></div></details>`).join(''):!entry?.loading?'<p class="rd-hub-notice">No announcements were returned for the past 14 days. Homework may still be in Inbox or the class schedule.</p>':''}<p class="rd-message-prompt">Teachers sometimes post homework in Messages. <button class="rd-text-button" type="button" data-rd-action="workspace" data-tab="inbox">View messages <span aria-hidden="true">→</span></button></p></aside></div></section>`;
    }
    function messageShortcut(item){
      const courseId=saveCourses.get(item.id)||item.courseId;
      const saved=(store.get?.()?.resourcePins||[]).some(p=>p.id==='message:'+item.id&&p.courseId===String(courseId));
      const choose=!item.courseId?`<select data-rd-field="hub-save-course" data-message="${E(item.id)}" aria-label="Course for this message"><option value="">Keep with a course…</option>${availableCourses.map(c=>`<option value="${E(c.id)}" ${String(courseId)===String(c.id)?'selected':''}>${E(option(c))}</option>`).join('')}</select>`:'';
      return `<div class="rd-message-save">${button('capture-message','Add to my plan',courseId||'',`data-message="${E(item.id)}"`)}${choose}${courseId?button('save-message',saved?'Bookmarked':'Bookmark message',courseId,`data-message="${E(item.id)}" aria-pressed="${saved}"`):''}</div>`;
    }
    async function saveMessage(id){
      const item=inbox?.items.find(x=>x.id===id),courseId=saveCourses.get(id)||item?.courseId;if(!item||!/^\d+$/.test(courseId||''))return;
      try{await store.update(data=>{const pins=data.resourcePins||(data.resourcePins=[]),key='message:'+item.id,index=pins.findIndex(p=>p.id===key&&p.courseId===String(courseId));if(index>=0)pins.splice(index,1);else pins.push({id:key,courseId:String(courseId),title:item.subject||'Class message',url:safe(item.url),category:'Message',moduleName:''});});saveNotice='';}
      catch(error){saveNotice=error.message||'The message shortcut could not be saved.';}change();
    }
    async function readMessage(id,{force=false}={}){
      if(dead||!/^\d+$/.test(id)||!inbox?.items.some(x=>x.id===id)||(!force&&threads.has(id)))return;
      const requestState={loading:true};threads.set(id,requestState);change();
      try{const raw=await client.readConversation(id,{user,signal:controller.signal});if(dead||threads.get(id)!==requestState)return;owned(raw);if(String(raw.conversation?.id)!==id)throw Error('Canvas returned a different conversation. Open the original Inbox.');threads.set(id,{data:raw.conversation,loading:false});}
      catch(error){if(dead||threads.get(id)!==requestState)return;if(!fail(error))threads.set(id,{loading:false,error:error.message||'This message could not load.'});}change();
    }
    function messageBody(item){
      // Messages are plain text: escaped, with any TeX between \( \), \[ \] or $$ $$ rendered as mathematics (math.js).
      const T=value=>root.ReserveMath?.hasMath(value)?root.ReserveMath.renderText(value):E(value);
      const entry=threads.get(item.id);if(!entry)return `<p>${T(item.excerpt||'')}</p>`;
      if(entry.loading)return '<p role="status">Loading the conversation…</p>';
      if(entry.error)return `<p role="alert">${E(entry.error)}</p>${button('retry-message','Try again','',`data-message="${E(item.id)}"`)}`;
      const people=new Map((entry.data.participants||[]).map(p=>[String(p.id),p.name||p.full_name||'']));
      const messages=entry.data.messages||[];
      return messages.slice(0,30).map(m=>`<article class="rd-thread-message"><header><strong>${E(people.get(String(m.author_id))||'Message')}</strong><time>${E(date(m.created_at))}</time></header><p>${T(m.body||'')}</p>${(m.attachments||[]).filter(a=>safe(a.url)).map(a=>`<a class="rd-document-link" href="${E(safe(a.url))}" target="_blank" rel="noopener noreferrer">${E(a.display_name||a.filename||'Attachment')} ↗</a>`).join('')}${m.forwarded_messages?.length||m.media_comment?'<p class="rd-hub-notice">Open the original conversation for forwarded messages or media.</p>':''}</article>`).join('')+(messages.length>30?'<p class="rd-hub-notice">The latest 30 messages are shown. Open the original conversation for earlier messages.</p>':'');
    }
    function renderInbox(courses=[]){
      availableCourses=courses;
      if(inboxCourse!=='all'&&!courses.some(course=>String(course.id)===inboxCourse))inboxCourse='all';
      // Messages carry Canvas's context name; show the course's short label, search both.
      const courseOf=x=>courses.find(course=>String(course.id)===String(x.courseId));
      const list=inbox?.items||[],matching=list.filter(x=>(inboxCourse==='all'||String(x.courseId)===inboxCourse)&&[x.subject,x.excerpt,x.courseName,courseOf(x)?.name,courseOf(x)?.courseSearch].join(' ').toLowerCase().includes(query.toLowerCase())),visible=matching.filter(x=>!unreadOnly||x.unread);
      // "All | Unread" is the page's one segmented control (it reuses the view filters' gliding chip).
      const segment=(value,label,count)=>`<button type="button" class="rd-filter" data-rd-action="hub-unread" data-value="${value}" aria-pressed="${unreadOnly===value}">${label} <span class="rd-n">${count}</span></button>`;
      return `<section class="rd-inbox" aria-label="Canvas message summaries"><header class="rd-page-heading"><div><h1>Messages from class</h1><p>Teacher reminders and instructions, in their own words.</p></div><div class="rd-heading-actions"><a class="rd-button rd-button--outline" href="${origin}/conversations">Full Inbox <span aria-hidden="true">↗</span></a><button type="button" class="rd-icon-button" data-rd-action="hub-inbox-refresh" data-course="" aria-label="Refresh messages" title="Refresh messages" ${inbox?.loading?'aria-disabled="true" aria-busy="true"':''}>${root.ReserveIcon?.('refresh','rd-icon')||''}${ring}</button></div></header><div class="rd-message-filter"><div class="rd-filter-group" role="group" aria-label="Which messages">${segment(false,'All',matching.length)}${segment(true,'Unread',matching.filter(x=>x.unread).length)}</div><span class="rd-inbox-course rd-select-text"><select data-rd-field="hub-course" aria-label="Message course"><option value="all">All courses</option>${courses.map(course=>`<option value="${E(course.id)}" ${inboxCourse===String(course.id)?'selected':''}>${E(option(course))}</option>`).join('')}</select></span><label class="rd-search">${root.ReserveIcon?.('search','rd-icon')||''}<span class="rd-sr-only">Search messages</span><input type="search" data-rd-field="hub-query" aria-label="Search messages" value="${E(query)}" placeholder="Search messages or a course"></label></div>${inbox?.loading?`<p role="status" class="rd-hub-notice" data-loading="true">${ring}Loading message summaries…</p>${list.length?'':ghosts}`:''}${inbox?.error?`<p role="alert" class="rd-hub-notice">${E(inbox.error)} ${button('inbox-refresh','Try again')}</p>`:''}${inbox?.raw?.truncated?'<p class="rd-hub-notice">Showing recent messages. Older conversations remain in the full Canvas Inbox.</p>':''}${saveNotice?`<p class="rd-hub-notice" role="alert">${E(saveNotice)}</p>`:''}<div class="rd-message-list">${visible.map(x=>`<details class="rd-message" data-message="${E(x.id)}" data-rd-section="message-${E(x.id)}" data-unread="${!!x.unread}"${tone(courseOf(x))}><summary><span class="rd-message-dot" data-unread="${!!x.unread}" aria-hidden="true"></span><span class="rd-message-copy"><strong>${x.unread?'<span class="rd-sr-only">Unread: </span>':''}${E(x.subject||'Untitled conversation')}</strong><span class="rd-message-line">${mini(courseOf(x),'row')}<span class="rd-announcement-meta"${courseOf(x)?` title="${E(full(courseOf(x)))}"`:''}>${E(short(courseOf(x))||x.courseName||'Canvas message')}</span><span aria-hidden="true"> · </span><span class="rd-message-excerpt">${E(x.excerpt||'Open the conversation to read this message.')}</span></span></span><time>${E(day(x.updatedAt))}</time></summary><div class="rd-message-body">${messageBody(x)}<div class="rd-message-actions"><a class="rd-button rd-button--primary" href="${E(safe(x.url))}">Reply in Canvas <span aria-hidden="true">↗</span></a>${messageShortcut(x)}</div></div></details>`).join('')||(!inbox?.loading?'<div class="rd-hub-empty"><h2>No messages in this view</h2><p>Try All courses or clear the search and unread filter. Messages Canvas does not associate with a course stay in All courses.</p></div>':'')}</div><p class="rd-message-disclaimer">Previews do not change read status. Open Full Inbox to reply, manage messages, or view forwarded messages and media.</p></section>`;
    }
    return {setCourse(id){inboxCourse=/^\d+$/.test(String(id))?String(id):'all';query='';unreadOnly=false;},loadCourse,loadDeck,loadInbox,renderHub,renderDeck,renderDeckHeader,renderInbox,readMessage,
      // Unread Inbox summaries across courses: the muted numeral on the Messages tab.
      unreadCount:()=>(inbox?.items||[]).filter(x=>x.unread).length,
      // After "Show all" the first revealed item takes focus; after "Show fewer" the control keeps it (dashboard.js applies these).
      takeFocusRequest(){const value=focusRequest;focusRequest=null;return value;},handle(action,data){
      if(dead)return;
      if(action==='hub-module-more'&&/^\d+$/.test(data.course||'')&&data.entry){
        const key=data.course+':'+data.entry;
        if(modulesOpen.has(key)){modulesOpen.delete(key);focusRequest={type:'more',action,courseId:String(data.course),id:String(data.entry)};}
        else{modulesOpen.add(key);const m=(materials?.getCourse(String(data.course))?.raw?.modules||[]).find(x=>String(x.id)===String(data.entry)),first=m&&moduleChapter(String(data.course),m).chapter?.rows[PREVIEW]?.item.id;focusRequest=first?{type:'row',courseId:String(data.course),id:first}:null;}
        change();return;
      }
      if(action==='hub-unread'){unreadOnly=data.value==='true';change();return;}
      if(action==='hub-read-more'&&data.entry){if(expanded.has(data.entry))expanded.delete(data.entry);else expanded.add(data.entry);change();return;}
      if(action==='hub-refresh-deck')return loadDeck(data.course,{force:true});
      if(action==='hub-read-message')return readMessage(data.message);
      if(action==='hub-capture-message'){const item=inbox?.items.find(x=>x.id===data.message);if(item)onCapture({name:item.subject||'Class message',courseId:saveCourses.get(item.id)||item.courseId||'personal',source:{kind:'message',title:item.subject||'Class message',url:safe(item.url)}});return;}
      if(action==='hub-capture-announcement'){const item=courses.get(String(data.course))?.announcements.find(x=>String(x.id)===String(data.announcement));if(item)onCapture({name:item.title,courseId:String(data.course),source:{kind:'announcement',title:item.title,url:safe(item.url)||origin+'/courses/'+data.course+'/announcements'}});return;}
      if(action==='hub-capture-home'&&/^\d+$/.test(data.course||'')){onCapture({name:'Follow the class schedule',courseId:String(data.course),source:{kind:'course-home',title:'Teacher’s home page',url:origin+'/courses/'+data.course}});return;}
      if(action==='hub-retry-message')readMessage(data.message,{force:true});if(action==='hub-save-message')saveMessage(data.message);if(action==='hub-refresh')loadCourse(data.course,{force:true});if(action==='hub-inbox-refresh')loadInbox({force:true});},input(field,value,data={}){if(dead)return;if(field==='hub-save-course'){if(availableCourses.some(c=>String(c.id)===String(value)))saveCourses.set(data.message,String(value));else saveCourses.delete(data.message);}if(field==='hub-course')inboxCourse=value==='all'||availableCourses.some(course=>String(course.id)===String(value))?String(value):'all';if(field==='hub-query')query=String(value).slice(0,200);if(field==='hub-unread')unreadOnly=!!value;change();},destroy,getCourse:id=>courses.get(String(id))};
  }
  root.ReserveCourseHubUI={create};if(typeof module!=='undefined'&&module.exports)module.exports=root.ReserveCourseHubUI;
})(globalThis);
