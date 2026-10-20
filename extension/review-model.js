/* Canvas Harness review deck: the rules, without any page. A student keeps flashcards for their courses; each day
   Harness shows the cards that are due. A card answered Good comes back after the next wait (1, 2, 4, 8, 16, 32,
   64 days), Easy skips a wait, Again brings it back tomorrow. A card can also be asked the other way round (two-way),
   or hide words in {{double braces}} (fill in the blank). Before a course's test or quiz, its cards come first and
   none waits past the test day. Everything is kept with the student's personal data on this device (`reviewDeck`).
   Nothing here writes to Canvas. */
(function(root){
 'use strict';
 const STEPS=[1,2,4,8,16,32,64];
 const LIMITS={cards:2000,side:1000,newPerDay:[0,50],maxReviews:[10,500],log:120,boostDays:14,src:300};
 const DEFAULT_SETTINGS={newPerDay:10,maxReviews:100};
 const LEARNED=5;   // a card waiting 16 days or more counts as learned
 const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const text=(v,max)=>typeof v==='string'?v.replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').slice(0,max):'';
 const validDay=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'));
 const addDays=(day,n)=>{const t=new Date(day+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10);};
  const int=(v,[lo,hi],fallback)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.round(v))):fallback;
 const newId=()=>'rc-'+(root.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`);

 /* ---- fill in the blank ---- */
 const CLOZE=/\{\{([^{}]{1,300})\}\}/g;
 const isCloze=f=>{CLOZE.lastIndex=0;const ok=CLOZE.test(f);CLOZE.lastIndex=0;return ok;};
 // The question hides each {{part}}; the answer shows it. Plain strings: the page escapes them.
 function clozeParts(f){const out=[];let last=0,m;CLOZE.lastIndex=0;while((m=CLOZE.exec(f))){out.push({text:f.slice(last,m.index)},{hidden:m[1]});last=m.index+m[0].length;}out.push({text:f.slice(last)});return out.filter(p=>p.text!==''||p.hidden!==undefined);}

 /* ---- cleaning (storage.js runs every save through this) ---- */
 function cleanSide(v){
  const s=isRecord(v)?v:{};
  return {box:int(s.box,[0,STEPS.length],0),due:validDay(s.due)?s.due:'',lapses:int(s.lapses,[0,999],0)};
 }
 function cleanCard(v){
  if(!isRecord(v))return null;
  const f=text(v.f,LIMITS.side).trim(),b=text(v.b,LIMITS.side).trim(),cloze=isCloze(f);
  if(!f||(!b&&!cloze))return null;
  const id=typeof v.id==='string'&&/^rc-[\w-]{4,60}$/.test(v.id)?v.id:null;if(!id)return null;
  const c=typeof v.c==='string'&&/^(?:\d{1,20}|personal)$/.test(v.c)?v.c:'personal';
  const two=v.two===true&&!cloze&&!!b;
  const card={id,c,f,b,two,added:validDay(v.added)?v.added:'',paused:v.paused===true,s:{f:cleanSide(v.s?.f)}};
  if(two)card.s.b=cleanSide(v.s?.b);
  if(isRecord(v.src)){const url=text(v.src.url,LIMITS.src),title=text(v.src.title,200).trim();if(/^https:\/\//.test(url))card.src={url,title};}
  return card;
 }
 function cleanDeck(v){
  const d=isRecord(v)?v:{},ids=new Set(),cards=[];
  for(const raw of Array.isArray(d.cards)?d.cards:[]){const c=cleanCard(raw);if(c&&!ids.has(c.id)){ids.add(c.id);cards.push(c);}if(cards.length>=LIMITS.cards)break;}
  const st=isRecord(d.settings)?d.settings:{};
  const settings={newPerDay:int(st.newPerDay,LIMITS.newPerDay,DEFAULT_SETTINGS.newPerDay),maxReviews:int(st.maxReviews,LIMITS.maxReviews,DEFAULT_SETTINGS.maxReviews)};
  const log=(Array.isArray(d.log)?d.log:[]).filter(e=>isRecord(e)&&validDay(e.d)).map(e=>({d:e.d,n:int(e.n,[0,5000],0),r:int(e.r,[0,5000],0),w:int(e.w,[0,5000],0),done:e.done===true}))
   .sort((a,b)=>a.d.localeCompare(b.d)).filter((e,i,a)=>i===a.length-1||a[i+1].d!==e.d).slice(-LIMITS.log);
  return {cards,settings,log};
 }

 /* ---- making cards ---- */
 function makeCard({front,back='',course='personal',twoWay=false,src=null,today=''}){
  return cleanCard({id:newId(),c:String(course||'personal'),f:front,b:back,two:twoWay,src,added:today,s:{f:{},b:{}}});
 }
 // Why a card can't be made, or ''.
 function checkCard(front,back){
  const f=String(front||'').trim(),b=String(back||'').trim();
  if(!f)return 'Write the front of the card.';
  if(f.length>LIMITS.side||b.length>LIMITS.side)return `Each side holds up to ${LIMITS.side.toLocaleString()} characters.`;
  if(/\{\{|\}\}/.test(f)&&!isCloze(f))return 'Close each blank with two braces: {{like this}}.';
  if(!b&&!isCloze(f))return 'Write the back, or hide words in the front with {{double braces}}.';
  return '';
 }
 // A pasted list: one card per line, "term – definition", "term: definition", "term = definition" or a tab between
 // (what Quizlet and Anki export). Lines that can't be split come back as problems, with their line numbers.
 const SEPARATORS=['\t',' – ',' — ',' - ',' = ',': ','='];
 function parseList(input){
  const cards=[],problems=[];
  String(input||'').replace(/\r\n?/g,'\n').split('\n').forEach((line,i)=>{
   const raw=line.trim();if(!raw)return;
   // A fill-in-the-blank line is a sentence, so only a tab splits it (the rest is a note for the back).
   const cloze=isCloze(raw),sep=(cloze?['\t']:SEPARATORS).find(s=>raw.includes(s));
   if(!sep){if(cloze)cards.push({front:raw,back:''});else problems.push({line:i+1,text:raw.slice(0,80)});return;}
   const at=raw.indexOf(sep),front=raw.slice(0,at).trim(),back=raw.slice(at+sep.length).trim();
   if(!front||!back)problems.push({line:i+1,text:raw.slice(0,80)});else cards.push({front,back});
  });
  return {cards:cards.slice(0,LIMITS.cards),problems};
 }
 // The same format back: one "front<TAB>back" line per card, for Quizlet, Anki or another Harness.
 function exportText(cards){return (cards||[]).map(c=>`${String(c.f).replace(/[\t\n]+/g,' ')}\t${String(c.b).replace(/[\t\n]+/g,' ')}`).join('\n');}

 /* ---- tests ahead ---- */
 const TEST_NAME=/\b(test|exam|midterm|mid-term|final|quiz)\b/i;
 // The first test or quiz in the next two weeks for each course: {courseId: 'YYYY-MM-DD'}. items: Harness's assignments.
 function testsAhead(items,today,dayOf){
  const out={},until=addDays(today,LIMITS.boostDays);
  for(const it of items||[]){
   if(!it?.dueAt||!(Array.isArray(it.submissionTypes)&&it.submissionTypes.includes('online_quiz')||TEST_NAME.test(it.name||'')))continue;
   const day=dayOf(it.dueAt);if(!day||day<today||day>until)continue;
   const c=String(it.courseId);if(!out[c]||day<out[c])out[c]=day;
  }
  return out;
 }

 /* ---- the day's cards ---- */
 const sidesOf=card=>card.two?['f','b']:['f'];
 const todayLog=(deck,today)=>deck.log.find(e=>e.d===today)||{d:today,n:0,r:0,w:0,done:false};
 // What to review today, in order: due cards first (a course with a test soon before the others, then the longest
 // waiting), then new cards up to the day's limit. Each entry is a card id and a side ('f' front first, 'b' back first).
 function queue(deckValue,today,{tests={}}={}){
  const deck=cleanDeck(deckValue),log=todayLog(deck,today),soon=c=>tests[c]||'9999-12-31';
  const due=[],fresh=[];
  deck.cards.forEach((card,at)=>{if(card.paused)return;for(const side of sidesOf(card)){const s=card.s[side];
   if(s.box>0&&s.due&&s.due<=today)due.push({card,side,due:s.due,at});else if(s.box===0)fresh.push({card,side,at});}});
  due.sort((a,b)=>soon(a.card.c).localeCompare(soon(b.card.c))||a.due.localeCompare(b.due)||a.card.id.localeCompare(b.card.id));
  fresh.sort((a,b)=>soon(a.card.c).localeCompare(soon(b.card.c))||String(a.card.added).localeCompare(String(b.card.added))||a.at-b.at||(a.side===b.side?0:a.side==='f'?-1:1));
  const reviews=due.slice(0,Math.max(0,deck.settings.maxReviews-log.r));
  // A two-way card's second side waits until its first side has been seen.
  const newer=fresh.filter(x=>x.side==='f'||x.card.s.f.box>0).slice(0,Math.max(0,deck.settings.newPerDay-log.n));
  return [...reviews,...newer].map(x=>({id:x.card.id,side:x.side,fresh:x.card.s[x.side].box===0}));
 }
 // Where a side goes after an answer. Before a test, nothing waits past the test day (but always until tomorrow).
 function next(s,grade,today,test){
  const box=grade==='again'?1:Math.min(STEPS.length,Math.max(1,s.box)+(s.box===0?0:1)+(grade==='easy'?1:0));
  let due=addDays(today,grade==='again'?1:STEPS[box-1]);
  if(test&&test>today&&due>test)due=test;
  return {box,due};
 }
 // The wait each answer would give, for the buttons: {again:'2026-10-21', good:…, easy:…}.
 function preview(deckValue,id,side,today,{tests={}}={}){
  const card=(deckValue?.cards||[]).find(c=>c.id===id),s=card?.s?.[side]||{box:0};
  return Object.fromEntries(['again','good','easy'].map(g=>[g,next(cleanSide(s),g,today,tests[card?.c]).due]));
 }
 // An answer: 'again', 'good' or 'easy'. Changes the deck in place and returns the side's next due day.
 function answer(deck,id,side,grade,today,{tests={}}={}){
  const card=deck.cards.find(c=>c.id===id);if(!card||!['again','good','easy'].includes(grade))return null;
  const s=card.s[side]||(card.s[side]=cleanSide({}));const wasNew=s.box===0;
  const {box,due}=next(s,grade,today,tests[card.c]);
  if(grade==='again'&&!wasNew)s.lapses++;
  s.box=box;s.due=due;
  let log=deck.log.find(e=>e.d===today);if(!log){log={d:today,n:0,r:0,w:0,done:false};deck.log.push(log);}
  if(wasNew)log.n++;else log.r++;if(grade==='again')log.w++;
  deck.log=deck.log.slice(-LIMITS.log);
  return due;
 }
 // The day is finished once its queue is empty after at least one answer.
 function finishDay(deck,today){const log=deck.log.find(e=>e.d===today);if(!log||log.done||!(log.n+log.r))return false;log.done=true;return true;}

 /* ---- numbers ---- */
 function stats(deckValue,today,{tests={}}={}){
  const deck=cleanDeck(deckValue),q=queue(deck,today,{tests}),courses={};
  let learned=0,total=0;
  const ahead=Array.from({length:7},(_,i)=>({d:addDays(today,i+1),n:0}));
  for(const card of deck.cards){
   const c=courses[card.c]||(courses[card.c]={cards:0,due:0});c.cards++;total++;
   for(const side of sidesOf(card)){const s=card.s[side];if(s.box>=LEARNED)learned++;
    if(!card.paused&&s.box>0&&s.due>today){const slot=ahead.find(a=>a.d===s.due);if(slot)slot.n++;}}
  }
  for(const x of q){const c=courses[deck.cards.find(card=>card.id===x.id)?.c];if(c)c.due++;}
  const days=new Set(deck.log.filter(e=>e.n+e.r>0).map(e=>e.d));let streak=0;
  for(let i=days.has(today)?0:1;i<400;i++){if(days.has(addDays(today,-i)))streak++;else break;}
  const log=todayLog(deck,today);
  return {due:q.length,fresh:q.filter(x=>x.fresh).length,minutes:Math.max(1,Math.round(q.length*8/60)),total,learned,streak,courses,ahead,
   today:{reviewed:log.n+log.r,missed:log.w,done:log.done},boosted:Object.keys(tests).filter(c=>courses[c]?.due)};
 }

 const api={STEPS,LIMITS,DEFAULT_SETTINGS,LEARNED,isCloze,clozeParts,cleanCard,cleanDeck,makeCard,checkCard,parseList,exportText,testsAhead,queue,answer,preview,finishDay,stats,addDays};
 root.ReserveReviewModel=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
