// PDF mark-up tools adapted from HarryX081125's work, issue #53.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const exportPath=path.resolve(__dirname,'../extension/pdf-export.js');
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
function marks(){return [
 {id:'highlight',type:'highlight',page:0,color:'#f6de7a',rects:[[40,330,140,345],[40,310,110,325]],text:'Selected words'},
 {id:'underline',type:'underline',page:1,color:'#4080c0',rects:[[60,300,160,314],[60,280,120,294]],text:'Underlined words'},
 {id:'pen',type:'pen',page:0,color:'#b5552e',points:[[30,150],[45,160],[60,155]]},
 {id:'note',type:'note',page:1,point:[70,220],text:'Check the units.\nUse SI units.'}
 ];}

test('exports four real annotations with appearances, preserving original pages, text and links',async()=>{
 const E=exporter(),lib=await pdfjs(),data=tinyPdf(),original=data.slice(),annotations=marks(),snapshot=structuredClone(annotations);
 const result=await E.withMarks({lib,data,annotations,name:'Lab handout.PDF'});
 assert.ok(result.bytes instanceof Uint8Array);
 assert.equal(result.name,'Lab handout (with my marks).pdf');
 assert.deepEqual(data,original,'PDF.js must not detach or mutate the caller bytes');
 assert.deepEqual(annotations,snapshot,'export leaves stored marks intact');
 assert.ok(result.bytes.length>data.length);
 assert.deepEqual(result.bytes.slice(0,data.length),data,'the writer appends an incremental update');
 const before=await open(lib,data),after=await open(lib,result.bytes);
 try{
  assert.equal(after.numPages,2);
  for(let n=1;n<=2;n++){
   const a=await before.getPage(n),b=await after.getPage(n);
   assert.deepEqual(b.view,a.view);assert.equal(b.rotate,a.rotate);assert.equal(b.userUnit,a.userUnit);
   const text=page=>page.getTextContent().then(content=>content.items.map(item=>({str:item.str,transform:item.transform})));
   assert.deepEqual(await text(b),await text(a));
  }
  const first=await after.getPage(1),second=await after.getPage(2);
  const a=await first.getAnnotations(),b=await second.getAnnotations();
  assert.equal(a.length,3);assert.equal(b.length,2);
  assert.equal(a.find(item=>item.subtype==='Link').url,'https://example.invalid/original');
  const highlight=a.find(item=>item.subtype==='Highlight');assert.ok(highlight);
  near(highlight.rect,[40,310,140,345]);
  near(highlight.quadPoints,[40,345,140,345,40,330,140,330,40,325,110,325,40,310,110,310]);
  near(highlight.color,[246,222,122],1);assert.equal(highlight.opacity,.6);
  const pen=a.find(item=>item.subtype==='Ink');assert.ok(pen);
  assert.equal(pen.inkLists.length,1);near(pen.inkLists[0],[30,150,45,160,60,155]);
  near(pen.color,[181,85,46],1);assert.equal(pen.borderStyle.width,1.5);
  assert.ok(pen.rect[0]<30&&pen.rect[1]<150&&pen.rect[2]>60&&pen.rect[3]>160,'stroke bounds include its width');
  const underline=b.find(item=>item.subtype==='Ink');assert.ok(underline);
  assert.equal(underline.inkLists.length,2);
  near(underline.inkLists[0],[160,300,160,314]);near(underline.inkLists[1],[120,280,120,294]);
  near(underline.color,[64,128,192],1);assert.ok(underline.borderStyle.width<=1);
  const note=b.find(item=>item.subtype==='FreeText');assert.ok(note);
  assert.equal(note.contentsObj.str,'Check the units.\nUse SI units.');
  const viewport=second.getViewport({scale:1}),box=[...viewport.convertToViewportPoint(...note.rect.slice(0,2)),...viewport.convertToViewportPoint(...note.rect.slice(2))];
  near([Math.min(box[0],box[2]),Math.min(box[1],box[3])],viewport.convertToViewportPoint(70,220));
  near(note.defaultAppearanceData.fontColor,[40,40,40],1);assert.ok(note.defaultAppearanceData.fontSize<=10);
  for(const mark of [highlight,pen,underline,note])assert.ok(mark.hasAppearance,`${mark.subtype} has a portable appearance stream`);
  // Exercise the streams too: malformed Ink path serialization can still have valid metadata.
  for(const page of [first,second])assert.ok((await page.getOperatorList()).fnArray.length>0);
 }finally{await before.loadingTask.destroy();await after.loadingTask.destroy();}
});

