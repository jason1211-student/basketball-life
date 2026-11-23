/* home-inline.js：主界面内联区块——身份卡、与家人同住插图、人生记录。
   - 身份卡 SX、家人场景 HX 直接复用内核卡片；
   - 人生记录承接从事件流挪走的「接下来」未来节点预告，并内嵌完整人生纪录 Sue（含全部历史）；
   - 挂载在 #app 内 main.play，卡片里的 data-act 天然由内核 ER 处理，无需额外转发。 */
(function () {
  'use strict';
  if (window.MBLHomeInline) return;
  var C = window.MBLCore;
  var el = C.h;
  var CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
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
  // 进联盟后的比赛流：球员拥有当年赛季时，身份卡/人生记录等内联区块自我隐藏；
  // 进联盟初期无赛季、但有全屏卡片覆盖时同样隐藏。
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
  function isKey(m) { return m.kind === 'season' || m.pool === 'game' || m.pool === 'playoffs'; }
  function dateOf(at) {
    var d = Math.min(364, Math.max(0, Math.floor(at * 365)));
    var mo = 0;
    while (mo < 11 && CUM[mo + 1] <= d) mo++;
    return { month: mo + 1, day: d - CUM[mo] + 1 };
  }
  function toNode(html) {
    var t = document.createElement('div');
    t.innerHTML = html;
    return t.firstElementChild;
  }

  var box = el('div', 'mbl-home-inline');

  // 「接下来」未来节点预告（从事件流挪入），只读提示，不打断主流程。
  function renderUpcoming(l) {
    var wrap = el('div', 'mbl-hr-up');
    wrap.append(el('p', 'mbl-hr-sub', '接下来'));
    var nodes = (l.moments || []).slice().sort(function (a, b) { return a.at - b.at; });
    if (!nodes.length) {
      wrap.append(el('p', 'mbl-hr-empty', '今年没有可预先标注的节点，继续推进即可。'));
      return wrap;
    }
    nodes.forEach(function (m) {
      var d = dateOf(m.at);
      var row = el('div', 'mbl-hr-node' + (isKey(m) ? ' key' : ''));
      row.append(
        el('span', 'mbl-hr-date', d.month + '/' + d.day),
        el('span', 'mbl-hr-ico', iconOf(m)),
        el('span', 'mbl-hr-text', nodeLabel(m))
      );
      if (isKey(m)) row.append(el('span', 'mbl-hr-tag', '关键'));
      wrap.append(row);
    });
    return wrap;
  }

  var lastSig = '';
  function signature(l) {
    return JSON.stringify({
      age: l.age,
      moments: (l.moments || []).map(function (m) { return [m.at.toFixed(4), m.kind, m.pool, m.tid]; }),
      logCount: l.log.length, fullLog: de.fullLog, name: l.name && l.name.en
    });
  }

  function render() {
    var l = life();
    if (!l) { if (box.parentNode) box.parentNode.removeChild(box); lastSig = ''; return; }
    if (proFlow(l)) { box.style.display = 'none'; return; }
    box.style.display = '';
    var sig = signature(l);
    if (sig === lastSig) return;
    lastSig = sig;

    box.replaceChildren();
    // 人生记录模块放在身份卡上方
    var rec = el('section', 'card tone-sky mbl-home-record');
    rec.append(renderUpcoming(l));
    var logWrap = el('div', 'mbl-hr-log');
    logWrap.innerHTML = Sue(l);
    rec.append(logWrap);
    box.append(rec);
    box.append(toNode(SX(l)), toNode(HX(l)));
  }

  function mount() {
    if (!window.de || de.screen !== 'play') {
      if (box.parentNode) box.parentNode.removeChild(box);
      return;
    }
    var main = document.querySelector('main.play');
    if (!main) return;
    var home = main.querySelector('.mbl-view[data-view="home"]');
    if (!home) return;
    if (!home.contains(box)) {
      var hub = home.querySelector('#mbl-hub');
      if (hub) hub.after(box); else home.append(box);
    }
    render();
  }

  function inside(node, root) {
    return node === root || !!(root.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_CONTAINED_BY);
  }
  function onDomChange(muts) {
    muts = muts || [];
    for (var i = 0; i < muts.length; i++) {
      var t = muts[i].target;
      if (inside(t, box)) continue;
      mount();
      return;
    }
  }
  C.onDom(onDomChange, 'play');
  mount();
  window.MBLHomeInline = { refresh: render, mount: mount };
})();
