/* 王朝时刻：生涯页顶部「时代横幅」+ 王朝时间轴面板 + 重大节点弹窗。
 * 纯单机，直接操作 DOM（不经过内核 d()，无需三语对象）。
 * 年份 = Ee + age；进入对应年份自动切换时代，重大节点只弹一次。 */
(function () {
  'use strict';
  if (window.MBLDynasty) return;
  var C = window.MBLCore;
  var make = C.h;
  function life() { return C.life(); }
  function curYear() { var l = life(); return l ? window.Ee + l.age : null; }

  // ---------- 王朝时代（7 个，全定义，时间轴完整） ----------
  var ERAS = [
    { id: 'birdmagic', name: '黄绿争霸', start: 1980, end: 1990, color: '#7b3ff2',
      teams: '湖人 · 凯尔特人', desc: '魔术师与伯德双雄对决，Showtime 湖人五冠、凯尔特人三冠。' },
    { id: 'jordan', name: '乔丹公牛王朝', start: 1991, end: 1998, color: '#c8352c',
      teams: '公牛 · 火箭', desc: '两个三连冠，中间大梦火箭两连，篮球之神的时代。' },
    { id: 'oklakers', name: 'OK 湖人王朝', start: 1999, end: 2004, color: '#b5822b',
      teams: '湖人 · 马刺 · 活塞', desc: '湖人三连冠，马刺、活塞分食，OK 组合从巅峰到解体。' },
    { id: 'west', name: '西强东雄', start: 2005, end: 2010, color: '#3f6fb5',
      teams: '马刺 · 热火 · 凯尔特人 · 湖人', desc: '马刺、热火、凯尔特人三巨头、湖人两连，西部整体强势。' },
    { id: 'heatles', name: '热火三巨头', start: 2011, end: 2014, color: '#c8324a',
      teams: '热火 · 小牛 · 马刺', desc: '詹姆斯、韦德、波什四进总决赛两夺冠军。' },
    { id: 'warriors', name: '勇士王朝', start: 2015, end: 2019, color: '#2b7fd0',
      teams: '勇士 · 骑士 · 猛龙', desc: '73 胜、五进总决赛三冠，杜兰特超级战舰。' },
    { id: 'modern', name: '群雄逐鹿', start: 2020, end: 2026, color: '#4a8a5a',
      teams: '湖人 · 雄鹿 · 掘金 · 凯尔特人', desc: '多队分冠，没有绝对霸主。' },
    { id: 'forecast', name: '未来推演（自然演算）', start: 2027, end: 2040, color: '#7d8794', dynamic: true,
      teams: '由引擎逐年产生', desc: '2027 年起不再预设结果，冠军与格局由游戏引擎根据球队实力、球员年龄和随机因素逐年演算，每次开档都不同。' }
  ];

  // ---------- 关键节点（首批 1984–2000；major=true 才弹窗，其余进时间轴） ----------
  var EVENTS = [
    { year: 1984, major: true, kind: '选秀', title: '钻石一代登场', text: '1984 选秀被公认为历史最伟大一届：奥拉朱旺、乔丹、巴克利、斯托克顿同年进入联盟。' },
    { year: 1985, major: false, kind: '冠军', title: '湖人夺冠', text: '魔术师率湖人拿下 80 年代第二冠。' },
    { year: 1986, major: true, kind: '冠军', title: '凯尔特人登顶', text: '伯德领衔的凯尔特人 16 冠，季后赛统治力惊人。' },
    { year: 1987, major: false, kind: '冠军', title: '湖人再夺冠军', text: 'Showtime 湖人重回巅峰，魔术师拿下 FMVP。' },
    { year: 1988, major: false, kind: '冠军', title: '湖人卫冕', text: '湖人连庄，80 年代五冠的王朝底蕴。' },
    { year: 1989, major: true, kind: '冠军', title: '坏孩子封王', text: '活塞“坏孩子军团”用强硬防守击败湖人，开启两连冠。' },
    { year: 1990, major: false, kind: '冠军', title: '活塞卫冕', text: '活塞再夺一冠，微笑刺客托马斯领衔。' },
    { year: 1991, major: true, kind: '冠军', title: '乔丹首冠', text: '公牛击败湖人，乔丹哭着捧起第一座奖杯，公牛王朝开启。' },
    { year: 1992, major: false, kind: '冠军', title: '公牛卫冕 · 梦一队', text: '公牛连庄；夏天梦一队横扫巴塞罗那，乔丹、魔术师、伯德同框。' },
    { year: 1993, major: true, kind: '冠军', title: '三连冠与退役', text: '公牛完成三连冠；赛季后乔丹因父亲遇害宣布退役，震惊世界。' },
    { year: 1994, major: true, kind: '冠军', title: '大梦夺冠', text: '奥拉朱旺率火箭登顶，在乔丹缺席的一年拿下冠军。' },
    { year: 1995, major: true, kind: '复出', title: '“I’m back”', text: '乔丹一句“I’m back”回归；火箭在大梦带领下完成两连冠。' },
    { year: 1996, major: true, kind: '冠军', title: '72 胜与黄金一代', text: '公牛打出 72 胜 10 负并夺冠；选秀迎来科比、艾弗森、纳什等黄金一代。' },
    { year: 1997, major: false, kind: '冠军', title: '公牛再冠', text: '乔丹流感之战成为经典，公牛第五冠。' },
    { year: 1998, major: true, kind: '冠军', title: '最后一投', text: '乔丹总决赛最后一投绝杀爵士，第二个三连冠，随后再次退役，公牛王朝落幕。' },
    { year: 1999, major: true, kind: '冠军', title: '马刺首冠', text: '停摆赛季，邓肯率马刺拿下首冠，公牛解体，联盟换天。' },
    { year: 2000, major: true, kind: '冠军', title: 'OK 组合首冠', text: '奥尼尔与科比的湖人登顶，三连冠王朝拉开序幕。' },

    // 2001–2020 节点
    { year: 2001, major: false, kind: '冠军', title: '湖人卫冕', text: '湖人季后赛 15 胜 1 负，几乎以统治之姿连庄。' },
    { year: 2002, major: true, kind: '冠军', title: '湖人三连冠', text: 'OK 组合完成三连冠，湖人王朝达到鼎盛。' },
    { year: 2003, major: true, kind: '选秀', title: '白金一代与乔丹退役', text: '詹姆斯、韦德、安东尼、波什登场；乔丹第三次也是最后一次退役，时代交接。' },
    { year: 2004, major: true, kind: '冠军', title: '活塞草根与 OK 解体', text: '活塞五虎击败湖人 F4 夺冠；夏天奥尼尔被交易到热火，OK 时代终结。' },
    { year: 2005, major: false, kind: '冠军', title: '马刺再夺冠', text: '邓肯与吉诺比利、帕克的马刺拿下第三冠。' },
    { year: 2006, major: true, kind: '冠军', title: '韦德首冠', text: '热火 0 比 2 逆转小牛，韦德封神拿下 FMVP。' },
    { year: 2007, major: true, kind: '交易', title: '凯尔特人组三巨头', text: '凯尔特人交易来加内特、雷·阿伦，与皮尔斯组三巨头；马刺当年再夺冠。' },
    { year: 2008, major: true, kind: '冠军', title: '凯尔特人第 17 冠', text: '三巨头首季即夺冠；湖人在季中交易来加索尔，黄绿恩怨重启。' },
    { year: 2009, major: false, kind: '冠军', title: '湖人重回巅峰', text: '科比带队击败魔术，湖人再夺冠军。' },
    { year: 2010, major: true, kind: '决定', title: '詹姆斯 Decision', text: '詹姆斯电视直播宣布加盟热火，三巨头成军；湖人完成两连冠。' },
    { year: 2011, major: true, kind: '冠军', title: '小牛黑马封王', text: '诺维茨基率小牛击败热火，单核带队夺冠。' },
    { year: 2012, major: true, kind: '冠军', title: '热火首冠', text: '詹姆斯首夺冠军，热火三巨头兑现，夏天再拿奥运金牌。' },
    { year: 2013, major: false, kind: '冠军', title: '热火卫冕', text: '热火 27 连胜，雷·阿伦 G6 绝平，惊险两连冠。' },
    { year: 2014, major: true, kind: '冠军', title: '马刺复仇与詹姆斯回骑士', text: '马刺团队篮球复仇夺冠；夏天詹姆斯宣布回归克利夫兰。' },
    { year: 2015, major: true, kind: '冠军', title: '勇士首冠', text: '库里率勇士用小球打法夺冠，新时代正式开启。' },
    { year: 2016, major: true, kind: '冠军', title: '骑士 1-3 逆转', text: '勇士常规赛 73 胜，总决赛却被骑士 1 比 3 逆转，詹姆斯为家乡夺冠。' },
    { year: 2017, major: true, kind: '冠军', title: '杜兰特加盟勇士', text: '杜兰特加入组成超级战舰，勇士轻松夺冠。' },
    { year: 2018, major: true, kind: '决定', title: '詹姆斯转投湖人', text: '勇士再夺冠；夏天詹姆斯加盟洛杉矶湖人。' },
    { year: 2019, major: true, kind: '冠军', title: '猛龙首冠与王朝落幕', text: '伦纳德带猛龙首冠；杜兰特、欧文相约篮网，勇士王朝落幕。' },
    { year: 2020, major: true, kind: '冠军', title: '湖人园区夺冠', text: '疫情园区赛季，詹姆斯与戴维斯率湖人夺冠，也是科比离世之年的告慰。' },

    // 2021–2026 真实事件
    { year: 2021, major: true, kind: '冠军', title: '雄鹿字母哥封王', text: '雄鹿 4 比 2 击败太阳，字母哥 G6 砍下 50 分，拿下 FMVP；篮网三巨头因伤止步。' },
    { year: 2022, major: true, kind: '冠军', title: '勇士重回巅峰', text: '勇士 4 比 2 击败凯尔特人，库里首次当选 FMVP。' },
    { year: 2023, major: true, kind: '冠军', title: '掘金首冠', text: '约基奇率掘金 4 比 1 击败黑八热火，拿下队史首冠；选秀文班亚马当选状元。' },
    { year: 2024, major: true, kind: '冠军', title: '凯尔特人夺冠', text: '凯尔特人 4 比 1 击败东契奇的独行侠，杰伦·布朗拿下 FMVP。' },
    { year: 2025, major: true, kind: '交易', title: '雷霆首冠与东契奇交易', text: '季中湖人交易得到东契奇；总决赛雷霆 4 比 3 险胜步行者，SGA 当选 FMVP，哈利伯顿 G7 跟腱受伤。' },
    { year: 2026, major: true, kind: '冠军', title: '尼克斯 53 年圆梦', text: '尼克斯 4 比 1 击败文班亚马的马刺，布伦森 G5 轰 45 分，时隔 53 年夺冠并当选 FMVP。' }
    // 2027 年起不再写死：冠军由游戏引擎逐年自然演算，读取 season.champion 动态呈现
  ];

  function eraFor(y) {
    for (var i = 0; i < ERAS.length; i++) if (y >= ERAS[i].start && y <= ERAS[i].end) return ERAS[i];
    return y < ERAS[0].start ? ERAS[0] : ERAS[ERAS.length - 1];
  }
  function eventsFor(era) { return EVENTS.filter(function (e) { return e.year >= era.start && e.year <= era.end; }); }

  // ---------- 动态区：按年记录引擎实际演算出来的冠军 ----------
  function champMap(l) {
    if (!l.flags.__dynastyChamp || typeof l.flags.__dynastyChamp !== 'object' || Array.isArray(l.flags.__dynastyChamp)) {
      l.flags.__dynastyChamp = {};
    }
    return l.flags.__dynastyChamp;
  }
  // 赛季 done 时，把当季冠军球队按年存下（只存一次）
  function captureChampion() {
    var l = life();
    if (!l || !l.flags || !l.ball || !l.ball.season) return;
    var s = l.ball.season;
    if (s.phase !== 'done' || !s.champion) return;
    var m = champMap(l);
    if (!m[s.year]) {
      var won = s.team && s.champion.en === s.team.en;
      m[s.year] = {
        en: s.champion.en,
        hans: s.champion.hans || s.champion.en,
        hant: s.champion.hant || s.champion.en,
        leagueId: s.leagueId,
        won: !!won
      };
    }
    maybeChampPopup(s.year);
  }

  // 赛季结束后，根据玩家是否在 NBA 夺冠决定弹“历史已改变”还是真实历史
  function maybeChampPopup(y) {
    var l = life();
    if (!l || !inNba(l) || y > 2026) return;
    if (document.querySelector('dialog[open]')) return; // 有别的弹窗，下个 tick 重试
    var seen = seenArr(l);
    if (seen.indexOf(y) >= 0) return;
    var alt = alteredYears(l);
    seen.push(y);
    if (alt[y]) {
      popYear.textContent = y + ' 年 · 历史已改变';
      popTitle.textContent = '你改写了历史';
      popText.textContent = '真实历史上，这一年的冠军本是' + (REAL_CHAMP[y] || '另一支球队')
        + '；而你带队夺冠，属于你的时间线就此分叉。';
      popInner.style.setProperty('--era-color', '#c79a3a');
    } else {
      var ev = EVENTS.find(function (e) { return e.year === y && e.major && !e.forecast; });
      if (!ev) return;
      popYear.textContent = y + ' 年 · 历史时刻';
      popTitle.textContent = ev.title;
      popText.textContent = ev.text;
      popInner.style.setProperty('--era-color', eraFor(y).color);
    }
    pop.showModal();
  }

  // 真实 NBA 冠军对照（1984–2026），玩家在 NBA 夺冠时用于说明“历史本是哪队”
  var REAL_CHAMP = {
    1984: '凯尔特人', 1985: '湖人', 1986: '凯尔特人', 1987: '湖人', 1988: '湖人',
    1989: '活塞', 1990: '活塞', 1991: '公牛', 1992: '公牛', 1993: '公牛',
    1994: '火箭', 1995: '火箭', 1996: '公牛', 1997: '公牛', 1998: '公牛',
    1999: '马刺', 2000: '湖人', 2001: '湖人', 2002: '湖人', 2003: '马刺',
    2004: '活塞', 2005: '马刺', 2006: '热火', 2007: '马刺', 2008: '凯尔特人',
    2009: '湖人', 2010: '湖人', 2011: '小牛', 2012: '热火', 2013: '热火',
    2014: '马刺', 2015: '勇士', 2016: '骑士', 2017: '勇士', 2018: '勇士',
    2019: '猛龙', 2020: '湖人', 2021: '雄鹿', 2022: '勇士', 2023: '掘金',
    2024: '凯尔特人', 2025: '雷霆', 2026: '尼克斯'
  };
  // 玩家在真实历史区 NBA 夺冠、改变历史的年份集合
  function alteredYears(l) {
    var cm = l && l.flags ? l.flags.__dynastyChamp : null;
    if (!cm) return {};
    var out = {};
    Object.keys(cm).forEach(function (y) {
      var yn = Number(y);
      if (yn <= 2026 && cm[y].leagueId === 'NBA' && cm[y].won) out[yn] = cm[y];
    });
    return out;
  }
  function inNba(l) {
    var p = l && l.ball ? l.ball.pro : null;
    return !!(p && p.leagueId === 'NBA');
  }

  // ---------- 顶部时代横幅 ----------
  var banner = make('button', 'mbl-era-banner');
  banner.type = 'button';
  var bDot = make('span', 'mbl-era-dot');
  var bMain = make('span', 'mbl-era-main');
  var bName = make('b', 'mbl-era-name');
  var bMeta = make('small', 'mbl-era-meta');
  var bArrow = make('span', 'mbl-era-arrow', '时间轴 ›');
  bMain.append(bName, bMeta);
  banner.append(bDot, bMain, bArrow);
  banner.onclick = function () { openTimeline(); };

  function renderBanner() {
    var y = curYear();
    if (y == null) return;
    var era = eraFor(y);
    bName.textContent = era.name;
    bMeta.textContent = y + ' 年 · ' + era.teams;
    bDot.style.background = era.color;
    banner.style.setProperty('--era-color', era.color);
  }

  // ---------- 王朝时间轴面板 ----------
  var tl = make('dialog', 'mbl-era-tl');
  var tlHead = make('div', 'mbl-era-tl-head');
  tlHead.append(make('h2', '', '王朝时间轴'));
  var tlClose = make('button', 'mbl-era-tl-close', '关闭'); tlClose.type = 'button';
  tlHead.append(tlClose);
  var tlBody = make('div', 'mbl-era-tl-body');
  tl.append(tlHead, tlBody);
  tlClose.onclick = function () { if (tl.open) tl.close(); };
  // 点遮罩空白处也能关闭（手机端没有 ESC 键）
  tl.addEventListener('click', function (e) { if (e.target === tl && tl.open) tl.close(); });

  // 下滑关闭：从头部（touch-action:none，触摸手势不被浏览器接管）、或正文已滚到顶部时
  // 向下拖拽超过阈值即关闭。正文内部触摸滚动走原生 pan-y；鼠标拖拽不受影响。
  var drag = null;
  tl.addEventListener('pointerdown', function (e) {
    if (!tl.open) return;
    var inHead = !!e.target.closest('.mbl-era-tl-head');
    var atTop = tlBody.scrollTop <= 0;
    if (!inHead && !atTop) return;
    drag = { x: e.clientX, y: e.clientY, dy: 0, startTop: atTop, moved: false };
  });
  tl.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dy = e.clientY - drag.y, dx = e.clientX - drag.x;
    if (!drag.moved) {
      // 纵向为主、向下，且正文在顶部（或起点在头部）才接管
      if (dy <= 6 || Math.abs(dy) < Math.abs(dx)) return;
      if (!drag.startTop && !e.target.closest('.mbl-era-tl-head')) return;
      drag.moved = true;
    }
    drag.dy = dy;
    tl.style.transform = 'translateY(' + Math.max(0, dy) + 'px)';
  });
  function endDrag() {
    if (!drag) return;
    var d = drag; drag = null;
    tl.style.transform = '';
    if (d.moved && d.dy > 80 && tl.open) tl.close();
  }
  tl.addEventListener('pointerup', endDrag);
  tl.addEventListener('pointercancel', endDrag);

  function renderTimeline() {
    var y = curYear();
    tlBody.replaceChildren();
    var altered = alteredYears(life());
    ERAS.forEach(function (era) {
      var isCur = era === eraFor(y);
      var block = make('section', 'mbl-era-block' + (isCur ? ' is-current' : ''));
      var head = make('div', 'mbl-era-block-head');
      var dot = make('span', 'mbl-era-block-dot'); dot.style.background = era.color;
      var titles = make('div', 'mbl-era-block-titles');
      var nm = make('b', '', era.name);
      var rng = make('small', '', era.start + '–' + era.end + ' · ' + era.teams);
      titles.append(nm, rng);
      head.append(dot, titles);
      var d = make('p', 'mbl-era-block-desc', era.desc);
      block.append(head, d);

      // ① 真实历史事件；被玩家改变的年份隐藏对应真实事件，避免矛盾
      eventsFor(era).forEach(function (ev) {
        if (altered[ev.year]) return;
        var cls = 'mbl-era-ev' + (ev.major ? ' is-major' : '') + (ev.year <= y ? ' is-past' : '');
        var row = make('div', cls);
        var mid = make('div', 'mbl-era-ev-mid');
        mid.append(make('b', '', ev.title), make('small', '', ev.text));
        row.append(make('span', 'mbl-era-ev-year', ev.year + ''), mid,
          make('span', 'mbl-era-ev-kind', ev.kind + (ev.major ? ' · 重大' : '')));
        block.append(row);
      });
      // ② 我的自然演算：该时代范围内已实际产生的冠军
      var dl = life();
      var cm = dl ? champMap(dl) : {};
      Object.keys(cm).map(Number).filter(function (yr) {
        return yr >= era.start && yr <= era.end;
      }).sort(function (a, b) { return a - b; }).forEach(function (yr) {
        var ch = cm[yr];
        var isAltered = !!altered[yr];
        var cls = 'mbl-era-ev ' + (isAltered ? 'is-altered' : 'is-forecast' + (ch.won ? ' is-won' : ''))
          + (yr <= y ? ' is-past' : '');
        var row = make('div', cls);
        var fmid = make('div', 'mbl-era-ev-mid');
        if (isAltered) {
          fmid.append(make('b', '', ch.hans + '（你改变了历史）'),
            make('small', '', '真实历史本是' + (REAL_CHAMP[yr] || '另一支球队') + '，你带队改写了结局。'));
          row.append(make('span', 'mbl-era-ev-year', yr + ''), fmid,
            make('span', 'mbl-era-ev-kind', '历史已改变'));
        } else {
          fmid.append(make('b', '', ch.hans + (ch.won ? '（你随队夺冠）' : '')),
            make('small', '', ch.won ? '这一年你和球队一起站上了最高领奖台。' : ('当季冠军：' + ch.en)));
          row.append(make('span', 'mbl-era-ev-year', yr + ''), fmid,
            make('span', 'mbl-era-ev-kind', ch.won ? '你夺冠' : '推演'));
        }
        block.append(row);
      });
      tlBody.append(block);
    });
  }
  function openTimeline() { renderTimeline(); if (!tl.open) tl.showModal(); }

  // ---------- 重大节点弹窗 ----------
  var pop = make('dialog', 'mbl-era-pop');
  var popInner = make('div', 'mbl-era-pop-card');
  var popYear = make('div', 'mbl-era-pop-year');
  var popTitle = make('h3', 'mbl-era-pop-title');
  var popText = make('p', 'mbl-era-pop-text');
  var popOk = make('button', 'mbl-era-pop-ok', '知道了'); popOk.type = 'button';
  popInner.append(popYear, popTitle, popText, popOk);
  pop.append(popInner);
  popOk.onclick = function () { if (pop.open) pop.close(); };

  function seenArr(l) {
    if (!Array.isArray(l.flags.__dynastySeen)) l.flags.__dynastySeen = [];
    return l.flags.__dynastySeen;
  }
  // 待弹的重大历史年份：快速自动模拟会在帧间连续推进，不能只靠一次"撞"当前年份
  var yearQueue = [];
  var lastYear = null;
  function isMajorYear(y) {
    return EVENTS.some(function (e) { return e.year === y && e.major && !e.forecast; });
  }
  // 把经过年份里、尚未见过的重大节点补入队列（兼容帧间一次跳多年）
  function enqueueYears(l, from, to) {
    var seen = seenArr(l);
    for (var y = from + 1; y <= to; y++) {
      if (inNba(l)) break; // 进联盟后的历史改由赛季结束流程处理
      if (seen.indexOf(y) < 0 && yearQueue.indexOf(y) < 0 && isMajorYear(y)) yearQueue.push(y);
    }
  }
  // 真正打开某年份的历史时刻弹窗
  function openYearPopup(y) {
    var ev = EVENTS.find(function (e) { return e.year === y && e.major && !e.forecast; });
    if (!ev) return;
    seenArr(life()).push(y);
    var era = eraFor(y);
    popYear.textContent = y + ' 年 · 历史时刻';
    popTitle.textContent = ev.title;
    popText.textContent = ev.text;
    popInner.style.setProperty('--era-color', era.color);
    pop.showModal();
  }
  // 手动模式：每次渲染后尝试弹队首；有别的模态时暂缓，已进联盟则清空
  function pumpYears(l) {
    if (!yearQueue.length) return;
    if (inNba(l)) { yearQueue.length = 0; return; }
    if (document.querySelector('dialog[open]')) return;
    openYearPopup(yearQueue.shift());
  }
  // 自动模拟串行接管：补全当前年份，按本次暂停口径决定弹窗或直接标记，避免与渲染回调竞争
  function takeAuto(l, willPause) {
    var y = curYear();
    if (y == null) return null;
    if (y !== lastYear) {
      if (lastYear != null) enqueueYears(l, lastYear, y);
      lastYear = y;
    }
    if (inNba(l)) { yearQueue.length = 0; return null; }
    if (!yearQueue.length) return null;
    var yr = yearQueue.shift();
    if (willPause) { openYearPopup(yr); return 'era'; }
    seenArr(l).push(yr); // 不暂停：等同自动点掉，不弹窗
    return 'consumed';
  }
  // 自动模拟结束时收口：补全到当前年份；不暂停口径把剩余节点全部标记（不弹窗），暂停口径保留
  function drainAuto(l, willPause) {
    var y = curYear();
    if (y != null && y !== lastYear) {
      if (lastYear != null) enqueueYears(l, lastYear, y);
      lastYear = y;
    }
    if (willPause) return;
    if (inNba(l)) { yearQueue.length = 0; return; }
    var seen = seenArr(l);
    while (yearQueue.length) seen.push(yearQueue.shift());
    if (pop.open) pop.close();
  }

  // ---------- 年份变化检测（挂在每次 DOM 渲染后，避免慢心跳错过快速推进的年份） ----------
  function tick() {
    var y = curYear();
    if (y == null) return;
    var l = life();
    captureChampion();
    if (y !== lastYear) {
      if (lastYear != null && l) enqueueYears(l, lastYear, y);
      renderBanner();
      lastYear = y;
    }
    // 自动模拟期间由 autoPlay 的 takeAuto 串行决策，这里不主动弹窗
    if (l && !window.__mblAutoSim) pumpYears(l);
  }

  // ---------- 挂载 ----------
  function mount() {
    if (!document.body.contains(banner)) document.body.append(banner);
    if (!document.body.contains(tl)) document.body.append(tl);
    if (!document.body.contains(pop)) document.body.append(pop);
    document.body.classList.add('mbl-has-era');
  }
  // 统一 DOM 调度负责挂载与年份检测：每次渲染后检查，快速自动模拟也不会漏过历史时刻
  C.onDom(mount, 'play');
  C.onDom(tick, 'play');
  mount();

  window.MBLDynasty = {
    openTimeline: openTimeline, eras: ERAS, events: EVENTS, eraFor: eraFor,
    takeAuto: takeAuto, drainAuto: drainAuto
  };
})();
