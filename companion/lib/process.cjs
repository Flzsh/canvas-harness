'use strict';
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const {fail}=require('./errors.cjs');
function run(executable,args,input,{signal,timeoutMs=15000,limit=262144}={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(executable,args,{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'],signal,env:{SystemRoot:process.env.SystemRoot||'C:\\Windows',WINDIR:process.env.WINDIR||'C:\\Windows',SystemDrive:process.env.SystemDrive,USERPROFILE:process.env.USERPROFILE,TEMP:process.env.TEMP,TMP:process.env.TMP,PATH:process.env.PATH,HOME:process.env.HOME,DISPLAY:process.env.DISPLAY,DBUS_SESSION_BUS_ADDRESS:process.env.DBUS_SESSION_BUS_ADDRESS}});
  const chunks=[];let size=0,settled=false;
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
  const timer=setTimeout(()=>{child.kill();finish(fail('STORAGE','Local secure-storage or browser helper timed out.'));},timeoutMs);
  child.on('error',()=>finish(fail(signal?.aborted?'CANCELLED':'STORAGE',signal?.aborted?'Request cancelled.':'Cannot start the local helper.')));
  child.stdout.on('data',chunk=>{size+=chunk.length;if(size>limit){child.kill();finish(fail('STORAGE','Local helper output exceeded its limit.'));}else chunks.push(chunk);});
  // Never forward subprocess errors: they can contain OAuth URLs or secret material.
  child.stderr.resume();child.stdin.on('error',()=>{});child.on('close',code=>{if(code!==0)finish(fail('STORAGE','The local helper could not finish.'));else finish(null,Buffer.concat(chunks).toString('utf8').trim());});
  child.stdin.end(input);
 });
}
function powershell(){return path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');}
function helperCommand(name){if(!['secret-storage','open-browser','register'].includes(name))throw fail('STORAGE','Unknown local helper.');return fs.readFileSync(path.join(__dirname,`../windows/${name}.ps1`),'utf8');}
async function dpapi(mode,bytes){
 const output=await run(powershell(),['-NoLogo','-NoProfile','-NonInteractive','-Command',helperCommand('secret-storage')],JSON.stringify({mode,data:Buffer.from(bytes).toString('base64')}));
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(output))throw fail('STORAGE','Secure storage returned invalid data.');return Buffer.from(output,'base64');
}
async function openBrowser(url,signal){
 const parsed=new URL(url);if(parsed.origin!=='https://auth.openai.com'||parsed.pathname!=='/api/accounts/authorize')throw fail('AUTH_INVALID','Unexpected sign-in destination.');
 if(process.platform==='win32')await run(powershell(),['-NoLogo','-NoProfile','-NonInteractive','-Command',helperCommand('open-browser')],url,{signal});
 else await run(process.platform==='darwin'?'/usr/bin/open':'/usr/bin/xdg-open',[url],'',{signal});
}
module.exports={run,dpapi,openBrowser,helperCommand};
