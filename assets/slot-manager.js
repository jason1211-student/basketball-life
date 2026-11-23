/* 本地多存档：多个独立人生可并存，支持读取/覆盖/另存/删除/锁定。仅本地。 */
(function () {
  'use strict';
  if (window.MBLSlotManager) return;
  var C = window.MBLCore;

  var STORE_KEY = 'mbl.slots.v1';
  var MAX_SLOTS = 12;
  var COUNTRY_CN = {
    AR: '阿根廷', AU: '澳大利亚', BA: '波黑', BR: '巴西', CA: '加拿大', CN: '中国',
    DE: '德国', EG: '埃及', ES: '西班牙', FR: '法国', GB: '英国', GR: '希腊', HK: '中国香港',
    HR: '克罗地亚', ID: '印尼', IT: '意大利', JP: '日本', KR: '韩国', LB: '黎巴嫩',
    LT: '立陶宛', MY: '马来西亚', NG: '尼日利亚', NZ: '新西兰', PH: '菲律宾', PR: '波多黎各',
    RS: '塞尔维亚', SG: '新加坡', SI: '斯洛文尼亚', SN: '塞内加尔', TH: '泰国', TR: '土耳其',
    TW: '中国台湾', US: '美国', VE: '委内瑞拉', VN: '越南', MO: '中国澳门'
  };
  var ENTRY_KEYS = ['mbl.current', 'mbl.records', 'mbl.achievements', 'mbl.countries', 'mbl.settings', 'mbl.shared'];

  function countryName(code) { return COUNTRY_CN[code] || code || ''; }
  function uid() { return 'slot-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
  function fmtTime(ts) {
    if (!ts) return '';
    var d = new Date(ts), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  var lastError = '';
  var readError = '';
  var unreadableRaw = null;

  function loadStore() {
    try {
      unreadableRaw = localStorage.getItem(STORE_KEY);
      var arr = unreadableRaw === null ? [] : JSON.parse(unreadableRaw);
      if (!Array.isArray(arr) || arr.some(function (slot) {
        return !slot || typeof slot.slotId !== 'string' || !slot.entries || typeof slot.entries !== 'object';
      })) throw new Error('Invalid save list');
      unreadableRaw = null;
      return arr;
    } catch (_) {
      readError = '无法读取本地存档。原始数据已保留，可下载后备份。';
      return [];
    }
  }

  var slots = loadStore();

  function commit(next) {
    lastError = readError;
    if (readError) return false;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
      slots = next;
      return true;
    } catch (e) {
      lastError = e.name === 'QuotaExceededError' ? '浏览器存储空间不足，原存档已保留。' : '存档写入失败，原存档已保留。';
      return false;
    }
  }

  function replaceSlot(index, slot) {
    var next = slots.slice();
    next[index] = slot;
    return commit(next);
  }

  function pickTeam(life) {
    var b = life.ball || {};
    var t = (b.season && !b.season.staff && b.season.team) ||
            (b.pro && b.pro.team) ||
            (b.youth && b.youth.team) ||
            b.team;
    return t ? (C.teamName(t) || '') : '';
  }
  function stageOf(life) {
    var b = life.ball || {};
    if (life.alive === false) return '已完结';
    if (b.retiredFromPlaying) return life.career ? '退役转行' : '退役';
    if (b.pro) {
      var lg = b.pro.leagueId || '';
      if (lg === 'NBA') return 'NBA';
      if (lg === 'GLEAGUE') return '发展联盟';
      return '职业';
    }
    if (b.youth) return b.youth.level === 'high' ? '高中' : '青训/大学';
    if (life.inSchool) return (life.flags && life.flags.atUni) || life.education === 'university' || life.education === 'graduate' ? '大学' : '在读';
    if (life.career) return '工作';
    return '少年';
  }

  function summarize(entries) {
    var life = null;
    try { life = entries['mbl.current'] ? JSON.parse(entries['mbl.current']) : null; } catch (_) {}
    if (life && life.ball) {
      return {
        seed: life.seed,
        name: C.hans(life.name),
        country: life.country,
        countryCn: countryName(life.country),
        city: C.hans(life.city),
        age: life.age,
        alive: life.alive !== false,
        ended: life.alive === false,
        stage: stageOf(life),
        difficulty: life.difficulty === 'hard' ? 'hard' : 'normal',
        team: pickTeam(life),
        perks: (life.mblBirthPerks && life.mblBirthPerks.keys) || [],
        record: false
      };
    }
    var recs = [];
    try { recs = entries['mbl.records'] ? JSON.parse(entries['mbl.records']) : []; } catch (_) {}
    if (Array.isArray(recs) && recs.length) {
      var r = recs[0];
      return {
        seed: r.seed,
        name: typeof r.name === 'string' ? r.name : C.hans(r.name),
        country: r.code,
        countryCn: countryName(r.code),
        city: '', age: r.age, alive: false, ended: true, stage: '已完结',
        difficulty: 'normal', team: '', perks: [], record: true
      };
    }
    return { seed: null, name: '', country: '', countryCn: '', city: '', age: null, alive: false, ended: false, stage: '', empty: true, perks: [] };
  }

  function currentEntries() {
    var snap = window.MBLHost && window.MBLHost.snapshot ? window.MBLHost.snapshot() : null;
    var entries = (snap && snap.entries) || {};
    var out = {};
    ENTRY_KEYS.forEach(function (k) { out[k] = entries[k] != null ? entries[k] : null; });
    return out;
  }
  function find(id) { for (var i = 0; i < slots.length; i++) if (slots[i].slotId === id) return i; return -1; }

  function defaultName(s) {
    var who = s.name || s.countryCn || '新人生';
    var tag = s.ended ? '已完结' : (s.empty ? '空存档' : (s.age != null ? s.age + '岁' : '进行中'));
    return who + ' · ' + tag;
  }

  var Manager = {
    MAX: MAX_SLOTS,
    list: function () { return slots.slice(); },
    error: function () { return lastError || readError; },
    currentSeed: function () {
      try {
        var s = window.MBLHost.snapshot();
        var c = s && s.entries && s.entries['mbl.current'];
        return c ? JSON.parse(c).seed : null;
      } catch (_) { return null; }
    },
    saveCurrent: function (name) {
      if (slots.length >= MAX_SLOTS) { lastError = '存档已满（最多 ' + MAX_SLOTS + ' 个），请先删除不需要的。'; return null; }
      var entries = currentEntries();
      var s = summarize(entries);
      var slot = {
        slotId: uid(), name: name || defaultName(s),
        createdAt: Date.now(), updatedAt: Date.now(), locked: false,
        summary: s, entries: entries
      };
      return commit([slot].concat(slots)) ? slot : null;
    },
    overwrite: function (id) {
      var i = find(id); if (i < 0) return null;
      var entries = currentEntries();
      var summary = summarize(entries);
      var slot = Object.assign({}, slots[i], { entries: entries, summary: summary, updatedAt: Date.now() });
      if (!slot.customName) slot.name = defaultName(summary);
      return replaceSlot(i, slot) ? slot : null;
    },
    load: async function (id) {
      var i = find(id);
      if (i < 0 || !window.MBLHost || !window.MBLHost.restore) return false;
      window.__MBL_SLOT_RESTORE__ = true;
      await window.MBLHost.restore(slots[i].entries);
      i = find(id);
      if (i >= 0) replaceSlot(i, Object.assign({}, slots[i], { updatedAt: Date.now() }));
      return true;
    },
    remove: function (id) {
      var i = find(id);
      if (i < 0) return 'notfound';
      if (slots[i].locked) return 'locked';
      return commit(slots.filter(function (_, index) { return index !== i; })) ? 'ok' : 'error';
    },
    toggleLock: function (id) {
      var i = find(id); if (i < 0) return false;
      var slot = Object.assign({}, slots[i], { locked: !slots[i].locked });
      return replaceSlot(i, slot) ? slot.locked : null;
    },
    rename: function (id, name) {
      var i = find(id); if (i < 0) return false;
      name = String(name || '').trim();
      return name ? replaceSlot(i, Object.assign({}, slots[i], { name: name, customName: true })) : false;
    },
    importSlot: function (data) {
      try {
        if (data?.format === 'mbl-save') {
          if (data.version !== 1) throw new Error('Unsupported version');
          data = data.slot;
        }
        if (!data?.entries || typeof data.entries !== 'object') throw new Error('Missing entries');
        var entries = {};
        ENTRY_KEYS.forEach(function (key) {
          var value = data.entries[key] ?? null;
          if (value !== null) {
            if (typeof value !== 'string') throw new Error('Invalid entry type');
            JSON.parse(value);
          }
          entries[key] = value;
        });
        var life = JSON.parse(entries['mbl.current']);
        var records = JSON.parse(entries['mbl.records']);
        if (!(life?.ball && Number.isFinite(life.age) && Number.isFinite(life.seed))
          && !(life === null && Array.isArray(records) && records.length && records[0] && typeof records[0] === 'object')) {
          throw new Error('Invalid career');
        }
        if (slots.length >= MAX_SLOTS) {
          lastError = '本地存档已满，请先腾出一个位置。';
          return null;
        }
        var summary = summarize(entries);
        var slot = {
          slotId: uid(), entries: entries, summary: summary,
          name: typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 120) : defaultName(summary),
          createdAt: Date.now(), updatedAt: Date.now(), locked: false, customName: true
        };
        return commit([slot].concat(slots)) ? slot : null;
      } catch (_) {
        lastError = '备份格式或存档内容无效，无法导入。';
        return null;
      }
    }
  };
  window.MBLSlotManager = Manager;

  var make = C.h;

  var dialog = make('dialog', 'mbl-slot-modal');
  dialog.setAttribute('aria-labelledby', 'mbl-slot-title');
  var head = make('div', 'mbl-slot-head');
  var title = make('h2', '', '存档管理'); title.id = 'mbl-slot-title';
  var closeBtn = make('button', 'mbl-slot-close', '关闭'); closeBtn.type = 'button';
  head.append(title, closeBtn);
  var topBar = make('div', 'mbl-slot-topbar');
  var saveNewBtn = make('button', 'mbl-slot-primary', '保存当前进度到手动存档'); saveNewBtn.type = 'button';
  var msg = make('p', 'mbl-slot-message'); msg.setAttribute('role', 'status');
  var importBtn = make('button', 'mbl-slot-btn', '导入备份');
  var fileInput = make('input');
  fileInput.type = 'file'; fileInput.accept = '.json'; fileInput.hidden = true;
  importBtn.type = 'button';
  importBtn.onclick = function () { fileInput.click(); };
  fileInput.onchange = async function () {
    var file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    try {
      var slot = Manager.importSlot(JSON.parse(await file.text()));
      if (slot) { render(); setMsg('已导入为独立存档：' + slot.name); }
      else setMsg(Manager.error(), true);
    } catch (_) { setMsg('无法读取备份文件。', true); }
  };
  var rawBtn = make('button', 'mbl-slot-btn', '下载原始存档数据');
  rawBtn.type = 'button'; rawBtn.hidden = unreadableRaw === null;
  rawBtn.onclick = function () { download(unreadableRaw, 'MBL-save-recovery.json'); };
  topBar.append(saveNewBtn, importBtn, fileInput, rawBtn, msg);

  function download(text, name) {
    var url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    var link = make('a');
    link.href = url; link.download = name;
    document.body.append(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportButton(slot) {
    var button = make('button', 'mbl-slot-btn', '导出备份');
    button.type = 'button';
    button.onclick = function () {
      download(JSON.stringify({ format: 'mbl-save', version: 1, slot: slot }), 'MBL-' + slot.slotId + '.json');
    };
    return button;
  }

  // 两个分区：AUTO 当前人生 + 手动存档
  var autoSection = make('div', 'mbl-slot-section');
  var autoHead = make('h3', 'mbl-slot-section-title', '当前人生（自动保存）');
  var autoList = make('div', 'mbl-slot-list');
  autoSection.append(autoHead, autoList);

  var manualSection = make('div', 'mbl-slot-section');
  var manualHead = make('h3', 'mbl-slot-section-title', '手动存档');
  var emptyTip = make('p', 'mbl-slot-muted mbl-slot-empty', '还没有手动存档。点上方按钮可把当前人生另存为一个独立存档。');
  var manualList = make('div', 'mbl-slot-list');
  manualSection.append(manualHead, emptyTip, manualList);

  dialog.append(head, topBar, autoSection, manualSection);
  document.body.append(dialog);

  function setMsg(text, isErr) {
    msg.textContent = text || '';
    msg.classList.toggle('is-err', !!isErr);
  }

  function statusText(s) {
    if (s.empty) return '空存档';
    if (s.ended) return '已完结';
    var st = s.stage || '进行中';
    return st + (s.age != null ? ' · ' + s.age + '岁' : '');
  }
  function summaryLine(s) {
    var parts = [];
    var loc = [s.countryCn, s.city].filter(Boolean).join(' · ');
    if (loc) parts.push(loc);
    if (s.team) parts.push(s.team);
    if (s.difficulty === 'hard') parts.push('困难');
    return parts.join('　');
  }

  // 单张卡片；isAuto 时只展示、用实时摘要、不提供删除
  function buildCard(slot, displaySummary, isAuto) {
    var card = make('div', 'mbl-slot-card' + (isAuto ? ' is-auto' : ''));
    var left = make('div', 'mbl-slot-main');
    var nameRow = make('div', 'mbl-slot-name-row');
    nameRow.append(make('b', 'mbl-slot-name', isAuto ? defaultName(displaySummary) : (slot.name || '未命名存档')));
    if (isAuto) nameRow.append(make('span', 'mbl-slot-auto-tag', 'AUTO'));
    if (slot.locked) nameRow.append(make('span', 'mbl-slot-lock', '已保留'));
    left.append(
      nameRow,
      make('div', 'mbl-slot-summary', summaryLine(displaySummary) || '—'),
      make('div', 'mbl-slot-meta', statusText(displaySummary) + '　·　更新于 ' + fmtTime(slot.updatedAt))
    );
    card.append(left);

    if (isAuto) { card.append(exportButton(slot)); return card; } // AUTO 槽由系统自动覆盖，无操作按钮

    var actions = make('div', 'mbl-slot-actions');
    var loadBtn = make('button', 'mbl-slot-btn', '读取');
    var ovBtn = make('button', 'mbl-slot-btn', '覆盖当前');
    var lockBtn = make('button', 'mbl-slot-btn', slot.locked ? '解除保留' : '锁定保留');
    var renBtn = make('button', 'mbl-slot-btn', '重命名');
    var delBtn = make('button', 'mbl-slot-btn mbl-slot-danger', '删除');
    loadBtn.type = ovBtn.type = lockBtn.type = renBtn.type = delBtn.type = 'button';
    if (slot.locked) { delBtn.disabled = true; delBtn.title = '已锁定保留，先解除再删除'; }

    loadBtn.onclick = async function () {
      loadBtn.disabled = true;
      try {
        if (await Manager.load(slot.slotId)) { setMsg('已读取存档：' + slot.name); setTimeout(render, 120); }
        else setMsg('读取失败，请重试。', true);
      } catch (e) { setMsg('读取失败：' + (e.message || e), true); }
      finally { loadBtn.disabled = false; }
    };
    ovBtn.onclick = function () {
      if (Manager.overwrite(slot.slotId)) { setMsg('已覆盖：' + slot.name); render(); }
      else setMsg(Manager.error() || '覆盖失败。', true);
    };
    lockBtn.onclick = function () {
      var locked = Manager.toggleLock(slot.slotId);
      if (locked === null) { setMsg(Manager.error(), true); return; }
      setMsg(locked ? '已锁定保留。' : '已解除保留。'); render();
    };
    renBtn.onclick = function () {
      var v = window.prompt('存档名称：', slot.name);
      if (v != null) { if (Manager.rename(slot.slotId, v)) render(); else if (Manager.error()) setMsg(Manager.error(), true); }
    };
    delBtn.onclick = function () {
      if (slot.locked) { setMsg('该存档已锁定，不能删除。', true); return; }
      if (!window.confirm('确定删除存档「' + (slot.name || '未命名') + '」吗？删除后不可恢复。')) return;
      var result = Manager.remove(slot.slotId);
      if (result === 'error') setMsg(Manager.error(), true);
      if (result === 'ok') { setMsg('已删除存档。'); render(); }
    };
    actions.append(loadBtn, ovBtn, lockBtn, renBtn, delBtn, exportButton(slot));
    card.append(actions);
    return card;
  }

  function render() {
    autoList.replaceChildren();
    manualList.replaceChildren();

    // 当前活跃槽：实时重算摘要（不写盘），保证年龄与游戏内一致
    var activeId = window.MBLAutoSave && window.MBLAutoSave.activeId();
    var active = activeId ? slots[find(activeId)] : null;
    autoSection.hidden = !active;
    if (active) autoList.append(buildCard(active, summarize(currentEntries()), true));

    var manual = slots.filter(function (s) { return s.slotId !== activeId; });
    emptyTip.hidden = manual.length > 0;
    manualSection.hidden = false;
    manual.forEach(function (s) {
      manualList.append(buildCard(s, s.summary?.stage == null ? summarize(s.entries) : s.summary, false));
    });
  }

  saveNewBtn.onclick = function () {
    var slot = Manager.saveCurrent();
    if (slot) { setMsg('已另存为手动存档：' + slot.name); render(); }
    else setMsg(Manager.error() || '保存失败。', true);
  };
  closeBtn.onclick = function () { dialog.close(); };
  dialog.addEventListener('close', function () { setMsg(''); });

  function openPanel() {
    render();
    if (Manager.error()) setMsg(Manager.error(), true);
    if (!dialog.open) dialog.showModal();
  }

  // 入口：首页顶栏（游玩中通过更多菜单进入）
  var homeEntry = make('button', 'ghost small mbl-slot-entry', '存档');
  homeEntry.type = 'button'; homeEntry.setAttribute('aria-label', '打开存档管理');
  homeEntry.onclick = openPanel;

  function mount() {
    var header = document.querySelector('main.home .topbar .topright');
    if (header && !header.contains(homeEntry)) {
      var member = header.querySelector('.mbl-member-entry');
      if (member && member.nextSibling) header.insertBefore(homeEntry, member.nextSibling);
      else header.append(homeEntry);
    }
  }
  C.onDom(mount);
  mount();

  window.MBLSlotPanel = { open: openPanel, refresh: render };

  // 启动默认：当前人生为空时，自动读取最近一次保存的存档（每次页面加载只尝试一次）
  function currentIsEmpty() {
    var life = window.de && window.de.life;
    if (!life) return true;
    return life.age === 0 && (!life.log || !life.log.length);
  }
  function latestSlot() {
    var candidates = slots.filter(function (s) {
      return s.entries && s.entries['mbl.current'] && s.summary && !s.summary.empty;
    });
    if (!candidates.length) return null;
    candidates.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    return candidates[0];
  }
  async function autoRestoreLatest() {
    if (window.__MBL_AUTO_RESTORE_TRIED__) return;
    window.__MBL_AUTO_RESTORE_TRIED__ = true;
    if (!currentIsEmpty()) return;
    var slot = latestSlot();
    if (!slot || !window.MBLHost || !window.MBLHost.restore) return;
    try {
      window.__MBL_SLOT_RESTORE__ = true;
      await window.MBLHost.restore(slot.entries);
      replaceSlot(find(slot.slotId), Object.assign({}, slot, { updatedAt: Date.now() }));
      if (window.mn) mn();
    } catch (e) { console.warn('自动读取最近存档失败', e); }
  }
  function bootWatch() {
    if (window.MBLHost && window.de) autoRestoreLatest();
    else setTimeout(bootWatch, 80);
  }
  bootWatch();
})();
