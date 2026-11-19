'use strict';
// Make it yours > Look with a scene on: the theme's two colour boxes (page and accent, light and dark) were given a saved
// Page colour NAME ("paper", "accent"), and the browser warned 'The specified value "paper" does not conform to the
// required format' each time a scene was picked (Preview 7, real page). The boxes now take only #rrggbb values.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../extension/customize-ui.js'),'utf8');
test('the make-color boxes only ever get a #rrggbb value',()=>{
 const i=src.indexOf('data-rd-field="make-color"');assert.ok(i>0,'the colour boxes are still drawn');
 const block=src.slice(src.lastIndexOf('const colorFields',i),i);
 const hexDef=block.match(/const hex=(v=>[^;]*);/);assert.ok(hexDef,'a #rrggbb check sits before the value');
 const hex=eval(hexDef[1]);
 assert.equal(hex('paper'),'');assert.equal(hex('accent'),'');assert.equal(hex(undefined),'');assert.equal(hex('#FBF3E4'),'#FBF3E4');
 assert.match(block,/value=hex\(layer\.colors\?\.\[mode\]\?\.\[key\]\)\|\|hex\(p\[key\]\)\|\|/,'both the saved and the scene colour pass the check');
});
