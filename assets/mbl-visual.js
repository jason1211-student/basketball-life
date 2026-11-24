(function () {
  'use strict';
  if (window.MBLVisual) return;
  const C = window.MBLCore;
  const root = document.documentElement;
  let currentKey = '';

  function describe(life, screen) {
    if (screen === 'home' || screen === 'boot' || !life) return { stage: 'landing', team: null };
    if (screen === 'birth') return { stage: 'birth', team: null };
    if (life.alive === false || life.retired || life.ball?.retiredFromPlaying) return { stage: 'legacy', team: null };
    if (life.ball?.pro) return { stage: 'pro', team: life.ball.pro.team || life.ball.season?.team };
    return { stage: life.age < 13 ? 'childhood' : 'youth', team: null };
  }

  function refresh() {
    const context = describe(C.life(), C.screen());
    const teamColor = context.team && window.MBLBroadcast?.teamColor?.(context.team);
    const key = context.stage + '|' + (teamColor || '');
    if (currentKey === key) return;
    currentKey = key;
    root.dataset.mblStage = context.stage;
    if (teamColor) root.style.setProperty('--mbl-team-color', teamColor);
    else root.style.removeProperty('--mbl-team-color');
  }

  root.classList.add('mbl-visual');
  C.onDom(refresh);
  window.addEventListener('mbl:state-changed', refresh);
  refresh();
  window.MBLVisual = { refresh, describe };
})();
