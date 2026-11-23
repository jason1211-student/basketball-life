// 出生背景自定义：把国家/城乡/城市/家境/天赋从随机改为可手动选择，保留随机
(function () {
  if (window.MBLBirthCustom) return;
  var C = window.MBLCore;
  var GIFT_CN = {
    none: '无天赋', sport: '运动', music: '音乐', people: '人际',
    study: '学习', art: '艺术', numbers: '数理'
  };
  var GIFT_ICON = {
    none: '∅', sport: '🏀', music: '🎵', people: '🤝',
    study: '📚', art: '🎨', numbers: '🔢'
  };
  var state = { busy: false, mounted: false };

  var hans = C.hans;
  function currentParams() {
    var l = de.life;
    if (!l) return null;
    return {
      country: l.country,
      urban: l.urban,
      city: l.urban ? hans(l.city) : '',
      quintile: l.quintile,
      gift: l.gift
    };
  }
  var el = C.h;
  function segBtn(group, value, label, icon) {
    var b = el('button', 'bc-opt');
    b.type = 'button';
    b.dataset.group = group;
    b.dataset.value = String(value);
    if (icon) b.append((function () { var i = el('span', 'bc-opt-icon', icon); return i; })());
    b.append(el('span', '', label));
    return b;
  }

  // 用当前 life 状态构建整个自定义卡片
  function build() {
    var p = currentParams();
    if (!p) return null;
    var box = el('section', 'mbl-birth-custom card');
    box.id = 'mbl-birth-custom';

    var head = el('div', 'bc-head');
    head.append(el('h2', '', '自定义出生背景'));
    var rnd = el('button', 'ghost small bc-random');
    rnd.type = 'button'; rnd.textContent = '随机一组';
    head.append(rnd);
    box.append(head);
    box.append(el('p', 'bc-tip', '手动调整只改对应项，其余背景和名字保留；点“随机一组”会全部重新随机。已选出生加成都会保留。'));

    // 国家
    var countryRow = el('div', 'bc-row');
    countryRow.append(el('label', 'bc-label', '国家/地区'));
    var countrySel = el('select', 'bc-select');
    countrySel.dataset.bc = 'country';
    dl.forEach(function (c) {
      var o = el('option', '', (c.flag ? c.flag + ' ' : '') + hans(c.name));
      o.value = c.code;
      if (c.code === p.country) o.selected = true;
      countrySel.append(o);
    });
    countryRow.append(countrySel);
    box.append(countryRow);

    // 城乡
    var urbanRow = el('div', 'bc-row');
    urbanRow.append(el('label', 'bc-label', '成长地'));
    var urbanSeg = el('div', 'bc-seg');
    urbanSeg.dataset.bc = 'urban';
    var urbanCity = segBtn('urban', 'true', '城市', '🏙️');
    var urbanRural = segBtn('urban', 'false', '农村', '🌾');
    if (p.urban) urbanCity.classList.add('on'); else urbanRural.classList.add('on');
    urbanSeg.append(urbanCity, urbanRural);
    urbanRow.append(urbanSeg);
    box.append(urbanRow);

    // 具体城市（仅城市）
    var cityRow = el('div', 'bc-row' + (p.urban ? '' : ' hidden'));
    cityRow.dataset.bcCity = '1';
    cityRow.append(el('label', 'bc-label', '具体城市'));
    var citySel = el('select', 'bc-select');
    citySel.dataset.bc = 'city';
    var autoOpt = el('option', '', '随机城市');
    autoOpt.value = '';
    if (!p.city) autoOpt.selected = true;
    citySel.append(autoOpt);
    var cdata = zt(p.country);
    var cities = cdata.country.cities || [];
    cities.forEach(function (c) {
      var o = el('option', '', hans(c));
      o.value = c.en;
      if (hans(c) === p.city || c.en === p.city) o.selected = true;
      citySel.append(o);
    });
    cityRow.append(citySel);
    box.append(cityRow);

    // 家境五档
    var qRow = el('div', 'bc-row');
    qRow.append(el('label', 'bc-label', '家境'));
    var qSeg = el('div', 'bc-seg bc-seg5');
    qSeg.dataset.bc = 'quintile';
    for (var q = 1; q <= 5; q++) {
      (function (qi) {
        var b = segBtn('quintile', String(qi), hans(gR[qi]).replace('20%', '').trim());
        if (qi === p.quintile) b.classList.add('on');
        qSeg.append(b);
      })(q);
    }
    qRow.append(qSeg);
    box.append(qRow);

    // 天赋七类
    var gRow = el('div', 'bc-row');
    gRow.append(el('label', 'bc-label', '天赋'));
    var gSeg = el('div', 'bc-seg');
    gSeg.dataset.bc = 'gift';
    Object.keys(GIFT_CN).forEach(function (gk) {
      var b = segBtn('gift', gk, GIFT_CN[gk], GIFT_ICON[gk]);
      if (gk === p.gift) b.classList.add('on');
      gSeg.append(b);
    });
    gRow.append(gSeg);
    box.append(gRow);

    wire(box);
    return box;
  }

  // 收集控件当前选择
  function collect(box) {
    var country = box.querySelector('[data-bc="country"]').value;
    var urban = box.querySelector('.bc-seg[data-bc="urban"] .bc-opt.on').dataset.value === 'true';
    var cityNode = box.querySelector('[data-bc="city"]');
    var city = urban ? cityNode.value : '';
    var quintile = Number(box.querySelector('.bc-seg[data-bc="quintile"] .bc-opt.on').dataset.value);
    var gift = box.querySelector('.bc-seg[data-bc="gift"] .bc-opt.on').dataset.value;
    return { country: country, urban: urban, city: city, quintile: quintile, gift: gift };
  }

  // 带参数重新生成，并保留已选出生加成
  async function regenerate(box, randomize) {
    if (state.busy) return;
    var old = de.life;
    var savedPerks = (old.mblBirthPerks && old.mblBirthPerks.keys) || [];
    var params = randomize ? {} : collect(box);
    state.busy = true;
    Got({
      // 随机一组必须换 seed：内核随机数全由 seed 确定性派生，沿用旧 seed 会让每次“随机”结果一模一样；
      // 手动调整（randomize=false）则保留原 seed，让没动的字段保持稳定。
      // silent：手动微调单项时不播“随机一组”的抽奖滚动音，也不重启抽奖动画。
      silent: !randomize,
      seed: randomize ? void 0 : old.seed,
      difficulty: old.difficulty === 'hard' ? 'hard' : 'easy',
      country: randomize ? void 0 : params.country,
      urban: randomize ? void 0 : params.urban,
      city: randomize ? void 0 : params.city,
      quintile: randomize ? void 0 : params.quintile,
      gift: randomize ? void 0 : params.gift
    });
    await C.wait(60);
    // 重新点亮之前的加成（走完整点击流程，保证 changes 正确）
    for (var i = 0; i < savedPerks.length; i++) {
      var key = savedPerks[i];
      var card = document.querySelector('.perk-card[data-v="' + key + '"]');
      if (card && !card.disabled) { card.click(); await C.wait(450); }
    }
    await C.wait(120);
    state.busy = false;
    mount();
  }

  function wire(box) {
    box.addEventListener('click', function (ev) {
      var rnd = ev.target.closest('.bc-random');
      if (rnd) { regenerate(box, true); return; }
      var opt = ev.target.closest('.bc-opt');
      if (!opt) return;
      var group = opt.dataset.group;
      var seg = opt.parentElement;
      seg.querySelectorAll('.bc-opt').forEach(function (x) { x.classList.remove('on'); });
      opt.classList.add('on');
      // 城乡切换：显隐城市行
      if (group === 'urban') {
        var cityRow = box.querySelector('[data-bc-city]');
        if (cityRow) cityRow.classList.toggle('hidden', opt.dataset.value !== 'true');
      }
      regenerate(box, false);
    });
    box.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.dataset && t.dataset.bc === 'country') {
        // 国家变了，城市列表需要重建，直接重新生成后由 mount 重建
        regenerate(box, false);
      } else if (t.dataset && t.dataset.bc === 'city') {
        regenerate(box, false);
      }
    });
  }

  function mount() {
    var main = document.querySelector('main.birth');
    if (!main) { state.mounted = false; return; }
    var existing = main.querySelector('#mbl-birth-custom');
    var fresh = build();
    if (!fresh) return;
    if (existing) existing.replaceWith(fresh);
    else {
      // 插到出生记录卡之后、重随区之前
      var rerolls = main.querySelector('[data-mbl-rerolls]');
      if (rerolls) rerolls.parentElement.insertBefore(fresh, rerolls);
      else main.append(fresh);
    }
    state.mounted = true;
  }

  // 出生界面由内核重渲染，统一 DOM 调度（仅 birth 界面）触发重新挂载；busy 时跳过
  C.onDom(function () {
    if (state.busy) return;
    var main = document.querySelector('main.birth');
    if (main && !main.querySelector('#mbl-birth-custom')) mount();
  }, 'birth');

  window.MBLBirthCustom = {
    mount: mount,
    refresh: mount
  };
})();
