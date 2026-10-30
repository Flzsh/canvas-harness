const {test}=require('node:test'),assert=require('node:assert/strict');
const {patchUI}=require('../extension/dashboard.js').helpers;
// Small DOM contract fixture: identity, ordering, attributes and live properties.
class Element{
 constructor(tag,attrs={},children=[]){this.nodeType=1;this.nodeName=this.tagName=tag.toUpperCase();this.attrs={...attrs};this.childNodes=[];this.value='';this.checked=false;this.classList={contains:name=>(this.attrs.class||'').split(' ').includes(name)};for(const child of children)this.insertBefore(child,null);}
 get id(){return this.attrs.id||'';}get attributes(){return Object.entries(this.attrs).map(([name,value])=>({name,value}));}
 get firstChild(){return this.childNodes[0]||null;}get nextSibling(){return this.parentNode?.childNodes[this.parentNode.childNodes.indexOf(this)+1]||null;}
 getAttribute(name){return this.attrs[name]??null;}hasAttribute(name){return Object.hasOwn(this.attrs,name);}
 setAttribute(name,value){this.attrs[name]=value;}removeAttribute(name){delete this.attrs[name];}
 insertBefore(child,before){child.remove();const i=before?this.childNodes.indexOf(before):this.childNodes.length;assert.ok(i>=0);this.childNodes.splice(i,0,child);child.parentNode=this;}
 remove(){if(this.parentNode){this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this),1);this.parentNode=null;}}
}
const el=(tag,attrs,children)=>new Element(tag,attrs,children);
test('selection and inserted content retain the actual list, reader and focused control nodes',()=>{
 const input=el('textarea'),list=el('section',{'data-rd-key':'work'}),reader=el('aside',{'data-rd-key':'reader'},[input]);input.value='Original';reader.scrollTop=120;
 const current=el('main',{},[list,reader]),nextInput=el('textarea');nextInput.value='Saved edit';
 const next=el('main',{},[el('div',{'data-rd-key':'notice'}),el('section',{'data-rd-key':'work',class:'selected'}),el('aside',{'data-rd-key':'reader'},[nextInput])]);
 patchUI(current,next);assert.equal(current.childNodes[1],list);assert.equal(current.childNodes[2],reader);assert.equal(reader.firstChild,input);assert.equal(input.value,'Saved edit');assert.equal(reader.scrollTop,120);assert.equal(list.getAttribute('class'),'selected');
});
test('keyed assignment reorder reuses nodes and removes departed items without duplicate copies',()=>{
 const a=el('article',{'data-rd-key':'a'}),b=el('article',{'data-rd-key':'b'}),c=el('article',{'data-rd-key':'c'}),list=el('div',{},[a,b,c]);
 patchUI(list,el('div',{},[el('article',{'data-rd-key':'c'}),el('article',{'data-rd-key':'b',class:'selected'})]));
 assert.deepEqual(list.childNodes,[c,b]);assert.equal(a.parentNode,null);assert.equal(b.getAttribute('class'),'selected');
});
test('grade removal is immediate while native disclosure state and running motion survive',()=>{
 const grade=el('b',{'aria-label':'93%'}),details=el('details',{open:''}),current=el('div',{'data-motion':'entering'},[details,grade]);
 patchUI(current,el('div',{},[el('details')]));assert.equal(grade.parentNode,null);assert.equal(current.getAttribute('data-motion'),'entering');assert.equal(details.hasAttribute('open'),true);
 const input=el('input');input.checked=true;const updated=el('input');updated.checked=false;patchUI(input,updated);assert.equal(input.checked,false);
});

