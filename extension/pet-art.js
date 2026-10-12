/* Canvas Harness companion: the drawing. A small pony in a red harness, drawn as one rigged SVG whose pose is chosen
   by data-pose on its wrapper and moved by the stylesheet (pet.css). No Canvas data is read here. Creator: Flzsh. */
(function(root){
 'use strict';
 // Coats are plain paint: body, shade under the belly, mane and tail, muzzle.
 const COATS={
  oat:{label:'Oat',coat:'#F1DEC0',shade:'#DDC49C',mane:'#C96442',muzzle:'#F6C9B4'},
  chestnut:{label:'Chestnut',coat:'#C98B5E',shade:'#A86E46',mane:'#5A3A28',muzzle:'#E8B796'},
  dapple:{label:'Dapple grey',coat:'#D9DEE2',shade:'#B8C1C9',mane:'#6F7F8C',muzzle:'#EFD5CF'},
  ink:{label:'Ink',coat:'#4A4744',shade:'#33312F',mane:'#1F1E1D',muzzle:'#8A7E77'},
  sage:{label:'Sage',coat:'#C9D4B4',shade:'#A9B890',mane:'#5E7F45',muzzle:'#F0D6C8'},
  rose:{label:'Rose',coat:'#F3D3D0',shade:'#E0B3B0',mane:'#A84A5C',muzzle:'#F8E3DC'}
 };
 const HARNESS={red:'#E2463B',clay:'#D97757',gold:'#E2B865',forest:'#5E7F45',ocean:'#3F8FCC',iris:'#8E63B8'};
 const POSES=['stand','walk','trot','lie','sleep','read','eat','cheer','flag','fall','held'];
 const INK='var(--pet-ink,#141413)';
 const ink=(d,w=2.1,extra='')=>`<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
 const fill=(d,paint,w=2.1,extra='')=>`<path d="${d}" fill="${paint}" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
 const leg=(cls,x,top,foot,bend)=>`<g class="pet-leg ${cls}" style="transform-origin:${x}px ${top}px"><path d="M${x} ${top}C${x+bend} ${top+6} ${foot-bend*.4} ${top+11} ${foot} 57.4" fill="none" stroke="${INK}" stroke-width="4.8" stroke-linecap="round"/><path d="M${x} ${top}C${x+bend} ${top+6} ${foot-bend*.4} ${top+11} ${foot} 57.4" fill="none" stroke="var(--pet-coat)" stroke-width="2.3" stroke-linecap="round"/><path d="M${foot-1.9} 58.6h4.2" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/></g>`;
 function svg({title='Your pony'}={}){
  // 72 x 64 box; the ground is y = 60; the pony faces right. Mirroring is done by the wrapper, never here.
  return `<svg class="pet-svg" viewBox="0 0 72 64" role="img" aria-label="${String(title).replace(/[<>&"]/g,'')}" focusable="false">
<path class="pet-shadow" d="M14 60.6C24 62.6 44 62.6 54 60.4C44 59.2 24 59.2 14 60.6z" fill="${INK}" opacity=".13"/>
<g class="pet-all">
 <g class="pet-up">
  <g class="pet-legs">${leg('lf2',38.6,43,38.2,.8)}${leg('lh2',26.4,43,26.8,-.8)}</g>
  <g class="pet-tuck2"><path d="M40 43.1C44 45.1 48 45.7 52 45.5" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M40 43.1C44 45.1 48 45.7 52 45.5" fill="none" stroke="var(--pet-coat)" stroke-width="2.2" stroke-linecap="round"/></g>
  <g class="pet-tail" style="transform-origin:17px 33px">${fill('M18 31.6C10.4 32.6 7.2 40.6 9.4 50.4C11.6 46.4 14.2 42.6 19.6 38.8z','var(--pet-mane)',2.2)}${ink('M12.4 38.6C11.6 41.4 11.4 44 11.8 46.4',1.1,' opacity=".55"')}</g>
  <g class="pet-body">
   ${fill('M20 30.2C27.6 27 38 27 45 29C49.4 31 50.4 37 47.2 41.2C43 46.4 30 47.2 23 45.2C15.8 43 14 35 20 30.2z','var(--pet-coat)')}
   <path d="M22.6 43.6C29 46 40 45.6 45.6 41.6C42 46 30.4 46.8 23.4 44.9z" fill="var(--pet-shade)"/>
   <path class="pet-blanket" d="M26.6 29.2C30.6 28.2 35 28.2 38.6 29L37.4 36.4C33.6 37.4 30.6 37.2 27.8 36.2z" fill="var(--pet-harness)" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/>
   <path class="pet-blanket" d="M29.4 31.4h6.4M29.8 33.8h5.4" fill="none" stroke="#FFFFFF" stroke-width="1.1" stroke-linecap="round" opacity=".8"/>
  </g>
  <g class="pet-legs">${leg('lf',43,42.6,43.4,.9)}${leg('lh',21.6,42.6,21,-.9)}</g>
  <g class="pet-tuck"><path d="M43.6 43.1C47 45.5 51.4 46.5 56 46.3" fill="none" stroke="${INK}" stroke-width="5.2" stroke-linecap="round"/><path d="M43.6 43.1C47 45.5 51.4 46.5 56 46.3" fill="none" stroke="var(--pet-coat)" stroke-width="2.3" stroke-linecap="round"/><path d="M21 42.9C17.6 44.9 17.2 46.5 21.4 46.9" fill="none" stroke="${INK}" stroke-width="5.2" stroke-linecap="round"/><path d="M21 42.9C17.6 44.9 17.2 46.5 21.4 46.9" fill="none" stroke="var(--pet-coat)" stroke-width="2.3" stroke-linecap="round"/></g>
  <g class="pet-neck" style="transform-origin:45px 33px">
   ${fill('M40.6 31.4C42.4 24.4 46.6 18.6 51 14.6L58 20.4C53.6 24.6 50.6 30.4 48.6 37.6C46 37.4 42.6 35 40.6 31.4z','var(--pet-coat)')}
   <path class="pet-collar" d="M41.6 29.4C44.6 31.4 47.4 34 49.2 36.8" fill="none" stroke="${INK}" stroke-width="6.6" stroke-linecap="round"/><path class="pet-collar" d="M41.6 29.4C44.6 31.4 47.4 34 49.2 36.8" fill="none" stroke="var(--pet-harness)" stroke-width="3.6" stroke-linecap="round"/>
   <circle class="pet-collar" cx="45.6" cy="33" r="1.5" fill="#E2B865" stroke="${INK}" stroke-width=".9"/>
   <g class="pet-head" style="transform-origin:53px 16px">
    ${fill('M50.4 10.6L51.2 3.8L55.4 8.8z','var(--pet-coat)',2)}
    ${fill('M49 12.2C52.6 7.8 61 9.4 63.4 14.4C65.4 18.8 62.2 23.4 57 23.2C51.8 23 46.6 18 49 12.2z','var(--pet-coat)')}
    <path d="M58.6 16.6C61.6 15.2 64.4 16.6 64 19.4C63.4 22 60.4 23.4 57.6 23z" fill="var(--pet-muzzle)"/>
    ${ink('M49 12.2C52.6 7.8 61 9.4 63.4 14.4C65.4 18.8 62.2 23.4 57 23.2C51.8 23 46.6 18 49 12.2z')}
    ${fill('M53.2 9.4L55.2 3.2L58.4 8.6z','var(--pet-coat)',2)}
    <g class="pet-eye"><circle cx="56.2" cy="14.8" r="1.45" fill="${INK}"/><circle cx="56.7" cy="14.3" r=".45" fill="#FFFFFF"/></g>
    <path class="pet-lid" d="M54.4 15.2C55.4 16.2 57 16.2 58 15.2" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>
    <circle cx="62" cy="18.6" r=".8" fill="${INK}"/>
    <path class="pet-smile" d="M58.8 21.2C60 21.8 61.2 21.6 62.2 20.8" fill="none" stroke="${INK}" stroke-width="1" stroke-linecap="round"/>
    ${fill('M51.6 8.4C49 10.4 47.4 13 47.6 16.4C49.8 15 51.6 12.6 52.6 9.6z','var(--pet-mane)',1.8)}
    <g class="pet-flag"><path d="M62.6 20.4L67.6 3.6" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/><path d="M67.6 3.6L71.4 6.6L66.4 9.4z" fill="var(--pet-note,#E2B865)" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/></g>
   </g>
   ${fill('M50.6 12.6C46.6 15.4 43 20.6 41.2 27.6C38.6 24.6 39.4 17.6 43.6 12.8C46 10.2 49.4 9.8 50.6 12.6z','var(--pet-mane)',2.2)}
   ${ink('M44.4 15.4C42.8 18 42 20.8 41.8 23.4',1.1,' opacity=".55"')}
  </g>
 </g>
 <g class="pet-book"><path d="M52 55.6L59 53.6L66 55.6L66 59.4L59 57.6L52 59.4z" fill="#FBF6EA" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M59 53.6V57.6M54 56.6l3.4-.9M61 55.8l3.4.9" fill="none" stroke="${INK}" stroke-width="1" stroke-linecap="round"/></g>
 <g class="pet-oats"><path d="M54 57.4C54 54.6 64 54.6 64 57.4L62.6 60H55.4z" fill="#D4A27F" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M56 55.4c1.4-1.4 4.6-1.4 6 0" fill="none" stroke="#E2B865" stroke-width="1.8" stroke-linecap="round"/></g>
 <g class="pet-zz" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path class="z1" d="M60 40h4l-4 4.4h4"/><path class="z2" d="M65.4 31.4h3l-3 3.4h3"/></g>
 <g class="pet-sparks" fill="#E2B865" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"><path class="s1" d="M10 14l1.6 3.4L15 19l-3.4 1.6L10 24l-1.6-3.4L5 19l3.4-1.6z"/><path class="s2" d="M66 26l1.1 2.3L69.4 29.4L67.1 30.5L66 32.8L64.9 30.5L62.6 29.4L64.9 28.3z"/><path class="s3" d="M30 6l1 2.1L33.1 9.1L31 10.1L30 12.2L29 10.1L26.9 9.1L29 8.1z"/></g>
</g></svg>`;
 }
 const api={COATS,HARNESS,POSES,svg};
 root.ReservePetArt=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
