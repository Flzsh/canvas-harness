'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const filename=path.join(__dirname,'../extension/custom-art.js');
// A missing implementation is an assertion failure, so the initial red run
// proves that the public contract has not already been supplied by another task.
let Art;
function api(){assert.ok(fs.existsSync(filename),'custom-art.js must implement the artwork API');return Art||(Art=require(filename));}
test('cached artwork revalidates changed contents and does not mix motion modes',()=>{
 const art=api(),asset=art.importSVG(art.template('icon'),'mutable.svg');
 const animated=art.render(asset,{motion:true}),still=art.render(asset,{motion:false});
 assert.notEqual(animated,still);assert.equal(art.render({...asset},{motion:true}),animated);
 asset.svg='<svg onload="alert(1)"/>';
 assert.throws(()=>art.render(asset),/event handler/);
});
const svg=body=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`;
function sources(html){
 return [...html.matchAll(/\b(src|srcset)="(data:image\/svg\+xml[^\"]*)"/g)].map(m=>({attribute:m[1],svg:decodeURIComponent(m[2].slice(m[2].indexOf(',')+1))}));
}
function reject(source,pattern=/SVG|CSS|animation|attribute|element|reference|namespace|resource|limit|XML|entity|DTD|export|style/i){
 assert.throws(()=>api().importSVG(source,'bad.svg'),pattern,source.slice(0,140));
}

test('exports the same small API in CommonJS and a browser without dependencies',()=>{
 const art=api();assert.equal(globalThis.ReserveCustomArt,art);
 for(const key of ['cleanAsset','importSVG','render','template'])assert.equal(typeof art[key],'function');
 assert.deepEqual(art.limits,{fileBytes:256*1024,totalBytes:2*1024*1024});
 assert.ok(Object.isFrozen(art.limits));
 const context=vm.createContext({TextEncoder});vm.runInContext(fs.readFileSync(filename,'utf8'),context);
 assert.equal(typeof context.ReserveCustomArt.render,'function');
 assert.equal(context.ReserveCustomArt.importSVG(svg('<circle r="4"/>'),'circle.svg').name,'circle.svg');
});

test('normalizes names and SVG without retaining unknown asset fields',()=>{
 const input={name:'  My art.svg  ',svg:'\ufeff'+svg('<title>A &amp; B</title><circle cx="50" cy="50" r="20"/>'),html:'<script/>'};
 const out=api().cleanAsset(input);
 assert.deepEqual(Object.keys(out),['name','svg']);assert.equal(out.name,'My art.svg');
 assert.match(out.svg,/<title>A &amp; B<\/title>/);assert.ok(out.svg.startsWith('<svg'));
 assert.deepEqual(api().cleanAsset(out),out);assert.equal(input.name,'  My art.svg  ');
 assert.equal(api().cleanAsset(null),null);assert.equal(api().render(null),'');
 assert.equal(api().importSVG('<svg><path d="M0 0L10 10"/></svg>').name,'Custom artwork.svg');
 assert.match(api().importSVG('<svg/>').svg,/xmlns="http:\/\/www.w3.org\/2000\/svg"/);
 for(const bad of [false,42,'<svg/>',[],{svg:4},{svg:''},{name:42,svg:'<svg/>'}])assert.throws(()=>api().cleanAsset(bad),/SVG|asset|name/i);
});

test('checks raw UTF-8 bytes at the boundary, not UTF-16 character count',()=>{
 const limit=api().limits.fileBytes,start='<svg xmlns="http://www.w3.org/2000/svg"><desc>',end='</desc></svg>';
 const source=start+' '.repeat(limit-Buffer.byteLength(start+end))+end;
 assert.equal(Buffer.byteLength(source),limit);assert.ok(api().importSVG(source));
 reject(source+' ',/256|262144|KiB|size|large|limit/i);
 reject(start+'界'.repeat(Math.ceil(limit/3))+end,/256|262144|KiB|size|large|limit/i);
 reject(svg('<desc>'+'x'.repeat(limit)+'</desc>'),/256|262144|KiB|size|large|limit/i);
});

test('rejects malformed XML instead of relying on a forgiving HTML parser',()=>{
 for(const source of ['', 'hello', '<html/>','<SVG/>','<svg>','<svg><g></svg>','<svg/><svg/>','<svg/>trailing',
  '<svg><rect></circle></svg>','<svg width=10/>','<svg width="10"width="20"/>','<svg width="10" width="20"/>',
  '<svg><g/ ></svg>','<svg><!oops></svg>','<svg><!-- bad -- comment --></svg>','<svg><desc>&missing;</desc></svg>',
  '<svg><desc>&#0;</desc></svg>','<svg><desc>&#xD800;</desc></svg>','<svg><desc>&#x110000;</desc></svg>',
  '<svg><desc>&#X41;</desc></svg>','<svg><desc>&amp</desc></svg>','<svg><desc>]]></desc></svg>',
  '<svg><desc>\u0000</desc></svg>','<svg><desc>\ud800</desc></svg>','<svg><desc>\ufffe</desc></svg>',
  '<svg><style><g/></style></svg>','<svg viewBox="0 0 -2 10"/>','<svg viewBox="0 0 NaN 10"/>',
  '<svg viewBox="0 0 10"/>','<svg><path d="not a path"/></svg>'])reject(source);
});

test('permits plain XML declarations, comments, CDATA and predefined character references',()=>{
 const out=api().importSVG('<?xml version="1.0" encoding="UTF-8"?>\n<!-- export --><svg><title>&lt;art&gt; &#65; &#x1F33F;</title><style><![CDATA[.a{fill:#123456}]]></style><path class="a" d="M0 0L10 0L5 10Z"/></svg>');
 assert.match(out.svg,/&lt;art&gt; A 🌿/);assert.doesNotMatch(out.svg,/\?xml|<!--|CDATA/);
 reject('<?xml version="1.1"?><svg/>');reject('<?xml version="1.0" encoding="ISO-8859-1"?><svg/>');
});

test('rejects DTDs, entity declarations, processing instructions and namespace changes',()=>{
 for(const source of ['<!DOCTYPE svg><svg/>','<!DOCTYPE svg [<!ENTITY x "hello">]><svg><desc>&x;</desc></svg>',
  '<!DOCTYPE svg SYSTEM "https://example.invalid/a.dtd"><svg/>','<!ENTITY x SYSTEM "file:///secret"><svg/>',
  '<?xml-stylesheet href="https://example.invalid/a.css"?><svg/>','<svg><?xml-stylesheet href="x"?></svg>',
  '<svg xmlns="http://www.w3.org/1999/xhtml"/>','<svg><g xmlns="http://www.w3.org/1999/xhtml"/></svg>',
  '<s:svg xmlns:s="http://www.w3.org/2000/svg"/>','<svg xmlns:q="https://example.invalid"><q:script/></svg>',
  '<svg xmlns:xlink="https://example.invalid"/>','<svg xml:base="https://example.invalid/"/>'])reject(source);
});

test('rejects active markup, event handlers and resource-bearing elements',()=>{
 for(const body of ['<script>alert(1)</script>','<script href="#x"/>','<foreignObject><div/></foreignObject>',
  '<a href="https://example.invalid"><rect/></a>','<iframe/>','<object/>','<embed/>','<handler/>',
  '<image href="https://example.invalid/pixel"/>','<image href="data:image/svg+xml,%3Csvg/%3E"/>',
  '<feImage href="https://example.invalid/pixel"/>','<style href="https://example.invalid/a.css"/>',
  '<g onload="alert(1)"/>','<g OnClIcK="alert(1)"/>','<g onbegin="alert(1)"/>',
  '<g onclick = "&#97;lert(1)"/>','<g href="https://example.invalid/"/>','<g unknown="value"/>'])reject(svg(body));
});

test('rejects external, encoded and rebased references including CSS variables',()=>{
 for(const target of ['https://example.invalid/a.svg#x','//example.invalid/x','javascript:alert(1)',
  'data:image/svg+xml,%3Csvg/%3E','file:///tmp/x','blob:abc','other.svg#x','&#104;ttps://example.invalid/x',
  '#x%22',' #x '])reject(svg(`<defs><path id="x" d="M0 0L1 1"/></defs><use href="${target}"/>`));
 for(const declaration of ['fill:url(https://example.invalid/x)','fill:url(//example.invalid/x)',
  'fill:url("data:image/svg+xml,bad")','fill:u\\72l(https://example.invalid/x)',
  'fill:u/**/rl(https://example.invalid/x)','fill:URL(https://example.invalid/x)',
  '--paint:url(https://example.invalid/x);fill:var(--paint)',
  'background-image:image-set("https://example.invalid/x" 1x)','fill:src("https://example.invalid/x")',
  'fill:expression(alert(1))','behavior:url(#x)','-moz-binding:url(#x)',
  'fill:var(--paint);--paint:attr(data-secret url)','fill:url(&#104;ttps://example.invalid/x)']){
  reject(svg(`<style>.a{${declaration}}</style><rect class="a"/>`));
 }
 for(const css of ['@import "https://example.invalid/a.css";', '@import/**/url(https://example.invalid/a.css);',
  '@font-face{font-family:x;src:url(https://example.invalid/a.woff)}', '@namespace x "https://example.invalid/";',
  '@\\69mport "https://example.invalid/a.css";','.a{fill:red}/* unclosed','.a{fill:red','.a{fill:red}}',
  '.a{fill:red;animation:spin 1s;}.b{fill:url(#missing)}'])reject(svg(`<style>${css}</style>`));
});

test('preserves self-contained gradients, local references, filters, CSS and SMIL',()=>{
 const source=svg(`<defs><linearGradient id="paint"><stop offset="0" stop-color="#123456"/><stop offset="1" stop-color="#abcdef"/></linearGradient><path id="shape" d="M0 0L10 0L5 10Z"/><filter id="blur"><feGaussianBlur stdDeviation="1"/></filter></defs>
 <style>/* note */:root{--ink:#abcdef}.drift{fill:url('#paint');animation:float 4s ease-in-out infinite;transform-origin:50% 50%}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@media (prefers-color-scheme: dark){.drift{opacity:.8}}</style>
 <g class="drift" filter="url(#blur)"><use href="#shape"/><circle cx="50" cy="50" r="10"><animate id="pulse" attributeName="r" values="10;12;10" dur="4s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="8s" repeatCount="indefinite"/></circle></g>`);
 const out=api().importSVG(source,'animated.svg');
 for(const pattern of [/@keyframes float/,/animation:float/,/<animate /,/<animateTransform /,/href="#shape"/,/url\('#paint'\)/,/<feGaussianBlur/])assert.match(out.svg,pattern);
 assert.deepEqual(api().cleanAsset(out),out);
 const xlink=api().importSVG('<svg xmlns:xlink="http://www.w3.org/1999/xlink"><defs><path id="p" d="M0 0L1 1"/></defs><use xlink:href="#p"/></svg>');
 assert.match(xlink.svg,/href="#p"/);
});

