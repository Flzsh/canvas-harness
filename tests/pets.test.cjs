const test=require('node:test'),assert=require('node:assert/strict');
require('../extension/pet-art.js');
const P=require('../extension/pets.js');
const {fixture}=require('./pet-fixture.cjs');
test('stored pet data is cleaned to known values and bounded counters',()=>{
 const p=P.clean({name:'  Oats '.padEnd(60,'x'),coat:'nope',harness:'gold',roam:'everywhere',treats:500,xp:-4,streak:3,best:1,streakDay:'2026-13-99x',enabled:'yes'});
 assert.equal(p.name.length,24);assert.equal(p.coat,'oat');assert.equal(p.harness,'gold');assert.equal(p.roam,'page');assert.equal(p.treats,99);assert.equal(p.xp,0);
 assert.equal(p.best,3,'best is never below the current run');assert.equal(p.streakDay,'');assert.equal(p.enabled,true);
 assert.deepEqual(P.clean(null),P.DEFAULTS);assert.deepEqual(P.clean(P.clean({coat:'ink',size:'large'})),P.clean({coat:'ink',size:'large'}));
});
test('finishing work gives a treat and experience, and counts the day once',()=>{
 let pet=P.clean({treats:0});
 let r=P.reward(pet,'done','2026-10-12');assert.equal(r.pet.treats,1);assert.equal(r.pet.xp,10);assert.equal(r.pet.streak,1);
 r=P.reward(r.pet,'done','2026-10-12');assert.equal(r.pet.streak,1,'a second piece of work on the same day does not extend the run');assert.equal(r.pet.treats,2);
 r=P.reward(r.pet,'focus','2026-10-13');assert.equal(r.pet.streak,2);assert.equal(r.pet.best,2);
 r=P.reward(r.pet,'done','2026-10-20');assert.equal(r.pet.streak,1,'a gap starts a new run');assert.equal(r.pet.best,2,'the best run is kept');
 assert.equal(P.reward(pet,'plan','2026-10-12').pet.treats,0,'planning earns experience, not treats');
});
test('levels only rise, report when they are crossed, and open coats in order',()=>{
 assert.equal(P.level(0),1);assert.equal(P.level(29),1);assert.equal(P.level(30),2);assert.equal(P.level(1e6),P.LEVEL_XP.length);
 assert.equal(P.levelProgress(15),.5);assert.equal(P.levelProgress(1e6),1);
 assert.equal(P.reward(P.clean({xp:25}),'done','2026-10-12').leveled,true);assert.equal(P.reward(P.clean({xp:0}),'done','2026-10-12').leveled,false);
 assert.equal(P.unlocked('coat','oat',0),true);assert.equal(P.unlocked('coat','ink',0),false);assert.equal(P.unlocked('coat','ink',P.LEVEL_XP[7]),true);
});
test('a treat is only given when there is one',()=>{
 assert.equal(P.feed(P.clean({treats:0})).fed,0);const fed=P.feed(P.clean({treats:2}));assert.equal(fed.treats,1);assert.equal(fed.fed,1);assert.equal(fed.xp,1);
});
test('the drawing has every pose the stylesheet poses, and no script or outside reference',()=>{
 const fs=require('node:fs'),css=fs.readFileSync(require('node:path').join(__dirname,'../extension/pet.css'),'utf8'),svg=globalThis.ReservePetArt.svg({title:'A <b>"pony"</b>'});
 for(const pose of ['walk','trot','lie','sleep','read','eat','cheer','flag','fall','held'])assert.ok(css.includes(`data-pose=${pose}`),pose);
 assert.ok(!/<script|href=|url\(|<b>/.test(svg));assert.match(svg,/aria-label="A b"pony"\/b"|aria-label="A bpony\/b"/);
});
test('a level says something is unlocked only when a coat or harness opens, and an old run of days is not shown',()=>{
 assert.equal(P.opens(P.LEVEL_XP[7]-1,P.LEVEL_XP[7]),true,'level 8 opens the ink coat');assert.equal(P.opens(P.LEVEL_XP[8]-1,P.LEVEL_XP[8]),false,'level 9 opens nothing');assert.equal(P.opens(P.LEVEL_XP[9]-1,P.LEVEL_XP[9]),false,'level 10 opens nothing');
 const pet=P.clean({streak:5,best:5,streakDay:'2026-10-20'});
 assert.equal(P.currentRun(pet,'2026-10-20'),5);assert.equal(P.currentRun(pet,'2026-10-21'),5,'yesterday still counts');assert.equal(P.currentRun(pet,'2026-11-03'),0,'a run that stopped is not mentioned');
 assert.equal(P.currentRun(P.clean({streak:1,streakDay:'2026-10-20'}),'2026-10-20'),0);assert.equal(P.currentRun(pet,'not a day'),0);
});

// The pony's menu, bubbles and words, on the same simulated page as tests/pets-performance.test.cjs.
// what happened to the key: kept from the browser (prevented), and kept from the page's own handlers (stopped)
const key=(f,k)=>{let prevented=false,stopped=false;f.bubble.emit('keydown',{key:k,target:f.doc.activeElement,preventDefault(){prevented=true;},stopPropagation(){stopped=true;}});return {prevented,stopped};};
const menu=f=>{f.node.emit('click',{preventDefault(){}});return f.bubble;};
test('the menu works from the keyboard: arrows, Home and End move, Escape and Tab close it and focus returns to the pony',()=>{
 const f=fixture({pet:{treats:2}});f.advance(1400);const items=menu(f).children;
 assert.equal(items.length,3);assert.equal(f.doc.activeElement,items[0],'the first item has focus');assert.equal(f.node.attrs['aria-expanded'],'true');
 assert.deepEqual(key(f,'ArrowDown'),{prevented:true,stopped:true},'the page does not also move things');assert.equal(f.doc.activeElement,items[1]);assert.deepEqual(key(f,'a'),{prevented:false,stopped:false},'other keys are left alone');key(f,'ArrowUp');key(f,'ArrowUp');assert.equal(f.doc.activeElement,items[2],'up from the first item wraps to the last');
 key(f,'Home');assert.equal(f.doc.activeElement,items[0]);key(f,'End');assert.equal(f.doc.activeElement,items[2]);
 assert.deepEqual(key(f,'Escape'),{prevented:true,stopped:true},'one Escape closes only the pony menu, not the drawer or menu under it');assert.equal(f.bubble,undefined,'Escape from inside the menu closes it');assert.equal(f.doc.activeElement,f.node,'focus is back on the pony');assert.equal(f.node.attrs['aria-expanded'],'false');
 menu(f);assert.deepEqual(key(f,'Tab'),{prevented:false,stopped:false},'Tab is left to the browser');assert.equal(f.bubble,undefined);assert.equal(f.doc.activeElement,f.node,'Tab moves on from the pony');
 f.controller.destroy();
});
test('choosing a menu item hands keyboard focus back to the pony',()=>{
 for(const action of ['feed','stay','settings']){const f=fixture({pet:{treats:2}});f.advance(1400);const item=menu(f).children.find(n=>n.dataset.petAction===action);item.focus();f.bubble.emit('click',{target:item});assert.equal(f.bubble,undefined,action);assert.equal(f.doc.activeElement,f.node,action+' keeps the keyboard user in place');f.controller.destroy();}
});
test('what the pony says goes to an announcer that exists before anything is said',()=>{
 const f=fixture();f.advance(1400);assert.ok(f.live,'the announcer is there from the start');assert.equal(f.live.attrs.role,'status');assert.equal(f.live.attrs['aria-live'],'polite');assert.ok(!f.live.textContent,'it starts empty');
 f.controller.say('Done. Nicely.');assert.equal(f.live.textContent,'Done. Nicely.');assert.equal(f.bubble.attrs['aria-live'],undefined,'the new bubble is not a second live region');
 f.controller.say('Done. Nicely.');assert.notEqual(f.live.textContent,'Done. Nicely.','the same words again are still a change');assert.equal(f.live.textContent.trim(),'Done. Nicely.');
 f.controller.destroy();
});
test('a due-soon reminder is announced and waits while focus or the pointer is in it',()=>{
 const f=fixture({info:{next:{id:'a1',title:'Lab report',course:'Chemistry',when:'in 40 min',urgent:true}}});f.advance(1400);f.controller.sync();
 assert.equal(f.live.textContent,'Due in 40 min: Lab report');const [open]=f.bubble.children;assert.equal(open.dataset.petAction,'open');
 open.focus();f.bubble.emit('focusin',{target:open});f.advance(30000);assert.ok(f.bubble,'it stays while a button has focus');
 f.node.focus();f.bubble.emit('focusout',{target:open,relatedTarget:f.node});f.advance(10000);assert.ok(f.bubble,'leaving starts the full wait again');f.advance(1100);assert.equal(f.bubble,undefined,'then it goes');assert.equal(f.live.textContent,'','the announcer does not keep old words');
 f.setInfo({next:{id:'a2',title:'Essay',when:'in 2 hours',urgent:true}});f.controller.sync();f.bubble.emit('pointerenter');f.advance(30000);assert.ok(f.bubble,'it stays under the pointer');f.bubble.emit('pointerleave');f.advance(11100);assert.equal(f.bubble,undefined);
 f.controller.destroy();
});
test('the menu shows the run of days only while it lasts, and the focus length chosen in the timer',()=>{
 const f=fixture({pet:{streak:5,best:5,streakDay:'2026-10-01'},info:{today:'2026-10-21'}});f.advance(1400);
 assert.doesNotMatch(menu(f).html,/days in a row/,'an old run is not shown');key(f,'Escape');
 f.setInfo({today:'2026-10-02'});assert.match(menu(f).html,/5 days in a row/);key(f,'Escape');
 f.setInfo({today:'2026-10-02',next:{id:'x',title:'Essay',when:'in 2 days'},focusMinutes:45});const html=menu(f).html;assert.match(html,/Focus 45 min/);assert.doesNotMatch(html,/25 min/);
 f.controller.destroy();
});
test('a level-up says something is unlocked only when it is',()=>{
 for(const [xp,level,unlocked] of [[P.LEVEL_XP[7]-5,8,true],[P.LEVEL_XP[8]-5,9,false],[P.LEVEL_XP[9]-5,10,false]]){
  const f=fixture({pet:{xp}});f.advance(1400);f.controller.celebrate('done',{today:'2026-10-21'});
  assert.match(f.live.textContent,new RegExp(`^Level ${level}!`));assert.equal(/unlocked/.test(f.live.textContent),unlocked,`level ${level}`);f.controller.destroy();
 }
});
test('a reminder raised as the page opens is announced once the announcer is known to the screen reader',()=>{
 const f=fixture({info:{next:{id:'a1',title:'Lab report',when:'in 40 min',urgent:true}}});f.advance(1);f.controller.sync();   // 1 ms: the simulated clock starts at 0
 assert.ok(f.bubble,'the reminder shows at once');assert.ok(!f.live.textContent,'but the brand-new announcer is not filled in the same moment');
 f.advance(700);assert.equal(f.live.textContent,'Due in 40 min: Lab report');f.controller.destroy();assert.equal(f.timers.size,0,'no announcement outlives the pony');
});
test('Escape on the pony itself closes its menu without reaching the page',()=>{
 const f=fixture();f.advance(1400);menu(f);let stopped=false;f.node.emit('keydown',{key:'Escape',preventDefault(){},stopPropagation(){stopped=true;}});assert.equal(f.bubble,undefined);assert.equal(stopped,true);f.controller.destroy();
});
