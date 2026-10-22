'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const extension=path.join(__dirname,'../extension'),ids=['starry','sea','stars','blueprint'];
const resources=ids.flatMap(id=>fs.readdirSync(path.join(extension,'themes',id)).map(file=>'themes/'+id+'/'+file)).sort();
test('only the four public scene directories ship and every local stylesheet reference exists',()=>{
 assert.deepEqual(fs.readdirSync(path.join(extension,'themes')).sort(),[...ids].sort());
 for(const id of ids){const css=fs.readFileSync(path.join(extension,'themes',id,'theme.css'),'utf8');for(const match of css.matchAll(/url\(([^)]+)\)/g)){
  const ref=match[1].replace(/^["']|["']$/g,'');if(ref.startsWith('data:')||ref.startsWith('#'))continue;assert.doesNotMatch(ref,/^(?:https?:)?\/\//);assert.ok(fs.existsSync(path.join(extension,'themes',id,ref)),id+': '+ref);
 }}
 assert.equal(resources.length,51);assert.ok(resources.includes('themes/stars/sky.html'));assert.ok(resources.includes('themes/stars/sky.js'));
});
test('scene assets have exact fixed and dynamic resource entries while the sky script stays private',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json'),'utf8')),F=require('../extension/features.js');
 const assets=F.catalogue.find(feature=>feature.id==='scene-themes').files.assets;
 assert.deepEqual([...assets].sort(),resources);assert.equal(manifest.web_accessible_resources.length,2);
 for(const entry of manifest.web_accessible_resources){for(const file of resources.filter(file=>!file.endsWith('.js')))assert.ok(entry.resources.includes(file),'Missing scene resource: '+file);assert.ok(!entry.resources.includes('themes/stars/sky.js'));}
});
test('scene and play features load before dashboard use and keep renderers lazy',()=>{
 const F=require('../extension/features.js'),full=F.resolve(),play=F.catalogue.find(feature=>feature.id==='play');
 assert.ok(full.js.includes('submit-celebrate.js'));assert.ok(full.js.indexOf('scene-themes.js')<full.js.indexOf('dashboard.js'));
 assert.deepEqual(play.files.js,['submit-celebrate.js']);assert.deepEqual(play.files.assets,['submit-scenes.js','play-art.js','play-space.js','play-physics.js','play-tools.js','play-tools.css']);
 for(const preset of ['lite']){const selected=F.resolve({preset});assert.ok(!selected.js.includes('submit-celebrate.js'));assert.ok(!selected.js.includes('scene-themes.js'));}
});
