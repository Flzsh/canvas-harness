'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture}=require('./dashboard-heading-fixture.cjs');
const featureSource=fs.readFileSync(path.join(__dirname,'../extension/features.js'),'utf8');
const fallback=({env})=>{vm.runInContext(featureSource,env,{filename:'features.js'});env.ReserveFeatures.apply({preset:'custom',custom:['dashboard']});};

test('getState preserves each disabled destination through a mount/destroy/remount cycle',()=>{
 for(const destination of ['materials','hub','inbox','plan','grades']){
  const f=fixture({courseId:'20',initialState:{workspace:destination},setup:fallback});
  assert.equal(f.container.dataset.workspace,'work',destination+' is visibly unavailable');
  const state=f.dashboard.getState();
  assert.equal(state.workspace,destination,'the exported destination must remain available to content.js');
  assert.equal(state.courseId,'20','course selection survives');
  f.dashboard.destroy();
  const again=f.env.ReserveDashboard.mount(f.document.body,{snapshot:f.snapshot,store:f.store,demo:true,initialState:state});
  assert.equal(again.getState().workspace,destination,'remount does not overwrite a disabled workspace');
  again.destroy();
 }
});

test('selecting an enabled workspace intentionally clears the remembered disabled destination',()=>{
 const f=fixture({initialState:{workspace:'materials'},setup:({env})=>{
  vm.runInContext(featureSource,env,{filename:'features.js'});
  env.ReserveFeatures.apply({preset:'lite'});
 }});
 try{
  assert.equal(f.dashboard.getState().workspace,'materials');
  f.click('workspace',{tab:'grades'});
  assert.equal(f.container.dataset.workspace,'grades');
  assert.equal(f.dashboard.getState().workspace,'grades');
 }finally{f.dashboard.destroy();}
});
