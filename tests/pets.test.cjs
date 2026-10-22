const test=require('node:test'),assert=require('node:assert/strict');
require('../extension/pet-art.js');
const B=require('../extension/pony-brain.js');require('../extension/pony-ask.js');
const P=require('../extension/pets.js');
test('stored pet data is cleaned to known values and bounded counters',()=>{
 const p=P.clean({name:'  Oats '.padEnd(60,'x'),coat:'nope',harness:'gold',roam:'everywhere',treats:500,xp:-4,streak:3,best:1,streakDay:'2026-13-99x',enabled:'yes'});
 assert.equal(p.name.length,24);assert.equal(p.coat,'oat');assert.equal(p.harness,'gold');assert.equal(p.roam,'page');assert.equal(p.treats,99);assert.equal(p.xp,0);
 assert.equal(p.best,3,'best is never below the current run');assert.equal(p.streakDay,'');assert.equal(p.enabled,true);
 assert.deepEqual(P.clean(null),{...P.DEFAULTS,brain:B.cleanLearning(),skills:B.cleanSkills(),reminders:[],routines:[]});assert.deepEqual(P.clean(P.clean({coat:'ink',size:'large'})),P.clean({coat:'ink',size:'large'}));
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
