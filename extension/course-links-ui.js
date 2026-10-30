// Adapted from Gary Wu's pull request #47 to Canvas Harness.
(function(root){
  'use strict';
  const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ACCEPT='.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.rtf,.odt,.pages,.key,.numbers,.png,.jpg,.jpeg,.gif,.webp,.avif,.bmp,.tif,.tiff,.heic,.heif,.csv,.md';
  const courseId=value=>/^\d{1,20}$/.test(String(value??''))?String(value):'';
  const placeId=value=>value==='hub'?'hub':'info';
  function webURL(value){
    try{const url=new URL(String(value||''));return /^https?:$/.test(url.protocol)&&!url.username&&!url.password?url.href:'';}catch{return '';}
  }
  function kind(item){
    if(item.kind==='link'){
      try{
        const url=new URL(item.url);
        if(url.hostname==='docs.google.com')
          return /\/spreadsheets\//.test(url.pathname)?'Google Sheet':/\/presentation\//.test(url.pathname)?'Google Slides':/\/forms\//.test(url.pathname)?'Google Form':'Google Doc';
        if(url.hostname==='drive.google.com')return 'Google Drive';
      }catch{}
      return 'Link';
    }
    const ext=(String(item.name||'').match(/\.([a-z0-9]+)$/i)?.[1]||'').toLowerCase(),type=String(item.type||'').toLowerCase();
    if(ext==='pdf')return 'PDF';
    if(/^(docx?|odt|pages)$/.test(ext))return 'Word';
    if(/^(pptx?|key)$/.test(ext))return 'PowerPoint';
    if(/^(xlsx?|numbers|csv)$/.test(ext))return 'Excel';
    if(/^(txt|rtf|md)$/.test(ext))return 'Text';
    if(/^(png|jpe?g|gif|webp|heic)$/.test(ext))return 'Image';
    if(type==='application/pdf')return 'PDF';
    if(/^text\//.test(type))return 'Text';
    if(/^image\//.test(type))return 'Image';
    return 'File';
  }
  function create({files,onChange=()=>{},onOpen=()=>{}}={}){
    const views=new Map();let dead=false,focusRequest=null;
    const key=(id,place)=>id+':'+place;
    const view=(id,place)=>{
      const k=key(id,place);
      if(!views.has(k))views.set(k,{add:false,url:'',title:'',editing:'',name:'',removing:'',error:'',busy:false});
      return views.get(k);
    };
    const changed=()=>{if(!dead)onChange();};
    const dataOf=data=>({id:courseId(data?.course),place:placeId(data?.place)});
    const listed=id=>(files?.list(id)||[]).filter(item=>item&&typeof item.id==='string'&&['link','file'].includes(item.kind)&&(item.kind!=='link'||webURL(item.url)));
    const request=(id,place,field,action,file)=>{focusRequest={type:'own',courseId:id,place,...(field?{field}:{}),...(action?{action}:{}),...(file?{file}:{})};};
    const attrs=(id,place,file='')=>`data-course="${E(id)}" data-place="${E(place)}"${file?` data-file="${E(file)}"`:''}`;
    const button=(action,label,id,place,{file='',disabled=false,extra=''}={})=>`<button type="button" class="rd-text-button ch-links-action" data-rd-action="hub-own-${action}" ${attrs(id,place,file)}${disabled?' disabled':''}${extra?' '+extra:''}>${E(label)}</button>`;
    async function run(id,place,state,operation,success,fallback){
      if(dead||state.busy)return;
      state.busy=true;state.error='';changed();
      try{const result=await operation();if(dead||views.get(key(id,place))!==state)return;success?.(result);}
      catch(error){if(!dead&&views.get(key(id,place))===state)state.error=String(error?.message||fallback||'This change could not be saved.');}
      finally{if(!dead&&views.get(key(id,place))===state){state.busy=false;changed();}}
    }
    function render(course,{place='info'}={}){
      const id=courseId(course?.id);place=placeId(place);if(dead||!id||!files)return '';
      const state=view(id,place),items=listed(id),disabled=state.busy?' disabled':'',section=`ch-links-${place}-${id}`;
      const rows=items.map(item=>{
        const file=item.id,name=String(item.title||item.name||'Untitled');
        let body;
        if(state.editing===file)body=`<div class="ch-links-rename" role="group" aria-label="Rename"><label class="ch-links-field"><span class="rd-sr-only">Name</span><input type="text" data-rd-field="hub-own-name" ${attrs(id,place,file)} value="${E(state.name)}" maxlength="120" aria-label="Name"${disabled}></label><span class="ch-links-actions">${button('save-name','Save',id,place,{file,disabled:state.busy})}${button('cancel-row','Cancel',id,place,{file,disabled:state.busy})}</span></div>`;
        else{
          const open=item.kind==='link'?
            `<a class="rd-row-open ch-links-open" href="${E(webURL(item.url))}" target="_blank" rel="noopener noreferrer">${E(name)}</a>`:
            button('open',name,id,place,{file,disabled:state.busy}).replace('rd-text-button ch-links-action','rd-row-open ch-links-open');
          const actions=state.removing===file?
            `<span class="ch-links-remove-label">Remove?</span>${button('confirm-remove','Remove',id,place,{file,disabled:state.busy})}${button('cancel-row','Cancel',id,place,{file,disabled:state.busy})}`:
            button('rename','Rename',id,place,{file,disabled:state.busy})+button('remove','Remove',id,place,{file,disabled:state.busy});
          body=`${open}<span class="rd-row-kind ch-links-kind">${E(kind(item))}</span><span class="ch-links-actions">${actions}</span>`;
        }
        return `<li class="rd-teacher-row ch-links-row" data-rd-key="${E(section+'-'+file)}">${body}</li>`;
      }).join('');
      const form=state.add?`<div class="ch-links-form" role="group" aria-label="Add a link or files" data-rd-key="${E(section+'-form')}"><label class="ch-links-field"><span>Link</span><input type="text" inputmode="url" data-rd-field="hub-own-url" ${attrs(id,place)} value="${E(state.url)}" maxlength="2000" autocomplete="off" aria-label="Link"${disabled}></label><label class="ch-links-field"><span>Name (optional)</span><input type="text" data-rd-field="hub-own-title" ${attrs(id,place)} value="${E(state.title)}" maxlength="120" aria-label="Name (optional)"${disabled}></label><div class="ch-links-actions">${button('save-link','Add link',id,place,{disabled:state.busy})}${button('cancel','Cancel',id,place,{disabled:state.busy})}</div><label class="ch-links-field ch-links-files"><span>Files</span><input type="file" data-rd-field="hub-own-files" ${attrs(id,place)} multiple accept="${ACCEPT}" aria-label="Files"${disabled}></label></div>`:'';
      return `<section class="rd-deck-section ch-links" data-rd-section="${E(section)}" data-rd-key="${E(section)}" data-ch-links="${E(place)}" ${attrs(id,place)} aria-label="My links and files" aria-busy="${state.busy}"><div class="rd-sheet-heading ch-links-heading"><h3><span>My links &amp; files</span></h3><div class="rd-source-actions">${button('add','+ Add',id,place,{disabled:state.busy,extra:`aria-expanded="${state.add}" aria-controls="${E(section+'-editor')}"`})}</div></div><div id="${E(section+'-editor')}" class="ch-links-editor">${form}</div>${rows?`<ul class="rd-chapter-items ch-links-list">${rows}</ul>`:''}${state.error?`<p class="rd-hub-notice ch-links-error" role="alert">${E(state.error)}</p>`:''}</section>`;
    }
    function handle(action,data={}){
      if(dead||!String(action).startsWith('hub-own-'))return;
      const {id,place}=dataOf(data);if(!id||!files)return;
      const state=view(id,place);if(state.busy)return;
      const item=listed(id).find(entry=>entry.id===data.file);
      if(action==='hub-own-add'){state.add=true;state.error='';request(id,place,'hub-own-url');changed();return;}
      if(action==='hub-own-cancel'){state.add=false;state.url='';state.title='';state.error='';request(id,place,null,'hub-own-add');changed();return;}
      if(action==='hub-own-save-link'&&state.add)
        return run(id,place,state,()=>files.addLink(id,state.url,state.title),()=>{state.url='';state.title='';request(id,place,'hub-own-url');},'The link could not be saved.');
      if(!item)return;
      if(action==='hub-own-open'&&item.kind==='file')return run(id,place,state,()=>onOpen(id,item.id),null,'The file could not be opened.');
      if(action==='hub-own-rename'){state.editing=item.id;state.name=String(item.title||item.name||'');state.removing='';state.error='';request(id,place,'hub-own-name',null,item.id);changed();return;}
      if(action==='hub-own-remove'){state.removing=item.id;state.editing='';state.name='';state.error='';request(id,place,null,'hub-own-confirm-remove',item.id);changed();return;}
      if(action==='hub-own-cancel-row'){state.editing='';state.name='';state.removing='';state.error='';request(id,place,null,'hub-own-rename',item.id);changed();return;}
      if(action==='hub-own-save-name'&&state.editing===item.id)
        return run(id,place,state,()=>files.rename(id,item.id,state.name),()=>{state.editing='';state.name='';request(id,place,null,'hub-own-rename',item.id);},'The name could not be saved.');
      if(action==='hub-own-confirm-remove'&&state.removing===item.id)
        return run(id,place,state,()=>files.remove(id,item.id),()=>{state.removing='';request(id,place,null,'hub-own-add');},'The item could not be removed.');
    }
    function input(field,value,data={}){
      if(dead||!String(field).startsWith('hub-own-'))return;
      const {id,place}=dataOf(data);if(!id||!files)return;
      const state=view(id,place);if(state.busy)return;
      if(field==='hub-own-url'&&state.add)state.url=String(value??'').slice(0,2000);
      if(field==='hub-own-title'&&state.add)state.title=String(value??'').slice(0,120);
      if(field==='hub-own-name'&&state.editing===data.file)state.name=String(value??'').slice(0,120);
      if(field==='hub-own-files'&&state.add&&value&&typeof value!=='string'){
        const selected=Array.from(value);if(selected.length)return run(id,place,state,()=>files.addFiles(id,selected),null,'The files could not be saved.');
      }
    }
    function keydown(event){
      const data=(event.composedPath?.()[0]||event.target)?.dataset||{},field=data.rdField;if(dead||!field?.startsWith('hub-own-')||event.isComposing)return false;
      if(event.key==='Enter'&&['hub-own-url','hub-own-title','hub-own-name'].includes(field)){event.preventDefault();handle(field==='hub-own-name'?'hub-own-save-name':'hub-own-save-link',data);return true;}
      if(event.key==='Escape'){event.preventDefault();handle(field==='hub-own-name'?'hub-own-cancel-row':'hub-own-cancel',data);return true;}
      return false;
    }
    return {render,handle,input,keydown,takeFocusRequest(){
      const request=focusRequest;
      focusRequest=null;
      return request;
    },destroy(){dead=true;views.clear();focusRequest=null;}};
  }
  const api={create};root.ReserveCourseLinksUI=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
