'use strict';

/* Synthetic course data only. No Canvas account, personal artwork, or network. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Motion=require('../extension/motion.js');
const css=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');

function fixture({motion='gentle',reduced=false,input='pointer'}={}){
  const played=[],cssFades=[];
  const animation=(node,frames,options)=>{
    played.push({node,frames,options});
    return {effect:{getComputedTiming:()=>({endTime:options.duration||0})},
      finished:new Promise(()=>{}),cancel(){this.cancelled=true;}};
  };
  const box=(top=10)=>({top,left:12,width:300,height:32,right:312,bottom:top+32});
  function unit(text,html=text,top=10){
    const fade={animationName:'rd-fade',finished:false,finish(){this.finished=true;}};
    cssFades.push(fade);
    return {textContent:text,innerHTML:html,top,fade,parentElement:null,classList:{contains:()=>false},
      getBoundingClientRect(){return box(this.top);},getAnimations(){return [this.fade];},
      closest(){return null;},contains(){return false;},animate(frames,options){return animation(this,frames,options);}};
  }
  const stable=unit('Course information: Office hours on Wednesday','<p>Course information: Office hours on Wednesday</p>',20);
  const changed=unit('Assignment due Tuesday','<p>Assignment due Tuesday</p>',70);
  const markup=unit('Read chapter three','<p>Read chapter three</p>',120);
  const element={dataset:{},
    querySelector(){return null;},matches(){return false;},closest(){return null;},
    querySelectorAll(selector){
      if(selector==='.rd-course-heading>p')return [stable];
      if(selector.startsWith('.rd-ready-note,'))return [changed,markup];
      return [];
    },animate(frames,options){return animation(this,frames,options);}};
  const container={dataset:{input,motionStyle:motion},
    closest(){return null;},querySelector(selector){return selector==='.rd-shell'?{}:null;},
    querySelectorAll(selector){
      if(selector.includes('.rd-course-heading>p')&&selector.includes('.rd-ready-note'))return [stable,changed,markup];
      return [];
    }};
  const controller=Motion.create(container,{media:{matches:reduced},ResizeObserverImpl:null,IntersectionObserverImpl:null,
    setIntervalImpl:()=>0,clearIntervalImpl:()=>{}});
  return {stable,changed,markup,element,container,controller,played,cssFades};
}

test('a course switch fades changed content where it sits; unchanged information remains still when layout shifts',()=>{
  const f=fixture();
  const snap=f.controller.snapshot(f.element);
  assert.equal(snap.units.get(f.stable).html,f.stable.innerHTML);
  f.stable.top+=45;
  f.changed.textContent='Assignment due Friday';
  f.changed.innerHTML='<p>Assignment due Friday</p>';
  f.markup.innerHTML='<p><strong>Read chapter three</strong></p>';
  f.controller.reveal(f.element,{kind:'course',snapshot:snap,animate:true});
  assert.equal(f.played.some(({node})=>node===f.stable),false,'unchanged context does not animate even after reflow');
  for(const node of [f.changed,f.markup]){
    const plays=f.played.filter(entry=>entry.node===node);
    assert.equal(plays.length,1,'text or markup changes fade once');
    assert.deepEqual(plays[0].frames,[{opacity:0},{opacity:1}]);
    assert.equal(plays[0].options.duration,190);
    assert.equal(plays[0].options.delay,undefined,'no stagger');
    assert.equal(node.fade.finished,true,'finish nested CSS fade to avoid a double fade');
  }
  f.controller.destroy();
});

test('simultaneous region entrance is opacity-only and honors keyboard, Off, and reduced motion',()=>{
  const f=fixture();
  f.controller.reveal(f.element,{kind:'section',animate:true});
  assert.deepEqual(f.played[0].frames,[{opacity:0},{opacity:1}]);
  assert.equal(f.played[0].options.duration,190);
  assert.equal(f.played[0].options.delay,undefined);
  f.controller.destroy();
  for(const options of [{motion:'off'},{reduced:true},{input:'keyboard'}]){
    const quiet=fixture(options);
    quiet.controller.reveal(quiet.element,{kind:'section',animate:true});
    assert.equal(quiet.played.length,0,JSON.stringify(options));
    assert.equal(quiet.element.dataset.motion,'settled');
    quiet.controller.destroy();
  }
});

test('public motion CSS fades initial content uniformly without moving it or replaying CSS fades',()=>{
  const main=css('refresh.css'),app=css('app.css'),ai=css('ai-panel.css');
  assert.match(main,/@keyframes rd-enter\s*\{\s*from\s*\{\s*opacity:\s*0;\s*\}\s*\}/);
  assert.match(main,/@keyframes rd-exit\s*\{\s*to\s*\{\s*opacity:\s*0;\s*\}\s*\}/);
  assert.doesNotMatch(main,/@keyframes rd-lift\b|--rd-enter-y\s*:|--rd-exit-y\s*:/);
  const firstEntries=[...main.matchAll(/\.rd\[data-entrance\]\s+[^{}]+\{([^{}]+)\}/g)];
  assert.ok(firstEntries.length>=10,'all initial regions are covered');
  for(const [,body] of firstEntries){
    assert.match(body,/animation:\s*rd-fade 190ms var\(--rd-fade\) both/);
    assert.doesNotMatch(body,/animation-delay:|rd-lift|translate|transform:/);
  }
  assert.doesNotMatch(main,/\[data-motion=entering\][^{}]*\{[^{}]*animation-duration:\s*0s/);
  assert.match(main,/\.rd\[data-input=keyboard\]\[data-entrance\]/);
  assert.match(main,/prefers-reduced-motion:\s*reduce/);
  assert.match(main,/overflow-y:\s*auto;\s*display:\s*none;\s*opacity:\s*0;\s*pointer-events:\s*none/,'a closed phone reader does not leave invisible contents in the accessibility tree');
  assert.match(app,/@keyframes toast-in\{\s*from\{opacity:0\}\s*to\{opacity:1\}\s*\}/);
  assert.match(ai,/@keyframes message-in\s*\{\s*from\s*\{\s*opacity:\s*0;\s*\}\s*to\s*\{\s*opacity:\s*1;\s*\}/);
});

test('an absent status chip still takes its normal row across responsive widths',()=>{
  const layout=css('responsive-layout.css');
  assert.match(layout,/--ch-course-status-h:\s*26px/);
  assert.match(layout,/@media\s*\(max-width:\s*800px\)\s*\{\s*\.rd\s*\{\s*--ch-course-status-h:\s*32px/);
  assert.match(layout,/@media\s*\(max-width:\s*600px\)\s*\{\s*\.rd\s*\{\s*--ch-course-status-h:\s*30px/);
  assert.match(layout,/:has\(> \.rd-heading-art > \.rd-art\):not\(:has\(> \.rd-glance\)\)::after\s*\{\s*content:\s*"";\s*grid-area:\s*4\s*\/\s*1;\s*height:\s*var\(--ch-course-status-h\)/);
  const dock=css('settings-dock.css');
  assert.match(dock,/@media\s*\(max-width:\s*900px\)/);
  assert.match(dock,/\.rd \.rd-appearance\.ch-settings-dock\[data-open="true"\]\s*\{\s*transform:none;transition:opacity/);
  assert.match(css('customize.css'),/\.rd \.rd-arrange-grip:focus-visible::after\s*\{content:"Move"/);
});
test('late content and the toast icon fade in once and then let go of the fade',()=>{
 // rd-fade is only from{opacity:0}, so `backwards` paints the same frames as `both` without keeping a finished opacity
 // animation (and its compositor layer) on every node for its whole life.
 const main=css('refresh.css'),rule=selector=>{const at=main.indexOf(selector+' {');assert.ok(at>=0,selector);return main.slice(at,main.indexOf('}',at));};
 assert.match(main,/@keyframes rd-fade \{ from \{ opacity: 0; \} \}/);
 assert.match(rule('.rd .rd-deck-section, .rd .rd-announcement, .rd .rd-message, .rd .rd-home-body, .rd .rd-home-module, .rd .rd-chapter, .rd .rd-teacher-row, .rd .rd-document-link, .rd .rd-thread-message, .rd .rd-warning'),/animation: rd-fade 190ms var\(--rd-fade\) backwards;/);
 assert.match(main,/\.rd \.rd-toast > \[role=status\] > \.rd-icon \{ animation: rd-fade 170ms var\(--rd-fade\) backwards; \}/);
});
