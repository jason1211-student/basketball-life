/* Display-only statistics shared by the broadcast and historical report. */
(function(){
  'use strict';
  const C=window.MBLCore, h=C.h;
  function lead(home,away){
    home=Number.isFinite(home)?Math.max(0,home):0; away=Number.isFinite(away)?Math.max(0,away):0;
    return {share:home+away?home/(home+away)*100:50,side:home>away?'home':away>home?'away':'tie',gap:Math.abs(home-away)};
  }
  function clock(seconds){const n=Math.max(0,Math.floor(Number(seconds)||0));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}
  function compactTotals(team){
    const t=Array(15).fill(0);for(const r of team?.rows||[])for(let i=0;i<t.length;i++)t[i]+=Number(r?.s?.[i])||0;
    const pct=(made,attempted)=>attempted?Math.round(made/attempted*100)+'%':'—';
    return {fg:pct(t[3],t[2]),three:pct(t[5],t[4]),ft:pct(t[7],t[6]),reb:t[8]+t[9],ast:t[10],turnovers:t[13]};
  }
  function report(g){
    const hero=h('section','arena-report-hero');
    const label=h('span','arena-eyebrow','终场战报');
    const score=h('div','arena-report-score');
    const mine=h('div'),opp=h('div');
    mine.append(h('small','','我方'),h('b','',String(g.us??'—')));
    opp.append(h('small','',C.hans(g.opp)||'对手'),h('b','',String(g.them??'—')));
    score.append(mine,h('span','','–'),opp);
    const result=g.us>g.them?'胜利':g.us<g.them?'失利':'平局';
    hero.append(label,score,h('p','',`${result} · ${g.home?'主场':'客场'}${g.overtime?' · '+g.overtime+' 次加时':''}`));
    return hero;
  }
  function comparison(box){
    const card=h('section','arena-box-comparison');
    if(!box?.home||!box?.away)return card;
    const home=compactTotals(box.home),away=compactTotals(box.away);
    const head=h('div','arena-compare-row arena-compare-head');head.append(h('b','',box.home.name||'主队'),h('span','','球队对比'),h('b','',box.away.name||'客队'));card.append(head);
    for(const [key,label] of [['fg','投篮命中率'],['three','三分命中率'],['ft','罚球命中率'],['reb','篮板'],['ast','助攻'],['turnovers','失误']]){
      const row=h('div','arena-compare-row');row.append(h('b','',String(home[key])),h('span','',label),h('b','',String(away[key])));card.append(row);
    }return card;
  }
  window.MBLArenaMatch={lead,clock,compactTotals,report,comparison};
})();
