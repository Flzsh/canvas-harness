/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function(root){
 'use strict';
 const C=root.ReserveCore,V=root.ReserveViews,U=root.ReserveUI;
 const COLORS=['#3c7a68','#796394','#3f7e9b','#ba7751','#657e45','#aa687f','#527ea4','#8c794e'];
 const newId=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
 function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 function mount(target,{snapshot,store,refresh,demo=false,onExit=()=>{},onAuthError=()=>{},stale=false,embedded=false,hideGrades=false,initialPage='home',initialId=null}={}){
  const container=document.createElement('div');target.append(container);
  let data=store.get(),currentSnapshot=snapshot,destroyed=false,refreshing=false,loading='',error='',isStale=stale,toastTimer,noteTimer,lastChord=0,context,saving=0,undoAction=null,pendingImport=null;
  if(embedded)container.dataset.reserveEmbedded='true';
  const state={page:['home','assignments','week','grades','settings'].includes(initialPage)?initialPage:'week',query:'',courseId:'all',filter:'open',sort:'due',weekOffset:0,selected:initialId,modal:null,customCourse:null,command:false,commandQuery:'',commandIndex:0,chooseFocus:false};
  function date(value,options={month:'short',day:'numeric'}){if(value===null||value===undefined||value==='')return 'No date';const d=new Date(value);if(!Number.isFinite(d.getTime()))return 'No date';return new Intl.DateTimeFormat('en-US',{timeZone:data.settings.timeZone,...options}).format(d);}
  function buildContext(){
   data=store.get();const settings=hideGrades?{...data.settings,showGrades:false}:data.settings,now=Date.now(),order=settings.courseOrder;
   const normalized=currentSnapshot.courses.map((raw,index)=>({...C.normalizeCourse(raw),originalIndex:index}));
   const allCourses=normalized.sort((a,b)=>{const ai=order.indexOf(a.id),bi=order.indexOf(b.id);return (ai<0?order.length+a.originalIndex:ai)-(bi<0?order.length+b.originalIndex:bi);});
   // As on the dashboard: a student's own name is final, with the Canvas teacher beside it unless the name already says it.
   const courseMap=new Map(allCourses.map((course,index)=>{const pref=settings.coursePrefs[course.id]||{},custom=String(pref.name||''),label=C.courseLabel?.(course.name)||{},extra=v=>v&&!(custom&&custom.toLowerCase().includes(String(v).toLowerCase()))?v:'';return [course.id,{...course,name:custom||course.name,originalName:course.name,shortName:custom||label.title||course.name,courseDetail:[extra(label.subject),extra(label.teacher),extra(label.sub)].filter(Boolean).join(' · '),color:U.color(pref.color,COLORS[index%COLORS.length])}];}));
   const course=id=>courseMap.get(String(id))||{id:'personal',name:'Personal',code:'ME',color:'#7c718d',score:null,grade:null};
   // Hidden by hand, or not a class (NameCoach, College Counseling) and never shown by hand: the dashboard's rule.
   const hiddenIds=C.hiddenCourseIds(allCourses,settings);
   const courses=allCourses.filter(x=>!hiddenIds.has(x.id)).map(x=>course(x.id));
   const items=currentSnapshot.assignments.filter(raw=>!hiddenIds.has(String(raw.course_id))).map(raw=>C.normalizeAssignment(raw,course(raw.course_id)));
   items.push(...root.ReservePersonalWork.normalize(data,courses));
   const today=C.dayKey(now,settings.timeZone);
   const c={settings,local:data.tasks,data,now,date,course,allCourses,courses,hiddenIds,items,today,state,demo,snapshot:currentSnapshot,loading,error,stale:isStale,effectiveTheme:settings.theme==='dark'?'dark':'light',complete:C.isComplete,score:n=>`${new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n)}%`,timerText, timerProgress,commands};
   c.weekDays=offset=>{const start=new Date(today+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7)+offset*7);return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setUTCDate(d.getUTCDate()+i);return {key:d.toISOString().slice(0,10),number:d.getUTCDate(),short:new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone:'UTC'}).format(d),label:new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',timeZone:'UTC'}).format(d),range:new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(d)};});};
   context=c;return c;
  }
  function render({focus=false}={}){
   if(destroyed)return;
   const active=target.activeElement||target.getRootNode()?.activeElement||document.activeElement,field=active?.dataset?.field,selection=typeof active?.selectionStart==='number'?[active.selectionStart,active.selectionEnd]:null;
   const scroll=container.querySelector('.content')?.scrollTop||0,drawerScroll=container.querySelector('.drawer-content')?.scrollTop||0;
   const c=buildContext();c.overlay=state.command?V.palette(c):state.modal?V.modal(c):state.selected?V.drawer(c,c.items.find(x=>x.id===state.selected)||{id:state.selected,name:'Assignment unavailable',courseId:'personal',state:'unknown',points:null,rubric:[],submissionTypes:[]}):'';
   container.innerHTML=V.shell(c,V[state.page](c));
   // Canvas navigation has its own stacking contexts. A modal dialog places
   // optional planning controls above them and makes the background inert.
   const shade=container.querySelector('.overlay-shade');
   if(embedded&&shade){
    const panel=container.querySelector('.detail-drawer,.modal,.command-palette');
    const layer=document.createElement('dialog');layer.className='reserve-overlay-layer';
    layer.setAttribute('aria-label',state.selected?'Assignment plan':state.command?'Search Canvas Harness':'Canvas Harness settings');
    panel.removeAttribute('aria-modal');panel.setAttribute('role','document');
    container.querySelector('.reserve-shell').append(layer);layer.append(shade,panel);
    layer.addEventListener('cancel',event=>{event.preventDefault();closeOverlay();});layer.showModal();
   }
   const content=container.querySelector('.content');if(content)content.scrollTop=scroll;
   const drawer=container.querySelector('.drawer-content');if(drawer)drawer.scrollTop=drawerScroll;
   if(field&&!focus){const replacement=container.querySelector(`[data-field="${CSS.escape(field)}"]`);if(replacement){replacement.focus({preventScroll:true});if(selection&&replacement.setSelectionRange&&['text','search','textarea'].includes(replacement.type))replacement.setSelectionRange(...selection);}}
   if(focus)requestAnimationFrame(()=>{const el=container.querySelector('.command-input input, .modal input:not([type=file]), .detail-drawer, .modal button');el?.focus({preventScroll:true});});
  }
  async function save(mutator,{redraw=true,message}={}){saving++;try{await store.update(mutator);data=store.get();if(redraw)render();if(message)toast(message);return true;}catch(e){toast(`Could not save: ${e.message}`,true);return false;}finally{saving--;}}
  function taskState(s,id){return s.tasks[id]||(s.tasks[id]={pinned:false,progress:'not-started',notes:'',estimate:0,plannedDate:'',checklist:[]});}
  function toast(text,failed=false){const area=container.querySelector('.toast-area');if(!area)return;clearTimeout(toastTimer);area.innerHTML=`<div class="toast ${failed?'error':''}">${root.ReserveIcon(failed?'warning':'check')}<span>${U.escapeHTML(text)}</span></div>`;toastTimer=setTimeout(()=>{if(area.isConnected)area.innerHTML='';},failed?7000:3500);}
  function undoToast(text,undo){undoAction=undo;toast(text);const area=container.querySelector('.toast');if(area){const b=document.createElement('button');b.className='text-button';b.dataset.action='undo';b.textContent='Undo';area.append(b);clearTimeout(toastTimer);toastTimer=setTimeout(()=>area.remove(),15000);}}
  function closeOverlay(){flushNotes();if(embedded&&initialId&&state.selected===initialId&&!state.modal&&!state.command){onExit();return;}state.selected=null;state.modal=null;state.command=false;state.chooseFocus=false;render();container.querySelector('.command-trigger')?.focus({preventScroll:true});}
  function navigate(page){flushNotes();state.page=page;state.selected=null;state.modal=null;state.command=false;render();const main=container.querySelector('.content');if(main)main.scrollTop=0;}
  function openDetail(id){flushNotes();state.selected=id;state.command=false;state.modal=null;render({focus:true});}
  function openModal(modal){flushNotes();state.modal=modal;state.selected=null;state.command=false;render({focus:true});}
  function timerRemaining(){const f=store.get().focus;return f.endsAt?Math.max(0,Math.ceil((f.endsAt-Date.now())/1000)):f.remaining;}
  function timerText(){const seconds=timerRemaining();return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
  function timerProgress(){const f=store.get().focus;return Math.max(0,Math.min(100,100*(1-timerRemaining()/(f.minutes*60))));}
  // Sessions settle through ReserveCore.settleFocus, shared with the dashboard; one that ended long ago is recorded quietly.
  async function tick(){if(destroyed)return;const f=store.get().focus;if(f.endsAt&&Date.now()>=f.endsAt){let settled=false;const ended=f.endsAt;if(await save(s=>{settled=C.settleFocus(s);})&&settled&&Date.now()-ended<60000)toast('Focus session complete. Take a moment to breathe.');}for(const el of container.querySelectorAll('[data-timer]'))el.textContent=timerText();for(const el of container.querySelectorAll('[data-timer-progress]'))el.style.width=timerProgress()+'%';}
  async function focusTask(id){const item=context.items.find(x=>x.id===id);if(!item||C.isWorkComplete(item,store.get().tasks[id]))return;state.selected=null;state.command=false;state.chooseFocus=false;state.page='home';await save(s=>{s.focus.itemId=id;taskState(s,id).progress='in-progress';},{message:'Task selected. Start your focus session when you’re ready.'});container.querySelector('.focus-card')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});}
  function commands(){const c=context||buildContext(),q=state.commandQuery.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const cmds=[];if(!state.chooseFocus){for(const [page,title,icon]of [['home','Home','home'],['assignments','Assignments','list'],['week','Your week','calendar'],['grades','Grades','grades'],['settings','Appearance & settings','settings']])cmds.push({title,subtitle:'Go to workspace',icon,run:()=>navigate(page)});cmds.push({title:'Add a personal task',subtitle:'Capture a next step',icon:'plus',run:()=>openModal('new-task')},{title:'Toggle light / dark',subtitle:'Appearance',icon:'moon',run:()=>action('toggle-theme')},{title:'Export upcoming deadlines',subtitle:'Download a calendar file',icon:'download',run:()=>action('export-calendar')});for(const course of c.courses)cmds.push({title:course.shortName||course.name,subtitle:'Open course assignments',search:course.originalName,icon:'book',run:()=>{state.courseId=course.id;state.filter='open';state.query='';navigate('assignments');}});}
   for(const item of c.items.filter(x=>!state.chooseFocus||!C.isWorkComplete(x,c.local[x.id])))cmds.push({title:item.name,subtitle:c.course(item.courseId).shortName||c.course(item.courseId).name,search:c.course(item.courseId).originalName,icon:'list',run:()=>state.chooseFocus?focusTask(item.id):openDetail(item.id)});
   return cmds.filter(cmd=>!q||(cmd.title+' '+cmd.subtitle+' '+(cmd.search||'')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q)).slice(0,14);
  }
  async function doRefresh(){if(refreshing)return;flushNotes();refreshing=true;loading='Refreshing your Canvas courses…';error='';render();try{const updated=await refresh(progress=>{loading=`Refreshing ${progress.completed} of ${progress.total} courses…`;const label=container.querySelector('.sync-line span:nth-child(2)');if(label)label.textContent=loading;});if(updated){if(String(updated.user.id)!==String(currentSnapshot.user.id)){onAuthError('Your Canvas account changed. Reload Canvas Harness to open that account’s workspace.');return;}currentSnapshot=updated;isStale=false;try{await store.writeCache(updated);}catch{toast('Canvas refreshed, but the offline cache could not be saved.',true);}}}catch(e){if(e.code==='auth'){onAuthError(e.message);return;}error=e.message;}finally{loading='';refreshing=false;render();}}
  async function action(name,el){const id=el?.dataset.id,value=el?.dataset.value;switch(name){
   case 'navigate':navigate(el.dataset.page);break;
   case 'exit':flushNotes();onExit();break;
   case 'detail':openDetail(id);break;
   case 'close-overlay':closeOverlay();break;
   case 'new-task':openModal('new-task');break;
   case 'customize':state.customCourse=id;openModal('customize');break;
   case 'shortcuts':openModal('shortcuts');break;
   case 'command':flushNotes();state.command=true;state.modal=null;state.selected=null;state.commandQuery='';state.commandIndex=0;state.chooseFocus=false;render({focus:true});break;
   case 'choose-focus':state.command=true;state.commandQuery='';state.commandIndex=0;state.chooseFocus=true;render({focus:true});break;
   case 'run-command':{const command=commands()[Number(el.dataset.index)];if(command){state.command=false;command.run();}break;}
   case 'check-off':{const item=context.items.find(x=>x.id===id);if(item&&!item.id.startsWith('local-')&&!C.isComplete(item)){const saved=await save(s=>{taskState(s,id).checkedOff=value==='true';},{message:value==='true'?'Marked done in Canvas Harness.':'Returned to your unfinished work.'});if(saved&&state.selected===id)container.querySelector('[data-action="check-off"]')?.focus({preventScroll:true});}break;}
   case 'pin':await save(s=>{const t=taskState(s,id);t.pinned=!t.pinned;});break;
   case 'filter':state.filter=el.dataset.view;render();break;
   case 'filter-nav':state.filter=el.dataset.view;state.courseId='all';state.query='';navigate('assignments');break;
   case 'clear-filters':state.query='';state.courseId='all';state.filter='open';render();break;
   case 'course-filter':state.courseId=id;state.query='';state.filter='open';navigate('assignments');break;
   case 'day':{const key=el.dataset.day;const today=C.dayKey(Date.now(),data.settings.timeZone);const day=new Date(key+'T12:00:00Z');const monday=new Date(today+'T12:00:00Z');monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7));state.weekOffset=Math.floor((day-monday)/604800000);navigate('week');break;}
   case 'week-prev':state.weekOffset--;render();break;
   case 'week-next':state.weekOffset++;render();break;
   case 'week-today':state.weekOffset=0;render();break;
   case 'theme':await save(s=>{s.settings.theme=value;});break;
   case 'accent':await save(s=>{s.settings.accent=value;});break;
   case 'toggle-theme':state.command=false;await save(s=>{s.settings.theme=context.effectiveTheme==='dark'?'light':'dark';});break;
   case 'duration':await save(s=>{const minutes=Number(el.dataset.minutes);s.focus.minutes=minutes;s.focus.remaining=minutes*60;s.focus.endsAt=null;});break;
   case 'timer-toggle':await save(s=>{if(s.focus.endsAt){s.focus.remaining=Math.max(0,Math.ceil((s.focus.endsAt-Date.now())/1000));s.focus.endsAt=null;}else{if(s.focus.remaining<=0)s.focus.remaining=s.focus.minutes*60;s.focus.endsAt=Date.now()+s.focus.remaining*1000;}});break;
   case 'timer-reset':await save(s=>{s.focus.remaining=s.focus.minutes*60;s.focus.endsAt=null;});break;
   case 'focus':await focusTask(id);break;
   case 'refresh':await doRefresh();break;
   case 'copy-link':{const item=context.items.find(x=>x.id===id);try{await navigator.clipboard.writeText(item.id.startsWith('local-')?item.name:U.safeURL(item.url));toast(item.id.startsWith('local-')?'Task title copied':'Assignment link copied');}catch{toast('Clipboard access was unavailable. Open Canvas to copy the link.',true);}break;}
   case 'remove-step':await save(s=>{const t=taskState(s,id);t.checklist=(t.checklist||[]).filter(x=>x.id!==el.dataset.step);});break;
   case 'delete-task':{const old=store.get(),task=old.customTasks.find(x=>x.id===id);const ok=await save(s=>{s.customTasks=s.customTasks.filter(x=>x.id!==id);delete s.tasks[id];if(s.focus.itemId===id)s.focus.itemId=null;},{redraw:false});if(ok){state.selected=null;render();undoToast('Personal task removed.',()=>save(s=>{if(task&&!s.customTasks.some(x=>x.id===id))s.customTasks.push(task);if(old.tasks[id])s.tasks[id]=old.tasks[id];},{message:'Task restored.'}));}break;}
   case 'export-calendar':{const items=context.items.filter(x=>!C.isWorkComplete(x,context.local[x.id])&&x.dueAt&&Date.parse(x.dueAt)>=Date.now());if(!items.length){toast('There are no upcoming deadlines to export.');break;}const calendarItems=items.map(item=>({...item,description:(()=>{const t=document.createElement('template');t.innerHTML=item.description;return t.content.textContent||'';})(),url:item.personal?(root.ReservePersonalWork.safeSource(item.source)?.url||(globalThis.ReserveSite.origin()+"/")):item.url}));download('Canvas Harness-deadlines.ics',C.exportICS(calendarItems),'text/calendar;charset=utf-8');state.command=false;render();toast(`Prepared ${items.length} upcoming deadlines. Import the file into your calendar.`);break;}
   // Text from the retired Writing desk stays readable here until the student clears it.
   case 'copy-scratchpad':try{await navigator.clipboard.writeText(store.get().toolbox.scratchpad);toast('Scratchpad text copied.');}catch{toast('Clipboard access was unavailable. Select the text and copy it manually.',true);}break;
   case 'clear-scratchpad':{const text=store.get().toolbox.scratchpad;if(text&&await save(s=>{s.toolbox.scratchpad='';}))undoToast('Scratchpad cleared.',()=>save(s=>{if(!s.toolbox.scratchpad)s.toolbox.scratchpad=text;},{message:'Scratchpad restored.'}));break;}
   case 'export-backup':flushNotes();await store.update(()=>{});download('Canvas Harness-backup-'+C.dayKey(Date.now(),data.settings.timeZone)+'.json',JSON.stringify(store.exportBackup()),'application/json');toast('Personal workspace exported.');break;
   case 'import-backup':openModal('import');break;
   case 'confirm-import':if(pendingImport){await store.saveRecovery();await store.replace(pendingImport);pendingImport=null;state.modal=null;render();toast('Workspace restored. Undo last restore is available in Settings.');}break;
   case 'recover-backup':{const previous=await store.readRecovery();if(!previous){toast('There is no previous restore to undo.');break;}pendingImport=previous;state.importSummary={tasks:previous.customTasks.length,notes:Object.keys(previous.tasks).length};state.modal='confirm-import';render({focus:true});break;}
   case 'undo':if(undoAction){const undo=undoAction;undoAction=null;await undo();}break;
   case 'reset-appearance':await save(s=>{s.settings.theme='light';s.settings.accent='clay';s.settings.density='comfortable';s.settings.font='system';},{message:'Appearance reset. Your notes and course settings are saved.'});break;
   case 'course-up':case 'course-down':{const order=context.allCourses.map(x=>x.id),index=order.indexOf(id),dest=index+(name==='course-up'?-1:1);if(dest>=0&&dest<order.length){[order[index],order[dest]]=[order[dest],order[index]];await save(s=>{s.settings.courseOrder=order;});}break;}
  }}
  let pendingNote=null;
  function flushNotes(){clearTimeout(noteTimer);if(!pendingNote)return;const {id,value}=pendingNote;pendingNote=null;save(s=>{taskState(s,id).notes=value;},{redraw:false}).then(ok=>{const label=container.querySelector('[data-note-save]');if(label)label.textContent=ok?'Saved':'Not saved';});}
  function onInput(event){const el=event.target,field=el.dataset.field;if(field==='search'){state.query=el.value;render();}if(field==='command'){state.commandQuery=el.value;state.commandIndex=0;render();}if(field==='notes'){pendingNote={id:el.dataset.id,value:el.value.slice(0,20000)};clearTimeout(noteTimer);noteTimer=setTimeout(flushNotes,450);const label=container.querySelector('[data-note-save]');if(label)label.textContent='Saving…';}}
  async function onChange(event){const el=event.target,field=el.dataset.field,id=el.dataset.id;if(field==='course'){state.courseId=el.value;render();}else if(field==='sort'){state.sort=el.value;render();}else if(['density','font','readingFont','timezone'].includes(field)){await save(s=>{s.settings[field==='timezone'?'timeZone':field]=el.value;});}else if(field==='progress'){await save(s=>{const t=taskState(s,id);t.progress=el.value;if(el.value!=='done')t.checkedOff=false;});}else if(field==='planned-date'){await save(s=>{taskState(s,id).plannedDate=el.value;},{message:el.value?'Work day saved to your plan.':'Work day cleared.'});}else if(field==='estimate'){await save(s=>{taskState(s,id).estimate=Math.max(0,Math.min(1440,Number(el.value)||0));},{redraw:false});}else if(field==='check-step'){await save(s=>{const t=taskState(s,id);const step=t.checklist?.find(x=>x.id===el.dataset.step);if(step)step.done=el.checked;});}else if(field==='course-visible'){await save(s=>{C.setCourseVisible(s.settings,id,el.checked);});}else if(field==='notes')flushNotes();}
  async function resizeImage(file){if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPG, or WebP image.');if(file.size>12000000)throw Error('Choose an image smaller than 12 MB.');const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas');const ratio=Math.min(1,900/bitmap.width,600/bitmap.height);canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();let encoded=canvas.toDataURL('image/jpeg',0.82);if(encoded.length>=400000)encoded=canvas.toDataURL('image/jpeg',0.55);if(encoded.length>=400000)throw Error('This image is too detailed. Choose a smaller image.');return encoded;}
  async function onSubmit(event){const form=event.target;if(!form.dataset.form)return;event.preventDefault();const fd=new FormData(form),kind=form.dataset.form;try{
   if(kind==='step'){const text=String(fd.get('step')||'').trim();if(text){await save(s=>{const t=taskState(s,form.dataset.id);if(!t.checklist)t.checklist=[];if(t.checklist.length>=100)throw Error('This task already has 100 checklist steps.');t.checklist.push({id:newId(),text:text.slice(0,300),done:false});});container.querySelector('.add-step input')?.focus();}}
   if(kind==='new-task'){const name=String(fd.get('title')||'').trim();if(!name)return;const due=String(fd.get('due')||'');const item={id:'local-'+newId(),name:name.slice(0,200),courseId:String(fd.get('course')||'personal'),dueAt:due?U.wallTimeToISO(due,data.settings.timeZone):null,createdAt:new Date().toISOString()};const ok=await save(s=>{if(s.customTasks.length>=1000)throw Error('Your workspace already contains 1,000 personal tasks.');s.customTasks.push(item);},{redraw:false});if(ok){state.modal=null;openDetail(item.id);toast('Personal task added.');}}
   if(kind==='customize'){const id=form.dataset.id,file=fd.get('image');let image=data.settings.coursePrefs[id]?.image||'';if(fd.get('removeImage'))image='';if(file?.size)image=await resizeImage(file);const ok=await save(s=>{s.settings.coursePrefs[id]={name:String(fd.get('name')||'').trim().slice(0,100),color:U.color(String(fd.get('color'))),image};},{redraw:false});if(ok){state.modal=null;render();toast('Course updated.');}}
   if(kind==='import'){const file=fd.get('backup');if(!file?.size)throw Error('Choose a Canvas Harness backup file.');if(file.size>6500000)throw Error('Backup is too large.');const clean=root.ReserveStorage.validateBackup(await file.text(),store.owner);pendingImport=clean;state.importSummary={tasks:clean.customTasks.length,notes:Object.keys(clean.tasks).length};state.modal='confirm-import';render({focus:true});}
  }catch(error){toast(error.message,true);}}
  function keydown(event){const key=event.key.toLowerCase(),origin=event.composedPath()[0],typing=origin?.matches?.('input,textarea,select,[contenteditable=true]');
   if((event.ctrlKey||event.metaKey)&&key==='k'){event.preventDefault();action('command');return;}
   if(key==='escape'&&(state.command||state.modal||state.selected)){event.preventDefault();closeOverlay();return;}
   if(state.command){if(['arrowdown','arrowup'].includes(key)){event.preventDefault();const count=commands().length;state.commandIndex=count?(state.commandIndex+(key==='arrowdown'?1:-1)+count)%count:0;render();container.querySelector('.command-result.selected')?.scrollIntoView({block:'nearest'});}if(key==='enter'){event.preventDefault();commands()[state.commandIndex]?.run();} }
   if(key==='tab'&&(state.command||state.modal||state.selected)){const dialog=container.querySelector('[role=dialog]');const nodes=[...dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex="0"]')].filter(el=>el.getClientRects().length);const first=nodes[0],last=nodes.at(-1);const active=target.activeElement||target.getRootNode()?.activeElement||document.activeElement;if(event.shiftKey&&(active===first||active===dialog)){event.preventDefault();last?.focus();}else if(!event.shiftKey&&active===last){event.preventDefault();first?.focus();}return;}
   if(typing||state.command||state.modal||state.selected||event.ctrlKey||event.metaKey||event.altKey)return;
   if(Date.now()-lastChord<900){const page={h:'home',a:'assignments',w:'week',g:'grades',s:'settings'}[key];lastChord=0;if(page){event.preventDefault();navigate(page);return;}}
   if(key==='g'){lastChord=Date.now();return;}if(key==='/'){event.preventDefault();navigate('assignments');container.querySelector('[data-field=search]')?.focus();}if(key==='n'){event.preventDefault();openModal('new-task');}if(key==='?'){event.preventDefault();openModal('shortcuts');}
  }
  async function clicked(event){const button=event.target.closest('[data-action]');if(!button||button.disabled)return;if(button.dataset.action){event.preventDefault();try{await action(button.dataset.action,button);}catch(e){toast(e.message,true);}}}
  function dragStart(event){const card=event.target.closest('[data-drag-id]');if(card){event.dataTransfer.setData('text/plain',card.dataset.dragId);event.dataTransfer.effectAllowed='move';}}
  function dragOver(event){const day=event.target.closest('[data-drop-day]');if(day){event.preventDefault();event.dataTransfer.dropEffect='move';day.classList.add('drag-over');}}
  function dragLeave(event){event.target.closest('[data-drop-day]')?.classList.remove('drag-over');}
  async function dropped(event){const day=event.target.closest('[data-drop-day]');if(!day)return;event.preventDefault();const id=event.dataTransfer.getData('text/plain');if(!context.items.some(x=>x.id===id))return;await save(s=>{taskState(s,id).plannedDate=day.dataset.dropDay;},{message:'Work day added to your personal plan.'});}
  container.addEventListener('click',clicked);container.addEventListener('input',onInput);container.addEventListener('change',onChange);container.addEventListener('submit',onSubmit);container.addEventListener('dragstart',dragStart);container.addEventListener('dragover',dragOver);container.addEventListener('dragleave',dragLeave);container.addEventListener('drop',dropped);document.addEventListener('keydown',keydown);
  const unsubscribe=store.subscribe(()=>{if(!saving&&!pendingNote&&!state.modal)render();});
  const timer=setInterval(tick,1000);render({focus:!!initialId});
  return {destroy(){flushNotes();destroyed=true;unsubscribe();clearInterval(timer);clearTimeout(toastTimer);clearTimeout(noteTimer);document.removeEventListener('keydown',keydown);container.remove();},updateSnapshot(next){if(next)currentSnapshot=next;render();},getState:()=>({...state})};
 }
 root.ReserveApp={mount};
})(globalThis);
