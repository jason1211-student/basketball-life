/* ARCHIVE / derived career statistics and private lifetime timeline. */
(function(){
  'use strict';
  const C=window.MBLCore,h=C.h,filters=new WeakMap();
  const list=x=>Array.isArray(x)?x:[];
  const valid=x=>Number.isFinite(x);
  const fmt=x=>valid(x)?x.toLocaleString('zh-CN'):'—';
  function aggregate(seasons,awards){
    const s=list(seasons),a=list(awards),played=s.reduce((n,x)=>n+(valid(x.games)&&x.games>0?x.games:0),0);
    function weighted(key){const rows=s.filter(x=>valid(x.games)&&x.games>0&&valid(x[key]));const count=rows.reduce((n,x)=>n+x.games,0);return count?(rows.reduce((n,x)=>n+x[key]*x.games,0)/count).toFixed(1):'—';}
    return {seasons:s.length,played,awards:a.length,titles:a.filter(x=>x.kind==='ring'||x.kind==='cup').length,ppg:weighted('ppg'),rpg:weighted('rpg'),apg:weighted('apg')};
  }
  function metric(label,value){const el=h('div','arena-legacy-metric');el.append(h('b','',String(value)),h('span','',label));return el;}
  function overview(life){
    const b=life.ball||{},data=aggregate(b.seasons,b.awards),card=h('section','arena-legacy-overview');
    const hero=h('div','arena-legacy-hero');
    const stage=life.alive===false?'生涯已完结':b.retiredFromPlaying?'退役生涯':b.pro?'职业生涯':'成长篇章';
    hero.append(h('span','arena-eyebrow','LEGACY / CAREER RECORD'),h('h3','',C.hans(life.name)||'我的生涯'),h('p','',`${stage} · ${life.age} 岁${b.nick?' · '+C.hans(b.nick):''}`));
    const stats=h('div','arena-legacy-grid');stats.append(metric('已归档赛季',data.seasons),metric('实际出场',fmt(data.played)),metric('荣誉记录',data.awards),metric('冠军类荣誉',data.titles));hero.append(stats);card.append(hero);
    if(data.seasons){const means=h('div','arena-legacy-averages');means.append(metric('场均得分',data.ppg),metric('场均篮板',data.rpg),metric('场均助攻',data.apg));card.append(h('p','arena-muted','已归档赛季加权场均（不含尚未归档的比赛，保留原赛季舍入）'),means);}
    else card.append(h('p','arena-muted','尚无已归档赛季，完成赛季后自动生成生涯数据。'));
    return card;
  }
  function honors(life){
    const a=list(life.ball?.awards),data=aggregate([],a),box=h('section','arena-honors-cover');
    box.append(h('span','arena-eyebrow','HALL OF HONOR'),h('h3','','荣誉陈列室'));
    const stats=h('div','arena-legacy-grid');stats.append(metric('全部荣誉',data.awards),metric('冠军类荣誉',data.titles));box.append(stats);
    if(a.length){const latest=a.slice().sort((a,b)=>(b.year||0)-(a.year||0))[0];box.append(h('p','arena-honors-latest','最新记录 · '+(latest.year||'')+' · '+(C.hans(latest.text)||'荣誉')));}
    if(life.flags?.soldTrophies!==undefined)box.append(h('p','arena-muted','实体奖杯已出售；历史荣誉记录仍保留。'));
    return box;
  }
  function seasons(life){
    const root=h('section','arena-season-archive');const items=list(life.ball?.seasons).slice().sort((a,b)=>(b.year||0)-(a.year||0));
    root.append(h('h3','arena-block-title','已归档赛季'),h('p','arena-muted',`${items.length} 个赛季 · 按年份倒序`));
    if(!items.length){root.append(h('p','mbl-group-empty','完成职业赛季后，这里将保存每年的球队和表现。'));return root;}
    for(const s of items){
      const card=h('article','arena-season-card');const top=h('div','arena-season-top');
      const year=valid(s.year)?`${s.year}–${String(s.year+1).slice(-2)}`:'年份未记录';
      const title=h('div');title.append(h('span','arena-eyebrow',year),h('h4','',C.hans(s.team)||'球队未记录'),h('p','arena-muted',C.hans(s.league)||'联赛未记录'));
      top.append(title);if(s.champion)top.append(h('span','arena-champion-tag',s.titles>1?`${s.titles} 座冠军`:'冠军'));
      const grid=h('div','arena-season-stats');grid.append(metric('出场',fmt(s.games)),metric('得分',valid(s.ppg)?s.ppg.toFixed(1):'—'),metric('篮板',valid(s.rpg)?s.rpg.toFixed(1):'—'),metric('助攻',valid(s.apg)?s.apg.toFixed(1):'—'));
      card.append(top,grid);
      if(valid(s.w)&&valid(s.l))card.append(h('p','arena-season-record',`球队战绩 ${s.w} 胜 ${s.l} 负`));
      root.append(card);
    }
    const jump=h('button','arena-archive-jump','查看逐场历史战报 ↗');jump.type='button';jump.onclick=()=>{window.MBLNavDock?.open('team');window.MBLNavDock?.getView('team')?.querySelector('[data-arena-tab="history"]')?.click();};root.append(jump);return root;
  }
  function entries(log,mode,age){return list(log).filter(e=>e&&((mode==='all')||e.kind==='milestone'||!!e.hl)&&(age===''||String(e.age)===String(age))).slice().reverse();}
  function timeline(life){
    const root=h('section','arena-timeline');root.append(h('h3','arena-block-title','人生时间轴'));
    const state=filters.get(life)||{mode:'milestones',age:'',limit:12};filters.set(life,state);
    const toolbar=h('div','arena-timeline-tools'),modes=h('div','arena-timeline-modes'),select=h('select','arena-timeline-select');select.setAttribute('aria-label','按年龄筛选');
    const all=h('option','','所有年龄');all.value='';select.append(all);
    for(const age of [...new Set(list(life.log).map(e=>e?.age).filter(valid))].sort((a,b)=>b-a)){const opt=h('option','',age+' 岁');opt.value=String(age);select.append(opt);}select.value=state.age;
    const buttons=[];const rows=h('div','arena-timeline-rows');const more=h('button','arena-archive-jump','查看更多');more.type='button';
    function render(){
      const filtered=entries(life.log,state.mode,state.age);rows.replaceChildren();
      for(const event of filtered.slice(0,state.limit)){
        const card=h('article','arena-timeline-event');card.append(h('span','arena-timeline-age',valid(event.age)?event.age+' 岁':'—'));
        const copy=h('div','arena-timeline-copy');if(event.kind==='milestone'||event.hl)copy.append(h('small','arena-eyebrow','重要时刻'));
        const p=h('p');if(typeof Sa==='function')p.innerHTML=Sa(event.text,event.params,life);else p.textContent=C.hans(event.text)||'';copy.append(p);card.append(copy);rows.append(card);
      }
      if(!filtered.length)rows.append(h('p','mbl-group-empty','没有符合筛选条件的人生记录。'));
      more.hidden=filtered.length<=state.limit;for(const [mode,button] of buttons)button.setAttribute('aria-pressed',String(state.mode===mode));
    }
    for(const [mode,label] of [['milestones','重要时刻'],['all','全部记录']]){const button=h('button','arena-timeline-filter',label);button.type='button';button.onclick=()=>{state.mode=mode;state.limit=12;render();};modes.append(button);buttons.push([mode,button]);}
    select.onchange=()=>{state.age=select.value;state.limit=12;render();};more.onclick=()=>{const pos=window.MBLInteraction?.position();state.limit+=12;render();window.MBLInteraction?.restore(pos);};toolbar.append(modes,select);root.append(toolbar,rows,more);render();return root;
  }
  window.MBLArenaLegacy={aggregate,entries,overview,honors,seasons,timeline};
})();
