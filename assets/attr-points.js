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
  var FLOOR = 25;

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
      var due = Math.floor(games / GAMES_PER_POINT) - Math.floor(p.gamesSeen / GAMES_PER_POINT);
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
    if (b.retiredFromPlaying) return;
    if (l.prisonYears && l.prisonYears > 0) return;
    if (l.age > C.num(b.apLastAge, l.age)) {
      b.apLastAge = l.age;
      if (hasRoom(b) && b.apPoints < MAX_POINTS) b.apPoints = Math.min(MAX_POINTS, b.apPoints + 2);
      save(l);
    }
    performance(l, b);
  }

  function points() { var b = ball(); return b ? C.num(b.apPoints, 0) : 0; }

  function canGain(b, gains) {
    return Object.keys(gains).some(function (k) { return skillOf(b, k) < capOf(b, k); });
  }

  function listFor() {
    return PROGRAMS;
  }

  function programs() {
    var b = ball();
    if (!b) return [];
    return listFor(b).map(function (p) {
      return {
        id: p.id, name: p.name, desc: p.desc,
        gains: p.gains, loss: p.loss,
        available: canGain(b, p.gains)
      };
    });
  }

  function gainText(gains) {
    return Object.keys(gains).map(function (k) {
      return '+' + gains[k] + ' ' + (C.ATTR_CN[k] || k);
    }).join(' / ');
  }
  function lossText(loss) {
    return Object.keys(loss).map(function (k) {
      return '−' + loss[k] + ' ' + (C.ATTR_CN[k] || k);
    }).join(' / ');
  }

  function apply(id) {
    var l = life(), b = ball();
    if (!l || !b || points() <= 0) return { ok: false, reason: '没有可用训练点' };
    var program = null;
    var list = listFor(b);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) program = list[i];
    if (!program) return { ok: false, reason: '专项不存在' };
    if (!canGain(b, program.gains)) return { ok: false, reason: '这项已经到潜力上限' };

    var applied = {};
    Object.keys(program.gains).forEach(function (k) {
      var cur = skillOf(b, k), cap = capOf(b, k);
      if (cur >= cap) return;
      var next = Math.min(cap, cur + program.gains[k]);
      b.skills[k] = window.re ? re(next, 0, cap) : next;
      applied[k] = next - cur;
    });
    Object.keys(program.loss).forEach(function (k) {
      var cur = skillOf(b, k);
      if (cur > FLOOR) b.skills[k] = Math.max(FLOOR, cur - program.loss[k]);
    });
    b.apPoints = C.num(b.apPoints, 0) - 1;
    save(l);
    return { ok: true, name: program.name, gains: applied };
  }

  window.MBLAttrPoints = {
    MAX: MAX_POINTS,
    keys: SKILL_KEYS,
    points: points,
    capOf: function (k) { var b = ball(); return b ? capOf(b, k) : 99; },
    programs: programs,
    gainText: gainText,
    lossText: lossText,
    apply: apply,
    hasRoom: function () { var b = ball(); return !!b && hasRoom(b); }
  };

  C.onHeartbeat(grant, 900);
})();