test('no marks returns exactly the original Uint8Array or ArrayBuffer bytes without opening PDF.js',async()=>{
 const E=exporter(),data=tinyPdf();
 const fromView=await E.withMarks({data,annotations:[],name:'Original.pdf'});
 assert.strictEqual(fromView.bytes,data);
 const buffer=data.slice().buffer,result=await E.withMarks({data:buffer,annotations:[],name:'Original.pdf'});
 assert.ok(result.bytes instanceof Uint8Array);assert.strictEqual(result.bytes.buffer,buffer);assert.deepEqual(result.bytes,data);
});

test('out-of-range pages are skipped and valid marks remain on their zero-based page',async()=>{
 const E=exporter(),lib=await pdfjs(),data=tinyPdf();
 const annotations=[{...marks()[0],page:2},{...marks()[2],page:999},{...marks()[2],page:-1},marks()[3]];
 const result=await E.withMarks({lib,data,annotations,name:'pages.pdf'}),pdf=await open(lib,result.bytes);
 try{
  assert.deepEqual((await(await pdf.getPage(1)).getAnnotations()).map(item=>item.subtype),['Link']);
  assert.deepEqual((await(await pdf.getPage(2)).getAnnotations()).map(item=>item.subtype),['FreeText']);
 }finally{await pdf.loadingTask.destroy();}
 const skipped=await E.withMarks({lib,data,annotations:[{...marks()[0],page:200}],name:'pages.pdf'});
 assert.strictEqual(skipped.bytes,data,'no incremental rewrite when every page is out of range');
});

test('damaged records are skipped individually without dropping a following valid stroke',async()=>{
 const E=exporter(),lib=await pdfjs(),data=tinyPdf();
 const bad=[null,{},[],{...marks()[0],rects:[[0,0,NaN,10]]},{...marks()[0],rects:[[0,0,0,10]]},
  {...marks()[0],rects:'broken'},{...marks()[2],points:[[0,1],[Infinity,2]]},
  {...marks()[2],points:[[0,1]]},{...marks()[2],color:'url(remote)'},
  {...marks()[2],page:1.5},{...marks()[3],point:[1]},{...marks()[3],text:{}},
  {...marks()[3],text:''},{...marks()[0],type:'unknown'}];
 const result=await E.withMarks({lib,data,annotations:[...bad,marks()[2]],name:'damaged.pdf'}),pdf=await open(lib,result.bytes);
 try{
  const found=await(await pdf.getPage(1)).getAnnotations();
  assert.deepEqual(found.map(item=>item.subtype),['Link','Ink']);near(found[1].inkLists[0],[30,150,45,160,60,155]);
  assert.equal((await(await pdf.getPage(2)).getAnnotations()).length,0);
 }finally{await pdf.loadingTask.destroy();}
});

test('invalid-only marks keep the original bytes and need no PDF library',async()=>{
 const data=tinyPdf(),result=await exporter().withMarks({data,annotations:[null,{type:'pen',page:0,points:[]}],name:'notes'});
 assert.strictEqual(result.bytes,data);assert.equal(result.name,'notes (with my marks).pdf');
});

test('handles an offset byte view without reading or modifying its surrounding buffer',async()=>{
 const E=exporter(),lib=await pdfjs(),source=tinyPdf(),buffer=new Uint8Array(source.length+20).fill(91);
 buffer.set(source,10);const snapshot=buffer.slice(),data=buffer.subarray(10,-10);
 const result=await E.withMarks({lib,data,annotations:[marks()[2]],name:'offset.pdf'});
 assert.deepEqual(buffer,snapshot);
 assert.deepEqual(result.bytes.subarray(0,data.length),source);
 const pdf=await open(lib,result.bytes);try{assert.equal(pdf.numPages,2);}finally{await pdf.loadingTask.destroy();}
});

test('runs as a classic script and gives a useful default filename',async()=>{
 const context=vm.createContext({Uint8Array,ArrayBuffer});
 assert.ok(fs.existsSync(exportPath));vm.runInContext(fs.readFileSync(exportPath,'utf8'),context);
 assert.equal(typeof context.ReservePdfExport.withMarks,'function');
 const result=await context.ReservePdfExport.withMarks({data:tinyPdf(),annotations:[]});
 assert.equal(result.name,'Document (with my marks).pdf');
});

