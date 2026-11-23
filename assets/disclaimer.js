/* 免责声明：打开网址最先弹出，确认后才进入首屏登录门。每次打开都展示，合规留痕。 */
(function () {
  'use strict';
  if (window.MBLDisclaimer) return;
  var C = window.MBLCore;
  var make = C.h;

  var overlay = make('div');
  overlay.id = 'mbl-disclaimer';
  var card = make('div', 'mbl-dc-card');
  card.append(make('h2', '', '免责声明'));
  card.append(make('p', '', '本项目仅供学习交流，非商业盈利。'));
  card.append(make('p', 'mbl-dc-note', '本版本为公共版，已关闭登录，只能本地游玩，存档仅保存在本机，清理浏览器缓存可能导致进度丢失。'));
  var ok = make('button', 'mbl-dc-ok', '我知道了');
  ok.type = 'button';
  card.append(ok);
  overlay.append(card);
  document.body.append(overlay);

  ok.onclick = function () {
    overlay.hidden = true;
    document.dispatchEvent(new CustomEvent('mbl:disclaimer-accepted'));
  };

  window.MBLDisclaimer = {
    shown: function () { return !overlay.hidden; }
  };
})();
