/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
// Canvas's Modules page in the drawn style (3.1). Canvas keeps its structure, order, words and behaviour: this marks
// <html> (modules-page.css does the rest) and puts a drawn icon (course-nav-art) beside each item's own Canvas icon.
(function(root){
 'use strict';
 const Art=root.ReserveCourseNavArt,KEY='reserve:appearance';
 // the Modules page, or a course home that shows the modules
 const route=()=>/^\/courses\/[^/]+(?:\/modules)?\/?$/.test(root.location?.pathname||'');
 const eligible=()=>root.top===root&&root.ReserveSite?.supported(root.location?.href)&&!root.ReserveSite.vanillaPage(root.location)&&route();
 if(!Art||!eligible())return;
 const KINDS={assignment:'assignments',quiz:'quizzes','lti-quiz':'quizzes',discussion_topic:'discussions',wiki_page:'pages',attachment:'files',context_module_sub_header:'',external_url:'tool',context_external_tool:'tool'};
 function kindOf(item){for(const name of item.classList)if(Object.prototype.hasOwnProperty.call(KINDS,name))return KINDS[name];return 'tool';}
 let doc,list=null,observer=null;
 function decorate(item){
  for(const due of item.querySelectorAll('.due_date_display'))due.classList.toggle('md-empty',!due.textContent.trim());
  if(item.dataset.mdIcon!==undefined)return;
  const kind=kindOf(item),host=item.querySelector('.ig-type-icon');
  item.dataset.mdIcon=kind;
  if(!kind||!host||host.querySelector('.md-icon'))return;
  const span=doc.createElement('span');span.className='md-icon';span.setAttribute('aria-hidden','true');span.innerHTML=Art.icons[kind]||Art.icons.tool;
  host.append(span);
  // the row is the icon's host: hovering it plays the icon's action once (course-nav-art.css)
  item.querySelector(':scope>.ig-row')?.classList.add('cn-i');
 }
 function decorateAll(){for(const item of list.querySelectorAll('li.context_module_item'))decorate(item);}
 function motion(value){doc.documentElement.dataset.mdMotion=['still','off'].includes(value?.motion)?'off':'on';}
 function sheet(file){
  const href=root.chrome.runtime.getURL(file);
  if([...doc.querySelectorAll('link[rel="stylesheet"]')].some(link=>link.href===href))return;
  const link=doc.createElement('link');link.rel='stylesheet';link.href=href;(doc.head||doc.documentElement).append(link);
 }
 async function start(){
  doc=root.document;list=doc.getElementById('context_modules');
  if(!list||!eligible()||root.ReserveModulesPage)return;
  root.ReserveModulesPage={kindOf};
  sheet('course-nav-art.css');sheet('modules-page.css');
  doc.documentElement.classList.add('reserve-modules');
  decorateAll();
  // Canvas also updates due dates in existing rows, by replacing children or editing their text.
  observer=new root.MutationObserver(records=>{if(records.some(r=>r.type==='characterData'||r.addedNodes.length||r.removedNodes.length))decorateAll();});
  observer.observe(list,{childList:true,characterData:true,subtree:true});
  motion();
  try{motion((await root.chrome.storage.local.get(KEY))[KEY]);}catch{}
  root.chrome?.storage?.onChanged?.addListener((changes,area)=>{if(area==='local'&&changes[KEY])motion(changes[KEY].newValue);});
 }
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>void start(),{once:true});
 else void start();
})(globalThis);
