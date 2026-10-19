'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..','extension',file),'utf8');

// Static isolation checks, not a substitute for browser rendering or the route/DOM tests.
// These sheets are linked inside extension shadow roots, never into Canvas's document.
const shadowSheets=['app.css','dashboard.css','workspace.css','refresh.css','subject-art.css','customize.css','settings-dock.css','gpa.css','selection.css','responsive-layout.css','widgets.css','pet.css'];
const globalSheets=['startup.css','startup-art.css','native-page.css','canvas-nav.css'];
const grouping=/^@(media|supports|container|layer|scope|starting-style)\b/i;

// Read punctuation outside strings, comments, functions and attribute selectors. Splitting
// on commas/braces alone would miss list escapes and selectors nested in print/media rules.
function punctuation(css,marks){
 const out=[];let quote='',depth=0;
 for(let i=0;i<css.length;i++){
  const c=css[i];
  if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue;}
  if(c==='/'&&css[i+1]==='*'){const end=css.indexOf('*/',i+2);assert.ok(end>=0,'Unclosed CSS comment');i=end+1;continue;}
  if(c==='"'||c==="'"){quote=c;continue;}
  if(c==='\\'){i++;continue;}
  if(c==='('||c==='[')depth++;
  else if(c===')'||c===']')depth--;
  else if(!depth&&marks.includes(c))out.push({char:c,index:i});
 }
 assert.equal(quote,'','Unclosed CSS string');assert.equal(depth,0,'Unbalanced CSS function/attribute');
 return out;
}
function selectors(prelude){
 const out=[];let start=0;
 for(const {index}of punctuation(prelude,',')){out.push(prelude.slice(start,index).trim());start=index+1;}
 out.push(prelude.slice(start).trim());return out;
}
function stylesheet(css,parents=[],out={rules:[],atRules:[]}){
 const tokens=punctuation(css,'{};');let start=0;
 for(let i=0;i<tokens.length;i++){
  const token=tokens[i],prelude=css.slice(start,token.index).replace(/\/\*[\s\S]*?\*\//g,'').trim();
  assert.notEqual(token.char,'}','Unexpected CSS closing brace');
  if(token.char===';'){
   assert.ok(prelude.startsWith('@'),'Unexpected CSS statement: '+prelude);
   out.atRules.push({prelude,parents});start=token.index+1;continue;
  }
  let depth=1,end=i;
  while(depth&&++end<tokens.length){if(tokens[end].char==='{')depth++;else if(tokens[end].char==='}')depth--;}
  assert.equal(depth,0,'Unclosed CSS rule: '+prelude);
  const body=css.slice(token.index+1,tokens[end].index);
  if(prelude.startsWith('@')){
   out.atRules.push({prelude,parents});
   if(grouping.test(prelude))stylesheet(body,[...parents,prelude],out);
  }else for(const selector of selectors(prelude))out.rules.push({selector,parents,body});
  start=tokens[end].index+1;i=end;
 }
 assert.equal(css.slice(start).replace(/\/\*[\s\S]*?\*\//g,'').trim(),'','Unparsed CSS');
 return out;
}
const nativeGate=/^html(?:\.reserve-native-enabled|:where\(\.reserve-native-enabled\))(?=[\s.#[:>+~]|$)/;
function assertNativeGate(css){
 const parsed=stylesheet(css);
 assert.ok(parsed.rules.length,'Native appearance must have rules to check');
 for(const {selector,parents}of parsed.rules)assert.match(selector,nativeGate,`Native CSS escapes its root opt-in (${parents.join(' > ')||'screen'}): ${selector}`);
 for(const {prelude}of parsed.atRules)assert.match(prelude,grouping,'Native CSS cannot contain an ungated global at-rule: '+prelude);
 return parsed;
}

test('native appearance requires the root opt-in on every selector, including accent and media/print rules',()=>{
 const {rules}=assertNativeGate(read('native-page.css'));
 assert.ok(rules.some(r=>r.selector.includes('[data-reserve-native-accent=clay]')&&!r.selector.includes('[data-reserve-native-theme')),'Accent-only rules must be checked');
 for(const media of ['print','prefers-reduced-motion','hover:hover'])assert.ok(rules.some(r=>r.parents.some(p=>p.includes(media))),media+' rules must be checked');
});

test('the native CSS audit catches list escapes, stale appearance attributes, negated gates and nested print rules',()=>{
 const gated='html:where(.reserve-native-enabled)[data-reserve-native-theme]';
 const safe=`/* html body { color:red } */ ${gated} :is(a,button),${gated} [data-title="a,b"]{content:"};,{"}@media print{@supports (color:color-mix(in srgb,red,blue)){${gated} body{color:black}}}`;
 const parsed=assertNativeGate(safe);assert.equal(parsed.rules.length,3);
 assert.deepEqual(parsed.rules[2].parents,['@media print','@supports (color:color-mix(in srgb,red,blue))']);
 for(const css of [
  `${gated} a,body{color:red}`,
  'html[data-reserve-native-theme=dark] body{color:red}',
  'html[data-reserve-native-accent=clay]{--rp-accent:red}',
  'html:not(.reserve-native-enabled) body{color:red}',
  'html:is(.reserve-native-enabled,html) body{color:red}',
  `@media print{${gated} a{color:green}body{color:red}}`,
  `${gated} body{color:green}@import url("other.css");`,
  `${gated} body{color:green}@page{margin:0}`
 ])assert.throws(()=>assertNativeGate(css),assert.AssertionError,css);
});

test('other document-level sheets require startup state or the explicitly retained global navigation',()=>{
 const scopes={
  'startup.css':/^(?:#reserve-startup-shell(?=[\s.#[:>+~]|$)|html\.reserve-startup-active\s+(?:#reserve-startup-shell|#content|#right-side(?:-wrapper)?)(?=[\s.#[:>+~]|$)|html\.reserve-inline-active\.reserve-fit(?:\s+body)?$)/,
  'startup-art.css':/^(?:html\.reserve-startup-dark\s+)?#reserve-startup-shell(?=[\s.#[:>+~]|$)/,
  'canvas-nav.css':/^html\.chn-nav(?=[\s.#[:>+~]|$)/
 };
 for(const [file,scope]of Object.entries(scopes)){
  const parsed=stylesheet(read(file));assert.ok(parsed.rules.length,file+' must have rules to check');
  for(const {selector,body}of parsed.rules){
   assert.match(selector,scope,file+' can affect vanilla Canvas without its opt-in: '+selector);
   if(file==='canvas-nav.css'){
    const target=selector.match(/\s+(#header|#wrapper|body|\.chn-edge)(?=[\s.#[:>+~]|$)/)?.[1];
    assert.ok(target,'Retained navigation CSS must stay on global chrome: '+selector);
    if(target==='#wrapper'||target==='body'){
     // The drawer/top menu may reserve space, but must not recolor or restyle coursework.
     const allowed=target==='body'?['overflow-x']:['margin-left','margin-top','transition','animation'];
     for(const declaration of body.split(';').filter(s=>s.trim()))assert.ok(allowed.includes(declaration.split(':')[0].trim()),'Navigation changes page appearance: '+selector+' { '+declaration+' }');
    }
   }
  }
  for(const {prelude}of parsed.atRules)assert.ok(grouping.test(prelude)||/^@keyframes (?:reserve-startup-|rsa-|chn-|rd-frame-)[\w-]+$/.test(prelude),file+' has an unscoped global at-rule: '+prelude);
 }
});

test('broad workspace resets and standalone extension-page CSS are never manifest-injected into Canvas',()=>{
 const manifest=JSON.parse(read('manifest.json'));
 const injected=manifest.content_scripts.flatMap(entry=>entry.css||[]);
 for(const file of injected)assert.ok(globalSheets.includes(file),'Document-level CSS needs an isolation audit: '+file);
 for(const file of shadowSheets)assert.ok(!injected.includes(file),file+' has shadow-only rules and must not enter the Canvas document');
 // New dynamically available sheets need an explicit global-gate or shadow-root classification.
 const available=new Set(manifest.web_accessible_resources.flatMap(entry=>entry.resources).filter(file=>file.endsWith('.css')));
 // The PDF reader's two extension-page styles and click-only host stylesheet
 // are restricted to fixed Canvas origins. Do not classify them as normal
 // Canvas document sheets or widen the dynamic wildcard resource exposure.
 const pdfSheets=['pdf-reader.css','pdf-art.css','pdf-host.css'];
 const fixed=manifest.web_accessible_resources.find(entry=>entry.matches?.includes('https://*.instructure.com/*'));
 const dynamic=manifest.web_accessible_resources.find(entry=>entry.matches?.includes('https://*/*'));
 for(const file of available){
  if(pdfSheets.includes(file)){
   assert.ok(!injected.includes(file),'PDF styles may not load into Canvas at rest: '+file);
   assert.ok(fixed?.resources.includes(file),'PDF styles need fixed Canvas origin exposure: '+file);
   assert.ok(!dynamic?.resources.includes(file),'PDF styles must not enter wildcard resources: '+file);
  }else if(file==='course-nav-art.css'){
   // The owner's generated kit is unchanged and loaded only with the guarded
   // course-menu restyle. Its selectors must stay on decorated menu links.
   assert.ok(!injected.includes(file),'Course art must load only after the menu gate');
   const parsed=stylesheet(read(file));
   for(const {selector}of parsed.rules)assert.match(selector,/^\.cn-i(?=[\s.#[:>+~]|$)/);
   for(const {prelude}of parsed.atRules)assert.ok(grouping.test(prelude)||/^@keyframes cn-[\w-]+$/.test(prelude));
  }else assert.ok(globalSheets.includes(file)||shadowSheets.includes(file),'Unclassified page stylesheet: '+file);
 }
 for(const file of ['popup.css','welcome.css','welcome-room.css','ai-panel.css','ai-permission.css']){
  assert.ok(!injected.includes(file)&&!available.has(file),'Standalone page CSS must not be injected into Canvas: '+file);
 }
});

