'use strict';
/* Public retains its local Today module; no reference-specific capability retirement. */
function expected(value){if(!value||typeof value!=='object'||Array.isArray(value))return value;const out={...value};for(const key of ['actions','operations','steps','alternatives'])if(Array.isArray(out[key]))out[key]=out[key].map(expected);return out;}
function row(value){return {...value,expected:expected(value.expected)};}
module.exports={expected,row,method:'public-existing-capabilities-v1'};
