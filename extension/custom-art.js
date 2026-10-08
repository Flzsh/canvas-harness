/* Canvas Harness — isolated, self-contained custom SVG artwork.
 * Public API: ReserveCustomArt (browser global and CommonJS export).
 * importSVG(source,name) and cleanAsset(asset) return only {name,svg}; render
 * returns a decorative <picture>/<img> whose SVG is percent-encoded in data:
 * image URLs, never injected as markup or loaded through iframe/object.
 *
 * Deliberate safe subset: allowlisted XML 1.0 SVG elements, attributes, local
 * #id references, CSS rules/@media/@keyframes, and restricted SMIL targets.
 * External images, fonts, scripts, DTD/entities, foreignObject, hyperlinks,
 * editor-specific namespaces, CSS variables/functions with indirect resource
 * resolution, and unsupported SVG/CSS constructs must be removed before import.
 * Per-file limits cover both raw and normalized UTF-8. The 2 MiB total is a
 * storage budget exposed to the settings layer, which sums separate assets;
 * this stateless per-file API cannot know the other uploaded artwork.
 */
(function(root){
 'use strict';

 // Every new SVG source is validated. Bounded caches reuse only validated,
 // immutable source strings; changing an asset's contents always revalidates it.
 // No XML/HTML/CSS parser dependency or browser-only API is required.
 const limits=Object.freeze({fileBytes:256*1024,totalBytes:2*1024*1024});
 function memo(maxBytes,maxEntries){
  const entries=new Map();let used=0;
  return {get(key){const hit=entries.get(key);if(!hit)return undefined;entries.delete(key);entries.set(key,hit);return hit.value;},set(key,value){const bytes=(key.length+value.length)*2;if(bytes>maxBytes)return;const old=entries.get(key);if(old){used-=old.bytes;entries.delete(key);}while(entries.size>=maxEntries||used+bytes>maxBytes){const first=entries.keys().next().value;used-=entries.get(first).bytes;entries.delete(first);}entries.set(key,{value,bytes});used+=bytes;}};
 }
 const normalizedMemo=memo(4*1024*1024,40),renderMemo=memo(16*1024*1024,40);
 const SVG_NS='http://www.w3.org/2000/svg', XLINK_NS='http://www.w3.org/1999/xlink';
 const MAX_NODES=4096, MAX_DEPTH=64, MAX_EXPANDED_NODES=12000, MAX_CSS=65536;
 const tags=new Set(('svg g defs symbol use path rect circle ellipse line polyline polygon linearGradient radialGradient stop '+
  'clipPath mask pattern filter feGaussianBlur feOffset feBlend feComposite feColorMatrix feFlood '+
  'feMerge feMergeNode feMorphology feTurbulence feDisplacementMap feDropShadow title desc style '+
  'text tspan textPath animate animateTransform animateMotion set').split(' '));
 const animations=new Set(['animate','animateTransform','animateMotion','set']);
 const globalAttrs=new Set(('id class style transform opacity fill fill-rule fill-opacity stroke stroke-opacity stroke-width '+
  'stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset color visibility display '+
  'filter clip-path clip-rule mask vector-effect paint-order shape-rendering color-interpolation '+
  'color-interpolation-filters overflow pointer-events').split(' '));
 const extra={
  svg:'xmlns xmlns:xlink viewBox preserveAspectRatio width height x y',
  g:'',defs:'',symbol:'viewBox preserveAspectRatio',
  use:'href xlink:href x y width height',
  path:'d pathLength',rect:'x y width height rx ry',circle:'cx cy r',ellipse:'cx cy rx ry',
  line:'x1 y1 x2 y2',polyline:'points',polygon:'points',
  linearGradient:'x1 x2 y1 y2 gradientUnits gradientTransform spreadMethod href xlink:href',
  radialGradient:'cx cy r fx fy fr gradientUnits gradientTransform spreadMethod href xlink:href',
  stop:'offset stop-color stop-opacity',
  clipPath:'clipPathUnits',mask:'x y width height maskUnits maskContentUnits mask-type',
  pattern:'x y width height viewBox preserveAspectRatio patternUnits patternContentUnits patternTransform href xlink:href',
  filter:'x y width height filterUnits primitiveUnits',
  feGaussianBlur:'in stdDeviation result',feOffset:'in dx dy result',
  feBlend:'in in2 mode result',feComposite:'in in2 operator k1 k2 k3 k4 result',
  feColorMatrix:'in type values result',feFlood:'flood-color flood-opacity result',
  feMerge:'result',feMergeNode:'in',feMorphology:'in operator radius result',
  feTurbulence:'type baseFrequency numOctaves seed stitchTiles result',
  feDisplacementMap:'in in2 scale xChannelSelector yChannelSelector result',
  feDropShadow:'in dx dy stdDeviation flood-color flood-opacity result',
  text:'x y dx dy rotate font-family font-size font-weight font-style text-anchor dominant-baseline letter-spacing xml:space',
  tspan:'x y dx dy rotate font-family font-size font-weight font-style text-anchor dominant-baseline letter-spacing xml:space',
  textPath:'href xlink:href startOffset method spacing',
  title:'',desc:'',style:'type',
  animate:'attributeName values from to by dur begin end repeatCount repeatDur calcMode keyTimes keySplines fill additive accumulate href xlink:href',
  animateTransform:'attributeName type values from to by dur begin end repeatCount repeatDur calcMode keyTimes keySplines fill additive accumulate href xlink:href',
  animateMotion:'path rotate keyPoints values from to by dur begin end repeatCount repeatDur calcMode keyTimes keySplines fill additive accumulate href xlink:href',
  set:'attributeName to begin end dur fill href xlink:href'
 };
 const attrFor=Object.create(null);
 for(const tag of tags)attrFor[tag]=new Set([...globalAttrs,...(extra[tag]||'').split(' ').filter(Boolean)]);
 for(const tag of animations){ // SMIL shares *only* attributes explicitly listed above, plus id.
  attrFor[tag]=new Set(['id',...(extra[tag]||'').split(' ').filter(Boolean)]);
 }
 const allowedSmilTargets=new Set(('x y cx cy r rx ry width height x1 x2 y1 y2 opacity '+
  'fill stroke fill-opacity stroke-opacity stroke-width stroke-dashoffset transform '+
  'stop-color stop-opacity').split(' '));
 const cssProperties=new Set(('fill fill-rule fill-opacity stroke stroke-width stroke-opacity stroke-linecap '+
  'stroke-linejoin stroke-dasharray stroke-dashoffset color stop-color stop-opacity opacity '+
  'transform transform-origin transform-box filter clip-path mask display visibility '+
  'font-family font-size font-style font-weight letter-spacing text-anchor dominant-baseline '+
  'paint-order shape-rendering vector-effect overflow pointer-events '+
  'animation animation-name animation-duration animation-delay animation-timing-function '+
  'animation-iteration-count animation-direction animation-fill-mode animation-play-state '+
  '-webkit-animation -webkit-animation-name -webkit-animation-duration '+
  '-webkit-animation-delay -webkit-animation-timing-function -webkit-animation-iteration-count '+
  '-webkit-animation-direction -webkit-animation-fill-mode -webkit-animation-play-state '+
  'transition transition-property transition-duration transition-delay transition-timing-function '+
  '-webkit-transition -webkit-transition-property -webkit-transition-duration '+
  '-webkit-transition-delay -webkit-transition-timing-function').split(' '));
 const xmlWhite=/[ \t\r\n]/;
 const number='[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
 const numberRe=new RegExp('^'+number+'$');
 const lengthRe=new RegExp('^'+number+'(?:px|%|em|rem|pt|pc|cm|mm|in)?$');
 const idRe=/^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/;

 function error(message){throw new Error('SVG artwork: '+message);}
 function utf8Bytes(value){return new TextEncoder().encode(value).length;}
 function validChar(cp){
  return (cp===9||cp===10||cp===13||(cp>=32&&cp<=0xD7FF)||
   (cp>=0xE000&&cp<=0xFFFD)||(cp>=0x10000&&cp<=0x10FFFF))&&
   !(cp>=0xFDD0&&cp<=0xFDEF)&&((cp&0xFFFF)!==0xFFFE)&&((cp&0xFFFF)!==0xFFFF);
 }
 function checkChars(s,context){
  for(const c of s)if(!validChar(c.codePointAt(0)))error('Invalid XML character in '+context+'.');
 }
 function escapeXML(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
 function escapeHTML(s){return escapeXML(s).replace(/'/g,'&#39;');}
 function decodeXML(value){
  let out='',i=0;
  while(i<value.length){
   const amp=value.indexOf('&',i);
   if(amp<0){out+=value.slice(i);break;}
   out+=value.slice(i,amp);
   const match=/^&(?:#x([0-9a-fA-F]+)|#([0-9]+)|(amp|lt|gt|quot|apos));/.exec(value.slice(amp));
   if(!match)error('Unknown or unterminated XML entity. Only predefined and numeric references are supported.');
   const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
   let decoded;
   if(match[3])decoded=named[match[3]];
   else{
    const cp=Number.parseInt(match[1]||match[2],match[1]?16:10);
    if(!Number.isFinite(cp)||!validChar(cp))error('Invalid XML numeric character reference.');
    decoded=String.fromCodePoint(cp);
   }
   out+=decoded;i=amp+match[0].length;
  }
  checkChars(out,'entity text');return out;
 }
 function trimName(name){
  if(name===undefined||name===null)return 'Custom artwork.svg';
  if(typeof name!=='string')error('Asset name must be a string.');
  const out=name.trim();
  if(!out||out.length>160||/[\x00-\x1f\x7f]/.test(out))error('Asset name must be 1–160 printable characters.');
  return out;
 }
 function assertFiniteNumbers(value,context,count){
  const bits=value.trim().split(/[\s,]+/);
  if((count!==undefined&&bits.length!==count)||!bits.length||bits.some(s=>!numberRe.test(s)||!Number.isFinite(Number(s))||Math.abs(Number(s))>1e7))error('Invalid or out-of-range '+context+' numeric values.');
  return bits.map(Number);
 }
 function checkPath(value){
  const tokens=[],token=/[MmLlHhVvCcSsQqTtAaZz]|[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[,\s]+/gy;
  let i=0;
  while(i<value.length){
   token.lastIndex=i;const m=token.exec(value);
   if(!m)error('Invalid SVG path command or coordinate near '+JSON.stringify(value.slice(i,i+16))+'.');
   i=token.lastIndex;
   if(!/^[,\s]+$/.test(m[0]))tokens.push(m[0]);
   if(tokens.length>8192)error('SVG path has too many coordinates. Simplify it before uploading.');
  }
  if(!tokens.length||!/[Mm]/.test(tokens[0]))error('SVG path must begin with M or m.');
  const sizes={m:2,l:2,h:1,v:1,c:6,s:4,q:4,t:2,a:7,z:0};
  let p=0,command='';
  while(p<tokens.length){
   if(/^[A-Za-z]$/.test(tokens[p])){
    command=tokens[p++];
    if(!Object.hasOwn(sizes,command.toLowerCase()))error('Unsupported SVG path command.');
    if(command.toLowerCase()==='z')continue;
   }else if(!command||command.toLowerCase()==='z')error('SVG path is missing a command.');
   const size=sizes[command.toLowerCase()];let n=0;
   while(p<tokens.length&&!/^[A-Za-z]$/.test(tokens[p])){
    const group=tokens.slice(p,p+size);
    if(group.length!==size||group.some(s=>!numberRe.test(s)||!Number.isFinite(Number(s))||Math.abs(Number(s))>1e7))error('Incomplete or out-of-range SVG path coordinate group.');
    if(command.toLowerCase()==='a'&&(!/^[01]$/.test(group[3])||!/^[01]$/.test(group[4])))error('SVG path arc flags must be 0 or 1.');
    p+=size;n++;
   }
   if(!n)error('SVG path command has no coordinates.');
  }
 }
 function parseXML(raw){
  if(typeof raw!=='string'||!raw.trim())error('Provide a nonempty SVG file or string.');
  if(utf8Bytes(raw)>limits.fileBytes)error('SVG file exceeds the 256 KiB upload limit. Optimize the artwork and try again.');
  const s=raw.replace(/^\uFEFF/,'');checkChars(s,'SVG source');
  let i=0,seenDeclaration=false,rootNode=null,nodeCount=0;
  const stack=[];
  const white=()=>{while(i<s.length&&xmlWhite.test(s[i]))i++;};
  function readName(){const match=/^[A-Za-z_][A-Za-z0-9_.:-]*/.exec(s.slice(i));if(!match)error('Malformed SVG XML element or attribute name.');i+=match[0].length;return match[0];}
  function readTag(){
   i++;const name=readName();
   if(!tags.has(name))error('Unsupported or unsafe SVG element <'+name+'>. Remove scripts, embedded images, and HTML.');
   const attrs=Object.create(null);let closed=false,selfClose=false;
   while(i<s.length){
    const before=i;white();const hadSpace=i!==before;
    if(s.startsWith('/>',i)){i+=2;closed=true;selfClose=true;break;}
    if(s[i]==='>'){i++;closed=true;break;}
    if(!hadSpace)error('SVG XML attributes must be separated by whitespace.');
    const key=readName();white();
    if(s[i++]!=='=')error('SVG XML attribute '+key+' must use = and quotes.');
    white();const quote=s[i++];
    if(quote!=='"'&&quote!=="'")error('SVG XML attribute '+key+' must be quoted.');
    const begin=i;
    while(i<s.length&&s[i]!==quote){if(s[i]==='<')error('Raw < is invalid inside an SVG XML attribute.');i++;}
    if(i>=s.length)error('Unterminated SVG XML attribute '+key+'.');
    const val=decodeXML(s.slice(begin,i));i++;
    if(Object.hasOwn(attrs,key))error('Duplicate SVG XML attribute '+key+'.');
    attrs[key]=val;
    if(Object.keys(attrs).length>60)error('SVG element has too many attributes. Simplify the export.');
   }
   if(!closed)error('Unterminated SVG XML element <'+name+'>.');
   if(name.includes(':'))error('SVG namespace prefixes are unsupported. Export a plain SVG.');
   if(++nodeCount>MAX_NODES)error('SVG complexity limit: too many elements (maximum '+MAX_NODES+').');
   if(stack.length>=MAX_DEPTH)error('SVG complexity limit: nesting exceeds '+MAX_DEPTH+' elements.');
   const node={tag:name,attrs,children:[]};
   if(stack.length)stack[stack.length-1].children.push(node);
   else if(rootNode)error('Malformed SVG XML: multiple root elements.');
   else{if(name!=='svg')error('SVG file must have <svg> as its root element.');rootNode=node;}
   if(!selfClose)stack.push(node);
  }
  while(i<s.length){
   if(s.startsWith('<!--',i)){
    const end=s.indexOf('-->',i+4);
    if(end<0||s.slice(i+4,end).includes('--')||s[end-1]==='-')error('Malformed SVG XML comment.');
    i=end+3;continue;
   }
   if(s.startsWith('<?',i)){
    if(i!==0&&!(i===1&&s[0]==='\uFEFF'))error('SVG processing instructions and XML stylesheets are unsupported.');
    const end=s.indexOf('?>',i+2);
    if(end<0||seenDeclaration||!/^<\?xml\s+version=["']1\.0["'](?:\s+encoding=["']UTF-8["'])?(?:\s+standalone=["'](?:yes|no)["'])?\s*\?>$/.test(s.slice(i,end+2)))error('Only XML 1.0 with optional UTF-8 encoding is supported.');
    i=end+2;seenDeclaration=true;continue;
   }
   if(s.startsWith('<![CDATA[',i)){
    const end=s.indexOf(']]>',i+9);if(end<0)error('Unterminated XML CDATA.');
    const parent=stack[stack.length-1];
    if(!parent||!new Set(['style','title','desc','text','tspan']).has(parent.tag))error('SVG CDATA is only supported in text or CSS style elements.');
    parent.children.push({text:s.slice(i+9,end)});i=end+3;continue;
   }
   if(s.startsWith('</',i)){
    i+=2;const name=readName();white();
    if(s[i++]!=='>')error('Malformed SVG XML closing tag.');
    if(!stack.length||stack[stack.length-1].tag!==name)error('Mismatched SVG XML closing tag </'+name+'>.');
    stack.pop();continue;
   }
   if(s[i]==='<'){
    if(s.startsWith('<!',i))error('SVG DTDs, entity declarations and other XML directives are forbidden.');
    readTag();continue;
   }
   const end=s.indexOf('<',i),to=end<0?s.length:end;
   const rawText=s.slice(i,to);
   if(rawText.includes(']]>'))error('Invalid SVG XML text containing ]]>.');
   const value=decodeXML(rawText),parent=stack[stack.length-1];
   if(!parent){if(value.trim())error('Malformed SVG XML: text outside the root element.');}
   else parent.children.push({text:value});
   i=to;
  }
  if(stack.length||!rootNode)error('Malformed SVG XML: missing or unclosed <svg> element.');
  return rootNode;
 }

 function cssDecode(input){
  // Normalize CSS escapes *before* policy checks so \72l and @\69mport cannot hide tokens.
  return input.replace(/\\([0-9a-fA-F]{1,6})(?:[ \t\r\n])?|\\([^\r\n\f])/g,(_,hex,char)=>{
   const cp=hex?Number.parseInt(hex,16):char.codePointAt(0);
   if(!validChar(cp))error('Invalid CSS escape character.');
   return String.fromCodePoint(cp);
  });
 }
 function localURLs(value,refs,context){
  // Any resource-bearing function is rejected unless its complete argument is a local #id.
  const expr=/\burl\s*\(([^()]*)\)/gi;
  let m,found=[];
  while((m=expr.exec(value))){
   const arg=m[1].trim(),quoted=/^(?:'([^']+)'|"([^"]+)")$/.exec(arg);
   const target=quoted?(quoted[1]||quoted[2]):arg;
   if(!target.startsWith('#')||!idRe.test(target.slice(1)))error(context+' must use only a local url(#id) reference. External resources are forbidden.');
   refs.push(target.slice(1));found.push(m[0]);
  }
  const scrubbed=value.replace(expr,'');
  if(/\burl\s*\(/i.test(scrubbed))error('Malformed '+context+' url(): use url(#id) only.');
  if(/\b(?:var|attr|image-set|cross-fade|src|expression|-moz-element|paint)\s*\(/i.test(value))error('Unsafe CSS function in '+context+'. Use direct, self-contained values.');
  return found;
 }
 function checkCSSValue(value,refs,context){
  if(value.length>8192||/[{}<>;]/.test(value))error('Invalid CSS value in '+context+'.');
  if(/@|\\|\/\*|\*\/|(?:^|\W)(?:javascript|data|file|blob|https?):/i.test(value))error('Unsafe CSS syntax or resource in '+context+'.');
  localURLs(value,refs,context);
  // At this point URL loads are restricted to local fragments. Refuse unknown
  // executable and legacy CSS functions even inside custom properties.
  return value.trim();
 }
 function stripCSSComments(s){
  let clean='',i=0;
  while(i<s.length){
   const start=s.indexOf('/*',i);
  if(start<0){clean+=s.slice(i);break;}
   clean+=s.slice(i,start);
   const end=s.indexOf('*/',start+2);
   if(end<0)error('Unclosed CSS comment in SVG style.');
   // CSS comments can split an identifier: ur/**/l becomes url.
   // Joining first ensures forbidden functions cannot evade inspection.
   i=end+2;
  }
  if(clean.includes('*/'))error('Malformed CSS comment terminator.');
  return clean;
 }
 function declarations(source,refs,staticMode){
  const out=[];let start=0,quote='',depth=0;
  function add(piece){
   if(!piece.trim())return;
   const colon=piece.indexOf(':');
   if(colon<1)error('Malformed SVG CSS declaration: expected property:value.');
   const key=piece.slice(0,colon).trim().toLowerCase(),value=piece.slice(colon+1).trim();
   if(!/^--[a-z0-9_-]+$/.test(key)&&!cssProperties.has(key))error('Unsupported SVG CSS property '+key+'.');
   if(!value)error('Empty SVG CSS value for '+key+'.');
   checkCSSValue(value,refs,'CSS '+key);
   if(staticMode&&/(?:^|-)animation(?:-|$)|(?:^|-)transition(?:-|$)/.test(key))return;
   out.push(key+':'+value);
  }
  for(let i=0;i<source.length;i++){
   const ch=source[i];
   if(quote){if(ch===quote)quote='';continue;}
   if(ch==='"'||ch==="'"){quote=ch;continue;}
   if(ch==='(')depth++;
   if(ch===')')depth--;
   if(depth<0)error('Unbalanced CSS parentheses.');
   if(ch===';'&&depth===0){add(source.slice(start,i));start=i+1;}
  }
  if(quote||depth)error('Unclosed CSS quote or parentheses.');
  add(source.slice(start));
  if(staticMode)out.push('animation:none!important','-webkit-animation:none!important','transition:none!important','-webkit-transition:none!important');
  return out.join(';');
 }
 function cssRules(source,refs,staticMode,inKeyframes=false,depth=0){
  if(depth>8)error('SVG CSS nesting limit exceeded.');
  let i=0,output='';
  while(i<source.length){
   while(/\s/.test(source[i]||'')&&i<source.length)i++;
   if(i>=source.length)break;
   let quote='',parens=0,open=-1;
   for(let j=i;j<source.length;j++){
    const ch=source[j];
    if(quote){if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"){quote=ch;continue;}
    if(ch==='(')parens++;
    if(ch===')')parens--;
    if(parens<0)error('Unbalanced CSS rule parentheses.');
    if(ch===';'&&parens===0)error('Only CSS rules, @media, and @keyframes are supported. No @import.');
    if(ch==='}'&&parens===0)error('Extra CSS closing brace.');
    if(ch==='{'&&parens===0){open=j;break;}
   }
   if(open<0||quote||parens)error('Unterminated SVG CSS rule.');
   const prelude=source.slice(i,open).trim();
   if(!prelude||prelude.length>1024)error('Invalid SVG CSS selector or at-rule.');
   let end=-1,braces=1;quote='';parens=0;
   for(let j=open+1;j<source.length;j++){
    const ch=source[j];
    if(quote){if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"){quote=ch;continue;}
    if(ch==='(')parens++;
    if(ch===')')parens--;
    if(ch==='{'&&parens===0)braces++;
    if(ch==='}'&&parens===0&&!--braces){end=j;break;}
   }
   if(end<0||quote||parens)error('Unbalanced SVG CSS braces.');
   const body=source.slice(open+1,end),keyframes=/^@(?:-webkit-)?keyframes\s+[A-Za-z_][A-Za-z0-9_-]*$/i.test(prelude),media=/^@media\s+[^{};@]+$/i.test(prelude);
   if(prelude.startsWith('@')){
    if(keyframes){if(!staticMode)output+=prelude+'{'+cssRules(body,refs,false,true,depth+1)+'}';}
    else if(media){
     if(!/^[\w\s():.,%+-]+$/.test(prelude.slice(6)))error('Unsafe SVG CSS media condition.');
     output+=prelude+'{'+cssRules(body,refs,staticMode,false,depth+1)+'}';
    }else error('Unsupported SVG CSS at-rule '+prelude+'. Remove external imports and fonts.');
   }else{
    if(/[{};@\\]/.test(prelude)||!/^[-#.*:[\]()="',\w\s>+~%]+$/.test(prelude))error('Unsupported SVG CSS selector '+prelude+'.');
    if(inKeyframes&&!/^(?:(?:from|to|\d+(?:\.\d+)?%)(?:\s*,\s*)?)+$/i.test(prelude))error('Invalid SVG CSS keyframe selector.');
    if(body.includes('{')||body.includes('}'))error('Nested CSS declarations are unsupported.');
    const formatted=declarations(body,refs,staticMode);
    output+=prelude+'{'+formatted+'}';
   }
   i=end+1;
  }
  return output;
 }
 function sanitizeCSS(input,refs,staticMode=false,inline=false){
  if(input.length>MAX_CSS)error('SVG CSS exceeds the 64 KiB style limit.');
  const s=cssDecode(stripCSSComments(input));
  if(/\\/.test(s))error('Malformed CSS escape.');
  return inline?declarations(s,refs,staticMode):cssRules(s,refs,staticMode);
 }
 function checkBasicAttr(tag,key,value,refs){
  if(value.length>MAX_CSS)error('SVG attribute '+key+' is too long.');
  if(/^on/i.test(key))error('SVG event handler '+key+' is forbidden.');
  if(key==='id'&&!idRe.test(value))error('SVG id must start with a letter or underscore and contain only letters, digits, _, -, or dots.');
  if(key==='class'&&!/^[a-zA-Z_][a-zA-Z0-9_-]*(?:\s+[a-zA-Z_][a-zA-Z0-9_-]*)*$/.test(value))error('Invalid SVG class name.');
  if(key==='viewBox'){
   const parts=assertFiniteNumbers(value,'SVG viewBox',4);
   if(parts[2]<=0||parts[3]<=0||parts.some(n=>Math.abs(n)>1e7))error('SVG viewBox dimensions must be positive and bounded.');
  }
  if(key==='d'||key==='path'&&tag==='animateMotion')checkPath(value);
  if(key==='points'){
   const bits=assertFiniteNumbers(value,'SVG points');
   if(bits.length<4||bits.length%2)error('SVG points must have coordinate pairs.');
  }
  if(key==='href'||key==='xlink:href'){
   if(!/^#[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(value))error('SVG href must reference a local #id. External resources are forbidden.');
   refs.push(value.slice(1));
  }
  if(key==='preserveAspectRatio'&&!/^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?:\s+(?:meet|slice))?)$/.test(value))error('Unsupported SVG preserveAspectRatio.');
  if(key==='style')return;
  if(['width','height','x','y','cx','cy','r','rx','ry','x1','x2','y1','y2','dx','dy','fr','fx','fy','offset','stop-opacity','opacity','fill-opacity','stroke-opacity','stroke-width','pathLength','stdDeviation','scale','seed','numOctaves'].includes(key)){
   if(!lengthRe.test(value))error('SVG attribute '+key+' requires a number or length.');
   const amount=Number.parseFloat(value);
   if(!Number.isFinite(amount)||Math.abs(amount)>1e6)error('SVG attribute '+key+' exceeds the supported numeric limit.');
   if(['stdDeviation'].includes(key)&&(!Number.isFinite(amount)||amount<0||amount>64))error('SVG filter blur limit is 64. Reduce stdDeviation.');
   if(key==='numOctaves'&&(!Number.isInteger(amount)||amount<0||amount>5))error('SVG filter numOctaves limit is 5.');
   if(['r','rx','ry','width','height','stroke-width'].includes(key)&&amount<0)error('SVG '+key+' cannot be negative.');
   if(['opacity','fill-opacity','stroke-opacity','stop-opacity'].includes(key)&&(amount<0||amount>1))error('SVG '+key+' must be between 0 and 1.');
   if(tag==='filter'&&['width','height'].includes(key)&&amount>(value.endsWith('%')?400:10000))error('SVG filter region exceeds the size limit.');
  }
  if(key==='baseFrequency'){
   const values=assertFiniteNumbers(value,'SVG filter baseFrequency');
   if(values.length>2||values.some(n=>n<0||n>1))error('SVG filter baseFrequency must contain one or two values from 0 to 1.');
  }
  if(key==='attributeName'){
   if(!allowedSmilTargets.has(value))error('Unsafe SVG animation attributeName '+value+'.');
   if(tag==='animateTransform'&&value!=='transform')error('SVG animateTransform can only animate transform.');
   if(tag==='animate'&&value==='transform')error('Use animateTransform for SVG transforms.');
  }
  if(['begin','end','dur','repeatDur'].includes(key)){
   if(!/^(?:\d+(?:\.\d+)?(?:ms|s|min|h)|indefinite)$/.test(value))error('Unsupported SVG animation clock in '+key+'. Use time values such as 1s; events are forbidden.');
  }
  if(key==='repeatCount'&&!/^(?:indefinite|\d+(?:\.\d+)?)$/.test(value))error('SVG repeatCount must be numeric or indefinite.');
  if(key==='type'&&tag==='style'&&value!=='text/css')error('SVG style type must be text/css.');
  if(key==='type'&&tag==='animateTransform'&&!/^(?:translate|scale|rotate|skewX|skewY)$/.test(value))error('Unsupported SVG animateTransform type.');
  if(key==='calcMode'&&!/^(?:linear|discrete|paced|spline)$/.test(value))error('Unsupported SVG animation calcMode.');
  if(key==='fill'&&animations.has(tag)&&!['freeze','remove'].includes(value))error('SVG animation fill must be freeze or remove.');
  if(['values','from','to','by'].includes(key)&&animations.has(tag)){
   for(const item of value.split(';')){
    if(!item.trim()||item.length>4096)error('Invalid SVG animation values.');
    checkCSSValue(item,refs,'SVG animation '+key);
   }
  }
  if(['fill','stroke','filter','mask','clip-path','stop-color','color','flood-color','marker-start','marker-mid','marker-end'].includes(key)&&!animations.has(tag))checkCSSValue(value,refs,'SVG '+key);
  else if(/\burl\s*\(|\b(?:javascript|https?|data|file|blob):/i.test(value)&&!['href','xlink:href','style'].includes(key))error('SVG attribute '+key+' contains a disallowed resource or URL.');
 }
 function validateTree(node){
  const ids=new Map(),refs=[],cssNodes=[],styleAttrs=[],nodes=[];
  function visit(n,depth,parent){
   if(Object.hasOwn(n,'text')){
    if(parent&&!['title','desc','text','tspan','textPath','style'].includes(parent)&&n.text.trim())error('SVG text is only supported in text, title, desc, and style elements.');
    return;
   }
   nodes.push(n);
   if(n.tag==='style')cssNodes.push(n);
   if(parent==='style')error('SVG CSS style cannot contain SVG child elements.');
   if(animations.has(n.tag)&&!parent)error('SVG animation must have a parent shape.');
   if(n.tag==='svg'&&depth!==0)error('Nested SVG root elements are unsupported.');
   const attrs=n.attrs;
   for(const key of Object.keys(attrs)){
    if(/^on/i.test(key))error('SVG event handler '+key+' is forbidden.');
    if(key==='xmlns'||key==='xmlns:xlink'){
     if(depth!==0||(key==='xmlns'&&attrs[key]!==SVG_NS)||(key==='xmlns:xlink'&&attrs[key]!==XLINK_NS))error('Unsupported SVG namespace; export a plain SVG with the standard namespace.');
     continue;
    }
    if(key.includes(':')&&key!=='xlink:href'&&key!=='xml:space')error('SVG XML namespaces and rebased resources are unsupported: '+key+'.');
    if(!attrFor[n.tag].has(key))error('Unsupported SVG attribute '+key+' on <'+n.tag+'>. Remove it before uploading.');
    if((key==='href'||key==='xlink:href')&&!new Set(['use','linearGradient','radialGradient','pattern','textPath',...animations]).has(n.tag))error('SVG href on <'+n.tag+'> is not permitted.');
    if(key==='xlink:href'&&(!rootNodeHasXlink||n.attrs.href!==undefined))error('SVG xlink:href needs the official xlink namespace and no competing href.');
    if(key==='style')styleAttrs.push(n);
    else checkBasicAttr(n.tag,key,attrs[key],refs);
   }
   if(attrs.id!==undefined){if(ids.has(attrs.id))error('Duplicate SVG id #'+attrs.id+'.');ids.set(attrs.id,n);}
   if(animations.has(n.tag)){
    if((n.tag==='animate'||n.tag==='set'||n.tag==='animateTransform')&&!attrs.attributeName)error('SVG animation needs a safe attributeName.');
    if(n.tag==='animateMotion'&&attrs.attributeName!==undefined&&attrs.attributeName!=='transform')error('SVG animateMotion can only affect transforms.');
    if(n.tag==='animateMotion'&&attrs.attributeName===undefined){} // Motion implicitly targets transform.
    if(n.tag==='animateTransform'&&!attrs.type)error('SVG animateTransform needs a transform type.');
    if(!['animateMotion'].includes(n.tag)&&!attrs.values&&!attrs.to&&!attrs.by)error('SVG animation needs values or to/by.');
    if(n.children.some(x=>!Object.hasOwn(x,'text')||x.text.trim()))error('SVG animation elements may not contain markup or text.');
   }
   for(const c of n.children)visit(c,depth+1,n.tag);
  }
  const rootNodeHasXlink=node.attrs['xmlns:xlink']===XLINK_NS;
  visit(node,0,null);
  if(!node.attrs.xmlns)node.attrs.xmlns=SVG_NS;
  if(cssNodes.length>16)error('SVG contains too many separate CSS stylesheets.');
  for(const n of cssNodes){
   const text=n.children.filter(x=>Object.hasOwn(x,'text')).map(x=>x.text).join('');
   n.children=[{text:sanitizeCSS(text,refs,false)}];
  }
  for(const n of styleAttrs)n.attrs.style=sanitizeCSS(n.attrs.style,refs,false,true);
  // Canonicalize the legacy href spelling only after checking its namespace.
  for(const n of nodes)if(n.attrs['xlink:href']){n.attrs.href=n.attrs['xlink:href'];delete n.attrs['xlink:href'];}
  for(const ref of refs)if(!ids.has(ref))error('Unresolved SVG reference #'+ref+'. Add the referenced id or remove the reference.');
  const useTargets=new Set(['symbol','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan']);
  for(const n of nodes){
   if(!n.attrs.href)continue;
   const target=ids.get(n.attrs.href.slice(1));
   if(n.tag==='use'&&!useTargets.has(target.tag))error('SVG <use> reference must target a drawable shape, group, or symbol.');
   if(n.tag==='textPath'&&target.tag!=='path')error('SVG textPath reference must target a path element.');
   if(n.tag==='pattern'&&target.tag!=='pattern')error('SVG pattern inheritance must reference another pattern.');
   if(['linearGradient','radialGradient'].includes(n.tag)&&!['linearGradient','radialGradient'].includes(target.tag))error('SVG gradient inheritance must reference a gradient.');
   if(animations.has(n.tag)&&['style','defs','filter','animate','animateTransform','animateMotion','set'].includes(target.tag))error('SVG animation cannot target that element type.');
  }
  // A local <use> graph can still expand exponentially or recurse forever.
  // Count expanded descendants with memoization and a strict total budget.
  const costs=new Map(),active=new Set();
  function weight(n){
   if(Object.hasOwn(n,'text'))return 0;
   if(costs.has(n))return costs.get(n);
   if(active.has(n))error('Recursive SVG reference detected. Remove the <use> or inherited gradient cycle.');
   active.add(n);let sum=1;
   for(const child of n.children)sum+=weight(child);
   if(n.attrs.href)sum+=weight(ids.get(n.attrs.href.slice(1)));
   active.delete(n);
   if(sum>MAX_EXPANDED_NODES)error('SVG reference expansion limit exceeded. Simplify repeated <use> elements.');
   costs.set(n,sum);return sum;
  }
  weight(node);
  return node;
 }
 function serialize(node,staticMode=false,ratio=null){
  if(Object.hasOwn(node,'text'))return escapeXML(node.text);
  if(staticMode&&animations.has(node.tag))return '';
  if(staticMode&&node.tag==='style'){
   const plain=node.children.map(x=>x.text||'').join('');
   return '<style>'+escapeXML(sanitizeCSS(plain,[],true))+'</style>';
  }
  let attrs='';
  for(const [key,v] of Object.entries(node.attrs)){
   let value=v;
   if(node.tag==='svg'&&key==='preserveAspectRatio'&&ratio)value=ratio;
   if(staticMode&&key==='style')value=sanitizeCSS(value,[],true,true);
   attrs+=' '+key+'="'+escapeXML(value)+'"';
  }
  if(node.tag==='svg'&&ratio&&!Object.hasOwn(node.attrs,'preserveAspectRatio'))attrs+=' preserveAspectRatio="'+ratio+'"';
  if(!node.children.length)return '<'+node.tag+attrs+'/>';
  return '<'+node.tag+attrs+'>'+node.children.map(c=>serialize(c,staticMode)).join('')+'</'+node.tag+'>';
 }
 function normalize(source){
  if(typeof source==='string'){const cached=normalizedMemo.get(source);if(cached!==undefined)return cached;}
  const node=validateTree(parseXML(source)),normalized=serialize(node);
  if(utf8Bytes(normalized)>limits.fileBytes)error('Normalized SVG exceeds the 256 KiB stored artwork limit. Simplify the export.');
  normalizedMemo.set(source,normalized);normalizedMemo.set(normalized,normalized);return normalized;
 }
 function importSVG(source,name){return {name:trimName(name),svg:normalize(source)};}
 function cleanAsset(value){
  if(value===null||value===undefined)return null;
  if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.svg!=='string')error('Invalid SVG asset. Expected {name, svg} with SVG source text.');
  return importSVG(value.svg,value.name);
 }
 function dataURL(svg){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);}
 function render(value,options={}){
  if(value===null||value===undefined)return '';
  if(!options||typeof options!=='object'||Array.isArray(options))error('Invalid SVG render options.');
  const {kind='banner',className='',motion=true,fit='cover',position='center'}=options;
  if(!['banner','border','icon'].includes(kind))error('Invalid SVG artwork kind. Choose banner, border, or icon.');
  if(!['cover','contain','fill'].includes(fit))error('Invalid SVG fit. Choose cover, contain, or fill.');
  if(!['left','center','right'].includes(position))error('Invalid SVG position. Choose left, center, or right.');
  if(typeof motion!=='boolean')error('Invalid SVG motion: expected a boolean.');
  if(typeof className!=='string'||className.length>512)error('Invalid SVG className: expected a short string.');
  const asset=cleanAsset(value),ratio=fit==='fill'?'none':
   `x${position==='left'?'Min':position==='right'?'Max':'Mid'}YMid ${fit==='cover'?'slice':'meet'}`;
  const cacheKey=JSON.stringify([asset.svg,kind,className,motion,fit,position]),cached=renderMemo.get(cacheKey);
  if(cached!==undefined)return cached;
  const node=validateTree(parseXML(asset.svg));
  const still=serialize(node,true,ratio),animated=serialize(node,false,ratio);
  const img='<img alt="" aria-hidden="true" draggable="false" loading="lazy" decoding="async" src="'+
   dataURL(motion?animated:still)+'" style="display:block;width:100%;height:100%;object-fit:'+fit+';object-position:'+position+' center">';
  const output='<picture class="reserve-custom-art reserve-custom-art--'+kind+(className?' '+escapeHTML(className):'')+'" aria-hidden="true">'+
   (motion?'<source media="(prefers-reduced-motion: reduce)" srcset="'+dataURL(still)+'">':'')+img+'</picture>';
  renderMemo.set(cacheKey,output);return output;
 }
 function template(kind){
  if(kind==='banner')return `<svg xmlns="${SVG_NS}" viewBox="0 0 960 240" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="sky" x2="1" y2="1"><stop offset="0" stop-color="#132b49"/><stop offset="1" stop-color="#2d7380"/></linearGradient><linearGradient id="glow" x2="0" y2="1"><stop offset="0" stop-color="#fce7a7"/><stop offset="1" stop-color="#ecb66c"/></linearGradient></defs><style>.horizon{animation:rise 7s ease-in-out infinite}.spark{animation:twinkle 3s ease-in-out infinite}@keyframes rise{50%{transform:translateY(-6px)}}@keyframes twinkle{50%{opacity:.25}}</style><rect width="960" height="240" fill="url(#sky)"/><circle cx="700" cy="94" r="54" fill="url(#glow)" class="horizon"/><path d="M0 179Q190 94 365 180T730 177T960 148V240H0Z" fill="#4d8690" opacity=".8"/><path d="M0 206Q235 142 462 206T960 185V240H0Z" fill="#21475a"/><circle class="spark" cx="114" cy="55" r="3" fill="#fce7a7"/><circle class="spark" cx="238" cy="87" r="2" fill="#fce7a7"/><circle class="spark" cx="843" cy="36" r="3" fill="#fce7a7"/></svg>`;
  if(kind==='border')return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 110"><style>.thread{animation:breathe 5s ease-in-out infinite}@keyframes breathe{50%{opacity:.4}}</style><path d="M18 7Q170 3 342 8Q354 9 353 24L354 89Q352 103 340 103Q181 108 18 102Q5 101 7 88L6 23Q5 9 18 7Z" fill="none" stroke="#665c4e" stroke-width="1.7"/><path class="thread" d="M20 11Q165 8 338 12Q348 13 348 24L349 87Q348 98 337 98Q180 103 20 97Q12 97 12 87L11 25Q11 14 20 11Z" fill="none" stroke="#c18a64" stroke-width="1.1"/><path d="M24 6l15 1m281 96l13-1" stroke="#689181" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';
  if(kind==='icon')return `<svg xmlns="${SVG_NS}" viewBox="0 0 100 100"><defs><linearGradient id="orb" x2="1" y2="1"><stop offset="0" stop-color="#f4cb85"/><stop offset="1" stop-color="#cc764c"/></linearGradient></defs><style>.orbit{animation:turn 9s linear infinite;transform-origin:50% 50%}.star{animation:blink 2s ease-in-out infinite}@keyframes turn{to{transform:rotate(360deg)}}@keyframes blink{50%{opacity:.35}}</style><circle cx="50" cy="50" r="43" fill="#1f4a59"/><circle cx="50" cy="50" r="25" fill="url(#orb)"/><g class="orbit"><circle cx="50" cy="12" r="6" fill="#fbe4b7"/><circle cx="50" cy="88" r="4" fill="#9bd4cc"/></g><path class="star" d="M50 32L54 46L68 50L54 54L50 68L46 54L32 50L46 46Z" fill="#fff2cc"/></svg>`;
  error('Unknown SVG template kind. Choose banner, border, or icon.');
 }
 const api=Object.freeze({cleanAsset,importSVG,render,template,limits});
 root.ReserveCustomArt=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
