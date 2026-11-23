(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StorySelector=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const VERSION='4.0.0',label=v=>typeof v==='string'?v:v?.hans||v?.en||'',clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const POLICY={maxNodes:12,maxSameType:2,maxSameAge:2,maxUnknown:3,categoryBonus:3,phaseBonus:3,themeBonus:3,typePenalty:4,scenePenalty:1.7,nearAgePenalty:2};
// Every rule is applied to every compatible save. There are no name, seed or archive branches.
const RULES=[
 {type:'contract',category:'career',scene:'contract',weight:9,match:t=>/^你和.+签下了第一份职业合约/.test(t),title:()=> '第一份职业合约'},
 {type:'jersey',category:'career',scene:'jersey',weight:8,match:t=>/^你第一次穿上/.test(t),title:t=>(t.match(/球衣[：:]\s*(\d+)号/)?.[1]||'')+'号，第一次穿上'},
 {type:'retirement',category:'career',scene:'retirement',weight:9,match:t=>/^打了\d+个职业赛季后，你宣布退役/.test(t),title:()=> '告别球员生涯'},
 {type:'coaching',category:'mentorship',scene:'retirement',weight:8,match:t=>/^你(?:开始当|升上了|成为|成了).*(?:主教练|助理教练)/.test(t),title:()=> '走到场边，换一个位置'},
 {type:'mentor-meet',category:'mentorship',scene:'mentor',weight:7,match:t=>/^.+是你在.+的教练[。！]?$/.test(t)||/^你在.+的教练是.+[。！]?$/.test(t),title:t=>(t.match(/^(.+?)是你在/)?.[1]||t.match(/教练是(.+?)[。！]?$/)?.[1]?.replace(/[。！]$/,'' )||'一位教练')+'成为你的教练'},
 {type:'mentor-visit',category:'mentorship',scene:'mentor-seat',weight:8,match:t=>/^你在.+的教练.+来看了你的第一场职业比赛/.test(t),title:t=>(t.match(/教练(.+?)来看/)?.[1]||'教练')+'来到看台'},
 {type:'mentor-loss',category:'mentorship',scene:'mentor-memory',weight:8,match:t=>/^你在.+时的教练.+过世了/.test(t),title:t=>'和'+(t.match(/教练(.+?)在\d+岁/)?.[1]||'教练')+'告别'},
 {type:'student-meet',category:'mentorship',scene:'protege',weight:8,match:t=>/^你成了.+的贵人。/.test(t),title:t=>'开始指导'+(t.match(/^你成了(.+?)的贵人/)?.[1]||'另一个人')},
 {type:'student-contract',category:'mentorship',scene:'first-call',weight:9,match:t=>/^你一手带大的.+第一份职业合约/.test(t),title:()=> '等到门生的第一份合约'},
 {type:'marriage',category:'family',scene:'wedding',weight:8,match:t=>/^你和.+结婚了[。！!]/.test(t),title:t=>'和'+(t.match(/^你和(.+?)结婚了/)?.[1]||'伴侣')+'成家'},
 {type:'divorce',category:'family',scene:'quiet',weight:9,match:t=>/^你和.+决定离婚/.test(t),title:()=> '一段关系，在这里改变'},
 {type:'child-birth',category:'family',scene:'newborn',weight:7,match:t=>/^你的孩子.+出生了/.test(t),title:t=>(t.match(/^你的孩子(.+?)出生了/)?.[1]||'孩子')+'出生了'},
 {type:'child-wedding',category:'family',scene:'family',weight:7,match:t=>/^.+结婚了。你的致辞/.test(t),title:t=>(t.match(/^(.+?)结婚了/)?.[1]||'孩子')+'，成家了'},
 {type:'anniversary',category:'family',scene:'couple',weight:5,match:t=>/^纪念日\s*·/.test(t),decision:true,title:()=> '又一个纪念日'},
 {type:'family-support',category:'family',scene:'family-award',weight:7,match:t=>/妈妈把菜单带回家/.test(t),title:()=> '家人留下的一份记忆'},
 {type:'family-stands',category:'family',scene:'stands',weight:8,match:t=>/^你.*(?:妻子|丈夫)和孩子们面前/.test(t),title:()=> '抬头，看见家人'},
 {type:'partner-loss',category:'family',scene:'quiet',weight:9,match:(t,e,ctx)=>ctx.people.some(p=>p.role==='伴侣'&&t.startsWith(p.name))&&/过世了.*相伴/.test(t),title:()=> '和相伴的人告别'},
 {type:'parent-loss',category:'family',scene:'quiet',weight:8,match:(t,e,ctx)=>/过世了|去世了/.test(t)&&(/^你的(?:父亲|母亲|爸爸|妈妈)/.test(t)||ctx.people.some(p=>['父亲','母亲'].includes(p.role)&&t.startsWith(p.name))),title:()=> '家里的一个人，离开了'},
 {type:'injury',category:'resilience',scene:'memory',weight:8,match:t=>/^你(?:在[^。]{0,24})?(?:扭伤了|骨折了|撕裂了|受伤了|被诊断为)/.test(t)&&!t.includes(' · '),title:()=> '一次伤病'},
 {type:'return',category:'resilience',scene:'court',weight:8,match:t=>/^你(?:终于|又|已经)?(?:伤愈|重返赛场|复出了|重新回到球场)/.test(t)&&!t.includes(' · '),title:()=> '又回到了球场'},
 {type:'setback',category:'resilience',scene:'memory',weight:7,match:t=>/^你(?:在[^。]{0,24})?(?:落选了|被裁掉|被球队裁掉|没有拿到|失去了主力|没能进入|失去了工作)/.test(t),title:()=> '计划遇到了一次转折'},
 {type:'transfer',category:'career',scene:'contract',weight:6,match:t=>/^(?:交易正式完成，你加盟了|你(?:被交易到|转会到|加盟了))/.test(t),title:()=> '换一支球队，继续走'},
 {type:'champion',category:'career',scene:'champion',weight:9,match:(t,e,ctx)=>/拿下.+总冠军|赢得.+总冠军|夺得.+总冠军|你.*夺冠了/.test(t)&&(/^你的球队|^你.*夺冠了/.test(t)||/你在场上|这是你的第\d+座冠军/.test(t)||ctx.seasons.some(s=>s.champion&&s.year===e.year&&t.startsWith(label(s.teamRaw||s.team)))),title:()=> '拿到一座冠军'},
 {type:'school-title',category:'career',scene:'pennant',weight:7,match:t=>/^你.*(?:青训联赛冠军|校际冠军|大学联赛冠军)/.test(t),title:()=> '成长路上的一座冠军'},
 {type:'award',category:'career',scene:'achievement',weight:7,match:t=>/^你(?:入选了|获得了|拿下了).*(?:全明星|最佳|MVP|奖项|名人堂)/.test(t),title:()=> '这一年，被人记住'},
 {type:'foundation',category:'legacy',scene:'foundation',weight:8,match:t=>/^你成立了.+基金会/.test(t),title:()=> '把帮助交给更多人'},
 {type:'summer',category:'legacy',scene:'summer',weight:6,match:t=>/基金会的规模已经能办自己的夏令营/.test(t),title:()=> '后来，更多人来到这里'},
 {type:'rafters',category:'legacy',scene:'rafters',weight:9,match:t=>/为你退役了\d+号球衣/.test(t),title:t=>(t.match(/退役了(\d+)号球衣/)?.[1]||'')+'号，留在球馆'},
 {type:'last-shot',category:'legacy',scene:'last-shot',weight:8,match:t=>/球在篮框上转了一圈/.test(t),title:()=> '再投一个罚球'},
 {type:'school',category:'growth',scene:'home',weight:5,match:t=>/^你(?:上小学了|考上了|进入了|被录取到)/.test(t),title:()=> '走进一个新的地方'},
 {type:'dating',category:'family',scene:'memory',weight:5,match:t=>/^你和.+开始交往/.test(t),title:()=> '一段关系，从这里开始'},
 {type:'grandchild',category:'family',scene:'home',weight:6,match:t=>/^孙辈出生了/.test(t),title:()=> '家里又多了一代人'}
];
function peopleOf(n){
 const people=(n.entities||[]).map(p=>({role:p.role,name:p.name})),add=(role,name)=>{if(name&&!people.some(p=>p.role===role&&p.name===name))people.push({role,name});};
 for(const e of n.events){let m;if((m=e.text.match(/^你和(.+?)(?:结婚了|决定离婚|开始交往)/)))add('伴侣',m[1]);if((m=e.text.match(/^你的孩子(.+?)出生了/)))add('孩子',m[1]);if((m=e.text.match(/^(.+?)是你在.+的教练[。！]?$/)))add('教练',m[1].replace(/[。！]$/,''));if((m=e.text.match(/^你在.+的教练是(.+?)[。！]?$/)))add('教练',m[1].replace(/[。！]$/,''));if((m=e.text.match(/^你成了(.+?)的贵人/)))add('门生',m[1]);}
 return people;
}
function mentions(text,p){if(p.name.length>=2)return text.includes(p.name);return text.startsWith(p.name)||text.includes('孩子'+p.name)||text.includes('和'+p.name)||text.includes('给'+p.name)||text.includes('成了'+p.name+'的贵人')||text.includes('大的'+p.name+'和');}
function select(n,{seasons=[],maxNodes=POLICY.maxNodes}={}){
 maxNodes=clamp(Math.floor(Number(maxNodes)||POLICY.maxNodes),2,24);
 const people=peopleOf(n),ctx={people,seasons},first=n.events[0],last=n.events.at(-1),ageSpan=Math.max(1,last.age-first.age),counts=new Map();
 const candidate=n.events.map(e=>{
  const decision=e.kind==='decision'||e.text.includes(' · '),rule=RULES.find(r=>(!decision||r.decision)&&r.match(e.text,e,ctx));
  const type=rule?.type||'memory',category=rule?.category||'ordinary',scene=rule?.scene||'memory';
  const entities=people.filter(p=>mentions(e.text,p)).map(p=>p.role+'|'+p.name),signature=type+'|'+entities.join(',')+'|'+e.text.replace(/\d+(?:\.\d+)?/g,'#');counts.set(signature,(counts.get(signature)||0)+1);
  return{e,type,category,scene,rule,entities,signature,decision,weight:rule?.weight??(decision?.3:1),phase:clamp(Math.floor((e.age-first.age)/ageSpan*4),0,3)};
 });
 for(const c of candidate){c.rarity=2/Math.sqrt(counts.get(c.signature));c.base=c.weight+c.rarity+(c.e.kind==='milestone'?1:0);}
 const findType=t=>candidate.filter(c=>c.type===t),arcs=[];
 const addArc=(kind,label,entries,strength,category)=>{const items=[...new Set(entries)].filter(Boolean).sort((a,b)=>a.e.index-b.e.index);if(items.length<2||items[0].e.index===items.at(-1).e.index)return;arcs.push({kind,label,category,strength,events:items.map(c=>c.e.index),start:items[0].e.index,end:items.at(-1).e.index});};
 for(const p of people){const key=p.role+'|'+p.name,items=candidate.filter(c=>c.rule&&c.entities.includes(key));if(items.length<2)continue;const changes=new Set(items.map(c=>c.type));
  if(p.role==='伴侣'&&items.some(c=>c.type==='marriage'))addArc('relationship',p.name+'的相关记录',items,7+Math.min(4,changes.size), 'family');
  if(p.role==='教练'&&changes.has('mentor-meet'))addArc('mentor',p.name+'的相关记录',items,6+Math.min(3,changes.size),'mentorship');
  if(p.role==='孩子'&&changes.has('child-birth'))addArc('child',p.name+'的成长记录',items,6+Math.min(3,changes.size),'family');
 }
 const mentor=findType('mentor-meet')[0],student=findType('student-meet').find(c=>!mentor||c.e.index>mentor.e.index),studentContract=findType('student-contract').find(c=>student&&c.e.index>student.e.index&&c.entities.some(k=>k.startsWith('门生|')&&student.entities.includes(k)));
 if(mentor&&student)addArc('role-change','从接受指导，到指导别人',[mentor,student,studentContract],10+(studentContract?2:0),'mentorship');
 for(const c of findType('injury')){const back=findType('return').find(q=>q.e.index>c.e.index);if(back)addArc('recovery','受伤与重返球场',[c,back],11,'resilience');}
 for(const c of findType('jersey')){const number=c.e.text.match(/球衣[：:]\s*(\d+)号/)?.[1];if(!number)continue;const retired=findType('rafters').find(q=>q.e.index>c.e.index&&q.e.text.includes('退役了'+number+'号球衣'));if(retired)addArc('jersey',number+'号球衣',[c,retired],10,'career');}
 const familyChanges=candidate.filter(c=>['marriage','divorce','partner-loss'].includes(c.type));if(familyChanges.length>=3&&people.filter(p=>p.role==='伴侣').length>=2)addArc('family-change','家庭关系的变化',familyChanges,10+Math.min(4,familyChanges.length-2),'family');
 const contract=findType('contract')[0],retired=findType('retirement')[0];if(contract&&retired&&retired.e.index>contract.e.index)addArc('career','职业生涯',[contract,...findType('champion').slice(0,1),retired],8,'career');
 const foundation=findType('foundation')[0],summer=findType('summer').find(c=>foundation&&c.e.index>foundation.e.index);if(foundation&&summer)addArc('community','帮助他人的记录',[foundation,summer],8,'legacy');
 for(const category of ['career','family','mentorship','legacy','growth','resilience']){const items=candidate.filter(c=>c.rule&&c.category===category&&!c.decision);if(items.length>1&&items.at(-1).e.age>items[0].e.age)addArc('thread','同一领域的前后记录',[items[0],items.at(-1)],4,category);}
 arcs.sort((a,b)=>b.strength-a.strength||a.start-b.start||a.end-b.end);const primary=arcs[0]||null;
 const selected=new Map(),reasons=new Map(),isBoundary=c=>c.e.index===first.index||c.e.index===last.index,count=(key,value)=>[...selected.values()].filter(c=>c[key]===value&&!(key==='type'&&value==='memory'&&isBoundary(c))).length;
 const add=(c,reason)=>{if(!c||(!selected.has(c.e.index)&&selected.size>=maxNodes))return;selected.set(c.e.index,c);const list=reasons.get(c.e.index)||[];if(!list.includes(reason))list.push(reason);reasons.set(c.e.index,list);};
 add(candidate[0],'记录开端');add(candidate.at(-1),n.ended?'已结束人生的记录末尾':'进行中人生的当前记录');
 if(primary){add(candidate[primary.start],'主线起点：'+primary.label);add(candidate[primary.end],'主线后续：'+primary.label);}
 // State-changing relationships are continuity constraints, rather than a high-scoring anecdote.
 const relationshipChanges=candidate.filter(c=>['marriage','divorce','partner-loss'].includes(c.type));
 for(const c of relationshipChanges)if(selected.size<maxNodes)add(c,'家庭关系变化');
 const turning=candidate.filter(c=>['injury','setback','retirement','divorce','partner-loss','mentor-loss'].includes(c.type)).sort((a,b)=>b.base-a.base||a.e.index-b.e.index)[0];if(turning&&selected.size<maxNodes)add(turning,'实际发生的转折');
 for(let phase=0;phase<4&&selected.size<maxNodes;phase++){if([...selected.values()].some(c=>!isBoundary(c)&&c.phase===phase))continue;const pool=candidate.filter(c=>!isBoundary(c)&&!c.decision&&c.phase===phase&&!selected.has(c.e.index)).sort((a,b)=>b.base-a.base||a.e.index-b.e.index);if(pool[0])add(pool[0],'覆盖实际有记录的人生阶段');}
 const known=candidate.filter(c=>c.rule).length,target=Math.min(maxNodes,known<4?Math.min(6,candidate.length):known<10?8:maxNodes);
 const score=c=>{
  const terms={base:c.base,theme:primary&&c.category===primary.category?POLICY.themeBonus:0,category:count('category',c.category)?0:POLICY.categoryBonus,phase:count('phase',c.phase)?0:POLICY.phaseBonus,typeRepeat:-count('type',c.type)*POLICY.typePenalty,sceneRepeat:-count('scene',c.scene)*POLICY.scenePenalty,nearAge:[...selected.values()].some(q=>Math.abs(q.e.age-c.e.age)<2)?-POLICY.nearAgePenalty:0};
  return{terms,total:Object.values(terms).reduce((a,b)=>a+b,0)};
 };
 while(selected.size<target){const eligible=candidate.filter(c=>!selected.has(c.e.index)&&!c.decision&&count('type',c.type)<(c.type==='memory'?POLICY.maxUnknown:POLICY.maxSameType)&&count('phase',c.phase)<Math.ceil(target/2));
  const ranked=eligible.filter(c=>[...selected.values()].filter(q=>q.e.age===c.e.age).length<POLICY.maxSameAge).map(c=>({c,...score(c)})).sort((a,b)=>b.total-a.total||a.c.e.index-b.c.e.index);
  const best=ranked[0];if(!best||best.total<1)break;add(best.c,best.c.rule?'事件重要性、主线与时间覆盖':'保留实际生活片段');best.c.scoreTerms=best.terms;
 }
 // A selected event about a later partner must not skip a known earlier divorce.
 for(const c of [...selected.values()].filter(c=>c.type==='marriage')){const previous=relationshipChanges.filter(q=>q.e.index<c.e.index).at(-1);if(previous?.type==='divorce'&&!selected.has(previous.e.index)&&selected.size<maxNodes)add(previous,'补齐再婚前的已知关系变化');}
 const chosen=[...selected.values()].sort((a,b)=>a.e.index-b.e.index),typeCounts={};for(const c of chosen)typeCounts[c.type]=(typeCounts[c.type]||0)+1;
 const chapters=chosen.map(c=>{
  const e=c.e,opening=e.index===first.index,ending=e.index===last.index&&!opening,m=n.moment(e.age),link=arcs.filter(a=>a.events.includes(e.index)).sort((a,b)=>b.strength-a.strength)[0],other=link?chosen.find(q=>q.e.index!==e.index&&link.events.includes(q.e.index)):null;
  let title=opening?(/出生/.test(e.text)?'从这里开始':'记录的开始'):ending?(n.ended?'这一生，留在这里':'人生还在继续'):c.rule?c.rule.title(e.text):e.text.replace(/[。！!].*$/,'').slice(0,20)||'这一年的记录';
  if(c.type==='jersey'&&!/\d+号/.test(title))title='第一次穿上职业球衣';
  const connection=other?'相关记录：'+other.e.age+'岁，'+(other.rule?other.rule.title(other.e.text):'这一年的经历')+'。':'';
  return{id:'event-'+e.index+'-'+c.type,title,age:e.age,year:e.year,quote:e.text,caption:e.text,body:connection||e.text,connection,relatedEvents:other?[other.e.index]:[],sourceEvent:e.index,eventType:c.type,category:c.category,scene:opening?'home':ending?(n.ended?'ending':'memory'):c.scene,snapshotAge:n.at(e.age)?.age??null,illustrationMode:m.quality,evidence:{quality:m.quality,derived:m.derived,missing:m.missing},kicker:e.year+' · '+e.age+'岁',selection:{reasons:reasons.get(e.index),baseScore:c.base,scoreTerms:c.scoreTerms||null,entities:c.entities,arc:link?.kind||null},echoKey:link?link.kind+':'+link.start:null,phase:c.phase};
 });
 const visiblePrimary=primary&&selected.has(primary.start)&&selected.has(primary.end)?primary:null;
 let title='记录里的这些年',lead='这份珍藏记录了'+n.events.length+'段经历，时间到'+n.age+'岁。';
 if(visiblePrimary){const a=candidate[visiblePrimary.start],b=candidate[visiblePrimary.end];title=primary.kind==='community'?'把帮助留给更多人':primary.kind==='thread'?({career:'球场上的那些年',family:'家人之间的那些年',mentorship:'相遇与成长',legacy:'留下的那些事',growth:'一步步长大',resilience:'走过几次转折'}[primary.category]||'记录里的这些年'):primary.kind==='role-change'?'从学生，到老师':primary.kind==='recovery'?'再次回到球场':primary.kind==='jersey'?'这件'+primary.label:primary.kind==='family-change'?'几段关系，走过这些年':primary.kind==='relationship'?'相遇之后的那些年':primary.kind==='child'?'看着孩子长大':primary.kind==='mentor'?'记得那位教练': '球场上的那些年';lead=a.e.age+'岁：'+a.rule.title(a.e.text)+'。'+b.e.age+'岁：'+b.rule.title(b.e.text)+'。';}
 const report={version:VERSION,policy:POLICY,scannedEvents:n.events.length,recognizedEvents:known,unknownEvents:candidate.filter(c=>!c.rule&&!c.decision).length,decisionEvents:candidate.filter(c=>c.decision).length,budget:target,selectedCount:chapters.length,primaryArc:visiblePrimary,arcs,selected:chapters.map(c=>({event:c.sourceEvent,age:c.age,type:c.eventType,scene:c.scene,...c.selection})),limits:['未识别事件保留原文，不补写剧情','没有冠军、婚姻或传承事件时不补造对应主线','相关记录只表示事实关联，不声称因果','相册节点有数量上限，完整事件保留在记录册']};
 return{chapters,narrative:{title,lead,theme:visiblePrimary?.category||'ordinary',primaryArc:visiblePrimary,report},people};
}
return{VERSION,POLICY,RULES,select,peopleOf};
});
