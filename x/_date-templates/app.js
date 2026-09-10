(() => {
  "use strict";

  const screens = [...document.querySelectorAll(".screen")];
  const noButton = document.getElementById("noButton");
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
    ["Bist du sicher?","Ich frage nur zur Sicherheit.","small"],
    ["Wirklich nicht?","Okay, du testest die Website.","nudge"],
    ["Nope","Interessante Strategie.","small"],
    ["Nochmal überlegen","Ich geb dir noch eine Chance.","jump"],
    ["Immer noch nein","Konsequent bist du jedenfalls.","tilt"],
    ["Nicht überzeugt","Das System bleibt skeptisch.","nudge"],
    ["Bleibt bei nein","Die Datenlage wird ungewöhnlich.","small"],
    ["Nein.","Du bist erstaunlich engagiert für ein Nein.","jump"],
    ["Ich bleibe dabei","10 Versuche. Respekt.","wander"],
    ["Weiter nein","Achievement unlocked: hartnäckig.","nudge"],
    ["Noch immer","Wir können das noch eine Weile machen.","small"],
    ["Nein bleibt nein","Technisch funktioniert der Button.","wander"],
    ["Nicht heute","Ich bewundere fast die Ausdauer.","jump"],
    ["Nope","Und noch eine Runde …","nudge"],
  ];

  const loop = [
    ["Immer noch nein","Das wird langsam persönlich.","wander"],
    ["Nope","Nächste Runde.","small"],
    ["Nicht heute","Mutige Wortwahl.","jump"],
    ["Weiter nein","Ich hab Zeit.","tilt"],
    ["Nein","Der Ja-Button wäre effizienter.","nudge"]
  ];

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

  function nudge(){ moveIntoArena(.25 + Math.random()*.5, .10 + Math.random()*.45); }
  function jump(){ moveIntoArena(Math.random(), Math.random()); }

  function wander(){
    moveIntoArena(.5,.3);
    noButton.classList.add("wandering");
    const move = () => moveIntoArena(.1+Math.random()*.8, .05+Math.random()*.75);
    state.wanderTimer = setInterval(move,1550);
  }

  function applyEffect(effect){
    restoreHome();
    if(effect==="nudge") nudge();
    if(effect==="jump") jump();
    if(effect==="wander") wander();
    if(effect==="small") noButton.style.transform="scale(.82)";
    if(effect==="tilt") noButton.style.transform=`rotate(${Math.random()>.5?5:-5}deg)`;
  }

  function noStepForCount(count){
    if(count <= fixedSteps.length) return fixedSteps[count-1];
    return loop[(count-fixedSteps.length-1)%loop.length];
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
  }

  function resume(inv){
    state.noAttempts = inv.no_attempts || 0;
    state.activity = inv.activity || null;
    state.day = inv.day_preference || null;
    state.time = inv.time_preference || null;
    state.ride = inv.ride_preference || null;

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
    await sendEvent(eventMap[kind], value);

    if(kind==="activity") return showScreen("day");
    if(kind==="day") return showScreen("time");
    if(kind==="time"){
      if(state.activity==="Drinks"){
        state.ride="Entfällt";
        await sendEvent("complete");
        return finish(false);
      }
      return showScreen("ride");
    }
    if(kind==="ride"){
      await sendEvent("complete");
      return finish(false);
    }
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

    const firstName = state.invitation?.first_name || "";
    const fh=document.getElementById("finalHeading");
    if(fh) fh.textContent=firstName ? `Klingt nach einem Plan, ${firstName}.` : "Klingt nach einem Plan.";
    showScreen("done");
  }

  document.addEventListener("click",e=>{
    const b=e.target.closest("button");
    if(!b) return;
    if(b.dataset.action==="start") return showScreen("question");
    if(b.dataset.action==="yes") return yes().catch(showError);
    if(b.dataset.action==="no") return handleNo();
    if(b.dataset.action==="restart"){
      restoreHome();
      noButton.textContent = state.noAttempts ? noStepForCount(state.noAttempts)[0] : "Eher nicht";
      reaction.textContent = state.noAttempts ? noStepForCount(state.noAttempts)[1] : "";
      return showScreen("intro");
    }
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