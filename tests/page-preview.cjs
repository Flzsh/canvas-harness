// Manual browser fixture: node tests/page-preview.cjs (no Canvas data or permissions).
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),manifest=require('../extension/manifest.json');
const mock=`(()=>{
 const events=new Set(),read=()=>JSON.parse(localStorage.getItem('ch-page-test')||'{"reserve:school":"https://school.instructure.com"}');
 const emit=changes=>events.forEach(fn=>fn(changes,'local'));
 window.addEventListener('storage',event=>{if(event.key!=='ch-page-test')return;const a=JSON.parse(event.oldValue||'{}'),b=JSON.parse(event.newValue||'{}'),changes={};for(const key of new Set([...Object.keys(a),...Object.keys(b)]))if(JSON.stringify(a[key])!==JSON.stringify(b[key]))changes[key]={oldValue:a[key],newValue:b[key]};emit(changes);});
 window.chrome={runtime:{sendMessage:async message=>({ok:true,origin:message.origin}),getManifest:()=>(${JSON.stringify(manifest)}),getURL:p=>'/extension/'+p,reload:()=>{}},storage:{onChanged:{addListener:fn=>events.add(fn),removeListener:fn=>events.delete(fn)},local:{async get(keys){const all=read();if(keys===null)return all;return Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,all[key]]));},async set(values){const all=read(),changes={};for(const [key,value]of Object.entries(values)){changes[key]={oldValue:all[key],newValue:value};all[key]=value;}localStorage.setItem('ch-page-test',JSON.stringify(all));emit(changes);},async remove(key){const all=read();delete all[key];localStorage.setItem('ch-page-test',JSON.stringify(all));emit({[key]:{}});}}},tabs:{async query(){return [{url:'https://school.instructure.com/'}];},async create(details){if(details.url.startsWith('/extension/'))window.open(details.url,'_blank');else console.info('Test Canvas action',details);return details;}},permissions:{async contains(){return true;},async request(){return true;},async remove(){return true;}}};
})();`;
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.woff2':'font/woff2','.txt':'text/plain'};
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/__test__/chrome.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(mock);return;}
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(!file.startsWith(root+path.sep)||!['extension','preview','.codex-refs'].includes(path.relative(root,file).split(path.sep)[0])){res.writeHead(403);res.end();return;}
 fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end();return;}
  if(/extension[\\/](popup|welcome)\.html$|preview[\\/]index\.html$/.test(file))data=data.toString().replace('</head>','<script src="/__test__/chrome.js"></script></head>');
  if(/preview[\\/]demo\.js$/.test(file))data=data.toString().replace("id:'subject-gallery-preview'","id:'1'").replace("createStore({accountId:user.id,origin:location.origin});await store.load();","createStore({accountId:user.id,origin:'https://school.instructure.com'});await store.load();");
  res.writeHead(200,{'Content-Type':(types[path.extname(file)]||'application/octet-stream')+'; charset=utf-8','Cache-Control':'no-store'});res.end(data);});
}).listen(4180,'127.0.0.1',()=>console.log('Page fixtures: http://127.0.0.1:4180/extension/popup.html'));
