'use strict';
// Every literal SVG path in the shipped drawings must be valid path data: a browser stops drawing a path at the first
// error and logs "<path> attribute d: Expected number" (seen 2026-11-14 from motion.js on the Chemistry scene, whose
// path "M624 99c4 1 8 1 12 0MM691 166..." had a doubled M, so the rest of that path was never drawn).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const EXT=path.join(__dirname,'..','extension');
const ARITY={m:2,l:2,h:1,v:1,c:6,s:4,q:4,t:2,a:7,z:0};
function problem(d){
 const tokens=d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)||[];
 const rest=d.replace(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?|[\s,]/g,'');
 if(rest)return 'stray characters '+JSON.stringify(rest.slice(0,12));
 if(!tokens.length)return null;
 if(!/^[Mm]$/.test(tokens[0]))return 'does not start with M';
 let cmd=null,count=0;
 const close=()=>{if(cmd===null)return null;const n=ARITY[cmd.toLowerCase()];if(n===0)return count?`${cmd} takes no numbers`:null;if(!count||count%n)return `${cmd} has ${count} numbers (needs a multiple of ${n})`;return null;};
 for(const t of tokens){if(/[A-Za-z]/.test(t)){const p=close();if(p)return p;cmd=t;count=0;}else count++;}
 return close();
}
function literalPaths(source){
 // only whole attribute values in markup (the closing quote is followed by "/", ">" or the next attribute), never paths
 // built in code ('M'+x) or split across joined strings
 const out=[];const rx=/\bd=\\?(["'])([^"'\\`$]*?)\\?\1(?=\s*(?:\/|>|\\?[a-z-]+=))/g;let m;
 while((m=rx.exec(source)))if(/[MmLl]/.test(m[2]))out.push({d:m[2],at:m.index});
 return out;
}
test('the path checker itself: accepts good data, refuses a doubled command and a short group',()=>{
 assert.equal(problem('M624 99c4 1 8 1 12 0M691 166l2.4 3'),null);
 assert.equal(problem('M1 2L3 4zM5 6h7v-2Z'),null);
 assert.match(problem('M624 99c4 1 8 1 12 0MM691 166l2.4 3'),/M has 0 numbers/);
 assert.match(problem('M1 2c1 2 3'),/c has 3 numbers/);
});
test('every literal path in the shipped drawings is valid path data',()=>{
 const bad=[];
 for(const f of fs.readdirSync(EXT).filter(f=>/\.(js|html|svg)$/.test(f))){
  const src=fs.readFileSync(path.join(EXT,f),'utf8');
  for(const {d,at} of literalPaths(src)){const p=problem(d);if(p)bad.push(`${f}@${at}: ${p}: ${d.slice(0,60)}`);}
 }
 assert.deepEqual(bad,[]);
});
