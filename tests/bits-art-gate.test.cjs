'use strict';
// review-42b, finding 1 (2026-11-22): scripts/bits-art.cjs check() is the only gate between a dropped-in art/bits/<slot>.svg
// and markup dashboard-view.js puts into Canvas pages with innerHTML (home-bits.js icon() / scene()). The review's
// reproductions (work/review-42b/tests/bits-art-gate.test.cjs) each PASSED the old block-list; here every one of them, and
// more of the same family, must be REFUSED by the allow-list. And the real drawings the slots fall back to must still pass,
// written again exactly as they are.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Bits=require('../extension/home-bits.js'),Art=require('../scripts/bits-art.cjs');
const extension=path.join(__dirname,'..','extension'),art=path.join(__dirname,'..','art');
const icon=inner=>`<svg viewBox="0 0 40 40">${inner}</svg>`;

// the review's eight cases, word for word
const REVIEW=[
 ['handler glued to a quoted value',icon('<path d="M0 0"onclick="alert(1)"/>')],
 ['handler after a slash',icon('<animate/onbegin=alert(1) attributeName=x dur=1s />')],
 ['html img breakout with onerror',icon('<img src="x"onerror="alert(document.domain)">')],
 ['early </svg> then HTML',icon('<g/></svg><b>outside the drawing</b><svg>')],
 ['remote fetch via feImage, unquoted href',icon('<filter id="f"><feImage href=https://example.invalid/p.png /></filter><rect width="40" height="40" filter="url(#f)"/>')],
 ['remote fetch via escaped url() in <style>',icon('<style>body{background:u\\72l(https://example.invalid/t.png)}</style>')],
 ['remote fetch via image-set()',icon('<style>body{background-image:image-set("https://example.invalid/t.png" 1x)}</style>')]
];
for(const [name,svg] of REVIEW)test(`the gate refuses: ${name}`,()=>{
 assert.throws(()=>Art.check('ctl-undo-move.svg',svg,Bits.SLOTS),/^Error: art\/bits\/ctl-undo-move\.svg: /);
});
test('the gate refuses the same in a greeting scene (inline, right under the Home heading)',()=>{
 assert.throws(()=>Art.check('greet-morning.svg','<svg viewBox="0 0 960 240"><path d="M0 0"onmouseover="alert(1)"/></svg>',Bits.SLOTS),/separated by whitespace/);
});

// more of the same family: every way a handler, a script or an outside fetch could ride in
const MORE=[
 ['a spaced handler',icon('<path d="M0 0" onclick="alert(1)"/>'),/event attributes/],
 ['an upper-case handler',icon('<path d="M0 0" ONCLICK="alert(1)"/>'),/event attributes/],
 ['a handler on the root',`<svg viewBox="0 0 40 40" onload="alert(1)"><path d="M0 0"/></svg>`,/event attributes/],
 ['a script element',icon('<script>alert(1)</script>'),/<script> is not allowed/],
 ['an upper-case script element',icon('<SCRIPT>alert(1)</SCRIPT>'),/<SCRIPT> is not allowed/],
 ['a prefixed script element',icon('<svg:script>alert(1)</svg:script>'),/not allowed/],
 ['a style element',icon('<style>path{fill:red}</style>'),/<style> is not allowed/],
 ['a style attribute',icon('<path d="M0 0" style="fill:url(https://example.invalid/x)"/>'),/no style attribute/],
 ['foreignObject',icon('<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>'),/<foreignObject> is not allowed/],
 ['an image',icon('<image href="#x"/>'),/<image> is not allowed/],
 ['a link',icon('<a href="#x"><path d="M0 0"/></a>'),/<a> is not allowed/],
 ['a nested svg',icon('<svg onload="alert(1)"/>'),/not allowed/],
 ['an animation that sets an href',icon('<set attributeName="href" to="javascript:alert(1)"/>'),/<set> is not allowed/],
 ['use pointing outside',icon('<use href="https://example.invalid/s.svg#a"/>'),/href only to an id/],
 ['use through xlink pointing at data:',icon('<use xlink:href="data:image/svg+xml,x"/>'),/href only to an id/],
 ['an href spelled with character references',icon('<use href="&#106;avascript:alert(1)"/>'),/href only to an id/],
 ['an href on an element that takes none',icon('<path href="#a" d="M0 0"/>'),/no href on <path>/],
 ['url() to another host in a paint',icon('<path d="M0 0" fill="url(https://example.invalid/x)"/>'),/url\(\) only to an id/],
 ['url() quoted to another host',icon('<rect width="4" height="4" filter="url(\'https://example.invalid/f\')"/>'),/url\(\) only to an id/],
 ['a CSS escape in a presentation attribute',icon('<path d="M0 0" fill="u\\72l(https://example.invalid/x)"/>'),/backslash/],
 ['image-set in a paint',icon('<path d="M0 0" fill="image-set(&quot;https://example.invalid/x&quot; 1x)"/>'),/not an allowed value/],
 ['an unquoted attribute',icon('<path d=M0 />'),/must be quoted/],
 ['a duplicated attribute',icon('<path d="M0 0" d="M1 1"/>'),/given twice/],
 ['a DOCTYPE with entities','<!DOCTYPE svg [<!ENTITY x "&#60;script&#62;">]><svg viewBox="0 0 40 40">&x;</svg>',/DOCTYPE/],
 ['CDATA',icon('<![CDATA[<script>alert(1)</script>]]>'),/CDATA/],
 ['text outside a text element',icon('hello <b>there</b>'),/text outside|not allowed/],
 ['a stray closing tag',icon('<g></path></g>'),/closes <g>/],
 ['an unknown attribute',icon('<path d="M0 0" formaction="x"/>'),/not allowed/],
 ['a data attribute carrying markup',icon('<path d="M0 0" data-x="&lt;img src=x onerror=alert(1)&gt;"/>'),/data attribute may not/]
];
for(const [name,svg,why] of MORE)test(`the gate also refuses: ${name}`,()=>{
 assert.throws(()=>Art.check('ctl-undo-move.svg',svg,Bits.SLOTS),why);
});

