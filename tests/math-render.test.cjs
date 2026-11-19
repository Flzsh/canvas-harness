'use strict';
// Help cards show the AI's TeX as MathML (owner, 2026-10-28: equations "not displayed clearly, and not in LaTeX form").
const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../extension/math-render.js');
const ml=(tex,display)=>{const r=M.convert(tex,display);return r?M.toMathML(r.tree):null;};
const plain=tex=>M.convert(tex)?.plain;

test('fractions, roots and nested scripts become MathML with a readable plain form',()=>{
 assert.equal(ml(String.raw`\frac{a}{b}`),'<mfrac><mrow><mi>a</mi></mrow><mrow><mi>b</mi></mrow></mfrac>');
 assert.equal(plain(String.raw`\frac{1}{2}`),'1/2');assert.equal(plain(String.raw`\frac{x+1}{2}`),'(x + 1)/2');
 assert.match(ml(String.raw`\sqrt[3]{x}`),/^<mroot><mrow><mi>x<\/mi><\/mrow><mrow><mn>3<\/mn><\/mrow><\/mroot>$/);
 assert.match(ml(String.raw`\sqrt{2}`),/<msqrt><mn>2<\/mn><\/msqrt>/);
 assert.match(ml(String.raw`\dfrac{a}{b}`),/^<mfrac displaystyle="true">/,'\\dfrac keeps its full size inside a line');
 // x^{a_i^2}: a superscript holding a sub-and-superscript; e^{-x^2}.
 assert.match(ml(String.raw`x^{a_{i}^{2}}`),/<msup><mi>x<\/mi><mrow><msubsup><mi>a<\/mi><mrow><mi>i<\/mi><\/mrow><mrow><mn>2<\/mn><\/mrow><\/msubsup><\/mrow><\/msup>/);
 assert.match(ml(String.raw`e^{-x^2}`),/<msup><mi>e<\/mi><mrow><mo lspace="0" rspace="0">−<\/mo><msup><mi>x<\/mi><mrow><mn>2<\/mn><\/mrow><\/msup><\/mrow><\/msup>/);
 assert.equal(plain('x^2 + y_1'),'x² + y₁');
 assert.match(ml(String.raw`f'(x)`),/<msup><mi>f<\/mi><mrow><mo>′<\/mo><\/mrow><\/msup>/);
 assert.match(ml(String.raw`\left( \frac{a}{b} \right)^{2}`),/<msup><mrow><mo fence="true" stretchy="true">\(<\/mo><mfrac>.*<mo fence="true" stretchy="true">\)<\/mo><\/mrow><mrow><mn>2<\/mn><\/mrow><\/msup>/);
});
test('matrices, determinants, cases and aligned work, also with a row break escaped only once',()=>{
 const b=ml(String.raw`\begin{bmatrix} 2 & 1 \\ -1 & 3 \end{bmatrix}`,true);
 assert.match(b,/^<mrow><mo fence="true" stretchy="true">\[<\/mo><mtable><mtr><mtd><mrow><mn>2<\/mn><\/mrow><\/mtd><mtd><mrow><mn>1<\/mn><\/mrow><\/mtd><\/mtr><mtr><mtd><mrow><mo lspace="0" rspace="0">−<\/mo><mn>1<\/mn><\/mrow><\/mtd><mtd><mrow><mn>3<\/mn><\/mrow><\/mtd><\/mtr><\/mtable><mo fence="true" stretchy="true">\]<\/mo><\/mrow>$/);
 assert.equal(plain(String.raw`\begin{bmatrix} 2 & 1 \\ -1 & 3 \end{bmatrix}`),'[2, 1; −1, 3]');
 // A reply that wrote "\\" once inside JSON leaves "\ " after parsing: still a row break inside a table.
 assert.equal(plain(String.raw`\begin{pmatrix} a & b \ c & d \end{pmatrix}`),'(a, b; c, d)');
 assert.match(ml(String.raw`\begin{vmatrix} a & b \\ c & d \end{vmatrix}`),/<mo fence="true" stretchy="true">\|<\/mo><mtable>/);
 assert.match(ml(String.raw`\det(A) = \begin{vmatrix} a & b \\ c & d \end{vmatrix} = ad - bc`),/<mo movablelimits="true">det<\/mo><mo>\u2061<\/mo>/);
 assert.match(ml(String.raw`f(x) = \begin{cases} 1 & x > 0 \\ 0 & \text{otherwise} \end{cases}`),/<mtable class="ch-mcases"><mtr><mtd class="ch-ml">/);
 assert.match(ml(String.raw`\begin{aligned} x &= 2 \\ y &= 3 \end{aligned}`),/<mtable class="ch-mal"><mtr><mtd class="ch-mr">.*<mtd class="ch-ml">/);
 assert.match(ml(String.raw`\begin{matrix} 1 & 0 \\ 0 & 1 \end{matrix}`),/^<mtable>/);
});
test('Greek, operators, big operators with limits, functions, text, bold and chemistry',()=>{
 assert.match(ml(String.raw`\alpha + \Omega`),/<mi>α<\/mi><mo>\+<\/mo><mi mathvariant="normal">Ω<\/mi>/);
 assert.equal(plain(String.raw`a \cdot b \times c \div d \pm e \le f \ge g \ne h \approx i \to \infty`),'a·b × c ÷ d ± e ≤ f ≥ g ≠ h ≈ i → ∞');
 assert.match(ml(String.raw`\sum_{i=1}^{n} i`),/<munderover><mo largeop="true" movablelimits="true">∑<\/mo>/);
 assert.match(ml(String.raw`\prod_{k} k`),/<munder><mo largeop="true" movablelimits="true">∏<\/mo>/);
 assert.match(ml(String.raw`\int_0^1 x\,dx`),/<msubsup><mo largeop="true">∫<\/mo><mrow><mn>0<\/mn><\/mrow><mrow><mn>1<\/mn><\/mrow><\/msubsup>/);
 assert.match(ml(String.raw`\lim_{x \to 0} \frac{\sin x}{x}`),/<munder><mo movablelimits="true">lim<\/mo><mrow><mi>x<\/mi><mo>→<\/mo><mn>0<\/mn><\/mrow><\/munder>/);
 for(const f of ['sin','cos','log','ln'])assert.match(ml('\\'+f+' x'),new RegExp('<mi>'+f+'</mi><mo>\u2061</mo>'));
 assert.match(ml(String.raw`\text{if } x \neq 0`),/<mtext>if\u00a0<\/mtext>/);
 assert.match(ml(String.raw`\mathbf{v} \cdot \vec{u}`),/<mi mathvariant="normal">𝐯<\/mi>.*<mover accent="true"><mrow><mi>u<\/mi><\/mrow><mo stretchy="false">→<\/mo><\/mover>/);
 assert.match(ml(String.raw`\overline{AB} + \hat{x}`),/<mover accent="true"><mrow><mi>A<\/mi><mi>B<\/mi><\/mrow><mo stretchy="true">¯<\/mo><\/mover>/);
 assert.match(ml(String.raw`K_c = \frac{[\mathrm{SO_3}]^2}{[\mathrm{SO_2}]^2[\mathrm{O_2}]}`),/<msub><mi>K<\/mi><mrow><mi>c<\/mi><\/mrow><\/msub><mo>=<\/mo><mfrac>/);
 assert.equal(plain(String.raw`\ce{2SO2(g) + O2(g) <=> 2SO3(g)}`),'2SO₂(g) + O₂(g) ⇌ 2SO₃(g)');
 assert.equal(plain(String.raw`25\,^\circ\mathrm{C}`),'25° C');
});
test('an unknown command falls back to its TeX source in a code style and nothing throws',()=>{
 assert.equal(M.convert(String.raw`\SI{5}{kg}`),null);assert.equal(M.convert(String.raw`\frac{1}{`),null);assert.equal(M.convert(''),null);
 assert.equal(M.convert('{'.repeat(60)+'x'+'}'.repeat(60)),null,'nesting is capped');assert.equal(M.convert('x+'.repeat(1200)),null,'length is capped');
 const doc={createElement(tag){return {tagName:tag.toUpperCase(),className:'',textContent:'',children:[],append(...k){this.children.push(...k);}};}};
 const raw=M.node(doc,{tex:String.raw` \weird{x} `,display:false});assert.equal(raw.tagName,'CODE');assert.equal(raw.className,'ch-math-raw');assert.equal(raw.textContent,String.raw`\weird{x}`);
 // Without MathML building (an old engine, a test DOM) the maths reads in its plain form.
 const flat=M.node(doc,{tex:String.raw`\frac{1}{2}`,display:false});assert.equal(flat.className,'ch-math-plain');assert.equal(flat.textContent,'1/2');
});
test('money is not maths, code is left alone, and every delimiter is found',()=>{
 const kinds=t=>M.split(t).map(p=>p.tex!==undefined?(p.display?'D:':'I:')+p.tex:p.code!==undefined?'C:'+p.code:'T:'+p.text);
 assert.deepEqual(kinds('It costs $5 and $10 today.'),['T:It costs $5 and $10 today.']);
 assert.deepEqual(kinds('Tickets are $5-$10.'),['T:Tickets are $5-$10.']);
 assert.deepEqual(kinds('Pay $5, then $ 6 more.'),['T:Pay $5, then $ 6 more.']);
 assert.deepEqual(kinds('From $5 to $10 per $x$ unit'),['T:From $5 to $10 per ','I:x',' unit'].map((s,i)=>i===2?'T:'+s:s));
 assert.deepEqual(kinds(String.raw`So $x^2$ and $$\frac{1}{2}$$ and \(y\) and \[z\].`),['T:So ','I:x^2','T: and ','D:\\frac{1}{2}','T: and ','I:y','T: and ','D:z','T:.']);
 assert.deepEqual(kinds(String.raw`A \$5 fee`),['T:A $5 fee']);
 assert.deepEqual(kinds('Run `echo $HOME$PATH` now'),['T:Run ','C:echo $HOME$PATH','T: now']);
 assert.deepEqual(kinds('```\n$a$\n```'),['C:$a$']);
 assert.equal(M.plain(String.raw`Half is $\frac{1}{2}$, cost $5.`),'Half is 1/2, cost $5.');
});
test('nothing from the TeX reaches the page as markup: HTML, links and attributes are dropped or escaped',()=>{
 const out=ml(String.raw`x<img src=x onerror=alert(1)>+<script>alert(1)</script>y`);assert.ok(out);assert.doesNotMatch(out,/<img|<script|onerror/);
 assert.match(ml(String.raw`\text{5 < 6 & "q"}`),/<mtext>5 &lt; 6 &amp; &quot;q&quot;<\/mtext>/);
 const href=ml(String.raw`\href{javascript:alert(1)}{click} + \url{http://x.test}`);assert.doesNotMatch(href,/javascript|http/);assert.match(href,/<mi>c<\/mi><mi>l<\/mi>/);
 assert.doesNotMatch(ml(String.raw`\htmlClass{evil}{x} \htmlStyle{color:red}{y}`),/evil|color/);
 assert.equal(M.convert(String.raw`\def\x{1}`),null);assert.equal(M.convert(String.raw`\newcommand{\x}{1}`),null);
 // DOM building: only MathML elements from a fixed list, attributes from a fixed list, text as text.
 const made=[];const el=(ns,tag)=>{const n={ns,tag,attrs:{},kids:[],setAttribute(k,v){this.attrs[k]=v;},append(c){this.kids.push(c);},set textContent(v){this.text=v;}};made.push(n);return n;};
 const doc={createElementNS:el,createElement:tag=>el('html',tag)};
 const block=M.node(doc,{tex:String.raw`\begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix} \text{<b>x</b>}`,display:true});
 assert.equal(block.tag,'span');assert.equal(block.className,'ch-math-block');const math=block.kids[0];assert.equal(math.ns,M.NS);assert.equal(math.tag,'math');assert.equal(math.attrs.display,'block');assert.equal(math.attrs.class,'ch-math');
 assert.match(math.attrs['aria-label'],/\[1, 2; 3, 4\]/);
 const allowed=new Set('math semantics annotation mrow mi mn mo mtext mspace mfrac msqrt mroot msub msup msubsup munder mover munderover mtable mtr mtd mphantom'.split(' '));
 for(const n of made.filter(n=>n.ns===M.NS)){assert.ok(allowed.has(n.tag),n.tag);for(const k of Object.keys(n.attrs))assert.match(k,/^(display|displaystyle|class|mathvariant|stretchy|fence|largeop|movablelimits|accent|accentunder|linethickness|width|lspace|rspace|minsize|maxsize|encoding|aria-label)$/);}
 assert.ok(made.some(n=>n.tag==='annotation'&&n.attrs.encoding==='application/x-tex'),'the TeX rides along as an annotation');
 assert.ok(!made.some(n=>n.tag==='b'),'raw HTML inside \\text is not built');
 const inline=M.node(doc,{tex:String.raw`\frac{1}{2}`,display:true},{inline:true});assert.equal(inline.tag,'math');assert.equal(inline.attrs.display,undefined,'a row head keeps display maths in its line');
});

