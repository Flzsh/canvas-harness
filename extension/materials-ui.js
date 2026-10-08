/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function(root){
  'use strict';
  // The one row every teacher-material list shares (Materials, the Course hub's modules, the deck's
  // documents): the title in the reading face, the row's own controls, then quiet tags at the right,
  // a kind word only where it adds meaning and the format. A worksheet's answer key stands in the
  // kind's place as a secondary link. The original file name stays in the title's tooltip (and so
  // its accessible description). `open` is the title control; the whole row answers to it.
  const tip=entry=>entry.original&&entry.original!==entry.title?` title="${root.ReserveUI.escapeHTML(entry.original)}"`:'';
  function teacherRow(entry,{open,actions='',tag='li',rowClass='',key='',newTab=()=>true}={}){
    const E=root.ReserveUI.escapeHTML,item=entry.item,href=value=>root.ReserveMaterials.safeURL(value);
    const answer=entry.key?(url=>`<a class="rd-row-key" href="${E(url)}"${newTab(url)?' target="_blank" rel="noopener noreferrer"':''}${tip(entry.key)||` title="${E(entry.key.title)}"`} aria-label="Answer key for ${E(entry.title)}">Answer key${newTab(url)?' <span aria-hidden="true">↗</span>':''}</a>`)(href(entry.key.item.url)):'';
    const kind=[entry.kind,item.locked?'Locked in Canvas':''].filter(Boolean).join(' · ');
    return `<${tag} class="rd-teacher-row${rowClass?' '+rowClass:''}"${key?` data-rd-key="${E(key)}"`:''} data-rd-row="${E(item.id)}">${open}${actions}<span class="rd-row-kind">${E(kind)}${kind&&answer?'<span aria-hidden="true"> · </span>':''}${answer}</span><span class="rd-row-format">${entry.format?`<span>${E(entry.format)}</span>`:''}</span></${tag}>`;
  }
  function create({store,user,client,onChange=()=>{},onAuthError=()=>{},onCapture=()=>{}}){
    const M=root.ReserveMaterials,U=root.ReserveUI,E=U.escapeHTML;
    const courses=new Map(),pages=new Map(),pending=new Map(),versions=new Map(),controller=new AbortController();
    let dead=false,activeCourse='',focusRequest=null;
    const views=new Map();
    function view(id=activeCourse){const key=String(id);if(!views.has(key))views.set(key,{query:'',category:'all',selected:null,message:'',custom:{title:'',url:''},pageScroll:0,open:new Set()});return views.get(key);}
    function activate(id){id=String(id||'');if(!/^\d+$/.test(id)&&id!=='all')return;if(id!==activeCourse){activeCourse=id;focusRequest=null;}}
    function clearViews(){views.clear();activeCourse='';focusRequest=null;}
    function invalidate(error){dead=true;controller.abort();courses.clear();pages.clear();versions.clear();clearViews();onAuthError(error);}
    const change=()=>{if(!dead)onChange();};
    const safe=value=>{try{const u=new URL(value,(globalThis.ReserveSite.origin()));return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}};
    const pinURL=item=>{const match=String(item.id).match(/^module:\d+:(\d+)$/);return match&&store.owner.origin===(globalThis.ReserveSite.origin())?(globalThis.ReserveSite.origin()+"/courses/")+item.courseId+'/modules/items/'+match[1]:safe(item.url);};
    const pins=id=>(store.get().resourcePins||[]).filter(p=>p.courseId===String(id)).map(p=>({...p,url:pinURL(p)}));
    const button=(name,label,id='',courseId='',extra='')=>`<button type="button" class="rd-text-button" data-rd-action="material-${name}" data-resource="${E(id)}" data-course="${E(courseId)}" ${extra}>${label}</button>`;
    const links=(items)=>items.map(p=>{const title=M.displayTitle(p.title);return `<a href="${E(safe(p.url))}" target="_blank" rel="noopener noreferrer"${title!==String(p.title||'').trim()?` title="${E(p.title)}"`:''}><span>${E(title)}</span><small>${E(p.category||'Saved link')}</small></a>`;}).join('');
    function normalize(raw){const result=M.normalizeCatalog(raw);return Array.isArray(result)?result:result.items||[];}
    function accept(raw,id){
      if(raw.origin!==store.owner.origin||String(raw.accountId)!==String(store.owner.accountId)||String(raw.courseId)!==String(id))throw Object.assign(Error('Your Canvas account changed. Reload Canvas.'),{code:'auth'});
      versions.set(String(id),(versions.get(String(id))||0)+1);
      for(const key of pages.keys())if(key.startsWith(String(id)+':'))pages.delete(key);
      const current=view(id),items=normalize(raw);current.selected=null;current.pageScroll=0;
      if(!['all','saved'].includes(current.category)&&!items.some(item=>item.category===current.category))current.category='all';
      courses.set(String(id),{raw,items,loading:false,error:''});
    }
    async function load(id,{force=false}={}){
      id=String(id);if(dead||!/^\d+$/.test(id)||pending.has(id))return pending.get(id);if(!activeCourse)activate(id);
      if(!force&&courses.has(id))return;
      const op=(async()=>{
        let entry=courses.get(id)||{items:[],raw:null};courses.set(id,{...entry,loading:true,error:''});change();
        try{
          if(!force&&store.readResourceCache){const cached=await store.readResourceCache(id);if(dead)return;if(cached){accept(cached,id);const age=Date.now()-Date.parse(cached.fetchedAt);if(age>=0&&age<900000&&!cached.errors?.length){change();return;}entry=courses.get(id);courses.set(id,{...entry,loading:true});change();}}
          if(!client?.loadCourseResources)throw Error('Open Canvas and refresh to load course materials.');
          const raw=await client.loadCourseResources(id,{user,signal:controller.signal});if(dead)return;accept(raw,id);
          try{await store.writeResourceCache?.(raw);}catch{if(!dead)view(id).message='Materials loaded. They could not be saved for a later visit.';}
        }catch(error){if(dead)return;if(error.code==='auth'){invalidate(error);}
          else courses.set(id,{...(courses.get(id)||entry),loading:false,error:error.message||'Materials could not load.'});
        }finally{if(!dead){const current=courses.get(id);if(current)current.loading=false;change();}}
      })();pending.set(id,op);op.finally(()=>pending.delete(id));return op;
    }
    function find(id,courseId){return courses.get(String(courseId))?.items.find(x=>x.id===id)||pins(courseId).find(x=>x.id===id);}
    async function save(changeData,courseId=activeCourse){if(dead)return false;const target=view(courseId);try{await store.update(changeData);if(dead||views.get(String(courseId))!==target)return false;target.message='';change();return true;}catch(e){if(dead||views.get(String(courseId))!==target)return false;target.message=e.message||'The shortcut could not be saved.';change();return false;}}
    async function openPage(item){
      if(dead||!item||item.locked)return;
      const target=view(item.courseId);if(target.selected?.id!==item.id)target.pageScroll=0;target.selected={courseId:String(item.courseId),id:item.id};const key=item.courseId+':'+item.id;
      if(String(item.courseId)===activeCourse)focusRequest={type:'title'};
      const version=versions.get(String(item.courseId));
      if(pages.has(key)){change();return;}
      pages.set(key,{loading:true,title:item.title});change();
      try{
        const raw=courses.get(String(item.courseId))?.raw;
        let page;
        if(item.kind==='Syllabus')page={title:item.title,body:raw?.syllabusBody||''};
        else if(item.kind==='FrontPage')page=raw?.frontPage;
        if(!page)page=await client.readCoursePage(String(item.courseId),item.pageUrl,{user,signal:controller.signal});
        if(dead||versions.get(String(item.courseId))!==version)return;
        const body=typeof page==='string'?page:page?.body||page?.page?.body||'';
        const template=document.createElement('template');template.innerHTML=body;
        const embeds=Array.from(template.content.querySelectorAll('iframe[src]')).map(e=>({url:safe(e.getAttribute('src')),title:e.getAttribute('title')||'Embedded document'})).filter(x=>x.url);
        pages.set(key,{title:page?.title||item.title,html:U.safeRichHTML(body),embeds,loading:false,url:safe(item.url)});
      }catch(error){if(dead||versions.get(String(item.courseId))!==version)return;if(error.code==='auth'){invalidate(error);}else pages.set(key,{title:item.title,error:error.message||'This page could not load.'});}
      change();
    }
    function pagePanel(courseId){
      const selected=view(courseId).selected;
      if(!selected||selected.courseId!==String(courseId))return '';
      const key=selected.courseId+':'+selected.id,page=pages.get(key);if(!page)return '';
      return `<aside class="rd-material-page" aria-label="Course page preview" data-material-course="${E(courseId)}" data-material-resource="${E(selected.id)}"><div class="rd-section-heading"><div class="rd-material-title-block"><h2 tabindex="-1" id="rd-material-title">${E(page.title)}</h2>${page.url?`<a class="rd-text-button" href="${E(page.url)}" target="_blank" rel="noopener noreferrer">Open original in Canvas ↗</a>`:''}</div>${button('close','Close')}</div>${page.loading?'<p role="status" class="rd-material-notice">Loading this page…</p>':page.error?`<p role="alert">${E(page.error)}</p>${button('retry-page','Try again',selected.id,courseId)}`:`${page.embeds?.length?`<div class="rd-saved-links">${links(page.embeds.map(e=>({...e,category:'Embedded document'})))}</div>`:''}<div class="rd-rich-text">${page.html||'<p>This page has no readable text. Open the original for embedded content.</p>'}</div>`}</aside>`;
    }
    // One line per item (the shared teacher-material row, below): a readable page opens here (its
    // title is the Read control; the original stays one quiet "Canvas ↗" away), anything else opens
    // in Canvas. Plan and Save wait for hover or focus; the tags stand at the right.
    function materialRow(entry,courseId,{head=null,tag='li'}={}){
      const item=entry.item,saved=pins(courseId).some(p=>p.id===item.id),readable=!!item.pageUrl&&!item.locked,reading=readable&&view(courseId).selected?.id===item.id;
      const open=readable?`<button type="button" class="rd-row-open" data-rd-action="material-read" data-resource="${E(item.id)}" data-course="${E(courseId)}" aria-label="Read ${E(entry.title)}" data-read-row="true"${reading?' aria-current="true"':''}${tip(entry)}>${E(entry.title)}</button>`:`<a class="rd-row-open" href="${E(safe(item.url))}" target="_blank" rel="noopener noreferrer"${tip(entry)}>${E(entry.title)}&nbsp;<span aria-hidden="true">↗</span></a>`;
      const actions=`<span class="rd-material-actions">${readable?`<a class="rd-text-button" href="${E(safe(item.url))}" target="_blank" rel="noopener noreferrer" aria-label="Open ${E(entry.title)} in Canvas">Canvas <span aria-hidden="true">↗</span></a>`:''}${!item.locked?button('capture','Plan',item.id,courseId,`aria-label="Plan work from ${E(entry.title)}"`):''}${button('pin',saved?'Bookmarked':'Bookmark',item.id,courseId,`aria-label="${saved?'Remove bookmark:':'Bookmark'} ${E(entry.title)}" aria-pressed="${saved}"`)}</span>`;
      // The page open in the reader beside the list keeps its row on the tint.
      return teacherRow(entry,{open:head?head(open):open,actions,tag,rowClass:[head?'rd-chapter-row':'',reading?'rd-teacher-row--open':''].filter(Boolean).join(' '),key:`material-row-${courseId}-${item.id}`});
    }
    // Teacher materials read as the chapters of a book: the course's modules in Canvas order (numbered
    // unless the teacher's names already are), then its loose pages and files. Long chapters open on
    // their first few items; a search keeps the chapters of its matches, whole.
    const LONG=8,PREVIEW=5;
    function listing(id){
      const {query,category}=view(id),entry=courses.get(id),saved=pins(id),items=entry?.items||[],q=String(query||'').trim().toLowerCase();
      const all=category==='saved'?saved:items.filter(x=>x.kind!=='Assignment');
      const pool=all.filter(x=>category==='all'||category==='saved'||x.category===category);
      const matches=pool.filter(x=>M.searchText(x).toLowerCase().includes(q));
      const visible=!q?pool:matches.length?matches:pool.filter(x=>(x.moduleName||'').toLowerCase().includes(q));
      return {q,visible,chapters:M.outline(all,visible.slice(0,400),{numbers:category!=='saved'})};
    }
    function chapterBlock(ch,courseId,{collapse}){
      const id=`rd-chapter-${courseId}-${ch.key}`,count=ch.items.length,no=ch.number?`<span class="rd-chapter-no" aria-hidden="true">${ch.number}</span>`:'';
      const head=`class="rd-chapter-head" id="${E(id)}" tabindex="-1" data-chapter="${E(ch.key)}" data-course="${E(courseId)}"`,key=`chapter-${courseId}-${ch.key}`;
      // A chapter that is one item of its own name (Magic 8-Ball › Magic 8-Ball) is one row: the head opens it.
      if(ch.single&&ch.rows.length===1)return `<section class="rd-material-group rd-chapter rd-chapter--single" data-rd-key="${E(key)}" aria-labelledby="${E(id)}">${materialRow(ch.rows[0],courseId,{tag:'div',head:open=>`<h3 ${head}>${no}${open}</h3>`})}</section>`;
      const folded=collapse&&ch.rows.length>LONG,rows=folded?ch.rows.slice(0,PREVIEW):ch.rows;
      const more=collapse!==null&&ch.rows.length>LONG?`<button type="button" class="rd-chapter-more" data-rd-action="material-more" data-resource="${E(ch.key)}" data-course="${E(courseId)}" aria-expanded="${!folded}" aria-controls="${E(id)}-items">${folded?`Show all ${count}`:'Show fewer'}${root.ReserveIcon?.('chevron','rd-icon')||''}</button>`:'';
      return `<section class="rd-material-group rd-chapter" data-rd-key="${E(key)}" aria-labelledby="${E(id)}"><h3 ${head}>${no}<span class="rd-chapter-name">${E(ch.name)}</span> <span class="rd-chapter-count">${count} ${count===1?'item':'items'}</span></h3><ul class="rd-chapter-items" id="${E(id)}-items">${rows.map(row=>materialRow(row,courseId)).join('')}</ul>${more}</section>`;
    }
    // "Saved just now", "Saved 5 min ago", then a date.
    function savedAt(value){const ms=Date.parse(value||'');if(!Number.isFinite(ms))return '';const diff=Math.max(0,Date.now()-ms);return diff<60000?'Saved just now':diff<3600000?`Saved ${Math.floor(diff/60000)} min ago`:`Saved ${new Date(ms).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}`;}
    function renderLibrary(course){
      if(dead)return '';
      if(!course)return '<section class="rd-work"><div class="rd-empty"><h2>Choose a course</h2><p>Select a course to see its worksheets, pages and schedules.</p></div></section>';
      const id=String(course.id);activate(id);const {query,category,selected,message,custom,open}=view(id),entry=courses.get(id),saved=pins(id),items=entry?.items||[];
      const categories=[...new Set(items.map(x=>x.category).filter(Boolean))].sort();
      const {q,visible,chapters}=listing(id),numbered=chapters.some(ch=>ch.number);
      const rows=chapters.map(ch=>chapterBlock(ch,id,{collapse:q?null:!open.has(ch.key)})).join('');
      // Under the search, the chapters as one quiet line: each jumps to its chapter.
      const jump=chapters.length>2?`<nav class="rd-chapter-jump" aria-label="Chapters"><span class="rd-chapter-jump-label" aria-hidden="true">Chapters</span>${chapters.map(ch=>`<button type="button" class="rd-chapter-link" data-rd-action="material-jump" data-resource="${E(ch.key)}" data-course="${E(id)}">${E(ch.name)}${ch.items.length>1?` <span class="rd-n">${ch.items.length}<span class="rd-sr-only"> items</span></span>`:''}</button>`).join('<span class="rd-chapter-dot" aria-hidden="true">·</span>')}</nav>`:'';
      const raw=entry?.raw,tone=/^#[0-9a-f]{6}$/i.test(course.color||'')?` style="--rd-course:${course.color};--rd-course-ink:${root.ReserveCore?.courseInk?.(course.color)||course.color}"`:'',ring='<span class="rd-sync-ring" aria-hidden="true"></span>';
      // A card-less banner with the course's wide scene; the search is shaped like a composer with the
      // type filter as text inside it and an attached tray for your own shortcuts.
      const named=root.ReserveCourseArt?.titleFrame?.(course,{place:'banner'})||'';// the course name as artwork (course-art.js; refresh.css 9), last in the banner
      // The banner's own style carries the piece's width (the room's box starts where the piece ends), beside the course colour.
      const nameW=named?root.ReserveCourseArt.titleStyle?.(course)||'':'',look=!nameW?tone:tone?tone.replace(/"$/,`;${nameW}"`):` style="${nameW}"`;
      return `<section class="rd-materials" aria-label="Course materials"><header class="rd-materials-header rd-course-banner"${named?' data-titled="true"':''}${look}><div class="rd-banner-art" aria-hidden="true">${root.ReserveCourseArt?.scene?.(course,{crop:'wide'})||''}</div><div><h2 title="${E(course.originalName&&course.originalName!==course.name?`${course.name} · ${course.originalName}`:course.name)}">${E(course.shortName||course.name)}</h2><p><strong class="rd-course-detail">${E(course.shortName||course.name)}</strong> · ${course.subject||course.teacher||course.sub?`<strong class="rd-course-detail">${E([course.subject,course.teacher,course.sub].filter(Boolean).join(' · '))}</strong> · `:''}Worksheets, pages & schedules</p></div><div class="rd-heading-actions"><a class="rd-button rd-button--outline" href="${globalThis.ReserveSite.origin()}/courses/${id}">Course home <span aria-hidden="true">↗</span></a><button type="button" class="rd-icon-button" data-rd-action="material-refresh" data-resource="" data-course="${E(id)}" aria-label="Refresh materials" title="Refresh materials" ${entry?.loading?'aria-disabled="true" aria-busy="true"':''}>${root.ReserveIcon?.('refresh','rd-icon')||''}${ring}</button></div>${named}</header><div class="rd-material-search"><div class="rd-composer-field"><label class="rd-search">${root.ReserveIcon?.('search','rd-icon')||''}<span class="rd-sr-only">Search course materials</span><input type="search" data-rd-field="material-query" placeholder="Find a worksheet, lesson or schedule" value="${E(query)}"></label><span class="rd-select-text"><select data-rd-field="material-category" aria-label="Material type"><option value="all">All materials</option><option value="saved" ${category==='saved'?'selected':''}>Saved shortcuts</option>${categories.map(cat=>`<option ${category===cat?'selected':''}>${E(cat)}</option>`).join('')}</select></span></div><div class="rd-composer-tray"><details class="rd-add-shortcut" data-rd-section="shortcut-${E(id)}" ${custom.title||custom.url?'open':''}><summary>${root.ReserveIcon?.('plus','rd-icon')||''}${custom.title||custom.url?'Finish your shortcut':'Add your own shortcut'}</summary><p>A class document or your own work file.</p><div><input data-rd-field="material-title" maxlength="300" aria-label="Shortcut name" placeholder="Name" value="${E(custom.title)}"><input data-rd-field="material-url" type="url" maxlength="2000" aria-label="Shortcut URL" placeholder="https://…" value="${E(custom.url)}">${button('add','Save shortcut','',id)}</div></details></div>${jump}</div>${message?`<p role="alert" class="rd-material-notice">${E(message)}</p>`:''}${entry?.loading?`<p class="rd-material-notice" role="status" data-loading="true">${ring}Loading course materials… You can keep using your saved links.</p>`:''}${entry?.error?`<p class="rd-material-notice" role="alert">${E(entry.error)} ${button('refresh','Try again','',id)}</p>`:''}${raw?.errors?.length?`<details class="rd-material-notice"><summary>Some sources could not load (${raw.errors.length})</summary>${raw.errors.map(e=>`<p>${E(e.source)}: ${E(e.message)}</p>`).join('')}</details>`:''}${!entry?button('refresh','Load course materials','',id):''}${saved.length&&category!=='saved'&&!query?`<div class="rd-saved"><h3>Saved shortcuts</h3><div class="rd-saved-links">${links(saved)}</div></div>`:''}<div class="rd-material-columns${selected?.courseId===id?' rd-material-columns--reading':''}"><div class="rd-material-list${numbered?' rd-chapters--numbered':''}">${rows?`<div class="rd-chapter-flow">${rows}</div>`:(entry?.loading?'<div class="rd-ghost-rows" aria-hidden="true"><i></i><i></i><i></i></div>':'<div class="rd-empty"><h3>'+ (query?'No matching materials':'No materials in this view')+'</h3><p>Assignments and external class schedules can contain additional work.</p></div>')}${visible.length>400?'<p class="rd-material-notice">Showing the first 400 matches. Use search to narrow the list.</p>':''}</div>${pagePanel(id)}</div>${raw?`<p class="rd-material-footnote">${items.length} resources · <span title="${E(new Date(raw.fetchedAt).toLocaleString())}">${E(savedAt(raw.fetchedAt)||'Saved '+new Date(raw.fetchedAt).toLocaleString())}</span>. Open external schedules for current homework.</p>`:''}</section>`;
    }
    function renderRelated(item,directLinks=[]){
      if(dead)return '';
      const linkKey=value=>{try{const u=new URL(value);const file=u.pathname.match(/\/files\/(\d+)/);return file?u.origin+':file:'+file[1]:u.origin+u.pathname;}catch{return value;}};
      const attached=new Set(directLinks.map(x=>linkKey(x.url)));
      if(!item)return '';const id=String(item.courseId),saved=pins(id).filter(x=>!attached.has(linkKey(x.url))),entry=courses.get(id);
      const suggested=entry?M.suggestions(entry.items,item,{limit:4}).filter(x=>!saved.some(p=>p.id===x.id)&&!attached.has(linkKey(x.url))):[];
      return `<section class="rd-related"><div class="rd-section-heading"><h3>Course materials</h3><button type="button" class="rd-text-button" data-rd-action="open-materials" data-id="${E(id)}">Browse ${root.ReserveIcon?.('arrow','rd-icon')||'→'}</button></div>${entry?.raw?.errors?.length||entry?.error?'<p class="rd-material-notice" role="status">Some course materials could not load. Browse materials for details or to retry.</p>':''}${saved.length?`<div class="rd-saved-links">${links(saved.slice(0,8))}</div>`:''}${suggested.length?`<div class="rd-related-list">${suggested.map(x=>`<div><a href="${E(safe(x.url))}" target="_blank" rel="noopener noreferrer">${E(x.title)}</a><small>${E(x.reason)} · ${E(x.category)}</small>${button('pin','Save',x.id,id,`aria-label="Save ${E(x.title)}"`)}</div>`).join('')}</div>`:!saved.length?'<p class="rd-muted">Find worksheets, lesson pages and class schedules. Save the ones you use to keep them here.</p>':''}</section>`;
    }
    function handle(action,data){
      if(dead)return;
      const id=data.resource,courseId=data.course,item=find(id,courseId);
      if(action==='material-refresh'){load(courseId,{force:true});return;}
      if(action==='material-capture'&&item&&!item.locked){onCapture({name:M.displayTitle(item.title),courseId:String(courseId),source:{kind:'material',title:item.title,url:pinURL(item)}});return;}
      // "Show all 45" / "Show fewer": opening moves focus to the first item it revealed; closing keeps it on the control.
      if(action==='material-more'&&/^\d+$/.test(courseId||'')){
        const current=view(courseId),key=String(id||''),course=String(courseId);
        if(current.open.has(key)){current.open.delete(key);focusRequest={type:'more',action,courseId:course,id:key};}
        else{current.open.add(key);const first=listing(course).chapters.find(ch=>ch.key===key)?.rows[PREVIEW]?.item.id;focusRequest=first?{type:'row',courseId:course,id:first}:null;}
        change();return;
      }
      // A chapter link moves focus to its chapter's head (dashboard.js scrolls it into view).
      if(action==='material-jump'&&/^\d+$/.test(courseId||'')){focusRequest={type:'chapter',courseId:String(courseId),id:String(id||'')};change();return;}
      if(action==='material-read'){openPage(item);return;}
      if(action==='material-close'){const current=view();focusRequest={type:'resource',...current.selected};current.selected=null;current.pageScroll=0;change();return;}
      if(action==='material-retry-page'){pages.delete(courseId+':'+id);openPage(item);return;}
      if(action==='material-pin'&&item){save(d=>{const list=d.resourcePins||(d.resourcePins=[]),index=list.findIndex(p=>p.courseId===String(courseId)&&p.id===id);if(index>=0)list.splice(index,1);else list.push({id:item.id,courseId:String(courseId),title:item.title,url:pinURL(item),category:item.category,moduleName:item.moduleName});},courseId);return;}
      if(action==='material-add'&&/^\d+$/.test(courseId||'')){
        const current=view(courseId),draft={...current.custom},url=safe(draft.url.trim()),title=draft.title.trim();if(!url||!title){current.message='Enter a name and a valid web link.';change();return;}
        save(d=>{const list=d.resourcePins||(d.resourcePins=[]);if(!list.some(p=>p.courseId===courseId&&p.url===url))list.push({id:'custom-'+(root.crypto?.randomUUID?.()||Date.now()),courseId,title,url,category:'My shortcut',moduleName:''});},courseId).then(ok=>{if(ok&&views.get(String(courseId))===current&&current.custom.title===draft.title&&current.custom.url===draft.url){current.custom={title:'',url:''};change();}});
      }
    }
    return {load,renderLibrary,renderRelated,handle,getCourse:id=>courses.get(String(id)),takeFocusRequest(){const value=focusRequest;focusRequest=null;return value;},input(field,value){if(dead)return;const current=view();if(field==='material-query')current.query=String(value).slice(0,200);if(field==='material-category')current.category=value;if(field==='material-title'){current.custom.title=String(value).slice(0,300);return;}if(field==='material-url'){current.custom.url=String(value).slice(0,2000);return;}change();},activate,rememberPageScroll(courseId,id,top){const current=view(courseId);if(current.selected?.id===id)current.pageScroll=Number.isFinite(top)?Math.max(0,Math.min(1000000,top)):0;},pageScroll(courseId,id){const current=view(courseId);return current.selected?.id===id?current.pageScroll:0;},reset(){const current=view();current.query='';current.category='all';current.selected=null;current.pageScroll=0;focusRequest=null;},destroy(){dead=true;controller.abort();courses.clear();pages.clear();clearViews();},getItems:id=>courses.get(String(id))?.items||[]};
  }
  root.ReserveMaterialsUI={create,row:teacherRow,tip};if(typeof module!=='undefined'&&module.exports)module.exports=root.ReserveMaterialsUI;
})(globalThis);
