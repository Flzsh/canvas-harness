// Adapted from Gary Wu's pull request #39 to Canvas Harness.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Nav=require('../extension/canvas-nav.js'),Features=require('../extension/features.js');
test('navigation hint uses the preloaded drawer rules and avoids repeated mutations',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};let writes=0;
 const classes=new Set(),html={dataset:new Proxy({},{set(target,key,value){writes++;target[key]=value;return true;}}),classList:{contains:key=>classes.has(key),add:key=>classes.add(key)}};
 Nav.rememberLayout(html,storage,'drawer');assert.equal(values.get('reserve:navEarly'),'drawer');Nav.earlyLayout(html,storage);const before=writes;Nav.earlyLayout(html,storage);assert.equal(writes,before);assert.equal(html.dataset.chnLayout,'drawer');assert.equal(html.dataset.chnDrawer,'closed');assert.ok(classes.has('chn-nav'));
 Nav.rememberLayout(html,storage,'top');assert.equal(values.has('reserve:navEarly'),false);assert.equal(html.dataset.chnEarly,undefined);
});
test('feature lifecycle clears a stale navigation hint even when navigation never started',()=>{
 const values=new Map([['reserve:features-hint',JSON.stringify({preset:'lite'})],['reserve:navEarly','drawer']]),env=vm.createContext({localStorage:{getItem:key=>values.get(key)||null,removeItem:key=>values.delete(key)}});
 vm.runInContext(fs.readFileSync(require.resolve('../extension/features.js'),'utf8'),env);assert.equal(values.has('reserve:navEarly'),false);
 values.set('reserve:navEarly','drawer');env.ReserveFeatures.apply({preset:'custom',custom:['dashboard']});assert.equal(values.has('reserve:navEarly'),false);
});
test('Extras are opt in for Full, Lite and default Custom, and load only after explicit selection',()=>{
 for(const prefs of [undefined,'full','lite',{preset:'custom'}])for(const id of ['focus-room','review-deck','grade-impact']){
  const feature=Features.catalogue.find(entry=>entry.id===id),selection=Features.resolve(prefs);assert.equal(feature.group,'Extras');assert.equal(selection.enabled.includes(id),false);for(const file of feature.files.js)assert.equal(selection.js.includes(file),false);
 }
 for(const id of ['focus-room','review-deck','grade-impact']){const selection=Features.resolve({preset:'custom',custom:[id]});assert.ok(selection.enabled.includes(id));for(const file of Features.catalogue.find(entry=>entry.id===id).files.js)assert.ok(selection.js.includes(file));}
});
