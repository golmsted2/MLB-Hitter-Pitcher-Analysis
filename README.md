# Between the Lines: MLB Statcast

An interactive Financial Data Analytics project about pitcher–hitter matchups. The site asks how pitch type and pitcher/batter handedness relate to pitch velocity and batting outcomes.

## Site pages

- `index.html` is the scrollable report page. It presents eight findings, headline numbers, charts, an interactive month-highlighting explorer, chart annotations, a reading-progress bar, jump links, and the data/method notes.
- `dashboard.html` is the interactive dashboard. It loads the CSV in the browser and recalculates cards, charts, the table, live player-search suggestions, a hit-type filter, a tooltip-enabled spray chart, direct pitcher-versus-batter results, a two-player comparison, and an inline player section when controls change.
- `styles.css` contains the shared layout, colors, typography, responsive behavior, and dashboard styles.
- `theme.js` controls the shared light/dark mode switch and remembers the selected theme in the browser.
- `assets/baseball-favicon.svg` is the baseball icon shown in the browser tab.
- `assets/mlb-pitcher-action.jpg` and `assets/mlb-hitter-action.jpg` are official MLB game-action images used in the report and dashboard artwork. They are stored locally so the published site does not depend on remote image loading.
- `report.js` loads `data/report_data.json`, fills the report prose, and creates the eight report charts.
- `dashboard.js` loads the published CSV list from `data/data_files.json` with Papa Parse and performs the dashboard calculations in the browser. It also supports report-to-dashboard URL links, loading progress, CSV export of the current view, accessible status messages, and team logos/colors.

## Data and analysis files

- `data/data_files.json` is the browser manifest listing every published CSV file.
- `data/months/mlb_statcast_*.csv` are the project data: one regular-season pitch per row across the 2021, 2022, 2023, 2024, and 2025 seasons. The 3,567,064 pitches are split into 65 files, each below 25 MB.
- `data/report_data.json` contains the summary tables used by the report page. It is generated from the CSV, not typed by hand.
- `data/player_names.json` maps the MLB player IDs in the CSV to player names for the report charts, report narrative, and dashboard filters.
- `scripts/analyze_data.py` reads the CSV, computes the report findings, and writes `data/report_data.json`.
- `scripts/create_player_names.py` uses the `pybaseball` player-ID lookup to create the compact player-name file.
- `scripts/get_statcast_2021_2025.py` downloads the complete 2021–2025 regular-season dataset, partitions it into browser-sized monthly files, and writes the data manifest.
- `scripts/get_statcast_2025_months.py` is the earlier five-month 2025-only downloader retained for reference.
- `scripts/make_small_dataset.py` creates deterministic 30,000-rows-per-month samples from a full Statcast export.
- `scripts/validate_project.py` checks the dataset and site structure against the assignment requirements.
- `submission.txt` is the four-line submission template required by the assignment. Replace the placeholders before turning it in.
- `.gitignore` lists local operating-system files that should not be committed.

## Data source

The raw data comes from MLB Advanced Media’s public Baseball Savant Statcast search export. Baseball Savant’s [CSV documentation](https://baseballsavant.mlb.com/csv-docs) defines the fields used here, including `game_date`, `pitch_type`, `pitcher`, `batter`, `events`, `description`, `stand`, `p_throws`, `release_speed`, `launch_speed`, `launch_angle`, `hc_x`, `hc_y`, and `bb_type`.

The game-action images come from MLB’s official image CDN: [Paul Skenes pitching](https://www.mlb.com/ja/news/starting-pitcher-power-rankings-yoshinobu-yamamoto-7th) and [Aaron Judge batting](https://www.mlb.com/video/jordan-hicks-in-play-no-out-to-aaron-judge-jzybkd). They identify Paul Skenes and Aaron Judge, both of whom appear in the published player-name file.

The published data meets the project requirements: it has 3,567,064 rows, 23 columns, 36 monthly samples across five seasons, and more than ten pitchers and batters. The event-level structure allows a pitch to belong to both a pitcher and a batter. Missing `events`, launch measurements, and contact-location fields are retained because they are natural features of pitch-level data; each rate uses the appropriate non-missing denominator. The dashboard’s average exit velocity and hard-hit rate use only pitches recorded as `hit_into_play` with a non-missing `launch_speed`.

## Reproducing the report numbers

Run the following from the course environment’s `fda-python` root, using the project path as the script argument:

```powershell
uv run python C:\Users\gehri\OneDrive\Senior 1st Semester\Financial Data Analytics\MLB-Hitter-Pitcher-Analysis\scripts\analyze_data.py
```

The script rewrites `data/report_data.json`. The browser dashboard does not use this summary file; it recalculates directly from the CSV.

## Publishing

Create a public GitHub repository, push the contents of this folder to its `main` branch, and enable GitHub Pages from `Settings → Pages → Deploy from a branch → main → / (root)`. Replace the placeholders in `submission.txt` with your name, student ID, repository URL, and live site URL.
