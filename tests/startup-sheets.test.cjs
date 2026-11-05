// Every stylesheet the dashboard's own list names is also in the page-start list (startup.js), which content.js uses
// when it is there: a sheet left out of it is never loaded (Make it yours -> More once showed its feature list
// unstyled, with full-size drawings, because addons-panel.css was missing from the page-start list).
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'..','extension');
// the public tree spreads long lines (scripts/readable-lines.cjs): the lists are read joined up
const flat=file=>fs.readFileSync(path.join(dir,file),'utf8').replace(/\n\s*/g,'');
const list=(src,name)=>{
  const at=src.indexOf(name);assert.ok(at>=0,name+' is there');
  const open=src.indexOf('[',at),close=src.indexOf(']',open);
  return src.slice(open+1,close).match(/'[^']+'/g).map(s=>s.slice(1,-1));
};
test('the page-start stylesheet list has every sheet the dashboard names',()=>{
  const start=list(flat('startup.js'),'const allSheets='),dash=list(flat('content.js'),'const allSheets=');
  for(const sheet of dash)assert.ok(start.includes(sheet),`startup.js does not load ${sheet}`);
  assert.ok(start.includes('addons-panel.css'),'the feature list in Make it yours -> More has its styles');
  for(const sheet of start)assert.ok(fs.existsSync(path.join(dir,sheet)),`${sheet} exists`);
});
