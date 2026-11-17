'use strict';
// Every call into ReservePacks from the extension either names a function packs.js really exports, or is guarded
// (`?.name?.(`, `typeof ...==='function'`, `if(root.ReservePacks?.name)`). The public customize-ui.js called
// ReservePacks.isCurrent(...) in the kit list although the public packs.js has no isCurrent, so "Save as kit" and
// "Reset this course's artwork" threw "root.ReservePacks?.isCurrent is not a function" (seen 2026-11-14, Preview 7,
// Make it yours > Courses) and the kit list could not draw.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const EXT=path.join(__dirname,'..','extension');
const packs=fs.readFileSync(path.join(EXT,'packs.js'),'utf8');
const api=new Set((packs.match(/const api=Object\.freeze\(\{([^}]*)\}\)/)||[,''])[1].split(',').map(x=>x.trim().split(':')[0]).filter(Boolean));
test('the packs API is read from packs.js',()=>{assert.ok(api.has('installLocal')&&api.size>5,[...api].join(','));});
test('no unguarded call to a ReservePacks function that packs.js does not export',()=>{
 const bad=[];
 for(const f of fs.readdirSync(EXT).filter(f=>f.endsWith('.js')&&f!=='packs.js')){
  const s=fs.readFileSync(path.join(EXT,f),'utf8');
  for(const m of s.matchAll(/ReservePacks\??\.([A-Za-z]+)(\?\.)?\(/g)){
   const name=m[1];if(api.has(name)||m[2])continue;
   // guarded by a check of the same name just before (if(...?.name)..., typeof ...name==='function', name? a(...) : b)
   const before=s.slice(Math.max(0,m.index-160),m.index);
   if(new RegExp('ReservePacks\\??\\.'+name+'(\\)|\\s*\\?|===|!==|&&)').test(before)||new RegExp("typeof [^;]*ReservePacks\\??\\."+name).test(before))continue;
   bad.push(`${f}@${m.index}: ${name}`);
  }
 }
 assert.deepEqual(bad,[]);
});
