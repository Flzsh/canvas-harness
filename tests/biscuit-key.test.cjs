'use strict';
// Biscuit as the key to Canvas Harness: nearly everything CH can do or switch, said in plain words to the Ask line.
// now = Mon 11 May 2026, 12:00 in New York. Everything here is understood locally (never sent to the AI).
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const P=require(path.resolve(__dirname,'../extension/biscuit-parse.js'));
const now=Date.parse('2026-05-11T16:00:00Z'),courses=[{id:'calc',name:'Calculus',shortName:'MATH 201'},{id:'chem',name:'Chemistry',course_code:'CHEM 101'},{id:'bio',name:'Biology'},{id:'lit',name:'Literature'},{id:'eng',name:'English'}],workItems=[{id:'titration',title:'Titration Lab',course:'Chemistry',courseId:'chem',dueAt:'2026-05-15T20:00:00Z',kind:'lab'}];
const ctx=(extra={})=>({now,timeZone:'America/New_York',courses,workItems,focus:{running:false},skills:{},...extra});
const expect=(q,intent,fields={})=>{const out=P.parse(q,ctx());assert.ok(Array.isArray(out)&&out.length,q+': nothing understood');assert.equal(out[0].intent,intent,q);for(const [k,v] of Object.entries(fields))v instanceof RegExp?assert.match(String(out[0].fields[k]),v,q+' -> '+k):assert.deepEqual(out[0].fields[k],v,q+' -> '+k);assert.ok(typeof out[0].preview==='string'&&out[0].preview.length&&out[0].preview.length<=60,q+': a short preview');assert.ok(out.every(c=>c.intent!=='ai'),q+': must not go to the AI');};
const cases=(name,list,intent)=>{for(const [q,fields] of list)test(name+': '+q,()=>expect(q,intent,fields));};

// appearance settings: the customization model's own keys and values
cases('setting',[
 ['dark mode',{key:'theme',value:'dark'}],['turn on dark mode',{key:'theme',value:'dark'}],['light mode',{key:'theme',value:'light'}],['make it light',{key:'theme',value:'light'}],
 ['starfield theme',{key:'sceneTheme',value:'stars'}],['switch to the starfield',{key:'sceneTheme',value:'stars'}],['under the sea',{key:'sceneTheme',value:'sea'}],['sea theme',{key:'sceneTheme',value:'sea'}],['starry night theme',{key:'sceneTheme',value:'starry'}],['blueprint theme',{key:'sceneTheme',value:'blueprint'}],['no scene theme',{key:'sceneTheme',value:''}],
 ['courses along the bottom',{key:'courseNavigation',value:'dock'}],['use the dock',{key:'courseNavigation',value:'dock'}],['courses across the top',{key:'courseNavigation',value:'topbar'}],['courses on the side',{key:'courseNavigation',value:'sidebar'}],
 ['bigger dock',{key:'dockSize',value:'large'}],['small dock',{key:'dockSize',value:'small'}],
 ['compact banner',{key:'bannerSize',value:'compact'}],['large banner',{key:'bannerSize',value:'large'}],
 ['show grades',{key:'showGrades',value:true}],['hide my grades',{key:'showGrades',value:false}],['hide bookmarks',{key:'showBookmarks',value:false}],['show bookmarks',{key:'showBookmarks',value:true}],['hide course icons',{key:'showCourseIcons',value:false}],
 ['clean look',{key:'surfaceStyle',value:'clean'}],['high contrast',{key:'surfaceStyle',value:'contrast'}],['paper look',{key:'surfaceStyle',value:'paper'}],
 ['sage background',{key:'pageTint',value:'sage'}],['blush page',{key:'pageTint',value:'blush'}],
 ['rounded course cards',{key:'courseCardStyle',value:'rounded'}],['minimal cards',{key:'courseCardStyle',value:'minimal'}],['stitched frames',{key:'panelFrame',value:'stitch'}],['no frames',{key:'panelFrame',value:'none'}],
],'setting');
cases('preset',[['study layout',{preset:'study'}],['focus layout',{preset:'focus'}],['reset the layout',{preset:'studio'}]],'preset');

// features: the feature catalogue's ids, and Full / Lite
cases('feature',[
 ['turn off play tools',{id:'play',on:false}],['turn on the pdf reader',{id:'pdf',on:true}],['disable course art',{id:'course-art',on:false}],['turn off animations',{id:'motion',on:false}],['no motion',{id:'motion',on:false}],['enable the gpa calculator',{id:'gpa',on:true}],['turn off scene themes',{id:'scene-themes',on:false}],['turn on math tools',{id:'math',on:true}],
],'feature');
cases('features',[['lite mode',{preset:'lite'}],['switch to lite',{preset:'lite'}],['full mode',{preset:'full'}],['turn everything on',{preset:'full'}]],'features');

// Home modules: the arrangement's own keys
cases('module',[
 ['hide the clock',{action:'hide',key:'clock'}],['show my notes',{action:'show',key:'notes'}],['put the timer first',{action:'top',key:'timer'}],['timer on top',{action:'top',key:'timer'}],['move up next to the top',{action:'top',key:'work'}],['make the planner wide',{action:'wide',key:'week'}],['hide course information',{action:'hide',key:'context'}],['show messages on home',{action:'show',key:'messages'}],
],'module');

// going places
cases('navigate',[['go to the planner',{tab:'planner'}],['open messages',{tab:'messages'}],['open assignments',{tab:'assignments'}],['go home',{tab:'home'}],['open the course hub',{tab:'course-hub'}],['open materials',{tab:'materials'}],['open grades',{tab:'grades'}],['go to calc',{courseId:'calc'}]],'navigate');

// Biscuit's own skills and manners
cases('skill',[['turn off wellbeing',{skill:/wellbeing/i,on:false}],['stop the deadline reminders',{skill:/deadline/i,on:false}],['turn on inbox watch',{skill:/inbox/i,on:true}]],'skill');
cases('quiet',[['be quiet for an hour',{minutes:60}],['quiet for 30 minutes',{minutes:30}],['be quiet until 3',{minutes:180}]],'quiet');

// writing things down and keeping things
cases('note',[['note: bring the graph',{text:'bring the graph'}],['write down bring goggles',{text:'bring goggles'}],['add a note call the lab partner',{text:'call the lab partner'}]],'note');
cases('bookmark',[['bookmark the titration lab',{itemId:'titration'}],['save titration lab for later',{itemId:'titration'}]],'bookmark');

// play tools by name
cases('play',[['bomb the page',{tool:'bomb'}],['black hole',{tool:'blackhole'}],['hammer time',{tool:'hammer'}],['balloons',{tool:'balloon'}],['let me paint',{tool:'painter'}],['plant a garden',{tool:'garden'}]],'play');

// taking it back, and finding out
cases('undo',[['undo',{}],['undo that',{}],['take that back',{}]],'undo');
cases('help',[['what can you do',{}],['help',{}]],'help');

// the earlier intents still win where they apply
test('older intents keep working',()=>{expect('open chemistry','open',{courseId:'chem'});expect('open titration lab','open');expect('25 minute focus','focus',{minutes:25});expect('remind me at 9 to pack my bag','reminder');});
