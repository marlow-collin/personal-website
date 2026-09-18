import { adminApi } from "/x/admin/shared/api.js";
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const generationCategories=[
["quote","Zitat des Tages","01_Quote_Handoff.md"],["saying","Spruch des Tages","02_Saying_Handoff.md"],["wisdom","Weisheit des Tages","03_Wisdom_Handoff.md"],["joke","Witz des Tages","04_Joke_Handoff.md"],["fact","Fakt des Tages","05_Fact_Handoff.md"],["word","Wort des Tages","06_Word_Handoff.md"],["idiom","Redewendung des Tages","07_Idiom_Handoff.md"],["fun-fact","Fun Fact des Tages","08_Fun_Fact_Handoff.md"],["today-i-learned","Heute gelernt","09_Today_I_Learned_Handoff.md"],["media-quote","Media Quote des Tages","10_Media_Quote_Handoff.md"],["bad-advice","Schlechter Rat des Tages","11_Bad_Advice_Handoff.md"],["excuse","Excuse des Tages","12_Excuse_Handoff.md"],["side-quest","Side Quest des Tages","13_Side_Quest_Handoff.md"],["cheer-me-up","Cheer Me Up","14_Cheer_Me_Up_Handoff.md"],["feel-good-fact","Feel-Good Fact des Tages","15_Feel_Good_Fact_Handoff.md"],["worth-remembering","Worth Remembering","16_Worth_Remembering_Handoff.md"]
];
const category=$("[data-generation-category]"),count=$("[data-generation-count]"),prompt=$("[data-generation-prompt]"),input=$("[data-input]"),commit=$("[data-commit]"),result=$("[data-result]");let current=null,sourceFilename="daily-admin-paste.json";
const nav=$("[data-section-nav]");if(nav)nav.addEventListener("change",()=>location.href=nav.value);
category.innerHTML=generationCategories.map(([s,l])=>`<option value="${s}">${l}</option>`).join("");
function exportName(slug){return `Daily_Content_Existing_${slug.split("-").map(x=>x[0].toUpperCase()+x.slice(1)).join("_")}.json`}
function updateKit(){let n=Math.max(1,Math.min(250,parseInt(count.value,10)||50));count.value=n;const c=generationCategories.find(x=>x[0]===category.value)||generationCategories[0];const existing=exportName(c[0]);$("[data-downloads]").innerHTML=`<a href="/x/admin/daily/content-kit/Daily_Content_Generation_Base.md" download><span>1. Common base</span><strong>Base.md</strong></a><a href="/x/admin/daily/content-kit/handoffs/${c[2]}" download><span>2. Category handoff</span><strong>${esc(c[2])}</strong></a><a href="/x/admin/daily/content-kit/Daily_Content_Import_Template.json" download><span>3. Import template</span><strong>Template.json</strong></a><a href="/x/admin/api/daily/import/export/${encodeURIComponent(c[0])}" download><span>4. Current D1 content</span><strong>${esc(existing)}</strong></a><a href="/x/admin/daily/content-kit/Daily_Content_Import_Format_v1.md" download><span>Optional format docs</span><strong>Format v1</strong></a>`;prompt.value=`Bitte lies zuerst vollständig die vier hochgeladenen Dateien \`Daily_Content_Generation_Base.md\`, \`${c[2]}\`, \`Daily_Content_Import_Template.json\` und \`${existing}\`.

Arbeite anschließend die Kategorie-Handoff exakt ab und erstelle ${n} neue Einträge für „${c[1]}“.

Wichtig:
- \`${existing}\` enthält den aktuellen Bestand dieser Kategorie aus D1, einschließlich aktiver und archivierter Einträge. Behandle diese Datei als maßgebliche Quelle für bereits vorhandene Inhalte.
- Erstelle weder exakte Duplikate noch bloße Umformulierungen oder semantisch sehr ähnliche Varianten der vorhandenen Einträge.
- Die gewünschte Zielmenge für diesen Auftrag ist ${n}. Diese Angabe hat Vorrang vor der Standardmenge von 50 aus der Basisdatei.
- Halte dich strikt an das definierte Importformat und die kategoriespezifischen Regeln.
- Recherchiere und verifiziere alle erforderlichen Fakten, Zitate, Zuschreibungen und Quellen sorgfältig.
- Erfinde keine quellenpflichtigen Inhalte oder Quellen.
- Qualität ist wichtiger als das Erzwingen der Zielmenge.
- Erstelle am Ende eine vollständige UTF-8-JSON-Datei, die direkt im Daily Admin validiert und importiert werden kann.
- Gib mir die fertige JSON-Datei als Download aus.
- Stelle keine Rückfrage, wenn die hochgeladenen Dateien alle notwendigen Angaben enthalten.`}
function parse(){if(!input.value.trim())throw new Error("No JSON entered.");return JSON.parse(input.value)}
function show(data){const errors=data.errors||[],warnings=data.warnings||[],s=data.summary||{};result.className=`result-box ${data.ok?"is-ok":"is-error"}`;result.innerHTML=`<strong>${data.ok?"Validation passed":"Validation failed"}</strong><br>Total ${s.total??0} · Valid ${s.valid??0} · Duplicates ${s.duplicates??0}${errors.length?`<br><br>${errors.slice(0,12).map(e=>`${esc(e.path||"document")}: ${esc(e.message)}`).join("<br>")}`:""}${warnings.length?`<br><br>Warnings: ${warnings.slice(0,8).map(e=>esc(e.message)).join(" · ")}`:""}`;commit.disabled=!data.ok}
async function validate(){current=parse();const data=await adminApi("/daily/import/validate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({document:current,sourceFilename})});show(data)}
$("[data-validate]").addEventListener("click",()=>validate().catch(e=>{result.className="result-box is-error";result.textContent=e.message;commit.disabled=true}));
commit.addEventListener("click",async()=>{if(!current||!confirm("Import the validated entries into D1?"))return;try{const data=await adminApi("/daily/import/commit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({document:current,sourceFilename})});show({...data,summary:{total:data.imported,valid:data.imported,duplicates:0}});result.insertAdjacentHTML("afterbegin",`<strong>Imported ${data.imported} entries.</strong><br>`);commit.disabled=true}catch(e){result.className="result-box is-error";result.textContent=e.message}});
$("[data-file]").addEventListener("change",async e=>{const f=e.target.files?.[0];if(!f)return;sourceFilename=f.name;input.value=await f.text();current=null;commit.disabled=true;result.textContent="File loaded. Validate before importing."});
$("[data-clear]").addEventListener("click",()=>{input.value="";current=null;commit.disabled=true;result.className="result-box";result.textContent="Nothing validated yet."});
$("[data-copy]").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(prompt.value);$("[data-copy]").textContent="Copied";setTimeout(()=>$("[data-copy]").textContent="Copy prompt",1500)}catch{prompt.select()}});
category.addEventListener("change",updateKit);count.addEventListener("input",updateKit);updateKit();
