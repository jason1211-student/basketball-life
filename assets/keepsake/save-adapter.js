(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SaveAdapter=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const label=v=>typeof v==='string'?v:v?.hans||v?.['zh-Hans']||v?.hant||v?.en||'';
const decode=v=>{for(let i=0;i<4&&typeof v==='string';i++){try{v=JSON.parse(v);}catch{break;}}return v;};
const isLife=s=>s&&typeof s==='object'&&s.v===3&&s.ball&&Number.isFinite(s.age)&&Number.isFinite(s.seed)&&s.name;
const isSummary=s=>s&&typeof s==='object'&&s.story&&Array.isArray(s.story.timeline)&&s.name;
const plain=s=>String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#(?:39|x27);/g,"'").replace(/&amp;/g,'&');
function format(row){let t=label(row.text),p=row.params||{};return t.replace(/\{([^{}]+)\}/g,(all,k)=>p[k]===undefined?all:label(p[k])||String(p[k]??''));}
function normalize(input,formatter){
 input=decode(input);if(!input||typeof input!=='object')throw Error('不是有效的篮球人生存档 JSON。');
 const lives=[],summaries=[],visited=new Set();let knownSnapshots=[];
 function visit(value,depth=0){value=decode(value);if(!value||typeof value!=='object'||depth>6||visited.has(value))return;visited.add(value);if(isLife(value)){lives.push(value);if(value.mblKeepsake?.fromBirth===true&&value.mblKeepsake.seed===value.seed)visit(value.mblKeepsake.states,depth+1);return;}if(isSummary(value)){summaries.push(value);if(value.story.memories?.fromBirth===true&&value.story.memories.seed===value.seed)visit(value.story.memories.states,depth+1);return;}
  if(Array.isArray(value)){for(const v of value)visit(v,depth+1);return;}
  for(const key of['summary','currentSummary','selectedSummary','life','state','current','data','value','save','annualStates','states','snapshots','careers'])if(value[key])visit(value[key],depth+1);
  if(value.entries&&typeof value.entries==='object'){for(const key of['mbl.current','mbl.records','mbl.history'])if(value.entries[key])visit(value.entries[key],depth+1);}
 }
 visit(input);const seeds=[...new Set([...lives.map(s=>s.seed),...summaries.map(s=>s.seed)].filter(Number.isFinite))];
 if(!seeds.length)throw Error('没有找到完整人生数据。请导出人生存档；仅有结算卡或设置文件无法生成逐年珍藏。');
 const requested=Number.isFinite(input.selectedSeed)?input.selectedSeed:undefined;
 const seed=requested??(isSummary(input)?input.seed:isLife(input)?input.seed:summaries.find(s=>s.ended)?.seed??lives.at(-1)?.seed??seeds[0]);
 if(!seeds.includes(seed))throw Error('这份导出中没有选中的人生。');
 const byAge=new Map();for(const s of lives.filter(s=>s.seed===seed)){const old=byAge.get(s.age);if(!old||(s.log?.length||0)>=(old.log?.length||0))byAge.set(s.age,s);}const states=[...byAge.values()].sort((a,b)=>a.age-b.age);
 const summary=summaries.filter(s=>s.seed===seed).sort((a,b)=>(b.story.timeline.length-a.story.timeline.length))[0];
 // Each compact frame retains only its own season. Combine those real seasons
 // for the book; keep the chronological frames unchanged for scene rendering.
 if(states.length&&states.at(-1).stateKind==='keepsake-snapshot'){const seasons=[...new Map(states.flatMap(s=>s.ball.seasons||[]).map(s=>[s.year,s])).values()].sort((a,b)=>a.year-b.year),awards=[...new Map(states.flatMap(s=>s.ball.awards||[]).map(a=>[JSON.stringify(a),a])).values()];const last=states.at(-1);states[states.length-1]={...last,ball:{...last.ball,seasons,awards}};}
 const last=states.at(-1)||null;let events;
 if(summary)events=summary.story.timeline.map((e,index)=>({age:Number(e.age),year:Number(e.year),text:plain(label(e.text)),index,kind:e.kind||'event',params:e.params||{}}));
 else {const log=last.log||[];const born=Number(last.born?.year??last.birthYear??log.find(e=>e.age===0&&e.params?.year)?.params.year);if(!Number.isFinite(born))throw Error('存档没有可核实的出生年份，暂时不能生成有年份的珍藏。');events=log.map((e,index)=>({age:Number(e.age),year:born+Number(e.age),text:plain(formatter?formatter(e.text,e.params,last):format(e)),index,kind:e.kind||'event',params:e.params||{},raw:e}));}
 if(!events.length||events.some(e=>!Number.isFinite(e.age)||!Number.isFinite(e.year)||typeof e.text!=='string'))throw Error('人生事件格式异常，请重新导出存档。');
 const born=events[0].year-events[0].age,age=summary?.age??last.age,ended=summary?!!summary.ended:last.alive===false,name=label(summary?.name||last.name),card=summary?.card||{};
 const view=last||{seed,name:typeof card.name==='object'?card.name:{hans:name,en:name},age,country:summary.code,ball:{number:card.num,seasons:[],awards:[]},children:[],flags:{},stateKind:'summary-view'};
 const fullSummary=summary||{version:1,seed,name,code:last.country,age,ended,card:{},story:{coverage:ended?'complete':'in-progress',timeline:events,paragraphs:[]}};
 const warnings=[];if(!states.length)warnings.push('仅有完整剧情，未包含人物状态；人物与场景将按可核实字段降级呈现。');else if(states.length===1)warnings.push('存档仅含一个人物状态；历史场景只使用能从事件与人物生日推导的事实。');if(!ended)warnings.push('这一生尚未结束，生成的是截至当前年龄的阶段珍藏。');
 if(events.some(e=>/\{[^{}]+\}/.test(e.text)))warnings.push('部分事件缺少参数，已保留原文标记，未补写缺失剧情。');
 const at=target=>states.find(s=>s.age===target&&s.stateKind!=='summary-view')||null;
 function moment(target){const exact=at(target);if(exact)return{state:exact,quality:'snapshot',derived:[],missing:[]};if(!last)return{state:null,quality:'text-only',derived:[],missing:['人物状态']};
  const s={...last,age:target,alive:true,ball:{...last.ball},children:[],coaches:[],partner:null,flags:{},money:null,city:null,career:null};const derived=['主角年龄：事件年份与出生年份'],missing=['历史住房','历史居住地','历史资产'];
  const deadAt=(person,kin)=>events.find(e=>((person?.name&&e.text.includes(label(person.name)))||(kin&&e.text.includes('你的'+kin)))&&/过世|去世|离世/.test(e.text));
  function personAt(p,kin){if(!p?.name)return null;const death=deadAt(p,kin),anchor=p.alive===false?(Number.isFinite(p.ended)?p.ended:death?.age):last.age;if(!Number.isFinite(anchor))return null;const ageThen=p.age-(anchor-target);if(!Number.isFinite(ageThen)||ageThen<0)return null;return{...p,age:ageThen,alive:death?target<death.age:p.alive===false?target<anchor:true};}
  s.father=personAt(last.father,'父亲');s.mother=personAt(last.mother,'母亲');
  if(last.partner){const n=label(last.partner.name),start=events.find(e=>e.text.includes(n)&&/开始交往|结婚了/.test(e.text));if(start&&target>=start.age)s.partner=personAt(last.partner,'配偶');}
  for(const child of last.children||[]){const birth=events.find(e=>e.text.includes(label(child.name))&&/^你的孩子.+出生了/.test(e.text)),p=personAt(child);if(birth&&target>=birth.age)s.children.push({...child,age:target-birth.age,alive:p?.alive??child.alive});}
  for(const coach of last.coaches||[]){if(target<coach.metAge)continue;const anchor=coach.gone?coach.goneAge:last.age;if(!Number.isFinite(anchor))continue;s.coaches.push({...coach,age:coach.age-(anchor-target),gone:coach.gone&&target>=coach.goneAge});}
  const season=(last.ball.seasons||[]).find(q=>q.year===born+target);s.ball.pro=season?{team:season.team}:null;s.ball.number=season?.num||'';
  if(season)derived.push('球队与号码：当季职业赛季');if(!s.father&&!s.mother)missing.push('历史父母年龄');if(!s.partner)missing.push('当年伴侣关系');
  s.protege=null;s.prisonYears=0;s.derivedState=true;return{state:s,quality:'derived-facts',derived,missing};
 }
 const entities=[],entityKeys=new Set();for(const view of(states.length?states:[last||{}]))for(const [role,p]of[['父亲',view.father],['母亲',view.mother],['伴侣',view.partner],...(view.children||[]).map(p=>['孩子',p]),...(view.coaches||[]).map(p=>['教练',p]),...(view.protege?[['门生',view.protege]]:[])])if(p?.name){const name=label(p.name),key=role+'|'+name;if(entityKeys.has(key))continue;entityKeys.add(key);entities.push({role,name,eventIndexes:events.filter(e=>e.text.includes(name)).map(e=>e.index)});}
 return{summary:fullSummary,states,last:view,events,born,name,seed,ended,age,at,moment,warnings,coverage:states.length>1?'annual':states.length?'single-state':'story-only',choices:seeds.map(s=>({seed:s,name:label(summaries.find(v=>v.seed===s)?.name||lives.find(v=>v.seed===s)?.name)})),entities};
}
return{normalize,label,format,decode};
});
