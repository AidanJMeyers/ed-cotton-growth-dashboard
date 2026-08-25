# Data

**Do not edit these files by hand.** They are regenerated from the live database by
[`.github/workflows/snapshot.yml`](../.github/workflows/snapshot.yml). Anything typed
here will be overwritten on the next run — record data in the app instead.

This folder is the permanent record. The app is where the work happens; git is where
it survives.

Last snapshot: **2026-08-25T20:23:11.025Z**

| File | Rows | What it is |
|---|---|---|
| `plants.csv` | 0 | One row per plant: label, treatment, rep, container, sowing date, depth, seeds |
| `measurements.csv` | 0 | One row per plant per day. Blank means not measured, which is not the same as zero |
| `doses.csv` | 0 | One row per plant per Microcystis exposure: strength, volume, stock mL |
| `day_log.csv` | 0 | One row per day: the time measurements were taken, plus the day note |
| `weather_daily.csv` | 2 | Daily conditions at the plot from Open-Meteo, including DD60 heat units |
| `amendments.csv` | 3 | Reason-for-change record: every value edited or removed after it was first saved, with initials and why |
| `audit_log.csv` | 4 | Every change ever made: who, what, when. Written by a database trigger, so it cannot be skipped from the app |
| `snapshot-latest.json` | — | Everything above in one file. This is what a restore reads |
| `backups/` | 1 | Dated snapshots. Daily for 60 days; the 1st of each month is kept permanently |
| `analysis/` | 0 | Copies of every analysis file uploaded through the app, with `index.csv` listing who uploaded what and when |

## Restoring

Open the app, then **Setup → Restore backup** and pick `snapshot-latest.json` (or any
dated file from `backups/`). Restoring merges by timestamp: newer rows win, and nothing
already in the database is dropped.

## Reading it elsewhere

The CSVs open directly in Excel, R (`read.csv`) or Python (`pandas.read_csv`).
For analysis-ready data with the weather already joined onto every growth row, use the
app's **Data & export → Download Excel** instead — these files are the raw tables.
