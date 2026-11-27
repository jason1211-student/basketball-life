/* 球衣号码自选（单机复刻扩展）。
 * 仅在进联盟的「jersey_number」抉择卡片内注入一个号码盘：00、0、1–99，
 * 被队友占用的号码自动置灰；选中后点确认，走内核 Mde(life,"custom") 完整流程，
 * 由 custom 选项的 apply 读取 window.MBLJerseyPick.num 写号，状态与手动抉择一致。
 * 不改动任何已有抉择，旧档无该字段也兼容。 */
(function () {
  'use strict';
  if (window.MBLJerseyPick) return;
  var C = window.MBLCore;

  window.MBLJerseyPick = { num: null };

  function life() { return window.de && de.life ? de.life : null; }

  function isJerseyPending(l) {
    var p = l && l.pending && l.pending[0];
    return !!(p && p.tid === 'jersey_number');
  }

  var el = C.h;

  function allNumbers() {
    var nums = ['00', '0'];
    for (var n = 1; n <= 99; n++) nums.push(String(n));
    return nums;
  }

  function refreshSelection() {
    var box = document.getElementById('mbl-jpick');
    if (!box) return;
    var num = window.MBLJerseyPick.num;
    window.MBLCareerArt?.setNumber(box, num);
    box.querySelectorAll('.mbl-jpick-num').forEach(function (b) {
      b.classList.toggle('on', b.dataset.num === num);
    });
    var ok = box.querySelector('.mbl-jpick-ok');
    if (ok) {
      ok.disabled = num == null;
      ok.textContent = num == null ? '先在上面选一个号码' : '确认穿 ' + num + ' 号';
    }
  }

  function select(num) {
    window.MBLJerseyPick.num = num;
    refreshSelection();
  }

  function buildPanel(l) {
    var used = window.MY(l);
    var box = el('div', 'mbl-jpick');
    box.id = 'mbl-jpick';

    const art=window.MBLCareerArt?.jersey(l.ball.pro?.team);
    if(art)box.append(art);
    box.append(el('p', 'mbl-jpick-label', '自选号码（灰色＝已被队友占用）'));

    var grid = el('div', 'mbl-jpick-grid');
    allNumbers().forEach(function (num) {
      var b = el('button', 'mbl-jpick-num', num);
      b.type = 'button';
      b.dataset.num = num;
      if (used.has(num)) {
        b.disabled = true;
        b.classList.add('taken');
        b.title = '已被队友占用';
      } else {
        b.addEventListener('click', function () { select(num); });
      }
      grid.append(b);
    });
    box.append(grid);

    var ok = el('button', 'primary mbl-jpick-ok');
    ok.type = 'button';
    ok.addEventListener('click', function () {
      var lf = life();
      if (!lf || window.MBLJerseyPick.num == null) return;
      window.Mde(lf, 'custom');
    });
    box.append(ok);

    return box;
  }

  function mount() {
    var l = life();
    var card = document.querySelector('article.card.decide');
    if (!l || !isJerseyPending(l) || !card) return;
    if (card.querySelector('#mbl-jpick')) return;
    window.MBLJerseyPick.num = null;
    card.append(buildPanel(l));
    refreshSelection();
  }

  // 统一 DOM 调度（仅 play）+ 800ms 心跳双保险，替代独立 observer 与 setInterval
  C.onDom(mount, 'play');
  C.onHeartbeat(mount, 800);
  mount();
})();