test('sparse damaged geometry is skipped instead of throwing during serialization',async()=>{
 const lib=await pdfjs(),data=tinyPdf(),sparsePoints=new Array(2);sparsePoints[0]=[10,20];
 const result=await exporter().withMarks({lib,data,annotations:[{...marks()[2],points:sparsePoints},marks()[0]],name:'sparse.pdf'});
 const pdf=await open(lib,result.bytes);
 try{assert.deepEqual((await(await pdf.getPage(1)).getAnnotations()).map(item=>item.subtype),['Link','Highlight']);}
 finally{await pdf.loadingTask.destroy();}
});

test('unsupported Unicode notes have a visible label and preserve the full native PDF comment',async()=>{
 const lib=await pdfjs(),text='Check: \u03b1 = 5; \u4e2d\u6587; caf\u00e9',data=tinyPdf();
 const result=await exporter().withMarks({lib,data,annotations:[{...marks()[3],text}],name:'Unicode.pdf'}),pdf=await open(lib,result.bytes);
 try{
  const found=await(await pdf.getPage(2)).getAnnotations(),note=found.find(item=>item.subtype==='FreeText');
  assert.equal(note.subtype,'FreeText');assert.equal(note.contentsObj.str,text);
  assert.equal(note.hasAppearance,true,'the mark is visible even without a Unicode-capable font');
  assert.equal(found.find(item=>item.subtype==='Popup').contentsObj.str,text);
  assert.ok(note.popupRef);
 }finally{await pdf.loadingTask.destroy();}
});

test('underlines follow the visual baseline at all four page rotations',async()=>{
 const lib=await pdfjs(),model=require('../extension/pdf-model.js');
 for(const rotation of [0,90,180,270]){
  const data=tinyPdf(rotation),original=await open(lib,data);
  try{
   const viewport=(await original.getPage(1)).getViewport({scale:1});
   const rect=model.rectToPdf(viewport,[50,60,150,74]);
   const result=await exporter().withMarks({lib,data,annotations:[{type:'underline',page:0,color:'#4080c0',rects:[rect]}],name:'rotated.pdf'});
   const pdf=await open(lib,result.bytes);
   try{
    const line=(await(await pdf.getPage(1)).getAnnotations()).find(item=>item.subtype==='Ink').inkLists[0];
    near(viewport.convertToViewportPoint(line[0],line[1]),[50,74]);
    near(viewport.convertToViewportPoint(line[2],line[3]),[150,74]);
   }finally{await pdf.loadingTask.destroy();}
  }finally{await original.loadingTask.destroy();}
 }
});

test('edge notes keep their complete multiline appearance inside the page',async()=>{
 const lib=await pdfjs(),data=tinyPdf(),text='First line\nSecond line\nThird line';
 const result=await exporter().withMarks({lib,data,annotations:[{type:'note',page:0,point:[299,1],text}],name:'edge.pdf'});
 const pdf=await open(lib,result.bytes);
 try{
  const note=(await(await pdf.getPage(1)).getAnnotations()).find(item=>item.subtype==='FreeText');
  assert.equal(note.hasAppearance,true);assert.equal(note.contentsObj.str,text);
  assert.ok(note.rect[0]>=0&&note.rect[2]<=300&&note.rect[1]>=0&&note.rect[3]<=400);
  assert.equal(note.defaultAppearanceData.fontSize,10,'the page has room for readable note text');
  assert.ok(note.rect[3]-10-2*13.5>=note.rect[1],'the final baseline is inside the clipping box');
 }finally{await pdf.loadingTask.destroy();}
});

test('WinAnsi notes with nonbreaking spaces and soft hyphens keep an appearance and exact contents',async()=>{
 const lib=await pdfjs(),data=tinyPdf(),text='caf\u00e9; Bond\u00a0length; soft\u00adhyphen; \u20ac\u2014';
 const result=await exporter().withMarks({lib,data,annotations:[{type:'note',page:0,point:[40,300],text}],name:'spacing.pdf'}),pdf=await open(lib,result.bytes);
 try{
  const note=(await(await pdf.getPage(1)).getAnnotations()).find(item=>item.subtype==='FreeText');
  assert.equal(note.contentsObj.str,text);assert.equal(note.hasAppearance,true);assert.ok(note.popupRef);
 }finally{await pdf.loadingTask.destroy();}
});

