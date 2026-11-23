/* Read the complete career model, independently of record-book DOM pagination. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.KeepsakePost=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const text=v=>v===null||v===undefined?'—':String(v),list=v=>Array.isArray(v)?v:[];
function brief(D){return D.name+' · '+(D.difficulty==='hard'?'困难模式':'普通模式')+' · '+D.born+'—'+D.ended+' · '+D.age+'年人生，'+list(D.events).length+'条经历。这是在篮球人生中走过的一段模拟人生。';}
function image(D){const title='我的篮球人生：'+D.name,content=brief(D);return{title,content};}
function record(D){
 if(!D?.book||!Array.isArray(D.events))throw Error('完整人生记录尚未载入，请重试。');
 const rows=[brief(D),'','人生概览','职业生涯：'+text(D.stats?.seasons)+'个赛季 / '+text(D.stats?.games)+'场比赛 / '+text(D.stats?.titles)+'座联赛冠军'];
 for(const f of list(D.book.facts))rows.push(f.label+'：'+text(f.value));
 rows.push(...list(D.paragraphs),'','职业生涯');
 for(const s of list(D.seasons))rows.push(s.year+'年 · '+s.team+' · '+text(s.games)+'场 · 场均'+text(s.ppg)+'分 / '+text(s.rpg)+'篮板 / '+text(s.apg)+'助攻 · '+(s.champion?'总冠军':text(s.finish)));
 rows.push('','荣誉簿');for(const a of list(D.awards))rows.push(a.year+'年 · '+a.text);
 rows.push('','家人与师友');for(const p of list(D.book.people))rows.push(p.role+'：'+p.name+' · '+text(p.firstYear)+'—'+text(p.lastYear)+'年'+(p.status?' · '+p.status:''));
 rows.push('','做过的选择');for(const d of list(D.book.decisions)){rows.push(d.year+'年 / '+d.age+'岁 · '+d.title);if(d.question)rows.push(d.question);rows.push('你的选择：'+d.choice);if(list(d.effects).length)rows.push(d.effects.map(f=>f.label+' '+(f.delta>0?'+':'')+text(f.delta)).join('；'));}
 rows.push('','逐年状态');for(const r of list(D.book.rows))rows.push(r.year+'年 / '+r.age+'岁 · '+text(r.place)+' · '+text(r.team)+' · 幸福'+text(r.happiness)+' / 健康'+text(r.health)+' / 关系'+text(r.relationships)+' / 知识'+text(r.knowledge));
 rows.push('','完整人生经历（'+D.events.length+'条）');for(const e of D.events)rows.push(e.year+'年 / '+e.age+'岁 · '+e.text);
 rows.push('',D.book.note||'以上内容来自这段模拟人生的存档。');
 const title=D.name+'的人生记录册',content=rows.join('\n');return{kind:'record',title,content,eventCount:D.events.length};
}
return{brief,image,record};
});
