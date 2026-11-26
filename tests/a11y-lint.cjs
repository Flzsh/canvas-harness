'use strict';
// A small accessibility lint for markup the app draws (a11y-42, 2026-11-22). It parses an HTML string into a tree and
// reports what would lock a keyboard or screen-reader user out: a control with no name, a role in the wrong place, a
// positive tabindex, a reference to an id that is not there, a control inside a control, headings that skip a level.
// It is not a browser: names follow the browser's rules for the cases this app uses (aria-labelledby, aria-label,
// a label, the visible text with aria-hidden parts left out, alt, title).
const VOID=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const RAW=new Set(['script','style','textarea','title']);
function parse(html){
 const root={tag:'#root',attrs:{},children:[],parent:null};let cur=root,i=0;const s=String(html);
 const attrRe=/([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
 const decode=v=>String(v).replace(/&#(\d+);/g,(m,n)=>String.fromCharCode(+n)).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
 while(i<s.length){
  const lt=s.indexOf('<',i);
  if(lt<0){cur.children.push({text:decode(s.slice(i)),parent:cur});break;}
  if(lt>i)cur.children.push({text:decode(s.slice(i,lt)),parent:cur});
  if(s.startsWith('<!--',lt)){const end=s.indexOf('-->',lt);i=end<0?s.length:end+3;continue;}
  if(s[lt+1]==='/'){const end=s.indexOf('>',lt);const tag=s.slice(lt+2,end).trim().toLowerCase();let n=cur;while(n&&n.tag!==tag&&n.parent)n=n.parent;if(n&&n.tag===tag)cur=n.parent||root;i=end+1;continue;}
  if(!/[a-zA-Z]/.test(s[lt+1]||'')){cur.children.push({text:'<',parent:cur});i=lt+1;continue;}
  // the tag's end: the first '>' outside quotes
  let j=lt+1,q='';for(;j<s.length;j++){const c=s[j];if(q){if(c===q)q='';continue;}if(c==='"'||c==="'")q=c;else if(c==='>')break;}
  const inner=s.slice(lt+1,j),m=/^([a-zA-Z][\w:-]*)/.exec(inner),tag=m[1].toLowerCase(),rest=inner.slice(m[1].length);
  const attrs={};let a;attrRe.lastIndex=0;while((a=attrRe.exec(rest))){if(a[1]==='/')continue;attrs[a[1].toLowerCase()]=decode(a[2]??a[3]??a[4]??'');}
  const node={tag,attrs,children:[],parent:cur};cur.children.push(node);i=j+1;
  const selfClose=/\/\s*$/.test(rest);
  if(RAW.has(tag)&&!selfClose){const end=s.toLowerCase().indexOf('</'+tag,i);node.children.push({text:decode(s.slice(i,end<0?s.length:end)),parent:node});i=end<0?s.length:s.indexOf('>',end)+1;continue;}
  if(!VOID.has(tag)&&!selfClose)cur=node;
 }
 return root;
}
const elements=(n,out=[])=>{for(const c of n.children||[])if(c.tag){out.push(c);elements(c,out);}return out;};
const ancestors=n=>{const out=[];let p=n.parent;while(p&&p.tag!=='#root'){out.push(p);p=p.parent;}return out;};
const hiddenNode=n=>n.attrs&&(n.attrs['aria-hidden']==='true'||'hidden' in n.attrs||/display\s*:\s*none/.test(n.attrs.style||''));
function textOf(n,{skipHidden=true}={}){
 if(n.text!==undefined)return n.text;
 if(skipHidden&&hiddenNode(n))return '';
 if(n.tag==='img')return ' '+(n.attrs.alt||'')+' ';
 if(n.tag==='svg'){const t=(n.children||[]).find(c=>c.tag==='title');return ' '+(n.attrs['aria-label']||(t?textOf(t):''))+' ';}
 if(['input','select','textarea','script','style','template'].includes(n.tag))return '';
 return (n.children||[]).map(c=>textOf(c,{skipHidden})).join(n.tag==='br'?' ':'')+(/^(div|p|li|h\d|section|header|footer|strong|small|span|b|em)$/.test(n.tag)?' ':'');
}
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const ROLE_OF={button:'button',summary:'button',select:'combobox',textarea:'textbox',h1:'heading',h2:'heading',h3:'heading',h4:'heading',h5:'heading',h6:'heading'};
function role(n){if(n.attrs.role)return n.attrs.role.split(/\s+/)[0];if(n.tag==='a')return 'href' in n.attrs?'link':'';if(n.tag==='input'){const t=(n.attrs.type||'text').toLowerCase();return ({checkbox:'checkbox',radio:'radio',range:'slider',button:'button',submit:'button',reset:'button',hidden:'',file:'button',color:'button'})[t]??'textbox';}return ROLE_OF[n.tag]||'';}
const INTERACTIVE=new Set(['button','link','checkbox','radio','switch','tab','menuitem','menuitemcheckbox','menuitemradio','option','slider','spinbutton','textbox','searchbox','combobox','listbox','treeitem']);
function lint(html,{allowMissingIds=[],area='markup'}={}){
 const root=parse(html),all=elements(root),ids=new Map();
 for(const n of all)if(n.attrs.id){if(ids.has(n.attrs.id))ids.get(n.attrs.id).dup=true;else ids.set(n.attrs.id,n);}
 const name=n=>{
  const lb=n.attrs['aria-labelledby'];if(lb){const t=clean(lb.split(/\s+/).map(id=>ids.get(id)?textOf(ids.get(id),{skipHidden:false}):'').join(' '));if(t)return t;}
  if(clean(n.attrs['aria-label']))return clean(n.attrs['aria-label']);
  if(['input','select','textarea'].includes(n.tag)){
   if(n.attrs.id){const l=all.find(x=>x.tag==='label'&&x.attrs.for===n.attrs.id);if(l&&clean(textOf(l)))return clean(textOf(l));}
   const l=ancestors(n).find(x=>x.tag==='label');if(l&&clean(textOf(l)))return clean(textOf(l));
   if(['button','submit','reset'].includes(n.attrs.type)&&clean(n.attrs.value))return clean(n.attrs.value);
   return clean(n.attrs.title||n.attrs.placeholder);
  }
  if(n.tag==='img')return clean(n.attrs.alt||n.attrs.title);
  return clean(textOf(n))||clean(n.attrs.title);
 };
 const problems=[],say=(kind,n,extra='')=>problems.push({area,kind,el:`<${n.tag}${n.attrs.class?' class="'+n.attrs.class.split(/\s+/).slice(0,2).join(' ')+'"':''}${n.attrs['data-rd-action']?' data-rd-action="'+n.attrs['data-rd-action']+'"':''}${n.attrs.role?' role="'+n.attrs.role+'"':''}>`,extra});
 for(const n of all){
  if(ancestors(n).some(hiddenNode)||hiddenNode(n))continue;
  const r=role(n),native=['button','a','input','select','textarea','summary'].includes(n.tag);
  if(n.tag==='input'&&(n.attrs.type||'').toLowerCase()==='hidden')continue;
  if(INTERACTIVE.has(r)&&!name(n))say('no-name',n);
  if(Number(n.attrs.tabindex)>0)say('positive-tabindex',n,n.attrs.tabindex);
  if(INTERACTIVE.has(r)&&!native&&n.attrs.tabindex===undefined&&!['option','menuitem','menuitemradio','menuitemcheckbox','treeitem'].includes(r))say('role-not-focusable',n,r);
  if(r==='tab'&&!ancestors(n).some(a=>role(a)==='tablist'))say('tab-outside-tablist',n);
  if(/^menuitem/.test(r)&&!ancestors(n).some(a=>['menu','menubar'].includes(role(a))))say('menuitem-outside-menu',n);
  if(['radio'].includes(r)&&n.tag!=='input'&&!ancestors(n).some(a=>role(a)==='radiogroup'))say('radio-outside-radiogroup',n);
  if((INTERACTIVE.has(r)||n.tag==='a'&&'href' in n.attrs)&&ancestors(n).some(a=>['button','a'].includes(a.tag)||['button','link'].includes(role(a))))say('control-in-control',n);
  for(const k of ['aria-labelledby','aria-describedby','aria-controls','for']){const v=n.attrs[k];if(!v||(k==='for'&&n.tag!=='label'))continue;for(const id of v.split(/\s+/))if(id&&!ids.has(id)&&!allowMissingIds.includes(id))say('missing-id',n,`${k}=${id}`);}
  if(n.attrs.id&&ids.get(n.attrs.id)?.dup&&ids.get(n.attrs.id)===n)say('duplicate-id',n,n.attrs.id);
 }
 // headings: no skipped level going down
 let last=0;for(const n of all){if(ancestors(n).some(hiddenNode)||hiddenNode(n))continue;const lv=/^h([1-6])$/.exec(n.tag)?.[1]||(n.attrs.role==='heading'?n.attrs['aria-level']:0);if(!lv)continue;if(last&&+lv>last+1)say('heading-skip',n,`h${last} -> h${lv}: ${clean(textOf(n)).slice(0,40)}`);last=+lv;}
 return problems;
}
function controls(html){const root=parse(html),all=elements(root);return all.filter(n=>INTERACTIVE.has(role(n))&&!ancestors(n).some(hiddenNode)&&!hiddenNode(n));}
module.exports={parse,lint,elements,ancestors,textOf,role,controls,clean};
