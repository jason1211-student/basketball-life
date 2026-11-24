/* team-calendar.js：进联盟后的「球队作战日历」（参考 NBA 2K 王朝/MyCAREER）。
 * - 常规赛期间生涯(home)视图主骨架换成作战日历：顶部球队/战绩/预估排名/进度，
 *   下面按全部场次列出对手与主客，下一场给「直播这场 / 模拟这场」两个入口；
 * - 场间事务（训练/代言/合同/生活抉择）内联成「场间」条目，未处理完先锁比赛按钮；
 * - 纯视图层：不改任何结算内核，直播复用 MBLBroadcast，模拟复用 MBLAutoSim，
 *   每场仍由 P_ 结算一次，不跳步、不重复。删除文件即可回退。 */
(function () {
  'use strict';
  if (window.MBLTeamCalendar) return;
  var C = window.MBLCore, el = C.h;

  var POOL_CN = {
    business: '事业经营', camp: '训练营', campus: '校园', child: '子女', early: '早年',
    elder: '晚年', game: '关键比赛', hoops: '篮球抉择', job: '工作抉择', life: '生活抉择',
    media: '媒体', money: '财务抉择', offseason: '休赛期', playoffs: '季后赛',
    son: '子女', team: '球队抉择', teen: '青少年'
  };

  function nodeLabel(m) {
    if (m.kind === 'season') return '赛季节点';
    if (m.tid && typeof b0 === 'function') {
      var t = b0(m.tid);
      if (t && t.title) {
        var label = C.hans(t.title);
        if (label && label.indexOf('{') < 0) return label; // 仍是 {占位符} 说明运行时未填充，回退到中文标签
      }
    }
    return POOL_CN[m.pool] || m.pool || '抉择';
  }

  var box = el('section', 'mbl-tcal');
  var busy = false;
  var POS8 = ['guard', 'guard', 'wing', 'wing', 'big', 'guard', 'wing', 'big'];
  var POS_CN = { guard: '后卫', wing: '侧翼', big: '内线' };

  function home() { return document.querySelector('main.play .mbl-view[data-view="home"]'); }
  function season() { try { return Oa(C.life()); } catch (e) { return null; } }
  function blocked(l) {
    return (l.pending && l.pending.length) || de.outcome || de.notices.length;
  }

  function chip(v, k) {
    return '<div class="mbl-tcal-chip"><b>' + v + '</b><span>' + k + '</span></div>';
  }

  // 模拟这一场：推进到 games.length 多一场即停；任何抉择/重大节点/历史弹窗都停下等玩家
  function advanceOneGame() {
    if (busy) return;
    var s = season();
    if (!s) return;
    var g0 = s.games.length;
    busy = true;
    box.classList.add('is-busy');
    window.__mblOneGame = true;
    window.MBLAutoSim.autoPlay(function (life) {
      var ss; try { ss = Oa(life); } catch (e) { ss = null; }
      if (!life.alive || !ss) return true;            // 死亡或进入下一阶段（季后赛/结束）
      return ss.games.length >= g0 + 1;
    }, {
      maxSteps: 4000, pauseMajor: true, pauseEra: true,
      onChoice: function () { return true; }          // 碰到抉择就停，不替玩家选
    }).catch(function () {}).then(function () {
      window.__mblOneGame = false;
      busy = false;
      box.classList.remove('is-busy');
      render();
    });
  }

  function scrollToDecision() {
    var card = document.querySelector('main.play article.card.decide') ||
      document.querySelector('main.play .modal-backdrop') ||
      document.querySelector('main.play [data-act="dismiss"]');
    if (card && card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderHead(s) {
    var rec = hi(s), live = L_(s);
    var rank = live.findIndex(function (x) { return x.mine; }) + 1;
    var pct = s.total ? (s.games.length / s.total * 100) : 0;
    var head = el('div', 'mbl-tcal-head');
    head.innerHTML =
      '<div class="mbl-tcal-tm">' + TBadge(s.team, s.year) +
        '<div class="mbl-tcal-tmtext"><b>' + Be(s.team) + '</b>' +
        '<span>' + s.year + '–' + String(s.year + 1).slice(2) + ' 赛季</span></div></div>' +
      '<div class="mbl-tcal-chips">' +
        chip(rec.w + '–' + rec.l, '战绩') +
        chip(rank > 0 ? '#' + rank : '—', '预估排名') +
        chip(s.games.length + '/' + s.total, '已打场次') +
      '</div>' +
      '<div class="mbl-tcal-prog"><span style="width:' + pct.toFixed(1) + '%"></span></div>';
    return head;
  }

  function renderAction(l, s, ng) {
    var wrap = el('div', 'mbl-tcal-action');
    if (blocked(l)) {
      var m = (l.pending && l.pending[0]) || null;
      var label = m ? nodeLabel(m) : (de.outcome ? '有结果待查看' : '有通知待查看');
      var inter = el('button', 'mbl-tcal-inter');
      inter.type = 'button';
      inter.innerHTML =
        '<span class="mbl-ti-ico">🗓️</span>' +
        '<span class="mbl-ti-text"><b>场间 · ' + label + '</b>' +
        '<span>处理完才能打下一场，点此定位</span></span>';
      inter.onclick = scrollToDecision;
      wrap.append(inter);
      return wrap;
    }
    if (!ng) { wrap.append(el('p', 'muted small', '常规赛已结束')); return wrap; }
    var card = el('div', 'mbl-tcal-next');
    card.innerHTML =
      '<div class="mbl-tcal-nginfo">' + TBadge(ng.opp, s.year) +
        '<div class="mbl-tcal-ngtext"><b>' + (ng.home ? '主场 vs ' : '客场 @ ') + Be(ng.opp) +
        '</b><span>第 ' + ng.game + ' 场 · 下一场</span></div></div>';
    var btns = el('div', 'mbl-tcal-btns');
    var liveBtn = el('button', 'mbl-tc-btn live');
    liveBtn.type = 'button'; liveBtn.textContent = '直播这场';
    liveBtn.onclick = function () { if (window.MBLBroadcast) window.MBLBroadcast.open(advanceOneGame); };
    var simBtn = el('button', 'mbl-tc-btn sim');
    simBtn.type = 'button'; simBtn.textContent = '模拟这场';
    simBtn.onclick = advanceOneGame;
    btns.append(liveBtn, simBtn);
    card.append(btns);
    wrap.append(card);
    return wrap;
  }

  /* ===== 月历网格：底层只有「第几场」，视图层把场次确定性地映射成日期（不写存档、可回退）===== */
  var GAP = [2, 2, 1, 2, 3, 2, 1, 2, 2, 3, 2, 1]; // 相邻比赛间隔（天）：含背靠背(1)与长休息(3)，均值约 2
  var calYM = null;                                  // 当前显示月份 {y, m}，翻月时保持
  var calSeasonKey = '';                             // 赛季/球队变化时重置月份
  var calNextGame = null;                            // 下一场变化时自动翻到对应月份
  function dkey(d) { return d.getFullYear() + '/' + d.getMonth() + '/' + d.getDate(); }
  function startOfSeason(s) { return new Date(s.year, 9, 20); } // NBA 口径：10 月 20 日开赛

  // 生成每场的日期与状态，按日期 key 建表，同时保留按场次的 entries
  function buildCalendarMap(s) {
    var cur = startOfSeason(s), map = {}, entries = [];
    for (var i = 0; i < s.total; i++) {
      if (i > 0) cur = new Date(cur.getTime() + GAP[(i - 1) % GAP.length] * 86400000);
      var played = i < s.games.length;
      var e = {
        idx: i, date: new Date(cur), opp: s.teams[s.schedule[i]], home: (i % 2 === 0),
        played: played, isNext: i === s.games.length, g: played ? s.games[i] : null
      };
      map[dkey(cur)] = e; entries.push(e);
    }
    return { map: map, entries: entries, first: entries[0].date, last: entries[entries.length - 1].date };
  }

  function scrollToAction() {
    var a = box.querySelector('.mbl-tcal-action');
    if (a && a.scrollIntoView) a.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // 比赛日格子：队徽 + 主客配色；已打显示比分，下一场高亮
  function gameCell(s, e, people) {
    var b = el('button', 'mbl-gc is-game ' + (e.home ? 'home' : 'away') +
      (e.played ? ' is-played' : '') + (e.isNext ? ' is-next' : ''));
    b.type = 'button';
    var inner = '<span class="mbl-gc-d">' + e.date.getDate() + '</span>' +
      '<span class="mbl-gc-badge">' + TBadge(e.opp, s.year) + '</span>';
    if (e.played) {
      inner += '<span class="mbl-gc-sc ' + (e.g.us > e.g.them ? 'w' : 'l') + '">' + e.g.us + '–' + e.g.them + '</span>';
    } else {
      inner += '<span class="mbl-gc-hm">' + (e.home ? '主' : '客') + '</span>';
    }
    b.innerHTML = inner;
    if (people?.length) {
      var marker = el('span', 'mbl-gc-appointment', '约');
      b.title = '赛后私人约定：' + people.join('、');
      marker.setAttribute('aria-label', b.title);
      b.append(marker);
    }
    b.onclick = function () {
      if (e.played) { if (window.MBLGameHistory) window.MBLGameHistory.openDetail(e.g); }
      else if (e.isNext) { scrollToAction(); }
      else { openPreview(s, e.idx); }
    };
    return b;
  }

  // 非比赛日：赛季跨度内标训练/休息，其余为普通空格
  function offCell(d, cm) {
    var cell = el('div', 'mbl-gc is-off');
    cell.innerHTML = '<span class="mbl-gc-d">' + d.getDate() + '</span>';
    var t = d.getTime();
    if (t >= cm.first.getTime() && t <= cm.last.getTime()) {
      cell.classList.add('is-rest');
      cell.innerHTML += '<span class="mbl-gc-rest">🏀</span>';
    }
    return cell;
  }

  function renderGrid(life, s, ng) {
    var appointments = window.MBLRelationsMessages?.gameAppointmentIndex(life, s);
    var wrap = el('div', 'mbl-tcal-gridwrap');
    var cm = buildCalendarMap(s);
    var seasonKey = [s.year, s.leagueId, s.team && s.team.en].join('|');
    if (seasonKey !== calSeasonKey) { calSeasonKey = seasonKey; calYM = null; calNextGame = null; }
    if (ng && ng.game !== calNextGame) {
      calNextGame = ng.game;
      var nextEntry = cm.entries[ng.game - 1];
      if (nextEntry) calYM = { y: nextEntry.date.getFullYear(), m: nextEntry.date.getMonth() };
    }
    if (!calYM) {
      var anchor = ng ? cm.entries[ng.game - 1] : cm.entries[0];
      calYM = { y: anchor.date.getFullYear(), m: anchor.date.getMonth() };
    }
    var y = calYM.y, m = calYM.m;

    var nav = el('div', 'mbl-cal-mon');
    var prev = el('button', 'mbl-cal-arrow'); prev.type = 'button'; prev.textContent = '‹';
    var next = el('button', 'mbl-cal-arrow'); next.type = 'button'; next.textContent = '›';
    var monTitle = el('b', '', y + '年' + (m + 1) + '月');
    var canPrev = (new Date(y, m, 1).getTime() > cm.first.getTime());
    var canNext = (new Date(y, m + 1, 0).getTime() < cm.last.getTime());
    if (canPrev) prev.onclick = function () { calYM = { y: m === 0 ? y - 1 : y, m: (m + 11) % 12 }; render(); };
    else prev.disabled = true;
    if (canNext) next.onclick = function () { calYM = { y: m === 11 ? y + 1 : y, m: (m + 1) % 12 }; render(); };
    else next.disabled = true;
    nav.append(prev, monTitle, next);

    var weekHead = el('div', 'mbl-cal-week');
    ['一', '二', '三', '四', '五', '六', '日'].forEach(function (w) { weekHead.append(el('span', '', w)); });

    var cells = el('div', 'mbl-cal-cells');
    var firstCol = (new Date(y, m, 1).getDay() + 6) % 7; // 周一为第 0 列
    for (var b0i = 0; b0i < firstCol; b0i++) cells.append(el('div', 'mbl-gc is-blank'));
    var days = new Date(y, m + 1, 0).getDate();
    for (var day = 1; day <= days; day++) {
      var d = new Date(y, m, day), e = cm.map[dkey(d)];
      cells.append(e ? gameCell(s, e, appointments?.get(e.idx + 1)) : offCell(d, cm));
    }

    var legend = el('div', 'mbl-cal-legend');
    legend.innerHTML =
      '<span><i class="lg-dot home"></i>主场</span>' +
      '<span><i class="lg-dot away"></i>客场</span>' +
      '<span>🏀 训练/休息日</span>';

    wrap.append(nav, weekHead, cells, legend);
    return wrap;
  }

  /* ===== 赛前预览（未打比赛）===== */
  var previewDialog = null;
  function ensurePreview() {
    if (previewDialog) return previewDialog;
    previewDialog = el('dialog', 'mbl-tc-preview');
    previewDialog.addEventListener('click', function (e) {
      if (e.target === previewDialog) previewDialog.close();
    });
    document.body.append(previewDialog);
    return previewDialog;
  }

  // 由总评+位置给场均预估（赛前口径，非真实战绩）
  function projAvg(ovr, pos) {
    var o = Number(ovr) || 60;
    var pts = C.clamp(.55 * o - 25, 2, 30);
    var reb = C.clamp(pos === 'big' ? .32 * o - 14 : pos === 'wing' ? .2 * o - 9 : .14 * o - 6, 1, 13);
    var ast = C.clamp(pos === 'guard' ? .28 * o - 12 : pos === 'wing' ? .16 * o - 7 : .1 * o - 4, .5, 11);
    return { pts: pts.toFixed(1), reb: reb.toFixed(1), ast: ast.toFixed(1) };
  }

  // 对手无存档名单：按球队强度用 iH 生成 8 人预估阵容（与直播同口径）
  function buildOppPlayers(s, oppIdx) {
    var l = C.life();
    var base = C.clamp(Math.round(Number(s.strength[oppIdx])) || 70, 50, 98);
    return POS8.map(function (pos) {
      var r = iH(base, pos, Math.random);
      var nm = Ed(l, 'NBA');
      return { name: nm, pos: pos, ovr: window.MBLAttrSys.overall(r.ratings, pos) };
    });
  }

  function playerRows(players) {
    return players.map(function (p) {
      var a = projAvg(p.ovr, p.pos);
      return '<div class="mbl-tcp-row">' +
        '<span class="mbl-tcp-pos">' + POS_CN[p.pos] + '</span>' +
        '<span class="mbl-tcp-pname">' + C.hans(p.name) + '</span>' +
        '<span class="mbl-tcp-ovr">' + p.ovr + '</span>' +
        '<span class="mbl-tcp-avg">' + a.pts + '/' + a.reb + '/' + a.ast + '</span>' +
      '</div>';
    }).join('');
  }

  function teamBlock(title, sub, players, isOpp) {
    var sec = el('div', 'mbl-tcp-team' + (isOpp ? ' is-opp' : ''));
    sec.innerHTML =
      '<div class="mbl-tcp-thead"><b>' + title + '</b><span>' + sub + '</span></div>' +
      '<div class="mbl-tcp-colhead"><span>位置</span><span>球员</span><span>总评</span><span>得分/篮板/助攻</span></div>';
    var list = el('div', 'mbl-tcp-plist');
    list.innerHTML = playerRows(players);
    sec.append(list);
    if (isOpp) {
      var note = el('p', 'mbl-tcp-note');
      note.textContent = '对手名单游戏内未存档，此处为按球队强度生成的预估阵容，场均为预估口径。';
      sec.append(note);
    }
    return sec;
  }

  function openPreview(s, idx) {
    var dlg = ensurePreview();
    var oppIdx = s.schedule[idx], isHome = idx % 2 === 0;
    var rec = hi(s);
    var rank = L_(s).findIndex(function (x) { return x.mine; }) + 1;
    var mine = (s.roster || []).slice().sort(function (a, b) { return b.ovr - a.ovr; })
      .map(function (pl) { return { name: pl.name, pos: pl.pos, ovr: pl.ovr }; });
    var opp = buildOppPlayers(s, oppIdx);
    var head = el('div', 'mbl-tcp-dhead');
    head.append(
      el('b', '', '第 ' + (idx + 1) + ' 场 · ' + (isHome ? '主场' : '客场')),
      (function () { var x = el('button', 'mbl-tcp-x', '关闭'); x.type = 'button'; x.onclick = function () { dlg.close(); }; return x; })()
    );
    var body = el('div', 'mbl-tcp-body');
    body.append(
      teamBlock('我方 · ' + Be(s.team), '战绩 ' + rec.w + '–' + rec.l + ' · 排名 #' + (rank > 0 ? rank : '—'), mine, false),
      teamBlock('对手 · ' + Be(s.teams[oppIdx]), '球队总评 ' + Math.round(Number(s.strength[oppIdx]) || 0) + ' · ' + (isHome ? '我方主场' : '我方客场'), opp, true)
    );
    dlg.replaceChildren(head, body);
    if (!dlg.open) dlg.showModal();
  }

  function toNode(html) {
    var t = document.createElement('div');
    t.innerHTML = html;
    return t.firstElementChild;
  }

  // 人生记录：完整人生日志（Sue）；月历已覆盖未来赛程，这里只留历史
  function renderRecord(l) {
    var rec = el('section', 'card mbl-tcal-record');
    rec.innerHTML = Sue(l);
    return rec;
  }

  // 插画：场景卡（含同住说明）
  function renderScene(l) { return toNode(HX(l)); }

  function render() {
    var l = C.life();
    if (!l) { return; }
    var s = season();
    var appointments = window.MBLRelationsMessages?.renderAppointments(l, render, function (id) {
      window.MBLRelationsMessages.selectConversation(id);
      window.MBLRelationsPanel?.open();
    });
    if (!s) {
      box.style.display = appointments ? '' : 'none';
      box.replaceChildren(...(appointments ? [appointments] : []));
      return;
    }
    box.style.display = '';
    var ng = pi(s);
    // 板块顺序：球队 → 日历 → 直播（下一场操作）→ 人生记录 → 插画
    box.replaceChildren(
      renderHead(s),
      renderGrid(l, s, ng),
      ...(appointments ? [appointments] : []),
      renderAction(l, s, ng),
      renderRecord(l),
      renderScene(l)
    );
  }

  function inside(node, root) {
    return node === root || !!(root.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_CONTAINED_BY);
  }
  function onDomChange(muts) {
    muts = muts || [];
    for (var i = 0; i < muts.length; i++) {
      if (inside(muts[i].target, box)) continue;
      mount();
      return;
    }
  }

  function mount() {
    if (!window.de || de.screen !== 'play') {
      if (box.parentNode) box.parentNode.removeChild(box);
      return;
    }
    var h0 = home();
    if (!h0) return;
    if (!h0.contains(box)) h0.prepend(box);
    render();
  }

  C.onDom(onDomChange, 'play');
  mount();
  window.MBLTeamCalendar = { refresh: render, mount: mount, simOne: advanceOneGame };
})();
