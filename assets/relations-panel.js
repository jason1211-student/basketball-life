/* 关系与好友面板：聚合原生伴侣 / 交往对象 / 好友 / 前任数据，提供温和的主动互动入口。
   数据全部复用 life 原生字段（partner、flags.dating、ball.friends、pastPartners），
   写回调用原生内核函数（Xe / Ie / l / d / $ / Gne / p9e / vz），随 life 一起落盘，旧档天然兼容。 */
(function () {
  'use strict';
  if (window.MBLRelationsPanel) return;
  var C = window.MBLCore;
  var make = C.h;

  function L() { return C.life(); }
  function nm(who) {
    if (!who) return '?';
    return who.hans || who.en || who.hant || (typeof who === 'string' ? who : '?');
  }
  function fn(name) { return typeof window[name] === 'function' ? window[name] : null; }
  var a = fn('a') || window.a;

  // 好感档位（展示层，不改内核）
  function relStage(rel) {
    rel = Number(rel) || 0;
    if (rel < 25) return '初识';
    if (rel < 50) return '相识';
    if (rel < 75) return '好友';
    return '挚友';
  }
  function relLabel(f) {
    if ((Number(f.rival) || 0) > 0) return '劲敌';
    if (f.duo) return '双子星';
    if (f.club) return '队友';
    if (f.pro) return '职业圈';
    if (f.path === 'out') return '旧友';
    return '朋友';
  }

  function coolOn(life, key) {
    life.flags = life.flags || {};
    var c = life.flags.mblRelCool = life.flags.mblRelCool || {};
    return c[key] === life.age;
  }
  function setCool(life, key) {
    life.flags.mblRelCool = life.flags.mblRelCool || {};
    life.flags.mblRelCool[key] = life.age;
  }
  function save(life) { var s = window.Nt; if (s && typeof s.saveLife === 'function') s.saveLife(life); }

  var dialog = make('dialog', 'mbl-rel-modal arena-phone');
  dialog.setAttribute('aria-labelledby', 'mbl-rel-title');
  var head = make('div', 'mbl-rel-head');
  var title = make('h2', '', '私人通讯中心'); title.id = 'mbl-rel-title';
  var closeBtn = make('button', 'mbl-rel-close', '关闭'); closeBtn.type = 'button';
  head.append(title, closeBtn);
  var body = make('div', 'mbl-rel-body');
  body.dataset.mblScrollKey='phone:body';
  var nav=make('nav','arena-phone-nav');nav.setAttribute('aria-label','通讯中心分类');
  var section='messages', owner=null, currentView='', sectionScroll=new Map(), buttons={};
  [['messages','短信'],['relationships','关系'],['appointments','约定']].forEach(function(pair){
    var b=make('button','arena-phone-tab',pair[1]);b.type='button';b.onclick=function(){showSection(pair[0]);};nav.append(b);buttons[pair[0]]=b;
  });
  var tip = make('p', 'mbl-rel-tip', '');
  tip.setAttribute('role','status');
  dialog.append(head, nav, body, tip);
  document.body.append(dialog);

  var tipTimer = null;
  function flash(text) {
    tip.textContent = text;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(function () { tip.textContent = ''; }, 2200);
  }

  function barRow(value, max, cls) {
    var wrap = make('div', 'mbl-rel-bar');
    var fill = make('div', 'mbl-rel-bar-fill' + (cls ? ' ' + cls : ''));
    var pct = Math.max(0, Math.min(100, (Number(value) || 0) / (max || 100) * 100));
    fill.style.width = pct + '%';
    wrap.append(fill);
    return wrap;
  }

  // ---------- A. 感情状况 ----------
  function renderRomance(life) {
    var sec = make('section', 'mbl-rel-sec');
    sec.append(make('h3', 'mbl-rel-sub', '感情状况'));
    var G0 = fn('G0'), LF = fn('LF');
    var partner = life.partner && life.partner.alive ? life.partner : null;
    var dating = G0 ? G0(life) : null;

    if (partner) {
      var card = make('div', 'mbl-rel-card');
      var top = make('div', 'mbl-rel-card-top');
      top.append(make('b', '', nm(partner.name)));
      top.append(make('span', 'mbl-rel-tag', '伴侣'));
      card.append(top);
      var meta = make('p', 'mbl-rel-meta', '年龄 ' + (Number(partner.age) || '?') + ' · 在一起 ' + (Number(partner.years) || 0) + ' 年');
      card.append(meta);
      card.append(make('div', 'mbl-rel-meta', '感情'));
      card.append(barRow(partner.bond, 100));
      var cool = coolOn(life, 'care-partner');
      var rowP = make('div', 'mbl-rel-btn-row');
      var btn = make('button', 'mbl-rel-btn', cool ? '今年已关怀' : '关怀一次');
      btn.type = 'button'; btn.disabled = cool;
      btn.onclick = function () {
        var Ie = fn('Ie'), l = fn('l'), d = fn('d');
        if (coolOn(life, 'care-partner')) { flash('今年已经关怀过了，来年再说吧。'); return; }
        if (Ie) Ie(life, partner, 5);
        if (l) { l(life, 'happiness', 2); }
        if (d) d(life, a('You made time for {who} and you both felt good.',
          '你抽出时间陪伴 {who}，两个人都很开心。',
          '你抽出時間陪伴 {who}，兩個人都很開心。'), { who: partner.name });
        setCool(life, 'care-partner');
        save(life); render();
      };
      rowP.append(btn);
      card.append(rowP);
      sec.append(card);
      return sec;
    }

    if (dating) {
      var card2 = make('div', 'mbl-rel-card');
      var top2 = make('div', 'mbl-rel-card-top');
      top2.append(make('b', '', nm(dating)));
      top2.append(make('span', 'mbl-rel-tag', '交往中'));
      card2.append(top2);
      var since = Number(life.flags.datingSince || life.age);
      var together = Math.max(0, life.age - since);
      var dAge = Number(life.flags.datingAge || life.age) + together;
      card2.append(make('p', 'mbl-rel-meta', '年龄 ' + dAge + ' · 交往 ' + together + ' 年'));
      var coolD = coolOn(life, 'care-dating');
      var row = make('div', 'mbl-rel-btn-row');
      var keep = make('button', 'mbl-rel-btn', coolD ? '今年已相处' : '继续相处');
      keep.type = 'button'; keep.disabled = coolD;
      keep.onclick = function () {
        if (coolOn(life, 'care-dating')) { flash('今年已经相处过了，来年再说吧。'); return; }
        var l = fn('l'), d = fn('d');
        if (l) { l(life, 'happiness', 2); l(life, 'relationships', 1); }
        if (d) d(life, a('You and {who} enjoyed another easy stretch together.',
          '你和 {who} 又度过了一段轻松的时光。',
          '你和 {who} 又度過了一段輕鬆的時光。'), { who: dating });
        setCool(life, 'care-dating');
        save(life); render();
      };
      var breakUp = make('button', 'mbl-rel-btn is-danger', '和平分手');
      breakUp.type = 'button';
      breakUp.onclick = function () {
        if (!window.confirm('确定要和 ' + nm(dating) + ' 分手吗？这段关系会结束。')) return;
        var l = fn('l'), $ = fn('$');
        delete life.flags.dating; delete life.flags.datingAge;
        delete life.flags.datingSince; delete life.flags.proposeNo;
        if (l) { l(life, 'happiness', -5); l(life, 'relationships', -3); }
        if ($) $(life, '你和 ' + nm(dating) + ' 和平分手了，心里空落落的。', { who: dating });
        save(life); render();
      };
      row.append(keep, breakUp);
      card2.append(row);
      sec.append(card2);
      return sec;
    }

    sec.append(make('p', 'mbl-rel-muted', LF && !LF(life) ? '感情状况复杂，随生涯推进更新。' : '目前单身，先把自己的路走稳。'));
    return sec;
  }

  // ---------- B. 亲友圈 ----------
  function renderFriends(life) {
    var sec = make('section', 'mbl-rel-sec');
    sec.append(make('h3', 'mbl-rel-sub', '亲友圈'));
    var list = (life.ball && life.ball.friends || []).filter(function (f) { return !f.gone; });
    if (!list.length) {
      sec.append(make('p', 'mbl-rel-muted', '还没遇到志同道合的人，随着生涯推进会逐渐结识。'));
      return sec;
    }
    list.forEach(function (f) {
      var card = make('div', 'mbl-rel-card');
      var top = make('div', 'mbl-rel-card-top');
      top.append(make('b', '', nm(f.name)));
      top.append(make('span', 'mbl-rel-tag', relLabel(f)));
      card.append(top);
      card.append(make('p', 'mbl-rel-meta', relStage(f.rel) + ' · 认识于 ' + (Number(f.metAge) || life.age) + ' 岁'));
      card.append(barRow(f.rel, 100));
      var rival = (Number(f.rival) || 0) > 0;
      var fRow = make('div', 'mbl-rel-btn-row');
      if (!rival) {
        var key = 'fb-' + (f.name && f.name.en || f.name);
        var cool = coolOn(life, key);
        var btn = make('button', 'mbl-rel-btn', cool ? '今年已联络' : '约聚联络');
        btn.type = 'button'; btn.disabled = cool;
        btn.onclick = function () {
          if (coolOn(life, key)) { flash('今年已经和 ' + nm(f.name) + ' 聚过了，来年再说吧。'); return; }
          var Xe = fn('Xe'), l = fn('l'), d = fn('d');
          if (Xe) Xe(f, 4);
          if (l) { l(life, 'relationships', 1); l(life, 'happiness', 1); }
          if (d) d(life, a('You sat and talked with {who} for a long time, and grew a little closer.',
            '你和 {who} 坐下来聊了很久，关系又近了一步。',
            '你和 {who} 坐下來聊了很久，關係又近了一步。'), { who: f.name });
          setCool(life, key);
          save(life); render();
        };
        fRow.append(btn);
      }
      if (fRow.children.length) card.append(fRow);
      sec.append(card);
    });
    return sec;
  }

  // ---------- C. 认识新人 ----------
  function renderMeet(life) {
    var LF = fn('LF');
    var single = LF ? LF(life) : !(life.partner && life.partner.alive) && !life.flags.dating;
    if (!single || life.age < 18) return null;
    var sec = make('section', 'mbl-rel-sec');
    sec.append(make('h3', 'mbl-rel-sub', '认识新人'));

    var pending = life.pending || [];
    var hasDate = pending.some(function (p) { return p.tid === 'blind_date'; });

    var row = make('div', 'mbl-rel-btn-row');
    var setup = make('button', 'mbl-rel-btn', '托朋友介绍相亲');
    setup.type = 'button'; setup.disabled = hasDate;
    setup.onclick = function () {
      var Gne = fn('Gne');
      if (!Gne) { flash('相亲模块暂不可用。'); return; }
      if (pending.some(function (p) { return p.tid === 'blind_date'; })) { flash('已经有约好的相亲在排队了。'); return; }
      var params = Gne(life, false);
      var friend = (life.ball && life.ball.friends || []).find(function (f) { return !f.gone; });
      var A = fn('a');
      params.friend = friend && friend.name ? friend.name : (A ? A('your friends', '朋友们', '朋友們') : '朋友们');
      life.pending.push({ tid: 'blind_date', params: params, pool: 'life' });
      save(life); flash('已托朋友安排相亲，事件会在近期到来。'); render();
    };
    var party = make('button', 'mbl-rel-btn', '去派对认识人');
    party.type = 'button';
    party.onclick = function () {
      var vz = fn('vz');
      if (!vz) { flash('派对模块暂不可用。'); return; }
      vz(life, false);
      save(life); render();
    };
    row.append(setup, party);
    sec.append(row);
    sec.append(make('p', 'mbl-rel-hint', '认识谁、能不能走到一起，还看你当时的性格与表现。'));
    return sec;
  }

  // ---------- D. 家人 ----------
  var KIN_CN = { mother: '母亲', father: '父亲', child: '孩子', sibling: '兄弟姐妹' };
  function renderFamily(life) {
    var S = fn('S_'); if (!S) return null;
    var list = S(life).filter(function (x) { return x.p.alive && x.kin !== 'partner'; });
    if (!list.length) return null;
    var sec = make('section', 'mbl-rel-sec');
    sec.append(make('h3', 'mbl-rel-sub', '家人'));
    list.forEach(function (x) {
      var card = make('div', 'mbl-rel-card');
      var top = make('div', 'mbl-rel-card-top');
      top.append(make('b', '', nm(x.p.name)));
      top.append(make('span', 'mbl-rel-tag', KIN_CN[x.kin] || x.kin));
      card.append(top);
      card.append(make('p', 'mbl-rel-meta', '年龄 ' + (Number(x.p.age) || '?')));
      card.append(barRow(x.p.bond, 100));
      sec.append(card);
    });
    return sec;
  }

  // ---------- E. 前任 ----------
  function renderPast(life) {
    var past = life.pastPartners || [];
    if (!past.length) return null;
    var sec = make('section', 'mbl-rel-sec');
    sec.append(make('h3', 'mbl-rel-sub', '前任（' + past.length + '）'));
    past.forEach(function (p) {
      var card = make('div', 'mbl-rel-card is-plain');
      var top = make('div', 'mbl-rel-card-top');
      top.append(make('b', '', nm(p.name)));
      top.append(make('span', 'mbl-rel-tag', p.how === 'died' ? '离世' : '分开'));
      card.append(top);
      card.append(make('p', 'mbl-rel-meta', '在一起 ' + (Number(p.years) || 0) + ' 年 · 结束于 ' + (Number(p.at) || '?') + ' 岁'));
      sec.append(card);
    });
    return sec;
  }

  function render() {
    var life=L();
    if(owner!==life){owner=life;sectionScroll.clear();currentView='';}
    if(currentView&&dialog.open)sectionScroll.set(currentView,body.scrollTop);
    var result=window.MBLInteraction.preserveScroll(dialog, renderContents);
    var next=section==='messages'?'messages:'+ (window.MBLRelationsMessages?.viewKey()||'contacts'):section;
    if(next!==currentView){body.scrollTop=sectionScroll.get(next)||0;if(section==='messages'&&dialog.open)window.MBLRelationsMessages?.restoreThreadScroll(body);}
    currentView=next;
    var unread=life?window.MBLRelationsMessages?.summary(life).unread||0:0;
    buttons.messages.textContent=unread?'短信 · '+unread:'短信';
    Object.keys(buttons).forEach(function(key){buttons[key].setAttribute('aria-pressed',String(key===section));});
    return result;
  }

  function renderContents() {
    var life = L();
    body.replaceChildren();
    if (!life) {
      body.append(make('p', 'mbl-rel-muted', '开始一段人生后，这里会显示你的关系网。'));
      return;
    }
    if(section==='messages'){
      if(window.MBLRelationsMessages)body.append(window.MBLRelationsMessages.render(life,render));
      return;
    }
    if(section==='appointments'){
      var appointments=window.MBLRelationsMessages?.renderAppointments(life,render,function(id){window.MBLRelationsMessages.selectConversation(id);showSection('messages');});
      body.append(appointments||make('p','mbl-rel-muted','暂无私人约定。可以从短信中安排通话或见面。'));return;
    }
    body.append(renderRomance(life));
    var fam = renderFamily(life); if (fam) body.append(fam);
    body.append(renderFriends(life));
    var meet = renderMeet(life); if (meet) body.append(meet);
    var past = renderPast(life); if (past) body.append(past);
  }

  closeBtn.onclick = close;
  dialog.addEventListener('cancel',function(e){e.preventDefault();close();});

  function showSection(key){if(!buttons[key])return;section=key;render();}
  function open(key) { if(buttons[key])section=key;else section='messages';render(); if (!dialog.open) {dialog.showModal();body.scrollTop=sectionScroll.get(currentView)||0;if(section==='messages')window.MBLRelationsMessages?.restoreThreadScroll(body);} }
  function close() { if (dialog.open) {if(currentView)sectionScroll.set(currentView,body.scrollTop);dialog.close();} }

  window.MBLRelationsPanel = { open: open, close: close, refresh: render, showSection:showSection };
  if (window.MBLDockPanels) window.MBLDockPanels.relations = { open: open, close: close };
})();
