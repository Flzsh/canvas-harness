#!/usr/bin/env node
'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {run,helperCommand}=require('./lib/process.cjs');
const {HOST}=require('./lib/service.cjs');
function safePath(value){if(typeof value!=='string'||!path.win32.isAbsolute(value)||/[\r\n"%!]/.test(value)||value.startsWith('\\\\'))throw Error('Use an absolute local Windows path without quotes, percent signs or exclamation marks.');return path.win32.normalize(value);}
function buildPlan({extensionIds,nodePath,installDir}){
 if(!Array.isArray(extensionIds)||!extensionIds.length||extensionIds.length>8||extensionIds.some(id=>typeof id!=='string'||!/^[a-p]{32}$/.test(id)))throw Error('Pass the actual 32-letter extension ID (letters a–p only); wildcards and URLs are not accepted.');
 nodePath=safePath(nodePath);installDir=safePath(installDir);if(installDir===path.win32.parse(installDir).root)throw Error('Use a dedicated installation folder, not a filesystem root.');if(path.win32.basename(nodePath).toLowerCase()!=='node.exe')throw Error('NodePath must point to node.exe.');
 const allowedOrigins=[...new Set(extensionIds)].map(id=>`chrome-extension://${id}/`),manifestPath=path.win32.join(installDir,`${HOST}.json`),configPath=path.win32.join(installDir,'host-config.json');
 const config={host:HOST,protocol:1,allowedOrigins,dataDir:path.win32.join(installDir,'data'),storageMode:'auto'};
 const manifest={name:HOST,description:'Canvas Harness optional local ChatGPT companion',path:path.win32.join(installDir,'launch.cmd'),type:'stdio',allowed_origins:allowedOrigins};
 const launcher=`@echo off\r\nset "NODE_OPTIONS="\r\nset "NODE_PATH="\r\nset "NODE_TLS_REJECT_UNAUTHORIZED="\r\n"${nodePath}" "${path.win32.join(installDir,'host.cjs')}" --config "${configPath}" %*\r\n`;
 return {installDir,nodePath,manifestPath,configPath,config,manifest,launcher};
}
async function main(args){
 if(Number(process.versions.node.split('.')[0])<22)throw Error('Node.js 22 or newer is required.');
 const options={extensionIds:[],install:false};
 for(let i=0;i<args.length;i++){const arg=args[i];if(arg==='--install')options.install=true;else if(arg==='--extension-id')options.extensionIds.push(args[++i]);else if(arg==='--node')options.nodePath=args[++i];else if(arg==='--destination')options.installDir=args[++i];else throw Error('Usage: node companion/install.cjs --extension-id ACTUAL_ID --node "C:\\path\\node.exe" [--destination "C:\\path\\CanvasHarnessAI"] [--install]');}
 if(process.platform!=='win32')throw Error('This installer is for Windows. See README.md for manual native-host setup on macOS/Linux.');
 if(!options.nodePath)throw Error('Pass --node with the actual absolute Node.js executable path.');
 options.installDir||=path.join(process.env.LOCALAPPDATA,'CanvasHarnessAI');const plan=buildPlan(options);
 const version=spawnSync(plan.nodePath,['--version'],{shell:false,windowsHide:true,encoding:'utf8',timeout:10000,maxBuffer:4096});
 if(version.status!==0||!/^v(\d+)\./.test(version.stdout)||Number(version.stdout.match(/^v(\d+)\./)[1])<22)throw Error('The supplied executable must be Node.js 22 or newer.');
 if(!options.install){process.stdout.write(JSON.stringify({mode:'preview-only',...plan},null,2)+'\nNo files or registry entries were changed. Add --install when ready.\n');return;}
 if(await fs.lstat(path.join(plan.config.dataDir,'runtime.lock')).then(()=>true,()=>false))throw Error('Close the companion connection before installation. See README.md for stale-lock recovery.');
 const existing=await fs.lstat(plan.installDir).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
 if(existing){if(!existing.isDirectory()||existing.isSymbolicLink())throw Error('The installation path must be a dedicated directory.');const files=await fs.readdir(plan.installDir);if(files.length){let prior;try{prior=JSON.parse(await fs.readFile(plan.configPath,'utf8'));}catch{}if(prior?.host!==HOST)throw Error('Refusing to change an existing folder that is not a Canvas Harness AI installation.');}}
 const ps=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 const input=mode=>JSON.stringify({mode,installDir:plan.installDir,manifestPath:plan.manifestPath,host:HOST});
 await run(ps,['-NoLogo','-NoProfile','-NonInteractive','-Command',helperCommand('register')],input('Prepare'));
 const files=['host.cjs','lib/errors.cjs','lib/http.cjs','lib/inference.cjs','lib/oauth.cjs','lib/process.cjs','lib/protocol.cjs','lib/service.cjs','lib/storage.cjs','windows/secret-storage.ps1','windows/open-browser.ps1','README.md','CONTRACT.md'];
 for(const relative of files){const target=path.join(plan.installDir,relative);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(path.join(__dirname,relative),target);}
 await fs.writeFile(plan.manifestPath,JSON.stringify(plan.manifest,null,2));await fs.writeFile(plan.configPath,JSON.stringify(plan.config,null,2));await fs.writeFile(plan.manifest.path,plan.launcher);
 await run(ps,['-NoLogo','-NoProfile','-NonInteractive','-Command',helperCommand('register')],input('Register'));
 process.stdout.write('Companion installed for the supplied extension ID(s) in Chrome and Edge for this Windows user. No sign-in or inference was performed. Reconnect the extension, then choose Sign in with ChatGPT.\n');
}
if(require.main===module)main(process.argv.slice(2)).catch(error=>{process.stderr.write((error?.message||'Installation failed.')+'\n');process.exitCode=1;});
module.exports={buildPlan};
