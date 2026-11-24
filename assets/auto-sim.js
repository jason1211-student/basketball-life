/* 自动推进：以页面可见按钮为驱动，自动点掉通知/抉择/推进，stopWhen 成立即停。 */
(function () {
  'use strict';
  if (window.MBLAutoSim) return;

  // 重大节点：合同续约、交易/转会/裁员、选秀/转职业、升学/俱乐部转折、退役转行、重大伤病、重大财务危机。
  // 这些抉择在自动模拟中暂停，留给玩家手动确认；其余日常教练/媒体/社交/比赛小事继续自动处理。
  var MAJOR_TIDS = new Set([
    // 合同 / 续约 / 代言
    'coach_extend', 'coach_extension', 'gm_extend', 'gm_star_contract',
    'money_contract', 'media_network', 'media_sponsor', 'pl_shoe_deal',
    'agency_buyout', 'ten_day',
    // 自由球员 / 交易 / 转会 / 裁员
    'free_agency', 'gm_free_agents', 'gm_market', 'front_pitch',
    'gm_trade', 'gm_trade_up', 'gm_sell', 'gm_shed', 'gm_release',
    'trade_offers', 'trade_request', 'mate_traded', 'pl_mate_traded',
    'pl_traded', 'pl_trade_talk', 'fo_deadline', 'gml_deadline',
    'ls_agent_deadline', 'job_gm_blockbuster',
    // 选秀 / 转职业
    'turn_pro', 'go_pro_draft', 'go_pro_early', 'early_entry',
    'college_pro_call', 'pa_draft', 'job_gm_draft', 'front_lottery', 'gm_draft',
    // 升学 / 俱乐部转折
    'uni_offer', 'college_offer',
    // 退役 / 转行 / 翻身
    'retire_playing', 'next_chapter', 'money_cliff', 'job_offers', 'broke_way_back',
    // 重大伤病
    'health_news',
    // 重大财务危机
    'broke_bank', 'market_crash'
  ]);
  function isMajor(tid) { return !!tid && MAJOR_TIDS.has(tid); }

  function isShown(n) {
    if (n.offsetParent !== null) return true;
    // showModal() 打开的原生 dialog 位于 top layer，其内部元素 offsetParent 为 null，但实际可见
    var d = n.closest && n.closest('dialog');
    if (d && d.open) {
      var r = n.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }
    return false;
  }
  function visibleNode(list) {
    for (var i = 0; i < list.length; i++) {
      var n = list[i];
      if (n && !n.disabled && isShown(n)) return n;
    }
    return null;
  }

  function tick(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // 当前抉择：tid + 选项按钮
  function currentChoice(life) {
    var card = document.querySelector('article.card.decide');
    if (!card) return null;
    var btns = Array.from(card.querySelectorAll('[data-act="choose"]'));
    var tid = (life.pending && life.pending[0]) ? life.pending[0].tid : null;
    return { card: card, tid: tid, buttons: btns };
  }

  function autoPlay(stopWhen, opts) {
    opts = opts || {};
    var stepDelay = opts.delay || 12;
    var maxSteps = opts.maxSteps || 6000;
    var guard = 0;
    var idleTries = 0;
    var stall = 0;
    var lastSig = '';
    var stopped = { reason: 'maxsteps' };
    window.__mblAutoSim = true;

    return new Promise(function (resolve) {
      function finish(reason) {
        window.__mblAutoSim = false;
        stopped.reason = reason;
        // 收口王朝历史时刻：补全当前年份，不暂停口径下标记剩余节点、避免结束后弹窗残留
        var curLife = window.de && de.life;
        if (window.MBLDynasty && curLife) {
          window.MBLDynasty.drainAuto(curLife, !!(opts.pauseMajor || opts.pauseEra));
        }
        resolve(stopped);
      }

      function step() {
       try {
        var life = window.de && de.life;
        if (!life) return finish('nolife');
        if (guard++ > maxSteps) return finish('maxsteps');

        // 停止条件
        if (stopWhen && stopWhen(life, stopped)) return finish('stopwhen');

        // 停滞看门狗：内核与弹窗状态连续多步无任何变化即结束，避免点击无效导致永久转圈
        var sig = life.age + '|' + life.log.length + '|' + (life.ball?.season?.games?.length ?? 0) + '|' + (life.pending ? life.pending.length : 0) +
          '|' + document.querySelectorAll('dialog[open]').length +
          '|' + document.querySelectorAll('.modal-backdrop').length;
        if (sig === lastSig) { if (++stall > 150) return finish('stalled'); }
        else { stall = 0; lastSig = sig; }

        // 1) 结果卡片 dismiss
        var dismiss = visibleNode(Array.from(document.querySelectorAll('[data-act="dismiss"]')));
        if (dismiss) { idleTries = 0; dismiss.click(); return schedule(); }

        // 历史时刻（王朝重大年份）：交给 dynasty 串行决策，按本次暂停口径弹窗暂停或自动标记
        if (window.MBLDynasty) {
          var eraAct = window.MBLDynasty.takeAuto(life, !!(opts.pauseMajor || opts.pauseEra));
          if (eraAct === 'era') {
            stopped.reason = 'era';
            var ep = document.querySelector('.mbl-era-pop[open]');
            stopped.lastEra = ep ? (ep.querySelector('.mbl-era-pop-title') || {}).textContent || '' : '';
            return finish('era');
          }
          if (eraAct === 'consumed') { idleTries = 0; return schedule(); }
        }

        // 2) 通知
        var notice = visibleNode(Array.from(document.querySelectorAll('[data-act="noticeok"]')));
        if (notice) {
          if (opts.pauseNotice) return finish('notice');
          idleTries = 0; notice.click(); return schedule();
        }

        // 选秀夜：跳过动画，再完成
        var draftSkip = visibleNode(Array.from(document.querySelectorAll('[data-act="draftskip"]')));
        if (draftSkip) { idleTries = 0; draftSkip.click(); return schedule(); }
        var draftDone = visibleNode(Array.from(document.querySelectorAll('[data-act="draftdone"]')));
        if (draftDone) { idleTries = 0; draftDone.click(); return schedule(); }

        // 3) 抉择
        var choice = currentChoice(life);
        if (choice && choice.buttons.length) {
          // 重大节点：暂停自动模拟，保留抉择卡片等玩家手动选择（仅全自动模拟入口开启）
          if (opts.pauseMajor && isMajor(choice.tid)) {
            stopped.reason = 'major';
            stopped.lastTid = choice.tid;
            return finish('major');
          }
          if (opts.onChoice) {
            var handled = opts.onChoice(choice, life, stopped);
            if (handled === true) return finish('choice');
          }
          var btn = choice.buttons.find(function (b) { return !b.disabled; });
          if (btn) {
            idleTries = 0;
            stopped.lastTid = choice.tid;
            btn.click();
            return schedule();
          }
        }

        // 推进：next 常被视觉隐藏但可用，可见的 cta-next 作备选
        var realNext = document.querySelector('main.play [data-act="next"]');
        if (realNext && !realNext.disabled) { idleTries = 0; realNext.click(); return schedule(); }
        var ctaNext = visibleNode(Array.from(document.querySelectorAll('.mbl-cta-next')));
        if (ctaNext && !ctaNext.disabled) { idleTries = 0; ctaNext.click(); return schedule(); }

        // 过渡帧无按钮：等待重试，有抉择卡片时给更长等待
        idleTries++;
        var limit = document.querySelector('article.card.decide') ? 90 : 60;
        if (idleTries < limit) return schedule();
        return finish('idle');
       } catch (err) { return finish('error'); }
      }

      function schedule() { setTimeout(step, stepDelay); }
      step();
    });
  }

  // 排空当前通知/结果（不处理抉择）
  async function clearOverlays() {
    var g = 0;
    while (g++ < 200) {
      var d = visibleNode(Array.from(document.querySelectorAll('[data-act="dismiss"]')));
      if (d) { d.click(); await tick(15); continue; }
      var e = visibleNode(Array.from(document.querySelectorAll('.mbl-era-pop-ok')));
      if (e) { e.click(); await tick(15); continue; }
      var n = visibleNode(Array.from(document.querySelectorAll('[data-act="noticeok"]')));
      if (n) { n.click(); await tick(15); continue; }
      break;
    }
  }

  window.MBLAutoSim = {
    autoPlay: autoPlay,
    clearOverlays: clearOverlays,
    currentChoice: currentChoice,
    isMajor: isMajor
  };
})();
