/* The v7 studio's layered shots, camera and motion engine, embedded in the game. */
(()=>{'use strict';
const Engine=window.KeepsakeEngine,E=window.KeepsakeExport;
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const clock=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
function create({root,D,authorize,alive=()=>true,initialKind='trailer'}){
 const section=node('section','mbl-film'),heading=node('div','mbl-film-heading'),title=node('h3','','回忆影片'),kind=node('select'),canvas=node('canvas'),controls=node('div','mbl-film-controls'),play=node('button','','播放影片'),time=node('span'),seek=node('input'),status=node('p','mbl-pass-muted');
 for(const [value,text] of [['trailer','精华 · 20秒'],['full','完整影片']]){const o=node('option','',text);o.value=value;kind.append(o);}kind.setAttribute('aria-label','影片长度');
 if(initialKind==='full')kind.value='full';
 canvas.width=720;canvas.height=1280;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',D.name+'的回忆影片画面');
 seek.type='range';seek.min='0';seek.step='.1';seek.value='0';seek.setAttribute('aria-label','影片进度');play.type='button';status.setAttribute('role','status');
 heading.append(title,kind);controls.append(play,time);section.append(heading,canvas,controls,seek,status);root.replaceChildren(section);
 const ctx=canvas.getContext('2d');let disposed=false,playing=false,starting=false,position=0,raf=0,last=0,drawToken=0,planned=null,warmTimer=0,warmChapter=null,warmPlan=null;
 const prepared=new Map(),valid=()=>!disposed&&alive();
 const clip=()=>{if(!planned||planned.kind!==kind.value)planned=Engine.plan(D,kind.value);return planned;};
 function prepareScene(c){
  if(prepared.has(c))return prepared.get(c);
  const entry={ready:false,promise:null};
  entry.promise=Promise.all([E.image(c.layers.background),E.image(c.layers.props),c.layers.foreground?E.image(c.layers.foreground):null,Promise.all((c.layers.motions||[]).map(async m=>({...m,bitmap:await E.image(m.image)}))),Promise.all(c.layers.actors.map(a=>E.image(a.image)))]).then(([bg,props,foreground,motions,actors])=>{entry.ready=true;return{c,bg,props,foreground,motions,actors};}).catch(e=>{if(prepared.get(c)===entry)prepared.delete(c);throw e;});
  prepared.set(c,entry);return entry;
 }
 function warmNext(p,index){
  const next=p.scenes[index+1];if(warmChapter===next&&warmPlan===p)return;
  clearTimeout(warmTimer);warmChapter=next;warmPlan=p;
  if(next)warmTimer=setTimeout(()=>{warmTimer=0;if(valid()&&clip()===p&&warmChapter===next)prepareScene(next).promise.catch(()=>{});},80);
 }
 function shot(scene,local,duration,alpha=1){
  const{c,bg,props,actors,foreground,motions}=scene,z=Math.min(1,local/Math.max(.001,duration)),cam=Engine.cameraAt(c,z);ctx.save();ctx.globalAlpha=alpha;ctx.scale(2/3,2/3);ctx.fillStyle='#f7f3e9';ctx.fillRect(0,0,1080,1920);ctx.fillStyle='#7a8c6f';ctx.font='22px Microsoft YaHei';ctx.fillText(D.name+' · '+D.born+' - '+D.ended,55,75);ctx.fillStyle='#253f35';E.drawText(ctx,c.title,{x:55,y:165,width:970,fontSize:51,minSize:33,lineHeight:1.3,maxLines:2,family:'SimSun,serif'});ctx.font='25px Microsoft YaHei';ctx.fillStyle='#91a081';ctx.fillText(c.year+' · '+c.age+'岁',55,286);
  ctx.save();ctx.beginPath();ctx.rect(40,350,1000,1185);ctx.clip();ctx.translate(40,350);ctx.scale(1000/1080,1185/1280);ctx.translate(540,640);ctx.scale(cam.zoom||1,cam.zoom||1);ctx.translate(-(cam.x||540),-(cam.y||640));ctx.drawImage(bg,0,0,1080,1280);ctx.drawImage(props,0,0,1080,1280);actors.forEach(a=>ctx.drawImage(a,0,0,1080,1280));if(foreground)ctx.drawImage(foreground,0,0,1080,1280);
  for(const m of motions){const k=Engine.motionAt(m,z);ctx.save();ctx.translate(k.x,k.y);ctx.rotate(k.rotate*Math.PI/180);ctx.globalAlpha*=k.opacity;ctx.drawImage(m.bitmap,-m.w*k.scale/2,-m.h*k.scale/2,m.w*k.scale,m.h*k.scale);ctx.restore();}ctx.restore();
  ctx.fillStyle='#36513e';E.drawText(ctx,c.caption||c.quote,{x:60,y:1630,width:960,fontSize:31,minSize:22,lineHeight:1.5,maxLines:4,family:'SimSun,serif'});if(c.connection){ctx.fillStyle='#7a8c6f';E.drawText(ctx,c.connection,{x:60,y:1810,width:960,fontSize:20,minSize:16,lineHeight:1.35,maxLines:2,family:'Microsoft YaHei'});}ctx.font='20px Microsoft YaHei';ctx.fillStyle='#8d9a7c';ctx.fillText(D.title+' · 篮球人生',60,1870);ctx.restore();
 }
 async function frame(t){
  const token=++drawToken,p=clip();if(!valid()||!p.segments.length)return false;
  const seg=Engine.segmentAt(p,t),previous=seg.index>0&&seg.local<.45?p.segments[seg.index-1]:null;
  const keep=new Set([p.scenes[seg.index-1],p.scenes[seg.index],p.scenes[seg.index+1]]);
  for(const c of prepared.keys())if(!keep.has(c))prepared.delete(c);
  const current=prepareScene(seg.chapter),before=previous?prepareScene(previous.chapter):null,waited=!current.ready||!!before&&!before.ready;
  if(waited)status.textContent='正在准备画面 '+(seg.index+1)+' / '+p.scenes.length+'…';
  let images;try{images=await Promise.all([current.promise,before?.promise]);}catch(e){if(!valid()||token!==drawToken)return false;throw e;}
  if(!valid()||token!==drawToken)return false;
  shot(images[0],seg.local,seg.duration);if(previous)shot(images[1],previous.duration,previous.duration,1-seg.local/.45);
  time.textContent=clock(t)+' / '+clock(Math.round(p.duration));seek.max=String(p.duration);seek.value=String(t);canvas.dataset.chapter=seg.chapter.id;status.textContent='';warmNext(p,seg.index);return waited;
 }
 function stop(){playing=false;cancelAnimationFrame(raf);last=0;play.textContent='播放影片';}
 async function tick(now){if(!valid()||!playing)return;try{if(last)position=Math.min(clip().duration,position+(now-last)/1000);const waited=await frame(position);last=waited?performance.now():now;if(!valid()||!playing)return;if(position>=clip().duration){stop();return;}raf=requestAnimationFrame(tick);}catch(e){stop();if(valid())status.textContent=e.message;}}
 play.onclick=async()=>{if(starting)return;if(playing){stop();return;}starting=true;play.disabled=true;try{if(!await authorize()||!valid())return;if(position>=clip().duration)position=0;await frame(position);if(!valid())return;playing=true;last=0;play.textContent='暂停';raf=requestAnimationFrame(tick);}catch(e){if(valid())status.textContent=e.message;}finally{starting=false;play.disabled=false;}};
 seek.oninput=()=>{position=Number(seek.value);last=0;frame(position).catch(e=>{if(valid())status.textContent=e.message;});};
 kind.onchange=()=>{stop();position=0;frame(0).catch(e=>{if(valid())status.textContent=e.message;});};
 const visibility=()=>{if(document.visibilityState==='hidden')stop();};document.addEventListener('visibilitychange',visibility);
 if(!ctx){status.textContent='当前客户端无法绘制影片。';play.disabled=kind.disabled=seek.disabled=true;}else{ctx.fillStyle='#e6e7d9';ctx.fillRect(0,0,720,1280);ctx.fillStyle='#294438';ctx.font='32px Microsoft YaHei';ctx.fillText(D.name+'的回忆影片',52,130);ctx.font='24px Microsoft YaHei';ctx.fillText('正在打开第一段回忆…',52,188);frame(0).catch(e=>{if(valid())status.textContent=e.message;});}
 return{busy:()=>starting,pause:stop,destroy(){disposed=true;drawToken++;stop();clearTimeout(warmTimer);prepared.clear();document.removeEventListener('visibilitychange',visibility);root.replaceChildren();}};
}
window.KeepsakeFilm={create};
})();
