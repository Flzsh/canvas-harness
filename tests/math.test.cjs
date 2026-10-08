const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../extension/math.js');
// Mathematics in teacher text (Canvas Harness 2.17.2). The student showed an assignment whose description displayed raw
// LaTeX and wrote: "you should support format like latex form, or other possible format so it does not look weird".
// extension/math.js turns TeX into MathML (which Chromium renders), safely and without a network or a font;
// ui-utils.js safeRichHTML calls it for text nodes, Canvas equation images and MathML already in the HTML.
const T=String.raw;
const DOT=T`\mathbf{a}\cdot \mathbf{b} = ||\mathbf{a}||\,||\mathbf{b}|| \cos\theta`,PROJ=T`\mathrm{proj}_{\mathbf{b}}\mathbf{a}`,TRIPLE=T`\mathbf{a} \cdot \left(\mathbf{b} \times \mathbf{c}\right)`;
const tags=markup=>[...new Set([...markup.matchAll(/<([a-z-]+)/g)].map(m=>m[1]))].sort();
const attrs=markup=>[...new Set([...markup.matchAll(/ ([a-z-]+)="/g)].map(m=>m[1]))].sort();

test('the student\'s three expressions become MathML: bold upright vectors, the dot, norms, a named function, a subscript, stretchy brackets',()=>{
 const dot=M.convert(DOT);
 assert.equal(dot.mathml,'<mi mathvariant="normal" class="rd-mb">a</mi><mo>⋅</mo><mi mathvariant="normal" class="rd-mb">b</mi><mo>=</mo><mo stretchy="false">‖</mo><mi mathvariant="normal" class="rd-mb">a</mi><mo stretchy="false">‖</mo><mspace width="0.167em"/><mo stretchy="false">‖</mo><mi mathvariant="normal" class="rd-mb">b</mi><mo stretchy="false">‖</mo><mspace width="0.167em"/><mrow><mi>cos</mi><mo>⁡</mo><mspace width="0.167em"/></mrow><mi>θ</mi>');
 const proj=M.convert(PROJ);
 assert.equal(proj.mathml,'<mrow><msub><mi mathvariant="normal">proj</mi><mrow class="rd-ms"><mi mathvariant="normal" class="rd-mb">b</mi></mrow></msub><mo>⁡</mo><mspace width="0.167em"/></mrow><mi mathvariant="normal" class="rd-mb">a</mi>');
 const triple=M.convert(TRIPLE);
 assert.equal(triple.mathml,'<mi mathvariant="normal" class="rd-mb">a</mi><mo>⋅</mo><mrow><mo fence="true" stretchy="true">(</mo><mi mathvariant="normal" class="rd-mb">b</mi><mo>×</mo><mi mathvariant="normal" class="rd-mb">c</mi><mo fence="true" stretchy="true">)</mo></mrow>');
 // In plain text (rows, excerpts, a screen reader's label) they read as mathematics, not as TeX.
 assert.deepEqual([dot.plain,proj.plain,triple.plain],['a·b = ‖a‖ ‖b‖ cos θ','proj_b a','a·(b × c)']);
});

test('what a course writes: fractions, roots, scripts, sums, integrals, limits, matrices, cases, aligned lines, chemistry',()=>{
 const p=tex=>M.convert(tex)?.plain,m=tex=>M.convert(tex)?.mathml;
 assert.equal(p(T`\frac{-b\pm\sqrt{b^2-4ac}}{2a}`),'(−b ± √(b² − 4ac))/2a');
 assert.match(m(T`\frac{1}{2}`),/^<mfrac><mrow><mn>1<\/mn><\/mrow><mrow><mn>2<\/mn><\/mrow><\/mfrac>$/);
 assert.match(m(T`\sqrt[3]{x}`),/^<mroot><mrow><mi>x<\/mi><\/mrow><mrow class="rd-ms"><mn>3<\/mn><\/mrow><\/mroot>$/);
 assert.equal(m('x_1^2'),'<msubsup><mi>x</mi><mrow class="rd-ms"><mn>1</mn></mrow><mrow class="rd-ms"><mn>2</mn></mrow></msubsup>');
 assert.equal(m("f'(x)"),'<msup><mi>f</mi><mrow class="rd-ms"><mo>′</mo></mrow></msup><mo stretchy="false">(</mo><mi>x</mi><mo stretchy="false">)</mo>');
 // Sums and limits put their bounds under and over in display (movablelimits: beside, inline); integrals keep scripts.
 assert.match(m(T`\sum_{i=1}^{n} i^2`),/^<munderover><mo largeop="true" movablelimits="true">∑<\/mo>/);
 assert.match(m(T`\int_0^\infty e^{-x^2}\,dx`),/^<msubsup><mo largeop="true">∫<\/mo><mrow class="rd-ms"><mn>0<\/mn><\/mrow><mrow class="rd-ms"><mi>∞<\/mi><\/mrow><\/msubsup>/);
 assert.match(m(T`\lim_{x\to 0}\frac{\sin x}{x}=1`),/^<mrow><munder><mo movablelimits="true">lim<\/mo><mrow class="rd-ms"><mi>x<\/mi><mo>→<\/mo><mn>0<\/mn><\/mrow><\/munder>/);
 assert.equal(p(T`\lim_{x\to 0}\frac{\sin x}{x}=1`),'lim_(x → 0) (sin x)/x = 1');
 assert.equal(p(T`\nabla f = \left\langle \frac{\partial f}{\partial x}, \frac{\partial f}{\partial y} \right\rangle`),'∇f = ⟨(∂f)/(∂x), (∂f)/(∂y)⟩');
 assert.equal(m(T`\begin{pmatrix}1&2\\3&4\end{pmatrix}`),'<mrow><mo fence="true" stretchy="true">(</mo><mtable><mtr><mtd><mn>1</mn></mtd><mtd><mn>2</mn></mtd></mtr><mtr><mtd><mn>3</mn></mtd><mtd><mn>4</mn></mtd></mtr></mtable><mo fence="true" stretchy="true">)</mo></mrow>');
 assert.match(m(T`f(x)=\begin{cases}x^2 & x\ge 0\\ -x & \text{otherwise}\end{cases}`),/<mo fence="true" stretchy="true">\{<\/mo><mtable class="rd-mcases"><mtr><mtd class="rd-ml">.*<mtext>otherwise<\/mtext><\/mtd><\/mtr><\/mtable><\/mrow>$/);
 assert.match(m(T`\begin{aligned}x&=1\\y&=2\end{aligned}`),/^<mtable class="rd-mal"><mtr><mtd class="rd-mr"><mi>x<\/mi><\/mtd><mtd class="rd-ml"><mo>=<\/mo><mn>1<\/mn><\/mtd><\/mtr>/);
 assert.deepEqual([p(T`\mathbb{R}^3`),p(T`a \not= b`),p(T`\vec{v}\times\hat{n}`),p(T`\|v\| = \sqrt{v \cdot v}`),p(T`\Delta H = -57.3\,\text{kJ/mol}`),p(T`\cos^2\theta+\sin^2\theta=1`)],['ℝ³','a ≠ b','v⃗ × n̂','‖v‖ = √(v·v)','ΔH = −57.3 kJ/mol','cos² θ + sin² θ = 1']);
 // Chemistry (a small part of \ce): subscripts, charges, arrows, states.
 assert.deepEqual([p(T`\ce{2H2 + O2 -> 2H2O}`),p(T`\ce{SO4^2-}`),p(T`\ce{Na+ + Cl-}`),p(T`\ce{N2(g) + 3H2(g) <=> 2NH3(g)}`)],['2H₂ + O₂ → 2H₂O','SO₄²⁻','Na⁺ + Cl⁻','N₂(g) + 3H₂(g) ⇌ 2NH₃(g)']);
 assert.equal(m(T`\ce{H2O}`),'<mrow><msub><mi mathvariant="normal">H</mi><mrow class="rd-ms"><mn>2</mn></mrow></msub><mi mathvariant="normal">O</mi></mrow>');
});

test('delimiters: \\( \\) and \\[ \\] and $$ $$ are mathematics; a single dollar never is; text around them is escaped',()=>{
 assert.deepEqual(M.split(T`Find \(x\) when \[x^2=4\] or $$y$$ for $5 and $6.`),[{text:'Find '},{tex:'x',display:false,source:T`\(x\)`},{text:' when '},{tex:'x^2=4',display:true,source:T`\[x^2=4\]`},{text:' or '},{tex:'y',display:true,source:'$$y$$'},{text:' for $5 and $6.'}]);
 assert.equal(M.hasMath('It costs $5 & <b>'),false);assert.equal(M.renderText('It costs $5 & <b>'),'It costs $5 &amp; &lt;b&gt;');
 const out=M.renderText(T`Dot Product and its properties including knowing that \(${DOT}\) <now>`);
 assert.ok(out.startsWith('Dot Product and its properties including knowing that <math class="rd-math" aria-label="a·b = ‖a‖ ‖b‖ cos θ"><semantics><mrow>'),out.slice(0,140));
 assert.ok(out.endsWith(`<annotation encoding="application/x-tex">${DOT}</annotation></semantics></math> &lt;now&gt;`),'the TeX source stays in the MathML (semantics), and the text after it is escaped');
 // Inline mathematics is the bare <math>; display mathematics is display="block" in a box of its own that can scroll.
 assert.match(M.html('x^2'),/^<math class="rd-math" aria-label="x²"><semantics><mrow><msup>/);
 assert.match(M.html('x^2',{display:true}),/^<span class="rd-math-block"><math class="rd-math" display="block" aria-label="x²">.*<\/math><\/span>$/);
 assert.match(M.renderText(T`\[\frac{1}{2}\]`),/^<span class="rd-math-block"><math class="rd-math" display="block" aria-label="1\/2">/);
 assert.match(M.renderText(T`a \(x + 1\)`),/aria-label="x \+ 1"/,'a non-breaking space inside TeX is a space');
});

test('TeX that cannot be read stays visible as it was written, in a quiet code style, and never breaks what is around it',()=>{
 for(const bad of [T`\frac{1}{`,T`x^{`,T`\begin{pmatrix}1&2`,T`\left( x`,T`\nosuchcommand{x}`,T`}`,T`\end{cases}`])assert.equal(M.convert(bad),null,bad);
 assert.equal(M.renderText(T`Before \(\frac{1}{\) after \(x\).`),T`Before <code class="rd-math-raw">\(\frac{1}{\)</code> after `+M.html('x')+'.');
 assert.equal(M.html(T`\nosuch`,{source:T`\(\nosuch\)`}),T`<code class="rd-math-raw">\(\nosuch\)</code>`);
 // In plain text an unreadable expression loses its backslashes and braces rather than being shown raw.
 assert.equal(M.plain(T`Use \(\nosuch{a}\,b\) here`),'Use nosuch a b here');
});

test('untrusted input: the output is built from a fixed set of elements and attributes; nothing in the TeX becomes markup, a link or a style',()=>{
 // Commands that load, link, style or define are simply unknown.
 for(const tex of [T`\href{javascript:alert(1)}{x}`,T`\url{https://evil.example}`,T`\includegraphics{x.png}`,T`\def\a{b}\a`,T`\newcommand{\a}{b}`,T`\class{rd-button}{x}`,T`\style{color:red}{x}`,T`\cssId{a}{x}`,T`\unicode{x41}`,T`\html@mathml{a}{b}`,T`\input{/etc/passwd}`,T`\constructor`,T`\toString`,T`\valueOf`,T`\begin{constructor}x\end{constructor}`,T`\color{red}{x}`])assert.equal(M.convert(tex),null,tex);
 // Markup in the TeX is text: every character is escaped, in elements, in the label and in the annotation.
 const hostile=T`x<script>alert(1)</script> \text{<img src=x onerror=alert(1)>"quote"} y`,out=M.html(hostile);
 assert.doesNotMatch(out,/<script|<img|onerror=alert\(1\)>"|javascript:/i);assert.match(out,/&lt;img src=x onerror=alert\(1\)&gt;&quot;quote&quot;/);
 assert.equal((out.match(/</g)||[]).length,(out.match(/<\/?(?:math|semantics|annotation|mrow|mi|mo|mn|mtext|mspace)\b/g)||[]).length,'every < opens or closes one of its own elements');
 // Across everything the converter can produce here: only these elements, only these attributes.
 const corpus=[DOT,PROJ,TRIPLE,T`\frac{a}{b}\sqrt[3]{x}\sqrt{y}\sum_{i=1}^n\int_0^1\lim_{x\to0}\vec{v}\hat{n}\overline{AB}\underline{x}\binom{n}{k}`,T`\begin{pmatrix}1&2\\3&4\end{pmatrix}\begin{cases}a&b\\c&d\end{cases}\begin{aligned}x&=1\end{aligned}`,T`\left[\frac{x}{y}\middle| z\right]\big(\Big)\mathbb{R}\mathcal{L}\mathbf{x}\boldsymbol{y}\mathsf{s}\mathtt{t}\text{a b}\textbf{b}\operatorname{span}\,\;\quad\boxed{x}\underbrace{a+b}_{n}\overset{a}{=}\phantom{x}\pmod{n}`,T`\ce{2H2 + O2 -> 2H2O(l)}\ce{SO4^2-}`].map(tex=>M.html(tex,{display:true})).join('');
 assert.deepEqual(tags(corpus),['annotation','math','mfrac','mi','mn','mo','mover','mphantom','mroot','mrow','mspace','msqrt','msub','msubsup','msup','mtable','mtd','mtext','mtr','munder','munderover','semantics','span']);
 assert.deepEqual(attrs(corpus),['accent','accentunder','aria-label','class','display','encoding','fence','largeop','linethickness','mathvariant','maxsize','minsize','movablelimits','stretchy','width']);
 assert.deepEqual([...new Set([...corpus.matchAll(/ class="([^"]*)"/g)].map(m=>m[1]))].sort(),['rd-math','rd-math-block','rd-mb','rd-mbox','rd-mcases','rd-ml','rd-mr','rd-ms','rd-msf','rd-mtt','rd-mal'].sort(),'classes are the converter\'s own');
 assert.doesNotMatch(corpus,/ (?:href|src|style|id|on\w+)=/);
 // Caps: a very long expression, very deep nesting, and more expressions than a document may hold are left as text.
 assert.deepEqual(M.limits,{length:2000,depth:40,parts:3000,count:200});
 assert.equal(M.convert('x+'.repeat(1001)),null,'over 2000 characters');assert.ok(M.convert('x+'.repeat(900)+'x'));
 assert.equal(M.convert('{'.repeat(41)+'x'+'}'.repeat(41)),null,'nested 41 deep');assert.ok(M.convert('{'.repeat(30)+'x'+'}'.repeat(30)));
 const many=M.renderText(T`\(x\) `.repeat(203));assert.equal((many.match(/<math /g)||[]).length,200);assert.equal((many.match(/<code class="rd-math-raw">\\\(x\\\)<\/code>/g)||[]).length,3);
 const budget={left:1};assert.equal((M.renderText(T`\(a\) \(b\)`,budget).match(/<math /g)||[]).length,1,'one budget for a whole document');
});

test('Canvas equation images give their TeX; MathML already in the HTML passes a whitelist',()=>{
 const el=(tagName,attributes={},childNodes=[])=>({nodeType:1,tagName,localName:tagName.toLowerCase(),childNodes,getAttribute:name=>attributes[name]??null,get textContent(){return childNodes.map(c=>c.textContent).join('');}}),text=value=>({nodeType:3,textContent:value});
 // The equation editor's image: the TeX is in data-equation-content (older content: in the alt text).
 assert.equal(M.imageTeX(el('IMG',{class:'equation_image','data-equation-content':T`\frac{1}{2}`,src:'/equation_images/x',alt:T`LaTeX: \frac{1}{2}`})),T`\frac{1}{2}`);
 assert.equal(M.imageTeX(el('IMG',{class:'big equation_image',alt:T`LaTeX: x^2`})),'x^2');
 assert.equal(M.imageTeX(el('IMG',{class:'photo',alt:'LaTeX: x^2','data-equation-content':'x'})),'','any other image is not mathematics');
 // In a plain-text context the image becomes its TeX before the tags are stripped.
 assert.equal(M.equationTeX(T`<p>Solve <img class="equation_image" title="x" src="/equation_images/x" alt="LaTeX: x^2" data-equation-content="x^2 &lt; 4 &amp; x &gt; 0"> now <img src="cat.png" alt="LaTeX: no"></p>`),T`<p>Solve  \(x^2 < 4 & x > 0\)  now <img src="cat.png" alt="LaTeX: no"></p>`);
 // MathML in the teacher's HTML: presentation elements and checked attributes stay; the rest goes.
 const mathml=el('math',{display:'block',xmlns:'http://www.w3.org/1998/Math/MathML',onclick:'alert(1)',style:'color:red',class:'x'},[el('semantics',{},[
  el('mrow',{href:'javascript:alert(1)',id:'a'},[el('mi',{mathvariant:'normal',style:'x'},[text('x<y')]),el('mo',{stretchy:'false',form:'evil'},[text('=')]),el('maction',{actiontype:'toggle'},[el('mn',{},[text('1')])]),el('script',{},[text('alert(1)')]),el('mspace',{width:'1em',height:'expression(1)'})]),
  el('annotation',{encoding:'application/x-tex'},[text('x<y')]),el('annotation',{encoding:'text/html'},[text('<b>')]),el('annotation-xml',{encoding:'text/html'},[el('img',{src:'x',onerror:'alert(1)'})])])]);
 assert.equal(M.cleanMathML(mathml),'<span class="rd-math-block"><math class="rd-math" display="block"><semantics><mrow><mi mathvariant="normal">x&lt;y</mi><mo stretchy="false">=</mo><mn>1</mn><mspace width="1em"/></mrow><annotation encoding="application/x-tex">x&lt;y</annotation></semantics></math></span>');
 assert.equal(M.cleanMathML(el('math',{},[el('mi',{},[text('a')])])),'<math class="rd-math"><mi>a</mi></math>');
});

test('plain text for rows, excerpts and search: the delimiters and commands go, the mathematics stays readable',()=>{
 assert.equal(M.plain(T`Dot Product and its properties including knowing that \(${DOT}\)`),'Dot Product and its properties including knowing that a·b = ‖a‖ ‖b‖ cos θ');
 assert.equal(M.plain(T`Projections \(${PROJ}\) and the triple product \(${TRIPLE}\).`),'Projections proj_b a and the triple product a·(b × c).');
 assert.equal(M.plain('No mathematics here: $5.'),'No mathematics here: $5.');
 assert.equal(M.plain(T`\[E = mc^2\] and $$\ce{H2O}$$`),'E = mc² and H₂O');
 // The assignment row's excerpt (dashboard-view.js) uses both helpers.
 const view=fs.readFileSync(path.join(__dirname,'../extension/dashboard-view.js'),'utf8');
 assert.match(view,/const excerpt=item=>\{const M=root\.ReserveMath,text=String\(M\?M\.equationTeX\(item\.description\|\|''\):item\.description\|\|''\)/);assert.match(view,/return \(M\?M\.plain\(text\)\.replace\(\/\\s\+\/g,' '\):text\)\.slice\(0,170\);/);
});

test('the sanitizer renders mathematics in text, from equation images and from MathML, and nowhere inside code',()=>{
 const el=(tagName,attributes={},childNodes=[])=>({nodeType:1,tagName,localName:tagName.toLowerCase(),childNodes,getAttribute:name=>attributes[name]??null,get textContent(){return childNodes.map(c=>c.textContent).join('');}}),text=value=>({nodeType:3,textContent:value});
 const saved={document:globalThis.document,math:globalThis.ReserveMath};
 const run=(nodes,withMath=true)=>{globalThis.document={createElement:()=>({set innerHTML(v){},content:{childNodes:nodes}})};if(withMath)globalThis.ReserveMath=M;else delete globalThis.ReserveMath;
  delete require.cache[require.resolve('../extension/ui-utils.js')];try{return require('../extension/ui-utils.js').safeRichHTML('x');}finally{globalThis.document=saved.document;if(saved.math)globalThis.ReserveMath=saved.math;else delete globalThis.ReserveMath;delete require.cache[require.resolve('../extension/ui-utils.js')];}};
 const nodes=()=>[el('P',{},[text(T`Know that \(${DOT}\) & more`)]),el('P',{},[el('IMG',{class:'equation_image','data-equation-content':PROJ,src:'/equation_images/1'}),el('IMG',{src:'/files/1/preview',alt:'a photo'})]),
  el('PRE',{},[el('CODE',{},[text(T`print("\(x\)")`)])]),el('math',{},[el('mi',{onclick:'x'},[text('z')])]),el('svg',{},[el('script',{},[text('alert(1)')]),el('text',{},[text('drawn')])]),el('P',{},[el('IMG',{class:'equation_image','data-equation-content':T`\frac{`})])];
 const out=run(nodes());
 assert.ok(out.startsWith(`<p>Know that ${M.html(DOT)} &amp; more</p>`),'TeX in a text node');
 assert.ok(out.includes(`<p>${M.html(PROJ)}</p>`),'an equation image is rendered from its TeX; any other image is still dropped');
 assert.ok(out.includes(T`<pre><code>print(&quot;\(x\)&quot;)</code></pre>`),'code is left exactly as written');
 assert.ok(out.includes('<math class="rd-math"><mi>z</mi></math>'),'MathML through the whitelist');
 assert.doesNotMatch(out,/alert|drawn|<svg|onclick/,'an svg is dropped whole, whatever the case of its tag name');
 assert.ok(out.endsWith(T`<p><code class="rd-math-raw">\frac{</code></p>`),'an equation image whose TeX cannot be read shows the TeX');
 // Without math.js the sanitizer is what it was: text escaped, images and MathML dropped to their text.
 const before=run(nodes(),false);assert.ok(before.startsWith(T`<p>Know that \(`+DOT.replace(/&/g,'&amp;')+T`\) &amp; more</p><p></p>`));assert.doesNotMatch(before,/<math|<img|alert|<svg/);
});

test('math.js ships as a content script before ui-utils.js, in the preview pages too; the page styles it without a new stylesheet',()=>{
 const root=path.join(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'extension/manifest.json'),'utf8')),js=manifest.content_scripts[0].js;
 assert.equal(js.indexOf('math.js'),js.indexOf('ui-utils.js')-1);assert.deepEqual(manifest.permissions,['storage']);assert.deepEqual(manifest.host_permissions,['https://*.instructure.com/*']);
 for(const page of ['preview/index.html'])assert.match(fs.readFileSync(path.join(root,page),'utf8'),/<script src="\.\.\/extension\/math\.js"><\/script><script src="\.\.\/extension\/ui-utils\.js"><\/script>/,page);
 const source=fs.readFileSync(path.join(root,'extension/math.js'),'utf8');
 assert.doesNotMatch(source,/\bfetch\(|XMLHttpRequest|\bimport\(|\beval\(|new Function|\.innerHTML|document\.(?:create|write|query|get|body|head)|https?:\/\/(?!www\.w3\.org)/,'no network, no DOM writes, no code from strings');
 assert.doesNotMatch(source,/[ ⁡̀-ͯ⃐-⃿​-‏]/,'invisible and combining characters are written as escapes');
 const css=fs.readFileSync(path.join(root,'extension/refresh.css'),'utf8').replace(/\r\n/g,'\n');
 assert.match(css,/\.rd \.rd-math-block \{ display: block; margin: \.75em 0; padding: 2px 0; overflow-x: auto; overflow-y: hidden; text-align: center;/,'display mathematics: centred, a little space, scrolling inside its own box');
 assert.match(css,/\.rd math \.rd-ms \{ font-size: max\(\.71em, 11px\); \}/,'scripts never go under 11px');
 assert.match(css,/\.rd math\.rd-math \{ font-size: 1em; color: inherit; \}/,'inline mathematics is the text\'s size and colour');
 assert.match(css,/\.rd code\.rd-math-raw \{ font: \.86em\/1\.4 ui-monospace/);
});
