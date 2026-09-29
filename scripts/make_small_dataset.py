"""Create the smaller, assignment-ready CSV from a full Statcast export."""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


SEED = 20260929
ROWS_PER_MONTH = 30_000


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path, help="Full Statcast CSV")
    parser.add_argument("output", type=Path, help="Smaller output CSV")
    args = parser.parse_args()

    data = pd.read_csv(args.input, low_memory=False)
    data["game_date"] = pd.to_datetime(data["game_date"])
    data["month"] = data["game_date"].dt.to_period("M").astype(str)
    pieces = []
    for month in sorted(data["month"].dropna().unique()):
        month_data = data[data["month"] == month]
        sample_size = min(ROWS_PER_MONTH, len(month_data))
        pieces.append(
            month_data.sample(
                n=sample_size,
                random_state=SEED + len(pieces),
            )
        )

    smaller = (
        pd.concat(pieces, ignore_index=True)
        .sort_values(["month", "game_date", "pitcher", "batter"])
        .reset_index(drop=True)
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    smaller.to_csv(args.output, index=False, float_format="%.2f")

    print(f"Wrote {args.output}")
    print(f"Rows: {len(smaller):,}")
    print(f"Seasons: {smaller['season'].nunique()}")


if __name__ == "__main__":
    main()
