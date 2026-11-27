/* 2K 式专项训练（单机复刻扩展）。
 * 规则：保留内核自动成长；每成长一岁 +2 个训练点，持有封顶 9。
 * 比赛与奖项另给「表现点」：每 20 场常规赛 +1（每季最多 4），每个奖项/冠军 +1（每季最多 3）。
 * 玩家在 8 张通用专项卡里选择：每张给两项加成、一项代价；所有位置通用。
 * 旧档的 apPoints 继续可用；退役 / 死亡 / 坐牢期间不再发点。 */
(function () {
  'use strict';
  if (window.MBLAttrPoints) return;
  var C = window.MBLCore;

  var MAX_POINTS = 9;
  var GAMES_PER_POINT = 20;
  var GAME_POINTS_CAP = 4;
  var AWARD_POINTS_CAP = 3;
  var SKILL_KEYS = C.SKILLS;

  // 8 项通用专项：所有位置共用，保留「涨两项、挤一项」的联动，不再按位置锁卡。
  var PROGRAMS = [
    { id: 't-shoot', name: '投射专项', desc: '三分、中远投和罚球一起练；对抗会落下。',
      gains: { three: 2, mid: 1, freeThrow: 1 }, loss: { strength: 1 } },
    { id: 't-finish', name: '终结专项', desc: '篮下终结更稳；外线投篮会生疏。',
      gains: { layup: 2, dunk: 1 }, loss: { three: 1 } },
    { id: 't-play', name: '组织专项', desc: '传球和视野更好；对抗训练被挤掉。',
      gains: { pass: 2, handle: 1, iq: 1 }, loss: { strength: 1 } },
    { id: 't-handle', name: '控运专项', desc: '控球和持球速度更顺；内线对抗会落下。',
      gains: { handle: 2, speedWithBall: 1 }, loss: { interiorD: 1 } },
    { id: 't-defense', name: '防守专项', desc: '外线防守、抢断和护框更稳；三分练得少。',
      gains: { perimeterD: 2, steal: 1, block: 1 }, loss: { three: 1 } },
    { id: 't-board', name: '篮板专项', desc: '卡位、力量和弹跳一起练；外线投篮更没时间。',
      gains: { rebound: 2, strength: 1, vertical: 1 }, loss: { three: 1 } },
    { id: 't-body', name: '身体专项', desc: '速度和弹跳上去了；罚球手感会受影响。',
      gains: { speed: 2, vertical: 1 }, loss: { freeThrow: 1 } },
    { id: 't-iq', name: '球商专项', desc: '阅读比赛和传球更好；速度训练被挤掉。',
      gains: { iq: 2, pass: 1 }, loss: { speed: 1 } }
  ];

  function life() { return C.life(); }
  function ball() { var l = life(); return l && l.ball ? l.ball : null; }

  function ensure(b) {
    if (b.apPoints == null) b.apPoints = 0;
    if (b.apLastAge == null) b.apLastAge = life().age;
  }

  function capOf(b, k) { return Math.min(99, C.num(b.potential && b.potential[k], 99)); }
  function skillOf(b, k) { return C.num(b.skills && b.skills[k], 0); }

  function hasRoom(b) {
    return SKILL_KEYS.some(function (k) { return skillOf(b, k) < capOf(b, k); });
  }

  function save(l) { if (window.Nt && typeof Nt.saveLife === 'function') Nt.saveLife(l); }

  function seasonKeyOf(season) {
    if (!season) return '';
    var league = season.leagueId || (season.league && (season.league.en || season.league.hans)) || '';
    return [season.year, league].join(':');
  }

  function appearances(games,count=games.length) {
    let played=0;
    for(let i=0;i<Math.min(count,games.length);i++)
      if(!games[i].dnp && Number.isFinite(games[i].pts))played++;
    return played;
  }
  function perfState(b) {
    if (!b.apPerf) {
      var season = b.season;
      b.apPerf = {
        key: seasonKeyOf(season),
        gamesSeen: season && season.games ? season.games.length : 0,
        gamePoints: 0,
        awardPoints: 0,
        awardsSeen: (b.awards || []).length
      };
    }
    return b.apPerf;
  }

  function performance(l, b) {
    var p = perfState(b);
    var season = b.season || null;
    var key = seasonKeyOf(season);
    if (p.key !== key) {
      p.key = key;
      p.gamesSeen = 0;
      p.playedSeen = 0;
      p.gamePoints = 0;
      p.awardPoints = 0;
    }

    var awards = b.awards || [];
    if (p.awardsSeen > awards.length) p.awardsSeen = awards.length;
    var gained = 0;
    for (; p.awardsSeen < awards.length; p.awardsSeen++) {
      var kind = awards[p.awardsSeen] && awards[p.awardsSeen].kind;
      if ((kind === 'award' || kind === 'cup' || kind === 'medal') && p.awardPoints < AWARD_POINTS_CAP) {
        p.awardPoints += 1;
        gained += 1;
      }
    }

    if (season && season.games) {
      var games = season.games.length;
      if (games < p.gamesSeen) p.gamesSeen = games;
      if(!Number.isFinite(p.playedSeen))p.playedSeen=appearances(season.games,p.gamesSeen);
      var played=appearances(season.games);
      var due=Math.floor(played/GAMES_PER_POINT)-Math.floor(p.playedSeen/GAMES_PER_POINT);
      p.playedSeen=played;
      while (due > 0 && p.gamePoints < GAME_POINTS_CAP) {
        p.gamePoints += 1;
        gained += 1;
        due -= 1;
      }
      p.gamesSeen = games;
    }

    if (gained > 0) {
      b.apPoints = Math.min(MAX_POINTS, C.num(b.apPoints, 0) + gained);
      save(l);
    }
  }

  function grant() {
    var l = life();
    if (!l || !l.alive || !l.ball) return;
    var b = l.ball;
    ensure(b);
    if (!b.started || b.retiredFromPlaying) { b.apLastAge=l.age; return; }
    if (l.prisonYears && l.prisonYears > 0) { b.apLastAge=l.age; return; }
    if (l.age > C.num(b.apLastAge, l.age)) {
      var years=l.age-b.apLastAge;
      b.apLastAge = l.age;
      if (hasRoom(b) && b.apPoints < MAX_POINTS) b.apPoints = Math.min(MAX_POINTS, b.apPoints + 2*years);
      save(l);
    }
    performance(l, b);
  }

  function points() { var b = ball(); return b ? C.num(b.apPoints, 0) : 0; }

  function listFor(b) {
    return PROGRAMS;
  }
  const S = window.MBLAttrSys;
  function programFor(id) {
    const program=PROGRAMS.find(item=>item.id===id);
    if(program)return program;
    if(!id?.startsWith('skill-'))return null;
    const key=id.slice(6);
    return S.KEYS.includes(key)?{id,name:S.ATTR_CN[key]+'精练',gains:{[key]:2},loss:{}}:null;
  }
  function preview(id) {
    const l=life(),b=ball(),program=programFor(id);
    if(!l?.alive || !b?.started || b.retiredFromPlaying || l.prisonYears>0)
      return {ok:false,reason:'当前生涯阶段无法训练'};
    if(!program)return {ok:false,reason:'训练项目不存在'};
    if((b.out||0)>0 && Object.keys(program.gains).some(k=>['speed','speedWithBall','vertical','dunk','strength'].includes(k)))
      return {ok:false,reason:'伤停期间暂停对抗和爆发力训练'};
    const pos=window.kn?kn(b):'wing';
    const training=MBLDevelopment.drill(b.skills,b.potential,program.gains,program.loss);
    if(!training)return {ok:false,reason:'该项目已达个人潜力上限'};
    const {after,changes,cost}=training;
    const beforeBadges=S.activeBadges(b.skills,pos),afterBadges=S.activeBadges(after,pos);
    const badges=S.BADGES.filter(b=>beforeBadges[b.id]!==afterBadges[b.id]).map(b=>({name:b.name,
      before:beforeBadges[b.id]||null,after:afterBadges[b.id]||null}));
    const balance=points(), available=balance>=cost;
    return {id,ok:available,reason:available?'':'需要 '+cost+' 点，现有 '+balance+' 点',cost,balance,
      changes,badges,ovr:S.overall(b.skills,pos),afterOvr:S.overall(after,pos),name:program.name,
      owner:l, stamp:JSON.stringify([id,l.seed,l.age,l.ball.out,balance,b.skills,b.potential,pos])};
  }
  function programs() {
    return PROGRAMS.map(p=>{
      const quote=preview(p.id);
      return {...p,cost:quote.cost,available:quote.ok,reason:quote.reason,changes:quote.changes||[]};
    });
  }
  function gainText(gains) {
    return Object.keys(gains).map(k=>'+'+gains[k]+' '+S.ATTR_CN[k]).join(' / ');
  }
  function lossText(loss) {
    return Object.keys(loss).map(k=>'−'+loss[k]+' '+S.ATTR_CN[k]).join(' / ');
  }
  function apply(id,quoted) {
    const plan=preview(id);
    if(!plan.ok)return plan;
    if(quoted && (quoted.owner!==plan.owner||quoted.stamp!==plan.stamp))
      return {ok:false,reason:'训练条件已变化，请重新预览'};
    const l=life(),b=l.ball, previous=b.lastTraining;
    const note={name:plan.name,age:l.age,cost:plan.cost,changes:plan.changes,badges:plan.badges};
    for(const change of plan.changes)b.skills[change.key]=change.to;
    b.apPoints=plan.balance-plan.cost;
    const path=l.flags?.mblPathway,first=path?.firstTraining;
    window.MBLPathway?.training(l,id);
    b.lastTraining=note;
    try {
      save(l);
      if(window.MBLAutoSave && !MBLAutoSave.save())throw Error('save');
    } catch (_) {
      for(const change of plan.changes)b.skills[change.key]=change.from;
      if(path&&!first)delete path.firstTraining;
      b.apPoints=plan.balance;
      if(previous)b.lastTraining=previous;else delete b.lastTraining;
      try { save(l); } catch (_) { /* In-memory state already restored. */ }
      return {ok:false,reason:'存档写入失败，已恢复训练点和能力。可释放存档空间后重试。'};
    }
    return {ok:true,...note};
  }

  window.MBLAttrPoints = {
    MAX: MAX_POINTS,
    keys: SKILL_KEYS,
    points: points,
    capOf: function (k) { var b = ball(); return b ? capOf(b, k) : 99; },
    settle: grant, programs: programs, preview: preview,
    gainText: gainText,
    lossText: lossText,
    apply: apply,
    hasRoom: function () { var b = ball(); return !!b && hasRoom(b); }
  };

  C.onHeartbeat(grant, 900);
})();
