/* Versioned possession simulation. The only external input during play is the match RNG. */
(function () {
  'use strict';
  const limit = (n,a,b) => n<a?a:n>b?b:n;
  const sides = ['home','away'];
  const other = side => side === 'home' ? 'away' : 'home';
  const tiers = {bronze:1,silver:2,gold:3,hof:4};
  const {max,min,round,exp}=Math;
  const labels = Object.fromEntries(MBLAttrSys.BADGES.map(b => [b.id,b.name]));
  const keys = ['ticks','pts','fgm','fga','tpm','tpa','ftm','fta','ast','ore','dre','to','pf','stl','blk','fo'];
  const empty = () => Object.fromEntries(keys.map(k => [k,0]));
  function pick(pool, weight, rng) {
    const weights = pool.map(p => max(.01,weight(p)));
    let r = rng()*weights.reduce((a,b)=>a+b,0);
    for(let i=0;i<pool.length;i++) if((r-=weights[i])<=0) return pool[i];
    return pool[pool.length-1];
  }
  function team(input,side,context) {
    if(input.players.length<5 || new Set(input.players.map(p=>p.id)).size!==input.players.length) throw Error('比赛名单不足或身份重复');
    const roster=input.players.map((player,i)=>({
      slot:i, id:player.id, side, name:player.name?.hans||player.name?.en||player.name, pos:player.pos,
      r:player.ratings, badges:player.badges||{}, usage:player.rotation?.usage||1,
      target:player.rotation?.minutes, weight:(i<5?1:.6)*Math.pow(max(35,player.ovr)/75,2),
      energy:context.energy?.[side]?.[player.id]??100, box:empty(), out:false, streak:0, reasons:[]
    }));
    for(const p of roster){
      p.handleWeight=p.usage*exp((.5*p.r.handle+.3*p.r.pass+.2*p.r.speedWithBall-75)/16)*(p.pos==='guard'?1.5:1);
      p.finishWeight=p.usage*exp((max(p.r.three,p.r.layup)-75)/24);
      p.postWeight=p.usage*exp((p.r.strength-75)/24);
      p.spacingWeight=p.usage*exp((p.r.three-75)/24);
      p.reboundStrength=p.r.rebound+.22*p.r.strength+.15*p.r.vertical+2*(tiers[p.badges.boxout]||0);
      p.reboundWeight=(p.pos==='big'?2:1)*exp((p.reboundStrength-90)/25)*(1+.09*(tiers[p.badges.reboundbeast]||0));
    }
    if(context.preparation?.side===side){const me=roster.find(p=>p.id==="me");if(me){me.handleWeight*=1+context.preparation.usage;me.finishWeight*=1+context.preparation.usage;}}
    const fixed=roster.filter(p=>p.target!=null), remaining=240-fixed.reduce((a,p)=>a+p.target,0);
    const flexible=roster.filter(p=>p.target==null), total=flexible.reduce((a,p)=>a+p.weight,0);
    for(const p of flexible)p.target=remaining*p.weight/total;
    return {roster,five:roster.slice(0,5),poss:0,fouls:0,late:0,teamTO:0,
      plan:context.plans?.[side]||{}, players:input.players, name:input.name,
      box:Object.fromEntries(roster.map(p=>[p.id,p.box]))};
  }
  function simulate(mu,record,details=true) {
    const rng=MBLMatchRecord.rng(record.seed), context=record.context||{};
    const clubs={home:team(mu.home,'home',context),away:team(mu.away,'away',context)};
    const medical=MBLMatchRecord.rng((record.seed^0x53d68129)>>>0);
    for(const s of sides)for(const p of clubs[s].roster){
      p.hazard=0;p.threshold=-Math.log(1-medical());
    }
    const year=record.year??2020;
    const modern=limit((year-2007)/11,0,1), threeRate=year<=2018?.245+.104*modern:.379;
    const events=[], quarters=[], score={home:0,away:0}, injuries=[];
    let q,clock,shot,periodLength,side,serial=0,spent=0,changes=[],badges=[], elapsed=0;
    let digest=2166136261;
    function mix(n){digest=Math.imul(digest^(n|0),16777619)>>>0;}
    let needsMedicalCheck=false;
    let offense,defense,fast=false, retained=false;
    const first=rng()<.5?'home':'away';
    function add(p,key,n=1){
      p.box[key]+=n;mix((p.side==="home"?0:512)+p.slot*20+keys.indexOf(key));mix(n);
      if(details)changes.push([p.side,p.id,key,n]);
    }
    function badge(p,id){
      const t=tiers[p.badges[id]]||0;
      if(t && details && !badges.some(b=>b.id===id&&b.playerId===p.id))
        badges.push({id,name:labels[id],playerId:p.id,by:p.name,tier:p.badges[id]});
      return t;
    }
    function emit(kind,p,text,points=0,extra={}){
      const owner=p?.side||side;
      mix(clock);mix(q);mix(serial);mix(p?.slot??-1);mix(kind.charCodeAt(0));
      score[owner]+=points;quarters[q-1][owner]+=points;
      if(points)add(p,'pts',points);
      if(details)events.push({kind,q,clock:clock/10,shotClock:shot/10,side:owner,actor:p?.name,
        actorId:p?.id,points,text,poss:serial,elapsed:spent,changes,badges,
        ...(spent?{floor:sides.map(s=>clubs[s].five.map(x=>x.id))}:{}),...extra});
      spent=0;changes=[];badges=[];
    }
    function advance(t){
      clock-=t;shot=max(0,shot-t);spent+=t;elapsed+=t;
      for(const s of sides)for(const p of clubs[s].roster){
        if(clubs[s].five.includes(p)){
          p.box.ticks+=t;
          p.hazard+=.00015*t/600*(1+max(0,65-p.energy)/65)*(1-.04*(tiers[p.badges.iron]||0));
          if(p.hazard>=p.threshold)needsMedicalCheck=true;
          const load=(s!==side&&defense==='press')||offense==='pace'?1.2:1;
          p.energy=limit(p.energy-t/600*2*load*(1-.03*(tiers[p.badges.workhorse]||0)),0,100);
        }else p.energy=min(100,p.energy+t/600*3);
      }
    }
    function rotate(s,force=false){
      const c=clubs[s], m=elapsed/600;
      const priority=p=>(min(m,48)*p.target/48+max(0,m-48)*p.target/48-p.box.ticks/600)
        +min(0,(p.energy-65)/12)-(p.box.pf>=q+1 && q<4?2:0);
      for(let i=0;i<5;i++){
        const a=c.five[i], options=c.roster.filter(p=>!p.out&&!p.box.fo&&!c.five.includes(p));
        if(!options.length)continue;
        const fit=p=>priority(p)+(a.pos===p.pos?.9:0);
        const b=options.reduce((x,y)=>fit(x)>=fit(y)?x:y);
        if(!a.out&&!a.box.fo && fit(b)<priority(a)+(force?1:2.4))continue;
        const reason=a.out?'伤退':a.box.fo?'犯满':a.energy<55?'体力':a.box.pf>=q+1&&q<4?'犯规保护':'轮换';
        a.reasons.push(reason);c.five[i]=b;
        emit('sub',b,b.name+'替换'+a.name+'（'+reason+'）',0,{outId:a.id,reason});
      }
    }
    function next(s,transition=false){
      side=s;clubs[s].poss++;serial++;retained=false;fast=transition;shot=240;
      const plan=clubs[s].plan, opp=clubs[other(s)].plan;
      offense=(plan.offense2&&rng()<.3?plan.offense2:plan.offense)||'motion';
      defense=(opp.defense2&&rng()<.3?opp.defense2:opp.defense)||'man';
    }
    function rebound(shooter){
      if(!clock)return;
      const c=clubs[side],d=clubs[other(side)];
      const strength=p=>p.reboundStrength;
      const mean=list=>list.reduce((a,p)=>a+strength(p),0)/5;
      const offensive=rng()<limit(.265-.038*modern+(mean(c.five)-mean(d.five))*.003,.1,.42);
      const p=pick(offensive?c.five:d.five,x=>x.reboundWeight,rng);
      badge(p,'reboundbeast');badge(p,'boxout');
      add(p,offensive?'ore':'dre');
      if(offensive){shot=year>=2018?140:240;retained=true;fast=false;}
      emit(offensive?'oreb':'rebound',p,p.name+(offensive?'抢到前场篮板，重新组织。':'拿下防守篮板。'));
      if(!offensive)next(other(side),rng()<.28);
    }
    function throws(p,count,technical=false){
      let made=false;
      for(let i=0;i<count;i++){
        add(p,'fta');made=rng()<limit(.79+(p.r.freeThrow-75)*.004,.35,.97);
        if(made)add(p,'ftm');
        emit('ft',p,p.name+'第'+(i+1)+'罚'+(made?'命中。':'不中。'),made?1:0);
      }
      if(technical)return;
      if(made){if(clock)next(other(side));}else rebound(p);
    }
    function foul(p,attack=false){
      const c=clubs[p.side]; add(p,'pf');
      if(!attack){c.fouls++;if(clock<=1200)c.late++;}
      if(p.box.pf>=6){
        if(c.roster.some(x=>!x.out&&!x.box.fo&&!c.five.includes(x))){if(!p.box.fo)add(p,'fo');p.disqualifiedAt=elapsed;}
        else{
          const taker=clubs[other(p.side)].five.reduce((a,b)=>a.r.freeThrow>b.r.freeThrow?a:b);
          emit('foul',p,p.name+'无合资格替补，球队追加技术犯规。');
          throws(taker,1,true);
        }
      }
    }
    function checkInjuries(){
      if(!needsMedicalCheck)return;
      needsMedicalCheck=false;
      for(const s of sides){
        const c=clubs[s];
        for(const p of c.five.slice()){
          if(p.out || p.hazard<p.threshold)continue;
          const bench=c.roster.filter(x=>!x.out&&!c.five.includes(x));
          if(!bench.length){p.threshold=Infinity;continue;}
          const severity=medical();
          const brief=severity<.25, games=severity<.65?0:1+Math.floor(medical()*5);
          p.out=true;p.returnPeriod=brief?q+1:Infinity;p.threshold=Infinity;
          injuries.push({side:s,id:p.id,games,q,clock:clock/10,brief});
          emit('injury',p,p.name+(brief?'因不适暂时离场，下节复查。':'受伤离场，本场退出。'),0,{brief});
          if(bench.some(x=>!x.box.fo))rotate(s);
          else{
            const b=bench.sort((a,b)=>b.disqualifiedAt-a.disqualifiedAt)[0];
            c.five[c.five.indexOf(p)]=b;p.reasons.push('伤退');
            emit('sub',b,b.name+'依五人例外重返球场，球队被判技术犯规。',0,{outId:p.id,reason:'五人例外'});
            const taker=clubs[other(s)].five.reduce((a,b)=>a.r.freeThrow>b.r.freeThrow?a:b);
            throws(taker,1,true);
          }
        }
      }
    }
    function play(){
      const c=clubs[side],d=clubs[other(side)];
      const handler=pick(c.five,p=>p.handleWeight,rng);
      const seconds=(retained?6:fast?7:15.15)+(rng()-.5)*(fast?6:11)+(1-modern)*.88+(offense==='post'?1:offense==='pace'?-1:0);
      const held=q>=4 && clock<=240 && score[side]>score[other(side)] && clock<=shot;
      if(held){advance(clock);emit('end',handler,handler.name+'控球至终场。');return;}
      const t=min(clock,shot,max(5,round(seconds*10)));
      const before=clock;advance(t);
      if(!clock && t<seconds*10-1 && rng()>.35){emit('end',null,'本节时间到。');return;}
      if(!shot&&clock){c.teamTO++;emit('to',null,'进攻超时，交换球权。');next(other(side));return;}
      const passed=rng()<(offense==='iso'?.34:offense==='motion'?.72:.62);
      const p=passed?pick(c.five.filter(x=>x!==handler),x=>(offense==='spacing'?x.spacingWeight:offense==='post'?x.postWeight:x.finishWeight)*(offense==='pnr'&&x.pos==='big'?1.7:1),rng):handler;
      const defender=pick(d.five,x=>(defense==='switch'?1:x.pos===p.pos?4:1),rng);
      const clutch=q>=4&&clock<=1200&&Math.abs(score.home-score.away)<=5;
      const protect=passed?badge(handler,'flashypass'):max(badge(handler,'handles'),badge(handler,'unpluckable'));
      const trap=defense==='trap'||defense==='press';
      if(rng()<limit(.106+(trap?.035:0)+(defender.r.steal-(passed?handler.r.pass:handler.r.handle))*.002+.007*badge(defender,'menace')-.007*protect-(clutch?.007*badge(handler,'coldblooded'):0),.035,.32)){
        add(handler,'to');
        if(rng()<.035+.01*badge(defender,'charge')){foul(handler,true);emit('foul',handler,handler.name+'带球撞人。');rotate(side);}
        else{
          const stolen=rng()<.53+.025*badge(defender,'glove');
          if(stolen)add(defender,'stl');
          emit('to',handler,stolen?defender.name+'断下了'+handler.name+'的球。':handler.name+'传球失误。');
          if(clock)next(other(side),stolen);return;
        }
        if(clock)next(other(side));return;
      }
      if(rng()<.062){
        foul(defender);emit('foul',defender,defender.name+'防守犯规。');rotate(defender.side);
        if(d.fouls>=(q>4?4:5)||d.late>=2)throws(handler,2);
        else{retained=true;fast=false;shot=max(140,shot);}
        return;
      }
      const three=limit(threeRate+(p.r.three-75)*.005+(offense==='spacing'?.09:0)+(defense==='pack'?.04:0)-(fast?.08:0),.04,.72);
      const roll=rng(),zone=roll<three?'three':roll<three+(1-three)*(.57+.09*modern+(fast?.2:0)+(offense==='post'?.1:0))?'rim':'mid';
      const pressure=(zone==='rim'?defender.r.interiorD:defender.r.perimeterD)+.12*(defender.r.speed-p.r.speed)-max(0,65-defender.energy)*.12;
      const creation=passed?handler.r.pass:p.r.handle;
      const open=rng()<limit(.44+(creation+handler.r.iq-pressure-75)*.003+(fast?.19:0)
        +(passed?.018*badge(handler,'dimer')+(trap?.13:0):.01*max(badge(p,'firststep'),badge(p,'ankle')))
        +(defense==='pack'?(zone==='rim'?-.14:.12):0)+(defense==='zone'?(passed?.06:-.07):0),.1,.88);
      const dunk=zone==='rim'&&rng()<limit(.24+(p.r.dunk+p.r.vertical-150)*.009,.03,.85);
      const skill=zone==='rim'?(dunk?p.r.dunk:p.r.layup):p.r[zone];
      const specialty=zone==='rim'?(dunk?max(badge(p,passed?'lobfin':'posterizer'),badge(p,fast?'takeoff':'highflyer')):badge(p,open?'protouch':'contactfin')):zone==='mid'?badge(p,'midmaestro'):badge(p,passed?'catchshoot':'difficult');
      const location=zone==='three'?rng():.5;
      const extra=zone==='three'&&location<.19?badge(p,'corner'):zone==='three'&&location>.94?badge(p,'limitless'):zone==='rim'?badge(p,'finisher'):0;
      const shotBoost=min(.08,.01*(max(extra,specialty)+max(clutch?badge(p,'clutch'):0,p.streak>=2?badge(p,'greenmachine'):0)));
      const contact=rng()<(zone==='rim'?.215:zone==='mid'?.055:.022);
      const defBadge=zone==='rim'?badge(defender,'rimprotector'):badge(defender,'lockdown');
      const base=zone==='rim'?.492+.017*modern:zone==='three'?.333:.35;
      const preparation=context.preparation?.side===side?context.preparation.edge*.0015:0;
      const prob=limit(base+preparation+(skill-75)*.003+(open?.053:-.03)-(pressure-75)*.0018+shotBoost-.009*defBadge
        -max(0,65-p.energy)*.001+(side==='home'?.008:0)-(location>.94?.08:0),.05,.91);
      const made=rng()<prob, points=made?(zone==='three'?3:2):0;
      if(contact)foul(defender);
      if(!contact||made){add(p,'fga');if(zone==='three')add(p,'tpa');}
      if(made){add(p,'fgm');if(zone==='three')add(p,'tpm');if(passed)add(handler,'ast');p.streak++;}
      else if(!contact)p.streak=0;
      const blocked=!made&&!contact&&!open&&rng()<limit((zone==='rim'?.24:.046)+(defender.r.block-75)*.003+(fast?.012*badge(defender,'chase'):0),.01,.5);
      if(blocked)add(defender,'blk');
      const label=zone==='rim'?(dunk?'扣篮':'上篮'):zone==='three'?'三分':'中投';
      emit(made?'make':'miss',p,(passed?handler.name+'传给':'')+p.name+'，'+(open?'空位':'迎着防守')+label+(made?'命中':blocked?'被'+defender.name+'封盖':'未中')+(contact?'并造成犯规。':'。'),points,
        {zone,open,offense,defense,defenderId:defender.id,...(made&&passed?{assist:handler.name,assistId:handler.id}:{}),...(blocked?{blocked:defender.name}:{})});
      if(contact){rotate(defender.side);throws(p,made?1:zone==='three'?3:2);}
      else if(made){if(clock)next(other(side));}
      else rebound(p);
      // Only substitute at a stoppage. A last missed free throw can already be live.
      if(made&&!contact&&clock){rotate('home');rotate('away');}
    }
    for(q=1;q<=4||score.home===score.away;q++){
      if(q>32)throw Error('加时未能收尾，保留赛前进度');
      periodLength=q<=4?7200:3000;clock=periodLength;quarters.push({home:0,away:0});
      for(const s of sides){
        const c=clubs[s];c.fouls=0;c.late=0;
        for(const p of c.roster)if(p.returnPeriod===q){p.out=false;p.energy=min(p.energy,65);emit("return",p,p.name+"经检查可重新登场。");}
        if(q>1){for(const p of c.roster)p.energy=min(100,p.energy+(q===3?12:5));rotate(s,true);}
      }
      next(q>4?(rng()<.5?'home':'away'):q===1||q===4?first:other(first));
      while(clock>0){play();checkInjuries();}
    }
    for(const s of sides)for(const p of clubs[s].roster){p.box.min=p.box.ticks/600;p.box.reasons=[...new Set(p.reasons)];}
    function output(s){const c=clubs[s];return {name:c.name?.hans||c.name?.en||c.name,players:c.players,box:c.box,teamTO:c.teamTO};}
    return {engine:4,digest,home:output('home'),away:output('away'),score,events,quarters,injuries,winner:score.home>score.away?'home':'away',
      possessions:(clubs.home.poss+clubs.away.poss)/2,bySide:{home:clubs.home.poss,away:clubs.away.poss}};
  }
  function applyEvent(box,event){
    if(event.floor)event.floor.forEach((ids,i)=>{for(const id of ids)(box[sides[i]][id]??=empty()).ticks+=event.elapsed;});
    for(const [s,id,k,n] of event.changes)(box[s][id]??=empty())[k]+=n;
  }
  function minutes(value){
    const seconds=Math.floor(value*60+1e-6);
    return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
  }
  window.MBLMatchV4={simulate,applyEvent,minutes};
})();
