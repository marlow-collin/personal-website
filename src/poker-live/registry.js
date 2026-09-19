const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive, nosnippet'}});
const SETTINGS_KEY='settings';
function cleanMeta(input={}){const code=String(input.code||'').toUpperCase();if(!/^[A-Z0-9]{6}$/.test(code))throw new Error('Ungültiger Session-Code.');return {code,status:String(input.status||'unknown'),playerCount:Math.max(0,Number(input.playerCount)||0),activePlayerCount:Math.max(0,Number(input.activePlayerCount)||0),hand:Math.max(1,Number(input.hand)||1),level:Math.max(1,Number(input.level)||1),currentBlinds:input.currentBlinds&&Number.isFinite(Number(input.currentBlinds.sb))&&Number.isFinite(Number(input.currentBlinds.bb))?{sb:Number(input.currentBlinds.sb),bb:Number(input.currentBlinds.bb)}:null,createdAt:Number(input.createdAt)||Date.now(),lastActivityAt:Number(input.lastActivityAt)||Number(input.createdAt)||Date.now()};}
function cleanHours(value){const n=Number(value);if(!Number.isFinite(n)||n<0)return 0;return Math.min(24*365,Math.round(n));}
export class PokerLiveRegistry{
  constructor(state,env){this.state=state;this.env=env;}
  async settings(){return {autoDeleteHours:0,...(await this.state.storage.get(SETTINGS_KEY)||{})};}
  async schedule(settings){if(settings.autoDeleteHours>0)await this.state.storage.setAlarm(Date.now()+60*60*1000);else await this.state.storage.deleteAlarm();}
  async deleteSession(code){const id=this.env.POKER_LIVE.idFromName(code),stub=this.env.POKER_LIVE.get(id);await stub.fetch(new Request('https://session/admin-delete',{method:'POST',headers:{'X-Poker-Admin-Internal':'1'}}));await this.state.storage.delete(`session:${code}`);}
  async cleanup(){const settings=await this.settings();if(settings.autoDeleteHours<=0)return 0;const cutoff=Date.now()-settings.autoDeleteHours*60*60*1000;const stored=await this.state.storage.list({prefix:'session:'});let count=0;for(const meta of stored.values()){if(Number(meta.lastActivityAt||0)<=cutoff){await this.deleteSession(meta.code);count++;}}return count;}
  async alarm(){await this.cleanup();await this.schedule(await this.settings());}
  async fetch(request){const url=new URL(request.url);
    if(request.method==='POST'&&url.pathname==='/upsert'){try{const next=cleanMeta(await request.json()),key=`session:${next.code}`,previous=await this.state.storage.get(key);if(previous){next.createdAt=Number(previous.createdAt)||next.createdAt;next.lastActivityAt=Math.max(Number(previous.lastActivityAt)||0,next.lastActivityAt);}await this.state.storage.put(key,next);await this.schedule(await this.settings());return json({ok:true});}catch(error){return json({error:error.message},400)}}
    if(request.method==='GET'&&url.pathname==='/list'){const stored=await this.state.storage.list({prefix:'session:'}),sessions=[...stored.values()].sort((a,b)=>(b.lastActivityAt||0)-(a.lastActivityAt||0));return json({sessions,settings:await this.settings()});}
    if(request.method==='GET'&&url.pathname==='/settings')return json({settings:await this.settings()});
    if(request.method==='PUT'&&url.pathname==='/settings'){const body=await request.json().catch(()=>({})),settings={autoDeleteHours:cleanHours(body.autoDeleteHours)};await this.state.storage.put(SETTINGS_KEY,settings);await this.schedule(settings);return json({settings});}
    if(request.method==='POST'&&url.pathname==='/cleanup'){const deleted=await this.cleanup();return json({deleted,settings:await this.settings()});}
    if(request.method==='DELETE'&&url.pathname==='/sessions'){const stored=await this.state.storage.list({prefix:'session:'});let deleted=0;for(const meta of stored.values()){await this.deleteSession(meta.code);deleted++;}return json({ok:true,deleted});}
    if(request.method==='DELETE'&&url.pathname.startsWith('/sessions/')){const code=url.pathname.split('/').pop().toUpperCase();if(!/^[A-Z0-9]{6}$/.test(code))return json({error:'Ungültiger Session-Code.'},400);await this.deleteSession(code);return json({ok:true});}
    return json({error:'Nicht gefunden.'},404);
  }
}
