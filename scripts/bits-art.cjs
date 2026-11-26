'use strict';
// The art slots of Home's small bits (extension/home-bits.js SLOTS): checks every drawing in art/bits/ and writes the
// generated block of extension/home-bits.js. A drawing is dropped in as art/bits/<slot>.svg; nothing else changes.
//   node scripts/bits-art.cjs           check art/bits/*.svg and write the block
//   node scripts/bits-art.cjs --check   check only; exit 1 if a drawing is wrong or the block is stale
// What a drawing must be (by its slot's `use`):
//   scene  <svg viewBox="0 0 W 240"> with 480 <= W <= 1680 (an optional data-cycle="0".."16" is carried, like a course scene)
//   icon   <svg viewBox="0 0 40 40">
//   frame  <svg viewBox="0 0 w h"> with the slot's w and h (the slice edges are the slot's, see SLOTS)
// THE GATE IS AN ALLOW-LIST (review-42b, finding 1: a block-list let handlers and outside fetches through). The file is read
// by a strict XML reader (well-formed, quoted attributes with whitespace between them, one <svg> root and nothing after it,
// no DOCTYPE, entities, CDATA or processing instructions), every element and attribute is checked against the lists below,
// every value against its own pattern, and the drawing that is kept is WRITTEN AGAIN from the parsed tree: the original text
// never reaches the page. Not allowed at all: script, style (element or attribute), foreignObject, image, feImage, img,
// iframe, links, animation elements, any on* attribute, href other than "#id", url() other than "url(#id)", a backslash.
// Editor leftovers (title, desc, metadata, inkscape:*, sodipodi:*, xml:space, aria-*) are dropped quietly.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),DIR=path.join(ROOT,'art','bits'),TARGET=path.join(ROOT,'extension','home-bits.js');
const START='// <bits:generated>',END='// </bits:generated>';
function slots(){delete require.cache[require.resolve(TARGET)];return require(TARGET).SLOTS;}
function fail(file,why){throw Error(`art/bits/${file}: ${why}`);}

// ---- what may be drawn ----
const ELEMENTS=new Set(['g','path','rect','circle','ellipse','line','polyline','polygon','defs','clipPath','mask','linearGradient',
 'radialGradient','stop','pattern','symbol','use','marker','text','tspan','filter','feGaussianBlur','feOffset','feBlend',
 'feColorMatrix','feComposite','feMerge','feMergeNode','feFlood','feMorphology','feTurbulence','feDisplacementMap',
 'feComponentTransfer','feFuncR','feFuncG','feFuncB','feFuncA','feDropShadow']);
