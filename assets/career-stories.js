/* NBA locker-room decisions. The queued scene and its roll belong to the save. */
(function () {
  'use strict';
  const id = 'mbl_room_conversation';
  const hash = (...parts) => window.MBLDevelopment.hash(...parts);
  const lang = text => ({en:text, hans:text, hant:text});
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const topics = {
    rotation: {title:'替补席旁的一张战术板', who:'coach', text:'刚讲完第二阵容的轮换，{actor}把你留了下来：“下次换你上去，你想先做好哪一件事？”',
      choices:['先把球交到空位手里','争取自己终结的机会','先观察一轮换人'], goals:['pass','score']},
    film: {title:'录像停在了弱侧', who:'peer', text:'{actor}把录像倒回了一次：“你看这一拍，我站在底角。再遇到这个回合，我们怎么处理？”',
      choices:['约好找弱侧的传球','商量换防时谁先补位','先听听对方的判断'], goals:['pass','stop']},
    huddle: {title:'散会之后还有人坐着', who:'coach', text:'散会后，{actor}请你帮忙。最近暂停时大家在同时说话，更衣室需要一个能让队友听进去的声音。',
      choices:['带头示范多传一次','把防守责任先担下来','请教练主持下次讨论'], goals:['pass','stop']},
    matchup: {title:'一张画满箭头的对位图', who:'peer', text:'{actor}在你的柜门前比划了一遍：“他们下次再这么夹击，咱们得有个办法。”',
      choices:['练夹击后的分球','练接应后的快速终结','建议先按原战术执行'], goals:['pass','score']}
  };
  const goals = {
    pass:{stat:'ast',label:'助攻',low:2,high:4},
    score:{stat:'pts',label:'得分',low:6,high:12},
    stop:{stat:null,label:'抢断＋盖帽',low:1,high:2}
  };
  function persist(life) {
    return life.flags.mblCareerStories ||= {history:[], recent:[], last:null, follow:null};
  }
  function record(life, text) {
    const s = persist(life);
    s.history.unshift(text);
    s.history.length = Math.min(8, s.history.length);
    window.d(life, lang(text), {}, 'event');
  }
  function weightPick(entries, seed) {
    let roll = (seed / 4294967296) * entries.reduce((n, x) => n + x[1], 0);
    for (const [key, weight] of entries) {
      roll -= weight;
      if (roll < 0) return key;
    }
    return entries.at(-1)[0];
  }
  function suitable(life, season) {
    return life.alive && life.age >= 18 && !life.prisonYears && season?.leagueId === 'NBA' &&
      life.ball.pro?.leagueId === 'NBA' && season.phase === 'regular' && !season.staff &&
      !life.ball.retiredFromPlaying && season.team?.en === life.ball.pro?.team?.en;
  }
  function queue(life, season) {
    if (!suitable(life, season) || life.pending?.length || !window.yR?.has(id)) return false;
    const n = season.games.length;
    const old = life.flags.mblCareerStories;
    if (n < 5 || season.total - n < 3 || old?.follow) return false;
    const roomKey=JSON.stringify([season.year,season.cup??null,season.team.en]);
    if (old?.last?.room === roomKey && n - old.last.game < 13) return false;
    const v = window.MBLTeamRoom.view(life,season);
    if (!v) return false;
    const token = JSON.stringify([v.room.key, n, v.room.coachId]);
    const seed = hash(life.seed, token, 'scene');
    const candidates = [];
    if (v.role <= 2) candidates.push(['rotation',v.trust < 50 ? 7 : 4]);
    if (v.leads || v.voice) candidates.push(['huddle',v.leads ? 7 : 3]);
    const peer = v.peers.length ? v.peers[hash(life.seed,token,'partner') % v.peers.length] : null;
    if (peer) candidates.push(['film',peer.trait === 0 ? 5 : 3],['matchup',peer.affinity >= 55 ? 5 : 3]);
    if (!candidates.length) return false;
    const fresh = candidates.filter(([key]) => !old?.recent?.slice(-2).includes(key));
    const topic = weightPick(fresh.length ? fresh : candidates,seed);
    const spec = topics[topic], coach = spec.who === 'coach';
    const actor = window.MBLCore.hans(coach ? v.coachName : peer.name);
    const previous = old?.memories?.find(m=>m.actorId===(coach?v.room.coachId:peer.key));
    const callback=previous ? (previous.kept?' “上回你答应的事，后来真的做到了。”':' “上回商量的事没做成，这次咱们把目标说清楚。”') : '';
    const ctx = {token,topic,room:v.room.key,actor,actorId:coach ? v.room.coachId : peer.key,
      role:v.role,roleName:v.roleName,game:n,title:spec.title,scene:spec.text.replace('{actor}',actor)+callback,
      roll:hash(life.seed,token,topic,'response') / 4294967296,
      trait:coach ? v.coachTrait : peer.trait};
    const s = persist(life);
    s.last = {room:v.room.key,game:n,token};
    s.recent = [...s.recent.slice(-1),topic];
    life.pending.push({tid:id, params:ctx, pool:'life'});
    return true;
  }
  function relationship(life, v, ctx, delta) {
    if (topics[ctx.topic].who === 'coach') {
      const before = life.ball.trust;
      window.he(life,delta);
      return '教练信任 ' + signed(life.ball.trust - before);
    }
    const old = v.data.bonds[ctx.actorId] ?? 50;
    const next = clamp(old + delta,0,100);
    v.data.bonds[ctx.actorId] = next;
    return '队友默契 ' + signed(next-old);
  }
  function signed(n) { const v = Math.round(n*10)/10; return (v >= 0 ? '+' : '') + v; }
  function sameActor(v, ctx) {
    return v?.room.key === ctx.room && (topics[ctx.topic].who === 'coach' ?
      v.room.coachId === ctx.actorId : v.peers.some(p => p.key === ctx.actorId));
  }
  function choose(life, ctx, index) {
    const s = life.flags.mblCareerStories;
    if (!s || s.last?.token !== ctx.token || s.last.answered || !topics[ctx.topic]) return false;
    s.last.answered = true;
    const season = life.ball.season, v = window.MBLTeamRoom.view(life);
    if (!suitable(life,season) || !sameActor(v,ctx) || season.total-season.games.length<3) {
      record(life,'人员或赛程已经变化，这次谈话结束。'); return false;
    }
    const spec = topics[ctx.topic], coach = spec.who === 'coach';
    s.detail='和'+ctx.actor+'商量“'+spec.choices[index]+'”的事';
    if (index === 2) {
      const delta = ctx.trait === 0 ? 1 : 0;
      record(life,ctx.actor+'听完了你的理由。这次先观察，接下来三场照原安排执行。'+relationship(life,v,ctx,delta)+'。');
      return true;
    }
    const kind = spec.goals[index], goal = goals[kind];
    const affinity = coach ? v.trust : v.data.bonds[ctx.actorId] ?? 50;
    const fit = (coach ? ['stop','pass','score'][ctx.trait] : ['pass','stop','score'][ctx.trait]) === kind;
    const support = clamp(.44 + (affinity-50)/150 + (fit ? .17 : 0) +
      (index === 0 ? .06 : 0) + (v.role>=3 && kind==='score' ? .08 : 0),.15,.81);
    const cautious = ctx.roll >= support, skeptical = ctx.roll >= support+(1-support)*.62;
    const tone = skeptical ? '仍有疑虑，想等场上的表现再下结论' : cautious ? '愿意试一试，先看你能做到什么' : '认同这个办法，答应一起试';
    const delta = skeptical ? -1 : cautious ? 1 : 3;
    const threshold = ctx.role >= 3 ? goal.high : goal.low;
    const target = '单场'+goal.label+'至少 '+threshold;
    s.follow = {room:ctx.room,topic:ctx.topic,actorId:ctx.actorId,actor:ctx.actor,kind,threshold,target,
      start:season.games.length,needed:skeptical ? 2 : 1};
    record(life,ctx.actor+tone+'。'+relationship(life,v,ctx,delta)+'。接下来三场球队比赛，争取 '+s.follow.needed+' 场达到“'+target+'”。');
    return true;
  }
  function close(life, reason) {
    const s=life.flags?.mblCareerStories;
    if (!s?.follow) return;
    const name=s.follow.actor;
    s.follow=null;
    record(life,'与'+name+'的约定结束：'+reason+'。本次不计成败。');
  }
  function afterGame(life,season,game) {
    if (season !== life.ball.season || game !== season.games.at(-1)) return;
    const f=life.flags?.mblCareerStories?.follow;
    if (f) {
      const v=window.MBLTeamRoom.view(life);
      if (!sameActor(v,f)) close(life,'球队或谈话对象已变更');
      else if (season.games.length >= f.start+3) {
        const played=season.games.slice(f.start,f.start+3).filter(g=>g.min>0);
        const stat=goals[f.kind].stat;
        const hits=played.filter(g=>(stat ? g[stat] : (g.stl||0)+(g.blk||0))>=f.threshold).length;
        if (played.length<f.needed && hits<f.needed) close(life,'实际出场机会不足');
        else {
          life.flags.mblCareerStories.follow=null;
          const ok=hits>=f.needed;
          const s=persist(life);
          s.memories=[{actorId:f.actorId,kept:ok},...(s.memories||[]).filter(m=>m.actorId!==f.actorId)].slice(0,12);
          record(life,f.actor+'重新提起了“'+f.target+'”：三场里出场 '+played.length+' 次，达标 '+hits+'/'+f.needed+' 次。'+
            (ok?'这次兑现了承诺。':'这次没有兑现。')+relationship(life,v,f,ok?4:-2)+'。');
        }
      }
    }
    queue(life,season);
  }
  function register() {
    if (!window.yR || window.yR.has(id)) return;
    window.yR.set(id, {kind:'decision',id,ages:[18,100],weight:1,title:lang('{title}'),
      text:lang('{scene}（你目前是{roleName}。）'),
      choices:(_life,p)=>topics[p.topic].choices.map((text,index)=>({key:['share','try','observe'][index],
        text:lang(text),lean:[{patience:1},{bravery:1},{}][index],
        hint:lang(index===2?'保留原安排。':('接下来三场中，用一至两场做到：单场'+goals[topics[p.topic].goals[index]].label+'至少 '+goals[topics[p.topic].goals[index]][p.role>=3?'high':'low']+'。')),
        apply:(life,ctx)=>choose(life,ctx,index)}))});
  }
  function awaiting(life) { return life.pending?.some(item=>item.tid===id); }
  window.MBLCareerStories = {register,afterGame,close,awaiting};
})();
