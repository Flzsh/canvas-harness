'use strict';
// The PDF reader: the PDF.js decoders, standard fonts, character maps and colour profile in vendor/pdfjs-data
// (from pdfjs-dist 6.4.299 on npm, the same release as vendor/pdfjs) are present, unchanged, and passed to PDF.js.
// Without them scanned pages (JBIG2, JPEG 2000) draw as blank white pages.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const ext=path.join(__dirname,'..','extension'),data=path.join(ext,'vendor','pdfjs-data');

test('every file in vendor/pdfjs-data matches its recorded checksum, and nothing is missing or extra',()=>{
 const sums=fs.readFileSync(path.join(data,'SHA256SUMS'),'utf8').trim().split('\n').map(l=>{const m=/^([0-9a-f]{64}) {2}\.\/(.+)$/.exec(l);assert.ok(m,l);return[m[2],m[1]];});
 const listed=new Map(sums);
 const walk=d=>fs.readdirSync(path.join(data,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
 const files=walk('').filter(f=>f!=='SHA256SUMS').sort();
 assert.deepEqual(files,[...listed.keys()].sort());
 for(const [f,h] of listed)assert.equal(createHash('sha256').update(fs.readFileSync(path.join(data,f))).digest('hex'),h,f);
});

test('the decoders PDF.js asks for are all there',()=>{
 for(const f of ['wasm/jbig2_nowasm_fallback.js','wasm/openjpeg_nowasm_fallback.js','iccs/CGATS001Compat-v2-micro.icc','standard_fonts/FoxitSerif.pfb','standard_fonts/LiberationSans-Regular.ttf','cmaps/UniGB-UCS2-H.bcmap'])
  assert.ok(fs.existsSync(path.join(data,f)),f);
});

test('the reader passes the data locations to PDF.js, with the plain-JavaScript decoders',()=>{
 const src=fs.readFileSync(path.join(ext,'pdf-reader.mjs'),'utf8');
 assert.match(src,/new URL\('\.\/vendor\/pdfjs-data\/',import\.meta\.url\)/);
 for(const opt of ["wasmUrl:base+'wasm/'","standardFontDataUrl:base+'standard_fonts/'","cMapUrl:base+'cmaps/'",'cMapPacked:true',"iccUrl:base+'iccs/'",'useWorkerFetch:true','useWasm:false'])
  assert.ok(src.includes(opt),opt);
 // the extension's policy has no 'wasm-unsafe-eval', which is why useWasm stays false
 const csp=JSON.parse(fs.readFileSync(path.join(ext,'manifest.json'),'utf8')).content_security_policy.extension_pages;
 assert.ok(!csp.includes('wasm-unsafe-eval'));
});
