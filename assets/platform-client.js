(function () {
  'use strict';

  var KEYS = ['mbl.current', 'mbl.records', 'mbl.achievements', 'mbl.countries', 'mbl.settings', 'mbl.shared'];
  var S = { ready: false, busy: '', account: null, identity: '', epoch: 0, remote: null,
    revision: 0, loaded: false, choice: '', changedAccount: false, localDirty: false, pages: 0,
    cursor: '', list: [], share: null, bbs: undefined, focusBefore: null, conflict: false, lastIdentity: '',
    accountKey: '', autoEnabled: false, autoEligible: false, autoTimer: null, autoInFlight: false,
    autoLastStart: 0, autoReason: '', careerTimer: null, careerLastStart: 0,
    careerAttempted: new Set(), careerDone: new Set(), careerFailures: new Map(), careerBootAttempts: 0, problem: '', needsLogin: false,
    cloudPending: false, bootstrapLocal: null, resumeCheckAt: 0, restoring: false, profileDirty: false,
    publicationPending: false, publicationTimer: null, publicationAttempts: 0, publicationBusy: false,
    autoTimerUrgent: false, saveRetryTimer: null, saveRetryAttempts: 0, urgent: false, saveFlight: null,
    cloudFailure: false, loadingCloud: true, memoryOwner: "", base: null, remoteStories: [], archiveMode: '', deltaEnabled:false, confirmEnabled:false, requestBudget:2250000, archiveSeeds: new Set(), archiveFlights: new Map(), sessions: new Map() };
  var UI = {};
/* Authorized community UI, composed inside the platform client closure at build time. */
var communityState = { tab: 'community', difficulty:'easy', root: null, feeds: { community: communityFeed(), ranking: communityFeed() }, storyEpoch: 0, storyId: '', focusBefore: null, details: new Map(), detailRequests: new Map(), posters: new Map(), posterRequests: new Map(), posterBusy: false, posterWanted: '' };
var carousel = { timer: null, enabled: true, pauseUntil: 0, inView: true, observer: null, drag: null, touching: false, suppressClickUntil: 0, lifecycle: false, failures: new Set() };
function communityFeed() { return { rows: [], cursor: '', pages: 0, loaded: false, busy: false, error: '', request: 0, slide: 0, scrollTop: 0 }; }
function communityEnsure() {
  var feed=communityState.feeds.community;
  if(window.ColorboxAI&&window.ColorboxAI.cloud&&typeof window.ColorboxAI.cloud.request==='function'){
    if(!feed.autoRequested){feed.autoRequested=true;communityLoad(false).catch(function(){});}
  }else if(!feed.loaded&&!feed.error){feed.error='请在虎扑页面连接社区服务后查看。';communityRender();}
}
function communityMount() {
  var target = document.querySelector('#app [data-mbl-community]');
  if (!target) { communityCarouselStop(); return; }
  if (target === communityState.root && target.querySelector('.mbl-c-tabs')) return;
  communityCarouselStop(); carousel.drag=null;
  if(carousel.observer)carousel.observer.disconnect();
  communityState.root = target; target.replaceChildren();
  var top = node('div', undefined, 'mbl-c-heading');
  var title = node('div',undefined,'mbl-c-title'); title.append(node('span', '生涯展示', 'mbl-c-eyebrow'), node('h2', 'JR的篮球人生'));
  var refresh = button('刷新', 'browse-refresh'); top.append(title, refresh); target.append(top);
  var tabs = node('div', undefined, 'mbl-c-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '生涯浏览方式');
  ['community', 'ranking'].forEach(function (key) {
    var tab = button(key === 'community' ? '社区' : '排行榜', 'browse-tab'); tab.dataset.tab = key;
    tab.id = 'mbl-tab-' + key; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', 'mbl-career-panel');
    tabs.append(tab);
  });
  target.append(tabs);
  var filter=node('div',undefined,'mbl-c-filter'),levels=node('div',undefined,'mbl-c-difficulty');
  levels.setAttribute('role','radiogroup');levels.setAttribute('aria-label','生涯难度');
  ['easy'].forEach(function(key){var b=button('普通','browse-difficulty');b.setAttribute('aria-label','普通人生');b.dataset.difficulty=key;b.setAttribute('role','radio');levels.append(b);});
  filter.append(levels);top.insertBefore(filter,refresh);
  levels.addEventListener('keydown',function(e){if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();var b=levels.querySelector('[data-difficulty="easy"]');if(b){b.click();b.focus();}});
  var panel = node('div', undefined, 'mbl-c-panel'); panel.id = 'mbl-career-panel'; panel.setAttribute('role', 'tabpanel');
  panel.append(node('p', '', 'mbl-c-caption'), node('p', '', 'mbl-c-status'), node('ol', undefined, 'mbl-c-rows'), button('加载更多生涯', 'browse-more'));
  var pager = node('div', undefined, 'mbl-c-carousel-nav');
  var previous = button('‹', 'poster-previous'); previous.setAttribute('aria-label','上一张生涯海报');
  var next = button('›', 'poster-next'); next.setAttribute('aria-label','下一张生涯海报');
  var position = node('span', '', 'mbl-c-carousel-position'); position.setAttribute('role','status');
  var autoplay=button('暂停轮播','poster-autoplay');autoplay.classList.add('mbl-c-autoplay');
  pager.append(previous, position, next,autoplay); panel.insertBefore(pager,panel.lastElementChild);
  target.append(panel); target.addEventListener('click', communityClick);
  var list = panel.querySelector('.mbl-c-rows'), scrollPending = false;
  list.addEventListener('scroll',function(){
    if(scrollPending)return;scrollPending=true;
    requestAnimationFrame(function(){scrollPending=false;communityScroll();});
  },{passive:true});
  list.addEventListener('keydown',function(e){
    if(communityState.tab!=='community'||!['ArrowLeft','ArrowRight'].includes(e.key))return;
    e.preventDefault();communityMove(e.key==='ArrowRight'?1:-1);
  });
  communityCarouselBind(list,target);
  tabs.addEventListener('keydown', function (e) {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
    e.preventDefault(); communitySelect(e.key === 'Home' ? 'community' : e.key === 'End' ? 'ranking' : communityState.tab === 'community' ? 'ranking' : 'community', true);
  });
  communityRender();
}
function communityRender() {
  var root = communityState.root; if (!root || !root.isConnected) return;
  var key = communityState.tab, feed = communityState.feeds[key];
  root.dataset.view=key;root.querySelector('.mbl-c-filter').dataset.difficulty=communityState.difficulty;root.querySelectorAll('[data-action="browse-difficulty"]').forEach(function(b){var selected=b.dataset.difficulty===communityState.difficulty;b.setAttribute('aria-checked',String(selected));b.tabIndex=selected?0:-1;});
  root.querySelectorAll('[role="tab"]').forEach(function (tab) { var selected = tab.dataset.tab === key; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; });
  root.querySelector('[role="tabpanel"]').setAttribute('aria-labelledby', 'mbl-tab-' + key);
  root.querySelector('.mbl-c-caption').textContent = key === 'community' ? '自动轮播 · 支持左右拖动 · 点击放大海报' : '按生涯评分排序 · 列表内上下滚动，点击查看海报';
  var status = root.querySelector('.mbl-c-status'); status.setAttribute('role', 'status');
  status.textContent = feed.error || (feed.busy ? '正在读取生涯…' : !feed.rows.length ? '还没有公开的生涯，完成人生后会自动出现在这里。' : ''); status.hidden = !status.textContent;
  var list = root.querySelector('.mbl-c-rows'); list.replaceChildren();list.tabIndex=0;
  list.setAttribute('aria-label',key==='community'?'生涯海报，左右滑动浏览':'排行榜，可在列表内上下滚动');
  if(key==='community'){
    feed.rows.forEach(function(life){
      var li=node('li'),card=button('','browse-open');card.className='mbl-c-poster-card';card.dataset.lifeId=life.id;
      card.setAttribute('aria-label',(plain(life.nickname)||'虎扑JR')+'的生涯海报，'+safeCount(life.score)+'分，点击放大');
      var imagebox=node('span',undefined,'mbl-c-poster-imagebox');imagebox.dataset.posterId=life.id;imagebox.append(node('span','正在准备生涯海报…','mbl-c-poster-placeholder'));
      var owner=node('span',undefined,'mbl-c-poster-owner'),avatar=safeImage(life.avatar),face;
      if(avatar){face=node('img',undefined,'mbl-c-avatar');face.src=avatar;face.alt='虎扑玩家头像';face.loading='lazy';}
      else face=node('span','JR','mbl-c-avatar mbl-c-avatar-empty');
      var who=node('span',undefined,'mbl-c-person');who.append(node('strong',plain(life.nickname)||'虎扑JR'),node('span',(plain(life.name)||'模拟角色')+' · '+safeCount(life.score)+'分','mbl-c-role'));
      owner.append(face,who,node('span','放大海报 →','mbl-c-read'));card.append(imagebox,owner);li.append(card);list.append(li);
    });
  }else{
  feed.rows.forEach(function (life, index) {
    var li = node('li'), card = button('', 'browse-open'); card.className = 'mbl-c-card'; card.dataset.lifeId = life.id;
    if (key === 'ranking') card.append(node('span', String(index + 1).padStart(2, '0'), 'mbl-c-rank'));
    var avatar = safeImage(life.avatar), face;
    if (avatar) { face = node('img', undefined, 'mbl-c-avatar'); face.src = avatar; face.alt = '虎扑玩家头像'; face.loading = 'lazy'; }
    else face = node('span', 'JR', 'mbl-c-avatar mbl-c-avatar-empty');
    card.append(face); var body = node('span', undefined, 'mbl-c-person');
    body.append(node('strong', plain(life.nickname) || '虎扑JR'), node('span', (plain(life.name) || '模拟角色') + ' · ' + safeCount(life.titles) + '冠 / ' + safeCount(life.mvp) + ' MVP', 'mbl-c-role'));
    var score = node('span', undefined, 'mbl-c-score'); score.append(node('b', safeCount(life.score)), node('small', '生涯评分'));
    card.append(body, score); li.append(card); list.append(li);
  });
  }
  root.querySelector('[data-action="browse-refresh"]').disabled = feed.busy;
  var more = root.querySelector('[data-action="browse-more"]'); more.hidden = !feed.cursor; more.disabled = feed.busy;
  if(key==='community'){
    feed.slide=Math.max(0,Math.min(feed.slide,feed.rows.length-1));list.scrollTop=0;list.scrollLeft=feed.slide*list.clientWidth;
    communityPosterPosition();
  }else{communityCarouselStop();communityState.posterWanted='';list.scrollLeft=0;list.scrollTop=feed.scrollTop;root.querySelector('.mbl-c-carousel-nav').hidden=true;}
}
async function communityLoad(more) {
  var key = communityState.tab, feed = communityState.feeds[key];
  if (feed.busy || more && !feed.cursor) return;
  var request = ++feed.request; feed.busy = true; feed.error = ''; communityRender();
  try {
    var params = { sort: key === 'community' ? 'recent' : 'score',difficulty:communityState.difficulty }; if (more) params.cursor = feed.cursor;
    var result = await api('/api/lives', 'GET', params, false);
    if (!result || !Array.isArray(result.items)) throw error('生涯列表暂时不可用，请稍后刷新。');
    if (feed.request !== request) return;
    var rows = result.items.slice(0,20).filter(function (x) { return x && typeof x.id === 'string'; });
    feed.rows = more ? feed.rows.concat(rows) : rows; feed.pages = more ? feed.pages + 1 : 1;
    if(!more){feed.slide=0;feed.scrollTop=0;carousel.failures.clear();communityState.posters.forEach(function(value,id){if(value.error)communityState.posters.delete(id);});}
    feed.cursor = rows.length && typeof result.nextCursor === 'string' && /^\d{1,7}$/.test(result.nextCursor) ? result.nextCursor : '';
    feed.loaded = true;
  } catch (e) { feed.error = e.message || '暂时无法读取生涯，请稍后刷新。'; throw e; }
  finally { feed.busy = false; communityRender(); }
}
function communitySelect(key, focus) {
  if (!['community','ranking'].includes(key)) return;
  communityState.tab = key; communityRender();
  if (focus && communityState.root) communityState.root.querySelector('#mbl-tab-' + key).focus();
  if (!communityState.feeds[key].loaded && !communityState.feeds[key].busy) communityLoad(false).catch(function () {});
}
function communityClick(e) {
  if(Date.now()<carousel.suppressClickUntil){e.preventDefault();e.stopPropagation();return;}
  var target = e.target.closest('[data-action]'); if (!target || target.disabled) return;
  if(target.dataset.action==='browse-difficulty'&&['easy','hard'].includes(target.dataset.difficulty)&&target.dataset.difficulty!==communityState.difficulty){communityCarouselStop();communityState.difficulty=target.dataset.difficulty;communityState.feeds={community:communityFeed(),ranking:communityFeed()};communityRender();communityLoad(false).catch(function(){});}
  if (target.dataset.action === 'browse-tab') communitySelect(target.dataset.tab, false);
  if (target.dataset.action === 'browse-refresh') communityLoad(false).catch(function () {});
  if (target.dataset.action === 'browse-more') communityLoad(true).catch(function () {});
  if (target.dataset.action === 'browse-open') communityOpenStory(target.dataset.lifeId);
  if (target.dataset.action === 'poster-previous') communityMove(-1);
  if (target.dataset.action === 'poster-next') communityMove(1);
  if (target.dataset.action === 'poster-autoplay') { carousel.enabled=!carousel.enabled;communityPosterPosition(); }
}
function communityScroll(){
  var root=communityState.root;if(!root||!root.isConnected)return;
  var list=root.querySelector('.mbl-c-rows'),feed=communityState.feeds[communityState.tab];
  if(communityState.tab==='ranking'){feed.scrollTop=list.scrollTop;return;}
  var index=Math.max(0,Math.min(feed.rows.length-1,Math.round(list.scrollLeft/Math.max(1,list.clientWidth))));
  if(index!==feed.slide){feed.slide=index;communityPosterPosition();}
}
function communityMove(delta,automatic){
  var root=communityState.root,feed=communityState.feeds.community;if(!root||!feed.rows.length)return;
  if(!automatic)communityCarouselPause();
  var wrapping=automatic&&feed.slide===feed.rows.length-1&&delta>0;
  feed.slide=automatic?(feed.slide+delta+feed.rows.length)%feed.rows.length:Math.max(0,Math.min(feed.rows.length-1,feed.slide+delta));
  var list=root.querySelector('.mbl-c-rows'),left=feed.slide*list.clientWidth;
  if(typeof list.scrollTo==='function')list.scrollTo({left:left,behavior:wrapping||window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  else list.scrollLeft=left;
  communityPosterPosition();
}
function communityPosterPosition(){
  var root=communityState.root;if(!root||communityState.tab!=='community')return;
  var feed=communityState.feeds.community,nav=root.querySelector('.mbl-c-carousel-nav');nav.hidden=!feed.rows.length;
  root.querySelector('.mbl-c-carousel-position').textContent=feed.rows.length?(feed.slide+1)+' / '+feed.rows.length:'';
  root.querySelector('[data-action="poster-previous"]').disabled=feed.slide<=0;
  root.querySelector('[data-action="poster-next"]').disabled=feed.slide>=feed.rows.length-1;
  var autoplay=root.querySelector('[data-action="poster-autoplay"]');autoplay.textContent=carousel.enabled?'暂停轮播':'继续轮播';autoplay.setAttribute('aria-pressed',String(!carousel.enabled));
  root.querySelector('.mbl-c-carousel-position').setAttribute('aria-live',carousel.enabled?'off':'polite');
  feed.rows.forEach(function(life){if(communityState.posters.has(life.id)||carousel.failures.has(life.id))communityPaintPoster(life.id);});
  communityState.posterWanted=feed.rows[feed.slide]?feed.rows[feed.slide].id:'';
  communityCreatePoster();
  communityCarouselArm();
}
function communityCarouselStop(){if(carousel.timer!==null){clearTimeout(carousel.timer);carousel.timer=null;}}
function communityCarouselPause(){carousel.pauseUntil=Date.now()+8000;communityCarouselStop();}
function communityCarouselArm(){
  communityCarouselStop();
  if(announcementMaybe())return;
  var root=communityState.root,feed=communityState.feeds.community;
  if(!carousel.enabled||!carousel.inView||carousel.drag||carousel.touching||document.visibilityState==='hidden'||!root||!root.isConnected||communityState.tab!=='community'||feed.rows.length<2||feed.busy||communityState.posterBusy||UI.backdrop&&!UI.backdrop.hidden||UI.storyBackdrop&&!UI.storyBackdrop.hidden||UI.adBackdrop&&!UI.adBackdrop.hidden||creditsView.root&&!creditsView.closed)return;
  carousel.timer=setTimeout(function(){carousel.timer=null;communityMove(1,true);},Math.max(4500,carousel.pauseUntil-Date.now()));
}
function communityCarouselBind(list,target){
  if(typeof IntersectionObserver==='function'){
    carousel.inView=false;
    carousel.observer=new IntersectionObserver(function(entries){carousel.inView=entries.some(function(e){return e.isIntersecting&&e.intersectionRatio>=0.08;});communityCarouselArm();},{threshold:[0,0.08]});carousel.observer.observe(target);
  }
  list.addEventListener('pointerdown',function(e){
    if(communityState.tab!=='community'||e.pointerType==='touch'||e.button!==0)return;
    carousel.drag={id:e.pointerId,x:e.clientX,left:list.scrollLeft,moved:false,list:list};communityCarouselPause();
  });
  list.addEventListener('pointermove',function(e){
    var drag=carousel.drag;if(!drag||drag.id!==e.pointerId)return;var dx=e.clientX-drag.x;
    if(!drag.moved&&Math.abs(dx)>7){drag.moved=true;list.classList.add('is-dragging');list.style.scrollSnapType='none';try{list.setPointerCapture(e.pointerId);}catch(_){}}
    if(drag.moved){e.preventDefault();list.scrollLeft=drag.left-dx;carousel.suppressClickUntil=Date.now()+500;}
  });
  list.addEventListener('touchstart',function(){if(communityState.tab==='community'){carousel.touching=true;communityCarouselPause();}},{passive:true});
  function touchEnd(){carousel.touching=false;communityCarouselPause();communityCarouselArm();}
  list.addEventListener('touchend',touchEnd,{passive:true});list.addEventListener('touchcancel',touchEnd,{passive:true});
  list.addEventListener('wheel',function(){if(communityState.tab==='community'){communityCarouselPause();communityCarouselArm();}},{passive:true});
  if(!carousel.lifecycle){
    carousel.lifecycle=true;
    function dragEnd(e){
      var drag=carousel.drag;if(!drag||drag.id!==e.pointerId)return;carousel.drag=null;var track=drag.list;
      track.classList.remove('is-dragging');track.style.scrollSnapType='';try{track.releasePointerCapture(e.pointerId);}catch(_){}
      if(drag.moved){carousel.suppressClickUntil=Date.now()+500;var feed=communityState.feeds.community;feed.slide=Math.max(0,Math.min(feed.rows.length-1,Math.round(track.scrollLeft/Math.max(1,track.clientWidth))));communityMove(0);}
      communityCarouselPause();communityCarouselArm();
    }
    window.addEventListener('pointerup',dragEnd);window.addEventListener('pointercancel',dragEnd);
    window.addEventListener('blur',function(){var drag=carousel.drag;if(drag){drag.list.classList.remove('is-dragging');drag.list.style.scrollSnapType='';carousel.drag=null;}carousel.touching=false;communityCarouselPause();communityCarouselArm();});
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'){carousel.touching=false;communityCarouselStop();}else communityCarouselArm();});
    window.addEventListener('pagehide',communityCarouselStop);window.addEventListener('pageshow',communityCarouselArm);
  }
}
async function communityDetail(id){
  if(communityState.details.has(id))return communityState.details.get(id);
  if(communityState.detailRequests.has(id))return communityState.detailRequests.get(id);
  var request=(async function(){
    var life=await api('/api/lives/'+encodeURIComponent(id),'GET',undefined,false);
    if(!life||typeof life!=='object'||!life.card)throw error('这段生涯暂时无法读取，请稍后刷新。');
    communityState.details.set(id,life);
    if(communityState.details.size>3)communityState.details.delete(communityState.details.keys().next().value);
    return life;
  })();
  communityState.detailRequests.set(id,request);
  try{return await request;}finally{communityState.detailRequests.delete(id);}
}
function communityPaintPoster(id){
  var root=communityState.root,state=communityState.posters.get(id);if(!root)return;
  root.querySelectorAll('.mbl-c-poster-imagebox').forEach(function(box){
    if(box.dataset.posterId!==id)return;
    if(!state){box.replaceChildren(node('span',carousel.failures.has(id)?'海报暂未生成，点击重试。':'滑动到此处查看生涯海报','mbl-c-poster-placeholder'));return;}
    if(state.url){
      if(box.querySelector('img'))return;
      var img=node('img',undefined,'mbl-c-poster-image');img.alt='篮球人生黑色片尾海报';img.src=state.url;img.draggable=false;box.replaceChildren(img);
    }else box.replaceChildren(node('span',state.error?'海报暂未生成，点击重试。':'正在生成片尾海报…','mbl-c-poster-placeholder'));
  });
}
function communityTrimPosters(){
  while(communityState.posters.size>3){
    var pinned=UI.storyBackdrop&&!UI.storyBackdrop.hidden?communityState.storyId:'';
    var discard=Array.from(communityState.posters.keys()).find(function(key){return key!==communityState.posterWanted&&key!==pinned&&!communityState.posterRequests.has(key);});
    if(!discard)break;var entry=communityState.posters.get(discard);if(entry.url)URL.revokeObjectURL(entry.url);communityState.posters.delete(discard);communityPaintPoster(discard);
  }
}
async function communityPosterUrl(id){
  var old=communityState.posters.get(id);if(old&&old.url)return old.url;
  if(communityState.posterRequests.has(id))return communityState.posterRequests.get(id);
  var request=(async function(){
    communityState.posters.set(id,{pending:true});communityPaintPoster(id);
    var life=await communityDetail(id);
    if(!window.MBLHost||typeof window.MBLHost.communityPoster!=='function')throw error('当前页面暂不支持生成生涯海报。');
    var blob=await within(window.MBLHost.communityPoster(life),25000);
    if(!(blob instanceof Blob)||!blob.size)throw error('海报生成未完成。');
    var url=URL.createObjectURL(blob);communityState.posters.set(id,{url:url});carousel.failures.delete(id);return url;
  })();
  communityState.posterRequests.set(id,request);
  try{return await request;}
  catch(e){communityState.posters.set(id,{error:true});carousel.failures.add(id);throw e;}
  finally{communityState.posterRequests.delete(id);communityTrimPosters();communityPaintPoster(id);}
}
async function communityCreatePoster(){
  var id=communityState.posterWanted,old=communityState.posters.get(id);
  if(!id||communityState.posterBusy||carousel.failures.has(id)||old&&(old.url||old.error))return;
  communityState.posterBusy=true;communityState.posters.set(id,{pending:true});communityPaintPoster(id);
  try{
    await communityPosterUrl(id);
  }catch(e){communityState.posters.set(id,{error:true});carousel.failures.add(id);}
  finally{
    var entry=communityState.posters.get(id);if(entry&&entry.pending)communityState.posters.delete(id);
    communityState.posterBusy=false;communityPaintPoster(id);
    if(communityState.posterWanted&&communityState.posterWanted!==id)communityCreatePoster();
    communityCarouselArm();
  }
}

/* Enlarges the exact cached community poster; no metadata, actions or timeline. */
function communityStoryMount() {
  if (UI.storyBackdrop) return;
  UI.storyBackdrop = node('div', undefined, 'mbl-platform mbl-p-backdrop mbl-c-story-backdrop'); UI.storyBackdrop.hidden = true;
  UI.storyDialog = node('article', undefined, 'mbl-p-dialog mbl-c-story'); UI.storyDialog.setAttribute('role','dialog'); UI.storyDialog.setAttribute('aria-modal','true'); UI.storyDialog.setAttribute('aria-labelledby','mbl-story-title'); UI.storyDialog.tabIndex = -1;
  var head = node('div', undefined, 'mbl-p-header'); UI.storyTitle = node('h2', '生涯海报'); UI.storyTitle.id = 'mbl-story-title';
  head.append(UI.storyTitle, button('关闭','story-close')); UI.storyContent = node('div', undefined, 'mbl-p-content mbl-c-story-content');
  UI.storyDialog.append(head, UI.storyContent); UI.storyBackdrop.append(UI.storyDialog); document.body.append(UI.storyBackdrop);
  UI.storyBackdrop.addEventListener('click',function (e) {
    if(e.target===UI.storyBackdrop){communityCloseStory();return;}
    var t=e.target.closest('[data-action]');if(!t)return;
    if(t.dataset.action==='story-close')communityCloseStory();
    if(t.dataset.action==='story-retry')communityOpenStory(communityState.storyId,true);
  });
}
function communityCloseStory() {
  communityState.storyEpoch++; if (UI.storyBackdrop) UI.storyBackdrop.hidden = true;
  if(UI.storyContent)UI.storyContent.replaceChildren();communityState.storyId='';communityTrimPosters();
  var previous = communityState.focusBefore; communityState.focusBefore=null;
  if(previous&&previous.isConnected)previous.focus();
  communityCarouselPause();communityCarouselArm();
}
async function communityOpenStory(id, retry) {
  if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))return;
  communityCarouselStop();
  communityStoryMount(); if (!retry) communityState.focusBefore=document.activeElement;
  var epoch=++communityState.storyEpoch;communityState.storyId=id;
  UI.storyBackdrop.hidden=false;UI.storyTitle.textContent='生涯海报';UI.storyContent.replaceChildren(node('p','正在打开海报…'));UI.storyDialog.setAttribute('aria-busy','true');UI.storyDialog.focus();
  try{
    var url=await communityPosterUrl(id);if(epoch!==communityState.storyEpoch)return;
    var life=communityState.details.get(id),image=node('img',undefined,'mbl-c-expanded-poster');
    UI.storyTitle.textContent=(life&&plain(life.name)||'篮球人生')+'的生涯海报';
    image.alt=UI.storyTitle.textContent;image.src=url;image.draggable=false;UI.storyContent.replaceChildren(image);UI.storyContent.scrollTop=0;
  }catch(e){if(epoch===communityState.storyEpoch)UI.storyContent.replaceChildren(node('p',e.message||'海报暂时未能打开。'),button('重试打开海报','story-retry'));}
  finally{if(epoch===communityState.storyEpoch)UI.storyDialog.setAttribute('aria-busy','false');}
}
function communityStoryKeys(e){
  if(!UI.storyBackdrop||UI.storyBackdrop.hidden)return false;
  if(e.key==='Escape'){e.preventDefault();communityCloseStory();return true;}
  if(e.key==='Tab'){
    var buttons=Array.from(UI.storyDialog.querySelectorAll('button:not([disabled])')).filter(function(x){return !x.hidden;});
    var first=buttons[0],last=buttons[buttons.length-1];
    if(e.shiftKey&&(document.activeElement===first||document.activeElement===UI.storyDialog)){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===UI.storyDialog)){e.preventDefault();first.focus();}
  }
  return true;
}

/* SDK-confirmed rewards, account cloud persistence and explicit user-driven playback. */
var AD = { rows: [], accountKey: '', ready: false, busy: false, context: null, focus: null,
  pending: [], recovered: null, taskStarted: false, taskWarning: '', noticeTimer: null };
function adsClearDirectNotice(){if(AD.noticeTimer!==null){clearTimeout(AD.noticeTimer);AD.noticeTimer=null;}if(UI.memberActionNotice)UI.memberActionNotice.hidden=true;}
function adsDirectNotice(text){
  adsClearDirectNotice();
  if(!UI.memberActionNotice){UI.memberActionNotice=node('p',undefined,'mbl-member-action-status');UI.memberActionNotice.setAttribute('role','status');UI.memberActionNotice.setAttribute('aria-live','polite');UI.memberActionNotice.setAttribute('aria-atomic','true');document.body.append(UI.memberActionNotice);}
  UI.memberActionNotice.textContent=String(text||'操作未完成，请稍后重试。').slice(0,400);UI.memberActionNotice.hidden=false;
  AD.noticeTimer=setTimeout(function(){AD.noticeTimer=null;if(UI.memberActionNotice)UI.memberActionNotice.hidden=true;},6000);
}
function adsUuid() {
  var c=window.crypto;
  if(c&&typeof c.randomUUID==='function')return c.randomUUID();
  if(!c||typeof c.getRandomValues!=='function')throw error('当前客户端暂不支持广告奖励，请更新后重试。');
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,function(x){return(Number(x)^c.getRandomValues(new Uint8Array(1))[0]&15>>Number(x)/4).toString(16);});
}
function adsApply(rows) {
  AD.rows=(Array.isArray(rows)?rows:[]).filter(function(r){return r&&typeof r.id==='string'&&typeof r.scope==='string'&&r.source==='sdk_callback'&&['birth_reroll','fast_tools','trade','annual_training','birth_perk'].includes(r.target);});
  AD.accountKey=S.accountKey;AD.ready=!!S.accountKey;
  if(window.MBLHost&&typeof window.MBLHost.setAdEntitlements==='function')window.MBLHost.setAdEntitlements(AD.rows);
}
function adsReset() { AD.ready=false;AD.accountKey='';AD.rows=[];if(window.MBLHost&&window.MBLHost.setAdEntitlements)window.MBLHost.setAdEntitlements([]); }
function adsMerge(row) {
  if(!row||typeof row.id!=='string'||row.source!=='sdk_callback'||typeof row.scope!=='string'||!['birth_reroll','fast_tools','trade','annual_training','birth_perk'].includes(row.target))throw error('广告权益保存结果未确认，请重试领取。');
  adsApply([row].concat(AD.rows.filter(function(r){return r.id!==row.id;})));
  return row;
}
function adsQueueLoad() {
  try{var data=JSON.parse(window.MBLMemoryStore.getItem('mbl.platform.ad-pending.v1')||'[]');AD.pending=Array.isArray(data)?data.filter(function(r){return r&&typeof r.id==='string'&&typeof r.accountKey==='string'&&['reward','use'].includes(r.stage);}).slice(-60):[];}
  catch(_){AD.pending=[];}
}
function adsQueueSave(){try{window.MBLMemoryStore.setItem('mbl.platform.ad-pending.v1',JSON.stringify(AD.pending));}catch(_){/* In-memory recovery remains available until this page closes. */}}
function adsQueuePut(row){AD.pending=AD.pending.filter(function(r){return r.id!==row.id;}).concat(row).slice(-60);adsQueueSave();return row;}
function adsQueueRemove(id){AD.pending=AD.pending.filter(function(r){return r.id!==id;});adsQueueSave();}
function adsOwnPending(ctx){return AD.pending.find(function(r){return r.appId===config().appId&&r.accountKey===S.accountKey&&r.target===ctx.target&&r.scope===ctx.scope&&(r.stage==='reward'||r.context&&r.context.seed===ctx.seed&&r.context.roundId===ctx.roundId);});}
function adsAvailable(ctx){return AD.rows.find(function(r){return r.target===ctx.target&&r.scope===ctx.scope&&(ctx.target!=='birth_reroll'||!r.consumed);});}
async function adsLoad(){var r=await api('/api/player/ads','GET',undefined,true);if(!r||!Array.isArray(r.entitlements))throw error('广告权益暂未读取，请稍后重试。');adsApply(r.entitlements);}
async function adsTaskState(){
  var bridge=sdk();if(!bridge.vatask||typeof bridge.vatask.getActivityTaskState!=='function'){AD.taskWarning='当前客户端暂不支持激励广告。';return;}
  try{var r=await within(bridge.vatask.getActivityTaskState());AD.taskWarning=r&&r.code===200?'':r&&r.message||'广告任务状态暂未刷新。';}
  catch(e){AD.taskWarning=e.message||'广告任务状态暂未刷新。';}
}
function adsTitle(ctx){if(ctx.target==='birth_perk'){var ids=['height','talent','starter','health','family','discipline'];return ['身高优势','篮球天赋','篮球启蒙','强健体魄','殷实家境','自律性格'][ids.indexOf(ctx.scope.split(':').pop())]||'出生加成';}return ctx.target==='annual_training'?'随机特训':ctx.target==='birth_reroll'?(ctx.value==='CN'?'中国出生':'随机重随'):ctx.target==='fast_tools'?'解锁16倍速与自动':'解锁主动要求交易';}
function adsMount(){
  if(UI.adBackdrop)return;
  UI.adBackdrop=node('div',undefined,'mbl-platform mbl-p-backdrop mbl-ad-backdrop');UI.adBackdrop.hidden=true;
  UI.adDialog=node('article',undefined,'mbl-p-dialog mbl-ad-dialog');UI.adDialog.setAttribute('role','dialog');UI.adDialog.setAttribute('aria-modal','true');UI.adDialog.setAttribute('aria-labelledby','mbl-ad-title');UI.adDialog.tabIndex=-1;
  var head=node('div',undefined,'mbl-p-header');UI.adTitle=node('h2');UI.adTitle.id='mbl-ad-title';UI.adCancel=button('取消','ad-cancel');head.append(UI.adTitle,UI.adCancel);
  UI.adInfo=node('p',undefined,'mbl-p-notice');UI.adInfo.setAttribute('role','status');UI.adInfo.setAttribute('aria-live','polite');
  var body=node('div',undefined,'mbl-p-content');UI.adDetail=node('p');UI.adWatch=button('看视频解锁','ad-watch');body.append(UI.adDetail,UI.adWatch);UI.adDialog.append(head,UI.adInfo,body);UI.adBackdrop.append(UI.adDialog);document.body.append(UI.adBackdrop);
  UI.adBackdrop.addEventListener('click',function(e){var el=e.target.closest('[data-action]');if(!el||el.disabled)return;if(el.dataset.action==='ad-cancel')adsClose(true);if(el.dataset.action==='ad-watch')adsConfirm();});
}
function adsLabels(){
  if(!AD.context||!UI.adWatch)return;
  var pending=adsOwnPending(AD.context),available=adsAvailable(AD.context);
  UI.adWatch.textContent=pending?'继续领取（无需重复看视频）':available?'使用已到账权益':!S.account?'登录虎扑并继续':AD.context.target==='birth_perk'?'看视频点亮':AD.context.target==='annual_training'?'看视频，随机特训':AD.context.target==='birth_reroll'?(AD.context.value==='CN'?'看视频，中国出生':'看视频，随机重随'):'看视频解锁本人生';
  UI.adWatch.disabled=AD.busy;UI.adCancel.disabled=AD.busy;UI.adDialog.setAttribute('aria-busy',String(AD.busy));
  if(AD.context.passOwned)UI.adWatch.textContent=AD.busy?'正在领取…':'免广告领取';
}
async function adsRequest(ctx){
  adsClearDirectNotice();
  try{if(window.MBLPassAccess){ctx.passOwned=await window.MBLPassAccess.authorize('ad_free');if(!window.MBLHost.adContextValid(ctx)){window.MBLHost.finishAdAction(ctx,false);return;}}}
  catch(e){window.MBLHost.finishAdAction(ctx,false);adsDirectNotice(e&&e.message||'会员状态暂未确认，请重试。');return;}
  adsMount();if(AD.context||AD.busy){if(window.MBLHost)window.MBLHost.finishAdAction(ctx,false);return;}
  var recovering=ctx.target==='birth_reroll'&&AD.pending.find(function(p){return p.stage==='use'&&p.appId===config().appId&&p.accountKey===S.accountKey&&p.target===ctx.target&&p.scope===ctx.scope&&p.context?.seed===ctx.seed&&p.context?.roundId===ctx.roundId;});
  if(recovering){ctx.value=recovering.context.value;ctx.birthSeed=recovering.context.birthSeed;}
  ctx.directPass=ctx.passOwned===true;AD.context=ctx;AD.focus=document.activeElement;communityCarouselStop();
  UI.adTitle.textContent=adsTitle(ctx);UI.adInfo.textContent=recovering?'上次'+adsTitle(ctx)+'尚未完成，请先继续领取，无需重复看视频。':AD.taskWarning||'完成视频后获得权益，取消或未完成不会解锁。';UI.adInfo.classList.remove('mbl-p-error');
  UI.adDetail.hidden=ctx.target==='birth_perk';UI.adDetail.textContent=ctx.target==='annual_training'?'随机强化最多两项球技，每项提升5～10点，最高99。每个游戏年可参加一次，项目由系统随机决定。':ctx.target==='birth_reroll'?(ctx.value==='CN'?'出生地固定为中国，城市、姓名、家庭与天赋按原版规则随机生成。':'从全部原版出生地区随机生成新的角色。')+'一条视频重随一次，将替换当前角色并重置出生加成。'+(ctx.hasBirthPerks?'当前角色已有点亮的出生加成，重随后需要重新获取。':''):ctx.target==='fast_tools'?'本人生一次解锁16倍速与自动模式。自动模式会自行选择抉择；1—8倍速继续免费。':'本人生一次解锁主动申请交易，仍受原有资格和每年申请次数限制；申请结果按原规则决定。';
  // A valid member's original click is the action. Keep the reward dialog
  // hidden and execute through the existing guarded/acknowledged claim path.
  if(ctx.directPass){await adsConfirm();return;}
  UI.adBackdrop.hidden=false;adsLabels();UI.adDialog.focus();if(ctx.target==='birth_perk')adsConfirm();
}
function adsClose(cancel){
  if(AD.busy)return;
  var ctx=AD.context;AD.context=null;if(UI.adBackdrop)UI.adBackdrop.hidden=true;
  if(cancel&&ctx&&window.MBLHost)window.MBLHost.finishAdAction(ctx,false);
  if(AD.focus&&AD.focus.isConnected)AD.focus.focus();AD.focus=null;communityCarouselArm();
}
function adsKeys(e){
  if(!UI.adBackdrop||UI.adBackdrop.hidden)return false;
  if(e.key==='Escape'){e.preventDefault();if(!AD.busy)adsClose(true);return true;}
  if(e.key==='Tab'){var items=[UI.adCancel,UI.adWatch].filter(function(el){return!el.disabled;});if(!items.length){e.preventDefault();UI.adDialog.focus();return true;}var first=items[0],last=items[items.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===UI.adDialog)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===UI.adDialog)){e.preventDefault();first.focus();}return true;}
  return true;
}
async function adsSaveReward(pending){var result=await api('/api/player/ads/reward','POST',{intentId:pending.intentId,confirmation:'sdk_callback'},true);var row=result&&result.entitlement;if(!row||row.target!==pending.target||row.scope!==pending.scope)throw error('广告权益范围未确认，请继续领取。');return adsMerge(row);}
async function adsConfirm(){
  if(AD.busy||!AD.context)return;
  var ctx=AD.context,token,entitlement,pending;
  if(S.busy){if(ctx.directPass){adsClose(true);adsDirectNotice('正在连接账号，请稍候再点一次。');}else UI.adInfo.textContent='正在连接账号，请稍候再点一次。';return;}
  AD.busy=true;adsLabels();setBusy(ctx.directPass?'正在使用会员权益':'正在处理广告奖励');
  try{
    var bridge=sdk();
    if(!S.account)await loginAccount();else if(!S.loaded)await refreshAccount();
    if(S.restoring||S.conflict){AD.busy=false;adsClose(true);throw error('请先选定要继续的进度，再使用广告功能。');}
    token=capture();assertAccount(token);
    if(ctx.passOwned){
      var ownedNow=await window.MBLPassAccess.authorize('ad_free');
      assertAccount(token);
      if(!window.MBLHost.adContextValid(ctx))throw error('当前人生或操作条件已变化。');
      if(!ownedNow){ctx.passOwned=false;ctx.directPass=false;UI.adInfo.textContent='通行卡暂未确认有效，可继续使用视频领取。';UI.adBackdrop.hidden=false;adsLabels();UI.adDialog.focus();return;}
      if(ctx.target==='birth_reroll')window.MBLHost.prepareAdBirth(ctx);
      if(['annual_training','birth_perk'].includes(ctx.target)){
        if(S.saveFlight)await S.saveFlight;await syncLocal(true);assertAccount(token);
        if(!window.MBLHost.adContextValid(ctx))throw error('当前年份已变化，未领取权益。');
        const testGrant=window.MBLPassAccess.state().source==='operator_grant';
        const paid=await api('/api/player/pass/benefit','POST',{target:ctx.target,scope:ctx.scope,confirmation:testGrant?'operator_grant':'sdk_owned'},true);assertAccount(token);
        if(paid?.source!==(testGrant?'operator_grant':'game_pass_sdk'))throw error('通行卡领取结果未确认，请重试。');
        if(ctx.target==='birth_perk'){
          await birthPerksAdopt({scope:ctx.scope.slice(0,ctx.scope.lastIndexOf(':')),seed:ctx.seed},paid,token);
          AD.busy=false;adsClose(false);window.MBLHost.finishAdAction(ctx,false);return;
        }
        if(!paid?.state?.payload||!Number.isSafeInteger(paid.state.revision)||!paid.result)throw error('特训结果未确认，请重试。');
        await window.MBLHost.applyTrainingState(ctx,paid.state,paid.result);assertAccount(token);
        S.remote=canonical(paid.state.payload);S.base=S.remote;S.revision=paid.state.revision;S.localDirty=!sameEntries(snapshot(),S.remote);S.choice='';S.conflict=false;enableManaged();
        AD.busy=false;adsClose(false);message('特训已完成，球技和进度已保存。');return;
      }
      const done=window.MBLHost.finishAdAction(ctx,true);AD.busy=false;adsClose(false);
      if(!done)message('当前操作已变化，请重试。',true);return;
    }
    if(!AD.ready||AD.accountKey!==S.accountKey)await adsLoad();
    if(!window.MBLHost.adContextValid(ctx))throw error('当前人生或操作条件已变化，暂未使用权益。');
    if(ctx.target==='birth_reroll')window.MBLHost.prepareAdBirth(ctx);
    if(['annual_training','birth_perk'].includes(ctx.target)){if(S.saveFlight)await S.saveFlight;await syncLocal(true);assertAccount(token);if(!window.MBLHost.adContextValid(ctx))throw error('当前年份已变化，未播放广告。');}
    pending=adsOwnPending(ctx);
    if(pending){
      if(pending.stage==='reward'){entitlement=await adsSaveReward(pending);adsQueueRemove(pending.id);pending=null;}
      else{entitlement=AD.rows.find(function(r){return r.id===pending.entitlementId;});if(!entitlement){await adsLoad();entitlement=AD.rows.find(function(r){return r.id===pending.entitlementId;});}}
    }
    if(!entitlement)entitlement=adsAvailable(ctx);
    if(!entitlement){
      if(!bridge.vatask||typeof bridge.vatask.completeRewardVideo!=='function')throw error('请在支持激励广告的虎扑App内使用。');
      UI.adInfo.textContent='正在准备广告…';
      var intent=await api('/api/player/ads/intent','POST',{target:ctx.target,scope:ctx.scope,operationId:adsUuid()},true);
      if(!intent||typeof intent.intentId!=='string')throw error('广告准备未完成，请稍后重试。');
      entitlement=intent.entitlement?adsMerge(intent.entitlement):null;
      if(!entitlement){
        if(!window.MBLHost.adContextValid(ctx))throw error('操作条件已变化，未播放广告。');
        UI.adInfo.textContent='请完成视频，等待奖励确认。';
        var reward=await bridge.vatask.completeRewardVideo();
        if(!reward||reward.code!==200||!reward.data||reward.data.rewarded!==true)throw error(reward&&reward.message||'视频未完成，本次没有解锁。');
        assertAccount(token);
        pending=adsQueuePut({id:intent.intentId,stage:'reward',appId:config().appId,accountKey:S.accountKey,intentId:intent.intentId,target:ctx.target,scope:ctx.scope,context:ctx});
        UI.adInfo.textContent='奖励已由平台确认，正在保存…';
        var refresh=adsTaskState();
        entitlement=await adsSaveReward(pending);adsQueueRemove(pending.id);pending=null;
        await refresh;
      }
    }
    assertAccount(token);
    if(!window.MBLHost.adContextValid(ctx))throw error('权益已保存到账号，当前人生或操作条件已变化，尚未执行操作。');
    if(ctx.target==='birth_reroll'){
      if(!pending||pending.stage!=='use')pending=adsQueuePut({id:'use-'+entitlement.id,stage:'use',appId:config().appId,accountKey:S.accountKey,entitlementId:entitlement.id,operationId:adsUuid(),target:ctx.target,scope:ctx.scope,context:ctx});
      var used=await api('/api/player/ads/use','POST',{entitlementId:entitlement.id,operationId:pending.operationId},true);
      entitlement=adsMerge(used&&used.entitlement);
      if(!entitlement.consumed||entitlement.consumedOperationId!==pending.operationId)throw error('重抽使用结果未确认，请继续领取。');
    }
    if(ctx.target==='birth_perk'){
      var applied=await api('/api/player/ads/birth-perk','POST',{entitlementId:entitlement.id},true);assertAccount(token);
      await birthPerksAdopt({scope:ctx.scope.slice(0,ctx.scope.lastIndexOf(':')),seed:ctx.seed},applied,token);
      AD.busy=false;adsClose(false);window.MBLHost.finishAdAction(ctx,false);return;
    }
    if(ctx.target==='annual_training'){
      var trained=await api('/api/player/ads/training','POST',{entitlementId:entitlement.id},true);assertAccount(token);
      if(!trained?.state?.payload||!Number.isSafeInteger(trained.state.revision)||!trained.result)throw error('特训结果尚未确认，请继续领取。');
      await window.MBLHost.applyTrainingState(ctx,trained.state,trained.result);assertAccount(token);
      S.remote=canonical(trained.state.payload);S.base=S.remote;S.revision=trained.state.revision;S.localDirty=!sameEntries(snapshot(),S.remote);S.choice='';S.conflict=false;enableManaged();
      AD.busy=false;adsClose(false);message('特训已完成，球技和进度已保存。');return;
    }
    assertAccount(token);
    var done=window.MBLHost.finishAdAction(ctx,true);
    if(done&&pending)adsQueueRemove(pending.id);
    AD.busy=false;adsClose(false);
    if(!done)message('权益已保存，但当前操作已变化，请返回相应人生后继续。',true);
    else if(AD.taskWarning)message('权益已保存并使用。'+AD.taskWarning,true);
  }catch(e){
    AD.ready=false;
    if(e&&e.status===409&&pending&&pending.stage==='use'){
      try{await adsLoad();var other=AD.rows.find(function(r){return r.id===pending.entitlementId;});if(other&&other.consumed&&other.consumedOperationId!==pending.operationId)adsQueueRemove(pending.id);}catch(_){}
    }
    if(ctx.directPass){AD.busy=false;adsClose(true);adsDirectNotice(e&&e.message||'操作未完成，请稍后重试。');}
    else{if(UI.adInfo){UI.adInfo.textContent=e&&e.message||'操作未完成，请稍后重试。';UI.adInfo.classList.add('mbl-p-error');}if(!AD.context)message(e&&e.message||'操作未完成，请稍后重试。',true);}
  }finally{AD.busy=false;adsLabels();setBusy('');renderSync();scheduleAuto();scheduleCareer();}
}
async function adsAccountReady(){
  if(!AD.taskStarted){AD.taskStarted=true;adsTaskState();}
  var own=AD.pending.filter(function(p){return p.appId===config().appId&&p.accountKey===S.accountKey;}).slice(0,10);
  for(var p of own){
    try{
      if(p.stage==='reward'){await adsSaveReward(p);adsQueueRemove(p.id);}
      else{
        var used=await api('/api/player/ads/use','POST',{entitlementId:p.entitlementId,operationId:p.operationId},true);adsMerge(used&&used.entitlement);
        if(!AD.context&&window.MBLHost.recoverAdBirth(p.context))adsRequest(p.context);
        else if(!window.MBLHost.adContextValid(p.context))adsQueueRemove(p.id);
      }
    }catch(_){break;}
  }
}
adsQueueLoad();

