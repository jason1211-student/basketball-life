/* 底部导航：五个标签对应 main.play 内五个视图，点标签直接切换（非弹窗）。 */
(function () {
  'use strict';
  if (window.MBLNavDock) return;
  var C = window.MBLCore;
  var h = C.h;

  // 兼容旧面板注册位，新导航不依赖它
  window.MBLDockPanels = window.MBLDockPanels || {};

  var TABS = [
    { id: 'home', label: '生涯' },
    { id: 'ball', label: '篮球', title: '篮球' },
    { id: 'team', label: '球队', title: '球队' },
    { id: 'journey', label: '足迹', title: '人生足迹' },
    { id: 'people', label: '身边', title: '身边的人' }
  ];

  var dock = h('nav', 'mbl-dock');
  dock.setAttribute('aria-label', '主导航');
  var buttons = {};
  TABS.forEach(function (t) {
    var b = h('button', 'mbl-dock-btn');
    b.type = 'button';
    b.dataset.tab = t.id;
    b.setAttribute('aria-label', t.label);
    b.append(h('span', 'mbl-dock-icon'), h('span', 'mbl-dock-label', t.label));
    dock.append(b);
    buttons[t.id] = b;
  });

  var activeTab = 'home';
  var views = {};   // id -> section.mbl-view
  var scrollPositions = {};
  var owner = null;
  var dirty = new Set(TABS.map(function (t) { return t.id; }));

  window.addEventListener('mbl:state-changed', function () {
    TABS.forEach(function (t) { dirty.add(t.id); });
  });

  // main.play 会被内核重建，每次都校验并补齐五个视图
  function ensureViews() {
    var main = document.querySelector('main.play');
    if (!main) return null;
    var wrap = main.querySelector('.mbl-views');
    if (!wrap || !wrap.querySelector('[data-view="home"]')) {
      views = {};
      var needsMount = !wrap;
      if (needsMount) wrap = h('div', 'mbl-views');
      wrap.setAttribute('data-mbl-view-root', '');
      TABS.forEach(function (t) {
        var v = h('section', 'mbl-view');
        v.dataset.view = t.id;
        v.setAttribute('role', 'group');
        v.setAttribute('aria-label', t.title || t.label);
        if (t.id !== 'home') v.hidden = true;
        wrap.append(v);
        views[t.id] = v;
      });
      var header = main.querySelector('header.lifebar');
      if (needsMount) {
        if (header && header.nextSibling) main.insertBefore(wrap, header.nextSibling);
        else main.append(wrap);
      }
    } else {
      TABS.forEach(function (t) {
        views[t.id] = wrap.querySelector('[data-view="' + t.id + '"]');
      });
    }
    return wrap;
  }

  function setActive(id) {
    activeTab = id;
    var main=document.querySelector('main.play');if(main&&main.dataset.arenaView!==id)main.dataset.arenaView=id;
    TABS.forEach(function (t) {
      const button=buttons[t.id], selected=t.id===id;
      button.classList.toggle('is-active',selected);
      if(selected)button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
  }

  function renderActive() {
    var view = views[activeTab];
    if (activeTab !== 'home' && view && window.MBLGroupPanels && (dirty.has(activeTab) || !view.children.length)) {
      var pos = window.MBLInteraction?.position();
      window.MBLGroupPanels.renderGroup(activeTab, view);
      dirty.delete(activeTab);
      if (activeTab === 'team') window.MBLGameHistory?.mount();
      window.MBLInteraction?.restore(pos);
    }
  }

  function showView(id, restoreScroll = true) {
    if (!buttons[id]) return;
    var wrap = ensureViews();
    if (!wrap) return;
    var changed = id !== activeTab;
    if (changed) scrollPositions[activeTab] = window.MBLInteraction?.position() || { x: window.scrollX, y: window.scrollY };
    TABS.forEach(function (t) {
      var v = views[t.id];
      if (v) v.hidden = (t.id !== id);
    });
    setActive(id);
    renderActive();
    if (changed && restoreScroll) window.MBLInteraction?.restore(scrollPositions[id] || { x: 0, y: 0 });
  }

  TABS.forEach(function (t) {
    buttons[t.id].onclick = function () { showView(t.id); };
  });

  var topButton = h('button', 'mbl-dock-btn arena-nav-top');
  topButton.type = 'button';
  topButton.setAttribute('aria-label', '回到当前页面顶部');
  topButton.append(h('span', 'arena-top-icon', '↑'), h('span', 'mbl-dock-label', '回顶'));
  topButton.onclick = function () { window.scrollTo({ top: 0, behavior: 'instant' }); };
  dock.append(topButton);
  window.MBLInteraction?.tabKeys(dock,()=>Object.values(buttons));

  function mount() {
    if (C.screen() !== 'play') {
      dock.remove();
      document.body.classList.remove('mbl-has-dock');
      return;
    }
    if (!document.body.contains(dock)) document.body.append(dock);
    document.body.classList.add('mbl-has-dock');
    if (owner !== C.life()) {
      owner = C.life(); activeTab = 'home'; scrollPositions = {};
      dirty = new Set(TABS.map(function (t) { return t.id; }));
      document.querySelector('main.play .mbl-views')?.replaceChildren();
    }
    // 视图为空才重渲染，否则只同步高亮，避免自反馈循环
    if (ensureViews()) {
      TABS.forEach(function (t) { if (views[t.id]) views[t.id].hidden = t.id !== activeTab; });
      setActive(activeTab);
      renderActive();
    }
  }

  function detachForCore() {
    if (C.screen() !== 'play') return null;
    var life = C.life();
    if (owner !== life) return null;
    var wrap = document.querySelector('main.play .mbl-views');
    if (!wrap) return null;
    var shapeEntries = [];
    if (typeof TB !== 'undefined' && TB instanceof Map) {
      wrap.querySelectorAll('[data-act="shape"][data-v]').forEach(function (node) {
        var key = node.dataset.v;
        if (TB.has(key)) shapeEntries.push([key, TB.get(key)]);
      });
    }
    return { wrap: wrap, owner: life, shapeEntries: shapeEntries };
  }

  function reattachAfterCore(saved) {
    var main = document.querySelector('main.play');
    if (!main || C.screen() !== 'play') return;
    if (saved?.owner === C.life()) {
      if (!main.contains(saved.wrap)) {
        var empty = main.querySelector('.mbl-views');
        var header = main.querySelector('header.lifebar');
        if (empty) empty.replaceWith(saved.wrap);
        else if (header) header.after(saved.wrap); else main.prepend(saved.wrap);
      }
      if (typeof TB !== 'undefined') saved.shapeEntries.forEach(function (entry) { TB.set(entry[0], entry[1]); });
    }
    mount();
  }
  C.onDom(mount);
  mount();

  // 同步「更多菜单是否展开」到 body  class，供 CSS 让右侧悬浮按钮/pill 避让
  function syncMenuClass() {
    document.body.classList.toggle('mbl-menu-open', !!document.querySelector('.more .menu'));
  }
  C.onDom(syncMenuClass);
  syncMenuClass();

  window.MBLNavDock = {
    activeTab: function () { return activeTab; },
    open: showView,
    setActive: setActive,
    getView: function (id) { ensureViews(); return views[id]; },
    panels: window.MBLDockPanels,
    detachForCore: detachForCore,
    reattachAfterCore: reattachAfterCore
  };
})();
