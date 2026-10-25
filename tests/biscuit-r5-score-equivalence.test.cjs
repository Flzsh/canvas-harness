'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
/* Parent-owned execution only. Optional explicit source paths permit staged checks; default runs use the active extensions. */
const ROOT=path.resolve(__dirname,'..'),sourcePath=(key,file)=>process.env[key]?path.resolve(ROOT,process.env[key]):path.join(ROOT,'extension',file);
function load(){
 const treesFile=sourcePath('BISCUIT_R5_TREES_SOURCE','biscuit-trees.js'),learnFile=sourcePath('BISCUIT_R5_LEARN_SOURCE','biscuit-learn.js'),treesEnv={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(treesFile,'utf8'),treesEnv,{filename:treesFile});
 const Trees=treesEnv.module.exports,learnEnv={module:{exports:{}},ReserveBiscuitTrees:Trees,require(){throw Error('Unexpected scoring dependency');}};vm.runInNewContext(fs.readFileSync(learnFile,'utf8'),learnEnv,{filename:learnFile});return {Trees,Learn:learnEnv.module.exports};
}
function referenceResidual(Trees,model,features){
 const transformed=Trees.rankFeatures(features),present=new Set();for(let i=0;i<model.features.length;i++)if(transformed[model.features[i]])present.add(i);let score=0;
 for(const tree of model.trees){let leaf=0;for(let i=0;i<tree.bits.length;i++)if(present.has(tree.bits[i]))leaf|=1<<i;score+=tree.values[leaf][0]/model.scale;}return score;
}
const probe=features=>({features,trees:features.map((_,i)=>({bits:[i],values:[[-(i+3)],[i+7]]})),bias:[1234],scale:1000,mix:1});
const same=(Trees,model,features,note)=>assert.equal(Trees.rankResidual(model,features),referenceResidual(Trees,model,features),note);
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<=1e-15,String(actual)+' != '+String(expected));
test('linear dot products and softmax probabilities match hand-computed values',()=>{
 const {Learn}=load(),features={bias:1,signal:.5,penalty:-2,zero:0,unknown:4},model={labels:['A','B','C'],scale:10,weights:{bias:[10,-10,0],signal:[20,10,-20],penalty:[5,-5,10],zero:[999,999,999]}},result=Learn.classify(model,features),denominator=1+Math.exp(-.5)+Math.exp(-4);
 assert.deepEqual(Array.from(result,v=>v.label),['A','B','C']);assert.deepEqual(Array.from(result,v=>v.score),[1,.5,-3]);for(const [i,p]of [1/denominator,Math.exp(-.5)/denominator,Math.exp(-4)/denominator].entries())near(result[i].probability,p);
 assert.equal(Learn.score({scale:10,weights:{bias:[10],signal:[20],penalty:[5]}},features),1);assert.equal(Learn.score({scale:0,weights:{bias:[10],signal:[20],penalty:[5]}},features),10);assert.equal(Learn.score(null,null),0);assert.deepEqual(Array.from(Learn.classify(null,null)),[]);
});
test('linear scoring retains own-key order, inherited weights, and ignored inherited/nonenumerable/symbol features',()=>{
 const {Learn}=load(),features=Object.create({inherited:100});features.tail=1;features['10']=1;features['2']=1;Object.defineProperty(features,'hidden',{value:100,enumerable:false});features[Symbol('symbol')]=100;
 const weights=Object.assign(Object.create({'2':[1e16],'10':[-1e16]}),{tail:[1],inherited:[50],hidden:[50]});assert.equal(Learn.score({weights,scale:1},features),1);const ranked=Learn.classify({labels:['first','second'],scale:1,weights:Object.assign(Object.create({'2':[1e16,1e16],'10':[-1e16,-1e16]}),{tail:[1,1],inherited:[50,50],hidden:[50,50]})},features);assert.deepEqual(Array.from(ranked,v=>v.label),['first','second']);assert.deepEqual(Array.from(ranked,v=>v.score),[1,1]);assert.deepEqual(Array.from(ranked,v=>v.probability),[.5,.5]);
 const bare=Object.assign(Object.create(null),{bias:1,x:-2});assert.equal(Learn.score({weights:{bias:[3],x:[4]},scale:1},bare),-5);
});
test('linear enumeration snapshots values before reading weights and observes enumerable changes in key order',()=>{
 const {Learn}=load();function fixture(){const events=[],features={};Object.defineProperty(features,'a',{enumerable:true,get(){events.push('a');features.b=2;Object.defineProperty(features,'hidden',{enumerable:true});return 1;}});features.b=1;Object.defineProperty(features,'hidden',{value:3,enumerable:false,configurable:true});const weights={a:[1],b:[1],hidden:[1]};Object.defineProperty(weights,'a',{get(){events.push('weight');features.b=99;return [1];}});return {events,features,weights};}
 const a=fixture();assert.equal(Learn.score({scale:1,weights:a.weights},a.features),6);assert.deepEqual(a.events.slice(0,2),['a','weight']);const b=fixture(),result=Learn.classify({labels:['one'],scale:1,weights:b.weights},b.features);assert.equal(result[0].score,6);assert.deepEqual(b.events,['a','weight']);
 assert.throws(()=>Learn.score({weights:{}},null),{name:'TypeError'});assert.throws(()=>Learn.classify({labels:['one'],weights:{}},undefined),{name:'TypeError'});
});
test('tree probabilities and mixed classifier probabilities match hand-computed quantized outputs',()=>{
 const {Trees,Learn}=load(),head={features:['flag'],bias:[0,0],trees:[{bits:[0],values:[[0,0],[1000,0]]}],scale:1000,mix:.25},p=Trees.probabilities(head,{flag:-1}),expected=1/(1+Math.exp(-1));near(p[0],expected);near(p[1],1-expected);
 const result=Learn.classify({labels:['yes','no'],weights:{bias:[0,0]},scale:100,trees:head},{bias:1,flag:-1}),yes=.75*.5+.25*expected,no=.75*.5+.25*(1-expected);assert.deepEqual(Array.from(result,v=>v.label),['yes','no']);near(result[0].probability,yes);near(result[1].probability,no);near(result[0].score,Math.log(yes));near(result[1].score,Math.log(no));
});
test('rankFeatures training projection retains threshold, raw, exclusion and explicit-key semantics',()=>{
 const {Trees}=load(),features=Object.assign(Object.create({inherited:1,title:1}),{bias:1,'t:term':1,'d:term':-1,body:.2,negative:-2,zero:0,'@0.2:body':-4,'@0.3:title':1}),projected=Trees.rankFeatures(features);
 assert.deepEqual(Object.keys(projected).sort(),['@0.05:body','@0.2:body','@0.3:title','negative'].sort());assert.equal(projected['@0.2:body'],-4);assert.equal(projected.negative,-2);assert.equal(Object.hasOwn(projected,'bias'),false);assert.equal(Object.hasOwn(projected,'title'),false);
});
test('residual projection agrees at every supported threshold and on zero/negative/boundary values',()=>{
 const {Trees}=load(),cuts=[.05,.2,.4,.65,.9],fields=['title','body','alias','teacher','course','coverage','titleFraction','charTitle','lexical','soon','title:file','title:wanted:file','body:wanted','soon:grade','title\n'];
 for(const field of fields){const names=[field,...cuts.map(cut=>'@'+cut+':'+field),'@0.20:'+field,'@.2:'+field,'@0.3:'+field],model=probe(names),values=[-2,-0,0,NaN,Infinity,-Infinity,...cuts.flatMap(cut=>[cut-Number.EPSILON,cut,cut+Number.EPSILON]),1];for(const value of values)same(Trees,model,{[field]:value},field+' = '+value);}
});
test('raw, excluded, unknown prefixes and explicit generated-key collisions match the training projection',()=>{
 const {Trees}=load(),names=['bias','t:term','d:term','title','title:file','raw','negative','zero','kind:file','titlee','Title','soonish','@0.2:title','@0.05:title','@0.3:title','@0.20:title','@.2:title','@2e-1:title','@0.2:raw','@0.2:t:term','@0.2:title:kind'],model=probe(names),queries=[{},Object.fromEntries(names.map(k=>[k,0])),Object.fromEntries(names.map(k=>[k,-1])),Object.fromEntries(names.map(k=>[k,1])),{title:.1,'@0.2:title':-3,'@0.3:title':1},{title:.9,'@0.2:title':0,'@0.05:title':NaN},{'title:kind':.2,raw:-1,negative:-2,zero:0,titlee:1,Title:1,soonish:1}];
 for(const features of queries){same(Trees,model,features);same(Trees,model,features);}const m={features:['raw','@0.2:title','bias','t:term','d:term'],trees:[{bits:[0,1,2,3,4],values:Array.from({length:32},(_,i)=>[i])}],scale:1};assert.equal(Trees.rankResidual(m,{raw:-1,title:.2,bias:1,'t:term':1,'d:term':1}),3);
});
test('inherited and nonenumerable query features are ignored while output prototype lookups remain compatible',()=>{
 const {Trees}=load(),model=probe(['raw','@0.2:title','@0.2:title:kind','@0.3:title','toString','constructor','hasOwnProperty','valueOf','__proto__']),inherited=Object.create({raw:1,title:1,'title:kind':1,'@0.3:title':1}),hidden={};for(const name of ['raw','title','title:kind','@0.3:title'])Object.defineProperty(hidden,name,{value:1,enumerable:false});
 same(Trees,model,inherited);same(Trees,model,hidden);same(Trees,model,Object.create(null));const own=Object.assign(Object.create({title:1,raw:1}),{title:0,raw:-1});own[Symbol('raw')]=1;same(Trees,model,own);
 for(const proto of [{raw:1},Object.create(null),function synthetic(){}]){const features={};Object.defineProperty(features,'__proto__',{value:proto,enumerable:true});same(Trees,model,features);}
});
test('duplicate and empty model names observe fresh query values on every call',()=>{
 const {Trees}=load(),model=probe(['','raw','raw','@0.2:title','@','@0.2:','constructor']),features=Object.assign(Object.create(null),{'':-1,raw:-2,title:.2,'@':1,'@0.2:':1});same(Trees,model,features);same(Trees,model,features);features['']=0;features.raw=0;features.title=.2-Number.EPSILON;same(Trees,model,features);delete features.raw;features['@0.2:title']=-1;same(Trees,model,features);
});
test('quantized residual sums preserve leaf-bit order, division order and the ignored bias',()=>{
 const {Trees,Learn}=load(),ranker={features:['bias','raw','@0.2:title'],bias:[1000],scale:1000,mix:1,trees:[{bits:[2,0],values:[[10],[20],[30],[40]]},{bits:[1],values:[[-1],[-7]]}]},features={bias:1,raw:-1,title:.2},expected=20/1000-7/1000;assert.equal(Trees.rankResidual(ranker,features),expected);assert.equal(Learn.score({weights:{bias:[2]},scale:2,ranker},features),1+expected);same(Trees,ranker,features);
});
test('descriptor reuse observes in-place names, array identity/length, tree values/bits and scale mutations',()=>{
 const {Trees}=load(),model=probe(['@0.2:title']),features={title:.3,raw:0,other:-1};same(Trees,model,features);model.features[0]='raw';same(Trees,model,features);model.features=['other'];same(Trees,model,features);model.features.push('@0.4:title');model.trees[0].bits=[1];same(Trees,model,features);features.title=.5;same(Trees,model,features);model.features.reverse();same(Trees,model,features);model.features.length=1;model.trees[0].bits=[0];same(Trees,model,features);model.scale=7;model.trees[0].values[1][0]=-17;same(Trees,model,features);
 const collision=probe(['a,b','c']),query={'a,b':1,c:0,a:0,'b,c':1};same(Trees,collision,query);collision.features[0]='a';collision.features[1]='b,c';same(Trees,collision,query);
 const names=new Array(1),proto=Object.assign(Object.create(Array.prototype),{0:'raw'});Object.setPrototypeOf(names,proto);const inheritedModel={features:names,trees:[{bits:[0],values:[[0],[1000]]}],scale:1000};same(Trees,inheritedModel,features);proto[0]='other';same(Trees,inheritedModel,features);
});
