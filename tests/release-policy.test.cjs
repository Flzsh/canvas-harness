'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {scanTokens}=require('../scripts/release-audit.cjs');
test('3.4 package policy permits requested ports and rejects private or excluded runtime modules',()=>{
 for(const file of ['biscuit-parse.js','agent-clock.js','pony-brain.js','pony-ask.js','play-tools.js','submit-scenes.js','scene-themes.js','themes/stars/sky.js','market-worker.js','media-store.js','review-deck.js','focus-room.js','grade-impact.js'])assert.deepEqual(scanTokens(file,'',true),[],file);
 assert.deepEqual(scanTokens('pdf-study-notes.js','<script src="pdf-study-notes.js"></script>',true),[]);
 for(const file of ['agent-actions.js','agent-client.js','study-ui.js','ai-api.js','ai-api-provider.js','overnight.js'])assert.ok(scanTokens(file,'',true).length,file);
 for(const value of ['C'+'H+','As'+'tra','w'+'ra.instructure.com','reserve:'+'dev30'])assert.ok(scanTokens('test.js',value,true).length,value);
 assert.deepEqual(scanTokens('test.js','Canvas Harness: Starry Night, Under the Sea, Starfield, Blueprint',true),[]);
 const font='PT '+['As','tra'].join('')+' Serif';
 assert.deepEqual(scanTokens('vendor/pdfjs/pdf.worker.mjs',font,false),[]);
 assert.ok(scanTokens('vendor/pdfjs/pdf.worker.mjs',['As','tra mode'].join(''),false).length);
});
