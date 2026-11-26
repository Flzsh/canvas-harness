'use strict';
// Under a scene the Planner begins where the scene's picture still is (the picture runs down to the calendar's box):
// the day's page and the calendar's heading row stood on the barn, the sleigh or the fence, and the date could not be read.
// Each lies on a slip of that scene's own paper now. A spread, never padding: nothing in the Planner moves or changes size.
// Soul Passage lays the whole Planner on its rug, so the slip never applies to it.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../extension/widgets.css'),'utf8').replace(/\r?\n\s*/g,' ');
const SCOPE='.rd[data-theme-kit]:not([data-theme-kit=train]) ';
const rule=selector=>{const at=css.indexOf(selector+' {');assert.ok(at>=0,'the rule is there: '+selector);return css.slice(at,css.indexOf('}',at)+1);};

test('under a scene the day page and the calendar heading row each lie on a slip of the scene\'s own paper',()=>{
 for(const part of ['.rd-plan-page','.rd-plan-cal-head']){
  const r=rule(SCOPE+part);
  assert.match(r,/background:\s*color-mix\(in srgb,\s*var\(--rd-surface\) 90%,\s*transparent\)/,part+': the scene\'s paper');
  assert.match(r,/box-shadow:\s*0 0 0 \d+px color-mix\(in srgb,\s*var\(--rd-surface\) 90%,\s*transparent\)/,part+': spread by a shadow');
  assert.doesNotMatch(r,/padding|margin|width|height|display|position/,part+': nothing moves or changes size');
 }
});

test('the slip is for scenes only, and never for Soul Passage',()=>{
 for(const part of ['.rd-plan-page','.rd-plan-cal-head']){
  assert.equal(css.includes('.rd[data-theme-kit] '+part+' {'),false,part+': no rule that would reach Soul Passage');
  assert.equal(css.includes('.rd '+part+' {background'),false,part+': no paper without a scene');
 }
});
