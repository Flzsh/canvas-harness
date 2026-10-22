'use strict';
// Development-only formatting with an AST equivalence check. No runtime dependency.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),extension=path.join(root,'extension');
const bundled=process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];
if(!bundled)throw Error('This Node build does not expose its bundled JavaScript parser.');
const parserModule={exports:{}};
vm.runInNewContext(bundled,{module:parserModule,exports:parserModule.exports},{timeout:5000});
const acorn=parserModule.exports,options={ecmaVersion:'latest',sourceType:'script',allowHashBang:true};
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const parse=text=>acorn.parse(text,options);
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(!value||typeof value!=='object')return typeof value==='bigint'?String(value)+'n':value;
 if(value instanceof RegExp)return String(value);
 if(value.type==='BinaryExpression'&&value.operator==='+'){
  const left=canonical(value.left),right=canonical(value.right);
  if(left.type==='Literal'&&right.type==='Literal'&&typeof left.value==='string'&&typeof right.value==='string')return {type:'Literal',value:left.value+right.value};
 }
 const out={};for(const key of Object.keys(value).sort())if(!['start','end','loc','raw'].includes(key))out[key]=canonical(value[key]);
 return out;
}
const fingerprint=ast=>hash(JSON.stringify(canonical(ast)));
if(process.argv.includes('--verify')){
 const evidence=JSON.parse(fs.readFileSync(path.join(root,'dist/readable-source-evidence.json'),'utf8'));
 for(const entry of evidence.files){
  const bytes=fs.readFileSync(path.join(root,entry.path));
  if(hash(bytes)!==entry.afterSha256)throw Error('Formatted source hash changed: '+entry.path);
  if(entry.astSha256&&fingerprint(parse(bytes.toString('utf8')))!==entry.astSha256)throw Error('Drawing values or JavaScript AST changed: '+entry.path);
 }
 console.log('Verified '+evidence.files.length+' formatted sources and their drawing values.');process.exit(0);
}
function chunks(value){
 const parts=[];let rest=value;
 while(rest){
  let length=Math.min(rest.length,1700);
  if(length<rest.length){const tag=rest.lastIndexOf('>',length);if(tag>length/2)length=tag+1;}
  while(Buffer.byteLength(JSON.stringify(rest.slice(0,length)))>2300)length=Math.floor(length*.8);
  if(length<rest.length&&/[\uD800-\uDBFF]/.test(rest[length-1]))length--;
  parts.push(JSON.stringify(rest.slice(0,length)));rest=rest.slice(length);
 }
 // Escaped physical line breaks retain one literal and add no runtime joins.
 return '"'+parts.map(part=>part.slice(1,-1)).join('\\\n')+'"';
}
function formatJS(text){
 const before=parse(text),edits=[];
 function visit(value,parent,key){
  if(!value||typeof value!=='object')return;
  if(value.type==='BinaryExpression'&&value.operator==='+'){
   const folded=canonical(value);
   if(folded.type==='Literal'&&typeof folded.value==='string'&&Buffer.byteLength(JSON.stringify(folded.value))>2300){
    edits.push({start:value.start,end:value.end,value:chunks(folded.value)});return;
   }
  }
  if(value.type==='Literal'&&typeof value.value==='string'&&Buffer.byteLength(text.slice(value.start,value.end))>2300){
   if(parent?.type==='Property'&&key==='key'&&!parent.computed)throw Error('A long property name needs manual formatting.');
   edits.push({start:value.start,end:value.end,value:chunks(value.value)});return;
  }
  for(const [name,child]of Object.entries(value))if(Array.isArray(child))child.forEach(item=>visit(item,value,name));else if(child&&typeof child==='object')visit(child,value,name);
 }
 visit(before);let result=text;
 for(const edit of edits.sort((a,b)=>b.start-a.start))result=result.slice(0,edit.start)+edit.value+result.slice(edit.end);
 // Spread the remaining generated object declarations over their token boundaries.
 const tokenizer=acorn.tokenizer(result,options),breaks=[];let token;
 const lineStarts=[0];for(let i=0;i<result.length;i++)if(result[i]==='\n')lineStarts.push(i+1);
 const longRanges=lineStarts.map((start,i)=>({start,end:lineStarts[i+1]??result.length})).filter(range=>Buffer.byteLength(result.slice(range.start,range.end))>3500);
 while((token=tokenizer.getToken()).type.label!=='eof')if([',',';','{','}'].includes(token.type.label)&&longRanges.some(range=>token.start>=range.start&&token.end<=range.end))breaks.push(token.end);
 for(const at of breaks.reverse())result=result.slice(0,at)+'\n  '+result.slice(at);
 const beforeHash=fingerprint(before),afterHash=fingerprint(parse(result));
 if(beforeHash!==afterHash)throw Error('Formatting changed the normalized JavaScript AST.');
 return {text:result,astSha256:beforeHash,stringLiteralsSplit:edits.length};
}
function formatCSS(text){
 let quote='',comment=false,escape=false,result='';
 for(let i=0;i<text.length;i++){
  const c=text[i],next=text[i+1];result+=c;
  if(comment){if(c==='*'&&next==='/'){result+=next;i++;comment=false;}continue;}
  if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote='';continue;}
  if(c==='/'&&next==='*'){result+=next;i++;comment=true;continue;}
  if(c==='"'||c==="'"){quote=c;continue;}
  if(c==='}')result+='\n';
 }
 // Only outside-string whitespace after rule boundaries was added.
 if(result.replace(/}\n/g,'}')!==text)throw Error('Unexpected CSS formatting change.');
 return result;
}
const evidencePath=path.join(root,'dist/readable-source-evidence.json');
const records=[],previous=fs.existsSync(evidencePath)?JSON.parse(fs.readFileSync(evidencePath,'utf8')).files:[];
for(const file of fs.readdirSync(extension).filter(name=>/\.(?:js|css|html|svg)$/.test(name))){
 const filename=path.join(extension,file),bytes=fs.readFileSync(filename),bom=bytes.subarray(0,3).equals(Buffer.from([239,187,191]));
 const original=bytes.subarray(bom?3:0).toString('utf8'),newline=original.includes('\r\n')?'\r\n':'\n',text=original.replace(/\r\n/g,'\n');
 if(!text.split('\n').some(line=>Buffer.byteLength(line)>3500)&&!(process.argv.includes('--literal-layout')&&file.endsWith('.js')&&previous.some(entry=>entry.path==='extension/'+file)))continue;
 let result,details={};
 if(file.endsWith('.js')){details=formatJS(text);result=details.text;delete details.text;}
 else if(file.endsWith('.css'))result=formatCSS(text);
 else result=text.replace(/></g,'>\n<');
 const maximum=Math.max(...result.split('\n').map(line=>Buffer.byteLength(line)));
 if(maximum>3500)throw Error(file+' still has a '+maximum+' byte line.');
 const output=Buffer.concat([bom?Buffer.from([239,187,191]):Buffer.alloc(0),Buffer.from(result.replace(/\n/g,newline))]);
 fs.writeFileSync(filename,output);
 const prior=previous.find(entry=>entry.path==='extension/'+file);
 records.push({path:'extension/'+file,beforeSha256:prior?.afterSha256===hash(bytes)?prior.beforeSha256:hash(bytes),afterSha256:hash(output),maximumLineBytes:maximum,...details});
}
for(const entry of previous)if(!records.some(record=>record.path===entry.path))records.push(entry);
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
fs.writeFileSync(path.join(root,'dist/readable-source-evidence.json'),JSON.stringify({files:records},null,2)+'\n');
console.log('Reformatted '+records.length+' files; JavaScript AST and drawing string values preserved.');
