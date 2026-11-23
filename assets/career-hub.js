/* career-hub.js：精简后的主界面事件流。
   - 只保留当前待处理抉择 / 结果 / 通知的轻量提示、年度进度条与推进按钮；
   - 已发生历史、未来节点预告全部移到「人生记录」，不再展示月历与筛选；
   - 独立挂载、不改内核结算，推进仍通过点击现有 [data-act=next] 驱动。 */
(function () {
  'use strict';
  if (window.MBLCareerHub) return;
  var C = window.MBLCore;

  var POOL_CN = {
    business: '事业经营', camp: '训练营', campus: '校园', child: '子女', early: '早年',
    elder: '晚年', game: '关键比赛', hoops: '篮球抉择', job: '工作抉择', life: '生活抉择',
    media: '媒体', money: '财务抉择', offseason: '休赛期', playoffs: '季后赛',
    son: '子女', team: '球队抉择', teen: '青少年'
  };
  var POOL_ICON = {
    game: '🏆', playoffs: '🏆', hoops: '🏀', camp: '🎯', campus: '🎓', life: '🌱',
    job: '💼', money: '💰', media: '🎤', team: '👥', business: '📈', offseason: '🛋️',
    early: '🧒', teen: '🧒', child: '👶', elder: '🌅', son: '👶'
  };

  function life() { return C.life(); }
  var el = C.h;
  // 进联盟后的比赛流：球员（非教练/经理）拥有当年赛季时，线性事件流自我隐藏；
  // 进联盟初期无赛季、但有全屏卡片/待办覆盖时同样隐藏。
  function proFlow(l) {
    if (!l || !(l.ball && l.ball.pro)) return false;
    var s = l.ball.season;
    if (s && !s.staff && s.year === Ee + l.age &&
      (s.phase === 'regular' || s.phase === 'playoffs' || s.phase === 'done')) return true;
    return !s && ((l.pending && l.pending.length) || de.outcome || de.notices.length);
  }
  function nodeLabel(m) {
    if (m.kind === 'season') return '赛季节点';
    if (m.tid && typeof b0 === 'function') {
      var t = b0(m.tid);
      if (t && t.title) return C.hans(t.title);
    }
    return POOL_CN[m.pool] || m.pool || '抉择';
  }
  function iconOf(m) { return m.kind === 'season' ? '🏆' : (POOL_ICON[m.pool] || '▸'); }
  function progOf(l) {
    return (typeof bB === 'function' && bB(l)) ? Math.min(1, de.acc / bB(l)) : 0;
  }

  var hub = el('section', 'mbl-hub');
  hub.id = 'mbl-hub';
  hub.innerHTML =
    '<div class="mbl-hub-top">' +
      '<div class="mbl-hub-date"><b id="mbl-hub-year"></b><span id="mbl-hub-stage"></span></div>' +
    '</div>' +
    '<div class="mbl-hub-progress"><span id="mbl-hub-bar"></span><span id="mbl-hub-mks"></span></div>' +
    '<div id="mbl-hub-current"></div>' +
    '<div class="mbl-hub-cta" id="mbl-hub-cta"></div>';

  // 当前待处理事项：只提示“现在要处理什么”，不罗列历史与未来。
  function renderCurrent(l) {
    var box = el('div', 'mbl-current');
    if (l.pending && l.pending.length) {
      var m = l.pending[0];
      box.classList.add('is-pending');
      box.append(
        el('span', 'mbl-current-ico', iconOf(m)),
        el('span', 'mbl-current-kicker', '待你抉择'),
        el('b', 'mbl-current-text', nodeLabel(m))
      );
    } else if (de.outcome) {
      box.append(el('span', 'mbl-current-ico', '📋'), el('b', 'mbl-current-text', '有结果待查看'));
    } else if (de.notices.length) {
      box.append(el('span', 'mbl-current-ico', '🔔'), el('b', 'mbl-current-text', '有通知待查看'));
    } else {
      box.append(el('span', 'mbl-current-ico', '✦'), el('span', 'mbl-current-text muted', '今年暂无待处理事项，继续推进即可'));
    }
    return box;
  }

  function renderCta(l) {
    var cta = el('div', 'mbl-cta-inner');
    var blocked = (l.pending && l.pending.length) || de.outcome || de.notices.length;
    var next = el('button', 'mbl-cta-next' + (blocked ? ' is-blocked' : ''));
    next.type = 'button';
    if (l.pending && l.pending.length) next.textContent = '请先处理当前抉择';
    else if (de.outcome) next.textContent = '请先查看当前结果';
    else if (de.notices.length) next.textContent = '请先查看通知';
    else next.textContent = '前往下一个 »';
    next.disabled = !!blocked;
    next.onclick = function () {
      var b = document.querySelector('main.play [data-act="next"]');
      if (b && !b.disabled) b.click();
    };
    cta.append(next);
    return cta;
  }

  var TROPHY_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.5h7v2.8a3.5 3.5 0 0 1-7 0z" fill="currentColor"/><path d="M4.5 3.6H2.7v.7a2.6 2.6 0 0 0 2.4 2.6M11.5 3.6h1.8v.7a2.6 2.6 0 0 1-2.4 2.6M8 8.8v2.4M5.4 13.3h5.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

  // 进度条上的事件标记（对齐原版 .mk）：decision 圆点、season 奖杯，仅作轻量位置提示。
  function renderMarks(l) {
    var layer = hub.querySelector('#mbl-hub-mks');
    if (!layer) return;
    layer.replaceChildren();
    (l.moments || []).filter(function (m) { return m.kind !== 'event'; }).forEach(function (m) {
      var mk = el('i', 'mbl-hub-mk ' + m.kind);
      mk.style.left = (m.at * 100).toFixed(1) + '%';
      if (m.kind === 'season') mk.innerHTML = TROPHY_SVG;
      layer.append(mk);
    });
  }

  var lastSig = '';
  function signature(l) {
    return JSON.stringify({
      age: l.age, alive: l.alive, pro: !!(l.ball && l.ball.pro),
      pend: (l.pending || []).map(function (m) { return [m.kind, m.pool, m.tid]; }),
      outcome: de.outcome, notices: de.notices.length,
      moments: (l.moments || []).map(function (m) { return [m.at.toFixed(4), m.kind, m.pool, m.tid]; })
    });
  }

  function render() {
    var l = life();
    if (!l) { hub.style.display = 'none'; lastSig = ''; return; }
    if (proFlow(l)) { hub.style.display = 'none'; return; }
    hub.style.display = '';
    var year = hub.querySelector('#mbl-hub-year');
    var stage = hub.querySelector('#mbl-hub-stage');
    year.textContent = (typeof Gr === 'function') ? Gr(l) + '年' : (l.age + '岁');
    var pro = l.ball && l.ball.pro;
    stage.textContent = l.alive === false ? '已完结'
      : (pro ? '职业阶段' : (l.age < 14 ? '成长阶段' : '青年阶段')) + ' · ' + l.age + '岁';

    hub.querySelector('#mbl-hub-bar').style.width = (progOf(l) * 100).toFixed(1) + '%';

    var sig = signature(l);
    if (sig === lastSig) return;
    lastSig = sig;
    renderMarks(l);
    hub.querySelector('#mbl-hub-current').replaceChildren(renderCurrent(l));
    hub.querySelector('#mbl-hub-cta').replaceChildren(renderCta(l));
  }

  function wireDash(main) {
    var dash = main.querySelector('.dash');
    if (!dash) return;
    dash.classList.remove('mbl-dash-collapsed');
    var old = dash.previousElementSibling;
    if (old && old.classList.contains('mbl-dash-toggle')) old.parentNode.removeChild(old);
  }

  function mount() {
    if (!window.de || de.screen !== 'play') {
      if (hub.parentNode) hub.parentNode.removeChild(hub);
      return;
    }
    var main = document.querySelector('main.play');
    if (!main) return;
    var home = main.querySelector('.mbl-view[data-view="home"]');
    if (!home) return;
    if (home.contains(hub)) { render(); wireDash(main); return; }
    if (hub.parentNode) hub.parentNode.removeChild(hub);
    home.append(hub);
    render();
    wireDash(main);
  }

  function inside(node, root) {
    return node === root || !!(root.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_CONTAINED_BY);
  }
  function onDomChange(muts) {
    muts = muts || [];
    for (var i = 0; i < muts.length; i++) {
      var t = muts[i].target;
      if (inside(t, hub)) continue;
      if (t.classList && t.classList.contains('dash')) continue;
      mount();
      return;
    }
  }
  C.onDom(onDomChange, 'play');
  mount();
  window.MBLCareerHub = { refresh: render, mount: mount };
})();
