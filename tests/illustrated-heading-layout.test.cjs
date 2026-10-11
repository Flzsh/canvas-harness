'use strict';

/* Local fixture only: no Canvas requests, browser profile, or student data.
   FOLIO_RESPONSIVE_BROWSER=1 enables computed-layout checks. A local Playwright
   install or FOLIO_RESPONSIVE_PLAYWRIGHT supplies the browser driver. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ext=path.resolve(__dirname,'../extension');
const enabled=process.env.FOLIO_RESPONSIVE_BROWSER==='1';
const css=['app.css','dashboard.css','workspace.css','refresh.css','customize.css','settings-dock.css','gpa.css','responsive-layout.css']
  .map(name=>fs.readFileSync(path.join(ext,name),'utf8')).join('\n');
const Art=require('../extension/course-art.js');
const Custom=require('../extension/custom-art.js');
globalThis.ReserveCustomArt=Custom;
const chemistry={id:'layout-chemistry',name:'Chemistry',shortName:'Chemistry',originalName:'Chemistry'};
const panorama=course=>Art.scene(course,{crop:'wide',place:'heading'});
const svgTitle=(name,width)=>`<span class="rd-title-art" aria-hidden="true"><svg class="rd-art" data-crop="title" viewBox="0 0 ${width} 240" preserveAspectRatio="xMinYMax meet" aria-hidden="true" focusable="false"><text x="12" y="170" font-size="48">${name}</text></svg></span>`;
const customAsset=Custom.importSVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240"><text x="20" y="170" font-size="56">My lab</text></svg>','layout-title.svg');
const customTitle=`<span class="rd-title-art" aria-hidden="true">${Custom.render(customAsset,{kind:'title',className:'ch-custom-title',fit:'contain',position:'left'})}</span>`;
const pieces=[
  {key:'chemistry',name:'Chemistry',width:Art.titled(chemistry).width,room:Art.width(Art.kind(chemistry)),scene:panorama(chemistry),title:Art.titleFrame(chemistry)},
  // The parent supplies generic art; these fixtures exercise its documented
  // 360–720 by 240 title-frame contract without depending on that implementation.
  {key:'all',name:'All courses',width:360,room:Art.width('home'),scene:panorama({id:'folio-home',name:'All courses'}),title:svgTitle('All courses',360)},
  {key:'generic',name:'Independent research seminar',width:720,room:Art.width('home'),scene:panorama({id:'layout-generic',name:'Independent research seminar'}),title:svgTitle('Independent research',720)},
  {key:'custom',name:'My lab',width:600,room:Art.width(Art.kind(chemistry)),scene:panorama(chemistry),title:customTitle},
];

function fixture({sidebar=true,dock=false,smallBar=false,uploaded=false,bannerSize='default'}={}){
  const bannerAsset=Custom.importSVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240"><rect width="600" height="240" fill="#467d8a"/></svg>','layout-banner.svg');
  const upload={...chemistry,artPrefs:{bannerArt:bannerAsset,bannerFit:'cover',bannerPosition:'left'}};
  const content=pieces.map(p=>{
    const scene=uploaded?Art.scene(upload,{crop:'wide'}):p.scene;
    const style=`--rd-name-w:${p.width};--rd-room-w:${p.room}`;
    return `<div class="rd-workspace-heading"><div class="rd-course-heading" data-titled="true" data-fixture="work-${p.key}" style="${style}"><span class="rd-heading-art" aria-hidden="true">${scene}</span><h1>${p.name}</h1><label class="rd-course-select"><span class="rd-sr-only">Course filter</span><select aria-label="Course filter"><option>${p.name}</option></select></label><p>Teacher updates · October 11 <a href="#">Course home</a></p><div class="rd-glance"><button class="rd-glance-chip">Next assignment</button></div>${p.title}</div><div class="rd-work-search"><label class="rd-search"><input aria-label="Search assignments"></label></div></div>
      <header class="rd-page-heading rd-course-banner" data-titled="true" data-fixture="hub-${p.key}" style="${style}"><div class="rd-banner-art" aria-hidden="true">${scene}</div><div><h1>${p.name}</h1><p>Teacher updates · Course information</p><div class="rd-hub-links"><a href="#">Course work</a></div></div><div class="rd-heading-actions"><button>Original course</button></div>${p.title}</header>
      <header class="rd-materials-header rd-course-banner" data-titled="true" data-fixture="materials-${p.key}" style="${style}"><div class="rd-banner-art" aria-hidden="true">${scene}</div><div><h2>${p.name}</h2><p>Worksheets, pages &amp; schedules</p></div><div class="rd-heading-actions"><button>Refresh materials</button></div>${p.title}</header>`;
  }).join('');
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><style>body{margin:0}.rd{box-sizing:border-box;width:100%;max-width:100vw}.rd *{box-sizing:border-box}.rd-course-rail{min-width:0}${smallBar?'.rd .rd-workspace{width:330px;max-width:100%;--rd-search-at:bar}':''}</style><div class="rd" data-workspace="work" data-courses="${sidebar}" data-toolbox="${dock?'open':'closed'}" data-banner-size="${bannerSize}"><div class="rd-toolbar"><button>Work</button><div class="rd-tools"><button>Tools</button></div></div><div class="rd-shell"><aside class="rd-course-rail"><button>Chemistry</button></aside><main class="rd-workspace">${content}</main></div></div>`;
}

async function browserFor(t){
  const {chromium}=require(process.env.FOLIO_RESPONSIVE_PLAYWRIGHT||'playwright');
  const executablePath=process.env.FOLIO_RESPONSIVE_BROWSER_BIN||[
    chromium.executablePath(),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find(p=>fs.existsSync(p));
  assert.ok(executablePath,'No isolated Chromium binary available');
  const browser=await chromium.launch({executablePath,headless:true,args:['--disable-background-networking']});
  t.after(()=>browser.close());
  return browser;
}

async function evidence(page){
  return page.evaluate(()=>{
    const box=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
    const visible=e=>{if(!e)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>2&&r.height>2;};
    return {
      width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,
      headers:Array.from(document.querySelectorAll('[data-fixture]'),h=>{
        const work=h.classList.contains('rd-course-heading');
        const title=h.querySelector(':scope > .rd-title-art'),text=h.querySelector(work?':scope > h1':':scope > .rd-banner-art + div > :is(h1,h2)');
        const art=h.querySelector(work?':scope > .rd-heading-art':':scope > .rd-banner-art'),scene=art?.querySelector(':scope > .rd-art[data-wide]');
        const controls=work?Array.from(h.querySelectorAll(':scope > :is(.rd-course-select,p,.rd-glance)')):Array.from(h.querySelectorAll(':scope > .rd-banner-art + div > :not(h1,h2),:scope > .rd-heading-actions'));
        const styles=getComputedStyle(text),image=h.querySelector('.ch-custom-banner img');
        return {key:h.dataset.fixture,header:box(h),title:box(title),piece:box(title?.firstElementChild),art:box(art),scene:box(scene),titleVisible:visible(title),textVisible:visible(text),semantic:text.tagName,ariaHidden:text.getAttribute('aria-hidden'),hidden:text.hidden,display:styles.display,clip:styles.clipPath,controls:controls.filter(visible).map(box),uploaded:image?{fit:getComputedStyle(image).objectFit,position:getComputedStyle(image).objectPosition}:null};
      }),
    };
  });
}

test('illustrated titles survive exact phone, desktop, sidebar, and narrow dock widths',{skip:!enabled},async t=>{
  const browser=await browserFor(t),context=await browser.newContext({viewport:{width:1280,height:900}});
  await context.route(/^https?:/,route=>route.abort());
  const page=await context.newPage();
  const cases=[320,390,480,600,601,800,801,900,1239,1240,1280,1920,2560,3840].map(width=>({width}));
  cases.push(...[390,900,1280,1920,2560].map(width=>({width,sidebar:false})),...[1280,1720,1920].map(width=>({width,dock:true})),{width:1920,smallBar:true});
  cases.push(...['compact','large'].flatMap(bannerSize=>[390,1920,3840].map(width=>({width,bannerSize}))));
  for(const entry of cases){
    await page.setViewportSize({width:entry.width,height:900});
    await page.setContent(fixture(entry));
    const m=await evidence(page),label=JSON.stringify(entry);
    assert.equal(m.width,entry.width,`${label}: exact CSS viewport`);
    assert.ok(m.overflow<=2,`${label}: horizontal overflow ${m.overflow}`);
    for(const h of m.headers){
      const at=`${label} ${h.key}`;
      assert.ok(h.titleVisible,`${at}: artwork title missing`);
      assert.equal(h.textVisible,false,`${at}: duplicate plain heading visible`);
      assert.notEqual(h.display,'none',`${at}: semantic heading removed`);
      assert.notEqual(h.ariaHidden,'true',`${at}: semantic heading excluded`);
      assert.equal(h.hidden,false,`${at}: semantic heading hidden`);
      assert.ok(h.title.w>60&&h.piece.w>60&&h.piece.h>30,`${at}: title or custom image collapsed`);
      assert.ok(h.title.right<=h.header.right+2,`${at}: title escapes its heading`);
      assert.ok(h.art.w>20&&h.art.h>30,`${at}: panorama missing`);
      assert.ok(Math.abs(h.art.right-h.header.right)<=2,`${at}: room leaves unused banner width`);
      if(h.scene)assert.ok(Math.abs(h.scene.right-h.art.right)<=2,`${at}: scene does not fill its frame`);
      for(const c of h.controls)assert.ok(c.y>=h.title.bottom-2,`${at}: title overlaps controls or details ${JSON.stringify(h)}`);
    }
  }
  // Layout must survive a dock transition in the same document, not just load.
  await page.setViewportSize({width:1280,height:900});
  await page.setContent(fixture());
  await page.evaluate(()=>document.querySelector('.rd').dataset.toolbox='open');
  const after=await evidence(page);
  assert.ok(after.headers.every(h=>h.titleVisible&&!h.textVisible),'opening dock keeps a single illustrated title');
  await context.close();
});

test('forced colors restores real headings and custom banner fitting remains intact',{skip:!enabled},async t=>{
  const browser=await browserFor(t),context=await browser.newContext({viewport:{width:390,height:900}});
  await context.route(/^https?:/,route=>route.abort());
  const page=await context.newPage();
  for(const width of [390,1280,1920]){
    await page.setViewportSize({width,height:900});
    await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});
    await page.setContent(fixture({sidebar:false}));
    const m=await evidence(page);
    for(const h of m.headers){
      assert.ok(h.textVisible,`${width} ${h.key}: forced colors lost real heading`);
      assert.equal(h.titleVisible,false,`${width} ${h.key}: forced colors retains decorative title`);
      assert.equal(h.clip,'none',`${width} ${h.key}: forced colors heading still clipped`);
    }
    await page.emulateMedia({forcedColors:'none',reducedMotion:'no-preference'});
    for(const [bannerSize,height] of [['default',140],['compact',80],['large',220]]){
      await page.setContent(fixture({uploaded:true,sidebar:false,bannerSize}));
      const custom=await evidence(page);
      for(const h of custom.headers){
        assert.ok(h.titleVisible&&!h.textVisible,`${width} ${h.key}: uploaded banner lost title or duplicated heading`);
        assert.ok(Math.abs(h.art.h-height)<=1,`${width} ${bannerSize} ${h.key}: uploaded banner height changed ${JSON.stringify(h)}`);
        assert.equal(h.uploaded.fit,'cover',`${width} ${h.key}: uploaded fit changed`);
        assert.match(h.uploaded.position,/^(?:left|0%)/,`${width} ${h.key}: uploaded alignment changed`);
      }
    }
  }
  await context.close();
});
