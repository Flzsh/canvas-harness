/* Canvas Harness — automatic subject presets. Original creator: Flzsh. MIT License. */
(function(root){
 'use strict';
 const data=root.CanvasHarnessSubjectArt||(typeof module==='object'&&module.exports?require('./subject-art-data.js'):{});
 const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/u\.?\s*s\.?\s*(?=history)/g,'us ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const advanced=text=>/\b(?:ap|advanced placement)\b/.test(text);
 function match(value){
  const text=normalize(value);if(!text)return null;
  // Test full words and recognized course codes, never fragments of unrelated words.
  if(/\b(?:apbio|apchem|apphys)(?:\d+)?\b/.test(text))return /\bapbio/.test(text)?'ap-biology':/\bapchem/.test(text)?'ap-chemistry':'ap-physics';
  if(/\b(?:pre\s*calc(?:ulus)?|precalculus|precalc)\b/.test(text))return 'precalculus';
  if(/\b(?:calculus|calc)\b/.test(text))return /\bbc\b/.test(text)?'calculus-bc':'calculus-ab';
  if(/\balgebra\s*(?:2|ii|two)\b/.test(text))return 'algebra2';
  if(/\balgebra\s*(?:1|i|one)\b/.test(text)||/\balgebra\b/.test(text))return 'algebra1';
  if(/\bgeometry\b/.test(text))return 'geometry';
  // History context wins over language names (for example Latin American History).
  if(/\b(?:history|hist|civilization|civilisation|civilizations|civilisations|apush|whap|apeuro)\b/.test(text)){
   if(/\b(?:us|united states|american|apush)\b/.test(text)&&!/\blatin america(?:n)?\b/.test(text))return 'us-history';
   if(/\b(?:eastern|east asian|asian|chinese|japanese|east asia)\b/.test(text))return 'eastern-history';
   if(/\b(?:western|european|europe|apeuro)\b/.test(text))return 'western-history';
   return 'world-history';
  }
  if(/\b(?:chemistry|chem\d*|chm\d*)\b/.test(text))return advanced(text)?'ap-chemistry':'chemistry';
  if(/\b(?:biology|biological|bio\d*|biol\d*)\b/.test(text))return advanced(text)?'ap-biology':'biology';
  if(/\b(?:physics|phys\d*)\b/.test(text))return advanced(text)?'ap-physics':'physics';
  if(/\b(?:latin|lat\d+)\b/.test(text))return 'latin';
  if(/\b(?:spanish|espanol|español|span\d*)\b/.test(text))return 'spanish';
  if(/\b(?:french|francais|français|fren\d*)\b/.test(text))return 'french';
  if(/\b(?:writing|rhetoric)\b/.test(text)||(/\benglish\b/.test(text)&&/\blanguage\b/.test(text)&&!/\bliterature\b/.test(text)))return 'writing';
  if(/\breading\b/.test(text))return 'reading';
  if(/\b(?:english|literature|literary|ela|eng\d+)\b/.test(text))return 'english';
  return null;
 }
 function kind(course){
  if(!course?.id||['all','folio-home'].includes(String(course.id)))return null;
  // Keep the subject when someone gives a course a personal display name.
  for(const value of [course.originalName,course.name,course.code,course.course_code]){const found=match(value);if(found)return found;}
  return null;
 }
 const api={data,kinds:Object.freeze(Object.keys(data)),kind,match,normalize};
 root.ReserveSubjectArt=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
