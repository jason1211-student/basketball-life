/* Paid benefits only. Normal game access and original simulation stay unchanged. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MBLGamePass = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var SDK_URL = 'https://activity-static.hoopchina.com.cn/files/261023-mmlz8brc-upload-1792721709171-27.js';
  var NAMES = {1: '日卡', 2: '周卡', 3: '月卡'};
  function cardName(type) { return NAMES[type] || '档位 ' + type; }
  function yuan(amount) { return String(Number((amount / 100).toFixed(2))); }
  function loadSDK(win, doc) {
    if(win.MBLPlatformConfig?.releaseEnabled===false)return Promise.reject(new Error("本地候选尚未开放通行卡连接。"));
    return new Promise(function (resolve, reject) {
      var script = doc.createElement('script');
      script.src = SDK_URL + '?t=' + Math.floor(Date.now() / 60000);
      script.onload = function () {
        if (!win.VaFuSDK) reject(new Error('通行卡服务暂不可用，请重试。'));
        else resolve(win.VaFuSDK);
      };
      script.onerror = function () { script.remove(); reject(new Error('加载失败，请刷新重试')); };
      doc.head.appendChild(script);
    });
  }
  function create(options) {
    if (!options || typeof options.sdk !== 'function') throw new Error('SDK loader required');
    var enabled = options.payWays || ['wechat', 'alipay'];
    if (!enabled.length || enabled.some(function (p) { return p !== 'wechat' && p !== 'alipay'; })) throw new Error('Invalid pay ways');
    enabled = enabled.filter(function (p, i, list) { return list.indexOf(p) === i; });
    var state = {phase: 'idle', owned: false, source: null, configs: [], selectedCardType: null, payWay: enabled[0], purchasing: false, message: '', pass: null};
    var listeners = [], sdkFlight = null, refreshFlight = null, epoch = 0, disposed = false, visibilityReady = false;
    function snapshot() {
      return Object.assign({}, state, {configs: state.configs.map(function (c) { return Object.assign({}, c); }), payWays: enabled.slice(), pass: state.pass && Object.assign({}, state.pass)});
    }
    function emit() { if (!disposed) listeners.slice().forEach(function (f) { f(snapshot()); }); }
    function sdk() {
      if (!sdkFlight) sdkFlight = Promise.resolve().then(options.sdk).then(function (bridge) {
        // As in example: register return-to-page refresh only after SDK onload.
        if (options.document && !visibilityReady && !disposed) {
          options.document.addEventListener('visibilitychange', onVisible);
          visibilityReady = true;
        }
        return bridge;
      }).catch(function (e) { sdkFlight = null; throw e; });
      return sdkFlight;
    }
    function onVisible() { if (options.document.visibilityState === 'visible' && !state.purchasing) refresh(); }
    function selected() { return state.configs.find(function (c) { return c.cardType === state.selectedCardType; }); }
    function showError(message) { state.phase = 'error'; state.owned = false; state.source = null; state.pass = null; state.configs = []; state.selectedCardType = null; state.message = message; emit(); }
    function toast(message) { state.message = message || ''; emit(); }
    function stale(token) { return token !== epoch || disposed; }
    async function showOwnedState(bridge, token) {
      state.owned = true; state.source = 'game_pass_sdk'; state.phase = 'owned'; state.configs = []; state.selectedCardType = null; emit();
      await current(bridge, token);
    }
    async function current(bridge, token) {
      try {
        var result = await bridge.getCurrentGamePass();
        if (token !== epoch || disposed || !state.owned) return;
        // Metadata only; never use client time or this result to grant access.
        state.pass = result && result.ok && result.pass && typeof result.pass.endTime === 'string' ? {
          cardType: result.pass.cardType, endTime: result.pass.endTime
        } : null;
        emit();
      } catch (_) { /* Ownership remains determined by checkGamePass/purchase only. */ }
    }
    // Ported from assets/game-pass-example.html. Extra guards only discard
    // stale account/disposal responses; they never supply ownership or tiers.
    async function initGamePass(VaFuSDK, token) {
      var logged = await VaFuSDK.getIsLogin();
      if (stale(token)) return;
      if (!logged) {
        await showPurchaseEntry(VaFuSDK, token);
        return;
      }
      var pass = await VaFuSDK.checkGamePass();
      if (stale(token)) return;
      if (!pass || !pass.ok) {
        showError(pass && pass.message || '暂时无法确认通行卡，请重试。');
        return;
      }
      if (pass.owned) {
        await showOwnedState(VaFuSDK, token);
      } else {
        await showPurchaseEntry(VaFuSDK, token);
      }
    }
    async function showPurchaseEntry(VaFuSDK, token) {
      var result = await VaFuSDK.getGamePayConfigs();
      if (stale(token)) return;
      if (!result || !result.ok) {
        showError(result && result.message || '通行卡档位读取失败，请重试。');
        return;
      }
      if (!Array.isArray(result.payConfigs) || result.payConfigs.some(function (c) { return !c || !Number.isSafeInteger(c.cardType) || c.cardType <= 0 || !Number.isSafeInteger(c.amount) || c.amount < 0; })) {
        showError('通行卡档位数据异常，请重试。');
        return;
      }
      if (result.payConfigs.length === 0) {
        showError('暂无可购买的档位');
        return;
      }
      state.configs = result.payConfigs;
      if (!selected()) state.selectedCardType = state.configs[0].cardType;
      state.phase = 'purchase'; state.message = ''; emit();
    }
    async function refresh() {
      if (disposed || state.purchasing) return snapshot();
      if (refreshFlight) return refreshFlight;
      var token = ++epoch;
      state.phase = 'loading'; state.owned = false; state.source = null; state.pass = null; state.message = ''; emit();
      var flight = (async function () {
        try {
          var bridge = await sdk();
          if(stale(token))return snapshot();
          if(typeof options.testPass==='function'){
            var testPass=null;
            try{testPass=await options.testPass();}catch(_){/* A failed test lookup never grants access or replaces official paid ownership. */}
            if(stale(token))return snapshot();
            if(testPass&&testPass.owned===true&&testPass.source==='operator_grant'&&testPass.pass&&typeof testPass.pass.endTime==='string'){
              state.owned=true;state.source='operator_grant';state.phase='owned';state.configs=[];state.selectedCardType=null;state.pass={cardType:testPass.pass.cardType,endTime:testPass.pass.endTime};state.message='测试会员权益已生效';emit();return snapshot();
            }
          }
          if (!stale(token)) await initGamePass(bridge, token);
        } catch (e) { if (!stale(token)) showError(e.message || '加载失败，请刷新重试'); }
        return snapshot();
      })();
      refreshFlight = flight;
      try { return await flight; } finally { if (refreshFlight === flight) refreshFlight = null; }
    }
    async function onBuyClick() {
      var config = selected();
      if (disposed || state.purchasing || state.phase !== 'purchase' || !config) return snapshot();
      var token = ++epoch, payWay = state.payWay;
      refreshFlight = null; state.purchasing = true; state.message = ''; emit();
      try {
        var bridge = await sdk();
        if (!(await bridge.checkLogin())) return snapshot();
        if (stale(token)) return snapshot();
        // The SDK creates and confirms the order. No price, game ID or raw bridge call.
        var result = await bridge.purchaseGamePass({cardType: config.cardType, payWay: payWay});
        if (token !== epoch || disposed) return snapshot();
        if (result && result.ok === true) {
          toast('购买成功');
          await showOwnedState(bridge, token);
        } else if (result && result.code === 'PAYMENT_CANCELLED') {
          toast('已取消支付');
        } else if (result && result.code === 'PAYMENT_UNCONFIRMED') {
          toast('未确认到支付结果，如已扣款请稍后刷新');
        } else if (result && result.code === 'PAYMENT_FAILED') {
          toast('支付失败，请重试');
        } else {
          toast(result && result.message);
        }
      } catch (e) { if (!stale(token)) toast('暂时无法打开虎扑 App'); }
      finally { state.purchasing = false; emit(); }
      return snapshot();
    }
    return {
      state: snapshot, refresh: refresh, buy: onBuyClick,
      invalidate: function () { epoch++; refreshFlight = null; state.owned = false; state.source = null; state.pass = null; state.configs = []; state.selectedCardType = null; state.phase = 'idle'; emit(); },
      subscribe: function (fn) { listeners.push(fn); fn(snapshot()); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
      selectTier: function (type) { if (state.purchasing || state.phase !== 'purchase' || !state.configs.some(function (c) { return c.cardType === type; })) return false; state.selectedCardType = type; emit(); return true; },
      selectPayWay: function (way) { if (state.purchasing || !enabled.includes(way)) return false; state.payWay = way; emit(); return true; },
      authorizeBenefit: async function (benefit) {
        if (!['ad_free', 'keepsake'].includes(benefit)) throw new Error('Unknown benefit');
        if (state.purchasing || disposed) return false;
        await refresh(); return !disposed && state.phase === 'owned' && state.owned;
      },
      visible: function () { if (!state.purchasing) return refresh(); return Promise.resolve(snapshot()); },
      dispose: function () { disposed = true; epoch++; listeners = []; if (visibilityReady) options.document.removeEventListener('visibilitychange', onVisible); }
    };
  }
  return {create: create, loadSDK: loadSDK, SDK_URL: SDK_URL, cardName: cardName, yuan: yuan};
});
