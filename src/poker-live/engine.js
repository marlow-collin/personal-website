const nextSeat = (seat, seats) => seat % seats + 1;
const prevSeat = (seat, seats) => (seat + seats - 2) % seats + 1;
const activePlayers = (s) => s.players.filter(p => p.status === 'active');
const activeAt = (s, seat) => s.players.find(p => p.seat === seat && p.status === 'active');
function nextActiveSeat(s, from) { let seat=from; for(let i=0;i<s.players.length;i++){ seat=nextSeat(seat,s.players.length); if(activeAt(s,seat)) return seat; } return null; }
function prevActiveSeat(s, from) { let seat=from; for(let i=0;i<s.players.length;i++){ seat=prevSeat(seat,s.players.length); if(activeAt(s,seat)) return seat; } return null; }
function rolesFromDealer(s, dealerSeat){ const count=activePlayers(s).length; if(count===2){ const button=activeAt(s,dealerSeat)?dealerSeat:nextActiveSeat(s,dealerSeat); return {buttonSeat:button,smallBlindSeat:button,bigBlindSeat:nextActiveSeat(s,button)}; } const button=dealerSeat; const sb=nextActiveSeat(s,button); return {buttonSeat:button,smallBlindSeat:sb,bigBlindSeat:nextActiveSeat(s,sb)}; }
function nextRolesDeadButton(s){ const count=activePlayers(s).length; if(count===2){ let bb=nextActiveSeat(s,s.bigBlindSeat); // Heads-up: nobody may receive the BB twice in a row.
    if(bb===s.bigBlindSeat) bb=nextActiveSeat(s,bb); const button=nextActiveSeat(s,bb); return {buttonSeat:button,smallBlindSeat:button,bigBlindSeat:bb}; }
  // TDA dead-button method: the BIG BLIND is the anchor and advances to the next active player.
  // SB and button are the two PHYSICAL seats immediately before that BB seat; they are not
  // compressed to the previous active players. Therefore the SB can be dead (null), and the
  // button can legitimately sit on an eliminated/empty seat. This is the key difference from
  // a forward-moving button and prevents a player from skipping the BB.
  const bb=nextActiveSeat(s,s.bigBlindSeat);
  const nominalSb=prevSeat(bb,s.players.length);
  const sb=activeAt(s,nominalSb)?nominalSb:null;
  const button=prevSeat(nominalSb,s.players.length);
  return {buttonSeat:button,smallBlindSeat:sb,bigBlindSeat:bb}; }
function normalizeRoundSeen(s){ const activeIds=new Set(activePlayers(s).map(p=>p.id)); s.roundSeenBigBlind=(s.roundSeenBigBlind||[]).filter(id=>activeIds.has(id)); }
function markBigBlind(s){ normalizeRoundSeen(s); const bb=s.players.find(p=>p.seat===s.bigBlindSeat); if(bb && !s.roundSeenBigBlind.includes(bb.id)) s.roundSeenBigBlind.push(bb.id); const activeIds=activePlayers(s).map(p=>p.id); if(activeIds.length && activeIds.every(id=>s.roundSeenBigBlind.includes(id))){ s.round += 1; s.roundSeenBigBlind=[]; if(s.round>s.roundsPerLevel){ s.status='level-change'; } } }
export function createSession(input){ const players=(input.players||[]).map((name,i)=>({id:`p${i+1}`,name:String(name||`Spieler ${i+1}`).slice(0,30),seat:i+1,status:'active'})); if(players.length<2) throw new Error('Mindestens zwei Spieler erforderlich.'); const dealer=Math.max(1,Math.min(players.length,Number(input.dealerSeat)||1)); const s={version:1,status:'running',players,level:1,round:1,hand:1,roundsPerLevel:Math.max(1,Number(input.roundsPerLevel)||2),blindLevels:input.blindLevels||[{sb:5,bb:10}],pendingEliminations:[],roundSeenBigBlind:[],overlay:null,displayMode:'table',eventLog:[],createdAt:Date.now()}; Object.assign(s,rolesFromDealer(s,dealer)); markBigBlind(s); log(s,'Turnier gestartet'); return s; }
function log(s,label){ s.eventLog.unshift({at:Date.now(),label}); s.eventLog=s.eventLog.slice(0,60); }
export function completeHand(s){ if(s.status!=='running') throw new Error('Aktuell kann keine Hand beendet werden.'); for(const id of s.pendingEliminations){ const p=s.players.find(x=>x.id===id); if(p) p.status='out'; } s.pendingEliminations=[]; if(activePlayers(s).length<2){ s.status='finished'; log(s,'Turnier beendet'); return s; } const roles=nextRolesDeadButton(s); Object.assign(s,roles); s.hand+=1; markBigBlind(s); log(s,s.status==='level-change'?'Blindlevel abgeschlossen':'Nächste Hand'); return s; }
export function eliminatePlayer(s,id){ const p=s.players.find(x=>x.id===id && x.status==='active'); if(!p) throw new Error('Spieler nicht aktiv.'); if(activePlayers(s).length<=2) throw new Error('Beim letzten Duell beendet der Gewinner das Turnier.'); if(!s.pendingEliminations.includes(id)) s.pendingEliminations.push(id); log(s,`${p.name}: Ausscheiden nach dieser Hand`); return s; }
export function cancelElimination(s,id){ s.pendingEliminations=s.pendingEliminations.filter(x=>x!==id); return s; }
export function startNextLevel(s){ if(s.status!=='level-change') throw new Error('Level ist noch nicht abgeschlossen.'); if(s.level>=s.blindLevels.length) s.blindLevels.push({sb:s.blindLevels.at(-1).sb*2,bb:s.blindLevels.at(-1).bb*2}); s.level+=1;s.round=1;s.roundSeenBigBlind=[];s.status='running';markBigBlind(s);log(s,`Level ${s.level} gestartet`);return s; }
export function togglePause(s){ if(s.status==='paused'){s.status='running';log(s,'Pause beendet');} else if(s.status==='running'){s.status='paused';log(s,'Pause gestartet');} return s; }
export function setOverlay(s,overlay){s.overlay=overlay||null;return s;}
export function setDisplayMode(s,mode){s.displayMode=['table','broadcast','minimal'].includes(mode)?mode:'table';return s;}
export function publicState(s){ const {controllerToken,...safe}=s; return {...safe,currentBlinds:s.blindLevels[Math.min(s.level-1,s.blindLevels.length-1)],nextBlinds:s.blindLevels[s.level]||null}; }
