'use strict';
const {test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process'),{createHash}=require('node:crypto');
const names=['ReserveCustomArt','ReserveCustomKits','ReservePackCommon','ReserveThemePack','ReservePetPack','ReservePresetPack','ReserveMedia','ReserveWorkspaceArrange','ReserveCustomization','ReservePlanner','ReservePetArt','ReservePonyAsk','CanvasHarnessAgentClock','CanvasHarnessPack'],saved=new Map(names.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
after(()=>{for(const [key,d]of saved)if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key];});
const checker=require('../scripts/check-pack.cjs'),bundler=require('../scripts/skill-check.cjs'),fixtureDir=path.join(__dirname,'fixtures/make-your-own'),load=name=>fs.readFileSync(path.join(fixtureDir,name),'utf8');
const temporary=fn=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch-pack-check-'));return Promise.resolve().then(()=>fn(dir)).finally(()=>fs.rmSync(dir,{recursive:true,force:true}));};

test('checker reports OK and writes a self-contained light/dark preview',()=>temporary(async dir=>{
 const file=path.join(dir,'sample.chtheme'),out=path.join(dir,'sample.html');fs.writeFileSync(file,load('02-svg.chtheme'));const lines=[],errors=[];assert.equal(await checker.main([file,'--preview',out],{out:v=>lines.push(v),error:v=>errors.push(v)}),0);assert.equal(lines[0],'OK: theme SVG sample');assert.deepEqual(errors,[]);const html=fs.readFileSync(out,'utf8');for(const text of ['light sample','dark sample','data:image/svg+xml','prefers-reduced-motion','Content-Security-Policy'])assert.ok(html.includes(text),text);assert.doesNotMatch(html,/<(?:script|iframe|object)\b/i);assert.doesNotMatch(html,/(?:src|href)="(?:https?:|file:)/i);
}));

test('every pet pose and fallback appears, with an animation-free still preview',async()=>{
 const result=await checker.validate(load('02-motion.chpet')),html=checker.preview(result);for(const pose of checker.codecs.chpet.poses)assert.match(html,new RegExp('<figcaption>'+pose));assert.ok(html.includes('trot (fallback)'));assert.equal((html.match(/<p>Still<\/p>/g)||[]).length,11);assert.ok(html.includes('data:image/svg+xml'));assert.doesNotMatch(html,/<svg\b/);
});

test('preset previews label actual requested changes without evaluating content',async()=>{
 const value={format:'chpreset',version:1,name:'<script>bad</script>',kind:'planner',data:{days:{mon:[{title:'<img src=x>',minutes:30,at:'19:00'}]}}},html=checker.preview(await checker.validate(JSON.stringify(value)));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;img src=x&gt;'));assert.ok(html.includes('19:00'));assert.ok(html.includes('30 min'));assert.doesNotMatch(html,/<script|<img src=x/);
});

test('CLI prints all independent errors and does not produce a preview for invalid packs',()=>temporary(async dir=>{
 const value=JSON.parse(load('01-colors.chtheme'));value.unexpected=true;value.colors.light.ink='#ffffff';value.colors.dark.muted='#222222';const file=path.join(dir,'bad.chtheme'),out=path.join(dir,'bad.html');fs.writeFileSync(file,JSON.stringify(value));const errors=[];assert.equal(await checker.main([file,'--preview',out],{out:()=>assert.fail('invalid packs have no success output'),error:v=>errors.push(v)}),1);assert.ok(errors.some(v=>v.includes('$.unexpected')));assert.ok(errors.some(v=>v.includes('$.colors.light.ink')));assert.ok(errors.some(v=>v.includes('$.colors.dark.muted')));assert.equal(fs.existsSync(out),false);
}));

test('generated checker runs from a directory containing no repository files or dependencies',()=>temporary(async dir=>{
 const standalone=path.join(dir,'check.cjs'),file=path.join(dir,'sample.chpet'),out=path.join(dir,'preview.html');bundler.bundle(standalone);fs.writeFileSync(file,load('01-static.chpet'));const result=spawnSync(process.execPath,[standalone,file,'--preview',out],{cwd:dir,encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/OK: pet Static pose sample/);assert.ok(fs.readFileSync(out,'utf8').includes('held (fallback)'));assert.equal(fs.existsSync(path.join(dir,'node_modules')),false);
}));

test('standalone checker includes lazy Planner and Biscuit models and all presets',()=>temporary(async dir=>{
 const standalone=path.join(dir,'check.cjs');bundler.bundle(standalone);for(const [kind,data]of [['planner',{days:{mon:[{title:'Review',minutes:30}]}}],['routines',{lines:['every sunday at 7pm plan my week']}],['settings',{pageTint:'sage',pet:{coat:'ink'}}],['layout',{workspaceLayout:{axis:'x',children:['context','work','reader']}}]]){const file=path.join(dir,kind+'.chpreset');fs.writeFileSync(file,JSON.stringify({format:'chpreset',version:1,name:kind,kind,data}));const result=spawnSync(process.execPath,[standalone,file],{cwd:dir,encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,new RegExp('OK: preset '+kind));}
}));

test('standalone checker accepts verified raster media with no browser DOM and states its evidence limit',()=>temporary(async dir=>{
 const standalone=path.join(dir,'check.cjs'),file=path.join(dir,'media.chtheme'),out=path.join(dir,'media.html'),doc=JSON.parse(load('01-colors.chtheme')),bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');doc.assets={photo:{type:'image/png',data:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')}};doc.background={asset:'photo'};bundler.bundle(standalone);fs.writeFileSync(file,JSON.stringify(doc));const result=spawnSync(process.execPath,[standalone,file,'--preview',out],{cwd:dir,encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/OK: theme Color sample/);assert.match(result.stderr,/container metadata|browser playback/i);assert.ok(fs.readFileSync(out,'utf8').includes('data:image/png;base64,'));
}));

test('checker command prevents preview overwrite and detects extension mismatches',()=>temporary(async dir=>{
 const file=path.join(dir,'sample.chtheme'),source=load('01-colors.chtheme');fs.writeFileSync(file,source);const errors=[];assert.equal(await checker.main([file,'--preview',file],{out(){},error:v=>errors.push(v)}),1);assert.equal(fs.readFileSync(file,'utf8'),source);assert.match(errors.join('\n'),/differ/);await assert.rejects(()=>checker.validate(source,{extension:'chpet'}),/extension/);
}));

test('preview refuses hardlinks, symlinks and Windows case aliases before truncating the input',()=>temporary(async dir=>{
 const file=path.join(dir,'source.chtheme'),source=load('01-colors.chtheme'),hardlink=path.join(dir,'alias.html');fs.writeFileSync(file,source);fs.linkSync(file,hardlink);const targets=[hardlink];if(process.platform==='win32')targets.push(path.join(dir,'SOURCE.CHTHEME'));
 const symlink=path.join(dir,'symbolic.html');try{fs.symlinkSync(file,symlink,'file');targets.push(symlink);}catch(error){if(!['EPERM','EACCES','ENOTSUP'].includes(error.code))throw error;}
 for(const target of targets){const errors=[];assert.equal(await checker.main([file,'--preview',target],{out(){},error:v=>errors.push(v)}),1);assert.match(errors.join('\n'),/differ/);assert.equal(fs.readFileSync(file,'utf8'),source);}
}));
