(function () {
  'use strict';
  if (window.MBLInteraction) return;
  const C = window.MBLCore;
  const layers = new WeakMap();
  let order = 0;
  let active = null;
  let coreView = null;

  function position() { return { x: window.scrollX, y: window.scrollY }; }
  function restore(pos) {
    if (pos && (Math.abs(window.scrollX - pos.x) > 1 || Math.abs(window.scrollY - pos.y) > 1)) {
      window.scrollTo({ left: pos.x, top: pos.y, behavior: 'instant' });
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

  function syncLayers() {
    const native = Array.from(document.querySelectorAll('dialog[open]'));
    const backdrops = Array.from(document.querySelectorAll('.modal-backdrop')).filter(el => !el.closest('dialog') && el.getClientRects().length);
    for (const dialog of native) {
      if (!layers.has(dialog)) layers.set(dialog, { order: ++order, position: position() });
    }
    native.sort((a, b) => layers.get(a).order - layers.get(b).order);
    active = native.at(-1) || backdrops.at(-1) || null;
    for (const el of native.concat(backdrops)) {
      el.classList.toggle('mbl-overlay-suspended', el !== active);
    }
    document.body.classList.toggle('mbl-overlay-open', !!active);
    if (active) document.querySelector('.mbl-fab-dial')?.classList.remove('is-open');
  }

  // Native top-layer dialogs must retain their own close/cancel lifecycle. The manager
  // only suppresses lower layers, so a confirmation can return to its parent panel.
  const proto = window.HTMLDialogElement?.prototype;
  if (proto) {
    const show = proto.showModal;
    const close = proto.close;
    proto.showModal = function () {
      const pos = position();
      const result = show.apply(this, arguments);
      layers.set(this, { order: ++order, position: pos });
      syncLayers();
      restore(pos);
      return result;
    };
    proto.close = function () {
      const saved = layers.get(this);
      const wasActive = active === this;
      const result = close.apply(this, arguments);
      this.classList.remove('mbl-overlay-suspended');
      syncLayers();
      if (wasActive) restore(saved?.position);
      layers.delete(this);
      return result;
    };
  }
  document.addEventListener('close', event => {
    const saved = layers.get(event.target);
    if (!saved || event.target.open) return;
    event.target.classList.remove('mbl-overlay-suspended');
    syncLayers();
    if (!active || !layers.has(active) || layers.get(active).order < saved.order) restore(saved.position);
    layers.delete(event.target);
  }, true);

  function blockBackgroundScroll(event) {
    if (!active || !active.isConnected) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const content = active.matches('dialog:not(.mbl-overlay-host)') ? active : active.querySelector('.modal');
    if (!content || !content.contains(target)) event.preventDefault();
  }
  document.addEventListener('wheel', blockBackgroundScroll, { passive: false });
  document.addEventListener('touchmove', blockBackgroundScroll, { passive: false });

  function beforeCoreRender() {
    coreView = window.MBLNavDock?.detachForCore?.();
  }

  function afterCoreRender() {
    window.MBLNavDock?.reattachAfterCore?.(coreView);
    coreView = null;
    syncLayers();
  }

  C.onDom(syncLayers);
  syncLayers();
  window.MBLInteraction = { beforeCoreRender, afterCoreRender, syncLayers, position, restore, preserveScroll, isTop: element => active === element };
})();
