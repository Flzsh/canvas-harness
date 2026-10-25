// Adapted from Gary Wu's pull request #47 to Canvas Harness.
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
  const defaults = () => ({version:1,settings:{...layoutDefaults,makeYourOwn:{theme:null,pet:null,installed:{}},theme:'system',accent:'clay',appearanceVersion:2,motion:'gentle',livingArt:'on',readingFont:'book',greeting:'on',quickOpen:'off',density:'comfortable',font:'system',textSize:'standard',dashboardLayout:'split',showCourseStrip:true,showGrades:false,showRecentGrades:false,timeZone:globalThis.ReserveSite.timeZone(),courseOrder:[],hiddenCourses:[],shownCourses:[],coursePrefs:{},overviewArt:{}},tasks:{},moduleProgress:{},courseFiles:{},resourcePins:[],customTasks:[],gpa:gpa.defaults(),toolbox:{scratchpad:'',recent:[],dockSize:{width:0,height:0}},focus:{minutes:25,remaining:1500,endsAt:null,itemId:null,sessions:0},pet:{skills:petSkills(),reminders:[],routines:[]}});
  const text = (value,max=20000) => typeof value === 'string' ? value.slice(0,max) : '';
  const isRecord = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const courseFileTypes={pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',txt:'text/plain',md:'text/plain',csv:'text/csv',rtf:'application/rtf',odt:'application/vnd.oasis.opendocument.text',pages:'application/vnd.apple.pages',key:'application/vnd.apple.keynote',numbers:'application/vnd.apple.numbers',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',avif:'image/avif',bmp:'image/bmp',tif:'image/tiff',tiff:'image/tiff',heic:'image/heic',heif:'image/heif'};
  function cleanCourseFiles(value){
    if(!isRecord(value))return {};const out={},seen=new Set(),words=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n):'';let count=0,total=0;
    for(const [course,rows]of Object.entries(value)){
      if(!/^\d{1,20}$/.test(course)||Object.keys(out).length>=500)continue;const list=[],local=new Set();
      for(const x of Array.isArray(rows)?rows:[]){
        if(!isRecord(x)||typeof x.id!=='string'||!/^cf-[\w-]{4,60}$/.test(x.id)||local.has(x.id))continue;const title=words(x.title,120)||'Untitled',added=words(x.added,40);let row;
        if(x.kind==='link'&&typeof x.url==='string'&&!/[\u0000-\u001f\u007f]/.test(x.url)){let link=x.url.trim();if(link&&link.length<=2048){if(!/^[a-z][a-z0-9+.-]*:/i.test(link))link='https://'+link;try{const u=new URL(link);if(/^https?:$/.test(u.protocol)&&u.hostname.includes('.')&&!u.username&&!u.password&&u.href.length<=2048)row={id:x.id,kind:'link',title,url:u.href,...(added?{added}:{})};}catch{}}}
        else if(x.kind==='file'&&typeof x.name==='string'&&x.name.trim()&&x.name.length<=200&&!/[\u0000-\u001f\u007f/\\]/.test(x.name)&&Number.isSafeInteger(x.size)&&x.size>0&&x.size<=25000000){const name=x.name.trim(),extension=name.match(/\.([^.]+)$/)?.[1].toLowerCase(),type=Object.hasOwn(courseFileTypes,extension)?courseFileTypes[extension]:'';if(type)row={id:x.id,kind:'file',title,name,type,size:x.size,...(added?{added}:{})};}
        if(row){local.add(row.id);if(!seen.has(row.id)){if(++count>1000)throw Error('Keep up to 1,000 course links and files. Remove an item before adding another.');if(row.kind==='file'&&(total+=row.size)>250000000)throw Error('Saved course files exceed 250 MB. Remove a file before adding another.');seen.add(row.id);list.push(row);}}if(local.size>=60)break;
      }if(list.length)out[course]=list;
    }return out;
  }
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
    for(const key of ['theme','motion','nightArt','sceneTheme'])delete out.settings[key];
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
  function petBrain(value){
    const v=isRecord(value)?value:{},n=x=>Number.isFinite(x)?Math.max(0,Math.min(1000000,Math.trunc(x))):0,t=x=>Number.isFinite(x)?Math.max(0,Math.min(8640000000000000,x)):0,b=isRecord(v.nudges)?v.nudges:{};
    return {kinds:Object.fromEntries(Object.entries(isRecord(v.kinds)?v.kinds:{}).filter(([k,x])=>/^[a-z][a-z0-9_-]{0,47}$/.test(k)&&isRecord(x)).slice(0,64).map(([k,x])=>[k,{shown:n(x.shown),used:n(x.used),ignored:n(x.ignored),streak:n(x.streak)}])),nudges:{day:petDay(b.day)?b.day:'',count:Math.min(3,n(b.count)),items:[...new Set(Array.isArray(b.items)?b.items.filter(x=>typeof x==='string'&&x.trim()&&x.length<=256&&!/[\u0000-\u001f\u007f]/.test(x)):[])].slice(-512)},hiddenUntil:t(v.hiddenUntil),quietUntil:t(v.quietUntil)};
  }
  // Storage loads before the pony modules. Keep its bounded account data independent of them.
  const petField=(value,key)=>isRecord(value)&&Object.hasOwn(value,key)?value[key]:undefined;
  const petId=value=>typeof value==='string'&&value.trim()&&value.length<=80&&!/[\u0000-\u001f\u007f]/.test(value)&&!['__proto__','constructor','prototype'].includes(value)?value:'';
  const petText=value=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,240):'';
  const petTime=value=>Number.isFinite(value)&&value>0&&value<=8640000000000000;
  const petDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  function petSkills(value){
    return Object.fromEntries(['deadline','focus','planner','wellbeing','inbox','reminders','night'].map(key=>{const item=petField(value,key);return [key,typeof item==='boolean'?item:true];}));
  }
  function petReminders(value,now=Date.now()){
    const out=[],seen=new Set();
    for(const row of Array.isArray(value)?value:[]){
      if(out.length>=20)break;
      const id=petId(petField(row,'id')),text=petText(petField(row,'text')),at=petField(row,'at'),createdAt=petField(row,'createdAt');
      // Keep a day of overdue reminders so an already-open tab can deliver them after sleep.
      if(!id||!text||!petTime(at)||at<now-86400000||!petTime(createdAt)||seen.has(id))continue;
      const delivered=petField(row,'delivered');seen.add(id);out.push({id,text,at,createdAt,...(typeof delivered==='string'&&petTime(Number(delivered))&&String(Number(delivered))===delivered?{delivered}:{})});
    }
    return out;
  }
  function petRoutines(value){
    const out=[],seen=new Set();
    for(const row of Array.isArray(value)?value:[]){
      if(out.length>=20)break;
      const id=petId(petField(row,'id')),name=petText(petField(row,'name')),minute=petField(row,'minute'),action=petField(row,'action'),createdAt=petField(row,'createdAt'),last=petField(row,'last'),rawDays=petField(row,'days'),rawData=petField(row,'data'),days=[];
      if(!id||!name||seen.has(id)||!Number.isInteger(minute)||minute<0||minute>1439||!petTime(createdAt)||!Array.isArray(rawDays))continue;
      for(const day of rawDays){if(Number.isInteger(day)&&day>=0&&day<=6&&!days.includes(day))days.push(day);if(days.length===7)break;}
      if(!days.length)continue;
      let data;
      if(action==='focus'||action==='break'){
        const minutes=petField(rawData,'minutes');if(!(action==='focus'?[15,25,45,60]:[5,10,15]).includes(minutes))continue;data={minutes};
      }else if(action==='plan'){
        const mode=petField(rawData,'mode');if(!['tonight','tomorrow','week'].includes(mode))continue;data={mode};
      }else if(action==='remind'){
        const text=petText(petField(rawData,'text'));if(!text)continue;data={text};
      }else continue;
      seen.add(id);out.push({id,name,days,minute,action,data,createdAt,last:petDay(last)?last:''});
    }
    return out;
  }
  function cleanMakeYourOwn(value){
    const bad=()=>{throw Error('Invalid make-your-own pack references.');},row=(v,kind)=>{if(!isRecord(v)||Object.keys(v).length!==3||typeof v.id!=='string'||!/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(v.id)||['__proto__','constructor','prototype'].includes(v.id)||typeof v.name!=='string'||!v.name.trim()||v.name.length>120||/[\p{C}\u2028\u2029]/u.test(v.name)||!['theme','pet','preset'].includes(v.kind)||kind&&v.kind!==kind)bad();return {id:v.id,name:v.name,kind:v.kind};};
    if(value===undefined)return {theme:null,pet:null,installed:{}};if(!isRecord(value)||Object.keys(value).some(k=>!['theme','pet','installed'].includes(k))||value.installed!==undefined&&!isRecord(value.installed)||Object.keys(value.installed||{}).length>50)bad();const installed={};for(const [id,v]of Object.entries(value.installed||{})){const item=row(v);if(item.id!==id)bad();installed[id]=item;}
    const out={theme:value.theme==null?null:row(value.theme,'theme'),pet:value.pet==null?null:row(value.pet,'pet'),installed};for(const kind of ['theme','pet'])if(out[kind]&&(!installed[out[kind].id]||!same(out[kind],installed[out[kind].id])))bad();return out;
  }
  function cleanModuleProgress(value){
    if(value===undefined)return {};if(!isRecord(value)||Object.keys(value).length>1000)throw Error('Invalid module progress in backup.');
    const out={};let total=0;
    for(const [course,data]of Object.entries(value)){
      if(!/^\d+$/.test(course)||!isRecord(data)||data.hideFinished!==undefined&&typeof data.hideFinished!=='boolean'||data.marks!==undefined&&!isRecord(data.marks))throw Error('Invalid module progress in backup.');
      const marks={};for(const [item,mark]of Object.entries(data.marks||{})){if(++total>50000||!/^\d+$/.test(item)||!['done','opened','undone'].includes(mark))throw Error('Invalid module mark in backup.');marks[item]=mark;}
      out[course]={marks,hideFinished:data.hideFinished===true};
    }
    return out;
  }
  function cleanReviewDeck(value){
    const bad=()=>{throw Error('Invalid review deck in backup.');},course=id=>typeof id==='string'&&/^(?:\d{1,20}|personal)$/.test(id),day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
    const integer=(value,min,max,fallback)=>value===undefined?fallback:Number.isInteger(value)&&value>=min&&value<=max?value:bad(),words=value=>value.replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim();
    if(value===null)value={};if(!isRecord(value)||value.version!==undefined&&value.version!==1||value.cards!==undefined&&!Array.isArray(value.cards)||value.log!==undefined&&!Array.isArray(value.log)||value.settings!==undefined&&!isRecord(value.settings)||value.testDates!==undefined&&!isRecord(value.testDates)||(value.cards?.length||0)>2000||(value.log?.length||0)>120)bad();
    const side=value=>{if(value!==undefined&&!isRecord(value))bad();value||={};for(const key of ['due','first','last'])if(value[key]!==undefined&&value[key]!==''&&!day(value[key]))bad();if(value.first&&value.last&&value.first>value.last)bad();return {box:integer(value.box,0,7,0),due:value.due||'',lapses:integer(value.lapses,0,100000,0),first:value.first||'',last:value.last||''};};
    const ids=new Set(),cards=(value.cards||[]).map(card=>{
      if(!isRecord(card)||typeof card.id!=='string'||!/^rc-[\w-]{4,60}$/.test(card.id)||ids.has(card.id)||!course(card.c)||typeof card.f!=='string'||card.b!==undefined&&typeof card.b!=='string'||card.f.length>1000||(card.b?.length||0)>1000||card.s!==undefined&&!isRecord(card.s)||card.added!==undefined&&card.added!==''&&!day(card.added))bad();
      ids.add(card.id);const f=words(card.f),b=words(card.b||''),cloze=/\{\{([^{}]+)\}\}/.test(f),two=card.two===true&&!cloze;
      if(!f||!b&&!cloze||/\{\{|\}\}/.test(f.replace(/\{\{([^{}]+)\}\}/g,'')))bad();
      return {id:card.id,c:card.c,f,b,two,added:card.added||'',paused:card.paused===true,s:{f:side(card.s?.f),...(two?{b:side(card.s?.b)}:{})}};
    });
    const testDates={};if(Object.keys(value.testDates||{}).length>500)bad();for(const [id,date]of Object.entries(value.testDates||{})){if(!course(id)||!day(date))bad();testDates[id]=date;}
    const days=new Set(),log=(value.log||[]).map(entry=>{if(!isRecord(entry)||!day(entry.d)||days.has(entry.d))bad();days.add(entry.d);return {d:entry.d,n:integer(entry.n,0,100000,0),r:integer(entry.r,0,100000,0),w:integer(entry.w,0,100000,0),done:entry.done===true};}).sort((a,b)=>a.d.localeCompare(b.d)),prefs=value.settings||{};
    return {version:1,cards,settings:{newPerDay:integer(prefs.newPerDay,0,50,10),maxReviews:integer(prefs.maxReviews,10,500,100)},testDates,log};
  }
  function cleanData(value,previous) {
    if (!isRecord(value)) throw Error('Backup data must be an object.');
    if(value.courseFiles!==undefined)value={...value,courseFiles:cleanCourseFiles(value.courseFiles)};
    safeKeys(value);
    const out = defaults(), settings=value.settings || {},sameSettings=previous&&same(settings,previous.settings);
    out.moduleProgress=previous&&same(value.moduleProgress,previous.moduleProgress)?previous.moduleProgress:cleanModuleProgress(value.moduleProgress);
    out.courseFiles=previous&&same(value.courseFiles,previous.courseFiles)?previous.courseFiles:cleanCourseFiles(value.courseFiles);
    out.gpa=previous&&same(value.gpa,previous.gpa)?previous.gpa:gpa.cleanPreferences(value.gpa);
    if (!isRecord(settings) || (value.tasks && !isRecord(value.tasks)) || (value.customTasks && !Array.isArray(value.customTasks))) throw Error('Backup data has an invalid structure.');
    // Validate every restored SVG before returning data or committing a save.
    if(!customization)throw Error('Canvas Harness customization modules are missing. Reload the extension.');
    Object.assign(out.settings,sameSettings?previous.settings:customization.cleanSettings(settings));
    out.settings.makeYourOwn=sameSettings?previous.settings.makeYourOwn:cleanMakeYourOwn(settings.makeYourOwn);
    if(settings.reviewDecks!==undefined)out.settings.reviewDecks=sameSettings?previous.settings.reviewDecks:cleanReviewDeck(settings.reviewDecks);
    for(const [key,allowed] of Object.entries({theme:['light','dark','system'],accent:['clay','forest','indigo','rose','ocean','amber'],motion:['gentle','still','off'],livingArt:['on','off'],readingFont:['book','interface'],greeting:['on','off'],quickOpen:['on','off'],density:['comfortable','compact'],font:['system','humanist','serif'],textSize:['standard','large'],dashboardLayout:['split','list']})) {
      if (settings[key] !== undefined && !allowed.includes(settings[key]) && !(key==='accent'&&typeof settings[key]==='string'&&/^#[\da-f]{6}$/i.test(settings[key]))) throw Error(`Invalid ${key} setting in backup.`);
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
      if(item.plannedTime!==undefined&&(typeof item.plannedTime!=='string'||item.plannedTime!==''&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.plannedTime)))throw Error('Invalid planned time in backup.');
      if(typeof item.notes==='string' && item.notes.length>20000)throw Error('A task note exceeds the 20,000 character limit.');
      if(Array.isArray(item.checklist)&&item.checklist.length>100)throw Error('A checklist contains too many steps (maximum 100).');
      out.tasks[id]={...(item.plannedTime!==undefined?{plannedTime:item.plannedTime}:{}),...(['class','paper','none','teacher'].includes(item.doneReason)?{doneReason:item.doneReason}:{}),pinned:item.pinned===true,checkedOff:item.checkedOff===true,progress:['not-started','in-progress','done'].includes(item.progress)?item.progress:'not-started',notes:text(item.notes),estimate:Number.isFinite(item.estimate)?Math.max(0,Math.min(1440,item.estimate)):0,plannedDate:/^\d{4}-\d{2}-\d{2}$/.test(item.plannedDate)?item.plannedDate:'',checklist:Array.isArray(item.checklist)?item.checklist.filter(isRecord).slice(0,100).map(x=>({id:text(x.id,100),text:text(x.text,300),done:x.done===true})):[]};
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
    if(isRecord(value.focus)){
      const f=value.focus,minutes=Number.isFinite(f.minutes)&&f.minutes>0&&f.minutes*60000<=8640000000000000?f.minutes:25,remaining=Number.isFinite(f.remaining)?Math.max(0,f.remaining):minutes*60;
      out.focus={minutes,remaining,endsAt:Number.isFinite(f.endsAt)?f.endsAt:null,itemId:text(f.itemId,100)||null,sessions:Number.isInteger(f.sessions)?Math.max(0,f.sessions):0};
      for(const key of ['elapsed','pausedAt','stoppedAt'])if(Object.hasOwn(f,key))out.focus[key]=Number.isFinite(f[key])?Math.max(0,f[key]):0;
      if(Object.hasOwn(f,'courseId'))out.focus.courseId=text(f.courseId,100)||null;
      if(Object.hasOwn(value.focus,'fromPony'))out.focus.fromPony=value.focus.fromPony===true;
      for(const key of ['completedAt','breakUntil'])if(Object.hasOwn(value.focus,key))out.focus[key]=Number.isFinite(value.focus[key])?Math.max(0,value.focus[key]):0;
      if(Object.hasOwn(value.focus,'completedMinutes'))out.focus.completedMinutes=Number.isFinite(value.focus.completedMinutes)?Math.max(0,value.focus.completedMinutes):0;
      if(Object.hasOwn(f,'phase')){if(!['focus','break'].includes(f.phase))throw Error('Invalid timer phase in backup.');out.focus.phase=f.phase;}
      if(['focusMinutes','breakMinutes','cycles','cycle'].some(key=>Object.hasOwn(f,key))){
        if(!out.focus.phase||!Number.isFinite(f.focusMinutes)||f.focusMinutes<=0||!Number.isFinite(f.breakMinutes)||f.breakMinutes<0||!Number.isInteger(f.cycles)||f.cycles<1||f.cycles>1000||!Number.isInteger(f.cycle)||f.cycle<1||f.cycle>f.cycles||!Number.isFinite((f.focusMinutes+f.breakMinutes)*f.cycles*60000)||(f.focusMinutes+f.breakMinutes)*f.cycles*60000>8640000000000000)throw Error('Invalid timer cycles in backup.');
        Object.assign(out.focus,{focusMinutes:f.focusMinutes,breakMinutes:f.breakMinutes,cycles:f.cycles,cycle:f.cycle});
      }
      if(out.focus.phase==='break')out.focus.breakUntil=out.focus.endsAt||0;
    }
    if(value.pet!==undefined&&value.pet!==null){
      if(!isRecord(value.pet))throw Error('Invalid companion data in backup.');
      if(isRecord(value.pet.brain))out.pet.brain=petBrain(value.pet.brain);
      out.pet.skills=petSkills(value.pet.skills);out.pet.reminders=petReminders(value.pet.reminders);out.pet.routines=petRoutines(value.pet.routines);
      for(const [key,item] of Object.entries(value.pet).slice(0,32)){
        if(!/^[a-zA-Z]{1,24}$/.test(key)||['brain','skills','reminders','routines'].includes(key))continue;
        if(typeof item==='boolean')out.pet[key]=item;
        else if(typeof item==='string')out.pet[key]=item.slice(0,140);
        else if(Number.isFinite(item))out.pet[key]=Math.max(0,Math.min(1000000,Math.trunc(item)));
      }
    }
    if(bytes(out)>4000000)throw Error('Personal data is too large. Export a backup, then remove unused images or old notes to stay below 4 MB.');
    return out;
  }
  function validateBackup(input,owner) {
    const inputBytes=bytes(input);if(inputBytes>90000000)throw Error('Backup is too large.');
    if(typeof input==='string') {try{input=JSON.parse(input);}catch{throw Error('Choose a valid Canvas Harness JSON backup.');}}
    if(!isRecord(input)||input.format!=='reserve-backup'||input.version!==1)throw Error('This is not a supported Canvas Harness backup format.');
    const withFiles=Array.isArray(input.courseFileBytes)&&input.courseFileBytes.length>0;
    if(withFiles&&inputBytes>66500000)throw Error('Backup is too large.');
    if(input.packs===undefined&&input.media===undefined&&input.market===undefined&&!withFiles&&bytes(input)>6500000||input.packs!==undefined&&(!Array.isArray(input.packs)||input.packs.length>50))throw Error('Backup is too large or contains invalid packs.');
    if(input.media!==undefined&&(!isRecord(input.media)||input.media.version!==1||!Array.isArray(input.media.assets)||input.media.assets.length>2000||!Array.isArray(input.media.kits)||input.media.kits.length>200))throw Error('Invalid artwork media in backup.');
    if(input.market!==undefined&&(!isRecord(input.market)||input.market.version!==1||!isRecord(input.market.rows)||!isRecord(input.market.receipts)||Object.keys(input.market.rows).length>50||Object.keys(input.market.receipts).length>50))throw Error('Invalid account add-ons in backup.');
    if(owner && (!input.owner||String(input.owner.accountId)!==String(owner.accountId)||input.owner.origin!==owner.origin))throw Error('This backup belongs to a different Canvas account or site. Sign in to its original account to restore it.');
    const data=cleanData(input.data),files=new Map(Object.entries(data.courseFiles).flatMap(([course,list])=>list.filter(x=>x.kind==='file').map(x=>[course+':'+x.id,x]))),seen=new Set();
    if(input.courseFileBytes!==undefined){
      if(!Array.isArray(input.courseFileBytes)||input.courseFileBytes.length>1000)throw Error('Invalid course file backup payload.');
      for(const row of input.courseFileBytes){
        if(!isRecord(row)||Object.keys(row).some(k=>!['course','id','base64'].includes(k))||typeof row.course!=='string'||!/^\d{1,20}$/.test(row.course)||typeof row.id!=='string'||!/^cf-[\w-]{4,60}$/.test(row.id))throw Error('Invalid course file backup payload.');
        const key=row.course+':'+row.id,item=files.get(key),encoded=row.base64;if(!item||seen.has(key))throw Error('Invalid or duplicate course file in backup.');seen.add(key);
        if(typeof encoded!=='string'||encoded.length!==4*Math.ceil(item.size/3)||encoded.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)||encoded.length/4*3-(encoded.endsWith('==')?2:encoded.endsWith('=')?1:0)!==item.size)throw Error('Course file backup bytes do not match the saved file.');
      }
    }
    if(input.courseFilesOmitted!==undefined&&(!Number.isInteger(input.courseFilesOmitted)||input.courseFilesOmitted!==files.size-seen.size)||input.courseFilesNotice!==undefined&&(typeof input.courseFilesNotice!=='string'||input.courseFilesNotice.length>500))throw Error('Invalid course file backup notice.');
    return data;
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
  let courseFileLoading;
  async function courseFileModule(){
    if(root.ReserveCourseFiles)return root.ReserveCourseFiles;
    if(typeof module==='object'&&module.exports&&typeof require==='function')return require('./course-files.js');
    if(typeof root.importScripts==='function'){root.importScripts('course-files.js');if(root.ReserveCourseFiles)return root.ReserveCourseFiles;}
    if(root.chrome?.runtime?.sendMessage){
      try{await (courseFileLoading||=root.chrome.runtime.sendMessage({target:'ch-course-files',op:'load'}).then(reply=>{if(reply?.ok!==true)throw Error(reply?.error||'Course file support could not load.');}));}
      catch(error){courseFileLoading=null;throw error;}
      if(root.ReserveCourseFiles)return root.ReserveCourseFiles;
    }
    throw Error('Course file support is unavailable. Enable My links & files, reload Canvas and try again.');
  }
  const courseFileCount=data=>Object.values(data.courseFiles||{}).reduce((n,list)=>n+list.filter(x=>x.kind==='file').length,0);
  const courseFileNotice=count=>count?`${count} uploaded file${count===1?' was':'s were'} not included in this backup. Links and file names are included.`:'';
  function createStore({accountId,origin=(globalThis.ReserveSite.origin()),adapter=browserAdapter(),mediaStore=null,backupMediaStore=null,courseFilesIndexedDB=root.indexedDB} = {}) {
    if(!accountId)throw Error('A verified account is required before loading personal data.');
    const owner={accountId:String(accountId),origin},key=`reserve:v1:${origin}:${accountId}`,listeners=new Set();let current=defaults(),savedRaw,savedClean,pendingWrite=null,destroyed=false,packCache=[],mediaCache,marketCache,recoveryCourseFiles=null;
    async function refreshPacks(){const rows=Object.values(current.settings.makeYourOwn?.installed||{});if(!rows.length){packCache=[];return;}const references=root.ReserveMediaReference||(typeof module==='object'&&module.exports?require('./media-reference.js'):null),pool=references?.createPackReader(owner,{storage:{get:async key=>({[key]:await adapter.read(key)})}});if(!pool?.getPack)throw Error('Pack storage is unavailable.');try{const documents=[];for(const row of rows){const doc=await pool.getPack(row.id);if(!doc||doc.kind!==row.kind||doc.name!==row.name)throw Error('Saved pack is missing.');documents.push(doc);}packCache=documents;}finally{pool.close();}}
    function envelope(data,documents,media,market){
      const rows=Object.keys(data.settings.makeYourOwn?.installed||{});
      if(rows.length!==documents.length||rows.some(id=>!documents.some(p=>p.id===id)))throw Error('Reload packs before exporting this backup.');
      const result={format:'reserve-backup',version:1,owner,exportedAt:new Date().toISOString(),data:cleanData(data),...(documents.length?{packs:clone(documents)}:{}),...(media?{media:clone(media)}:{}),...(market?{market:clone(market)}:{})};
      const count=courseFileCount(result.data);if(count){result.courseFilesOmitted=count;result.courseFilesNotice=courseFileNotice(count);}
      if(bytes(result)>66500000)throw Error('Backup is too large to restore as one file. Export large artwork kits separately before making a smaller backup.');
      return result;
    }
    function exportBackup(){return envelope(get(),packCache,mediaCache,marketCache);}
    async function accountMarketBackup(){
      if(root.ReservePacks?.exportAccountBackup)return root.ReservePacks.exportAccountBackup({owner,store:api});
      const receipts=await adapter.read('reserve:packs:receipts');
      const owned=isRecord(receipts)&&Object.values(receipts).some(value=>isRecord(value)&&(value.key===key||value.owner?.origin===owner.origin&&String(value.owner?.accountId)===owner.accountId));
      if(!owned)return undefined;
      if(!root.chrome?.runtime?.sendMessage)throw Error('Add-on backup support is unavailable. Reload Canvas Harness.');
      const reply=await root.chrome.runtime.sendMessage({type:'market-local',op:'backup',owner});
      if(reply?.ok!==true)throw Error(reply?.error||reply?.reason||'Add-ons could not be backed up.');return reply.market;
    }
    async function withCourseFiles(backup){
      if(!courseFileCount(backup.data))return backup;let files;try{files=await courseFileModule();}catch(error){const omitted={...backup,courseFilesNotice:courseFileNotice(backup.courseFilesOmitted)+' '+error.message};if(bytes(omitted)>66500000)throw Error('Backup is too large.');return omitted;}return files.exportFiles(backup,{store:api,indexedDB:courseFilesIndexedDB});
    }
    async function captureBackup(){
      const data=get(),documents=clone(packCache),codec=root.ReserveBackupMedia||(typeof module==='object'&&module.exports?require('./backup-media.js'):null);
      if(!codec)throw Error('Artwork backup support is unavailable. Reload Canvas Harness.');
      const media=await codec.capture({owner,settings:data.settings,adapter,...(backupMediaStore?{localStore:backupMediaStore}:{})}),market=await accountMarketBackup();
      const result=await withCourseFiles(envelope(data,documents,media,market));mediaCache=media;marketCache=market;return result;
    }
    async function exportBackupWithPacks(){await sync();return captureBackup();}
    async function importBackup(input){
      const data=validateBackup(input,owner),backup=typeof input==='string'?JSON.parse(input):input;
      const publish=async()=>{
      const references=root.ReserveMediaReference||(typeof module==='object'&&module.exports?require('./media-reference.js'):null);
      if(!backup.packs?.length&&!backup.media&&!backup.market&&!references?.referenced(data.settings).size&&!Object.keys(data.settings.makeYourOwn.installed).length&&!Object.keys(current.settings.makeYourOwn?.installed||{}).length)return replace(data);
      await sync();const codec=root.ReserveBackupMedia||(typeof module==='object'&&module.exports?require('./backup-media.js'):null);
      if(!codec?.capture)throw Error('Artwork backup support is unavailable. Reload Canvas Harness.');
      const targetMedia=await codec.capture({owner,settings:get().settings,adapter,...(backupMediaStore?{localStore:backupMediaStore}:{})}),conflicts=backup.media&&references?.backupConflicts(backup.media,targetMedia);
      const packs=root.ReservePacks||(typeof module==='object'&&module.exports?require('./packs.js'):null);
      if(packs?.restoreBackup)return packs.restoreBackup(backup,{store:api,targetMedia,conflicts});
      if(root.chrome?.runtime?.sendMessage){const reply=await root.chrome.runtime.sendMessage({type:'market-local',op:'restore',backup,owner,...(targetMedia?{targetMedia}:{}),...(conflicts?{conflicts}:{})});if(reply?.ok!==true)throw Error(reply?.error||reply?.reason||'Pack restore failed.');await sync();return get();}throw Error('Pack support is unavailable.');
      };
      const beforeRestore=async()=>{if(recoveryCourseFiles!==null&&!same(await readCourseFiles(),recoveryCourseFiles))throw Error('Course links and files changed after the recovery backup. Review the backup and try restoring again.');};
      if(recoveryCourseFiles===null&&!courseFileCount(data)&&!courseFileCount({courseFiles:await readCourseFiles()}))return publish();
      const files=await courseFileModule(),result=await files.restoreFiles({...backup,data},{store:api,indexedDB:courseFilesIndexedDB,publish,beforeRestore});
      recoveryCourseFiles=null;return result;
    }
    async function fromSaved(saved){
      if(!savedClean||!same(saved,savedRaw)){savedClean=saved?cleanData(saved,savedClean&&personal(savedClean)):null;savedRaw=saved;}
      const base=savedClean||defaults(),next={...base,settings:{...base.settings},pet:{...base.pet}};
      return appearance.apply(next,await appearance.read(adapter,next));
    }
    async function readData(){return fromSaved(await adapter.read(key));}
    async function load(){current=await readData();await refreshPacks();return clone(current);}
    async function sync(){return lock(key,async()=>{if(destroyed)return get();const previous=current;current=await readData();await refreshPacks();if(!same(current,previous))notify();return get();});}
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
    function update(mutator,{retry=true,accountWriteLease}={}) {
      if(accountWriteLease!==undefined&&!ownsAccountWrite(accountWriteLease,key))return Promise.reject(Error('Invalid account write capability.'));
      return lock(key,async()=>{let changesToRetry=null;
        for(let attempt=0;attempt<8;attempt++){
        const rawBefore=await adapter.read(key),draftBefore=await fromSaved(rawBefore),next=clone(draftBefore),before=appearance.fromData(draftBefore);
        const media=root.ReserveMedia||(typeof module==='object'&&module.exports?require('./media-store.js'):null),oldMedia=media?.referenced(next.settings)||new Set();
        const oldLayout=next.settings.dashboardLayout,oldOrder=next.settings.deskOrder;
        if(changesToRetry)rebase(next,changesToRetry);else mutator(next);
        // Older Canvas Harness settings controls still write dashboardLayout alone.
        // Accept those updates without overwriting an explicit newer deskOrder.
        if(next.settings?.dashboardLayout!==oldLayout&&next.settings?.deskOrder===oldOrder&&['split','list'].includes(next.settings.dashboardLayout))next.settings.deskOrder=next.settings.dashboardLayout==='list'?'stacked':'context-first';
        const clean=cleanData(next,savedClean?draftBefore:undefined),after=appearance.fromData(clean),changes={};
        if(adapter.compareWrite&&!changesToRetry)changesToRetry=edits(draftBefore,clean);
        for(const name of Object.keys(after))if(after[name]!==before[name])changes[name]=after[name];
        const personalNext=personal(clean);
        // Protect newly referenced bytes while another document might remove their kit.
        const added=new Set([...(media?.referenced(clean.settings)||[])].filter(id=>!oldMedia.has(id))),refStore=added.size?(mediaStore||media.createStore(owner)):null;
        const token=refStore?(root.crypto||(typeof require==='function'?require('node:crypto').webcrypto:null)).randomUUID():null;let accountCommitted=false;
        try{if(refStore)await refStore.reserve(added,token,accountWriteLease===undefined?undefined:{accountWriteLease});
        if(!same(personalNext,personal(draftBefore))){
          pendingWrite=personalNext;
          try{
            if(adapter.compareWrite)await adapter.compareWrite(key,personalNext,rawBefore);else await adapter.write(key,personalNext);
            accountCommitted=true;savedRaw=personalNext;savedClean=clean;
          }finally{pendingWrite=null;}
        }
        if(Object.keys(changes).length)await appearance.write(adapter,changes);
        current=appearance.apply(clean,await appearance.read(adapter));notify();return get();
        }catch(error){if(accountCommitted){current=appearance.apply(clean,before);notify();throw Object.assign(Error(error?.message||String(error)),{cause:error,accountCommitted:true});}if(retry&&error?.code==='storage-conflict'&&attempt<7)continue;throw error;}finally{if(refStore){await refStore.release(token,accountWriteLease===undefined?undefined:{accountWriteLease}).catch(()=>{});if(!mediaStore)refStore.close();}}
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
    async function saveRecovery(){
      // Capture bytes before the account lock; file operations publish in the opposite order.
      for(let attempt=0;attempt<8;attempt++){
        await sync();const backup=await captureBackup();
        if(backup.courseFilesOmitted>0)throw Error(`Cannot restore while the recovery backup would omit ${backup.courseFilesOmitted} uploaded file${backup.courseFilesOmitted===1?'':'s'}. Save copies and remove those files, or resolve missing uploads, then try again.`);
        const saved=await lock(key,async()=>{
          if(!same(await readCourseFiles(),backup.data.courseFiles))return false;
          await adapter.write(`${key}:cache`,null);await adapter.write(`${key}:recovery`,backup);
          recoveryCourseFiles=clone(backup.data.courseFiles);return true;
        });
        if(saved)return;
      }
      throw Error('Course links and files changed while saving recovery. Try restoring again.');
    }
    async function readCourseFiles(){const saved=await adapter.read(key);return cleanCourseFiles(saved?.courseFiles);}
    async function readRecovery(){const v=await adapter.read(`${key}:recovery`);return v?validateBackup(v,owner):null;}
    async function readRecoveryBackup(){const value=await adapter.read(`${key}:recovery`);if(!value)return null;validateBackup(value,owner);return clone(value);}
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
    const api={load,sync,get,update,replace,owner,saveRecovery,readRecovery,readRecoveryBackup,readCourseFiles,readResourceCache,writeResourceCache,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},destroy:()=>{if(destroyed)return;destroyed=true;try{unsubscribe?.();}catch{}try{unsubscribeAppearance?.();}catch{}listeners.clear();},exportBackup,exportBackupWithPacks,importBackup,readCache:async()=>{const v=await adapter.read(`${key}:cache`);return validCache(v)?v:null;},writeCache:async snapshot=>{if(!validCache(snapshot))throw Error('Cache owner, origin, or account is invalid.');if(bytes(snapshot)>4000000)throw Error('Canvas snapshot is too large to cache. Live data is still available.');return adapter.write(`${key}:cache`,snapshot);}};return api;
  }
  // Market and media mutations share the account server's queue and validation lifecycle.
  const accountWriteLeases=new WeakMap();
  const ownsAccountWrite=(lease,key)=>!!lease&&accountWriteLeases.get(lease)===key;
  const runAccountWrite=(key,fn)=>lock('account-write:'+key,async()=>{
    const lease=Object.freeze({});accountWriteLeases.set(lease,key);
    try{return await fn(lease);}finally{accountWriteLeases.delete(lease);}
  });
  const api = { createStore, validateBackup, accountValidator, serveAccountWrites, runAccountWrite, ownsAccountWrite, cleanCourseFiles };
  root.ReserveStorage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
