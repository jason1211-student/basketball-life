(function () {
  'use strict';
  if (window.MBLMatchRecord) return;

  const ratingKeys = ['layup', 'dunk', 'three', 'mid', 'freeThrow', 'handle', 'pass', 'speedWithBall', 'iq',
    'perimeterD', 'interiorD', 'steal', 'block', 'rebound', 'speed', 'strength', 'vertical'];

  function seedFor(life, season, phase, index) {
    const identity = JSON.stringify([life.seed, season.year, season.leagueId,
      season.team?.en, season.cup ?? null, phase, index]);
    let seed = 2166136261;
    for (let i = 0; i < identity.length; i++) seed = Math.imul(seed ^ identity.charCodeAt(i), 16777619);
    return seed >>> 0;
  }

  function rng(seed) {
    let state = seed >>> 0;
    return function () {
      state = (state + 1831565813) >>> 0;
      let value = Math.imul(state ^ state >>> 15, state | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  function packTeam(team) {
    return [team.name, team.color, team.players.map(player => [player.id, player.name, player.pos,
      player.ovr, ratingKeys.map(key => player.ratings ? player.ratings[key] : player[key]), player.badges ?? null,
      ...(player.rotation ? [player.age??null,player.pot??null,player.rotation] : Number.isFinite(player.pot) ? [player.age ?? null,player.pot] : Number.isFinite(player.age) ? [player.age] : [])])];
  }

  function unpackTeam(team) {
    if (!Array.isArray(team) || !Array.isArray(team[2]) || !team[2].length) return null;
    return { name: team[0], color: team[1], players: team[2].map(([id, name, pos, ovr, ratings, badges, age, pot, rotation]) => ({
      id, name, pos, ovr, ratings: Object.fromEntries(ratingKeys.map((key, i) => [key, ratings?.[i]])),
      ...(badges != null ? { badges } : {}), ...(rotation ? {rotation} : {}), ...(Number.isFinite(age) ? {age} : {}), ...(Number.isFinite(pot) ? {pot} : {})
    })) };
  }

  function snapshot(mu, seed) {
    return JSON.parse(JSON.stringify({ version: mu.model===4?3:2, ...(mu.model===4?{context:mu.context||{},rule:1}:{}), engine: mu.model===4?4: [mu.home,mu.away].some(team=>team.players.some(p=>p.rotation)) ? 3 : mu.model===3 ? 2 : 1, seed,
      mySide: mu.mySide, home: packTeam(mu.home), away: packTeam(mu.away),
      ...(Number.isFinite(mu.year) ? {year:mu.year,leagueId:mu.leagueId} : {}) }));
  }

  function matchup(record) {
    if (!record || !(([1,2].includes(record.version)&&[1,2,3].includes(record.engine))||(record.version===3&&record.engine===4&&record.rule===1)) || !Number.isInteger(record.seed) ||
        !['home', 'away'].includes(record.mySide)) return null;
    if(record.engine===4){
      for(const side of ['home','away']){
        const rows=record[side]?.[2];
        if(!Array.isArray(rows)||rows.length<5||rows.some(r=>!Array.isArray(r)||typeof r[0]!=='string'||
          !Array.isArray(r[4])||r[4].length!==ratingKeys.length||!r[4].every(Number.isFinite))||
          new Set(rows.map(r=>r[0])).size!==rows.length)return null;
      }
    }
    const copy = JSON.parse(JSON.stringify(record));
    const home = record.version >= 2 ? unpackTeam(copy.home) : copy.home;
    const away = record.version >= 2 ? unpackTeam(copy.away) : copy.away;
    if (!home?.players?.length || !away?.players?.length) return null;
    return { home, away, mySide: copy.mySide,seed:copy.seed,
      ...(Number.isFinite(copy.year) ? {year:copy.year,leagueId:copy.leagueId} : {}) };
  }

  function simulate(record,details=true) {
    const mu = matchup(record);
    if(mu && record.engine===4)return window.MBLMatchV4.simulate(mu,record,details);
    return mu ? window.MBLMatchEngine.simulate(mu.home, mu.away, { rng: rng(record.seed), overtime: true,engine:record.engine }) : null;
  }

  function replay(game) {
    const record = game.matchRecord;
    let result;try{result=simulate(record);}catch(_){return null;}
    if(record?.engine===4 && game.digest!==undefined && game.digest!==result?.digest)return null;
    if (!result) return null;
    const mySide = record.mySide;
    const otherSide = mySide === 'home' ? 'away' : 'home';
    if (result.score[mySide] !== game.us || result.score[otherSide] !== game.them) return null;
    return { mu: matchup(record), game: result };
  }

  window.MBLMatchRecord = { seedFor, rng, snapshot, matchup, simulate, replay };
})();
