const REPORT_COLORS = {
  navy: "#15283d",
  blue: "#246b9c",
  orange: "#e98a47",
  teal: "#2a8b87",
  pale: "#b9cbd7",
  grid: "#e5e9e7",
  text: "#667085",
};

const numberFormat = new Intl.NumberFormat("en-US");

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
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: REPORT_COLORS.navy,
        padding: 12,
        displayColors: false,
        callbacks: percentage ? { label: (context) => `${context.dataset.label}: ${context.raw.toFixed(1)}%` } : {},
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: REPORT_COLORS.text, font: { family: "DM Mono" } } },
      y: {
        beginAtZero: true,
        grid: { color: REPORT_COLORS.grid },
        ticks: {
          color: REPORT_COLORS.text,
          font: { family: "DM Mono" },
          callback: percentage ? (value) => `${value}%` : undefined,
        },
      },
    },
  };
}

function makeChart(id, config) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  return new Chart(canvas, config);
}

function setText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
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
    `This report examines ${formatNumber(headline.pitches)} pitch events from ${headline.months} monthly samples in the ${headline.season} season, asking how pitch selection, velocity, handedness, and batted-ball outcomes connect.`,
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
    `The file contains ${formatNumber(h.pitches)} pitches from ${formatNumber(h.pitchers)} pitchers and ${formatNumber(h.batters)} batters. It uses five comparable monthly samples from the ${h.season} season while preserving the event-level detail needed to study individual matchups.`,
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
    `${topPitcherName} threw the most pitches in this sample: ${formatNumber(topPitcher.pitches)}, or ${(topPitcher.pitches / h.pitches * 100).toFixed(1)}% of all rows. The top ten pitchers are useful for volume comparisons, but pitch count is exposure—not a direct measure of pitching quality.`,
  );
  setText(
    "batters-copy",
    `Among batters with at least 100 completed plate appearances, the highest observed hit rate belongs to ${topBatterName}: ${formatPercent(topBatter.hit_rate)} over ${formatNumber(topBatter.plate_appearances)} appearances. That threshold reduces—but does not eliminate—the small-sample problem, so the dashboard should be used to inspect the denominator before drawing conclusions.`,
  );

  setText(
    "definitions-copy",
    `${data.definitions.hit_rate}. ${data.definitions.strike_rate}. ${data.definitions.hard_hit_rate}. ${data.definitions.home_run_rate}. Averages use the non-missing values of the relevant numeric column.`,
  );
}

