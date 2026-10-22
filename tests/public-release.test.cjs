'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const F=require('../extension/features.js'),root=path.join(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
test('3.4 catalogue keeps old Custom choices and leaves new costly and optional modules out of Lite',()=>{
 const old={preset:'custom',custom:['dashboard','planner','pony','quick-pack','ai']};
 assert.deepEqual(F.normalize(old),old);
 const full=F.resolve('full'),lite=F.resolve('lite');
 for(const id of ['scene-themes','play']){assert.ok(full.enabled.includes(id));assert.ok(!lite.enabled.includes(id));}
 for(const id of ['focus-room','review-deck','grade-impact']){
  assert.ok(!full.enabled.includes(id)&&!lite.enabled.includes(id));
  assert.ok(F.resolve({preset:'custom',custom:[id]}).enabled.includes(id));
 }
 for(const file of ['scene-themes.js','submit-celebrate.js','media-store.js','packs.js','data-theme.js'])assert.ok(!lite.js.includes(file),file);
});
test('public loader has every new packaged dependency before its consumer and no study pipeline',()=>{
 const full=F.resolve('full').js,index=file=>{assert.ok(full.includes(file),file);return full.indexOf(file);};
 for(const [dependency,consumer]of [['agent-clock.js','pony-ask.js'],['biscuit-parse.js','pony-brain.js'],['pony-brain.js','pets.js'],['custom-kits.js','pack-common.js'],['pack-common.js','theme-pack.js'],['pack-common.js','preset-pack.js'],['make-your-own.js','customize-ui.js'],['scene-themes.js','dashboard.js'],['hand-in.js','widgets.js']])assert.ok(index(dependency)<index(consumer),dependency+' before '+consumer);
 assert.ok(full.every(file=>!/^agent-(?!clock\.)|^study-|^ai-api|^overnight/.test(file)));
 assert.ok(full.includes('ai-context.js')&&full.includes('ai-source.js'),'retains public handoff');
});
test('manifest keeps required permissions and publishes only explicit page resources',()=>{
 const m=JSON.parse(read('extension/manifest.json'));
 assert.deepEqual(m.permissions,['storage','unlimitedStorage','offscreen','scripting']);
 assert.deepEqual(m.host_permissions,['https://*.instructure.com/*']);
 assert.ok(m.optional_host_permissions.includes('https://flzsh.github.io/*'));
 assert.equal(m.externally_connectable,undefined);
 for(const rule of m.web_accessible_resources){
  assert.ok(rule.resources.includes('themes/stars/sky.html'));
  assert.ok(!rule.resources.includes('themes/stars/sky.js'));
  for(const file of rule.resources){assert.ok(!/[*?]|\.(?:m?js)$/.test(file),file);assert.ok(fs.existsSync(path.join(root,'extension',file)),file);}
 }
 const offscreen=read('extension/ai-offscreen.html');
 assert.ok(offscreen.includes('pdf-context.js')&&offscreen.includes('ai-offscreen.js'));
 assert.ok(offscreen.includes('media-store.js')&&offscreen.includes('market-media.js'));
});
test('release versions and contributor source credits agree',()=>{
 const version=JSON.parse(read('package.json')).version,m=JSON.parse(read('extension/manifest.json'));
 assert.equal(version,'3.4.0');assert.equal(m.version,version);assert.equal(m.version_name,version);
 assert.match(read('CHANGELOG.md'),/## 3\.4\.0[\s\S]*?@garywu000/);
 for(const file of ['modules-page.js','hand-in.js','focus-room.js','review-deck.js','review-deck-model.js','grade-impact.js','canvas-nav.js','api.js'])assert.match(read('extension/'+file).split('\n').slice(0,3).join('\n'),/Gary Wu|garywu000/i,file);
});
