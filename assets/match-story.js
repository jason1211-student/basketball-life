/* Match evidence shared by pregame, the live feed and the final report. */
(function () {
  'use strict';
  const C=window.MBLCore,h=C.h;
  const plans={coach:'沿用教练安排',spacing:'拉开空间',post:'低位进攻',motion:'传切配合'};
  const period=q=>q>4?'加时 '+(q-4):'第 '+q+' 节';
  const other=side=>side==='home'?'away':'home';
  const gameId=g=>g?.matchRecord?JSON.stringify([g.matchRecord.year,g.matchRecord.seed,g.matchRecord.mySide,g.digest??null]):null;
  const model=l=>l?.flags?.mblMatchStory;
  function save(l,update){
    if(!l||C.life()!==l)return false;
    const previous=model(l);
    l.flags.mblMatchStory=update({...previous});
    try{Nt.saveLife(l);if(window.MBLAutoSave&&!MBLAutoSave.save())throw Error();return true;}
    catch(_){if(previous)l.flags.mblMatchStory=previous;else delete l.flags.mblMatchStory;
      try{Nt.saveLife(l);}catch(_){}return false;}
  }
  function planFor(l,seed){
    const focus=model(l)?.focus;
    return focus?.seed===seed&&Object.hasOwn(plans,focus.id)?focus.id:'coach';
  }
  function applyPlan(l,seed,context,side){
    const id=planFor(l,seed);
    if(id!=='coach')context.plans[side].offense2=id;
  }
  function preview(l,s,mu){
    const section=h('section','mbl-scout'),mine=mu[mu.mySide].players,opponents=mu[other(mu.mySide)].players;
    const me=mine.find(p=>p.id==='me');
    section.append(h('h3','','赛前观察'));
    const threat=opponents.slice(0,5).filter(p=>p.pos===me?.pos).sort((a,b)=>b.ovr-a.ovr)[0]||opponents.slice(0,5).sort((a,b)=>b.ovr-a.ovr)[0];
    if(threat){
      const skills=[['three','外线投射'],['pass','组织传球'],['layup','篮下终结'],['block','护框']].filter(([k])=>Number.isFinite(threat.ratings?.[k])).sort(([a],[b])=>threat.ratings[b]-threat.ratings[a]);
      const strength=skills[0];
      section.append(h('p','',(me&&me.pos===threat.pos?'预计同位置对手':'对手首发观察')+' · '+C.hans(threat.name)+(strength?' · '+strength[1]+' '+Math.round(threat.ratings[strength[0]]):'')));
    }
    if(!me)section.append(h('p','','你未进入这场比赛的预计阵容。'));
    if(mu.model!==4||mu.gameIndex!==s.games.length||!me)return section;
    section.append(h('p','','本场可以向教练建议一套备用进攻。拉开空间会增加外围出手，低位进攻侧重内线，传切配合鼓励分球。'));
    const buttons=h('div','mbl-scout-options'),status=h('p','');status.setAttribute('role','status');
    const sync=()=>{for(const b of buttons.children)b.setAttribute('aria-pressed',String(b.value===planFor(l,mu.seed)));};
    for(const [id,label] of Object.entries(plans)){
      const b=h('button','mbl-rel-btn',label);b.type='button';b.value=id;
      b.onclick=()=>{
        const current=window.MBLBroadcast._buildReal();
        if(C.life()!==l||l.ball.season!==s||current?.seed!==mu.seed||!current[current.mySide].players.some(p=>p.id==='me')){status.textContent='赛程或出勤已变化，请重新查看。';return;}
        if(!save(l,m=>({...m,focus:{seed:mu.seed,id}}))){status.textContent='保存失败，可重试。';return;}
        sync();status.textContent='本场已记录 · '+label;
      };buttons.append(b);
    }
    sync();section.append(buttons,status);return section;
  }
  function tracker(){return {home:0,away:0,leader:'',changes:0,side:'',run:0,best:null,late:null,rotation:null};}
  function step(t,e){
    if(e.kind==='sub'&&(!t.rotation||e.q>=4&&t.rotation.q<4))t.rotation=e;
    if(!(e.points>0)||!['home','away'].includes(e.side))return '';
    const before=t.home-t.away;t[e.side]+=e.points;
    const margin=t.home-t.away,leader=margin>0?'home':margin<0?'away':'';
    const flip=!!(leader&&t.leader&&leader!==t.leader);
    if(flip)t.changes++;
    if(leader)t.leader=leader;
    t.run=t.side===e.side?t.run+e.points:e.points;t.side=e.side;
    const mark={q:e.q,clock:e.clock,home:t.home,away:t.away,side:e.side,text:e.text,run:t.run};
    if(!t.best||mark.run>t.best.run)t.best=mark;
    const late=e.q>=4&&e.clock<=120&&Math.min(Math.abs(before),Math.abs(margin))<=5;
    const tag=flip?'反超':margin===0?'追平':!before&&leader?'取得领先':'';
    if(late&&tag)t.late={...mark,tag};
    if(late&&tag)return tag;
    if(t.run>=8&&t.run-e.points<8)return '连续得到 '+t.run+' 分';
    return '';
  }
  function analyze(events){const t=tracker();for(const e of events)step(t,e);return t;}
  function locate(l,g){
    const id=gameId(g);if(!id||!l)return null;
    const current=l.ball.season;
    function inList(games,playoffs,regularSeason){
      if(!games?.length)return null;
      const i=games.findIndex(x=>x===g||gameId(x)===id);
      if(i<0)return null;
      const wins=games.slice(0,i+1).filter(x=>x.us>x.them).length;
      return {line:(playoffs?'本轮打完此场':'本赛季打完此场')+' · '+wins+' 胜 '+(i+1-wins)+' 负',
        recent:regularSeason&&i===games.length-1, i};
    }
    if(current){
      const round=current.activePlayoffSeries;
      let result=inList(round?.games,true,current.phase==='playoffs');if(result)return result;
      const rounds=current.series||[];
      for(const [i,r] of rounds.entries()){result=inList(r.games,true,!round?.games?.length&&i===rounds.length-1&&current.phase==='playoffs');if(result)return result;}
      result=inList(current.games,false,current.phase==='regular');if(result)return result;
    }
    for(const s of l.ball.seasons||[]){
      const regular=inList(s.gameLog,false,false);if(regular)return regular;
      const postseason=inList(s.playoffGameLog,true,false);
      if(postseason)return {...postseason,line:postseason.line.replace('本轮','本季季后赛')};
    }
    return null;
  }
  function at(e){return period(e.q)+' '+MBLArenaMatch.clock(e.clock);}
  function moments(result){
    const t=analyze(result.events),box=h('div','mbl-match-moments');
    box.append(h('p','','主客队共互换领先 '+t.changes+' 次。'));
    const rows=[[t.best,'最长连续得分'],[t.late,'末段关键球']];
    for(const [mark,label] of rows){if(!mark)continue;
      box.append(h('p','',label+' · '+at(mark)+' · '+mark.home+'–'+mark.away+'（主–客）'),
        h('p','mbl-match-quote',(label==='最长连续得分'?(mark.side==='home'?'主队':'客队')+'连续得到 '+mark.run+' 分。':'')+mark.text));
    }
    if(result.quarters?.length){
      const grid=h('div','mbl-story-periods');grid.setAttribute('aria-label','各节得分，主队在前');
      for(const [i,q] of result.quarters.entries()){const item=h('span','');item.append(h('small','',period(i+1)),h('b','',q.home+'–'+q.away));grid.append(item);}
      box.prepend(grid);
    }
    if(t.rotation)box.append(h('p','','教练换人 · '+at(t.rotation)+' · '+t.rotation.text));
    return box;
  }
  function tactics(result,record){
    const side=record.mySide,id=record.context?.plans?.[side]?.offense2;
    if(!Object.hasOwn(plans,id)||id==='coach')return null;
    const shots=result.events.filter(e=>e.side===side&&e.offense===id&&(e.kind==='make'||e.kind==='miss'));
    const perimeter=shots.filter(e=>e.zone==='three').length,paint=shots.filter(e=>e.zone==='rim').length;
    return h('p','','备用战术 · '+plans[id]+'。这套配合留下 '+shots.length+' 次出手记录，其中三分 '+perimeter+' 次、篮下 '+paint+' 次。');
  }
  function interview(box,l,g,where){
    const id=gameId(g),reply=model(l)?.answers?.[id];
    if(!reply&&(!where?.recent||!(g.min>0)))return;
    const won=g.us>g.them;
    const tookPart=g.min>0,assist=g.ast??0;
    const answers=assist>=5?['谈组织','我想再看一遍队友是怎样跑出接球空间的。']:g.min<=16?['谈轮换','我在场上的时间有限，得把每次机会处理好。']:['谈自己的表现','我想从自己这场的处理球开始复盘。'];
    const responses={team:['谈球队',won?'我们一起守住了这场胜利。下一场还得从第一节做起。':'先看看对手在哪段时间拉开了分差，再一起想怎么应对。'],own:answers};
    const ledger=model(l)?.answers||{};
    const games=l?.ball?.season?.games||[],prev=where?.i>0&&games[where.i]&&gameId(games[where.i])===id?ledger[gameId(games[where.i-1])]:null;
    const side=g.matchRecord.mySide,them=g.box?.[other(side)]?.rows||[];
    const scorer=them.reduce((best,r)=>Number.isFinite(r.s?.[1])&&(!best||r.s[1]>best.s[1])?r:best,null);
    if(scorer&&scorer.s[1]>=25)responses.opponent=['谈对手','要回看'+scorer.n+'的得分回合，看看防守在哪一步可以早一点到位。'];
    if(g.tpm>=3)responses.own=['谈外线手感','今晚我命中了 '+g.tpm+' 记三分，想看看哪些是靠跑动创造的机会。'];
    else if(g.reb>=10)responses.own=['谈争抢篮板','我抢下了 '+g.reb+' 个篮板，想回看队友帮我卡位的那些回合。'];
    const question=g.overtime?'记者：打了 '+g.overtime+' 次加时才分出胜负，你最想回看哪个环节？':Math.abs(g.us-g.them)<=3?'记者：终场只有 '+Math.abs(g.us-g.them)+' 分之差，你想从哪里复盘？':won?'记者：这场赢了 '+(g.us-g.them)+' 分，你想先谈哪一点？':'记者：终场相差 '+Math.abs(g.us-g.them)+' 分，你最想回看什么？';
    const a=h('section','mbl-scout');box.append(a);
    function draw(answer){
      a.replaceChildren(h('h4','','赛后采访'),h('p','',answer?.question||question));
      if((answer?answer.follow:((prev?.key||prev)==='own'&&tookPart)))a.append(h('p','','记者追问：上一场你提到要回看自己的表现，这次出场 '+g.min+' 分钟，你关注什么？'));
      if(answer){
        const key=answer.key||answer;
        a.append(h('p','','你：'+(answer.quote||responses[key]?.[1]||'')),h('p','','采访手记 · '+(answer.note||where?.line||'终场 '+g.us+'–'+g.them)));return;
      }
      const status=h('p','');status.setAttribute('role','status');
      for(const [key,[label]] of Object.entries(responses)){
        const b=h('button','mbl-rel-btn',label);b.type='button';b.onclick=()=>{
          if(!locate(l,g)?.recent||model(l)?.answers?.[id]){status.textContent='这次采访已结束。';return;}
          const note=key==='own'?'出场 '+g.min+' 分钟，得到 '+(g.pts??0)+' 分。':key==='opponent'?scorer.n+' 得到 '+scorer.s[1]+' 分。':where.line;
          const record={key,question,quote:responses[key][1],note,follow:(prev?.key||prev)==='own'&&tookPart};
          if(save(l,m=>({...m,answers:{...m.answers,[id]:record}})))draw(record);else status.textContent='保存失败，可重试。';
        };a.append(b);
      }a.append(status);
    }draw(reply);
  }
  function report(g){
    const box=h('section','mbl-scout'),l=C.life(),where=locate(l,g);
    if(where)box.append(h('p','',where.line));
    if(g.matchRecord?.engine===4){
      const details=h('details','mbl-match-detail');details.append(h('summary','','比赛走势与关键回合'));
      let loaded=false;details.ontoggle=()=>{
        if(!details.open||loaded)return;loaded=true;
        const replay=MBLMatchRecord.replay(g);if(replay){details.append(moments(replay.game));const plan=tactics(replay.game,g.matchRecord);if(plan)details.append(plan);}else details.append(h('p','','逐回合记录与存档无法核对，请以原始技术统计为准。'));
      };box.append(details);
    }
    if(where||model(l)?.answers?.[gameId(g)])interview(box,l,g,where);
    return box;
  }
  window.MBLMatchStory={preview,planFor,applyPlan,tracker,step,analyze,locate,report};
})();