'use strict';
// The stylesheets the companion loads, read as rules in cascade order (a11y-42, 2026-11-22). Used by a11y-42.test.cjs to
// find focus rings that a rule takes away for keyboard users (`outline:none` on :focus-visible) and never gives back.
const fs=require('node:fs'),path=require('node:path');
const EXT=path.join(__dirname,'..','extension');
// content.js's own list, in its order (the shadow root's sheets)
function sheetOrder(){const src=fs.readFileSync(path.join(EXT,'content.js'),'utf8');const m=/allSheets=startup\?\.styleFiles\|\|\[([^\]]+)\]/.exec(src);return m?[...m[1].matchAll(/'([^']+\.css)'/g)].map(x=>x[1]):[];}
function rules(file){
 const text=fs.readFileSync(path.join(EXT,file),'utf8').replace(/\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,' '));
 const out=[],stack=[];let i=0,start=0,depth=0;
 const lineAt=k=>text.slice(0,k).split('\n').length;
 for(;i<text.length;i++){
  const c=text[i];
  if(c==='"'||c==="'"){const q=c;for(i++;i<text.length&&text[i]!==q;i++)if(text[i]==='\\')i++;continue;}
  if(c==='{'){
   const head=text.slice(start,i).trim();
   if(head.startsWith('@')){stack.push({at:head,depth});depth++;start=i+1;continue;}
   // a rule: read to its closing brace (declarations hold no braces)
   let j=i+1,q='';for(;j<text.length;j++){const d=text[j];if(q){if(d===q)q='';continue;}if(d==='"'||d==="'")q=d;else if(d==='}')break;}
   out.push({file,line:lineAt(start+text.slice(start,i).search(/\S/)),selector:head,body:text.slice(i+1,j),media:stack.map(s=>s.at).join(' & ')});
   i=j;start=j+1;continue;
  }
  if(c==='}'){depth--;const top=stack[stack.length-1];if(top&&top.depth===depth)stack.pop();start=i+1;continue;}
  if(c===';'&&depth===stack.length&&text.slice(start,i).trim().startsWith('@')){start=i+1;}
 }
 return out;
}
function splitTop(s,sep=','){const out=[];let d=0,q='',st=0;for(let i=0;i<s.length;i++){const c=s[i];if(q){if(c===q)q='';continue;}if(c==='"'||c==="'")q=c;else if(c==='('||c==='[')d++;else if(c===')'||c===']')d--;else if(d===0&&c===sep){out.push(s.slice(st,i));st=i+1;}}out.push(s.slice(st));return out.map(x=>x.trim()).filter(Boolean);}
// the classes the rule's subject (its last compound) needs, :is() lists read as alternatives
function subjectClasses(sel){
 let d=0,q='',last=0;for(let i=0;i<sel.length;i++){const c=sel[i];if(q){if(c===q)q='';continue;}if(c==='"'||c==="'")q=c;else if(c==='('||c==='[')d++;else if(c===')'||c===']')d--;else if(d===0&&/[\s>+~]/.test(c))last=i+1;}
 const subject=sel.slice(last);
 const own=[...subject.replace(/:(?:is|where|not|has)\([^)]*\)/g,'').matchAll(/\.([\w-]+)/g)].map(m=>m[1]);
 const alts=[...subject.matchAll(/:is\(([^)]*)\)/g)].flatMap(m=>splitTop(m[1]).map(a=>[...a.matchAll(/\.([\w-]+)/g)].map(x=>x[1])[0]).filter(Boolean));
 return {subject,own,alts};
}
const decl=(body,prop)=>{const m=new RegExp('(?:^|;)\\s*'+prop+'\\s*:\\s*([^;]+)','i').exec(body);return m?m[1].trim():null;};
const outlineOff=body=>{const o=decl(body,'outline'),s=decl(body,'outline-style'),w=decl(body,'outline-width');return o!==null&&/^(none|0|0px)(\s*!important)?$/i.test(o)||s!==null&&/^none/i.test(s)||w!==null&&/^0(px)?(\s*!important)?$/.test(w);};
const outlineOn=body=>{const o=decl(body,'outline');return o!==null&&!/^(none|0|0px)(\s*!important)?$/i.test(o)&&/(solid|dashed|dotted|double|auto)/i.test(o);};
module.exports={sheetOrder,rules,splitTop,subjectClasses,decl,outlineOff,outlineOn,EXT};
