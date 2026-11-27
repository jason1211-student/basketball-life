/* match-engine：纯逻辑比赛引擎（分层桶 + 情境徽章 + 相对百分比）。
 * 不直接改 DOM；输入双方阵容（每名球员含 17 项 ratings、pos、name），输出：
 *   events  广播事件流（节次/时钟/情境/结果/触发徽章/播报文案）
 *   box     双方每名球员技术统计；score 比分与节次比分、胜方
 * 徽章只在对应情境（底角/超远/对抗/转换/关键球等）生效，效果为相对百分比
 * （铜/银/金/名人堂 = 1/2/3/4 档），不再做全局 +8。同一 rng 可完全复现。 */
(function () {
  'use strict';
  if (window.MBLMatchEngine) return;
  var S = window.MBLAttrSys;
  var KEYS = S ? S.KEYS : [];
  function num(v, d) { var n = Number(v); return Number.isFinite(n) ? n : (d == null ? 0 : d); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function pname(p) {
    var n = p && p.name;
    if (!n) return '球员';
    if (typeof n === 'string') return n;
    return n.hans || n.hant || n.en || '球员';
  }
  function sideName(t) {
    if (!t) return '主队';
    if (typeof t === 'string') return t;
    return t.hans || t.hant || t.en || '球队';
  }
  function rat(p, k) { return num(p.ratings ? p.ratings[k] : p[k]); }
  function pid(p) { return p.id || pname(p); }

  var POWER = { bronze: 1, silver: 2, gold: 3, hof: 4 };
  var STEP = 0.03; // 铜 +3%、银 +6%、金 +9%、名人堂 +12%

  function badgeName(id) {
    if (!S) return id;
    for (var i = 0; i < S.BADGES.length; i++) if (S.BADGES[i].id === id) return S.BADGES[i].name;
    return id;
  }
  function tier(p, badgeId) {
    // 球员带真实徽章 map：以 map 为准（map 里没有就是预算未分配，不再反推）
    if (p.badges) {
      return Object.prototype.hasOwnProperty.call(p.badges, badgeId) ? p.badges[badgeId] : null;
    }
    if (!S) return null;
    var b = null;
    for (var i = 0; i < S.BADGES.length; i++) if (S.BADGES[i].id === badgeId) { b = S.BADGES[i]; break; }
    if (!b) return null;
    var v = Infinity;
    b.attrs.forEach(function (k) { v = Math.min(v, rat(p, k)); });
    var th = b.thresholds || S.TIERS;
    for (var j = 0; j < S.TIER_ORDER.length; j++) {
      var t = S.TIER_ORDER[j];
      if (v >= th[t]) return t;
    }
    return null;
  }
  function boost(p, id) { var t = tier(p, id); return t ? STEP * POWER[t] : 0; }
  function fire(p, id) { var v = boost(p, id); return v ? { id: id, name: badgeName(id), by: pname(p) } : null; }

  // ===== 轮换：按总评给分钟权重并归一化，分钟总和=240 =====
  function buildRotation(players) {
    var list = players.map(function (p) {
      var ov = num(p.ovr);
      if (!ov) { var s = 0; KEYS.forEach(function (k) { s += rat(p, k); }); ov = KEYS.length ? s / KEYS.length : 70; }
      return { p: p, ov: ov, w: Math.max(.08, Math.pow(ov / 60, 2.2)) };
    });
    if(!players.some(p=>p.id==='me' && typeof p.rotation?.starter==='boolean'))list.sort(function (a, b) { return b.ov - a.ov; });
    list.slice(5).forEach(function (x) { x.w *= .5; });
    var sum = list.reduce(function (s, x) { return s + x.w; }, 0);
    list.forEach(function (x, i) { x.w = x.w / sum; x.min = r1(clamp(x.w * 240, 1, 42)); });
    const designated=list.find(x=>x.p.id==='me' && Number.isFinite(x.p.rotation?.minutes));
    if(designated && list.length>=6){
      designated.min=clamp(designated.p.rotation.minutes,1,42);
      let remaining=240-designated.min;
      let others=list.filter(x=>x!==designated);
      while(others.length){
        const weights=others.reduce((a,x)=>a+x.w,0);
        const capped=others.filter(x=>remaining*x.w/weights>48);
        if(!capped.length){others.forEach(x=>{x.min=remaining*x.w/weights;});break;}
        capped.forEach(x=>{x.min=48;remaining-=48;});
        others=others.filter(x=>!capped.includes(x));
      }
      for(const x of list)x.w=x.min/240;
    }
    return list;
  }
  function possessionWeights(rotation) {
    if(!rotation.some(x=>x.p.rotation))return rotation;
    const scaled=rotation.map(x=>({...x,w:x.w*clamp(num(x.p.rotation?.usage,1),.5,1.5)}));
    const total=scaled.reduce((sum,x)=>sum+x.w,0);
    return scaled.map(x=>({...x,w:x.w/total}));
  }
  function pick(rot, rng) {
    var r = rng(), acc = 0;
    for (var i = 0; i < rot.length; i++) { acc += rot[i].w; if (r <= acc) return rot[i].p; }
    return rot[rot.length - 1].p;
  }
  // 偏向同位置的防守者
  function pickDefender(rot, pos, rng) {
    if (rng() < .6) {
      var same = rot.filter(function (x) { return x.p.pos === pos; });
      if (same.length) return pick(same, rng);
    }
    return pick(rot, rng);
  }

  // ===== 出手构成（频率）=====
  var MIX_BASE = {
    guard: { mid: .12, three: .53 }, wing: { mid: .14, three: .49 }, big: { mid: .12, three: .27 }
  };
  function shotMix(p) {
    var b = MIX_BASE[p.pos] || MIX_BASE.wing;
    var m = {
      mid: clamp(b.mid + (rat(p, 'mid') - 75) * .004, .03, .5),
      three: clamp(b.three + (rat(p, 'three') - 75) * .006 + boost(p, 'limitless') * .5, .02, .6)
    };
    m.rim = clamp(1 - m.mid - m.three + boost(p, 'firststep') * .4, .05, .9);
    var sum = m.rim + m.mid + m.three;
    Object.keys(m).forEach(function (z) { m[z] = m[z] / sum; });
    return m;
  }
  function pickZone(mix, rng) {
    var r = rng(), acc = 0, order = ['rim', 'mid', 'three'];
    for (var i = 0; i < order.length; i++) { acc += mix[order[i]]; if (r <= acc) return order[i]; }
    return 'rim';
  }

  // 空位基础命中率
  function openRate(p, zone) {
    if (zone === 'rim') {
      var fin = rat(p, 'layup') * .6 + rat(p, 'dunk') * .4;
      return clamp(.6 + (fin - 75) * .0055, .34, .9);
    }
    if (zone === 'mid') return clamp(.42 + (rat(p, 'mid') - 75) * .005, .25, .68);
    return clamp(.4 + (rat(p, 'three') - 75) * .005, .2, .62);
  }
  function defensePress(def, zone) {
    if (zone === 'rim') {
      var v = rat(def, 'interiorD') * .6 + rat(def, 'block') * .4;
      return clamp((v - 75) * .0028, -.04, .08) + boost(def, 'rimprotector') * .7;
    }
    var per = rat(def, 'perimeterD') * .6 + rat(def, 'steal') * .4;
    return clamp((per - 75) * .0025, -.04, .07) + boost(def, 'lockdown') * .7 + boost(def, 'menace') * .35;
  }

  function emptyBox() {
    return { min: 0, pts: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0,
      ore: 0, dre: 0, ast: 0, stl: 0, blk: 0, to: 0, pf: 0 };
  }
  function say(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

  function simulate(home, away, opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var developmentRules = opts.engine === 2 || opts.engine === 3;
    var pace = num(opts.pace, 100);
    var ppt = Math.round(clamp(pace * .99, 80, 112)); // 每队回合数（真实节奏约 99）
    var rotH = buildRotation(home.players), rotA = buildRotation(away.players);
    const offense={home:possessionWeights(rotH),away:possessionWeights(rotA)};
    var boxH = {}, boxA = {}, hot = {};
    home.players.forEach(function (p) { boxH[pid(p)] = emptyBox(); });
    away.players.forEach(function (p) { boxA[pid(p)] = emptyBox(); });
    var score = { home: 0, away: 0 };
    var foulCnt = { home: 0, away: 0 }; // 每队累计犯规（用于 bonus 罚球判定）
    var qScore = [1, 2, 3, 4].map(function () { return { home: 0, away: 0 }; });
    var ppq = Math.ceil(ppt / 4);
    var events = [];

    // 每个事件挂一份“事件发生后”的 box 快照，供直播数据 tab 实时显示（不持久化、不剧透终场）
    function cloneBoxes(box) {
      var out = {};
      for (var k in box) {
        if (Object.prototype.hasOwnProperty.call(box, k)) out[k] = Object.assign({}, box[k]);
      }
      return out;
    }
    function pushEv(ev) {
      ev._snap = { home: cloneBoxes(boxH), away: cloneBoxes(boxA) };
      events.push(ev);
    }

    function B(side, p) { return side === 'home' ? boxH[pid(p)] : boxA[pid(p)]; }
    function addFoul(b) { if (b.pf < 6) b.pf += 1; if (b.pf >= 6) b.fo = 1; }
    function rot(side) { return side === 'home' ? rotH : rotA; }
    function clutch(q) { return q >= 4 && Math.abs(score.home - score.away) <= 8; }
    function addScore(side, pts) { score[side] += pts; qScore[currentQ - 1][side] += pts; }
    var currentQ = 1;

    // 罚球
    function freeThrows(side, shooter, n, q, clock) {
      var b = B(side, shooter), rate = clamp(.78 + (rat(shooter, 'freeThrow') - 75) * .005, .5, .95), made = 0;
      for (var i = 0; i < n; i++) { b.fta++; if (rng() < rate) { b.ftm++; made++; addScore(side, 1); } }
      var ev = { q: q, clock: Math.round(clock), side: side, actor: pname(shooter), kind: 'ft', points: made,
        text: pname(shooter) + '罚球 ' + made + '/' + n + '。' };
      pushEv(ev);
      return made;
    }

    // 非投篮防守犯规；球队犯规数到了给 bonus 罚球
    function genericFoul(shotSide, def, q, clock) {
      var defSide = shotSide === 'home' ? 'away' : 'home';
      var bd = B(defSide, def); addFoul(bd); foulCnt[defSide]++;
      if (foulCnt[defSide] >= 6) {
        var shooter = pick(rot(shotSide), rng);
        pushEv({ q: q, clock: Math.round(clock), side: shotSide, actor: pname(def), kind: 'foul', points: 0,
          text: pname(def) + '犯规数已到，' + pname(shooter) + '上罚球线（bonus）。' });
        freeThrows(shotSide, shooter, 2, q, clock);
      } else {
        pushEv({ q: q, clock: Math.round(clock), side: shotSide, actor: pname(def), kind: 'foul', points: 0,
          text: pname(def) + '防守犯规，边线重新发球。' });
      }
    }

    // 篮板：defensive 折叠进当前事件；offensive 单独事件并触发二次进攻
    // 只判定篮板结果（box 已更新），事件的 push 顺序交给 doShot，保证 miss→篮板→补篮 与快照对齐
    function resolveRebound(shotSide, q, clock) {
      var other = shotSide === 'home' ? 'away' : 'home';
      var teamRebS = teamReb(rot(shotSide)), teamRebO = teamReb(rot(other));
      var orebProb = clamp(.26 + (teamRebS - teamRebO) * .004, .1, .4);
      var off = rng() < orebProb;
      var winnerSide = off ? shotSide : other;
      var r = rng(), acc = 0, rp = null;
      var rw = rot(winnerSide).map(function (x) {
        return { p: x.p, w: x.w * (1 + boost(x.p, 'reboundbeast') + boost(x.p, 'boxout') * .7) };
      });
      var ws = rw.reduce(function (s, x) { return s + x.w; }, 0);
      for (var i = 0; i < rw.length; i++) { acc += rw[i].w / ws; if (r <= acc) { rp = rw[i].p; break; } }
      if (!rp) rp = rw[0].p;
      var bb = B(winnerSide, rp);
      var badge = fire(rp, 'reboundbeast') || fire(rp, 'boxout');
      if (off) {
        bb.ore++;
        return { off: true, rp: rp, q: q, clock: clock,
          oreEv: { q: q, clock: Math.round(clock), side: winnerSide, actor: pname(rp), kind: 'oreb',
            points: 0, text: pname(rp) + '抢下前场篮板' + (badge ? '【' + badge.name + '】' : '') + '，还有机会！' } };
      }
      bb.dre++;
      return { off: false, dreb: pname(rp),
        dreText: ' ' + pname(rp) + '收下后场篮板' + (badge ? '【' + badge.name + '】' : '') + '。' };
    }
    function teamReb(r) { var s = 0; r.forEach(function (x) { s = rat(x.p, 'rebound') * x.w; }); return s; }

    // 二次进攻：近距离、高命中
    function putback(side, scorer, q, clock) {
      var other = side === 'home' ? 'away' : 'home';
      var def = pickDefender(rot(other), scorer.pos, rng);
      doShot(side, scorer, def, 'rim', { q: q, clock: clock, transition: false, assisted: null, putback: true });
    }

    // 一次出手
    function doShot(side, scorer, def, zone, o) {
      var other = side === 'home' ? 'away' : 'home';
      var b = B(side, scorer), bd = B(other, def);
      b.fga++; if (zone === 'three') b.tpa++;
      var q = o.q, clock = o.clock;
      var openChance = clamp(.52 + (rat(scorer, 'handle') - 75) * .004 + (rat(scorer, 'iq') - 75) * .003 +
        (o.transition ? .16 : 0) + boost(scorer, 'firststep') * .5 + boost(scorer, 'ankle') * .4, .2, .9);
      var isOpen = rng() < openChance;
      var prob = openRate(scorer, zone), fired = [];
      var baseRate = prob;

      // 三分的子情境：底角 / 超远 / 普通
      var sub = null;
      if (zone === 'three') {
        var cr = rng();
        sub = cr < .22 ? 'corner' : (cr < .36 ? 'deep' : 'normal');
      }
      if (zone === 'rim') {
        var isDunk = rat(scorer, 'dunk') >= 78 && rng() < .4 + boost(scorer, 'posterizer') * .8;
        if (o.putback) {
          fired.push(fire(scorer, 'finisher'));
        } else if (o.assisted) {
          if (isDunk) fired.push(fire(scorer, 'lobfin'), fire(scorer, 'highflyer'));
          else fired.push(fire(scorer, 'finisher'));
        } else if (isDunk) {
          fired.push(fire(scorer, 'posterizer'), fire(scorer, 'highflyer'));
        } else if (!isOpen) {
          fired.push(fire(scorer, 'contactfin'));
        } else {
          fired.push(rng() < .5 ? fire(scorer, 'takeoff') : fire(scorer, 'protouch'));
        }
      } else if (zone === 'mid') {
        fired.push(fire(scorer, 'midmaestro'));
        if (!isOpen) fired.push(fire(scorer, 'difficult'));
      } else {
        if (isOpen) fired.push(fire(scorer, 'catchshoot'));
        if (sub === 'corner') fired.push(fire(scorer, 'corner'));
        if (sub === 'deep') fired.push(fire(scorer, 'limitless'));
        if (!isOpen) fired.push(fire(scorer, 'difficult'));
      }
      if (developmentRules) {
        const shotBadges = fired.filter(Boolean);
        prob += shotBadges.reduce((sum,b)=>sum+boost(scorer,b.id)*.4,0);
        if(zone==='rim' && !isOpen)prob += boost(scorer,'iron')*.3;
        if(o.transition)prob += boost(scorer,'workhorse')*.3;
      }
      // 助攻：十美分
      if (o.assisted) {
        var dm = boost(o.assisted, 'dimer');
        if (dm) { prob += dm; fired.push({ id: 'dimer', name: badgeName('dimer'), by: pname(o.assisted) }); }
      }
      // 火热手感（动量）
      var streak = hot[pid(scorer)] || 0;
      if (streak >= 2) { var gm = boost(scorer, 'greenmachine'); if (gm) { prob += gm * clamp(streak / 3, 0, 1.4); fired.push(fire(scorer, 'greenmachine')); } }
      // 关键球
      if (clutch(q)) {
        var cl = fire(scorer, 'clutch'); if (cl) { prob += boost(scorer, 'clutch'); fired.push(cl); }
        if (!isOpen) { var cb = fire(scorer, 'coldblooded'); if (cb) { prob += boost(scorer, 'coldblooded'); fired.push(cb); } }
      }
      if(developmentRules)prob=baseRate+Math.min(.08,prob-baseRate);
      prob -= defensePress(def, zone);
      if (!isOpen) prob -= (zone === 'rim' ? .1 : zone === 'three' ? .1 : .08) - (developmentRules ? 0 : boost(scorer, 'contactfin') * .6);
      fired = fired.filter(Boolean);
      prob = clamp(prob, .08, .9);

      // 投篮犯规：篮下强对抗为主，三分强投也有少量犯规
      var foulR = zone === 'rim' ? (isOpen ? .07 : .26) : (zone === 'three' && !isOpen ? .03 : 0);
      var foul = foulR > 0 && rng() < foulR;
      var made = rng() < prob;
      var ev = { q: q, clock: Math.round(clock), side: side, actor: pname(scorer), kind: 'shot',
        zone: zone, open: isOpen, sub: sub, transition: !!o.transition,
        badges: fired };
      // fgPoints 只记投篮本身（2/3），罚球由 freeThrows 独立加分，避免重复计分
      var fgPoints = 0;

      if (foul) {
        addFoul(bd); foulCnt[other]++;
        if (made) {
          fgPoints = zone === 'three' ? 3 : 2; b.fgm++; if (zone === 'three') b.tpm++;
          // 先 push 投篮事件（此时快照只含投篮，不含尚未发生的加罚）
          ev.text = madeText(scorer, zone, isOpen, o, fired) + ' 还造成犯规。';
          if (fgPoints) addScore(side, fgPoints);
          ev.points = fgPoints;
          pushEv(ev);
          // 再加罚：罚球事件在投篮之后，快照含投篮+罚球，顺序与转播一致
          freeThrows(side, scorer, 1, q, clock);
        } else {
          // 投篮不中被犯规：先 push 投篮事件（0 分），再走罚球
          ev.text = zone === 'three' ? pname(scorer) + '外线强投被犯规。'
            : pname(scorer) + '强杀篮下被犯规。';
          ev.points = 0;
          pushEv(ev);
          var fn = zone === 'three' ? 3 : 2;
          freeThrows(side, scorer, fn, q, clock);
        }
      } else if (made) {
        fgPoints = zone === 'three' ? 3 : 2;
        b.fgm++; if (zone === 'three') b.tpm++;
        hot[pid(scorer)] = streak + 1;
        if (o.assisted) { B(side, o.assisted).ast++; ev.assist = pname(o.assisted); }
        ev.text = madeText(scorer, zone, isOpen, o, fired);
        ev.badges = made ? fired : [];
        if (fgPoints) addScore(side, fgPoints);
        ev.points = fgPoints;
        pushEv(ev);
      } else {
        hot[pid(scorer)] = 0;
        ev.text = missText(scorer, zone, isOpen);
        if (!isOpen && rng() < blockChance(def, zone, o.transition)) {
          bd.blk++; ev.blocked = pname(def);
          ev.text = pname(def) + '一记大帽把' + (zone === 'three' ? '三分' : zone === 'mid' ? '中投' : '上篮') + '扇飞！';
        }
        ev.badges = [];
        ev.points = 0;
        var rb = resolveRebound(side, q, clock);
        if (rb.off) {
          pushEv(ev);                 // 先 miss
          pushEv(rb.oreEv);           // 再前场篮板
          putback(side, rb.rp, q, clock);  // 最后补篮
        } else {
          ev.dreb = rb.dreb;
          ev.text += rb.dreText;      // 后场篮板折叠进 miss
          pushEv(ev);
        }
      }
    }

    function blockChance(def, zone, transition) {
      var base = zone === 'rim' ? .48 : zone === 'mid' ? .13 : .08;
      base += boost(def, 'rimprotector') * .7;
      if (transition) base += boost(def, 'chase');
      return clamp(base, .01, .52);
    }

    function madeText(actor, zone, isOpen, o, fired) {
      var nm = pname(actor), b = fired.length ? '【' + fired.map(function (f) { return f.name; }).join('·') + '】' : '';
      if (zone === 'rim') return say([
        nm + '突入禁区擦板命中' + b + '。', nm + '杀到篮下躲开防守把球放进' + b + '。',
        o.transition ? nm + '快攻一马当先轻松取分' + b + '。' : nm + '内线强起两分到手' + b + '。'], rng);
      if (zone === 'mid') return say([nm + '中距离急停空心入网' + b + '。', nm + '罚球线附近稳稳命中中投' + b + '。'], rng);
      return say([
        nm + '三分线外接球就投一箭穿心' + b + '。', nm + '外线发炮三分命中' + b + '。',
        isOpen ? nm + '大空位三分手起刀落' + b + '。' : nm + '顶着防守强投三分竟然进了' + b + '。'], rng);
    }
    function missText(actor, zone, isOpen) {
      var nm = pname(actor);
      if (zone === 'rim') return say([nm + '篮下出手在筐上弹了两下没进。', nm + '上篮受到干扰偏出。'], rng);
      if (zone === 'mid') return say([nm + '中投磕筐而出。', nm + '中距离出手短了。'], rng);
      return say([nm + '三分出手力道大了。', nm + '外线远投打铁不中。'], rng);
    }

    function possession(side, period, clock) {
      var other = side === 'home' ? 'away' : 'home';
      currentQ = period;
      var transition = rng() < .16;
      var actor = pick(offense[side], rng);
      var def = pickDefender(rot(other), actor.pos, rng);
      var b = B(side, actor), bd = B(other, def);

      var toProb = clamp(.12 - (rat(actor, 'handle') - 75) * .003 - boost(actor, 'handles') * .5 -
        boost(actor, 'unpluckable') * .4 - boost(actor, 'flashypass') * .3 +
        (rat(def, 'steal') - 75) * .003 + boost(def, 'glove') * .5 + boost(def, 'menace') * .4, .04, .28);
      if (rng() < toProb) {
        b.to++;
        if (rng() < boost(def, 'charge') * 1.6) {
          pushEv({ q: currentQ, clock: Math.round(clock), side: side, actor: pname(actor), kind: 'foul', points: 0,
            text: pname(def) + '提前站定，' + pname(actor) + '带球撞人，进攻犯规！【进攻犯规制造者】' });
        } else {
          var stl = rng() < .55;
          if (stl) bd.stl++;
          pushEv({ q: currentQ, clock: Math.round(clock), side: side, actor: pname(actor), kind: 'to', points: 0,
            text: stl ? pname(def) + '眼疾手快直接断球！' : pname(actor) + '传球出现失误，球权易主。' });
        }
        return;
      }

      // 普通防守犯规（非投篮；部分进 bonus 罚球）
      if (rng() < .12) { genericFoul(side, def, currentQ, clock); return; }

      var mix = shotMix(actor);
      var assistChance = clamp(.72 + (rat(actor, 'pass') - 75) * .005 + boost(actor, 'dimer') * .3 +
        boost(actor, 'flashypass') * .25, .3, .9);
      var scorer = actor, assister = null;
      if (rng() < assistChance) { assister = actor; scorer = pick(offense[side], rng); }
      var sdef = pickDefender(rot(other), scorer.pos, rng);
      var zone = pickZone(shotMix(scorer), rng);
      doShot(side, scorer, sdef, zone, { q: currentQ, clock: clock, transition: transition, assisted: assister, putback: false });
    }

    function playPair(period, clock, awayFirst) {
      possession(awayFirst ? 'away' : 'home', period, clock);
      possession(awayFirst ? 'home' : 'away', period, clock);
    }

    for (var i = 0; i < ppt; i++) {
      playPair(Math.min(4, Math.floor(i / ppq) + 1), 720 - (i % ppq) * (720 / ppq), false);
    }

    var overtime = 0, overtimePossessions = Math.round(ppt * 5 / 48);
    // Bound the loop when a custom random source never yields a winner.
    while (opts.overtime && score.home === score.away && overtime < 8) {
      overtime++;
      qScore.push({ home: 0, away: 0 });
      foulCnt.home = foulCnt.away = 0;
      for (var j = 0; j < overtimePossessions; j++) {
        playPair(4 + overtime, 300 - j * (300 / overtimePossessions), overtime % 2 === 0);
      }
    }

    function finalize(players, box, rotation) {
      players.forEach(function (p) {
        var b = box[pid(p)]; if (!b) return;
        b.pts = (b.fgm - b.tpm) * 2 + b.tpm * 3 + b.ftm;
        var rx = rotation.find(x=>x.p===p);
        b.min = rx ? r1(rx.min * (48 + 5 * overtime) / 48) : 0;
      });
    }
    finalize(home.players, boxH, rotH);
    finalize(away.players, boxA, rotA);

    var winner = score.home === score.away ? null : (score.home > score.away ? 'home' : 'away');
    return {
      home: { name: sideName(home.name), players: home.players, box: boxH },
      away: { name: sideName(away.name), players: away.players, box: boxA },
      events: events, score: score, quarters: qScore, winner: winner, possessions: ppt + overtime * overtimePossessions
    };
  }

  window.MBLMatchEngine = { simulate: simulate };
})();
