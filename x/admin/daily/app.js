import { adminApi } from "/x/admin/shared/api.js";
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
function setupNav(){const n=$("[data-section-nav]");if(n)n.addEventListener("change",()=>location.href=n.value)}
setupNav();

const box=$("[data-categories]");
async function load(){
  box.innerHTML='<div class="skeleton-line">Loading categories…</div>';
  const data=await adminApi("/daily/overview");
  box.innerHTML=data.categories.map(c=>`<article class="category-card"><div class="category-card-head"><div><h3>${esc(c.label)}</h3><p>${esc(c.lastShown?.displayLabel||"Nothing shown yet")}</p></div>${c.active===0?'<span class="status-pill status-error">No active content</span>':'<span class="status-pill">Healthy</span>'}</div><div class="mini-metrics"><div class="mini-metric"><span>Active</span><strong>${c.active}</strong></div><div class="mini-metric"><span>Archived</span><strong>${c.archived}</strong></div><div class="mini-metric"><span>Level</span><strong>${c.rotationLevel??"–"}</strong></div><div class="mini-metric"><span>Remaining</span><strong>${c.remaining}</strong></div></div><p>${c.lastShown?`Last shown ${esc(c.lastShown.localDate)}`:"No activation history"}</p></article>`).join("");
}
$("[data-refresh]").addEventListener("click",()=>load().catch(e=>box.innerHTML=`<div class="load-error">${esc(e.message)}</div>`));
load().catch(e=>box.innerHTML=`<div class="load-error">${esc(e.message)}</div>`);