function renderCharts(data) {
  const mix = data.pitch_mix;
  const speed = [...data.speed_by_pitch].reverse();
  const months = data.month_summary;
  const hands = data.handedness;
  const outcomes = data.outcomes.slice(0, 8).reverse();
  const pitchers = [...data.top_pitchers].reverse();
  const batters = [...data.top_batters].reverse();

  makeChart("season-volume-chart", {
    type: "bar",
    data: { labels: months.map((row) => row.month), datasets: [{ label: "Pitches", data: months.map((row) => row.pitches), backgroundColor: REPORT_COLORS.blue, borderRadius: 5 }] },
    options: chartOptions(),
  });

  makeChart("pitch-mix-chart", {
    type: "bar",
    data: { labels: mix.map((row) => row.pitch_name), datasets: [{ label: "Share of pitches", data: mix.map((row) => row.share), backgroundColor: REPORT_COLORS.orange, borderRadius: 5 }] },
    options: { ...chartOptions({ horizontal: true, percentage: true }), scales: { x: { beginAtZero: true, max: 36, grid: { color: REPORT_COLORS.grid }, ticks: { color: REPORT_COLORS.text, callback: (value) => `${value}%` } }, y: { grid: { display: false }, ticks: { color: REPORT_COLORS.text, font: { family: "DM Mono" } } } } },
  });

  makeChart("pitch-speed-chart", {
    type: "bar",
    data: { labels: speed.map((row) => row.pitch_name), datasets: [{ label: "Average speed", data: speed.map((row) => row.avg_speed), backgroundColor: REPORT_COLORS.teal, borderRadius: 5 }] },
    options: { ...chartOptions({ horizontal: true }), scales: { x: { beginAtZero: true, suggestedMax: 100, grid: { color: REPORT_COLORS.grid }, ticks: { color: REPORT_COLORS.text, callback: (value) => `${value} mph` } }, y: { grid: { display: false }, ticks: { color: REPORT_COLORS.text } } } },
  });

  makeChart("season-metrics-chart", {
    type: "line",
    data: { labels: months.map((row) => row.month), datasets: [
      { label: "Average pitch speed", data: months.map((row) => row.avg_speed), borderColor: REPORT_COLORS.blue, backgroundColor: REPORT_COLORS.blue, tension: 0.3, yAxisID: "y" },
      { label: "Average exit velocity", data: months.map((row) => row.avg_exit_velocity), borderColor: REPORT_COLORS.orange, backgroundColor: REPORT_COLORS.orange, tension: 0.3, yAxisID: "y1" },
    ] },
    options: { ...chartOptions(), plugins: { legend: { display: true, labels: { usePointStyle: true, color: REPORT_COLORS.text } } }, scales: { x: { grid: { display: false }, ticks: { color: REPORT_COLORS.text } }, y: { position: "left", grid: { color: REPORT_COLORS.grid }, ticks: { color: REPORT_COLORS.blue } }, y1: { position: "right", grid: { drawOnChartArea: false }, ticks: { color: REPORT_COLORS.orange } } } },
  });

  const handLabels = hands.map((row) => `P${row.p_throws} / B${row.stand}`);
  makeChart("handedness-chart", {
    type: "bar",
    data: { labels: handLabels, datasets: [{ label: "Pitches", data: hands.map((row) => row.pitches), backgroundColor: [REPORT_COLORS.pale, REPORT_COLORS.orange, REPORT_COLORS.blue, REPORT_COLORS.navy], borderRadius: 5 }] },
    options: chartOptions(),
  });

  makeChart("outcomes-chart", {
    type: "bar",
    data: { labels: outcomes.map((row) => row.event.replaceAll("_", " ")), datasets: [{ label: "Completed appearances", data: outcomes.map((row) => row.count), backgroundColor: REPORT_COLORS.blue, borderRadius: 5 }] },
    options: chartOptions({ horizontal: true }),
  });

  makeChart("top-pitchers-chart", {
    type: "bar",
    data: { labels: pitchers.map((row) => row.player_name || `MLB ID ${row.pitcher}`), datasets: [{ label: "Pitches", data: pitchers.map((row) => row.pitches), backgroundColor: REPORT_COLORS.navy, borderRadius: 5 }] },
    options: chartOptions({ horizontal: true }),
  });

  makeChart("top-batters-chart", {
    type: "bar",
    data: { labels: batters.map((row) => row.player_name || `MLB ID ${row.batter}`), datasets: [{ label: "Hit rate", data: batters.map((row) => row.hit_rate * 100), backgroundColor: REPORT_COLORS.orange, borderRadius: 5 }] },
    options: { ...chartOptions({ horizontal: true, percentage: true }), scales: { x: { beginAtZero: true, max: 35, grid: { color: REPORT_COLORS.grid }, ticks: { color: REPORT_COLORS.text, callback: (value) => `${value}%` } }, y: { grid: { display: false }, ticks: { color: REPORT_COLORS.text } } } },
  });
}

async function loadReport() {
  try {
    const [response, namesResponse] = await Promise.all([
      fetch("data/report_data.json?v=2", { cache: "no-store" }),
      fetch("data/player_names.json?v=2", { cache: "no-store" }),
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
  } catch (error) {
    console.error(error);
    document.querySelectorAll(".section-body > p:not(.chart-caption)").forEach((element) => { element.textContent = "The report data could not be loaded. Please open the site through a web server."; });
  }
}

document.addEventListener("DOMContentLoaded", loadReport);
