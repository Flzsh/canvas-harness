'use strict';
// The real layout of Canvas's menu bar in every form (canvas-nav.js + canvas-nav.css) and of the Help band's run strip
// (study-band.js + Home's stylesheets), measured in a real browser at many widths: no two boxes laid over each other,
// nothing outside the bar, one height, More when the items do not fit. This test never starts a browser: it runs only
// when FOLIO_CDP_PORT names the DevTools port of one already running (the project's pooled browser); else it is skipped.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const port=process.env.FOLIO_CDP_PORT,skip=!port&&'set FOLIO_CDP_PORT to a running browser to measure layout';
const ext=path.resolve(__dirname,'../extension'),read=f=>fs.readFileSync(path.join(ext,f),'utf8');

async function tab(){
 const t=await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
 const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
 let id=0;const wait=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&wait.has(m.id)){wait.get(m.id)(m);wait.delete(m.id);}};
 const send=(method,params={})=>new Promise(ok=>{const i=++id;wait.set(i,ok);ws.send(JSON.stringify({id:i,method,params}));});
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)throw Error(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text);return r.result?.result?.value;};
 const size=async(width,height)=>{await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await ev('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,60))))');};
 const write=async html=>{await send('Page.navigate',{url:'about:blank'});await ev(`(document.open(),document.write(${JSON.stringify(html)}),document.close(),1)`);};
 const until=async(expression,ms=4000)=>{const end=Date.now()+ms;for(;;){if(await ev(expression).catch(()=>false))return true;if(Date.now()>end)return false;await new Promise(r=>setTimeout(r,50));}};
 return {send,ev,size,write,until,close:async()=>{ws.close();await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`).catch(()=>{});}};
}

// ---- Canvas's menu bar: a page marked up like a real Canvas (ids, icon containers, a logo tile, Studio, a badge)
const LOGO='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#1F3A5F"/><path d="M60 18l34 12v26c0 22-14 38-34 46-20-8-34-24-34-46V30z" fill="#D9A93B"/></svg>');
const AVATAR='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><rect width="50" height="50" fill="#C7CDD1"/></svg>');
const ICON='<svg class="ic-icon-svg" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff"><circle cx="12" cy="12" r="9"/></svg>';
function header(active){
 const item=(id,name,inner,role)=>`<li class="menu-item ic-app-header__menu-list-item${name===active?' ic-app-header__menu-list-item--active':''}"><a id="${id}"${role?' role="button"':''} href="${role?'#':'/'+name.toLowerCase()}" class="ic-app-header__menu-list-link"><div class="menu-item-icon-container" aria-hidden="true">${inner}</div><div class="menu-item__text">${name}</div></a></li>`;
 return `<header id="header" class="ic-app-header"><div class="ic-app-header__layout"><div class="ic-app-header__main-navigation"><div class="ic-app-header__logomark-container"><a href="/" class="ic-app-header__logomark"><span class="screenreader-only">Dashboard</span></a></div><ul id="menu" class="ic-app-header__menu-list">`
  +item('global_nav_profile_link','Account',`<div class="ic-avatar"><img src="${AVATAR.replace(/"/g,'&quot;')}#avatar-50.png" alt=""></div><span class="menu-item__badge"></span>`,true)
  +item('global_nav_dashboard_link','Dashboard',ICON)+item('global_nav_courses_link','Courses',ICON,true)+item('global_nav_calendar_link','Calendar',ICON)
  +item('global_nav_conversations_link','Inbox',ICON+'<span class="menu-item__badge">14<span class="screenreader-only">unread messages</span></span>')+item('global_nav_history_link','History',ICON,true)
  +`<li class="globalNavExternalTool menu-item ic-app-header__menu-list-item"><a class="ic-app-header__menu-list-link" href="/accounts/1/external_tools/9">${ICON.replace('class="ic-icon-svg"','class="ic-icon-svg menu-item__icon"')}<div class="menu-item__text">Studio</div></a></li>`
  +item('global_nav_help_link','Help',ICON,true)
  +`</ul></div><div class="ic-app-header__secondary-navigation"><ul class="ic-app-header__menu-list"><li class="menu-item ic-app-header__menu-list-item"><button type="button" id="primaryNavToggle" class="ic-app-header__menu-list-link" aria-label="Minimize global navigation">${ICON}</button></li></ul></div></div></header>`;
}
const CANVAS_CSS=`:root{--ic-brand-global-nav-bgd:#394B58;--ic-brand-global-nav-logo-bgd:#394B58}body{margin:0;font:16px "Segoe UI",sans-serif}
.ic-app-header{position:fixed;left:0;top:0;bottom:0;width:84px;height:100%;background:#394B58;z-index:100}.ic-app-header__layout{display:flex;flex-direction:column;height:100%}
.ic-app-header__main-navigation{flex:1 1 auto;overflow-y:auto;overflow-x:hidden}.ic-app-header__logomark{display:block;height:84px;background-image:url("${LOGO}");background-size:contain;background-position:50%;background-repeat:no-repeat}
.ic-app-header__menu-list{list-style:none;margin:0;padding:0}.ic-app-header__menu-list-link{display:block;position:relative;text-align:center;padding:7px 0;color:#fff;font-size:12px}
.menu-item-icon-container{position:relative;display:inline-block;width:26px;height:26px}.ic-avatar{width:26px;height:26px;border-radius:50%;overflow:hidden}.ic-avatar img{width:100%;height:100%}
.menu-item__badge{position:absolute;top:-6px;right:-14px;min-width:20px;height:20px;border-radius:10px;background:#0B874B;color:#fff;font-size:11px;line-height:20px}.menu-item__badge:empty{display:none}
.screenreader-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}#wrapper{margin-left:84px}body:not(.primary-nav-expanded) .ic-app-header{width:54px}body:not(.primary-nav-expanded) #wrapper{margin-left:54px}`;
function navPage(choice,{collapsed=false,active='Courses'}={}){
 return `<!doctype html><html><head><meta charset="utf-8"><style>${CANVAS_CSS}</style><style>${read('canvas-nav.css')}</style></head><body class="ic-app${collapsed?'':' primary-nav-expanded'}">${header(active)}<div id="wrapper"><div id="content" style="height:300px">Page</div></div><div id="nav-tray-portal"></div>`
  +`<script>window.ReserveSite={supported:()=>true};window.chrome={storage:{local:{get:async()=>({'reserve:canvasNav':'${choice}'}),set:async()=>{}},onChanged:{addListener(){},removeListener(){}}}};</script><script>${read('canvas-nav.js').replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
}
// what is drawn of the bar, measured: the bar's outline, each shown item and More, what lies outside, overlaps, rows
const NAV=`(()=>{const h=document.getElementById('header'),html=document.documentElement,hb=h.getBoundingClientRect(),bc=getComputedStyle(h,'::before'),px=v=>parseFloat(v)||0;
const bar={left:hb.left+px(bc.left),top:hb.top+px(bc.top),right:hb.right-px(bc.right),bottom:hb.bottom-px(bc.bottom)};
const shown=e=>{for(let p=e;p&&p!==html;p=p.parentElement){const c=getComputedStyle(p);if(c.display==='none'||c.visibility==='hidden'||+c.opacity<.03)return false;if(/inset\\(50%\\)/.test(c.clipPath))return false;if(p.classList.contains('screenreader-only'))return false;if(p===h)break;}return true;};
const links=[...h.querySelectorAll('.ic-app-header__main-navigation .ic-app-header__menu-list-link, .chn-more-link')].filter(e=>shown(e)&&e.getBoundingClientRect().width);
const out=[],T=1;const outside=(r,b)=>r.left<b.left-T||r.top<b.top-T||r.right>b.right+T||r.bottom>b.bottom+T;
const items=links.map(a=>{const r=a.getBoundingClientRect(),name=(a.querySelector('.menu-item__text,.chn-more-text')?.textContent||'').trim();
 for(const e of [a,...a.querySelectorAll('*')]){if(!shown(e))continue;const x=e.getBoundingClientRect();if(!x.width&&!x.height)continue;if(outside(x,bar))out.push(name+' '+(e.className.baseVal??e.className));}
 const after=getComputedStyle(a,'::after');if(after.content&&after.content!=='none'){if(px(after.left)<0||px(after.top)<0||px(after.right)<0||px(after.bottom)<0)out.push(name+' selected mark');}
 const badge=[...a.querySelectorAll('.menu-item__badge')].find(b=>shown(b)&&b.getBoundingClientRect().width);const bb=badge&&badge.getBoundingClientRect();
 const text=a.querySelector('.menu-item__text,.chn-more-text');return {name,r:[r.left,r.top,r.right,r.bottom],badge:bb?[bb.left,bb.top,bb.right,bb.bottom]:null,named:!!text&&shown(text)};});
const hits=[];for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=items[i].r,b=items[j].r;if(Math.min(a[2],b[2])-Math.max(a[0],b[0])>.5&&Math.min(a[3],b[3])-Math.max(a[1],b[1])>.5)hits.push(items[i].name+' x '+items[j].name);}
for(const it of items)if(it.badge){const [l,t,r,b]=it.badge,[L,T2,R2,B]=it.r;if(l<L-1||t<T2-1||r>R2+1||b>B+1)hits.push('badge outside '+it.name);}
const rows=new Set(items.map(it=>Math.round((it.r[1]+it.r[3])/2))).size;const more=h.querySelector('.chn-more:not([hidden])');
return {layout:html.dataset.chnLayout,fit:h.dataset.chnFit||'',folded:+(h.dataset.chnFolded||0),more:!!more,bar:[bar.left,bar.top,bar.right,bar.bottom].map(Math.round),height:Math.round(hb.height),width:Math.round(hb.width),W:innerWidth,H:innerHeight,items:items.map(i=>i.name),named:items.filter(i=>i.named).length,out,hits,rows,
 wrapper:(()=>{const w=document.getElementById('wrapper').getBoundingClientRect();return [Math.round(w.left),Math.round(w.top)];})()};})()`;
const ready=`document.documentElement.classList.contains('chn-nav')&&document.getElementById('header').dataset.chnLogo!=='wait'`;

test('across the top: one bar, one height, nothing outside it, one row; names beside, then under, then More',{skip},async t=>{
 const p=await tab();t.after(p.close);
 await p.size(1440,900);await p.write(navPage('top'));assert.ok(await p.until(ready),'the bar is drawn');
 const seen=new Set();
 for(const width of [2560,1920,1440,1280,1024,900,800,700,600,520,440,360,320]){
  await p.size(width,800);await p.until(`document.documentElement.dataset.chnPlace==='strip'`);const m=await p.ev(NAV);
  const where=`at ${width}: ${JSON.stringify({fit:m.fit,folded:m.folded,width:m.width})}`;
  assert.equal(m.layout,'top');assert.deepEqual(m.out,[],'nothing leaves the bar '+where);assert.deepEqual(m.hits,[],'no item over another '+where);
  assert.equal(m.rows,1,'one row '+where);assert.equal(m.height,48,'one height '+where);assert.ok(m.width<=width-24,'the bar fits the window '+where);
  assert.equal(m.items.length+(m.folded?m.folded-1:0),8,'every item is in the bar or in More '+where);assert.equal(m.more,m.folded>0,'More shows exactly when items are folded '+where);
  if(m.fit!=='icons')assert.equal(m.named,m.items.length,'each item shows its name '+where);
  assert.ok(Math.abs(m.wrapper[1]-(m.bar[3]+7))<=1,'the page starts under the bar '+where);
  seen.add(m.fit+(m.folded?'+more':''));
 }
 for(const form of ['full','stack','stack+more'])assert.ok(seen.has(form),'the bar takes the form '+form+' somewhere: '+[...seen]);
});

test('the More menu lists the folded items, presses the link it stands for, and closes with Escape',{skip},async t=>{
 const p=await tab();t.after(p.close);
 await p.size(420,800);await p.write(navPage('top',{active:'Help'}));assert.ok(await p.until(ready));await p.until(`!!document.querySelector('.chn-more:not([hidden])')`);
 const before=await p.ev(NAV);assert.ok(before.folded>=2,'items are folded at 420 px: '+before.folded);
 assert.equal(await p.ev(`document.querySelector('.chn-more').hasAttribute('data-chn-current')`),true,'More carries the selected mark when the current page is in it');
 await p.ev(`document.querySelector('.chn-more-link').click(),1`);
 const menu=await p.ev(`(()=>{const m=document.querySelector('.chn-more-menu');const r=m.getBoundingClientRect();return {open:!m.hidden,names:[...m.querySelectorAll('.chn-more-entry')].map(e=>e.textContent.trim()),focus:document.activeElement.className,inside:r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,expanded:document.querySelector('.chn-more-link').getAttribute('aria-expanded'),current:m.querySelector('[aria-current=page]')?.textContent.trim()}})()`);
 assert.ok(menu.open&&menu.inside,'the menu opens inside the window');assert.equal(menu.expanded,'true');assert.equal(menu.focus,'chn-more-entry','focus moves into the menu');
 assert.equal(menu.names.length,before.folded);assert.equal(menu.names.at(-1),'Help');assert.equal(menu.current,'Help');
 assert.ok(menu.names.includes('Inbox14')||menu.names.some(n=>/^Inbox/.test(n))||before.items.includes('Inbox'),'Inbox keeps its count in the menu when folded');
 await p.ev(`(window.__pressed=0,document.getElementById('global_nav_help_link').addEventListener('click',e=>{e.preventDefault();window.__pressed++}),1)`);
 await p.ev(`[...document.querySelectorAll('.chn-more-entry')].at(-1).click(),1`);
 assert.equal(await p.ev('window.__pressed'),1,'the entry presses Canvas\'s own link');assert.equal(await p.ev(`document.querySelector('.chn-more-menu').hidden`),true,'and the menu closes');
 await p.ev(`document.querySelector('.chn-more-link').click(),1`);
 await p.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await p.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 assert.equal(await p.ev(`document.querySelector('.chn-more-menu').hidden&&document.activeElement===document.querySelector('.chn-more-link')`),true,'Escape closes it and focus returns to More');
});

for(const [label,choice,collapsed] of [['the rail (Full height)','shown',false],['the rail, Canvas collapsed','shown',true],['the drawer (open)','drawn',false]])
 test(label+': nothing outside the bar or the window; on a short window the last items fold into More',{skip},async t=>{
  const p=await tab();t.after(p.close);
  await p.size(1440,900);await p.write(navPage(choice,{collapsed}));assert.ok(await p.until(ready));
  if(choice==='drawn')await p.ev(`(document.documentElement.dataset.chnDrawer='open',1)`);
  let folded=false;
  for(const height of [1080,900,768,600,500,420,360]){
   await p.size(1280,height);await p.ev('new Promise(r=>setTimeout(r,120))');const m=await p.ev(NAV);
   const where=`at ${height} high: ${JSON.stringify({folded:m.folded,bar:m.bar})}`;
   assert.deepEqual(m.out,[],'nothing leaves the bar '+where);assert.deepEqual(m.hits,[],'no item over another '+where);
   assert.ok(m.bar[3]<=height+1&&m.bar[1]>=-1,'the bar is inside the window '+where);
   assert.equal(m.items.length+(m.folded?m.folded-1:0),8,'every item is in the bar or in More '+where);
   if(!collapsed)assert.equal(m.named,m.items.length,'each item shows its name '+where);else assert.equal(m.named,0,'the collapsed rail shows drawings alone');
   if(choice==='shown')assert.ok(Math.abs(m.wrapper[0]-(collapsed?54:84))<=1,'the page starts where the rail ends '+where);
   folded||=m.folded>0;
  }
  assert.ok(folded,'a short window folds items into More');
  // folded, the bar stays still: nothing is folded and unfolded again frame after frame
  await p.size(1280,420);await p.ev('new Promise(r=>setTimeout(r,300))');
  const churn=await p.ev(`new Promise(r=>{let n=0;const o=new MutationObserver(l=>{n+=l.length;});o.observe(document.getElementById('header'),{attributes:true,subtree:true,attributeFilter:['data-chn-folded','hidden','data-chn-current']});setTimeout(()=>{o.disconnect();r(n);},1000);})`);
  assert.equal(churn,0,'no fold work while nothing changes ('+churn+' changes in 1 s)');
 });

// ---- the Help band's run strip: the real band (study-band.js) in Home's stylesheets
const BAND_CSS=['app.css','dashboard.css','workspace.css','refresh.css','responsive-layout.css','widgets.css','agent.css','study-band.css'];
const BAND_JS=['agent-clock.js','study-prompts.js','study-kind.js','study-tools.js','study-ui.js','study-band.js'];
function bandPage(){
 const js=BAND_JS.map(f=>`<script>${read(f).replace(/<\/script/gi,'<\\/script')}</script>`).join('');
 return `<!doctype html><html><head><meta charset="utf-8"><style>${BAND_CSS.map(read).join('\n')}</style><style>body{margin:0}.rd{min-height:0}</style></head><body><div class="rd" data-workspace="work"><main class="rd-workspace" style="width:100%;min-width:0"><div class="ch-band-host"></div></main></div>`
  +`<script>window.chrome={runtime:{id:'test',sendMessage:async()=>({ok:false}),onMessage:{addListener:fn=>{window.__runs=fn},removeListener(){}}}};</script>${js}`
  +`<script>window.__band=CanvasHarnessStudyBand.renderBand(document.querySelector('.ch-band-host'),{},{env:window,scope:'https://school.test|7|band',store:{getNotes:async()=>[]},onAsk:async()=>({ok:true}),helpItems:()=>[],onPrepare:async()=>({}),aiChoice:()=>'chatgpt',onAiChoice:async()=>{},effortChoice:()=>'',onEffortChoice:async()=>{},onAiCheck:async()=>({})});</script></body></html>`;
}
const RUNS={
 'testing (check)':[{state:'asking',check:true,progress:'Testing your AI'}],
 'queued (track)':[{state:'queued',progress:'Waiting for Canvas'}],
 'asking (track)':[{state:'asking',phase:'ask',progress:'Asking your AI'}],
 'needs you':[{state:'asking',phase:'ask',progress:'Asking your AI'},{state:'needs-you',needsYou:{reason:'Review the AI reply or import a corrected reply',action:'Read reply'}}],
 'done':[{state:'asking',check:true,progress:'Testing your AI'},{state:'unchanged',check:true,entry:'band',progress:'ChatGPT replied in 4 s'}],
 'failed':[{state:'asking',phase:'ask',progress:'Asking your AI'},{state:'failed',progress:'Your AI did not answer. Try again later.'}],
 'stopped':[{state:'asking',check:true,progress:'Testing your AI'},{state:'cancelled',check:true,progress:'Stopped'}]
};
const BAND=`(()=>{const band=document.querySelector('.ch-help-band'),tb=band.querySelector('.ch-band-toolbar'),pl=band.querySelector('.ch-prepare-status'),panel=band.querySelector('.ch-band-panel');
const vis=e=>{const b=e.getBoundingClientRect();if(b.width<1||b.height<1)return false;for(let p=e;p&&p!==document.body;p=p.parentElement){if(p.hidden)return false;const c=getComputedStyle(p);if(c.display==='none'||c.visibility==='hidden')return false;if(p.classList.contains('ch-sr-only'))return false;}return true;};
const nm=e=>String(e.className.baseVal??e.className).split(' ')[0]+':'+(e.textContent||'').trim().slice(0,14);const parts=[];
for(const c of tb.children){if(c===pl){for(const k of pl.children)if(vis(k))parts.push(k);}else if(c.classList.contains('ch-band-day')){for(const k of c.children)if(vis(k))parts.push(k);}else if(vis(c))parts.push(c);}
for(const c of panel.children)if(c!==tb&&vis(c))parts.push(c);for(const c of band.children)if(c!==panel&&vis(c))parts.push(c);
const hits=[];for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){const a=parts[i].getBoundingClientRect(),b=parts[j].getBoundingClientRect();const w=Math.min(a.right,b.right)-Math.max(a.left,b.left),h=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);if(w>.5&&h>.5)hits.push(nm(parts[i])+' x '+nm(parts[j]));}
const pb=panel.getBoundingClientRect(),cut=parts.filter(e=>{const b=e.getBoundingClientRect();return b.left<pb.left-1||b.right>pb.right+1||b.top<pb.top-1||b.bottom>pb.bottom+1||b.right>innerWidth+1;}).map(nm);
const words=pl.querySelector('.ch-prepare-words'),act=pl.querySelector('.ch-prepare-action');const wb=words&&vis(words)?words.getBoundingClientRect():null,ab=act&&vis(act)?act.getBoundingClientRect():null;
const firstRow=Math.min(...[...tb.children].filter(vis).map(e=>e.getBoundingClientRect().top));
return {hits,cut,line:vis(pl),words:wb?words.textContent:'',action:ab?act.textContent:'',drawn:!!(act&&act.querySelector('svg.ch-band-ico')),actHeight:ab?Math.round(ab.height):0,
 gap:wb&&ab?Math.round((ab.left-wb.right)*10)/10:null,sameRow:wb&&ab?Math.abs((wb.top+wb.bottom)/2-(ab.top+ab.bottom)/2)<3:null,ownLine:vis(pl)?pl.getBoundingClientRect().top-firstRow>8:null,
 ellipsis:wb?words.scrollWidth>words.clientWidth+1:false,last:vis(pl)?[...tb.children].filter(vis).every(e=>e===pl||e.getBoundingClientRect().top<=pl.getBoundingClientRect().top+1):null};})()`;

test('the Help band: the run strip\'s words and action are one group, and no two boxes in the band meet, at every width',{skip},async t=>{
 const p=await tab();t.after(p.close);
 await p.size(1440,900);await p.write(bandPage());assert.ok(await p.until(`!!document.querySelector('.ch-help-band .ch-band-toolbar')`),'the band is drawn');
 let serial=0;const forms=new Set();
 for(const [state,runs] of Object.entries(RUNS)){
  const id='layout-'+(++serial);let revision=0;
  for(const run of runs)await p.ev(`(window.__runs({target:'ch-ai-run',scope:'https://school.test|7',run:${JSON.stringify({...run,id,revision:++revision})}},{id:'test'}),1)`);
  for(const width of [2560,1920,1707,1536,1440,1366,1280,1024,900,768,600,414,360,320]){
   await p.size(width,900);const m=await p.ev(BAND);const where=`${state} at ${width}: ${JSON.stringify(m).slice(0,300)}`;
   assert.deepEqual(m.hits,[],'no two boxes meet: '+where);assert.deepEqual(m.cut,[],'nothing cut by the band or the window: '+where);
   if(m.action){
    assert.ok(m.drawn,'the action is a drawing and its name: '+where);assert.equal(m.actHeight,30,'the action is as tall as its neighbours: '+where);
    if(m.words){assert.ok(m.sameRow,'words and action stay on one line: '+where);assert.ok(Math.abs(m.gap-8)<=1,'8 px between the words and the action: '+where);}
   }
   if(m.ownLine)assert.ok(m.last,'a group on a line of its own is the band bar\'s last line: '+where);
   if(m.words||m.action)forms.add(m.ownLine?'own line':m.ellipsis?'shortened':'inline');
  }
 }
 assert.ok(forms.has('inline')&&forms.has('own line'),'the group is seen beside the bar and on its own line: '+[...forms]);
 const stop=await (async()=>{await p.size(1440,900);await p.ev(`(window.__runs({target:'ch-ai-run',scope:'https://school.test|7',run:{id:'layout-stop',revision:1,state:'asking',check:true,progress:'Testing your AI'}},{id:'test'}),1)`);
  return p.ev(`(()=>{const a=document.querySelector('.ch-prepare-action');a.focus();const c=getComputedStyle(a);return {text:a.textContent,act:a.dataset.act,outline:c.outlineStyle,outlineWidth:parseFloat(c.outlineWidth),border:c.borderTopColor,radius:c.borderRadius}})()`);})();
 assert.equal(stop.text,'Stop');assert.equal(stop.act,'stop');assert.notEqual(stop.border,'rgb(20, 20, 19)','Stop wears clay, not the plain ink edge');
});
