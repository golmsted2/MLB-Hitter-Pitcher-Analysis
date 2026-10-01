"""Check the local project against the assignment's structural requirements."""

import json
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "months"
MAX_FILE_BYTES = 25 * 1024 * 1024


def main() -> None:
    required_files = [
        "index.html",
        "dashboard.html",
        "styles.css",
        "theme.js",
        "assets/mlb-pitcher-action.jpg",
        "assets/mlb-hitter-action.jpg",
        "report.js",
        "dashboard.js",
        "README.md",
        "submission.txt",
        "data/report_data.json",
        "data/data_files.json",
        "data/player_names.json",
        "scripts/analyze_data.py",
        "scripts/create_player_names.py",
        "scripts/get_statcast_2021_2025.py",
        "scripts/get_statcast_2025_months.py",
        "scripts/make_small_dataset.py",
    ]
    missing = [path for path in required_files if not (ROOT / path).exists()]
    assert not missing, f"Missing files: {missing}"

    categorical = ["pitch_type", "p_throws", "stand", "home_team", "bb_type"]
    numeric = ["release_speed", "launch_speed", "launch_angle", "hc_x", "hc_y", "balls", "strikes"]
    required_columns = ["season", "month", "pitcher", "batter", *categorical, *numeric]
    manifest = json.loads((ROOT / "data" / "data_files.json").read_text(encoding="utf-8"))
    assert len(manifest) >= 30, len(manifest)
    data_paths = [ROOT / path for path in manifest]
    assert all(path.exists() for path in data_paths), "Manifest contains a missing CSV"
    assert all(path.stat().st_size < MAX_FILE_BYTES for path in data_paths), "A CSV is at least 25 MB"

    total_rows = 0
    seasons: set[int] = set()
    months: set[str] = set()
    pitchers: set[int] = set()
    batters: set[int] = set()
    first_columns = None
    for path in data_paths:
        header = pd.read_csv(path, nrows=0)
        if first_columns is None:
            first_columns = header.columns
        assert all(column in header.columns for column in required_columns), path.name
        for chunk in pd.read_csv(path, usecols=required_columns, chunksize=100_000, low_memory=False):
            total_rows += len(chunk)
            seasons.update(int(value) for value in chunk["season"].dropna().unique())
            months.update(str(value) for value in chunk["month"].dropna().unique())
            pitchers.update(int(value) for value in chunk["pitcher"].dropna().unique())
            batters.update(int(value) for value in chunk["batter"].dropna().unique())

    assert total_rows >= 3_000_000, total_rows
    assert len(first_columns) >= 8, len(first_columns)
    assert seasons == set(range(2021, 2026)), seasons
    assert len(months) >= 30, len(months)
    assert len(pitchers) >= 10, len(pitchers)
    assert len(batters) >= 10, len(batters)

    report = (ROOT / "index.html").read_text(encoding="utf-8")
    dashboard = (ROOT / "dashboard.html").read_text(encoding="utf-8")
    assert report.count("<canvas") >= 8
    assert 'id="report-explorer"' in report
    assert 'id="month-focus-select"' in report
    assert report.count('data-report-jump=') >= 8
    assert 'id="reading-progress-bar"' in report
    assert report.count('class="chart-insight"') >= 8
    assert 'id="back-to-top"' in report
    assert 'id="theme-toggle"' in report
    assert 'id="theme-toggle"' in dashboard
    assert 'src="theme.js"' in report
    assert 'src="theme.js"' in dashboard
    assert dashboard.count("<canvas") >= 4
    assert 'assets/baseball-favicon.svg' in report
    assert 'assets/baseball-favicon.svg' in dashboard
    assert dashboard.count('id="filter-') >= 4
    assert 'id="reset-filters"' in dashboard
    assert 'id="summary-table"' in dashboard
    assert 'id="spray-chart"' in dashboard
    assert 'id="spray-tooltip"' in dashboard
    assert 'id="filter-event"' in dashboard
    assert 'id="download-filtered"' in dashboard
    assert 'id="loading-progress"' in dashboard
    assert 'id="direct-matchup"' in dashboard
    assert dashboard.count('class="chart-note"') >= 4
    assert 'id="selected-matchup-title"' in dashboard
    assert 'id="selected-pitcher-image"' in dashboard
    assert 'id="selected-batter-image"' in dashboard
    assert 'id="player-comparison-chart"' in dashboard
    assert 'id="search-pitcher"' in dashboard
    assert 'id="search-batter"' in dashboard
    assert 'id="pitcher-search-results"' in dashboard
    assert 'id="batter-search-results"' in dashboard
    assert 'id="selected-pitcher-team"' in dashboard
    assert 'id="selected-batter-team"' in dashboard

    summary_text = (ROOT / "data" / "report_data.json").read_text(encoding="utf-8")
    assert '"player_name"' in summary_text
    dashboard_js = (ROOT / "dashboard.js").read_text(encoding="utf-8")
    assert "avg_exit_velocity: mean(battedBallRows, \"launch_speed\")" in dashboard_js
    assert "description === \"hit_into_play\"" in dashboard_js
    assert "function downloadFilteredData" in dashboard_js
    assert "function applyUrlState" in dashboard_js
    assert "function updateDirectMatchup" in dashboard_js

    print("PASS: project files are present")
    print(f"PASS: {total_rows:,} rows and {len(first_columns)} columns")
    print(f"PASS: {len(months)} monthly samples across {len(seasons)} seasons, {len(pitchers):,} pitchers, {len(batters):,} batters")
    print("PASS: report has at least eight charts")
    print("PASS: dashboard has filters, four charts, a table, and reset control")


if __name__ == "__main__":
    main()
