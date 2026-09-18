import { adminApi } from "/x/admin/shared/api.js";
import { renderDailyContentMarkup, wireDailyContentInteractions } from "/x/daily/shared/render-content.js";
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const list=$("[data-list]"),category=$("[data-category]"),date=$("[data-date]"),dialog=$("[data-preview]");let items=[],cats=[];
const nav=$("[data-section-nav]");if(nav)nav.addEventListener("change",()=>location.href=nav.value);
async function init(){cats=(await adminApi("/daily/categories")).categories;category.innerHTML='<option value="">All categories</option>'+cats.map(c=>`<option value="${esc(c.slug)}">${esc(c.label)}</option>`).join("");await load()}
async function load(){const q=new URLSearchParams();if(category.value)q.set("category",category.value);if(date.value)q.set("date",date.value);items=(await adminApi(`/daily/history?${q}`)).items;list.innerHTML=items.length?items.map((i,n)=>`<div class="history-row"><span class="history-date">${esc(i.localDate)}</span><span class="history-copy"><strong>${esc(i.content.displayLabel)}</strong><small>${esc(cats.find(c=>c.slug===i.categorySlug)?.label||i.categorySlug)} · level ${i.selectionLevel}</small></span><button class="button button-secondary button-small" data-preview-index="${n}">Preview</button></div>`).join(""):'<div class="empty-state"><strong>No activation history</strong><span>No records match these filters.</span></div>'}
function previewDocument(i){
  const markup=renderDailyContentMarkup(i.categorySlug,i.content.payload,i.content.provenance?.sources||[]);
  return `<!doctype html><html lang="de" data-daily-group=""><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/x/daily/assets/css/daily-base.css"><link rel="stylesheet" href="/x/daily/assets/css/category.css"><style>html,body{min-height:0}.daily-category{width:min(100% - 1.5rem,var(--daily-reading-width));padding:1rem 0 1.5rem}.daily-content{margin:0}.preview-shell{padding:.25rem 0}</style></head><body data-daily-category="${esc(i.categorySlug)}"><main class="daily-category"><div class="preview-shell"><article class="daily-content">${markup}</article></div></main></body></html>`;
}
function showPreview(i){
  $("[data-preview-title]").textContent=i.content.displayLabel;
  $("[data-preview-meta]").innerHTML=`Shown on <strong>${esc(i.localDate)}</strong> · rotation level ${i.selectionLevel} · current content status: ${esc(i.content.status)}<br><small>Preview uses the current version of the referenced content. If it was edited later, this may differ from what was shown that day.</small>`;
  $("[data-preview-json]").textContent=JSON.stringify({payload:i.content.payload,provenance:i.content.provenance},null,2);
  const frame=$("[data-preview-frame]");
  frame.onload=()=>{
    const body=frame.contentDocument?.body;
    const content=body?.querySelector(".daily-content");
    if(content) wireDailyContentInteractions(content);
    if(body){
      const resize=()=>{frame.style.height=`${Math.max(320,body.scrollHeight+8)}px`};
      resize();
      if("ResizeObserver" in window) new ResizeObserver(resize).observe(body);
    }
  };
  frame.srcdoc=previewDocument(i);
  dialog.showModal();
}
list.addEventListener("click",e=>{const b=e.target.closest("[data-preview-index]");if(b)showPreview(items[Number(b.dataset.previewIndex)])});
$("[data-close]").addEventListener("click",()=>dialog.close());category.addEventListener("change",()=>load());date.addEventListener("change",()=>load());$("[data-clear]").addEventListener("click",()=>{category.value="";date.value="";load()});$("[data-refresh]").addEventListener("click",()=>load());await init();
