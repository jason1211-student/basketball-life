/* Planned-purchase settlement. Preserve parent-funded and unsuccessful entries. */
(function(){
  'use strict';
  if(window.MBLBillPanel)return;
  const C=window.MBLCore,h=C.h,locked=new WeakSet(),status=new WeakMap();
  function money(v,life){return typeof Zt==='function'?Zt(v,life):String(Math.round(Number(v)||0));}
  function eligible(options){return (options||[]).filter(x=>x.queued&&!x.byParents&&!x.done);}
  function fingerprint(items){return JSON.stringify(items.map(x=>[x.id,x.cost,x.slotTaken,x.affordable]));}
  function settle(life,items,options,pay){
    let paid=0,failed=0;
    for(const entry of items){
      if(!life.spendQueue?.includes(entry.id))continue;
      const current=eligible(options(life)).find(x=>x.id===entry.id);
      if(!current||current.slotTaken||!current.affordable||current.cost!==entry.cost){failed++;continue;}
      try{
        if(!pay(life,entry.id)){failed++;continue;}
        paid++;
        if(life.spendQueue){life.spendQueue=life.spendQueue.filter(id=>id!==entry.id);if(!life.spendQueue.length)delete life.spendQueue;}
      }catch(e){failed++;console.error('[bill payment]',e);break;}
    }
    return {paid,failed};
  }
  function build(){
    const modal=document.querySelector('.modal.spend'),life=C.life();
    if(!modal||!life||typeof N8!=='function'||typeof IF!=='function')return;
    const items=eligible(N8(life)),total=items.reduce((n,x)=>n+x.cost,0);
    const available=typeof c0==='function'?c0(life):Number(life.money?.cash)||0;
    const left=available-total,message=status.get(life)||'只结算已安排的个人消费；住房、贷款等固定支出仍按原规则处理。';
    const sig=JSON.stringify([fingerprint(items),available,message,locked.has(life),window.MBLCurrency?.label?.()]);
    const old=modal.querySelector('.mbl-bill');if(old?.dataset.sig===sig)return;
    const sec=h('section','mbl-bill');sec.dataset.sig=sig;
    const head=h('div','mbl-bill-head');head.append(h('b','','计划消费账单'),h('span','',items.length+' 项待结算'));sec.append(head);
    const grid=h('div','mbl-bill-rows');
    for(const [label,value] of [['含投资可用',available],['计划消费',total],['结算后可用',left]]){const r=h('div');r.append(h('span','',label),h('b',value<0?'is-neg':'',money(value,life)));grid.append(r);}sec.append(grid);
    const b=h('button','mbl-bill-pay','确认并结算计划消费');b.type='button';b.disabled=!items.length||locked.has(life)||left<0;sec.append(b,h('p','mbl-bill-msg',left<0?'可用资金不足，请先调整消费计划。':message));
    b.onclick=async function(){
      if(b.disabled||locked.has(life)||C.life()!==life)return;
      locked.add(life);b.disabled=true;
      try{
        if(!window.MBLConfirm){status.set(life,'无法打开确认窗口，请稍后重试。');return;}
        const ok=await window.MBLConfirm.open({title:'确认计划消费',message:`结算 ${items.length} 项个人消费，共 ${money(total,life)}。未成功的项目会保留，不会重复扣款。`,confirmText:'确认结算'});
        if(!ok||C.life()!==life)return;
        const current=eligible(N8(life));
        if(fingerprint(current)!==fingerprint(items)||(typeof c0==='function'&&c0(life)<total)){status.set(life,'计划或可用资金已发生变化，请重新确认。');return;}
        const result=settle(life,items,N8,IF);
        status.set(life,`已结算 ${result.paid} 项${result.failed?'，'+result.failed+' 项暂未完成':''}。未成功的项目仍保留在计划中。`);
        window.Nt?.saveLife?.(life);
        if(typeof mn==='function')mn();
      }finally{locked.delete(life);sec.dataset.sig='';build();}
    };
    if(old)old.replaceWith(sec);else{const top=modal.querySelector('.modal-top');if(top)top.after(sec);else modal.prepend(sec);}
  }
  C.onDom(build,'play');C.onHeartbeat(build,600);
  window.MBLBillPanel={refresh:build,settle,eligible,fingerprint};
})();
