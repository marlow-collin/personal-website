// Dart Assistant V1: reine, clientseitige Spiel- und Auswahlregeln.
export const TIME_OPTIONS = [15, 20, 25, 30];
export const QUICK_SCORES = [26, 45, 60, 100, 140];
export const FOCUS_LABELS = { allround: 'Allround', scoring: 'Scoring', doubles: 'Doppel', checkout: 'Checkouts', accuracy: 'Präzision', surprise: 'Überrasch mich' };
export const LABELS = {
  warmup: 'Warm-up', scoring: 'Scoring Practice', doubles: 'Doubles Practice', around: 'Around the Clock',
  target: 'Target Practice', quick: 'Quick Checkouts', extended: 'Extended Checkouts', down: '170 Down', cricket: 'Random Cricket'
};
export const CHALLENGES = [
  { id:'bigfish', name:'The Big Fish', category:'Checkout', rule:'170 mit maximal drei Darts auschecken: T20 → T20 → Bull.', limit:0 },
  { id:'maximum', name:'Maximum', category:'Scoring', rule:'180 in einer Aufnahme erzielen. Maximal zehn Aufnahmen.', limit:10 },
  { id:'demand', name:'Doubles on Demand', category:'Doppel', rule:'D20 → D16 → D8 mit drei aufeinanderfolgenden Darts treffen.', limit:0 },
  { id:'trouble', name:'Triple Trouble', category:'Präzision', rule:'T20 → T19 → T18 mit drei aufeinanderfolgenden Darts treffen.', limit:0 },
  { id:'bullhat', name:'Bullseye Hat Trick', category:'Bull', rule:'Drei Darts derselben Aufnahme müssen das innere Bullseye treffen.', limit:0 },
  { id:'shanghai', name:'Shanghai 20', category:'Kombination', rule:'S20, D20 und T20 innerhalb einer Aufnahme treffen, Reihenfolge beliebig.', limit:0 },
  { id:'cricketsprint', name:'Cricket Sprint', category:'Cricket', rule:'20, 19 und 18 jeweils mit drei Marks schließen – in maximal neun Darts.', limit:9 },
  { id:'ladder', name:'Checkout Ladder', category:'Checkout', rule:'40, 32 und 24 nacheinander mit jeweils maximal drei Darts auschecken. Bei Fehler zurück zu 40.', limit:0 }
];

