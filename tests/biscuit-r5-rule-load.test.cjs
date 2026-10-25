'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
/* Parent-owned execution only. An optional BISCUIT_R5_RULES_SOURCE path selects a staged source; normal runs use the active extension. */
const ROOT=path.resolve(__dirname,'..'),EXTENSION=path.join(ROOT,'extension'),SOURCE=process.env.BISCUIT_R5_RULES_SOURCE?path.resolve(ROOT,process.env.BISCUIT_R5_RULES_SOURCE):path.join(EXTENSION,'biscuit-rules.js'),source=fs.readFileSync(SOURCE,'utf8');
const tiny=tier=>({schemaVersion:1,tier,...(tier==='basic'?{}:{extends:tier==='more'?'basic':'more'}),models:{action:{labels:['none'],scale:100,weights:{bias:[0]}},item:{labels:['yes'],scale:100,weights:{bias:[0]}},kind:{labels:['ask'],scale:100,weights:{bias:[0]}},context:{labels:['yes'],scale:100,weights:{bias:[0]}}},features:{charMax:3},patterns:[]});
const tree=()=>({features:['bias'],bias:[0],scale:100,mix:.5,trees:[{bits:[0],values:[[1],[-1]]}]});
const put=(object,key,value)=>Object.defineProperty(object,key,{value,enumerable:true,writable:true,configurable:true});
function rules(packs={}){
 const reads=[],env={module:{exports:{}},__dirname:EXTENSION,require(name){if(name==='node:path')return path;if(name==='node:fs')return {readFileSync(file,encoding){const tier=path.basename(file,'.json');assert.equal(file,path.join(EXTENSION,'biscuit-rules',tier+'.json'));assert.equal(encoding,'utf8');reads.push(tier);if(!Object.hasOwn(packs,tier))throw Error('Synthetic missing pack');return JSON.stringify(packs[tier]);}};throw Error('Unexpected rule-loader dependency');}};
 vm.runInNewContext(source,env,{filename:SOURCE});return {Rules:env.module.exports,reads};
}
test('validation preserves JSON shape, boundary coefficients, tree heads and safe extra metadata',()=>{
 const {Rules}=rules(),pack=tiny('basic');pack.models.action.weights.edge=[1e8];pack.models.action.weights.negative=[-1e8];pack.models.action.trees=tree();pack.models.action.trees.bias=[100000];pack.models.action.trees.trees[0].values=[[10000],[-10000]];pack.models.item.ranker=tree();pack.models['detail:setting']={labels:['{"key":"motion","on":true}'],scale:100,weights:{bias:[0]}};pack.values={numbers:{zero:0,limit:10000}};pack.metadata={nested:[{source:'synthetic'}]};
 assert.equal(Rules.validate(pack,'basic'),pack);assert.deepEqual(pack.models.action.weights.edge,[1e8]);assert.equal(pack.models.action.trees.trees[0].values[1][0],-10000);
});
test('unsafe own keys are rejected throughout unknown metadata, model maps and numeric cells',()=>{
 const {Rules}=rules(),places=[p=>p,p=>p.features,p=>p.models,p=>p.models.action,p=>p.models.action.weights,p=>p.metadata.nested[0],p=>p.models.action.trees,p=>p.models.action.trees.trees[0]];
 for(const key of ['__proto__','constructor','prototype'])for(const place of places){const pack=tiny('basic');pack.metadata={nested:[{}]};pack.models.action.trees=tree();put(place(pack),key,[]);assert.throws(()=>Rules.validate(pack,'basic'),/Unsafe pack key/,key);}
 const pack=tiny('basic'),cell={};put(cell,'__proto__',{});pack.models.action.weights.bias=[cell];assert.throws(()=>Rules.validate(pack,'basic'),/Unsafe pack key/);
});
test('own-property scans ignore inherited coefficient rows',()=>{
 const {Rules}=rules(),pack=tiny('basic'),inherited={ghost:[Infinity]};put(inherited,'constructor',{});pack.models.action.weights=Object.assign(Object.create(inherited),{bias:[0]});assert.equal(Rules.validate(pack,'basic'),pack);
});
test('all numeric weight cells keep finite, type, dimension and absolute-bound checks',()=>{
 const {Rules}=rules();for(const value of [Infinity,-Infinity,NaN,'0',null,{},1e8+1,-1e8-1]){const pack=tiny('basic');pack.models.action.weights.bias=[value];assert.throws(()=>Rules.validate(pack,'basic'),/Invalid coefficient/);}
 for(const weights of [[],[0,1],new Float64Array([0])]){const pack=tiny('basic');pack.models.action.weights.bias=weights;assert.throws(()=>Rules.validate(pack,'basic'),/Invalid coefficient/);}
 const pack=tiny('basic');pack.models.action.weights['x'.repeat(251)]=[0];assert.throws(()=>Rules.validate(pack,'basic'),/Invalid coefficient/);
});
test('sparse JavaScript numeric vectors cannot bypass finite-cell checks',()=>{
 const {Rules}=rules(),cases=[p=>{p.models.action.weights.bias=new Array(1);},p=>{p.models.action.trees.bias=new Array(1);},p=>{p.models.action.trees.trees[0].bits=new Array(1);},p=>{p.models.action.trees.trees[0].values[0]=new Array(1);},p=>{p.models.action.trees.trees[0].values=new Array(2);}];
 for(const change of cases){const pack=tiny('basic');pack.models.action.trees=tree();change(pack);assert.throws(()=>Rules.validate(pack,'basic'));}
});
test('tree and ranker bounds remain checked independently of sparse weights',()=>{
 const {Rules}=rules(),changes=[t=>{t.bias=[100001];},t=>{t.trees[0].values[0]=[10001];},t=>{t.trees[0].values[0]=[Infinity];},t=>{t.trees[0].bits=[0,0];},t=>{t.trees[0].bits=[1];},t=>{t.trees[0].bits=[.5];},t=>{t.scale=0;},t=>{t.mix=1.01;},t=>{t.trees[0].values=[[0]];}];
 for(const name of ['trees','ranker'])for(const change of changes){const pack=tiny('basic');pack.models.action[name]=tree();change(pack.models.action[name]);assert.throws(()=>Rules.validate(pack,'basic'));}
});
test('feature-count boundary remains 40000 own rows and hostile last rows are visited',()=>{
 const {Rules}=rules(),pack=tiny('basic');pack.models.action.weights=Object.fromEntries(Array.from({length:40000},(_,i)=>['f'+i,[0]]));assert.equal(Rules.validate(pack,'basic'),pack);pack.models.action.weights.extra=[0];assert.throws(()=>Rules.validate(pack,'basic'),/Invalid sparse model/);delete pack.models.action.weights.extra;pack.models.action.weights.f39999=[Infinity];assert.throws(()=>Rules.validate(pack,'basic'),/Invalid coefficient/);
});
test('public validation always rechecks a previously valid mutable object',()=>{
 const {Rules}=rules(),pack=tiny('basic');Rules.validate(pack,'basic');pack.models.action.weights.bias[0]=Infinity;assert.throws(()=>Rules.validate(pack,'basic'),/Invalid coefficient/);pack.models.action.weights.bias[0]=0;put(pack.metadata={nested:{}},'constructor',{});assert.throws(()=>Rules.validate(pack,'basic'),/Unsafe pack key/);
});
test('public pattern restrictions, labels and number-word safeguards are preserved',()=>{
 const {Rules}=rules(),changes=[p=>{p.patterns=[{regex:'(a+)+'}];},p=>{p.patterns=[{tokens:[{words:['go'],repeat:[0,5]}]}];},p=>{p.models.action.labels=['unknown'];},p=>{p.models.kind.labels=['ask|unknown'];},p=>{p.models.item.labels=['no'];},p=>{p.models.action.labels=['none','none'];p.models.action.weights.bias=[0,0];},p=>{p.models['detail:setting']={labels:['{"code":"alert(1)"}'],scale:100,weights:{bias:[0]}};},p=>{p.values={numbers:{bad:Infinity}};},p=>{p.values={numbers:{'not-a-word':1}};}];
 for(const change of changes){const pack=tiny('basic');change(pack);assert.throws(()=>Rules.validate(pack,'basic'));}
 assert.equal(Rules.matchPattern({tokens:[{words:['go']}]},'go')!==null,true);assert.equal(Rules.matchPattern({tokens:[{words:['go']}]},Array(97).fill('go').join(' ')),null);
});
test('one asynchronous requested-tier load preserves ancestry, coalescing and coefficient sums',async()=>{
 const {Rules}=rules(),packs=Object.fromEntries(['basic','more','most'].map(tier=>[tier,tiny(tier)])),reads=[];packs.basic.models.action.weights.bias=[10];for(const tier of ['more','most']){packs[tier].models.action.delta=true;packs[tier].models.action.weights.bias=[tier==='more'?2:-1];}const loader=Rules.create({read:async tier=>{reads.push(tier);return packs[tier];}});
 const [a,b]=await Promise.all([loader.load('most'),loader.load('most')]);assert.equal(a,b);assert.equal(a.tier,'most');assert.equal(a.models.action.weights.bias[0],11);assert.equal(a.models.action.delta,false);assert.deepEqual(reads,['basic','more','most']);assert.deepEqual(Array.from(loader.loaded()),['basic','more','most']);assert.equal(loader.current(),a);assert.equal(loader.get('more').tier,'more');assert.equal((await loader.load('unknown')).tier,'basic');
});
test('missing Basic blocks all descendants and invalid More cannot be skipped by Most',async()=>{
 const {Rules}=rules(),reads=[],loader=Rules.create({read:async tier=>{reads.push(tier);throw Error('Synthetic unavailable pack');}});assert.equal(await loader.load('most'),null);assert.deepEqual(reads,['basic']);assert.equal(loader.current(),null);assert.deepEqual(Array.from(loader.loaded()),[]);
 const packs={basic:tiny('basic'),more:tiny('more'),most:tiny('most')},seen=[];packs.more.patterns=[{regex:'.*'}];const second=Rules.create({read:async tier=>{seen.push(tier);return packs[tier];}});assert.equal((await second.load('most')).tier,'basic');assert.deepEqual(Array.from(second.loaded()),['basic']);assert.deepEqual(seen,['basic','more','most']);
});
test('wrong residual ancestry, changed labels or scales fall back without caching a false tier',async()=>{
 const {Rules}=rules(),changes=[p=>{p.extends='more';},p=>{p.models.action.delta=true;p.models.action.labels=['chat'];},p=>{p.models.action.delta=true;p.models.action.scale=101;}];
 for(const change of changes){const basic=tiny('basic'),more=tiny('more');change(more);const loader=Rules.create({read:async tier=>tier==='basic'?basic:more});assert.equal((await loader.load('more')).tier,'basic');assert.deepEqual(Array.from(loader.loaded()),['basic']);assert.equal(loader.current(),basic);}
 const residual=tiny('most');assert.throws(()=>Rules.combine(tiny('basic'),residual),/Wrong residual ancestry/);assert.throws(()=>Rules.combine(null,residual),/Residual pack requires its base/);
});
test('combined residuals are revalidated for overflow and aggregate pattern bounds',async()=>{
 const {Rules}=rules(),basic=tiny('basic'),more=tiny('more');basic.models.action.weights.bias=[1e8];more.models.action.delta=true;more.models.action.weights.bias=[1];const first=Rules.create({read:async tier=>tier==='basic'?basic:more});assert.equal((await first.load('more')).tier,'basic');assert.deepEqual(Array.from(first.loaded()),['basic']);assert.equal(basic.models.action.weights.bias[0],1e8);
 const a=tiny('basic'),b=tiny('more'),pattern={tokens:[{words:['go']}]};a.patterns=Array.from({length:1001},()=>pattern);b.patterns=Array.from({length:1000},()=>pattern);const second=Rules.create({read:async tier=>tier==='basic'?a:b});assert.equal((await second.load('more')).tier,'basic');assert.deepEqual(Array.from(second.loaded()),['basic']);
});
test('synchronous get retains lazy per-tier reads, fallback and combined validation',()=>{
 const packs={basic:tiny('basic'),more:tiny('more'),most:tiny('most')};packs.more.models.action.delta=true;packs.more.models.action.weights.bias=[2];packs.most.extends='basic';const {Rules,reads}=rules(packs),loader=Rules.create();assert.equal(loader.get('basic').tier,'basic');assert.deepEqual(reads,['basic']);assert.equal(loader.get('more').models.action.weights.bias[0],2);assert.deepEqual(reads,['basic','more']);assert.equal(loader.get('most').tier,'more');assert.deepEqual(reads,['basic','more','most']);assert.deepEqual(Array.from(loader.loaded()),['basic','more']);
});
