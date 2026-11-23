(()=>{'use strict';
const W=1080,M=64,GAP=26,INK='#294438',SOFT='#7c886f',GOLD='#a77e48',PAPER='#f8f4e9',FONT='Microsoft YaHei, PingFang SC, sans-serif',SERIF='SimSun, Songti SC, serif';
const label=v=>String(v??'');
// This is a compact photo keepsake. Complete source text remains in the record book.
async function create(D,progress=()=>{}){
 if(!D?.chapter?.length)throw Error('这份人生还没有可以保存的片段。');
 const chapters=D.chapter.slice(0,24),people=(D.book?.people||[]).slice(0,10),canvas=document.createElement('canvas');canvas.width=W;canvas.height=1;const ctx=canvas.getContext('2d');if(!ctx)throw Error('当前浏览器无法生成图片。');
 let truncated=0;function rows(text,width,size,max=8,family=FONT){ctx.font=size+'px '+family;const all=KeepsakeEngine.lines(label(text),s=>ctx.measureText(s).width,width);if(all.length<=max)return all;truncated++;const out=all.slice(0,max);let tail=out[max-1];while(tail&&ctx.measureText(tail+'…').width>width)tail=tail.slice(0,-1);out[max-1]=tail+'…';return out;}
 const names=rows(D.name,510,62,2,SERIF),lead=rows(D.narrative?.lead||D.title,510,25,4),title=rows(D.title,510,34,2,SERIF);
 const cards=chapters.map((c,i)=>({c,i,title:rows(c.title,416,31,2,SERIF),caption:rows(c.quote,416,24,5)}));
 for(const item of cards)item.h=36+440+24+item.title.length*43+14+item.caption.length*36+30;
 const rowHeights=[];for(let i=0;i<cards.length;i+=2)rowHeights.push(Math.max(cards[i].h,cards[i+1]?.h||0));
 const peopleRows=Math.ceil(people.length/5),headerH=Math.max(445,90+names.length*80+title.length*47+lead.length*38+125),peopleH=people.length?100+peopleRows*205:0,chartH=D.book?.rows?.some(r=>r.happiness!==null||r.health!==null)?420:0;
 const height=headerH+210+peopleH+chartH+125+rowHeights.reduce((a,h)=>a+h+GAP,0)+170;
 if(height>8192)throw Error('这份人生内容较多，请先阅读完整人生记录册。');
 // Render vector scenes and text at higher resolution, within a 16MP phone canvas budget.
 const scale=Math.min(1.5,Math.sqrt(16000000/(W*height))),outputWidth=Math.floor(W*scale),outputHeight=Math.floor(height*scale);canvas.width=outputWidth;canvas.height=outputHeight;ctx.scale(outputWidth/W,outputHeight/height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 const original=await Promise.all(chapters.map(async(c,i)=>{progress('正在收好回忆 '+(i+1)+' / '+chapters.length+'……');return KeepsakeExport.image(c.image);}));
 const portraits=await Promise.all(people.map(p=>{const q=(D.people||[]).find(x=>x.name===p.name&&x.role===p.role)||(D.people||[]).find(x=>x.name===p.name);return q?KeepsakeExport.image(q.image):null;}));
 ctx.fillStyle=PAPER;ctx.fillRect(0,0,W,height);
 function text(t,x,y,size=25,color=INK,font=FONT){ctx.font=size+'px '+font;ctx.fillStyle=color;ctx.fillText(label(t),x,y);}
 function paragraph(lines,x,y,size=25,line=38,color=INK,font=FONT){for(const [i,t]of lines.entries())text(t,x,y+i*line,size,color,font);}
 function contain(im,x,y,w,h){const k=Math.min(w/im.naturalWidth,h/im.naturalHeight),iw=im.naturalWidth*k,ih=im.naturalHeight*k;ctx.drawImage(im,x+(w-iw)/2,y+(h-ih)/2,iw,ih);}
 function rule(y){ctx.fillStyle='#d4dac9';ctx.fillRect(M,y,W-M*2,1);}
 function heading(no,t,y,small=''){text(no+' / '+t,M,y,34,INK,SERIF);if(small){ctx.textAlign='right';text(small,W-M,y-2,19,SOFT);ctx.textAlign='left';}}
 ctx.fillStyle=INK;ctx.fillRect(0,0,W,headerH);text('篮球人生 / 一生珍藏',M,64,21,'#c7cbb7');paragraph(names,M,150,62,80,'#fff8e9',SERIF);let hy=150+(names.length-1)*80;text(D.born+' — '+D.ended+(D.isComplete?'':' · 截至'+D.age+'岁'),M,hy+60,25,'#cdb584','Georgia');paragraph(title,M,hy+120,34,47,'#e5e5d4',SERIF);paragraph(lead,M,hy+120+title.length*47+28,25,38,'#cbd2bd');
 const heroIndex=Math.max(0,chapters.findIndex(c=>c.sourceEvent===D.narrative?.primaryArc?.end)),hero=original[heroIndex];ctx.fillStyle='#eeecdd';ctx.fillRect(650,85,366,headerH-150);contain(hero,658,93,350,headerH-166);
 let y=headerH+64;const stats=[[D.age,'年人生'],[D.events.length,'条经历'],[D.stats.seasons,'个职业赛季'],[D.stats.titles,'座联赛冠军']];for(const [i,[v,t]]of stats.entries()){const x=M+i*245;text(v,x,y,43,INK,'Georgia');text(t,x,y+43,22,SOFT);if(i)ctx.fillRect(x-25,y-43,1,95);}y=headerH+210;
 if(people.length){heading('01','人生里的他们',y+10,people.length+'位有记录的家人与师友');y+=50;for(const [i,p]of people.entries()){const x=M+i%5*195,py=y+Math.floor(i/5)*205;if(portraits[i])contain(portraits[i],x+37,py,92,104);else{ctx.fillStyle='#e6eadb';ctx.fillRect(x+37,py,92,104);text(p.name.slice(0,1),x+65,py+65,34,SOFT,SERIF);}text(p.role,x+10,py+130,19,GOLD);paragraph(rows(p.name,175,23,2),x+10,py+165,23,30,INK,SERIF);}y+=peopleRows*205+50;}
 if(chartH){heading('02','日子怎样走过',y+10,'仅展示已留存年份');const top=y+60,left=102,cw=880,ch=230,x=a=>left+a/Math.max(1,D.age)*cw,cy=v=>top+ch-v/100*ch;for(const n of [0,50,100]){ctx.strokeStyle='#dee2d3';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,cy(n));ctx.lineTo(left+cw,cy(n));ctx.stroke();text(n,62,cy(n)+6,17,SOFT,'Georgia');}for(let a=0;a<=D.age;a+=Math.max(10,Math.ceil(D.age/60)*10))text(a+'岁',x(a)-15,top+ch+34,17,SOFT);for(const [key,color]of [['happiness','#b88c4c'],['health','#45705b']]){ctx.strokeStyle=color;ctx.lineWidth=4;ctx.beginPath();let prev=null;for(const r of D.book.rows){if(r[key]===null){prev=null;continue;}if(prev!==null&&r.age===prev+1)ctx.lineTo(x(r.age),cy(r[key]));else ctx.moveTo(x(r.age),cy(r[key]));prev=r.age;}ctx.stroke();for(const r of D.book.rows.filter(r=>r[key]!==null)){ctx.beginPath();ctx.arc(x(r.age),cy(r[key]),2.7,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}}text('● 幸福',M,top+ch+85,21,'#b88c4c');text('● 健康',M+155,top+ch+85,21,'#45705b');text('0—100 · 缺失年份留白',M+340,top+ch+85,20,SOFT);y+=chartH;}
 rule(y);y+=70;heading('03','留住这些瞬间',y,chapters.length+'段入选回忆');y+=55;
 const memoryTop=y,cardW=463;for(let row=0;row<rowHeights.length;row++){for(let col=0;col<2;col++){const item=cards[row*2+col];if(!item)continue;const x=M+col*(cardW+GAP),cy=y;ctx.fillStyle='#fffdf5';ctx.fillRect(x,cy,cardW,rowHeights[row]);ctx.strokeStyle='#dce0d0';ctx.lineWidth=1;ctx.strokeRect(x,cy,cardW,rowHeights[row]);text(item.c.year+' / '+item.c.age+'岁',x+23,cy+34,22,GOLD,'Georgia');ctx.fillStyle='#e9eddf';ctx.fillRect(x+15,cy+55,cardW-30,420);contain(original[item.i],x+15,cy+55,cardW-30,420);paragraph(item.title,x+23,cy+525,31,43,INK,SERIF);paragraph(item.caption,x+23,cy+525+item.title.length*43+14,24,36,'#657456');}y+=rowHeights[row]+GAP;}
 rule(y+8);text(D.name+' · '+D.born+'—'+D.ended,M,y+65,23,INK,SERIF);text('纪念长图 · 完整的'+D.events.length+'条经历收录于人生记录册',M,y+108,20,SOFT);text('这是在篮球人生中走过的一段模拟人生。',M,y+145,18,SOFT);
 return{canvas,meta:{width:outputWidth,height:outputHeight,logicalWidth:W,logicalHeight:height,chapters:chapters.length,people:people.length,events:D.events.length,truncatedParagraphs:truncated,memoryTop,bottom:y+145}};
}
window.PhoneKeepsake={create};
})();
