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
const REPORT_COLORS = ["#246b9c", "#d7473f", "#7fa8c9", "#a52f32", "#d9e8f3", "#eeaaa6", "#173d5b", "#e36f68"];
const DATA_FILES = [
  "data/months/mlb_statcast_2025_04.csv",
  "data/months/mlb_statcast_2025_05.csv",
  "data/months/mlb_statcast_2025_06.csv",
  "data/months/mlb_statcast_2025_07.csv",
  "data/months/mlb_statcast_2025_08.csv",
];
const allRows = [];
const charts = {};
const pitchNameByType = new Map();
const playerNames = new Map();
const playerTeams = new Map();
const TEAM_COLORS = {
  AZ: "#a71930", ATL: "#ce1141", BAL: "#df4601", BOS: "#bd3039", CHC: "#0e3386", CWS: "#27251f", CIN: "#c6011f", CLE: "#00385d", COL: "#333366", DET: "#0c2340", HOU: "#002d62", KC: "#004687", LAA: "#ba0021", LAD: "#005a9c", MIA: "#00a3e0", MIL: "#12284b", MIN: "#002b5c", NYM: "#002d72", NYY: "#0c2340", OAK: "#003831", PHI: "#e81828", PIT: "#fdb827", SD: "#2f241d", SEA: "#0c2c56", SF: "#fd5a1e", STL: "#c41e3a", TB: "#092c5c", TEX: "#003278", TOR: "#134a8e", WAS: "#ab0003",
};

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
  pitches: { label: "Pitch count", shortLabel: "Pitches", format: (value) => formatNumber(value) },
  avg_speed: { label: "Average pitch speed", shortLabel: "Avg speed", format: (value) => `${value.toFixed(2)} mph` },
  avg_exit_velocity: { label: "Average exit velocity", shortLabel: "Avg exit velocity", format: (value) => `${value.toFixed(2)} mph` },
  strike_rate: { label: "Strike rate", shortLabel: "Strike rate", format: (value) => `${(value * 100).toFixed(1)}%` },
  hard_hit_rate: { label: "Hard-hit rate", shortLabel: "Hard-hit rate", format: (value) => `${(value * 100).toFixed(1)}%` },
};

function formatNumber(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat("en-US").format(Math.round(value)) : "—";
}

