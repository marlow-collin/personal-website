export function statusLabel(status) {
  return ({
    error: "Error",
    attention: "Attention",
    healthy: "Healthy",
    neutral: "No configuration"
  })[status] || "Status";
}

export function externalAttributes(anchor) {
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  return anchor;
}

export function formatTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
