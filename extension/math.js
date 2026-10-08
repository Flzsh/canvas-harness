/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
// Canvas Harness 2.17.2: mathematics in teacher text. Canvas descriptions, pages and announcements may carry TeX between
// \( \), \[ \] or $$ $$, or an equation image whose TeX is in data-equation-content; Canvas Harness used to show the TeX
// raw (and drop the images). This turns TeX into MathML, which Chromium renders natively (MathML Core, 109+).
//
// It is Canvas Harness's own small converter, not a vendored library: no fonts, no styles of its own, no network, no macros.
// SAFE BY CONSTRUCTION: it never copies markup from its input. It parses TeX into a fixed set of MathML elements
// with a fixed set of attributes, every piece of text is escaped, and anything it does not know (\href, \url,
// \includegraphics, \def, \newcommand, \class, \style, \unicode, any unknown command) is a parse failure, which
// leaves the original text visible in a quiet code style. Inputs are capped (length, nesting, parts per expression,
// expressions per text).
//
//   ReserveMath.convert(tex, display)   {mathml, plain} or null
//   ReserveMath.html(tex, {display, source})   markup for the page (a fallback <code> when the TeX does not parse)
//   ReserveMath.renderText(text, budget)       escaped text with its \( \), \[ \], $$ $$ parts as math
//   ReserveMath.plain(text)                    the same parts in a readable plain form, for rows and excerpts
//   ReserveMath.equationTeX(html)              Canvas equation images in an HTML string become \( tex \)
//   ReserveMath.imageTeX(node), cleanMathML(node)   for the sanitizer (ui-utils.js safeRichHTML)
(function(root){
 'use strict';
 const LIMIT={length:2000,depth:40,parts:3000,count:200};
 const E=v=>String(v??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
 const FAIL={};
 // ---- Tables ---------------------------------------------------------------------------------------------
 // (Tables have no prototype: a command named like an Object method must not be found in one.)
 const bare=object=>Object.assign(Object.create(null),object);
 const words=(text,fn)=>bare(Object.fromEntries(text.trim().split(/\s+/).map(pair=>{const i=pair.indexOf(':');return fn(pair.slice(0,i),pair.slice(i+1));})));
 // Identifiers (mi): Greek and a few letter-like symbols. Capital Greek is upright, as in TeX.
 const IDENT=words('alpha:α beta:β gamma:γ delta:δ epsilon:ϵ varepsilon:ε zeta:ζ eta:η theta:θ vartheta:ϑ iota:ι kappa:κ lambda:λ mu:μ nu:ν xi:ξ pi:π varpi:ϖ rho:ρ varrho:ϱ sigma:σ varsigma:ς tau:τ upsilon:υ phi:ϕ varphi:φ chi:χ psi:ψ omega:ω Gamma:Γ Delta:Δ Theta:Θ Lambda:Λ Xi:Ξ Pi:Π Sigma:Σ Upsilon:Υ Phi:Φ Psi:Ψ Omega:Ω infty:∞ partial:∂ nabla:∇ ell:ℓ hbar:ℏ emptyset:∅ varnothing:∅ aleph:ℵ Re:ℜ Im:ℑ imath:ı jmath:ȷ angle:∠ triangle:△ square:□ degree:° prime:′ top:⊤ bot:⊥',(k,v)=>[k,v]);
 // Operators (mo): [character, how it reads in plain text (' x ' keeps a space on both sides)].
 const SYM=words('cdot:⋅ times:× div:÷ pm:± mp:∓ ast:∗ star:⋆ circ:∘ bullet:• oplus:⊕ otimes:⊗ cup:∪ cap:∩ setminus:∖ wedge:∧ land:∧ vee:∨ lor:∨ neg:¬ lnot:¬ le:≤ leq:≤ ge:≥ geq:≥ ne:≠ neq:≠ approx:≈ equiv:≡ sim:∼ simeq:≃ cong:≅ propto:∝ ll:≪ gg:≫ in:∈ notin:∉ ni:∋ subset:⊂ subseteq:⊆ supset:⊃ supseteq:⊇ perp:⊥ parallel:∥ mid:∣ to:→ rightarrow:→ leftarrow:← gets:← leftrightarrow:↔ Rightarrow:⇒ Leftarrow:⇐ Leftrightarrow:⇔ implies:⟹ iff:⟺ mapsto:↦ longrightarrow:⟶ uparrow:↑ downarrow:↓ rightleftharpoons:⇌ forall:∀ exists:∃ nexists:∄ therefore:∴ because:∵ cdots:⋯ ldots:… dots:… vdots:⋮ ddots:⋱ colon:: lt:< gt:> backslash:\\ langle:⟨ rangle:⟩ lfloor:⌊ rfloor:⌋ lceil:⌈ rceil:⌉ vert:| lvert:| rvert:| Vert:‖ lVert:‖ rVert:‖ lbrace:{ rbrace:} lbrack:[ rbrack:]',(k,v)=>[k,v]);
 const RELATION=new Set('= < > ≤ ≥ ≠ ≈ ≡ ∼ ≃ ≅ ∝ ≪ ≫ ∈ ∉ ∋ ⊂ ⊆ ⊃ ⊇ → ← ↔ ⇒ ⇐ ⇔ ⟹ ⟺ ↦ ⟶ ⇌ × ÷ ± ∓ + − ∪ ∩ ∧ ∨ ⊕ ⊗ ∴ ∵ ⊥ ∥ ∣'.split(' '));
 const FUNC='sin cos tan cot sec csc arcsin arccos arctan sinh cosh tanh coth ln log lg exp arg deg dim ker hom'.split(' ');
 const LIMFUNC='lim limsup liminf max min sup inf det gcd Pr'.split(' ');
 const BIG=words('sum:∑ prod:∏ coprod:∐ bigcup:⋃ bigcap:⋂ bigoplus:⨁ bigotimes:⨂ bigvee:⋁ bigwedge:⋀',(k,v)=>[k,v]);
 const INTEGRAL=words('int:∫ iint:∬ iiint:∭ oint:∮',(k,v)=>[k,v]);
 // Accents: [the mark over the base, stretchy, the combining character for the plain form].
 const ACCENT=bare({vec:['→',false,'\u20d7'],hat:['^',false,'\u0302'],widehat:['^',true,'\u0302'],bar:['¯',false,'\u0304'],overline:['¯',true,'\u0305'],tilde:['~',false,'\u0303'],widetilde:['~',true,'\u0303'],dot:['˙',false,'\u0307'],ddot:['¨',false,'\u0308'],overrightarrow:['→',true,'\u20d7'],overleftarrow:['←',true,'\u20d6'],check:['ˇ',false,'\u030c'],breve:['˘',false,'\u0306'],acute:['´',false,'\u0301'],grave:['`',false,'\u0300']});
 const SPACE=bare({',':'0.167em',':':'0.222em','>':'0.222em',';':'0.278em','!':'-0.167em',' ':'0.333em',quad:'1em',qquad:'2em',enspace:'0.5em',thinspace:'0.167em',medspace:'0.222em',thickspace:'0.278em',negthinspace:'-0.167em'});
 const FONT=bare({mathbf:'bf',bf:'bf',boldsymbol:'bs',bm:'bs',mathrm:'rm',rm:'rm',mathit:'it',mathsf:'sf',mathtt:'tt',mathbb:'bb',mathcal:'cal',mathscr:'cal',mathfrak:'frak',mathnormal:''});
 const TEXT=['text','textrm','textnormal','mbox','textbf','textit','textsf','texttt'];
 const IGNORED=['displaystyle','textstyle','scriptstyle','scriptscriptstyle','limits','nolimits','nonumber','notag','left.','right.','strut','mathstrut','allowbreak','relax','hfill','centering'];
 const SIZED=bare({big:'1.2em',Big:'1.8em',bigg:'2.4em',Bigg:'3em'});
 const BB={C:'ℂ',H:'ℍ',N:'ℕ',P:'ℙ',Q:'ℚ',R:'ℝ',Z:'ℤ'},CAL={B:'ℬ',E:'ℰ',F:'ℱ',H:'ℋ',I:'ℐ',L:'ℒ',M:'ℳ',R:'ℛ',e:'ℯ',g:'ℊ',o:'ℴ'},FRAK={C:'ℭ',H:'ℌ',I:'ℑ',R:'ℜ',Z:'ℨ'};
 const styled=(ch,font)=>{const A=ch>='A'&&ch<='Z',a=ch>='a'&&ch<='z';if(!A&&!a)return ch;
  if(font==='bb')return BB[ch]||String.fromCodePoint((A?0x1D538-65:0x1D552-97)+ch.charCodeAt(0));
  if(font==='cal')return CAL[ch]||String.fromCodePoint((A?0x1D49C-65:0x1D4B6-97)+ch.charCodeAt(0));
  if(font==='frak')return FRAK[ch]||String.fromCodePoint((A?0x1D504-65:0x1D51E-97)+ch.charCodeAt(0));
  return ch;};
 const SUP={'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻','−':'⁻','n':'ⁿ','i':'ⁱ','(':'⁽',')':'⁾','=':'⁼'},SUB={'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉','+':'₊','-':'₋','−':'₋','(':'₍',')':'₎','=':'₌'};
 const script=(text,map,mark)=>{const t=text.trim();if(!t)return '';if([...t].every(ch=>map[ch]))return [...t].map(ch=>map[ch]).join('');return mark+(/^[\p{L}\p{N}]+$/u.test(t)||[...t].length===1?t:`(${t})`);};
 const DELIMS=bare({'(':'(',')':')','[':'[',']':']','|':'|','/':'/','.':'','<':'⟨','>':'⟩'});
 const ENVS=bare({matrix:['',''],smallmatrix:['',''],pmatrix:['(',')'],bmatrix:['[',']'],Bmatrix:['{','}'],vmatrix:['|','|'],Vmatrix:['‖','‖'],cases:['{',''],array:['',''],aligned:['',''],align:['',''],'align*':['',''],split:['',''],gathered:['',''],gather:['',''],'gather*':['',''],equation:['',''],'equation*':['',''],eqnarray:['',''],'eqnarray*':['','']});
 const ALIGNED=['aligned','align','align*','split','eqnarray','eqnarray*'];

 // ---- The parser: TeX in, {m: MathML, p: plain text} out -----------------------------------------------------
 const mi=(text,attrs='')=>`<mi${attrs}>${E(text)}</mi>`,mo=(text,attrs='')=>`<mo${attrs}>${E(text)}</mo>`,mn=(text,attrs='')=>`<mn${attrs}>${E(text)}</mn>`;
 const row=m=>`<mrow>${m}</mrow>`,small=m=>`<mrow class="rd-ms">${m}</mrow>`;
 const node=(m,p,extra)=>({m,p,...extra});
 const fence=(ch,stretchy=true)=>ch?mo(ch,` fence="true" stretchy="${stretchy}"`):'';
 function convert(tex,display=false){
  const s=String(tex??'').replace(/\u00a0/g,' ').trim();
  if(!s||s.length>LIMIT.length)return null;
  let i=0,depth=0,parts=0;
  const fail=()=>{throw FAIL;};
  const ws=()=>{while(i<s.length&&/\s/.test(s[i]))i++;};
  // A token: {c: a character} or {cmd: a command name}. peek() does not consume.
  const read=()=>{ws();if(i>=s.length)return null;const ch=s[i];
   if(ch!=='\\'){const cp=String.fromCodePoint(s.codePointAt(i));i+=cp.length;return {c:cp};}
   const m=/^\\([A-Za-z]+\*?|[\s\S])/.exec(s.slice(i,i+40));if(!m)fail();i+=m[0].length;return {cmd:m[1]};};
  const peek=()=>{const at=i,t=read();i=at;return t;};
  const isC=(t,ch)=>t&&t.c===ch,isCmd=(t,name)=>t&&t.cmd===name;
  const expect=ch=>{const t=read();if(!isC(t,ch))fail();};
  // The raw text of a {…} argument (for \text, \begin{…}, \ce{…}): braces balanced, nothing interpreted.
  const rawArg=()=>{ws();if(s[i]!=='{')fail();let level=0,start=i+1;for(;i<s.length;i++){if(s[i]==='\\'){i++;continue;}if(s[i]==='{')level++;else if(s[i]==='}'&&--level===0){const text=s.slice(start,i);i++;return text;}}return fail();};
  const join=list=>node(list.map(x=>x.m).join(''),list.map(x=>x.p).join('').replace(/\s+/g,' '),{n:list.length,single:list.length===1?list[0]:null});
  function group(stop,font){if(++depth>LIMIT.depth)fail();const list=[];
   for(;;){const t=peek();if(!t||stop(t))break;let x=scripted(font);
    // A function name after an operand (2x cos θ, ‖b‖ cos θ) keeps a thin space before it, as in TeX.
    if(x.named&&list.length&&/[\p{L}\p{N})\]}‖|′⁰¹²³⁴-⁹₀-₉]$/u.test(list[list.length-1].p))x=node('<mspace width="0.167em"/>'+x.m,x.p,{n:2});
    list.push(x);if(++parts>LIMIT.parts)fail();}
   depth--;return join(list);}
  const braces=font=>{expect('{');const g=group(t=>isC(t,'}'),font);expect('}');return g;};
  // One argument: a braced group, or a single token.
  const arg=font=>{const t=peek();if(!t)fail();if(isC(t,'{'))return braces(font);return atom(font);};
  const wrapped=x=>x.n===1?x.m:row(x.m);
  // An atom with its subscript, superscript and primes.
  function scripted(font){
   const t=peek();let base=isC(t,'^')||isC(t,'_')||isC(t,"'")?node(row(''),'',{}):atom(font),sub=null,sup=null,primes='';
   for(;;){const n=peek();
    if(isC(n,'^')&&!sup){read();sup=arg(font);}
    else if(isC(n,'_')&&!sub){read();sub=arg(font);}
    else if(isC(n,"'")){read();primes+='′';}
    else break;}
   if(primes){const p=node(mo(primes),primes,{n:1});sup=sup?node(p.m+sup.m,p.p+sup.p,{n:2}):p;}
   let out=base;
   if(sub||sup){
    const b=wrapped(base),lo=sub&&small(sub.m),hi=sup&&small(sup.m),under=base.lim;
    const m=sub&&sup?`<${under?'munderover':'msubsup'}>${b}${lo}${hi}</${under?'munderover':'msubsup'}>`:sub?`<${under?'munder':'msub'}>${b}${lo}</${under?'munder':'msub'}>`:`<${under?'mover':'msup'}>${b}${hi}</${under?'mover':'msup'}>`;
    const p=base.p.replace(/ $/,'')+(sub?script(sub.p,SUB,'_'):'')+(sup?(sup.p===primes?primes:script(sup.p,SUP,'^')):'')+(/ $/.test(base.p)?' ':'');
    out=node(m,p,{n:1,fn:base.fn,lim:false});
   }
   // A function name is applied to what follows: an invisible operator, and a thin space unless a bracket follows.
   if(out.fn){const n=peek(),tight=!n||isC(n,'(')||isCmd(n,'left')||isC(n,'}')||isC(n,'^')||isC(n,'_');out=node(row(out.m+mo('\u2061')+(tight?'':'<mspace width="0.167em"/>')),out.p.replace(/ $/,'')+(tight?'':' '),{n:1,named:true});}
   return out;}
  const letter=(ch,font)=>{
   if(font==='bf')return node(mi(ch,' mathvariant="normal" class="rd-mb"'),ch,{n:1});
   if(font==='bs')return node(mi(ch,' class="rd-mb"'),ch,{n:1});
   if(font==='rm')return node(mi(ch,' mathvariant="normal"'),ch,{n:1});
   if(font==='sf')return node(mi(ch,' mathvariant="normal" class="rd-msf"'),ch,{n:1});
   if(font==='tt')return node(mi(ch,' mathvariant="normal" class="rd-mtt"'),ch,{n:1});
   if(font==='bb'||font==='cal'||font==='frak'){const out=styled(ch,font);return node(mi(out,' mathvariant="normal"'),out,{n:1});}
   return node(mi(ch),ch,{n:1});};
  const delimiter=()=>{const t=read();if(!t)fail();
   if(t.c!==undefined){if(!(t.c in DELIMS))fail();return DELIMS[t.c];}
   if(t.cmd==='{'||t.cmd==='lbrace')return '{';if(t.cmd==='}'||t.cmd==='rbrace')return '}';if(t.cmd==='|')return '‖';
   const sym=SYM[t.cmd];if(sym&&'⟨⟩⌊⌋⌈⌉|‖[]↑↓\\'.includes(sym))return sym;return fail();};
  function environment(){
   const name=rawArg().trim(),env=ENVS[name];if(!env)fail();
   if(name==='array'){ws();if(s[i]==='{')rawArg();}
   const rows=[[]];
   for(;;){
    const cell=group(t=>isC(t,'&')||isCmd(t,'\\')||isCmd(t,'end')||isCmd(t,'cr'));rows[rows.length-1].push(cell);
    const t=read();if(!t)fail();
    if(isC(t,'&'))continue;
    if(isCmd(t,'\\')||isCmd(t,'cr')){ws();if(s[i]==='['){const close=s.indexOf(']',i);if(close<0)fail();i=close+1;}rows.push([]);continue;}
    if(isCmd(t,'end')){if(rawArg().trim()!==name)fail();break;}
    fail();}
   if(rows.length>1&&rows[rows.length-1].length===1&&!rows[rows.length-1][0].m)rows.pop();
   if(rows.length>40||rows.some(r=>r.length>20))fail();
   const aligned=ALIGNED.includes(name),cases=name==='cases';
   const cls=(c)=>aligned?(c%2?' class="rd-ml"':' class="rd-mr"'):cases||name==='array'&&false?' class="rd-ml"':'';
   const table=`<mtable${aligned?' class="rd-mal"':cases?' class="rd-mcases"':''}>${rows.map(r=>`<mtr>${r.map((c,k)=>`<mtd${cls(k)}>${c.m}</mtd>`).join('')}</mtr>`).join('')}</mtable>`;
   const plain=rows.map(r=>r.map(c=>c.p.trim()).filter(Boolean).join(aligned?' ':cases?' ':', ')).filter(Boolean).join('; ');
   const open=env[0],close=env[1];
   return node(open||close?row(fence(open)+table+fence(close)):table,cases?`{${plain}}`:aligned||!open?plain:`${open==='('?'(':open}${plain}${close}`,{n:1});}
  // Chemistry (a small part of mhchem's \ce): H2O, Fe^{3+}, SO4^2-, 2H2 + O2 -> 2H2O, <=>, (aq).
  function chemistry(raw){
   let k=0,m='',p='',prev='';const text=raw.trim();if(/[\\{}]/.test(text.replace(/\^\{[^{}]*\}|_\{[^{}]*\}/g,'')))fail();
   const up=x=>`<mrow class="rd-ms">${x}</mrow>`;
   const attach=(kind,content,plain)=>{m=m.replace(/(<(mi|mo|mrow|msub|msup|msubsup)\b[^>]*>(?:(?!<\/\2>).)*<\/\2>)$/,(all)=>`<${kind}>${all}${up(content)}</${kind}>`);p+=plain;};
   while(k<text.length){const rest=text.slice(k);let x;
    if((x=/^\s+/.exec(rest))){m+='<mspace width="0.25em"/>';p+=' ';prev=' ';}
    else if((x=/^(<=>|<->|->|<-)/.exec(rest))){const arrow={'<=>':'⇌','<->':'↔','->':'→','<-':'←'}[x[0]];m+=mo(arrow);p+=` ${arrow} `;prev='op';}
    else if((x=/^\((aq|s|l|g)\)/.exec(rest))){m+=`<mtext>${E(x[0])}</mtext>`;p+=x[0];prev='state';}
    else if((x=/^[A-Z][a-z]?/.exec(rest))){m+=mi(x[0],' mathvariant="normal"');p+=x[0];prev='el';}
    else if((x=/^\d+(\.\d+)?/.exec(rest))){if(prev==='el'||prev===')'){attach('msub',mn(x[0]),script(x[0],SUB,'_'));prev='sub';}else{m+=mn(x[0]);p+=x[0];prev='num';}}
    else if((x=/^\^\{([^{}]*)\}|^\^(\d*[+-]+|\d+)/.exec(rest))){const v=(x[1]??x[2]).replace(/-/g,'−');if(!/^[\d+−]+$/.test(v)||!m)fail();attach('msup',mn(v.replace(/[+−]/g,''))+(/[+−]/.test(v)?mo(v.replace(/\d/g,'')):''),script(v,SUP,'^'));prev='sup';}
    else if((x=/^_\{([^{}]*)\}|^_(\d+)/.exec(rest))){const v=x[1]??x[2];if(!/^[\dA-Za-z]+$/.test(v)||!m)fail();attach('msub',/^\d+$/.test(v)?mn(v):mi(v),script(v,SUB,'_'));prev='sub';}
    else if((x=/^[+-]/.exec(rest))){const sign=x[0]==='-'?'−':'+',after=text[k+1];
     if((prev==='el'||prev==='sub'||prev===')')&&(after===undefined||/[\s)\]]/.test(after))){attach('msup',mo(sign),SUP[sign]);prev='sup';}
     else{m+=mo(sign);p+=prev===' '?sign+' ':` ${sign} `;prev='op';}}
    else if((x=/^[()\[\]]/.exec(rest))){m+=mo(x[0],' stretchy="false"');p+=x[0];prev=x[0]===')'||x[0]===']'?')':'(';}
    else if((x=/^[*.]/.exec(rest))){m+=mo('⋅');p+='·';prev='op';}
    else if((x=/^=/.exec(rest))){m+=mo('=');p+=' = ';prev='op';}
    else fail();
    k+=x[0].length;if(++parts>LIMIT.parts)fail();}
   return node(row(m),p.replace(/\s+/g,' ').trim(),{n:1});}
  function atom(font){
   const t=read();if(!t)fail();
   if(t.c!==undefined){const ch=t.c;
    if(ch==='{'){i-=1;return braces(font);}
    if(ch==='}'||ch==='$'||ch==='#')fail();
    if(/\d/.test(ch)){const m=/^[\d]*(?:\.\d+)?/.exec(s.slice(i))[0];i+=m.length;const text=ch+m;return node(mn(text,font==='bf'||font==='bs'?' class="rd-mb"':''),text,{n:1});}
    if(/\p{L}/u.test(ch))return letter(ch,font);
    if(ch==='-')return node(mo('−'),' − ',{n:1});
    if(ch==='|'){if(s[i]==='|'){i++;return node(mo('‖',' stretchy="false"'),'‖',{n:1});}return node(mo('|',' stretchy="false"'),'|',{n:1});}
    if('()[]'.includes(ch))return node(mo(ch,' stretchy="false"'),ch,{n:1});
    if(ch==='~')return node('<mspace width="0.333em"/>',' ',{n:1});
    if(ch==='&')return node('',' ',{n:0});
    if(ch===','||ch===';')return node(mo(ch),ch+' ',{n:1});
    if(RELATION.has(ch)||ch==='='||ch==='<'||ch==='>'||ch==='+')return node(mo(ch),` ${ch} `,{n:1});
    if(ch==='*')return node(mo('∗'),'∗',{n:1});
    if('/:!?.@%'.includes(ch)||/[\p{S}\p{P}]/u.test(ch))return node(mo(ch),ch,{n:1});
    return fail();}
   const c=t.cmd;
   if(c in IDENT)return node(mi(IDENT[c],/^[A-Z]/.test(c)&&c!=='Re'&&c!=='Im'?' mathvariant="normal"':''),IDENT[c],{n:1});
   if(c in SYM){const ch=SYM[c];return node(mo(ch,'|‖⟨⟩⌊⌋⌈⌉{}[]'.includes(ch)?' stretchy="false"':''),ch==='⋅'?'·':RELATION.has(ch)?` ${ch} `:ch,{n:1});}
   if(FUNC.includes(c))return node(mi(c),` ${c} `,{n:1,fn:true});
   if(LIMFUNC.includes(c))return node(mo(c==='limsup'?'lim sup':c==='liminf'?'lim inf':c,' movablelimits="true"'),` ${c} `,{n:1,fn:true,lim:true});
   if(c in BIG)return node(mo(BIG[c],' largeop="true" movablelimits="true"'),BIG[c],{n:1,lim:true});
   if(c in INTEGRAL)return node(mo(INTEGRAL[c],' largeop="true"'),INTEGRAL[c],{n:1});
   if(c in SPACE)return node(`<mspace width="${SPACE[c]}"/>`,SPACE[c].startsWith('-')?'':' ',{n:1});
   if(IGNORED.includes(c))return node('','',{n:0});
   if('{}%$#&_'.includes(c)&&c.length===1)return node(mo(c,c==='{'||c==='}'?' stretchy="false"':''),c,{n:1});
   if(c==='|')return node(mo('‖',' stretchy="false"'),'‖',{n:1});
   if(c==='\\'||c==='cr'||c==='newline')return node('<mspace width="1em"/>',' ',{n:1});
   if(c==='frac'||c==='dfrac'||c==='tfrac'||c==='cfrac'){const a=arg(font),b=arg(font),simple=x=>/^[\p{L}\p{N}.]+$/u.test(x.p.trim());
    return node(`<mfrac>${row(a.m)}${row(b.m)}</mfrac>`,`${simple(a)?a.p.trim():`(${a.p.trim()})`}/${simple(b)?b.p.trim():`(${b.p.trim()})`}`,{n:1});}
   if(c==='binom'||c==='dbinom'||c==='tbinom'){const a=arg(font),b=arg(font);return node(row(fence('(')+`<mfrac linethickness="0">${row(a.m)}${row(b.m)}</mfrac>`+fence(')')),`C(${a.p.trim()}, ${b.p.trim()})`,{n:1});}
   if(c==='sqrt'){ws();let index=null;if(s[i]==='['){i++;index=group(t=>isC(t,']'),font);expect(']');}const a=arg(font),inner=/^[\p{L}\p{N}.]+$/u.test(a.p.trim())?a.p.trim():`(${a.p.trim()})`;
    return index?node(`<mroot>${row(a.m)}${small(index.m)}</mroot>`,`${script(index.p,SUP,'')||''}√${inner}`,{n:1}):node(`<msqrt>${a.m}</msqrt>`,`√${inner}`,{n:1});}
   if(c in FONT){
    // \mathrm{proj}: a word in upright letters is one identifier.
    if(FONT[c]==='rm'){const at=i;ws();if(s[i]==='{'){const raw=rawArg();if(/^[A-Za-z][A-Za-z0-9 ]*$/.test(raw))return node(mi(raw.replace(/ /g,'\u00a0'),' mathvariant="normal"'),raw+' ',{n:1,fn:raw.length>1});i=at;}}
    return arg(FONT[c]);}
   if(TEXT.includes(c)){const raw=rawArg();if(/[\\{}$]/.test(raw.replace(/\\[%&#_ ]/g,'')))fail();const text=raw.replace(/\\([%&#_ ])/g,'$1');
    return node(`<mtext${c==='textbf'?' class="rd-mb"':c==='textit'?' class="rd-mit"':''}>${E(text.replace(/^ | $/g,'\u00a0'))}</mtext>`,text,{n:1});}
   if(c==='operatorname'||c==='operatorname*'){const raw=rawArg();if(!/^[A-Za-z][A-Za-z0-9 ]*$/.test(raw))fail();return c.endsWith('*')?node(mo(raw,' movablelimits="true"'),raw+' ',{n:1,fn:true,lim:true}):node(mi(raw,' mathvariant="normal"'),raw+' ',{n:1,fn:true});}
   if(c in ACCENT){const a=arg(font),[mark,stretchy,combining]=ACCENT[c],single=[...a.p.trim()].length===1;
    return node(`<mover accent="true">${row(a.m)}${mo(mark,` stretchy="${stretchy}"`)}</mover>`,single?a.p.trim()+combining:a.p,{n:1});}
   if(c==='underline'){const a=arg(font);return node(`<munder accentunder="true">${row(a.m)}${mo('_',' stretchy="true"')}</munder>`,a.p,{n:1});}
   if(c==='overset'||c==='stackrel'||c==='underset'){const a=arg(font),b=arg(font),tag=c==='underset'?'munder':'mover';return node(`<${tag}>${row(b.m)}${small(a.m)}</${tag}>`,b.p,{n:1});}
   if(c==='overbrace'||c==='underbrace'){const a=arg(font),over=c==='overbrace';return node(`<${over?'mover':'munder'}>${row(a.m)}${mo(over?'⏞':'⏟',' stretchy="true"')}</${over?'mover':'munder'}>`,a.p,{n:1,lim:true});}
   if(c==='boxed'){const a=arg(font);return node(`<mrow class="rd-mbox">${a.m}</mrow>`,a.p,{n:1});}
   if(c==='not'){const a=atom(font);return node(a.m.replace(/<\/(mo|mi)>$/,'\u0338</$1>'),a.p.trim()==='='?' ≠ ':a.p.replace(/(\S)(\s*)$/,'$1\u0338$2'),{n:1});}
   if(c==='left'){const open=delimiter(),inner=group(t=>isCmd(t,'right'),font);read();const close=delimiter();return node(row(fence(open)+inner.m+fence(close)),(open||'')+inner.p.trim()+(close||''),{n:1});}
   if(c==='middle'){const d=delimiter();return node(fence(d),` ${d} `,{n:1});}
   if(c==='right')fail();
   {const m=/^(big|Big|bigg|Bigg)([lrm]?)$/.exec(c);if(m){const d=delimiter();return node(d?mo(d,` stretchy="true" minsize="${SIZED[m[1]]}" maxsize="${SIZED[m[1]]}"`):'',d,{n:1});}}
   if(c==='begin')return environment();
   if(c==='ce')return chemistry(rawArg());
   if(c==='pmod'){const a=arg(font);return node(row('<mspace width="0.444em"/>'+mo('(',' stretchy="false"')+mi('mod')+'<mspace width="0.333em"/>'+a.m+mo(')',' stretchy="false"')),` (mod ${a.p.trim()})`,{n:1});}
   if(c==='bmod'||c==='mod')return node(mo('mod',' lspace="0.222em" rspace="0.222em"'),' mod ',{n:1});
   if(c==='phantom'||c==='hphantom'||c==='vphantom'){const a=arg(font);return node(`<mphantom>${a.m}</mphantom>`,'',{n:1});}
   return fail();}
  try{
   const g=group(()=>false);if(i<s.length)return null;
   const plain=g.p.replace(/\s+/g,' ').replace(/ ([,;)\]])/g,'$1').replace(/([(\[]) /g,'$1').trim().replace(/(^|[(\[{=<>≤≥≈,;±→⇒]\s?)− /g,'$1−');
   return g.m?{mathml:g.m,plain}:null;
  }catch(error){if(error===FAIL)return null;throw error;}
 }
 // ---- Markup for the page ------------------------------------------------------------------------------------
 function html(tex,{display=false,source}={}){
  const out=convert(tex,display);
  if(!out)return `<code class="rd-math-raw">${E(source??tex)}</code>`;
  const math=`<math class="rd-math"${display?' display="block"':''} aria-label="${E(out.plain)}"><semantics>${row(out.mathml)}<annotation encoding="application/x-tex">${E(String(tex).trim())}</annotation></semantics></math>`;
  return display?`<span class="rd-math-block">${math}</span>`:math;}
 // \( … \) and \[ … \] and $$ … $$ (never a single $: prices). A part is {text} or {tex, display, source}.
 const DELIMITED=/\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$/g;
 function split(text){const out=[],s=String(text??'');let last=0;
  for(const m of s.matchAll(DELIMITED)){if(m.index>last)out.push({text:s.slice(last,m.index)});out.push({tex:m[1]??m[2]??m[3],display:m[1]===undefined,source:m[0]});last=m.index+m[0].length;}
  if(last<s.length)out.push({text:s.slice(last)});return out;}
  const hasMath=text=>/\\\(|\\\[|\$\$/.test(String(text??''));
 // Text for the page: escaped, with its mathematics rendered. `budget` ({left}) caps the expressions per document.
 function renderText(text,budget={left:LIMIT.count}){
  if(!hasMath(text))return E(text);
  return split(text).map(part=>part.tex===undefined?E(part.text):budget.left-->0?html(part.tex,part):`<code class="rd-math-raw">${E(part.source)}</code>`).join('');}
 // The same in plain text, for list rows, excerpts and search: a·b = ‖a‖‖b‖ cos θ instead of raw TeX.
 function plain(text){
  if(!hasMath(text))return String(text??'');
  let left=LIMIT.count;
  return split(text).map(part=>part.tex===undefined?part.text:(left-->0&&convert(part.tex,part.display)?.plain)||part.tex.replace(/\\[,;:! ]/g,' ').replace(/\\([A-Za-z]+)/g,'$1 ').replace(/[{}]/g,'').replace(/\s+/g,' ').trim()).join('');}
 // Canvas's equation editor stores an image with its TeX beside it.
 const decode=v=>String(v).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&');
 function equationTeX(markup){
  return String(markup??'').replace(/<img\b[^>]*>/gi,tag=>{if(!/\bclass\s*=\s*"[^"]*\bequation_image\b/i.test(tag))return tag;
   const m=/\bdata-equation-content\s*=\s*"([^"]*)"/i.exec(tag)||/\balt\s*=\s*"LaTeX:\s*([^"]*)"/i.exec(tag);return m&&m[1].trim()?` \\(${decode(m[1]).trim()}\\) `:tag;});}
 function imageTeX(node){
  if(!/(^|\s)equation_image(\s|$)/.test(node?.getAttribute?.('class')||''))return '';
  const data=node.getAttribute('data-equation-content'),alt=/^LaTeX:\s*([\s\S]+)$/.exec(node.getAttribute('alt')||'');
  return String(data||alt?.[1]||'').trim();}
 // MathML that is already in the teacher's HTML: only MathML Core's presentation elements and a short list of
 // attributes with checked values pass; text is escaped; anything else (annotation-xml, maction, href, style,
 // event handlers, foreign elements) is dropped with its attributes, keeping only its allowed descendants' text.
 const M_TAGS=new Set('math mrow mi mn mo mtext mspace ms mfrac msqrt mroot msub msup msubsup munder mover munderover mmultiscripts mprescripts none mtable mtr mtd mstyle mpadded mphantom merror semantics annotation'.split(' '));
 const M_ATTRS={display:/^(block|inline)$/,mathvariant:/^[a-z-]{1,24}$/,displaystyle:/^(true|false)$/,scriptlevel:/^[+-]?\d$/,stretchy:/^(true|false)$/,fence:/^(true|false)$/,separator:/^(true|false)$/,largeop:/^(true|false)$/,movablelimits:/^(true|false)$/,symmetric:/^(true|false)$/,accent:/^(true|false)$/,accentunder:/^(true|false)$/,form:/^(prefix|infix|postfix)$/,
  lspace:/^-?[\d.]{1,6}(em|ex|px|pt|%)?$/,rspace:/^-?[\d.]{1,6}(em|ex|px|pt|%)?$/,width:/^-?[\d.]{1,6}(em|ex|px|pt|%)?$/,height:/^-?[\d.]{1,6}(em|ex|px|pt|%)?$/,depth:/^-?[\d.]{1,6}(em|ex|px|pt|%)?$/,minsize:/^[\d.]{1,6}(em|ex|px|pt|%)?$/,maxsize:/^[\d.]{1,6}(em|ex|px|pt|%)?$/,linethickness:/^([\d.]{1,6}(em|ex|px|pt|%)?|thin|medium|thick)$/,columnspan:/^[1-9]\d?$/,rowspan:/^[1-9]\d?$/,dir:/^(ltr|rtl)$/,encoding:/^application\/x-tex$/};
 function cleanMathML(node,state={left:LIMIT.parts}){
  if(!node||state.left--<=0)return '';
  if(node.nodeType===3)return E(node.textContent);
  if(node.nodeType!==1)return '';
  const tag=String(node.localName||node.tagName||'').toLowerCase(),inside=()=>Array.from(node.childNodes||[]).map(child=>cleanMathML(child,state)).join('');
  if(tag==='annotation-xml'||tag==='script'||tag==='style'||tag==='annotation'&&!/^application\/x-tex$/.test(node.getAttribute?.('encoding')||''))return '';
  if(!M_TAGS.has(tag))return inside();
  let attrs='';for(const [name,ok] of Object.entries(M_ATTRS)){const value=node.getAttribute?.(name);if(value!=null&&ok.test(String(value).trim()))attrs+=` ${name}="${E(String(value).trim())}"`;}
  if(tag==='math'){const block=/\bdisplay="block"/.test(attrs),body=`<math class="rd-math"${attrs}>${inside()}</math>`;return block?`<span class="rd-math-block">${body}</span>`:body;}
  if(tag==='annotation')return `<annotation${attrs}>${E(node.textContent||'')}</annotation>`;
  return tag==='mspace'||tag==='none'||tag==='mprescripts'?`<${tag}${attrs}/>`:`<${tag}${attrs}>${inside()}</${tag}>`;}
 const api={convert,html,split,hasMath,renderText,plain,equationTeX,imageTeX,cleanMathML,limits:LIMIT};
 root.ReserveMath=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
