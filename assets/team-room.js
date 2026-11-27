/* Active NBA squad only. Every match keeps a copy of the agreed rotation. */
(function () {
  'use strict';
  const D=window.MBLDevelopment, C=window.MBLCore;
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const bounded=n=>Math.round(clamp(n,0,100));
  const names=['发展球员','轮换球员','第六人','首发','进攻核心'];
  const minutes=[10,18,25,30,36], touches=[.68,.84,1.04,1.02,1.22];
  const coachTraits=['重视防守','重视分享球','重视终结效率'];
  const ownerTraits=['看重战绩','看重培养球员'];
  const peerTraits=['喜欢一起钻研战术','重视场上互信','愿意带年轻球员'];
  const keyOf=s=>JSON.stringify([s.year,s.cup??null,s.team.en]);
  const textName=n=>C.hans(n);
  function active(l,s=l?.ball?.season){
    return !!(l?.alive && l.ball.pro?.leagueId==='NBA' && !l.ball.retiredFromPlaying &&
      s && s===l.ball.season && !s.staff && s.leagueId==='NBA' && s.team?.en===l.ball.pro.team?.en && s.roster?.length);
  }
  function generatedName(l,team,job){
    return Ed({...l,rng:D.hash(l.seed,team,job)},'NBA');
  }
  function note(room,message){
    room.notes.unshift(message);
    room.notes.length=Math.min(5,room.notes.length);
  }
  function state(l,s) {
    const data=l.ball.teamRoom??={version:1,clubs:{},bonds:{}};
    const id=JSON.stringify([s.leagueId,s.team.en]), key=keyOf(s);
    const room=data.clubs[id]??={ownerName:generatedName(l,s.team.en,'owner'),owner:50,notes:[]};
    if(room.key!==key){
      if(l.flags?.mblCareerStories?.follow && l.flags.mblCareerStories.follow.room!==key) window.MBLCareerStories?.close(l,'原赛季已经结束');
      if(room.promise)note(room,'赛季结束，本期约定到期。');
      room.key=key;room.promise=null;room.trial=0;room.merit=0;room.cooldowns={};
      room.lastGame=s.games.length;room.revision=0;
    }
    const coach=l.ball.headCoach?.team===s.team.en?l.ball.headCoach:l.benches?.by?.[s.team.en];
    const name=coach?.name||room.fallbackCoach||(room.fallbackCoach=generatedName(l,s.team.en,'coach'));
    const coachId=JSON.stringify([s.team.en,name.en,coach?.since??null]);
    if(room.coachId && room.coachId!==coachId){
      if(l.flags?.mblCareerStories?.follow?.actorId===room.coachId) window.MBLCareerStories?.close(l,'原主教练已离开');
      if(room.promise?.kind==='coach')room.promise=null;
      room.trial=0;room.merit=0;delete room.cooldowns.coach;
      note(room,'新教练接手，重新评估轮换。');room.revision++;
    }
    room.coachId=coachId;
    return {data,room,coachName:name,coachTrait:D.hash(l.seed,coachId)%3,ownerTrait:D.hash(l.seed,id,'goal')%2};
  }
  function view(l,s=l?.ball?.season){
    if(!active(l,s))return null;
    const ctx=state(l,s),{room,data}=ctx, pro=l.ball.pro;
    const peers=D.roster(l,s).filter(p=>!p.me).map(p=>{
      const key=p.playerId, affinity=data.bonds[key]??50;
      return {key,name:p.name,pos:p.pos,ovr:p.ovr,age:p.age,affinity,trait:D.hash(l.seed,key,'peer')%3};
    }).sort((a,b)=>b.ovr-a.ovr||String(a.key).localeCompare(String(b.key)));
    const ovr=MBLAttrSys.overall(l.ball.skills,kn(l.ball)),position=kn(l.ball);
    const trust=bounded(l.ball.trust??50), tenure=Math.max(0,(pro.clubYears||0)-1);
    const recent=s.games.slice(-6).filter(g=>Number.isFinite(g.pts)&&g.min>0);
    const impact=recent.reduce((a,g)=>a+(g.pts+.8*(g.ast||0)+.5*(g.reb||0))/Math.max(10,g.min),0);
    const form=recent.length>=3?clamp((impact/recent.length-.7)*6,-4,4):0;
    const grade=ovr+(trust-50)*.12+Math.min(2,tenure)+form+(room.merit||0);
    const rank=1+peers.filter(p=>p.ovr>grade).length;
    const rival=peers.find(p=>p.pos===position);
    const atPosition=1+peers.filter(p=>p.pos===position && p.ovr>grade).length;
    const starts=rank<=5 && atPosition<=(position==='big'?1:2);
    const role=starts?(rank<=2 && ovr>=80 && trust>=54?4:3):rank<=6?2:rank<=8?1:0;
    const affinity=peers.length?peers.reduce((a,p)=>a+p.affinity,0)/peers.length:50;
    const standing=bounded(42+Math.min(18,tenure*4)+(trust-50)*.45+(affinity-50)*.5+form*1.5);
    const incumbent=peers.slice().sort((a,b)=>(b.ovr+Math.min(12,Math.max(0,b.age-22))*.7)-
      (a.ovr+Math.min(12,Math.max(0,a.age-22))*.7))[0];
    const elected=l.flags?.plCaptainOf===s.team.en;
    const leads=elected || (tenure>=2 && standing>=64 && role>=3 && (!incumbent||ovr>=incumbent.ovr-2));
    const co=leads && incumbent && Math.abs(incumbent.ovr-ovr)<=3;
    const voice=standing>=58 && (tenure>0 || s.games.length>=15 && recent.length>=3);
    const leadership=leads?(co?'共同领袖':'球队领袖'):voice?'更衣室骨干':tenure?'普通成员':'新成员';
    const leader=leads?(co?textName(l.name)+'、'+textName(incumbent.name):textName(l.name)):incumbent?textName(incumbent.name):'尚待确定';
    const fit=typeof window.vAe==='function'?vAe(l):1;
    const regularMinutes=clamp(Math.round(minutes[role]*fit)+(room.merit>0?2:0),8,38);
    const planned=Math.min(regularMinutes+(room.trial?3:0),window.MBLLifeCalendar?.cap(l,s)??Infinity);
    return {...ctx,peers,role,rank,rival,ovr,standing,leadership,leader,leads,voice,trust,form,planned,
      usage:touches[role]+(room.trial ? .04 : 0)+clamp((affinity-50)/150,-.08,.08),roleName:names[role],
      token:JSON.stringify([s.team.en,room.key,room.coachId,s.games.length,room.revision,rank,role,trust,standing])};
  }
  function target(kind,trait,role) {
    if(kind==='coach')return ['单场至少 1 次抢断或盖帽','单场至少 '+(role>=3?4:2)+' 次助攻','单场至少 '+(role>=3?14:7)+' 分'][trait];
    return trait?'单场至少出场 '+Math.min(22,minutes[role])+' 分钟':'球队赢球';
  }
  function eligible(l,id) {
    if(l?.ball?.pro?.leagueId!=='NBA'||l.ball.retiredFromPlaying)return true;
    if(!['pl_rotation','pl_captain','pl_feud','bx_lose_run','pl_hazing'].includes(id))return true;
    const v=view(l);
    if(!v)return false;
    if(id==='pl_rotation')return v.role<=2;
    if(id==='pl_hazing')return (l.ball.pro.years||0)<=1;
    if(id==='pl_captain')return v.standing>=58 && v.role>=3;
    return v.leads || v.voice;
  }
  function canAct(l,s,v,kind){
    if(s.phase!=='regular'||l.prisonYears>0||s.games.length>=s.total)return '下个常规赛再谈';
    if((v.room.cooldowns[kind]??0)>s.games.length)return '再过 '+(v.room.cooldowns[kind]-s.games.length)+' 场可谈';
    if(kind==='peer')return '';
    if(v.room.promise)return '先完成当前约定';
    if(s.total-s.games.length<4)return '本季剩余场次不足';
    return '';
  }
  function act(l,kind,token,peerId,practice='film'){
    const s=l?.ball?.season,v=view(l,s);
    if(!v||v.token!==token||!['owner','coach','peer'].includes(kind))return false;
    if(canAct(l,s,v,kind))return false;
    const {room,data}=v, peer=v.peers.find(p=>p.key===peerId);
    if(kind==='peer'&&(!peer||!['film','drill'].includes(practice)))return false;
    if(kind==='peer'){
      const fits=peer.trait===2?(l.ball.pro.years||0)<=2:peer.trait===(practice==='film'?0:1);
      data.bonds[peer.key]=bounded(peer.affinity+(fits?6:3));
      ce(l,fits?3:1);
      const activity=practice==='film'?'一起复盘了挡拆后的第二个传球选择。':'加练了传切，两人交换角色跑了最后一组。';
      note(room,'你和'+textName(peer.name)+activity+' 默契 +'+(fits?6:3)+'。');
    }else{
      const trait=kind==='coach'?v.coachTrait:v.ownerTrait;
      room.promise={kind,trait,role:v.role,goal:target(kind,trait,v.role),seen:0,met:0};
      if(kind==='coach')room.trial=1;
      note(room,kind==='coach'?'教练同意试用，多给你 3 分钟。未来四次出场中两次达标，再谈常规轮换。':'老板与你约定考察接下来四场比赛，其中两场要达标。');
    }
    room.cooldowns[kind]=s.games.length+(kind==='peer'?3:5);
    room.revision++;
    return true;
  }
  function commit(l,kind,token,peerId,practice){
    if(C.life()!==l)return '存档已切换，请重新进入球队页。';
    if(!l.ball.teamRoom)return '球队名单尚未就绪。';
    const before=JSON.stringify(l.ball.teamRoom), chem=l.ball.chem;
    if(!act(l,kind,token,peerId,practice))return '球队情况已变化，请查看当前安排。';
    try{
      Nt.saveLife(l);
      if(window.MBLAutoSave && !MBLAutoSave.save())throw Error('save');
      return '';
    }catch(_){
      l.ball.teamRoom=JSON.parse(before);
      l.ball.chem=chem;
      try{Nt.saveLife(l);}catch(_){}
      return '保存失败，已撤回本次交谈。';
    }
  }
  function afterGame(l,s,game){
    if(!active(l,s)||game!==s.games.at(-1))return;
    const {room}=state(l,s);
    if(room.lastGame>=s.games.length)return;
    room.lastGame=s.games.length;
    const p=room.promise;
    if(!p)return;
    const played=Number.isFinite(game.pts)&&(game.min??1)>0;
    if(p.kind==='owner'||played){
      const met=p.path?(window.MBLPathway?.measure(p.path,game,p.pathBand)?.value??0)>=p.threshold:p.kind==='owner'?(p.trait?game.min>=Math.min(22,minutes[p.role]):game.us>game.them):
        [((game.stl||0)+(game.blk||0))>=1,game.ast>=(p.role>=3?4:2),game.pts>=(p.role>=3?14:7)][p.trait];
      p.seen++;if(met)p.met++;
    }
    if(p.seen>=4){
      const ok=p.met>=2;
      if(p.kind==='coach'){he(l,ok?6:-3);room.merit=clamp(room.merit+(ok?2:-1),-3,4);room.trial=0;}
      else room.owner=bounded(room.owner+(ok?7:-4));
      note(room,(p.kind==='coach'?'教练复盘':'老板复盘')+' · '+p.met+'/4 场达标。'+
        (p.kind==='coach'?(ok?'保留更多轮换机会。':'恢复原轮换安排。'):(ok?'续约时会支持你。':'老板调低了对你的评价。')));
      room.promise=null;
    }else if(s.games.length>=s.total){
      note(room,'常规赛结束，考察场次不足，本次约定取消。');room.promise=null;room.trial=0;
    }
    room.revision++;
  }
  function leave(l){
    const s=l.ball.season;
    if(!active(l,s))return;
    const {room}=state(l,s);
    room.promise=null;room.trial=0;room.merit=0;room.cooldowns={};room.revision++;
    if(l.flags.plCaptainOf===s.team.en)delete l.flags.plCaptainOf;
    window.MBLCareerStories?.close(l,'你已离开原球队');
    if(l.flags?.mblPathway?.active)window.MBLPathway?.end(l,'离开球队');
    if(l.flags?.mblPathway)delete l.flags.mblPathway.ticket;
    note(room,'你已离队，原有轮换安排结束。');
  }
  function onTrade(l,loud){
    const v=view(l);if(!v)return;
    v.room.owner=bounded(v.room.owner-(loud?8:3));
    for(const p of v.peers)v.data.bonds[p.key]=bounded(p.affinity-(loud?4:1));
    note(v.room,loud?'你公开要求交易，老板和队友都听到了消息。':'经纪人已私下向管理层传达你的交易意愿。');
    v.room.revision++;
  }
  function office(l){
    if(!active(l))return 0;
    const {room}=state(l,l.ball.season);return clamp((room.owner-50)/160,-.18,.18);
  }
  window.MBLTeamRoom={view,act,commit,afterGame,leave,onTrade,office,eligible,canAct,target,ownerTraits,coachTraits,peerTraits};
})();
