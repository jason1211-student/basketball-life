/* bracket.js：季后赛对阵图（bracket）的纯数据快照。
 * 不改变任何比赛/系列赛结算逻辑，只在赛季初始化(N6)与每轮推进(UY/H_)时，
 * 把每轮对阵、种子、系列赛比分与胜者写进 season.bracket，供视图层渲染。
 * 数据结构：season.bracket = [round, ...]，round = [matchup, ...]，
 * matchup = {a,b(球队索引；-2=TBD；-1=bye空轮), aSeed,bSeed, aWins,bWins, winner}。
 * 删除文件即可回退（game.js 内全部以可选链调用，缺它不影响原有流程）。 */
(function () {
  'use strict';
  if (window.MBLBracket) return;
  var TBD = -2, BYE = -1;

  function seedOf(o, t) { return t >= 0 ? (o.seeds[t] || 0) : 0; }

  function mk(o, a, b) {
    var m = {
      a: a, b: b,
      aSeed: seedOf(o, a), bSeed: seedOf(o, b),
      aWins: null, bWins: null, winner: null
    };
    if (b === BYE) m.winner = a;
    if (a === BYE) m.winner = b;
    return m;
  }

  function init(o) {
    var alive = o.alive, L = alive.length, count = tI(L), rounds = [];
    var cur = alive.slice();
    for (var r = 0; r < count; r++) {
      var pairs = [];
      for (var k = 0; k < cur.length / 2; k++) {
        var a = cur[o.fixed ? 2 * k : k];
        var b = cur[o.fixed ? 2 * k + 1 : cur.length - 1 - k];
        pairs.push(mk(o, a, b));
      }
      rounds.push(pairs);
      cur = new Array(Math.max(1, cur.length / 2)).fill(TBD);
    }
    o.bracket = rounds;
  }

  // 找到当前轮（对阵数 === aliveBefore.length/2）
  function roundIndex(o, aliveBefore) {
    var want = aliveBefore.length / 2;
    for (var i = 0; i < o.bracket.length; i++) {
      if (o.bracket[i].length === want) return i;
    }
    return -1;
  }

  // 一轮推进：res 与当前轮对阵同序，每项 {y,w,wy,ww,winner}
  function advance(o, aliveBefore, aliveAfter, res) {
    if (!o.bracket) return;
    var ri = roundIndex(o, aliveBefore);
    if (ri < 0) return;
    var round = o.bracket[ri];
    for (var k = 0; k < round.length; k++) {
      var m = round[k], q = res[k];
      if (!q) continue;
      m.a = q.y; m.b = q.w;
      m.aSeed = seedOf(o, q.y); m.bSeed = seedOf(o, q.w);
      if (q.wy !== null) m.aWins = q.wy;
      if (q.ww !== null) m.bWins = q.ww;
      m.winner = q.winner;
    }
    // 铺下一轮
    if (ri + 1 < o.bracket.length) {
      var nxt = o.bracket[ri + 1];
      for (var j = 0; j < nxt.length; j++) {
        var a = aliveAfter[o.fixed ? 2 * j : j];
        var b = aliveAfter[o.fixed ? 2 * j + 1 : aliveAfter.length - 1 - j];
        if (a === undefined) a = TBD;
        if (b === undefined) b = TBD;
        nxt[j].a = a; nxt[j].b = b;
        nxt[j].aSeed = seedOf(o, a); nxt[j].bSeed = seedOf(o, b);
        if (b === BYE) nxt[j].winner = a;
        else if (a === BYE) nxt[j].winner = b;
      }
    }
  }

  // 玩家自己的系列赛：H_ 算出精确比分后写入
  function setWins(o, myIndex, myWins, oppWins) {
    if (!o.bracket) return;
    var round = o.bracket[roundIndex(o, o.alive)];
    if (!round) return;
    for (var k = 0; k < round.length; k++) {
      var m = round[k];
      if (m.a === myIndex) { m.aWins = myWins; m.bWins = oppWins; return; }
      if (m.b === myIndex) { m.bWins = myWins; m.aWins = oppWins; return; }
    }
  }

  window.MBLBracket = {
    init: init,
    advance: advance,
    setWins: setWins,
    TBD: TBD, BYE: BYE
  };
})();
