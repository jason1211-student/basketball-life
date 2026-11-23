/* 选秀流程接入模板（单机复刻扩展）。
 * 当正常游玩出现「宣布参选」抉择（go_pro_draft / go_pro_early / early_entry）时，
 * 在抉择卡片后注入一张球探报告：按球员真实成长经历（身高、位置、各项能力与潜力的相对高低）
 * 自动匹配最贴合的「位置 + 打法 + 潜力档」，并允许切换打法、三项关键微调。
 * 微调只温和作用于潜力上限，不动已成长的能力值；衔接参选抉择本身的球探评价，不另起突兀弹窗。
 * 出生时已启用自定义模板的玩家，这里会沿用其设定，不重复强制匹配。 */
(function () {
  'use strict';
  if (window.MBLDraftMatch) return;
  var C = window.MBLCore;
  var T = window.MBLDraftTemplate;
  var SKILLS = T.SKILLS;
  var DECLARE_TIDS = ['go_pro_draft', 'go_pro_early', 'early_entry'];

  var el = C.h;
  function avg(obj) { return C.avg(obj, SKILLS, false); }

  // ===== 自动匹配 =====
  function matchStyle(ball, pos) {
    var center = {}, base = avg(ball.potential);
    SKILLS.forEach(function (k) { center[k] = ball.potential[k] - base; });
    var best = null, bestScore = -Infinity;
    T.STYLES[pos].forEach(function (st) {
      var score = 0;
      SKILLS.forEach(function (k) { score += center[k] * (st.w[k] || 0); });
      if (score > bestScore) { bestScore = score; best = st.id; }
    });
    return best;
  }

  function matchHeight(ball, pos) {
    var h = ball.adultHeight, best = 0, bestD = Infinity;
    T.POS_HEIGHT[pos].forEach(function (v, i) {
      var d = Math.abs(v - h);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  function matchPot(ball) {
    var p = avg(ball.potential), sk = avg(ball.skills), gap = p - sk;
    if (p >= 80 && gap >= 14) return 'high';
    if (p <= 72 || gap <= 8) return 'ready';
    return 'balanced';
  }

  // 生成匹配结果（若出生已启用自定义模板则沿用）
  function compute() {
    var ball = de.life.ball;
    var pos = (typeof Bu === 'function') ? Bu(ball) : T.state.pos;
    if (T.state.enabled) {
      return {
        pos: pos, style: T.state.style, height: T.state.height,
        pot: T.state.pot, tweak: Object.assign({}, T.state.tweak), inherited: true
      };
    }
    return {
      pos: pos,
      style: matchStyle(ball, pos),
      height: matchHeight(ball, pos),
      pot: matchPot(ball),
      tweak: { shoot: 0, play: 0, ath: 0, def: 0 },
      inherited: false
    };
  }

  var matched = null;

  // 把微调温和作用到潜力（只在当前自然潜力基础上叠加，clamp，不动 skills）
  function applyTweak(ball, m) {
    // 先恢复：用一个干净副本较难，这里微调滑块每次基于当前值，采用"重置到匹配时快照 + 滑块"
    SKILLS.forEach(function (k) {
      var base = snapshot[k];
      var d = 0;
      if (k === 'three' || k === 'mid' || k === 'finishing') d += m.tweak.shoot;
      if (k === 'handling' || k === 'passing') d += m.tweak.play;
      if (k === 'athleticism') d += m.tweak.ath;
      if (k === 'perimeterD' || k === 'interiorD') d += m.tweak.def;
      ball.potential[k] = T.clamp(Math.round(base + d), 35, 99);
    });
    if (window.Nt) Nt.saveLife(de.life);
  }

  var snapshot = null;

  function seg(items, value, onpick) {
    var wrap = el('div', 'dt-seg dm-seg');
    items.forEach(function (it) {
      var b = el('button', 'dt-opt' + (it.id === value ? ' on' : ''), it.name);
      b.type = 'button'; b.dataset.value = it.id;
      b.addEventListener('click', function () { onpick(it.id); });
      wrap.append(b);
    });
    return wrap;
  }

  function row(label, node) {
    var r = el('div', 'dt-row');
    r.append(el('label', 'dt-label', label), node);
    return r;
  }

  function buildCard(m) {
    var box = el('section', 'mbl-draft-match card');
    box.id = 'mbl-draft-match';
    box.append(el('div', 'dm-kicker', '球探报告 · 球员模板'));

    var styleItems = T.STYLES[m.pos].map(function (s) { return { id: s.id, name: s.name }; });
    box.append(row('打法', seg(styleItems, m.style, function (v) {
      m.style = v; rebuild();
    })));

    var potItems = T.POT_CN.map(function (x) { return { id: x.id, name: x.name }; });
    box.append(row('潜力', seg(potItems, m.pot, function (v) {
      m.pot = v; rebuild();
    })));

    // 三项微调
    T.TWEAK_CN.forEach(function (tk) {
      var r2 = el('div', 'dt-row');
      r2.append(el('label', 'dt-label', tk.name));
      var ctl = el('div', 'dt-tweak');
      var minus = el('button', 'dt-tweak-btn', '−');
      var val = el('span', 'dt-tweak-val', (m.tweak[tk.id] > 0 ? '+' : '') + m.tweak[tk.id]);
      var plus = el('button', 'dt-tweak-btn', '+');
      minus.type = plus.type = 'button';
      minus.addEventListener('click', function () {
        m.tweak[tk.id] = T.clamp(m.tweak[tk.id] - 1, -3, 3); rebuild();
      });
      plus.addEventListener('click', function () {
        m.tweak[tk.id] = T.clamp(m.tweak[tk.id] + 1, -3, 3); rebuild();
      });
      ctl.append(minus, val, plus);
      r2.append(ctl);
      box.append(r2);
    });

    var posName = T.POS_CN[m.pos];
    var hName = T.HEIGHT_CN[m.height];
    box.append(el('p', 'dm-summary',
      '综合定位：' + hName + posName + ' · ' +
      T.STYLES[m.pos].find(function (s) { return s.id === m.style; }).name +
      '（' + T.POT_CN.find(function (x) { return x.id === m.pot; }).name + '）'));
    box.append(el('p', 'dm-tip', '确认后按上面的宣布参选继续；微调只改潜力上限，数值温和。'));
    return box;
  }

  function rebuild() {
    var old = document.querySelector('#mbl-draft-match');
    if (!old || !matched) return;
    old.replaceWith(buildCard(matched));
    applyTweak(de.life.ball, matched);
  }

  function mount() {
    var life = window.de && de.life;
    if (!life || de.screen !== 'play' || !life.ball) return;
    var choice = life.pending && life.pending[0];
    if (!choice || DECLARE_TIDS.indexOf(choice.tid) < 0) return;
    if (document.querySelector('#mbl-draft-match')) return;
    var decideCard = document.querySelector('article.card.decide');
    if (!decideCard) return;

    matched = compute();
    // 记录匹配时的潜力快照，微调基于它叠加
    snapshot = Object.assign({}, life.ball.potential);
    var node = buildCard(matched);
    decideCard.after(node);
  }

  function unmount() {
    var node = document.querySelector('#mbl-draft-match');
    if (node) node.remove();
    matched = null; snapshot = null;
  }

  // 统一 DOM 调度（仅 play）：界面/抉择不符时卸载，匹配时挂载
  C.onDom(function () {
    var life = de.life;
    if (!life || de.screen !== 'play') { unmount(); return; }
    var choice = life.pending && life.pending[0];
    if (!choice || DECLARE_TIDS.indexOf(choice.tid) < 0) { unmount(); return; }
    mount();
  }, 'play');

  window.MBLDraftMatch = {
    mount: mount,
    unmount: unmount
  };
})();
