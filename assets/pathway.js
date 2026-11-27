/* Career development chapters. Only committed player games supply evidence. */
(function(){
  'use strict';
  const routes={
    pass:{name:'组织串联',keys:['pass','iq'],stat:'ast',unit:'助攻',targets:[4,23,62],program:'t-play',trade:'练组织会占用力量训练。'},
    shoot:{name:'外线投射',keys:['three','mid'],stat:'tpm',unit:'三分命中',targets:[2,9,23],program:'t-shoot',trade:'练投射会占用力量训练。'},
    finish:{name:'两分终结',keys:['layup','dunk'],stat:'two',unit:'两分命中',targets:[4,22,42],program:'t-finish',trade:'练终结会占用三分训练。'},
    steal:{name:'外线防守',keys:['perimeterD','steal'],stat:'stl',unit:'抢断',targets:[2,6,10],program:'t-defense',trade:'练外防会挤占投射训练。'},
    board:{name:'篮板保护',keys:['rebound','strength'],stat:'reb',unit:'篮板',targets:[10,34,75],program:'t-board',trade:'练篮板会占用外线投射训练。'},
    block:{name:'护框协防',keys:['interiorD','block'],stat:'blk',unit:'盖帽',targets:[11,3,5],program:'skill-block',trade:'练盖帽使用现有训练点，受个人潜力上限约束。'}
  };
  const read=l=>l.flags?.mblPathway;
  const create=l=>l.flags.mblPathway||={version:1,serial:0,history:[],wins:{}};
  const eligible=l=>!!(l?.alive&&l.ball.started&&l.age>=12&&!l.ball.retiredFromPlaying&&!l.prisonYears);
  const key=s=>s?JSON.stringify([s.year,s.leagueId,s.team?.en,s.cup??null]):'';
  function season(l){
    const s=l.ball.season;
    return l.ball.pro&&s&&!s.staff&&s.team?.en===l.ball.pro.team?.en?s:null;
  }
  function measure(route,g,band){
    if(!g)return null;
    if(route==='block'&&band===0)return Number.isFinite(g.reb)&&g.reb>=0&&Number.isFinite(g.blk)&&g.blk>=0?{value:g.reb+2*g.blk,attempts:null}:null;
    const stat=routes[route].stat;
    const fields=stat==='two'?['fgm','fga','tpm','tpa']:stat==='tpm'?['tpm','tpa']:[stat];
    if(!fields.every(k=>Number.isFinite(g[k])&&g[k]>=0))return null;
    const value=stat==='two'?g.fgm-g.tpm:g[stat];
    const attempts=stat==='two'?g.fga-g.tpa:stat==='tpm'?g.tpa:null;
    return value>=0&&(attempts===null||attempts>=value)?{value,attempts}:null;
  }
  function choices(l){
    const s=season(l),sample=s?.games?.filter(g=>g.min>0).slice(-5)||[];
    const ids=Object.keys(routes).filter(id=>(!sample.length&&(!s?.games.length||s.leagueId==='NBA'))||sample.some(g=>measure(id,g)));
    const avg=(id,up)=>routes[id].keys.reduce((sum,k)=>sum+(up?Math.max(0,(l.ball.potential[k]||0)-(l.ball.skills[k]||0)):l.ball.skills[k]||0),0)/2;
    function best(pool,up){
      if(!pool.length)return;
      const max=Math.max(...pool.map(id=>avg(id,up)));
      const preferred={playmaker:'pass',shooter:'shoot',stretch:'shoot',scorer:'finish',slasher:'finish',twoway:'steal',bruiser:'board',rim:'block',post:'finish'}[l.ball.mblBuildStyle];
      return pool.filter(id=>max-avg(id,up)<=2).sort((a,b)=>(b===preferred)-(a===preferred)||MBLDevelopment.hash(l.seed,l.age,read(l)?.serial||0,a)-MBLDevelopment.hash(l.seed,l.age,read(l)?.serial||0,b))[0];
    }
    const current=best(ids,false),growth=best(ids.filter(id=>id!==current),true);
    return {ids,current,growth,avg};
  }
  function tier(l,s){
    const played=s.games.filter(g=>g.min>0).slice(-5);
    const mins=window.MBLTeamRoom?.view(l,s)?.planned??(played.reduce((n,g)=>n+g.min,0)/(played.length||1));
    return mins<=16?0:mins<28?1:2;
  }
  function quote(l,id,retry=false){
    const s=season(l),m=read(l);
    if(!eligible(l)||!routes[id]||!choices(l).ids.includes(id)||m?.active)return null;
    if(!s||s.phase!=='regular'||s.total-s.games.length<(retry?4:8)||l.ball.out>0)return null;
    if(m?.lock===key(s)+'/'+s.games.length)return null;
    const prior=m?.history.at(-1);
    if(retry&&(!m?.review||prior?.outcome!=='表现未达标'||prior.retry||prior.route!==id||prior.room!==key(s)))return null;
    const band=retry?prior.band:tier(l,s),advanced=!!m?.wins[id]?.length;
    const target=retry?Math.max(2,Math.ceil(prior.target/2)):Math.ceil(routes[id].targets[band]*(advanced?1.25:1));
    return {room:key(s),year:s.year,route:id,band,target,needed:retry?4:8,positive:retry?2:advanced?3:2,retry,start:s.games.length};
  }
  function start(l,id,retry=false){
    const q=quote(l,id,retry);if(!q)return false;
    if(!read(l)?.direction)choose(l,id);
    const m=create(l);m.direction=id;m.review=false;
    m.active={...q,id:++m.serial,last:q.start,played:0,total:0,hits:0,attempts:0,refs:[]};return true;
  }
  function end(l,reason){
    const m=read(l),a=m?.active;if(!a)return;
    const o=reason||(a.played<a.needed||(['shoot','finish'].includes(a.route)&&a.attempts<a.target)?'机会不足':
      a.total>=a.target&&a.hits>=a.positive?'达标':'表现未达标');
    m.history.push({...a,outcome:o});m.active=null;m.review=!!l.alive&&!l.ball.retiredFromPlaying;
    if(o==='达标'){
      if(!a.retry){const years=m.wins[a.route]||=[];if(!years.includes(a.year))years.push(a.year);}
      if(l.ball.pro?.leagueId==='NBA')m.ticket={room:a.room,route:a.route,band:a.band,goal:Math.ceil(a.target/a.needed)};
    }
  }
  function afterGame(l,s,g){
    if(read(l)&&s===season(l))sync(l);
    const a=read(l)?.active;if(!a||s!==season(l)||s.phase!=='regular'||s.games.at(-1)!==g)return;
    if(key(s)!==a.room){end(l,'换队或赛季中断');return;}
    if(s.games.length<=a.last)return;
    const x=measure(a.route,g,a.band);a.last=s.games.length;
    if(g.min>=4&&x){a.played++;a.total+=x.value;a.attempts+=x.attempts||0;
      if(x.value>0){a.hits++;a.refs.push({n:a.last,value:x.value,us:g.us,them:g.them});a.refs.sort((a,b)=>b.value-a.value||a.n-b.n);a.refs.length=Math.min(3,a.refs.length);}}
    if(a.played===a.needed||a.last-a.start>=2*a.needed||s.games.length>=s.total)end(l);
  }
  function sync(l){
    const m=read(l);if(!m)return false;
    const s=season(l);let changed=false;
    if(m.active&&(!eligible(l)||key(s)!==m.active.room||s.phase!=='regular')){
      end(l,'生涯阶段变更');changed=true;
    }
    if(m.ticket&&(m.ticket.room!==key(s)||s?.phase!=='regular'||!eligible(l))){delete m.ticket;changed=true;}
    if(m.enrolledRoom!==undefined&&l.ball.pro&&!m.firstPro){m.firstPro={age:l.age,team:l.ball.pro.team};changed=true;}
    if(s&&!m.firstAppearance&&s.games.some(g=>g.min>0)&&m.enrolledRoom!==undefined){
      const start=m.enrolledRoom===key(s)?m.enrolledAt:0;
      if(s.games.slice(start).some(g=>g.min>0)){m.firstAppearance={age:l.age,team:s.team};changed=true;}
    }
    if(m.observation&&l.age>m.observation.age&&!m.observation.done){m.observation.done=true;m.observationDue=eligible(l);changed=true;}
    if(m.observationDue&&!eligible(l)){m.observationDue=false;changed=true;}
    if(m.review&&(!l.alive||l.ball.retiredFromPlaying)){m.review=false;changed=true;}
    return changed;
  }
  function enroll(l){
    if(!eligible(l)||read(l)?.enrolledRoom!==undefined)return false;
    const m=create(l),s=season(l);m.enrolledRoom=key(s);m.enrolledAt=s?.games.length||0;
    if(l.ball.pro)m.firstPro={age:l.age,team:l.ball.pro.team,atEnrollment:true};
    return true;
  }
  function choose(l,id){
    if(!eligible(l)||!routes[id]||read(l)?.active)return false;
    enroll(l);const m=create(l);m.direction=id;m.review=false;return true;
  }
  function observe(l,kind){
    if(!eligible(l)||season(l)||!['solo','family','school'].includes(kind))return false;
    if(kind==='family'&&!l.mother?.alive&&!l.father?.alive||kind==='school'&&!l.inSchool)return false;
    const m=create(l);if(m.observation?.age===l.age||m.observationDue)return false;
    m.observation={kind,age:l.age,done:false};return true;
  }
  function training(l,id){
    const m=read(l),r=routes[m?.direction];
    if(r&&!m.firstTraining&&(id===r.program||r.keys.some(k=>id==='skill-'+k)))m.firstTraining={age:l.age,route:m.direction};
  }
  function redeem(l){
    const m=read(l),s=season(l),v=window.MBLTeamRoom.view(l),t=m?.ticket;
    if(!v||!t||t.room!==key(s)||!MBLTeamRoom.act(l,'coach',v.token))return false;
    Object.assign(v.room.promise,{path:t.route,pathBand:t.band,threshold:t.goal,goal:'单场'+unit(t.route,t.band)+'至少 '+t.goal});delete m.ticket;return true;
  }
  function commit(l,fn){
    if(window.MBLCore.life()!==l||!l.alive)return '存档已切换。';
    const prev=JSON.stringify(read(l)??null),rooms=JSON.stringify(l.ball.teamRoom??null);
    if(!fn())return '当前条件已变化，请重新查看。';
    try{Nt.saveLife(l);if(window.MBLAutoSave&&!MBLAutoSave.save())throw Error();return '';}
    catch(_){if(prev==='null')delete l.flags.mblPathway;else l.flags.mblPathway=JSON.parse(prev);
      if(rooms==='null')delete l.ball.teamRoom;else l.ball.teamRoom=JSON.parse(rooms);
      try{Nt.saveLife(l);}catch(_){}return '保存失败，本次操作已撤回。';}
  }
  function abandon(l){
    const m=read(l),a=m?.active;if(!a)return false;
    m.lock=a.room+'/'+a.last;end(l,'主动调整');m.review=false;return true;
  }
  function unit(id,band){return id==='block'&&band===0?'篮板＋盖帽×2':routes[id].unit;}
  window.MBLPathway={routes,unit,read,key,season,eligible,measure,choices,quote,enroll,choose,start,end,afterGame,sync,observe,training,redeem,commit,abandon};
})();
