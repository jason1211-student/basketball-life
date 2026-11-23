(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./save-adapter.js'),require('./story-selector.js'),require('./book-model.js'));else root.CareerEngine=factory(root.SaveAdapter,root.StorySelector,root.LifeBook);})(typeof globalThis!=='undefined'?globalThis:this,function(SaveAdapter,Selector,LifeBook){'use strict';
const label=v=>typeof v==='string'?v:v?.hans||v?.en||'';
function loadCareer(record,options={}){
 const normalized=SaveAdapter.normalize(record,options.formatter),{summary,events,states,coverage,last}=normalized,{born,name}=normalized;
 const seasons=(last.ball.seasons||[]).map(s=>({...s,team:label(s.team),teamRaw:s.team,league:label(s.league),finish:label(s.finish).replace('{round}',label(s.finishParams?.round))}));
 const selection=Selector.select(normalized,{seasons,maxNodes:options.maxNodes}),bonus=events.find(e=>/隔壁的.+请你在他的球上签名/.test(e.text)),number=String(last.ball.number||seasons.at(-1)?.num||summary.card?.num||''),team=seasons.at(-1)?.teamRaw;
 const data={name,difficulty:summary.card?.hd===1||last.difficulty==='hard'?'hard':'easy',title:selection.narrative.title,narrative:selection.narrative,born,ended:born+normalized.age,isComplete:normalized.ended,age:normalized.age,number,chapter:selection.chapters,bonus:bonus?{...bonus,title:'球是拿来打的',scene:'autograph',snapshotAge:normalized.at(bonus.age)?.age??null}:null,events,paragraphs:summary.story.paragraphs||[],seasons,awards:(last.ball.awards||[]).map(a=>({...a,text:label(a.text)})),stats:{games:seasons.reduce((n,s)=>n+(s.games||0),0)||summary.card?.games||0,titles:seasons.filter(s=>s.champion).length||summary.card?.titles||0,seasons:seasons.length||summary.card?.seasons||0,grandchildren:last.flags?.grandkids||0},source:{archive:'imported-save',seed:normalized.seed,storyEvents:events.length,annualStates:states.length,snapshotCoverage:coverage},analysis:{entities:selection.people,warnings:normalized.warnings,decisions:events.filter(e=>e.kind==='decision'||e.text.includes(' · ')).length},duration:0};
 data.book=LifeBook.build(normalized,data,options.formatter);
 return{archive:null,summary,states,events,at:age=>normalized.moment(age).state,last,born,name,number,team,coverage,hashFiles:[],normalized,data};
}
return{loadCareer,label};
});
