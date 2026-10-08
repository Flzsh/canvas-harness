/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
(function(root){
  'use strict';
  // Canvas Harness 2.15 "Warm" motion. Motion is a gentle hand setting things down on a
  // desk: what the student touched answers first, only what changed moves, and it
  // moves only where it already is. Nothing travels across the page or over text.
  //
  //   Gentle (default): each control has one selection surface (a pseudo-element
  //     placed by variables on .rd-shell) that slides under the text on a soft
  //     spring (0.6% overshoot). A jump longer than 160px or 3 rows becomes a
  //     crossfade in place. Titles hand over through a 90ms ghost, changed
  //     content settles 6px into place on decelerating slots, counts update in
  //     place, and the course art draws itself like a pen (the art film below).
  //     In the course rail the pen draws the chosen row's frame (the course-row
  //     frames below) instead of a surface gliding.
  //   Still: nothing slides. Surfaces fade in where they land; rises are 2-3px;
  //     a course scene fades in whole.
  //   Off, prefers-reduced-motion, keyboard input and background renders: every
  //     change is immediate (no WAAPI, no transitions, surfaces snap, art is
  //     fully drawn).
  //
  // THE ART FILM (course-art.js drawings, section 10 of refresh.css): when a
  // course's scene first appears through the pointer (a course switch, the first
  // open of a workspace, the dashboard's first paint) it is drawn once, at about
  // 0.75 speed (every reveal time x 4/3): the ground settles, the course colour
  // and the washes bloom, the heads fill, the ink draws itself stroke by stroke
  // in pen order, dots and grain settle. Rail drawings draw in once at mount.
  //
  // THE LIVING LOOP (art/README.md): from the reveal's last frame the heading
  // scene, the Course hub / Materials banner and the rail minis keep living. Each
  // .art-loop part starts at rest, waits phase x period, then repeats its period
  // for ever; every period divides the drawing's data-cycle, so from one cycle in
  // the drawing repeats exactly every cycle. A drawing that appears without a
  // reveal (keyboard, a background render, a banner seen before) is simply drawn
  // and lives from rest. The loops advance on a film clock, never on every display
  // frame: scenes at 24 frames a second while the page has had input in the last
  // 20 seconds, and on twos (12) otherwise, as the minis always are. Loops hold while the drawing is off screen or the page
  // is hidden or has had no input for two minutes (the idle rest), go on from that frame when it is
  // seen or touched again, stop when it leaves, and never run under Still, Off, reduced
  // motion or Living drawings: Off. Every other mini (rows, reader, deck,
  // Grades, Quick open, empty states) rests once drawn: a list of moving icons
  // would be chaotic.
  //
  // Art animations are decorative and never block reading: text and controls
  // are usable at once, the UI settles on its own budget (art never delays
  // data-motion=settled), and they write nothing on the nodes. The reveal is
  // tagged id 'rd-art', the loop 'rd-art-loop'.
  //
  // refresh.css section 1 mirrors the easings and section 11 owns the CSS side.

  // A damped spring x'' = -k(x-1) - c x' sampled into CSS linear(). The natural
  // frequency is solved so |1-x| stays below eps from T on; the sub-eps residual
  // is blended out over the last 40% so the final frame never snaps.
  function springLinear({zeta,T,eps,points=40,m=1}){
    const sim=(k,c)=>{const dt=1/4000,xs=[];let x=0,v=0;for(let t=0;t<=3;t+=dt){xs.push(x);const a=(-k*(x-1)-c*v)/m;v+=a*dt;x+=v*dt;}return xs;};
    const settleAt=xs=>{let last=0;xs.forEach((x,i)=>{if(Math.abs(1-x)>eps)last=i;});return (last+1)/4000;};
    let lo=1,hi=200;for(let i=0;i<80;i++){const w=(lo+hi)/2;if(settleAt(sim(w*w*m,2*zeta*w*m))>T/1000)lo=w;else hi=w;}
    const k=hi*hi*m,c=2*zeta*hi*m,xs=sim(k,c),at=u=>xs[Math.round(u*T*4)],end=at(1);
    const smooth=u=>u<=0?0:u>=1?1:u*u*(3-2*u);
    const values=Array.from({length:points+1},(_,i)=>i===0?0:i===points?1:+(at(i/points)+(1-end)*smooth((i/points-.6)/.4)).toFixed(3));
    return {stiffness:+k.toFixed(1),damping:+c.toFixed(2),max:Math.max(...values),css:`linear(${values.join(', ')})`};
  }
  // --rd-glide: zeta .82, k 234.8, c 25.13. Settles at 420ms with 0.6% overshoot
  // (50% at 99ms, 90% at 200ms). Selection surfaces only.
  const GLIDE='linear(0, 0.012, 0.044, 0.09, 0.146, 0.209, 0.275, 0.342, 0.409, 0.473, 0.535, 0.592, 0.646, 0.695, 0.74, 0.78, 0.816, 0.848, 0.876, 0.9, 0.921, 0.938, 0.953, 0.966, 0.977, 0.985, 0.992, 0.997, 1.001, 1.003, 1.005, 1.006, 1.006, 1.006, 1.005, 1.005, 1.004, 1.003, 1.002, 1.001, 1)';
  // --rd-settle: critically damped (zeta 1, k 236.4, c 30.75), no overshoot. A
  // critically damped spring has one normalised shape at any stiffness, so the
  // 420ms title rise reuses it with a longer duration.
  const SETTLE='linear(0, 0.017, 0.059, 0.118, 0.185, 0.255, 0.327, 0.397, 0.462, 0.524, 0.581, 0.632, 0.678, 0.72, 0.756, 0.789, 0.818, 0.843, 0.865, 0.884, 0.902, 0.918, 0.932, 0.945, 0.957, 0.967, 0.976, 0.984, 0.991, 0.996, 1)';
  const FADE='cubic-bezier(.2,.65,.3,1)';    // opacity in
  const LETGO='cubic-bezier(.2,0,.4,1)';     // ghosts out: they drop at once
  const RELEASE='cubic-bezier(.33,0,.67,1)'; // a leaving row, an echo, cooling
  const PEN='cubic-bezier(.45,.05,.25,1)';   // a line drawn by hand
  const BLOOM='cubic-bezier(.3,0,.2,1)';     // a wash of colour soaking into paper
  // Decelerating slots: gaps 16, 14, 12, 10, 8ms, like a hand gaining confidence.
  const SLOTS=[0,16,30,42,52,60];
  const slot=i=>SLOTS[Math.min(Math.max(i,0),SLOTS.length-1)];
  // Big blocks breathe a little longer: +0..30ms on every opacity fade.
  const bonus=rect=>Math.min(30,Math.round(Math.sqrt(Math.max(0,(rect?.width||0)*(rect?.height||0)))/22));
  const STALE=1500,GLIDE_PX=160,GLIDE_ROWS=3;
  const surfaceMs=travel=>Math.round(340+Math.min(80,.2*travel));
  // Rise (px) by what enters, per style.
  const RISE={gentle:{content:6,title:5,region:4,head:3,count:3,row:4,section:4},still:{content:2,title:3,region:3,head:2,count:0,row:2,section:2}};

  // Selection surfaces: [key, host, pseudo, selected child, rows (vertical only), echo].
  // The course rail has none since 2.17: each row's frame carries its own wash, and the pen draws the
  // frame of the row the pointer chose (THE COURSE-ROW FRAMES, below).
  const SURFACES=[
    {key:'flt',host:'.rd-filter-group',pseudo:'::before',pick:':scope>.rd-filter[aria-pressed="true"]'},
    {key:'pick',host:'.rd-assignment-list',pseudo:'::before',echo:'::after',pick:':scope>.rd-assignment--selected',rows:':scope>.rd-assignment'},
    // Reader sections: a white chip on a tint track (refresh.css 11.1), like the other segments.
    {key:'rtab',host:'.rd-reader-tabs',pseudo:'::before',pick:':scope>.rd-reader-tab[aria-pressed="true"]'}
  ];
  const TITLES=[['heading','.rd-workspace-heading h1'],['page',':is(.rd-page-heading,.rd-course-banner) h1'],['materials','.rd-materials-header h2'],['reader','#rd-reader-title'],['work','.rd-work-heading h2']];
  // .rd-n is the plain numeral in segmented controls, tabs and group heads.
  const COUNTS='.rd-work-heading>div>span,.rd-group-count,.rd-rail-count,.rd-n';
  // The wave: [selector, base delay, slots, rise kind, rise ms]. Unchanged units stay still.
  // A banner's art frame is never a wave unit (the art has its own reveal).
  const HEAD=[['.rd-course-heading>p',24,1,'head',340],['.rd-glance',40,1,'head',340],['.rd-course-banner>div:not(.rd-banner-art)>:not(h1,h2)',24,2,'head',340]];
  const TOOLS=[['.rd-desk-toolbar>*',0,2,'fade'],['.rd-course-tools',40,1,'content']];
  const LIST=[['.rd-ready-note,.rd-assignment-list>*,.rd-work>:is(.rd-load-more,.rd-older)',8,6,'content']];
  const READER=[['.rd-reader-content>:not(#rd-reader-title)',28,4,'content']];
  const DECK=[['.rd-course-information>.rd-deck-header,.rd-bookmarks,.rd-deck-section,.rd-deck-empty,.rd-hub-grid>*,.rd-material-search,.rd-material-group,.rd-message-filter,.rd-message-list,.rd-grade-privacy,.rd-grade-sheet',56,4,'content']];
  const WATCH=[...HEAD,...TOOLS,...LIST,...READER,...DECK].map(([selector])=>selector).join(',');
  const REGIONS='.rd-workspace-heading,.rd-page-heading,.rd-course-banner,.rd-materials-header,.rd-desk-toolbar,.rd-work,.rd-reader,.rd-deck-section,.rd-course-tools,.rd-hub-grid>*,.rd-material-search,.rd-material-group,.rd-message-filter,.rd-message-list,.rd-grade-privacy,.rd-grade-sheet';
  const HEADINGS=/\brd-(workspace-heading|page-heading|course-banner|materials-header)\b/;
  // A hand is not a metronome: fixed per-stroke variation in length and overlap.
  const hand=i=>1+.14*Math.sin(2.39*i+.7),lift=i=>.74+.12*Math.sin(1.71*i+2.1);
  const now=()=>root.performance?.now?.()??Date.now();

  // ---- THE COURSE-ROW FRAMES (refresh.css 3.1; art/BORDERS.md) -------------------
  // Every rail row has a pen-drawn frame in its subject's theme (course-art.js frame()). CSS owns its states
  // (resting, hover, selected), the fades between them, the hover one-shots and, since revision 4, the LIVING
  // LOOPS: CSS animations of whole ornaments, written per subject in refresh.css's generated block. This file
  // does not drive them; it only tells CSS when the page rests (data-art-rest on the root, see the art film's
  // idle rest below), so they pause with the drawings.
  // THE ARRIVAL. When the POINTER chooses a row under Gentle motion, its drawing is built: the resting line drops
  // back to a pencil guide (90ms) and every drawing on the frame goes out (70ms); the pen (.rd-frame-ink) runs
  // once round the frame from the signature ornament (520ms); each ornament is drawn stroke by stroke when the
  // pen reaches it (its --at along the way; 240ms, strokes 40ms apart) and 90ms later its paint and solid ink
  // bloom from their own middle (260ms); a stretched extra stroke is drawn the same way and a dashed one fades
  // in; the part marked .a-fin comes last (from 560ms, 320ms, its paint with a small spring); the wash rises
  // underneath (60-360ms); a part caught in its hover one-shot settles. About 900ms. An actor of the loops (an
  // ornament holding .a-ghost) is left alone: the loops were never stopped.
  // THE EXIT. The row left behind relaxes by its CSS transitions while the pen unwinds its heavy line (280ms); a
  // piece that only the chosen row's loops showed fades where it was (240ms). A draw it had not finished is
  // dropped: the drawings show (a 160ms fade from 35%) and what the pen had inked fades out (160ms).
  // Under Motion Still the arrival is a 160ms fade of the frame from 40%. Keyboard input, Off, reduced motion,
  // background renders and the first paint show the final state at once. Nothing is written on a frame:
  // before() only reads (patchUI strips attributes it does not know), and every animation is WAAPI with
  // fill: backwards on a node of the generated markup, tagged 'rd-frame', so a finished or cancelled animation
  // always shows the CSS state and nothing can be left hidden. Decorative, so it runs beside the UI's budget
  // like the art film and never holds up data-motion=settled. The times mirror art/borders.json "transitions"
  // (a test compares them).
  const FRAME_ID='rd-frame';
  const FRAME_T={draw:{duration:520,guideIn:90,touchDown:120,inkTake:160,settleInk:140,settle:320,settleStagger:40,settleEasing:'cubic-bezier(.2,.7,.2,1)'},wash:{in:300,delay:60},relax:{ink:320,interrupted:160,from:.35},
    arrive:{hide:70,ornament:240,stagger:40,bloomDelay:90,bloom:260,finAt:560,fin:320,bloomEasing:'cubic-bezier(.2,.7,.2,1)',finEasing:'cubic-bezier(.3,1.5,.5,1)'},exit:{unwind:280,unwindEasing:'cubic-bezier(.5,0,.8,.4)',settle:240},still:{fade:160,from:.4}};
  // The frame's stretched svg is 300 x 100 units whatever the row's size.
  const FRAME_BOX=[300,100],FRAME_SAMPLES=160;

  // ---- The pen: when each stroke of a drawing starts and how long it takes ----
  // Each stroke's time follows its length (a steady hand), varied a little by
  // hand(i), never under min (70ms; the art's slower pen 93ms); the next stroke
  // begins before the last one lifts (lift(i)). The whole drawing is scaled to
  // end exactly at start + budget.
  function penPlan(lengths,{start=0,budget=400,min=70}={}){
    const sum=lengths.reduce((total,length)=>total+Math.max(0,length),0);if(!sum)return lengths.map(()=>null);
    let t=0;const raw=lengths.map((length,i)=>{const duration=Math.max(min,budget*length/sum)*hand(i),s={start:t,duration};t+=lift(i)*duration;return s;});
    const scale=budget/Math.max(...raw.map(s=>s.start+s.duration));
    return raw.map(s=>{const from=Math.round(start+s.start*scale),to=Math.round(start+(s.start+s.duration)*scale);return {start:from,duration:Math.max(1,to-from)};});
  }

  // ---- The art film: timing ---------------------------------------------------
  const ART_ID='rd-art',ART_LOOP_ID='rd-art-loop';
  // A title piece (.rd-title-art: the course name as artwork, at the band's left) is a scene in every way but
  // its pen: the name is written in 1.6s. It starts with the scene beside it (the name and the hero slice are
  // drawn together, as the reference player does), so a heading is whole, and living, about 3.2s after the click.
  const ART_FRAMES='.rd-heading-art>svg.rd-art,.rd-banner-art>svg.rd-art,.rd-title-art>svg.rd-art,.rd-rail-art>svg.rd-mini,.rd-empty-art>svg.rd-mini';
  // The drawings that keep living after their reveal.
  const ART_LIVING='.rd-heading-art>svg.rd-art,.rd-banner-art>svg.rd-art,.rd-title-art>svg.rd-art,.rd-rail-art>svg.rd-mini';
  // The scenes a course switch lets go through a ghost: the heading's, the banner's, and the title piece beside either.
  const ART_ROLES=[['heading','.rd-heading-art>svg.rd-art'],['banner','.rd-banner-art>svg.rd-art'],['title','.rd-title-art>svg.rd-art']];
  // The heading or banner a title piece and its scene share.
  const ART_BAND='.rd-course-heading,.rd-course-banner';
  // "About 0.75 as fast": every reveal duration, delay and stagger is x 4/3.
  const ART_SPEED=4/3,slow=ms=>Math.round(ms*ART_SPEED);
  const ART_PEN={wide:slow(1500),mini:slow(420),title:slow(1200)};   // ink budgets: 2000, 560, 1600ms
  // A 480-unit scene in the heading takes the banner's budget scaled by its width against the banner's largest
  // (440px), so the hand draws at the banner's pace (1636ms at 360px, 1818ms at 400px), and never faster than
  // the old heading crop's pen at 4/3 (950 x 4/3 = 1267ms).
  // A PANORAMA (a scene wider than 480 units: one continuous room up to 1680 long, whose right 480 units are the
  // hero) is drawn in 480-unit SLICES counted from its right edge, as the reference player draws it: the hero
  // slice's pen has 1300ms, every further slice 800ms (a narrower last slice its share, 400ms at least), and each
  // slice starts 300ms before the pen of the one to its right has finished. A part belongs to the slice its
  // centre is in. Only the slices that can be seen are drawn: one that the frame cuts away, or that lies under
  // the title block's scrim, is simply there. The whole 1680-unit room is drawn by 2.6s and living at 3.1s.
  // ART_COVER_PAD: the scrim stays opaque 22px past the text (--rd-art-clear); ART_GHOST_FADE: the soft edge a
  // leaving wide scene's ghost keeps there, so it never flashes over the title on its way out.
  const ART_BANNER_W=440,ART_PEN_HEADING_MIN=slow(950),ART_COVER_PAD=20,ART_GHOST_FADE=96;
  const ART_SLICE={width:480,first:slow(975),next:slow(600),least:slow(300),overlap:slow(225)};   // 1300, 800, 400, 300ms
  // A living part of a panorama that cannot be seen (its box more than ART_SEEN_MARGIN units outside what shows)
  // is not set by the film clock; it joins, on the film's own time, when it comes into view.
  const ART_SEEN_MARGIN=100;
  const penFor=(svg,rect)=>{
    if(svg?.getAttribute?.('data-crop')==='title')return ART_PEN.title;
    const width=Number(rect?.width)||0,height=Number(rect?.height)||0,hero=height>0?Math.min(width,height*2):width;
    return svg?.getAttribute?.('data-place')==='heading'?Math.min(ART_PEN.wide,Math.max(ART_PEN_HEADING_MIN,Math.round(ART_PEN.wide*(hero||ART_BANNER_W)/ART_BANNER_W))):ART_PEN.wide;
  };
  // A slice's pen budget: the hero's, or a further slice's share of 800ms for its width.
  const sliceBudget=(index,units)=>index?Math.max(ART_SLICE.least,Math.round(ART_SLICE.next*units/ART_SLICE.width)):ART_SLICE.first;
  const ART_T={
    stroke:70*ART_SPEED,                                                            // the shortest stroke, 93ms
    scene:{ground:{step:slow(12),steps:4,dur:slow(280)},key:{at:slow(60),step:60,max:300,dur:slow(420)},wash:{at:slow(120),step:slow(14),max:slow(200),dur:slow(360)},
      pen:slow(160),head:{fallback:slow(140),dur:slow(200)},dots:{before:slow(160),step:slow(60),steps:6,dur:slow(260)},solid:{before:slow(60),dur:slow(200)},grain:slow(300),still:slow(240)},
    mini:{color:{step:slow(10),max:slow(60),dur:slow(220)},pen:slow(60),head:{fallback:slow(40),latest:slow(280),dur:slow(200)},dots:{at:slow(340),dur:slow(140)},solid:{at:slow(380),dur:slow(100)},end:slow(480)},
    // When a reveal starts: the first paint (scenes; rail rows 67ms apart), a course switch, a workspace, an empty state.
    entrance:slow(100),rail:slow(120),step:slow(50),course:slow(60),workspace:slow(40),empty:slow(60)
  };
  const ART_SCENES=2;                 // scene reveals at once; a newer one finishes the oldest
  // Rail rows come alive at golden-ratio steps round their cycle, so no two rows
  // (however many) ever rock in step: row i's loop clock sits at frac(i x .618) x C.
  const ART_RAIL_SPREAD=.6180339887;

  // ---- The living loop: pure keyframe builders ----------------------------------
  // THE RIG (art/README.md "Living loops"; 2.17 adds the choreography types). Ten simple types move a whole
  // group by one amplitude: sway tilt bob shift breathe pulse blink flap drift orbit. Three more are keyframed
  // by data-keys="t:...; t:...", t a fraction of the part's period; the rest pose is implied at t = 0 and
  // t = 1, so every period starts and ends on the drawing as authored:
  //   keys   (a group)  t:tx ty rot scale opacity [ease]   translate (units), rotate (deg), scale (s or
  //                     sx,sy; never mirrored), opacity (times the group's own). Trailing values may be left
  //                     out; "t:" alone is a rest key (a hold).
  //   morph  (a path)   t:<path data | shape name | =>[|#fill opacity ease]   the path's shape, drawn pose by
  //                     pose (the same commands as its d, only the numbers change); data-shapes="name:<d>; ..."
  //                     is a dictionary of drawn poses a key may name. In-betweens are interpolated; with the
  //                     easing "hold" a pose is kept and then swapped (there is no separate pose-swap type).
  //   draw   (a stroked path)   t:drawn opacity [ease]     the share of the stroke shown from its start.
  // data-ease (soft, lin/linear, hold, in, out, steps(n) or a CSS easing) is the easing of a part's segments;
  // a key's last word may name its own. data-rig="name" names a part's rig and data-like="name" follows it
  // (a follower's own data-* win). Loops nest as elements nest. Periods are C/n, n = 1 to 24.
  const LOOP_TYPES=['sway','tilt','bob','shift','breathe','pulse','blink','flap','drift','orbit','keys','morph','draw'];
  const LOOP_AMP={sway:6,tilt:6,bob:3,shift:0,breathe:.03,pulse:.5,blink:.25,flap:10,drift:0,orbit:3};
  const LOOP_MAX_N=24;
  // Every loop segment leaves and arrives softly. A swing (sway) is a pendulum:
  // its first swing starts softly from rest, then it passes through rest at
  // speed (sine segments) instead of stopping there every period.
  const LOOP_EASE='cubic-bezier(.45,.05,.55,.95)';
  const SINE={out:'cubic-bezier(.61,1,.88,1)',inOut:'cubic-bezier(.37,0,.63,1)',in:'cubic-bezier(.12,0,.39,0)'};
  function curve(easing){
    const m=String(easing).match(/cubic-bezier\(([^)]+)\)/),[x1,y1,x2,y2]=m?m[1].split(',').map(Number):[0,0,1,1];
    const bx=t=>3*x1*t*(1-t)**2+3*x2*t*t*(1-t)+t**3,by=t=>3*y1*t*(1-t)**2+3*y2*t*t*(1-t)+t**3;
    return x=>{if(x<=0)return 0;if(x>=1)return 1;let lo=0,hi=1;for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(bx(mid)<x)lo=mid;else hi=mid;}return by((lo+hi)/2);};
  }
  const r3=n=>+(+n).toFixed(3);
  const pairOf=value=>{const v=String(value??'').trim().split(/[\s,]+/).map(Number);return v.length===2&&v.every(Number.isFinite)?v:[0,0];};
  const cycleOf=svg=>{const c=parseFloat(svg?.getAttribute?.('data-cycle'));return Number.isFinite(c)&&c>0?c:0;};
  // Easing names a rig may use (data-ease, or the last word of a key).
  const LOOP_EASES={soft:LOOP_EASE,lin:'linear',linear:'linear',hold:'steps(1, end)',in:'cubic-bezier(.5,0,.85,.55)',out:'cubic-bezier(.15,.45,.5,1)'};
  const easeOf=(token,fallback=LOOP_EASE)=>!token?fallback:LOOP_EASES[token]||(/^(steps|cubic-bezier|linear)\(/.test(token)||/^(ease|ease-in|ease-out|ease-in-out|step-start|step-end)$/.test(token)?token.replace(/^steps\((\d+)\)$/,'steps($1, end)'):fallback);
  const pathLength=node=>{try{const L=node?.getTotalLength?.();return Number.isFinite(L)?L:0;}catch{return 0;}};
  // Every part that names its rig (data-rig), by name: the first in document order wins.
  function rigsOf(svg){
    const map=new Map(),walk=node=>{for(const child of Array.from(node?.children||[])){const name=child.getAttribute?.('data-rig');if(name!=null&&!map.has(name))map.set(name,child);walk(child);}};
    walk(svg);return map;
  }
  // One .art-loop part. Its period is snapped to C/n (n = 1-24), so the whole drawing repeats exactly every
  // C seconds. A follower (data-like) takes from the part that carries that data-rig whatever it does not say itself.
  function loopSpec(group,C,rigs=null){
    const own=name=>group?.getAttribute?.(name)??null,like=own('data-like'),rig=like!=null?rigs?.get?.(like)||null:null;
    const get=name=>own(name)??(rig?rig.getAttribute?.(name)??null:null),type=get('data-loop'),raw=parseFloat(get('data-period'));
    const n=Math.min(LOOP_MAX_N,Math.max(1,Math.round(C/(Number.isFinite(raw)&&raw>0?raw:C)))),amp=parseFloat(get('data-amp'));
    return {type,period:C/n,n,phase:Math.min(.999,Math.max(0,parseFloat(get('data-phase'))||0)),amp:Number.isFinite(amp)?amp:LOOP_AMP[type]??0,origin:pairOf(get('data-origin')),to:pairOf(get('data-to')),keys:get('data-keys')||'',ease:get('data-ease')||'',shapes:get('data-shapes')||''};
  }
  // "t:a b c word; t:..." -> [{t, text}], sorted, t from 0 to 1.
  function keyList(text){
    return String(text||'').split(';').map(s=>{const i=s.indexOf(':');if(i<0)return null;const t=parseFloat(s.slice(0,i));return Number.isFinite(t)&&t>=0&&t<=1?{t,text:s.slice(i+1).trim()}:null;}).filter(Boolean).sort((a,b)=>a.t-b.t);
  }
  const wordsOf=text=>{const words=text.split(/\s+/).filter(Boolean),last=words[words.length-1],ease=last&&!/^[-+.\d]/.test(last)?words.pop():'';return {words,ease};};
  // keys: the first and the last frame are the rest pose whatever the rig says (a last key that turns a whole
  // number of times is rest). A scale never mirrors: it is kept positive.
  function keysFrames(spec,rest){
    const [ox,oy]=spec.origin,O=`${r3(ox)}px ${r3(oy)}px`,fallback=easeOf(spec.ease),pos=v=>Number.isFinite(v)?Math.max(.05,v):1;
    const list=keyList(spec.keys).map(k=>{const {words,ease}=wordsOf(k.text),s=String(words[3]??'1').split(',').map(Number);return {t:k.t,tx:+words[0]||0,ty:+words[1]||0,r:+words[2]||0,sx:pos(s[0]),sy:pos(Number.isFinite(s[1])?s[1]:s[0]),o:words[4]==null?1:+words[4],ease};});
    const REST={tx:0,ty:0,r:0,sx:1,sy:1,o:1,ease:''},restful=k=>!k.tx&&!k.ty&&k.r%360===0&&k.sx===1&&k.sy===1&&k.o===1;
    if(!list.length||list[0].t>0)list.unshift({t:0,...REST});else Object.assign(list[0],REST,{ease:list[0].ease});
    const end=list[list.length-1];
    if(end.t<1)list.push({t:1,...REST});else if(!restful(end))Object.assign(end,REST);
    const fades=list.some(k=>k.o!==1);
    return list.map((k,i)=>({offset:r3(k.t),transform:`translate(${r3(k.tx)}px, ${r3(k.ty)}px) rotate(${r3(k.r)}deg) scale(${r3(k.sx)}, ${r3(k.sy)})`,transformOrigin:O,...(fades?{opacity:r3(rest*k.o)}:{}),...(i<list.length-1?{easing:easeOf(k.ease,fallback)}:{})}));
  }
  // morph: every key's path data has the rest d's commands in the same order and case (Chromium then
  // interpolates d: path()); "=" (or nothing) keeps the rest shape; a name takes a shape from data-shapes.
  function morphFrames(spec,node,rest){
    const d0=node?.getAttribute?.('d')||'',fill0=node?.getAttribute?.('fill')??null,fallback=easeOf(spec.ease),shapes=new Map();
    for(const s of String(spec.shapes||'').split(';')){const i=s.indexOf(':');if(i>0)shapes.set(s.slice(0,i).trim(),s.slice(i+1).trim());}
    const shape=v=>!v||v==='='?d0:shapes.get(v)||v;
    const list=keyList(spec.keys).filter(k=>k.t>0&&k.t<1).map(k=>{
      const [d,extra='']=k.text.split('|'),out={t:k.t,d:shape(d.trim()),fill:null,o:null,ease:''};
      for(const w of extra.split(/\s+/).filter(Boolean)){if(w[0]==='#')out.fill=w;else if(/^[-+.\d]/.test(w))out.o=+w;else out.ease=w;}
      return out;
    });
    const fills=list.some(k=>k.fill)&&fill0,fades=list.some(k=>k.o!=null);
    const frame=(t,k,last)=>({offset:r3(t),d:`path("${k?k.d:d0}")`,...(fills?{fill:k?.fill||fill0}:{}),...(fades?{opacity:r3(rest*(k?.o??1))}:{}),...(last?{}:{easing:easeOf(k?.ease,fallback)})});
    return [frame(0,null),...list.map(k=>frame(k.t,k)),frame(1,null,true)];
  }
  // draw: the stretch of a stroke that shows, by dashes in the keyframes only. "drawn" is b (shown from the start
  // to b) or a,b (shown from a to b: liquid running through a tube; player 2.2). Rest is the whole stroke.
  function drawFrames(spec,node,rest){
    const L=Math.ceil(pathLength(node)+1),fallback=easeOf(spec.ease),unit=v=>Math.min(1,Math.max(0,v));
    const list=keyList(spec.keys).filter(k=>k.t>0&&k.t<1).map(k=>{const {words,ease}=wordsOf(k.text),v=String(words[0]??'1').split(',').map(Number);return {t:k.t,a:v.length>1?unit(v[0]):0,b:unit(v.length>1?v[1]:v[0]),o:words[1]==null?1:+words[1],ease};});
    const fades=list.some(k=>k.o!==1),REST={a:0,b:1,o:1};
    const frame=(t,k,last)=>{const q=k||REST;return {offset:r3(t),strokeDasharray:`${r3((q.b-q.a)*L)} ${L}`,strokeDashoffset:`${r3(-q.a*L)}`,...(fades?{opacity:r3(rest*q.o)}:{}),...(last?{}:{easing:easeOf(k?.ease,fallback)})};};
    return [frame(0,null),...list.map(k=>frame(k.t,k)),frame(1,null,true)];
  }
  // Keyframes for one period of a part: the first frame and the last are the
  // drawing at rest, so a loop starts from the reveal's last frame and its
  // periods join seamlessly. Origins are master units (transform-box view-box,
  // refresh.css 10). join: a swing's first period, which starts softly from rest.
  function loopFrames(spec,rest=1,{join=false,node=null}={}){
    const {type,amp:A,origin:[ox,oy],to:[dx,dy]}=spec,O=`${r3(ox)}px ${r3(oy)}px`;
    const R=a=>({transform:`rotate(${r3(a)}deg)`,transformOrigin:O}),S=s=>({transform:`scale(${r3(s)})`,transformOrigin:O}),T=(x,y)=>({transform:`translate(${r3(x)}px, ${r3(y)}px)`});
    const K=(list,eases=[])=>list.map(([offset,props],i)=>({offset,...props,...(i<list.length-1?{easing:eases[i]||LOOP_EASE}:{})}));
    switch(type){
      case 'sway':return K([[0,R(0)],[.25,R(A)],[.75,R(-A)],[1,R(0)]],[join?LOOP_EASE:SINE.out,SINE.inOut,SINE.in]);
      case 'tilt':return K([[0,R(0)],[.5,R(A)],[1,R(0)]]);
      case 'flap':return K([[0,R(0)],[.1,R(A)],[.22,R(-A/2)],[.34,R(0)],[1,R(0)]]);
      case 'bob':return K([[0,T(0,0)],[.5,T(0,-A)],[1,T(0,0)]]);
      case 'shift':return K([[0,T(0,0)],[.5,T(dx,dy)],[1,T(0,0)]]);
      case 'breathe':return K([[0,S(1)],[.5,S(1+A)],[1,S(1)]]);
      case 'pulse':return K([[0,{opacity:rest}],[.5,{opacity:r3(rest*A)}],[1,{opacity:rest}]]);
      case 'blink':{const d=r3(Math.min(.1,Math.max(.02,110/(spec.period*1000))));return K([[0,{opacity:rest}],[d,{opacity:r3(rest*A)}],[r3(2.2*d),{opacity:rest}],[1,{opacity:rest}]]);}
      // Moves and fades over 70% of the period, is set back unseen, and fades in where it rests.
      case 'drift':return K([[0,{...T(0,0),opacity:rest}],[.7,{...T(dx,dy),opacity:0}],[.7,{...T(0,0),opacity:0}],[1,{...T(0,0),opacity:rest}]]);
      // Once round an ellipse (A across, A/2 deep) whose lowest point is the rest pose, the angle eased.
      case 'orbit':{const ease=curve(LOOP_EASE),N=32,out=[];for(let i=0;i<=N;i++){const u=i/N,th=2*Math.PI*ease(u);out.push({offset:r3(u),...T(i===N?0:A*Math.sin(th),i===N?0:(Math.abs(A)/2)*(Math.cos(th)-1))});}return out;}
      case 'keys':return keysFrames(spec,rest);
      // A morph and a draw belong to a path (`node`): its d, its fill and its length are the rest pose.
      case 'morph':return String(node?.tagName||'').toLowerCase()==='path'?morphFrames(spec,node,rest):[];
      case 'draw':return String(node?.tagName||'').toLowerCase()==='path'?drawFrames(spec,node,rest):[];
      default:return [];
    }
  }

  // The living loops run on a hand-drawn film's clock (see the art film's clock): FILM_FPS frames a second,
  // never on every display frame. Every frame of a living page costs a whole-page style, layout, paint and
  // commit pass, so the frame rate is the cost.
  //   Scenes (the heading band, the hub and Materials banners, a title piece): 24, a film's rate. 2.17's
  //   drawings act (a walk, a pour, a falling drop, a line drawn and wiped): at 12 a walking figure moves
  //   2.3px a frame and reads as stepping; at 24 it reads as moving.
  //   Minis (the rail): 12 ("on twos"). Their moves are 1-3px and there are many of them.
  // One clock runs at the highest rate a drawing in view needs, and sets a mini's parts on every second tick.
  // WHAT 24 COSTS, measured in the app preview (headless Edge, software raster, 1920x1080, Home with a
  // course open and seven rail minis living; main-thread busy share over 10s, twice each):
  //   a 1440-unit panorama in the heading band (89 scene parts + 55 mini parts): 5.2-5.3% with its scene at
  //   12, 8.6-9.0% at 24; today's 480-unit scene (19 + 55 parts): 3.9-4.0% at 12, 6.5% at 24; Living
  //   drawings Off: 0.2%.
  // So 24 costs about two thirds more than 12, nearly all of it the page's own style and layout pass per
  // frame. That is worth paying while someone is at the page, not while it is merely open: scenes play at
  // 24 for ART_BRISK_MS after the last pointer or key input on the page (dashboard.js tells us: activity()),
  // and on twos, like the minis, after that, until the idle rest stops everything.
  const FILM_FPS={scene:24,mini:12};
  const ART_BRISK_MS=20000;
  // THE IDLE REST: a page nobody has touched for two minutes (no pointer or key input on it) holds every
  // living drawing where it stands, so a dashboard left open on a screen costs nothing at all; the next
  // input (or the tab shown again) lets them go on from that very frame. The clock checks it as it ticks.
  const ART_IDLE_MS=120000;

  function create(container,{media=root.matchMedia?.('(prefers-reduced-motion: reduce)'),ResizeObserverImpl=root.ResizeObserver,IntersectionObserverImpl=root.IntersectionObserver,setIntervalImpl=root.setInterval?.bind(root),clearIntervalImpl=root.clearInterval?.bind(root)}={}){
    let geometry=null,dead=false,layer=null,first=true,geo={},watched=[],bar=null;
    const active=new Map(),ghosts=new Set();
    const observer=ResizeObserverImpl?new ResizeObserverImpl(()=>syncTabs(false)):null;
    const host=()=>container.closest?.('.rd')||container;
    const style=()=>{const value=container.dataset?.motionStyle||host().dataset?.motionStyle;return value==='still'||value==='off'?value:'gentle';};
    const reduced=()=>!!media?.matches||style()==='off';
    const pointer=()=>(container.dataset?.input||host().dataset?.input)==='pointer';
    const rise=kind=>RISE[style()==='still'?'still':'gentle'][kind]??0;
    const fresh=snap=>!!snap&&now()-snap.at<=STALE;
    const view=()=>(root.innerHeight||Infinity)+40;
    const inView=rect=>!!rect&&rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<view();
    const clipped=rect=>rect.width<2&&rect.height<2;// visually hidden (the sr-only 1px box)
    const shellOf=()=>container.querySelector?.('.rd-shell')||null;
    function play(node,frames,options,list){
      if(typeof node?.animate!=='function')return null;
      let animation;try{animation=node.animate(frames,options);}catch{return null;}
      list?.push(animation);return animation;
    }
    function watch(nodes){
      if(!observer)return;
      const next=nodes.filter(Boolean);
      if(next.length===watched.length&&next.every((node,i)=>node===watched[i]))return;
      observer.disconnect();for(const node of next)observer.observe(node);watched=next;
    }

    // ---- The course-row frames: the arrival of the row the pointer chose, the exit of the row it left ----
    const frames=(()=>{
      let running=[];
      const T=FRAME_T,A=T.arrive,css=node=>(node&&root.getComputedStyle?.(node))||null;
      const rowOf=node=>node?.closest?.('.rd-rail-course,.rd-rail-all')||null;
      const frameOf=row=>row?.querySelector?.(':scope>.rd-frame')||null;
      const chosen=row=>row?.getAttribute?.('data-selected')==='true'||row?.getAttribute?.('aria-pressed')==='true';
      const current=()=>container.querySelector?.('.rd-course-rail>:is(.rd-rail-all[aria-pressed="true"],.rd-rail-course[data-selected="true"])')||null;
      const rest=pose=>!pose||pose==='none'||pose==='matrix(1, 0, 0, 1, 0, 0)';
      const poses=row=>Array.from(frameOf(row)?.querySelectorAll?.('.o-move')||[],el=>{const pose=css(el)?.transform;return rest(pose)?'none':pose;});
      // Where the chosen row's loops have its ornaments now (opacity and transform), read before the render.
      const ornState=row=>Array.from(frameOf(row)?.querySelectorAll?.(':scope>.rd-frame-orn')||[],el=>{const cs=css(el);return [el,{opacity:cs?.opacity??'',transform:cs?.transform??''}];});
      const stroked=cs=>cs.stroke!=='none'&&parseFloat(cs.strokeWidth)>0,filled=cs=>!!cs.fill&&cs.fill!=='none',dashed=cs=>!!cs.strokeDasharray&&cs.strokeDasharray!=='none';
      const at=node=>+node.style?.getPropertyValue?.('--at')||0;
      // An ornament whose own CSS loop is going (running, or paused and set by the film clock) goes on by itself: the exit leaves it alone.
      const looping=el=>!!el.getAnimations?.().some(a=>a.animationName&&(a.playState==='running'||a.playState==='paused'));
      const run=(el,keyframes,options)=>play(el,keyframes,{fill:'backwards',id:FRAME_ID,...options},running);
      // On-screen length of the stretched pen line. Its stroke does not scale, so its dashes are measured in
      // screen px, while getTotalLength() answers in viewBox units: sample the path and scale by the svg's box.
      function inkLength(svg,path){
        const r=svg.getBoundingClientRect(),sx=r.width/FRAME_BOX[0],sy=r.height/FRAME_BOX[1],total=path.getTotalLength();
        let length=0,a=path.getPointAtLength(0);
        for(let i=1;i<=FRAME_SAMPLES;i++){const b=path.getPointAtLength(total*i/FRAME_SAMPLES);length+=Math.hypot((b.x-a.x)*sx,(b.y-a.y)*sy);a=b;}
        return length;
      }
      // FIRST (in snapshot(), before the render): what the two frames look like now. It only reads.
      function before(target){
        if(dead||style()==='off')return null;
        const next=rowOf(target),frame=frameOf(next);if(!frame||chosen(next))return null;
        const old=current();
        if(style()==='still')return {old,next,still:true};
        return {old,next,from:css(frame)?.color||'',washFrom:css(frame.querySelector('.rd-frame-wash'))?.opacity||'0',poses:poses(next),oldOrns:old?ornState(old):null};
      }
      // What is still playing on one frame stops (its CSS state shows through).
      function clear(frame){
        const mine=running.filter(a=>frame.contains?.(a.effect?.target??a.target));
        for(const a of mine)a.cancel?.();running=running.filter(a=>!mine.includes(a));
      }
      // The row that has just lost the choice: CSS fades its ink, weight, wash and accent, and the pen unwinds its
      // heavy line. A draw it had not finished (two quick clicks) is dropped: its drawings show at once (a short
      // fade from 35%) and what the pen had inked fades out. A piece that only the chosen row's loops showed fades
      // where it was; one that those loops had moved settles (an ornament whose own loop goes on is left alone).
      function relax(row,memo){
        const frame=frameOf(row);if(!frame)return;
        const main=frame.querySelector('.rd-frame-main'),ink=frame.querySelector('.rd-frame-ink'),cs=css(ink),half=cs?.visibility==='visible'?{strokeDasharray:cs.strokeDasharray,strokeDashoffset:cs.strokeDashoffset}:null;
        const drawing=running.some(a=>frame.contains?.(a.effect?.target??a.target));
        clear(frame);
        if(half)run(ink,[{visibility:'visible',opacity:1,...half},{visibility:'visible',opacity:0,...half}],{duration:T.relax.interrupted,easing:RELEASE});
        else if(main&&ink){
          let length=0;try{length=inkLength(main,ink);}catch{}
          if(length>0&&Number.isFinite(length)){const L=Math.ceil(length)+2,dash=`${L} ${L}`;run(ink,[{visibility:'visible',strokeDasharray:dash,strokeDashoffset:0,easing:T.exit.unwindEasing},{visibility:'visible',strokeDasharray:dash,strokeDashoffset:-L}],{duration:T.exit.unwind});}
        }
        if(drawing){for(const el of frame.querySelectorAll(':scope>.rd-frame-orn'))if(!el.querySelector?.('.a-ghost'))run(el,[{opacity:T.relax.from},{opacity:css(el)?.opacity||1}],{duration:T.relax.interrupted,easing:'ease-out'});return;}
        for(const [el,was] of memo?.oldOrns||[]){
          if(!frame.contains?.(el)||looping(el))continue;
          const now=css(el);if(!now||(was.opacity===now.opacity&&was.transform===now.transform))continue;
          const gone=now.opacity==='0';// an actor of the chosen row's loops: it fades where it is, it does not fly home
          run(el,[{opacity:was.opacity,transform:was.transform},{opacity:now.opacity,transform:gone?was.transform:now.transform}],{duration:T.exit.settle,easing:RELEASE});
        }
      }
      // Motion Still: the arrival is a quick fade of the whole frame (no pen, no building).
      function fade(row){const frame=frameOf(row);if(frame)run(frame,[{opacity:T.still.from},{opacity:1}],{duration:T.still.fade,easing:'ease-out',fill:'none'});}
      // The pen draws the frame of the row that has just been chosen, and the drawing is built in its wake.
      function draw(row,memo){
        const frame=frameOf(row);if(!frame)return;
        const cs=css(frame),guide=cs?.getPropertyValue?.('--f-guide')?.trim(),full=cs?.getPropertyValue?.('--f-ink')?.trim();
        const main=frame.querySelector('.rd-frame-main'),ink=frame.querySelector('.rd-frame-ink'),wash=frame.querySelector('.rd-frame-wash');
        if(!guide||!full||!main||!ink)return;
        let length=0;try{length=inkLength(main,ink);}catch{}if(!(length>0)||!Number.isFinite(length))return;
        clear(frame);
        const L=Math.ceil(length)+2,dash=`${L} ${L}`,D=T.draw.duration,END=D+T.draw.settleInk,from=memo.from||guide;
        // 1. The resting line drops back to a pencil guide while the ink runs over it, and is full ink once the pen has passed.
        run(main,[{color:from,offset:0},{color:guide,offset:T.draw.guideIn/END},{color:guide,offset:D/END},{color:full,offset:1}],{duration:END,easing:'linear'});
        // 2. The pen.
        run(ink,[{visibility:'visible',strokeDasharray:dash,strokeDashoffset:L,offset:0,easing:PEN},{visibility:'visible',strokeDasharray:dash,strokeDashoffset:0,offset:D/END},{visibility:'visible',strokeDasharray:dash,strokeDashoffset:0,offset:1}],{duration:END});
        // One stroke: it shows as it was, is gone at A.hide, and is drawn from t0 over dur (len in the units its
        // dashes are measured in: an ornament's own units, a stretched stroke's screen px).
        const pen=(path,len,t0,dur)=>{
          if(!(len>0)||!Number.isFinite(len))return;
          const l=Math.ceil(len)+2,all=t0+dur,d=`${l} ${l}`,h=Math.min(A.hide,t0);
          if(t0<=1)run(path,[{strokeDasharray:d,strokeDashoffset:l,easing:PEN},{strokeDasharray:d,strokeDashoffset:0}],{duration:dur});
          else run(path,[{strokeDasharray:d,strokeDashoffset:0,offset:0,easing:'steps(1, end)'},{strokeDasharray:d,strokeDashoffset:l,offset:h/all},{strokeDasharray:d,strokeDashoffset:l,offset:t0/all,easing:PEN},{strokeDasharray:d,strokeDashoffset:0,offset:1}],{duration:all});
        };
        // One fill (paint or solid ink): gone at A.hide, then it blooms from its own middle.
        const bloom=(el,to,t0,dur,easing,small)=>{
          const all=t0+dur,h=Math.min(A.hide,t0)/all;
          run(el,[{opacity:to,transform:'scale(1)',offset:0,easing:'steps(1, end)'},{opacity:0,transform:`scale(${small})`,offset:h},{opacity:0,transform:`scale(${small})`,offset:t0/all,easing},{opacity:to,transform:'scale(1)',offset:1}],{duration:all});
        };
        // 3. The stretched extras: a stroke is drawn when the pen reaches it; a dashed one (ticks, stitches) fades in.
        for(const svg of frame.querySelectorAll('.rd-frame-extra')){
          const t0=at(svg)*D;
          for(const p of svg.querySelectorAll('path')){
            const pc=css(p);if(!pc||pc.display==='none')continue;
            if(dashed(pc)){const all=t0+A.ornament;run(p,[{opacity:pc.opacity,offset:0,easing:'steps(1, end)'},{opacity:0,offset:Math.min(A.hide,t0)/all},{opacity:0,offset:t0/all},{opacity:pc.opacity,offset:1}],{duration:all});}
            else{let len=0;try{len=inkLength(svg,p);}catch{}pen(p,len,Math.max(t0,1.5),A.ornament+80);}
          }
        }
        // 4. The ornaments: the first is where the pen touches down; the flourish (.a-fin) comes last. An actor of
        //    the loops (.a-ghost) is not part of the arrival, and a drawing its row is too short for is not there.
        for(const svg of frame.querySelectorAll(':scope>.rd-frame-orn')){
          const sc=css(svg);if(!sc||sc.display==='none'||svg.querySelector('.a-ghost'))continue;
          const fin=!!svg.querySelector('.a-fin');let t0=svg.getAttribute?.('data-o')==='0'?0:at(svg)*D,j=0;if(fin)t0=Math.max(t0,A.finAt);
          for(const p of svg.querySelectorAll('path')){
            const pc=css(p);if(!pc)continue;const last=fin&&!!p.closest?.('.a-fin');
            if(filled(pc))bloom(p,pc.opacity,t0+A.bloomDelay,last?A.fin:A.bloom,last?A.finEasing:A.bloomEasing,last?.3:.6);
            else if(stroked(pc)){let len=0;try{len=p.getTotalLength();}catch{}pen(p,len,t0+Math.min(j,3)*A.stagger,last?A.fin:A.ornament);j++;}
          }
        }
        // 5. A part caught in its hover one-shot settles.
        Array.from(frame.querySelectorAll('.o-move')).forEach((el,i)=>{const pose=memo.poses?.[i]||'none';if(pose!=='none')run(el,[{transform:pose},{transform:'none'}],{duration:T.draw.settle,easing:T.draw.settleEasing});});
        // 6. The wash rises underneath.
        if(wash)run(wash,[{opacity:memo.washFrom??'0'},{opacity:1}],{duration:T.wash.in,delay:T.wash.delay,easing:FADE});
      }
      // After the render that chose the row (place(), for a fresh pointer snapshot only).
      function after(memo){
        if(dead||!memo||memo.done)return;memo.done=true;
        const {old,next}=memo;if(next?.isConnected===false||!chosen(next))return;
        running=running.filter(a=>a.playState!=='finished'&&a.playState!=='idle');
        try{
          if(memo.still){if(style()==='still')fade(next);return;}
          if(old&&old!==next&&old.isConnected!==false)relax(old,memo);draw(next,memo);
        }catch{}
      }
      function cancel(){for(const a of running)a?.cancel?.();running=[];}
      return {before,after,cancel,inkLength};
    })();

    // ---- Selection surfaces --------------------------------------------------
    // Layout offsets up the offsetParent chain to the host, so FLIP transforms
    // on the rows never move a surface.
    function offset(node,to){
      let x=0,y=0;
      for(let n=node;n!==to;n=n.offsetParent){if(!n)return null;x+=n.offsetLeft||0;y+=n.offsetTop||0;}
      return {x,y};
    }
    function measure(shell,surface){
      const box=shell.querySelector(surface.host),on=box?.querySelector(surface.pick);
      const at=on&&offset(on,box);
      if(!at||!on.offsetWidth)return {o:0,box};
      const rows=surface.rows?Array.from(box.querySelectorAll(surface.rows)):null;
      return {x:at.x,y:at.y,w:on.offsetWidth,h:on.offsetHeight,o:1,i:rows?rows.indexOf(on):0,box};
    }
    const same=(a,b)=>!!a&&!!b&&a.o===b.o&&a.box===b.box&&(!a.o||['x','y','w','h'].every(k=>Math.abs((a[k]||0)-(b[k]||0))<.5));
    const travel=(a,b,surface)=>surface.rows?Math.abs(a.y-b.y)+Math.abs(a.h-b.h)/2:Math.abs(a.x-b.x)+Math.abs(a.w-b.w)/2;
    function write(shell,key,g){
      const set=(name,value)=>shell.style?.setProperty?.(`--rd-sel-${key}-${name}`,value);
      if(g.o){set('x',`${g.x}px`);set('y',`${g.y}px`);set('w',`${g.w}px`);set('h',`${g.h}px`);}
      set('o',String(g.o?1:0));
    }
    // Snaps are written one surface at a time under data-sel-snap (transition:
    // none), each flushed, so a lead still gliding from an earlier click keeps its path.
    function snapTo(shell,items){
      if(!items.length)return;
      shell.dataset.selSnap=items.map(([surface])=>surface.key).join(' ');
      for(const [surface,g] of items){write(shell,surface.key,g);if(g.box)try{void root.getComputedStyle?.(g.box,surface.pseudo)?.translate;}catch{}}
      delete shell.dataset.selSnap;
    }
    function place(animate=false,snap=null){
      const shell=shellOf();if(!shell||dead)return;
      const next={};for(const surface of SURFACES)next[surface.key]=measure(shell,surface);
      watch([bar,shell,...SURFACES.map(s=>next[s.key].box)]);
      const moving=animate&&!first&&!reduced()&&pointer()&&(!snap||fresh(snap));
      // A save re-renders in the background before the change's own render (Undo, check-off): the surfaces
      // then move from where the student saw them at the click (the snapshot), not from that background frame.
      const base=moving&&snap?.geo?snap.geo:geo;
      const changed=SURFACES.filter(s=>!same(next[s.key],base[s.key]));
      // One lead per render: the surface the student touched, else the first that changed. A course picked in
      // the rail has no surface to lead (the pen draws its frame instead), so every surface simply lands.
      let lead=null;
      if(moving&&snap?.frame)frames.after(snap.frame);
      if(moving&&snap?.target!=='tabs'&&snap?.target!=='rail'){
        const touched=SURFACES.find(s=>s.key===snap?.target);
        lead=[touched,...changed].find(s=>s&&changed.includes(s)&&next[s.key].o)||null;
      }
      snapTo(shell,SURFACES.filter(s=>s!==lead&&(changed.includes(s)||!same(next[s.key],geo[s.key]))).map(s=>[s,next[s.key]]));
      if(lead){
        const to=next[lead.key],from=base[lead.key],distance=from?.o?travel(to,from,lead):0;
        const hop=style()==='still'||!from?.o||(lead.rows&&(distance>GLIDE_PX||Math.abs(to.i-from.i)>GLIDE_ROWS));
        if(!hop){
          if(from!==geo[lead.key]&&!same(from,geo[lead.key])&&from.box===to.box)snapTo(shell,[[lead,from]]);
          shell.style?.setProperty?.(`--rd-sel-${lead.key}-dur`,`${surfaceMs(distance)}ms`);write(shell,lead.key,to);
        }else{
          // A crossfade in place: the new surface fades in where it lands (Gentle
          // lets it settle 4px in the travel direction); the old one fades out
          // where it was. A sheet never sweeps past more than 3 rows.
          snapTo(shell,[[lead,to]]);
          const still=style()==='still',dy=from?.o&&lead.rows&&!still?Math.sign(to.y-from.y)*-4:0;
          play(to.box,[{opacity:0},{opacity:1}],{pseudoElement:lead.pseudo,duration:220,easing:FADE});
          if(dy)play(to.box,[{transform:`translateY(${dy}px)`},{transform:'none'}],{pseudoElement:lead.pseudo,duration:340,easing:SETTLE});
          if(lead.echo&&from?.o&&from.box===to.box){
            shell.style?.setProperty?.(`--rd-echo-${lead.key}-y`,`${from.y}px`);shell.style?.setProperty?.(`--rd-echo-${lead.key}-h`,`${from.h}px`);
            play(to.box,[{opacity:1},{opacity:0}],{pseudoElement:lead.echo,duration:200,easing:RELEASE});
          }
        }
      }
      geo=next;first=false;
    }

    // Tab pills (workspace tabs, the Tools dock): CSS owns the glide; the
    // duration follows the distance. Still snaps the pill and fades it in.
    // Every render and resize also passes here, so the art film keeps its books.
    function syncTabs(animate=false,force=false,snap=null){
      if(dead)return;
      const tabs=container.querySelector?.('.t-tabs'),pill=tabs?.querySelector('.t-tabs-pill'),tab=tabs?.querySelector('.t-tab[aria-selected="true"]');
      if(tabs!==bar){bar=tabs;geometry=null;watch([bar,...watched.slice(1)]);}
      if(pill&&tab){
        const next={id:tab.dataset.tab,x:tab.offsetLeft,width:tab.offsetWidth};
        if(bar.clientWidth){
          if(next.x<bar.scrollLeft)bar.scrollLeft=next.x;
          else if(next.x+next.width>bar.scrollLeft+bar.clientWidth)bar.scrollLeft=next.x+next.width-bar.clientWidth+4;
        }
        if(force||!geometry||next.id!==geometry.id||next.x!==geometry.x||next.width!==geometry.width){
          const transition=pill.style.transition||'',still=style()==='still';
          const snapped=!animate||!geometry||reduced()||still;
          if(geometry&&!snapped)pill.style.setProperty?.('--rd-pill-dur',`${surfaceMs(Math.abs(next.x-geometry.x)+Math.abs(next.width-geometry.width)/2)}ms`);
          if(snapped)pill.style.transition='none';
          pill.style.transform=`translateX(${next.x}px)`;pill.style.width=`${next.width}px`;
          if(snapped){void pill.offsetWidth;pill.style.transition=transition;}
          if(still&&animate&&geometry&&!reduced()&&next.id!==geometry.id)play(pill,[{opacity:0},{opacity:1}],{duration:200,easing:FADE});
          geometry=next;
        }
      }
      place(animate,snap);
      art.sync();
    }

    // ---- Ink: a small drawing draws itself stroke by stroke (the check tick) ---
    function ink(svg,{delay=0,budget=400}={}){
      if(!svg||dead||reduced())return [];
      const strokes=[];
      for(const node of svg.querySelectorAll?.('path,circle,line,polyline')||[]){let length=0;try{length=Math.ceil(node.getTotalLength()+1);}catch{}if(length>0&&Number.isFinite(length))strokes.push({node,length});}
      const plan=penPlan(strokes.map(s=>s.length),{start:delay,budget}),list=[];
      strokes.forEach((s,i)=>{if(!plan[i])return;const dash=`${s.length} ${s.length}`;
        play(s.node,[{strokeDasharray:dash,strokeDashoffset:`${s.length}`,opacity:0},{opacity:1,offset:.08},{strokeDasharray:dash,strokeDashoffset:'0'}],{duration:plan[i].duration,delay:plan[i].start,easing:PEN,fill:'backwards'},list);});
      return list;
    }

    // ---- The art film ----------------------------------------------------------
    // Books (kept by syncTabs on every render): a drawing that appears is pending
    // for the length of one render. reveal() may claim it when the student's
    // pointer caused the render; otherwise it is simply drawn and never revealed
    // later (a background render never replays a drawing). Either way a living
    // drawing then lives: its loop starts where the reveal ends, or from rest.
    // A film is one drawing's reveal and loop: {reveal, loops, until, began,
    // scene, paused, offscreen}.
    const art=(()=>{
      const seen=new WeakSet(),appeared=new Set(),films=new Map(),runs=new Map();
      let pending=[],waiting=[],mounted=false,queued=false,io=null,timer=0,clock=0,lastInput=now(),idle=false;
      const attr=(node,name)=>node?.getAttribute?.(name)??null;
      const classes=node=>String(attr(node,'class')||'').split(/\s+/);
      const isScene=svg=>classes(svg).includes('rd-art');
      const base=node=>{const v=parseFloat(attr(node,'opacity'));return Number.isFinite(v)?v:1;};
      const hidden=()=>root.document?.visibilityState==='hidden';
      // The page rests (two minutes without input, or a hidden tab): the root says so, and the course-row frames'
      // CSS loops pause where they stand (refresh.css 3.1: .rd[data-art-rest]). An attribute on the root, like
      // data-motion-style: nothing is written on a frame.
      const rest=on=>{const data=container.dataset;if(!data)return;if(on)data.artRest='';else delete data.artRest;};
      // On screen, laid out and in a visible tab: anything else simply stays drawn.
      const shown=svg=>!!svg&&svg.isConnected!==false&&!!svg.getClientRects?.().length&&inView(svg.getBoundingClientRect?.())&&!hidden();
      const box=svg=>{const [x,y,w,h]=String(attr(svg,'viewBox')||'0 0 480 240').split(/[\s,]+/).map(Number);return {x,y,w,h};};
      const bbox=node=>{try{return node.getBBox?.()||null;}catch{return null;}};
      // A wide scene (data-wide) behind a lettered title block: how many px at its left end the block's scrim
      // hides (refresh.css 4.0; the block is what stands beside the frame: the title, the detail line and the
      // chips, or the banner's title and text; a wrapper laid out as `display: contents` counts through its
      // children; the banner's actions stand under the floor at the right and hide nothing). 0 for a 480-unit
      // scene, which stands clear of the text, and 0 where the course name is artwork: the room's box then starts
      // right behind the title piece (refresh.css 4.2), so what the box shows is what can be seen.
      const wide=svg=>attr(svg,'data-wide')==='true';
      const isTitle=svg=>attr(svg,'data-crop')==='title';
      const laidOut=node=>{const r=node?.getBoundingClientRect?.();return !!r&&r.width>1&&r.height>1;};
      function covered(svg,rect){
        if(!wide(svg)||!rect)return 0;
        const frame=svg.parentNode,around=Array.from(frame?.parentNode?.children||[]).filter(node=>node!==frame&&!classes(node).includes('rd-heading-actions'));let right=-Infinity;
        if(around.some(node=>classes(node).includes('rd-title-art')&&laidOut(node)))return 0;
        const block=around.flatMap(node=>laidOut(node)?[node]:Array.from(node.children||[]));
        for(const node of block){const r=node.getBoundingClientRect?.();if(r&&r.width>0&&r.height>0)right=Math.max(right,r.right);}
        return Number.isFinite(right)?Math.max(0,Math.min(rect.width,right+ART_COVER_PAD-rect.left)):0;
      }
      // The first x of the scene (in its own units) that can be seen: past what the frame cuts off at the
      // left (the svg keeps its right end and its height) and past what the scrim hides.
      function seenFrom(svg,v,rect,hide=0){
        if(!wide(svg)||!rect?.height||!v.h)return v.x;
        const scale=rect.height/v.h,shown=Math.min(v.w,rect.width/scale);
        return v.x+v.w-shown+hide/scale;
      }
      // Where a node stands along the scene, in the scene's own units: its box, moved by the translate() of any
      // plain group above it (the only transform a drawing may carry). null when it has no box.
      function span(svg,node){
        const b=bbox(node);if(!b)return null;let dx=0;
        for(let p=node.parentNode;p&&p!==svg;p=p.parentNode){const m=/translate\(\s*(-?[\d.]+)/.exec(attr(p,'transform')||'');if(m)dx+=+m[1];}
        return [b.x+dx,b.x+b.width+dx];
      }
      const length=pathLength;
      // A drawing lives (Gentle, no reduced motion, Living drawings on) when it is
      // a heading or banner scene or a rail mini, rigged with a cycle.
      const living=()=>(container.dataset?.livingArt||host().dataset?.livingArt)!=='off';
      const lives=svg=>!dead&&!reduced()&&style()==='gentle'&&living()&&svg?.isConnected!==false&&!!svg?.matches?.(ART_LIVING)&&cycleOf(svg)>0;
      // Walk the drawing once: every path by layer, every living part in document order, and the rigs by name.
      function layers(svg){
        const out={ground:[],key:[],wash:[],head:[],ink:[],dots:[],solid:[],grain:[],loops:[],rigs:new Map()};
        const walk=(node,layer)=>{
          for(const child of Array.from(node.children||[])){
            const c=classes(child);let l=layer;
            if(c.includes('art-loop'))out.loops.push(child);
            const rig=attr(child,'data-rig');if(rig!=null&&!out.rigs.has(rig))out.rigs.set(rig,child);
            if(c.includes('art-key'))l='key';else if(c.includes('art-grain'))l='grain';
            else for(const name of ['ground','wash','head','ink','dots','solid'])if(c.includes(`art-${name}`))l=name;
            if(String(child.tagName||'').toLowerCase()==='path')out[l||'wash'].push({node:child});
            else walk(child,l);
          }
        };
        walk(svg,null);return out;
      }
      // A scene is known by its key and its place: the heading and the hub banner show the same
      // whole scene (art-{id}-wide), and each draws itself the first time it appears there.
      const sceneKey=svg=>{const key=attr(svg,'data-rd-key');return key?`${key}@${attr(svg,'data-place')||''}`:null;};
      function filmOf(svg){
        let f=films.get(svg);
        if(!f){f={reveal:[],loops:[],until:0,began:0,scene:isScene(svg),title:isTitle(svg),fps:isScene(svg)?FILM_FPS.scene:FILM_FPS.mini,shown:-Infinity,held:false,offscreen:false};films.set(svg,f);observe(svg);}
        return f;
      }
      function endReveal(f){for(const x of f.reveal)x?.cancel?.();f.reveal=[];f.until=0;}
      function endLoops(f){for(const x of f.loops){x?.cancel?.();runs.delete(x);}f.loops=[];if(dead)park();else wake();}
      // Cancelling leaves the drawing as authored (nothing was written on it).
      function stop(svg){const f=films.get(svg);if(!f)return;films.delete(svg);io?.unobserve?.(svg);endReveal(f);endLoops(f);}
      // Off screen, or while the page is hidden, a loop holds where it is and
      // resumes from there. A reveal (a few seconds at most) simply finishes.
      function observe(svg){
        if(!io&&IntersectionObserverImpl)try{io=new IntersectionObserverImpl(entries=>{for(const e of entries){const f=films.get(e.target);if(!f)continue;f.offscreen=!e.isIntersecting;if(f.offscreen)hold(f);else release(f);}});}catch{io=null;}
        io?.observe?.(svg);
      }
      // THE FILM CLOCK. Every loop part is a paused animation whose time this clock sets FILM_FPS times a
      // second (24 for a scene, 12 for a mini), like the frames of a hand-drawn film. A running animation on
      // an SVG part is restyled and laid out on every display frame (60-144 a second, the main-thread cost of
      // an idle page); on the clock, a living page restyles 24 times a second at most (12 where only minis
      // live), and not at all while every drawing is held. The clock runs at the highest rate a drawing that
      // is going needs (`clock`), and is set again when that changes. A run: {f, origin (film time 0), at
      // (when it was held), then ([end, next]: a first swing hands over to its steady swing when its time
      // passes end)}.
      // A scene's rate is spent only while the page has had input lately (ART_BRISK_MS); otherwise it plays on twos.
      function rate(){
        const brisk=now()-lastInput<ART_BRISK_MS;let fps=0;
        for(const r of runs.values())if(r.at==null&&!r.unseen)fps=Math.max(fps,brisk?r.f.fps:Math.min(r.f.fps,FILM_FPS.mini));
        return fps;
      }
      function wake(){
        if(dead||!setIntervalImpl)return;
        const fps=rate();if(!fps){park();return;}if(timer&&clock===fps)return;
        park();clock=fps;timer=setIntervalImpl(tick,1000/fps);timer?.unref?.();
      }
      function park(){if(timer){clearIntervalImpl?.(timer);timer=0;}clock=0;}
      // A PART AT REST NEEDS NO FRAME. A part acts for a moment of its cycle and rests for most of it: between two
      // keyframes that say the same thing nothing changes. Seeking an animation restyles its part even when nothing
      // moved (measured: 1 to 1.5% of a main thread for a living heading). So a tick whose film time lies in the same rest as the
      // last frame written for the part writes nothing (the part shows exactly what it showed). Only a plain endless
      // loop is read this way (linear in time, forwards, from its start); anything else is written every tick.
      function restsOf(x){
        try{
          const effect=x.effect,timing=effect?.getTiming?.(),frames=effect?.getKeyframes?.();
          if(!timing||!frames||frames.length<2||!(timing.duration>0)||timing.iterations!==Infinity||(timing.direction&&timing.direction!=='normal')||timing.iterationStart||(timing.easing&&timing.easing!=='linear'))return null;
          const skip=k=>k==='offset'||k==='computedOffset'||k==='easing'||k==='composite';
          const same=(a,b)=>{for(const k of new Set([...Object.keys(a),...Object.keys(b)]))if(!skip(k)&&a[k]!==b[k])return false;return true;};
          const list=[];
          for(let i=0;i+1<frames.length;i++){
            const a=frames[i].computedOffset,b=frames[i+1].computedOffset;if(!(b>a)||!same(frames[i],frames[i+1]))continue;
            const last=list[list.length-1];if(last&&last[1]===a)last[1]=b;else list.push([a,b]);
          }
          return list.length?{list,delay:timing.delay||0,duration:timing.duration}:null;
        }catch{return null;}
      }
      function frame(x,r,t){
        const time=Math.max(0,t-r.origin);let rest=-1;
        if(r.rests){const local=time-r.rests.delay;if(local>=0){const p=(local/r.rests.duration)%1;rest=r.rests.list.findIndex(h=>p>=h[0]&&p<h[1]);}}
        if(rest<0||rest!==r.rest){try{x.currentTime=time;}catch{}}
        r.rest=rest;
        if(r.then&&t-r.origin>=r.then[0]){const next=r.then[1];r.then=null;next(r,t);}
      }
      // THE COURSE-ROW FRAMES' LOOPS ON THE FILM CLOCK. They are CSS animations (the generated block of refresh.css),
      // and CSS alone decides which exist (Motion Gentle, Living drawings on, the chosen row's extra ones). Left to
      // run, every one of them is restyled on each main frame the page produces (24 a second while a scene lives)
      // and they raise that rate themselves: measured, about 3.5% of a main thread beside a living heading, and
      // about 1% this way. So while
      // the clock runs it takes them over: each is paused where it stands and set from the film's own time 12 times
      // a second, and not at all while its piece rests (most of every cycle: frame()). A loop CSS starts later (a
      // row chosen, Living drawings back on) is taken over at the next look, twice a second; one CSS has ended is
      // forgotten and never written again. While the clock is stopped (the idle rest, a hidden tab) they hold where
      // they stand and go on from there; with no clock at all they run as plain CSS. Nothing is written on a node.
      const loops=new Map();let loopsAt=0,loopsSeen=0;
      function frameLoops(t){
        const step=1000/FILM_FPS.mini,gap=t-loopsAt;if(gap<step-4)return;loopsAt=t;
        try{
          if(t-loopsSeen>=500){
            loopsSeen=t;const live=new Set();
            for(const a of container.querySelector?.('.rd-course-rail')?.getAnimations?.({subtree:true})||[]){
              if(!String(a.animationName||'').startsWith('rd-fl-')||a.playState==='idle')continue;live.add(a);
              if(!loops.has(a)){a.pause();loops.set(a,{origin:t-(+a.currentTime||0),rests:restsOf(a),rest:-1});}
            }
            for(const a of [...loops.keys()])if(!live.has(a))loops.delete(a);
          }
          for(const [a,r] of [...loops]){
            if(a.playState==='idle'){loops.delete(a);continue;}
            if(gap>400)r.origin+=gap-step;// the clock had stopped: they go on from where they stood
            frame(a,r,t);
          }
        }catch{}
      }
      // The view is destroyed: the loops are CSS's again.
      function freeLoops(){for(const a of loops.keys()){try{if(a.playState!=='idle')a.play();}catch{}}loops.clear();}
      // Two minutes without input: every drawing holds where it stands (the idle rest) and the clock stops.
      function tick(at){
        if(dead){park();return;}const t=Number.isFinite(at)?at:now(),turns=new Map();
        // A drawing slower than the clock (a mini while a scene lives) takes every second tick: its turn comes
        // when its own frame time has passed (less half a tick, for a timer that fires a little early).
        const turn=f=>{let ok=turns.get(f);if(ok===undefined){ok=!clock||f.fps>=clock||t-f.shown>=1000/f.fps-500/clock;if(ok)f.shown=t;turns.set(f,ok);}return ok;};
        for(const [x,r] of [...runs])if(r.at==null&&!r.unseen&&turn(r.f))frame(x,r,t);
        // This frame is the one they hold, so the next input goes on from exactly here.
        frameLoops(t);
        if(t-lastInput>=ART_IDLE_MS){idle=true;rest(true);for(const f of films.values())hold(f,t);}
        wake();
      }
      // Any input on the page (dashboard.js: pointer moves and presses, keys) or the tab shown again: after an idle
      // rest every drawing that may move goes on from the frame it held.
      // It also brings the scenes back to their film rate (a clock running on twos is set again at 24).
      function activity(){
        lastInput=now();if(clock&&clock<FILM_FPS.scene)wake();
        if(!idle)return;idle=false;rest(hidden());for(const f of films.values())release(f);
      }
      // A new part joins the clock paused, at its first frame (a part of a held drawing joins held).
      function run(f,x,{origin=now(),then=null,part=null,span}={}){
        if(!x)return null;x.pause?.();const r={f,origin,at:f.held?now():null,then,part,span,unseen:false,rests:restsOf(x),rest:-1};runs.set(x,r);
        try{x.currentTime=Math.max(0,now()-origin);}catch{}
        wake();return x;
      }
      function hold(f,at){if(f.held)return;f.held=true;const t=at??now();for(const r of runs.values())if(r.f===f&&r.at==null)r.at=t;wake();}
      function release(f){
        if(dead||idle||f.offscreen||hidden()||!f.held)return;
        f.held=false;const t=now();for(const r of runs.values())if(r.f===f&&r.at!=null){r.origin+=t-r.at;r.at=null;}
        wake();
      }
      function visibility(){if(!hidden())activity();rest(hidden()||idle);for(const f of films.values())if(hidden())hold(f);else release(f);}
      const railRow=svg=>{const rail=svg.closest?.('.rd-course-rail');return rail?Math.max(0,Array.from(rail.querySelectorAll?.('.rd-rail-art>svg.rd-mini')||[]).indexOf(svg)):0;};
      // The living loop, `start` ms from now (0: from rest, at once). Each part
      // waits phase x period, then repeats its period for ever. A swing's first
      // period starts softly; from then on it swings through rest like a
      // pendulum. A rail row waits for its place round the cycle (ART_RAIL_SPREAD;
      // `lead` is the reveal stagger it already had), so the rail never rocks in step.
      // No loop animation fills: before a part joins (and after a first swing ends) it has no effect at all, so
      // the part rests as authored, and a path-level loop (morph, draw) never overrides the reveal's own
      // keyframes on that path. `parts` is what the reveal's walk found ({loops, rigs}), when there was one.
      function loop(svg,start=0,parts=null,lead=0){
        const f=filmOf(svg),cycle=cycleOf(svg),C=cycle*1000;endLoops(f);if(!C)return;
        const at=start+(svg.matches?.('.rd-rail-art>svg.rd-mini')?(((railRow(svg)*ART_RAIL_SPREAD%1)*C-lead)%C+C)%C:0);
        // One film time 0 for every part of the drawing (making ninety animations takes a few ms: each part
        // taking its own "now" would put them that far out of step with each other).
        const {loops,rigs}=parts||layers(svg),origin=now();
        for(const group of loops){
          const spec=loopSpec(group,cycle,rigs);if(!LOOP_TYPES.includes(spec.type))continue;
          // Exact (fractional) ms: a C/3 period rounded would drift off the cycle.
          const P=spec.period*1000,delay=at+spec.phase*P,rest=base(group),o={duration:P,easing:'linear',id:ART_LOOP_ID};
          if(spec.type==='sway')swing(svg,f,group,spec,rest,o,delay,origin);
          else{const frames=loopFrames(spec,rest,{node:group});if(frames.length)run(f,play(group,frames,{...o,delay,iterations:Infinity},f.loops),{part:group,origin});}
        }
        gate(svg,f);
        if(idle||f.offscreen||hidden())hold(f);
      }
      // WHAT CAN BE SEEN LIVES. A living part of a panorama whose box lies more than ART_SEEN_MARGIN units left
      // of what shows (cut away by the frame, or under the title block's scrim) is not set by the clock: it rests
      // where it is and costs nothing. Every render and resize asks again (sync), and a part that has come into
      // view takes the film's own time at the next tick, in step with the rest. A part's place is measured once,
      // when its loop is made.
      // (A 480-unit scene, a title piece and a mini are never cut: every part of them always runs.)
      function gate(svg,f){
        if(!f||!f.loops.length||!wide(svg))return;
        const v=box(svg),rect=svg.getBoundingClientRect?.(),from=seenFrom(svg,v,rect,covered(svg,rect));let changed=false;
        for(const r of runs.values()){
          if(r.f!==f||!r.part)continue;
          if(r.span===undefined)r.span=span(svg,r.part);
          const unseen=!!r.span&&r.span[1]+ART_SEEN_MARGIN<from;if(unseen!==r.unseen){r.unseen=unseen;changed=true;}
        }
        if(changed)wake();
      }
      // A swing: the soft first swing, then the steady pendulum, made only when
      // the first has played through (the clock passes delay + P) and put on the
      // same film time (the first's origin). One transform animation per part at
      // a time: never two effects fighting over one part.
      function swing(svg,f,group,spec,rest,o,delay,origin){
        const next=(r,t)=>{
          if(dead||films.get(svg)!==f||!f.loops.includes(first))return;
          const steady=run(f,play(group,loopFrames(spec,rest),{...o,delay:delay+o.duration,iterations:Infinity},f.loops),{origin:r.origin,part:group,span:r.span});
          if(steady)frame(steady,runs.get(steady),t);
        };
        const first=run(f,play(group,loopFrames(spec,rest,{join:true}),{...o,delay},f.loops),{then:[delay+o.duration,next],part:group,origin});
      }
      // At most ART_SCENES scene reveals at once: a newer one finishes the oldest
      // (it is simply drawn, and lives on from rest). A title piece is part of its scene's reveal, not one more.
      function roomForScene(){
        const t=now(),live=[...films].filter(([,f])=>f.scene&&!f.title&&f.until>t).sort((x,y)=>x[1].began-y[1].began);
        while(live.length>=ART_SCENES){const [svg,f]=live.shift();endReveal(f);endLoops(f);if(lives(svg))loop(svg);}
      }
      const a=(list,node,frames,options)=>play(node,frames,{...options,id:ART_ID,fill:'backwards'},list);
      const fade=(list,node,delay,duration,easing=FADE)=>a(list,node,[{opacity:0},{opacity:base(node)}],{duration,delay,easing});
      // The pen for a list of strokes, with dashes in the keyframes only.
      function pen(list,strokes,start,budget){
        const plan=penPlan(strokes.map(s=>s.length),{start,budget,min:ART_T.stroke});
        strokes.forEach((s,i)=>{const L=Math.ceil(s.length+1),dash=`${L} ${L}`,o=base(s.node);
          a(list,s.node,[{strokeDasharray:dash,strokeDashoffset:`${L}`,opacity:0},{opacity:o,offset:.08},{strokeDasharray:dash,strokeDashoffset:'0',opacity:o}],{duration:plan[i].duration,delay:plan[i].start,easing:PEN});});
        return plan;
      }
      // A head fills as the pen draws its outline (the stroke that best overlaps
      // it), so no blank disc waits on the page; without a match, just before the pen.
      function heads(list,items,strokes,plan,fallback,dur,latest=Infinity){
        const boxes=strokes.map(s=>bbox(s.node));
        for(const item of items){
          const h=bbox(item.node);let best=-1,score=0;
          if(h)boxes.forEach((b,i)=>{if(!b)return;const ix=Math.max(0,Math.min(h.x+h.width,b.x+b.width)-Math.max(h.x,b.x)),iy=Math.max(0,Math.min(h.y+h.height,b.y+b.height)-Math.max(h.y,b.y)),inter=ix*iy,union=h.width*h.height+b.width*b.height-inter,iou=union>0?inter/union:0;if(iou>score){score=iou;best=i;}});
          fade(list,item.node,Math.min(latest,best>=0&&score>=.35?plan[best].start+Math.round(plan[best].duration*.3):fallback),dur);
        }
      }
      const endOf=list=>list.reduce((end,x)=>Math.max(end,x?.effect?.getComputedTiming?.().endTime??0),0);

      // A scene draws itself (Gentle): ground, the course colour and washes bloom,
      // heads fill, the pen draws the ink in DOM order, dots and grain settle.
      // It ends on the drawing at rest, where its loop takes over.
      // Every scene is the whole composition (the heading's banner and the hub banner alike), so every
      // stroke is drawn and every part lives; the heading's pen is the banner's, scaled to its width.
      // One slice's worth of a scene (the whole of a 480-unit one), from t0: the ground settles, the course
      // colour and the washes bloom, heads fill, the pen draws the ink in DOM order within `budget`, dots and
      // slivers settle. Returns when its pen lifts.
      function panel(list,v,L,t0,budget){
        const T=ART_T.scene;
        const size=node=>{const b=bbox(node),w=b?b.width/(v.h*2||v.w):0;return w>.5?1:w>.25?.985:.97;};// against the hero's width, so a panorama blooms like a 480-unit scene
        const bloom=(node,delay,duration)=>{const s=classes(node).includes('art-loop')?1:size(node);a(list,node,s<1?[{opacity:0,transform:`scale(${s})`},{opacity:base(node),transform:'scale(1)'}]:[{opacity:0},{opacity:base(node)}],{duration,delay,easing:BLOOM});};
        L.ground.forEach((item,i)=>fade(list,item.node,t0+T.ground.step*Math.min(i,T.ground.steps),T.ground.dur));
        // The course-colour shapes (one, or a small family in a panorama) bloom in turn, 60ms apart.
        L.key.forEach((item,i)=>bloom(item.node,t0+T.key.at+Math.min(i*T.key.step,T.key.max),T.key.dur));
        L.wash.forEach((item,i)=>bloom(item.node,t0+T.wash.at+Math.min(T.wash.step*i,T.wash.max),T.wash.dur));
        const strokes=L.ink.map(item=>({node:item.node,length:length(item.node)})).filter(s=>s.length>=1),start=t0+T.pen;
        const plan=pen(list,strokes,start,budget);
        heads(list,L.head,strokes,plan,t0+T.head.fallback,T.head.dur);
        const inkEnd=strokes.length?start+budget:start;
        L.dots.forEach((item,i)=>fade(list,item.node,inkEnd-T.dots.before+T.dots.step*Math.min(i,T.dots.steps),T.dots.dur));
        L.solid.forEach(item=>fade(list,item.node,inkEnd-T.solid.before,T.solid.dur));
        return inkEnd;
      }
      function scene(svg,t0){
        const list=[],L=layers(svg),v=box(svg),rect=svg.getBoundingClientRect?.(),NAMES=['ground','key','wash','head','ink','dots','solid'];let inkEnd=t0;
        if(wide(svg)){
          // A panorama: 480-unit slices counted from the right edge (the hero is slice 0), each starting 300ms
          // before the pen of the one to its right lifts. A slice that cannot be seen (cut away by the frame, or
          // wholly under the title block's scrim) and every slice left of it is simply there.
          const W=ART_SLICE.width,count=Math.max(1,Math.ceil(v.w/W)),right=v.x+v.w,from=seenFrom(svg,v,rect,covered(svg,rect));
          const slices=Array.from({length:count},()=>Object.fromEntries(NAMES.map(name=>[name,[]])));
          const sliceOf=node=>{const s=span(svg,node),cx=s?(s[0]+s[1])/2:right;return Math.min(count-1,Math.max(0,Math.floor((right-cx)/W)));};
          for(const name of NAMES)for(const item of L[name])slices[sliceOf(item.node)][name].push(item);
          let at=t0;
          for(let i=0;i<count;i++){
            if(right-i*W<=from)break;
            const budget=sliceBudget(i,Math.min(W,v.w-i*W));
            inkEnd=Math.max(inkEnd,panel(list,v,slices[i],at,budget));at+=budget-ART_SLICE.overlap;
          }
        }else inkEnd=panel(list,v,L,t0,penFor(svg,rect));
        L.grain.forEach(item=>fade(list,item.node,inkEnd,ART_T.scene.grain));
        return {list,end:Math.max(endOf(list),inkEnd),inkEnd,loops:L.loops,rigs:L.rigs};
      }
      // A mini draws in (the rail at mount, an empty state): colour first, then
      // the pen, all within 640ms.
      function mini(svg,t0){
        const list=[],L=layers(svg),T=ART_T.mini;
        [...L.ground,...L.key,...L.wash].forEach((item,i)=>fade(list,item.node,t0+Math.min(T.color.step*i,T.color.max),T.color.dur));
        const strokes=L.ink.map(item=>({node:item.node,length:length(item.node)})).filter(s=>s.length>=1),start=t0+T.pen;
        const plan=pen(list,strokes,start,ART_PEN.mini);
        heads(list,L.head,strokes,plan,t0+T.head.fallback,T.head.dur,t0+T.head.latest);
        [...L.dots,...L.grain].forEach(item=>fade(list,item.node,t0+T.dots.at,T.dots.dur));
        L.solid.forEach(item=>fade(list,item.node,t0+T.solid.at,T.solid.dur));
        return {list,end:Math.max(endOf(list),t0+T.end),loops:L.loops,rigs:L.rigs};
      }
      // anywhere: the rail's rows at the entrance draw in down the list wherever they stand: the first
      // paint's layout may still be settling (fonts, the rail's fade), so an in-view test there would
      // skip rows that end up in view. A row that ends up below the fold simply finishes unseen.
      function reveal(svg,t0,{anywhere=false}={}){
        if(anywhere?!(svg&&svg.isConnected!==false&&svg.getClientRects?.().length&&!hidden()):!shown(svg))return;
        const scenic=isScene(svg);
        if(scenic){const key=sceneKey(svg);if(key)appeared.add(key);if(!isTitle(svg))roomForScene();}
        const f=filmOf(svg);endReveal(f);endLoops(f);f.began=now();
        if(style()==='still'){if(scenic){fade(f.reveal,svg,t0,ART_T.scene.still);f.until=f.began+t0+ART_T.scene.still;}return;}
        // A title piece and the scene beside it start together: the name is written while the hero slice is drawn.
        const r=scenic?scene(svg,t0):mini(svg,t0);
        f.reveal=r.list;f.until=f.began+r.end;
        // The loop starts on the reveal's last frame: every part is at rest there.
        if(lives(svg))loop(svg,r.end,r,scenic?0:Math.max(0,t0-ART_T.rail));
      }
      // Every render (and resize): what the last render showed and nobody claimed
      // is now simply part of the page; drawings that left are stopped.
      const see=svg=>{seen.add(svg);const key=sceneKey(svg);if(key)appeared.add(key);};
      function sync(){
        if(dead)return;
        for(const svg of pending)see(svg);
        pending=[];
        for(const [svg,f] of [...films])if(svg.isConnected===false)stop(svg);else gate(svg,f);
        if(waiting.length)settle();
        for(const svg of container.querySelectorAll?.(ART_FRAMES)||[])if(!seen.has(svg)&&!waiting.includes(svg))pending.push(svg);
        if(!mounted&&shellOf()){mounted=true;entrance();}
        afterRender();
      }
      // Right after the render that called sync() (and its claim, if any): what
      // it showed and nobody claimed is simply drawn, and every living drawing lives.
      function afterRender(){
        if(queued)return;queued=true;
        const run=()=>{queued=false;if(dead)return;for(const svg of pending)see(svg);pending=[];ensure();};
        if(typeof root.queueMicrotask==='function')root.queueMicrotask(run);else Promise.resolve().then(run);
      }
      // A living drawing that is drawn and has no loop gets one (from rest, or
      // where its running reveal ends); a loop that is no longer allowed (Still,
      // Off, reduced motion, Living drawings Off) stops, and the drawing rests.
      function ensure(){
        if(dead)return;
        const t=now();
        for(const [svg,f] of [...films]){if(svg.isConnected===false){stop(svg);continue;}if(f.loops.length&&!lives(svg))endLoops(f);}
        for(const svg of container.querySelectorAll?.(ART_LIVING)||[]){
          if(!seen.has(svg)||waiting.includes(svg)||!lives(svg))continue;
          const f=films.get(svg);if(f?.loops.length)continue;
          loop(svg,f&&f.until>t?f.until-t:0);
        }
      }
      // The dashboard's first paint: the heading or banner scene draws itself and
      // the rail drawings draw in down the list, 67ms apart. Canvas Harness mounts while
      // its host is still hidden (the stylesheets load first), so drawings that
      // cannot be seen yet wait for the entrance window (data-entrance) and start
      // when they appear; the ResizeObserver brings us back here when they do.
      function entrance(){
        if(container.dataset?.entrance===undefined||reduced()||!pending.length)return;
        waiting=pending;pending=[];settle();
      }
      function settle(){
        const open=container.dataset?.entrance!==undefined&&!reduced(),later=[];let i=0;
        for(const svg of waiting){
          if(svg.isConnected===false)continue;
          const rail=!isScene(svg)&&!!svg.parentNode?.matches?.('.rd-rail-art');
          if(!open||!(isScene(svg)||rail)){see(svg);continue;}
          // Not laid out yet, or its stylesheet has not arrived (section 10 makes art pointer-events:none).
          const styled=(root.getComputedStyle?.(svg)?.pointerEvents??'none')==='none';
          if((!styled||!svg.getClientRects?.().length)&&!hidden()){later.push(svg);continue;}
          see(svg);
          if(isScene(svg))reveal(svg,ART_T.entrance);
          else if(style()==='gentle')reveal(svg,ART_T.rail+ART_T.step*i++,{anywhere:true});
        }
        waiting=later;
      }
      // reveal() claims what its render showed, when the student's pointer made it.
      function claim(element,kind){
        if(dead||reduced()||!pointer()||!pending.length)return;
        const mine=pending.filter(svg=>element===container||element.contains?.(svg));
        pending=pending.filter(svg=>!mine.includes(svg));
        for(const svg of mine){
          seen.add(svg);
          const key=sceneKey(svg),frame=svg.parentNode;
          if(isScene(svg)){
            if(kind==='course')reveal(svg,ART_T.course);
            else if(kind==='workspace'&&!(key&&appeared.has(key)))reveal(svg,ART_T.workspace);
            else if(key)appeared.add(key);
          }else if(frame?.matches?.('.rd-empty-art')&&['course','filter','workspace'].includes(kind)&&style()==='gentle')reveal(svg,ART_T.empty);
        }
        // What it did not reveal (a banner seen before) is drawn and lives from rest.
        ensure();
      }
      // Keyboard entry, resize, a setting: a drawing still being drawn is simply
      // drawn and lives on from rest; a loop that is already running keeps
      // running. Destroy: everything stops and the drawings rest as authored.
      function cancel(){
        const t=now();
        for(const [svg,f] of [...films]){if(dead)stop(svg);else if(f.until>t){endReveal(f);endLoops(f);}}
        for(const svg of waiting)see(svg);waiting=[];
        if(dead){io?.disconnect?.();io=null;pending=[];runs.clear();park();rest(false);freeLoops();return;}
        for(const [svg,f] of films)gate(svg,f);// a resize may have brought more of a panorama into view, or cut more away
        ensure();
      }
      return {sync,claim,cancel,visibility,activity,snapshot(){
        const out={};
        for(const [role,selector] of ART_ROLES){
          const svg=container.querySelector?.(selector),rect=svg?.getBoundingClientRect?.();if(!svg||!inView(rect))continue;
          // Where each living part stands right now, so the ghost lets go from that pose, not from rest.
          const poses=Array.from(svg.querySelectorAll?.('.art-loop')||[]).map(g=>{const cs=root.getComputedStyle?.(g);return cs?[cs.transform,cs.transformOrigin,cs.opacity]:null;});
          out[role]={html:svg.outerHTML,key:attr(svg,'data-rd-key'),rect,poses,wide:wide(svg),cover:covered(svg,rect),course:root.getComputedStyle?.(svg.parentNode)?.getPropertyValue?.('--rd-course')?.trim()||''};
        }
        return out;
      }};
    })();

    // ---- Ghosts: what is leaving lets go where it was ------------------------
    function ghostLayer(){
      const shell=shellOf();if(!shell)return null;
      if(!layer||layer.parentNode!==shell){layer?.remove?.();layer=shell.ownerDocument.createElement('div');layer.className='rd-settle-layer';layer.setAttribute('aria-hidden','true');shell.append(layer);}
      const box=shell.getBoundingClientRect();return {layer,left:box.left+(shell.clientLeft||0),top:box.top+(shell.clientTop||0)};
    }
    function clearGhosts(){for(const entry of ghosts){entry[0].cancel?.();entry[1].remove?.();}ghosts.clear();}
    function ghost(rect,build,{duration=90,easing=LETGO,frames=[{opacity:1},{opacity:0}]}={}){
      const frame=ghostLayer();if(!frame||!inView(rect))return null;
      const node=frame.layer.ownerDocument.createElement('div');node.className='rd-settle-ghost';build(node);
      Object.assign(node.style,{left:`${(rect.left-frame.left).toFixed(1)}px`,top:`${(rect.top-frame.top).toFixed(1)}px`,width:`${Math.ceil(rect.width)}px`});
      frame.layer.append(node);
      const animation=play(node,frames,{duration,easing,fill:'forwards'});
      if(!animation){node.remove();return null;}
      const entry=[animation,node];ghosts.add(entry);
      const done=()=>{ghosts.delete(entry);node.remove();};
      if(animation.finished?.then)animation.finished.then(done,()=>{});else animation.onfinish=done;
      return node;
    }

    // ---- FIRST: a read-only snapshot before the state changes ----------------
    function keyOf(target){
      const at=selector=>!!target?.closest?.(selector);
      // The list's toast (Undo) acts on the list: its pick card leads.
      return at('.rd-course-rail')?'rail':at('.rd-filter-group')?'flt':at('.rd-assignment-list')||at('.rd-toast-dock')?'pick':at('.rd-reader-tabs')?'rtab':at('.t-tabs')?'tabs':null;
    }
    function anchors(){
      const reader=container.querySelector('.rd-reader'),sticky=!!reader&&root.getComputedStyle?.(reader)?.position==='sticky',boxes=new Map();
      const anchor=node=>node.closest?.('.rd-course-rail')||(sticky&&node.closest?.('.rd-reader'))||node.closest?.('.rd-workspace')||null;
      return (node,rect)=>{const a=anchor(node);if(a&&!boxes.has(a))boxes.set(a,a.getBoundingClientRect());const b=a?boxes.get(a):{top:0,left:0};return {top:rect.top-b.top,left:rect.left-b.left};};
    }
    function snapshot(target){
      if(dead||reduced()||!pointer())return null;
      const shell=shellOf();if(!shell)return null;
      const snap={at:now(),target:keyOf(target),geo:{...geo},titles:new Map(),counts:new Map(),rows:new Map(),units:new Map(),art:{},toast:null,course:container.dataset?.courseId,readerId:container.querySelector('.rd-reader')?.dataset?.id};
      // A rail row under the pointer: how its frame (and the chosen row's) looks now, for the pen's draw-in.
      try{snap.frame=frames.before(target);}catch{snap.frame=null;}
      for(const [role,selector] of TITLES){
        const node=container.querySelector(selector),rect=node?.getBoundingClientRect();if(!inView(rect)||clipped(rect))continue;
        const cs=root.getComputedStyle?.(node)||{};
        snap.titles.set(role,{text:node.textContent,html:node.innerHTML,rect,style:{fontFamily:cs.fontFamily,fontSize:cs.fontSize,fontWeight:cs.fontWeight,fontStyle:cs.fontStyle,lineHeight:cs.lineHeight,letterSpacing:cs.letterSpacing,color:cs.color,textTransform:cs.textTransform,display:cs.display==='flex'?'flex':'block',alignItems:cs.alignItems,gap:cs.gap}});
      }
      for(const node of container.querySelectorAll(COUNTS))if(inView(node.getBoundingClientRect()))snap.counts.set(node,node.textContent);
      for(const selector of ['.rd-course-rail','.rd-assignment-list']){
        const box=container.querySelector(selector),top=box?.getBoundingClientRect().top;if(!box)continue;
        for(const child of box.children){const rect=child.getBoundingClientRect();if(selector==='.rd-course-rail'||inView(rect))snap.rows.set(child,rect.top-top);}
      }
      const rel=anchors();
      for(const node of container.querySelectorAll(WATCH)){const rect=node.getBoundingClientRect();if(inView(rect))snap.units.set(node,{text:node.textContent,...rel(node,rect)});}
      // The course art in view (heading, banner): its ghost lets go when the course changes.
      snap.art=art.snapshot();
      const toast=container.querySelector('.rd-toast'),toastRect=toast?.getBoundingClientRect();
      if(toast&&inView(toastRect))snap.toast={html:toast.outerHTML,rect:toastRect};
      return snap;
    }

    // ---- The recipes ---------------------------------------------------------
    // Enter ("settle"): one effect, fill backwards. Opacity fades on --rd-fade
    // while the individual translate property settles on the spring; never
    // transform with composite:'add' (it would add the opacity too).
    function enter(node,{kind='content',delay=0,fade,move=360,rect,list}){
      const px=kind==='fade'?0:rise(kind);
      fade=(fade??(style()==='still'&&kind!=='title'?240:300))+bonus(rect||node.getBoundingClientRect?.());
      if(!px)return play(node,[{opacity:0},{opacity:1}],{duration:fade,delay,easing:FADE,fill:'backwards'},list);
      const total=Math.max(fade,move),f=+(fade/total).toFixed(4),m=+(move/total).toFixed(4);
      const frames=[{offset:0,opacity:0,easing:FADE},{offset:0,translate:`0 ${px}px`,easing:SETTLE},...[{offset:f,opacity:1},{offset:m,translate:'0 0'}].sort((a,b)=>a.offset-b.offset)];
      return play(node,frames,{duration:total,delay,fill:'backwards'},list);
    }
    // Late content fades in once by CSS (rd-fade) when its node is created; inside
    // a unit the wave already sets down, that fade is finished so nothing fades twice.
    function quiet(node){for(const animation of node.getAnimations?.({subtree:true})||[])if(animation.animationName==='rd-fade')animation.finish?.();}
    const flip=(node,dy,list)=>play(node,[{transform:`translateY(${dy.toFixed(1)}px)`},{transform:'none'}],{duration:380,easing:SETTLE},list);
    // A changed title hands over: the old words let go where they stood (90ms)
    // while the same node, with its new text, rises into place.
    // A title that is only there for assistive technology (clipped to 1px while the course name stands beside it
    // as artwork: refresh.css 4.2) takes no entrance; the words it replaces still let go where they stood.
    function roll(node,old,{kind='title',delay=60,move=420,list}){
      const rect=node?.getBoundingClientRect?.();if(!inView(rect))return false;
      if(clipped(rect)){if(old&&old.text.trim())ghost(old.rect,g=>{g.innerHTML=old.html;Object.assign(g.style,old.style);});return true;}
      if(old&&old.text===node.textContent){
        const dy=old.rect.top-rect.top,dx=old.rect.left-rect.left;
        if(Math.abs(dx)<=2&&Math.abs(dy)>2&&Math.abs(dy)<=16)flip(node,dy,list);
        return false;
      }
      if(old&&old.text.trim()&&Math.abs(old.rect.top-rect.top)<=28)ghost(old.rect,g=>{g.innerHTML=old.html;Object.assign(g.style,old.style);});
      enter(node,{kind,delay,fade:300,move,rect,list});
      return true;
    }
    function titles(scope,snap,roles,list){
      for(const [role,selector] of TITLES){
        if(!roles[role])continue;
        const node=scope.querySelector?.(selector)||(scope.matches?.(selector)?scope:null);if(!node)continue;
        roll(node,snap?.titles.get(role),{...roles[role],list});
      }
    }
    // Counts update in place: the new number rises 3px as it appears.
    function counts(snap,delay,skip,list){
      for(const node of container.querySelectorAll(COUNTS)){
        const was=snap?.counts.get(node);if(was===undefined||was===node.textContent)continue;
        if(skip.some(unit=>unit.contains?.(node)))continue;
        if(inView(node.getBoundingClientRect()))enter(node,{kind:'count',delay,fade:260,move:300,list});
      }
    }
    // Classify every visible unit against the snapshot: the same text in the same
    // place stays still; the same text nudged a little follows its own path home
    // (48px in the rail and list, 16px elsewhere); anything else settles in.
    function wave(scope,snap,groups,list,handled=new Set()){
      const rel=anchors(),entered=[];
      for(const [selector,base,cap,kind,move=360] of groups){
        const found=[];
        for(const node of scope.querySelectorAll?.(selector)||[]){
          if(handled.has(node))continue;
          let nested=false;for(let p=node.parentElement;p&&p!==scope;p=p.parentElement)if(handled.has(p)){nested=true;break;}
          if(nested)continue;
          const rect=node.getBoundingClientRect();if(!inView(rect))continue;
          handled.add(node);
          const was=snap?.units.get(node);
          if(was&&was.text===node.textContent){
            const at=rel(node,rect),dy=was.top-at.top,dx=was.left-at.left;
            if(Math.abs(dx)<=2&&Math.abs(dy)<=2)continue;
            if(Math.abs(dx)<=2&&Math.abs(dy)<=(node.closest?.('.rd-course-rail,.rd-assignment-list')?48:16)){flip(node,dy,list);continue;}
          }
          found.push({node,rect});
        }
        found.sort((a,b)=>Math.round(a.rect.left/160)-Math.round(b.rect.left/160)||a.rect.top-b.rect.top);
        found.forEach(({node,rect},i)=>{
          const delay=base+slot(Math.min(i,cap-1));
          enter(node,{kind,delay,move,rect,list});quiet(node);entered.push(node);
          // The list's selection card never arrives before its row.
          if(node.classList?.contains('rd-assignment--selected')&&node.parentElement)play(node.parentElement,[{opacity:0},{opacity:1}],{pseudoElement:'::before',duration:300+bonus(rect),delay,easing:FADE,fill:'backwards'},list);
        });
      }
      return entered;
    }
    function railRows(snap,list){
      const rail=container.querySelector('.rd-course-rail');if(!rail||!snap)return;
      const top=rail.getBoundingClientRect().top;
      for(const row of rail.children){const was=snap.rows.get(row);if(was===undefined)continue;const dy=was-(row.getBoundingClientRect().top-top);if(Math.abs(dy)>.5&&Math.abs(dy)<=GLIDE_PX)flip(row,dy,list);}
    }
    // cap: how far a row may glide home (48px when picking; a returning row and its group head push more).
    function listRows(snap,list,{cap=48,skip=[]}={}){
      const box=container.querySelector('.rd-assignment-list');if(!box||!snap)return 0;
      const top=box.getBoundingClientRect().top;let moved=0;
      for(const row of box.children){if(skip.includes(row))continue;const was=snap.rows.get(row);if(was===undefined)continue;const dy=was-(row.getBoundingClientRect().top-top);if(Math.abs(dy)>.5&&Math.abs(dy)<=cap){flip(row,dy,list);moved++;}}
      return moved;
    }
    // The old course art lets go where it stood (90ms; 120ms when no art follows,
    // going to All courses) while the new drawing draws itself (art.claim).
    function artGhosts(scope,snap){
      for(const [role,selector] of ART_ROLES){
        const old=snap?.art?.[role];if(!old)continue;
        const next=scope.querySelector?.(selector)||container.querySelector?.(selector);
        if(next&&next.getAttribute?.('data-rd-key')===old.key)continue;
        // The ghost is a copy in the settle layer (never a live art node), so it may carry the pose inline.
        const pose=g=>{const parts=g.querySelectorAll?.('.art-loop')||[];(old.poses||[]).forEach((p,i)=>{const n=parts[i];if(!p||!n?.style)return;if(p[0]&&p[0]!=='none'){n.style.transform=p[0];n.style.transformOrigin=p[1];}if(p[2]&&p[2]!=='1')n.style.opacity=p[2];});};
        // It keeps the band's own box (a wide scene is not 2:1). A wide scene's ghost also keeps a soft left end,
        // and where the title block's scrim hid that end it stays hidden: the settle layer is above the page, and
        // the old drawing must not cross the title.
        const band=g=>{if(!g.style)return;g.style.height=`${Math.ceil(old.rect.height)}px`;if(old.wide){const cover=Math.round(old.cover||0);g.style.maskImage=`linear-gradient(to right, transparent ${cover}px, #000 ${cover+ART_GHOST_FADE}px)`;}};
        ghost(old.rect,g=>{g.innerHTML=old.html;g.classList.add('rd-art-ghost');if(old.course)g.style.setProperty?.('--rd-course',old.course);band(g);pose(g);},{duration:next?90:120});
      }
    }

    // Course switch (any workspace): the rail surface is the one mover (place()).
    function course(element,snap,list){
      railRows(snap,list);
      titles(element,snap,{heading:{delay:60},page:{delay:60},materials:{delay:60},reader:{delay:60},work:{kind:'head',delay:50,move:360}},list);
      artGhosts(element,snap);
      const entered=wave(element,snap,[...HEAD,...TOOLS,...LIST,...READER,...DECK],list,new Set(Array.from(element.querySelectorAll?.('.rd-workspace-heading h1,#rd-reader-title')||[])));
      counts(snap,40,entered,list);
    }
    // Workspace tab: the pill leads; the new page's regions are set down in turn.
    function workspace(element,snap,list){
      const regions=[];
      for(const node of element.querySelectorAll?.(REGIONS)||[]){if(regions.some(r=>r.node.contains(node)))continue;const rect=node.getBoundingClientRect();if(inView(rect))regions.push({node,rect});}
      regions.sort((a,b)=>Math.round(a.rect.top/60)-Math.round(b.rect.top/60)||a.rect.left-b.rect.left);
      regions.forEach(({node,rect},i)=>{const head=HEADINGS.test(node.className||'');enter(node,{kind:head?'region':'content',delay:slot(i),move:head?420:360,rect,list});quiet(node);});
    }
    // A new view of the list; the reader follows only if its assignment changed.
    function filter(element,snap,list){
      if(element.matches?.('.rd-assignment')){
        // A row that returns (Undo) or stays: it settles in (with its group head, when that returns too),
        // the rows and heads below glide down from where they were to make room, its counts tick, the toast lets go.
        const head=element.previousElementSibling,returning=head?.classList?.contains('rd-date-group')&&!snap?.rows?.has(head)?head:null;
        // When rows below make room, the returning row waits a beat (90ms), so it never fades in over them.
        const room=listRows(snap,list,{cap:240,skip:[element,returning]})?90:0;
        enter(element,{kind:'row',delay:room,list});if(returning)enter(returning,{kind:'row',delay:room,list});
        counts(snap,40,[element],list);toastOut(snap);return;
      }
      const scope=element.closest?.('.rd-workspace')||element,handled=new Set(),reader=scope.querySelector?.('.rd-reader'),moved=!!reader&&reader.dataset?.id!==snap?.readerId;
      titles(scope,snap,{work:{kind:'head',delay:50,move:360},...(moved?{reader:{delay:60}}:{})},list);
      const week=scope.querySelector?.('.rd-week');
      if(week&&!snap?.units.has(week)&&inView(week.getBoundingClientRect())){handled.add(week);play(week,[{opacity:0},{opacity:1}],{duration:220,easing:FADE,fill:'backwards'},list);}
      for(const title of scope.querySelectorAll?.('.rd-work-heading h2,#rd-reader-title')||[])handled.add(title);
      const entered=wave(scope,snap,[...TOOLS,...LIST,...(moved?READER:[]),...DECK],list,handled);
      counts(snap,40,entered,list);toastOut(snap);
    }
    // Selecting an assignment: the pick card leads (place()); the reader's changed blocks settle in.
    function reader(element,snap,list){
      listRows(snap,list);
      const scope=element.closest?.('.rd-workspace')||element,box=element.closest?.('.rd-reader')||element;
      titles(box,snap,{reader:{delay:60}},list);
      const handled=new Set(Array.from(box.querySelectorAll?.('#rd-reader-title')||[]));
      wave(box,snap,READER.map(([selector,,cap,kind])=>[selector,8,cap,kind]),list,handled);
      wave(scope,snap,DECK,list,handled);
    }
    // The toast leaves like a floating panel (140ms, 4px down to .99) when Undo or a newer change removes it.
    function toastOut(snap){
      if(!snap?.toast||container.querySelector('.rd-toast'))return;
      ghost(snap.toast.rect,g=>{g.innerHTML=snap.toast.html;g.classList.add('rd-toast-ghost');},{duration:140,easing:RELEASE,frames:[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(4px) scale(.99)'}]});
    }

    // data-motion=entering also marks the workspace around a list or reader
    // change, so late content that lands meanwhile does not fade twice (CSS).
    function mark(nodes,value){for(const node of nodes)if(node?.dataset)node.dataset.motion=value;}
    // Keyboard entry, resize, destroy: every running animation stops where it
    // ends (the art is simply drawn, and living drawings live on from rest)
    // and every ghost goes.
    function cancelAll(){
      for(const [element,group] of active){group.cancel();mark([element,...group.scopes],'settled');}
      active.clear();clearGhosts();frames.cancel();art.cancel();
    }
    function track(element,list,scopes=[]){
      const animations=list.filter(Boolean);
      const group={scopes,cancel(){for(const animation of animations)animation.cancel?.();}};
      if(!animations.length){mark([element,...scopes],'settled');return;}
      active.set(element,group);
      const end=a=>a.effect?.getComputedTiming?.().endTime??0;
      const last=animations.reduce((a,b)=>end(b)>end(a)?b:a);
      const settle=()=>{if(active.get(element)===group){active.delete(element);mark([element,...scopes],'settled');}};
      if(last.finished?.then)last.finished.then(settle,()=>{});else last.onfinish=settle;
    }
    // Pointer intent only. Course, filter and reader changes need a fresh
    // snapshot (a stale one means a background render); keyboard, Off and
    // reduced motion settle at once (and their art is simply drawn).
    function reveal(element,{animate=false,kind='workspace',snapshot:snap=null}={}){
      if(!element||dead)return;
      const prior=active.get(element);if(prior){prior.cancel();active.delete(element);mark(prior.scopes,'settled');}
      const needs=kind==='course'||kind==='filter'||kind==='reader';
      if(!animate||reduced()||!pointer()||typeof element.animate!=='function'||(snap&&!fresh(snap))||(needs&&!snap)){element.dataset.motion='settled';return;}
      clearGhosts();
      const around=(kind==='filter'||kind==='reader')&&element.closest?.('.rd-workspace'),scopes=around&&around!==element?[around]:[];
      mark([element,...scopes],'entering');
      const list=[];
      try{
        if(kind==='course')course(element,snap,list);
        else if(kind==='filter')filter(element,snap,list);
        else if(kind==='reader')reader(element,snap,list);
        else if(kind==='section')enter(element,{kind:'section',delay:0,move:340,list});
        else workspace(element,snap,list);
      }catch(error){for(const animation of list)animation?.cancel?.();list.length=0;clearGhosts();}
      track(element,list,scopes);
      // The art film runs beside the UI and never holds up data-motion=settled.
      try{art.claim(element,kind);}catch{}
    }
    // Completed work: the box fills and its tick draws (0-200ms), a line strikes
    // the title (60-320ms), the row lets go (140-310ms) and its gap closes
    // (170-470ms). The row keeps its final frame until the caller re-renders and cancels.
    function leave(element){
      if(!element||dead||reduced()||typeof element.animate!=='function')return null;
      const height=element.getBoundingClientRect?.().height||element.offsetHeight||0;
      active.get(element)?.cancel();element.dataset.motion='leaving';
      const list=[];
      list.push(...ink(element.querySelector?.('.rd-check-off svg'),{delay:0,budget:200}));
      const title=element.querySelector?.('.rd-assignment-title');
      if(title)play(title,[{backgroundSize:'0% 1.5px'},{backgroundSize:'100% 1.5px'}],{duration:260,delay:60,easing:PEN,fill:'both'},list);
      const fade=play(element,[{opacity:1},{opacity:0}],{duration:170,delay:140,easing:RELEASE,fill:'forwards'},list);
      const close=play(element,[{height:`${height}px`},{height:'0px',paddingTop:'0px',paddingBottom:'0px',marginTop:'0px',marginBottom:'0px',borderBottomWidth:'0px'}],{duration:300,delay:170,easing:SETTLE,fill:'forwards'},list);
      // The group's only row takes its head along (the same let-go and close), and a head below that becomes
      // the list's first eases to the first head's top padding, so the re-render that follows moves nothing.
      const head=element.previousElementSibling,after=element.nextElementSibling;
      if(head?.classList?.contains('rd-date-group')&&!after?.classList?.contains('rd-assignment')){
        const tall=head.getBoundingClientRect?.().height||head.offsetHeight||0;
        play(head,[{opacity:1},{opacity:0}],{duration:170,delay:140,easing:RELEASE,fill:'forwards'},list);
        play(head,[{height:`${tall}px`},{height:'0px',paddingTop:'0px',paddingBottom:'0px',marginTop:'0px',marginBottom:'0px'}],{duration:300,delay:170,easing:SETTLE,fill:'forwards'},list);
        const first=root.getComputedStyle?.(head)?.paddingTop,next=after?.classList?.contains('rd-date-group')&&!head.previousElementSibling?root.getComputedStyle?.(after)?.paddingTop:null;
        if(first&&next&&first!==next)play(after,[{paddingTop:next},{paddingTop:first}],{duration:300,delay:170,easing:SETTLE,fill:'forwards'},list);
      }
      // scopes: cancelAll() (keyboard entry, resize, destroy) settles every active group's scopes.
      const group={scopes:[],cancel(){for(const animation of list)animation?.cancel?.();}};active.set(element,group);
      const finished=Promise.all([fade?.finished,close?.finished]).then(()=>true,()=>false);
      return {finished,cancel(){if(active.get(element)===group)active.delete(element);group.cancel();if(element.dataset.motion==='leaving')element.dataset.motion='settled';}};
    }

    // Reduced motion switched on stops every loop (cancelAll); switched off, the
    // next sync lets the living drawings live again, from rest.
    const reduce=()=>{syncTabs(false,true);if(media?.matches)cancelAll();};
    // A hidden page holds every loop where it is; shown again, they go on.
    const onVisibility=()=>art.visibility();
    media?.addEventListener?.('change',reduce);
    root.addEventListener?.('resize',cancelAll);
    root.document?.addEventListener?.('visibilitychange',onVisibility);
    return {syncTabs,snapshot,reveal,leave,place,ink,clearGhosts,cancel:cancelAll,activity:()=>{if(!dead)art.activity();},
      destroy(){dead=true;cancelAll();layer?.remove?.();layer=null;observer?.disconnect();media?.removeEventListener?.('change',reduce);root.removeEventListener?.('resize',cancelAll);root.document?.removeEventListener?.('visibilitychange',onVisibility);}};
  }
  // limits: the budgets the tests pin (every UI duration 420ms or less; the art film is decorative and tracked apart).
  root.ReserveMotion={create,springLinear,penPlan,loopSpec,loopFrames,rigsOf,cycleOf,easings:{glide:GLIDE,settle:SETTLE,fade:FADE,letgo:LETGO,release:RELEASE,pen:PEN,bloom:BLOOM,loop:LOOP_EASE,sine:SINE},slots:SLOTS,
    limits:{slots:SLOTS,rise:RISE,stale:STALE,glidePx:GLIDE_PX,glideRows:GLIDE_ROWS,maxUiMs:420},surfaces:SURFACES.map(({key,host,pseudo})=>({key,host,pseudo})),
    frames:{id:FRAME_ID,timing:FRAME_T,box:FRAME_BOX},
    art:{id:ART_ID,loopId:ART_LOOP_ID,filmFps:FILM_FPS,briskMs:ART_BRISK_MS,idleMs:ART_IDLE_MS,maxN:LOOP_MAX_N,eases:LOOP_EASES,frames:ART_FRAMES,living:ART_LIVING,speed:ART_SPEED,pen:ART_PEN,slice:ART_SLICE,sliceBudget,seenMargin:ART_SEEN_MARGIN,timing:ART_T,scenes:ART_SCENES,railSpread:ART_RAIL_SPREAD,types:LOOP_TYPES}};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.ReserveMotion;
})(globalThis);
