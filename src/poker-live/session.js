import { createSession, completeHand, eliminatePlayer, cancelElimination, startNextLevel, togglePause, finishSession, correctRoles, undoLast, setOverlay, setDisplayMode, publicState } from './engine.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive, nosnippet'}});
export class PokerLiveSession {
  constructor(state,env){this.state=state;this.env=env;this.sockets=new Set();}
  async load(){return await this.state.storage.get('session');}
  async save(s){s.updatedAt=Date.now();await this.state.storage.put('session',s);this.broadcast(s);return s;}
  broadcast(s){const msg=JSON.stringify({type:'state',state:publicState(s)});for(const ws of this.sockets){try{ws.send(msg)}catch{this.sockets.delete(ws)}}}
  async fetch(request){const url=new URL(request.url);let s=await this.load();
    if(request.method==='POST'&&url.pathname.endsWith('/init')){if(s)return json({error:'Session existiert bereits.'},409);const body=await request.json();s=createSession(body.setup);s.controllerToken=body.controllerToken;await this.save(s);return json({state:publicState(s)});}
    if(!s)return json({error:'Session nicht gefunden.'},404);
    if(request.method==='POST'&&url.pathname.endsWith('/admin-delete')&&request.headers.get('X-Poker-Admin-Internal')==='1'){await this.state.storage.deleteAll();for(const ws of this.sockets){try{ws.close(1000,'Session gelöscht')}catch{}}this.sockets.clear();return json({ok:true});}
    if(request.method==='POST'&&url.pathname.endsWith('/admin-recover')&&request.headers.get('X-Poker-Admin-Internal')==='1'){const body=await request.json().catch(()=>({}));if(!body.controllerToken)return json({error:'Token fehlt.'},400);s.controllerToken=String(body.controllerToken);await this.save(s);return json({state:publicState(s)});}
    const token=request.headers.get('X-Poker-Controller');const controller=token&&token===s.controllerToken;
    if(request.headers.get('Upgrade')==='websocket'){const pair=new WebSocketPair();const client=pair[0],server=pair[1];server.accept();this.sockets.add(server);server.send(JSON.stringify({type:'state',state:publicState(s),controller:Boolean(controller)}));server.addEventListener('close',()=>this.sockets.delete(server));return new Response(null,{status:101,webSocket:client});}
    if(request.method==='GET')return json({state:publicState(s),controller:Boolean(controller)});
    if(request.method!=='POST'||!controller)return json({error:'Controller-Berechtigung erforderlich.'},403);
    const action=url.pathname.split('/').pop();const body=await request.json().catch(()=>({}));
    const actionId=String(body._actionId||'');s.recentActionIds||(s.recentActionIds=[]);if(actionId&&s.recentActionIds.includes(actionId))return json({state:publicState(s)});
    try{if(action==='next-hand')completeHand(s);else if(action==='eliminate')eliminatePlayer(s,body.playerId);else if(action==='cancel-elimination')cancelElimination(s,body.playerId);else if(action==='next-level')startNextLevel(s);else if(action==='pause')togglePause(s);else if(action==='finish')finishSession(s);else if(action==='correct-roles')correctRoles(s,body);else if(action==='undo')undoLast(s);else if(action==='overlay')setOverlay(s,body.overlay);else if(action==='display-mode')setDisplayMode(s,body.mode);else return json({error:'Unbekannte Aktion.'},404);if(actionId){s.recentActionIds.push(actionId);s.recentActionIds=s.recentActionIds.slice(-30)}await this.save(s);return json({state:publicState(s)});}catch(e){return json({error:e.message},400)}
  }
}
