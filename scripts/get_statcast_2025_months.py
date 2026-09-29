"""Download a compact five-month Statcast panel from the 2025 season."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
from pybaseball import statcast


PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = PROJECT_ROOT / "data" / "mlb_statcast_2025_months.csv"
ROWS_PER_MONTH = 30_000
SEED = 20260929

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
    pieces: list[pd.DataFrame] = []
    for index, (start_date, end_date, month) in enumerate(MONTHS):
        print(f"Downloading {month}...")
        raw = statcast(start_dt=start_date, end_dt=end_date, verbose=True, parallel=True)
        regular = raw[raw["game_type"].eq("R")].copy()
        available_columns = [column for column in SOURCE_COLUMNS if column in regular.columns]
        piece = regular[available_columns].copy()
        if len(piece) < ROWS_PER_MONTH:
            raise RuntimeError(f"Only {len(piece):,} regular-season rows were returned for {month}")
        piece = piece.sample(n=ROWS_PER_MONTH, random_state=SEED + index)
        piece["season"] = 2025
        piece["month"] = month
        pieces.append(piece)
        print(f"  Kept {len(piece):,} rows from {len(regular):,} regular-season pitches")

    data = (
        pd.concat(pieces, ignore_index=True)
        .sort_values(["month", "game_date", "pitcher", "batter"])
        .reset_index(drop=True)
    )
    data["game_date"] = pd.to_datetime(data["game_date"])
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    data.to_csv(OUTPUT_PATH, index=False, float_format="%.2f")

    print(f"Saved: {OUTPUT_PATH}")
    print(f"Rows: {len(data):,}")
    print(f"Months: {data['month'].nunique()}")
    print(f"Pitchers: {data['pitcher'].nunique():,}")
    print(f"Batters: {data['batter'].nunique():,}")


if __name__ == "__main__":
    main()
