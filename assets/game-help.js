/* Our published release history and the shared, authenticated feedback service. */
(function(){'use strict';
 const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
 const button=(text,cls)=>{const el=make('button',cls,text);el.type='button';return el;};
 const config=Object.freeze({applicationId:'app_ad6bae0e21',envId:'feedback-public-d8fnf79rd0e395c3',url:'https://feedback-public-d8fnf79rd0e395c3-1252166086.ap-shanghai.app.tcloudbase.com/api/feedback'});
 function iconButton(label,paths,cls){const el=button('','ghost small mbl-help-button '+(cls||'')),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');el.setAttribute('aria-label',label);el.title=label;for(const [key,value]of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(key,value);for(const d of paths){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);svg.append(path);}el.append(svg);return el;}
 const tools=make('span','mbl-help-tools'),updates=iconButton('查看我们的更新日志',['M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z','M14 3v6h6','M8 13h8M8 17h6'],'mbl-updates-button'),feedback=iconButton('意见反馈',['M20 11.5a8 8 0 0 1-8 8H7l-4 2v-6a8 8 0 1 1 17-4z','M8 9h8M8 13h5'],'mbl-feedback-button');
 updates.append(make('span','mbl-help-button-label','更新日志'));feedback.append(make('span','mbl-help-button-label','反馈'));
 tools.dataset.key='mbl-help-tools';updates.dataset.key='mbl-updates';feedback.dataset.key='mbl-feedback';updates.setAttribute('aria-label','查看我们的更新日志');feedback.setAttribute('aria-label','意见反馈');tools.append(updates,feedback);
 function mount(){const screen=document.querySelector('#app .screentools'),hidden=screen&&getComputedStyle(screen).display==='none';const target=document.querySelector('main.home .topbar .topright')||(hidden&&document.querySelector('main.play .menu'))||screen;if(target&&!target.contains(tools))target.prepend(tools);}
 window.addEventListener('resize',mount,{passive:true});
 window.MBLGameHelp=Object.freeze({mount});
 let queued=false;const app=document.getElementById('app');if(app)new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;mount();});}).observe(app,{childList:true,subtree:true});mount();
 function modal(title,id){const root=make('dialog','mbl-help-dialog'),head=make('header','mbl-help-head'),heading=make('h2','',title),close=button('关闭','ghost small');heading.id=id;root.setAttribute('aria-labelledby',id);head.append(heading,close);root.append(head);document.body.append(root);let focus=null;
  close.onclick=()=>root.close();root.addEventListener('close',()=>{window.MBLHost?.setAnnouncementOpen?.(false);if(focus?.isConnected)focus.focus();});
  return {root,close,show(trigger){focus=trigger||document.activeElement;if(!root.open){window.MBLHost?.setAnnouncementOpen?.(true);root.showModal();}close.focus();}};
 }
 const history=modal('更新日志','mbl-help-updates-title'),historyList=make('section','mbl-release-list');
 history.root.classList.add('mbl-history-dialog');historyList.tabIndex=0;historyList.setAttribute('role','region');historyList.setAttribute('aria-label','左右滑动查看更新日志');historyList.setAttribute('aria-roledescription','轮播');
 history.root.append(historyList);
 let activeRelease=0,releaseCount=0,scrollQueued=false;
 function goRelease(index){activeRelease=Math.max(0,Math.min(releaseCount-1,index));if(typeof historyList.scrollTo==='function')historyList.scrollTo({left:activeRelease*(historyList.clientWidth+12),behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 historyList.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();goRelease(activeRelease+(event.key==='ArrowLeft'?-1:1));}});
 historyList.addEventListener('scroll',()=>{if(scrollQueued)return;scrollQueued=true;requestAnimationFrame(()=>{scrollQueued=false;const width=historyList.clientWidth;if(width>0)activeRelease=Math.max(0,Math.min(releaseCount-1,Math.round(historyList.scrollLeft/(width+12))));});},{passive:true});
 window.addEventListener('resize',()=>{if(history.root.open)goRelease(activeRelease);},{passive:true});
 function renderHistory(){historyList.replaceChildren();const releases=(Array.isArray(window.MBLReleaseHistory)?window.MBLReleaseHistory:[]).flatMap(release=>{const slides=window.MBLReleaseArtwork?.historySlides(release.id);return slides?slides.map(slide=>({...release,slide})): [release];});
  activeRelease=0;releaseCount=releases.length;
  if(!releases.length){historyList.append(make('p','mbl-help-copy','更新记录暂不可用，请稍后重新进入。'));return;}
  releases.forEach((release,index)=>{const entry=make('article','mbl-release-entry'),summary=make('header','mbl-release-summary'),label=make('span','mbl-release-version',release.version+(release.slide?' · '+release.slide.pageLabel:'')),title=make('h3','',release.title),date=make('time','mbl-release-date');entry.tabIndex=0;entry.setAttribute('aria-label',release.version+(release.slide?' '+release.slide.pageLabel:'')+'，第'+(index+1)+'页，共'+releases.length+'页');date.dateTime=release.publishedAt;const parsed=new Date(release.publishedAt);date.textContent=Number.isNaN(parsed.getTime())?'':parsed.toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});summary.append(label,date,title);entry.append(summary);
   const details=make('details','mbl-release-details'),artwork=release.slide?window.MBLReleaseArtwork.createSingle(release.slide,()=>{details.open=true;}):window.MBLReleaseArtwork?.create(release.id,()=>{details.open=true;});
   let content=entry;if(artwork){entry.classList.add('mbl-release-comic');details.append(make('summary','','查看完整更新'));entry.append(artwork,details);content=details;}
   for(const item of release.items){const section=make('section','mbl-release-item');section.append(make('h3','',item.title));if(item.text.trim()!==item.title.trim())section.append(make('p','',item.text));content.append(section);}historyList.append(entry);
  });
 }
 // 打开子面板前先收起内核「更多」菜单，避免菜单残留在弹窗背后
 function closeKernelMenu(){const mb=document.querySelector('.moreb');if(mb&&document.querySelector('.more .menu'))mb.click();}
 function openUpdates(trigger){closeKernelMenu();renderHistory();history.show(trigger);historyList.scrollLeft=0;}
 updates.onclick=()=>openUpdates(updates);
 const formModal=modal('意见反馈','mbl-help-feedback-title'),form=make('form','mbl-feedback-form'),label=make('label','','反馈内容'),input=make('textarea'),counter=make('p','mbl-feedback-counter'),status=make('p','mbl-feedback-status'),submit=button('提交反馈','primary mbl-feedback-submit');submit.type='submit';input.id='mbl-feedback-content';label.htmlFor=input.id;input.rows=6;input.placeholder='遇到了什么问题，或有什么建议？';input.setAttribute('aria-describedby','mbl-feedback-counter mbl-feedback-status');counter.id='mbl-feedback-counter';status.id='mbl-feedback-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');counter.setAttribute('aria-live','polite');
 form.append(label,input,counter,make('p','mbl-help-copy','请勿填写手机号、密码等个人信息。'),status,submit);formModal.root.append(form);
 let busy=false;
 const length=()=>Array.from(input.value.trim()).length;
 function count(){const n=length();counter.textContent=n>2000?'已超出 '+(n-2000)+' 字':'还可输入 '+(2000-n)+' 字';submit.disabled=busy||n<1||n>2000;}
 input.addEventListener('input',()=>{if(!busy)status.textContent='';count();});count();
 function openFeedback(trigger){closeKernelMenu();status.textContent='';count();formModal.show(trigger);input.focus();}
 feedback.onclick=()=>openFeedback(feedback);
 formModal.root.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 async function within(job,ms,message,failure){let timer;try{return await Promise.race([Promise.resolve().then(job).catch(()=>{throw Error(failure||message);}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]);}finally{clearTimeout(timer);}}
 function guard(epoch){if(epoch!==undefined&&window.MBLPlatform?.archiveEpoch?.()!==epoch)throw Error('账号状态已改变，请重新打开反馈后提交。');}
 form.addEventListener('submit',async event=>{event.preventDefault();if(busy)return;const content=input.value.trim(),n=Array.from(content).length;if(n<1||n>2000){status.textContent='请输入1至2000字的反馈内容。';count();return;}
  busy=true;input.disabled=formModal.close.disabled=true;submit.textContent='正在提交…';status.textContent='';count();const epoch=window.MBLPlatform?.archiveEpoch?.();
  try{const sdk=window.ColorboxAI;if(!sdk?.auth?.getUserInfo||!sdk?.cloud?.request)throw Error('请在虎扑App中登录后提交反馈。');
   const user=await within(()=>sdk.auth.getUserInfo(),10000,'登录状态检测超时，反馈尚未提交，请稍后重试。','登录状态读取失败，反馈尚未提交，请稍后重试。');guard(epoch);if(user?.code!==200||user.data?.islogin!==1)throw Error('请先登录虎扑，再提交反馈。');
   if(typeof sdk.security?.checkAudit!=='function')throw Error('内容检测暂不可用，反馈尚未提交，请稍后重试。');
   const audit=await within(()=>sdk.security.checkAudit(content),10000,'内容检测超时，反馈尚未提交，请稍后重试。','内容检测暂不可用，反馈尚未提交，请稍后重试。');guard(epoch);if(audit?.code===401)throw Error('登录已失效，请重新登录后提交。');if(audit?.code!==200||typeof audit.data!=='boolean')throw Error('内容检测暂未完成，反馈尚未提交，请稍后重试。');if(!audit.data)throw Error('反馈内容未通过检测，请修改后重试。');
   const data={applicationId:config.applicationId,content};if(typeof user.data.nickname==='string'&&user.data.nickname.trim())data.nickname=user.data.nickname.trim();const raw=user.data.avatar||user.data.userHeadUrl;if(typeof raw==='string'){try{const avatar=new URL(raw.trim());if(avatar.protocol==='https:'&&!avatar.username&&!avatar.password)data.avatarUrl=avatar.href;}catch{}}
   const response=await within(()=>sdk.cloud.request({url:config.url,method:'POST',data,envId:config.envId,auth:true}),20000,'提交结果暂不确定，请稍后确认后再试，避免重复提交。');guard(epoch);
   if(response?.statusCode===201&&response.code===0&&response.data?.id){input.value='';status.textContent='反馈已提交，感谢你的建议。';}
   else if(response?.statusCode===401)throw Error('登录已失效，请重新登录后提交。');
   else if(response?.statusCode===413)throw Error('反馈内容过长，请精简后提交。');
   else if(response?.statusCode===429)throw Error('提交过于频繁，请稍后再试。');
   else if(response?.statusCode===400)throw Error('反馈内容不符合要求，请修改后重试。');
   else throw Error('提交结果暂不确定，请稍后确认后再试，避免重复提交。');
  }catch(error){status.textContent=typeof error?.message==='string'?error.message:'提交结果暂不确定，请稍后确认后再试。';}
  finally{busy=false;input.disabled=formModal.close.disabled=false;submit.textContent='提交反馈';count();}
 });
 window.MBLHelp=Object.freeze({openUpdates,openFeedback});
}());
