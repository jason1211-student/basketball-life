/* 2K 式专项训练（单机复刻扩展）。
 * 规则：保留内核自动成长；每成长一岁、且仍有潜力空间时 +2 个训练点，持有封顶 6。
 * 玩家不再逐项 +1，而是在「位置 3 张 + 通用 5 张」专项卡里选择：每张给两项加成、一项代价。
 * 旧档的 apPoints 继续可用；退役 / 死亡 / 坐牢期间不再发点。 */
(function () {
  'use strict';
  if (window.MBLAttrPoints) return;
  var C = window.MBLCore;

  var MAX_POINTS = 6;
  var SKILL_KEYS = C.SKILLS;
  var FLOOR = 25;

  var PROGRAMS = {
    guard: [
      { id: 'g-shoot', name: '投射专项', desc: '把出手练成习惯；对抗训练会被挤掉。',
        gains: { three: 2, mid: 1 }, loss: { strength: 1 } },
      { id: 'g-play', name: '组织专项', desc: '球权交给你来分配；内线对抗练得少。',
        gains: { pass: 2, handle: 1 }, loss: { interiorD: 1 } },
      { id: 'g-drive', name: '突破专项', desc: '第一步更快、终结更稳；外线投篮会生疏。',
        gains: { layup: 2, speedWithBall: 1 }, loss: { three: 1 } }
    ],
    wing: [
      { id: 'w-3d', name: '3D 专项', desc: '防守和底角三分一起练；持球会退步。',
        gains: { perimeterD: 2, three: 1 }, loss: { handle: 1 } },
      { id: 'w-score', name: '得分专项', desc: '中距离和终结更可靠；传球视野会变窄。',
        gains: { mid: 2, layup: 1 }, loss: { pass: 1 } },
      { id: 'w-body', name: '身体专项', desc: '力量和弹跳上去了；罚球手感会受影响。',
        gains: { strength: 2, vertical: 1 }, loss: { freeThrow: 1 } }
    ],
    big: [
      { id: 'b-board', name: '篮板专项', desc: '卡位和力量一起练；外线投篮更没时间。',
        gains: { rebound: 2, strength: 1 }, loss: { three: 1 } },
      { id: 'b-rim', name: '护框专项', desc: '盖帽和内线防守更扎实；横移会慢一点。',
        gains: { block: 2, interiorD: 1 }, loss: { speed: 1 } },
      { id: 'b-finish', name: '终结专项', desc: '篮下终结更凶；罚球还是老样子。',
        gains: { dunk: 2, layup: 1 }, loss: { freeThrow: 1 } }
    ]
  };

  var COMMON = [
    { id: 'c-body', name: '体能专项', desc: '速度和弹跳一起练；球商会暂时生疏。',
      gains: { speed: 2, vertical: 1 }, loss: { iq: 1 } },
    { id: 'c-strength', name: '对抗专项', desc: '力量和内线对抗更硬；横移会慢一点。',
      gains: { strength: 2, interiorD: 1 }, loss: { speed: 1 } },
    { id: 'c-defense', name: '防守专项', desc: '抢断和外线防守更稳；三分练得少。',
      gains: { steal: 2, perimeterD: 1 }, loss: { three: 1 } },
    { id: 'c-handle', name: '控运专项', desc: '控球和持球速度更顺；内线对抗会落下。',
      gains: { handle: 2, speedWithBall: 1 }, loss: { interiorD: 1 } },
    { id: 'c-iq', name: '球商专项', desc: '阅读比赛和传球更好；速度训练被挤掉。',
      gains: { iq: 2, pass: 1 }, loss: { speed: 1 } }
  ];

  function life() { return C.life(); }
  function ball() { var l = life(); return l && l.ball ? l.ball : null; }

  function groupOf(b) {
    try { if (typeof kn === 'function') return kn(b); } catch (e) {}
    return 'wing';
  }

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
  }

  function points() { var b = ball(); return b ? C.num(b.apPoints, 0) : 0; }

  function canGain(b, gains) {
    return Object.keys(gains).some(function (k) { return skillOf(b, k) < capOf(b, k); });
  }

  function listFor(b) {
    var pos = PROGRAMS[groupOf(b)] || PROGRAMS.wing;
    return pos.concat(COMMON);
  }

  function programs() {
    var b = ball();
    if (!b) return [];
    var list = listFor(b);
    return list.map(function (p) {
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
