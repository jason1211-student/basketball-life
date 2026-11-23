/* 2K 式手动属性加点（单机复刻扩展）。
 * 规则：保留内核自动成长；另发可分配“训练点”——每成长一岁、且仍有潜力空间时 +1，持有封顶 6。
 * 玩家在属性面板手动把 1 点加到十项能力值之一，新值不超过 min(潜力, 99)；改动随 life 经 Nt.saveLife 落盘。
 * 旧档无该字段按 0 兼容；退役 / 死亡 / 坐牢期间不再发点。
 * 周期检查接入公共心跳（onHeartbeat），不再单独 setInterval。 */
(function () {
  'use strict';
  if (window.MBLAttrPoints) return;
  var C = window.MBLCore;

  var MAX_POINTS = 6;
  var SKILL_KEYS = C.SKILLS;

  function life() { return C.life(); }
  function ball() { var l = life(); return l && l.ball ? l.ball : null; }

  function ensure(b) {
    if (b.apPoints == null) b.apPoints = 0;
    if (b.apLastAge == null) b.apLastAge = life().age;
  }

  function hasRoom(b) {
    return SKILL_KEYS.some(function (k) {
      return C.num(b.skills && b.skills[k], 0) < C.num(b.potential && b.potential[k], 99);
    });
  }

  function capOf(b, k) { return Math.min(99, C.num(b.potential && b.potential[k], 99)); }

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
      if (hasRoom(b) && b.apPoints < MAX_POINTS) b.apPoints += 1;
      save(l);
    }
  }

  function points() { var b = ball(); return b ? C.num(b.apPoints, 0) : 0; }

  function canSpend(k) {
    var b = ball();
    if (!b || points() <= 0) return false;
    return C.num(b.skills && b.skills[k], 0) < capOf(b, k);
  }

  function spend(k) {
    var l = life(), b = ball();
    if (!l || !b || SKILL_KEYS.indexOf(k) < 0) return false;
    if (!canSpend(k)) return false;
    var cur = C.num(b.skills[k], 0), cap = capOf(b, k);
    b.skills[k] = window.re ? re(cur + 1, 0, cap) : Math.min(cap, Math.max(0, cur + 1));
    b.apPoints = C.num(b.apPoints, 0) - 1;
    save(l);
    return true;
  }

  window.MBLAttrPoints = {
    MAX: MAX_POINTS,
    keys: SKILL_KEYS,
    points: points,
    capOf: function (k) { var b = ball(); return b ? capOf(b, k) : 99; },
    canSpend: canSpend,
    spend: spend,
    hasRoom: function () { var b = ball(); return !!b && hasRoom(b); }
  };

  // 原 900ms 轮询：接入统一心跳，最小间隔 900ms，仅在有生命时做幂等检查
  C.onHeartbeat(grant, 900);
})();
