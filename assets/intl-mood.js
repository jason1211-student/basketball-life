/* 世界赛「赛前抉择」增强层（单机离线，简略版）。
 * 玩家入选国家队时，可选择本届大赛的心态/打法，影响：
 *   medal   —— 奖牌胜算的固定修正（温和，小于内核随机波动，不破坏平衡）
 *   stat    —— 个人整体表现系数
 *   ppg/rpg/apg —— 个人数据的差异化系数
 *   health/happiness/trust —— 赛后副作用
 *   injury  —— 额外受伤概率（搏命才有）
 * 内核 Qte / fYe 在运行时读取 window.MBLIntlMood(life)，无需改事件调度。
 */
(function () {
  var MOOD = {
    // 主动请缨、搏命：扛起进攻，胜算更高、数据更好看，但健康有代价、可能受伤
    bold: {
      medal: 0.35,
      stat: 1.12,
      ppg: 1.18,
      rpg: 1.0,
      apg: 0.95,
      health: -5,
      happiness: 2,
      trust: 3,
      injury: 0.18
    },
    // 稳扎稳打：按教练布置，温和加成，几乎不受伤
    steady: {
      medal: 0.1,
      stat: 1.03,
      ppg: 1.0,
      rpg: 1.0,
      apg: 1.03,
      health: 1,
      happiness: 1,
      trust: 1,
      injury: 0
    },
    // 甘当配角：多做组织和脏活，团队化学反应更好，个人得分下降
    team: {
      medal: 0.2,
      stat: 1.0,
      ppg: 0.85,
      rpg: 1.1,
      apg: 1.15,
      health: 0,
      happiness: 3,
      trust: 2,
      injury: 0
    }
  };

  function currentMood(life) {
    var key = life && life.flags && life.flags.intlMood;
    return (key && MOOD[key]) || null;
  }

  // 玩家在 national_team 事件里选定打法后的统一处理：
  // 记录 mood -> 公共的声望/球迷/caps/首次成就 -> 同步演算世界赛 -> 用完即清。
  function intlCall(life, moodKey) {
    life.flags.intlMood = moodKey;
    l(life, "reputation", 3);
    ye(life, 2);
    life.flags.caps = Number(life.flags.caps == null ? 0 : life.flags.caps) + 1;
    if (Number(life.flags.caps) === 1) {
      Sp(life, a("National team", "国家和地区代表队", "國家隊"));
    }
    Qte(life);
    delete life.flags.intlMood;
  }

  window.MBL_INTL_MOOD = MOOD;
  window.MBLIntlMood = currentMood;
  window.MBLIntlCall = intlCall;
})();
