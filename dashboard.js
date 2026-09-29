const STRIKE_DESCRIPTIONS = new Set([
  "called_strike",
  "foul",
  "foul_bunt",
  "foul_tip",
  "missed_bunt",
  "swinging_strike",
  "swinging_strike_blocked",
  "bunt_foul_tip",
]);

const HIT_EVENTS = new Set(["single", "double", "triple", "home_run"]);
const REPORT_COLORS = ["#246b9c", "#e98a47", "#2a8b87", "#15283d", "#b9cbd7", "#8c6b9f", "#d8b24f", "#597d8f"];
const allRows = [];
const charts = {};
const pitchNameByType = new Map();

const filterKeys = [
  ["filter-season", "season"],
  ["filter-month", "month"],
  ["filter-pitch-type", "pitch_type"],
  ["filter-p-throws", "p_throws"],
  ["filter-stand", "stand"],
  ["filter-pitcher", "pitcher"],
  ["filter-batter", "batter"],
];

const breakdownLabels = {
  season: "Season",
  month: "Month",
  pitch_type: "Pitch type",
  p_throws: "Pitcher hand",
  stand: "Batter stance",
  home_team: "Home team",
  away_team: "Away team",
};

const metricDefinitions = {
  count: { label: "Pitch count", shortLabel: "Pitches", format: (value) => formatNumber(value) },
  avg_speed: { label: "Average pitch speed", shortLabel: "Avg speed", format: (value) => `${value.toFixed(2)} mph` },
  avg_exit_velocity: { label: "Average exit velocity", shortLabel: "Avg exit velocity", format: (value) => `${value.toFixed(2)} mph` },
  strike_rate: { label: "Strike rate", shortLabel: "Strike rate", format: (value) => `${(value * 100).toFixed(1)}%` },
  hard_hit_rate: { label: "Hard-hit rate", shortLabel: "Hard-hit rate", format: (value) => `${(value * 100).toFixed(1)}%` },
};

function formatNumber(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat("en-US").format(Math.round(value)) : "—";
}

function mean(rows, key) {
  const values = rows.map((row) => Number(row[key])).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function percentage(rows, predicate, denominatorPredicate = () => true) {
  const eligible = rows.filter(denominatorPredicate);
  return eligible.length ? eligible.filter(predicate).length / eligible.length : null;
}

function isStrike(row) {
  return STRIKE_DESCRIPTIONS.has(row.description);
}

function isBattedBall(row) {
  return Number.isFinite(Number(row.launch_speed));
}

function aggregateRows(rows) {
  return {
    pitches: rows.length,
    avg_speed: mean(rows, "release_speed"),
    avg_exit_velocity: mean(rows, "launch_speed"),
    strike_rate: percentage(rows, isStrike),
    hard_hit_rate: percentage(rows, (row) => Number(row.launch_speed) >= 95, isBattedBall),
    plate_appearances: rows.filter((row) => row.events).length,
  };
}

function getMetricValue(summary, metric) {
  return metric === "count" ? summary.pitches : summary[metric];
}

function metricFormat(value, metric) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return metricDefinitions[metric].format(value);
}

function uniqueValues(key) {
  return [...new Set(allRows.map((row) => row[key]).filter((value) => value !== undefined && value !== null && value !== ""))];
}

function displayValue(key, value) {
  if (key === "pitch_type") return pitchNameByType.get(String(value)) ? `${value} — ${pitchNameByType.get(String(value))}` : value;
  if (key === "p_throws") return `${value === "R" ? "Right" : "Left"} (${value})`;
  if (key === "stand") return `${value === "R" ? "Right" : "Left"} (${value})`;
  if (key === "pitcher" || key === "batter") return `MLB ID ${value}`;
  return value;
}

function addOptions(selectId, key, firstLabel) {
  const select = document.getElementById(selectId);
  const values = uniqueValues(key).sort((a, b) => {
    if (key === "season" || key === "pitcher" || key === "batter") return Number(a) - Number(b);
    return String(a).localeCompare(String(b));
  });
  select.innerHTML = `<option value="">${firstLabel}</option>`;
  const fragment = document.createDocumentFragment();
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = displayValue(key, value);
    fragment.appendChild(option);
  });
  select.appendChild(fragment);
}

function currentFilters() {
  return Object.fromEntries(filterKeys.map(([id, key]) => [key, document.getElementById(id).value]));
}

function filteredRows() {
  const filters = currentFilters();
  return allRows.filter((row) => filterKeys.every(([, key]) => !filters[key] || String(row[key]) === filters[key]));
}

