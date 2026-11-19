'use strict';
// perf leaks-7: the dashboard's destroy() let the Help band live on. Its runtime message listener kept the band, its
// host and the whole detached dashboard (about 9,900 nodes per remount) alive, and it went on handling every AI run
// message on that detached page.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Band=require('../extension/study-band.js'),{fixture:dashboard}=require('./dashboard-heading-fixture.cjs');
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};

test('destroying the dashboard destroys its Help band and removes the band\'s message listener',async t=>{
 const listeners=new Set();
 const f=dashboard({courseId:'all',setup({env}){env.chrome={runtime:{onMessage:{addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn)}}};env.CanvasHarnessStudyBand=Band;env.ReserveFeatures={enabled:id=>id!=='motion'};env.ReservePlannerUI=null;for(const file of ['workspace-gestures.js','workspace-arrange.js','planner-model.js','widgets.js','dashboard.js']){if(fs.existsSync('extension/'+file))vm.runInNewContext(fs.readFileSync('extension/'+file,'utf8'),env);}}});
 let destroyed=false;t.after(()=>{if(!destroyed)f.dashboard.destroy();});await tick();
 const host=f.container.querySelector('[data-help-band]');assert.ok(host,'the Help band is on the page');assert.ok(f.container.querySelector('.ch-help-band'),'and drawn');
 assert.equal(listeners.size,1,'the band listens for AI run messages');
 f.dashboard.destroy();destroyed=true;
 assert.equal(listeners.size,0,'its listener goes with the dashboard');assert.equal(host.childNodes.length,0,'and the band leaves its host');
});
