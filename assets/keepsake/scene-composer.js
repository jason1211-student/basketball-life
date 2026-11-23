(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./keepsake-engine.js'));else root.SceneComposer=factory(root.KeepsakeEngine);})(typeof globalThis!=='undefined'?globalThis:this,function(Engine){'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const label=v=>typeof v==='string'?v:v?.hans||v?.en||'';let serial=0;
function svg(body,w=1080,h=1280){return`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;}
function nested(source,x,y,w,h){const m=source.match(/^\s*<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/);if(!m)throw Error('Original renderer did not return an SVG');let attrs=m[1].replace(/\s(?:x|y|width|height|xmlns|aria-hidden|class|preserveAspectRatio)="[^"]*"/g,''),body=m[2],key='p'+serial+++'-';body=body.replace(/\bid="([^"]+)"/g,(_,n)=>`id="${key+n}"`).replace(/url\(#([^)]+)\)/g,(_,n)=>`url(#${key+n})`);return`<svg x="${x}" y="${y}" width="${w}" height="${h}"${attrs} preserveAspectRatio="xMidYMid meet">${body}</svg>`;}
function text(t,x,y,size=26,color='#59664d',anchor='middle'){return`<text x="${x}" y="${y}" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="${size}" fill="${color}" text-anchor="${anchor}">${esc(t)}</text>`;}
function compose(career,P,store){
 Engine.enrichCareer(career);
 const data=career.data,assets=[],write=(name,s)=>{if(!/^\s*<svg\b[^>]*\sxmlns=/.test(s))s=s.replace(/<svg\b/,'<svg xmlns="http://www.w3.org/2000/svg"');if(/<(?:script|foreignObject|image)\b|\bon\w+\s*=|(?:href|src)\s*=/i.test(s))throw Error('Unexpected active SVG content');const file='art/'+name+'.svg';store(file,s);assets.push(file);return file;};
 const palette=career.team?P.qo(career.team.en||label(career.team)): {body:'#4d7662',trim:'#e4c57c',ink:'#fff8e6'};
 const jersey=P.oc(palette,data.name,data.number||'');
 const floor='<defs><pattern id="wood" width="88" height="180" patternUnits="userSpaceOnUse"><rect width="44" height="180" fill="#c98b4f"/><rect x="44" width="44" height="180" fill="#b97a40"/></pattern></defs><rect y="640" width="1080" height="640" fill="url(#wood)"/>';
 function room(night=false){let s=P.Ale;if(!night)s=s.replaceAll('#1f222c','#e9dfcb').replaceAll('#14161c','#b28658').replaceAll('#2f3440','#be9c71');return nested(s,0,-5,1080,707)+`<rect y="590" width="1080" height="690" fill="${night?'#14161c':'#b28658'}"/>`;}
 function court(){let hoop=P.xse();hoop=hoop.replace(/<g class="dk-ball">[\s\S]*?<\/g>/,'').replace(/<path d="M46 162[\s\S]*?<\/svg>/,'</svg>').replace('0 0 140 210','0 0 140 162');return'<defs><radialGradient id="wall"><stop stop-color="#587463"/><stop offset="1" stop-color="#213d33"/></radialGradient></defs><rect width="1080" height="1280" fill="url(#wall)"/>'+floor+nested(hoop,650,80,340,470);}
 function outside(s){if(!s||s.derivedState)return room(false);const original=P.$re(s,Math.max(1,data.age)),count=P.hT(s).length;let body=original.match(/<svg[^>]*>([\s\S]*)<\/svg>/)[1];for(let i=0;i<count;i++)body=body.replace(/<g transform="translate\([^]*?\) scale\([^]*?\)">[\s\S]*?<\/g>(?=\s*$)/,'');
  // Actors are removed by using only the prefix before the first Mre figure.
  body=body.split(/<g transform="translate\(/)[0];return'<rect width="1080" height="1280" fill="#d2e4ca"/>'+nested(svg(body,600,210),0,0,1080,378)+'<rect y="375" width="1080" height="905" fill="#cfe3c3"/>';
 }
 function actor(s,role,name,pose='rest',extras={}){if(!s)return null;let source=role==='me'?s:role==='partner'?s.partner:role==='child'?s.children?.find(p=>label(p.name)===label(name)):role==='mentor'?s.coaches?.find(p=>label(p.name)===label(name)):s[role];if(role==='protege')source=s.protege;
  if(role!=='me'&&(!source||source.alive===false||source.gone))return null;let a;if(role==='protege'){a={...P.Nh(s,'friend',source.name),age:source.age,sex:'male'};}else a=P.Nh(s,role,name);if(role==='mentor')a.age=source.age;
  a={...a,shirt:['#9fb6d8','#e6a49c','#a5d3bf','#c4b5e2','#e9c97e','#f2b8c6'][a.seed%6],...(role==='me'?P.nP(s):{}),...extras,me:false};const p=P.characterParts(a),left=pose==='shoot'?-150:pose==='sign'?-50:pose==='wave'?-125:pose==='cradle'?-55:pose==='point'?-90:0,right=pose==='shoot'?150:pose==='sign'?65:pose==='cradle'?45:pose==='listen'?100:pose==='read'?-48:0,tilt=pose==='cradle'?5:pose==='listen'?-5:pose==='read'?6:0;
  const leftArm=pose==='shoot'?`<g transform="rotate(155 18.6 43) translate(0 43) scale(1 2.5) translate(0 -45.5)">${p.leftArm}</g>`:`<g transform="rotate(${left} 18.6 49)">${p.leftArm}</g>`;
  const rightArm=pose==='shoot'?`<g transform="rotate(-155 42 43) translate(0 43) scale(1 2.5) translate(0 -45.5) translate(60 0) scale(-1 1)">${p.leftArm}</g>`:`<g transform="rotate(${right} 42 51)">${p.ball+p.cane+p.rightArm+p.bouquet}</g>`;
  let parts=p.shadow+p.back+(pose==='sit'?'<g transform="translate(0 57) scale(1 .55) translate(0 -57)">'+p.legs+'</g>':p.legs)+p.torso+p.details+leftArm+rightArm+`<g transform="rotate(${tilt} 30 41)">${p.hairBack+p.ears+p.face+p.hair+p.eyes+p.blush+p.detail+p.mouth}</g>`;

  return svg(parts,68,78).replace('viewBox="0 0 68 78"','viewBox="-4 -6 68 78"');
 }
 function scene(c){const evidence=career.normalized.moment(c.age),rawState=evidence.state,s=c.eventType==='marriage'&&rawState?.partner&&!c.quote.includes(label(rawState.partner.name))?null:rawState,season=career.data.seasons.find(q=>q.year===c.year),previousSeason=career.data.seasons.filter(q=>q.year<=c.year).at(-1),retiredNumber=c.scene==='rafters'?c.quote.match(/退役了(\d+)号球衣/)?.[1]:null,sceneNumber=retiredNumber||s?.ball?.number||season?.num||data.number,sceneTeam=career.data.seasons.find(q=>label(q.teamRaw)===c.quote.match(/^(.+?)为你退役/)?.[1])?.teamRaw||season?.teamRaw||previousSeason?.teamRaw,scenePalette=sceneTeam?P.qo(sceneTeam.en||label(sceneTeam)):palette,jersey=P.oc(scenePalette,data.name,String(sceneNumber||''));P.S.life=s||career.last;let bg='',props='',cast='',foreground='',motions=[],castFiles=[];const people=[];
  const add=(role,name,x,y,h,pose='rest',extra={},mirror=false)=>{const a=actor(s,role,name,pose,extra);if(!a)return;const w=h*68/78,content=nested(a,0,0,w,h),part=`<g transform="translate(${x} ${y})${mirror?' translate('+w+' 0) scale(-1 1)':''}">${content}</g>`;cast+=part;people.push({role,name:label(name)||data.name,age:role==='me'?s.age:undefined,bounds:{x,y,w,h}});castFiles.push({image:write(c.id+'-actor-'+castFiles.length,svg(part)),kind:role==='me'?'lead':'person'});};
  const courtKinds=['stands','mentor','jersey','mentor-seat','champion','call-mother','retirement','protege','first-call','rafters','last-shot','autograph','court','contract','pennant'];bg=courtKinds.includes(c.scene)?court():['wedding','home'].includes(c.scene)?outside(s):room(c.scene==='quiet'||c.scene==='mentor-memory');
  if(!s){props+=nested(jersey,330,420,420,490)+text(data.name,540,1070,35);c.recipeApplied=!!c.recipe;}
  else switch(c.scene){
   case'memory':{bg=room(false);add('me',null,325,695,440,'rest',{kit:null,job:null,ball:false});break;}
   case'court':{add('me',null,310,730,440,'wave',{ball:true});break;}
   case'achievement':{bg=room(false);const kind=/全明星/.test(c.quote)?'allStar':/最佳阵容/.test(c.quote)?'allLeague':'award';props+=nested(P.Dh(kind),325,125,430,430);add('me',null,365,745,430,'wave',{ball:false});break;}

   case'contract':{
    bg=room(false);props+=nested(jersey,660,90,260,320);
    add('me',null,155,640,445,'sign',{kit:null,job:null,ball:false});
    foreground+=nested(P.LP,365,720,570,310)+text(career.events[c.sourceEvent].text.match(/^你和(.+?)签下了/)?.[1]||c.facts.team,640,1110,30);
    c.recipeApplied=true;break;
   }
   case'retirement':{
    const coaching=c.facts.variant==='coaching';props+=nested(jersey,650,130,280,340)+text(coaching?'新的位置，同一片球场':'球员生涯，留在这里',540,610,36,'#f6ead3');
    add('me',null,165,750,435,coaching?'point':'read',{kit:null,job:coaching?{kind:'coach',colours:scenePalette}:null,ball:false});
    const known=career.data.seasons.filter(q=>q.year<=c.year);if(!coaching&&known.length)props+=text(known.length+'个赛季 · '+known.reduce((n,q)=>n+(q.games||0),0)+'场比赛',540,1100,27,'#f6ead3');
    c.recipeApplied=true;break;
   }
   case'last-shot':{
    add('me',null,115,775,430,'shoot',{kit:null,job:null,ball:false});
    const parts=P.characterParts({...P.Nh(s,'me'),ball:true}),ball=svg(parts.ball,11,11).replace('0 0 11 11','39 49.5 11 11'),asset=write(c.id+'-ball',ball);
    // Ball geometry is the original character's ball. Only its placement changes.
    motions.push({kind:'ball',image:asset,w:65,h:65,keyframes:[{at:0,x:440,y:850,scale:1,opacity:1,rotate:0},{at:.18,x:440,y:850,scale:1,opacity:1,rotate:0},{at:.4,x:510,y:190,scale:1,opacity:1,rotate:110},{at:.58,x:710,y:120,scale:1,opacity:1,rotate:210},{at:.72,x:820,y:285,scale:1,opacity:1,rotate:300},{at:.83,x:820,y:365,scale:1,opacity:1,rotate:345},{at:1,x:790,y:610,scale:1,opacity:1,rotate:400}]});
    c.recipeApplied=true;break;
   }
   case'child-wedding':{
    bg=outside(s);let arch=P._le(s,{params:{n:0},text:{hans:'婚礼',en:'Wedding'}},'').match(/<svg class="arch"[\s\S]*?<\/svg>/)?.[0];if(arch)props+=nested(arch,125,120,830,640);
    const child=s.children?.find(p=>label(p.name)===c.facts.childName);
    if(child)add('child',child.name,600,650,410,'wave',{kit:null,job:null,ball:false,outfit:child.sex==='female'?'gown':'suit'});
    add('me',null,135,760,390,'point',{kit:null,job:null,ball:false,outfit:'suit'});foreground+=nested(P.wre('mic'),430,850,100,100);
    props+=text(c.facts.childName+'的婚礼',540,160,34,'#435d41');c.recipeApplied=true;break;
   }
   case'anniversary':{
    bg=room(false);add('me',null,145,670,430,'read',{kit:null,job:null,ball:false});if(s.partner?.alive)add('partner',s.partner.name,610,680,420,'cradle',{kit:null,job:null,ball:false});
    // Table repeats the bench geometry already used by the v2 scene compositor.
    foreground+='<rect x="120" y="1030" width="830" height="48" fill="#9c7246"/><rect x="155" y="1078" width="30" height="150" fill="#8a6a44"/><rect x="885" y="1078" width="30" height="150" fill="#8a6a44"/>'+nested(P.NP,475,855,110,180);
    props+=text(s.partner?.years?'相伴'+s.partner.years+'年':'把平常的一天，认真过',540,240,40,'#536b47');c.recipeApplied=true;break;
   }
   case'home':{bg=outside(s);if(c.age<2&&s.mother?.alive){add('father',s.father?.name,610,580,460,'wave',{kit:null});add('mother',s.mother.name,190,620,480,'cradle');add('me',null,390,930,170,'rest',{kit:null,job:null,outfit:'swaddle'});}else{add('me',null,430,690,430,'wave',{ball:c.age>=4});if(s.partner?.alive)add('partner',s.partner.name,150,735,390);for(const [i,p]of(s.children||[]).filter(p=>p.alive&&p.age<22).slice(0,2).entries())add('child',p.name,750+i*140,970,210);}break;}
   case'newborn':{add('me',null,160,580,510,'listen',{kit:null,job:null});if(s.partner?.alive)add('partner',s.partner.name,590,600,490,'cradle');const child=(s.children||[]).find(p=>p.age===0);if(child)add('child',child.name,680,920,190,'rest',{outfit:'swaddle'});props+=nested(jersey,75,80,220,260);break;}
   case'wedding':{let html=P._le(s,{params:{bride:s.partner?.name,n:0},text:{hans:'婚礼',en:'Wedding'}},''),arch=html.match(/<svg class="arch"[\s\S]*?<\/svg>/)?.[0];if(arch)props+=nested(arch,110,110,860,710);add('me',null,250,650,430,'cradle',{kit:null,job:null,outfit:'suit'});if(s.partner)add('partner',s.partner.name,610,670,430,'cradle',{outfit:'gown'});break;}
   case'mentor':case'mentor-seat':{const p=(s.coaches||[]).find(p=>!p.gone&&c.quote.includes(label(p.name)))||(s.coaches||[]).find(p=>!p.gone);props+='<rect x="90" y="807" width="385" height="43" fill="#9c7246"/><rect x="110" y="850" width="25" height="130" fill="#8a6a44"/><rect x="420" y="850" width="25" height="130" fill="#8a6a44"/>';if(p)add('mentor',p.name,150,495,445,c.scene==='mentor-seat'?'sit':'point',{job:{kind:'coach'}});add('me',null,650,745,410,'listen',{ball:true});if(p)props+=text(label(p.name),280,1020,27,'#f5ead6');break;}
   case'family-award':case'family':{const members=[['father',s.father],['mother',s.mother],['me',{name:s.name,age:s.age,alive:true}],['partner',s.partner],...(s.children||[]).map(p=>['child',p])].filter(([,p])=>p?.alive!==false&&p?.name);for(const [i,[role,p]]of members.entries()){const front=i>=3,col=front?i-3:i,h=p.age<13?240:390;add(role,p.name,100+col*310,front?1060-h:780-h,h,role==='mother'?'read':role==='me'?'wave':'rest',{kit:null,job:null});}props+=nested(P.LP,350,180,360,200)+text(c.scene==='family-award'?'那晚留下的菜单':'一家人的纪念',540,405,30);break;}
   case'stands':{props+='<rect x="80" y="690" width="880" height="65" fill="#b78b5c"/><rect x="80" y="755" width="880" height="110" fill="#9c7246"/>';if(s.partner)add('partner',s.partner.name,100,355,400,'sit');for(const [i,p]of(s.children||[]).filter(p=>p.alive).slice(0,2).entries())add('child',p.name,450+i*230,480,270,'wave');add('me',null,360,840,400,'wave',{ball:true});const score=c.quote.match(/以(\d+)比(\d+)/);if(score)props+=text(score[1]+' : '+score[2],540,140,60,'#f3e8c9');break;}
   case'protege':case'first-call':{add('me',null,110,690,470,'point',{kit:null,job:{kind:'coach',colours:palette},ball:true});if(s.protege)add('protege',s.protege.name,650,740,410,'listen',{ball:true});if(c.scene==='first-call')props+=nested(P.LP,340,180,400,230);else props+=text('06:00',540,220,76,'#f2e3bf');break;}
   case'call-mother':{props+=nested(jersey,80,110,270,320)+nested(P.mse(),720,120,240,280);add('me',null,540,700,480,'listen',{ball:false});if(s.mother?.alive)add('mother',s.mother.name,90,760,330,'wave');break;}
   case'couple':{add('me',null,170,690,450,'read',{kit:null,job:null});if(s.partner?.alive)add('partner',s.partner.name,620,710,430,'cradle');props+=nested(P.LP,350,150,400,230);break;}
   case'quiet':case'mentor-memory':{add('me',null,625,770,380,'read',{kit:null,job:null});props+=nested(jersey,180,140,300,355);if(c.scene==='quiet')props+='<rect x="130" y="1030" width="310" height="40" fill="#8a6a44"/>';else props+=nested(P.NP,330,870,190,180);break;}
   case'rafters':case'jersey':{props+=nested(jersey,330,80,420,500)+text(data.name+' / '+sceneNumber,540,625,28,'#fff2d6');add('me',null,c.scene==='rafters'?140:565,790,400,c.scene==='rafters'?'read':'wave',{ball:c.scene==='jersey',...(c.scene==='rafters'?{kit:null,job:null}:{})});if(c.scene==='rafters'&&s.partner?.alive)add('partner',s.partner.name,650,830,370,'read');break;}
   case'champion':case'pennant':{props+=nested(c.scene==='champion'?P.mse():P.yse(palette,'联赛冠军',String(c.year)),310,140,460,500);add('me',null,365,770,430,'wave',{ball:true});break;}
   case'foundation':case'summer':{props+=nested(P.yse(palette,'把球传下去',String(c.year)),120,130,330,470)+nested(P.Dh('community'),740,170,190,220);add('me',null,490,760,420,'point',{kit:null,job:null,ball:true});break;}
   case'almanac':{add('me',null,120,700,450,'read',{kit:null,job:null});props+=nested(P.LP,520,770,440,250)+nested(jersey,580,130,290,350);const best=career.data.seasons.slice().sort((a,b)=>b.ppg-a.ppg)[0];if(best)props+=text(best.year+' / '+best.ppg+'分',730,1040,27);break;}
   case'ending':{props+=nested(jersey,300,210,480,570)+text(data.name,540,920,54)+text(data.born+' - '+data.ended,540,985,34);bg=room(true);break;}
   default:{c.renderFallback=true;add('me',null,360,700,470,'point',{ball:true});props+=nested(jersey,90,100,270,320);}
  }
  // Dates belong to the outer page, so they are not repeated inside the illustration.
  const motionStill=motions.map(m=>{const k=Engine.motionAt(m,c.posterTime),content=ballMarkup(m,k);return content;}).join('');
  const image=write(c.id,svg(bg+props+cast+foreground+motionStill)),layers={background:write(c.id+'-background',svg(bg)),props:write(c.id+'-props',svg(props)),foreground:foreground?write(c.id+'-foreground',svg(foreground)):null,actors:castFiles,motions};
  function ballMarkup(m,k){return nested(svg(P.characterParts({...P.Nh(s,'me'),ball:true}).ball,11,11).replace('0 0 11 11','39 49.5 11 11'),k.x-m.w/2,k.y-m.h/2,m.w,m.h);}
  return{...c,image,layers,people,shotPlan:c.shotPlan};
 }
 data.chapter=data.chapter.map(scene);if(data.bonus)data.bonus=scene({...data.bonus,id:'bonus-autograph',quote:data.bonus.text,body:data.bonus.text,illustrationMode:career.normalized.moment(data.bonus.age).quality});
 data.people=[];if(career.last.stateKind!=='summary-view'){for(const entity of career.normalized.entities){const roles={'父亲':'father','母亲':'mother','伴侣':'partner','孩子':'child','教练':'mentor','门生':'protege'},role=roles[entity.role];const s=career.states.find(s=>(role==='mentor'?s.coaches?.some(p=>label(p.name)===entity.name&&!p.gone):role==='child'?s.children?.some(p=>label(p.name)===entity.name&&p.alive):role==='protege'?label(s.protege?.name)===entity.name:label(s[role]?.name)===entity.name&&s[role]?.alive))||null;if(!s)continue;P.S.life=s;const p=role==='mentor'?s.coaches.find(p=>label(p.name)===entity.name):role==='child'?s.children.find(p=>label(p.name)===entity.name):role==='protege'?s.protege:s[role];const drawing=actor(s,role,p.name,'rest',{kit:null,job:null});if(drawing)data.people.push({name:entity.name,role:entity.role,image:write('person-'+data.people.length,drawing)});}}
 data.portraits=[];const milestones=[0,...data.chapter.filter(c=>c.recipe||['jersey','wedding','ending'].includes(c.scene)).map(c=>c.age),data.age],picked=new Set();for(const age of milestones){const s=career.states.slice().sort((a,b)=>Math.abs(a.age-age)-Math.abs(b.age-age))[0];if(!s||picked.has(s.age))continue;picked.add(s.age);P.S.life=s;data.portraits.push({age:s.age,image:write('portrait-'+s.age,actor(s,'me',null,'rest'))});}data.portraits.sort((a,b)=>a.age-b.age);
 const awardImages={};for(const a of data.awards){const k=a.kind||'award';if(!awardImages[k])awardImages[k]=write('award-'+k,P.Dh(k));a.image=awardImages[k];}
 write('jersey',jersey);data.quality=Engine.quality(data);if(data.quality.errors)throw Error('生成检查未通过：'+data.quality.findings.filter(f=>f.level==='error').map(f=>f.message).join('；'));data.filmPlan=Engine.plan(data,'full').segments.map(s=>({id:s.chapter.id,start:s.start,duration:s.duration}));return{data,assets};
}
return{compose,svg,nested,esc};
});
