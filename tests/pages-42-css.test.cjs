// pages-42: the drawn look of Materials and Messages (refresh.css, the "pages-42" section and its two later rules).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const css=fs.readFileSync(require.resolve('../extension/refresh.css'),'utf8');
const start=css.indexOf('/* ----------------------------------------------------------------- pages-42: Materials and Messages, drawn');
const block=css.slice(start);
const rule=selector=>{const at=css.indexOf(selector+' {');assert.ok(at>=0,'missing rule: '+selector);return css.slice(at,css.indexOf('}',at)+1);};

test('the kraft tag is the punched study tag\'s own drawing (no new art), and its ink stays dark on its paper in every light look',()=>{
 assert.ok(start>0,'the section is there');
 assert.match(css,/\.rd \.rd-study-tag::before, \.rd \.rd-help-tag::before, \.rd \.rd-file-tag::before \{ background: var\(--tag-wash\); translate: 1\.1px 1\.3px; -webkit-mask-box-image: url\(/,'the offset wash');
 assert.match(css,/\.rd \.rd-study-tag::after, \.rd \.rd-help-tag::after, \.rd \.rd-file-tag::after \{ background: var\(--rd-ink\); -webkit-mask-box-image: url\(/,'the ink outline');
 assert.match(css,/\.rd\[data-theme=dark\] \.rd-study-tag::after, \.rd\[data-theme=dark\] \.rd-help-tag::after, \.rd\[data-theme=dark\] \.rd-file-tag::after \{ background: #D2C8B2; \}/);
 assert.match(rule('.rd:not([data-theme=dark]) .rd-file-tag'),/color: #2B2A27/);assert.match(rule('.rd:not([data-theme=dark]) .rd-file-tag::after'),/background: #2B2A27/);
 for(const paper of ['slides','sheet','media','link','page','locked'])assert.match(block,new RegExp(`\\.rd \\.rd-file-tag\\[data-paper=${paper}\\]`),paper);
 assert.match(rule('.rd .rd-file-tag[data-paper=locked]::before'),/repeating-linear-gradient\(-45deg/,'a locked item is hatched');
});

test('nothing a student reads is under 11px; no automatic dark mode (the :is() subjects are checked by scripts/css-subjects.cjs --check)',()=>{
 for(const m of block.matchAll(/font(?:-size)?:\s*(?:\d+\s+)?(\d+(?:\.\d+)?)px/g))assert.ok(+m[1]>=11,'font size '+m[1]+'px in: '+block.slice(Math.max(0,m.index-80),m.index+20));
 assert.doesNotMatch(block,/prefers-color-scheme/);
});

test('the drawn sheets: a pen line and the course colour as the offset wash, for the shelf, its page reader and the conversation',()=>{
 assert.match(rule('.rd .rd-materials .rd-material-list.rd-shelf-sheet, .rd .rd-materials .rd-material-page'),/border-image: var\(--rd-pen-soft\) 30 \/ 13px \/ 0 stretch;[\s\S]*box-shadow: 4px 5px 0 color-mix\(in srgb, var\(--rd-course, var\(--rd-accent\)\) 24%, transparent\)/);
 assert.match(rule('.rd .rd-thread-pane'),/position: sticky; top: 0;[\s\S]*border-image: var\(--rd-pen-line\) 30 \/ 14px \/ 0 stretch;[\s\S]*box-shadow: 4px 5px 0 color-mix/);
 assert.match(rule('.rd .rd-thread-head'),/position: sticky; top: 0;/,'Reply in Canvas stays in view while the thread scrolls');
});

test('Messages: two columns from an 820px work area; narrower, an open conversation takes the list\'s place with the way back',()=>{
 assert.match(block,/@container work-area \(min-width: 820px\) \{ \.rd \.rd-post-columns \{ grid-template-columns: minmax\(300px, \.92fr\) minmax\(0, 1\.22fr\);/);
 const narrow=block.slice(block.indexOf('@container work-area (max-width: 819.98px)'));
 assert.match(narrow,/\.rd \.rd-inbox\[data-open=true\] \.rd-post-list \{ display: none; \}/);assert.match(narrow,/\.rd \.rd-thread-back \{ display: inline-flex; \}/);
 assert.match(rule('.rd .rd-thread-back'),/display: none;/,'wide: no way back needed, the list stays');
 assert.match(css,/\.rd \.rd-post-row:not\(\[style\]\), \.rd \.rd-post-group:not\(\[style\]\), \.rd \.rd-thread-pane:not\(\[style\]\) \{ --rd-course: initial; --rd-course-ink: initial; \}/,'a message with no course never borrows the page\'s course');
});

test('Materials rows: two lines (tag | title, day | kind, where, controls); the spread never breaks a row; a narrow list drops where it lives',()=>{
 assert.match(rule('.rd .rd-shelf-row:not(.rd-chapter-row)'),/display: grid; grid-template-columns: 80px minmax\(0, 1fr\) auto auto;/);
 assert.match(rule('.rd .rd-materials .rd-chapter-flow .rd-shelf-row, .rd .rd-materials .rd-chapter-flow > .rd-shelf-group'),/break-inside: avoid/);
 assert.match(block,/@container material-list \(max-width: 620px\) \{[\s\S]*?\.rd \.rd-shelf-row \.rd-row-where, \.rd \.rd-shelf-row \.rd-row-kind > span\[aria-hidden\]:has\(\+ \.rd-row-where\) \{ display: none; \}/);
});

test('motion: new rows, groups, letters and an opened conversation fade where they rest; keyboard use is immediate',()=>{
 assert.match(block,/\.rd \.rd-thread-pane, \.rd \.rd-letter, \.rd \.rd-post-row, \.rd \.rd-post-group \{ animation: rd-fade 190ms var\(--rd-fade\) backwards; \}/);
 assert.match(block,/\.rd\[data-kb\] \.rd-thread-pane, \.rd\[data-kb\] \.rd-letter, \.rd\[data-kb\] \.rd-post-row, \.rd\[data-kb\] \.rd-post-group \{ animation: none !important; \}/);
 assert.doesNotMatch(block,/transition:[^;]*(?:width|height|top|left|margin)/,'nothing animates layout');
});
