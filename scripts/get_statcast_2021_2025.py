"""Download complete regular-season Statcast data for the 2021–2025 seasons.

The output is partitioned by month and, if necessary, by row count so that
every published CSV stays below GitHub's 25 MB project-file target.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
from pybaseball import statcast


PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = PROJECT_ROOT / "data" / "months"
MANIFEST_PATH = PROJECT_ROOT / "data" / "data_files.json"
MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_ROWS_PER_FILE = 100_000

SEASON_WINDOWS = {
    2021: ("2021-04-01", "2021-10-03"),
    2022: ("2022-04-07", "2022-10-05"),
    2023: ("2023-03-30", "2023-10-01"),
    2024: ("2024-03-20", "2024-09-29"),
    2025: ("2025-03-18", "2025-09-28"),
}

SOURCE_COLUMNS = [
    "game_date",
    "game_year",
    "game_type",
    "pitcher",
    "batter",
    "pitch_type",
    "pitch_name",
    "events",
    "description",
    "stand",
    "p_throws",
    "home_team",
    "away_team",
    "release_speed",
    "launch_speed",
    "launch_angle",
    "balls",
    "strikes",
]


def month_windows() -> list[tuple[int, int, str, str]]:
    windows = []
    for season, (season_start, season_end) in SEASON_WINDOWS.items():
        start = pd.Timestamp(season_start)
        end = pd.Timestamp(season_end)
        for month in range(3, 11):
            calendar_start = pd.Timestamp(season, month, 1)
            calendar_end = calendar_start + pd.offsets.MonthEnd(1)
            month_start = max(calendar_start, start)
            month_end = min(calendar_end, end)
            if month_start <= month_end:
                windows.append((season, month, month_start.strftime("%Y-%m-%d"), month_end.strftime("%Y-%m-%d")))
    return windows


def remove_old_parts(stem: str) -> None:
    for path in OUTPUT_DIR.glob(f"{stem}*.csv"):
        path.unlink()


def write_month(data: pd.DataFrame, season: int, month: int) -> list[Path]:
    stem = f"mlb_statcast_{season}_{month:02d}"
    remove_old_parts(stem)
    paths: list[Path] = []

    for start in range(0, len(data), MAX_ROWS_PER_FILE):
        part = data.iloc[start : start + MAX_ROWS_PER_FILE]
        suffix = "" if len(data) <= MAX_ROWS_PER_FILE else f"_part{start // MAX_ROWS_PER_FILE + 1:02d}"
        path = OUTPUT_DIR / f"{stem}{suffix}.csv"
        part.to_csv(path, index=False, float_format="%.2f")
        if path.stat().st_size >= MAX_FILE_BYTES:
            raise RuntimeError(f"{path.name} is {path.stat().st_size:,} bytes; reduce MAX_ROWS_PER_FILE")
        paths.append(path)
    return paths


def write_manifest(paths: list[Path]) -> None:
    files = [path.relative_to(PROJECT_ROOT).as_posix() for path in sorted(paths)]
    MANIFEST_PATH.write_text(json.dumps(files, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {MANIFEST_PATH} with {len(files)} files")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    all_paths: list[Path] = []
    total_rows = 0

    for season, month, start_date, end_date in month_windows():
        label = f"{season}-{month:02d}"
        print(f"Downloading {label} ({start_date} through {end_date})...")
        raw = statcast(start_dt=start_date, end_dt=end_date, verbose=True, parallel=True)
        regular = raw[raw["game_type"].eq("R")].copy()
        available_columns = [column for column in SOURCE_COLUMNS if column in regular.columns]
        data = regular[available_columns].copy()
        data["season"] = season
        data["month"] = label
        data["game_date"] = pd.to_datetime(data["game_date"])
        data = data.sort_values(["game_date", "pitcher", "batter"]).reset_index(drop=True)
        paths = write_month(data, season, month)
        all_paths.extend(paths)
        total_rows += len(data)
        print(f"  Saved {len(data):,} regular-season pitches to {len(paths)} file(s)")

    write_manifest(all_paths)
    print(f"Saved {total_rows:,} pitches across {len(all_paths)} files")


if __name__ == "__main__":
    main()
