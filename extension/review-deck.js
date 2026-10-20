/* Canvas Harness review deck: flashcards for the student's courses (review-model.js has the rules). A Home module shows
   what is due; the review screen asks one card at a time (Show answer, then Again, Good or Easy); the manager adds cards
   one at a time or from a pasted list, edits, pauses, exports and sets the daily limits. Cards can be started from an
   assignment (Add card in the reader), a course's hub, the Today module, the focus room or Shift+R. Everything stays
   in the student's personal data on this device. Nothing here writes to Canvas. */
(function(root){
 'use strict';
 const M=()=>root.ReserveReviewModel;
 const ADD_HINT='Hide words with {{double braces}} for a fill-in-the-blank card. Math: \\( x^2 \\).';
 const waitText=(today,due)=>{const n=Math.round((Date.parse(due+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/864e5);return n<=1?'tomorrow':n<7?`${n} days`:n<30?`${Math.round(n/7)} wk`:`${Math.round(n/30)} mo`;};

 function create({container,store,save,getContext,helpers,onFinished=()=>{}}){
  const doc=container.ownerDocument,win=doc.defaultView||root;
  let node=null,view='',tab='add',dead=false,status='',statusTimer=0,returnTo=null,overflow=null;
  let session=null,draft={front:'',back:'',course:'',two:false,src:null,edit:''},paste={text:'',course:'',two:false},filter={course:'',q:'',limit:100},confirmDelete='';
  const E=v=>helpers().E(v);
  const deck=()=>M().cleanDeck(store.get()?.reviewDeck);
  const today=()=>{const c=getContext(),h=helpers();return h.dayKey(Date.now(),c.s.timeZone)||new Date().toISOString().slice(0,10);};
  const tests=()=>{const c=getContext(),h=helpers();return M().testsAhead(c.items,today(),v=>h.dayKey(v,c.s.timeZone));};
  const courses=()=>(getContext().courses||[]).map(c=>({id:String(c.id),name:c.shortName||c.name,color:c.color||'#8a8577'}));
  const courseName=id=>id==='personal'?'Personal':courses().find(c=>c.id===String(id))?.name||'A past course';
  const courseColor=id=>courses().find(c=>c.id===String(id))?.color||'#8a8577';
  const saveDeck=fn=>save(data=>{const d=M().cleanDeck(data.reviewDeck);fn(d);data.reviewDeck=d;}).then(ok=>{paintCounts();return ok;});
  // The counts on the toolbar's Cards, each course's Flashcards and the focus room's cards button follow the deck at
  // once: the workspace redraws only what a click changes, so the deck keeps its own badges current.
  function paintCounts(){
   if(dead)return;
   const badge=(button,cls,n)=>{let b=button.querySelector('.'+cls);if(n){if(!b){b=doc.createElement('b');b.className=cls;button.append(b);}if(b.textContent!==String(n))b.textContent=String(n);}else b?.remove();};
   const due=dueCount();
   for(const b of container.querySelectorAll('.rv-toolbar-button')){badge(b,'rv-count',due);b.setAttribute('aria-label',`Review deck${due?`, ${due} cards due`:''}`);}
   for(const b of container.querySelectorAll('.fr-cards'))badge(b,'fr-badge',due);
   if(container.querySelector('.rv-course-button')){
    const d=deck(),q=M().queue(d,today(),{tests:tests()}),byCourse={};
    for(const x of q){const c=d.cards.find(card=>card.id===x.id)?.c;if(c)byCourse[c]=(byCourse[c]||0)+1;}
    for(const b of container.querySelectorAll('.rv-course-button')){const id=b.dataset.id,has=d.cards.some(c=>c.c===id),label=has?'Flashcards':'Make flashcards';
     if(b.firstChild?.nodeType===3&&b.firstChild.nodeValue!==label)b.firstChild.nodeValue=label;badge(b,'rv-count',byCourse[id]||0);}
   }
  }
  const fmt=v=>{const t=String(v??'');const html=root.ReserveMath?.hasMath?.(t)&&root.ReserveMath.renderText?root.ReserveMath.renderText(t):E(t);return html.replace(/\n/g,'<br>');};
  function say(text,ms=4000){status=text;clearTimeout(statusTimer);if(ms)statusTimer=setTimeout(()=>{status='';const el=node?.querySelector('[data-rv-status]');if(el)el.textContent='';},ms);const el=node?.querySelector('[data-rv-status]');if(el)el.textContent=text;}

  /* ---- small pieces other parts of Harness show ---- */
  function summary(){const t=tests();return M().stats(deck(),today(),{tests:t});}
  function moduleBody(){
   const st=summary(),d=deck(),action=(a,label,extra='',cls='rd-button')=>`<button type="button" class="${cls}" data-rd-action="${a}" ${extra}>${label}</button>`;
   if(!d.cards.length)return `<div class="rv-mod"><p class="rd-widget-empty">Make flashcards for any course. Each card comes back just before you would forget it, and a course's cards come first before its test.</p>${action('review-manage','Add your first cards','data-tab="add"','rd-button rd-button-primary')}</div>`;
   const boost=st.boosted.map(c=>courseName(c)).slice(0,2);
   const rows=Object.entries(st.courses).sort((a,b)=>b[1].due-a[1].due||b[1].cards-a[1].cards).slice(0,4).map(([id,x])=>`<li style="--rd-course:${E(courseColor(id))}"><i></i><span>${E(courseName(id))}</span><b>${x.due?`${x.due} due`:''}</b><small>${x.cards}</small></li>`).join('');
   const max=Math.max(1,...st.ahead.map(a=>a.n));
   const bars=st.ahead.map(a=>`<span title="${E(a.d)}: ${a.n}"><i style="height:${Math.round(a.n/max*100)}%"></i><small>${E(new Date(a.d+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'narrow',timeZone:'UTC'}))}</small></span>`).join('');
   return `<div class="rv-mod">
<p class="rv-mod-due"><strong>${st.due}</strong> ${st.due===1?'card':'cards'} due${st.due?` <span>· about ${st.minutes} min</span>`:''}</p>
${st.today.done?'<p class="rd-widget-note">Done for today. Nicely.</p>':boost.length?`<p class="rv-mod-boost">${E(boost.join(' and '))} first: a test is coming.</p>`:''}
<div class="rv-mod-actions">${action('review-start','Start review',st.due?'':'disabled','rd-button rd-button-primary')}${action('review-manage','Add cards','data-tab="add"','rd-text-button')}${action('review-manage','All cards','data-tab="cards"','rd-text-button')}</div>
<ul class="rv-mod-courses">${rows}</ul>
<div class="rv-mod-ahead" aria-label="Cards coming due in the next 7 days">${bars}</div>
<p class="rd-widget-note">${st.streak?`${st.streak} day${st.streak===1?'':'s'} in a row · `:''}${st.learned} learned of ${st.total}</p></div>`;
  }
  function todayLine(){const st=summary();return st.due?`<button type="button" class="rv-today-line" data-rd-action="review-start"><b>Review ${st.due} ${st.due===1?'card':'cards'}</b><span>about ${st.minutes} min</span></button>`:'';}
  function hubLink(courseId){
   const d=deck(),id=String(courseId),cards=d.cards.filter(c=>c.c===id).length;
   const due=cards?M().queue(d,today(),{tests:tests()}).filter(x=>d.cards.find(c=>c.id===x.id)?.c===id).length:0;
   return `<span aria-hidden="true"> · </span><button type="button" class="rv-hub-link" data-rd-action="review-course" data-id="${E(id)}">${cards?`Review deck${due?` · ${due} due`:` · ${cards}`}`:'Make flashcards'}</button>`;
  }
  const dueCount=()=>summary().due;
  // A "Flashcards" button for a course's page and hub heading: that course's cards due, or a way to start making some.
  function courseButton(courseId){
   const d=deck(),id=String(courseId),cards=d.cards.filter(c=>c.c===id).length;
   const due=cards?M().queue(d,today(),{tests:tests()}).filter(x=>d.cards.find(c=>c.id===x.id)?.c===id).length:0;
   return `<button type="button" class="rd-button rv-course-button" data-rd-action="review-course" data-id="${E(id)}" title="${cards?'Review this course\'s flashcards':'Make flashcards for this course'} · Shift+R reviews every course">${cards?'Flashcards':'Make flashcards'}${due?` <b class="rv-count">${due}</b>`:''}</button>`;
  }

  /* ---- the overlay ---- */
  function open(next='review',opts={}){
   if(dead||!M())return;
   if(next==='review'){
    const t=tests(),d=deck();let list=M().queue(d,today(),{tests:t});
    if(opts.course)list=list.filter(x=>d.cards.find(c=>c.id===x.id)?.c===String(opts.course));
    if(!list.length){next='manage';tab=opts.course?'add':'cards';if(opts.course)draft.course=String(opts.course);say(opts.course?'Nothing due in this course. Add some cards.':'Nothing due right now.');}
    else session={list,i:0,revealed:false,seen:new Set(),counts:{again:0,good:0,easy:0},course:opts.course||'',tests:t,done:false,treat:false};
   }
   if(next==='manage'){tab=opts.tab||tab||'add';if(opts.course)draft.course=paste.course=String(opts.course);if(opts.src){draft.src=opts.src;draft.course=String(opts.course||draft.course);}}
   view=next;
   if(!node){
    returnTo=container.getRootNode?.()?.activeElement||null;
    node=doc.createElement('div');node.className='rv-overlay';node.dataset.rdKeep='true';node.setAttribute('role','dialog');node.setAttribute('aria-modal','true');node.tabIndex=-1;
    container.append(node);overflow=doc.documentElement.style.overflow;doc.documentElement.style.overflow='hidden';
   }
   node.setAttribute('aria-label',view==='review'?'Review cards':'Review deck');
   render();
   (node.querySelector('[data-rv-first]')||node.querySelector('button,textarea,input,select')||node).focus({preventScroll:true});
  }
  function close(){
   if(!node)return;
   node.remove();node=null;session=null;view='';confirmDelete='';
   doc.documentElement.style.overflow=overflow||'';overflow=null;
   if(returnTo?.isConnected)returnTo.focus?.({preventScroll:true});returnTo=null;
  }
  function render(){
   if(!node||dead)return;
   const active=node.getRootNode()?.activeElement,key=active&&node.contains(active)?(active.dataset.rvField?`[data-rv-field="${active.dataset.rvField}"]`:active.dataset.rvAction?`[data-rv-action="${active.dataset.rvAction}"]${active.dataset.value!==undefined?`[data-value="${CSS.escape(active.dataset.value)}"]`:''}`:''):'',caret=active?.selectionStart;
   node.innerHTML=`<div class="rv-panel" data-view="${view}">${view==='review'?reviewView():manageView()}<p class="rv-status" role="status" data-rv-status>${E(status)}</p></div>`;
   const el=key&&node.querySelector(key);
   if(el){el.focus({preventScroll:true});if(Number.isInteger(caret)&&el.setSelectionRange&&/^(TEXTAREA|INPUT)$/.test(el.tagName)&&el.type!=='number')try{el.setSelectionRange(caret,caret);}catch{}}
   // While reviewing, the keyboard always lands on the next thing to press (Show answer, Good, or Close).
   else if(view==='review')node.querySelector('[data-rv-first]')?.focus({preventScroll:true});
  }
  const head=(title,sub='')=>`<header class="rv-head"><div><p class="rv-eyebrow">Review deck</p><h2>${title}</h2>${sub?`<p class="rv-sub">${sub}</p>`:''}</div><button type="button" class="rv-icon" data-rv-action="close" aria-label="Close (Esc)"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg></button></header>`;

  /* ---- reviewing ---- */
  function sideHtml(card,side,revealed){
   if(M().isCloze(card.f)&&side==='f'){
    const parts=M().clozeParts(card.f).map(p=>p.hidden!==undefined?(revealed?`<mark class="rv-fill">${fmt(p.hidden)}</mark>`:'<span class="rv-blank" aria-label="blank">[ … ]</span>'):fmt(p.text)).join('');
    return {q:parts,a:revealed&&card.b?fmt(card.b):''};
   }
   return side==='b'?{q:fmt(card.b),a:revealed?fmt(card.f):''}:{q:fmt(card.f),a:revealed?fmt(card.b):''};
  }
  function reviewView(){
   const s=session,d=deck();
   if(!s||s.done||s.i>=s.list.length){
    const total=s?s.counts.again+s.counts.good+s.counts.easy:0,st=summary();
    return `${head('Done for now')}<div class="rv-end"><p class="rv-end-big">${total} reviewed</p><p>${s?`${s.counts.good+s.counts.easy} right · ${s.counts.again} to see again tomorrow`:''}</p>${s?.treat?'<p>Your pony gets a treat.</p>':''}<p class="rv-sub">${st.due?`${st.due} more ${st.due===1?'card is':'cards are'} due today.`:'Nothing else is due today.'}</p>
<div class="rv-actions">${st.due?'<button type="button" class="rv-button rv-primary" data-rv-action="again-session" data-rv-first>Keep going</button>':''}<button type="button" class="rv-button${st.due?'':' rv-primary'}" data-rv-action="close" ${st.due?'':'data-rv-first'}>Close</button><button type="button" class="rv-button" data-rv-action="tab" data-value="add">Add cards</button></div></div>`;
   }
   const item=s.list[s.i],card=d.cards.find(c=>c.id===item.id);
   if(!card){s.i++;return reviewView();}
   const {q,a}=sideHtml(card,item.side,s.revealed),left=s.list.length-s.i;
   const days=item.practice?null:M().preview(d,card.id,item.side,today(),{tests:s.tests});
   const test=s.tests[card.c];
   const grade=(g,label,key)=>`<button type="button" class="rv-grade" data-rv-action="grade" data-value="${g}" ${g==='good'?'data-rv-first':''}><span>${label}</span><small>${key} · ${days?E(waitText(today(),days[g])):'practice'}</small></button>`;
   return `${head(`<span class="rv-course" style="--rv-course:${E(courseColor(card.c))}"><i></i>${E(courseName(card.c))}</span>`,`${left} left${item.fresh?' · new card':''}${item.practice?' · once more':''}${test?` · test ${E(new Date(test+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',month:'numeric',day:'numeric',timeZone:'UTC'}))}`:''}`)}
<div class="rv-progress" aria-hidden="true"><i style="width:${Math.round(s.i/s.list.length*100)}%"></i></div>
<div class="rv-card" data-side="${item.side}">${item.side==='b'?'<p class="rv-direction">Back first</p>':''}<div class="rv-q">${q}</div>${s.revealed?`<hr><div class="rv-a">${a||'<span class="rv-sub">(no note)</span>'}</div>${card.src?.url?`<p class="rv-src"><a href="${E(card.src.url)}" target="_blank" rel="noopener noreferrer">${E(card.src.title||'Source')}</a></p>`:''}`:''}</div>
<div class="rv-actions">${s.revealed?(item.practice?'<button type="button" class="rv-button rv-primary" data-rv-action="grade" data-value="good" data-rv-first>Next <small>Space</small></button>':grade('again','Again','1')+grade('good','Good','2')+grade('easy','Easy','3')):'<button type="button" class="rv-button rv-primary" data-rv-action="reveal" data-rv-first>Show answer <small>Space</small></button>'}</div>
<p class="rv-foot"><button type="button" class="rv-link" data-rv-action="edit-card" data-value="${E(card.id)}">Edit this card</button> · <button type="button" class="rv-link" data-rv-action="pause-card" data-value="${E(card.id)}">Pause it</button></p>`;
  }
  function grade(g){
   const s=session;if(!s||!s.revealed)return;
   const item=s.list[s.i];if(!item)return;
   s.revealed=false;s.i++;
   if(!item.practice){
    s.counts[g]++;
    // Again: once more at the end of this session, without changing its schedule a second time.
    if(g==='again'&&!s.seen.has(item.id+item.side)){s.seen.add(item.id+item.side);s.list.push({...item,practice:true,fresh:false});}
    const t=s.tests,day=today();
    saveDeck(d=>{M().answer(d,item.id,item.side,g,day,{tests:t});if(s.i>=s.list.length&&M().finishDay(d,day))s.treat=true;}).then(()=>{if(s.treat&&s.i>=s.list.length){onFinished('review');}render();});
   }else if(s.i>=s.list.length){const day=today();saveDeck(d=>{if(M().finishDay(d,day))s.treat=true;}).then(()=>{if(s.treat)onFinished('review');render();});}
   if(s.i>=s.list.length)s.done=true;
   render();
  }

  /* ---- the manager ---- */
  function courseSelect(field,value){
   const list=courses();return `<select data-rv-field="${field}" aria-label="Course">${list.map(c=>`<option value="${E(c.id)}" ${value===c.id?'selected':''}>${E(c.name)}</option>`).join('')}<option value="personal" ${value==='personal'||!list.some(c=>c.id===value)&&value?'selected':''}>Personal</option></select>`;
  }
  function manageView(){
   const d=deck(),tabs=[['add',draft.edit?'Edit card':'Add a card'],['paste','Paste a list'],['cards',`All cards <span>${d.cards.length}</span>`],['settings','Settings']];
   const nav=`<nav class="rv-tabs" role="tablist">${tabs.map(([k,label])=>`<button type="button" role="tab" class="rv-tab" data-rv-action="tab" data-value="${k}" aria-selected="${tab===k}">${label}</button>`).join('')}</nav>`;
   return head('Your cards',`${d.cards.length} of ${M().LIMITS.cards.toLocaleString()} cards · kept on this device and in Harness backups`)+nav+`<div class="rv-tab-body">${tab==='paste'?pasteTab():tab==='cards'?cardsTab(d):tab==='settings'?settingsTab(d):addTab()}</div>`;
  }
  function addTab(){
   if(!draft.course)draft.course=courses()[0]?.id||'personal';
   const cloze=M().isCloze(draft.front);
   return `<label class="rv-field"><span>Course</span>${courseSelect('course',draft.course)}</label>
<label class="rv-field"><span>Front</span><textarea data-rv-field="front" rows="3" maxlength="1000" placeholder="A question, a term, or a sentence with {{hidden words}}" data-rv-first>${E(draft.front)}</textarea></label>
<label class="rv-field"><span>Back${cloze?' <small>(optional note)</small>':''}</span><textarea data-rv-field="back" rows="3" maxlength="1000" placeholder="${cloze?'Anything to show with the answer':'The answer'}">${E(draft.back)}</textarea></label>
<label class="rv-check"><input type="checkbox" data-rv-field="two" ${draft.two&&!cloze?'checked':''} ${cloze?'disabled':''}><span>Also ask it the other way round (back first)</span></label>
${draft.src?`<p class="rv-src">From: ${E(draft.src.title||'an assignment')} <button type="button" class="rv-link" data-rv-action="drop-src">Remove</button></p>`:''}
<p class="rv-hint">${E(ADD_HINT)}</p>
<div class="rv-actions"><button type="button" class="rv-button rv-primary" data-rv-action="save-card">${draft.edit?'Save changes':'Add card'} <small>⌘ Enter</small></button>${draft.edit?'<button type="button" class="rv-button" data-rv-action="cancel-edit">Cancel</button>':''}</div>`;
  }
  function pasteTab(){
   if(!paste.course)paste.course=courses()[0]?.id||'personal';
   const p=M().parseList(paste.text);
   return `<label class="rv-field"><span>Course</span>${courseSelect('paste-course',paste.course)}</label>
<label class="rv-field"><span>One card per line</span><textarea data-rv-field="paste" rows="8" placeholder="mitosis – cell division&#10;ATP: the cell's energy carrier&#10;The {{nucleus}} holds the DNA" data-rv-first>${E(paste.text)}</textarea></label>
<p class="rv-hint">Between the front and back: a tab, " – ", " - ", ": " or " = ". Lists copied from Quizlet or Anki work as they are.</p>
<label class="rv-check"><input type="checkbox" data-rv-field="paste-two" ${paste.two?'checked':''}><span>Also ask each one the other way round</span></label>
${paste.text.trim()?`<div class="rv-preview"><p><b>${p.cards.length} ${p.cards.length===1?'card':'cards'} ready</b>${p.problems.length?` · ${p.problems.length} ${p.problems.length===1?'line':'lines'} can't be read (${p.problems.slice(0,4).map(x=>'line '+x.line).join(', ')}${p.problems.length>4?'…':''})`:''}</p><ul>${p.cards.slice(0,5).map(c=>`<li><span>${E(c.front)}</span><span>${E(c.back)}</span></li>`).join('')}</ul>${p.cards.length>5?`<p class="rv-sub">and ${p.cards.length-5} more</p>`:''}</div>`:''}
<div class="rv-actions"><button type="button" class="rv-button rv-primary" data-rv-action="add-list" ${p.cards.length?'':'disabled'}>Add ${p.cards.length||''} ${p.cards.length===1?'card':'cards'}</button></div>`;
  }
  function cardsTab(d){
   const q=filter.q.trim().toLowerCase(),day=today();
   const list=d.cards.filter(c=>(!filter.course||c.c===filter.course)&&(!q||(c.f+' '+c.b).toLowerCase().includes(q)));
   const when=c=>{if(c.paused)return 'paused';const s=c.s.f,wait=s.due>day?waitText(day,s.due):'';return s.box===0?'new':!wait?'due today':wait==='tomorrow'?'due tomorrow':`due in ${wait}`;};
   const used=[...new Set(d.cards.map(c=>c.c))];
   return `<div class="rv-filter"><select data-rv-field="filter-course" aria-label="Course"><option value="">All courses</option>${used.map(id=>`<option value="${E(id)}" ${filter.course===id?'selected':''}>${E(courseName(id))}</option>`).join('')}</select><input type="search" data-rv-field="filter-q" placeholder="Search cards" value="${E(filter.q)}" data-rv-first><button type="button" class="rv-button" data-rv-action="export">Export</button></div>
${list.length?`<ul class="rv-list">${list.slice(0,filter.limit).map(c=>`<li data-paused="${c.paused}"><div><p>${M().isCloze(c.f)?fmt(c.f.replace(/\{\{([^{}]+)\}\}/g,'[$1]')):fmt(c.f)}</p>${c.b?`<p class="rv-sub">${fmt(c.b)}</p>`:''}<small style="--rv-course:${E(courseColor(c.c))}"><i></i>${E(courseName(c.c))}${c.two?' · two-way':''} · ${E(when(c))}</small></div>
<span class="rv-row-actions"><button type="button" class="rv-link" data-rv-action="edit-card" data-value="${E(c.id)}">Edit</button><button type="button" class="rv-link" data-rv-action="pause-card" data-value="${E(c.id)}">${c.paused?'Resume':'Pause'}</button><button type="button" class="rv-link rv-danger" data-rv-action="delete-card" data-value="${E(c.id)}">${confirmDelete===c.id?'Delete?':'Delete'}</button></span></li>`).join('')}</ul>${list.length>filter.limit?`<button type="button" class="rv-button" data-rv-action="more">Show more (${list.length-filter.limit})</button>`:''}`:`<p class="rv-sub">${d.cards.length?'No cards match.':'No cards yet.'}</p>`}`;
  }
  function settingsTab(d){
   return `<label class="rv-field rv-inline"><span>New cards a day</span><input type="number" data-rv-field="newPerDay" min="0" max="50" value="${d.settings.newPerDay}" data-rv-first></label>
<label class="rv-field rv-inline"><span>Reviews a day, at most</span><input type="number" data-rv-field="maxReviews" min="10" max="500" value="${d.settings.maxReviews}"></label>
<p class="rv-hint">Waits after Good: ${M().STEPS.join(', ')} days; Easy skips one, Again comes back tomorrow (and once more at the end of the session). When Canvas lists a test or quiz for a course in the next ${M().LIMITS.boostDays} days, that course's cards come first and none waits past the test day.</p>`;
  }
  function saveCard(){
   const problem=M().checkCard(draft.front,draft.back);if(problem){say(problem);return;}
   const day=today(),{front,back,course,two,src,edit}=draft;
   saveDeck(d=>{
    if(edit){const c=d.cards.find(x=>x.id===edit);if(c){c.f=front.trim();c.b=back.trim();c.c=course;c.two=two&&!M().isCloze(front)&&!!back.trim();if(c.two&&!c.s.b)c.s.b={box:0,due:'',lapses:0};if(!c.two)delete c.s.b;}return;}
    if(d.cards.length>=M().LIMITS.cards)return;
    const card=M().makeCard({front,back,course,twoWay:two,src,today:day});if(card)d.cards.push(card);
   }).then(ok=>{if(!ok){say('Not saved yet. Try again.');return;}
    const n=deck().cards.filter(c=>c.c===course).length;
    say(edit?'Saved.':`Added. ${n} ${n===1?'card':'cards'} in ${courseName(course)}.`);
    draft={...draft,front:'',back:'',edit:''};if(edit&&session)view='review';render();
   });
  }
  function addList(){
   const p=M().parseList(paste.text),day=today(),{course,two}=paste;if(!p.cards.length)return;
   const room=M().LIMITS.cards-deck().cards.length;
   saveDeck(d=>{for(const x of p.cards.slice(0,room)){const card=M().makeCard({front:x.front,back:x.back,course,twoWay:two,today:day});if(card)d.cards.push(card);}})
    .then(ok=>{if(!ok){say('Not saved yet. Try again.');return;}const added=Math.min(p.cards.length,room);say(`Added ${added} ${added===1?'card':'cards'} to ${courseName(course)}.${p.cards.length>room?' The deck is full.':''}`);paste.text='';render();});
  }
  function exportCards(){
   const d=deck(),list=d.cards.filter(c=>!filter.course||c.c===filter.course),blob=new Blob([M().exportText(list)],{type:'text/plain'});
   const a=doc.createElement('a');a.href=URL.createObjectURL(blob);a.download=`review-deck-${filter.course?courseName(filter.course).replace(/[^\w-]+/g,'-'):'all'}.txt`;node.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
   say(`Exported ${list.length} cards as a text file (front, a tab, back).`);
  }

  /* ---- events (the workspace passes them here first) ---- */
  function click(event){
   if(!node||!event.composedPath().includes(node))return false;
   const b=event.target.closest?.('[data-rv-action]');if(!b)return true;
   const a=b.dataset.rvAction,v=b.dataset.value;
   if(a==='close'){close();return true;}
   if(a==='reveal'&&session){session.revealed=true;render();return true;}
   if(a==='grade'){grade(v);return true;}
   if(a==='again-session'){open('review');return true;}
   if(a==='tab'){view='manage';tab=v;confirmDelete='';render();return true;}
   if(a==='save-card'){saveCard();return true;}
   if(a==='cancel-edit'){draft={...draft,front:'',back:'',edit:''};if(session&&!session.done)view='review';render();return true;}
   if(a==='drop-src'){draft.src=null;render();return true;}
   if(a==='add-list'){addList();return true;}
   if(a==='export'){exportCards();return true;}
   if(a==='more'){filter.limit+=100;render();return true;}
   if(a==='edit-card'){const c=deck().cards.find(x=>x.id===v);if(c){draft={front:c.f,back:c.b,course:c.c,two:c.two,src:c.src||null,edit:c.id};view='manage';tab='add';render();}return true;}
   if(a==='pause-card'){let paused=false;saveDeck(d=>{const c=d.cards.find(x=>x.id===v);if(c){c.paused=!c.paused;paused=c.paused;}}).then(()=>{say(paused?'Paused. It stays out of reviews until you resume it.':'Resumed.');if(session&&session.list[session.i]?.id===v&&paused){session.revealed=false;session.i++;if(session.i>=session.list.length)session.done=true;}render();});return true;}
   if(a==='delete-card'){if(confirmDelete!==v){confirmDelete=v;render();return true;}confirmDelete='';saveDeck(d=>{d.cards=d.cards.filter(c=>c.id!==v);}).then(()=>{say('Deleted.');render();});return true;}
   return true;
  }
  function input(event){
   if(!node||!event.composedPath().includes(node))return false;
   const t=event.target,f=t.dataset?.rvField;
   if(f==='front'){draft.front=t.value;const cloze=M().isCloze(t.value),box=node.querySelector('[data-rv-field="two"]');if(box&&box.disabled!==cloze){render();}}
   else if(f==='back')draft.back=t.value;
   else if(f==='paste'){paste.text=t.value.slice(0,200000);render();}
   else if(f==='filter-q'){filter.q=t.value;filter.limit=100;render();}
   return true;
  }
  function change(event){
   if(!node||!event.composedPath().includes(node))return false;
   const t=event.target,f=t.dataset?.rvField,n=Number(t.value);
   if(f==='course')draft.course=t.value;
   else if(f==='two')draft.two=t.checked;
   else if(f==='paste-course')paste.course=t.value;
   else if(f==='paste-two')paste.two=t.checked;
   else if(f==='filter-course'){filter.course=t.value;filter.limit=100;render();}
   else if(f==='newPerDay'||f==='maxReviews'){if(Number.isFinite(n))saveDeck(d=>{d.settings[f]=n;}).then(()=>{say('Saved.');render();});}
   return true;
  }
  function keydown(event){
   if(!node)return false;
   const target=event.composedPath?.()[0]||event.target,typing=/^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName||'');
   if(event.key==='Escape'){event.preventDefault();if(confirmDelete){confirmDelete='';render();}else close();return true;}
   if((event.metaKey||event.ctrlKey)&&event.key==='Enter'&&view==='manage'){event.preventDefault();if(tab==='add')saveCard();else if(tab==='paste')addList();return true;}
   if(view==='review'&&session&&!session.done&&!typing){
    if((event.key===' '||event.key==='Enter')&&!target?.closest?.('button')){event.preventDefault();if(!session.revealed){session.revealed=true;render();}else grade('good');return true;}
    if(session.revealed&&['1','2','3'].includes(event.key)){event.preventDefault();grade(session.list[session.i]?.practice?'good':['again','good','easy'][Number(event.key)-1]);return true;}
   }
   if(event.key==='Tab'){
    const items=[...node.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select,textarea')].filter(el=>el.getClientRects().length);
    if(items.length){const first=items[0],last=items[items.length-1],at=node.getRootNode().activeElement;
     if(event.shiftKey&&(at===first||!node.contains(at))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(at===last||!node.contains(at))){event.preventDefault();first.focus();}}
   }
   return true;   // the workspace's own shortcuts stay quiet while the deck is open
  }
  function sync(){paintCounts();if(node&&view==='manage'&&tab==='cards')render();}
  function destroy(){dead=true;close();clearTimeout(statusTimer);if(api.current===instance)api.current=null;}
  const instance={open,close,isOpen:()=>!!node,click,input,change,keydown,sync,destroy,moduleBody,todayLine,hubLink,courseButton,dueCount};
  api.current=instance;
  return instance;
 }
 const api={create,current:null};
 root.ReserveReviewDeck=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
