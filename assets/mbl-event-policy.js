(function () {
  'use strict';
  if (window.MBLEventPolicy) return;

  const schoolEvents = new Set(['mbl_ball_vs_study', 'cn_gaokao', 'br_enem', 'de_abitur', 'es_selectividad',
    'fr_bac', 'gr_panhellenic', 'hk_dse', 'id_ujian', 'it_maturita', 'jp_recommendation', 'kr_suneung',
    'lb_exams', 'my_spm', 'ng_waec', 'nz_ncea', 'rs_exam', 'si_matura', 'sn_bac', 'tr_yks', 'tw_gsat',
    'us_homecoming', 'us_prom', 'ba_matura', 'eg_thanaweya', 'gb_gcses', 'vn_exam', 'vn_extra_classes']);

  function playingPro(life) {
    return !!(life.ball?.pro && !life.ball.retiredFromPlaying && !life.prisonYears);
  }

  function regular(life) {
    const season = life.ball?.season;
    return playingPro(life) && season?.phase === 'regular' && !season.staff &&
      (typeof Oa !== 'function' || Oa(life) === season) ? season : null;
  }

  function eligible(life, template) {
    if (!template || window.MBLTeamRoom?.eligible(life,template.id)===false) return false;
    if (template.pool === 'campus' || schoolEvents.has(template.id)) {
      if (!life.inSchool || life.ball?.pro || life.ball?.retiredFromPlaying) return false;
    }
    return true;
  }

  function seasonKey(season) {
    return season ? JSON.stringify([season.year, season.leagueId, season.team?.en, season.cup ?? null]) : null;
  }

  function state(life) {
    life.flags ||= {};
    if (!life.flags.mblEventProgress) life.flags.mblEventProgress = { version: 1, checkpointAge: life.age, checkpoints: [], followUps: [] };
    return life.flags.mblEventProgress;
  }

  function claimCheckpoint(life, at) {
    const data = state(life);
    const season = regular(life);
    const count = season?.games?.length ?? 0;
    const progress = Number.isFinite(at) ? at : 0;
    const key = JSON.stringify([seasonKey(season), season ? Math.floor(count / 8) : Math.floor(Math.max(0, Math.min(1, progress)) * 4)]);
    if (data.checkpointAge !== life.age) { data.checkpointAge = life.age; data.checkpoints = []; }
    data.checkpoints ||= [];
    if (data.checkpoints.includes(key)) return false;
    data.checkpoints.push(key);
    return true;
  }

  function schedule(life, kind, games) {
    const season = regular(life);
    if (!season) return;
    const data = state(life);
    data.followUps.push({ kind, age: life.age, season: seasonKey(season), atGame: Math.min(season.total, season.games.length + games) });
  }

  function followUp(life) {
    const data = life.flags?.mblEventProgress;
    if (!data || data.version !== 1 || !Array.isArray(data.followUps)) return false;
    const season = life.ball?.season;
    const key = seasonKey(season);
    const due = data.followUps.filter(item => life.age > item.age || key !== item.season || season.games.length >= item.atGame);
    if (!due.length) return false;
    data.followUps = data.followUps.filter(item => !due.includes(item));
    for (const item of due) {
      if (!playingPro(life)) continue;
      if (item.kind === 'injury_rest') {
        l(life, 'health', 3);
        l(life, 'happiness', 1);
        d(life, a('The recovery plan paid off. You feel ready again.', '复查结果良好，之前的休养终于见效，你重新找回了上场的信心。', '複查結果良好，之前的休養終於見效，你重新找回了上場的信心。'), {}, 'event');
      } else if (item.kind === 'injury_risk') {
        l(life, 'health', -4);
        if (key === item.season && season.phase === 'regular') life.ball.out = Math.max(life.ball.out ?? 0, 3);
        $(life, a('The earlier knock has caught up with you.', '之前坚持带伤上阵的代价出现了，伤势反复，队医建议停止训练。', '之前堅持帶傷上陣的代價出現了，傷勢反覆，隊醫建議停止訓練。'), {});
      } else if (item.kind === 'contract_pressure' && key === item.season) {
        const recent = season.games.slice(-5);
        const wins = recent.filter(game => game.us > game.them).length;
        if (recent.length >= 3 && wins >= Math.ceil(recent.length / 2)) {
          l(life, 'reputation', 2);
          d(life, a('Your recent performances have eased the contract pressure.', '过去几场的表现让合同谈判的压力减轻了不少。', '過去幾場的表現讓合同談判的壓力減輕了不少。'), {}, 'event');
        } else {
          l(life, 'happiness', -2);
          d(life, a('The contract pressure is beginning to weigh on you.', '争取大合同的压力开始影响你的心态。', '爭取大合同的壓力開始影響你的心態。'), {}, 'event');
        }
      }
    }
    return true;
  }

  window.MBLEventPolicy = { eligible, playingPro, regular, claimCheckpoint, schedule, followUp };
})();
