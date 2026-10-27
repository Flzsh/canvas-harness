'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Controls=require('../extension/biscuit-controls.js');
const snapshot=patch=>({now:1792684800000,timeZone:'UTC',settings:{showGrades:false},courses:[],workItems:[],...patch});
const expect=(text,action,fields,s=snapshot(),session={})=>{const result=Controls.propose(text,s,session);assert.ok(result,'missing proposal: '+text);assert.equal(result.action,action,text);assert.equal(result.next.action,action,text);assert.deepEqual(result.next.fields,fields,text);assert.equal(result.route,'local',text);assert.equal(result.routing.route,'local',text);return result;};

test('grade visibility phrases have the actual setting payload, with no item or minute fields',()=>{
 for(const text of ['hide grade','hide grades','hide my scores','hide my score','no grades','grades off','grade off','stop showing grades',"don't show grades",'do not display my marks','please hide grades','could you please hide my scores?']){const r=expect(text,'setting',{key:'showGrades',value:false});assert.deepEqual(r.items,[]);}
 for(const text of ['show grade','show grades','show my scores','grades on','unhide grades','turn on my grades'])expect(text,'setting',{key:'showGrades',value:true});
 expect('disable Grades feature','feature',{id:'grades',on:false});
 expect('hide Grades module on Home','module',{key:'grades',action:'hide'});
});

test('standalone none always asks; scene and theme pickers offer safe choices without applying one',()=>{
 for(const s of [snapshot(),snapshot({selectedItemId:'task'})]){const r=expect('none','none',{},s);assert.equal(r.clarify,true);assert.match(r.message,/which|choice/i);}
 const r=Controls.propose('none',snapshot(),{picker:{kind:'scene',open:true}});assert.equal(r.action,'none');assert.equal(r.clarify,true);assert.ok(r.choices.some(v=>v.label==='None'&&v.fields.key==='sceneTheme'&&v.fields.value===''));assert.ok(r.choices.some(v=>v.fields.value==='sea'));assert.deepEqual(r.next.fields,{});
 const theme=Controls.propose('none',snapshot({picker:{kind:'theme',open:true}}));assert.equal(theme.action,'none');assert.deepEqual(theme.next.fields,{});assert.ok(theme.ui.path.includes('Theme'));
 expect('set scene theme to none','setting',{key:'sceneTheme',value:''});expect('no scene','setting',{key:'sceneTheme',value:''});
});

test('single-word junk is guarded while known names, commands and selected context pass through',()=>{
 assert.equal(Controls.propose('wombat',snapshot()).clarify,true);
 for(const text of ['Astronomy','Orbit','Pepper','hello','pause','focus'])assert.equal(Controls.propose(text,snapshot({courses:[{id:'c',name:'Astronomy'}],workItems:[{id:'a',title:'Orbit'}],companion:{name:'Pepper'}})),null,text);
 assert.equal(Controls.propose('wombat',snapshot({selectedItemId:'a'})),null);
 assert.equal(Controls.propose('wombat',snapshot(),{lastItemId:'a'}),null);
});

test('control dispatch leaves unrelated negation, AI privacy and note payloads alone',()=>{
 for(const text of ['explain this chapter but do not include grades','explain my feedback, never include scores','plan my evening but do not duplicate my saved blocks',"note: don't forget your goggles",'AI: explain the instructions; do not reveal my grades',"write a poem, don't use blue","don't include grades in the explanation","don't reschedule my lab"] )assert.equal(Controls.propose(text,snapshot()),null,text);
 for(const text of ["don't hide grades",'never change my theme','do not turn on motion']){const r=expect(text,'none',{});assert.equal(r.clarify,true);}
 for(const text of ['if I hide grades what happens?','how do I hide grades?','can I show grades?'])assert.equal(Controls.propose(text,snapshot()),null,text);
});

test('values and reset proposals stay inside the supported settings domain',()=>{
 for(const [text,key,value]of [['set page tint to sage','pageTint','sage'],['change panel frame to none','panelFrame','none'],['set course navigation to bottom','courseNavigation','dock'],['set motion to off','motion','off'],['set night art to 50%','nightArt',50],['reset grades','showGrades',false],['reset page tint','pageTint','paper']])expect(text,'setting',{key,value});
 expect('set bedtime to 9:45 pm','setting',{key:'bedtime',value:'21:45'});expect('set biscuit offers to off','setting',{key:'biscuitOffers',value:false});expect('reset bedtime','setting',{key:'bedtime',value:'22:30'});expect('reset biscuit offers','setting',{key:'biscuitOffers',value:true});
 for(const text of ['set page tint to plutonium','set bedtime to 29:99','set night art to 101'])assert.equal(Controls.propose(text,snapshot()).action,'none',text);
 const legacy=expect('set theme to system','none',{});assert.equal(legacy.ui?.path,undefined);assert.match(legacy.message,/theme/i);
 assert.equal(Controls.propose('set constructor to off',snapshot()),null);
 assert.equal(Controls.propose('set xp to 9999',snapshot()),null);
});

test('Home and feature controls use existing actions; protected panels and dependency switches hand off',()=>{
 expect('add Notes module to Home','module',{key:'notes',action:'show'});expect('put Focus timer module first','module',{key:'timer',action:'top'});expect('make Clock module wide','module',{key:'clock',action:'wide'});
 for(const text of ['hide Up next module on Home','remove Assignment details module from Home','turn off Dashboard & assignments feature','turn off Planner & home widgets feature']){const r=expect(text,'none',{});assert.ok(r.ui.path.length>=2,text);}
 assert.equal(Controls.propose('turn off Companion feature',snapshot()),null);
 const reset=expect('reset Notes module size','none',{});assert.deepEqual(reset.ui.path,['Home','Notes','Size and place','Medium']);
 expect('enable Focus room feature','feature',{id:'focus-room',on:true});expect('disable Deadline watch skill','skill',{skill:'deadline',on:false});
});

test('companion visibility reaches the pet setting before bare feature aliases',()=>{
 for(const name of ['companion','pet','Biscuit']){for(const text of ['show my '+name,'turn on my '+name,'unhide the '+name,'bring back my '+name])expect(text,'setting',{key:'pet.enabled',value:true});for(const text of ['hide my '+name,'turn off my '+name])expect(text,'setting',{key:'pet.enabled',value:false});}
 assert.equal(Controls.propose('enable Companion feature',snapshot()),null);
 assert.equal(Controls.propose('turn off Companion feature',snapshot()),null);
});

test('proposals are pure; arbitrary settings, properties and disabled features are never executed',()=>{
 const s=snapshot({settings:{showGrades:false,privateValue:'keep'},pet:{xp:30,treats:5}}),before=JSON.stringify(s),session={picker:{kind:'scene',open:true}},beforeSession=JSON.stringify(session);
 for(const text of ['hide grades','none','use my installed theme','set companion coat to rose','set xp to 1000000'])Controls.propose(text,s,session);
 assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(session),beforeSession);
 const handoff=expect('remove the installed theme','none',{},s);assert.ok(handoff.ui.path.includes('Remove'));
});

// Training inventory and authoring-corpus validation belong to the private development suite.