export function randomInt(max) {
  if (!Number.isSafeInteger(max) || max < 1 || max > 0x100000000) throw Error('Ungültiger Zufallsbereich.');
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) throw Error('Sichere Zufallsauswahl ist in diesem Browser nicht verfügbar.');
  const bound = Math.floor(0x100000000 / max) * max;
  const data = new Uint32Array(1);
  do { cryptoApi.getRandomValues(data); } while (data[0] >= bound);
  return data[0] % max;
}
export function shuffled(array) {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function choose(array) { return array[randomInt(array.length)]; }

const THROW = [
  ...Array.from({length:20},(_,i)=>({code:`S${i+1}`,value:i+1,kind:'S'})),
  ...Array.from({length:20},(_,i)=>({code:`D${i+1}`,value:2*(i+1),kind:'D'})),
  ...Array.from({length:20},(_,i)=>({code:`T${i+1}`,value:3*(i+1),kind:'T'})),
  {code:'S25',value:25,kind:'S'}, {code:'BULL',value:50,kind:'D'}
];
const FINISH = THROW.filter(t=>t.kind==='D');
const routeCache = new Map();
const finishOrder = code => code==='D20'?0:code==='D16'?1:code==='D8'?2:code==='BULL'?3:4;
const prefixPenalty = t => t.kind==='T'? 0 : t.kind==='S'?2:t.code==='BULL'?18:14;
// Alle angezeigten Wege werden aus echten Board-Treffern mit gültigem Double-out erzeugt.
export function checkoutRoutes(rest, availableDarts=3, maxResults=4) {
  if (!Number.isInteger(rest) || !Number.isInteger(availableDarts) || rest<2 || rest>170 || availableDarts<1 || availableDarts>3) return [];
  const key = `${rest}:${availableDarts}`;
  if (!routeCache.has(key)) {
    const matches = [];
    const visit = (prefix, sum, depth, maxDepth) => {
      if (depth === maxDepth - 1) {
        const target = rest - sum;
        for (const fin of FINISH) if (fin.value === target) {
          const arr = [...prefix,fin];
          const penalty = arr.slice(0,-1).reduce((a,t)=>a+prefixPenalty(t),0);
          const first = arr[0]?.code;
          const setup = first==='T20'? -4 : first==='T19'? -3 : first==='T18'? -2 : 0;
          matches.push({codes:arr.map(t=>t.code), score: maxDepth*100 + finishOrder(fin.code)*8 + penalty + setup});
        }
        return;
      }
      for (const t of THROW) {
        const next = sum+t.value;
        if (next < rest-1) visit([...prefix,t], next,depth+1,maxDepth);
      }
    };
    for(let length=1;length<=availableDarts;length++) visit([],0,0,length);
    matches.sort((a,b)=>a.score-b.score || a.codes.join().localeCompare(b.codes.join()));
    const seenFinishes = new Set();
    const diverse = [];
    for (const r of matches) { const final = r.codes.at(-1); if(!seenFinishes.has(final)) {diverse.push(r.codes);seenFinishes.add(final);} if(diverse.length>=10)break; }
    if(diverse.length<10) for (const r of matches) { if(!diverse.includes(r.codes)) diverse.push(r.codes); if(diverse.length>=10)break; }
    routeCache.set(key, diverse);
  }
  return routeCache.get(key).slice(0,Math.max(0,Math.min(maxResults,10)));
}
export function dartThrow(code) {
  if(code==='MISS') return {code,value:0,kind:'miss'};
  return THROW.find(t=>t.code===code) || null;
}
export function createLeg(start=170) {
  if (!Number.isInteger(start)||start<2||start>170) throw Error('Ungültiger Leg-Start.');
  return {start,rest:start,points:0,darts:0,visits:0,visitStart:start,visitPoints:0,visitDarts:0,complete:false,history:[]};
}
function snapshot(leg) { const {history,...data}=leg; return {...data}; }
function updated(leg,props) { return {...leg,...props,history:[...leg.history,snapshot(leg)]}; }
export function undoLeg(leg) {
  if(!leg.history.length) return leg;
  return {...leg.history.at(-1),history:leg.history.slice(0,-1)};
}
export function submitVisit(leg, input) {
  if(leg.complete || leg.visitDarts!==0) throw Error('Aufnahme ist nicht bereit für die Gesamtpunkteingabe.');
  const {kind,score,dart}=input;
  if(kind==='score') {
    if(!Number.isInteger(score)||score<0||score>180) throw Error('Bitte 0 bis 180 Punkte eingeben.');
    if(leg.rest-score<2) throw Error('Checkout oder Bust bitte mit der entsprechenden Aktion erfassen.');
    return updated(leg,{rest:leg.rest-score,points:leg.points+score,darts:leg.darts+3,visits:leg.visits+1,visitStart:leg.rest-score});
  }
  if((kind==='checkout'||kind==='bust') && (!Number.isInteger(dart)||dart<1||dart>3)) throw Error('Bitte den abschließenden Dart auswählen.');
  if(kind==='checkout') {
    if(!checkoutRoutes(leg.rest,dart,1).length) throw Error('Dieser Rest ist mit so wenigen Darts nicht regelkonform checkbar.');
    return updated(leg,{rest:0,points:leg.points+leg.rest,darts:leg.darts+dart,visits:leg.visits+1,complete:true,visitStart:0});
  }
  if(kind==='bust') return updated(leg,{darts:leg.darts+dart,visits:leg.visits+1});
  throw Error('Ungültiger Spielzug.');
}
export function submitDart(leg, code) {
  if(leg.complete) throw Error('Das Leg ist bereits abgeschlossen.');
  const hit=dartThrow(code);
  if(!hit) throw Error('Bitte ein gültiges Dartfeld auswählen.');
  const total=leg.visitPoints+hit.value;
  const remaining=leg.visitStart-total;
  const nextDarts=leg.visitDarts+1;
  const isBust=remaining<0 || remaining===1 || (remaining===0 && hit.kind!=='D');
  if(isBust) return updated(leg,{rest:leg.visitStart,darts:leg.darts+1,visits:leg.visits+1,visitDarts:0,visitPoints:0});
  if(remaining===0) return updated(leg,{rest:0,points:leg.points+total,darts:leg.darts+1,visits:leg.visits+1,visitDarts:0,visitPoints:0,visitStart:0,complete:true});
  if(nextDarts===3) return updated(leg,{rest:remaining,points:leg.points+total,darts:leg.darts+1,visits:leg.visits+1,visitPoints:0,visitDarts:0,visitStart:remaining});
  return updated(leg,{rest:remaining,darts:leg.darts+1,visitDarts:nextDarts,visitPoints:total});
}
export function legAverage(leg) { return leg.darts ? 3*leg.points/leg.darts : 0; }
export function completedAverage(legs) {
  const completed=legs.filter(l=>l.complete);
  const darts=completed.reduce((a,l)=>a+l.darts,0);
  return darts ? 3*completed.reduce((a,l)=>a+l.points,0)/darts : 0;
}
export function formatAverage(v) { return v.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}); }

