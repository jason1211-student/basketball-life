/* playoff-bracket.js：季后赛对阵图视图（参考 NBA 2K bracket，左右对称树）。
 * - 读取 season.bracket（由 bracket.js 快照维护），有分区时拆成东西部左右两棵树，
 *   中央为总决赛；无分区联赛回退单侧横向树；
 * - 种子彩色框、队徽、系列赛比分、连接线、底部信息条；玩家球队高亮；
 * - 场间抉择/结果/通知内联成「场间」门控卡，处理完才解锁当前系列赛；
 * - 老存档没有 bracket 时降级显示自己的系列赛，不报错；纯视图层，删除即可回退。 */
(function () {
  'use strict';
  if (window.MBLPlayoffBracket) return;
  var C = window.MBLCore, el = C.h;
  var TBD = -2, BYE = -1, busy = false;

  var POOL_CN = {
    business: '事业经营', camp: '训练营', campus: '校园', child: '子女', early: '早年',
    elder: '晚年', game: '关键比赛', hoops: '篮球抉择', job: '工作抉择', life: '生活抉择',
    media: '媒体', money: '财务抉择', offseason: '休赛期', playoffs: '季后赛',
    son: '子女', team: '球队抉择', teen: '青少年'
  };

  function home() { return document.querySelector('main.play .mbl-view[data-view="home"]'); }
  function season() {
    var l = C.life();
    if (!l || !l.ball || !l.ball.season) return null;
    var s = l.ball.season;
    if (s.phase !== 'playoffs' && s.phase !== 'done') return null;
    return s;
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function blocked(l) {
    return (l.pending && l.pending.length) || de.outcome || de.notices.length;
  }
  function nodeLabel(m) {
    if (m.kind === 'season') return '赛季节点';
    if (m.tid && typeof b0 === 'function') {
      var t = b0(m.tid);
      if (t && t.title) return C.hans(t.title);
    }
    return POOL_CN[m.pool] || m.pool || '抉择';
  }

  /* ---------- 单个球队行 / 对阵卡 ---------- */
  function slotHtml(t, wins, isWinner, o) {
    if (t === TBD) {
      return '<div class="mbl-pb2-slot tbd"><i class="mbl-pb2-seed">·</i>' +
        '<span class="mbl-pb2-name">待定</span><span class="mbl-pb2-w">0</span></div>';
    }
    if (t === BYE) {
      return '<div class="mbl-pb2-slot bye"><i class="mbl-pb2-seed">·</i>' +
        '<span class="mbl-pb2-name">轮空</span><span class="mbl-pb2-w">–</span></div>';
    }
    var seed = o.seeds[t] || 0;
    var seedCls = seed > 0 && seed <= 4 ? ' top' : ' low';
    var mine = t === o.me ? ' mine' : '';
    return '<div class="mbl-pb2-slot' + (isWinner ? ' winner' : '') + mine + '">' +
      '<i class="mbl-pb2-seed' + seedCls + '">' + seed + '</i>' +
      TBadge(o.teams[t], o.year) +
      '<span class="mbl-pb2-name">' + Be(o.teams[t]) + '</span>' +
      '<span class="mbl-pb2-w">' + (wins === null ? 0 : wins) + '</span></div>';
  }

  function matchHtml(m, o, extra) {
    var winA = m.winner === m.a, winB = m.winner === m.b;
    return '<div class="mbl-pb2-match' + (extra ? ' ' + extra : '') + '">' +
      slotHtml(m.a, m.aWins, winA, o) + slotHtml(m.b, m.bWins, winB, o) + '</div>';
  }

  function colHtml(r, matches, o) {
    return '<div class="mbl-pb2-col" data-round="' + r + '">' +
      matches.map(function (m) { return matchHtml(m, o); }).join('') + '</div>';
  }

  /* ---------- 把扁平 bracket 拆成左右两棵树 ---------- */
  function buildTrees(o) {
    var rounds = o.bracket, last = rounds.length - 1;
    var confs = (o.conf && Pt(o.leagueId).conferences) || null;
    if (!confs || confs.length !== 2 || rounds[last].length !== 1) return null;
    var left = [], right = [];
    for (var r = 0; r < last; r++) {
      var all = rounds[r], half = all.length / 2;
      left.push({ r: r, matches: all.slice(0, half) });
      right.push({ r: r, matches: all.slice(half) });
    }
    return { left: left, right: right.slice().reverse(), final: rounds[last][0], finalRound: last };
  }

  /* 树高/连接线几何：对阵卡高 66 + 首轮卡间垂直缝 12 = 78 一档；
   * 每往后一轮，竖线跨度翻倍。按首轮对阵数自适应，避免写死高度。 */
  var STEP = 78;
  function treeStyle(n0) {
    return ' style="--H:' + (n0 * STEP) + 'px;--d0:' + STEP + 'px"';
  }

  function bracketHtml(o) {
    var model = buildTrees(o);
    if (!model) {
      var n0s = o.bracket[0].length;
      return '<div class="mbl-pb2 single"' + treeStyle(n0s) + '>' + o.bracket.map(function (round, r) {
        return colHtml(r, round, o);
      }).join('') + '</div>';
    }
    var n0 = model.left[0].matches.length, ts = treeStyle(n0);
    return '<div class="mbl-pb2">' +
      '<div class="mbl-pb2-tree left"' + ts + '>' +
        model.left.map(function (c) { return colHtml(c.r, c.matches, o); }).join('') +
      '</div>' +
      '<div class="mbl-pb2-center"' + ts + '>' +
        '<div class="mbl-pb2-logo"><i class="mbl-pb2-lball"></i>PLAYOFFS</div>' +
        matchHtml(model.final, o, 'is-final') +
      '</div>' +
      '<div class="mbl-pb2-tree right mirror"' + ts + '>' +
        model.right.map(function (c) { return colHtml(c.r, c.matches, o); }).join('') +
      '</div>' +
    '</div>';
  }

  /* ---------- 底部信息条 ---------- */
  function infoBarHtml(o, l) {
    var text;
    if (blocked(l)) {
      var m = (l.pending && l.pending[0]) || null;
      text = '场间 · ' + (m ? nodeLabel(m) : (de.outcome ? '有结果待查看' : '有通知待查看'));
    } else if (o.phase === 'done') {
      text = (o.champion ? Be(o.champion) + ' 夺冠' : '季后赛结束') +
        ' · ' + o.year + '–' + String(o.year + 1).slice(2);
    } else {
      var ctx = cy(o);
      if (ctx) {
        text = C.hans(ctx.round) + ' · ' + (ctx.mySeed || '?') + '号种子 ' + Be(o.team) +
          ' vs ' + Be(ctx.opp) + ' ' + (ctx.oppSeed || '?') + '号种子 · 七场四胜制';
      } else {
        text = '季后赛进行中 · ' + o.year;
      }
    }
    return '<div class="mbl-pb2-info"><i class="mbl-pb2-infico">▸</i><span>' + text + '</span></div>';
  }

  /* ---------- 模拟当前系列赛 ---------- */
  async function simSeries() {
    if (busy) return;
    var s0 = season();
    if (!s0) return;
    var idx0 = s0.series.length;
    busy = true; box.classList.add('is-busy');
    for (var k = 0; k < 120; k++) {
      var s = season();
      if (!s || s.phase !== 'playoffs' || s.series.length > idx0) break;
      var card = document.querySelector('article.card.decide');
      var btn = card && card.querySelector('[data-act="choose"]');
      if (btn) { btn.click(); await wait(120); continue; }
      var nb = document.querySelector('[data-act="next"]');
      if (nb) { nb.click(); await wait(120); continue; }
      break;
    }
    busy = false; box.classList.remove('is-busy');
    render();
  }

  function scrollToDecision() {
    var card = document.querySelector('main.play article.card.decide') ||
      document.querySelector('main.play .modal-backdrop') ||
      document.querySelector('main.play [data-act="dismiss"]');
    if (card && card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ---------- 操作区：场间门控 / 夺冠横幅 / 当前系列赛 ---------- */
  function gameDetails(game) {
    var details = [];
    if (typeof game.home === 'boolean') details.push(game.home ? '主场' : '客场');
    if (game.overtime > 0) details.push(game.overtime + ' 个加时');
    return details;
  }

  function renderAction(o, l) {
    var wrap = el('div', 'mbl-pb-action');
    if (blocked(l)) {
      var m = (l.pending && l.pending[0]) || null;
      var inter = el('button', 'mbl-pb-gate');
      inter.type = 'button';
      inter.innerHTML =
        '<span class="mbl-pb-gate-ico">🗓️</span>' +
        '<span class="mbl-pb-gate-text"><b>场间 · ' +
          (m ? nodeLabel(m) : (de.outcome ? '有结果待查看' : '有通知待查看')) +
        '</b><span>处理完才能继续，点此定位</span></span>';
      inter.onclick = scrollToDecision;
      wrap.append(inter);
      return wrap;
    }
    if (o.phase === 'done') {
      var banner = el('div', 'mbl-pb-done');
      banner.innerHTML = '<b>' + (o.champion ? Be(o.champion) + ' 夺冠' : '季后赛结束') + '</b>' +
        '<span>' + (o.finish ? (o.finish.hans || '') : '') + '</span>';
      wrap.append(banner);
      return wrap;
    }
    var ctx = cy(o);
    if (!ctx) return wrap;
    var info = el('div', 'mbl-pb-current');
    info.innerHTML =
      '<div class="mbl-pb-curtext"><b>' + C.hans(ctx.round) + '</b>' +
      '<span>' + (ctx.mySeed || '?') + ' 号种子 ' + Be(o.team) + ' vs ' +
      Be(ctx.opp) + ' ' + (ctx.oppSeed || '?') + ' 号种子 · ' + ctx.bestOf + ' 场赛制</span></div>';
    var series = o.activePlayoffSeries;
    if (series) {
      info.append(el('b', 'mbl-pb-series-score', '系列赛 ' + series.wins + '–' + series.losses));
      if (series.games.length) {
        var scores = el('ol', 'mbl-pb-game-list');
        series.games.forEach(function (game, i) {
          var item = el('li', 'mbl-pb-game');
          var won = game.us > game.them;
          var label = ['第 ' + (i + 1) + ' 场', won ? '胜' : '负'].concat(gameDetails(game));
          item.append(el('span', 'mbl-pb-game-label', label.join(' · ')));
          item.append(el('b', 'mbl-pb-game-score', game.us + '–' + game.them));
          scores.append(item);
        });
        info.append(scores);
      }
    }
    var btns = el('div', 'mbl-pb-btns');
    var live = el('button', 'mbl-pb-btn live');
    var nextGame = (series ? series.games.length : 0) + 1;
    live.type = 'button'; live.textContent = '直播第 ' + nextGame + ' 场';
    live.onclick = function () { if (window.MBLBroadcast && MBLBroadcast.openPlayoff) MBLBroadcast.openPlayoff(); };
    var sim = el('button', 'mbl-pb-btn sim');
    sim.type = 'button'; sim.textContent = o.staff ? '模拟系列赛' : '模拟第 ' + nextGame + ' 场';
    sim.onclick = o.staff ? simSeries : function () { playNextPlayoffGame(); };
    if (!o.staff) btns.append(live);
    btns.append(sim);
    wrap.append(info, btns);
    return wrap;
  }

  /* ---------- 老存档降级 ---------- */
  function renderFallback(o) {
    var wrap = el('div', 'mbl-pb-fallback');
    var rows = (o.series || []).map(function (s) {
      return '<div class="mbl-pb-fbrow"><span>' + C.hans(s.round) + ' vs ' + Be(s.opp) + '</span>' +
        '<b class="' + (s.won ? 'w' : 'l') + '">' + s.wins + '–' + s.losses + '</b></div>';
    }).join('');
    wrap.innerHTML = '<div class="mbl-pb-fbnote">本存档早于对阵图功能，仅显示你自己的系列赛；新赛季将有完整对阵图。</div>' +
      (rows || '<div class="muted small">暂无系列赛记录</div>');
    return wrap;
  }

  var box = el('section', 'mbl-pb');
  var bracketScroll = el('div', 'mbl-pb-scroll');
  bracketScroll.tabIndex = 0;
  bracketScroll.setAttribute('role', 'region');
  bracketScroll.setAttribute('aria-label', '季后赛对阵图，可左右滚动');
  var nav = el('div', 'mbl-pb-nav');
  nav.setAttribute('role', 'group');
  nav.setAttribute('aria-label', '对阵图导航');
  var previous = scrollButton('←', '向左查看对阵', -1);
  var next = scrollButton('→', '向右查看对阵', 1);
  nav.append(previous, next);
  var history = el('details', 'mbl-pb-fallback');
  var shownSeason = null, shownContent = null, savedScrollLeft = 0;

  function scrollButton(text, label, direction) {
    var button = el('button', 'mbl-pb-nav-btn', text);
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.onclick = function () {
      bracketScroll.scrollLeft += direction * Math.max(120, bracketScroll.clientWidth * 0.8);
      savedScrollLeft = bracketScroll.scrollLeft;
      updateNav();
    };
    return button;
  }

  function updateNav() {
    var limit = bracketScroll.scrollWidth - bracketScroll.clientWidth;
    var left = bracketScroll.scrollLeft;
    nav.hidden = limit <= 1;
    previous.disabled = left <= 1;
    next.disabled = left >= limit - 1;
  }

  if (window.ResizeObserver) new ResizeObserver(updateNav).observe(bracketScroll);
  bracketScroll.addEventListener('scroll', function () {
    if (bracketScroll.isConnected) savedScrollLeft = bracketScroll.scrollLeft;
    updateNav();
  }, { passive: true });
  function render() {
    var l = C.life();
    var s = season();
    if (!s || !l) { box.style.display = 'none'; return; }
    box.style.display = '';
    var currentSeason = l.seed + ':' + s.year + ':' + s.leagueId;
    var scrollLeft = shownSeason === currentSeason ? savedScrollLeft : 0;
    if (shownSeason !== currentSeason) history.open = false;
    savedScrollLeft = scrollLeft;
    shownSeason = currentSeason;
    var head = el('div', 'mbl-pb-head');
    head.innerHTML = '<b>季后赛对阵图</b><span>' + s.year + '–' + String(s.year + 1).slice(2) + '</span>';
    var content = s.bracket && s.bracket.length ? bracketHtml(s) : renderFallback(s).outerHTML;
    if (content !== shownContent) {
      bracketScroll.innerHTML = content;
      shownContent = content;
    }
    var action = renderAction(s, l);
    if (bracketScroll.parentNode === box) {
      box.firstElementChild.replaceWith(head);
      head.nextElementSibling.replaceWith(action);
      while (bracketScroll.nextElementSibling) bracketScroll.nextElementSibling.remove();
    } else {
      box.replaceChildren(head, action, bracketScroll);
    }
    head.append(nav);
    if (bracketScroll.scrollLeft !== scrollLeft) bracketScroll.scrollLeft = scrollLeft;
    updateNav();
    var completed = s.series.filter(function (series) { return series.games && series.games.length; });
    if (completed.length) {
      history.replaceChildren(el('summary', 'muted small', '已结束系列赛比分'));
      completed.forEach(function (series) {
        var scores = series.games.map(function (game) {
          var details = gameDetails(game);
          return game.us + '–' + game.them + (details.length ? '（' + details.join(' · ') + '）' : '');
        });
        history.append(el('div', 'mbl-pb-fbnote',
          C.hans(series.round) + ' · ' + Be(series.opp) + ' · ' + scores.join(' / ')));
      });
      box.append(history);
    }
    if (s.bracket && s.bracket.length) box.insertAdjacentHTML('beforeend', infoBarHtml(s, l));
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
  window.MBLPlayoffBracket = { refresh: render, mount: mount };
})();
