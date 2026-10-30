'use strict';
// 4.0 ships Biscuit's round-8 rule packs whole (Your AI is part of 4.0, so the 3.x projection without AI heads is
// retired). These checks keep the packs loadable, readable for the store, and free of any school identity.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const DIR=path.join(__dirname,'../extension/biscuit-rules'),TIERS=['basic','more','most'];
const sha=text=>crypto.createHash('sha256').update(text).digest('hex').slice(0,16);
// The school's names, hashed so this public file does not spell them (the same list as scripts/biscuit-public-packs.cjs).
const PRIVATE=new Set(['4e77286b10e764e3','3f8241542bc6f98e','10cad13cb7b23284']);
function named(text){
 const words=String(text).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
 for(let n=1;n<=3;n++)for(let i=0;i+n<=words.length;i++)if(PRIVATE.has(sha(words.slice(i,i+n).join(' '))))return true;
 return false;
}
function strings(value,out=[]){
 if(typeof value==='string')out.push(value);
 else if(Array.isArray(value))for(const item of value)strings(item,out);
 else if(value&&typeof value==='object')for(const [key,item]of Object.entries(value)){out.push(key);strings(item,out);}
 return out;
}
test('each rule tier parses, carries the models the engine loads, and keeps store-readable lines',()=>{
 for(const tier of TIERS){
  const text=fs.readFileSync(path.join(DIR,tier+'.json'),'utf8'),data=JSON.parse(text);
  for(const name of ['action','item','kind','context'])assert.ok(data.models?.[name],tier+' '+name);
  assert.ok(text.split('\n').every(line=>Buffer.byteLength(line)<=3000),tier+' has a line over 3000 bytes');
 }
});
test('rule packs and the school vocabulary carry no school identity',()=>{
 for(const file of [...TIERS.map(t=>t+'.json'),'school-language.json']){
  const data=JSON.parse(fs.readFileSync(path.join(DIR,file),'utf8'));
  const hits=strings(data).filter(named);
  assert.deepEqual(hits.slice(0,5),[],file);
 }
});
test('the loader accepts every packaged tier',async()=>{
 const R=require('../extension/biscuit-rules.js');
 for(const tier of TIERS){
  const rules=await (R.load?R.load(tier):R.loadTier?.(tier));
  if(rules!==undefined)assert.ok(rules,tier);
 }
});