test('what passes is written again from the parsed drawing, never the original text',()=>{
 const out=Art.check('ctl-edit-home.svg','<?xml version="1.0"?>\n<!-- editor note -->\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor">\n <title>Edit</title><metadata><rdf/></metadata>\n <path inkscape:label="tiles" d="M4 4h12v12H4z" fill=\'#E2B865\'/>\n <use xlink:href="#t" x="2"/>\n</svg>\n',Bits.SLOTS);
 assert.equal(out.inner,'<g fill="none" stroke="currentColor"><path d="M4 4h12v12H4z" fill="#E2B865"/>\n <use href="#t" x="2"/></g>');
 // a frame slot (a data: image in CSS) is written again whole, with its own namespace
 const frame=Art.check('chip-new.svg',"<svg viewBox='0 0 60 22' width='60'><path d='M1 1H59V21H1Z' fill='url(#w)'/><defs><linearGradient id='w'><stop offset='0' stop-color='#EBDBBC'/></linearGradient></defs></svg>",Bits.SLOTS);
 assert.equal(frame.svg,'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 22"><path d="M1 1H59V21H1Z" fill="url(#w)"/><defs><linearGradient id="w"><stop offset="0" stop-color="#EBDBBC"/></linearGradient></defs></svg>');
 // values are escaped again on the way out
 assert.equal(Art.check('ctl-edit-home.svg','<svg viewBox="0 0 40 40"><text x="2" y="20">a &lt; b &amp; c</text></svg>',Bits.SLOTS).inner,'<text x="2" y="20">a &lt; b &amp; c</text>');
});

// ---- the real art: every drawing a slot falls back to (and every course drawing) passes, written again unchanged ----
const innerOf=text=>text.replace(/<!--[\s\S]*?-->/g,'').trim().replace(/^<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,'').trim();
test('the controls’ fallbacks pass unchanged: the feature drawings, the top bar’s refresh arrow, the module glyph',()=>{
 require('../extension/addons-art.js');const icons=globalThis.ReserveAddonsArt.icons;
 for(const [key,svg] of Object.entries(icons))assert.equal(Art.sanitize(svg).inner,svg.replace(/^<svg\b[^>]*>/,'').replace(/<\/svg>$/,''),key);
 const view=fs.readFileSync(path.join(extension,'dashboard-view.js'),'utf8'),refresh=view.match(/refresh:'([^']*)'/)[1],arrow=refresh.match(/^(?:<path\b[^>]*\/>){2}/)[0];
 assert.equal(Art.check('ctl-undo-move.svg',`<svg viewBox="0 0 40 40">${arrow}</svg>`,Bits.SLOTS).inner,arrow);
 const widgets=fs.readFileSync(path.join(extension,'widgets.js'),'utf8'),context=widgets.match(/context:'([^']*)'/)[1];
 assert.equal(Art.sanitize(`<svg class="rd-widget-glyph" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${context}</svg>`).inner,
  `<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${context}</g>`,'the root’s ink is kept round the drawing');
});
test('the frames’ fallbacks pass: the punched tag and the soft pen edge from refresh.css',()=>{
 const css=fs.readFileSync(path.join(extension,'refresh.css'),'utf8');
 const tags=[...css.matchAll(/url\("data:image\/svg\+xml,(%3Csvg%20xmlns%3D%27http[^"]*)"\)/g)].map(m=>decodeURIComponent(m[1])).filter(s=>/viewBox='0 0 60 22'/.test(s));
 assert.ok(tags.length>=2,'the tag and its outline');
 for(const tag of tags){const out=Art.check('chip-today.svg',tag,Bits.SLOTS);assert.equal(out.svg,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 22">${innerOf(tag).replace(/'/g,'"')}</svg>`);}
 const pen=decodeURIComponent(css.match(/--rd-pen-soft: url\("data:image\/svg\+xml,([^"]*)"\)/)[1]);
 assert.equal(Art.sanitize(pen).inner,innerOf(pen).replace(/'/g,'"'));
});
