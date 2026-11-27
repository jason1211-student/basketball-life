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
    { id: .5, ms: 1200, t: '0.5x' },
    { id: 1, ms: 780, t: '1x' },
    { id: 2, ms: 430, t: '2x' },
    { id: 4, ms: 230, t: '4x' },
    { id: 8, ms: 110, t: '8x' }
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
  function realName(used, sourceLife) {
    var n = null;
    for (var t = 0; t < 12; t++) { n = Ed(sourceLife || life(), 'NBA'); if (!used.has(n.en)) break; }
    used.add(n.en);
    return n;
  }

  // 轻量名单只有 ovr：以 ovr 为五轴锚点确定性生成 17 项，避免读到 null 全钳到 20
  function ratingsFromOvr(pl) {
    var o = Number(pl.ovr) || 70;
    return window.MBLAttrSys.genNpcRatings({ sh: o, ins: o, pm: o, df: o, ath: o }, pl.pos);
  }

  function fixtureIndex(s){return s.games.length+(s.series||[]).reduce((n,r)=>n+(r.games?.length||0),0)+(s.activePlayoffSeries?.games?.length||0);}
  function slotsFor(s){return s.leagueId==='NBA'?SLOT_POS.concat('wing','guard'):SLOT_POS.slice();}
  function fitForMatch(l,s,p){if(s.leagueId!=="NBA")return true;const injury=l.ball.matchAbsences?.[p.id];return !(injury?.year===s.year && fixtureIndex(s)<injury.until) && (typeof F8!=='function'||!F8(l,s,p,s.games.length));}
  function matchContext(l,s,home,away){
    const plans={},energy={};
    for(const [side,t] of Object.entries({home,away})){
      const coach=l.ball.headCoach?.team===t.name.en?l.ball.headCoach:l.benches?.by?.[t.name.en];
      plans[side]={...coach?.style,...coach?.plan};energy[side]={};
      for(const p of t.players){const recent=l.ball.matchLoad?.[p.id];if(recent?.year===s.year && recent.team===t.name.en && recent.game===fixtureIndex(s)-1)energy[side][p.id]=Math.max(75,100-Math.max(0,recent.min-18)*.7/(s.phase==="regular"?(window.MBLTeamCalendar?.restDays(s.games.length)||2):2));}
    }
    return {plans,energy};
  }
  function ensureFive(l,s,name,pool,needed){
    if(s.leagueId!=='NBA')return pool;
    // Season rosters and the club catalogue can contain the same registration twice.
    // Keep distinct namesakes when they have distinct player IDs.
    const ids=new Set();
    pool=pool.filter(player=>{
      if(ids.has(player.id))return false;
      ids.add(player.id);
      return true;
    });
    if(pool.length>=needed)return pool;
    for(let slot=64;slot<96 && pool.length<needed;slot++){
      const entry=MBLDevelopment.depth(l,s.leagueId,name.en,s.year,slot);
      const p=MBLDevelopment.template(l,s.leagueId,s.year,entry);
      if(!ids.has(p.id)&&fitForMatch(l,s,p)){pool.push(p);ids.add(p.id);}
    }
    return pool;
  }
  function opponentLineup(l,season,name) {
    const squad=MBLDevelopment.club(l,season,name);
    return MBLDevelopment.lineup(ensureFive(l,season,name,squad.filter(p=>fitForMatch(l,season,p)),5),slotsFor(season)).filter(Boolean);
  }
  function careerLineup(l,season,absent) {
    const roster=MBLDevelopment.roster(l,season), pos=myPos(l.ball);
    let pool=roster.filter(p=>!p.me && !p.out && !p.rest && fitForMatch(l,season,p));
    if(pool.length<slotsFor(season).length){
      const seen=new Set(roster.map(p=>p.name.en));
      pool=pool.concat(MBLDevelopment.club(l,season,season.team).filter(p=>!seen.has(p.name.en)&&fitForMatch(l,season,p)));
    }
    const slots=slotsFor(season), role=window.MBLTeamRoom?.view(l,season);
    const shift=role && role.role<3?5:0;
    const slot=slots.findIndex((p,i)=>i>=shift && p===pos);
    const idx=slot>=0?slot:shift;
    if(!absent)slots.splice(idx,1);
    const squad=MBLDevelopment.lineup(ensureFive(l,season,season.team,pool,absent?5:4),slots);
    if(!absent)squad.splice(idx,0,{id:'me',pos,age:l.age,name:l.name,ratings:l.ball.skills,
      ...(role?{rotation:{minutes:role.planned,usage:role.usage,starter:role.role>=3,role:role.roleName}}:{}),
      ovr:MBLAttrSys.overall(l.ball.skills,pos),pot:MBLAttrSys.overall(l.ball.potential||l.ball.skills,pos),
      badges:MBLAttrSys.activeBadges(l.ball.skills,pos)});
    return squad.filter(Boolean);
  }
  // ===== 正式比赛：从真实赛季建队 =====
  function buildRealMatchup(absent, gameIndex,source) {
    var l = source||life(), season;
    try { season = source?.ball?.season?.phase==="regular"?source.ball.season:Oa(l); } catch (e) { season = null; }
    if (!season) return null;
    var ng = gameIndex == null ? pi(season) :
      (Number.isInteger(gameIndex) && gameIndex >= season.games.length && gameIndex < season.total
        ? {game:gameIndex+1,index:season.schedule[gameIndex],opp:season.teams[season.schedule[gameIndex]],home:gameIndex%2===0} : null);
    if (!ng) return null;
    absent = absent ?? ((l.ball.out ?? 0) > 0 || l.prisonYears > 0 || !!season.sitOut || hb(season));
    var seed = window.MBLMatchRecord.seedFor(l, season, 'regular', ng.game - 1);
    var mySide = careerLineup(l,season,absent);
    var oppName = ng.opp;
    var oppSide = opponentLineup(l,season,oppName);
    var myTeam = { name: season.team, players: mySide, color: teamColor(season.team) };
    var oppTeam = { name: oppName, players: oppSide, color: teamColor(oppName) };
    const context=matchContext(l,season,ng.home?myTeam:oppTeam,ng.home?oppTeam:myTeam);
    if(season.leagueId==="NBA")window.MBLMatchStory?.applyPlan(l,seed,context,ng.home?"home":"away");
    return ng.home
      ? { home: myTeam, away: oppTeam, mySide: 'home', model:season.leagueId==="NBA"?4:3, context, gameIndex: ng.game - 1, seed: seed,year:season.year,leagueId:season.leagueId }
      : { home: oppTeam, away: myTeam, mySide: 'away', model:season.leagueId==="NBA"?4:3, context, gameIndex: ng.game - 1, seed: seed,year:season.year,leagueId:season.leagueId };
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
      return { id: nm.en, name: nm, pos: p, ratings: r.ratings, badges:S.activeBadges(r.ratings,p), ovr: S.overall(r.ratings,p) };
    });
    var meIdx = (function () { var i = myPlayers.findIndex(function (x) { return x.pos === pos; }); return i < 0 ? 0 : i; })();
    myPlayers[meIdx] = { id: 'me', name: (l.name && l.name.en) ? l.name : '你', pos: pos, ratings: ball.skills, ovr:S.overall(ball.skills,pos),badges:S.activeBadges(ball.skills,pos),age:l.age };

    var oppName = { en: 'Away Team', hans: '客场对手' };
    var pool = (window.nt && nt.NBA && nt.NBA.teams) || [];
    var cand = pool.filter(function (t) { return t.en !== myName.en; });
    if (cand.length) oppName = cand[Math.floor(Math.random() * cand.length)];
    var oppBase = C.clamp(base + Math.round((Math.random() - .5) * 8), 60, 97);
    var oppPlayers = SLOT_POS.map(function (p) {
      var nm = realName(used), r = iH(oppBase, p, Math.random);
      return { id: nm.en, name: nm, pos: p, ratings: r.ratings, badges:S.activeBadges(r.ratings,p), ovr: S.overall(r.ratings,p) };
    });
    return { home: { name: myName, players: myPlayers, color: teamColor(myName) },
      away: { name: oppName, players: oppPlayers, color: teamColor(oppName) }, mySide: 'home' };
  }

  // ===== 季后赛：从当前系列赛建队（用 cy 上下文 + 同份 roster） =====
  function buildPlayoffMatchup(series, seed,source) {
    var l = source||life(), s = l && l.ball && l.ball.season;
    if (!s || s.phase !== 'playoffs') return null;
    var cx = cy(s);
    if (!cx) return null;
    var mySide = careerLineup(l,s,(s.leagueId==="NBA" && (l.ball.out||0)>0) || (series && series.out > series.games.length));
    if (series?.bonus && s.leagueId!=="NBA") {
      mySide = mySide.map(player=>{
        const ratings = Object.fromEntries(Object.entries(player.ratings).map(([key,value])=>[key,C.clamp(value+series.bonus,0,99)]));
        return {...player,ratings,ovr:MBLAttrSys.overall(ratings,player.pos),badges:MBLAttrSys.activeBadges(ratings,player.pos)};
      });
    }
    var oppSide = opponentLineup(l,s,cx.opp);
    var myTeam = { name: s.team, players: mySide, color: teamColor(s.team) };
    var oppTeam = { name: cx.opp, players: oppSide, color: teamColor(cx.opp) };
    var higherSeedHome = ![2, 3, 5].includes(series?.games.length ?? 0);
    var myHome = cx.head !== 0 ? cx.head > 0 : (cx.mySeed <= cx.oppSeed) === higherSeedHome;
    var mu = myHome
      ? { home: myTeam, away: oppTeam, mySide: 'home' }
      : { home: oppTeam, away: myTeam, mySide: 'away' };
    mu.playoffGameNo = (series?.games.length ?? 0) + 1;
    mu.model=s.leagueId==="NBA"?4:3;mu.context=matchContext(l,s,mu.home,mu.away);if(mu.model===4){
      const plan=mu.context.plans[mu.mySide], pick=series?.plan;
      if(pick?.offense)plan.offense=pick.offense;
      if(pick?.choice==='share')plan.offense='motion';
      if(pick?.choice==='defend')plan.defense='man';
      if(pick?.choice==='score')plan.offense='iso';
      mu.context.preparation={side:mu.mySide,edge:C.clamp(series?.bonus||0,-12,12),usage:pick?.choice==='score'?.16:0};
    }
    mu.year=s.year;mu.leagueId=s.leagueId;mu.seed=seed;
    return mu;
  }

  var dialog = null, timer = null, speedIdx = 0, playing = false;
  var gameOver = false;
  var closeCb = null; // 真实比赛/系列赛终场、退出弹窗后触发的自动结算回调
  var feed = null, scoreEls = {}, teamEls = {}, metaEl = null, autoFollow = true;
  var runScore = { home: 0, away: 0 }, ctx = null;
  var storyTracker;
  var boxView = null, tabMode = 'live', lastMu = null, matchSerial=0;
  var liveSnap = null, liveProg = 0, clutchShown = false, liveBoxGame = null, finalBoxGame = null;
  var periodStrip, leadBar, leadLabel, followBtn, feedTools, fastForward = false;

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = el('dialog', 'mbl-broadcast');
    var wrap = el('div', 'mbc-wrap');
    var sb = el('div', 'mbc-scoreboard');
    var titleRow = el('div', 'mbc-title-row');
    var titleBox = el('span', 'mbc-title-box');
    const title=el('span','mbc-title','比赛直播');title.id='mbl-broadcast-title';
    dialog.setAttribute('aria-labelledby',title.id);
    titleBox.append(el('span','arena-broadcast-mark','MBL'),title);
    var liveBadge = el('span', 'mbc-live-badge is-live');
    liveBadge.append(el('i', 'mbc-live-dot'), el('span', 'mbc-live-txt', 'LIVE'));
    titleBox.append(liveBadge);
    titleRow.append(titleBox,
      (function () { var b = el('button', 'mbc-close', '退出'); b.type = 'button'; b.onclick = stop; return b; })());
    var teams = el('div', 'mbc-teams');
    teams.append(teamBlock('home'), teamBlock('away'));
    metaEl = el('div', 'mbc-meta');
    leadBar = el('div', 'arena-lead-bar');
    leadLabel = el('div', 'arena-lead-label', '比赛尚未开始');
    periodStrip = el('div', 'arena-period-strip');
    periodStrip.setAttribute('aria-label', '已结束各节比分');
    var tabs = el('div', 'mbc-tabs');
    var liveTab = el('button', 'mbc-tab is-active', '直播');
    liveTab.type = 'button';
    var boxTab = el('button', 'mbc-tab', '数据');
    boxTab.type = 'button';
    liveTab.onclick = function () { switchTab('live'); };
    boxTab.onclick = function () { switchTab('box'); };
    tabs.setAttribute('role','group');tabs.setAttribute('aria-label','比赛直播视图');
    tabs.append(liveTab,boxTab);
    window.MBLInteraction?.tabKeys(tabs,()=>[liveTab,boxTab]);
    sb.append(titleRow, teams, metaEl, leadBar, leadLabel, periodStrip, tabs);
    feed = el('div', 'mbc-feed');
    feedTools = el('div','arena-feedtools');
    followBtn = el('button','arena-follow','跟随直播'); followBtn.type='button';
    followBtn.onclick=function(){autoFollow=true;feed.scrollTop=feed.scrollHeight;syncFollow();};
    feedTools.append(el('span','','比赛实况'),followBtn);
    feed.addEventListener('scroll', function () {
      if(feed.hidden)return;
      autoFollow = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
      syncFollow();
    });
    boxView = el('div', 'mbc-boxview');
    boxView.hidden = true;
    for(const node of [feed,metaEl,periodStrip,leadLabel,boxView,scoreEls.home.score,scoreEls.away.score])node.dataset.mblQuietDom='';
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
    wrap.append(sb, feedTools, feed, boxView, controls);
    dialog.append(wrap);
    dialog._playBtn = playBtn; dialog._speedBtn = speedBtn; dialog._skipBtn = skipBtn;
    dialog._liveTab = liveTab; dialog._boxTab = boxTab;
    dialog._liveBadge = liveBadge;
    dialog.addEventListener('cancel', function(e){e.preventDefault();stop();});
    document.body.append(dialog);
    return dialog;
  }
  function teamBlock(side) {
    var d = el('div', 'mbc-team' + (side === 'home' ? ' is-mine' : ''));
    var logo = el('span', 'mbc-team-logo');
    var name = el('span', 'mbc-team-name');
    var sc = el('span', 'mbc-team-score', '0');
    d.append(el('span','arena-team-side',side==='home'?'HOME / 主队':'AWAY / 客队'),logo, name, sc);
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
    dialog._liveTab.setAttribute('aria-pressed',String(mode==='live'));
    dialog._boxTab.setAttribute('aria-pressed',String(mode==='box'));
    if (mode === 'box') {
      feed.hidden = true; feedTools.hidden = true; boxView.hidden = false;
      if (isLiveDone()) renderBoxScore(); else renderLiveBox();
    }
    else { boxView.hidden = true; feed.hidden = false; feedTools.hidden = false; if(autoFollow)feed.scrollTop=feed.scrollHeight; }
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
      dialog._liveTab.setAttribute('aria-pressed','true');
      dialog._boxTab.setAttribute('aria-pressed','false');
    }
    boxView.hidden = true; feed.hidden = false; feedTools.hidden = false;
  }
  function currentGame() {
    return game;
  }
  function renderBoxScore() {
    var g = currentGame();
    if(g&&finalBoxGame===g)return;
    finalBoxGame=g;
    const focused=boxView.contains(document.activeElement)?document.activeElement.dataset.boxPlayer:null;
    window.MBLInteraction.preserveScroll(boxView,function(){
      boxView.replaceChildren();
      if (!g) { boxView.append(el('div', 'mbc-box-empty', '暂无数据')); return; }
      boxView.append(el('p','arena-live-note','终场技术统计 · 完整数据'),boxSection('home', g), boxSection('away', g),window.MBLArenaMatch.comparison(compactBox(g)));
    });
    if(focused)Array.from(boxView.querySelectorAll('[data-box-player]')).find(b=>b.dataset.boxPlayer===focused)?.focus({preventScroll:true});
  }
  // 直播中：用当前事件的 box 快照渲染“打到此刻”的实时数据（得分/分钟实时算，不剧透终场）
  function renderLiveBox() {
    var g = currentGame();
    if(!g||!liveSnap)return;
    if(liveBoxGame===g){
      const [home,away]=boxView.querySelectorAll('.mbc-box-sec');
      boxSection('home',g,liveSnap,liveProg,home);
      boxSection('away',g,liveSnap,liveProg,away);
    }else{
      liveBoxGame=g;
      boxView.replaceChildren(el('p','arena-live-note',g.engine===4?'实时技术统计 · 实际出场时间':'实时技术统计 · 出场分钟为估算'),
        boxSection('home',g,liveSnap,liveProg),boxSection('away',g,liveSnap,liveProg));
    }
  }
  function td(txt, cls) {
    var c = document.createElement('td');
    if (cls) c.className = cls;
    c.textContent = txt;
    return c;
  }
  function pauseForCard() {
    var held=game, wasPlaying=playing;
    if(wasPlaying)togglePlay();
    return function(){if(wasPlaying&&held===game&&dialog.open&&!playing&&!gameOver)togglePlay();};
  }
  function nameCell(p, side, row, live) {
    var c = document.createElement('td');
    c.className = 'is-name is-link';
    var cards=window.MBLPlayerCard;
    const button=cards.button(function(){
      const {stats,minutes,points}=row._stats;
      return cards.fromMatch(p,{team:lastMu[side].name,year:lastMu.year,side:side,
        matchKey:lastMu.key,source:live?'live':'final',
        exactMinutes:game?.engine===4,reasons:live?null:stats?.reasons,stats:cards.statsFromLive(stats,minutes,points)});
    },C.hans(p.name),{onOpen:pauseForCard});
    button.dataset.boxPlayer=side+':'+p.id;
    c.append(button);
    return c;
  }
  function boxSection(side, g, snap, prog, existing) {
    var t = g[side], live = !!snap;
    var sec = existing || el('div', 'mbc-box-sec');
    var head = existing?.firstElementChild || el('div', 'mbc-box-head');
    var color = lastMu && lastMu[side] ? lastMu[side].color : null;

    const score=String(live?runScore[side]:g.score[side]);
    if(existing){const tally=head.querySelector('.mbc-box-tscore');if(tally.textContent!==score)tally.textContent=score;}
    else {const name=el('span','mbc-box-tname',C.hans(t.name));if(color)name.style.color=color;head.append(name,el('span','mbc-box-tscore',score));}
    if(!existing){if(live)head.append(el('span','mbc-box-live','实时'));sec.append(head);}

    var wrapTbl = existing?.lastElementChild || el('div', 'mbc-table-wrap');
    wrapTbl.dataset.mblScrollKey = 'broadcast:' + side;
    var table=existing?.querySelector('table')||el('table','mbc-table');
    if(!existing){
      const thead=table.createTHead(),row=thead.insertRow();
      for(const name of BOX_COLS){const cell=el('th','',name);cell.scope='col';row.append(cell);}
    }
    var tbody=existing?table.tBodies[0]:table.createTBody();
    function values(row,stats){
      for(const [i,value] of stats.entries()){
        if(!existing)row.append(td(value));
        else if(row.cells[i+1].textContent!==String(value))row.cells[i+1].textContent=value;
      }
    }
    var T = { min: 0, pts: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0, ore: 0, dre: 0, ast: 0, stl: 0, blk: 0, to: 0, pf: 0 };
    t.players.forEach(function (p,index) {
      var fb = t.box[p.id], b, dMin, dPts;
      if (live) {
        b = snap[side]?.[p.id] || {fgm:0,fga:0,tpm:0,tpa:0,ftm:0,fta:0,ore:0,dre:0,ast:0,stl:0,blk:0,to:0,pf:0};
        dMin = g.engine===4 ? (b.ticks||0)/600 : Math.min(Math.round(fb.min), Math.round(fb.min * (prog || 0)));
        dPts = (b.fgm - b.tpm) * 2 + b.tpm * 3 + b.ftm;
      } else { b = fb; dMin = Math.round(b.min); dPts = b.pts; }
      const tr=existing?tbody.rows[index]:tbody.insertRow();
      tr._stats={stats:b,minutes:dMin,points:dPts};
      if(!existing){if(p.id==='me')tr.className='is-me';tr.append(nameCell(p,side,tr,live));}
      values(tr,[g.engine===4?window.MBLMatchV4.minutes(dMin):dMin,dPts,b.fgm+'-'+b.fga,
        b.tpm+'-'+b.tpa,b.ftm+'-'+b.fta,b.ore+b.dre,b.ast,b.stl,b.blk,b.to,b.pf]);
      T.min += g.engine===4?(live?(b.ticks||0)/600:b.min):dMin; T.pts += dPts;
      T.fga += b.fga; T.fgm += b.fgm; T.tpa += b.tpa; T.tpm += b.tpm; T.fta += b.fta; T.ftm += b.ftm;
      T.ore += b.ore; T.dre += b.dre; T.ast += b.ast; T.stl += b.stl; T.blk += b.blk; T.to += b.to; T.pf += b.pf;
    });
    const trt=existing?tbody.rows[t.players.length]:tbody.insertRow();
    if(!existing){trt.className='is-total';trt.append(td('全队','is-name'));wrapTbl.append(table);sec.append(wrapTbl);}
    values(trt,[Math.round(T.min),T.pts,T.fgm+'-'+T.fga,T.tpm+'-'+T.tpa,T.ftm+'-'+T.fta,
      T.ore+T.dre,T.ast,T.stl,T.blk,T.to,T.pf]);
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
          ...(b.reasons?.length?{reasons:b.reasons}:{}),id:p.id,en: p.name && p.name.en, pos: p.pos, ovr: p.ovr,age:p.age,
          s: BOX_KEYS.map(function (k) { return b[k]; }) };
      })
    };
  }
  function compactBox(g) {
    return { home: compactTeam(g, 'home'), away: compactTeam(g, 'away') };
  }
  function playerSummary(b) {
    if (!b) return {};
    return { pts: b.pts, reb: b.ore + b.dre, ast: b.ast, stl: b.stl, blk: b.blk,
      min: b.min, fga: b.fga, fgm: b.fgm, tpa: b.tpa, tpm: b.tpm,
      fta: b.fta, ftm: b.ftm, pf: b.pf, fo: !!b.fo };
  }
  // 模拟路径用：建真实对阵并跑引擎，返回与直播同形状的 preset（含完整 box）
  function makePreset(absent, cached,source,choice) {
    var mu = buildRealMatchup(absent,undefined,source);
    if (!mu) return null;
    if(mu.model===4 && choice?.big){
      mu.context.preparation={side:mu.mySide,edge:C.clamp(Number(choice.edge)||0,-12,12),usage:C.clamp((choice.pts||0)/45,-.15,.2)};
    }
    var record = window.MBLMatchRecord.snapshot(mu, mu.seed);
    if(cached?.matchRecord?.engine===4 && JSON.stringify(record)===JSON.stringify(cached.matchRecord))return cached;
    var g = window.MBLMatchRecord.simulate(record,false);
    var mine = mu.mySide, other = mine === 'home' ? 'away' : 'home', b = g[mine].box['me'];
    return {
      gameIndex: mu.gameIndex,
      us: g.score[mine], them: g.score[other],
      absent: !b, ...playerSummary(b),
      digest:g.digest,injuries:g.injuries,box: compactBox(g), matchRecord: record, overtime: Math.max(0, g.quarters.length - 4)
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

  function stickFeed() {
    if (autoFollow && !feed.hidden) feed.scrollTop = feed.scrollHeight;
  }
  function syncFollow(){var text=autoFollow?'跟随中':'回到直播';if(followBtn&&followBtn.textContent!==text)followBtn.textContent=text;}
  function paintLead(){
    var value=window.MBLArenaMatch.lead(runScore.home,runScore.away);
    leadBar.style.setProperty('--home-share',value.share+'%');
    leadLabel.textContent=value.side==='tie'?'双方战平':(value.side==='home'?'主队':'客队')+' 领先 '+value.gap+' 分';
  }

  function renderLine(ev) {
    if (ev.qEnd) {
      var period=el('div','arena-period');
      period.append(el('span','',ev.qEnd>4?'OT'+(ev.qEnd-4):'Q'+ev.qEnd),el('b','',ev.qHome+' : '+ev.qAway));periodStrip.append(period);
      var qe = el('div', 'mbc-qend');
      qe.append(el('span', 'mbc-qe-txt', periodLabel(ev.qEnd) + '结束'),
        el('span', 'mbc-qe-score', (ev.qEnd > 4 ? '加时 ' : '本节 ') + ev.qHome + ' : ' + ev.qAway));
      feed.append(qe);
      if (!fastForward) stickFeed();
      return;
    }
    if (ev.marker) {
      var mk = el('div', 'mbc-qmarker');
      mk.append(el('span', 'mbc-qm-txt', ev.marker));
      if (ev.qHome != null) mk.append(el('span', 'mbc-qm-score', ev.qHome + ' : ' + ev.qAway));
      feed.append(mk);
      return;
    }
    const storyTag=storyTracker?MBLMatchStory.step(storyTracker,ev):"";
    runScore[ev.side] += (ev.points || 0);
    scoreEls.home.score.textContent = runScore.home;
    scoreEls.away.score.textContent = runScore.away;
    if (ev.points > 0 && !fastForward) bumpScore(ev.side);
    paintLead();
    if (ev.changes) MBLMatchV4.applyEvent(liveSnap,ev);
    else if (ev._snap) liveSnap = ev._snap;
    liveProg = progOf(ev);
    metaEl.replaceChildren();
    metaEl.append(meta2(periodLabel(ev.q)), meta2(formatClock(ev.clock)));
    var line = el('div', 'mbc-line ' + lineClass(ev));
    decorateSide(line, ev.side);
    if (isMineEvent(ev)) line.classList.add('is-mine');
    var clutch = ev.q >= 4 && (game.engine===4?ev.clock<=120&&Math.abs(runScore.home-runScore.away)<=5:Math.abs(runScore.home-runScore.away)<=8);
    if (clutch) {
      line.classList.add('is-clutch');
      if (!clutchShown) { feed.append(el('div', 'mbc-clutch-marker', '关键时刻')); clutchShown = true; }
    }
    if(storyTag)line.append(el('b','mbl-live-turn',storyTag));
    if (ev.points > 0) line.append(el('span', 'mbc-score-inline', '+' + ev.points));
    line.append(el('span', 'mbc-text', ev.text));
    if (ev.badges && ev.badges.length) {
      var bw = el('div', 'mbc-badges');
      ev.badges.forEach(function (b) { bw.append(el('span', 'mbc-chip', b.name)); });
      line.append(bw);
    }
    feed.append(line);
    if (!fastForward) stickFeed();
    if (!fastForward && tabMode === 'box' && !isLiveDone()) renderLiveBox();
  }
  function lineClass(ev) {
    if (ev.kind === 'ft') return 'is-ft';
    if (ev.kind === 'oreb' || ev.kind === 'rebound') return 'is-rebound';
    if (ev.kind === 'to' || ev.kind === 'foul') return 'is-to';
    return ev.points > 0 ? 'is-score' : '';
  }
  function meta2(t) { return el('b', '', t); }
  function formatClock(sec) {
    return window.MBLArenaMatch.clock(sec);
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
    if (gameOver) return;
    clearInterval(timer); playing = false; dialog._playBtn.textContent = '播放';
    fastForward=true;
    try { while (cursor < items.length) renderLine(items[cursor++]); } finally { fastForward=false; }
    finish();
  }
  function commitPreset() {
    if (!ctx.real) return;
    var mine = ctx.mySide, other = mine === 'home' ? 'away' : 'home';
    var b = game[mine].box['me'];
    window.__mblPreset = {
      gameIndex: ctx.gameIndex,
      us: game.score[mine], them: game.score[other],
      absent: !b, ...playerSummary(b),
      digest:game.digest,injuries:game.injuries,box: compactBox(game), matchRecord: ctx.matchRecord, overtime: Math.max(0, game.quarters.length - 4)
    };
  }
  function finish() {
    if (gameOver) return;
    clearInterval(timer); playing = false; gameOver = true;
    if (dialog) {dialog._playBtn.textContent = '已结束';dialog._playBtn.disabled=true;dialog._skipBtn.disabled=true;}
    metaEl.replaceChildren(meta2('终场'),meta2('0:00'));
    setLiveEnd();
    if(ctx.pendingSeries){const committed=playNextPlayoffGame(false,ctx.pendingSeries);ctx.seriesCommitted=!!committed;ctx.needsSave=committed?.saved===false;delete ctx.pendingSeries;}
    commitPreset();
    if (tabMode === 'box') renderBoxScore();
    if (ctx.historical) {
      feed.append(el('div', 'mbc-line is-final', '历史战报回放结束'));
    } else if (ctx.playoff) {
      feed.append(el('div', 'mbc-line is-final', '终场 ' + runScore.home + ' : ' + runScore.away + (ctx.seriesCommitted?'（已计入系列赛）':'（赛程已变化，请重新打开）')));
    } else if (ctx.real) {
      feed.append(el('div', 'mbc-line is-final', '终场 ' + runScore.home + ' : ' + runScore.away +
        '（退出后结算本场战绩）'));
    } else {
      var win = game.winner === ctx.mySide ? '（你赢了）'
        : (game.winner === 'home' || game.winner === 'away') ? '（你输了）' : '（平局）';
      feed.append(el('div', 'mbc-line is-final', '终场 ' + runScore.home + ' : ' + runScore.away + ' ' + win));
    }
    if(ctx.needsSave){
      const retry=el('button','mbc-btn','本场已结束，重试保存');retry.type='button';
      retry.onclick=function(){if(window.MBLAutoSave?.save()){ctx.needsSave=false;retry.replaceWith(el('p','mbc-line','本场已保存。'));}};
      feed.append(retry);
    }
    stickFeed();
  }
  function stop() {
    // 终场（preset 已写入）才自动结算；中途退出保持原样，不替玩家推进
    var finished = gameOver;
    var real = !!(ctx && ctx.real);
    clearInterval(timer);
    playing = false;
    if (dialog && dialog.open) dialog.close();
    var cb = closeCb; closeCb = null;
    if (cb && real && finished) { const record=ctx.matchRecord,index=ctx.gameIndex; setTimeout(function(){const now=buildRealMatchup();if(now && now.seed===record?.seed && now.gameIndex===index)cb();},0); }
  }
  function paintTeam(side, t) {
    teamEls[side].style.setProperty('--team', t.color);
    scoreEls[side].name.textContent = C.hans(t.name);
    var tm = (t.name && typeof t.name === 'object') ? t.name : { en: t.name, hans: C.hans(t.name) };
    var yr;
    try { yr = life().ball.season.year; } catch (e) { yr = new Date().getFullYear(); }
    scoreEls[side].logo.innerHTML = TBadge(tm, yr);
  }

  function present(mu, real, replay, historical) {
    if (!mu || !window.MBLMatchEngine) return;
    ensureDialog();
    paintTeam('home', mu.home); paintTeam('away', mu.away);
    teamEls.home.classList.toggle('is-mine',mu.mySide==='home');
    teamEls.away.classList.toggle('is-mine',mu.mySide==='away');
    lastMu = { home: mu.home, away: mu.away,year:mu.year,key:mu.seed??'session-'+(++matchSerial) };
    var record = real ? window.MBLMatchRecord.snapshot(mu, mu.seed) : null;
    game = replay || (record ? window.MBLMatchRecord.simulate(record) : window.MBLMatchEngine.simulate(mu.home, mu.away, { rng: Math.random, overtime: true,engine:2 }));
    ctx = { real: !!real, playoff: !!replay && !historical, historical: !!historical, mySide: mu.mySide, gameIndex: mu.gameIndex, matchRecord: record };
    dialog.querySelector('.mbc-title').textContent = historical ? '历史战报回放' : replay ? '季后赛第 ' + mu.playoffGameNo + ' 场' : '比赛直播';
    storyTracker=game.engine===4&&window.MBLMatchStory?MBLMatchStory.tracker():null;
    gameOver = false;
    // Both lineups are known before tip-off, and every visible stat starts at
    // zero. A player card can be opened before the first broadcast event.
    clutchShown = false; liveSnap = {home:{},away:{}}; liveProg = 0;
    resetLiveBadge();
    runScore = { home: 0, away: 0 };
    periodStrip.replaceChildren();paintLead();leadLabel.textContent='比赛尚未开始';
    metaEl.replaceChildren(meta2('第 1 节'),meta2('12:00'));
    dialog._playBtn.disabled=false;dialog._skipBtn.disabled=false;
    scoreEls.home.score.textContent = '0'; scoreEls.away.score.textContent = '0';
    feed.replaceChildren();
    autoFollow = true;
    syncFollow();boxView.replaceChildren();boxView.scrollTop=0;liveBoxGame=null;finalBoxGame=null;
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

  function makePlayoffGame(series, rng,source) {
    var recorder = window.MBLMatchRecord;
    var seed = recorder && rng ? Math.floor(rng() * 4294967296) : undefined;
    var mu = buildPlayoffMatchup(series, seed,source);
    if (!mu || !window.MBLMatchEngine) return null;
    var matchRecord = seed !== undefined ? recorder.snapshot(mu, seed) : null;
    var game = matchRecord ? recorder.simulate(matchRecord) : window.MBLMatchEngine.simulate(mu.home, mu.away, { rng: rng, overtime: true,engine:2 });
    return game.winner ? { mu: mu, game: game, ...(matchRecord ? { matchRecord: matchRecord, box: compactBox(game) } : {}) } : null;
  }

  function openPlayoff() {
    if (dialog && dialog.open) return;
    var replay = playNextPlayoffGame(true);
    if (replay) { closeCb = null; present(replay.mu, false, replay.game); ctx.pendingSeries=replay; }
  }

  function openHistorical(record,context) {
    if (dialog?.open) return false;
    var replay = window.MBLMatchRecord.replay(record);
    if (!replay) return false;
    closeCb = null;
    present({...replay.mu,year:replay.mu.year??context?.year}, false, replay.game, true);
    return true;
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
    openHistorical: openHistorical,
    makePlayoffGame: makePlayoffGame,
    makePreset: makePreset,
    rosterRatings:ratingsFromOvr,
    teamColor: teamColor,
    _state: function () { return { game: game, ctx: ctx, runScore: runScore }; },
    _buildReal: buildRealMatchup,
    _buildEx: buildExhibition,
    _buildPlayoff: buildPlayoffMatchup
  };
})();
