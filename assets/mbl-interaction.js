(function () {
  'use strict';
  if (window.MBLInteraction) return;
  const C = window.MBLCore;
  const layers = new WeakMap();
  let order = 0;
  let active = null;
  let coreView = null;
  let page = null;
  const panelScrolls = new Map();
  const isolated = new Set();
  let coreOpening = null;

  function position() { return { x: window.scrollX, y: window.scrollY }; }
  function restore(pos) {
    if (pos && (Math.abs(window.scrollX - pos.x) > 1 || Math.abs(window.scrollY - pos.y) > 1)) {
      window.scrollTo({ left: pos.x, top: pos.y, behavior: 'instant' });
    }
  }

  function controlPosition(root) {
    const el=document.activeElement;
    if(!root?.contains?.(el) || !el?.matches?.('[data-act]'))return null;
    return {el,act:el.dataset.act,value:el.dataset.v};
  }
  function findControl(saved,root) {
    if(!saved)return null;
    if(saved.el.isConnected && root?.contains(saved.el))return saved.el;
    return Array.from(root?.querySelectorAll('[data-act]')||[]).find(el=>
      el.dataset.act===saved.act&&el.dataset.v===saved.value&&el.getClientRects().length&&!el.disabled);
  }
  function isolateLegacy(overlay) {
    const background=new Set();
    for(let node=overlay;node?.parentElement&&node!==document.body;node=node.parentElement){
      for(const sibling of node.parentElement.children){
        if(sibling!==node&&!sibling.matches('script, style, link'))background.add(sibling);
      }
    }
    for(const el of isolated){if(!background.has(el)){el.inert=false;isolated.delete(el);}}
    for(const el of background){if(!el.inert){el.inert=true;isolated.add(el);}}
  }
  function keyboardViewport() {
    const viewport=window.visualViewport, focused=document.activeElement;
    const enabled=viewport&&active?.contains(focused)&&focused?.matches('textarea, input:not([type=checkbox]):not([type=radio]), [contenteditable=true]')&&
      Math.abs(viewport.scale-1)<.05&&innerHeight-viewport.height>125;
    const root=document.documentElement;
    root.classList.toggle('mbl-keyboard-open',!!enabled);
    if(enabled){
      root.style.setProperty('--mbl-visible-height',Math.floor(viewport.height)+'px');
      root.style.setProperty('--mbl-visible-top',Math.floor(viewport.offsetTop)+'px');
    }
  }
  window.visualViewport?.addEventListener('resize',keyboardViewport);
  window.visualViewport?.addEventListener('scroll',keyboardViewport);
  document.addEventListener('focusin',keyboardViewport);
  document.addEventListener('focusout',()=>queueMicrotask(keyboardViewport));

  function tabKeys(nav,buttons) {
    const keys=['ArrowLeft','ArrowRight','Home','End'];
    nav.addEventListener('keydown',event=>{
      if(!keys.includes(event.key))return;
      const available=buttons().filter(el=>!el.hidden&&!el.disabled);
      const current=available.indexOf(event.target);
      if(current<0)return;
      event.preventDefault();
      const next=event.key==='Home'?0:event.key==='End'?available.length-1:
        (current+(event.key==='ArrowRight'?1:-1)+available.length)%available.length;
      available[next].click();
      available[next].focus({preventScroll:true});
    });
  }

  function legacyPanels() {
    // Include suspended panels, since their parent may resume after a confirmation.
    return Array.from(document.querySelectorAll('.modal-backdrop')).filter(el =>
      !el.closest('dialog') && el.getClientRects().length);
  }

  function rememberPanels() {
    for (const el of legacyPanels()) {
      const panel = el.querySelector('.modal');
      const key = el.dataset.key || panel?.dataset.key || panel?.getAttribute('aria-label');
      if (key && panel) panelScrolls.set(key, { top: panel.scrollTop, left: panel.scrollLeft, focus: controlPosition(panel) });
    }
  }

  function restorePanels() {
    for (const el of legacyPanels()) {
      const panel = el.querySelector('.modal');
      const pos = panelScrolls.get(el.dataset.key || panel?.dataset.key || panel?.getAttribute('aria-label'));
      if (pos && panel) {
        panel.scrollTop = pos.top;
        panel.scrollLeft = pos.left;
        if(el===active)findControl(pos.focus,panel)?.focus({preventScroll:true});
      }
    }
  }

  // Keep the panel and explicitly keyed nested scrollers in place during a
  // synchronous refresh. Never schedule a later scroll that overrides a swipe.
  function preserveScroll(root, render) {
    const saved = new Map();
    function capture(el) {
      return { top: el.scrollTop, left: el.scrollLeft,
        bottom: el.scrollHeight - el.clientHeight - el.scrollTop <= 8 };
    }
    const rootPos = capture(root);
    root.querySelectorAll('[data-mbl-scroll-key]').forEach(el => {
      saved.set(el.dataset.mblScrollKey, capture(el));
    });
    try { return render(); }
    finally {
      root.scrollTop = rootPos.top;
      root.scrollLeft = rootPos.left;
      root.querySelectorAll('[data-mbl-scroll-key]').forEach(el => {
        const pos = saved.get(el.dataset.mblScrollKey);
        if (!pos) return;
        el.scrollTop = pos.bottom && el.hasAttribute('data-mbl-follow-bottom') ? el.scrollHeight : pos.top;
        el.scrollLeft = pos.left;
      });
    }
  }

  function syncLayers(openPosition, opener) {
    const native = Array.from(document.querySelectorAll('dialog[open]'));
    const backdrops = legacyPanels();
    const previous = active;
    const opening = coreOpening;
    for (const dialog of native) {
      if (!layers.has(dialog)) layers.set(dialog, { order: ++order, position: position() });
    }
    native.sort((a, b) => layers.get(a).order - layers.get(b).order);
    active = native.at(-1) || backdrops.at(-1) || null;
    for (const el of native.concat(backdrops)) {
      el.classList.toggle('mbl-overlay-suspended', el !== active);
    }
    // One page anchor for the entire chain (wealth → spending → wealth,
    // or player card → confirmation → player card). Never reuse it in another career.
    if (page && (page.owner !== C.life() || page.screen !== C.screen())) {
      page = null;
      panelScrolls.clear();
    }
    if (active && !page) {
      page = { position: openPosition || opening?.position || position(), owner: C.life(), screen: C.screen(),
        focus: opener || document.activeElement, control: opening?.focus };
    }
    document.documentElement.classList.toggle('mbl-page-locked', !!active);
    document.body.classList.toggle('mbl-overlay-open', !!active);
    document.body.classList.toggle('mbl-legacy-overlay-open', !!active && !native.length);
    isolateLegacy(native.length ? null : active);
    keyboardViewport();
    if (active) {
      if (active !== previous && !native.length && !active.contains(document.activeElement)) {
        const control = active.querySelector('.modal-top button:not(:disabled), button:not(:disabled), input:not(:disabled)');
        control?.focus({ preventScroll: true });
      }
      if (active !== previous) restore(page.position);
    } else if (page) {
      const saved = page;
      page = null;
      panelScrolls.clear();
      const focus=saved.focus?.isConnected&&saved.focus!==document.body?saved.focus:
        findControl(saved.control,document.querySelector('#app')) || document.querySelector('.mbl-dock [aria-current=page]');
      focus?.focus({ preventScroll: true });
      restore(saved.position);
    }
  }

  // Native top-layer dialogs must retain their own close/cancel lifecycle. The manager
  // only suppresses lower layers, so a confirmation can return to its parent panel.
  const proto = window.HTMLDialogElement?.prototype;
  if (proto) {
    const show = proto.showModal;
    const close = proto.close;
    proto.showModal = function () {
      const pos = position();
      const opener = document.activeElement;
      isolateLegacy(null);
      let result;
      try { result = show.apply(this, arguments); }
      catch(error){syncLayers();throw error;}
      layers.set(this, { order: ++order, opener });
      syncLayers(pos, opener);
      return result;
    };
    proto.close = function () {
      const opener = layers.get(this)?.opener;
      const result = close.apply(this, arguments);
      this.classList.remove('mbl-overlay-suspended');
      syncLayers();
      if (opener?.isConnected && active?.contains(opener)) opener.focus({ preventScroll: true });
      layers.delete(this);
      return result;
    };
  }
  document.addEventListener('close', event => {
    const saved = layers.get(event.target);
    if (!saved || event.target.open) return;
    event.target.classList.remove('mbl-overlay-suspended');
    syncLayers();
    if (saved.opener?.isConnected && active?.contains(saved.opener)) saved.opener.focus({ preventScroll: true });
    layers.delete(event.target);
  }, true);

  function blockBackgroundScroll(event) {
    if (!active || !active.isConnected) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const content = active.matches('dialog:not(.mbl-overlay-host)') ? active : (active.querySelector('.modal') || active);
    if (!content || !content.contains(target)) event.preventDefault();
  }
  document.addEventListener('wheel', blockBackgroundScroll, { passive: false });
  document.addEventListener('touchmove', blockBackgroundScroll, { passive: false });

  function guardBackground(event) {
    if (!active?.isConnected || active.contains(event.target)) return;
    // Keep engine-driven progression separate from real pointer input.
    if (event.isTrusted) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
  document.addEventListener('pointerdown', guardBackground, true);
  document.addEventListener('click', guardBackground, true);
  document.addEventListener('keydown', event => {
    if (!active?.isConnected) return;
    if (active.matches('dialog') && event.key === 'Escape') {
      // Native cancel owns Escape even when the dialog wraps a legacy panel.
      event.stopImmediatePropagation();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = Array.from(active.querySelectorAll('button, a[href], input, select, textarea, summary, [contenteditable=true], [tabindex]'))
      .filter(el => !el.disabled && (el.tabIndex >= 0 || el.matches('summary:not([tabindex])')) && el.getClientRects().length && getComputedStyle(el).visibility==='visible');
    if (!controls.length) { event.preventDefault(); return; }
    const first = controls[0], last = controls.at(-1);
    const focused = document.activeElement;
    if (!active.contains(focused) || (event.shiftKey ? focused === first : focused === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus({ preventScroll: true });
    }
  }, true);

  function beforeCoreRender() {
    rememberPanels();
    coreOpening={position:position(),focus:controlPosition(document.querySelector('#app'))};
    coreView = window.MBLNavDock?.detachForCore?.();
  }

  function afterCoreRender() {
    window.MBLNavDock?.reattachAfterCore?.(coreView);
    coreView = null;
    syncLayers();
    // Finance cards are injected after the core template. Populate them before
    // restoring the panel scroll range, so long lists do not clamp to the top.
    try { window.MBLArenaFinance?.mount(); } catch (error) { console.error('[overlay finance]', error); }
    restorePanels();
    if (page) restore(page.position);
    coreOpening=null;
    // The core template may replace an outcome or its controls even when
    // the next animation-frame DOM batch has not run yet.
    try { window.MBLAlerts?.refresh(); } catch (error) { console.error('[overlay alerts]',error); }
  }

  C.onDom(() => syncLayers());
  syncLayers();
  window.MBLInteraction = { beforeCoreRender, afterCoreRender, syncLayers, position, restore, preserveScroll, tabKeys, isTop: element => active === element };
})();