/* Bounded, visible-page telemetry; all displayed figures come from this app's backend. */
var LIVE={root:null,data:null,receivedAt:0,offset:0,timer:null,inFlight:false,budget:120,stopped:false,error:'',session:'',queue:[],unbound:[],mounted:false,accountKey:''};
function liveSession(){
  if(LIVE.session)return LIVE.session;
  try{LIVE.session=window.MBLMemoryStore.getItem('mbl.platform.live-session.v1')||adsUuid();window.MBLMemoryStore.setItem('mbl.platform.live-session.v1',LIVE.session);}
  catch(_){LIVE.session=adsUuid();}return LIVE.session;
}
function liveQueueLoad(){try{var list=JSON.parse(window.MBLMemoryStore.getItem('mbl.platform.birth-queue.v1')||'[]');LIVE.queue=Array.isArray(list)?list.filter(function(r){return r&&typeof r.accountKey==='string'&&r.data&&typeof r.data.lifeId==='string'&&Number.isFinite(r.at);}).slice(-20):[];}catch(_){LIVE.queue=[];}}
function liveQueueSave(){try{window.MBLMemoryStore.setItem('mbl.platform.birth-queue.v1',JSON.stringify(LIVE.queue));}catch(_){}}
function liveAgo(value){var ms=Date.parse(value),now=Date.now()+LIVE.offset;if(!Number.isFinite(ms))return'';var minutes=Math.max(0,Math.floor((now-ms)/60000));return minutes<1?'刚刚':minutes<60?minutes+'分钟前':minutes<1440?Math.floor(minutes/60)+'小时前':Math.floor(minutes/1440)+'天前';}
function liveRender(){
  var root=LIVE.root;if(!root||!root.isConnected)return;
  if(LIVE.error){root.textContent=LIVE.error;return;}
  if(!LIVE.data){root.textContent='正在读取真实动态…';return;}
  if(Date.now()-LIVE.receivedAt>120000){root.textContent='动态已暂停，点击刷新';return;}
  var data=LIVE.data,nums=node('span',undefined,'mbl-live-numbers'),dot=node('span','', 'mbl-live-dot');dot.setAttribute('aria-hidden','true');
  nums.append(dot,node('strong',data.playing+'人正在玩'),node('span','今天有'+data.bornToday+'个新生命'));
  var recent=Array.isArray(data.recent)?data.recent[0]:null,feed=node('span',undefined,'mbl-live-feed');
  if(recent){
    var country=window.MBLHost.activityCountry(recent.country),flagCode=['CN','TW','HK','MO'].includes(recent.country)?'CN':recent.country;
    var flag=/^[A-Z]{2}$/.test(flagCode)?String.fromCodePoint.apply(String,flagCode.split('').map(function(c){return 127397+c.charCodeAt(0);})):'';
    feed.append(node('span',flag),node('span','一名'+(recent.sex==='female'?'女婴':'男婴')+'在'+country+'出生了'),node('span','· '+liveAgo(recent.createdAt)));
  }else feed.append(node('span','暂无出生记录'));
  root.replaceChildren(nums,feed);
}
function liveMount(){
  var root=document.querySelector('[data-mbl-live]');if(!root)return;
  if(LIVE.root!==root){LIVE.root=root;root.type='button';root.setAttribute('aria-label','刷新真实在线人数与出生动态');root.title='近2分钟前台游戏账号去重；今日按北京时间统计成功上报的首次开始人生，重抽不计。点击刷新。';root.addEventListener('click',function(){liveWake(true);});liveRender();}
}
function liveAccept(data){
  if(!data||!Number.isSafeInteger(data.playing)||data.playing<0||!Number.isSafeInteger(data.bornToday)||data.bornToday<0||!Array.isArray(data.recent)||!Number.isFinite(Date.parse(data.serverNow)))throw error('实时动态返回异常，点击重试');
  LIVE.data=data;LIVE.receivedAt=Date.now();LIVE.offset=Date.parse(data.serverNow)-Date.now();LIVE.error='';liveRender();
}
function liveStop(){if(LIVE.timer!==null){clearTimeout(LIVE.timer);LIVE.timer=null;}}
function liveArm(delay){
  liveStop();if(LIVE.stopped||document.visibilityState==='hidden')return;
  if(LIVE.budget<=0){LIVE.timer=setTimeout(function(){LIVE.timer=null;LIVE.stopped=true;LIVE.error='动态已暂停，点击刷新';liveRender();},120000);return;}
  LIVE.timer=setTimeout(function(){LIVE.timer=null;liveTick(false);},delay===undefined?30000:delay);
}
async function liveFlush(){
  if(!S.account||!S.accountKey||!S.loaded||S.changedAccount||S.conflict)return;
  LIVE.queue=LIVE.queue.filter(function(r){return Date.now()-r.at<=300000;});liveQueueSave();
  var own=LIVE.queue.filter(function(r){return r.accountKey===S.accountKey;}).slice(0,10);
  for(var item of own){
    liveAccept(await api('/api/player/births','POST',item.data,true));
    LIVE.queue=LIVE.queue.filter(function(r){return r!==item;});liveQueueSave();
  }
}
async function liveTick(accountReady){
  if(LIVE.inFlight||document.visibilityState==='hidden'||LIVE.budget<=0||LIVE.stopped)return;
  LIVE.budget--;
  if(S.busy&&!accountReady){liveArm(5000);return;}
  LIVE.inFlight=true;
  try{
    if(S.account&&S.loaded&&S.accountKey&&!S.changedAccount&&!S.conflict){
      await liveFlush();
      var context=window.MBLHost.activityContext();
      liveAccept(await api('/api/player/presence','POST',{sessionId:liveSession(),playing:context.playing},true));
    }else liveAccept(await api('/api/live','GET',undefined,false));
  }catch(e){LIVE.stopped=true;LIVE.error=window.ColorboxAI?'实时动态暂不可用，点击重试':'在虎扑内打开可查看真实动态';liveRender();}
  finally{LIVE.inFlight=false;if(LIVE.wakePending){LIVE.wakePending=false;LIVE.stopped=false;LIVE.error='';liveArm(0);}else liveArm();}
}
function liveWake(human){
  liveMount();if(human){LIVE.budget=120;LIVE.stopped=false;LIVE.error='';}
  if(!LIVE.inFlight)liveTick(false);
}
async function liveAccountReady(){
  if(S.accountKey&&!S.changedAccount&&!S.conflict){LIVE.unbound.filter(function(r){return r.epoch===S.epoch&&Date.now()-r.at<=300000;}).forEach(function(r){if(!LIVE.queue.some(function(q){return q.accountKey===S.accountKey&&q.data.lifeId===r.data.lifeId;}))LIVE.queue.push({accountKey:S.accountKey,at:r.at,data:r.data});});LIVE.unbound=[];LIVE.queue=LIVE.queue.slice(-20);liveQueueSave();}
  LIVE.budget=120;LIVE.stopped=false;LIVE.error='';if(LIVE.inFlight){LIVE.wakePending=true;return;}await liveTick(true);
}
function liveInit(){
  liveMount();if(LIVE.mounted)return;LIVE.mounted=true;liveQueueLoad();
  window.addEventListener('mbl:birth-started',function(e){
    var r=e.detail;
    if(S.changedAccount||S.conflict||!r)return;
    var data={lifeId:r.lifeId,seed:r.seed,country:r.country,sex:r.sex};
    if(!S.account||!S.accountKey){LIVE.unbound=LIVE.unbound.concat({epoch:S.epoch,at:Date.now(),data:data}).slice(-20);return;}
    if(!LIVE.queue.some(function(item){return item.accountKey===S.accountKey&&item.data.lifeId===data.lifeId;}))LIVE.queue.push({accountKey:S.accountKey,at:Date.now(),data:data});
    LIVE.queue=LIVE.queue.slice(-20);liveQueueSave();liveWake(true);
  });
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')liveStop();else liveWake(true);});
  window.addEventListener('pagehide',liveStop);window.addEventListener('pageshow',function(e){if(e.persisted)liveWake(true);});
  window.addEventListener('online',function(){liveWake(true);});
  function interact(e){if(e.isTrusted&&(LIVE.stopped||LIVE.budget<=0))liveWake(true);}
  document.addEventListener('pointerdown',interact,{passive:true});document.addEventListener('keydown',interact);
  liveWake(false);
}

