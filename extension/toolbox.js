/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
(function(root){
 'use strict';
 const captureDrafts=new Map();
 // A failed reminder draft remains protected even after its tool window is closed.
 root.addEventListener?.('beforeunload',event=>{if(captureDrafts.size){event.preventDefault();event.returnValue='';}});
 const sections=[['quick','Quick open','search'],['plan','Plan','calendar'],['calculator','Calculator','calculator']];
 const E=value=>root.ReserveUI.escapeHTML(value),I=name=>root.ReserveIcon(name,'rd-icon');
 const mod=/Mac|iP(hone|ad|od)/.test(root.navigator?.platform||'')?'⌘':'Ctrl';
 function create({container,store,getContext,onNavigate,onPreview,onPlanner,materials,onDockChange=()=>{}}){
  let toolMotion,dockResize,captureDraft=null,capturing=false,captureUndo=null;
  let dialog,tool='quick',trigger,dead=false,collapsed=false,calculatorMode='graphing',query='',index=0,results=[],cacheLoading=false,cacheMessage='',status='';
  let personal=store.get();
  const draftKey=store.owner?.origin+':'+store.owner?.accountId;
  captureDraft=captureDrafts.get(draftKey)||null;
  const catalogs=new Map(),panels=new Map();let poolCache=null;
  // Panels stay attached: moving even the same iframe node reloads its document.
  const body=()=>panels.get(tool);
  const allItems=(ctx=getContext())=>[...new Map([...ctx.items,...root.ReservePersonalWork.normalize(personal,ctx.courses)].map(x=>[x.id,x])).values()];
  const button=(action,label,extra='',cls='rd-button')=>`<button type="button" class="${cls}" data-ui-action="${action}" ${extra}>${label}</button>`;
  const field=(label,content)=>`<label class="rd-field"><span>${label}</span>${content}</label>`;
  // Course labels match the page (short name, then teacher or section); the Canvas name stays in search.
  const courseNames=course=>root.ReserveQuickOpen.courseNames(course);
  async function save(change){try{await store.update(change);status='';return true;}catch(error){status=error.message||'The change could not be saved.';showStatus(status,true);return false;}}
  function showStatus(text,error=false){const node=dialog?.querySelector('[data-ui-status]');if(node){node.textContent=text;node.setAttribute('role',error?'alert':'status');}}
  function notifyDock(){onDockChange({open:!dead&&!!dialog?.open,collapsed:!dead&&!!dialog?.open&&collapsed,...dockResize?.getSize()});}
  function syncTabs(animate){toolMotion?.syncTabs(animate&&container.dataset.input!=='keyboard');}
  function syncCollapsed(value){
   collapsed=value;dialog.dataset.collapsed=String(value);
   for(const selector of ['.rd-utility-nav','.rd-utility-body','.rd-utility-foot'])dialog.querySelector(selector).hidden=value;
   dialog.querySelector('[data-ui-action="collapse"]').hidden=value;
   const expand=dialog.querySelector('[data-ui-action="expand"]');expand.hidden=!value;expand.setAttribute('aria-expanded',String(!value));
  }
  function collapse(){if(dead||!dialog?.open||collapsed)return;rememberCapture();syncCollapsed(true);dockResize?.refresh();notifyDock();dialog.querySelector('[data-ui-action="expand"]').focus({preventScroll:true});}
  function expand(){if(dead||!dialog?.open||!collapsed)return;syncCollapsed(false);dockResize?.refresh();notifyDock();toolMotion?.syncTabs(false,true);focusFirst();}
  // A pointer close lets the sheet leave (4px down to .99 over 140ms, refresh.css) before the
  // dialog closes; keyboard, Still-less devices that ask for reduced motion and Off close at once.
  let leaving=0;
  const calm=()=>container.dataset.input!=='pointer'||container.dataset.motionStyle==='off'||!!root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  function close({restoreFocus=false}={}){
   if(dead||!dialog?.open)return;rememberCapture();
   const finish=()=>{leaving=0;delete dialog.dataset.leaving;if(!dialog.open)return;dialog.close();syncCollapsed(false);notifyDock();};
   if(leaving){root.clearTimeout(leaving);finish();}
   else if(calm()||typeof dialog.animate!=='function')finish();
   else{dialog.dataset.leaving='true';leaving=root.setTimeout(finish,140);}
   if(restoreFocus&&trigger?.isConnected)trigger.focus({preventScroll:true});
  }
  function init(){
   if(dialog)return;dialog=document.createElement('dialog');dialog.className='rd-utility-dialog';dialog.dataset.docked='true';dialog.dataset.collapsed='false';dialog.setAttribute('aria-labelledby','rd-utility-title');
   // The segmented control is the header (its pill glides like the workspace tabs, ReserveMotion.syncTabs);
   // the "Tools" title stays for assistive technology and shows only while the dock is collapsed.
   dialog.innerHTML=`<div class="rd-utility-shell"><header class="rd-utility-heading"><h2 id="rd-utility-title" class="rd-utility-title">Tools<span class="rd-utility-current" data-ui-current></span></h2><div class="rd-utility-nav t-tabs" role="tablist" aria-label="Tools"><span class="t-tabs-pill" aria-hidden="true"></span>${sections.map(([id,label,icon])=>button('tool',I(icon)+`<span>${label}</span>`,`role="tab" id="rd-tool-tab-${id}" data-tool="${id}" data-tab="${id}" aria-selected="false" tabindex="-1"`,'t-tab rd-dock-tab')).join('')}</div><div class="rd-utility-heading-actions">${button('expand','Open','hidden aria-label="Reopen tools" aria-expanded="true" aria-controls="rd-utility-body"','rd-button rd-utility-expand')}${button('collapse','<span class="rd-collapse-glyph" aria-hidden="true"></span>','aria-label="Collapse tools" title="Collapse" aria-controls="rd-utility-body"','rd-icon-button')}${button('close',I('close'),'aria-label="Close tools" title="Close · Esc"','rd-icon-button')}</div></header><div id="rd-utility-body" class="rd-utility-body"></div><footer class="rd-utility-foot"><span data-ui-status role="status"></span></footer></div>`;
   container.append(dialog);dockResize=root.ReserveToolboxResize?.create({dialog,container,store,onSize:()=>notifyDock()});toolMotion=root.ReserveMotion?.create(dialog);
   dialog.addEventListener('cancel',event=>{event.preventDefault();if(dialog.contains(dialog.getRootNode().activeElement))close({restoreFocus:true});});
   dialog.addEventListener('click',click);
   dialog.addEventListener('input',input);
   dialog.addEventListener('change',change);
   dialog.addEventListener('submit',submit);
   dialog.addEventListener('keydown',keydown);
   dialog.addEventListener('pointermove',event=>{const option=event.target.closest('[data-quick-index]');if(option&&tool==='quick'){index=Number(option.dataset.quickIndex);selection();}});
  }
  function open(next=tool,source,{focus=true}={}){
   if(dead)return;poolCache=null;init();if(leaving){root.clearTimeout(leaving);leaving=0;delete dialog.dataset.leaving;}const active=dialog.getRootNode().activeElement,candidate=source||active,wasOpen=dialog.open,wasCollapsed=collapsed;
   if(candidate&&!dialog.contains(candidate))trigger=candidate;
   // Stale callers and saved recents may still name a retired tool.
   next=sections.some(x=>x[0]===next)?next:'quick';const changed=next!==tool;
   if(changed){rememberCapture();tool=next;status='';}
   if(changed||!panels.has(tool))paint();syncCollapsed(false);if(!dialog.open)dialog.show();dockResize?.refresh();notifyDock();syncTabs(changed&&wasOpen&&!wasCollapsed);
   if(focus&&(changed||!wasOpen||wasCollapsed||!dialog.contains(active)))focusFirst();
   if(tool==='quick')hydrate();
  }
  function capture(draft,source){
   if(captureDraft?.title.trim()){open('plan',source);showStatus('You have an unfinished reminder. Add it or clear the draft before capturing another source.');return;}
   captureUndo=null;const link=root.ReservePersonalWork.safeSource(draft?.source?{...draft.source,title:String(draft.source.title||'').slice(0,200)}:null);
   captureDraft={title:String(draft?.name||'').slice(0,200),course:String(draft?.courseId||'personal'),planned:root.ReserveCore.dayKey(Date.now(),getContext().s.timeZone),due:'',source:link};
   if(captureDraft.title.trim())captureDrafts.set(draftKey,captureDraft);open('plan',source);renderPlan();focusFirst();
  }
  function rememberCapture(){if(capturing)return;const form=body()?.querySelector('[data-ui-form="capture"]');if(!form)return;const fd=new FormData(form);captureDraft={...captureDraft,title:String(fd.get('title')||''),course:String(fd.get('course')||'personal'),planned:String(fd.get('planned')||'')==='pick'?plannedOf(fd)||'pick':String(fd.get('planned')||''),due:String(fd.get('due')||''),estimate:String(fd.get('estimate')||'')};if(captureDraft.title.trim())captureDrafts.set(draftKey,captureDraft);else captureDrafts.delete(draftKey);const clear=form.querySelector('[data-ui-action="clear-capture"]');if(clear)clear.disabled=!captureDraft.title;const send=form.querySelector('.rd-composer-send');if(send){if(captureDraft.title.trim())send.removeAttribute('aria-disabled');else send.setAttribute('aria-disabled','true');}}
  function focusFirst(){const selector=tool==='quick'?'[data-ui-field="quick"]':tool==='calculator'?'[data-calc-mode="'+calculatorMode+'"]':'[name="title"]';body()?.querySelector(selector)?.focus({preventScroll:true});}
  function paint(){
   if(!dialog)return;const active=dialog.getRootNode().activeElement,focusWithin=dialog.contains(active),previousTool=dialog.dataset.tool,focusField=active?.dataset?.uiField,focusAction=active?.dataset?.uiAction;dialog.dataset.tool=tool;
   dialog.querySelector('[data-ui-current]').textContent=' · '+sections.find(x=>x[0]===tool)[1];
   for(const tab of dialog.querySelectorAll('.rd-dock-tab')){const selected=tab.dataset.tool===tool;tab.setAttribute('aria-selected',String(selected));tab.setAttribute('tabindex',selected?'0':'-1');}
   let content=body();const fresh=!content,cacheNotice=getContext().cacheNotice||'';
   if(fresh){content=document.createElement('section');content.className='rd-tool-panel';content.dataset.toolPanel=tool;content.setAttribute('id','rd-tool-panel-'+tool);content.setAttribute('role','tabpanel');content.setAttribute('aria-labelledby','rd-tool-tab-'+tool);panels.set(tool,content);dialog.querySelector('.rd-utility-body').append(content);dialog.querySelector('[data-tab="'+tool+'"]')?.setAttribute('aria-controls',content.id);}
   for(const [id,panel] of panels)panel.hidden=id!==tool;
   // A borderless query row (Esc closes), grouped results, and one strip of key hints.
   if(tool==='quick'&&fresh)content.innerHTML=`<label class="rd-quick-search">${I('search')}<input type="search" data-ui-field="quick" role="combobox" aria-label="Quick open search" aria-autocomplete="list" aria-expanded="true" aria-controls="rd-quick-results" autocomplete="off" placeholder="Search courses, assignments and documents" value="${E(query)}"><kbd aria-hidden="true">Esc</kbd></label><div id="rd-quick-results" class="rd-quick-results" role="listbox" aria-label="Quick open results"></div><p class="rd-utility-hint" data-quick-coverage hidden></p><p class="rd-quick-keys">${[['↵','open'],[mod+' ↵','new tab'],['Alt ↵','preview']].map(([key,label])=>`<span><kbd>${E(key)}</kbd> ${label}</span>`).join('')}</p>`;
   if(tool==='calculator'){if(fresh)renderCalculator();selectCalculatorMode(calculatorMode);}
   if(tool==='plan'){if(fresh)renderPlan();else renderPlanLists();}
   if(tool==='quick')renderResults();showStatus(status||cacheNotice);
   if(dialog.open&&previousTool!==tool)toolMotion?.reveal(content,{animate:container.dataset.input!=='keyboard',kind:'section',direction:sections.findIndex(x=>x[0]===tool)-sections.findIndex(x=>x[0]===previousTool)});
   if(previousTool===tool&&focusWithin&&!collapsed){const next=focusField?content.querySelector('[data-ui-field="'+focusField+'"]'):focusAction?[...content.querySelectorAll('[data-ui-action]')].find(node=>node.dataset.uiAction===focusAction&&['mode','value','index','tool'].every(key=>node.dataset[key]===active.dataset[key])):null;if(next&&next!==active)next.focus({preventScroll:true});}
  }
  function renderCalculator(){
   body().innerHTML=`<div class="rd-calculator-modes" role="group" aria-label="Calculator mode">${[['graphing','Graphing'],['scientific','Scientific']].map(([mode,label])=>button('calculator-mode',label,`data-calc-mode="${mode}" aria-label="Desmos ${mode}" aria-pressed="false"`)).join('')}</div>
    <div class="rd-desmos-panel" data-calculator-panel="graphing" hidden></div><div class="rd-desmos-panel" data-calculator-panel="scientific" hidden></div>
    <div class="rd-desmos-links"><a href="https://www.desmos.com/calculator" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Open Desmos graphing ${I('external')}</a><a href="https://www.desmos.com/scientific" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Open Desmos scientific ${I('external')}</a></div>
    <details class="rd-desmos-help"><summary>Connection & privacy</summary><p class="rd-utility-hint">Desmos needs internet and may be blocked here. Use the links above if the embedded calculators are unavailable. Canvas Harness sends no Canvas content. Keep this page open to retain your graph.</p></details>`;
  }
  function selectCalculatorMode(next){
   if(!['graphing','scientific'].includes(next))return;calculatorMode=next;const content=panels.get('calculator');if(!content)return;
   for(const node of content.querySelectorAll('[data-calc-mode]'))node.setAttribute('aria-pressed',String(node.dataset.calcMode===next));
   for(const panel of content.querySelectorAll('[data-calculator-panel]'))panel.hidden=panel.dataset.calculatorPanel!==next;
   const panel=content.querySelector('[data-calculator-panel="'+next+'"]');
   if(!panel.querySelector('iframe')){
    const frame=document.createElement('iframe');frame.className='rd-desmos-frame';frame.setAttribute('title',next==='graphing'?'Desmos graphing calculator':'Desmos scientific calculator');frame.setAttribute('referrerpolicy','no-referrer');
    frame.src=next==='graphing'?'https://www.desmos.com/calculator':'https://www.desmos.com/scientific';panel.append(frame);
   }
  }
  function pool(){if(poolCache)return poolCache;const c=getContext();return poolCache=root.ReserveQuickOpen.entries({courses:c.courses,items:allItems(c).map(x=>({...x,done:root.ReserveCore.isWorkComplete(x,personal.tasks?.[x.id])})),pins:personal.resourcePins||[],materials:c.courses.flatMap(course=>materials?.getItems(course.id)?.length?materials.getItems(course.id):catalogs.get(String(course.id))||[])});}
  // Due labels stay short: the row already names the assignment and course.
  function when(value){
   const C=root.ReserveCore,tz=getContext().s?.timeZone||'America/New_York',at=Date.parse(value),now=Date.now(),day=C.dayKey(at,tz),time=new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'numeric',minute:'2-digit'}).format(at);
   if(at<now)return ['Past due · '+new Intl.DateTimeFormat('en-US',{timeZone:tz,month:'short',day:'numeric'}).format(at),'danger'];
   return day===C.dayKey(now,tz)?['Today · '+time,'warn']:day===C.dayKey(now+864e5,tz)?['Tomorrow · '+time,'info']:[new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'short',month:'short',day:'numeric'}).format(at),''];
  }
  function renderResults(){
   if(tool!=='quick'||!dialog?.open&& !body())return;const old=results[index]?.id,c=getContext(),recent=personal.toolbox?.recent||[];
   results=query.trim()?root.ReserveQuickOpen.search(pool(),query,{courseId:c.courseId,recent,limit:50}):root.ReserveQuickOpen.suggest(pool(),{courseId:c.courseId,recent});
   // Typed results are grouped where they rank: a course's pages under its short name, then
   // Assignments, Materials, Canvas Harness and Canvas; each group keeps its best match first.
   const courseOf=id=>c.courses.find(x=>String(x.id)===String(id));
   if(query.trim()){const order=[],by=new Map(),groupOf=x=>x.kind==='Courses'?courseNames(courseOf(x.courseId)).short||'Courses':x.kind==='Tools'||x.kind==='Navigation'&&x.action?'Canvas Harness':x.kind==='Navigation'?'Canvas':x.kind;for(const x of results){const g=groupOf(x);if(!by.has(g)){by.set(g,[]);order.push(g);}by.get(g).push({...x,group:g,courseGroup:x.kind==='Courses'});}results=order.flatMap(g=>by.get(g));}
   if(old&&results.some(x=>x.id===old))index=results.findIndex(x=>x.id===old);else index=0;
   const list=dialog.querySelector('#rd-quick-results');if(!list)return;
   // Rows: the course's small drawing on the first row of its group, the label (its course as a quiet
   // second line), and a due date or kind at the right only where the group heading does not say it.
   // Only a course's group keeps the drawing's slot (empty after its first row, so its rows align);
   // every other group starts flush with its heading, with no blank gutter.
   const tone=course=>/^#[0-9a-f]{6}$/i.test(course?.color||'')?` style="--rd-course:${course.color};--rd-course-ink:${root.ReserveCore?.courseInk?.(course.color)||course.color}"`:'';
   const row=(entry,i)=>{const course=courseOf(entry.courseId),first=entry.courseGroup&&results[i-1]?.group!==entry.group,[label,tone_]=entry.dueAt&&!entry.done&&(entry.group==='Due soon'||entry.group==='Assignments'||entry.group==='Personal tasks')?when(entry.dueAt):!entry.group||entry.group==='Recent'?[entry.kind,'']:['',''];const text=entry.courseGroup?String(entry.label).replace(new RegExp('^'+String(courseNames(course).short).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'( · )?'),'')||'Course home':entry.label;return `<div class="rd-quick-row" role="option" id="rd-quick-${i}" aria-selected="${i===index}" data-quick-index="${i}"${tone(course)}>${entry.url?`<a class="rd-quick-main" href="${E(entry.url)}" data-ui-link="${i}" tabindex="-1">`:`<button class="rd-quick-main" type="button" data-ui-action="run" data-index="${i}" tabindex="-1">`}${entry.courseGroup?`<span class="rd-quick-art" aria-hidden="true">${first&&course?root.ReserveCourseArt?.mini?.(course,{place:'quick'})||'':''}</span>`:''}<span><strong>${E(text)}</strong>${entry.courseGroup?'':`<small>${E(entry.detail)}</small>`}</span>${label?`<span class="rd-quick-kind"${tone_?` data-tone="${tone_}"`:''}>${E(label)}</span>`:''}${entry.url?`<span class="rd-quick-go" aria-hidden="true">Open in Canvas ${I('external')}</span></a>`:'</button>'}${entry.assignmentId?button('preview-result',I('book'),`data-index="${i}" aria-label="Preview ${E(entry.label)}" tabindex="-1"`,'rd-icon-button'):''}</div>`;};
   // Suggestions arrive grouped (Saved, Schedules, Recent, Due soon, Go to); typed results stay ranked.
   let html='',group=null;results.forEach((entry,i)=>{if(entry.group!==group){if(group)html+='</div>';group=entry.group;if(group)html+=`<div class="rd-quick-group" role="group" aria-labelledby="rd-quick-group-${i}"><div class="rd-quick-heading" id="rd-quick-group-${i}">${E(group)}</div>`;}html+=row(entry,i);});if(group)html+='</div>';
   list.innerHTML=html||'<div class="rd-tool-empty"><h3>No matches yet</h3><p>Try a course name, assignment title, or “calculator”. Browse a course’s Materials to make more documents searchable here. External document contents are not indexed.</p></div>';
   const coverage=dialog.querySelector('[data-quick-coverage]');if(coverage){coverage.textContent=cacheLoading?'Checking material catalogs already saved on this device…':cacheMessage;coverage.hidden=!coverage.textContent;}selection();
  }
  function selection(){
   const input=dialog.querySelector('[data-ui-field="quick"]');if(results.length)input?.setAttribute('aria-activedescendant','rd-quick-'+index);else input?.removeAttribute('aria-activedescendant');
   for(const row of dialog.querySelectorAll('[data-quick-index]'))row.setAttribute('aria-selected',String(Number(row.dataset.quickIndex)===index));
  }
  async function hydrate(){
   if(cacheLoading)return;cacheLoading=true;
   const courses=getContext().courses;let changed=false;
   await Promise.all(courses.map(async c=>{try{const raw=await store.readResourceCache?.(c.id);if(!dead&&raw){const items=root.ReserveMaterials.normalizeCatalog(raw);if(JSON.stringify(items)!==JSON.stringify(catalogs.get(String(c.id)))){catalogs.set(String(c.id),items);changed=true;}}}catch{cacheMessage='Some saved catalogs could not be read. Saved documents and loaded assignments are still available.';}}));
   cacheLoading=false;if(changed)poolCache=null;if(dead||!dialog?.open)return;if(tool==='quick')renderResults();
  }
  function record(entry){save(data=>{data.toolbox.recent=[entry.id,...data.toolbox.recent.filter(x=>x!==entry.id)].slice(0,24);});}
  function run(entry,event={}){
   if(!entry)return;
   if(entry.url){const link=dialog.querySelector(`[data-ui-link="${results.indexOf(entry)}"]`);if(link){link.target=event.ctrlKey||event.metaKey?'_blank':'';link.rel='noopener noreferrer';link.click();}return;}
   record(entry);
   if(entry.action==='plan'){onPreview(entry.value);return;}
   if(entry.action==='tool'){open(entry.value);return;}
   if(entry.action==='planner'){onPlanner?.({page:entry.value,id:null});return;}
   if(entry.action==='workspace')onNavigate(entry.value);
  }
  // Plan is a composer: the words first, then one row of quiet controls (a deadline, the course,
  // the work day, send), an attached tray (source, estimate) and a plain note. Enter adds it;
  // Shift+Enter starts a new line. The send circle warms to clay once there is something to add.
  function workDays(ctx,planned){
   const tz=ctx.s.timeZone||'America/New_York',today=root.ReserveCore.dayKey(Date.now(),tz),base=Date.parse(today+'T12:00:00Z'),days=[];
   for(let i=0;i<14;i++){const key=new Date(base+i*864e5).toISOString().slice(0,10);days.push([key,i===0?'Today':i===1?'Tomorrow':new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'}).format(new Date(key+'T12:00:00Z'))]);}
   if(/^\d{4}-\d{2}-\d{2}$/.test(planned||'')&&!days.some(([key])=>key===planned))days.push([planned,new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date(planned+'T12:00:00Z'))]);
   // Any later day: "Pick a date…" opens a date field in the tray (as the + opens the deadline).
   return [...days,['pick','Pick a date…'],['','No work day']];
  }
  // The work day the composer means: a listed day, or the picked date when "Pick a date…" is chosen.
  const plannedOf=fd=>String(fd.get('planned')||'')==='pick'?String(fd.get('planned-pick')||''):String(fd.get('planned')||'');
  function coursePill(ctx,id){const course=ctx.courses.find(c=>String(c.id)===String(id)),ok=/^#[0-9a-f]{6}$/i.test(course?.color||'');return {style:ok?`--rd-course:${course.color};--rd-course-ink:${root.ReserveCore?.courseInk?.(course.color)||course.color}`:'',art:course?root.ReserveCourseArt?.mini?.(course,{place:'composer'})||'':''};}
  function renderPlan(){
   const ctx=getContext(),today=root.ReserveCore.dayKey(Date.now(),ctx.s.timeZone),draft=captureDraft||{title:'',course:ctx.courseId,planned:today,due:'',estimate:''},pill=coursePill(ctx,draft.course);
   panels.get('plan').innerHTML=`<form data-ui-form="capture" class="rd-capture-form rd-composer"><div class="rd-composer-card"><textarea name="title" maxlength="200" rows="2" required placeholder="What do you need to do?" aria-label="Personal task title" aria-describedby="rd-composer-note">${E(draft.title)}</textarea><div class="rd-composer-controls">${button('capture-more',I('plus'),`aria-label="Add a deadline" title="Add a deadline" aria-expanded="${!!draft.due}" aria-controls="rd-capture-more"`,'rd-icon-button rd-composer-plus')}<span class="rd-composer-course" data-composer-course style="${pill.style}"><span class="rd-composer-art" aria-hidden="true">${pill.art}</span><select name="course" aria-label="Personal task course"><option value="personal">Personal</option>${ctx.courses.map(c=>`<option value="${E(c.id)}" ${draft.course===c.id?'selected':''}>${E(courseNames(c).option)}</option>`).join('')}</select></span><span class="rd-composer-spacer"></span><span class="rd-select-text rd-composer-day"><select name="planned" aria-label="Personal task work date">${workDays(ctx,draft.planned).map(([key,label])=>`<option value="${E(key)}" ${draft.planned===key?'selected':''}>${E(label)}</option>`).join('')}</select></span><button type="submit" class="rd-composer-send" aria-label="Add to my plan" title="Add to my plan · Enter" ${draft.title.trim()?'':'aria-disabled="true"'}>${I('arrow')}</button></div></div><div class="rd-composer-tray">${draft.source?`<span class="rd-composer-source">${I('external')}<span>Source: <a href="${E(draft.source.url)}" target="_blank" rel="noopener noreferrer">${E(draft.source.title)}</a><small> · ${E(draft.source.kind.replace('-',' '))}</small></span>${button('remove-capture-source',I('close'),'aria-label="Remove linked source" title="Remove linked source"','rd-icon-button rd-remove-source')}</span>`:''}<span class="rd-select-text"><select name="estimate" aria-label="Estimated minutes">${[['','No estimate'],['15','About 15 min'],['30','About 30 min'],['45','About 45 min'],['60','About 1 hour'],['90','About 1½ hours'],['120','About 2 hours']].map(([value,label])=>`<option value="${value}" ${String(draft.estimate||'')===value?'selected':''}>${label}</option>`).join('')}</select></span><div class="rd-composer-more" id="rd-capture-pick" ${draft.planned==='pick'?'':'hidden'}>${field('Work date',`<input name="planned-pick" type="date" min="${E(today)}">`)}</div><div class="rd-composer-more" id="rd-capture-more" ${draft.due?'':'hidden'}>${field('Deadline · '+E(ctx.s.timeZone||'America/New_York'),`<input name="due" type="datetime-local" aria-label="Personal task deadline" value="${E(draft.due)}">`)}</div></div><p class="rd-composer-note" id="rd-composer-note"><span>Saved on this device · never submitted to Canvas</span><span>Enter adds it · Shift Enter for a new line</span></p><div class="rd-composer-drafts">${button('clear-capture','Clear draft',draft.title?'':'disabled','rd-text-button')}${captureUndo?button('undo-capture','Undo clear','','rd-text-button'):''}</div></form><div data-plan-lists></div>`;
   renderPlanLists();
  }
  // The lists refresh on every visit; the form keeps its live nodes and draft.
  function renderPlanLists(){
   const node=panels.get('plan')?.querySelector('[data-plan-lists]');if(!node)return;
   const ctx=getContext(),today=root.ReserveCore.dayKey(Date.now(),ctx.s.timeZone),items=allItems().filter(x=>!root.ReserveCore.isWorkComplete(x,personal.tasks?.[x.id])),planned=items.filter(x=>personal.tasks?.[x.id]?.plannedDate===today),personalItems=items.filter(x=>x.personal&&!planned.some(p=>p.id===x.id));
   const list=rows=>rows.map(x=>`<div class="rd-tool-plan-row"><span><strong>${E(x.name)}</strong><small>${E(courseNames(ctx.courseMap?.get(String(x.courseId))||ctx.courses.find(c=>String(c.id)===String(x.courseId))).short||x.courseName||'Personal task')}</small></span>${button('plan-item','Open plan',`data-id="${E(x.id)}"`)}</div>`).join('');
   node.innerHTML=`<section class="rd-link-group"><h3>Planned for today <span>${planned.length}</span></h3>${list(planned)||'<p class="rd-utility-hint">Choose “Plan for today” beside an assignment to add it here.</p>'}</section>${personalItems.length?`<section class="rd-link-group"><h3>Personal tasks <span>${personalItems.length}</span></h3>${list(personalItems.slice(-15).reverse())}</section>`:''}`;
  }
  function click(event){
   const anchor=event.target.closest('[data-ui-link]');if(anchor){record(results[Number(anchor.dataset.uiLink)]);return;}
   const node=event.target.closest('[data-ui-action]');if(!node)return;const action=node.dataset.uiAction;
   if(action==='remove-capture-source'&&!capturing&&captureDraft){captureDraft={...captureDraft,source:null};if(captureDraft.title.trim())captureDrafts.set(draftKey,captureDraft);renderPlan();focusFirst();return;}
   if(action==='clear-capture'&&!capturing){captureUndo=captureDraft;captureDraft=null;captureDrafts.delete(draftKey);renderPlan();focusFirst();return;}
   if(action==='undo-capture'&&!capturing&&!captureDraft){captureDraft=captureUndo;captureUndo=null;if(captureDraft)captureDrafts.set(draftKey,captureDraft);renderPlan();focusFirst();return;}
   if(action==='capture-more'){const more=body()?.querySelector('#rd-capture-more');if(more){more.hidden=!more.hidden;node.setAttribute('aria-expanded',String(!more.hidden));if(!more.hidden)more.querySelector('[name="due"]')?.focus();}return;}
   if(action==='close'){close({restoreFocus:true});return;}if(action==='collapse'){collapse();return;}if(action==='expand'){expand();return;}
   if(action==='calculator-mode'){selectCalculatorMode(node.dataset.calcMode);return;}
   if(action==='tool'){open(node.dataset.tool);return;}
   if(action==='run'){run(results[Number(node.dataset.index)],event);return;}
   if(action==='preview-result'){const row=results[Number(node.dataset.index)];if(row)onPreview(row.assignmentId);return;}
   if(action==='plan-item'){onPreview(node.dataset.id);return;}
  }
  function input(event){if(event.target.closest('[data-ui-form="capture"]'))rememberCapture();const f=event.target.dataset.uiField;if(f==='quick'){query=event.target.value.slice(0,240);index=0;results=[];renderResults();}}
  function change(event){
   if(event.target.closest('[data-ui-form="capture"]')){rememberCapture();
    // The course pill shows the chosen course's small drawing in its colour.
    // Pick a date…: the date field opens in the tray with the focus; any listed day closes it.
    if(event.target.getAttribute?.('name')==='planned'){const pick=body()?.querySelector('#rd-capture-pick');if(pick){pick.hidden=event.target.value!=='pick';if(!pick.hidden)pick.querySelector('[name="planned-pick"]')?.focus();}}
    if(event.target.getAttribute?.('name')==='course'){const pill=event.target.closest('[data-composer-course]'),next=coursePill(getContext(),event.target.value);if(pill){pill.setAttribute('style',next.style);const art=pill.querySelector('.rd-composer-art');if(art)art.innerHTML=next.art;}}}
  }
  async function submit(event){if(event.target.dataset.uiForm!=='capture')return;event.preventDefault();if(capturing)return;rememberCapture();const form=event.target,fd=new FormData(form),title=String(fd.get('title')||'').trim();if(!title)return;
   try{const due=String(fd.get('due')||''),id='local-'+root.crypto.randomUUID(),ctx=getContext(),courseId=String(fd.get('course')||'personal');if(courseId!=='personal'&&!ctx.courses.some(c=>c.id===courseId))throw Error('Choose an available course.');if(String(fd.get('planned')||'')==='pick'&&!/^\d{4}-\d{2}-\d{2}$/.test(plannedOf(fd)))throw Error('Pick a work date, or choose No work day.');
    const dueAt=due?root.ReserveUI.wallTimeToISO(due,ctx.s.timeZone||'America/New_York'):null,planned=plannedOf(fd),estimate=Math.min(1440,Math.max(0,Number(fd.get('estimate'))||0));const submitButton=form.querySelector('[type="submit"]');submitButton.disabled=true;capturing=true;const submittedDraft=captureDraft,source=submittedDraft?.source;for(const field of form.querySelectorAll('input,select,button,textarea'))field.disabled=true;
    const ok=await save(data=>{data.customTasks.push({id,name:title.slice(0,200),courseId,dueAt,createdAt:new Date().toISOString(),...(source?{source}:{})});data.tasks[id]={plannedDate:planned,notes:'',progress:'not-started',...(estimate?{estimate}:{})};});
    capturing=false;const completed=ok&&captureDraft===submittedDraft;
    if(completed){captureDraft=null;captureUndo=null;if(captureDrafts.get(draftKey)===submittedDraft)captureDrafts.delete(draftKey);}if(dead)return;
    const hadFocus=form.contains(dialog.getRootNode().activeElement);
    if(completed)renderPlan();else for(const field of form.querySelectorAll('input,select,button,textarea'))field.disabled=false;
    if(ok&&tool==='plan'&&dialog.open){showStatus('Added to your personal plan.');if(hadFocus&&!collapsed)body().querySelector('[name="title"]')?.focus();}
   }catch(error){capturing=false;for(const field of form.querySelectorAll('input,select,button,textarea'))field.disabled=false;showStatus(error.message,true);}
  }
  function keydown(event){
   event.stopPropagation();container.dataset.input='keyboard';toolMotion?.cancel();if(event.isComposing)return;
   if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();open('quick');return;}
   if(event.key==='Escape'){event.preventDefault();close({restoreFocus:true});return;}
   // Tabs follow the ARIA pattern: arrows move and select; Tab moves into the panel.
   const tab=event.target.closest?.('.rd-dock-tab');
   if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
    event.preventDefault();const ids=sections.map(x=>x[0]),at=ids.indexOf(tab.dataset.tool),next=ids[event.key==='Home'?0:event.key==='End'?ids.length-1:(at+(event.key==='ArrowRight'?1:-1)+ids.length)%ids.length];
    open(next,undefined,{focus:false});dialog.querySelector('[data-tab="'+next+'"]')?.focus({preventScroll:true});return;
   }
   if(tool==='quick'&&event.target.dataset.uiField==='quick'){
    if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();if(results.length){index=(index+(event.key==='ArrowDown'?1:-1)+results.length)%results.length;selection();dialog.querySelector('#rd-quick-'+index)?.scrollIntoView({block:'nearest',behavior:'instant'});}}
    if(event.key==='Enter'){event.preventDefault();const entry=results[index];if(event.altKey&&entry?.assignmentId)onPreview(entry.assignmentId);else run(entry,event);}
   }
   // The composer: Enter adds the reminder, Shift+Enter starts a new line.
   if(tool==='plan'&&event.key==='Enter'&&!event.shiftKey&&event.target.getAttribute?.('name')==='title'){event.preventDefault();event.target.closest('[data-ui-form="capture"]')?.requestSubmit?.();return;}
  }
  const unsubscribe=store.subscribe(data=>{personal=data;poolCache=null;if(dialog?.open&&tool==='quick')renderResults();});
  return {open:(next,source)=>open(next,source),capture,collapse,expand,close,isOpen:()=>!dead&&!!dialog?.open,update(){if(!dead)poolCache=null;},destroy(){if(dead)return;rememberCapture();dead=true;if(leaving)root.clearTimeout(leaving);dockResize?.destroy();toolMotion?.destroy();unsubscribe?.();dialog?.remove();panels.clear();notifyDock();}};
 }
 root.ReserveToolbox={create};if(typeof module!=='undefined'&&module.exports)module.exports=root.ReserveToolbox;
})(globalThis);
