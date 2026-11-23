/* Selected, locally bundled artwork for our release notice. */
(function(){'use strict';
  const artwork={
    'basketball-life-7.4.0-20261117':{version:'v0.25.0',src:'assets/images/release-v0.25.0-comic.png',alt:'篮球人生 v0.25.0 四格更新海报：大合同的资金用途与经纪人选择；退休账户、终身年金与余生收支规划；家境和陪伴影响孩子性格；孩子的成长转折与梦想。'},
    'basketball-life-7.2.0-20261115':{version:'v0.24.0',src:'assets/images/release-v0.24.0-comic.png',alt:'篮球人生 v0.24.0 四格更新海报：新增60个位置与球风相关比赛时刻；教练战术及克制；查看球员类型、搭配互补双子星；总经理可提前续约，由球员决定是否签约。'},
    'basketball-life-6.0.1-20261109':[
      {version:'v0.20.0',pageLabel:'海报 1 / 2',src:'assets/images/release-v0.20.0-league.png',alt:'篮球人生 v0.20.0 更新海报第1张：完整球队阵容、持续演进的联赛、新教练信任和助理教练晋升。'},
      {version:'v0.20.0',pageLabel:'海报 2 / 2',src:'assets/images/release-v0.20.0-life.png',alt:'篮球人生 v0.20.0 更新海报第2张：年中加入校队、家庭资产与媒体生涯、21个新成就与不朽收藏等级、新评分和旧成绩保留。'}
    ],
    'basketball-life-5.2-20261105':{src:'assets/images/release-v0.18.0-comic.png',alt:'篮球人生 v0.18.0 四格更新漫画：招牌动作可以练熟、变招、连招并传承；关键球新增选择，状态影响结果；大学和青训新增双子星故事，总经理面临续约难题；暑假休息、陪伴家人现在免费。'},
    'basketball-life-5.3-20261106':{src:'assets/images/release-v0.19.0-comic.png',alt:'篮球人生 v0.19.0 四格更新漫画：球星也能交易，一换多或换选秀权需匹配价值与薪资；球探整季追踪新秀，试训和面谈帮助选人；教练要兑现首发和时间承诺，每季可向管理层请求补强；青训孩子各有家庭和性格，对家长的承诺也要兑现。'}
  };
  const patch={version:'v0.21.0',pageLabel:'小修补',src:'assets/images/release-v0.21.0-patch.png',alt:'篮球人生 v0.21.0 小修补海报：球技评分、青训转职业、年轻选秀潜力及旧档保护。'};
  artwork['basketball-life-6.1.0-20261110']=[...artwork['basketball-life-6.0.1-20261109'],patch];
  let galleryCount=0;
  function createGallery(slides,onError,onChange){
    const figure=document.createElement('figure'),frame=document.createElement('div'),image=document.createElement('img'),message=document.createElement('p');
    const pager=document.createElement('nav'),previous=document.createElement('button'),count=document.createElement('span'),next=document.createElement('button');
    let index=0;
    figure.className='mbl-release-artwork mbl-release-gallery';figure.tabIndex=0;
    figure.setAttribute('aria-label','更新海报，共'+slides.length+'张');
    frame.className='mbl-release-frame';image.id='mbl-release-image-'+(++galleryCount);
    image.width=1024;image.height=1536;image.decoding='async';
    message.className='mbl-release-artwork-error';message.hidden=true;message.setAttribute('role','status');
    message.textContent='这张海报暂时无法加载，可切换另一张或查看完整文字更新。';
    pager.className='mbl-release-pager';pager.setAttribute('aria-label','切换更新海报');
    previous.type=next.type='button';previous.textContent='上一张';next.textContent='下一张';
    previous.setAttribute('aria-label','上一张海报');next.setAttribute('aria-label','下一张海报');
    previous.setAttribute('aria-controls',image.id);next.setAttribute('aria-controls',image.id);
    count.className='mbl-release-count';count.setAttribute('aria-live','polite');count.setAttribute('aria-atomic','true');
    function show(value){
      index=Math.max(0,Math.min(slides.length-1,value));
      figure.dataset.page=String(index+1);image.hidden=false;message.hidden=true;
      figure.dataset.version=slides[index].version||'';
      image.alt=slides[index].alt;image.src=slides[index].src;
      count.textContent=(index+1)+' / '+slides.length;
      previous.disabled=index===0;next.disabled=index===slides.length-1;
      if(typeof onChange==='function')onChange({version:slides[index].version||'',pageLabel:slides[index].pageLabel||'',index,total:slides.length});
    }
    previous.addEventListener('click',function(){show(index-1);});next.addEventListener('click',function(){show(index+1);});
    figure.addEventListener('keydown',function(event){
      if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
      event.preventDefault();event.stopPropagation();show(index+(event.key==='ArrowLeft'?-1:1));
    });
    let gesture=null;image.draggable=false;frame.style.touchAction='pan-y';
    frame.addEventListener('pointerdown',function(event){if(event.isPrimary&&event.button===0)gesture={id:event.pointerId,x:event.clientX,y:event.clientY};});
    frame.addEventListener('pointercancel',function(){gesture=null;});
    frame.addEventListener('pointerup',function(event){const start=gesture;gesture=null;if(!start||start.id!==event.pointerId)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.abs(dx)>=40&&Math.abs(dx)>Math.abs(dy)*1.3)show(index+(dx<0?1:-1));});
    image.addEventListener('error',function(){image.hidden=true;message.hidden=false;if(typeof onError==='function')onError();});
    image.addEventListener('load',function(){image.hidden=false;message.hidden=true;});
    frame.append(image,message);pager.append(previous,count,next);figure.append(frame,pager);show(0);return figure;
  }
  function createSingle(selected,onError){
    const figure=document.createElement('figure'),image=document.createElement('img');
    figure.className='mbl-release-artwork';
    image.src=selected.src;
    image.width=1024;image.height=1536;image.decoding='async';
    image.alt=selected.alt;
    image.addEventListener('error',function(){
      const message=document.createElement('p');message.className='mbl-release-artwork-error';
      message.textContent='漫画暂时未能加载，请查看下方文字更新。';figure.replaceChildren(message);
      if(typeof onError==='function')onError();
    },{once:true});
    figure.append(image);return figure;
  }
  function create(noticeId,onError,onChange){
    const selected=artwork[noticeId];if(!selected)return null;
    return Array.isArray(selected)?createGallery(selected,onError,onChange):createSingle(selected,onError);
  }
  function historySlides(noticeId){
    if(noticeId==='basketball-life-6.0.1-20261109')return artwork[noticeId].map(x=>({...x}));
    if(noticeId==='basketball-life-6.1.0-20261110')return [{...patch}];
    return null;
  }
  function announcementGroups(notice,releases){
    if(notice.id!=='basketball-life-6.1.0-20261110')return null;
    const previous=releases.find(x=>x.version==='v0.20.0');
    return previous?[{version:previous.version,items:previous.items},{version:'v0.21.0',items:notice.items}]:null;
  }
  window.MBLReleaseArtwork=Object.freeze({create,createSingle,historySlides,announcementGroups});
}());