test('limits animation targets and values so SMIL cannot change navigation or executable attributes',()=>{
 for(const body of ['<set attributeName="href" to="https://example.invalid/"/>',
  '<animate attributeName="xlink:href" values="#x;https://example.invalid/"/>',
  '<animate attributeName="onload" to="alert(1)"/>','<animate attributeName="style" to="fill:red"/>',
  '<animate attributeName="attributeName" to="href"/>','<animate attributeName="id" to="x"/>',
  '<animate attributeName="fill" values="red;url(https://example.invalid/pixel)" dur="1s"/>',
  '<animate attributeName="opacity" values="0;1" begin="click" dur="1s"/>',
  '<animateTransform attributeName="href" type="translate" to="0 1" dur="1s"/>',
  '<animate attributeName="opacity" to="1" href="https://example.invalid/#x"/>'])reject(svg(body));
});

test('rejects duplicate, unresolved, recursive and excessively expanded references',()=>{
 for(const body of ['<g id="x"/><g id="x"/>','<use href="#missing"/>',
  '<g id="x"><use href="#x"/></g>',
  '<defs><g id="a"><use href="#b"/></g><g id="b"><use href="#a"/></g></defs><use href="#a"/>',
  '<linearGradient id="g" href="#g"/>'])reject(svg(body));
 let body='<defs><g id="p0"><path d="M0 0L1 1"/></g>';
 for(let i=1;i<=18;i++)body+=`<g id="p${i}"><use href="#p${i-1}"/><use href="#p${i-1}"/></g>`;
 reject(svg(body+'</defs><use href="#p18"/>'));
 reject(svg('<g>'.repeat(100)+'<path d="M0 0L1 1"/>'+'</g>'.repeat(100)));
 reject(svg('<path d="M0 0L1 1"/>'.repeat(6000)));
});

