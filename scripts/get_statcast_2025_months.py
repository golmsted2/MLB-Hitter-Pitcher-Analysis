"""Download the complete regular-season Statcast data for five 2025 months."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
from pybaseball import statcast


PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = PROJECT_ROOT / "data" / "months"

MONTHS = [
    ("2025-04-01", "2025-04-30", "2025-04"),
    ("2025-05-01", "2025-05-31", "2025-05"),
    ("2025-06-01", "2025-06-30", "2025-06"),
    ("2025-07-01", "2025-07-31", "2025-07"),
    ("2025-08-01", "2025-08-31", "2025-08"),
]

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


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    total_rows = 0

    for start_date, end_date, month in MONTHS:
        print(f"Downloading {month}...")
        raw = statcast(start_dt=start_date, end_dt=end_date, verbose=True, parallel=True)
        regular = raw[raw["game_type"].eq("R")].copy()
        available_columns = [column for column in SOURCE_COLUMNS if column in regular.columns]
        data = regular[available_columns].copy()
        data["season"] = 2025
        data["month"] = month
        data["game_date"] = pd.to_datetime(data["game_date"])
        data = data.sort_values(["game_date", "pitcher", "batter"]).reset_index(drop=True)

        output_path = OUTPUT_DIR / f"mlb_statcast_2025_{month[-2:]}.csv"
        data.to_csv(output_path, index=False, float_format="%.2f")
        total_rows += len(data)
        print(f"  Saved {len(data):,} regular-season pitches to {output_path}")

    print(f"Saved {total_rows:,} pitches across {len(MONTHS)} monthly files")


if __name__ == "__main__":
    main()
