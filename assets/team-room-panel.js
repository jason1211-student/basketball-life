(function(){
  'use strict';
  const C=window.MBLCore,h=C.h,T=window.MBLTeamRoom;
  const selection=new WeakMap();
  function render(l,root,selected,status=''){
    const v=T.view(l);
    if(!v){root.replaceChildren(h('p','arena-muted','新球队公布名单后开放。'));return;}
    const s=l.ball.season,room=v.room;
    if(selected===undefined && selection.get(l)?.team===s.team.en)selected=selection.get(l).key;
    const wrap=h('div','mbl-room'),hero=h('section','card mbl-room-hero');
    hero.append(h('small','',C.hans(s.team)+' · '+s.year+' 赛季'),h('h3','',v.roleName),
      h('p','','预计 '+v.planned+' 分钟 / 场　·　轮换评估第 '+v.rank+' 位'),
      h('p','','更衣室地位 · '+v.leadership+'　｜　球队领袖 · '+v.leader));
    if(v.rival)hero.append(h('p','arena-muted','同位置竞争 · '+C.hans(v.rival.name)+'（总评 '+v.rival.ovr+'），你的总评 '+v.ovr+'。'));
    const requests=['先站稳第二阵容，争取稳定出场。','守住轮换时间，带动替补阵容。','替补席由你率先改变比赛节奏。','在首发阵容执行攻防安排。','承担主要球权，带动全队进攻。'];
    hero.append(h('p','',requests[v.role]));
    wrap.append(hero);
    function action(card,kind,caption,peerId,practice){
      const blocked=T.canAct(l,s,v,kind),btn=h('button','mbl-room-action',blocked||caption);
      btn.type='button';btn.disabled=!!blocked;btn.dataset.roomAction=kind;
      btn.onclick=()=>{
        const message=T.commit(l,kind,v.token,peerId,practice);
        window.MBLInteraction.preserveScroll(root,()=>render(l,root,peerId||selected,message));
        // Overview also contains a shortcut with the current minute allocation.
        const shortcut=root.parentElement?.querySelector('.mbl-room-summary strong'), latest=T.view(l);
        if(shortcut&&latest)shortcut.textContent=latest.roleName+' · '+latest.planned+' 分钟';
      };
      card.append(btn);
    }
    if(room.promise){
      const p=room.promise,box=h('section','card mbl-room-promise');
      box.append(h('h4','',p.kind==='coach'?'教练的轮换考察':'和老板的约定'),
        h('p','',p.goal+' · 目标 2 次，已达标 '+p.met+' 次'),
        h('p','arena-muted',(p.kind==='coach'?'已出场 ':'球队已赛 ')+p.seen+' / 4 场'));
      wrap.append(box);
    }
    const stories=l.flags?.mblCareerStories;
    if(stories?.history.length){
      const card=h('section','card mbl-room-log'), f=stories.follow;
      card.append(h('h4','','更衣室谈话'));
      if(f && f.room===room.key)card.append(h('p','',f.actor+'在等你的表现 · '+f.target+'，需 '+f.needed+' 场达标（第 '+(f.start+1)+' 至 '+(f.start+3)+' 场）'));
      for(const entry of stories.history.slice(0,3))card.append(h('p','arena-muted',entry));
      wrap.append(card);
    }
    const people=h('div','mbl-room-people');
    function staff(label,name,trait,score,goal,kind,caption){
      const card=h('section','card mbl-room-person');
      card.append(h('small','',label+' · '+trait),h('h4','',C.hans(name)),h('b','',score),
        h('p','',goal));
      action(card,kind,caption);people.append(card);
    }
    staff('主教练',v.coachName,T.coachTraits[v.coachTrait],'信任 '+v.trust+' / 100',
      '未来四次出场，至少两次做到“'+T.target('coach',v.coachTrait,v.role)+'”。考察期预计多打 3 分钟。','coach','争取四场试用');
    staff('球队老板',room.ownerName,T.ownerTraits[v.ownerTrait],'支持 '+room.owner+' / 100',
      '未来四场球队比赛，至少两场做到“'+T.target('owner',v.ownerTrait,v.role)+'”。履约影响续约支持。','owner','承诺四场目标');
    wrap.append(people);
    if(v.peers.length){
      const card=h('section','card mbl-room-person'), label=h('label','','队友'),select=h('select','');
      select.setAttribute('aria-label','选择队友');
      for(const p of v.peers){
        const opt=h('option','',C.hans(p.name));opt.value=p.key;select.append(opt);
      }
      const peer=v.peers.find(p=>p.key===selected)||v.peers[0];select.value=peer.key;selection.set(l,{team:s.team.en,key:peer.key});
      select.onchange=()=>window.MBLInteraction.preserveScroll(root,()=>render(l,root,select.value));
      label.append(select);card.append(label,h('b','','默契 '+peer.affinity+' / 100'),
        h('p','',T.peerTraits[peer.trait]+'。一起看录像能增进默契，每三场有一次合练机会。'));
      action(card,'peer','一起复盘挡拆',peer.key,'film');
      if(!T.canAct(l,s,v,'peer'))action(card,'peer','加练传切配合',peer.key,'drill');
      wrap.append(card);
    }
    if(room.notes.length){
      const log=h('section','card mbl-room-log');
      log.append(h('h4','','更衣室近况'));
      room.notes.forEach(note=>log.append(h('p','',note)));wrap.append(log);
    }
    if(status){const msg=h('p','',status);msg.setAttribute('role','status');wrap.prepend(msg);}
    root.replaceChildren(wrap);
  }
  window.MBLTeamRoomPanel={render};
})();