const DROPPED=new Set(['title','desc','metadata']);// with everything inside them
const HREF_ELEMENTS=new Set(['use','linearGradient','radialGradient','pattern']);
const TEXT_ELEMENTS=new Set(['text','tspan']);
// value patterns (checked on the decoded value; none admits a quote, "<", ">", "(", ")", "\", ":" or "&" unless it says so)
const NUM=/^[-+0-9.eE%a-z\s,]*$/i;
const WORD=/^[\w\s.,#%+-]*$/;
const PATH=/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]*$/;
const BOX=/^[-+0-9.eE\s,]*$/;
const TRANSFORM=/^(?:\s*(?:matrix|translate|scale|rotate|skewX|skewY)\s*\(\s*[-+0-9.eE\s,]*\)\s*,?)*\s*$/;
const COLOR='(?:#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgba?\\(\\s*[\\d.%\\s,]+\\)|hsla?\\(\\s*[\\d.%\\s,deg]+\\)|var\\(--[\\w-]+\\))';
const REFERENCE='url\\(\\s*#[A-Za-z_][\\w.-]*\\s*\\)';
const PAINT=new RegExp(`^\\s*(?:${COLOR}|${REFERENCE}(?:\\s+${COLOR})?)\\s*$`);
const REF=new RegExp(`^\\s*(?:none|${REFERENCE})\\s*$`);
const ID=/^[A-Za-z_][\w.-]*$/,CLASS=/^[\w\s-]*$/,DATA=/^[\w\s.,#%+\-:;=|/]*$/,LOCAL=/^#[A-Za-z_][\w.-]*$/;
const ATTRIBUTES=Object.assign(Object.create(null),
 Object.fromEntries(['x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','fx','fy','fr','width','height','dx','dy','offset','pathLength',
  'stroke-width','stroke-miterlimit','stroke-dashoffset','stroke-dasharray','opacity','fill-opacity','stroke-opacity','stop-opacity',
  'flood-opacity','stdDeviation','k1','k2','k3','k4','scale','baseFrequency','numOctaves','seed','radius','order','points',
  'values','tableValues','slope','intercept','amplitude','exponent','refX','refY','markerWidth','markerHeight','font-size',
  'letter-spacing','word-spacing','rotate','textLength'].map(n=>[n,NUM])),
 Object.fromEntries(['fill-rule','clip-rule','stroke-linecap','stroke-linejoin','visibility','display','paint-order','vector-effect',
  'shape-rendering','text-anchor','dominant-baseline','font-weight','font-style','font-family','gradientUnits','patternUnits',
  'patternContentUnits','clipPathUnits','maskUnits','maskContentUnits','filterUnits','primitiveUnits','spreadMethod',
  'preserveAspectRatio','in','in2','result','mode','operator','type','edgeMode','stitchTiles','xChannelSelector',
  'yChannelSelector','orient','markerUnits','lengthAdjust','isolation','mix-blend-mode','overflow'].map(n=>[n,WORD])),
 {d:PATH,viewBox:BOX,transform:TRANSFORM,gradientTransform:TRANSFORM,patternTransform:TRANSFORM,
  fill:PAINT,stroke:PAINT,'stop-color':PAINT,'flood-color':PAINT,'lighting-color':PAINT,color:PAINT,
  'clip-path':REF,mask:REF,filter:REF,'marker-start':REF,'marker-mid':REF,'marker-end':REF,
  id:ID,class:CLASS,href:LOCAL});
// attributes left out quietly (editor metadata, and what the page gives the root itself)
const QUIET=name=>/^(?:xmlns(?::.*)?|version|xml:(?:space|lang)|(?:inkscape|sodipodi|sketch|serif):.*|aria-[\w-]+|focusable|role|data-name|enable-background)$/.test(name);
const ROOT_QUIET=new Set(['width','height','x','y','class','data-art','data-crop','data-place','data-cycle','viewBox','preserveAspectRatio']);

// ---- a strict XML reader ----
function read(text){
 let s=String(text).replace(/^﻿/,''),i=0;
 const err=why=>{throw Error(why+' (at character '+i+')');};
 const ws=()=>{while(i<s.length&&/[\s]/.test(s[i]))i++;};
 const skipMisc=()=>{for(;;){ws();if(s.startsWith('<!--',i)){const e=s.indexOf('-->',i+4);if(e<0)err('an unclosed comment');if(s.slice(i+4,e).includes('--'))err('"--" inside a comment');i=e+3;continue;}return;}};
 const decode=v=>v.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);|&/g,(m,e)=>{if(!e)err('a bare "&" (write &amp;)');if(e[0]==='#'){const n=e[1]==='x'?parseInt(e.slice(2),16):parseInt(e.slice(1),10);if(!(n>=32&&n<0xD800)&&![9,10,13].includes(n))err('a character reference to a control or out-of-range character');return String.fromCodePoint(n);}return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[e];});
 if(s.startsWith('<?xml',i)){const e=s.indexOf('?>',i);if(e<0)err('an unclosed XML declaration');i=e+2;}
 skipMisc();
 if(/^<!|^<\?/.test(s.slice(i,i+2)))err('no DOCTYPE, entities, CDATA or processing instructions');
 const NAME=/[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?/y;
 const name=()=>{NAME.lastIndex=i;const m=NAME.exec(s);if(!m)err('a name was expected');i=NAME.lastIndex;return m[0];};
 function element(){
  if(s[i]!=='<')err('"<" was expected');i++;
  const node={name:name(),attrs:[],children:[]},seen=new Set();
  for(;;){
   const before=i;ws();
   if(s.startsWith('/>',i)){i+=2;node.closed=true;return node;}
   if(s[i]==='>'){i++;break;}
   if(i===before)err(`attributes of <${node.name}> must be separated by whitespace`);
   const key=name();ws();if(s[i]!=='=')err(`"=" was expected after ${key}`);i++;ws();
   const q=s[i];if(q!=='"'&&q!=="'")err(`the value of ${key} must be quoted`);
   const e=s.indexOf(q,i+1);if(e<0)err(`the value of ${key} is not closed`);
   const raw=s.slice(i+1,e);if(raw.includes('<'))err(`"<" inside the value of ${key}`);
   i=e+1;if(seen.has(key))err(`${key} is given twice`);seen.add(key);
   node.attrs.push([key,decode(raw)]);
  }
  for(;;){
   const t=s.indexOf('<',i);if(t<0)err(`<${node.name}> is not closed`);
   if(t>i)node.children.push({text:decode(s.slice(i,t))});i=t;
   if(s.startsWith('<!--',i)){const e=s.indexOf('-->',i+4);if(e<0)err('an unclosed comment');if(s.slice(i+4,e).includes('--'))err('"--" inside a comment');i=e+3;continue;}
   if(s.startsWith('<!',i)||s.startsWith('<?',i))err('no CDATA, DOCTYPE or processing instructions inside the drawing');
   if(s.startsWith('</',i)){i+=2;const n=name();ws();if(s[i]!=='>')err('">" was expected');i++;if(n!==node.name)err(`</${n}> closes <${node.name}>`);return node;}
   node.children.push(element());
  }
 }
 const root=element();
 skipMisc();
 if(i<s.length)err('nothing may follow the closing </svg>');
 if(root.name!=='svg')err('the file is one <svg> element');
 return root;
}

