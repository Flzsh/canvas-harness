'use strict';
// After a submit, the Hammer's paper chips are tossed with keyframes from toss(), whose first frame is 'none'; the chips
// added ' scale(.45)' to every frame (and a second tool's 14 shards ' scale(n)'), and 'none scale(.45)' is not a transform, so the browser warned "Invalid keyframe
// value for property transform: none scale(.45)" and dropped that frame (seen on the real page in Preview 7).
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../extension/play-tools.js'),'utf8');

test('no keyframe appends a transform function to a frame that may be none',()=>{
 // every place that builds a keyframe by adding to f.transform must handle 'none' first
 const adds=[...src.matchAll(/transform:\s*([^,}]*f\.transform[^,}]*)/g)].map(m=>m[1]);
 assert.ok(adds.length>=1,'the chip keyframes are still built from toss() frames');
 for(const expr of adds)if(/f\.transform\s*\+/.test(expr))assert.match(expr,/f\.transform\s*===\s*'none'/,expr);
});

test("the chip keyframes give 'scale(.45)' for a 'none' frame and keep the others",()=>{
 const line=src.split('\n').find(l=>/ch\.animate\(k\.map\(f\s*=>/.test(l));assert.ok(line,'chip animation line');
 const expr=line.match(/k\.map\((f\s*=>\s*\(\{[^]*?\}\))\)/)[1];
 const fn=eval(expr);
 assert.equal(fn({transform:'none'}).transform,'scale(.45)');
 assert.equal(fn({transform:'translate(1px,2px) rotate(3deg)'}).transform,'translate(1px,2px) rotate(3deg) scale(.45)');
});
