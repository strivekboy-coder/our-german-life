'use strict';
let currentKey=null,currentManifest=null;const decoded=new Map();let waiter=null;
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
 if(event.data?.type!=='unlock')return;
 event.waitUntil((async()=>{try{const bytes=Uint8Array.from(atob(event.data.key),c=>c.charCodeAt(0));currentKey=await crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['decrypt']);currentManifest=event.data.manifest;decoded.clear();if(waiter){waiter();waiter=null;}event.ports[0]?.postMessage({ok:true});}catch{event.ports[0]?.postMessage({ok:false});}})());
});
async function ready(clientId){
 if(currentKey&&currentManifest)return true;
 const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 const targets=clients.filter(c=>new URL(c.url).pathname.startsWith(new URL(self.registration.scope).pathname));
 if(!targets.length)return false;
 await new Promise(resolve=>{waiter=resolve;for(const c of targets)c.postMessage({type:'need-session'});setTimeout(resolve,4000)});
 return !!(currentKey&&currentManifest);
}
async function resource(event,relative){
 if(!await ready(event.clientId))return new Response('请先开启生日礼物。',{status:403,headers:{'Content-Type':'text/plain; charset=utf-8'}});
 const meta=currentManifest[relative];if(!meta)return new Response('Not found',{status:404});
 let data=decoded.get(relative);
 if(!data){const response=await fetch(new URL(meta.file,self.registration.scope),{cache:'force-cache'});if(!response.ok)return response;const bytes=new Uint8Array(await response.arrayBuffer());data=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)},currentKey,bytes.slice(12));decoded.set(relative,data);if(decoded.size>24)decoded.delete(decoded.keys().next().value);}
 const headers={'Content-Type':meta.mime,'Cache-Control':'no-store'};
 const range=event.request.headers.get('Range');
 if(range){const m=/bytes=(\d+)-(\d*)/.exec(range);if(m){const start=Number(m[1]),end=m[2]?Math.min(Number(m[2]),data.byteLength-1):data.byteLength-1;if(start<data.byteLength){headers['Content-Range']=`bytes ${start}-${end}/${data.byteLength}`;headers['Accept-Ranges']='bytes';return new Response(data.slice(start,end+1),{status:206,headers});}}}
 return new Response(data,{headers});
}
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url),scope=new URL(self.registration.scope);if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 let relative;try{relative=decodeURIComponent(url.pathname.slice(scope.pathname.length));}catch{return;}
 if(relative==='reader.html'||relative.startsWith('assets/'))event.respondWith(resource(event,relative).catch(()=>new Response('请重新开启礼物。',{status:403})));
});
