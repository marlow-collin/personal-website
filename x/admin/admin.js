(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const createPanel = $("#createPanel");
  const form = $("#createForm");
  const list = $("#inviteList");
  const dialog = $("#inviteDialog");
  const toast = $("#toast");
  let current = null;
  let currentQr = null;

  async function api(path="", options={}){
    const response = await fetch(`/x/admin/api${path}`, {
      headers: {"Content-Type":"application/json", ...(options.headers||{})},
      ...options
    });
    if(!response.ok){
      const data = await response.json().catch(()=>({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return response.status === 204 ? null : response.json();
  }

  function showToast(text){
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(()=>toast.hidden=true,1800);
  }

  function esc(value=""){
    return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  }

  function statusLabel(s){
    return ({created:"Noch nicht geöffnet",opened:"Geöffnet",accepted:"Zugesagt",completed:"Abgeschlossen"}[s] || s);
  }

  function renderStats(rows){
    const counts = {all:rows.length, created:0, open:0, completed:0};
    rows.forEach(r=>{
      if(r.status==="created") counts.created++;
      if(r.status==="opened" || r.status==="accepted") counts.open++;
      if(r.status==="completed") counts.completed++;
    });
    $("#stats").innerHTML = `
      <div class="stat"><span>Gesamt</span><strong>${counts.all}</strong></div>
      <div class="stat"><span>Noch nicht geöffnet</span><strong>${counts.created}</strong></div>
      <div class="stat"><span>Offen</span><strong>${counts.open}</strong></div>
      <div class="stat"><span>Abgeschlossen</span><strong>${counts.completed}</strong></div>`;
  }

  function renderRows(rows){
    if(!rows.length){
      list.innerHTML = '<p class="muted">Noch keine Einladungen erstellt.</p>';
      return;
    }
    list.innerHTML = rows.map(r=>`
      <article class="invite-row">
        <div class="invite-person">
          <strong>${esc(r.first_name)}</strong>
          <span>${esc(r.internal_label || "Keine interne Notiz")}</span>
        </div>
        <div class="invite-meta">
          <span class="badge ${esc(r.status)}">${esc(statusLabel(r.status))}</span>
          <span class="badge">${r.no_attempts || 0}× Nein</span>
          <div style="margin-top:7px">${esc(r.theme === "dark-elegant" ? "Dark Elegant" : "Soft + Playful")}</div>
        </div>
        <button class="secondary small" data-open="${esc(r.token)}">Details</button>
      </article>
    `).join("");
  }

  async function load(){
    list.innerHTML = '<p class="muted">Lade Einladungen …</p>';
    const data = await api("/invitations");
    renderStats(data.invitations);
    renderRows(data.invitations);
  }

  function invitationUrl(inv){
    return `${location.origin}/x/date/${inv.token}`;
  }

  function makeQrSvg(text){
    const {size,modules} = LocalQRCode.matrix(text);
    const border = 4;
    const view = size + border*2;
    let path = "";
    for(let y=0;y<size;y++){
      for(let x=0;x<size;x++){
        if(modules[y][x]) path += `M${x+border},${y+border}h1v1h-1z`;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${view} ${view}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  }

  function renderQr(){
    if(!current) return;
    const url = invitationUrl(current);
    currentQr = makeQrSvg(url);
    $("#qrPreview").innerHTML = currentQr;
  }

  function downloadBlob(content, type, filename){
    const blob = new Blob([content], {type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function safeFileName(name){
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "einladung";
  }

  async function downloadPng(){
    if(!currentQr) renderQr();
    const svgBlob = new Blob([currentQr], {type:"image/svg+xml"});
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1200;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle="#fff"; ctx.fillRect(0,0,1200,1200);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img,0,0,1200,1200);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob=>{
        const a=document.createElement("a");
        const u=URL.createObjectURL(blob);
        a.href=u; a.download=`date-${safeFileName(current.first_name)}-qr.png`; a.click();
        setTimeout(()=>URL.revokeObjectURL(u),1000);
      },"image/png");
    };
    img.src = url;
  }

  async function openInvite(token){
    current = await api(`/invitations/${encodeURIComponent(token)}`);
    $("#dialogTitle").textContent = current.first_name;
    $("#inviteUrl").textContent = invitationUrl(current);
    $("#detailGrid").innerHTML = `
      <div><span>Status</span><strong>${esc(statusLabel(current.status))}</strong></div>
      <div><span>Design</span><strong>${esc(current.theme==="dark-elegant"?"Dark Elegant":"Soft + Playful")}</strong></div>
      <div><span>Interne Notiz</span><strong>${esc(current.internal_label || "–")}</strong></div>
      <div><span>Nein-Versuche</span><strong>${current.no_attempts || 0}</strong></div>
      <div><span>Aktivität</span><strong>${esc(current.activity || "–")}</strong></div>
      <div><span>Wann</span><strong>${esc(current.day_preference || "–")}</strong></div>
      <div><span>Zeit</span><strong>${esc(current.time_preference || "–")}</strong></div>
      <div><span>Fahrt</span><strong>${esc(current.ride_preference || "–")}</strong></div>
    `;
    $("#qrWrap").hidden = true;
    $("#toggleQr").textContent = "Anzeigen";
    currentQr = null;
    dialog.showModal();
  }

  $("#newInviteButton").addEventListener("click",()=>{ createPanel.hidden=false; form.querySelector("input").focus(); });
  $("#closeCreate").addEventListener("click",()=>createPanel.hidden=true);
  $("#cancelCreate").addEventListener("click",()=>createPanel.hidden=true);
  $("#refreshButton").addEventListener("click",()=>load().catch(e=>showToast(e.message)));
  $("#closeDialog").addEventListener("click",()=>dialog.close());

  form.addEventListener("submit", async e=>{
    e.preventDefault();
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    const button = form.querySelector('button[type="submit"]');
    button.disabled=true;
    try{
      const created = await api("/invitations",{method:"POST",body:JSON.stringify(body)});
      form.reset();
      form.querySelector('input[name="theme"][value="soft-playful"]').checked=true;
      createPanel.hidden=true;
      await load();
      await openInvite(created.token);
      showToast("Einladung erstellt");
    }catch(err){ showToast(err.message); }
    finally{ button.disabled=false; }
  });

  list.addEventListener("click",e=>{
    const b=e.target.closest("[data-open]");
    if(b) openInvite(b.dataset.open).catch(err=>showToast(err.message));
  });

  $("#copyLink").addEventListener("click",async()=>{
    await navigator.clipboard.writeText(invitationUrl(current));
    showToast("Link kopiert");
  });

  $("#previewLink").addEventListener("click",()=>{
    window.open(invitationUrl(current)+"?preview=1","_blank","noopener");
  });

  $("#toggleQr").addEventListener("click",()=>{
    const wrap=$("#qrWrap");
    wrap.hidden=!wrap.hidden;
    $("#toggleQr").textContent=wrap.hidden?"Anzeigen":"Ausblenden";
    if(!wrap.hidden && !currentQr) renderQr();
  });

  $("#downloadSvg").addEventListener("click",()=>{
    if(!currentQr) renderQr();
    downloadBlob(currentQr,"image/svg+xml",`date-${safeFileName(current.first_name)}-qr.svg`);
  });

  $("#downloadPng").addEventListener("click",downloadPng);

  load().catch(err=>{
    list.innerHTML=`<p class="muted">${esc(err.message)}</p>`;
  });
})();