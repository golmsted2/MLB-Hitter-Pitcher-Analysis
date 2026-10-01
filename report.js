const REPORT_COLORS = {
  navy: "#15283d",
  blue: "#246b9c",
  red: "#d7473f",
  pale: "#b9cde0",
  redPale: "#f2b4b0",
  grid: "#e5e9e7",
  text: "#667085",
};

const reportCharts = {};

const numberFormat = new Intl.NumberFormat("en-US");

function shadeColor(color, amount = -0.22) {
  if (!color || !color.startsWith("#")) return color || REPORT_COLORS.navy;
  const hex = color.length === 4 ? color.slice(1).split("").map((value) => value + value).join("") : color.slice(1);
  const channels = [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const shaded = channels.map((channel) => Math.max(0, Math.min(255, Math.round(channel + 255 * amount))));
  return `#${shaded.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

const reportDepthPlugin = {
  id: "reportDepth",
  beforeDatasetDraw(chart, args) {
    if (args.meta.type !== "bar") return;
    const dataset = chart.data.datasets[args.index];
    const { ctx } = chart;
    const depth = 6;
    ctx.save();
    args.meta.data.forEach((element, index) => {
      const props = element.getProps(["x", "y", "base", "width", "height"], true);
      const rawColor = Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[index] : dataset.backgroundColor;
      ctx.fillStyle = shadeColor(rawColor, -0.24);
      ctx.beginPath();
      if (chart.options.indexAxis === "y") {
        const left = Math.min(props.x, props.base);
        const right = Math.max(props.x, props.base);
        const top = props.y - props.height / 2;
        const bottom = props.y + props.height / 2;
        ctx.moveTo(left, bottom);
        ctx.lineTo(right, bottom);
        ctx.lineTo(right + depth, bottom - depth);
        ctx.lineTo(left + depth, bottom - depth);
      } else {
        const left = props.x - props.width / 2;
        const right = props.x + props.width / 2;
        const top = Math.min(props.y, props.base);
        const bottom = Math.max(props.y, props.base);
        ctx.moveTo(right, top);
        ctx.lineTo(right + depth, top - depth);
        ctx.lineTo(right + depth, bottom - depth);
        ctx.lineTo(right, bottom);
      }
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  },
  afterDatasetDraw(chart, args) {
    if (args.meta.type !== "line") return;
    const dataset = chart.data.datasets[args.index];
    const line = args.meta.dataset;
    if (!line) return;
    const { ctx } = chart;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.shadowColor = dataset.borderColor;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 7;
    line.draw(ctx);
    ctx.restore();
  },
};

function formatNumber(value) {
  return numberFormat.format(Math.round(value));
}

function formatPercent(value, decimals = 1) {
  return `${(value * 100).toFixed(decimals)}%`;
}

function chartOptions({ horizontal = false, percentage = false } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? "y" : "x",
    animation: { duration: 750, easing: "easeOutQuart" },
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: REPORT_COLORS.navy,
        borderColor: "rgba(255,255,255,0.18)",
        borderWidth: 1,
        cornerRadius: 10,
        padding: 13,
        displayColors: false,
        titleFont: { family: "Manrope", size: 12, weight: "700" },
        bodyFont: { family: "DM Mono", size: 11 },
        callbacks: percentage ? { label: (context) => `${context.dataset.label}: ${context.raw.toFixed(1)}%` } : {},
      },
    },
    scales: {
      x: { grid: { color: REPORT_COLORS.grid, borderDash: [4, 5], drawBorder: false }, ticks: { color: REPORT_COLORS.text, font: { family: "DM Mono" }, padding: 7 } },
      y: {
        beginAtZero: true,
        grid: { color: REPORT_COLORS.grid, borderDash: [4, 5], drawBorder: false },
        ticks: {
          color: REPORT_COLORS.text,
          font: { family: "DM Mono" },
          padding: 7,
          callback: percentage ? (value) => `${value}%` : undefined,
        },
      },
    },
  };
}

function makeChart(id, config) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  return new Chart(canvas, { ...config, plugins: [...(config.plugins || []), reportDepthPlugin] });
}

function themeColor(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function updateReportChartTheme() {
  const text = themeColor("--chart-text", REPORT_COLORS.text);
  const grid = themeColor("--chart-grid", REPORT_COLORS.grid);
  const tooltip = themeColor("--chart-tooltip", REPORT_COLORS.navy);
  Object.values(reportCharts).forEach((chart) => {
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

window.addEventListener("themechange", updateReportChartTheme);

function setText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

function formatMonthLabel(value) {
  const [year, month] = value.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function weightedAverage(rows, valueKey, weightKey) {
  const totalWeight = rows.reduce((sum, row) => sum + row[weightKey], 0);
  if (!totalWeight) return 0;
  return rows.reduce((sum, row) => sum + row[valueKey] * row[weightKey], 0) / totalWeight;
}

function renderExplorer(data) {
  const select = document.getElementById("month-focus-select");
  const clearButton = document.getElementById("clear-month-focus");
  const months = data.month_summary;
  if (!select || !clearButton || !months.length) return;

   select.innerHTML = '<option value="">All months</option>';
  months.forEach((row) => {
    const option = document.createElement("option");
    option.value = row.month;
    option.textContent = formatMonthLabel(row.month);
    select.appendChild(option);
  });

  const allMonths = {
    month: "",
    pitches: data.headline.pitches,
    avg_speed: data.headline.avg_speed,
    avg_exit_velocity: weightedAverage(months, "avg_exit_velocity", "batted_balls"),
    hard_hit_rate: data.headline.hard_hit_rate / 100,
  };

  function updateExplorer(value = "") {
    const selected = months.find((row) => row.month === value) || allMonths;
    const selectedIndex = value ? months.findIndex((row) => row.month === value) : -1;
    const label = value ? formatMonthLabel(value) : "all months";
    document.querySelectorAll("[data-explorer-stat]").forEach((element) => {
      const key = element.dataset.explorerStat;
      if (key === "pitches") element.textContent = formatNumber(selected.pitches);
      if (key === "avg_speed") element.textContent = `${selected.avg_speed.toFixed(2)} mph`;
      if (key === "avg_exit_velocity") element.textContent = `${selected.avg_exit_velocity.toFixed(2)} mph`;
      if (key === "hard_hit_rate") element.textContent = formatPercent(selected.hard_hit_rate);
    });
    setText(
      "explorer-summary",
      value
        ? `${label} contains ${formatNumber(selected.pitches)} pitches. The charts below use the red highlight to mark this month while the snapshot tracks its speed and contact metrics.`
       : `The snapshot combines all ${months.length} monthly samples across ${data.headline.seasons} seasons. Choose a month to highlight it in the monthly charts and compare its speed and contact metrics.`,
    );

    if (reportCharts.volume) {
      reportCharts.volume.data.datasets[0].backgroundColor = months.map((_, index) => index === selectedIndex ? REPORT_COLORS.red : REPORT_COLORS.blue);
      reportCharts.volume.update();
    }
    if (reportCharts.metrics) {
      reportCharts.metrics.data.datasets[0].pointBackgroundColor = months.map((_, index) => index === selectedIndex ? REPORT_COLORS.red : REPORT_COLORS.blue);
      reportCharts.metrics.data.datasets[1].pointBackgroundColor = months.map((_, index) => index === selectedIndex ? REPORT_COLORS.navy : REPORT_COLORS.red);
      reportCharts.metrics.data.datasets.forEach((dataset) => { dataset.pointRadius = months.map((_, index) => index === selectedIndex ? 6 : 3); });
      reportCharts.metrics.update();
    }
  }

  select.addEventListener("change", (event) => updateExplorer(event.target.value));
  clearButton.addEventListener("click", () => {
    select.value = "";
    updateExplorer();
  });
  updateExplorer();
}

function setupFindingNavigation() {
  const links = [...document.querySelectorAll("[data-report-jump]")];
  const sections = links.map((link) => document.getElementById(link.dataset.reportJump)).filter(Boolean);
  const setActive = (id) => links.forEach((link) => link.classList.toggle("active", link.dataset.reportJump === id));
  links.forEach((link) => link.addEventListener("click", () => setActive(link.dataset.reportJump)));
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin: "-18% 0px -62% 0px", threshold: [0, 0.25, 0.6] });
    sections.forEach((section) => observer.observe(section));
  }
}

function setupReportControls() {
  const progressBar = document.getElementById("reading-progress-bar");
  const backToTop = document.getElementById("back-to-top");
  const updateProgress = () => {
    if (progressBar) {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) * 100 : 100;
      progressBar.style.width = `${progress}%`;
    }
    if (backToTop) backToTop.classList.toggle("visible", window.scrollY > 650);
  };
  window.addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();
  if (backToTop) backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

function renderHeadline(data) {
  const headline = data.headline;
  document.querySelectorAll("[data-headline]").forEach((element) => {
    const key = element.dataset.headline;
    const value = headline[key];
    if (key === "avg_speed") element.textContent = `${value.toFixed(2)} mph`;
    else if (key === "hard_hit_rate") element.textContent = `${value.toFixed(1)}%`;
    else element.textContent = formatNumber(value);
  });

  setText(
    "hero-summary",
     `This report examines ${formatNumber(headline.pitches)} pitch events from ${headline.months} monthly samples across the ${headline.first_season}–${headline.last_season} regular seasons, asking how pitch selection, velocity, handedness, and batted-ball outcomes connect.`,
  );
}

function renderNarrative(data) {
  const h = data.headline;
  const months = data.month_summary;
  const mix = data.pitch_mix;
  const speed = data.speed_by_pitch;
  const hands = data.handedness;
  const outcomes = data.outcomes;
  const topPitcher = data.top_pitchers[0];
  const topBatter = data.top_batters[0];
  const topPitcherName = topPitcher.player_name || `MLB ID ${topPitcher.pitcher}`;
  const topBatterName = topBatter.player_name || `MLB ID ${topBatter.batter}`;
  const largestHandGroup = [...hands].sort((a, b) => b.pitches - a.pitches)[0];
  const topThreeShare = mix.slice(0, 3).reduce((sum, row) => sum + row.share, 0);
  const fastest = speed[0];
  const slowest = speed[speed.length - 1];
  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const fieldOut = outcomes.find((row) => row.event === "field_out") || outcomes[0];
  const strikeout = outcomes.find((row) => row.event === "strikeout");

  setText(
    "scale-copy",
     `The file contains ${formatNumber(h.pitches)} pitches from ${formatNumber(h.pitchers)} pitchers and ${formatNumber(h.batters)} batters. It uses ${h.months} comparable monthly samples across the ${h.first_season}–${h.last_season} regular seasons while preserving the event-level detail needed to study individual matchups.`,
  );
  setText(
    "mix-copy",
    `${mix[0].pitch_name} is the most common pitch, with ${formatNumber(mix[0].pitches)} observations (${mix[0].share.toFixed(1)}% of the file). The top three pitch types—${mix[0].pitch_name}, ${mix[1].pitch_name}, and ${mix[2].pitch_name}—make up ${topThreeShare.toFixed(1)}% of all recorded pitches.`,
  );
  setText(
    "speed-copy",
    `Among pitch types with at least 1,000 observations, ${fastest.pitch_name} averages ${fastest.avg_speed.toFixed(2)} mph, while ${slowest.pitch_name} averages ${slowest.avg_speed.toFixed(2)} mph. That ${(
      fastest.avg_speed - slowest.avg_speed
    ).toFixed(2)}-mph spread is the clearest reminder that “pitch speed” is not one baseball variable—it depends on what the pitcher throws.`,
  );
  setText(
    "season-copy",
    `Average pitch speed moved from ${firstMonth.avg_speed.toFixed(2)} mph in ${firstMonth.month} to ${lastMonth.avg_speed.toFixed(2)} mph in ${lastMonth.month}, a ${(lastMonth.avg_speed - firstMonth.avg_speed).toFixed(2)}-mph change. Over the same comparison, hard-hit rate moved from ${formatPercent(firstMonth.hard_hit_rate)} to ${formatPercent(lastMonth.hard_hit_rate)} among tracked batted balls.`,
  );
  setText(
    "handedness-copy",
    `The largest cell is right-handed pitchers against right-handed hitters: ${formatNumber(largestHandGroup.pitches)} pitches, or ${(largestHandGroup.pitches / h.pitches * 100).toFixed(1)}% of the file. Left-handed pitchers produced a ${formatPercent(hands.find((row) => row.p_throws === "L" && row.stand === "L").strike_rate)} strike rate against left-handed hitters in this sample.`,
  );
  setText(
    "outcomes-copy",
    `There are ${formatNumber(h.plate_appearances)} completed plate appearances in the file. The most common recorded result is ${fieldOut.event.replaceAll("_", " ")} (${formatNumber(fieldOut.count)}), followed by ${strikeout ? `${strikeout.event} (${formatNumber(strikeout.count)})` : "strikeouts"}. Across all completed appearances, the data contains ${formatNumber(h.hits)} hits and ${formatNumber(h.home_runs)} home runs.`,
  );
  setText(
    "pitchers-copy",
     `${topPitcherName} threw the most pitches in this sample: ${formatNumber(topPitcher.pitches)}, or ${(topPitcher.pitches / h.pitches * 100).toFixed(1)}% of all rows. The top ten pitchers are useful for volume comparisons across ${h.first_season}–${h.last_season}, but pitch count is exposure—not a direct measure of pitching quality.`,
  );
  setText(
    "batters-copy",
    `Among batters with at least 100 completed plate appearances, the highest observed hit rate belongs to ${topBatterName}: ${formatPercent(topBatter.hit_rate)} over ${formatNumber(topBatter.plate_appearances)} appearances. That threshold reduces—but does not eliminate—the small-sample problem, so the dashboard should be used to inspect the denominator before drawing conclusions.`,
  );

  setText(
    "definitions-copy",
    `${data.definitions.hit_rate}. ${data.definitions.strike_rate}. ${data.definitions.hard_hit_rate}. ${data.definitions.home_run_rate}. Averages use the non-missing values of the relevant numeric column.`,
  );

  const busiestMonth = months.reduce((best, row) => row.pitches > best.pitches ? row : best, months[0]);
  const highestHardHitMonth = months.reduce((best, row) => row.hard_hit_rate > best.hard_hit_rate ? row : best, months[0]);
  const topOutcome = [...outcomes].sort((a, b) => b.count - a.count)[0];
  setText("scale-insight", `Highest volume: ${formatMonthLabel(busiestMonth.month)} with ${formatNumber(busiestMonth.pitches)} pitches.`);
  setText("mix-insight", `Most common pitch: ${mix[0].pitch_name}, accounting for ${mix[0].share.toFixed(1)}% of ${formatNumber(h.pitches)} pitches (${formatNumber(mix[0].pitches)} observations).`);
  setText("speed-insight", `Fastest qualifying pitch: ${fastest.pitch_name} at ${fastest.avg_speed.toFixed(2)} mph on average (${formatNumber(fastest.pitches)} non-missing speed observations).`);
  setText("season-insight", `Highest hard-hit month: ${formatMonthLabel(highestHardHitMonth.month)} at ${formatPercent(highestHardHitMonth.hard_hit_rate)} of ${formatNumber(highestHardHitMonth.batted_balls)} tracked balls in play.`);
  setText("handedness-insight", `Largest matchup cell: P${largestHandGroup.p_throws} / B${largestHandGroup.stand} with ${formatNumber(largestHandGroup.pitches)} pitches.`);
  setText("outcomes-insight", `Most common recorded outcome: ${topOutcome.event.replaceAll("_", " ")} (${formatNumber(topOutcome.count)} completed appearances).`);
  setText("pitchers-insight", `Volume leader: ${topPitcherName} with ${formatNumber(topPitcher.pitches)} pitches across the ${h.first_season}–${h.last_season} window.`);
  setText("batters-insight", `Highest qualifying hit rate: ${topBatterName} at ${formatPercent(topBatter.hit_rate)} across ${formatNumber(topBatter.plate_appearances)} plate appearances.`);
}

function renderCharts(data) {
  const mix = data.pitch_mix;
  const speed = [...data.speed_by_pitch].reverse();
  const months = data.month_summary;
  const hands = data.handedness;
  const outcomes = data.outcomes.slice(0, 8).reverse();
  const pitchers = [...data.top_pitchers].reverse();
  const batters = [...data.top_batters].reverse();

  reportCharts.volume = makeChart("season-volume-chart", {
    type: "bar",
    data: { labels: months.map((row) => row.month), datasets: [{ label: "Pitches", data: months.map((row) => row.pitches), backgroundColor: months.map((_, index) => index % 2 ? REPORT_COLORS.blue : REPORT_COLORS.pale), borderColor: shadeColor(REPORT_COLORS.blue, -0.2), borderWidth: 1, borderRadius: 8, borderSkipped: false, hoverBackgroundColor: REPORT_COLORS.red }] },
    options: chartOptions(),
  });

  reportCharts.mix = makeChart("pitch-mix-chart", {
    type: "bar",
    data: { labels: mix.map((row) => row.pitch_name), datasets: [{ label: "Share of pitches", data: mix.map((row) => row.share), backgroundColor: mix.map((_, index) => index % 2 ? REPORT_COLORS.red : REPORT_COLORS.redPale), borderColor: shadeColor(REPORT_COLORS.red, -0.2), borderWidth: 1, borderRadius: 8, borderSkipped: false, hoverBackgroundColor: REPORT_COLORS.navy }] },
    options: { ...chartOptions({ horizontal: true, percentage: true }), scales: { x: { beginAtZero: true, max: 36, grid: { color: REPORT_COLORS.grid }, ticks: { color: REPORT_COLORS.text, callback: (value) => `${value}%` } }, y: { grid: { display: false }, ticks: { color: REPORT_COLORS.text, font: { family: "DM Mono" } } } } },
  });

  reportCharts.speed = makeChart("pitch-speed-chart", {
    type: "bar",
    data: { labels: speed.map((row) => row.pitch_name), datasets: [{ label: "Average speed", data: speed.map((row) => row.avg_speed), backgroundColor: speed.map((_, index) => index % 2 ? REPORT_COLORS.blue : REPORT_COLORS.pale), borderColor: shadeColor(REPORT_COLORS.blue, -0.2), borderWidth: 1, borderRadius: 8, borderSkipped: false, hoverBackgroundColor: REPORT_COLORS.red }] },
    options: { ...chartOptions({ horizontal: true }), scales: { x: { beginAtZero: true, suggestedMax: 100, grid: { color: REPORT_COLORS.grid }, ticks: { color: REPORT_COLORS.text, callback: (value) => `${value} mph` } }, y: { grid: { display: false }, ticks: { color: REPORT_COLORS.text } } } },
  });

  reportCharts.metrics = makeChart("season-metrics-chart", {
    type: "line",
    data: { labels: months.map((row) => row.month), datasets: [
      { label: "Average pitch speed", data: months.map((row) => row.avg_speed), borderColor: REPORT_COLORS.blue, backgroundColor: "rgba(36,107,156,0.14)", fill: "origin", borderWidth: 3, pointRadius: 3, pointHoverRadius: 7, pointBorderWidth: 2, pointBorderColor: "#fff", tension: 0.3, yAxisID: "y" },
      { label: "Average exit velocity", data: months.map((row) => row.avg_exit_velocity), borderColor: REPORT_COLORS.red, backgroundColor: "rgba(215,71,63,0.14)", fill: "origin", borderWidth: 3, pointRadius: 3, pointHoverRadius: 7, pointBorderWidth: 2, pointBorderColor: "#fff", tension: 0.3, yAxisID: "y1" },
    ] },
    options: { ...chartOptions(), plugins: { legend: { display: true, labels: { usePointStyle: true, color: REPORT_COLORS.text } } }, scales: { x: { grid: { display: false }, ticks: { color: REPORT_COLORS.text } }, y: { position: "left", grid: { color: REPORT_COLORS.grid }, ticks: { color: REPORT_COLORS.blue } }, y1: { position: "right", grid: { drawOnChartArea: false }, ticks: { color: REPORT_COLORS.red } } } },
  });

  const handLabels = hands.map((row) => `P${row.p_throws} / B${row.stand}`);
  reportCharts.handedness = makeChart("handedness-chart", {
    type: "bar",
    data: { labels: handLabels, datasets: [{ label: "Pitches", data: hands.map((row) => row.pitches), backgroundColor: [REPORT_COLORS.pale, REPORT_COLORS.redPale, REPORT_COLORS.blue, REPORT_COLORS.red], borderColor: REPORT_COLORS.navy, borderWidth: 1, borderRadius: 8, borderSkipped: false, hoverBackgroundColor: REPORT_COLORS.red }] },
    options: chartOptions(),
  });

  reportCharts.outcomes = makeChart("outcomes-chart", {
    type: "bar",
    data: { labels: outcomes.map((row) => row.event.replaceAll("_", " ")), datasets: [{ label: "Completed appearances", data: outcomes.map((row) => row.count), backgroundColor: outcomes.map((_, index) => index % 2 ? REPORT_COLORS.blue : REPORT_COLORS.pale), borderColor: shadeColor(REPORT_COLORS.blue, -0.2), borderWidth: 1, borderRadius: 8, borderSkipped: false, hoverBackgroundColor: REPORT_COLORS.red }] },
    options: chartOptions({ horizontal: true }),
  });

  reportCharts.pitchers = makeChart("top-pitchers-chart", {
    type: "bar",
    data: { labels: pitchers.map((row) => row.player_name || `MLB ID ${row.pitcher}`), datasets: [{ label: "Pitches", data: pitchers.map((row) => row.pitches), backgroundColor: pitchers.map((_, index) => index % 2 ? REPORT_COLORS.navy : REPORT_COLORS.blue), borderColor: REPORT_COLORS.navy, borderWidth: 1, borderRadius: 8, borderSkipped: false, hoverBackgroundColor: REPORT_COLORS.red }] },
    options: chartOptions({ horizontal: true }),
  });

  reportCharts.batters = makeChart("top-batters-chart", {
    type: "bar",
    data: { labels: batters.map((row) => row.player_name || `MLB ID ${row.batter}`), datasets: [{ label: "Hit rate", data: batters.map((row) => row.hit_rate * 100), backgroundColor: batters.map((_, index) => index % 2 ? REPORT_COLORS.red : REPORT_COLORS.redPale), borderColor: REPORT_COLORS.red, borderWidth: 1, borderRadius: 8, borderSkipped: false, hoverBackgroundColor: REPORT_COLORS.navy }] },
    options: { ...chartOptions({ horizontal: true, percentage: true }), scales: { x: { beginAtZero: true, max: 35, grid: { color: REPORT_COLORS.grid }, ticks: { color: REPORT_COLORS.text, callback: (value) => `${value}%` } }, y: { grid: { display: false }, ticks: { color: REPORT_COLORS.text } } } },
  });
}

async function loadReport() {
  try {
    const [response, namesResponse] = await Promise.all([
      fetch("data/report_data.json?v=3", { cache: "no-store" }),
      fetch("data/player_names.json?v=3", { cache: "no-store" }),
    ]);
    if (!response.ok) throw new Error(`Could not load report data (${response.status})`);
    const data = await response.json();
    const playerNames = namesResponse.ok ? await namesResponse.json() : {};
    data.top_pitchers = data.top_pitchers.map((row) => ({
      ...row,
      player_name: row.player_name || playerNames[String(row.pitcher)] || `MLB ID ${row.pitcher}`,
    }));
    data.top_batters = data.top_batters.map((row) => ({
      ...row,
      player_name: row.player_name || playerNames[String(row.batter)] || `MLB ID ${row.batter}`,
    }));
    renderHeadline(data);
    renderNarrative(data);
    renderCharts(data);
    updateReportChartTheme();
    renderExplorer(data);
    setupFindingNavigation();
  } catch (error) {
    console.error(error);
    document.querySelectorAll(".section-body > p:not(.chart-caption)").forEach((element) => { element.textContent = "The report data could not be loaded. Please open the site through a web server."; });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupReportControls();
  loadReport();
});
