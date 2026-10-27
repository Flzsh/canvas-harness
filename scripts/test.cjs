'use strict';
// Runs the suite in one process. Node 23.6+ spells the flag --test-isolation;
// Node 22.8-23.5 only accept --experimental-test-isolation.
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const accepts=flag=>spawnSync(process.execPath,[flag,'--version'],{stdio:'ignore'}).status===0;
const isolation=['--test-isolation=none','--experimental-test-isolation=none'].find(accepts);
if(!isolation){console.error('Node 22.8 or newer is required to run the tests.');process.exit(1);}
const tests=path.resolve(__dirname,'..','tests');
const files=fs.readdirSync(tests).filter(f=>f.endsWith('.test.cjs')).sort().map(f=>path.join('tests',f));
// The fixtures' days and times are written in one school time zone; pin it so a runner in UTC (GitHub CI) or anywhere
// else counts the same days.
const env={...process.env,TZ:'America/New_York'};
const result=spawnSync(process.execPath,['--test',isolation,...process.argv.slice(2),...files],{cwd:path.resolve(__dirname,'..'),stdio:'inherit',env});
if(result.error)console.error(result.error.message);
process.exit(result.status??1);
