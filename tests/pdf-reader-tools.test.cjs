'use strict';
// The reader's mark-up tools: strike through, text boxes, shapes, a highlighter pen, redo, and the links the host opens.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const Model=require('../extension/pdf-model.js'),Host=require('../extension/pdf-host.js');
const exportPath=path.resolve(__dirname,'../extension/pdf-export.js');
const canvas='https://school.instructure.com';
let library;
async function pdfjs(){
 if(!library)library=import(pathToFileURL(path.resolve(__dirname,'../extension/vendor/pdfjs/pdf.mjs')).href).then(lib=>{
  // PDF.js selects its in-process fake worker in Node. No browser/canvas needed.
  lib.GlobalWorkerOptions.workerSrc=pathToFileURL(path.resolve(__dirname,'../extension/vendor/pdfjs/pdf.worker.mjs')).href;
  return lib;
 });
 return library;
}
function exporter(){
 assert.ok(fs.existsSync(exportPath),'the standalone PDF exporter exists');
 return require(exportPath);
}
function tinyPdf(rotation=0){
 const stream=text=>`<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`;
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>',
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Rotate ${rotation} /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R /Annots [8 0 R] >>`,
  stream('BT /F1 12 Tf 40 350 Td (Original page one) Tj ET'),
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [20 30 320 430] /CropBox [30 40 310 420] /Rotate 90 /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>',
  stream('BT /F1 12 Tf 60 340 Td (Original page two) Tj ET'),
  '<< /Type /Annot /Subtype /Link /Rect [10 10 20 20] /Border [0 0 0] /A << /S /URI /URI (https://example.invalid/original) >> >>'
 ];
 let text='%PDF-1.7\n',offsets=[0];
 for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(text));text+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
 const xref=Buffer.byteLength(text);
 text+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
 for(const offset of offsets.slice(1))text+=`${String(offset).padStart(10,'0')} 00000 n \n`;
 text+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Uint8Array.from(Buffer.from(text));
}
async function open(lib,data){
 return lib.getDocument({data:Uint8Array.from(data),verbosity:0,isEvalSupported:false,enableXfa:false,useWasm:false,useWorkerFetch:false,disableAutoFetch:true,disableStream:true}).promise;
}
function near(actual,expected,tolerance=.05){
 assert.equal(actual.length,expected.length);
 for(let i=0;i<expected.length;i++)assert.ok(Math.abs(actual[i]-expected[i])<=tolerance,`${actual[i]} is near ${expected[i]} at coordinate ${i}`);
}
function anchor({href=canvas+'/courses/7/files/42/download',name='Reading.pdf',type='File',title='',preview=false}={}){
 const attrs={href,'data-api-returntype':type,title};
 const el={tagName:'A',href,textContent:name,dataset:{apiReturntype:type},className:preview?'file_preview_link':'instructure_file_link',
  isConnected:true,clicks:0,focused:0,getAttribute:key=>attrs[key]??null,
  closest(selector){return selector.includes('a[')?this:null;},click(){this.clicks++;},focus(){this.focused++;}};
 return el;
}
function click(el,overrides={}){
 return {target:el,button:0,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,defaultPrevented:false,
  prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...overrides};
}

test('the model accepts strike, text and shape marks with their drawing details and rejects bad ones',()=>{
 const notes=Model.createAnnotations();
 notes.add({type:'strike',page:0,rects:[[10,10,90,20]]});
 notes.add({type:'text',page:0,point:[40,300],text:'Look again',size:14,color:'#2b5fb3'});
 notes.add({type:'shape',page:1,shape:'ellipse',points:[[10,10],[80,60]],width:2});
 notes.add({type:'pen',page:0,points:[[1,1],[5,5]],width:8,opacity:.35});
 const saved=notes.serialise().annotations;
 assert.deepEqual(saved.map(a=>a.type),['strike','text','shape','pen']);
 assert.equal(saved[1].size,14);assert.equal(saved[2].shape,'ellipse');assert.equal(saved[3].opacity,.35);
 for(const bad of [{type:'shape',page:0,shape:'star',points:[[0,0],[1,1]]},{type:'shape',page:0,shape:'rect',points:[[0,0]]},
  {type:'text',page:0,text:'no point'},{type:'strike',page:0,rects:[]},{type:'pen',page:0,points:[[0,0],[1,1]],width:500},
  {type:'pen',page:0,points:[[0,0],[1,1]],opacity:0},{type:'text',page:0,point:[0,0],text:'x',size:400}])
  assert.throws(()=>notes.add(bad),undefined,JSON.stringify(bad));
 assert.equal(notes.annotations.length,4,'a rejected mark changes nothing');
});
test('redo puts back what undo took away, can itself be undone, and a new mark clears it',()=>{
 const notes=Model.createAnnotations();
 assert.equal(notes.canUndo,false);assert.equal(notes.canRedo,false);
 const first=notes.add({type:'note',page:0,point:[5,5],text:'one'});notes.add({type:'note',page:0,point:[6,6],text:'two'});
 assert.equal(notes.undo(),true);assert.deepEqual(notes.annotations.map(a=>a.text),['one']);assert.equal(notes.canRedo,true);
 assert.equal(notes.redo(),true);assert.deepEqual(notes.annotations.map(a=>a.text),['one','two']);assert.equal(notes.canRedo,false);
 assert.equal(notes.undo(),true,'the redo is undoable');assert.deepEqual(notes.annotations.map(a=>a.text),['one']);
 notes.erase(first.id);assert.equal(notes.canRedo,false,'a new change clears redo');assert.equal(notes.redo(),false);
 assert.equal(notes.undo(),true);assert.deepEqual(notes.annotations.map(a=>a.text),['one']);
});
test('a saved copy carries strike-through, text boxes, shapes and a see-through highlighter pen',async()=>{
 const E=exporter(),lib=await pdfjs(),data=tinyPdf();
 const annotations=[
  {id:'strike',type:'strike',page:0,color:'#b3361f',rects:[[40,330,140,346]]},
  {id:'text',type:'text',page:0,color:'#2b5fb3',point:[50,250],text:'Check this',size:16},
  {id:'box',type:'shape',page:0,color:'#b5552e',shape:'rect',points:[[30,30],[90,80]],width:2},
  {id:'arrow',type:'shape',page:0,color:'#b5552e',shape:'arrow',points:[[100,100],[160,120]],width:1.5},
  {id:'marker',type:'pen',page:0,color:'#F6DE7A',points:[[20,200],[60,205],[100,200]],width:10,opacity:.4}
 ];
 const result=await E.withMarks({lib,data,annotations,name:'Lab.pdf'});
 const after=await open(lib,result.bytes);
 try{
  const found=await (await after.getPage(1)).getAnnotations(),inks=found.filter(a=>a.subtype==='Ink');
  const strike=inks.find(a=>a.inkLists.length===1&&Math.abs(a.inkLists[0][1]-338)<.5);assert.ok(strike,'a strike runs through the middle of the words');
  near(strike.inkLists[0],[40,338,140,338]);
  const text=found.find(a=>a.subtype==='FreeText');assert.ok(text);assert.equal(text.contentsObj.str,'Check this');assert.equal(text.defaultAppearanceData.fontSize,16);
  const box=inks.find(a=>a.inkLists[0]?.length===10);assert.ok(box,'a box is one closed stroke');near(box.inkLists[0],[30,30,90,30,90,80,30,80,30,30]);assert.equal(box.borderStyle.width,2);
  const arrow=inks.find(a=>a.inkLists.length===3);assert.ok(arrow,'an arrow is its line and two head strokes');near(arrow.inkLists[0],[100,100,160,120]);
  const marker=inks.find(a=>a.borderStyle.width===10);assert.ok(marker);assert.equal(marker.opacity,.4);
  for(const mark of found.filter(a=>a.subtype!=='Link'))assert.ok(mark.hasAppearance,mark.subtype+' has an appearance');
 }finally{await after.loadingTask.destroy();}
});
test('the host opens Files-page rows, "PDF File" module names and https PDFs on other sites',()=>{
 const row=anchor({href:canvas+'/courses/7/files?preview=42',name:'Reading.pdf'});
 assert.equal(Host.matchPdfClick(click(row),canvas)?.fileId,'42','a Files-page row names its file in ?preview=');
 const folder=anchor({href:canvas+'/courses/7/files/folder/Week%201?preview=43',name:'Week 1.pdf'});
 assert.equal(Host.matchPdfClick(click(folder),canvas)?.fileId,'43');
 const named=anchor({href:canvas+'/courses/7/files/44',name:'PDF File Lab handout'});
 const hit=Host.matchPdfClick(click(named),canvas);assert.equal(hit?.fileId,'44');
 const link=options=>Object.assign(anchor(options),{matches:selector=>selector==='a[href]'});
 const remote=link({href:'https://www.example.org/papers/constitution.pdf#page=7',name:'The Constitution'});
 const away=Host.matchPdfClick(click(remote),canvas);
 assert.equal(away.remote,'https://www.example.org/papers/constitution.pdf');assert.equal(away.page,6,'#page=7 opens the seventh page');
 assert.equal(away.name,'The Constitution.pdf');assert.match(away.fileId,/^99\d+$/);assert.equal(away.fileId,Host.localId('remote:'+away.remote),'marks are kept per address');
 for(const href of ['http://www.example.org/a.pdf','https://user:pass@example.org/a.pdf','https://www.example.org/a.docx'])
  assert.equal(Host.matchPdfClick(click(link({href,name:'A'})),canvas)?.remote,undefined,href);
});
