// Adapted from Gary Wu's pull request #47 to Canvas Harness.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ext=path.join(__dirname,'../extension'),read=file=>fs.readFileSync(path.join(ext,file),'utf8');
const manifest=JSON.parse(read('manifest.json')),[fixed,dynamic]=manifest.web_accessible_resources;

test('only the PDF iframe entry and Canvas host stylesheet are web accessible',()=>{
 const pdfResources=fixed.resources.filter(file=>/^pdf-|^vendor\//.test(file));assert.deepEqual(pdfResources,['pdf-reader.html','pdf-host.css']);
 assert.deepEqual(fixed.matches,['https://*.instructure.com/*']);assert.deepEqual(dynamic.matches,['https://*/*']);assert.equal(dynamic.use_dynamic_url,true);
 assert.deepEqual(fixed.resources,dynamic.resources);
 assert.deepEqual(dynamic.resources.filter(file=>/^pdf-|^vendor\//.test(file)),pdfResources,'custom Canvas local PDFs expose only the reader entry and host sheet at randomized URLs');
 for(const entry of manifest.web_accessible_resources)assert.ok(!entry.resources.some(file=>/\*|\.js$|\.mjs$/.test(file)),'no scripts, vendor modules or wildcard resources are exposed');
 assert.match(read('pdf-host.js'),/getURL\('pdf-reader\.html'\)/);assert.match(read('pdf-host.js'),/link\.rel='stylesheet';link\.href=currentRuntime\.getURL\('pdf-host\.css'\)/);
});

test('PDF scripts, art, export, vendor modules and reader styles resolve inside the extension iframe',()=>{
 const html=read('pdf-reader.html'),internal=['pdf-art.css','pdf-reader.css','pdf-art.js','pdf-model.js','pdf-export.js','pdf-reader.js'];
 for(const file of internal){assert.ok(html.includes('"'+file+'"'),'iframe directly loads '+file);assert.ok(fs.existsSync(path.join(ext,file)));for(const entry of manifest.web_accessible_resources)assert.ok(!entry.resources.includes(file),'iframe internal must stay private: '+file);}
 // PDF.js loads through its entry modules, which add the polyfills first (pdf-polyfills.js).
 const reader=read('pdf-reader.js');assert.match(reader,/import\(['"]\.\/pdf-library\.mjs['"]\)/);assert.match(reader,/getURL\('pdf-worker\.mjs'\)/);
 for(const file of ['pdf-library.mjs','pdf-worker.mjs','pdf-polyfills.js','vendor/pdfjs/pdf.mjs','vendor/pdfjs/pdf.worker.mjs']){
  assert.ok(fs.existsSync(path.join(ext,file)),'private PDF module remains packaged: '+file);
  for(const entry of manifest.web_accessible_resources)assert.ok(!entry.resources.includes(file),'private PDF module stays private: '+file);
 }
 for(const file of ['pdf-art.css','pdf-reader.css','pdf-host.css'])for(const [,ref]of read(file).matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)){
  if(ref.startsWith('data:'))continue;assert.ok(fs.existsSync(path.join(ext,ref)),'stylesheet resource exists: '+ref);
  if(file==='pdf-host.css')assert.ok(fixed.resources.includes(ref),'Canvas-loaded CSS resource is exposed: '+ref);
 }
});
