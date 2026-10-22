/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
(function(root){
 'use strict';
 const MAX_SAVED_BYTES=1024*1024,MAX_TEXT=10000,UNDO_LIMIT=64;
 const clone=value=>JSON.parse(JSON.stringify(value));
 const finite=value=>typeof value==='number'&&Number.isFinite(value);
 function coordinates(value,length,label){
  if(!Array.isArray(value)||value.length!==length||!value.every(finite))throw Error(label+' must contain '+length+' finite PDF coordinates.');
  return [...value];
 }
 function clampWidth(width,viewportWidth){
  if(!finite(viewportWidth)||viewportWidth<=0)throw Error('A finite positive viewport width is required.');
  const desired=finite(width)&&width>0?width:viewportWidth*.52;
  // At small viewport widths, the 75vw cap intentionally wins over 380px.
  return Math.min(Math.round(Math.max(desired,380)),Math.floor(viewportWidth*.75));
 }
 function renderWindow(visiblePages,totalPages,residentPages=[]){
  if(!Number.isSafeInteger(totalPages)||totalPages<0)throw Error('Invalid total page count.');
  const valid=pages=>[...new Set((Array.isArray(pages)?pages:[]).filter(page=>Number.isSafeInteger(page)&&page>=0&&page<totalPages))].sort((a,b)=>a-b);
  const visible=valid(visiblePages),render=new Set();
  for(const page of visible)for(let step=-1;step<=1;step++){const index=page+step;if(index>=0&&index<totalPages)render.add(index);}
  const free=valid(residentPages).filter(page=>visible.every(index=>Math.abs(index-page)>3));
  return {render:[...render].sort((a,b)=>a-b),free};
 }
 function legacyStorageKey(origin,fileId){
  let url;try{url=new URL(origin);}catch{throw Error('Expected a valid Canvas origin.');}
  if(url.protocol!=='https:'||url.username||url.password||!/^\d+$/.test(String(fileId)))throw Error('Expected a secure Canvas origin and numeric file ID.');
  return 'reserve:pdf:'+url.origin+':'+String(fileId);
 }
 function storageKey(origin,accountId,fileId){
  if(!/^\d+$/.test(String(accountId)))throw Error('A verified numeric Canvas account ID is required.');
  return legacyStorageKey(origin,fileId).replace(/:(\d+)$/,':'+String(accountId)+':$1');
 }
 function mergeAnnotations(saved,before,after){
  const current=new Map(createAnnotations(saved).annotations.map(a=>[a.id,a])),erased=new Map();
  for(const [previousValue,nextValue]of after===undefined?before:[[before,after]]){
  const previous=new Map(createAnnotations(previousValue).annotations.map(a=>[a.id,a])),next=createAnnotations(nextValue).annotations,nextIds=new Set(next.map(a=>a.id));
  // Keep the merged version so a queued erase/undo cannot restore stale fields.
  for(const id of previous.keys())if(!nextIds.has(id)){if(current.has(id))erased.set(id,current.get(id));current.delete(id);}
  for(const record of next){const old=previous.get(record.id);if(!old){if(!current.has(record.id))current.set(record.id,erased.get(record.id)||record);continue;}const present=current.get(record.id);if(!present)continue;const patch=Object.fromEntries(Object.keys(record).filter(k=>JSON.stringify(record[k])!==JSON.stringify(old[k])).map(k=>[k,record[k]]));current.set(record.id,{...present,...patch});}
  }
  return createAnnotations({version:1,annotations:[...current.values()]}).serialise();
 }
 function theme(value){return value&&typeof value==='object'&&value.theme==='dark'?'dark':'light';}
 function transformed(viewport,point,converter){
  coordinates(point,2,'Point');
  if(typeof viewport?.[converter]!=='function')throw Error('PDF.js viewport conversion is unavailable.');
  return coordinates(viewport[converter](...point),2,'Transformed point');
 }
 function viewportToPdf(viewport,point){return transformed(viewport,point,'convertToPdfPoint');}
 function pdfToViewport(viewport,point){return transformed(viewport,point,'convertToViewportPoint');}
 function rectToPdf(viewport,rect){
  const [x1,y1,x2,y2]=coordinates(rect,4,'Rectangle');
  const a=viewportToPdf(viewport,[x1,y1]),b=viewportToPdf(viewport,[x2,y2]);
  return [Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])];
 }
 const TYPES=['highlight','underline','strike','note','pen','text','shape'],SHAPES=['rect','ellipse','arrow','line'];
 function normalize(value,retainId=false){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid PDF annotation.');
  const {type,page}=value;
  if(!TYPES.includes(type))throw Error('Invalid annotation type.');
  if(!Number.isSafeInteger(page)||page<0)throw Error('Invalid annotation page.');
  if(value.text!=null&&(typeof value.text!=='string'||value.text.length>MAX_TEXT))throw Error('Annotation text exceeds the 10,000-character limit.');
  const color=value.color??'#f6de7a';
  if(typeof color!=='string'||color.length>32||!/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$|^[a-z]{3,16}$/i.test(color))throw Error('Invalid annotation color.');
  const rects=value.rects??[],points=value.points??[],point=value.point??null;
  if(!Array.isArray(rects)||rects.length>10000||!Array.isArray(points)||points.length>20000)throw Error('Too many PDF coordinates.');
  if((type==='note'||type==='text')&&point==null)throw Error('A note needs a PDF point.');
  if((type==='highlight'||type==='underline'||type==='strike')&&!rects.length)throw Error('A text mark needs a PDF rectangle.');
  if(type==='pen'&&points.length<2)throw Error('A pen stroke needs at least two PDF points.');
  if(type==='shape'&&(points.length!==2||!SHAPES.includes(value.shape)))throw Error('A shape needs a kind and two PDF points.');
  const result={
   id:retainId?value.id:(root.crypto?.randomUUID?.()||'pdf-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)),
   type,page,color,rects:rects.map(rect=>coordinates(rect,4,'Rectangle')),
   text:value.text??'',point:point==null?null:coordinates(point,2,'Point'),points:points.map(p=>coordinates(p,2,'Point'))
  };
  // optional drawing details: stroke width (PDF units), opacity (a marker pen), font size (a text box), shape kind
  if(value.width!=null){if(!finite(value.width)||value.width<.2||value.width>60)throw Error('Invalid stroke width.');result.width=value.width;}
  if(value.opacity!=null){if(!finite(value.opacity)||value.opacity<.05||value.opacity>1)throw Error('Invalid opacity.');result.opacity=value.opacity;}
  if(value.size!=null){if(!finite(value.size)||value.size<4||value.size>96)throw Error('Invalid font size.');result.size=value.size;}
  if(type==='shape')result.shape=value.shape;
  if(typeof result.id!=='string'||result.id.length<1||result.id.length>100)throw Error('Invalid annotation ID.');
  return result;
 }
 function checkSize(annotations){
  const value={version:1,annotations};
  if(new TextEncoder().encode(JSON.stringify(value)).length>MAX_SAVED_BYTES)throw Object.assign(Error('PDF annotations exceed the 1 MiB storage quota. Erase some notes or pen strokes before saving.'),{code:'pdf-quota'});
  return value;
 }
 function createAnnotations(saved){
  if(saved!=null&&(!saved||saved.version!==1||!Array.isArray(saved.annotations)))throw Error('Unsupported PDF annotation version.');
  const annotations=(saved?.annotations||[]).map(record=>normalize(record,true)),undoStack=[],redoStack=[];
  if(new Set(annotations.map(item=>item.id)).size!==annotations.length)throw Error('Duplicate PDF annotation IDs.');
  checkSize(annotations);
  const remember=(action,keepRedo=false)=>{undoStack.push(action);if(undoStack.length>UNDO_LIMIT)undoStack.shift();if(!keepRedo)redoStack.length=0;};
  const find=id=>annotations.findIndex(record=>record.id===id);
  function add(value){
   const record=normalize(value);
   while(find(record.id)!==-1)record.id=normalize(value).id;
   annotations.push(record);
   try{checkSize(annotations);}catch(error){annotations.pop();throw error;}
   remember({kind:'add',id:record.id});return clone(record);
  }
  function erase(id){
   const index=find(id);if(index<0)return false;
   const [record]=annotations.splice(index,1);remember({kind:'erase',record,index});return true;
  }
  // A whole eraser drag is one change: one undo puts every mark it took back where it was.
  function eraseMany(ids){
   const taken=[];
   for(const id of new Set(ids)){const index=find(id);if(index<0)continue;taken.push({record:annotations[index],index});annotations.splice(index,1);}
   if(!taken.length)return 0;
   remember({kind:'eraseMany',taken});return taken.length;
  }
  function update(id,patch){
   const index=find(id);if(index<0)return false;
   if(!patch||typeof patch!=='object'||Array.isArray(patch)||'id'in patch||'page'in patch||'type'in patch)throw Error('Only annotation details can be updated.');
   const previous=annotations[index],next=normalize({...previous,...patch},true);
   annotations[index]=next;
   try{checkSize(annotations);}catch(error){annotations[index]=previous;throw error;}
   remember({kind:'update',record:previous,keys:Object.keys(patch)});return true;
  }
  function undo(){
   const action=undoStack.at(-1);if(!action)return false;const previous=annotations.slice();
   try{
   if(action.kind==='snapshot')annotations.splice(0,annotations.length,...clone(action.annotations));else
   if(action.kind==='add'){const i=find(action.id);if(i!==-1)annotations.splice(i,1);}
   else if(action.kind==='erase'){if(find(action.record.id)<0)annotations.splice(action.index,0,action.record);}
   else if(action.kind==='update'){const i=find(action.record.id);if(i>=0)annotations[i]=normalize({...annotations[i],...Object.fromEntries(action.keys.map(k=>[k,action.record[k]]))},true);}
   else if(action.kind==='eraseMany')for(const {record,index}of [...action.taken].reverse())if(find(record.id)<0)annotations.splice(index,0,record);
   checkSize(annotations);
   }catch(error){annotations.splice(0,annotations.length,...previous);throw error;}
   undoStack.pop();redoStack.push(clone(previous));if(redoStack.length>UNDO_LIMIT)redoStack.shift();return true;
  }
  // Redo puts back what the last undo took away; the redo itself can be undone again.
  function redo(){
   const target=redoStack.pop();if(!target)return false;
   const previous=clone(annotations);annotations.splice(0,annotations.length,...target);
   try{checkSize(annotations);}catch(error){annotations.splice(0,annotations.length,...previous);redoStack.push(target);throw error;}
   remember({kind:'snapshot',annotations:previous},true);return true;
  }
  return {add,erase,eraseMany,update,undo,redo,get canUndo(){return undoStack.length>0;},get canRedo(){return redoStack.length>0;},replace:saved=>{const next=createAnnotations(saved).annotations;annotations.splice(0,annotations.length,...next);},serialise:()=>clone(checkSize(annotations)),get annotations(){return clone(annotations);}};
 }
 const api=Object.freeze({clampWidth,renderWindow,storageKey,legacyStorageKey,mergeAnnotations,createAnnotations,viewportToPdf,pdfToViewport,rectToPdf,theme});
 root.ReservePdfModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
