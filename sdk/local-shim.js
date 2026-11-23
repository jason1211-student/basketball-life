/* 本地登录桩：伪造 ColorboxAI 桥接，仅用于个人本地单机运行，不联网 */
(function () {
  if (window.__LOCAL_SHIM__) return;
  window.__LOCAL_SHIM__ = true;
  window.__SHIMLOG__=[];

  var USER = { puid: '88888888', nickname: '本地玩家', avatar: '', userHeadUrl: '', islogin: 1 };
  var cloudStore = { revision: 0, payload: null };

  var STORE_KEYS = ['mbl.current', 'mbl.records', 'mbl.achievements', 'mbl.countries', 'mbl.settings', 'mbl.shared'];
  var PERK_KEYS = ['height', 'talent', 'starter', 'health', 'family', 'discipline'];
  var SKILL_KEYS = ['three', 'mid', 'finishing', 'handling', 'passing', 'perimeterD', 'interiorD', 'rebounding', 'iq', 'athleticism'];
  var SKILL_LABEL = { three: '三分', mid: '中投', finishing: '终结', handling: '控球', passing: '传球', perimeterD: '外线防守', interiorD: '内线防守', rebounding: '篮板', iq: '球商', athleticism: '运动能力' };

  function pathOf(u) { return u.split('?')[0]; }
  function queryOf(u) { return u.indexOf('?') >= 0 ? u.split('?')[1] : ''; }
  function ok(data) { return { code: 200, statusCode: 200, data: data }; }

  function memGet(k) {
    try { if (window.MBLMemoryStore && typeof window.MBLMemoryStore.getItem === 'function') return window.MBLMemoryStore.getItem(k); } catch (_) {}
    try { return localStorage.getItem(k); } catch (_) { return null; }
  }
  function snapshotEntries() {
    var e = {};
    STORE_KEYS.forEach(function (k) { e[k] = memGet(k); });
    return e;
  }
  function currentLife() {
    try { var s = memGet('mbl.current'); return s ? JSON.parse(s) : null; } catch (_) { return null; }
  }
  function settleAnnualTraining(life) {
    var changes = [];
    if (life && life.ball && life.ball.skills) {
      var pool = SKILL_KEYS.filter(function (k) {
        return Number.isFinite(life.ball.skills[k]) && life.ball.skills[k] < 99;
      });
      for (var i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
      }
      pool.slice(0, 2).forEach(function (k) {
        var before = life.ball.skills[k];
        var gain = 5 + Math.floor(Math.random() * 6);
        var after = Math.min(99, Math.round((before + gain) * 10) / 10);
        life.ball.skills[k] = after;
        changes.push({ label: SKILL_LABEL[k] || k, before: before, after: after, gain: Math.round((after - before) * 10) / 10 });
      });
      life.mblTraining = Array.isArray(life.mblTraining) ? life.mblTraining : [];
      life.mblTraining.push({ age: life.age, changes: changes });
    }
    return changes;
  }
  function clamp(v, lo, hi) {
    v = Number(v);
    if (!Number.isFinite(v)) v = lo;
    return Math.min(hi, Math.max(lo, v));
  }
  // 出生加成本地结算：原版由服务端发奖时直接改好角色快照，本地桩按游戏数值体系补齐对应属性增益。
  function applyBirthPerk(life, perkKey) {
    var b = life.ball;
    var changes = [];
    if (!b) return changes;
    b.potential = b.potential || {};
    b.skills = b.skills || {};
    life.traits = life.traits || {};
    life.traitsAtBirth = life.traitsAtBirth || {};
    life.status = life.status || {};

    function bumpPot(k, d) {
      if (!Number.isFinite(b.potential[k])) return;
      var before = b.potential[k];
      var after = clamp(Math.round(before + d), 35, 99);
      b.potential[k] = after;
      if (after !== before) changes.push({ key: k, label: SKILL_LABEL[k] || k, before: before, after: after, gain: after - before });
    }

    if (perkKey === 'height') {
      // 身高优势：成年身高 +5cm，连带翼展与内线/外线潜力调整（对齐原版 iFe 口径）
      var oldH = Number(b.adultHeight) || 180;
      var newH = Math.min(228, oldH + 5);
      var r = newH - oldH;
      if (r > 0) {
        b.adultHeight = newH;
        var oldW = Number(b.wingspan) || newH;
        var newW = oldW + r;
        b.wingspan = newW;
        changes.push({ key: 'wingspan', label: '预计臂展', before: oldW, after: newW, gain: newW - oldW });
        ['rebounding', 'interiorD'].forEach(function (k) { bumpPot(k, Math.max(1, Math.round(r * 0.35))); });
        var over = Math.max(0, newH - 200) - Math.max(0, oldH - 200);
        if (over > 0) ['three', 'handling'].forEach(function (k) { bumpPot(k, -Math.max(1, Math.round(over * 0.3))); });
        changes.push({ key: 'adultHeight', label: '预计成年身高', before: oldH, after: newH, gain: r });
      }
    } else if (perkKey === 'talent') {
      // 篮球天赋：整体潜力上限提升
      SKILL_KEYS.forEach(function (k) { bumpPot(k, 6); });
      bumpPot('athleticism', 2);
    } else if (perkKey === 'starter') {
      // 篮球启蒙：早期教练环境与球感/球商潜力
      b.coach = Math.max(Number(b.coach) || 1, 1.10);
      ['handling', 'passing', 'iq'].forEach(function (k) { bumpPot(k, 3); });
      changes.push({ key: 'coach', label: '起步教练', before: 1, after: b.coach, gain: Math.round((b.coach - 1) * 100) / 100 });
    } else if (perkKey === 'health') {
      // 强健体魄：降低伤病倾向，提升健康与心情
      var oldPr = Number(b.injuryProne) || 40;
      var newPr = clamp(oldPr - 18, 5, 95);
      b.injuryProne = newPr;
      changes.push({ key: 'injuryProne', label: '伤病倾向', before: oldPr, after: newPr, gain: newPr - oldPr });
      var oldHp = Number(life.status.health) || 80;
      life.status.health = clamp(oldHp + 12, 40, 100);
      changes.push({ key: 'health', label: '健康', before: oldHp, after: life.status.health, gain: life.status.health - oldHp });
      var oldHap = Number(life.status.happiness) || 70;
      life.status.happiness = clamp(oldHap + 5, 0, 100);
      changes.push({ key: 'happiness', label: '心情', before: oldHap, after: life.status.happiness, gain: life.status.happiness - oldHap });
    } else if (perkKey === 'family') {
      // 殷实家境：提升家境档位与初始状态
      var oldQ = Number(life.quintile) || 3;
      life.quintile = clamp(oldQ + 1, 1, 5);
      changes.push({ key: 'quintile', label: '家境档位', before: oldQ, after: life.quintile, gain: life.quintile - oldQ });
      var oldFh = Number(life.status.health) || 80;
      life.status.health = clamp(oldFh + 4, 40, 100);
      changes.push({ key: 'health', label: '健康', before: oldFh, after: life.status.health, gain: life.status.health - oldFh });
      var oldFhap = Number(life.status.happiness) || 70;
      life.status.happiness = clamp(oldFhap + 4, 0, 100);
      changes.push({ key: 'happiness', label: '心情', before: oldFhap, after: life.status.happiness, gain: life.status.happiness - oldFhap });
    } else if (perkKey === 'discipline') {
      // 自律性格：提升自律与野心特质（同步出生基线副本，避免结局性格差值被算错）
      var oldD = Number(life.traits.discipline) || 50;
      life.traits.discipline = clamp(Math.round(oldD + 14), 5, 95);
      life.traitsAtBirth.discipline = life.traits.discipline;
      changes.push({ key: 'discipline', label: '自律', before: oldD, after: life.traits.discipline, gain: life.traits.discipline - oldD });
      var oldA = Number(life.traits.ambition) || 50;
      life.traits.ambition = clamp(Math.round(oldA + 4), 5, 95);
      life.traitsAtBirth.ambition = life.traits.ambition;
      changes.push({ key: 'ambition', label: '野心', before: oldA, after: life.traits.ambition, gain: life.traits.ambition - oldA });
    }
    return changes;
  }
  function settleBirthPerk(life, scope) {
    if (!life) return { scope: scope, keys: [], eligible: PERK_KEYS, changes: [] };
    var ci = scope.lastIndexOf(':');
    var prefix = ci >= 0 ? scope.slice(0, ci) : scope;
    var perkKey = ci >= 0 ? scope.slice(ci + 1) : scope;
    if (!life.mblBirthPerks || life.mblBirthPerks.scope !== prefix) {
      life.mblBirthPerks = { scope: prefix, keys: [], eligible: PERK_KEYS, changes: [] };
    }
    var changes = [];
    if (life.mblBirthPerks.keys.indexOf(perkKey) < 0) {
      life.mblBirthPerks.keys.push(perkKey);
      changes = applyBirthPerk(life, perkKey);
      life.mblBirthPerks.changes = life.mblBirthPerks.changes || [];
      life.mblBirthPerks.changes.push({ perk: perkKey, age: life.age, changes: changes });
    }
    life.mblBirthPerks.eligible = PERK_KEYS;
    return { scope: prefix, keys: [perkKey], eligible: PERK_KEYS, changes: changes };
  }
  // 按 key 定位并写回字段（与 applyBirthPerk 的修改位置一一对应）
  function setField(life, key, value) {
    var b = life.ball;
    if (b && b.potential && SKILL_KEYS.indexOf(key) >= 0) b.potential[key] = value;
    else if (key === 'adultHeight') b.adultHeight = value;
    else if (key === 'wingspan') b.wingspan = value;
    else if (key === 'coach') b.coach = value;
    else if (key === 'injuryProne') b.injuryProne = value;
    else if (key === 'health') life.status.health = value;
    else if (key === 'happiness') life.status.happiness = value;
    else if (key === 'quintile') life.quintile = value;
    else if (key === 'discipline') { life.traits.discipline = value; life.traitsAtBirth.discipline = value; }
    else if (key === 'ambition') { life.traits.ambition = value; life.traitsAtBirth.ambition = value; }
  }
  // 取消一项已点亮的出生加成：按记录的 before 值对称回退，并从 keys/changes 移除
  function revertBirthPerk(life, perkKey) {
    if (!life || !life.mblBirthPerks) return false;
    var bp = life.mblBirthPerks;
    if (bp.keys.indexOf(perkKey) < 0) return false;
    var recIdx = -1;
    for (var i = 0; i < bp.changes.length; i++) {
      if (bp.changes[i].perk === perkKey) { recIdx = i; break; }
    }
    if (recIdx >= 0) {
      var rec = bp.changes[recIdx];
      for (var c = rec.changes.length - 1; c >= 0; c--) {
        setField(life, rec.changes[c].key, rec.changes[c].before);
      }
      bp.changes.splice(recIdx, 1);
    }
    bp.keys = bp.keys.filter(function (k) { return k !== perkKey; });
    return true;
  }
  // 构造一条通过 adsMerge 校验的本地权益行
  function localEntitlement(target, scope, extra) {
    return Object.assign({
      id: 'local-' + target + '-' + scope,
      source: 'sdk_callback',
      target: target,
      scope: scope,
      consumed: false
    }, extra || {});
  }

  var shim = {
    __localShim: true,
    auth: {
      getUserInfo: function () {
        window.__SHIMLOG__.push('getUserInfo');
        return Promise.resolve(ok({
          islogin: 1, puid: USER.puid, nickname: USER.nickname,
          avatar: USER.avatar, userHeadUrl: USER.userHeadUrl
        }));
      }
    },
    cloud: {
      request: function (params) {
        window.__SHIMLOG__.push('request:' + (params.url || '').slice(0, 100));
        var url = params.url || '';
        var p = pathOf(url);
        var data = params.data || {};
        var target = data.target || '';
        var scope = data.scope || '';

        if (p.indexOf('/api/player/me') >= 0) {
          return Promise.resolve(ok({
            state: cloudStore.payload ? { revision: cloudStore.revision, payload: cloudStore.payload } : null,
            archiveMode: 'lazy-v1',
            saveProtocol: 'delta-v1',
            confirmProtocol: 'revision-v1',
            maxRequestBytes: 5 * 1024 * 1024,
            announcement: null,
            accountKey: 'local-account',
            adEntitlements: [],
            community: null,
            profile: { nickname: USER.nickname, avatar: '' },
            entitlements: [],
            autoEligible: true
          }));
        }
        if (p.indexOf('/api/player/sync') >= 0) {
          if (data && data.payload) cloudStore.payload = data.payload;
          cloudStore.revision += 1;
          return Promise.resolve(ok({
            revision: cloudStore.revision,
            community: { pending: false, published: 0 }
          }));
        }
        if (p.indexOf('/api/player/profile') >= 0) return Promise.resolve(ok({}));

        // 通行卡：本地视为已拥有（测试会员）
        if (p.indexOf('/api/player/pass/benefit') >= 0) {
          var life = currentLife();
          var rev = ++cloudStore.revision;
          var res = {
            source: 'operator_grant',
            state: { revision: rev, payload: { schema: 1, entries: snapshotEntries() } }
          };
          if (target === 'annual_training' && life) {
            var changes = settleAnnualTraining(life);
            res.state.payload.entries['mbl.current'] = JSON.stringify(life);
            res.result = { age: life.age, changes: changes };
          }
          if (target === 'birth_perk' && life) {
            res.perks = settleBirthPerk(life, scope);
            res.state.payload.entries['mbl.current'] = JSON.stringify(life);
            window.__SHIMLOG__.push('benefit birth_perk -> ' + JSON.stringify(res.perks) + ' lifeAge=' + life.age);
          }
          return Promise.resolve(ok(res));
        }
        if (p.indexOf('/api/player/pass') >= 0) {
          return Promise.resolve(ok({ owned: true, source: 'operator_grant', phase: 'owned' }));
        }

        // 激励广告权益系列：本地直接返回成功，不调用原生广告
        if (p.indexOf('/api/player/ads/intent') >= 0) {
          return Promise.resolve(ok({ intentId: 'local-intent-' + Date.now(), entitlement: null }));
        }
        if (p.indexOf('/api/player/ads/reward') >= 0) {
          var row = localEntitlement(target, scope);
          return Promise.resolve(ok({ entitlement: row }));
        }
        if (p.indexOf('/api/player/ads/use') >= 0) {
          return Promise.resolve(ok({ entitlement: localEntitlement(target, scope, { consumed: true, consumedOperationId: data.operationId }) }));
        }
        if (p.indexOf('/api/player/ads/training') >= 0) {
          var tlife = currentLife();
          var tchanges = settleAnnualTraining(tlife);
          var tentries = snapshotEntries();
          if (tlife) tentries['mbl.current'] = JSON.stringify(tlife);
          return Promise.resolve(ok({
            state: { revision: ++cloudStore.revision, payload: { schema: 1, entries: tentries } },
            result: { age: tlife && tlife.age, changes: tchanges }
          }));
        }
        if (p.indexOf('/api/player/ads/birth-perk') >= 0) {
          var blife = currentLife();
          var bperks = settleBirthPerk(blife, scope);
          var bentries = snapshotEntries();
          if (blife) bentries['mbl.current'] = JSON.stringify(blife);
          return Promise.resolve(ok({
            state: { revision: ++cloudStore.revision, payload: { schema: 1, entries: bentries } },
            perks: bperks
          }));
        }
        if (p.indexOf('/api/player/ads') >= 0) {
          return Promise.resolve(ok({ entitlements: [] }));
        }

        if (p.indexOf('/api/player/presence') >= 0) return Promise.resolve(ok({ online: false }));
        if (p.indexOf('/api/player/reports') >= 0) return Promise.resolve(ok({ rows: [] }));
        if (p.indexOf('/api/player/announcements') >= 0) return Promise.resolve(ok({}));
        if (p.indexOf('showcase/retry') >= 0) return Promise.resolve(ok({ pending: false, published: 0 }));
        if (p.indexOf('/api/player/birth-perks/prepare') >= 0) {
          var bscope = data && data.scope ? data.scope : '';
          // 本地单机：prepare 始终基于当前最新本地角色构造快照，
          // 避免重新自定义出生后，陈旧云端快照经 restore 回拉覆盖新选择。
          var prepLife = currentLife();
          var prepEntries = snapshotEntries();
          if (prepLife) prepEntries['mbl.current'] = JSON.stringify(prepLife);
          return Promise.resolve(ok({
            state: { revision: cloudStore.revision, payload: { schema: 1, entries: prepEntries } },
            perks: { scope: bscope, keys: [], eligible: PERK_KEYS }
          }));
        }
        if (url.indexOf('birth-perks') >= 0) return Promise.resolve(ok({}));
        if (p.indexOf('/api/lives') >= 0 || p.indexOf('/api/live') >= 0 || p.indexOf('/api/stats') >= 0) {
          return Promise.resolve(ok({ rows: [], list: [], cursor: '', ranking: [] }));
        }
        // 未识别的接口：返回空对象，避免阻断流程
        return Promise.resolve(ok({}));
      }
    },
    // 其它桥接能力的安全空实现
    navigate: function () { return Promise.resolve(); },
    navigateTo: function () { return Promise.resolve(); },
    openUrl: function () { return Promise.resolve(); },
    closeWebview: function () {},
    getNativeInfo: function () { return Promise.resolve({}); },
    getFullscreenSafeTop: function () { return 0; },
    bbs: { request: function () { return Promise.resolve(ok({})); } },
    game: {
      // 激励视频兜底：本地不弹原生广告，直接返回观看成功
      vatask: {
        completeRewardVideo: function () {
          return Promise.resolve({ code: 200, data: { rewarded: true } });
        }
      }
    }
  };

  // SDK 加载策略是 `window.ColorboxAI || ...`，但部分环境会异步覆盖 auth/cloud；
  // 这里用不可重写属性锁死，确保桩方法始终生效。
  function install() {
    window.ColorboxAI = shim;
    window.ShaperAI = shim;
    Object.defineProperty(window, 'ColorboxAI', { value: shim, writable: false, configurable: false });
    Object.defineProperty(window, 'ShaperAI', { value: shim, writable: false, configurable: false });
  }
  install();
  // 出生加成取消：已点亮卡片再次点击时，由 game.js 调用，做本地对称回退
  window.MBLRemoveBirthPerk = function (perkKey) {
    try {
      var life = window.de && window.de.life;
      if (!life) return false;
      var okr = revertBirthPerk(life, perkKey);
      if (okr) Nt.saveLife(life);
      return okr;
    } catch (_) { return false; }
  };
  // 本地单机没有真实云端：忽略滞后快照对当前人生的回拉，避免刚重随/新生成的角色被旧存档覆盖。
  function installRestoreGuard() {
    if (!window.MBLHost || typeof window.MBLHost.restore !== 'function') {
      return void setTimeout(installRestoreGuard, 50);
    }
    if (window.MBLHost.__restoreGuarded) return;
    var origRestore = window.MBLHost.restore.bind(window.MBLHost);
    window.MBLHost.__restoreGuarded = true;
    window.MBLHost.restore = async function (entries) {
      // 用户主动从存档槽位读取：由槽位管理器置标志放行，不做滞后回拉拦截。
      var explicit = window.__MBL_SLOT_RESTORE__ === true;
      window.__MBL_SLOT_RESTORE__ = false;
      try {
        if (!explicit) {
          var cur = window.de && window.de.life;
          var raw = entries && entries['mbl.current'];
          var inc = null;
          if (raw) { try { inc = JSON.parse(raw).seed; } catch (_) {} }
          if (cur && Number.isFinite(cur.seed) && inc != null && inc !== cur.seed) {
            window.__SHIMLOG__.push('restore skipped: local ' + cur.seed + ' remote ' + inc);
            return true;
          }
        }
      } catch (_) {}
      return origRestore(entries);
    };
  }

  // 兜底：若 SDK 稍后再次挂载，在 DOMContentLoaded 后复核一次
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  }
  installRestoreGuard();
  window.addEventListener('mbl:host-ready', installRestoreGuard);
})();
