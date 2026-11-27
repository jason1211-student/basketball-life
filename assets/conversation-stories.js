/* Saveable two-turn conversations. Rendering a thread never rolls or settles a choice. */
(function () {
  'use strict';
  // Each scene has a concrete detail that the same person can bring up again later.
  const scenes = {
    mother:[
      ['菜谱上的字','我翻到一本旧菜谱，边上歪歪扭扭写着“下次少放姜”。猜猜是谁写的？',
        '承认是自己的字','是我写的吧？我现在还是一口就能吃出姜。','就是你！当时你还嫌纸不够，在封底又写了一遍。',
        '请她讲讲那一天','那天我们在做什么？我想听你讲。','厨房停电，我们拿手电照着切菜。我还记得你举得特别认真。'],
      ['那张合影','今天洗了一张合影。别人都看镜头，就你盯着旁边的蛋糕。',
        '问她当时在看谁','我盯着蛋糕，那你当时在看谁？','在看你呀。你说要忍到吹完蜡烛，腮帮子都鼓起来了。',
        '让她留一张','帮我留一张吧，我也想放在桌边。','好，我在背面写上日期，留给你自己挑相框。']],
    father:[
      ['篮筐的响声','院子里那块篮板又响了。你小时候一听，就知道是左边哪颗螺丝。',
        '一起找原因','你拍一下左下角，我听听是不是以前的响声。','还真是那颗。工具拿出来了，等拧好我给你听一声。',
        '问他还投不投','修好了你自己也投两个吧。最近还准吗？','十个进了四个。第五个在筐里转了一圈，这个我可记着。'],
      ['旧工具箱','清工具箱的时候，找到一个写着你名字的打气针盒。',
        '问起盒子的来历','我还真忘了它怎么来的。','你怕别人借走不还，用记号笔写了三遍名字。',
        '让他替你留着','盒子留给我吧，下回一起给球打气。','行，就放在扳手旁边。你回来自己找。']],
    partner:[
      ['空出来的夜晚','今晚突然空下来，我一个人去听了场小演出。散场时挺想跟你说几句。',
        '问最喜欢哪首','哪一首让你散场了还在想？','最后一首。他们关了返听，只剩下大家拍手的声音。',
        '聊聊独处','一个人去，是自在多一点，还是有点孤单？','两样都有。我很喜欢自己选座位，也喜欢散场后有人听我说。'],
      ['桌上的两张照片','桌上有两个空相框。我想放一张你的，再放一张只和我自己有关的。',
        '先选对方的照片','先说说你想给自己选哪张。','第一次独立把事情做成那天。我很少说，但那天我为自己高兴。',
        '一起回想一次出游','我们那张选路边迷路的怎么样？','就是它。我到现在还记得，是你把地图拿倒了。']],
    sibling:[
      ['相册里的外号','我在相册后面找到你给我起的外号。申诉一下，当年到底谁先开始的？',
        '举手认领','好吧，那个是我起的，你赢一回。','难得！我可截图了，下次家庭聚会有证据了。',
        '听对方的版本','我想听听你记得的版本。','你先喊的，我追了你半圈，最后一起被叫去吃饭。'],
      ['两张票','我扫到两张演出票，想去，自己去又有点犹豫。',
        '问最期待什么','如果去了，你最想听哪首？','安可那首！光说歌名我就觉得应该买票。',
        '支持自己做决定','你一个人也能去，把决定留给自己吧。','行，我先挑自己喜欢的位子。你这次居然没替我做主。']],
    child:[
      ['新练的假动作','今天有个人真的被我的假动作晃过去了！我差点笑到走步。',
        '听动作细节','先动的肩还是脚？我想听你讲完整一遍。','先看左边，再往右跨！这次是我自己想出来的。',
        '问当时的感觉','你自己最得意的是哪一秒？','是我发现自己敢试了。进没进球都在后面。'],
      ['画里的空座位','画了一排看台，还剩个空座位，我在想画谁。',
        '让孩子自己决定','画谁都由你，你怎么想的？','想画总给我们递水的那个同学，他也很重要。',
        '问看台的颜色','跟我说说你会给那排座位涂什么颜色。','橘色！这样最后一排的人也看得见。']],
    teammate:[
      ['训练照','翻到以前练折返跑的照片。别人都在跑，你在跟照相的人挥手。',
        '请他交代后半段','后来谁跑了最后一趟？你别只发半段。','是我。拍完照我发现自己落后半圈，这才是真相。',
        '问他最想念什么','那段时间，你现在最想念哪一点？','跑完有人等着碰拳。累是真的，但不是一个人扛。'],
      ['旧战术板','我记得一次暂停，战术板的笔没水，大家盯着一块白板点头。',
        '问那回怎么打的','最后是按谁说的跑位？','底角那个人先动，剩下四个居然全跟上了。',
        '聊场上的默契','有时候一个眼神比画箭头还管用。','对。前提是你知道对方也看见了你。']],
    friend:[
      ['街角的老店','路过以前买饮料的小店，冰柜的门还是得先往上提一下。',
        '问店里的人','收银的人还记得我们吗？','他记得有人总把零钱数两遍，还问你最近怎么样。',
        '聊熟悉的地方','有些地方好久没去，动作还记得。','没错。我提门那一下，自己先笑了。'],
      ['没洗出来的照片','翻到一张拍糊的照片。本来要删，越看越舍不得。',
        '听照片背后的事','拍的是哪天？讲给我听听。','我们赶末班车那天，笑得手都没拿稳。',
        '鼓励留下','留着吧，有些照片只有拍的人看得懂。','说得对。我刚刚把它从回收站挪出来了。']]
  };
  const voices = {
    mother:['你几次说“还好”，我才听出来你其实挺累。今天是哪一种？','好，今天我先听你说完。','行，那我先听你想到的第一步。'],
    father:['要我帮你想办法，还是陪你坐会儿？这两件事我分得清。','那我把主意收一收，你慢慢讲。','先挑一件做得到的。做好了你自己会知道。'],
    partner:['我先把自己的事放一会儿。你想让我听，还是一起排个顺序？','我听着。你不必把难受解释得很有道理。','那你挑第一步，我替你记着你为什么这么选。'],
    sibling:['今天可以借你十分钟，吐槽频道还是出主意频道？','行，吐槽频道开着。我先不插嘴。','成交。先做一件就行，别一口气列八条。'],
    child:['你以前总听我讲，今天也可以换我听你讲。','原来你也会紧张。谢谢你告诉我。','把第一步讲给我听吧，我想知道你怎么想的。'],
    teammate:['要复盘我就拿纸，要吐槽我就把纸放下。选一个？','纸放下了。今天不算正负值。','先盯一件能改变的事，比把回放看十遍管用。'],
    friend:['我有空。你需要个听众，还是想找个人帮你理理头绪？','我在，不急着给这事下结论。','说说你打算先试什么，我替你留个心。']
  };
  const hash=(...parts)=>window.MBLDevelopment.hash(...parts);
  function progress(life) {
    const s=life.ball?.season, pro=life.ball?.pro;
    const regular=pro && !life.ball.retiredFromPlaying && !s?.staff && s?.phase==='regular' && s.team?.en===pro.team?.en;
    return {age:life.age,period:Math.min(3,Math.floor(Math.max(0,life.lastMoment||0)*4)),
      room:regular ? JSON.stringify([s.year,s.leagueId,s.team?.en,s.cup??null]) : '',game:regular ? s.games.length : 0};
  }
  function situation(life) {
    if (life.ball?.retiredFromPlaying) return ['退役以后的日常','少了固定训练时间，反而得重新学怎么安排一天。'];
    if (life.ball?.out>0) return ['缺阵的日子','今天又在场边看完了训练，不能一起上场有点难熬。'];
    if (life.ball?.pro) {
      const s=life.ball.season, decision=life.flags?.mblCareerStories;
      if (decision?.last?.answered && decision.last.room===JSON.stringify([s?.year,s?.cup??null,s?.team?.en]) && decision.detail)
        return ['更衣室的谈话','今天想跟你说说'+decision.detail+'。当时说出口，比我想象的难。'];
      if (s?.phase==='playoffs') return ['季后赛前的心情','到了季后赛，昨天的一个回合还在我脑子里转。'];
      return ['球队里的近况','训练散了以后，我还在想自己在队里能做些什么。'];
    }
    if (life.inSchool || life.age<18) return ['学校里的近况','今天在学校有件事一直挂在心上，想找个人说说。'];
    return ['最近的生活','最近好几件事挤到一起，我还没找到自己的节奏。'];
  }
  function recall(thread) {
    const ap=thread.appointments?.at(-1);
    if (ap && ap.outcome!=='legacy' && JSON.stringify(ap)!==thread.dialogue?.appointmentSeen)
      return ({kept:'上回你按约来了，我一直记得。',missed:'上回等你没等到，我还有点介意。',cancelled:'上回你提前说来不了，我好另做安排。',moved:'上回我们改了时间，这次慢慢聊。'})[ap.outcome]||'';
    if (thread.promise) return '约好的时间我还留着呢。';
    const m=thread.dialogue?.memory;
    if (!m) return '';
    if (m.key==='space') return '上回你说还需要点时间。这次聊什么，你来挑。';
    if (m.key==='better') return '上回听你说那件事理顺了，我挺高兴的。';
    if (m.key==='listen') return '上回你想让我先听你说，我记得。';
    if (m.key==='plan') return '上回你说想先试一个办法，后来怎么样？';
    return '上回聊起'+m.title+'，我后来又想到了。';
  }
  // People adapt their opening to how the player has actually liked to talk.
  const familiarVoices={
    mother:['今天我先不问你吃过没有。你最想从哪儿说起？','我去拿纸。你想先理顺哪件事？'],
    father:['这回我先把工具放下。你说，我听着。','咱们像上回一样，只挑眼前能办的一件？'],
    partner:['你上次把话讲完才松了口气。今晚我也有时间。','上次一起排顺序挺管用，今天最挤你时间的是哪件？'],
    sibling:['懂了，今天先把我的吐槽憋住。你开头吧。','把最纠结的两件事发来，咱们一件一件理。'],
    child:['你每次都让我慢慢讲。今天我也不打断你。','上次你教我从小事做起，你今天打算先做什么？'],
    teammate:['今天先不看录像。训练馆散场之后，你在想什么？','战术板在这儿。你觉得第一步该往哪儿走？'],
    friend:['老规矩，话没说完之前我不替你想结论。','上回拆成两步你说轻松多了，这回也一起理理？']
  };
  function temperament(life, contact, thread) {
    const m=thread.dialogue;
    if (m?.patient>=2) return '和你说话时，更愿意慢慢讲心事';
    if (m?.practical>=2) return '遇到事情，习惯和你一起想办法';
    return ['习惯先问一个具体的问题','愿意给对方留一点说话的时间','喜欢把自己的想法直接说出来'][hash(life.seed,contact.id,'voice')%3];
  }
  function menu(life,c,t,bond) {
    if (!life.alive || life.age<12 || !scenes[c.role]) return {items:[]};
    const m=t.dialogue||{}, now=progress(life), last=m.last;
    const context=situation(life), seq=m.turn||0;
    const active=m.open?.stamp.age===now.age && m.open.stamp.room===now.room &&
      (m.open.kind==='personal'||m.open.kind==='event'||m.open.title===context[0]) ? m.open : null;
    const token=JSON.stringify([now,seq,active?.title||'',context[0],t.inbox?.[0]||'']);
    const list=scenes[c.role];
    const pick=(hash(life.seed,c.id,'scene')+(m.personalCount||0))%list.length;
    const scene=list[active?.pick??pick];
    if (m.question) return {token:token+'reply',now,question:m.question,items:[{key:'better',label:'告诉对方后来怎样了'},{key:'space',label:'说自己还需要时间'}]};
    if (active) return {token,items:active.kind==='personal' ?
      [{key:'detail',label:scene[2]},{key:'act',label:scene[5]}] :
      [{key:'listen',label:'说出自己的感受'},{key:'plan',label:'一起想一个办法'}],active,scene,now};
    if (last && last.age===now.age && last.room===now.room &&
        (now.room ? now.game-last.game<4 : now.period<=last.period))
      return {items:[],hint:now.room?'聊过这一轮了。再打 '+(4-now.game+last.game)+' 场，就有新近况可聊。':'聊过这一轮了。生涯再推进一段，就有新近况可聊。'};
    return {token,now,scene,pick,context,items:[{key:'personal',label:seq?'问问对方的近况':'发条消息问候'},
      {key:'share',label:'聊聊'+context[0]}],guarded:bond<38};
  }
  function respond(life,c,t,bond,token,key) {
    const view=menu(life,c,t,bond);
    if (!token || token!==view.token || !view.items.some(b=>b.key===key)) return null;
    const m={...t.dialogue,turn:(t.dialogue?.turn||0)+1}, voice=voices[c.role], scene=view.scene;
    let sent,reply,delta=0,reason='';
    if (view.question) {
      sent=key==='better'?'后来我把那件事理顺了一点。谢谢你还记得。':'还没有完全理顺。等我想好了，再和你讲。';
      reply=key==='better' ? ['好，那我替你高兴。','那就把这一步记下来。','听到了。今天就到这里也很好。'][hash(life.seed,c.id,'voice')%3] : '行，这次我先不追问。你想说时再来找我。';
      m.memory={title:view.question.title,key};m.last=view.now;delete m.question;
    } else if (!view.active) {
      const personal=key==='personal', title=personal ? scene[0] : view.context[0];
      sent=personal ? '今天想先听听你那边的事。' : view.context[1];
      const remembered=recall(t);
      const familiar=familiarVoices[c.role];
      const opening=m.patient>=2 ? familiar[0] : m.practical>=2 ? familiar[1] : voice[0];
      reply=(remembered ? remembered+' ' : '')+(view.guarded?'我们慢慢说。':'')+(personal?scene[1]:opening);
      m.open={kind:personal?'personal':'share',stamp:view.now,pick:view.pick,title};
      if (personal) m.personalCount=(m.personalCount||0)+1;
      if (t.appointments?.length) m.appointmentSeen=JSON.stringify(t.appointments.at(-1));
    } else {
      const receptive=key==='detail'||key==='listen', direct=hash(life.seed,c.id,'voice')%3===2;
      if (view.active.kind==='personal') {
        const i=key==='detail'?3:6;sent=scene[i];reply=scene[i+1];
      } else {
        sent=receptive?'我现在想先把心里的话说完。':'我想先选一件自己能改变的事。';
        reply=receptive?voice[1]:voice[2];
      }
      delta=receptive ? (direct?1:2) : (direct?2:1);
      reason='聊过'+view.active.title;
      m.patient=(m.patient||0)+(receptive?1:-1);m.practical=(m.practical||0)+(receptive?-1:1);
      m.patient=Math.min(3,Math.max(0,m.patient));m.practical=Math.min(3,Math.max(0,m.practical));
      m.memory={title:view.active.title,key};m.last=view.now;
      if (view.active.kind!=='personal') m.later={title:view.active.title,stamp:view.now,key};
      delete m.open;
    }
    return {sent,reply,delta,reason,memory:m};
  }
  function followUp(life,thread) {
    const m=thread?.dialogue, waiting=m?.later;
    if (!waiting || !life.alive || life.age<12) return '';
    const now=progress(life), from=waiting.stamp;
    const due=now.age>from.age || now.room!==from.room || (now.room ? now.game>=from.game+4 : now.period>from.period);
    if (!due) return '';
    delete m.later;
    m.question={title:waiting.title};m.turn++;
    return '上回你提到'+waiting.title+'。'+(waiting.key==='plan'?'后来试了你说的第一步吗？':'这几天心情有变化吗？我还惦记着。');
  }
  function eventReply(role,event) {
    const answers={
      contract:['那一刻手抖，也值得记下来。家里有人替你记着。','签字那支笔留了吗？这一下可不是每天都有。','我想先听听你走出去的那一秒，再说庆祝的事。','签名练那么久，今天可算用上了。替你高兴。','你说的那一幕，我一下想起你第一次试训。'],
      injury:['复查那天你愿意说，我就听。咱们也能聊球以外的事。','知道哪天去就行，要接送再喊我。','你肯说“慢一点很难”，我很高兴。今天我来听。','人坐在场边，脑子还在打球吧。要不要聊点别的？','最难的是等。想有人陪着发会儿呆，也可以找我。'],
      trade:['好。先找个睡得着的地方，安顿好了再说。','行李不用一次全搬，给我说说最急的那箱。','我的工作时间也得算进去。见面时把两份日历放一起看。','到了先记住装备柜在哪儿，别像我当年走错门。','新地方最先想搞清楚的，是哪一件事？'],
      allowance:['这回的钱够用了。下次先问问你自己手里宽不宽裕。','这次够了。我把开销记下了，有大项先和你商量。']
    };
    return answers[event]?.[['mother','father','partner','teammate','friend'].indexOf(role)];
  }
  function rememberEvent(life,t,event) {
    const title={contract:'第一次签约',injury:'受伤后的安排',trade:'换队后的生活',allowance:'家里的开销'}[event];
    if (!title) return;
    const old=t.dialogue||{};
    t.dialogue={...old,turn:(old.turn||0)+1, open:{kind:'event',title,stamp:progress(life)}};
  }
  window.MBLConversationStories={menu,respond,temperament,eventReply,rememberEvent,followUp};
})();
