const test=require('node:test'),assert=require('node:assert/strict');
require('../extension/pet-art.js');
const B=require('../extension/pony-brain.js');require('../extension/pony-ask.js');
const P=require('../extension/pets.js');
// (4.2: the game of 4.1.0 is gone; its fields, where a saved record has them, are kept and cleaned as 4.1.0 cleaned them)
test('stored pet data is cleaned to known values and bounded counters',()=>{
 const p=P.clean({name:'  Oats '.padEnd(60,'x'),coat:'nope',harness:'gold',roam:'everywhere',treats:500,xp:-4,streak:3,best:1,streakDay:'2026-13-99x',enabled:'yes'});
 assert.equal(p.name.length,24);assert.equal(p.coat,'oat');assert.equal(p.harness,'gold');assert.equal(p.roam,'page');assert.equal(p.treats,99);assert.equal(p.xp,0);
 assert.equal(p.best,3,'best is never below the current run');assert.equal(p.streakDay,'');assert.equal(p.enabled,true);
 assert.deepEqual(P.clean(null),{...P.DEFAULTS,brain:B.cleanLearning(),skills:B.cleanSkills(),reminders:[],routines:[]});assert.deepEqual(P.clean(P.clean({coat:'ink',size:'large'})),P.clean({coat:'ink',size:'large'}));
});
test('the drawing has every pose the stylesheet poses, and no script or outside reference',()=>{
 const fs=require('node:fs'),css=fs.readFileSync(require('node:path').join(__dirname,'../extension/pet.css'),'utf8'),svg=globalThis.ReservePetArt.svg({title:'A <b>"pony"</b>'});
 for(const pose of ['walk','trot','lie','sleep','read','eat','cheer','flag','fall','held'])assert.ok(css.includes(`data-pose=${pose}`),pose);
 assert.ok(!/<script|href=|url\(|<b>/.test(svg));assert.match(svg,/aria-label="A b"pony"\/b"|aria-label="A bpony\/b"/);
});
