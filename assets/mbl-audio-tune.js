/* mbl-audio-tune.js：音频统一柔化层（纯本地、不联网、不改任何结算）。
 * 内核所有声音都用 Web Audio 程序化合成，且普遍直接 connect 到 destination，
 * 锯齿波/方波偏多、增益偏高，齐奏时容易显得吵、刺耳、机械。
 * 这里在不逐个改内核函数的前提下，做三件事：
 *   1) 给每个 AudioContext 挂一条主链：masterGain(统一降音量) -> 低通(削高频毛刺) -> destination；
 *      劫持 AudioNode.connect，凡是直连 destination 的声音改走主链，节点之间的内部连接保持不变；
 *   2) 劫持 createOscillator：把刺耳的 sawtooth/square 换成柔和的 triangle，sine 保留；
 *   3) 给每个振荡器加一点点随机走音(detune)，减少多音齐奏的电子机械感，更像真人演奏。
 * 静音仍完全由内核 de.settings.sound 控制，本模块不改变开关语义。 */
(function () {
  'use strict';
  if (window.MBLAudioTune) return;
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || !window.AudioNode || !window.OscillatorNode) return;

  var TUNE = {
    masterVolume: 0.55,   // 全局再压一档音量
    lowpassFreq: 10500,   // 主低通截止频率，削掉锯齿波最扎耳的高频
    lowpassQ: 0.4,
    detuneCents: 6,       // 随机走音范围 ±6 音分
    soften: { sawtooth: 'triangle', square: 'triangle' }
  };

  var origConnect = window.AudioNode.prototype.connect;
  var origCreateOsc = AC.prototype.createOscillator;
  var typeDesc = Object.getOwnPropertyDescriptor(window.OscillatorNode.prototype, 'type');

  function setupContext(ctx) {
    if (ctx.__mblChain) return ctx.__mblChain;

    var master = ctx.createGain();
    master.gain.value = TUNE.masterVolume;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = TUNE.lowpassFreq;
    lp.Q.value = TUNE.lowpassQ;

    // 内部链用原始 connect 建立，避免被自己的劫持再次重定向
    origConnect.call(master, lp);
    origConnect.call(lp, ctx.destination);

    var chain = { master: master, lp: lp };
    ctx.__mblChain = chain;
    return chain;
  }

  // 劫持 connect：直连 destination 的声音统一改走 master 链；其余连接原样透传
  window.AudioNode.prototype.connect = function (dest) {
    var ctx = this.context;
    if (dest === ctx.destination && ctx.__mblChain) {
      var args = [ctx.__mblChain.master];
      for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
      return origConnect.apply(this, args);
    }
    return origConnect.apply(this, arguments);
  };

  // 劫持振荡器：柔化波形 + 轻微随机走音
  AC.prototype.createOscillator = function () {
    var osc = origCreateOsc.apply(this, arguments);
    var wanted = 'sine';
    try {
      Object.defineProperty(osc, 'type', {
        configurable: true,
        get: function () { return wanted; },
        set: function (v) {
          wanted = TUNE.soften[v] || v;
          typeDesc.set.call(osc, wanted);
        }
      });
    } catch (e) { /* 极端环境下退化为默认行为 */ }
    try {
      osc.detune.value = (Math.random() * 2 - 1) * TUNE.detuneCents;
    } catch (e) {}
    return osc;
  };

  // 劫持 AudioContext 构造：实例一创建就挂好主链（覆盖 new AudioContext 与 webkit 前缀）
  function patchConstructor(Ctor) {
    if (!Ctor || Ctor.__mblPatched) return;
    var Patched = function () {
      var ctx = new (Function.prototype.bind.apply(Ctor,
        [null].concat([].slice.call(arguments))))();
      setupContext(ctx);
      return ctx;
    };
    Patched.prototype = Ctor.prototype;
    Patched.__mblPatched = true;
    return Patched;
  }

  var NewAC = patchConstructor(AC);
  if (NewAC) {
    if (window.AudioContext) window.AudioContext = NewAC;
    if (window.webkitAudioContext) window.webkitAudioContext = NewAC;
  }

  // 兜底：若 AudioContext 在本模块之前已被内核创建（mw 已存在），直接补挂
  // 内核把实例保存在闭包内无法直接访问，这里通过 jo 的首次调用自然命中构造劫持；
  // 此分支仅为防御未来通过其他方式提前创建的情况。
  window.MBLAudioTune = {
    tune: TUNE,
    setup: setupContext
  };
})();