function groupRows(rows, key) {
  const groups = new Map();
  rows.forEach((row) => {
    const value = row[key];
    if (value === undefined || value === null || value === "") return;
    const groupKey = String(value);
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(row);
  });
  return [...groups.entries()].map(([value, group]) => ({
    value,
    label: displayValue(key, value),
    ...aggregateRows(group),
  }));
}

function sortedGroups(groups, key, metric) {
  if (key === "season" || key === "month") {
    return groups.sort((a, b) => String(a.value).localeCompare(String(b.value), undefined, { numeric: true }));
  }
  return groups.sort((a, b) => (getMetricValue(b, metric) ?? -Infinity) - (getMetricValue(a, metric) ?? -Infinity));
}

function chartOptions(horizontal = false, percentageAxis = false) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? "y" : "x",
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#15283d",
        padding: 12,
        displayColors: false,
        callbacks: { label: (context) => metricFormat(context.raw, document.getElementById("metric-select").value) },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#667085", font: { family: "DM Mono" } } },
      y: { beginAtZero: true, grid: { color: "#e5e9e7" }, ticks: { color: "#667085", font: { family: "DM Mono" }, callback: percentageAxis ? (value) => `${value}%` : undefined } },
    },
  };
}

function replaceChart(name, canvasId, config) {
  if (charts[name]) charts[name].destroy();
  charts[name] = new Chart(document.getElementById(canvasId), config);
}

function updateStats(rows) {
  const summary = aggregateRows(rows);
  document.getElementById("stat-pitches").textContent = formatNumber(rows.length);
  document.getElementById("stat-pitchers").textContent = new Set(rows.map((row) => row.pitcher)).size.toLocaleString("en-US");
  document.getElementById("stat-batters").textContent = new Set(rows.map((row) => row.batter)).size.toLocaleString("en-US");
  document.getElementById("stat-speed").textContent = metricFormat(summary.avg_speed, "avg_speed");
  document.getElementById("stat-exit").textContent = metricFormat(summary.avg_exit_velocity, "avg_exit_velocity");
  document.getElementById("stat-hard-hit").textContent = metricFormat(summary.hard_hit_rate, "hard_hit_rate");
}

function updateComparison(rows, metric, breakdown) {
  const groups = sortedGroups(groupRows(rows, breakdown), breakdown, metric);
  const values = groups.map((group) => getMetricValue(group, metric));
  const percentageAxis = metric === "strike_rate" || metric === "hard_hit_rate";
  const horizontal = groups.length > 12;
  const title = `${metricDefinitions[metric].label} by ${breakdownLabels[breakdown].toLowerCase()}`;
  document.getElementById("comparison-title").textContent = title;
  document.getElementById("table-title").textContent = `Summary by ${breakdownLabels[breakdown].toLowerCase()}`;
  replaceChart("comparison", "comparison-chart", {
    type: "bar",
    data: { labels: groups.map((group) => group.label), datasets: [{ label: metricDefinitions[metric].label, data: values, backgroundColor: REPORT_COLORS[1], borderRadius: 5 }] },
    options: { ...chartOptions(horizontal, percentageAxis), scales: { x: { beginAtZero: horizontal, grid: { display: !horizontal }, ticks: { color: "#667085", maxRotation: 45, minRotation: groups.length > 10 ? 45 : 0, callback: horizontal && percentageAxis ? (value) => `${value * 100}%` : undefined } }, y: { beginAtZero: !horizontal, grid: { color: "#e5e9e7" }, ticks: { color: "#667085", callback: !horizontal && percentageAxis ? (value) => `${value * 100}%` : undefined } } } },
  });
  updateTable(groups, metric);
}

function updateTrend(rows, metric) {
  const groups = sortedGroups(groupRows(rows, "season"), "season", metric);
  const percentageAxis = metric === "strike_rate" || metric === "hard_hit_rate";
  replaceChart("trend", "trend-chart", {
    type: "line",
    data: { labels: groups.map((group) => group.label), datasets: [{ label: metricDefinitions[metric].label, data: groups.map((group) => getMetricValue(group, metric)), borderColor: "#246b9c", backgroundColor: "#246b9c", tension: 0.3 }] },
    options: { ...chartOptions(false, percentageAxis), scales: { x: { grid: { display: false }, ticks: { color: "#667085" } }, y: { beginAtZero: percentageAxis, grid: { color: "#e5e9e7" }, ticks: { color: "#667085", callback: percentageAxis ? (value) => `${value * 100}%` : undefined } } } },
  });
}