test('export accepts an ArrayBuffer and wraps long notes without losing their original text',async()=>{
 const lib=await pdfjs(),data=tinyPdf().buffer,before=new Uint8Array(data).slice(),text='A complete explanation with units and calculations. '.repeat(4);
 const result=await exporter().withMarks({lib,data,annotations:[{type:'note',page:0,point:[40,350],text}],name:'long.pdf'});
 assert.deepEqual(new Uint8Array(data),before);
 const pdf=await open(lib,result.bytes);
 try{
  const found=await(await pdf.getPage(1)).getAnnotations(),note=found.find(item=>item.subtype==='FreeText');
  assert.equal(note.contentsObj.str,text);assert.equal(note.hasAppearance,true);
  assert.equal(note.defaultAppearanceData.fontSize,10);
  assert.equal(found.find(item=>item.subtype==='Popup').contentsObj.str,text);
 }finally{await pdf.loadingTask.destroy();}
});

test('overlapping highlight rectangles still paint the overlap in the PDF appearance',async()=>{
 const lib=await pdfjs(),data=tinyPdf();
 const result=await exporter().withMarks({lib,data,annotations:[{...marks()[0],rects:[[40,300,100,320],[80,310,140,330]]}],name:'overlap.pdf'});
 const pdf=await open(lib,result.bytes);
 try{
  const ops=await(await pdf.getPage(1)).getOperatorList();
  // PDF.js packs these straight paths as moveTo=0, lineTo=1, closePath=4.
  // Evaluate the actual even-odd appearance fill at independent sample points.
  const covers=(x,y)=>ops.fnArray.some((op,index)=>{
   const [fill,paths]=ops.argsArray[index]||[];
   if(op!==lib.OPS.constructPath||fill!==lib.OPS.eoFill)return false;
   let crossings=0;
   const edge=(a,b)=>{if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])crossings++;};
   for(const path of paths){let start,last;for(let i=0;i<path.length;){
    const command=path[i++];
    if(command===4){edge(last,start);continue;}
    assert.ok(command===0||command===1,'rectangular highlight uses straight paths');
    const point=[path[i++],path[i++]];if(command===0)start=point;else edge(last,point);last=point;
   }}
   return crossings%2===1;
  });
  assert.equal(covers(60,305),true);assert.equal(covers(120,325),true);
  assert.equal(covers(90,315),true,'overlap must stay painted, rather than cancel under even-odd fill');
  assert.equal(covers(35,315),false);
 }finally{await pdf.loadingTask.destroy();}
});

test('invalid drawing dimensions and new mark geometry are skipped without opening a PDF',async()=>{
 const data=tinyPdf(),stroke={type:'pen',page:0,color:'#123456',points:[[10,20],[30,40]]},text={type:'text',page:0,color:'#123456',point:[40,300],text:'Text'},invalid=[];
 for(const width of [NaN,Infinity,-Infinity,0,-1,.199,60.001,'2',true,{},[]])invalid.push({...stroke,width});
 for(const opacity of [NaN,Infinity,0,.049,1.001,'0.4',false,{}])invalid.push({...stroke,opacity});
 for(const size of [NaN,Infinity,0,3.999,96.001,'12',true,{}])invalid.push({...text,size});
 const sparse=new Array(2);sparse[0]=[1,2];
 invalid.push({...text,point:[0,NaN]},{...text,text:' '},{...text,text:'x'.repeat(10001)},
  {type:'shape',page:0,color:'#123456',shape:'star',points:[[1,2],[3,4]]},
  {type:'shape',page:0,color:'#123456',shape:'rect',points:sparse},
  {type:'shape',page:0,color:'#123456',shape:'line',points:[[1,2],[3,4],[5,6]]},
  {type:'strike',page:0,color:'#123456',rects:[[1,2,1,4]]},{...stroke,type:'marker'});
 const result=await exporter().withMarks({data,annotations:invalid});assert.strictEqual(result.bytes,data);
});

