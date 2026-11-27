/* mbl-float-layer：球队/球员资料卡改为挂在 body 下的独立浮层，
   捕获阶段拦截点击，内核 ER 不执行、不触发 mn 重渲染，原界面与滚动位置保持不变；
   同时去掉 hue 的 2020 年份门槛，并为早期赛季补齐球队名单。 */
(function () {
  'use strict';
  if (window.MBLFloatLayer) return;
  window.hue = function (e, o) { return F_(e, o.leagueId); };
  // 独立浮层宿主（普通 div，不形成层叠上下文，内部 fixed 弹层行为与内核原生一致）
  var clubHost = document.createElement('dialog');
  var shapeHost = document.createElement('dialog');
  var clubContext=null,clubFactories=new Map();
  clubHost.className = shapeHost.className = 'mbl-overlay-host';
  function show(host) {
    if (!host.isConnected) document.body.append(host);
    if (!host.open) host.showModal();
  }
  function closeHost(host) {
    if (host.open) host.close();
    host.remove();
    if(host===clubHost){clubContext=null;clubFactories.clear();}
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
        try {
          var context=xB(de.life);
          clubContext=context?{team:context.team,year:context.season.year}:null;
          clubHost.innerHTML = Ust(de.life);
          clubHost.querySelectorAll('[data-act="shape"][data-v]').forEach(function(control){
            if(TB.has(control.dataset.v))clubFactories.set(control.dataset.v,TB.get(control.dataset.v));
          });
        } finally { de.clubOpen = ''; }
        show(clubHost);
      }
      else de.clubOpen = '';
    } else if (act === 'shape') {
      ev.stopPropagation();
      var cards=window.MBLPlayerCard,life=de.life;
      if(cards&&life){
        if(v==='sbme'||v==='me'){cards.open(cards.current(life));return;}
        if(v.startsWith('sbp:')){
          var season=life.ball?.season;
          var roster=season?.roster||[];
          var depth=node.closest('.depth');
          if(depth){
            var rows=[...depth.querySelectorAll('li[data-act="shape"]')];
            var ordered=roster.slice().sort(function(a,b){return (b.me?L0(life):b.ovr)-(a.me?L0(life):a.ovr);});
            var selected=ordered[rows.indexOf(node.closest('li'))];
            if(selected?.name?.en===v.slice(4)){cards.open(cards.fromRoster(life,season,selected));return;}
          }
          var players=roster.filter(function(p){return p.name?.en===v.slice(4);});
          if(players.length===1){cards.open(cards.fromRoster(life,season,players[0]));return;}
          if(players.length>1)return;
        }
      }
      var inClub=clubHost.contains(node);
      var fn = (inClub?clubFactories.get(v):null) || TB.get(v) || (window.__boxShapes && window.__boxShapes.get(v));
      var data = fn ? fn() : null;
      if(cards&&data&&!data.team){
        if(data.key==='me'){cards.open(cards.current(life));return;}
        if(data.player){
          var context=inClub?clubContext:{year:typeof Gr==='function'?Gr(life):null};
          cards.open(cards.fromScouting(data.player,context||{}));return;
        }
      }
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
