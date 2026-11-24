/* game-history.js：球队视图底部的「历史比赛」。
 * - 汇总当前赛季已打 + 往季 gameLog（VFe 留存），按赛季分组、新到旧排列；
 * - 每场可点开：有 box 则还原全队完整技术统计，无 box（旧存档/未出场）给兜底；
 * - 纯视图层，不改结算内核；删除文件并去掉 index.html 引用即可回退。 */
(function () {
  'use strict';
  if (window.MBLGameHistory) return;
  var C = window.MBLCore, el = C.h;

  var BOX_COLS = ['球员', '分钟', '得分', '投篮', '三分', '罚球', '篮板', '助攻', '抢断', '盖帽', '失误', '犯规'];
  // 紧凑数组下标，对应 broadcast 的 BOX_KEYS
  var MIN = 0, PTS = 1, FGA = 2, FGM = 3, TPA = 4, TPM = 5, FTA = 6, FTM = 7,
    ORE = 8, DRE = 9, AST = 10, STL = 11, BLK = 12, TO = 13, PF = 14;

  var section = el('section', 'mbl-ghistory');
  var dialog = null;
  var lastLife = null, lastKey = '';

  function teamView() { return document.querySelector('main.play .mbl-view[data-view="team"]'); }
  function inside(node, root) {
    return node === root || !!(root.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_CONTAINED_BY);
  }

  // 收集赛季分组：当前赛季在前，往季（有 gameLog）按年份倒序
  function collectGroups(l) {
    var groups = [], cur;
    cur = l.ball?.season;
    if (cur?.staff) cur = null;
    function playoffGames(series) {
      return (series || []).flatMap(round => (round.games || []).map(game => ({ ...game, opp: game.opp || round.opp })));
    }
    if (cur) {
      var postseason = playoffGames(cur.series);
      if (cur.activePlayoffSeries) postseason.push(...playoffGames([{ ...cur.activePlayoffSeries, opp: typeof cy === 'function' ? cy(cur)?.opp : null }]));
      if (postseason.length) groups.push({ year: cur.year, team: cur.team, games: postseason, playoffs: true });
    }
    if (cur && cur.games && cur.games.length)
      groups.push({ year: cur.year, team: cur.team, games: cur.games });
    var seasons = (l.ball && l.ball.seasons) || [];
    for (var i = seasons.length - 1; i >= 0; i--) {
      var ag = seasons[i];
      if (cur?.phase === 'done' && cur.games === ag.gameLog) continue;
      if (ag.playoffGameLog?.length) groups.push({ year: ag.year, team: ag.team, games: ag.playoffGameLog, playoffs: true });
      if (ag.gameLog && ag.gameLog.length)
        groups.push({ year: ag.year, team: ag.team, games: ag.gameLog });
    }
    return groups;
  }

  function openDetail(g) {
    ensureDialog();
    var head = el('div', 'mbl-gh-dhead');
    head.append(
      el('b', '', (g.home ? '主场 vs ' : '客场 @ ') + C.hans(g.opp) + '  ' + g.us + '–' + g.them),
      (function () { var b = el('button', 'mbl-gh-x', '关闭'); b.type = 'button'; b.onclick = closeDialog; return b; })()
    );
    var body = el('div', 'mbl-gh-body');
    if (g.box) body.append(renderBox(g.box));
    else body.append(renderFallback(g));
    if ([1, 2].includes(g.matchRecord?.version)) {
      var replay = el('button', 'mbl-season-btn', '重播比赛');
      replay.type = 'button';
      replay.onclick = function () {
        closeDialog();
        var opened = false;
        try { opened = window.MBLBroadcast?.openHistorical(g); } catch (error) { console.warn('[history replay]', error); }
        if (!opened) {
          openDetail(g);
          dialog.querySelector('.mbl-gh-body').append(el('p', 'muted', '历史引擎或比分不一致，已保留原始统计。'));
        }
      };
      body.prepend(replay);
    }
    dialog.replaceChildren(head, body);
    if (!dialog.open) dialog.showModal();
  }

  function renderFallback(g) {
    var wrap = el('div', 'mbl-gh-fb');
    wrap.append(el('p', 'muted', '该场没有保留完整技术统计（旧存档或当场未出场）。'));
    if (g.pts != null) {
      var p = el('p', 'mbl-gh-fbstats');
      p.textContent = '你的数据：' + g.pts + ' 分 ' + (g.reb || 0) + ' 篮板 ' +
        (g.ast || 0) + ' 助攻 ' + (g.stl || 0) + ' 抢断 ' + (g.blk || 0) + ' 盖帽';
      wrap.append(p);
    }
    return wrap;
  }

  function cell(txt, cls) {
    var td = document.createElement('td');
    if (cls) td.className = cls;
    td.textContent = txt;
    return td;
  }

  // r23：历史 box 里有 en/pos/ovr 的行（新档）名字可点，复用 float-layer 的 shape 浮层；旧档无这些字段则保持纯文本
  function nameCell(r) {
    var td = document.createElement('td');
    var ok = r.en && r.pos && r.ovr != null;
    td.className = 'is-name' + (ok ? ' is-link' : '');
    td.textContent = r.n;
    if (ok) {
      var key = 'ghshape:' + r.en + ':' + r.pos;
      window.__boxShapes = window.__boxShapes || new Map();
      window.__boxShapes.set(key, function () {
        var five = my(r.en, r.pos, r.ovr, true, true);
        return jk({ name: { en: r.en, hans: r.n, hant: r.n }, pos: r.pos, ovr: r.ovr },
          Mp({ name: { en: r.en }, pos: r.pos }), five);
      });
      td.dataset.act = 'shape';
      td.dataset.v = key;
    }
    return td;
  }

  function teamTable(team) {
    var sec = el('div', 'mbl-gh-sec');
    var shead = el('div', 'mbl-gh-shead');
    shead.append(el('span', 'mbl-gh-tname', team.name),
      el('span', 'mbl-gh-tscore', String(team.score)));
    sec.append(shead);
    var wrap = el('div', 'mbl-gh-tablewrap');
    var table = document.createElement('table');
    table.className = 'mbl-gh-table';
    var thead = document.createElement('thead'), hr = document.createElement('tr');
    BOX_COLS.forEach(function (c) { var th = document.createElement('th'); th.textContent = c; hr.append(th); });
    thead.append(hr); table.append(thead);

    var totals = new Array(15).fill(0);
    var tbody = document.createElement('tbody');
    team.rows.forEach(function (r) {
      var s = r.s, tr = document.createElement('tr');
      if (r.me) tr.className = 'is-me';
      tr.append(
        nameCell(r),
        cell(Math.round(s[MIN])), cell(s[PTS]),
        cell(s[FGM] + '-' + s[FGA]), cell(s[TPM] + '-' + s[TPA]), cell(s[FTM] + '-' + s[FTA]),
        cell(s[ORE] + s[DRE]), cell(s[AST]), cell(s[STL]), cell(s[BLK]), cell(s[TO]), cell(s[PF])
      );
      tbody.append(tr);
      for (var k = 0; k < 15; k++) totals[k] += (Number(s[k]) || 0);
    });
    var trt = document.createElement('tr');
    trt.className = 'is-total';
    trt.append(
      cell('全队', 'is-name'),
      cell(Math.round(totals[MIN])), cell(totals[PTS]),
      cell(totals[FGM] + '-' + totals[FGA]), cell(totals[TPM] + '-' + totals[TPA]),
      cell(totals[FTM] + '-' + totals[FTA]),
      cell(totals[ORE] + totals[DRE]), cell(totals[AST]), cell(totals[STL]),
      cell(totals[BLK]), cell(totals[TO]), cell(totals[PF])
    );
    tbody.append(trt);
    table.append(tbody);
    wrap.append(table);
    sec.append(wrap);
    return sec;
  }

  function renderBox(box) {
    var wrap = el('div', 'mbl-gh-box');
    wrap.append(teamTable(box.home), teamTable(box.away));
    return wrap;
  }

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = el('dialog', 'mbl-gh-dialog');
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) closeDialog();
    });
    document.body.append(dialog);
    return dialog;
  }
  function closeDialog() { if (dialog && dialog.open) dialog.close(); }

  function groupKey(groups) {
    return JSON.stringify(groups.map(function (group) {
      var last = group.games.at(-1);
      return [group.year, group.team?.en, !!group.playoffs, group.games.length, last?.us, last?.them];
    }));
  }

  function render(force) {
    var l = C.life();
    if (!l) return;
    var groups = collectGroups(l);
    var key = groupKey(groups);
    if (!force && lastLife === l && lastKey === key) return;
    lastLife = l;
    lastKey = key;
    section.replaceChildren();
    section.append(el('h4', 'jsec mbl-gh-title', '历史比赛'));
    if (!groups.length) {
      section.append(el('p', 'muted small', '还没有打过的比赛，开打后这里会汇总。'));
      return;
    }
    groups.forEach(function (grp) {
      var head = el('div', 'mbl-gh-ghead');
      head.textContent = grp.year + '–' + String(grp.year + 1).slice(2) + (grp.playoffs ? ' 季后赛 · ' : ' 赛季 · ') + C.hans(grp.team);
      section.append(head);
      var list = el('div', 'mbl-gh-list');
      for (var i = grp.games.length - 1; i >= 0; i--) {
        var g = grp.games[i], win = g.us > g.them;
        var row = el('button', 'mbl-gh-row');
        row.type = 'button';
        row.innerHTML =
          '<span class="no">' + (i + 1) + '</span>' +
          '<span class="hm">' + (g.home ? 'vs' : '@') + '</span>' +
          '<span class="nm">' + C.hans(g.opp) + '</span>' +
          '<span class="sc ' + (win ? 'w' : 'l') + '">' + g.us + '–' + g.them + '</span>' +
          '<span class="go">' + (g.box ? '数据' : '—') + '</span>';
        (function (rec) { row.onclick = function () { openDetail(rec); }; })(g);
        list.append(row);
      }
      section.append(list);
    });
  }

  function onDomChange(muts) {
    muts = muts || [];
    for (var i = 0; i < muts.length; i++) {
      var t = muts[i].target;
      if (inside(t, section) || (dialog && inside(t, dialog))) continue;
      mount();
      return;
    }
  }
  function mount() {
    if (C.screen() !== 'play') {
      if (section.parentNode) section.parentNode.removeChild(section);
      return;
    }
    var tv = teamView();
    if (!tv) return;
    if (!tv.contains(section)) tv.append(section);
    render();
  }

  C.onDom(onDomChange, 'play');
  mount();
  window.MBLGameHistory = { refresh: function () { render(true); }, mount: mount, openDetail: openDetail };
})();
