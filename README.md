# Cotton × Microcystis Field Log

A single-page web app for Emma's cotton trial: open one link, type the day's numbers,
and download a clean Excel workbook whenever anyone asks for the data. The weather
fills itself in from the plot's coordinates.

It replaces the previous workflow (install R → run `weekly_append_tamucc.R` → configure
a Power Query → import `AddDay.bas` → save as `.xlsm` → click a macro button), which
had four things to install and five ways to break before a single number got recorded.
**Nothing here requires Emma to install anything or write any code.**

Static site (vanilla JS, no build step) → **GitHub Pages**.
Optional shared storage → **Supabase** (Postgres + file storage, free tier).

📖 **[Emma's illustrated walkthrough →](docs/WALKTHROUGH.md)**  
📄 **[The same guide as a printable PDF →](docs/Cotton-Field-Log-Guide.pdf)**

> The PDF is generated from the walkthrough by `node scripts/make-guide.mjs`, which writes
> `docs/guide.html`; printing that to PDF from a browser regenerates it. The markdown is the
> single source of truth, so the two cannot drift.

---

## What it does

| | |
|---|---|
| **Log a day** | One card per plant. Height, leaves, internode, SPAD, LAI. Autosaves as you type, no submit button. Green/red arrows compare every value with that plant's last reading. |
| **Schedule aware** | Height/leaves/internode daily, SPAD weekly on Fridays, ceptometer every other Friday, and both again 3 days after each dose. The app says what is due today and outlines those boxes. |
| **Dosing** | Records the Microcystis pour-on per plant, at each group's own strength, and spells out the mixture (2% = 2 mL stock + 98 mL water). Dose days are marked on every chart. |
| **Per-plant history** | Click a plant: growth curves with dose days marked, and every reading with its change from the time before. |
| **Weather** | Pulled automatically for the plot coordinates — no API key, no account, no R script. Includes DD60 heat units, cumulative since the trial start. |
| **Excel** | One workbook: growth readings, per-day summary, treatment means, dosing log, weather, plant list, and a data dictionary. Each growth row already carries that day's weather, so there is no VLOOKUP to do. |
| **Status update** | One button, then pick a window — last 7 days, last 30 days, or the whole trial. Writes where every group stands now and how far it moved, ready to paste into an email. |
| **Files** | Emma uploads her working analysis workbook; anyone with the link downloads the latest. Old versions are never overwritten. |
| **Reason for change** | Altering or deleting an already-committed reading requires initials, a date and a reason. The original value is kept, and the correction lands on the plant's page, the Excel export and the permanent record. |
| **Permanent record** | Twice a day a GitHub Action copies the whole database into `data/` as committed files — CSVs, a JSON snapshot, dated backups, her analysis files, and the audit log of who changed what. |
| **Offline** | Everything typed in the greenhouse is held on the phone and syncs when signal comes back. |
| **Practice mode** | Loads a full fake trial to click around in, and clears it without touching real data. |

---

## Quick start (no setup at all)

Open `index.html` in a browser. It works immediately, storing data in that browser.
Good for trying it; not good as the real system, because the data lives on one device
and file uploads are off.

---

## Real setup

### 1. Set the study details

Everything adjustable lives in [`config.js`](config.js): trial start date, plot
coordinates, who is logging, treatment groups and strengths, dose volume, and the
measurement schedule. Change the values, save, commit.

The defaults match the current trial: 12 plants across Control / Low 2% / High 5%,
100 mL doses, TAMU-CC plot at 27.71514, −97.32750.

To add a measurement later (fresh weight, node count, whatever), add one entry to
`MEASURES` — it appears on the cards, in the charts, and in every export automatically.

### 2. Turn on shared storage (recommended)

Without this, the log lives in one browser on one device. With it, the same log opens
on her phone, her laptop, and any mentor's screen, and file uploads work.

1. Create a project at <https://supabase.com> (free tier).
2. **SQL Editor → New query** → paste all of [`schema.sql`](schema.sql) → **Run**.
   This creates the tables, the row-level-security policies, the narrow delete
   functions, the file bucket, and realtime.
3. **Project Settings → API** → copy **Project URL** and the **anon / public** key into
   `config.js`.

> The anon key is a **public** key — it ships to the browser and is safe to commit.
> Row Level Security protects the data. **Never** paste the `service_role` key here.
>
> Security posture: anyone with the link can read and write rows, which is the right
> trade for a 12-plant undergrad trial that three people need to reach. What they
> *cannot* do is delete: there is no DELETE policy on any table, so a stray client
> can't wipe the season. The only removals are `clear_measurement`, `delete_dose` and
> `delete_file`, each scoped to a single row. Retiring a plant is a flag, never a delete.

### 2b. Let the repo apply SQL for you (optional, recommended)

So schema changes stop being "paste this into the SQL editor".

1. In Supabase, click **Connect** at the top of the project dashboard (or go straight to
   <https://supabase.com/dashboard/project/_?showConnect=true>).
2. Choose the **Session pooler** string. It looks like:
   `postgres://postgres.<project-ref>:[PASSWORD]@aws-<region>.pooler.supabase.com:5432/postgres`
   Replace `[PASSWORD]` with the database password you set when creating the project.
   (If you have lost it: **Connect** → the same panel has a reset link.)
3. Repo → **Settings → Secrets and variables → Actions → New repository secret**.
   Name it `SUPABASE_DB_URL`, paste the string, save.

> **Take the Session pooler one, not "Direct connection".** GitHub's runners are IPv4
> only, and Supabase's direct connection is IPv6 only unless you buy the IPv4 add-on —
> the direct string will simply fail to connect from Actions. Transaction pooler (port
> 6543) does not support the prepared statements psql uses, so session mode (5432) is
> the right one here.

From then on, [`schema.sql`](schema.sql) is applied automatically whenever it changes on
`main`, and any other file can be run from **Actions → Apply SQL to the database → Run
workflow** by naming it (e.g. `sql/2026-08-25-remove-setup-test-amendments.sql`).

Why bother: every statement ever run against the database exists in this repo first, so
it shows up in a diff and in the commit history rather than in someone's browser tab. It
runs in a single transaction with `ON_ERROR_STOP`, so a bad statement rolls back instead
of leaving the schema half-applied.

The secret stays in GitHub. It is never printed in logs and is not in the repo — do not
paste that connection string into a file, an issue, or a chat window.

### 3. Publish it

Push to GitHub and enable **Settings → Pages → Source: GitHub Actions**.
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) publishes on every push
to `main`. Send Emma the URL.

Then run **Actions → Snapshot data to the repo → Run workflow** once, to confirm the
permanent record works and to create `data/`.

---

## Who can see what

Worth being explicit, since the whole point is that data ends up in files:

- **If this repo is public, `data/` is public.** Anyone who finds the repo can read the
  measurements, the audit log (which contains the names in "Logging as"), and the
  analysis files. Same for the published site and the Supabase anon key.
- **If the repo is private**, the data files are private too — but GitHub Pages on a
  private repo needs a paid plan. Alternatives: keep the repo private and share the
  Excel export by hand, or accept public and treat it as open data.
- **Either way**, unpublished results sitting in a public repo before the McNair
  presentation is a decision worth making deliberately rather than by default. Nothing
  here is personally identifying beyond first names, so for a cotton trial public is
  usually fine — but it should be your call, not an accident.

To go private later: make the repo private, then either drop Pages or upgrade the plan.
The app itself keeps working; only the hosting changes.

---

## Where the data actually lives

Two layers, on purpose:

**Supabase is the live layer.** Fast, shared, works offline and syncs later. It is what
makes the same log open on Emma's phone, your laptop and a mentor's screen.

**Git is the permanent layer.** [`.github/workflows/snapshot.yml`](.github/workflows/snapshot.yml)
runs twice a day (06:17 and 18:17 Central, plus a manual button) and commits everything
into [`data/`](data):

| File | What it is |
|---|---|
| `data/*.csv` | One CSV per table — open in Excel, R or pandas |
| `data/snapshot-latest.json` | The whole database in one file; this is what **Setup → Restore backup** reads |
| `data/backups/YYYY-MM-DD.json` | Dated snapshots. Daily for 60 days; the 1st of each month is kept forever |
| `data/analysis/` | Every analysis file Emma has uploaded, plus `index.csv` saying who uploaded what and when |
| `data/amendments.csv` | Every corrected or deleted value, with initials, date and the stated reason |
| `data/audit_log.csv` | Every change ever made: actor, action, table, row, and the fields that changed |
| `data/manifest.json` | Counts and timing, which the app's Setup tab reads back to show whether backups are keeping up |

The audit log is written by a **database trigger**, not by the app, so it cannot be
skipped or forged from the browser. Whatever the client does, the row gets logged with
whoever was selected in "Logging as".

Files are only rewritten when their content actually changed, so `git log data/` is a
meaningful history rather than a wall of identical commits. If the job ever stops, the
Setup tab turns the "last snapshot" line red after 36 hours.

Nothing is lost if Supabase disappears: `snapshot-latest.json` restores the entire trial
into a fresh project, or into a browser with no backend at all.

---

## Files

| File | What it is |
|---|---|
| `index.html` | The whole app — markup, styles, and logic in one file, no build step. |
| `config.js` | Every setting worth changing. The only file you normally edit. |
| `schema.sql` | Supabase tables, RLS policies, audit triggers, scoped delete functions, storage bucket. Safe to re-run. |
| `scripts/snapshot.mjs` | The export job. No dependencies; runs on Node 20+. |
| `docs/WALKTHROUGH.md` | The illustrated guide for Emma. |
| `.github/workflows/deploy.yml` | Publishes to GitHub Pages on push. |
| `.github/workflows/snapshot.yml` | Commits the data snapshot twice a day. |
| `.github/workflows/apply-sql.yml` | Applies `schema.sql` (and any file in `sql/`) to the database. |
| `sql/` | One-off scripts, kept so there is a record of every change made to the data. |

---

## Data model

| Table | Grain |
|---|---|
| `plants` | one row per plant — label, treatment, rep, container, sowing date, depth, seeds |
| `measurements` | one row per **plant per day**; every measurement column nullable, because the instruments run on different schedules |
| `doses` | one row per **plant per dosing event** — strength, volume, stock mL |
| `day_log` | one row per day — the time she measured, plus a day note |
| `weather_daily` | one row per day at the plot |
| `files` | uploaded working documents |
| `amendments` | one row per amended value — initials, date, reason, old and new value. The app will not change settled data without one |
| `audit_log` | one row per change, written by a trigger — actor, action, table, row, changed fields |

Leaves are a **total count on the plant that day**, not new leaves — a drop from 6 to 4
is real data, which is exactly the signal this trial is looking for.

`DD60 = max(0, (Tmax + Tmin)/2 − 60°F)`, the standard cotton heat-unit clock. The
cumulative column is usually a better x-axis than calendar days.

---

## Weather

Daily weather comes from [Open-Meteo](https://open-meteo.com) — no API key, no account,
free for non-commercial use. Recent days come from the forecast endpoint's `past_days`
window, older days from the ERA5 archive; the last six days are re-fetched each visit
because reanalysis values firm up after the fact.

The OpenWeather pipeline still works if you want station data instead: run
`weekly_append_tamucc.R` as before and import the resulting `weather_daily_summary.csv`
under **Setup → Import OpenWeather CSV**. Imported rows are tagged `openweather` and are
never overwritten by the automatic fetch. Every export carries a `Weather source` column
so the two are never silently mixed.

---

## Deep links

Handy for pointing someone straight at something:

```
?view=weather      open a tab directly (log, plants, weather, data, update, files, setup, help)
?plant=3           open one plant's history
?date=2026-09-01   open the log on a specific day
?demo=1            load the sample trial
```

---

## Troubleshooting

**"Waiting to sync" won't clear.** No connection to Supabase. Nothing is lost — the
writes are queued locally. Press **Sync now** in Setup once there's signal.

**Weather is missing for recent days.** The reanalysis lags about a day. **Refresh
weather** in Setup forces a re-fetch.

**Excel button does nothing.** The ExcelJS CDN did not load; the app falls back to CSV.
The data is fine either way.

**She wants to start the season over.** `truncate public.measurements, public.doses,
public.day_log, public.plants;` in the Supabase SQL editor. Take a backup first —
Setup → **Download backup**. The audit log survives a truncate, so the history of what
was there is still readable.

**The snapshot job stopped.** Check **Actions** for a failed run. Common causes: the
Supabase project was paused (free tier pauses after a week of no traffic — open the app
to wake it), or the anon key was rotated without updating `config.js`. The live data is
unaffected; you just have a gap in the committed history until the next successful run.

**Something was deleted or typed over and you want it back.** `data/audit_log.csv` shows
who changed what and when, and `data/backups/` has the state on every recent day. Restore
the relevant snapshot in a fresh browser to read it without touching the live database.

---

## Credits

Built for the Melaram Lab cotton × *Microcystis* trial, TAMU-CC.
Measurement protocol and cadence per Emma Doria; study design with Dr. Rajesh Melaram
and Dr. Josh McGinty.
