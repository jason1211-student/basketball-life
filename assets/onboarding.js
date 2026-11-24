/* 首次进入生涯的三步引导：只出现一次，可跳过。 */
(function () {
  'use strict';
  if (window.MBLOnboarding) return;
  var C = window.MBLCore;
  var KEY = 'mblGuideDone';

  var STEPS = [
    {
      title: '每年做一次选择',
      body: '每长大一岁，训练、生活、合同都会推进。左上角「能力」里可以用训练点做专项训练，练什么、放弃什么，由你决定。'
    },
    {
      title: '比赛在「球队」页',
      body: '常规赛可以看直播，也可以直接模拟；季后赛逐场打，主客场和加时都会记进战报。'
    },
    {
      title: '存档自动保存',
      body: '进度保存在这台设备。右上角「存档」可以导出 JSON 备份，换设备时导入就能继续。'
    }
  ];

  var dialog = null;
  var index = 0;
  var scheduled = false;
  var timer = 0;

  function life() { return C.life(); }
  function done(l) { return !!(l && l.flags && l.flags[KEY]); }

  function markDone(l) {
    if (!l) return;
    l.flags = l.flags || {};
    l.flags[KEY] = 1;
    try { if (window.Nt && typeof Nt.saveLife === 'function') Nt.saveLife(l); } catch (e) {}
  }

  function close() {
    if (dialog && dialog.open) dialog.close();
  }

  function paint() {
    if (!dialog) return;
    var step = STEPS[index];
    var last = index === STEPS.length - 1;
    dialog.querySelector('.mbl-guide-step').textContent = (index + 1) + ' / ' + STEPS.length;
    dialog.querySelector('.mbl-guide-title').textContent = step.title;
    dialog.querySelector('.mbl-guide-body').textContent = step.body;
    dialog.querySelector('.mbl-guide-dots').innerHTML = STEPS.map(function (_, i) {
      return '<i class="' + (i === index ? 'on' : '') + '"></i>';
    }).join('');
    dialog.querySelector('.mbl-guide-prev').hidden = index === 0;
    dialog.querySelector('.mbl-guide-next').textContent = last ? '开始生涯' : '下一步';
  }

  function build() {
    dialog = C.h('dialog', 'mbl-guide');
    dialog.innerHTML =
      '<div class="mbl-guide-card">' +
        '<div class="mbl-guide-top"><span class="mbl-guide-step"></span>' +
          '<button type="button" class="mbl-guide-skip">跳过</button></div>' +
        '<h2 class="mbl-guide-title"></h2>' +
        '<p class="mbl-guide-body"></p>' +
        '<div class="mbl-guide-dots"></div>' +
        '<div class="mbl-guide-actions">' +
          '<button type="button" class="mbl-guide-prev">上一步</button>' +
          '<button type="button" class="mbl-guide-next">下一步</button>' +
        '</div>' +
      '</div>';
    dialog.addEventListener('cancel', function () { finish(); });
    dialog.querySelector('.mbl-guide-skip').addEventListener('click', finish);
    dialog.querySelector('.mbl-guide-prev').addEventListener('click', function () {
      if (index > 0) { index -= 1; paint(); }
    });
    dialog.querySelector('.mbl-guide-next').addEventListener('click', function () {
      if (index < STEPS.length - 1) { index += 1; paint(); }
      else finish();
    });
    document.body.appendChild(dialog);
  }

  function finish() {
    markDone(life());
    close();
  }

  function canShow() {
    var l = life();
    if (!l || !l.ball || done(l)) return false;
    if (!window.de || de.screen !== 'play' || de.sharedView || de.credits) return false;
    if (document.querySelector('dialog[open]')) return false;
    if (document.querySelector('#mbl-qs-busy')) return false;
    if (window.de && (de.auto || de.autoPlay)) return false;
    return true;
  }

  function show() {
    if (!canShow()) return;
    if (!dialog) build();
    index = 0;
    paint();
    if (!dialog.open) dialog.showModal();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    clearTimeout(timer);
    timer = setTimeout(function () {
      scheduled = false;
      show();
    }, 900);
  }

  C.onDom(schedule, 'play');
  window.addEventListener('mbl:state-changed', schedule);
  window.addEventListener('mbl:birth-started', function () { scheduled = false; });

  // 困难模式已移除：旧 hard 存档在读入后静默降为普通，生涯数据与成绩保留。
  C.onHeartbeat(function () {
    var l = C.life();
    if (!l || l.difficulty !== 'hard') return;
    l.difficulty = 'easy';
    try { if (window.Nt && typeof Nt.saveLife === 'function') Nt.saveLife(l); } catch (e) {}
  }, 1200);

  window.MBLOnboarding = { show: show, done: function () { return done(life()); } };
})();
