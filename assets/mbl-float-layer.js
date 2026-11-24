/* mbl-float-layer：球队/球员资料卡改为挂在 body 下的独立浮层，
   捕获阶段拦截点击，内核 ER 不执行、不触发 mn 重渲染，原界面与滚动位置保持不变；
   同时去掉 hue 的 2020 年份门槛，并为早期赛季补齐球队名单。 */
(function () {
  'use strict';
  if (window.MBLFloatLayer) return;
  var TARGET = 14;

  // 去掉 hue 的年份门槛，早期赛季其他球队也能点开
  window.hue = function (e, o) { return F_(e, o.leagueId); };

  // 早期赛季名单不足时，按位置用程序化球员补齐到 14 人
  var origI = window.I_;
  function needPos(list) {
    var g = list.filter(function (x) { return x.player.pos === 'guard'; }).length;
    var w = list.filter(function (x) { return x.player.pos === 'wing'; }).length;
    return g < 5 ? 'guard' : (w < 5 ? 'wing' : 'big');
  }
  window.I_ = function (e, o, team, yr) {
    var list = origI(e, o, team, yr);
    if (yr >= Rs || list.length >= TARGET) return list;
    var used = new Set(list.map(function (x) { return x.player.name.en; }));
    while (list.length < TARGET) {
      var pos = needPos(list), nh = Nh(e, o, pos, used), age = nh.age;
      var player = {
        name: nh.name, born: yr - age, country: e.country, pos: pos,
        at: pos === 'guard' ? 'pg' : (pos === 'wing' ? 'sf' : 'c'),
        peak: nh.ovr + Math.max(0, 23 - age) * 3, legend: false, stints: []
      };
      list.push({ player: player, since: null, mood: null, years: null, pay: null });
      used.add(nh.name.en);
    }
    return list;
  };

  // 独立浮层宿主（普通 div，不形成层叠上下文，内部 fixed 弹层行为与内核原生一致）
  var clubHost = document.createElement('dialog');
  var shapeHost = document.createElement('dialog');
  clubHost.className = shapeHost.className = 'mbl-overlay-host';
  function show(host) {
    if (!host.isConnected) document.body.append(host);
    if (!host.open) host.showModal();
  }
  function closeHost(host) {
    if (host.open) host.close();
    host.remove();
  }
  [clubHost, shapeHost].forEach(function (host) {
    host.addEventListener('click', function (event) {
      if (event.target.classList.contains('modal-backdrop')) closeHost(host);
    });
    host.addEventListener('cancel', function (event) {
      event.preventDefault();
      closeHost(host);
    });
  });

  // 捕获阶段拦截，阻止冒泡到 ER
  document.addEventListener('click', function (ev) {
    var node = ev.target.closest('[data-act]');
    if (!node) return;
    var act = node.dataset.act, v = node.dataset.v || '';
    if (act === 'club') {
      ev.stopPropagation();
      closeHost(shapeHost);
      closeHost(clubHost);
      if (v) {
        de.clubOpen = v;
        try { clubHost.innerHTML = Ust(de.life); } finally { de.clubOpen = ''; }
        show(clubHost);
      }
      else de.clubOpen = '';
    } else if (act === 'shape') {
      ev.stopPropagation();
      var fn = TB.get(v) || (window.__boxShapes && window.__boxShapes.get(v));
      var data = fn ? fn() : null;
      if (data) { shapeHost.innerHTML = Kst(data); show(shapeHost); }
    } else if (act === 'shapeclose') {
      ev.stopPropagation();
      closeHost(shapeHost);
    }
  }, true);

  // Esc 关闭浮层：先资料卡，再球队
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    if (shapeHost.isConnected && window.MBLInteraction?.isTop(shapeHost)) { ev.preventDefault(); closeHost(shapeHost); ev.stopPropagation(); }
    else if (clubHost.isConnected && window.MBLInteraction?.isTop(clubHost)) { ev.preventDefault(); closeHost(clubHost); de.clubOpen = ''; ev.stopPropagation(); }
  }, true);

  window.MBLFloatLayer = {};
})();
