/* 比赛广播板块：全屏播报式比赛直播。
 * - 正式比赛：从当前赛季真实名单建队（真实对手、主客场、球员姓名/能力），终场结果存为 preset，
 *   由结算函数 P_ 在正常流程走到该场时消费，成为正式战绩（不打乱赛程、不重复结算）。
 * - 无正式比赛时提供表演赛兜底。
 * 纯本地、不联网；手机端优先；支持多档倍速、暂停、跳到结尾。 */
(function () {
  'use strict';
  if (window.MBLBroadcast) return;
  var C = window.MBLCore, el = C.h;
  var SLOT_POS = ['guard', 'guard', 'wing', 'wing', 'big', 'guard', 'wing', 'big'];

  // 多档倍速（每事件间隔 ms）；r28 整体节奏调慢约 50%，档位与默认档不变
  var SPEEDS = [
    { id: .5, ms: 1650, t: '0.5x' },
    { id: 1, ms: 1050, t: '1x' },
    { id: 2, ms: 570, t: '2x' },
    { id: 4, ms: 300, t: '4x' },
    { id: 8, ms: 145, t: '8x' }
  ];

  // NBA 球队主色（用于比分牌配色）；深色队取可在深色底辨识的代表色
  var TEAM_COLOR = {
    'Atlanta Hawks': '#E03A3E', 'Boston Celtics': '#008348', 'Brooklyn Nets': '#B0B3B8',
    'Charlotte Hornets': '#008CA8', 'Chicago Bulls': '#CE1141', 'Cleveland Cavaliers': '#FDBB30',
    'Dallas Mavericks': '#006BB6', 'Denver Nuggets': '#FEC524', 'Detroit Pistons': '#C8102E',
    'Golden State Warriors': '#1D428A', 'Houston Rockets': '#CE1141', 'Indiana Pacers': '#FDBB30',
    'LA Clippers': '#C8102E', 'Los Angeles Lakers': '#FDB927', 'Memphis Grizzlies': '#5D76A9',
    'Miami Heat': '#98002E', 'Milwaukee Bucks': '#007736', 'Minnesota Timberwolves': '#236192',
    'New Orleans Pelicans': '#C8102E', 'New York Knicks': '#006BB6', 'Oklahoma City Thunder': '#007AC1',
    'Orlando Magic': '#0077C0', 'Philadelphia 76ers': '#006BB6', 'Phoenix Suns': '#E56020',
    'Portland Trail Blazers': '#E03A3E', 'Sacramento Kings': '#7B4FA0', 'San Antonio Spurs': '#C4CED4',
    'Toronto Raptors': '#CE1141', 'Utah Jazz': '#F9A01B', 'Washington Wizards': '#E31837'
  };
  function hashHue(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  }
  function teamColor(name) {
    var en = name && name.en;
    if (en && TEAM_COLOR[en]) return TEAM_COLOR[en];
    var key = en || (typeof name === 'string' ? name : 'TEAM');
    return 'hsl(' + hashHue(key) + ' 62% 64%)';
  }

  // NBA 球队中文短名（feed 每条事件的队伍标签用）；生成队兜底取中文名末段
  var TEAM_SHORT = {
    'Atlanta Hawks': '老鹰', 'Boston Celtics': '凯尔特人', 'Brooklyn Nets': '篮网',
    'Charlotte Hornets': '黄蜂', 'Chicago Bulls': '公牛', 'Cleveland Cavaliers': '骑士',
    'Dallas Mavericks': '独行侠', 'Denver Nuggets': '掘金', 'Detroit Pistons': '活塞',
    'Golden State Warriors': '勇士', 'Houston Rockets': '火箭', 'Indiana Pacers': '步行者',
    'LA Clippers': '快船', 'Los Angeles Lakers': '湖人', 'Memphis Grizzlies': '灰熊',
    'Miami Heat': '热火', 'Milwaukee Bucks': '雄鹿', 'Minnesota Timberwolves': '森林狼',
    'New Orleans Pelicans': '鹈鹕', 'New York Knicks': '尼克斯', 'Oklahoma City Thunder': '雷霆',
    'Orlando Magic': '魔术', 'Philadelphia 76ers': '76人', 'Phoenix Suns': '太阳',
    'Portland Trail Blazers': '开拓者', 'Sacramento Kings': '国王', 'San Antonio Spurs': '马刺',
    'Toronto Raptors': '猛龙', 'Utah Jazz': '爵士', 'Washington Wizards': '奇才'
  };
  function teamShort(name) {
    var en = name && name.en;
    if (en && TEAM_SHORT[en]) return TEAM_SHORT[en];
    var hans = C.hans(name);
    return hans.length > 3 ? hans.slice(-2) : hans;
  }
  // 给事件行加队伍标识：整行左侧球队色条 + 短名标签
  function decorateSide(line, side) {
    var t = lastMu[side];
    line.style.setProperty('--line-team', t.color);
    var tag = el('span', 'mbc-sidetag');
    tag.style.setProperty('--tagc', t.color);
    tag.textContent = teamShort(t.name);
    line.append(tag);
  }

  function life() { return C.life(); }
  function myPos(ball) {
    try { return (typeof kn === 'function') ? kn(ball) : 'wing'; } catch (e) { return 'wing'; }
  }
  // 系统真实姓名（与 Ed 给新秀命名同口径），去重
  function realName(used) {
    var n = null;
    for (var t = 0; t < 12; t++) { n = Ed(life(), 'NBA'); if (!used.has(n.en)) break; }
    used.add(n.en);
    return n;
  }

  // 轻量名单只有 ovr：以 ovr 为五轴锚点确定性生成 17 项，避免读到 null 全钳到 20
  function ratingsFromOvr(pl) {
    var o = Number(pl.ovr) || 70;
    return window.MBLAttrSys.genNpcRatings({ sh: o, ins: o, pm: o, df: o, ath: o }, pl.pos);
  }

  // ===== 正式比赛：从真实赛季建队 =====
  function buildRealMatchup() {
    var l = life(), season;
    try { season = Oa(l); } catch (e) { season = null; }
    if (!season) return null;
    var ng = pi(season);
    if (!ng) return null;
    var S = window.MBLAttrSys, ball = l.ball, pos = myPos(ball), used = new Set();

    // 我方 8 人：按 SLOT_POS 从赛季名单挑，能力缺失则由五轴确定性生成
    var roster = season.roster || [], taken = {};
    var mySide = SLOT_POS.map(function (slot) {
      var idx = roster.findIndex(function (pl, i) { return !taken[i] && pl.pos === slot; });
      if (idx < 0) idx = roster.findIndex(function (pl, i) { return !taken[i]; });
      if (idx < 0) return null;
      taken[idx] = 1;
      var pl = roster[idx], ratings = pl.ratings || ratingsFromOvr(pl);
      return { id: pl.name.en, name: pl.name, pos: pl.pos, ratings: ratings, ovr: pl.ovr };
    });
    // 玩家本人替换同位置
    var myBase = S.overall(ball.skills, pos);
    var meSlot = (function () { var i = mySide.findIndex(function (x) { return x && x.pos === pos; }); return i < 0 ? 0 : i; })();
    mySide[meSlot] = { id: 'me', name: (l.name && l.name.en) ? l.name : '你', pos: pos, ratings: ball.skills, ovr: myBase, badges: S.badgeTiers(ball.skills) };

    // 对手 8 人：真实队名 + 真实姓名，能力按对手球队的真实强度（season.strength）生成
    var oppName = ng.opp;
    var oppBase = C.clamp(Math.round(Number(season.strength[ng.index])) || myBase, 50, 98);
    var oppSide = SLOT_POS.map(function (p) {
      var nm = realName(used), r = iH(oppBase, p, Math.random);
      return { id: nm.en, name: nm, pos: p, ratings: r.ratings, ovr: r.ovr, badges: r.badges };
    });

    var myTeam = { name: season.team, players: mySide, color: teamColor(season.team) };
    var oppTeam = { name: oppName, players: oppSide, color: teamColor(oppName) };
    return ng.home
      ? { home: myTeam, away: oppTeam, mySide: 'home', gameIndex: ng.game - 1 }
      : { home: oppTeam, away: myTeam, mySide: 'away', gameIndex: ng.game - 1 };
  }

  // ===== 表演赛兜底（无正式比赛时） =====
  function buildExhibition() {
    var l = life();
    if (!l || !l.ball || !l.ball.started) return null;
    var ball = l.ball, S = window.MBLAttrSys, pos = myPos(ball);
    var base = C.clamp(S ? S.overall(ball.skills, pos) : 75, 62, 96), used = new Set();
    var myName = (ball.pro && ball.pro.team) ? ball.pro.team : { en: 'My Team', hans: '我的球队' };
    var myPlayers = SLOT_POS.map(function (p) {
      var nm = realName(used), r = iH(base, p, Math.random);
      return { id: nm.en, name: nm, pos: p, ratings: r.ratings, ovr: r.ovr };
    });
    var meIdx = (function () { var i = myPlayers.findIndex(function (x) { return x.pos === pos; }); return i < 0 ? 0 : i; })();
    myPlayers[meIdx] = { id: 'me', name: (l.name && l.name.en) ? l.name : '你', pos: pos, ratings: ball.skills, ovr: base };

    var oppName = { en: 'Away Team', hans: '客场对手' };
    var pool = (window.nt && nt.NBA && nt.NBA.teams) || [];
    var cand = pool.filter(function (t) { return t.en !== myName.en; });
    if (cand.length) oppName = cand[Math.floor(Math.random() * cand.length)];
    var oppBase = C.clamp(base + Math.round((Math.random() - .5) * 8), 60, 97);
    var oppPlayers = SLOT_POS.map(function (p) {
      var nm = realName(used), r = iH(oppBase, p, Math.random);
      return { id: nm.en, name: nm, pos: p, ratings: r.ratings, ovr: r.ovr };
    });
    return { home: { name: myName, players: myPlayers, color: teamColor(myName) },
      away: { name: oppName, players: oppPlayers, color: teamColor(oppName) }, mySide: 'home' };
  }

  // ===== 季后赛：从当前系列赛建队（用 cy 上下文 + 同份 roster） =====
  function buildPlayoffMatchup(series) {
    var l = life(), s = l && l.ball && l.ball.season;
    if (!s || s.phase !== 'playoffs') return null;
    var cx = cy(s);
    if (!cx) return null;
    var S = window.MBLAttrSys, ball = l.ball, pos = myPos(ball), taken = {};
    var roster = s.roster || [];
    var mySide = SLOT_POS.map(function (slot) {
      var idx = roster.findIndex(function (pl, i) { return !taken[i] && pl.pos === slot; });
      if (idx < 0) idx = roster.findIndex(function (pl, i) { return !taken[i]; });
      if (idx < 0) return null;
      taken[idx] = 1;
      var pl = roster[idx];
      return { id: pl.name.en, name: pl.name, pos: pl.pos, ratings: pl.ratings || ratingsFromOvr(pl), ovr: pl.ovr };
    });
    var myBase = S.overall(ball.skills, pos);
    var meSlot = (function () { var i = mySide.findIndex(function (x) { return x && x.pos === pos; }); return i < 0 ? 0 : i; })();
    mySide[meSlot] = { id: 'me', name: (l.name && l.name.en) ? l.name : '你', pos: pos, ratings: ball.skills, ovr: myBase, badges: S.badgeTiers(ball.skills) };

    var used = new Set();
    var oppBase = C.clamp(Math.round(Number(s.strength[cx.oppIndex])) || myBase, 50, 98);
    var oppSide = SLOT_POS.map(function (p) {
      var nm = realName(used), r = iH(oppBase, p, Math.random);
      return { id: nm.en, name: nm, pos: p, ratings: r.ratings, ovr: r.ovr, badges: r.badges };
    });
    if (series) {
      mySide = mySide.map(function (player, index) {
        if (!player || (player.id === 'me' && series.out > series.games.length)) {
          var pos = SLOT_POS[index], reserve = iH(myBase - 8, pos, Math.random);
          player = { id: 'reserve' + index, name: realName(used), pos: pos,
            ratings: reserve.ratings, ovr: reserve.ovr };
        }
        var ratings = Object.fromEntries(Object.entries(player.ratings).map(function (entry) {
          return [entry[0], C.clamp(entry[1] + series.bonus, 20, 99)];
        }));
        return Object.assign({}, player, { ratings: ratings });
      });
    }
    var myTeam = { name: s.team, players: mySide, color: teamColor(s.team) };
    var oppTeam = { name: cx.opp, players: oppSide, color: teamColor(cx.opp) };
    var higherSeedHome = ![2, 3, 5].includes(series?.games.length ?? 0);
    var myHome = cx.head !== 0 ? cx.head > 0 : (cx.mySeed <= cx.oppSeed) === higherSeedHome;
    var mu = myHome
      ? { home: myTeam, away: oppTeam, mySide: 'home' }
      : { home: oppTeam, away: myTeam, mySide: 'away' };
    mu.playoffGameNo = (series?.games.length ?? 0) + 1;
    return mu;
  }

  var dialog = null, timer = null, speedIdx = 0, playing = false;
  var gameOver = false;
  var closeCb = null; // 真实比赛/系列赛终场、退出弹窗后触发的自动结算回调
  var feed = null, scoreEls = {}, teamEls = {}, metaEl = null;
  var runScore = { home: 0, away: 0 }, ctx = null;
  var boxView = null, tabMode = 'live', lastMu = null;
  var liveSnap = null, liveProg = 0, clutchShown = false;

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = el('dialog', 'mbl-broadcast');
    var wrap = el('div', 'mbc-wrap');
    var sb = el('div', 'mbc-scoreboard');
    var titleRow = el('div', 'mbc-title-row');
    var titleBox = el('span', 'mbc-title-box');
    titleBox.append(el('span', 'mbc-title', '比赛直播'));
    var liveBadge = el('span', 'mbc-live-badge is-live');
    liveBadge.append(el('i', 'mbc-live-dot'), el('span', 'mbc-live-txt', 'LIVE'));
    titleBox.append(liveBadge);
    titleRow.append(titleBox,
      (function () { var b = el('button', 'mbc-close', '退出'); b.type = 'button'; b.onclick = stop; return b; })());
    var teams = el('div', 'mbc-teams');
    teams.append(teamBlock('home'), teamBlock('away'));
    metaEl = el('div', 'mbc-meta');
    var tabs = el('div', 'mbc-tabs');
    var liveTab = el('button', 'mbc-tab is-active', '直播');
    liveTab.type = 'button';
    var boxTab = el('button', 'mbc-tab', '数据');
    boxTab.type = 'button';
    liveTab.onclick = function () { switchTab('live'); };
    boxTab.onclick = function () { switchTab('box'); };
    tabs.append(liveTab, boxTab);
    sb.append(titleRow, teams, metaEl, tabs);
    feed = el('div', 'mbc-feed');
    boxView = el('div', 'mbc-boxview');
    boxView.hidden = true;
    var controls = el('div', 'mbc-controls');
    var playBtn = el('button', 'mbc-btn is-primary', '暂停');
    playBtn.type = 'button'; playBtn.onclick = togglePlay;
    var speedBtn = el('button', 'mbc-btn', SPEEDS[speedIdx].t);
    speedBtn.type = 'button';
    speedBtn.onclick = function () {
      speedIdx = (speedIdx + 1) % SPEEDS.length;
      speedBtn.textContent = SPEEDS[speedIdx].t;
      if (playing) { clearInterval(timer); startTimer(); }
    };
    var skipBtn = el('button', 'mbc-btn', '跳到结尾');
    skipBtn.type = 'button'; skipBtn.onclick = skipAll;
    controls.append(playBtn, speedBtn, skipBtn);
    wrap.append(sb, feed, boxView, controls);
    dialog.append(wrap);
    dialog._playBtn = playBtn; dialog._speedBtn = speedBtn;
    dialog._liveTab = liveTab; dialog._boxTab = boxTab;
    dialog._liveBadge = liveBadge;
    document.body.append(dialog);
    return dialog;
  }
  function teamBlock(side) {
    var d = el('div', 'mbc-team' + (side === 'home' ? ' is-mine' : ''));
    var logo = el('span', 'mbc-team-logo');
    var name = el('span', 'mbc-team-name');
    var sc = el('span', 'mbc-team-score', '0');
    d.append(logo, name, sc);
    teamEls[side] = d; scoreEls[side] = { name: name, score: sc, logo: logo };
    return d;
  }

  // ===== 技术统计（box score，真实转播口径） =====
  var BOX_COLS = ['球员', '分钟', '得分', '投篮', '三分', '罚球', '篮板', '助攻', '抢断', '盖帽', '失误', '犯规'];

  function switchTab(mode) {
    if (tabMode === mode) return;
    tabMode = mode;
    dialog._liveTab.classList.toggle('is-active', mode === 'live');
    dialog._boxTab.classList.toggle('is-active', mode === 'box');
    if (mode === 'box') {
      if (isLiveDone()) renderBoxScore(); else renderLiveBox();
      feed.hidden = true; boxView.hidden = false;
    }
    else { boxView.hidden = true; feed.hidden = false; }
  }
  function isLiveDone() { return gameOver; }
  function renderBoxPending() {
    boxView.replaceChildren();
    var d = el('div', 'mbc-box-pending');
    d.innerHTML =
      '<div class="mbc-bp-ico">🏀</div>' +
      '<b>直播进行中</b>' +
      '<p>为避免提前剧透，完整技术统计将在终场后显示。</p>' +
      '<p class="mbc-bp-score">当前比分 ' + runScore.home + ' : ' + runScore.away + '</p>';
    boxView.append(d);
  }
  function resetTabLive() {
    tabMode = 'live';
    if (dialog) {
      dialog._liveTab.classList.add('is-active');
      dialog._boxTab.classList.remove('is-active');
    }
    boxView.hidden = true; feed.hidden = false;
  }
  function currentGame() {
    return game;
  }
  function renderBoxScore() {
    var g = currentGame();
    boxView.replaceChildren();
    if (!g) { boxView.append(el('div', 'mbc-box-empty', '暂无数据')); return; }
    boxView.append(boxSection('home', g), boxSection('away', g));
    boxView.scrollTop = 0;
  }
  // 直播中：用当前事件的 box 快照渲染“打到此刻”的实时数据（得分/分钟实时算，不剧透终场）
  function renderLiveBox() {
    var g = currentGame();
    boxView.replaceChildren();
    if (!g || !liveSnap) { boxView.append(el('div', 'mbc-box-empty', '暂无数据')); return; }
    boxView.append(boxSection('home', g, liveSnap, liveProg), boxSection('away', g, liveSnap, liveProg));
    boxView.scrollTop = 0;
  }
  function td(txt, cls) {
    var c = document.createElement('td');
    if (cls) c.className = cls;
    c.textContent = txt;
    return c;
  }
  // r23：点 box 里的球员名，复用 mbl-float-layer 的 shape 浮层（与球队页完全同一套，含关闭/Esc）
  function shapeFromPlayer(p) {
    var S = window.MBLAttrSys;
    var five = S.matchFive(p.ratings);
    var badges = p.badges || S.badgeTiers(p.ratings);
    var n = Object.assign({}, five, { ratings: p.ratings, badges: badges });
    return jk({ name: p.name, pos: p.pos, ovr: p.ovr, age: p.age }, Mp(p), n);
  }
  function nameCell(p) {
    var c = document.createElement('td');
    c.className = 'is-name is-link';
    c.textContent = C.hans(p.name);
    var key = 'boxshape:' + p.id + ':' + p.pos;
    // box 渲染独立于 mn，而 mn 会 TB.clear，故用独立注册表，避免工厂被清掉
    window.__boxShapes = window.__boxShapes || new Map();
    window.__boxShapes.set(key, function () { return shapeFromPlayer(p); });
    c.dataset.act = 'shape';
    c.dataset.v = key;
    return c;
  }
  function boxSection(side, g, snap, prog) {
    var t = g[side], live = !!snap;
    var sec = el('div', 'mbc-box-sec');
    var head = el('div', 'mbc-box-head');
    var color = lastMu && lastMu[side] ? lastMu[side].color : null;
    var nm = el('span', 'mbc-box-tname', C.hans(t.name));
    if (color) nm.style.color = color;
    head.append(nm, el('span', 'mbc-box-tscore', String(live ? runScore[side] : g.score[side])));
    if (live) head.append(el('span', 'mbc-box-live', '实时'));
    sec.append(head);

    var wrapTbl = el('div', 'mbc-table-wrap');
    var table = document.createElement('table');
    table.className = 'mbc-table';
    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    BOX_COLS.forEach(function (c) { var th = document.createElement('th'); th.textContent = c; hr.append(th); });
    thead.append(hr); table.append(thead);

    var tbody = document.createElement('tbody');
    var T = { min: 0, pts: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0, ore: 0, dre: 0, ast: 0, stl: 0, blk: 0, to: 0, pf: 0 };
    t.players.forEach(function (p) {
      var fb = t.box[p.id], b, dMin, dPts;
      if (live) {
        b = snap[side][p.id] || fb;
        dMin = Math.min(Math.round(fb.min), Math.round(fb.min * (prog || 0)));
        dPts = (b.fgm - b.tpm) * 2 + b.tpm * 3 + b.ftm;
      } else { b = fb; dMin = Math.round(b.min); dPts = b.pts; }
      var tr = document.createElement('tr');
      if (p.id === 'me') tr.className = 'is-me';
      tr.append(nameCell(p),
        td(dMin), td(dPts),
        td(b.fgm + '-' + b.fga), td(b.tpm + '-' + b.tpa), td(b.ftm + '-' + b.fta),
        td(b.ore + b.dre), td(b.ast), td(b.stl), td(b.blk), td(b.to), td(b.pf));
      tbody.append(tr);
      T.min += dMin; T.pts += dPts;
      T.fga += b.fga; T.fgm += b.fgm; T.tpa += b.tpa; T.tpm += b.tpm; T.fta += b.fta; T.ftm += b.ftm;
      T.ore += b.ore; T.dre += b.dre; T.ast += b.ast; T.stl += b.stl; T.blk += b.blk; T.to += b.to; T.pf += b.pf;
    });
    var trt = document.createElement('tr');
    trt.className = 'is-total';
    trt.append(td('全队', 'is-name'),
      td(Math.round(T.min)), td(T.pts),
      td(T.fgm + '-' + T.fga), td(T.tpm + '-' + T.tpa), td(T.ftm + '-' + T.fta),
      td(T.ore + T.dre), td(T.ast), td(T.stl), td(T.blk), td(T.to), td(T.pf));
    tbody.append(trt);
    table.append(tbody);
    wrapTbl.append(table);
    sec.append(wrapTbl);
    return sec;
  }

  // ===== 紧凑 box（存档用）：短键 + 15 项数组，供球队界面历史比赛详情还原 =====
  var BOX_KEYS = ['min', 'pts', 'fga', 'fgm', 'tpa', 'tpm', 'fta', 'ftm',
    'ore', 'dre', 'ast', 'stl', 'blk', 'to', 'pf'];
  function compactTeam(g, side) {
    var t = g[side];
    return {
      name: C.hans(t.name), score: g.score[side],
      rows: t.players.map(function (p) {
        var b = t.box[p.id];
        return { n: C.hans(p.name), me: p.id === 'me' || undefined,
          en: p.name && p.name.en, pos: p.pos, ovr: p.ovr,
          s: BOX_KEYS.map(function (k) { return b[k]; }) };
      })
    };
  }
  function compactBox(g) {
    return { home: compactTeam(g, 'home'), away: compactTeam(g, 'away') };
  }
  // 模拟路径用：建真实对阵并跑引擎，返回与直播同形状的 preset（含完整 box）
  function makePreset() {
    var mu = buildRealMatchup();
    if (!mu) return null;
    var g = window.MBLMatchEngine.simulate(mu.home, mu.away, { rng: Math.random });
    var mine = mu.mySide, other = mine === 'home' ? 'away' : 'home', b = g[mine].box['me'];
    return {
      gameIndex: mu.gameIndex,
      us: g.score[mine], them: g.score[other],
      pts: b.pts, reb: b.ore + b.dre, ast: b.ast, stl: b.stl, blk: b.blk,
      box: compactBox(g)
    };
  }

  function periodLabel(period) {
    return period > 4 ? '第 ' + (period - 4) + ' 个加时' : '第 ' + period + ' 节';
  }

  function buildItems(g) {
    var items = [], lastQ = 0;
    g.events.forEach(function (ev) {
      if (ev.q !== lastQ) {
        if (lastQ >= 1 && g.quarters && g.quarters[lastQ - 1]) {
          var qs = g.quarters[lastQ - 1];
          items.push({ qEnd: lastQ, qHome: qs.home, qAway: qs.away });
        }
        items.push({ marker: periodLabel(ev.q) });
        lastQ = ev.q;
      }
      items.push(ev);
    });
    if (lastQ && g.quarters && g.quarters[lastQ - 1]) {
      var finalPeriod = g.quarters[lastQ - 1];
      items.push({ qEnd: lastQ, qHome: finalPeriod.home, qAway: finalPeriod.away });
    }
    return items;
  }

  function renderLine(ev) {
    if (ev.qEnd) {
      var qe = el('div', 'mbc-qend');
      qe.append(el('span', 'mbc-qe-txt', periodLabel(ev.qEnd) + '结束'),
        el('span', 'mbc-qe-score', (ev.qEnd > 4 ? '加时 ' : '本节 ') + ev.qHome + ' : ' + ev.qAway));
      feed.append(qe);
      feed.scrollTop = feed.scrollHeight;
      return;
    }
    if (ev.marker) {
      var mk = el('div', 'mbc-qmarker');
      mk.append(el('span', 'mbc-qm-txt', ev.marker));
      if (ev.qHome != null) mk.append(el('span', 'mbc-qm-score', ev.qHome + ' : ' + ev.qAway));
      feed.append(mk);
      return;
    }
    runScore[ev.side] += (ev.points || 0);
    scoreEls.home.score.textContent = runScore.home;
    scoreEls.away.score.textContent = runScore.away;
    if (ev.points > 0) bumpScore(ev.side);
    if (ev._snap) liveSnap = ev._snap;
    liveProg = progOf(ev);
    metaEl.replaceChildren();
    metaEl.append(meta2(periodLabel(ev.q)), meta2(formatClock(ev.clock)));
    var line = el('div', 'mbc-line ' + lineClass(ev));
    decorateSide(line, ev.side);
    if (isMineEvent(ev)) line.classList.add('is-mine');
    var clutch = ev.q >= 4 && Math.abs(runScore.home - runScore.away) <= 8;
    if (clutch) {
      line.classList.add('is-clutch');
      if (!clutchShown) { feed.append(el('div', 'mbc-clutch-marker', '关键时刻')); clutchShown = true; }
    }
    if (ev.points > 0) line.append(el('span', 'mbc-score-inline', '+' + ev.points));
    line.append(el('span', 'mbc-text', ev.text));
    if (ev.badges && ev.badges.length) {
      var bw = el('div', 'mbc-badges');
      ev.badges.forEach(function (b) { bw.append(el('span', 'mbc-chip', b.name)); });
      line.append(bw);
    }
    feed.append(line);
    feed.scrollTop = feed.scrollHeight;
    if (tabMode === 'box' && !isLiveDone()) renderLiveBox();
  }
  function lineClass(ev) {
    if (ev.kind === 'ft') return 'is-ft';
    if (ev.kind === 'oreb' || ev.kind === 'rebound') return 'is-rebound';
    if (ev.kind === 'to' || ev.kind === 'foul') return 'is-to';
    return ev.points > 0 ? 'is-score' : '';
  }
  function meta2(t) { return el('b', '', t); }
  function formatClock(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m ? m + ':' + (s < 10 ? '0' : '') : '') + s;
  }
  // 玩家本人中文名（事件里 actor 是中文名）
  function myHansName() {
    var l = life();
    return (l && l.name && l.name.hans) ? l.name.hans : '你';
  }
  function isMineEvent(ev) {
    var me = myHansName();
    return ev.actor === me || ev.assist === me || ev.dreb === me || ev.blocked === me;
  }
  // 比赛时间进度（0~1），用于实时分钟按比例走
  function progOf(ev) {
    var elapsed = (ev.q - 1) * 720 + (720 - ev.clock);
    return Math.max(0, Math.min(1, elapsed / 2880));
  }
  // 进球时比分数字跳动
  function bumpScore(side) {
    var sc = scoreEls[side].score;
    sc.classList.remove('is-bump');
    void sc.offsetWidth;
    sc.classList.add('is-bump');
  }
  // 终场后把 LIVE 徽章切成“终场”
  function setLiveEnd() {
    if (!dialog || !dialog._liveBadge) return;
    var b = dialog._liveBadge;
    b.classList.remove('is-live');
    b.classList.add('is-end');
    b.querySelector('.mbc-live-txt').textContent = '终场';
  }
  // 新一场开始：徽章复位为 LIVE
  function resetLiveBadge() {
    if (!dialog || !dialog._liveBadge) return;
    var b = dialog._liveBadge;
    b.classList.add('is-live');
    b.classList.remove('is-end');
    b.querySelector('.mbc-live-txt').textContent = 'LIVE';
  }

  var items = [], cursor = 0, game = null;
  function startTimer() {
    timer = setInterval(function () {
      if (cursor >= items.length) { finish(); return; }
      renderLine(items[cursor++]);
    }, SPEEDS[speedIdx].ms);
  }
  function togglePlay() {
    if (playing) { playing = false; clearInterval(timer); dialog._playBtn.textContent = '播放'; }
    else {
      if (cursor >= items.length) return;
      playing = true; dialog._playBtn.textContent = '暂停'; startTimer();
    }
  }
  function skipAll() {
    clearInterval(timer); playing = false; dialog._playBtn.textContent = '播放';
    while (cursor < items.length) renderLine(items[cursor++]);
    finish();
  }
  function commitPreset() {
    if (!ctx.real) return;
    var mine = ctx.mySide, other = mine === 'home' ? 'away' : 'home';
    var b = game[mine].box['me'];
    window.__mblPreset = {
      gameIndex: ctx.gameIndex,
      us: game.score[mine], them: game.score[other],
      pts: b.pts, reb: b.ore + b.dre, ast: b.ast, stl: b.stl, blk: b.blk,
      box: compactBox(game)
    };
  }
  function finish() {
    clearInterval(timer); playing = false; gameOver = true;
    if (dialog) dialog._playBtn.textContent = '播放';
    setLiveEnd();
    commitPreset();
    if (tabMode === 'box') renderBoxScore();
    if (ctx.playoff) {
      feed.append(el('div', 'mbc-line is-final', '终场 ' + runScore.home + ' : ' + runScore.away + '（已计入系列赛）'));
    } else if (ctx.real) {
      feed.append(el('div', 'mbc-line is-final', '终场 ' + runScore.home + ' : ' + runScore.away +
        '（已计入正式战绩，点退出后继续即可）'));
    } else {
      var win = game.winner === ctx.mySide ? '（你赢了）'
        : (game.winner === 'home' || game.winner === 'away') ? '（你输了）' : '（平局）';
      feed.append(el('div', 'mbc-line is-final', '终场 ' + runScore.home + ' : ' + runScore.away + ' ' + win));
    }
    feed.scrollTop = feed.scrollHeight;
  }
  function stop() {
    // 终场（preset 已写入）才自动结算；中途退出保持原样，不替玩家推进
    var finished = gameOver;
    var real = !!(ctx && ctx.real);
    clearInterval(timer);
    playing = false;
    if (dialog && dialog.open) dialog.close();
    var cb = closeCb; closeCb = null;
    if (cb && real && finished) setTimeout(cb, 0);
  }
  function paintTeam(side, t) {
    teamEls[side].style.setProperty('--team', t.color);
    scoreEls[side].name.textContent = C.hans(t.name);
    var tm = (t.name && typeof t.name === 'object') ? t.name : { en: t.name, hans: C.hans(t.name) };
    var yr;
    try { yr = life().ball.season.year; } catch (e) { yr = new Date().getFullYear(); }
    scoreEls[side].logo.innerHTML = TBadge(tm, yr);
  }

  function present(mu, real, replay) {
    if (!mu || !window.MBLMatchEngine) return;
    ensureDialog();
    paintTeam('home', mu.home); paintTeam('away', mu.away);
    lastMu = { home: mu.home, away: mu.away };
    game = replay || window.MBLMatchEngine.simulate(mu.home, mu.away, { rng: Math.random });
    ctx = { real: !!real, playoff: !!replay, mySide: mu.mySide, gameIndex: mu.gameIndex };
    dialog.querySelector('.mbc-title').textContent = replay ? '季后赛第 ' + mu.playoffGameNo + ' 场' : '比赛直播';
    gameOver = false;
    clutchShown = false; liveSnap = null; liveProg = 0;
    resetLiveBadge();
    runScore = { home: 0, away: 0 };
    scoreEls.home.score.textContent = '0'; scoreEls.away.score.textContent = '0';
    feed.replaceChildren();
    items = buildItems(game); cursor = 0; speedIdx = 0; dialog._speedBtn.textContent = SPEEDS[0].t;
    resetTabLive();
    if (!dialog.open) dialog.showModal();
    playing = true; dialog._playBtn.textContent = '暂停';
    clearInterval(timer); startTimer();
  }

  function open(doneCb) {
    var mu = buildRealMatchup();
    if (mu) { closeCb = doneCb || null; present(mu, true); }
    else { closeCb = null; mu = buildExhibition(); if (mu) present(mu, false); }
  }

  function makePlayoffGame(series, rng) {
    var mu = buildPlayoffMatchup(series);
    if (!mu || !window.MBLMatchEngine) return null;
    var game = window.MBLMatchEngine.simulate(mu.home, mu.away, { rng: rng, overtime: true });
    return game.winner ? { mu: mu, game: game } : null;
  }

  function openPlayoff() {
    if (dialog && dialog.open) return;
    var replay = playNextPlayoffGame();
    if (replay) { closeCb = null; present(replay.mu, false, replay.game); }
  }

  function hasRealGame() {
    try { var s = Oa(life()); return !!(s && pi(s)); } catch (e) { return false; }
  }

  function mountEntry() {
    if (C.screen() !== 'play') return;
    // 正式比赛入口已移到「生涯」作战日历；篮球视图只在没有正式比赛时保留表演赛兜底
    if (hasRealGame()) {
      var old = document.querySelector('[data-view="ball"] .mbc-entry');
      if (old) old.remove();
      return;
    }
    var view = document.querySelector('[data-view="ball"]');
    if (!view || view.querySelector('.mbc-entry')) return;
    var btn = el('button', 'mbc-entry');
    btn.type = 'button';
    btn.textContent = '观看比赛直播（广播·表演赛）';
    btn.onclick = function () {
      var l = life();
      if (!l || !l.ball || !l.ball.started) { btn.textContent = '开始接触篮球后可观看'; return; }
      open();
    };
    view.prepend(btn);
  }
  C.onDom(mountEntry, 'play');

  window.MBLBroadcast = {
    open: open,
    openPlayoff: openPlayoff,
    makePlayoffGame: makePlayoffGame,
    makePreset: makePreset,
    _state: function () { return { game: game, ctx: ctx, runScore: runScore }; },
    _buildReal: buildRealMatchup,
    _buildEx: buildExhibition,
    _buildPlayoff: buildPlayoffMatchup
  };
})();
