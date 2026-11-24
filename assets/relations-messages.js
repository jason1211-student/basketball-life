(function () {
  'use strict';
  if (window.MBLRelationsMessages) return;
  const C = window.MBLCore;
  const make = C.h;

  const personalities = {
    mother: { label: '母亲', trait: '关心生活细节', hello: '今天吃了什么？我们这边都好，你忙完了再回。', promise: '给妈妈打个电话' },
    father: { label: '父亲', trait: '习惯用行动帮忙', hello: '我刚把家里的篮筐拧紧。你下回回来，看看还歪不歪。', promise: '给爸爸打个电话' },
    partner: { label: '伴侣', trait: '重视一起安排时间', hello: '我翻日历才发现，这周我们还没留过一个晚上给自己。', promise: '抽时间和伴侣聊聊' },
    sibling: { label: '兄弟姐妹', trait: '直来直去', hello: '我看中两个新岗位。你有空帮我看看？别只回「都行」。', promise: '打电话聊聊近况' },
    child: { label: '孩子', trait: '喜欢分享小事', hello: '我今天投进了一个球，有人看见！下次给你看。', promise: '抽时间听孩子讲近况' },
    teammate: { label: '队友', trait: '用玩笑打破沉默', hello: '找到一张老训练照。放心，你的发型我只发给你。', promise: '给队友打个电话' },
    friend: { label: '朋友', trait: '愿意听你慢慢说', hello: '路过以前常去的店，老板还记得你点什么。', promise: '给朋友打个电话' }
  };

  const events = {
    contract: {
      father: '签好了？第一笔薪水什么时候发？合同留一份，回家我们一起看看。',
      mother: '看到签约消息了！等你忙完，给我讲讲签字的时候是什么感觉。',
      partner: '恭喜！庆祝我们可以慢慢来。你先把下周的日程发我，我们留个晚上。',
      teammate: '第一份合同到手，终于可以换掉那双训练鞋了。说真的，替你高兴。',
      friend: '我记得你第一次去试训时紧张得睡不着。今天想怎么庆祝？'
    },
    injury: {
      mother: '受伤以后有吃东西吗？冰袋别直接贴皮肤。医生怎么说，有空告诉我。',
      father: '检查做了吗？需要接送就发地址，我把时间腾出来。',
      partner: '我先把晚上的安排挪开了。你想让我陪着，还是先自己安静一会？',
      teammate: '以前总说你该练左手，没想到是这样强制休息。等你愿意聊，我在。',
      friend: '听说你受伤了。想聊恢复就聊恢复，想说点别的也行。'
    },
    trade: {
      father: '新城市什么时候报到？给我个日期，我好看看能不能去帮你收拾。',
      mother: '行李有地方放吗？到新地方了记得告诉我一声。',
      partner: '你先去新球队报到吧。我手上的项目还得收尾，走不开。你能来见我一次吗？我们当面商量接下来住哪。',
      teammate: '更衣室那件训练衫还在。给你寄过去？新队那边慢慢来，有事给我打电话。',
      friend: '换了球队，日常估计也得重新适应。等你落地我们聊聊。'
    },
    allowance: {
      mother: '补贴收到了，我先留一部分交水电。你最近训练到几点？别只顾着给家里打钱。',
      father: '这笔钱够把家里的开销安排好了。下次有空打个电话，想听听你那边怎么样。'
    }
  };

  const replyText = {
    brief: '收到，你先忙。等有空我们再说。',
    promise: '好，那我等你联系。时间有变，和我说一声。',
    kept: '今天聊完挺高兴的。下次你有事，也可以先跟我说。',
    moved: '谢谢你提前告诉我。等你方便，我们再找时间。',
    missed: '上次说要联系，后来一直没等到。我有点担心，下次有变就发个消息。'
  };

  const eventReplies = {
    contract: ['和对方分享签约那一刻', '签字时我手都在抖。走出来以后才觉得这事是真的。'],
    injury: ['告诉对方恢复情况', '我会按安排做复查。现在最难的是接受自己得慢一点。'],
    trade: ['聊聊接下来的安排', '报到时间一确定我就告诉你。我想先把住处和见面的时间定下来。'],
    allowance: ['问问家里最近需要什么', '家里最近还有什么开销？有事先和我商量，别自己扛。']
  };

  const warmReplies = {
    mother: '那我放心一点了。你今天还有空好好吃顿饭吗？',
    father: '好。要我搭把手就说，先把你现在能定的事定下来。',
    partner: '我明白了。那我们把能一起留出来的时间先定下来。',
    teammate: '难得听你讲这么多。下次训练别指望我对你放水啊。',
    friend: '谢谢你跟我说这些。你哪天还想聊，随时找我。'
  };

  let activeLife;
  let activeContact = '';
  let filterMode = 'all', searchText = '';
  const threadScroll = new Map();

  function ensureOwner(life) {
    if (activeLife === life) return;
    activeLife = life; activeContact = ''; filterMode = 'all'; searchText = ''; threadScroll.clear();
  }

  function nameKey(person) {
    return person.name?.en || C.hans(person.name);
  }

  function contacts(life) {
    const family = typeof window.S_ === 'function' ? window.S_(life) : [];
    const relatives = family.filter(({ p, kin }) => p.alive && personalities[kin] && (kin !== 'child' || p.age >= 8))
      .map(({ p, kin }) => ({ id: JSON.stringify([kin, nameKey(p)]), role: kin, person: p }));
    const friends = (life.ball?.friends || []).filter(person => !person.gone && !person.rival)
      .map(person => ({ id: JSON.stringify(['friend', nameKey(person), person.metAge ?? null]), role: person.club || person.pro ? 'teammate' : 'friend', person }));
    return relatives.concat(friends);
  }

  function score(contact) {
    const value = contact.role === 'friend' || contact.role === 'teammate'
      ? contact.person.rel : contact.person.bond ?? 60;
    return Math.round(C.clamp(Number(value) || 0, 0, 100));
  }

  function changeScore(life, contact, delta) {
    const before = score(contact);
    if (contact.role === 'friend' || contact.role === 'teammate') window.Xe(contact.person, delta);
    else window.Ie(life, contact.person, delta);
    return score(contact) - before;
  }

  function threadFor(state, contact) {
    return state.threads[contact.id] ||= { messages: [], unread: 0 };
  }

  function append(thread, age, text, fromPlayer = false) {
    thread.messages.push({ age, text, fromPlayer });
    if (!fromPlayer) thread.unread++;
    if (thread.messages.length > 30) {
      const dropped = thread.messages.shift();
      if (!dropped.fromPlayer) thread.unread = Math.min(thread.unread, 30);
    }
  }

  function deliver(state, contact, age, eventName, text) {
    const thread = threadFor(state, contact);
    append(thread, age, text);
    thread.inbox ||= [];
    thread.inbox.push(eventName);
    if (thread.inbox.length > 10) thread.inbox.shift();
  }

  function seasonKey(season) {
    return JSON.stringify([season.year, season.leagueId, season.team?.en || C.hans(season.team)]);
  }

  function nextDeadline(life, previous) {
    const season = typeof window.Oa === 'function' ? window.Oa(life) : null;
    if (season) {
      let game = season.games.length;
      if (previous?.kind === 'game' && previous.season === seasonKey(season)) game = Math.max(game, previous.game);
      if (game % 2) game++;
      if (game < season.total) return { kind: 'game', season: seasonKey(season), game: game + 1, age: life.age };
    }
    const age = previous?.kind === 'year' ? Math.max(life.age, previous.age + 1) : life.age;
    return { kind: 'year', age };
  }

  function deadlineState(life, deadline) {
    if (life.age > deadline.age) return 'missed';
    if (deadline.kind === 'year') return 'upcoming';
    const season = life.ball.season;
    if (!season || seasonKey(season) !== deadline.season) return 'missed';
    if (season.games.length > deadline.game || (season.phase !== 'regular' && season.games.length < deadline.game)) return 'missed';
    return season.games.length === deadline.game ? 'due' : 'upcoming';
  }

  function deadlineLabel(deadline) {
    return (deadline.kind === 'game' ? '第 ' + deadline.game + ' 场主场赛后' : deadline.age + ' 岁结束前');
  }

  function finishPromise(life, contact, thread, outcome) {
    const promise = thread.promise;
    const history = thread.appointments ||= [];
    history.push({ deadline: promise.deadline, outcome, kind: promise.kind });
    if (history.length > 6) history.shift();
    delete thread.promise;
    const adjustment = outcome === 'kept' ? 4 : outcome === 'missed' ? -3 : 0;
    const delta = adjustment ? changeScore(life, contact, adjustment) : 0;
    const meeting = promise.kind === 'meeting';
    if (delta) thread.lastChange = { delta, reason: meeting
      ? (outcome === 'kept' ? '赴约和伴侣见面' : '错过和伴侣的见面')
      : (outcome === 'kept' ? '兑现了电话约定' : '约好的电话没打') };
    const response = outcome === 'kept' && contact.role === 'father'
      ? '上回电话里忘了说，车里还有个空位。以后要帮忙，开口就行。'
      : outcome === 'cancelled' ? '好，知道了。等你有空，我们再约。' : replyText[outcome];
    const meetingReplies = {
      kept: '谢谢你跑这一趟。我把项目最忙的几周告诉你了，下次我们提前一起排时间。',
      moved: '好，我把原来留的时间改回工作。新时间我记下了。',
      cancelled: '收到。那我先按自己的工作安排走，我们找机会再谈。',
      missed: '那天我特地把晚上空出来了。后来没见到你，下次有变请早点告诉我。'
    };
    append(thread, life.age, meeting ? meetingReplies[outcome] : response);
  }

  function updatePromise(life, contact, thread, action) {
    if (C.life() !== life || !life.alive || !thread.promise) return;
    if (deadlineState(life, thread.promise.deadline) === 'missed') return;
    const promise = thread.promise;
    const meeting = promise.kind === 'meeting';
    if (action === 'keep' && meeting && !window.payAppointmentTravel?.(life, promise.cost)) return;
    const deadline = action === 'move' ? nextDeadline(life, promise.deadline) : null;
    const text = action === 'keep' ? (meeting ? '我买好票过来。见面后我们慢慢谈。' : '我空出时间了，打给你聊聊。')
      : action === 'move' ? '原来的时间排不开，改到' + deadlineLabel(deadline) + '，可以吗？'
      : (meeting ? '这次见面先取消，提前跟你说一声。' : '这次电话先取消，提前跟你说一声。');
    append(thread, life.age, text, true);
    finishPromise(life, contact, thread, action === 'keep' ? 'kept' : action === 'move' ? 'moved' : 'cancelled');
    if (deadline) thread.promise = { ...promise, age: life.age, deadline };
    save();
    window.MBLSchedulePanel?.refreshAppointments?.();
    window.MBLTeamCalendar?.refresh();
    // 约定可能在日程面板或球队日历里结算；关系面板若仍开着，同步重绘，避免残留已失效的赴约按钮。
    if (document.querySelector('dialog.mbl-rel-modal[open]')) window.MBLRelationsPanel?.refresh?.();
  }

  function settleLease(life, state) {
    const lease = state.lease;
    if (!lease) return;
    life.money.cash += lease.deposit;
    delete state.lease;
  }

  function leaseExpired(life, lease) {
    if (life.age > lease.age) return true;
    if (!lease.season) return false;
    const season = life.ball.season;
    return season && seasonKey(season) === lease.season && season.games.length >= lease.endGame;
  }

  function housingChoices(life, state, contact, thread, refresh) {
    if (!thread.housing || contact.role !== 'partner' || !life.alive || typeof window.payRelocationBill !== 'function') return null;
    const scale = window.ve(life);
    const money = amount => window.Zt(amount, life);
    const activeLease = state.lease;
    const section = make('section', 'mbl-rel-sec');
    section.append(make('h3', 'mbl-rel-sub', '换队住房安排'));
    if (activeLease) section.append(make('p', 'mbl-rel-meta', '短租进行中 · 可退押金 ' + money(activeLease.deposit)));
    const bills = [
      { key: 'rent', label: '先签过渡短租', rent: .06 * scale, moving: 0, termination: 0, deposit: .025 * scale },
      { key: 'move', label: activeLease ? '结束短租并搬家' : '直接安排搬家', rent: 0, moving: .09 * scale, termination: activeLease ? activeLease.termination : 0, deposit: 0 }
    ];
    for (const bill of bills) {
      if (bill.key === 'rent' && activeLease) continue;
      const row = make('div', 'mbl-rel-card');
      const total = bill.rent + bill.moving + bill.termination + bill.deposit;
      row.append(make('b', '', bill.label));
      const parts = bill.key === 'rent'
        ? '预付租金 ' + money(bill.rent) + ' · 可退押金 ' + money(bill.deposit)
        : '搬家费 ' + money(bill.moving) + (bill.termination ? ' · 解约费 ' + money(bill.termination) : '');
      row.append(make('p', 'mbl-rel-meta', parts));
      if (bill.key === 'move' && activeLease) row.append(make('p', 'mbl-rel-meta', '付款后退回押金 ' + money(activeLease.deposit) + '，已预付租金不退。'));
      if (bill.key === 'rent') row.append(make('p', 'mbl-rel-meta', '租金一次预付。租期约 24 个常规赛场次，最迟到本年龄结束。提前解约费 ' + money(.02 * scale) + '。'));
      const confirm = button('确认支付 ' + money(total), () => {
        if (C.life() !== life || thread.housing.status === 'moved' || state.lease !== activeLease) return;
        if (!window.payRelocationBill(life, bill)) { refresh(); return; }
        if (bill.key === 'rent') {
          const season = typeof window.Oa === 'function' ? window.Oa(life) : null;
          state.lease = { age: life.age, season: season ? seasonKey(season) : null,
            endGame: season ? Math.min(season.total, season.games.length + 24) : null,
            deposit: bill.deposit, termination: .02 * scale };
          thread.housing.status = 'renting';
          append(thread, life.age, '我先在新球队这边短租，等你忙完，我们再定长期住处。', true);
          append(thread, life.age, '好，那我先把这边的项目做完。下次一起看看哪边通勤方便。');
        } else {
          settleLease(life, state);
          thread.housing.status = 'moved';
          append(thread, life.age, '我把搬家的费用付了。我们再一起定行李和交接时间。', true);
          append(thread, life.age, '行，我把项目要交接的几天圈出来，我们一起对一下。');
        }
        thread.unread = 0;
        save();
        refresh();
      });
      confirm.disabled = window.appointmentTravelFunds(life) < total;
      row.append(confirm);
      section.append(row);
    }
    return section;
  }

  function observe(life) {
    const team = life.ball.pro?.team;
    const snapshot = {
      pro: !!team,
      team: team ? JSON.stringify([life.ball.pro.league ?? '', team.en || C.hans(team)]) : null,
      injury: life.ball.injury?.age ?? null,
      allowance: life.spent?.family_allowance ?? null
    };
    const state = life.flags.mblMessages ||= { threads: {}, snapshot, seenPro: snapshot.pro, lastTeam: snapshot.team };
    if (state.lease && leaseExpired(life, state.lease)) {
      settleLease(life, state);
      for (const thread of Object.values(state.threads)) {
        if (thread.housing?.status === 'renting') {
          thread.housing.status = 'expired';
          append(thread, life.age, '短租到期，押金已退。接下来住哪，我们再一起定。');
        }
      }
    }
    const previous = state.snapshot;
    state.snapshot = snapshot;
    const roster = contacts(life);
    const incoming = [];
    if (snapshot.pro && !state.seenPro) {
      state.seenPro = true;
      incoming.push('contract');
    } else if (snapshot.team && state.lastTeam && snapshot.team !== state.lastTeam) {
      incoming.push('trade');
    }
    if (snapshot.team) state.lastTeam = snapshot.team;
    if (snapshot.injury === life.age && snapshot.injury !== previous.injury) incoming.push('injury');
    if (snapshot.allowance !== null && snapshot.allowance !== previous.allowance) incoming.push('allowance');

    for (const eventName of incoming) {
      const eligible = roster.filter(contact => events[eventName][contact.role]);
      const family = eligible.filter(contact => ['mother', 'father', 'partner'].includes(contact.role));
      const peer = eligible.filter(contact => ['teammate', 'friend'].includes(contact.role))
        .sort((first, second) => score(second) - score(first))[0];
      for (const contact of peer ? family.concat(peer) : family) {
        deliver(state, contact, life.age, eventName, events[eventName][contact.role]);
        if (eventName === 'trade' && contact.role === 'partner') threadFor(state, contact).housing = { status: 'open' };
      }
    }

    for (const contact of roster) {
      const thread = state.threads[contact.id];
      const promise = thread?.promise;
      if (!promise) continue;
      promise.deadline ||= { kind: 'year', age: promise.age };
      if (promise.outcome) {
        (thread.appointments ||= []).push({ deadline: promise.deadline, outcome: promise.outcome });
        append(thread, life.age, replyText[promise.outcome]);
        delete thread.promise;
      } else if (deadlineState(life, promise.deadline) === 'missed') {
        finishPromise(life, contact, thread, 'missed');
      }
    }
    return state;
  }

  function button(label, action) {
    const item = make('button', 'mbl-rel-btn', label);
    item.type = 'button';
    item.onclick = () => {
      if (item.disabled) return;
      item.disabled = true;
      action();
    };
    return item;
  }

  function render(life, refresh) {
    ensureOwner(life);
    const section = make('section', 'mbl-rel-sec mbl-sms');
    const roster = contacts(life);
    const state = life.alive ? observe(life) : life.flags?.mblMessages || { threads: {} };
    const unread = roster.reduce((total, contact) => total + (state.threads[contact.id]?.unread || 0), 0);
    const selected = roster.find(contact => contact.id === activeContact);
    if (selected) {
      section.classList.add('arena-conversation');
      const top = make('div','arena-chat-nav');
      const back = button('‹ 通讯录',()=>{activeContact='';refresh();});back.classList.add('arena-chat-back');
      top.append(back,make('span','', '私人对话'));section.append(top,renderThread(life,state,selected,refresh));
      return section;
    }
    activeContact='';
    section.append(make('h3', 'arena-phone-title', '通讯录'),make('p','mbl-rel-meta',`${roster.length} 位联系人 · ${unread} 条未读`));
    if (!roster.length) {
      section.append(make('p', 'mbl-rel-muted', '有了家人或朋友联系人，就能在这里收发消息。'));
      return section;
    }

    const filters=make('div','arena-contact-filters');
    const search=make('input','arena-contact-search');search.type='search';search.placeholder='搜索姓名或关系';search.value=searchText;search.setAttribute('aria-label','搜索联系人');
    const list=make('div','mbl-sms-contacts arena-contact-list');
    const empty=make('p','mbl-rel-muted','没有符合条件的联系人。');empty.hidden=true;
    const rows=[];
    for (const contact of orderedContacts(roster,state.threads)) {
      const count = state.threads[contact.id]?.unread || 0;
      const label = C.hans(contact.person.name) || personalities[contact.role].label;
      const profile=personalities[contact.role]; const last=state.threads[contact.id]?.messages?.at(-1);
      const item = button('', () => {
        activeContact = contact.id;
        const thread = state.threads[contact.id];
        if (thread?.unread) {
          thread.unread = 0;
          save();
        }
        refresh();
      });
      item.className='arena-contact-row';
      const avatar=make('span','arena-contact-avatar',label.slice(0,1));
      const copy=make('span','arena-contact-copy');
      copy.append(make('b','',label),make('small','',profile.label+' · '+(last?.text||'还没有聊天记录')));
      const meta=make('span','arena-contact-meta');meta.append(make('small','',last?.age!=null?last.age+' 岁':''));
      if(count)meta.append(make('b','arena-unread',String(count)));
      else meta.append(make('span','arena-contact-chevron','›'));
      item.append(avatar,copy,meta);
      rows.push({item,count,needle:(label+' '+profile.label).toLowerCase()});
      list.append(item);
    }
    const filterButtons=[];
    function filter(){const term=searchText.trim().toLowerCase();let shown=0;for(const row of rows){row.item.hidden=!(row.needle.includes(term)&&(filterMode==='all'||row.count>0));if(!row.item.hidden)shown++;}empty.hidden=shown>0;for(const [mode,b] of filterButtons)b.setAttribute('aria-pressed',String(mode===filterMode));}
    for(const [mode,label] of [['all','全部'],['unread','未读']]){const b=make('button','arena-contact-filter',label);b.type='button';b.onclick=()=>{filterMode=mode;filter();};filters.append(b);filterButtons.push([mode,b]);}
    search.addEventListener('input',()=>{searchText=search.value;filter();});filter();
    section.append(search,filters,list,empty);
    return section;
  }

  function orderedContacts(roster,threads){
    return roster.slice().sort((a,b)=>{
      const at=threads[a.id],bt=threads[b.id];
      return Number(!!bt?.unread)-Number(!!at?.unread) || (bt?.messages?.at(-1)?.age??-1)-(at?.messages?.at(-1)?.age??-1) || Number(!!bt?.messages?.length)-Number(!!at?.messages?.length);
    });
  }
  function summary(life){
    const roster=contacts(life),threads=life.flags?.mblMessages?.threads||{};
    return {contacts:roster.length,unread:roster.reduce((n,c)=>n+Math.max(0,Number(threads[c.id]?.unread)||0),0),appointments:roster.filter(c=>threads[c.id]?.promise&&!threads[c.id].promise.outcome).length};
  }
  function restoreThreadScroll(root){
    const node=root.querySelector('.mbl-sms-thread');if(!node)return;
    const saved=threadScroll.get(node.dataset.mblScrollKey);
    node.scrollTop=!saved||saved.bottom?node.scrollHeight:saved.top;
  }

  function save() {
    if (window.MBLAutoSave) window.MBLAutoSave.save();
    else if (window.Nt?.saveLife) window.Nt.saveLife(C.life());
  }

  function renderThread(life, state, contact, refresh) {
    const profile = personalities[contact.role];
    const thread = state.threads[contact.id] || { messages: [] };
    const card = make('div', 'mbl-rel-card arena-chat-card');
    const label=C.hans(contact.person.name)||profile.label;
    const hero=make('div','arena-chat-profile');const copy=make('div');copy.append(make('b','',label),make('p','mbl-rel-meta',profile.label+' · '+profile.trait));
    hero.append(make('span','arena-contact-avatar',label.slice(0,1)),copy,make('strong','arena-bond-score',score(contact)+'/100'));
    const bond=make('div','arena-bond-track');const fill=make('span');fill.style.width=score(contact)+'%';bond.append(fill);
    card.append(hero,make('p','mbl-rel-meta','亲密度'),bond);
    if (thread.lastChange) {
      const { delta, reason } = thread.lastChange;
      card.append(make('p', 'mbl-rel-meta', (delta > 0 ? '+' : '') + delta + ' · ' + reason));
    }
    const messages = make('ol', 'mbl-sms-thread');
    messages.dataset.mblScrollKey = 'sms:' + contact.id;
    messages.setAttribute('data-mbl-follow-bottom', '');
    messages.addEventListener('scroll',()=>{if(messages.isConnected)threadScroll.set(messages.dataset.mblScrollKey,{top:messages.scrollTop,bottom:messages.scrollHeight-messages.clientHeight-messages.scrollTop<8});});
    for (const entry of thread.messages) {
      const bubble = make('li', 'mbl-sms-bubble' + (entry.fromPlayer ? ' is-sent' : ''));
      bubble.append(make('small', '', (entry.fromPlayer ? '你' : C.hans(contact.person.name) || profile.label) + ' · ' + entry.age + ' 岁'));
      bubble.append(make('div', '', entry.text));
      messages.append(bubble);
    }
    if (thread.messages.length) card.append(messages);
    else card.append(make('p','arena-chat-empty','还没有消息。主动聊聊近况吧。'));
    if (!life.alive) return card;

    function send(text, response, delta, reason, update) {
      if (C.life() !== life) return;
      const current = threadFor(state, contact);
      append(current, life.age, text, true);
      if (response) append(current, life.age, response);
      current.unread = 0;
      if (delta) {
        const actual = changeScore(life, contact, delta);
        if (actual) current.lastChange = { delta: actual, reason };
      }
      update(current);
      save();
      refresh();
    }

    const actions = make('div', 'mbl-rel-btn-row');
    if (thread.inbox?.length) {
      const [label, text] = eventReplies[thread.inbox[0]];
      actions.append(button(label, () => send(text, warmReplies[contact.role], 2, '认真回应了对方', current => current.inbox.shift())));
      actions.append(button('先报个平安', () => send('我这边有安排了，先和你说一声。', replyText.brief, 0, '', current => current.inbox.shift())));
      if (!thread.promise) {
        if (thread.inbox[0] === 'trade' && contact.role === 'partner' && typeof window.ve === 'function') {
          actions.append(button('约见面谈搬家', () => {
            const deadline = nextDeadline(life);
            const cost = window.ve(life) * .035;
            send('我找时间回去见你，定在' + deadlineLabel(deadline) + '。', '好，我把那段时间留出来。', 0, '', current => {
              current.inbox.shift();
              current.promise = { kind: 'meeting', age: life.age, deadline, cost };
            });
            window.MBLTeamCalendar?.refresh();
          }));
        }
        actions.append(button('约个电话', () => {
          const deadline = nextDeadline(life);
          send('我们约在' + deadlineLabel(deadline) + '通个电话。', replyText.promise, 0, '', current => {
            current.inbox.shift();
            current.promise = { age: life.age, deadline };
          });
          window.MBLTeamCalendar?.refresh();
        }));
      }
    } else if (thread.helloAge !== life.age) {
      actions.append(button('发条消息问候', () => send('最近怎么样？想起来还没问问你。', profile.hello, 1, '主动问候', current => { current.helloAge = life.age; })));
      if(life.ball?.started)actions.append(button('分享训练近况',()=>send('今天的训练很有收获，想和你分享一下。',warmReplies[contact.role]||profile.hello,1,'分享日常',current=>{current.helloAge=life.age;})));
    }
    if (thread.promise) {
      card.append(make('p', 'mbl-rel-meta', '已加入生涯日历 · ' + deadlineLabel(thread.promise.deadline)));
      appendAppointmentActions(actions, life, contact, thread, refresh);
    }
    if (actions.childElementCount) {card.append(make('h4','arena-chat-action-heading','选择你的回复'),actions);}
    if (thread.housing && thread.housing.status !== 'moved') {
      const choices = housingChoices(life, state, contact, thread, refresh);
      if (choices) card.append(choices);
    }
    return card;
  }

  const outcomeLabels = { kept: '已完成', moved: '已改期', cancelled: '已取消', missed: '已错过' };

  function appendAppointmentActions(row, life, contact, thread, refresh) {
    const meeting = thread.promise.kind === 'meeting';
    const cost = thread.promise.cost;
    const canPay = !meeting || window.appointmentTravelFunds?.(life) >= cost;
    const fulfill = meeting ? '支付交通费并赴约 · ' + window.Zt(cost, life) : '现在打电话';
    for (const [label, action] of [[fulfill, 'keep'], ['改期', 'move'], ['取消约定', 'cancel']]) {
      const item = button(label, () => {
        updatePromise(life, contact, thread, action);
        refresh();
      });
      item.disabled = action === 'keep' && !canPay;
      row.append(item);
    }
    if (!canPay) row.append(make('span', 'mbl-rel-meta', '扣除待确认消费后，可用金额不足。'));
  }

  function renderAppointments(life, refresh, openConversation) {
    if (!life.flags?.mblMessages) return null;
    const state = life.alive ? observe(life) : life.flags.mblMessages;
    const section = make('section', 'mbl-rel-sec mbl-appointments');
    const active = [];
    const recent = [];
    for (const contact of contacts(life)) {
      const thread = state.threads[contact.id];
      if (!thread) continue;
      const name = C.hans(contact.person.name) || personalities[contact.role].label;
      if (thread.promise && !thread.promise.outcome) active.push({ contact, thread, name });
      for (const entry of thread.appointments || []) recent.push({ ...entry, name });
    }
    if (!active.length && !recent.length) return null;
    section.append(make('h3', 'mbl-rel-sub', '私人约定'));
    for (const { contact, thread, name } of active) {
      const deadline = thread.promise.deadline || { kind: 'year', age: thread.promise.age };
      const card = make('div', 'mbl-rel-card');
      const status = deadlineState(life, deadline);
      card.append(make('b', '', '和' + name + (thread.promise.kind === 'meeting' ? '见面' : '通话')));
      card.append(make('p', 'mbl-rel-meta', deadlineLabel(deadline) + (status === 'due' ? ' · 现在可赴约' : ' · 已安排')));
      const actions = make('div', 'mbl-rel-btn-row');
      if (life.alive && status !== 'missed') appendAppointmentActions(actions, life, contact, thread, refresh);
      if (openConversation) actions.append(button('查看短信', () => openConversation(contact.id)));
      card.append(actions);
      section.append(card);
    }
    recent.sort((a, b) => b.deadline.age - a.deadline.age || (b.deadline.game || 0) - (a.deadline.game || 0));
    for (const entry of recent.slice(0, 4)) {
      section.append(make('p', 'mbl-rel-meta', entry.name + ' · ' + (entry.kind === 'meeting' ? '见面' : '通话') + ' · ' + deadlineLabel(entry.deadline) + ' · ' + outcomeLabels[entry.outcome]));
    }
    return section;
  }

  function plannedTravel(life) {
    const threads = life.flags?.mblMessages?.threads || {};
    return contacts(life).reduce((total, contact) => {
      const promise = threads[contact.id]?.promise;
      return total + (promise?.kind === 'meeting' && deadlineState(life, promise.deadline) !== 'missed' ? promise.cost : 0);
    }, 0);
  }

  function gameAppointmentIndex(life, season) {
    const index = new Map();
    const threads = life.flags?.mblMessages?.threads;
    if (!threads) return index;
    const key = seasonKey(season);
    for (const contact of contacts(life)) {
      const deadline = threads[contact.id]?.promise?.deadline;
      if (deadline?.kind !== 'game' || deadline.season !== key) continue;
      if (!index.has(deadline.game)) index.set(deadline.game, []);
      index.get(deadline.game).push(C.hans(contact.person.name) || personalities[contact.role].label);
    }
    return index;
  }

  function selectConversation(id) {
    ensureOwner(C.life());
    activeContact = id;
    const thread = activeLife?.flags?.mblMessages?.threads[id];
    if (thread?.unread) {
      thread.unread = 0;
      save();
    }
  }

  let observing = false;
  window.addEventListener('mbl:state-changed', () => {
    if (observing) return;
    observing = true;
    queueMicrotask(() => {
      observing = false;
      const life = C.life();
      if (life?.alive && life.flags && life.ball) observe(life);
    });
  });

  window.MBLRelationsMessages = { render, renderAppointments, gameAppointmentIndex, selectConversation, plannedTravel, summary, orderedContacts, restoreThreadScroll, viewKey:()=>activeContact?'chat:'+activeContact:'contacts' };
})();
