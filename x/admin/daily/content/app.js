import { adminApi } from "/x/admin/shared/api.js";
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
function setupNav(){const n=$("[data-section-nav]");if(n)n.addEventListener("change",()=>location.href=n.value)}
setupNav();

const list=$("[data-list]"), category=$("[data-category]"), status=$("[data-status]"), search=$("[data-search]"), dialog=$("[data-editor]"), form=$("[data-form]");
let categories=[], current=null, dirty=false;
function toast(msg){const t=$("[data-toast]");t.textContent=msg;t.hidden=false;clearTimeout(t._timer);t._timer=setTimeout(()=>t.hidden=true,2600)}
function fillCategories(select,includeAll=false){select.innerHTML=(includeAll?'<option value="">All categories</option>':"")+categories.map(c=>`<option value="${esc(c.slug)}">${esc(c.label)}</option>`).join("")}
async function loadCategories(){const d=await adminApi("/daily/categories");categories=d.categories;fillCategories(category,true);fillCategories($("[data-editor-category]"))}
async function load(){
  list.innerHTML='<div class="skeleton-line">Loading content…</div>';
  const q=new URLSearchParams();if(category.value)q.set("category",category.value);if(status.value)q.set("status",status.value);if(search.value.trim())q.set("q",search.value.trim());
  const d=await adminApi(`/daily/content?${q}`);
  list.innerHTML=d.items.length?d.items.map(i=>`<button class="record-row" type="button" data-id="${esc(i.id)}"><span class="record-main"><strong>${esc(i.displayLabel)}</strong><small>${esc(categories.find(c=>c.slug===i.categorySlug)?.label||i.categorySlug)}</small></span><span class="record-meta"><span class="status-pill">${esc(i.status)}</span><small>Shown ${i.timesShown}×</small></span><span class="record-arrow">›</span></button>`).join(""):'<div class="empty-state"><strong>No matching content</strong><span>Change filters or create a new entry.</span></div>';
}
function parseJsonField(name,nullable=false){const raw=form.elements[name].value.trim();if(nullable&&!raw)return null;return JSON.parse(raw)}
function setDirty(v){dirty=v}
function openNew(){
 current=null;form.reset();$("[data-editor-title]").textContent="New entry";$("[data-editor-eyebrow]").textContent="Create content";$("[data-archive]").hidden=true;$("[data-restore]").hidden=true;$("[data-system-meta]").hidden=true;$("[data-form-error]").textContent="";form.elements.payload.value="{\n  \n}";form.elements.provenance.value="";dirty=false;dialog.showModal();
}
async function openEdit(id){
 const d=await adminApi(`/daily/content/${encodeURIComponent(id)}`);current=d.item;$("[data-editor-title]").textContent=current.displayLabel;$("[data-editor-eyebrow]").textContent="Edit content";form.elements.categorySlug.value=current.categorySlug;form.elements.payload.value=JSON.stringify(current.payload,null,2);form.elements.provenance.value=current.provenance==null?"":JSON.stringify(current.provenance,null,2);$("[data-system-meta]").hidden=false;$("[data-system-meta]").textContent=`Rotation counter: ${current.timesShown} · Created ${current.createdAt} · This value is system-managed.`;$("[data-archive]").hidden=current.status!=="active";$("[data-restore]").hidden=current.status!=="archived";$("[data-form-error]").textContent="";dirty=false;dialog.showModal();
}
function close(){if(dirty&&!confirm("Discard unsaved changes?"))return;dialog.close();current=null;dirty=false}
form.addEventListener("input",()=>setDirty(true));
form.addEventListener("submit",async e=>{e.preventDefault();$("[data-form-error]").textContent="";try{const body={categorySlug:form.elements.categorySlug.value,payload:parseJsonField("payload"),provenance:parseJsonField("provenance",true),status:current?.status||"active"};const path=current?`/daily/content/${encodeURIComponent(current.id)}`:"/daily/content";const d=await adminApi(path,{method:current?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});dirty=false;dialog.close();toast(current?"Entry saved":"Entry created");current=null;await load();}catch(e){$("[data-form-error]").textContent=e.message}});
async function changeStatus(next){if(!current)return;await adminApi(`/daily/content/${encodeURIComponent(current.id)}/status`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:next})});dirty=false;dialog.close();toast(next==="archived"?"Entry archived · restore from Archived filter":"Entry restored");current=null;await load()}
$("[data-archive]").addEventListener("click",()=>changeStatus("archived").catch(e=>toast(e.message)));$("[data-restore]").addEventListener("click",()=>changeStatus("active").catch(e=>toast(e.message)));
$("[data-new]").addEventListener("click",openNew);$("[data-close]").addEventListener("click",close);$("[data-cancel]").addEventListener("click",close);list.addEventListener("click",e=>{const b=e.target.closest("[data-id]");if(b)openEdit(b.dataset.id).catch(x=>toast(x.message))});
let timer;search.addEventListener("input",()=>{clearTimeout(timer);timer=setTimeout(()=>load().catch(e=>toast(e.message)),250)});category.addEventListener("change",()=>load().catch(e=>toast(e.message)));status.addEventListener("change",()=>load().catch(e=>toast(e.message)));$("[data-refresh]").addEventListener("click",()=>load().catch(e=>toast(e.message)));
await loadCategories();await load();
