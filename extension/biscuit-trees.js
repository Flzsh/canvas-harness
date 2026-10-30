/* Bounded symmetric decision trees for interactions among locally computed cues. */
(function(root){
 'use strict';
 function compact(model){
   const used=[...new Set(model.trees.flatMap(v=>v.bits))].sort((a,b)=>a-b),remap=new Map(used.map((v,i)=>[v,i]));
   return {...model,features:used.map(v=>model.features[v]),trees:model.trees.map(t=>({...t,bits:t.bits.map(v=>remap.get(v))}))};
 }
 const softmax=scores=>{
   let max=-Infinity;
   for(const v of scores)max=Math.max(max,v);
   let total=0;
   const out=Array.from(scores,v=>{const n=Math.exp(v-max);total+=n;return n;});
   return out.map(v=>v/total);
 };
 function fit(examples,labels,features,{iterations=140,depth=3,rate=.12,penalty=2,mix=.5}={}){
   const source=examples.filter(v=>v.support!==false),
     map=new Map(features.map((k,i)=>[k,i])),
     C=labels.length,
     F=features.length,
     N=source.length,
     rows=source.map(v=>
       ({
         x:Object.entries(v.x).filter(([k,n])=>n&&map.has(k)).map(([k])=>map.get(k)),
         y:labels.indexOf(v.y),
         allowed:v.allowed?.length?v.allowed.map(v=>labels.indexOf(v)).filter(v=>v>=0):null,
         weight:v.weight||1
       })),
     counts=new Float64Array(C),
     scores=new Float64Array(N*C),
     trees=[];
   for(const r of rows)if(r.allowed?.length){for(const c of r.allowed)counts[c]+=r.weight/r.allowed.length;}else counts[r.y]+=r.weight;
   const total=counts.reduce((a,b)=>a+b,0),bias=Array.from(counts,n=>Math.log(Math.max(.0001,n/total)));
   for(let i=0;i<N;i++)scores.set(bias,i*C);
  for(let round=0;round<iterations;round++){
    const G=new Float64Array(N*C),H=new Float64Array(N*C);
    for(let i=0;i<N;i++){
      const p=softmax(scores.subarray(i*C,(i+1)*C)),r=rows[i],allowed=r.allowed?.length?new Set(r.allowed):null,mass=allowed?[...allowed].reduce((n,c)=>n+p[c],0):0;
      for(let c=0;c<C;c++){G[i*C+c]=((allowed?allowed.has(c)?p[c]/mass:0:r.y===c?1:0)-p[c])*r.weight;H[i*C+c]=Math.max(.01,p[c]*(1-p[c]))*r.weight;}
    }
   let groups=new Uint8Array(N),leaves=1;
   const bits=[];
   for(let level=0;level<depth;level++){
     const totalsG=new Float64Array(leaves*C),
       totalsH=new Float64Array(leaves*C),
       sizes=new Uint32Array(leaves),
       sumG=new Float64Array(F*leaves*C),
       sumH=new Float64Array(F*leaves*C),
       present=new Uint32Array(F*leaves);
     for(let i=0;i<N;i++){
       const leaf=groups[i],r=rows[i];
       sizes[leaf]++;
       for(let c=0;c<C;c++){totalsG[leaf*C+c]+=G[i*C+c];totalsH[leaf*C+c]+=H[i*C+c];}
       for(const feature of r.x){
         const offset=(feature*leaves+leaf)*C;
         present[feature*leaves+leaf]++;
         for(let c=0;c<C;c++){sumG[offset+c]+=G[i*C+c];sumH[offset+c]+=H[i*C+c];}
       }
     }
    let best=-1,bestScore=0;
    for(let feature=0;feature<F;feature++){
      if(bits.includes(feature))continue;
      let gain=0,valid=false;
      for(let leaf=0;leaf<leaves;leaf++){
        const n=present[feature*leaves+leaf];
        if(n<3||sizes[leaf]-n<3)continue;
        valid=true;
        for(let c=0;c<C;c++){
          const at=(feature*leaves+leaf)*C+c,rightG=sumG[at],rightH=sumH[at],leftG=totalsG[leaf*C+c]-rightG,leftH=totalsH[leaf*C+c]-rightH;
          gain+=rightG*rightG/(rightH+penalty)+leftG*leftG/(leftH+penalty)-totalsG[leaf*C+c]**2/(totalsH[leaf*C+c]+penalty);
        }
      }
      if(valid&&gain>bestScore){bestScore=gain;best=feature;}
    }
    if(best<0)break;bits.push(best);for(let i=0;i<N;i++)if(rows[i].x.includes(best))groups[i]+=leaves;leaves*=2;
   }
   if(!bits.length)break;
   const leafG=new Float64Array(leaves*C),leafH=new Float64Array(leaves*C);
   for(let i=0;i<N;i++)for(let c=0;c<C;c++){leafG[groups[i]*C+c]+=G[i*C+c];leafH[groups[i]*C+c]+=H[i*C+c];}
   const values=Array.from(
     {length:leaves},
     (_,leaf)=>Array.from({length:C},(_,c)=>Math.round(rate*Math.max(-2,Math.min(2,leafG[leaf*C+c]/(leafH[leaf*C+c]+penalty)))*1000)));
   for(let i=0;i<N;i++)for(let c=0;c<C;c++)scores[i*C+c]+=values[groups[i]][c]/1000;
   trees.push({bits,values});
  }return compact({features,trees,bias:bias.map(v=>Math.round(v*1000)),scale:1000,mix});
 }
 function probabilities(model,features){
   const scores=Float64Array.from(model.bias,v=>v/model.scale),present=new Set();
   for(let i=0;i<model.features.length;i++)if(features[model.features[i]])present.add(i);
   for(const tree of model.trees){
     let leaf=0;
     for(let i=0;i<tree.bits.length;i++)if(present.has(tree.bits[i]))leaf|=1<<i;
     const values=tree.values[leaf];
     for(let i=0;i<scores.length;i++)scores[i]+=values[i]/model.scale;
   }
   return softmax(scores);
 }
 function blend(model,features,linear){
   if(!model.trees)return linear;
   const p=probabilities(model.trees,features),mix=model.trees.mix;
   return linear.map(v=>({...v,score:Math.log(Math.max(1e-12,(1-mix)*v.probability+mix*p[v.index])),probability:(1-mix)*v.probability+mix*p[v.index]})).sort((a,b)=>
     b.probability-a.probability||a.index-b.index);
 }
 function rankFeatures(features){
   const out={};
   for(const [k,v]of Object.entries(features)){
     if(!v||k==='bias'||/^t:|^d:/.test(k))continue;
     if(/^(?:title|body|alias|teacher|course|coverage|titleFraction|charTitle|lexical|soon)(?::|$)/.test(k)){for(const cut of [.05,.2,.4,.65,.9])if(v>=cut)out['@'+cut+':'+k]=1;}else out[k]=v;
   }
   return out;
 }
 function fitRank(examples,features,{iterations=100,depth=3,rate=.2,penalty=3}={}){
   const F=features.length,
     N=examples.length,
     map=new Map(features.map((k,i)=>[k,i])),
     rows=examples.map(v=>({...v,x:Object.keys(rankFeatures(v.x)).filter(k=>map.has(k)).map(k=>map.get(k))})),
     queries=new Map(),
     scores=Float64Array.from(rows,v=>v.base||0),
     trees=[];
   for(let i=0;i<N;i++){
     const weight=rows[i].weight??1;
     if(!Number.isFinite(weight)||weight<=0)throw Error('Invalid ranking request weight');
     const q=queries.get(rows[i].group)||{yes:[],no:[],weight};
     if(q.weight!==weight)throw Error('Conflicting ranking request weights');
     q[rows[i].y?'yes':'no'].push(i);
     queries.set(rows[i].group,q);
   }
  for(let round=0;round<iterations;round++){
    const G=new Float64Array(N),H=new Float64Array(N);
    for(const q of queries.values()){
      const weight=q.weight/Math.max(1,q.yes.length*q.no.length);
      for(const p of q.yes)
        for(const n of q.no){
          const prob=1/(1+Math.exp(Math.max(-25,Math.min(25,scores[p]-scores[n])))),g=prob*weight,h=Math.max(.001,prob*(1-prob))*weight;
          G[p]+=g;
          G[n]-=g;
          H[p]+=h;
          H[n]+=h;
        }
    }
    let groups=new Uint8Array(N),leaves=1;
    const bits=[];
    for(let level=0;level<depth;level++){
      const tg=new Float64Array(leaves),
        th=new Float64Array(leaves),
        sg=new Float64Array(F*leaves),
        sh=new Float64Array(F*leaves),
        count=new Uint32Array(leaves),
        present=new Uint32Array(F*leaves);
      for(let i=0;i<N;i++){
        const leaf=groups[i];
        tg[leaf]+=G[i];
        th[leaf]+=H[i];
        count[leaf]++;
        for(const f of rows[i].x){const at=f*leaves+leaf;sg[at]+=G[i];sh[at]+=H[i];present[at]++;}
      }
      let best=-1,bestGain=0;
      for(let f=0;f<F;f++){
        if(bits.includes(f))continue;
        let gain=0;
        for(let leaf=0;leaf<leaves;leaf++){
          const at=f*leaves+leaf,n=present[at];
          if(n<4||count[leaf]-n<4)continue;
          gain+=sg[at]**2/(sh[at]+penalty)+(tg[leaf]-sg[at])**2/(th[leaf]-sh[at]+penalty)-tg[leaf]**2/(th[leaf]+penalty);
        }
        if(gain>bestGain){bestGain=gain;best=f;}
      }
      if(best<0)break;
      bits.push(best);
      for(let i=0;i<N;i++)if(rows[i].x.includes(best))groups[i]+=leaves;
      leaves*=2;
    }
   if(!bits.length)break;
   const lg=new Float64Array(leaves),lh=new Float64Array(leaves);
   for(let i=0;i<N;i++){lg[groups[i]]+=G[i];lh[groups[i]]+=H[i];}
   const values=Array.from({length:leaves},(_,leaf)=>[Math.round(rate*Math.max(-2,Math.min(2,lg[leaf]/(lh[leaf]+penalty)))*1000)]);
   for(let i=0;i<N;i++)scores[i]+=values[groups[i]][0]/1000;
   trees.push({bits,values});
  }
  return compact({features,trees,bias:[0],scale:1000,mix:1});
 }
 const rankCache=new WeakMap(),
   rankNumeric=/^(?:title|body|alias|teacher|course|coverage|titleFraction|charTitle|lexical|soon)(?::|$)/,
   rankCut=/^@(0\.05|0\.2|0\.4|0\.65|0\.9):/,
   rankDefaults={},
   ownEnumerable=(value,key)=>Object.prototype.propertyIsEnumerable.call(value,key);
 /* Cache descriptors only. Mutable feature names are checked by identity, length and every indexed string on every call. */
 function rankDescriptors(model){
  const source=model.features;let cached=rankCache.get(model),same=cached&&cached.source===source&&cached.names.length===source.length;
  if(same)for(let i=0;i<source.length;i++)if(cached.names[i]!==source[i]){same=false;break;}
  if(same)return cached;
  const names=[],descriptors=[];let legacy=false;
  for(let i=0;i<source.length;i++){
   const key=source[i];names.push(key);
   if(typeof key!=='string'){legacy=true;descriptors.push(null);continue;}
   if(key==='bias'||/^t:|^d:/.test(key)||rankNumeric.test(key)){descriptors.push({key,kind:0});continue;}
   const match=rankCut.exec(key),field=match?key.slice(match[0].length):'';
   descriptors.push(match&&rankNumeric.test(field)?{key,kind:2,field,cut:Number(match[1])}:{key,kind:1});
  }
  cached={source,names,descriptors,legacy};rankCache.set(model,cached);return cached;
 }
 function rankResidual(model,features){
  /* Inference supplies stable computed feature values; this path reads only requested fields during the call. */
  const compiled=rankDescriptors(model),present=new Set();
  /* This rare own key can change rankFeatures' output prototype; retain its exact legacy projection. */
  if(compiled.legacy||ownEnumerable(features,'__proto__')){
    const transformed=rankFeatures(features);
    for(let i=0;i<model.features.length;i++)if(transformed[model.features[i]])present.add(i);
  }
  else for(let i=0;i<compiled.descriptors.length;i++){
   const d=compiled.descriptors[i];let yes=false;
   /* A generated threshold name can also be supplied explicitly as a raw input key. */
   if(d.kind&&ownEnumerable(features,d.key))yes=!!features[d.key];
   if(!yes&&d.kind===2&&ownEnumerable(features,d.field))yes=features[d.field]>=d.cut;
   if(yes||rankDefaults[d.key])present.add(i);
  }
  let score=0;
  for(const tree of model.trees){let leaf=0;for(let i=0;i<tree.bits.length;i++)if(present.has(tree.bits[i]))leaf|=1<<i;score+=tree.values[leaf][0]/model.scale;}
  return score;
 }
 const api={fit,probabilities,blend,compact,rankFeatures,fitRank,rankResidual};root.ReserveBiscuitTrees=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
