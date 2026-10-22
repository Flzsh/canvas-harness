'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
const Site=require('../extension/site.js'),tick=()=>new Promise(setImmediate);
const KEY='reserve:just-submitted',LAST='reserve:last-submit-scene',route='/courses/7/assignments/12',now=1_800_000;
const ORIGIN='https://school.instructure.com';
const json=value=>JSON.parse(JSON.stringify(value));
function store(initial={}){const data=new Map(Object.entries(initial));return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};}
function fixture({pathname=route,record,submitted='Submitted!',scope='#right-side .details',motion,reduce=false,random=0,local=store(),readyState='complete',loadError=false,enabled=true,onCanvas=true,enabledRead,enabledError=false,load}={}){
 const listeners=new Map(),messages=[],mounts=[],timers=new Map(),observers=[],nodes=[],storageReads=[],storageEvents=new Set(),localCalls=[];
 const pageLocal=Object.fromEntries(['getItem','setItem','removeItem'].map(method=>[method,(...args)=>{localCalls.push({method,args});return local[method](...args);} ]));
 let preference=enabled,canvasEnabled=onCanvas,attempt=0;const destroys=[],motionChanges=[];
 let timerId=0,matchMediaReads=0;
 function matches(el,selector){return selector.split(',').some(part=>{
  if(part.trim()==='#right-side .details')return matches(el,'.details')&&!!el.parentNode?.closest('#right-side');
  part=part.trim();if(part==='*')return true;if(part[0]==='#')return el.id===part.slice(1);
  if(part[0]==='.')return el.className.split(' ').includes(part.slice(1));
  const attr=part.match(/^\[([^=]+)="([^"]+)"\]$/);return attr?el.getAttribute(attr[1])===attr[2]:el.tagName===part.toUpperCase();
 });}
 function element(tag='div',text=''){
  const attrs={},el={nodeType:1,tagName:tag.toUpperCase(),className:'',id:'',style:{},children:[],parentNode:null,innerHTML:'',ownText:text,
   get childNodes(){return [...(this.ownText?[{nodeType:3,textContent:this.ownText}]:[]),...this.children];},
   get textContent(){return this.ownText+this.children.map(c=>c.textContent).join('');},set textContent(value){this.ownText=String(value);this.children=[];},
   get isConnected(){return this===doc.documentElement||!!this.parentNode?.isConnected;},
   get nextElementSibling(){const a=this.parentNode?.children||[];return a[a.indexOf(this)+1]||null;},
   get classList(){return {contains:name=>this.className.split(' ').includes(name),toggle:(name,on)=>{const a=new Set(this.className.split(' ').filter(Boolean));if(on)a.add(name);else a.delete(name);this.className=[...a].join(' ');},add:name=>{this.className+=(this.className?' ':'')+name;}};},
   setAttribute(key,value){attrs[key]=String(value);},getAttribute:key=>attrs[key]??null,
   matches(selector){return matches(this,selector);},closest(selector){for(let e=this;e;e=e.parentNode)if(e.matches(selector))return e;return null;},
   querySelectorAll(selector){return this.children.flatMap(c=>[...(c.matches(selector)?[c]:[]),...c.querySelectorAll(selector)]);},
   querySelector(selector){return this.querySelectorAll(selector)[0]||null;},
   append(...items){for(const item of items){item.remove();item.parentNode=this;this.children.push(item);}},
   prepend(...items){for(const item of [...items].reverse()){item.remove();item.parentNode=this;this.children.unshift(item);}},
   before(...items){const parent=this.parentNode;for(const item of items){item.remove();item.parentNode=parent;parent.children.splice(parent.children.indexOf(this),0,item);}},
   after(...items){const parent=this.parentNode;let previous=this;for(const item of items){item.remove();item.parentNode=parent;parent.children.splice(parent.children.indexOf(previous)+1,0,item);previous=item;}},
   remove(){if(this.parentNode){const a=this.parentNode.children;a.splice(a.indexOf(this),1);this.parentNode=null;}}
  };nodes.push(el);return el;
 }
 const doc={readyState,createElement:element,addEventListener(type,fn,options){const list=listeners.get(type)||[];list.push({fn,options});listeners.set(type,list);},
  removeEventListener(type,fn){listeners.set(type,(listeners.get(type)||[]).filter(item=>item.fn!==fn));},
  querySelectorAll:selector=>doc.documentElement.querySelectorAll(selector),querySelector:selector=>doc.querySelectorAll(selector)[0]||null,
  getElementById:id=>doc.querySelector('#'+id)};
 doc.documentElement=element('html');doc.head=element('head');doc.body=element('body');doc.documentElement.append(doc.head,doc.body);
 const content=element();content.id='content';doc.body.append(content);
 const area=element(scope==='main'?'main':'div');if(scope==='#right-side .details'){const side=element();side.id='right-side';doc.body.append(side);area.className='details';side.append(area);}else{if(scope[0]==='#')area.id=scope.slice(1);else if(scope[0]==='.')area.className=scope.slice(1);else if(scope[0]==='[')area.setAttribute('data-testid',scope.match(/="([^"]+)"/)[1]);doc.body.append(area);}
 const status=element('span',submitted);area.append(status);
 const session=store(record===undefined?{}:{[KEY]:typeof record==='string'?record:JSON.stringify(record)});
 let onMessage;
 const runtime={onMessage:{addListener:fn=>{onMessage=fn;}},sendMessage:async message=>{messages.push(json(message));if(loadError)throw Error('Injection failed');return load?load():{ok:true};}};
 const math=Object.create(Math);math.random=()=>random;
 const context={document:doc,location:new URL(ORIGIN+pathname),ReserveSite:Site,sessionStorage:session,localStorage:pageLocal,Math:math,
  Date:{now:()=>now},matchMedia:()=>{matchMediaReads++;return {matches:reduce};},chrome:{runtime,storage:{
   onChanged:{addListener:fn=>storageEvents.add(fn),removeListener:fn=>storageEvents.delete(fn)},
   local:{get(key){storageReads.push(key);if(key==='reserve:enabled'){if(enabledError)throw Error('Storage unavailable');return enabledRead||Promise.resolve({'reserve:enabled':canvasEnabled});}return Promise.resolve({'reserve:appearance':motion?{motion}:undefined});}}
  }},
  setTimeout(fn,ms){timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id),
  MutationObserver:class{constructor(fn){this.fn=fn;this.active=false;observers.push(this);}observe(target,options){this.active=true;this.target=target;this.options=options;}disconnect(){this.active=false;}},
  ReserveSubmitScenes:{mailbox:'<svg>mailbox<style></style></svg>',plane:'<svg>plane<style></style></svg>',tube:'<svg>tube<style></style></svg>'},
  ReserveFeatures:{enabled:()=>preference,resolve:value=>({enabled:value===false?[]:['play']})},
  ReservePlay:{mount:options=>{mounts.push(options);return {destroy(){destroys.push(options);},setMotion(value){motionChanges.push(value);}};}}
 };
 const initialNodes=nodes.length,snapshot=el=>({tag:el.tagName,id:el.id,className:el.className,style:{...el.style},text:el.ownText,children:el.children.map(snapshot)}),domSnapshot=()=>JSON.stringify(snapshot(doc.documentElement)),initialDOM=domSnapshot();
 vm.runInNewContext(read('submit-celebrate.js'),context,{filename:'submit-celebrate.js'});
 return {doc,context,session,local,localCalls,storageReads,storageEvents,destroys,motionChanges,content,area,status,messages,mounts,observers,timers,nodes,listeners,element,initialNodes,initialDOM,domSnapshot,get matchMediaReads(){return matchMediaReads;},
  changePlay(value){preference=value;for(const listener of storageEvents)listener({'reserve:features':{newValue:value}},'local');},
  changeCanvas(value){canvasEnabled=value;for(const listener of storageEvents)listener({'reserve:enabled':{newValue:value}},'local');},
  intent(){const button=element('button','Submit Assignment');doc.body.append(button);for(const {fn}of listeners.get('click')||[])fn({target:button});return button;},
  receipt(){status.textContent='Submitted!';area.append(element('time','Attempt '+(++attempt)+' at 11:00'));for(const observer of observers)if(observer.active)observer.fn([]);},
  async submit(){await tick();this.intent();this.receipt();await tick();},
  dispatch(type,target){for(const {fn}of listeners.get(type)||[])fn({target});},
  mutate(){for(const observer of observers)if(observer.active)observer.fn([]);},
  expire(ms=20000){for(const [id,timer]of timers)if(timer.ms===ms){timers.delete(id);timer.fn();}},
  message(message={type:'reserve:celebrate-test'}){const replies=[];const keepAlive=onMessage?.(message,{},reply=>replies.push(reply));return {replies,keepAlive};},
  scenes:()=>doc.querySelectorAll('.chs-scene')};
}

for(const [name,record]of [['missing',undefined],['another path',{path:'/courses/7/assignments/99',t:now}],['expired',{before:[],path:route,t:now-180001}],['exactly three minutes old',{before:[],path:route,t:now-180000}],['future',{before:[],path:route,t:now+1}],['malformed','{oops']]){
 test('submission record '+name+' never celebrates an old submission',async()=>{const h=fixture({record});await tick();h.mutate();await tick();assert.equal(h.mounts.length,0);assert.equal(h.messages.length,0);assert.equal(h.scenes().length,0);});
}
test('a real submit followed by a changed receipt deals one tool; a second receipt restores and replaces it',async()=>{
 const h=fixture();await h.submit();assert.equal(h.mounts.length,1);const first=h.scenes()[0].innerHTML;await h.submit();assert.equal(h.mounts.length,2);assert.equal(h.destroys.length,1);assert.equal(h.scenes().length,1);assert.notEqual(h.scenes()[0].innerHTML,first);assert.equal(h.mounts[0].box.isConnected,false);assert.equal(h.mounts[1].all,undefined);
});
test('a detached earlier tray is destroyed before the next confirmed submission',async()=>{
 const h=fixture();await h.submit();const box=h.mounts[0].box;box.remove();await h.submit();assert.equal(h.mounts.length,2);assert.equal(h.destroys.length,1);assert.equal(box.isConnected,false);assert.equal(h.scenes()[0].nextElementSibling,h.mounts[1].box);
});
test('ordinary pages and production runtime messages cannot force a celebration',async()=>{
 const h=fixture(),request=h.message();await tick();assert.equal(request.keepAlive,undefined);assert.equal(request.replies.length,0);assert.equal(h.mounts.length,0);assert.equal(h.messages.length,0);assert.doesNotMatch(read('submit-celebrate.js'),/celebrate-test|runtime\.onMessage/);
 const outside=fixture({pathname:'/courses/7/modules'});await outside.submit();assert.equal(outside.messages.length,0);assert.equal(outside.observers.length,0);assert.equal(outside.mounts.length,0);
});
test('blocked local scene history does not prevent a real receipt; unavailable intent storage and load errors stay inert',async()=>{
 const h=fixture();for(const method of ['getItem','setItem','removeItem'])h.context.localStorage[method]=()=>{throw Error('Storage blocked');};await h.submit();assert.equal(h.mounts.length,1);
 const blocked=fixture();for(const method of ['getItem','setItem','removeItem'])blocked.context.sessionStorage[method]=()=>{throw Error('Storage blocked');};await blocked.submit();assert.equal(blocked.mounts.length,0);assert.equal(blocked.observers.length,0);
 const failed=fixture({loadError:true});await failed.submit();assert.equal(failed.mounts.length,0);assert.equal(failed.scenes().length,0);
});
test('a second assignment starts its own receipt load while the first assignment is pending',async()=>{
 const loads=[],h=fixture({load:()=>new Promise(resolve=>loads.push(resolve))});await h.submit();h.context.location.pathname='/courses/7/assignments/99';await h.submit();assert.equal(loads.length,2);
 loads[0]({ok:true});await tick();assert.equal(h.mounts.length,0);loads[1]({ok:true});await tick();assert.equal(h.mounts.length,1);assert.equal(h.mounts[0].box.isConnected,true);
});
test('navigating away while confirmed-receipt artwork loads prevents late markup',async()=>{
 let finish;const h=fixture({load:()=>new Promise(resolve=>{finish=resolve;})});await h.submit();h.context.location.pathname='/courses/7/modules';finish({ok:true});await tick();assert.equal(h.mounts.length,0);assert.equal(h.scenes().length,0);
});
for(const options of [{enabled:false},{onCanvas:false},{enabledError:true}])test('an inactive global or Play gate creates no effects '+JSON.stringify(options),async()=>{
 const h=fixture({record:{before:[],path:route,t:now},...options});await tick();assert.equal(h.nodes.length,h.initialNodes);assert.equal(h.domSnapshot(),h.initialDOM);assert.equal(h.observers.length,0);assert.equal(h.timers.size,0);assert.equal(h.messages.length,0);assert.equal(h.matchMediaReads,0);
 const button=h.element('button','Submit Assignment');h.doc.body.append(button);const before=h.domSnapshot(),nodes=h.nodes.length;h.dispatch('click',button);h.mutate();await tick();assert.equal(h.nodes.length,nodes);assert.equal(h.domSnapshot(),before);assert.equal(h.observers.length,0);assert.equal(h.messages.length,0);
});
test('an idle vanilla assignment page creates no markup, styles, media query or mutation observer until submission intent',async()=>{
 const h=fixture();await tick();h.dispatch('visibilitychange');h.mutate();await tick();
 assert.equal(h.nodes.length,h.initialNodes);assert.equal(h.domSnapshot(),h.initialDOM);assert.equal(h.matchMediaReads,0);assert.equal(h.observers.length,0);assert.equal(h.timers.size,0);assert.equal(h.messages.length,0);assert.deepEqual(h.storageReads,['reserve:enabled']);
 const button=h.element('button','Submit Assignment');h.doc.body.append(button);const before=h.domSnapshot(),nodes=h.nodes.length;h.dispatch('click',button);
 assert.equal(h.observers.length,1);assert.equal(h.observers[0].active,true);assert.equal(h.nodes.length,nodes);assert.equal(h.domSnapshot(),before);assert.equal(h.matchMediaReads,0);assert.equal(h.messages.length,0);
 h.receipt();await tick();assert.equal(h.mounts.length,1);assert.equal(h.matchMediaReads,1);
});
test('Play off destroys current page play and cancels a pending receipt load',async()=>{
 const h=fixture();await h.submit();h.changePlay(false);assert.equal(h.destroys.length,1);assert.equal(h.mounts[0].box.isConnected,false);assert.equal(h.scenes().length,0);assert.equal(h.timers.size,0);assert.ok(h.observers.every(observer=>!observer.active));
 let finish;const pending=fixture({load:()=>new Promise(resolve=>{finish=resolve;})});await pending.submit();pending.changePlay(false);finish({ok:true});await tick();assert.equal(pending.mounts.length,0);
});
test('On Canvas off removes scenes/tools and enabling it again requires a new submission intent',async()=>{
 const h=fixture();await h.submit();h.changeCanvas(false);assert.equal(h.destroys.length,1);assert.equal(h.scenes().length,0);assert.equal(h.mounts[0].box.isConnected,false);assert.equal(h.timers.size,0);assert.ok(h.observers.every(observer=>!observer.active));
 h.changeCanvas(true);h.mutate();await tick();assert.equal(h.mounts.length,1);await h.submit();assert.equal(h.mounts.length,2);
});
test('off then on cannot revive a cancelled load and cannot clear the new submission job',async()=>{
 const loads=[],h=fixture({load:()=>new Promise(resolve=>loads.push(resolve))});await h.submit();h.changeCanvas(false);h.changeCanvas(true);await h.submit();assert.equal(loads.length,2);
 loads[0]({ok:true});await tick();assert.equal(h.mounts.length,0);loads[1]({ok:true});await tick();assert.equal(h.mounts.length,1);
});
test('a stale initial enabled read cannot override a newer global storage change',async()=>{
 let finish;const read=new Promise(resolve=>{finish=resolve;}),off=fixture({record:{before:[],path:route,t:now},enabledRead:read});await tick();assert.equal(off.observers.length,0);assert.equal(off.matchMediaReads,0);off.changeCanvas(false);finish({'reserve:enabled':true});await tick();assert.equal(off.mounts.length,0);assert.equal(off.observers.length,0);
 let finishOn;const onRead=new Promise(resolve=>{finishOn=resolve;}),on=fixture({enabledRead:onRead});await tick();on.changeCanvas(true);finishOn({'reserve:enabled':false});await on.submit();assert.equal(on.mounts.length,1);
});
test('hidden scenes pause, appearance changes keep the tool usable, and teardown removes listeners',async()=>{
 const h=fixture();await h.submit();h.doc.hidden=true;h.dispatch('visibilitychange');assert.equal(h.scenes()[0].classList.contains('chs-paused'),true);h.doc.hidden=false;h.dispatch('visibilitychange');assert.equal(h.scenes()[0].classList.contains('chs-paused'),false);
 for(const listener of h.storageEvents)listener({'reserve:appearance':{newValue:{motion:'off'}}},'local');assert.equal(h.scenes().length,0);assert.equal(h.motionChanges.at(-1),'off');assert.equal(h.mounts[0].box.isConnected,true);
 h.context.ReserveSubmitCelebrate.destroy();assert.equal(h.destroys.length,1);assert.equal(h.storageEvents.size,0);assert.ok([...h.listeners.values()].every(list=>list.length===0));
});
test('fresh matching record celebrates once, consumes it and mounts the specified tray',async()=>{
 const h=fixture({record:{before:[],path:route,t:now-20}});h.mutate();h.mutate();await tick();
 assert.equal(h.mounts.length,1);assert.deepEqual(h.messages,[{target:'ch-play',op:'load'}]);assert.equal(h.session.getItem(KEY),null);
 const scene=h.scenes()[0];assert.equal(h.status.nextElementSibling,scene);assert.equal(scene.getAttribute('aria-hidden'),'true');
 assert.equal(scene.style.width,'290px');assert.equal(scene.style.maxWidth,'100%');assert.equal(scene.innerHTML,h.context.ReserveSubmitScenes.mailbox);
 const opts=h.mounts[0];assert.equal(opts.all,undefined,'public submissions never request the owner all-tool tray');assert.equal(opts.box,scene.nextElementSibling);assert.equal(opts.box.getAttribute('aria-hidden'),null);assert.equal(opts.root,h.content);
 assert.equal(opts.blocks,'#content > *, #right-side-wrapper > *, #left-side');assert.equal(opts.shake,'#application, #wrapper');assert.equal(opts.ours,'.chs-scene');
 h.mutate();await tick();assert.equal(h.mounts.length,1);assert.ok(h.observers.every(o=>!o.active));
});
for(const scope of ['#right-side .details','#sidebar_content','.submission-details','[data-testid="assignment-student-header"]','[data-testid="submission-status"]']){
 test('finds exact own submitted text in '+scope,async()=>{const h=fixture({scope,record:{before:[],path:route,t:now},submitted:'  sUbMiTtEd  '});await tick();assert.equal(h.mounts.length,1);assert.equal(h.status.nextElementSibling,h.scenes()[0]);});
}
test('submitted text must match exactly; instructions and split text do not qualify',async()=>{
 for(const text of ['Not Submitted','Submitted yesterday','Submitted! More information','Assignment submitted']){const h=fixture({record:{before:[],path:route,t:now},submitted:text});await tick();assert.equal(h.mounts.length,0,text);}
 const h=fixture({record:{before:[],path:route,t:now},submitted:'Sub'});h.status.append(h.element('span','mitted'));h.mutate();await tick();assert.equal(h.mounts.length,0);
});
test('one observer sees late success and disconnects after success or 20 seconds',async()=>{
 const h=fixture({record:{before:[],path:route,t:now},submitted:'Submitting…'});await tick();assert.equal(h.observers.length,1);assert.equal(h.observers[0].active,true);assert.equal(h.mounts.length,0);
 h.status.textContent='Submitted!';h.mutate();h.mutate();await tick();assert.equal(h.mounts.length,1);assert.equal(h.observers[0].active,false);assert.equal(h.timers.size,0);
 const timeout=fixture({record:{before:[],path:route,t:now},submitted:'Submitting…'});await tick();timeout.expire();assert.equal(timeout.observers.length,1);assert.equal(timeout.observers[0].active,false);
 timeout.status.textContent='Submitted!';timeout.mutate();await tick();assert.equal(timeout.mounts.length,0);
});
test('document_start waits for DOMContentLoaded before checking success',async()=>{
 const h=fixture({record:{before:[],path:route,t:now},readyState:'loading'});await tick();assert.equal(h.mounts.length,0);h.doc.readyState='interactive';h.dispatch('DOMContentLoaded',h.doc);await tick();assert.equal(h.mounts.length,1);
});
test('classic form submission is captured and newer buttons record intent, without hijacking events',async()=>{
 const h=fixture({submitted:'Not Submitted'}),holder=h.element();holder.id='submit_assignment';h.doc.body.append(holder);
 await tick();
 const form=h.element('form');holder.append(form);h.dispatch('submit',form);assert.deepEqual(JSON.parse(h.session.getItem(KEY)),{before:[],path:route,t:now});
 assert.equal(h.listeners.get('submit')[0].options,true);assert.equal(h.listeners.get('click')[0].options,true);
 h.session.removeItem(KEY);h.dispatch('submit',h.element('form'));assert.equal(h.session.getItem(KEY),null);
 const button=h.element('button',' Submit Assignment '),label=h.element('span');button.append(label);h.doc.body.append(button);h.dispatch('click',label);assert.equal(JSON.parse(h.session.getItem(KEY)).path,route);
 h.session.removeItem(KEY);const newer=h.element('button','Hand in');newer.setAttribute('data-testid','submit-button');h.doc.body.append(newer);h.dispatch('click',newer);assert.ok(h.session.getItem(KEY));
 h.session.removeItem(KEY);h.dispatch('click',h.element('button','Submit Assignment later'));assert.equal(h.session.getItem(KEY),null);
 h.dispatch('click',newer);h.status.textContent='Submitted!';h.mutate();await tick();assert.equal(h.mounts.length,1);assert.equal(h.observers.length,1);
});
test('a persisted last scene is never repeated, even with constant Math.random',async()=>{
 const local=store({[LAST]:'mailbox'}),seen=[];
 for(let i=0;i<5;i++){const h=fixture({record:{before:[],path:route,t:now},local,random:0});await tick();seen.push(local.getItem(LAST));assert.equal(h.scenes()[0].innerHTML,h.context.ReserveSubmitScenes[seen.at(-1)]);}
 assert.notEqual(seen[0],'mailbox');for(let i=1;i<seen.length;i++)assert.notEqual(seen[i],seen[i-1]);
});
test('motion off hides only the scene and still mounts accessible play tools',async()=>{const h=fixture({record:{before:[],path:route,t:now},motion:'off'});await tick();assert.equal(h.scenes().length,0);assert.equal(h.mounts.length,1);assert.equal(h.status.nextElementSibling,h.mounts[0].box);assert.equal(h.mounts[0].box.getAttribute('aria-hidden'),null);});
for(const [name,options]of [['still',{motion:'still'}],['reduced motion',{reduce:true}]]){
 test(name+' shows a frozen final scene',async()=>{const h=fixture({record:{before:[],path:route,t:now},...options});await tick();assert.equal(h.scenes()[0]?.classList.contains('chs-still'),true);assert.match(read('play-tools.css'),/\.chs-scene\.chs-still \*\{animation-delay:-10s!important;animation-play-state:paused!important/);});
}
test('an old submitted label cannot confirm a new same-page attempt',async()=>{
 const h=fixture();await tick();const button=h.element('button','Submit Assignment');h.doc.body.append(button);
 await tick();
 h.dispatch('click',button);h.mutate();await tick();assert.equal(h.mounts.length,0);assert.ok(h.session.getItem(KEY));
 h.status.textContent='Submitting…';h.mutate();h.status.textContent='Submitted!';h.mutate();await tick();
 assert.equal(h.mounts.length,0,'the same attempt remains stale even after a pending transition');
 h.area.append(h.element('time','Submitted at 10:32'));h.mutate();await tick();assert.equal(h.mounts.length,1);assert.equal(h.session.getItem(KEY),null);
});
test('a new receipt can confirm success alongside multiple stale receipts',async()=>{
 const h=fixture(),old=h.element('span','Submitted'),button=h.element('button','Submit Assignment');h.area.append(old);h.doc.body.append(button);
 await tick();
 h.dispatch('click',button);h.mutate();await tick();assert.equal(h.mounts.length,0);
 const fresh=h.element('strong','Submitted!'),block=h.element();block.className='submission-details';block.append(fresh,h.element('time','Attempt 2 at 10:32'));h.doc.body.append(block);h.mutate();await tick();assert.equal(h.mounts.length,1);assert.equal(h.session.getItem(KEY),null);
 assert.equal(fresh.nextElementSibling,h.scenes()[0],'the scene follows the new receipt');
});
test('finding 6: a rerendered receipt and a failed resubmission reload retain the stable previous attempt',async()=>{
 const h=fixture();await tick();const button=h.element('button','Submit Assignment'),time=h.element('time','Attempt 1 submitted at 10:30');h.area.append(time);h.doc.body.append(button);
 h.dispatch('click',button);const saved=h.session.getItem(KEY);
 h.status.remove();const replacement=h.element('span','Submitted!');h.area.prepend(replacement);h.mutate();await tick();assert.equal(h.mounts.length,0,'replacing a node is not another attempt');
 const reload=fixture({record:saved,readyState:'loading'});reload.area.append(reload.element('time','Attempt 1 submitted at 10:30'));reload.doc.readyState='interactive';reload.dispatch('DOMContentLoaded',reload.doc);await tick();assert.equal(reload.mounts.length,0,'the baseline survives a failed reload');
 reload.area.children.at(-1).textContent='Attempt 2 submitted at 10:32';reload.mutate();await tick();assert.equal(reload.mounts.length,1,'a different attempt confirms success');
});
test('finding 6: records without a captured attempt baseline cannot celebrate a stale receipt',async()=>{
 const h=fixture({record:{path:route,t:now}});await tick();assert.equal(h.mounts.length,0);
});
test('finding 7: standalone Submitted in instructions or outside right-side details never confirms success',async()=>{
 for(const scope of ['main','#right-side']){const h=fixture({scope,record:{before:[],path:route,t:now}});await tick();h.mutate();await tick();assert.equal(h.mounts.length,0,scope);assert.equal(h.messages.length,0);}
});
test('finding 8: receipts follow course and assignment IDs across submission routes',async()=>{
 for(const [pathname,prior,success]of [[route,route+'/submissions/new',true],[route+'/submissions/33',route,true],[route+'/',route+'/submissions/new',true],[route,'/courses/8/assignments/12',false],[route,'/courses/7/assignments/123',false]]){
  const h=fixture({pathname,record:{before:[],path:prior,t:now}});await tick();assert.equal(h.mounts.length,success?1:0,prior+' -> '+pathname);
 }
});
