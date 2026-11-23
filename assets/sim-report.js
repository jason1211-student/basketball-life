/* 模拟报告（单机复刻扩展）：全自动模拟结束后弹出的阶段报告。
 * 收集区间年龄/年份、总评与潜力、选秀顺位、身体档案（位置/身高/臂展/惯用手）、
 * 最强三项、最近赛季场均、荣誉与冠军统计、重要节点，用 dialog 小窗展示。
 * 风格对齐 confirm-dialog；纯本地、不联网，所有字段均取自内核真实数据，不臆造。 */
(function () {
  'use strict';
  if (window.MBLSimReport) return;
  var C = window.MBLCore;
  var T = window.MBLDraftTemplate;
  var SKILLS = T.SKILLS;
  var ATTR_CN = C.ATTR_CN;
  var el = C.h;
  function avg(obj) { return C.avg(obj, SKILLS, true); }
  var teamName = C.teamName;
  var hans = C.hans;

  // 位置代号 / 惯用手 → 中文（代号来自内核位置函数 Bu）
  var POS_CN = { pg: '控球后卫', sg: '得分后卫', sf: '小前锋', pf: '大前锋', c: '中锋' };
  var HAND_CN = { left: '左手', right: '右手' };

  // 安全调用内核位置函数，失败返回空串
  function positionOf(ball) {
    try {
      if (typeof Bu === 'function') return POS_CN[Bu(ball)] || '';
    } catch (e) { /* ignore */ }
    return '';
  }

  function buildReport(startAge) {
    var life = de.life, ball = life.ball;
    var r = {
      startAge: startAge,
      endAge: life.age,
      year: (typeof Gr === 'function') ? Gr(life) : life.age,
      ovr: avg(ball.skills),
      pot: avg(ball.potential),
      pick: life.flags.draftPick || 0,
      pro: !!ball.pro,
      kind: ball.pro ? ball.pro.kind : '',
      position: positionOf(ball),
      height: ball.adultHeight || ball.height || 0,
      wingspan: ball.wingspan || 0,
      hand: HAND_CN[ball.mblHandedness] || '',
      top: [],
      seasons: [],
      championCount: 0,
      awards: [],
      milestones: []
    };

    // 最强三项
    r.top = SKILLS.slice().sort(function (a, b) { return ball.skills[b] - ball.skills[a]; })
      .slice(0, 3)
      .map(function (k) { return { name: ATTR_CN[k], val: Math.round(ball.skills[k]) }; });

    // 最近赛季（最多 3 个，最新在前）：场均数据 + 战绩 + 夺冠
    var seasons = ball.seasons || [];
    r.championCount = seasons.filter(function (s) { return s.champion === true; }).length;
    r.seasons = seasons.slice(-3).reverse().map(function (s) {
      return {
        year: s.year,
        team: teamName(s.team),
        ppg: s.ppg, rpg: s.rpg, apg: s.apg, mpg: s.mpg,
        w: s.w, l: s.l, champion: !!s.champion
      };
    });

    // 荣誉：取本地化 text（兼容 string / {hans,hant,en}），带年份，最多 8 条，最新在前
    r.awards = (ball.awards || []).slice(-8).reverse().map(function (a) {
      var text = hans(a.text);
      return text ? { year: a.year, text: text } : null;
    }).filter(Boolean);

    // 重要节点：取区间内 milestone log（最多 8 条，最新在前）
    var ms = (life.log || []).filter(function (x) {
      return x.kind === 'milestone' && x.age >= startAge;
    });
    r.milestones = ms.slice(-8).reverse().map(function (x) {
      var line = (typeof Sa === 'function' && x.text) ? Sa(x.text, x.params)
        : (x.text && (x.text.hans || x.text.en)) || '';
      return line;
    }).filter(Boolean);

    return r;
  }

  var dialog = el('dialog', 'mbl-sim-report');
  var head = el('div', 'msr-head');
  var title = el('h2', '', '模拟报告');
  var close = el('button', 'msr-close', '关闭');
  close.type = 'button';
  head.append(title, close);
  var body = el('div', 'msr-body');
  dialog.append(head, body);
  document.body.append(dialog);

  function stat(num, label) {
    var c = el('div', 'msr-stat');
    c.append(el('b', 'msr-num', String(num)), el('span', 'msr-label', label));
    return c;
  }

  // 身体档案一行：标签 + 值
  function profileItem(label, value) {
    if (!value && value !== 0) return null;
    var c = el('div', 'msr-pf-item');
    c.append(el('span', 'msr-pf-label', label), el('b', 'msr-pf-val', String(value)));
    return c;
  }

  function render(rp) {
    body.replaceChildren();

    body.append(el('p', 'msr-range', rp.startAge + ' 岁 → ' + rp.endAge + ' 岁（' + rp.year + ' 年）'));

    var stats = el('div', 'msr-stats');
    stats.append(stat(rp.ovr, '总评'), stat(rp.pot, '潜力'));
    if (rp.pro) stats.append(stat(rp.pick || '落', '顺位'));
    body.append(stats);

    // 身体档案
    var pf = el('div', 'msr-profile');
    [profileItem('位置', rp.position),
      profileItem('身高', rp.height ? rp.height + 'cm' : ''),
      profileItem('臂展', rp.wingspan ? rp.wingspan + 'cm' : ''),
      profileItem('惯用手', rp.hand)
    ].forEach(function (it) { if (it) pf.append(it); });
    if (pf.children.length) body.append(pf);

    if (rp.top.length) {
      body.append(el('h3', 'msr-sub', '最强能力'));
      var tg = el('div', 'msr-tops');
      rp.top.forEach(function (t) {
        var c = el('div', 'msr-top');
        c.append(el('b', '', String(t.val)), el('span', '', t.name));
        tg.append(c);
      });
      body.append(tg);
    }

    // 最近赛季场均
    if (rp.seasons.length) {
      body.append(el('h3', 'msr-sub', '最近赛季'));
      var sg = el('div', 'msr-seasons');
      rp.seasons.forEach(function (s) {
        var c = el('div', 'msr-season');
        var headLine = el('p', 'msr-season-head',
          s.year + ' · ' + (s.team || '—') + (s.champion ? '（夺冠）' : ''));
        var statLine = el('p', 'msr-season-stat',
          '场均 ' + s.ppg + ' 分 ' + s.rpg + ' 板 ' + s.apg + ' 助' +
          (s.mpg ? ' · ' + s.mpg + ' 分钟' : ''));
        var recLine = el('p', 'msr-season-rec', '球队 ' + s.w + ' 胜 ' + s.l + ' 负');
        c.append(headLine, statLine, recLine);
        sg.append(c);
      });
      body.append(sg);
    }

    if (rp.awards.length) {
      var awardHead = el('h3', 'msr-sub', '近期荣誉' + (rp.championCount ? '（共 ' + rp.championCount + ' 次夺冠）' : ''));
      body.append(awardHead);
      var ul = el('ul', 'msr-list');
      rp.awards.forEach(function (a) {
        ul.append(el('li', '', a.year + ' · ' + a.text));
      });
      body.append(ul);
    }

    if (rp.milestones.length) {
      body.append(el('h3', 'msr-sub', '重要节点'));
      var ul2 = el('ul', 'msr-list');
      rp.milestones.forEach(function (m) { ul2.append(el('li', '', m)); });
      body.append(ul2);
    }
  }

  function open(startAge) {
    render(buildReport(startAge));
    if (!dialog.open) dialog.showModal();
  }
  close.onclick = function () { dialog.close(); };

  window.MBLSimReport = { open: open, buildReport: buildReport };
})();
