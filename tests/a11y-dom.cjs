'use strict';
// A very small DOM for tests that need a live element tree from the app's own markup (a11y-42, 2026-11-22): elements
// built from HTML strings (tests/a11y-lint.cjs parses them), the few selectors the planner's quick add uses, and the
// node moves it makes (replaceWith, after, prepend, remove). Not a browser.
const L=require('./a11y-lint.cjs');
const camel=k=>k.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
class Text{constructor(t){this.nodeType=3;this.data=t;this.parentNode=null;}get textContent(){return this.data;}get outerHTML(){return this.data.replace(/&/g,'&amp;').replace(/</g,'&lt;');}}
class Element{
 constructor(tag,attrs={},doc=null){this.nodeType=1;this.tagName=tag.toUpperCase();this.localName=tag;this.attrs={...attrs};this.childNodes=[];this.parentNode=null;this.ownerDocument=doc;this.value=attrs.value||'';
  this.dataset=new Proxy({},{get:(o,k)=>this.attrs['data-'+String(k).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())],set:(o,k,v)=>{this.attrs['data-'+String(k).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())]=String(v);return true;},deleteProperty:(o,k)=>{delete this.attrs['data-'+String(k).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())];return true;}});}
 get children(){return this.childNodes.filter(n=>n.nodeType===1);}get firstElementChild(){return this.children[0]||null;}
 get className(){return this.attrs.class||'';}set className(v){this.attrs.class=v;}
 get nextElementSibling(){const s=this.parentNode?.children||[];return s[s.indexOf(this)+1]||null;}
 getAttribute(k){return this.attrs[k]??null;}setAttribute(k,v){this.attrs[k]=String(v);}removeAttribute(k){delete this.attrs[k];}hasAttribute(k){return k in this.attrs;}
 get textContent(){return this.childNodes.map(n=>n.textContent).join('');}set textContent(v){this.childNodes=[];if(v!=='')this.append(new Text(String(v)));}
 get outerHTML(){const a=Object.entries(this.attrs).map(([k,v])=>` ${k}="${String(v).replace(/"/g,'&quot;')}"`).join('');return `<${this.localName}${a}>${this.innerHTML}</${this.localName}>`;}
 get innerHTML(){return this.childNodes.map(n=>n.outerHTML).join('');}
 set innerHTML(html){this.childNodes=[];const build=(n,into)=>{for(const c of n.children||[]){if(c.text!==undefined){into.append(new Text(c.text));continue;}const e=new Element(c.tag,c.attrs,this.ownerDocument);into.append(e);build(c,e);}};build(L.parse(html),this);}
 append(...ns){for(const n of ns){n.parentNode?.childNodes&&(n.parentNode.childNodes=n.parentNode.childNodes.filter(x=>x!==n));n.parentNode=this;this.childNodes.push(n);}}
 prepend(n){n.parentNode&&(n.parentNode.childNodes=n.parentNode.childNodes.filter(x=>x!==n));n.parentNode=this;this.childNodes.unshift(n);}
 after(n){const p=this.parentNode;n.parentNode&&(n.parentNode.childNodes=n.parentNode.childNodes.filter(x=>x!==n));n.parentNode=p;p.childNodes.splice(p.childNodes.indexOf(this)+1,0,n);}
 replaceWith(n){const p=this.parentNode;n.parentNode=p;p.childNodes[p.childNodes.indexOf(this)]=n;this.parentNode=null;}
 remove(){if(this.parentNode)this.parentNode.childNodes=this.parentNode.childNodes.filter(x=>x!==this);this.parentNode=null;}
 descendants(){const out=[];for(const c of this.children){out.push(c,...c.descendants());}return out;}
 matches(sel){return sel.split(',').some(s=>one(this,s.trim()));}
 querySelectorAll(sel){return this.descendants().filter(n=>n.matches(sel));}querySelector(sel){return this.querySelectorAll(sel)[0]||null;}
 closest(sel){for(let n=this;n&&n.nodeType===1;n=n.parentNode)if(n.matches(sel))return n;return null;}
 getRootNode(){let n=this;while(n.parentNode)n=n.parentNode;return n;}
 addEventListener(){}removeEventListener(){}focus(){if(this.ownerDocument)this.ownerDocument.activeElement=this;}
 getBoundingClientRect(){return {left:0,top:0,width:0,height:0,right:0,bottom:0};}
}
// compound: tag? #id? .class* [attr(=value)?]* :not([attr])? ; and "A > B" (one level)
function compound(el,s){
 let rest=s;const nots=[];rest=rest.replace(/:not\(([^)]*)\)/g,(_,x)=>{nots.push(x);return '';});
 const tag=/^[a-z][\w-]*/i.exec(rest)?.[0];if(tag&&el.localName!==tag.toLowerCase())return false;
 for(const m of rest.matchAll(/\.([\w-]+)/g))if(!el.className.split(/\s+/).includes(m[1]))return false;
 for(const m of rest.matchAll(/#([\w-]+)/g))if(el.attrs.id!==m[1])return false;
 for(const m of rest.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g))if(!(m[1] in el.attrs)||m[2]!==undefined&&el.attrs[m[1]]!==m[2])return false;
 return nots.every(x=>!compound(el,x));
}
function one(el,s){const parts=s.split(/\s*>\s*/);if(parts.length===2)return compound(el,parts[1])&&!!el.parentNode?.nodeType&&compound(el.parentNode,parts[0]);if(/\s/.test(s.trim())){const ps=s.trim().split(/\s+/),last=ps.pop();if(!compound(el,last))return false;for(let p=el.parentNode;p&&p.nodeType===1;p=p.parentNode)if(one(p,ps.join(' ')))return true;return false;}return compound(el,s);}
function document(){const doc={activeElement:null,createElement:tag=>new Element(tag,{},doc)};return doc;}
module.exports={Element,Text,document,camel};
