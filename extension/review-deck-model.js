/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
// Adapted from Gary Wu's pull request #44 to Canvas Harness.
(function(root){
 'use strict';
 const STEPS=Object.freeze([1,2,4,8,16,32,64]),LEARNED=5;
 const LIMITS=Object.freeze({cards:2000,side:1000,newPerDay:[0,50],maxReviews:[10,500],log:120,boostDays:14,importBytes:4000000,deckBytes:6000000});
 const DEFAULT_SETTINGS=Object.freeze({newPerDay:10,maxReviews:100});
 const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),courseId=v=>typeof v==='string'&&/^(?:\d{1,20}|personal)$/.test(v);
 const text=v=>typeof v==='string'?v.replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,''):'';
 const bytes=v=>new TextEncoder().encode(v).length;
 const integer=(v,min,max,fallback)=>v===undefined?fallback:Number.isInteger(v)&&v>=min&&v<=max?v:(()=>{throw Error('Invalid review deck limit or history.');})();
 function validDay(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;}
 function addDays(day,n){if(!validDay(day)||!Number.isInteger(n))throw Error('Invalid review day.');const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);const result=d.toISOString().slice(0,10);if(!validDay(result))throw Error('Invalid review day.');return result;}
 function clozeParts(front){const out=[],pattern=/\{\{([^{}]+)\}\}/g;let last=0,m;while((m=pattern.exec(text(front)))){if(m.index>last)out.push({text:text(front).slice(last,m.index)});out.push({hidden:m[1]});last=m.index+m[0].length;}if(last<text(front).length)out.push({text:text(front).slice(last)});return out;}
 const isCloze=front=>clozeParts(front).some(p=>p.hidden!==undefined);
 function checkCard(front,back=''){
  if(typeof front!=='string'||!text(front).trim())return 'Write the front of the card.';
  if(typeof back!=='string')return 'Write the back as text.';
  if(front.length>LIMITS.side||back.length>LIMITS.side)return `Each side holds up to ${LIMITS.side} characters.`;
  if(/\{\{|\}\}/.test(text(front).replace(/\{\{([^{}]+)\}\}/g,'')))return 'Close each blank with two braces: {{like this}}.';
  if(!text(back).trim()&&!isCloze(front))return 'Write the back, or hide words in the front with {{double braces}}.';
  return '';
 }
 function cleanSide(value){
  if(value!==undefined&&!record(value))throw Error('Invalid review history.');const s=value||{};
  for(const key of ['due','first','last'])if(s[key]!==undefined&&s[key]!==''&&!validDay(s[key]))throw Error('Invalid review history date.');
  const side={box:integer(s.box,0,STEPS.length,0),due:s.due||'',lapses:integer(s.lapses,0,100000,0),first:s.first||'',last:s.last||''};
  if(side.first&&side.last&&side.first>side.last)throw Error('Invalid review history order.');return side;
 }
 function cleanCard(value){
  if(!record(value)||typeof value.id!=='string'||!/^rc-[\w-]{4,60}$/.test(value.id)||!courseId(value.c)||checkCard(value.f,value.b===undefined?'':value.b))return null;
  if(value.added!==undefined&&value.added!==''&&!validDay(value.added))return null;
  if(value.s!==undefined&&!record(value.s))return null;
  const two=value.two===true&&!isCloze(value.f),card={id:value.id,c:value.c,f:text(value.f).trim(),b:text(value.b??'').trim(),two,added:value.added||'',paused:value.paused===true,s:{f:cleanSide(value.s?.f)}};
  if(two)card.s.b=cleanSide(value.s?.b);return card;
 }
 function cleanDeck(value){
  if(value===undefined||value===null)value={};if(!record(value)||value.version!==undefined&&value.version!==1)throw Error('Invalid review deck.');
  if(value.cards!==undefined&&!Array.isArray(value.cards)||value.log!==undefined&&!Array.isArray(value.log)||value.settings!==undefined&&!record(value.settings)||value.testDates!==undefined&&!record(value.testDates))throw Error('Invalid review deck structure.');
  if((value.cards?.length||0)>LIMITS.cards)throw Error(`A review deck holds up to ${LIMITS.cards} cards.`);
  if((value.log?.length||0)>LIMITS.log)throw Error('Review history is too large.');
  const cards=[],ids=new Set();for(const raw of value.cards||[]){const card=cleanCard(raw);if(!card||ids.has(card.id))throw Error('A review card is invalid or duplicated.');ids.add(card.id);cards.push(card);}
  const st=value.settings||{},settings={newPerDay:integer(st.newPerDay,...LIMITS.newPerDay,DEFAULT_SETTINGS.newPerDay),maxReviews:integer(st.maxReviews,...LIMITS.maxReviews,DEFAULT_SETTINGS.maxReviews)};
  const testDates={},log=[],days=new Set();for(const [id,day] of Object.entries(value.testDates||{})){if(!courseId(id)||!validDay(day))throw Error('Invalid review test date.');testDates[id]=day;}
  if(Object.keys(testDates).length>500)throw Error('Too many review test dates.');
  for(const e of value.log||[]){if(!record(e)||!validDay(e.d)||days.has(e.d))throw Error('Invalid or duplicated review day.');days.add(e.d);log.push({d:e.d,n:integer(e.n,0,100000,0),r:integer(e.r,0,100000,0),w:integer(e.w,0,100000,0),done:e.done===true});}
  log.sort((a,b)=>a.d.localeCompare(b.d));const deck={version:1,cards,settings,testDates,log};if(bytes(JSON.stringify(deck))>LIMITS.deckBytes)throw Error('The review deck is too large to save.');return deck;
 }
 function makeCard({front,back='',course='personal',twoWay=false,today='',id}={}){
  if(checkCard(front,back)||!courseId(String(course))||today&&!validDay(today))return null;
  const key=id||'rc-'+(root.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12));
  return cleanCard({id:key,c:String(course),f:front,b:back,two:twoWay,added:today,s:{}});
 }
 const SEPARATORS=['\t',' – ',' — ',' - ',' = ',': ','='];
 function detectFormat(input){
  let quoted=false,tabs=0,commas=0,first='';for(let i=0;i<input.length;i++){const c=input[i];if(c==='"'){if(quoted&&input[i+1]==='"'){first+='"';i++;continue;}quoted=!quoted;}if(!quoted){if(c==='\n'&&first.trim())break;if(c==='\t')tabs++;if(c===',')commas++;}first+=c;}
  if(tabs)return 'tsv';if(commas&&!isCloze(first)&&(!SEPARATORS.some(s=>first.includes(s))||first.trimStart().startsWith('"')))return 'csv';return 'text';
 }
 function delimited(input,separator){
  const rows=[],problems=[];let row=[],field='',quoted=false,closed=false,line=1,start=1;
  const endField=()=>{row.push(field);field='';closed=false;},endRow=()=>{endField();if(row.some(v=>v.trim())||row.length>1)rows.push({fields:row,line:start});row=[];start=line+1;};
  for(let i=0;i<input.length;i++){
   const c=input[i];if(quoted){if(c==='"'){if(input[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else{field+=c;if(c==='\n')line++;}continue;}
   if(c===separator){endField();continue;}if(c==='\n'){endRow();line++;continue;}
   if(c==='"'&&!field&&!closed){quoted=true;continue;}
   if(c==='"'||closed&&!/^[ \t]$/.test(c)){problems.push({line:start,message:'Invalid text after a quoted field.'});return {rows:[],problems};}
   if(!closed)field+=c;
  }
  if(quoted)return {rows:[],problems:[{line:start,message:'A quoted field is not closed.'}]};
  endRow();return {rows,problems};
 }
 function parseList(value,{format='auto',remaining=LIMITS.cards}={}){
  const result={cards:[],problems:[],format,ok:false},fail=(message,line=1)=>{result.problems.push({line,message});return result;};
  if(typeof value!=='string')return fail('Import text is required.');
  if(value.length>LIMITS.importBytes||bytes(value)>LIMITS.importBytes)return fail(`Imports hold up to ${LIMITS.importBytes} bytes.`);
  if(!['auto','text','csv','tsv'].includes(format)||!Number.isInteger(remaining)||remaining<0||remaining>LIMITS.cards)return fail('Invalid import format or capacity.');
  const input=value.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');result.format=format==='auto'?detectFormat(input):format;
  let rows=[];
  if(result.format==='text')input.split('\n').forEach((raw,i)=>{if(!raw.trim())return;const sep=(isCloze(raw)?['\t']:SEPARATORS).find(s=>raw.includes(s));if(!sep){rows.push({fields:[raw,''],line:i+1});return;}const at=raw.indexOf(sep);rows.push({fields:[raw.slice(0,at),raw.slice(at+sep.length)],line:i+1});});
  else{const parsed=delimited(input,result.format==='csv'?',':'\t');if(parsed.problems.length){result.problems=parsed.problems;return result;}rows=parsed.rows;if(rows.length&&/^(front|term|question)$/i.test(rows[0].fields[0].trim())&&/^(back|definition|answer)$/i.test(rows[0].fields[1]?.trim()||''))rows.shift();}
  if(rows.length>remaining)return fail(`The import has ${rows.length} cards; ${remaining} spaces remain.`);
  for(const row of rows){const [front,back='']=row.fields,error=row.fields.length!==2?'Use two fields per card.':checkCard(front,back);if(error)result.problems.push({line:row.line,message:error});else result.cards.push({front:text(front).trim(),back:text(back).trim()});}
  if(!rows.length)return fail('There are no cards to import.');result.ok=!result.problems.length;return result;
 }
 function exportText(cards,{format='tsv',header=true}={}){
  if(!Array.isArray(cards)||cards.length>LIMITS.cards||!['csv','tsv'].includes(format))throw Error('Invalid review export.');const separator=format==='csv'?',':'\t';
  const quote=value=>{const s=String(value);return s.includes(separator)||/["\r\n]/.test(s)||s!==s.trim()?'"'+s.replace(/"/g,'""')+'"':s;};
  const rows=cards.map(c=>{if(checkCard(c.f,c.b))throw Error('Invalid review card.');return [c.f,c.b].map(quote).join(separator);});if(header)rows.unshift(['Front','Back'].join(separator));return rows.join('\n');
 }
 const TEST_NAME=/\b(test|exam|midterm|mid-term|final|quiz)\b/i;
 function testsAhead(items,today,dayOf=value=>String(value).slice(0,10)){
  const tests={},until=addDays(today,LIMITS.boostDays);for(const item of Array.isArray(items)?items:[]){if(!courseId(String(item?.courseId))||!item?.dueAt||!(item.submissionTypes?.includes?.('online_quiz')||TEST_NAME.test(item.name||'')))continue;let day;try{day=dayOf(item.dueAt);}catch{continue;}if(!validDay(day)||day<today||day>until)continue;const id=String(item.courseId);if(!tests[id]||day<tests[id])tests[id]=day;}return tests;
 }
 function activeTests(deck,today,tests={}){const out={},until=addDays(today,LIMITS.boostDays),sources=[deck.testDates||{},record(tests)?tests:{}];for(let at=0;at<sources.length;at++)for(const [id,day] of Object.entries(sources[at])){if(courseId(id)&&validDay(day)&&day>=today&&(at===0||day<=until)&&(!out[id]||day<out[id]))out[id]=day;}return out;}
 const sidesOf=card=>card.two?['f','b']:['f'];
 const todayLog=(deck,today)=>deck.log.find(e=>e.d===today)||{d:today,n:0,r:0,w:0,done:false};
 const backwardReady=(card,today)=>!!card.s.f.first&&card.s.f.first<today;
 const dueDay=(side,test)=>test&&side.due>test?test:side.due;
 function queue(value,today,{tests={},course='all'}={}){
  const deck=cleanDeck(value),boost=activeTests(deck,today,tests),log=todayLog(deck,today),due=[],fresh=[],soon=id=>boost[id]||'9999-12-31';
  deck.cards.forEach((card,at)=>{if(card.paused||course!=='all'&&card.c!==String(course))return;for(const side of sidesOf(card)){const s=card.s[side];if(s.last&&s.last>=today||side==='b'&&!backwardReady(card,today))continue;const entry={id:card.id,side,fresh:s.box===0,course:card.c,at,due:dueDay(s,boost[card.c])||today};if(s.box===0)fresh.push(entry);else if(entry.due<=today)due.push(entry);}});
  const rank=(a,b)=>soon(a.course).localeCompare(soon(b.course));due.sort((a,b)=>rank(a,b)||a.due.localeCompare(b.due)||a.at-b.at);fresh.sort((a,b)=>rank(a,b)||a.at-b.at||(a.side==='f'?-1:1));
  return [...due.slice(0,Math.max(0,deck.settings.maxReviews-log.r)),...fresh.slice(0,Math.max(0,deck.settings.newPerDay-log.n))].map(({id,side,fresh})=>({id,side,fresh}));
 }
 function next(side,grade,today,test){const box=grade==='again'?1:Math.min(STEPS.length,Math.max(1,side.box)+(side.box===0?0:1)+(grade==='easy'?1:0));let due=addDays(today,grade==='again'?1:STEPS[box-1]);if(test&&due>test)due=test;return {box,due};}
 function preview(value,id,side,today,{tests={}}={}){const deck=cleanDeck(value),card=deck.cards.find(c=>c.id===id);if(!card||!sidesOf(card).includes(side))return null;const boost=activeTests(deck,today,tests);return Object.fromEntries(['again','good','easy'].map(grade=>[grade,next(card.s[side],grade,today,boost[card.c]).due]));}
 function answer(deck,id,side,grade,today,{tests={}}={}){
  if(!validDay(today)||!['again','good','easy'].includes(grade))return null;const card=deck.cards.find(c=>c.id===id);if(!card||card.paused||!sidesOf(card).includes(side)||side==='b'&&!backwardReady(card,today))return null;
  const s=card.s[side];if(s.last&&s.last>=today)return null;const fresh=s.box===0,boost=activeTests(deck,today,tests),scheduled=next(s,grade,today,boost[card.c]);
  if(grade==='again'&&!fresh)s.lapses++;Object.assign(s,scheduled,{first:s.first||today,last:today});let log=deck.log.find(e=>e.d===today);if(!log){log={d:today,n:0,r:0,w:0,done:false};deck.log.push(log);}if(fresh)log.n++;else log.r++;if(grade==='again')log.w++;log.done=false;deck.log.sort((a,b)=>a.d.localeCompare(b.d));deck.log=deck.log.slice(-LIMITS.log);return s.due;
 }
 function finishDay(deck,today,options={}){const log=todayLog(deck,today);if(log.done||!(log.n+log.r)||queue(deck,today,options).length)return false;log.done=true;return true;}
 function stats(value,today,{tests={},course='all'}={}){
  const deck=cleanDeck(value),boost=activeTests(deck,today,tests),q=queue(deck,today,{tests,course}),courses={},ahead=Array.from({length:7},(_,i)=>({d:addDays(today,i+1),n:0}));let learned=0,total=0;
  for(const card of deck.cards){if(course!=='all'&&card.c!==String(course))continue;courses[card.c]||={cards:0,due:0};courses[card.c].cards++;total++;if(sidesOf(card).every(side=>card.s[side].box>=LEARNED))learned++;for(const side of sidesOf(card)){const s=card.s[side],due=dueDay(s,boost[card.c]);if(!card.paused&&s.box>0&&due>today){const slot=ahead.find(e=>e.d===due);if(slot)slot.n++;}}}
  const byId=new Map(deck.cards.map(c=>[c.id,c]));for(const entry of q)courses[byId.get(entry.id).c].due++;const days=new Set(deck.log.filter(e=>e.n+e.r).map(e=>e.d));let streak=0;for(let i=days.has(today)?0:1;i<LIMITS.log;i++){if(!days.has(addDays(today,-i)))break;streak++;}const log=todayLog(deck,today);
  return {due:q.length,fresh:q.filter(e=>e.fresh).length,total,learned,streak,courses,ahead,minutes:q.length?Math.max(1,Math.round(q.length*8/60)):0,today:{reviewed:log.n+log.r,missed:log.w,done:log.done},boosted:Object.keys(boost).filter(id=>courses[id]?.due)};
 }
 const api={STEPS,LIMITS,DEFAULT_SETTINGS,LEARNED,validDay,addDays,isCloze,clozeParts,checkCard,cleanSide,cleanCard,cleanDeck,makeCard,parseList,exportText,testsAhead,activeTests,queue,preview,answer,finishDay,stats};
 root.ReserveReviewDeckModel=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