/* Original-story film credits, with optional canvas image; all remote text uses textContent. */
var creditsView={root:null,focus:null,frame:null,closed:true,url:'',epoch:0,paused:false,hold:0,cleanup:null};
function creditsClose(){
  creditsView.closed=true;creditsView.epoch++;if(creditsView.frame!==null)cancelAnimationFrame(creditsView.frame);creditsView.frame=null;
  if(creditsView.cleanup)creditsView.cleanup();creditsView.cleanup=null;
  if(creditsView.root)creditsView.root.remove();creditsView.root=null;
  if(creditsView.url)URL.revokeObjectURL(creditsView.url);creditsView.url='';
  if(creditsView.focus&&creditsView.focus.isConnected)creditsView.focus.focus();creditsView.focus=null;communityCarouselArm();
}
function creditsShell(title){
  creditsClose();creditsView.closed=false;creditsView.focus=document.activeElement;creditsView.paused=false;creditsView.hold=0;communityCarouselStop();
  var root=node('section',undefined,'mbl-platform credits mbl-credits');root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label',title);root.tabIndex=-1;
  var bar=node('div',undefined,'mbl-credits-bar'),close=button('关闭','credits-close');close.addEventListener('click',creditsClose);bar.append(close);root.append(bar);
  root.addEventListener('keydown',function(e){
    e.stopPropagation();if(e.key==='Escape'){e.preventDefault();creditsClose();return;}
    if(e.key==='Tab'){var items=Array.from(root.querySelectorAll('button,a[href],[tabindex="0"]')).filter(el=>!el.disabled),first=items[0],last=items[items.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===root)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===root)){e.preventDefault();first.focus();}}
  });
  creditsView.root=root;document.body.append(root);root.focus();return{root:root,bar:bar};
}
function creditsShow(life){
  var model;try{model=window.MBLHost.creditsModel(life);}catch(e){message(e.message,true);return;}
  var shell=creditsShell(model.title),roll=node('div',undefined,'credits-roll'),body=node('div',undefined,'credits-body mbl-credits-body');roll.tabIndex=0;
  body.append(node('p',model.starring,'cr-kick'),node('h2',model.name,'cr-name'),node('p',model.years,'cr-years'),node('p',model.title,'cr-head'));
  model.paragraphs.forEach(text=>body.append(node('p',text,'cr-para')));
  if(model.cast.length){body.append(node('p',model.castTitle,'cr-head'));var cast=node('dl',undefined,'cr-cast');model.cast.forEach(pair=>{var row=node('div');row.append(node('dt',pair[0]),node('dd',pair[1]));cast.append(row);});body.append(cast);}
  if(model.epitaph)body.append(node('p',model.epitaph,'cr-epitaph'));body.append(node('p',model.end,'cr-end'));roll.append(body);shell.root.append(roll);
  var image=button('生成长图','credits-image'),pause=button('暂停滚动','credits-pause');image.addEventListener('click',function(){creditsShowImage(life);});pause.addEventListener('click',function(){if(roll.scrollTop>=roll.scrollHeight-roll.clientHeight-2)roll.scrollTop=0;creditsView.paused=!creditsView.paused;pause.textContent=creditsView.paused?'继续滚动':'暂停滚动';arm();});shell.bar.prepend(image,pause);
  function hold(){creditsView.hold=performance.now()+2500;}roll.addEventListener('pointerdown',hold,{passive:true});roll.addEventListener('wheel',hold,{passive:true});roll.addEventListener('touchmove',hold,{passive:true});roll.addEventListener('keydown',hold);
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){creditsView.paused=true;pause.textContent='继续滚动';}
  var last=performance.now();function arm(){if(!creditsView.closed&&creditsView.root===shell.root&&!creditsView.paused&&document.visibilityState!=='hidden'&&creditsView.frame===null){last=performance.now();creditsView.frame=requestAnimationFrame(step);}}
  function step(now){creditsView.frame=null;if(creditsView.closed||creditsView.root!==shell.root||creditsView.paused||document.visibilityState==='hidden')return;var delta=Math.min(.1,(now-last)/1000);last=now;var bottom=Math.max(0,roll.scrollHeight-roll.clientHeight);if(now>=creditsView.hold)roll.scrollTop=Math.min(bottom,roll.scrollTop+delta*35);if(roll.scrollTop>=bottom){creditsView.paused=true;pause.textContent='重新观看';return;}creditsView.frame=requestAnimationFrame(step);}
  function visibility(){if(document.visibilityState==='hidden'){if(creditsView.frame!==null)cancelAnimationFrame(creditsView.frame);creditsView.frame=null;}else arm();}document.addEventListener('visibilitychange',visibility);creditsView.cleanup=function(){document.removeEventListener('visibilitychange',visibility);};arm();
}
async function creditsShowImage(life){
  var model;try{model=window.MBLHost.creditsModel(life);}catch(e){message(e.message,true);return;}
  var shell=creditsShell('人生片尾长图'),epoch=creditsView.epoch,roll=node('div',undefined,'credits-roll mbl-credits-image-roll'),status=node('p','正在生成片尾长图…','mbl-credits-status');roll.tabIndex=0;roll.append(status);shell.root.append(roll);
  try{var blob=await window.MBLHost.creditsCanvas(model);if(creditsView.closed||creditsView.epoch!==epoch)return;if(!(blob instanceof Blob)||!blob.size)throw Error('长图生成未完成，请重试。');creditsView.url=URL.createObjectURL(blob);var img=node('img',undefined,'mbl-credits-image');img.alt=model.name+'的人生片尾长图';img.src=creditsView.url;roll.replaceChildren(img);}
  catch(e){if(!creditsView.closed&&creditsView.epoch===epoch)status.textContent=e.message||'长图生成未完成，请重试。';}
}

