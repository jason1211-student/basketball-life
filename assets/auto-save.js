/* 自动保存：新人生绑定一个存档，状态变化防抖写回，退出/隐藏时立即落盘。仅本地。 */
(function () {
  'use strict';
  if (window.MBLAutoSave) return;
  var C = window.MBLCore;
  var make = C.h;
  var ACTIVE_KEY = 'mbl.active-slot.v1';
  var DEBOUNCE_MS = 1500;

  var activeSlotId = '';
  try { activeSlotId = localStorage.getItem(ACTIVE_KEY) || ''; } catch (_) {}

  function getActiveSlot() {
    var list = window.MBLSlotManager.list();
    for (var i = 0; i < list.length; i++)
      if (list[i].slotId === activeSlotId) return list[i];
    return null;
  }
  function bind(slotId) {
    activeSlotId = slotId || '';
    try {
      if (activeSlotId) localStorage.setItem(ACTIVE_KEY, activeSlotId);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch (_) {}
  }

  function ensureForCurrent() {
    var life = C.life();
    if (!life || !life.ball) return null;
    var active = getActiveSlot();
    if (active && active.summary && active.summary.seed === life.seed) return active;
    var list = window.MBLSlotManager.list();
    for (var i = 0; i < list.length; i++) {
      if (list[i].summary && list[i].summary.seed === life.seed) { bind(list[i].slotId); return list[i]; }
    }
    var ns = window.MBLSlotManager.saveCurrent();
    if (ns) { bind(ns.slotId); toast('已建立存档，之后会自动保存。'); }
    return ns;
  }

  function saveNow() {
    var life = C.life();
    if (!life || !life.ball) return false;
    var slot = ensureForCurrent();
    if (!slot) { failedSeed=life.seed;showSaveFailure(); return false; }
    if (window.MBLSlotManager.overwrite(slot.slotId, {skipUnchanged:true})) { failedSeed=null;markSaved(); return true; }
    failedSeed=life.seed;showSaveFailure();
    return false;
  }

  var timer = null;
  var failedSeed = null;
  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { timer = null; saveNow(); }, DEBOUNCE_MS);
  }
  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    try { saveNow(); } catch (_) {}
  }

  // 出生/重随：捕获阶段，不阻止原点击
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-act="born"]');
    if (!btn) return;
    var isReroll = C.screen() === 'birth';
    var keepSlotId = activeSlotId;
    setTimeout(function () {
      if (isReroll) {
        if (keepSlotId && window.MBLSlotManager.list().some(function (s) { return s.slotId === keepSlotId; })) {
          bind(keepSlotId);
          window.MBLSlotManager.overwrite(keepSlotId);
        } else {
          var ns = ensureForCurrent();
          if (ns) window.MBLSlotManager.overwrite(ns.slotId);
        }
      } else {
        var s = ensureForCurrent();
        if (s) toast('已建立存档，之后会自动保存。');
      }
    }, 0);
  }, true);

  window.addEventListener('mbl:state-changed', schedule);
  window.addEventListener('mbl:birth-started', function () { setTimeout(saveNow, 0); });

  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });
  // 任何返回标题的点击：捕获阶段先落盘
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-act="leave"]')) flush();
  }, true);

  // 读档后同步活跃存档
  var origLoad = window.MBLSlotManager.load;
  window.MBLSlotManager.load = async function (id) {
    var ok = await origLoad(id);
    if (ok) bind(id);
    return ok;
  };

  var toastEl = make('div', 'mbl-autosave-toast');
  toastEl.hidden = true;
  document.body.append(toastEl);
  var toastTimer = null;
  function toast(text) {
    // 弹窗/更多菜单展开时不弹保存提示，避免盖住按钮与正文
    if (document.querySelector('dialog[open], .more .menu')) { toastEl.hidden = true; return; }
    toastEl.textContent = text;
    toastEl.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2200);
  }
  var previousError = '';
  function showSaveFailure() {
    var error = window.MBLSlotManager.error();
    if (error && error !== previousError) {
      toast(error);
      if (!toastEl.hidden) previousError = error;
    }
  }
  function markSaved() {
    previousError = '';
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    toast('已自动保存 ' + p(d.getHours()) + ':' + p(d.getMinutes()));
  }

  // 菜单/弹窗弹出时，若提示仍在显示则立即收起，避免压住内容
  C.onDom(function () {
    if (document.querySelector('dialog[open], .more .menu')) toastEl.hidden = true;
  });

  window.MBLAutoSave = {
    save: saveNow,
    readyForMatch: function(life){return failedSeed!==life.seed || saveNow();},
    flush: flush,
    activeId: function () { return activeSlotId; }
  };
})();
