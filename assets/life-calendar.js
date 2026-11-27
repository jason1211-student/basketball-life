/* Commitments shared by both career calendars. All monetary amounts use core save units. */
(function(){
  'use strict';
  const C=window.MBLCore,h=C.h;
  const model=l=>l.flags.mblLifeCalendar;
  function state(l){return l.flags.mblLifeCalendar ||= {serial:0,items:[],history:[],last:{},projects:{}};}
  function season(l){
    const s=l.ball.season;
    return l.ball.pro && !l.ball.retiredFromPlaying && s && !s.staff && s.phase==='regular' && s.team?.en===l.ball.pro.team?.en ? s:null;
  }
  const teamKey=s=>s?JSON.stringify([s.year,s.leagueId,s.team.en,s.cup??null]):'';
  const name=p=>C.hans(p.name);
  function relatives(l){return window.S_(l).filter(({p})=>p.alive);}
  function personId(p,kin){return JSON.stringify([kin,p.name.en||name(p),p.born??null]);}
  function cashForSaving(l){return Math.max(0,Math.min(l.money.cash,window.appointmentTravelFunds(l)));}
  function options(l){
    if(!l.alive||l.prisonYears||l.age<6)return [];
    const s=season(l), out=[];
    for(const {p,kin} of relatives(l)){
      if(!['mother','father','child','partner'].includes(kin))continue;
      const person=personId(p,kin),partner=kin==='partner',stage=model(l)?.projects?.[person]||0;
      const titles=['留出不被训练打断的工作时间','陪伴侣准备项目交付','一起商量下一段工作安排'];
      out.push({key:'family'+person,person,kind:'family',title:partner?titles[stage%3]:kin==='child'?'陪'+name(p)+'做一件自己挑的事':'和'+name(p)+'留一段相处时间',who:name(p),partner,
        note:partner?'给对方的工作留出时间。完成后，下一次可继续商量项目进度。':'到约定时间赴约会增加亲密度。',gap:2});
    }
    if(l.age>=18&&l.money?.holdings){
      const amount=Math.floor(cashForSaving(l)*.1);
      if(amount>0)out.push({key:'savings',kind:'savings',title:'留出一笔生活备用金',amount,gap:2,note:'从可用现金转 '+window.Zt(amount,l)+' 到储蓄。到期由你确认。'});
    }
    if(s && l.age>=18){
      if(s.leagueId==='NBA' && l.ball.out>0 && model(l)?.returnPlan?.room!==teamKey(s))out.push({key:'recovery',kind:'recovery',title:'约队医复查并安排渐进复出',gap:Math.max(1,Math.min(l.ball.out,3)),note:'缺阵期照常计算。复查后，接下来两次 NBA 常规赛出场的计划时间上限为 18 分钟。'});
      if(s.leagueId==='NBA')out.push({key:'agent',kind:'agent',title:'与经纪人准备本队续约谈判',gap:4,note:'一起整理本季出场记录。完成后，本季与当前球队续约的机会小幅提高。'});
      if(s.leagueId==='NBA')out.push({key:'market',kind:'agent',title:'请经纪人接洽其他球队',gap:4,note:'与准备留队互斥。本季谈合同时，经纪人会多接洽一个潜在去向，是否收到报价取决于市场。'});
    }
    return out;
  }
  function clock(l){const s=season(l);return {age:l.age,room:teamKey(s),game:s?.games.length||0};}
  function status(l,a){
    if(!l.alive || a.person&&!relatives(l).some(({p,kin})=>personId(p,kin)===a.person))return '失效';
    const t=clock(l);
    if(a.room && a.room!==t.room)return '失效';
    if(!a.room && l.age>a.dueAge)return '失效';
    return (a.room?t.game>=a.dueGame:l.age>=a.dueAge)?'待处理':'已安排';
  }
  function deadline(a){return a.room?'常规赛第 '+a.dueGame+' 场赛后':a.dueAge+' 岁时';}
  function available(l,o){
    const m=model(l),t=clock(l);
    if(m?.items.some(a=>a.key===o.key&&status(l,a)!=='失效'))return false;
    if(o.kind==='agent'&&(m?.agent===t.room||m?.items.some(a=>a.kind==='agent' && status(l,a)!=='失效')))return false;
    const last=m?.last[o.key],s=season(l);
    return (!s||s.total-t.game>=o.gap)&&(!last|| (t.room ? last.room!==t.room||t.game-last.game>=6 : last.age!==t.age));
  }
  function note(l,title,detail){
    const m=state(l);
    m.history.unshift({age:l.age,game:clock(l).game,title,detail});
    m.history.length=Math.min(m.history.length,24);
  }
  function reconcile(l){
    const m=model(l);
    if(!m)return false;
    const stale=m.items.filter(a=>status(l,a)==='失效');
    for(const a of stale)note(l,a.title,'人员或赛程已变更，约定结束。');
    if(stale.length)m.items=m.items.filter(a=>!stale.includes(a));
    return !!stale.length;
  }
  function transact(l,action){
    if(C.life()!==l||!l.alive)return '存档已切换。';
    const prev=JSON.stringify(model(l)||null),money=JSON.stringify(l.money),bonds=relatives(l).map(({p})=>[p,p.bond]);
    try{
      const reason=action();if(reason)return reason;
      window.Nt.saveLife(l);
      if(window.MBLAutoSave&&!window.MBLAutoSave.save())throw Error('write');
      return '';
    }catch(_){
      if(prev==='null')delete l.flags.mblLifeCalendar;else l.flags.mblLifeCalendar=JSON.parse(prev);
      l.money=JSON.parse(money);
      for(const [p,v] of bonds){if(v===undefined)delete p.bond;else p.bond=v;}
      try{window.Nt.saveLife(l);}catch(_){}
      return '保存失败，这次操作已撤回。';
    }
  }
  function book(l,key,expectedAmount){
    const o=options(l).find(o=>o.key===key);
    if(!o||!available(l,o)||expectedAmount!==undefined&&expectedAmount!==o.amount)return '安排已变化，请重新选择。';
    reconcile(l);
    const m=state(l),t=clock(l);
    m.items.push({...o,id:'life-'+(++m.serial),room:t.room,dueGame:t.game+o.gap,dueAge:t.age+1});
    m.last[o.key]=t;return '';
  }
  function resolve(l,id,cancel){
    const m=model(l),a=m?.items.find(a=>a.id===id);
    if(!a||(!cancel&&status(l,a)!=='待处理'))return '请重新查看约定时间。';
    let detail='已取消，未产生费用。';
    if(!cancel){
      if(a.kind==='family'){
        const {p}=relatives(l).find(({p,kin})=>personId(p,kin)===a.person);
        const before=window.Cn(p);window.Ie(l,p,3);
        if(a.partner)m.projects[a.person]=(m.projects[a.person]||0)+1;
        detail=a.who+'记得这次赴约。亲密度 +'+Math.round(window.Cn(p)-before)+(a.partner?'，已共同完成 '+m.projects[a.person]+' 次工作安排。':'。');
      }else if(a.kind==='savings'){
        if(cashForSaving(l)<a.amount)return '现金不足，可稍后处理或取消。';
        l.money.cash-=a.amount;l.money.holdings.savings+=a.amount;
        detail='现金转入储蓄 '+window.Zt(a.amount,l)+'，资产总额不变。';
      }else if(a.kind==='agent'){
        m.agent=a.room;m.strategy=a.key;detail=a.key==='market'?'经纪人已整理对外资料，本季谈判会多接洽一个潜在去向。':'经纪人已整理本季材料，本队续约概率增加最多 4 个百分点。';
      }else{
        m.returnPlan={room:a.room,left:2};detail='已完成复查，接下来两次出场采用渐进轮换。';
      }
    }
    note(l,a.title,detail);m.items=m.items.filter(item=>item.id!==id);m.last[a.key]=clock(l);return '';
  }
  function afterGame(l,s,g){
    const r=model(l)?.returnPlan;
    if(!r||g!==s.games.at(-1)||r.room!==teamKey(s)||!(g.min>0)||r.last===s.games.length)return;
    r.last=s.games.length;
    if(--r.left<=0){delete model(l).returnPlan;note(l,'渐进复出完成','已完成两次出场，恢复常规轮换评估。');}
  }
  function notifications(l){return (model(l)?.items||[]).filter(a=>status(l,a)!=='失效').map(a=>({id:a.id,name:a.title,kind:'生活安排',deadline:deadline(a),due:status(l,a)==='待处理'}));}
  const expanded=new WeakSet();
  function render(l,refresh){
    const m=model(l),items=(m?.items||[]).filter(a=>status(l,a)!=='失效');
    if(!l.alive||l.age<6)return null;
    const box=h('section','card mbl-room-person'),heading=h('h3','','生活日程');box.append(heading);
    function button(parent,label,fn){
      const b=h('button','mbl-rel-btn',label);b.type='button';
      b.onclick=()=>{if(!b.isConnected)return;const msg=transact(l,fn);
        if(msg){let el=box.querySelector('[role=status]');if(!el){el=h('p','arena-muted');el.setAttribute('role','status');box.append(el);}el.textContent=msg;return;}
        refresh();window.MBLAlerts?.refresh?.();};parent.append(b);
    }
    for(const a of items){
      const row=h('section','mbl-rel-card');row.dataset.lifePlan=a.id;
      row.append(h('b','',a.title),h('p','arena-muted',deadline(a)+' · '+status(l,a)));
      if(status(l,a)==='待处理')button(row,'完成约定',()=>resolve(l,a.id,false));
      button(row,'取消约定',()=>resolve(l,a.id,true));box.append(row);
    }
    const details=h('details','');details.open=expanded.has(l);details.ontoggle=()=>{if(!details.isConnected)return;if(details.open)expanded.add(l);else expanded.delete(l);};
    details.append(h('summary','','安排生活与职业事项'));
    const opts=options(l).filter(o=>available(l,o));
    for(const o of opts){const row=h('div','mbl-rel-card');row.append(h('p','arena-muted',o.note));button(row,o.title,()=>book(l,o.key,o.amount));details.append(row);}
    if(!opts.length)details.append(h('p','arena-muted','当前没有可新增的安排。'));
    box.append(details);
    if(m?.returnPlan?.room===teamKey(season(l)))box.append(h('p','arena-muted','复出限时 · 还剩 '+m.returnPlan.left+' 次出场'));
    if(m?.history.length){const last=m.history[0];box.append(h('p','arena-muted',last.title+' · '+last.detail));}
    return box;
  }
  window.MBLLifeCalendar={render,book,resolve,transact,afterGame,reconcile,notifications,deadline,status,options,available,teamKey,
    pauseDue(l){return !!(window.__mblPausePath && (l.flags?.mblPathway?.review||l.flags?.mblPathway?.observationDue)) || !!(window.__mblPauseLifePlan && model(l)?.items.some(a=>status(l,a)==='待处理'));},
    cap(l,s){const p=model(l)?.returnPlan;return p?.room===teamKey(s)&&p.left>0?18:Infinity;},
    strategy(l){const s=l.ball.season;return s&&l.ball.pro?.team?.en===s.team?.en&&model(l)?.agent===teamKey(s)?model(l).strategy:null;},
    negotiation(l){return this.strategy(l)==='agent'?.04:0;},note};
})();
