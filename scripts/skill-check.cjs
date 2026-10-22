'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function bundle(destination){
 const files=['scripts/check-pack.cjs',...['site','core','custom-art','custom-kits','pack-common','theme-pack','pet-pack','preset-pack','quick-pack','media-reference','media-store','workspace-arrange','workspace-gestures','customization-model','planner-model','pet-art','agent-clock','pony-ask'].map(name=>'extension/'+name+'.js')],sources={};
 for(const file of files)sources['/'+file]=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
 const output="'use strict';\n/* Standalone Canvas Harness checker. Generated from the extension validators; Node builtins only. */\nconst nativeRequire=require,p=require('node:path').posix,builtins=new Set(require('node:module').builtinModules.map(v=>v.replace(/^node:/,''))),sources="+JSON.stringify(sources)+",cache=new Map();\nfunction load(id){if(cache.has(id))return cache.get(id).exports;if(!Object.hasOwn(sources,id))throw Error('Missing bundled module '+id);const m={exports:{}};cache.set(id,m);const local=key=>{if(!key.startsWith('.')){if(!builtins.has(key.replace(/^node:/,'')))throw Error('Only Node builtins are available');return nativeRequire(key);}return load(p.resolve(p.dirname(id),key));};new Function('module','exports','require','__filename','__dirname',sources[id])(m,m.exports,local,id,p.dirname(id));return m.exports;}\nconst checker=load('/scripts/check-pack.cjs');module.exports=checker;if(require.main===module)checker.main().then(code=>{process.exitCode=code;},error=>{console.error(error.message);process.exitCode=1;});\n";
 if(destination){fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,output,'utf8');}return output;
}
async function main(argv=process.argv.slice(2)){
 if(!argv.length){const target=path.join(root,'dist/skill-check/check.cjs');bundle(target);console.log('Checker: '+target);return 0;}
 if(argv[0]==='--bundle'){if(argv.length!==2){console.error('Usage: node scripts/skill-check.cjs --bundle <check.cjs>');return 2;}bundle(path.resolve(argv[1]));console.log('Checker: '+path.resolve(argv[1]));return 0;}
 return require('./check-pack.cjs').main(argv);
}
module.exports={bundle,main};if(require.main===module)main().then(code=>{process.exitCode=code;},error=>{console.error(error.message);process.exitCode=1;});
