/* 人物事件结果波动层（温和）。
 * 不重写成长内核：遍历注册表 yR，把每个选项 choice.apply 包一层，
 * 在原结算前后快照 traits / skills 净增量，按种子随机做 ±20% 温和浮动，
 * 约 15% 概率走小分支（超常 1.25 / 受挫 0.75）。负向增量同向缩放，不被放大。
 * status（健康/快乐/关系/声誉）走内核非线性 clamp，本层不改动，避免越界。
 * 随机源复用内核 life.rng（tr），读档重放结果可复现。 */
(function () {
  'use strict';
  if (window.MBLEventTuning) return;
  var C = window.MBLCore;

  var BOUND = { traits: [0, 100], skills: [0, 99] };

  function snap(obj) {
    var out = {};
    if (obj) for (var k in obj) if (typeof obj[k] === 'number') out[k] = obj[k];
    return out;
  }

  function scale(cur, before, factor, lo, hi, roundIt) {
    if (!cur) return;
    for (var k in before) {
      if (typeof cur[k] !== 'number') continue;
      var d = cur[k] - before[k];
      if (!d) continue;
      var v = before[k] + d * factor;
      cur[k] = roundIt ? Math.round(re(v, lo, hi)) : re(v, lo, hi);
    }
  }

  // 温和系数：默认 0.8~1.2；15% 小分支，一半超常、一半受挫。
  function factorFor(life) {
    var roll = tr(life);
    if (roll < 0.15) return tr(life) < 0.5 ? 1.25 : 0.75;
    return 0.8 + tr(life) * 0.4;
  }

  function wrapApply(orig) {
    return function (life, params) {
      var t0 = snap(life.traits);
      var s0 = snap(life.ball && life.ball.skills);
      orig(life, params);
      try {
        var f = factorFor(life);
        scale(life.traits, t0, f, BOUND.traits[0], BOUND.traits[1], true);
        if (life.ball && life.ball.skills) scale(life.ball.skills, s0, f, BOUND.skills[0], BOUND.skills[1], false);
      } catch (e) {
        /* 波动层异常不阻断原结算 */
      }
    };
  }

  var wrapped = 0;
  function install() {
    if (!window.yR || typeof tr !== 'function' || typeof re !== 'function') return false;
    window.yR.forEach(function (tpl) {
      var choices = tpl && tpl.choices;
      if (!Array.isArray(choices)) return;
      choices.forEach(function (c) {
        if (c && typeof c.apply === 'function' && !c.__mblWrapped) {
          c.apply = wrapApply(c.apply);
          c.__mblWrapped = true;
          wrapped++;
        }
      });
    });
    return true;
  }

  window.MBLEventTuning = {
    install: install,
    wrappedCount: function () { return wrapped; }
  };

  // defer 脚本通常晚于内核加载；接入统一心跳兜底，直到 yR 就绪（最多约 40 次）后自行注销。
  if (!install()) {
    var tries = 0;
    function waitReady() {
      if (install() || ++tries > 40) C.offHeartbeat(waitReady);
    }
    C.onHeartbeat(waitReady, 120);
  }
})();
