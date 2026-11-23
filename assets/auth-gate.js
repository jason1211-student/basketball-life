/* 公共版首屏门：公共版本已关闭登录，不初始化 CloudBase、不提供登录/注册视图。
 * 免责声明确认后直接以离线模式进入，存档只走本地 localStorage。
 * 保留 #mbl-auth-gate 与 MBLAuthGate 接口，便于其它模块与测试按原约定判断门已放行。 */
(function () {
  'use strict';
  if (window.MBLAuthGate) return;
  var C = window.MBLCore;
  var make = C.h;

  var mode = ''; // 公共版只会是 'offline'
  var gate = make('div');
  gate.id = 'mbl-auth-gate';
  gate.hidden = true; // 公共版从不展示选择门
  document.body.append(gate);

  function enter() {
    if (mode) return;
    mode = 'offline';
    gate.hidden = true;
    document.dispatchEvent(new CustomEvent('mbl:gate-passed', { detail: { mode: 'offline' } }));
  }

  function disclaimerAccepted() {
    // 免责声明模块存在且当前已不显示，即视为已确认
    var d = document.querySelector('#mbl-disclaimer');
    return !!d && d.hidden === true;
  }

  // 正常路径：免责声明点“我知道了”后放行
  document.addEventListener('mbl:disclaimer-accepted', enter);

  // 兜底：若免责声明已确认（事件先于本模块绑定），直接放行
  if (disclaimerAccepted()) enter();
  else setTimeout(function () { if (disclaimerAccepted()) enter(); }, 0);

  window.MBLAuthGate = {
    mode: function () { return mode; },
    reopen: function () { /* 公共版不允许重新打开登录门 */ }
  };
})();
