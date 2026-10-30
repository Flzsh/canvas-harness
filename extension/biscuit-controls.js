/* Local control proposals only. The caller owns confirmation, execution and account/feature gates. */
(function(root){
 'use strict';
 const normalized=new Map(),list=v=>Array.isArray(v)?v:[],own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k),norm=v=>{
   const input=String(v??'');
   if(normalized.has(input))return normalized.get(input);
   const out=input.normalize('NFKC').toLowerCase().replace(/[\u2018\u2019]/g,"'").replace(/&/g,' and ').replace(/[_-]+/g,' ').replace(/[^\p{L}\p{N}'%:#]+/gu,' ').trim();
   if(normalized.size<4096&&input.length<300)normalized.set(input,out);
   return out;
 },words=v=>String(v).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[-_]/g,' ').toLowerCase(),escape=v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const ENUMS={
   "accent":["clay","forest","indigo","rose","ocean","amber"],
   "bannerSize":["compact","standard","large"],
   "courseCardStyle":["sketch","rounded","minimal"],
   "courseNavigation":["sidebar","topbar","dock"],
   "density":["comfortable","compact"],
   "deskOrder":["context-first","work-first","stacked"],
   "dockShelf":["kraft","paper","none"],
   "dockStyle":["tiles","cards"],
   "font":["system","humanist","serif"],
   "greeting":["on","off"],
   "livingArt":["on","off"],
   "motion":["gentle","still","off"],
   "pageTint":["paper","accent","sky","sage","lilac","blush","sand","snow"],
   "panelFrame":["pen","stitch","card","line","none"],
   "quickOpen":["on","off"],
   "readingFont":["book","interface"],
   "sceneTheme":["","starry","sea","stars","blueprint"],
   "surfaceStyle":["paper","clean","contrast"],
   "textSize":["standard","large"],
   "theme":["light","dark"]
 };
 const DEFAULTS={
   "accent":"clay",
   "bannerSize":"standard",
   "bedtime":"22:30",
   "biscuitOffers":true,
   "courseCardStyle":"sketch",
   "courseNavigation":"sidebar",
   "density":"comfortable",
   "deskOrder":"context-first",
   "dockCounts":true,
   "dockHide":false,
   "dockLively":true,
   "dockNamesAlways":false,
   "dockShelf":"kraft",
   "dockStyle":"tiles",
   "font":"system",
   "greeting":"on",
   "livingArt":"on",
   "motion":"gentle",
   "nightArt":0,
   "pageTint":"paper",
   "panelFrame":"pen",
   "quickOpen":"off",
   "readingFont":"book",
   "sceneTheme":"",
   "showBookmarks":true,
   "showCourseIcons":true,
   "showCourseInformation":true,
   "showCourseStrip":true,
   "showDeadlinePreview":true,
   "showGrades":false,
   "showRecentGrades":false,
   "surfaceStyle":"paper",
   "textSize":"standard",
   "theme":"light"
 };
 const ALIASES={
   "density":["density","row spacing","row density","layout spacing"],
   "showGrades":["grades","grade","my grades","scores","score","my scores","marks","my marks","grade visibility"],
   "showRecentGrades":["recent grades","recent scores"],
   "showBookmarks":["bookmarks"],
   "showCourseIcons":["course icons"],
   "showDeadlinePreview":["deadline previews","deadline preview"],
   "showCourseInformation":["course information","course info"],
   "showCourseStrip":["course strip"],
   "sceneTheme":["scene","scene theme"],
   "pageTint":["page tint","page color","background color"],
   "courseNavigation":["course navigation","course menu position"],
   "deskOrder":["desk order","panel order"],
   "surfaceStyle":["surface style","page style"],
   "courseCardStyle":["course card style","course cards","course frames"],
   "panelFrame":["panel frame","module outline","module frames","frames"],
   "nightArt":["night art","artwork at night"],
   "readingFont":["reading font","reading text"],
   "textSize":["text size"],
   "quickOpen":["quick open preference","open at once"],
   "livingArt":["living art","living drawings"]
 };
 const VALUES={
   "sceneTheme":{"none":"","off":"","default":"","starfield":"stars","ocean":"sea"},
   "courseNavigation":{"left":"sidebar","side":"sidebar","top":"topbar","bottom":"dock"},
   "panelFrame":{"stitched":"stitch","off":"none"},
   "surfaceStyle":{},
   "courseCardStyle":{"sketched":"sketch"},
   "font":{"modern":"system","bookish":"serif"},
   "textSize":{"larger":"large"},
   "motion":{"on":"gentle","none":"off"},
   "greeting":{"yes":"on","no":"off"},
   "livingArt":{"yes":"on","no":"off"},
   "quickOpen":{"yes":"on","no":"off"}
 };
 const FEATURES={"arrange":"Arrange the workspace","biscuit-more-rules":"Biscuit: more rules","canvas-nav":"Drawn Canvas navigation","course-art":"Course artwork","course-files":"My links & files","course-hub":"Course hub & inbox","course-nav":"Drawn course menu & modules","customization":"Appearance editor","dashboard":"Dashboard & assignments","deadline-changes":"Deadline changes","focus-room":"Focus room","gpa":"GPA calculator","grade-impact":"Grade impact","grades":"Grades","materials":"Materials library","math":"Math tools","motion":"Living drawings & motion","native-appearance":"Native page appearance","pdf":"PDF reader","planner":"Planner & home widgets","play":"Play & submission celebrations","pony":"Pony companion","quick-pack":"Local artwork packs","review-deck":"Review deck","scene-themes":"Scene themes","tools":"Quick open & study tools"};
 const MODULES={"bookmarks":"Bookmarks","clock":"Clock","context":"Course information","grades":"Grades","handin":"To hand in","impact":"Grade impact","messages":"Messages","notes":"Notes","pet":"Paddock","reader":"Assignment details","review":"Review","timer":"Focus timer","week":"This week","work":"Up next"};
 const TABS={
   home:'home',
   dashboard:'home',
   assignments:'assignments',
   planner:'planner',
   plan:'planner',
   messages:'messages',
   inbox:'messages',
   'course hub':'course-hub',
   hub:'course-hub',
   materials:'materials',
   grades:'grades'
 };
 const SKILLS={"deadline":"Deadline watch","feedback":"Feedback helper","focus":"Focus buddy","inbox":"Inbox watch","labprep":"Lab prep","night":"Night owl guard","planner":"Planner help","quiz":"Quiz prep","reading":"Reading helper","reminders":"Reminders","rubric":"Rubric helper","wellbeing":"Wellbeing"};
 const PET_VALUES={"coat":["oat","chestnut","dapple","ink","sage","rose"],"gear":["full","collar","none"],"harness":["red","clay","gold","forest","ocean","iris"],"knowledge":["basic","more","most"],"nudges":["helpful","quiet","off"],"roam":["page","home","off"],"size":["small","medium","large"]};
 /* BEGIN BISCUIT CONTROL UI */
 const UI=[
  ["appearance-value","bannerFit","Banner fit = contain",["Make it yours","Courses","Banner fit","contain"],"contain","set"],
  ["appearance-value","bannerFit","Banner fit = cover",["Make it yours","Courses","Banner fit","cover"],"cover","set"],
  ["appearance-value","bannerPosition","Banner position = center",["Make it yours","Courses","Banner position","center"],"center","set"],
  ["appearance-value","bannerPosition","Banner position = left",["Make it yours","Courses","Banner position","left"],"left","set"],
  ["appearance-value","bannerPosition","Banner position = right",["Make it yours","Courses","Banner position","right"],"right","set"],
  ["appearance-value","titlePlacement","Course title = banner",["Make it yours","Courses","Course title","banner"],"banner","set"],
  ["appearance-value","titlePlacement","Course title = separate",["Make it yours","Courses","Course title","separate"],"separate","set"],
  ["appearance","bannerFit","Banner fit",["Make it yours","Courses","Banner fit"],null,"request"],
  ["appearance","bannerPosition","Banner position",["Make it yours","Courses","Banner position"],null,"request"],
  ["appearance","titlePlacement","Course title",["Make it yours","Courses","Course title"],null,"request"],
  ["art-slot","backgroundArt","Page background",["Make it yours","Courses","Customize course","Page background"],null,"use"],
  ["art-slot","backgroundArt","Page background",["Make it yours","Courses","Customize course","Page background"],null,"remove"],
  ["art-slot","bannerArt","Banner",["Make it yours","Courses","Customize course","Banner"],null,"use"],
  ["art-slot","bannerArt","Banner",["Make it yours","Courses","Customize course","Banner"],null,"remove"],
  ["art-slot","borderArt","Frame",["Make it yours","Courses","Customize course","Frame"],null,"use"],
  ["art-slot","borderArt","Frame",["Make it yours","Courses","Customize course","Frame"],null,"remove"],
  ["art-slot","cardArt","Card art",["Make it yours","Courses","Customize course","Card art"],null,"use"],
  ["art-slot","cardArt","Card art",["Make it yours","Courses","Customize course","Card art"],null,"remove"],
  ["art-slot","iconArt","Icon",["Make it yours","Courses","Customize course","Icon"],null,"use"],
  ["art-slot","iconArt","Icon",["Make it yours","Courses","Customize course","Icon"],null,"remove"],
  ["art-slot","titleArt","Title",["Make it yours","Courses","Customize course","Title"],null,"use"],
  ["art-slot","titleArt","Title",["Make it yours","Courses","Customize course","Title"],null,"remove"],
  ["panel-button","button","preset: {name}",["Home","preset: {name}"],null,"request"],
  ["panel-button","button","toggle: {name}",["Home","toggle: {name}"],null,"request"],
  ["panel-button","button","Open",["Home","Open"],null,"request"],
  ["panel-button","open","Open the market",["Home","Open the market"],null,"request"],
  ["panel-button","open","Get more",["Home","Get more"],null,"request"],
  ["panel-button","remove-pack","Remove",["Home","Remove"],null,"request"],
  ["panel-button","reset-pack","Reset to how it came",["Home","Reset to how it came"],null,"request"],
  ["panel-button","use-pack","Use",["Home","Use"],null,"request"],
  ["panel-button","button","Canvas Harness",["Home","Canvas Harness"],null,"request"],
  ["panel-button","button","Canvas dashboard",["Home","Canvas dashboard"],null,"request"],
  ["panel-button","capture-announcement","Add to my plan",["Workspace","Course hub","Add to my plan"],null,"request"],
  ["panel-button","capture-home","Plan from this page",["Workspace","Course hub","Plan from this page"],null,"request"],
  ["panel-button","capture-message","Add to my plan",["Workspace","Course hub","Add to my plan"],null,"request"],
  ["panel-button","hub-${action}","Choose {label}",["Workspace","Course hub","Choose {label}"],null,"request"],
  ["panel-button","hub-inbox-refresh","Refresh messages",["Workspace","Course hub","Refresh messages"],null,"request"],
  ["panel-button","hub-module-more","Show all {count} / Show fewer",["Workspace","Course hub","Show all {count} / Show fewer"],null,"request"],
  ["panel-button","hub-refresh","Refresh this course",["Workspace","Course hub","Refresh this course"],null,"request"],
  ["panel-button","hub-unread","{label} {count}",["Workspace","Course hub","{label} {count}"],null,"request"],
  ["panel-button","inbox-refresh","Try again",["Workspace","Course hub","Try again"],null,"request"],
  ["panel-button","material-pin","Bookmarked / Bookmark",["Workspace","Course hub","Bookmarked / Bookmark"],null,"request"],
  ["panel-button","read-message","Read full conversation",["Workspace","Course hub","Read full conversation"],null,"request"],
  ["panel-button","read-more","Show less / Read more",["Workspace","Course hub","Show less / Read more"],null,"request"],
  ["panel-button","refresh-deck","Refresh",["Workspace","Course hub","Refresh"],null,"request"],
  ["panel-button","refresh","Try again",["Workspace","Course hub","Try again"],null,"request"],
  ["panel-button","retry-message","Try again",["Workspace","Course hub","Try again"],null,"request"],
  ["panel-button","save-message","Bookmarked / Bookmark message",["Workspace","Course hub","Bookmarked / Bookmark message"],null,"request"],
  ["panel-button","workspace","View messages",["Workspace","Course hub","View messages"],null,"request"],
  ["panel-button","add","+ Add",["Workspace","Course hub","+ Add"],null,"request"],
  ["panel-button","cancel-row","Cancel",["Workspace","Course hub","Cancel"],null,"request"],
  ["panel-button","cancel","Cancel",["Workspace","Course hub","Cancel"],null,"request"],
  ["panel-button","confirm-remove","Remove",["Workspace","Course hub","Remove"],null,"request"],
  ["panel-button","hub-own-${action}","Choose {label}",["Workspace","Course hub","Choose {label}"],null,"request"],
  ["panel-button","open","open {name}",["Workspace","Course hub","open {name}"],null,"request"],
  ["panel-button","remove","Remove",["Workspace","Course hub","Remove"],null,"request"],
  ["panel-button","rename","Rename",["Workspace","Course hub","Rename"],null,"request"],
  ["panel-button","save-link","Add link",["Workspace","Course hub","Add link"],null,"request"],
  ["panel-button","save-name","Save",["Workspace","Course hub","Save"],null,"request"],
  ["panel-button","accent","accent: {color}",["Make it yours","Look","accent: {color}"],null,"request"],
  ["panel-button","accent","accent: {name}",["Make it yours","Look","accent: {name}"],null,"request"],
  ["panel-button","art-clipboard","Paste",["Make it yours","Look","Paste"],null,"request"],
  ["panel-button","art-paste","Apply SVG",["Make it yours","Look","Apply SVG"],null,"request"],
  ["panel-button","art-remove","Remove",["Make it yours","Look","Remove"],null,"request"],
  ["panel-button","art-remove","Use default",["Make it yours","Look","Use default"],null,"request"],
  ["panel-button","art-template","Get template",["Make it yours","Look","Get template"],null,"request"],
  ["panel-button","board-edit","Edit Home…",["Make it yours","Look","Edit Home…"],null,"request"],
  ["panel-button","board-frame","board frame: {name}",["Make it yours","Look","board frame: {name}"],null,"request"],
  ["panel-button","course-down","Move {name} later",["Make it yours","Look","Move {name} later"],null,"request"],
  ["panel-button","course-reset","Reset theme artwork / Reset this course’s artwork",["Make it yours","Look","Reset theme artwork / Reset this course’s artwork"],null,"request"],
  ["panel-button","course-up","Move {name} earlier",["Make it yours","Look","Move {name} earlier"],null,"request"],
  ["panel-button","customize-tab","customize tab: {name}",["Make it yours","Look","customize tab: {name}"],null,"request"],
  ["panel-button","kit-export","Export {name}",["Make it yours","Look","Export {name}"],null,"request"],
  ["panel-button","kit-save","Save as kit",["Make it yours","Look","Save as kit"],null,"request"],
  ["panel-button","kit-use","Use",["Make it yours","Look","Use"],null,"request"],
  ["panel-button","layout-preset","layout preset: {title}",["Make it yours","Look","layout preset: {title}"],null,"request"],
  ["panel-button","legacy-image-remove","Remove image",["Make it yours","Look","Remove image"],null,"request"],
  ["panel-button","make-clear","Use default theme",["Make it yours","Look","Use default theme"],null,"request"],
  ["panel-button","make-clear","Default theme",["Make it yours","Look","Default theme"],null,"request"],
  ["panel-button","make-clear","make clear: {name}",["Make it yours","Look","make clear: {name}"],null,"request"],
  ["panel-button","make-reset","Reset to how it came",["Make it yours","Look","Reset to how it came"],null,"request"],
  ["panel-button","pet-reset-learning","Reset what {name} learned",["Make it yours","Look","Reset what {name} learned"],null,"request"],
  ["panel-button","pet-routine-remove","Remove",["Make it yours","Look","Remove"],null,"request"],
  ["panel-button","settings-close","Done",["Make it yours","Look","Done"],null,"request"],
  ["panel-button","add-step","Add checklist step",["Home","Add checklist step"],null,"request"],
  ["panel-button","arrange-restore","Restore course information",["Home","Restore course information"],null,"request"],
  ["panel-button","arrange-restore","Show course information",["Home","Show course information"],null,"request"],
  ["panel-button","arrange-undo","Undo move",["Home","Undo move"],null,"request"],
  ["panel-button","board-edit","Done editing / Edit Home",["Home","Done editing / Edit Home"],null,"request"],
  ["panel-button","button","Hold to move · Space for keyboard",["Home","Hold to move · Space for keyboard"],null,"request"],
  ["panel-button","capture","Add a reminder…",["Home","Add a reminder…"],null,"request"],
  ["panel-button","capture","Add reminder",["Home","Add reminder"],null,"request"],
  ["panel-button","close-preview","Back to work list",["Home","Back to work list"],null,"request"],
  ["panel-button","course","All courses",["Home","All courses"],null,"request"],
  ["panel-button","course","{name}, open, overdue",["Home","{name}, open, overdue"],null,"request"],
  ["panel-button","course","course: {label}",["Home","course: {label}"],null,"request"],
  ["panel-button","course","course: {course}",["Home","course: {course}"],null,"request"],
  ["panel-button","day","day: {date}",["Home","day: {date}"],null,"request"],
  ["panel-button","deadline-changes","Changes",["Home","Changes"],null,"request"],
  ["panel-button","dockShelf","Paper",["Home","Paper"],null,"request"],
  ["panel-button","dockShelf","None",["Home","None"],null,"request"],
  ["panel-button","dockShelf","Kraft",["Home","Kraft"],null,"request"],
  ["panel-button","dockStyle","Cards",["Home","Cards"],null,"request"],
  ["panel-button","dockStyle","Icons",["Home","Icons"],null,"request"],
  ["panel-button","drawer","Menu: workspaces and courses",["Home","Menu: workspaces and courses"],null,"request"],
  ["panel-button","drawer","Close menu",["Home","Close menu"],null,"request"],
  ["panel-button","glance","{label} {count}",["Home","{label} {count}"],null,"request"],
  ["panel-button","grades","All grades",["Home","All grades"],null,"request"],
  ["panel-button","help-this","Help with this",["Home","Help with this"],null,"request"],
  ["panel-button","hidden-courses","{count} hidden courses: choose which courses show",["Home","{count} hidden courses: choose which courses show"],null,"request"],
  ["panel-button","more","Show more assignments",["Home","Show more assignments"],null,"request"],
  ["panel-button","native","Canvas dashboard",["Home","Canvas dashboard"],null,"request"],
  ["panel-button","native","Canvas dashboard",["Home","Canvas dashboard"],null,"request"],
  ["panel-button","open-hub","Open course hub",["Home","Open course hub"],null,"request"],
  ["panel-button","pin","Bookmarked / Bookmark",["Home","Bookmarked / Bookmark"],null,"request"],
  ["panel-button","planner","Planner",["Home","Planner"],null,"request"],
  ["panel-button","preview","preview {label}",["Home","preview {label}"],null,"request"],
  ["panel-button","preview","preview {name}",["Home","preview {name}"],null,"request"],
  ["panel-button","preview","Preview",["Home","Preview"],null,"request"],
  ["panel-button","reader-tab","My plan {count} steps",["Home","My plan {count} steps"],null,"request"],
  ["panel-button","reader-tab","Instructions",["Home","Instructions"],null,"request"],
  ["panel-button","refresh","Refresh Canvas data",["Home","Refresh Canvas data"],null,"request"],
  ["panel-button","remove-step","Remove step: {title}",["Home","Remove step: {title}"],null,"request"],
  ["panel-button","room-open","Focus room",["Home","Focus room"],null,"request"],
  ["panel-button","schedule","Tomorrow",["Home","Tomorrow"],null,"request"],
  ["panel-button","schedule","Clear planned date",["Home","Clear planned date"],null,"request"],
  ["panel-button","schedule","Today",["Home","Today"],null,"request"],
  ["panel-button","schedule","In today’s plan / Plan for today",["Home","In today’s plan / Plan for today"],null,"request"],
  ["panel-button","selection-archive","Archive",["Home","Archive"],null,"request"],
  ["panel-button","selection-clear","Clear",["Home","Clear"],null,"request"],
  ["panel-button","selection-undo","Undo",["Home","Undo"],null,"request"],
  ["panel-button","settings","Make it yours",["Home","Make it yours"],null,"request"],
  ["panel-button","show-dated","{count} older dated items · Browse archive",["Home","{count} older dated items · Browse archive"],null,"request"],
  ["panel-button","toolbox","Tools",["Home","Tools"],null,"request"],
  ["panel-button","undo-check-off","Undo",["Home","Undo"],null,"request"],
  ["panel-button","view","See this week",["Home","See this week"],null,"request"],
  ["panel-button","view","Review",["Home","Review"],null,"request"],
  ["panel-button","view","view: {label}",["Home","view: {label}"],null,"request"],
  ["panel-button","workspace","workspace: {label}",["Home","workspace: {label}"],null,"request"],
  ["panel-button","workspace","{label}, {count} unread",["Home","{label}, {count} unread"],null,"request"],
  ["panel-button","adjust","adjust: {option}",["Home","adjust: {option}"],null,"request"],
  ["panel-button","adjust","adjust: {option}",["Home","adjust: {option}"],null,"request"],
  ["panel-button","retry-save","Retry save",["Home","Retry save"],null,"request"],
  ["panel-button","use","use: {option}",["Home","use: {option}"],null,"request"],
  ["panel-button","button","Winter",["Home","Winter"],null,"request"],
  ["panel-button","button","Fire",["Home","Fire"],null,"request"],
  ["panel-button","button","Quiet",["Home","Quiet"],null,"request"],
  ["panel-button","button","Lake",["Home","Lake"],null,"request"],
  ["panel-button","button","Place",["Home","Place"],null,"request"],
  ["panel-button","button","Rain",["Home","Rain"],null,"request"],
  ["panel-button","button","Stream",["Home","Stream"],null,"request"],
  ["panel-button","focus-back","Back to it",["Home","Back to it"],null,"request"],
  ["panel-button","focus-break","Break",["Home","Break"],null,"request"],
  ["panel-button","focus-control","Add 5 minutes",["Home","Add 5 minutes"],null,"request"],
  ["panel-button","focus-control","Finish",["Home","Finish"],null,"request"],
  ["panel-button","room-close","Close",["Home","Close"],null,"request"],
  ["panel-button","room-open","Focus room",["Home","Focus room"],null,"request"],
  ["panel-button","timer-minutes","25 minutes",["Home","25 minutes"],null,"request"],
  ["panel-button","timer-minutes","50 minutes",["Home","50 minutes"],null,"request"],
  ["panel-button","timer-minutes","Open-ended",["Home","Open-ended"],null,"request"],
  ["panel-button","timer-toggle","Start / Pause / Again / Resume",["Home","Start / Pause / Again / Resume"],null,"request"],
  ["panel-button","button","Clear",["Workspace","Grades","Clear"],null,"request"],
  ["panel-button","button","Add",["Workspace","Grades","Add"],null,"request"],
  ["panel-button","button","Add assignment",["Workspace","Grades","Add assignment"],null,"request"],
  ["panel-button","button","Clear what-ifs",["Workspace","Grades","Clear what-ifs"],null,"request"],
  ["panel-button","button","Cancel",["Workspace","Grades","Cancel"],null,"request"],
  ["panel-button","button","gi cat: {option}",["Workspace","Grades","gi cat: {option}"],null,"request"],
  ["panel-button","button","Previous course",["Workspace","Grades","Previous course"],null,"request"],
  ["panel-button","button","Next course",["Workspace","Grades","Next course"],null,"request"],
  ["panel-button","course","Open grade impact",["Workspace","Grades","Open grade impact"],null,"request"],
  ["panel-button","course","Fold",["Workspace","Grades","Fold"],null,"request"],
  ["panel-button","course","All courses",["Workspace","Grades","All courses"],null,"request"],
  ["panel-button","grades-visibility","Show grades",["Workspace","Grades","Show grades"],null,"request"],
  ["panel-button","workspace","Open grade impact",["Workspace","Grades","Open grade impact"],null,"request"],
  ["panel-button","course","course: {name}",["Workspace","Grades","course: {name}"],null,"request"],
  ["panel-button","grades-visibility","Hide grades / Show grades",["Workspace","Grades","Hide grades / Show grades"],null,"request"],
  ["panel-button","more-grades","Show more scored work",["Workspace","Grades","Show more scored work"],null,"request"],
  ["panel-button","apply","Apply",["Make it yours","Look","Apply"],null,"request"],
  ["panel-button","cancel","Cancel",["Make it yours","Look","Cancel"],null,"request"],
  ["panel-button","kit-remove","Remove",["Make it yours","Look","Remove"],null,"request"],
  ["panel-button","kit-use","Use",["Make it yours","Look","Use"],null,"request"],
  ["panel-button","make-${action}","Choose {label}",["Make it yours","Look","Choose {label}"],null,"request"],
  ["panel-button","quick-pack-undo","Remove",["Make it yours","Look","Remove"],null,"request"],
  ["panel-button","remove","Remove",["Make it yours","Look","Remove"],null,"request"],
  ["panel-button","review","Preview",["Make it yours","Look","Preview"],null,"request"],
  ["panel-button","use","Use",["Make it yours","Look","Use"],null,"request"],
  ["panel-button","add","Save shortcut",["Workspace","Materials","Save shortcut"],null,"request"],
  ["panel-button","capture","Plan",["Workspace","Materials","Plan"],null,"request"],
  ["panel-button","close","Close",["Workspace","Materials","Close"],null,"request"],
  ["panel-button","material-jump","{name} {count} items",["Workspace","Materials","{name} {count} items"],null,"request"],
  ["panel-button","material-more","Show all {count} / Show fewer",["Workspace","Materials","Show all {count} / Show fewer"],null,"request"],
  ["panel-button","material-${name}","Choose {label}",["Workspace","Materials","Choose {label}"],null,"request"],
  ["panel-button","material-read","material read: {title}",["Workspace","Materials","material read: {title}"],null,"request"],
  ["panel-button","material-refresh","Refresh materials",["Workspace","Materials","Refresh materials"],null,"request"],
  ["panel-button","open-materials","Browse",["Workspace","Materials","Browse"],null,"request"],
  ["panel-button","pin","Bookmarked / Bookmark",["Workspace","Materials","Bookmarked / Bookmark"],null,"request"],
  ["panel-button","pin","Save",["Workspace","Materials","Save"],null,"request"],
  ["panel-button","refresh","Load course materials",["Workspace","Materials","Load course materials"],null,"request"],
  ["panel-button","refresh","Try again",["Workspace","Materials","Try again"],null,"request"],
  ["panel-button","retry-page","Try again",["Workspace","Materials","Try again"],null,"request"],
  ["panel-button","ch-overnight-choose","Choose folder",["Home","Choose folder"],null,"request"],
  ["panel-button","ch-overnight-copy","Copy",["Home","Copy"],null,"request"],
  ["panel-button","ch-overnight-grant","Allow the prep folder",["Home","Allow the prep folder"],null,"request"],
  ["panel-button","button","Cancel",["Materials","Open the PDF","PDF reader","Cancel"],null,"request"],
  ["panel-button","marks-copy","Copy as notes",["Materials","Open the PDF","PDF reader","Copy as notes"],null,"request"],
  ["panel-button","marks-download","Download .md",["Materials","Open the PDF","PDF reader","Download .md"],null,"request"],
  ["panel-button","marks-tab","Marks",["Materials","Open the PDF","PDF reader","Marks"],null,"request"],
  ["panel-button","outline-tab","Outline",["Materials","Open the PDF","PDF reader","Outline"],null,"request"],
  ["panel-button","save-note","Save note",["Materials","Open the PDF","PDF reader","Save note"],null,"request"],
  ["panel-button","thumbnails-tab","Pages",["Materials","Open the PDF","PDF reader","Pages"],null,"request"],
  ["pet-action","ask-choice","ask choice {label}",["Companion","ask choice {label}"],null,"request"],
  ["pet-action","ask-choice","ask choice",["Companion","ask choice"],null,"request"],
  ["pet-action","ask","Ask {name}",["Companion","Ask {name}"],null,"request"],
  ["pet-action","button","Companion menu",["Companion","Companion menu"],null,"request"],
  ["pet-action","engine-row","engine row: {title}",["Companion","engine row: {title}"],null,"request"],
  ["pet-action","example","example: {option}",["Companion","example: {option}"],null,"request"],
  ["pet-action","quiet","quiet: {option}",["Companion","quiet: {option}"],null,"request"],
  ["pet-action","reload","Reload",["Companion","Reload"],null,"request"],
  ["pet-action","schedule-later","Later 10 min / Skip",["Companion","Later 10 min / Skip"],null,"request"],
  ["pet-action","schedule-use","Done / {minutes}",["Companion","Done / {minutes}"],null,"request"],
  ["pet-action","suggestion","suggestion: {label}",["Companion","suggestion: {label}"],null,"request"],
  ["pet-action","undo","Undo",["Companion","Undo"],null,"request"],
  ["panel-button","plan-carry","Move all to today",["Workspace","Planner","Move all to today"],null,"request"],
  ["panel-button","plan-delete","Delete this task",["Workspace","Planner","Delete this task"],null,"request"],
  ["panel-button","plan-done","Hide finished / Show finished {count}",["Workspace","Planner","Hide finished / Show finished {count}"],null,"request"],
  ["panel-button","plan-estimate","plan estimate: {minutes}",["Workspace","Planner","plan estimate: {minutes}"],null,"request"],
  ["panel-button","plan-menu","Choose a day or a length",["Workspace","Planner","Choose a day or a length"],null,"request"],
  ["panel-button","plan-more","Show {count} more",["Workspace","Planner","Show {count} more"],null,"request"],
  ["panel-button","plan-move","No day",["Workspace","Planner","No day"],null,"request"],
  ["panel-button","plan-move","plan move: {label}",["Workspace","Planner","plan move: {label}"],null,"request"],
  ["panel-button","plan-quick-add","Add",["Workspace","Planner","Add"],null,"request"],
  ["panel-button","plan-view","plan view: {title}",["Workspace","Planner","plan view: {title}"],null,"request"],
  ["panel-button","plan-week-now","This week / Next week / Last week / Back to this week",["Workspace","Planner","This week / Next week / Last week / Back to this week"],null,"request"],
  ["panel-button","plan-week","Previous week",["Workspace","Planner","Previous week"],null,"request"],
  ["panel-button","plan-week","Next week",["Workspace","Planner","Next week"],null,"request"],
  ["panel-button","button","Choose {name}",["Home","Choose {name}"],null,"request"],
  ["panel-button","chb-undo","Put it back",["Home","Put it back"],null,"request"],
  ["panel-button","addons-retry","Try again",["Canvas Harness extension popup","More","Try again"],null,"request"],
  ["panel-button","back","Back to quick settings",["Canvas Harness extension popup","More","Back to quick settings"],null,"request"],
  ["panel-button","button","Across the top Now",["Canvas Harness extension popup","More","Across the top Now"],null,"request"],
  ["panel-button","button","Canvas menu bar",["Canvas Harness extension popup","More","Canvas menu bar"],null,"request"],
  ["panel-button","button","Pony",["Canvas Harness extension popup","More","Pony"],null,"request"],
  ["panel-button","button","Full height Now",["Canvas Harness extension popup","More","Full height Now"],null,"request"],
  ["panel-button","button","Installed add-ons",["Canvas Harness extension popup","More","Installed add-ons"],null,"request"],
  ["panel-button","button","Canvas’s own Now",["Canvas Harness extension popup","More","Canvas’s own Now"],null,"request"],
  ["panel-button","button","Features",["Canvas Harness extension popup","More","Features"],null,"request"],
  ["panel-button","button","Look",["Canvas Harness extension popup","More","Look"],null,"request"],
  ["panel-button","button","From the left edge Now",["Canvas Harness extension popup","More","From the left edge Now"],null,"request"],
  ["panel-button","button","Browse the Market",["Canvas Harness extension popup","More","Browse the Market"],null,"request"],
  ["panel-button","button","Open",["Canvas Harness extension popup","More","Open"],null,"request"],
  ["panel-button","button","Canvas pages",["Canvas Harness extension popup","More","Canvas pages"],null,"request"],
  ["panel-button","change-school","change",["Canvas Harness extension popup","More","change"],null,"request"],
  ["panel-button","features-retry","Try again",["Canvas Harness extension popup","More","Try again"],null,"request"],
  ["panel-button","market-open","Market",["Canvas Harness extension popup","More","Market"],null,"request"],
  ["panel-button","open","Open your dashboard",["Canvas Harness extension popup","More","Open your dashboard"],null,"request"],
  ["panel-button","reload-extension","Reload",["Canvas Harness extension popup","More","Reload"],null,"request"],
  ["panel-button","apply","Add / Apply {count} piece / pieces",["Make it yours","Courses","Add / Apply {count} piece / pieces"],null,"request"],
  ["panel-button","quick-pack-${action}","Choose {label}",["Make it yours","Courses","Choose {label}"],null,"request"],
  ["panel-button","reset","Start another pack",["Make it yours","Courses","Start another pack"],null,"request"],
  ["panel-button","review","Checking… / Review pack",["Make it yours","Courses","Checking… / Review pack"],null,"request"],
  ["panel-button","undo","Undo last pack",["Make it yours","Courses","Undo last pack"],null,"request"],
  ["panel-button","clear-date","Clear test date",["Workspace","Review","Clear test date"],null,"request"],
  ["panel-button","delete","Delete? / Delete",["Workspace","Review","Delete? / Delete"],null,"request"],
  ["panel-button","drawer-close","Close",["Workspace","Review","Close"],null,"request"],
  ["panel-button","edit-cancel","Cancel",["Workspace","Review","Cancel"],null,"request"],
  ["panel-button","export","Export cards",["Workspace","Review","Export cards"],null,"request"],
  ["panel-button","finish","Back to boxes",["Workspace","Review","Back to boxes"],null,"request"],
  ["panel-button","import","Import cards",["Workspace","Review","Import cards"],null,"request"],
  ["panel-button","leave","Boxes",["Workspace","Review","Boxes"],null,"request"],
  ["panel-button","more","Show more",["Workspace","Review","Show more"],null,"request"],
  ["panel-button","new","New card",["Workspace","Review","New card"],null,"request"],
  ["panel-button","pause","Resume / Pause",["Workspace","Review","Resume / Pause"],null,"request"],
  ["panel-button","preview","Preview",["Workspace","Review","Preview"],null,"request"],
  ["panel-button","review-deck-big","Big card",["Workspace","Review","Big card"],null,"request"],
  ["panel-button","review-deck-edit","Edit",["Workspace","Review","Edit"],null,"request"],
  ["panel-button","review-deck-fold","Back to Home",["Workspace","Review","Back to Home"],null,"request"],
  ["panel-button","review-deck-grade","Good",["Workspace","Review","Good"],null,"request"],
  ["panel-button","review-deck-grade","Easy",["Workspace","Review","Easy"],null,"request"],
  ["panel-button","review-deck-grade","Next",["Workspace","Review","Next"],null,"request"],
  ["panel-button","review-deck-grade","Again",["Workspace","Review","Again"],null,"request"],
  ["panel-button","review-deck-leave","Back to boxes",["Workspace","Review","Back to boxes"],null,"request"],
  ["panel-button","review-deck-new","New card",["Workspace","Review","New card"],null,"request"],
  ["panel-button","review-deck-open","Study all",["Workspace","Review","Study all"],null,"request"],
  ["panel-button","review-deck-open","Add cards",["Workspace","Review","Add cards"],null,"request"],
  ["panel-button","review-deck-open","Carry on",["Workspace","Review","Carry on"],null,"request"],
  ["panel-button","review-deck-open","Course box",["Workspace","Review","Course box"],null,"request"],
  ["panel-button","review-deck-open","Open the reading room",["Workspace","Review","Open the reading room"],null,"request"],
  ["panel-button","review-deck-resume","Carry on",["Workspace","Review","Carry on"],null,"request"],
  ["panel-button","review-deck-reveal","Show answer",["Workspace","Review","Show answer"],null,"request"],
  ["panel-button","review-deck-start","Course box",["Workspace","Review","Course box"],null,"request"],
  ["panel-button","review-deck-start","Study all",["Workspace","Review","Study all"],null,"request"],
  ["panel-button","review-deck-tab","Cards",["Workspace","Review","Cards"],null,"request"],
  ["panel-button","review-deck-tab","Edit card / Add card",["Workspace","Review","Edit card / Add card"],null,"request"],
  ["panel-button","review-deck-tab","Cards",["Workspace","Review","Cards"],null,"request"],
  ["panel-button","review-deck-tab","Course box",["Workspace","Review","Course box"],null,"request"],
  ["panel-button","review-deck-tab","Import",["Workspace","Review","Import"],null,"request"],
  ["panel-button","review-deck-tab","Schedule",["Workspace","Review","Schedule"],null,"request"],
  ["panel-button","review-deck-turn","Turn the card",["Workspace","Review","Turn the card"],null,"request"],
  ["panel-button","save-date","Save test date",["Workspace","Review","Save test date"],null,"request"],
  ["panel-button","save-limits","Save daily limits",["Workspace","Review","Save daily limits"],null,"request"],
  ["panel-button","save","Save",["Workspace","Review","Save"],null,"request"],
  ["panel-button","save","Save changes / Add card",["Workspace","Review","Save changes / Add card"],null,"request"],
  ["panel-button","skip","Next card",["Workspace","Review","Next card"],null,"request"],
  ["panel-button","cancel-import","Cancel",["Make it yours","More","Cancel"],null,"request"],
  ["panel-button","clear-scratchpad","Clear scratchpad",["Make it yours","More","Clear scratchpad"],null,"request"],
  ["panel-button","confirm-import","Restore workspace",["Make it yours","More","Restore workspace"],null,"request"],
  ["panel-button","copy-scratchpad","Copy text",["Make it yours","More","Copy text"],null,"request"],
  ["panel-button","customize-tab","customize tab: {label}",["Make it yours","More","customize tab: {label}"],null,"request"],
  ["panel-button","export-backup","Export my backup",["Make it yours","More","Export my backup"],null,"request"],
  ["panel-button","export-calendar","Export calendar",["Make it yours","More","Export calendar"],null,"request"],
  ["panel-button","features-reload","Reload Canvas",["Make it yours","More","Reload Canvas"],null,"request"],
  ["panel-button","features-retry","Retry loading features",["Make it yours","More","Retry loading features"],null,"request"],
  ["panel-button","layout-reset","Reset layout",["Make it yours","More","Reset layout"],null,"request"],
  ["panel-button","preferences-${action}","Choose {label}",["Make it yours","More","Choose {label}"],null,"request"],
  ["panel-button","recover-backup","Undo last restore",["Make it yours","More","Undo last restore"],null,"request"],
  ["panel-button","reset-appearance","Reset appearance",["Make it yours","More","Reset appearance"],null,"request"],
  ["panel-button","settings-close","Done",["Make it yours","More","Done"],null,"request"],
  ["panel-button","settings","Make it yours",["Make it yours","More","Make it yours"],null,"request"],
  ["panel-button","undo-scratchpad","Undo scratchpad clear",["Make it yours","More","Undo scratchpad clear"],null,"request"],
  ["panel-button","•","Choose an option",["Home","Choose an option"],null,"request"],
  ["panel-button","Ask","Ask",["Home","Ask"],null,"request"],
  ["panel-button","Check my work","Check my work",["Home","Check my work"],null,"request"],
  ["panel-button","dom-button","Choose {title}",["Home","Choose {title}"],null,"request"],
  ["panel-button","dom-button","Choose {title}",["Home","Choose {title}"],null,"request"],
  ["panel-button","Done","Done",["Home","Done"],null,"request"],
  ["panel-button","Help with…","Help with…",["Home","Help with…"],null,"request"],
  ["panel-button","More","More",["Home","More"],null,"request"],
  ["panel-button","Next card","Next card",["Home","Next card"],null,"request"],
  ["panel-button","Next day","Next day",["Home","Next day"],null,"request"],
  ["panel-button","Next page","Next page",["Home","Next page"],null,"request"],
  ["panel-button","Open chat","Open chat",["Home","Open chat"],null,"request"],
  ["panel-button","Paste","Paste",["Home","Paste"],null,"request"],
  ["panel-button","Previous card","Previous card",["Home","Previous card"],null,"request"],
  ["panel-button","Previous day","Previous day",["Home","Previous day"],null,"request"],
  ["panel-button","Previous page","Previous page",["Home","Previous page"],null,"request"],
  ["panel-button","Push Help up","Push Help up",["Home","Push Help up"],null,"request"],
  ["panel-button","Read","Read",["Home","Read"],null,"request"],
  ["panel-button","Remember","Remember",["Home","Remember"],null,"request"],
  ["panel-button","Remembered","Remembered",["Home","Remembered"],null,"request"],
  ["panel-button","Remove","Remove",["Home","Remove"],null,"request"],
  ["panel-button","Save and redo","Save and redo",["Home","Save and redo"],null,"request"],
  ["panel-button","Show all","Show all",["Home","Show all"],null,"request"],
  ["panel-button","Undo","Undo",["Home","Undo"],null,"request"],
  ["toolbox-action","button","Add to my plan",["Tools","Quick open","Add to my plan"],null,"request"],
  ["toolbox-action","calculator-mode","calculator mode: {label}",["Tools","Quick open","calculator mode: {label}"],null,"request"],
  ["toolbox-action","capture-more","Add a deadline",["Tools","Quick open","Add a deadline"],null,"request"],
  ["toolbox-action","clear-capture","Clear draft",["Tools","Quick open","Clear draft"],null,"request"],
  ["toolbox-action","close","Close tools",["Tools","Quick open","Close tools"],null,"request"],
  ["toolbox-action","collapse","Collapse tools",["Tools","Quick open","Collapse tools"],null,"request"],
  ["toolbox-action","expand","Open",["Tools","Quick open","Open"],null,"request"],
  ["toolbox-action","plan-item","Open plan",["Tools","Quick open","Open plan"],null,"request"],
  ["toolbox-action","preview-result","Preview {label}",["Tools","Quick open","Preview {label}"],null,"request"],
  ["toolbox-action","remove-capture-source","Remove linked source",["Tools","Quick open","Remove linked source"],null,"request"],
  ["toolbox-action","run","run",["Tools","Quick open","run"],null,"request"],
  ["toolbox-action","tool","tool: {label}",["Tools","Quick open","tool: {label}"],null,"request"],
  ["toolbox-action","undo-capture","Undo clear",["Tools","Quick open","Undo clear"],null,"request"],
  ["panel-button","accent","accent: {name}",["Home","accent: {name}"],null,"request"],
  ["panel-button","${action}","Choose {title}",["Home","Choose {title}"],null,"request"],
  ["panel-button","button","Review backup",["Home","Review backup"],null,"request"],
  ["panel-button","button","Add checklist step",["Home","Add checklist step"],null,"request"],
  ["panel-button","button","Add task",["Home","Add task"],null,"request"],
  ["panel-button","button","Save course",["Home","Save course"],null,"request"],
  ["panel-button","check-off","Mark not done / Mark done",["Home","Mark not done / Mark done"],null,"request"],
  ["panel-button","choose-focus","{name} / Choose a task to focus on",["Home","{name} / Choose a task to focus on"],null,"request"],
  ["panel-button","clear-filters","Clear filters",["Home","Clear filters"],null,"request"],
  ["panel-button","clear-scratchpad","Clear scratchpad",["Home","Clear scratchpad"],null,"request"],
  ["panel-button","close-overlay","Cancel",["Home","Cancel"],null,"request"],
  ["panel-button","command","Search anything",["Home","Search anything"],null,"request"],
  ["panel-button","confirm-import","Restore workspace",["Home","Restore workspace"],null,"request"],
  ["panel-button","copy-scratchpad","Copy text",["Home","Copy text"],null,"request"],
  ["panel-button","course-filter","Assignments",["Home","Assignments"],null,"request"],
  ["panel-button","customize","Customize",["Home","Customize"],null,"request"],
  ["panel-button","day","{date} {color}",["Home","{date} {color}"],null,"request"],
  ["panel-button","delete-task","Delete personal task",["Home","Delete personal task"],null,"request"],
  ["panel-button","detail","detail: {name}",["Home","detail: {name}"],null,"request"],
  ["panel-button","detail","detail: {name}",["Home","detail: {name}"],null,"request"],
  ["panel-button","detail","detail",["Home","detail"],null,"request"],
  ["panel-button","detail","detail: {name}",["Home","detail: {name}"],null,"request"],
  ["panel-button","detail","Open my plan",["Home","Open my plan"],null,"request"],
  ["panel-button","detail","{name} — / /",["Home","{name} — / /"],null,"request"],
  ["panel-button","detail","detail",["Home","detail"],null,"request"],
  ["panel-button","duration","m",["Home","m"],null,"request"],
  ["panel-button","exit","Back to Canvas",["Home","Back to Canvas"],null,"request"],
  ["panel-button","export-backup","Export my backup",["Home","Export my backup"],null,"request"],
  ["panel-button","export-backup","Export current backup",["Home","Export current backup"],null,"request"],
  ["panel-button","export-calendar","Export calendar",["Home","Export calendar"],null,"request"],
  ["panel-button","filter-nav","{count} In progress",["Home","{count} In progress"],null,"request"],
  ["panel-button","filter-nav","{count} Past due",["Home","{count} Past due"],null,"request"],
  ["panel-button","filter-nav","{count} Next 7 days",["Home","{count} Next 7 days"],null,"request"],
  ["panel-button","filter-nav","{count} Due today",["Home","{count} Due today"],null,"request"],
  ["panel-button","filter","filter: {option}",["Home","filter: {option}"],null,"request"],
  ["panel-button","focus","Focus",["Home","Focus"],null,"request"],
  ["panel-button","focus","Focus on this",["Home","Focus on this"],null,"request"],
  ["panel-button","import-backup","Import backup",["Home","Import backup"],null,"request"],
  ["panel-button","navigate","navigate: {label}",["Home","navigate: {label}"],null,"request"],
  ["panel-button","navigate","View all",["Home","View all"],null,"request"],
  ["panel-button","navigate","Arrange courses",["Home","Arrange courses"],null,"request"],
  ["panel-button","new-task","Add a task",["Home","Add a task"],null,"request"],
  ["panel-button","pin","pin",["Home","pin"],null,"request"],
  ["panel-button","pin","Bookmarked / Bookmark",["Home","Bookmarked / Bookmark"],null,"request"],
  ["panel-button","recover-backup","Undo last restore",["Home","Undo last restore"],null,"request"],
  ["panel-button","refresh","Try again",["Home","Try again"],null,"request"],
  ["panel-button","reset-appearance","Reset appearance",["Home","Reset appearance"],null,"request"],
  ["panel-button","run-command","run command: {title}",["Home","run command: {title}"],null,"request"],
  ["panel-button","shortcuts","Keyboard shortcuts",["Home","Keyboard shortcuts"],null,"request"],
  ["panel-button","shortcuts","Shortcuts",["Home","Shortcuts"],null,"request"],
  ["panel-button","timer-toggle","Pause / Start focus",["Home","Pause / Start focus"],null,"request"],
  ["panel-button","week-today","This week",["Home","This week"],null,"request"],
  ["panel-button","back","Back",["Home","Back"],null,"request"],
  ["panel-button","button","Full height",["Home","Full height"],null,"request"],
  ["panel-button","button","Light mode",["Home","Light mode"],null,"request"],
  ["panel-button","button","Dark mode",["Home","Dark mode"],null,"request"],
  ["panel-button","button","From the left edge",["Home","From the left edge"],null,"request"],
  ["panel-button","button","Across the top",["Home","Across the top"],null,"request"],
  ["panel-button","button","Canvas’s own",["Home","Canvas’s own"],null,"request"],
  ["panel-button","button","Continue",["Home","Continue"],null,"request"],
  ["panel-button","finish-board","Open my Canvas",["Home","Open my Canvas"],null,"request"],
  ["panel-button","intro-start","Start",["Home","Start"],null,"request"],
  ["panel-button","next","Next",["Home","Next"],null,"request"],
  ["panel-button","school-go","Go",["Home","Go"],null,"request"],
  ["panel-button","board-edit","Done",["Home","Done"],null,"request"],
  ["panel-button","board-frame","board frame: {name}",["Home","board frame: {name}"],null,"request"],
  ["panel-button","focus-control","focus control: {label}",["Home","focus control: {label}"],null,"request"],
  ["panel-button","module-dock","Right",["Home","Right"],null,"request"],
  ["panel-button","module-dock","Left",["Home","Left"],null,"request"],
  ["panel-button","module-dock","Bottom",["Home","Bottom"],null,"request"],
  ["panel-button","module-dock","Top",["Home","Top"],null,"request"],
  ["panel-button","module-size","Narrow",["Home","Narrow"],null,"request"],
  ["panel-button","module-size","Normal",["Home","Normal"],null,"request"],
  ["panel-button","module-size","Wide",["Home","Wide"],null,"request"],
  ["panel-button","notes-help","Help with this",["Home","Help with this"],null,"request"],
  ["panel-button","pet-feed","Give a treat",["Home","Give a treat"],null,"request"],
  ["panel-button","pet-roam","Let it roam / Keep it here",["Home","Let it roam / Keep it here"],null,"request"],
  ["panel-button","pet-settings","Change",["Home","Change"],null,"request"],
  ["panel-button","plan-open","plan open: {date}",["Home","plan open: {date}"],null,"request"],
  ["panel-button","preview","preview {option}",["Home","preview {option}"],null,"request"],
  ["panel-button","preview","preview {title}",["Home","preview {title}"],null,"request"],
  ["panel-button","room-open","Focus room",["Home","Focus room"],null,"request"],
  ["panel-button","room-open","Focus room",["Home","Focus room"],null,"request"],
  ["panel-button","${shown?'widget-remove':'widget-add'}","Remove / Add {label}",["Home","Remove / Add {label}"],null,"request"],
  ["panel-button","timer-minutes","timer minutes: {minutes}",["Home","timer minutes: {minutes}"],null,"request"],
  ["panel-button","timer-reset","Reset",["Home","Reset"],null,"request"],
  ["panel-button","timer-toggle","Pause / Resume / Start",["Home","Pause / Resume / Start"],null,"request"],
  ["panel-button","widget-remove","Remove from Home",["Home","Remove from Home"],null,"request"],
  ["panel-button","workspace","All grades",["Home","All grades"],null,"request"],
  ["panel-button","workspace","Planner",["Home","Planner"],null,"request"],
  ["panel-button","workspace","Read them / Open Messages",["Home","Read them / Open Messages"],null,"request"],
  ["panel-button","button","Hold to move · Space for keyboard",["Home","Hold to move · Space for keyboard"],null,"request"],
  ["panel-button","module-menu","Size and place",["Home","Size and place"],null,"request"],
  ["panel-button","widget-remove","Remove from Home",["Home","Remove from Home"],null,"request"],
  ["feature-preset","custom","Custom",["Canvas Harness extension popup","Features","Preset","Custom"],null,"request"],
  ["feature-preset","full","Full",["Canvas Harness extension popup","Features","Preset","Full"],null,"request"],
  ["feature-preset","lite","Lite",["Canvas Harness extension popup","Features","Preset","Lite"],null,"request"],
  ["feature","dashboard","Dashboard & assignments",["Canvas Harness extension popup","Features","Dashboard & assignments"],null,"disable"],
  ["feature","planner","Planner & home widgets",["Canvas Harness extension popup","Features","Planner & home widgets"],null,"disable"],
  ["feature","pony","Pony companion",["Canvas Harness extension popup","Features","Pony companion"],null,"disable"],
  ["home-module","bookmarks","Bookmarks",["Home","Bookmarks","Size and place","Medium"],null,"reset-size"],
  ["home-module","clock","Clock",["Home","Clock","Size and place","Medium"],null,"reset-size"],
  ["home-module","context","Course information",["Home","Course information","Size and place","Medium"],null,"reset-size"],
  ["home-module","grades","Grades",["Home","Grades","Size and place","Medium"],null,"reset-size"],
  ["home-module","handin","To hand in",["Home","To hand in","Size and place","Medium"],null,"reset-size"],
  ["home-module","impact","Grade impact",["Home","Grade impact","Size and place","Medium"],null,"reset-size"],
  ["home-module","messages","Messages",["Home","Messages","Size and place","Medium"],null,"reset-size"],
  ["home-module","notes","Notes",["Home","Notes","Size and place","Medium"],null,"reset-size"],
  ["home-module","pet","Paddock",["Home","Paddock","Size and place","Medium"],null,"reset-size"],
  ["home-module","reader","Assignment details",["Home","Assignment details","Size and place"],null,"show"],
  ["home-module","reader","Assignment details",["Home","Assignment details","Size and place"],null,"hide"],
  ["home-module","reader","Assignment details",["Home","Assignment details","Size and place"],null,"top"],
  ["home-module","reader","Assignment details",["Home","Assignment details","Size and place"],null,"wide"],
  ["home-module","reader","Assignment details",["Home","Assignment details","Size and place","Medium"],null,"reset-size"],
  ["home-module","review","Review",["Home","Review","Size and place","Medium"],null,"reset-size"],
  ["home-module","timer","Focus timer",["Home","Focus timer","Size and place","Medium"],null,"reset-size"],
  ["home-module","week","This week",["Home","This week","Size and place","Medium"],null,"reset-size"],
  ["home-module","work","Up next",["Home","Up next","Size and place"],null,"show"],
  ["home-module","work","Up next",["Home","Up next","Size and place"],null,"hide"],
  ["home-module","work","Up next",["Home","Up next","Size and place"],null,"top"],
  ["home-module","work","Up next",["Home","Up next","Size and place"],null,"wide"],
  ["home-module","work","Up next",["Home","Up next","Size and place","Medium"],null,"reset-size"],
  ["layout-preset","focus","focus layout",["Make it yours","Home","Layout presets","focus"],null,"request"],
  ["layout-preset","studio","studio layout",["Make it yours","Home","Layout presets","studio"],null,"request"],
  ["layout-preset","study","study layout",["Make it yours","Home","Layout presets","study"],null,"request"],
  ["market","course-art","off installed course-art",["Canvas Harness extension popup","Add-ons","Choose the installed course-art","Turn off"],null,"off"],
  ["market","course-art","remove installed course-art",["Canvas Harness extension popup","Add-ons","Choose the installed course-art","Remove"],null,"remove"],
  ["market","course-art","reset installed course-art",["Canvas Harness extension popup","Add-ons","Choose the installed course-art","Reset"],null,"reset"],
  ["market","course-art","use installed course-art",["Canvas Harness extension popup","Add-ons","Choose the installed course-art","Use"],null,"use"],
  ["market","feature","off installed feature",["Canvas Harness extension popup","Add-ons","Choose the installed feature","Turn off"],null,"off"],
  ["market","feature","remove installed feature",["Canvas Harness extension popup","Add-ons","Choose the installed feature","Remove"],null,"remove"],
  ["market","feature","reset installed feature",["Canvas Harness extension popup","Add-ons","Choose the installed feature","Reset"],null,"reset"],
  ["market","feature","use installed feature",["Canvas Harness extension popup","Add-ons","Choose the installed feature","Use"],null,"use"],
  ["market","kit","off installed kit",["Canvas Harness extension popup","Add-ons","Choose the installed kit","Turn off"],null,"off"],
  ["market","kit","remove installed kit",["Canvas Harness extension popup","Add-ons","Choose the installed kit","Remove"],null,"remove"],
  ["market","kit","reset installed kit",["Canvas Harness extension popup","Add-ons","Choose the installed kit","Reset"],null,"reset"],
  ["market","kit","use installed kit",["Canvas Harness extension popup","Add-ons","Choose the installed kit","Use"],null,"use"],
  ["market","media","off installed media",["Canvas Harness extension popup","Add-ons","Choose the installed media","Turn off"],null,"off"],
  ["market","media","remove installed media",["Canvas Harness extension popup","Add-ons","Choose the installed media","Remove"],null,"remove"],
  ["market","media","reset installed media",["Canvas Harness extension popup","Add-ons","Choose the installed media","Reset"],null,"reset"],
  ["market","media","use installed media",["Canvas Harness extension popup","Add-ons","Choose the installed media","Use"],null,"use"],
  ["market","pet","off installed pet",["Canvas Harness extension popup","Add-ons","Choose the installed pet","Turn off"],null,"off"],
  ["market","pet","remove installed pet",["Canvas Harness extension popup","Add-ons","Choose the installed pet","Remove"],null,"remove"],
  ["market","pet","reset installed pet",["Canvas Harness extension popup","Add-ons","Choose the installed pet","Reset"],null,"reset"],
  ["market","pet","use installed pet",["Canvas Harness extension popup","Add-ons","Choose the installed pet","Use"],null,"use"],
  ["market","preset","off installed preset",["Canvas Harness extension popup","Add-ons","Choose the installed preset","Turn off"],null,"off"],
  ["market","preset","remove installed preset",["Canvas Harness extension popup","Add-ons","Choose the installed preset","Remove"],null,"remove"],
  ["market","preset","reset installed preset",["Canvas Harness extension popup","Add-ons","Choose the installed preset","Reset"],null,"reset"],
  ["market","preset","use installed preset",["Canvas Harness extension popup","Add-ons","Choose the installed preset","Use"],null,"use"],
  ["market","scene","off installed scene",["Canvas Harness extension popup","Add-ons","Choose the installed scene","Turn off"],null,"off"],
  ["market","scene","remove installed scene",["Canvas Harness extension popup","Add-ons","Choose the installed scene","Remove"],null,"remove"],
  ["market","scene","reset installed scene",["Canvas Harness extension popup","Add-ons","Choose the installed scene","Reset"],null,"reset"],
  ["market","scene","use installed scene",["Canvas Harness extension popup","Add-ons","Choose the installed scene","Use"],null,"use"],
  ["market","theme","off installed theme",["Canvas Harness extension popup","Add-ons","Choose the installed theme","Turn off"],null,"off"],
  ["market","theme","remove installed theme",["Canvas Harness extension popup","Add-ons","Choose the installed theme","Remove"],null,"remove"],
  ["market","theme","reset installed theme",["Canvas Harness extension popup","Add-ons","Choose the installed theme","Reset"],null,"reset"],
  ["market","theme","use installed theme",["Canvas Harness extension popup","Add-ons","Choose the installed theme","Use"],null,"use"],
  ["pane-field","course-color","course color",["Make it yours","Courses","course color"],null,"request"],
  ["pane-field","course-name","course name",["Make it yours","Courses","course name"],null,"request"],
  ["pane-field","course-visible","course visible",["Make it yours","Courses","course visible"],null,"request"],
  ["pane-field","make-color","make color",["Make it yours","Look","make color"],null,"request"],
  ["pane-field","make-motion","make motion",["Make it yours","Look","make motion"],null,"request"],
  ["pane-field","make-part","make part",["Make it yours","Look","make part"],null,"request"],
  ["pane-field","make-pose","make pose",["Make it yours","Look","make pose"],null,"request"],
  ["pane-field","pet","pet",["Make it yours","Companion","pet"],null,"request"],
  ["pet-pose","cheer","cheer companion pose",["Make it yours","Companion","Poses","cheer"],null,"enable"],
  ["pet-pose","cheer","cheer companion pose",["Make it yours","Companion","Poses","cheer"],null,"disable"],
  ["pet-pose","eat","eat companion pose",["Make it yours","Companion","Poses","eat"],null,"enable"],
  ["pet-pose","eat","eat companion pose",["Make it yours","Companion","Poses","eat"],null,"disable"],
  ["pet-pose","fall","fall companion pose",["Make it yours","Companion","Poses","fall"],null,"enable"],
  ["pet-pose","fall","fall companion pose",["Make it yours","Companion","Poses","fall"],null,"disable"],
  ["pet-pose","flag","flag companion pose",["Make it yours","Companion","Poses","flag"],null,"enable"],
  ["pet-pose","flag","flag companion pose",["Make it yours","Companion","Poses","flag"],null,"disable"],
  ["pet-pose","held","held companion pose",["Make it yours","Companion","Poses","held"],null,"enable"],
  ["pet-pose","held","held companion pose",["Make it yours","Companion","Poses","held"],null,"disable"],
  ["pet-pose","lie","lie companion pose",["Make it yours","Companion","Poses","lie"],null,"enable"],
  ["pet-pose","lie","lie companion pose",["Make it yours","Companion","Poses","lie"],null,"disable"],
  ["pet-pose","read","read companion pose",["Make it yours","Companion","Poses","read"],null,"enable"],
  ["pet-pose","read","read companion pose",["Make it yours","Companion","Poses","read"],null,"disable"],
  ["pet-pose","sleep","sleep companion pose",["Make it yours","Companion","Poses","sleep"],null,"enable"],
  ["pet-pose","sleep","sleep companion pose",["Make it yours","Companion","Poses","sleep"],null,"disable"],
  ["pet-pose","stand","stand companion pose",["Make it yours","Companion","Poses","stand"],null,"enable"],
  ["pet-pose","stand","stand companion pose",["Make it yours","Companion","Poses","stand"],null,"disable"],
  ["pet-pose","trot","trot companion pose",["Make it yours","Companion","Poses","trot"],null,"enable"],
  ["pet-pose","trot","trot companion pose",["Make it yours","Companion","Poses","trot"],null,"disable"],
  ["pet-pose","walk","walk companion pose",["Make it yours","Companion","Poses","walk"],null,"enable"],
  ["pet-pose","walk","walk companion pose",["Make it yours","Companion","Poses","walk"],null,"disable"],
  ["pet-value","coat","companion coat = chestnut",["Make it yours","Companion","Coat","chestnut"],"chestnut","set"],
  ["pet-value","coat","companion coat = dapple",["Make it yours","Companion","Coat","dapple"],"dapple","set"],
  ["pet-value","coat","companion coat = ink",["Make it yours","Companion","Coat","ink"],"ink","set"],
  ["pet-value","coat","companion coat = oat",["Make it yours","Companion","Coat","oat"],"oat","set"],
  ["pet-value","coat","companion coat = rose",["Make it yours","Companion","Coat","rose"],"rose","set"],
  ["pet-value","coat","companion coat = sage",["Make it yours","Companion","Coat","sage"],"sage","set"],
  ["pet-value","gear","companion gear = collar",["Make it yours","Companion","Tack","collar"],"collar","set"],
  ["pet-value","gear","companion gear = full",["Make it yours","Companion","Tack","full"],"full","set"],
  ["pet-value","gear","companion gear = none",["Make it yours","Companion","Tack","none"],"none","set"],
  ["pet-value","harness","companion harness = clay",["Make it yours","Companion","Harness color","clay"],"clay","set"],
  ["pet-value","harness","companion harness = forest",["Make it yours","Companion","Harness color","forest"],"forest","set"],
  ["pet-value","harness","companion harness = gold",["Make it yours","Companion","Harness color","gold"],"gold","set"],
  ["pet-value","harness","companion harness = iris",["Make it yours","Companion","Harness color","iris"],"iris","set"],
  ["pet-value","harness","companion harness = ocean",["Make it yours","Companion","Harness color","ocean"],"ocean","set"],
  ["pet-value","harness","companion harness = red",["Make it yours","Companion","Harness color","red"],"red","set"],
  ["pet-value","knowledge","companion knowledge = basic",["Make it yours","Companion","How much Biscuit knows","basic"],"basic","set"],
  ["pet-value","knowledge","companion knowledge = more",["Make it yours","Companion","How much Biscuit knows","more"],"more","set"],
  ["pet-value","knowledge","companion knowledge = most",["Make it yours","Companion","How much Biscuit knows","most"],"most","set"],
  ["pet-value","nudges","companion nudges = off",["Make it yours","Companion","Reminders","off"],"off","set"],
  ["pet-value","roam","companion roam = home",["Make it yours","Companion","Where your companion goes","home"],"home","set"],
  ["pet-value","roam","companion roam = off",["Make it yours","Companion","Where your companion goes","off"],"off","set"],
  ["pet-value","roam","companion roam = page",["Make it yours","Companion","Where your companion goes","page"],"page","set"],
  ["pet-value","size","companion size = large",["Make it yours","Companion","Size","large"],"large","set"],
  ["pet-value","size","companion size = medium",["Make it yours","Companion","Size","medium"],"medium","set"],
  ["pet-value","size","companion size = small",["Make it yours","Companion","Size","small"],"small","set"],
  ["pet","coat","companion coat",["Make it yours","Companion","Coat"],null,"inspect"],
  ["pet","gear","companion gear",["Make it yours","Companion","Tack"],null,"inspect"],
  ["pet","harness","companion harness",["Make it yours","Companion","Harness color"],null,"inspect"],
  ["pet","knowledge","companion knowledge",["Make it yours","Companion","How much Biscuit knows"],null,"inspect"],
  ["pet","name","companion name",["Make it yours","Companion","Name"],null,"inspect"],
  ["pet","nudges","companion nudges",["Make it yours","Companion","Reminders"],null,"inspect"],
  ["pet","roam","companion roam",["Make it yours","Companion","Where your companion goes"],null,"inspect"],
  ["pet","size","companion size",["Make it yours","Companion","Size"],null,"inspect"],
  ["setting-value","canvasNav","Canvas menu bar = drawn",["Make it yours","Home","Canvas menu bar","drawn"],"drawn","set"],
  ["setting-value","canvasNav","Canvas menu bar = original",["Make it yours","Home","Canvas menu bar","original"],"original","set"],
  ["setting-value","canvasNav","Canvas menu bar = shown",["Make it yours","Home","Canvas menu bar","shown"],"shown","set"],
  ["setting-value","canvasNav","Canvas menu bar = top",["Make it yours","Home","Canvas menu bar","top"],"top","set"],
  ["setting","accent","Accent color",["Make it yours","Look","Accent color"],null,"inspect"],
  ["setting","bannerSize","Banner size",["Make it yours","Courses","Banner size"],null,"inspect"],
  ["setting","bedtime","bedtime",["Make it yours","Companion","bedtime"],null,"inspect"],
  ["setting","canvasNav","Canvas menu bar",["Make it yours","Home","Canvas menu bar"],null,"inspect"],
  ["setting","canvasNav","Canvas menu bar",["Make it yours","Home","Canvas menu bar"],null,"reset"],
  ["setting","courseCardStyle","Course frames",["Make it yours","Courses","Course frames"],null,"inspect"],
  ["setting","courseNavigation","Course navigation",["Make it yours","Home","Course navigation"],null,"inspect"],
  ["setting","density","Spacing",["Make it yours","Home","Spacing"],null,"inspect"],
  ["setting","deskOrder","Panel order",["Make it yours","Home","Panel order"],null,"inspect"],
  ["setting","dockScale","dock scale",["Make it yours","Look","dock scale"],null,"inspect"],
  ["setting","dockShelf","Shelf",["Make it yours","Look","Shelf"],null,"inspect"],
  ["setting","dockStyle","Look",["Make it yours","Look","Look"],null,"inspect"],
  ["setting","font","Interface type",["Make it yours","Look","Interface type"],null,"inspect"],
  ["setting","greeting","greeting",["Make it yours","Home","greeting"],null,"inspect"],
  ["setting","livingArt","living art",["Make it yours","Look","living art"],null,"inspect"],
  ["setting","motion","motion",["Make it yours","Look","motion"],null,"inspect"],
  ["setting","nightArt","night art",["Make it yours","Look","night art"],null,"inspect"],
  ["setting","pageTint","Page color",["Make it yours","Look","Page color"],null,"inspect"],
  ["setting","panelFrame","Module outlines",["Make it yours","Look","Module outlines"],null,"inspect"],
  ["setting","quickOpen","open at once",["Make it yours","Home","open at once"],null,"inspect"],
  ["setting","readingFont","Reading text",["Make it yours","Look","Reading text"],null,"inspect"],
  ["setting","sceneTheme","Scene",["Make it yours","Look","Scene"],null,"inspect"],
  ["setting","subjectArt","Drawing",["Make it yours","Look","Drawing"],null,"inspect"],
  ["setting","surfaceStyle","Page style",["Make it yours","Look","Page style"],null,"inspect"],
  ["setting","textSize","Text size",["Make it yours","Look","Text size"],null,"inspect"],
  ["setting","theme","Theme",["Make it yours","Look","Theme"],null,"inspect"],
  ["settings-tab","courses","Courses",["Make it yours","Courses"],null,"request"],
  ["settings-tab","layout","Home",["Make it yours","Home"],null,"request"],
  ["settings-tab","look","Look",["Make it yours","Look"],null,"request"],
  ["settings-tab","pet","Companion",["Make it yours","Companion"],null,"request"],
  ["settings-tab","settings","More",["Make it yours","More"],null,"request"],
  ["toolbox","calculator","Calculator",["Tools","Calculator"],null,"request"],
  ["toolbox","gpa","GPA",["Tools","GPA"],null,"request"],
  ["toolbox","quick","Quick open",["Tools","Quick open"],null,"request"],
  ["workspace","review","Review",["Workspace","Review"],null,"request"]
 ];
 /* END BISCUIT CONTROL UI */
 let uiCatalogue,uiMoreCatalogue;
 function uiControl(text,options){
   const source=options.controls||options.inventory?.controls,
     rows=source?
       list(source):
       uiCatalogue??=UI.map(([family,key,label,path,value,operation])=>
         ({family,key,label,ui:{path},value,operation,n: norm(label),keyWords:words(key),prefixNorm:norm(path.slice(0,-1).join(' > '))}));
   if(!source&&!/^(?:where|help|find|show|open|go|choose|switch|use|apply|turn|stop|reset|restore|remove|uninstall|replace|clear|upload|set|change|hide|enable|disable|unhide|start|no|without|artwork)\b/.test(text))return null;
   for(const c of rows){
     if(!c.ui?.path)continue;
     const n=c.n??norm(c.label),key=c.keyWords??words(c.key),prefix=c.prefixNorm??norm(c.ui.path.slice(0,-1).join(' > ')),phrases=list(c.wordings).map(norm);
     if(phrases.includes(text)||text==='where is '+n+' in '+prefix||text==='help me use '+n+' in '+prefix||text==='find the '+n+' button in '+prefix)return ui(c.ui.path);
     if(c.family==='setting'&&(text==='where can i change '+n||text==='show me the '+n+' setting'))return ui(c.ui.path);
     if(c.family==='pet'&&(text==='where is '+n||text==='show my '+n+' in companion settings'))return ui(c.ui.path);
     if(c.family==='toolbox'&&(text==='open '+n||text==='where is '+n+' in tools'))return ui(c.ui.path);
     if(c.family==='workspace'&&(text==='open '+n+' workspace'||text==='go to '+n+' tab'))return ui(c.ui.path);
     if(c.family==='settings-tab'&&(text==='open make it yours '+n||text==='show the '+n+' settings tab'))return ui(c.ui.path);
     if(c.family==='feature-preset'&&(text==='choose '+n+' feature preset'||text==='switch features to '+n))return ui(c.ui.path);
     if(c.family==='layout-preset'&&(text==='use the '+n||text==='choose '+n+' in layout'))return ui(c.ui.path);
     if(c.family==='market'){
       const item='installed '+norm(key),
         op=c.operation,
         match=op==='use'?
           (text==='use the '+item||text==='apply my '+item):
           op==='off'?
             (text==='turn off my '+item||text==='stop using the '+item):
             op==='reset'?(text==='reset my '+item||text==='restore the '+item+' to how it came'):(text==='remove the '+item||text==='uninstall my '+item);
       if(match)return ui(c.ui.path);
     }
     if(c.family==='pet-pose'){
       const on=toggle(text,[key+' pose for my installed companion',key+' companion pose']);
       if(on!==undefined)return ui(c.ui.path,c.key==='stand'?'Stand is required. Open Make it yours > Pony > Poses to review the installed companion.':undefined);
     }
     if(c.family==='art-slot'){
       const match=c.operation==='remove'?(text==='remove this course '+key||text==='clear the uploaded '+key):(text==='replace the '+key+' for this course'||text==='upload a new '+key+' in artwork');
       if(match)return ui(c.ui.path);
     }
     if(c.family==='appearance-value'){const v=norm(c.value);if(text==='set artwork '+key+' to '+v||text==='choose '+v+' for artwork '+key)return ui(c.ui.path);}
     if(c.family==='setting-value'){
       const name=norm(ALIASES[c.key]?.[0]||key),v=norm(c.value===''?'none':String(c.value));
       if(text==='set '+name+' to '+v||text==='change '+name+' to '+v)return ui(c.ui.path);
     }
     if(c.family==='appearance'||c.family==='pane-field'){if(text==='where can i change '+n||text==='help me find '+n+' in '+prefix)return ui(c.ui.path);}
   }
  return terseUI(text,rows,!!source);
 }
 const names=key=>[key,words(key),...(ALIASES[key]||[])].map(norm),
   label=key=>(ALIASES[key]?.[0]||words(key)),
   card=(action,fields,message,extra={})=>
     ({
       action,
       items:[],
       message,
       next:{action,fields:fields||{},label:action==='none'?'Review choices':'Continue'},
       route:'local',
       routing:{route:'local',reason:'control-proposal'},
       understanding:{step:'understanding',reason:'control-proposal'},
       ...extra
     });
 const ui=(path,message,extra={})=>card('none',{},message||'Open '+path.join(' > ')+'.',{ui:{path},...extra}),
   clarify=message=>card('none',{},message||'What would you like to change or find?',{clarify:true});
 function setting(key,value){
   if(key==='theme'&&value==='system')return ui(['Make it yours','Look','Light or dark'],'Choose Light or Dark in Make it yours > Look > Light or dark. System is a legacy saved value.');
   if(own(ENUMS,key)&&!ENUMS[key].includes(value)||
     typeof DEFAULTS[key]==='boolean'&&typeof value!=='boolean'||
     key==='nightArt'&&(!Number.isInteger(value)||value<0||value>100)||
     key==='bedtime'&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
     return clarify('Choose a valid value for '+label(key)+'.');
   if(!own(DEFAULTS,key))return null;
   return card('setting',{key,value},(key==='showGrades'?(value?'Show grades.':'Hide grades.'):'Set '+label(key)+' to '+(value===''?'None':String(value))+'.'));
 }
 function picker(s,session){
   const p=session.picker||session.activePicker||s.picker||s.activePicker;
   if(!p||p.open===false)return null;
   const key=typeof p==='string'?p:p.key||p.kind||p.type;
   if(!['scene','sceneTheme','theme'].includes(key))return null;
   const rows=list(p.choices).filter(v=>v&&typeof v.label==='string'&&typeof v.value==='string'),
     scene=key!=='theme',
     choices=rows.length?
       rows.map(v=>({label:v.label,action:scene?'setting':'none',fields:scene&&ENUMS.sceneTheme.includes(v.value)?{key:'sceneTheme',value:v.value}:{}})):
       scene?
         [['None',''],['Starry Night','starry'],['Under the Sea','sea'],['Starfield','stars'],['Blueprint','blueprint']].map(([label,value])=>({label,action:'setting',fields:{key:'sceneTheme',value}})):
         [{label:'Default theme',action:'none',fields:{}}];
   return ui(['Make it yours','Look',scene?'Scene':'Theme'],'Which '+(scene?'scene':'theme')+' would you like? Choose None or another choice.',{clarify:true,choices});
 }
 function valueFor(key,text){
   const v=norm(text).replace(/^(?:to|as|be)\s+/,''),exact=own(VALUES[key],v)?VALUES[key][v]:(ENUMS[key]||[]).find(x=>norm(x)===v);
   if(exact!==undefined)return exact;
   if(/\b(?:installed|market)\b/.test(v))return undefined;
   const choices=Object.entries(VALUES[key]||{}).concat((ENUMS[key]||[]).map(x=>[norm(x),x])),
     hits=[...new Set(choices.filter(([name])=>name&&(' '+v+' ').includes(' '+name+' ')).map(([,value])=>value))];
   return hits.length===1?hits[0]:undefined;
 }
 function toggle(text,aliases){
   if(!/^(?:show|unhide|hide|enable|disable|stop showing|start showing|turn|switch|no|without)\b/.test(text)&&!/(?:on|off|visible|hidden)$/.test(text))return undefined;
   for(const name of [...aliases].sort((a,b)=>b.length-a.length)){
     const n=escape(norm(name));
     let m;
     if((m=new RegExp('^(show|unhide|hide|enable|disable|stop showing|start showing|turn on|turn off|switch on|switch off) (?:the |my )?'+n+'(?: again)?$').exec(text)))return !/^(?:hide|disable|stop showing|turn off|switch off)$/.test(m[1]);
     if((m=new RegExp('^(?:turn |switch )?(?:the |my )?'+n+' (?:back )?(on|off|visible|hidden)$').exec(text)))return /^(?:on|visible)$/.test(m[1]);
     if(new RegExp('^(?:no|without) (?:the |my )?'+n+'$').test(text))return false;
   }
   return undefined;
 }
 /* Terse spellings preserve complete public label/path slots; they do not
    search Canvas content or execute a control. Custom inventories stay live. */
 function terseUI(text,rows,custom){
  const terse=value=>norm(value).replace(/\b(?:the|my|your|to|for|companion)\b/g,' ').replace(/\s+/g,' ').trim(),
    query=terse(text),
    location=/^(?:where is|help me use|find .+ button)\b.*\bin(?: |$)/.test(query),
    art=/^(?:(?:set )?artwork|choose|replace|upload|remove this course|clear uploaded)\b/.test(query);
  if(!location&&!art)return null;
  const matches=new Map(),put=(phrase,path)=>{if(terse(phrase)===query)matches.set(JSON.stringify(path),path);};
  for(const c of rows){
    if(!c.ui?.path||!c.label)continue;
    const n=c.n??norm(c.label),key=c.keyWords??words(c.key);
    if(location){
      const prefix=c.prefixNorm??norm(c.ui.path.slice(0,-1).join(' > '));
      const tail=terse(prefix);
      if(!query.endsWith(' in'+(tail?' '+tail:'')))continue;
      for(const phrase of ['where is '+n+' in '+prefix,'help me use '+n+' in '+prefix,'find the '+n+' button in '+prefix])put(phrase,c.ui.path);
    }
    else if(c.family==='appearance-value'){
      const value=norm(c.value);
      for(const name of new Set([key,n.replace(/\s*=.*$/,'')]))for(const phrase of ['set artwork '+name+' to '+value,'artwork '+name+' '+value,'choose '+value+' for artwork '+name])put(phrase,c.ui.path);
    }
    else if(c.family==='art-slot')
      for(const name of new Set([key,n]))
        for(const phrase of c.operation==='remove'?['remove this course '+name,'clear the uploaded '+name]:['replace the '+name+' for this course','upload a new '+name+' in artwork'])put(phrase,c.ui.path);
  }
  if(!matches.size)return null;if(matches.size>1)return clarify('Which control and panel do you mean?');return ui(matches.values().next().value);
 }
 function propose(input,s={},session={},options={}){
  let text=norm(input);if(!text||text.length>4096)return null;
  text=text.replace(/^(?:hey biscuit |please )/,'').replace(/^(?:can|could|would|will) you (?:please )?/,'').replace(/^i (?:want|need) you to /,'').replace(/ (?:please|pls)$/,'');
  if(/^(?:if|unless|suppose|what|when|who|which|why|how many|how much|how do|how can|can i|could i|should i|is|are|does|did)\b/.test(text))return null;
  if(/\b(?:don't|do not|never)\b/.test(text)){
    if(/^(?:don't|do not) (?:show|display) (?:the |my )?(?:grades?|scores?|marks?)$/.test(text))return setting('showGrades',false);
    const negative=/^(?:don't|do not|never) (?:hide|show|enable|disable|turn|switch|set|change|reset|remove)\s+(.+)$/.exec(text),target=negative?.[1]?.replace(/^(?:on|off)\s+/,'').replace(/^(?:the|my)\s+/,'');
    const scope=target&&
      (/\b(?:feature|module|widget|companion|pet|scene|theme)\b/.test(target)||
        Object.keys(DEFAULTS).some(key=>names(key).some(name=>target===name||target.startsWith(name+' ')))||
        Object.entries(FEATURES).some(([key,name])=>target===norm(key)||target===norm(name)));
    return scope?clarify('Your preferences are unchanged. What would you like to change?'):null;
  }
  if(text==='none')return picker(s,session)||clarify('None of which choices?');
  const visibility=toggle(text,ALIASES.showGrades);if(visibility!==undefined)return setting('showGrades',visibility);
  for(const key of Object.keys(DEFAULTS).filter(k=>typeof DEFAULTS[k]==='boolean')){
    if(names(key).some(n=>text==='reset '+n||text==='restore default '+n))return setting(key,DEFAULTS[key]);
    for(const name of names(key)){
      const m=new RegExp('^(?:set|change) (?:the |my )?'+escape(name)+'(?: to)? (true|false|on|off|yes|no)$').exec(text);
      if(m)return setting(key,/^(?:true|on|yes)$/.test(m[1]));
    }
    if(key==='showGrades')continue;
    const on=toggle(text,names(key));
    if(on!==undefined)return setting(key,on);
  }
  if(/^(?:show|unhide|bring back|hide|turn on|turn off) (?:my |the )?(?:pet|biscuit|companion)$/.test(text))return settingPetEnabled(!/^(?:hide|turn off)\b/.test(text));
  const view=/^(?:show|open|go to|take me to) (?:the |my )?(.+)$/.exec(text),
    viewName=view?.[1],
    viewTab=TABS[viewName]||({'materials library':'materials','course files':'materials','my links and files':'materials'})[viewName];
  if(viewTab&&viewName!=='grades')return card('navigate',{tab:viewTab},'Open '+viewName+'.');
  const allFeatures=new Map(Object.entries(FEATURES));
  for(const row of list(s.features).concat(list(root.ReserveFeatures?.catalogue)))
    if(row&&own(FEATURES,row.id)&&typeof row.id==='string'&&typeof row.name==='string')allFeatures.set(row.id,row.name);
  const explicitModule=/\b(?:home module|home widget|module|widget|panel)\b/.test(text)||/\bon home\b/.test(text);
  if(explicitModule){
    const body=text.replace(/\b(?:home module|home widget|module|widget|panel)\b/g,'').replace(/\b(?:on|from|to) home\b/g,'').replace(/\s+/g,' ').trim();
    for(const [key,name]of Object.entries(MODULES)){
      const aliases=[name,key,...(key==='week'?['planner']:[])],
        on=toggle(body,aliases),
        tail=aliases.map(norm).find(n=>body===n+' wide'||body==='make '+n+' wide'||body==='widen '+n),
        top=aliases.map(norm).find(n=>body==='move '+n+' to the top'||body==='put '+n+' first'),
        remove=aliases.map(norm).find(n=>body==='remove '+n||body==='add '+n),
        reset=aliases.map(norm).find(n=>body==='reset '+n+' size'||body==='restore '+n+' to medium size');
      let action=on!==undefined?on?'show':'hide':tail?'wide':top?'top':remove?body.startsWith('add ')?'show':'hide':null;
      if(key==='help'&&(reset||tail||top))return ui(['Home','Help'],'Help stays above the Home modules; use its switch in Edit Home.');
      if(reset)return ui(['Home',name,'Size and place','Medium']);
      if(!action)continue;
      if(['work','reader'].includes(key))return ui(['Home',name,'Size and place'],name+' is a required Home panel. Use its Size and place menu to arrange it.');
      return card('module',{key,action},action[0].toUpperCase()+action.slice(1)+' '+name+' on Home.');
    }
  }
  for(const [id,name]of allFeatures){
    const aliases=[id,name,words(id)],explicit=aliases.map(n=>norm(n)+' feature'),on=toggle(text,explicit.concat(id==='grades'?[]:aliases));
    if(on===undefined)continue;
    if(['pony','dashboard','planner'].includes(id)&&!on)return ui(id==='pony'?['Canvas Harness extension popup','Companion']:['Make it yours','Features',name],id==='pony'?'Open the extension popup > Companion to turn the companion off.':'Open Make it yours > Features > '+name+' to review dependent features before turning it off.');
    return card('feature',{id,on},(on?'Enable ':'Disable ')+name+'. Reload Canvas after saving.');
  }
  for(const [id,name]of Object.entries(SKILLS)){const on=toggle(text,[name+' skill',id+' skill']);if(on!==undefined)return card('skill',{skill:id,on},(on?'Enable ':'Disable ')+name+'.');}
  for(const [key,values]of Object.entries(ENUMS)){
    const ns=names(key);
    for(const n of ns){
      const atom=escape(n),m=new RegExp('^(?:(?:set|change|switch|make) (?:the |my )?)?'+atom+'(?: to| as| is)? (.+)$').exec(text)||new RegExp('^(.+) '+atom+'$').exec(text);
      if(!m)continue;
      const value=valueFor(key,m[1]);
      if(value!==undefined)return setting(key,value);
      if(/^(?:set|change|switch|make)\b/.test(text))return clarify('Choose '+values.map(v=>v===''?'None':v).join(', ')+' for '+label(key)+'.');
    }
    if(ns.some(n=>text==='reset '+n||text==='restore default '+n))return setting(key,DEFAULTS[key]);
  }
  if(/^(?:no|remove|clear|turn off) (?:the |my )?scene(?: theme)?$/.test(text))return setting('sceneTheme','');
  if(/^(?:dark|light)(?: mode| theme)?$/.test(text))return setting('theme',text.split(' ')[0]);
  if(/^(?:no|remove|clear) (?:the )?(?:module )?frames?$/.test(text))return setting('panelFrame','none');
  if(/^(?:reset|restore default) night art$/.test(text))return setting('nightArt',0);
  const night=/^(?:set |change )?(?:night art|artwork at night)(?: to)? (\d+(?:\.\d+)?)%?$/.exec(text);if(night)return setting('nightArt',Math.round(Number(night[1])));
  if(/^(?:reset|restore default) bedtime$/.test(text))return setting('bedtime','22:30');
  const bed=/^(?:set |change )?bedtime(?: to)? (\d{1,2}):(\d{2})(?: (am|pm))?$/.exec(text);
  if(bed){let h=Number(bed[1]);if(bed[3]&&(h<1||h>12))return clarify('Choose a valid bedtime.');if(bed[3])h=h%12+(bed[3]==='pm'?12:0);return setting('bedtime',String(h).padStart(2,'0')+':'+bed[2]);}
  const sourceUI=uiControlMore(text,options);if(sourceUI)return sourceUI;
  const navigation=/^(?:open|go to|show me|take me to) (?:the |my )?(.+?)(?: workspace| tab)?$/.exec(text);
  if(navigation){
    const tab=TABS[navigation[1]];
    if(tab)return card('navigate',{tab},'Open '+navigation[1]+'.');
    if(navigation[1]==='review')return ui(['Workspace','Review']);
    if(/^(?:market|add ons)$/.test(navigation[1]))return ui(['Canvas Harness extension popup','Add-ons','Open the market']);
    if(/^(?:tools|calculator|quick open|gpa)$/.test(navigation[1]))return ui(['Tools',navigation[1]==='tools'?'Quick open':navigation[1]]);
  }
  const pet=/^(?:set |change |make )?(?:my |the )?(?:pet|biscuit|companion) (enabled|name|knowledge|roam|size|nudges|gear|coat|harness)(?: to)? (.+)$/.exec(text);
  if(pet){
    const [,key,value]=pet;
    if(key==='enabled'&&/^(?:true|false|on|off)$/.test(value))return settingPetEnabled(/^(?:true|on)$/.test(value));
    if(key==='nudges'&&['helpful','quiet'].includes(value))return card('setting',{key:'pet.nudges',value},'Set companion reminders to '+value+'.');
    if(key==='name')return ui(['Make it yours','Pony','Name'],'Open Make it yours > Pony > Name and enter the name (up to 24 characters).');
    if(!PET_VALUES[key]?.includes(value))return clarify('Choose '+(PET_VALUES[key]||[]).join(', ')+' for companion '+key+'.');
    return ui(['Make it yours','Pony',({roam:'Where it goes',nudges:'Reminders',knowledge:'How much Biscuit knows',gear:'Tack',harness:'Harness',coat:'Coat',size:'Size'})[key],value]);
  }
  const controls=list(options.controls||options.inventory?.controls);
  for(const c of controls){
    if(!c.ui?.path)continue;
    const phrases=list(c.wordings).concat(c.label?[c.label]:[]).map(norm),
      where='where is '+norm(c.label)+' in '+norm(c.ui.path.slice(0,-1).join(' > ')),
      help='help me use '+norm(c.label)+' in '+norm(c.ui.path.slice(0,-1).join(' > '));
    if(phrases.includes(text)||text===where||text===help)return ui(c.ui.path);
  }
  if(/^(?:use|apply|turn off|reset|remove|uninstall|delete)\b/.test(text)&&/\b(?:market|installed|theme|scene|pet pack|companion pack|preset|artwork pack|kit|media)\b/.test(text)){
    const section=/\b(?:pet|companion)\b/.test(text)?'Companion':/\b(?:artwork|art|kit|media)\b/.test(text)?'Artwork':/\bfeature\b/.test(text)?'Features':'Look',
      op=/\breset\b/.test(text)?'Reset to how it came':/\b(?:remove|uninstall|delete)\b/.test(text)?'Remove':/\b(?:turn off|stop using)\b/.test(text)?section==='Companion'?'Built-in companion':'Use default theme':'Select the installed item';
    return ui(['Make it yours',section,'Installed items',op],'Open Make it yours > '+section+' and choose the named installed item, then '+op+'.');
  }
  if(!text.includes(' ')){
    const known=knownWord(text,s,options)||
      list(s.catalogue).some(v=>[v?.name,v?.title,...list(v?.aliases)].some(n=>typeof n==='string'&&norm(n)===text))||
      [
        s.companion?.name,
        s.pet?.name,
        ...Object.keys(TABS),
        'grade',
        'score',
        'scores',
        'marks',
        'note',
        'notes',
        'focus',
        'timer',
        'help',
        'hi',
        'hello',
        'thanks',
        'undo',
        'stop',
        'pause',
        'resume',
        'yes',
        'no',
        'ok',
        'okay',
        'biscuit',
        'pet',
        'companion',
        ...list(options.knownCommands),
        ...allFeatures.keys(),
        ...allFeatures.values(),
        ...Object.values(MODULES),
        ...Object.values(ENUMS).flat()
      ].some(n=>
        n&&norm(n)===text),
      selected=!!(s.selectedItemId||
        s.itemId||
        s.page?.itemId||
        s.selected?.id||
        session.itemId||
        session.lastItemId||
        list(session.items||session.lastItems).some(v=>['assignment','file','page','course','note','grade'].includes(v?.kind)));
    if(!known&&!selected)return clarify();
  }
  return null;
 }
 function settingPetEnabled(value){return card('setting',{key:'pet.enabled',value},value?'Show the companion.':'Hide the companion. Treats and level are kept.');}
 function knownWord(text,s,options){
   if(list(options.knownNames||s.knownNames).some(v=>norm(v)===text))return true;
   const subjects=['math','science','history','english','ela','languages','arts','technology','tech','humanities'];
   if(subjects.includes(text))return true;
   return list(s.courses).concat(list(s.workItems),list(s.assignments),list(s.files),list(s.notes)).some(row=>
     [row?.name,row?.title,row?.shortName,row?.course_code,...list(row?.aliases)].some(value=>{
     if(typeof value!=='string')return false;
     const tokens=norm(value).split(' ');
     return norm(value)===text||
       text.length>=3&&tokens.some(w=>w.startsWith(text))||
       tokens.length>1&&(tokens.map(w=>w[0]).join('')===text||tokens.map(w=>w==='ap'||w==='ib'?w:w[0]).join('')===text);
   }));
 }
 function uiControlMore(text,options){
  const result=uiControl(text,options);if(result)return result;
  const source=options.controls||options.inventory?.controls;
  // Only the default supplemental pass has this restricted wording grammar.
  if(!source&&!/^(?:reset |restore default |set companion |change my companion )/.test(text))return null;
  // Keep custom inventories live; cache only the eligible built-in rows, in order.
  const rows=source?list(source):uiCatalogue?(uiMoreCatalogue??=uiCatalogue.filter(c=>c.family==='pet-value'||c.family==='setting'&&c.operation==='reset')):[];
  for(const c of rows){
   if(!c.ui?.path)continue;
   const n=norm(c.label),key=words(c.key),value=norm(c.value===''?'none':String(c.value));
   if(c.family==='setting'&&c.operation==='reset'&&(text==='reset '+n||text==='restore default '+n))return ui(c.ui.path);
   if(c.family==='pet-value'&&(text==='set companion '+key+' to '+value||text==='change my companion '+key+' to '+value))return ui(c.ui.path);
  }
  return null;
 }
 const api={propose,evaluate:propose,names,ENUMS,DEFAULTS,MODULES};root.ReserveBiscuitControls=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
