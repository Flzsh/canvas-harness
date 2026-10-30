/* JSON packs contain bounded tokens and numeric coefficients, never executable text. */
(function(root){
 'use strict';
 const assetURL=file=>root.chrome?.runtime?.getURL?root.chrome.runtime.getURL(file):new URL('../extension/'+file,root.location.href).href;
 const TIERS=['basic','more','most'],bad=new Set(['__proto__','prototype','constructor']),plain=v=>v&&typeof v==='object'&&!Array.isArray(v),own=(v,k)=>Object.hasOwn(v,k);
 /* The full hostile-key walk stays independent of model validation, including unknown metadata. No trusted-object cache. */
 function safe(value){
  if(Array.isArray(value)){for(let i=0;i<value.length;i++){const v=value[i];if(v&&typeof v==='object')safe(v);}}
  else if(plain(value))for(const k in value)if(own(value,k)){if(bad.has(k))throw Error('Unsafe pack key');const v=value[k];if(v&&typeof v==='object')safe(v);}
 }
 /* Indexed numeric checks also reject sparse in-memory arrays; JSON nulls were already invalid. */
 function finiteVector(values,length,limit){
   if(!Array.isArray(values)||values.length!==length)return false;
   for(let i=0;i<length;i++){const n=values[i];if(!Number.isFinite(n)||n < -limit||n > limit)return false;}
   return true;
 }
 function compilePattern(pattern){
  if(!plain(pattern)||Object.keys(pattern).some(k=>!['tokens','action','fields'].includes(k))||!Array.isArray(pattern.tokens)||!pattern.tokens.length||pattern.tokens.length>24)
    throw Error('Invalid bounded pattern');
  return pattern.tokens.map(token=>{
    if(!plain(token)||Object.keys(token).some(k=>!['words','optional','slot','repeat'].includes(k)))throw Error('Invalid pattern token');
    if(token.words&&(!Array.isArray(token.words)||!token.words.length||token.words.length>64||token.words.some(w=>typeof w!=='string'||w.length>60||!/^[\p{L}\p{N}'-]+$/u.test(w))))
      throw Error('Invalid word list');
    if(token.slot&&!['number','word'].includes(token.slot)||!token.words&&!token.slot||token.words&&token.slot)throw Error('Invalid slot');
    const repeat=token.repeat||[token.optional?0:1,1];
    if(!Array.isArray(repeat)||repeat.length!==2||!repeat.every(Number.isInteger)||repeat[0]<0||repeat[1]<repeat[0]||repeat[1]>4)throw Error('Unbounded repeat');
    return {...token,repeat};
  });
 }
 function matchPattern(pattern,text){
   const tokens=compilePattern(pattern),words=String(text).toLowerCase().trim().split(/\s+/);
   if(words.length>96)return null;
   let steps=0;
   function walk(i,j,slots){
     if(++steps>512)return null;
     if(i===tokens.length)return j===words.length?slots:null;
     const t=tokens[i];
     for(let count=t.repeat[1];count>=t.repeat[0];count--){
       if(j+count>words.length)continue;
       const found={...slots};
       let ok=true;
       for(let n=0;n<count;n++){const w=words[j+n];if(t.words&&!t.words.includes(w)||t.slot==='number'&&!/^\d+(?:\.\d+)?$/.test(w)){ok=false;break;}if(t.slot)found[t.slot]=t.slot==='number'?Number(w):w;}
       if(ok){const result=walk(i+1,j+count,found);if(result)return result;}
     }
     return null;
   }
   return walk(0,0,{});
 }
 function validateTrees(t,C){
  if(!plain(t)||
    !Array.isArray(t.features)||
    t.features.length>14000||
    t.features.some(v=>typeof v!=='string'||v.length>250)||
    !finiteVector(t.bias,C,100000)||
    !Array.isArray(t.trees)||
    t.trees.length>500||
    !Number.isFinite(t.scale)||
    t.scale<=0||
    !Number.isFinite(t.mix)||
    t.mix<0||
    t.mix>1)
    throw Error('Invalid decision tree model');
  for(const tree of t.trees){
   if(!plain(tree)||
     !Array.isArray(tree.bits)||
     tree.bits.length<1||
     tree.bits.length>5||
     new Set(tree.bits).size!==tree.bits.length||
     !Array.isArray(tree.values)||
     tree.values.length!==2**tree.bits.length)
     throw Error('Invalid decision tree');
   for(let i=0;i<tree.bits.length;i++){const bit=tree.bits[i];if(!Number.isInteger(bit)||bit<0||bit>=t.features.length)throw Error('Invalid decision tree');}
   for(let i=0;i<tree.values.length;i++)if(!finiteVector(tree.values[i],C,10000))throw Error('Invalid decision tree');
  }
 }
 function validate(data,tier){
  safe(data);
  if(!plain(data)||
    data.schemaVersion!==1||
    data.tier!==tier||
    !TIERS.includes(tier)||
    !plain(data.models)||
    !plain(data.features)||
    !Array.isArray(data.patterns)||
    data.patterns.length>2000)
    throw Error('Invalid Biscuit pack');
  if(!Number.isInteger(data.features.charMax)||data.features.charMax<0||data.features.charMax>5)throw Error('Invalid feature width');
  if(Object.hasOwn(data.features,'requestFocus')&&typeof data.features.requestFocus!=='boolean')throw Error('Invalid request focus');
  if(Object.hasOwn(data.features,'kindRequestEvidence')&&typeof data.features.kindRequestEvidence!=='boolean')throw Error('Invalid kind request evidence');
  if(Object.hasOwn(data.features,'kindRequestFocus')&&typeof data.features.kindRequestFocus!=='boolean')throw Error('Invalid kind request focus');
  if(Object.hasOwn(data.features,'conversationEvidence')&&typeof data.features.conversationEvidence!=='boolean')throw Error('Invalid conversation evidence');
  if(Object.hasOwn(data.features,'learnedContext')&&typeof data.features.learnedContext!=='boolean')throw Error('Invalid context selection');
  if(Object.hasOwn(data.features,'uiSourceReference')&&typeof data.features.uiSourceReference!=='boolean')throw Error('Invalid UI source reference');
  if(data.features.uiSourceReference===true&&data.features.learnedContext!==true)throw Error('UI source reference requires learned context');
  if(data.features.learnedContext===true){
    const t=data.thresholds;
    if(!plain(t))throw Error('Missing calibrated context cutoff');
    if(Object.hasOwn(t,'contextLogit')?!Number.isFinite(t.contextLogit):!Number.isFinite(t.context)||t.context<0||t.context>1)throw Error('Invalid calibrated context cutoff');
  }
  if(data.values?.numbers){
   const numbers=data.values.numbers;if(!plain(numbers))throw Error('Invalid number words');let count=0;
   for(const word in numbers)
     if(own(numbers,word)){
       if(++count>200)throw Error('Invalid number words');
       const value=numbers[word];
       if(!/^[\p{L}]+$/u.test(word)||word.length>30||!Number.isFinite(value)||value<0||value>10000)throw Error('Invalid number word');
     }
  }
  const localPack=data.publicPort?.method==='public-control-label-projection-v1';
  if(localPack&&(data.models.kind||data.models.action?.labels?.includes('ai')))throw Error('Generative output in local pack');
  for(const name of localPack?['action','item','context']:['action','item','kind','context'])if(!data.models[name])throw Error('Missing model');
  for(const pattern of data.patterns)compilePattern(pattern);
  for(const key in data.models)if(own(data.models,key)){
   const m=data.models[key];
   if(!/^(?:action|item|kind|context|detail:(?:open\/find|setting|feature|module|navigate|focus-control|reminder|plan|chat|note|bookmark|none))$/.test(key)||
     !plain(m)||
     !Array.isArray(m.labels)||
     !m.labels.length||
     m.labels.length>160||
     m.labels.some(v=>typeof v!=='string'||v.length>600)||
     !Number.isFinite(m.scale)||
     m.scale<=0||
     !plain(m.weights))
     throw Error('Invalid sparse model');
   if(new Set(m.labels).size!==m.labels.length)throw Error('Duplicate model label');
   if(key==='action'&&m.labels.some(v=>!['open/find','plan','complete','setting','feature','module','navigate','reminder','note','bookmark','focus','focus-control','ai','chat','none'].includes(v)))throw Error('Unknown action');
   if(key==='kind'&&m.labels.some(v=>v.split('|').some(k=>!['ask','practice','lab','reading','notes','rubric','fixes','steps','outline','message','summary','flashcards'].includes(k))))
     throw Error('Unknown help kind');
   if(['item','context'].includes(key)&&(m.labels.length!==1||m.labels[0]!=='yes'))throw Error('Invalid rank model');
   if(key.startsWith('detail:'))
     for(const label of m.labels){
       let detail;
       try{detail=JSON.parse(label);}catch{throw Error('Invalid detail label');}
       safe(detail);
       if(!plain(detail)||Object.entries(detail).some(([k,v])=>!['key','value','id','on','action','tab','filter','operation','answerField'].includes(k)||!['string','boolean'].includes(typeof v)))
         throw Error('Invalid detail fields');
     }
   if(m.trees)validateTrees(m.trees,m.labels.length);if(m.ranker)validateTrees(m.ranker,1);
   let count=0;
   for(const feature in m.weights)
     if(own(m.weights,feature)){if(++count>40000)throw Error('Invalid sparse model');if(feature.length>250||!finiteVector(m.weights[feature],m.labels.length,1e8))throw Error('Invalid coefficient');}
  }
  return data;
 }
 function combine(base,delta){
   if(!base){if(delta.tier!=='basic'||delta.extends||Object.values(delta.models).some(m=>m.delta))throw Error('Residual pack requires its base');return delta;}
   if(delta.extends!==base.tier||TIERS.indexOf(delta.tier)!==TIERS.indexOf(base.tier)+1)throw Error('Wrong residual ancestry');
   const models={...base.models};
   for(const name in delta.models)
     if(own(delta.models,name)){
       const m=delta.models[name];
       if(m.delta){
         const prev=models[name];
         if(!prev||JSON.stringify(prev.labels)!==JSON.stringify(m.labels)||prev.scale!==m.scale)throw Error('Incompatible model delta');
         const weights={...prev.weights};
         for(const k in m.weights)if(own(m.weights,k)){const v=m.weights[k],prior=prev.weights[k];weights[k]=v.map((w,i)=>w+(prior?.[i]||0));}
         models[name]={...m,weights,delta:false};
       }
       else models[name]=m;
     }
   return {...base,...delta,models,patterns:[...base.patterns,...delta.patterns]};
 }
 function create({read}={}){
  const cache=new Map(),pending=new Map();
  let active=null;
  const node=typeof module==='object'&&module.exports,
    readSync=tier=>JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'biscuit-rules',tier+'.json'),'utf8')),
    reader=read||((tier)=>node?readSync(tier):fetch(assetURL('biscuit-rules/'+tier+'.json')).then(r=>{
    if(!r.ok)throw Error('Pack read failed');
    return r.json();
  }));
  function get(tier='basic'){
    if(!TIERS.includes(tier))tier='basic';
    if(cache.has(tier))return cache.get(tier);
    if(!node||read)return TIERS.slice(0,TIERS.indexOf(tier)+1).reverse().map(v=>cache.get(v)).find(Boolean)||null;
    const n=TIERS.indexOf(tier),base=n?get(TIERS[n-1]):null;
    try{
      if(n&&!base)return null;
      const own=validate(readSync(tier),tier),result=combine(base,own);
      if(base)validate(result,tier);
      cache.set(tier,result);
      return result;
    }catch{return base;}
  }
  async function load(tier='basic'){
    if(!TIERS.includes(tier))tier='basic';
    if(cache.has(tier)){active=cache.get(tier);return active;}
    if(pending.has(tier))return pending.get(tier);
    const p=(async()=>{
      const n=TIERS.indexOf(tier),base=n?await load(TIERS[n-1]):null;
      try{
        if(n&&!base)return null;
        const data=validate(await reader(tier),tier),result=combine(base,data);
        if(base)validate(result,tier);
        cache.set(tier,result);
        active=result;
        return result;
      }catch{active=base;return base;}finally{pending.delete(tier);}
    })();
    pending.set(tier,p);
    return p;
  }
  return {get,load,current:()=>active,loaded:()=>[...cache.keys()]};
 }
 const shared=create(),api={TIERS,validate,compilePattern,matchPattern,combine,create,get:shared.get,load:shared.load,current:shared.current};
 root.ReserveBiscuitRules=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
