/* Presentation and derived statistics only. No game state mutations. */
(function () {
  'use strict';
  if (window.MBLArenaSports) return;
  const C = window.MBLCore, h = C.h;
  let owner = null;
  const selected = new Map();

  function tabs(root, key, items) {
    if (owner !== C.life()) { owner = C.life(); selected.clear(); }
    const nav = h('div', 'arena-subnav');
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', key === 'team' ? '球队内容分类' : key === 'journey' ? '生涯档案分类' : '球员发展分类');
    const panels = {}, buttons = {};
    for (const [id, label] of items) {
      const button = h('button', 'arena-subnav-btn', label);
      button.type = 'button';
      button.dataset.arenaTab = id;
      button.id='arena-tab-'+key+'-'+id;
      button.setAttribute('role','tab');
      button.setAttribute('aria-controls','arena-panel-'+key+'-'+id);
      buttons[id] = button;
      nav.append(button);
      const panel = h('section', 'arena-subpanel');
      panel.dataset.arenaPanel = id;
      panel.id='arena-panel-'+key+'-'+id;
      panel.setAttribute('role','tabpanel');
      panel.setAttribute('aria-labelledby',button.id);
      panels[id] = panel;
      button.addEventListener('click', () => select(id));
    }
    function select(id) {
      selected.set(key, id);
      for (const [name] of items) {
        const active = id === name;
        buttons[name].setAttribute('aria-selected',String(active));
        buttons[name].tabIndex=active?0:-1;
        panels[name].hidden = !active;
      }
    }
    root.replaceChildren(nav, ...Object.values(panels));
    window.MBLInteraction?.tabKeys(nav,()=>Object.values(buttons));
    const active = selected.get(key);
    select(panels[active] ? active : items[0][0]);
    return panels;
  }

  function categories(skills, potential, cats) {
    function mean(obj, keys, fallback) {
      const values = keys.map(k => Number.isFinite(obj?.[k]) ? obj[k] : fallback?.[k]).filter(Number.isFinite);
      return values.length ? Math.round(C.clamp(values.reduce((s,v) => s+v,0)/values.length,0,99)) : null;
    }
    return cats.map(cat => ({ name:cat.name, current:mean(skills,cat.keys), potential:mean(potential,cat.keys,skills) }));
  }

  function radar(b, cats) {
    const values = categories(b.skills, b.potential, cats);
    const card = h('section', 'arena-radar card');
    card.append(h('h3', '', '能力画像'), h('p', 'arena-muted', '五个能力维度 · 维度内属性平均值'));
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox','0 0 220 220');
    svg.setAttribute('aria-hidden','true');
    const point = (index, value) => {
      const theta = -Math.PI/2 + index * Math.PI*2/values.length;
      return [110 + Math.cos(theta)*90*value, 110 + Math.sin(theta)*90*value].map(v=>v.toFixed(2)).join(',');
    };
    function polygon(points, cls) {
      const p = document.createElementNS(ns,'polygon');
      p.setAttribute('points',points.join(' '));p.setAttribute('class',cls);svg.append(p);
    }
    for (const level of [.25,.5,.75,1]) polygon(values.map((_,i)=>point(i,level)), 'arena-radar-grid');
    for (let i=0;i<values.length;i++) {
      const line=document.createElementNS(ns,'line');const [x,y]=point(i,1).split(',');
      for (const [k,v] of Object.entries({x1:110,y1:110,x2:x,y2:y,class:'arena-radar-grid'})) line.setAttribute(k,v);
      svg.append(line);
    }
    polygon(values.map((v,i)=>point(i,(v.potential??0)/99)), 'arena-radar-potential');
    polygon(values.map((v,i)=>point(i,(v.current??0)/99)), 'arena-radar-current');
    const layout=h('div','arena-radar-layout'), list=h('ul','arena-radar-values');
    for (const v of values) {
      const li=h('li'); li.append(h('span','',v.name),h('b','',`${v.current ?? '—'} / ${v.potential ?? '—'}`)); list.append(li);
    }
    layout.append(svg,list);card.append(layout,h('p','arena-muted','实线：当前能力　虚线：潜力'));return card;
  }

  function summarize(games) {
    const valid = (Array.isArray(games)?games:[]).filter(g=>Number.isFinite(g?.us)&&Number.isFinite(g.them));
    const wins=valid.filter(g=>g.us>g.them).length, losses=valid.filter(g=>g.us<g.them).length;
    const players=valid.filter(g=>!g.dnp && Number.isFinite(g.pts));
    const avg=(key,records)=>{const a=records.map(g=>g[key]).filter(Number.isFinite);return a.length ? (a.reduce((s,v)=>s+v,0)/a.length).toFixed(1):'—';};
    return {played:valid.length,wins,losses,ties:valid.length-wins-losses,winPct:valid.length?Math.round(wins/valid.length*100):null,
      playerGames:players.length,points:avg('pts',players),rebounds:avg('reb',players),assists:avg('ast',players),recent:valid.slice(-5).reverse()};
  }

  function teamOverview(life) {
    const card=h('section','arena-team-overview');
    const s=life.ball?.season, team=s?.team || life.ball?.pro?.team;
    const hero=h('header','arena-team-hero');
    const teamIdentity=h('div','mbl-art-team-name');
    teamIdentity.append(h('h3','',C.hans(team)||'尚未签约球队'), h('p','',s?.year?`${s.year}–${String(s.year+1).slice(-2)} 赛季`:'进入职业后解锁赛季数据'));
    hero.append(teamIdentity);
    if(team?.en&&window.MBLCareerArt)hero.append(MBLCareerArt.jersey(team,life.ball?.number));
    card.append(hero);
    if (!s) return card;
    const data=summarize(s.games);
    const stats=h('div','arena-team-stats');
    function metric(label,value) {const n=h('div','arena-team-metric');n.append(h('span','',label),h('b','',String(value)));stats.append(n);}
    metric('胜 / 负',`${data.wins}–${data.losses}${data.ties?'–'+data.ties:''}`);
    metric('胜率',data.winPct===null?'—':`${data.winPct}%`);metric('已记录场次',data.played);
    card.append(stats);
    const player=h('div','arena-player-split');
    for(const [label,value] of [['场均得分',data.points],['场均篮板',data.rebounds],['场均助攻',data.assists]]){
      const n=h('div');n.append(h('b','',value),h('span','',label));player.append(n);
    }
    card.append(h('h4','arena-block-title',`球员表现 · ${data.playerGames} 场有得分记录`),player,h('h4','arena-block-title','最近比赛'));
    if(!data.recent.length) card.append(h('p','arena-muted','赛季开始后将显示比赛记录。'));
    for(const g of data.recent){const row=h('div','arena-recent-row');row.append(h('span',g.us>g.them?'arena-win':g.us<g.them?'arena-loss':'',g.us>g.them?'胜':g.us<g.them?'负':'平'),h('span','',`${g.home?'主场':'客场'} · ${C.hans(g.opp)||'对手'}`),h('b','',`${g.us}–${g.them}`));card.append(row);}
    return card;
  }
  window.MBLArenaSports={tabs,categories,radar,summarize,teamOverview};
})();
