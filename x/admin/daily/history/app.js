import { adminApi } from "/x/admin/shared/api.js";
import { DAILY_CATEGORIES, DAILY_GROUPS } from "/x/daily/shared/categories.js";
import { renderDailyContentMarkup, wireDailyContentInteractions } from "/x/daily/shared/render-content.js";
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const list=$("[data-list]"),category=$("[data-category]"),date=$("[data-date]"),dialog=$("[data-preview]");let items=[],cats=[];
const nav=$("[data-section-nav]");if(nav)nav.addEventListener("change",()=>location.href=nav.value);
async function init(){cats=(await adminApi("/daily/categories")).categories;category.innerHTML='<option value="">All categories</option>'+cats.map(c=>`<option value="${esc(c.slug)}">${esc(c.label)}</option>`).join("");await load()}
async function load(){const q=new URLSearchParams();if(category.value)q.set("category",category.value);if(date.value)q.set("date",date.value);items=(await adminApi(`/daily/history?${q}`)).items;list.innerHTML=items.length?items.map((i,n)=>`<div class="history-row"><span class="history-date">${esc(i.localDate)}</span><span class="history-copy"><strong>${esc(i.content.displayLabel)}</strong><small>${esc(cats.find(c=>c.slug===i.categorySlug)?.label||i.categorySlug)} · level ${i.selectionLevel}</small></span><button class="button button-secondary button-small" data-preview-index="${n}">Preview</button></div>`).join(""):'<div class="empty-state"><strong>No activation history</strong><span>No records match these filters.</span></div>'}
function showPreview(i){
  const def=DAILY_CATEGORIES[i.categorySlug],group=def?DAILY_GROUPS[def.group]:null;
  $("[data-preview-title]").textContent=i.content.displayLabel;
  $("[data-preview-meta]").innerHTML=`Shown on <strong>${esc(i.localDate)}</strong> · rotation level ${i.selectionLevel} · current content status: ${esc(i.content.status)}<br><small>Preview uses the current version of the referenced content. If it was edited later, this may differ from what was shown that day.</small>`;
  $("[data-preview-icon]").textContent=def?.icon?.emoji||"";
  $("[data-preview-group]").textContent=group?.label||"Daily Content";
  $("[data-preview-category]").textContent=def?.label||i.categorySlug;
  const content=$("[data-preview-content]");
  content.innerHTML=renderDailyContentMarkup(i.categorySlug,i.content.payload,i.content.provenance?.sources||[]);
  wireDailyContentInteractions(content);
  $("[data-preview-json]").textContent=JSON.stringify({payload:i.content.payload,provenance:i.content.provenance},null,2);
  dialog.showModal();
}
list.addEventListener("click",e=>{const b=e.target.closest("[data-preview-index]");if(b)showPreview(items[Number(b.dataset.previewIndex)])});
$("[data-close]").addEventListener("click",()=>dialog.close());category.addEventListener("change",()=>load());date.addEventListener("change",()=>load());$("[data-clear]").addEventListener("click",()=>{category.value="";date.value="";load()});$("[data-refresh]").addEventListener("click",()=>load());await init();
