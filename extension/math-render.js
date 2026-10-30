/* Canvas Harness Help cards: the mathematics in the AI's text, as MathML built with DOM calls.
   The student's web AI writes TeX between $ $, $$ $$, \( \) or \[ \]; Help cards show it as MathML, which Chromium draws
   natively (MathML Core). Canvas Harness's own small converter: no library, no fonts, no network, nothing evaluated.

   SAFE BY CONSTRUCTION: TeX is parsed into a tree of a fixed set of MathML tags with a fixed set of attributes; every
   piece of text becomes a text node (or, in toMathML, escaped text), so "<" and ">" are only ever relations. \href and \html…
   keep only their visible text; \url is dropped; any command it does not know makes the whole expression fall back to
   its TeX source in a small code style. Inputs are capped (length, nesting, parts, expressions per text).

     CanvasHarnessMath.split(text)                 [{text}|{code, block?, lang?}|{tex, display, source}]
     CanvasHarnessMath.convert(tex, display)       {tree, plain} or null
     CanvasHarnessMath.toMathML(tree)              escaped MathML markup (tests and checks)
     CanvasHarnessMath.node(doc, part, {inline})   one DOM node for a maths part (MathML, a plain fallback, or code)
     CanvasHarnessMath.plain(text)                 the text with its maths in a readable plain form (labels, counts)

   Money is not maths: an inline $ needs a non-space after it and no letter or digit before it (a spreadsheet reference
   such as $A$1 stays text), the next $ needs a non-space before it and no digit after it, so "$5 and $10" stays text. Code spans (`x`, ```x```) are left alone. */
