/* 能力与徽章面板：统一 17 项能力（0-99）+ 31 个徽章（四档）。
 * 数据与判定全部来自 attr-system；面板只负责展示与训练点加点。玩家与 NPC 同一套规则。 */
(function () {
  'use strict';
  if (window.MBLBadgePanel) return;
  var C = window.MBLCore, S = window.MBLAttrSys;
  var el = C.h;

  var DIALOG_ID = 'mbl-badge-dialog';
  var dialog = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function ball() {
    var life = window.de && de.life;
    return life ? life.ball : null;
  }
  function posOf(b) {
    try { return (typeof kn === 'function') ? kn(b) : 'wing'; } catch (e) { return 'wing'; }
  }
  // 具体场上位置（pg/sg/sf/pf/c）的当前语言名称
  function posLabel(b) {
    try {
      if (typeof Bu === 'function' && typeof gf !== 'undefined') {
        var name = gf[Bu(b)];
        return (typeof Be === 'function') ? Be(name) : name;
      }
    } catch (e) {}
    return '';
  }
  function editable(b) {
    return !!(b && b.started && !b.retiredFromPlaying &&
      !(window.de && de.life && de.life.prisonYears > 0));
  }

  // 徽章图标：档位色圆角方块 + 名称首字
  function icon(badge, tier) {
    var cls = tier ? 'tier-' + tier : 'locked';
    var glyph = esc(badge.name.charAt(0));
    return '<span class="mbl-badge-icon ' + cls + '"><b>' + glyph + '</b></span>';
  }

  function buildOvr(b, pos) {
    var ov = S.overall(b.skills, pos), pot = S.overall(b.potential, pos);
    var styleName = S.STYLE_NAME[S.detectStyle(b.skills)] || '';
    var posName = posLabel(b);
    return '<div class="mbl-badge-ovr">' +
      '<div class="mbl-badge-ovr-card"><span class="mbl-badge-ovr-num">' + ov +
      '</span><span class="mbl-badge-ovr-label">当前总评</span></div>' +
      '<div class="mbl-badge-ovr-card"><span class="mbl-badge-ovr-num pot">' + pot +
      '</span><span class="mbl-badge-ovr-label">潜力总评</span></div></div>' +
      '<p class="mbl-badge-sub">' + (posName ? '位置：<b>' + esc(posName) + '</b>　' : '') +
      '打法风格：' + esc(styleName) + '（按能力自动识别）</p>';
  }

  function buildTraining(b, canEdit) {
    if (!canEdit || !window.MBLAttrPoints) return '';
    var pts = MBLAttrPoints.points();
    var cards = MBLAttrPoints.programs();
    var tip = pts > 0
      ? '消耗 1 点。每年 +2；每 20 场 +1（每季最多 4），奖项 +1（每季最多 3）。'
      : '下一次生日 +2 点；比赛和奖项也会给点（最多存 ' + MBLAttrPoints.MAX + ' 个）。';
    return '<div class="mbl-badge-points"><span class="mbl-badge-points-label">可用训练点</span>' +
      '<span class="mbl-badge-points-num">' + pts + '</span></div>' +
      '<p class="mbl-badge-points-tip">' + tip + '</p>' +
      '<div class="mbl-train-grid">' + cards.map(function (p) {
        var usable = p.available && pts > 0;
        return '<div class="mbl-train-card' + (usable ? '' : ' is-off') + '">' +
          '<b>' + esc(p.name) + '</b>' +
          '<p class="mbl-train-desc">' + esc(p.desc) + '</p>' +
          '<p class="mbl-train-gain">' + esc(MBLAttrPoints.gainText(p.gains)) + '</p>' +
          '<p class="mbl-train-loss">' + esc(MBLAttrPoints.lossText(p.loss)) + '</p>' +
          '<button type="button" class="mbl-train-btn" data-train="' + esc(p.id) + '"' +
          (usable ? '' : ' disabled') + '>训练 · 1 点</button></div>';
      }).join('') + '</div><p class="mbl-train-msg"></p>';
  }

  function buildAttrs(b, canEdit) {
    var rows = S.CATEGORIES.map(function (cat) {
      var inner = cat.keys.map(function (k) {
        var v = C.round(b.skills[k]), p = C.round(C.num(b.potential[k], v));
        var pct = Math.round(C.clamp(v / 99, 0, 1) * 100);
        var potPct = Math.round(C.clamp(p / 99, 0, 1) * 100);
        return '<div class="mbl-badge-attr"><div class="mbl-badge-attr-top"><span>' +
          esc(S.ATTR_CN[k]) + '</span><span class="mbl-badge-attr-right"><span class="mbl-badge-attr-val">' +
          v + ' / ' + p + '</span></span></div>' +
          '<div class="mbl-badge-bar"><i class="mbl-badge-bar-fill" style="width:' + pct + '%"></i>' +
          '<i class="mbl-badge-bar-pot" style="left:' + potPct + '%"></i></div></div>';
      }).join('');
      return '<p class="mbl-badge-sub">' + esc(cat.name) + '</p><div class="mbl-badge-attr-grid">' + inner + '</div>';
    }).join('');
    return rows;
  }

  function needText(badge, b) {
    var v = Infinity;
    badge.attrs.forEach(function (k) { v = Math.min(v, C.round(b.skills[k])); });
    var th = badge.thresholds || S.TIERS;
    for (var i = 0; i < S.TIER_NEXT.length; i++) {
      var t = S.TIER_NEXT[i];
      if (v < th[t]) return '还差 ' + (th[t] - v) + ' 点解锁' + S.TIER_LABEL[t];
    }
    return '已达上限';
  }

  function buildBadges(b) {
    return S.BADGE_CATS.map(function (cat) {
      var cards = S.BADGES.filter(function (bd) { return bd.cat === cat.id; }).map(function (bd) {
        var tier = S.tierOf(b.skills, bd);
        if (!tier) {
          return '<div class="mbl-badge-card is-locked"><div class="mbl-badge-icon-row">' +
            icon(bd, null) +
            '<div class="mbl-badge-name-row"><b>' + esc(bd.name) + '</b></div></div>' +
            '<p class="mbl-badge-desc">' + esc(bd.desc) + '</p>' +
            '<div class="mbl-badge-need">' + needText(bd, b) + '</div></div>';
        }
        return '<div class="mbl-badge-card"><div class="mbl-badge-icon-row">' +
          icon(bd, tier) +
          '<div class="mbl-badge-name-row"><b>' + esc(bd.name) + '</b>' +
          '<span class="mbl-badge-tier tier-' + tier + '">' + S.TIER_LABEL[tier] + '</span></div></div>' +
          '<p class="mbl-badge-desc">' + esc(bd.desc) + '</p></div>';
      }).join('');
      return '<p class="mbl-badge-sub">' + esc(cat.name) + '徽章</p><div class="mbl-badge-grid">' + cards + '</div>';
    }).join('');
  }

  function bindTraining(container, rerender) {
    if (!window.MBLAttrPoints) return;
    container.querySelectorAll('.mbl-train-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var result = MBLAttrPoints.apply(btn.getAttribute('data-train'));
        if (result && result.ok) { rerender(); return; }
        var msg = container.querySelector('.mbl-train-msg');
        if (msg) msg.textContent = (result && result.reason) || '训练没有完成';
      });
    });
  }

  function render() {
    var b = ball();
    if (!dialog) return;
    var keepTop = dialog.scrollTop;
    if (!b || !b.started) {
      dialog.replaceChildren(el('div', 'mbl-badge-head',
        el('h2', '', '能力与徽章')),
        el('p', 'mbl-badge-muted', '开始接触篮球后，这里会显示你的能力与徽章。'));
      return;
    }
    var pos = posOf(b), canEdit = editable(b);
    var head = el('div', 'mbl-badge-head');
    var h2 = el('h2', '', '能力与徽章');
    var close = el('button', 'mbl-badge-close', '关闭');
    close.type = 'button';
    close.addEventListener('click', function () { closePanel(); });
    head.append(h2, close);

    var body = document.createElement('div');
    body.innerHTML = buildOvr(b, pos) + buildTraining(b, canEdit) + buildAttrs(b, canEdit) +
      '<p class="mbl-badge-sub">徽章（按能力自动点亮，比赛中提供实战加成）</p>' +
      buildBadges(b) +
      '<p class="mbl-badge-foot">徽章档位：铜 / 银 / 金 / 名人堂；每档给对应比赛轴 +1/+2/+3/+4，单项封顶 +8。</p>';

    dialog.replaceChildren(head, body);
    dialog.scrollTop = keepTop;
    if (canEdit) bindTraining(body, function () { render(); });
  }

  function openPanel() {
    if (!dialog) {
      dialog = el('dialog', 'mbl-badge-modal');
      dialog.id = DIALOG_ID;
      dialog.addEventListener('click', function (ev) {
        if (ev.target === dialog) closePanel();
      });
      document.body.appendChild(dialog);
    }
    render();
    if (!dialog.open) dialog.showModal();
  }

  function closePanel() {
    if (dialog && dialog.open) dialog.close();
  }

  // 供外部面板嵌入：把内容渲染到指定容器
  function renderInto(container) {
    if (!container) return;
    var b = ball();
    if (!b || !b.started) {
      container.textContent = '开始接触篮球后开放。';
      return;
    }
    var pos = posOf(b), canEdit = editable(b);
    container.innerHTML = buildOvr(b, pos) + buildTraining(b, canEdit) +
      buildAttrs(b, canEdit) + buildBadges(b);
    if (canEdit) bindTraining(container, function () { renderInto(container); });
  }

  C.onHeartbeat(function () {
    if (dialog && dialog.open) render();
  });

  window.MBLBadgePanel = {
    open: openPanel,
    close: closePanel,
    refresh: render,
    renderInto: renderInto
  };
})();
