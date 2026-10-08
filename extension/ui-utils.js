/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function(root){
 'use strict';
 const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 function safeURL(value){try{const url=new URL(value,(globalThis.ReserveSite.origin()));return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'#';}catch{return '#';}}
 function color(value,fallback='#286452'){return /^#[0-9a-f]{6}$/i.test(value||'')?value:fallback;}
 function safeRichHTML(html){
  const template=document.createElement('template');template.innerHTML=String(html||'');
  const tags=new Set(['P','BR','UL','OL','LI','STRONG','EM','B','I','H1','H2','H3','H4','BLOCKQUOTE','CODE','PRE','A','TABLE','THEAD','TBODY','TR','TD','TH','HR']);
  const blocked=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','FORM','INPUT','BUTTON','TEXTAREA','SELECT','SVG','MATH','LINK','META','IMG','VIDEO','AUDIO']);
  // Mathematics (2.17.2, math.js): TeX between \( \), \[ \] or $$ $$ in a text node, and Canvas's equation images
  // (their TeX is in data-equation-content), are rendered as MathML that math.js builds itself; MathML already in the
  // teacher's HTML passes through math.js's own whitelist. Nothing inside code or pre is interpreted. Elements of
  // other namespaces report lower-case names, so the block list is checked without case (an svg never leaks its text).
  const M=root.ReserveMath,budget={left:M?.limits?.count??0};
  function visit(node,raw){if(node.nodeType===3){const text=node.textContent;return M&&!raw&&M.hasMath(text)?M.renderText(text,budget):escapeHTML(text);}if(node.nodeType!==1)return '';const name=String(node.tagName).toUpperCase();if(name==='MATH'&&M)return M.cleanMathML(node);if(name==='IMG'&&M){const tex=M.imageTeX(node);return tex&&budget.left-->0?M.html(tex,{source:tex}):'';}if(blocked.has(name))return '';const inside=Array.from(node.childNodes).map(child=>visit(child,raw||name==='CODE'||name==='PRE')).join('');if(!tags.has(node.tagName))return inside;const tag=node.tagName.toLowerCase();if(tag==='a'){const url=safeURL(node.getAttribute('href'));return url==='#'?inside:`<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${inside}</a>`;}let attributes='';if(tag==='td'||tag==='th')for(const name of ['colspan','rowspan']){const value=node.getAttribute(name);if(/^[1-9]\d?$/.test(value||''))attributes+=` ${name}="${value}"`;}return `<${tag}${attributes}>${inside}${['br','hr'].includes(tag)?'':`</${tag}>`}`;}
  return Array.from(template.content.childNodes).map(child=>visit(child,false)).join('');
 }
 function wallTimeToISO(value,timeZone){
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Choose a valid date and time.');
  const target=Date.parse(value+':00Z');
  if(!Number.isFinite(target)||new Date(target).toISOString().slice(0,16)!==value)throw Error('Choose a valid calendar date and time.');
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  function wall(ms){const p=Object.fromEntries(formatter.formatToParts(new Date(ms)).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
  // Probe both sides of a clock change, then round-trip every possible offset.
  const offsets=new Set([-86400000,0,86400000].map(delta=>Date.parse(wall(target+delta)+':00Z')-(target+delta)));
  const matches=[...offsets].map(offset=>target-offset).filter(ms=>wall(ms)===value).sort((a,b)=>a-b);
  if(!matches.length)throw Error('This local time does not exist because the clocks change. Choose another time.');
  return new Date(matches[0]).toISOString();
 }
 const api={escapeHTML,safeURL,color,safeRichHTML,wallTimeToISO};root.ReserveUI=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
