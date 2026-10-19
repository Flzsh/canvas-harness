'use strict';
// The Harness PDF reader on Canvas's file pages (extension/pdf-view.js puts extension/pdf-reader.html where Canvas's
// Canvadocs viewer is; that viewer stays on the page, one click away).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ext=path.join(__dirname,'../extension'),read=f=>fs.readFileSync(path.join(ext,f),'utf8');
const manifest=JSON.parse(read('manifest.json'));

test('only on a Canvas PDF file page; Canvas’s viewer stays, hidden, behind a remembered switch',()=>{
 const js=read('pdf-view.js');
 const fileId=new Function('location',js.match(/const fileId=\(\)=>\{([^}]*)\};/)[1]);
 for(const [p,id] of [['/courses/12/files/345',''+345],['/courses/12/files/345/preview','345'],['/files/9','9'],['/users/3/files/77','77'],['/courses/12/files','x'],['/courses/12/files/345/download','x'],['/courses/12/assignments/9','x']])
  assert.equal(fileId({pathname:p})??'x',id,p);
 assert.match(js,/\/api\/v1\/files\/\$\{id\}`,\{headers:\{Accept:'application\/json'\},credentials:'same-origin'\}/,'asks Canvas what the file is');
 assert.match(js,/!\/\^application\\\/pdf\$\/i\.test\(meta\['content-type'\]\|\|''\)\|\|meta\.locked_for_user\)return;/,'PDFs only, never a locked file');
 assert.match(js,/box\.style\.display=harness\?'none':''/,'Canvas’s viewer is hidden, never removed');
 assert.match(js,/localStorage\.getItem\(PREF\)==='canvas'\?'canvas':'harness'/);
 assert.match(js,/if\(e\.source!==frame\.contentWindow\|\|e\.data\?\.type!=='reserve-pdf'\)return;/,'only its own frame can ask to fall back');
 assert.match(js,/catch\{return;\}\s*\/\/ a tab left over from an extension update/);
});

test('the reader reads only the student’s own Canvas file and runs nothing from the PDF',()=>{
 const js=read('pdf-reader.mjs'),html=read('pdf-reader.html');
 assert.match(js,/\/\^\\d\{1,20\}\$\/\.test\(ID\)&&globalThis\.ReserveSite\?\.supported\?\.\(ORIGIN\)&&new URL\(ORIGIN\)\.origin===ORIGIN/,'a Canvas origin and a numeric file id');
 assert.match(js,/`\$\{ORIGIN\}\/files\/\$\{ID\}\/download\?download_frd=1`/,'the same download Canvas’s own button gives');
 assert.match(js,/isEvalSupported:false,enableXfa:false/);
 assert.match(js,/\/\^\(https\?:\|mailto:\)\/i\.test\(a\.url\)/,'only web and mail links leave the page');
 assert.match(js,/el\.rel='noopener noreferrer'/);
 assert.doesNotMatch(js,/\.convertToViewportRectangle\(/,'gone in PDF.js 6: links are placed with the viewport transform');assert.match(js,/viewport\.transform/);
 // the local preview path works only on http://localhost or 127.0.0.1, never inside the extension
 assert.match(js,/const LOCAL=\/\^http:\\\/\\\/\(localhost\|127\\\.0\\\.0\\\.1\)\(:\\d\+\)\?\$\/\.test\(location\.origin\)/);
 assert.match(html,/<script src="site\.js"><\/script>/);assert.match(html,/<script type="module" src="pdf-reader\.mjs"><\/script>/);
 assert.doesNotMatch(html+js,/\son[a-z]+="/,'no inline handlers (the extension pages’ CSP)');
 assert.match(js,/import\('\.\/vendor\/pdfjs\/pdf\.mjs'\)/);assert.match(js,/workerSrc=new URL\('\.\/vendor\/pdfjs\/pdf\.worker\.mjs',import\.meta\.url\)/);
});

test('wired in: the content script, the framed page, and Canvas’s file domain',()=>{
 assert.ok(manifest.content_scripts.some(c=>c.js.includes('pdf-view.js')));
 for(const w of manifest.web_accessible_resources)assert.ok(w.resources.includes('pdf-reader.html'),JSON.stringify(w.matches));
 // Canvas answers a download with a redirect to its file domain, which allows no other origin to read it.
 assert.ok(manifest.host_permissions.includes('https://*.canvas-user-content.com/*'));
 for(const f of ['pdf-reader.html','pdf-reader.css','pdf-reader.mjs','vendor/pdfjs/pdf.mjs','vendor/pdfjs/pdf.worker.mjs'])assert.ok(fs.existsSync(path.join(ext,f)),f);
});
