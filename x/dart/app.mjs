import {
  TIME_OPTIONS, QUICK_SCORES, FOCUS_LABELS, LABELS, CHALLENGES, shuffled, choose,
  checkoutRoutes, createLeg, undoLeg, submitVisit, submitDart, legAverage, completedAverage,
  formatAverage, ATC_ASC, ATC_DESC, TARGET_SEQUENCES, CHECKOUT_TARGETS,
  cricketTargets, buildSession
} from './engine.mjs';

const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
const state = {
  screen:'home', setup:{focus:'allround',mode:'time',minutes:20,allowCricket:false},
  session:null, ex:null, result:null, checkoutValue:'74', scoreDraft:'', dartTab:'T',
  challenge:null, toastId:0
};
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn = (title, action, cls='btn', attrs='') => `<button type="button" class="${cls}" data-action="${action}" ${attrs}>${title}</button>`;
const nav = (name='Startseite') => btn(`← ${name}`,'home','btn quiet small');
const title = (tag,heading,detail='') => `<div class="lead"><span class="eyebrow">${escape(tag)}</span><h1>${escape(heading)}</h1>${detail?`<p>${escape(detail)}</p>`:''}</div>`;
const chip = (label,action,val,selected) => btn(escape(label),action,`chip${selected?' selected':''}`,`data-value="${escape(val)}" aria-pressed="${selected}"`);
const number = n => Number(n).toLocaleString('de-DE');
const stat = (name,value) => `<div class="stat"><strong>${escape(value)}</strong><span>${escape(name)}</span></div>`;
const floatStat = (name,value) => stat(name,formatAverage(value));
const panel = (inner,cls='') => `<section class="panel ${cls}">${inner}</section>`;
const rule = (s) => `<p class="hint">${escape(s)}</p>`;
function notify(message, isError=false) {
  const id=++state.toastId;
  toast.textContent=message;
  toast.style.background=isError?'#ffd0c4':'#dfefb6';
  toast.hidden=false;
  setTimeout(()=>{if(id===state.toastId)toast.hidden=true;},2900);
}
function navigate(screen) { state.screen=screen; render(); window.scrollTo(0,0); }
function confirmLeave() {
  return !state.ex?.started || state.ex.finished || window.confirm('Die aktuelle Übung wird beendet. Nicht gespeicherte Ergebnisse gehen verloren. Fortfahren?');
}
function home() {
  if(!confirmLeave())return;
  state.session=null;state.ex=null;state.challenge=null;state.result=null;navigate('home');
}
function homeView() {
  return `<div class="section">${title('SOLO TRAINING / NO ACCOUNTS','Deine Scheibe. Dein Training.','Starte eine gezielte Übung oder lass dir eine komplette Session zusammenstellen.')}
    <section class="hero"><span class="eyebrow">SOFORT LOSLEGEN</span><h2>Überrasch mich.<br>20 Minuten Dart.</h2><p>Ein abwechslungsreicher Trainingsmix ohne Konfiguration.</p>${btn('Session starten →','surprise','btn big')}</section>
    <div class="grid2">${panel(`<span class="eyebrow">01 / TRAINING</span><h2>Session bauen</h2><p>Fokus wählen, Dauer festlegen, trainieren.</p>${btn('Training starten →','open-setup','btn primary block')}`)}${panel(`<span class="eyebrow">02 / EINZELN</span><h2>Freie Übung</h2><p>170 Down, Scoring, Doppel, Cricket und mehr.</p>${btn('Übungen öffnen →','open-library','btn primary block')}`)}</div>
    <div class="grid2">${panel(`<span class="eyebrow">03 / WERKZEUG</span><h2>Checkout-Hilfe</h2><p>Rest eingeben, Wege ansehen.</p>${btn('Routen öffnen →','open-checkout','btn outline block')}`)}${panel(`<span class="eyebrow">04 / CHALLENGES</span><h2>Hard Mode</h2><p>Acht besondere Aufgaben – such dir eine aus.</p>${btn('Challenges →','open-challenges','btn outline block')}`)}</div>
    <p class="micro">Keine Accounts, Cookies, lokale Speicherung oder Audioausgabe. Ein Neuladen setzt den Trainingsstand zurück.</p></div>`;
}
function setupView() {
  const s=state.setup;
  return `<div class="section">${nav()}${title('TRAININGSGENERATOR','Was steht heute an?','Wähle deinen Fokus und starte direkt mit der ersten Aufgabe.')}
    ${panel(`<h2>Trainingsfokus</h2><div class="chip-group">${Object.entries(FOCUS_LABELS).map(([id,name])=>chip(name,'focus',id,s.focus===id)).join('')}</div>`)}
    ${panel(`<h2>Trainingsart</h2><div class="grid2">${chip('Zeitbasiert','session-mode','time',s.mode==='time')}${chip('Aufgabenbasiert','session-mode','tasks',s.mode==='tasks')}</div>
      ${s.mode==='time'?`<div class="field"><span class="subheading">Trainingsdauer</span><div class="grid4">${TIME_OPTIONS.map(m=>chip(`${m} Min.`,'minutes',m,s.minutes===m)).join('')}</div></div>
      <label class="setup-choice"><input type="checkbox" data-change="cricket-allowed" ${s.allowCricket?'checked':''}><span>Random Cricket bei Zeittraining zulassen</span></label>`:
      `<div class="strip">Eine normale Einheit mit festen Aufgaben. Ohne Gesamttimer und ohne zusätzliche Umfangseinstellung.</div>`}`)}
    ${btn('Training starten →','generate','btn primary big block')}</div>`;
}
function libraryView() {
  const descriptions={scoring:'High Scoring und Segment Scoring – mit optionaler Triple-Erfassung.',doubles:'Doppelfelder und Trefferquoten.',around:'Klassisch oder drei Darts pro Ziel.',target:'Singles, Doubles, Triples und Bull kombinieren.',quick:'Wechselnde Drei-Dart-Checkout-Ziele.',extended:'Mehrere Aufnahmen pro Checkout-Ziel.',down:'170 auf null: Live-Average, Bust und Checkout.',cricket:'Sechs zufällige Zahlen, mit oder ohne Bull.'};
  return `<div class="section">${nav()}${title('ÜBUNGSBIBLIOTHEK','Was trainierst du?','Wähle eine Übung. Sie läuft einzeln, bis du sie beendest oder ihre Aufgabe abschließt.')}
    ${Object.entries(LABELS).filter(([key])=>key!=='warmup').map(([key,label])=>`<button class="challenge-item" data-action="open-exercise" data-value="${key}"><strong>${escape(label)}</strong><span>${escape(descriptions[key])}</span></button>`).join('')}</div>`;
}
function checkoutMarkup(value,darts=3) {
  const n=Number(value);
  if(!/^\d{1,3}$/.test(String(value))||n<2||n>170) return '<p class="route-empty">Bitte eine Restpunktzahl von 2 bis 170 eingeben.</p>';
  const routes=checkoutRoutes(n,darts,5);
  if(!routes.length) return `<p class="route-empty">Kein regulärer Checkout mit ${darts} ${darts===1?'Dart':'Darts'} möglich.</p>`;
  const main=`<span class="route">${escape(routes[0].join(' → '))}</span>`;
  return `${main}${routes.length>1?`<details><summary>Weitere Wege (${routes.length-1})</summary><ol class="route-list">${routes.slice(1).map(r=>`<li>${escape(r.join(' → '))}</li>`).join('')}</ol></details>`:''}`;
}
function checkoutToolView() {
  return `<div class="section">${nav()}${title('CHECKOUT ASSISTANT','Der Weg auf null.','Double-out-Routen von 2 bis 170. Die erste Route erscheint direkt, Alternativen sind aufklappbar.')}
    ${panel(`<div class="field"><label for="checkout-rest">Restpunktzahl</label><input id="checkout-rest" data-input="checkout-rest" type="number" min="2" max="170" inputmode="numeric" autocomplete="off" value="${escape(state.checkoutValue)}"></div><div id="checkout-output" class="stack" aria-live="polite">${checkoutMarkup(state.checkoutValue)}</div>`)}
    <p class="micro">Mögliche Wege, keine Garantie für die persönlich beste Route. Bei einem Bust bleibt der Rest vor der Aufnahme bestehen.</p></div>`;
}
function challengeListView() {
  return `<div class="section">${nav()}${title('HARD MODE','Fordere dich heraus.','Wähle eine Aufgabe oder lass den Zufall entscheiden. Schwierige Aufgaben gehören nicht zur normalen Trainingsrotation.')}
    ${panel(btn('Zufällige Herausforderung ↗','random-challenge','btn primary big block'))}
    ${CHALLENGES.map(ch=>`<button class="challenge-item" data-action="open-challenge" data-value="${ch.id}"><span class="eyebrow">${escape(ch.category)}</span><strong>${escape(ch.name)}</strong><span>${escape(ch.rule)}</span></button>`).join('')}</div>`;
}
function newExercise(block) {
  const config={variant:'high',extended:false,goal:20,entry:'quick',direction:'desc',aroundType:'accuracy',trackDarts:false,range:'all',bull:false,order:'free',maxVisits:3};
  if(block.type==='extended')config.entry='simple';
  return {block, config, started:false, finished:false, expired:false, timer:{remainingMs:(block.minutes||0)*60000,running:false,lastAt:0},data:null,undo:[]};
}
function launchExercise(type) {
  if(!LABELS[type])return;
  state.session=null;state.scoreDraft='';state.ex=newExercise({type,mode:'single'});navigate('exercise');
}
function startSession(blocks) {
  state.session={blocks,index:0,results:[]}; state.ex=newExercise({...blocks[0],mode:state.setup.mode});
  state.scoreDraft='';navigate('exercise');
}
function focusOfCurrent() {return state.session?`${state.session.index+1} / ${state.session.blocks.length}`:'EINZELTRAINING';}
function exerciseHeader(ex) {
  return `<div class="topline"><span>${state.session?`SESSION · ÜBUNG ${focusOfCurrent()}`:'SOLO · EINZELÜBUNG'}</span>${nav('Beenden')}</div>
   ${title(ex.started?'JETZT BIST DU DRAN':'BEREIT ZUM WERFEN',LABELS[ex.block.type],ex.block.mode==='time'?`${ex.block.minutes} Minuten geplant · Dein Wechsel bleibt manuell.`:'')}`;
}
function configChoice(label,field,options,current) {
  return `<div class="field"><span class="subheading">${escape(label)}</span><div class="chip-group">${options.map(([v,t])=>chip(t,`config-${field}`,v,String(current)===String(v))).join('')}</div></div>`;
}
function prestartConfig(ex) {
  const c=ex.config,t=ex.block.type;
  switch(t) {
    case 'warmup':return rule('Locker einwerfen: einzelne Zahlen, Triple und Bull anwerfen. Kein Ergebnis nötig.');
    case 'scoring':return `${rule('Drei Darts pro Aufnahme. Beim klassischen Scoring zählen alle Punkte, beim Segment Scoring nur Treffer im Zielsegment.')}
      ${configChoice('Wertung','variant',[['high','High Scoring'],['segment','Segment Scoring']],c.variant)}
      ${configChoice('Zielsegment','goal',[[20,'20'],[19,'19'],[18,'18']],c.goal)}
      ${configChoice('Erfassung','extended',[[false,'Nur Punkte'],[true,'Punkte + Triple-Treffer']],c.extended)}`;
    case 'doubles':return `${rule('Drei Darts auf das angezeigte Doppel. Gib danach 0 bis 3 Treffer ein.')}${configChoice('Art','variant',[['high','Wechselnde Doppel'],['chain','Doppel-Sequenz']],c.variant)}`;
    case 'around':return `${rule('Accuracy: genau drei Darts pro Ziel. Klassisch: erst nach einem Treffer weiter. Bull bildet den Abschluss.')}
      ${configChoice('Variante','aroundType',[['accuracy','Accuracy'],['classic','Klassisch']],c.aroundType)}
      ${configChoice('Richtung','direction',[['desc','20 → 1 → Bull'],['asc','1 → 20 → Bull']],c.direction)}
      ${c.aroundType==='classic'?configChoice('Fehlwürfe','trackDarts',[[false,'Nur Treffer / Weiter'],[true,'Darts mitzählen']],c.trackDarts):''}`;
    case 'target':return rule('Eine Aufnahme mit drei wechselnden Zielvorgaben. Markiere nach dem Werfen die getroffenen Ziele, dann bestätige die Aufnahme. Singles gelten nur im Single-Feld.');
    case 'quick':return rule('Wechselnde Restpunktzahlen; pro Ziel maximal drei Darts, Double-out. Gib an, ob du ausgecheckt hast, und bei Erfolg die Dartzahl.');
    case 'extended':return `${rule('Wechselnde Restpunktzahlen mit begrenzten Aufnahmen. Double-out und normale Bust-Regeln.')}
      ${configChoice('Erfassung','entry',[['simple','Selbst rechnen'],['quick','Punkte pro Aufnahme']],c.entry)}
      ${configChoice('Aufnahmen pro Ziel','maxVisits',[[2,'2'],[3,'3'],[4,'4']],c.maxVisits)}`;
    case 'down':return `${rule('Starte bei 170, spiele Double-out bis null. Nach einem Checkout beginnst du das nächste Leg selbst.')}
      ${configChoice('Eingabe','entry',[['quick','Punkte pro Aufnahme'],['dart','Einzelne Darts']],c.entry)}`;
    case 'cricket':return `${rule('Schließe sechs Zahlensegmente mit jeweils drei Marks. Bull zählt auf Wunsch als siebtes Ziel. Fehlwürfe musst du nicht erfassen.')}
      ${configChoice('Zahlenbereich','range',[['all','Zufällig 1–20'],['classic','Klassisch 15–20']],c.range)}
      ${configChoice('Zielwahl','order',[['free','Freie Reihenfolge'],['fixed','Vorgegeben']],c.order)}
      <label class="setup-choice"><input type="checkbox" data-change="config-bull" ${c.bull?'checked':''}>Bull als zusätzliches Ziel</label>`;
    default:return '';
  }
}
function prepareData(ex) {
  const {type,mode,goal}=ex.block,c=ex.config;
  switch(type){
    case 'warmup':return {complete:false};
    case 'scoring':return {scores:[],triples:[],goal:Number(c.goal)};
    case 'doubles':return {targets:c.variant==='chain'?[20,10,5,16,8]:shuffled([20,16,8,10,12,18,4,2,6,5,14,19]),index:0,results:[]};
    case 'around': {
      const targets=c.direction==='asc'?[...ATC_ASC]:[...ATC_DESC];
      return {targets:mode==='time'?targets.slice(0,8):targets,index:0,results:[],darts:0,accurate:!!c.trackDarts};
    }
    case 'target':return {seq:shuffled(TARGET_SEQUENCES.map(a=>[...a])),index:0,selected:[false,false,false],results:[]};
    case 'quick':return {targets:shuffled(CHECKOUT_TARGETS),index:0,results:[],awaitDarts:false};
    case 'extended':{const targets=shuffled(CHECKOUT_TARGETS);return {targets,index:0,results:[],leg:createLeg(targets[0]),awaitSuccess:false};}
    case 'down':return {leg:createLeg(),legs:[]};
    case 'cricket':{const targets=cricketTargets(c.range,c.bull,c.order==='fixed');return {targets,marks:Object.fromEntries(targets.map(t=>[t,0])),index:0};}
    default:return {};
  }
}
function nextFromList(d,type) {
  if(type==='doubles')return d.targets[d.index%d.targets.length];
  if(type==='target')return d.seq[d.index%d.seq.length];
  if(type==='quick'||type==='extended')return d.targets[d.index%d.targets.length];
  return null;
}
function beginExercise(){
  const ex=state.ex;
  if(!ex||ex.started)return;
  ex.data=prepareData(ex);ex.started=true;ex.expired=false;ex.undo=[];state.scoreDraft='';
  if(ex.block.mode==='time') resumeTimer(ex);
  render();
}
function resumeTimer(ex){ex.timer.lastAt=Date.now();ex.timer.running=true;}
function stopTimer(ex){if(ex.timer.running){ex.timer.remainingMs=Math.max(0,ex.timer.remainingMs-(Date.now()-ex.timer.lastAt));ex.timer.running=false;}}
function tick(){
  const ex=state.ex;
  if(state.screen!=='exercise'||!ex?.started||!ex.timer.running)return;
  const remaining=Math.max(0,ex.timer.remainingMs-(Date.now()-ex.timer.lastAt));
  const clock=app.querySelector('#live-timer');
  if(clock)clock.textContent=clockText(remaining);
  const progress=app.querySelector('#live-progress');
  if(progress)progress.style.width=`${100*remaining/(ex.block.minutes*60000)}%`;
  if(remaining<=0){stopTimer(ex);ex.expired=true;render();notify('Zeit abgelaufen – du entscheidest, wann es weitergeht.');}
}
setInterval(tick,250);
function clockText(ms){const seconds=Math.ceil(Math.max(0,ms)/1000);return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
function timerView(ex){
  if(ex.block.mode!=='time')return '';
  const remaining=ex.timer.running?Math.max(0,ex.timer.remainingMs-(Date.now()-ex.timer.lastAt)):ex.timer.remainingMs;
  return panel(`<div class="spread"><div><span class="micro">TRAININGSZEIT</span><div id="live-timer" class="timer ${ex.expired?'expired':''}">${clockText(remaining)}</div></div>
    ${ex.expired?`<span class="eyebrow">ZEIT ABGELAUFEN</span>`:btn(ex.timer.running?'Ⅱ Pause':'▶ Fortsetzen','pause','btn small outline')}</div>
    <div class="progress"><span id="live-progress" style="width:${100*remaining/(ex.block.minutes*60000)}%"></span></div>
    ${ex.expired?`<div class="alert">Du kannst jetzt aufhören oder die aktuelle Aufnahme bzw. Aufgabe noch zu Ende spielen. Es erfolgt kein automatischer Wechsel.</div>`:''}
    ${ex.timer.running?'':ex.expired?'':rule('Timer pausiert. Bereits erfasste Treffer und Punkte bleiben erhalten.')}`);
}
function wrapControls(ex,content){
  return `<div class="section">${exerciseHeader(ex)}${ex.started?timerView(ex):''}${content}</div>`;
}
function prestartView(ex) {
  const label=ex.block.mode==='time'?`Timer: ${ex.block.minutes} Minuten`:ex.block.mode==='tasks'?'Aufgabenbasiert · normaler Umfang':'Einzelübung · jederzeit beendbar';
  return wrapControls(ex,`${panel(`<span class="eyebrow">${escape(label)}</span>${prestartConfig(ex)}`)}
    <div class="pinned-actions">${btn('Übung starten →','start-exercise','btn primary big block')}${state.session?btn('Diese Übung überspringen','skip-exercise','btn quiet block'):''}</div>`);
}
function summaryMini(ex){
  if(ex.block.type==='down'){
    const d=ex.data;
    return `<div class="stats">${floatStat('Ø abgeschlossene Legs',completedAverage(d.legs))}${stat('Legs abgeschlossen',d.legs.length)}</div>`;
  }
  return '';
}
function nextActionLabel(){return state.session?'Übung abschließen & weiter →':'Übung beenden & Ergebnis ansehen →';}
function activeFooter(ex){return `${summaryMini(ex)}<div class="row-actions">${ex.undo?.length?btn('↶ Rückgängig','undo','btn outline small'):ex.block.type==='down'&&ex.data?.leg?.history?.length?btn('↶ Rückgängig','undo','btn outline small'):''}${btn('Übung beenden','end-exercise','btn outline small')}</div>`;}
function renderScorepad(){
  return `${panel(`<span class="subheading">Punkte pro Aufnahme</span><div class="score-input" aria-label="Aktuelle Punkteingabe">${escape(state.scoreDraft)}</div>
    <div class="grid5">${QUICK_SCORES.map(n=>btn(n,'quick-score','btn small',`data-value="${n}"`)).join('')}</div>
    <div class="keypad">${['1','2','3','4','5','6','7','8','9','⌫','0','C'].map(n=>btn(n,'keypad','btn',`data-value="${escape(n)}" aria-label="${n==='⌫'?'Letzte Ziffer löschen':n==='C'?'Eingabe löschen':n}"`)).join('')}</div>
    ${btn('Punkte bestätigen','submit-score','btn primary block',`${state.scoreDraft===''?'disabled':''}`)}
    <div class="grid2">${btn('✓ Checkout','open-checkout-dialog','btn outline')}${btn('× Bust','open-bust-dialog','btn danger')}</div>`)}
   <div class="strip">Schnellwerte zählen sofort. Bei Checkout und Bust den abschließenden Dart angeben. 0 Punkte = drei geworfene Darts ohne Score.</div>`;
}
function renderDartpad(){
  const leg=state.ex.data.leg;
  const d=state.dartTab;
  return `${panel(`<div class="spread"><h3>Einzel-Dart-Eingabe</h3><span class="micro">Dart ${leg.visitDarts+1} von 3</span></div>
    <div class="throw-tabs">${[['S','Single'],['D','Double'],['T','Triple'],['X','Bull / 0']].map(([v,name])=>chip(name,'dart-tab',v,d===v)).join('')}</div>
    ${d==='X'?`<div class="grid3">${btn('Miss (0)','submit-dart','btn',`data-value="MISS"`)}${btn('25','submit-dart','btn',`data-value="S25"`)}${btn('Bull (50)','submit-dart','btn',`data-value="BULL"`)}</div>`:
    `<div class="throw-grid">${Array.from({length:20},(_,i)=>btn(`${d}${i+1}`,'submit-dart','btn',`data-value="${d}${i+1}"`)).join('')}</div>`}`)}
    <div class="strip">Ein Bust oder ein gültiger Checkout wird sofort erkannt. Bei einem Miss bitte „Bull / 0“ öffnen.</div>`;
}
function renderRoutes(rest,darts=3){
  return panel(`<div class="spread"><span class="subheading">Möglicher Checkout</span><span class="micro">${darts} ${darts===1?'Dart':'Darts'} verfügbar</span></div>${checkoutMarkup(rest,darts)}`);
}
function renderLeg(ex,extended=false){
  const d=ex.data,leg=d.leg;
  const finished=leg.complete || (extended && leg.visits>=ex.config.maxVisits);
  if(finished) {
    return panel(`<span class="eyebrow">${leg.complete?'CHECKOUT GELUNGEN':'AUFNAHMELIMIT ERREICHT'}</span><div class="complete-icon">${leg.complete?'◎':'○'}</div>
      <h2>${leg.complete?'Leg abgeschlossen':'Checkout nicht geschafft'}</h2>
      <div class="stats">${stat('Darts',leg.darts)}${stat('Aufnahmen',leg.visits)}${floatStat('Average',legAverage(leg))}${stat('Rest',leg.rest)}</div>
      ${!extended?`${summaryMini(ex)}${btn('Nächstes Leg bei 170 →','new-leg','btn primary block')}`:
      `${btn('Nächste Restpunktzahl →','next-extended','btn primary block')}`}
      <div class="row-actions">${leg.history.length?btn('↶ Letzte Eingabe korrigieren','undo-leg','btn outline small'):''}${btn('Training beenden','end-exercise','btn outline small')}</div>`);
  }
  const remaining=extended?ex.config.maxVisits-leg.visits:0;
  const available=ex.config.entry==='dart'?3-leg.visitDarts:3;
  return `${panel(`<div class="spread"><span class="eyebrow">${extended?'EXTENDED CHECKOUTS':'170 DOWN'}</span><span class="micro">${extended?`${remaining} ${remaining===1?'Aufnahme':'Aufnahmen'} frei`:`Leg ${d.legs.length+1}`}</span></div>
    <div class="scoreboard"><span class="micro">VERBLEIBENDE PUNKTE</span><div class="number">${leg.rest}</div><span class="small">${extended?`Startwert ${leg.start}`:`Leg-Average ${formatAverage(legAverage(leg))}`}</span></div>`)}
    ${renderRoutes(leg.rest,available)}
    ${ex.config.entry==='dart'?renderDartpad():renderScorepad()}
    <div class="row-actions">${leg.history.length?btn('↶ Rückgängig','undo-leg','btn outline small'):ex.undo.length?btn('↶ Vorherige Eingabe','undo','btn outline small'):''}${btn('Übung beenden','end-exercise','btn outline small')}</div>`;
}
function simpleCheckoutSuccessOptions(maxDarts=3,action='checkout-success'){
  return `<div class="field"><span class="subheading">Checkout geschafft – mit wie vielen Darts?</span><div class="grid3">${Array.from({length:maxDarts},(_,i)=>btn(`${i+1} ${i===0?'Dart':'Darts'}`,action,'btn outline',`data-value="${i+1}"`)).join('')}</div></div>`;
}
function exerciseGoalReached(ex) {
  if(ex.block.mode==='time'||ex.block.mode==='single')return false;
  const d=ex.data,n=ex.block.goal,type=ex.block.type;
  if(type==='warmup')return d.complete;
  if(type==='scoring')return d.scores.length>=n;
  if(type==='doubles'||type==='target'||type==='quick'||type==='extended')return d.results.length>=n;
  if(type==='around')return d.index>=d.targets.length;
  if(type==='down')return d.legs.length>=n;
  if(type==='cricket')return Object.values(d.marks).every(v=>v>=3);
  return false;
}
function genericCompletion(ex) {
  if(exerciseGoalReached(ex))return panel(`<div class="alert good"><strong>Aufgabe erfüllt.</strong><br>Du kannst dir das Ergebnis ansehen und zur nächsten Übung wechseln.</div>${btn(nextActionLabel(),'end-exercise','btn primary block')}`);
  if(ex.block.type==='cricket'&&Object.values(ex.data.marks).every(v=>v>=3))return panel(`<div class="alert good">Alle Ziele geschlossen! ${state.session?'Weiter zur nächsten Übung.':'Durchgang abgeschlossen.'}</div>${btn(nextActionLabel(),'end-exercise','btn primary block')}`);
  return '';
}
function warmupView(ex){
  return `${panel(`<div class="scoreboard"><span class="eyebrow">LOCKER REINKOMMEN</span><h2>Einwerfen</h2><p>Wirf auf verschiedene Felder, finde deinen Rhythmus und starte ohne Ergebnisdruck.</p></div>
    ${ex.block.mode==='tasks'?`<p>Vorgabe: ${ex.block.goal} lockere Aufnahmen.</p>${btn('Warm-up abgeschlossen','warmup-done','btn primary block')}`:''}`)}${genericCompletion(ex)}${activeFooter(ex)}`;
}
function scoringView(ex){
  const d=ex.data,c=ex.config,visits=d.scores.length,points=d.scores.reduce((a,b)=>a+b,0);
  return `${panel(`<span class="eyebrow">${c.variant==='high'?'HIGH SCORING':'SEGMENT SCORING'}</span>
    <div class="scoreboard"><span class="micro">ZIELSEGMENT</span><div class="number medium">${d.goal}</div><span class="small">${c.variant==='high'?'Alle regulären Punkte zählen.':'Nur Punkte aus dem Zielsegment zählen.'}</span></div>
    <div class="stats">${stat('Aufnahmen',visits)}${floatStat(c.variant==='high'?'3-Dart-Average':'Ø Segmentpunkte / 3 Darts',visits?points/visits:0)}
      ${c.extended?stat(`T${d.goal}-Treffer`,`${d.triples.reduce((a,b)=>a+b,0)} / ${visits*3}`):''}</div>`)}
    ${panel(`<span class="subheading">Aufnahme ${visits+1}${ex.block.mode==='tasks'?` / ${ex.block.goal}`:''}</span>
      <div class="field"><label for="scoring-points">${c.variant==='high'?'Erzielte Punkte (0–180)':'Gewertete Segmentpunkte (0–180)'}</label><input id="scoring-points" data-input="scoring-points" type="number" min="0" max="180" inputmode="numeric" autocomplete="off" placeholder="Punkte" value="${escape(ex.tempScore||'')}"></div>
      ${c.extended?`<div class="field"><span class="subheading">Treffer im T${d.goal}</span><div class="grid4">${[0,1,2,3].map(n=>chip(n,'scoring-triples',n,ex.tempTriples===n)).join('')}</div></div>`:''}
      ${btn('Aufnahme übernehmen →','record-scoring','btn primary block')}`)}
    ${genericCompletion(ex)}${activeFooter(ex)}`;
}
function doublesView(ex){
  const d=ex.data,c=ex.config,current=nextFromList(d,'doubles');
  if(c.variant==='chain' && d.index>=d.targets.length)return `${panel(`<div class="alert good">Alle Doppel der Sequenz geschafft.</div>${btn(nextActionLabel(),'end-exercise','btn primary block')}`)}${activeFooter(ex)}`;
  const hitTotal=d.results.reduce((a,b)=>a+b.hits,0);
  return `${panel(`<span class="eyebrow">${c.variant==='chain'?'DOPPEL-SEQUENZ':'WECHSELNDE DOPPEL'}</span>
    <div class="scoreboard"><span class="micro">AKTUELLES ZIEL</span><div class="number medium">D${current}</div><span class="small">3 Darts auf dieses Doppel · danach Trefferzahl eingeben.</span></div>
    <div class="stats">${stat('Treffer',`${hitTotal} / ${d.results.length*3}`)}${stat('Erfasste Aufnahmen',d.results.length)}</div>`)}
    ${panel(`<span class="subheading">Wie viele Treffer auf D${current}?</span><div class="grid4">${[0,1,2,3].map(n=>btn(n,'record-doubles','btn big',`data-value="${n}"`)).join('')}</div>
      ${c.variant==='chain'?rule('Bei mindestens einem Treffer folgt das nächste Doppel. Sonst versuchst du dieses Doppel erneut.'):'Die nächste Aufnahme erhält ein neues Doppelfeld.'}`)}
    ${genericCompletion(ex)}${activeFooter(ex)}`;
}
function aroundView(ex){
  const d=ex.data,c=ex.config;
  if(d.index>=d.targets.length)return `${panel(`<div class="alert good">Around the Clock abgeschlossen.</div>${btn(nextActionLabel(),'end-exercise','btn primary block')}`)}${activeFooter(ex)}`;
  const target=d.targets[d.index],hits=d.results.reduce((a,b)=>a+b.hits,0);
  return `${panel(`<div class="spread"><span class="eyebrow">${c.aroundType==='accuracy'?'ACCURACY':'KLASSISCH'}</span><span class="micro">Ziel ${d.index+1} / ${d.targets.length}</span></div>
    <div class="scoreboard"><span class="micro">AKTUELLES ZIEL</span><div class="number medium">${escape(target)}</div><span class="small">${c.aroundType==='accuracy'?'Genau 3 Darts, danach auch bei 0 Treffern weiter.':'Nach einem Treffer zum nächsten Ziel wechseln.'}</span></div>
    <div class="stats">${stat('Ziele erledigt',d.index)}${c.aroundType==='accuracy'?stat('Treffer',`${hits} / ${d.index*3}`):d.accurate?stat('Darts gezählt',d.darts):stat('Modus','Nur Treffer')}</div>`)}
    ${panel(c.aroundType==='accuracy'?`<span class="subheading">Wie viele Darts haben ${escape(target)} getroffen?</span><div class="grid4">${[0,1,2,3].map(n=>btn(n,'record-around','btn big',`data-value="${n}"`)).join('')}</div>`:
    `<span class="subheading">Klassischer Durchlauf</span>${btn('Treffer – nächstes Ziel →','around-hit','btn primary block')}${d.accurate?btn('Fehlwurf (+1 Dart)','around-miss','btn outline block'):''}
       <p class="micro">${d.accurate?'Jeden Fehlwurf erfassen, damit die Dartzahl stimmt.':'Nur Treffer bestätigen. Deshalb wird keine exakte Dartzahl ausgewiesen.'}</p>`)}
    ${genericCompletion(ex)}${activeFooter(ex)}`;
}
function targetView(ex){
  const d=ex.data,seq=nextFromList(d,'target');
  const total=d.results.reduce((a,r)=>a+r.hits.filter(Boolean).length,0);
  return `${panel(`<span class="eyebrow">DREI DARTS · DREI ZIELE</span><div class="grid3">${seq.map((t,i)=>`<div class="target-card"><span class="micro">DART ${i+1}</span><strong>${escape(t==='BULL'?'Bull':t)}</strong></div>`).join('')}</div>
    <div class="stats">${stat('Treffer',`${total} / ${d.results.length*3}`)}${stat('Aufnahmen',d.results.length)}</div>`)}
    ${panel(`<span class="subheading">Welche Ziele hast du getroffen?</span><div class="grid3">${seq.map((t,i)=>btn(`${escape(t==='BULL'?'Bull':t)} ${d.selected[i]?'✓':''}`,'toggle-target',`btn ${d.selected[i]?'selected':'outline'}`,`data-value="${i}" aria-pressed="${d.selected[i]}"`)).join('')}</div>
       ${btn('Aufnahme übernehmen →','record-target','btn primary block')}<p class="micro">Nicht markierte Vorgaben zählen als verfehlt. Bull: äußerer oder innerer Bull-Bereich.</p>`)}
    ${genericCompletion(ex)}${activeFooter(ex)}`;
}
function quickView(ex){
  const d=ex.data,current=nextFromList(d,'quick'),success=d.results.filter(r=>r.success).length;
  return `${panel(`<span class="eyebrow">QUICK CHECKOUTS</span><div class="scoreboard"><span class="micro">RESTPUNKTZAHL</span><div class="number medium">${current}</div><span class="small">Maximal drei Darts · Double-out</span></div>
    ${checkoutMarkup(current)}<div class="stats">${stat('Geschafft',success)}${stat('Versuche',d.results.length)}</div>`)}
    ${panel(d.awaitDarts?`${simpleCheckoutSuccessOptions(3,'quick-success')}${btn('Zurück','quick-cancel-success','btn quiet block')}`:
     `<h3>Checkout geschafft?</h3><div class="grid2">${btn('✓ Ja','quick-open-success','btn primary big')}${btn('× Nein','quick-fail','btn outline big')}</div>`)}
    ${genericCompletion(ex)}${activeFooter(ex)}`;
}
function extendedView(ex){
  const d=ex.data,c=ex.config,current=d.leg.start;
  if(c.entry==='quick')return renderLeg(ex,true);
  if(d.awaitSuccess)return `${panel(`<span class="eyebrow">CHECKOUT GESCHAFFT</span><div class="scoreboard"><span class="micro">STARTWERT</span><div class="number medium">${current}</div></div>${simpleCheckoutSuccessOptions(c.maxVisits*3,'extended-success-darts')}${btn('Zurück','extended-cancel-success','btn quiet block')}`)}${activeFooter(ex)}`;
  const success=d.results.filter(r=>r.success).length;
  return `${panel(`<span class="eyebrow">EXTENDED CHECKOUTS · SELBST RECHNEN</span><div class="scoreboard"><span class="micro">STARTWERT</span><div class="number medium">${current}</div><span class="small">Maximal ${c.maxVisits} Aufnahmen · Double-out</span></div>
    <div class="stats">${stat('Erfolgreich',success)}${stat('Aufgaben beendet',d.results.length)}</div>`)}
    ${panel(`<h3>Checkout geschafft?</h3><div class="grid2">${btn('✓ Ja','extended-open-success','btn primary big')}${btn('× Nein','extended-simple-fail','btn outline big')}</div><p class="micro">Rechne die Restpunkte selbst. Bei einem Bust endet nur die betreffende Aufnahme.</p>`)}
    ${genericCompletion(ex)}${activeFooter(ex)}`;
}
function cricketView(ex){
  const d=ex.data,c=ex.config,done=Object.values(d.marks).filter(v=>v>=3).length;
  const active = c.order==='fixed'?d.targets[d.index]:null;
  return `${panel(`<div class="spread"><span class="eyebrow">RANDOM CRICKET · ${c.order==='fixed'?'FESTE FOLGE':'FREIE ZIELWAHL'}</span><span class="micro">${done} / ${d.targets.length} geschlossen</span></div>
    <div class="stack">${d.targets.map(t=>`<div class="target-row ${d.marks[t]>=3?'is-done':''}"><strong>${escape(t)}</strong><div class="marks">${[0,1,2].map(i=>`<span class="mark ${d.marks[t]>i?'filled':''}"></span>`).join('')}</div>
       <span class="micro">${d.marks[t]}/3 ${d.marks[t]>=3?'✓':''}</span></div>`).join('')}</div>
    ${c.order==='fixed'?`<p class="hint">Aktuelles Ziel: <strong>${escape(active??'Alle geschlossen')}</strong></p>`:rule('Wähle eines der noch offenen Ziele. Es zählen nur Treffer auf ausgewählte Zahlen.')}`)}
    ${done===d.targets.length?'':panel(c.order==='fixed'?`<h3>${escape(active)} – Marks eintragen</h3><div class="grid3">${[1,2,3].filter(n=>active!=='Bull'||n<=2).map(n=>btn(`+${n}`,'cricket-mark','btn big',`data-target="${escape(active)}" data-value="${n}"`)).join('')}</div>`:
      `<span class="subheading">Treffer auf ein Ziel eintragen</span>${d.targets.filter(t=>d.marks[t]<3).map(t=>`<div class="spread"><strong>${escape(t)}</strong><div class="row-actions">${[1,2,3].filter(n=>t!=='Bull'||n<=2).map(n=>btn(`+${n}`,'cricket-mark','btn small',`data-target="${escape(t)}" data-value="${n}"`)).join('')}</div></div>`).join('')}`)}
    ${genericCompletion(ex)}${activeFooter(ex)}`;
}
function activeExerciseView(ex){
  const type=ex.block.type;
  const content={warmup:warmupView,scoring:scoringView,doubles:doublesView,around:aroundView,target:targetView,quick:quickView,extended:extendedView,down: e=>renderLeg(e),cricket:cricketView}[type](ex);
  return wrapControls(ex,content);
}
function exerciseView(){const ex=state.ex;return ex.started?activeExerciseView(ex):prestartView(ex);}
function resultFor(ex) {
  const d=ex.data,c=ex.config,t=ex.block.type;
  if(!d)return {label:LABELS[t],lines:['Nicht gestartet'],skipped:true};
  const lines=[];
  if(t==='warmup')lines.push('Einwerfen abgeschlossen');
  if(t==='scoring'){
    const points=d.scores.reduce((a,b)=>a+b,0),visits=d.scores.length;
    lines.push(`${visits} Aufnahmen · ${points} ${c.variant==='high'?'Punkte':'Segmentpunkte'}`);
    lines.push(`Ø ${formatAverage(visits?points/visits:0)} pro 3 Darts`);
    if(c.extended)lines.push(`T${d.goal}: ${d.triples.reduce((a,b)=>a+b,0)} von ${visits*3} Treffern`);
  }
  if(t==='doubles'){
    const hits=d.results.reduce((a,r)=>a+r.hits,0),darts=d.results.length*3;
    lines.push(`${hits}/${darts} Treffer · ${darts?(100*hits/darts).toFixed(1).replace('.',','):'0'} %`);
    const groups=new Map();
    for(const r of d.results){const x=groups.get(r.target)||{hits:0,darts:0};x.hits+=r.hits;x.darts+=3;groups.set(r.target,x);}
    if(groups.size)lines.push([...groups].map(([target,x])=>`D${target}: ${x.hits}/${x.darts}`).join(' · '));
  }
  if(t==='around'){
    lines.push(`${d.index}/${d.targets.length} Ziele erledigt`);
    if(c.aroundType==='accuracy'){
      lines.push(`${d.results.reduce((a,r)=>a+r.hits,0)}/${d.results.length*3} Treffer`);
      if(d.results.length)lines.push(d.results.map(r=>`${r.target}: ${r.hits}/3`).join(' · '));
    }else if(d.accurate)lines.push(`${d.darts} erfasste Darts`);
  }
  if(t==='target'){
    const hits=d.results.reduce((a,r)=>a+r.hits.filter(Boolean).length,0);
    lines.push(`${hits}/${d.results.length*3} Zielvorgaben getroffen`);
    const types=['S','D','T','B'];const typesOut=[];
    for(const prefix of types){let h=0,n=0;for(const r of d.results)r.targets.forEach((s,i)=>{if(s.startsWith(prefix)){n++;if(r.hits[i])h++;}});if(n)typesOut.push(`${prefix==='B'?'Bull':prefix}: ${h}/${n}`);}
    if(typesOut.length)lines.push(typesOut.join(' · '));
  }
  if(t==='quick'||t==='extended'){
    const successes=d.results.filter(r=>r.success),all=d.results.length;
    lines.push(`${successes.length}/${all} Checkouts erfolgreich`);
    if(successes.length)lines.push(`Erfolgreiche Ziele: ${successes.map(r=>`${r.start} (${r.darts} Darts)`).join(' · ')}`);
  }
  if(t==='down'){
    lines.push(`${d.legs.length} Legs abgeschlossen`);
    if(d.legs.length)lines.push(`3-Dart-Average ${formatAverage(completedAverage(d.legs))} · Darts/Leg: ${d.legs.map(l=>l.darts).join(', ')}`);
    if(!d.leg.complete && d.leg.darts)lines.push(`Laufendes Leg bei ${d.leg.rest} Rest nicht in den Leg-Average eingerechnet.`);
  }
  if(t==='cricket'){
    const closed=Object.values(d.marks).filter(m=>m===3).length;
    lines.push(`${closed}/${d.targets.length} Ziele geschlossen`);
    lines.push(d.targets.map(t=>`${t}: ${d.marks[t]}/3`).join(' · '));
  }
  return {label:LABELS[t],lines,skipped:false};
}
function resultView(){
  const session=state.session;
  const results=session?session.results:state.result?[state.result]:[];
  return `<div class="section">${title('TRAINING BEENDET','Nice darts.','Das Ergebnis ist nur während dieser aktuellen Nutzung verfügbar.')}
    ${results.map((r,i)=>panel(`<span class="eyebrow">${session?`BLOCK ${i+1}`:'ERGEBNIS'} ${r.skipped?'· ÜBERSPRUNGEN':''}</span><h2>${escape(r.label)}</h2>${r.lines.map(s=>`<p>${escape(s)}</p>`).join('')}`)).join('')}
    ${btn('Zur Startseite →','home','btn primary big block')}<p class="micro">Ein Neuladen löscht die Ergebnisse. Eine private Trainingshistorie folgt erst in einer späteren Version.</p></div>`;
}
function completeExercise(skipped=false){
  const ex=state.ex;if(!ex)return;
  stopTimer(ex);
  if(ex.block.type==='extended'&&ex.config.entry==='quick')recordExtendedIfFinished(ex);
  const result=skipped?{label:LABELS[ex.block.type],lines:['Übersprungen'],skipped:true}:resultFor(ex);
  ex.finished=true;
  if(state.session){
    state.session.results.push(result);state.session.index++;
    if(state.session.index<state.session.blocks.length){state.ex=newExercise({...state.session.blocks[state.session.index],mode:state.setup.mode});state.scoreDraft='';navigate('exercise');}
    else{state.ex=null;navigate('results');}
  }else{state.ex=null;state.result=result;navigate('results');}
}
function remember(ex){
  if(ex.block.type==='down')return;
  ex.undo.push(structuredClone(ex.data));
  if(ex.undo.length>35)ex.undo.shift();
}
function rewind(ex){
  if(ex.block.type==='down'){
    if(ex.data.leg.history.length){
      if(ex.data.leg.complete)ex.data.legs.pop();
      ex.data.leg=undoLeg(ex.data.leg);state.scoreDraft='';return true;
    }
    return false;
  }
  if(ex.block.type==='extended' && ex.config.entry==='quick' && ex.data.leg.history.length){
    ex.data.leg=undoLeg(ex.data.leg);state.scoreDraft='';return true;
  }
  if(!ex.undo.length)return false;
  ex.data=ex.undo.pop();state.scoreDraft='';return true;
}
function advanceCheckout(d,type){
  d.index++;
  const target=nextFromList(d,type);
  if(type==='extended'&&target!=null)d.leg=createLeg(target);
  if(type==='quick')d.awaitDarts=false;
  if(type==='extended')d.awaitSuccess=false;
}
function recordExtendedIfFinished(ex){
  const d=ex.data,l=d.leg;
  if(ex.config.entry!=='quick')return;
  if(l.complete||l.visits>=ex.config.maxVisits){
    if(!d.results.some(r=>r.index===d.index))d.results.push({index:d.index,start:l.start,success:l.complete,darts:l.darts,visits:l.visits});
  }
}
function afterCheckoutResult(ex,type,result){
  remember(ex);ex.data.results.push(result);advanceCheckout(ex.data,type);render();
}
function updateScore(action,val){
  if(action==='quick-score'){
    state.scoreDraft=String(val);submitLegScore();return;
  }
  if(val==='C')state.scoreDraft='';
  else if(val==='⌫')state.scoreDraft=state.scoreDraft.slice(0,-1);
  else if(/^\d$/.test(val)&&state.scoreDraft.length<3)state.scoreDraft=state.scoreDraft==='0'?val:state.scoreDraft+val;
  render();
}
function applyLegInput(input){
  const ex=state.ex;
  try{
    const before=ex.data.leg;
    const after=input.kind==='dart'?submitDart(before,input.code):submitVisit(before,input);
    ex.data.leg=after;
    if(ex.block.type==='down'&&after.complete&&!before.complete)ex.data.legs.push(after);
    state.scoreDraft='';render();
    if(after.complete)notify('Checkout! Starkes Leg.');
    else if(input.kind==='bust' || input.kind==='dart'&&after.visits>before.visits&&after.rest===before.visitStart)notify('Bust – Rest bleibt unverändert.');
  }catch(error){notify(error.message,true);}
}
function submitLegScore(){
  if(!/^\d{1,3}$/.test(state.scoreDraft)){notify('Bitte erst eine Punktzahl eingeben.',true);return;}
  applyLegInput({kind:'score',score:Number(state.scoreDraft)});
}
function scoreDialog(kind){
  const leg=state.ex?.data?.leg;
  if(!leg||leg.complete)return;
  const name=kind==='checkout'?'Checkout':'Bust';
  const content=`<div class="section">${title(name.toUpperCase(),`${name} – mit welchem Dart?`,'Wähle den Dart, der die Aufnahme beendet hat.')}
    ${panel(`<div class="scoreboard"><span class="micro">REST VOR DER AUFNAHME</span><div class="number medium">${leg.rest}</div></div>
      <div class="grid3">${[1,2,3].map(n=>btn(`Dart ${n}`,'resolve-special','btn big',`data-kind="${kind}" data-value="${n}"`)).join('')}</div>
      ${btn('Zurück zur Eingabe','close-dialog','btn outline block')}`)}</div>`;
  state.dialog={kind,content};render();
}
function render(){
  let html='';
  if(state.dialog){html=state.dialog.content;}
  else switch(state.screen){
    case 'home':html=homeView();break;
    case 'setup':html=setupView();break;
    case 'library':html=libraryView();break;
    case 'checkoutTool':html=checkoutToolView();break;
    case 'challenges':html=challengeListView();break;
    case 'challenge':html=challengeView();break;
    case 'exercise':html=exerciseView();break;
    case 'results':html=resultView();break;
    default:html=homeView();
  }
  app.innerHTML=html;
}
function challengeStart(id){
  const config=CHALLENGES.find(x=>x.id===id);
  if(!config)return;
  state.session=null;state.ex=null;
  state.challenge={config,started:false,attempts:0,success:false,failed:false,stage:0,darts:0,marks:{20:0,19:0,18:0},undo:[],awaitDarts:false};
  navigate('challenge');
}
function challengeView(){
  const ch=state.challenge,c=ch.config;
  if(!ch.started)return `<div class="section">${nav()}${title(c.category.toUpperCase(),c.name,c.rule)}${panel(`<span class="eyebrow">HARD MODE</span>${rule(c.limit?`Limit: ${c.limit} ${c.id==='cricketsprint'?'Darts':'Aufnahmen'}.`:'Kein festes Versuchslimit. Du kannst jederzeit aufhören.')}${btn('Herausforderung starten →','challenge-start','btn primary big block')}`)}</div>`;
  const done=ch.success||ch.failed;
  return `<div class="section">${nav()}${title(c.category.toUpperCase(),c.name,c.rule)}
    ${panel(`<div class="scoreboard"><span class="eyebrow">${done?ch.success?'GESCHAFFT!':'VERSUCHSLIMIT ERREICHT':'CHALLENGE LÄUFT'}</span>
      <div class="number medium">${c.id==='cricketsprint'?`${ch.darts}/9`:c.id==='ladder'?`${[40,32,24][Math.min(ch.stage,2)]}`:`${ch.attempts}${c.limit?`/${c.limit}`:''}`}</div>
      <span class="small">${c.id==='cricketsprint'?'Darts geworfen':c.id==='ladder'?'Aktuelle Restpunktzahl':'Versuche'}</span></div>
      ${done?`<div class="alert ${ch.success?'good':'error'}">${ch.success?'Herausforderung erfolgreich abgeschlossen.':'Diese Challenge ist diesmal nicht gelungen.'}</div>
        ${btn('Gleiche Challenge erneut spielen','challenge-restart','btn primary block')}${btn('Andere Herausforderung','open-challenges','btn outline block')}`:challengeControls(ch)}`)}
    ${!done?`<div class="row-actions">${ch.undo.length?btn('↶ Rückgängig','challenge-undo','btn outline small'):''}${btn('Challenge beenden','challenge-end','btn outline small')}</div>`:''}</div>`;
}
function challengeControls(ch){
  if(ch.config.id==='cricketsprint')return `<h3>Cricket Sprint</h3><div class="stack">${[20,19,18].map(n=>`<div class="spread"><strong>${n} · ${ch.marks[n]}/3 Marks</strong><div class="row-actions">${[1,2,3].map(v=>btn(`+${v}`,'sprint-mark','btn small',`data-target="${n}" data-value="${v}" ${ch.marks[n]>=3?'disabled':''}`)).join('')}</div></div>`).join('')}</div>
    ${btn('Fehlwurf (+1 Dart)','sprint-miss','btn outline block')}<p class="micro">Jeder Eintrag steht für einen Dart: +1 Single, +2 Double, +3 Triple. Fehlwürfe ebenfalls erfassen.</p>`;
  if(ch.config.id==='ladder')return `<h3>Aktuelles Checkout-Ziel: ${[40,32,24][ch.stage]}</h3><p>Maximal drei Darts. Bei Misserfolg beginnt die Leiter wieder bei 40.</p>
    ${ch.awaitDarts?`${simpleCheckoutSuccessOptions(3,'ladder-success')}${btn('Zurück','ladder-cancel','btn quiet block')}`:
    `<div class="grid2">${btn('✓ Geschafft','ladder-open','btn primary big')}${btn('× Fehlversuch','ladder-fail','btn outline big')}</div>`}`;
  return `<div class="grid2">${btn('✓ Geschafft','challenge-success','btn primary big')}${btn('× Nicht geschafft','challenge-fail','btn outline big')}</div>
    <p class="micro">Jeder Button gilt für einen vollständigen Versuch bzw. eine Aufnahme. Wenn du abbrichst, wird kein Erfolg behauptet.</p>`;
}
function rememberChallenge(){
  const ch=state.challenge;
  const {undo,...snapshot}=ch;
  ch.undo.push(structuredClone(snapshot));if(ch.undo.length>30)ch.undo.shift();
}
function restoreChallenge(){const ch=state.challenge;if(!ch.undo.length)return;state.challenge={...ch.undo.at(-1),undo:ch.undo.slice(0,-1)};}
function runAction(action,el){
  const val=el.dataset.value, ex=state.ex;
  if(state.dialog){
    if(action==='close-dialog'){state.dialog=null;render();return;}
    if(action==='resolve-special'){
      const kind=el.dataset.kind,dart=Number(val);
      state.dialog=null;applyLegInput({kind,dart});return;
    }
    return;
  }
  switch(action){
    case 'home':home();return;
    case 'open-setup':navigate('setup');return;
    case 'open-library':navigate('library');return;
    case 'open-checkout':navigate('checkoutTool');return;
    case 'open-challenges':if(!confirmLeave())return;state.ex=null;state.session=null;navigate('challenges');return;
    case 'focus':state.setup.focus=val;render();return;
    case 'session-mode':state.setup.mode=val;render();return;
    case 'minutes':state.setup.minutes=Number(val);render();return;
    case 'surprise': {
      state.setup={focus:'surprise',mode:'time',minutes:20,allowCricket:false};
      try{startSession(buildSession(state.setup));}catch(err){notify(err.message,true);}return;
    }
    case 'generate':try{startSession(buildSession(state.setup));}catch(err){notify(err.message,true);}return;
    case 'open-exercise':launchExercise(val);return;
    case 'random-challenge':challengeStart(choose(CHALLENGES).id);return;
    case 'open-challenge':challengeStart(val);return;
  }
  if(state.screen==='challenge'){
    const ch=state.challenge;
    switch(action){
      case 'challenge-start':ch.started=true;render();return;
      case 'challenge-undo':restoreChallenge();render();return;
      case 'challenge-restart':challengeStart(ch.config.id);state.challenge.started=true;render();return;
      case 'challenge-end':if(window.confirm('Herausforderung ohne Erfolg beenden?'))navigate('challenges');return;
      case 'challenge-success':if(ch.success||ch.failed)return;rememberChallenge();ch.attempts++;ch.success=true;render();return;
      case 'challenge-fail':if(ch.success||ch.failed)return;rememberChallenge();ch.attempts++;if(ch.config.limit&&ch.attempts>=ch.config.limit)ch.failed=true;render();return;
      case 'sprint-miss':case 'sprint-mark':{
        if(ch.success||ch.failed||ch.darts>=9)return;
        rememberChallenge();ch.darts++;
        if(action==='sprint-mark'){
          const target=Number(el.dataset.target);
          if(ch.marks[target]<3)ch.marks[target]=Math.min(3,ch.marks[target]+Number(val));
        }
        ch.success=Object.values(ch.marks).every(m=>m===3);
        if(!ch.success&&ch.darts===9)ch.failed=true;
        render();return;
      }
      case 'ladder-open':ch.awaitDarts=true;render();return;
      case 'ladder-cancel':ch.awaitDarts=false;render();return;
      case 'ladder-fail':rememberChallenge();ch.attempts++;ch.stage=0;ch.awaitDarts=false;render();return;
      case 'ladder-success':{
        const target=[40,32,24][ch.stage],darts=Number(val);
        if(!checkoutRoutes(target,darts,1).length){notify('Mit so wenigen Darts ist dieser Checkout nicht möglich.',true);return;}
        rememberChallenge();ch.stage++;ch.awaitDarts=false;
        if(ch.stage===3){ch.success=true;ch.attempts++;}
        render();return;
      }
    }
    return;
  }
  if(!ex||state.screen!=='exercise')return;
  if(action.startsWith('config-')&&!ex.started){
    const field=action.slice(7);
    ex.config[field]=['extended','trackDarts'].includes(field)?val==='true':['goal','maxVisits'].includes(field)?Number(val):val;
    render();return;
  }
  if(action==='start-exercise'){beginExercise();return;}
  if(action==='skip-exercise'){if(ex.started&&!window.confirm('Diese Übung überspringen? Die aktuelle Auswertung wird verworfen.'))return;completeExercise(true);return;}
  if(!ex.started)return;
  if(action==='pause'){if(ex.timer.running)stopTimer(ex);else resumeTimer(ex);render();return;}
  if(action==='end-exercise'){
    // Ein vorzeitiges Beenden ist absichtlich erlaubt. Unvollständige Legs bleiben aus dem Leg-Average heraus.
    completeExercise();return;
  }
  if(action==='undo'){if(rewind(ex))render();else notify('Noch keine Eingabe zum Rückgängigmachen.');return;}
  if(exerciseGoalReached(ex)&&ex.block.mode==='tasks'&& !['new-leg','next-extended','undo-leg','warmup-done'].includes(action)){
    if(action.startsWith('record-')||action==='cricket-mark'||action==='quick-fail'||action==='quick-success'){notify('Aufgabenziel bereits erreicht. Bitte zur nächsten Übung wechseln.');return;}
  }
  const d=ex.data,c=ex.config;
  switch(action){
    case 'warmup-done':remember(ex);d.complete=true;render();return;
    case 'scoring-triples':ex.tempTriples=Number(val);render();return;
    case 'record-scoring':{
      const input=app.querySelector('#scoring-points');const raw=(input?.value ?? ex.tempScore ?? '').trim();
      if(!/^\d{1,3}$/.test(raw)){notify('Bitte eine ganze Punktzahl von 0 bis 180 eingeben.',true);return;}
      const score=Number(raw),target=d.goal;
      if(score>180||(c.variant==='segment'&&(score>9*target||score%target!==0))){notify('Diese Punktzahl passt nicht zur gewählten Scoring-Variante.',true);return;}
      if(c.extended&&(ex.tempTriples==null||score<ex.tempTriples*target*3)){
        notify('Bitte Triple-Treffer wählen und Punktzahl prüfen.',true);return;
      }
      remember(ex);d.scores.push(score);if(c.extended)d.triples.push(ex.tempTriples);
      ex.tempTriples=null;ex.tempScore='';render();return;
    }
    case 'record-doubles':{
      const target=nextFromList(d,'doubles');remember(ex);
      d.results.push({target,hits:Number(val)});
      if(c.variant!=='chain'||Number(val)>0)d.index++;
      render();return;
    }
    case 'record-around':{
      if(d.index>=d.targets.length)return;
      remember(ex);d.results.push({target:d.targets[d.index],hits:Number(val)});d.index++;render();return;
    }
    case 'around-hit':{
      if(d.index>=d.targets.length)return;
      remember(ex);d.results.push({target:d.targets[d.index],hits:1});d.index++;if(d.accurate)d.darts++;render();return;
    }
    case 'around-miss':remember(ex);d.darts++;render();return;
    case 'toggle-target':d.selected[Number(val)]=!d.selected[Number(val)];render();return;
    case 'record-target':remember(ex);d.results.push({targets:[...nextFromList(d,'target')],hits:[...d.selected]});d.index++;d.selected=[false,false,false];render();return;
    case 'quick-open-success':d.awaitDarts=true;render();return;
    case 'quick-cancel-success':d.awaitDarts=false;render();return;
    case 'quick-fail':afterCheckoutResult(ex,'quick',{start:nextFromList(d,'quick'),success:false,darts:3});return;
    case 'quick-success':{
      const target=nextFromList(d,'quick'),darts=Number(val);
      if(!checkoutRoutes(target,darts,1).length){notify('Mit so wenigen Darts ist dieser Checkout nicht möglich.',true);return;}
      afterCheckoutResult(ex,'quick',{start:target,success:true,darts});return;
    }
    case 'extended-open-success':d.awaitSuccess=true;render();return;
    case 'extended-cancel-success':d.awaitSuccess=false;render();return;
    case 'extended-simple-fail':afterCheckoutResult(ex,'extended',{start:d.leg.start,success:false,darts:c.maxVisits*3});return;
    case 'extended-success-darts':{
      const darts=Number(val),start=d.leg.start;
      if(darts<=3&&!checkoutRoutes(start,darts,1).length){notify('Dieser Startwert ist nicht mit so wenigen Darts checkbar.',true);return;}
      afterCheckoutResult(ex,'extended',{start,success:true,darts,visits:Math.ceil(darts/3)});return;
    }
    case 'quick-score':updateScore(action,val);return;
    case 'keypad':updateScore(action,val);return;
    case 'submit-score':submitLegScore();return;
    case 'open-checkout-dialog':scoreDialog('checkout');return;
    case 'open-bust-dialog':scoreDialog('bust');return;
    case 'dart-tab':state.dartTab=val;render();return;
    case 'submit-dart':applyLegInput({kind:'dart',code:val});return;
    case 'undo-leg':if(rewind(ex))render();return;
    case 'new-leg':{
      if(!d.leg.complete)return;
      d.leg=createLeg(170);state.scoreDraft='';render();return;
    }
    case 'next-extended':{
      remember(ex);
      recordExtendedIfFinished(ex);
      if(!d.leg.complete&&d.leg.visits<c.maxVisits)return;
      advanceCheckout(d,'extended');state.scoreDraft='';render();return;
    }
    case 'cricket-mark':{
      const target=el.dataset.target;
      if(!(target in d.marks)||d.marks[target]>=3)return;
      if(c.order==='fixed'&&String(d.targets[d.index])!==target)return;
      const marks=Number(val);
      if(target==='Bull'&&marks===3)return;
      remember(ex);d.marks[target]=Math.min(3,d.marks[target]+marks);
      if(c.order==='fixed'&&d.marks[target]===3)d.index++;
      render();return;
    }
  }
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');
  if(!button||button.disabled)return;
  event.preventDefault();
  runAction(button.dataset.action,button);
});
document.addEventListener('change',event=>{
  const name=event.target.dataset.change;
  if(name==='cricket-allowed'){state.setup.allowCricket=event.target.checked;return;}
  if(name==='config-bull'&&state.ex&&!state.ex.started){state.ex.config.bull=event.target.checked;return;}
});
document.addEventListener('input',event=>{
  if(event.target.dataset.input==='scoring-points' && state.ex){state.ex.tempScore=event.target.value;return;}
  if(event.target.dataset.input==='checkout-rest'){
    state.checkoutValue=event.target.value;
    const output=app.querySelector('#checkout-output');
    if(output)output.innerHTML=checkoutMarkup(state.checkoutValue);
  }
});
render();
