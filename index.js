import { DurableObject } from "cloudflare:workers";

const MAX_PLAYERS = 3;
const ROOM_CODE = /^[A-Z0-9]{4,8}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true, service: "zombie-coop", maxPlayers: MAX_PLAYERS });
    if (url.pathname !== "/ws") return new Response("Not found", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") return new Response("WebSocket upgrade required", { status: 426 });
    const room = (url.searchParams.get("room") || "SURVIVE").toUpperCase().trim();
    if (!ROOM_CODE.test(room)) return new Response("房间号须为4-8位英文字母或数字", { status: 400 });
    return env.GAME_ROOM.getByName(room).fetch(request);
  }
};

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.ensureZombies();
  }
  ensureZombies() {
    const count = this.ctx.getWebSockets().filter(ws => ws.readyState === WebSocket.OPEN).length;
    const target = count <= 1 ? 10 : count === 2 ? 16 : 22;
    if (!this.zombies) this.zombies = [];
    if (!this.nextZombieId) this.nextZombieId = 1;
    while (this.zombies.length < target) {
      const id = this.nextZombieId++;
      this.zombies.push({ id, hp: id % 4 === 0 ? 220 : id % 3 === 0 ? 130 : 90,
        type: id % 4 === 0 ? "armored" : id % 3 === 0 ? "bloater" : "walker",
        x: (Math.random() - .5) * 35, z: (Math.random() - .5) * 35 });
    }
    this.zombies.length = target;
  }
  broadcast(data, except = null) {
    const raw = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets()) if (ws !== except && ws.readyState === WebSocket.OPEN) {
      try { ws.send(raw); } catch {}
    }
  }
  sendState() {
    this.ensureZombies();
    const players = this.ctx.getWebSockets().filter(ws => ws.readyState === WebSocket.OPEN).map(ws => ws.deserializeAttachment()).filter(Boolean);
    this.broadcast({ type: "state", players: players.map(p => ({ id:p.id, name:p.name, x:p.x||0, y:p.y||0, z:p.z||0, yaw:p.yaw||0, health:p.health??100 })), zombieTarget:this.zombies.length, zombies:this.zombies });
  }
  async fetch(request) {
    if (this.ctx.getWebSockets().filter(ws => ws.readyState === WebSocket.OPEN).length >= MAX_PLAYERS) return new Response("房间已满（最多3人）", { status: 409 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const url = new URL(request.url);
    const p = { id:crypto.randomUUID(), name:(url.searchParams.get("name")||"Survivor").slice(0,18), x:0,y:0,z:0,yaw:0,health:100 };
    server.serializeAttachment(p);
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify({ type:"welcome", playerId:p.id, room:url.searchParams.get("room")||"SURVIVE", maxPlayers:3 }));
    this.sendState();
    return new Response(null, { status:101, webSocket:client });
  }
  webSocketMessage(ws, raw) {
    let msg; try { msg=JSON.parse(raw); } catch { return; }
    const p=ws.deserializeAttachment(); if (!p || !msg) return;
    if (msg.type === "move") {
      const clamp=(v,min,max)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):0;
      ws.serializeAttachment({...p,x:clamp(msg.x,-100,100),y:clamp(msg.y,0,10),z:clamp(msg.z,-100,100),yaw:clamp(msg.yaw,-1000,1000),health:clamp(msg.health,0,100)});
      this.sendState();
    } else if (msg.type === "shoot") this.broadcast({type:"shoot",playerId:p.id,x:p.x,z:p.z,yaw:p.yaw},ws);
    else if (msg.type === "ping") ws.send(JSON.stringify({type:"pong",time:Date.now()}));
  }
  webSocketClose() { this.sendState(); }
  webSocketError() { this.sendState(); }
}
