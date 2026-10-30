/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
// Adapted from Gary Wu's pull request #44 to Canvas Harness.
/* Canvas Harness Plus: the Review deck. One deck, two modes. On Home it is a module (small: what is due and the box to
   start with; medium: the boxes; large: study right there, one card at a time). Opened, the module grows into the
   reading room, a drawn room that fills the page: the boxes stand on the long table, the card is held up in the
   window's light and the done pile grows by the books. A session is one session in both modes, card for card, however
   often the module grows and folds back. The scheduling, the storage format and every refusal are Gary's
   (review-deck-model.js); the drawings are review-deck-art.js. Nothing here reads or writes Canvas. */
(function(root){
 'use strict';
 const M=root.ReserveReviewDeckModel||(typeof module==='object'&&module.exports?require('./review-deck-model.js'):null),PREFIX='review-deck-';
 const Art=()=>root.ReserveReviewDeckArt||null;
 const art=(name,...args)=>{try{const fn=Art()?.[name];return typeof fn==='function'?fn(...args)||'':'';}catch{return '';}};
 const E=value=>root.ReserveUI?.escapeHTML?root.ReserveUI.escapeHTML(value):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const copy=value=>JSON.parse(JSON.stringify(value)),courseId=value=>/^(?:\d{1,20}|personal)$/.test(String(value));
 const hex=value=>/^#[0-9a-f]{3,8}$/i.test(String(value||''))?String(value):'';
 const later=fn=>typeof root.queueMicrotask==='function'?root.queueMicrotask(fn):Promise.resolve().then(fn);
 function ownerKey(owner){
   try{
     const u=new URL(owner?.origin);
     return u.protocol==='https:'&&u.origin===owner.origin&&!u.username&&!u.password&&/^\d+$/.test(String(owner.accountId))?u.origin+'|'+owner.accountId:'';
   }catch{return '';}
 }
 const quizTaking=path=>/\/quizzes\/\d+\/(?:take|resume)(?:\/|$)/i.test(String(path))||/\/assessment_sessions(?:\/|$)/i.test(String(path));
 const GRADE_NAMES={again:'Again',good:'Good',easy:'Easy'};
 const SIZES=['s','m','l'];
 // The house curves (motion.js / refresh.css): settle for what arrives, letgo for what leaves, fade for opacity, pen
 // for a travel. A physical swing keeps a few per cent of overshoot; nothing else overshoots.
 const EZ=()=>root.ReserveMotion?.easings||{},
   SETTLE=()=>EZ().settle||'cubic-bezier(.2,.8,.2,1)',
   LETGO=()=>EZ().letgo||'cubic-bezier(.2,0,.4,1)',
   FADE=()=>EZ().fade||'cubic-bezier(.2,.65,.3,1)',
   PEN=()=>EZ().pen||'cubic-bezier(.45,.05,.25,1)';
 // A day as the student says it: today, tomorrow, a weekday this week, else the date.
 function dayWord(day,from){
  if(!M.validDay(day)||!M.validDay(from))return '';const n=Math.round((Date.parse(day+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000),d=new Date(day+'T12:00:00Z');
  if(n<=0)return 'today';if(n===1)return 'tomorrow';
  return n<7?d.toLocaleDateString('en-US',{weekday:'short',timeZone:'UTC'}):d.toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
 }
 function create({
   container,
   store,
   getContext,
   onChange=()=>{},
   isEnabled=()=>root.ReserveFeatures?.enabled('review-deck')===true,
   isSelected=()=>!!container?.querySelector?.('[data-review-deck]'),
   now=()=>Date.now(),
   getPath=()=>root.location?.pathname||'',
   onExport=null,
   onAuthError=()=>{},
   onRoom=null,
   onGrow=null
 }={}){
  if(!M||typeof store?.get!=='function'||typeof store?.update!=='function'||typeof getContext!=='function'||!ownerKey(store.owner))
    throw Error('Review deck needs a verified account store and dashboard context.');
  const owner=ownerKey(store.owner),editors=new Map(),urls=new Set();
  let openerKey='',
    rowMenu='',
    dead=false,
    invalid=false,
    busy=false,
    tab='cards',
    drawer=false,
    drawerOpener='',
    activeEditor='new',
    filter='all',
    query='',
    appliedQuery='',
    limit=100,
    confirmDelete='',
    session=null,
    big=null,
    bigFrom=null,
    status='',
    failed=false,
    quiet=false,
    fileSequence=0,
    importRevision=0;
  let paste={text:'',course:'personal',twoWay:false,format:'auto',preview:null},schedule=null;
  // The room and its motion. None of this is data: it is the drawn place, kept between renders, and what should move next.
  const doc=container?.ownerDocument||root.document,win=doc?.defaultView||root;
  let world=null,shownIn=null,lit='',queued=false,grow=null,fold=null,focusNext='',flights=[],moments=[],pageH=0,hadFocus=false;
  // One-shot moves for the next settled render: a box carried to the table's end, the card files pushed home, a card
  // put down after the pencil, the done pile carried to the middle.
  let opening=null,closing=null,putDown=false,doneFrom=null,turnFrom=null,leaving=null;
  const timers=new Set();
  function erase(){
    editors.clear();
    paste={text:'',course:'personal',twoWay:false,format:'auto',preview:null};
    session=null;
    schedule=null;
    drawer=false;
    query=appliedQuery='';
    status='';
    flights=[];
    moments=[];
    opening=closing=doneFrom=null;
    putDown=false;
  }
  function allowed(){
   if(dead||invalid||!isEnabled()||quizTaking(getPath()))return false;
   const c=context(),account=c.snapshot?.user?.id??c.user?.id??c.accountId,origin=c.snapshot?.origin??c.origin;
   if(ownerKey(store.owner)!==owner||account!==undefined&&String(account)!==String(store.owner.accountId)||origin!==undefined&&origin!==store.owner.origin){
     invalid=true;
     erase();
     try{onAuthError(Error('Your Canvas account changed. Reload Canvas.'));}catch{}
     return false;
   }
   return true;
  }
  // The dashboard's context is built once per synchronous run and kept until the next microtask: a render asks for
  // the time zone once per date and for the coming tests once per box, and each ask used to build the whole context
  // again (most of a render's time, and of the frame that starts each move).
  let held=null;
  const context=()=>{if(!held){held=getContext()||{};later(()=>{held=null;});}return held;},settings=()=>context().s||context().settings||{};
  function dayOf(value){
    if(root.ReserveCore?.dayKey)return root.ReserveCore.dayKey(value,settings().timeZone||'America/New_York');
    const d=new Date(value);
    if(!Number.isFinite(d.getTime()))return '';
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:settings().timeZone||'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d),
      part=type=>parts.find(p=>p.type===type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
  const today=()=>dayOf(now()),deck=()=>M.cleanDeck(store.get()?.settings?.reviewDecks),tests=day=>M.testsAhead(context().items||[],day,dayOf);
  const courses=()=>{
    const map=new Map((context().courses||[]).filter(c=>courseId(c.id)).map(c=>[String(c.id),String(c.shortName||c.name||c.id)]));
    map.set('personal','Personal');
    return map;
  };
  const courseName=id=>courses().get(String(id))||'Course '+id;
  const courseColor=id=>hex((context().courses||[]).find(c=>String(c.id)===String(id))?.color)||'';
  function changed(){if(!dead&&!invalid)try{onChange();}catch{}}
  // Big card: the card comes to the middle of the room and takes most of it, for a small screen or for reading closely.
  // The choice is kept with the deck (settings.bigCard); a press changes it at once and the save follows quietly.
  const bigOn=()=>big??deck().settings?.bigCard===true;
  function rememberBig(on){
    quietSave=true;
    Promise.resolve().then(()=>store.update(data=>{
      if(!allowed())return;
      const next=M.cleanDeck(data.settings?.reviewDecks);
      if(on)next.settings.bigCard=true;else delete next.settings.bigCard;
      data.settings||={};
      data.settings.reviewDecks=M.cleanDeck(next);
    })).catch(()=>{}).finally(()=>{
      quietSave=false;
    });
  }
  function say(value,error=false,hush=false){
    status=value;
    failed=error;
    quiet=hush&&!error;
    for(const node of container?.querySelectorAll?.('[data-review-deck-status]')||[]){
      node.textContent=value;
      node.setAttribute('role',error?'alert':'status');
      if(quiet)node.setAttribute('data-quiet','');else node.removeAttribute('data-quiet');
    }
  }
  function editor(){
    if(!editors.has(activeEditor))editors.set(activeEditor,{edit:'',front:'',back:'',course:filter==='all'?'personal':filter,twoWay:false,base:'',revision:0});
    return editors.get(activeEditor);
  }
  const fmt=value=>{const t=String(value??'');return (root.ReserveMath?.hasMath?.(t)&&root.ReserveMath?.renderText?root.ReserveMath.renderText(t):E(t)).replace(/\n/g,'<br>');};
  // Motion follows the dashboard's Motion setting, the "Living drawings & motion" feature and the system's reduced motion.
  function motion(){
    const ds=container?.dataset||{},style=ds.motionStyle;
    if(style==='off'||ds.featureMotion==='off'||win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)return 'off';
    return style==='still'?'still':'gentle';
  }
  function animate(node,frames,options){if(!node||typeof node.animate!=='function'||motion()==='off')return null;try{return node.animate(frames,options);}catch{return null;}}
  function wait(ms,fn){if(!win?.setTimeout)return;const t=win.setTimeout(()=>{timers.delete(t);if(!dead)fn();},ms);timers.add(t);}

  /* ---------- the controls: drawn frames with a name, nothing more ---------- */
  const frame=(kind,salt=0,vw)=>art('frame',kind,salt,vw);
  // a label tag's frame in drawing units (40 to its height): the hole, the words and a little paper past them
  const tagUnits=(label,{px=7.7,pad=42,min=0,h=30}={})=>Math.round(Math.max(min,pad+String(label).length*px)/(h/40));
  const keycap=k=>`<kbd class="rv-key" aria-hidden="true">${art('key',k.charCodeAt(0))}<span>${E(k)}</span></kbd>`;
  // Biscuit's list of controls (scripts/biscuit-control-inventory.cjs) reads each control from this source: a btn(...)
  // call by its action and words, any other button by the action and name written in it. tag() puts the shared markup
  // together, so the helper itself is not read as one more, nameless control.
  const tag=(name,attrs,inner)=>`<${name} ${attrs}>${inner}</${name}>`;
  function btn(name,label,{extra='',kind='paper',cls='',key='',salt=0}={}){return tag('button',`type="button" class="rv-btn rv-btn-${kind}${cls?' '+cls:''}" data-rd-action="${PREFIX+name}" ${extra}${busy?' disabled':''}`,`${frame(kind,salt)}<span>${E(label)}</span>${key?keycap(key):''}`);}
  // A field is a paper slip with its words written on it (no boxed form control): the slip is drawn, a choice carries a
  // small drawn caret, and the file button is a tag on the slip.
  const CARET='<svg class="rv-caret" viewBox="0 0 14 10" aria-hidden="true" focusable="false"><path d="M1.6 2.4Q4.4 5.2 7.1 8.1Q9.8 5.1 12.5 2.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const field=(name,label,control)=>{
    const html=control(name),choice=/^s*<select/.test(html);
    let salt=0;
    for(const ch of name)salt=(salt*31+ch.charCodeAt(0))%97;
    return `<label class="rv-field"><span>${E(label)}</span><span class="rv-slip${choice?' rv-slip-choice':''}">${frame('paper',120+salt%9)}${html}${choice?CARET:''}</span></label>`;
  };
  function courseSelect(name,value,all=false){
    const list=courses();
    if(value!=='all'&&!list.has(value)&&courseId(value))list.set(value,courseName(value));
    return `<select data-rd-field="${PREFIX+name}" aria-label="${name==='course'?'Course filter':'Course'}">${all?`<option value="all"${value==='all'?' selected':''}>All courses</option>`:''}${[...list].map(([id,label])=>`<option value="${E(id)}"${value===id?' selected':''}>${E(label)}</option>`).join('')}</select>`;
  }
  // While a save is under way the deck takes no other action (busy). The held look of the controls is drawn only when a
  // save takes a while: a render of its own was a second whole-page render, the long first frame of every grade; a
  // quick save renders once, when it is done.
  let slowSave=0,quietSave=false;
  // the held look on the controls that are on show (the same attributes a busy render writes), with no render; the
  // render or room redraw after the save takes them off again
  function holdLook(){
    try{
      const scopes=[...(container?.querySelectorAll?.('[data-review-deck],[data-rv-mod]')||[])];
      if(!scopes.length)return false;
      for(const scope of scopes){scope.setAttribute('aria-busy','true');for(const b of scope.querySelectorAll('button[data-rd-action^="review-deck-"]'))b.disabled=true;}
      return true;
    }catch{return false;}
  }
  async function transact(mutator,after,{here=false}={}){
   if(busy||!allowed())return false;busy=true;say('');
   if(win?.setTimeout){slowSave=win.setTimeout(()=>{slowSave=0;if(busy&&!dead&&!holdLook())changed();},180);}else changed();let expected;
   // (a save the room will draw itself asks the dashboard, once, not to redraw the page for it: takeQuietSave)
   quietSave=here;
   try{
     await store.update(data=>{
       if(!allowed())throw Error('Your Canvas account changed. Reload Canvas.');
       const next=M.cleanDeck(data.settings?.reviewDecks);
       mutator(next);
       expected=M.cleanDeck(next);
       data.settings||={};
       data.settings.reviewDecks=expected;
     });
    if(!allowed())return false;
    if(!expected||JSON.stringify(deck())!==JSON.stringify(expected))throw Error('The saved review deck could not be confirmed. Your text is kept here.');
    after?.(expected);
    return true;
   }catch(error){if(allowed())say('Could not save: '+(error?.message||'Storage is unavailable.'),true);return false;}finally{
     quietSave=false;
     busy=false;
     if(slowSave){win?.clearTimeout?.(slowSave);slowSave=0;}
     if(!(here&&!failed&&renderHere()))changed();
   }
  }

  /* ---------- the session ---------- */
  const current=()=>session&&session.index<session.list.length?session.list[session.index]:null;
  const finished=()=>!!session&&session.index>=session.list.length;
  const live=()=>!!session&&!session.away;
  const reviewVersion=(card,side)=>
    JSON.stringify({c:card.c,f:card.f,b:card.b,two:card.two,paused:card.paused,s:card.s[side],forwardFirst:side==='b'?card.s.f.first:''});
  const inSession=id=>!!session&&!finished()&&session.list.some((e,i)=>i>=session.index&&e.id===id);
  function start(course=filter){
   const c=course==='all'||courseId(course)?String(course):filter,d=deck(),day=today(),list=M.queue(d,day,{tests:tests(day),course:c});
   session={day,course:c,list:list.map(item=>{
     const card=d.cards.find(x=>x.id===item.id);
     return {...item,base:reviewVersion(card,item.side)};
   }),index:0,revealed:false,peek:false,count:0,done:0,repeated:[],away:false,editing:null,started:now(),arrive:0};
   drawer=false;say('');moment('dust');
  }
  // A course's first test inside the boost window, if the session is for it.
  function firstTest(d,day){
    const boost=M.activeTests(d,day,tests(day)),ids=session&&session.course!=='all'?[session.course]:Object.keys(boost);
    const days=ids.map(id=>boost[id]).filter(Boolean).sort();
    return days[0]||'';
  }
  const sessionName=()=>!session?'Review':session.course==='all'?'All courses':courseName(session.course);

  /* ---------- the boxes: one per course with cards, and the Personal box ---------- */
  function boxes(d,day,sum){
   const boost=M.activeTests(d,day,tests(day)),out=new Map(),mk=id=>({id,counts:[0,0,0,0,0,0,0,0],cards:0});
   for(const card of d.cards){
     if(!out.has(card.c))out.set(card.c,mk(card.c));
     const b=out.get(card.c);
     b.cards++;
     for(const side of card.two?['f','b']:['f'])b.counts[Math.min(7,card.s[side]?.box||0)]++;
   }
   if(!out.has('personal'))out.set('personal',mk('personal'));
   const order=[...courses().keys()];
   return [...out.values()].map(b=>
     ({
       ...b,
       name:courseName(b.id),
       color:courseColor(b.id),
       due:sum.courses[b.id]?.due||0,
       test:boost[b.id]||'',
       sticker:b.cards>0&&!(sum.courses[b.id]?.due)&&sum.today.reviewed>0
     }))
    .sort((a,b)=>(a.id==='personal')-(b.id==='personal')||b.due-a.due||(a.test||'9').localeCompare(b.test||'9')||order.indexOf(a.id)-order.indexOf(b.id));
  }
  // A course's box is named "Course box"; which course it is, what is due and when its test is are read out from the
  // hidden line beside it (the course rail's pattern). A box with cards due studies them; one with nothing due opens its
  // cards: in the room the drawer comes out; from any module the room grows first.
  function boxButton(b,i,day,{open=false,here=false}={}){
   const id=E(b.id),say=`rv-box-say-${open||here?'mod':'room'}-${id}`;
   const look=`style="--i:${i}${b.color?`;--rv-course:${E(b.color)}`:''}" aria-describedby="${say}"${busy?' disabled':''}`;
   const inner=`<span class="rv-box-art" aria-hidden="true">${art('cardBox',b.counts,{sticker:b.sticker,salt:i%5})}</span><span class="rv-box-name" data-len="${b.name.length>17?'xl':b.name.length>13?'l':b.name.length>9?'m':'s'}" aria-hidden="true">${E(b.name)}</span>${b.due?`<span class="rv-badge" aria-hidden="true">${art('seal',i)}<b>${b.due}</b></span>`:''}${b.test?`<span class="rv-testtag" aria-hidden="true">${frame('tag',i+1)}<span>Test ${E(dayWord(b.test,day))}</span></span>`:''}`;
   const line=`<span id="${say}" hidden>${E(`${b.name}: ${b.due?b.due+' due':b.cards?'nothing due':'no cards'}${b.test?', test '+dayWord(b.test,day):''}`)}</span>`;
   if(b.due&&open)return `<button type="button" class="rv-box" data-rd-key="rv-box-${id}" data-rd-action="review-deck-open" data-start="${id}" aria-label="Course box" ${look}>${inner}</button>${line}`;
   if(b.due)return `<button type="button" class="rv-box" data-rd-key="rv-box-${id}" data-rd-action="review-deck-start" data-course="${id}"${here?' data-here="true"':''} aria-label="Course box" ${look}>${inner}</button>${line}`;
   if(open||here)return `<button type="button" class="rv-box" data-rd-key="rv-box-${id}" data-rd-action="review-deck-open" data-open="cards" data-course="${id}" aria-label="Course box" ${look}>${inner}</button>${line}`;
   return `<button type="button" class="rv-box" data-rd-key="rv-box-${id}" data-rd-action="review-deck-tab" data-tab="cards" data-course="${id}" data-rv-opener="box-${id}" aria-label="Course box" ${look}>${inner}</button>${line}`;
  }
  // The next seven days as dots, today first; a dot's size is how much falls due that day.
  function weekDots(sum){
    const counts=[sum.due,...sum.ahead.slice(0,6).map(e=>e.n)],max=Math.max(1,...counts);
    return `<span class="rv-dots" role="img" aria-label="Due over the next 7 days: ${counts.join(', ')}">${counts.map((n,i)=>`<i class="rv-dot" data-today="${i===0}" data-none="${!n}" style="--rv-r:${(3+Math.sqrt(n/max)*4.4).toFixed(1)}">${art('dot',5,i)}</i>`).join('')}</span>`;
  }
  function newSlot(){return `<button type="button" class="rv-newcard" data-rd-key="rv-newcard" data-rd-action="review-deck-new" data-rv-opener="new"${busy?' disabled':''}><span class="rv-newcard-art" aria-hidden="true">${art('newCard')}</span><span class="rv-newcard-name">New card</span></button>`;}
  const sideBox=(d,day,sum,{sticker=false}={})=>{
    const all=boxes(d,day,sum),id=session?.course==='all'?(all[0]?.id||'personal'):session?.course;
    const b=all.find(x=>x.id===id)||{id,counts:[0,0,0,0,0,0,0,0],name:sessionName(),color:''};
    return {...b,name:session?.course==='all'?'All':b.name,sticker};
  };

  /* ---------- the card: question on the front, the answer only once it is turned ---------- */
  function bigButton(){const on=bigOn();return `<button type="button" class="rv-pencil rv-bigbtn" data-rd-key="rv-big" data-rd-action="review-deck-big" aria-pressed="${on}" aria-keyshortcuts="B"${busy?' disabled':''}><span class="rv-big-art" aria-hidden="true">${art('bigCard',on)}</span><span>Big card</span></button>`;}
  function cardBlock(d,day,where){
   const s=session,item=current();if(!item)return '';
   const card=d.cards.find(c=>c.id===item.id);
   if(!card||card.paused||!card.s[item.side])return `<div class="rv-cardzone" data-rd-key="rv-zone-${where}-${s.index}"><p class="rv-gone" role="status">This card is unavailable.</p>${btn('skip','Next card')}</div>`;
   const editing=s.editing===card.id,cloze=M.isCloze(card.f)&&item.side==='f';
   const question=shown=>
     cloze?
       M.clozeParts(card.f).map(p=>p.hidden!==undefined?shown?`<mark>${fmt(p.hidden)}</mark>`:'<span class="rv-blank" aria-label="blank">[…]</span>':fmt(p.text)).join(''):
       fmt(item.side==='b'?card.b:card.f);
   const answer=cloze?card.b:item.side==='b'?card.f:card.b,len=t=>{
     const n=String(t||'').length;
     return n>160?'l':n>60?'m':'s';
   },qLen=len(item.side==='b'?card.b:card.f),side=editing?'edit':s.revealed&&!s.peek?'back':'front';
   const tilt=[-1.1,.8,-.5,1.2,-.8,.4][s.index%6],arrive=s.arrive===s.index&&!grow&&!fold?'deal':'rest';
   // The card is named by what pressing it does; the face on show (the question, or the question and its answer) is
   // read out as its description.
   const faces=`<span class="rv-card-in"><span id="rv-face-${where}-f" class="rv-face rv-front"${side==='back'?' aria-hidden="true"':''}>${art('cardFace','front',s.index%3)}<span class="rv-q rd-rich-text" data-len="${qLen}">${question(false)}</span><small class="rv-side">${item.practice?'once more':item.side==='b'?'back first':'front'}</small></span><span id="rv-face-${where}-b" class="rv-face rv-back"${side==='back'?'':' aria-hidden="true"'}>${art('cardFace','back',s.index%3)}${s.revealed?`<span class="rv-q2 rd-rich-text">${question(true)}</span>${answer?`<span class="rv-a rd-rich-text" data-len="${len(answer)}">${fmt(answer)}</span>`:''}`:''}</span></span>`;
   const shown=`aria-describedby="rv-face-${where}-${side==='back'?'b':'f'}" aria-keyshortcuts="Space"${busy?' disabled':''}`;
   const face=editing?editFace(card):s.revealed?`<button type="button" class="rv-card" data-rd-key="rv-cardbtn" data-rd-action="review-deck-turn" aria-label="Turn the card" ${shown}>${faces}</button>`
    :`<button type="button" class="rv-card" data-rd-key="rv-cardbtn" data-rd-action="review-deck-reveal" aria-label="Show answer" ${shown}>${faces}</button>`;
   const dates=!item.practice&&s.revealed?M.preview(d,card.id,item.side,day,{tests:tests(day)}):null,up=s.revealed&&!editing;
   const next=g=>dates?.[g]?` aria-label="${GRADE_NAMES[g]}, next ${E(dayWord(dates[g],day))}"`:'';
   const grades=item.practice?`<button type="button" class="rv-btn rv-btn-good rv-grade" data-rd-action="review-deck-grade" data-grade="good" aria-keyshortcuts="2" style="--k:1"${busy?' disabled':''}>${frame('good',2)}<span>Next</span>${keycap('2')}</button>`
    :`<button type="button" class="rv-btn rv-btn-again rv-grade" data-rd-action="review-deck-grade" data-grade="again" aria-keyshortcuts="1" style="--k:0"${next('again')}${busy?' disabled':''}>${frame('again',1)}<span>Again</span>${keycap('1')}</button>`
     +`<button type="button" class="rv-btn rv-btn-good rv-grade" data-rd-action="review-deck-grade" data-grade="good" aria-keyshortcuts="2" style="--k:1"${next('good')}${busy?' disabled':''}>${frame('good',2)}<span>Good</span>${keycap('2')}</button>`
     +`<button type="button" class="rv-btn rv-btn-easy rv-grade" data-rd-action="review-deck-grade" data-grade="easy" aria-keyshortcuts="3" style="--k:2"${next('easy')}${busy?' disabled':''}>${frame('easy',3)}<span>Easy</span>${keycap('3')}</button>`;
   return `<div class="rv-cardwrap" data-rd-key="rv-card-${where}-${s.index}" data-side="${side}" data-peek="${!!s.peek&&s.revealed&&!editing}" data-arrive="${arrive}" style="--rv-tilt:${tilt}deg"><span class="rv-card-shadow" aria-hidden="true">${art('shadow')}</span>${face}</div>
<div class="rv-under" data-rd-key="rv-under-${where}"><div class="rv-grades" data-rd-key="rv-grades" data-up="${up}"${up?'':' inert aria-hidden="true"'}>${grades}</div>${editing?'':`<button type="button" class="rv-pencil" data-rd-key="rv-pencil" data-rd-action="review-deck-edit" data-id="${E(card.id)}" data-session="true" aria-keyshortcuts="E"${busy?' disabled':''}><span class="rv-pencil-art" aria-hidden="true">${art('pencil')}</span><span>Edit</span></button>`}${where==='page'&&!editing?bigButton():''}</div>`;
  }
  // Editing mid-session: the card itself lifts and takes the pencil; the session waits on it.
  function editFace(card){
    const ed=editors.get(card.id)||{front:card.f,back:card.b};
    return `<div class="rv-card rv-card-edit" data-rd-key="rv-cardedit" role="group" aria-label="Edit this card"><span class="rv-face rv-editface">${art('cardFace','front',7)}<span class="rv-editpencil" aria-hidden="true">${art('pencil')}</span><label class="rv-ef"><span>Front</span><textarea data-rd-field="${PREFIX}front" rows="3" spellcheck="true">${E(ed.front)}</textarea></label><label class="rv-ef"><span>Back</span><textarea data-rd-field="${PREFIX}back" rows="3" spellcheck="true">${E(ed.back)}</textarea></label></span></div><div class="rv-editbar" data-rd-key="rv-editbar">${btn('save','Save',{kind:'clay'})}${btn('edit-cancel','Cancel')}</div>`;
  }
  const pileBlock=(kind,n,label,extra='')=>`<div class="rv-pile rv-pile-${kind}" data-rd-key="rv-pile-${kind}" data-n="${n}"${extra}><span class="rv-pile-art" aria-hidden="true">${art('pile',Math.min(9,n),{salt:kind==='done'?0:5})}</span><span class="rv-pile-n">${E(label)}</span></div>`;
  function doneCard(sum){
    const s=session,mins=Math.max(1,Math.round((now()-(s.started||now()))/60000));
    return `<div class="rv-donecard" data-rd-key="rv-donecard"><span class="rv-donestack" aria-hidden="true">${art('pile',9,{salt:3})}</span><span class="rv-doneface">${art('cardFace','back',4)}<strong>Done</strong><span>${s.count} card${s.count===1?'':'s'} · ${mins} min</span><span>${sum.streak>1?`${sum.streak}-day streak`:'first day of a streak'}</span></span></div>`;
  }

  /* ---------- the drawer: every card, adding, importing and the schedule (the cabinet's catalogue drawer) ---------- */
  // The courses as small kraft tabs along the drawer's top: one press shows that course's cards.
  function courseTabs(){const list=[['all','All'],...courses()];return `<div class="rv-ctabs" role="group" aria-label="Course filter">${list.map(([id,label],i)=>tag('button',`type="button" class="rv-ctab" data-rd-key="rv-ctab-${E(String(id).replace(/[^\w-]/g,''))}" data-rd-action="review-deck-filter" data-course="${E(id)}" aria-pressed="${filter===String(id)}"${busy?' disabled':''}`,`${frame('tag',40+i,tagUnits(label))}<span>${E(label)}</span>`)).join('')}</div>`;}
  const LENS='<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 4.1c3.5-.3 6.2 2.4 6 5.9-.1 3.3-2.8 5.9-6.1 5.8-3.3-.1-5.8-2.7-5.6-6 .1-3.1 2.6-5.6 5.7-5.7zM14.9 15.1l5 4.8"/></svg>';
  function listView(d,day){
   const q=appliedQuery.trim().toLowerCase(),
     list=d.cards.filter(c=>(filter==='all'||c.c===filter)&&(!q||(c.f+' '+c.b).toLowerCase().includes(q))),
     ready=new Set(M.queue(d,day,{tests:tests(day),course:filter}).map(e=>e.id));
   const row=(c,i)=>{const id=E(c.id),open=rowMenu===c.id;return `<li class="rv-row" data-rd-key="review-card-${id}" style="${courseColor(c.c)?`--rv-course:${E(courseColor(c.c))}`:''}"><span class="rv-row-card" aria-hidden="true">${frame('paper',60+i%7)}</span><div class="rv-row-f rd-rich-text">${fmt(c.f)}</div>${c.b?`<div class="rv-row-b rd-rich-text">${fmt(c.b)}</div>`:''}<p class="rv-row-meta">${E(courseName(c.c))} · ${c.paused?'Paused':ready.has(c.id)?'Due':c.s.f.box?'Due '+E(dayWord(c.s.f.due,day)||c.s.f.due):'New'}${c.two?' · Two-way':''}</p><div class="rv-row-act">`
    +tag('button',`type="button" class="rv-rowpencil" data-rd-key="rv-rowpencil-${id}" data-rd-action="review-deck-edit" data-id="${id}" aria-label="Edit card"${busy?' disabled':''}`,`<span class="rv-pencil-art" aria-hidden="true">${art('pencil')}</span>`)
    +tag('button',`type="button" class="rv-rowtag" data-rd-key="rv-rowtag-${id}" data-rd-action="review-deck-rowmenu" data-id="${id}" aria-expanded="${open}" aria-label="More for this card"${busy?' disabled':''}`,`${frame('tag',70+i%5)}<span aria-hidden="true">···</span>`)
    +(open?`<div class="rv-rowmenu" data-rd-key="rv-rowmenu">${btn('pause',c.paused?'Resume':'Pause',{extra:`data-id="${id}"`,kind:'slip'})}${btn('delete',confirmDelete===c.id?'Delete?':'Delete',{extra:`data-id="${id}"`,kind:confirmDelete===c.id?'again':'slip'})}</div>`:'')+`</div></li>`;};
   // the search is one paper slip with its magnifier drawn at its right end
   return `<div class="rv-listbar"><div class="rv-search"><span class="rv-search-art" aria-hidden="true">${frame('paper',31)}</span><input type="search" data-rd-field="${PREFIX}query" aria-label="Search cards" placeholder="Search cards" value="${E(query)}">`
    +tag('button',`type="button" class="rv-searchgo" data-rd-key="rv-searchgo" data-rd-action="review-deck-search" aria-label="Search"${busy?' disabled':''}`,LENS)+`</div></div>`
    +(list.length?`<ul class="rv-list">${list.slice(0,limit).map(row).join('')}</ul>${list.length>limit?btn('more','Show more'):''}`:'<p class="rv-empty">No cards.</p>');
  }
  function editorView(){const d=editor(),cloze=M.isCloze(d.front);return `<div class="rv-editor">${field('editor-course','Course',name=>courseSelect(name,d.course))}${field('front','Front',name=>`<textarea data-rd-field="${PREFIX+name}" rows="4">${E(d.front)}</textarea>`)}${field('back','Back',name=>`<textarea data-rd-field="${PREFIX+name}" rows="4">${E(d.back)}</textarea>`)}<label class="rv-check"><input type="checkbox" data-rd-field="${PREFIX}two-way"${d.twoWay&&!cloze?' checked':''}${cloze?' disabled':''}><span>Two-way</span></label><div class="rv-actions">${btn('save',d.edit?'Save changes':'Add card',{kind:'clay'})}${d.edit?btn('new','New card'):''}</div></div>`;}
  function previewView(p){if(!p)return '';return `<div class="rv-preview" data-review-deck-preview>${p.problems.length?`<ul role="alert">${p.problems.map(e=>`<li>Line ${e.line}: ${E(e.message)}</li>`).join('')}</ul>`:`<p role="status">${p.cards.length} cards</p><ul>${p.cards.slice(0,5).map(c=>`<li>${E(c.front)}${c.back?' · '+E(c.back):''}</li>`).join('')}</ul>`}</div>`;}
  function importView(){return `<div class="rv-editor">${field('import-course','Course',name=>courseSelect(name,paste.course))}${field('import-format','Format',name=>`<select data-rd-field="${PREFIX+name}">${[['auto','Auto'],['text','Plain text'],['csv','CSV'],['tsv','TSV']].map(([key,label])=>`<option value="${key}"${paste.format===key?' selected':''}>${label}</option>`).join('')}</select>`)}${field('import-text','Cards',name=>`<textarea data-rd-field="${PREFIX+name}" rows="8">${E(paste.text)}</textarea>`)}${field('file','Text file',name=>`<input type="file" data-rd-field="${PREFIX+name}" accept=".txt,.csv,.tsv,text/plain,text/csv,text/tab-separated-values">`)}<label class="rv-check"><input type="checkbox" data-rd-field="${PREFIX}import-two-way"${paste.twoWay?' checked':''}><span>Two-way</span></label>${previewView(paste.preview)}<div class="rv-actions">${btn('preview','Preview')}${btn('import','Import cards',{kind:'clay'})}</div><div class="rv-actions rv-export">${btn('export','Export cards')}</div></div>`;}
  function scheduleView(d){
    if(!schedule)schedule={...d.settings,course:filter==='all'?'personal':filter,date:d.testDates[filter==='all'?'personal':filter]||'',revision:0};
    return `<div class="rv-editor rv-schedule"><div class="rv-pair">${field('new-per-day','New cards per day',name=>`<input type="number" min="0" max="50" data-rd-field="${PREFIX+name}" value="${E(schedule.newPerDay)}">`)}${field('max-reviews','Reviews per day',name=>`<input type="number" min="10" max="500" data-rd-field="${PREFIX+name}" value="${E(schedule.maxReviews)}">`)}</div><div class="rv-actions">${btn('save-limits','Save daily limits')}</div><div class="rv-pair">${field('test-course','Course',name=>courseSelect(name,schedule.course))}${field('test-date','Test date',name=>`<input type="date" data-rd-field="${PREFIX+name}" value="${E(schedule.date)}">`)}</div><div class="rv-actions">${btn('save-date','Save test date')}${btn('clear-date','Clear test date')}</div></div>`;
  }
  function drawerView(d,day){
   const at=key=>`aria-controls="review-deck-panel" aria-selected="${tab===key}" tabindex="${tab===key?0:-1}"`;
   return `<div class="rv-drawer" data-rd-key="rv-drawer" role="region" aria-label="Card files"><span class="rv-drawer-art" aria-hidden="true">${art('drawer')}</span><span class="rv-drawer-front" aria-hidden="true">${art('drawerFront')}<span class="rv-drawer-label">Cards</span></span><div class="rv-drawer-in"><div class="rv-drawer-top">${courseTabs()}${btn('drawer-close','Close',{extra:'aria-keyshortcuts="Escape"'})}</div><nav class="rv-tabs" role="tablist" aria-label="Card files"><button type="button" class="rv-tab" role="tab" data-rd-action="review-deck-tab" data-tab="cards" id="review-deck-tab-cards" ${at('cards')}>${frame('tag',20,tagUnits('Cards',{px:7.4,pad:34,min:94,h:34}))}<span>Cards</span></button><button type="button" class="rv-tab" role="tab" data-rd-action="review-deck-tab" data-tab="add" id="review-deck-tab-add" ${at('add')}>${frame('tag',21,tagUnits(editor().edit?'Edit card':'Add card',{px:7.4,pad:34,min:94,h:34}))}<span>${editor().edit?'Edit card':'Add card'}</span></button><button type="button" class="rv-tab" role="tab" data-rd-action="review-deck-tab" data-tab="import" id="review-deck-tab-import" ${at('import')}>${frame('tag',22,tagUnits('Import',{px:7.4,pad:34,min:94,h:34}))}<span>Import</span></button><button type="button" class="rv-tab" role="tab" data-rd-action="review-deck-tab" data-tab="settings" id="review-deck-tab-settings" ${at('settings')}>${frame('tag',23,tagUnits('Schedule',{px:7.4,pad:34,min:94,h:34}))}<span>Schedule</span></button></nav><div id="review-deck-panel" class="rv-panel" role="tabpanel" aria-labelledby="review-deck-tab-${tab}" data-rd-key="review-deck-panel-${tab}">${tab==='add'?editorView():tab==='import'?importView():tab==='settings'?scheduleView(d):listView(d,day)}</div></div></div>`;
  }
  const statusLine=()=>`<p class="rv-status" data-review-deck-status role="${failed?'alert':'status'}"${quiet?' data-quiet':''}>${E(status)}</p>`;

  /* ---------- the full page: the reading room ---------- */
  function pageMode(){return live()?finished()?'done':'study':'home';}
  function renderReviewDeck(){
   if(!allowed())return '';try{
    const d=deck(),day=today(),sum=M.stats(d,day,{tests:tests(day)}),mode=pageMode(),s=session;let head,body;
    const foldBtn=`<button type="button" class="rv-fold" data-rd-key="rv-fold" data-rd-action="review-deck-fold" data-rv-fold aria-label="Back to Home" aria-keyshortcuts="Escape">${frame('paper',9)}${art('arrows',false)}</button>${goButton('work')}`;
    if(mode==='home'){
     // A count rides in a <small>: read out with the name, but not a part of it.
     const list=boxes(d,day,sum),primary=s&&!finished()?`<button type="button" class="rv-btn rv-btn-clay rv-primary" data-rd-key="rv-primary" data-rd-action="review-deck-resume"${busy?' disabled':''}>${frame('clay')}<span>Carry on<small class="rv-n"> · ${s.list.length-s.index} left</small></span></button>`:sum.due?`<button type="button" class="rv-btn rv-btn-clay rv-primary" data-rd-key="rv-primary" data-rd-action="review-deck-start" data-course="all"${busy?' disabled':''}>${frame('clay')}<span>Study all<small class="rv-n"> · ${sum.due}</small></span></button>`:'';
     head=`<header class="rv-head" data-rd-key="rv-head"><h2 class="rv-title">Review</h2><p class="rv-sub">${sum.due?`${sum.due} due today · ${sum.minutes} min`:sum.total?'Nothing due today':'No cards yet'}</p>${weekDots(sum)}</header><div class="rv-corner" data-rd-key="rv-corner">${primary}${foldBtn}</div>`;
     // Up to four boxes stand in one row with the new-card stack at its end; more courses stand behind, on a low step.
     const two=list.length>4,front=two?list.slice(0,3):list,back=two?list.slice(3):[];
     body=`<button type="button" class="rv-cabtag" data-rd-key="rv-cabtag" data-rd-action="review-deck-tab" data-tab="cards" data-rv-opener="cabinet" aria-expanded="${drawer}"${busy?' disabled':''}>${frame('tag',3)}<span>Cards</span><small>${d.cards.length}</small></button><div class="rv-boxes" data-rd-key="rv-boxes" data-n="${list.length}" data-rows="${two?2:1}"><div class="rv-tier rv-tier-front" data-rd-key="rv-tier-front">${front.map((b,i)=>boxButton(b,i,day)).join('')}${newSlot()}</div>${two?`<div class="rv-tier rv-tier-back" data-rd-key="rv-tier-back"><span class="rv-riser" aria-hidden="true">${art('riser',back.length)}</span>${back.map((b,i)=>boxButton(b,i+3,day)).join('')}</div>`:''}</div>`;
    }else{
     const left=Math.max(0,s.list.length-s.index),test=firstTest(d,day),b=sideBox(d,day,sum,{sticker:mode==='done'});
     head=`<header class="rv-head" data-rd-key="rv-head"><h2 class="rv-title">${E(sessionName())}</h2><p class="rv-sub">${mode==='done'?'done for today':`${left} to go${test?` · test ${E(dayWord(test,day))} first`:''}`}</p></header><div class="rv-corner" data-rd-key="rv-corner">${foldBtn}</div>`;
     // "leave" also ends a finished session, exactly as "finish" does.
     const box=`<button type="button" class="rv-sidebox" data-rd-key="rv-sidebox" data-rd-action="review-deck-leave" aria-label="Back to boxes" style="${b.color?`--rv-course:${E(b.color)}`:''}"${busy?' disabled':''}><span class="rv-box-art" aria-hidden="true">${art('cardBox',b.counts,{sticker:b.sticker,salt:2})}</span><span class="rv-box-name" data-len="${b.name.length>17?'xl':b.name.length>13?'l':b.name.length>9?'m':'s'}" aria-hidden="true">${E(b.name)}</span>${mode==='done'?`<span class="rv-sticker" aria-hidden="true">${art('star',2)}</span>`:''}</button>`;
     body=mode==='done'?`<div class="rv-done" data-rd-key="rv-done">${box}${doneCard(sum)}<div class="rv-under" data-rd-key="rv-under-done">${btn('finish','Back to boxes',{extra:'data-rd-key="rv-finish"'})}</div></div>`
      :`<div class="rv-study" data-rd-key="rv-study"><span class="rv-veil" data-rd-key="rv-veil" aria-hidden="true"></span>${box}${cardBlock(d,day,'page')}${pileBlock('done',s.done,`done ${s.done}`)}</div>`;
    }
    schedulePaint();
    return `<section class="rv rv-room" data-review-deck data-rd-key="review-deck" aria-label="Review deck" aria-busy="${busy}" data-rv-mode="${mode}" data-rv-big="${mode==='study'&&bigOn()}" data-rv-drawer="${drawer}"${pageH?` style="--rv-h:${pageH}px"`:''}><div class="rv-stage" data-rd-key="rv-stage" data-rd-own="review-room" aria-hidden="true"></div>${head}${body}${drawer?drawerView(d,day):''}${statusLine()}</section>`;
   }catch(error){return `<section class="rv rv-room rv-broken" data-review-deck><h2 class="rv-title">Review</h2><p role="alert">${E(error?.message||'The review deck could not load.')}</p></section>`;}
  }

  /* ---------- the Home module: small, medium, large; no room ---------- */
  let moduleArgs=null,moduleDrawn='';
  // (what the module was last drawn as: the module under a room is drawn again as the room folds only when it changed)
  function renderModule(c={}){const html=moduleMarkup(c);moduleDrawn=html;return html;}
  function moduleMarkup(c={}){
   if(!allowed())return '';moduleArgs=c;try{
    const sz=c?.s?.moduleSize?.review??settings().moduleSize?.review,
      size=SIZES.includes(sz)?sz:'m',
      d=deck(),
      day=today(),
      sum=M.stats(d,day,{tests:tests(day)}),
      list=boxes(d,day,sum),
      s=session;
    const here=size==='l',studying=here&&live(),open=!here;let body;
    const carry=s&&!finished()&&(open||s.away);
    const primary=carry?open?`<button type="button" class="rv-btn rv-btn-clay rv-primary" data-rd-key="rv-primary" data-rd-action="review-deck-open" data-resume="true">${frame('clay')}<span>Carry on<small class="rv-n"> · ${s.list.length-s.index} left</small></span></button>`:`<button type="button" class="rv-btn rv-btn-clay rv-primary" data-rd-key="rv-primary" data-rd-action="review-deck-resume"${busy?' disabled':''}>${frame('clay')}<span>Carry on<small class="rv-n"> · ${s.list.length-s.index} left</small></span></button>`
     :sum.due?open?`<button type="button" class="rv-btn rv-btn-clay rv-primary" data-rd-key="rv-primary" data-rd-action="review-deck-open" data-start="all">${frame('clay')}<span>Study${size==='s'?'':` all<small class="rv-n"> · ${sum.due}</small>`}</span></button>`:`<button type="button" class="rv-btn rv-btn-clay rv-primary" data-rd-key="rv-primary" data-rd-action="review-deck-start" data-course="all" data-here="true"${busy?' disabled':''}>${frame('clay')}<span>Study all<small class="rv-n"> · ${sum.due}</small></span></button>`
     :!sum.total?`<button type="button" class="rv-btn rv-btn-paper rv-primary" data-rd-key="rv-primary" data-rd-action="review-deck-open" data-open="add">${frame('paper')}<span>Add cards</span></button>`:'';
    if(studying){
     const left=Math.max(0,s.list.length-s.index),test=firstTest(d,day);
     body=finished()?`<div class="rv-mod-l rv-mod-done" data-rd-key="rv-mod-done"><p class="rv-mod-title"><strong>${E(sessionName())}</strong><span>done for today</span></p>${doneCard(sum)}${btn('finish','Back to boxes')}</div>`
      :`<div class="rv-mod-l" data-rd-key="rv-mod-study"><p class="rv-mod-title"><strong>${E(sessionName())}</strong><span>${left} to go${test?` · test ${E(dayWord(test,day))} first`:''}</span>${btn('leave','Boxes',{kind:'slip',extra:'aria-keyshortcuts="Escape"'})}</p><div class="rv-desk">${pileBlock('left',left,`${left} to go`)}<div class="rv-deskcard">${cardBlock(d,day,'mod')}</div>${pileBlock('done',s.done,`done ${s.done}`)}</div></div>`;
    }else if(size==='s'){
     const top=list.find(b=>b.due)||list[0];
     body=`<div class="rv-mod-s" data-rd-key="rv-mod-s"><p class="rv-count"><strong>${sum.due}</strong><span>${sum.due?'due today':sum.total?'all done today':'no cards yet'}</span>${sum.due?`<span>about ${sum.minutes} min</span>`:''}</p><div class="rv-mod-row">${top?boxButton(top,0,day,{open:true}):''}${primary}</div></div>`;
    }else{
     const shown=list.filter(b=>b.cards||b.id==='personal').slice(0,here?4:3);
     body=`<div class="rv-mod-m" data-rd-key="rv-mod-m"><div class="rv-mod-top"><p class="rv-sub"><strong>${sum.due}</strong> due · ${sum.minutes} min</p>${weekDots(sum)}</div><div class="rv-mod-boxes">${shown.map((b,i)=>boxButton(b,i,day,{open,here})).join('')}${shown.length>2?`<span class="rv-more" aria-hidden="true">${frame('tag',6,70)}<span>+${shown.length-2}</span></span>`:''}</div><div class="rv-mod-foot">${primary}</div></div>`;
    }
    schedulePaint();
    return `<div class="rv rv-mod" data-rv-mod data-rd-key="rv-mod" data-rv-size="${size}" data-rv-mode="${studying?finished()?'done':'study':'home'}" aria-busy="${busy}">${body}${statusLine()}${goButton('review')}</div>`;
   }catch(error){return `<p class="rv-empty" role="alert">${E(error?.message||'The review deck could not load.')}</p>`;}
  }
  // The module's corner control: the module grows into the reading room.
  const GROW='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.2 4.4c2 .1 3.9 0 5.4.2.2 1.5.1 3.4.2 5.4M19.4 4.8l-5.6 5.4M9.8 19.6c-2-.1-3.9 0-5.4-.2-.2-1.5-.1-3.4-.2-5.4M4.6 19.2l5.6-5.4"/></svg>';
  function moduleOpener(){if(!allowed())return '';return `<button type="button" class="rv-grow" data-rd-key="rv-grow" data-rd-action="review-deck-open" data-rv-grow aria-label="Open the reading room">${GROW}</button>`;}
  // the same drawn corner arrows as the Focus room's and Grade impact's openers (widgets.js, grade-impact.js)
  // The dashboard owns the workspaces: growing and folding click its workspace action on a hidden hook, which is no
  // control of its own (a plain element: nothing to focus, nothing for a screen reader or Biscuit's list).
  const goButton=tab=>`<span hidden aria-hidden="true" data-rd-key="rv-go-${tab}" data-rd-action="workspace" data-tab="${tab}" data-rv-go="${tab}"></span>`;
  // The sheet: a piece of the room's own wall with a drawn edge, fixed over the page. It is what the long page renders
  // happen under (nothing moves then), so neither Home nor the room ever blanks out in one frame.
  const SHEET_EDGE='<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="rv-sheet-edge" vector-effect="non-scaling-stroke" d="M1.2 1.6Q30 .8 50 1.3T98.6 1.2Q99.3 30 98.8 50T98.7 98.5Q70 99.2 50 98.7T1.4 98.6Q.8 70 1.3 50T1.4 3.4"/></svg>';
  let sheet=null,modRect=null;
  // a move stamps the dashboard with when it ends, so the companion keeps still meanwhile (pets.js)
  const busyFor=ms=>{try{const t=Date.now()+ms;if(!(Number(container.dataset.chMoving)>=t))container.dataset.chMoving=String(t);}catch{}};
  const toward=(from,at)=>`translate(${px(from.left-at.left)},${px(from.top-at.top)}) scale(${n3(from.width/at.width)},${n3(from.height/at.height)})`;
  function makeSheet(at){
    const el=doc.createElement('div');
    el.className='rv-flysheet';
    el.style.cssText=`left:${px(at.left)};top:${px(at.top)};width:${px(at.width)};height:${px(at.height)}`;
    el.innerHTML=SHEET_EDGE;
    flyLayer().append(el);
    return el;
  }
  // where the room will stand: the workspace under the toolbar, down to the bottom of the window
  function roomTarget(){
    const main=container?.querySelector?.('.rd-workspace')||container,r=main.getBoundingClientRect(),vh=win?.innerHeight||900,top=Math.max(8,Math.min(r.top,vh*.4));
    return {left:r.left,top,width:r.width||(win?.innerWidth||1440),height:Math.max(200,vh-top-14)};
  }
  function growSheet(from,frameNode,then){
   animate(frameNode,[{transform:'none'},{transform:'scale(.975)'},{transform:'none'}],{duration:180,easing:PEN()});
   const at=roomTarget(),el=makeSheet(at),a=animate(el,[{transform:toward(from,at),opacity:.9},{transform:'none',opacity:1}],{duration:300,easing:SETTLE(),fill:'both'});
   const mine=sheet={el,anim:a,from,at,state:'growing'};
   const over=()=>{if(sheet!==mine||mine.state!=='growing')return;mine.state='over';then();};
   if(a)a.finished.then(over,()=>{});else over();
   return mine;
  }
  // the room has been drawn under the sheet: it lifts off (sliding the last pixels onto the page's own box)
  function liftSheet(page){
   const s=sheet;if(!s||s.state!=='over'||!s.el?.isConnected)return false;sheet=null;s.state='lifting';
   const r=page.getBoundingClientRect(),at=s.at,to=r.width?toward({left:r.left,top:r.top,width:r.width,height:Math.min(r.height,(win?.innerHeight||900)-r.top)},at):'none';
   try{s.anim?.commitStyles?.();s.anim?.cancel();}catch{}
   const a=animate(s.el,[{transform:to,opacity:0}],{duration:250,easing:FADE(),fill:'forwards'});
   const gone=()=>s.el.remove();
   if(a)a.finished.then(gone,gone);else gone();
   return true;
  }
  // Escape while the sheet is still growing (the room not drawn yet): it shrinks back into the module from where it is
  function retreatSheet(){
    const s=sheet;
    if(!s||s.state!=='growing')return false;
    sheet=null;
    s.state='back';
    grow=null;
    if(session&&!session.away&&s.started)session.away=true;
    try{s.anim?.commitStyles?.();s.anim?.cancel();}catch{}
   const a=animate(s.el,[{transform:toward(s.from,s.at),opacity:.9}],{duration:220,easing:SETTLE(),fill:'forwards'});
   const gone=()=>s.el.remove();
   if(a)a.finished.then(gone,gone);else gone();
   return true;
  }
  // Folding: every move under way in the room is taken over where it is, and the room itself, with its drawing, starts
  // folding into the module at once, on the compositor (transform and opacity only: nothing in the page is laid out
  // again). Home is drawn a frame later; the long render that swaps the page runs while the fold keeps moving, and a
  // sheet of the room's wall, folding in step under the room, takes its place the moment the render removes it. When
  // Home is in, the sheet is aimed at the module's real box if that moved, and it melts into the module as it lands.
  function takeOverIn(scope){
    for(const a of scope?.getAnimations?.({subtree:true})||[]){if(a.playState==='running'||a.playState==='pending'){try{a.commitStyles?.();}catch{}}try{a.cancel();}catch{}}
  }
  const FOLD_MS=460;
  function foldAway(page,r){
   if(sheet){const s=sheet;sheet=null;try{s.anim?.cancel();}catch{}s.el?.remove();}
   if(!(r.width>0&&r.height>0))return null;
   takeOverIn(page);busyFor(FOLD_MS+500);
   const at={left:r.left,top:r.top,width:r.width,height:r.height},
     target=modRect?.width?modRect:{left:at.left+at.width*.36,top:Math.max(at.top,0)+300*.32,width:at.width*.28,height:Math.min(at.height,600)*.28};
   page.style?.setProperty?.('transform-origin','0 0');page.style?.setProperty?.('pointer-events','none');
   const cover=makeSheet(at);cover.style.visibility='hidden';
   // The page folds into the module and stays there, whole, until Home is in (on a slow machine the swap can come well
   // after the fold has landed: a page that had faded out left an empty wall). The sheet under it shows the moment the
   // page is gone (the same commit), exactly where the room had folded to; it melts into the module from there.
   const frames=foldFrames(at,target),last=frames[frames.length-1].transform,held=frames.map((f,i)=>i===frames.length-1?{...f,opacity:1}:f);
   const o={duration:FOLD_MS,easing:'linear',fill:'forwards'},away={page,cover,at,target,anim:animate(cover,frames,o)},pageAnim=animate(page,held,o);
   let landed=false;
   const gone=()=>{watch?.disconnect();cover.remove();};
   const melt=()=>{
     const a=animate(cover,[{transform:last,opacity:1},{transform:last,opacity:0}],{duration:180,easing:FADE(),fill:'forwards'});
     if(a)a.finished.then(gone,gone);else gone();
   };
   const show=()=>{if(!page.isConnected){cover.style.visibility='';watch?.disconnect();if(landed)melt();}};
   const watch=win.MutationObserver&&page.parentNode?new win.MutationObserver(show):null;
   watch?.observe(page.parentNode,{childList:true});
   const land=()=>{landed=true;if(!page.isConnected)gone();};away.done=land;if(away.anim)away.anim.finished.then(land,()=>{});else gone();
   // (a way back that never came leaves the room as it was)
   wait(FOLD_MS+2500,()=>{watch?.disconnect();if(page.isConnected){cover.remove();try{pageAnim?.cancel();}catch{}page.style?.removeProperty?.('pointer-events');}});
   return away;
  }
  // Folding a room that floats over Home (dashboard.js): Home is under it the whole time, so the room itself shrinks into
  // the module and fades as it lands, on the compositor (transform and opacity only), and no sheet stands in for it.
  function foldOver(page,f){
   if(sheet){const s=sheet;sheet=null;try{s.anim?.cancel();}catch{}s.el?.remove();}
   const r=f.rect,lvl=motion();if(!(r?.width>0&&r.height>0)||lvl==='off')return;
   // the module's box, read before anything is written (Home is laid out, and nothing in it changed under the room)
   const box=container.querySelector('.rd-widget[data-widget="review"]')?.getBoundingClientRect?.();if(box?.width)modRect={left:box.left,top:box.top,width:box.width,height:box.height};
   takeOverIn(page);busyFor(FOLD_MS+500);
   if(lvl==='still'){animate(page,[{opacity:1},{opacity:0}],{duration:200,easing:FADE(),fill:'forwards'});return;}
   const at={left:r.left,top:r.top,width:r.width,height:r.height},
     target=modRect?.width?modRect:{left:at.left+at.width*.36,top:Math.max(at.top,0)+300*.32,width:at.width*.28,height:Math.min(at.height,600)*.28};
   page.style?.setProperty?.('transform-origin','0 0');f.lands=Date.now()+FOLD_MS;
   animate(page,foldFrames(at,target),{duration:FOLD_MS,easing:'linear',fill:'forwards'});
  }
  const foldFrames=(at,to,from=null)=>
    [{transform:from?.transform||'none',opacity:from?.opacity??1,easing:SETTLE()},{transform:toward(to,at),opacity:1,offset:.74,easing:'linear'},{transform:toward(to,at),opacity:0}];
  // Growing and folding swap the dashboard's page, a long render: the module (or the room) first dips a little, on the
  // compositor, and the swap runs a frame later, so the move starts with its anticipation instead of a still frame.
  function dipThen(node,to,ms,then){
   if(motion()!=='gentle'||!node?.animate||!win?.requestAnimationFrame){then();return;}
   const dip=animate(node,[{transform:'none'},{transform:to}],{duration:ms,easing:PEN(),fill:'forwards'});win.requestAnimationFrame(()=>{if(!dead)then();});
   // (a swap that did not happen leaves nothing dipped)
   if(dip)wait(900,()=>{if(node.isConnected)try{dip.cancel();}catch{}});
  }
  // (the swap itself is part of the move: the dashboard holds back its work that can wait, the companion keeps still and
  // the Help band's ink read waits, until the room's entrance or the module's landing has played, even on a slow machine
  // where the swap comes long after the press)
  function go(tab){
    later(()=>{
      if(dead)return;
      busyFor(700);
      if(typeof onRoom==='function'&&onRoom(tab))return;
      const b=container?.querySelector?.(`[data-rv-go="${tab}"]`);
      if(b&&typeof b.click==='function')b.click();else changed();
    });
  }
  function focusInside(){const a=container?.getRootNode?.()?.activeElement||doc?.activeElement;return !!a?.closest?.('[data-review-deck],[data-rv-mod]');}

  /* ---------- after a render: the room is hung, growth and folding play, thrown cards land, focus is placed ---------- */
  // A paint runs only after a render has put the new markup in place (renderReviewDeck and renderModule schedule it),
  // and one-shot moves and focus wait while a save is in flight: the busy render still shows the old state.
  function schedulePaint(){if(queued||dead)return;queued=true;later(()=>{queued=false;if(!dead)try{paint();}catch{}});}
  function paint(){
   const page=container?.querySelector?.('[data-review-deck]'),mod=container?.querySelector?.('[data-rv-mod]'),t=Date.now();
   if(page)hang(page,!!(grow&&!busy&&motion()==='gentle'&&grow.rect?.width));
   if(grow&&t-grow.at>2500)grow=null;if(fold&&t-fold.at>2500)fold=null;if(opening&&t-opening.at>2500)opening=null;if(closing&&t-closing.at>2500)closing=null;
   if(busy)return;
   // each move on its own: one that cannot play never keeps the others, or the focus, from their turn
   const once=fn=>{try{fn();}catch{}};
   if(grow&&page){const g=grow;grow=null;once(()=>growIn(page,g));}
   if(fold&&mod&&!page){const o=fold;fold=null;once(()=>foldIn(mod,o));}
   if(flights.length){const list=flights;flights=[];for(const f of list)once(()=>fly(f));}
   if(doneFrom){const o=doneFrom;doneFrom=null;once(()=>settleDone(o));}
   if(opening&&page?.querySelector?.('.rv-sidebox')){const o=opening;opening=null;once(()=>openFlight(page,o));}
   if(closing&&page){const o=closing;closing=null;once(()=>closeFlight(page,o));}
   if(leaving){const o=leaving;leaving=null;once(()=>putAway(o));}
   if(putDown){putDown=false;once(()=>lowerCard(page||mod));}
   if(bigFrom){const o=bigFrom;bigFrom=null;if(page)once(()=>liftCard(page,o));}
   if(turnFrom){const o=turnFrom;turnFrom=null;once(()=>returnTurn(page||mod,o));}
   // Life moments belong to the room; one that happened in the module is not saved up for the next visit.
   if(moments.length){const list=moments;moments=[];if(world&&page)for(const m of list)once(()=>play(m));}
   place(page,mod);
  }
  // The big card travels between its place by the window and the middle of the room: drawn at its new place, moved back
  // to where it was and let go (transform only, on the compositor). Again/Good/Easy slide along with it; the veil over
  // the room fades by its own transition.
  function liftCard(page,from){
   if(motion()!=='gentle')return;
   for(const [sel,was,grows] of [['.rv-cardwrap',from.card,true],['.rv-study .rv-under',from.under,false]]){
    const el=page.querySelector(sel),to=el?.getBoundingClientRect?.();if(!was?.width||!to?.width||typeof el.animate!=='function')continue;
    const dx=grows?was.left-to.left:was.left+was.width/2-(to.left+to.width/2),dy=was.top-to.top,k=grows?was.width/to.width:1;
    el.animate([{transform:`translate(${dx}px,${dy}px) scale(${k})`,transformOrigin:'0 0'},{transform:'none',transformOrigin:'0 0'}],{duration:grows?440:380,easing:'cubic-bezier(.3,.7,.25,1)'});
   }
  }
  // The room is built once per page and kept: renders only hang it back in its frame (see data-rd-own).
  // Growing out of the module, the drawn room goes into its frame a share at a time (it is some 3,500 shapes; all at
  // once, the browser lays out and paints all of it in the first frame of the move). It is unseen meanwhile: the sheet
  // grows first, and the room fades in and starts its entrance once every part is in.
  let arriving=null;
  function arrive(){
   const w=world,rest=[...w.children];
   for(const n of rest)n.remove();
   let done;
   const a={done:new Promise(r=>{done=r;}),rest,finish(){for(const n of rest.splice(0))w.append(n);done();if(arriving===a)arriving=null;}};
   const size=n=>(n.getElementsByTagName?.('*').length||0)+1;
   // the share follows the machine: a slow frame halves the next share, a quick one lets it grow back; and the whole fill
   // never takes longer than 700 ms (what is left then goes in at once, still out of sight): on a page busy with other
   // work the frames came slowly and the shares shrank, and the room waited for its drawing for seconds
   let share=700,last=0,first=0;
   const step=t=>{
     if(arriving!==a)return;
     if(dead||!w.isConnected){a.finish();return;}
     if(!first)first=t;
     if(t-first>700){a.finish();return;}
     const gap=last?t-last:16;
     last=t;
     share=gap>34?Math.max(250,share/2):gap<20?Math.min(1100,share*1.25):share;
     let spent=0;
     while(rest.length&&(spent===0||spent+size(rest[0])<=share)){const n=rest.shift();spent+=size(n);w.append(n);}
     if(rest.length)win.requestAnimationFrame(step);else a.finish();
   };
   arriving=a;win.requestAnimationFrame(step);return a;
  }
  function makeWorld(){
    const A=Art();
    if(!world&&A?.room&&doc?.createElement){
      const tpl=doc.createElement('template');
      tpl.innerHTML=A.room();
      world=tpl.content.firstElementChild;
      if(world&&A.sweep){const wash=doc.createElement('div');wash.className='rv-sweep';wash.innerHTML=A.sweep();world.append(wash);}
    }
    return world;
  }
  function hang(page,gradual=false){
   const slot=page.querySelector('.rv-stage');if(!slot)return;
   if(!makeWorld())return;listen();
   // a room hung afresh starts its moments afresh (its animations were dropped while it was out of the page)
   // (a room over Home, dashboard.js, takes its drawing a share per frame too: out of a room that has folded away first)
   if(world.parentNode!==slot){
     const over=!!page.closest?.('.rd-roomlayer');
     arriving?.finish();
     for(const name of pulsing.keys())world.removeAttribute(name);
     if(over&&world.isConnected)world.remove();
    if((gradual||over)&&win?.requestAnimationFrame&&!world.isConnected&&world.children.length>1){
      slot.replaceChildren(world);
      arrive();
      if(over&&!grow?.sheet)unseenWhileArriving(page);
    }
    else slot.replaceChildren(world);}
   if(shownIn!==page){shownIn=page;enter();}
   if(doc?.visibilityState==='hidden')world.setAttribute('data-paused','');else world.removeAttribute('data-paused');
   measure(page);
   const night=container?.dataset?.theme==='dark'&&!container?.hasAttribute?.('data-theme-kit')?'night':'day';
   if(night!==lit){if(night==='night')pulse('data-rv-lamp',2200);lit=night;}
  }
  // A room shown with no sheet over it (a link, Motion Still or Off) stays out of sight, whole, until its drawing is all
  // in: its controls never stand on a bare wall. (The hold is the element's own animation, whatever Motion is set to,
  // so the dashboard's redraws of the room, which set its attributes, never take it off.)
  function unseenWhileArriving(page){
    const a=arriving;
    if(!a||!page?.animate)return;
    let hold=null;
    try{hold=page.animate([{opacity:0},{opacity:0}],{duration:6e4,fill:'both'});}catch{}
    a.done.then(()=>{hold?.cancel?.();if(!dead&&page.isConnected)animate(page,[{opacity:0},{opacity:1}],{duration:220,easing:FADE()});});
  }
  // Built ahead of time (dashboard.js: a pointer resting on a way into the room): the drawing goes into the room that is
  // not shown yet, a share per frame, so the press only shows it. Never out of a room that is up or folding away.
  function prebuild(section){
   if(dead||!allowed()||!section?.querySelector)return false;const slot=section.querySelector('.rv-stage');if(!slot||!makeWorld())return false;
   if(world.parentNode===slot)return true;if(world.closest?.('[data-review-deck],.rd-roomlayer[data-state="leaving"]'))return false;
   arriving?.finish();world.remove();for(const name of pulsing.keys())world.removeAttribute(name);slot.replaceChildren(world);listen();
   if(win?.requestAnimationFrame&&world.children.length>1)arrive();
   // the room's height is taken now, out of sight, not in the frame it is shown (a new height lays the whole room out)
   try{measure(section,true);}catch{}return true;
  }
  function enter(){
    if(!world)return;
    world.removeAttribute('data-rv-heron');
    world.style.removeProperty('--rv-enter-at');
    if(motion()==='off')return;
    if(arriving){const w=world;arriving.done.then(()=>{if(world===w&&!dead)pulse('data-rv-enter',1700);});return;}
    pulse('data-rv-enter',1700);
  }
  // A moment is an attribute on the room for as long as it plays. Set again while it is still on, it comes off for one
  // drawn frame first, so its animations start over; no forced layout (that used to lay out the whole room mid-click).
  const pulsing=new Map();
  function pulse(name,ms){
   if(!world)return;const w=world,again=w.hasAttribute(name),old=pulsing.get(name);w.removeAttribute(name);
   if(old){win?.clearTimeout?.(old);timers.delete(old);pulsing.delete(name);}
   if(motion()==='off')return;
   const on=()=>{
     if(dead||world!==w)return;
     w.setAttribute(name,'');
     if(!ms||!win?.setTimeout)return;
     const t=win.setTimeout(()=>{timers.delete(t);if(pulsing.get(name)===t)pulsing.delete(name);if(!dead)w.removeAttribute(name);},ms);
     timers.add(t);
     pulsing.set(name,t);
   };
   if(again&&win?.requestAnimationFrame)win.requestAnimationFrame(()=>win.requestAnimationFrame(on));else on();
  }
  // Queued only: every caller is followed by a render, whose paint plays it. Painting here would run against the
  // markup that is about to be replaced and spend the focus that the render needs.
  function moment(kind){moments.push(kind);}
  function play(kind){
   if(kind==='end'){if(motion()!=='off')world.setAttribute('data-rv-heron','');pulse('data-rv-dust',3600);}
   else if(kind==='dust')pulse('data-rv-dust',3600);
   else if(kind==='filed')pulse('data-rv-leaf',1600);
  }
  // The page fills the window below its top. Once its height is known it is checked after the frame is drawn, when the
  // layout is already done, instead of forcing one in the middle of every render.
  let measureQueued=false;
  function measure(page,now=!pageH){
   if(!now){
     if(!measureQueued&&win?.requestAnimationFrame){
       measureQueued=true;
       win.requestAnimationFrame(()=>win.setTimeout(()=>{measureQueued=false;const p=!dead&&container?.querySelector?.('[data-review-deck]');if(p)measure(p,true);},0));
     }
     return;
   }
   const r=page.getBoundingClientRect?.(),vh=win?.innerHeight||900;
   if(!r||!r.width)return;
   if(r.top>=-4&&r.top<vh*.7){const h=Math.max(560,Math.round(vh-Math.max(0,r.top)-14));if(Math.abs(h-pageH)>2){pageH=h;page.style.setProperty('--rv-h',h+'px');}}
  }
  // Opening: a sheet of the room's wall grows out of the module's frame (a hold, the growth, a hair past, settle), the
  // drawn room comes in on it a beat later, the room's things rise into place, and the card you are on stays put and
  // grows. Transform and opacity only; the page shows nothing outside the sheet until it has landed (CSS :has).
  function growIn(page,g){
   const lvl=motion();if(lvl==='off')return;const r=page.getBoundingClientRect(),m=g.rect;
   if(lvl==='still'||!m?.width||!r.width){animate(page,[{opacity:0},{opacity:1}],{duration:200,easing:FADE()});return;}
   // (a room whose drawing is still going in keeps the sheet over it, whole, until it is all in: never its controls on a
   // bare wall; the sheet then lifts as it always did)
   if(g.sheet&&arriving&&sheet&&sheet.state==='over'){const a=arriving;a.done.then(()=>{if(!dead&&page.isConnected&&page.hasAttribute?.('data-review-deck'))growIn(page,g);});return;}
   if(g.sheet&&liftSheet(page)){
    // the room is under the sheet already: it washes in as the sheet lifts, and its things come up behind it
    // (its entrance starts at once: --rv-enter-at is left unset, which is 0s; set on the drawing, an inherited property,
    // it restyled all of its 3,500 shapes in the frame the room was shown)
    if(world){
      const w=world;
      if(w.style.getPropertyValue('--rv-enter-at'))w.style.removeProperty('--rv-enter-at');
      if(arriving){
        const hold=animate(w,[{opacity:0},{opacity:0}],{duration:6e4,fill:'both'});
        arriving.done.then(()=>{hold?.cancel?.();if(world===w&&!dead)animate(w,[{opacity:0},{opacity:1}],{duration:250,easing:FADE()});});
      }
    }
    [['.rv-head',0],['.rv-corner',30],['.rv-cabtag',60],['.rv-boxes',80],['.rv-under',100],['.rv-pile',110],['.rv-sidebox',100],['.rv-cardwrap',60]].forEach(([sel,delay])=>
      animate(page.querySelector(sel),[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:260,delay,easing:SETTLE(),fill:'backwards'}));
    return;
   }
   const slot=page.querySelector('.rv-stage');let lag=0;
   if(slot&&doc?.createElement){
    slot.querySelector(':scope > .rv-growsheet')?.remove();const sheet=doc.createElement('span');sheet.className='rv-growsheet';slot.prepend(sheet);
    const from=`translate(${(m.left-r.left).toFixed(1)}px,${(m.top-r.top).toFixed(1)}px) scale(${(m.width/r.width).toFixed(4)},${(m.height/r.height).toFixed(4)})`;
    const a=animate(sheet,[{transform:from},{transform:'none'}],{duration:320,easing:SETTLE(),fill:'both'});
    if(world){
     // the room comes in on the sheet from 213 ms, its entrance from 220 ms; a room still going in waits, unseen
     const w=world,clock=()=>win.performance?.now?.()??Date.now(),t0=clock();
     const fade=()=>{
       const t=clock()-t0;
       w.style.setProperty('--rv-enter-at',(Math.max(0,120-t)/1000).toFixed(3)+'s');
       animate(w,[{opacity:0},{opacity:1}],{duration:250,delay:Math.max(0,110-t),easing:FADE(),fill:'backwards'});
     };
     if(arriving){const hold=animate(w,[{opacity:0},{opacity:0}],{duration:6e4,fill:'both'});arriving.done.then(()=>{hold?.cancel?.();if(world===w&&!dead)fade();});}else fade();
    }
    const gone=()=>sheet.remove();if(a)a.finished.then(gone,gone);else gone();lag=60;
   }
   const card=page.querySelector('.rv-cardwrap'),cr=card?.getBoundingClientRect?.();
   if(card&&g.card?.width&&cr?.width){
     const k=g.card.width/cr.width,dx=g.card.left+g.card.width/2-(cr.left+cr.width/2),dy=g.card.top+g.card.height/2-(cr.top+cr.height/2);
     animate(card,[{transform:`translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) scale(${k.toFixed(3)})`},{transform:'none'}],{duration:340,easing:SETTLE()});
   }
   [['.rv-head',120],['.rv-corner',140],['.rv-cabtag',160],['.rv-boxes',170],['.rv-under',190],['.rv-pile',200],['.rv-sidebox',190]].forEach(([sel,delay])=>
     animate(page.querySelector(sel),[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:260,delay:delay+lag,easing:SETTLE(),fill:'backwards'}));
  }
  // Folding back: the page shrinks into the module, which settles in its place.
  function foldIn(mod,f){
   const frameNode=mod.closest?.('.rd-widget')||mod,lvl=motion();if(lvl==='off')return;
   // a room over Home folded into the module by itself: the module takes the landing with a small settle
   if(f.over){
     if(lvl==='gentle'&&f.lands){
       const o='50% 100%';
       animate(
         frameNode,
         [{transform:'none',transformOrigin:o},{transform:'scaleY(1.015)',transformOrigin:o,offset:.35},{transform:'scaleY(.995)',transformOrigin:o,offset:.7},{transform:'none',transformOrigin:o}],
         {duration:240,delay:Math.max(0,f.lands-Date.now()-90),easing:SETTLE()});
     }
     return;
   }
   const r=frameNode.getBoundingClientRect();if(!r.width)return;
   if(f.away){
    // Home is in: the room folding over it is aimed at the module's real box when that is not where it was going
    const w=f.away,t=w.target,a=w.anim;modRect={left:r.left,top:r.top,width:r.width,height:r.height};
    if(a&&w.cover.isConnected&&a.playState!=='finished'&&(Math.abs(r.left-t.left)>2||Math.abs(r.top-t.top)>2||Math.abs(r.width-t.width)>2||Math.abs(r.height-t.height)>2)){
     const spent=Number(a.currentTime)||0,left=Math.max(140,FOLD_MS-spent);
     let from=null;
     try{a.commitStyles();from={transform:w.cover.style.transform||'none',opacity:Number(w.cover.style.opacity||1)};}catch{}
     try{a.cancel();}catch{}
     w.target=modRect;
     w.anim=animate(w.cover,foldFrames(w.at,modRect,from),{duration:left,easing:'linear',fill:'forwards'});
     if(w.anim)w.anim.finished.then(w.done,()=>{});else w.done();
    }
    // the module takes the landing with a small settle
    if(lvl==='gentle'){
      const o='50% 100%',wait=Math.max(0,FOLD_MS-(Number(w.anim?.currentTime)||0));
      animate(
        frameNode,
        [{transform:'none',transformOrigin:o},{transform:'scaleY(1.015)',transformOrigin:o,offset:.35},{transform:'scaleY(.995)',transformOrigin:o,offset:.7},{transform:'none',transformOrigin:o}],
        {duration:240,delay:Math.max(0,wait-90),easing:SETTLE()});
    }
    return;}
   if(lvl==='still'||!f.rect?.width){animate(frameNode,[{opacity:.2},{opacity:1}],{duration:200,easing:FADE()});return;}
   // the widgets' transform origin is their top left (customize.css), so the move is measured from the corners
   const sx=f.rect.width/r.width,sy=f.rect.height/r.height,dx=f.rect.left-r.left,dy=f.rect.top-r.top,o='0 0';
   animate(
     frameNode,
     [{transform:`translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) scale(${sx.toFixed(3)},${sy.toFixed(3)})`,transformOrigin:o,opacity:.35},{transform:'none',transformOrigin:o,opacity:1}],
     {duration:340,easing:SETTLE()});
   animate(mod,[{opacity:0},{opacity:0,offset:.35},{opacity:1}],{duration:340,easing:FADE()});
  }
  // A graded card is thrown: a lift and lean back, the arc, the landing with a squash, then the pile takes it.
  function captureFlight(value){
   if(motion()!=='gentle')return null;const wrap=container?.querySelector?.('[data-review-deck] .rv-cardwrap')||container?.querySelector?.('[data-rv-mod] .rv-cardwrap');
   const r=wrap?.getBoundingClientRect?.();if(!r?.width)return null;const where=wrap.closest('[data-rv-mod]')?'mod':'page';
   // the done pile's place now, in case this is the last card: the pile itself is carried to the middle then
   const pile=wrap.closest(where==='mod'?'[data-rv-mod]':'[data-review-deck]')?.querySelector?.('.rv-pile-done .rv-pile-art')?.getBoundingClientRect?.();
   // graded while it is still turning: the thrown copy leaves at the angle the card had reached, not at its last face
   const ghost=wrap.cloneNode(true);
   try{const inner=wrap.querySelector('.rv-card-in'),tf=inner&&win.getComputedStyle(inner).transform;if(tf&&tf!=='none')ghost.querySelector('.rv-card-in')?.style?.setProperty('transform',tf);}catch{}
   return {value,rect:r,ghost,where,pile:pile?.width?pile:null};
  }
  function flyLayer(){
    let layer=container.querySelector(':scope > .rv-fly');
    if(!layer){layer=doc.createElement('div');layer.className='rv rv-fly';layer.setAttribute('aria-hidden','true');layer.setAttribute('data-rd-keep','');container.append(layer);}
    return layer;
  }
  // A copy that only moves: no name, no action, no key, nothing to tab to.
  function strip(g){
    g.classList?.add('rv-ghost');
    for(const name of ['data-rd-key','id','data-rd-action'])g.removeAttribute?.(name);
    g.setAttribute?.('inert','');
    for(const n of g.querySelectorAll?.('[data-rd-action],[id],[data-rd-key],[data-rd-field],[data-review-deck-status]')||[])
      for(const name of ['data-rd-action','id','data-rd-key','data-rd-field','data-review-deck-status'])n.removeAttribute(name);
    return g;
  }
  // A drawing's own entrance is dropped when a hand-made move takes over the same thing.
  function still(node){for(const a of node?.getAnimations?.()||[])if(a.animationName)try{a.cancel();}catch{}}
  const px=v=>v.toFixed(1)+'px',n3=v=>v.toFixed(3);
  function fly(f){
   const scope=container?.querySelector?.(f.where==='mod'?'[data-rv-mod]':'[data-review-deck]');if(!scope||!doc?.createElement)return;
   const target=f.value==='again'?scope.querySelector('.rv-sidebox .rv-box-art, .rv-pile-left .rv-pile-art'):scope.querySelector('.rv-pile-done .rv-pile-art')||scope.querySelector('.rv-donestack'),
     t=target?.getBoundingClientRect?.();
   if(!t?.width)return;
   const g=strip(f.ghost);
   g.style.cssText=`left:${f.rect.left.toFixed(1)}px;top:${f.rect.top.toFixed(1)}px;width:${f.rect.width.toFixed(1)}px;height:${f.rect.height.toFixed(1)}px;--rv-tilt:${g.style.getPropertyValue('--rv-tilt')||'0deg'}`;
   flyLayer().append(g);
   // the done stack is a wide strip with the pile drawn in its middle: aim at the pile, not the strip
   const tw=target.classList?.contains('rv-donestack')?Math.min(t.width,t.height*140/112):t.width;
   const back=f.value==='again',
     dx=t.left+t.width/2-(f.rect.left+f.rect.width/2),
     dy=t.top+t.height*(back?.3:.45)-(f.rect.top+f.rect.height/2),
     k=Math.max(.1,Math.min(1,tw*(back?.6:.86)/f.rect.width)),
     lift=Math.min(170,Math.abs(dx)*.32+(back?40:70)),
     spin=f.value==='easy'?18:back?-12:7;
   const a=animate(
     g,
     [
       {transform:'translate(0,0) rotate(0deg) scale(1)'},
       {transform:'translate(0,-9px) rotate(-2.5deg) scale(1.03)',offset:.14},
       {transform:`translate(${(dx*.5).toFixed(1)}px,${(dy*.5-lift).toFixed(1)}px) rotate(${(spin*.6).toFixed(1)}deg) scale(${((1+k)/2).toFixed(3)})`,offset:.5},
       {transform:`translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) rotate(${spin}deg) scale(${k.toFixed(3)})`,offset:.82},
       {transform:`translate(${dx.toFixed(1)}px,${(dy+3).toFixed(1)}px) rotate(${(spin*.9).toFixed(1)}deg) scale(${(k*1.04).toFixed(3)},${(k*.94).toFixed(3)})`,offset:.91},
       {transform:`translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) rotate(${(spin*.92).toFixed(1)}deg) scale(${k.toFixed(3)})`}
     ],
     {duration:back?400:360,easing:PEN(),fill:'forwards'});
   if(back)animate(g,[{opacity:1},{opacity:1,offset:.7},{opacity:0}],{duration:400,fill:'forwards'});
   const end=()=>{
     g.remove();
     const holder=target.closest('.rv-pile, .rv-sidebox, .rv-donecard');
     animate(
       holder,
       [{transform:'none'},{transform:'translateY(2px) scale(1.04,.93)',offset:.3},{transform:'translateY(-1px) scale(.98,1.03)',offset:.65},{transform:'none'}],
       {duration:220,easing:SETTLE()});
   };
   if(a)a.finished.then(end,end);else end();
  }
  // Opening a box: the box you pressed is lifted, carried in an arc to the table's left end and set down with a
  // squash; the other boxes are lowered out of sight behind the table's front edge, one after another.
  function captureOpen(){
   if(motion()!=='gentle'||!session)return null;const page=container?.querySelector?.('[data-review-deck]');if(!page?.querySelectorAll)return null;
   let id='';try{const d=deck(),day=today();id=String(sideBox(d,day,M.stats(d,day,{tests:tests(day)})).id);}catch{}
   let rect=null;const ghosts=[];
   for(const n of page.querySelectorAll('.rv-boxes .rv-box, .rv-boxes .rv-newcard, .rv-boxes .rv-riser')){
     const r=n.getBoundingClientRect?.();
     if(!r?.width)continue;
     if(n.getAttribute?.('data-rd-key')==='rv-box-'+id)rect=r;else ghosts.push({rect:r,node:n.cloneNode(true)});
   }
   return {at:Date.now(),rect,ghosts};
  }
  function openFlight(page,o){
   const w=world?.getBoundingClientRect?.(),edge=w?.height?w.bottom-288*w.height/1000:0,layer=o.ghosts.length&&doc?.createElement?flyLayer():null;
   if(layer)o.ghosts.forEach((g,i)=>{
    const r=g.rect,cut=edge>r.top+8?edge-r.top:r.height*1.6,box=doc.createElement('div');
    box.className='rv-sink';
    box.style.cssText=`left:${px(r.left)};top:${px(r.top)};width:${px(r.width)};height:${px(cut)}`;
    const n=strip(g.node);n.style.cssText+=`;position:absolute;left:0;top:0;width:${px(r.width)};height:${px(r.height)};margin:0`;box.append(n);layer.append(box);
    const a=animate(
      n,
      [{transform:'none',opacity:1},{transform:'translateY(-4px)',opacity:1,offset:.2},{transform:'translateY(40%)',opacity:.9,offset:.78},{transform:'translateY(46%)',opacity:0}],
      {duration:260,delay:i*36,easing:LETGO(),fill:'both'});
    const end=()=>box.remove();if(a)a.finished.then(end,end);else end();
   });
   const side=page.querySelector('.rv-sidebox'),r=side?.getBoundingClientRect?.(),m=o.rect;if(!r?.width||!m?.width)return;still(side);
   const k=m.width/r.width,dx=m.left+m.width/2-(r.left+r.width/2),dy=m.bottom-r.bottom,lift=Math.min(130,Math.abs(dx)*.22+44);
   animate(
     side,
     [
       {transform:`translate(${px(dx)},${px(dy)}) scale(${n3(k)})`},
       {transform:`translate(${px(dx)},${px(dy+2)}) scale(${n3(k*1.03)},${n3(k*.95)})`,offset:.1},
       {transform:`translate(${px(dx)},${px(dy-12)}) scale(${n3(k*1.02)})`,offset:.22},
       {transform:`translate(${px(dx*.5)},${px(dy*.5-lift)}) rotate(-3deg) scale(${n3((k+1)/2)})`,offset:.55},
       {transform:'translate(0px,0px) scale(1.05,.93)',offset:.82},
       {transform:'translate(0px,-2px) scale(.985,1.02)',offset:.91},
       {transform:'none'}
     ],
     {duration:380,easing:PEN()});
  }
  // Closing the card files: a small tug out, the drawer slides home into the cabinet, a thunk, the tag swings.
  function captureDrawer(){
    if(motion()!=='gentle')return null;
    const n=container?.querySelector?.('[data-review-deck] .rv-drawer'),r=n?.getBoundingClientRect?.();
    return r?.width?{at:Date.now(),rect:r,ghost:n.cloneNode(true)}:null;
  }
  function closeFlight(page,o){
   if(!doc?.createElement)return;
   const g=strip(o.ghost),r=o.rect;
   g.classList.add('rv-drawer-ghost');
   g.style.cssText=`position:fixed;left:${px(r.left)};top:${px(r.top)};width:${px(r.width)};height:${px(r.height)};margin:0;transform-origin:0 50%`;
   flyLayer().append(g);
   const a=animate(
     g,
     [
       {transform:'none',opacity:1},
       {transform:'translateX(1.6%)',opacity:1,offset:.14},
       {transform:'translateX(-30%) scaleX(.88)',opacity:.85,offset:.66},
       {transform:'translateX(-37.5%) scaleX(.85)',opacity:.45,offset:.82},
       {transform:'translateX(-36%) scaleX(.86)',opacity:0}
     ],
     {duration:320,easing:PEN(),fill:'forwards'});
   const end=()=>g.remove();if(a)a.finished.then(end,end);else end();
   animate(
     page.querySelector('.rv-cabtag'),
     [
       {transform:'rotate(-5deg)'},
       {transform:'rotate(-9.5deg)',offset:.16},
       {transform:'rotate(3.5deg)',offset:.4},
       {transform:'rotate(-7deg)',offset:.62},
       {transform:'rotate(-4deg)',offset:.82},
       {transform:'rotate(-5deg)'}
     ],
     {duration:240,delay:200,easing:SETTLE()});
   if(world)pulse('data-rv-dust',3600);
  }
  // Turned again while it is still turning: the card goes back from where it is (the angle it has reached, the lift and
  // the swell), the short way round, with a small overshoot and settle, instead of jumping to the far face and starting
  // the whole flip over.
  function captureTurn(){
   if(motion()!=='gentle')return null;const n=container?.querySelector?.('[data-review-deck] .rv-card-in')||container?.querySelector?.('[data-rv-mod] .rv-card-in');
   if(!n?.getAnimations||!n.getAnimations().some(a=>a.playState==='running'&&(a.animationName==='rv-flip'||a.animationName==='rv-unflip'||a.id==='rv-turn')))return null;
   let m=null;try{m=new win.DOMMatrixReadOnly(win.getComputedStyle(n).transform);}catch{}if(!m)return null;
   let angle=Math.atan2(-m.m13,m.m11)*180/Math.PI;if(angle<-90)angle+=360;
   return {angle:+angle.toFixed(2),ty:+m.m42.toFixed(2),s:+Math.max(.9,Math.min(1.1,Math.hypot(m.m11,m.m13))).toFixed(4)};
  }
  function returnTurn(scope,o){
   const wrap=scope?.querySelector?.('.rv-cardwrap'),n=wrap?.querySelector?.('.rv-card-in');if(!n||wrap.dataset.side==='edit')return;
   still(n);still(wrap.querySelector?.('.rv-card-shadow'));for(const a of n.getAnimations?.()||[])if(a.id==='rv-turn')try{a.cancel();}catch{}
   const to=wrap.dataset.side==='back'?180:0,d=to-o.angle,over=Math.sign(d)*Math.min(9,Math.abs(d)*.08);
   const a=animate(
     n,
     [{transform:`translateY(${o.ty}px) rotateY(${o.angle}deg) scale(${o.s})`},{transform:`translateY(-9px) rotateY(${(to+over).toFixed(2)}deg) scale(1.03)`,offset:.68},{transform:`translateY(-2px) rotateY(${(to-over*.25).toFixed(2)}deg) scale(1.004)`,offset:.86},{transform:`translateY(0px) rotateY(${to}deg) scale(1)`}],
     {duration:Math.round(200+180*Math.min(1,Math.abs(d)/180)),easing:PEN()});
   if(a)a.id='rv-turn';
  }
  // Turning the card changes only the card and the row under it. They are brought up to date where they stand (the
  // same markup the next render would make, so that render finds nothing to change), instead of a whole-page render
  // in the first frame of the turn; the turn's own animation starts in the same frame as the click.
  // The same rules as the dashboard's own patch: a node is kept by its key, the room's drawn place (data-rd-own) keeps
  // its subtree, rich text is compared whole; a node with another key is a new node (so its entrance plays).
  const keyOf=n=>n.nodeType===1?(n.getAttribute('data-rd-key')||n.id||''):'';
  function patchHere(now,next){
   if(now.nodeType!==1){if(now.nodeValue!==next.nodeValue)now.nodeValue=next.nodeValue;return;}
   for(const a of [...now.attributes])if(!next.hasAttribute(a.name)&&a.name!=='data-motion')now.removeAttribute(a.name);
   for(const a of [...next.attributes])if(now.getAttribute(a.name)!==a.value)now.setAttribute(a.name,a.value);
   if(now.hasAttribute('data-rd-own')&&now.getAttribute('data-rd-own')===next.getAttribute('data-rd-own'))return;
   if(now.classList?.contains('rd-rich-text')){if(now.innerHTML!==next.innerHTML)now.innerHTML=next.innerHTML;return;}
   if(now.tagName==='INPUT'){if(now.value!==next.value)now.value=next.value;now.checked=next.checked;return;}
   if(now.tagName==='TEXTAREA'){if(now.value!==next.value)now.value=next.value;return;}
   const chosen=now.tagName==='SELECT'?next.value:null;
   const keyed=new Map([...now.childNodes].filter(keyOf).map(n=>[keyOf(n),n]));let cursor=now.firstChild;
   for(const want of [...next.childNodes]){const have=keyOf(want)?keyed.get(keyOf(want)):cursor;
    if(have&&have.nodeType===want.nodeType&&have.nodeName===want.nodeName&&keyOf(have)===keyOf(want)){
      if(have!==cursor)now.insertBefore(have,cursor);
      patchHere(have,want);
      cursor=have.nextSibling;
    }
    else now.insertBefore(want,cursor);}
   while(cursor){const rest=cursor.nextSibling;cursor.remove();cursor=rest;}
   if(chosen!==null&&now.value!==chosen)now.value=chosen;
  }
  // After a grade is saved, the reading room is brought up to date where it stands (its own markup, patched by the
  // rules above) instead of a whole-dashboard render in the first frame of the throw and the deal. Anything the room
  // cannot settle alone (the drawer, the pencil, the module) goes through the dashboard as before.
  function renderHere(){try{return drawHere();}catch{return false;}}
  function drawHere(){
   if(busy||!doc?.createElement||!container?.querySelector)return false;
   const page=container.querySelector('[data-review-deck]'),mods=container.querySelectorAll('[data-rv-mod]');if(page&&mods.length&&!page.closest?.('.rd-roomlayer')||!page&&mods.length!==1)return false;
   const t=doc.createElement('template');if(!('content' in t))return false;
   // the module on Home (a large module studies right there) is redrawn from the dashboard's last view of it
   if(!page){
     if(!moduleArgs)return false;
     t.innerHTML=renderModule(moduleArgs);
     const next=t.content.querySelector('[data-rv-mod]');
     if(!next||keyOf(next)!==keyOf(mods[0]))return false;
     patchHere(mods[0],next);
     return true;
   }
   t.innerHTML=renderReviewDeck();
   const next=t.content.querySelector('[data-review-deck]');if(!next||keyOf(next)!==keyOf(page))return false;
   patchHere(page,next);return true;
  }
  // the module under a room, redrawn by itself as the room folds into it (what the room changed: the session, the counts)
  function redrawModule(){
    try{
      const mods=container?.querySelectorAll?.('[data-rv-mod]')||[];
      if(busy||mods.length!==1||!moduleArgs||!doc?.createElement)return false;
      const t=doc.createElement('template');
      if(!('content' in t))return false;
      const was=moduleDrawn,html=renderModule(moduleArgs);
      if(html===was)return true;
      t.innerHTML=html;
      const next=t.content.querySelector('[data-rv-mod]');
      if(!next||keyOf(next)!==keyOf(mods[0]))return false;
      patchHere(mods[0],next);
      return true;
    }catch{return false;}
  }
  function turnHere(){
   if(!session||busy||!doc?.createElement||!container?.querySelector)return false;
   const spots=[['page',container.querySelector('[data-review-deck] .rv-study')],['mod',container.querySelector('[data-rv-mod] .rv-deskcard')]].filter(([,spot])=>spot);
   if(!spots.length)return false;
   const d=deck(),day=today(),work=[];
   for(const [where,spot] of spots){
    const wrap=spot.querySelector('.rv-cardwrap'),under=spot.querySelector('.rv-under'),t=doc.createElement('template');if(!wrap||!under||!('content' in t))return false;
    t.innerHTML=cardBlock(d,day,where);const nw=t.content.querySelector('.rv-cardwrap'),nu=t.content.querySelector('.rv-under');
    // another card, or no card: the whole render decides
    if(!nw||!nu||nw.getAttribute('data-rd-key')!==wrap.getAttribute('data-rd-key')||nu.getAttribute('data-rd-key')!==under.getAttribute('data-rd-key'))return false;
    work.push([wrap,nw],[under,nu]);
   }
   for(const [now,next] of work)patchHere(now,next);
   if(turnFrom){const o=turnFrom;turnFrom=null;try{returnTurn(spots[0][1],o);}catch{}}
   return true;
  }
  // Back to the boxes: the card, its row, the side box and the piles are put away where they lie (a small drop and a
  // fade, copies of them, since the render has already taken them off) while the boxes are set back on the table.
  function captureLeave(){
   if(motion()!=='gentle')return null;try{const page=container?.querySelector?.('[data-review-deck] .rv-study')||container?.querySelector?.('[data-review-deck] .rv-done');if(!page)return null;
   const out=[];
   for(const n of page.querySelectorAll(':scope > .rv-cardwrap, :scope > .rv-under, :scope > .rv-sidebox, :scope > .rv-pile, :scope > .rv-donecard')){
     const r=n.getBoundingClientRect?.();
     if(r?.width)out.push({rect:r,node:n.cloneNode(true)});
   }
   return out.length?{at:Date.now(),out}:null;}catch{return null;}
  }
  function putAway(o){
   if(Date.now()-o.at>2500||!doc?.createElement)return;const layer=flyLayer();
   o.out.forEach(({rect:r,node},i)=>{const g=strip(node);g.style.cssText+=`;position:fixed;left:${px(r.left)};top:${px(r.top)};width:${px(r.width)};height:${px(r.height)};margin:0`;layer.append(g);
    const a=animate(
      g,
      [{transform:'none',opacity:1},{transform:'translateY(-3px)',opacity:1,offset:.18},{transform:'translateY(14px) scale(.97)',opacity:0}],
      {duration:200,delay:i*24,easing:LETGO(),fill:'both'});
    const end=()=>g.remove();if(a)a.finished.then(end,end);else end();});
  }
  // Leaving the pencil: the lifted card is lowered back into the light and the pencil is taken away.
  function lowerCard(scope){
   const wrap=scope?.querySelector?.('.rv-cardwrap'),card=wrap?.querySelector?.('.rv-card');if(!card||card.classList?.contains('rv-card-edit'))return;
   // the card was already turned (or not) before the pencil came down: no second flip, no flip shadow
   still(card.querySelector?.('.rv-card-in'));still(wrap.querySelector?.('.rv-card-shadow'));if(motion()!=='gentle'||!doc?.createElement)return;
   const tilt=parseFloat(wrap.style?.getPropertyValue?.('--rv-tilt'))||0,held=(tilt*.3).toFixed(2);
   animate(
     card,
     [
       {transform:`translateY(-4px) rotate(${held}deg) scale(1.01)`},
       {transform:`translateY(-7px) rotate(${held}deg) scale(1.014)`,offset:.16},
       {transform:`translateY(2.5px) rotate(${tilt}deg) scale(.994)`,offset:.6},
       {transform:`translateY(-.6px) rotate(${tilt}deg)`,offset:.82},
       {transform:`rotate(${tilt}deg)`}
     ],
     {duration:260,easing:SETTLE()});
   const pen=doc.createElement('span');pen.className='rv-pencil-lift';pen.setAttribute('aria-hidden','true');pen.innerHTML=art('pencil');wrap.append(pen);
   const a=animate(
     pen,
     [
       {transform:'rotate(-24deg)',opacity:1},
       {transform:'translate(-2%,4%) rotate(-27deg)',opacity:1,offset:.18},
       {transform:'translate(20%,-50%) rotate(4deg)',opacity:.9,offset:.6},
       {transform:'translate(44%,-96%) rotate(28deg)',opacity:0}
     ],
     {duration:260,easing:PEN(),fill:'forwards'});
   const end=()=>pen.remove();if(a)a.finished.then(end,end);else end();
  }
  // The last card: the done pile is carried from beside the books to the middle and squared up there.
  function settleDone(o){
   const scope=container?.querySelector?.(o.where==='mod'?'[data-rv-mod]':'[data-review-deck]'),stack=scope?.querySelector?.('.rv-donestack'),r=stack?.getBoundingClientRect?.(),m=o.rect;
   if(!r?.width||!m?.width)return;
   still(stack);
   const k=m.width/Math.min(r.width,r.height*140/112),dx=m.left+m.width/2-(r.left+r.width/2),dy=m.top+m.height/2-(r.top+r.height/2),lift=Math.min(90,Math.abs(dx)*.15+30);
   animate(
     stack,
     [
       {transform:`translate(${px(dx)},${px(dy)}) scale(${n3(k)})`},
       {transform:`translate(${px(dx)},${px(dy-8)}) scale(${n3(k*1.02)})`,offset:.16},
       {transform:`translate(${px(dx*.45)},${px(dy*.45-lift)}) rotate(-2deg) scale(${n3((k+1)/2)})`,offset:.55},
       {transform:'translate(0px,3px) scale(1.04,.94)',offset:.82},
       {transform:'translate(0px,-1px) scale(.99,1.01)',offset:.92},
       {transform:'none'}
     ],
     {duration:380,easing:PEN()});
  }
  // Focus: into the room when it opens, back to the module's opener when it folds, and never lost on a redraw.
  function place(page,mod){
   const rootNode=container?.getRootNode?.(),active=rootNode?.activeElement||doc?.activeElement,scope=page||mod;
   let want=focusNext;focusNext='';const had=hadFocus;hadFocus=false;
   if(!want&&had&&scope&&(!active||active===doc?.body||active.isConnected===false))want='rescue';
   if(!want||!scope)return;
   const firstLive=(...sels)=>sels.map(sel=>sel&&scope.querySelector(sel)).find(n=>n&&!n.disabled&&!n.closest('[inert]'));
   let node=null;
   if(want==='opener'){
     node=(openerTab&&container.querySelector('.rd-workspace-tab[data-tab="review"]'))||
       (openerKey&&container.querySelector(`.rd-widget[data-widget="review"] [data-rd-key="${openerKey}"]`))||
       container.querySelector('[data-rv-grow]')||
       null;
     openerKey='';
     openerTab=false;
   }
   else if(want==='edit')node=firstLive('.rv-card-edit textarea');
   // the card is the turnable button; while the pencil is down the card is a plain group, so its field is the target
   else if(/^[#.[]/.test(want))node=firstLive(want,'button.rv-card','.rv-primary','[data-rv-fold]');
   else node=firstLive('button.rv-card','.rv-card-edit textarea','.rv-primary','[data-rd-key="rv-finish"]','.rv-box','[data-rv-fold]');
   node?.focus?.({preventScroll:true});
  }

  /* ---------- saving ---------- */
  async function saveCard(){
   const draft=editor(),captured={...draft},error=M.checkCard(captured.front,captured.back);
   if(error){say(error,true);changed();return false;}
   const day=today(),made=M.makeCard({front:captured.front,back:captured.back,course:captured.course,twoWay:captured.twoWay,today:day});
   if(!made){say('The card could not be made.',true);changed();return false;}
   const key=activeEditor,midSession=!!captured.edit&&session?.editing===captured.edit,keep=!!captured.edit&&inSession(captured.edit);
   return transact(d=>{
     if(captured.edit){
       const at=d.cards.findIndex(c=>c.id===captured.edit),old=d.cards[at];
       if(!old)throw Error('This card was deleted. Your edit is kept here.');
       if(JSON.stringify(old)!==captured.base)throw Error('This card changed elsewhere. Your edit is kept here.');
       made.id=old.id;
       made.added=old.added;
       made.paused=old.paused;
     // A card fixed during a session keeps its place in the schedule, so the session carries on with it (#64).
     if(keep||old.f===made.f&&old.b===made.b){made.s.f=old.s.f;if(made.two)made.s.b=old.s.b||M.cleanSide();}d.cards[at]=made;}
   else{if(d.cards.length>=M.LIMITS.cards)throw Error(`A review deck holds up to ${M.LIMITS.cards} cards.`);d.cards.push(made);}},saved=>{
     if(captured.edit&&session){
       const card=saved.cards.find(c=>c.id===captured.edit);
       if(card)for(const entry of session.list)if(entry.id===card.id&&card.s[entry.side])entry.base=reviewVersion(card,entry.side);
     }
     if(editors.get(key)===draft){
       if(draft.revision===captured.revision){editors.delete(key);if(activeEditor===key){activeEditor='new';if(captured.edit&&!midSession)tab='cards';}}
       else if(captured.edit)draft.base=JSON.stringify(saved.cards.find(c=>c.id===captured.edit));
     }
     if(midSession&&session){session.editing=null;putDown=true;focusNext='[data-rd-key="rv-pencil"]';}
     moment('filed');say(captured.edit?'Saved.':'Card added.');},{here:midSession});
  }
  async function importCards(){
    const captured={...paste},revision=importRevision;
    return transact(d=>{
      const p=M.parseList(captured.text,{format:captured.format,remaining:M.LIMITS.cards-d.cards.length});
      if(importRevision===revision)paste.preview=p;
      if(!p.ok)throw Error(p.problems.map(e=>'Line '+e.line+': '+e.message).join(' '));
      const added=p.cards.map(c=>M.makeCard({...c,course:captured.course,twoWay:captured.twoWay,today:today()}));
      if(added.some(c=>!c))throw Error('A card could not be imported.');
      d.cards.push(...added);
    },()=>{if(importRevision===revision){paste.text='';paste.preview=null;importRevision++;}moment('filed');say('Cards imported.');});
  }
  async function grade(value){
   const s=session,item=current();
   if(!s||!s.revealed||s.editing||!item||!['again','good','easy'].includes(value))return false;
   if(today()!==s.day){say('The day changed. Start review again.',true);changed();return false;}
   const flight=captureFlight(item.practice?'good':value);
   const advance=()=>{
     s.index++;
     s.revealed=false;
     s.peek=false;
     s.arrive=s.index;
     if(flight)flights.push(flight);
     if(s.index>=s.list.length){s.arrive=-1;moment('end');if(flight?.pile)doneFrom={rect:flight.pile,where:flight.where};}
   };
   if(item.practice){advance();s.done++;say(`${Math.max(0,s.list.length-s.index)} to go`,false,true);if(!renderHere())changed();return true;}
   return transact(d=>{
     const card=d.cards.find(c=>c.id===item.id);
     if(!card||reviewVersion(card,item.side)!==item.base||!M.queue(d,s.day,{tests:tests(s.day),course:s.course}).some(e=>e.id===item.id&&e.side===item.side))
       throw Error('This card changed elsewhere. Start review again.');
     if(!M.answer(d,item.id,item.side,value,s.day,{tests:tests(s.day)}))throw Error('This review could not be saved.');
     M.finishDay(d,s.day,{tests:tests(s.day)});
   },()=>{
     advance();
     s.count++;
     if(value!=='again')s.done++;
     if(value==='again'&&!s.repeated.includes(item.id+':'+item.side)){s.repeated.push(item.id+':'+item.side);s.list.push({...item,practice:true});}
     say(`${Math.max(0,s.list.length-s.index)} to go`,false,true);
   },{here:true});
  }
  async function exportCards(format){
    const cards=deck().cards.filter(c=>filter==='all'||c.c===filter),
      payload={name:'review-deck-'+(filter==='all'?'all':filter)+'.'+format,text:M.exportText(cards,{format}),type:format==='csv'?'text/csv;charset=utf-8':'text/tab-separated-values;charset=utf-8'};
    if(onExport)
      await onExport(payload);
    else{
      const d=container?.ownerDocument||root.document;
      if(!d?.createElement||!root.URL?.createObjectURL)throw Error('Export is unavailable.');
      const url=root.URL.createObjectURL(new Blob([payload.text],{type:payload.type})),a=d.createElement('a');
      urls.add(url);
      try{a.href=url;a.download=payload.name;d.body.append(a);a.click();}finally{a.remove();root.setTimeout(()=>{root.URL.revokeObjectURL(url);urls.delete(url);},0);}
    }
    say('Cards exported.');
    changed();
  }
  function openDrawer(which,opener){
    drawer=true;
    tab=which;
    confirmDelete='';
    if(opener)drawerOpener=String(opener);
    if(session?.editing){editors.delete(session.editing);session.editing=null;activeEditor='new';}
    focusNext='#review-deck-tab-'+which;
  }
  async function action(name,data={}){
   if(!String(name).startsWith(PREFIX))return false;if(!allowed())return true;const d=data?.dataset||data;if(busy)return true;hadFocus=focusInside();busyFor(800);
   try{switch(name.slice(PREFIX.length)){
    case 'tab':
      {
        if(d.tab==='review'){if(session){drawer=false;session.away=false;say('');changed();}break;}
        if(!['cards','add','import','settings'].includes(d.tab))break;
        if(d.course&&(d.course==='all'||courseId(d.course))&&d.course!==filter){filter=String(d.course);limit=100;}
        openDrawer(d.tab,d.rvOpener||(drawer?drawerOpener:''));
        say('');
        if(!renderHere())changed();
        break;
      }
    case 'open':
      {
        if(sheet)break;
        const tabbed=d.from==='tab',mod=container?.querySelector?.('[data-rv-mod]'),frameNode=tabbed?container?.querySelector?.('.rd-workspace-tab[data-tab="review"]'):mod?.closest?.('.rd-widget')||mod;
        grow={at:Date.now(),rect:frameNode?.getBoundingClientRect?.(),card:tabbed?null:mod?.querySelector?.('.rv-cardwrap')?.getBoundingClientRect?.()};
     if(grow.rect?.width&&!tabbed){const g=grow.rect;modRect={left:g.left,top:g.top,width:g.width,height:g.height};}busyFor(900);openerTab=tabbed;
     // the control that opened the room is where focus comes back to when it folds (its key survives redraws)
     openerKey=String(d.rdKey||'').replace(/[^\w-]/g,'');
     if(d.start==='all'||courseId(d.start)){start(d.start);session.arrive=0;}
     else if(d.resume==='true'&&session&&!finished()){session.away=false;session.arrive=-1;}else if(live())session.arrive=-1;
     if(d.open==='add'||d.open==='cards'){if(d.course==='all'||courseId(d.course))filter=String(d.course);if(d.open==='add')activeEditor='new';openDrawer(d.open,'cabinet');}else focusNext='card';
     if(motion()==='gentle'&&grow.rect?.width&&doc?.createElement&&win?.requestAnimationFrame){const g=grow;g.sheet=growSheet(g.rect,frameNode,()=>go('review'));
      // (a room not built ahead of time is built while the sheet grows, once the press has answered: the sheet moves on the
      // compositor meanwhile, and the room is only shown when the sheet is over its place)
      if(typeof onGrow==='function')win.setTimeout?.(()=>{if(!dead&&sheet===g.sheet)onGrow();},0);}
     else dipThen(frameNode,'scale(.975)',90,()=>go('review'));break;}
    case 'fold':
      {
        if(retreatSheet())break;
        const page=container?.querySelector?.('[data-review-deck]');
        const f={at:Date.now(),rect:page?.getBoundingClientRect?.()};
        fold=f;
        if(session)session.arrive=-1;
        focusNext='opener';
     // a room over Home (dashboard.js) folds by itself: Home is there under it from the first frame
     if(page?.closest?.('.rd-roomlayer')){
       f.over=true;
       foldOver(page,f);
       const b=container.querySelector('[data-rv-go="work"]');
       if(b&&typeof b.click==='function')b.click();else changed();
       schedulePaint();
       break;
     }
     // the room starts folding in this frame; Home is drawn under it once that first frame is on screen
     if(motion()==='gentle'&&page&&f.rect?.width&&doc?.createElement&&win?.requestAnimationFrame&&(f.away=foldAway(page,f.rect))){
       let gone=false;
       const home=()=>{if(!gone&&!dead){gone=true;go('work');}};
       win.requestAnimationFrame(()=>win.setTimeout?.(home,0));
       win.setTimeout?.(home,70);
     }
     else dipThen(page,'translateY(3px) scale(.99)',140,()=>go('work'));
     break;
    }
    case 'drawer-close':
      closing=drawer?captureDrawer():null;
      drawer=false;
      confirmDelete='';
      focusNext=drawerOpener?`[data-rv-opener="${drawerOpener.replace(/[^\w-]/g,'')}"]`:'';
      say('');
      if(!renderHere())changed();
      break;
    case 'big':
      {
        const page=container?.querySelector?.('[data-review-deck]'),at=sel=>page?.querySelector?.(sel)?.getBoundingClientRect?.()||null;
        bigFrom={card:at('.rv-cardwrap'),under:at('.rv-study .rv-under')};
        big=!bigOn();
        rememberBig(big);
        focusNext='[data-rd-key="rv-big"]';
        if(!renderHere())changed();
        break;
      }
    case 'new':activeEditor='new';openDrawer('add',d.rvOpener||(drawer?drawerOpener:'new'));say('');changed();break;
    case 'edit':
      {
        const card=deck().cards.find(c=>c.id===d.id);
        if(!card)break;
        if(!editors.has(card.id))editors.set(card.id,{edit:card.id,front:card.f,back:card.b,course:card.c,twoWay:card.two,base:JSON.stringify(card),revision:0});
        activeEditor=card.id;
     if(live()&&current()?.id===card.id&&(d.session==='true'||!drawer)){session.editing=card.id;drawer=false;focusNext='edit';}else openDrawer('add',drawerOpener);
     say('');
     if(!renderHere())changed();
     break;
    }
    case 'edit-cancel':
      if(session?.editing){
        editors.delete(session.editing);
        if(activeEditor===session.editing)activeEditor='new';
        session.editing=null;
        putDown=true;
        focusNext='[data-rd-key="rv-pencil"]';
        say('');
        if(!renderHere())changed();
      }
      break;
    case 'save':await saveCard();break;
    case 'preview':paste.preview=M.parseList(paste.text,{format:paste.format,remaining:M.LIMITS.cards-deck().cards.length});say('');changed();break;
    case 'import':await importCards();break;
    case 'search':appliedQuery=query;limit=100;rowMenu='';changed();break;
    case 'filter':
      if(d.course==='all'||courseId(d.course)){filter=String(d.course);limit=100;confirmDelete='';rowMenu='';focusNext=`[data-rd-key="rv-ctab-${String(d.course).replace(/[^\w-]/g,'')}"]`;changed();}
      break;
    case 'rowmenu':rowMenu=rowMenu===d.id?'':String(d.id||'');confirmDelete='';focusNext=`[data-rd-key="rv-rowtag-${String(d.id||'').replace(/[^\w-]/g,'')}"]`;changed();break;
    case 'more':limit+=100;changed();break;
    case 'pause':await transact(value=>{const card=value.cards.find(c=>c.id===d.id);if(!card)throw Error('This card was deleted.');card.paused=!card.paused;},()=>say('Saved.'));break;
    case 'delete':
      if(confirmDelete!==d.id){confirmDelete=d.id;changed();}
      else await transact(value=>{
        const at=value.cards.findIndex(c=>c.id===d.id);
        if(at<0)throw Error('This card was already deleted.');
        value.cards.splice(at,1);
      },()=>{confirmDelete='';say('Card deleted.');});
      break;
    case 'start':start(d.course);opening=captureOpen();focusNext='card';if(!renderHere())changed();break;
    case 'resume':if(session&&!finished()){session.away=false;session.arrive=session.index;drawer=false;focusNext='card';say('');if(!renderHere())changed();}break;
    case 'leave':
      if(session){
        leaving=captureLeave();
        if(finished())session=null;else{session.away=true;if(session.editing){editors.delete(session.editing);activeEditor='new';session.editing=null;}}
        focusNext='.rv-primary';
        say('');
        if(!renderHere())changed();
      }
      break;
    case 'finish':leaving=captureLeave();session=null;focusNext='.rv-primary';say('');if(!renderHere())changed();break;
    case 'reveal':if(session?.list[session.index]&&!session.editing){session.revealed=true;session.peek=false;if(!turnHere())changed();}break;
    case 'turn':if(session?.revealed&&!session.editing){turnFrom=captureTurn();session.peek=!session.peek;if(!turnHere())changed();}break;
    case 'grade':await grade(d.grade);break;
    case 'skip':if(session){session.index++;session.revealed=false;session.peek=false;session.arrive=session.index;if(!renderHere())changed();}break;
    case 'export':await exportCards('tsv');break;
    case 'save-limits':
      {
        if(!schedule)scheduleView(deck());
        const captured={...schedule};
        await transact(value=>{value.settings={...value.settings,newPerDay:Number(captured.newPerDay),maxReviews:Number(captured.maxReviews)};},()=>say('Saved.'));
        break;
      }
    case 'save-date':
    case 'clear-date':
      {
        if(!schedule)scheduleView(deck());
        const captured={...schedule},clear=name.endsWith('clear-date');
        if(!clear&&!M.validDay(captured.date))throw Error('Choose a valid test date.');
        if(!courseId(captured.course))throw Error('Choose a course.');
        await transact(value=>{
          if(clear)delete value.testDates[captured.course];else value.testDates[captured.course]=captured.date;
        },()=>{if(schedule?.revision===captured.revision&&clear)schedule.date='';say('Saved.');});
        break;
      }
    default:return false;
   }}catch(error){if(allowed()){say(error?.message||'The action could not finish.',true);changed();}}return true;
  }
  function input(fieldName,value){
   const target=typeof fieldName==='object'?fieldName.composedPath?.()[0]||fieldName.target:null;
   let name=target?.dataset?.rdField||fieldName;
   if(!String(name).startsWith(PREFIX))return false;
   if(!allowed())return true;
   name=String(name).slice(PREFIX.length);
   const v=target?(target.type==='checkbox'?target.checked:target.value):value;
   if(['front','back','editor-course','two-way'].includes(name)){
     const d=editor(),key={'editor-course':'course','two-way':'twoWay'}[name]||name;
     if(key==='course'&&!courseId(v))return true;
     d[key]=key==='twoWay'?v===true:String(v??'');
     d.revision++;
     if(name==='front'){const box=container?.querySelector?.(`[data-rd-field="${PREFIX}two-way"]`);if(box){const cloze=M.isCloze(d.front);box.disabled=cloze;box.checked=d.twoWay&&!cloze;}}
     return true;
   }
   if(name==='query'){query=String(v??'');return true;}
   if(name==='course'){if(v==='all'||courseId(v)){filter=String(v);limit=100;confirmDelete='';changed();}return true;}
   if(['import-text','import-course','import-format','import-two-way'].includes(name)){
     if(name==='import-course'&&!courseId(v)||name==='import-format'&&!['auto','text','csv','tsv'].includes(v))return true;
     paste[{'import-text':'text','import-course':'course','import-format':'format','import-two-way':'twoWay'}[name]]=name==='import-two-way'?v===true:String(v??'');
     paste.preview=null;
     importRevision++;
     return true;
   }
   if(['new-per-day','max-reviews','test-course','test-date'].includes(name)){
     if(!schedule)scheduleView(deck());
     if(name==='test-course'&&!courseId(v))return true;
     schedule[{'new-per-day':'newPerDay','max-reviews':'maxReviews','test-course':'course','test-date':'date'}[name]]=String(v??'');
     if(name==='test-course'){schedule.date=deck().testDates[String(v)]||'';changed();}
     schedule.revision++;
     return true;
   }
   return false;
  }
  async function readFile(file){
   if(!allowed()||!file)return false;const sequence=++fileSequence,revision=importRevision;
   try{
     if(!Number.isFinite(file.size)||file.size<0||file.size>M.LIMITS.importBytes)throw Error(`Imports hold up to ${M.LIMITS.importBytes} bytes.`);
     if(typeof file.text!=='function')throw Error('The text file could not be read.');
     const value=await file.text();
     if(!allowed()||sequence!==fileSequence||revision!==importRevision)return false;
     const format=paste.format==='auto'&&/\.(csv|tsv)$/i.test(file.name||'')?(file.name.toLowerCase().endsWith('.csv')?'csv':'tsv'):paste.format,
       p=M.parseList(value,{format,remaining:M.LIMITS.cards-deck().cards.length});
     if(p.problems.some(e=>/bytes/.test(e.message)))throw Error(p.problems[0].message);
     paste.text=value;
     paste.preview=p;
     paste.format=format;
     importRevision++;
     say('');
     changed();
     return true;
   }catch(error){if(allowed()&&sequence===fileSequence&&revision===importRevision){say(error?.message||'The text file could not be read.',true);changed();}return false;}
  }
  function change(event){
    const target=event?.composedPath?.()[0]||event?.target;
    if(target?.dataset?.rdField===PREFIX+'file'){readFile(target.files?.[0]);return true;}
    return input(event);
  }
  // Keys: Space turns the card, 1 2 3 grade, E edits, Esc leaves (the page folds back; in the module the session waits).
  function keydown(event){
   // the Focus room open over the deck owns every key
   if(!allowed()||event.repeat||container?.dataset?.chRoom)return false;
   if(event.key==='Escape'&&sheet?.state==='growing'){event.preventDefault?.();retreatSheet();return true;}
   const target=event.composedPath?.()[0]||event.target,page=isSelected(),inMod=!!target?.closest?.('[data-rv-mod]'),inPage=!!target?.closest?.('[data-review-deck]');
   if(!page&&!inMod)return false;
   if(target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName||'')){
    if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&(session?.editing&&(inPage||inMod)||drawer&&tab==='add')){event.preventDefault();action(PREFIX+'save');return true;}
    if(event.key==='Enter'&&target?.dataset?.rdField===PREFIX+'query'&&drawer){event.preventDefault();action(PREFIX+'search');return true;}
    if(event.key==='Escape'&&(inPage||inMod)&&(session?.editing||drawer&&inPage)){event.preventDefault();action(PREFIX+(session?.editing?'edit-cancel':'drawer-close'));return true;}
    return false;
   }
   const tabButton=target?.closest?.('[role="tab"][data-rd-action="review-deck-tab"]');
   if(tabButton&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
     const keys=['cards','add','import','settings'],
       at=keys.indexOf(tabButton.dataset.tab),
       next=event.key==='Home'?0:event.key==='End'?keys.length-1:(at+(event.key==='ArrowRight'?1:-1)+keys.length)%keys.length;
     event.preventDefault();
     tab=keys[next];
     focusNext='#review-deck-tab-'+tab;
     changed();
     container?.querySelector?.('#review-deck-tab-'+tab)?.focus?.();
     return true;
   }
   if(event.ctrlKey||event.metaKey||event.altKey)return false;
   const loose=!target||target===container||target===doc?.body||target===container?.getRootNode?.()?.host;
   if(!inMod&&!(page&&(inPage||loose)))return false;
   const s=session;
   if(event.key==='Escape'){
    if(s?.editing){event.preventDefault();action(PREFIX+'edit-cancel');return true;}
    if(drawer&&!inMod){event.preventDefault();action(PREFIX+'drawer-close');return true;}
    // a big card goes back down first; the next Escape folds the room
    if(!inMod&&live()&&!finished()&&bigOn()){event.preventDefault();action(PREFIX+'big');return true;}
    if(!inMod){if(!container?.querySelector?.('[data-rv-fold]'))return false;event.preventDefault();action(PREFIX+'fold');return true;}
    if(live()&&!finished()){event.preventDefault();action(PREFIX+'leave');return true;}
    return false;
   }
   const item=current();if(!live()||!item||s.editing||inMod&&!container?.querySelector?.('[data-rv-mod][data-rv-mode="study"]'))return false;
   if(event.key===' '&&!target?.closest?.('button,a,summary')){event.preventDefault();action(PREFIX+(s.revealed?'turn':'reveal'));return true;}
   if(s.revealed&&['1','2','3'].includes(event.key)){event.preventDefault();action(PREFIX+'grade',{grade:['again','good','easy'][Number(event.key)-1]});return true;}
   if(event.key==='e'||event.key==='E'){event.preventDefault();action(PREFIX+'edit',{id:item.id,session:'true'});return true;}
   if((event.key==='b'||event.key==='B')&&!inMod){event.preventDefault();action(PREFIX+'big');return true;}
   return false;
  }
  function visibility(){if(world){if(doc.visibilityState==='hidden')world.setAttribute('data-paused','');else world.removeAttribute('data-paused');}}
  function resize(){const page=container?.querySelector?.('[data-review-deck]');if(page)measure(page);}
  let listening=false;
  function listen(){if(listening)return;listening=true;doc?.addEventListener?.('visibilitychange',visibility);win?.addEventListener?.('resize',resize);}
  function destroy(){
    dead=true;
    if(sheet){try{sheet.anim?.cancel();}catch{}sheet.el?.remove();sheet=null;}
    fileSequence++;
    erase();
    for(const url of urls)root.URL?.revokeObjectURL?.(url);
    urls.clear();
    for(const t of timers)win?.clearTimeout?.(t);
    timers.clear();
    if(listening){doc?.removeEventListener?.('visibilitychange',visibility);win?.removeEventListener?.('resize',resize);}
    world?.remove?.();
    world=null;
    container?.querySelector?.(':scope > .rv-fly')?.remove?.();
  }
  // shown by its tab or a link (no growing out of the module): focus goes into the room once it is drawn
  function shown(){if(!focusNext)focusNext='card';schedulePaint();}
  // The Review tab (dashboard.js): the room grows out of the tab on a sheet, and is shown under it once the sheet has
  // grown; false where nothing grows (Motion Still or Off, no frames), and the dashboard shows the room itself.
  let openerTab=false;
  function growFromTab(){
   if(dead||!allowed()||sheet||motion()!=='gentle'||!win?.requestAnimationFrame||!doc?.createElement)return false;
   const tabNode=container?.querySelector?.('.rd-workspace-tab[data-tab="review"]'),r=tabNode?.getBoundingClientRect?.();if(!r?.width)return false;
   void action(PREFIX+'open',{from:'tab'});return true;
  }
  const controller={
    renderReviewDeck,
    render:renderReviewDeck,
    renderModule,
    moduleOpener,
    action,
    input,
    change,
    keydown,
    readFile,
    destroy,
    prebuild,
    redrawModule,
    shown,
    growFromTab,
    takeQuietSave(){
    const q=quietSave;
    quietSave=false;
    return q;
  },sync(){if(allowed())changed();},getState(){return allowed()?copy({tab,drawer,filter,editor:editor(),import:paste,session,busy,status,failed}):null;}};
  for(const [name,method] of Object.entries({
    handleReviewDeckAction:action,
    handleReviewDeckInput:input,
    handleReviewDeckChange:change,
    handleReviewDeckKeydown:keydown
  }))
    controller[name]=method;
  return controller;
 }
 // Home module hooks for widgets.js: the controller rides on the view context (c.reviewDeck).
 const moduleAvailable=()=>!root.ReserveFeatures||root.ReserveFeatures.enabled('review-deck')===true;
 const renderModule=(c,h)=>moduleAvailable()&&typeof c?.reviewDeck?.renderModule==='function'?c.reviewDeck.renderModule(c,h):'';
 const moduleOpener=(c,h)=>moduleAvailable()&&typeof c?.reviewDeck?.moduleOpener==='function'?c.reviewDeck.moduleOpener(c,h):'';
 const api={create,featureId:'review-deck',renderModule,moduleOpener,moduleAvailable,dayWord};root.ReserveReviewDeck=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
