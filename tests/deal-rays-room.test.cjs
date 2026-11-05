// The dealt card's frame and rays (owner, 2026-11-05: the rays covered words; then "the outline should be in artistic
// form connecting with the effect, and also animated", draft A, for every rarity). Every dealt card is framed by hand
// (an ink line and the tier's wash), its rays grow out of that frame's edge and stay inside the tray, clear of the
// shelf's label; a glint runs round the frame for a minute; reduced motion draws the frame still.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..','extension',file),'utf8');
// the public tree spreads long lines (scripts/readable-lines.cjs): the code is read joined up
const js=read('play-tools.js').replace(/\n\s*/g,''),css=read('play-tools.css');

test('the rays are sized to the room inside the tray and keep clear of the shelf label',()=>{
  assert.match(js,/let room = tw > 0 && th > 0 \? Math\.min\(60, cx, tw - cx, cy, th - cy\) - 2 : 58;/);
  assert.match(js,/if \(tw > 0 && th > 0 && cx - room < 70\) room = Math\.min\(room, cy - label - 2\);/);
  const line=read('play-tools.js').split('\n').find(l=>l.includes('cx - room < 70'));
  assert.ok(line&&!line.slice(0,line.indexOf('cx - room < 70')).includes('//'),'the label check runs (it is not inside a comment)');
  assert.match(js,/d = Math\.min\(34 \+ Math\.random\(\) \* 30, Math\.max\(24, room\)\)/,'the sparkles fly no further than the rays');
});

test('every tier: a hand-drawn frame in its colour, rays from the frame edge, more and longer the rarer',()=>{
  assert.match(js,/const TIERCOL = \{ common: '#D9CDB8', uncommon: '#A9BC8C', rare: '#9DB4C8', epic: '#DE9A7C', legendary: GOLD \};/);
  assert.match(js,/const RAYS = \{ common: 8, uncommon: 10, rare: 12, epic: 14, legendary: 16 \}/);
  assert.match(js,/e = rim\(a, A, B, 9\) \+ 1\.5, L = Math\.min\(room, e \+/,'a ray starts at the frame edge and ends inside the room');
  assert.match(js,/dealtCard\(b, tier\); \} else if \(b\) \{ b\.classList\.add\('chb-framed'\); b\.insertAdjacentHTML\('beforeend', cardFrame\(b, tier, false\)\); \} \}/);
});

test('the frame draws on, the wash follows, a glint runs round it for a minute; reduced motion keeps it still',()=>{
  assert.match(css,/\.chb-frame-live \.chb-frame-ink\{stroke-dasharray:1;stroke-dashoffset:1;animation:chb-frame-draw/);
  assert.match(css,/\.chb-frame-glint\{[^}]*animation:chb-frame-glint 4s linear 1\.4s 15\}/,'about a minute, then it rests');
  assert.match(css,/@media \(prefers-reduced-motion:reduce\)\{\.chb-frame-live path\{animation:none!important/);
  assert.match(css,/#chb-tray button\.chb-reveal>svg:not\(\.chb-rays\):not\(\.chb-spark\):not\(\.chb-frame\)/,'the card face rule leaves the frame alone');
  assert.match(css,/\.chb-dealt \.chb-shelf\{justify-content:center;padding-top:14px;padding-bottom:20px\}/);
});