function themeColor(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function updateChartTheme() {
  const text = themeColor("--chart-text", "#667085");
  const grid = themeColor("--chart-grid", "#e5e9e7");
  const tooltip = themeColor("--chart-tooltip", "#15283d");
  Object.values(charts).forEach((chart) => {
    if (!chart) return;
    Object.values(chart.options.scales || {}).forEach((scale) => {
      if (scale.ticks) scale.ticks.color = text;
      if (scale.grid) scale.grid.color = grid;
    });
    if (chart.options.plugins?.legend?.labels) chart.options.plugins.legend.labels.color = text;
    if (chart.options.plugins?.tooltip) chart.options.plugins.tooltip.backgroundColor = tooltip;
    chart.update("none");
  });
}

window.addEventListener("themechange", updateChartTheme);

function isFiniteNumber(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

function mean(rows, key) {
  const values = rows.filter((row) => isFiniteNumber(row[key])).map((row) => Number(row[key]));
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
  return row.description === "hit_into_play" && isFiniteNumber(row.launch_speed);
}

function aggregateRows(rows) {
  const battedBallRows = rows.filter(isBattedBall);
  return {
    pitches: rows.length,
    avg_speed: mean(rows, "release_speed"),
    avg_exit_velocity: mean(battedBallRows, "launch_speed"),
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
  if (key === "pitcher" || key === "batter") return playerNames.get(String(value)) || `MLB ID ${value}`;
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

function filterPlayerOptions(selectId, query) {
  const select = document.getElementById(selectId);
  const normalizedQuery = query.trim().toLowerCase();
  [...select.options].forEach((option, index) => {
    if (index === 0) {
      option.hidden = false;
      return;
    }
    option.hidden = normalizedQuery && !option.textContent.toLowerCase().includes(normalizedQuery);
  });
}

function recordPlayerTeam(role, playerId, team) {
  if (!playerId || !team) return;
  const key = `${role}:${playerId}`;
  if (!playerTeams.has(key)) playerTeams.set(key, new Map());
  const counts = playerTeams.get(key);
  counts.set(team, (counts.get(team) || 0) + 1);
}

function getPlayerTeam(role, playerId) {
  const counts = playerTeams.get(`${role}:${playerId}`);
  if (!counts) return "";
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function playerTeamForRow(row, role) {
  if (row.inning_topbot === "Top") return role === "batter" ? row.away_team : row.home_team;
  if (row.inning_topbot === "Bot" || row.inning_topbot === "Bottom") return role === "batter" ? row.home_team : row.away_team;
  return "";
}

let playerModalRequest = 0;

function renderTeamBadge(teamInfo) {
  const teamBadge = document.getElementById("player-modal-team");
  const teamMark = document.getElementById("player-modal-team-mark");
  const teamLogo = document.getElementById("player-modal-team-logo");
  const teamName = document.getElementById("player-modal-team-name");
  const abbreviation = teamInfo?.abbreviation || "";
  teamBadge.hidden = !teamInfo;
  teamName.textContent = teamInfo?.name || "Team unavailable";
  teamMark.textContent = abbreviation || "MLB";
  teamMark.style.backgroundColor = TEAM_COLORS[abbreviation] || "#246b9c";
  teamMark.hidden = Boolean(teamInfo?.id);
  teamLogo.hidden = !teamInfo?.id;
  teamLogo.alt = teamInfo?.name ? `${teamInfo.name} logo` : "";
  if (teamInfo?.id) {
    teamLogo.onerror = () => { teamLogo.hidden = true; teamMark.hidden = false; };
    teamLogo.src = `https://www.mlbstatic.com/team-logos/${teamInfo.id}.svg`;
  }
}

async function fetchPlayerTeamInfo(playerId) {
  try {
    const response = await fetch(`https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=currentTeam`, { cache: "no-store" });
    if (!response.ok) return null;
    const player = (await response.json()).people?.[0];
    const team = player?.currentTeam;
    return team ? { id: team.id, abbreviation: team.abbreviation, name: team.name } : null;
  } catch (error) {
    return null;
  }
}

function closePlayerModal() {
  const modal = document.getElementById("player-modal");
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
}

async function showPlayerModal(key, value) {
  if (!value) return;
  const requestId = ++playerModalRequest;
  const modal = document.getElementById("player-modal");
  const image = document.getElementById("player-modal-image");
  const placeholder = document.getElementById("player-modal-placeholder");
  const name = playerNames.get(String(value)) || `MLB ID ${value}`;
  const role = key === "pitcher" ? "Selected pitcher" : "Selected batter";
  const team = getPlayerTeam(key, value);

  document.getElementById("player-modal-role").textContent = role;
  document.getElementById("player-modal-name").textContent = name;
  document.getElementById("player-modal-id").textContent = `MLB ID ${value}`;
  renderTeamBadge(team ? { abbreviation: team, name: team } : null);
  image.alt = `${name} headshot`;
  image.hidden = false;
  placeholder.hidden = true;
  image.onerror = () => {
    image.hidden = true;
    placeholder.hidden = false;
  };
  image.src = `https://img.mlbstatic.com/mlb-photos/image/upload/w_320,q_auto:good/v1/people/${value}/headshot/67/current.png`;
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.getElementById("close-player-modal").focus();
  if (!team) {
    const teamInfo = await fetchPlayerTeamInfo(value);
    if (requestId === playerModalRequest && teamInfo) renderTeamBadge(teamInfo);
  }
}

function currentFilters() {
  return Object.fromEntries(filterKeys.map(([id, key]) => [key, document.getElementById(id).value]));
}

function comparisonRows() {
  const filters = currentFilters();
  return allRows.filter((row) => filterKeys.every(([, key]) => key === "pitcher" || key === "batter" || !filters[key] || String(row[key]) === filters[key]));
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

function populateComparisonPlayers() {
  const role = document.getElementById("compare-role").value;
  const values = uniqueValues(role).sort((a, b) => Number(a) - Number(b));
  ["compare-player-a", "compare-player-b"].forEach((selectId) => {
    const select = document.getElementById(selectId);
    const previous = select.value;
    select.innerHTML = '<option value="">Choose a player</option>';
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = displayValue(role, value);
      select.appendChild(option);
    });
    if (values.includes(previous)) select.value = previous;
  });
  const playerA = document.getElementById("compare-player-a");
  const playerB = document.getElementById("compare-player-b");
  if (!playerA.value && values[0]) playerA.value = values[0];
  if (!playerB.value && values[1]) playerB.value = values[1];
  updatePlayerComparison();
}

function updatePlayerComparison() {
  const role = document.getElementById("compare-role").value;
  const playerA = document.getElementById("compare-player-a").value;
  const playerB = document.getElementById("compare-player-b").value;
  const metric = document.getElementById("compare-metric").value;
  const summaryText = document.getElementById("compare-summary");
  if (!playerA || !playerB) {
    summaryText.textContent = "Choose two players to compare their filtered pitch-level numbers.";
    if (charts["player-comparison"]) {
      charts["player-comparison"].destroy();
      delete charts["player-comparison"];
    }
    return;
  }

  const rows = comparisonRows();
  const summaryA = aggregateRows(rows.filter((row) => String(row[role]) === playerA));
  const summaryB = aggregateRows(rows.filter((row) => String(row[role]) === playerB));
  const nameA = displayValue(role, playerA);
  const nameB = displayValue(role, playerB);
  const formatMetric = metric === "pitches" ? "pitches" : metric;
  const valueA = getMetricValue(summaryA, metric);
  const valueB = getMetricValue(summaryB, metric);
  summaryText.textContent = `${nameA}: ${metricFormat(valueA, formatMetric)}  ·  ${nameB}: ${metricFormat(valueB, formatMetric)}`;
  const percentage = metric === "strike_rate" || metric === "hard_hit_rate";
  replaceChart("player-comparison", "player-comparison-chart", {
    type: "bar",
    data: { labels: [nameA, nameB], datasets: [{ label: metricDefinitions[metric].label, data: [valueA, valueB], backgroundColor: [REPORT_COLORS[0], REPORT_COLORS[1]], borderRadius: 7, barThickness: 42 }] },
    options: {
      ...chartOptions(false, false),
      plugins: { legend: { display: false }, tooltip: { backgroundColor: "#15283d", padding: 12, displayColors: false, callbacks: { label: (context) => metricFormat(context.raw, formatMetric) } } },
      scales: { x: { grid: { display: false }, ticks: { color: "#667085", font: { family: "DM Mono" } } }, y: { beginAtZero: true, grid: { color: "#e5e9e7" }, ticks: { color: "#667085", callback: percentage ? (value) => `${(value * 100).toFixed(0)}%` : undefined } } },
    },
  });
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
  const groups = sortedGroups(groupRows(rows, "month"), "month", metric);
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
    data: { labels: groups.map((group) => group.event.replaceAll("_", " ")), datasets: [{ label: "Appearances", data: groups.map((group) => group.count), backgroundColor: "#246b9c", borderRadius: 5 }] },
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
  updatePlayerComparison();
  updateChartTheme();
}

function resetFilters() {
  filterKeys.forEach(([id]) => { document.getElementById(id).value = ""; });
  document.getElementById("search-pitcher").value = "";
  document.getElementById("search-batter").value = "";
  filterPlayerOptions("filter-pitcher", "");
  filterPlayerOptions("filter-batter", "");
  document.getElementById("metric-select").value = "count";
  document.getElementById("breakdown-select").value = "month";
  document.getElementById("compare-role").value = "pitcher";
  populateComparisonPlayers();
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
  populateComparisonPlayers();
  [...document.querySelectorAll("select")].forEach((select) => select.addEventListener("change", updateDashboard));
  document.getElementById("reset-filters").addEventListener("click", resetFilters);
  document.getElementById("search-pitcher").addEventListener("input", (event) => filterPlayerOptions("filter-pitcher", event.target.value));
  document.getElementById("search-batter").addEventListener("input", (event) => filterPlayerOptions("filter-batter", event.target.value));
  document.getElementById("compare-role").addEventListener("change", populateComparisonPlayers);
  document.getElementById("filter-pitcher").addEventListener("change", (event) => showPlayerModal("pitcher", event.target.value));
  document.getElementById("filter-batter").addEventListener("change", (event) => showPlayerModal("batter", event.target.value));
  document.getElementById("close-player-modal").addEventListener("click", closePlayerModal);
  document.querySelector("[data-close-player-modal]").addEventListener("click", closePlayerModal);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePlayerModal();
  });
}

async function loadDashboardData() {
  const status = document.getElementById("loading-status");
  try {
    try {
      const namesResponse = await fetch("data/player_names.json?v=2", { cache: "no-store" });
      if (namesResponse.ok) {
        const names = await namesResponse.json();
        Object.entries(names).forEach(([playerId, name]) => playerNames.set(playerId, name));
      }
    } catch (error) {
      console.warn("Player names could not be loaded; MLB IDs will be shown.", error);
    }

    if (typeof Papa === "undefined") throw new Error("Papa Parse did not load");
    for (let index = 0; index < DATA_FILES.length; index += 1) {
      const response = await fetch(`${DATA_FILES[index]}?v=4`, { cache: "no-store" });
      if (!response.ok) throw new Error(`CSV request failed (${response.status})`);
      status.textContent = `Loading month ${index + 1} of ${DATA_FILES.length}…`;
      const csvText = await response.text();
      const results = Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
      });
      if (results.errors.length) console.warn("CSV parsing warnings:", results.errors.slice(0, 3));
      results.data.forEach((row) => {
        if (!row.game_date || row.pitcher === null || row.batter === null) return;
        const normalizedRow = {
          game_date: row.game_date,
          season: row.season,
          month: row.month,
          pitcher: row.pitcher,
          batter: row.batter,
          pitch_type: row.pitch_type,
          pitch_name: row.pitch_name,
          description: row.description,
          events: row.events,
          p_throws: row.p_throws,
          stand: row.stand,
          home_team: row.home_team,
          away_team: row.away_team,
          inning_topbot: row.inning_topbot,
          release_speed: row.release_speed,
          launch_speed: row.launch_speed,
        };
        allRows.push(normalizedRow);
        recordPlayerTeam("pitcher", normalizedRow.pitcher, playerTeamForRow(normalizedRow, "pitcher"));
        recordPlayerTeam("batter", normalizedRow.batter, playerTeamForRow(normalizedRow, "batter"));
        if (row.pitch_type && row.pitch_name) pitchNameByType.set(String(row.pitch_type), row.pitch_name);
      });
    }
    if (!allRows.length) throw new Error("The CSV loaded but contained no usable rows");
    prepareFilters();
    status.textContent = `${formatNumber(allRows.length)} rows loaded · calculations are live`;
    status.classList.add("ready");
    document.getElementById("dashboard-content").classList.remove("is-loading");
    updateDashboard();
  } catch (error) {
    console.error(error);
    status.textContent = "The dashboard data could not be loaded. Please refresh the GitHub Pages site.";
    status.classList.add("error");
    document.getElementById("dashboard-content").classList.remove("is-loading");
  }
}

document.addEventListener("DOMContentLoaded", loadDashboardData);
