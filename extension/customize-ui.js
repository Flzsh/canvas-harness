/* Canvas Harness: the "Make it yours" panel (adapted from the public Canvas Harness). Five tabs, one place for each thing: Look, Home, Courses (list, banner, card style and
   artwork), Companion, More (features, preferences, backups, files). Every choice is a picture and a name; changes apply at once and save on this device.
   Original creator: Flzsh. */
(function(root){
 'use strict';
 const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const enabled=id=>!globalThis.ReserveFeatures||globalThis.ReserveFeatures.enabled(id);
 const tabs=()=>enabled('customization')?TABS.filter(([key])=>key!=='pet'||enabled('pony')):[['features','Features'],['settings','Settings']];
 // Older names still open the tab that now holds them: the all-in-one view, Artwork and Features.
 const ALIASES={all:'look',art:'courses',features:'settings'};
 // The tab holding a saved setting, for search and Biscuit ("open spacing" lands on Home).
 const SETTING_TABS={layout:['courseNavigation','dockSize','deskOrder','density','showCourseStrip','showCourseIcons','showDeadlinePreview','showBookmarks','showCourseInformation','showRecentGrades','greeting','quickOpen','canvasNav'],courses:['bannerSize','courseCardStyle'],pet:['bedtime','biscuitOffers'],settings:['timeZone']};
 const tabFor=key=>Object.keys(SETTING_TABS).find(tab=>SETTING_TABS[tab].includes(key))||'look';
 const settingEnabled=key=>{
   const feature={
     sceneTheme:'scene-themes',
     motion:'motion',
     livingArt:'course-art',
     nightArt:'course-art',
     bannerSize:'course-art',
     showCourseIcons:'course-art',
     courseCardStyle:'course-art',
     showCourseInformation:'course-hub',
     showRecentGrades:'grades',
     deskOrder:'arrange',
     courseNavigation:'arrange',
     dockSize:'arrange',
     canvasNav:'canvas-nav'
   }[key];
   return (!feature||enabled(feature))&&(key!=='livingArt'||enabled('motion'));
 };
 const TABS=[['look','Look'],['layout','Home'],['courses','Courses'],['pet','Companion'],['settings','More']];
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
  // Reuse the shared reconciler's owned-subtree marker on the inner shell while
  // closed. The dock releases outgoing content after its existing CSS transition.
  const shell=inner=>`<div class="rd-appearance t-acc ch-settings-dock" data-open="${!!c.customizeOpen}" role="complementary" aria-labelledby="rd-appearance-title" ${c.customizeOpen?'':'inert aria-hidden="true"'}><div class="t-acc-panel" id="rd-appearance-panel" ${c.customizeOpen?'':'inert aria-hidden="true"'}><div class="t-acc-panel-inner"${c.customizeOpen?'':' data-rd-key="features-pane"'}>${inner}</div></div></div>`;
  if(!c.customizeOpen)return shell('');
  const s={
    ...root.ReserveCustomization.defaults,
    theme:'system',
    accent:'clay',
    font:'system',
    textSize:'standard',
    motion:'gentle',
    livingArt:'on',
    readingFont:'book',
    greeting:'on',
    ...c.s,
    ...(!enabled('motion')?{motion:'off',livingArt:'off'}:{})
  };
  // One tab at a time; the panel opens on the tab used last (Look the first time).
  const allowedTabs=tabs(),asked=ALIASES[c.customizeTab]||c.customizeTab||'look',tab=allowedTabs.some(([key])=>key===asked)?asked:allowedTabs[0][0],on=key=>tab===key;
  const button=(action,label,extra='',cls='rd-button')=>`<button type="button" class="${cls}" data-rd-action="${action}" ${extra}>${label}</button>`;
  // A set of picture choices: [value, name, line, drawing, locked]. Choices are a drawing and a name; the line shows only on a locked choice (its level).
  const choices=(key,title,options,{value=s[key],cols=3,field='setting',data='setting',className=''}={})=>
    settingEnabled(key)?`<div class="cz-choices${className?' '+E(className):''}" role="radiogroup" aria-label="${E(title)}" style="--cz-cols:${cols}">${options.map(([v,name,hint,art,locked])=>`<label class="cz-choice"${locked?' data-locked="true"':''}><input type="radio" name="cz-${key}" data-rd-field="${field}" data-${data}="${key}" value="${E(v)}" ${v===value?'checked':''} ${locked?'disabled':''}><span class="cz-choice-art">${art||''}</span><strong>${E(name)}</strong>${hint&&locked?`<small>${E(hint)}</small>`:''}</label>`).join('')}</div>`:'';
  // A switch is its name; `warn` keeps a line that protects the student (shared computers).
  const toggle=(key,name,hint,{checked=s[key]!==false,field='setting',data='setting',warn=false}={})=>
    settingEnabled(key)?`<label class="cz-toggle"><span><strong>${E(name)}</strong>${warn&&hint?`<small>${E(hint)}</small>`:''}</span><input type="checkbox" role="switch" data-rd-field="${field}" data-${data}="${key}" ${checked?'checked':''}><i aria-hidden="true"></i></label>`:'';
 const group=(title,hint,body)=>{
   const feature={'Start from a layout':'arrange','Modules on Home':'planner','Canvas\u2019s menu bar':'canvas-nav','Where your courses are':'arrange','Course size':'arrange','Course dock':'arrange','Order of the three panels':'arrange',Banner:'course-art','Artwork at night':'course-art','Outline round modules':'planner','Course cards':'course-art',Motion:'motion'}[title];
   return feature&&!enabled(feature)?'':`<section class="cz-group" data-art="${E(title)}"><h3>${E(title)}</h3>${body}</section>`;
 };
  const picker=options=>root.ReserveMakeYourOwn?.picker(c.makeOwn,s,{data:{pet:c.personal?.pet},...options})||'';
  const layout=()=>{
   const ART=artDiagrams();ART.dockSize=ART.dock;
   return group('Start from a layout','Three ready-made pages. Pick one, then change anything below. Modules you added stay.',
     `<div class="cz-presets" role="group" aria-label="Layout presets">${[['studio','Studio','Course news, then your work, then the assignment.'],['study','Study','Your work first; course news last.'],['focus','Focus','Just the work and the assignment, courses along the top.']].map(([key,title,hint])=>button('layout-preset',`<span class="cz-choice-art">${ART[key]}</span><strong>${title}</strong>`,`data-value="${key}" aria-pressed="${Object.entries(root.ReserveCustomization.presets?.[key]||{}).every(([k,v])=>JSON.stringify(s[k])===JSON.stringify(v))}"`,'ch-preset cz-preset')).join('')}</div>`)
   +group('Modules on Home','Add a timer, a clock, notes or your companion beside the three panels, and switch any of them off.',
    `<div class="cz-row">${button('board-edit','Edit Home…','data-from="settings"','rd-button rd-button-primary')}</div>`)
   +group('Order of the three panels','',choices('deskOrder','Panel order',[['context-first','Course first','Course news, work, details.',ART['context-first']],['work-first','Work first','Work, details, course news.',ART['work-first']],['stacked','One column','Everything in one stack.',ART.stacked]]))
   +group('Where your courses are','',choices('courseNavigation','Course navigation',[['sidebar','Down the side','A list that stays beside the page.',ART.sidebar],['topbar','Across the top','A strip of cards; more room for the page.',ART.topbar],['dock','Along the bottom','A dock of courses at the bottom of the page.',ART.dock]]))
   // The course dock (3.7): the same controls as its own card (right-click the dock).
   +
   (s.courseNavigation==='dock'?
     group('Course dock','',`<label class="cz-slider"><span>Size</span><input type="range" min="0.7" max="1.5" step="0.05" value="${E(String(Number(s.dockScale)||1))}" data-rd-field="setting" data-setting="dockScale"></label>`+choices('dockShelf','Shelf',[['kraft','Kraft','','<svg viewBox="0 0 64 30" width="64" height="30" aria-hidden="true"><path d="M7 11h50v12H7z" fill="#D4A27F" transform="translate(1 1.2)"/><path d="M6.8 10.6c16.6-.4 33.6-.4 50.4 0 .3 4.2.3 8.4 0 12.6-16.8.4-33.8.4-50.4 0-.3-4.2-.3-8.4 0-12.6z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M14 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M25 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M36 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M47 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>'],['paper','Paper','','<svg viewBox="0 0 64 30" width="64" height="30" aria-hidden="true"><path d="M7 11h50v12H7z" fill="#FFFDF8" transform="translate(1 1.2)"/><path d="M6.8 10.6c16.6-.4 33.6-.4 50.4 0 .3 4.2.3 8.4 0 12.6-16.8.4-33.8.4-50.4 0-.3-4.2-.3-8.4 0-12.6z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M14 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M25 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M36 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M47 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>'],['none','None','','<svg viewBox="0 0 64 30" width="64" height="30" aria-hidden="true"><path d="M6.8 23.2c16.6-.4 33.6-.4 50.4 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M14 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M25 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M36 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M47 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>']])+choices('dockStyle',
    'Look',[['tiles','Icons','','<svg viewBox="0 0 64 30" width="64" height="30" aria-hidden="true"><path d="M8 10h10v10H8z" fill="#C9D6DF" transform="translate(1 1)"/><path d="M8 9.8c3.4-.2 6.8-.2 10 0 .2 3.4.2 6.8 0 10.2-3.4.2-6.8.2-10 0-.2-3.4-.2-6.8 0-10.2z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M22 10h10v10H22z" fill="#C9D6DF" transform="translate(1 1)"/><path d="M22 9.8c3.4-.2 6.8-.2 10 0 .2 3.4.2 6.8 0 10.2-3.4.2-6.8.2-10 0-.2-3.4-.2-6.8 0-10.2z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M36 10h10v10H36z" fill="#C9D6DF" transform="translate(1 1)"/><path d="M36 9.8c3.4-.2 6.8-.2 10 0 .2 3.4.2 6.8 0 10.2-3.4.2-6.8.2-10 0-.2-3.4-.2-6.8 0-10.2z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M50 10h10v10H50z" fill="#C9D6DF" transform="translate(1 1)"/><path d="M50 9.8c3.4-.2 6.8-.2 10 0 .2 3.4.2 6.8 0 10.2-3.4.2-6.8.2-10 0-.2-3.4-.2-6.8 0-10.2z" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>'],['cards','Cards','','<svg viewBox="0 0 64 30" width="64" height="30" aria-hidden="true"><path d="M6 8h15v14H6z" fill="#EBDBBC" transform="translate(1 1)"/><path d="M6 7.8c5-.2 10-.2 15 0 .2 4.8.2 9.6 0 14.4-5 .2-10 .2-15 0-.2-4.8-.2-9.6 0-14.4zM9 12h8M9 16h6" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M24 8h15v14H24z" fill="#EBDBBC" transform="translate(1 1)"/><path d="M24 7.8c5-.2 10-.2 15 0 .2 4.8.2 9.6 0 14.4-5 .2-10 .2-15 0-.2-4.8-.2-9.6 0-14.4zM27 12h8M27 16h6" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M42 8h15v14H42z" fill="#EBDBBC" transform="translate(1 1)"/><path d="M42 7.8c5-.2 10-.2 15 0 .2 4.8.2 9.6 0 14.4-5 .2-10 .2-15 0-.2-4.8-.2-9.6 0-14.4zM45 12h8M45 16h6" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>']],{cols:2})+`<div class="cz-toggles">${
      toggle('dockNamesAlways','Names always','',{checked:s.dockNamesAlways===true})}${toggle('dockCounts','Counts','',{checked:s.dockCounts!==false})}${toggle('dockLively','Lively','',{checked:s.dockLively!==false})}${toggle('dockHide','Hide until near','',{checked:s.dockHide===true})}</div>`):
     '')
   +group('Spacing','',choices('density','Spacing',[['comfortable','Roomy','More air between rows.',ART.comfortable],['compact','Compact','More rows on the screen.',ART.dense]],{cols:2}))
   +group('What shows','',`<div class="cz-toggles">${toggle('showCourseStrip','Course list','The courses beside, above or below the page.')}${toggle('showCourseIcons','Course drawings','The small drawing on each course.')}${toggle('showDeadlinePreview','Next deadlines on courses','What is due next, under each course name.')}${toggle('showBookmarks','Bookmarks shelf','The row of bookmarks under the heading.')}${toggle('showCourseInformation','Course information','Announcements, messages and the teacher’s page.')}${toggle('showRecentGrades','Recent scored work','Shown only while Show grades is on.')}${toggle('greeting','Greeting','“Good morning” on All courses, instead of a plain title.',{checked:s.greeting!=='off'}).replace('data-setting="greeting"','data-setting="greeting" data-onoff="true"')}${toggle('quickOpen','Open at once','Leave this off on a shared computer.',{checked:s.quickOpen==='on',warn:true}).replace('data-setting="quickOpen"','data-setting="quickOpen" data-onoff="true"')}</div>`)
   +
   group(
     'Canvas’s menu bar',
     'The column of Canvas links (Account, Courses, Calendar, Inbox…) on every Canvas page. It changes at once; the toolbar popup has the same choice.',
     choices(
       'canvasNav',
       'Canvas menu bar',
       [['drawn','From the left edge','Hidden until you point at the edge; moves the page aside.',ART.navEdge],['shown','Full height','Always there, down the left side.',ART.navColumn],['top','Across the top','In the toolbar’s free space, or a strip.',ART.navTop],['original','Canvas’s own','Canvas’s dark bar, as Canvas draws it.',ART.navOriginal]],
       {value:c.canvasNav||'drawn',cols:2,field:'canvas-nav'}))
    +group('Saved layouts & plans','',picker({kinds:['preset'],presetKinds:['layout','planner'],label:'Saved layouts and plans'}));
  };
  const bannerGroup=()=>{
    const ART=artDiagrams();
    return group('Banner','The drawing across the top of each course.',choices('bannerSize','Banner size',[['compact','Small','',ART.compact],['standard','Medium','',ART.standard],['large','Tall','',ART.large]]));
  };

  const look=only=>{
   const ART=artDiagrams();
  const swatch=(bg,line,ink)=>`<svg viewBox="0 0 72 48" width="72" height="48" aria-hidden="true"><rect x="3" y="4" width="66" height="40" rx="5" fill="${bg}" stroke="${line}" stroke-width="1.5"/><path d="M10 14h30M10 22h44M10 30h36" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  const letters=family=>`<span class="cz-letters" style="font-family:${family}">Aa</span>`;
  const accentButtons=[['clay','Clay','#A9522F'],['forest','Forest','#367964'],['indigo','Iris','#5f5ccc'],['rose','Rose','#9e4c6c'],['ocean','Ocean','#2f7185'],['amber','Amber','#956821']].map(([key,name,color])=>
    button('accent',`<i aria-hidden="true" style="background:${color}"></i><span>${name}</span>`,`data-accent="${key}" aria-label="${name} accent" title="${name} accent" aria-pressed="${s.accent===key}"`,'rd-swatch ch-accent-choice')).join('');
  const frames=()=>
    (enabled('planner')?root.ReserveWidgets?.FRAMES||[]:[]).map(([value,name,hint])=>
      button('board-frame',`<i data-frame="${value}"></i>${E(name)}`,`role="radio" data-value="${value}" aria-checked="${!(ownTheme?.frames?.panel||sceneActive)||layer.parts?.frames===false||layer.parts?.panel===false?(s.panelFrame||'pen')===value:false}" title="${E(hint)}"`,'rd-frame-choice')).join('');

  const night=Math.max(0,Math.min(100,Math.round(Number(s.nightArt)||0))),
    sceneActive=enabled('scene-themes')&&['starry','sea','stars','blueprint'].includes(s.sceneTheme),
    installedScene=(c.makeOwn?.catalogue||[]).find(row=>
      row.kind==='feature'&&row.sceneTheme!==undefined&&(root.ReservePacks?.isCurrent?root.ReservePacks.isCurrent(row,{settings:s}):row.current));
  const ownTheme=!sceneActive&&s.makeYourOwn?.theme?c.makeOwn?.theme:null,
    ownedPalette=sceneActive||!!s.makeYourOwn?.theme,
    ownerName=s.makeYourOwn?.theme?.name||installedScene?.name||({starry:'Starry Night',sea:'Under the Sea',stars:'Starfield',blueprint:'Blueprint'})[s.sceneTheme]||'The selected theme',
    look=root.ReserveMakeYourOwn?.activeLook?.(c.makeOwn,s)||{},
    layer=look.layer||{};
  const ownedMode=ownTheme&&!ownTheme.colors?.[s.theme==='dark'?'dark':'light']&&!layer.colors?.[s.theme==='dark'?'dark':'light']?(ownTheme.colors?.light?'light':'dark'):s.theme==='dark'?'dark':'light',
    modeArt=(mode,bg,line,ink)=>
      swatch(layer.colors?.[mode]?.bg||ownTheme?.colors?.[mode]?.bg||bg,ownTheme?.colors?.[mode]?.line||line,ownTheme?.colors?.[mode]?.ink||ink);
  const sceneColors=({starry:{bg:'#141b3d',accent:'#f2c94c'},sea:{bg:'#05345e',accent:'#7fe6f2'},stars:{bg:'#04060c',accent:'#a9c2ff'},blueprint:{bg:'#174a88',accent:'#cfe6ff'}})[s.sceneTheme];
  const colorFields=key=>`<div class="cz-pair">${['light','dark'].map(mode=>{
    const p=ownTheme?.colors?.[mode]||sceneColors||{},value=layer.colors?.[mode]?.[key]||p[key]||(key==='accent'?'#a9522f':mode==='dark'?'#1f1e1d':'#faf9f5');
    return `<label class="rd-field"><span>${mode==='light'?'Light':'Dark'}</span><input type="color" data-rd-field="make-color" data-id="${E(look.key)}" data-mode="${mode}" data-color="${key}" value="${E(value)}" aria-label="${mode==='light'?'Light':'Dark'} ${key==='bg'?'page':'accent'} color"${c.makeOwn?.busy?' disabled':''}></label>`;
  }).join('')}</div>`;
  const part=(key,name)=>`<label class="cz-toggle"><span>${E(name)}</span><input type="checkbox" role="switch" data-rd-field="make-part" data-id="${E(look.key)}" data-part="${key}"${layer.parts?.[key]!==false?' checked':''}${c.makeOwn?.busy?' disabled':''}><i aria-hidden="true"></i></label>`;
  const parts=()=>look.key?group('Use from '+ownerName,'',`<div class="cz-toggles">${[['background','Background'],['banner','Banner'],['frames','Frames'],['panel','Module frames'],['card','Course frames'],['title','Title font'],['icons','Icons']].map(([key,label])=>part(key,label)).join('')}</div>${button('make-reset','Reset to how it came',`data-id="${E(look.key)}"`,'rd-text-button')}`):'';
  const themeFrame=kind=>{
    const asset=ownTheme?.assets?.[ownTheme.frames?.[kind]?.asset];
    return asset?.svg&&layer.parts?.frames!==false&&layer.parts?.[kind]!==false?`<span class="cz-choice-art"><img src="data:image/svg+xml;charset=utf-8,${E(encodeURIComponent(asset.still||asset.svg))}" alt="${E(ownerName)} ${kind} frame" width="96" height="64"></span>`:'';
  };
  // No page-relative URLs: a browserless preview keeps the plain illustration.
  const poster=scene=>root.chrome?.runtime?.getURL?`<img class="cz-scene-poster" src="${E(root.chrome.runtime.getURL(`themes/${scene}/poster.jpg`))}" alt="" aria-hidden="true" width="160" height="90" loading="lazy">`:ART.still;
  const sceneChoices=()=>enabled('scene-themes')?group('Scene','',choices('sceneTheme','Scene',[
   ['','None','',swatch('#FAF9F5','#E8E6DC','#3D3D3A')],
   ['starry','Starry Night','',poster('starry')],
   ['sea','Under the Sea','',poster('sea')],
   ['stars','Starfield','',poster('stars')],
   ['blueprint','Blueprint','',poster('blueprint')]
   ],{value:s.makeYourOwn?.theme?'own:'+s.makeYourOwn.theme.id:installedScene?'installed:'+installedScene.id:s.sceneTheme,cols:2,className:'cz-scenes'})+
   picker({kinds:['feature'],scenes:true,label:'Installed scenes',more:false})+
   picker({kinds:['theme'],label:'Installed themes'})+
   (s.makeYourOwn?.theme||sceneActive?button('make-clear','Use default theme','data-id="theme"','rd-text-button'):'')):
   group('Theme','',button('make-clear','Default theme',`data-id="theme" aria-pressed="${!s.makeYourOwn?.theme}"`,'rd-text-button')+picker({kinds:['theme'],label:'Installed themes'}));
    // Course card style lives on the Courses tab, but its frame comes from the theme worked out here.
    if(only==='cards')
      return group(
        'Course cards',
        '',
        themeFrame('card')+choices('courseCardStyle','Course frames',[['sketch','Hand-drawn','',ART.sketch],['rounded','Rounded','',ART.rounded],['minimal','Minimal','',ART.minimal]]));
    return sceneChoices()+
      parts()+
      group(
        'Light or dark',
        'Dark is only ever on when you choose it here.',
        choices(
          'theme',
          'Theme',
          [
            ['light','Light',ownTheme?ownerName+' colors':'Ivory paper, as always.',modeArt('light','#FAF9F5','#E8E6DC','#3D3D3A'),false],
            ['dark','Dark',ownTheme?ownerName+' colors':'A dark page for the evening.',modeArt('dark','#1F1E1D','#30302E','#E8E6DC'),false]
          ],
          {value:ownedMode,cols:2}))
   +(sceneActive?'':(ownedMode==='dark'?group('Artwork at night','How the drawings look on the dark page: chalk on the board at one end, the paper kept and dimmed at the other.',`<label class="cz-night"><span>Chalk</span><input type="range" min="0" max="100" step="5" data-rd-field="setting" data-setting="nightArt" value="${night}" aria-label="Artwork at night: chalk at 0, paper at 100" aria-valuetext="${night<50?'Chalk':'Paper'}, ${night}%"><span>Paper</span><output>${night}%</output></label>`):''))
   +group('Accent color','Buttons, links and highlights. Course drawings keep their own colors.',(ownedPalette?colorFields('accent'):'')+`<div class="ch-accent-actions cz-accents" role="group" aria-label="Accent color">${accentButtons}</div>`)
   +
   group(
     'Page color',
     'A very light tint behind everything. Accent is for buttons; this is for the mood of the page.',
     ownedPalette?
       colorFields('bg'):
       choices(
         'pageTint',
         'Page color',
         [
           ['paper','Paper','',swatch('#FAF9F5','#E8E6DC','#8A8880')],
           ['accent','Match accent','',swatch('color-mix(in srgb,var(--rd-accent) 9%,#FDFDFC)','color-mix(in srgb,var(--rd-accent) 30%,#E7E7E4)','var(--rd-accent)')],
           ['sky','Sky','',swatch('#F2F7FC','#D3E2F0','#3F8FCC')],
           ['sage','Sage','',swatch('#F3F8F2','#D6E5D3','#5E8F5A')],
           ['lilac','Lilac','',swatch('#F7F4FC','#E0D8F0','#8B6FC9')],
           ['blush','Blush','',swatch('#FCF4F6','#F0D6DD','#D0607F')],
           ['sand','Sand','',swatch('#FBF7EF','#EADFC8','#B98A3E')],
           ['snow','Snow','',swatch('#FCFCFD','#E4E6EA','#8A8F98')]
         ],
         {cols:4}))
   +
   (ownedPalette?
     '':
     group('Page','',choices('surfaceStyle','Page style',[['paper','Warm paper','Ivory, soft lines.',swatch('#FAF9F5','#E8E6DC','#5E5D59')],['clean','Clean','Cool white, grey lines.',swatch('#F8FAFC','#D8DEE6','#566070')],['contrast','High contrast','Darker text and lines.',swatch('#FFFFFF','#555555','#111111')]])))
   +group('Outline round modules','How each module on Home is framed.',themeFrame('panel')+`<div class="cz-frames" role="radiogroup" aria-label="Module outline">${frames()}</div>`)
   // Type: three named rows (letters, size, reading text) on one grid, so the choices line up.
   +group('Type','',`<h4 class="cz-subhead">Letters</h4>`+choices('font','Interface type',[['system','Modern','',letters('"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif')],['humanist','Humanist','',letters('Calibri,Candara,"Segoe UI",sans-serif')],['serif','Bookish','',letters('Literata,Georgia,serif')]])
     +`<h4 class="cz-subhead">Size</h4>${choices('textSize','Text size',[['standard','Standard','',`<span class="cz-letters cz-small">Aa</span>`],['large','Larger','',`<span class="cz-letters">Aa</span>`]],{cols:3})}<h4 class="cz-subhead">Reading text</h4>${choices('readingFont','Reading text',[['book','Book serif','For teachers’ text.',letters('Literata,Georgia,serif')],['interface','Same as letters','',letters('inherit')]],{cols:3})}`)
   +group('Motion','',(look.key?`<label class="rd-field"><span>${E(ownerName)} motion</span><select data-rd-field="make-motion" data-id="${E(look.key)}" aria-label="Theme motion">${[['gentle','On'],['off','Off']].map(([key,label])=>`<option value="${key}"${(layer.motion&&layer.motion!=='gentle'?'off':'gentle')===key?' selected':''}>${label}</option>`).join('')}</select></label>`:'')+choices('motion','Motion',[['gentle','Gentle','Things glide and settle.',ART.gentle],['still','Fades only','No sliding, only fades.',ART.still],['off','Off','Nothing moves.',ART.off]])
     +`<div class="cz-toggles">${toggle('livingArt','Living drawings',s.livingArt==='off'?'The course drawings rest once they are drawn.':s.motion!=='gentle'?'They move only with Gentle motion.':'Once drawn, the course drawings keep moving gently.',{checked:s.livingArt!=='off'}).replace('data-setting="livingArt"','data-setting="livingArt" data-onoff="true"')}</div>`)
   +group('Saved looks','',picker({kinds:['preset'],presetKinds:['settings'],label:'Saved looks'}));
  };

  const art=()=>{
   const id=c.customizeCourseId||'all',
     course=c.allCourses.find(x=>x.id===id),
     pref=id==='theme'?(s.themeArt||{}):id==='all'?(s.overviewArt||{}):(s.coursePrefs?.[id]||{}),
     label=id==='theme'?'Theme':course?.name||'All courses';
  const select=(key,label,options,field='setting',value=s[key])=>`<label class="rd-field"><span>${E(label)}</span><select data-rd-field="${field}" data-setting="${key}" data-id="${E(id)}" aria-label="${E(label)}">${options.map(([v,l])=>`<option value="${v}"${v===value?' selected':''}>${E(l)}</option>`).join('')}</select></label>`;
  // A course's drawing: Automatic, then every drawing this build has (course-art.js choices), listed when the pane is drawn.
  const drawings=()=>[['','Automatic'],...root.ReserveCourseArt.choices().map(x=>[x.id,x.name])];
  const F=root.ReserveMediaFrame,frames=!!(F&&root.ReserveFrameEditor),artAsset=value=>F?.asset(value)||value?.asset||value;
  const currentIds=new Set(c.allCourses.map(x=>x.id));
  const unused=Object.entries(s.coursePrefs||{}).filter(([id,pref])=>!currentIds.has(id)&&root.ReserveCustomization.artKeys.some(key=>pref[key]));
  const unusedArt=unused.length?`<details class="ch-details" data-rd-section="unused-art"><summary>Artwork from other courses (${unused.length})</summary><p class="ch-hint">These courses are not in the current list. Remove individual uploads to free artwork space; names, colors, notes and bookmarks stay saved.</p><div class="ch-unused-art">${unused.map(([id,pref])=>`<div><strong>${E(pref.name||'Course '+id)}</strong>${root.ReserveCustomization.artKeys.filter(key=>pref[key]).map(key=>`<div><span>${E(artAsset(pref[key])?.name||'Artwork')}</span>${button('art-remove','Remove '+key.replace('Art',''),`data-id="${E(id)}" data-kind="${key.replace('Art','')}"`,'rd-text-button')}</div>`).join('')}</div>`).join('')}</div></details>`:'';
  const artCourse={
    id:id==='all'||id==='theme'?'folio-home':id,
    name:label,
    originalName:course?.originalName,
    shortName:course?.shortName,
    artPrefs:pref,
    artMotion:s.livingArt!=='off'&&s.motion==='gentle'
  };
  const paste=kind=>`<details class="ch-paste" data-rd-section="paste-${E(id)}-${kind}"><summary>Paste SVG</summary><label><span class="rd-sr-only">${kind==='border'?'frame':kind} SVG source</span><textarea data-rd-field="art-source" data-id="${E(id)}-${kind}" data-course="${E(id)}" data-kind="${kind}" maxlength="262144" spellcheck="false" aria-label="${kind==='border'?'frame':kind} SVG source" placeholder="<svg …>…</svg>">${E(c.customizeDrafts?.[id+':'+kind]||'')}</textarea></label>${button('art-paste','Apply SVG',`data-id="${E(id)}" data-kind="${kind}" ${c.customizeBusy?'disabled':''}`)}</details>`;
  const artwork=(kind,title)=>{
   const value=pref[kind+'Art'],asset=artAsset(value),framing=['banner','card','background'].includes(kind),word=kind==='border'?'frame':kind;
   const preview=value&&frames&&framing?
     '':
     asset?.mediaId&&root.ReserveMedia?
       root.ReserveMedia.render(asset,{kind,className:'ch-art-image',fit:'contain'}):
       asset&&root.ReserveCustomArt?
         root.ReserveCustomArt.render(asset,{kind,motion:artCourse.artMotion,fit:kind==='border'?'fill':'contain',className:'ch-art-image'}):
         kind==='banner'?
           root.ReserveCourseArt?.scene?.(artCourse,{crop:'wide',place:'customize'}):
           kind==='icon'?
             root.ReserveCourseArt?.mini?.(artCourse,{place:'customize'}):
             kind==='title'?
               (root.ReserveCourseArt?.title?.(artCourse,{place:'customize'})||'<span class="ch-title-fallback">Course title</span>'):
               kind==='border'?(id==='all'?root.ReserveCourseArt?.frame?.('home','all'):root.ReserveCourseArt?.frame?.(root.ReserveCourseArt.kind?.(artCourse)||'home',id,artCourse)):'';
   const accept=framing?'image/svg+xml,.svg,image/png,image/jpeg,image/webp,image/avif,image/gif,video/mp4,video/webm,.png,.jpg,.jpeg,.webp,.avif,.gif,.mp4,.webm':kind==='title'?'image/svg+xml,.svg,image/png,image/webp,.png,.webp':'image/svg+xml,.svg';
   return `<div class="ch-art-slot" data-kind="${kind}" data-id="${E(id)}"${framing?` data-ch-frame-target tabindex="0" role="group" aria-label="${E(title)} media for ${E(label)}"`:''}>${value&&frames&&framing?'':`<div class="ch-art-preview" aria-hidden="true">${preview||''}</div>`}<div class="ch-art-caption"><strong>${title}</strong><span title="${E(asset?.name||'Built-in drawing')}">${E(asset?.name||'Built-in drawing')}</span></div><label class="rd-button ch-upload">${asset?'Replace':framing||kind==='title'?'Upload':'Upload SVG'}<input type="file" accept="${accept}" data-rd-field="art-upload" data-kind="${kind}" data-id="${E(id)}" aria-label="Upload ${word} for ${E(label)}" ${c.customizeBusy?'disabled':''}></label>${framing?button('art-clipboard','Paste',`data-id="${E(id)}" data-kind="${kind}" aria-label="Paste ${word}" ${c.customizeBusy?'disabled':''}`):''}${asset?button('art-remove','Use default',`data-id="${E(id)}" data-kind="${kind}" aria-label="Remove custom ${word}" ${c.customizeBusy?'disabled':''}`,'rd-text-button'):''}${['banner','icon','border','title'].includes(kind)?button('art-template','Get template',`data-kind="${kind}"`,'rd-text-button'):''}${paste(kind)}${frames&&framing?root.ReserveFrameEditor.render(value,{id,kind,appearance:{...pref,bannerSize:s.bannerSize,shapes:c.frameShapes?.[id]?.[kind]}}):''}${picker({kinds:['course-art','kit'],target:id,slot:kind,label:'Installed '+word+' artwork'})}</div>`;
  };
  const kits=()=>{
    const installed=c.makeOwn?.catalogue?.filter(row=>row.kind==='kit')||[],ids=new Set(installed.map(row=>row.kit?.id));
    return group('Kits','',`<div class="cz-row"><label class="rd-field"><span>Kit name</span><input type="text" data-rd-field="kit-name" maxlength="40" value="${E(c.kitName||'')}" ${c.customizeBusy?'disabled':''}></label>${button('kit-save','Save as kit',`data-id="${E(id)}" ${c.customizeBusy?'disabled':''}`)}${c.makeOwn?'':`<label class="rd-button ch-upload">Import<input type="file" accept=".chkit,application/json" data-rd-field="kit-import" ${c.customizeBusy?'disabled':''}></label>`}</div>${picker({kinds:['kit'],target:id,label:'Installed kits'})}<div class="ch-kit-list">${(c.customKits||[]).filter(kit=>!ids.has(kit.id)).map(kit=>{
      const current=!!root.ReservePacks?.isCurrent({kind:'kit',kit},{settings:s},{target:id});
      return `<div class="cz-row" data-pack-id="${E(kit.id)}" data-current="${current}"><span class="ch-pack-preview" aria-hidden="true">${root.ReserveMakeYourOwn?.thumbnail({kind:'kit',kit})||''}</span><span><strong>${E(kit.name)}</strong><small>From a file${current?' · Current':''}</small></span>${button('kit-use','Use',`data-kit="${E(kit.id)}" data-id="${E(id)}" aria-pressed="${current}" ${c.customizeBusy?'disabled':''}`,'rd-text-button')}${[['kit-export','Export'],['kit-remove','Remove']].map(([action,label])=>button(action,label,`data-kit="${E(kit.id)}" data-id="${E(id)}" aria-label="${label} ${E(kit.name)}" ${c.customizeBusy?'disabled':''}`,'rd-text-button')).join('')}</div>`;
    }).join('')}${installed.filter(row=>row.kit).map(row=>button('kit-export','Export '+E(row.name),`data-kit="${E(row.kit.id)}" data-id="${E(id)}"`,'rd-text-button')).join('')}</div>`);
  };
   const legacyImage=/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(pref.image||'')&&pref.image.length<400000?`<section class="cz-group ch-legacy-image"><h4>Saved course image</h4><img src="${E(pref.image)}" alt="Saved image for ${E(label)}" width="160" loading="lazy"><p class="cz-note">From a file · Current course image</p><label class="rd-button ch-upload">Replace image<input type="file" accept="image/png,image/jpeg,image/webp" data-rd-field="legacy-image" data-id="${E(id)}" aria-label="Replace saved course image"${c.customizeBusy?' disabled':''}></label>${button('legacy-image-remove','Remove image',`data-id="${E(id)}"`,'rd-text-button')}</section>`:'';
   const banner=artAsset(pref.bannerArt);
   return `<section class="ch-art-controls cz-art" aria-busy="${!!c.customizeBusy}" aria-labelledby="ch-art-title">${enabled('quick-pack')?root.CanvasHarnessQuickUploadUI?.render(c)||'':''}<div class="ch-art-heading"><h3 id="ch-art-title">${id==='theme'?'Theme artwork':'Course artwork'}</h3><label class="rd-field"><span class="rd-sr-only">Customize course</span><select data-rd-field="customize-course" aria-label="Customize course"><option value="all"${id==='all'?' selected':''}>All courses</option><option value="theme"${id==='theme'?' selected':''}>Theme</option>${c.allCourses.map(x=>`<option value="${E(x.id)}"${id===x.id?' selected':''}>${E(x.name)}</option>`).join('')}</select></label></div>${legacyImage}<div class="ch-art-slots">${artwork('banner','Banner')}${frames?artwork('card','Card art')+artwork('background','Page background'):''}${artwork('icon','Icon')}${artwork('border','Frame')}${artwork('title','Title')}</div>${banner?.palette?.length?`<div class="cz-accents" role="group" aria-label="Banner colours">${banner.palette.map(colour=>button('accent',`<i aria-hidden="true" style="background:${E(colour)}"></i><span class="rd-sr-only">${E(colour)}</span>`,`data-accent="${E(colour)}" aria-label="${E(colour)} accent" aria-pressed="${s.accent===colour}"`,'rd-swatch ch-accent-choice')).join('')}</div>`:''}<div class="ch-field-grid">${course&&root.ReserveCourseArt?.choices?select('subjectArt','Drawing',drawings(),'art-setting',pref.subjectArt||''):''}${frames&&pref.bannerArt?'':select('bannerFit','Banner fit',[['contain','Show whole banner'],['cover','Fill banner']], 'art-setting',pref.bannerFit||'contain')+select('bannerPosition','Banner position',[['left','Left'],['center','Center'],['right','Right']], 'art-setting',pref.bannerPosition||'right')}${pref.bannerArt?select('titlePlacement','Course title',[['separate','Separate title drawing'],['banner','In banner']], 'art-setting',pref.titlePlacement||'separate'):''}</div><div class="ch-art-status" aria-live="polite">${E(c.customizeBusy?'Working…':(c.customizeStatus||'').slice(0,180))}</div>${button('course-reset',id==='theme'?'Reset theme artwork':'Reset this course’s artwork',`data-id="${E(id)}"`,'rd-text-button')}</section>${kits()}${unusedArt}`;
  };

  const courses=()=>{
   const visible=new Set(c.courses.map(x=>x.id));
   return group('Course list','',
    `<div class="ch-course-settings cz-courses">${c.allCourses.map((x,index)=>`<div class="ch-course-setting"><label title="Show this course"><input type="checkbox" data-rd-field="course-visible" data-id="${x.id}" aria-label="Show ${E(x.name)}" ${visible.has(x.id)?'checked':''}><span class="rd-sr-only">Show course</span></label><input type="color" data-rd-field="course-color" data-id="${x.id}" aria-label="${E(x.name)} color" value="${E(x.color)}"><input type="text" maxlength="100" data-rd-field="course-name" data-id="${x.id}" aria-label="${E(x.name)} display name" value="${E(x.name)}">${button('course-up','↑',`data-id="${x.id}" aria-label="Move ${E(x.name)} earlier" ${index===0?'disabled':''}`)}${button('course-down','↓',`data-id="${x.id}" aria-label="Move ${E(x.name)} later" ${index===c.allCourses.length-1?'disabled':''}`)}</div>`).join('')}</div>`);
  };

  // Drawings for the Companion's choices (Make it yours v2): scenes for where it goes and reminders, paint dabs for
  // harness colours. {PONY x y w} marks where the companion stands in a scene.
  const CZ_WHERE={"page":"<svg class=\"cz-scene\" viewBox=\"0 0 120 70\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M14 30h92v34H14z\" fill=\"var(--rd-surface,#FFFDF6)\" transform=\"translate(0 0)\"/><path d=\"M14 30h92v34H14z\" fill=\"#EBDBBC\" transform=\"translate(1.4 1.6)\"/><path d=\"M14.2 29.6C40 28.8 80 30.2 105.8 29.4C106.6 40 106 52 106.4 64M14 30.2C13.6 42 14.4 52 13.8 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M22 40h40M22 47h28M22 54h34\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M30 22c10-3 20-3 30 0\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>{PONY 54 4 30}</svg>","home":"<svg class=\"cz-scene\" viewBox=\"0 0 120 70\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M4 50C30 46 90 47 116 50v16H4z\" fill=\"#B7CBA5\" transform=\"translate(0 0)\"/><path d=\"M10 46h100v3H10zM10 52h100v3H10z\" fill=\"#D4A27F\" transform=\"translate(0.8 0.8)\"/><path d=\"M12 58v-15.5M28 58v-15.5M44 58v-15.5M60 58v-15.5M76 58v-15.5M92 58v-15.5M108 58v-15.5M9 46.6C32 46 88 47 111 46.4M9 52.6C32 52 88 53 111 52.4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>{PONY 44 22 34}</svg>","off":"<svg class=\"cz-scene\" viewBox=\"0 0 120 70\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M4 50C30 46 90 47 116 50v16H4z\" fill=\"#B7CBA5\" transform=\"translate(0 0)\"/><path d=\"M10 46h100v3H10zM10 52h100v3H10z\" fill=\"#D4A27F\" transform=\"translate(0.8 0.8)\"/><path d=\"M12 58v-15.5M28 58v-15.5M44 58v-15.5M60 58v-15.5M76 58v-15.5M92 58v-15.5M108 58v-15.5M9 46.6C32 46 88 47 111 46.4M9 52.6C32 52 88 53 111 52.4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M48 40h24v18H48z\" fill=\"#E6C478\" transform=\"translate(1 1)\"/><path d=\"M47.8 39.6c8-.3 16-.3 24.4 0 .3 6 .3 12 0 18.4M47.8 39.8v18.2M54 40v18M60 40v18M66 40v18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M82 22l6 0-6 7h6M92 14l4 0-4 5h4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>"},
    CZ_REMIND={"helpful":"<svg class=\"cz-scene\" viewBox=\"0 0 120 70\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M24 18c22-3 52-3 72 0 3 7 3 15 0 22-12 2-26 2-38 1l-12 10 2-10c-9 0-17-.5-24-1.5-3-7-3-14.5 0-21.5z\" fill=\"#F6DE9A\" transform=\"translate(1.2 1.4)\"/><path d=\"M24 18c22-3 52-3 72 0 3 7 3 15 0 22-12 2-26 2-38 1l-12 10 2-10c-9 0-17-.5-24-1.5-3-7-3-14.5 0-21.5z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M60 22v9M60 35.4v.2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>","quiet":"<svg class=\"cz-scene\" viewBox=\"0 0 120 70\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M50 60V12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M51 13h24l-6 8 6 8H51z\" fill=\"#DE9A7C\" transform=\"translate(1.2 1.4)\"/><path d=\"M50.6 12.6h24.6l-6 8.2 6 8.2H50.6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M42 61c6-1.4 11-1.4 16 0\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>","off":"<svg class=\"cz-scene\" viewBox=\"0 0 120 70\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M60 14c9 0 13 7 13 15v10l5 6H42l5-6V29c0-8 4-15 13-15z\" fill=\"#C9D6DF\" transform=\"translate(1.2 1.4)\"/><path d=\"M60 13.6c9.2 0 13.4 7.2 13.4 15.4v10.2l5 6H41.6l5-6V29c0-8.2 4.2-15.4 13.4-15.4zM56 50c1 3 7 3 8 0M40 60L80 10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>"};
  const czDab=c=>"<svg class=\"cz-dab\" viewBox=\"0 0 40 40\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M20 6c8 0 14 5 14 13.6S28 34 20 34 6 28 6 19.6 12 6 20 6z\" fill=\"§\" transform=\"translate(1.6 1.8)\"/><path d=\"M19.6 5.6c8.4-.2 14.6 5.4 14.6 14s-6.4 14.8-14.4 14.6C11.4 34.2 5.6 28 5.8 19.6 6 11.6 12 5.8 21.6 5.8c1.4.1 2.8.3 4 .8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M25.6 24.2l1.8 2.4M28 21.6l1.6 2.2M23.4 26.8l1.4 2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>".replace('§',c);
  const pony=()=>{
   const P=root.ReservePets,A=root.ReservePetArt;if(!enabled('pony')||!P||!A)return '';
   const pet=P.clean(c.personal?.pet),
     lv=P.level(pet.xp),
     coat=A.COATS[pet.coat],
     style=`--pet-coat:${coat.coat};--pet-shade:${coat.shade};--pet-mane:${coat.mane};--pet-muzzle:${coat.muzzle};--pet-harness:${A.HARNESS[pet.harness]};--pet-size:112px`;
   const identity=A.identity?.({pet:c.personal?.pet,settings:s},c.makeOwn?.pet)||{name:pet.name,id:null},
     builtinName=identity.id?'Biscuit':pet.name||'Biscuit',
     drawing=A.drawing?.({pet:c.personal?.pet,settings:s},c.makeOwn?.pet,{pose:pet.enabled?'stand':'sleep',still:true})||A.svg({title:identity.name});
   const petChoices=(key,title,options,cols)=>choices(key,title,options,{value:pet[key],cols,field:'pet',data:'key'});
   const dot=(a,b)=>`<span class="cz-dot" style="background:${a}"><i style="background:${b||a}"></i></span>`;
   // The companion itself in a choice: its own drawing in that coat, tack or size (built-in companion only).
   const look=({coat=pet.coat,harness=pet.harness,gear=pet.gear}={})=>{
     const v=A.COATS[coat]||A.COATS.oat;
     return `--pet-coat:${v.coat};--pet-shade:${v.shade};--pet-mane:${v.mane};--pet-muzzle:${v.muzzle};--pet-harness:${A.HARNESS[harness]||A.HARNESS.red}`;
   };
   // One drawing, made once per render, serves every choice that shows the companion.
   let ponySvg='';const plain=()=>ponySvg||(ponySvg=A.svg({title:''}).replace(/ role="img" aria-label="[^"]*"/,''));
   const mini=(w,o={})=>`<span class="pet cz-pony" data-pose="stand" data-face="right" data-gear="${o.gear||pet.gear}" style="width:${w}px;height:${Math.round(w*64/72)}px;${look(o)}" aria-hidden="true">${plain()}</span>`;
   const inScene=svg=>identity.id?svg.replace(/\{PONY [^}]*\}/g,''):svg.replace(/\{PONY (\S+) (\S+) (\S+)\}/g,(m,x,y,w)=>`<g style="${look()}">${plain().replace('<svg ',`<svg x="${x}" y="${y}" width="${w}" height="${Math.round(w*64/72)}" `)}</g>`);
    const need=(kind,key)=>P.unlocked(kind,key,pet.xp)?'':`Level ${P.UNLOCKS[kind][key]}`;
    // Use the original pack so a disabled drawing can be switched back on.
    const pack=c.makeOwn?.pet?.pack||c.makeOwn?.pet,poses=(root.ReservePetPack?.poses||A.POSES).filter(pose=>identity.custom&&pack?.assets?.[pack?.poses?.[pose]]);
    const SK=root.ReservePonyBrain?.SKILLS||{},
      skill=keys=>
        keys.filter(key=>SK[key]).concat(keys.length===7?
          Object.keys(SK).filter(key=>!['quiz','labprep','reading','rubric','feedback','deadline','planner','focus','wellbeing','reminders','night','inbox'].includes(key)):
          []).map(key=>
          toggle(key,SK[key].label,'',{checked:pet.skills[key]!==false,field:'pet-skill',data:'key'}).replace('<small></small>','')).join(''),
      routines=pet.routines.map(r=>`<div class="cz-row"><span>${E(r.name)}</span>${button('pet-routine-remove','Remove',`data-id="${E(r.id)}" aria-label="Remove ${E(r.name)}"`,'rd-text-button')}</div>`).join('');
    return `<div class="cz-pet-hero"><div class="pet" data-pose="${pet.enabled?'stand':'sleep'}" data-face="right" data-gear="${pet.gear}" style="${style}">${drawing}</div><div><label class="rd-field"><span>Name</span><input type="text" maxlength="24" data-rd-field="pet" data-key="name" value="${E(identity.name)}" aria-label="Companion name"></label><p class="cz-note">Level ${lv} · ${pet.treats} treat${pet.treats===1?'':'s'}${pet.streak>1?` · ${pet.streak} days in a row`:''}</p></div></div>
<div class="cz-toggles">${toggle('enabled','Keep '+identity.name,'It keeps you company, tells you what is next, and enjoys a treat when work is done. It never nags.',{checked:pet.enabled,field:'pet',data:'key'})}</div>`
    +group('Companion','',button('make-clear',`<span class="cz-choice-art cz-companion-art">${A.drawing({pet:{...pet,name:builtinName}},null,{still:true})}</span><strong>${E(builtinName)}</strong><small>Built-in${identity.id?'':' · Current'}</small>`,`data-id="pet" aria-pressed="${!identity.id}"`,'rd-text-button')+picker({kinds:['pet'],label:'Installed companions'}))
     +
     (root.ReserveFeatures?.enabled?.('biscuit-more-rules')===true?
       group('How much Biscuit knows','',petChoices('knowledge','How much Biscuit knows',[['basic','Basic',''],['more','More',''],['most','Most','']],3)):
       '')
    +
    group(
      'Where it goes',
      '',
      petChoices(
        'roam',
        'Where your companion goes',
        [['page','Anywhere','It walks along the tops of your modules and the bottom of the window.',inScene(CZ_WHERE.page)],['home','Its paddock','It stays in the Paddock module on Home.',inScene(CZ_WHERE.home)],['off','Out of sight','Hidden for now. Treats and level are kept.',CZ_WHERE.off]],
        3))
    +group('Planning','',`<label class="rd-field"><span>Bedtime</span><input type="time" data-rd-field="setting" data-setting="bedtime" value="${E(s.bedtime||'22:30')}"></label>${toggle('biscuitOffers','Biscuit offers','One timely offer, with less after you skip it.',{checked:s.biscuitOffers!==false})}`)
    +
    group(
      'Reminders',
      '',
      petChoices('nudges','Reminders',[['helpful','Speaks up','Up to three timely nudges a day. Quiet from 22:00 to 07:00 unless a deadline is close.',CZ_REMIND.helpful],['quiet','A small flag','Carries a flag when something is due soon. Says nothing.',CZ_REMIND.quiet],['off','None','It never mentions deadlines.',CZ_REMIND.off]],3))
    +
    (identity.id?
      '':
      group(
        'Coat',
        `New coats arrive as it levels up: finish work and focus sessions to get there.`,
        petChoices('coat','Coat',Object.entries(A.COATS).map(([key,v])=>[key,v.label,need('coat',key),mini(44,{coat:key}),!!need('coat',key)]),6))
    +group('Harness','',petChoices('harness','Harness color',Object.entries(A.HARNESS).map(([key,color])=>[key,key[0].toUpperCase()+key.slice(1),need('harness',key),czDab(color),!!need('harness',key)]),6)
      +petChoices('gear','Tack',[['full','Collar and blanket','',mini(56,{gear:'full'})],['collar','Collar only','',mini(56,{gear:'collar'})],['none','Bare','',mini(56,{gear:'none'})]],3)))
    +
    group('Size','',petChoices('size','Size',[['small','Small','',mini(40)],['medium','Medium','',mini(52)],['large','Large','',mini(66)]],3))+
    (poses.length?group('Poses','',`<div class="cz-toggles">${poses.map(pose=>`<label class="cz-toggle"><span>${E(pose[0].toUpperCase()+pose.slice(1))}</span><input type="checkbox" role="switch" data-rd-field="make-pose" data-id="pack:${E(identity.id)}" data-pose="${E(pose)}"${s.makeYourOwn?.adjustments?.['pack:'+identity.id]?.poses?.[pose]!==false?' checked':''}${pose==='stand'?' disabled':''}><i aria-hidden="true"></i></label>`).join('')}</div>`):'')+
    group('Skills','',`<h4 class="cz-subhead">For study</h4><div class="cz-toggles cz-checks">${skill(['quiz','labprep','reading','rubric','feedback'])}</div><h4 class="cz-subhead">For the day</h4><div class="cz-toggles cz-checks">${skill(['deadline','planner','focus','wellbeing','reminders','night','inbox'])}</div>`)+
    (routines?group('Routines','',routines):'')+
    group('Saved routines','',picker({kinds:['preset'],presetKinds:['routines'],label:'Saved routines'}))+
    button('pet-reset-learning','Reset what '+identity.name+' learned','','rd-text-button');
  };

  // "Add from a file" lives on More; elsewhere the section shows only a pick's status, Undo or a file under review.
  const files=add=>enabled('customization')?root.ReserveMakeYourOwn?.render(c.makeOwn,c.s,{list:false,add})||'':'';
  const body=`${on('layout')?`<div class="cz-pane" data-pane="layout">${layout()}</div>`:''}${on('look')?`<div class="cz-pane" data-pane="look">${look()}</div>`:''}${on('courses')?`<div class="cz-pane" data-pane="courses">${courses()}${enabled('course-art')?bannerGroup()+look('cards')+art():''}</div>`:''}${on('pet')?`<div class="cz-pane" data-pane="pet">${pony()}</div>`:''}`;
  return shell(`<section class="rd-customize ch-customize cz" aria-label="Customize workspace"><div class="rd-section-heading"><div><span class="ch-eyebrow">Your workspace</span><h2 id="rd-appearance-title">Make it yours</h2></div>${button('settings-close','Done','aria-label="Close customization" title="Close · Esc"')}</div>
<div class="cz-tabs" role="tablist" aria-label="Settings">${allowedTabs.map(([key,name])=>button('customize-tab',name,`role="tab" data-value="${key}" aria-selected="${tab===key}"`,'cz-tab')).join('')}</div>
 ${root.ReserveSettingsDock?.featuresPane(tab==='settings'?'features':tab)||''}${on('settings')?root.ReserveSettingsDock?.preferencesPane({...c,customizeTab:'settings'},{resetLayout:true,files:files(true)})||'':files(false)}${body}<div class="ch-custom-footer"></div></section>`);
 }
 function createDock(options){
  return root.ReserveSettingsDock?.createDock(options)||retainClosedContent(createAppearanceDock,options);
 }
 // Appearance adds only content retention to the shared dock. Its existing
 // controller still owns Features, accessibility, focus and open/close handoff.
 function retainClosedContent(create,options){
  const {container}=options,reduce=root.matchMedia?.('(prefers-reduced-motion: reduce)');
  let open=false,closing=false,dead=false,timer=null,watched=null,started=0,delay=0;
  const panel=()=>container.querySelector('.rd-appearance');
  const now=()=>root.performance?.now?.()??Date.now();
  function cancel(){
   if(timer!==null){root.clearTimeout(timer);timer=null;}
   watched?.removeEventListener('transitionend',ended);watched?.removeEventListener('transitioncancel',interrupted);watched=null;
  }
  function clearContent(destroy=false){
   cancel();closing=false;
   const inner=panel()?.querySelector('.t-acc-panel-inner'),section=inner?.querySelector('.rd-customize'),features=section?.querySelector('[data-rd-key="features-pane"]');
   if(!inner)return;
   if(!destroy&&section&&features){
    // Keep the actual Features subtree: pending writes and storage listeners
    // belong to that controller even while the editor is closed.
    features.classList.remove('cz-pane');features.removeAttribute('data-pane');
    features.hidden=true;section.replaceChildren(features);inner.replaceChildren(section);
   }else inner.replaceChildren();
  }
  function transitionTime(node){
   if(reduce?.matches||container.dataset.motionStyle==='off'||container.dataset.input==='keyboard')return 0;
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
   else{closing=true;inner?.setAttribute('data-rd-key','features-pane');}
   try{options.onChange?.(value);}finally{sync();}
  }});
  if(!controller)return null;
  const syncDock=controller.sync.bind(controller),destroyDock=controller.destroy.bind(controller);
  function sync(){
   if(dead)return;
   const node=panel(),closedShell=node?.dataset.open==='false'&&node.querySelector('.t-acc-panel-inner')?.getAttribute('data-rd-key')==='features-pane';
   syncDock();
   if(open||!closing)return;
   // Standalone feature launchers keep their own markup; only a renderer that
   // supplied our closed shell transfers outgoing-content ownership here.
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
   const retained=panel()?.querySelector('.t-acc-panel-inner')?.getAttribute('data-rd-key')==='features-pane';
   dead=true;cancel();reduce?.removeEventListener?.('change',reduced);destroyDock();if(retained)clearContent(true);
  };
  return controller;
 }
 // Fallback for callers that load the appearance editor without the shared dock.
 function createAppearanceDock({container,onOpen=()=>{},onChange=()=>{}}){
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
 const api={render,createDock,tabs,tabFor,retainClosedContent};root.ReserveCustomizeUI=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
