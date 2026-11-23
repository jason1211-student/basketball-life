/* 全自动模拟：推进到进联盟或指定年数，结束弹报告；忙碌遮罩防重复点击。 */
(function () {
  'use strict';
  if (window.MBLQuickSim) return;
  var C = window.MBLCore;
  var el = C.h;

  var running = false;
  var savedSound = null;

  function busy(on) {
    running = on;
    var mask = document.querySelector('#mbl-qs-busy');
    if (on) {
      // 临时静音，不写设置，结束后恢复
      savedSound = de.settings.sound;
      de.settings.sound = false;
      if (!mask) {
        var m = el('div', 'mbl-qs-busy');
        m.id = 'mbl-qs-busy';
        m.append(el('span', 'mbl-qs-spinner'), el('p', '', '正在自动模拟，稍等…'));
        document.body.append(m);
      }
    } else {
      de.settings.sound = savedSound;
      if (mask) mask.remove();
    }
    var btn = document.querySelector('#mbl-qs-btn');
    if (btn) btn.disabled = on;
  }

  // 自动推进到条件成立（抉择默认选第一个）；simOpts 可覆盖暂停口径
  async function advance(stopWhen, maxSteps, simOpts) {
    return window.MBLAutoSim.autoPlay(stopWhen, Object.assign(
      { maxSteps: maxSteps || 6000, pauseMajor: true }, simOpts || {}));
  }

  // 重大节点 / 历史时刻暂停：不弹模拟报告，把抉择留给玩家手动确认，按钮给出提示
  function flashMajor(text) {
    var btn = document.querySelector('#mbl-qs-btn');
    if (!btn) return;
    var old = btn.textContent;
    var msg = text || '有重大事件待确认';
    btn.textContent = msg;
    setTimeout(function () { if (btn.textContent === msg) btn.textContent = old; }, 5000);
  }

  // 等待历史事件弹窗被玩家确认关闭（原生 dialog 在 top layer，遮罩挡不住）
  function waitEraClosed() {
    return new Promise(function (resolve) {
      var t = setInterval(function () {
        var pop = document.querySelector('.mbl-era-pop');
        if (!pop || !pop.open) { clearInterval(t); resolve(); }
      }, 150);
    });
  }
  function maskText(text) {
    var p = document.querySelector('#mbl-qs-busy p');
    if (p) p.textContent = text;
  }

  // onlyEra=true（出生直达 NBA）：只在历史事件处等玩家确认，确认后自动继续；职业抉择自动处理
  async function runToNBA(onlyEra) {
    if (running) return;
    var startAge = de.life.age;
    var simOpts = onlyEra ? { pauseMajor: false, pauseEra: true } : null;
    var stopWhen = function (life) { return !!(life.ball && life.ball.pro); };
    busy(true);
    var r;
    try {
      while (true) {
        r = await advance(stopWhen, 6000, simOpts);
        // 出生直达：历史事件确认后自动接着模拟，无需重新发起
        if (onlyEra && r.reason === 'era') {
          maskText('请确认历史事件，确认后自动继续…');
          await waitEraClosed();
          maskText('正在自动模拟，稍等…');
          continue;
        }
        break;
      }
      if (r.reason === 'major' || r.reason === 'era') {
        flashMajor(r.reason === 'era' ? '有历史事件待确认' : undefined);
        return r;
      }
      await window.MBLAutoSim.clearOverlays();
      window.MBLSimReport.open(startAge);
    } finally { busy(false); }
    return r;
  }

  async function runYears(n) {
    if (running) return;
    var startAge = de.life.age;
    var target = startAge + (n || 5);
    busy(true);
    try {
      var r = await advance(function (life) {
        return life.age >= target || !life.alive || (life.ball && life.ball.pro);
      }, 6000);
      if (r.reason === 'major' || r.reason === 'era') {
        flashMajor(r.reason === 'era' ? '有历史事件待确认' : undefined);
        return r;
      }
      await window.MBLAutoSim.clearOverlays();
      window.MBLSimReport.open(startAge);
    } finally { busy(false); }
    return r;
  }

  // career-hub 入口：挂在 CTA 外，避免被其 replaceChildren 清掉
  function mountEntry() {
    if (de.screen !== 'play') return;
    var cta = document.querySelector('#mbl-hub-cta');
    if (!cta) return;
    if (cta.parentElement.querySelector('#mbl-qs-wrap')) return;
    var wrap = el('div', 'mbl-qs-wrap');
    wrap.id = 'mbl-qs-wrap';
    var btn = el('button', 'mbl-qs-btn');
    btn.id = 'mbl-qs-btn'; btn.type = 'button';
    btn.textContent = '全自动模拟…';
    var menu = el('div', 'mbl-qs-menu');
    menu.id = 'mbl-qs-menu';
    var opts = [
      { v: 'nba', t: '一直模拟到进 NBA' },
      { v: '3', t: '模拟 3 年' },
      { v: '5', t: '模拟 5 年' },
      { v: '10', t: '模拟 10 年' }
    ];
    opts.forEach(function (o) {
      var b = el('button', 'mbl-qs-opt');
      b.type = 'button'; b.dataset.v = o.v; b.textContent = o.t;
      b.addEventListener('click', function () {
        menu.classList.remove('open');
        if (o.v === 'nba') runToNBA(); else runYears(Number(o.v));
      });
      menu.append(b);
    });
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.classList.toggle('open');
    });
    wrap.append(btn, menu);
    cta.after(wrap);
  }

  // 出生界面：直接进入 NBA
  function mountBirthEntry() {
    if (de.screen !== 'birth') return;
    var main = document.querySelector('main.birth');
    if (!main || main.querySelector('#mbl-qs-birth')) return;
    var wrap = el('div', 'mbl-qs-birth');
    wrap.id = 'mbl-qs-birth';
    var btn = el('button', 'mbl-qs-birth-btn');
    btn.type = 'button';
    btn.textContent = '直接进入 NBA（全自动模拟）';
    btn.addEventListener('click', function () {
      if (running) return;
      // 先进入 play，再自动推进
      var begin = document.querySelector('[data-act="begin"]');
      if (begin) begin.click();
      var tries = 0;
      var timer = setInterval(function () {
        tries++;
        var ready = de.screen === 'play' && de.life && de.life.ball &&
          document.querySelector('main.play') &&
          (document.querySelector('[data-act="next"]') ||
           document.querySelector('article.card.decide') ||
           document.querySelector('[data-act="noticeok"]'));
        if (ready) {
          clearInterval(timer);
          runToNBA(true);
        } else if (tries > 80) {
          clearInterval(timer);
        }
      }, 120);
    });
    wrap.append(btn);
    var anchor = main.querySelector('#mbl-birth-custom');
    if (anchor) anchor.append(wrap); else main.append(wrap);
  }

  // play / birth 两个界面分别挂载入口
  C.onDom(function () {
    if (de.screen === 'play') mountEntry();
    else if (de.screen === 'birth') mountBirthEntry();
  }, ['play', 'birth']);

  window.MBLQuickSim = {
    runToNBA: runToNBA,
    runYears: runYears
  };
})();