test('wide and fractional strokes keep their actual border width even when their geometry is almost flat',async()=>{
 const lib=await pdfjs(),data=tinyPdf(),widths=[.2,.8,7,12,20,60],annotations=[];
 for(let i=0;i<widths.length;i++)for(const points of [[[80,50+i*40],[81,50+i*40]],[[180,50+i*40],[180,51+i*40]]])annotations.push({type:'pen',page:0,color:'#f6de7a',points,width:widths[i],opacity:.35});
 const result=await exporter().withMarks({lib,data,annotations}),pdf=await open(lib,result.bytes);
 try{
  const page=await pdf.getPage(1),inks=(await page.getAnnotations()).filter(a=>a.subtype==='Ink');assert.equal(inks.length,annotations.length);
  for(const mark of annotations){
   const ink=inks.find(a=>a.inkLists[0][0]===mark.points[0][0]&&a.inkLists[0][1]===mark.points[0][1]);assert.ok(ink);
   assert.equal(ink.borderStyle.width,mark.width);assert.equal(ink.opacity,.35);near(ink.inkLists[0],mark.points.flat());
   assert.ok(ink.rect[2]-ink.rect[0]>mark.width*2&&ink.rect[3]-ink.rect[1]>mark.width*2,'ink bounds retain the PDF border width after rounding');assert.ok(ink.hasAppearance);
  }
  assert.ok((await page.getOperatorList()).fnArray.length>0);
 }finally{await pdf.loadingTask.destroy();}
});

test('ellipse and line shapes preserve reversed PDF-space endpoints and have usable appearances',async()=>{
 const lib=await pdfjs(),data=tinyPdf(),annotations=[
  {type:'shape',page:1,color:'#123456',shape:'ellipse',points:[[140,150],[60,90]],width:3},
  {type:'shape',page:1,color:'#654321',shape:'line',points:[[190,170],[160,100]],width:2.5}
 ];
 const result=await exporter().withMarks({lib,data,annotations}),pdf=await open(lib,result.bytes);
 try{
  const page=await pdf.getPage(2),inks=(await page.getAnnotations()).filter(a=>a.subtype==='Ink');assert.equal(inks.length,2);
  const ellipse=inks.find(a=>a.inkLists[0].length===98),line=inks.find(a=>a.inkLists[0].length===4);assert.ok(ellipse);assert.ok(line);
  for(const [index,point]of [[0,[140,120]],[12,[100,150]],[24,[60,120]],[36,[100,90]],[48,[140,120]]])near(ellipse.inkLists[0].slice(index*2,index*2+2),point);
  near(line.inkLists[0],[190,170,160,100]);assert.equal(ellipse.borderStyle.width,3);assert.equal(line.borderStyle.width,2.5);
  for(const mark of inks)assert.ok(mark.hasAppearance);assert.ok((await page.getOperatorList()).fnArray.length>0);
 }finally{await pdf.loadingTask.destroy();}
});

test('strikes follow the visual text middle at every page rotation',async()=>{
 const lib=await pdfjs(),model=require('../extension/pdf-model.js');
 for(const rotation of [0,90,180,270]){
  const data=tinyPdf(rotation),original=await open(lib,data);
  try{
   const viewport=(await original.getPage(1)).getViewport({scale:1}),rect=model.rectToPdf(viewport,[50,60,150,74]);
   const result=await exporter().withMarks({lib,data,annotations:[{type:'strike',page:0,color:'#c8372d',rects:[rect]}]}),pdf=await open(lib,result.bytes);
   try{
    const strike=(await(await pdf.getPage(1)).getAnnotations()).find(a=>a.subtype==='Ink'),line=strike.inkLists[0];
    near(viewport.convertToViewportPoint(line[0],line[1]),[50,67]);near(viewport.convertToViewportPoint(line[2],line[3]),[150,67]);assert.ok(strike.hasAppearance);
   }finally{await pdf.loadingTask.destroy();}
  }finally{await original.loadingTask.destroy();}
 }
});