test('filtering messages cannot transfer an expanded disclosure to a different conversation',()=>{
 const old=el('details',{'data-rd-section':'message-1',open:''}),current=el('div',{},[old]);
 const desired=el('details',{'data-rd-section':'message-2'});patchUI(current,el('div',{},[desired]));
 assert.equal(current.firstChild,desired);assert.equal(desired.hasAttribute('open'),false);assert.equal(old.parentNode,null);
 const closed=el('details',{'data-rd-section':'module-1'});patchUI(closed,el('details',{'data-rd-section':'module-1',open:''}));assert.equal(closed.hasAttribute('open'),false);
});
test('a re-rendered selection surface keeps the geometry motion.js wrote on it, and nothing else of its old style',()=>{
 const style=props=>{const p={...props};return {get length(){return Object.keys(p).length;},get cssText(){return Object.entries(p).map(([k,v])=>k+': '+v).join('; ');},[Symbol.iterator]:function*(){yield* Object.keys(p);},getPropertyValue:k=>p[k]??'',setProperty:(k,v)=>{p[k]=v;},props:p};};
 const current=el('div',{class:'rd-assignment-list'}),next=el('div',{class:'rd-assignment-list'});current.style=style({'--rd-sel-pick-y':'42px','--rd-echo-pick-h':'90px','--rd-course':'red'});next.style=style({});
 patchUI(current,next);assert.deepEqual(next.style.props,{'--rd-sel-pick-y':'42px','--rd-echo-pick-h':'90px'});
 const old=el('div');old.style=style({'--rd-sel-pick-y':'10px'});const fresh=el('div');fresh.style=style({'--rd-sel-pick-y':'99px'});patchUI(old,fresh);assert.equal(fresh.style.props['--rd-sel-pick-y'],'99px','a value the new render sets wins');
});
// A drawing that already equals the wanted one is not walked at all; any difference, including one other code wrote on
// a part, still takes the full patch and keeps the nodes.
test('an unchanged SVG drawing is skipped whole while a changed one is still patched in place',()=>{
 const NS='http://www.w3.org/2000/svg';
 class Svg extends Element{
  constructor(tag,attrs,children){super(tag,attrs,children);this.localName=tag;this.namespaceURI=NS;this.walked=0;}
  get attributes(){this.walked++;return super.attributes;}
  isEqualNode(other){const sorted=node=>JSON.stringify(Object.entries(node.attrs).sort());return !!other&&other.localName===this.localName&&other.namespaceURI===this.namespaceURI&&sorted(this)===sorted(other)&&this.childNodes.length===other.childNodes.length&&this.childNodes.every((child,i)=>child.isEqualNode(other.childNodes[i]));}
 }
 const svg=(attrs,children)=>new Svg('svg',attrs,children),g=attrs=>new Svg('g',attrs),wanted=()=>svg({class:'rd-frame-orn',style:'--at:0'},[g({class:'a-fin'})]);
 const part=g({class:'a-fin'}),drawing=svg({style:'--at:0',class:'rd-frame-orn'},[part]);
 patchUI(drawing,wanted());assert.equal(drawing.walked+part.walked,0,'attribute order aside, nothing in it is walked');assert.equal(drawing.firstChild,part);
 part.setAttribute('data-x','other code');
 patchUI(drawing,wanted());assert.equal(part.hasAttribute('data-x'),false,'a part other code wrote on takes the full patch');assert.equal(drawing.firstChild,part,'and keeps its node');
 const box=el('div',{},[drawing]);patchUI(box,el('div',{},[svg({class:'rd-frame-orn',style:'--at:0.5'},[g({class:'a-fin'})])]));assert.equal(box.firstChild,drawing);assert.equal(drawing.getAttribute('style'),'--at:0.5','a changed drawing is patched where it stands');
});
// A living part (a drawing's loop, a frame ornament's loop on the film clock) shows its frames through --rd-tf/--rd-op,
// which motion.js writes on it inline. A render keeps them, so whether the part moves never depends on when the last
// render happened; a value the markup sets still wins, and a part motion.js has let go of keeps nothing.
test('a re-rendered living part keeps the custom properties motion.js moves it by, and nothing else of its old style',()=>{
 const style=props=>{const p={...props};return {get length(){return Object.keys(p).length;},get cssText(){return Object.entries(p).map(([k,v])=>k+': '+v).join('; ');},[Symbol.iterator]:function*(){yield* Object.keys(p);},getPropertyValue:k=>p[k]??'',setProperty:(k,v)=>{p[k]=v;},props:p};};
 const current=el('svg',{class:'rd-frame-orn'}),next=el('svg',{class:'rd-frame-orn'});
 current.style=style({'--rd-tf':'translate(3px, -2px)','--rd-op':'0.6',transform:'var(--rd-tf)',opacity:'var(--rd-op)',color:'red'});next.style=style({});
 patchUI(current,next);assert.deepEqual(next.style.props,{'--rd-tf':'translate(3px, -2px)','--rd-op':'0.6',transform:'var(--rd-tf)',opacity:'var(--rd-op)'});
 const own=el('svg');own.style=style({'--rd-tf':'rotate(2deg)',transform:'var(--rd-tf)'});const drawn=el('svg');drawn.style=style({transform:'translate(9px)'});patchUI(own,drawn);
 assert.equal(drawn.style.props.transform,'translate(9px)','a transform the markup sets wins');assert.equal(drawn.style.props['--rd-tf'],'rotate(2deg)');
 const freed=el('svg');freed.style=style({transform:'translate(1px)'});const plain=el('svg');plain.style=style({});patchUI(freed,plain);assert.deepEqual(plain.style.props,{},'a part not moved by the film keeps nothing');
});
