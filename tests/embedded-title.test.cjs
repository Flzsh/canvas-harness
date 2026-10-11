const {test}=require('node:test'),assert=require('node:assert/strict');
const Custom=require('../extension/custom-art.js');
globalThis.ReserveCustomArt=Custom;
const Art=require('../extension/course-art.js'),Model=require('../extension/customization-model.js');
const banner=Custom.importSVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1680 240"><text x="24" y="160" font-size="70">Independent research</text></svg>','research.svg');
const base={id:'research',name:'Independent research',shortName:'Independent research'};
test('a banner with its own title uses the complete supplied art without a second title layer',()=>{
 const course={...base,artPrefs:{bannerArt:banner,titlePlacement:'banner'}};
 assert.equal(Art.titled(course).embedded,true);assert.equal(Art.title(course),'');
 assert.match(Art.titleFrame(course),/rd-title-embedded/);
 assert.doesNotMatch(Art.titleFrame(course),/<svg|<img|<text/);
 assert.match(Art.scene(course,{crop:'wide'}),/ch-custom-banner/);
 assert.equal(course.artPrefs.bannerArt.svg,banner.svg);
});
test('separate lettering remains the default and reappears if the uploaded banner is removed',()=>{
 for(const pref of [{},{bannerArt:banner},{bannerArt:banner,titlePlacement:'separate'},{titlePlacement:'banner'}]){
  const course={...base,artPrefs:pref};assert.notEqual(Art.titled(course).embedded,true);
  assert.match(Art.title(course),/rd-generic-title/);
 }
});
test('title placement survives validated backups and rejects unsupported values',()=>{
 const pref=Model.cleanAppearance({bannerArt:banner,titlePlacement:'banner'});
 assert.equal(pref.titlePlacement,'banner');assert.equal(pref.bannerArt.svg,banner.svg);
 assert.equal(Model.cleanAppearance({}).titlePlacement,undefined);
 for(const bad of [true,null,{},'hidden','<script>'])assert.throws(()=>Model.cleanAppearance({titlePlacement:bad}),/Invalid titlePlacement/);
});
