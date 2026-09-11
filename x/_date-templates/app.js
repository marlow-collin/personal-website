(() => {
  "use strict";

  const screens = [...document.querySelectorAll(".screen")];
  const noButton = document.getElementById("noButton");
  const yesButton = document.querySelector('button[data-action="yes"]');
  const noHome = document.getElementById("noHome");
  const noArena = document.getElementById("noArena");
  const reaction = document.getElementById("reaction");

  const token = location.pathname.split("/").filter(Boolean).pop();
  const preview = new URLSearchParams(location.search).get("preview") === "1";

  const state = {
    noAttempts: 0,
    activity: null,
    day: null,
    time: null,
    ride: null,
    wanderTimer: null,
    invitation: null,
  };

  const fixedSteps = [
    ["Eher nicht","Das sah verdächtig nach einem Fehlklick aus.","nudge"],
    ["Bist du sicher?","Ich frage nur zur Sicherheit.","jump-small"],
    ["Wirklich nicht?","Okay, du testest die Website.","nudge"],
    ["Nope","Interessante Strategie.","wander"]
  ];

  const noLabels = [
    "Nochmal überlegen",
    "Immer noch nein",
    "Nicht überzeugt",
    "Bleibt bei nein",
    "Nein.",
    "Ich bleibe dabei",
    "Weiter nein",
    "Noch immer",
    "Nein bleibt nein",
    "Nicht heute",
    "Nope",
    "Eher nicht",
    "Wirklich nicht?"
  ];

  const noComments = [
    "Ich geb dir noch eine Chance.",
    "Konsequent bist du jedenfalls.",
    "Das System bleibt skeptisch.",
    "Die Datenlage wird ungewöhnlich.",
    "Du bist erstaunlich engagiert für ein Nein.",
    "Respekt für die Ausdauer.",
    "Achievement unlocked: hartnäckig.",
    "Wir können das noch eine Weile machen.",
    "Technisch funktioniert der Button.",
    "Ich bewundere fast die Ausdauer.",
    "Und noch eine Runde …",
    "Das wird langsam persönlich.",
    "Der Ja-Button wäre effizienter."
  ];

  const randomEffects = ["nudge","jump","jump-small","tilt-move","wander"];
  let lastRandomEffect = null;

  // Mindestens vier andere Werte müssen dazwischen liegen, bevor
  // ein Buttontext oder Kommentar erneut ausgewählt werden darf.
  const recentNoLabels = fixedSteps.map(x => x[0]).slice(-4);
  const recentNoComments = fixedSteps.map(x => x[1]).slice(-4);
  const RECENT_LIMIT = 4;

  function pickWithHistory(pool, recent){
    let choices = pool.filter(value => !recent.includes(value));

    // Der Pool ist groß genug; der Fallback verhindert nur einen theoretischen Leerzustand.
    if(!choices.length) choices = pool.filter(value => value !== recent[recent.length-1]);

    const picked = choices[Math.floor(Math.random()*choices.length)];
    recent.push(picked);
    if(recent.length > RECENT_LIMIT) recent.shift();
    return picked;
  }

  function pickDifferentEffect(){
    let choices = randomEffects.filter(x => x !== lastRandomEffect);

    // wander soll regelmäßig auftauchen, aber nicht permanent.
    if(state.noAttempts >= 6 && Math.random() < .28 && lastRandomEffect !== "wander"){
      lastRandomEffect = "wander";
      return "wander";
    }

    const picked = choices[Math.floor(Math.random()*choices.length)];
    lastRandomEffect = picked;
    return picked;
  }

  function randomNoStep(count){
    const label = pickWithHistory(noLabels, recentNoLabels);
    const comment = pickWithHistory(noComments, recentNoComments);
    return [label, comment, pickDifferentEffect()];
  }

  function showScreen(name){
    stopWander();
    screens.forEach(s => s.classList.toggle("active", s.dataset.screen === name));
  }

  function stopWander(){
    if(state.wanderTimer){
      clearInterval(state.wanderTimer);
      state.wanderTimer = null;
    }
  }

  function restoreHome(){
    stopWander();
    noButton.classList.remove("free","wandering");
    noButton.style.left = "";
    noButton.style.top = "";
    noButton.style.transform = "";
    noButton.style.pointerEvents = "auto";
    noButton.style.zIndex = "";
    if(noButton.parentElement !== noHome) noHome.appendChild(noButton);
  }

  function arenaRect(){ return noArena.getBoundingClientRect(); }
  function buttonSize(){
    const r = noButton.getBoundingClientRect();
    return {w: Math.max(r.width,112), h: Math.max(r.height,50)};
  }

  function moveIntoArena(xRatio,yRatio){
    stopWander();
    if(noButton.parentElement !== noArena) noArena.appendChild(noButton);
    noButton.classList.add("free");
    noButton.style.pointerEvents = "auto";
    noButton.style.zIndex = "50";
    const a = arenaRect(), b = buttonSize(), pad = 8;
    const maxX = Math.max(0, a.width-b.w-pad*2);
    const maxY = Math.max(0, a.height-b.h-pad*2);
    noButton.style.left = `${pad + maxX*Math.max(0,Math.min(1,xRatio))}px`;
    noButton.style.top = `${pad + maxY*Math.max(0,Math.min(1,yRatio))}px`;
  }

  function ensureInArena(){
    if(noButton.parentElement !== noArena) noArena.appendChild(noButton);
    noButton.classList.add("free");
    noButton.style.pointerEvents = "auto";
    noButton.style.zIndex = "50";
  }

  function moveIntoArena(xRatio,yRatio,scale=1,rotate=0){
    stopWander();
    ensureInArena();
    const a = arenaRect(), b = buttonSize(), pad = 8;
    const maxX = Math.max(0,a.width-b.w-pad*2);
    const maxY = Math.max(0,a.height-b.h-pad*2);
    noButton.style.left = `${pad + maxX*Math.max(0,Math.min(1,xRatio))}px`;
    noButton.style.top = `${pad + maxY*Math.max(0,Math.min(1,yRatio))}px`;
    noButton.style.transform = `scale(${scale}) rotate(${rotate}deg)`;
  }

  function nudge(){ moveIntoArena(.18+Math.random()*.64,.08+Math.random()*.62); }
  function jump(){ moveIntoArena(.06+Math.random()*.88,.04+Math.random()*.82); }
  function jumpSmall(){ moveIntoArena(.08+Math.random()*.84,.05+Math.random()*.78,.78); }
  function tiltMove(){ moveIntoArena(.10+Math.random()*.80,.05+Math.random()*.78,.90,Math.random()>.5?6:-6); }

  function wander(){
    stopWander();
    ensureInArena();
    noButton.classList.add("wandering");
    const move = () => {
      const a = arenaRect(), b = buttonSize(), pad = 8;
      const maxX = Math.max(0,a.width-b.w-pad*2);
      const maxY = Math.max(0,a.height-b.h-pad*2);
      noButton.style.left = `${pad + maxX*(.07+Math.random()*.86)}px`;
      noButton.style.top = `${pad + maxY*(.05+Math.random()*.78)}px`;
      noButton.style.transform = "scale(1)";
    };
    move();
    state.wanderTimer = setInterval(move,900);
  }

  function applyEffect(effect){
    stopWander();
    if(effect==="nudge") nudge();
    if(effect==="jump") jump();
    if(effect==="jump-small") jumpSmall();
    if(effect==="tilt-move") tiltMove();
    if(effect==="wander") wander();
  }

  function shouldPulseYes(count){
    if(count===3 || count===6 || count===10) return true;
    return count>10 && ((count-10)%3===0);
  }

  function updateYesProminence(count, pulse=false){
    if(!yesButton) return;

    const scale = Math.min(1.25, 1 + count*.04);

    // Nach Erreichen der Maximalgröße steigt die optische Hervorhebung weiter.
    const afterMax = Math.max(0, count-7);
    const emphasis = Math.min(1, afterMax / 5);
    const shadowStrength = Math.min(46, 12 + afterMax*5);

    yesButton.style.setProperty("--yes-scale", scale.toFixed(3));
    yesButton.style.setProperty("--yes-shadow", `${shadowStrength}px`);
    yesButton.style.setProperty("--yes-emphasis", emphasis.toFixed(3));

    if(pulse){
      yesButton.classList.remove("yes-pulse");
      void yesButton.offsetWidth;
      yesButton.classList.add("yes-pulse");
    }
  }

  function noStepForCount(count){
    if(count <= fixedSteps.length) return fixedSteps[count-1];
    return randomNoStep(count);
  }

  async function api(path="", options={}){
    const suffix = preview ? (path.includes("?") ? "&preview=1" : "?preview=1") : "";
    const response = await fetch(`/x/api/date/${encodeURIComponent(token)}${path}${suffix}`, {
      headers: {"Content-Type":"application/json", ...(options.headers||{})},
      ...options
    });
    if(!response.ok){
      const data = await response.json().catch(()=>({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return response.status === 204 ? null : response.json();
  }

  function sendEvent(type, value){
    if(preview) return Promise.resolve();
    return api("/event", {method:"POST", body:JSON.stringify({type,value})});
  }

  function applyPersonalization(inv){
    const firstName = inv.first_name || "";
    const introName = document.getElementById("introName");
    const questionName = document.getElementById("questionName");
    const greetingName = document.getElementById("introGreetingName");
    const greetingFallback = document.getElementById("introGreetingFallback");

    if(introName) introName.textContent = firstName || "dich";
    if(questionName) questionName.textContent = firstName || "";
    if(greetingName) greetingName.textContent = firstName ? firstName + " " : "";
    if(greetingFallback) greetingFallback.textContent = "👋";

    if(inv.personal_message){
      const introText = document.querySelector(".intro-copy p, .intro-sub");
      if(introText) introText.textContent = inv.personal_message;
    }
    const finalMessage = document.getElementById("finalMessage");
    if(finalMessage) finalMessage.textContent = inv.final_message || "Klingt nach einem ziemlich guten Plan ✨";
  }

  function resume(inv){
    state.noAttempts = inv.no_attempts || 0;
    state.activity = inv.activity || null;
    state.day = inv.day_preference || null;
    state.time = inv.time_preference || null;
    state.ride = inv.ride_preference || null;
    updateYesProminence(state.noAttempts, false);

    if(inv.status === "completed"){
      return finish(false);
    }
    if(inv.accepted_at){
      if(!state.activity) return showScreen("activity");
      if(!state.day) return showScreen("day");
      if(!state.time) return showScreen("time");
      if(state.activity !== "Drinks" && !state.ride) return showScreen("ride");
      return finish(false);
    }

    if(state.noAttempts > 0){
      const item = noStepForCount(state.noAttempts);
      noButton.textContent = item[0];
      reaction.textContent = item[1];
    }
    showScreen("intro");
  }

  async function handleNo(){
    state.noAttempts++;
    updateYesProminence(state.noAttempts, shouldPulseYes(state.noAttempts));
    const item = noStepForCount(state.noAttempts);
    const [label,comment,effect] = item;
    noButton.textContent = label;
    reaction.textContent = comment;
    applyEffect(effect);
    sendEvent("no").catch(()=>{});
  }

  async function yes(){
    restoreHome();
    await sendEvent("accept");
    showScreen("yes-transition");
    await new Promise(r=>setTimeout(r,850));
    showScreen("activity");
  }

  async function choose(kind,value){
    state[kind] = value;
    const eventMap = {activity:"activity",day:"day",time:"time",ride:"ride"};

    // Der letzte sichtbare Schritt soll nie auf den Mailversand warten.
    if(kind==="ride"){
      finish(false);
      sendEvent("ride", value)
        .then(()=>sendEvent("complete"))
        .catch(showError);
      return;
    }

    if(kind==="time" && state.activity==="Drinks"){
      state.ride="Entfällt";
      finish(false);
      sendEvent("time", value)
        .then(()=>sendEvent("complete"))
        .catch(showError);
      return;
    }

    await sendEvent(eventMap[kind], value);

    if(kind==="activity") return showScreen("day");
    if(kind==="day") return showScreen("time");
    if(kind==="time") return showScreen("ride");
  }

  function finish(sendComplete=false){
    const a=document.getElementById("sumActivity");
    const d=document.getElementById("sumDay");
    const t=document.getElementById("sumTime");
    if(a) a.textContent=state.activity || "–";
    if(d) d.textContent=state.day || "–";
    if(t) t.textContent=state.time || "–";

    const rr=document.getElementById("rideRow");
    if(rr){
      if(state.activity==="Drinks") rr.hidden=true;
      else{
        rr.hidden=false;
        const r=document.getElementById("sumRide");
        if(r) r.textContent=state.ride || "–";
      }
    }

    const fh=document.getElementById("finalHeading");
    if(fh) fh.textContent="Abgemacht.";
    showScreen("done");
  }

  document.addEventListener("click",e=>{
    const b=e.target.closest("button");
    if(!b) return;
    if(b.dataset.action==="start") return showScreen("question");
    if(b.dataset.action==="yes") return yes().catch(showError);
    if(b.dataset.action==="no") return handleNo();
    if(b.dataset.choice && b.dataset.value) return choose(b.dataset.choice,b.dataset.value).catch(showError);
  });

  function showError(err){
    console.error(err);
    reaction.textContent = "Da ist gerade etwas schiefgelaufen. Versuch es nochmal.";
  }

  window.addEventListener("resize",()=>{ if(noButton.parentElement===noArena) jump(); });

  api()
    .then(inv => {
      state.invitation = inv;
      applyPersonalization(inv);
      resume(inv);
    })
    .catch(err => {
      console.error(err);
      document.body.innerHTML = '<main style="font-family:system-ui;padding:32px;max-width:520px;margin:auto"><h1>Diese Einladung ist nicht verfügbar.</h1><p>Der Link ist möglicherweise ungültig.</p></main>';
    });
})();