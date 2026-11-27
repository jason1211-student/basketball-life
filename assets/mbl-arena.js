/* Arena: additive presentation shell. Game outcomes, saves and actions remain in the engine. */
(function () {
  'use strict';
  if (window.MBLArena) return;
  const C = window.MBLCore;
  const h = C.h;
  const root = document.documentElement;
  const titles = {
    home: '生涯指挥台',
    ball: '球员发展中心',
    team: '球队运营中心',
    journey: '生涯档案馆',
    people: '人际关系圈'
  };

  function decorateView(id, container) {
    if (!container || !titles[id] || container.querySelector(':scope > .arena-section-heading')) return;
    const title = titles[id];
    const heading = h('header', 'arena-section-heading');
    heading.append(h('h2', '', title));
    if(id==='people'&&window.MBLCareerArt){
      heading.classList.add('mbl-art-family');
      heading.prepend(MBLCareerArt.picture('family',500));
    }
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
    const messagesButton=actions.querySelector('[data-arena-open="messages"]');
    const scheduleButton=actions.querySelector('[data-arena-open="schedule"]');
    if(messagesButton)messagesButton.onclick=()=>window.MBLRelationsPanel?.open(window.MBLRelationsMessages?.canUsePhone(C.life())?'messages':'relationships');
    if(scheduleButton)scheduleButton.onclick=()=>window.MBLSchedulePanel?.open();
    actions.querySelectorAll('button[data-act]').forEach(b => { b.disabled = !alive; });
    const finance=actions.querySelector('button:first-child');
    if(finance){finance.dataset.act=C.life()?.pending?.length&&!window.de?.decisionHidden?'spendopen':'moneyopen';}
    const messages = actions.querySelector('button:nth-child(3) small');
    const life=C.life();
    window.MBLCareerArt?.header(bar.querySelector('.arena-player-avatar'),life);
    const underage=life&&!window.MBLRelationsMessages?.canUsePhone(life);
    const messageTitle=actions.querySelector('button:nth-child(3) b');
    if(messageTitle&&messageTitle.textContent!==(underage?'家庭':'消息'))messageTitle.textContent=underage?'家庭':'消息';
    const unread = life ? window.MBLRelationsMessages?.summary(life).unread || 0 : 0;
    const caption = underage?'与家人相处':unread ? `${unread} 条未读` : '联系人与短信';
    if (messages && messages.textContent !== caption) messages.textContent = caption;
    const scheduleCaption=scheduleButton?.querySelector('small');
    if(scheduleCaption&&scheduleCaption.textContent!==(underage?'训练与计划':'计划与约定'))scheduleCaption.textContent=underage?'训练与计划':'计划与约定';
  }

  function decorateLanding() {
    const intro = document.querySelector('main.home .introtext');
    if (!intro || intro.querySelector('.arena-landing-label')) return;
    const label = h('div', 'arena-landing-label');
    label.append(h('span', 'arena-monogram', 'MBL'));
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
