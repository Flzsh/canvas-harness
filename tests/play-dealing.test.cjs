'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture}=require('./play-tools-fixture.cjs');
const env={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../extension/play-tools.js'),'utf8'),env);const dealing=env.ReservePlay;
test('every gadget has its own chance out of 100, and the bands add up',()=>{
 const counts={},bands={common:0,uncommon:0,rare:0,epic:0,legendary:0};
 for(let i=0;i<100;i++){const tool=dealing.deal({random:()=>(i+.5)/100});counts[tool]=(counts[tool]||0)+1;bands[dealing.tiers[tool]]++;}
 assert.deepEqual(counts,{...dealing.weights});assert.deepEqual(bands,{common:50,uncommon:18,rare:22,epic:7,legendary:3});
 assert.deepEqual(Object.keys(dealing.weights).sort(),Object.keys(dealing.tiers).sort());
 assert.equal(Object.values(dealing.weights).reduce((sum,value)=>sum+value,0),100);
});
test('the rarity list is in order: gentle tools common, strong ones rare, and no gadget is rarer than a stronger band',()=>{
 assert.deepEqual(Object.entries(dealing.tiers).filter(([,tier])=>tier==='uncommon').map(([tool])=>tool),['eraser','magnet']);
 const least=tier=>Math.min(...Object.keys(dealing.tiers).filter(k=>dealing.tiers[k]===tier).map(k=>dealing.weights[k])),most=tier=>Math.max(...Object.keys(dealing.tiers).filter(k=>dealing.tiers[k]===tier).map(k=>dealing.weights[k])),order=['common','uncommon','rare','epic','legendary'];
 for(let i=1;i<order.length;i++)assert.ok(most(order[i])<least(order[i-1]),order[i]);
});
test('chance boundaries, invalid RNG values and no-repeat history remain deterministic',()=>{
 for(const [value,tool]of [[0,'painter'],[.5,'eraser'],[.68,'hammer'],[.9,'bomb'],[.97,'blackhole'],[.99,'foil'],[1,'foil'],[-5,'painter'],[NaN,'painter']])
  assert.equal(dealing.deal({random:()=>value}),tool,String(value));
 let last='';for(let i=0;i<100;i++){const next=dealing.deal({random:()=>0,last});assert.notEqual(next,last);last=next;}
 for(const last of Object.keys(dealing.tiers))for(const value of [0,.5,.8,.95,.999])assert.notEqual(dealing.deal({random:()=>value,last}),last);
 const rest=Object.keys(dealing.tiers).filter(key=>key!=='painter'),counts={};for(let i=0;i<87;i++){const tool=dealing.deal({random:()=>(i+.5)/87,last:'painter'});counts[tool]=(counts[tool]||0)+1;}
 for(const key of rest)assert.equal(counts[key],dealing.weights[key],'taking one gadget out leaves the others their own chances');
});
test('the default public tray has one tool and its draw accepts an injected RNG',()=>{
 const values=[.975],h=fixture({mountOptions:{all:false,random:()=>values.shift()}}),tray=h.document.getElementById('chb-tray');
 assert.equal(h.api.dealt,'blackhole');assert.equal(tray.querySelectorAll('button').length,1);assert.equal(tray.querySelector('button').dataset.tool,'blackhole');assert.equal(values.length,0);
});
for(const [tool,tier,sparks]of [['painter','common',0],['magnet','uncommon',0],['hammer','rare',0],['bomb','epic',8],['blackhole','legendary',14]])test(tier+' reveal happens once, every tool shows its band, and rays are for rare and up',()=>{
 const plain=tier==='common'||tier==='uncommon';
 const h=fixture({mountOptions:{all:false,deal:tool}}),tray=h.document.getElementById('chb-tray'),button=tray.querySelector('button');
 assert.equal(button.dataset.tier,tier);assert.equal(button.classList.contains('chb-reveal'),true);assert.equal(button.querySelectorAll('.chb-spark').length,sparks);
 assert.equal((tray.fragments||[]).filter(html=>html.includes('chb-rays')).length,plain?0:1);assert.equal((button.fragments||[]).filter(html=>html.includes('chb-shine')).length,plain?0:1);
 assert.match(tray.innerHTML,new RegExp('class="chb-tier">'+tier[0].toUpperCase()+tier.slice(1)));
 h.api.pick(tool);h.api.pick(tool);assert.equal((tray.fragments||[]).filter(html=>html.includes('chb-rays')).length,plain?0:1);
});
for(const options of [{reduced:true},{mountOptions:{motion:'still'}},{mountOptions:{motion:'off'}}])test('reduced or still play keeps the rare tool label without reveal animation '+JSON.stringify(options),()=>{
 const h=fixture({...options,mountOptions:{...options.mountOptions,all:false,deal:'blackhole'}}),tray=h.document.getElementById('chb-tray');
 assert.match(tray.innerHTML,/Legendary/);assert.equal(tray.querySelector('button').classList.contains('chb-reveal'),false);assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);
});
test('the all-tools tray names no bands',()=>{
 const h=fixture({mountOptions:{all:true}}),tray=h.document.getElementById('chb-tray');
 assert.doesNotMatch(tray.innerHTML,/chb-tier/);assert.match(tray.innerHTML,/data-tier="uncommon"/);
});
test('teardown gives back at once the pictures and bullets gravity took',()=>{
 const h=fixture(),img=h.document.createElement('img'),li=h.document.createElement('li'),read=h.context.getComputedStyle;
 h.context.getComputedStyle=el=>({...read(el),listStyleType:'disc',fontSize:'16px'});
 img.cloneNode=()=>h.document.createElement('img');img.rect={left:100,top:150,width:40,height:40,right:140,bottom:190};img.setAttribute('style','width:40px');
 li.rect={left:100,top:200,width:200,height:20,right:300,bottom:220};li.style.listStyleType='square';h.page.append(img,li);
 h.api.gravity();assert.equal(img.style.visibility,'hidden');assert.equal(li.style.listStyleType,'none');
 h.api.destroy();
 assert.equal(img.style.visibility,'');assert.equal(img.attrs.style,'width:40px');assert.equal(img._thing,undefined);assert.equal(img._look,undefined);assert.equal(li.style.listStyleType,'square');assert.equal(h.page.children[0],h.original);
});
test('feature teardown immediately restores original text nodes and clears handlers and clocks',()=>{
 for(const mode of ['balloon','gravity','magnet','portal']){
  const h=fixture();if(mode==='balloon')h.api.balloon(110,130);if(mode==='gravity')h.api.gravity();if(mode==='magnet')h.api.magnet(160,130);if(mode==='portal')h.api.portal(200,500);
  h.api.destroy();h.api.destroy();assert.equal(h.page.children[0],h.original,mode);assert.equal(h.document.getElementById('chb-layer'),null,mode);assert.equal(h.document.getElementById('chb-aim'),null,mode);
  assert.equal(h.api.physics.bodies.length,0);assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);assert.ok([...h.listeners.values()].every(list=>list.length===0));h.frame(20000);assert.equal(h.page.children[0],h.original);
 }
});
test('hidden tabs freeze delayed effects and restart without hidden-time catchup',()=>{
 const h=fixture();h.api.bomb(200,200);h.document.hidden=true;h.dispatch('visibilitychange');const count=h.animations.length;h.frame(5000);
 assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);assert.equal(h.animations.length,count);h.document.hidden=false;h.dispatch('visibilitychange');h.frame(100);assert.equal(h.animations.length,count);
 h.api.destroy();assert.equal(h.timers.size,0);assert.equal(h.frames.size,0);
});
test('changing reduced motion restores the page and subsequent tools settle without a loop',()=>{
 const h=fixture();h.api.gravity();h.setReduced(true);assert.equal(h.page.children[0],h.original);assert.equal(h.frames.size,0);h.api.gravity();assert.ok(h.api.physics.bodies.every(body=>!body.awake));assert.equal(h.frames.size,0);h.api.destroy();
});
test('page shaking includes its marks layer once and does not double-transform nested wrappers',()=>{
 const h=fixture({mountOptions:{shake:'.shake'}}),inner=h.document.createElement('div');h.page.className='shake';inner.className='shake';h.page.append(inner);h.api.shake('blackhole');
 const shakes=h.animations.filter(a=>a.options.duration===12000);assert.equal(shakes.length,2);assert.deepEqual(shakes.map(a=>a.el),[h.page,h.document.getElementById('chb-layer')]);assert.ok(shakes.every(a=>a.options.composite==='replace'),'no transform of its own: the jolt replaces the one under it');h.api.destroy();assert.ok(shakes.every(a=>a.cancelled));
});
