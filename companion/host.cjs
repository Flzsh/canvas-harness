#!/usr/bin/env node
'use strict';
// Native invocation has no human-readable stdout, including startup failures.
if(Number(process.versions.node.split('.')[0])<22){process.stderr.write('Canvas Harness AI requires Node.js 22 or newer.\n');process.exit(1);}
const fs=require('node:fs');
const path=require('node:path');
const {Decoder,encode}=require('./lib/protocol.cjs');
const {Store,acquireLock}=require('./lib/storage.cjs');
const {OAuth}=require('./lib/oauth.cjs');
const {Inference}=require('./lib/inference.cjs');
const {Service,HOST}=require('./lib/service.cjs');
const {openBrowser}=require('./lib/process.cjs');
const {fail,publicError}=require('./lib/errors.cjs');
function readConfig(args){
 if(args[0]!=='--config'||!args[1]||!path.isAbsolute(args[1]))throw fail('INVALID_REQUEST','Launch this companion through its installed browser native host.');
 const configPath=path.resolve(args[1]),stat=fs.lstatSync(configPath);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>16384)throw fail('INVALID_REQUEST','Invalid native-host configuration.');
 const config=JSON.parse(fs.readFileSync(configPath,'utf8')),origin=args[2];
 if(config.host!==HOST||config.protocol!==1||!Array.isArray(config.allowedOrigins)||!config.allowedOrigins.length||config.allowedOrigins.length>8||config.allowedOrigins.some(v=>typeof v!=='string'||!/^chrome-extension:\/\/[a-p]{32}\/$/.test(v))||!config.allowedOrigins.includes(origin))throw fail('FORBIDDEN','This extension is not registered for the companion.');
 if(args.slice(3).some(arg=>!/^--parent-window=\d+$/.test(arg)))throw fail('INVALID_REQUEST','Unexpected native-host argument.');
 if(config.dataDir!==path.join(path.dirname(configPath),'data')||!['auto','memory-only'].includes(config.storageMode))throw fail('INVALID_REQUEST','Invalid storage configuration.');
 return config;
}
async function main(args=process.argv.slice(2)){
 if(args.length===1&&args[0]==='--check'){process.stderr.write(`Canvas Harness AI: Node ${process.versions.node}; protocol 1; runtime available. No authorization checked.\n`);return;}
 let service,release,ending=false;const send=value=>{if(ending)return;const frame=encode(value);if(process.stdout.writableLength+frame.length>262144)throw fail('LIMIT_EXCEEDED','The browser is not reading companion replies.');process.stdout.write(frame);};
 const shutdown=async(code=0)=>{if(ending)return;ending=true;process.stdin.pause();await service?.close();await release?.();process.exitCode=code;process.stdout.end(()=>process.exit(code));};
 try{
  const config=readConfig(args);release=await acquireLock(config.dataDir);const store=await Store.open({dir:config.dataDir,...(config.storageMode==='memory-only'?{platform:'memory-only'}:{})});
  const oauth=new OAuth({store,openBrowser});service=new Service({store,oauth,inference:new Inference({oauth}),send});
  const decoder=new Decoder(value=>{service.handle(value).catch(()=>shutdown(1));});
  process.stdin.on('data',chunk=>{try{decoder.push(chunk);}catch(error){send({id:null,type:'error',...publicError(error)});void shutdown(1);}});
  process.stdin.on('end',()=>{try{decoder.end();void shutdown();}catch{void shutdown(1);}});
  process.stdin.on('error',()=>shutdown(1));process.stdout.on('error',()=>shutdown(1));
  process.on('SIGINT',()=>shutdown());process.on('SIGTERM',()=>shutdown());
  process.on('uncaughtException',()=>{process.stderr.write('Companion stopped after an internal error.\n');void shutdown(1);});
  process.on('unhandledRejection',()=>{process.stderr.write('Companion stopped after an internal error.\n');void shutdown(1);});
  process.stdin.resume();
 }catch(error){try{send({id:null,type:'error',...publicError(error)});}catch{}process.stderr.write('Canvas Harness AI could not start. Check its installation and registered extension ID.\n');await shutdown(1);}
}
if(require.main===module)void main();
module.exports={main,readConfig};
