(function(){
  'use strict';
  const P=window.MBLPathway,C=window.MBLCore,h=C.h;
  const dialog=h('dialog','mbl-sched-modal');dialog.setAttribute('aria-label','我的发展路线');document.body.append(dialog);
  let owner,showAll=false;
  function button(box,label,act){
    const b=h('button','mbl-rel-btn',label);b.type='button';b.onclick=()=>{if(b.isConnected)act();};box.append(b);return b;
  }
  function evidence(l,a,ref){
    const [year,league,team,cup]=JSON.parse(a.room),cur=l.ball.season;
    if(P.key(cur)===a.room)return cur.games[ref.n-1];
    const archives=(l.ball.seasons||[]).filter(s=>s.year===year&&s.team?.en===team&&(!s.leagueId||s.leagueId===league)&&(s.cup??null)===cup);
    const g=archives.length===1&&archives[0].gameLog?.[ref.n-1];return g&&g.us===ref.us&&g.them===ref.them?g:null;
  }
  function verdict(a){return a.retry&&a.outcome==='达标'?'调整后完成':a.outcome;}
  function describe(a){return '有效出场 '+a.played+'/'+a.needed+' · '+P.unit(a.route,a.band)+' '+a.total+'/'+a.target+' · 有贡献 '+a.hits+'/'+a.positive+' 场';}
  function render(message=''){
    const l=owner;if(C.life()!==l){dialog.close();return;}
    const top=dialog.scrollTop,m=P.read(l),s=P.season(l),a=m?.active,r=P.routes;
    dialog.replaceChildren();const head=h('div','mbl-sched-head');head.append(h('h2','','我的发展路线'));button(head,'关闭',()=>dialog.close());dialog.append(head);
    if(message){const el=h('p','arena-muted',message);el.setAttribute('role','status');dialog.append(el);}
    function change(box,label,fn){
      const serial=m?.serial,active=m?.active,review=m?.review,ticket=m?.ticket;
      button(box,label,()=>render(P.commit(l,()=>{
        const now=P.read(l);
        return now?.serial===serial&&now?.active===active&&now?.review===review&&now?.ticket===ticket&&fn();
      })));
    }
    const summary=h('section','mbl-rel-card');dialog.append(summary);
    summary.append(h('h3','',m?.direction?r[m.direction].name:'选择你的发展方向'));
    if(m?.firstTraining)summary.append(h('p','','第一次专项训练 · '+m.firstTraining.age+' 岁 · '+r[m.firstTraining.route].name));
    for(const [entry,label] of [[m?.firstPro,m?.firstPro?.atEnrollment?'报名时效力':'获得职业合同'],[m?.firstAppearance,'报名后首次正式出场']])if(entry)summary.append(h('p','',entry.age+' 岁 · '+label+' · '+C.hans(entry.team)));
    for(const id of Object.keys(m?.wins||{}))summary.append(h('p','',r[id].name+' · 达标赛季 '+m.wins[id].join('、')+(m.wins[id].length>=2?' · 已建立专长':'')));
    if(a){summary.append(h('p','',describe(a)),h('p','arena-muted','球队已赛 '+(a.last-a.start)+'/'+(a.needed*2)+' 场 · 报名时为'+['短轮换','常规轮换','主力'][a.band]));change(summary,'结束这次考察',()=>P.abandon(l));}
    const last=m?.history.at(-1);
    if(last&&m.review){summary.append(h('h4','','考察复盘 · '+verdict(last)),h('p','',describe(last)));
      if(last.outcome==='机会不足')summary.append(h('p','','这段时间能观察到的表现有限。等出场机会稳定后再谈，或另选分工。'));
      if(P.quote(l,last.route,true))change(summary,'参加四次出场补考',()=>P.start(l,last.route,true));
      change(summary,'收进足迹',()=>{if(!m.review)return false;m.review=false;return true;});
    }
    if(m?.ticket&&s&&P.key(s)===m.ticket.room){
      const v=MBLTeamRoom.view(l),blocked=v&&MBLTeamRoom.canAct(l,s,v,'coach');
      if(v){summary.append(h('p','',r[m.ticket.route].name+'履历 · 可争取四次出场试用'));
        if(blocked)summary.append(h('small','',blocked));else change(summary,'凭履历向教练申请试用',()=>P.redeem(l));}
    }
    if(m?.observation){
      const o=m.observation;summary.append(h('p','',o.age+' 岁 · '+({solo:'个人观摩',family:'与家人一起看球',school:'观察校队练习'})[o.kind]+(o.done?' · 已完成':' · '+(o.age+1)+' 岁时回顾方向')));
      if(m.observationDue)change(summary,'完成方向回顾',()=>{m.observationDue=false;return true;});
    }
    const offer=(l.pending||[]).find(item=>typeof item.params?.offers==='string');
    if(offer){
      let list;try{list=JSON.parse(offer.params.offers);}catch(_){list=[];}
      if(Array.isArray(list)&&list.length){summary.append(h('h4','','当前实际报价'));
        list.forEach((o,i)=>{const money=offer.params['pay'+i]?.m;
          summary.append(h('p','',[C.hans(o.team),C.hans(o.league),o.seasons?o.seasons+' 年':'期限待定',Number.isFinite(money)?Zt(money,l):'薪酬见合同','角色待球队评估'].filter(Boolean).join(' · ')));});
        button(summary,'返回生涯查看合同',()=>dialog.close());}
    }
    if(P.eligible(l)){
      if(!s){const family=l.mother?.alive||l.father?.alive;
        summary.append(h('p','arena-muted',l.ball.pro?'球队公布赛程后可开始考察。':l.inSchool?'校内练习随时可选。参加试训或选秀时，可比较现有机会。':'等待实际试训或报价期间，可以继续个人练习。'),
        h('p','arena-muted',l.quintile<=2?'优先考虑免费练习。'+(family?'家人陪练也可以从家庭日程安排。':'可以从个人基本功开始。'):l.gift==='study'?'球商训练能发挥你的学习优势。':'点开训练预览，看看哪一项最值得投入。'));}
      if(!s&&m?.observation?.age!==l.age&&!m?.observationDue){
        const options=l.inSchool?[['school','先观察校队练习'],['solo','个人观摩比赛']]:[['solo','个人观摩比赛']];
        if(l.mother?.alive||l.father?.alive)options.push(['family','和家人一起看球']);
        if(l.quintile<=2)options.reverse();
        for(const [kind,title] of options)change(summary,title+' · 免费',()=>P.observe(l,kind));
      }
      button(summary,'查看训练与代价',()=>window.MBLBadgePanel.open());
      if(!a){
        const opts=P.choices(l);
        if(!opts.ids.length){summary.append(h('p','','本联赛目前只记录球队结果。可追踪下一次有记录的正式出场或签约。'));
          if(m?.enrolledRoom===undefined)change(summary,'追踪下一次机会',()=>P.enroll(l));}
        const ids=showAll?opts.ids:[...new Set([opts.current,opts.growth].filter(Boolean))];
        if(s&&s.phase==='regular'&&(l.ball.out>0||s.total-s.games.length<8))summary.append(h('p','','可先选方向。复出且赛程还剩至少八场时再确认考察。'));
        for(const id of ids){
          const card=h('section','mbl-rel-card'),q=P.quote(l,id),route=r[id];
          card.append(h('h4','',route.name),h('p','arena-muted',id===opts.current?'当前强项 · 两项平均 '+opts.avg(id,false):id===opts.growth?'培养空间 · 平均潜力余量 '+opts.avg(id,true):'可跨位置选择'),h('p','',route.trade));
          if(q){card.append(h('p','','接下来 '+q.needed+' 次有效出场，累计'+P.unit(id,q.band)+' '+q.target+' 次，至少 '+q.positive+' 场有贡献。'));
            change(card,'接受'+route.name+'考察',()=>JSON.stringify(P.quote(l,id))===JSON.stringify(q)&&P.start(l,id));}
          else if(m?.direction!==id)change(card,'选择'+route.name,()=>P.choose(l,id));
          dialog.append(card);
        }
        if(opts.ids.length>2)button(dialog,showAll?'只看推荐':'查看全部方向',()=>{showAll=!showAll;render();});
      }
    }
    if(m?.history.length){const list=h('details','mbl-rel-card');list.append(h('summary','','路线足迹 · '+m.history.length+' 章'));
      for(const entry of m.history.slice().reverse()){const row=h('section','mbl-rel-card');
        row.append(h('b','',entry.year+' · '+r[entry.route].name+' · '+verdict(entry)),h('p','',describe(entry)));
        for(const ref of entry.refs){const g=evidence(l,entry,ref),label='第 '+ref.n+' 场 · '+ref.us+'–'+ref.them+' · '+P.unit(entry.route,entry.band)+' '+ref.value;
          if(g)button(row,label,()=>MBLGameHistory.openDetail(g,{year:entry.year,team:{en:JSON.parse(entry.room)[2]}}));
          else row.append(h('small','',label+'（存档摘要）'));}
        list.append(row);
      }dialog.append(list);}
    dialog.scrollTop=top;
  }
  function open(l=C.life()){if(!l)return;if(owner!==l){owner=l;showAll=false;}render();if(!dialog.open)dialog.showModal();}
  function entry(l){
    if(!P.eligible(l)&&!P.read(l))return null;
    const box=h('div','mbl-room-summary'),a=P.read(l)?.active;
    button(box,a?P.routes[a.route].name+' · '+describe(a):(P.read(l)?.review||P.read(l)?.observationDue)?'查看路线复盘':'我的发展路线',()=>open(l));return box;
  }
  window.MBLPathwayPanel={open,entry};
  C.onDom(()=>{const l=C.life();if(!l)return;if(P.sync(l))window.Nt?.saveLife(l);if(dialog.open&&owner!==l)dialog.close();},'play');
})();
