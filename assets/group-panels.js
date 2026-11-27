/* group-panels.js：四个导航视图的内容渲染。
   - 视图内容复用内核卡片函数（返回 HTML 字符串，空串自动跳过）；
   - 篮球视图额外内嵌「自建属性系统 + 徽章」（MBLBadgePanel.renderInto）；
   - 球队视图在合同卡之外新增「阵容名单」（基于赛季实际建模的 season.roster）；
   - 容器位于 #app 内视图，卡片里的 data-act 点击由内核 ER 统一处理。 */
(function () {
  'use strict';
  if (window.MBLGroupPanels) return;
  var C = window.MBLCore;
  var el = C.h;
  function life() { return C.life(); }

  // 把卡片函数返回的 HTML 字符串加入容器（空串跳过）
  function addHtml(container, html) {
    if (!html || !html.trim()) return false;
    var t = document.createElement('div');
    t.innerHTML = html;
    while (t.firstChild) container.append(t.firstChild);
    return true;
  }

  function renderBall(l, c) {
    var badgeWrap = el('div', 'mbl-group-badges');
    if (window.MBLBadgePanel) window.MBLBadgePanel.renderInto(badgeWrap, l);
    c.append(badgeWrap);
    addHtml(c, BX(l));
    addHtml(c, NX(l));
  }

  // 阵容名单：用赛季实际建模的 ball.season.roster（含 name/pos/age/ovr，me 标记玩家自己）
  function renderRoster(l, c) {
    var b = l.ball;
    var season = b.season;
    var roster = season && Array.isArray(season.roster) ? season.roster : null;
    var card = el('section', 'card mbl-roster');
    card.append(el('h4', 'jsec', '阵容名单'));
    if (!roster || !roster.length) {
      card.append(el('p', 'muted small', b.pro
        ? '赛季开始后这里会显示完整阵容名单。'
        : '进入职业、赛季开始后这里会显示球队阵容。'));
      c.append(card);
      return;
    }
    var ul = el('ul', 'mbl-roster-list');
    roster.slice().sort(function (a, b2) { return b2.ovr - a.ovr; }).forEach(function (w) {
      var li = el('li', 'mbl-roster-row' + (w.me ? ' is-me' : ''));
      var row=window.MBLPlayerCard.button(()=>window.MBLPlayerCard.fromRoster(l,season,w),C.hans(w.name));
      row.classList.add('mbl-roster-card-button');
      row.replaceChildren(
        el('span','mbl-roster-name',C.hans(w.name)+(w.me?'（你）':'')),
        el('span', 'mbl-roster-pos', C.hans(d_[Mp(w)])),
        el('span', 'mbl-roster-age', Number.isFinite(w.age)?w.age+'岁':'—'),
        el('b', 'mbl-roster-ovr', String(w.ovr))
      );
      li.append(row);
      ul.append(li);
    });
    card.append(ul);
    c.append(card);
  }

  // f$ 在「赛季进行中、当前签约球队、非教练」时已通过 ik 内嵌完整阵容；
  // 复刻其 ne 条件判断，仅在它不显示阵容（休赛期/刚签约/赛季未开始）时补充，避免重复。
  function fHasInlineRoster(l) {
    var b = l.ball, s = b.season, p = b.pro;
    if (!s || !p || s.staff) return false;
    if (!s.team || s.team.en !== p.team.en) return false;
    return s.year >= Gr(l) - 1;
  }

  function renderTeam(l, c) {
    if (window.MBLArenaSports) {
      const room=window.MBLTeamRoom?.view(l);
      const items=[['overview','赛季概览'],['roster','阵容与合同'],['history','比赛记录']];
      if(room)items.splice(1,0,['room','更衣室']);
      var panels = MBLArenaSports.tabs(c, 'team', items);
      if(room){
        window.MBLTeamRoomPanel.render(l,panels.room);
        const link=el('button','mbl-room-summary');
        link.type='button';link.append(el('strong','',room.roleName+' · '+room.planned+' 分钟'),el('span','','球队领袖 · '+room.leader+'　›'));
        link.onclick=()=>c.querySelector('[data-arena-tab="room"]').click();
        panels.overview.append(link);
      }
      panels.overview.append(MBLArenaSports.teamOverview(l));
      panels.history.dataset.arenaHistory = '';
      addHtml(panels.roster, f$(l));
      if (!fHasInlineRoster(l)) renderRoster(l, panels.roster);
    } else {
      addHtml(c, f$(l));
      if (!fHasInlineRoster(l)) renderRoster(l, c);
    }
  }
  function renderJourney(l, c) {
    if(window.MBLArenaLegacy&&window.MBLArenaSports){
      var panels=MBLArenaSports.tabs(c,'journey',[['overview','生涯总览'],['honors','荣誉室'],['seasons','赛季档案'],['timeline','人生轨迹']]);
      panels.overview.append(MBLArenaLegacy.overview(l));addHtml(panels.overview,EX(l));addHtml(panels.overview,PX(l));
      panels.honors.append(MBLArenaLegacy.honors(l));if(!addHtml(panels.honors,TX(l)))panels.honors.append(el('p','mbl-group-empty','还未获得荣誉，每一步努力都将被记录。'));
      panels.seasons.append(MBLArenaLegacy.seasons(l));
      addHtml(panels.timeline,AX(l));panels.timeline.append(MBLArenaLegacy.timeline(l));
      return;
    }
    addHtml(c, EX(l));
    addHtml(c, TX(l));
    addHtml(c, AX(l));
    addHtml(c, PX(l));
  }
  function renderPeople(l, c) {
    if(window.MBLRelationsMessages){
      var info=MBLRelationsMessages.summary(l),card=el('section','arena-social-hub');
      var phone=MBLRelationsMessages.canUsePhone(l);
      card.append(el('span','arena-eyebrow','OFF COURT / CONNECTIONS'),el('h3','',phone?'私人生活':'家庭与成长'));
      var grid=el('div','arena-social-grid'+(phone?'':' is-childhood'));
      var destinations=phone
        ? [['messages','通讯录与短信',info.unread+' 条未读'],['relationships','人物关系',info.contacts+' 位联系人'],['appointments','私人约定',info.appointments+' 项待办']]
        : [['relationships','家庭与亲友','陪伴家人、与朋友相处']];
      destinations.forEach(function(item){var b=el('button','arena-social-entry');b.type='button';b.dataset.mblAlertKind=item[0];b.append(el('b','',item[1]),el('span','',item[2]));b.onclick=function(){window.MBLRelationsPanel?.open(item[0]);};grid.append(b);});
      card.append(grid);c.append(card);
    }
    addHtml(c, DX(l));
    addHtml(c, zX(l));
    addHtml(c, WX(l));
    addHtml(c, qX(l));
  }

  var RENDERERS = {
    ball: { fn: renderBall, empty: '还没开始篮球相关安排，随着推进会出现在这里。' },
    team: { fn: renderTeam, empty: '目前还没有签约球队，进入职业后这里会显示球队与合同。' },
    journey: { fn: renderJourney, empty: '还没有累积生涯数据与荣誉，先继续推进人生。' },
    people: { fn: renderPeople, empty: '身边的人和出生地信息会随成长逐渐出现。' }
  };

  function renderGroup(id, container) {
    var l = life();
    container.replaceChildren();
    if (!l) { container.append(el('p', 'mbl-group-empty', '开始一段人生后这里才有内容。')); return; }
    var cfg = RENDERERS[id];
    cfg.fn(l, container);
    if (!container.children.length) container.append(el('p', 'mbl-group-empty', cfg.empty));
    window.MBLArena?.decorateView(id, container);
  }

  window.MBLGroupPanels = { renderGroup: renderGroup, ids: Object.keys(RENDERERS) };
})();