test('typed text keeps its color, requested font size and displayed anchor at every rotation',async()=>{
 const lib=await pdfjs();
 for(const rotation of [0,90,180,270]){
  const data=tinyPdf(rotation),original=await open(lib,data);
  try{
   const viewport=(await original.getPage(1)).getViewport({scale:1}),point=viewport.convertToPdfPoint(30,40);
   const result=await exporter().withMarks({lib,data,annotations:[{type:'text',page:0,point,color:'#2457c5',size:14,text:'Typed text'}]}),pdf=await open(lib,result.bytes);
   try{
    const text=(await(await pdf.getPage(1)).getAnnotations()).find(a=>a.subtype==='FreeText'),a=viewport.convertToViewportPoint(...text.rect.slice(0,2)),b=viewport.convertToViewportPoint(...text.rect.slice(2));
    near([Math.min(a[0],b[0]),Math.min(a[1],b[1])],[30,40]);assert.equal(text.contentsObj.str,'Typed text');assert.equal(text.defaultAppearanceData.fontSize,14);near(text.defaultAppearanceData.fontColor,[36,87,197],1);assert.ok(text.hasAppearance);
   }finally{await pdf.loadingTask.destroy();}
  }finally{await original.loadingTask.destroy();}
 }
});

test('typed Unicode and normalized spacing preserve their exact full native PDF comments',async()=>{
 const lib=await pdfjs(),data=tinyPdf(),texts=['Check: \u03b1 = 5; \u4e2d\u6587; caf\u00e9; \ud83d\udd0e','First\r\nSecond\tline','caf\u00e9; Bond\u00a0length; soft\u00adhyphen; \u20ac\u2014'];
 const annotations=texts.map((text,index)=>({type:'text',page:1,point:[70,220-index*50],text,color:'#2457c5',size:16})),result=await exporter().withMarks({lib,data,annotations}),pdf=await open(lib,result.bytes);
 try{
  const page=await pdf.getPage(2),found=await page.getAnnotations();
  for(const original of texts){
   const text=found.find(a=>a.subtype==='FreeText'&&a.contentsObj.str===original);assert.ok(text);assert.ok(text.hasAppearance);assert.ok(text.popupRef);near(text.defaultAppearanceData.fontColor,[36,87,197],1);
   assert.ok(found.some(a=>a.subtype==='Popup'&&a.contentsObj.str===original));
  }
  assert.ok((await page.getOperatorList()).fnArray.length>0);
 }finally{await pdf.loadingTask.destroy();}
});

test('long or edge text stays visible inside the page and retains every original character',async()=>{
 const lib=await pdfjs(),data=tinyPdf(),texts=['First line\nSecond line\nThird line','An explanation that exceeds the available page height. '.repeat(160)];
 const annotations=texts.map((text,index)=>({type:'text',page:0,point:[299,1],text,color:'#123456',size:index?96:18}));
 const result=await exporter().withMarks({lib,data,annotations}),pdf=await open(lib,result.bytes);
 try{
  const found=await(await pdf.getPage(1)).getAnnotations();
  for(const original of texts){
   const text=found.find(a=>a.subtype==='FreeText'&&a.contentsObj.str===original);assert.ok(text);assert.ok(text.hasAppearance);
   assert.ok(text.rect[0]>=0&&text.rect[2]<=300&&text.rect[1]>=0&&text.rect[3]<=400);assert.ok(text.defaultAppearanceData.fontSize>0&&text.defaultAppearanceData.fontSize<=96);
  }
  assert.ok(found.some(a=>a.subtype==='Popup'&&a.contentsObj.str===texts[1]));
 }finally{await pdf.loadingTask.destroy();}
});

test('font-size boundary values and missing drawing details retain supported defaults',async()=>{
 const lib=await pdfjs(),data=tinyPdf(),annotations=[
  ...[4,96].map(size=>({type:'text',page:0,point:[40,300],text:'X',size,color:'#123456'})),
  {type:'text',page:0,point:[40,200],text:'Default text',color:'#123456'},
  {type:'shape',page:0,shape:'line',points:[[40,50],[60,50]],color:'#123456'}
 ];
 const result=await exporter().withMarks({lib,data,annotations}),pdf=await open(lib,result.bytes);
 try{
  const found=await(await pdf.getPage(1)).getAnnotations(),text=found.filter(a=>a.subtype==='FreeText');
  assert.deepEqual(text.map(a=>a.defaultAppearanceData.fontSize).sort((a,b)=>a-b),[4,12,96]);
  const shape=found.find(a=>a.subtype==='Ink');assert.equal(shape.borderStyle.width,1.5);assert.equal(shape.opacity,1);
 }finally{await pdf.loadingTask.destroy();}
});