// ---- the check: keep only what is allowed, refuse what is dangerous, then write it again ----
const esc=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function attribute(element,key,value,refuse){
 const name=key==='xlink:href'?'href':key;
 if(/^on/i.test(name))refuse(`no event attributes (${key} on <${element}>)`);
 if(name==='style')refuse(`no style attribute (<${element}>): use presentation attributes such as fill and stroke`);
 if(/\\/.test(value))refuse(`no backslash in ${key} on <${element}>`);
 if(QUIET(name))return null;
 if(name==='href'&&!HREF_ELEMENTS.has(element))refuse(`no href on <${element}>`);
 if(/^data-[a-z][\w-]*$/.test(name)){if(!DATA.test(value))refuse(`${key} on <${element}> holds characters a data attribute may not`);return [name,value];}
 const pattern=ATTRIBUTES[name];
 if(!pattern)refuse(`the attribute ${key} is not allowed (<${element}>)`);
 if(!pattern.test(value))refuse(name==='href'?`href only to an id in the same file (#id), not "${value}"`:/url\(/i.test(value)?`url() only to an id in the same file (url(#id)), not "${value}"`:`${key}="${value}" on <${element}> is not an allowed value`);
 return [name,value];
}
function clean(node,refuse,parent=''){
 if('text' in node){if(TEXT_ELEMENTS.has(parent))return esc(node.text);if(/\S/.test(node.text))refuse(`text outside <text> (inside <${parent}>)`);return node.text;}
 const n=node.name;
 if(DROPPED.has(n)||/^(?:inkscape|sodipodi|sketch|serif):/.test(n))return '';
 if(!ELEMENTS.has(n))refuse(`the element <${n}> is not allowed`+(/^(?:script|style|foreignObject|image|feImage|img|iframe|a|animate|animateTransform|animateMotion|set)$/i.test(n)?' (it could run code or fetch from outside the file)':''));
 const attrs=node.attrs.map(([k,v])=>attribute(n,k,v,refuse)).filter(Boolean);
 const inner=node.children.map(child=>clean(child,refuse,n)).join('');
 const open=`<${n}${attrs.map(([k,v])=>` ${k}="${esc(v)}"`).join('')}`;
 // (written again in the form it came in: <g/> stays <g/>, <g></g> stays <g></g>)
 return inner||!node.closed?`${open}>${inner}</${n}>`:`${open}/>`;
}
// The whole drawing, cleaned: {viewBox:[w,h], cycle, rootAttrs, inner}. Root presentation attributes (fill="none",
// stroke="currentColor", ...) are kept on a <g> round the drawing, because the page writes its own root.
function sanitize(text,refuse=why=>{throw Error(why);}){
 let root;try{root=read(text);}catch(error){refuse(error.message);}
 const get=k=>root.attrs.find(([a])=>a===k)?.[1];
 const vb=/^\s*0[\s,]+0[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)\s*$/.exec(get('viewBox')||'');
 if(!vb)refuse('the root needs viewBox="0 0 W H"');
 const cycle=get('data-cycle');if(cycle!==undefined&&!/^\d{1,2}$/.test(cycle))refuse('data-cycle is a whole number of seconds');
 const ratio=get('preserveAspectRatio');if(ratio!==undefined&&!WORD.test(ratio))refuse('preserveAspectRatio is not an allowed value');
 const kept=root.attrs.filter(([k])=>!ROOT_QUIET.has(k)).map(([k,v])=>attribute('svg',k,v,refuse)).filter(Boolean);
 let inner=root.children.map(child=>clean(child,refuse,'svg')).join('').trim();
 if(kept.length)inner=`<g${kept.map(([k,v])=>` ${k}="${esc(v)}"`).join('')}>${inner}</g>`;
 return {w:+vb[1],h:+vb[2],cycle:cycle===undefined?0:+cycle,ratio,inner};
}
// One drawing: returns what the generated block keeps for it.
function check(file,text,SLOTS){
 const slot=file.replace(/\.svg$/,'');
 if(!/^[a-z][a-z-]*\.svg$/.test(file)||!Object.hasOwn(SLOTS,slot))fail(file,`not a slot (one of: ${Object.keys(SLOTS).join(', ')})`);
 const spec=SLOTS[slot],bytes=Buffer.byteLength(text,'utf8');
 if(bytes>spec.max)fail(file,`${bytes} bytes; the slot takes at most ${spec.max}`);
 const {w,h,cycle,ratio,inner}=sanitize(text,why=>fail(file,why));
 if(spec.use==='scene'){
  if(h!==spec.h||!Number.isInteger(w)||w<spec.minW||w>spec.maxW)fail(file,`a greeting scene is viewBox="0 0 W ${spec.h}" with ${spec.minW} <= W <= ${spec.maxW}`);
  if(cycle<0||cycle>16)fail(file,'data-cycle is 0 to 16 (seconds)');
  return {w,cycle,inner};
 }
 if(w!==spec.w||h!==spec.h)fail(file,`this slot is viewBox="0 0 ${spec.w} ${spec.h}"`);
 if(spec.use==='icon')return {inner};
 // a frame is used whole as a CSS image (a data: URL): written again with its own namespace
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"${ratio?` preserveAspectRatio="${esc(ratio)}"`:''}>${inner}</svg>`};
}
function build(){
 const SLOTS=slots(),files=fs.existsSync(DIR)?fs.readdirSync(DIR).filter(f=>f.endsWith('.svg')).sort():[];
 const art={};for(const file of files)art[file.replace(/\.svg$/,'')]=check(file,fs.readFileSync(path.join(DIR,file),'utf8'),SLOTS);
 const source=fs.readFileSync(TARGET,'utf8'),eol=source.includes('\r\n')?'\r\n':'\n';
 const keys=Object.keys(art).sort(),block=[START,'// Generated by scripts/bits-art.cjs from art/bits/*.svg. Do not edit by hand: run npm run bits-art.',
  keys.length?`const ART={${eol}${keys.map(k=>`${JSON.stringify(k)}:${JSON.stringify(art[k])}`).join(`,${eol}`)}${eol}};`:'const ART={};',END].join(eol);
 const a=source.indexOf(START),b=source.indexOf(END);if(a<0||b<a)throw Error('extension/home-bits.js lost its generated markers');
 return {source,next:source.slice(0,a)+block+source.slice(b+END.length),keys};
}
if(require.main===module){
 try{
  const {source,next,keys}=build();
  if(process.argv.includes('--check')){if(source!==next){console.error('extension/home-bits.js is out of date: run npm run bits-art');process.exit(1);}console.log(`Home bits: ${keys.length} slot drawing(s) checked; the generated block is current.`);}
  else{if(source!==next)fs.writeFileSync(TARGET,next);console.log(`Home bits: ${keys.length} slot drawing(s) written${keys.length?': '+keys.join(', '):''}.`);}
 }catch(error){console.error(error.message);process.exit(1);}
}
module.exports={build,check,sanitize,ELEMENTS,ATTRIBUTES};
