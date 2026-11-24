/* 年度账单：把当前计划消费汇总成一张账单，一次结算。
 * 只读内核的 N8/IF，不改变结算规则；固定支出仍按原逻辑在年末处理。 */
(function () {
  'use strict';
  if (window.MBLBillPanel) return;
  var C = window.MBLCore;

  function money(v, life) {
    try { if (window.Zt) return Zt(v, life); } catch (e) {}
    return Math.round(Number(v) || 0);
  }

  function build() {
    var modal = document.querySelector('.modal.spend');
    if (!modal) return;
    var life = C.life();
    if (!life) return;
    if (modal.querySelector('.mbl-bill')) return;
    if (!window.N8 || !window.IF) return;

    var list = N8(life) || [];
    var queued = list.filter(function (item) { return item.queued && !item.byParents; });
    var total = queued.reduce(function (sum, item) { return sum + item.cost; }, 0);
    var cash = Number(life.money && life.money.cash) || 0;
    var left = cash - total;

    var sec = C.h('section', 'mbl-bill');
    sec.innerHTML =
      '<div class="mbl-bill-head"><b>年度账单</b><span>' + queued.length + ' 项待结算</span></div>' +
      '<div class="mbl-bill-rows">' +
        '<div><span>现金</span><b>' + money(cash, life) + '</b></div>' +
        '<div><span>计划消费</span><b>' + money(total, life) + '</b></div>' +
        '<div><span>结算后</span><b class="' + (left < 0 ? 'is-neg' : '') + '">' + money(left, life) + '</b></div>' +
      '</div>' +
      '<button type="button" class="mbl-bill-pay">结算全部计划消费</button>' +
      '<p class="mbl-bill-msg">只结算打勾的计划消费；住房、贷款等固定支出仍按原规则在年末处理。</p>';

    var button = sec.querySelector('.mbl-bill-pay');
    button.disabled = !queued.length;
    button.addEventListener('click', function () {
      if (button.disabled) return;
      button.disabled = true;
      var current = C.life();
      if (!current) return;
      var ids = (current.spendQueue || []).slice();
      var paid = 0;
      ids.forEach(function (id) {
        try { if (IF(current, id)) paid += 1; } catch (e) {}
      });
      if (current.spendQueue) delete current.spendQueue;
      sec.querySelector('.mbl-bill-msg').textContent = '已结算 ' + paid + ' 项。';
      try { if (window.mn) mn(); } catch (e) {}
    });

    var top = modal.querySelector('.modal-top');
    if (top && top.parentNode) top.parentNode.insertBefore(sec, top.nextSibling);
    else modal.prepend(sec);
  }

  C.onDom(build, 'play');
  C.onHeartbeat(build, 600);
  window.MBLBillPanel = { refresh: build };
})();
