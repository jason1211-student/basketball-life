(function () {
  'use strict';
  if (window.MBLAlerts) return;
  const C = window.MBLCore;
  let owner = null;
  let rendered = '';

  function noticeIndices(life, values) {
    return [...new Set((Array.isArray(values) ? values : [])
      .filter(index => Number.isInteger(index) && index >= 0 && life.log?.[index]?.notice))];
  }
  function validOutcome(life, outcome) {
    return outcome && Number.isInteger(outcome.at) && outcome.at >= 0 &&
      life.log?.[outcome.at] && outcome.view?.template?.title;
  }
  function savedOutcome(life, outcome) {
    if (!validOutcome(life,outcome)) return null;
    const view = outcome.view;
    const choice = view.choices?.find(item => item.def?.key === outcome.key)?.def;
    // Only the display data needed by the existing result card is persisted.
    // Do not serialize a template's apply/params callbacks or replay its effects.
    return {
      at:outcome.at, key:outcome.key,
      view:{params:view.params || {},pool:view.pool || 'life',
        template:{title:view.template.title,look:view.template.look || ''},
        choices:choice ? [{def:{key:choice.key,text:choice.text}}] : []}
    };
  }
  function restoreCore(life) {
    if (owner === life) return;
    owner = life;
    const saved = life.flags?.mblAlerts;
    if (!saved || saved.version !== 1) return; // Old careers use the existing notice cursor.
    de.noticeSeen = Math.max(0,Math.min(life.log.length,
      Number.isInteger(saved.cursor) ? saved.cursor : life.log.length));
    de.notices = noticeIndices(life,saved.notices);
    de.outcome = validOutcome(life,saved.outcome) ? savedOutcome(life,saved.outcome) : null;
    de.decisionHidden = !!saved.hidden && !!life.pending?.length;
  }
  function captureCore(life) {
    if (!life?.flags) return;
    const next = {version:1,cursor:life.log.length,notices:noticeIndices(life,de.notices),
      outcome:savedOutcome(life,de.outcome),hidden:!!de.decisionHidden && !!life.pending?.length};
    const previous = life.flags.mblAlerts;
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    life.flags.mblAlerts = next;
    // A cursor-only advance over ordinary log entries can wait for the next
    // core save. Newly queued/acknowledged notices and choices must commit now.
    if (!previous || previous.version!==1 || previous.hidden!==next.hidden ||
        JSON.stringify(previous.notices)!==JSON.stringify(next.notices) ||
        JSON.stringify(previous.outcome)!==JSON.stringify(next.outcome)) window.Nt?.saveLife?.(life);
  }

  function titleOf(value, params, fallback) {
    let title = C.hans(value);
    if (title && params && typeof window.Lt === 'function') {
      try { title = C.hans(window.Lt(value,params)); } catch (_) {}
    }
    if (!title || /\{[^}]+\}/.test(title)) return fallback;
    return title;
  }
  function seasonTask(life) {
    if (!life?.alive) return null;
    const season = life.ball?.season;
    if (!season || (typeof window.Gr === 'function' && season.year !== window.Gr(life))) return null;
    if (season.phase === 'regular' && season.games?.length >= season.total &&
        season.total > 0 && (typeof window.Oa !== 'function' || window.Oa(life) === season)) {
      return {title:'常规赛已结束',detail:'查看晋级结果并进入下一阶段',selector:'.mbl-season-transition'};
    }
    if (season.phase === 'playoffs') {
      return {title:'季后赛待进行',detail:'查看对阵并安排下一场比赛',selector:'.mbl-pb-action'};
    }
    if (season.phase === 'done') {
      return {title:'赛季已结束',detail:'查看成绩并继续休赛期',selector:'.mbl-pb-action'};
    }
    return null;
  }
  function collect(life = C.life(), ui = window.de) {
    const data = {decisions:[],notices:[],outcome:null,era:null,messages:[],appointments:[],season:null,core:0,
      unread:0,due:0,home:0,people:0,total:0};
    if (!life) return data;
    if (life.alive) {
      data.decisions = (life.pending || []).map(pending => ({
        title:titleOf(typeof window.b0 === 'function' ? window.b0(pending.tid)?.title : null,pending.params,'待处理的生涯抉择')
      }));
    }
    data.notices = noticeIndices(life,ui?.notices).map(index => ({
      index,title:titleOf(life.log[index].text,life.log[index].params,'生涯通知')
    }));
    if (validOutcome(life,ui?.outcome)) {
      data.outcome = {title:titleOf(ui.outcome.view.template.title,ui.outcome.view.params,'事件结果')};
    }
    const era=life.flags?.__dynastyPopup;
    if (era) data.era={title:era.title||'历史时刻'};
    const social = window.MBLRelationsMessages?.notifications(life) || {messages:[],appointments:[]};
    data.messages = social.messages;
    data.appointments = social.appointments.concat(window.MBLLifeCalendar?.notifications(life)||[]);
    data.season = seasonTask(life);
    data.core = data.decisions.length + data.notices.length + Number(!!data.outcome) + Number(!!data.era);
    data.unread = data.messages.reduce((total,item) => total + item.count,0);
    data.due = data.appointments.filter(item => item.due).length;
    data.path=!!(life.flags?.mblPathway?.review||life.flags?.mblPathway?.observationDue);
    data.home = data.core + Number(!!data.season)+Number(data.path);
    data.people = data.unread + data.due;
    data.total = data.home + data.people;
    return data;
  }

  const dialog = C.h('dialog','mbl-alert-center');
  dialog.setAttribute('aria-labelledby','mbl-alert-heading');
  const head = C.h('header','mbl-alert-head');
  const heading = C.h('h2','','待办中心');
  heading.id = 'mbl-alert-heading';
  const closeBtn = C.h('button','mbl-alert-close','关闭');
  closeBtn.type = 'button';
  const body = C.h('div','mbl-alert-body');
  head.append(heading,closeBtn);
  dialog.append(head,body);
  document.body.append(dialog);
  closeBtn.onclick = () => dialog.close();
  dialog.addEventListener('click',event => { if (event.target === dialog) dialog.close(); });

  function busy() {
    return !!(window.__mblAutoSim || window.MBLSeasonCommand?.busy());
  }
  function open() {
    if (busy() || C.screen() !== 'play' || !C.life()) return;
    if(!de.paused||de.auto){de.paused=true;de.auto=false;window.mn?.();}
    rendered = '';
    render(collect());
    if (!dialog.open) dialog.showModal();
  }
  function focusCore() {
    if (window.MBLDynasty?.showPending()) {
      document.querySelector('.mbl-era-pop[open] .mbl-era-pop-ok')?.focus({preventScroll:true});
      return;
    }
    const reveal = document.querySelector('main.play [data-act="showdecision"]');
    if (reveal) reveal.click();
    else window.mn?.();
    const control = document.querySelector('main.play [data-act="noticeok"],main.play [data-act="dismiss"],main.play [data-act="choose"]:not(:disabled),main.play [data-act="draftdone"]');
    control?.focus({preventScroll:true});
  }
  function goToSeason() {
    const data = collect();
    if (data.core) {focusCore();return;}
    if (!data.season) return;
    window.MBLNavDock?.open('home');
    window.MBLTeamCalendar?.refresh();
    window.MBLPlayoffBracket?.refresh();
    const target = document.querySelector(data.season.selector);
    target?.scrollIntoView({block:'center',behavior:'instant'});
    const control = target?.matches('button') ? target : target?.querySelector('button:not(:disabled)');
    control?.focus({preventScroll:true});
  }
  function openMessage(id) {
    if (window.MBLRelationsMessages?.selectConversation(id)) window.MBLRelationsPanel?.open('messages');
  }
  function openAppointment(id) {
    if(id.startsWith('life-')){
      window.MBLSchedulePanel?.open();
      const card=[...document.querySelectorAll('dialog[open] [data-life-plan]')].find(n=>n.dataset.lifePlan===id);
      card?.scrollIntoView({block:'nearest'});return;
    }
    window.MBLRelationsPanel?.open('appointments');
    const target = [...document.querySelectorAll('.arena-phone [data-mbl-appointment-id]')]
      .find(node=>node.dataset.mblAppointmentId===id);
    target?.scrollIntoView({block:'nearest',behavior:'instant'});
  }
  function row(title,detail,count,action) {
    const item = C.h('button','mbl-alert-row');
    item.type = 'button';
    const copy = C.h('span','mbl-alert-copy');
    copy.append(C.h('b','',title),C.h('small','',detail));
    item.append(copy);
    if (count) item.append(C.h('span','mbl-alert-badge',count>99?'99+':String(count)));
    item.append(C.h('span','mbl-alert-arrow','›'));
    const life = C.life();
    item.onclick = () => {
      if (C.life()!==life || busy()) return;
      dialog.close();
      action();
      mount();
    };
    return item;
  }
  function section(title) {
    const group = C.h('section','mbl-alert-group');
    group.append(C.h('h3','',title));
    return group;
  }
  function render(data) {
    const signature = JSON.stringify(data);
    if (rendered === signature) return;
    rendered = signature;
    window.MBLInteraction.preserveScroll(body,() => {
      const groups = [];
      const intro = C.h('div','mbl-alert-intro');
      intro.append(C.h('strong','',String(data.total)), C.h('span','',data.total?'项待处理':'当前无待处理事项'));
      groups.push(intro);
      if (data.core) {
        const group = section('生涯事项');
        if (data.outcome) group.append(row('事件结果',data.outcome.title,1,focusCore));
        if (data.notices.length) group.append(row('未查看的通知',data.notices[0].title,data.notices.length,focusCore));
        if (data.era) group.append(row('历史时刻',data.era.title,1,focusCore));
        if (data.decisions.length) group.append(row('等待你的决定',data.decisions[0].title,data.decisions.length,focusCore));
        if (data.core>1) group.append(C.h('p','mbl-alert-hint','请先处理当前显示的生涯事项。'));
        groups.push(group);
      }
      if(data.path){const group=section('发展路线');group.append(row('阶段考察已结束','查看表现与下一步选择',1,()=>window.MBLPathwayPanel.open()));groups.push(group);}
      if (data.season) {
        const group=section('赛季进度');
        group.append(row(data.season.title,data.core?'先处理生涯事项，再继续赛季':data.season.detail,1,goToSeason));
        groups.push(group);
      }
      if (data.messages.length) {
        const group=section('未读短信');
        for (const message of data.messages) group.append(row(message.name,'进入私人对话',message.count,()=>openMessage(message.id)));
        groups.push(group);
      }
      if (data.appointments.length) {
        const group=section('私人约定');
        for (const item of data.appointments.slice().sort((a,b)=>Number(b.due)-Number(a.due))) {
          group.append(row(item.name+' · '+item.kind,item.deadline+(item.due?' · 待赴约':' · 已安排'),Number(item.due),()=>openAppointment(item.id)));
        }
        groups.push(group);
      }
      if (!data.total && !data.appointments.length) groups.push(C.h('p','mbl-alert-empty','可以继续训练、比赛或推进生活。'));
      body.replaceChildren(...groups);
    });
  }
  function badge(selector,count) {
    for (const target of document.querySelectorAll(selector)) {
      const existing = target.querySelector(':scope > .mbl-alert-indicator');
      if (!count) {existing?.remove();continue;}
      const value = count>99?'99+':String(count);
      const node = existing || C.h('span','mbl-alert-indicator',value);
      if (node.getAttribute('aria-label')!==count+' 项待处理') node.setAttribute('aria-label',count+' 项待处理');
      if (node.textContent!==value) node.textContent=value;
      if (!existing) target.append(node);
    }
  }
  function mount() {
    if (C.screen() !== 'play') {if (dialog.open) dialog.close();return;}
    const data = collect();
    const entry = document.querySelector('main.play .mbl-alert-entry');
    if (entry) {
      entry.disabled = busy();
      const total = entry.querySelector('[data-mbl-alert-total]');
      const status = entry.querySelector('[data-mbl-alert-status]');
      const value = data.total>99?'99+':String(data.total);
      if (total && total.textContent!==value) total.textContent=value;
      if (status && status.textContent!==(data.total?'有事项等待处理':'当前无待办')) status.textContent=data.total?'有事项等待处理':'当前无待办';
      entry.classList.toggle('has-alerts',!!data.total);
    }
    badge('.mbl-dock-btn[data-tab="home"]',data.home);
    badge('.mbl-dock-btn[data-tab="people"]',data.people);
    badge('.arena-action[data-arena-open="messages"],[data-mbl-alert-kind="messages"]',data.unread);
    badge('.arena-action[data-arena-open="schedule"],[data-mbl-alert-kind="appointments"]',data.due);
    badge('button.pending-pill',data.decisions.length);
    // Offer the same inbox from an already open core decision/result/notice.
    const corePanel = document.querySelector('.mbl-era-pop[open] .mbl-era-pop-card') ||
      document.querySelector('main.play .modal-backdrop[data-key^="d"] .modal,main.play .modal-backdrop[data-key^="o"] .modal,main.play .modal-backdrop[data-key^="n"] .modal');
    if (corePanel && data.total) {
      let link = corePanel.querySelector(':scope > .mbl-alert-modal-link');
      if (!link) {
        link=C.h('button','mbl-alert-modal-link');
        link.type='button';link.setAttribute('data-mbl-alert-open','');corePanel.prepend(link);
      }
      if (link.textContent!=='待办中心 · '+data.total) link.textContent='待办中心 · '+data.total;
      link.disabled=busy();
    }
    if (dialog.open) render(data);
  }
  document.addEventListener('click',event => {
    if (event.target.closest?.('[data-mbl-alert-open]')) open();
  });
  C.onDom(mount,'play');
  C.onHeartbeat(mount,400);
  window.MBLAlerts = {collect,restoreCore,captureCore,open,refresh:mount};
  mount();
})();
