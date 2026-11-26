/* Canvas Harness: the "Make it yours" panel (adapted from the public Canvas Harness). Six tabs, one place for each thing (4.2, roadmap item 5: "order and
   categories"): Scenes (scenes and installed themes), Look (light or dark, colours, paper, your own banner, course cards, outline, type,
   motion, graphics), Home (how Home is laid out), Courses (the list and each course's artwork), Companion, Settings (Canvas's own pages,
   preferences, backups, files, features). Every choice is a picture and a name; changes apply at once and save on this device.
   Original creator: Flzsh. */
(function(root){
 'use strict';
 const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const enabled=id=>!globalThis.ReserveFeatures||globalThis.ReserveFeatures.enabled(id);
 const tabs=()=>enabled('customization')?TABS.filter(([key])=>key!=='pet'||enabled('pony')):[['features','Features'],['settings','Settings']];
 // Older names still open the tab that now holds them: the all-in-one view, Artwork and Features.
 const ALIASES={all:'look',art:'courses',features:'settings',more:'settings'};
 // The tab holding a saved setting, for search and Biscuit ("open spacing" lands on Home).
 const SETTING_TABS={scenes:['sceneTheme'],layout:['courseNavigation','dockSize','deskOrder','density','showCourseStrip','showCourseIcons','showDeadlinePreview','showBookmarks','showCourseInformation','showRecentGrades','greeting','quickOpen'],pet:['bedtime','biscuitOffers'],settings:['timeZone','canvasNav']};
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
 const TABS=[['scenes','Scenes'],['look','Look'],['layout','Home'],['courses','Courses'],['pet','Companion'],['settings','Settings']];
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
  knowfull:svg('<path class="cz-fill" d="M17 37h35v5H17z" transform="translate(1 1)"/><path d="M15.600 36.400c11.600-.5 23.600-.5 36 .2.500 1.900.500 3.900.100 5.900-12.200.5-24.200.4-36.100-.2-.5-2-.4-4 0-5.900z"/><path d="M19.800 30.800c9-.4 19-.4 29.400.2.400 1.800.400 3.700 0 5.400M19.800 30.800c-.4 1.900-.4 3.800 0 5.600"/><path d="M23.600 25c7.800-.4 15.400-.3 22.800.2.400 1.900.400 3.700 0 5.700M23.600 25c-.3 2-.3 4 0 5.800"/><path d="M27 19c6.200-.3 12-.2 17 .3.300 1.900.300 3.800 0 5.700M27 19c-.3 2-.2 4 0 6"/><path d="M21 39.400c8.600-.2 17.600-.2 26.600.1"/>'),
  knowlite:svg('<path class="cz-fill" d="M28 34c1.800-9 9-18 20-22 1 10-5 21-16 23z" transform="translate(1 1)"/><path d="M26.400 33.800c1.600-9.400 9.400-18.800 20.600-22.600 1.200 10.800-5.600 21.800-17 23.600"/><path d="M21.400 41.400c5.200-8.800 11.800-16.600 18.800-22.600"/><path d="M33.600 26.200l6.600.8M30.400 30l6 .6M37.400 22.400l5.800.4"/>'),
  gfxlow:svg('<path d="M6 40c8-.4 13-11 19-11.600c6 .4 8 7 14 7.400c6 .2 9-8 14-8c5 .2 9 8 13 12.200"/><path d="M6 40.600c20-.6 40-.6 60 0"/><circle cx="53" cy="13" r="4.600"/>'),
  gfxmedium:svg('<path d="M6 40c8-.4 13-11 19-11.600c6 .4 8 7 14 7.400c6 .2 9-8 14-8c5 .2 9 8 13 12.200"/><path d="M6 40.600c20-.6 40-.6 60 0"/><circle cx="53" cy="13" r="4.600"/><path d="M16 15.400c-3.200 .2-3.600-4.200-.4-4.400c.6-3.400 6-3.800 7.200-.8c3.400-.8 4.800 4.400 1.400 5.200c-2.600 .2-5.400 .1-8.200 0z"/>'),
  gfxhigh:svg('<path d="M6 40c8-.4 13-11 19-11.600c6 .4 8 7 14 7.400c6 .2 9-8 14-8c5 .2 9 8 13 12.200"/><path d="M6 40.600c20-.6 40-.6 60 0"/><circle cx="53" cy="13" r="4.600"/><path d="M16 15.400c-3.200 .2-3.600-4.200-.4-4.400c.6-3.400 6-3.800 7.200-.8c3.400-.8 4.800 4.400 1.400 5.200c-2.600 .2-5.400 .1-8.200 0z"/><path d="M26 40v-5"/><path class="cz-fill" d="M26 36c-3.600-.2-4.200-5-1.400-6.200c-.2-3.600 4.800-4.400 5.600-1c3.200 .6 3.200 6.800-.6 7.200c-1.200 .2-2.400 .2-3.600 0z"/>'),
  gfxxhigh:svg('<path d="M6 40c8-.4 13-11 19-11.600c6 .4 8 7 14 7.400c6 .2 9-8 14-8c5 .2 9 8 13 12.200"/><path d="M6 40.600c20-.6 40-.6 60 0"/><circle cx="53" cy="13" r="4.600"/><path d="M16 15.400c-3.200 .2-3.600-4.200-.4-4.400c.6-3.400 6-3.800 7.200-.8c3.400-.8 4.800 4.400 1.400 5.200c-2.600 .2-5.400 .1-8.200 0z"/><path d="M26 40v-5"/><path class="cz-fill" d="M26 36c-3.600-.2-4.200-5-1.400-6.200c-.2-3.600 4.800-4.400 5.600-1c3.200 .6 3.200 6.800-.6 7.200c-1.200 .2-2.400 .2-3.600 0z"/><path d="M41 11.600c1.200-1 2.200-1 3.200 0c1-1 2-1 3 0M32 18.600c.8-.8 1.600-.8 2.400 0c.8-.8 1.600-.8 2.400 0" opacity=".7"/><path d="M12 39l2.400-3M15 39l2.400-3M47 39l2.400-3M50 39l2.400-3M53 39l2.400-3" opacity=".55"/><path d="M63 9v4M61 11h4" class="cz-accent"/>'),
  off:svg(R(14,10,44,28)+'<path d="M24 24h24"/>')
 });
 // Megapack (4.2, megapack engine 1): Soul Passage's pictures and data come down from the Market. The lead's drawings, as they
 // came: the tag with the arrow into a tray for "not on this computer", and the filling line (a pencil track; the clay line
 // uncovered from the left by --mp-p, 0-100) for "coming down".
 const MP_ART=Object.freeze({markGet:"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 34 34\" aria-hidden=\"true\"><g transform=\"rotate(-4 17 17)\"><path fill=\"#141413\" opacity=\"0.14\" transform=\"translate(2 2.4)\" d=\"M7.2 4.5 Q16.8 3.4 21.9 3.8 Q27.1 4.1 28.4 5.4 Q29.7 6.8 30.3 12.0 Q30.9 17.2 30.3 22.0 Q29.7 26.9 28.3 28.6 Q26.8 30.2 21.8 30.4 Q16.9 30.7 12.0 30.3 Q7.2 29.8 5.6 28.3 Q4.0 26.8 3.8 21.8 Q3.5 16.8 3.9 12.1 Q4.2 7.3 5.7 5.9 Q7.2 4.5 12.0 4.0 L16.8 3.4\"/><path fill=\"#FFFDF8\" d=\"M7.2 4.5 Q16.8 3.4 21.9 3.8 Q27.1 4.1 28.4 5.4 Q29.7 6.8 30.3 12.0 Q30.9 17.2 30.3 22.0 Q29.7 26.9 28.3 28.6 Q26.8 30.2 21.8 30.4 Q16.9 30.7 12.0 30.3 Q7.2 29.8 5.6 28.3 Q4.0 26.8 3.8 21.8 Q3.5 16.8 3.9 12.1 Q4.2 7.3 5.7 5.9 Q7.2 4.5 12.0 4.0 L16.8 3.4\"/><path fill=\"none\" stroke=\"#141413\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M6.9 4.4 Q16.9 3.1 22.0 3.6 Q27.1 4.0 28.4 5.6 Q29.7 7.2 30.2 12.1 Q30.8 17.0 30.4 22.0 Q30.0 27.0 28.3 28.5 Q26.7 30.0 21.7 30.4 Q16.7 30.9 12.0 30.3 Q7.3 29.7 5.6 28.3 Q4.0 26.8 3.8 21.9 Q3.6 16.9 4.0 12.0 Q4.3 7.1 5.6 5.8 Q6.9 4.4 11.9 3.8 L16.9 3.1\"/><path fill=\"#D4A27F\" opacity=\".55\" transform=\"translate(1 1.2)\" d=\"M9.2 21.0 Q9.3 26.0 16.9 26.0 Q24.5 26.0 24.7 23.5 Q25.0 21.0 23.0 21.2 Q21.0 21.4 17.1 21.3 Q13.2 21.3 11.2 21.1 Q9.2 21.0 9.2 23.5 L9.3 26.0\"/><path fill=\"none\" stroke=\"#A9522F\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M17.1 8.1 Q17.0 14.0 17.0 17.1 L16.9 20.1\"/><path fill=\"none\" stroke=\"#A9522F\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M11.7 15.1 Q17.0 20.5 19.8 17.9 L22.6 15.3\"/><path fill=\"none\" stroke=\"#141413\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M9.2 20.6 Q9.4 26.0 13.3 26.0 Q17.2 26.0 21.0 26.0 Q24.8 26.0 24.9 23.4 L24.9 20.7\"/></g></svg>",
  lineTrack:"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 8\" preserveAspectRatio=\"none\" aria-hidden=\"true\"><path fill=\"none\" stroke=\"#141413\" stroke-opacity=\".22\" stroke-width=\"1.6\" stroke-linecap=\"round\" vector-effect=\"non-scaling-stroke\" d=\"M1.8 4.7 Q18.1 3.6 26.1 4.2 Q34.1 4.8 42.1 4.3 Q50.1 3.9 58.1 4.5 Q66.2 5.1 74.2 4.4 Q82.2 3.6 90.0 4.0 L97.9 4.3\"/></svg>",
  lineDone:"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 8\" preserveAspectRatio=\"none\" aria-hidden=\"true\"><path fill=\"none\" stroke=\"#A9522F\" stroke-width=\"3.2\" stroke-linecap=\"round\" vector-effect=\"non-scaling-stroke\" d=\"M1.8 4.7 Q18.1 3.6 26.1 4.2 Q34.1 4.8 42.1 4.3 Q50.1 3.9 58.1 4.5 Q66.2 5.1 74.2 4.4 Q82.2 3.6 90.0 4.0 L97.9 4.3\"/></svg>"});
 // Soul Passage's Adjust (4.2): the lead's drawings as they came, the
 // inside of the picker's own small drawing (svg(), 72 x 48): the lever's four stops, the seven lands and Today, Now and five lights.
 const MP_ADJUST=Object.freeze({speed:Object.freeze(["<path class=\"cz-soft\" d=\"M24 13Q35.9 12.6 47.9 13Q59.9 13.4 61.1 14.5Q62.3 15.5 62.5 21.7Q62.8 27.9 62.6 34.4Q62.4 41 61.3 42Q60.2 43 48.1 43.2Q35.9 43.4 23.9 43.2Q12 42.9 10.8 41.8Q9.6 40.7 9.4 34.4Q9.1 28.1 9.4 21.8Q9.6 15.5 10.8 14.4Q12.1 13.4 24 13z\"/><path d=\"M27.5 31.4L27.6 24.8L33.5 24.7L33.6 31.3z\"/><path d=\"M38.4 31.4L38.7 21.1L44.5 21.1L44.6 31.4z\"/><path d=\"M49.6 31.5L49.6 17.2L55.3 17.2L55.6 31.5z\"/><path class=\"cz-fill\" d=\"M16.4 31.5L16.7 27.9L22.4 27.7L22.5 31.4z\"/><path opacity=\"0.7\" d=\"M25.9 35.2Q36.1 35 46.2 35.2Q56.3 35.4 57.2 36.3Q58.1 37.2 57.3 38.1Q56.4 39.1 46.2 39.2Q36 39.2 25.8 39.1Q15.7 39.1 14.8 38.1Q13.9 37.1 14.8 36.2Q15.6 35.4 25.9 35.2z\"/><path class=\"cz-fill\" d=\"M21.9 35.2Q21.2 34.2 20 34.2Q18.7 34.1 17.7 34.8Q16.7 35.4 16.5 36.8Q16.4 38.2 17.1 39.1Q17.8 40.1 19.1 40.3Q20.5 40.5 21.4 39.7Q22.3 38.8 22.5 37.5Q22.7 36.2 21.9 35.2z\"/>",
    "<path class=\"cz-soft\" d=\"M24 13Q35.9 12.6 47.9 13Q59.9 13.4 61.1 14.5Q62.3 15.5 62.5 21.7Q62.8 27.9 62.6 34.4Q62.4 41 61.3 42Q60.2 43 48.1 43.2Q35.9 43.4 23.9 43.2Q12 42.9 10.8 41.8Q9.6 40.7 9.4 34.4Q9.1 28.1 9.4 21.8Q9.6 15.5 10.8 14.4Q12.1 13.4 24 13z\"/><path d=\"M16.5 31.4L16.6 27.8L22.5 27.7L22.6 31.3z\"/><path d=\"M38.4 31.4L38.7 21.1L44.5 21.1L44.6 31.4z\"/><path d=\"M49.6 31.5L49.6 17.2L55.3 17.2L55.6 31.5z\"/><path class=\"cz-fill\" d=\"M27.5 31.3L27.7 24.9L33.3 24.8L33.4 31.5z\"/><path opacity=\"0.7\" d=\"M25.9 35.2Q36.1 35 46.2 35.2Q56.3 35.4 57.2 36.3Q58.1 37.2 57.3 38.1Q56.4 39.1 46.2 39.2Q36 39.2 25.8 39.1Q15.7 39.1 14.8 38.1Q13.9 37.1 14.8 36.2Q15.6 35.4 25.9 35.2z\"/><path class=\"cz-fill\" d=\"M32.9 35.2Q32.2 34.2 30.9 34.1Q29.7 34 28.6 34.8Q27.6 35.6 27.5 36.8Q27.4 38 28.1 39Q28.8 40.1 30 40.3Q31.3 40.5 32.4 39.6Q33.5 38.8 33.6 37.5Q33.7 36.2 32.9 35.2z\"/>",
    "<path class=\"cz-soft\" d=\"M24 13Q35.9 12.6 47.9 13Q59.9 13.4 61.1 14.5Q62.3 15.5 62.5 21.7Q62.8 27.9 62.6 34.4Q62.4 41 61.3 42Q60.2 43 48.1 43.2Q35.9 43.4 23.9 43.2Q12 42.9 10.8 41.8Q9.6 40.7 9.4 34.4Q9.1 28.1 9.4 21.8Q9.6 15.5 10.8 14.4Q12.1 13.4 24 13z\"/><path d=\"M16.5 31.4L16.6 27.8L22.5 27.7L22.6 31.3z\"/><path d=\"M27.4 31.4L27.7 24.7L33.5 24.7L33.6 31.4z\"/><path d=\"M49.6 31.5L49.6 17.2L55.3 17.2L55.6 31.5z\"/><path class=\"cz-fill\" d=\"M38.5 31.3L38.7 21.3L44.3 21L44.6 31.3z\"/><path opacity=\"0.7\" d=\"M25.9 35.2Q36.1 35 46.2 35.2Q56.3 35.4 57.2 36.3Q58.1 37.2 57.3 38.1Q56.4 39.1 46.2 39.2Q36 39.2 25.8 39.1Q15.7 39.1 14.8 38.1Q13.9 37.1 14.8 36.2Q15.6 35.4 25.9 35.2z\"/><path class=\"cz-fill\" d=\"M43.9 35.4Q43.1 34.3 41.9 34.2Q40.7 34.1 39.7 34.8Q38.7 35.5 38.5 36.7Q38.2 38 39 39.1Q39.7 40.1 41.1 40.3Q42.4 40.5 43.4 39.6Q44.4 38.8 44.5 37.6Q44.7 36.5 43.9 35.4z\"/>",
    "<path class=\"cz-soft\" d=\"M24 13Q35.9 12.6 47.9 13Q59.9 13.4 61.1 14.5Q62.3 15.5 62.5 21.7Q62.8 27.9 62.6 34.4Q62.4 41 61.3 42Q60.2 43 48.1 43.2Q35.9 43.4 23.9 43.2Q12 42.9 10.8 41.8Q9.6 40.7 9.4 34.4Q9.1 28.1 9.4 21.8Q9.6 15.5 10.8 14.4Q12.1 13.4 24 13z\"/><path d=\"M16.5 31.4L16.6 27.8L22.5 27.7L22.6 31.3z\"/><path d=\"M27.4 31.4L27.7 24.7L33.5 24.7L33.6 31.4z\"/><path d=\"M38.6 31.5L38.6 21.2L44.3 21.2L44.6 31.5z\"/><path class=\"cz-fill\" d=\"M49.6 31.4L49.7 17.3L55.5 17.1L55.5 31.4z\"/><path opacity=\"0.7\" d=\"M25.9 35.2Q36.1 35 46.2 35.2Q56.3 35.4 57.2 36.3Q58.1 37.2 57.3 38.1Q56.4 39.1 46.2 39.2Q36 39.2 25.8 39.1Q15.7 39.1 14.8 38.1Q13.9 37.1 14.8 36.2Q15.6 35.4 25.9 35.2z\"/><path class=\"cz-fill\" d=\"M54.9 35.4Q54.1 34.3 52.9 34.1Q51.6 34 50.6 34.8Q49.6 35.6 49.4 36.9Q49.3 38.1 50.1 39.1Q51 40.1 52.1 40.3Q53.3 40.4 54.3 39.6Q55.3 38.8 55.5 37.6Q55.7 36.4 54.9 35.4z\"/>"]),
  land:Object.freeze({
    today:"<path class=\"cz-soft\" d=\"M29.4 12.3Q35.9 12 42.3 12.2Q48.8 12.4 49.3 18.7Q49.7 25 49.5 31.8Q49.2 38.6 42.5 38.7Q35.9 38.8 29.4 38.7Q23 38.6 22.6 31.8Q22.3 25 22.6 18.8Q23 12.6 29.4 12.3z\"/><path d=\"M22.7 19.5Q36.1 19 42.8 19.2L49.5 19.5\"/><path stroke-width=\"2\" d=\"M29.5 8.8L29.4 14.8M42.6 9.2L42.3 15\"/><path class=\"cz-fill\" d=\"M38.7 25.6Q41.8 25.4 42 28.5Q42.1 31.6 39 31.6Q35.9 31.7 35.8 28.7Q35.6 25.7 38.7 25.6z\"/><path opacity=\"0.5\" d=\"M26.9 26.3L31.2 26.5M26.9 33.5L31.1 33.7M36.5 35.5L41 35.5M44.7 28.4L46.4 28.6\"/>",
    mirror:"<path class=\"cz-soft\" d=\"M14.1 10.7L38.2 10.7L37.5 13.2L33.6 14.1L32.1 19.7L29.7 17.1L27.6 25L24.1 19.2L22.1 23.1L19.4 16.5L14.7 13.2z\"/><path d=\"M14.1 10.6L37.8 10.7L37.5 13.3L33.3 14.1L32.2 19.7L29.8 17.1L27.3 25.1L24.2 19.1L21.9 22.9L19.3 16.4L14.4 13.2z\"/><path opacity=\"0.55\" stroke-width=\"1\" d=\"M14.1 13.1L38.1 12.9\"/><path opacity=\"0.5\" stroke-width=\"1.1\" d=\"M18.8 13.4L18 19.8M30.2 13.3L31 21.3M35.2 13.6L34.6 17.7\"/><path class=\"cz-soft\" d=\"M47.8 16.3L62.4 16.2L61.6 19L59.7 19.9L58.6 22L57.1 20.7L55.9 25.3L53.8 21.8L52.6 24.2L50.9 20.2L48.2 19z\"/><path d=\"M47.5 16.4L62.4 16.3L61.8 19.2L59.4 19.8L58.6 21.9L57.4 20.4L55.8 25.3L53.8 21.8L52.3 24L50.8 20.1L48.1 19z\"/><path opacity=\"0.5\" stroke-width=\"1.1\" d=\"M51.4 19L51.4 22.8M58.2 18.8L58.5 21.6\"/><path opacity=\"0.7\" stroke-width=\"1\" d=\"M38.1 12.2Q42.4 16.4 45.1 17.2L47.7 18\"/><path class=\"cz-fill\" d=\"M43.6 17.5Q43.1 17 42.3 17.2Q41.5 17.4 41.3 18.1Q41.2 18.7 41.7 19.3Q42.2 19.9 43 19.7Q43.7 19.5 43.9 18.8Q44.1 18.1 43.6 17.5z\"/><path d=\"M4.2 30.6Q21.1 30.1 28.5 30.4Q35.9 30.7 43.5 30.5Q51 30.2 59.2 30.4L67.5 30.5\"/><path opacity=\"0.36\" d=\"M13.9 49.9L37.8 50.2L37.2 47.7L33.6 46.5L31.9 41.2L29.4 43.8L27.6 36.1L24 41.6L22.1 37.9L19 44.3L14.7 47.7z\"/><path opacity=\"0.36\" d=\"M47.6 44.2L62.6 44.2L61.8 42L59.6 40.8L58.6 38.6L57.1 40.2L55.7 35.4L54 38.9L52.3 36.8L51.1 40.9L48.4 41.7z\"/><path class=\"cz-fill\" d=\"M12 29.4Q11.8 28.5 11.1 27.9Q10.4 27.2 9.4 26.9Q8.5 26.7 7.6 27Q6.8 27.2 6.1 27.9Q5.5 28.6 5.2 29.5Q5 30.5 8.6 30.4Q12.2 30.3 12 29.4z\"/><path class=\"cz-accent\" stroke-width=\"1.2\" d=\"M5.4 33.5L11.7 33.4M6.9 36.4L10.2 36.3\"/><path opacity=\"0.42\" d=\"M44.1 35.6L48.1 35.8M62.7 39.2L66.8 39.2M40.8 43.5L45.3 43.3M5.4 42.7L10.1 43\"/>",
    rain:"<path class=\"cz-soft\" d=\"M6.2 38.8L6.1 9.6L13.7 9.1L14.4 17.4L23.6 18.1L24 27.5L29.8 28.2L30.7 38.6\"/><path d=\"M16.5 17.5L16.5 13.9L19.5 11.3L22.4 14.1L22.4 17.7\"/><path class=\"cz-fill\" d=\"M18.4 14.5L20.4 14.5L20.4 16.6L18.5 16.7z\"/><path opacity=\"0.4\" d=\"M8.6 22L12.8 21.9M8.8 30.2L19.2 29.6M15 34.5L26.1 34.4\"/><path opacity=\"0.6\" d=\"M23.7 20.7Q30.7 24.4 34.3 23.5L37.9 22.6\"/><path class=\"cz-accent\" d=\"M27.9 23.4L28 24.8M33.6 24L33.8 25.2\"/><path class=\"cz-soft\" d=\"M40.5 30.7L40.4 22L54.3 21.9L54.7 30.5z\"/><path d=\"M37.4 22.5L47.5 14.2L57.8 22.6\"/><path class=\"cz-fill\" d=\"M45.1 24.1L50.1 23.8L50.1 28.3L45.1 28.3z\"/><path d=\"M42 30.9L42 38.6M47.6 30.6L47.4 38.4M52.8 30.8L53.1 38.3\"/><path class=\"cz-accent\" d=\"M31 39.2Q36.8 37.8 39.7 38.6Q42.6 39.3 45.5 38.6Q48.4 37.9 51.4 38.6Q54.3 39.3 57.2 38.6Q60.1 37.9 63 38.6L65.9 39.3\"/><path opacity=\"0.45\" d=\"M36 42.1L43.8 42M49.9 42.6L60 42.1\"/><path opacity=\"0.6\" d=\"M34.6 6.5L32.7 11.9M44.5 5.8L42.9 10.5M60.4 6.8L58.6 12.8M64.2 17.7L62.4 23.1M62.5 27.6L61 32.6M33.7 14.8L32.2 19.3M20.7 5.5L19.2 9.2\"/>",
    clouds:"<path class=\"cz-fill\" d=\"M21.9 13.1Q24.7 15.6 27.7 16.9Q30.6 18.1 33.2 19Q35.9 20 38.6 19Q41.4 18.1 44.4 16.8Q47.3 15.5 50.1 13.5Q52.9 11.4 51.8 14.5Q50.7 17.5 48.2 19.8Q45.7 22.2 43.2 23.5Q40.7 24.8 39.7 26.2Q38.7 27.6 38.8 30.2Q38.9 32.8 36 32.9Q33 32.9 33.2 30.2Q33.5 27.5 32.4 26.3Q31.3 25 28.8 23.4Q26.3 21.8 23.8 19.8Q21.3 17.7 20.2 14.2Q19.2 10.7 21.9 13.1z\"/><path d=\"M7.3 31.1Q10.7 27.9 12.9 28Q15.2 28.1 16.5 29.5L17.9 30.9\"/><path opacity=\"0.6\" d=\"M12.7 26.4Q11.9 23.3 10.8 22.5L9.7 21.6M13.1 26.3Q14 23.1 15.1 22.5L16.1 21.9\"/><path d=\"M55.6 32.1L59.5 24.5L63.5 32\"/><path d=\"M5.6 35.1Q9.7 31.7 12.2 31.9Q14.6 32.2 16 33.4Q17.4 34.6 19.5 33.1Q21.6 31.7 24.2 31.7Q26.9 31.8 28.5 33.1Q30.2 34.5 33 33.4Q35.7 32.4 38.3 32.4Q40.9 32.4 42.6 33.4Q44.3 34.4 46.9 33Q49.5 31.7 52.3 31.8Q55.1 31.9 56.5 33.3Q57.9 34.7 59.9 33.3Q61.9 32 64.2 33.3L66.4 34.6\"/><path opacity=\"0.55\" d=\"M8 41.4Q13 38.7 15.9 39Q18.9 39.2 20.8 40.3Q22.7 41.4 25.4 40.3Q28.1 39.2 31 39.3Q33.9 39.4 35.7 40.6Q37.5 41.8 40.2 40.3Q43 38.9 46 39.2Q49.1 39.5 50.7 40.6Q52.2 41.8 55.2 40.6Q58.1 39.4 61 40.4L63.9 41.3\"/>",
    canal:"<path class=\"cz-soft\" d=\"M7.3 40.6L7.7 20.5L15.4 20.2L15.6 40.5z\"/><path opacity=\"0.5\" stroke-width=\"1.3\" d=\"M9.4 24.8L13.7 24.8M9.6 30.2L13.7 29.8M9.5 35.2L13.5 35.1\"/><path class=\"cz-soft\" d=\"M60.8 40.6L60.7 27.1L67.2 27.1L67.4 40.2z\"/><path opacity=\"0.5\" stroke-width=\"1.3\" d=\"M62.5 31.8L65.5 31.5M62.5 36.1L65.4 36.1\"/><path d=\"M19.6 40.4L20 10.5L30 10.3L30.3 40.5\"/><path opacity=\"0.5\" stroke-width=\"1.3\" d=\"M22 15.2L28.1 15M22.1 20.1L25.7 19.8M23.6 24.9L28 24.9M22.2 29.9L28 30.1M22.2 35.2L26 35.1\"/><path d=\"M47.6 40.3L47.6 16.4L58.2 16L58.4 40.6\"/><path opacity=\"0.5\" stroke-width=\"1.3\" d=\"M50 21.2L56.1 20.9M51.8 25.9L56 26.2M49.9 30.9L53.9 31.1M49.9 35.9L55.9 36.2\"/><path d=\"M35.3 40.4L38.4 15M42.8 40.3L39.6 15.1\"/><path opacity=\"0.7\" stroke-width=\"1.2\" d=\"M35.9 35.4L42.3 35.5M36.6 28.5L41.3 28.6M37.4 21.7L40.6 21.9\"/><path opacity=\"0.45\" stroke-width=\"1\" d=\"M35.7 35.5L41.2 28.5M42.3 35.4L36.7 28.6M36.7 28.6L40.5 21.8M41.3 28.6L37.5 21.7\"/><path d=\"M39 15L39.1 9.3\"/><path class=\"cz-fill\" d=\"M40.2 6.7Q39.8 6.2 39.2 6Q38.6 5.8 38 6.3Q37.5 6.8 37.4 7.5Q37.3 8.1 37.7 8.6Q38.2 9 38.8 9.1Q39.4 9.2 39.9 8.8Q40.5 8.5 40.6 7.9Q40.7 7.3 40.2 6.7z\"/><path d=\"M62 5.9Q60.4 6.6 60 8.4Q59.5 10.1 60.6 11.5Q61.7 12.8 63.5 12.7Q65.2 12.5 64.1 11.7Q62.9 10.9 62.5 9.4Q62.2 7.9 62.9 6.5Q63.6 5.2 63.6 5.2Q63.6 5.2 62 5.9z\"/><path opacity=\"0.5\" stroke-width=\"1.1\" d=\"M4.6 4.5Q9.9 7.4 13.5 7.8Q17.1 8.1 20.5 7.6Q24 7.1 27 5.6L29.9 4.1\"/><path class=\"cz-fill\" stroke-width=\"1\" d=\"M10.1 8Q9.8 7.6 9.3 7.6Q8.9 7.6 8.6 8Q8.3 8.4 8.4 8.8Q8.5 9.3 9 9.5Q9.4 9.7 9.8 9.5Q10.2 9.3 10.3 8.8Q10.3 8.3 10.1 8z\"/><path class=\"cz-fill\" stroke-width=\"1\" d=\"M15.1 9.2Q14.8 8.8 14.3 8.9Q13.9 8.9 13.6 9.2Q13.4 9.6 13.4 10.1Q13.5 10.5 14 10.6Q14.4 10.8 14.8 10.6Q15.3 10.5 15.3 10Q15.4 9.5 15.1 9.2z\"/><path class=\"cz-fill\" stroke-width=\"1\" d=\"M20.5 9.2Q20.2 8.8 19.7 8.8Q19.3 8.8 19 9.2Q18.8 9.7 18.9 10.1Q19 10.5 19.4 10.7Q19.9 10.8 20.3 10.6Q20.7 10.4 20.8 10Q20.9 9.6 20.5 9.2z\"/><path class=\"cz-fill\" stroke-width=\"1\" d=\"M25.7 7.8Q25.4 7.5 24.9 7.5Q24.5 7.5 24.2 7.9Q24 8.2 24.1 8.6Q24.1 9 24.6 9.2Q25 9.4 25.5 9.2Q25.9 9.1 26 8.6Q26 8.2 25.7 7.8z\"/><path d=\"M5.8 40.5Q20.9 40.6 28.5 40.7Q36.1 40.7 43.6 40.6Q51.1 40.5 58.7 40.6L66.4 40.7\"/>",
    arches:"<path opacity=\"0.5\" d=\"M5.1 38Q6.6 30.6 8.3 27.2Q10 23.8 12.4 20.8Q14.9 17.8 18 15.5Q21.1 13.2 24.7 11.8Q28.4 10.4 32.2 10Q36 9.5 39.9 9.9Q43.8 10.2 47.4 11.7Q51 13.3 54.1 15.5Q57.2 17.8 59.6 20.7Q62.1 23.7 63.7 27.2Q65.3 30.6 66.1 34.5L66.8 38.3\"/><path opacity=\"0.45\" d=\"M51.7 12.9L53.3 10.3M36.2 8.6L36.1 5.8M20.4 12.9L18.7 10.3\"/><path d=\"M16.3 40.4L16.7 22.4L26.5 22.4L26.4 40.5\"/><path class=\"cz-fill\" d=\"M14.5 22.9L21.4 10.5L28.4 22.7z\"/><path d=\"M19.7 33.5Q19.9 29.7 20.6 28.8Q21.4 28 22.2 28.8Q23 29.6 23.1 31.5L23.2 33.4\"/><path d=\"M21.7 10.6L21.3 6.5\"/><path d=\"M21.6 6.6L25.6 7.6L21.6 8.8z\"/><path d=\"M39.5 40.3L39.9 17.6L50.2 17.6L50.5 40.3\"/><path class=\"cz-soft\" d=\"M37.8 17.6L45.1 5.2L52.1 17.6z\"/><path d=\"M46.8 23.8Q46.1 23.1 45.3 22.9Q44.5 22.8 43.6 23.3Q42.8 23.9 42.7 24.8Q42.7 25.8 43.2 26.6Q43.7 27.5 44.6 27.5Q45.5 27.6 46.3 27.1Q47.1 26.6 47.3 25.5Q47.5 24.5 46.8 23.8z\"/><path opacity=\"0.7\" d=\"M45 25.2L45 23.6M45.1 25.3L46.2 25.8\"/><path d=\"M26.7 28.3L39.7 28\"/><path d=\"M26.6 32.2Q30 32.2 31.6 33.2Q33.2 34.3 34.6 33.2Q36.1 32.1 37.9 32L39.7 31.9\"/><path opacity=\"0.6\" d=\"M29.4 28.1L29.3 26.1M33.1 28.1L33 26.2M36.8 28.2L36.9 26.1\"/><path d=\"M58.1 37.5L58.2 28.3L64.1 37.1z\"/><path d=\"M55.6 37.9L66 37.7L64.4 40.3L57.1 40.5z\"/><path d=\"M5.8 40.6Q20.9 40.2 28.4 40.5Q36 40.7 43.6 40.7Q51.2 40.6 58.8 40.8L66.4 41\"/><path opacity=\"0.45\" d=\"M9.2 44.1L18.8 43.8M30.2 44.4L43.2 44.3M52.2 44.4L61 44\"/>",
    factory:"<path opacity=\"0.5\" d=\"M6.1 30.1Q6 16.1 6.1 16.2Q6.2 16.2 6.7 14.6Q7.2 13 8.5 12.1Q9.8 11.2 11.4 11.3Q12.9 11.3 14.1 12.1Q15.3 12.9 15.7 14.5Q16.1 16.1 16.2 23L16.2 30\"/><path opacity=\"0.5\" d=\"M52.8 30.2Q52.8 15.2 52.7 15.1Q52.7 15.1 53.4 13.3Q54 11.6 55.4 10.6Q56.7 9.7 58.4 9.7Q60 9.7 61.5 10.7Q63.1 11.7 63.5 13.4Q63.9 15.1 64 22.6L64.1 30.1\"/><path opacity=\"0.32\" stroke-width=\"1\" d=\"M11.1 12.2L11.3 30.2M6.6 20.9L15.8 21.2M58.2 10.6L58.4 30M52.8 20.2L63.6 20\"/><path class=\"cz-soft\" d=\"M5 38.8L5.1 27.6L15.7 27.1L15.8 38.7\"/><path d=\"M4.9 38.7L5.2 27.3L15.7 27L15.7 38.5\"/><path class=\"cz-soft\" d=\"M17.1 38.6L17.2 26.5L26.4 26.4L26.7 38.6\"/><path d=\"M16.8 38.5L17.1 26.5L26.6 26L26.7 38.5\"/><path opacity=\"0.45\" d=\"M7.3 30.9L13.4 30.7M19.2 30.5L24.2 30.6M7.5 34.5L13.4 34.6M19.3 34.5L24.1 34.4\"/><path class=\"cz-fill\" d=\"M49.3 18.8Q47.5 16.5 45 16.1Q42.5 15.6 40.6 16.3Q38.8 17.1 37.4 19.5Q36 22 36.9 24.6Q37.7 27.3 39.8 28.7Q42 30.2 44.2 29.5Q46.4 28.9 48.3 27.2Q50.2 25.6 50.7 23.3Q51.1 21.1 49.3 18.8z\"/><path opacity=\"0.7\" stroke-width=\"1\" d=\"M40.6 20Q43.6 22.6 43 24.3L42.4 26M45.4 18.2Q46.4 21.8 47.7 22.6L49 23.4\"/><path class=\"cz-soft\" d=\"M27.6 38.5L28.2 30.4L33.6 28.8L52.5 29.8L58.7 31.6L59 38.8\"/><path d=\"M27.6 38.8L28.1 30.5L33.5 28.8L52.3 29.5L58.7 31.6L58.8 38.5\"/><path class=\"cz-soft\" d=\"M35.1 28.7L33.1 22.4L34.5 17.6L38.5 15.4L36.7 11.8L31.1 14.7L28 22.3L29.6 30.2z\"/><path d=\"M35.1 28.8L33.1 22.6L34.4 17.5L38.6 15.4L36.7 11.8L30.9 14.9L28 22.4L29.6 30z\"/><path class=\"cz-soft\" d=\"M57.2 31.2L58.9 23.1L56 14.9L50.6 11.7L48.3 15L52 17.8L53.9 22.9L51.8 29.8z\"/><path d=\"M57 31L58.9 23L55.7 15L50.5 11.5L48.4 14.8L52.3 17.6L53.8 23L51.9 29.6z\"/><path opacity=\"0.55\" stroke-width=\"1\" d=\"M30.9 23.4L35.4 22.8M33.5 17.7L36.8 19.3M52.2 23.3L56.3 24.6M51.2 17.8L54.5 16.8\"/><path opacity=\"0.7\" stroke-width=\"1.6\" d=\"M43.3 4L43.6 6.4M43.6 8.1L43.8 10.6M43.6 11.9L43.5 14.3\"/><path d=\"M4 38.9Q36.1 38.4 52 38.6L68 38.7\"/><path opacity=\"0.4\" d=\"M8 42.4L20.2 42.1M30 42.7L43.8 42.6M51.8 42.3L62.1 42.2\"/>",
    forest:"<path d=\"M13.8 5.7Q13.1 21.9 12.3 27.9Q11.5 33.9 10.1 38.1L8.7 42.2\"/><path d=\"M23.7 5.5Q23.9 22.1 24.6 28.1Q25.2 34.1 26.9 38.1L28.6 42.2\"/><path d=\"M46.5 5.6Q46 21.9 45.5 27.9Q44.9 33.8 43.4 37.9L42 42.1\"/><path d=\"M58.6 5.8Q58.8 21.9 59.3 28Q59.9 34.1 61.6 38.2L63.3 42.3\"/><path d=\"M11.4 18.5Q18.7 20.5 22.3 19.5L25.9 18.5\"/><path opacity=\"0.6\" d=\"M11.8 21.1Q18.6 22.9 22.2 21.8L25.7 20.7\"/><path opacity=\"0.4\" d=\"M16.9 9.2L17.5 16.2M20.2 25L20.2 32.8M16.2 27.9L16.4 37M50.8 9L50.5 18.1M54.8 19.9L55.1 31M49.7 27.2L49.6 36.9\"/><path class=\"cz-fill\" d=\"M28.5 30.3Q28.9 28.7 30 27.5Q31 26.3 32.4 25.5Q33.7 24.6 35.4 24.7Q37 24.7 38.5 25.4Q40 26.1 40.9 27.3Q41.8 28.6 42.2 30.2Q42.5 31.9 35.3 31.9Q28.2 31.9 28.5 30.3z\"/><path d=\"M34 32.2L34.1 41.9M37.1 32.2L36.7 41.8\"/><path opacity=\"0.6\" d=\"M35.5 5.7L35.6 12.7\"/><path class=\"cz-fill\" d=\"M37.2 13.6Q36.6 12.9 35.6 13Q34.6 13 34 13.8Q33.4 14.6 33.7 15.6Q34 16.5 34.9 16.9Q35.8 17.2 36.6 16.8Q37.4 16.3 37.6 15.3Q37.8 14.3 37.2 13.6z\"/><path opacity=\"0.3\" d=\"M4.5 11.8L8.9 5.4M62.4 12.8L66.2 7.2\"/><path d=\"M5.4 42.4Q19.9 41.8 28 42.1Q36.1 42.4 44.2 42.1Q52.3 41.8 59.2 42.2L66.1 42.5\"/>"
  }),
  time:Object.freeze({now:"<path class=\"cz-soft\" d=\"M48 16.7Q46.1 13.4 42.8 11.7Q39.5 9.9 36 9.8Q32.5 9.6 29.2 11.6Q26 13.5 24 17Q22 20.4 21.9 24Q21.8 27.6 23.7 31Q25.6 34.4 28.8 36.4Q32 38.4 35.9 38.3Q39.9 38.2 43 36.3Q46.2 34.5 48.1 31.1Q50.1 27.8 50 23.9Q49.8 20 48 16.7z\"/><path opacity=\"0.6\" d=\"M35.9 13L35.8 11.1M47.2 24.1L48.9 23.9M36 35.3L35.8 37.2M24.7 23.9L22.9 23.9\"/><path stroke-width=\"2\" d=\"M36.2 23.9L36 14.8\"/><path class=\"cz-accent\" d=\"M35.9 24.2L42.5 27.6\"/><path d=\"M36.8 23.2Q36.3 22.8 35.7 22.9Q35 23.1 34.9 23.7Q34.8 24.4 35.2 24.9Q35.6 25.3 36.3 25.1Q36.9 24.8 37 24.3Q37.2 23.7 36.8 23.2z\"/>",
    morning:"<path class=\"cz-fill\" d=\"M28.7 21.3Q27.8 19.7 26.2 19.1Q24.5 18.5 22.8 19Q21 19.5 19.7 20.8Q18.5 22.1 18.4 24.1Q18.4 26.1 19.3 27.6Q20.2 29 22 29.6Q23.8 30.3 25.6 29.9Q27.5 29.5 28.4 28.1Q29.4 26.7 29.5 24.9Q29.6 23 28.7 21.3z\"/><path opacity=\"0.75\" d=\"M16.4 19.9L13.8 18.6M21.3 16.3L20 13.5M26.8 16.1L28 13.4M31.6 20.3L34.4 18.4M15.7 26.1L12.5 26.5M32.3 25.9L35.7 26.3\"/><path d=\"M6.9 35.3Q20.9 34.9 28.4 35Q35.8 35.2 43.3 35.1Q50.7 35 57.9 35.2L65.2 35.5\"/><path opacity=\"0.6\" d=\"M42.1 35.1Q47.9 30.3 50.5 30.9Q53.1 31.6 55 30Q57 28.5 59.9 31.8L62.8 35.2\"/><path opacity=\"0.45\" d=\"M12 39.4L26.2 39.1M31.8 39.7L38 39.3\"/>",
    noon:"<path class=\"cz-fill\" d=\"M41.5 13.5Q40.3 11.7 38.4 10.7Q36.4 9.8 34.2 10.6Q32 11.4 30.7 12.8Q29.4 14.3 29.3 16.7Q29.1 19 30.5 20.6Q31.9 22.2 33.9 23Q35.9 23.8 37.9 23.4Q39.9 23.1 41.1 21.2Q42.3 19.4 42.5 17.4Q42.7 15.3 41.5 13.5z\"/><path opacity=\"0.75\" d=\"M35.8 7.2L36.1 4M43 10.1L45 8M45.4 16.9L48.9 17.2M42.7 23.8L44.8 26.1M29.3 10.4L27.1 8M26.6 16.9L23.2 16.9M29.2 24L27.1 26.1M35.9 26.7L36 30\"/><path d=\"M6.9 39.1Q20.9 38.9 28.4 39.3Q35.9 39.6 43.5 39.2Q51.2 38.8 58 39L64.7 39.2\"/><path opacity=\"0.45\" d=\"M13.9 42.6L24 42.8M46.1 42.8L58.1 42.4\"/>",
    sunset:"<path class=\"cz-fill\" d=\"M54.4 33.4Q53.8 30.4 52.8 29Q51.9 27.6 50.5 26.7Q49.1 25.8 47.6 25.4Q46.1 25 44.5 25.5Q42.8 26 41.4 26.8Q40 27.7 39.1 29Q38.3 30.3 37.9 31.9L37.5 33.5\"/><path d=\"M7.2 34.4Q20.7 34.3 28.5 34.3Q36.2 34.4 43.5 34.1Q50.8 33.9 57.8 33.9L64.8 34\"/><path opacity=\"0.6\" d=\"M55 27.1L57.6 25.7M45.8 22.4L46 19.6M37.2 27.1L34.5 25.4\"/><path class=\"cz-accent\" d=\"M37.9 37.7Q45.8 37.2 49.9 37.5L54 37.8M41.2 40.9L50.5 41\"/><path opacity=\"0.45\" d=\"M10 38.6L24 38.4M13.8 42.2L20.1 42\"/>",
    dusk:"<path d=\"M7.2 35.1Q20.9 35.2 28.3 35.4Q35.7 35.5 43.3 35.3Q51 35 58 35.3L65 35.6\"/><path opacity=\"0.45\" d=\"M57.2 33.2Q55.6 29.3 54 28Q52.4 26.7 50.1 26.2Q47.8 25.8 45.9 26.2Q43.9 26.6 42.3 28Q40.6 29.3 39.7 31.3L38.8 33.2\"/><path class=\"cz-accent\" opacity=\"0.7\" d=\"M52.9 34.3Q51.6 31.8 50.4 31.1Q49.3 30.3 47.9 30.4Q46.5 30.5 45.4 31.2Q44.3 31.8 43.6 33L43 34.2\"/><path class=\"cz-soft\" d=\"M23.7 10.8Q22.3 10.2 21 10.2Q19.7 10.3 18.5 10.9Q17.3 11.4 16.3 12.6Q15.4 13.7 15.1 15.1Q14.8 16.5 15.1 17.7Q15.3 19 16.3 20.2Q17.3 21.4 18.3 22Q19.4 22.6 20.9 22.6Q22.4 22.7 23.7 21.9Q25 21.1 23.9 21.1Q22.8 21.2 21.8 20.6Q20.8 20.1 20.3 19.2Q19.8 18.3 19.5 17.4Q19.2 16.5 19.4 15.5Q19.6 14.5 20.2 13.5Q20.8 12.5 21.7 12Q22.7 11.5 23.8 11.4Q25 11.3 23.7 10.8z\"/><path class=\"cz-accent\" d=\"M41.8 12.7L46.1 12.8M43.9 10.5L44.2 14.8\"/><path opacity=\"0.7\" d=\"M56.4 21L59.6 21.2M58.1 19.4L58.1 22.5\"/><path opacity=\"0.45\" d=\"M12.1 39.2L27.9 39.2M40.1 39.6L56.2 39.4\"/>",
    night:"<path class=\"cz-fill\" d=\"M32.9 11.6Q31.2 10.7 29 10.6Q26.9 10.5 25 11.5Q23.1 12.5 21.8 14.2Q20.5 16 20 17.9Q19.5 19.9 19.9 21.9Q20.3 23.9 21.6 25.7Q23 27.5 24.9 28.4Q26.8 29.2 28.9 29.4Q30.9 29.5 33 28.5Q35.1 27.6 33.3 27.5Q31.5 27.5 30.2 26.5Q28.9 25.6 27.9 24.4Q26.8 23.2 26.4 21.5Q25.9 19.8 26.4 18.3Q26.8 16.7 27.7 15.5Q28.7 14.2 30.2 13.4Q31.6 12.6 33.2 12.6Q34.7 12.6 32.9 11.6z\"/><path class=\"cz-accent\" d=\"M47.5 11.7L52.6 11.5M50.1 9.1L50.2 14.1\"/><path opacity=\"0.75\" d=\"M57 25L60.1 25.1M58.6 23.3L58.8 26.6M44.3 30.6L47.4 30.6M46.2 28.9L45.8 32.1M11.7 11.8L14.7 11.8M12.9 10.5L12.9 13.6\"/><path opacity=\"0.6\" d=\"M7 40.5Q21.2 40 28.5 40.1Q35.8 40.3 43.5 40.2Q51.2 40.1 58.1 40.3L65 40.5\"/><path opacity=\"0.4\" d=\"M20.1 43.4L31.8 43.3M41.8 43.2L49.8 43.4\"/>"})});
 // their values, in the record's own (reserve:train-preview: its day, '' today or 0-6; its hour). (4.2.2: the deep sea, once Thursday's in odd weeks, is gone)
 const MP_LANDS=Object.freeze([['','Today','today'],['1','Mirror sea','mirror'],['2','Rain village','rain'],['3','Above the clouds','clouds'],['4','Canal street','canal'],['5','City of arches','arches'],['6','Factory','factory'],['0','Forest of giants','forest']]);
 const MP_TIMES=Object.freeze([['','Now','now'],['8','Morning','morning'],['12.5','Noon','noon'],['17','Sunset','sunset'],['21','Dusk','dusk'],['1','Night','night']]);
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
  const allowedTabs=tabs(),
    asked=ALIASES[c.customizeTab]||c.customizeTab||'look',
    tab=allowedTabs.some(([key])=>key===asked)?asked:allowedTabs.some(([key])=>key==='look')?'look':allowedTabs[0][0],
    on=key=>tab===key;
  const button=(action,label,extra='',cls='rd-button')=>`<button type="button" class="${cls}" data-rd-action="${action}" ${extra}>${label}</button>`;
  // A set of picture choices: [value, name, line, drawing, locked]. Choices are a drawing and a name; the line shows only on a locked choice (its level).
  // The tiles are the choice; Advanced tunes one kind of detail at a time, and a tile sets them all back.
  const graphicsAdvanced=()=>{
    const plan=s.graphicsPlan||{},
      rows=[
        ['film','Moving drawings',[['full','Full'],['calm','Calm'],['slow','Slow'],['off','Off']]],
        ['life','Room life',[['full','Full'],['some','Some'],['off','Off']]],
        ['frames','Course frames',[['full','Moving'],['still','Still'],['off','Plain']]],
        ['rooms','Room detail',[['full','Full'],['most','Most'],['simple','Simple']]],
        ['panorama','Banner drawing',[['on','On'],['off','Off']]],
        ['cards','Framed course cards',[['on','On'],['off','Off']]]
      ];
    return `<details class="cz-advanced" data-rd-section="graphics-advanced"><summary>Advanced</summary><div class="cz-advanced-rows">${rows.map(([key,name,options])=>`<label class="rd-field"><span>${E(name)}</span><select data-rd-field="graphics-detail" data-detail="${key}" aria-label="${E(name)}">${options.map(([v,label])=>`<option value="${v}"${plan[key]===v?' selected':''}>${E(label)}</option>`).join('')}</select></label>`).join('')}</div></details>`;
  };
  const choices=(key,title,options,{value=s[key],cols=3,field='setting',data='setting',className=''}={})=>
    settingEnabled(key)?`<div class="cz-choices${className?' '+E(className):''}" role="radiogroup" aria-label="${E(title)}" data-cols="${cols}" style="--cz-cols:${cols}">${options.map(o=>o&&o.head?`<h4 class="cz-subhead cz-choice-head">${E(o.head)}</h4>`:o).map(o=>typeof o==='string'?o:(([v,name,hint,art,locked])=>`<label class="cz-choice"${locked?' data-locked="true"':''}><input type="radio" name="cz-${key}" data-rd-field="${field}" data-${data}="${key}" value="${E(v)}" ${v===value?'checked':''} ${locked?'disabled':''}><span class="cz-choice-art">${art||''}</span><strong>${E(name)}</strong>${hint&&locked?`<small>${E(hint)}</small>`:''}</label>`)(o)).join('')}</div>`:'';
  // A switch is its name; `warn` keeps a line that protects the student (shared computers).
  const toggle=(key,name,hint,{checked=s[key]!==false,field='setting',data='setting',warn=false}={})=>
    settingEnabled(key)?`<label class="cz-toggle"><span><strong>${E(name)}</strong>${warn&&hint?`<small>${E(hint)}</small>`:''}</span><input type="checkbox" role="switch" data-rd-field="${field}" data-${data}="${key}" ${checked?'checked':''}><i aria-hidden="true"></i></label>`:'';
 const group=(title,hint,body)=>{
   const feature={'Start from a layout':'arrange','Modules on Home':'planner','Canvas\u2019s menu bar':'canvas-nav','Where your courses are':'arrange','Course size':'arrange','Course dock':'arrange','Order of the three panels':'arrange',Banner:'course-art','Artwork at night':'course-art','Module outline':'planner','Course cards':'course-art',Motion:'motion'}[title];
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
   +group('Where your courses are','',choices('courseNavigation','Course navigation',[['sidebar','Down the side','A list that stays beside the page.',ART.sidebar],['topbar','Across the top','A strip of cards; more room for the page.',ART.topbar],['dock','At the bottom','A dock of courses at the bottom of the page.',ART.dock]]))
   // The course dock (3.7): the same controls as its own card (right-click the dock).
   +(s.courseNavigation==='dock'?group('Course dock','',`<label class="cz-slider"><span>Size</span><input type="range" min="0.7" max="1.5" step="0.05" value="${E(String(Number(s.dockScale)||1))}" data-rd-field="setting" data-setting="dockScale"></label>`+'<h4 class="cz-subhead">Shelf</h4>'+choices('dockShelf','Shelf',[['kraft','Kraft','','<svg viewBox="0 0 64 30" width="64" height="30" aria-hidden="true"><path d="M7 11h50v12H7z" fill="#D4A27F" transform="translate(1 1.2)"/><path d="M6.8 10.6c16.6-.4 33.6-.4 50.4 0 .3 4.2.3 8.4 0 12.6-16.8.4-33.8.4-50.4 0-.3-4.2-.3-8.4 0-12.6z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M14 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M25 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M36 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M47 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>'],
      ['paper','Paper','','<svg viewBox="0 0 64 30" width="64" height="30" aria-hidden="true"><path d="M7 11h50v12H7z" fill="#FFFDF8" transform="translate(1 1.2)"/><path d="M6.8 10.6c16.6-.4 33.6-.4 50.4 0 .3 4.2.3 8.4 0 12.6-16.8.4-33.8.4-50.4 0-.3-4.2-.3-8.4 0-12.6z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M14 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M25 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M36 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M47 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>'],
      ['none','None','','<svg viewBox="0 0 64 30" width="64" height="30" aria-hidden="true"><path d="M6.8 23.2c16.6-.4 33.6-.4 50.4 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M14 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M25 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M36 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M47 13.6c2.4-.1 4.8-.1 7.2 0 .1 2.2.1 4.4 0 6.6-2.4.1-4.8.1-7.2 0-.1-2.2-.1-4.4 0-6.6z" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>']])
      +'<h4 class="cz-subhead">Cards</h4>'+choices('dockStyle','Look',[['tiles','Icons','','<svg viewBox="0 0 64 30" width="64" height="30" aria-hidden="true"><path d="M8 10h10v10H8z" fill="#C9D6DF" transform="translate(1 1)"/><path d="M8 9.8c3.4-.2 6.8-.2 10 0 .2 3.4.2 6.8 0 10.2-3.4.2-6.8.2-10 0-.2-3.4-.2-6.8 0-10.2z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M22 10h10v10H22z" fill="#C9D6DF" transform="translate(1 1)"/><path d="M22 9.8c3.4-.2 6.8-.2 10 0 .2 3.4.2 6.8 0 10.2-3.4.2-6.8.2-10 0-.2-3.4-.2-6.8 0-10.2z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M36 10h10v10H36z" fill="#C9D6DF" transform="translate(1 1)"/><path d="M36 9.8c3.4-.2 6.8-.2 10 0 .2 3.4.2 6.8 0 10.2-3.4.2-6.8.2-10 0-.2-3.4-.2-6.8 0-10.2z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M50 10h10v10H50z" fill="#C9D6DF" transform="translate(1 1)"/><path d="M50 9.8c3.4-.2 6.8-.2 10 0 .2 3.4.2 6.8 0 10.2-3.4.2-6.8.2-10 0-.2-3.4-.2-6.8 0-10.2z" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>'],
      ['cards','Cards','','<svg viewBox="0 0 64 30" width="64" height="30" aria-hidden="true"><path d="M6 8h15v14H6z" fill="#EBDBBC" transform="translate(1 1)"/><path d="M6 7.8c5-.2 10-.2 15 0 .2 4.8.2 9.6 0 14.4-5 .2-10 .2-15 0-.2-4.8-.2-9.6 0-14.4zM9 12h8M9 16h6" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M24 8h15v14H24z" fill="#EBDBBC" transform="translate(1 1)"/><path d="M24 7.8c5-.2 10-.2 15 0 .2 4.8.2 9.6 0 14.4-5 .2-10 .2-15 0-.2-4.8-.2-9.6 0-14.4zM27 12h8M27 16h6" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M42 8h15v14H42z" fill="#EBDBBC" transform="translate(1 1)"/><path d="M42 7.8c5-.2 10-.2 15 0 .2 4.8.2 9.6 0 14.4-5 .2-10 .2-15 0-.2-4.8-.2-9.6 0-14.4zM45 12h8M45 16h6" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>']],{cols:2})
      +`<div class="cz-toggles">${toggle('dockNamesAlways','Names always','',{checked:s.dockNamesAlways===true})}${toggle('dockCounts','Counts','',{checked:s.dockCounts!==false})}${toggle('dockLively','Lively','',{checked:s.dockLively!==false})}${toggle('dockHide','Hide until near','',{checked:s.dockHide===true})}</div>`):'')
   +group('Spacing','',choices('density','Spacing',[['comfortable','Roomy','More air between rows.',ART.comfortable],['compact','Compact','More rows on the screen.',ART.dense]],{cols:2}))
   +group('What shows','',`<div class="cz-toggles">${toggle('showCourseStrip','Course list','The courses beside, above or below the page.')}${toggle('showCourseIcons','Course drawings','The small drawing on each course.')}${toggle('showDeadlinePreview','Next deadlines on courses','What is due next, under each course name.')}${toggle('showBookmarks','Bookmarks shelf','The row of bookmarks under the heading.')}${toggle('showCourseInformation','Course information','Announcements, messages and the teacher’s page.')}${toggle('showRecentGrades','Recent scored work','Shown only while Show grades is on.')}${toggle('greeting','Greeting','“Good morning” on All courses, instead of a plain title.',{checked:s.greeting!=='off'}).replace('data-setting="greeting"','data-setting="greeting" data-onoff="true"')}${toggle('quickOpen','Open at once','Leave this off on a shared computer.',{checked:s.quickOpen==='on',warn:true}).replace('data-setting="quickOpen"','data-setting="quickOpen" data-onoff="true"')}</div>`)
   +group('Saved layouts & plans','',picker({kinds:['preset'],presetKinds:['layout','planner'],label:'Saved layouts and plans'}));
  };
  // Canvas's menu bar, on Settings: it changes every Canvas page, not Home.
  const canvasMenu=()=>{
    const ART=artDiagrams();
    return group(
      'Canvas’s menu bar',
      '',
      choices(
        'canvasNav',
        'Canvas menu bar',
        [['drawn','From the left edge','Hidden until you point at the edge; moves the page aside.',ART.navEdge],['shown','Full height','Always there, down the left side.',ART.navColumn],['top','Across the top','In the toolbar’s free space, or a strip.',ART.navTop],['original','Canvas’s own','Canvas’s dark bar, as Canvas draws it.',ART.navOriginal]],
        {value:c.canvasNav||'drawn',cols:2,field:'canvas-nav'}));
  };
  // Your own banner, in Look (it was only in Courses > Course artwork > Banner): a picture, GIF or short video for the banner
  // of every course (the theme artwork: a course's own banner still wins). Framing and every other banner choice stay in
  // Courses, one press away (Adjust).
  const ownBanner=()=>{
   if(!enabled('course-art')||!enabled('customization'))return '';
   const value=s.themeArt?.bannerArt,asset=value?(root.ReserveMediaFrame?.asset?.(value)||value.asset||value):null,busy=c.customizeBusy?' disabled':'';
   const art=root.ReserveAddonsArt?.icons?.art||'';
   return `<div class="cz-own-banner" role="group" aria-label="Your own banner"><label class="rd-button ch-upload cz-own-pick">${art?`<span class="cz-own-art" aria-hidden="true">${art}</span>`:''}<strong>${asset?'Replace your banner':'Your own banner'}</strong><input type="file" accept="image/svg+xml,.svg,image/png,image/jpeg,image/webp,image/avif,image/gif,video/mp4,video/webm,.png,.jpg,.jpeg,.webp,.avif,.gif,.mp4,.webm" data-rd-field="art-upload" data-kind="banner" data-id="theme" aria-label="Use your own banner on every course"${busy}></label>${button('art-clipboard','Paste','data-id="theme" data-kind="banner" aria-label="Paste your own banner"'+busy)}${asset?button('customize-tab','Adjust','data-value="courses" data-course="theme" data-slot="banner" aria-label="Adjust your own banner"','rd-text-button')+button('art-remove','Use default','data-id="theme" data-kind="banner" aria-label="Remove your own banner"'+busy,'rd-text-button'):''}</div>`;
  };
  const bannerGroup=()=>{
    const ART=artDiagrams();
    return group(
      'Banner',
      'The drawing across the top of each course.',
      ownBanner()+choices('bannerSize','Banner size',[['compact','Small','',ART.compact],['standard','Medium','',ART.standard],['large','Tall','',ART.large]]));
  };

  const look=only=>{
   const ART=artDiagrams();
  const swatch=(bg,line,ink)=>`<svg viewBox="0 0 72 48" width="72" height="48" aria-hidden="true"><rect x="3" y="4" width="66" height="40" rx="5" fill="${bg}" stroke="${line}" stroke-width="1.5"/><path d="M10 14h30M10 22h44M10 30h36" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  const letters=family=>`<span class="cz-letters" style="font-family:${family}">Aa</span>`;
  // With a theme or scene the pick lives in its palette for this mode (light or dark colour, dashboard.js saveAppearance)
  const accentButtons=()=>{
    const owned=ownedPalette&&String(layer.colors?.[ownedMode]?.accent||'').toLowerCase();
    return [['clay','Clay','#A9522F','#E08A6A'],['forest','Forest','#367964','#9bd1b4'],['indigo','Iris','#5f5ccc','#bec8ff'],['rose','Rose','#9e4c6c','#efb0c0'],['ocean','Ocean','#2f7185','#a3d4e5'],['amber','Amber','#956821','#e8c68b']].map(([key,name,color,dark])=>
      button('accent',`<i aria-hidden="true" style="background:${color}"></i><span>${name}</span>`,`data-accent="${key}" aria-label="${name} accent" title="${name} accent" aria-pressed="${ownedPalette?[color,dark].some(c=>c.toLowerCase()===owned):s.accent===key}"`,'rd-swatch ch-accent-choice')).join('');
  };
  const frames=()=>
    (enabled('planner')?root.ReserveWidgets?.FRAMES||[]:[]).map(([value,name,hint])=>
      button('board-frame',`<i data-frame="${value}"></i>${E(name)}`,`role="radio" data-value="${value}" aria-checked="${!(ownTheme?.frames?.panel||sceneActive)||layer.parts?.frames===false||layer.parts?.panel===false?(s.panelFrame||'pen')===value:false}" title="${E(hint)}"`,'rd-frame-choice')).join('');

  const night=Math.max(0,Math.min(100,Math.round(Number(s.nightArt)||0))),
    sceneActive=enabled('scene-themes')&&['starry','sea','stars','blueprint','maple','thanksgiving','christmas','train'].includes(s.sceneTheme),
    installedScene=(c.makeOwn?.catalogue||[]).find(row=>
      row.kind==='feature'&&row.sceneTheme!==undefined&&(root.ReservePacks?.isCurrent?root.ReservePacks.isCurrent(row,{settings:s}):row.current));
  const ownTheme=!sceneActive&&s.makeYourOwn?.theme?c.makeOwn?.theme:null,
    ownedPalette=sceneActive||!!s.makeYourOwn?.theme,
    ownerName=s.makeYourOwn?.theme?.name||
      installedScene?.name||
      ({starry:'Starry Night',sea:'Under the Sea',stars:'Starfield',blueprint:'Blueprint',maple:'Maple Wind',thanksgiving:'Thanksgiving',christmas:'Christmas',train:'Soul Passage'})[s.sceneTheme]||
      'The selected theme',
    // (the look the dashboard saves into, dashboard.js lookSelection: an own theme's pack, else the scene's built-in key)
    look=root.ReserveMakeYourOwn?.activeLook?.(c.makeOwn,s)||(key=>({key,layer:key?s.makeYourOwn?.adjustments?.[key]||{}:{}}))(
     !s.sceneTheme&&s.makeYourOwn?.theme?.id?'pack:'+s.makeYourOwn.theme.id:s.sceneTheme?'builtin:scene:'+s.sceneTheme:null),
    layer=look.layer||{};
  const ownedMode=ownTheme&&!ownTheme.colors?.[s.theme==='dark'?'dark':'light']&&!layer.colors?.[s.theme==='dark'?'dark':'light']?(ownTheme.colors?.light?'light':'dark'):s.theme==='dark'?'dark':'light',
    modeArt=(mode,bg,line,ink)=>
      swatch(layer.colors?.[mode]?.bg||ownTheme?.colors?.[mode]?.bg||bg,ownTheme?.colors?.[mode]?.line||line,ownTheme?.colors?.[mode]?.ink||ink);
  const sceneColors=({
    starry:{bg:'#141b3d',accent:'#f2c94c'},
    sea:{bg:'#05345e',accent:'#7fe6f2'},
    stars:{bg:'#04060c',accent:'#a9c2ff'},
    blueprint:{bg:'#174a88',accent:'#cfe6ff'},
    maple:{bg:'#FBF3E4',accent:'#B9432A'},
    thanksgiving:{bg:'#F7EFDF',accent:'#8A2433'},
    christmas:{bg:'#EEF3FB',accent:'#B4283A'},
    train:{bg:'#F7EEE6',accent:'#2F7F86',dark:{bg:'#1A1C4A',accent:'#FFB870'}}
  })[s.sceneTheme];
  const colorFields=key=>`<div class="cz-pair">${['light','dark'].map(mode=>{
    // a colour box takes only #rrggbb: a saved Page colour name ("paper", "accent") falls back to the scene's or the default colour
    const hex=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:'';
    const p=ownTheme?.colors?.[mode]||(mode==='dark'&&sceneColors?.dark)||sceneColors||{},value=hex(layer.colors?.[mode]?.[key])||hex(p[key])||(key==='accent'?'#a9522f':mode==='dark'?'#1f1e1d':'#faf9f5');
    return `<label class="rd-field"><span>${mode==='light'?'Light':'Dark'}</span><input type="color" data-rd-field="make-color" data-id="${E(look.key)}" data-mode="${mode}" data-color="${key}" value="${E(value)}" aria-label="${mode==='light'?'Light':'Dark'} ${key==='bg'?'page':'accent'} color"${c.makeOwn?.busy?' disabled':''}></label>`;
  }).join('')}</div>`;
  const part=(key,name)=>`<label class="cz-toggle"><span>${E(name)}</span><input type="checkbox" role="switch" data-rd-field="make-part" data-id="${E(look.key)}" data-part="${key}"${layer.parts?.[key]!==false?' checked':''}${c.makeOwn?.busy?' disabled':''}><i aria-hidden="true"></i></label>`;
  // Soul Passage is a megapack (4.2): c.megapack is the worker's answer to megapack-state (dashboard.js), with the speed stop
  // the theme keeps (reserve:train-pace). Not asked yet, or no extension runtime: as any scene.
  const mega=c.megapack&&typeof c.megapack==='object'?c.megapack:null,
    megaPace=Number.isInteger(mega?.pace)&&mega.pace>=0&&mega.pace<=3?mega.pace:2,
    trainWorn=sceneActive&&s.sceneTheme==='train'&&!installedScene&&!!mega&&!['none','failed','getting'].includes(mega.state);
  const megaLand=MP_LANDS.some(([v])=>v===mega?.land)?mega.land:'',megaTime=MP_TIMES.some(([v])=>v===mega?.time)?mega.time:'';
  // its Adjust (D5): three groups of drawn choices in the picker's own form (Graphics is the model): the speed the lever on the laptop
  // in the room sets, the land that rides past and the light (the scene's own record of them, reserve:train-preview; Today
  // and Now follow the clock). Its Reset puts back Cruise, Today and Now as well as the parts.
  const adjust=()=>{
   const busy=!!mega?.busy,
     opt=(value,name,art)=>[value,name,'',svg(art),busy],
     block=(key,title,options,value,cols)=>`<h4 class="cz-subhead">${title}</h4>`+choices(key,title,options,{value,cols,field:'megapack-adjust',data:'adjust',className:'cz-mega-adjust'});
   return block('pace','Speed',['Stopped','Slow','Cruise','Fast'].map((name,i)=>opt(String(i),name,MP_ADJUST.speed[i])),String(megaPace),4)
    +block('land','Land',MP_LANDS.map(([value,name,art])=>opt(value,name,MP_ADJUST.land[art])),megaLand,3)
    +block('time','Time',MP_TIMES.map(([value,name,art])=>opt(value,name,MP_ADJUST.time[art])),megaTime,3);
  };
  const parts=()=>look.key?group('Use from '+ownerName,'',`<div class="cz-toggles">${[['background','Background'],['banner','Banner'],['frames','Frames'],['panel','Module frames'],['card','Course frames'],['title','Title font'],['icons','Icons']].map(([key,label])=>part(key,label)).join('')}</div>${trainWorn?adjust():''}${button('make-reset','Reset to how it came',`data-id="${E(look.key)}"`,'rd-text-button')}`):'';
  const themeFrame=kind=>{
    const asset=ownTheme?.assets?.[ownTheme.frames?.[kind]?.asset];
    return asset?.svg&&layer.parts?.frames!==false&&layer.parts?.[kind]!==false?`<span class="cz-choice-art"><img src="data:image/svg+xml;charset=utf-8,${E(encodeURIComponent(asset.still||asset.svg))}" alt="${E(ownerName)} ${kind} frame" width="96" height="64"></span>`:'';
  };
  // No page-relative URLs: a browserless preview keeps the plain illustration.
  const poster=scene=>root.chrome?.runtime?.getURL?`<img class="cz-scene-poster" src="${E(root.chrome.runtime.getURL(`themes/${scene}/poster.jpg`))}" alt="" aria-hidden="true" width="160" height="90" loading="lazy">`:ART.still;
  const sceneValue=s.makeYourOwn?.theme?'own:'+s.makeYourOwn.theme.id:installedScene?'installed:'+installedScene.id:s.sceneTheme;
  // Soul Passage's choice, by where its files are. Not on this computer (or the last download failed): a button, the poster
  // dimmed, the tag at its top right; a press starts the download (megapack-get) and opens the Market at its card. Coming
  // down: the filling line on a paper strip along the poster's foot; pressing again does nothing; its name carries the
  // number (the line itself is not read out). Here: an ordinary choice; it carries Reset once it was changed and Remove
  // once its files were downloaded (none while the package holds them).
  // (Reset puts the speed back to Cruise, as "Reset to how it came" does)
  const megaKey=trainWorn&&look.key?look.key:'builtin:scene:train',off=mega?.busy?' disabled':'';
  const megaReset=`<button type="button" class="rd-text-button ch-make-chip" data-rd-action="make-reset" data-id="${E(megaKey)}" aria-label="Reset Soul Passage"${off}><i class="ch-make-chip-ic" data-ic="undo" aria-hidden="true"></i>Reset</button>`;
  const megaRemove=`<button type="button" class="rd-text-button ch-make-chip" data-rd-action="megapack-remove" aria-label="Remove Soul Passage"${off}><i class="ch-make-chip-ic" data-ic="remove" aria-hidden="true"></i>Remove</button>`;
  const megaChoice=()=>{
   const at=!mega?.state||mega.state==='here'?'here':mega.state==='getting'?'getting':'none';
   if(at==='here'){
    const changed=megaPace!==2||megaLand!==''||megaTime!==''||Object.keys(s.makeYourOwn?.adjustments?.[megaKey]||{}).length>0,
      chips=(mega&&changed?megaReset:'')+(mega?.state==='here'&&!mega.bundled?megaRemove:'');
    if(!chips)return ['train','Soul Passage','',poster('train')];
    return `<div class="cz-choice cz-mega cz-mega-here" data-mp="here"><label class="cz-mega-pick"><input type="radio" name="cz-sceneTheme" data-rd-field="setting" data-setting="sceneTheme" value="train"${sceneValue==='train'?' checked':''}><span class="cz-choice-art">${poster('train')}</span><strong>Soul Passage</strong></label><span class="ch-make-actions">${chips}</span></div>`;
   }
   const p=at==='getting'&&mega.total>0?Math.max(0,Math.min(100,Math.floor(mega.done/mega.total*100))):0,busy=at==='getting'?' aria-disabled="true"'+(p===100?' data-mp-full':''):'';
   const art=at==='getting'?`<span class="cz-mega-line" aria-hidden="true"><span class="mp-line" style="--mp-p:${p}">${MP_ART.lineTrack}<span class="mp-done">${MP_ART.lineDone}</span></span></span>`:`<span class="cz-mega-mark" aria-hidden="true">${MP_ART.markGet}</span>`;
   return `<button type="button" class="cz-choice cz-mega" data-rd-action="megapack-get" data-mp="${at}"${busy} aria-label="Soul Passage, ${at==='getting'?p+' percent':'download'}"><span class="cz-choice-art">${poster('train')}${art}</span><strong>Soul Passage</strong></button>`;
  };
  const sceneChoices=()=>enabled('scene-themes')?group('Scene','',choices('sceneTheme','Scene',[
   ['','None','',swatch('#FAF9F5','#E8E6DC','#3D3D3A')],
   // sorted into packs (owner 2026-11-09: one long list was hard to find things in; "like holiday pack, seasonal pack"),
   // still one radio group; new holidays (Christmas, New Year...) join the Holiday pack
   {head:'Holiday pack'},
   ['thanksgiving','Thanksgiving','',poster('thanksgiving')],
   ['christmas','Christmas','',poster('christmas')],
   {head:'Seasonal pack'},
   ['maple','Maple Wind','',poster('maple')],
   {head:'Everyday pack'},
   ['starry','Starry Night','',poster('starry')],
   ['sea','Under the Sea','',poster('sea')],
   ['stars','Starfield','',poster('stars')],
   ['blueprint','Blueprint','',poster('blueprint')],
   // (4.2) Soul Passage, from the Market: a section of its own
   {head:'Megapack'},
   megaChoice()
   ],{value:sceneValue,cols:2,className:'cz-scenes'})+
   picker({kinds:['feature'],scenes:true,label:'Installed scenes',more:false})+
   picker({kinds:['theme'],label:'Installed themes'})+
   (s.makeYourOwn?.theme||sceneActive?button('make-clear','Use default theme','data-id="theme"','rd-text-button'):'')):
   group('Theme','',button('make-clear','Default theme',`data-id="theme" aria-pressed="${!s.makeYourOwn?.theme}"`,'rd-text-button')+picker({kinds:['theme'],label:'Installed themes'}));
    // Course card style lives on the Courses tab, but its frame comes from the theme worked out here.
    const cards=()=>
      group(
        'Course cards',
        '',
        themeFrame('card')+choices('courseCardStyle','Course frames',[['sketch','Hand-drawn','',ART.sketch],['rounded','Rounded','',ART.rounded],['minimal','Minimal','',ART.minimal]]));
    if(only==='cards')return cards();
    // Scenes: the scenes and installed themes, what to use from the one on, and the saved looks
    if(only==='scenes')return sceneChoices()+parts()+group('Saved looks','',picker({kinds:['preset'],presetKinds:['settings'],label:'Saved looks'}));
    return group(
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
   +group('Accent color','Buttons, links and highlights. Course drawings keep their own colors.',(ownedPalette?colorFields('accent'):'')+`<div class="ch-accent-actions cz-accents" role="group" aria-label="Accent color">${accentButtons()}</div>`)
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
           ['accent','Accent','',swatch('color-mix(in srgb,var(--rd-accent) 9%,#FDFDFC)','color-mix(in srgb,var(--rd-accent) 30%,#E7E7E4)','var(--rd-accent)')],
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
     group('Paper','',choices('surfaceStyle','Page style',[['paper','Warm paper','Ivory, soft lines.',swatch('#FAF9F5','#E8E6DC','#5E5D59')],['clean','Clean','Cool white, grey lines.',swatch('#F8FAFC','#D8DEE6','#566070')],['contrast','High contrast','Darker text and lines.',swatch('#FFFFFF','#555555','#111111')]])))
   +(enabled('course-art')?bannerGroup()+cards():'')
   +group('Module outline','How each module on Home is framed.',themeFrame('panel')+`<div class="cz-frames" role="radiogroup" aria-label="Module outline">${frames()}</div>`)
   // Type: three named rows (letters, size, reading text) on one grid, so the choices line up.
   +group('Type','',`<h4 class="cz-subhead">Letters</h4>`+choices('font','Interface type',[['system','Modern','',letters('"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif')],['humanist','Humanist','',letters('Calibri,Candara,"Segoe UI",sans-serif')],['serif','Bookish','',letters('Literata,Georgia,serif')]])
     +`<h4 class="cz-subhead">Size</h4>${choices('textSize','Text size',[['standard','Standard','',`<span class="cz-letters cz-small">Aa</span>`],['large','Larger','',`<span class="cz-letters">Aa</span>`]],{cols:3})}<h4 class="cz-subhead">Reading text</h4>${choices('readingFont','Reading text',[['book','Book serif','For teachers’ text.',letters('Literata,Georgia,serif')],['interface','Same as letters','',letters('inherit')],['easy','Easy read','',`<span class="cz-letters" style="font-family:Verdana,Tahoma,sans-serif;letter-spacing:.06em">Aa</span>`]],{cols:3})}`)
   +
   group(
     'Graphics',
     '',
     choices('graphics','Graphics',[['low','Low','',ART.gfxlow],['medium','Medium','',ART.gfxmedium],['high','High','',ART.gfxhigh],['xhigh','Extra high','',ART.gfxxhigh]],{cols:4})+graphicsAdvanced())
   +group('Motion','',(look.key?`<label class="rd-field"><span>${E(ownerName)} motion</span><select data-rd-field="make-motion" data-id="${E(look.key)}" aria-label="Theme motion">${[['gentle','On'],['off','Off']].map(([key,label])=>`<option value="${key}"${(layer.motion&&layer.motion!=='gentle'?'off':'gentle')===key?' selected':''}>${label}</option>`).join('')}</select></label>`:'')+choices('motion','Motion',[['gentle','Gentle','Things glide and settle.',ART.gentle],['still','Fades only','No sliding, only fades.',ART.still],['off','Off','Nothing moves.',ART.off]])
     +`<div class="cz-toggles">${toggle('livingArt','Living drawings',s.livingArt==='off'?'The course drawings rest once they are drawn.':s.motion!=='gentle'?'They move only with Gentle motion.':'Once drawn, the course drawings keep moving gently.',{checked:s.livingArt!=='off'}).replace('data-setting="livingArt"','data-setting="livingArt" data-onoff="true"')}</div>`)
   ;
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
   return `<div class="ch-art-slot" data-kind="${kind}" data-id="${E(id)}"${framing?` data-ch-frame-target tabindex="0" role="group" aria-label="${E(title)} media for ${E(label)}"`:''}>${value&&frames&&framing?'':`<div class="ch-art-preview" aria-hidden="true">${preview||''}</div>`}<div class="ch-art-caption"><strong>${title}</strong><span title="${E(asset?.name||(preview?'Built-in drawing':'None yet'))}">${E(asset?.name||(preview?'Built-in drawing':'None yet'))}</span></div><label class="rd-button ch-upload">${asset?'Replace':'Upload'}<input type="file" accept="${accept}" data-rd-field="art-upload" data-kind="${kind}" data-id="${E(id)}" aria-label="Upload ${word} for ${E(label)}" ${c.customizeBusy?'disabled':''}></label>${framing?button('art-clipboard','Paste',`data-id="${E(id)}" data-kind="${kind}" aria-label="Paste ${word}" ${c.customizeBusy?'disabled':''}`):''}${asset?button('art-remove','Use default',`data-id="${E(id)}" data-kind="${kind}" aria-label="Remove custom ${word}" ${c.customizeBusy?'disabled':''}`,'rd-text-button'):''}${['banner','icon','border','title'].includes(kind)?button('art-template','Get template',`data-kind="${kind}"`,'rd-text-button'):''}${paste(kind)}${frames&&framing?root.ReserveFrameEditor.render(value,{id,kind,appearance:{...pref,bannerSize:s.bannerSize,shapes:c.frameShapes?.[id]?.[kind]}}):''}${picker({kinds:['course-art','kit'],target:id,slot:kind,label:'Installed '+word+' artwork'})}</div>`;
  };
  const kits=()=>{
    const installed=c.makeOwn?.catalogue?.filter(row=>row.kind==='kit')||[],ids=new Set(installed.map(row=>row.kit?.id));
    return group('Kits','',`<div class="cz-row"><label class="rd-field"><span>Kit name</span><input type="text" data-rd-field="kit-name" maxlength="40" value="${E(c.kitName||'')}" ${c.customizeBusy?'disabled':''}></label>${button('kit-save','Save as kit',`data-id="${E(id)}" ${c.customizeBusy?'disabled':''}`)}${c.makeOwn?'':`<label class="rd-button ch-upload">Import<input type="file" accept=".chkit,application/json" data-rd-field="kit-import" ${c.customizeBusy?'disabled':''}></label>`}</div>${picker({kinds:['kit'],target:id,label:'Installed kits'})}<div class="ch-kit-list">${(c.customKits||[]).filter(kit=>!ids.has(kit.id)).map(kit=>{
      const current=!!root.ReservePacks?.isCurrent?.({kind:'kit',kit},{settings:s},{target:id});
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
   const pet=P.clean(c.personal?.pet),coat=A.COATS[pet.coat],style=`--pet-coat:${coat.coat};--pet-shade:${coat.shade};--pet-mane:${coat.mane};--pet-muzzle:${coat.muzzle};--pet-harness:${A.HARNESS[pet.harness]};--pet-size:112px`;
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
    // Use the original pack so a disabled drawing can be switched back on.
    const pack=c.makeOwn?.pet?.pack||c.makeOwn?.pet,
      poses=(root.ReservePetPack?.poses||A.POSES).filter(pose=>pose!=='eat'&&identity.custom&&pack?.assets?.[pack?.poses?.[pose]]);
    const SK=root.ReservePonyBrain?.SKILLS||{},
      skill=keys=>
        keys.filter(key=>SK[key]).concat(keys.length===7?
          Object.keys(SK).filter(key=>!['quiz','labprep','reading','rubric','feedback','deadline','planner','focus','wellbeing','reminders','night','inbox'].includes(key)):
          []).map(key=>
          toggle(key,SK[key].label,'',{checked:pet.skills[key]!==false,field:'pet-skill',data:'key'}).replace('<small></small>','')).join(''),
      routines=pet.routines.map(r=>`<div class="cz-row"><span>${E(r.name)}</span>${button('pet-routine-remove','Remove',`data-id="${E(r.id)}" aria-label="Remove ${E(r.name)}"`,'rd-text-button')}</div>`).join('');
    return `<div class="cz-pet-hero"><div class="pet" data-pose="${pet.enabled?'stand':'sleep'}" data-face="right" data-gear="${pet.gear}" style="${style}">${drawing}</div><div><label class="rd-field"><span>Name</span><input type="text" maxlength="24" data-rd-field="pet" data-key="name" value="${E(identity.name)}" aria-label="Companion name"></label></div></div>
<div class="cz-toggles">${toggle('enabled','Keep '+identity.name,'It keeps you company and tells you what is next. It never nags.',{checked:pet.enabled,field:'pet',data:'key'})}</div>`
    +group('Companion','',button('make-clear',`<span class="cz-choice-art cz-companion-art">${A.drawing({pet:{...pet,name:builtinName}},null,{still:true})}</span><strong>${E(builtinName)}</strong><small>Built-in${identity.id?'':' · Current'}</small>`,`data-id="pet" aria-pressed="${!identity.id}"`,'rd-text-button')+picker({kinds:['pet'],label:'Installed companions'}))
    +
    group(
      'Where it goes',
      '',
      petChoices(
        'roam',
        'Where your companion goes',
        [['page','Anywhere','It walks along the tops of your modules and the bottom of the window.',inScene(CZ_WHERE.page)],['home','Its paddock','It stays in the Paddock module on Home.',inScene(CZ_WHERE.home)],['off','Out of sight','Hidden for now.',CZ_WHERE.off]],
        3))
    +
    group(
      'Reminders',
      '',
      petChoices('nudges','Reminders',[['helpful','Speaks up','Up to three timely nudges a day. Quiet from 22:00 to 07:00 unless a deadline is close.',CZ_REMIND.helpful],['quiet','A small flag','Carries a flag when something is due soon. Says nothing.',CZ_REMIND.quiet],['off','None','It never mentions deadlines.',CZ_REMIND.off]],3))
    +group('Planning','',`<label class="rd-field"><span>Bedtime</span><input type="time" data-rd-field="setting" data-setting="bedtime" value="${E(s.bedtime||'22:30')}"></label>${toggle('biscuitOffers','Biscuit offers','One timely offer, with less after you skip it.',{checked:s.biscuitOffers!==false})}`)
    +
    group('Skills','',`<h4 class="cz-subhead">For study</h4><div class="cz-toggles cz-checks">${skill(['quiz','labprep','reading','rubric','feedback'])}</div><h4 class="cz-subhead">For the day</h4><div class="cz-toggles cz-checks">${skill(['deadline','planner','focus','wellbeing','reminders','night','inbox'])}</div>`)+
    (routines?group('Routines','',routines):'')+
    group('Saved routines','',picker({kinds:['preset'],presetKinds:['routines'],label:'Saved routines'}))
    +group('How much Biscuit knows','',petChoices('knowledge','How much Biscuit knows',[['most','Full','',artDiagrams().knowfull],['lite','Lite','',artDiagrams().knowlite]],2))
    +(identity.id?'':group('Coat','',petChoices('coat','Coat',Object.entries(A.COATS).map(([key,v])=>[key,v.label,'',mini(44,{coat:key})]),6))
    +group('Harness','',petChoices('harness','Harness color',Object.entries(A.HARNESS).map(([key,color])=>[key,key[0].toUpperCase()+key.slice(1),'',czDab(color)]),6)
      +petChoices('gear','Tack',[['full','Collar and blanket','',mini(56,{gear:'full'})],['collar','Collar only','',mini(56,{gear:'collar'})],['none','Bare','',mini(56,{gear:'none'})]],3)))
    +
    group('Size','',petChoices('size','Size',[['small','Small','',mini(40)],['medium','Medium','',mini(52)],['large','Large','',mini(66)]],3))+
    (poses.length?group('Poses','',`<div class="cz-toggles">${poses.map(pose=>`<label class="cz-toggle"><span>${E(pose[0].toUpperCase()+pose.slice(1))}</span><input type="checkbox" role="switch" data-rd-field="make-pose" data-id="pack:${E(identity.id)}" data-pose="${E(pose)}"${s.makeYourOwn?.adjustments?.['pack:'+identity.id]?.poses?.[pose]!==false?' checked':''}${pose==='stand'?' disabled':''}><i aria-hidden="true"></i></label>`).join('')}</div>`):'')+
    button('pet-reset-learning','Reset what '+identity.name+' learned','','rd-text-button');
  };

  // "Add from a file" lives on More; elsewhere the section shows only a pick's status, Undo or a file under review.
  const files=add=>enabled('customization')?root.ReserveMakeYourOwn?.render(c.makeOwn,c.s,{list:false,add})||'':'';
  const body=`${on('layout')?`<div class="cz-pane" data-pane="layout">${layout()}</div>`:''}${on('scenes')?`<div class="cz-pane" data-pane="scenes">${look('scenes')}</div>`:''}${on('look')?`<div class="cz-pane" data-pane="look">${look()}</div>`:''}${on('courses')?`<div class="cz-pane" data-pane="courses">${courses()}${enabled('course-art')?art():''}</div>`:''}${on('pet')?`<div class="cz-pane" data-pane="pet">${pony()}</div>`:''}`;
  return shell(`<section class="rd-customize ch-customize cz" aria-label="Customize workspace"><div class="rd-section-heading"><div><span class="ch-eyebrow">Your workspace</span><h2 id="rd-appearance-title">Make it yours</h2></div>${button('settings-close','Done','aria-label="Close customization" title="Close · Esc"')}</div>
<div class="cz-tabs" role="tablist" aria-label="Settings">${allowedTabs.map(([key,name])=>button('customize-tab',name,`role="tab" data-value="${key}" aria-selected="${tab===key}"`,'cz-tab')).join('')}</div>
 ${on('settings')&&enabled('customization')?`<div class="cz-pane" data-pane="canvas-pages">${canvasMenu()}</div>`+(root.ReserveSettingsDock?.preferencesPane({...c,customizeTab:'settings'},{resetLayout:true,files:files(true)})||'')+(root.ReserveSettingsDock?.featuresPane('features')||''):(root.ReserveSettingsDock?.featuresPane(tab==='settings'?'features':tab)||'')+(on('settings')?root.ReserveSettingsDock?.preferencesPane({...c,customizeTab:'settings'},{resetLayout:true,files:files(true)})||'':files(false))}${body}<div class="ch-custom-footer"></div></section>`);
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
