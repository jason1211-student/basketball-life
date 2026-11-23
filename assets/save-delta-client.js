/* One bounded background job; the existing full-save path handles fallback. */
(function(){
 'use strict';
 var script=document.currentScript,source=script&&script.src,worker=null,pending=null,sequence=0;
 function reset(){var old=worker;worker=null;if(pending){clearTimeout(pending.timer);pending.resolve(null);pending=null;}if(old)old.terminate();}
 function build(previous,next,revision){
  if(!source||typeof Worker!=='function'||pending)return Promise.resolve(null);
  if(!worker){try{worker=new Worker(new URL('save-delta-worker.js',source));}catch(_){return Promise.resolve(null);}
   var current=worker;
   current.onmessage=function(event){if(worker!==current||!pending||event.data?.id!==pending.id)return;var request=pending;pending=null;clearTimeout(request.timer);request.resolve(event.data.delta||null);};
   current.onerror=function(event){event.preventDefault();if(worker===current)reset();};
   current.onmessageerror=function(){if(worker===current)reset();};
  }
  return new Promise(function(resolve){var id=++sequence;pending={id:id,resolve:resolve,timer:setTimeout(reset,5000)};try{worker.postMessage({type:'build',id:id,previous:previous,next:next,revision:revision});}catch(_){reset();}});
 }
 window.MBLDeltaClient={build:build,reset:reset};
 window.addEventListener('pagehide',reset);
}());
