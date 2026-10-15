const test=require('node:test'),assert=require('node:assert/strict');
const {expand,rewrite}=require('../scripts/css-subjects.cjs');
test('a :is() subject of single compounds with equal specificity is spelled out',()=>{
  assert.deepEqual(expand('.rd :is(.a, .b)'),['.rd .a','.rd .b']);
  assert.deepEqual(expand('.rd > :is(.a,.b):hover::before'),['.rd > .a:hover::before','.rd > .b:hover::before']);
  assert.deepEqual(expand('.rd :is(.a, .b):has(> svg)'),['.rd .a:has(> svg)','.rd .b:has(> svg)']);
});
test('anything that could change what a rule means or how strongly it applies is left as written',()=>{
  for(const sel of ['.rd :is(.a, #b)','.rd :is(.a .c, .b)','.rd :is(.a, :not(.b))','.rd :is(.a, .b:unknown-thing)','.rd :is(.a)','.rd :is(.a, .b) .c','.rd :is(.a, ::before)','.rd :is(.a, *)'])
    assert.deepEqual(expand(sel),[sel],sel);
});
test('only style-rule selectors change: at-rules, keyframes, declarations and comments are kept',()=>{
  const css='/* :is(.x, .y) */\n@media (min-width:1px){.rd :is(.a, .b){color:red}}\n@keyframes k{from{opacity:0}to{opacity:1}}\n.p{background:url("x:is(.a,.b)")}';
  const out=rewrite(css);assert.equal(out.changed,1);
  assert.equal(out.css,'/* :is(.x, .y) */\n@media (min-width:1px){.rd .a, .rd .b{color:red}}\n@keyframes k{from{opacity:0}to{opacity:1}}\n.p{background:url("x:is(.a,.b)")}');
});
test('a list that would grow past 16 selectors is left alone',()=>{
  const args=Array.from({length:17},(_,i)=>'.a'+i).join(', ');
  assert.equal(rewrite(`.rd :is(${args}){color:red}`).changed,0);
});
test('a block another script generated is left exactly as written',()=>{
  const block='/* <frames:generated> */\n.rd :is(.c, .d){color:blue}\n/* </frames:generated> */';
  const out=rewrite('.rd :is(.a, .b){color:red}\n'+block+'\n.rd :is(.e, .f){top:0}');
  assert.equal(out.changed,2);assert.ok(out.css.includes(block));
  assert.ok(out.css.startsWith('.rd .a, .rd .b{color:red}'));assert.ok(out.css.endsWith('.rd .e, .rd .f{top:0}'));
});
