'use strict';
navigator.serviceWorker?.addEventListener('message',event=>{if(event.data?.type==='need-session'){try{const saved=JSON.parse(sessionStorage.getItem('giftSession')||'null');if(saved)event.source.postMessage({type:'unlock',...saved});}catch{}}});