/* Cloud announcement content and per-account receipts; never browser persistence. */
var ANN={notice:null,token:null,root:null,dialog:null,body:null,content:null,title:null,status:null,confirm:null,close:null,
  busy:false,reload:false,focus:null,background:[],overflow:''};
function announcementVisible(){return !!ANN.root&&!ANN.root.hidden;}
function announcementHide(){
  if(ANN.root)ANN.root.hidden=true;
  if(window.MBLHost&&window.MBLHost.setAnnouncementOpen)window.MBLHost.setAnnouncementOpen(false);
  ANN.background.forEach(function(row){if(row.el.isConnected)row.el.inert=row.inert;});ANN.background=[];
  if(ANN.focus){document.body.style.overflow=ANN.overflow;var previous=ANN.focus;ANN.focus=null;if(previous.isConnected&&typeof previous.focus==='function')previous.focus();}
}
function announcementReset(){ANN.notice=null;ANN.token=null;ANN.busy=false;ANN.reload=false;announcementHide();}
function announcementApply(value){
  announcementReset();
  if(!value||value.read!==false||typeof value.id!=='string'||!/^[-A-Za-z0-9._]{1,80}$/.test(value.id)||
    typeof value.title!=='string'||!value.title.trim()||value.title.length>100||!Array.isArray(value.items)||!value.items.length||value.items.length>10)return;
  if(value.items.some(function(item){return !item||typeof item.title!=='string'||!item.title.trim()||item.title.length>80||typeof item.text!=='string'||!item.text.trim()||item.text.length>1200;}))return;
  ANN.notice={id:value.id,version:typeof value.version==='string'&&value.version.length<=24&&/^v0\.\d+\.\d+$/.test(value.version)?value.version:'',title:value.title,items:value.items.map(function(item){return{title:item.title,text:item.text};})};
  ANN.token=capture();
}
function announcementMount(){
  if(ANN.root)return;
  ANN.root=node('div',undefined,'mbl-platform mbl-p-backdrop mbl-announcement-backdrop');ANN.root.hidden=true;
  ANN.dialog=node('article',undefined,'mbl-p-dialog mbl-announcement-dialog');ANN.dialog.setAttribute('role','dialog');ANN.dialog.setAttribute('aria-modal','true');ANN.dialog.setAttribute('aria-labelledby','mbl-announcement-title');ANN.dialog.tabIndex=-1;
  var header=node('div',undefined,'mbl-announcement-header'),label=node('span','更新公告','mbl-announcement-label');
  ANN.label=label;ANN.close=button('关闭','announcement-read');ANN.close.setAttribute('aria-label','关闭更新公告');header.append(label,ANN.close);
  ANN.title=node('h2',undefined,'mbl-announcement-title');ANN.title.id='mbl-announcement-title';
  ANN.body=node('ul',undefined,'mbl-announcement-items');
  ANN.content=node('div',undefined,'mbl-announcement-content');
  ANN.status=node('p','', 'mbl-announcement-status');ANN.status.setAttribute('role','status');ANN.status.setAttribute('aria-live','polite');
  var footer=node('div',undefined,'mbl-announcement-footer');ANN.confirm=button('知道了，去打球','announcement-read');footer.append(ANN.status,ANN.confirm);
  ANN.content.append(ANN.body);ANN.dialog.append(header,ANN.title,ANN.content,footer);ANN.root.append(ANN.dialog);document.body.append(ANN.root);
  [ANN.confirm,ANN.close].forEach(function(control){control.addEventListener('click',announcementRead);});
  document.addEventListener('keydown',function(e){
    if(!announcementVisible())return;
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();announcementRead();return;}
    if(e.key!=='Tab')return;e.stopImmediatePropagation();
    var items=[ANN.close,ANN.content.querySelector('summary'),ANN.confirm].filter(function(item){return item&&!item.disabled;}),first=items[0],last=items[items.length-1];
    if(!first){e.preventDefault();ANN.dialog.focus();return;}
    if(e.shiftKey&&(document.activeElement===first||!ANN.dialog.contains(document.activeElement))){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&(document.activeElement===last||!ANN.dialog.contains(document.activeElement)||document.activeElement===ANN.dialog)){e.preventDefault();first.focus();}
  },true);
}
function announcementMaybe(){
  if(announcementVisible())return true;
  if(document.querySelector('[data-mbl-original-confirm]')||window.MBLChat?.open)return false;
  if(!ANN.notice||!ANN.token||!S.ready||S.busy||!S.account||!S.loaded||S.memoryOwner!==S.identity||S.loadingCloud||S.cloudFailure||S.conflict||S.restoring||!S.autoEligible||document.visibilityState==='hidden')return false;
  if(ANN.token.epoch!==S.epoch||ANN.token.identity!==S.identity){announcementReset();return false;}
  if([UI.backdrop,UI.storyBackdrop,UI.adBackdrop].some(function(el){return el&&!el.hidden;})||creditsView.root&&!creditsView.closed)return false;
  announcementMount();ANN.label.textContent='更新公告'+(ANN.notice.version?' · '+ANN.notice.version:'');ANN.title.textContent=ANN.notice.title;ANN.body.replaceChildren();
  var groups=window.MBLReleaseArtwork?.announcementGroups(ANN.notice,Array.isArray(window.MBLReleaseHistory)?window.MBLReleaseHistory:[]);
  if(groups){groups.forEach(function(group){var row=node('li',undefined,'mbl-announcement-group');row.append(node('h3',group.version));group.items.forEach(function(item){var section=node('section');section.append(node('h4',item.title));if(item.text.trim()!==item.title.trim())section.append(node('p',item.text));row.append(section);});ANN.body.append(row);});}
  else ANN.notice.items.forEach(function(item){var row=node('li');row.append(node('h3',item.title));if(item.text.trim()!==item.title.trim())row.append(node('p',item.text));ANN.body.append(row);});
  var details=node('details',undefined,'mbl-announcement-details');
  var artwork=window.MBLReleaseArtwork?.create(ANN.notice.id,function(){details.open=true;},function(page){if(/^v0\.\d+\.\d+$/.test(page.version))ANN.label.textContent='更新公告 · '+page.version;});
  ANN.dialog.classList.toggle('mbl-announcement-comic',!!artwork);ANN.content.replaceChildren();
  if(artwork){details.append(node('summary','查看完整更新'),ANN.body);ANN.content.append(artwork,details);}
  else ANN.content.append(ANN.body);
  ANN.status.textContent='';ANN.confirm.textContent='知道了，去打球';ANN.confirm.disabled=false;ANN.close.disabled=false;ANN.reload=false;
  ANN.focus=document.activeElement||document.body;ANN.overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  [document.getElementById('app'),UI.root].filter(Boolean).forEach(function(el){ANN.background.push({el:el,inert:!!el.inert});el.inert=true;});
  communityCarouselStop();ANN.root.hidden=false;
  if(window.MBLHost&&window.MBLHost.setAnnouncementOpen)window.MBLHost.setAnnouncementOpen(true);
  ANN.dialog.focus();return true;
}
async function announcementRead(){
  if(!announcementVisible()||ANN.busy||S.busy)return;
  if(ANN.reload){announcementReset();return run('正在重新连接',refreshAccount);}
  var notice=ANN.notice,token=ANN.token;if(!notice||!token)return;
  ANN.busy=true;ANN.status.textContent='';ANN.confirm.textContent='正在保存…';ANN.dialog.setAttribute('aria-busy','true');setBusy('正在保存公告已读状态');
  try{
    assertAccount(token);
    var result=await api('/api/player/announcements/read','POST',{announcementId:notice.id},true);assertAccount(token);
    if(!result||result.read!==true||result.announcementId!==notice.id)throw error('已读状态尚未确认，请重试。');
    if(ANN.token===token){ANN.notice=null;ANN.token=null;announcementHide();}
  }catch(e){
    if(ANN.token===token){ANN.reload=e.status===409;ANN.status.textContent=ANN.reload?'公告有了新内容，请重新连接查看。':'暂时没能保存已读状态，请重试。';ANN.confirm.textContent=ANN.reload?'重新连接':'重试';}
  }finally{
    ANN.busy=false;ANN.dialog.setAttribute('aria-busy','false');setBusy('');scheduleAuto();scheduleCareer();communityCarouselArm();
    if(!S.account){announcementReset();run('正在重新连接',refreshAccount);}
  }
}

