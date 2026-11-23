/* 通用确认弹窗：属性加点、随机特训等立即生效操作前的二次确认。
   MBLConfirm.open({title, message, confirmText, cancelText}) -> Promise<boolean>。
   元素工厂复用公共底座 MBLCore.h。 */
(function () {
  'use strict';
  if (window.MBLConfirm) return;
  var C = window.MBLCore;

  var dialog = C.h('dialog', 'mbl-confirm-modal');
  var box = C.h('div', 'mbl-confirm-box');
  var titleEl = C.h('h3', 'mbl-confirm-title');
  var msgEl = C.h('p', 'mbl-confirm-message');
  var btnRow = C.h('div', 'mbl-confirm-btns');
  var cancelBtn = C.h('button', 'mbl-confirm-cancel'); cancelBtn.type = 'button';
  var okBtn = C.h('button', 'mbl-confirm-ok primary'); okBtn.type = 'button';
  btnRow.append(cancelBtn, okBtn);
  box.append(titleEl, msgEl, btnRow);
  dialog.append(box);
  document.body.append(dialog);

  var resolver = null;

  function settle(v) {
    if (!dialog.open) return;
    dialog.close();
    var r = resolver; resolver = null;
    if (r) r(v);
  }

  okBtn.onclick = function () { settle(true); };
  cancelBtn.onclick = function () { settle(false); };
  dialog.addEventListener('cancel', function (e) { e.preventDefault(); settle(false); });
  dialog.addEventListener('click', function (e) { if (e.target === dialog) settle(false); });

  function open(opts) {
    opts = opts || {};
    if (dialog.open && resolver) { var r = resolver; resolver = null; r(false); }
    titleEl.textContent = opts.title || '请确认';
    msgEl.textContent = opts.message || '';
    okBtn.textContent = opts.confirmText || '确认';
    cancelBtn.textContent = opts.cancelText || '取消';
    return new Promise(function (resolve) {
      resolver = resolve;
      if (!dialog.open) dialog.showModal();
    });
  }

  window.MBLConfirm = { open: open };
})();
