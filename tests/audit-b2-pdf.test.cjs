// B2 audit (2026-11-14): the PDF reader. Each test fails on the untouched 4.0.164 copy and passes with its patch.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
require('./pdfjs-node-fixture.cjs');// the polyfills the extension ships for PDF.js (Node lacks some built-ins)
const Host=require('../extension/pdf-host.js');
const canvas='https://school.instructure.com';
// A one-page PDF whose header is not the very first byte (a byte-order mark or a line before "%PDF-"), with offsets that
// count that preamble. PDF readers (and PDF.js) look for the header anywhere in the first 1024 bytes.
function pdfWith(preamble){
 const content='BT /F1 12 Tf 40 350 Td (Chapter one) Tj ET',objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 const head=Buffer.from(preamble,'latin1');let text='%PDF-1.7\n';const offsets=[];
 for(let i=0;i<objects.length;i++){offsets.push(head.length+Buffer.byteLength(text));text+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
 const xref=head.length+Buffer.byteLength(text);text+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.map(o=>`${String(o).padStart(10,'0')} 00000 n \n`).join('');
 text+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Uint8Array.from(Buffer.concat([head,Buffer.from(text,'latin1')]));
}
function response(bytes){const chunks=[bytes.subarray(0,3),bytes.subarray(3)];return {ok:true,status:200,type:'basic',url:canvas+'/files/42/download',headers:{get:key=>key==='content-length'?String(bytes.length):'application/pdf'},body:{getReader:()=>({read:async()=>chunks.length?{done:false,value:chunks.shift()}:{done:true},cancel:async()=>{},releaseLock(){}})}};}

test('a Canvas PDF whose "%PDF-" header comes after a byte-order mark or a blank line opens in the reader, as PDF.js and the reader\'s own download accept it',async()=>{
 const lib=await import(pathToFileURL(path.resolve(__dirname,'../extension/vendor/pdfjs/pdf.mjs')).href);
 lib.GlobalWorkerOptions.workerSrc=pathToFileURL(path.resolve(__dirname,'../extension/vendor/pdfjs/pdf.worker.mjs')).href;
 for(const preamble of ['\xEF\xBB\xBF','\r\n']){
  const bytes=pdfWith(preamble);
  // the file is a real PDF: PDF.js opens it and reads its words
  const loading=lib.getDocument({data:bytes.slice(),verbosity:0,isEvalSupported:false,useWorkerFetch:false});
  try{const pdf=await loading.promise,page=await pdf.getPage(1),text=(await page.getTextContent()).items.map(i=>i.str).join('');assert.equal(pdf.numPages,1);assert.match(text,/Chapter one/);}finally{await loading.destroy();}
  // and the host hands it to the reader instead of refusing it as "not a PDF"
  const read=await Host.readVerifiedPdf({origin:canvas,fileId:'42',fetchImpl:async()=>response(bytes)});
  assert.equal(read.byteLength,bytes.length,JSON.stringify(preamble));
 }
 // a file with no PDF header in its first kilobyte is still refused
 const html=new TextEncoder().encode('<!doctype html>'+' '.repeat(1100)+'%PDF-1.7');
 await assert.rejects(Host.readVerifiedPdf({origin:canvas,fileId:'42',fetchImpl:async()=>response(html)}),/not a PDF/);
});
