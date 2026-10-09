'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),extension=path.join(root,'extension');
const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json'),'utf8'));
assert.equal(manifest.manifest_version,3);
assert.deepEqual(manifest.permissions,['storage','offscreen']);
assert.deepEqual(manifest.optional_permissions,['scripting','nativeMessaging']);
const providers=require('../extension/ai-providers.js');
assert.deepEqual(manifest.optional_host_permissions,providers.list.flatMap(p=>p.origins));
assert.equal(manifest.background.service_worker,'background.js');
assert.equal(manifest.externally_connectable,undefined);
assert.deepEqual(manifest.host_permissions,['https://*.instructure.com/*']);
const files=fs.readdirSync(extension,{recursive:true}).filter(f=>fs.statSync(path.join(extension,f)).isFile());
for(const file of files.filter(f=>f.endsWith('.js')))new vm.Script(fs.readFileSync(path.join(extension,file),'utf8'),{filename:file});
const references=[manifest.background.service_worker,...manifest.content_scripts.flatMap(c=>[...(c.js||[]),...(c.css||[])]),...Object.values(manifest.icons),manifest.action.default_popup,...Object.values(manifest.action.default_icon),...manifest.web_accessible_resources.flatMap(r=>r.resources)];
for(const ref of references)assert.ok(files.includes(ref.replaceAll('/',path.sep)),`Missing manifest resource: ${ref}`);
assert.deepEqual(manifest.content_scripts[0].matches,['https://*.instructure.com/*']);
assert.equal(manifest.content_scripts[0].all_frames,false);
assert.equal(manifest.content_scripts[0].js.at(-1),'content.js');
for(const size of [16,32,48,128]){const png=fs.readFileSync(path.join(extension,`icons/icon-${size}.png`));assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}
for(const file of ['popup.html']){const html=fs.readFileSync(path.join(extension,file),'utf8');for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g))assert.ok(fs.existsSync(path.join(extension,match[1])),`Missing HTML resource: ${match[1]}`);assert.ok(!/<script(?![^>]*src=)[^>]*>\s*\S/i.test(html),'Inline executable script in popup');}
console.log(`Verified ${files.length} extension files: JavaScript syntax, Manifest V3 resources, restricted permissions, and icon sizes.`);
module.exports={root,extension,files,manifest};