export const ATC_DESC = Array.from({length:20},(_,i)=>20-i).concat('Bull');
export const ATC_ASC = Array.from({length:20},(_,i)=>i+1).concat('Bull');
export const TARGET_SEQUENCES = [
  ['S20','D16','BULL'],['S19','T20','D8'],['S18','D20','S5'],['T19','S17','BULL'],
  ['D20','S16','T18'],['S15','S10','BULL'],['T20','S19','D16'],['S12','D8','T19'],
  ['S7','S18','D20'],['S20','S1','S5'],['D16','S20','BULL'],['T18','D8','S19']
];
export const CHECKOUT_TARGETS = [40,32,24,50,56,64,74,81,91,96,100,121];
export function cricketTargets(range='all',bull=false,ordered=false) {
  const numbers=range==='classic'?[15,16,17,18,19,20]:Array.from({length:20},(_,i)=>i+1);
  const out=shuffled(numbers).slice(0,6);
  return bull ? [...out,'Bull'] : out;
}
export function marksFor(code,target) {
  const hit=dartThrow(code);
  if(!hit) return 0;
  if(target==='Bull') return code==='S25'?1:code==='BULL'?2:0;
  return hit.code===`S${target}`?1:hit.code===`D${target}`?2:hit.code===`T${target}`?3:0;
}
export function buildSession({focus='allround',mode='time',minutes=20,allowCricket=false}={}) {
  if(!FOCUS_LABELS[focus] || !['time','tasks'].includes(mode) || (mode==='time'&&!TIME_OPTIONS.includes(minutes))) throw Error('Ungültige Trainingseinstellungen.');
  const resolved=focus==='surprise'?'allround':focus;
  const pools={
    allround:[['scoring'],['around','target'],['doubles','target'],['quick','extended','down']],
    scoring:[['scoring'],['target','scoring'],['scoring','around'],['quick','down']],
    doubles:[['doubles'],['doubles','target'],['quick','extended'],['down','extended']],
    checkout:[['doubles'],['quick'],['extended','quick'],['down','extended']],
    accuracy:[['around','target'],['target','scoring'],['doubles','around'],['quick','target']]
  };
  const picked=[];
  for (const pool of pools[resolved]) {
    const eligible=pool.filter(t=> !picked.includes(t));
    picked.push(choose(eligible.length?eligible:pool));
  }
  if(mode==='tasks' || allowCricket) {
    if(['allround','accuracy'].includes(resolved) && randomInt(3)===0) picked[1]='cricket';
  }
  const blocks=[{type:'warmup'} , ...picked.map(type=>({type}))];
  if(mode==='time') {
    const warmup=minutes<=15?2:3;
    const remaining=minutes-warmup;
    const weights=[0.24,0.24,0.24,0.28];
    const vals=weights.map(w=>Math.floor(remaining*w));
    let leftover=remaining-vals.reduce((a,b)=>a+b,0);
    for(let i=vals.length-1;leftover>0;i=(i+1)%vals.length,leftover--) vals[i]++;
    blocks.forEach((b,i)=>b.minutes=i===0?warmup:vals[i-1]);
  } else blocks.forEach((b,i)=>b.goal=i===0?3:b.type==='down'?2:b.type==='cricket'?1:b.type==='around'?1:b.type==='extended'?3:5);
  return blocks;
}
