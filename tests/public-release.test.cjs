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
test('public loader has every new packaged dependency before its consumer, with Your AI behind its feature',()=>{
 const full=F.resolve('full').js,index=file=>{assert.ok(full.includes(file),file);return full.indexOf(file);};
 for(const [dependency,consumer]of [['agent-clock.js','pony-ask.js'],['biscuit-parse.js','pony-brain.js'],['pony-brain.js','pets.js'],['custom-kits.js','pack-common.js'],['pack-common.js','theme-pack.js'],['pack-common.js','preset-pack.js'],['make-your-own.js','customize-ui.js'],['scene-themes.js','dashboard.js'],['hand-in.js','widgets.js']])assert.ok(index(dependency)<index(consumer),dependency+' before '+consumer);
 // 4.0: Your AI's study pipeline loads with the AI feature (on in Full) and never in Lite.
 for(const file of ['study-ui.js','agent-client.js','ai-source.js'])index(file);
 assert.ok(index('agent-client.js')<index('ai-source.js'),'agent client before the AI source');
 assert.ok(F.resolve('lite').js.every(file=>!/^agent-(?!clock\.|home\.)|^study-(?!kind\.)|^ai-api|^overnight/.test(file)));
 assert.ok(full.includes('ai-context.js')&&full.includes('ai-source.js'),'retains the AI handoff');
});
test('manifest keeps required permissions and publishes only explicit page resources',()=>{
 const m=JSON.parse(read('extension/manifest.json'));
 assert.deepEqual(m.permissions,['storage','unlimitedStorage','offscreen','scripting','alarms']);
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
 assert.equal(version,'3.99.1');assert.equal(m.version,version);assert.equal(m.version_name,'4.0 Preview 1');
 assert.equal(JSON.parse(read('package.json')).versionName,m.version_name);
 assert.match(read('CHANGELOG.md'),/## 4\.0 Preview 1 - 2026-10-\d\d/);
 assert.match(read('CHANGELOG.md'),/## 3\.8\.0 - 2026-10-28/);
 const entry38=read('CHANGELOG.md').split('## 3.8.0')[1]?.split('## ')[0]||'';for(const issue of [58,59,60,61])assert.match(entry38,new RegExp('@garywu000[^\\n]*#'+issue));
 const entry=read('CHANGELOG.md').split('## 3.5.0')[1]?.split('## ')[0]||'';for(const pr of [47,51,52])assert.match(entry,new RegExp('@garywu000[^\\n]*#'+pr));assert.match(entry,/@HarryX081125[^\n]*#53/);
 for(const file of ['modules-page.js','hand-in.js','focus-room.js','review-deck.js','review-deck-model.js','grade-impact.js','canvas-nav.js','api.js'])assert.match(read('extension/'+file).split('\n').slice(0,3).join('\n'),/Gary Wu|garywu000/i,file);
});
