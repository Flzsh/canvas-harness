// SPDX-License-Identifier: GPL-3.0-only
// Original creator: Flzsh.
(function(root){
 'use strict';
 const INK='#3C3A32',PAPER='#FAF9F5',CLAY='#D97757',SAGE='#B7BFA0',OCHRE='#D4A27F',CYCLE=12;
 const escape=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
 const n=value=>String(Math.round(value*1000)/1000);
 const hash=value=>{let h=2166136261;for(const ch of String(value??''))h=Math.imul(h^ch.codePointAt(0),16777619)>>>0;return h;};
 function token(value,fallback){
  const text=String(value??'');
  if(!text)return fallback;
  if(/^[A-Za-z0-9_-]{1,80}$/.test(text))return text;
  return (text.replace(/[^A-Za-z0-9_-]/g,'').slice(0,64)||fallback)+'-'+hash(text).toString(36);
 }
 function labelOf(value){
  // Keep the name, including its alphabet. Replace only characters XML cannot carry.
  const text=Array.from(String(value??''),ch=>{
   const cp=ch.codePointAt(0);
   return cp<32&&!/[\t\n\r]/.test(ch)||cp>=0xD800&&cp<=0xDFFF||cp===0xFFFE||cp===0xFFFF?'\uFFFD':ch;
  }).join('').replace(/\s+/gu,' ').trim();
  return text||'All courses';
 }
 const segmenter=typeof Intl!=='undefined'&&typeof Intl.Segmenter==='function'?new Intl.Segmenter(undefined,{granularity:'grapheme'}):null;
 const letters=text=>segmenter?Array.from(segmenter.segment(text),part=>part.segment):Array.from(text);
 // A small original drafting alphabet: [advance, pen strokes], on a 24-unit cap height.
 // Lowercase keeps the student's spelling. The gentle asymmetry is in the strokes themselves.
 const GLYPHS={
  ' ':[8,''],
  A:[18,'M1 24L8.2 .8Q8.7 .1 9.2 1L17 24M4.5 15.1Q9 14.5 13.5 15'],
  B:[18,'M2 24L2.2 1Q16 -.6 15.5 7Q15.5 11.5 3 12M3 12Q18 11.2 16.4 19Q15.5 25 2 24'],
  C:[19,'M17 3Q12 -.8 6 2Q.7 5 1.4 14Q1.8 25 11 24Q15 24 18 21'],
  D:[19,'M2 24L2.4 1Q18 -.5 17.5 13Q17 25 2 24'],
  E:[16,'M14.8 1L2 1.6L1.6 23.5L15 24M2 12L12.2 11.8'],
  F:[16,'M2 24L2.5 1.2L15 1M2.2 12.2L12.3 12'],
  G:[20,'M18 3Q12 -.4 6 2Q.9 6 1.6 15Q2.8 26 12 24Q17 23.5 18 20L18 13L11 13.3'],
  H:[20,'M2 1L1.7 24M17.5 .7L17.8 24M2 12.8L17.5 12.2'],
  I:[10,'M1 1.2L8 1M4.4 1L4.8 24M1 24L8.5 23.7'],
  J:[15,'M13 1L12.7 18Q12.5 25 6.3 24Q1 23.5 1 19M8 1L13 1'],
  K:[19,'M2 1L2.3 24M17 .9L2.4 14M7.6 9.4L17.7 24'],
  L:[17,'M2.6 1L2 23.5L15.5 24'],
  M:[23,'M1.5 24L2 1L11 15.7L20.5 .9L21 24'],
  N:[21,'M2 24L2.1 1L18.2 23.8L18 .8'],
  O:[21,'M10.5 1Q1 -.2 1.7 12.8Q2 25 11 24Q20 23 19 11Q18.8 1.2 10.5 1Z'],
  P:[18,'M2 24L2.4 1Q17 -.3 16.4 7.5Q16.3 13 2.3 12.4'],
  Q:[22,'M10.5 1Q1 -.2 1.8 13Q2 25 11 24Q20 23 19 11Q18.8 1.2 10.5 1ZM12.5 18L21 26'],
  R:[19,'M2 24L2.3 1Q17 -.2 16.5 7.5Q16.2 13 2.2 12.2M9 12.4L18 24'],
  S:[18,'M16 2.5Q4 -1.4 2 5.6Q.7 11 9.8 12.8Q18 15 16.4 20Q14.3 27 1 22'],
  T:[18,'M1 1.4L17 1M9 1L8.4 24'],
  U:[20,'M2 1L1.8 17Q2 25 10 24Q18 24 17.8 16.5L18 .8'],
  V:[19,'M1 .7L9.4 24L17.5 1'],
  W:[27,'M1 .8L6.6 24L13 8L19.3 24L25 1'],
  X:[19,'M1.8 1L17 24M16.5 1L2 24'],
  Y:[19,'M1 1L9.1 12.8L17.5 .8M9.1 12.8L8.8 24'],
  Z:[18,'M1.5 1.5L16.5 1L1.4 23.5L17 24'],
  a:[15,'M12 10Q7 5 3.2 9Q-.5 13 1.7 20Q3.5 26 9.1 22L12.1 18M12 7.7L12 24L14 24'],
  b:[15,'M2.1 .5L1.6 24M2 11.4Q7.5 5.5 11.5 10Q16.4 16 10.6 22.9Q6.5 26 2 21'],
  c:[14,'M12 8.3Q7 5.5 3.4 9Q-.7 13.5 2.7 20.7Q5.4 25.6 12.3 22'],
  d:[15,'M12.2 .5L11.8 24M11.8 10Q6.6 5.3 2.8 10Q-.4 15.4 2.6 21Q6.2 26.3 11.9 20'],
  e:[14,'M1.4 15L12 14.4Q11.8 6.2 6.2 7.3Q.2 8.3 1.5 18.4Q3.5 26 12.6 22'],
  f:[11,'M3 24L3.5 5Q4 -.6 9.5 .8M.8 8.5L9 8'],
  g:[15,'M12 9.5Q6.5 4.8 2.9 10Q-.3 15.8 2.9 21Q7.2 26 12 19M12 7.6L11.8 24Q11.7 31 3.3 28'],
  h:[15,'M2 .5L1.8 24M2 12.5Q5.8 6.4 9.5 7.7Q13 8.5 12.6 14.1L12.7 24'],
  i:[8,'M3.2 8L3.4 23.8M3.3 2.7L3.4 3.3'],
  j:[9,'M5.6 8L5.3 24.5Q5 30 1 28M5.4 2.7L5.6 3.3'],
  k:[15,'M2 .5L1.8 24M12.3 8L2 17M6.7 12.8L13.4 24'],
  l:[8,'M3 .6L2.7 20.5Q2.8 24.5 6.1 23.8'],
  m:[23,'M1.8 8L1.7 24M2 12Q7.5 4.4 11 9.2L11 24M11.1 12Q16.3 5.4 20 9.7L20.1 24'],
  n:[15,'M1.8 8L1.6 24M2 12.4Q7.4 5.5 10.7 8.4Q13.1 9.9 12.5 16L12.7 24'],
  o:[15,'M7.4 7.6Q.1 7 1.4 17.3Q2.1 24.9 8.1 24Q14 23 12.8 14Q12.4 7.6 7.4 7.6Z'],
  p:[15,'M2 8L1.7 29M2 11.9Q7.3 5.5 11.1 9.6Q15 14.9 10.9 21.8Q7.3 25.6 2 21'],
  q:[15,'M12 9.8Q6.5 4.8 2.8 10.1Q-.3 15.7 2.8 21Q6.7 26.2 11.9 20M12 7.7L12.3 29'],
  r:[11,'M2 8L1.8 24M2 12.7Q5.4 6.7 9 8.4'],
  s:[13,'M11 8.7Q3.2 5.4 1.8 11Q.5 14.7 7.3 16Q13.3 17.6 10.6 22Q7.4 26.1 1 22.5'],
  t:[11,'M4 .9L3.6 19.5Q3.5 25.3 9 23M1 8.6L9 8.2'],
  u:[15,'M2 8L1.8 19Q2 26.4 7.9 23Q11.9 21.4 12.1 16M12.2 8L12.3 24'],
  v:[15,'M1 8L7.2 24L13.3 7.7'],
  w:[21,'M.8 8L5.4 24L10.3 12L15 24L19.2 8'],
  x:[15,'M1.5 8L13 24M12.6 8L1.4 24'],
  y:[15,'M1 8L7.5 23M13.2 7.8L5.8 26.8Q4.6 29.2 1.9 28.9'],
  z:[14,'M1.5 8.3L12.3 8L1.3 23.5L12.7 24'],
  '0':[17,'M8 1Q.7 .3 1.7 13Q2.2 25 8.9 24Q16 23 15.1 11Q14.4 1 8 1ZM4 20L12.5 5'],
  '1':[11,'M1 5L5.7 1L5.4 24M1 24L9 23.7'],
  '2':[17,'M1.4 5Q4.5 -.2 10.4 1.3Q18 4 12.4 10.6L1.6 23.5L15 24'],
  '3':[17,'M1.6 2.9Q13.7 -1.8 14.4 6Q15 11.7 6.8 12M6.8 12Q16.9 11.7 14.9 19.6Q13.5 26.6 1.3 22.7'],
  '4':[18,'M12.4 24L12.8 1L1.1 17.1L16.3 16.8'],
  '5':[17,'M14.9 1.2L2.8 1L1.9 11.9Q13.9 7.7 15 17Q16 26.7 1.2 22.8'],
  '6':[17,'M13.1 1Q2.6 .5 1.4 13.1Q.3 25.5 9.1 24Q17.6 22.3 14.6 15.1Q11.7 9.3 1.7 14.6'],
  '7':[17,'M1 1.2L15.3 1L5.6 24M5.3 12.4L13.2 12'],
  '8':[17,'M8.2 1Q1.4 .6 2.3 6.8Q2.8 11 8.6 12Q16 14 14.8 19.8Q13.7 26 6.5 24Q.1 22.4 1.8 16.9Q2.8 13 8.6 12Q15.5 10.1 14 5.3Q12.9 1.1 8.2 1Z'],
  '9':[17,'M14.8 11.7Q8.4 17.7 3.6 13.8Q-.7 9.5 2.9 3.6Q6.3 -.5 11.4 1.8Q18.8 5.3 13.9 18.3Q11.5 24.1 4.3 24'],
  '&':[22,'M18.8 24L5.9 10.7Q.1 5.2 5.8 1.2Q11.3 -1 12.8 4.2Q14 8.1 6.2 11.7Q-1 15.7 2.9 21.4Q8.6 28.6 15.2 18.7L19.6 11.4'],
  '-':[12,'M1.5 14.3L10.3 14'],
  '_':[16,'M.9 25L14.4 25.2'],
  '.':[7,'M2.6 23L2.8 23.5'],
  ',':[7,'M3.6 22.4Q3.9 25.5 1.7 27.1'],
  ':':[7,'M3 9.3L3.1 9.7M2.8 22.6L3 23.1'],
  ';':[7,'M3 9.3L3.1 9.7M3.4 22Q3.6 25.5 1.4 27'],
  "'":[7,'M3.4 1L2.6 6'],
  '"':[11,'M3.1 1L2.4 6M8.1 1L7.4 6'],
  '(':[10,'M8.3 .6Q-.5 12.1 8 26'],
  ')':[10,'M1.2 .6Q10.5 12.1 1.4 26'],
  '/':[13,'M1.1 26L11.6 .1'],
  '+':[17,'M1.4 13L15 12.7M8.2 5.8L8.4 20.3'],
  '=':[17,'M1.5 9.2L15 9M1.3 17.3L14.8 17'],
  '!':[8,'M3.5 .8L3.1 17.5M3.1 23L3.3 23.5'],
  '?':[16,'M1.2 5Q4.9 -.7 10.1 1.4Q16.9 4.2 11.7 10Q7 12.6 7 17.7M7 23L7.2 23.5'],
  '[':[10,'M8 1L2.2 1.4L2 25L8.2 25'],
  ']':[10,'M1.4 1L7 1.4L7.2 25L1.2 25']
 };
 const advance=ch=>GLYPHS[ch]?GLYPHS[ch][0]:/[\u2E80-\u9FFF\uAC00-\uD7AF\u3040-\u30FF]/u.test(ch)||ch.codePointAt(0)>=0x1F000?25:15;
 const measure=text=>letters(text).reduce((sum,ch)=>sum+advance(ch),0);
 function wordLines(label,count){
  // Lines break at spaces and after a hyphen ("CL Engineering-" / "Lindqvist"), never inside a word here.
  const words=[];
  for(const [i,word] of label.split(' ').entries())word.split(/(?<=-)(?=[^-])/).forEach((part,j)=>words.push({text:part,gap:j?0:i?8:0}));
  if(words.length<count||words.length>192)return null;
  const prefix=[0],dp=Array.from({length:count+1},()=>[]);
  for(const word of words)prefix.push(prefix.at(-1)+word.gap+measure(word.text));
  dp[0][0]={max:0,sum:0,previous:0};
  for(let row=1;row<=count;row++){
   for(let end=row;end<=words.length;end++){
    for(let start=row-1;start<end;start++){
     const before=dp[row-1][start];if(!before)continue;
     const width=prefix[end]-prefix[start]-words[start].gap;
     const candidate={max:Math.max(before.max,width),sum:before.sum+width*width,previous:start};
     const old=dp[row][end];
     if(!old||candidate.max<old.max||candidate.max===old.max&&candidate.sum<old.sum)dp[row][end]=candidate;
    }
   }
  }
  const out=[];let end=words.length;
  for(let row=count;row>0;row--){
   const start=dp[row][end].previous;
   out.unshift({label:words.slice(start,end).map((word,i)=>(i&&word.gap?' ':'')+word.text).join(''),join:start&&words[start].gap?' ':''});end=start;
  }
  return out;
 }
 function wrap(label,count){
  const wholeWords=wordLines(label,count);
  if(wholeWords&&Math.max(...wholeWords.map(line=>measure(line.label)))<=measure(label)/count*1.45)return wholeWords;
  const parts=letters(label),weights=[0],out=[];
  for(const ch of parts)weights.push(weights.at(-1)+advance(ch));
  let start=0,join='';
  count=Math.min(count,parts.length);
  for(let row=0;row<count&&start<parts.length;row++){
   if(row===count-1){out.push({label:parts.slice(start).join(''),join});break;}
   const remaining=count-row,target=(weights.at(-1)-weights[start])/remaining,limit=parts.length-(remaining-1);
   let split=start+1,best=Infinity,space=-1,spaceDistance=Infinity;
   for(let at=start+1;at<=limit;at++){
    const distance=Math.abs(weights[at]-weights[start]-target);
    if(distance<best){best=distance;split=at;}
    if(parts[at]===' '&&distance<spaceDistance){spaceDistance=distance;space=at;}
   }
   // Favor whole words. An unusually long word may break at a grapheme boundary.
   if(space>=0&&spaceDistance<=target*.65)split=space;
   out.push({label:parts.slice(start,split).join('').trim(),join});
   start=split;join='';
   while(parts[start]===' '){start++;join=' ';}
  }
  return out.filter(line=>line.label);
 }
 function layout(value){
  const label=labelOf(value),sizes=[60,52,38,32,26,24],minimum=[54,44,36,30,25,24];
  let lines,fontSize,longest;
  for(let count=1;count<=sizes.length;count++){
   lines=wrap(label,count);fontSize=sizes[count-1];
   longest=Math.max(...lines.map(line=>measure(line.label)));
   const fit=624*24/Math.max(1,longest);
   if(fit>=minimum[count-1]){fontSize=Math.min(fontSize,fit);break;}
  }
  // Extreme labels stay complete as well; the usual course names fit at 38-60 units.
  fontSize=Math.min(fontSize,624*24/Math.max(1,longest));
  const width=Math.max(360,Math.min(720,Math.ceil((longest*fontSize/24+96)/4)*4));
  const top=lines.length>=4?20:44,gap=lines.length>=6?4:lines.length>=4?6:10;
  const height=lines.length*fontSize+(lines.length-1)*gap+fontSize*5/24;
  let y=(top+204-height)/2;
  lines=lines.map(line=>{
   const lineWidth=measure(line.label)*fontSize/24;
   const result={...line,x:(width-lineWidth)/2,y,width:lineWidth};
   y+=fontSize+gap;return result;
  });
  return {label,width,cycle:CYCLE,fontSize,top,lines};
 }
 function info(label){const drawing=layout(label);return {width:drawing.width,cycle:drawing.cycle};}
 function lettering(line,fontSize){
  const chars=letters(line.label),scale=fontSize/24;
  const opening='<g class="rd-generic-line" data-label="'+escape(line.label)+'" data-join="'+escape(line.join)+'" data-font-size="'+n(fontSize)+'" data-line-width="'+n(line.width)+'" transform="translate('+n(line.x)+' '+n(line.y)+')">';
  if(chars.some(ch=>!GLYPHS[ch])){
   // Native font fallback handles every other alphabet without an asset request or lost spelling.
   return opening+'<text x="0" y="'+n(fontSize*.89)+'" fill="'+INK+'" font-family="ui-rounded, &apos;Segoe Print&apos;, &apos;Comic Sans MS&apos;, cursive, sans-serif" font-weight="600" font-size="'+n(fontSize)+'" textLength="'+n(line.width)+'" lengthAdjust="spacingAndGlyphs">'+escape(line.label)+'</text></g>';
  }
  let x=0,paths='';
  for(const ch of chars){
   const glyph=GLYPHS[ch];
   if(glyph[1])paths+='<g transform="translate('+n(x)+' 0)"><path class="rd-generic-glyph" d="'+glyph[1]+'"/></g>';
   x+=glyph[0];
  }
  return opening+'<g class="art-ink" fill="none" stroke="'+INK+'" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" transform="scale('+n(scale)+')">'+paths+'</g></g>';
 }
 function title(label,{id='generic',place='heading',motion=true}={}){
  const d=layout(label),w=d.width,t=d.top,px=w-111;
  const panel='M25 '+n(t+2)+'Q'+n(w*.47)+' '+n(t-1)+' '+n(w-39)+' '+n(t+1)+'Q'+n(w-24)+' '+n(t+2)+' '+n(w-24)+' '+n(t+16)+'L'+n(w-25)+' 189Q'+n(w-25)+' 203 '+n(w-39)+' 204Q'+n(w*.45)+' 207 27 205Q13 204 14 190L15 '+n(t+17)+'Q15 '+n(t+3)+' 25 '+n(t+2)+'Z';
  const ground='<g class="art-ground" data-ground="214"><path fill="'+SAGE+'" opacity=".17" d="M9 211Q'+n(w*.42)+' 207 '+n(w-15)+' 212L'+n(w-9)+' 219Q'+n(w*.52)+' 220 8 217Z"/><path fill="none" stroke="'+INK+'" stroke-width=".85" opacity=".19" d="M7 214Q'+n(w*.52)+' 214.8 '+n(w-8)+' 214"/></g>';
  const paper='<g class="art-head"><path fill="'+PAPER+'" d="'+panel+'"/></g>';
  const wash='<g class="art-wash"><path fill="'+SAGE+'" opacity=".5" d="M27 '+n(t+21)+'L34 '+n(t+20)+'L33 177L26 178Z"/><path fill="'+OCHRE+'" opacity=".4" d="M'+n(w-48)+' '+n(t+2)+'L'+n(w-26)+' '+n(t+22)+'L'+n(w-25)+' '+n(t+16)+'Q'+n(w-24)+' '+n(t+3)+' '+n(w-39)+' '+n(t+1)+'Z"/></g>';
  const outline='<g class="art-ink" fill="none" stroke="'+INK+'" stroke-linecap="round" stroke-linejoin="round"><path stroke-width="1.5" opacity=".78" d="'+panel+'"/><path stroke-width=".85" opacity=".33" d="M34 201Q'+n(w*.46)+' 203 '+n(w-53)+' 201M'+n(w-48)+' '+n(t+3)+'L'+n(w-46)+' '+n(t+20)+'L'+n(w-27)+' '+n(t+22)+'"/><path stroke-width="1.1" opacity=".55" d="M22 '+n(t+15)+'L25 '+n(t+11)+'M22 '+n(t+23)+'L25 '+n(t+19)+'"/></g>';
  const rig=motion===false?'':' class="art-loop" data-loop="keys" data-period="12" data-phase=".14" data-origin="'+n(px+32)+' 206" data-ease="soft" data-keys="0.18:0 -0.4 -0.65 1 1 soft;0.46:0 0.25 0.4 1 1 soft;0.76:;0.9:;"';
  const pencil='<g'+rig+'><g class="art-wash"><path fill="'+CLAY+'" opacity=".85" d="M'+px+' 204L'+n(px+53)+' 203L'+n(px+53)+' 208L'+n(px+1)+' 209Z"/><path fill="'+OCHRE+'" d="M'+n(px+53)+' 203L'+n(px+63)+' 205.6L'+n(px+53)+' 208Z"/></g><g class="art-ink" fill="none" stroke="'+INK+'" stroke-width=".95" stroke-linecap="round" opacity=".72"><path d="M'+px+' 204L'+n(px+53)+' 203L'+n(px+63)+' 205.6L'+n(px+53)+' 208L'+n(px+1)+' 209M'+n(px+53)+' 203L'+n(px+53)+' 208M'+n(px+60)+' 205L'+n(px+63)+' 205.6M'+n(px+6)+' 207L'+n(px+47)+' 206"/></g></g>';
  return '<svg class="rd-art rd-generic-title" data-crop="title" data-place="'+token(place,'heading')+'" data-rd-key="art-'+token(id,'generic')+'-generic-title" data-cycle="'+(motion===false?0:CYCLE)+'" viewBox="0 0 '+w+' 240" preserveAspectRatio="xMinYMax meet" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><title>'+escape(d.label)+'</title><metadata>Original creator: Flzsh. SPDX-License-Identifier: GPL-3.0-only.</metadata>'+ground+paper+wash+outline+d.lines.map(line=>lettering(line,d.fontSize)).join('')+pencil+'</svg>';
 }
 function frame(id){
  // One inset sketch. The duplicate ink path is hidden by the existing reveal CSS, not a second frame.
  const q=(hash(id)%5-2)*.15;
  const edge='M14 '+n(2.3+q)+'C49 1.4 92 2.9 142 2.1S242 1.5 286 2.4Q297.6 2.5 298 12.2C298.6 36 297.8 61 298.2 87.4Q298 97.9 286.4 98C244 98.3 194 97.1 144 97.8S49 98.8 14 98Q2.1 97.6 2 87.2C2.7 62 1.6 38 2.3 12Q2.6 2.1 14 '+n(2.3+q)+'Z';
  return '<span class="rd-frame" data-kind="generic" aria-hidden="true"><span class="rd-frame-stretch"><svg class="rd-frame-svg rd-frame-main" viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path class="rd-frame-edge" vector-effect="non-scaling-stroke" d="'+edge+'"/><path class="rd-frame-retrace" vector-effect="non-scaling-stroke" d="M25 95.5Q47 96.1 73 95.6"/><path class="rd-frame-ink" vector-effect="non-scaling-stroke" d="'+edge+'"/></svg></span></span>';
 }
 const api=Object.freeze({info,title,frame});
 root.ReserveGenericArt=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
