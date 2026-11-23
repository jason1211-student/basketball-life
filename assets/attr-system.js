/* attr-system：统一的 2K 式能力值与徽章系统（玩家 + NPC 同一套）。
 * 17 项能力（0-99）为唯一数据源；比赛用 5 轴为派生投影；31 个徽章按属性自动点亮并给实战加成。
 * 纯逻辑模块，不直接改 DOM；迁移与引擎接入在各调用方完成。 */
(function () {
  'use strict';
  if (window.MBLAttrSys) return;
  var C = window.MBLCore;
  function num(v, d) { return C ? C.num(v, d) : (isFinite(v) ? Number(v) : (d == null ? 0 : d)); }
  function rnd(v) { return C ? C.round(v) : Math.round(num(v)); }
  function clamp(v, lo, hi) { return C ? C.clamp(v, lo, hi) : Math.max(lo, Math.min(hi, v)); }

  var ATTR_VERSION = 2;

  // ===== 17 项能力与分组 =====
  var KEYS = ['layup', 'dunk', 'three', 'mid', 'freeThrow',
    'handle', 'pass', 'speedWithBall', 'iq',
    'perimeterD', 'interiorD', 'steal', 'block', 'rebound',
    'speed', 'strength', 'vertical'];

  var CATEGORIES = [
    { id: 'finishing', name: '终结', keys: ['layup', 'dunk'] },
    { id: 'shooting', name: '投篮', keys: ['three', 'mid', 'freeThrow'] },
    { id: 'playmaking', name: '组织', keys: ['handle', 'pass', 'speedWithBall', 'iq'] },
    { id: 'defense', name: '防守/篮板', keys: ['perimeterD', 'interiorD', 'steal', 'block', 'rebound'] },
    { id: 'physical', name: '身体', keys: ['speed', 'strength', 'vertical'] }
  ];

  var ATTR_CN = {
    layup: '上篮', dunk: '扣篮', three: '三分', mid: '中距离', freeThrow: '罚球',
    handle: '控球', pass: '传球', speedWithBall: '持球速度', iq: '篮球智商',
    perimeterD: '外线防守', interiorD: '内线防守', steal: '抢断', block: '盖帽', rebound: '篮板',
    speed: '速度', strength: '力量', vertical: '弹跳'
  };

  // 旧 10 项 -> 新 17 项的拆分比例（用于由旧位置权重构建新权重）
  var OLD_LIE = {
    guard: { three: .2, mid: .1, finishing: .1, handling: .2, passing: .15, perimeterD: .1, interiorD: 0, rebound: .02, iq: .08, athleticism: .05 },
    wing: { three: .15, mid: .1, finishing: .15, handling: .1, passing: .08, perimeterD: .15, interiorD: .05, rebound: .07, iq: .08, athleticism: .07 },
    big: { three: .05, mid: .05, finishing: .2, handling: .03, passing: .07, perimeterD: .05, interiorD: .2, rebound: .2, iq: .08, athleticism: .07 }
  };
  var SPLIT = {
    three: { three: 1 }, mid: { mid: 1 },
    finishing: { layup: .6, dunk: .4 },
    handling: { handle: .55, speedWithBall: .45 },
    passing: { pass: 1 },
    perimeterD: { perimeterD: .6, steal: .4 },
    interiorD: { interiorD: .6, block: .4 },
    rebound: { rebound: 1 }, iq: { iq: 1 },
    athleticism: { speed: .4, strength: .25, vertical: .35 }
  };

  function buildWeights(pos) {
    var base = OLD_LIE[pos] || OLD_LIE.wing, w = {}, i;
    for (i = 0; i < KEYS.length; i++) w[KEYS[i]] = 0;
    Object.keys(base).forEach(function (old) {
      var sp = SPLIT[old] || {};
      Object.keys(sp).forEach(function (nk) { w[nk] = (w[nk] || 0) + base[old] * sp[nk]; });
    });
    w.freeThrow = .03; // 新增罚球小权重
    var sum = KEYS.reduce(function (s, k) { return s + w[k]; }, 0);
    KEYS.forEach(function (k) { w[k] = w[k] / sum; });
    return w;
  }
  var WEIGHTS = { guard: buildWeights('guard'), wing: buildWeights('wing'), big: buildWeights('big') };

  // ===== 17 -> 5 比赛轴（派生投影）=====
  var FIVE = ['sh', 'ins', 'pm', 'df', 'ath'];
  function fiveAxis(r) {
    var per = num(r.perimeterD) * .6 + num(r.steal) * .4;
    var inside = num(r.interiorD) * .6 + num(r.block) * .4;
    return {
      sh: num(r.three) * .6 + num(r.mid) * .4,
      ins: (num(r.layup) * .6 + num(r.dunk) * .4) * .65 + num(r.rebound) * .35,
      pm: num(r.handle) * .3 + num(r.pass) * .3 + num(r.speedWithBall) * .2 + num(r.iq) * .2,
      df: Math.max(per, inside) * .7 + Math.min(per, inside) * .3,
      ath: num(r.speed) * .4 + num(r.strength) * .25 + num(r.vertical) * .35
    };
  }

  // ===== 风格（打法原型）自动识别 =====
  var STYLES = [
    { id: 'playmaker', name: '组织核心', keys: ['pass', 'handle', 'speedWithBall', 'iq'] },
    { id: 'sharpshooter', name: '空间射手', keys: ['three', 'mid'] },
    { id: 'slasher', name: '突破终结', keys: ['layup', 'dunk', 'speed', 'speedWithBall'] },
    { id: 'threeD', name: '3D 侧翼', keys: ['three', 'perimeterD', 'steal'] },
    { id: 'lockdown', name: '双向锁防', keys: ['perimeterD', 'interiorD', 'steal', 'block'] },
    { id: 'rim', name: '护框中锋', keys: ['interiorD', 'block', 'vertical'] },
    { id: 'glass', name: '篮板蓝领', keys: ['rebound', 'strength'] },
    { id: 'dominator', name: '内线统治', keys: ['layup', 'dunk', 'strength'] }
  ];
  function meanOf(r, ks) {
    var s = 0, n = 0;
    ks.forEach(function (k) { s += num(r[k]); n++; });
    return n ? s / n : 0;
  }
  function detectStyle(r) {
    var all = meanOf(r, KEYS), best = null, bestMargin = 4;
    STYLES.forEach(function (st) {
      var m = meanOf(r, st.keys), margin = m - all;
      if (margin > bestMargin) { bestMargin = margin; best = st.id; }
    });
    return best || 'allaround';
  }
  var STYLE_NAME = { allaround: '全能万金油' };
  STYLES.forEach(function (st) { STYLE_NAME[st.id] = st.name; });

  // ===== 总评（位置加权 + 风格微调）=====
  var STYLE_BUFF = .3, STYLE_NERF = .15;
  function overall(r, pos) {
    var w0 = WEIGHTS[pos] || WEIGHTS.wing, style = detectStyle(r);
    var def = STYLES.find(function (st) { return st.id === style; });
    var keySet = def ? def.keys : null;
    var w = {}, sum = 0;
    KEYS.forEach(function (k) {
      var mult = 1;
      if (keySet) mult = keySet.indexOf(k) >= 0 ? 1 + STYLE_BUFF : 1 - STYLE_NERF;
      w[k] = w0[k] * mult;
      sum += w[k];
    });
    var s = 0;
    KEYS.forEach(function (k) { s += num(r[k]) * (w[k] / sum); });
    return Math.round(clamp(s, 0, 99));
  }

  // ===== 徽章（31 个，四档）=====
  var TIERS = { bronze: 60, silver: 72, gold: 84, hof: 92 };
  var TIER_LABEL = { bronze: '铜', silver: '银', gold: '金', hof: '名人堂' };
  var TIER_ORDER = ['hof', 'gold', 'silver', 'bronze'];
  var TIER_NEXT = ['bronze', 'silver', 'gold', 'hof'];
  var TIER_POWER = { bronze: 1, silver: 2, gold: 3, hof: 4 };
  var BADGE_CATS = [
    { id: 'finishing', name: '终结' }, { id: 'shooting', name: '投篮' },
    { id: 'playmaking', name: '组织' }, { id: 'defense', name: '防守' },
    { id: 'rebounding', name: '篮板' }, { id: 'physical', name: '身体' },
    { id: 'iq', name: '球商' }
  ];
  var C66 = { bronze: 66, silver: 76, gold: 86, hof: 94 };
  var C70 = { bronze: 70, silver: 80, gold: 88, hof: 95 };
  var BADGES = [
    // 终结 6
    { id: 'finisher', cat: 'finishing', name: '终结者', desc: '篮下近身终结效率高', attrs: ['layup'], axis: 'ins' },
    { id: 'contactfin', cat: 'finishing', name: '对抗终结者', desc: '身体对抗下仍能完成出手', attrs: ['layup', 'strength'], thresholds: C66, axis: 'ins' },
    { id: 'posterizer', cat: 'finishing', name: '隔扣达人', desc: '防守人头上完成扣篮', attrs: ['dunk', 'vertical'], axis: 'ins' },
    { id: 'lobfin', cat: 'finishing', name: '空接终结者', desc: '空中接力终结稳定', attrs: ['dunk'], axis: 'ins' },
    { id: 'takeoff', cat: 'finishing', name: '无限起飞', desc: '更远距离起跳过掉护框', attrs: ['dunk', 'vertical'], axis: 'ins' },
    { id: 'protouch', cat: 'finishing', name: '柔和手感', desc: '节奏变化下的上篮手感', attrs: ['layup', 'iq'], axis: 'ins' },
    // 投篮 6
    { id: 'catchshoot', cat: 'shooting', name: '接球射手', desc: '接球后定点投篮更稳', attrs: ['three'], axis: 'sh' },
    { id: 'midmaestro', cat: 'shooting', name: '中距离大师', desc: '中投节奏与命中出色', attrs: ['mid'], axis: 'sh' },
    { id: 'limitless', cat: 'shooting', name: '射程无限', desc: '超远三分具备威胁', attrs: ['three'], thresholds: C70, axis: 'sh' },
    { id: 'corner', cat: 'shooting', name: '底角专家', desc: '底角三分更准更稳', attrs: ['three'], axis: 'sh' },
    { id: 'difficult', cat: 'shooting', name: '高难度投篮', desc: '移动中强行出手仍能命中', attrs: ['mid', 'speedWithBall'], axis: 'sh' },
    { id: 'greenmachine', cat: 'shooting', name: '火热手感', desc: '连中后投篮持续升温', attrs: ['three', 'mid'], axis: 'sh' },
    // 组织 6
    { id: 'dimer', cat: 'playmaking', name: '十美分', desc: '为队友创造空位机会', attrs: ['pass'], axis: 'pm' },
    { id: 'handles', cat: 'playmaking', name: '控球大师', desc: '持球摆脱与护球稳健', attrs: ['handle'], axis: 'pm' },
    { id: 'ankle', cat: 'playmaking', name: '脚踝终结者', desc: '运球调动防守重心', attrs: ['handle'], thresholds: C66, axis: 'pm' },
    { id: 'firststep', cat: 'playmaking', name: '第一步大师', desc: '启动第一步迅速甩开防守', attrs: ['speedWithBall', 'handle'], axis: 'pm' },
    { id: 'unpluckable', cat: 'playmaking', name: '护球专家', desc: '持球时很难被掏掉', attrs: ['handle'], axis: 'pm' },
    { id: 'flashypass', cat: 'playmaking', name: '妙传手', desc: '复杂局面下仍能精准出球', attrs: ['pass', 'iq'], axis: 'pm' },
    // 防守 6
    { id: 'lockdown', cat: 'defense', name: '外线锁防', desc: '紧贴盯防外线对位者', attrs: ['perimeterD'], axis: 'df' },
    { id: 'rimprotector', cat: 'defense', name: '护筐者', desc: '内线封盖与护框', attrs: ['interiorD', 'block'], axis: 'df' },
    { id: 'glove', cat: 'defense', name: '抢断手套', desc: '抢断与掏球更果断', attrs: ['steal'], thresholds: C66, axis: 'df' },
    { id: 'chase', cat: 'defense', name: '追帽大师', desc: '退防中从身后封盖', attrs: ['block', 'vertical'], axis: 'df' },
    { id: 'menace', cat: 'defense', name: '死亡缠绕', desc: '持续施压制造失误', attrs: ['perimeterD', 'steal'], axis: 'df' },
    { id: 'charge', cat: 'defense', name: '进攻犯规制造者', desc: '提前站位制造带球撞人', attrs: ['perimeterD', 'iq'], axis: 'df' },
    // 篮板 2
    { id: 'boxout', cat: 'rebounding', name: '卡位怪兽', desc: '卡位把对手挡在身后', attrs: ['rebound', 'strength'], axis: 'ins' },
    { id: 'reboundbeast', cat: 'rebounding', name: '篮板怪兽', desc: '争抢攻防两端篮板', attrs: ['rebound'], axis: 'ins' },
    // 身体 3
    { id: 'highflyer', cat: 'physical', name: '飞人', desc: '弹跳与爆发力出色', attrs: ['vertical'], axis: 'ath' },
    { id: 'iron', cat: 'physical', name: '铁人', desc: '耐对抗、体能充沛', attrs: ['strength'], axis: 'ath' },
    { id: 'workhorse', cat: 'physical', name: '体力怪', desc: '高负荷下仍保持输出', attrs: ['strength', 'speed'], axis: 'ath' },
    // 球商 2
    { id: 'clutch', cat: 'iq', name: '关键先生', desc: '关键时刻的判断与出手', attrs: ['iq'], axis: 'pm' },
    { id: 'coldblooded', cat: 'iq', name: '冷血大心脏', desc: '高压下冷静不手软', attrs: ['iq', 'speedWithBall'], axis: 'pm' }
  ];

  function badgeValue(r, attrs) {
    var v = Infinity;
    attrs.forEach(function (k) { v = Math.min(v, num(r[k])); });
    return v;
  }
  function tierOf(r, b) {
    var v = badgeValue(r, b.attrs), th = b.thresholds || TIERS;
    for (var i = 0; i < TIER_ORDER.length; i++) {
      var t = TIER_ORDER[i];
      if (v >= th[t]) return t;
    }
    return null;
  }
  function badgeTiers(r) {
    var out = {};
    BADGES.forEach(function (b) { var t = tierOf(r, b); if (t) out[b.id] = t; });
    return out;
  }
  // 各比赛轴的徽章加成（每轴封顶 +8）
  function badgeBonus(r) {
    var acc = { sh: 0, ins: 0, pm: 0, df: 0, ath: 0 };
    BADGES.forEach(function (b) {
      var t = tierOf(r, b);
      if (t) acc[b.axis] += TIER_POWER[t];
    });
    FIVE.forEach(function (a) { acc[a] = Math.min(8, acc[a]); });
    return acc;
  }
  // 含徽章的实战 5 轴
  function matchFive(r) {
    var base = fiveAxis(r), bonus = badgeBonus(r);
    FIVE.forEach(function (a) { base[a] = clamp(base[a] + bonus[a], 0, 99); });
    return base;
  }

  // ===== 旧存档迁移 =====
  // 玩家：旧 10 项 -> 新 17 项（严格保总评，拆分项均值=原值）
  function deriveFromOld(o) {
    var A = num(o.athleticism), F = num(o.finishing), H = num(o.handling);
    var pD = num(o.perimeterD), iD = num(o.interiorD);
    return {
      three: num(o.three), mid: num(o.mid), iq: num(o.iq),
      layup: F, dunk: rnd(F * .5 + A * .5),
      handle: H, pass: num(o.passing),
      speedWithBall: rnd(H * .6 + A * .4),
      perimeterD: pD, steal: pD,
      interiorD: iD, block: rnd(iD * .6 + A * .4),
      rebound: num(o.rebounding),
      speed: A, strength: A, vertical: A,
      freeThrow: rnd(num(o.three) * .5 + num(o.mid) * .5)
    };
  }
  function migratePlayerBall(b) {
    if (b.attrVersion === ATTR_VERSION) return b;
    if (b.skills && b.skills.finishing !== undefined) {
      b.skills = deriveFromOld(b.skills);
      if (b.potential) b.potential = deriveFromOld(b.potential);
    }
    b.attrVersion = ATTR_VERSION;
    return b;
  }
  // ===== 方案 A：NPC 直接生成有高低差的 17 项 + 按总评徽章预算 =====
  var AXIS_GROUP = {
    sh: ['three', 'mid', 'freeThrow'],
    ins: ['layup', 'dunk', 'rebound'],
    pm: ['handle', 'pass', 'speedWithBall', 'iq'],
    df: ['perimeterD', 'interiorD', 'steal', 'block'],
    ath: ['speed', 'strength', 'vertical']
  };
  var KEY_AXIS = {};
  FIVE.forEach(function (a) { AXIS_GROUP[a].forEach(function (k) { KEY_AXIS[k] = a; }); });

  // 位置倾向（分）：同位置招牌技能偏高、非招牌偏低
  var BIAS = {
    guard: { three:5, mid:2, freeThrow:3, layup:2, dunk:-6, rebound:-6,
      handle:4, pass:3, speedWithBall:4, iq:2,
      perimeterD:2, interiorD:-6, steal:4, block:-8, speed:3, strength:-4, vertical:-2 },
    wing: { three:4, mid:3, freeThrow:1, layup:3, dunk:2, rebound:0,
      handle:-2, pass:0, speedWithBall:1, iq:2,
      perimeterD:3, interiorD:-2, steal:2, block:-2, speed:2, strength:0, vertical:2 },
    big: { three:-8, mid:-4, freeThrow:-3, layup:2, dunk:3, rebound:5,
      handle:-6, pass:1, speedWithBall:-6, iq:2,
      perimeterD:-4, interiorD:5, steal:-6, block:5, speed:-4, strength:4, vertical:2 }
  };

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // 由能力值与位置做确定性随机（同一球员每次结果稳定，不依赖外部 rng）
  function prngFor(o, pos) {
    var h = 2166136261 ^ (pos === 'guard' ? 1 : pos === 'big' ? 3 : 2);
    KEYS.forEach(function (k) { h = Math.imul(h ^ Math.round(num(o[k])), 16777619) >>> 0; });
    return mulberry32(h >>> 0);
  }

  // 由 5 轴锚点生成有高低差的 17 项；组内均值校正回父轴，保证整体水平不漂移
  function genNpcRatings(raw, pos) {
    var rng = prngFor(raw, pos), b = BIAS[pos] || BIAS.wing, out = {};
    FIVE.forEach(function (ax) {
      var parent = num(raw[ax]), keys = AXIS_GROUP[ax];
      var vals = keys.map(function (k) { return parent + (rng() - .5) * 12 + (b[k] || 0); });
      var mean = vals.reduce(function (s, v) { return s + v; }, 0) / vals.length;
      var shift = parent - mean;
      keys.forEach(function (k, i) { out[k] = Math.round(clamp(vals[i] + shift, 20, 99)); });
    });
    return out;
  }

  // 徽章预算（按总评四档）：球星 20-28 / 首发 12-18 / 角色 5-10 / 边缘 0-4
  function budgetRange(ovr) {
    if (ovr >= 86) return [20, 28];
    if (ovr >= 75) return [12, 18];
    if (ovr >= 65) return [5, 10];
    return [0, 4];
  }
  function assignBadges(ratings, ovr, rng) {
    var range = budgetRange(ovr);
    var budget = range[0] + Math.floor(rng() * (range[1] - range[0] + 1));
    var elig = [];
    BADGES.forEach(function (b) {
      var t = tierOf(ratings, b);
      if (t) elig.push({ id: b.id, tier: t, pow: TIER_POWER[t], val: badgeValue(ratings, b.attrs), j: rng() });
    });
    if (elig.length > budget) {
      elig.sort(function (x, y) {
        return (y.pow * 100 + y.val + y.j * 6) - (x.pow * 100 + x.val + x.j * 6);
      });
      elig = elig.slice(0, budget);
    }
    var out = {};
    elig.forEach(function (e) { out[e.id] = e.tier; });
    return out;
  }
  function bonusFromMap(map) {
    var acc = { sh: 0, ins: 0, pm: 0, df: 0, ath: 0 };
    BADGES.forEach(function (b) { if (map[b.id]) acc[b.axis] += TIER_POWER[map[b.id]]; });
    FIVE.forEach(function (a) { acc[a] = Math.min(8, acc[a]); });
    return acc;
  }

  // iH 入口：原始 5 轴 -> 17 项分化能力 + 预算徽章 + 与能力一致的 5 轴
  function finalizeNpc(raw, pos) {
    raw.ratings = genNpcRatings(raw, pos);
    var ovr = overall(raw.ratings, pos);
    raw.badges = assignBadges(raw.ratings, ovr, prngFor(raw.ratings, pos));
    var base = fiveAxis(raw.ratings), bn = bonusFromMap(raw.badges);
    FIVE.forEach(function (a) { raw[a] = Math.round(clamp(base[a] + bn[a], 0, 99)); });
    return raw;
  }

  // 年度成长后重同步：已有能力沿形态平移（招牌技能保持），无 ratings 的旧档才重新生成
  function resyncNpc(npc) {
    var z = { sh: 0, ins: 0, pm: 0, df: 0, ath: 0 };
    var oldBonus = npc.badges ? bonusFromMap(npc.badges) : z;
    var raw = {};
    FIVE.forEach(function (a) { raw[a] = num(npc[a]) - oldBonus[a]; });
    if (npc.ratings) {
      var oldBase = fiveAxis(npc.ratings);
      KEYS.forEach(function (k) {
        var ax = KEY_AXIS[k];
        npc.ratings[k] = Math.round(clamp(num(npc.ratings[k]) + (raw[ax] - oldBase[ax]), 20, 99));
      });
    } else {
      npc.ratings = genNpcRatings(raw, npc.pos);
    }
    var ovr = overall(npc.ratings, npc.pos);
    npc.badges = assignBadges(npc.ratings, ovr, prngFor(npc.ratings, npc.pos));
    var base = fiveAxis(npc.ratings), bn = bonusFromMap(npc.badges);
    FIVE.forEach(function (a) { npc[a] = Math.round(clamp(base[a] + bn[a], 0, 99)); });
    return npc;
  }
  // 兼容保留：旧的 5 轴摊平（主流程已不再使用）
  function expandNpc(five) {
    var sh = num(five.sh), ins = num(five.ins), pm = num(five.pm), df = num(five.df), ath = num(five.ath);
    return {
      three: sh, mid: sh, freeThrow: sh,
      layup: ins, dunk: ins, rebound: ins,
      handle: pm, pass: pm, speedWithBall: pm, iq: pm,
      perimeterD: df, steal: df, interiorD: df, block: df,
      speed: ath, strength: ath, vertical: ath
    };
  }

  window.MBLAttrSys = {
    ATTR_VERSION: ATTR_VERSION,
    KEYS: KEYS, CATEGORIES: CATEGORIES, ATTR_CN: ATTR_CN,
    FIVE: FIVE, WEIGHTS: WEIGHTS,
    fiveAxis: fiveAxis, matchFive: matchFive,
    STYLES: STYLES, STYLE_NAME: STYLE_NAME, detectStyle: detectStyle,
    overall: overall,
    BADGES: BADGES, BADGE_CATS: BADGE_CATS,
    TIERS: TIERS, TIER_LABEL: TIER_LABEL, TIER_ORDER: TIER_ORDER, TIER_NEXT: TIER_NEXT,
    tierOf: tierOf, badgeTiers: badgeTiers, badgeBonus: badgeBonus,
    migratePlayerBall: migratePlayerBall, expandNpc: expandNpc, resyncNpc: resyncNpc,
    finalizeNpc: finalizeNpc, genNpcRatings: genNpcRatings,
    assignBadges: assignBadges, budgetRange: budgetRange
  };
})();
