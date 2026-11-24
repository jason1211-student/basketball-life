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
      player.ovr, ratingKeys.map(key => player.ratings ? player.ratings[key] : player[key]), player.badges ?? null])];
  }

  function unpackTeam(team) {
    if (!Array.isArray(team) || !Array.isArray(team[2]) || !team[2].length) return null;
    return { name: team[0], color: team[1], players: team[2].map(([id, name, pos, ovr, ratings, badges]) => ({
      id, name, pos, ovr, ratings: Object.fromEntries(ratingKeys.map((key, i) => [key, ratings[i]])),
      ...(badges !== null ? { badges } : {})
    })) };
  }

  function snapshot(mu, seed) {
    return JSON.parse(JSON.stringify({ version: 2, engine: 1, seed,
      mySide: mu.mySide, home: packTeam(mu.home), away: packTeam(mu.away) }));
  }

  function matchup(record) {
    if (!record || ![1, 2].includes(record.version) || record.engine !== 1 || !Number.isInteger(record.seed) ||
        !['home', 'away'].includes(record.mySide)) return null;
    const copy = JSON.parse(JSON.stringify(record));
    const home = record.version === 2 ? unpackTeam(copy.home) : copy.home;
    const away = record.version === 2 ? unpackTeam(copy.away) : copy.away;
    if (!home?.players?.length || !away?.players?.length) return null;
    return { home, away, mySide: copy.mySide };
  }

  function simulate(record) {
    const mu = matchup(record);
    return mu ? window.MBLMatchEngine.simulate(mu.home, mu.away, { rng: rng(record.seed), overtime: true }) : null;
  }

  function replay(game) {
    const record = game.matchRecord;
    const result = simulate(record);
    if (!result) return null;
    const mySide = record.mySide;
    const otherSide = mySide === 'home' ? 'away' : 'home';
    if (result.score[mySide] !== game.us || result.score[otherSide] !== game.them) return null;
    return { mu: matchup(record), game: result };
  }

  window.MBLMatchRecord = { seedFor, rng, snapshot, simulate, replay };
})();
