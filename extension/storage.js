/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function (root) {
  'use strict';
  const clone = value => structuredClone(value);
  const gpa=root.CanvasHarnessGPA||(typeof module==='object'&&module.exports?require('./gpa-model.js'):null);
  const customization=root.ReserveCustomization||(typeof module==='object'&&module.exports?require('./customization-model.js'):null);
  const layoutDefaults=customization?.defaults||{};
  const appearance=root.ReservePagePreferences||(typeof module==='object'&&module.exports?require('./page-preferences.js'):null);
  // appearanceVersion 2 (Canvas Harness 2.15) made Clay the default accent; see cleanData.
  // readingFont: teacher text in the book serif or the interface sans; greeting: the time-of-day heading.
  // hiddenCourses: hidden by hand. shownCourses (2.17): shown by hand, which keeps a course that is hidden
  // by default (NameCoach, College Counseling: ReserveCore.hiddenCourseIds) on screen. An id is in one list at most.
  const defaults = () => ({version:1,settings:{...layoutDefaults,theme:'system',accent:'clay',appearanceVersion:2,motion:'gentle',livingArt:'on',readingFont:'book',greeting:'on',quickOpen:'off',density:'comfortable',font:'system',textSize:'standard',dashboardLayout:'split',showCourseStrip:true,showGrades:false,showRecentGrades:false,timeZone:globalThis.ReserveSite.timeZone(),courseOrder:[],hiddenCourses:[],shownCourses:[],coursePrefs:{},overviewArt:{}},tasks:{},resourcePins:[],customTasks:[],gpa:gpa.defaults(),toolbox:{scratchpad:'',recent:[],dockSize:{width:0,height:0}},focus:{minutes:25,remaining:1500,endsAt:null,itemId:null,sessions:0},pet:{}});
  const text = (value,max=20000) => typeof value === 'string' ? value.slice(0,max) : '';
  const isRecord = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const personalWork = root.ReservePersonalWork || (typeof module === 'object' && module.exports && typeof require === 'function' ? require('./personal-work.js') : null);
  const queues = new Map();
  const accountServers = new WeakMap();
  const bytes = value => new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).length;
  // Compare snapshots without serializing large notes and uploaded artwork.
  function same(a,b) {
    if(a===b)return true;
    if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
    if(Array.isArray(a)&&a.length!==b.length)return false;
    const kind=Object.prototype.toString.call(a);
    if(kind!==Object.prototype.toString.call(b))return false;
    if(!['[object Object]','[object Array]'].includes(kind))return JSON.stringify(a)===JSON.stringify(b);
    const keys=Object.keys(a);
    return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&same(a[key],b[key]));
  }
  // Private projection: branches remain private until a draft or public snapshot is cloned.
  function personal(data) {
    const out={...data,settings:{...data.settings},pet:{...data.pet}};
    for(const key of ['theme','motion','nightArt'])delete out.settings[key];
    delete out.pet.enabled;return out;
  }
  function validDay(value) {return /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
  function instant(value) {
    if(value==null||value==='')return null;
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!validDay(value.slice(0,10))||!Number.isFinite(Date.parse(value)))throw Error('Stored dates must be valid and include a timezone offset.');
    return new Date(value).toISOString();
  }
  function lock(key,fn) {
    if(root.navigator?.locks) return root.navigator.locks.request(key,fn);
    const operation=(queues.get(key)||Promise.resolve()).catch(()=>{}).then(fn);
    queues.set(key,operation);operation.finally(()=>{if(queues.get(key)===operation)queues.delete(key);}).catch(()=>{});return operation;
  }
  function safeKeys(value,depth=0) {
    if (depth > 12) throw Error('Backup nesting is too deep.');
    if (value && typeof value === 'object') for(const key of Object.keys(value)) {
      if (['__proto__','constructor','prototype'].includes(key)) throw Error('Backup contains an unsafe key.');
      safeKeys(value[key],depth+1);
    }
  }
  function taskSource(value) {
    if(value==null)return null;
    const clean=personalWork?.safeSource?.(value);
    if(!clean)throw Error('Invalid personal task source. Use a supported HTTP(S) link and source kind.');
    return clean;
  }
  function cleanData(value,previous) {
    if (!isRecord(value)) throw Error('Backup data must be an object.');
    safeKeys(value);
    const out = defaults(), settings=value.settings || {},sameSettings=previous&&same(settings,previous.settings);
    out.gpa=previous&&same(value.gpa,previous.gpa)?previous.gpa:gpa.cleanPreferences(value.gpa);
    if (!isRecord(settings) || (value.tasks && !isRecord(value.tasks)) || (value.customTasks && !Array.isArray(value.customTasks))) throw Error('Backup data has an invalid structure.');
    // Validate every restored SVG before returning data or committing a save.
    if(!customization)throw Error('Canvas Harness customization modules are missing. Reload the extension.');
    Object.assign(out.settings,sameSettings?previous.settings:customization.cleanSettings(settings));
    for(const [key,allowed] of Object.entries({theme:['light','dark','system'],accent:['clay','forest','indigo','rose','ocean','amber'],motion:['gentle','still','off'],livingArt:['on','off'],readingFont:['book','interface'],greeting:['on','off'],quickOpen:['on','off'],density:['comfortable','compact'],font:['system','humanist','serif'],textSize:['standard','large'],dashboardLayout:['split','list']})) {
      if (settings[key] !== undefined && !allowed.includes(settings[key])) throw Error(`Invalid ${key} setting in backup.`);
      if (settings[key]) out.settings[key]=settings[key];
    }
    // Older Canvas Harness only had split/list. Keep its chosen layout on first load.
    if(settings.deskOrder===undefined&&out.settings.dashboardLayout==='list')out.settings.deskOrder='stacked';
    out.settings.dashboardLayout=out.settings.deskOrder==='stacked'?'list':'split';
    // One-time move to the Clay default. Every profile saved before 2.15 holds
    // accent 'forest' (the old default was always written back), so a stored
    // version below 2 with Forest means "never chosen": it becomes Clay once.
    // Version 2 is then saved, so choosing Forest again later sticks.
    if (settings.appearanceVersion !== undefined && !(Number.isInteger(settings.appearanceVersion) && settings.appearanceVersion >= 1 && settings.appearanceVersion <= 99)) throw Error('Invalid appearanceVersion setting in backup.');
    const appearanceVersion = Number.isInteger(settings.appearanceVersion) ? settings.appearanceVersion : 1;
    if (appearanceVersion < 2 && out.settings.accent === 'forest') out.settings.accent = 'clay';
    out.settings.appearanceVersion = Math.max(2, appearanceVersion);
    for(const key of ['showCourseStrip','showGrades','showRecentGrades']){if(settings[key]!==undefined&&typeof settings[key]!=='boolean')throw Error(`Invalid ${key} setting in backup.`);if(typeof settings[key]==='boolean')out.settings[key]=settings[key];}
    if (settings.timeZone) { try {new Intl.DateTimeFormat('en-US',{timeZone:settings.timeZone});out.settings.timeZone=settings.timeZone;} catch {throw Error('Invalid timezone in backup.');} }
    for(const key of ['courseOrder','hiddenCourses','shownCourses']) if(Array.isArray(settings[key])) out.settings[key]=[...new Set(settings[key].filter(x=>typeof x==='string'&&/^\d+$/.test(x)))].slice(0,500);
    // Hidden by hand wins over shown by hand, so the two lists never disagree.
    out.settings.shownCourses=out.settings.shownCourses.filter(id=>!out.settings.hiddenCourses.includes(id));
    out.settings.coursePrefs={};
    if (isRecord(settings.coursePrefs)) for(const [id,pref] of Object.entries(settings.coursePrefs)) {
      if (!/^\d+$/.test(id)||!isRecord(pref)) continue;
      out.settings.coursePrefs[id]=previous&&Object.hasOwn(previous.settings.coursePrefs,id)&&same(pref,previous.settings.coursePrefs[id])?previous.settings.coursePrefs[id]:{name:text(pref.name,100),color:/^#[\da-f]{6}$/i.test(pref.color)?pref.color:'',image:typeof pref.image==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(pref.image)&&pref.image.length<400000?pref.image:'',...customization.cleanAppearance(pref)};
    }
    if(!sameSettings)customization.checkBudget(out.settings);
    if(value.resourcePins!==undefined&&!Array.isArray(value.resourcePins))throw Error('Invalid saved materials in backup.');
    if((value.resourcePins||[]).length>300)throw Error('Save up to 300 materials. Remove a shortcut before adding another.');
    const resourceIds=new Set();
    for(const item of value.resourcePins||[]){
      if(!isRecord(item)||!/^\d+$/.test(item.courseId)||!text(item.id,180)||!text(item.title,300))throw Error('Invalid saved material.');
      let url;try{url=new URL(item.url);}catch{throw Error('Invalid saved material link.');}
      if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('Invalid saved material link.');
      const key=item.courseId+':'+item.id;if(resourceIds.has(key))continue;resourceIds.add(key);
      out.resourcePins.push({id:text(item.id,180),courseId:item.courseId,title:text(item.title,300),url:url.href,category:text(item.category,60),moduleName:text(item.moduleName,200)});
    }
    const taskEntries=Object.entries(value.tasks || {});
    if(taskEntries.length>10000)throw Error('Backup contains too many task records.');
    for(const [id,item] of taskEntries) {
      if(previous&&Object.hasOwn(previous.tasks,id)&&same(item,previous.tasks[id])){out.tasks[id]=previous.tasks[id];continue;}
      if(!/^(\d+|local-[\w-]+)$/.test(id)||!isRecord(item))throw Error('Invalid task record in backup.');
      if(item.plannedDate && !validDay(item.plannedDate))throw Error('Invalid planned date in backup.');
      if(typeof item.notes==='string' && item.notes.length>20000)throw Error('A task note exceeds the 20,000 character limit.');
      if(Array.isArray(item.checklist)&&item.checklist.length>100)throw Error('A checklist contains too many steps (maximum 100).');
      out.tasks[id]={pinned:item.pinned===true,checkedOff:item.checkedOff===true,progress:['not-started','in-progress','done'].includes(item.progress)?item.progress:'not-started',notes:text(item.notes),estimate:Number.isFinite(item.estimate)?Math.max(0,Math.min(1440,item.estimate)):0,plannedDate:/^\d{4}-\d{2}-\d{2}$/.test(item.plannedDate)?item.plannedDate:'',checklist:Array.isArray(item.checklist)?item.checklist.filter(isRecord).slice(0,100).map(x=>({id:text(x.id,100),text:text(x.text,300),done:x.done===true})):[]};
    }
    if((value.customTasks||[]).length>1000)throw Error('Backup contains too many personal tasks (maximum 1,000).');
    const ids=new Set();
    for(const item of (value.customTasks || [])) {
      if(!isRecord(item)||!/^local-[\w-]+$/.test(item.id)||!text(item.name,200).trim())throw Error('Invalid personal task in backup.');
      if(ids.has(item.id))throw Error('Duplicate personal task identifier in backup.');ids.add(item.id);
      const custom={id:item.id,name:text(item.name,200),courseId:/^\d+$/.test(item.courseId)?item.courseId:'personal',dueAt:instant(item.dueAt),createdAt:instant(item.createdAt)};
      const source=taskSource(item.source);if(source)custom.source=source;
      out.customTasks.push(custom);
    }
    if(value.toolbox!==undefined){
      if(!isRecord(value.toolbox)||value.toolbox.scratchpad!==undefined&&typeof value.toolbox.scratchpad!=='string'||value.toolbox.recent!==undefined&&!Array.isArray(value.toolbox.recent))throw Error('Invalid toolbox data in backup.');
      if((value.toolbox.scratchpad||'').length>30000)throw Error('The scratchpad exceeds 30,000 characters. Copy some text out before saving.');
      const size=value.toolbox.dockSize;
      if(size!==undefined&&!isRecord(size))throw Error('Invalid toolbox dock size in backup.');
      for(const axis of ['width','height'])if(size?.[axis]!==undefined&&(!Number.isFinite(size[axis])||size[axis]<0||size[axis]>10000))throw Error('Toolbox dock size must contain finite numbers between 0 and 10,000 pixels.');
      // Keep safe future toolbox fields while validating the fields this version owns.
      out.toolbox=previous&&same(value.toolbox,previous.toolbox)?previous.toolbox:{...clone(value.toolbox),scratchpad:text(value.toolbox.scratchpad,30000),recent:[...new Set((value.toolbox.recent||[]).filter(id=>typeof id==='string'&&id.length<=500))].slice(0,24),dockSize:{...clone(size||{}),width:size?.width??0,height:size?.height??0}};
    }
    if(isRecord(value.focus)) out.focus={minutes:[15,25,45,60].includes(value.focus.minutes)?value.focus.minutes:25,remaining:Number.isFinite(value.focus.remaining)?Math.max(0,Math.min(3600,value.focus.remaining)):1500,endsAt:Number.isFinite(value.focus.endsAt)?value.focus.endsAt:null,itemId:text(value.focus.itemId,100)||null,sessions:Number.isInteger(value.focus.sessions)?Math.max(0,value.focus.sessions):0};
    if(value.pet!==undefined&&value.pet!==null){
      if(!isRecord(value.pet))throw Error('Invalid companion data in backup.');
      for(const [key,item] of Object.entries(value.pet).slice(0,32)){
        if(!/^[a-zA-Z]{1,24}$/.test(key))continue;
        if(typeof item==='boolean')out.pet[key]=item;
        else if(typeof item==='string')out.pet[key]=item.slice(0,140);
        else if(Number.isFinite(item))out.pet[key]=Math.max(0,Math.min(1000000,Math.trunc(item)));
      }
    }
    if(bytes(out)>4000000)throw Error('Personal data is too large. Export a backup, then remove unused images or old notes to stay below 4 MB.');
    return out;
  }
  function validateBackup(input,owner) {
    if(bytes(input)>6500000)throw Error('Backup is too large.');
    if(typeof input==='string') {try{input=JSON.parse(input);}catch{throw Error('Choose a valid Canvas Harness JSON backup.');}}
    if(!isRecord(input)||input.format!=='reserve-backup'||input.version!==1)throw Error('This is not a supported Canvas Harness backup format.');
    if(owner && (!input.owner||String(input.owner.accountId)!==String(owner.accountId)||input.owner.origin!==owner.origin))throw Error('This backup belongs to a different Canvas account or site. Sign in to its original account to restore it.');
    return cleanData(input.data);
  }
  // Only private, previously validated branches may be reused by the worker.
  // Changed input, hostile keys, and the total byte budget are checked every time.
  function accountValidator(){let previous;return value=>{previous=cleanData(value,previous&&personal(previous));};}
  // The background opts in after loading the shared validators. One worker owns
  // compare-and-write across documents; Canvas-origin locks alone cannot do that.
  function serveAccountWrites({runtime=root.chrome?.runtime,local=root.chrome?.storage?.local,ready=Promise.resolve()}={}){
    if(!runtime?.onMessage?.addListener||!local)return null;
    if(accountServers.has(runtime))return accountServers.get(runtime);
    const validators=new Map();let dead=false;
    function validate(key,value){
      let validator=validators.get(key);
      if(!validator){validator=accountValidator();if(validators.size>=8)validators.delete(validators.keys().next().value);validators.set(key,validator);}
      validator(value);
    }
    const handler=(message,sender,reply)=>{
      if(dead||message?.target!=='ch-account-write')return;
      (async()=>{
        await (typeof ready==='function'?ready():ready);
        let url;try{url=new URL(sender?.url);}catch{}
        const prefix='reserve:v1:'+url?.origin+':';
        if(dead||sender?.id!==runtime.id||sender.frameId!==0||!Number.isInteger(sender.tab?.id)||!url||url.username||url.password||
          !root.ReserveSite?.supported(url.href)||typeof message.key!=='string'||!message.key.startsWith(prefix)||!/^\d+$/.test(message.key.slice(prefix.length))||
          !isRecord(message.value)||message.before!=null&&!isRecord(message.before)||bytes(message.value)>4000000)throw Error('Invalid account write.');
        return lock('account-write:'+message.key,async()=>{
          if(dead)throw Error('Account writer is closed.');
          validate(message.key,message.value);
          const current=(await local.get(message.key))[message.key];
          if(!same(current,message.before))return {ok:false,conflict:true};
          await local.set({[message.key]:message.value});return {ok:true};
        });
      })().then(reply,error=>reply({ok:false,error:String(error?.message||'Account write failed.')}));
      return true;
    };
    const server={destroy(){if(dead)return;dead=true;runtime.onMessage.removeListener?.(handler);validators.clear();accountServers.delete(runtime);}};
    runtime.onMessage.addListener(handler);accountServers.set(runtime,server);return server;
  }
  function browserAdapter() {
    if(root.chrome?.storage?.local)return {
      remote:appearance?.messenger?.(),
      read:async key=>(await root.chrome.storage.local.get(key))[key],
      write:async(key,value)=>root.chrome.storage.local.set({[key]:value}),
      ...(root.chrome.runtime?.id&&root.chrome.runtime.sendMessage?{compareWrite:async(key,value,before)=>{
        const reply=await root.chrome.runtime.sendMessage({target:'ch-account-write',key,value,before});
        // Older workers use the existing Canvas-origin lock. Recheck its baseline
        // before falling back; the worker serializer remains authoritative when installed.
        if(reply===undefined){
          const current=(await root.chrome.storage.local.get(key))[key];
          if(!same(current,before))throw Object.assign(Error('Account changed. Try again.'),{code:'storage-conflict'});
          return root.chrome.storage.local.set({[key]:value});
        }
        if(reply?.ok!==true)throw Object.assign(Error(reply?.error||'Account changed. Try again.'),{code:reply?.conflict?'storage-conflict':'storage-error'});
      }}:{}),
      subscribe:(key,fn)=>{const handler=(changes,area)=>{if(area==='local'&&changes[key])fn(changes[key]);};root.chrome.storage.onChanged.addListener(handler);return()=>root.chrome.storage.onChanged.removeListener(handler);}
    };
    return {read:async key=>{const v=localStorage.getItem(key);return v?JSON.parse(v):null;},write:async(key,value)=>localStorage.setItem(key,JSON.stringify(value)),subscribe:(key,fn)=>{const handler=event=>{if(event.key===key){let newValue;try{newValue=event.newValue?JSON.parse(event.newValue):null;}catch{return fn();}fn({newValue});}};root.addEventListener('storage',handler);return()=>root.removeEventListener('storage',handler);}};
  }
  function createStore({accountId,origin=(globalThis.ReserveSite.origin()),adapter=browserAdapter()} = {}) {
    if(!accountId)throw Error('A verified account is required before loading personal data.');
    const owner={accountId:String(accountId),origin},key=`reserve:v1:${origin}:${accountId}`,listeners=new Set();let current=defaults(),savedRaw,savedClean,pendingWrite=null,destroyed=false;
    async function fromSaved(saved){
      if(!savedClean||!same(saved,savedRaw)){savedClean=saved?cleanData(saved,savedClean&&personal(savedClean)):null;savedRaw=saved;}
      const base=savedClean||defaults(),next={...base,settings:{...base.settings},pet:{...base.pet}};
      return appearance.apply(next,await appearance.read(adapter,next));
    }
    async function readData(){return fromSaved(await adapter.read(key));}
    async function load(){current=await readData();return clone(current);}
    function get(){return clone(current);}
    // A view failing after a successful write must not turn persistence into a
    // rejected transaction. Give each listener its own snapshot and isolation.
    function notify(){for(const listener of listeners){try{const result=listener(get());if(result&&typeof result.then==='function')Promise.resolve(result).catch(()=>{});}catch{}}}
    function edits(before,after,path=[]){
      const out=[];
      for(const name of new Set([...Object.keys(before),...Object.keys(after)])){
        const had=Object.hasOwn(before,name),has=Object.hasOwn(after,name),a=before[name],b=after[name];
        if(a===b&&had===has)continue;
        if(had&&has&&isRecord(a)&&isRecord(b))out.push(...edits(a,b,[...path,name]));
        else if(had!==has||!same(a,b))out.push({path:[...path,name],had,has,...(had?{before:clone(a)}:{}),...(has?{after:clone(b)}:{})});
      }
      return out;
    }
    function rebase(next,changes){
      const conflict=()=>Object.assign(Error('Settings changed. Try again.'),{code:'storage-conflict'});
      for(const change of changes){
        let node=next;
        for(const name of change.path.slice(0,-1)){if(!isRecord(node[name]))throw conflict();node=node[name];}
        const name=change.path.at(-1),has=Object.hasOwn(node,name);
        if(has===change.has&&(!has||same(node[name],change.after)))continue;
        if(has!==change.had||has&&!same(node[name],change.before))throw conflict();
        if(change.has)node[name]=clone(change.after);else delete node[name];
      }
    }
    function update(mutator,{retry=true}={}) {
      return lock(key,async()=>{let changesToRetry=null;
        for(let attempt=0;attempt<8;attempt++){
        const rawBefore=await adapter.read(key),draftBefore=await fromSaved(rawBefore),next=clone(draftBefore),before=appearance.fromData(draftBefore);
        const oldLayout=next.settings.dashboardLayout,oldOrder=next.settings.deskOrder;
        if(changesToRetry)rebase(next,changesToRetry);else mutator(next);
        // Older Canvas Harness settings controls still write dashboardLayout alone.
        // Accept those updates without overwriting an explicit newer deskOrder.
        if(next.settings?.dashboardLayout!==oldLayout&&next.settings?.deskOrder===oldOrder&&['split','list'].includes(next.settings.dashboardLayout))next.settings.deskOrder=next.settings.dashboardLayout==='list'?'stacked':'context-first';
        const clean=cleanData(next,savedClean?draftBefore:undefined),after=appearance.fromData(clean),changes={};
        if(adapter.compareWrite&&!changesToRetry)changesToRetry=edits(draftBefore,clean);
        for(const name of Object.keys(after))if(after[name]!==before[name])changes[name]=after[name];
        const personalNext=personal(clean);
        try{
        if(!same(personalNext,personal(draftBefore))){
          pendingWrite=personalNext;
          try{
            if(adapter.compareWrite)await adapter.compareWrite(key,personalNext,rawBefore);else await adapter.write(key,personalNext);
            savedRaw=personalNext;savedClean=clean;
          }finally{pendingWrite=null;}
        }
        if(Object.keys(changes).length)await appearance.write(adapter,changes);
        current=appearance.apply(clean,await appearance.read(adapter));notify();return get();
        }catch(error){if(retry&&error?.code==='storage-conflict'&&attempt<7)continue;throw error;}
      }});
    }
    async function replace(data){const clean=cleanData(data);return update(next=>{for(const name of Object.keys(next))delete next[name];Object.assign(next,clean);},{retry:false});}
    function validCache(snapshot) {return snapshot&&snapshot.origin===origin&&String(snapshot.user?.id)===String(accountId)&&Array.isArray(snapshot.courses)&&Array.isArray(snapshot.assignments);}
    const reload=change=>{
      if(destroyed)return;
      if(change&&Object.hasOwn(change,'newValue')&&(pendingWrite&&same(change.newValue,pendingWrite)||savedClean&&same(change.newValue,savedRaw)))return;
      lock(key,async()=>{if(destroyed)return;const previous=current,next=await readData();if(!destroyed){current=next;if(!same(current,previous))notify();}}).catch(()=>{});
    };
    const reloadAppearance=()=>{if(destroyed)return;lock(key,async()=>{if(destroyed)return;const next=await appearance.read(adapter),before=appearance.fromData(current);if(!destroyed&&!same(next,before)){current=appearance.apply({...current,settings:{...current.settings},pet:{...current.pet}},next);notify();}}).catch(()=>{});};
    const unsubscribe=adapter.subscribe?.(key,reload),unsubscribeAppearance=adapter.subscribe?.(appearance.KEY,reloadAppearance);
    async function saveRecovery(){return lock(key,async()=>{await load();await adapter.write(`${key}:cache`,null);await adapter.write(`${key}:recovery`,{format:'reserve-backup',version:1,owner,data:get()});});}
    async function readRecovery(){const v=await adapter.read(`${key}:recovery`);return v?validateBackup(v,owner):null;}
    // Optional deadline metadata has its own bounded, account-scoped record. It never rewrites personal notes or cached coursework.
    const deadlineKey=`${key}:deadline-changes`;
    const readDeadlineChanges=()=>adapter.read(deadlineKey);
    function updateDeadlineChanges(change){return lock(deadlineKey,async()=>{const previous=await adapter.read(deadlineKey),next=change(previous);if(next===undefined)return previous;if(bytes(next)>2000000)throw Error('Deadline observations exceed the device storage limit.');if(!same(previous,next))await adapter.write(deadlineKey,next);return clone(next);});}
    const subscribeDeadlineChanges=fn=>adapter.subscribe?.(deadlineKey,fn)||(()=>{});
    const materialKey=`${key}:materials`;
    function validResources(v,id){return isRecord(v)&&v.origin===origin&&String(v.accountId)===owner.accountId&&String(v.courseId)===String(id)&&/^\d+$/.test(String(id));}
    async function readResourceCache(id){if(!/^\d+$/.test(String(id)))return null;const entries=await adapter.read(materialKey);const v=isRecord(entries)?entries[id]:null;return validResources(v,id)?v:null;}
    async function writeResourceCache(v){
      if(!validResources(v,v?.courseId))throw Error('Material cache belongs to another account or course.');
      if(bytes(v)>1500000)throw Error('These materials are too large to save for a later visit.');
      return lock(materialKey,async()=>{const previous=await adapter.read(materialKey),entries=isRecord(previous)?previous:{};entries[v.courseId]=v;
        const oldest=Object.keys(entries).filter(id=>id!==v.courseId).sort((a,b)=>(Date.parse(entries[a]?.fetchedAt)||0)-(Date.parse(entries[b]?.fetchedAt)||0));
        while(bytes(entries)>2000000||Object.keys(entries).length>6){const id=oldest.shift();if(!id)break;delete entries[id];}
        await adapter.write(materialKey,entries);
      });
    }
    return {load,get,update,replace,owner,readDeadlineChanges,updateDeadlineChanges,subscribeDeadlineChanges,saveRecovery,readRecovery,readResourceCache,writeResourceCache,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},destroy:()=>{if(destroyed)return;destroyed=true;try{unsubscribe?.();}catch{}try{unsubscribeAppearance?.();}catch{}listeners.clear();},exportBackup:()=>({format:'reserve-backup',version:1,owner,exportedAt:new Date().toISOString(),data:cleanData(get())}),readCache:async()=>{const v=await adapter.read(`${key}:cache`);return validCache(v)?v:null;},writeCache:async snapshot=>{if(!validCache(snapshot))throw Error('Cache owner, origin, or account is invalid.');if(bytes(snapshot)>4000000)throw Error('Canvas snapshot is too large to cache. Live data is still available.');return adapter.write(`${key}:cache`,snapshot);}};
  }
  const api = { createStore, validateBackup, accountValidator, serveAccountWrites };
  root.ReserveStorage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
