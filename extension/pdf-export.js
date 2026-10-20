/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
(function(root){
 'use strict';
 const finite=value=>typeof value==='number'&&Number.isFinite(value);
 const coordinates=(value,length)=>Array.isArray(value)&&value.length===length&&Array.from(value).every(finite);
 function filename(name){
  const stem=typeof name==='string'?name.trim().replace(/\.pdf$/i,'').trim():'';
  return (stem||'Document')+' (with my marks).pdf';
 }
 function color(value){
  if(typeof value!=='string'||!/^#[\da-f]{6}$/i.test(value))return null;
  return [1,3,5].map(start=>parseInt(value.slice(start,start+2),16));
 }
 function valid(record){
  if(!record||typeof record!=='object'||Array.isArray(record)||!Number.isSafeInteger(record.page)||record.page<0)return false;
  if(record.type==='note')return coordinates(record.point,2)&&typeof record.text==='string'&&record.text.trim().length>0&&record.text.length<=10000;
  if(!color(record.color))return false;
  if(record.type==='pen')return Array.isArray(record.points)&&record.points.length>=2&&record.points.length<=20000&&Array.from(record.points).every(p=>coordinates(p,2));
  return (record.type==='highlight'||record.type==='underline')&&Array.isArray(record.rects)&&record.rects.length>0&&record.rects.length<=10000&&Array.from(record.rects).every(r=>coordinates(r,4)&&r[0]<r[2]&&r[1]<r[3]);
 }
 function bounds(points,padding=0){
  const rect=[Infinity,Infinity,-Infinity,-Infinity];
  for(const [x,y]of points){rect[0]=Math.min(rect[0],x);rect[1]=Math.min(rect[1],y);rect[2]=Math.max(rect[2],x);rect[3]=Math.max(rect[3],y);}
  return [rect[0]-padding,rect[1]-padding,rect[2]+padding,rect[3]+padding];
 }
 function ink(base,strokes,thickness){
  // InkEditor.serialize in PDF.js 6.4.299 uses BOTH paths.points (InkList)
  // and paths.lines (appearance). Each line starts with four NaN sentinels,
  // then its start point; another such sextuple means a straight segment.
  return {...base,opacity:1,thickness,rect:bounds(strokes.flat(),thickness/2),paths:{
   points:strokes.map(points=>points.flat()),
   lines:strokes.map(points=>points.flatMap(([x,y])=>[NaN,NaN,NaN,NaN,x,y]))
  }};
 }
 function highlightOutlines(rects){
  // The writer uses even-odd fill. Sweep the union into nonoverlapping
  // rectangles so duplicate/overlapping selection boxes cannot punch holes.
  const events=new Map(),active=new Set(),pieces=[];
  for(const rect of rects)for(const [y,add]of [[rect[1],true],[rect[3],false]]){
   if(!events.has(y))events.set(y,[]);
   events.get(y).push({rect,add});
  }
  const levels=[...events.keys()].sort((a,b)=>a-b);
  let previous=new Map();
  for(let i=0;i<levels.length-1;i++){
   const y=levels[i],top=levels[i+1];
   for(const {rect,add}of events.get(y))if(add)active.add(rect);else active.delete(rect);
   const intervals=[...active].map(r=>[r[0],r[2]]).sort((a,b)=>a[0]-b[0]),merged=[];
   for(const interval of intervals){
    const last=merged.at(-1);
    if(last&&interval[0]<=last[1])last[1]=Math.max(last[1],interval[1]);else merged.push(interval);
   }
   const current=new Map();
   for(const [left,right]of merged){
    const key=left+','+right,prior=previous.get(key);
    let piece=prior;
    if(prior&&prior[3]===y)prior[3]=top;
    else{piece=[left,y,right,top];pieces.push(piece);}
    current.set(key,piece);
   }
   previous=current;
  }
  return pieces.map(([x1,y1,x2,y2])=>[x1,y2,x2,y2,x2,y1,x1,y1]);
 }
 function note(base,page,mark){
  // Work in the page's displayed orientation, but return PDF user-space
  // geometry and the rotation used by FreeTextEditor itself.
  const viewport=page.getViewport({scale:1/(page.userUnit||1)});
  const original=mark.text,normalized=original.replace(/\r\n?/g,'\n').replace(/\t/g,'    ').replace(/\u00a0/g,' ').replace(/\u00ad/g,'-');
  // These are Helvetica's WinAnsi characters. Other glyphs cannot get an
  // appearance from this writer: keep their full text in a native PDF popup.
  const encodable=/^[\n\x20-\x7e\xa1-\xac\xae-\xff\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u017e\u0178]*$/.test(normalized);
  let value=encodable?normalized:'Note (open comment)';
  const longest=value.split('\n').reduce((max,line)=>Math.max(max,line.length),1);
  const width=Math.min(viewport.width,Math.max(120,Math.min(220,Math.ceil(longest*10*1.02))));
  const fontSize=Math.min(10,viewport.width/(20*1.02),viewport.height/1.75);
  const columns=Math.max(1,Math.floor(width/(fontSize*1.02))),lines=[];
  for(const line of value.split('\n')){
   if(!line.length)lines.push('');
   for(let i=0;i<line.length;i+=columns)lines.push(line.slice(i,i+columns));
  }
  value=lines.join('\n');
  if((lines.length*1.35+.4)*fontSize>viewport.height)value='Note (open comment)';
  const height=(value.split('\n').length*1.35+.4)*fontSize;
  const point=viewport.convertToViewportPoint(...mark.point);
  const x=Math.max(0,Math.min(point[0],viewport.width-width)),y=Math.max(0,Math.min(point[1],viewport.height-height));
  const rect=bounds([viewport.convertToPdfPoint(x,y),viewport.convertToPdfPoint(x+width,y+height)]);
  const result={...base,color:[40,40,40],fontSize,value,rect,rotation:viewport.rotation};
  // AnnotationEditor.addComment's exact shape; createNewAnnotation writes
  // UTF-16 /Contents and links the FreeText and Popup annotations.
  if(value!==original)result.popup={contents:original,deleted:false,rect:rect.slice()};
  return result;
 }
 async function serialize(lib,pdf,mark){
  // Storage keys identify NEW editors; id must be null, never the model's id
  // (an existing PDF reference). Page indices and all geometry stay in PDF
  // user space: rectToPdf normalizes to [left,bottom,right,top], Y upwards.
  const base={pageIndex:mark.page,rotation:0,id:null,structTreeParentId:null,popupRef:'',color:color(mark.color)};
  switch(mark.type){
   case 'highlight':return {...base,annotationType:lib.AnnotationEditorType.HIGHLIGHT,opacity:.6,
    rect:bounds(mark.rects.flatMap(([x1,y1,x2,y2])=>[[x1,y1],[x2,y2]])),
    // PDF.js expects Z order for each quad, plus polygon outlines for /AP.
    quadPoints:mark.rects.flatMap(([x1,y1,x2,y2])=>[x1,y2,x2,y2,x1,y1,x2,y1]),
    outlines:highlightOutlines(mark.rects)};
   case 'underline':{
    const page=await pdf.getPage(mark.page+1),viewport=page.getViewport({scale:1});
    const strokes=mark.rects.map(rect=>{
     const [x1,y1]=viewport.convertToViewportPoint(rect[0],rect[1]),[x2,y2]=viewport.convertToViewportPoint(rect[2],rect[3]),bottom=Math.max(y1,y2);
     return [viewport.convertToPdfPoint(Math.min(x1,x2),bottom),viewport.convertToPdfPoint(Math.max(x1,x2),bottom)];
    });
    return ink({...base,annotationType:lib.AnnotationEditorType.INK},strokes,.8);
   }
   case 'pen':return ink({...base,annotationType:lib.AnnotationEditorType.INK},[mark.points],1.5);
   // saveNewAnnotations has no Text creation case; use FreeText with /AP.
   case 'note':return note({...base,annotationType:lib.AnnotationEditorType.FREETEXT},await pdf.getPage(mark.page+1),mark);
  }
 }
 async function withMarks({lib,data,annotations,name}={}){
  if(!(data instanceof Uint8Array)&&!(data instanceof ArrayBuffer))throw new TypeError('Expected PDF bytes as an ArrayBuffer or Uint8Array.');
  const bytes=data instanceof Uint8Array?data:new Uint8Array(data),outputName=filename(name);
  const marks=Array.isArray(annotations)?annotations.filter(valid):[];
  if(!marks.length)return {bytes,name:outputName};
  if(typeof lib?.getDocument!=='function')throw new TypeError('The loaded PDF.js module is required to export marks.');
  // getDocument may transfer its data buffer to the worker: always give it a
  // fresh Uint8Array, including when the caller supplied a Node Buffer/view.
  const loading=lib.getDocument({data:Uint8Array.from(bytes),verbosity:lib.VerbosityLevel?.ERRORS??0,
   isEvalSupported:false,enableXfa:false,useWasm:false,useWorkerFetch:false,
   disableAutoFetch:true,disableStream:true,stopAtErrors:false});
  try{
   const pdf=await loading.promise;
   let count=0;
   for(const mark of marks){
    if(mark.page>=pdf.numPages)continue;
    const value=await serialize(lib,pdf,mark);
    if(!value||!value.rect.every(finite))continue;
    pdf.annotationStorage.setValue('pdfjs_internal_editor_'+count++,value);
   }
   return {bytes:count?await pdf.saveDocument():bytes,name:outputName};
  }finally{await loading.destroy();}
 }
 const api=Object.freeze({withMarks});
 root.ReservePdfExport=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
