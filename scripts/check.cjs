'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),extension=path.join(root,'extension');
const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json'),'utf8'));
assert.equal(manifest.manifest_version,3);
assert.deepEqual(manifest.permissions,['storage','unlimitedStorage','offscreen']);
assert.deepEqual(manifest.optional_permissions,['scripting']);
const providers=require('../extension/ai-providers.js');
assert.deepEqual(manifest.optional_host_permissions,providers.list.flatMap(p=>p.origins));
assert.equal(manifest.background.service_worker,'background.js');
assert.equal(manifest.externally_connectable,undefined);
assert.deepEqual(manifest.host_permissions,['https://*.instructure.com/*']);
const files=fs.readdirSync(extension,{recursive:true}).filter(f=>fs.statSync(path.join(extension,f)).isFile());
for(const file of files.filter(f=>f.endsWith('.js')))new vm.Script(fs.readFileSync(path.join(extension,file),'utf8'),{filename:file});
const references=[manifest.background.service_worker,...manifest.content_scripts.flatMap(c=>[...(c.js||[]),...(c.css||[])]),...Object.values(manifest.icons),manifest.action.default_popup,...Object.values(manifest.action.default_icon),...manifest.web_accessible_resources.flatMap(r=>r.resources)];
for(const ref of references)assert.ok(files.includes(ref.replaceAll('/',path.sep)),`Missing manifest resource: ${ref}`);
const bootstrap=manifest.content_scripts.find(c=>c.js.includes('startup.js')),controller=manifest.content_scripts.find(c=>c.js.includes('content.js'));
assert.ok(manifest.content_scripts.indexOf(bootstrap)<manifest.content_scripts.indexOf(controller));
for(const entry of [bootstrap,controller]){assert.deepEqual(entry.matches,['https://*.instructure.com/*']);assert.equal(entry.all_frames,false);assert.equal(entry.run_at,'document_start');}
assert.equal(controller.js.at(-1),'content.js');
// Dashboard-only scripts load on the dashboard alone. They run before content.js, and no script that loads on
// every page may name a global they define, or a course or quiz page would fail without them.
const dashboardPaths=['/','/?*','/dashboard','/dashboard?*','/dashboard/','/dashboard/?*'].map(p=>'https://*.instructure.com'+p);
const dashboardEntry=manifest.content_scripts.find(c=>c.matches.join()!=='https://*.instructure.com/*');
assert.ok(dashboardEntry,'dashboard-only scripts need their own content_scripts entry');
assert.deepEqual(dashboardEntry.matches,dashboardPaths);assert.equal(dashboardEntry.run_at,'document_start');assert.equal(dashboardEntry.all_frames,false);
assert.ok(manifest.content_scripts.indexOf(dashboardEntry)<manifest.content_scripts.indexOf(controller),'dashboard scripts must load before content.js');
const everyPage=manifest.content_scripts.filter(c=>c!==dashboardEntry&&c!==bootstrap).flatMap(c=>c.js).filter(f=>f!=='content.js');
const defines=file=>[...fs.readFileSync(path.join(extension,file),'utf8').matchAll(/\b(?:root|globalThis)\.((?:Reserve|CanvasHarness)\w+)\s*=(?!=)/g)].map(m=>m[1]);
const dashboardGlobals=dashboardEntry.js.flatMap(defines);
for(const file of everyPage){const source=fs.readFileSync(path.join(extension,file),'utf8');for(const name of dashboardGlobals)assert.ok(!new RegExp('\\b'+name+'\\b').test(source),`${file} loads on every page but uses ${name} from a dashboard-only script`);}
for(const size of [16,32,48,128]){const png=fs.readFileSync(path.join(extension,`icons/icon-${size}.png`));assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}
for(const file of ['popup.html']){const html=fs.readFileSync(path.join(extension,file),'utf8');for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g))assert.ok(fs.existsSync(path.join(extension,match[1])),`Missing HTML resource: ${match[1]}`);assert.ok(!/<script(?![^>]*src=)[^>]*>\s*\S/i.test(html),'Inline executable script in popup');}
// Every place that names the release version must agree, so a release never ships mixed numbers.
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
assert.equal(manifest.version,version,'manifest.json version must match package.json');
assert.equal(JSON.parse(fs.readFileSync(path.join(extension,'provenance.json'),'utf8')).version,version,'provenance.json version must match package.json');
assert.equal(fs.readFileSync(path.join(extension,'content.js'),'utf8').match(/const build='([^']+)'/)?.[1],version,'content.js build must match package.json');
assert.ok(fs.readFileSync(path.join(extension,'popup.html'),'utf8').includes(version),'popup.html must show the package.json version');
console.log(`Verified ${files.length} extension files: JavaScript syntax, Manifest V3 resources, restricted permissions, icon sizes, and matching version numbers.`);
module.exports={root,extension,files,manifest};
