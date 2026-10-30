/* Canvas Harness study aids: account-local saves and text-only viewers. */
(function(root){
 'use strict';
 const LABELS={
   study:'Study sheet',
   example:'Worked example',
   test:'Practice test',
   examples:'Worked examples',
   translate:'Translation help',
   practice:'Practice set',
   reading:'Reading guide',
   lab:'Lab checklist',
   rubric:'Rubric checklist',
   fixes:'Fix list',
   notes:'Notes outline',
   steps:'Steps',
   outline:'Writing outline',
   message:'Draft message',
   summary:'Summary',
   flashcards:'Flashcards',
   ask:'Explanation'
 },
   CAP=40,
   queues=new Map();
 const record=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const clone=value=>JSON.parse(JSON.stringify(value));
 function storageKey(scope){
   const [origin,account]=String(scope||'').split('|');
   try{const u=new URL(origin);if(u.protocol==='https:'&&u.origin===origin&&/^\d+$/.test(account))return 'reserve:study:'+origin+':'+account;}catch{}
   return '';
 }
 function hash(title){let n=2166136261;for(const c of String(title||''))n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0).toString(16).padStart(8,'0');}
 const aidKey=aid=>aid.kind+':'+(aid.itemId||hash(aid.title))+(aid.answerId?':'+aid.answerId:'');
 const reviewDue=review=>Number.isFinite(review?.due)&&Number.isInteger(review.step)&&review.step>=0&&review.step<3;
 const finished=(aid,p)=>
   Array.isArray(p?.order)&&
     p.order.length>0&&
     p.at===p.order.length&&
     new Set(p.order).size===p.order.length&&
     p.order.every(i=>Number.isInteger(i)&&i>=0&&i<aid.data?.items?.length&&typeof p.answers?.[i]?.correct==='boolean');
 function createStore(env){
  const local=env.chrome?.storage?.local,
    Writer=env.CanvasHarnessStudyWrites||(typeof module==='object'&&module.exports&&typeof require==='function'?require('./study-writes.js'):null),
    writer=Writer?.create({local});
  const read=async key=>key&&local?record((await local.get(key))[key]):{};
  // The writer's rule for what a map keeps (Help cards by day, other aids the newest 40); the 40 alone without it.
  const keep=map=>{
    if(Writer?.trim)return Writer.trim(map);
    const keys=Object.keys(map).filter(key=>!key.startsWith('$')).sort((a,b)=>(Number(map[a].savedAt)||0)-(Number(map[b].savedAt)||0));
    while(keys.length>CAP)delete map[keys.shift()];
    return map;
  };
  function mutate(scope,action){
   const key=storageKey(scope);if(!key||!local)return Promise.reject(Error('A verified Canvas account and local storage are required to save study aids.'));
   const work=async()=>{
     const before=await read(key),map=clone(before),result=action(map);
     if(env.CanvasHarnessStudyWrites&&env.document&&env.chrome?.runtime?.sendMessage)
       await Writer.pageCommit(env,key,before,map);
     else if(writer)await writer.commit(key,before,map);else await local.set({[key]:map});
     return result;
   };
   if(env.navigator?.locks)return env.navigator.locks.request(key,work);
   const next=(queues.get(key)||Promise.resolve()).catch(()=>{}).then(work);
   queues.set(key,next);
   next.finally(()=>{if(queues.get(key)===next)queues.delete(key);}).catch(()=>{});
   return next;
  }
  const wishes=map=>
    Object.fromEntries(Object.entries(record(map.$wishes)).filter(([kind,value])=>Object.hasOwn(LABELS,kind)&&typeof value==='string').map(([kind,value])=>
      [kind,value.slice(0,600)]));
  const notes=map=>(Array.isArray(map.$notes)?map.$notes:[]).filter(n=>n&&typeof n.text==='string'&&['card','kind','all'].includes(n.scope)).slice(-40);
  const preferences=map=>Object.fromEntries(Object.entries(record(map.$help)).filter(([key,value])=>key.length<=60&&Object.hasOwn(LABELS,value)));
  return {
    key:storageKey,
    list:async scope=>Object.fromEntries(Object.entries(await read(storageKey(scope))).filter(([key])=>!key.startsWith('$'))),
    getHelpPreferences:async scope=>preferences(await read(storageKey(scope))),
    setHelpPreference:(scope,key,shape)=>mutate(scope,map=>{
    if(typeof key!=='string'||!key||key.length>60||!Object.hasOwn(LABELS,shape))throw Error('Unknown help preference.');
    map.$help={...preferences(map),[key]:shape};
  }),getWishes:async scope=>wishes(await read(storageKey(scope))),setWishes:(scope,kind,value)=>{
    if(kind==='ask'||!Object.hasOwn(LABELS,kind)||typeof value!=='string')return Promise.reject(Error('Unknown study instructions.'));
    return mutate(scope,map=>{
      const saved=wishes(map),text=value.slice(0,600);
      if(text)saved[kind]=text;else delete saved[kind];
      if(Object.keys(saved).length)map.$wishes=saved;else delete map.$wishes;
      return text;
    });
  },save:(scope,aid)=>mutate(scope,map=>{const key=aidKey(aid);map[key]=clone(aid);keep(map);return {key,aid:map[key]};}),
   // Notes the student asked the AI to remember: for one card's item, for a kind of help, or for all help.
   getNotes:async scope=>notes(await read(storageKey(scope))),
   addNote:(scope,note)=>mutate(scope,map=>{
     const text=String(note?.text||'').trim().slice(0,400),scopeOf=['card','kind','all'].includes(note?.scope)?note.scope:'';
     if(!text||!scopeOf)throw Error('Write what to remember.');
     const saved={
       id:'n'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
       scope:scopeOf,
       kind:scopeOf==='kind'?String(note.kind||'').slice(0,20):'',
       itemId:scopeOf==='card'?String(note.itemId||'').slice(0,40):'',
       title:String(note.title||'').slice(0,160),
       text,
       at:Date.now()
     };
     map.$notes=[...notes(map),saved].slice(-40);
     return saved;
   }),
   removeNote:(scope,id)=>mutate(scope,map=>{map.$notes=notes(map).filter(n=>n.id!==id);return map.$notes;}),
   getBandState:async scope=>{
     const value=record((await read(storageKey(scope))).$band);
     return {open:value.open!==false,page:Number.isInteger(value.page)&&value.page>=0?value.page:0};
   },
   setBandState:(scope,value)=>mutate(scope,map=>{
     map.$band={open:value.open!==false,page:Number.isInteger(value.page)&&value.page>=0?value.page:0};
     return map.$band;
   }),
   saveAnswer:(scope,aids,answerId)=>mutate(scope,map=>{
     const results=[];
     for(const aid of aids){
       const key=aidKey(aid);
       if(map[key]){const previous={...map[key],answerId};map[aidKey(previous)]=previous;}
       map[key]=clone(aid);
       results.push({key,aid:map[key]});
     }
     keep(map);
     return results;
   }),
   scheduleReview:(scope,key,review,{expectedReview,validate}={})=>mutate(scope,map=>{
    const aid=map[key];if(!Object.hasOwn(map,key)||aid?.kind!=='practice')throw Error('This saved practice set is no longer available.');
    const same=(a,b)=>a===undefined&&b===undefined||a&&b&&a.due===b.due&&a.step===b.step;
    if(!same(aid.review,expectedReview))throw Error('The practice review changed. Review it before scheduling again.');
    if(review!==undefined&&
      (!review||
        Object.keys(review).some(k=>!['due','step'].includes(k))||
        !Number.isSafeInteger(review.due)||
        review.due<0||
        review.due>8640000000000000||
        !Number.isInteger(review.step)||
        review.step<0||
        review.step>3))
      throw Error('Choose a valid practice review.');
    if(validate?.()===false)throw Error('The Canvas account or view changed.');
    if(review===undefined)delete aid.review;else aid.review={due:review.due,step:review.step};return aid;
   }),
   remove:(scope,key)=>mutate(scope,map=>{delete map[key];}),progress:(scope,key,progress)=>mutate(scope,map=>{
    if(!Object.hasOwn(map,key))return;const previous=map[key],aid=map[key]={...previous,progress:clone(progress)},p=aid.progress.practice;
    if(aid.kind==='practice'&&finished(aid,p)&&!finished(previous,previous.progress?.practice)){
     if(p.order.every(i=>p.answers[i].correct===true))delete aid.review;
     else{
      const DateType=env.Date||Date,now=DateType.now(),due=new DateType(now),round=p.reviewRound;
      if(reviewDue(aid.review)&&aid.review.due<=now&&round?.due===aid.review.due&&round.step===aid.review.step){
        if(round.step===2)aid.review={due:0,step:3};else{due.setDate(due.getDate()+(round.step===0?3:7));aid.review={due:Number(due),step:round.step+1};}
      }
      else if(!reviewDue(aid.review)&&!(aid.review?.step>=3)){due.setDate(due.getDate()+1);due.setHours(0,0,0,0);aid.review={due:Math.max(Number(due),now+20*60*60*1000),step:0};}
     }
    }
    return aid;
   })};
 }
 function tagLabel(aid){
  if(!Object.hasOwn(LABELS,aid?.kind))return '';
  const data=record(aid.data),progress=record(aid.progress),items=Array.isArray(data.items)?data.items:[];
  if(aid.kind==='practice'){
    const answers=record(progress.practice?.answers),answered=items.filter((_,i)=>typeof answers[i]?.correct==='boolean').length;
    return LABELS.practice+' '+answered+'/'+items.length+(items.length&&answered===items.length?' ✓':'');
  }
  if(aid.kind==='lab'){
    const keys=[...(Array.isArray(data.materials)?data.materials:[]).map((_,i)=>'material:'+i),...(Array.isArray(data.steps)?data.steps:[]).map((_,i)=>'step:'+i)];
    return LABELS.lab+' '+keys.filter(key=>progress.checked?.[key]===true).length+'/'+keys.length;
  }
  if(aid.kind==='rubric'){
    const keys=[
      ...(Array.isArray(data.requirements)?data.requirements:[]).map((_,i)=>'req:'+i),
      ...(Array.isArray(data.criteria)?data.criteria:[]).flatMap((row,i)=>(Array.isArray(row?.checks)?row.checks:[]).map((_,j)=>'check:'+i+':'+j))
    ];
    return LABELS.rubric+' '+keys.filter(key=>progress.checked?.[key]===true).length+'/'+keys.length;
  }
  if(aid.kind==='fixes'){
    const keys=(Array.isArray(data.fixes)?data.fixes:[]).map((_,i)=>'fix:'+i);
    return LABELS.fixes+' '+keys.filter(key=>progress.checked?.[key]===true).length+'/'+keys.length;
  }
  if(aid.kind==='notes'){
    const keys=[
      ...(Array.isArray(data.sections)?data.sections:[]).flatMap((section,i)=>(Array.isArray(section?.prompts)?section.prompts:[]).map((_,j)=>'notes:'+i+':'+j)),
      ...(Array.isArray(data.terms)?data.terms:[]).map((_,i)=>'term:'+i)
    ];
    return LABELS.notes+' '+keys.filter(key=>progress.checked?.[key]===true).length+'/'+keys.length;
  }
  if(aid.kind==='steps'){
    const keys=(Array.isArray(data.steps)?data.steps:[]).map((_,i)=>'step:'+i);
    return LABELS.steps+' '+keys.filter(key=>progress.checked?.[key]===true).length+'/'+keys.length;
  }
  if(aid.kind==='flashcards'){
    const cards=Array.isArray(data.cards)?data.cards:[],known=record(progress.known);
    return LABELS.flashcards+' '+cards.filter((_,i)=>known[i]===true).length+'/'+cards.length;
  }
  return LABELS[aid.kind];
 }
 // Slots carry Canvas IDs only. Saved keys and labels enter the DOM after markup is parsed.
 function renderTags(container,aids,{env=globalThis}={}){
  const byItem=new Map();
  for(const [key,aid]of Object.entries(record(aids))){
    const label=tagLabel(aid);
    if(!label||!aid.itemId)continue;
    const id=String(aid.itemId);
    if(!byItem.has(id))byItem.set(id,[]);
    byItem.get(id).push({key,aid,label});
  }
  for(const slot of container.querySelectorAll('[data-study-item]')){
   // One tag per kind: asking again for the same kind of help shows only the newest answer, not a row of repeats.
   const when=aid=>{const t=typeof aid.savedAt==='number'?aid.savedAt:Date.parse(aid.savedAt);return Number.isFinite(t)?t:0;};
   // Archived help never shows; once an item has real help (a deliverable), its older to-do style kinds give way.
   const mine=(byItem.get(slot.dataset.studyItem)||[]).filter(({aid})=>(!aid.courseId||String(aid.courseId)===slot.dataset.studyCourse)&&!aid.progress?.archived),
     helped=mine.some(({aid})=>['test','reading','translate','examples'].includes(aid.kind));
   const tags=mine.filter(({aid})=>!(helped&&['ask','steps','summary','plan','study','example','today','remind'].includes(aid.kind))).filter((entry,i,list)=>
     !list.some(other=>
       other!==entry&&other.aid.kind===entry.aid.kind&&(when(other.aid)>when(entry.aid)||when(other.aid)===when(entry.aid)&&list.indexOf(other)>i))).map(({
     key,
     aid,
     label
   })=>{
    const tag=env.document.createElement('button');
    tag.type='button';
    tag.className='rd-study-tag';
    tag.dataset.kind=aid.kind;
    const glyph=env.document.createElement('span');
    glyph.className='rd-study-glyph';
    glyph.setAttribute('aria-hidden','true');
    tag.textContent=label;
    tag.prepend(glyph);
    tag.dataset.rdAction='open-aid';
    tag.dataset.aidKey=key;
    tag.dataset.entry=key;
    tag.dataset.id=slot.dataset.studyItem;
    tag.setAttribute('data-rd-key','study:'+key);
    return tag;
   });
   slot.replaceChildren(...tags);slot.hidden=!tags.length;
  }
 }
 // ---- Presenting the AI's text (owner, 2026-10-28: "extremely text heavy", equations "not in LaTeX form", "a better UI
 // display for clearer sentence, like outlines, notation signals"). Presentation only: CH never rewrites the AI's words.
 let uid=0,mathApi=null,studyReader=null;
 const maths=()=>mathApi||(mathApi=root.CanvasHarnessMath||(typeof module==='object'&&module.exports&&typeof require==='function'?(()=>{
   try{return require('./math-render.js');}catch{return null;}
 })():null));
 // The reader's choice matcher, for saved test cards from before "right" was stored.
 const studyApi=()=>studyReader||(studyReader=root.CanvasHarnessStudy||(typeof module==='object'&&module.exports&&typeof require==='function'?(()=>{
   try{return require('./study-prompts.js');}catch{return null;}
 })():null));
 const MARKS={rule:'Rule',check:'Check',watch:'Watch out',tip:'Tip',answer:'Answer'};
 const TAG_WORDS=[[/^(?:rule|key rule|formula)$/i,'rule'],[/^(?:check|check it|verify)$/i,'check'],[/^(?:watch|watch out|careful|common mistake|mistake|pitfall|warning)$/i,'watch'],[/^(?:tip|hint|shortcut)$/i,'tip'],[/^(?:answer|final answer|result)$/i,'answer']];
 // "Check: …", "**Watch:** …", "**Tip**: …": the tag and the rest of the line; a bold opened before the tag goes on.
 // A tag right after a leading bold label ("**Lead** Rule: …") is the same tag: the mark is drawn and the label stays
 // as the line's lead; only the tag word gives way to its mark, as it does at the start.
 function tagOf(text){
  const s=String(text??''),m=/^\s*(\*\*)?\s*([A-Za-z][A-Za-z ]{1,16}?)\s*(\*\*)?\s*:\s*/.exec(s),hit=m&&TAG_WORDS.find(([re])=>re.test(m[2].trim()));
  if(!hit){
   const after=/^(\s*\*\*[^*\n]{1,60}?\*\*)([ \t]*[:—–-]?[ \t]*)(\*\*)?\s*([A-Za-z][A-Za-z ]{1,16}?)\s*(\*\*)?\s*:\s+(?=\S)/.exec(s),
     tag=after&&!!after[3]===!!after[5]&&TAG_WORDS.find(([re])=>re.test(after[4].trim()));
   return tag?{mark:tag[1],rest:after[1]+' '+s.slice(after[0].length)}:{mark:'',rest:s};
  }
  let rest=s.slice(m[0].length);if(m[1]&&!m[3])rest=rest.startsWith('**')?rest.slice(2).replace(/^\s+/,''):'**'+rest;
  return {mark:hit[1],rest};}
 // The lead of a step: its **bold** start; in an older reply without markup, a long step's head before ": " or a short
 // first sentence, and only when that is a clean split. Otherwise the step stays one line as written.
 const ABBR=/\b(?:approx|e\.g|i\.e|etc|vs|cf|figs?|eqs?|no|vol|ch|pp|p|ll|l|min|max|mol|est|ca|resp|Mr|Mrs|Dr|St)\.$/i;
 function leadOf(text){
  const s=String(text??'').trim();
  if(s.startsWith('**')){
    const end=s.indexOf('**',2),lead=end>2?s.slice(2,end).trim():'';
    if(lead&&lead.split(/\s+/).length<=10)return {lead,detail:s.slice(end+2).replace(/^\s*(?:[:—–]|-(?=\s))\s*/,'').trim()};
  }
  if(s.length<=80||s.includes('**'))return {lead:'',detail:s};
  let m=/^([^:$\\*`\n\d]{2,60}?):\s+(\S[\s\S]*)$/.exec(s);
  if(m&&m[1].trim().split(/\s+/).length<=7&&!/[=<>()[\]{}]/.test(m[1]))return {lead:m[1].trim(),detail:m[2].trim()};
  m=/^([^.!?$\\*`\n:]{4,70}?[.!?])\s+(\S[\s\S]*)$/.exec(s);
  if(m){const n=m[1].trim().split(/\s+/).length;if(n>=2&&n<=6&&!ABBR.test(m[1].trim())&&!/\d[.!?]$/.test(m[1])&&m[2].trim().split(/\s+/).length>=3)return {lead:m[1].trim(),detail:m[2].trim()};}
  return {lead:'',detail:s};}
 // A passage's line numbers: the AI's "n" (a line number or a numbered passage's reference; or a number each line starts
 // with, when most lines do, in increasing order) are the passage's own and show as small marks; otherwise the lines
 // count 1, 2, 3 in reading order.
 function lineNumbers(lines){
  const own=lines.map(l=>typeof l.n==='string'&&l.n.trim()?l.n.trim():Number.isInteger(l.n)&&l.n>0?String(l.n):''),
    lead=lines.map(l=>/^\s*(\d{1,5}(?:\s*[-–]\s*\d{1,5})?)[.)]?\s+(?=\S)/.exec(String(l.text||'')));
  let source=own.some(Boolean),fromText=false;
  if(!source){
    const found=lead.filter(Boolean).map(m=>parseInt(m[1],10));
    if(found.length>=2&&found.length*2>=lines.length&&found.every((n,i)=>!i||n>found[i-1]))source=fromText=true;
  }
  return {
    source,
    labels:lines.map((l,i)=>source?own[i]||(fromText&&lead[i]?lead[i][1].replace(/\s*[-–]\s*/,'-'):''):String(i+1)),
    texts:lines.map((l,i)=>fromText&&lead[i]?String(l.text).slice(lead[i][0].length):l.text)
  };}
 function renderViewer(container,aid,{env=globalThis,missed=false,embedded=false,onProgress=()=>{},onClose=()=>{},onError=()=>{},onRow=()=>{}}={}){
  const d=env.document,data=aid.data,progress=clone(record(aid.progress));
  const make=(tag,text,cls)=>{const n=d.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,fn)=>{const n=make('button',text,'quiet-button');n.type='button';n.addEventListener('click',fn);return n;};
  // Motion here: a folded row opens and closes by a measured reveal (grid rows 0fr to 1fr), never instantly when it can move.
  const still=()=>
    typeof env.setTimeout!=='function'||
      env.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true||
      container?.closest?.('[data-reduced-motion="true"],.rd[data-motion=reduced],[data-motion-style=off],[data-motion-style=still]')!=null;
  const save=()=>{try{Promise.resolve(onProgress(clone(progress))).catch(onError);}catch(e){onError(e);}};
  const source=(node,src)=>{if(aid.prepare&&src==='Canvas')return;node.append(make('small',src,'ch-study-src'));};
  const heading=(node,text)=>node.append(make('h3',text));
  const worked=(node,name,value,src)=>{
    if(typeof value!=='string'||!value.trim())return;
    const block=make('div',undefined,'ch-study-up'),label=make('small',undefined,'rd-study-tag'),glyph=make('span',undefined,'rd-study-glyph');
    label.dataset.kind='steps';
    glyph.setAttribute('aria-hidden','true');
    label.append(glyph,make('span',name));
    block.append(label,fill(make('p'),value));
    if(src)source(block,src);
    node.append(block);
  };
  const list=(node,title,items)=>{if(!items.length)return;heading(node,title);const ul=make('ul');for(const text of items)ul.append(fill(make('li'),text));node.append(ul);};
  // The AI's text, presented and never reworded (owner, 2026-10-28): $…$ and $$…$$ maths as MathML, a **bold** start
  // as the line's lead, later **bold** words as key terms on a drawn wash, `code` left alone, a ```fenced``` block as
  // code with its lines. Plain text stays plain.
  const M=maths(),plainWords=t=>d.createTextNode?d.createTextNode(t):make('span',t);
  // *A title* in italics: a single star after a space or a bracket and before a word, closed the same way round.
  const words=t=>{
    const re=/(^|[\s(“"'‘])\*(?=[^\s*])([^*\n]{1,80}?[^\s*])\*(?=$|[\s.,;:!?)”"'’])/g;
    if(!t.includes('*')||!re.test(t))return plainWords(t);
    re.lastIndex=0;
    const box=make('span');
    let at=0;
    for(const m of t.matchAll(re)){const start=m.index+m[1].length;if(start>at)box.append(plainWords(t.slice(at,start)));box.append(make('em',m[2]));at=start+m[2].length+2;}
    if(at<t.length)box.append(plainWords(t.slice(at)));
    return box;
  };
  function fill(node,text,{inline=false}={}){
   const s=String(text??'');if(!/\*|\$|\\\(|\\\[|`/.test(s)){node.textContent=s;return node;}
   node.textContent='';const parts=M?M.split(s):[{text:s}],marks=parts.reduce((n,p)=>n+(p.text!==undefined?p.text.split('**').length-1:0),0);
   let target=node,bold=false,seen=0,shown=false;
   for(const part of parts){
    if(part.text!==undefined){
      const bits=part.text.split('**');
      bits.forEach((bit,k)=>{
        if(k>0){
          seen++;
          if(seen===marks&&marks%2){target.append(words('**'));}
          else if(!bold){const strong=make('strong',undefined,shown?'ch-term':'ch-lead');node.append(strong);target=strong;bold=true;}else{target=node;bold=false;}
        }
        if(bit){target.append(words(bit));if(bit.trim())shown=true;}
      });
    }
    // A fenced block keeps its lines and indentation (a program needs them) on its own paper strip under the sentence.
    else if(part.code!==undefined&&part.block){
      const pre=make('pre',undefined,'ch-code-block');
      if(part.lang)pre.dataset.lang=part.lang;
      pre.append(make('code',part.code));
      pre.setAttribute('dir','ltr');
      target.append(pre);
      shown=true;
    }
    else if(part.code!==undefined){target.append(make('code',part.code,'ch-code'));shown=true;}
    else{target.append(M.node(d,part,{inline}));shown=true;}
   }
   return node;}
  const plainText=t=>M?M.plain(String(t??'')).replace(/\*\*/g,''):String(t??'');
  const mark=kind=>{const n=make('span',undefined,'ch-mark');n.dataset.mark=kind;n.setAttribute('role','img');n.setAttribute('aria-label',MARKS[kind]);return n;};
  // A line that starts with a tag ("Check: …") wears the tag's drawn mark in place of the word.
  function tagged(tag,cls,text,fallback=''){
    const node=make(tag,undefined,cls),{mark:kind,rest}=tagOf(text),body=make('span',undefined,'ch-tagged-text');
    if(kind||fallback)node.append(mark(kind||fallback));
    node.append(fill(body,rest));
    return node;
  }
  // The result, set apart: the drawn result mark, then the answer on a wash (not a bold wall).
  function result(tag,cls,text){
    const node=make(tag,undefined,cls+' ch-result'),{mark:kind,rest}=tagOf(text);
    node.append(mark('answer'),fill(make('span',undefined,'ch-result-text'),kind==='answer'?rest:text));
    return node;
  }
  // A step as an outline row: its number, a mark for Rule / Check / Watch / Tip, the lead in the title ink and the
  // detail lighter under it. Five steps or more show the first three; "More steps" opens the rest in place.
  // The mark has a column of its own (an empty slot when the step has none), so every lead and every detail starts
  // on one left edge and the eye can run down the leads.
  function step(text){
   const li=make('li',undefined,'ch-step'),{mark:kind,rest}=tagOf(text),{lead,detail}=leadOf(rest),box=make('span',undefined,'ch-step-body');if(kind)li.dataset.mark=kind;
   li.append(kind?mark(kind):make('span',undefined,'ch-mark-slot'));
   if(lead){
     const head=make('span',undefined,'ch-step-head');
     head.append(fill(make('strong',undefined,'ch-step-lead'),lead,{inline:true}));
     box.append(head);
     if(detail)box.append(fill(make('span',undefined,'ch-step-detail'),detail));
   }
   else{li.dataset.lead='none';box.append(fill(make('span',undefined,'ch-step-detail'),detail));}
   li.append(box);return li;}
  function steps(list,cls){
   const all=(list||[]).map(s=>typeof s==='string'?s:s?.text).filter(s=>typeof s==='string'&&s.trim()),cut=all.length>=5?3:all.length,ol=make('ol',undefined,cls+' ch-steps');
   for(const s of all.slice(0,cut))ol.append(step(s));if(cut===all.length)return [ol];
   const id='ch-steps-'+(++uid),
     wrap=make('div',undefined,'ch-steps-rest'),
     inner=make('div',undefined,'ch-steps-rest-inner'),
     rest=make('ol',undefined,'ch-steps ch-steps-rest-list'),
     more=button('More steps',()=>{
     const open=wrap.dataset.open!=='true';
     wrap.dataset.open=String(open);
     inner.inert=!open;
     more.setAttribute('aria-expanded',String(open));
     more.textContent=open?'Fewer steps':'More steps';
   });
   rest.setAttribute('start',String(cut+1));
   for(const s of all.slice(cut))rest.append(step(s));
   inner.append(rest);
   wrap.append(inner);
   wrap.id=id;
   wrap.dataset.open='false';
   inner.inert=true;
   more.className='ch-steps-more';more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls',id);more.dataset.count=String(all.length-cut);
   return [ol,wrap,more];}
  const rootNode=make('section',undefined,'ch-study-aid'),body=make('div',undefined,'ch-study-content');
  if(embedded){
    const same=!!data.key&&String(data.key).trim()===String(data.headline||'').trim();
    rootNode.append(make('h2',same?data.key:data.headline||aid.title,same?'ch-band-headline ch-band-key':'ch-band-headline'));
    if(data.key&&!same)rootNode.append(make('p',data.key,'ch-band-key'));
  }
  else rootNode.append(button('Back',onClose),make('h2',aid.title),make('p',LABELS[aid.kind],'hint'));
  // Keep the preparation line outside the body replaced by practice rounds.
  const before=typeof data.before==='string'?data.before.replace(/\s+/g,' ').trim():'';
  if((aid.kind==='practice'||aid.kind==='flashcards')&&before)rootNode.append(make('p',before,'ch-study-before'));
  rootNode.append(body);container.replaceChildren(rootNode);
  function reveal(node,key,q,answer,src){
   const section=make('section',undefined,'ch-study-check');section.append(fill(make('h4'),q));source(section,src);
   const response=make('p'),show=button('Show answer',()=>{
     progress.revealed={...record(progress.revealed),[key]:true};
     fill(response,answer);
     response.hidden=false;
     show.hidden=true;
     save();
   });
   response.setAttribute('aria-live','polite');
   response.hidden=!progress.revealed?.[key];
   if(!response.hidden){fill(response,answer);show.hidden=true;}
   section.append(show,response);
   node.append(section);
  }
  // A folded row: its head always shows; tapping it opens the rest in place, one row per card at a time.
  const rows=[];
  function row(item,head,parts,{n='',solo=false}={}){
   const more=make('div',undefined,'ch-study-row-body');for(const part of parts)if(part)more.append(part);
   // The only problem or question on a card (one card of a lapped stack) shows in full: nothing to unfold.
   if(solo){const top=make('div',undefined,'ch-study-row-head');top.append(head);item.dataset.solo='true';item.dataset.open='true';item.append(top,more);return item;}
   // The body sits in a one-row grid (the fold) that opens from 0fr to 1fr and closes the same way, so the rows under it
   // glide instead of jumping; the unfold drawing plays only when the student opens it, never on a redraw.
   const toggle=make('button'),fold=make('div',undefined,'ch-study-row-fold'),entry={item,toggle,more,fold,timer:0};
   toggle.className='ch-study-row';
   toggle.type='button';
   toggle.append(head);
   if(n)toggle.dataset.n=n;
   fold.append(more);
   const set=(r,open,move=false)=>{
     env.clearTimeout?.(r.timer);
     r.timer=0;
     const was=r.fold.dataset.open==='true';
     r.toggle.setAttribute('aria-expanded',String(open));
     r.item.dataset.open=String(open);
     r.fold.dataset.open=String(open);
     r.more.inert=!open;
     delete r.fold.dataset.still;
    if(open){
      r.more.hidden=false;
      if(move&&!was){r.more.dataset.opening='';r.more.addEventListener('animationend',()=>delete r.more.dataset.opening,{once:true});}
      r.timer=env.setTimeout?.(()=>{r.fold.dataset.still='';},move?320:0)||0;
      return;
    }
    delete r.more.dataset.opening;if(!move||!was){r.more.hidden=true;return;}r.timer=env.setTimeout(()=>{r.timer=0;if(r.fold.dataset.open!=='true')r.more.hidden=true;},300);};
   toggle.addEventListener('click',()=>{
     const open=entry.more.hidden||entry.fold.dataset.open!=='true',move=!still();
     for(const r of rows)set(r,r===entry&&open,move);
     onRow(open,open?Number(entry.more.scrollHeight)||0:0);
   });
   rows.push(entry);set(entry,false);item.append(toggle,fold);return item;
  }
  function practice(){
   const total=data.items.length,p=progress.practice=record(progress.practice);
   if(!Array.isArray(p.order)||!p.order.length||p.order.some(i=>!Number.isInteger(i)||i<0||i>=total)||new Set(p.order).size!==p.order.length)
     p.order=data.items.map((_,i)=>i);
   p.at=Math.max(0,Math.min(p.order.length,Number.isInteger(p.at)?p.at:0));p.answers=record(p.answers);
   function retry(indices,review){
     p.order=indices;
     p.at=0;
     for(const i of indices)delete p.answers[i];
     if(review)p.reviewRound={due:review.due,step:review.step};else delete p.reviewRound;
     save();
   }
   if(missed&&!(aid.review?.step>=3)&&(!reviewDue(aid.review)||aid.review.due<=(env.Date||Date).now())){
    if(p.at<p.order.length){if(!p.reviewRound&&reviewDue(aid.review)){p.reviewRound={due:aid.review.due,step:aid.review.step};save();}}
    else if(!p.reviewRound||
      reviewDue(aid.review)&&aid.review.due<=(env.Date||Date).now()&&(p.reviewRound.due!==aid.review.due||p.reviewRound.step!==aid.review.step)){
     const indices=p.order.filter(i=>p.answers[i]?.correct===false);if(indices.length)retry(indices,reviewDue(aid.review)?aid.review:null);
    }
   }
   function show(focus=false){
    body.replaceChildren();
    if(p.at===p.order.length){
     const score=p.order.filter(i=>p.answers[i]?.correct===true).length,title=make('h3','Score: '+score+' / '+p.order.length);
     title.tabIndex=-1;
     body.append(title);
     if(focus)title.focus();
     const missed=p.order.filter(i=>p.answers[i]?.correct===false),again=button('Missed ones again',()=>{retry(missed);show(true);});
     again.disabled=!missed.length;
     body.append(again);
     return;
    }
    const index=p.order[p.at],q=data.items[index],a=p.answers[index]=record(p.answers[index]);
    body.append(make('p',(p.at+1)+' / '+p.order.length,'ch-study-count'));const title=fill(make('h3'),q.q);title.tabIndex=-1;body.append(title);source(body,q.src);
    const controls=make('div',undefined,'ch-study-choices'),feedback=make('div',undefined,'ch-study-feedback');feedback.setAttribute('aria-live','polite');feedback.setAttribute('aria-atomic','true');
    const next=button('Next',()=>{p.at++;save();show(true);});next.disabled=typeof a.correct!=='boolean';
    function explain(){
     feedback.replaceChildren();if(q.type==='short'&&a.revealed)feedback.append(fill(make('p'),q.answer));
     if(typeof a.correct==='boolean'){
       feedback.append(make('p',a.correct?'Right':'Wrong'),fill(make('p'),q.why));
       if(!a.correct&&q.type==='mc'&&q.miss[a.choice])feedback.append(fill(make('p'),q.miss[a.choice]));
     }
     else if(q.type==='short'&&a.revealed)feedback.append(fill(make('p'),q.why));
    }
    if(q.type==='short'){
     const label=make('label','Your answer'),input=make('textarea');input.value=typeof a.draft==='string'?a.draft:'';label.append(input);input.addEventListener('input',()=>{a.draft=input.value;save();});
     const showAnswer=button('Show answer',()=>{a.revealed=true;showAnswer.hidden=true;mark.hidden=false;explain();save();});showAnswer.hidden=a.revealed===true;
     const mark=make('div',undefined,'ch-study-actions');mark.hidden=!a.revealed;
     for(const [text,correct]of [['I had it',true],['Not yet',false]]){
       const b=button(text,()=>{
         if(typeof a.correct==='boolean')return;
         a.correct=correct;
         for(const child of mark.children)child.disabled=true;
         next.disabled=false;
         explain();
         save();
       });
       b.disabled=typeof a.correct==='boolean';
       mark.append(b);
     }
     controls.append(label,showAnswer,mark);
    }else{
     const choices=q.type==='mc'?q.choices:['True','False'];
     choices.forEach((text,i)=>{
       const value=q.type==='mc'?i:i===0,b=button(text,()=>{
         if(typeof a.correct==='boolean')return;
         a.choice=value;
         a.correct=value===q.answer;
         for(const child of controls.children){child.disabled=true;child.setAttribute('aria-pressed',String(child===b));}
         b.dataset.result=a.correct?'right':'wrong';
         next.disabled=false;
         explain();
         save();
       });
       fill(b,text,{inline:true});
       b.disabled=typeof a.correct==='boolean';
       b.setAttribute('aria-pressed',String(a.choice===value));
       if(a.choice===value)b.dataset.result=a.correct?'right':'wrong';
       controls.append(b);
     });
    }
    body.append(controls,feedback,next);explain();if(focus)title.focus();
   }
   show();
  }
  function tableFor(table){
    const node=make('table',undefined,'ch-study-table');
    node.append(make('caption',table.title));
    const head=make('thead'),tr=make('tr');
    for(const col of table.columns){const th=make('th',col);th.setAttribute('scope','col');tr.append(th);}
    head.append(tr);
    node.append(head);
    const tbody=make('tbody');
    for(let r=0;r<table.rows;r++){const row=make('tr');for(const _col of table.columns)row.append(make('td','\u00a0'));tbody.append(row);}
    node.append(tbody);
    return node;
  }
  function meta(label){
    const line=make('div',undefined,'ch-study-meta');
    if(label)line.append(make('span',label,'ch-study-count'));
    if(data.minutes)line.append(make('span','About '+data.minutes+' minutes','ch-study-total'));
    for(const gap of data.gaps||[])line.append(make('span',gap,'ch-study-gap-note'));
    if(line.children.length)body.append(line);
  }
  function checklist(title,items,prefix,node=body){
    if(title)heading(node,title);
    items.forEach((entry,i)=>{
      const row=make('label',undefined,'check-row ch-study-tick'),input=make('input');
      input.type='checkbox';
      const key=prefix+':'+i;
      input.checked=progress.checked?.[key]===true;
      input.addEventListener('change',()=>{progress.checked={...record(progress.checked),[key]:input.checked};save();});
      const text=fill(make('span'),typeof entry==='string'?entry:entry.text);
      if(typeof entry!=='string')source(text,entry.src);
      row.append(input,text);
      node.append(row);
    });
  }
  if(['today','plan','remind'].includes(aid.kind)){
   if(aid.kind==='remind'){body.append(fill(make('p'),data.text));if(data.at)body.append(make('time',data.at));}
   else{
     const timeline=make('div',undefined,'ch-band-timeline');
     for(const item of data.items||[data]){
       const block=make('section',undefined,'ch-band-time-block');
       heading(block,item.title||item.itemId||'Work');
       for(const value of [item.minutes?item.minutes+' min':'',item.day,item.next,item.why])if(value)block.append(make('p',value));
       timeline.append(block);
     }
     body.append(timeline);
   }
  }else if(aid.kind==='study'){
   // The sheet in columns across the card, the practice as a row of slips under it; an answer opens on tap and stays open.
   meta();
   const sheet=make('div',undefined,'ch-study-sheet'),quiz=make('ol',undefined,'ch-study-quiz');
   data.sheet.forEach((part,i)=>{
     const col=make('section',undefined,'ch-study-sheet-part');
     heading(col,part.heading);
     for(const fact of part.facts){
       const row=make('div',undefined,'ch-study-fact');
       if(fact.label)row.append(make('span',fact.label,'ch-study-fact-label'));
       row.append(fill(make('span',undefined,'ch-study-fact-text'),fact.text));
       if(fact.note)row.append(fill(make('span',undefined,'ch-study-fact-note'),fact.note));
       col.append(row);
     }
    if(data.tip&&i===data.sheet.length-1)col.append(tagged('p','ch-study-tip',data.tip,'watch'));sheet.append(col);});
   data.practice.forEach((q,i)=>{
     const li=make('li',undefined,'ch-study-slip'),key='practice:'+i,answer=make('p',undefined,'ch-study-quiz-answer');
     answer.setAttribute('aria-live','polite');
     const show=button('Answer',()=>{progress.revealed={...record(progress.revealed),[key]:true};paint();save();});
     show.className='ch-study-answer-tag';
     show.setAttribute('aria-label','Show answer '+(i+1));
    function paint(){
      const open=progress.revealed?.[key]===true;
      show.hidden=open;
      answer.hidden=!open;
      if(open&&!answer.textContent){answer.append(result('span','ch-study-quiz-result',q.answer));if(q.why)answer.append(fill(make('span',undefined,'ch-study-quiz-why'),q.why));}
    }
    li.append(fill(make('p',undefined,'ch-study-quiz-q'),q.q),show,answer);paint();quiz.append(li);});
   body.append(sheet,quiz);
  }else if(aid.kind==='test'){
   // A practice test: each question a slip; its answer and worked solution open on tap and stay open. One question of a
   // lapped stack (partIndex/partCount) still counts the whole set and names its answer by its place in it.
   const asked=data.partCount||data.questions.length;meta(asked>1?'Questions · '+asked:'');const quiz=make('ol',undefined,'ch-study-quiz ch-study-test');
   data.questions.forEach((q,i)=>{
     const li=make('li',undefined,'ch-study-slip'),key='question:'+i,answer=make('div',undefined,'ch-study-quiz-answer');
     answer.setAttribute('aria-live','polite');
     let filled=false;
    const show=button('Answer',()=>{progress.revealed={...record(progress.revealed),[key]:true};paint(true);save();});
    show.className='ch-study-answer-tag';
    show.setAttribute('aria-label','Show answer '+((Number.isInteger(data.partIndex)?data.partIndex:0)+i+1));
    // The choice the answer names is marked when the answer opens (drawn in only on the student's tap, never on a redraw);
    // an answer that names no single choice stays text alone.
    function paint(tapped=false){
      const open=progress.revealed?.[key]===true;
      show.hidden=open;
      answer.hidden=!open;
      if(open&&!filled){
        filled=true;
        answer.append(result('p','ch-study-quiz-result',q.answer),...steps(q.steps,'ch-study-solution'));
        const pick=right>=0&&choices?.children?.[right];
        if(pick){pick.dataset.right='true';if(tapped&&!still())pick.dataset.drawn='now';pick.append(mark('answer'));}
      }
    }
    let choices=null;if(q.choices?.length){choices=make('ol',undefined,'ch-study-choices');for(const c of q.choices)choices.append(fill(make('li'),c,{inline:true}));}
    const right=!q.choices?.length?-1:Number.isInteger(q.right)?(q.right>=0&&q.right<q.choices.length?q.right:-1):studyApi()?.choiceIndex?.(q.answer,q.choices)??-1;
    const head=make('span');
    if(q.title)head.append(make('small',q.title,'ch-study-up-label'));
    head.append(fill(make('span',undefined,'ch-study-quiz-q'),q.q,{inline:true}));
    row(li,head,[choices,show,answer],{solo:data.questions.length===1});
    paint();
    quiz.append(li);
   });
   body.append(quiz);
  }else if(aid.kind==='examples'){
   // Worked examples, one per kind of problem, shown in full: they are there to learn the method from.
   const set=data.partCount||data.problems.length;meta(set>1?'Problems · '+set:'');const grid=make('div',undefined,'ch-study-examples');
   for(const p of data.problems){
     const box=make('section',undefined,'ch-study-example'),head=make('span'),label=p.title||p.type;
     if(label)head.append(make('small',label,'ch-study-up-label'));
     head.append(fill(make('span',undefined,'ch-study-example-problem'),p.problem,{inline:true}));
     row(box,head,[result('p','ch-study-example-answer',p.answer),...steps(p.steps,'ch-study-example-steps')],{solo:data.problems.length===1});
     grid.append(box);
   }
   body.append(grid);
  }else if(aid.kind==='translate'){
   // Line by line: the original, its hard words with meaning and form, the construction, and a check translation on tap.
   // The original, its scansion and each word take their direction from their own text (right-to-left verse in a
   // left-to-right card reads right); glosses and the check keep the card's. A scanned line shows its scansion first:
   // each syllable under its mark, feet parted by a thin rule, the main caesura by a double one; a narrow card wraps it
   // only after a rule, never inside a foot.
   function scanned(list){if(!Array.isArray(list)||!list.length)return null;const box=make('p',undefined,'ch-study-scan');box.dir='auto';let foot=make('span',undefined,'ch-scan-foot');box.append(foot);
    list.forEach((s,k)=>{
      const syl=make('span',undefined,'ch-scan-syl');
      syl.dataset.q={'–':'long','˘':'short','×':'either'}[s?.q]||'none';
      syl.append(make('span',String(s?.q||''),'ch-scan-q'),make('span',String(s?.t||''),'ch-scan-t'));
      foot.append(syl);
     if(s?.end&&k<list.length-1){const bar=make('span',s.end,'ch-scan-bar');bar.dataset.bar=s.end==='|'?'foot':'cut';foot.append(bar);foot=make('span',undefined,'ch-scan-foot');box.append(foot);}});
    return box;}
   meta(data.lines.length>1?'Lines · '+data.lines.length:'');const lines=make('ol',undefined,'ch-study-lines'),nums=lineNumbers(data.lines);
   lines.dataset.numbers=nums.source?'source':'order';const width=Math.max(1,...nums.labels.map(n=>n.length));lines.style?.setProperty?.('--ch-num-ch',String(width));
   // Columns read down (1, 2, 3 … then the next column) and each flows on its own: the line that starts a column in the
   // two- or three-column layout forces the break, so an opened line pushes only the lines under it in its own column.
   const total=data.lines.length,
     per2=Math.ceil(total/2),
     per3=Math.ceil(total/3),
     starts=i=>[...(total>1&&i===per2?['2']:[]),...(total>2&&i>0&&i<total&&(i===per3||i===2*per3)?['3']:[])].join(' ');
   data.lines.forEach((l,i)=>{
     const li=make('li',undefined,'ch-study-line'),key='line:'+i,check=make('p',undefined,'ch-study-line-check');
     check.setAttribute('aria-live','polite');
     const at=starts(i);
     if(at)li.dataset.colStart=at;
    const show=button('Check',()=>{progress.revealed={...record(progress.revealed),[key]:true};paint();save();});
    show.className='ch-study-answer-tag';
    show.setAttribute('aria-label','Show the translation of line '+(nums.labels[i]||i+1));
    function paint(){const open=progress.revealed?.[key]===true;show.hidden=open;check.hidden=!open;if(open&&!check.textContent)fill(check,l.check);}
    let words=null;
    if(l.words.length){
      words=make('dl',undefined,'ch-study-words');
      for(const w of l.words){
        const pair=make('div',undefined,'ch-study-word'),gloss=make('dd');
        gloss.append(make('span',w.means,'ch-study-means'));
        if(w.form)gloss.append(make('span',' · '+w.form,'ch-study-form'));
        const term=make('dt',w.word);
        term.dir='auto';
        pair.append(term,gloss);
        words.append(pair);
      }
    }
    const original=make('span',nums.texts[i],'ch-study-line-text');original.dir='auto';
    // A passage reference shared by the entries of one passage shows on its first entry only, so each passage reads as a group.
    const shown=nums.source&&i>0&&nums.labels[i]===nums.labels[i-1]?'':nums.labels[i];if(nums.source&&nums.labels[i]&&!shown)li.dataset.cont='true';
    row(li,original,[scanned(l.scan),words,l.note?tagged('p','ch-study-line-note',l.note):null,show,check],{n:shown});paint();lines.append(li);});
   body.append(lines);
  }else if(aid.kind==='example'){
   meta();
   const problem=make('section',undefined,'ch-study-example');problem.append(make('small','A similar problem','ch-study-up-label'),fill(make('p'),data.problem));body.append(problem);
   body.append(result('p','ch-study-example-answer',data.answer),...steps(data.steps,'ch-study-example-steps'));
   if(data.yours){const yours=make('p',undefined,'ch-study-example-yours');yours.append(make('strong','Yours: '),fill(make('span'),data.yours));body.append(yours);}
  }
  else if(aid.kind==='ask'){
    for(const point of data.points){const p=data._plainText===true?make('pre',point.text,'ch-study-message-body'):fill(make('p'),point.text);source(p,point.src);body.append(p);}
    if(data._plainText!==true||data.next)body.append(data._plainText===true?make('p',data.next):fill(make('p'),data.next));
  }
  else if(aid.kind==='practice')practice();
  else if(aid.kind==='reading'){
   // A reading breakdown (Daily help) leads with the author's main claim; each step of the argument carries its quote.
   if(data.thesis){meta();body.append(fill(make('p',undefined,'ch-study-thesis'),data.thesis));}
   heading(body,(data.thesis?'The argument':'Main points')+' · '+data.points.length);
   const ol=make('ol',undefined,'ch-study-argument');
   for(const p of data.points){
     const li=make('li');
     if(p.quote){const q=make('div');q.append(make('q',p.quote,'ch-study-quote'));source(q,p.src);row(li,fill(make('span'),p.text,{inline:true}),[q]);}else{fill(li,p.text);source(li,p.src);}
     ol.append(li);
   }
   body.append(ol);
   heading(body,'Terms · '+data.terms.length);
   const terms=make('div',undefined,'ch-study-terms');
   for(const t of data.terms){const item=make('div',undefined,'ch-study-term'),means=fill(make('p'),t.means);source(means,t.src);row(item,make('span',t.term),[means]);terms.append(item);}
   body.append(terms);
   heading(body,'Check questions');data.check.forEach((q,i)=>reveal(body,'check:'+i,q.q,q.answer,q.src));
  }else if(aid.kind==='notes'){
   const tick=(node,text,key,src)=>{
     const row=make('label',undefined,'ch-study-notes-tick'),input=make('input'),line=fill(make('span'),text);
     input.type='checkbox';
     input.checked=progress.checked?.[key]===true;
     input.addEventListener('change',()=>{progress.checked={...record(progress.checked),[key]:input.checked};save();});
     if(src)line.append(make('small',src,'ch-study-notes-src'));
     row.append(input,line);
     node.append(row);
   };
   data.sections.forEach((section,i)=>{
     const node=make('section',undefined,'ch-study-notes-section');
     heading(node,section.heading);
     node.append(make('small',section.src,'ch-study-notes-src'));
     section.prompts.forEach((prompt,j)=>tick(node,prompt,'notes:'+i+':'+j));
     body.append(node);
   });
   const terms=make('section',undefined,'ch-study-notes-terms');heading(terms,'Terms');data.terms.forEach((term,i)=>tick(terms,term.term,'term:'+i,term.src));body.append(terms);
   const summary=make('section',undefined,'ch-study-notes-summary');heading(summary,'Summary question');summary.append(fill(make('p'),data.summary));body.append(summary);
  }else if(aid.kind==='lab'){
   checklist('Materials',data.materials,'material');list(body,'Safety',data.safety);checklist('Steps',data.steps,'step');heading(body,'Data tables');
   for(const table of data.tables){
     const section=make('section',undefined,'ch-study-table-wrap');
     section.append(tableFor(table),button('Print table',()=>{
       const print=make('div',undefined,'ch-study-print-root');
       print.append(tableFor(table));
       d.body.append(print);
       d.body.classList.toggle('ch-study-printing',true);
       try{env.print();}catch(e){onError(e);}finally{print.remove();d.body.classList.toggle('ch-study-printing',false);}
     }));
     body.append(section);
   }
   const answered=data.prelab.map((q,i)=>({q,i})).filter(({q})=>typeof q.answer==='string'&&q.answer.trim());
   if(answered.length){heading(body,'Pre-lab questions');answered.forEach(({q,i})=>reveal(body,'prelab:'+i,q.q,q.answer,q.src));}
  }else if(aid.kind==='rubric'){
   checklist('Requirements',data.requirements,'req');
   data.criteria.forEach((row,i)=>{
     const section=make('section',undefined,'ch-study-check ch-study-rubric-row'),head=make('div',undefined,'ch-study-row-head');
     head.append(make('h3',row.name));
     if(row.points)head.append(make('small',row.points,'ch-study-points'));
     section.append(head);
     checklist('',row.checks,'check:'+i,section);
     if(row.up){const up=make('div',undefined,'ch-study-up');up.append(make('small','To reach the top level','ch-study-up-label'),fill(make('p'),row.up));section.append(up);}
     source(section,row.src);
     body.append(section);
   });
  }else if(aid.kind==='fixes'){
   for(const [group,title]of [['rewrite','For the rewrite'],['next','For next time']]){
     const items=data.fixes.map((fix,i)=>({fix,i})).filter(({fix})=>fix.for===group);
     if(!items.length)continue;
     const section=make('section',undefined,'ch-study-check ch-study-rubric-row');
     heading(section,title);
     for(const {fix,i}of items){
       const row=make('label',undefined,'check-row ch-study-tick'),input=make('input'),text=fill(make('span'),fix.text),key='fix:'+i;
       input.type='checkbox';
       input.checked=progress.checked?.[key]===true;
       input.addEventListener('change',()=>{progress.checked={...record(progress.checked),[key]:input.checked};save();});
       text.append(fill(make('small',undefined,'ch-study-why'),fix.why));
       source(text,fix.src);
       worked(text,'Show',fix.show);
       row.append(input,text);
       section.append(row);
     }
     body.append(section);
   }
   if(data.keep.length){
     const keep=make('section',undefined,'ch-study-keep');
     heading(keep,'Keep doing');
     const ul=make('ul');
     for(const entry of data.keep){const li=fill(make('li'),entry.text);source(li,entry.src);ul.append(li);}
     keep.append(ul);
     body.append(keep);
   }
  }
  else if(aid.kind==='steps'){
   const total=data.steps.reduce((n,step)=>n+step.minutes,0);body.append(make('p',total>=60?'About '+Math.round(total/6)/10+' hours in all':'About '+total+' minutes in all','ch-study-total'));
   const sequence=embedded?make('div',undefined,'ch-band-columns'):body;if(embedded)body.append(sequence);
   data.steps.forEach((step,i)=>{
     const row=make('label',undefined,'check-row ch-study-tick ch-study-step'),input=make('input'),text=fill(make('span'),step.text),key='step:'+i;
     input.type='checkbox';
     input.checked=progress.checked?.[key]===true;
     input.addEventListener('change',()=>{progress.checked={...record(progress.checked),[key]:input.checked};save();});
     text.append(fill(make('small',undefined,'ch-study-why'),step.done),make('small',step.minutes+' min'+(step.due?' · '+step.due:''),'ch-study-points'));
     source(text,step.src);
     worked(text,'Example',step.example);
     row.append(input,text);
     sequence.append(row);
   });
   if(data.handin){const hand=make('section',undefined,'ch-study-keep');heading(hand,'Hand it in');hand.append(fill(make('p'),data.handin));body.append(hand);}
  }else if(aid.kind==='outline'){
   if(data.thesis){const thesis=make('section',undefined,'ch-study-up');thesis.append(make('small','Your thesis answers','ch-study-up-label'),fill(make('p'),data.thesis));body.append(thesis);}
   const sections=embedded?make('div',undefined,'ch-band-columns'):body;if(embedded)body.append(sections);
   for(const part of data.sections){
     const section=make('section',undefined,'ch-study-check ch-study-rubric-row'),head=make('div',undefined,'ch-study-row-head');
     head.append(make('h3',part.part));
     if(part.timing)head.append(make('small',part.timing,'ch-study-points'));
     if(part.words)head.append(make('small','about '+part.words+' words','ch-study-points'));
     section.append(head,fill(make('p'),part.purpose));
     worked(section,'Example',part.example,part.src);
     if(part.evidence?.length){const ul=make('ul');for(const e of part.evidence){const li=fill(make('li'),e.text);source(li,e.src);ul.append(li);}section.append(ul);}
     sections.append(section);
   }
  }else if(aid.kind==='message'){
   const card=make('section',undefined,'ch-study-message');
   card.append(make('p','To: '+data.to,'ch-study-message-to'),make('p','Subject: '+data.subject,'ch-study-message-subject'),fill(make('pre',undefined,'ch-study-message-body'),data.body));
   body.append(card);
   const status=make('p','','hint'),plainCopy={...data,body:plainText(data.body)};status.setAttribute('aria-live','polite');
   // What is copied is plain text: maths in its readable form, no stars.
   {
     const data=plainCopy;
     card.append(button('Copy message',()=>{
       const text='Subject: '+data.subject+'\n\n'+data.body;
       Promise.resolve(env.navigator?.clipboard?.writeText(text)).then(()=>{
         status.textContent='Copied. Fill in anything in [brackets] before sending.';
       },e=>{status.textContent='Could not copy: select the text and copy it yourself.';onError(e);});
     }),status);
   }
   list(body,'It asks for',data.asks);
  }else if(aid.kind==='summary'){
   const ol=make('ol');for(const p of data.points){const li=fill(make('li'),p.text);source(li,p.src);ol.append(li);}heading(body,'What matters');body.append(ol);
   if(data.todo.length)checklist('To do',data.todo.map(t=>({text:t.text+(t.due?' ('+t.due+')':''),src:t.src})),'todo');
  }else if(aid.kind==='flashcards'){
   if(embedded){
     const strip=make('div',undefined,'ch-band-flashcards');
     for(const [i,c]of data.cards.entries()){
       let flipped=false;
       const face=button('',()=>{flipped=!flipped;fill(face,flipped?c.back:c.front,{inline:true});face.setAttribute('aria-pressed',String(flipped));});
       fill(face,c.front,{inline:true});
       face.className='ch-study-card';
       face.setAttribute('aria-label','Flip '+plainText(c.front));
       face.setAttribute('aria-pressed','false');
       const cell=make('section'),known=make('input'),label=make('label','Known');
       known.type='checkbox';
       known.checked=progress.known?.[i]===true;
       known.addEventListener('change',()=>{progress.known={...record(progress.known),[i]:known.checked};save();});
       label.append(known);
       cell.append(face,label);
       source(cell,c.src);
       strip.append(cell);
     }
     body.append(strip);
   }
   else{
   const known=progress.known=record(progress.known),cards=data.cards;
   let at=Math.max(0,Math.min(cards.length-1,Number.isInteger(progress.at)?progress.at:0)),flipped=false;
   const count=make('p','','ch-study-count'),card=make('button','','ch-study-card'),actions=make('div',undefined,'ch-study-actions');card.type='button';
   function draw(){
     const c=cards[at];
     count.textContent=(at+1)+' / '+cards.length+' · known '+cards.filter((_,i)=>known[i]===true).length;
     card.replaceChildren(fill(make('span',undefined,flipped?'ch-study-card-back':'ch-study-card-front'),flipped?c.back:c.front,{inline:true}));
     if(flipped)source(card,c.src);
     card.setAttribute('aria-label',(flipped?'Answer: ':'Card: ')+plainText(flipped?c.back:c.front)+'. Press to turn over.');
   }
   card.addEventListener('click',()=>{flipped=!flipped;draw();});
   const go=(knew)=>{if(typeof knew==='boolean')known[at]=knew;at=(at+1)%cards.length;progress.at=at;flipped=false;save();draw();card.focus();};
   actions.append(button('I knew it',()=>go(true)),button('Not yet',()=>go(false)),button('Skip',()=>go()));body.append(count,card,actions);draw();}
  }
  worked(body,'Example',data.example);worked(body,'Show',data.show);
  if(!['study','example','test','examples','translate'].includes(aid.kind)&&!['study','example'].includes(data.kind)&&!(aid.kind==='reading'&&data.thesis)){
    const gaps=make('section',undefined,'ch-study-gaps');
    list(gaps,aid.prepare?'Not on Canvas':'Not in the material',data.gaps||[]);
    gaps.hidden=!data.gaps?.length;
    rootNode.append(gaps);
  }
  return rootNode;
 }
 const api={LABELS,CAP,storageKey,aidKey,createStore,tagLabel,renderTags,renderViewer};
 root.CanvasHarnessStudyUI=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
