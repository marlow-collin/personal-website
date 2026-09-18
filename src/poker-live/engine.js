const nextSeat = (seat, seats) => seat % seats + 1;
const activePlayers = (s) => s.players.filter(p => p.status === 'active');
const activeAt = (s, seat) => s.players.find(p => p.seat === seat && p.status === 'active');
function nextActiveSeat(s, from) { let seat=from; for(let i=0;i<s.players.length;i++){ seat=nextSeat(seat,s.players.length); if(activeAt(s,seat)) return seat; } return null; }
function rolesFromDealer(s,dealerSeat){ const count=activePlayers(s).length; if(count===2){ const button=activeAt(s,dealerSeat)?dealerSeat:nextActiveSeat(s,dealerSeat); return {buttonSeat:button,smallBlindSeat:button,smallBlindPosition:button,bigBlindSeat:nextActiveSeat(s,button)}; } const button=dealerSeat; const sb=nextActiveSeat(s,button); return {buttonSeat:button,smallBlindSeat:sb,smallBlindPosition:sb,bigBlindSeat:nextActiveSeat(s,sb)}; }
function ensureBlindPositions(s){
  // Sessions created before V3.2.6 did not persist the nominal (possibly empty) SB seat.
  // For a live legacy session this is the safest recoverable approximation; new sessions
  // always carry smallBlindPosition explicitly.
  if(!Number.isInteger(s.smallBlindPosition)) s.smallBlindPosition=s.smallBlindSeat ?? s.bigBlindSeat;
}
function nextRolesDeadButton(s){
  const count=activePlayers(s).length;
  if(count===2){
    // TDA 36-C: in heads-up the button is the SB. Choose the next BB so the previous
    // BB does not receive the BB twice in succession, then put button/SB on the other player.
    const bb=nextActiveSeat(s,s.bigBlindSeat);
    const button=nextActiveSeat(s,bb);
    return {buttonSeat:button,smallBlindSeat:button,smallBlindPosition:button,bigBlindSeat:bb};
  }
  ensureBlindPositions(s);
  // Dead-button progression is stateful, not reconstructed from the new BB's adjacent seats:
  // - the next BB is the next ACTIVE player after the current BB;
  // - the next nominal SB position is the CURRENT BB seat (dead if that player busted);
  // - the next button position is the CURRENT nominal SB position (dead if that seat is empty).
  // This lets a dead SB/button occur for the necessary hand only and then move on normally.
  const bb=nextActiveSeat(s,s.bigBlindSeat);
  const nominalSb=s.bigBlindSeat;
  const sb=activeAt(s,nominalSb)?nominalSb:null;
  const button=s.smallBlindPosition;
  return {buttonSeat:button,smallBlindSeat:sb,smallBlindPosition:nominalSb,bigBlindSeat:bb};
}
function normalizeRoundSeen(s){ const activeIds=new Set(activePlayers(s).map(p=>p.id)); s.roundSeenBigBlind=(s.roundSeenBigBlind||[]).filter(id=>activeIds.has(id)); }
function recordCompletedBigBlind(s){ const bb=s.players.find(p=>p.seat===s.bigBlindSeat); if(bb && !(s.roundSeenBigBlind||[]).includes(bb.id)) (s.roundSeenBigBlind||(s.roundSeenBigBlind=[])).push(bb.id); }
function finishRoundIfComplete(s){ normalizeRoundSeen(s); const ids=activePlayers(s).map(p=>p.id); if(ids.length && ids.every(id=>s.roundSeenBigBlind.includes(id))){ s.round+=1; s.roundSeenBigBlind=[]; if(s.round>s.roundsPerLevel) s.status='level-change'; } }
export function createSession(input){ const players=(input.players||[]).map((name,i)=>({id:`p${i+1}`,name:String(name||`Spieler ${i+1}`).slice(0,30),seat:i+1,status:'active'})); if(players.length<2) throw new Error('Mindestens zwei Spieler erforderlich.'); const dealer=Math.max(1,Math.min(players.length,Number(input.dealerSeat)||1)); const s={version:2,status:'running',players,level:1,round:1,hand:1,roundsPerLevel:Math.max(1,Number(input.roundsPerLevel)||2),blindLevels:input.blindLevels||[{sb:5,bb:10}],colorUps:Array.isArray(input.colorUps)?input.colorUps.map(x=>({value:Number(x.value),afterSb:Number(x.afterSb),afterBb:Number(x.afterBb)})).filter(x=>x.value>0):[],pendingEliminations:[],roundSeenBigBlind:[],overlay:null,displayMode:'table',eventLog:[],createdAt:Date.now()}; Object.assign(s,rolesFromDealer(s,dealer)); log(s,'Turnier gestartet'); return s; }
function log(s,label){ s.eventLog.unshift({at:Date.now(),label}); s.eventLog=s.eventLog.slice(0,60); }
export function completeHand(s){
  if(s.status!=='running') throw new Error('Aktuell kann keine Hand beendet werden.');
  // Count the BB that was actually posted in the hand just completed. This fixes the
  // former one-hand-early round counter (the old engine counted the upcoming hand's BB).
  recordCompletedBigBlind(s);
  for(const id of s.pendingEliminations){ const p=s.players.find(x=>x.id===id); if(p) p.status='out'; }
  s.pendingEliminations=[];
  normalizeRoundSeen(s);
  if(activePlayers(s).length<2){ s.status='finished'; log(s,'Turnier beendet'); return s; }
  const roles=nextRolesDeadButton(s); Object.assign(s,roles); s.hand+=1;
  finishRoundIfComplete(s);
  log(s,s.status==='level-change'?'Blindstufe abgeschlossen':'Nächste Hand'); return s;
}
export function eliminatePlayer(s,id){ const p=s.players.find(x=>x.id===id && x.status==='active'); if(!p) throw new Error('Spieler nicht aktiv.'); if(activePlayers(s).length<=2) throw new Error('Beim letzten Duell beendet der Gewinner das Turnier.'); if(!s.pendingEliminations.includes(id)) s.pendingEliminations.push(id); log(s,`${p.name}: Ausscheiden nach dieser Hand`); return s; }
export function cancelElimination(s,id){ s.pendingEliminations=s.pendingEliminations.filter(x=>x!==id); return s; }
export function startNextLevel(s){ if(s.status!=='level-change') throw new Error('Level ist noch nicht abgeschlossen.'); if(s.level>=s.blindLevels.length) s.blindLevels.push({sb:s.blindLevels.at(-1).sb*2,bb:s.blindLevels.at(-1).bb*2}); s.level+=1;s.round=1;s.roundSeenBigBlind=[];s.status='running';log(s,`Blinds ${s.blindLevels[s.level-1].sb}/${s.blindLevels[s.level-1].bb} gestartet`);return s; }
export function togglePause(s){ if(s.status==='paused'){s.status='running';log(s,'Pause beendet');} else if(s.status==='running'){s.status='paused';log(s,'Pause gestartet');} return s; }
export function setOverlay(s,overlay){s.overlay=overlay||null;return s;}
export function setDisplayMode(s,mode){s.displayMode=['table','broadcast','minimal'].includes(mode)?mode:'table';return s;}
export function publicState(s){ ensureBlindPositions(s); const {controllerToken,...safe}=s; const currentBlinds=s.blindLevels[Math.min(s.level-1,s.blindLevels.length-1)],nextBlinds=s.blindLevels[s.level]||null; const colorUps=(s.colorUps||[]).filter(x=>x.afterSb===currentBlinds.sb&&x.afterBb===currentBlinds.bb).map(x=>x.value); return {...safe,currentBlinds,nextBlinds,colorUpsDue:colorUps}; }
