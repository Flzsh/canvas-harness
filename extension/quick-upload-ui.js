/* Canvas Harness — original creator: Flzsh.
 * Pack source is untrusted. Only validated assets enter isolated SVG images.
 * This view never writes settings; Apply and Undo belong to the controller.
 */
(function(root){
 'use strict';
 const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const button=(action,label,disabled=false,cls='rd-button')=>`<button type="button" class="${cls}" data-rd-action="quick-pack-${action}" ${disabled?'disabled':''}>${E(label)}</button>`;
 const readable=value=>String(value||'').replace(/-/g,' ');
 const targetLabel=g=>g.target?.type==='overview'?'All courses overview':g.target?.type==='every-course'?'Every course':g.target?.names?.join(' / ')||('Course '+(g.target?.id||''));
 const slotLabel=slot=>slot==='frame'?'Border':slot?slot[0].toUpperCase()+slot.slice(1):'Artwork';
 const size=n=>n<1024?`${n} B`:n<1048576?`${Math.ceil(n/1024)} KiB`:`${(n/1048576).toFixed(2)} MiB`;
 const packIcon='<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M5 12q-1-3 3-3h10l4 4h11q3 0 3 3l-2 16q0 2-3 2H7q-3 0-3-3z" fill="#EAE4D6" stroke="currentColor" stroke-width="1.5"/><path d="M5 16l30-1M20 28V18m-5 5 5-5 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="m9 7 5-3 9 3" stroke="#AA674A" stroke-width="1.5" stroke-linecap="round"/></svg>';
 function render(c){
  const q=c.quickUpload||{phase:'idle'},busy=c.quickPackLoading||['reviewing','applying','undoing'].includes(q.phase),review=q.phase==='review',applied=q.phase==='applied',undone=q.phase==='undone';
  const draft=c.quickPackDraft||'',groups=q.groups||[],parts=q.parts||[],courses=q.courses||[];
  const notices=[...(q.errors||[]),...(q.warnings||[])];
  if(q.error&&!notices.some(n=>n.message===q.error.message))notices.unshift(q.error);
  if(c.quickPackError)notices.unshift({message:c.quickPackError});
  const issues=notices.length?`<ul class="ch-pack-notices" aria-label="Pack notices">${notices.map(n=>`<li>${E(n.message)}</li>`).join('')}</ul>`:'';
  const groupHTML=groups.map(g=>{
   const named=g.target?.type==='course',selected=g.courseId;
   const destination=named?`<label class="ch-pack-destination"><span>Apply to</span><select data-rd-field="quick-pack-course" data-group="${E(g.key)}" aria-label="Course for ${E(targetLabel(g))}" ${busy||!g.included?'disabled':''}><option value=""${!selected?' selected':''}>Choose a course…</option>${courses.map(course=>`<option value="${E(course.id)}"${course.id===selected?' selected':''}>${E(course.name)}</option>`).join('')}</select></label>`:`<span class="ch-pack-target-hint">${g.target?.type==='every-course'?'Individual course pieces override these defaults.':'The overview above your courses.'}</span>`;
   const groupParts=(g.partIndexes||[]).map(index=>parts.find(p=>p.index===index)).filter(Boolean);
   return `<section class="ch-pack-group" data-rd-key="pack-group-${E(g.key)}" data-included="${g.included!==false}"><div class="ch-pack-group-heading"><label class="ch-check"><input type="checkbox" data-rd-field="quick-pack-group" data-group="${E(g.key)}" ${g.included!==false?'checked':''} ${busy?'disabled':''}><strong>${E(targetLabel(g))}</strong></label>${destination}</div><div class="ch-pack-pieces">${groupParts.map(p=>{
    const validated=p.asset&&root.ReserveCustomArt?.render?root.ReserveCustomArt.render(p.asset,{kind:p.slot==='frame'?'border':p.slot,motion:false,fit:'contain',className:'ch-pack-image'}):'';
    const error=(p.errors||[]).map(x=>x.message).join(' '),status=error|| (p.status==='replaced'?'Replaced by a later piece':p.status==='unresolved'?'Choose a course above':p.status==='excluded'?'Not included':p.replaces?'Replaces current artwork':p.status==='partial'?'Applied where not overridden':'Ready');
    return `<label class="ch-pack-piece" data-rd-key="pack-part-${p.index}" data-status="${E(p.status)}"><span class="ch-pack-preview" aria-hidden="true">${validated||'<span>—</span>'}</span><span class="ch-pack-piece-caption"><strong>${E(slotLabel(p.slot))}</strong><small>${E(status)}</small></span><input type="checkbox" data-rd-field="quick-pack-part" data-index="${p.index}" aria-label="Include ${E(slotLabel(p.slot))} from ${E(targetLabel(g))}" ${p.included!==false?'checked':''} ${busy||g.included===false||error?'disabled':''}></label>`;
   }).join('')}</div></section>`;
  }).join('');
  const readyCount=parts.filter(p=>['ready','partial'].includes(p.status)).length;
  const skipped=q.report?.notApplied||[];
  const skippedHTML=skipped.length?`<details class="ch-pack-skipped" data-rd-section="quick-pack-skipped"><summary>Not applied (${skipped.length})</summary><ul>${skipped.map(p=>`<li>${E(p.slot?slotLabel(p.slot):'Piece')} ${Number.isInteger(p.index)?p.index+1:''} · ${E(readable(p.reason))}</li>`).join('')}</ul></details>`:'';
  const result=applied?`<div class="ch-pack-success" role="status"><strong>Artwork applied</strong><span>${new Set((q.report?.applied||[]).map(p=>p.index)).size} pieces saved together. Your other preferences are kept.</span></div>`:undone?'<div class="ch-pack-success" role="status"><strong>Previous artwork restored</strong><span>The last pack has been undone.</span></div>':'';
  return `<section class="ch-quick-upload" aria-labelledby="ch-quick-upload-title" aria-busy="${!!busy}" data-rd-key="quick-upload"><div class="ch-pack-heading">${packIcon}<div><h4 id="ch-quick-upload-title">Quick Upload</h4><p>One pack for banners, icons and borders. Preview before applying.</p></div></div><div class="ch-pack-drop" data-quick-pack-drop tabindex="0" aria-label="Drop an artwork pack"><span>${E(c.quickPackFileName||'Drop a .chpack or .txt file here')}</span><label class="rd-button ch-upload">Choose pack<input type="file" accept=".chpack,.txt,text/plain" data-rd-field="quick-pack-file" aria-label="Choose artwork pack" ${busy?'disabled':''}></label></div><details class="ch-pack-source" data-rd-section="quick-pack-source"><summary>Or paste a pack</summary><label><span class="rd-sr-only">Artwork pack source</span><textarea data-rd-field="quick-pack-source" maxlength="3145728" spellcheck="false" aria-label="Artwork pack source" placeholder="Paste the complete <?ch-pack …?> output here" ${busy?'disabled':''}>${E(draft)}</textarea></label>${button('review',busy?'Checking…':'Review pack',busy)}</details>${busy?'<p class="ch-pack-progress" role="status">'+(q.phase==='applying'?'Saving artwork…':q.phase==='undoing'?'Restoring artwork…':'Checking the pack…')+'</p>':''}${issues}${review?`<div class="ch-pack-review"><div class="ch-pack-review-heading"><h4>${E(q.name||'Artwork pack')}</h4><span>${parts.length} pieces</span></div>${groupHTML}${q.unresolved?.length?`<p class="ch-pack-match-notice">${q.unresolved.length} course ${q.unresolved.length===1?'needs':'targets need'} matching. Unmatched pieces won’t be applied.</p>`:''}${q.budget?`<p class="ch-pack-budget">Artwork storage: ${size(q.budget.bytes)} of ${size(q.budget.limit)}</p>`:''}</div>`:''}${result}${skippedHTML}<div class="ch-pack-actions">${review?button('apply','Apply '+readyCount+' '+(readyCount===1?'piece':'pieces'),!q.canApply||busy,'rd-button ch-pack-apply'):''}${q.canUndo?button('undo','Undo last pack',busy):''}${review||applied||undone?button('reset','Start another pack',busy,'rd-text-button'):''}</div></section>`;
 }
 const api={render};root.CanvasHarnessQuickUploadUI=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
