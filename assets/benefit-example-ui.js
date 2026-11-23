/* Three public keepsakes from one existing simulated career. No player-save access. */
(()=>{'use strict';
 const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
 const types=[['film','回忆影片','播放完整影片'],['book','人生记录册','翻阅完整经历'],['poster','总览长图','查看纪念长图']];
 let pending=null;
 function load(){
  if(window.MBLBenefitExampleLife)return Promise.resolve(window.MBLBenefitExampleLife);
  if(pending)return pending;
  pending=new Promise((resolve,reject)=>{const script=make('script');let timer;const done=error=>{clearTimeout(timer);script.onload=script.onerror=null;if(error){script.remove();pending=null;reject(error);}else resolve(window.MBLBenefitExampleLife);};script.src='assets/member-example-life.js';script.onload=()=>done(window.MBLBenefitExampleLife?null:Error('珍藏数据未能读取，请重试。'));script.onerror=()=>done(Error('珍藏未能载入，请重试。'));timer=setTimeout(()=>done(Error('珍藏载入超时，请重试。')),15000);document.head.append(script);});
  return pending;
 }
 function create(){
  const data=window.MBLBenefitExample,section=make('section','mbl-benefit-showcase');
  if(!data?.frames?.length){section.append(make('p','','珍藏暂未准备好。'));return {element:section,activate(){},deactivate(){},isOpen:()=>false};}
  const header=make('div','mbl-example-heading');header.append(make('h3','','同一份人生，三种珍藏'),make('p','',''+data.name+' · '+data.born+'—'+data.ended+' · 原版模拟存档'));section.append(header);
  const cards=make('div','mbl-example-cards'),images=[];
  const image=(index,alt)=>{const im=make('img');im.alt=alt;im.decoding='async';images.push([im,data.frames[index].src]);return im;};
  let active=false,dialog=null,stage=null,tabs=null,notice=null,kind='film',film=null,returnFocus=null,token=0,posterURL='',posterPromise=null;
  for(const [key,label,copy] of types){
   const card=make('button','mbl-example-card'),art=make('div','mbl-example-thumb mbl-example-thumb-'+key);card.type='button';card.dataset.exampleOpen=key;card.setAttribute('aria-label',({film:'观看回忆影片',book:'翻阅人生记录册',poster:'查看总览长图'})[key]);
   if(key==='film'){art.append(image(1,'何海涛的回忆影片画面'),make('span','mbl-example-play','▷'));}
   if(key==='book'){const paper=make('div','mbl-example-book-cover');paper.append(make('small','','人生记录册'),make('strong','',data.name),make('span','',data.born+'—'+data.ended),make('small','',data.events+'条经历 · '+data.seasons+'季'),image(2,'何海涛的记录册封面画面'));art.append(paper);}
   if(key==='poster'){const paper=make('div','mbl-example-poster-cover'),top=make('div');top.append(make('small','','一生珍藏'),make('strong','',data.name),make('small','',data.born+'—'+data.ended));paper.append(top,make('small','',data.age+'年人生 / '+data.seasons+'季 / '+data.titles+'冠'));const grid=make('div');for(let i=0;i<3;i++)grid.append(image(i,'长图中的'+data.frames[i].title));paper.append(grid);art.append(paper);}
   card.append(art,make('b','',label),make('small','',copy+' ↗'));card.onclick=()=>open(key,card);cards.append(card);
  }
  section.append(cards,make('p','mbl-example-note','何海涛 · 96年人生、1228条经历、14个职业赛季，完整收录。'));
  function stop(){film?.destroy();film=null;}
  function showTab(value){kind=value;for(const b of tabs.children){const selected=b.dataset.exampleTab===kind;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;if(selected)stage.setAttribute('aria-labelledby',b.id);}dialog.classList.toggle('mbl-pass-book',kind==='book');}
  function showBook(D){
   const root=make('div','mbl-example-full-book');root.append(document.getElementById('mbl-book-template').content.cloneNode(true));
   for(const e of root.querySelectorAll('[id]')){e.dataset.mblBookId=e.id;e.id='mbl-public-example-'+e.id;}
   for(const e of root.querySelectorAll('[aria-controls],[aria-labelledby],[for]'))for(const attr of ['aria-controls','aria-labelledby','for'])if(e.hasAttribute(attr))e.setAttribute(attr,e.getAttribute(attr).split(' ').map(x=>'mbl-public-example-'+x).join(' '));
   const $=id=>root.querySelector('[data-mbl-book-id="'+id+'"]'),reader=BookReader.create(root);let limit=60;
   const select=value=>{for(const tab of root.querySelectorAll('[data-tab]')){const on=tab.dataset.tab===value;tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;$(tab.dataset.tab+'-panel').hidden=!on;}};
   const events=()=>reader.events(D,limit),reset=()=>{limit=60;reader.reset(D);events();},year=$('year-filter'),search=$('memory-search');
   year.replaceChildren(make('option','','全部年份'));year.firstChild.value='all';for(const y of [...new Set(D.events.map(e=>e.year))]){const option=make('option','',y);option.value=String(y);year.append(option);}
   reader.render(D,{openYear:y=>{year.value=String(y);search.value='';reset();select('events');},openPerson:p=>{year.value='all';search.value=p.name;reader.reset(D);reader.person(p);limit=60;events();select('events');},openAlbum:()=>render('film'),refresh:events});
   const subtitle=root.querySelector('.view-title p');if(subtitle)subtitle.textContent=D.name+' · '+D.age+'年人生，'+D.events.length+'段经历。';
   for(const tab of root.querySelectorAll('[data-tab]')){tab.onclick=()=>select(tab.dataset.tab);tab.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const all=[...root.querySelectorAll('[data-tab]')],i=all.indexOf(tab),next=e.key==='Home'?0:e.key==='End'?all.length-1:(i+(e.key==='ArrowRight'?1:all.length-1))%all.length;all[next].click();all[next].focus();};}
   year.onchange=reset;search.oninput=reset;$('more-events').onclick=()=>{limit+=60;events();};$('clear-filters').onclick=()=>{year.value='all';search.value='';reset();};
   select('overview');events();stage.append(root);
  }
  async function render(value){
   const job=++token;stop();showTab(value);stage.replaceChildren();notice.textContent='正在打开'+types.find(x=>x[0]===value)[1]+'珍藏…';
   try{const D=await load();if(job!==token||!dialog.open||!active)return;notice.textContent='';
    if(kind==='film'){film=KeepsakeFilm.create({root:stage,D,initialKind:'full',authorize:async()=>true,alive:()=>active&&dialog.open&&kind==='film'&&job===token});return;}
    if(kind==='book'){showBook(D);return;}
    if(!posterURL){notice.textContent='正在生成完整纪念长图…';if(!posterPromise)posterPromise=PhoneKeepsake.create(D).then(async built=>{try{const blob=await KeepsakeExport.blobOf(built.canvas);return URL.createObjectURL(blob);}finally{built.canvas.width=built.canvas.height=1;}}).catch(e=>{posterPromise=null;throw e;});posterURL=await posterPromise;}
    if(job!==token||!dialog.open)return;const img=make('img','mbl-example-full-poster');img.src=posterURL;img.alt=D.name+'的完整人生纪念长图';stage.append(img);notice.textContent='总览长图 · '+D.chapter.length+'段入选回忆，完整经历见人生记录册。';
   }catch(e){if(job===token&&dialog.open){notice.textContent=e.message||'珍藏暂未打开。';const retry=make('button','mbl-pass-retry','重新打开珍藏');retry.type='button';retry.onclick=()=>render(kind);stage.append(retry);}}
  }
  function open(value,trigger){
   if(!active)return;returnFocus=trigger;
   if(!dialog){dialog=make('dialog','mbl-pass-modal mbl-benefit-demo');const head=make('div','mbl-pass-head'),title=make('h2','','何海涛的人生珍藏'),close=make('button','','关闭');title.id='mbl-example-title';dialog.setAttribute('aria-labelledby',title.id);close.type='button';close.onclick=()=>dialog.close();head.append(title,close);tabs=make('div','mbl-benefit-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','同一份人生的三种珍藏');
    for(const [key,label] of types){const b=make('button','',label);b.type='button';b.dataset.exampleTab=key;b.id='mbl-example-tab-'+key;b.setAttribute('role','tab');b.setAttribute('aria-controls','mbl-example-stage');b.onclick=()=>render(key);tabs.append(b);}
    tabs.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const i=types.findIndex(t=>t[0]===kind),next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;tabs.children[next].click();tabs.children[next].focus();};
    stage=make('div','mbl-example-stage');stage.id='mbl-example-stage';stage.setAttribute('role','tabpanel');notice=make('p','mbl-benefit-description');notice.setAttribute('role','status');dialog.append(head,tabs,notice,stage,make('p','mbl-example-note','何海涛 · 原版模拟存档的完整珍藏。持卡后新开的人生记录画面，旧存档不补采。'));document.body.append(dialog);
    dialog.addEventListener('close',()=>{token++;stop();stage.replaceChildren();if(returnFocus?.isConnected&&active)returnFocus.focus();});
   }
   dialog.showModal();render(value);dialog.querySelector('.mbl-pass-head button').focus();
  }
  window.addEventListener('pagehide',()=>{stop();if(posterURL)URL.revokeObjectURL(posterURL);});
  return {element:section,activate(){active=true;for(const [im,src] of images)if(!im.getAttribute('src'))im.src=src;},deactivate(){active=false;token++;stop();if(dialog?.open)dialog.close();},isOpen:()=>!!dialog?.open};
 }
 window.MBLBenefitPreview={create};
})();
