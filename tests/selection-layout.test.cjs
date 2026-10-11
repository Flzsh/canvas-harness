'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const enabled=process.env.FOLIO_RESPONSIVE_BROWSER==='1';
const ext=path.resolve(__dirname,'../extension');
test('selection island preserves panel position and fits alongside dates across workspace widths',{skip:!enabled},async t=>{
 const {chromium}=require(process.env.FOLIO_RESPONSIVE_PLAYWRIGHT||'playwright');
 const executablePath=[chromium.executablePath(),'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
 const browser=await chromium.launch({executablePath,headless:true,args:['--disable-background-networking']});t.after(()=>browser.close());
 const page=await browser.newPage();await page.route(/^https?:/,route=>route.abort());
 const css=['app.css','dashboard.css','workspace.css','refresh.css','customize.css','responsive-layout.css','selection.css'].map(file=>fs.readFileSync(path.join(ext,file),'utf8')).join('\n');
 const actions='<section class="rd-selection-bar"><span role="status">2 selected</span><div><button class="rd-button">Use in AI</button><button class="rd-button">Archive</button><button class="rd-text-button">Clear</button></div></section>';
 for(const width of [320,390,600,760,761,900,1200,1201,1280,1920,2560,3840]){
  await page.setViewportSize({width,height:900});
  await page.setContent(`<style>${css}</style><style>body{margin:0}.rd{padding:0}.rd-workspace{width:100%;min-width:0}.rd-main{height:150px}</style><div class="rd" data-workspace="work"><main class="rd-workspace"><h1>Course title</h1><div class="rd-desk-toolbar"><div class="rd-list-toolbar"><button>Up next</button><button>Today</button><button>Week</button><button>My plan</button></div><div class="rd-week">${Array.from({length:7},(_,i)=>'<button class="rd-day-filter">Mon '+(i+1)+'</button>').join('')}</div><div class="rd-selection-slot"></div></div><section class="rd-main">Coursework</section></main></div>`);
  const boxes=()=>page.evaluate(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};return {main:box('.rd-main'),week:box('.rd-week'),slot:box('.rd-selection-slot'),island:document.querySelector('.rd-selection-bar')?box('.rd-selection-bar'):null,overflow:document.documentElement.scrollWidth-innerWidth};});
  const before=await boxes();await page.locator('.rd-selection-slot').evaluate((element,html)=>element.innerHTML=html,actions);
  const after=await boxes();assert.equal(after.main.y,before.main.y,'selection must not shift coursework at '+width);
  assert.equal(after.week.y,before.week.y,'selection must not shift dates at '+width);
  assert.ok(after.island.right<=width+1&&after.island.x>=0,'island fits at '+width);assert.ok(after.overflow<=1,'no horizontal overflow at '+width);
  if(width>760)assert.ok(after.island.x>=after.week.right-1,'actions sit to the right of dates at '+width);
  await page.locator('.rd-selection-slot').evaluate(element=>element.innerHTML='');assert.equal((await boxes()).main.y,before.main.y,'clearing must not shift coursework at '+width);
 }
});
