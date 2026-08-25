#!/usr/bin/env node
/**
 * Pull everything out of Supabase and write it into the repo as plain files.
 *
 * Run by .github/workflows/snapshot.yml on a schedule (and on demand). The
 * point is that the live database is convenient but not permanent — git is.
 * Every run leaves behind CSVs anyone can open, a full JSON snapshot, dated
 * backups, the audit log of who changed what, and copies of Emma's uploaded
 * analysis files.
 *
 * No dependencies: Node 20+ has fetch built in.
 *
 * Credentials: reads SUPABASE_URL / SUPABASE_ANON_KEY from the environment,
 * and falls back to parsing config.js so there is nothing to configure twice.
 * The anon key is read-only enough for this and is already public in the page.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const BACKUPS = join(DATA, "backups");
const ANALYSIS = join(DATA, "analysis");

const KEEP_DAILY_DAYS = 60;          // every daily backup for this long
const MAX_FILE_MB = 25;              // skip mirroring anything bigger
const TABLES = {
  plants:        "id",
  measurements:  "obs_date,plant_id",
  doses:         "dose_date,plant_id",
  day_log:       "log_date",
  weather_daily: "wx_date",
  audit_log:     "at",
  amendments:    "at",
  files:         "created_at"
};

/* ---------- credentials ---------- */
function credentials() {
  let url = process.env.SUPABASE_URL || "";
  let key = process.env.SUPABASE_ANON_KEY || "";
  if (!url || !key) {
    try {
      const cfg = readFileSync(join(ROOT, "config.js"), "utf8");
      url = url || (cfg.match(/SUPABASE_URL:\s*"([^"]*)"/) || [])[1] || "";
      key = key || (cfg.match(/SUPABASE_ANON_KEY:\s*"([^"]*)"/) || [])[1] || "";
    } catch { /* config.js is optional if env vars are set */ }
  }
  // tolerate a Project URL pasted with the API path already on it
  return { url: url.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, ""), key: key.trim() };
}

