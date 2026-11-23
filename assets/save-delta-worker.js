/* Versioned exact-entry delta; revision and identity are checked by the caller. */
'use strict';

const KEYS=['mbl.current','mbl.records','mbl.achievements','mbl.countries','mbl.settings','mbl.shared'];
const LIMIT=4*1024*1024;
function fail(message,status=400){throw Object.assign(Error(message),{status});}
function canonical(value){
 if(value?.schema!==1||!value.entries||typeof value.entries!=='object')fail('Invalid snapshot');
 const entries={};for(const k of KEYS){const v=value.entries[k]??null;if(v!==null&&typeof v!=='string')fail('Invalid entry');entries[k]=v;}
 return {schema:1,entries};
}
async function hash(v){const raw=new TextEncoder().encode(JSON.stringify(v));const digest=await crypto.subtle.digest('SHA-256',raw);return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');}
const bytes=v=>new TextEncoder().encode(JSON.stringify(v)).length;
function quotedEnd(raw,start){let i=start+1;for(;i<raw.length;i++){if(raw[i]==='\\')i++;else if(raw[i]==='"')return i+1;}fail('Unterminated JSON string');}
function valueEnd(raw,start){
 if(raw[start]==='"')return quotedEnd(raw,start);
 if(raw[start]!=='['&&raw[start]!=='{'){let i=start;while(i<raw.length&&raw[i]!==','&&raw[i]!=='}')i++;return i;}
 let depth=0;for(let i=start;i<raw.length;i++){const c=raw[i];if(c==='"'){i=quotedEnd(raw,i)-1;continue;}if(c==='['||c==='{')depth++;else if(c===']'||c==='}')if(--depth===0)return i+1;}fail('Unterminated JSON value');
}
function logParts(raw){
 if(typeof raw!=='string')return null;
 const parsed=JSON.parse(raw);if(!parsed||Array.isArray(parsed)||!Array.isArray(parsed.log))return null;
 let i=raw.indexOf('{')+1,found=null;
 const whitespace=()=>{while(/\s/.test(raw[i]||'')&&i<raw.length)i++;};
 while(i<raw.length){whitespace();if(raw[i]==='}')break;const end=quotedEnd(raw,i),key=JSON.parse(raw.slice(i,end));i=end;whitespace();i++;whitespace();const start=i;i=valueEnd(raw,start);
  if(key==='log'){if(found||raw[start]!=='[')return null;found={head:raw.slice(0,start+1),log:raw.slice(start+1,i-1),tail:raw.slice(i-1)};}
  whitespace();if(raw[i]===',')i++;else if(raw[i]!=='}')fail('Invalid object separator');
 }
 return found;
}
function splice(before,after){let prefix=0,suffix=0;while(prefix<before.length&&prefix<after.length&&before[prefix]===after[prefix])prefix++;while(suffix<before.length-prefix&&suffix<after.length-prefix&&before[before.length-1-suffix]===after[after.length-1-suffix])suffix++;return {prefix,suffix,insert:after.slice(prefix,after.length-suffix)};}
async function build(previous,next,expectedRevision){
 const a=canonical(previous),b=canonical(next);if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1)return null;
 // Finished careers use the existing full-save path with their complete story/outbox.
 if(a.entries['mbl.records']!==b.entries['mbl.records'])return null;
 const changes={};
 for(const k of KEYS){if(a.entries[k]===b.entries[k])continue;let change={kind:'replace',value:b.entries[k]};
  if(k==='mbl.current'&&a.entries[k]&&b.entries[k]){try{const x=logParts(a.entries[k]),y=logParts(b.entries[k]);if(x&&y){const span={kind:'log-span',head:y.head,tail:y.tail,...splice(x.log,y.log)};if(bytes(span)<bytes(change))change=span;}}catch{/* Full replacement is valid for unsupported log layouts. */}}
  changes[k]=change;
 }
 if(!Object.keys(changes).length)return null;
 const delta={protocol:'delta-v1',expectedRevision,baseHash:await hash(a),resultHash:await hash(b),changes};
 return bytes(delta)<bytes({expectedRevision,payload:b,archiveMode:'lazy-v1'})?delta:null;
}
async function apply(previous,delta,maxBytes=LIMIT){
 const base=canonical(previous);
 if(delta?.protocol!=='delta-v1'||!Number.isSafeInteger(delta.expectedRevision)||delta.expectedRevision<1||!delta.changes||typeof delta.changes!=='object'||Array.isArray(delta.changes))fail('Invalid delta');
 if(bytes(delta)>5*1024*1024)fail('Delta too large',413);
 if(await hash(base)!==delta.baseHash)fail('Delta base changed',409);
 const entries={...base.entries};
 for(const[k,c]of Object.entries(delta.changes)){
  if(!KEYS.includes(k)||k==='mbl.records'||!c||typeof c!=='object')fail('Unsupported delta key');
  if(c.kind==='replace'){if(c.value!==null&&typeof c.value!=='string')fail('Invalid replacement');entries[k]=c.value;}
  else if(c.kind==='log-span'&&k==='mbl.current'){
   if(!Number.isSafeInteger(c.prefix)||!Number.isSafeInteger(c.suffix)||c.prefix<0||c.suffix<0||typeof c.insert!=='string'||typeof c.head!=='string'||typeof c.tail!=='string')fail('Invalid span');
   const parts=logParts(entries[k]);if(!parts||c.prefix+c.suffix>parts.log.length)fail('Span outside confirmed log');
   const length=c.head.length+c.prefix+c.insert.length+c.suffix+c.tail.length;if(length>maxBytes)fail('Reconstructed life too large',413);
   entries[k]=c.head+parts.log.slice(0,c.prefix)+c.insert+parts.log.slice(parts.log.length-c.suffix)+c.tail;
  }else fail('Unsupported change');
 }
 const result={schema:1,entries};if(bytes(result)>maxBytes)fail('Snapshot too large',413);if(await hash(result)!==delta.resultHash)fail('Delta result mismatch');
 return result;
}
self.onmessage=async function(event){const message=event.data;if(!message||message.type!=='build'||!Number.isSafeInteger(message.id))return;try{const delta=await build(message.previous,message.next,message.revision);self.postMessage({id:message.id,delta});}catch(_){self.postMessage({id:message.id,delta:null});}};
