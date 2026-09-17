import { adminApi } from "/x/admin/shared/api.js";
import { externalAttributes, formatTimestamp, statusLabel } from "/x/admin/shared/shell.js";

const attentionList = document.querySelector("#attentionList");
const moduleGrid = document.querySelector("#moduleGrid");
const systemGrid = document.querySelector("#systemGrid");
const dashboardMeta = document.querySelector("#dashboardMeta");
const refreshButton = document.querySelector("#refreshButton");

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function actionLink(label, href, { primary = false, external = false } = {}) {
  const link = element("a", `button ${primary ? "button-primary" : "button-secondary"}`, label);
  link.href = href;
  if (external) externalAttributes(link);
  return link;
}

function renderAttention(items) {
  attentionList.replaceChildren();

  if (!items.length) {
    const healthy = element("div", "healthy-state");
    healthy.append(
      element("span", "healthy-mark", "✓"),
      element("div", "", "Everything looks healthy.")
    );
    attentionList.append(healthy);
    return;
  }

  for (const item of items) {
    const row = element("a", `attention-row attention-${item.severity}`);
    row.href = item.href || "/x/admin/";

    const marker = element("span", "attention-marker", item.severity === "error" ? "!" : "•");
    const copy = element("div", "attention-copy");
    copy.append(
      element("strong", "", item.title),
      element("span", "", item.message)
    );
    row.append(marker, copy, element("span", "attention-arrow", "→"));
    attentionList.append(row);
  }
}

function renderModules(modules) {
  moduleGrid.replaceChildren();

  for (const module of modules) {
    const card = element("article", `module-card status-${module.status}`);
    const header = element("div", "module-head");
    const titleWrap = element("div");
    titleWrap.append(
      element("h3", "", module.label),
      element("p", "module-description", module.description)
    );
    header.append(titleWrap, element("span", `status-pill status-${module.status}`, statusLabel(module.status)));

    const summary = element("p", "module-summary", module.summary || "");
    const metrics = element("div", "metric-row");
    for (const metric of module.metrics || []) {
      const metricNode = element("div", "metric");
      metricNode.append(
        element("span", "metric-label", metric.label),
        element("strong", "metric-value", String(metric.value))
      );
      metrics.append(metricNode);
    }

    const actions = element("div", "card-actions");
    if (module.manageUrl) actions.append(actionLink("Manage", module.manageUrl, { primary: true }));
    for (const quickAction of module.quickActions || []) {
      actions.append(actionLink(quickAction.label, quickAction.href));
    }
    if (module.siteUrl) actions.append(actionLink("Open Site ↗", module.siteUrl, { external: true }));

    card.append(header, summary);
    if (module.metrics?.length) card.append(metrics);
    card.append(actions);
    moduleGrid.append(card);
  }
}

function systemItem(label, value, state = "") {
  const item = element("div", "system-item");
  item.append(element("span", "", label), element("strong", state ? `system-${state}` : "", value));
  return item;
}

function renderSystem(system) {
  systemGrid.replaceChildren();
  systemGrid.append(
    systemItem("Environment", system.environment),
    systemItem("Access", system.access, "ok"),
    systemItem("Mail", system.mail, system.mail === "Configured" ? "ok" : "muted"),
    systemItem("Date Database", system.databases.date, system.databases.date === "Connected" ? "ok" : "error"),
    systemItem("Daily Database", system.databases.daily, system.databases.daily === "Connected" ? "ok" : "error"),
    systemItem("Check-in Database", system.databases.checkins, system.databases.checkins === "Connected" ? "ok" : "error"),
    systemItem("Conversation Database", system.databases.conversation, system.databases.conversation === "Connected" ? "ok" : "error")
  );
}

function renderError(error) {
  attentionList.replaceChildren();
  const row = element("div", "attention-row attention-error");
  row.append(
    element("span", "attention-marker", "!"),
    element("div", "attention-copy", `Dashboard data could not be loaded: ${error.message}`)
  );
  attentionList.append(row);
  moduleGrid.replaceChildren(element("div", "load-error", "Module data unavailable."));
  systemGrid.replaceChildren(element("div", "load-error", "System data unavailable."));
}

async function loadDashboard() {
  refreshButton.disabled = true;
  refreshButton.classList.add("is-loading");
  try {
    const data = await adminApi("/overview");
    renderAttention(data.attention || []);
    renderModules(data.modules || []);
    renderSystem(data.system || {});
    const timestamp = formatTimestamp(data.generatedAt);
    dashboardMeta.textContent = timestamp ? `Last checked ${timestamp}` : "";
  } catch (error) {
    renderError(error);
  } finally {
    refreshButton.disabled = false;
    refreshButton.classList.remove("is-loading");
  }
}

refreshButton.addEventListener("click", loadDashboard);
loadDashboard();
