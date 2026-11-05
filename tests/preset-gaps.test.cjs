const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ext=path.join(__dirname,'..','extension');
// Controls drawn by core code must not point at an add-on that is off (they would do nothing).
function arrange(enabled){const context={ReserveFeatures:{enabled:id=>enabled.includes(id)}};context.globalThis=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(ext,'workspace-arrange.js'),'utf8'),context);return context.ReserveWorkspaceArrange;}
test('the size-and-place button appears only when Planner, which handles it, is on',()=>{
 for(const key of ['work','reader']){
  assert.match(arrange(['dashboard','arrange','planner']).controls(key),/data-rd-action="module-menu"/);
  assert.doesNotMatch(arrange(['dashboard','arrange']).controls(key),/module-menu/);
 }
});