test('renders escaped decorative image markup without inline SVG or active containers',()=>{
 const asset=api().importSVG(svg('<title>&quot;&lt;script&gt;</title><rect width="10" height="10"/>'),'" onload="bad');
 const html=api().render(asset,{kind:'icon',className:'hello" onclick="bad<>&',fit:'contain',position:'right'});
 assert.match(html,/<picture\b/);assert.match(html,/<img\b/);assert.match(html,/alt=""/);assert.match(html,/aria-hidden="true"/);
 assert.doesNotMatch(html,/<svg\b|<script\b|<iframe\b|<object\b|<embed\b|\bonload="|\bonclick="/i);
 assert.match(html,/hello&quot; onclick=&quot;bad&lt;&gt;&amp;/);
 assert.match(html,/object-fit:contain/);assert.match(html,/object-position:right center/);
 const urls=sources(html);assert.equal(urls.length,2);assert.ok(urls.every(x=>x.svg.startsWith('<svg')));
 assert.ok(urls.every(x=>x.svg.includes('preserveAspectRatio="xMaxYMid meet"')));
 for(const options of [{kind:'iframe'},{fit:'cover;display:none'},{position:'url(x)'},{motion:'yes'},{className:{}}])assert.throws(()=>api().render(asset,options),/kind|fit|position|motion|className|options/i);
 assert.throws(()=>api().render({name:'bad',svg:svg('<script/>')}),/SVG|script|element/i,'render must revalidate stored assets');
});

