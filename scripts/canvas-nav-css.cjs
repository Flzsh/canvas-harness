'use strict';
// The drawn Canvas menu bar (extension/canvas-nav.js) wears the same frames as the course sidebar. Its stylesheet
// carries a copy of refresh.css's frame rules, re-scoped from the workspace (.rd) to Canvas's own menu bar (#header).
// `node scripts/canvas-nav-css.cjs` rewrites that copy; `--check` fails when it is out of date (npm run check).
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),src=path.join(root,'extension','refresh.css'),out=path.join(root,'extension','canvas-nav.css');
const BEGIN='/* ---- frame rules copied from refresh.css by scripts/canvas-nav-css.cjs: do not edit by hand ---- */',END='/* ---- end of copied frame rules ---- */';
const SCOPE='html.chn-nav #header';

function blocks(css){
 css=css.replace(/\/\*[\s\S]*?\*\//g,'');
 const list=[];let depth=0,start=0;
 for(let i=0;i<css.length;i++){if(css[i]==='{')depth++;else if(css[i]==='}'&&--depth===0){list.push(css.slice(start,i+1).trim());start=i+1;}}
 return list;
}
// Only the drawing of a frame: nothing about the sidebar's rows, its dark theme, keyboard state or its own motion settings.
const skip=/rd-rail-|rd-course-rail|data-theme=dark|data-input=keyboard|data-motion-style=off|data-art-rest|data-motion-style=still\]\)/;
function copied(){
 const kept=blocks(fs.readFileSync(src,'utf8')).filter(b=>b.includes('rd-frame')&&!skip.test(b.startsWith('@')?b:b.slice(0,b.indexOf('{'))));
 return kept.map(b=>b
  .replace(/\.rd\[data-motion-style=gentle\]:not\(\[data-living-art=off\]\) /g,SCOPE.replace('html.chn-nav','html.chn-nav:not([data-chn-motion=off])')+' ')
  .replace(/\.rd /g,SCOPE+' ')
  .replace(/\n\s*\n/g,'\n')).join('\n');
}
function build(){
 const css=fs.readFileSync(out,'utf8'),a=css.indexOf(BEGIN),b=css.indexOf(END);
 if(a<0||b<a)throw Error('canvas-nav.css has lost its copied-rules markers');
 return css.slice(0,a+BEGIN.length)+'\n'+copied()+'\n'+css.slice(b);
}
if(require.main===module){
 const next=build();
 if(process.argv.includes('--check')){if(next!==fs.readFileSync(out,'utf8')){console.error('extension/canvas-nav.css is out of date: run node scripts/canvas-nav-css.cjs');process.exit(1);}console.log('canvas-nav.css frame rules match refresh.css.');}
 else{fs.writeFileSync(out,next);console.log('wrote extension/canvas-nav.css');}
}
module.exports={build,copied};
