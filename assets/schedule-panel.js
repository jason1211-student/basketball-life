/* 生涯日程面板：日历视图 + 安排层（不重写按年结算内核）。
   - 日历：读取当前年已规划的 moments，把可预期的决策/比赛/赛季节点标注到对应月份，
     纯随机突发事件（kind=event）不标注；
   - 本周期可安排活动，写回现有 focus 重心钩子，影响下一周期成长倾向；
   - 下方保留按年的事后回顾。自动模拟维持默认关闭；倍速按钮保留在生涯主界面。 */
(function () {
  'use strict';
  if (window.MBLSchedulePanel) return;
  var C = window.MBLCore;
  var make = C.h;

  // 活动类别 → 可选重心（对应原版 focus 合法值）
  var ACTIVITIES = [
    {
      cat: 'train', name: '专项训练', icon: '🏀', options: [
        { v: 'shooting', label: '投篮打磨' },
        { v: 'handling', label: '控球突破' },
        { v: 'defense', label: '防守强化' },
        { v: 'fitness', label: '体能力量' },
        { v: 'teamplay', label: '团队配合' }
      ]
    },
    { cat: 'rest', name: '休息恢复', icon: '🛋️', options: [{ v: 'rest', label: '休息与理疗' }] },
    {
      cat: 'match', name: '比赛赛事', icon: '🏟️', options: [
        { v: 'teamplay', label: '专注比赛' },
        { v: 'fitness', label: '保持竞技状态' }
      ]
    },
    {
      cat: 'social', name: '场下生活', icon: '👥', options: [
        { v: 'family', label: '陪伴家人' },
        { v: 'friends', label: '朋友社交' },
        { v: 'study', label: '学业进修' },
        { v: 'work', label: '事业经营' }
      ]
    }
  ];

  var FOCUS_CN = {};
  ACTIVITIES.forEach(function (g) { g.options.forEach(function (o) { if (!FOCUS_CN[o.v]) FOCUS_CN[o.v] = o.label; }); });

  // 决策池 → 中文短标签（无 tid 的通用决策用）
  var POOL_CN = {
    business: '事业经营', camp: '训练营', campus: '校园', child: '子女', early: '早年',
    elder: '晚年', game: '关键比赛', hoops: '篮球抉择', job: '工作抉择', life: '生活抉择',
    media: '媒体', money: '财务抉择', offseason: '休赛期安排', playoffs: '季后赛',
    son: '子女', team: '球队抉择', teen: '青少年'
  };

  function life() { return window.de && window.de.life || null; }

  function pickHans(o) { return (o && (o.hans || o.hant || o.en)) || ''; }

  // 取一个可预期节点的可读标签
  function nodeLabel(m) {
    if (m.kind === 'season') return '赛季节点';
    if (m.tid && typeof b0 === 'function') {
      var t = b0(m.tid);
      if (t && t.title) return pickHans(t.title);
    }
    return POOL_CN[m.pool] || m.pool || '抉择';
  }

  function lineOf(entry) {
    if (!entry) return '';
    if (entry.params && entry.params.line) return entry.params.line.hans || entry.params.line.en || '';
    if (entry.text) {
      // 把模板里的 {占位符} 用 params 实际值替换，避免日历显示原始模板
      var raw = entry.text.hans || entry.text.en || '';
      var p = entry.params || {};
      return raw.replace(/\{(\w+)\}/g, function (all, key) {
        var v = p[key];
        if (v == null) return all;
        if (typeof v === 'object') return v.hans || v.en || String(v);
        return String(v);
      });
    }
    return '';
  }

  function groupByAge(log) {
    var map = {};
    (log || []).forEach(function (e) {
      var a = Number(e.age);
      if (!map[a]) map[a] = { age: a, entries: [], milestone: false };
      map[a].entries.push(e);
      if (e.kind === 'milestone') map[a].milestone = true;
    });
    return Object.keys(map).map(Number).sort(function (x, y) { return x - y; }).map(function (a) { return map[a]; });
  }

  var dialog = make('dialog', 'mbl-sched-modal');
  dialog.setAttribute('aria-labelledby', 'mbl-sched-title');
  var head = make('div', 'mbl-sched-head');
  var title = make('h2', '', '生涯日程'); title.id = 'mbl-sched-title';
  var closeBtn = make('button', 'mbl-sched-close', '关闭'); closeBtn.type = 'button';
  head.append(title, closeBtn);

  var stage = make('p', 'mbl-sched-stage');
  var calendar = make('section', 'mbl-calendar');
  var planSection = make('section', 'mbl-sched-plan');
  var planCurrent = make('p', 'mbl-sched-current');
  var planGrid = make('div', 'mbl-sched-acts');
  var timeline = make('div', 'mbl-sched-timeline');
  var foot = make('p', 'mbl-sched-foot', '日历标注可预期的比赛、决策与赛季节点；随机突发事件不预先标注。');
  dialog.append(head, stage, calendar, planSection, timeline, foot);
  document.body.append(dialog);

  // ===== 日历视图 =====
  function renderCalendar(l) {
    calendar.replaceChildren();
    if (!l) {
      calendar.append(make('p', 'mbl-sched-muted', '开始一段人生后，这里会以日历形式展示这一年的安排。'));
      return;
    }
    var baseYear = (typeof Ee !== 'undefined' ? Ee : 0) + l.age;
    var progress = (typeof bB === 'function' && bB(l)) ? Math.min(1, de.acc / bB(l)) : 0;

    var calHead = make('div', 'mbl-cal-head');
    calHead.append(make('span', 'mbl-cal-age', l.age + '岁'));
    calHead.append(make('span', 'mbl-cal-year', baseYear + '年'));
    calendar.append(calHead);

    // 统一收集当前年要标注的节点：可预期的 decision/season + 已发生的 event/milestone
    var seen = {};
    var nodesAll = [];
    function shortLabel(s) {
      s = String(s || '');
      return s.length > 14 ? s.slice(0, 14) + '…' : s;
    }
    function pushNode(at, icon, label, done, key) {
      if (!Number.isFinite(at)) at = done ? Math.min(0.99, progress) : 0;
      at = Math.max(0, Math.min(0.999, at));
      var mi0 = Math.min(11, Math.floor(at * 12));
      var dedup = mi0 + '|' + label;
      if (seen[dedup]) return;
      seen[dedup] = 1;
      nodesAll.push({ at: at, icon: icon, label: label, done: done });
    }
    // 1) moments：decision/season 事前可预期；随机 event 仅在已发生后才显示（不剧透）
    (l.moments || []).forEach(function (m) {
      if (m.kind === 'event' && m.at > progress) return;
      var done = m.at <= progress + 0.001;
      var icon = m.kind === 'season' ? '🏆' : m.kind === 'event' ? '●' : '▸';
      pushNode(m.at, icon, nodeLabel(m), done);
    });
    // 2) log：当前年已发生的事件与里程碑，事后标注到对应月份
    (l.log || []).forEach(function (e) {
      if (Number(e.age) !== l.age) return;
      var at = Number.isFinite(e.at) ? e.at : progress;
      var icon = e.kind === 'milestone' ? '★' : '●';
      var raw = lineOf(e) || (e.kind === 'milestone' ? '关键节点' : '事件');
      pushNode(at, icon, shortLabel(raw), true);
    });

    var byMonth = {};
    nodesAll.forEach(function (n) {
      var mi = Math.min(11, Math.floor(n.at * 12));
      (byMonth[mi] || (byMonth[mi] = [])).push(n);
    });

    var grid = make('div', 'mbl-cal-grid');
    for (var mi = 0; mi < 12; mi++) {
      var cell = make('div', 'mbl-cal-cell');
      cell.append(make('div', 'mbl-cal-month', (mi + 1) + '月'));
      var items = make('div', 'mbl-cal-items');
      var nodes = byMonth[mi] || [];
      nodes.forEach(function (n) {
        var isCurrent = !n.done && Math.abs(n.at - progress) < 0.06;
        var chip = make('div', 'mbl-cal-node' + (n.done ? ' is-done' : isCurrent ? ' is-current' : ''));
        chip.title = n.label;
        chip.append(make('span', 'mbl-cal-ico', n.icon), make('span', 'mbl-cal-text', n.label));
        items.append(chip);
      });
      cell.append(items);
      grid.append(cell);
    }
    calendar.append(grid);
    var appointments = window.MBLRelationsMessages?.renderAppointments(l, render, function (id) {
      close();
      window.MBLRelationsMessages.selectConversation(id);
      window.MBLRelationsPanel?.open('messages');
    });
    if (appointments) calendar.append(appointments);
    const plan=window.MBLLifeCalendar?.render(l,render);
    if(plan)calendar.append(plan);
    const housing=window.MBLRelationsMessages?.calendarHousing?.(l,render);
    if(housing)calendar.append(housing);

    // 图例
    var legend = make('div', 'mbl-cal-legend');
    legend.append(make('span', '', '▸ 待抉择'));
    legend.append(make('span', '', '🏆 赛季节点'));
    legend.append(make('span', '', '● 已发生事件'));
    legend.append(make('span', '', '★ 关键节点'));
    calendar.append(legend);
  }

  function renderPlan(l) {
    planSection.replaceChildren();
    if (!l) return;
    planSection.append(make('h3', 'mbl-sched-sub', '本周期安排'));
    var cur = l.focus || 'rest';
    planCurrent.textContent = '当前重心：' + (FOCUS_CN[cur] || cur);
    planSection.append(planCurrent);
    ACTIVITIES.forEach(function (group) {
      var block = make('div', 'mbl-sched-act-group');
      block.append(make('div', 'mbl-sched-act-cat', group.icon + ' ' + group.name));
      var opts = make('div', 'mbl-sched-act-opts');
      group.options.forEach(function (o) {
        var b = make('button', 'mbl-sched-act' + (cur === o.v ? ' is-active' : ''));
        b.type = 'button'; b.textContent = o.label;
        b.onclick = function () { l.focus = o.v; render(); };
        opts.append(b);
      });
      block.append(opts);
      planSection.append(block);
    });
  }

  function renderTimeline(l) {
    timeline.replaceChildren();
    if (!l) {
      timeline.append(make('p', 'mbl-sched-muted', '开始一段人生后，这里会按年份展示你的日程与关键节点。'));
      return;
    }
    for(const e of l.flags?.mblLifeCalendar?.history||[]) timeline.append(make('p','mbl-sched-day-text',e.age+' 岁'+(e.game?' · 第 '+e.game+' 场':'')+' · '+e.title+' · '+e.detail));
    var groups = groupByAge(l.log);
    var awards = (l.ball && l.ball.awards) || [];
    if (!groups.length && !awards.length) {
      timeline.append(make('p', 'mbl-sched-muted', '暂无日程记录，推进人生后会在这里显示。'));
      return;
    }
    timeline.append(make('h3', 'mbl-sched-sub', '生涯回顾'));
    groups.forEach(function (g) {
      var card = make('div', 'mbl-sched-day' + (g.milestone ? ' is-milestone' : ''));
      var left = make('div', 'mbl-sched-day-age', g.age + '岁');
      var body = make('div', 'mbl-sched-day-body');
      g.entries.slice(-2).forEach(function (e) {
        var t = lineOf(e);
        if (t) body.append(make('p', 'mbl-sched-day-text' + (e.kind === 'milestone' ? ' milestone' : ''), t));
      });
      if (g.milestone) body.append(make('span', 'mbl-sched-tag', '关键节点'));
      card.append(left, body);
      timeline.append(card);
    });
    if (awards.length) {
      var sec = make('section', 'mbl-sched-awards');
      sec.append(make('h3', 'mbl-sched-sub', '荣誉簿'));
      awards.slice(-12).forEach(function (aw) {
        var t = aw.text && (aw.text.hans || aw.text.en) || '';
        if (t) sec.append(make('div', 'mbl-sched-award', (aw.year ? aw.year + ' · ' : '') + t));
      });
      timeline.append(sec);
    }
  }

  function render() {
    return window.MBLInteraction.preserveScroll(dialog, renderContents);
  }

  function renderContents() {
    var l = life();
    if (!l) {
      stage.textContent = '尚未开始人生';
      calendar.replaceChildren();
      planSection.replaceChildren();
      renderTimeline(null);
      return;
    }
    var pro = l.ball && l.ball.pro;
    var stageTxt = l.alive === false ? '已完结' : (pro ? '职业阶段' : (l.age < 14 ? '成长阶段' : '青年阶段'));
    stage.textContent = stageTxt + ' · ' + (l.name && (l.name.hans || l.name.en) || '未命名') + ' · ' + l.age + '岁';
    renderCalendar(l);
    renderPlan(l);
    renderTimeline(l);
  }

  closeBtn.onclick = function () { dialog.close(); };

  function open() { render(); if (!dialog.open) dialog.showModal(); }
  function close() { if (dialog.open) dialog.close(); }

  window.MBLSchedulePanel = { open: open, close: close, refresh: render, refreshAppointments: function () { if (dialog.open) render(); } };
  if (window.MBLDockPanels) window.MBLDockPanels.schedule = { open: open, close: close };
})();
