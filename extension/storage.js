/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function (root) {
  'use strict';
  const clone = value => structuredClone(value);
  const customization=root.ReserveCustomization||(typeof module==='object'&&module.exports?require('./customization-model.js'):null);
  // appearanceVersion 2 (Canvas Harness 2.15) made Clay the default accent; see cleanData.
  // readingFont: teacher text in the book serif or the interface sans; greeting: the time-of-day heading.
  // hiddenCourses: hidden by hand. shownCourses (2.17): shown by hand, which keeps a course that is hidden
  // by default (NameCoach, College Counseling: ReserveCore.hiddenCourseIds) on screen. An id is in one list at most.
  const defaults = () => ({version:1,settings:{theme:'system',accent:'clay',appearanceVersion:2,motion:'gentle',livingArt:'on',readingFont:'book',greeting:'on',density:'comfortable',font:'system',textSize:'standard',dashboardLayout:'split',showCourseStrip:true,showGrades:false,showRecentGrades:false,timeZone:globalThis.ReserveSite.timeZone(),courseOrder:[],hiddenCourses:[],shownCourses:[],coursePrefs:{}},tasks:{},resourcePins:[],customTasks:[],toolbox:{scratchpad:'',recent:[],dockSize:{width:0,height:0}},focus:{minutes:25,remaining:1500,endsAt:null,itemId:null,sessions:0}});
  const text = (value,max=20000) => typeof value === 'string' ? value.slice(0,max) : '';
  const isRecord = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const personalWork = root.ReservePersonalWork || (typeof module === 'object' && module.exports && typeof require === 'function' ? require('./personal-work.js') : null);
  const queues = new Map();
  const bytes = value => new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).length;
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
  function cleanData(value) {
    if (!isRecord(value)) throw Error('Backup data must be an object.');
    safeKeys(value);
    const out = defaults(), settings=value.settings || {};
    if (!isRecord(settings) || (value.tasks && !isRecord(value.tasks)) || (value.customTasks && !Array.isArray(value.customTasks))) throw Error('Backup data has an invalid structure.');
    Object.assign(out.settings,customization.cleanSettings(settings));
    for(const [key,allowed] of Object.entries({theme:['light','dark','system'],accent:['clay','forest','indigo','rose','ocean','amber'],motion:['gentle','still','off'],livingArt:['on','off'],readingFont:['book','interface'],greeting:['on','off'],density:['comfortable','compact'],font:['system','humanist','serif'],textSize:['standard','large'],dashboardLayout:['split','list']})) {
      if (settings[key] !== undefined && !allowed.includes(settings[key])) throw Error(`Invalid ${key} setting in backup.`);
      if (settings[key]) out.settings[key]=settings[key];
    }
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
    if (isRecord(settings.coursePrefs)) for(const [id,pref] of Object.entries(settings.coursePrefs)) {
      if (!/^\d+$/.test(id)||!isRecord(pref)) continue;
      out.settings.coursePrefs[id]={name:text(pref.name,100),color:/^#[\da-f]{6}$/i.test(pref.color)?pref.color:'',image:typeof pref.image==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(pref.image)&&pref.image.length<400000?pref.image:'',...customization.cleanAppearance(pref)};
    }
    customization.checkBudget(out.settings);
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
      out.toolbox={...clone(value.toolbox),scratchpad:text(value.toolbox.scratchpad,30000),recent:[...new Set((value.toolbox.recent||[]).filter(id=>typeof id==='string'&&id.length<=500))].slice(0,24),dockSize:{...clone(size||{}),width:size?.width??0,height:size?.height??0}};
    }
    if(isRecord(value.focus)) out.focus={minutes:[15,25,45,60].includes(value.focus.minutes)?value.focus.minutes:25,remaining:Number.isFinite(value.focus.remaining)?Math.max(0,Math.min(3600,value.focus.remaining)):1500,endsAt:Number.isFinite(value.focus.endsAt)?value.focus.endsAt:null,itemId:text(value.focus.itemId,100)||null,sessions:Number.isInteger(value.focus.sessions)?Math.max(0,value.focus.sessions):0};
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
  function browserAdapter() {
    if(root.chrome?.storage?.local)return {read:async key=>(await chrome.storage.local.get(key))[key],write:async(key,value)=>chrome.storage.local.set({[key]:value}),subscribe:(key,fn)=>{const handler=(changes,area)=>{if(area==='local'&&changes[key])fn();};chrome.storage.onChanged.addListener(handler);return()=>chrome.storage.onChanged.removeListener(handler);}};
    return {read:async key=>{const v=localStorage.getItem(key);return v?JSON.parse(v):null;},write:async(key,value)=>localStorage.setItem(key,JSON.stringify(value)),subscribe:(key,fn)=>{const handler=event=>{if(event.key===key)fn();};root.addEventListener('storage',handler);return()=>root.removeEventListener('storage',handler);}};
  }
  function createStore({accountId,origin=(globalThis.ReserveSite.origin()),adapter=browserAdapter()} = {}) {
    if(!accountId)throw Error('A verified account is required before loading personal data.');
    const owner={accountId:String(accountId),origin},key=`reserve:v1:${origin}:${accountId}`,listeners=new Set();let current=defaults();
    async function load(){const saved=await adapter.read(key);current=cleanData(saved||defaults());return clone(current);}
    function get(){return clone(current);}
    function update(mutator) {
      return lock(key,async()=>{const saved=await adapter.read(key),next=saved?cleanData(saved):defaults();mutator(next);const clean=cleanData(next);await adapter.write(key,clean);current=clean;for(const listener of listeners)listener(get());return get();});
    }
    async function replace(data){const clean=cleanData(data);return update(next=>{for(const name of Object.keys(next))delete next[name];Object.assign(next,clean);});}
    function validCache(snapshot) {return snapshot&&snapshot.origin===origin&&String(snapshot.user?.id)===String(accountId)&&Array.isArray(snapshot.courses)&&Array.isArray(snapshot.assignments);}
    const unsubscribe=adapter.subscribe?.(key,()=>{lock(key,async()=>{const previous=JSON.stringify(current);await load();if(JSON.stringify(current)!==previous)for(const listener of listeners)listener(get());}).catch(()=>{});});
    async function saveRecovery(){return lock(key,async()=>{await load();await adapter.write(`${key}:cache`,null);await adapter.write(`${key}:recovery`,{format:'reserve-backup',version:1,owner,data:get()});});}
    async function readRecovery(){const v=await adapter.read(`${key}:recovery`);return v?validateBackup(v,owner):null;}
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
    return {load,get,update,replace,owner,saveRecovery,readRecovery,readResourceCache,writeResourceCache,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},destroy:()=>{unsubscribe?.();listeners.clear();},exportBackup:()=>({format:'reserve-backup',version:1,owner,exportedAt:new Date().toISOString(),data:cleanData(get())}),readCache:async()=>{const v=await adapter.read(`${key}:cache`);return validCache(v)?v:null;},writeCache:async snapshot=>{if(!validCache(snapshot))throw Error('Cache owner, origin, or account is invalid.');if(bytes(snapshot)>4000000)throw Error('Canvas snapshot is too large to cache. Live data is still available.');return adapter.write(`${key}:cache`,snapshot);}};
  }
  const api = { createStore, validateBackup };
  root.ReserveStorage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
