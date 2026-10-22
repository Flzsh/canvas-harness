'use strict';
// Scripted edits once wrote UTF-8 text through a Latin-1 step (a middle dot became two characters in the pony's menu,
// and a quote mark became a control character). Our own text files must never carry double-encoded sequences or C1
// control characters; the vendored libraries are left alone.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..','extension'),TEXT=/\.(js|mjs|css|html|json)$/;
const BAD=/\u00c2[\u00a0-\u00bf]|\u00e2\u20ac|\u00c3[\u0080-\u00bf]|[\u0080-\u009f]/;
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name==='vendor'?[]:e.isDirectory()?files(path.join(dir,e.name)):TEXT.test(e.name)?[path.join(dir,e.name)]:[]);
test('extension text files have no double-encoded UTF-8 or stray control characters',()=>{
 const bad=files(root).filter(f=>BAD.test(fs.readFileSync(f,'utf8'))).map(f=>path.relative(root,f));
 assert.deepEqual(bad,[]);
});
test('the pattern catches the two mistakes seen so far',()=>{
 assert.ok(BAD.test('Latin '+String.fromCharCode(0xc2,0xb7)+' in 1 day'));assert.ok(BAD.test('content:'+String.fromCharCode(0x81)+'C'));assert.ok(!BAD.test('Latin '+String.fromCharCode(0xb7)+' in 1 day '+String.fromCharCode(0x201c)));
});
