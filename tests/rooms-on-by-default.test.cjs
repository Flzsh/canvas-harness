'use strict';
// The Focus room, Review deck and Grade impact are on from the start: Full includes them and loads their files, Lite
// leaves them out, and only Developer tools waits to be switched on.
const {test}=require('node:test'),assert=require('node:assert/strict');
const F=require('../extension/features.js');
test('Full includes the three rooms and loads their files',()=>{
 for(const id of ['focus-room','review-deck','grade-impact'])assert.ok(F.presets.full.includes(id)&&!F.presets.lite.includes(id),id);
 const {js,css}=F.resolve('full');
 for(const file of ['focus-room.js','review-deck.js','grade-impact.js'])assert.ok(js.includes(file),file);
 for(const file of ['focus-room.css','review-deck.css','grade-impact.css'])assert.ok(css.includes(file),file);
 assert.ok(!F.presets.full.includes('developer'),'Developer tools stays off until chosen');
});