/* Native rewards plus cloud-only birth advantages. No browser persistence. */
var BP={busy:false,failed:'',done:'',epoch:0};
function birthPerksReset(){BP.failed='';BP.done='';BP.epoch++;if(window.MBLHost?.resetBirthPerks)window.MBLHost.resetBirthPerks();}
function birthPerksLocalValid(ctx){var now=window.MBLHost?.birthPerksContext?.();return !!ctx&&!!now&&now.scope===ctx.scope&&now.seed===ctx.seed;}
async function birthPerksAdopt(ctx,result,token){
 assertAccount(token);if(!birthPerksLocalValid(ctx)||!result?.state?.payload||!Number.isSafeInteger(result.state.revision)||!result.perks)throw error('出生加成尚未确认，请重新连接进度。');
 await window.MBLHost.applyBirthPerksState(ctx,result.state,result.perks);assertAccount(token);
 S.remote=canonical(result.state.payload);S.base=S.remote;S.revision=result.state.revision;S.localDirty=!sameEntries(snapshot(),S.remote);S.choice='';S.conflict=false;BP.done=ctx.scope;BP.failed='';enableManaged();
}
async function birthPerksEnsure(ctx,force){
 if(!ctx||BP.busy||S.busy||AD.busy||!S.account||!S.loaded||!S.autoEligible||S.conflict||S.restoring||S.memoryOwner!==S.identity)return;
 if(!force&&(BP.done===ctx.scope||BP.failed===ctx.scope))return;
 var token=capture(),epoch=BP.epoch;BP.busy=true;window.MBLHost.setBirthPerksPending(true);setBusy('正在准备出生加成');
 try{
  if(S.saveFlight)await S.saveFlight;await syncLocal(true);assertAccount(token);
  if(!birthPerksLocalValid(ctx))throw error('出生角色已变化，请重新读取。');
  var result=await api('/api/player/birth-perks/prepare','POST',{scope:ctx.scope},true);assertAccount(token);
  if(epoch!==BP.epoch)throw error('账号状态已变化，请重新读取。');
  await birthPerksAdopt(ctx,result,token);
 }catch(e){if(epoch===BP.epoch){BP.failed=ctx.scope;message(e.message||'出生加成未能读取，请重新连接后重试。',true);}}
 finally{BP.busy=false;window.MBLHost.setBirthPerksPending(false);setBusy('');renderSync();scheduleAuto();scheduleCareer();}
}


  function node(tag, text, cls) {
    var el = document.createElement(tag);
    if (text !== undefined) el.textContent = String(text);
    if (cls) el.className = cls;
    return el;
  }
  function button(text, action) {
    var el = node('button', text, 'mbl-p-button');
    el.type = 'button'; el.dataset.action = action;
    return el;
  }
  function safeImage(value) {
    if (typeof value !== 'string' || value.length > 2048) return '';
    try {
      var u = new URL(value);
      var allowed = ['hupu.com', 'hoopchina.com.cn', 'app.tcloudbase.com', 'sh.run.tcloudbase.com', 'static.cloudbase.net', 'gdc.hupucdn.com'];
      if (u.protocol !== 'https:' || u.username || u.password || u.port) return '';
      return allowed.some(function (d) { return u.hostname === d || u.hostname.endsWith('.' + d); }) ? u.href : '';
    } catch (_) { return ''; }
  }
  function plain(value) {
    if (typeof value === 'string') return value.slice(0, 150);
    if (value && typeof value === 'object') return plain(value.hans || value.hant || value.en || '');
    return '';
  }
  function error(message, status) {
    var e = new Error(message || '操作未完成，请稍后重试。'); e.status = status || 0; return e;
  }
  function message(text,isError,operation){
    if(!UI.notice)return;UI.notice.textContent=String(text||'').slice(0,400);UI.notice.classList.toggle('mbl-p-error',!!isError);
    if(isError)S.problem=S.cloudFailure?'云端保存未确认，游戏已暂停；请保持页面打开并重试。':S.loadingCloud?'云端存档尚未读取，游戏已暂停。':'有一项操作未完成。';
    renderManaged();
  }
  function cloudGate(value){if(window.MBLHost&&window.MBLHost.setCloudReady)window.MBLHost.setCloudReady(value===true);}
  function pauseCloud(e){S.loadingCloud=false;S.cloudFailure=true;S.cloudPending=true;cloudGate(false);stopAuto('云端保存未确认，游戏已暂停。',true);message((S.memoryOwner?'云端保存未确认，游戏已暂停。进度仅保留在当前页面，请勿刷新或关闭。':'云端存档尚未读取，游戏已暂停。')+' '+(e&&e.message||'请重新连接。'),true);}
  function emptyPayload(){var entries={};KEYS.forEach(function(k){entries[k]=null;});return {schema:1,entries:entries};}
  function flushCloud(){
    if(!S.account||!S.loaded||S.conflict||S.memoryOwner!==S.identity||S.cloudFailure)return;
    S.localDirty=!S.remote||!sameEntries(snapshot(),S.remote);if(!S.localDirty)return;
    return syncLocal(S.revision>0).catch(function(){});
  }
  function renderManaged() {
    if (!UI.root) return;
    UI.root.hidden = !S.problem && !S.needsLogin && !S.conflict;
    UI.banner.textContent = S.conflict ? '发现两份不同进度，请选择继续哪一份。' : S.problem || '登录虎扑后，进度和成就会自动保存。';
    UI.bannerAction.textContent = S.needsLogin ? '登录虎扑' : '处理';
    UI.bannerAction.dataset.action = S.needsLogin ? 'account-login' : 'panel-open';
    UI.smallStatus.textContent = S.account ? '进度和成就由系统自动保存' : '联网后保存到云端';
    if (UI.loginButton) UI.loginButton.hidden = !!S.account;
  }
  function sdk() {
    if(window.MBLPlatformConfig?.releaseEnabled===false)throw error("v0.24.0 本地候选尚未开放线上连接。");
    if (!window.ColorboxAI) throw error('请在支持的平台页面内使用账号和社区功能。');
    return window.ColorboxAI;
  }
  function config() {
    var c = window.MBLPlatformConfig;
    if (!c || typeof c.envId !== 'string' || !c.envId || typeof c.apiBase !== 'string' || !c.apiBase || typeof c.appId !== 'string' || !c.appId) {
      throw error('账号服务暂未配置，读取成功后才能开始游戏。');
    }
    var u;
    try { u = new URL(c.apiBase); } catch (_) { throw error('账号服务地址不可用。'); }
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.port ||
      !['app.tcloudbase.com', 'sh.run.tcloudbase.com'].some(function (d) { return u.hostname === d || u.hostname.endsWith('.' + d); })) {
      throw error('账号服务地址不可用。');
    }
    return c;
  }
  function snapshot() {
    if (!window.MBLHost || typeof window.MBLHost.snapshot !== 'function') throw error('游戏进度尚未准备好。');
    var snap = window.MBLHost.snapshot();
    if (!snap || snap.schema !== 1 || !snap.entries || typeof snap.entries !== 'object') throw error('页面存档格式暂不可同步。');
    var entries = {};
    KEYS.forEach(function (key) {
      var value = snap.entries[key];
      if (key === 'mbl.shared' && value === undefined) value = null;
      if (value !== null && typeof value !== 'string') throw error('页面存档格式暂不可同步。');
      entries[key] = value;
    });
    return { schema: 1, entries: entries, currentSummary: snap.currentSummary || null, selectedSummary: snap.selectedSummary || null };
  }
  function validPayload(payload) {
    if (!payload || payload.schema !== 1 || !payload.entries || typeof payload.entries !== 'object') return false;
    return KEYS.every(function (k) { return payload.entries[k] === null || typeof payload.entries[k] === 'string' || k === 'mbl.shared' && payload.entries[k] === undefined; });
  }
  function canonical(payload) {
    var entries = {};
    KEYS.forEach(function (key) { entries[key] = key === 'mbl.shared' && payload.entries[key] === undefined ? null : payload.entries[key]; });
    return { schema: 1, entries: entries };
  }
  function sameEntries(a, b) {
    return !!a && !!b && KEYS.every(function (key) { return (a.entries[key] === undefined ? null : a.entries[key]) === (b.entries[key] === undefined ? null : b.entries[key]); });
  }
  function capture() { return { epoch: S.epoch, identity: S.identity }; }
  function assertAccount(token) {
    if (!S.account || token.epoch !== S.epoch || token.identity !== S.identity) throw error('账号状态已变化，请重新读取当前账号。');
  }
  
  function rememberOwnership(){S.autoEligible=!!S.account&&S.loaded&&S.revision>0&&S.memoryOwner===S.identity;S.autoReason='';renderAuto();}
  
  
  
  function hasProgress(payload) {
    return ['mbl.current', 'mbl.records', 'mbl.achievements', 'mbl.countries'].some(function (key) {
      var raw = payload.entries[key];
      if (!raw) return false;
      try {
        var value = JSON.parse(raw);
        return !!value && (typeof value !== 'object' || Object.keys(value).length > 0);
      } catch (_) { return true; }
    });
  }
  function enableManaged(){
    S.problem='';S.needsLogin=false;S.cloudPending=false;S.cloudFailure=false;S.loadingCloud=false;S.autoEnabled=true;
    rememberOwnership();cloudGate(S.autoEligible);renderManaged();scheduleAuto();
  }
  function needChoice(){cloudGate(false);stopAuto('请选择要继续的进度。',true);S.conflict=true;S.loadingCloud=false;message('云端与当前页面都有新进度，游戏已暂停。选择继续哪一份，确认后再保存。');renderSync();renderManaged();open();}
  async function reconcileState(){
    var token=capture();if(!S.loaded||!S.account)return;
    var local=canonical(snapshot()),remote=S.remote;
    if(S.memoryOwner!==S.identity){
      if(S.memoryOwner&&(!S.base||!sameEntries(local,S.base)))S.sessions.set(S.memoryOwner,{payload:local,base:S.base,stories:window.MBLHost.exportStories?window.MBLHost.exportStories():[]});
      var prior=S.sessions.get(S.identity);
      if(prior){await window.MBLHost.restore(prior.payload.entries);assertAccount(token);if(window.MBLHost.replaceStories)await window.MBLHost.replaceStories(prior.stories);S.base=prior.base;S.memoryOwner=S.identity;local=canonical(snapshot());}
      else if(remote){await useCloud();return;}
      else{await window.MBLHost.restore(emptyPayload().entries);assertAccount(token);if(window.MBLHost.replaceStories)await window.MBLHost.replaceStories([]);S.memoryOwner=S.identity;S.base=null;S.changedAccount=false;S.choice='local';await syncLocal(false);return;}
    }
    S.changedAccount=false;
    if(sameEntries(local,remote)){S.base=remote;S.localDirty=false;enableManaged();return;}
    if(!remote&&!S.base){S.choice='local';await syncLocal(false);return;}
    if(remote&&S.base&&sameEntries(remote,S.base)){S.choice='local';await syncLocal(false);return;}
    if(remote&&S.base&&sameEntries(local,S.base)){await useCloud();return;}
    needChoice();
  }
  function clearAutoTimer() {
    if (S.autoTimer !== null) { clearTimeout(S.autoTimer); S.autoTimer = null; }
    S.autoTimerUrgent = false;
  }
  function clearPublicationTimer() {
    if (S.publicationTimer !== null) { clearTimeout(S.publicationTimer); S.publicationTimer = null; }
  }
  function clearSaveRetryTimer() {
    if (S.saveRetryTimer !== null) { clearTimeout(S.saveRetryTimer); S.saveRetryTimer = null; }
  }
  function transientFailure(e) { return !e.status || e.status === 408 || e.status === 429 || e.status >= 500; }
  function scheduleSaveRetry(e) {
    if (!transientFailure(e) || S.saveRetryTimer !== null || S.saveRetryAttempts >= 4 || S.needsLogin || S.conflict || !S.lastIdentity || document.visibilityState === 'hidden') return;
    var epoch = S.epoch, delay = [5000,15000,45000,120000][S.saveRetryAttempts++];
    S.saveRetryTimer = setTimeout(function () {
      S.saveRetryTimer = null;
      if (epoch !== S.epoch || S.busy || S.conflict || document.visibilityState === 'hidden') return;
      run('正在重新连接进度', async function () {
        try { await refreshAccount(); }
        catch (next) { scheduleSaveRetry(next); throw next; }
      });
    }, delay);
  }
  function applyPublication(result) {
    if (!result || typeof result !== 'object') return;
    var wasPending = S.publicationPending;
    S.publicationPending = result.pending === true || Number(result.pending) > 0;
    if (!S.publicationPending) { clearPublicationTimer(); S.publicationAttempts = 0; }
    if (Number(result.published) > 0 || wasPending && !S.publicationPending) {
      communityState.feeds.community.loaded = false; communityState.feeds.ranking.loaded = false;
      communityLoad(false).catch(function () {});
    }
    schedulePublicationRetry();
  }
  function schedulePublicationRetry() {
    if (!S.publicationPending || S.publicationTimer !== null || S.publicationBusy || S.publicationAttempts >= 4 ||
      !S.account || !S.loaded || S.changedAccount || S.conflict || document.visibilityState === 'hidden') return;
    var epoch = S.epoch, delay = [5000,15000,45000,120000][S.publicationAttempts++];
    S.publicationTimer = setTimeout(async function () {
      S.publicationTimer = null;
      if (epoch !== S.epoch || !S.account || S.changedAccount || S.conflict || document.visibilityState === 'hidden') return;
      S.publicationBusy = true;
      try { applyPublication(await api('/api/player/showcase/retry','POST',{},true)); }
      catch (e) { if (epoch === S.epoch && !transientFailure(e)) S.publicationPending = false; }
      finally { if (epoch === S.epoch) { S.publicationBusy = false; schedulePublicationRetry(); } }
    }, delay);
  }
  function finishedArchiveChanged() {
    try {
      var local = snapshot().entries['mbl.records'], remote = S.remote && S.remote.entries['mbl.records'];
      if (!local || local === remote) return false;
      var records = JSON.parse(local); return Array.isArray(records) && records.length > 0;
    } catch (_) { return false; }
  }
  function stopAuto(reason, requireConfirmation) {
    clearAutoTimer(); S.autoEnabled = false;
    if (requireConfirmation) S.autoEligible = false;
    S.autoReason = reason || ''; renderAuto();
  }
  function renderAuto() {
    if (!UI.autoInfo) return;
    UI.autoToggle.textContent = S.autoEnabled ? '关闭自动同步' : '开启自动同步';
    UI.autoToggle.disabled = !S.autoEnabled && (!!S.busy || !S.autoEligible || !S.loaded || !S.account);
    UI.autoInfo.textContent = S.autoEnabled ? '进度和成就会自动保存，无需手动操作。' : (S.autoReason || '正在准备自动保存。');
  }
  function scheduleAuto(){
    if(S.restoring||S.cloudFailure||!S.autoEnabled||!S.autoEligible||!S.loaded||!S.account||!S.localDirty||S.autoInFlight||S.saveFlight||S.busy||document.visibilityState==='hidden')return;
    var urgent=S.urgent||finishedArchiveChanged();
    if(urgent&&S.autoTimer!==null&&!S.autoTimerUrgent)clearAutoTimer();if(S.autoTimer!==null)return;
    // Keep critical saves prompt without exceeding the existing service's write budget.
    var epoch=S.epoch,delay=urgent?Math.max(50,1000-(Date.now()-S.autoLastStart)):Math.max(250,2000-(Date.now()-S.autoLastStart));S.autoTimerUrgent=urgent;
    S.autoTimer=setTimeout(function(){S.autoTimer=null;S.autoTimerUrgent=false;if(epoch!==S.epoch||S.cloudFailure||S.conflict||!S.autoEnabled||S.busy)return;
      S.autoInFlight=true;S.urgent=false;S.autoLastStart=Date.now();
      run('正在保存云端进度',async function(){try{await syncLocal(true);}finally{S.autoInFlight=false;}});
    },delay);
  }
  function within(promise, ms) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(error('操作超时，结果尚未确认；请保持页面打开，重新连接后再重试，请勿刷新或关闭。')); }, ms || 15000);
      Promise.resolve(promise).then(function (value) { clearTimeout(timer); resolve(value); }, function (e) { clearTimeout(timer); reject(e); });
    });
  }
  async function userInfo() {
    if(window.MBLHost&&typeof window.MBLHost.prepareStorage==='function')await window.MBLHost.prepareStorage();
    var bridge = sdk();
    if (!bridge.auth || typeof bridge.auth.getUserInfo !== 'function') throw error('此客户端暂不支持读取账号。');
    var r = await within(bridge.auth.getUserInfo());
    if (!r || r.code !== 200) throw error(r && r.message || '读取账号失败，请重试。');
    return r.data && r.data.islogin === 1 && r.data.puid ? r.data : null;
  }
  async function verifyAccount(token) {
    assertAccount(token);
    var info = await userInfo();
    assertAccount(token);
    if (!info || String(info.puid) !== token.identity) {
      adsReset();birthPerksReset();
      cloudGate(false);announcementReset();
      stopAuto('账号已变化，自动同步已关闭。请先确认当前账号的进度归属。', true);
      S.epoch += 1; S.account = null; S.identity = ''; S.loaded = false; S.choice = ''; S.share = null;
      S.cloudPending = true; S.needsLogin = !info;
      UI.name.textContent = '账号已变化'; UI.accountInfo.textContent = '账号状态已变化，请重新读取。未把当前页面进度上传到新账号。'; UI.avatar.hidden = true;
      throw error('账号状态已变化，请重新读取；当前页面进度仍保留。');
    }
  }
  async function getTestPass() {
    if(!S.account||!S.loaded)return {owned:false};
    var token=capture(),info=await userInfo();assertAccount(token);
    if(!info||String(info.puid)!==token.identity)throw error('账号状态已变化，请重新读取当前账号。');
    // User-authorized test account only. The server also requires a real,
    // unexpired operator grant belonging to the authenticated account.
    if(!['沙加缅度玫瑰','沙加缅度的玫瑰','上单墨菲特'].includes(info.nickname))return {owned:false};
    var result=await api('/api/player/pass','GET',undefined,true);assertAccount(token);
    if(!result||result.owned!==true||result.source!=='operator_grant')return {owned:false};
    return result;
  }
  async function api(path, method, data, privateCall, allowLogin) {
    if(window.MBLHost&&typeof window.MBLHost.prepareStorage==='function')await window.MBLHost.prepareStorage();
    var c = config(); var bridge = sdk();
    if (!bridge.cloud || typeof bridge.cloud.request !== 'function') throw error('此客户端暂不支持账号服务。');
    var base = c.apiBase.replace(/\/+$/, '');
    var suffix = /\/api$/.test(base) && path.indexOf('/api/') === 0 ? path.slice(4) : path;
    var params = { url: base + suffix+(suffix.includes('?')?'&':'?')+'clientRelease=7.4.0&uiRelease=chat-usd-v1', envId: c.envId, method: method || 'GET', auth: !!privateCall };
    if (data) params.data = privateCall && S.archiveMode==='lazy-v1' && ['/api/player/sync','/api/player/pass/benefit','/api/player/ads/training','/api/player/ads/birth-perk','/api/player/birth-perks/prepare'].includes(path) ? Object.assign({},data,{archiveMode:S.archiveMode}) : data;
    var token = privateCall && !allowLogin ? capture() : null;
    if (token) await verifyAccount(token);
    var result = await within(bridge.cloud.request(params));
    if (token) await verifyAccount(token);
    if (!result || typeof result !== 'object') throw error('服务返回异常，请稍后重试。');
    var businessCode = result.code !== undefined ? result.code : result.data && result.data.code;
    var status = Number(result.statusCode || (businessCode === 200 ? 200 : 0));
    if (status < 200 || status >= 300 || businessCode !== 200) {
      throw error(result.message || (status === 409 ? '云端进度已经变化，请重新选择。' : '服务暂不可用，请稍后重试。'), status || result.code);
    }
    var value = result.data;
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'code') && Object.prototype.hasOwnProperty.call(value, 'data')) {
      if (value.code !== 200) throw error(value.message || '操作未完成。', value.code);
      value = value.data;
    }
    return value;
  }
  function setBusy(label) {
    S.busy = label || '';
    if (!S.ready) return;
    document.querySelectorAll('.mbl-platform [data-action]').forEach(function (el) {
      if (el.closest('.mbl-community,.mbl-c-story-backdrop')) return;
      if (el.dataset.action !== 'panel-close' && el.dataset.action !== 'panel-open' && el.dataset.action !== 'auto-toggle') el.disabled = !!S.busy;
    });
    UI.dialog.setAttribute('aria-busy', S.busy ? 'true' : 'false');
    renderManaged();
    renderAuto();
    if(!S.busy)queueMicrotask(function(){window.MBLHost?.refreshBirthPerks?.();});
  }
  async function run(label,fn){
    if(S.busy)return;setBusy(label);
    try{await fn();}
    catch(e){if(S.loadingCloud){pauseCloud(e);scheduleSaveRetry(e);}else if(!S.cloudFailure)message(e&&e.message||'操作未完成，请重试。',true,e&&e.operation);}
    finally{setBusy('');renderSync();scheduleAuto();scheduleCareer();announcementMaybe();}
  }
  function section(title) {
    var wrap = node('section', undefined, 'mbl-p-section');
    wrap.append(node('h3', title)); UI.content.append(wrap); return wrap;
  }
  function mount() {
    UI.root = node('div', undefined, 'mbl-platform mbl-p-account');
    UI.root.hidden = true; UI.root.setAttribute('role', 'status');
    UI.banner = node('span'); UI.bannerAction = button('处理', 'panel-open');
    UI.root.append(UI.banner, UI.bannerAction);
    UI.avatar = node('img', undefined, 'mbl-p-avatar'); UI.avatar.alt = '虎扑账号头像'; UI.avatar.hidden = true;
    UI.name = node('strong', '虎扑账号'); UI.smallStatus = node('span', '云端连接后开始游戏');
    var lines = node('div', undefined, 'mbl-p-identity'); lines.append(UI.name, UI.smallStatus);
    var app = document.getElementById('app'); document.body.insertBefore(UI.root, app || document.body.firstChild);
    UI.backdrop = node('div', undefined, 'mbl-platform mbl-p-backdrop'); UI.backdrop.hidden = true;
    UI.dialog = node('article', undefined, 'mbl-p-dialog'); UI.dialog.setAttribute('role', 'dialog');
    UI.dialog.setAttribute('aria-modal', 'true'); UI.dialog.setAttribute('aria-labelledby', 'mbl-platform-title'); UI.dialog.tabIndex = -1;
    var head = node('div', undefined, 'mbl-p-header'); var title = node('h2', '游戏进度'); title.id = 'mbl-platform-title';
    head.append(title, button('关闭', 'panel-close'));
    UI.notice = node('p', '进度和成就会自动保存。', 'mbl-p-notice'); UI.notice.setAttribute('role', 'status'); UI.notice.setAttribute('aria-live', 'polite');
    UI.content = node('div', undefined, 'mbl-p-content'); UI.dialog.append(head, UI.notice, UI.content); UI.backdrop.append(UI.dialog); document.body.append(UI.backdrop);
    var account = section('当前账号'); UI.accountInfo = node('p', '正在读取账号。'); UI.loginButton = button('登录虎扑', 'account-login'); account.append(UI.avatar, lines, UI.accountInfo, button('重新连接', 'account-refresh'), UI.loginButton);
    var saves = section('账号存档'); UI.syncInfo = node('p', '先读取账号与云端存档。');
    UI.syncActions = node('div', undefined, 'mbl-p-actions');
    UI.autoInfo = node('p'); UI.autoToggle = button('自动保存', 'auto-toggle'); UI.autoInfo.hidden = true; UI.autoToggle.hidden = true;
    saves.append(UI.syncInfo, UI.syncActions, UI.autoInfo, UI.autoToggle);
    var rights = section('账号权益记录'); UI.entitlements = node('ul', undefined, 'mbl-p-list');
    UI.entitlements.append(node('li', '读取账号后查看已确认的游戏奖励。')); rights.append(UI.entitlements,button('读取历史权益','entitlements-refresh'));
    var share = section('人生战报'); UI.shareInfo = node('p', '人生结束后自动展示模拟成绩；原版海报可发到虎扑，由你确认发布。');
    UI.careerInfo = node('p', '生涯结束后自动进入展示，保留虎扑昵称和头像。'); share.append(UI.careerInfo);
    UI.shareConfirm = button('上传海报并发帖', 'share-confirm'); UI.shareConfirm.hidden = true;
    share.append(UI.shareInfo, button('重试生涯展示', 'lives-publish'), button('准备发帖晒生涯', 'share-prepare'), UI.shareConfirm);
    var ranks = section('社区与排行榜'); ranks.append(node('p', '首页可以查看每段生涯的分数、排行与详细故事。'), button('查看社区与排行榜', 'community-home'));
    var reports = section('我的战报记录'); reports.append(node('p', '“编辑器已打开”不等于帖子已经发布；实际发布需在虎扑内确认。'), button('刷新战报记录', 'reports-refresh')); UI.reports = node('ul', undefined, 'mbl-p-list'); reports.append(UI.reports);
    var stats = section('公开统计'); UI.stats = node('p', '尚未查询。'); stats.append(UI.stats, button('刷新统计', 'stats-refresh'));
    [rights, share, ranks, reports, stats].forEach(function (item) { item.hidden = true; });
    UI.shareSection = share;
    UI.root.addEventListener('click', handleClick); UI.backdrop.addEventListener('click', function (e) { if (e.target === UI.backdrop) close(); else handleClick(e); });
    document.addEventListener('keydown', handleKeys);
  }

  function renderSync(){
    if(!S.ready)return;renderAuto();UI.syncActions.replaceChildren();
    if(!S.account){UI.syncInfo.textContent='联网登录虎扑后读取云档并开始游戏；本页不保存本地存档。';return;}
    if(!S.loaded){UI.syncInfo.textContent='正在读取云端存档，读取完成前暂停游戏。';return;}
    if(S.conflict){UI.syncInfo.textContent='云端与当前页面存在不同进度，游戏已暂停。';UI.syncActions.append(button('继续云端进度','use-cloud'),button('保存当前页面进度','resolve-local'));}
    else if(S.cloudFailure){UI.syncInfo.textContent='云端保存未确认，当前进度只保留在页面内存。请重试，勿刷新或关闭。';}
    else UI.syncInfo.textContent=S.localDirty?'正在保存到云端；尚未确认的进度仅在当前页面。':'进度和成就已保存到云端。';
    if(S.busy)setBusy(S.busy);
  }
  async function loadState() {
    var token = capture(); assertAccount(token);
    var me = await api('/api/player/me?release=7.4.0&archiveMode=lazy-v1&readMode=progress-v2', 'GET', undefined, true); assertAccount(token);
    if (!me || typeof me !== 'object') throw error('账号存档返回异常，当前页面进度仍在内存中，请勿刷新或关闭。');
    var state = me.state;
    if (state !== null && state !== undefined && (!Number.isInteger(state.revision) || state.revision < 0 || !validPayload(state.payload))) {
      throw error('云存档格式异常，未改变页面进度。');
    }
    S.remoteStories=state&&Array.isArray(state.payload.completedCareers)?state.payload.completedCareers:[];
    S.archiveMode=state?.archiveMode==='lazy-v1'||me.archiveMode==='lazy-v1'?'lazy-v1':'';S.deltaEnabled=me.saveProtocol==='delta-v1';S.confirmEnabled=me.confirmProtocol==='revision-v1';S.requestBudget=me.maxRequestBytes===5*1024*1024?me.maxRequestBytes:2250000;
    S.archiveSeeds=new Set(S.archiveMode?JSON.parse(state?.payload?.entries?.['mbl.records']||'[]').map(function(r){return r.seed;}):[]);S.archiveFlights.clear();
    S.remote = state ? canonical(state.payload) : null; S.revision = state ? state.revision : 0;
    S.loaded = true; S.choice = ''; S.conflict = false;
    announcementApply(me.announcement);
    S.accountKey = typeof me.accountKey === 'string' && me.accountKey.length <= 160 ? me.accountKey : '';
    adsApply(me.adEntitlements);
    applyPublication(me.community);
    S.profileDirty = !me.profile || me.profile.nickname !== S.account.nickname || safeImage(me.profile.avatar) !== S.account.avatar;
    S.autoEligible=S.memoryOwner===S.identity&&!!S.remote&&S.revision>0;
    UI.entitlements.replaceChildren();
    var rights = Array.isArray(me.entitlements) ? me.entitlements : [];
    if (!rights.length) UI.entitlements.append(node('li', me.historyDeferred?'历史权益在打开时读取。':'暂无可确认的游戏权益记录。'));
    rights.slice(0, 100).forEach(function (item) {
      if (!item || typeof item !== 'object') return;
      var verified = item.verified === true || item.status === 'verified';
      UI.entitlements.append(node('li', (plain(item.title || item.name || item.kind) || '游戏权益') + ' · ' + (verified ? '已确认奖励' : '未核验，不作为解锁依据')));
    });
    S.localDirty = !S.remote || !sameEntries(snapshot(), S.remote);
    renderSync();
    message('正在自动检查进度。');
  }
  async function refreshAccount() {
    window.dispatchEvent(new Event('mbl:pass-account-change'));
    announcementReset();
    cloudGate(false);S.loadingCloud=true;
    if(S.saveFlight)try{await S.saveFlight;}catch(_){}
    S.loadingCloud=true;
    adsReset();birthPerksReset();S.archiveMode='';S.deltaEnabled=false;S.confirmEnabled=false;S.requestBudget=2250000;if(window.MBLDeltaClient)window.MBLDeltaClient.reset();S.archiveSeeds.clear();S.archiveFlights.clear();
    clearSaveRetryTimer(); clearPublicationTimer(); S.publicationPending = false; S.publicationAttempts = 0; S.publicationBusy = false;
    stopAuto('正在连接账号。', true);
    S.bootstrapLocal = canonical(snapshot()); S.cloudPending = true; S.needsLogin = false;
    clearCareerTimer(); S.careerAttempted = new Set(); S.careerDone = new Set(); S.careerFailures = new Map();
    var epoch = ++S.epoch;
    var oldIdentity = S.identity || S.lastIdentity;
    S.account = null; S.identity = ''; S.remote = null; S.loaded = false; S.choice = ''; S.revision = 0; S.share = null; S.accountKey = '';
    UI.name.textContent = '正在读取账号'; UI.avatar.hidden = true; UI.avatar.removeAttribute('src');
    UI.shareConfirm.hidden = true; UI.shareInfo.textContent = '人生结束后自动展示模拟成绩；原版海报可发到虎扑，由你确认发布。';
    UI.reports.replaceChildren(); UI.entitlements.replaceChildren();
    var info;
    try { info = await userInfo(); }
    catch (e) {
      if (epoch === S.epoch) {
        UI.name.textContent = '账号读取失败';
        UI.accountInfo.textContent = '当前未能读取虎扑账号，当前页面进度仍在内存中，请勿刷新或关闭。请稍后重试。';
      }
      throw e;
    }
    if (epoch !== S.epoch) return;
    if (!info) {
      UI.name.textContent = '请登录后开始'; UI.accountInfo.textContent = '当前未登录虎扑。登录后再读取账号，当前页面不会保存本地存档。'; UI.avatar.hidden = true;
      S.needsLogin = true; S.cloudPending = false; S.problem = '';
      liveWake(true);
      S.loadingCloud=false;S.problem='请登录虎扑后读取云档并开始游戏。';message('本页仅在内存中运行，登录并连接云端后才能开始。'); renderSync(); return;
    }
    S.identity = String(info.puid); S.lastIdentity = S.identity;
    S.changedAccount = !!oldIdentity && oldIdentity !== S.identity;
    S.account = { nickname: typeof info.nickname === 'string' ? info.nickname.trim().slice(0, 80) : '虎扑JR', avatar: safeImage(info.avatar || info.userHeadUrl) };
    UI.name.textContent = S.account.nickname || '虎扑JR'; UI.accountInfo.textContent = '已连接当前虎扑账号。';
    UI.avatar.hidden = !S.account.avatar;
    if (S.account.avatar) UI.avatar.src = S.account.avatar; else UI.avatar.removeAttribute('src');
    if (epoch !== S.epoch) return;
    await loadState();
    await reconcileState();
    if (S.restoring || S.conflict) return;
    S.saveRetryAttempts = 0;
    schedulePublicationRetry();
    await adsAccountReady();
    await liveAccountReady();
    readCareerDone();
    if (S.profileDirty && !S.conflict) await saveProfile();
    try { await loadLives(false); }
    catch (_) { UI.careerInfo.textContent = '生涯展示暂未读取，可稍后刷新；当前页面进度仍在内存中，请勿刷新或关闭。'; }
    scheduleCareer();
    window.dispatchEvent(new Event('mbl:account-ready'));
  }
  function loadArchive(seed){
    if(S.archiveMode!=='lazy-v1'||!S.archiveSeeds.has(seed))return Promise.resolve(null);
    if(S.archiveFlights.has(seed))return S.archiveFlights.get(seed);
    var token=capture();assertAccount(token);
    var flight=api('/api/player/me?archiveSeed='+encodeURIComponent(seed),'GET',undefined,true).then(function(result){assertAccount(token);return result;});
    S.archiveFlights.set(seed,flight);flight.finally(function(){if(S.archiveFlights.get(seed)===flight)S.archiveFlights.delete(seed);}).catch(function(){});return flight;
  }
  async function loginAccount() {
    await api('/api/player/me?release=7.4.0&archiveMode=lazy-v1&readMode=progress-v2', 'GET', undefined, true, true);
    await refreshAccount();
  }
  async function resolveLocal(){
    if(!S.loaded||!S.account){await refreshAccount();return;}
    if(S.memoryOwner!==S.identity)throw error('当前页面进度不属于这个账号，请切回原账号。');
    S.choice='local';await syncLocal(false);close();
  }
  function syncLocal(automatic){
    if(S.saveFlight)return S.saveFlight;
    var flight=performSync(automatic).catch(function(e){pauseCloud(e);scheduleSaveRetry(e);throw e;});
    S.saveFlight=flight;flight.finally(function(){if(S.saveFlight===flight)S.saveFlight=null;scheduleAuto();}).catch(function(){});return flight;
  }
  async function performSync(automatic) {
    var token = capture(); assertAccount(token);
    if (!S.loaded) throw error('请先重新比较云端进度。');
    if(S.memoryOwner!==S.identity)throw error('账号已变化，未上传另一账号的页面进度。');
    var local = canonical(snapshot());
    var automaticAllowed = automatic === true && S.autoEnabled && S.autoEligible && S.revision > 0 && !!S.remote;
    if (automatic === true && !automaticAllowed) throw error('进度归属尚未确认，不能自动上传。');
    if (S.remote && !sameEntries(local, S.remote) && S.choice !== 'local' && !automaticAllowed) throw error('请先选择保留当前页面进度，再确认更新云存档。');
    var completed = [], archiveChanged=!S.remote||local.entries['mbl.records']!==S.remote.entries['mbl.records'], candidates = archiveChanged && window.MBLHost && typeof window.MBLHost.completedSummaries === 'function' ? window.MBLHost.completedSummaries().filter(function(x){return endedSummary(x)&&!S.archiveSeeds.has(x.seed);}).slice(0,30) : [];
    var remaining = candidates.length ? S.requestBudget-new Blob([JSON.stringify({expectedRevision:S.revision,payload:local,completedCareers:[]})]).size : 0;
    for(var candidate of candidates){
      var summary;
      try{summary=window.MBLHost&&typeof window.MBLHost.prepareSummary==='function'?await window.MBLHost.prepareSummary(candidate):candidate;}
      catch(e){throw error('生涯故事尚未保存，游戏已暂停。'+(e&&e.message||''),413);}
      var bytes=new Blob([JSON.stringify(summary)]).size+1;if(bytes>remaining)throw error('生涯故事超过本次云端保存大小限制，游戏已暂停。',413);completed.push(summary);remaining-=bytes;
    }
    assertAccount(token);
    var submission={ expectedRevision: S.revision, payload: local, completedCareers: completed };
    if(S.confirmEnabled&&S.remote&&S.revision>0&&!completed.length&&sameEntries(local,S.remote))submission={protocol:'confirm-v1',expectedRevision:S.revision};
    else if(S.deltaEnabled&&S.remote&&S.revision>0&&!completed.length&&window.MBLDeltaClient){var delta=await window.MBLDeltaClient.build(S.remote,local,S.revision);assertAccount(token);if(delta)submission=delta;}
    var result = await api('/api/player/sync', 'POST', submission, true);
    assertAccount(token);
    if (!result || !Number.isInteger(result.revision) || result.revision <= S.revision) throw error('写入结果未确认，请重新比较进度。');
    S.remote = local; S.base = local; S.revision = result.revision; S.choice = ''; S.changedAccount = false; S.conflict = false;
    S.localDirty = !sameEntries(snapshot(), local); S.autoLastStart = Date.now(); enableManaged();
    clearSaveRetryTimer(); S.saveRetryAttempts = 0; applyPublication(result.community);
    message(S.localDirty?'较早进度已保存，正在继续保存新的变化。':'进度和成就已保存到云端。');
  }
  async function useCloud(expectedLocal){
    var token=capture();assertAccount(token);if(!S.loaded||!validPayload(S.remote))throw error('没有可读取的云档。');
    cloudGate(false);await verifyAccount(token);assertAccount(token);
    if(expectedLocal&&!sameEntries(expectedLocal,snapshot())){needChoice();return;}
    S.restoring=true;clearAutoTimer();clearCareerTimer();
    try{await window.MBLHost.restore(S.remote.entries);assertAccount(token);if(window.MBLHost.replaceStories)await window.MBLHost.replaceStories(S.remoteStories);}
    finally{S.restoring=false;}
    S.memoryOwner=S.identity;S.base=S.remote;S.sessions.delete(S.identity);S.changedAccount=false;S.localDirty=false;S.choice='';S.conflict=false;enableManaged();message('云端进度已载入，可以继续游戏。');
  }
  async function saveProfile() {
    var token = capture(); assertAccount(token);
    await verifyAccount(token);
    assertAccount(token);
    await api('/api/player/profile', 'POST', { nickname: S.account.nickname, avatar: S.account.avatar }, true);
    assertAccount(token); S.profileDirty = false; message('账号资料已更新，进度会自动保存。');
  }
  function open() {
    if (!S.ready) { init(); return; }
    communityCarouselStop();
    if (UI.storyBackdrop && !UI.storyBackdrop.hidden) communityCloseStory();
    S.focusBefore = document.activeElement; UI.backdrop.hidden = false; renderSync(); UI.dialog.focus();
  }
  function close() {
    UI.backdrop.hidden = true;
    var prev = S.focusBefore; S.focusBefore = null;
    if (prev && prev.isConnected && typeof prev.focus === 'function') prev.focus();
    communityCarouselArm();
  }
  function handleKeys(e) {
    if (adsKeys(e)) return;
    if (communityStoryKeys(e)) return;
    if (!S.ready || UI.backdrop.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    var items = Array.from(UI.dialog.querySelectorAll('button:not([disabled])')).filter(function (x) { return !x.hidden && !x.closest('[hidden]'); });
    if (!items.length) { e.preventDefault(); UI.dialog.focus(); return; }
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === UI.dialog)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || document.activeElement === UI.dialog)) { e.preventDefault(); first.focus(); }
  }

  function endedSummary(value) {
    return !!value && value.version === 1 && value.ended === true && Number.isInteger(value.seed) &&
      typeof value.name === 'string' && typeof value.code === 'string' && Number.isFinite(value.age) &&
      !!value.card && typeof value.card === 'object';
  }
  function selectedSummary() {
    var snap = snapshot(); var value = snap.selectedSummary || snap.currentSummary;
    if (!endedSummary(value)) throw error('请先完成一段人生，再打开原版海报或公开结算摘要。');
    return JSON.parse(JSON.stringify(value));
  }
  async function publishSummary(summary, token) {
    assertAccount(token);
    var prepared=window.MBLHost&&typeof window.MBLHost.prepareSummary==='function'?await window.MBLHost.prepareSummary(summary):summary;
    assertAccount(token);
    var data = await api('/api/lives/publish', 'POST', {
      summary: prepared, profile: { nickname: S.account.nickname, avatar: S.account.avatar }
    }, true);
    assertAccount(token);
    if (!data || typeof data.lifeId !== 'string' || !data.lifeId) throw error('公开结果未确认，请先刷新荣誉榜。');
    return data;
  }
  async function publishLife() {
    var token = capture(); assertAccount(token); var summary = selectedSummary();
    var result = await publishSummary(summary, token);
    rememberCareer(summary);
    message('模拟生涯已进入展示。' + (Number.isFinite(result.score) ? '生涯评分：' + result.score + '。' : '') + '发帖仍需你确认发布。');
  }
  function clearCareerTimer() {
    if (S.careerTimer !== null) { clearTimeout(S.careerTimer); S.careerTimer = null; }
  }
  function readCareerDone() {
    try {
      var value = JSON.parse(window.MBLMemoryStore.getItem('mbl.platform.showcase.v2') || 'null');
      if (value && value.appId === config().appId && value.accountKey === S.accountKey && Array.isArray(value.seeds)) {
        S.careerDone = new Set(value.seeds.filter(function (x) { return typeof x === 'string' && /^\d{1,10}$/.test(x); }).slice(-60));
      }
    } catch (_) { /* A missing local receipt never claims an upload succeeded. */ }
  }
  function rememberCareer(summary) {
    S.careerFailures.delete(String(summary.seed));
    S.careerDone.add(String(summary.seed));
    while (S.careerDone.size > 60) S.careerDone.delete(S.careerDone.values().next().value);
    try { window.MBLMemoryStore.setItem('mbl.platform.showcase.v2', JSON.stringify({ appId: config().appId, accountKey: S.accountKey, seeds: Array.from(S.careerDone) })); }
    catch (_) { /* The service also deduplicates the original life. */ }
  }
  function nextCareer() {
    if (!window.MBLHost || typeof window.MBLHost.completedSummaries !== 'function') return null;
    var items = window.MBLHost.completedSummaries();
    if (!Array.isArray(items)) return null;
    return items.slice(0,30).find(function (x) { return endedSummary(x) && !S.archiveSeeds.has(x.seed) && !S.careerDone.has(String(x.seed)) && !S.careerAttempted.has(String(x.seed)); }) || null;
  }
  function scheduleCareer() {
    if (S.restoring || S.conflict || !S.ready || !S.account || !S.loaded || !S.accountKey || S.changedAccount || S.busy || S.careerTimer !== null || document.visibilityState === 'hidden') return;
    var summary;
    try { summary = nextCareer(); } catch (_) { return; }
    if (!summary) return;
    var epoch = S.epoch;
    S.careerTimer = setTimeout(function () {
      S.careerTimer = null;
      if (epoch !== S.epoch || S.busy || !S.account || !S.loaded || S.changedAccount || document.visibilityState === 'hidden') return;
      var token = capture(), seed = String(summary.seed);
      S.careerAttempted.add(seed); S.careerLastStart = Date.now();
      run('正在更新生涯展示', async function () {
        try {
          await publishSummary(summary, token); assertAccount(token);
          rememberCareer(summary); UI.careerInfo.textContent = summary.name + '的模拟生涯已进入展示。';
          if (!nextCareer()) {
            try { await loadLives(false); }
            catch (_) { UI.careerInfo.textContent += '展示列表暂未刷新，可稍后主动刷新。'; }
          }
        } catch (e) {
          var failed=S.careerFailures.get(seed)||{count:0,after:0};failed.count++;
          if(transientFailure(e)){if(failed.count<4){failed.after=Date.now()+[15000,45000,120000][failed.count-1];S.careerAttempted.delete(seed);}}
          S.careerFailures.set(seed,failed);
          if (epoch === S.epoch) UI.careerInfo.textContent = '这段生涯的展示提交尚未确认，可稍后点“重试生涯展示”。游戏进度仍按原规则自动保存。';
          throw e;
        }
      });
    }, Math.max(600, 5500 - (Date.now() - S.careerLastStart), (S.careerFailures.get(String(summary.seed))||{}).after-Date.now()||0));
  }
  function startCareerIdentity() {
    communityEnsure();
    if (window.ColorboxAI && window.ColorboxAI.auth && typeof window.ColorboxAI.auth.getUserInfo === 'function') {
      if (!S.account && !S.busy) run('正在读取虎扑身份', refreshAccount);
      return;
    }
    if (++S.careerBootAttempts < 30) setTimeout(startCareerIdentity, 500);
    else { S.loadingCloud=false; S.problem='请在虎扑内联网登录后开始。';message('云端连接不可用，本页未开始游戏，也不保存本地存档。',true); }
  }
  async function retryCareers() {
    var token = capture(); assertAccount(token);
    if (!S.loaded) throw error('请先重新读取账号与云端进度。');
    if (S.changedAccount) throw error('页面进度可能属于其他账号，请先选择当前账号的进度。');
    await verifyAccount(token); S.careerAttempted.clear();
    if (!nextCareer()) { await loadLives(false); message('已结束的生涯已提交展示，或当前还没有结束的人生。'); }
    else message('正在重新提交尚未确认展示的生涯。');
  }
  function assertSharePair(draft){
    assertAccount(draft.token);
    if(!window.MBLHost||typeof window.MBLHost.postingFiles!=="function"||window.MBLHost.postingFiles()!==draft.files||window.MBLHost.poster()!==draft.files[0])throw error("当前海报已变化，请重新点击发帖。");
  }
  function postFromGame(seed){
    if(S.busy){message("正在处理，请稍候再点发帖。",true);return;}
    return run("正在准备海报发帖",async function(){
      if(!window.MBLHost||typeof window.MBLHost.posterForPost!=="function")throw error("海报功能尚未准备好。");
      var poster=await window.MBLHost.posterForPost(seed);
      if(!poster||!endedSummary(poster.summary)||!Array.isArray(poster.files)||poster.files.length!==2||poster.files.some(function(file){return !(file instanceof Blob)||!file.size;}))throw error("两张海报尚未生成完成，请重新点击发帖。");
      if(poster.files.some(function(file){return file.size>10*1024*1024;}))throw error("有海报超过10MB，暂不可上传。");
      if(!S.account)await loginAccount();
      if(S.restoring||S.conflict||S.changedAccount)throw error("请先选择当前账号要继续的进度，再发帖。");
      var previous=S.share,token=capture();assertAccount(token);
      S.share={summary:poster.summary,file:poster.files[0],files:poster.files,token:token,
        imageUrls:previous&&previous.files===poster.files&&previous.token.identity===token.identity&&Array.isArray(previous.imageUrls)?previous.imageUrls.slice(0,2):["",""]};
      await confirmShare();
    });
  }
    async function bbsParams(token) {
    var bridge = sdk();
    if (!bridge.bbsConfig || typeof bridge.bbsConfig.get !== 'function') throw error('话题配置暂不可读取，已停止打开编辑器。');
    if (S.bbs === undefined) {
      var value = await within(bridge.bbsConfig.get()); await verifyAccount(token);
      if (value && typeof value === 'object' && value.code !== undefined) {
        if (value.code !== 200) throw error(value.message || '话题配置读取失败。');
        value = value.data;
      }
      S.bbs = value && typeof value === 'object' ? value : null;
    }
    var out = {}; var bbs = S.bbs;
    if (bbs && typeof bbs.bbsTagId === 'string' && bbs.bbsTagId.trim()) {
      ['TopicId', 'TagId', 'TopicName', 'TagName'].forEach(function (key) {
        var raw = bbs['bbs' + key];
        if (typeof raw === 'string' && raw.trim()) out[key[0].toLowerCase() + key.slice(1)] = raw;
      });
    }
    return out;
  }
  async function confirmShare(){
    var draft=S.share;
    if(!draft)throw error("请先准备人生海报。");
    var token=draft.token;assertSharePair(draft);
    var bbs=await bbsParams(token);assertSharePair(draft);
    var bridge=sdk();
    if(!bridge.oss||typeof bridge.oss.uploadFile!=="function"||!bridge.navigate||typeof bridge.navigate.to!=="function")throw error("此客户端暂不支持图片发帖，未执行上传。");
    var published=await publishSummary(draft.summary,token);assertSharePair(draft);
    var imageUrls=[];
    for(var index=0;index<2;index++){
      assertSharePair(draft);
      var imageUrl=safeImage(draft.imageUrls[index]);
      if(!imageUrl){
        var upload;
        try{upload=await within(bridge.oss.uploadFile({file:draft.files[index],filename:"basketball-life-"+(index===0?"score":"credits")+"-"+draft.summary.seed+".png"}),30000);}
        catch(_){throw error("海报上传未完成，请重试；尚未打开发帖编辑器。");}
        await verifyAccount(token);assertSharePair(draft);
        imageUrl=upload&&safeImage(upload.downloadUrl);
        if(!imageUrl)throw error("上传图片地址未通过校验，尚未打开发帖编辑器。");
        draft.imageUrls[index]=imageUrl;
      }
      imageUrls.push(imageUrl);
    }
    assertSharePair(draft);
    var imageList=imageUrls.map(function(url,index){return {key:"ColorboxAI-"+index,remoteUrl:url};});
    var initialValue={syncPost:true,appJsonV3:{activeTab:"thread",data:{imageList:imageList}}};
    var query=[];
    ["topicId","tagId","topicName","tagName"].forEach(function(key){if(typeof bbs[key]==="string"&&bbs[key].trim())query.push(key+"="+encodeURIComponent(bbs[key]));});
    query.push("initialValue="+encodeURIComponent(JSON.stringify(initialValue)));
    var url="huputiyu://bbs/postImg?"+query.join("&");
    var opened=await within(bridge.navigate.to({url:url}));await verifyAccount(token);
    if(!opened||opened.code!==200)throw error(opened&&opened.message||"摘要已公开，但编辑器未成功打开。");
    S.share=null;UI.shareConfirm.hidden=true;
    try{await api("/api/reports/opened","POST",{lifeId:published.lifeId},true);assertAccount(token);message("请在虎扑发帖页面确认发布。");}
    catch(_){assertAccount(token);message("请在虎扑发帖页面确认发布。");}
  }
  
  function safeCount(value) { return Number.isFinite(value) && value >= 0 ? String(Math.floor(value)) : '—'; }
  function renderLives() {
    communityRender();
  }
  async function loadLives(more) {
    return communityLoad(more);
  }
  async function loadEntitlements(){
    var token=capture();assertAccount(token);var response=await api('/api/player/me?history=entitlements&cursor=0','GET',undefined,true);assertAccount(token);
    if(!response||!Array.isArray(response.items))throw error('历史权益暂未读取，请稍后重试。');
    UI.entitlements.replaceChildren();if(!response.items.length)UI.entitlements.append(node('li','暂无已记录的游戏权益。'));
    response.items.slice(0,100).forEach(function(item){UI.entitlements.append(node('li',(plain(item.target)||'游戏权益')+' · '+(item.verified===true?'已确认':'未确认')));});
  }
  async function loadReports() {
    var token = capture(); assertAccount(token);
    var result = await api('/api/player/reports', 'GET', undefined, true); assertAccount(token);
    var rows = Array.isArray(result) ? result : result && (result.items || result.reports);
    if (!Array.isArray(rows)) throw error('战报记录返回异常。');
    UI.reports.replaceChildren();
    if (!rows.length) UI.reports.append(node('li', '暂无编辑器打开记录。'));
    rows.slice(0, 100).forEach(function (item) {
      if (!item || typeof item !== 'object') return;
      var status = item.status === 'editor_opened' ? '编辑器已打开，发布未确认' : '发布状态未确认';
      UI.reports.append(node('li', (plain(item.name) || '人生战报') + ' · ' + status));
    });
    message('已刷新发帖记录。');
  }
  async function loadStats() {
    var result = await api('/api/stats', 'GET', undefined, false);
    if (!result || typeof result !== 'object') throw error('统计返回异常。');
    UI.stats.textContent = '玩家' + safeCount(result.players) + ' · 公开模拟人生' + safeCount(result.lives) + ' · 编辑器打开记录' + safeCount(result.reportsOpened);
    message('已读取公开统计。');
  }
  function handleClick(e) {
    var target = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
    if (!target || target.disabled) return;
    var action = target.dataset.action;
    if (action === 'keepsake-open') { window.MBLPassAccess?.openKeepsake(target); return; }
    if (action === 'panel-open') { open(); return; }
    if (action === 'panel-close') { close(); return; }
    if (action === 'account-login') { run('正在连接虎扑账号', loginAccount); return; }
    if (action === 'community-home') {
      close(); if (window.MBLHost && typeof window.MBLHost.showCommunity === 'function') window.MBLHost.showCommunity();
      requestAnimationFrame(function () { communityMount(); if (communityState.root) communityState.root.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
      return;
    }
    if (action === 'auto-toggle') { message('云端自动保存持续开启。'); return; }
    if (action === 'share-prepare') {
      postFromGame(); return;
    }
    var actions = {
      'account-refresh': refreshAccount, 'state-refresh': async function () { await loadState(); await reconcileState(); }, 'sync-local': syncLocal, 'resolve-local': resolveLocal,
      'use-cloud': useCloud, 'profile-save': saveProfile,
      'keep-local': async function () { if (!S.loaded) throw error('请先重新比较进度。'); S.choice = 'local'; message('当前页面进度仍在内存中，请勿刷新或关闭，云端尚未修改；确认上传需要再点保存按钮。'); },
      'lives-publish': retryCareers, 'lives-refresh': function () { return loadLives(false); },
      'lives-more': function () { return loadLives(true); }, 'reports-refresh': loadReports, 'entitlements-refresh':loadEntitlements,
      'stats-refresh': loadStats, 'share-confirm': confirmShare
    };
    if (actions[action]) run('正在处理，请稍候', actions[action]);
  }
  function reconcilePoster() {
    if (!S.ready) return;
    var article = document.querySelector('#app .cardview');
    if (!article || article.querySelector('[data-action="share-prepare"]')) return;
    var file;
    try { file = window.MBLHost.poster(); } catch (_) { return; }
    if (!(file instanceof Blob) || !file.size) return;
    var block = node('div', undefined, 'mbl-platform mbl-p-poster-action');
    block.append(button('发帖', 'share-prepare'), button(window.MBLPassAccess?.active() ? '人生珍藏' : '开通会员 · 人生珍藏', 'keepsake-open'));
    block.addEventListener('click', handleClick); article.append(block);
  }
  function init() {
    if (S.ready) return true;
    if (!document.body || !window.MBLHost || typeof window.MBLHost.snapshot !== 'function') return false;
    mount(); S.ready = true; cloudGate(false); S.problem='正在读取云端存档…';renderManaged(); communityMount(); communityEnsure(); liveInit();
    if (typeof window.MBLHost.onChanged === 'function') {
      var syncScheduled = false;
      window.MBLHost.onChanged(function (detail) {
        S.localDirty = true; S.urgent=S.urgent||!!(detail&&detail.urgent);
        scheduleAuto();
        scheduleCareer();
        if (UI.backdrop.hidden || syncScheduled) return;
        syncScheduled = true;
        requestAnimationFrame(function () { syncScheduled = false; if (!UI.backdrop.hidden) renderSync(); });
      });
    }
    var app = document.getElementById('app');
    if (app && typeof MutationObserver === 'function') {
      var scheduled = false;
      new MutationObserver(function () {
        if (scheduled) return; scheduled = true;
        requestAnimationFrame(function () { scheduled = false; reconcilePoster(); communityMount(); liveMount(); });
      }).observe(app, { childList: true, subtree: true });
    }
    reconcilePoster(); renderSync();
      Promise.resolve(window.MBLHost.prepareStorage?window.MBLHost.prepareStorage():null).then(startCareerIdentity,startCareerIdentity);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { flushCloud(); clearAutoTimer(); clearCareerTimer(); clearPublicationTimer(); clearSaveRetryTimer(); }
      else { resumeSync(); scheduleAuto(); scheduleCareer(); schedulePublicationRetry(); }
    });
    function resumeSync() {
      if (S.restoring || S.busy || S.conflict || Date.now() - S.resumeCheckAt < 5000 || !window.ColorboxAI || !window.ColorboxAI.auth) return;
      S.resumeCheckAt = Date.now(); run('正在连接进度', refreshAccount);
    }
    function unload() { flushCloud(); clearAutoTimer(); clearCareerTimer(); clearPublicationTimer(); clearSaveRetryTimer(); }
    window.addEventListener('pagehide', unload); window.addEventListener('beforeunload', unload);
    window.addEventListener('online', resumeSync);
    window.addEventListener('pageshow', function (e) { if (e.persisted) resumeSync(); });
    return true;
  }
  function status() {
    return { ready: S.ready, busy: S.busy, loggedIn: !!S.account, revision: S.revision,
      loaded: S.loaded, choice: S.choice, changedAccount: S.changedAccount, localDirty: S.localDirty, conflict: S.conflict,
      autoEnabled: S.autoEnabled, autoEligible: S.autoEligible, autoInFlight: S.autoInFlight, autoScheduled: S.autoTimer !== null,
      publicationPending: S.publicationPending, publicationAttempts: S.publicationAttempts, cloudFailure:S.cloudFailure, memoryOwner:S.memoryOwner, cloudReady:!!window.MBLHost.cloudReady?.() };
  }
  var keepsakeUploads = new WeakMap(), keepsakePosting = false;
  async function postKeepsake(input) {
    if (keepsakePosting) throw error('正在打开发帖编辑器，请稍候。');
    keepsakePosting = true;
    try {
      var recordOnly = input?.kind === 'record';
      if (!recordOnly && (!(input?.blob instanceof Blob) || !input.blob.size || input.blob.size > 10*1024*1024)) throw error('图片为空或超过10MB，请重新生成。');
      if (input?.kind === 'film' && (!(input.mediaBlob instanceof Blob) || !input.mediaBlob.size || input.mediaBlob.size > 10*1024*1024 || !/^video\/(mp4|webm)(?:;|$)/.test(input.mediaBlob.type))) throw error('视频为空、格式不可用或超过10MB，请切换20秒精华版后再发帖。');
      if (typeof input?.title !== 'string' || typeof input?.content !== 'string' || !input.content) throw error('分享内容尚未准备完成。');
      var token = capture(), bridge = sdk();
      function guard() { assertAccount(token); if (!input.current()) throw error('这段人生或分享内容已变化，请重新点击发帖。'); }
      guard(); await verifyAccount(token); guard();
      if ((!recordOnly && !bridge.oss?.uploadFile) || !bridge.request?.bbs?.openPostEditor) throw error('请在支持发帖的虎扑客户端内使用。');
      var bbs = await bbsParams(token); guard();
      async function upload(blob, filename) {
        guard();var cached = keepsakeUploads.get(blob), url = cached?.identity === token.identity ? cached.url : '';
        if (url) return url;
        var response = await within(bridge.oss.uploadFile({file:blob,filename:filename}),30000);
        await verifyAccount(token);guard();url=response&&safeImage(response.downloadUrl);
        if (!url) throw error('上传文件地址未通过校验，尚未打开发帖编辑器。');
        keepsakeUploads.set(blob,{identity:token.identity,url:url});return url;
      }
      var params=Object.assign({title:input.title,content:input.content},bbs);
      if (!recordOnly) params.imageUrl=await upload(input.blob,'basketball-life-'+(input.kind==='film'?'film-cover':'overview')+'-'+input.seed+'.png');
      if (input.kind==='film') {
        var videoUrl=await upload(input.mediaBlob,'basketball-life-film-'+input.seed+(input.mediaBlob.type.startsWith('video/mp4')?'.mp4':'.webm'));
        params.content=[{type:'paragraph',content:[{type:'text',text:input.content}]},{type:'paragraph',content:[{type:'link',attrs:{href:videoUrl,title:'点击播放'+input.title}}]}];
      }
      guard();
      var opened = await within(bridge.request.bbs.openPostEditor(params));
      await verifyAccount(token); guard();
      if (!opened || opened.code !== 200) throw error(opened?.message || '发帖编辑器未打开，请重试。');
      return {opened:true};
    } finally { keepsakePosting = false; }
  }
  var exported = { init: init, open: open, refreshAccount: refreshAccount, getStatus: status, getTestPass:getTestPass, loadArchive:loadArchive, archiveEpoch:function(){return S.epoch;}, rewardAction: adsRequest, ensureBirthPerks:birthPerksEnsure, postLife: postFromGame, postKeepsake: postKeepsake, showCredits: creditsShow, showCreditsImage: creditsShowImage };
  window.BasketballPlatform = exported; window.MBLPlatform = exported;
  window.addEventListener('mbl:host-ready', init);
  function start() {
    var attempts = 0;
    function attempt() { if (!init() && ++attempts < 60) setTimeout(attempt, 100); }
    attempt();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();

}());
