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
    return !!(window.de?.life?.alive && b && b.started && !b.retiredFromPlaying &&
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
    var year=b.lastDevelopment;
    var growth=year?'<p class="mbl-training-receipt">'+year.age+' 岁年度成长 · 总评 '+year.start+' → '+year.end+'<br>'+
      (year.changes.length?changesText(year.changes.slice(0,4)):'本年度分项保持稳定')+'</p>':'';

    return '<div class="mbl-badge-ovr">' +
      '<div class="mbl-badge-ovr-card"><span class="mbl-badge-ovr-num">' + ov +
      '</span><span class="mbl-badge-ovr-label">当前总评</span></div>' +
      '<div class="mbl-badge-ovr-card"><span class="mbl-badge-ovr-num pot">' + pot +
      '</span><span class="mbl-badge-ovr-label">潜力总评</span></div></div>' +
      '<p class="mbl-badge-sub">' + (posName ? '位置：<b>' + esc(posName) + '</b>　' : '') +
      '打法风格：' + esc(styleName) + '（按能力自动识别）</p>'+growth;
  }

  function buildTraining(b, canEdit) {
    if (!canEdit || !window.MBLAttrPoints) return '';
    var pts = MBLAttrPoints.points();
    var cards = MBLAttrPoints.programs();
    var tip = '生日 +2 点，常规赛每出场 20 次 +1 点，每季最多 4 点。奖项每季最多再得 3 点，最多持有 9 点。';
    var last = b.lastTraining;
    var receipt = last ? '<p class="mbl-training-receipt">上次训练 · '+esc(last.name)+' · '+last.age+' 岁 · 消耗 '+last.cost+' 点<br>'+changesText(last.changes)+'</p>' : '';
    return '<div class="mbl-badge-points"><span>可用训练点</span><strong class="mbl-badge-points-num">'+pts+'</strong></div>'+
      '<p class="mbl-badge-points-tip">'+tip+'</p>'+receipt+
      '<div class="mbl-train-card"><label>单项精练 <select data-train-skill>'+S.CATEGORIES.map(cat=>
        '<optgroup label="'+esc(cat.name)+'">'+cat.keys.map(k=>'<option value="'+k+'">'+esc(S.ATTR_CN[k])+' · '+Math.round(b.skills[k])+' / '+Math.round(b.potential[k])+'</option>').join('')+'</optgroup>').join('')+'</select></label>'+
      '<p class="mbl-train-desc">集中提升一项能力。达到 85 后每次提升 1，消耗 2 点；达到 94 后消耗 3 点。</p>'+
      '<button type="button" class="mbl-train-btn" data-train="single">预览精练</button></div>'+
      '<div class="mbl-train-grid">'+cards.map(p=>
        '<div class="mbl-train-card"><b>'+esc(p.name)+'</b><p class="mbl-train-desc">'+esc(p.desc)+'</p>'+
        '<p class="mbl-train-gain">'+(p.changes.length?changesText(p.changes):esc(p.reason))+'</p>'+
        '<button type="button" class="mbl-train-btn" data-train="'+p.id+'">查看方案'+(p.cost?' · '+p.cost+' 点':'')+'</button></div>').join('')+'</div>';
  }
  function changesText(changes) {
    const fmt=n=>Number(n.toFixed(1));
    return changes.map(c=>esc(S.ATTR_CN[c.key])+' '+fmt(c.from)+' → '+fmt(c.to)).join('，');
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
      if (v < th[t]) return S.TIER_LABEL[t]+'档要求 · '+badge.attrs.map(k=>S.ATTR_CN[k]+' '+th[t]).join('、');
    }
    return '已达上限';
  }

  function buildBadges(b) {
    const active=S.activeBadges(b.skills,posOf(b));
    return '<p class="mbl-badge-points-tip">已装备 '+Object.keys(active).length+' / '+S.badgeLimit(S.overall(b.skills,posOf(b)))+' 枚。优先装备高档位与擅长打法的徽章，每类最多 3 枚。</p>'+S.BADGE_CATS.map(function (cat) {
      var cards = S.BADGES.filter(function (bd) { return bd.cat === cat.id; }).map(function (bd) {
        var tier = active[bd.id];
        if (!tier) {
          return '<div class="mbl-badge-card is-locked"><div class="mbl-badge-icon-row">' +
            icon(bd, null) +
            '<div class="mbl-badge-name-row"><b>' + esc(bd.name) + '</b></div></div>' +
            '<p class="mbl-badge-desc">' + esc(bd.desc) + '</p>' +
            '<div class="mbl-badge-need">' + (S.tierOf(b.skills,bd)?'已达门槛 · 当前未装备':needText(bd, b)) + '</div></div>';
        }
        return '<div class="mbl-badge-card"><div class="mbl-badge-icon-row">' +
          icon(bd, tier) +
          '<div class="mbl-badge-name-row"><b>' + esc(bd.name) + '</b>' +
          '<span class="mbl-badge-tier tier-' + tier + '">' + S.TIER_LABEL[tier] + '</span></div></div>' +
          '<p class="mbl-badge-desc">' + esc(bd.desc) + '</p><div class="mbl-badge-need">' + needText(bd,b)+'</div></div>';
      }).join('');
      return '<p class="mbl-badge-sub">' + esc(cat.name) + '徽章</p><div class="mbl-badge-grid">' + cards + '</div>';
    }).join('');
  }

  function bindTraining(container,rerender) {
    container.querySelectorAll('[data-train]').forEach(btn=>{
      btn.onclick=()=>{
        container.querySelector('.mbl-train-confirm')?.remove();
        const id=btn.dataset.train==='single'?'skill-'+container.querySelector('[data-train-skill]').value:btn.dataset.train;
        const plan=MBLAttrPoints.preview(id);
        const box=el('section','mbl-train-confirm'),message=el('p','',plan.reason||'');
        box.setAttribute('aria-live','polite');
        box.append(el('b','',plan.name||'训练预览'));
        if(plan.changes){
          box.append(el('p','',changesText(plan.changes)),
            el('p','','总评 '+plan.ovr+' → '+plan.afterOvr+' · 花费 '+plan.cost+' 点'+(plan.ok?' · 余 '+(plan.balance-plan.cost)+' 点':'')));
          for(const badge of plan.badges)box.append(el('p','',badge.name+' · '+(S.TIER_LABEL[badge.before]||'未装备')+' → '+(S.TIER_LABEL[badge.after]||'未装备')));
        }
        box.append(message);
        if(plan.ok){
          const confirm=el('button','mbl-train-btn','确认训练');
          confirm.type='button';confirm.dataset.confirmTraining=id;
          confirm.onclick=()=>{
            confirm.disabled=true;
            const result=MBLAttrPoints.apply(id,plan);
            if(result.ok){rerender();return;}
            message.textContent=result.reason;
          };
          box.append(confirm);
        }
        const cancel=el('button','mbl-train-btn','返回');
        cancel.type='button';cancel.onclick=()=>{box.remove();btn.focus({preventScroll:true});};
        box.append(cancel);btn.after(box);
      };
    });
  }

  function render() {
    if (!dialog) return;
    return window.MBLInteraction.preserveScroll(dialog, renderContents);
  }

  function renderContents() {
    var b = ball();
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
      '<p class="mbl-badge-sub">实战徽章</p>' +
      buildBadges(b) +
      '<p class="mbl-badge-foot">铜 / 银 / 金 / 名人堂 · 徽章在对应回合触发，单次出手的直接命中加成最多 8 个百分点。</p>';

    dialog.replaceChildren(head, body);
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
    if (window.MBLArenaSports) {
      var panels = MBLArenaSports.tabs(container, 'ball', [['overview','能力画像'],['training','专项训练'],['badges','徽章库']]);
      panels.overview.innerHTML = buildOvr(b, pos);
      panels.overview.append(MBLArenaSports.radar(b, S.CATEGORIES));
      var attrs = el('section','arena-attrs card'); attrs.innerHTML = buildAttrs(b, canEdit); panels.overview.append(attrs);
      panels.training.innerHTML = buildTraining(b, canEdit) || '<p class="mbl-badge-muted">当前阶段不能进行专项训练。</p>';
      panels.badges.innerHTML = buildBadges(b) + '<p class="mbl-badge-foot">铜 / 银 / 金 / 名人堂 · 单次出手的直接命中加成最多 8 个百分点。</p>';
      if (canEdit) bindTraining(panels.training, function () {
        var pos = window.MBLInteraction.position(); renderInto(container); window.MBLInteraction.restore(pos);
      });
      return;
    }
    container.innerHTML = buildOvr(b, pos) + buildTraining(b, canEdit) +
      buildAttrs(b, canEdit) + buildBadges(b);
    if (canEdit) bindTraining(container, function () { renderInto(container); });
  }

  var dialogState = '';
  C.onHeartbeat(function () {
    if (!dialog || !dialog.open) { dialogState = ''; return; }
    var b = ball();
    var sig = JSON.stringify([b?.skills, b?.potential, b?.started, b?.retiredFromPlaying, editable(b), window.MBLAttrPoints?.points()]);
    if (dialogState !== sig) { dialogState = sig; render(); }
  });

  window.MBLBadgePanel = {
    open: openPanel,
    close: closePanel,
    refresh: render,
    renderInto: renderInto
  };
})();
