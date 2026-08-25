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
| **Weekly update** | Generates the written summary — growth per group, dosing, conditions, anything moving backwards — ready to paste into an email. |
| **Files** | Emma uploads her working analysis workbook; anyone with the link can download the latest version. |
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

### 3. Publish it

Push to GitHub and enable **Settings → Pages → Source: GitHub Actions**.
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) publishes on every push
to `main`. Send Emma the URL.

---

## Files

| File | What it is |
|---|---|
| `index.html` | The whole app — markup, styles, and logic in one file, no build step. |
| `config.js` | Every setting worth changing. The only file you normally edit. |
| `schema.sql` | Supabase tables, RLS policies, scoped delete functions, storage bucket. Safe to re-run. |
| `docs/WALKTHROUGH.md` | The illustrated guide for Emma. |
| `.github/workflows/deploy.yml` | Publishes to GitHub Pages on push. |

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
Setup → **Download backup**.

---

## Credits

Built for the Melaram Lab cotton × *Microcystis* trial, TAMU-CC.
Measurement protocol and cadence per Emma Doria; study design with Dr. Rajesh Melaram
and Dr. Josh McGinty.
