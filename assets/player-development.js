/* Shared player model for current rosters. Historical snapshots never enter this module. */
(function () {
  'use strict';
  const S = window.MBLAttrSys;
  const {KEYS, FIVE} = S;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
  const finite = Number.isFinite;
  function hash(...parts) {
    const name = JSON.stringify(parts);
    let value = 2166136261;
    for (let i = 0; i < name.length; i++) value = Math.imul(value ^ name.charCodeAt(i), 16777619);
    return value >>> 0;
  }
  const roles = {
    guard: ['playmaker','sharpshooter','slasher','threeD'],
    wing: ['threeD','sharpshooter','slasher','lockdown'],
    big: ['rim','dominator','glass','sharpshooter']
  };
  const physical = new Set(['speed','vertical','speedWithBall']);
  function ageRate(age, key, longevity = false, early = false) {
    const shift = longevity ? 1 : early ? -1 : 0;
    if (age < 5) return 0;
    if (age < 18) return age < 10 ? 3 : 5;
    const peak = (physical.has(key) ? 26 : key === 'iq' ? 34 : key === 'strength' ? 30 : 29) + shift;
    if (age <= 22) return 4.5;
    if (age <= peak) return age <= 25 ? 2.8 : 1.4;
    if (age <= peak + 2) return 0;
    return -Math.min(5.5, (age - peak - 2) * (physical.has(key) ? .85 : key === 'iq' ? .32 : .57));
  }
  // A player's physical peak and technical peak need not fall in the same season.
  function ageOffset(age, key) {
    let offset = 0;
    for (let year = 19; year <= clamp(Math.floor(age), 19, 47); year++)
      offset += ageRate(year, key) * (year < 27 ? .45 : .85);
    return offset;
  }
  function translate(ratings, target, pos) {
    // Preserve strengths and only move enough to reconcile a legacy roster grade.
    let result = {...ratings};
    for (let i = 0; i < 5; i++) {
      const delta = target - S.overall(result, pos);
      if (!delta) break;
      result = Object.fromEntries(KEYS.map(k => [k, clamp(Math.round(result[k] + delta), 0, 99)]));
    }
    return result;
  }
  function buildBias(id,pos) {
    // Model proportions are used only to generate fictional ability profiles.
    const reach=(hash(id,'reach')%7)-3, mass=(hash(id,'mass')%7)-3;
    const height=(hash(id,'height')%9)-4 + (pos==='big'?3:pos==='guard'?-3:0);
    return {block:reach+height,strength:mass,rebound:height*.6+reach*.4,
      speed:-mass*.6-height*.4,vertical:-mass*.5,speedWithBall:-height*.5,three:-reach*.4};
  }
  // Both user-confirmed sessions and NPC practice use the same capped gains,
  // opportunity costs and price curve. This calculation does not mutate a save.
  function drill(ratings,ceiling,gains,loss={}) {
    const after={...ratings}, changes=[];
    const effective=Object.keys(gains).filter(k=>KEYS.includes(k) && ratings[k]<ceiling[k]);
    if(!effective.length)return null;
    const level=Math.max(...effective.map(k=>ratings[k]));
    const cost=level>=94?3:level>=85?2:1;
    for(const key of effective){
      const from=ratings[key],to=Math.min(ceiling[key],from+(from>=85?1:gains[key]));
      after[key]=to;changes.push({key,from,to});
    }
    for(const [key,value] of Object.entries(loss)){
      const from=ratings[key];
      if(from<=25)continue;
      const to=Math.max(25,from-value);
      after[key]=to;changes.push({key,from,to});
    }
    return {cost,changes,after};
  }
  function offseason(ratings,ceiling,id,age,budget) {
    const style=S.STYLES.find(s=>s.id===S.detectStyle(ratings));
    const keys=style?style.keys:KEYS;
    const start=hash(id,'training',age)%keys.length;
    for(let i=0;i<keys.length;i++){
      const key=keys[(start+i)%keys.length];
      const plan=drill(ratings,ceiling,{[key]:2});
      if(plan && plan.cost<=budget)return plan;
    }
    return null;
  }
  function makeRatings(id, pos, target, age, traits) {
    const choices = roles[pos] || roles.wing, style = choices[hash(id, 'style') % choices.length];
    const signature = S.STYLES.find(s => s.id === style).keys;
    const base = S.genNpcRatings(traits || Object.fromEntries(FIVE.map(k => [k,74])),pos);
    const body=traits?{}:buildBias(id,pos);
    for (const k of KEYS) {
      const specialty = traits ? 0 : signature.includes(k) ? 10 : -3;
      base[k] += (body[k]||0) + specialty + hash(id,k) % 11 - 5 + ageOffset(age,k) - ageOffset(26,k);
    }
    return translate(base, target, pos);
  }
  function npc(row, options = {}) {
    const pos = row.pos || 'wing', age = finite(row.age) ? row.age : 24;
    const id = row.playerId || options.id || row.id || JSON.stringify([row.name?.en || row.name,pos,age]);
    const target = clamp(Math.round(finite(row.ovr) ? row.ovr : 65), 0, 99);
    const traits = window.MBLRealRosters?.traits?.[row.name?.en];
    const known = row.ratings && KEYS.every(k => finite(row.ratings[k]));
    const ratings = known ? {...row.ratings} : makeRatings(id,pos,target,age,traits);
    const updated = known && finite(row.modelOvr) && row.modelOvr !== target;
    const actual = updated ? translate(ratings,target,pos) : ratings;
    const ovr = S.overall(actual,pos);
    const changedPot=finite(row.modelPot) && finite(row.pot) ? row.pot-row.modelPot : 0;
    const growth = clamp(finite(row.pot) ? row.pot-target : (27-age)*1.1 + hash(id,'upside')%4,0,22);
    const potential = {};
    for (const k of KEYS) {
      const bonus = Math.max(0,Math.round(growth * (.65 + hash(id,'potential',k)%75/100)));
      potential[k] = clamp(Math.max(actual[k],finite(row.potential?.[k]) ? row.potential[k]+changedPot : actual[k]+bonus),0,99);
    }
    const pot=S.overall(potential,pos);
    return {...row,...S.fiveAxis(actual),id,playerId:id,pos,age,ratings:actual,potential,ovr,modelOvr:ovr,
      pot,modelPot:pot,badges:S.activeBadges(actual,pos),attrVersion:S.ATTR_VERSION};
  }
  const seasonProfiles=new WeakMap();
  function template(life, league, year, t) {
    const age = year-t.born;
    const id = t.playerId || JSON.stringify([t.future?'draft':'catalog',t.name.en,t.born,t.country||'',t.pos]);
    const ovr = t.depthPeak != null ? clamp(Math.round(t.depthPeak +
      (age < 26 ? (age-26)*.95 : -Math.max(0,age-29)*1.15)),30,97) : clamp(qa(t,year,life.seed),30,99);
    const traits=window.MBLRealRosters?.traits?.[t.name.en];
    const peak=clamp(finite(t.peak)?t.peak:ovr,0,99);
    let cache=seasonProfiles.get(life);
    if(!cache||cache.year!==year){cache={year,profiles:new Map()};seasonProfiles.set(life,cache);}
    const key=JSON.stringify([id,t.pos,age,ovr,peak,traits||null]);
    function copy(row){return {...row,name:t.name,at:t.at,real:!t.future&&!t.playerId,ratings:{...row.ratings},potential:{...row.potential},badges:{...row.badges}};}
    const saved=cache.profiles.get(key);
    if(saved)return copy(saved);
    const ratings=makeRatings(id,t.pos,ovr,age,traits);
    const ceiling=makeRatings(id,t.pos,peak,27,traits);
    for(const key of KEYS)ceiling[key]=Math.max(ceiling[key],ratings[key]);
    // The two most recent training years are reflected in the current scouting
    // projection. Computing a past or future season never mutates the current one.
    let trained=ratings;
    for(let y=Math.max(19,age-1);y<=Math.min(age,45);y++){
      const plan=offseason(trained,ceiling,id,y,2);
      if(plan)trained=plan.after;
    }
    const row=npc({name:t.name,pos:t.pos,at:t.at,age,ovr,ratings:trained,potential:ceiling,real:!t.future && !t.playerId},{id});
    cache.profiles.set(key,row);
    return copy(row);
  }
  // A vacant roster slot has a fixed birth cohort and career seed. Reading its
  // profile, advancing the schedule and playing the same opponent consume no life RNG.
  function depth(life,league,team,year,slot) {
    const salt = hash(life.seed,league,team,slot);
    const youth = ['HS','NCAA'].includes(league);
    const tenure = youth ? 4 : 14, phase = (year + salt%tenure) % tenure;
    const age = (youth ? league==='HS' ? 15 : 18 : 20) + phase;
    const born = year-age, id = JSON.stringify(['depth',league,team,slot,born]);
    const seed = hash(life.seed,id), fork = {...life,rng:seed};
    const pos = ['guard','wing','big','guard','wing'][slot%5];
    const name = Ed(fork,league), peak = clamp(Math.round(Pt(league).mean + seed%13 - 8),30,96);
    return {name,pos,born,country:life.country,at:pos==='guard'?'sg':pos==='wing'?'sf':'c',
      playerId:id,depthPeak:peak,peak,depth:true,stints:[],legend:false};
  }
  function fillClub(list,life,league,team,year) {
    const used = new Set(list.map(entry=>entry.player.name.en));
    for (let slot=0;list.length<14 && slot<64;slot++) {
      const p=depth(life,league,team,year,slot);
      if(used.has(p.name.en)) continue;
      used.add(p.name.en);
      list.push({player:p,since:null,mood:null,years:null,pay:null});
    }
    return list;
  }
  function club(life,season,team) {
    return I_(life,season.leagueId,team.en,season.year).map(entry=>template(life,season.leagueId,season.year,entry.player));
  }
  function roster(life,season) {
    const rows=season?.roster;
    if(!rows) return [];
    let catalog;
    rows.forEach((row,index)=>{
      if(row.me) {row.ovr=S.overall(life.ball.skills,kn(life.ball));return;}
      if(row.attrVersion===S.ATTR_VERSION && row.modelOvr===row.ovr && row.playerId) return;
      if(!row.ratings && !row.playerId && typeof window.I_==='function') {
        catalog ??= club(life,season,season.team);
        const matches=catalog.filter(p=>p.name.en===row.name?.en && p.age===row.age && p.pos===row.pos);
        if(matches.length===1){Object.assign(row,matches[0]);return;}
      }
      Object.assign(row,npc(row,{id:JSON.stringify(['roster',season.leagueId,season.team?.en,season.year,index,row.name?.en])}));
    });
    return rows;
  }
  function lineup(players,slots) {
    const pool=players.filter(p=>!p.me && !p.out && !p.rest).sort((a,b)=>b.ovr-a.ovr);
    return slots.map(pos=>{
      if(!pool.length)return null;
      const idx=pool.findIndex(p=>p.pos===pos);
      return pool.splice(idx<0?0:idx,1)[0];
    });
  }
  function advanceNpc(player,previousOvr) {
    const row=npc({...player,ovr:previousOvr,modelOvr:previousOvr});
    const ratings={};
    // Contract, playing time and coach development set the annual target.
    // Allocate that change across attributes according to the same age curve used by the player.
    const means=KEYS.reduce((sum,k)=>sum+ageRate(row.age,k),0)/KEYS.length;
    for(const k of KEYS)ratings[k]=clamp(row.ratings[k]+(ageRate(row.age,k)-means)*.65,0,row.potential[k]);
    const adjusted=translate(ratings,player.ovr,row.pos);
    for(const k of KEYS)adjusted[k]=Math.min(adjusted[k],row.potential[k]);
    const plan=offseason(adjusted,row.potential,row.id,row.age+1,2);
    return npc({...row,ratings:plan?.after||adjusted,modelOvr:player.ovr,ovr:player.ovr});
  }
  function migrate(life) {
    if(!life?.ball)return;
    S.migratePlayerBall(life.ball);
    const s=life.ball.season;
    if(s?.roster)roster(life,s);
    for(const group of [life.gm,life.coaching]){
      if(!group)continue;
      for(const key of ['roster','prospects','board']){
        if(!Array.isArray(group[key]))continue;
        group[key].forEach((p,i)=>{
          if(p?.name && p.pos && finite(p.ovr) && p.attrVersion!==S.ATTR_VERSION)
            Object.assign(p,npc(p,{id:JSON.stringify(['staff',group.leagueId,group.team?.en,group.year,key,i,p.name.en])}));
        });
      }
    }
  }
  // Preserve registration and contracts from the career database, then fill vacancies once per cohort.
  const originalClub = window.I_;
  if(originalClub)window.I_=(life,league,team,year)=>fillClub(originalClub(life,league,team,year),life,league,team,year);
  window.MBLDevelopment={npc,advanceNpc,ageRate,drill,template,depth,fillClub,club,roster,lineup,migrate,hash};
})();
