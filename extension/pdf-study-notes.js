// Adapted from Gary Wu's pull request #51 to Canvas Harness.
/*! Canvas Harness · PDF study notes · Original creator Flzsh · GPL-3.0-only. */
(function(root,factory){
 'use strict';
 const api=factory(typeof module==='object'&&module.exports?require('./pdf-model.js'):root.ReservePdfModel);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ReservePdfStudyNotes=api;
})(globalThis,function(model){
 'use strict';
 const clean=value=>String(value??'').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'').trim();
 // Document text is literal, including text that looks like HTML, links or Markdown images.
 const markdown=value=>clean(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/[\\`*_{}\[\]()#+.!|~$-]/g,'\\$&');
 const LABELS={highlight:'Highlight',underline:'Underline',strike:'Strikethrough',note:'Note',text:'Text'};
 const top=r=>r.point?.[1]??(r.rects?.length?Math.max(...r.rects.map(q=>Math.max(q[1],q[3]))):r.points?.length?Math.max(...r.points.map(p=>p[1])):0);
 const left=r=>r.point?.[0]??(r.rects?.length?Math.min(...r.rects.map(q=>Math.min(q[0],q[2]))):r.points?.length?Math.min(...r.points.map(p=>p[0])):0);
 // Text marks become a study sheet grouped by page and position; drawings (pens, shapes) and empty marks are counted
 // as omitted rather than described.
 function exportNotes({name='Document.pdf',saved,format='markdown',totalPages}={}){
  if(!['markdown','text'].includes(format))throw Error('Choose Markdown or plain text.');
  const records=model.createAnnotations(saved).annotations;
  if(totalPages!==undefined&&(!Number.isSafeInteger(totalPages)||totalPages<1||records.some(a=>a.page>=totalPages)))throw Error('An annotation refers to a page outside this document.');
  const entries=records.map((record,index)=>({record,index,top:top(record),left:left(record)}))
   .filter(({record:r})=>LABELS[r.type]&&clean(r.text)).sort((a,b)=>a.record.page-b.record.page||b.top-a.top||a.left-b.left||a.index-b.index);
  const title=clean(name).replace(/\n/g,' ').slice(0,200)||'Document.pdf',md=format==='markdown',escape=md?markdown:clean;
  const omitted=records.length-entries.length,lines=[md?'# '+escape(title):title,'','Study notes exported from Canvas Harness.'];
  if(omitted)lines.push(`${omitted} drawing${omitted===1?'':'s'} or mark${omitted===1?'':'s'} without text omitted.`);
  if(!entries.length)lines.push('','No text highlights, underlines or margin notes to export.');
  let page=-1;
  for(const {record:r}of entries){
   if(r.page!==page){page=r.page;lines.push('',(md?'## ':'')+'Page '+(page+1));}
   const label=LABELS[r.type];
   lines.push('',md?'**'+label+'**':label+':');
   for(const line of escape(r.text).split('\n'))lines.push(md?'> '+line:line);
  }
  const stem=title.replace(/\.[^.]*$/,'').replace(/[<>:"/\\|?*]/g,'_').replace(/[. ]+$/g,'').slice(0,110)||'Document';
  return {body:lines.join('\n')+'\n',name:stem+'-study-notes.'+(md?'md':'txt'),mime:(md?'text/markdown':'text/plain')+';charset=utf-8',count:entries.length,omitted};
 }
 return Object.freeze({exportNotes});
});
