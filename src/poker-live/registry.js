const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive, nosnippet'}});

function cleanMeta(input={}){
  const code=String(input.code||'').toUpperCase();
  if(!/^[A-Z0-9]{6}$/.test(code)) throw new Error('Ungültiger Session-Code.');
  return {
    code,
    status:String(input.status||'unknown'),
    playerCount:Math.max(0,Number(input.playerCount)||0),
    activePlayerCount:Math.max(0,Number(input.activePlayerCount)||0),
    hand:Math.max(1,Number(input.hand)||1),
    level:Math.max(1,Number(input.level)||1),
    currentBlinds:input.currentBlinds&&Number.isFinite(Number(input.currentBlinds.sb))&&Number.isFinite(Number(input.currentBlinds.bb))?{sb:Number(input.currentBlinds.sb),bb:Number(input.currentBlinds.bb)}:null,
    createdAt:Number(input.createdAt)||Date.now(),
    lastActivityAt:Number(input.lastActivityAt)||Number(input.createdAt)||Date.now()
  };
}

export class PokerLiveRegistry{
  constructor(state,env){this.state=state;this.env=env;}
  async fetch(request){
    const url=new URL(request.url);
    if(request.method==='POST'&&url.pathname==='/upsert'){
      try{
        const next=cleanMeta(await request.json());
        const key=`session:${next.code}`;
        const previous=await this.state.storage.get(key);
        if(previous){
          next.createdAt=Number(previous.createdAt)||next.createdAt;
          next.lastActivityAt=Math.max(Number(previous.lastActivityAt)||0,next.lastActivityAt);
        }
        await this.state.storage.put(key,next);
        return json({ok:true});
      }catch(error){return json({error:error.message},400)}
    }
    if(request.method==='GET'&&url.pathname==='/list'){
      const stored=await this.state.storage.list({prefix:'session:'});
      const sessions=[...stored.values()].sort((a,b)=>(b.lastActivityAt||0)-(a.lastActivityAt||0));
      return json({sessions});
    }
    return json({error:'Nicht gefunden.'},404);
  }
}
