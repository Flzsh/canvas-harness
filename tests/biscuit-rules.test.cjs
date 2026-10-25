'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const tiny=tier=>({schemaVersion:1,tier,models:{action:{labels:['none'],scale:100,weights:{bias:[0]}},item:{labels:['yes'],scale:100,weights:{bias:[0]}},kind:{labels:['ask'],scale:100,weights:{bias:[0]}},context:{labels:['yes'],scale:100,weights:{bias:[0]}}},features:{charMax:3},patterns:[]});
test('Basic loads only its own JSON; bad larger packs fall back one tier',async()=>{
 const Rules=require('../extension/biscuit-rules.js'),reads=[],loader=Rules.create({read:async name=>{reads.push(name);if(name==='more')return {...tiny(name),patterns:[{regex:'(a+)+'}]};return tiny(name);}});
 assert.equal((await loader.load('basic')).tier,'basic');assert.deepEqual(reads,['basic']);assert.equal((await loader.load('more')).tier,'basic');assert.deepEqual(reads,['basic','more']);
});
test('pack validator rejects executable patterns, unsafe keys and nonfinite weights',()=>{
 const Rules=require('../extension/biscuit-rules.js');assert.throws(()=>Rules.validate({...tiny('basic'),patterns:[{regex:'.*'}]},'basic'));const data=tiny('basic');data.models.action.weights.bad=[Infinity];assert.throws(()=>Rules.validate(data,'basic'));assert.throws(()=>Rules.validate(JSON.parse('{"__proto__":{}}'),'basic'));
});
test('safe patterns have bounded tokens, optional words and numeric slots',()=>{
 const Rules=require('../extension/biscuit-rules.js'),p={tokens:[{words:['add','give']},{words:['me'],optional:true},{slot:'number'},{words:['minutes','mins'],repeat:[1,1]}]};
 assert.deepEqual(Rules.matchPattern(p,'add me 12 mins'),{number:12});assert.equal(Rules.matchPattern(p,'add me many mins'),null);assert.throws(()=>Rules.compilePattern({tokens:[{words:['a'],repeat:[0,100000]}]}));
});
test('a residual pack requires its exact predecessor and long inputs never truncate into a match',()=>{
 const Rules=require('../extension/biscuit-rules.js'),delta={...tiny('most'),extends:'more'};delta.models.action.delta=true;assert.throws(()=>Rules.combine(tiny('basic'),delta));assert.throws(()=>Rules.combine(null,delta));assert.equal(Rules.matchPattern({tokens:[{words:['hi']}]},Array(97).fill('hi').join(' ')),null);
});
test('a missing Basic pack prevents residual files from being accepted as standalone models',async()=>{
 const Rules=require('../extension/biscuit-rules.js'),reads=[],more={...tiny('more'),extends:'basic'};more.models.action.delta=true;const loader=Rules.create({read:async tier=>{reads.push(tier);if(tier==='basic')throw Error('bad Basic');return more;}});assert.equal(await loader.load('more'),null);assert.deepEqual(reads,['basic']);
});
