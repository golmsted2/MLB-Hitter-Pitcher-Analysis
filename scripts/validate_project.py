"""Check the local project against the assignment's structural requirements."""

from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "months"


def main() -> None:
    required_files = [
        "index.html",
        "dashboard.html",
        "styles.css",
        "assets/baseball-pitch.jpg",
        "assets/baseball-glove.jpg",
        "report.js",
        "dashboard.js",
        "README.md",
        "submission.txt",
        "data/report_data.json",
        "data/months/mlb_statcast_2025_04.csv",
        "data/months/mlb_statcast_2025_05.csv",
        "data/months/mlb_statcast_2025_06.csv",
        "data/months/mlb_statcast_2025_07.csv",
        "data/months/mlb_statcast_2025_08.csv",
        "data/player_names.json",
        "scripts/analyze_data.py",
        "scripts/create_player_names.py",
        "scripts/get_statcast_2025_months.py",
        "scripts/make_small_dataset.py",
    ]
    missing = [path for path in required_files if not (ROOT / path).exists()]
    assert not missing, f"Missing files: {missing}"

    data_paths = sorted(DATA_DIR.glob("mlb_statcast_2025_*.csv"))
    assert len(data_paths) == 5, len(data_paths)
    data = pd.concat([pd.read_csv(path, low_memory=False) for path in data_paths], ignore_index=True)
    assert len(data) >= 500_000, len(data)
    assert len(data.columns) >= 8, len(data.columns)
    assert data["season"].nunique() == 1, data["season"].nunique()
    assert data["season"].iloc[0] == 2025, data["season"].iloc[0]
    assert data["month"].nunique() >= 5, data["month"].nunique()
    assert data["pitcher"].nunique() >= 10, data["pitcher"].nunique()
    assert data["batter"].nunique() >= 10, data["batter"].nunique()

    categorical = ["pitch_type", "p_throws", "stand", "home_team"]
    numeric = ["release_speed", "launch_speed", "launch_angle", "balls", "strikes"]
    assert all(column in data.columns for column in categorical)
    assert all(column in data.columns for column in numeric)

    report = (ROOT / "index.html").read_text(encoding="utf-8")
    dashboard = (ROOT / "dashboard.html").read_text(encoding="utf-8")
    assert report.count("<canvas") >= 8
    assert dashboard.count("<canvas") >= 4
    assert dashboard.count('id="filter-') >= 4
    assert 'id="reset-filters"' in dashboard
    assert 'id="summary-table"' in dashboard

    summary_text = (ROOT / "data" / "report_data.json").read_text(encoding="utf-8")
    assert '"player_name"' in summary_text

    print("PASS: project files are present")
    print(f"PASS: {len(data):,} rows and {len(data.columns)} columns")
    print(f"PASS: {data['month'].nunique()} months in the {int(data['season'].iloc[0])} season, {data['pitcher'].nunique():,} pitchers, {data['batter'].nunique():,} batters")
    print("PASS: report has at least eight charts")
    print("PASS: dashboard has filters, four charts, a table, and reset control")


if __name__ == "__main__":
    main()
