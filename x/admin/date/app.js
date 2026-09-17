import { adminApi } from "/x/admin/shared/api.js";

const $ = (selector) => document.querySelector(selector);
const form = $("#createForm");
const list = $("#inviteList");
const createDialog = $("#createDialog");
const inviteDialog = $("#inviteDialog");
const toast = $("#toast");
let current = null;
let currentQr = null;

function api(path = "", options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  return adminApi(`/date${path}`, { ...options, headers });
}
function esc(value = "") { return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
function statusLabel(status) { return ({created:"Not opened",opened:"Opened",accepted:"Accepted",completed:"Completed"}[status] || status); }
function themeLabel(theme) { return theme === "dark-elegant" ? "Dark Elegant" : "Soft + Playful"; }
function showToast(text) { toast.textContent = text; toast.hidden = false; clearTimeout(showToast.timer); showToast.timer = setTimeout(() => { toast.hidden = true; }, 2200); }
function setBusy(button, busy) { button.disabled = busy; button.setAttribute("aria-busy", String(busy)); }

function renderStats(rows) {
  const counts = { all: rows.length, created: 0, open: 0, completed: 0 };
  rows.forEach(row => { if (row.status === "created") counts.created++; if (row.status === "opened" || row.status === "accepted") counts.open++; if (row.status === "completed") counts.completed++; });
  $("#stats").innerHTML = [
    ["Total", counts.all], ["Not opened", counts.created], ["In progress", counts.open], ["Completed", counts.completed]
  ].map(([label,value]) => `<div class="admin-metric"><span>${label}</span><strong>${value}</strong></div>`).join("");
}
function renderRows(rows) {
  if (!rows.length) { list.innerHTML = '<div class="empty-state"><strong>No invitations yet</strong><span>Create the first personal Date invitation.</span></div>'; return; }
  list.innerHTML = rows.map(row => `<button class="record-row" type="button" data-open="${esc(row.token)}">
    <span class="record-main"><strong>${esc(row.first_name)}</strong><small>${esc(row.internal_label || "No internal note")}</small></span>
    <span class="record-meta"><span class="status-pill">${esc(statusLabel(row.status))}</span><small>${row.no_attempts || 0}× No · ${esc(themeLabel(row.theme))}</small></span>
    <span class="record-arrow">›</span></button>`).join("");
}
async function load() {
  list.innerHTML = '<div class="skeleton-line">Loading invitations…</div>';
  const data = await api("/invitations");
  renderStats(data.invitations); renderRows(data.invitations);
}
function invitationUrl(inv) { return `${location.origin}/x/date/${inv.token}`; }
function makeQrSvg(text) {
  const { size, modules } = LocalQRCode.matrix(text); const border = 4; const view = size + border * 2; let path = "";
  for (let y=0;y<size;y++) for (let x=0;x<size;x++) if (modules[y][x]) path += `M${x+border},${y+border}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${view} ${view}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}
function renderQr() { if (!current) return; currentQr = makeQrSvg(invitationUrl(current)); $("#qrPreview").innerHTML = currentQr; }
function downloadBlob(content,type,filename) { const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function safeFileName(name) { return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "invitation"; }
function downloadPng() {
  if (!currentQr) renderQr(); const svgBlob=new Blob([currentQr],{type:"image/svg+xml"}); const url=URL.createObjectURL(svgBlob); const img=new Image();
  img.onload=()=>{ const canvas=document.createElement("canvas"); canvas.width=canvas.height=1200; const ctx=canvas.getContext("2d"); ctx.fillStyle="#fff";ctx.fillRect(0,0,1200,1200);ctx.imageSmoothingEnabled=false;ctx.drawImage(img,0,0,1200,1200);URL.revokeObjectURL(url);canvas.toBlob(blob=>{const a=document.createElement("a"),u=URL.createObjectURL(blob);a.href=u;a.download=`date-${safeFileName(current.first_name)}-qr.png`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);},"image/png");}; img.src=url;
}
async function openInvite(token) {
  current = await api(`/invitations/${encodeURIComponent(token)}`);
  $("#dialogTitle").textContent=current.first_name; $("#inviteUrl").textContent=invitationUrl(current);
  const fields=[["Status",statusLabel(current.status)],["Design",themeLabel(current.theme)],["Internal note",current.internal_label||"–"],["No attempts",current.no_attempts||0],["Activity",current.activity||"–"],["Day",current.day_preference||"–"],["Time",current.time_preference||"–"],["Ride",current.ride_preference||"–"],["Final message",current.final_message||"Klingt nach einem ziemlich guten Plan ✨"]];
  $("#detailGrid").innerHTML=fields.map(([label,value])=>`<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("");
  $("#qrWrap").hidden=true; $("#toggleQr").textContent="Show"; currentQr=null; inviteDialog.showModal();
}
function openCreate() { if (!createDialog.open) createDialog.showModal(); requestAnimationFrame(()=>form.querySelector('input[name="first_name"]')?.focus()); }
function closeCreate() { createDialog.close(); }

$("#newInviteButton").addEventListener("click",openCreate); $("#closeCreate").addEventListener("click",closeCreate); $("#cancelCreate").addEventListener("click",closeCreate);
$("#refreshButton").addEventListener("click",()=>load().catch(error=>showToast(error.message))); $("#closeDialog").addEventListener("click",()=>inviteDialog.close());
form.addEventListener("submit",async event=>{event.preventDefault();const body=Object.fromEntries(new FormData(form).entries());const button=form.querySelector('button[type="submit"]');setBusy(button,true);try{const created=await api("/invitations",{method:"POST",body:JSON.stringify(body)});form.reset();form.querySelector('input[name="theme"][value="soft-playful"]').checked=true;closeCreate();await load();await openInvite(created.token);showToast("Invitation created");}catch(error){showToast(error.message);}finally{setBusy(button,false);}});
list.addEventListener("click",event=>{const button=event.target.closest("[data-open]");if(button)openInvite(button.dataset.open).catch(error=>showToast(error.message));});
$("#copyLink").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(invitationUrl(current));showToast("Link copied");}catch{showToast("Could not copy link");}});
$("#previewLink").addEventListener("click",()=>window.open(invitationUrl(current)+"?preview=1","_blank","noopener"));
$("#toggleQr").addEventListener("click",()=>{const wrap=$("#qrWrap");wrap.hidden=!wrap.hidden;$("#toggleQr").textContent=wrap.hidden?"Show":"Hide";if(!wrap.hidden&&!currentQr)renderQr();});
$("#downloadSvg").addEventListener("click",()=>{if(!currentQr)renderQr();downloadBlob(currentQr,"image/svg+xml",`date-${safeFileName(current.first_name)}-qr.svg`);}); $("#downloadPng").addEventListener("click",downloadPng);
$("#resetProgress").addEventListener("click",async()=>{if(!current||!confirm(`Reset progress for ${current.first_name}?\n\nThe link stays the same, but status, No attempts and selections are cleared.`))return;try{await api(`/invitations/${encodeURIComponent(current.token)}/reset`,{method:"POST"});showToast("Progress reset");inviteDialog.close();await load();}catch(error){showToast(error.message);}});
$("#deleteInvite").addEventListener("click",async()=>{if(!current||!confirm(`Permanently delete the invitation for ${current.first_name}?\n\nThe link will stop working.`))return;try{await api(`/invitations/${encodeURIComponent(current.token)}`,{method:"DELETE"});showToast("Invitation deleted");inviteDialog.close();current=null;await load();}catch(error){showToast(error.message);}});

if(new URLSearchParams(location.search).get("new") === "1") openCreate();
load().catch(error=>{list.innerHTML=`<div class="load-error">${esc(error.message)}</div>`;});
