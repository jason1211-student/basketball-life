/* Read-only wealth presentation. All actual transactions remain in game.js. */
(function(){
  'use strict';
  const C=window.MBLCore,h=C.h;
  const amount=v=>Number.isFinite(v)?v:0;
  function queueInfo(options){const list=(options||[]).filter(x=>x.queued&&!x.byParents&&!x.done);return {count:list.length,total:list.reduce((n,x)=>n+amount(x.cost),0),parents:(options||[]).filter(x=>x.queued&&x.byParents&&!x.done).length};}
  function budgetInfo(budget){const entries=obj=>Object.values(obj||{}).filter(Number.isFinite);const inc=entries(budget?.inc),out=entries(budget?.out);return {hasData:!!(inc.length||out.length),income:inc.reduce((n,x)=>n+x,0),expense:out.reduce((n,x)=>n+x,0),net:inc.reduce((n,x)=>n+x,0)-out.reduce((n,x)=>n+x,0)};}
  function read(life){
    const m=life.money||{},options=typeof N8==='function'?N8(life):[],queue=queueInfo(options);
    const cash=amount(m.cash),available=typeof c0==='function'?amount(c0(life)):cash;
    return {cash,available,netWorth:typeof ui==='function'?amount(ui(m)):cash,queue,remaining:available-queue.total,debt:amount(m.debt),paid:m.spentYear?.age===life.age?amount(m.spentYear.total):0,travel:amount(window.MBLRelationsMessages?.plannedTravel(life)),deposit:amount(life.flags?.mblMessages?.lease?.deposit),budget:budgetInfo(typeof que==='function'?que(life):m.budget)};
  }
  function money(v,l){return typeof Zt==='function'?Zt(v,l):String(Math.round(v));}
  function metric(label,value,cls){const n=h('div','arena-fin-metric'+(cls?' '+cls:''));n.append(h('span','',label),h('b','',value));return n;}
  function action(label,act){const b=h('button','arena-fin-action',label);b.type='button';b.dataset.act=act;return b;}
  function panel(l,info,kind){
    const box=h('section','arena-finance-hero '+kind);
    box.append(h('span','arena-eyebrow',kind==='spend'?'SPENDING / PLAN':'WEALTH / PORTFOLIO'),h('h3','',kind==='spend'?'消费与支付':'私人财富管理'));
    if(kind==='money'){
      const balance=h('div','arena-fin-balance');balance.append(h('small','','净资产'),h('strong','',money(info.netWorth,l)));box.append(balance);
    }
    const grid=h('div','arena-fin-metrics');
    grid.append(metric('现金余额',money(info.cash,l)),metric('含投资可用资金',money(info.available,l)),metric('计划消费',money(info.queue.total,l)),metric('扣除计划后可用',money(info.remaining,l),info.remaining<0?'is-negative':''));box.append(grid);
    if(kind==='money')box.append(action('进入消费中心 ↗','spendopen'));
    else if(window.de?.moneyOpen)box.append(action('‹ 返回财富总览','spendclose'));
    const notes=h('div','arena-fin-notes');
    if(info.paid)notes.append(h('p','',`本年已付自主消费 · ${money(info.paid,l)}`));
    if(info.travel)notes.append(h('p','',`尚未支付的私人行程 · ${money(info.travel,l)}`));
    if(info.deposit)notes.append(h('p','',`暂扣可退住房押金 · ${money(info.deposit,l)}`));
    if(info.queue.parents)notes.append(h('p','',`${info.queue.parents} 项由家长安排，不计入个人现金账单`));
    if(info.debt&&kind==='money')notes.append(h('p','',`未偿债务 · ${money(info.debt,l)}`));
    if(notes.children.length)box.append(notes);return box;
  }
  function bookSummary(l,info){
    const box=h('section','arena-fin-book');box.append(h('h3','','最近一期已记录账单'));
    if(!info.budget.hasData){box.append(h('p','arena-muted','暂无已记录收支，随着生涯推进将自动显示。'));return box;}
    const grid=h('div','arena-fin-book-grid');grid.append(metric('收入',money(info.budget.income,l)),metric('支出',money(info.budget.expense,l)),metric('净收支',money(info.budget.net,l),info.budget.net<0?'is-negative':''));box.append(grid);return box;
  }
  function mount(){
    const life=C.life();if(!life||!life.money)return;
    for(const [sel,kind] of [['.modal.moneysheet','money'],['.modal.spend','spend']]){
      const modal=document.querySelector(sel);if(!modal)continue;
      const info=read(life),tab=window.de?.moneyTab||'home';
      const sig=JSON.stringify([info,kind,tab,window.MBLCurrency?.label?.()]);
      const previous=modal.querySelector('.arena-finance-hero');if(previous?.dataset.sig===sig)continue;
      const hero=panel(life,info,kind);hero.dataset.sig=sig;
      if(previous)previous.replaceWith(hero);else (modal.querySelector(kind==='money'?'.plantabs':'.modal-top')||modal.querySelector('.modal-top'))?.after(hero);
      modal.querySelector('.arena-fin-book')?.remove();
      if(kind==='money'&&tab==='books')hero.after(bookSummary(life,info));
    }
  }
  C.onDom(mount,'play');window.addEventListener('mbl:currency-changed',mount);
  window.MBLArenaFinance={queueInfo,budgetInfo,read,mount};mount();
})();
