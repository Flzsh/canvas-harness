const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {assertion,accessToken,describe}=require('../scripts/store-publish.cjs');
const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
const key={type:'service_account',client_email:'publisher@example.iam.gserviceaccount.com',private_key:privateKey,token_uri:'https://oauth2.googleapis.com/token'};
const part=s=>JSON.parse(Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString());
test('the service account signs a JWT for the Chrome Web Store scope that Google can verify',()=>{
 const jwt=assertion(key,1000),[h,c,s]=jwt.split('.');
 assert.deepEqual(part(h),{alg:'RS256',typ:'JWT'});
 assert.deepEqual(part(c),{iss:key.client_email,scope:'https://www.googleapis.com/auth/chromewebstore',aud:key.token_uri,iat:1000,exp:4600});
 assert.ok(crypto.createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey,Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'),'base64')));
});
test('the token exchange uses the JWT bearer grant and reports a refusal plainly',async()=>{
 let sent;const ok=async(url,init)=>{sent={url,body:String(init.body)};return {ok:true,json:async()=>({access_token:'t0k'})};};
 assert.equal(await accessToken(key,ok),'t0k');assert.equal(sent.url,key.token_uri);assert.match(sent.body,/grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=/);
 await assert.rejects(accessToken(key,async()=>({ok:false,status:400,json:async()=>({error:'invalid_grant',error_description:'Invalid JWT'})})),/Google refused the sign-in \(400\): Invalid JWT/);
});
test('status reads plainly',()=>{
 assert.equal(describe({publishedItemRevisionStatus:{state:'PUBLISHED',distributionChannels:[{crxVersion:'2.28.1',deployPercentage:100}]}}),'published: PUBLISHED v2.28.1 (100%) | submitted: none');
});
