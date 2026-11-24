/* Arena: additive presentation shell. Game outcomes, saves and actions remain in the engine. */
(function () {
  'use strict';
  if (window.MBLArena) return;
  const C = window.MBLCore;
  const h = C.h;
  const root = document.documentElement;
  const titles = {
    home: ['01 / CAREER', '生涯指挥台', '每一天，都是职业生涯的一部分。'],
    ball: ['02 / PERFORMANCE', '球员发展中心', '能力、训练与比赛表现'],
    team: ['03 / FRANCHISE', '球队运营中心', '阵容、合同与赛季动态'],
    journey: ['04 / LEGACY', '生涯档案馆', '见证每一次突破与荣耀'],
    people: ['05 / SOCIAL', '人际关系圈', '场外的生活同样重要']
  };

  function decorateView(id, container) {
    if (!container || !titles[id] || container.querySelector(':scope > .arena-section-heading')) return;
    const [code, title, sub] = titles[id];
    const heading = h('header', 'arena-section-heading');
    heading.append(h('span', 'arena-eyebrow', code), h('h2', '', title), h('p', '', sub));
    container.prepend(heading);
  }

  function action(label, caption, act, handler) {
    const b = h('button', 'arena-action');
    b.type = 'button';
    b.append(h('b', '', label), h('small', '', caption), h('span', 'arena-arrow', '↗'));
    if (act) b.dataset.act = act;
    else b.addEventListener('click', handler);
    return b;
  }

  function decorateHeader(main) {
    const bar = main.querySelector('header.lifebar');
    if (!bar) return;
    if (!bar.querySelector('.arena-brandline')) {
      const mark = h('div', 'arena-brandline');
      mark.append(h('span', 'arena-monogram', 'MBL'), h('span', 'arena-brandtext', 'MY BASKETBALL LIFE'), h('span', 'arena-edition', '生涯模式'));
      bar.prepend(mark);
    }
    let actions = bar.querySelector('.arena-action-grid');
    if (!actions) {
      actions = h('div', 'arena-action-grid');
      actions.setAttribute('aria-label', '生涯快捷操作');
      actions.append(
        action('财务', '资产与消费', 'moneyopen'),
        action('重心', '发展策略', 'focusopen'),
        action('消息', '联系人与短信', '', () => window.MBLRelationsPanel?.open('messages')),
        action('日程', '计划与约定', '', () => window.MBLSchedulePanel?.open())
      );
      bar.append(actions);
    }
    const alive = C.life()?.alive !== false;
    actions.querySelectorAll('button[data-act]').forEach(b => { b.disabled = !alive; });
    const finance=actions.querySelector('button:first-child');
    if(finance){finance.dataset.act=C.life()?.pending?.length&&!window.de?.decisionHidden?'spendopen':'moneyopen';}
    const messages = actions.querySelector('button:nth-child(3) small');
    const life=C.life();
    const unread = life ? window.MBLRelationsMessages?.summary(life).unread || 0 : 0;
    const caption = unread ? `${unread} 条未读` : '联系人与短信';
    if (messages && messages.textContent !== caption) messages.textContent = caption;
  }

  function decorateLanding() {
    const intro = document.querySelector('main.home .introtext');
    if (!intro || intro.querySelector('.arena-landing-label')) return;
    const label = h('div', 'arena-landing-label');
    label.append(h('span', 'arena-monogram', 'MBL'), h('span', '', 'YOUR COURT. YOUR STORY.'));
    intro.prepend(label);
  }

  function mount() {
    decorateLanding();
    const main = document.querySelector('main.play');
    if (!main) return;
    decorateHeader(main);
    const home = main.querySelector('.mbl-view[data-view="home"]');
    if (home) decorateView('home', home);
  }

  root.classList.add('mbl-arena');
  window.MBLArena = { decorateView, mount };
  C.onDom(mount);
  mount();
})();
