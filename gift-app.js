'use strict';
const decode64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const encode64=a=>btoa(String.fromCharCode(...a));
async function decryptPacket(key,buffer){const a=new Uint8Array(buffer);return crypto.subtle.decrypt({name:'AES-GCM',iv:a.slice(0,12)},key,a.slice(12));}
async function passwordKey(values,salt,rounds){const bytes=new TextEncoder().encode(JSON.stringify(values));const key=await crypto.subtle.importKey('raw',bytes,'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:decode64(salt),iterations:rounds,hash:'SHA-256'},key,{name:'AES-GCM',length:256},false,['decrypt']);}
async function configureWorker(master){
 const key=await crypto.subtle.importKey('raw',decode64(master),'AES-GCM',false,['decrypt']);
 const buffer=await (await fetch('vault/manifest.bin')).arrayBuffer();
 const manifest=JSON.parse(new TextDecoder().decode(await decryptPacket(key,buffer)));
 sessionStorage.setItem('giftSession',JSON.stringify({key:master,manifest}));
 await navigator.serviceWorker.register('sw.js',{scope:'./'});const registration=await navigator.serviceWorker.ready;
 if(!navigator.serviceWorker.controller)await new Promise(resolve=>{const done=()=>{navigator.serviceWorker.removeEventListener('controllerchange',done);resolve()};navigator.serviceWorker.addEventListener('controllerchange',done);if(navigator.serviceWorker.controller)done()});
 const target=navigator.serviceWorker.controller||registration.active;
 await new Promise((resolve,reject)=>{const channel=new MessageChannel();const timer=setTimeout(()=>reject(new Error('礼物暂时没有准备好，请再试一次。')),15000);channel.port1.onmessage=e=>{clearTimeout(timer);if(e.data.ok)resolve();else reject(new Error('请重新输入三个答案。'))};target.postMessage({type:'unlock',key:master,manifest},[channel.port2]);});
}
navigator.serviceWorker?.addEventListener('message',event=>{if(event.data?.type==='need-session'){try{const saved=JSON.parse(sessionStorage.getItem('giftSession')||'null');if(saved)event.source.postMessage({type:'unlock',...saved});}catch{}}});
async function bootReader(){
 try{
  const saved=JSON.parse(sessionStorage.getItem('giftSession')||'null');if(!saved)throw new Error('locked');
  await configureWorker(saved.key);sessionStorage.setItem('birthdayGiftOpened','yes');
  const frame=document.createElement('iframe');frame.title='我们在德国的这一年';frame.allow='autoplay; fullscreen';frame.src='reader.html?page=1';frame.onload=()=>document.getElementById('loading')?.remove();document.body.append(frame);
 }catch{location.replace('index.html');}
}
const form=document.getElementById('giftForm');
if(form){
 const popup=document.getElementById('errorDialog'),image=document.getElementById('errorImage'),button=form.querySelector('button[type=submit]');
 document.getElementById('retry').onclick=()=>popup.close();
 form.addEventListener('submit',async event=>{
  event.preventDefault();const values=['account','password','password2'].map(id=>document.getElementById(id).value.trim());
  button.disabled=true;button.textContent='正在打开礼物…';
  let metadata;
  try{
   metadata=await (await fetch('unlock.json',{cache:'no-store'})).json();
   const pass=await passwordKey(values,metadata.salt,metadata.rounds);const master=new Uint8Array(await decryptPacket(pass,decode64(metadata.wrappedKey)));
   await configureWorker(encode64(master));sessionStorage.setItem('birthdayGiftOpened','yes');location.href='album.html?page=1';return;
  }catch(error){
   image.src='error.webp';image.hidden=false;
   popup.showModal();
  }finally{button.disabled=false;button.textContent='开启生日礼物 →';}
 });
}else bootReader();
