/* mbl-core：自写模块公共底座，集中常量、DOM 工具、通用函数与统一调度（全树一个 MutationObserver + 一个心跳）。 */
(function () {
  'use strict';
  if (window.MBLCore) return;

  var SKILLS = ['layup', 'dunk', 'three', 'mid', 'freeThrow',
    'handle', 'pass', 'speedWithBall', 'iq',
    'perimeterD', 'interiorD', 'steal', 'block', 'rebound',
    'speed', 'strength', 'vertical'];

  var ATTR_CN = {
    layup: '上篮', dunk: '扣篮', three: '三分', mid: '中距离', freeThrow: '罚球',
    handle: '控球', pass: '传球', speedWithBall: '持球速度', iq: '球商',
    perimeterD: '外线防守', interiorD: '内线防守', steal: '抢断', block: '盖帽',
    rebound: '篮板', speed: '速度', strength: '力量', vertical: '弹跳'
  };

  // ===== DOM 工具 =====
  function h(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function num(v, d) {
    var n = Number(v);
    return Number.isFinite(n) ? n : (d == null ? 0 : d);
  }
  function round(v) { return Math.round(num(v)); }

  // 能力均值：keys 可指定，默认十项；rounded=true 时取整（总评/潜力展示用）
  function avg(obj, keys, rounded) {
    if (!obj) return 0;
    var ks = keys || SKILLS, s = 0, n = 0;
    for (var i = 0; i < ks.length; i++) {
      var x = obj[ks[i]];
      if (Number.isFinite(x)) { s += x; n++; }
    }
    var m = n ? s / n : 0;
    return rounded ? Math.round(m) : m;
  }

  function wait(ms) {
    return new Promise(function (r) { setTimeout(r, ms || 0); });
  }

  // 多语言对象取中文名（兼容简体/繁体/英文）
  function hans(o) {
    if (o == null) return '';
    if (typeof o === 'string') return o;
    return o.hans || o.hant || o.en || '';
  }
  function teamName(team) { return team ? hans(team) : ''; }

  function life() { return window.de && window.de.life ? window.de.life : null; }
  function screen() { return window.de ? de.screen : ''; }

  var domFns = [];   // {fn, screens:null|[]}
  var beatFns = [];  // {fn, gap, last}
  var domQueued = false;
  var pendingMutations = [];
  var HEARTBEAT_MS = 400;

  // 注册 DOM 变化回调，whenScreen 限定只在对应界面触发
  function onDom(fn, whenScreen) {
    if (typeof fn !== 'function') return;
    if (domFns.some(function (d) { return d.fn === fn; })) return;
    var screens = whenScreen
      ? (Array.isArray(whenScreen) ? whenScreen : [whenScreen])
      : null;
    domFns.push({ fn: fn, screens: screens });
  }
  function offDom(fn) {
    for (var i = domFns.length - 1; i >= 0; i--)
      if (domFns[i].fn === fn) domFns.splice(i, 1);
  }

  // 注册周期任务，gap 为最小间隔
  function onHeartbeat(fn, gap) {
    if (typeof fn !== 'function') return;
    if (beatFns.some(function (b) { return b.fn === fn; })) return;
    beatFns.push({ fn: fn, gap: gap || 0, last: 0 });
  }
  function offHeartbeat(fn) {
    for (var i = beatFns.length - 1; i >= 0; i--)
      if (beatFns[i].fn === fn) beatFns.splice(i, 1);
  }

  function flushDom(mutations) {
    domQueued = false;
    var sc = screen();
    for (var i = 0; i < domFns.length; i++) {
      var d = domFns[i];
      if (d.screens && d.screens.indexOf(sc) < 0) continue;
      try { d.fn(mutations); } catch (e) { console.error('[mbl-core onDom]', e); }
    }
  }

  function scheduleDom(mutations) {
    for (var i = 0; i < mutations.length; i++) pendingMutations.push(mutations[i]);
    if (domQueued) return;
    domQueued = true;
    function run() {
      var batch = pendingMutations;
      pendingMutations = [];
      flushDom(batch);
    }
    if (window.requestAnimationFrame) requestAnimationFrame(run);
    else setTimeout(run, 16);
  }

  function heartbeat() {
    var now = Date.now();
    for (var i = 0; i < beatFns.length; i++) {
      var b = beatFns[i];
      if (b.gap && now - b.last < b.gap) continue;
      b.last = now;
      try { b.fn(); } catch (e) { console.error('[mbl-core heartbeat]', e); }
    }
  }

  // 全树唯一的 DOM 观察者
  new MutationObserver(scheduleDom).observe(
    document.body, { childList: true, subtree: true }
  );
  window.setInterval(heartbeat, HEARTBEAT_MS);

  window.MBLCore = {
    SKILLS: SKILLS,
    ATTR_CN: ATTR_CN,
    h: h, $: $, $$: $$,
    clamp: clamp, num: num, round: round, avg: avg,
    wait: wait, hans: hans, teamName: teamName,
    life: life, screen: screen,
    onDom: onDom,
    offDom: offDom,
    onHeartbeat: onHeartbeat,
    offHeartbeat: offHeartbeat
  };
})();