function updateMix(rows) {
  const groups = groupRows(rows, "pitch_type").sort((a, b) => b.pitches - a.pitches).slice(0, 8);
  replaceChart("mix", "mix-chart", {
    type: "doughnut",
    data: { labels: groups.map((group) => group.label), datasets: [{ data: groups.map((group) => group.pitches), backgroundColor: REPORT_COLORS, borderWidth: 2, borderColor: "#ffffff" }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: "60%", plugins: { legend: { position: "right", labels: { color: "#667085", boxWidth: 12, font: { family: "Manrope", size: 11 } } }, tooltip: { backgroundColor: "#15283d", padding: 12, displayColors: false, callbacks: { label: (context) => `${formatNumber(context.raw)} pitches` } } } },
  });
}

function updateOutcomes(rows) {
  const counts = new Map();
  rows.filter((row) => row.events).forEach((row) => counts.set(row.events, (counts.get(row.events) || 0) + 1));
  const groups = [...counts.entries()].map(([event, count]) => ({ event, count })).sort((a, b) => b.count - a.count).slice(0, 10).reverse();
  replaceChart("outcomes", "outcomes-chart", {
    type: "bar",
    data: { labels: groups.map((group) => group.event.replaceAll("_", " ")), datasets: [{ label: "Appearances", data: groups.map((group) => group.count), backgroundColor: "#2a8b87", borderRadius: 5 }] },
    options: { ...chartOptions(true), plugins: { legend: { display: false }, tooltip: { backgroundColor: "#15283d", padding: 12, displayColors: false, callbacks: { label: (context) => `${formatNumber(context.raw)} appearances` } } } },
  });
}

function updateTable(groups, metric) {
  const table = document.getElementById("summary-table");
  const rows = groups.slice(0, 20);
  table.innerHTML = rows.length ? rows.map((group) => `<tr><td>${group.label}</td><td>${formatNumber(group.pitches)}</td><td>${metricFormat(group.avg_speed, "avg_speed")}</td><td>${metricFormat(group.avg_exit_velocity, "avg_exit_velocity")}</td><td>${metricFormat(group.strike_rate, "strike_rate")}</td><td>${metricFormat(group.hard_hit_rate, "hard_hit_rate")}</td><td>${formatNumber(group.plate_appearances)}</td></tr>`).join("") : `<tr><td colspan="7">No rows match these filters.</td></tr>`;
  document.getElementById("table-note").textContent = `${groups.length} groups · ${Math.min(groups.length, 20)} shown`;
}

function updateDashboard() {
  const rows = filteredRows();
  const metric = document.getElementById("metric-select").value;
  const breakdown = document.getElementById("breakdown-select").value;
  updateStats(rows);
  updateComparison(rows, metric, breakdown);
  updateTrend(rows, metric);
  updateMix(rows);
  updateOutcomes(rows);
}

function resetFilters() {
  filterKeys.forEach(([id]) => { document.getElementById(id).value = ""; });
  document.getElementById("metric-select").value = "count";
  document.getElementById("breakdown-select").value = "season";
  updateDashboard();
}

function prepareFilters() {
  addOptions("filter-season", "season", "All seasons");
  addOptions("filter-month", "month", "All months");
  addOptions("filter-pitch-type", "pitch_type", "All pitch types");
  addOptions("filter-p-throws", "p_throws", "All pitcher hands");
  addOptions("filter-stand", "stand", "All batter stances");
  addOptions("filter-pitcher", "pitcher", "All pitchers");
  addOptions("filter-batter", "batter", "All batters");
  [...document.querySelectorAll("select")].forEach((select) => select.addEventListener("change", updateDashboard));
  document.getElementById("reset-filters").addEventListener("click", resetFilters);
}

function loadDashboardData() {
  Papa.parse("data/mlb_statcast_2021_2025.csv", {
    download: true,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    worker: true,
    complete: (results) => {
      results.data.forEach((row) => {
        if (!row.game_date || row.pitcher === null || row.batter === null) return;
        allRows.push(row);
        if (row.pitch_type && row.pitch_name) pitchNameByType.set(String(row.pitch_type), row.pitch_name);
      });
      prepareFilters();
      document.getElementById("loading-status").textContent = `${formatNumber(allRows.length)} rows loaded · calculations are live`;
      document.getElementById("loading-status").classList.add("ready");
      updateDashboard();
    },
    error: (error) => {
      console.error(error);
      const status = document.getElementById("loading-status");
      status.textContent = "The data could not be loaded. Open this page through GitHub Pages or a local web server.";
      status.classList.add("error");
    },
  });
}

document.addEventListener("DOMContentLoaded", loadDashboardData);
