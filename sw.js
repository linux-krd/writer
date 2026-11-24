const V='writer-v23',CSS=['https://cdn.jsdelivr.net/gh/rastikerdar/sahel-font@v3.4.0/dist/font-face.css','https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css'];
self.addEventListener('install',e=>{e.waitUntil((async()=>{const c=await caches.open(V);await c.addAll(['./','./index.html','./manifest.json','./icon.svg','./drive.png','./drive-gray.png','./icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png','./cloud.js','./config.js'].map(u=>new Request(u,{cache:'reload'})));
 for(const u of CSS){try{const r=await fetch(u);await c.put(u,r.clone());const t=await r.text();
  const urls=[...new Set([...t.matchAll(/url\(['"]?([^)'"?#]+\.woff2?)/g)].map(m=>new URL(m[1],u).href))];
  const w2=urls.filter(x=>x.endsWith('.woff2')),use=w2.length?w2:urls;
  await Promise.all(use.map(f=>fetch(f).then(r=>c.put(f,r)).catch(()=>{})))}catch(e){}}
 self.skipWaiting()})())});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;
 e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(h=>h||fetch(e.request).then(r=>{if(r.ok&&(r.type==='basic'||e.request.url.includes('cdn.jsdelivr.net'))){const c=r.clone();caches.open(V).then(x=>x.put(e.request,c))}return r}).catch(()=>caches.match('./index.html'))))});
