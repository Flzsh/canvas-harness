// PDF mark-up tools adapted from HarryX081125's work, issue #53.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{pathToFileURL}=require('node:url');
const Model=require('../extension/pdf-model.js'),Export=require('../extension/pdf-export.js');
let library;
async function pdfjs(){
 if(!library)library=import(pathToFileURL(path.resolve(__dirname,'../extension/vendor/pdfjs/pdf.mjs')).href).then(lib=>{
  lib.GlobalWorkerOptions.workerSrc=pathToFileURL(path.resolve(__dirname,'../extension/vendor/pdfjs/pdf.worker.mjs')).href;return lib;
 });
 return library;
}
function tinyPdf(){
 const content='BT /F1 12 Tf 40 350 Td (Original text) Tj ET',objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R /Annots [6 0 R] >>',
  `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Type /Annot /Subtype /Link /Rect [10 10 20 20] /Border [0 0 0] /A << /S /URI /URI (https://example.invalid/original) >> >>'
 ];
 let text='%PDF-1.7\n';const offsets=[0];
 for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(text));text+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
 const xref=Buffer.byteLength(text);text+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
 for(const offset of offsets.slice(1))text+=`${String(offset).padStart(10,'0')} 00000 n \n`;
 text+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Uint8Array.from(Buffer.from(text));
}
function near(actual,expected,tolerance=.05){
 assert.equal(actual.length,expected.length);for(let i=0;i<expected.length;i++)assert.ok(Math.abs(actual[i]-expected[i])<=tolerance,`${actual[i]} is near ${expected[i]} at ${i}`);
}

test('strike, text, shapes and marker strokes retain drawing details through reload',()=>{
 const notes=Model.createAnnotations();
 notes.add({type:'strike',page:0,rects:[[10,10,90,20]],text:'Selected words'});
 notes.add({type:'text',page:0,point:[40,300],text:'Look again: \u03b1',size:14,color:'#2b5fb3'});
 notes.add({type:'shape',page:1,shape:'ellipse',points:[[10,10],[80,60]],width:2});
 notes.add({type:'pen',page:0,points:[[1,1],[5,5]],color:'#f6de7a',width:8,opacity:.35});
 const saved=notes.serialise();assert.deepEqual(saved.annotations.map(a=>a.type),['strike','text','shape','pen']);
 assert.equal(saved.annotations[1].size,14);assert.equal(saved.annotations[2].shape,'ellipse');assert.equal(saved.annotations[3].opacity,.35);
 assert.deepEqual(Model.createAnnotations(saved).serialise(),saved);
 const before=notes.serialise();
 for(const bad of [{type:'shape',page:0,shape:'star',points:[[0,0],[1,1]]},{type:'shape',page:0,shape:'rect',points:[[0,0]]},
  {type:'text',page:0,text:'no point'},{type:'strike',page:0,rects:[]},{type:'pen',page:0,points:[[0,0],[1,1]],width:500},
  {type:'pen',page:0,points:[[0,0],[1,1]],opacity:0},{type:'text',page:0,point:[0,0],text:'x',size:400},{type:'marker',page:0,points:[[0,0],[1,1]]}])assert.throws(()=>notes.add(bad));
 assert.deepEqual(notes.serialise(),before);
 saved.annotations[3].points[0][0]=999;assert.equal(notes.annotations[3].points[0][0],1,'saved copies cannot mutate the live marker');
});

test('all four shape kinds preserve endpoints, size and text placement across serialization',()=>{
 const notes=Model.createAnnotations();
 for(const shape of ['rect','ellipse','arrow','line'])notes.add({type:'shape',page:0,shape,color:'#123456',points:[[80,60],[10,10]],width:3});
 const text=notes.add({type:'text',page:1,point:[25,30],text:'First\nSecond',size:18,color:'#2457c5'});
 notes.update(text.id,{point:[40,50],size:24});const saved=notes.serialise(),restored=Model.createAnnotations(saved);
 assert.deepEqual(restored.serialise(),saved);assert.deepEqual(restored.annotations.map(a=>a.shape).slice(0,4),['rect','ellipse','arrow','line']);
 assert.deepEqual(restored.annotations[4].point,[40,50]);assert.equal(restored.annotations[4].size,24);
 notes.undo();assert.deepEqual(notes.annotations[4].point,[25,30]);assert.equal(notes.annotations[4].size,18);
 notes.redo();assert.deepEqual(notes.serialise(),saved);
});

test('redo restores the undone change, is undoable, and a successful new mutation clears it',()=>{
 const notes=Model.createAnnotations();assert.equal(notes.canUndo,false);assert.equal(notes.canRedo,false);
 const first=notes.add({type:'note',page:0,point:[5,5],text:'one'});notes.add({type:'note',page:0,point:[6,6],text:'two'});
 assert.equal(notes.undo(),true);assert.deepEqual(notes.annotations.map(a=>a.text),['one']);assert.equal(notes.canRedo,true);
 assert.equal(notes.redo(),true);assert.deepEqual(notes.annotations.map(a=>a.text),['one','two']);assert.equal(notes.canRedo,false);
 assert.equal(notes.undo(),true);assert.deepEqual(notes.annotations.map(a=>a.text),['one']);
 notes.erase(first.id);assert.equal(notes.canRedo,false);assert.equal(notes.redo(),false);
 assert.equal(notes.undo(),true);assert.deepEqual(notes.annotations.map(a=>a.text),['one']);
});

test('a saved copy carries strikes, colored text, shapes and a translucent highlighter stroke',async()=>{
 const lib=await pdfjs(),data=tinyPdf(),original=data.slice(),annotations=[
  {id:'strike',type:'strike',page:0,color:'#b3361f',rects:[[40,330,140,346]]},
  {id:'text',type:'text',page:0,color:'#2b5fb3',point:[50,250],text:'Check this',size:16},
  {id:'box',type:'shape',page:0,color:'#b5552e',shape:'rect',points:[[30,30],[90,80]],width:2},
  {id:'arrow',type:'shape',page:0,color:'#b5552e',shape:'arrow',points:[[100,100],[160,120]],width:1.5},
  {id:'marker',type:'pen',page:0,color:'#f6de7a',points:[[20,200],[60,205],[100,200]],width:10,opacity:.4}
 ],snapshot=structuredClone(annotations);
 const result=await Export.withMarks({lib,data,annotations,name:'Annotated.pdf'});
 assert.deepEqual(data,original);assert.deepEqual(annotations,snapshot);assert.deepEqual(result.bytes.slice(0,data.length),data);
 const loading=lib.getDocument({data:Uint8Array.from(result.bytes),verbosity:0,isEvalSupported:false,enableXfa:false,useWasm:false,useWorkerFetch:false,disableAutoFetch:true,disableStream:true});
 try{
  const pdf=await loading.promise,page=await pdf.getPage(1),found=await page.getAnnotations(),inks=found.filter(a=>a.subtype==='Ink');
  assert.equal(found.length,6);assert.equal(found.find(a=>a.subtype==='Link').url,'https://example.invalid/original');
  const strike=inks.find(a=>a.inkLists.length===1&&Math.abs(a.inkLists[0][1]-338)<.5);assert.ok(strike);near(strike.inkLists[0],[40,338,140,338]);
  const text=found.find(a=>a.subtype==='FreeText');assert.ok(text);assert.equal(text.contentsObj.str,'Check this');assert.equal(text.defaultAppearanceData.fontSize,16);near(text.defaultAppearanceData.fontColor,[43,95,179],1);
  const box=inks.find(a=>a.inkLists[0]?.length===10);assert.ok(box);near(box.inkLists[0],[30,30,90,30,90,80,30,80,30,30]);assert.equal(box.borderStyle.width,2);
  const arrow=inks.find(a=>a.inkLists.length===3);assert.ok(arrow);near(arrow.inkLists[0],[100,100,160,120]);
  const marker=inks.find(a=>a.borderStyle.width===10);assert.ok(marker);assert.equal(marker.opacity,.4);near(marker.inkLists[0],[20,200,60,205,100,200]);
  for(const mark of found.filter(a=>a.subtype!=='Link'))assert.ok(mark.hasAppearance,mark.subtype+' has an appearance');
  assert.ok((await page.getOperatorList()).fnArray.length>0);
 }finally{await loading.destroy();}
});
