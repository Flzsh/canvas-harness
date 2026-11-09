'use strict';
// On battery the moving drawings play at half rate (owner, 2026-11-05): Extra high and High drop to the slow film
// (scenes 12 fps, minis 6), Medium already plays it, Low has no film; plugged in, the chosen film is used.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Motion=require('../extension/motion.js');
test('the film level on battery',()=>{
 for(const level of [undefined,'full','calm'])assert.equal(Motion.batteryFilm(level,true),'slow');
 assert.equal(Motion.batteryFilm('slow',true),'slow');assert.equal(Motion.batteryFilm('off',true),'off');
 for(const level of ['full','calm','slow','off',undefined])assert.equal(Motion.batteryFilm(level,false),level,'plugged in: as chosen');
});
test('every rate the film clock uses goes through the battery level',()=>{
 const src=fs.readFileSync(path.join(__dirname,'..','extension','motion.js'),'utf8');
 assert.doesNotMatch(src,/FILM_LEVELS\[container\.dataset\?\.gFilm\]/,'no rate reads the chosen level directly');
 assert.equal((src.match(/FILM_LEVELS\[filmLevelOf\(container\)\]/g)||[]).length,2);
});
