/* 额外人物决策事件注入（单机复刻扩展）。
 * 复用内核模板结构与辅助函数：注册到 yR 注册表，由既有 qf/Htt 渲染与结算；
 * 外挂调度钩子仅在当前无待办决策时，按阶段条件低概率推入 pending，触发过的不再重复。
 * 事件结果同样走概率分支，幅度温和，不改动内核成长规则。
 * 注意：回调参数统一命名 life，避免遮蔽内核状态函数 window.l。 */
(function () {
  'use strict';
  if (window.MBLExtraEvents) return;
  var C = window.MBLCore;

  var a = window.a;
  var setStatus = window.l; // 内核状态修改函数 l(life,status,n)

  // 文案简写
  function T(en, hans, hant) { return a(en, hans, hant); }

  var EXTRA = [
    // —— 童年成长（4-12 岁）——
    {
      id: 'mbl_kid_coach',
      ages: [4, 12],
      when: function (life) { return life.age >= 4 && life.age <= 12; },
      title: T('A coach notices you', '教练注意到了你', '教練注意到了你'),
      text: T('At practice, a coach stopped to watch you for a while and nodded. How do you respond?',
        '训练时，一位教练停下来看了你一会儿，点了点头。你会怎么做？',
        '訓練時，一位教練停下來看了你一會兒，點了點頭。你會怎麼做？'),
      choices: [
        {
          key: 'extra_drill',
          text: T('Stay and drill extra', '留下多加一组训练', '留下多加一組訓練'),
          lean: { discipline: 1, ambition: 1 },
          apply: function (life) {
            if (k(life, 0.7)) { be(life, ['handling', 'three'], 2); d(life, T('Your extra reps showed. The coach said you had a nose for the game.',
              '加练的效果看得见，教练说你很有球感。', '加練的效果看得見，教練說你很有球感。'), {}); }
            else { setStatus(life, 'health', -2); $(life, T('You pushed too hard and ended up sore for days.',
              '练得太猛，酸痛了好几天。', '練得太猛，酸痛了好幾天。'), {}); }
          }
        },
        {
          key: 'shy_watch',
          text: T('Watch quietly from the side', '在旁边安静看着', '在旁邊安靜看著'),
          lean: { patience: 1 },
          apply: function (life) { setStatus(life, 'happiness', 1); _(life, 'patience', 1); }
        },
        {
          key: 'run_play',
          text: T('Go join your friends', '跑去找小伙伴玩', '跑去找小夥伴玩'),
          lean: { empathy: 1 },
          apply: function (life) { setStatus(life, 'relationships', 1); }
        }
      ]
    },
    {
      id: 'mbl_kid_streetball',
      ages: [6, 12],
      when: function (life) { return life.age >= 6 && life.age <= 12; },
      title: T('Streetball invitation', '街头野球邀约', '街頭野球邀約'),
      text: T('Older kids on the court wave you over to join their pickup game. Do you dare?',
        '场上大孩子招手叫你加入野球局。你敢不敢上？', '場上大孩子招手叫你加入野球局。你敢不敢上？'),
      choices: [
        {
          key: 'join_in',
          text: T('Step onto the court', '上场试一试', '上場試一試'),
          lean: { bravery: 1 },
          apply: function (life) {
            if (k(life, 0.6)) { be(life, ['athleticism'], 2); d(life, T('You held your own against older kids and loved every minute.',
              '你跟大孩子打得有来有回，乐在其中。', '你跟大孩子打得有來有回，樂在其中。'), {}); }
            else { setStatus(life, 'health', -1); $(life, T('Outmatched, you came off the court a little bruised.',
              '实力跟不上，下场时带了点伤。', '實力跟不上，下場時身上帶了點傷。'), {}); }
          }
        },
        {
          key: 'watch_learn',
          text: T('Study from the sidelines', '在场边观察学习', '在場邊觀察學習'),
          lean: { curiosity: 1 },
          apply: function (life) { _(life, 'intelligence', 1); }
        }
      ]
    },
    // —— 青年校园（13-19 岁）——
    {
      id: 'mbl_ball_vs_study',
      ages: [13, 19],
      when: function (life) { return life.age >= 13 && life.age <= 19; },
      title: T('Basketball vs. books', '篮球与学业', '籃球與學業'),
      text: T('Practice and exams keep colliding this term. Where do you put your energy?',
        '这学期训练和考试总撞在一起，你把精力放在哪边？', '這學期訓練和考試總撞在一起，你把精力放在哪邊？'),
      choices: [
        {
          key: 'ball_first',
          text: T('Commit to basketball', '全力投入篮球', '全力投入籃球'),
          lean: { ambition: 1, discipline: 1 },
          apply: function (life) {
            be(life, ['three'], 2);
            if (k(life, 0.5)) { _(life, 'intelligence', -1); $(life, T('Studies slipped, and a grade cost you a warning.',
              '功课落下了，一门成绩让你收到了提醒。', '功課落下了，一門成績讓你收到了提醒。'), {}); }
          }
        },
        {
          key: 'balance',
          text: T('Keep both going', '两头兼顾', '兩頭兼顧'),
          lean: { discipline: 1 },
          apply: function (life) { _(life, 'intelligence', 1); setStatus(life, 'happiness', -1); }
        },
        {
          key: 'take_easy',
          text: T('Take it easy on both', '两边都松一点', '兩邊都鬆一點'),
          lean: {},
          apply: function (life) { setStatus(life, 'happiness', 1); }
        }
      ]
    },
    {
      id: 'mbl_teammate_friction',
      ages: [13, 19],
      when: function (life) { return life.age >= 13 && life.age <= 19; },
      title: T('Friction with a teammate', '和队友起了摩擦', '和隊友起了摩擦'),
      text: T('A teammate argued with you over a missed play in the huddle. How do you handle it?',
        '一次失误后，队友在板凳旁和你争了起来。你怎么处理？', '一次失誤後，隊友在板凳旁和你爭了起來。你怎麼處理？'),
      choices: [
        {
          key: 'talk_out',
          text: T('Talk it through', '主动沟通和解', '主動溝通和解'),
          lean: { charisma: 1, empathy: 1 },
          apply: function (life) {
            setStatus(life, 'relationships', 2);
            if (k(life, 0.7)) _(life, 'charisma', 1);
          }
        },
        {
          key: 'go_silent',
          text: T('Keep it to yourself', '各打各的', '各打各的'),
          lean: {},
          apply: function (life) { setStatus(life, 'relationships', -2); }
        },
        {
          key: 'ask_coach',
          text: T('Let the coach sort it', '找教练评理', '找教練評理'),
          lean: {},
          apply: function (life) { setStatus(life, 'relationships', -1); }
        }
      ]
    },
    // —— 职业赛场（进入职业后）——
    {
      id: 'mbl_pro_minor_injury',
      ages: [18, 40],
      when: function (life) { return !!(life.ball && life.ball.pro && !life.ball.retiredFromPlaying); },
      title: T('A minor knock', '一处小伤', '一處小傷'),
      text: T('A minor injury nags at you before an important stretch. Do you play through it?',
        '关键赛程前，一处小伤隐隐作痛。你要不要带伤上场？', '關鍵賽程前，一處小傷隱隱作痛。你要不要帶傷上場？'),
      choices: [
        {
          key: 'play_through',
          text: T('Play through it', '带伤坚持', '帶傷堅持'),
          lean: { bravery: 1 },
          apply: function (life) {
            if (k(life, 0.5)) { setStatus(life, 'health', -4); $(life, T('The knock flared up and kept you out longer than expected.',
              '伤势加重，比预期缺阵更久。', '傷勢加重，比預期缺陣更久。'), {}); }
            else be(life, ['finishing'], 1);
          }
        },
        {
          key: 'rest_up',
          text: T('Rest and recover', '安心休养', '安心休養'),
          lean: { patience: 1 },
          apply: function (life) { setStatus(life, 'health', 3); }
        }
      ]
    },
    {
      id: 'mbl_contract_year',
      ages: [18, 40],
      when: function (life) { return !!(life.ball && life.ball.pro && !life.ball.retiredFromPlaying); },
      title: T('Contract year', '合同年', '合同年'),
      text: T('This season decides your next deal. What mindset do you bring?',
        '这个赛季决定你的下一份合同，你抱着什么心态？', '這個賽季決定你的下一份合同，你抱著什麼心態？'),
      choices: [
        {
          key: 'push_deal',
          text: T('Chase the big deal', '全力争取大合同', '全力爭取大合同'),
          lean: { ambition: 1 },
          apply: function (life) {
            if (k(life, 0.55)) { be(life, ['mid'], 2); d(life, T('You played hungry and scouts took notice.',
              '你打得很拼，球探看在眼里。', '你打得很拼，球探看在眼裡。'), {}); }
            else setStatus(life, 'happiness', -2);
          }
        },
        {
          key: 'stay_calm',
          text: T('Stay level-headed', '保持平常心', '保持平常心'),
          lean: { patience: 1 },
          apply: function (life) { setStatus(life, 'happiness', 1); }
        }
      ]
    },
    // —— 场下人生（16 岁后）——
    {
      id: 'mbl_endorsement_trap',
      ages: [16, 45],
      when: function (life) { return life.age >= 16; },
      title: T('An endorsement offer', '一份代言邀约', '一份代言邀約'),
      text: T('A commercial offer lands in your lap that could distract from the season. Do you take it?',
        '一份商业代言找上门，可能分散赛季精力。你接不接？', '一份商業代言找上門，可能分散賽季精力。你接不接？'),
      choices: [
        {
          key: 'take_deal',
          text: T('Take the endorsement', '接下代言', '接下代言'),
          lean: { charisma: 1 },
          apply: function (life) {
            _(life, 'charisma', 1); setStatus(life, 'happiness', 1);
            if (k(life, 0.4)) _(life, 'discipline', -1);
          }
        },
        {
          key: 'decline_focus',
          text: T('Decline, focus on court', '婉拒，专注赛场', '婉拒，專注賽場'),
          lean: { discipline: 1 },
          apply: function (life) { be(life, ['handling'], 1); }
        }
      ]
    },
    {
      id: 'mbl_slump_mindset',
      ages: [16, 45],
      when: function (life) { return life.age >= 16; },
      title: T('A slump of confidence', '状态低谷', '狀態低谷'),
      text: T('Results have dipped and confidence is fraying. How do you climb out?',
        '表现下滑，信心有些动摇。你怎么走出来？', '表現下滑，信心有些動搖。你怎麼走出來？'),
      choices: [
        {
          key: 'grind_out',
          text: T('Grind through extra work', '加练找回状态', '加練找回狀態'),
          lean: { resilience: 1, discipline: 1 },
          apply: function (life) {
            if (k(life, 0.6)) { be(life, ['mid'], 2); d(life, T('Extra work steadied your shot and your nerve.',
              '加练稳住了手感，也稳住了心态。', '加練穩住了手感，也穩住了心態'), {}); }
            else { setStatus(life, 'health', -2); $(life, T('Overworked, you still couldn’t shake the slump.',
              '练过头了，低谷还是没走出来。', '練過頭了，低谷還是沒走出來。'), {}); }
          }
        },
        {
          key: 'reset_mind',
          text: T('Rest and reset mentally', '调整心态休息', '調整心態休息'),
          lean: { patience: 1 },
          apply: function (life) { setStatus(life, 'happiness', 2); }
        }
      ]
    }
  ];

  function register() {
    if (!window.yR || typeof k !== 'function') return false;
    EXTRA.forEach(function (e) {
      if (yR.has(e.id)) return;
      yR.set(e.id, {
        kind: 'decision',
        id: e.id,
        ages: e.ages,
        weight: 1,
        when: e.when,
        title: e.title,
        text: e.text,
        choices: e.choices
      });
    });
    return true;
  }

  function maybeInject() {
    var life = window.de && de.life;
    if (!life || !life.alive) return;
    if (life.pending && life.pending.length) return;
    var flags = life.flags || (life.flags = {});
    var used = flags.mblExtraEvents || (flags.mblExtraEvents = {});
    var avail = EXTRA.filter(function (e) { return !used[e.id] && e.when(life); });
    if (!avail.length) return;
    if (tr(life) > 0.12) return; // 低概率，避免刷屏
    var pick = avail[Math.floor(tr(life) * avail.length)];
    life.pending.push({ tid: pick.id, params: {}, pool: 'life' });
    used[pick.id] = 1;
    window.de.screen === 'play' && mn();
  }

  window.MBLExtraEvents = { register: register, maybeInject: maybeInject, list: EXTRA.map(function (e) { return e.id; }) };

  // 注册等待：统一心跳兜底，就绪（或超 40 次）后自行注销
  if (!register()) {
    var tries = 0;
    function waitRegister() {
      if (register() || ++tries > 40) C.offHeartbeat(waitRegister);
    }
    C.onHeartbeat(waitRegister, 120);
  }
  // 事件注入：接入统一心跳，最小间隔 900ms
  C.onHeartbeat(maybeInject, 900);
})();
