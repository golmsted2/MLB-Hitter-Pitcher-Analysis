"""Create a compact MLB ID-to-name lookup for the report and dashboard."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
from pybaseball import playerid_reverse_lookup


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = PROJECT_ROOT / "data" / "mlb_statcast_2025_months.csv"
NAMES_PATH = PROJECT_ROOT / "data" / "player_names.json"


def main() -> None:
    ids_frame = pd.read_csv(DATA_PATH, usecols=["pitcher", "batter"], low_memory=False)
    player_ids = sorted(
        {
            int(player_id)
            for column in ("pitcher", "batter")
            for player_id in ids_frame[column].dropna().unique()
        }
    )

    lookup = playerid_reverse_lookup(player_ids)
    names: dict[str, str] = {}
    for row in lookup.to_dict(orient="records"):
        player_id = row.get("key_mlbam")
        if pd.isna(player_id):
            continue
        first = str(row.get("name_first") or "").strip()
        last = str(row.get("name_last") or "").strip()
        name = " ".join(part for part in (first, last) if part).title()
        if name:
            names[str(int(player_id))] = name

    NAMES_PATH.write_text(
        json.dumps(dict(sorted(names.items())), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {NAMES_PATH} with {len(names):,} player names from {len(player_ids):,} IDs")


if __name__ == "__main__":
    main()
