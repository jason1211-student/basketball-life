/* 货币单位：美元 / 人民币切换（纯本地，仅显示层换算，不改内部数值与结算）。
 * 内部金额一律以美元存储；选人民币时按固定汇率在显示时换算，偏好持久化到本机。 */
(function () {
  'use strict';
  if (window.MBLCurrency) return;

  var KEY = 'mbl.currency.v1';
  var RATE = 6.6714;   // 1 美元 = 6.6714 人民币（2026-11-21 在岸即期，新浪财经）
  var UNITS = { USD: { sym: 'US$', cny: false }, CNY: { sym: '￥', cny: true } };

  var unit = 'USD';
  try { if (localStorage.getItem(KEY) === 'CNY') unit = 'CNY'; } catch (_) {}

  function set(u) {
    if (!UNITS[u] || u === unit) return;
    unit = u;
    try { localStorage.setItem(KEY, u); } catch (_) {}
    window.dispatchEvent(new CustomEvent('mbl:currency-changed'));
  }
  function toggle() { set(unit === 'USD' ? 'CNY' : 'USD'); }

  // 统一金额格式化：value 为内部美元数值，lang 决定千分位/紧凑数字的地区格式
  function format(value, lang) {
    var amount = Number(value) || 0;
    var shown = UNITS[unit].cny ? amount * RATE : amount;
    var locale = lang === 'en' ? 'en-US' : lang === 'zh-Hans' ? 'zh-CN' : 'zh-TW';
    var digits = new Intl.NumberFormat(locale, {
      notation: Math.abs(shown) >= 1e4 ? 'compact' : 'standard',
      maximumFractionDigits: Math.abs(shown) >= 1e4 ? 1 : 0
    }).format(Math.abs(shown));
    return (amount < 0 ? '−' : '') + UNITS[unit].sym + digits;
  }

  function label() { return unit === 'USD' ? '美元' : '人民币'; }

  window.MBLCurrency = { get: function () { return unit; }, set: set, toggle: toggle,
    format: format, label: label, RATE: RATE };
})();
