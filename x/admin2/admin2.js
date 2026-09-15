const input=document.querySelector("[data-input]");
const fileInput=document.querySelector("[data-file]");
const validateButton=document.querySelector("[data-validate]");
const commitButton=document.querySelector("[data-commit]");
const clearButton=document.querySelector("[data-clear]");
const status=document.querySelector("[data-status]");
const summary=document.querySelector("[data-summary]");
const preview=document.querySelector("[data-preview]");
const issues=document.querySelector("[data-issues]");
const generationCategory=document.querySelector("[data-generation-category]");
const generationCount=document.querySelector("[data-generation-count]");
const generationPrompt=document.querySelector("[data-generation-prompt]");
const handoffDownload=document.querySelector("[data-handoff-download]");
const handoffName=document.querySelector("[data-handoff-name]");
const copyPromptButton=document.querySelector("[data-copy-prompt]");
const copyStatus=document.querySelector("[data-copy-status]");

let currentDocument=null;
let sourceFilename="admin2-paste.json";

const generationCategories=[
  {slug:"quote",label:"Zitat des Tages",handoff:"01_Quote_Handoff.md"},
  {slug:"saying",label:"Spruch des Tages",handoff:"02_Saying_Handoff.md"},
  {slug:"wisdom",label:"Weisheit des Tages",handoff:"03_Wisdom_Handoff.md"},
  {slug:"joke",label:"Witz des Tages",handoff:"04_Joke_Handoff.md"},
  {slug:"fact",label:"Fakt des Tages",handoff:"05_Fact_Handoff.md"},
  {slug:"word",label:"Wort des Tages",handoff:"06_Word_Handoff.md"},
  {slug:"idiom",label:"Redewendung des Tages",handoff:"07_Idiom_Handoff.md"},
  {slug:"fun-fact",label:"Fun Fact des Tages",handoff:"08_Fun_Fact_Handoff.md"},
  {slug:"today-i-learned",label:"Heute gelernt",handoff:"09_Today_I_Learned_Handoff.md"},
  {slug:"media-quote",label:"Media Quote des Tages",handoff:"10_Media_Quote_Handoff.md"},
  {slug:"bad-advice",label:"Schlechter Rat des Tages",handoff:"11_Bad_Advice_Handoff.md"},
  {slug:"excuse",label:"Excuse des Tages",handoff:"12_Excuse_Handoff.md"},
  {slug:"side-quest",label:"Side Quest des Tages",handoff:"13_Side_Quest_Handoff.md"},
  {slug:"cheer-me-up",label:"Cheer Me Up",handoff:"14_Cheer_Me_Up_Handoff.md"},
  {slug:"feel-good-fact",label:"Feel-Good Fact des Tages",handoff:"15_Feel_Good_Fact_Handoff.md"},
  {slug:"worth-remembering",label:"Worth Remembering",handoff:"16_Worth_Remembering_Handoff.md"}
];

function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]); }
function resetResult() { currentDocument=null; commitButton.disabled=true; status.textContent="Noch nichts validiert."; summary.innerHTML=""; preview.innerHTML=""; issues.innerHTML=""; }
function parseInput() { const raw=input.value.trim(); if (!raw) throw new Error("Kein JSON eingegeben."); return JSON.parse(raw); }

function clampGenerationCount() {
  const parsed=Number.parseInt(generationCount.value,10);
  const value=Number.isFinite(parsed)?Math.min(250,Math.max(1,parsed)):50;
  generationCount.value=String(value);
  return value;
}

function selectedGenerationCategory() {
  return generationCategories.find((category)=>category.slug===generationCategory.value) || generationCategories[0];
}

function buildGenerationPrompt(category,count) {
  return `Bitte lies zuerst vollständig die drei hochgeladenen Dateien \`Daily_Content_Generation_Base.md\`, \`${category.handoff}\` und \`Daily_Content_Import_Template.json\`.

Arbeite anschließend die Kategorie-Handoff exakt ab und erstelle ${count} neue Einträge für „${category.label}“.

Wichtig:
- Die gewünschte Zielmenge für diesen Auftrag ist ${count}. Diese Angabe hat Vorrang vor der Standardmenge von 50 aus der Basisdatei.
- Halte dich strikt an das definierte Importformat und die kategoriespezifischen Regeln.
- Recherchiere und verifiziere alle erforderlichen Fakten, Zitate, Zuschreibungen und Quellen sorgfältig.
- Erfinde keine quellenpflichtigen Inhalte oder Quellen.
- Vermeide exakte und semantische Duplikate so gut wie möglich.
- Qualität ist wichtiger als das Erzwingen der Zielmenge. Wenn ${count} seriöse, wirklich unterschiedliche und regelkonforme Einträge nicht verantwortungsvoll möglich sind, liefere weniger und nenne vor der finalen Datei kurz den Grund.
- Erstelle am Ende eine vollständige UTF-8-JSON-Datei, die direkt über \`/x/admin2/\` validiert und importiert werden kann.
- Gib mir die fertige JSON-Datei als Download aus.
- Stelle keine Rückfrage, wenn die hochgeladenen Dateien alle notwendigen Angaben enthalten. Arbeite den Auftrag direkt ab.`;
}

function updateGenerationUi() {
  const category=selectedGenerationCategory();
  const count=clampGenerationCount();
  const path=`/x/admin2/content-kit/handoffs/${category.handoff}`;
  handoffDownload.href=path;
  handoffDownload.setAttribute("download",category.handoff);
  handoffName.textContent=category.handoff;
  generationPrompt.value=buildGenerationPrompt(category,count);
  copyStatus.textContent="";
}

async function copyGenerationPrompt() {
  const value=generationPrompt.value;
  try {
    await navigator.clipboard.writeText(value);
    copyStatus.textContent="Kopiert.";
  } catch {
    generationPrompt.focus();
    generationPrompt.select();
    const copied=document.execCommand("copy");
    copyStatus.textContent=copied?"Kopiert.":"Bitte Text manuell kopieren.";
  }
}

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
    const s=data.summary || {};
    if (data.ok) {
      status.innerHTML=`<span class="ok">Validierung erfolgreich – ${escapeHtml(data.category)} kann importiert werden.</span>`;
      commitButton.disabled=false;
    } else if ((s.total ?? 0)>0 && (s.valid ?? 0)===0 && (s.duplicates ?? 0)===(s.total ?? 0)) {
      status.innerHTML=`<span class="warning">Validierung abgeschlossen – alle Einträge existieren bereits als exakte Duplikate. Es gibt nichts zu importieren.</span>`;
    } else {
      status.innerHTML=`<span class="error">Validierung fehlgeschlagen.</span>`;
    }
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

generationCategories.forEach((category)=>{
  const option=document.createElement("option");
  option.value=category.slug;
  option.textContent=category.label;
  generationCategory.append(option);
});
generationCategory.value="quote";
generationCategory.addEventListener("change",updateGenerationUi);
generationCount.addEventListener("input",updateGenerationUi);
generationCount.addEventListener("change",updateGenerationUi);
copyPromptButton.addEventListener("click",copyGenerationPrompt);
updateGenerationUi();

fileInput.addEventListener("change",async()=>{ const file=fileInput.files?.[0]; if (!file) return; sourceFilename=file.name; input.value=await file.text(); resetResult(); });
validateButton.addEventListener("click",validate);
commitButton.addEventListener("click",commit);
clearButton.addEventListener("click",()=>{ input.value=""; fileInput.value=""; sourceFilename="admin2-paste.json"; resetResult(); });
input.addEventListener("input",()=>{ commitButton.disabled=true; currentDocument=null; });
