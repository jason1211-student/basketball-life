/* Private, compact picture snapshots. This module never advances a life. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MBLKeepsakeMemory=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const copy=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
 const pick=(v,keys)=>{const out={};for(const key of keys)if(v?.[key]!==undefined)out[key]=copy(v[key]);return out;};
 const person=v=>v?pick(v,['name','age','alive','ended','sex','metAge','goneAge','gone','years','stage']):null;
 function frame(life){
  const s=pick(life,['v','seed','name','country','born','group','sex','age','alive','urban','city','education','retired','prisonYears','status','traits','difficulty']);
  s.stateKind='keepsake-snapshot';s.log=[];s.pending=[];s.father=person(life.father);s.mother=person(life.mother);s.partner=person(life.partner);s.children=(life.children||[]).map(person);s.coaches=(life.coaches||[]).map(person);s.protege=person(life.protege);
  s.money=pick(life.money,['ownsHome','cash','debt']);s.career=life.career?pick(life.career,['track','level','club']):null;s.flags=pick(life.flags,['fatherIn','motherIn','inLaws','grandkids']);
  s.ball=pick(life.ball,['started','retiredFromPlaying','number','team','height']);s.ball.pro=life.ball.pro?pick(life.ball.pro,['team']):null;s.ball.friends=(life.ball.friends||[]).slice(0,30).map(p=>pick(p,['name','gap']));
  const year=(life.born?.year||2000)+life.age;s.ball.seasons=(life.ball.seasons||[]).filter(q=>q.year>=year-1&&q.year<=year);s.ball.awards=(life.ball.awards||[]).filter(q=>q.age===life.age||q.year>=year-1&&q.year<=year);s.eventCount=life.log?.length??life.eventCount??0;
  // Display facts from 5.0 only. Private playable progress remains the full original snapshot.
  if(life.college)s.college=pick(life.college,['team','country','prestige','boss','fans','year','w','l','titles','ff','apps','pros']);
  if(Array.isArray(life.alumni))s.alumni=life.alumni.slice(-64).map(p=>pick(p,['name','age','st','uni','team','mine','yr','ovr','pot']));
  if(life.academy){s.academy=pick(life.academy,['name','own','prestige','year']);if(life.academy.yl)s.academy.yl=pick(life.academy.yl,['name','tier','year','w','l','titles','ff','promoted']);}
  if(life.media){s.media=pick(life.media,['show','followers','credibility','contacts','stars','scoops','year','episodes','lane','pace','crew','strikes','deal','network']);if(Array.isArray(life.media.shows))s.media.shows=life.media.shows.slice(-32).map(p=>pick(p,['show','subs','start','since','big']));}
  if(life.money?.plan!==undefined)s.money.plan=copy(life.money.plan);
  for(const key of ['debtsSettled','noPayTold'])if(life.flags?.[key]!==undefined)s.flags[key]=copy(life.flags[key]);
  return s;
 }
 function start(life,memberAtBirth){if(memberAtBirth!==true||!life||life.v!==3||life.age!==0)return false;life.mblKeepsake={version:1,fromBirth:true,memberAtBirth:true,seed:life.seed,states:[]};capture(life);return true;}
 function capture(life){const m=life?.mblKeepsake;if(!m||m.version!==1||m.fromBirth!==true||m.memberAtBirth!==true||m.seed!==life.seed||!Array.isArray(m.states)||!Number.isInteger(life.age)||life.age<0||life.age>130)return false;const s=frame(life),i=m.states.findIndex(q=>q.age===s.age);if(i<0)m.states.push(s);else m.states[i]=s;return true;}
 function read(value,seed){
  if(!value||value.version!==1||value.fromBirth!==true||value.memberAtBirth!==true||!Number.isSafeInteger(value.seed)||seed!==undefined&&value.seed!==seed||!Array.isArray(value.states)||!value.states.length||value.states.length>131)throw Error('照片状态档案格式无效');
  let previous=-1;for(const s of value.states){if(!s||s.v!==3||s.seed!==value.seed||s.stateKind!=='keepsake-snapshot'||!s.name||typeof s.country!=='string'||!s.ball||!s.father||!s.mother||!Number.isInteger(s.age)||s.age<=previous||s.age>130||!Number.isInteger(s.eventCount)||s.eventCount<0)throw Error('照片状态档案不连续或人物不匹配');previous=s.age;}
  if(value.states[0].age!==0)throw Error('照片档案未从出生开始');
  // Re-project to the same bounded fields; no arbitrary executable or game data.
  return{version:1,fromBirth:true,memberAtBirth:true,seed:value.seed,states:value.states.map(frame)};
 }
 return{start,capture,read};
});
