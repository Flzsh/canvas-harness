/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function(root){
  'use strict';
 const enabled=id=>!root.ReserveFeatures||root.ReserveFeatures.enabled(id);
  // The one row every teacher-material list shares (Materials, the Course hub's modules, the deck's
  // documents): the title in the reading face, the row's own controls, then quiet tags at the right,
  // a kind word only where it adds meaning and the format. A worksheet's answer key stands in the
  // kind's place as a secondary link. The original file name stays in the title's tooltip (and so
  // its accessible description). `open` is the title control; the whole row answers to it.
  const tip=entry=>entry.original&&entry.original!==entry.title?` title="${root.ReserveUI.escapeHTML(entry.original)}"`:'';
  // (pages-42) Materials' shelf rows pass `lead` (the kraft tag that names the format, first in the row) and `meta`
  // (where the item lives and when it last changed); the format then stands only in the tag. The Course hub and the
  // deck pass neither, and their rows are exactly what they were.
  function teacherRow(entry,{open,actions='',tag='li',rowClass='',key='',newTab=()=>true,pdfAttrs=()=>'',lead='',meta='',after=''}={}){
    const E=root.ReserveUI.escapeHTML,item=entry.item,href=value=>root.ReserveMaterials.safeURL(value);
    const answer=entry.key?(url=>`<a class="rd-row-key" href="${E(url)}"${newTab(url)?' target="_blank" rel="noopener noreferrer"':''}${tip(entry.key)||` title="${E(entry.key.title)}"`}${pdfAttrs(entry.key.item)} aria-label="Answer key for ${E(entry.title)}">Answer key${newTab(url)?' <span aria-hidden="true">↗</span>':''}</a>`)(href(entry.key.item.url)):'';
    const kind=[entry.kind,item.locked?'Locked in Canvas':''].filter(Boolean).join(' · ');
    return `<${tag} class="rd-teacher-row${rowClass?' '+rowClass:''}"${key?` data-rd-key="${E(key)}"`:''} data-rd-row="${E(item.id)}">${lead}${open}${actions}<span class="rd-row-kind">${E(kind)}${kind&&answer?'<span aria-hidden="true"> · </span>':''}${answer}${after&&(kind||answer)?'<span aria-hidden="true"> · </span>':''}${after}</span>${lead?meta:`<span class="rd-row-format">${entry.format?`<span>${E(entry.format)}</span>`:''}</span>`}</${tag}>`;
  }
  // THE SHELF (pages-42). Materials is the course's shelf: its drawing and colour at the head, the kind of each item as a
  // kraft paper tag, and one row of shelves: Recent (newest first, by age), Modules (the teacher's chapters in Canvas
  // order), Files, Pages, Links (newest first), Saved (your bookmarks and own links).
  const SHELVES=[['recent','Recent'],['modules','Modules'],['files','Files'],['pages','Pages'],['links','Links'],['saved','Saved']];
  const AGES=[['week','This week'],['month','This month'],['earlier','Earlier'],['undated','No date']];
  // The tag's paper for a format (the punched study tags' washes, refresh.css "Saved study aids"): documents on kraft,
  // slides on yellow, sheets on green, media on blue, Canvas pages on the paper itself, links on lilac.
  const PAPER={
    PDF:'doc',
    Word:'doc',
    Doc:'doc',
    Text:'doc',
    Pages:'doc',
    Slides:'slides',
    Sheet:'sheet',
    Form:'sheet',
    Image:'media',
    Video:'media',
    Audio:'media',
    Page:'page',
    'Web page':'page',
    Link:'link',
    ZIP:'doc'
  };
  // Days and times in the student's own zone (settings.timeZone, as Home and the Planner show them), not the laptop's.
  const FORMATS=new Map();
  function inZone(zone,options){
    const key=(zone||'')+'|'+JSON.stringify(options);
    let f=FORMATS.get(key);
    if(!f){
      try{f=new Intl.DateTimeFormat('en-US',zone?{...options,timeZone:zone}:options);}catch{f=new Intl.DateTimeFormat('en-US',options);}
      if(FORMATS.size>=40)FORMATS.clear();
      FORMATS.set(key,f);
    }
    return f;
  }
  function dayIn(ms,zone){const p={};for(const x of inZone(zone,{year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(ms))p[x.type]=x.value;return p.year+'-'+p.month+'-'+p.day;}
  // "Today", "Yesterday", "Nov 12" (the year only when it is another year), the days counted in the zone: the same words as Messages.
  function dayWord(value,now=Date.now(),zone){
    const ms=new Date(value??'').getTime();
    if(!Number.isFinite(ms))return '';
    const d=dayIn(ms,zone),t=dayIn(now,zone),n=Math.round((Date.parse(t+'T12:00:00Z')-Date.parse(d+'T12:00:00Z'))/864e5);
    return n===0?'Today':n===1?'Yesterday':inZone(zone,{month:'short',day:'numeric',...(d.slice(0,4)!==t.slice(0,4)?{year:'numeric'}:{})}).format(ms);
  }
  function create({
    isSelected=()=>false,
    store,
    user,
    client,
    getAssignments=()=>undefined,
    onChange=()=>{},
    onAuthError=()=>{},
    onCapture=()=>{},
    getTimeZone=()=>undefined
  }){
    if(!enabled('materials')||!root.ReserveMaterials)return null;
    // (the student's zone from Home's settings; without one, the school's, as the rest of Canvas Harness)
    const zone=()=>{try{const value=getTimeZone();if(typeof value==='string'&&value)return value;}catch{}return root.ReserveSite?.timeZone?.();};
    const stamp=value=>{const ms=new Date(value??'').getTime();return Number.isFinite(ms)?inZone(zone(),{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(ms):'';};
    const M=root.ReserveMaterials,U=root.ReserveUI,E=U.escapeHTML;
    const courses=new Map(),pages=new Map(),pending=new Map(),versions=new Map(),controller=new AbortController();
    let dead=false,activeCourse='',focusRequest=null;
    const views=new Map();
    // The shelf a course opens on: Recent when its materials carry dates (Canvas gave its files or pages), else Modules; a
    // shelf the student chose stays chosen for that course.
    function shelfOfView(id){const chosen=view(id).kind;return chosen||((courses.get(String(id))?.items||[]).some(x=>x.updatedAt)?'recent':'modules');}
    function view(id=activeCourse){
      const key=String(id);
      if(!views.has(key))views.set(key,{query:'',category:'all',kind:'',selected:null,message:'',custom:{title:'',url:''},pageScroll:0,open:new Set()});
      return views.get(key);
    }
    function activate(id){id=String(id||'');if(!/^\d+$/.test(id)&&id!=='all')return;if(id!==activeCourse){activeCourse=id;focusRequest=null;}}
    function clearViews(){views.clear();activeCourse='';focusRequest=null;}
    function invalidate(error){dead=true;controller.abort();courses.clear();pages.clear();versions.clear();clearViews();onAuthError(error);}
    const change=()=>{if(!dead)onChange();};
    // (a section the teacher does not use is told to the AI, not shown to the student as a fault)
    const faults=raw=>(raw?.errors||[]).filter(e=>!e.hidden);
    const safe=value=>{try{const u=new URL(value,(globalThis.ReserveSite.origin()));return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}};
    const pinURL=item=>{
      const match=String(item.id).match(/^module:\d+:(\d+)$/);
      return match&&store.owner.origin===(globalThis.ReserveSite.origin())?(globalThis.ReserveSite.origin()+"/courses/")+item.courseId+'/modules/items/'+match[1]:safe(item.url);
    };
    const pins=id=>(store.get().resourcePins||[]).filter(p=>p.courseId===String(id)).map(p=>({...p,url:pinURL(p)}));
    const button=(name,label,id='',courseId='',extra='')=>name==='capture'&&!enabled('tools')?'':`<button type="button" class="rd-text-button" data-rd-action="material-${name}" data-resource="${E(id)}" data-course="${E(courseId)}" ${extra}>${label}</button>`;
    function pdfAttributes(item,courseId){
      const fileId=String(item.contentId||''),course=String(courseId||'');
      if(!enabled('pdf')||item.kind!=='File'||String(item.courseId)!==course||!/^\d+$/.test(fileId)||!/^\d+$/.test(course))return '';
      const files=courses.get(course)?.raw?.files,file=Array.isArray(files)?files.find(x=>String(x.id)===fileId):null;
      const names=[file?.filename,file?.display_name,item.title];
      const name=String(names.find(x=>/\.pdf$/i.test(String(x||'').trim()))||names.find(x=>String(x||'').trim())||'');
      if(!/\.pdf$/i.test(name.trim())&&!/^application\/pdf(?:\s*;|$)/i.test(String(file?.['content-type']||file?.content_type||'')))return '';
      return ` data-pdf-file-id="${E(fileId)}" data-pdf-course-id="${E(course)}" data-pdf-name="${E(name)}" data-pdf-mime="application/pdf"`;
    }
    const links=(items)=>items.map(p=>{
      const title=M.displayTitle(p.title);
      return `<a href="${E(safe(p.url))}" target="_blank" rel="noopener noreferrer"${title!==String(p.title||'').trim()?` title="${E(p.title)}"`:''}><span>${E(title)}</span><small>${E(p.category||'Saved link')}</small></a>`;
    }).join('');
    function normalize(raw){const result=M.normalizeCatalog(raw);return Array.isArray(result)?result:result.items||[];}
    function accept(raw,id){
      if(raw.origin!==store.owner.origin||String(raw.accountId)!==String(store.owner.accountId)||String(raw.courseId)!==String(id))
        throw Object.assign(Error('Your Canvas account changed. Reload Canvas.'),{code:'auth'});
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
          if(!force&&store.readResourceCache){
            const cached=await store.readResourceCache(id);
            if(dead)return;
            if(cached){
              accept(cached,id);
              const age=Date.now()-Date.parse(cached.fetchedAt);
              if(age>=0&&age<900000&&!cached.errors?.some(e=>!e.hidden)){change();return;}
              entry=courses.get(id);
              courses.set(id,{...entry,loading:true});
              change();
            }
          }
          if(!client?.loadCourseResources)throw Error('Open Canvas and refresh to load course materials.');
          // The resource client may not be the one that loaded the current dashboard snapshot.
          const raw=await client.loadCourseResources(id,{user,signal:controller.signal,force,assignments:getAssignments()});if(dead)return;accept(raw,id);
          try{await store.writeResourceCache?.(raw);}catch{if(!dead)view(id).message='Materials loaded. They could not be saved for a later visit.';}
        }catch(error){if(dead)return;if(error.code==='auth'){invalidate(error);}
          else courses.set(id,{...(courses.get(id)||entry),loading:false,error:error.message||'Materials could not load.'});
        }finally{if(!dead){const current=courses.get(id);if(current)current.loading=false;change();}}
      })();pending.set(id,op);op.finally(()=>pending.delete(id));return op;
    }
    function find(id,courseId){return courses.get(String(courseId))?.items.find(x=>x.id===id)||pins(courseId).find(x=>x.id===id);}
    async function save(changeData,courseId=activeCourse){
      if(dead)return false;
      const target=view(courseId);
      try{
        await store.update(changeData);
        if(dead||views.get(String(courseId))!==target)return false;
        target.message='';
        change();
        return true;
      }catch(e){if(dead||views.get(String(courseId))!==target)return false;target.message=e.message||'The shortcut could not be saved.';change();return false;}
    }
    async function openPage(item){
      if(dead||!item||item.locked)return;
      const target=view(item.courseId);
      if(target.selected?.id!==item.id)target.pageScroll=0;
      target.selected={courseId:String(item.courseId),id:item.id};
      const key=item.courseId+':'+item.id;
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
      }catch(error){
        if(dead||versions.get(String(item.courseId))!==version)return;
        if(error.code==='auth'){invalidate(error);}else pages.set(key,{title:item.title,error:error.message||'This page could not load.'});
      }
      change();
    }
    function pagePanel(courseId){
      const selected=view(courseId).selected;
      if(!selected||selected.courseId!==String(courseId))return '';
      const key=selected.courseId+':'+selected.id,page=pages.get(key);if(!page)return '';
      return `<aside class="rd-material-page" aria-label="Course page preview" data-material-course="${E(courseId)}" data-material-resource="${E(selected.id)}"><div class="rd-section-heading"><div class="rd-material-title-block"><h2 tabindex="-1" id="rd-material-title">${E(page.title)}</h2>${page.url?`<a class="rd-text-button" href="${E(page.url)}" target="_blank" rel="noopener noreferrer">Open original in Canvas ↗</a>`:''}</div>${button('close','Close')}</div>${page.loading?'<p role="status" class="rd-material-notice">Loading this page…</p>':page.error?`<p role="alert">${E(page.error)}</p>${button('retry-page','Try again',selected.id,courseId)}`:`${page.embeds?.length?`<div class="rd-saved-links">${links(page.embeds.map(e=>({...e,category:'Embedded document'})))}</div>`:''}<div class="rd-rich-text">${page.html||'<p>This page has no readable text. Open the original for embedded content.</p>'}</div>`}</aside>`;
    }
    // One line per item on the shelf (the shared teacher-material row): first the kraft tag that names what it is
    // (PDF, Slides, Page, Link…), then the title in the reading face: a readable page opens here (its title is the
    // Read control; the original stays one quiet "Canvas ↗" away), anything else opens in Canvas or its own site. Plan
    // and Bookmark wait for hover or focus; the kind word and the answer key, then where it lives and when it changed.
    function tagOf(entry){
      const item=entry.item,format=entry.format||({Quiz:'Quiz',Discussion:'Discussion',ExternalTool:'Tool'})[item.kind]||'File';
      return `<span class="rd-file-tag" data-paper="${E(item.locked?'locked':PAPER[format]||'doc')}">${E(format)}</span>`;
    }
    function materialRow(entry,courseId,{head=null,tag='li',where=false}={}){
      const item=entry.item,saved=pins(courseId).some(p=>p.id===item.id),readable=!!item.pageUrl&&!item.locked,reading=readable&&view(courseId).selected?.id===item.id;
      const open=readable?`<button type="button" class="rd-row-open" data-rd-action="material-read" data-resource="${E(item.id)}" data-course="${E(courseId)}" aria-label="Read ${E(entry.title)}" data-read-row="true"${reading?' aria-current="true"':''}${tip(entry)}>${E(entry.title)}</button>`:`<a class="rd-row-open" href="${E(safe(item.url))}" target="_blank" rel="noopener noreferrer"${tip(entry)}${pdfAttributes(item,courseId)}>${E(entry.title)}&nbsp;<span aria-hidden="true">↗</span></a>`;
      const actions=`<span class="rd-material-actions">${root.CanvasHarnessContext?.selectButton(item,courseId,isSelected)||''}${readable?`<a class="rd-text-button" href="${E(safe(item.url))}" target="_blank" rel="noopener noreferrer" aria-label="Open ${E(entry.title)} in Canvas">Canvas <span aria-hidden="true">↗</span></a>`:''}${!item.locked?button('capture','Plan',item.id,courseId,`aria-label="Plan work from ${E(entry.title)}"`):''}${button('pin',saved?'Bookmarked':'Bookmark',item.id,courseId,`aria-label="${saved?'Remove bookmark:':'Bookmark'} ${E(entry.title)}" aria-pressed="${saved}"`)}</span>`;
      // Where it lives rides in the kind's line (a recent shelf's rows come from every module); the day stands apart.
      const day=dayWord(item.updatedAt,Date.now(),zone()),
        after=where&&item.moduleName?`<span class="rd-row-where" title="${E(item.moduleName)}">${E(item.moduleName)}</span>`:'',
        meta=`<span class="rd-row-date">${day?`<time datetime="${E(item.updatedAt)}" title="${E(inZone(zone(),{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(item.updatedAt)))}">${E(day)}</time>`:''}</span>`;
      // The page open in the reader beside the list keeps its row on the tint.
      return teacherRow(entry,{
        open:head?head(open):open,
        actions,
        tag,
        rowClass:['rd-shelf-row',head?'rd-chapter-row':'',reading?'rd-teacher-row--open':''].filter(Boolean).join(' '),
        key:`material-row-${courseId}-${item.id}`,
        pdfAttrs:item=>pdfAttributes(item,courseId),
        lead:tagOf(entry),
        meta,
        after
      });
    }
    // What a shelf holds. Modules and Saved read as the chapters of a book: the course's modules in Canvas order
    // (numbered unless the teacher's names already are), then its loose pages and files. Recent, Files, Pages and
    // Links list newest first in groups by age (This week, This month, Earlier, No date). A search keeps the chapters
    // (or groups) of its matches; with no title match it falls back to the module names. Long blocks open on their
    // first few items.
    const LONG=8,PREVIEW=5;
    function listing(id){
      const {query,category}=view(id),kind=shelfOfView(id),entry=courses.get(id),saved=pins(id),items=entry?.items||[],q=String(query||'').trim().toLowerCase();
      const all=kind==='saved'?saved:items.filter(x=>x.kind!=='Assignment');
      const shelf=['files','pages','links'].includes(kind)?all.filter(x=>M.shelfOf(x)===kind):all;
      const pool=shelf.filter(x=>category==='all'||kind==='saved'||x.category===category);
      const matches=pool.filter(x=>M.searchText(x).toLowerCase().includes(q));
      const visible=!q?pool:matches.length?matches:pool.filter(x=>(x.moduleName||'').toLowerCase().includes(q));
      const book=kind==='modules'||kind==='saved',now=Date.now(),shown=visible.slice(0,400);
      const chapters=book?M.outline(all,shown,{numbers:kind!=='saved'}):[];
      const groups=book?[]:AGES.map(([key,name])=>{
        const list=M.byRecent(shown).filter(x=>M.ageGroup(x.updatedAt,now)===key);
        return {key:'age-'+key,name,items:list,rows:M.present(list)};
      }).filter(g=>g.items.length);
      return {q,visible,book,chapters,groups,blocks:book?chapters:groups};
    }
    // The shelves' counts never follow the search or the type filter, so the tabs hold still while the student types.
    function shelfCounts(id){
      const items=(courses.get(id)?.items||[]).filter(x=>x.kind!=='Assignment'),now=Date.now(),count=k=>items.filter(x=>M.shelfOf(x)===k).length;
      return {recent:items.filter(x=>M.ageGroup(x.updatedAt,now)==='week').length,modules:null,files:count('files'),pages:count('pages'),links:count('links'),saved:pins(id).length};
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
    // A group by age on a recent shelf: a quiet sans head with its count (like the work list's groups), then rows that
    // say which module each item lives in.
    function ageBlock(group,courseId,{collapse}){
      const id=`rd-chapter-${courseId}-${group.key}`,count=group.items.length,key=`shelf-${courseId}-${group.key}`;
      const folded=collapse&&group.rows.length>LONG,rows=folded?group.rows.slice(0,PREVIEW):group.rows;
      const more=collapse!==null&&group.rows.length>LONG?`<button type="button" class="rd-chapter-more" data-rd-action="material-more" data-resource="${E(group.key)}" data-course="${E(courseId)}" aria-expanded="${!folded}" aria-controls="${E(id)}-items">${folded?`Show all ${count}`:'Show fewer'}${root.ReserveIcon?.('chevron','rd-icon')||''}</button>`:'';
      return `<section class="rd-material-group rd-shelf-group" data-age="${E(group.key.slice(4))}" data-rd-key="${E(key)}" aria-labelledby="${E(id)}"><h3 class="rd-shelf-age" id="${E(id)}" tabindex="-1" data-chapter="${E(group.key)}" data-course="${E(courseId)}"><span class="rd-shelf-age-name">${E(group.name)}</span> <span class="rd-chapter-count">${count}</span></h3><ul class="rd-chapter-items rd-shelf-items" id="${E(id)}-items">${rows.map(row=>materialRow(row,courseId,{where:true})).join('')}</ul>${more}</section>`;
    }
    // "Saved just now", "Saved 5 min ago", then a date.
    function savedAt(value){
      const ms=Date.parse(value||'');
      if(!Number.isFinite(ms))return '';
      const diff=Math.max(0,Date.now()-ms);
      return diff<60000?'Saved just now':diff<3600000?`Saved ${Math.floor(diff/60000)} min ago`:`Saved ${inZone(zone(),{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(ms)}`;
    }
    // The empty shelf: the course's small drawing, one serif sentence, one plain one.
    function emptyShelf(course,{loading,query,kind}){
      if(loading)return '<div class="rd-ghost-rows" aria-hidden="true"><i></i><i></i><i></i></div>';
      const name={recent:'materials',modules:'materials',files:'files',pages:'pages',links:'links',saved:'saved materials'}[kind]||'materials';
      return `<div class="rd-empty rd-shelf-empty"><span class="rd-empty-art" aria-hidden="true">${root.ReserveCourseArt?.mini?.(course,{place:'empty'})||''}</span><div><h3>${query?`No ${E(name)} match “${E(query)}”`:kind==='saved'?'Nothing saved yet':`No ${E(name)} in this course`}</h3><p>${kind==='saved'?'Bookmark an item, or add your own link above.':'Assignments and external class schedules can hold more.'}</p></div></div>`;
    }
    function renderLibrary(course,{sharedHeading=false}={}){
      if(dead)return '';
      if(!course)return '<section class="rd-work"><div class="rd-empty"><h2>Choose a course</h2><p>Select a course to see its worksheets, pages and schedules.</p></div></section>';
      const id=String(course.id);
      activate(id);
      const {query,category,selected,message,custom,open}=view(id),kind=shelfOfView(id),entry=courses.get(id),items=entry?.items||[];
      const categories=[...new Set(items.map(x=>x.category).filter(Boolean))].sort();
      const {q,visible,book,chapters,blocks}=listing(id),numbered=chapters.some(ch=>ch.number),counts=shelfCounts(id);
      const rows=blocks.map(block=>
        book?chapterBlock(block,id,{collapse:q?null:!open.has(block.key)}):ageBlock(block,id,{collapse:q?null:!open.has(block.key)})).join('');
      // Under the shelves (Modules only), the chapters as kraft index tabs: each jumps to its chapter.
      const jump=book&&kind==='modules'&&chapters.length>2?`<nav class="rd-chapter-jump" aria-label="Chapters"><span class="rd-chapter-jump-label" aria-hidden="true">Chapters</span>${chapters.map(ch=>`<button type="button" class="rd-chapter-link" data-rd-action="material-jump" data-resource="${E(ch.key)}" data-course="${E(id)}">${ch.number?`<b aria-hidden="true">${ch.number}</b>`:''}${E(ch.name)}${ch.items.length>1?` <span class="rd-n">${ch.items.length}<span class="rd-sr-only"> items</span></span>`:''}</button>`).join('<span class="rd-chapter-dot" aria-hidden="true">·</span>')}</nav>`:'';
      const raw=entry?.raw,tone=/^#[0-9a-f]{6}$/i.test(course.color||'')?` style="--rd-course:${course.color};--rd-course-ink:${root.ReserveCore?.courseInk?.(course.color)||course.color}"`:'',ring='<span class="rd-sync-ring" aria-hidden="true"></span>';
      // The banner (a course page of its own): the course's wide scene and its name as artwork. On the dashboard the
      // course heading above already carries both, so the shelf's own head is its small drawing and "Materials".
      const named=sharedHeading||!enabled('course-art')?'':root.ReserveCourseArt?.titleFrame?.(course,{place:'banner'})||'';// the course name as artwork (course-art.js; refresh.css 9), last in the banner
      // The banner's own style carries the piece's width (the room's box starts where the piece ends), beside the course colour.
      const nameW=named?root.ReserveCourseArt.titleStyle?.(course)||'':'',look=!nameW?tone:tone?tone.replace(/"$/,`;${nameW}"`):` style="${nameW}"`;
      const all=items.filter(x=>x.kind!=='Assignment').length;
      const facts=[raw||all?`${all} ${all===1?'item':'items'}`:'',counts.recent?`${counts.recent} new this week`:'',raw?`<span title="${E(stamp(raw.fetchedAt))}">${E(savedAt(raw.fetchedAt)||'Saved '+stamp(raw.fetchedAt))}</span>`:''].filter(Boolean).join('<span aria-hidden="true"> · </span>');
      const detail=course.subject||course.teacher||course.sub?`<strong class="rd-course-detail">${E([course.subject,course.teacher,course.sub].filter(Boolean).join(' · '))}</strong>${facts?' · ':''}`:'';
      const shelves=`<div class="rd-filter-group rd-shelf-tabs" role="group" aria-label="Which materials">${SHELVES.map(([value,label])=>`<button type="button" class="rd-filter" data-rd-action="material-kind" data-value="${value}" data-course="${E(id)}" aria-pressed="${kind===value}">${label}${counts[value]!=null?` <span class="rd-n">${counts[value]}</span>`:''}</button>`).join('')}</div>`;
      return `<section class="rd-materials rd-shelf" aria-label="Course materials" data-shelf="${E(kind)}"${tone}><header class="rd-materials-header${sharedHeading?' rd-shelf-head':' rd-course-banner'}"${named?' data-titled="true"':''}${look}>${sharedHeading?`<span class="rd-shelf-art" aria-hidden="true">${root.ReserveCourseArt?.mini?.(course,{place:'shelf'})||''}</span>`:`<div class="rd-banner-art" aria-hidden="true">${enabled('course-art')&&root.ReserveCourseArt?.scene?.(course,{crop:'wide'})||''}</div>`}<div><h2 title="${E(course.originalName&&course.originalName!==course.name?`${course.name} · ${course.originalName}`:course.name)}">${sharedHeading?'Materials':E(course.shortName||course.name)}</h2><p class="rd-shelf-facts">${detail}${facts}</p></div><div class="rd-heading-actions"><a class="rd-button rd-button--outline" href="${globalThis.ReserveSite.origin()}/courses/${id}">Course home <span aria-hidden="true">↗</span></a><button type="button" class="rd-icon-button" data-rd-action="material-refresh" data-resource="" data-course="${E(id)}" aria-label="Refresh materials" title="Refresh materials" ${entry?.loading?'aria-disabled="true" aria-busy="true"':''}>${root.ReserveIcon?.('refresh','rd-icon')||''}${ring}</button></div>${named}</header><div class="rd-material-search"><div class="rd-composer-field"><label class="rd-search">${root.ReserveIcon?.('search','rd-icon')||''}<span class="rd-sr-only">Search course materials</span><input type="search" data-rd-field="material-query" placeholder="Find a worksheet, lesson or schedule" value="${E(query)}"></label><span class="rd-select-text"><select data-rd-field="material-category" aria-label="Material type"><option value="all">All materials</option>${categories.map(cat=>`<option ${category===cat?'selected':''}>${E(cat)}</option>`).join('')}</select></span></div><div class="rd-composer-tray">${shelves}<details class="rd-add-shortcut" data-rd-section="shortcut-${E(id)}" ${custom.title||custom.url?'open':''}><summary>${root.ReserveIcon?.('plus','rd-icon')||''}${
      custom.title||custom.url?'Finish your shortcut':'Add your own shortcut'}</summary><div><input data-rd-field="material-title" maxlength="300" aria-label="Shortcut name" placeholder="Name" value="${E(custom.title)}"><input data-rd-field="material-url" type="url" maxlength="2000" aria-label="Shortcut URL" placeholder="https://…" value="${E(custom.url)}">${button('add','Save shortcut','',id)}</div></details></div>${jump}</div>${message?`<p role="alert" class="rd-material-notice">${E(message)}</p>`:''}${entry?.loading?`<p class="rd-material-notice" role="status" data-loading="true">${ring}Loading course materials… You can keep using your saved links.</p>`:''}${entry?.error?`<p class="rd-material-notice" role="alert">${E(entry.error)} ${button('refresh','Try again','',id)}</p>`:''}${
      faults(raw).length?`<details class="rd-material-notice"><summary>Some sources could not load (${faults(raw).length})</summary>${faults(raw).map(e=>`<p>${E(e.source)}: ${E(e.message)}</p>`).join('')}</details>`:''}${!entry?button('refresh','Load course materials','',id):''}<div class="rd-material-columns${selected?.courseId===id?' rd-material-columns--reading':''}"><div class="rd-material-list rd-shelf-sheet${numbered?' rd-chapters--numbered':''}">${rows?`<div class="rd-chapter-flow">${rows}</div>`:entry?emptyShelf(course,{loading:entry.loading,query:q?query:'',kind}):''}${visible.length>400?'<p class="rd-material-notice">Showing the first 400 matches. Use search to narrow the list.</p>':''}</div>${pagePanel(id)}</div></section>`;
    }
    function renderRelated(item,directLinks=[]){
      if(dead)return '';
      const linkKey=value=>{try{const u=new URL(value);const file=u.pathname.match(/\/files\/(\d+)/);return file?u.origin+':file:'+file[1]:u.origin+u.pathname;}catch{return value;}};
      const attached=new Set(directLinks.map(x=>linkKey(x.url)));
      if(!item)return '';const id=String(item.courseId),saved=pins(id).filter(x=>!attached.has(linkKey(x.url))),entry=courses.get(id);
      const suggested=entry?M.suggestions(entry.items,item,{limit:4}).filter(x=>!saved.some(p=>p.id===x.id)&&!attached.has(linkKey(x.url))):[];
      return `<section class="rd-related"><div class="rd-section-heading"><h3>Course materials</h3><button type="button" class="rd-text-button" data-rd-action="open-materials" data-id="${E(id)}">Browse ${root.ReserveIcon?.('arrow','rd-icon')||'→'}</button></div>${faults(entry?.raw).length||entry?.error?'<p class="rd-material-notice" role="status">Some course materials could not load. Browse materials for details or to retry.</p>':''}${saved.length?`<div class="rd-saved-links">${links(saved.slice(0,8))}</div>`:''}${suggested.length?`<div class="rd-related-list">${suggested.map(x=>`<div><a href="${E(safe(x.url))}" target="_blank" rel="noopener noreferrer">${E(x.title)}</a><small>${E(x.reason)} · ${E(x.category)}</small>${button('pin','Save',x.id,id,`aria-label="Save ${E(x.title)}"`)}</div>`).join('')}</div>`:!saved.length?'<p class="rd-muted">Find worksheets, lesson pages and class schedules. Save the ones you use to keep them here.</p>':''}</section>`;
    }
    function handle(action,data){
      if(dead||action==='material-capture'&&!enabled('tools'))return;
      const id=data.resource,courseId=data.course,item=find(id,courseId);
      if(action==='material-refresh'){load(courseId,{force:true});return;}
      if(action==='material-capture'&&item&&!item.locked){
        onCapture({name:M.displayTitle(item.title),courseId:String(courseId),source:{kind:'material',title:item.title,url:pinURL(item)}});
        return;
      }
      // "Show all 45" / "Show fewer": opening moves focus to the first item it revealed; closing keeps it on the control.
      if(action==='material-more'&&/^\d+$/.test(courseId||'')){
        const current=view(courseId),key=String(id||''),course=String(courseId);
        if(current.open.has(key)){current.open.delete(key);focusRequest={type:'more',action,courseId:course,id:key};}
        else{
          current.open.add(key);
          const first=listing(course).blocks.find(ch=>ch.key===key)?.rows[PREVIEW]?.item.id;
          focusRequest=first?{type:'row',courseId:course,id:first}:null;
        }
        change();return;
      }
      // A shelf (Recent, Modules, Files, Pages, Links, Saved): the search, the type filter and the open page stay; its
      // long blocks start folded again.
      if(action==='material-kind'&&/^\d+$/.test(courseId||'')&&SHELVES.some(([value])=>value===data.value)){
        const current=view(courseId);
        if(shelfOfView(courseId)!==data.value)current.open.clear();
        current.kind=data.value;
        change();
        return;
      }
      // A chapter link moves focus to its chapter's head (dashboard.js scrolls it into view).
      if(action==='material-jump'&&/^\d+$/.test(courseId||'')){focusRequest={type:'chapter',courseId:String(courseId),id:String(id||'')};change();return;}
      if(action==='material-read'){openPage(item);return;}
      if(action==='material-close'){const current=view();focusRequest={type:'resource',...current.selected};current.selected=null;current.pageScroll=0;change();return;}
      if(action==='material-retry-page'){pages.delete(courseId+':'+id);openPage(item);return;}
      if(action==='material-pin'&&item){
        save(d=>{
          const list=d.resourcePins||(d.resourcePins=[]),index=list.findIndex(p=>p.courseId===String(courseId)&&p.id===id);
          if(index>=0)
            list.splice(index,1);
          else list.push({id:item.id,courseId:String(courseId),title:item.title,url:pinURL(item),category:item.category,moduleName:item.moduleName});
        },courseId);
        return;
      }
      if(action==='material-add'&&/^\d+$/.test(courseId||'')){
        const current=view(courseId),draft={...current.custom},url=safe(draft.url.trim()),title=draft.title.trim();if(!url||!title){current.message='Enter a name and a valid web link.';change();return;}
        save(d=>{
          const list=d.resourcePins||(d.resourcePins=[]);
          if(!list.some(p=>p.courseId===courseId&&p.url===url))list.push({id:'custom-'+(root.crypto?.randomUUID?.()||Date.now()),courseId,title,url,category:'My shortcut',moduleName:''});
        },courseId).then(ok=>{
          if(ok&&views.get(String(courseId))===current&&current.custom.title===draft.title&&current.custom.url===draft.url){current.custom={title:'',url:''};change();}
        });
      }
    }
    return {load,renderLibrary,renderRelated,handle,getCourse:id=>courses.get(String(id)),takeFocusRequest(){
      const value=focusRequest;
      focusRequest=null;
      return value;
    },input(field,value){
      if(dead)return;
      const current=view();
      if(field==='material-query')current.query=String(value).slice(0,200);
      if(field==='material-category'){if(value==='saved'){current.kind='saved';current.category='all';}else current.category=value;}
      if(field==='material-title'){current.custom.title=String(value).slice(0,300);return;}
      if(field==='material-url'){current.custom.url=String(value).slice(0,2000);return;}
      change();
    },activate,rememberPageScroll(courseId,id,top){
      const current=view(courseId);
      if(current.selected?.id===id)current.pageScroll=Number.isFinite(top)?Math.max(0,Math.min(1000000,top)):0;
    },pageScroll(courseId,id){
      const current=view(courseId);
      return current.selected?.id===id?current.pageScroll:0;
    },reset(){
      const current=view();
      current.query='';
      current.category='all';
      current.kind='';
      current.selected=null;
      current.pageScroll=0;
      focusRequest=null;
    },destroy(){dead=true;controller.abort();courses.clear();pages.clear();clearViews();},getItems:id=>courses.get(String(id))?.items||[]};
  }
  root.ReserveMaterialsUI={create,row:teacherRow,tip};if(typeof module!=='undefined'&&module.exports)module.exports=root.ReserveMaterialsUI;
})(globalThis);
