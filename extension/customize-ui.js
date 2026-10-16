/* Canvas Harness: the "Make it yours" panel. Five tabs; every choice is a picture with a name and one line saying
   what it does; switches for what shows. Changes apply at once and save on this device. Original creator: Flzsh. */
(function(root){
 'use strict';
 const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const TABS=[['layout','Layout'],['look','Look'],['art','Artwork'],['courses','Courses'],['pet','Pony']];
 // Little diagrams of the page: R a filled block, O an outlined block, L a line of text.
 const svg=inner=>`<svg viewBox="0 0 72 48" width="72" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
 const R=(x,y,w,h,cls='a')=>`<rect class="cz-${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5"/>`;
 const L=(x,y,w)=>`<path d="M${x} ${y}h${w}"/>`;
 const ART={
  sidebar:svg(R(3,4,15,40,'fill')+R(22,4,47,40)),
  topbar:svg(R(3,4,66,9,'fill')+R(3,17,66,27)),
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
 };
 function render(c){
  const s={...root.ReserveCustomization.defaults,theme:'system',accent:'clay',font:'system',textSize:'standard',motion:'gentle',livingArt:'on',readingFont:'book',greeting:'on',...c.s},id=c.customizeCourseId||'all',course=c.allCourses.find(x=>x.id===id),pref=id==='all'?(s.overviewArt||{}):(s.coursePrefs?.[id]||{});
  const label=course?.name||'All courses',visible=new Set(c.courses.map(x=>x.id));
  // With no tab named (a caller that only wants the markup) every section is drawn.
  const tab=TABS.some(([key])=>key===c.customizeTab)?c.customizeTab:'all',on=key=>tab==='all'||tab===key;
  const button=(action,label,extra='',cls='rd-button')=>`<button type="button" class="${cls}" data-rd-action="${action}" ${extra}>${label}</button>`;
  const select=(key,label,options,field='setting',value=s[key])=>`<label class="rd-field"><span>${E(label)}</span><select data-rd-field="${field}" data-setting="${key}" data-id="${E(id)}" aria-label="${E(label)}">${options.map(([v,l])=>`<option value="${v}"${v===value?' selected':''}>${E(l)}</option>`).join('')}</select></label>`;
  // A set of picture choices: [value, name, one line, drawing]
  const choices=(key,title,options,{value=s[key],cols=3,field='setting',data='setting'}={})=>`<div class="cz-choices" role="radiogroup" aria-label="${E(title)}" style="--cz-cols:${cols}">${options.map(([v,name,hint,art,locked])=>`<label class="cz-choice"${locked?' data-locked="true"':''}><input type="radio" name="cz-${key}" data-rd-field="${field}" data-${data}="${key}" value="${E(v)}" ${v===value?'checked':''} ${locked?'disabled':''}><span class="cz-choice-art">${art||''}</span><strong>${E(name)}</strong>${hint?`<small>${E(hint)}</small>`:''}</label>`).join('')}</div>`;
  const toggle=(key,name,hint,{checked=s[key]!==false,field='setting',data='setting'}={})=>`<label class="cz-toggle"><span><strong>${E(name)}</strong><small>${E(hint)}</small></span><input type="checkbox" role="switch" data-rd-field="${field}" data-${data}="${key}" ${checked?'checked':''}><i aria-hidden="true"></i></label>`;
  const group=(title,hint,body)=>`<section class="cz-group"><h3>${E(title)}</h3>${hint?`<p class="cz-hint">${hint}</p>`:''}${body}</section>`;
  const currentIds=new Set(c.allCourses.map(x=>x.id));
  const unused=Object.entries(s.coursePrefs||{}).filter(([id,pref])=>!currentIds.has(id)&&root.ReserveCustomization.artKeys.some(key=>pref[key]));
  const unusedArt=unused.length?`<details class="ch-details" data-rd-section="unused-art"><summary>Artwork from other courses (${unused.length})</summary><p class="ch-hint">These courses are not in the current list. Remove individual uploads to free artwork space; names, colors, notes and bookmarks stay saved.</p><div class="ch-unused-art">${unused.map(([id,pref])=>`<div><strong>${E(pref.name||'Course '+id)}</strong>${root.ReserveCustomization.artKeys.filter(key=>pref[key]).map(key=>`<div><span>${E(pref[key].name)}</span>${button('art-remove','Remove '+key.replace('Art',''),`data-id="${E(id)}" data-kind="${key.replace('Art','')}"`,'rd-text-button')}</div>`).join('')}</div>`).join('')}</div></details>`:'';
  const artCourse={id:id==='all'?'folio-home':id,name:label,originalName:course?.originalName,shortName:course?.shortName,artPrefs:pref,artMotion:s.livingArt!=='off'&&s.motion==='gentle'};
  const paste=kind=>`<details class="ch-paste" data-rd-section="paste-${E(id)}-${kind}"><summary>Paste SVG</summary><label><span class="rd-sr-only">${kind==='border'?'frame':kind} SVG source</span><textarea data-rd-field="art-source" data-id="${E(id)}-${kind}" data-course="${E(id)}" data-kind="${kind}" maxlength="262144" spellcheck="false" aria-label="${kind==='border'?'frame':kind} SVG source" placeholder="<svg …>…</svg>">${E(c.customizeDrafts?.[id+':'+kind]||'')}</textarea></label>${button('art-paste','Apply SVG',`data-id="${E(id)}" data-kind="${kind}" ${c.customizeBusy?'disabled':''}`)}</details>`;
  const artwork=(kind,title)=>{const key=kind+'Art',asset=pref[key],preview=asset&&root.ReserveCustomArt?root.ReserveCustomArt.render(asset,{kind,motion:artCourse.artMotion,fit:kind==='border'?'fill':'contain',className:'ch-art-image'}):kind==='banner'?root.ReserveCourseArt?.scene?.(artCourse,{crop:'wide',place:'customize'}):kind==='icon'?root.ReserveCourseArt?.mini?.(artCourse,{place:'customize'}):kind==='title'?(root.ReserveCourseArt?.title?.(artCourse,{place:'customize'})||'<span class="ch-title-fallback">Course title</span>'):(id==='all'?root.ReserveCourseArt?.frame?.('home','all'):root.ReserveCourseArt?.frame?.(root.ReserveCourseArt.kind?.(artCourse)||'home',id,artCourse));const word=kind==='border'?'frame':kind;return `<div class="ch-art-slot" data-kind="${kind}"><div class="ch-art-preview" aria-hidden="true">${preview||''}</div><div class="ch-art-caption"><strong>${title}</strong><span title="${E(asset?.name||'Built-in drawing')}">${E(asset?.name||'Built-in drawing')}</span></div><label class="rd-button ch-upload">${asset?'Replace':'Upload SVG'}<input type="file" accept="image/svg+xml,.svg" data-rd-field="art-upload" data-kind="${kind}" data-id="${E(id)}" aria-label="Upload ${word} for ${E(label)}" ${c.customizeBusy?'disabled':''}></label>${asset?button('art-remove','Use default',`data-id="${E(id)}" data-kind="${kind}" aria-label="Remove custom ${word}"`,'rd-text-button'):''}${button('art-template','Get template',`data-kind="${kind}"`,'rd-text-button')}${paste(kind)}</div>`;};
  const swatch=(bg,line,ink)=>`<svg viewBox="0 0 72 48" width="72" height="48" aria-hidden="true"><rect x="3" y="4" width="66" height="40" rx="5" fill="${bg}" stroke="${line}" stroke-width="1.5"/><path d="M10 14h30M10 22h44M10 30h36" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  const letters=family=>`<span class="cz-letters" style="font-family:${family}">Aa</span>`;
  const accentButtons=[['clay','Clay','#A9522F'],['forest','Forest','#367964'],['indigo','Iris','#5f5ccc'],['rose','Rose','#9e4c6c'],['ocean','Ocean','#2f7185'],['amber','Amber','#956821']].map(([key,name,color])=>button('accent',`<i aria-hidden="true" style="background:${color}"></i><span>${name}</span>`,`data-accent="${key}" aria-label="${name} accent" title="${name} accent" aria-pressed="${s.accent===key}"`,'rd-swatch ch-accent-choice')).join('');
  const frames=(root.ReserveWidgets?.FRAMES||[]).map(([value,name,hint])=>button('board-frame',`<i data-frame="${value}"></i>${E(name)}`,`role="radio" data-value="${value}" aria-checked="${(s.panelFrame||'pen')===value}" title="${E(hint)}"`,'rd-frame-choice')).join('');

  const layout=()=>group('Start from a layout','Three ready-made pages. Pick one, then change anything below. Modules you added stay.',
    `<div class="cz-presets" role="group" aria-label="Layout presets">${[['studio','Studio','Course news, then your work, then the assignment.'],['study','Study','Your work first; course news last.'],['focus','Focus','Just the work and the assignment, courses along the top.']].map(([key,title,hint])=>button('layout-preset',`<span class="cz-choice-art">${ART[key]}</span><strong>${title}</strong><small>${hint}</small>`,`data-value="${key}"`,'ch-preset cz-preset')).join('')}</div>`)
   +group('Modules on Home','Add a timer, today’s list, a clock, notes or your pony beside the three panels, and switch any of them off.',
    `<div class="cz-row">${button('board-edit','Edit Home…','data-from="settings"','rd-button rd-button-primary')}<span class="cz-note">To move a module, hold its heading until the circle closes, then drag.</span></div>`)
   +group('Canvas’s menu bar','The column of Canvas links (Account, Courses, Calendar, Inbox…) on every Canvas page. It changes at once; the toolbar popup has the same choice.',choices('canvasNav','Canvas menu bar',[['drawn','From the left edge','Hidden until you point at the edge; moves the page aside.',ART.navEdge],['shown','Full height','Always there, down the left side.',ART.navColumn],['top','Across the top','In the toolbar’s free space, or a strip.',ART.navTop],['original','Canvas’s own','Canvas’s dark bar, as Canvas draws it.',ART.navOriginal]],{value:c.canvasNav||'drawn',cols:2,field:'canvas-nav'}))
   +group('Where your courses are','',choices('courseNavigation','Course navigation',[['sidebar','Down the side','A list that stays beside the page.',ART.sidebar],['topbar','Across the top','A strip of cards; more room for the page.',ART.topbar]],{cols:2}))
   +group('Order of the three panels','',choices('deskOrder','Panel order',[['context-first','Course first','Course news, work, details.',ART['context-first']],['work-first','Work first','Work, details, course news.',ART['work-first']],['stacked','One column','Everything in one stack.',ART.stacked]]))
   +group('Banner','The drawing across the top of each course.',choices('bannerSize','Banner size',[['compact','Small','',ART.compact],['standard','Medium','',ART.standard],['large','Tall','',ART.large]]))
   +group('Spacing','',choices('density','Spacing',[['comfortable','Roomy','More air between rows.',ART.comfortable],['compact','Compact','More rows on the screen.',ART.dense]],{cols:2}))
   +group('What shows','',`<div class="cz-toggles">${toggle('showCourseStrip','Course list','The courses beside or above the page.')}${toggle('showCourseIcons','Course drawings','The small drawing on each course.')}${toggle('showDeadlinePreview','Next deadlines on courses','What is due next, under each course name.')}${toggle('showBookmarks','Bookmarks shelf','The row of bookmarks under the heading.')}${toggle('showCourseInformation','Course information','Announcements, messages and the teacher’s page.')}${toggle('showRecentGrades','Recent scored work','Shown only while Show grades is on.')}${toggle('greeting','Greeting','“Good morning” on All courses, instead of a plain title.',{checked:s.greeting!=='off'}).replace('data-setting="greeting"','data-setting="greeting" data-onoff="true"')}${toggle('quickOpen','Open at once','Shows your saved workspace straight away, then checks your Canvas sign-in. Leave this off on a shared computer.',{checked:s.quickOpen==='on'}).replace('data-setting="quickOpen"','data-setting="quickOpen" data-onoff="true"')}</div>${button('layout-reset','Reset layout choices','','rd-text-button')}`);

  const night=Math.max(0,Math.min(100,Math.round(Number(s.nightArt)||0)));
  const look=()=>group('Light or dark','Dark is only ever on when you choose it here.',choices('theme','Theme',[['light','Light','Ivory paper, as always.',swatch('#FAF9F5','#E8E6DC','#3D3D3A')],['dark','Dark','A dark page for the evening.',swatch('#1F1E1D','#30302E','#E8E6DC')]],{value:s.theme==='dark'?'dark':'light',cols:2}))
   +(s.theme==='dark'?group('Artwork at night','How the drawings look on the dark page: chalk on the board at one end, the paper kept and dimmed at the other.',`<label class="cz-night"><span>Chalk</span><input type="range" min="0" max="100" step="5" data-rd-field="setting" data-setting="nightArt" value="${night}" aria-label="Artwork at night: chalk at 0, paper at 100" aria-valuetext="${night<50?'Chalk':'Paper'}, ${night}%"><span>Paper</span><output>${night}%</output></label>`):'')
   +group('Accent color','Buttons, links and highlights. Course drawings keep their own colors.',`<div class="ch-accent-actions cz-accents" role="group" aria-label="Accent color">${accentButtons}</div>`)
   +group('Page color','A very light tint behind everything. Accent is for buttons; this is for the mood of the page.',choices('pageTint','Page color',[['paper','Paper','',swatch('#FAF9F5','#E8E6DC','#8A8880')],['accent','Match accent','',swatch('color-mix(in srgb,var(--rd-accent) 9%,#FDFDFC)','color-mix(in srgb,var(--rd-accent) 30%,#E7E7E4)','var(--rd-accent)')],['sky','Sky','',swatch('#F2F7FC','#D3E2F0','#3F8FCC')],['sage','Sage','',swatch('#F3F8F2','#D6E5D3','#5E8F5A')],['lilac','Lilac','',swatch('#F7F4FC','#E0D8F0','#8B6FC9')],['blush','Blush','',swatch('#FCF4F6','#F0D6DD','#D0607F')],['sand','Sand','',swatch('#FBF7EF','#EADFC8','#B98A3E')],['snow','Snow','',swatch('#FCFCFD','#E4E6EA','#8A8F98')]],{cols:4}))
   +group('Page','',choices('surfaceStyle','Page style',[['paper','Warm paper','Ivory, soft lines.',swatch('#FAF9F5','#E8E6DC','#5E5D59')],['clean','Clean','Cool white, grey lines.',swatch('#F8FAFC','#D8DEE6','#566070')],['contrast','High contrast','Darker text and lines.',swatch('#FFFFFF','#555555','#111111')]]))
   +group('Outline round modules','How each module on Home is framed.',`<div class="cz-frames" role="radiogroup" aria-label="Module outline">${frames}</div>`)
   +group('Course cards','',choices('courseCardStyle','Course frames',[['sketch','Hand-drawn','Each course in its own drawn frame.',ART.sketch],['rounded','Rounded','A soft plain card.',ART.rounded],['minimal','Minimal','Just the name, with a line when chosen.',ART.minimal]]))
   +group('Type','',choices('font','Interface type',[['system','Modern','',letters('"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif')],['humanist','Humanist','',letters('Calibri,Candara,"Segoe UI",sans-serif')],['serif','Bookish','',letters('Literata,Georgia,serif')]])
     +`<div class="cz-pair">${choices('textSize','Text size',[['standard','Standard size','',`<span class="cz-letters cz-small">Aa</span>`],['large','Larger','',`<span class="cz-letters">Aa</span>`]],{cols:2})}${choices('readingFont','Reading text',[['book','Book serif','For teachers’ text.',letters('Literata,Georgia,serif')],['interface','Same as above','',letters('inherit')]],{cols:2})}</div>`)
   +group('Motion','',choices('motion','Motion',[['gentle','Gentle','Things glide and settle.',ART.gentle],['still','Fades only','No sliding, only fades.',ART.still],['off','Off','Nothing moves.',ART.off]])
     +`<div class="cz-toggles">${toggle('livingArt','Living drawings',s.motion!=='gentle'?'They move only with Gentle motion.':'Course drawings keep moving gently once drawn.',{checked:s.livingArt!=='off'}).replace('data-setting="livingArt"','data-setting="livingArt" data-onoff="true"')}</div>`);

  const art=()=>`<section class="ch-art-controls cz-art" aria-labelledby="ch-art-title">${root.CanvasHarnessQuickUploadUI?.render(c)||''}<div class="ch-art-heading"><h3 id="ch-art-title">Course artwork</h3><label class="rd-field"><span class="rd-sr-only">Customize course</span><select data-rd-field="customize-course" aria-label="Customize course"><option value="all"${id==='all'?' selected':''}>All courses</option>${c.allCourses.map(x=>`<option value="${E(x.id)}"${id===x.id?' selected':''}>${E(x.name)}</option>`).join('')}</select></label></div><p class="ch-hint">Give each course its own drawing. Self-contained SVGs can animate; your device’s reduced-motion setting is respected.</p><div class="ch-art-slots">${artwork('banner','Banner')}${artwork('icon','Icon')}${artwork('border','Frame')}${artwork('title','Title')}</div><div class="ch-field-grid">${select('bannerFit','Banner fit',[['contain','Show whole drawing'],['cover','Fill banner']], 'art-setting',pref.bannerFit||'contain')}${select('bannerPosition','Banner position',[['left','Left'],['center','Center'],['right','Right']], 'art-setting',pref.bannerPosition||'right')}${pref.bannerArt?select('titlePlacement','Course title',[['separate','Separate title drawing'],['banner','Already drawn in banner']], 'art-setting',pref.titlePlacement||'separate'):''}</div><p class="ch-hint">Up to 256 KiB per SVG · 2 MiB of artwork total. No scripts, embedded pages, or external resources.</p><div class="ch-art-status" aria-live="polite">${E(c.customizeStatus||'')}</div>${button('course-reset','Reset this course’s artwork',`data-id="${E(id)}"`,'rd-text-button')}</section>${unusedArt}`;

  const courses=()=>group('Course names, colors & visibility','Rename, recolor, reorder or hide a course. Canvas itself is not changed. You can also drag a course in the list on the page.',
    `<div class="ch-course-settings cz-courses">${c.allCourses.map((x,index)=>`<div class="ch-course-setting"><label title="Show this course"><input type="checkbox" data-rd-field="course-visible" data-id="${x.id}" aria-label="Show ${E(x.name)}" ${visible.has(x.id)?'checked':''}><span class="rd-sr-only">Show course</span></label><input type="color" data-rd-field="course-color" data-id="${x.id}" aria-label="${E(x.name)} color" value="${E(x.color)}"><input type="text" maxlength="100" data-rd-field="course-name" data-id="${x.id}" aria-label="${E(x.name)} display name" value="${E(x.name)}">${button('course-up','↑',`data-id="${x.id}" aria-label="Move ${E(x.name)} earlier" ${index===0?'disabled':''}`)}${button('course-down','↓',`data-id="${x.id}" aria-label="Move ${E(x.name)} later" ${index===c.allCourses.length-1?'disabled':''}`)}</div>`).join('')}</div>`);

  const pony=()=>{
   const P=root.ReservePets,A=root.ReservePetArt;if(!P||!A)return '';
   const pet=P.clean(c.personal?.pet),lv=P.level(pet.xp),coat=A.COATS[pet.coat],style=`--pet-coat:${coat.coat};--pet-shade:${coat.shade};--pet-mane:${coat.mane};--pet-muzzle:${coat.muzzle};--pet-harness:${A.HARNESS[pet.harness]};--pet-size:112px`;
   const petChoices=(key,title,options,cols)=>choices(key,title,options,{value:pet[key],cols,field:'pet',data:'key'});
   const dot=(a,b)=>`<span class="cz-dot" style="background:${a}"><i style="background:${b||a}"></i></span>`;
   const need=(kind,key)=>P.unlocked(kind,key,pet.xp)?'':`Level ${P.UNLOCKS[kind][key]}`;
   return `<div class="cz-pet-hero"><div class="pet" data-pose="${pet.enabled?'stand':'sleep'}" data-face="right" data-gear="${pet.gear}" style="${style}">${A.svg({title:pet.name})}</div><div><label class="rd-field"><span>Name</span><input type="text" maxlength="24" data-rd-field="pet" data-key="name" value="${E(pet.name)}" aria-label="Pony name"></label><p class="cz-note">Level ${lv} · ${pet.treats} treat${pet.treats===1?'':'s'}${pet.streak>1?` · ${pet.streak} days in a row`:''}</p></div></div>
<div class="cz-toggles">${toggle('enabled','Keep a pony','It keeps you company, tells you what is next, and enjoys a treat when work is done. It never nags.',{checked:pet.enabled,field:'pet',data:'key'})}</div>`
    +group('Where it goes','',petChoices('roam','Where the pony goes',[['page','Anywhere','It walks along the tops of your modules and the bottom of the window.'],['home','Its paddock','It stays in the Paddock module on Home.'],['off','Out of sight','Hidden for now. Treats and level are kept.']],3))
    +group('Reminders','',petChoices('nudges','Reminders',[['helpful','Speaks up','Once, when something is due within three hours.'],['quiet','A small flag','Carries a flag when something is due soon. Says nothing.'],['off','None','It never mentions deadlines.']],3))
    +group('Coat',`New coats arrive as it levels up: finish work and focus sessions to get there.`,petChoices('coat','Coat',Object.entries(A.COATS).map(([key,v])=>[key,v.label,need('coat',key),dot(v.coat,v.mane),!!need('coat',key)]),3))
    +group('Harness','',petChoices('harness','Harness color',Object.entries(A.HARNESS).map(([key,color])=>[key,key[0].toUpperCase()+key.slice(1),need('harness',key),dot(color),!!need('harness',key)]),3)
      +petChoices('gear','Tack',[['full','Collar and blanket',''],['collar','Collar only',''],['none','Bare','']],3))
    +group('Size','',petChoices('size','Size',[['small','Small',''],['medium','Medium',''],['large','Large','']],3));
  };

  const shell=inner=>`<div class="rd-appearance t-acc ch-settings-dock" data-open="${!!c.customizeOpen}" role="complementary" aria-labelledby="rd-appearance-title" ${c.customizeOpen?'':'inert aria-hidden="true"'}><div class="t-acc-panel" id="rd-appearance-panel" ${c.customizeOpen?'':'inert aria-hidden="true"'}><div class="t-acc-panel-inner">${inner}</div></div></div>`;
  const body=`${on('layout')?`<div class="cz-pane" data-pane="layout">${layout()}</div>`:''}${on('look')?`<div class="cz-pane" data-pane="look">${look()}</div>`:''}${on('art')?`<div class="cz-pane" data-pane="art">${art()}</div>`:''}${on('courses')?`<div class="cz-pane" data-pane="courses">${courses()}</div>`:''}${on('pet')?`<div class="cz-pane" data-pane="pet">${pony()}</div>`:''}`;
  if(!c.customizeOpen&&c.customizeTab)return shell('<h2 id="rd-appearance-title" class="rd-sr-only">Make it yours</h2>');
  return shell(`<section class="rd-customize ch-customize cz" aria-label="Customize workspace"><div class="rd-section-heading"><div><span class="ch-eyebrow">Your workspace</span><h2 id="rd-appearance-title">Make it yours</h2><p>Changes show at once and save on this device.</p></div>${button('settings-close','Done','aria-label="Close customization" title="Close · Esc"')}</div>
<div class="cz-tabs" role="tablist" aria-label="Settings">${TABS.map(([key,name])=>button('customize-tab',name,`role="tab" data-value="${key}" aria-selected="${tab===key}"`,'cz-tab')).join('')}</div>
${body}<div class="ch-custom-footer"><span>Everything here stays on this device.</span>${button('advanced-settings','All settings & backups','','rd-text-button')}</div></section>`);
 }
 // The existing editor stays connected; this controls its dock, never the page's interactivity.
 function createDock({container,onOpen=()=>{},onChange=()=>{}}){
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
 const api={render,createDock};root.ReserveCustomizeUI=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
