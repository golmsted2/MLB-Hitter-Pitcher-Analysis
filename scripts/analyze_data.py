"""Create reproducible summary statistics for the Statcast report page."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = PROJECT_ROOT / "data" / "mlb_statcast_2025_months.csv"
SUMMARY_PATH = PROJECT_ROOT / "data" / "report_data.json"
NAMES_PATH = PROJECT_ROOT / "data" / "player_names.json"

HITS = {"single", "double", "triple", "home_run"}
STRIKEOUTS = {"strikeout", "strikeout_double_play"}
STRIKE_DESCRIPTIONS = {
    "called_strike",
    "foul",
    "foul_bunt",
    "foul_tip",
    "missed_bunt",
    "swinging_strike",
    "swinging_strike_blocked",
    "bunt_foul_tip",
}


def clean_data() -> pd.DataFrame:
    data = pd.read_csv(DATA_PATH, low_memory=False)
    data["game_date"] = pd.to_datetime(data["game_date"])
    data["season"] = data["season"].astype(int)
    data["is_pa"] = data["events"].notna()
    data["is_hit"] = data["events"].isin(HITS)
    data["is_home_run"] = data["events"].eq("home_run")
    data["is_strikeout"] = data["events"].isin(STRIKEOUTS)
    data["is_strike"] = data["description"].isin(STRIKE_DESCRIPTIONS)
    data["is_batted_ball"] = data["description"].eq("hit_into_play")
    data["is_hard_hit"] = data["is_batted_ball"] & data["launch_speed"].ge(95)
    return data


def round_records(frame: pd.DataFrame, digits: int = 2) -> list[dict]:
    result = frame.copy()
    numeric = result.select_dtypes(include="number").columns
    result[numeric] = result[numeric].round(digits)
    return result.where(pd.notna(result), None).to_dict(orient="records")


def load_player_names() -> dict[str, str]:
    if not NAMES_PATH.exists():
        return {}
    return json.loads(NAMES_PATH.read_text(encoding="utf-8"))


def main() -> None:
    data = clean_data()
    pa = data[data["is_pa"]].copy()
    batted = data[data["is_batted_ball"]].copy()

    pitch_mix = (
        data.groupby(["pitch_type", "pitch_name"], dropna=False)
        .size()
        .reset_index(name="pitches")
        .sort_values("pitches", ascending=False)
        .head(10)
    )
    pitch_mix["share"] = pitch_mix["pitches"] / len(data) * 100

    speed_by_pitch = (
        data.groupby(["pitch_type", "pitch_name"], dropna=False)
        .agg(pitches=("release_speed", "count"), avg_speed=("release_speed", "mean"))
        .query("pitches >= 1000")
        .sort_values("avg_speed", ascending=False)
        .reset_index()
        .head(10)
    )

    month_summary = (
        data.groupby("month")
        .agg(
            pitches=("pitcher", "size"),
            avg_speed=("release_speed", "mean"),
            avg_exit_velocity=("launch_speed", "mean"),
            strike_rate=("is_strike", "mean"),
        )
        .reset_index()
    )
    month_batted = batted.groupby("month").agg(
        batted_balls=("launch_speed", "size"),
        hard_hit_rate=("is_hard_hit", "mean"),
    )
    month_summary = month_summary.merge(month_batted, on="month")

    handedness = (
        data.groupby(["p_throws", "stand"], dropna=False)
        .agg(
            pitches=("pitcher", "size"),
            avg_speed=("release_speed", "mean"),
            strike_rate=("is_strike", "mean"),
        )
        .reset_index()
    )
    handedness_pa = pa.groupby(["p_throws", "stand"], dropna=False).agg(
        plate_appearances=("events", "size"),
        hit_rate=("is_hit", "mean"),
        home_run_rate=("is_home_run", "mean"),
        strikeout_rate=("is_strikeout", "mean"),
    ).reset_index()
    handedness = handedness.merge(handedness_pa, on=["p_throws", "stand"])

    top_pitchers = (
        data.groupby("pitcher")
        .agg(pitches=("pitcher", "size"), avg_speed=("release_speed", "mean"))
        .reset_index()
        .sort_values("pitches", ascending=False)
        .head(10)
    )

    top_batters = (
        pa.groupby("batter")
        .agg(
            plate_appearances=("batter", "size"),
            hit_rate=("is_hit", "mean"),
            home_runs=("is_home_run", "sum"),
        )
        .query("plate_appearances >= 100")
        .reset_index()
        .sort_values("hit_rate", ascending=False)
        .head(10)
    )

    player_names = load_player_names()
    top_pitchers["player_name"] = top_pitchers["pitcher"].map(
        lambda player_id: player_names.get(str(int(player_id)), f"MLB ID {int(player_id)}")
    )
    top_batters["player_name"] = top_batters["batter"].map(
        lambda player_id: player_names.get(str(int(player_id)), f"MLB ID {int(player_id)}")
    )

    exit_velocity_bands = pd.cut(
        batted["launch_speed"],
        bins=[-1, 79, 89, 94, 99, float("inf")],
        labels=["0–79 mph", "80–89 mph", "90–94 mph", "95–99 mph", "100+ mph"],
    )

    summary = {
        "headline": {
            "pitches": int(len(data)),
            "months": int(data["month"].nunique()),
            "season": int(data["season"].mode().iloc[0]),
            "pitchers": int(data["pitcher"].nunique()),
            "batters": int(data["batter"].nunique()),
            "avg_speed": round(float(data["release_speed"].mean()), 2),
            "hard_hit_rate": round(float(batted["is_hard_hit"].mean() * 100), 2),
            "plate_appearances": int(len(pa)),
            "hits": int(pa["is_hit"].sum()),
            "home_runs": int(pa["is_home_run"].sum()),
            "strikeouts": int(pa["is_strikeout"].sum()),
        },
        "definitions": {
            "hit_rate": "hits divided by completed plate appearances; hits are singles, doubles, triples, and home runs",
            "strike_rate": "pitches whose description is a called strike, foul, swinging strike, or related strike outcome, divided by all pitches",
            "hard_hit_rate": "balls put into play with launch_speed at least 95 mph divided by balls put into play with launch_speed",
            "home_run_rate": "home runs divided by completed plate appearances",
        },
        "pitch_mix": round_records(pitch_mix),
        "speed_by_pitch": round_records(speed_by_pitch),
        "month_summary": round_records(month_summary),
        "handedness": round_records(handedness),
        "top_pitchers": round_records(top_pitchers),
        "top_batters": round_records(top_batters),
        "outcomes": round_records(
            pa["events"].value_counts().head(10).rename_axis("event").reset_index(name="count")
        ),
        "exit_velocity_bands": round_records(
            exit_velocity_bands.value_counts(sort=False)
            .rename_axis("exit_velocity_band")
            .reset_index(name="count")
        ),
    }

    SUMMARY_PATH.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Wrote {SUMMARY_PATH}")
    print(json.dumps(summary["headline"], indent=2))


if __name__ == "__main__":
    main()
