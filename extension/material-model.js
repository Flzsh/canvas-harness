/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function(root,factory){
  'use strict';
  var api=factory();
  root.ReserveMaterials=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var ORIGIN=(globalThis.ReserveSite.origin());

  function text(value){return value==null?'':String(value);}
  function safeURL(value){
    if(typeof value!=='string'||!value.trim())return '';
    try{
      var url=new URL(value.trim(),ORIGIN+'/');
      if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return '';
      return url.href;
    }catch(_error){return '';}
  }
  function normalized(value){
    var valueText=text(value);
    if(typeof valueText.normalize==='function')valueText=valueText.normalize('NFD');
    return valueText.replace(/[\u0300-\u036f]/g,'').toLowerCase();
  }
  function classify(title,type){
    var name=normalized(title),kind=normalized(type);
    if(/\bwith\s+answers?\b|\banswers?\s+included\b/.test(name))return 'Worksheet + answers';
    if(/\banswer\s*key\b|\banswers?\b/.test(name))return 'Answer key';
    if(/\bcycle\s*sheet\b|\bschedule\b|\bcalendar\b|\bagenda\b|\bdaily\s+syllabus\b/.test(name))return 'Schedule';
    if(/\bsyllabus\b|\bcourse\s+(?:description|outline|overview)\b/.test(name))return 'Syllabus';
    if(/\bslides?\b|\bpresentation\b|\bpowerpoint\b|\.(?:pptx?|key)\b/.test(name))return 'Slides';
    if(/\bsolutions?\b/.test(name))return 'Answer key';
    if(/\blabs?\b(?!\s+safety)|\blaboratory\b/.test(name))return 'Lab';
    if(/\bworksheet\b|\bpractice\b|\bproblem\s*set\b|\bpacket\b|\bexercises?\b/.test(name))return 'Worksheet';
    if(/\breading\b|\barticle\b|\bchapter\b/.test(name))return 'Reading';
    if(kind==='assignment')return 'Assignment';
    if(kind==='discussion')return 'Discussion';
    if(kind==='quiz')return 'Quiz';
    if(kind==='externaltool')return 'Class tool';
    if(kind==='externalurl')return 'Link';
    if(kind==='page'||kind==='frontpage')return 'Page';
    if(kind==='file')return 'File';
    return 'Resource';
  }
  function visible(value){
    return !!value&&value.published!==false&&value.workflow_state!=='deleted'&&value.state!=='deleted'&&value.hidden!==true&&value.hidden_for_user!==true;
  }
  function locked(value){
    return !!value&&(value.locked===true||value.locked_for_user===true||value.state==='locked'||value.content_details?.locked===true||value.content_details?.locked_for_user===true);
  }
  function moduleLink(courseId,itemId){return ORIGIN+'/courses/'+encodeURIComponent(courseId)+'/modules/items/'+encodeURIComponent(itemId);}
  function pageLink(courseId,slug){return ORIGIN+'/courses/'+encodeURIComponent(courseId)+'/pages/'+encodeURIComponent(slug);}
  function fileLink(courseId,fileId){return ORIGIN+'/courses/'+encodeURIComponent(courseId)+'/files/'+encodeURIComponent(fileId);}
  function itemKind(value){
    var kind=text(value||'ModuleItem');
    if(kind==='External URL')return 'ExternalUrl';
    return kind;
  }
  function contentKey(kind,contentId,pageUrl,direct,itemId){
    if(kind==='File'&&contentId)return 'file:'+contentId;
    if(kind==='Page'&&pageUrl)return 'page:'+pageUrl;
    if(kind==='Page'&&contentId)return 'page-id:'+contentId;
    if(kind==='Assignment'&&contentId)return 'assignment:'+contentId;
    if(kind==='ExternalUrl'&&direct)return 'external:'+direct;
    return 'module-item:'+itemId;
  }
  function normalizeCatalog(raw){
    raw=raw&&typeof raw==='object'?raw:{};
    var courseId=text(raw.courseId);
    if(!/^\d+$/.test(courseId))return [];
    var result=[],seen=new Set();
    function add(item,key,force){
      if(!force&&key&&seen.has(key)){
        var original=result.find(x=>x._contentKey===key);
        if(original&&item.moduleId&&!original.moduleIds.includes(item.moduleId))original.moduleIds.push(item.moduleId);
        return;
      }
      if(key)seen.add(key);
      item.moduleIds=item.moduleId?[item.moduleId]:[];item._contentKey=key;
      result.push(item);
    }
    (Array.isArray(raw.modules)?raw.modules:[]).forEach(function(module){
      if(!visible(module))return;
      var moduleId=text(module.id),moduleName=text(module.name),moduleLocked=locked(module);
      if(!/^\d+$/.test(moduleId))return;
      (Array.isArray(module.items)?module.items:[]).forEach(function(entry){
        if(!visible(entry))return;
        var kind=itemKind(entry.type);
        if(!['File','Page','ExternalUrl','ExternalTool','Discussion','Quiz','Assignment'].includes(kind))return;
        var itemId=text(entry.id);
        if(!/^\d+$/.test(itemId))return;
        var title=text(entry.title||entry.display_name||entry.name||'Untitled resource');
        var contentId=entry.content_id==null?null:text(entry.content_id);
        var pageUrl=entry.page_url==null?null:text(entry.page_url);
        var isLocked=moduleLocked||locked(entry);
        var direct='';
        if(kind==='ExternalUrl')direct=safeURL(entry.external_url||entry.html_url);
        else if(kind==='Page')direct=safeURL(entry.html_url)||(pageUrl?pageLink(courseId,pageUrl):'');
        else direct=safeURL(entry.html_url);
        var url=isLocked?moduleLink(courseId,itemId):(direct||moduleLink(courseId,itemId));
        var key=contentKey(kind,contentId,pageUrl,direct,itemId);
        add({id:'module:'+moduleId+':'+itemId,courseId,title,kind,category:classify(title,kind),url,moduleId,moduleName,contentId,pageUrl,locked:isLocked},key,false);
      });
    });
    if(visible(raw.frontPage)){
      var front=raw.frontPage,frontSlug=text(front.url||front.page_url),frontTitle=text(front.title||'Course home page');
      var frontLocked=locked(front);
      var frontUrl=safeURL(front.html_url)||(frontSlug?pageLink(courseId,frontSlug):ORIGIN+'/courses/'+encodeURIComponent(courseId));
      add({id:'front:'+courseId+':'+text(front.page_id||frontSlug||'home'),courseId,title:frontTitle,kind:'FrontPage',category:classify(frontTitle,'FrontPage'),url:frontUrl,moduleId:null,moduleName:'',contentId:null,pageUrl:frontSlug||'front_page',locked:frontLocked},frontSlug?'page:'+frontSlug:null,false);
    }
    (Array.isArray(raw.pages)?raw.pages:[]).forEach(function(page){
      if(!visible(page))return;
      var slug=text(page.url||page.page_url),pageId=page.page_id==null?null:text(page.page_id);
      if(!slug&&!pageId)return;
      var key=slug?'page:'+slug:pageId?'page-id:'+pageId:null;
      if(key&&seen.has(key))return;
      var title=text(page.title||'Untitled page'),isLocked=locked(page);
      var url=safeURL(page.html_url)||(slug?pageLink(courseId,slug):ORIGIN+'/courses/'+encodeURIComponent(courseId));
      add({id:'page:'+courseId+':'+text(pageId||slug),courseId,title,kind:'Page',category:classify(title,'Page'),url,moduleId:null,moduleName:'',contentId:pageId,pageUrl:slug||null,locked:isLocked},key,false);
    });
    (Array.isArray(raw.files)?raw.files:[]).forEach(function(file){
      if(!visible(file))return;
      var fileId=file.id==null?'':text(file.id);
      if(!fileId)return;
      var key='file:'+fileId;
      if(seen.has(key))return;
      var title=text(file.display_name||file.filename||file.name||'Untitled file'),isLocked=locked(file);
      var direct=safeURL(file.url||file.html_url||file.preview_url);
      var url=isLocked?fileLink(courseId,fileId):(direct||fileLink(courseId,fileId));
      add({id:'file:'+courseId+':'+fileId,courseId,title,kind:'File',category:classify(title,'File'),url,moduleId:null,moduleName:'',contentId:fileId,pageUrl:null,locked:isLocked},key,false);
    });
    if(typeof raw.syllabusBody==='string'&&raw.syllabusBody.trim())add({id:'syllabus:'+courseId,courseId,title:'Course syllabus',kind:'Syllabus',category:'Syllabus',url:ORIGIN+'/courses/'+courseId+'/assignments/syllabus',moduleId:null,moduleName:'',contentId:null,pageUrl:'__syllabus__',locked:false},null,true);
    return result;
  }
  var STOP=new Set(['assignment','homework','worksheet','practice','review','writeup','project','odds','evens','unit','lesson','chapter','page','problem','problems','question','questions','daily','work','with','answer','answers','the','and','for','from','this','that','your']);
  function terms(value){
    var tokens=normalized(value).replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean),out=[];
    tokens.forEach(function(token){
      if(/^stoich/.test(token))token='stoichiometry';
      if(token.length<4||STOP.has(token)||out.includes(token))return;
      out.push(token);
    });
    return out;
  }
  function suggestions(items,assignment,options){
    var source=Array.isArray(items)?items:[],target=assignment&&typeof assignment==='object'?assignment:{},limit=Number.isFinite(options?.limit)?Math.max(1,Math.min(20,Math.floor(options.limit))):4;
    var assignmentId=target.id==null?'':text(target.id);
    var marker=source.find(function(item){return item?.kind==='Assignment'&&text(item.contentId)===assignmentId;});
    var moduleId=marker?.moduleId||null,moduleIds=marker?.moduleIds||[moduleId],targetTerms=terms(target.name||target.title);
    var candidates=[];
    source.forEach(function(item,index){
      if(!item||item.kind==='Assignment')return;
      var same=moduleIds.some(id=>id&&(item.moduleId===id||item.moduleIds?.includes(id)));
      var itemText=normalized(item.title),score=0;
      targetTerms.forEach(function(term){if(itemText.includes(term))score++;});
      if(!same&&score===0)return;
      candidates.push({item,reason:same?'Same module':'Title match',same,score,index});
    });
    candidates.sort(function(a,b){
      if(a.same!==b.same)return a.same?-1:1;
      if(a.score!==b.score)return b.score-a.score;
      if((a.item.category==='Answer key')!==(b.item.category==='Answer key'))return a.item.category==='Answer key'?1:-1;
      var at=normalized(a.item.title),bt=normalized(b.item.title);
      if(at<bt)return -1;if(at>bt)return 1;return a.index-b.index;
    });
    return candidates.slice(0,limit).map(function(candidate){return {...candidate.item,reason:candidate.reason};});
  }
  function filter(items,options){
    options=options||{};
    var query=normalized(options.query||'').trim(),category=text(options.category||'');
    return (Array.isArray(items)?items:[]).filter(function(item){
      if(category&&category!=='all'&&item?.category!==category)return false;
      if(!query)return true;
      return normalized(text(item?.title)+'\n'+text(item?.moduleName)+'\n'+text(item?.category)).includes(query);
    });
  }

  // How teacher materials read in a list. Teachers' file names carry the file system with them
  // ("Copy of … (1).docx", "HW WS 1-ANSWER KEY.pdf"): displayTitle tidies how a name reads, and the
  // original stays with the item (the row's tooltip and accessible description, and search).
  var FORMATS={pdf:'PDF',doc:'Word',docx:'Word',dotx:'Word',odt:'Doc',rtf:'Doc',pages:'Pages',txt:'Text',ppt:'Slides',pptx:'Slides',pps:'Slides',ppsx:'Slides',key:'Slides',odp:'Slides',xls:'Sheet',xlsx:'Sheet',xlsm:'Sheet',csv:'Sheet',numbers:'Sheet',ods:'Sheet',jpg:'Image',jpeg:'Image',png:'Image',gif:'Image',heic:'Image',webp:'Image',svg:'Image',mp4:'Video',m4v:'Video',mov:'Video',webm:'Video',mp3:'Audio',m4a:'Audio',wav:'Audio',zip:'ZIP',html:'Web page',htm:'Web page'};
  // Short abbreviations teachers write in capitals on purpose keep their capitals.
  var ACRONYMS=new Set(('AP CL HW WS CW SAT ACT PSAT IB CHEM BIO PHYS CALC ECON GOV HIST ENG SPAN LAT ALG GEOM STAT STATS COMP SCI PSYCH ENVI APES APUSH WHAP EURO LIT LANG '+
    'DNA RNA MRNA PCR CRISPR IUPAC ELISA ATP ADP NAD NADH NADPH PH UV IR MRI HIV STEM STEAM NASA NOAA MLA APA USA US UK EU UN PE ID PDF SI ACC GPS AI CAD CNC LED LEDS '+
    'FAQ TBD DIY DRN AM PM BC AD BCE CE ESL ELL CPU RAM USB HTML CSS API AMC AIME ISEF PBL SEL NHD MUN TV GDP MIT OK COVID OSHA NATO FEMA NCAA HVAC UNESCO NAACP').split(' '));
  function lettersOf(word){return text(word).replace(/[^A-Za-z]/g,'');}
  function capsWord(word){return /^[A-Z][A-Z'’]*$/.test(word);}
  function keptCaps(word){var bare=lettersOf(word);return bare.length<2||ACRONYMS.has(bare)||/^[IVXLC]+$/.test(bare);}
  function shouted(word){return capsWord(word)&&lettersOf(word).length>=4&&!keptCaps(word);}
  function plain(value){return normalized(value).replace(/[^a-z0-9]+/g,' ').trim();}
  // A run of capital words ("ANSWER KEY", "UNIT 1A TEST CORRECTIONS FORM") is read in sentence case;
  // abbreviations inside it (AP, CHEM, HW, WS) and single letters keep their capitals.
  function quietCaps(value){
    var parts=value.split(/([A-Za-z0-9'’]+)/),runs=[],run=null,last=-1;
    for(var i=1;i<parts.length;i+=2){
      if(!capsWord(parts[i]))continue;
      var gap=run?parts.slice(last+1,i).join(''):'';
      if(run&&/^(?:\s+(?:\d[\dA-Za-z.]*\s+)?|\s*[&+\/]\s*)$/.test(gap))run.push(i);else{run=[i];runs.push(run);}
      last=i;
    }
    runs.forEach(function(indexes){
      var words=indexes.map(function(i){return parts[i];});
      // One capital word in a mixed-case title is the teacher's emphasis or an acronym (COVID-19): kept.
      if(!words.some(shouted)||(words.length===1&&(lettersOf(words[0]).length<5||/[a-z]/.test(value))))return;
      indexes.forEach(function(i){if(!keptCaps(parts[i]))parts[i]=parts[i].toLowerCase();});
      var first=indexes[0],before=parts.slice(0,first).join('').trim();
      if(parts[first]!==words[0]&&(!before||/[—–\-:(\[·|\/]$/.test(before)))parts[first]=parts[first].charAt(0).toUpperCase()+parts[first].slice(1);
    });
    return parts.join('');
  }
  function displayTitle(value){
    var original=text(value).replace(/\s+/g,' ').trim(),title=original;
    for(var n=0;n<2;n++){var ext=title.match(/\.([A-Za-z0-9]{1,5})$/);if(!ext||!FORMATS[ext[1].toLowerCase()])break;title=title.slice(0,-ext[0].length).trim();}
    // Duplicate markers ("(1)", " - Copy") and a leading "Copy of ".
    title=title.replace(/(?:\s*-\s*copy(?:\s*\(\d{1,3}\))?|\s*\(\d{1,3}\))+$/i,'').replace(/^(?:copy\s+of\s+)+/i,'');
    title=title.replace(/(?<=[A-Za-z0-9])_+(?=[A-Za-z0-9])/g,' ');
    // Separators: " - " reads as a dash; so does a hyphen that opens a shouted phrase ("1-ANSWER KEY")
    // or that follows an abbreviation before a word ("CHEM-Chapter"). Ranges (1-2, 2026-27) and
    // compounds (8-Ball, Self-Assessment, T-SHIRT) keep their hyphens.
    title=title.replace(/\s+(?:-{1,2}|[–—])\s+/g,' — ');
    title=title.replace(/([A-Za-z0-9]{2,}|\d)-(?=([A-Z][A-Z'’]{3,})(?![A-Za-z]))/g,function(match,left,word){return shouted(word)?left+' — ':match;});
    title=title.replace(/\b([A-Z]{2,})-(?=[A-Z][a-z]{2,})/g,'$1 — ');
    title=quietCaps(title).replace(/\s+/g,' ').replace(/^[\s—–:·|-]+|[\s—–:·|-]+$/g,'').trim();
    return title||original;
  }
  // The format tag: the file's own type, or what the item is in Canvas. "File" only when nothing better is known.
  function formatOf(item){
    var match=text(item?.title).trim().match(/\.([A-Za-z0-9]{1,5})$/),ext=match&&FORMATS[match[1].toLowerCase()];
    if(ext)return ext;
    var kind=text(item?.kind);
    if(kind==='Page'||kind==='FrontPage'||kind==='Syllabus')return 'Page';
    if(kind==='ExternalUrl'){
      try{
        var url=new URL(text(item.url)),host=url.hostname.replace(/^www\./,'');
        if(host==='docs.google.com'){if(/^\/document\//.test(url.pathname))return 'Doc';if(/^\/presentation\//.test(url.pathname))return 'Slides';if(/^\/spreadsheets\//.test(url.pathname))return 'Sheet';if(/^\/forms\//.test(url.pathname))return 'Form';}
        if(/(?:^|\.)(?:youtube\.com|youtu\.be|vimeo\.com|edpuzzle\.com|loom\.com)$/.test(host))return 'Video';
      }catch(_error){}
      return 'Link';
    }
    if(kind==='File')return 'File';
    return '';
  }
  // A kind word only where it adds meaning (never "File" or "Page" again beside the format).
  var KIND_WORDS={'Answer key':'Answer key','Worksheet + answers':'With answers','Schedule':'Schedule','Syllabus':'Syllabus','Lab':'Lab','Slides':'Slides','Class tool':'Class tool','Assignment':'Assignment','Quiz':'Quiz','Discussion':'Discussion'};
  function kindOf(item){
    if(item?.kind==='FrontPage')return 'Home page';
    var word=KIND_WORDS[item?.category||classify(item?.title,item?.kind)]||'';
    return word==='Slides'&&formatOf(item)==='Slides'?'':word;
  }
  // Everything a student might type to find an item: its name as written and as read, and its tags.
  function searchText(item){return [text(item?.title),displayTitle(item?.title),text(item?.category),formatOf(item),kindOf(item)].join('\n');}
  // Rows for a list: an answer key whose title matches a worksheet's (after its key words are set
  // aside) joins that worksheet's row; unmatched keys stay rows of their own.
  var KEY_WORDS=/\b(?:answer\s*keys?|answers?|solutions?|keys?)\b/gi;
  function present(items){
    var rows=(Array.isArray(items)?items:[]).filter(Boolean).map(function(item){return {item,title:displayTitle(item.title),original:text(item.title).replace(/\s+/g,' ').trim(),format:formatOf(item),kind:kindOf(item),key:null};});
    var sheets=new Map();
    rows.forEach(function(row){var base=plain(row.title);if(row.item.category!=='Answer key'&&base&&!sheets.has(base))sheets.set(base,row);});
    return rows.filter(function(row){
      if(row.item.category!=='Answer key')return true;
      var sheet=sheets.get(plain(row.title.replace(KEY_WORDS,' ')));
      if(!sheet||sheet.key)return true;
      sheet.key=row;return false;
    });
  }
  // Chapters in Canvas order: one per module, then the course's loose pages and files ("Course
  // resources"). Modules are numbered unless the teacher's names already are (Unit 1b, Week 3).
  // A chapter holding one item of its own name is flagged single (it reads as one row).
  var NUMBERED=/^\s*\d|\b(?:unit|chapter|week|module|lesson|part|topic|section|quarter|term|semester|day|period|block)\s*(?:\d|[ivx]+\b)/i;
  function chapterKey(item){
    if(item?.moduleId)return 'module-'+text(item.moduleId);
    var name=plain(item?.moduleName);return name?'named-'+name.replace(/ /g,'-'):'resources';
  }
  function outline(all,visible,options){
    var chapters=[],byKey=new Map(),numbers=options?.numbers!==false;
    function chapter(item){var key=chapterKey(item);if(!byKey.has(key)){byKey.set(key,{key,name:text(item.moduleName)||'Course resources',resources:key==='resources',number:0,single:false,all:[],items:[],rows:[]});chapters.push(byKey.get(key));}return byKey.get(key);}
    (Array.isArray(all)?all:[]).forEach(function(item){if(item)chapter(item).all.push(item);});
    (Array.isArray(visible)?visible:Array.isArray(all)?all:[]).forEach(function(item){if(item)chapter(item).items.push(item);});
    var modules=chapters.filter(function(c){return !c.resources&&c.all.length;});
    if(numbers&&modules.length>1&&!modules.some(function(c){return NUMBERED.test(c.name);}))modules.forEach(function(c,i){c.number=i+1;});
    chapters.forEach(function(c){var list=c.all.length?c.all:c.items;c.single=!c.resources&&list.length===1&&plain(displayTitle(list[0].title))===plain(c.name);c.rows=present(c.items);});
    return chapters.filter(function(c){return c.items.length;});
  }
  return {normalizeCatalog,safeURL,classify,suggestions,filter,displayTitle,formatOf,kindOf,searchText,present,outline,chapterKey};
});