(function(root){
 'use strict';
 const NS='http://www.w3.org/1998/Math/MathML';
 const LIMIT={length:2000,depth:40,parts:3000,count:120};
 const FAIL={};
 const bare=object=>Object.assign(Object.create(null),object);
 const words=text=>bare(Object.fromEntries(text.trim().split(/\s+/).map(pair=>{const i=pair.indexOf(':');return [pair.slice(0,i),pair.slice(i+1)];})));
 // ---- Tables (no prototypes: a command named like an Object method must not be found) ---------------------------
 const IDENT=words('alpha:α beta:β gamma:γ delta:δ epsilon:ϵ varepsilon:ε zeta:ζ eta:η theta:θ vartheta:ϑ iota:ι kappa:κ lambda:λ mu:μ nu:ν xi:ξ pi:π varpi:ϖ rho:ρ varrho:ϱ sigma:σ varsigma:ς tau:τ upsilon:υ phi:ϕ varphi:φ chi:χ psi:ψ omega:ω Gamma:Γ Delta:Δ Theta:Θ Lambda:Λ Xi:Ξ Pi:Π Sigma:Σ Upsilon:Υ Phi:Φ Psi:Ψ Omega:Ω infty:∞ partial:∂ nabla:∇ ell:ℓ hbar:ℏ emptyset:∅ varnothing:∅ aleph:ℵ Re:ℜ Im:ℑ imath:ı jmath:ȷ angle:∠ triangle:△ square:□ degree:° prime:′ top:⊤ bot:⊥');
 const SYM=words('cdot:⋅ cdotp:⋅ times:× div:÷ pm:± mp:∓ ast:∗ star:⋆ circ:∘ bullet:• oplus:⊕ otimes:⊗ cup:∪ cap:∩ setminus:∖ wedge:∧ land:∧ vee:∨ lor:∨ neg:¬ lnot:¬ le:≤ leq:≤ ge:≥ geq:≥ leqslant:⩽ geqslant:⩾ ne:≠ neq:≠ approx:≈ equiv:≡ sim:∼ simeq:≃ cong:≅ propto:∝ ll:≪ gg:≫ in:∈ notin:∉ ni:∋ subset:⊂ subseteq:⊆ supset:⊃ supseteq:⊇ perp:⊥ parallel:∥ mid:∣ to:→ rightarrow:→ leftarrow:← gets:← leftrightarrow:↔ Rightarrow:⇒ Leftarrow:⇐ Leftrightarrow:⇔ implies:⟹ iff:⟺ mapsto:↦ longrightarrow:⟶ longleftarrow:⟵ Longrightarrow:⟹ longleftrightarrow:⟷ uparrow:↑ downarrow:↓ rightleftharpoons:⇌ leftrightharpoons:⇋ rightleftarrows:⇄ forall:∀ exists:∃ nexists:∄ therefore:∴ because:∵ cdots:⋯ ldots:… dots:… vdots:⋮ ddots:⋱ colon:: lt:< gt:> langle:⟨ rangle:⟩ lfloor:⌊ rfloor:⌋ lceil:⌈ rceil:⌉ vert:| lvert:| rvert:| Vert:‖ lVert:‖ rVert:‖ lbrace:{ rbrace:} lbrack:[ rbrack:]');
 SYM.backslash='\\';
 const RELATION=new Set('= < > ≤ ≥ ⩽ ⩾ ≠ ≈ ≡ ∼ ≃ ≅ ∝ ≪ ≫ ∈ ∉ ∋ ⊂ ⊆ ⊃ ⊇ → ← ↔ ⇒ ⇐ ⇔ ⟹ ⟺ ↦ ⟶ ⟵ ⟷ ⇌ ⇋ ⇄ × ÷ ± ∓ + − ∪ ∩ ∧ ∨ ⊕ ⊗ ∴ ∵ ⊥ ∥ ∣ ⋅'.split(' '));
 const FUNC=new Set('sin cos tan cot sec csc arcsin arccos arctan sinh cosh tanh coth ln log lg exp arg deg dim ker hom'.split(' '));
 const LIMFUNC=new Set('lim limsup liminf max min sup inf det gcd Pr'.split(' '));
 const BIG=words('sum:∑ prod:∏ coprod:∐ bigcup:⋃ bigcap:⋂ bigoplus:⨁ bigotimes:⨂ bigvee:⋁ bigwedge:⋀');
 const INTEGRAL=words('int:∫ iint:∬ iiint:∭ oint:∮');
 // Accents: [mark, stretchy, combining character for the plain form].
 const ACCENT=bare({
  vec:['→',false,'⃗'],
  hat:['^',false,'̂'],
  widehat:['^',true,'̂'],
  bar:['¯',false,'̄'],
  overline:['¯',true,'̅'],
  tilde:['~',false,'̃'],
  widetilde:['~',true,'̃'],
  dot:['˙',false,'̇'],
  ddot:['¨',false,'̈'],
  overrightarrow:['→',true,'⃗'],
  overleftarrow:['←',true,'⃖'],
  check:['ˇ',false,'̌'],
  breve:['˘',false,'̆'],
  acute:['´',false,'́'],
  grave:['`',false,'̀']
 });
 const SPACE=bare({
  ',':'0.167em',
  ':':'0.222em',
  '>':'0.222em',
  ';':'0.278em',
  '!':'-0.167em',
  ' ':'0.333em',
  quad:'1em',
  qquad:'2em',
  enspace:'0.5em',
  thinspace:'0.167em',
  medspace:'0.222em',
  thickspace:'0.278em',
  negthinspace:'-0.167em'
 });
 const FONT=bare({mathbf:'bf',bf:'bf',boldsymbol:'bs',bm:'bs',mathrm:'rm',rm:'rm',mathit:'it',mathsf:'rm',mathtt:'rm',mathbb:'bb',mathcal:'cal',mathscr:'cal',mathfrak:'frak',mathnormal:''});
 const TEXT=new Set(['text','textrm','textnormal','mbox','textbf','textit','textsf','texttt','textup','hbox']);
 const IGNORED=new Set(['displaystyle','textstyle','scriptstyle','scriptscriptstyle','limits','nolimits','nonumber','notag','strut','mathstrut','allowbreak','relax','hfill','centering','left.','right.']);
 const SIZED=bare({big:'1.2em',Big:'1.8em',bigg:'2.4em',Bigg:'3em'});
 const DELIMS=bare({'(':'(',')':')','[':'[',']':']','|':'|','/':'/','.':'','<':'⟨','>':'⟩'});
 const ENVS=bare({
  matrix:['',''],
  smallmatrix:['',''],
  pmatrix:['(',')'],
  bmatrix:['[',']'],
  Bmatrix:['{','}'],
  vmatrix:['|','|'],
  Vmatrix:['‖','‖'],
  cases:['{',''],
  dcases:['{',''],
  rcases:['','}'],
  array:['',''],
  aligned:['',''],
  align:['',''],
  'align*':['',''],
  alignat:['',''],
  'alignat*':['',''],
  split:['',''],
  gathered:['',''],
  gather:['',''],
  'gather*':['',''],
  equation:['',''],
  'equation*':['',''],
  eqnarray:['',''],
  'eqnarray*':['','']
 });
 const ALIGNED=new Set(['aligned','align','align*','alignat','alignat*','split','eqnarray','eqnarray*']);
 // \mathbf and \boldsymbol use the Mathematical Alphanumeric letters, which every math font has; the plain form keeps ASCII.
 const BB={C:'ℂ',H:'ℍ',N:'ℕ',P:'ℙ',Q:'ℚ',R:'ℝ',Z:'ℤ'},
  CAL={B:'ℬ',E:'ℰ',F:'ℱ',H:'ℋ',I:'ℐ',L:'ℒ',M:'ℳ',R:'ℛ',e:'ℯ',g:'ℊ',o:'ℴ'},
  FRAK={C:'ℭ',H:'ℌ',I:'ℑ',R:'ℜ',Z:'ℨ'};
 const styled=(ch,font)=>{const A=ch>='A'&&ch<='Z',a=ch>='a'&&ch<='z',d=ch>='0'&&ch<='9';
  if(font==='bf'){if(A||a)return String.fromCodePoint((A?0x1D400-65:0x1D41A-97)+ch.charCodeAt(0));if(d)return String.fromCodePoint(0x1D7CE-48+ch.charCodeAt(0));return ch;}
  if(font==='bs'){if(A||a)return String.fromCodePoint((A?0x1D468-65:0x1D482-97)+ch.charCodeAt(0));if(d)return String.fromCodePoint(0x1D7CE-48+ch.charCodeAt(0));return ch;}
  if(!A&&!a)return ch;
  if(font==='bb')return BB[ch]||String.fromCodePoint((A?0x1D538-65:0x1D552-97)+ch.charCodeAt(0));
  if(font==='cal')return CAL[ch]||String.fromCodePoint((A?0x1D49C-65:0x1D4B6-97)+ch.charCodeAt(0));
  if(font==='frak')return FRAK[ch]||String.fromCodePoint((A?0x1D504-65:0x1D51E-97)+ch.charCodeAt(0));
  return ch;};
 const SUP={'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻','−':'⁻','n':'ⁿ','i':'ⁱ','(':'⁽',')':'⁾','=':'⁼'},
  SUB={'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉','+':'₊','-':'₋','−':'₋','(':'₍',')':'₎','=':'₌'};
 const script=(text,map,mark)=>{
  const t=text.trim();
  if(!t)return '';
  if([...t].every(ch=>map[ch]))return [...t].map(ch=>map[ch]).join('');
  return mark+(/^[\p{L}\p{N}]+$/u.test(t)||[...t].length===1?t:`(${t})`);
 };

 // ---- The tree: {t: tag, a: attributes, x: text} for tokens, {t, a, k: children} for the rest --------------------
 const T=(t,x,a)=>({t,x:String(x),a}),K=(t,k,a)=>({t,k,a});
 const mi=(x,a)=>T('mi',x,a),mo=(x,a)=>T('mo',x,a),mn=(x,a)=>T('mn',x,a),mtext=(x,a)=>T('mtext',x,a);
 const row=k=>K('mrow',k),gap=w=>K('mspace',[],{width:w});
 const fence=(ch,stretchy=true)=>ch?[mo(ch,{fence:'true',stretchy:String(stretchy)})]:[];
 const node=(m,p,extra)=>({m,p,...extra});
 const one=x=>x.m.length===1?x.m[0]:row(x.m);
 function convert(tex,display=false){
  const s=String(tex??'').replace(/ /g,' ').trim();
  if(!s||s.length>LIMIT.length)return null;
  let i=0,depth=0,parts=0;
  const fail=()=>{throw FAIL;};
  const ws=()=>{while(i<s.length&&/\s/.test(s[i]))i++;};
  // A token: {c: a character} or {cmd: a command name}. A backslash before white space is {cmd: ' '}.
  const read=()=>{ws();if(i>=s.length)return null;const ch=s[i];
   if(ch!=='\\'){const cp=String.fromCodePoint(s.codePointAt(i));i+=cp.length;return {c:cp};}
   const m=/^\\([A-Za-z]+\*?|[\s\S])/.exec(s.slice(i,i+40));if(!m)fail();i+=m[0].length;return {cmd:/^\s$/.test(m[1])?' ':m[1]};};
  const peek=()=>{const at=i,t=read();i=at;return t;};
  const isC=(t,ch)=>t&&t.c===ch,isCmd=(t,name)=>t&&t.cmd===name;
  const expect=ch=>{const t=read();if(!isC(t,ch))fail();};
  const rawArg=()=>{
   ws();
   if(s[i]!=='{')fail();
   let level=0;
   const start=i+1;
   for(;i<s.length;i++){if(s[i]==='\\'){i++;continue;}if(s[i]==='{')level++;else if(s[i]==='}'&&--level===0){const text=s.slice(start,i);i++;return text;}}
   return fail();
  };
  const optArg=()=>{ws();if(s[i]!=='[')return null;const close=s.indexOf(']',i);if(close<0)fail();const text=s.slice(i+1,close);i=close+1;return text;};
  const join=list=>node(list.flatMap(x=>x.m),list.map(x=>x.p).join('').replace(/\s+/g,' '));
  function group(stop,font){if(++depth>LIMIT.depth)fail();const list=[];
   for(;;){const t=peek();if(!t||stop(t))break;let x=scripted(font);
    // A function name after an operand (2x cos θ) keeps a thin space before it, as in TeX.
    if(x.named&&list.length&&/[\p{L}\p{N})\]}‖|′⁰¹²³⁴-⁹₀-₉]$/u.test(list[list.length-1].p))x=node([gap('0.167em'),...x.m],x.p);
    // A sign that starts a group or follows an operator, a relation, an opening bracket or a comma is a prefix sign:
    // no operator space on either side ((−2), = −5.7), where MathML Core would space it like subtraction.
    if(x.sign){const before=list[list.length-1];if(!before||before.op||before.open)x=node([mo(x.sign,{lspace:'0',rspace:'0'})],x.sign);}
    list.push(x);if(++parts>LIMIT.parts)fail();}
   depth--;return join(list);}
  const braces=font=>{expect('{');const g=group(t=>isC(t,'}'),font);expect('}');return g;};
  const arg=font=>{const t=peek();if(!t)fail();if(isC(t,'{'))return braces(font);return atom(font);};
  function scripted(font){
   const t=peek();let base=isC(t,'^')||isC(t,'_')||isC(t,"'")?node([row([])],''):atom(font),sub=null,sup=null,primes='';
   for(;;){const n=peek();
    if(isC(n,'^')&&!sup){read();sup=arg(font);}
    else if(isC(n,'_')&&!sub){read();sub=arg(font);}
    else if(isC(n,"'")){read();primes+='′';}
    else break;}
   if(primes){const p=node([mo(primes)],primes);sup=sup?node([...p.m,...sup.m],p.p+sup.p):p;}
   let out=base;
   if(sub||sup){
    const b=one(base),under=base.lim,lo=sub&&row(sub.m),hi=sup&&row(sup.m);
    const m=sub&&sup?K(under?'munderover':'msubsup',[b,lo,hi]):sub?K(under?'munder':'msub',[b,lo]):K(under?'mover':'msup',[b,hi]);
    const p=base.p.replace(/ $/,'')+(sub?script(sub.p,SUB,'_'):'')+(sup?(sup.p===primes?primes:sup.p.trim()==='∘'?'°':script(sup.p,SUP,'^')):'')+(/ $/.test(base.p)?' ':'');
    out=node([m],p,{fn:base.fn});
   }
   // A function name applies to what follows: an invisible operator, and a thin space unless a bracket follows.
   if(out.fn){
    const n=peek(),tight=!n||isC(n,'(')||isCmd(n,'left')||isC(n,'}')||isC(n,'^')||isC(n,'_');
    out=node([row([...out.m,mo('\u2061'),...(tight?[]:[gap('0.167em')])])],out.p.replace(/ $/,'')+(tight?'':' '),{named:true});
   }
   return out;}
  const letter=(ch,font)=>{
   if(font==='bf'||font==='bs'||font==='bb'||font==='cal'||font==='frak'){const out=styled(ch,font);return node([mi(out,{mathvariant:'normal'})],ch);}
   if(font==='rm')return node([mi(ch,{mathvariant:'normal'})],ch);
   return node([mi(ch)],ch);};
  const delimiter=()=>{const t=read();if(!t)fail();
   if(t.c!==undefined){if(!(t.c in DELIMS))fail();return DELIMS[t.c];}
   if(t.cmd==='{'||t.cmd==='lbrace')return '{';if(t.cmd==='}'||t.cmd==='rbrace')return '}';if(t.cmd==='|')return '‖';
   const sym=SYM[t.cmd];if(sym&&'⟨⟩⌊⌋⌈⌉|‖[]↑↓{}'.includes(sym))return sym;return fail();};
  function environment(){
   const name=rawArg().trim(),env=ENVS[name];if(!env)fail();
   if(name==='array'||name==='alignat'||name==='alignat*'){ws();if(s[i]==='{')rawArg();}
   const rows=[[]];
   // In a table a backslash before white space ends the row too: a reply that escaped "\\" once for JSON leaves one.
   const end=t=>isC(t,'&')||isCmd(t,'\\')||isCmd(t,' ')||isCmd(t,'end')||isCmd(t,'cr');
   for(;;){
    const cell=group(end);rows[rows.length-1].push(cell);
    const t=read();if(!t)fail();
    if(isC(t,'&'))continue;
    if(isCmd(t,'\\')||isCmd(t,'cr')||isCmd(t,' ')){optArg();rows.push([]);continue;}
    if(isCmd(t,'end')){if(rawArg().trim()!==name)fail();break;}
    fail();}
   if(rows.length>1&&rows[rows.length-1].length===1&&!rows[rows.length-1][0].m.length)rows.pop();
   if(rows.length>40||rows.some(r=>r.length>20))fail();
   const aligned=ALIGNED.has(name),cases=/cases$/.test(name);
   const cls=k=>aligned?(k%2?'ch-ml':'ch-mr'):cases?'ch-ml':undefined;
   const table=K(
    'mtable',
    rows.map(r=>K('mtr',r.map((c,k)=>K('mtd',[row(c.m)],cls(k)?{class:cls(k)}:undefined)))),
    aligned?{class:'ch-mal'}:cases?{class:'ch-mcases'}:name==='smallmatrix'?{class:'ch-msmall'}:undefined);
   const plain=rows.map(r=>r.map(c=>c.p.trim()).filter(Boolean).join(aligned||cases?' ':', ')).filter(Boolean).join('; ');
   const [open,close]=env;
   return node(open||close?[row([...fence(open),table,...fence(close)])]:[table],cases?`{${plain}}`:aligned||!open?plain:`${open}${plain}${close}`);}
  // Chemistry (a small part of mhchem's \ce): H2O, Fe^{3+}, SO4^2-, 2H2 + O2 -> 2H2O, <=>, (aq).
  function chemistry(raw){
   const m=[];let k=0,p='',prev='';const text=raw.trim();if(/[\\{}]/.test(text.replace(/\^\{[^{}]*\}|_\{[^{}]*\}/g,'')))fail();
   const attach=(kind,content,plain)=>{const last=m.pop();if(!last)fail();m.push(K(kind,[last,row(content)]));p+=plain;};
   while(k<text.length){const rest=text.slice(k);let x;
    if((x=/^\s+/.exec(rest))){m.push(gap('0.25em'));p+=' ';prev=' ';}
    else if((x=/^(<=>|<->|->|<-)/.exec(rest))){const arrow={'<=>':'⇌','<->':'↔','->':'→','<-':'←'}[x[0]];m.push(mo(arrow));p+=` ${arrow} `;prev='op';}
    else if((x=/^\((aq|s|l|g)\)/.exec(rest))){m.push(mtext(x[0]));p+=x[0];prev='state';}
    else if((x=/^[A-Z][a-z]?/.exec(rest))){m.push(mi(x[0],{mathvariant:'normal'}));p+=x[0];prev='el';}
    else if((x=/^\d+(\.\d+)?/.exec(rest))){if(prev==='el'||prev===')'){attach('msub',[mn(x[0])],script(x[0],SUB,'_'));prev='sub';}else{m.push(mn(x[0]));p+=x[0];prev='num';}}
    else if((x=/^\^\{([^{}]*)\}|^\^(\d*[+-]+|\d+)/.exec(rest))){
     const v=(x[1]??x[2]).replace(/-/g,'−');
     if(!/^[\d+−]+$/.test(v))fail();
     const digits=v.replace(/[+−]/g,''),sign=v.replace(/\d/g,'');
     attach('msup',[...(digits?[mn(digits)]:[]),...(sign?[mo(sign)]:[])],script(v,SUP,'^'));
     prev='sup';
    }
    else if((x=/^_\{([^{}]*)\}|^_(\d+)/.exec(rest))){const v=x[1]??x[2];if(!/^[\dA-Za-z]+$/.test(v))fail();attach('msub',[/^\d+$/.test(v)?mn(v):mi(v)],script(v,SUB,'_'));prev='sub';}
    else if((x=/^[+-]/.exec(rest))){const sign=x[0]==='-'?'−':'+',after=text[k+1];
     if((prev==='el'||prev==='sub'||prev===')')&&(after===undefined||/[\s)\]]/.test(after))){attach('msup',[mo(sign)],SUP[sign]);prev='sup';}
     else{m.push(mo(sign));p+=prev===' '?sign+' ':` ${sign} `;prev='op';}}
    else if((x=/^[()[\]]/.exec(rest))){m.push(mo(x[0],{stretchy:'false'}));p+=x[0];prev=x[0]===')'||x[0]===']'?')':'(';}
    else if((x=/^[*.]/.exec(rest))){m.push(mo('⋅'));p+='·';prev='op';}
    else if((x=/^=/.exec(rest))){m.push(mo('='));p+=' = ';prev='op';}
    else fail();
    k+=x[0].length;if(++parts>LIMIT.parts)fail();}
   return node([row(m)],p.replace(/\s+/g,' ').trim());}
  function atom(font){
   const t=read();if(!t)fail();
   if(t.c!==undefined){const ch=t.c;
    if(ch==='{'){i-=1;return braces(font);}
    if(ch==='}'||ch==='$'||ch==='#')fail();
    if(/\d/.test(ch)){
     const more=/^\d*(?:\.\d+)?/.exec(s.slice(i))[0];
     i+=more.length;
     const text=ch+more;
     return node([mn(font==='bf'||font==='bs'?[...text].map(c=>styled(c,font)).join(''):text)],text);
    }
    if(/\p{L}/u.test(ch))return letter(ch,font);
    if(ch==='-'||ch==='−')return node([mo('−')],' − ',{sign:'−',op:true});
    if(ch==='|'){if(s[i]==='|'){i++;return node([mo('‖',{stretchy:'false'})],'‖');}return node([mo('|',{stretchy:'false'})],'|');}
    if('()[]'.includes(ch))return node([mo(ch,{stretchy:'false'})],ch,ch==='('||ch==='['?{open:true}:undefined);
    if(ch==='~')return node([gap('0.333em')],' ');
    if(ch==='&')return node([],' ');
    if(ch===','||ch===';')return node([mo(ch)],ch+' ',{op:true});
    if(RELATION.has(ch)||ch==='='||ch==='<'||ch==='>'||ch==='+')return node([mo(ch==='·'?'⋅':ch)],ch==='⋅'?'·':` ${ch} `,{op:true,...(ch==='+'?{sign:'+'}:{})});
    // A solidus is an ordinary symbol in TeX: m/s and a/b, never m / s.
    if(ch==='/')return node([mo('/',{lspace:'0',rspace:'0'})],'/');
    if(ch==='*')return node([mo('∗')],'∗');
    if(ch==='·')return node([mo('⋅')],'·');
    if('/:!?.@%'.includes(ch)||/[\p{S}\p{P}]/u.test(ch))return node([mo(ch)],ch);
    return fail();}
   const c=t.cmd;
   if(c in IDENT)return node([mi(IDENT[c],/^[A-Z]/.test(c)&&c!=='Re'&&c!=='Im'?{mathvariant:'normal'}:undefined)],IDENT[c]);
   if(c in SYM){
    const ch=SYM[c];
    return node(
     [mo(ch,'|‖⟨⟩⌊⌋⌈⌉{}[]'.includes(ch)?{stretchy:'false'}:undefined)],
     ch==='⋅'?'·':RELATION.has(ch)?` ${ch} `:ch,
     RELATION.has(ch)?{op:true}:'⟨⌊⌈{['.includes(ch)?{open:true}:undefined);
   }
   if(FUNC.has(c))return node([mi(c)],` ${c} `,{fn:true});
   if(LIMFUNC.has(c))return node([mo(c==='limsup'?'lim sup':c==='liminf'?'lim inf':c,{movablelimits:'true'})],` ${c} `,{fn:true,lim:true});
   if(c in BIG)return node([mo(BIG[c],{largeop:'true',movablelimits:'true'})],BIG[c],{lim:true});
   if(c in INTEGRAL)return node([mo(INTEGRAL[c],{largeop:'true'})],INTEGRAL[c]);
   if(c in SPACE)return node([gap(SPACE[c])],SPACE[c].startsWith('-')?'':' ');
   if(IGNORED.has(c))return node([],'');
   if(c.length===1&&'{}%$#&_'.includes(c))return node([mo(c,c==='{'||c==='}'?{stretchy:'false'}:undefined)],c,c==='{'?{open:true}:undefined);
   if(c==='|')return node([mo('‖',{stretchy:'false'})],'‖');
   if(c==='\\'||c===' '||c==='cr'||c==='newline')return node([gap(c===' '?'0.333em':'1em')],' ');
   if(c==='frac'||c==='dfrac'||c==='tfrac'||c==='cfrac'){const a=arg(font),b=arg(font),simple=x=>/^[\p{L}\p{N}.]+$/u.test(x.p.trim());
    return node(
     [K('mfrac',[row(a.m),row(b.m)],c==='dfrac'?{displaystyle:'true'}:c==='tfrac'?{displaystyle:'false'}:undefined)],
     `${simple(a)?a.p.trim():`(${a.p.trim()})`}/${simple(b)?b.p.trim():`(${b.p.trim()})`}`);}
   if(c==='binom'||c==='dbinom'||c==='tbinom'){
    const a=arg(font),b=arg(font);
    return node([row([...fence('('),K('mfrac',[row(a.m),row(b.m)],{linethickness:'0'}),...fence(')')])],`C(${a.p.trim()}, ${b.p.trim()})`);
   }
   if(c==='sqrt'){ws();let index=null;if(s[i]==='['){i++;index=group(t=>isC(t,']'),font);expect(']');}const a=arg(font),inner=/^[\p{L}\p{N}.]+$/u.test(a.p.trim())?a.p.trim():`(${a.p.trim()})`;
    return index?node([K('mroot',[row(a.m),row(index.m)])],`${script(index.p,SUP,'')||''}√${inner}`):node([K('msqrt',a.m)],`√${inner}`);}
   if(c in FONT){
    // \mathrm{proj}: a word in upright letters is one identifier.
    if(FONT[c]==='rm'){
     const at=i;
     ws();
     if(s[i]==='{'){const raw=rawArg();if(/^[A-Za-z][A-Za-z0-9 ]*$/.test(raw))return node([mi(raw.replace(/ /g,' '),{mathvariant:'normal'})],raw+(raw.length>1?' ':''),{fn:false});i=at;}
    }
    return arg(FONT[c]);}
   if(TEXT.has(c)){const raw=rawArg();if(/[\\{}$]/.test(raw.replace(/\\[%&#_ $]/g,'')))fail();const text=raw.replace(/\\([%&#_ $])/g,'$1');
    return node([mtext(text.replace(/^ | $/g,' '),c==='textbf'?{class:'ch-mb'}:c==='textit'?{class:'ch-mit'}:undefined)],text);}
   if(c==='operatorname'||c==='operatorname*'){
    const raw=rawArg();
    if(!/^[A-Za-z][A-Za-z0-9 ]*$/.test(raw))fail();
    return c.endsWith('*')?node([mo(raw,{movablelimits:'true'})],raw+' ',{fn:true,lim:true}):node([mi(raw,{mathvariant:'normal'})],raw+' ',{fn:true});
   }
   if(c in ACCENT){const a=arg(font),[mark,stretchy,combining]=ACCENT[c],single=[...a.p.trim()].length===1;
    return node([K('mover',[row(a.m),mo(mark,{stretchy:String(stretchy)})],{accent:'true'})],single?a.p.trim()+combining:a.p);}
   if(c==='underline'){const a=arg(font);return node([K('munder',[row(a.m),mo('_',{stretchy:'true'})],{accentunder:'true'})],a.p);}
   if(c==='overset'||c==='stackrel'||c==='underset'){const a=arg(font),b=arg(font);return node([K(c==='underset'?'munder':'mover',[row(b.m),row(a.m)])],b.p);}
   if(c==='xrightarrow'||c==='xleftarrow'||c==='xrightleftharpoons'){
    const below=optArg(),above=arg(font),ch={xrightarrow:'→',xleftarrow:'←',xrightleftharpoons:'⇌'}[c],under=below===null?null:convert(below);
    return node([K(under?'munderover':'mover',[mo(ch,{stretchy:'true'}),...(under?[row([under.tree])]:[]),row(above.m)])],` ${ch} `);}
   if(c==='overbrace'||c==='underbrace'){const a=arg(font),over=c==='overbrace';return node([K(over?'mover':'munder',[row(a.m),mo(over?'⏞':'⏟',{stretchy:'true'})])],a.p,{lim:true});}
   if(c==='boxed'||c==='fbox'){const a=c==='fbox'?node([mtext(rawArg())],''):arg(font);return node([K('mrow',a.m,{class:'ch-mbox'})],a.p);}
   if(c==='not'){const a=atom(font),last=a.m[a.m.length-1];if(!last||last.x===undefined)fail();last.x+='̸';return node(a.m,a.p.trim()==='='?' ≠ ':a.p.replace(/(\S)(\s*)$/,'$1̸$2'));}
   if(c==='left'){
    const open=delimiter(),inner=group(t=>isCmd(t,'right'),font);
    if(!isCmd(read(),'right'))fail();
    const close=delimiter();
    return node([row([...fence(open),...inner.m,...fence(close)])],(open||'')+inner.p.trim()+(close||''));
   }
   if(c==='middle'){const d=delimiter();return node(fence(d),` ${d} `);}
   if(c==='right')fail();
   {const m=/^(big|Big|bigg|Bigg)([lrm]?)$/.exec(c);if(m){const d=delimiter();return node(d?[mo(d,{stretchy:'true',minsize:SIZED[m[1]],maxsize:SIZED[m[1]]})]:[],d);}}
   if(c==='begin')return environment();
   if(c==='ce')return chemistry(rawArg());
   if(c==='pmod'){
    const a=arg(font);
    return node([row([gap('0.444em'),mo('(',{stretchy:'false'}),mi('mod',{mathvariant:'normal'}),gap('0.333em'),...a.m,mo(')',{stretchy:'false'})])],` (mod ${a.p.trim()})`);
   }
   if(c==='bmod'||c==='mod')return node([mo('mod',{lspace:'0.222em',rspace:'0.222em'})],' mod ');
   if(c==='phantom'||c==='hphantom'||c==='vphantom'){const a=arg(font);return node([K('mphantom',a.m)],'');}
   // Colour and links never reach the page: \color and \textcolor keep their maths, \href and \html… keep only their
   // visible text, \url is dropped.
   if(c==='color'){rawArg();return node([],'');}
   if(c==='textcolor'||c==='colorbox'){rawArg();return arg(font);}
   if(c==='href'||c==='htmlClass'||c==='htmlId'||c==='htmlStyle'||c==='htmlData'){rawArg();return arg(font);}
   if(c==='url'){rawArg();return node([],'');}
   return fail();}
  try{
   const g=group(()=>false);if(i<s.length)return null;
   if(!g.m.length)return null;
   const plain=g.p.replace(/\s+/g,' ').replace(/ ([,;)\]])/g,'$1').replace(/([([]) /g,'$1').trim().replace(/(^|[([{=<>≤≥≈,;±→⇒]\s?)− /g,'$1−');
   return {tree:g.m.length===1?g.m[0]:row(g.m),plain};
  }catch(error){if(error===FAIL)return null;throw error;}
 }

 // ---- Output: escaped markup (tests) and DOM nodes (cards) ---------------------------------------------------------
 const TAGS=new Set('math semantics annotation mrow mi mn mo mtext mspace mfrac msqrt mroot msub msup msubsup munder mover munderover mtable mtr mtd mphantom'.split(' '));
 const ATTRS=new Set('display displaystyle class mathvariant stretchy fence largeop movablelimits accent accentunder linethickness width lspace rspace minsize maxsize encoding aria-label'.split(' '));
 const esc=v=>String(v??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
 function toMathML(t){
  if(!t||!TAGS.has(t.t))return '';
  const attrs=Object.entries(t.a||{}).filter(([k,v])=>ATTRS.has(k)&&v!=null).map(([k,v])=>` ${k}="${esc(v)}"`).join('');
  if(t.t==='mspace')return `<mspace${attrs}/>`;
  return `<${t.t}${attrs}>${t.x!==undefined?esc(t.x):(t.k||[]).map(toMathML).join('')}</${t.t}>`;}
 function build(doc,t){
  if(!t||!TAGS.has(t.t))return null;
  const n=doc.createElementNS(NS,t.t);
  for(const [k,v] of Object.entries(t.a||{}))if(ATTRS.has(k)&&v!=null)n.setAttribute(k,String(v));
  if(t.x!==undefined)n.textContent=t.x;else for(const kid of t.k||[]){const c=build(doc,kid);if(c)n.append(c);}
  return n;}
 const wrapMath=(conv,tex,display)=>
  K(
   'math',
   [K('semantics',[conv.tree.t==='mrow'?conv.tree:row([conv.tree]),T('annotation',String(tex).trim(),{encoding:'application/x-tex'})])],
   {class:'ch-math',...(display?{display:'block'}:{}),'aria-label':conv.plain});
 // A maths part as one node: MathML where the page can build it, its plain form where it cannot (a test DOM, an old
 // engine), its TeX as quiet code when the TeX is not understood. `inline` keeps display maths in the line (row heads).
 function mathNode(doc,part,{inline=false}={}){
  const display=!!part.display&&!inline,conv=convert(part.tex,display),make=(tag,cls,text)=>{
   const n=doc.createElement(tag);
   n.className=cls;
   n.textContent=text;
   return n;
  };
  if(!conv){const code=make('code','ch-math-raw',String(part.tex).trim());return code;}
  if(typeof doc.createElementNS!=='function'){const n=make('span','ch-math-plain'+(display?' ch-math-plain-block':''),conv.plain);return n;}
  const math=build(doc,wrapMath(conv,part.tex,display));
  if(!display)return math;
  const block=doc.createElement('span');block.className='ch-math-block';block.append(math);return block;}
 // ---- Finding the maths in text ------------------------------------------------------------------------------------
 // Parts in order: {text}, {code} (a `code` span, left alone; a fenced block is {code, block:true, lang}) and
 // {tex, display, source}.
 function split(text){
  const s=String(text??''),out=[];let buf='',i=0,count=0;
  const flush=()=>{if(buf){out.push({text:buf});buf='';}};
  const math=(tex,display,source)=>{if(++count>LIMIT.count){buf+=source;return;}flush();out.push({tex,display,source});};
  while(i<s.length){const c=s[i];
   if(c==='`'){
    const ticks=/^`+/.exec(s.slice(i))[0],end=s.indexOf(ticks,i+ticks.length);
    if(end>i){flush();const body=s.slice(i+ticks.length,end),fenced=ticks.length>=3&&/^[\w+#.-]{0,20}[ \t]*\r?\n/.exec(body);
     // A fenced block (three backticks, an optional language name, a line break): its lines and indentation as written.
     if(fenced)out.push({code:body.slice(fenced[0].length).replace(/\r\n?/g,'\n').replace(/\n[ \t]*$/,''),block:true,lang:fenced[0].trim()});
     else out.push({code:body.replace(/^\n|\n$/g,'')});i=end+ticks.length;continue;}buf+=ticks;i+=ticks.length;continue;}
   if(c==='\\'){const n=s[i+1];
    if(n==='('||n==='['){const close=n==='('?'\\)':'\\]',end=s.indexOf(close,i+2);if(end>i+2&&s.slice(i+2,end).trim()){math(s.slice(i+2,end),n==='[',s.slice(i,end+2));i=end+2;continue;}}
    if(n==='$'){buf+='$';i+=2;continue;}
    buf+=c;i++;continue;}
   if(c==='$'){
    if(s[i+1]==='$'){const end=s.indexOf('$$',i+2);if(end>i+2&&s.slice(i+2,end).trim()){math(s.slice(i+2,end),true,s.slice(i,end+2));i=end+2;continue;}buf+='$$';i+=2;continue;}
    // Inline: a non-space after the opening $, the NEXT $ closes it, with a non-space before it and no digit after.
    if(i+1<s.length&&!/\s/.test(s[i+1])&&!/[\p{L}\p{N}]/u.test(s[i-1]||'')){let j=i+1;while(j<s.length&&s[j]!=='$'){if(s[j]==='\\')j++;j++;}
     if(j<s.length&&j>i+1&&!/\s/.test(s[j-1])&&!/\d/.test(s[j+1]||'')){math(s.slice(i+1,j),false,s.slice(i,j+1));i=j+1;continue;}}
    buf+='$';i++;continue;}
   buf+=c;i++;}
  flush();return out;}
 const hasMath=text=>/\$|\\\(|\\\[|`/.test(String(text??''));
 // The text in plain form: maths as it reads (x² + 1), code as written; for labels, search and counts.
 function plain(text){
  if(!hasMath(text))return String(text??'');
  return split(text).map(p=>p.text!==undefined?p.text:p.code!==undefined?p.code:(convert(p.tex,p.display)?.plain||p.tex.trim())).join('');}
 const api={NS,LIMIT,convert,toMathML,split,hasMath,plain,node:mathNode,build};
 root.CanvasHarnessMath=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