test('reduced motion uses an actually static SVG with base artwork still present',()=>{
 const asset=api().importSVG(svg(`<style>.shape{fill:#123456;animation:spin 2s infinite!important;transition:all 1s}@keyframes spin{to{transform:rotate(360deg)}}@media (min-width:1px){.shape{animation-name:spin}}</style><rect class="shape" width="10" height="10" style="opacity:.8;-webkit-animation:spin 2s infinite!important;animation:spin 1s!important"><animate attributeName="opacity" values=".2;1" dur="1s" repeatCount="indefinite"/><set attributeName="fill" to="red" begin="0s"/><animateMotion path="M0 0L10 10" dur="1s"/></rect>`));
 const html=api().render(asset);assert.match(html,/<source[^>]+media="\(prefers-reduced-motion: reduce\)"/);
 const images=sources(html),still=images.find(x=>x.attribute==='srcset').svg,animated=images.find(x=>x.attribute==='src').svg;
 assert.match(animated,/<animate /);assert.match(animated,/@keyframes/);assert.match(animated,/animation:spin/);
 assert.doesNotMatch(still,/<(?:animate\w*|set)\b|@(?:-webkit-)?keyframes|animation(?:-name)?:spin|transition:all/i);
 assert.match(still,/<rect\b/);assert.match(still,/fill:#123456/);assert.match(still,/opacity:.8/);
 assert.match(still,/animation:none!important/);
 assert.deepEqual(api().cleanAsset(asset),asset,'render does not overwrite stored animated artwork');
 const disabled=api().render(asset,{motion:false});assert.doesNotMatch(disabled,/<source\b/);
 assert.equal(sources(disabled).length,1);assert.doesNotMatch(sources(disabled)[0].svg,/<(?:animate\w*|set)\b|@(?:-webkit-)?keyframes|animation:spin/i);
});

test('all three templates import, animate, render and provide a visible static baseline',()=>{
 for(const kind of ['banner','border','icon']){
  const source=api().template(kind),asset=api().importSVG(source,`${kind}.svg`);
  assert.match(source,/<svg\b/);assert.match(source,/@keyframes|<animate/);
  const html=api().render(asset,{kind}),still=api().render(asset,{kind,motion:false});
  assert.equal(sources(html).length,2);assert.equal(sources(still).length,1);
  assert.match(sources(still)[0].svg,/<(?:path|rect|circle|ellipse)\b/);
  assert.doesNotMatch(sources(still)[0].svg,/<(?:animate\w*|set)\b|@keyframes/);
 }
 assert.throws(()=>api().template('unknown'),/kind|banner|border|icon/i);
});

test('comment-obfuscated CSS URLs still require real local targets',()=>{
 for(const declaration of [
  'fill:ur/**/l(#missing)',
  'fill:ur/**/l("https://example.invalid/a.svg")',
  'fill:U/**/RL(#missing)',
  'fill:ur/**/l(#x%22)',
  '--a:ur/**/l(#missing)',
  'fill:ur\\6c(#missing)',
  'fill:var(--missing)',
  'fill:image-set(url(#missing) 1x)'
 ])reject(svg(`<style>.item{${declaration}}</style><circle class="item" r="2"/>`));
 const good=api().importSVG(svg('<defs><linearGradient id="ink"><stop offset="0" stop-color="#fff"/></linearGradient></defs><style>.item{fill:ur/**/l(#ink)}</style><circle class="item" r="2"/>'));
 assert.match(good.svg,/fill:url\(#ink\)/,'CSS comments must not hide a URL reference from validation');
});

test('referenced elements must have compatible kinds, including inherited paint servers',()=>{
 for(const body of [
  '<style id="rules">.x{fill:red}</style><use href="#rules"/>',
  '<defs><linearGradient id="paint"/></defs><use href="#paint"/>',
  '<defs><path id="p" d="M0 0L1 1"/></defs><linearGradient href="#p"/>',
  '<defs><rect id="r" width="2" height="2"/></defs><text><textPath href="#r">a</textPath></text>',
  '<defs><pattern id="p" width="2" height="2"/></defs><linearGradient href="#p"/>'
 ])reject(svg(body));
 assert.ok(api().importSVG(svg('<defs><g id="petal"><circle r="3"/></g></defs><use href="#petal"/>')));
});

test('limits pathological filter numeric values without blocking modest effects',()=>{
 for(const body of [
  '<filter id="f"><feTurbulence numOctaves="9999999"/></filter>',
  '<filter id="f"><feGaussianBlur stdDeviation="10000000"/></filter>',
  '<circle cx="1e300" cy="1" r="2"/>',
  '<filter id="f"><feTurbulence baseFrequency="100000000"/></filter>'
 ])reject(svg(body));
 assert.ok(api().importSVG(svg('<filter id="f"><feGaussianBlur stdDeviation="2"/></filter><circle r="10" filter="url(#f)"/>')));
});

test('stored SVG stays within the upload limit after canonical XML serialization',()=>{
 const source='<svg>'+('<path d="M0 0L1 1"/>'.repeat(4000))+'<desc>'+(' '.repeat(262144-'<svg></svg><desc></desc>'.length-4000*'<path d="M0 0L1 1"/>'.length))+'</desc></svg>';
 assert.equal(Buffer.byteLength(source),api().limits.fileBytes);
 let art;
 try{art=api().importSVG(source,'near-limit.svg');}
 catch(e){assert.match(String(e),/SVG.*(?:256|limit|size|large)/i);return;}
 assert.ok(Buffer.byteLength(art.svg)<=api().limits.fileBytes);
 assert.deepEqual(api().cleanAsset(art),art);
});

test('render never alters a supplied asset, and emitted URLs have no executable XML',()=>{
 const original=api().importSVG(svg('<style>.a{animation:p 1s infinite}@keyframes p{to{opacity:.1}}</style><circle class="a" r="5"/>'));
 const before=structuredClone(original);
 for(const options of [{kind:'banner',motion:false},{kind:'border',fit:'fill',position:'left'},{kind:'icon',motion:true}]){
  const html=api().render(original,options),urls=sources(html);
  assert.ok(urls.length>=1);assert.ok(urls.every(x=>!/<(?:script|foreignObject|iframe|object)\b/i.test(x.svg)));
  assert.doesNotMatch(html,/<svg\b|\bonload=|\bonclick=/i);
 }
 assert.deepEqual(original,before);
});
