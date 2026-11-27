(function () {
  'use strict';
  if (window.MBLSeasonCommand) return;

  const C = window.MBLCore;
  let target = null;
  let selection = null;
  let busy = false;
  let message = '';

  function current() {
    const life = C.life();
    return life?.alive ? Oa(life) : null;
  }

  function refresh() {
    window.MBLTeamCalendar?.refresh();
  }

  function select(season, date, count, preview) {
    if (busy || season !== current()) return;
    selection = { season, date, count, preview };
    message = '';
    refresh();
  }

  function isSelected(season, date) {
    return selection?.season === season && selection.date === date;
  }

  function blocked() {
    return !!(C.life()?.pending?.length || de.outcome || de.notices?.length ||
      document.querySelector('.mbl-era-pop[open]'));
  }

  async function advanceStage() {
    const season=current(),life=C.life(),lifeAge=life?.age;
    if(busy||window.__mblAutoSim||blocked()||!season||season.games.length<season.total)return;
    busy=true;message='正在结算常规赛并检查下一阶段…';de.auto=false;
    const previousOne=window.__mblOneGame;
    window.__mblOneGame=false;
    refresh();
    try{
      const result=await window.MBLAutoSim.autoPlay(now=>now!==life||!now.alive||now.age!==lifeAge||now.ball?.season!==season||season.phase!=='regular',{
        maxSteps:4000,pauseMajor:true,pauseEra:true,pauseNotice:true,pauseAppointments:true,onChoice:()=>true
      });
      if(C.life()===life&&life.ball?.season===season&&season.phase==='regular')message=result.reason==='appointment'?'有约定待处理，完成后继续赛季结算':['major','choice','notice','era'].includes(result.reason)?'有事项待处理，完成后继续赛季结算':'阶段推进暂停，请检查当前事项后重试';
      else message='常规赛结算完成，请查看当前赛季阶段';
    }catch(error){message='阶段推进中断，请检查当前事项后重试';console.error('[season transition]',error);}
    finally{window.__mblOneGame=previousOne;de.auto=false;busy=false;refresh();}
  }

  async function run(count) {
    if (busy || window.__mblAutoSim || blocked()) return;
    const season = current();
    if (!season || count <= season.games.length || count > season.total) return;
    target = { season, count };
    busy = true;
    message = '正在模拟…';
    de.auto = false;
    window.__mblOneGame = true;
    refresh();
    try {
      const result = await window.MBLAutoSim.autoPlay(life => {
        return Oa(life) !== season || season.games.length >= count;
      }, { maxSteps: 6000, pauseMajor: true, pauseEra: true, pauseNotice: true,pauseAppointments:true,
        onChoice: () => true });
      if (season.games.length >= count) {
        message = count === season.total ? '常规赛比赛已全部完成' : '已到达选中日期';
        target = null;
      } else if (current() !== season) {
        message = '赛季已变化，模拟结束';
        target = null;
      } else {
        message = result.reason==='appointment'?'有约定待处理，完成后继续模拟': ['major', 'choice', 'notice', 'era'].includes(result.reason)
          ? '有事项待处理，完成后可继续模拟' : '模拟暂停，可继续剩余场次';
      }
    } catch (error) {
      message = '模拟中断，请检查当前进度后继续';
      console.error('[season-command]', error);
    } finally {
      window.__mblOneGame = false;
      de.auto = false;
      busy = false;
      refresh();
    }
  }

  function render(season) {
    if (!blocked() && message.indexOf('有事项待处理') === 0) message = '';
    if (message.indexOf('有约定待处理')===0 && !window.MBLRelationsMessages?.notifications(C.life()).appointments.some(item=>item.due)) message='';
    if (selection?.season !== season) selection = null;
    if (target?.season !== season) target = null;
    const panel = C.h('section', 'mbl-season-command');
    panel.append(C.h('b', '', '赛季指挥台'));
    panel.append(C.h('p', 'mbl-season-status', blocked() ? '有事项待处理，完成后可继续模拟' : (message || (selection
      ? '已选择 ' + selection.date + ' · 截至第 ' + selection.count + ' 场'
      : '选择日历日期，决定模拟进度'))));
    function action(label, count, fn) {
      const button = C.h('button', 'mbl-season-btn', label);
      button.type = 'button';
      button.disabled = busy || blocked() || !Number.isInteger(count) || count <= season.games.length;
      button.onclick = fn || (() => run(count));
      return button;
    }
    const actions = C.h('div', 'mbl-season-actions');
    if(season.games.length>=season.total){
      const next=C.h('button','mbl-season-btn mbl-season-transition','结算常规赛 · 查看晋级结果');next.type='button';next.disabled=busy||blocked();next.onclick=advanceStage;actions.append(next);
    }else actions.append(action('模拟到选中日期', selection?.count), action('模拟至常规赛结束', season.total));
    if (selection?.preview) actions.append(action('查看选中场次预览', selection.count, selection.preview));
    if (target) {
      actions.append(action('继续模拟至第 ' + target.count + ' 场', target.count));
      const cancel = C.h('button', 'mbl-season-btn', '取消目标');
      cancel.type = 'button'; cancel.disabled = busy;
      cancel.onclick = () => { target = null; message = ''; refresh(); };
      actions.append(cancel);
    }
    panel.append(actions);
    return panel;
  }

  window.MBLSeasonCommand = { select, isSelected, render, run, advanceStage, busy: () => busy };
})();
