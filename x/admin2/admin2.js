const input=document.querySelector("[data-input]");
const fileInput=document.querySelector("[data-file]");
const validateButton=document.querySelector("[data-validate]");
const commitButton=document.querySelector("[data-commit]");
const clearButton=document.querySelector("[data-clear]");
const status=document.querySelector("[data-status]");
const summary=document.querySelector("[data-summary]");
const preview=document.querySelector("[data-preview]");
const issues=document.querySelector("[data-issues]");
let currentDocument=null;
let sourceFilename="admin2-paste.json";

function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]); }
function resetResult() { currentDocument=null; commitButton.disabled=true; status.textContent="Noch nichts validiert."; summary.innerHTML=""; preview.innerHTML=""; issues.innerHTML=""; }
function parseInput() { const raw=input.value.trim(); if (!raw) throw new Error("Kein JSON eingegeben."); return JSON.parse(raw); }
function showIssues(data) {
  const all=[...(data.errors || []).map((x)=>({...x,kind:"error"})),...(data.warnings || []).map((x)=>({...x,kind:"warning"}))];
  if (!all.length) { issues.innerHTML=""; return; }
  issues.innerHTML=`<h3>Hinweise</h3><ul>${all.map((item)=>`<li class="${item.kind}"><code>${escapeHtml(item.path || "document")}</code>: ${escapeHtml(item.message)}${item.clientRef?` <small>(${escapeHtml(item.clientRef)})</small>`:""}</li>`).join("")}</ul>`;
}
function showPreview(data) {
  const s=data.summary || {};
  summary.innerHTML=`<div class="summary"><span>Gesamt: ${s.total ?? 0}</span><span>Valide: ${s.valid ?? 0}</span><span>Duplikate: ${s.duplicates ?? 0}</span></div>`;
  const rows=Array.isArray(data.preview)?data.preview:[];
  preview.innerHTML=rows.length?`<h3>Vorschau</h3><table><thead><tr><th>#</th><th>Referenz</th><th>Label</th><th>Status</th></tr></thead><tbody>${rows.map((row)=>`<tr><td>${row.index+1}</td><td>${escapeHtml(row.clientRef || "—")}</td><td>${escapeHtml(row.displayLabel)}</td><td>${row.duplicate?"Duplikat":escapeHtml(row.status)}</td></tr>`).join("")}</tbody></table>`:"";
}
async function callApi(path, document) {
  const response=await fetch(path,{ method:"POST", headers:{"Content-Type":"application/json","Accept":"application/json"}, credentials:"same-origin", cache:"no-store", body:JSON.stringify({ document, sourceFilename }) });
  const data=await response.json().catch(()=>({ error:`HTTP ${response.status}` }));
  if (!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`);
  return data;
}
async function validate() {
  commitButton.disabled=true;
  try {
    currentDocument=parseInput(); status.textContent="Validierung läuft …";
    const data=await callApi("/x/api/daily/import/validate",currentDocument);
    showPreview(data); showIssues(data);
    if (data.ok) { status.innerHTML=`<span class="ok">Validierung erfolgreich – ${escapeHtml(data.category)} kann importiert werden.</span>`; commitButton.disabled=false; }
    else status.innerHTML=`<span class="error">Validierung fehlgeschlagen.</span>`;
  } catch (error) { status.innerHTML=`<span class="error">${escapeHtml(error.message)}</span>`; summary.innerHTML=""; preview.innerHTML=""; issues.innerHTML=""; currentDocument=null; }
}
async function commit() {
  if (!currentDocument) return;
  commitButton.disabled=true; validateButton.disabled=true;
  try {
    status.textContent="Import läuft …";
    const data=await callApi("/x/api/daily/import/commit",currentDocument);
    showIssues(data);
    if (!data.committed) { status.innerHTML=`<span class="error">Import nicht durchgeführt – bitte erneut validieren.</span>`; showPreview(data); return; }
    status.innerHTML=`<span class="ok">Import erfolgreich: ${data.imported} Einträge. Batch ${escapeHtml(data.importId)}</span>`;
  } catch (error) { status.innerHTML=`<span class="error">${escapeHtml(error.message)}</span>`; }
  finally { validateButton.disabled=false; }
}
fileInput.addEventListener("change",async()=>{ const file=fileInput.files?.[0]; if (!file) return; sourceFilename=file.name; input.value=await file.text(); resetResult(); });
validateButton.addEventListener("click",validate);
commitButton.addEventListener("click",commit);
clearButton.addEventListener("click",()=>{ input.value=""; fileInput.value=""; sourceFilename="admin2-paste.json"; resetResult(); });
input.addEventListener("input",()=>{ commitButton.disabled=true; currentDocument=null; });
