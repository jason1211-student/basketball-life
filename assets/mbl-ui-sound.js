/* mbl-ui-sound.js：全局 UI 选项点击音效（键盘打字音，纯本地、不联网、不改任何结算）。
 * 内核点击入口 ER 只负责解锁 AudioContext，本身不发声，所以点选项没有确认反馈。
 * 这里用事件委托给「真实用户按下可交互元素」补一个很轻、很短的键盘敲击音：
 *   - 只响应 isTrusted 的真实按下，自动模拟里的 JS .click()（isTrusted=false）不会响；
 *   - 受音效开关 de.settings.sound 控制（与内核事件音效同一个开关，读本地 mbl.settings）；
 *   - 音乐开关 music 不影响它。
 * 独立 AudioContext 懒创建，会被 mbl-audio-tune 自动挂柔化链。 */
(function () {
  'use strict';
  if (window.MBLUiSound) return;
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  var SETTINGS_KEY = 'mbl.settings';

  // 可交互元素：原生控件 + 内核 data-act + 各外挂模块的选项/节点
  var INTERACTIVE = [
    'button', '[role="button"]', 'select',
    '[role="menuitem"]', '[role="menuitemcheckbox"]', '[role="tab"]', '[role="option"]',
    'a[href]', '[data-act]',
    '.bc-opt', '.mbl-qs-opt', '.mbl-dock-item', '.mbl-era-node'
  ].join(',');

  var ctx = null;

  function readSettings() {
    // 公共版设置被存档槽管理器收进 MBLMemoryStore（最终落在 mbl.slots.v1），
    // 直接读 localStorage 会拿不到，导致开关失效；优先 MBLMemoryStore，再回退 localStorage。
    try {
      var raw = null;
      if (window.MBLMemoryStore && window.MBLMemoryStore.getItem)
        raw = window.MBLMemoryStore.getItem(SETTINGS_KEY);
      if (raw == null) raw = window.localStorage.getItem(SETTINGS_KEY);
      return JSON.parse(raw || '{}') || {};
    } catch (e) { return {}; }
  }

  function sfxOn() {
    // 与内核一致：sound 仅在显式为 false 时关闭，缺省视为开。
    return readSettings().sound !== false;
  }

  function ensureCtx() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }

  // 合成一次键盘打字音：短促、无明显音高的机械噪声，模拟键帽敲击。
  function playClick() {
    if (!sfxOn()) return;
    var ac = ensureCtx();
    if (!ac) return;
    var t = ac.currentTime;

    // 一个快速衰减的短噪声脉冲：滤波决定它是清脆“嗒”还是触底“thock”
    function thock(dur, type, freq, q, gain) {
      var len = Math.max(1, Math.floor(ac.sampleRate * dur));
      var buf = ac.createBuffer(1, len, ac.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      }
      var src = ac.createBufferSource();
      src.buffer = buf;
      var fl = ac.createBiquadFilter();
      fl.type = type;
      fl.frequency.value = freq;
      if (q) fl.Q.value = q;
      var g = ac.createGain();
      g.gain.value = gain;
      src.connect(fl).connect(g).connect(ac.destination);
      src.start(t);
    }

    thock(0.016, 'highpass', 1800, null, 0.12);  // 高频“嗒”：键帽/轴体碰撞
    thock(0.026, 'bandpass', 950, 1.5, 0.07);     // 中频“thock”：键帽触底共鸣
  }

  function isUsable(el) {
    if (!el || el.disabled) return false;
    if (el.getAttribute && el.getAttribute('aria-disabled') === 'true') return false;
    if (el.offsetParent === null && el.getClientRects().length === 0) return false;
    return true;
  }

  function onPointerDown(ev) {
    // 只认真实用户按下：自动模拟/程序化 click 全部 isTrusted=false，天然不响。
    if (!ev.isTrusted) return;
    var el = ev.target && ev.target.closest ? ev.target.closest(INTERACTIVE) : null;
    if (!el || !isUsable(el)) return;
    playClick();
  }

  // pointerdown 比 click 更跟手；可交互元素严格限定，普通区域滑动不会误触。
  document.addEventListener('pointerdown', onPointerDown, true);

  window.MBLUiSound = {
    click: playClick,
    sfxOn: sfxOn
  };
})();
