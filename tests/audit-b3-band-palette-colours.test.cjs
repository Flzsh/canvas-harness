'use strict';
// Audit B3 (2026-11-14): the band kit accepts a colour as #RRGGBB or as a name from the theme's palette (bg, surface,
// ink, muted, line, accent) for every colour it reads, with no note to the creator. The theme renderer took the shade,
// the fade and the edge colour literally: a pack writing "fade": "bg" (melt the band's foot into the page colour)
// got a black fade, "shade": "surface" a black pool behind the greeting, and an edge colour by name no fill at all.
const {test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHash}=require('node:crypto');
const {createDOM,read}=require('./addons-fixture.cjs');
const before=new Set(Object.keys(globalThis));after(()=>{for(const key of Object.keys(globalThis))if(!before.has(key)&&key.startsWith('Reserve'))delete globalThis[key];});
const Theme=require('../extension/theme-pack.js'),Frame=require('../extension/media-frame.js');
// The rendering fixture of tests/band-kit.test.cjs, taken as it is.
const src=fs.readFileSync(path.join(__dirname,'band-kit.test.cjs'),'utf8'),take=re=>src.match(re)[0];
const {kitFixture,imageBand}=eval('(()=>{'+['const zlib=require("node:zlib");let shade=0;',take(/^const png=.*$/m),take(/^const pic=.*$/m),take(/^const hash=.*$/m),take(/^const palette=.*$/m),take(/^const theme=.*$/m),take(/^const imageBand=.*$/m),take(/^function kitFixture\([\s\S]*?\n\}\n/m)].join('\n')+';return {kitFixture,imageBand};})()');
test('a palette name in shade, fade and edge is the theme’s own colour, in light and dark',async t=>{
 const {pack}=await Theme.validate(imageBand({shade:{color:'surface',strength:.5},fade:{color:'bg'}})),h=kitFixture();t.after(h.remove);
 h.apply(pack);let css=h.css();
 assert.match(css,/rgba\(250,246,238,0\.92\)/,'the foot melts into the light page colour (bg #faf6ee)');
 assert.match(css,/radial-gradient\(ellipse 100% 50% at 0 50%,rgba\(255,252,246,0\.5\)/,'the pool is the light paper (surface #fffcf6)');
 assert.doesNotMatch(css,/rgba\(0,0,0,0\.92\)|at 0 50%,rgba\(0,0,0,0\.5\)/,'never black');
 h.apply(pack,{theme:'dark'});css=h.css();
 assert.match(css,/rgba\(34,32,30,0\.92\)/,'dark page colour (bg #22201e)');assert.match(css,/at 0 50%,rgba\(45,42,39,0\.5\)/,'dark paper (surface #2d2a27)');
 const kept=(await Theme.validate(imageBand({keep:{x:.45,y:.3,w:.1,h:.4},edge:{mode:'fade',color:'bg'}}))).pack,e=kitFixture();t.after(e.remove);
 e.apply(kept);e.load();const fill=e.shown().map(node=>node.style.background||'').join(' ');
 assert.doesNotMatch(fill,/[,(]\s*bg\s*[,)]/,'no palette name reaches the CSS');
 assert.match(fill,/#faf6ee/i,'the edge fills with the page colour');
});
