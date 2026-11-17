'use strict';
// Audit B3 (2026-11-14), on the public Market worker: adding a Market scene (a "feature" pack) that the student's preset
// already turns on must not rewrite the feature choice as Custom; removing it must not either. A feature the preset does
// not turn on is still added (Lite becomes Custom with it) and taken away again on removal.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {worker,message}=require('./market-worker-fixture.cjs');
const FEATURES='reserve:features';
test('a Market scene the Full preset already turns on keeps Full through install and removal',async()=>{
 const h=worker();h.data[FEATURES]={preset:'full'};
 assert.deepEqual(await h.request(message('feature',{feature:'scene-themes',sceneTheme:'sea'},'sea-pack')),{ok:true});
 assert.equal(h.env.ReserveFeatures.normalize(h.data[FEATURES]).preset,'full','install keeps the preset the student chose');
 assert.ok(h.env.ReserveFeatures.resolve(h.data[FEATURES]).enabled.includes('scene-themes'));
 await h.client.remove('sea-pack');
 assert.equal(h.env.ReserveFeatures.normalize(h.data[FEATURES]).preset,'full','removing it keeps the preset');
 assert.ok(h.env.ReserveFeatures.resolve(h.data[FEATURES]).enabled.includes('scene-themes'),'Full still has scene themes');
});
test('a feature the preset does not turn on is still added (Lite becomes Custom with it) and taken away again',async()=>{
 const h=worker(),F=h.env.ReserveFeatures;h.data[FEATURES]={preset:'lite'};
 const lite=F.resolve({preset:'lite'}).enabled,full=F.resolve({preset:'full'}).enabled;
 const id=full.find(f=>!lite.includes(f)&&f!=='ai'&&f!=='developer'&&f!=='scene-themes');
 assert.ok(id,'Full has a feature Lite does not');
 assert.deepEqual(await h.request(message('feature',{feature:id},'extra-feature')),{ok:true});
 assert.equal(F.normalize(h.data[FEATURES]).preset,'custom');assert.ok(F.resolve(h.data[FEATURES]).enabled.includes(id));
 await h.client.remove('extra-feature');
 assert.ok(!F.resolve(h.data[FEATURES]).enabled.includes(id),'removing it takes the feature away again');
});