// Review 2026-10-28: a minus that is a sign sits on its number, the solidus is tight, and "<" ">" are always relations.
test('a sign is tight to its number; subtraction keeps its spaces; a solidus has none',()=>{
 const tight='<mo lspace="0" rspace="0">−</mo>';
 assert.ok(ml('(-4)').includes(tight+'<mn>4</mn>'),'(−4), not ( − 4)');assert.ok(ml('x = -3').includes('<mo>=</mo>'+tight+'<mn>3</mn>'),'= −3, not = − 3');
 assert.ok(ml('-RT').startsWith('<mrow>'+tight),'a leading sign');assert.ok(ml('(2)(4) + (1)(-2)').includes('<mo stretchy="false">(</mo>'+tight+'<mn>2</mn>'));
 assert.ok(!ml('a - b').includes(tight),'a binary minus keeps its operator space');assert.equal(plain('x = -5.7'),'x = −5.7');
 assert.ok(ml(String.raw`\mathrm{m/s^2}`).includes('<mo lspace="0" rspace="0">/</mo>'));assert.equal(plain(String.raw`\mathrm{kJ/mol}`),'kJ/mol');
});
test('inequalities are never taken for markup',()=>{
 assert.equal(plain('P(X<a)>0'),'P(X < a) > 0');assert.equal(plain(String.raw`p<q \text{ and } r>s`),'p < q and r > s');
 assert.equal(plain(String.raw`\begin{aligned}a&<b\\c&>d\end{aligned}`),'a < b; c > d');assert.equal(plain(String.raw`0<x \text{ and } y>1`),'0 < x and y > 1');
 assert.match(ml('P(X<a)>0'),/<mo>&lt;<\/mo>.*<mo>&gt;<\/mo>/,'escaped in markup, relations in the tree');
});
test('a dollar after a letter or digit never opens maths: spreadsheet references stay text',()=>{
 assert.deepEqual(M.split('=SUM($A$1:$B$5)'),[{text:'=SUM($A$1:$B$5)'}]);
 assert.deepEqual(M.split('the $x$-axis and the $n$th term ($x$)').filter(p=>p.tex).map(p=>p.tex),['x','n','x']);
 assert.deepEqual(M.split('Costs are $5 and $10.'),[{text:'Costs are $5 and $10.'}]);
});
