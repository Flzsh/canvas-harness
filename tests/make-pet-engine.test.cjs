'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{fixture}=require('./pony-fixture.cjs'),P=require('../extension/pets.js');
const source=fs.readFileSync(path.join(__dirname,'../extension/pets.js'),'utf8');
function pack(extra={}){
 const poses={stand:'stand',walk:'walk',sleep:'sleep'},assets={};
 for(const pose of ['stand','walk','sleep','trot','lie','read','eat','cheer','flag','fall','held']){const still=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 48"><title>${pose} still</title><path d="M8 40h80"/></svg>`,svg=still.replace(' still',' moving').replace('</svg>','<animate attributeName="opacity" values="1;.5;1" dur="2s" repeatCount="indefinite"/></svg>');assets[pose]={type:'image/svg+xml',data:Buffer.from(svg).toString('base64'),sha256:'0'.repeat(64),svg,still};}
 return {format:'chpet',version:1,name:'Moth',size:[96,48],ground:40,faces:'right',poses,assets,...extra};
}
function customFixture({custom=pack(),motion='full',mediaReduced=false,initialPet={},provider=true,...options}={}){
 const f=fixture({...options,initialPet:{enabled:false}});f.controller.destroy();
 const proto=f.Element.prototype,html=Object.getOwnPropertyDescriptor(proto,'innerHTML'),images=[],motionListeners=new Set();
 Object.defineProperty(proto,'innerHTML',{set(value){this.htmlWrites=(this.htmlWrites||0)+1;for(const child of [...this.childNodes])child.remove();html.set.call(this,value);}});
 proto.replaceChildren=function(...children){for(const child of [...this.childNodes])child.remove();for(const child of children)this.append(child);};
 const make=f.doc.createElement;let imageWrites=0;
 f.doc.createElement=tag=>{const el=make(tag);el.tagName=tag.toUpperCase();if(tag==='img'){let src='';Object.defineProperty(el,'src',{get:()=>src,set:value=>{imageWrites++;src=value;}});images.push(el);}return el;};
 const motionMedia={matches:mediaReduced,addEventListener(type,fn){if(type==='change')motionListeners.add(fn);},removeEventListener(type,fn){if(type==='change')motionListeners.delete(fn);},emit(){for(const fn of [...motionListeners])fn();}};
 f.win.matchMedia=()=>motionMedia;f.container.dataset.motionStyle=motion;
 let pet={enabled:true,roam:'page',...initialPet},current=custom,providerCalls=0,seq=0,random=[];
 const schedule=(fn,delay=0,repeat=0)=>{const id=--seq;f.timers.set(id,{fn,at:f.clock+Math.max(0,delay),repeat,kind:'task'});return id;},math=Object.create(Math);math.random=()=>random.length?random.shift():.5;
 const env=vm.createContext({console,Date,Math:math,ReservePetArt:require('../extension/pet-art.js'),ReservePetPack:{validate(){throw Error('Rendering must use the already validated pack.');}},document:f.doc,setTimeout:(fn,ms)=>schedule(fn,ms),clearTimeout:id=>f.timers.delete(id),setInterval:(fn,ms)=>schedule(fn,ms,ms),clearInterval:id=>f.timers.delete(id)});
 vm.runInContext(source,env,{filename:'pets.js'});
 f.controller=env.ReservePets.create({container:f.container,getPet:()=>pet,...(provider?{getCustomPet:()=>{providerCalls++;return current;}}:{}),savePet:value=>{pet=value;},now:()=>f.epoch+f.clock,info:options.info,actions:options.actions});
 Object.defineProperty(f,'pet',{get:()=>pet});Object.defineProperty(f,'image',{get:()=>f.node?.children.find(el=>el.tagName==='IMG')});Object.defineProperty(f,'imageWrites',{get:()=>imageWrites});Object.defineProperty(f,'providerCalls',{get:()=>providerCalls});
 f.images=images;f.motionMedia=motionMedia;f.setPet=value=>{pet={...pet,...value};f.controller.sync();};f.setCustom=value=>{current=value;f.controller.sync();};f.random=(...values)=>{random=values;};
 return f;
}
const svg=image=>decodeURIComponent(image.src.slice(image.src.indexOf(',')+1));
test('custom poses use the specified required-pose fallbacks and explicit optional drawings',()=>{
 const p=pack();for(const [pose,want]of [['stand','stand'],['walk','walk'],['sleep','sleep'],['trot','walk'],['lie','sleep'],['read','stand'],['eat','stand'],['cheer','stand'],['flag','stand'],['fall','stand'],['held','stand'],['unknown','stand'],['constructor','stand'],['toString','stand']])assert.equal(P.customPose(p,pose),want,pose);
 for(const pose of ['trot','lie','read','eat','cheer','flag','fall','held']){p.poses[pose]=pose;assert.equal(P.customPose(p,pose),pose);}
 assert.equal(P.customDrawing(null),null);
});
test('custom drawing uses sanitized SVG, the still copy and the artwork facing direction',()=>{
 const p=pack({faces:'left'}),moving=P.customDrawing(p,'trot','right'),still=P.customDrawing(p,'lie','left',true);
 assert.equal(moving.pose,'walk');assert.equal(moving.width,96);assert.equal(moving.height,48);assert.equal(moving.ground,40);assert.equal(moving.mirror,true);assert.equal(decodeURIComponent(moving.src.split(',')[1]),p.assets.walk.svg);
 assert.equal(still.pose,'sleep');assert.equal(still.mirror,false);assert.equal(decodeURIComponent(still.src.split(',')[1]),p.assets.sleep.still);assert.doesNotMatch(still.src,/repeatCount/);
});
test('installed drawings are isolated images with their own dimensions and ground line',t=>{
 const p=pack();p.assets.stand.data=Buffer.from('<svg>untrusted original bytes</svg>').toString('base64');const f=customFixture({custom:p,initialPet:{name:'Biscuit'}});t.after(()=>f.controller.destroy());
 assert.equal(f.node.children.length,1);assert.equal(f.image.tagName,'IMG');assert.equal(svg(f.image),p.assets.stand.svg);assert.equal(f.image.alt,'');assert.equal(f.image.draggable,false);assert.equal(f.image.attrs['aria-hidden'],'true');assert.equal(f.node.style.width,'96px');assert.equal(f.node.style.height,'48px');assert.equal(f.node.style.aspectRatio,'96 / 48');
 assert.equal(f.node.style.transform,`translate(${(f.node._x-48).toFixed(1)}px,${(f.node._y-40).toFixed(1)}px)`);assert.match(f.node.attrs['aria-label'],/Biscuit.*companion/);assert.equal(f.pet.name,'Biscuit');
});
test('a zero ground line is used without substituting pony geometry',t=>{
 const f=customFixture({custom:pack({size:[32,128],ground:0})});t.after(()=>f.controller.destroy());assert.equal(f.node.style.width,'32px');assert.equal(f.node.style.height,'128px');assert.equal(f.node.style.transform,`translate(${(f.node._x-16).toFixed(1)}px,${f.node._y.toFixed(1)}px)`);
});
for(const [faces,destination,face,mirror]of [['right',.02,'left',true],['left',.02,'left',false],['left',.98,'right',true]])test(`walking ${face} mirrors artwork facing ${faces} only when needed`,t=>{
 const f=customFixture({custom:pack({faces})});t.after(()=>f.controller.destroy());f.advance(1400);f.random(.1,...Array(9).fill(destination));f.advance(6300);
 assert.equal(f.node.dataset.pose,'walk');assert.equal(f.node.dataset.face,face);assert.match(svg(f.image),/walk moving/);assert.equal(f.image.style.transform,mirror?'scaleX(-1)':'scaleX(1)');
 const image=f.image,writes=f.imageWrites,html=f.node.htmlWrites||0,calls=f.providerCalls,x=f.node._x;f.clear();f.advance(700);
 assert.notEqual(f.node._x,x);assert.equal(f.node.dataset.pose,'trot');assert.equal(f.image,image);assert.equal(f.imageWrites,writes,'walk and fallback trot share the same image source');assert.equal(f.node.htmlWrites||0,html);assert.equal(f.providerCalls,calls,'movement frames never read or validate the installed pack');assert.equal(f.reads.rect,0);
});
test('focus and resting keep their behavior while missing drawings use stand and sleep',t=>{
 const f=customFixture();t.after(()=>f.controller.destroy());f.controller.setFocus(true,{endsAt:f.epoch+1500000,fromPony:true});assert.equal(f.node.dataset.pose,'read');assert.match(svg(f.image),/stand moving/);assert.equal(f.node.dataset.timeLeft,'25:00');f.controller.setFocus(false);f.advance(32000);assert.equal(f.node.dataset.pose,'sleep');assert.match(svg(f.image),/sleep moving/);
});
test('optional reading, eating and cheering keep Biscuit rewards and Ask menu',t=>{
 const f=customFixture({custom:pack({poses:{stand:'stand',walk:'walk',sleep:'sleep',read:'read',eat:'eat',cheer:'cheer'}})});t.after(()=>f.controller.destroy());f.controller.setFocus(true,{endsAt:f.epoch+1500000});assert.match(svg(f.image),/read moving/);assert.equal(f.controller.treat(),true);assert.equal(f.pet.treats,0);assert.equal(f.pet.fed,1);assert.match(svg(f.image),/eat moving/);f.advance(2500);assert.match(svg(f.image),/cheer moving/);
 f.node.emit('click');assert.match(f.bubble.html,/Pet settings/);assert.equal(f.bubble.attrs['aria-label'],'Biscuit');assert.equal(f.node.attrs['aria-expanded'],'true');assert.match(svg(f.image),/cheer still/);f.node.emit('keydown',{key:'Escape',preventDefault(){}});assert.equal(f.bubble,undefined);assert.match(svg(f.image),/cheer moving/);
});
for(const motion of ['off','still','media','hidden'])test('custom artwork uses its still copy while '+motion,t=>{
 const f=customFixture();t.after(()=>f.controller.destroy());const image=f.image;
 if(motion==='hidden'){f.doc.hidden=true;f.doc.emit('visibilitychange');}else if(motion==='media'){f.motionMedia.matches=true;f.motionMedia.emit();}else{f.container.dataset.motionStyle=motion;f.mutate([{type:'attributes',attributeName:'data-motion-style',target:f.container}]);}
 assert.equal(f.image,image);assert.match(svg(image),/stand still/);assert.doesNotMatch(svg(image),/<animate/);const writes=f.imageWrites,calls=f.providerCalls;f.advance(500);assert.equal(f.imageWrites,writes);assert.equal(f.providerCalls,calls);
 if(motion==='hidden'){f.doc.hidden=false;f.doc.emit('visibilitychange');}else if(motion==='media'){f.motionMedia.matches=false;f.motionMedia.emit();}else{f.container.dataset.motionStyle='full';f.mutate([{type:'attributes',attributeName:'data-motion-style',target:f.container}]);}
 assert.equal(f.image,image);assert.match(svg(image),/stand moving/);
});
for(const options of [{},{motion:'off'},{motion:'still'},{mediaReduced:true},{hidden:true}])test('idle installed artwork adds no rendering or geometry loop: '+JSON.stringify(options),t=>{
 const f=customFixture(options);t.after(()=>f.controller.destroy());const writes=f.imageWrites,calls=f.providerCalls;f.clear();f.advance(1000);assert.equal(f.imageWrites,writes);assert.equal(f.providerCalls,calls);assert.equal(f.rafCalls,0);assert.equal(f.reads.rect,0);assert.equal(f.enumerations,0);
});
test('unchanged refreshes preserve the image and null restores the pony on the same control',t=>{
 const f=customFixture();t.after(()=>f.controller.destroy());const node=f.node,image=f.image,writes=f.imageWrites;
 for(let i=0;i<5;i++)f.controller.sync();assert.equal(f.node,node);assert.equal(f.image,image);assert.equal(f.imageWrites,writes);f.setCustom(pack({size:[48,96],ground:72,faces:'left'}));assert.equal(f.node,node);assert.equal(f.node.style.width,'48px');assert.equal(f.node.style.height,'96px');assert.equal(f.image.style.transform,'scaleX(-1)');assert.equal(f.node.style.transform,`translate(${(node._x-24).toFixed(1)}px,${(node._y-72).toFixed(1)}px)`);
 f.setCustom(null);assert.equal(f.node,node);assert.equal(f.image,undefined);assert.ok(f.node.querySelector('.pet-up'));assert.equal(f.node.style.width,'');assert.equal(f.node.style.height,'');assert.equal(f.node.style.aspectRatio,'');assert.match(f.node.attrs['aria-label'],/Biscuit.*pony/);assert.equal(f.node.style.transform,`translate(${(node._x-29).toFixed(1)}px,${(node._y-58*60/72).toFixed(1)}px)`);f.node.emit('click');assert.match(f.bubble.html,/Pet settings/);
});
test('reenabling reads the current pack and callers can omit the provider',t=>{
 const f=customFixture();t.after(()=>f.controller.destroy());f.setPet({enabled:false});assert.equal(f.node,undefined);assert.equal(f.timers.size,0);f.setCustom(pack({faces:'left'}));f.setPet({enabled:true});assert.match(svg(f.image),/stand moving/);assert.equal(f.image.style.transform,'scaleX(-1)');
 const original=customFixture({provider:false});t.after(()=>original.controller.destroy());assert.equal(original.image,undefined);assert.ok(original.node.querySelector('.pet-up'));assert.match(original.node.attrs['aria-label'],/your pony/);
});
for(const motion of ['off','still','media','hidden'])test('animated raster poses switch to the stand first frame while '+motion,t=>{
 const p=pack(),gif='R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';for(const name of Object.keys(p.assets))p.assets[name]={type:'image/gif',data:gif,animated:true,firstFrame:'data:image/gif;base64,'+gif};p.assets.walk.data=gif+'AAAA';
 const f=customFixture({custom:p});t.after(()=>f.controller.destroy());assert.equal(f.image.src,'data:image/gif;base64,'+gif);f.advance(1400);f.random(.1,...Array(9).fill(.02));f.advance(6300);assert.equal(f.image.src,'data:image/gif;base64,'+p.assets.walk.data);
 if(motion==='hidden'){f.doc.hidden=true;f.doc.emit('visibilitychange');}else if(motion==='media'){f.motionMedia.matches=true;f.motionMedia.emit();}else{f.container.dataset.motionStyle=motion;f.mutate([{type:'attributes',attributeName:'data-motion-style',target:f.container}]);}
 assert.equal(f.image.src,p.assets.stand.firstFrame);const writes=f.imageWrites,calls=f.providerCalls;f.advance(500);assert.equal(f.imageWrites,writes);assert.equal(f.providerCalls,calls);
});
