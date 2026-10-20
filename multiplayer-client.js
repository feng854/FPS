/* Multiplayer connection prototype. Replace COOP_SERVER_URL in index.html after deploying Worker. */
(() => {
  const panel = document.createElement('div');
  panel.innerHTML = `<b style="display:block;margin-bottom:7px">联机合作测试</b><div style="display:flex;gap:5px"><input id="coop-room" maxlength="8" value="SURVIVE" placeholder="房间号" style="width:88px;min-width:0;padding:7px"><input id="coop-name" maxlength="18" value="Survivor" placeholder="昵称" style="width:90px;min-width:0;padding:7px"><button id="coop-connect" style="padding:7px 10px">加入</button></div><div id="coop-status" style="margin-top:6px;font-size:12px">未连接</div><div id="coop-count" style="font-size:12px;margin-top:3px">房间人数：0/3</div>`;
  Object.assign(panel.style,{position:'fixed',zIndex:99999,top:'12px',right:'12px',width:'min(310px,calc(100vw - 24px))',boxSizing:'border-box',padding:'10px',color:'#fff',background:'rgba(8,15,25,.92)',border:'1px solid #64748b',borderRadius:'10px',font:'14px system-ui'});
  document.body.appendChild(panel);
  panel.querySelectorAll('input').forEach(i=>Object.assign(i.style,{boxSizing:'border-box',borderRadius:'5px',border:'1px solid #64748b',background:'#111827',color:'#fff'}));
  let ws=null,myId=null,lastSent=0,remotes=new Map();
  const status=()=>document.getElementById('coop-status');
  function connect(){
    const room=document.getElementById('coop-room').value.toUpperCase().trim();
    const name=document.getElementById('coop-name').value.trim()||'Survivor';
    if(!/^[A-Z0-9]{4,8}$/.test(room)){status().textContent='房间号需为4-8位字母或数字';return;}
    const endpoint=window.COOP_SERVER_URL;
    if(!endpoint||endpoint.includes('REPLACE-WITH-YOUR-WORKER')){status().textContent='请先在 index.html 配置 Worker 的 wss 地址';return;}
    if(ws)ws.close();const url=new URL(endpoint);url.searchParams.set('room',room);url.searchParams.set('name',name);
    ws=new WebSocket(url);status().textContent='正在连接…';
    ws.onopen=()=>status().textContent='连接成功，正在同步…';
    ws.onerror=()=>status().textContent='连接失败：检查 Worker 地址与部署状态';
    ws.onclose=e=>status().textContent=`连接已关闭 (${e.code})`;
    ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}
      if(m.type==='welcome'){myId=m.playerId;status().textContent=`已加入房间 ${m.room}`;}
      if(m.type==='state'){render(m.players||[]);document.getElementById('coop-count').textContent=`房间人数：${(m.players||[]).length}/3 · 僵尸目标：${m.zombieTarget||0}`;}
    };
  }
  function render(players){
    let sc;try{sc=scene}catch{return} if(!sc||typeof THREE==='undefined')return;
    const ids=new Set(players.filter(p=>p.id!==myId).map(p=>p.id));
    for(const [id,obj] of remotes){if(!ids.has(id)){sc.remove(obj);remotes.delete(id);}}
    for(const p of players){if(p.id===myId)continue;let g=remotes.get(p.id);
      if(!g){g=new THREE.Group();const mat=new THREE.MeshStandardMaterial({color:0x25c777});const body=new THREE.Mesh(new THREE.CapsuleGeometry(.32,.9,4,8),mat);body.position.y=1.0;g.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.2,8,8),new THREE.MeshStandardMaterial({color:0xe9c4a1}));head.position.y=1.7;g.add(head);
        const c=document.createElement('canvas');c.width=256;c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.font='bold 28px sans-serif';ctx.textAlign='center';ctx.fillText(p.name||'队友',128,42);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));sprite.position.y=2.25;sprite.scale.set(2,.5,1);g.add(sprite);sc.add(g);remotes.set(p.id,g);}
      g.position.set(p.x||0,p.y||0,p.z||0);g.rotation.y=p.yaw||0;
    }
  }
  document.getElementById('coop-connect').addEventListener('click',connect);
  window.coopTick=()=>{if(!ws||ws.readyState!==WebSocket.OPEN||performance.now()-lastSent<100)return;lastSent=performance.now();let p={x:0,y:0,z:0},yaw=0,health=100;try{p=yawObject.position;yaw=yawObject.rotation.y}catch{}try{health=gameState.health??100}catch{}ws.send(JSON.stringify({type:'move',x:p.x,y:p.y,z:p.z,yaw,health}));};
  window.coopShootEvent=()=>{if(!ws||ws.readyState!==WebSocket.OPEN)return;let p={x:0,z:0},yaw=0;try{p=yawObject.position;yaw=yawObject.rotation.y}catch{}ws.send(JSON.stringify({type:'shoot',x:p.x,z:p.z,yaw}));};
})();
