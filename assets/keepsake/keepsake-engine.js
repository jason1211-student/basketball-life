(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.KeepsakeEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const VERSION='4.0.0',label=v=>typeof v==='string'?v:v?.hans||v?.en||'',clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const camera=(zoom,x=540,y=640)=>({zoom,x,y});
// Recipes describe presentation only. Their facts always come from the selected save.
const RECIPES={
 contract:{scene:'contract',category:'career',requires:['state'],assets:['LP','oc'],posterTime:.55,beats:['contract','signature','player'],shots:[{at:0,...camera(1)},{at:.42,...camera(1.22,540,500)},{at:1,...camera(1.05,540,650)}]},
 retirement:{scene:'retirement',category:'career',requires:['state'],assets:['oc'],posterTime:.65,beats:['jersey','farewell','next-chapter'],shots:[{at:0,...camera(1.12,730,410)},{at:.48,...camera(1.02)},{at:1,...camera(1.12,380,850)}]},
 'last-shot':{scene:'last-shot',category:'legacy',requires:['state'],assets:['xse','characterParts.ball'],posterTime:.72,beats:['set','release','rim','basket'],shots:[{at:0,...camera(1.08,420,820)},{at:.4,...camera(1)},{at:.73,...camera(1.25,760,400)},{at:1,...camera(1.02)}]},
 'child-wedding':{scene:'child-wedding',category:'family',requires:['state','childName'],assets:['_le.arch','wre.mic'],posterTime:.55,beats:['garden','child','speech'],shots:[{at:0,...camera(1)},{at:.46,...camera(1.16,675,650)},{at:1,...camera(1.08,380,800)}]},
 anniversary:{scene:'anniversary',category:'family',requires:['state'],assets:['Ale','NP'],posterTime:.65,beats:['table','couple','shared-years'],shots:[{at:0,...camera(1.03)},{at:.52,...camera(1.15,540,850)},{at:1,...camera(1.04)}]}
};
function eventFacts(career,c){
 const e=career.events[c.sourceEvent]||c,m=career.normalized.moment(c.age),s=m.state,year=c.year;
 const season=career.data.seasons.find(q=>q.year===year),team=season?.teamRaw||s?.ball?.pro?.team||null;
 const childName=/^(.+?)结婚了。你的致辞/.exec(e.text||c.quote)?.[1]||null;
 const child=childName?s?.children?.find(p=>label(p.name)===childName):null;
 const relation=childName?(career.normalized.entities.find(p=>p.role==='孩子'&&p.name===childName)||career.events.find(e=>e.text.startsWith('你的孩子'+childName+'出生了'))):null;
 return{eventIndex:c.sourceEvent,age:c.age,year,quote:e.text||c.quote,state:s,quality:m.quality,derived:m.derived,missing:[...m.missing],team,teamName:label(team),number:String(season?.num||s?.ball?.number||''),childName:child||relation?childName:null,childPresent:!!child&&child.alive!==false,partnerName:s?.partner?.alive!==false?label(s?.partner?.name):'',variant:/助理教练|主教练/.test(c.quote)?'coaching':'farewell',contractTeam:/^你和(.+?)签下了/.exec(c.quote)?.[1]||'',hasCooking:/下厨|做饭|烹饪/.test(c.quote),hasGarden:/花园/.test(c.quote)};
}
function recipeFor(c,f){
 if(c.scene==='contract')return'contract';
 if(c.scene==='retirement')return'retirement';
 if(c.scene==='last-shot')return'last-shot';
 if(f.childName)return'child-wedding';
 if(c.scene==='couple'&&/纪念日/.test(c.quote))return'anniversary';
 return null;
}
function enrichCareer(career){
 const D=career.data;
 D.engineVersion=VERSION;
 for(const c of D.chapter){const f=eventFacts(career,c),id=recipeFor(c,f),r=RECIPES[id];
  c.facts={eventIndex:f.eventIndex,age:f.age,year:f.year,quality:f.quality,stateAvailable:!!f.state,derived:f.derived,missing:f.missing,team:f.teamName,number:f.number,childName:f.childName,partnerName:f.partnerName,variant:f.variant,hasCooking:f.hasCooking,hasGarden:f.hasGarden};
  c.recipe=id;c.category=c.category||r?.category||(/wedding|newborn|family|quiet|couple/.test(c.scene)?'family':/mentor|protege|foundation|summer|ending/.test(c.scene)?'legacy':'career');
  c.shotPlan=r?r.shots.map(k=>({...k})):[{at:0,...camera(1)},{at:1,...camera(1.07,540,610)}];
  c.presentationMode=r&&r.requires.some(k=>k==='state'?!f.state:!f[k])?'objects-only':'scene';c.posterTime=r?.posterTime??.5;c.beats=r?[...r.beats]:['memory'];
  c.layout=id==='last-shot'?'action':id==='contract'?'document':id==='child-wedding'||id==='anniversary'?'relationship':'memory';
  if(r){c.originalScene=c.scene;c.scene=r.scene;}
  if(id==='contract'&&f.contractTeam)c.title='与'+f.contractTeam+'签下第一份合约';
  if(id==='retirement'&&f.variant==='coaching')c.title='从球员，走到场边';
  if(id==='child-wedding')c.title=f.childName+'，成家了';
  if(c.id==='home-again')c.title='家乡记住了这一年';
  // Keep full factual quotation. Text used by pictures is fitted separately, never rewritten.
  c.caption=c.quote;c.readSeconds=clamp(1.7+[...c.caption].length/9,3.7,11);
 }
 D.duration=plan(D,'full').duration;return career;
}
function plan(D,kind='full'){
 let scenes=D.chapter||[],budget=null;
 if(kind==='bonus'){scenes=D.bonus?[D.bonus]:[];budget=15;}
 if(kind==='trailer'){
  const picked=[];for(const category of [...new Set([D.narrative?.theme,...scenes.map(c=>c.category)].filter(Boolean))].slice(0,3)){const candidates=scenes.filter(c=>c.category===category&&c.scene!=='ending');if(candidates.length)picked.push(candidates.slice().sort((a,b)=>(b.selection?.baseScore||0)-(a.selection?.baseScore||0)||a.sourceEvent-b.sourceEvent)[0]);}
  if(scenes[0])picked.push(scenes[0]);if(scenes.at(-1))picked.push(scenes.at(-1));scenes=[...new Set(picked)].sort((a,b)=>a.sourceEvent-b.sourceEvent);budget=20;
 }
 if(!scenes.length)return{kind,duration:0,scenes:[],segments:[]};
 const natural=scenes.map(c=>Math.max(c.readSeconds||1.7+[...String(c.caption||c.quote||'')].length/9,(c.beats?.length||1)*1.4,3.7)),sum=natural.reduce((a,b)=>a+b,0);
 const scale=budget?budget/sum:Math.min(1,180/sum);let at=0;
 const segments=scenes.map((c,i)=>{const duration=natural[i]*scale,s={chapter:c,start:at,end:at+duration,duration,readingCompressed:duration+.01<(c.readSeconds||0)};at=s.end;return s;});
 return{kind,duration:at,scenes,segments};
}
function segmentAt(p,time){const s=p.segments.find(s=>time<s.end)||p.segments.at(-1);return s?{...s,local:clamp(time-s.start,0,s.duration),progress:clamp((time-s.start)/s.duration,0,1),index:p.segments.indexOf(s)}:null;}
function sample(frames,t,keys){if(!frames?.length)return{};let a=frames[0],b=frames.at(-1);for(let i=1;i<frames.length;i++){if(t<=frames[i].at){a=frames[i-1];b=frames[i];break;}}const raw=clamp((t-a.at)/Math.max(.0001,b.at-a.at),0,1),u=raw*raw*(3-2*raw),out={};for(const k of keys)out[k]=Number(a[k]??b[k]??0)+(Number(b[k]??a[k]??0)-Number(a[k]??b[k]??0))*u;return out;}
function cameraAt(c,t){return sample(c.shotPlan?.length?c.shotPlan:[{at:0,...camera(1)},{at:1,...camera(1.05)}],t,['zoom','x','y']);}
function motionAt(m,t){return sample(m.keyframes,t,['x','y','scale','opacity','rotate']);}
const NO_START=/[，。！？；：、）》」』】…”’.,!?;:]/,NO_END=/[（《「『【“‘]/;
function lines(text,measure,width){const out=[];let row='';for(const ch of String(text??'')){if(ch==='\n'){out.push(row);row='';continue;}if(row&&measure(row+ch)>width){if(NO_START.test(ch)){const tail=row.at(-1);out.push(row.slice(0,-1));row=tail+ch;continue;}let carry='';if(NO_END.test(row.at(-1))){carry=row.at(-1);row=row.slice(0,-1);}out.push(row);row=carry+ch;}else row+=ch;}if(row)out.push(row);return out;}
function fitText(ctx,text,{width,maxLines,fontSize,minSize=18,family='Microsoft YaHei',weight='normal'}){let size=fontSize,rows;do{ctx.font=weight+' '+size+'px '+family;rows=lines(text,t=>ctx.measureText(t).width,width);if(rows.length<=maxLines||size<=minSize)break;size--;}while(size>=minSize);return{lines:rows,size,overflow:rows.length>maxLines,font:ctx.font};}
function quality(D){
 const findings=[],add=(level,code,c,message)=>findings.push({level,code,chapter:c?.id||null,message});let previous=-1;
 for(const c of D.chapter){
  if(c.sourceEvent<=previous)add('error','EVENT_ORDER',c,'片段没有按原始事件顺序排列');previous=c.sourceEvent;
  for(const index of c.relatedEvents||[])if(!D.chapter.some(q=>q.sourceEvent===index))add('error','INVALID_STORY_LINK',c,'关联节点不在当前选片中');
  const original=D.events[c.sourceEvent];if(!original||original.text!==c.quote||original.year!==c.year)add('error','SOURCE_MISMATCH',c,'事件文字或年份不匹配原始记录');
  if(c.recipe){const r=RECIPES[c.recipe];if(c.scene!==r.scene)add('error','RECIPE_SCENE_MISMATCH',c,'场景与配方不匹配');if(!c.recipeApplied)add('error','RECIPE_NOT_RENDERED',c,'配方未经过场景绘制');}
  if(c.scene==='memory')add('info','ILLUSTRATIVE_MEMORY',c,'该片段采用通用场景示意，未还原具体动作');
  if(c.renderFallback)add('warning','GENERIC_SCENE',c,'使用通用构图');
  if(c.illustrationMode!=='snapshot')add('info','HISTORICAL_DETAIL_LIMITED',c,c.illustrationMode==='text-only'?'缺少人物状态，采用物件和文字':'历史事实推导画面，未还原当年全部外观');
  if(c.facts?.missing?.length)add('info','FACTS_MISSING',c,c.facts.missing.join('、'));
  if(c.recipe==='child-wedding'&&!c.people?.some(p=>p.role==='child'&&p.name===c.facts.childName))add('info','CHILD_PORTRAIT_UNAVAILABLE',c,'缺少当年孩子状态，未补造婚礼人物');
  if(c.recipe==='anniversary'&&!c.people?.some(p=>p.role==='partner'))add('info','PARTNER_PORTRAIT_UNAVAILABLE',c,'缺少可核实的当年伴侣，画面使用物件');
  for(const p of c.people||[])if(p.bounds&&(p.bounds.x<0||p.bounds.y<0||p.bounds.x+p.bounds.w>1080||p.bounds.y+p.bounds.h>1280))add('error','ACTOR_OUT_OF_BOUNDS',c,'人物超出场景边界：'+p.name);
  if(/\{[^{}]+\}/.test(c.quote))add('warning','UNRESOLVED_CAPTION',c,'原始文字含未解析参数');
  if([...c.caption||c.quote].length>180)add('warning','LONG_CAPTION',c,'字幕较长，导出时需排版检查');
 }
 const film=plan(D,'full');if(film.segments.some(s=>s.readingCompressed))add('warning','READING_TIME_COMPRESSED',null,'影片达到180秒上限，部分字幕阅读时间被压缩');
 return{engineVersion:VERSION,chapters:D.chapter.length,recipes:Object.fromEntries(Object.keys(RECIPES).map(k=>[k,D.chapter.filter(c=>c.recipe===k).length])),errors:findings.filter(f=>f.level==='error').length,warnings:findings.filter(f=>f.level==='warning').length,findings,duration:film.duration};
}
return{VERSION,RECIPES,enrichCareer,eventFacts,plan,segmentAt,cameraAt,motionAt,lines,fitText,quality};
});
