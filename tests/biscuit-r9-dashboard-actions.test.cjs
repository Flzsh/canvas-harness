'use strict';
// Round 9: the dashboard carries out Biscuit's Assignments views and the Review deck room, and each undo puts the page back.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture}=require('./dashboard-heading-fixture.cjs');
const featureSource=fs.readFileSync(path.join(__dirname,'../extension/features.js'),'utf8');
function mount(){let navigate=null;const f=fixture({setup:({env})=>{vm.runInContext(featureSource,env,{filename:'features.js'});env.ReserveFeatures.apply({preset:'full'});const noop=()=>{};env.ReserveWidgets={create:options=>{navigate=options.navigate;return {sync:noop,close:noop,keydown:()=>false,finished:noop,editing:()=>false,syncRoom:noop,read:noop,planUI:()=>null,input:()=>false,flush:()=>Promise.resolve(true),destroy:noop,click:()=>false,change:()=>false,biscuitContext:()=>({}),askPet:noop};}};}});return {f,navigate:request=>navigate(request)};}
test('an Assignments view opens the Assignments page on that view, and undo goes back',()=>{
 const {f,navigate}=mount();try{
  assert.equal(typeof navigate,'function','the dashboard hands Biscuit its navigate');
  const before=f.dashboard.getState().workspace;
  const result=navigate({tab:'assignments',view:'week'});assert.equal(result?.ok,true);assert.equal(f.dashboard.getState().workspace,'assignments');
  assert.equal(result.undo(),true);assert.equal(f.dashboard.getState().workspace,before);
  assert.equal(navigate({tab:'assignments',view:'nonsense'}),false,'an unknown view changes nothing');
 }finally{f.dashboard.destroy();}
});
