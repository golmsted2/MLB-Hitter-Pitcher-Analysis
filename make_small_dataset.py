"""Create the smaller, assignment-ready CSV from a full Statcast export."""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


SEED = 20260928
ROWS_PER_SEASON = 30_000


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path, help="Full Statcast CSV")
    parser.add_argument("output", type=Path, help="Smaller output CSV")
    args = parser.parse_args()

    data = pd.read_csv(args.input, low_memory=False)
    pieces = []
    for season in sorted(data["season"].dropna().unique()):
        season_data = data[data["season"] == season]
        sample_size = min(ROWS_PER_SEASON, len(season_data))
        pieces.append(
            season_data.sample(
                n=sample_size,
                random_state=SEED + int(season),
            )
        )

    smaller = (
        pd.concat(pieces, ignore_index=True)
        .sort_values(["season", "game_date", "pitcher", "batter"])
        .reset_index(drop=True)
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    smaller.to_csv(args.output, index=False, float_format="%.2f")

    print(f"Wrote {args.output}")
    print(f"Rows: {len(smaller):,}")
    print(f"Seasons: {smaller['season'].nunique()}")


if __name__ == "__main__":
    main()
