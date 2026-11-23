/* 选秀年代选择 + 基准年动态同步（单机离线）。
 * - 出生前在出生按钮上方插入「选秀年代」选择器（第一版：默认 / 1984 届）。
 * - 新出生时把所选届写入 life.flags，并把全局基准年 Ee 切到对应出生年。
 * - 切槽/读档（包装 MBLHost.restore）后按存档恢复 Ee；旧档无标记默认 2000。
 * - 1984 届首次进联盟给一条届背景里程碑。
 * 出生年 = 选秀年 − 19；游戏内年份 = Ee + age。 */
(function () {
  'use strict';
  if (window.MBLDraftClass) return;
  var C = window.MBLCore;

  var CLASSES = [
    { id: 'default', label: '默认 · 2000 年出生', draftYear: 2019, baseYear: 2000,
      m: '#c0392b', t: 'rgba(192,57,43,.16)',
      keywords: ['现代小球', '三分潮流', '位置模糊', '自由演算'] },
    { id: 1984, label: '1984 届 · 1965 年出生', draftYear: 1984, baseYear: 1965,
      m: '#ce1141', t: 'rgba(206,17,65,.16)',
      keywords: ['钻石一代', '乔丹·奥拉朱旺', '中锋盛世', '公牛王朝'] },
    { id: 1996, label: '1996 届 · 1977 年出生', draftYear: 1996, baseYear: 1977,
      m: '#7c3aed', t: 'rgba(124,58,237,.18)',
      keywords: ['黄金一代', '科比·艾弗森', '后卫群星', '湖人三连'] },
    { id: 2003, label: '2003 届 · 1984 年出生', draftYear: 2003, baseYear: 1984,
      m: '#e0533a', t: 'rgba(224,83,58,.16)',
      keywords: ['白金一代', '詹姆斯·韦德', '锋线盛世', '热火三巨'] },
    { id: 2009, label: '2009 届 · 1990 年出生', draftYear: 2009, baseYear: 1990,
      m: '#2f6fd0', t: 'rgba(47,111,208,.18)',
      keywords: ['库里·哈登', '控卫盛世', '小球革命', '勇士王朝'] }
  ];
  var DEFAULT_BASE = 2000;
  var a = window.a;
  window.__MBL_PICKED_DRAFT__ = window.__MBL_PICKED_DRAFT__ || 'default';

  function getClass(id) {
    return CLASSES.filter(function (c) { return c.id === id; })[0] || CLASSES[0];
  }
  function baseYearFor(life) {
    var dc = life && life.flags && life.flags.draftClass;
    if (dc === 1984) return 1965;
    if (dc === 1996) return 1977;
    if (dc === 2003) return 1984;
    if (dc === 2009) return 1990;
    return DEFAULT_BASE;
  }
  function syncEe(life) { if (life) window.Ee = baseYearFor(life); }

  // ---------- 选择器 UI ----------
  function injectStyle() {
    if (document.getElementById('mbl-draft-style')) return;
    var st = document.createElement('style');
    st.id = 'mbl-draft-style';
    st.textContent =
      '.mbl-draft-pick{margin:10px 0 4px;padding:12px;border:1px solid var(--line);' +
      'border-radius:var(--radius-md);background:var(--card);}' +
      '.mbl-draft-pick .mbl-draft-title{font-size:13px;color:var(--muted);margin-bottom:8px;}' +
      '.mbl-draft-pick .mbl-draft-opts{display:flex;flex-direction:column;gap:8px;}' +
      '.mbl-draft-pick button{display:block;width:100%;text-align:left;padding:10px 11px;border-radius:var(--radius-md);' +
      'border:1px solid var(--m);background:var(--t);cursor:pointer;}' +
      '.mbl-draft-lab{display:block;font-size:13px;font-weight:700;margin-bottom:7px;color:var(--m);}' +
      '.mbl-draft-chips{display:flex;flex-wrap:wrap;gap:5px;}' +
      '.mbl-draft-chip{font-size:11px;line-height:1;padding:4px 7px;border-radius:20px;' +
      'background:var(--m);color:#fff;border:1px solid var(--m);opacity:.78;}' +
      '.mbl-draft-pick button.active{background:var(--m);border-color:var(--m);box-shadow:0 8px 18px -10px var(--m);}' +
      '.mbl-draft-pick button.active .mbl-draft-lab{color:#fff;}' +
      '.mbl-draft-pick button.active .mbl-draft-chip{background:rgba(255,255,255,.22);color:#fff;border-color:rgba(255,255,255,.4);opacity:1;}';
    document.head.appendChild(st);
  }

  function ensurePicker() {
    var bornBtn = document.querySelector('.actionbar [data-act="born"]');
    if (!bornBtn) return;
    var bar = bornBtn.closest('.actionbar');
    if (!bar || bar.previousElementSibling && bar.previousElementSibling.classList.contains('mbl-draft-pick')) return;
    if (bar.parentElement && bar.parentElement.querySelector('.mbl-draft-pick')) return;

    var box = document.createElement('div');
    box.className = 'mbl-draft-pick';
    var title = document.createElement('div');
    title.className = 'mbl-draft-title';
    title.textContent = '选秀年代（决定你的出生年份与进联盟时间）';
    var opts = document.createElement('div');
    opts.className = 'mbl-draft-opts';
    CLASSES.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.id = c.id;
      b.style.setProperty('--m', c.m);
      b.style.setProperty('--t', c.t);
      var lab = document.createElement('span');
      lab.className = 'mbl-draft-lab';
      lab.textContent = c.label;
      var chips = document.createElement('span');
      chips.className = 'mbl-draft-chips';
      c.keywords.forEach(function (kw) {
        var chip = document.createElement('span');
        chip.className = 'mbl-draft-chip';
        chip.textContent = kw;
        chips.appendChild(chip);
      });
      b.append(lab, chips);
      if (c.id === window.__MBL_PICKED_DRAFT__) b.classList.add('active');
      b.addEventListener('click', function () {
        window.__MBL_PICKED_DRAFT__ = c.id;
        [].forEach.call(opts.querySelectorAll('button'), function (x) { x.classList.toggle('active', String(x.dataset.id) === String(c.id)); });
      });
      opts.appendChild(b);
    });
    box.append(title, opts);
    bar.parentElement.insertBefore(box, bar);
  }

  // ---------- 新出生：写 flags + 同步 Ee ----------
  function onNewLife() {
    var life = de.life;
    if (!life || life.age !== 0 || !life.flags) return;
    if (life.flags.__classSeed === life.seed) { syncEe(life); return; }
    var c = getClass(window.__MBL_PICKED_DRAFT__);
    life.flags.draftClass = c.id;
    life.flags.draftYear = c.draftYear;
    life.flags.baseYear = c.baseYear;
    life.flags.__classSeed = life.seed;
    window.Ee = c.baseYear;
  }

  // ---------- 进联盟届背景提示 ----------
  function onProIntro() {
    var life = de.life;
    if (!life || !life.ball || !life.ball.pro || life.flags.__proIntro) return;
    if (life.flags.draftClass === 1984) {
      var yr = Ee + life.age; // 实际进联盟年份（进联盟年龄自由，不写死 1984）
      d(life, a('You grew up in the era of the legendary 1984 class — Olajuwon, Jordan, Barkley and Stockton. In ' + yr + ', your own pro career began.',
        '你成长的年代，正是 1984 那批传奇——奥拉朱旺、乔丹、巴克利、斯托克顿——纵横联盟的时代。' + yr + ' 年，你开启了属于自己的职业之路。',
        '你成長的年代，正是 1984 那批傳奇——歐拉朱萬、喬丹、巴克利、史塔克頓——縱橫聯盟的時代。' + yr + ' 年，你開啟了屬於自己的職業之路。'), void 0, 'milestone');
    } else if (life.flags.draftClass === 1996) {
      var yr96 = Ee + life.age;
      d(life, a('You came of age with the storied 1996 class — Iverson, Kobe, Ray Allen, Nash and the undrafted Ben Wallace. In ' + yr96 + ', your own pro career began.',
        '你成长的年代，正是星光璀璨的 1996 黄金一代——艾弗森、科比、雷·阿伦、纳什，还有落选秀本·华莱士——逐梦联盟的时代。' + yr96 + ' 年，你开启了属于自己的职业之路。',
        '你成長的年代，正是星光璀璨的 1996 黃金一代——艾弗森、柯比、雷·艾倫、納許，還有落選秀本·華萊士——逐夢聯盟的時代。' + yr96 + ' 年，你開啟了屬於自己的職業之路。'), void 0, 'milestone');
    } else if (life.flags.draftClass === 2003) {
      var yr03 = Ee + life.age;
      d(life, a('You came of age with the ballyhooed 2003 class — LeBron, Wade, Carmelo and Bosh, plus the much-maligned Darko. In ' + yr03 + ', your own pro career began.',
        '你成长的年代，正是万众瞩目的 2003 白金一代——詹姆斯、韦德、安东尼、波什，还有备受争议的米利西奇——逐梦联盟的时代。' + yr03 + ' 年，你开启了属于自己的职业之路。',
        '你成長的年代，正是萬眾矚目的 2003 白金一代——詹姆斯、韋德、安東尼、波什，還有備受爭議的米利西奇——逐夢聯盟的時代。' + yr03 + ' 年，你開啟了屬於自己的職業之路。'), void 0, 'milestone');
    } else if (life.flags.draftClass === 2009) {
      var yr09 = Ee + life.age;
      d(life, a('You came of age with the deep 2009 class — Curry and Harden, DeRozan and Holiday, and the high-flying Blake Griffin. In ' + yr09 + ', your own pro career began.',
        '你成长的年代，正是人才济济的 2009 届——库里、哈登、德罗赞、霍勒迪，还有飞天遁地的格里芬——逐梦联盟的时代。' + yr09 + ' 年，你开启了属于自己的职业之路。',
        '你成長的年代，正是人才濟濟的 2009 屆——庫里、哈登、德羅贊、霍勒迪，還有飛天遁地的格里芬——逐夢聯盟的時代。' + yr09 + ' 年，你開啟了屬於自己的職業之路。'), void 0, 'milestone');
    }
    life.flags.__proIntro = true;
  }

  // ---------- 切槽/读档：包装 restore 同步 Ee ----------
  function wrapRestore() {
    if (!window.MBLHost || typeof window.MBLHost.restore !== 'function' || window.MBLHost.restore.__mblWrapped) return;
    var orig = window.MBLHost.restore;
    var wrapped = function () {
      var r = orig.apply(this, arguments);
      try { syncEe(de.life); setTimeout(function () { syncEe(de.life); }, 50); } catch (e) {}
      return r;
    };
    wrapped.__mblWrapped = true;
    window.MBLHost.restore = wrapped;
  }

  function tick() {
    try { injectStyle(); ensurePicker(); onNewLife(); onProIntro(); wrapRestore(); } catch (e) {}
  }
  // 接入统一心跳（400ms），替代独立 setInterval
  C.onHeartbeat(tick, 400);
  tick();

  window.MBLDraftClass = { syncEe: syncEe, baseYearFor: baseYearFor, classes: CLASSES };
})();
