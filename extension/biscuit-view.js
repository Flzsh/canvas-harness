/* Draws one Biscuit answer (biscuit-answer.js) inside his bubble (2026-11-14). One renderer for every kind; HTML only from
   escaped text. pets.js owns the clicks: every control carries data-ba-* and the answer's own act ids. The look is pet.css
   "Biscuit answers": the bubble's paper and ink, Literata titles, CH's clay for the one main act, course colours on names. */
(function(root){
 'use strict';
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 const list=v=>Array.isArray(v)?v:[];
 const LIMIT={s:6,l:12};
 const SHOW_ACTS=3;
 const clock=(at,zone)=>new Date(at).toLocaleTimeString('en-US',{timeZone:zone||'America/New_York',hour:'numeric',minute:'2-digit'});
 const short=(at,zone)=>clock(at,zone).replace(/ (AM|PM)$/,'');
 const ampm=(at,zone)=>clock(at,zone).slice(-2);
 const len=n=>{n=Math.round(Number(n)||0);return n<60?n+' min':n%60?Math.floor(n/60)+' h '+n%60:n/60+' h';};
 const color=c=>c&&/^#[0-9a-f]{3,8}$|^rgb|^hsl/i.test(c)?` style="--ba-c:${E(c)}"`:'';
 function render(a,state={}){
  if(!a||!a.kind)return '';
  const size=state.size==='l'?'l':'s',st={...state,size,zone:state.zone||'America/New_York'};
  const body=(KIND[a.kind]||KIND.chat)(a,st);
  return `<section class="ba" data-ba-kind="${E(a.kind)}" data-ba-size="${size}" aria-label="${E(a.title||'Answer')}">${head(a,st)}${notes(a,st)}${body?`<div class="ba-body">${body}</div>`:''}${acts(a,st)}${follow(a,st)}</section>`;
 }
 function head(a,st){
  if(a.kind==='fact'||a.kind==='progress'||a.kind==='grades'&&a.value)return '';
  const grow=!st.embedded&&(['plan','list','week','next','item'].includes(a.kind)||['messages','files','done','place'].includes(a.kind)&&list(a.rows).length>2);
  const sizeBtn=grow?`<button type="button" class="ba-size" data-ba-size aria-pressed="${st.size==='l'}" aria-label="${st.size==='l'?'Smaller':'Bigger'}">${st.size==='l'?SVG.smaller:SVG.bigger}</button>`:'';
  const sum=a.summary?`<p class="ba-sum">${E(a.summary)}</p>`:'';
  const lead=a.lead?`<p class="ba-lead">${E(a.lead)}</p>`:'';
  return `<header class="ba-head">${lead}<div class="ba-title-row"><h3 class="ba-title">${E(a.title)}</h3>${sizeBtn}</div>${sum}</header>`;
 }
 function notes(a,st){
  const n=list(a.notes);if(!n.length)return '';
  return `<p class="ba-notes">${n.map(x=>x.follow?`<button type="button" class="ba-note" data-tone="${E(x.key)}" data-ba-follow="${E(x.follow)}">${E(x.text)}</button>`:x.key==='later'&&list(a.left).length?`<button type="button" class="ba-note" data-tone="later" data-ba-left aria-expanded="${!!st.left}">${E(x.text)}</button>`:`<span class="ba-note" data-tone="${E(x.key)}">${E(x.text)}</span>`).join('')}</p>`;
 }
 // ---- rows
 function due(r){if(!r.due||r.due.at===null)return '';const rel=r.due.rel;return `<span class="ba-due" data-rel="${E(rel)}">${E(rel==='late'?r.due.short:dueShort(r))}</span>`;}
 function dueShort(r){const t=r.due.text.replace(/^Due /,'');return t.charAt(0).toUpperCase()+t.slice(1);}
 function meta(r,{withDue=true,withLen=true,withCourse=true}={}){
  const parts=[];
  if(withCourse&&r.course&&!(r.type==='work'&&dateOnly(r.rawName||r.name)))parts.push(`<span class="ba-course"${color(r.course.color)}>${E(r.course.short)}</span>`);
  if(withDue){const d=due(r);if(d)parts.push(d);}
  if(r.state==='submitted'||r.state==='graded'||r.state==='done')parts.push(`<span class="ba-state" data-state="${E(r.state)}">${E(r.stateText)}</span>`);
  if(withLen&&r.minutes&&r.type!=='break')parts.push(`<span class="ba-len">${r.minutesFrom==='guess'?'≈':''}${E(len(r.minutes))}</span>`);
  if(r.format)parts.push(`<span class="ba-format">${E(r.format)}${r.size?' · '+E(r.size):''}</span>`);
  if(r.when)parts.push(`<span class="ba-when">${E(r.when)}</span>`);
  return parts.length?`<p class="ba-meta">${parts.join('<span class="ba-dot" aria-hidden="true">·</span>')}</p>`:'';
 }
 function nameButton(r,st,{open=false}={}){
  const has=!!(r.detail||r.type==='work'&&!r.personal);
  const tag=has?'button':'span';
  // a title that is only a date ("Homework for Monday, 11/9/2026") leads with its course, so the row says whose homework it is
  const lead=r.type==='work'&&r.course&&dateOnly(r.rawName||r.name)?`<span class="ba-course ba-lead"${color(r.course.color)}>${E(r.course.short)}</span> `:'';
  return `<${tag} ${has?`type="button" data-ba-row="${E(r.id)}" aria-expanded="${open}"`:''} class="ba-name"${lead?' data-dated':''}>${lead}${E(r.name)}${r.unread?'<i class="ba-unread" aria-label="new"></i>':''}</${tag}>`;
 }
 const dateOnly=n=>/^(?:(?:home ?work|hw|classwork|assignment|reading)\s*(?:for|due)?\s*)?(?:(?:mon|tues|wednes|thurs|fri|satur|sun)day,?\s*)?(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,?\s*\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*$/i.test(n);
 function rowB(r,a,st){const open=!!st.open?.[r.id];return `<li class="ba-row ba-row-b" data-ba-id="${E(r.id)}" data-state="${E(r.state||'')}" data-open="${open}">${st.picking&&r.type==='work'?`<input type="checkbox" class="ba-pick" data-ba-pick="${E(r.id)}" aria-label="${E(r.name)}" ${st.picked?.[r.id]===false?'':'checked'}>`:''}<div class="ba-what">${nameButton(r,st,{open})}${r.points!=null||r.minutes?`<p class="ba-meta">${r.points!=null?`<span>${E(r.points)} pts</span>`:''}</p>`:''}${open?detail(r,a,st):''}</div>${due(r)?`<span class="ba-b-due">${due(r)}</span>`:''}</li>`;}
 function row(r,a,st,extra='',lead=''){
  const open=!!st.open?.[r.id]||a.focus===r.id;
  const pick=(st.picking&&r.type==='work'?`<input type="checkbox" class="ba-pick" data-ba-pick="${E(r.id)}" aria-label="${E(r.name)}" ${st.picked?.[r.id]===false?'':'checked'}>`:'')+lead;
  return `<li class="ba-row" data-ba-id="${E(r.id)}" data-state="${E(r.state||'')}" data-open="${open}"${color(r.course?.color)}>${pick}<div class="ba-what">${nameButton(r,st,{open})}${meta(r)}${r.excerpt&&!open?`<p class="ba-excerpt">${E(r.excerpt)}</p>`:''}${extra}${open?detail(r,a,st):''}</div></li>`;
 }
 function detail(r,a,st){
  const d=r.detail||{},facts=[];
  if(r.due&&r.due.at!==null)facts.push(['Due',(r.due.long||r.due.text).replace(/^(?:Was due|Due) /,'').replace(/^./,x=>x.toUpperCase())]);
  if(r.points!==null&&r.points!==undefined)facts.push(['Points',String(r.points)]);
  if(r.stateText&&r.type==='work')facts.push(['State',r.stateText]);
  if(r.minutes)facts.push(['Length',(r.minutesFrom==='guess'?'About ':'')+len(r.minutes)+(r.minutesFrom==='guess'?' (a guess)':'')]);
  if(list(d.submit).length)
    facts.push([
      'Hand in',
      d.submit.join(', ')+
        (list(d.types).length?' ('+d.types.map(x=>'.'+x).join(', ')+')':'')+
        (d.attempts?' · '+d.attempts+(d.attempts===1?' attempt':' attempts'):'')+
        (d.timeLimit?' · '+d.timeLimit+' min limit':'')+
        (d.group?' · Group':'')
    ]);
  const hand='';
  const text=d.text?`<p class="ba-text">${E(d.text)}</p>`:'';
  const links=list(d.links).length?`<ul class="ba-links">${d.links.map(l=>`<li><a href="${E(l.url)}" target="_blank" rel="noopener noreferrer" data-ba-link>${E(l.label)}</a><small>${E(l.kind==='file'?'File':l.kind==='page'?'Page':l.kind==='canvas'?'Canvas':l.host)}</small></li>`).join('')}</ul>`:'';
  const rowActs=list(r.acts||actsFor(r,a,st)).filter(x=>!x.hidden);
  const main=rowActs.slice(0,2),rest=rowActs.slice(2);
  const buttons=`<div class="ba-row-acts">${main.map((x,i)=>btn(x,i===0?'primary':'')).join('')}</div>${rest.length?`<p class="ba-text-acts">${rest.map(x=>textBtn(x)).join('')}</p>`:''}`;
  return `<div class="ba-detail" data-ba-detail="${E(r.id)}">${facts.length?`<dl class="ba-facts">${facts.map(([k,v])=>`<dt>${E(k)}</dt><dd>${E(v)}</dd>`).join('')}</dl>`:''}${text}${links}${hand}${buttons}</div>`;
 }
 // the acts a row offers in its details: built by biscuit-answer (a.rowActs) or passed through on the row
 function actsFor(r,a,st={}){const fn=st.rowActs||root.ReserveBiscuitAnswer?.rowActs;return fn?fn(r).filter(x=>x.intent!=='details'):[];}
 function btn(x,tone=''){if(x.link)return `<a class="ba-btn${tone?' ba-btn--'+tone:''}" href="${E(x.link)}" target="_blank" rel="noopener noreferrer" data-ba-act="${E(x.id)}">${E(x.label)}${SVG.out}</a>`;return `<button type="button" class="ba-btn${tone?' ba-btn--'+tone:''}" data-ba-act="${E(x.id)}"${x.disabled?' disabled':''}>${E(x.label)}</button>`;}
 function textBtn(x){if(x.link)return `<a class="ba-text-act" href="${E(x.link)}" target="_blank" rel="noopener noreferrer" data-ba-act="${E(x.id)}">${E(x.label)}</a>`;return `<button type="button" class="ba-text-act" data-ba-act="${E(x.id)}"${x.disabled?' disabled':''}>${E(x.label)}</button>`;}
 function more(a,st,shown,total){const left=total-shown;return left>0?`<button type="button" class="ba-more" data-ba-more>${E('Show '+left+' more')}</button>`:'';}
 function filters(a,st){
   if(!list(a.filters).length||a.filters.length<2||list(a.rows).length<5)return '';
   const on=st.filter||'';
   return `<div class="ba-chips" role="group" aria-label="Courses"><button type="button" class="ba-chip" data-ba-filter="" aria-pressed="${!on}">All</button>${a.filters.map(f=>`<button type="button" class="ba-chip" data-ba-filter="${E(f.id)}" aria-pressed="${on===f.id}"${color(f.color)}>${E(f.label)}</button>`).join('')}</div>`;
 }
 function visible(a,st){return list(a.rows).filter(r=>!st.filter||r.course?.id===st.filter||r.type!=='work');}
 // ---- kinds
 const KIND={};
 KIND.plan=(a,st)=>{
  const rows=mergeParts(list(a.rows)),limit=st.size==='l'?40:st.all?40:12;let html='',n=0,lastDay='';
  for(const r of rows){if(n>=limit)break;n++;html+=st.layout==='b'?slotB(r,a,st):slot(r,a,st);}
  const left=st.left&&list(a.left).length?`<div class="ba-left"><p class="ba-group-head">Can wait</p><ul class="ba-list">${a.left.map(r=>row(r,a,st)).join('')}</ul></div>`:'';
  return `${early(a,st)}<ol class="ba-time"${st.layout==='b'?' data-layout="b"':''} data-applied="${!!a.applied}">${html}</ol>${rows.length>limit?more(a,st,limit,rows.length):''}${left}`;
 };
 function early(a,st){const b=list(a.before);if(!b.length)return '';return `<div class="ba-before"><p class="ba-group-head">Due before this plan starts</p><ul class="ba-list">${b.map(r=>row(r,a,st)).join('')}</ul>${a.plan?'<p class="ba-text-acts"><button type="button" class="ba-text-act" data-ba-plan="now">Plan from now</button></p>':''}</div>`;}
 // One row per piece of work: its parts (split by short breaks) stay together; breaks between two pieces stay visible.
 function mergeParts(rows){
   const out=[];
   for(const r of rows){
     const prev=out[out.length-1],gap=out[out.length-2];
     if(r.type==='work'&&r.itemId&&prev&&prev.type==='break'&&gap&&gap.type==='work'&&gap.itemId===r.itemId){
       out.pop();
       gap.end=r.end;
       gap.minutes+=r.minutes;
       gap.breaks=(gap.breaks||0)+1;
       gap.parts=[...(gap.parts||[{start:gap.start,end:prev.start}]),{start:r.start,end:r.end}];
       continue;
     }
     if(r.type==='work'&&r.itemId&&prev&&prev.type==='work'&&prev.itemId===r.itemId){prev.end=r.end;prev.minutes+=r.minutes;continue;}
     out.push({...r});
   }
   return out;
 }
 function slot(r,a,st){
  const z=st.zone,time=`<span class="ba-at"><b>${E(short(r.start,z))}</b><small>${E(r.end&&r.type!=='gap'?short(r.end,z):ampm(r.start,z))}</small></span>`;
  if(r.type==='break')return `<li class="ba-slot" data-type="break"><span class="ba-at"></span><p class="ba-quiet">Break · ${E(len(r.minutes))}</p></li>`;
  if(r.type==='gap')return `<li class="ba-slot" data-type="gap">${time}<p class="ba-quiet">Free · ${E(len(r.minutes))}</p></li>`;
  if(r.type==='busy')return `<li class="ba-slot" data-type="busy">${time}<div class="ba-what"><p class="ba-busy">${E(r.name)}</p><p class="ba-meta"><span>${E(len(r.minutes))}</span></p></div></li>`;
  const open=!!st.open?.[r.id];
  const until=`<span class="ba-until">${r.minutesFrom==='guess'?'≈':''}${E(len(r.minutes))}${r.breaks?` · ${E(r.breaks===1?'1 break':r.breaks+' breaks')}`:''}</span>`;
  const edit=st.size==='l'||open?'':'';
  const tools=open&&!a.applied?`<p class="ba-text-acts ba-plan-edit"><button type="button" class="ba-text-act" data-ba-plan="earlier" data-ba-item="${E(r.itemId)}">Earlier</button><button type="button" class="ba-text-act" data-ba-plan="later" data-ba-item="${E(r.itemId)}">Later</button><button type="button" class="ba-text-act" data-ba-plan="drop" data-ba-item="${E(r.itemId)}">Drop</button></p>`:'';
  return `<li class="ba-slot" data-type="work" data-state="${E(r.state||'')}" data-open="${open}"${color(r.course?.color)} data-ba-id="${E(r.id)}">${time}<div class="ba-what">${nameButton(r,st,{open})}${r.course&&!dateOnly(r.rawName||r.name)||due(r)?`<p class="ba-meta">${[r.course&&!dateOnly(r.rawName||r.name)?`<span class="ba-course"${color(r.course.color)}>${E(r.course.short)}</span>`:'',due(r)].filter(Boolean).join('<span class="ba-dot" aria-hidden="true">·</span>')}</p>`:''}<p class="ba-meta ba-len-line">${until}</p>${open?tools+detail(r,a,st):''}</div></li>`;
 }
 function slotB(r,a,st){
  const z=st.zone;if(r.type==='break'||r.type==='gap')return `<li class="ba-b-break" data-type="${E(r.type)}"><span>${E(r.type==='break'?'Break':'Free')} · ${E(len(r.minutes))}</span></li>`;
  const range=`<p class="ba-b-time">${E(clock(r.start,z).replace(/ (AM|PM)$/,''))} – ${E(clock(r.end,z))}<span>${E(len(r.minutes))}${r.breaks?' · '+E(r.breaks===1?'1 break':r.breaks+' breaks'):''}</span></p>`;
  if(r.type==='busy')return `<li class="ba-b-slot" data-type="busy">${range}<p class="ba-busy">${E(r.name)}</p></li>`;
  const open=!!st.open?.[r.id];
  return `<li class="ba-b-slot" data-type="work" data-state="${E(r.state||'')}" data-open="${open}"${color(r.course?.color)} data-ba-id="${E(r.id)}">${range}<div class="ba-what">${nameButton(r,st,{open})}${meta(r,{withLen:false})}${open&&!a.applied?`<p class="ba-text-acts ba-plan-edit"><button type="button" class="ba-text-act" data-ba-plan="earlier" data-ba-item="${E(r.itemId)}">Earlier</button><button type="button" class="ba-text-act" data-ba-plan="later" data-ba-item="${E(r.itemId)}">Later</button><button type="button" class="ba-text-act" data-ba-plan="drop" data-ba-item="${E(r.itemId)}">Drop</button></p>`:''}${open?detail(r,a,st):''}</div></li>`;
 }
 KIND.list=(a,st)=>{
  if(st.step!==undefined&&st.step!==null)return stepper(a,st);
  const rows=visible(a,st),byId=new Map(rows.map(r=>[r.id,r])),limit=st.all?999:LIMIT[st.size];let n=0,html='';
  let groups=list(a.groups).length?a.groups:[{key:'all',label:'',rows:rows.map(r=>r.id)}];
  if(st.layout==='b'&&a.kind==='list'){
    const map=new Map();
    for(const r of rows){const k=r.course?.id||'mine';if(!map.has(k))map.set(k,{key:'course-'+k,label:r.course?.short||'Your own',color:r.course?.color,rows:[]});map.get(k).rows.push(r.id);}
    groups=[...map.values()];
  }
  for(const g of groups){
    const inGroup=g.rows.map(id=>byId.get(id)).filter(Boolean);
    if(!inGroup.length)continue;
    const take=inGroup.slice(0,Math.max(0,limit-n));
    n+=take.length;
    if(!take.length)break;
    html+=`<section class="ba-group" data-group="${E(g.key)}"${st.layout==='b'?' data-layout="b"'+color(g.color):''}>${g.label?`<h4 class="ba-group-head">${E(g.label)}<span class="ba-count">${inGroup.length}</span>${g.sub?`<span class="ba-group-sub">${E(g.sub)}</span>`:''}</h4>`:''}<ul class="ba-list">${take.map(r=>st.layout==='b'?rowB(r,a,st):row(r,a,st)).join('')}</ul></section>`;
  }
  return filters(a,st)+html+more(a,st,n,rows.length);
 };
 KIND.week=KIND.list;
 KIND.next=(a,st)=>{const rows=list(a.rows);if(!rows.length)return '';return `<ol class="ba-list ba-ranked">${rows.map((r,i)=>row(r,a,st,'',`<span class="ba-key" aria-hidden="true">${i+1}</span>`)).join('')}</ol>`;};
 function stepper(a,st){
   const rows=visible(a,st),i=Math.max(0,Math.min(rows.length-1,st.step)),r=rows[i];
   if(!r)return '';
   return `<div class="ba-step"><p class="ba-step-count">${i+1} of ${rows.length}</p><ul class="ba-list">${row(r,a,{...st,open:{[r.id]:true}})}</ul><div class="ba-step-nav"><button type="button" class="ba-btn" data-ba-step="-1"${i===0?' disabled':''}>Back</button><button type="button" class="ba-btn" data-ba-step="1"${i>=rows.length-1?' disabled':''}>Next</button><button type="button" class="ba-text-act" data-ba-step="done">All</button></div></div>`;
 }
 KIND.item=(a,st)=>{
   const r=list(a.rows)[0];
   if(!r)return '';
   const also=list(a.also);
   return `<div class="ba-card"${color(r.course?.color)}>${detail(r,a,{...st})}</div>${also.length?`<div class="ba-also"><p class="ba-group-head">Also found</p><ul class="ba-list">${also.slice(0,3).map(x=>row(x,a,st)).join('')}</ul></div>`:''}`;
 };
 KIND.fact=(a,st)=>{const v=a.value||{},r=list(a.rows)[0];return `<div class="ba-fact"><p class="ba-label">${E(v.label||'')}</p><p class="ba-value">${E(v.text||'')}</p>${v.sub?`<p class="ba-sum">${E(v.sub)}</p>`:''}</div>${r?`<ul class="ba-list">${row(r,a,st)}</ul>`:''}`;};
 KIND.grades=(a,st)=>`${a.value?`<div class="ba-fact"><p class="ba-label">${E(a.value.label)}</p><p class="ba-value">${E(a.value.text)}</p></div>`:''}<ul class="ba-list ba-grades">${list(a.rows).map(r=>`<li class="ba-row"${color(r.course?.color)}><div class="ba-what"><span class="ba-name">${E(r.name)}</span>${r.course&&r.name!==r.course.short?`<p class="ba-meta"><span class="ba-course"${color(r.course.color)}>${E(r.course.short)}</span></p>`:''}</div><span class="ba-grade">${E(r.value)}</span></li>`).join('')}</ul>`;
 KIND.messages=(a,st)=>{
   const rows=list(a.rows),limit=st.all?99:LIMIT[st.size];
   return `<ul class="ba-list">${rows.slice(0,limit).map(r=>row({...r,excerpt:r.excerpt,when:[r.from,r.when].filter(Boolean).join(' · ')},a,st)).join('')}</ul>${more(a,st,Math.min(limit,rows.length),rows.length)}`;
 };
 KIND.files=(a,st)=>{
   const rows=list(a.rows),also=list(a.also);
   if(rows.length===1)return `<div class="ba-card">${rows[0].excerpt&&!rows[0].detail?`<p class="ba-text">${E(rows[0].excerpt)}</p>`:''}${detail(rows[0],a,st)}</div>${also.length?`<div class="ba-also"><p class="ba-group-head">Also found</p><ul class="ba-list">${also.slice(0,3).map(x=>row(x,a,st)).join('')}</ul></div>`:''}`;
   return `<ul class="ba-list">${rows.map(r=>row(r,a,st)).join('')}</ul>${also.length?`<div class="ba-also"><p class="ba-group-head">Also found</p><ul class="ba-list">${also.slice(0,3).map(x=>row(x,a,st)).join('')}</ul></div>`:''}`;
 };
 KIND.place=(a,st)=>{const rows=list(a.rows);return rows.length?`<ul class="ba-list">${rows.map(r=>row(r,a,st)).join('')}</ul>${a.more?`<p class="ba-quiet">${E(a.more)} more in ${E(a.title)}</p>`:''}`:'';};
 KIND.choose=(a,st)=>`<ol class="ba-list ba-choices">${list(a.rows).map(r=>`<li class="ba-row"${color(r.course?.color)}><button type="button" class="ba-choice" data-ba-choice="${E(r.choice)}"><span class="ba-key" aria-hidden="true">${E(r.choice)}</span><span class="ba-what"><span class="ba-name">${r.type==='work'&&r.course?`<span class="ba-course ba-lead"${color(r.course.color)}>${E(r.course.short)}</span> `:''}${E(r.name)}</span>${r.type==='work'?meta(r,{withLen:false,withCourse:false}):''}</span></button></li>`).join('')}</ol>`;
 KIND.steps=(a,st)=>{
   const rows=list(a.rows),done=rows.filter(r=>r.state==='done').length;
   return `<div class="ba-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${rows.length}" aria-valuenow="${done}"><i style="width:${rows.length?Math.round(done/rows.length*100):0}%"></i></div><ol class="ba-list ba-steps">${rows.map(r=>`<li class="ba-row" data-state="${E(r.state)}"><span class="ba-key" aria-hidden="true">${r.state==='done'?SVG.tick:r.state==='failed'?'!':E(r.step)}</span><div class="ba-what"><span class="ba-name">${E(r.name)}</span>${r.state==='failed'&&r.error?`<p class="ba-meta">${E(r.error)}</p>`:''}</div>${r.state==='waiting'?`<button type="button" class="ba-text-act" data-ba-run="${E(r.id)}">Do</button>`:''}</li>`).join('')}</ol>`;
 };
 KIND.change=(a,st)=>{
   const rows=list(a.rows),many=rows.length>1;
   return `<ul class="ba-list ba-changes">${rows.map(r=>{const ch=r.change||{from:r.from,to:r.to};const pick=many?`<input type="checkbox" class="ba-pick" data-ba-pick="${E(r.id)}" aria-label="${E(r.name)}" ${st.picked?.[r.id]===false?'':'checked'}>`:'';return `<li class="ba-row"${color(r.course?.color)}>${pick}<div class="ba-what">${!many&&r.type==='change'&&r.name===a.title?'':`<span class="ba-name">${E(r.name)}</span>`}${r.type==='work'?meta(r,{withLen:false}):''}<p class="ba-swap">${ch.from?`<span class="ba-from">${E(ch.from)}</span><span class="ba-arrow" aria-hidden="true">${SVG.arrow}</span>`:''}<span class="ba-to">${E(ch.to)}</span></p></div></li>`;}).join('')}</ul>${a.note?`<p class="ba-quiet">${E(a.note)}</p>`:''}${history(a,st)}`;
 };
 function history(a,st){
   const h=list(st.history);
   if(h.length<2&&a.kind==='done'||!h.length||!['change','done'].includes(a.kind))return '';
   return `<details class="ba-history"${st.historyOpen?' open':''}><summary>Changes · ${h.length}</summary><ol>${h.slice().reverse().map((x,i)=>`<li data-undone="${!!x.undone}"><span>${E(x.label)}</span>${i===0&&!x.undone?`<button type="button" class="ba-text-act" data-ba-undo>Undo</button>`:''}</li>`).join('')}</ol></details>`;
 }
 KIND.done=(a,st)=>{
   const rows=list(a.rows),card=a.focus&&rows.find(r=>r.id===a.focus);
   if(card)return `<div class="ba-card"${color(card.course?.color)}>${detail(card,a,st)}</div>${history(a,st)}`;
   return `${rows.length?`<ul class="ba-list">${rows.map(r=>row(r,a,st)).join('')}</ul>`:''}${history(a,st)}`;
 };
 KIND.timer=(a,st)=>{
   const t=a.timer||{},r=list(a.rows)[0];
   const bar=t.running&&t.left!=null?`<div class="ba-progress"><i style="width:${Math.max(0,Math.min(100,100-t.left/(t.minutes*60000)*100))}%"></i></div>`:'';
   return `${bar}${r?`<ul class="ba-list">${row(r,a,st)}</ul>`:''}`;
 };
 KIND.feature=(a,st)=>`<ol class="ba-path">${list(a.path).map((p,i,arr)=>`<li${i===arr.length-1?' aria-current="step"':''}>${E(p)}</li>`).join('')}</ol>${list(a.choices).length?`<div class="ba-chips">${a.choices.map(c=>`<button type="button" class="ba-chip" data-ba-choice="${E(c.id)}">${E(c.label)}</button>`).join('')}</div>`:''}`;
 KIND.ai=(a,st)=>`${list(a.rows).length?`<ul class="ba-list">${a.rows.map(r=>`<li class="ba-row"${color(r.course?.color)}><div class="ba-what"><span class="ba-name">${E(r.name)}</span>${meta({...r,format:''},{withLen:false})}</div></li>`).join('')}</ul>`:''}`;
 KIND.blocked=()=>'' ;
 KIND.none=(a,st)=>{const r=list(a.rows)[0];return early(a,st)+(r?`<p class="ba-group-head">${E(a.nextLabel||'Next up')}</p><ul class="ba-list">${row(r,a,st)}</ul>`:'');};
 KIND.unknown=(a,st)=>{const rows=list(a.rows);return rows.length?`<p class="ba-group-head">Maybe</p><ul class="ba-list">${rows.map(r=>row(r,a,st)).join('')}</ul>`:'';};
 KIND.chat=()=>'';
 KIND.error=(a,st)=>'';
 KIND.progress=(a,st)=>`<div class="ba-working"><p class="ba-title">${E(a.title)}</p><div class="ba-progress" data-busy><i></i></div></div>`;
 function acts(a,st){
  let x=list(a.acts).filter(v=>!v.hidden);if(a.kind==='item'||a.kind==='files'&&list(a.rows).length===1)return '';
  if(a.applied){const h=list(st.history),last=h[h.length-1];return `<footer class="ba-acts">${x.map((v,i)=>btn(v,i===0?'primary':'')).join('')}${last&&!last.undone?`<button type="button" class="ba-btn" data-ba-undo>Undo</button>`:''}</footer>`;}
  if(a.kind==='done'||a.kind==='error'&&!a.offline){
    const h=list(st.history),last=h[h.length-1];
    const undo=a.kind==='done'&&last&&!last.undone?`<button type="button" class="ba-btn" data-ba-undo>Undo</button>`:'';
    const retry=x.map(v=>btn(v,'primary')).join('');
    return undo||retry?`<footer class="ba-acts">${retry}${undo}</footer>`:'';
  }
  if(!x.length&&!(a.kind==='list'&&list(a.rows).length>1))return '';
  if(st.picking){
    const n=list(a.rows).filter(r=>r.type==='work'&&st.picked?.[r.id]!==false).length,many=list(a.acts).filter(v=>v.picked);
    return `<footer class="ba-acts">${many.map((v,i)=>`<button type="button" class="ba-btn${i===0?' ba-btn--primary':''}" data-ba-act="${E(v.id)}"${n?'':' disabled'}>${E(v.label+' · '+n)}</button>`).join('')}<button type="button" class="ba-text-act" data-ba-pick-cancel>Cancel</button></footer>`;
  }
  if(a.kind==='change'&&list(a.rows).length>1){const n=list(a.rows).filter(r=>st.picked?.[r.id]!==false).length;x=x.map(v=>v.primary?{...v,label:'Apply '+n,disabled:!n}:v);}
  const main=x.slice(0,SHOW_ACTS),pickable=a.kind==='list'&&list(a.rows).filter(r=>r.type==='work').length>1;
  return `<footer class="ba-acts">${main.map((v,i)=>btn(v,v.primary||i===0?'primary':'')).join('')}${pickable?`<button type="button" class="ba-text-act" data-ba-pick-start="plan-these">Choose</button>`:''}</footer>`;
 }

 function follow(a,st){
   const f=list(a.follow);
   if(!f.length||st.noFollow)return '';
   return `<div class="ba-follow">${f.map(v=>{
     const line=typeof v==='string'?v:v.line,label=typeof v==='string'?v:v.label||v.line;
     return `<button type="button" class="ba-chip" data-ba-follow="${E(line)}">${E(label)}</button>`;
   }).join('')}</div>`;
 }
 // Small drawn marks, in the bubble's own ink: the pen strokes pet.css's input line uses.
 const SVG={
  out:'<svg class="ba-ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M5 2.2H2.4v7.4h7.4V7M7 1.8h3.2V5M10 2 5.6 6.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow:'<svg viewBox="0 0 16 8" aria-hidden="true"><path d="M1 4.2c4-.3 8.5.2 13-.1M11 1.2l3 2.9-3 2.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  tick:'<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.2 6.4 4.8 9 9.9 2.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bigger:'<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M8.4 1.6h4v4M12.2 1.8 8.3 5.7M5.6 12.4h-4v-4M1.8 12.2l3.9-3.9" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  smaller:'<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M12.2 5.8h-4v-4M8.4 5.6l3.9-3.9M1.8 8.2h4v4M5.6 8.4l-3.9 3.9" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
 };
 // FLIP: what moved when the answer changed glides from where it was (transform and opacity only); new parts fade in.
 function flip(scope,mutate,{ms=240,win=root}={}){
  const reduce=win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||scope?.closest?.('[data-motion-style=off],[data-motion-style=still]');
  if(!scope||reduce||typeof scope.animate!=='function'){mutate();return;}
  const keyOf=n=>n.dataset.baId||n.dataset.baKey,before=new Map();for(const n of scope.querySelectorAll('[data-ba-id]'))before.set(keyOf(n),n.getBoundingClientRect());
  mutate();
  const ease='cubic-bezier(.2,.65,.3,1)';
  for(const n of scope.querySelectorAll('[data-ba-id]')){
    const b=before.get(keyOf(n)),r=n.getBoundingClientRect();
    if(b){const dy=b.top-r.top,dx=b.left-r.left;if(Math.abs(dy)>.5||Math.abs(dx)>.5)n.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:ms,easing:ease});}
    else n.animate([{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:ms,easing:ease});
  }
  for(const d of scope.querySelectorAll('.ba-detail:not([data-shown])')){
    d.dataset.shown='';
    d.animate([{opacity:0,transform:'translateY(-3px)'},{opacity:1,transform:'none'}],{duration:ms*0.9,easing:ease});
  }
 }
 const api={render,flip,mergeParts,E};root.ReserveBiscuitView=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
