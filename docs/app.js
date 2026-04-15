const STATUS_URL = "./data/status.json";
const HISTORY_URL = "./data/history.json";
const WINDOW_HOURS = 24 * 7;

const statusLabels = {
  operational: "Operational",
  degraded: "Degraded",
  major_outage: "Major Outage",
  no_data: "No Data",
};

const bannerText = {
  operational: "All Systems Operational",
  degraded: "Partial Service Degradation",
  major_outage: "Major Service Outage",
  no_data: "No Probe Data Yet",
};

function fmtDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function setBanner(status) {
  const banner = document.getElementById("overallBanner");
  banner.className = `banner banner-${status}`;
  banner.textContent = bannerText[status] || bannerText.no_data;
}

function setPill(status) {
  const pill = document.getElementById("servicePill");
  pill.className = `pill pill-${status}`;
  pill.textContent = statusLabels[status] || statusLabels.no_data;
}

function fillStatus(status) {
  const probeStatus = status.overall_status || "no_data";
  setBanner(probeStatus);
  setPill(probeStatus);
  setText("lastUpdated", `Last checked: ${fmtDate(status.checked_at)}`);
  setText("serviceName", status.service_name || "Anyrouter Claude Code Probe");
  setText("httpStatus", status.http_status ?? "-");
  setText("tokenOk", status.token_ok ? "Yes" : "No");
  setText("latencyMs", status.latency_ms == null ? "-" : `${status.latency_ms} ms`);
  setText("targetModel", status.target_model || "-");
  setText("lastToken", status.last_token || "-");
  setText("errorMessage", status.error_message || "-");
}

function bucketTooltip(bucket) {
  const httpStatus = bucket.last_http_status == null ? "-" : bucket.last_http_status;
  const successRate = bucket.checks > 0 ? `${bucket.successes}/${bucket.checks}` : "0/0";
  return [
    fmtDate(bucket.hour),
    `状态: ${statusLabels[bucket.status] || statusLabels.no_data}`,
    `成功: ${successRate}`,
    `HTTP: ${httpStatus}`,
    `平均耗时: ${bucket.avg_latency_ms == null ? "-" : `${bucket.avg_latency_ms} ms`}`,
    `错误: ${bucket.last_error_message || "-"}`,
  ].join("\n");
}

function fillHistory(history) {
  const grid = document.getElementById("uptimeGrid");
  grid.innerHTML = "";

  const map = new Map();
  for (const bucket of history.buckets || []) {
    map.set(bucket.hour, bucket);
  }

  const generated = history.generated_at ? new Date(history.generated_at) : new Date();
  const aligned = new Date(generated);
  aligned.setUTCMinutes(0, 0, 0);

  let totalChecks = 0;
  let totalSuccesses = 0;

  for (let offset = WINDOW_HOURS - 1; offset >= 0; offset -= 1) {
    const dt = new Date(aligned.getTime() - offset * 60 * 60 * 1000);
    const key = dt.toISOString().replace(".000Z", "Z");
    const bucket = map.get(key) || {
      hour: key,
      checks: 0,
      successes: 0,
      last_http_status: null,
      avg_latency_ms: null,
      last_error_message: "",
      status: "no_data",
    };
    totalChecks += bucket.checks;
    totalSuccesses += bucket.successes;

    const cell = document.createElement("div");
    cell.className = `uptime-cell cell-${bucket.status || "no_data"}`;
    cell.title = bucketTooltip(bucket);
    grid.appendChild(cell);
  }

  const uptime = totalChecks > 0 ? ((totalSuccesses / totalChecks) * 100).toFixed(2) : "0.00";
  setText("uptimeValue", `${uptime}% uptime`);
}

async function fetchJson(url) {
  const response = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
  }
  return response.json();
}

async function loadPage() {
  try {
    const [status, history] = await Promise.all([fetchJson(STATUS_URL), fetchJson(HISTORY_URL)]);
    fillStatus(status);
    fillHistory(history);
  } catch (error) {
    setBanner("major_outage");
    setPill("major_outage");
    setText("lastUpdated", "Failed to load status data");
    setText("errorMessage", String(error));
  }
}

loadPage();
window.setInterval(loadPage, 60 * 1000);
