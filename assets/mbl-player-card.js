(function () {
  'use strict';
  if (window.MBLPlayerCard) return;
  const C=window.MBLCore, S=window.MBLAttrSys, h=C.h;
  const positions={guard:'后卫',wing:'侧翼',big:'内线',PG:'控球后卫',SG:'得分后卫',SF:'小前锋',PF:'大前锋',C:'中锋',
    pg:'控球后卫',sg:'得分后卫',sf:'小前锋',pf:'大前锋',c:'中锋'};
  const statsKeys=['min','pts','fga','fgm','tpa','tpm','fta','ftm','ore','dre','ast','stl','blk','to','pf'];
  const sourceNames={match:'比赛快照',live:'实时比赛',final:'终场快照',preview:'赛前预计阵容',
    roster:'赛季名单',estimated:'赛季名单 · 当前引擎估算',career:'当前球员能力',scouting:'球队名册',
    scoutEstimate:'球队名册 · 能力估算',legacy:'历史记录'};
  const oldGameKeys=new WeakMap();
  let nextOldKey=0;

  function ratingCopy(values) {
    if (!values || typeof values!=='object') return {};
    return Object.fromEntries(Object.entries(values).filter(([key,value])=>S.KEYS.includes(key) &&
      Number.isFinite(value) && value>=0 && value<=99));
  }
  function fullRatings(values) {return S.KEYS.every(key=>Number.isFinite(values[key]));}
  function badgeCopy(badges,ratings) {
    if (badges && typeof badges==='object' && !Array.isArray(badges)) return {...badges};
    return fullRatings(ratings)?S.badgeTiers(ratings):null;
  }
  function statsFromCompact(values) {
    if (!Array.isArray(values)) return null;
    return Object.fromEntries(statsKeys.map((key,index)=>[key,values[index]]).filter(([,value])=>Number.isFinite(value)));
  }
  function statsFromLive(stats, minutes, points) {
    if(!stats)return null;
    const result=Object.fromEntries(statsKeys.map(key=>[key,stats[key]]).filter(([,value])=>Number.isFinite(value)));
    if(Number.isFinite(minutes)) result.min=minutes;
    if(Number.isFinite(points)) result.pts=points;
    return result;
  }
  function teamName(team) {return C.hans(team?.name || team)||'';}
  function profile(player,context={}) {
    const ratings=ratingCopy(player.ratings);
    const caps=ratingCopy(player.potential);
    const badges=badgeCopy(player.badges,ratings);
    return {
      identity:context.identity||JSON.stringify(['profile',C.life()?.seed,context.year,teamName(context.team),player.id||player.name?.en||C.hans(player.name)]),
      name:C.hans(player.name)||'未命名球员',position:positions[player.at]||positions[player.pos]||'位置未记录',
      pos:player.pos,age:Number.isFinite(player.age)&&player.age>=0?player.age:null,
      ovr:Number.isFinite(player.ovr)?player.ovr:null,potential:Number.isFinite(player.pot)?player.pot:null,
      team:teamName(context.team),year:Number.isFinite(context.year)?context.year:null,
      source:context.source||'scouting',isMe:!!(player.me||player.id==='me'),
      rotation:typeof player.rotation?.role==='string' && Number.isFinite(player.rotation.minutes)
        ?{role:player.rotation.role,minutes:player.rotation.minutes}:null,
      exactMinutes:context.exactMinutes===true,reasons:context.reasons||[],ratings,caps,badges,badgeSource:player.badges?'已装备徽章':'按已记录能力计算',
      stats:context.stats?{...context.stats}:null
    };
  }
  function current(life) {
    const ball=life.ball;
    const pos=typeof window.kn==='function'?window.kn(ball):'wing';
    const at=typeof window.Bu==='function'?window.Bu(ball):null;
    const ratings=ball.skills, role=window.MBLTeamRoom?.view(life);
    return profile({rotation:role?{role:role.roleName,minutes:role.planned}:null,id:'me',name:life.name,age:life.age,pos,at,ratings,
      potential:ball.potential,badges:S.activeBadges(ratings,pos),ovr:S.overall(ratings,pos),pot:ball.potential?S.overall(ball.potential,pos):null},{
      source:'career',team:ball.pro?.team||ball.season?.team||ball.team,year:typeof window.Gr==='function'?window.Gr(life):null
    });
  }
  function fromRoster(life,season,player) {
    if (player.me) return current(life);
    window.MBLDevelopment?.roster(life,season);
    const actual=player.ratings;
    const estimated=!actual && Number.isFinite(player.ovr) && window.MBLBroadcast?.rosterRatings;
    return profile({...player,ratings:actual||(estimated?window.MBLBroadcast.rosterRatings(player):null)},{
      team:season?.team,year:season?.year,source:estimated?'estimated':'roster',
      identity:player.playerId||JSON.stringify(['roster',life.seed,season?.year,teamName(season?.team),
        player.id??season?.roster?.indexOf(player)??player.name?.en])
    });
  }
  function fromScouting(player,context={}) {
    const estimated=!player.ratings&&Number.isFinite(player.ovr)&&window.MBLBroadcast?.rosterRatings;
    return profile({...player,ratings:player.ratings||(estimated?window.MBLBroadcast.rosterRatings(player):null)},
      {...context,source:estimated?'scoutEstimate':'scouting'});
  }
  function fromMatch(player,context={}) {
    return profile(player,{...context,identity:JSON.stringify(['match',context.matchKey??null,context.side,
      player.id??player.name?.en??C.hans(player.name)])});
  }
  function readMatchup(game) {
    try {return window.MBLMatchRecord?.matchup(game.matchRecord)||null;} catch (_) {return null;}
  }
  function matchKey(game) {
    if(Number.isInteger(game.matchRecord?.seed))return game.matchRecord.seed;
    if(!oldGameKeys.has(game))oldGameKeys.set(game,'archive-'+(++nextOldKey));
    return oldGameKeys.get(game);
  }
  // Identity resolution is limited to the recorded side and uses an explicit
  // ID, the player flag, or a unique stored English name. Never regenerate
  // historical skills or borrow a same-named player from the current roster.
  function resolveRecordedPlayer(row,team) {
    const players=team?.players||[];
    let matches=[];
    if(row.id!=null) matches=players.filter(player=>player.id===row.id);
    else if(row.me) matches=players.filter(player=>player.id==='me');
    else if(row.en) matches=players.filter(player=>player.name?.en===row.en || player.id===row.en);
    return matches.length===1?matches[0]:null;
  }
  function fromBox(game,side,row,index,context={},mu=readMatchup(game)) {
    const team=game.box?.[side];
    const recorded=mu?.[side];
    const player=recorded && (!team?.name || teamName(recorded)===teamName(team))
      ? resolveRecordedPlayer(row,recorded):null;
    const info={team:recorded?.name||team?.name,year:context.year??mu?.year,
      side,exactMinutes:game.matchRecord?.engine===4,reasons:row.reasons,matchKey:matchKey(game),stats:statsFromCompact(row.s)};
    if(player)return fromMatch({...player,age:player.age??row.age},{...info,source:'match'});
    return fromMatch({id:row.id??(row.me?'me':'row-'+index),name:row.n||row.en,
      pos:row.pos,ovr:row.ovr,age:row.age,me:row.me},{...info,team:team?.name,source:'legacy'});
  }

  let dialog=null, body=null, tabs=null, header=null, model=null, activeTab='attributes', cleanup=null;
  function close() {
    if(dialog?.open) dialog.close();
    release();
  }
  function release() {
    const fn=cleanup;cleanup=null;
    if(fn)fn();
  }
  function ensureDialog() {
    if(dialog)return;
    dialog=h('dialog','mbl-player-card');
    dialog.setAttribute('aria-labelledby','mbl-player-card-heading');
    header=h('header','mbl-pc-header');
    const title=h('h2','','球员资料');title.id='mbl-player-card-heading';
    const x=h('button','mbl-pc-close','关闭');x.type='button';x.onclick=close;
    header.append(title,x);
    tabs=h('nav','mbl-pc-tabs');tabs.setAttribute('aria-label','球员资料分类');
    body=h('div','mbl-pc-body');
    dialog.append(header,tabs,body);
    tabs.setAttribute('role','tablist');
    window.MBLInteraction?.tabKeys(tabs,()=>Array.from(tabs.children));
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('close',()=>{if(!dialog.open)release();});
    dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
    document.body.append(dialog);
  }
  function number(value) {return Number.isFinite(value)?String(Math.round(value*10)/10):'—';}
  function ratingTile(label,value) {
    const box=h('div','mbl-pc-score');
    box.append(h('strong','',number(value)),h('span','',label));
    return box;
  }
  function hero(p) {
    const card=h('section','mbl-pc-hero');
    const info=h('div','mbl-pc-identity');
    info.append(h('span','mbl-pc-source',sourceNames[p.source]||sourceNames.scouting));
    const name=h('h3','',p.name+(p.isMe?'（你）':''));
    info.append(name,h('p','', [p.team,p.position,p.age===null?'年龄未记录':p.age+' 岁',p.year&&p.year+' 赛季'].filter(Boolean).join(' · ')));
    if(p.reasons?.length)info.append(h('p','','换人记录 · '+p.reasons.join('、')));
    if(p.rotation)info.append(h('p','',p.rotation.role+' · 计划出场 '+p.rotation.minutes+' 分钟'));
    if(fullRatings(p.ratings))info.append(h('span','mbl-pc-style',S.STYLE_NAME[S.detectStyle(p.ratings)]||''));
    const scores=h('div','mbl-pc-scores');
    scores.append(ratingTile('总评',p.ovr));
    if(p.potential!==null)scores.append(ratingTile('潜力',p.potential));
    const art=window.MBLCareerArt?.profile(p);
    if(art)card.append(art);
    card.append(info,scores);
    return card;
  }
  function missing(text) {return h('p','mbl-pc-empty',text);}
  function renderAttributes(p) {
    const wrap=h('div','mbl-pc-details');
    if(!Object.keys(p.ratings).length) {
      wrap.append(missing('这份记录没有保存分项能力，暂时只能查看已有资料。'));
      return wrap;
    }
    if(p.source==='estimated')wrap.append(h('p','mbl-pc-note','当前引擎根据赛季名单总评和位置生成的能力估算。'));
    if(p.source==='scoutEstimate')wrap.append(h('p','mbl-pc-note','按名册总评与位置估算，具体比赛以当场阵容快照为准。'));
    for(const group of S.CATEGORIES) {
      const section=h('section','mbl-pc-category');
      section.append(h('h4','',group.name));
      const list=h('div','mbl-pc-ratings');
      for(const key of group.keys) {
        const value=p.ratings[key], row=h('div','mbl-pc-rating');
        const top=h('div','mbl-pc-rating-top');
        top.append(h('span','',S.ATTR_CN[key]),h('b','',number(value)));
        if(Number.isFinite(p.caps[key]))top.append(h('small','','上限 '+number(p.caps[key])));
        const track=h('div','mbl-pc-track');
        if(Number.isFinite(value)){const fill=h('i');fill.style.width=value+'%';track.append(fill);}
        row.append(top,track);row.dataset.rating=key;
        list.append(row);
      }
      section.append(list);wrap.append(section);
    }
    return wrap;
  }
  function renderBadges(p) {
    const wrap=h('div','mbl-pc-details');
    if(p.badges===null){wrap.append(missing('没有保存徽章或足够的能力数据。'));return wrap;}
    wrap.append(h('p','mbl-pc-note',p.badgeSource+' · '+Object.keys(p.badges).length+' 枚'));
    if(!Object.keys(p.badges).length){wrap.append(missing('当前没有已激活徽章。'));return wrap;}
    const list=h('div','mbl-pc-badges');
    for(const [id,tier] of Object.entries(p.badges)) {
      const badge=S.BADGES.find(item=>item.id===id);
      const tile=h('div','mbl-pc-badge');
      const level=h('span','mbl-pc-badge-level '+(['bronze','silver','gold','hof'].includes(tier)?tier:''),S.TIER_LABEL[tier]||'未知');
      tile.append(level,h('b','',badge?.name||id));list.append(tile);
    }
    wrap.append(list);return wrap;
  }
  function renderStats(p) {
    const wrap=h('div','mbl-pc-details'), s=p.stats;
    const sum=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?a+b:null;
    const shooting=(made,attempted)=>Number.isFinite(made)&&Number.isFinite(attempted)?made+' / '+attempted:'—';
    if(p.source==='live')wrap.append(h('p','mbl-pc-note',p.exactMinutes?'截至打开球员卡时 · 实际出场时间':'截至打开球员卡时 · 出场分钟为估算'));
    const primary=h('div','mbl-pc-primary-stats');
    for(const [key,label,value] of [['pts','得分',s.pts],['reb','篮板',sum(s.ore,s.dre)],['ast','助攻',s.ast]]) {
      const tile=ratingTile(label,value);tile.dataset.stat=key;primary.append(tile);
    }
    wrap.append(primary);
    const grid=h('div','mbl-pc-stat-grid');
    for(const [key,label,value] of [['min','分钟',p.exactMinutes&&Number.isFinite(s.min)?window.MBLMatchV4.minutes(s.min):number(Number.isFinite(s.min)?Math.round(s.min):null)],['fg','投篮',shooting(s.fgm,s.fga)],
      ['three','三分',shooting(s.tpm,s.tpa)],['ft','罚球',shooting(s.ftm,s.fta)],
      ['ore','前场篮板',number(s.ore)],['dre','后场篮板',number(s.dre)],['stl','抢断',number(s.stl)],
      ['blk','盖帽',number(s.blk)],['to','失误',number(s.to)],['pf','犯规',number(s.pf)]]) {
      const item=h('div','mbl-pc-stat');item.dataset.stat=key;item.append(h('span','',label),h('b','',value));grid.append(item);
    }
    wrap.append(grid);return wrap;
  }
  function renderTabs() {
    const list=model.stats?[['stats','本场表现'],['attributes','能力值'],['badges','徽章']]:
      [['attributes','能力值'],['badges','徽章']];
    const positions=new Map();
    function updateTabs(){for(const b of tabs.children){const selected=b.dataset.pcTab===activeTab;b.tabIndex=selected?0:-1;b.setAttribute('aria-selected',String(selected));}}
    tabs.replaceChildren(...list.map(([key,label])=>{
      const b=h('button','mbl-pc-tab',label);b.type='button';b.dataset.pcTab=key;
      b.id='mbl-card-tab-'+key;
      b.setAttribute('role','tab');b.setAttribute('aria-controls','mbl-card-tab-content');
      b.onclick=()=>{
        if(activeTab===key)return;
        positions.set(activeTab,body.scrollTop);activeTab=key;updateTabs();
        renderContent(true);body.scrollTop=positions.get(key)||0;
      };
      return b;
    }));
    updateTabs();
  }
  function renderContent(keepHero=false) {
    const content=activeTab==='stats'?renderStats(model):activeTab==='badges'?renderBadges(model):renderAttributes(model);
    content.id='mbl-card-tab-content';content.setAttribute('role','tabpanel');
    content.setAttribute('aria-labelledby','mbl-card-tab-'+activeTab);
    body.replaceChildren(keepHero?body.firstElementChild:hero(model),content);
  }
  function open(p,options={}) {
    if(!p)return false;
    ensureDialog();
    if(dialog.open)release();
    model=p;cleanup=options.onClose||null;
    activeTab=p.stats?'stats':'attributes';
    renderTabs();renderContent();
    if(!dialog.open)dialog.showModal();
    body.scrollTop=0;
    return true;
  }
  function button(factory,label,options={}) {
    const b=h('button','mbl-player-link',label);b.type='button';
    b.setAttribute('aria-label','查看 '+label+' 的球员资料');
    b.onclick=event=>{
      event.stopPropagation();
      const p=typeof factory==='function'?factory():factory;
      if(p)open(p,{onClose:options.onOpen?.()});
    };
    return b;
  }
  window.MBLPlayerCard={profile,current,fromRoster,fromScouting,fromMatch,fromBox,readMatchup,resolveRecordedPlayer,
    statsFromCompact,statsFromLive,open,button,close,positionLabel:pos=>positions[pos]||'位置未记录'};
})();
