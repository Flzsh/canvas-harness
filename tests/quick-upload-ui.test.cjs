const test=require('node:test');
const assert=require('node:assert/strict');
const UI=require('../extension/quick-upload-ui.js');
test('Quick Upload offers paste and file input without prematurely applying artwork',()=>{
 const html=UI.render({quickUpload:{phase:'idle'},quickPackDraft:'<svg>secret & text</svg>'});
 assert.match(html,/Quick Upload/);assert.match(html,/accept="\.chpack,\.txt,text\/plain"/);
 assert.match(html,/data-rd-field="quick-pack-source"/);assert.match(html,/maxlength="3145728"/);
 assert.match(html,/&lt;svg&gt;secret &amp; text&lt;\/svg&gt;/);assert.doesNotMatch(html,/data-rd-action="quick-pack-apply"/);
});
test('review groups expose destination, selected pieces, warnings and an explicit Apply',()=>{
 const state={phase:'review',name:'<img onerror=x>',courses:[{id:'1',name:'Chemistry & Biology'}],groups:[{key:'course:chem',target:{type:'course',names:['Chemistry']},status:'none',included:true,courseId:null,partIndexes:[0]}],parts:[{index:0,slot:'banner',name:'Banner',included:true,status:'unresolved',errors:[]}],warnings:[{message:'Pack ended early.'}],unresolved:[{}],budget:{bytes:500,limit:2097152,ok:true},canApply:false,canUndo:true};
 const html=UI.render({quickUpload:state});assert.match(html,/&lt;img onerror=x&gt;/);assert.match(html,/Choose a course/);
 assert.match(html,/Chemistry &amp; Biology/);assert.match(html,/Pack ended early/);assert.match(html,/data-rd-action="quick-pack-apply"[^>]*disabled/);
 assert.match(html,/data-rd-action="quick-pack-undo"/);assert.match(html,/Unmatched pieces/);
});
test('review never inserts raw rejected SVG and includes actionable per-piece errors',()=>{
 const html=UI.render({quickUpload:{phase:'review',groups:[{key:'overview',target:{type:'overview'},included:true,partIndexes:[0]}],parts:[{index:0,slot:'icon',svg:'<svg onload="bad()">',included:true,status:'error',errors:[{message:'Scripts are not allowed.'}]}],canApply:false}});
 assert.doesNotMatch(html,/onload=/);assert.match(html,/Scripts are not allowed/);assert.match(html,/All courses overview/);
});
test('a successful application keeps Undo available and reports skipped pieces',()=>{
 const html=UI.render({quickUpload:{phase:'applied',name:'Astronomy',canUndo:true,report:{ok:true,applied:[{index:0},{index:1}],notApplied:[{index:2,slot:'title',reason:'bad-slot'}]}}});
 assert.match(html,/Artwork applied/);assert.match(html,/2 pieces/);assert.match(html,/Not applied/);assert.match(html,/bad slot/);
 assert.doesNotMatch(html,/data-rd-action="quick-pack-apply"/);
});
