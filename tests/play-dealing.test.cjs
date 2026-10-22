'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture}=require('./play-tools-fixture.cjs');
const env={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../extension/play-tools.js'),'utf8'),env);const dealing=env.ReservePlay;
test('public dealing uses 50/30/15/5 tier odds and shares each tier uniformly',()=>{
 const counts={common:0,rare:0,epic:0,legendary:0};
 for(let i=0;i<100;i++){const samples=[(i+.5)/100,0],tool=dealing.deal({random:()=>samples.shift()});counts[dealing.tiers[tool]]++;}
 assert.deepEqual(counts,{common:50,rare:30,epic:15,legendary:5});
 for(const [tier,start,end]of [['common',0,.5],['rare',.5,.8],['epic',.8,.95],['legendary',.95,1]]){
  const tools=Object.keys(dealing.tiers).filter(key=>dealing.tiers[key]===tier);
  for(let i=0;i<tools.length;i++){const samples=[(start+end)/2,(i+.5)/tools.length];assert.equal(dealing.deal({random:()=>samples.shift()}),tools[i]);}
 }
});
test('tier boundaries, invalid RNG values and no-repeat history remain deterministic',()=>{
 for(const [value,tier]of [[0,'common'],[.5,'rare'],[.8,'epic'],[.95,'legendary'],[1,'legendary'],[-5,'common'],[NaN,'common']]){
  const samples=[value,1];assert.equal(dealing.tiers[dealing.deal({random:()=>samples.shift()})],tier);
 }
 let last='';for(let i=0;i<100;i++){const next=dealing.deal({random:()=>0,last});assert.notEqual(next,last);last=next;}
 for(const last of Object.keys(dealing.tiers))for(const value of [0,.5,.8,.95,.999])assert.notEqual(dealing.deal({random:()=>value,last}),last);
});
test('the default public tray has one tool and its draw accepts an injected RNG',()=>{
 const values=[.96,0],h=fixture({mountOptions:{all:false,random:()=>values.shift()}}),tray=h.document.getElementById('chb-tray');
 assert.equal(h.api.dealt,'blackhole');assert.equal(tray.querySelectorAll('button').length,1);assert.equal(tray.querySelector('button').dataset.tool,'blackhole');assert.equal(values.length,0);
});
for(const [tool,tier,sparks]of [['painter','common',0],['hammer','rare',0],['bomb','epic',8],['blackhole','legendary',14]])test(tier+' reveal happens once and strong tools show their tier',()=>{
 const h=fixture({mountOptions:{all:false,deal:tool}}),tray=h.document.getElementById('chb-tray'),button=tray.querySelector('button');
 assert.equal(button.dataset.tier,tier);assert.equal(button.classList.contains('chb-reveal'),true);assert.equal(button.querySelectorAll('.chb-spark').length,sparks);
 assert.equal((tray.fragments||[]).filter(html=>html.includes('chb-rays')).length,tier==='common'?0:1);assert.equal((button.fragments||[]).filter(html=>html.includes('chb-shine')).length,tier==='common'?0:1);
 if(tier!=='common')assert.match(tray.innerHTML,new RegExp('class="chb-tier">'+tier[0].toUpperCase()+tier.slice(1)));
 h.api.pick(tool);h.api.pick(tool);assert.equal((tray.fragments||[]).filter(html=>html.includes('chb-rays')).length,tier==='common'?0:1);
});
for(const options of [{reduced:true},{mountOptions:{motion:'still'}},{mountOptions:{motion:'off'}}])test('reduced or still play keeps the rare tool label without reveal animation '+JSON.stringify(options),()=>{
 const h=fixture({...options,mountOptions:{...options.mountOptions,all:false,deal:'blackhole'}}),tray=h.document.getElementById('chb-tray');
 assert.match(tray.innerHTML,/Legendary/);assert.equal(tray.querySelector('button').classList.contains('chb-reveal'),false);assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);
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
 const shakes=h.animations.filter(a=>a.options.duration===9600);assert.equal(shakes.length,2);assert.deepEqual(shakes.map(a=>a.el),[h.page,h.document.getElementById('chb-layer')]);assert.ok(shakes.every(a=>a.options.composite==='add'));h.api.destroy();assert.ok(shakes.every(a=>a.cancelled));
});
