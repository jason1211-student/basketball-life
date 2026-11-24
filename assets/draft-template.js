/* 自定义选秀模板（单机复刻扩展，体验参照 NBA 2K 的创建球员）。
 * 在出生界面提供「位置 + 惯用手 + 打法 + 身高/体重/臂展 + 潜力倾向 + 四项关键微调」，
 * 身体三要素对齐 2K MyPLAYER Builder：身高定位置区间、体重压对抗与速度、臂展换干扰与投篮。
 * 包装内核 Got：每次生成新生命（rFe 产出 ball）后，把模板温和地应用到 ball ——
 * 通过成年身高 + 潜力/风格倾向，让内核自然推导出目标位置与打法，不硬改位置、不破坏平衡。
 * 模板与选秀时代解耦，五个时代通用；不设模板时完全不影响原流程。 */
(function () {
  'use strict';
  if (window.MBLDraftTemplate) return;
  var C = window.MBLCore;
  var SKILLS = C.SKILLS;

  // 各位置三档身高（short/standard/tall），严格落在该位置安全区间，避免跨位置
  var POS_HEIGHT = {
    pg: [186, 190, 193], sg: [193, 195, 196], sf: [198, 200, 202],
    pf: [203, 205, 207], c: [208, 212, 216]
  };

  // 打法风格：位置 -> 风格列表
  var STYLES = {
    pg: [
      { id: 'playmaker', name: '组织核心', w: { handling: 5, passing: 6, iq: 4, three: 1, finishing: -3, interiorD: -2, rebounding: -4 } },
      { id: 'scorer', name: '得分控卫', w: { three: 5, mid: 4, finishing: 3, handling: 3, passing: -2, interiorD: -3, rebounding: -4 } }
    ],
    sg: [
      { id: 'shooter', name: '无球射手', w: { three: 7, mid: 4, handling: 1, passing: -2, finishing: -2, rebounding: -4, interiorD: -3 } },
      { id: 'slasher', name: '突破分卫', w: { finishing: 6, athleticism: 5, handling: 3, mid: 2, three: -2, rebounding: -2 } }
    ],
    sf: [
      { id: 'scorer', name: '得分锋线', w: { mid: 5, three: 4, finishing: 4, athleticism: 2, passing: -2, interiorD: -2 } },
      { id: 'twoway', name: '双向锋线', w: { perimeterD: 6, athleticism: 4, finishing: 3, three: 3, iq: 2, passing: -2 } }
    ],
    pf: [
      { id: 'stretch', name: '空间大前', w: { three: 6, mid: 4, rebounding: 1, interiorD: 1, finishing: -2, athleticism: -1 } },
      { id: 'bruiser', name: '强硬内线', w: { interiorD: 5, rebounding: 6, finishing: 5, athleticism: 3, three: -5, handling: -4, passing: -3 } }
    ],
    c: [
      { id: 'rim', name: '护框中锋', w: { interiorD: 7, rebounding: 6, athleticism: 4, finishing: 3, three: -6, handling: -5, passing: -3 } },
      { id: 'post', name: '低位中锋', w: { finishing: 6, mid: 4, rebounding: 5, interiorD: 4, three: -4, handling: -3 } }
    ]
  };

  var POS_CN = { pg: '控卫', sg: '分卫', sf: '小前', pf: '大前', c: '中锋' };
  var HEIGHT_CN = ['偏矮', '标准', '偏高'];
  var WEIGHT_CN = [{ id: 'light', name: '偏轻' }, { id: 'standard', name: '标准' }, { id: 'heavy', name: '偏重' }];
  var HAND_CN = [{ id: 'right', name: '右手' }, { id: 'left', name: '左手' }];
  var POT_CN = [{ id: 'ready', name: '即战力' }, { id: 'balanced', name: '均衡' }, { id: 'high', name: '高潜力' }];
  var TWEAK_CN = [
    { id: 'shoot', name: '投篮' }, { id: 'play', name: '组织' },
    { id: 'ath', name: '运动' }, { id: 'def', name: '防守' }
  ];

  // 默认模板
  function defaultState() {
    return {
      enabled: false, pos: 'sg', style: 'shooter', hand: 'right',
      height: 1, weight: 'standard', wing: 0, pot: 'balanced',
      tweak: { shoot: 0, play: 0, ath: 0, def: 0 }
    };
  }

  var state = defaultState();

  var el = C.h;
  var clamp = C.clamp;

  function currentStyle() {
    var list = STYLES[state.pos];
    for (var i = 0; i < list.length; i++) if (list[i].id === state.style) return list[i];
    return list[0];
  }

  // ===== 把模板应用到 ball（rFe 之后）=====
  function applyToBall(ball) {
    if (!state.enabled || !ball) return;

    // 1) 成年身高 + 翼展（翼展由独立臂展档位驱动，每档约 2cm）
    var h = POS_HEIGHT[state.pos][state.height];
    var oldH = ball.adultHeight;
    ball.adultHeight = h;
    ball.height = Math.round(h * (oldH ? ball.height / oldH : 0.4));
    if (ball.wingspan) {
      var randomDelta = clamp(ball.wingspan - oldH, -6, 8);
      ball.wingspan = h + randomDelta + state.wing * 2;
    }
    ball.mblHandedness = state.hand;

    // 2) 潜力：打法风格权重
    var sty = currentStyle();
    SKILLS.forEach(function (k) {
      var w = sty.w[k] || 0;
      ball.potential[k] = clamp(Math.round(Number(ball.potential[k]) + w), 35, 99);
    });

    // 3) 体重：偏轻提速、偏重压对抗
    if (state.weight === 'light') {
      ball.potential.athleticism = clamp(ball.potential.athleticism + 2, 35, 99);
      ball.potential.finishing = clamp(ball.potential.finishing - 1, 35, 99);
      ball.potential.interiorD = clamp(ball.potential.interiorD - 1, 35, 99);
      ball.potential.rebounding = clamp(ball.potential.rebounding - 2, 35, 99);
    } else if (state.weight === 'heavy') {
      ball.potential.finishing = clamp(ball.potential.finishing + 2, 35, 99);
      ball.potential.interiorD = clamp(ball.potential.interiorD + 2, 35, 99);
      ball.potential.rebounding = clamp(ball.potential.rebounding + 2, 35, 99);
      ball.potential.athleticism = clamp(ball.potential.athleticism - 2, 35, 99);
      ball.potential.three = clamp(ball.potential.three - 1, 35, 99);
      if (ball.injuryProne) ball.injuryProne = clamp(ball.injuryProne - 6, 5, 95);
    }

    // 4) 臂展独立微调：长臂加干扰/篮板、短臂保投篮（每档 1 点，±2 档）
    var ws = state.wing;
    if (ws !== 0) {
      ball.potential.interiorD = clamp(ball.potential.interiorD + ws, 35, 99);
      ball.potential.perimeterD = clamp(ball.potential.perimeterD + ws, 35, 99);
      ball.potential.rebounding = clamp(ball.potential.rebounding + ws, 35, 99);
      ball.potential.three = clamp(ball.potential.three - ws, 35, 99);
      ball.potential.mid = clamp(ball.potential.mid - ws, 35, 99);
    }

    // 5) 四项关键微调（温和，-3..+3）
    var t = state.tweak;
    ball.potential.three = clamp(ball.potential.three + t.shoot, 35, 99);
    ball.potential.mid = clamp(ball.potential.mid + t.shoot, 35, 99);
    ball.potential.finishing = clamp(ball.potential.finishing + t.shoot, 35, 99);
    ball.potential.handling = clamp(ball.potential.handling + t.play, 35, 99);
    ball.potential.passing = clamp(ball.potential.passing + t.play, 35, 99);
    ball.potential.athleticism = clamp(ball.potential.athleticism + t.ath, 35, 99);
    ball.potential.perimeterD = clamp(ball.potential.perimeterD + t.def, 35, 99);
    ball.potential.interiorD = clamp(ball.potential.interiorD + t.def, 35, 99);

    // 6) 潜力倾向：即战力/高潜力
    if (state.pot === 'ready') {
      SKILLS.forEach(function (k) {
        ball.potential[k] = clamp(ball.potential[k] - 3, 35, 99);
        ball.skills[k] = Math.round(ball.potential[k] * 0.32);
      });
    } else if (state.pot === 'high') {
      SKILLS.forEach(function (k) {
        ball.potential[k] = clamp(ball.potential[k] + 5, 35, 99);
        ball.skills[k] = 0;
      });
    }

    // 7) 同步 style/lead，并按目标位置做最小锚定，保证位置稳定推导
    var inside = ball.potential.rebounding + ball.potential.interiorD -
      ball.potential.three - ball.potential.handling;
    var wing = ball.potential.finishing + ball.potential.perimeterD -
      ball.potential.handling - ball.potential.passing;
    var lead = ball.potential.handling + ball.potential.passing -
      ball.potential.three - ball.potential.finishing;

    if (ball.style) {
      if (state.pos === 'pg') {
        // 走 guard：压低 wing 让 kn 判 guard，抬高 lead 到 >=2
        wing = Math.min(wing, 6); lead = Math.max(lead, 4);
      } else if (state.pos === 'sg') {
        // 走 wing（n<197→sg）：抬高 wing 到 >=8
        wing = Math.max(wing, 10);
      } else if (state.pos === 'pf') {
        // 走 wing/big 都到 pf：保证 inside>=3
        inside = Math.max(inside, 6);
      }
      // sf（198-202 自动 wing→sf）、c（>=208 自动 big→c）无需校正
      ball.style.inside = Math.round(inside);
      ball.style.wing = Math.round(wing);
    }
    if (ball.lead != null) ball.lead = Math.round(lead);
  }

  // ===== 出生界面 UI =====
  function seg(cls, items, value, onpick) {
    var wrap = el('div', 'dt-seg ' + cls);
    items.forEach(function (it) {
      var b = el('button', 'dt-opt' + (it.id === value || it === value ? ' on' : ''), it.name || it);
      b.type = 'button'; b.dataset.value = it.id || it;
      b.addEventListener('click', function () { onpick(it.id || it); });
      wrap.append(b);
    });
    return wrap;
  }

  function row(label, node) {
    var r = el('div', 'dt-row');
    r.append(el('label', 'dt-label', label), node);
    return r;
  }

  // 臂展档位说明：-2..2，0 为标准
  function wingLabel(v) {
    if (v < 0) return '短臂 ' + v;
    if (v > 0) return '长臂 +' + v;
    return '标准';
  }

  function buildPanel() {
    var box = el('section', 'mbl-draft-template card');
    box.id = 'mbl-draft-template';

    var head = el('div', 'dt-head');
    var title = el('h2', '', '自定义选秀模板');
    var sw = el('button', 'dt-switch' + (state.enabled ? ' on' : ''), state.enabled ? '已启用' : '未启用');
    sw.type = 'button';
    sw.addEventListener('click', function () {
      state.enabled = !state.enabled;
      refresh();
      applyToCurrent();
    });
    head.append(title, sw);
    box.append(head);
    box.append(el('p', 'dt-tip', '启用后按你的设定塑造球员；不启用则完全随机，和原来一样。'));

    var body = el('div', 'dt-body' + (state.enabled ? '' : ' disabled'));
    body.id = 'dt-body';
    box.addEventListener('click', function (ev) {
      if (ev.target.closest('.dt-switch')) return;
      if (!state.enabled && ev.target.closest('.dt-opt, .dt-tweak-btn')) state.enabled = true;
    }, true);

    // 位置
    var posItems = Object.keys(POS_CN).map(function (k) { return { id: k, name: POS_CN[k] }; });
    body.append(row('位置', seg('dt-seg5', posItems, state.pos, function (v) {
      state.pos = v;
      // 切换位置后，若当前风格不在该位置则重置为第一个
      var ids = STYLES[v].map(function (s) { return s.id; });
      if (ids.indexOf(state.style) < 0) state.style = ids[0];
      refresh(); applyToCurrent();
    })));

    // 惯用手
    body.append(row('惯用手', seg('', HAND_CN, state.hand, function (v) {
      state.hand = v; refresh(); applyToCurrent();
    })));

    // 打法
    var styleItems = STYLES[state.pos].map(function (s) { return { id: s.id, name: s.name }; });
    body.append(row('打法', seg('', styleItems, state.style, function (v) {
      state.style = v; refresh(); applyToCurrent();
    })));

    // 身高
    var hItems = HEIGHT_CN.map(function (n, i) { return { id: i, name: n }; });
    body.append(row('身高', seg('dt-seg3', hItems, state.height, function (v) {
      state.height = Number(v); refresh(); applyToCurrent();
    })));

    // 体重
    body.append(row('体重', seg('dt-seg3', WEIGHT_CN, state.weight, function (v) {
      state.weight = v; refresh(); applyToCurrent();
    })));

    // 臂展（独立加减，-2..2）
    var wingRow = el('div', 'dt-row');
    wingRow.append(el('label', 'dt-label', '臂展'));
    var wingCtl = el('div', 'dt-tweak');
    var wMinus = el('button', 'dt-tweak-btn', '−');
    var wVal = el('span', 'dt-tweak-val', wingLabel(state.wing));
    var wPlus = el('button', 'dt-tweak-btn', '+');
    wMinus.type = wPlus.type = 'button';
    wMinus.addEventListener('click', function () {
      state.wing = clamp(state.wing - 1, -2, 2);
      refresh(); applyToCurrent();
    });
    wPlus.addEventListener('click', function () {
      state.wing = clamp(state.wing + 1, -2, 2);
      refresh(); applyToCurrent();
    });
    wingCtl.append(wMinus, wVal, wPlus);
    wingRow.append(wingCtl);
    body.append(wingRow);

    // 潜力倾向
    body.append(row('潜力', seg('dt-seg3', POT_CN, state.pot, function (v) {
      state.pot = v; refresh(); applyToCurrent();
    })));

    // 四项微调
    TWEAK_CN.forEach(function (tk) {
      var cur = state.tweak[tk.id];
      var r2 = el('div', 'dt-row');
      r2.append(el('label', 'dt-label', tk.name));
      var ctl = el('div', 'dt-tweak');
      var minus = el('button', 'dt-tweak-btn', '−');
      var val = el('span', 'dt-tweak-val', (cur > 0 ? '+' : '') + cur);
      var plus = el('button', 'dt-tweak-btn', '+');
      minus.type = plus.type = 'button';
      minus.addEventListener('click', function () {
        state.tweak[tk.id] = clamp(state.tweak[tk.id] - 1, -3, 3);
        refresh(); applyToCurrent();
      });
      plus.addEventListener('click', function () {
        state.tweak[tk.id] = clamp(state.tweak[tk.id] + 1, -3, 3);
        refresh(); applyToCurrent();
      });
      ctl.append(minus, val, plus);
      r2.append(ctl);
      body.append(r2);
    });

    box.append(body);
    return box;
  }

  // 出生界面每次改动都走 Got 干净重算，但必须保留玩家在别处手动设置的出生背景与出生加成，
  // 否则启用建模会把这些数据冲回默认值。
  var rebornBusy = false;

  function applyToCurrent() {
    if (!state.enabled || rebornBusy) return;
    var l = window.de && de.life;
    if (l && l.ball && l.age === 0) reborn();
  }

  // 当前 life 的出生背景参数（与 birth-customize 的 collect 口径一致）
  function birthParams(l) {
    var city = l.urban ? (l.city && l.city.en ? l.city.en : l.city) : '';
    return {
      country: l.country,
      urban: l.urban,
      city: city,
      quintile: l.quintile,
      gift: l.gift
    };
  }

  // 带当前模板重新生成（不改变随机种子，rFe 重新产出 ball，再应用模板），
  // 同时保留出生背景，并在重算后重新点亮已选的出生加成。
  async function reborn() {
    if (rebornBusy) return;
    var l = window.de && de.life;
    if (!l) return;
    rebornBusy = true;
    var savedPerks = (l.mblBirthPerks && l.mblBirthPerks.keys) || [];
    var bp = birthParams(l);
    window.Got({
      seed: l.seed,
      difficulty: 'easy',
      country: bp.country,
      urban: bp.urban,
      city: bp.city,
      quintile: bp.quintile,
      gift: bp.gift
    });
    await C.wait(80);
    // 重新点亮之前的加成（走完整点击流程，保证属性 changes 正确）
    for (var i = 0; i < savedPerks.length; i++) {
      var card = document.querySelector('.perk-card[data-v="' + savedPerks[i] + '"]');
      if (card && !card.disabled) { card.click(); await C.wait(450); }
    }
    await C.wait(60);
    rebornBusy = false;
    refresh();
  }

  function refresh() {
    var main = document.querySelector('main.birth');
    if (!main) return;
    var existing = main.querySelector('#mbl-draft-template');
    var fresh = buildPanel();
    if (existing) existing.replaceWith(fresh); else mount();
  }

  function mount() {
    var main = document.querySelector('main.birth');
    if (!main) return;
    if (main.querySelector('#mbl-draft-template')) return;
    var anchor = main.querySelector('#mbl-birth-custom');
    var node = buildPanel();
    if (anchor) anchor.after(node); else main.append(node);
  }

  // 包装 Got：原 Got 生成后，若启用模板则应用
  var origGot = window.Got;
  window.Got = function (params) {
    var r = origGot.apply(this, arguments);
    if (state.enabled && de.life && de.life.ball) {
      applyToBall(de.life.ball);
      if (window.Nt) Nt.saveLife(de.life);
    }
    return r;
  };

  // 统一 DOM 调度，仅在 birth 界面触发挂载
  C.onDom(mount, 'birth');

  window.MBLDraftTemplate = {
    state: state,
    applyToBall: applyToBall,
    mount: mount,
    // 供后续模块（选秀接入/报告/直接进 NBA）使用
    SKILLS: SKILLS,
    POS_CN: POS_CN,
    STYLES: STYLES,
    POS_HEIGHT: POS_HEIGHT,
    HEIGHT_CN: HEIGHT_CN,
    WEIGHT_CN: WEIGHT_CN,
    HAND_CN: HAND_CN,
    POT_CN: POT_CN,
    TWEAK_CN: TWEAK_CN,
    clamp: clamp
  };
})();
