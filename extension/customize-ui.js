/* Canvas Harness "Make it yours": five focused tabs for public settings.
   Changes apply immediately and save on this device. Original creator: Flzsh. */
(function(root){
 'use strict';
 const enabled=id=>!root.ReserveFeatures||root.ReserveFeatures.enabled(id);
 const tabs=()=>enabled('customization')?TABS.filter(([key])=>key!=='pet'||enabled('pony')):[];
 const settingEnabled=key=>{
  const feature={sceneTheme:'scene-themes',dockSize:'arrange',motion:'motion',livingArt:'course-art',nightArt:'course-art',bannerSize:'course-art',showCourseIcons:'course-art',courseCardStyle:'course-art',showCourseInformation:'course-hub',showRecentGrades:'grades',deskOrder:'arrange',courseNavigation:'arrange',canvasNav:'canvas-nav'}[key];
  return (!feature||enabled(feature))&&(key!=='livingArt'||enabled('motion'));
 };
 const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const TABS=[['look','Look'],['layout','Home'],['courses','Courses'],['pet','Pony'],['settings','More']];
 // Keep old entry points useful after removing Artwork and the combined view.
 const ALIASES={all:'look',art:'courses'};
 const SETTING_TABS={layout:['courseNavigation','dockSize','deskOrder','density','showCourseStrip','showCourseIcons','showDeadlinePreview','showBookmarks','showCourseInformation','showRecentGrades','greeting','quickOpen','canvasNav'],courses:['bannerSize','courseCardStyle'],pet:['bedtime','biscuitOffers']};
 const tabFor=key=>typeof key==='string'&&key.startsWith('pet.')?'pet':Object.keys(SETTING_TABS).find(tab=>SETTING_TABS[tab].includes(key))||'look';
 // Little diagrams of the page: R a filled block, O an outlined block, L a line of text.
 const svg=inner=>`<svg viewBox="0 0 72 48" width="72" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
 const R=(x,y,w,h,cls='a')=>`<rect class="cz-${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5"/>`;
 const L=(x,y,w)=>`<path d="M${x} ${y}h${w}"/>`;
 let diagrams;
 const artDiagrams=()=>diagrams||(diagrams={
  sidebar:svg(R(3,4,15,40,'fill')+R(22,4,47,40)),
  topbar:svg(R(3,4,66,9,'fill')+R(3,17,66,27)),
  dock:svg(R(3,4,66,31)+R(17,38,38,8,'fill')+R(20.5,39.5,5,5)+R(28,39.5,5,5)+R(35.5,39.5,5,5)+R(43,39.5,5,5)),
  // Canvas's menu bar: a tab at the edge, a column, a row in the toolbar, Canvas's own dark column
  navEdge:svg(R(12,4,57,40)+R(3,15,5,18,'fill')),
  navColumn:svg(R(3,4,10,40,'soft')+R(17,4,52,40)+'<circle cx="8" cy="12" r="1.8"/><circle cx="8" cy="20" r="1.8"/><circle cx="8" cy="28" r="1.8"/>'),
  navTop:svg(R(3,4,66,40)+R(22,8,30,7,'fill')),
  navOriginal:svg(R(3,4,10,40,'fill')+R(17,4,52,40)),
  'context-first':svg(R(3,5,19,38,'soft')+R(26,5,20,38,'fill')+R(50,5,19,38)+L(7,12,10)+L(7,17,7)),
  'work-first':svg(R(3,5,20,38,'fill')+R(27,5,19,38)+R(50,5,19,38,'soft')+L(54,12,10)+L(54,17,7)),
  stacked:svg(R(8,4,56,11,'fill')+R(8,19,56,11)+R(8,34,56,10,'soft')),
  studio:svg(R(2,4,11,40,'fill')+R(16,4,17,40,'soft')+R(36,4,17,40,'fill')+R(56,4,14,40)),
  study:svg(R(2,4,11,40,'fill')+R(16,4,19,40,'fill')+R(38,4,17,40)+R(58,4,12,40,'soft')),
  focus:svg(R(2,4,68,8,'fill')+R(2,16,36,28,'fill')+R(42,16,28,28)),
  compact:svg(R(3,4,66,7,'fill')+R(3,15,66,29)+L(8,22,30)+L(8,28,22)),
  standard:svg(R(3,4,66,13,'fill')+R(3,21,66,23)+L(8,28,30)+L(8,34,22)),
  large:svg(R(3,4,66,21,'fill')+R(3,29,66,15)+L(8,36,30)),
  comfortable:svg(L(8,10,40)+L(8,16,26)+L(8,27,40)+L(8,33,26)+'<circle cx="60" cy="13" r="3"/><circle cx="60" cy="30" r="3"/>'),
  dense:svg(L(8,8,40)+L(8,13,26)+L(8,20,40)+L(8,25,26)+L(8,32,40)+L(8,37,26)+'<circle cx="60" cy="10.5" r="2.6"/><circle cx="60" cy="22.5" r="2.6"/><circle cx="60" cy="34.5" r="2.6"/>'),
  sketch:svg('<path class="cz-soft" d="M8 9c18-2 38-1 56 .5c1.6 9 1 20 .4 29c-18 1.6-38 1-56-.4c-1.4-9-1-20-.4-29z"/>'+L(16,19,26)+L(16,26,36)),
  rounded:svg(R(8,9,56,30,'soft').replace('rx="2.5"','rx="8"')+L(16,19,26)+L(16,26,36)),
  minimal:svg(L(8,19,26)+L(8,26,36)+'<path class="cz-accent" d="M8 38h56"/>'),
  gentle:svg('<path d="M9 38C24 38 25 9 39 11.5C47 13 49 21 55 19.6C58.4 18.8 60.4 18.2 62.6 18.2"/><path d="M9 42.4h7M20 42.4h4" opacity=".45"/><circle class="cz-fill" cx="62.6" cy="18.2" r="3.4"/>'),
  still:svg(R(10,10,22,28,'soft')+R(40,10,22,28,'fill')),
  off:svg(R(14,10,44,28)+'<path d="M24 24h24"/>')
 });
 function render(c){
  if(!enabled('customization'))return '';
  const shell=inner=>`<div class="rd-appearance t-acc ch-settings-dock" data-open="${!!c.customizeOpen}" role="complementary" aria-labelledby="rd-appearance-title" ${c.customizeOpen?'':'inert aria-hidden="true"'}><div class="t-acc-panel" id="rd-appearance-panel" ${c.customizeOpen?'':'inert aria-hidden="true"'}><div class="t-acc-panel-inner"${c.customizeOpen?'':' data-rd-key="customize-content"'}>${inner}</div></div></div>`;
  if(!c.customizeOpen)return shell('');
  const s={...root.ReserveCustomization.defaults,theme:'system',accent:'clay',font:'system',textSize:'standard',motion:'gentle',livingArt:'on',readingFont:'book',greeting:'on',...c.s,...(!enabled('motion')?{motion:'off',livingArt:'off'}:{})},id=c.customizeCourseId||'all',course=c.allCourses.find(x=>x.id===id),pref=id==='all'?(s.overviewArt||{}):(s.coursePrefs?.[id]||{});
  const label=course?.name||'All courses',visible=new Set(c.courses.map(x=>x.id));
   // A missing, removed or unavailable tab opens Look; each render builds one pane.
   const allowedTabs=tabs(),asked=ALIASES[c.customizeTab]||c.customizeTab||'look',tab=allowedTabs.some(([key])=>key===asked)?asked:'look',on=key=>tab===key;
  const button=(action,label,extra='',cls='rd-button')=>`<button type="button" class="${cls}" data-rd-action="${action}" ${extra}>${label}</button>`;
  const select=(key,label,options,field='setting',value=s[key])=>!settingEnabled(key)?'':`<label class="rd-field"><span>${E(label)}</span><select data-rd-field="${field}" data-setting="${key}" data-id="${E(id)}" aria-label="${E(label)}">${options.map(([v,l])=>`<option value="${v}"${v===value?' selected':''}>${E(l)}</option>`).join('')}</select></label>`;
   // Only level locks show their requirement; scene locks have no description.
   const choices=(key,title,options,{value=s[key],cols=3,field='setting',data='setting',className=''}={})=>!settingEnabled(key)?'':`<div class="cz-choices${className?' '+E(className):''}" role="radiogroup" aria-label="${E(title)}" style="--cz-cols:${cols}">${options.map(([v,name,hint,art,locked])=>`<label class="cz-choice"${locked?' data-locked="true"':''}><input type="radio" name="cz-${key}" data-rd-field="${field}" data-${data}="${key}" value="${E(v)}" ${v===value?'checked':''} ${locked?'disabled':''}><span class="cz-choice-art">${art||''}</span><strong>${E(name)}</strong>${locked&&/^Level \d+$/.test(hint||'')?`<small>${E(hint)}</small>`:''}</label>`).join('')}</div>`;
   // Keep the shared-computer caution next to Open at once.
   const toggle=(key,name,hint,{checked=s[key]!==false,field='setting',data='setting',warn=false}={})=>!settingEnabled(key)?'':`<label class="cz-toggle"><span><strong>${E(name)}</strong>${warn&&hint?`<small>${E(hint)}</small>`:''}</span><input type="checkbox" role="switch" data-rd-field="${field}" data-${data}="${key}" ${checked?'checked':''}><i aria-hidden="true"></i></label>`;
  const group=(title,hint,body)=>{
   const feature={'Start from a layout':'arrange','Modules on Home':'planner','Canvas\u2019s menu bar':'canvas-nav','Where your courses are':'arrange','Course size':'arrange','Order of the three panels':'arrange',Banner:'course-art','Artwork at night':'course-art','Outline round modules':'planner','Course cards':'course-art',Motion:'motion'}[title];
    return feature&&!enabled(feature)?'':`<section class="cz-group" data-art="${E(title)}"><h3>${E(title)}</h3>${body}</section>`;};

   const picker=options=>root.ReserveMakeYourOwn?.picker(c.makeOwn,s,options)||'';


  const layout=()=>{
   const ART=artDiagrams();ART.dockSize=ART.dock;
   return group('Start from a layout','Three ready-made pages. Pick one, then change anything below. Modules you added stay.',
     `<div class="cz-presets" role="group" aria-label="Layout presets">${[['studio','Studio'],['study','Study'],['focus','Focus']].map(([key,title])=>button('layout-preset',`<span class="cz-choice-art">${ART[key]}</span><strong>${title}</strong>`,`data-value="${key}" aria-pressed="${Object.entries(root.ReserveCustomization.presets?.[key]||{}).every(([k,v])=>JSON.stringify(s[k])===JSON.stringify(v))}"`,'ch-preset cz-preset')).join('')}</div>`)
   +group('Modules on Home','Add a timer, today’s list, a clock, notes or your pony beside the three panels, and switch any of them off.',
     `<div class="cz-row">${button('board-edit','Edit Home…','data-from="settings"','rd-button rd-button-primary')}</div>`)
    +group('Order of the three panels','',choices('deskOrder','Panel order',[['context-first','Course first','Course news, work, details.',ART['context-first']],['work-first','Work first','Work, details, course news.',ART['work-first']],['stacked','One column','Everything in one stack.',ART.stacked]]))
   +group('Where your courses are','',choices('courseNavigation','Course navigation',[['sidebar','Down the side','A list that stays beside the page.',ART.sidebar],['topbar','Across the top','A strip of cards; more room for the page.',ART.topbar],['dock','Along the bottom','A dock of courses at the bottom of the page.',ART.dock]]))
   +(s.courseNavigation==='dock'?group('Course size','',choices('dockSize','Course size',[['small','Small','',ART.dockSize],['medium','Medium','',ART.dockSize],['large','Large','',ART.dockSize]])):'')
   +group('Spacing','',choices('density','Spacing',[['comfortable','Roomy','More air between rows.',ART.comfortable],['compact','Compact','More rows on the screen.',ART.dense]],{cols:2}))
    +group('What shows','',`<div class="cz-toggles">${toggle('showCourseStrip','Course list','The courses beside, above or below the page.')}${toggle('showCourseIcons','Course drawings','The small drawing on each course.')}${toggle('showDeadlinePreview','Next deadlines on courses','What is due next, under each course name.')}${toggle('showBookmarks','Bookmarks shelf','The row of bookmarks under the heading.')}${toggle('showCourseInformation','Course information','Announcements, messages and the teacher’s page.')}${toggle('showRecentGrades','Recent scored work','Shown only while Show grades is on.')}${toggle('greeting','Greeting','“Good morning” on All courses, instead of a plain title.',{checked:s.greeting!=='off'}).replace('data-setting="greeting"','data-setting="greeting" data-onoff="true"')}${toggle('quickOpen','Open at once','Leave this off on a shared computer.',{checked:s.quickOpen==='on',warn:true}).replace('data-setting="quickOpen"','data-setting="quickOpen" data-onoff="true"')}</div>`)
    +group('Canvas’s menu bar','',choices('canvasNav','Canvas menu bar',[['drawn','From the left edge','',ART.navEdge],['shown','Full height','',ART.navColumn],['top','Across the top','',ART.navTop],['original','Canvas’s own','',ART.navOriginal]],{value:c.canvasNav||'drawn',cols:2,field:'canvas-nav'}))
    +group('Saved layouts & plans','',picker({kinds:['preset'],presetKinds:['layout','planner'],label:'Saved layouts and plans'}));
  };

   const bannerGroup=()=>{const ART=artDiagrams();return group('Banner','',choices('bannerSize','Banner size',[['compact','Small','',ART.compact],['standard','Medium','',ART.standard],['large','Tall','',ART.large]]));};
   const courseCardGroup=()=>{const ART=artDiagrams();return group('Course cards','',choices('courseCardStyle','Course frames',[['sketch','Hand-drawn','',ART.sketch],['rounded','Rounded','',ART.rounded],['minimal','Minimal','',ART.minimal]]));};

  const look=()=>{
   const ART=artDiagrams();
  const swatch=(bg,line,ink)=>`<svg viewBox="0 0 72 48" width="72" height="48" aria-hidden="true"><rect x="3" y="4" width="66" height="40" rx="5" fill="${bg}" stroke="${line}" stroke-width="1.5"/><path d="M10 14h30M10 22h44M10 30h36" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  const letters=family=>`<span class="cz-letters" style="font-family:${family}">Aa</span>`;
  const accentButtons=[['clay','Clay','#A9522F'],['forest','Forest','#367964'],['indigo','Iris','#5f5ccc'],['rose','Rose','#9e4c6c'],['ocean','Ocean','#2f7185'],['amber','Amber','#956821']].map(([key,name,color])=>button('accent',`<i aria-hidden="true" style="background:${color}"></i><span>${name}</span>`,`data-accent="${key}" aria-label="${name} accent" title="${name} accent" aria-pressed="${s.accent===key}"`,'rd-swatch ch-accent-choice')).join('');
  const frames=(enabled('planner')?root.ReserveWidgets?.FRAMES||[]:[]).map(([value,name,hint])=>button('board-frame',`<i data-frame="${value}"></i>${E(name)}`,`role="radio" data-value="${value}" aria-checked="${(s.panelFrame||'pen')===value}" title="${E(hint)}"`,'rd-frame-choice')).join('');
  const night=Math.max(0,Math.min(100,Math.round(Number(s.nightArt)||0))),sceneActive=enabled('scene-themes')&&['starry','sea','stars','blueprint'].includes(s.sceneTheme);
  // No page-relative URLs: a browserless preview keeps the plain illustration.
  const poster=scene=>root.chrome?.runtime?.getURL?`<img class="cz-scene-poster" src="${E(root.chrome.runtime.getURL(`themes/${scene}/poster.jpg`))}" alt="" aria-hidden="true" width="160" height="90" loading="lazy">`:ART.still;
  const sceneChoices=()=>enabled('scene-themes')?group('Scene','',choices('sceneTheme','Scene',[
   ['','None','',swatch('#FAF9F5','#E8E6DC','#3D3D3A')],
   ['starry','Starry Night','',poster('starry')],
   ['sea','Under the Sea','',poster('sea')],
   ['stars','Starfield','',poster('stars')],
   ['blueprint','Blueprint','',poster('blueprint')]
  ],{cols:2,className:'cz-scenes'})):'';
   return sceneChoices()+group('Light or dark','Dark is only ever on when you choose it here.',choices('theme','Theme',[['light','Light','Ivory paper, as always.',swatch('#FAF9F5','#E8E6DC','#3D3D3A'),sceneActive],['dark','Dark','A dark page for the evening.',swatch('#1F1E1D','#30302E','#E8E6DC'),sceneActive]],{value:s.theme==='dark'?'dark':'light',cols:2}))
   +(sceneActive?'':(s.theme==='dark'?group('Artwork at night','How the drawings look on the dark page: chalk on the board at one end, the paper kept and dimmed at the other.',`<label class="cz-night"><span>Chalk</span><input type="range" min="0" max="100" step="5" data-rd-field="setting" data-setting="nightArt" value="${night}" aria-label="Artwork at night: chalk at 0, paper at 100" aria-valuetext="${night<50?'Chalk':'Paper'}, ${night}%"><span>Paper</span><output>${night}%</output></label>`):''))
   +group('Accent color','Buttons, links and highlights. Course drawings keep their own colors.',`<div class="ch-accent-actions cz-accents" role="group" aria-label="Accent color">${accentButtons}</div>`)
   +group('Page color','A very light tint behind everything. Accent is for buttons; this is for the mood of the page.',choices('pageTint','Page color',[['paper','Paper','',swatch('#FAF9F5','#E8E6DC','#8A8880')],['accent','Match accent','',swatch('color-mix(in srgb,var(--rd-accent) 9%,#FDFDFC)','color-mix(in srgb,var(--rd-accent) 30%,#E7E7E4)','var(--rd-accent)')],['sky','Sky','',swatch('#F2F7FC','#D3E2F0','#3F8FCC')],['sage','Sage','',swatch('#F3F8F2','#D6E5D3','#5E8F5A')],['lilac','Lilac','',swatch('#F7F4FC','#E0D8F0','#8B6FC9')],['blush','Blush','',swatch('#FCF4F6','#F0D6DD','#D0607F')],['sand','Sand','',swatch('#FBF7EF','#EADFC8','#B98A3E')],['snow','Snow','',swatch('#FCFCFD','#E4E6EA','#8A8F98')]],{cols:4}))
   +group('Page','',choices('surfaceStyle','Page style',[['paper','Warm paper','Ivory, soft lines.',swatch('#FAF9F5','#E8E6DC','#5E5D59')],['clean','Clean','Cool white, grey lines.',swatch('#F8FAFC','#D8DEE6','#566070')],['contrast','High contrast','Darker text and lines.',swatch('#FFFFFF','#555555','#111111')]]))
   +group('Outline round modules','How each module on Home is framed.',`<div class="cz-frames" role="radiogroup" aria-label="Module outline">${frames}</div>`)
   +group('Type','',`<h4 class="cz-subhead">Letters</h4>`+choices('font','Interface type',[['system','Modern','',letters('"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif')],['humanist','Humanist','',letters('Calibri,Candara,"Segoe UI",sans-serif')],['serif','Bookish','',letters('Literata,Georgia,serif')]])
     +`<h4 class="cz-subhead">Size</h4>${choices('textSize','Text size',[['standard','Standard','',`<span class="cz-letters cz-small">Aa</span>`],['large','Larger','',`<span class="cz-letters">Aa</span>`]],{cols:3})}<h4 class="cz-subhead">Reading text</h4>${choices('readingFont','Reading text',[['book','Book serif','For teachers’ text.',letters('Literata,Georgia,serif')],['interface','Same as letters','',letters('inherit')]],{cols:3})}`)
   +group('Motion','',choices('motion','Motion',[['gentle','Gentle','Things glide and settle.',ART.gentle],['still','Fades only','No sliding, only fades.',ART.still],['off','Off','Nothing moves.',ART.off]])
      +`<div class="cz-toggles">${toggle('livingArt','Living drawings','',{checked:s.livingArt!=='off'}).replace('data-setting="livingArt"','data-setting="livingArt" data-onoff="true"')}</div>`)
    +group('Saved looks','',picker({kinds:['theme','preset'],presetKinds:['settings'],label:'Saved looks'}));
  };

  const art=()=>{
   const id=c.customizeCourseId||'all',course=c.allCourses.find(x=>x.id===id),pref=id==='theme'?(s.themeArt||{}):id==='all'?(s.overviewArt||{}):(s.coursePrefs?.[id]||{}),label=id==='theme'?'Theme':course?.name||'All courses';
  const select=(key,label,options,field='setting',value=s[key])=>`<label class="rd-field"><span>${E(label)}</span><select data-rd-field="${field}" data-setting="${key}" data-id="${E(id)}" aria-label="${E(label)}">${options.map(([v,l])=>`<option value="${v}"${v===value?' selected':''}>${E(l)}</option>`).join('')}</select></label>`;
  const F=root.ReserveMediaFrame,frames=!!(F&&root.ReserveFrameEditor),artAsset=value=>F?.asset(value)||value?.asset||value;
  const currentIds=new Set(c.allCourses.map(x=>x.id));
  const unused=Object.entries(s.coursePrefs||{}).filter(([id,pref])=>!currentIds.has(id)&&root.ReserveCustomization.artKeys.some(key=>pref[key]));
  const unusedArt=unused.length?`<details class="ch-details" data-rd-section="unused-art"><summary>Artwork from other courses (${unused.length})</summary><div class="ch-unused-art">${unused.map(([id,pref])=>`<div><strong>${E(pref.name||'Course '+id)}</strong>${root.ReserveCustomization.artKeys.filter(key=>pref[key]).map(key=>`<div><span>${E(artAsset(pref[key])?.name||'Artwork')}</span>${button('art-remove','Remove '+key.replace('Art',''),`data-id="${E(id)}" data-kind="${key.replace('Art','')}"`,'rd-text-button')}</div>`).join('')}</div>`).join('')}</div></details>`:'';
  const artCourse={id:id==='all'||id==='theme'?'folio-home':id,name:label,originalName:course?.originalName,shortName:course?.shortName,artPrefs:pref,artMotion:s.livingArt!=='off'&&s.motion==='gentle'};
  const paste=kind=>`<details class="ch-paste" data-rd-section="paste-${E(id)}-${kind}"><summary>Paste SVG</summary><label><span class="rd-sr-only">${kind==='border'?'frame':kind} SVG source</span><textarea data-rd-field="art-source" data-id="${E(id)}-${kind}" data-course="${E(id)}" data-kind="${kind}" maxlength="262144" spellcheck="false" aria-label="${kind==='border'?'frame':kind} SVG source" placeholder="<svg …>…</svg>">${E(c.customizeDrafts?.[id+':'+kind]||'')}</textarea></label>${button('art-paste','Apply SVG',`data-id="${E(id)}" data-kind="${kind}" ${c.customizeBusy?'disabled':''}`)}</details>`;
  const artwork=(kind,title)=>{
   const value=pref[kind+'Art'],asset=artAsset(value),framing=['banner','card','background'].includes(kind),word=kind==='border'?'frame':kind;
   const preview=value&&frames&&framing?'':asset?.mediaId&&root.ReserveMedia?root.ReserveMedia.render(asset,{kind,className:'ch-art-image',fit:'contain'}):asset&&root.ReserveCustomArt?root.ReserveCustomArt.render(asset,{kind,motion:artCourse.artMotion,fit:kind==='border'?'fill':'contain',className:'ch-art-image'}):kind==='banner'?root.ReserveCourseArt?.scene?.(artCourse,{crop:'wide',place:'customize'}):kind==='icon'?root.ReserveCourseArt?.mini?.(artCourse,{place:'customize'}):kind==='title'?(root.ReserveCourseArt?.title?.(artCourse,{place:'customize'})||'<span class="ch-title-fallback">Course title</span>'):kind==='border'?(id==='all'?root.ReserveCourseArt?.frame?.('home','all'):root.ReserveCourseArt?.frame?.(root.ReserveCourseArt.kind?.(artCourse)||'home',id,artCourse)):'';
   const accept=framing?'image/svg+xml,.svg,image/png,image/jpeg,image/webp,image/avif,image/gif,video/mp4,video/webm,.png,.jpg,.jpeg,.webp,.avif,.gif,.mp4,.webm':kind==='title'?'image/svg+xml,.svg,image/png,image/webp,.png,.webp':'image/svg+xml,.svg';
   return `<div class="ch-art-slot" data-kind="${kind}" data-id="${E(id)}"${framing?` data-ch-frame-target tabindex="0" role="group" aria-label="${E(title)} media for ${E(label)}"`:''}>${value&&frames&&framing?'':`<div class="ch-art-preview" aria-hidden="true">${preview||''}</div>`}<div class="ch-art-caption"><strong>${title}</strong><span title="${E(asset?.name||'Built-in drawing')}">${E(asset?.name||'Built-in drawing')}</span></div><label class="rd-button ch-upload">${asset?'Replace':framing||kind==='title'?'Upload':'Upload SVG'}<input type="file" accept="${accept}" data-rd-field="art-upload" data-kind="${kind}" data-id="${E(id)}" aria-label="Upload ${word} for ${E(label)}" ${c.customizeBusy?'disabled':''}></label>${framing?button('art-clipboard','Paste',`data-id="${E(id)}" data-kind="${kind}" aria-label="Paste ${word}" ${c.customizeBusy?'disabled':''}`):''}${asset?button('art-remove','Use default',`data-id="${E(id)}" data-kind="${kind}" aria-label="Remove custom ${word}" ${c.customizeBusy?'disabled':''}`,'rd-text-button'):''}${['banner','icon','border','title'].includes(kind)?button('art-template','Get template',`data-kind="${kind}"`,'rd-text-button'):''}${paste(kind)}${frames&&framing?root.ReserveFrameEditor.render(value,{id,kind,appearance:{...pref,bannerSize:s.bannerSize,shapes:c.frameShapes?.[id]?.[kind]}}):''}</div>`;
  };
  const kits=()=>group('Kits','',`<div class="cz-row"><label class="rd-field"><span>Kit name</span><input type="text" data-rd-field="kit-name" maxlength="40" value="${E(c.kitName||'')}" ${c.customizeBusy?'disabled':''}></label>${button('kit-save','Save as kit',`data-id="${E(id)}" ${c.customizeBusy?'disabled':''}`)}${c.makeOwn?'':`<label class="rd-button ch-upload">Import<input type="file" accept=".chkit,application/json" data-rd-field="kit-import" ${c.customizeBusy?'disabled':''}></label>`}</div><div class="ch-kit-list">${(c.customKits||[]).map(kit=>`<div class="cz-row"><span>${E(kit.name)}</span>${[['kit-use','Use'],['kit-export','Export'],['kit-remove','Remove']].map(([action,label])=>button(action,label,`data-kit="${E(kit.id)}" data-id="${E(id)}" ${c.customizeBusy?'disabled':''}`,'rd-text-button')).join('')}</div>`).join('')}</div>`);
   const banner=artAsset(pref.bannerArt);
   return `<section class="ch-art-controls cz-art" aria-busy="${!!c.customizeBusy}" aria-labelledby="ch-art-title">${enabled('quick-pack')?root.CanvasHarnessQuickUploadUI?.render(c)||'':''}<div class="ch-art-heading"><h3 id="ch-art-title">${id==='theme'?'Theme artwork':'Course artwork'}</h3><label class="rd-field"><span class="rd-sr-only">Customize course</span><select data-rd-field="customize-course" aria-label="Customize course"><option value="all"${id==='all'?' selected':''}>All courses</option><option value="theme"${id==='theme'?' selected':''}>Theme</option>${c.allCourses.map(x=>`<option value="${E(x.id)}"${id===x.id?' selected':''}>${E(x.name)}</option>`).join('')}</select></label></div><div class="ch-art-slots">${artwork('banner','Banner')}${frames?artwork('card','Card art')+artwork('background','Page background'):''}${artwork('icon','Icon')}${artwork('border','Frame')}${artwork('title','Title')}</div>${banner?.palette?.length?`<div class="cz-accents" role="group" aria-label="Banner colours">${banner.palette.map(colour=>button('accent',`<i aria-hidden="true" style="background:${E(colour)}"></i><span class="rd-sr-only">${E(colour)}</span>`,`data-accent="${E(colour)}" aria-label="${E(colour)} accent" aria-pressed="${s.accent===colour}"`,'rd-swatch ch-accent-choice')).join('')}</div>`:''}<div class="ch-field-grid">${frames&&pref.bannerArt?'':select('bannerFit','Banner fit',[['contain','Show whole banner'],['cover','Fill banner']], 'art-setting',pref.bannerFit||'contain')+select('bannerPosition','Banner position',[['left','Left'],['center','Center'],['right','Right']], 'art-setting',pref.bannerPosition||'right')}${pref.bannerArt?select('titlePlacement','Course title',[['separate','Separate title drawing'],['banner','In banner']], 'art-setting',pref.titlePlacement||'separate'):''}</div><div class="ch-art-status" aria-live="polite">${E(c.customizeBusy?'Working…':(c.customizeStatus||'').slice(0,180))}</div>${button('course-reset',id==='theme'?'Reset theme artwork':'Reset this course’s artwork',`data-id="${E(id)}"`,'rd-text-button')}</section>${root.ReserveCustomKits?kits():''}${unusedArt}`;
  };

   const courses=()=>group('Course list','',
    `<div class="ch-course-settings cz-courses">${c.allCourses.map((x,index)=>`<div class="ch-course-setting"><label title="Show this course"><input type="checkbox" data-rd-field="course-visible" data-id="${x.id}" aria-label="Show ${E(x.name)}" ${visible.has(x.id)?'checked':''}><span class="rd-sr-only">Show course</span></label><input type="color" data-rd-field="course-color" data-id="${x.id}" aria-label="${E(x.name)} color" value="${E(x.color)}"><input type="text" maxlength="100" data-rd-field="course-name" data-id="${x.id}" aria-label="${E(x.name)} display name" value="${E(x.name)}">${button('course-up','↑',`data-id="${x.id}" aria-label="Move ${E(x.name)} earlier" ${index===0?'disabled':''}`)}${button('course-down','↓',`data-id="${x.id}" aria-label="Move ${E(x.name)} later" ${index===c.allCourses.length-1?'disabled':''}`)}</div>`).join('')}</div>`);

  const CZ_WHERE={"page":"<svg class=\"cz-scene\" viewBox=\"0 0 120 70\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M14 30h92v34H14z\" fill=\"var(--rd-surface,#FFFDF6)\" transform=\"translate(0 0)\"/><path d=\"M14 30h92v34H14z\" fill=\"#EBDBBC\" transform=\"translate(1.4 1.6)\"/><path d=\"M14.2 29.6C40 28.8 80 30.2 105.8 29.4C106.6 40 106 52 106.4 64M14 30.2C13.6 42 14.4 52 13.8 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M22 40h40M22 47h28M22 54h34\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M30 22c10-3 20-3 30 0\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>{PONY 54 4 30}</svg>","home":"<svg class=\"cz-scene\" viewBox=\"0 0 120 70\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M4 50C30 46 90 47 116 50v16H4z\" fill=\"#B7CBA5\" transform=\"translate(0 0)\"/><path d=\"M10 46h100v3H10zM10 52h100v3H10z\" fill=\"#D4A27F\" transform=\"translate(0.8 0.8)\"/><path d=\"M12 58v-15.5M28 58v-15.5M44 58v-15.5M60 58v-15.5M76 58v-15.5M92 58v-15.5M108 58v-15.5M9 46.6C32 46 88 47 111 46.4M9 52.6C32 52 88 53 111 52.4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>{PONY 44 22 34}</svg>","off":"<svg class=\"cz-scene\" viewBox=\"0 0 120 70\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M4 50C30 46 90 47 116 50v16H4z\" fill=\"#B7CBA5\" transform=\"translate(0 0)\"/><path d=\"M10 46h100v3H10zM10 52h100v3H10z\" fill=\"#D4A27F\" transform=\"translate(0.8 0.8)\"/><path d=\"M12 58v-15.5M28 58v-15.5M44 58v-15.5M60 58v-15.5M76 58v-15.5M92 58v-15.5M108 58v-15.5M9 46.6C32 46 88 47 111 46.4M9 52.6C32 52 88 53 111 52.4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M48 40h24v18H48z\" fill=\"#E6C478\" transform=\"translate(1 1)\"/><path d=\"M47.8 39.6c8-.3 16-.3 24.4 0 .3 6 .3 12 0 18.4M47.8 39.8v18.2M54 40v18M60 40v18M66 40v18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M82 22l6 0-6 7h6M92 14l4 0-4 5h4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>"},
  CZ_REMIND={"helpful":"<svg class=\"cz-scene\" viewBox=\"0 0 120 70\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M24 18c22-3 52-3 72 0 3 7 3 15 0 22-12 2-26 2-38 1l-12 10 2-10c-9 0-17-.5-24-1.5-3-7-3-14.5 0-21.5z\" fill=\"#F6DE9A\" transform=\"translate(1.2 1.4)\"/><path d=\"M24 18c22-3 52-3 72 0 3 7 3 15 0 22-12 2-26 2-38 1l-12 10 2-10c-9 0-17-.5-24-1.5-3-7-3-14.5 0-21.5z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M60 22v9M60 35.4v.2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>","quiet":"<svg class=\"cz-scene\" viewBox=\"0 0 120 70\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M50 60V12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M51 13h24l-6 8 6 8H51z\" fill=\"#DE9A7C\" transform=\"translate(1.2 1.4)\"/><path d=\"M50.6 12.6h24.6l-6 8.2 6 8.2H50.6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M42 61c6-1.4 11-1.4 16 0\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>","off":"<svg class=\"cz-scene\" viewBox=\"0 0 120 70\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M60 14c9 0 13 7 13 15v10l5 6H42l5-6V29c0-8 4-15 13-15z\" fill=\"#C9D6DF\" transform=\"translate(1.2 1.4)\"/><path d=\"M60 13.6c9.2 0 13.4 7.2 13.4 15.4v10.2l5 6H41.6l5-6V29c0-8.2 4.2-15.4 13.4-15.4zM56 50c1 3 7 3 8 0M40 60L80 10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>"};
  const czDab=c=>"<svg class=\"cz-dab\" viewBox=\"0 0 40 40\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M20 6c8 0 14 5 14 13.6S28 34 20 34 6 28 6 19.6 12 6 20 6z\" fill=\"§\" transform=\"translate(1.6 1.8)\"/><path d=\"M19.6 5.6c8.4-.2 14.6 5.4 14.6 14s-6.4 14.8-14.4 14.6C11.4 34.2 5.6 28 5.8 19.6 6 11.6 12 5.8 21.6 5.8c1.4.1 2.8.3 4 .8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M25.6 24.2l1.8 2.4M28 21.6l1.6 2.2M23.4 26.8l1.4 2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>".replace('§',c);
  const pony=()=>{
   if(!enabled('pony'))return '';const P=root.ReservePets,A=root.ReservePetArt;if(!P||!A)return '';
   const pet=P.clean(c.personal?.pet),lv=P.level(pet.xp);
   const petChoices=(key,title,options,cols)=>choices(key,title,options,{value:pet[key],cols,field:'pet',data:'key'});
   const look=({coat=pet.coat,harness=pet.harness}={})=>{const v=A.COATS[coat]||A.COATS.oat;return `--pet-coat:${v.coat};--pet-shade:${v.shade};--pet-mane:${v.mane};--pet-muzzle:${v.muzzle};--pet-harness:${A.HARNESS[harness]||A.HARNESS.red}`;};
   // Reuse one drawing for the hero and all its coat, tack and size choices.
   const drawing=A.svg({title:pet.name});let ponySvg='';const plain=()=>ponySvg||(ponySvg=drawing.replace(/ role="img" aria-label="[^"]*"/,''));
   const mini=(w,o={})=>`<span class="pet cz-pony" data-pose="stand" data-face="right" data-gear="${o.gear||pet.gear}" style="width:${w}px;height:${Math.round(w*64/72)}px;${look(o)}" aria-hidden="true">${plain()}</span>`;
   const inScene=svg=>svg.replace(/\{PONY (\S+) (\S+) (\S+)\}/g,(m,x,y,w)=>`<g style="${look()}">${plain().replace('<svg ',`<svg x="${x}" y="${y}" width="${w}" height="${Math.round(w*64/72)}" `)}</g>`);
   const need=(kind,key)=>P.unlocked(kind,key,pet.xp)?'':`Level ${P.UNLOCKS[kind][key]}`;
   const SK=root.ReservePonyBrain?.SKILLS||{},study=['quiz','labprep','reading','rubric','feedback'],day=['deadline','planner','focus','wellbeing','reminders','night','inbox'],skill=keys=>keys.filter(key=>SK[key]).map(key=>toggle(key,SK[key].label,'',{checked:pet.skills[key]!==false,field:'pet-skill',data:'key'})).join(''),studySkills=skill(study),daySkills=skill([...day,...Object.keys(SK).filter(key=>![...study,...day].includes(key))]);
   return `<div class="cz-pet-hero"><div class="pet" data-pose="${pet.enabled?'stand':'sleep'}" data-face="right" data-gear="${pet.gear}" style="${look()};--pet-size:112px">${drawing}</div><div><label class="rd-field"><span>Name</span><input type="text" maxlength="24" data-rd-field="pet" data-key="name" value="${E(pet.name)}" aria-label="Pony name"></label><p class="cz-note">Level ${lv} · ${pet.treats} treat${pet.treats===1?'':'s'}${pet.streak>1?` · ${pet.streak} days in a row`:''}</p></div></div>
<div class="cz-toggles">${toggle('enabled','Keep a pony','It keeps you company, tells you what is next, and enjoys a treat when work is done. It never nags.',{checked:pet.enabled,field:'pet',data:'key'})}</div>`
    +group('Where it goes','',petChoices('roam','Where the pony goes',[['page','Anywhere','It walks along the tops of your modules and the bottom of the window.',inScene(CZ_WHERE.page)],['home','Its paddock','It stays in the Paddock module on Home.',inScene(CZ_WHERE.home)],['off','Out of sight','Hidden for now. Treats and level are kept.',CZ_WHERE.off]],3))
    +group('Planning','',`<label class="rd-field"><span>Bedtime</span><input type="time" data-rd-field="setting" data-setting="bedtime" value="${E(s.bedtime||'22:30')}"></label>${toggle('biscuitOffers','Biscuit offers','One timely offer, with less after you skip it.',{checked:s.biscuitOffers!==false})}`)
    +group('Reminders','',petChoices('nudges','Reminders',[['helpful','Speaks up','Once, when something is due within three hours.',CZ_REMIND.helpful],['quiet','A small flag','Carries a flag when something is due soon. Says nothing.',CZ_REMIND.quiet],['off','None','It never mentions deadlines.',CZ_REMIND.off]],3))
    +group('Coat','New coats arrive as it levels up: finish work and focus sessions to get there.',petChoices('coat','Coat',Object.entries(A.COATS).map(([key,v])=>[key,v.label,need('coat',key),mini(44,{coat:key}),!!need('coat',key)]),6))
    +group('Harness','',petChoices('harness','Harness color',Object.entries(A.HARNESS).map(([key,color])=>[key,key[0].toUpperCase()+key.slice(1),need('harness',key),czDab(color),!!need('harness',key)]),6)
      +petChoices('gear','Tack',[['full','Collar and blanket','',mini(56,{gear:'full'})],['collar','Collar only','',mini(56,{gear:'collar'})],['none','Bare','',mini(56,{gear:'none'})]],3))
    +(root.ReserveFeatures?.enabled?.('biscuit-more-rules')===true?group('How much Biscuit knows','',petChoices('knowledge','How much Biscuit knows',[['basic','Basic',''],['more','More',''],['most','Most','']],3)):'')
    +group('Size','',petChoices('size','Size',[['small','Small','',mini(40)],['medium','Medium','',mini(52)],['large','Large','',mini(66)]],3))
    +group('Skills','',`${studySkills?`<h4 class="cz-subhead">For study</h4><div class="cz-toggles cz-checks">${studySkills}</div>`:''}<h4 class="cz-subhead">For the day</h4><div class="cz-toggles cz-checks">${daySkills}</div>`)
    +group('Saved companions','',picker({kinds:['pet'],label:'Saved companions'}))
    +group('Saved routines','',pet.routines.map(r=>`<div class="cz-row"><span>${E(r.name||'Routine')}</span>${button('pet-routine-remove','Remove',`data-id="${E(r.id)}" aria-label="Remove ${E(r.name||'routine')}"`,'rd-text-button')}</div>`).join('')+picker({kinds:['preset'],presetKinds:['routines'],label:'Saved routine packs'}));
  };

   // File import belongs on More. An unfinished preview or error follows the student
   // between tabs until it is applied or dismissed.
   const files=add=>root.ReserveMakeYourOwn?.render(c.makeOwn,s,{add,list:false})||'';
   const body=on('look')?`<div class="cz-pane" data-pane="look">${files(false)}${look()}</div>`
    :on('layout')?`<div class="cz-pane" data-pane="layout">${files(false)}${layout()}</div>`
    :on('courses')?`<div class="cz-pane" data-pane="courses">${files(false)}${courses()}${enabled('course-art')?bannerGroup()+courseCardGroup()+art():''}</div>`
    :on('pet')?`<div class="cz-pane" data-pane="pet">${files(false)}${pony()}</div>`
    :`<div class="cz-pane" data-pane="settings">${files(true)}${group('Start over','',`<div class="cz-row">${button('layout-reset','Reset layout','','rd-text-button')}${button('reset-appearance','Reset appearance','','rd-text-button')}</div>`)}</div>`;
   return shell(`<section class="rd-customize ch-customize cz" aria-label="Customize workspace"><div class="rd-section-heading"><div><span class="ch-eyebrow">Your workspace</span><h2 id="rd-appearance-title">Make it yours</h2></div>${button('settings-close','Done','aria-label="Close customization" title="Close · Esc"')}</div>
<div class="cz-tabs" role="tablist" aria-label="Settings">${allowedTabs.map(([key,name])=>button('customize-tab',name,`role="tab" data-value="${key}" aria-selected="${tab===key}"`,'cz-tab')).join('')}</div>
 ${body}</section>`);
 }
 function retainClosedContent(create,options){
  const {container}=options,reduce=root.matchMedia?.('(prefers-reduced-motion: reduce)');
  let open=false,closing=false,dead=false,timer=null,watched=null,started=0,delay=0;
  const panel=()=>container.querySelector('.rd-appearance');
  const now=()=>root.performance?.now?.()??Date.now();
  function cancel(){
   if(timer!==null){root.clearTimeout(timer);timer=null;}
   watched?.removeEventListener('transitionend',ended);watched?.removeEventListener('transitioncancel',interrupted);watched=null;
  }
  function clearContent(){
   cancel();closing=false;
   panel()?.querySelector('.t-acc-panel-inner')?.replaceChildren();
  }

  function transitionTime(node){
   if(reduce?.matches||container.dataset.featureMotion==='off'||container.dataset.motionStyle==='off'||container.dataset.input==='keyboard')return 0;
   const style=root.getComputedStyle?.(node);
   if(!style||style.transitionProperty==='none')return 0;
   const times=value=>String(value||'0s').split(',').map(v=>{const n=parseFloat(v)||0;return v.trim().endsWith('ms')?n:n*1000;});
   const durations=times(style.transitionDuration),delays=times(style.transitionDelay),properties=String(style.transitionProperty||'all').split(',');
   return Math.max(0,...properties.map((property,i)=>property.trim()==='none'?0:durations[i%durations.length]+delays[i%delays.length]));
  }
  function ended(event){if(event.target===watched&&now()-started>=delay)clearContent();}
  function interrupted(event){if(event.target===watched&&transitionTime(watched)===0)clearContent();}
  function reduced(event){if(event.matches&&closing)clearContent();}
  const controller=create({...options,onOpen(){
   cancel();closing=false;panel()?.querySelector('.t-acc-panel-inner')?.removeAttribute('data-rd-key');options.onOpen?.();
  },onChange(value){
   open=value;
   const inner=panel()?.querySelector('.t-acc-panel-inner');
   if(open){cancel();closing=false;inner?.removeAttribute('data-rd-key');}
   else{closing=true;inner?.setAttribute('data-rd-key','customize-content');}
   try{options.onChange?.(value);}finally{sync();}
  }});
  if(!controller)return null;
  const syncDock=controller.sync.bind(controller),destroyDock=controller.destroy.bind(controller);
  function sync(){
   if(dead)return;
   const node=panel(),closedShell=node?.dataset.open==='false'&&node.querySelector('.t-acc-panel-inner')?.getAttribute('data-rd-key')==='customize-content';
   syncDock();
   if(open||!closing)return;
   // Only the closed renderer placeholder transfers content ownership here.
   if(!closedShell){cancel();closing=false;node?.querySelector('.t-acc-panel-inner')?.removeAttribute('data-rd-key');return;}
   const duration=transitionTime(node);
   if(!duration){clearContent();return;}
   if(timer!==null)return;
   watched=node;started=now();delay=duration;
   node.addEventListener('transitionend',ended);node.addEventListener('transitioncancel',interrupted);
   timer=root.setTimeout(()=>{if(!dead&&!open&&closing)clearContent();},duration);
  }
  reduce?.addEventListener?.('change',reduced);
  controller.sync=sync;
  controller.destroy=()=>{
   if(dead)return;
   const retained=panel()?.querySelector('.t-acc-panel-inner')?.getAttribute('data-rd-key')==='customize-content';
   dead=true;cancel();reduce?.removeEventListener?.('change',reduced);destroyDock();if(retained)clearContent();
  };
  return controller;
 }
 // The existing editor stays connected; this controls its dock, never the page's interactivity.
 function createDock(options){
  if(!enabled('customization'))return null;
  return root.ReserveSettingsDock?.createDock(options)||retainClosedContent(createAppearanceDock,options);
 }
 function createAppearanceDock({container,onOpen=()=>{},onChange=()=>{}}){
  if(!enabled('customization'))return null;
  let open=false,trigger=null,dead=false;
  const panel=()=>container.querySelector('.rd-appearance');
  const toolbarTrigger=()=>container.querySelector('.rd-toolbar [data-rd-action="settings"]');
  function sync(){
   const node=panel();
   container.dataset.settings=open?'open':'closed';
   container.getRootNode?.()?.host?.toggleAttribute?.('data-reserve-settings',open);
   toolbarTrigger()?.setAttribute('aria-expanded',String(open));
   if(!node)return;
   node.dataset.open=String(open);node.inert=!open;
   if(open)node.removeAttribute('aria-hidden');else node.setAttribute('aria-hidden','true');
   const content=node.querySelector('.t-acc-panel');
   if(content){content.inert=!open;if(open)content.removeAttribute('aria-hidden');else content.setAttribute('aria-hidden','true');}
  }
  function show(source){
   if(dead)return;
   const candidate=source||container.querySelector(':focus');
   if(!open||candidate&&!panel()?.contains(candidate))trigger=candidate;
   if(!open){onOpen();open=true;onChange(true);}
   sync();panel()?.querySelector('[data-rd-action="settings-close"]')?.focus({preventScroll:true});
  }
  function close({restoreFocus=true}={}){
   if(dead||!open)return;
   open=false;onChange(false);sync();
   if(restoreFocus){
    // Openers inside a closed phone drawer or Tools are no longer focus targets.
    const visible=trigger?.checkVisibility?.({visibilityProperty:true})??(trigger?root.getComputedStyle?.(trigger)?.visibility!=='hidden':false);
    const usable=trigger?.isConnected&&trigger.getClientRects?.().length&&visible&&!trigger.closest?.('[inert],.rd-utility-dialog');
    (usable?trigger:toolbarTrigger())?.focus({preventScroll:true});
   }
  }
  return {open:show,close,sync,toggle(source){if(open)close();else show(source);},
   handleKeydown(event){if(!open||event.defaultPrevented||event.key!=='Escape')return false;event.preventDefault();close();return true;},
   destroy(){if(dead)return;open=false;sync();dead=true;trigger=null;}
  };
 }
  const api={render,createDock,tabs,tabFor,retainClosedContent};root.ReserveCustomizeUI=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