/* ---------- fetching ---------- */
async function fetchTable(url, key, table, order) {
  const rows = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const q = `${url}/rest/v1/${table}?select=*&order=${encodeURIComponent(order)}&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(q, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 404 || /does not exist/i.test(body)) {
        console.log(`  ${table}: not present in this database, skipping`);
        return null;
      }
      throw new Error(`${table}: ${res.status} ${body.slice(0, 200)}`);
    }
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

/* ---------- csv ---------- */
function csvCell(v) {
  if (v == null) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows) {
  if (!rows.length) return "";
  const cols = [...rows.reduce((set, r) => { Object.keys(r).forEach(k => set.add(k)); return set; }, new Set())];
  return [cols.join(","), ...rows.map(r => cols.map(c => csvCell(r[c])).join(","))].join("\n") + "\n";
}
/** Only write when the content actually differs, so unchanged files keep their history clean. */
function writeIfChanged(path, content) {
  if (existsSync(path) && readFileSync(path, "utf8") === content) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return true;
}

/* ---------- analysis file mirror ---------- */
async function mirrorFiles(url, key, files) {
  mkdirSync(ANALYSIS, { recursive: true });
  const index = [];
  let added = 0;
  for (const f of files) {
    const stamp = (f.created_at || "").slice(0, 10);
    const safe = String(f.name || f.path).replace(/[^\w.\- ]+/g, "_");
    const local = `${stamp}_${safe}`;
    index.push({
      file: local, uploaded_at: f.created_at, uploaded_by: f.uploaded_by || "",
      kind: f.kind || "", size_bytes: f.size_bytes ?? "", note: f.note || "", storage_path: f.path
    });
    const dest = join(ANALYSIS, local);
    if (existsSync(dest)) continue;                                  // already mirrored, never re-download
    if (f.size_bytes && f.size_bytes > MAX_FILE_MB * 1024 * 1024) {
      console.log(`  skipping ${f.name} (${(f.size_bytes / 1e6).toFixed(1)} MB > ${MAX_FILE_MB} MB cap)`);
      continue;
    }
    const src = `${url}/storage/v1/object/public/files/${encodeURI(f.path)}`;
    const res = await fetch(src, { headers: { apikey: key } });
    if (!res.ok) { console.log(`  could not fetch ${f.path}: ${res.status}`); continue; }
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    added++;
    console.log(`  mirrored ${local}`);
  }
  index.sort((a, b) => String(b.uploaded_at).localeCompare(String(a.uploaded_at)));
  writeIfChanged(join(ANALYSIS, "index.csv"), toCsv(index));
  return { added, total: index.length, latest: index[0] || null };
}

/* ---------- backup rotation ---------- */
function pruneBackups() {
  if (!existsSync(BACKUPS)) return 0;
  const cutoff = Date.now() - KEEP_DAILY_DAYS * 86400000;
  let removed = 0;
  for (const name of readdirSync(BACKUPS)) {
    const m = name.match(/^(\d{4})-(\d{2})-(\d{2})\.json$/);
    if (!m) continue;
    if (m[3] === "01") continue;                                     // month-start backups are kept forever
    const when = Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
    if (when < cutoff) { rmSync(join(BACKUPS, name)); removed++; }
  }
  return removed;
}

/* ---------- readme ---------- */
function dataReadme(m) {
  const n = m.counts;
  return `# Data

**Do not edit these files by hand.** They are regenerated from the live database by
[\`.github/workflows/snapshot.yml\`](../.github/workflows/snapshot.yml). Anything typed
here will be overwritten on the next run — record data in the app instead.

This folder is the permanent record. The app is where the work happens; git is where
it survives.

Last snapshot: **${m.generated_at}**

| File | Rows | What it is |
|---|---|---|
| \`plants.csv\` | ${n.plants ?? 0} | One row per plant: label, treatment, rep, container, sowing date, depth, seeds |
| \`measurements.csv\` | ${n.measurements ?? 0} | One row per plant per day. Blank means not measured, which is not the same as zero |
| \`doses.csv\` | ${n.doses ?? 0} | One row per plant per Microcystis exposure: strength, volume, stock mL |
| \`day_log.csv\` | ${n.day_log ?? 0} | One row per day: the time measurements were taken, plus the day note |
| \`weather_daily.csv\` | ${n.weather_daily ?? 0} | Daily conditions at the plot from Open-Meteo, including DD60 heat units |
| \`amendments.csv\` | ${n.amendments ?? 0} | Reason-for-change record: every value edited or removed after it was first saved, with initials and why |
| \`audit_log.csv\` | ${n.audit_log ?? 0} | Every change ever made: who, what, when. Written by a database trigger, so it cannot be skipped from the app |
| \`snapshot-latest.json\` | — | Everything above in one file. This is what a restore reads |
| \`backups/\` | ${m.backups} | Dated snapshots. Daily for ${KEEP_DAILY_DAYS} days; the 1st of each month is kept permanently |
| \`analysis/\` | ${m.analysis.total} | Copies of every analysis file uploaded through the app, with \`index.csv\` listing who uploaded what and when |

## Restoring

Open the app, then **Setup → Restore backup** and pick \`snapshot-latest.json\` (or any
dated file from \`backups/\`). Restoring merges by timestamp: newer rows win, and nothing
already in the database is dropped.

## Reading it elsewhere

The CSVs open directly in Excel, R (\`read.csv\`) or Python (\`pandas.read_csv\`).
For analysis-ready data with the weather already joined onto every growth row, use the
app's **Data & export → Download Excel** instead — these files are the raw tables.
`;
}

/* ---------- main ---------- */
async function main() {
  const { url, key } = credentials();
  if (!url || !key) {
    // Not an error: the app runs fine without Supabase, there is just nothing
    // to snapshot yet. Exit clean so the scheduled run isn't a red X every day.
    console.log("No Supabase credentials found in config.js or the environment.");
    console.log("Nothing to snapshot — fill SUPABASE_URL and SUPABASE_ANON_KEY into config.js to switch this on.");
    return;
  }
  console.log(`Snapshotting ${url}`);
  mkdirSync(DATA, { recursive: true });

  const data = {};
  const counts = {};
  for (const [table, order] of Object.entries(TABLES)) {
    const rows = await fetchTable(url, key, table, order);
    if (rows === null) continue;
    data[table] = rows;
    counts[table] = rows.length;
    const changed = writeIfChanged(join(DATA, `${table}.csv`), toCsv(rows));
    console.log(`  ${table}: ${rows.length} rows${changed ? " (changed)" : ""}`);
  }

  const analysis = await mirrorFiles(url, key, data.files || []);

  // who has been active recently, for the commit message
  const since = Date.now() - 7 * 86400000;
  const actors = {};
  for (const a of data.audit_log || []) {
    if (Date.parse(a.at) >= since) actors[a.actor || "unknown"] = (actors[a.actor || "unknown"] || 0) + 1;
  }

  const generated_at = new Date().toISOString();
  const snapshot = { app: "cotton-field-log", version: 2, generated_at, counts, ...data };
  writeIfChanged(join(DATA, "snapshot-latest.json"), JSON.stringify(snapshot, null, 2) + "\n");

  mkdirSync(BACKUPS, { recursive: true });
  const today = generated_at.slice(0, 10);
  writeFileSync(join(BACKUPS, `${today}.json`), JSON.stringify(snapshot) + "\n");
  const pruned = pruneBackups();
  const backups = readdirSync(BACKUPS).filter(f => f.endsWith(".json")).length;

  const manifest = {
    app: "cotton-field-log", generated_at, counts, backups, pruned,
    analysis: { total: analysis.total, latest: analysis.latest },
    active_last_7_days: actors,
    last_measurement: (data.measurements || []).reduce((a, r) => r.obs_date > a ? r.obs_date : a, ""),
    last_dose: (data.doses || []).reduce((a, r) => r.dose_date > a ? r.dose_date : a, "")
  };
  writeIfChanged(join(DATA, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  writeIfChanged(join(DATA, "README.md"), dataReadme(manifest));

  const who = Object.entries(actors).map(([a, c]) => `${a} ${c}`).join(", ");
  const summary = `${counts.measurements ?? 0} plant-days, ${counts.doses ?? 0} doses, ${analysis.total} analysis file(s)` +
                  (who ? ` · active this week: ${who}` : "");
  console.log(`\n${summary}`);
  if (pruned) console.log(`pruned ${pruned} old daily backup(s)`);

  // hand the summary to the workflow for the commit message
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(process.env.GITHUB_OUTPUT, `summary=${summary}\n`, { flag: "a" });
  }
}

main().catch(err => { console.error(err); process.exit(1); });
