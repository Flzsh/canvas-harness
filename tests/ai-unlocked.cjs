'use strict';
// AI help is locked until its add-on is in and its notice agreed to (features.js). Tests of the AI itself start from
// that agreed state: the AI help add-on installed from the Market, and the saved feature choice the notice writes.
const F=require('../extension/features.js');
const record=Object.freeze({version:1,acceptedAt:'2026-11-09T12:00:00.000Z',notice:1});
const prefs=(base='full')=>F.unlockAI(base,record.acceptedAt);
const packs=()=>({
 'reserve:packs':{'ai-help':{id:'ai-help',name:'AI help',kind:'feature',installedAt:1}},
 'reserve:packs:receipts':{'ai-help':{kind:'feature',order:1,feature:'ai',previous:false,preferences:{before:{present:false},after:{present:false}}}}
});
const storage=(base='full')=>({[F.KEY]:prefs(base),...packs()});
module.exports={record,prefs,packs,storage,KEY:F.KEY};
