const M=require('../extension/workspace-arrange.js');
function fixture({motion=false}={}){
 let clock=0,timers=new Map(),seq=0;const settings={},calls=[],listeners=new Map(),animations=[];
 class Element{
  constructor(cls='',dataset={}){this.className=cls;this.dataset=dataset;this.children=[];this.attrs={};this.style={setProperty:(k,v)=>this.style[k]=v};this.isConnected=true;this.rect={left:0,top:0,width:100,height:60,right:100,bottom:60};this.id='';this.textContent='';}
  get attributes(){return Object.entries(this.attrs).map(([name,value])=>({name,value}));}
  get clientWidth(){return this.rect.width;}get clientHeight(){return this.rect.height;}
  append(n){if(n.parentNode)n.remove();n.isConnected=true;this.children.push(n);n.parentNode=this;}
  insertBefore(n,b){if(n===b)return;if(n.parentNode)n.remove();const at=this.children.indexOf(b);this.children.splice(at<0?this.children.length:at,0,n);n.parentNode=this;n.isConnected=true;}
  remove(){if(this.parentNode){const at=this.parentNode.children.indexOf(this);if(at>=0)this.parentNode.children.splice(at,1);}this.isConnected=false;}
  get nextSibling(){return this.parentNode?.children[this.parentNode.children.indexOf(this)+1]||null;}
  setAttribute(k,v){this.attrs[k]=v;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=v;}
  removeAttribute(k){delete this.attrs[k];if(k.startsWith('data-'))delete this.dataset[k.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())];}
  matches(s){if(s==='*')return true;if(s.startsWith('.'))return s.slice(1).split('.').every(c=>this.className.split(' ').includes(c));const m=s.match(/^\[data-([\w-]+)(?:="([^"]+)")?\]$/);if(m){const k=m[1].replace(/-([a-z])/g,(_,x)=>x.toUpperCase());return this.dataset[k]!==undefined&&(m[2]===undefined||this.dataset[k]===m[2]);}return false;}
  closest(s){if(s.includes(','))return s.split(',').map(x=>this.closest(x)).find(Boolean)||null;return this.matches(s)?this:this.parentNode?.closest(s)||null;}
  querySelectorAll(s){if(s.includes(' > ')){const [parent,child]=s.split(' > ');return this.querySelectorAll(parent).flatMap(n=>n.children.filter(c=>c.matches(child)));}return this.children.flatMap(c=>[...(c.matches(s)?[c]:[]),...c.querySelectorAll(s)]);}
  querySelector(s){if(s.includes(','))return s.split(',').map(x=>this.querySelector(x)).find(Boolean)||null;return this.querySelectorAll(s)[0]||null;}
  cloneNode(){const c=new Element(this.className,{...this.dataset});c.rect={...this.rect};for(const child of this.children)c.append(child.cloneNode());return c;}
  getBoundingClientRect(){return this.rect;}
  setPointerCapture(id){this.captured=id;}hasPointerCapture(){return true;}releasePointerCapture(){delete this.captured;}focus(){}
 }
 if(motion)Element.prototype.animate=function(frames,options){let resolve,reject;const animation={node:this,frames,options,finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),cancel(){this.cancelled=true;reject(Error('Cancelled'));},finish(){resolve();}};animations.push(animation);return animation;};
 const win={innerWidth:1400,innerHeight:1000,matchMedia:()=>({matches:!motion}),addEventListener(){},removeEventListener(){},requestAnimationFrame:fn=>{const id=++seq;timers.set(id,{fn,at:clock+16});return id;},cancelAnimationFrame:id=>timers.delete(id)};
 const doc={defaultView:win,createElement:()=>new Element(),addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key),scrollingElement:{scrollTop:0}};
 const container=new Element('rd',{workspace:'work'});container.ownerDocument=doc;
 const toolbar=new Element('rd-toolbar'),desk=new Element('rd-main rd-desk'),rail=new Element('rd-course-rail'),shell=new Element('rd-shell');desk.rect.width=1200;container.append(toolbar);container.append(shell);shell.append(rail);shell.append(desk);
 const panels={},grips={};M.PANELS.forEach((key,i)=>{const node=new Element('',{arrangeKey:key}),head=new Element('',{arrangeHead:key}),grip=new Element('rd-arrange-grip',{arrangeGrip:''});node.rect={left:i*400,top:100,right:(i+1)*400-20,bottom:500,width:380,height:400};head.rect=grip.rect=node.rect;node.append(head);head.append(grip);desk.append(node);panels[key]=node;grips[key]=grip;});
 const cards={};['1','2','3'].forEach((key,i)=>{const card=new Element('rd-rail-course',{arrangeCourse:key}),name=new Element('rd-rail-name'),grip=new Element('rd-arrange-grip',{arrangeGrip:''});name.textContent='Course '+key;card.append(name);card.append(grip);card.rect={left:0,top:i*80,right:200,bottom:i*80+70,width:200,height:70};rail.append(card);cards[key]=card;});rail.append(new Element('rd-rail-foot'));
 const controller=M.createController({container,getSettings:()=>settings,getCourseIds:()=>['1','2','3'],onChange:c=>{calls.push(c);if(settings.fail)return false;M.change(settings,c);return true;},onModeChange:()=>{}});
 const event=(key,x=20,y=120)=>({target:grips[key],button:0,isPrimary:true,pointerId:1,clientX:x,clientY:y,preventDefault(){},stopImmediatePropagation(){}});
 const tick=ms=>{clock+=ms;for(const [id,t] of [...timers])if(t.at<=clock){timers.delete(id);t.fn();}};
 return {controller,container,settings,calls,event,panels,cards,grips,toolbar,tick,listeners,animations};
}
module.exports={fixture};
