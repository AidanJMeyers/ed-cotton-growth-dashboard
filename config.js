// ============================================================
//  COTTON × MICROCYSTIS FIELD LOG — CONFIG
//
//  Everything Aidan might need to change lives in this one file.
//  Edit, save, commit, push. Nothing else needs touching.
//
//  The app works with NO changes at all: leave SUPABASE_URL blank and
//  it stores data in the browser on that one device. Fill the two
//  Supabase values in and the same log is shared across her phone, her
//  laptop, and anyone with the link — and file uploads switch on.
// ============================================================
window.COTTON_CONFIG = {

  // ---------- study identity ----------
  STUDY_NAME: "Cotton × Microcystis Trial",
  SITE_NAME:  "TAMU-CC · Melaram Lab",

  // Day 0 for the "DAP" (days after planting) counter. Each plant also
  // carries its own sowing date, which is what per-plant age uses.
  START_DATE: "2026-08-25",

  // Plot coordinates — used to pull the weather. Decimal degrees.
  // (Field GPS 27°42'54.5"N 97°19'39.0"W = 27.71514, -97.32750)
  LAT: 27.71514,
  LON: -97.32750,
  TIMEZONE: "America/Chicago",

  // ---------- who is logging ----------
  // First name is the default. "Someone else" is always offered too.
  PEOPLE: ["Emma", "Aidan", "Dr. Melaram"],

  // ---------- treatment groups ----------
  // Microcystis pour-on. pct is the strength of the solution; the app
  // pre-fills the dosing form from this so the numbers stay consistent.
  TREATMENTS: [
    { name: "Control",  pct: 0, color: "#5d6b62" },
    { name: "Low 2%",   pct: 2, color: "#2f6f96" },
    { name: "High 5%",  pct: 5, color: "#b4622f" }
  ],

  // Standard dose: 100 mL total, so 2% = 2 mL stock + 98 mL water,
  // 5% = 5 mL stock + 95 mL water.
  DOSE_VOLUME_ML: 100,

  // ---------- what gets measured, and how often ----------
  //  cadence: "daily" | "weekly" | "biweekly"
  //  dow:     day of week for weekly/biweekly (0 = Sun … 5 = Fri)
  //  postDose:true = also due N days after a dosing event (POST_DOSE_DAYS)
  //  delta:   "pct" shows a % change arrow, "abs" shows +/- the raw change
  //  Set on:false to hide a measurement completely (UI and exports).
  MEASURES: {
    height_cm:    { on: true, label: "Height",    unit: "cm",  cadence: "daily",    step: 0.1,  min: 0, max: 400, delta: "pct", hint: "soil to top node" },
    leaves:       { on: true, label: "Leaves",    unit: "count", cadence: "daily",  step: 1,    min: 0, max: 200, delta: "abs", hint: "total leaves on the plant today" },
    internode_cm: { on: true, label: "Internode", unit: "cm",  cadence: "daily",    step: 0.1,  min: 0, max: 100, delta: "pct", hint: "once plants are big enough" },
    spad:         { on: true, label: "SPAD",      unit: "SPAD value", cadence: "weekly",   dow: 5, postDose: true, step: 0.1,  min: 0, max: 100, delta: "pct", hint: "chlorophyll meter — Fridays" },
    lai:          { on: true, label: "LAI",       unit: "leaf area index", cadence: "biweekly", dow: 5, postDose: true, step: 0.01, min: 0, max: 15,  delta: "pct", hint: "ceptometer — every other Friday" }
  },

  // SPAD and the ceptometer are also due this many days after a dose,
  // when the response is expected to be largest.
  POST_DOSE_DAYS: 3,

  // Base temperature for cotton heat units (DD60s), °F.
  // DD60 = max(0, (Tmax + Tmin)/2 - 60). Cumulative DD60 is in the export.
  DD_BASE_F: 60,

  // ---------- shared storage + file uploads (optional) ----------
  // Supabase dashboard -> Project Settings -> API.
  // 1) "Project URL"         e.g. https://abcdefghijkl.supabase.co
  // 2) "anon" / "public" key  (long JWT starting "eyJ...")
  //
  // The anon key is a PUBLIC key by design — it ships to the browser and
  // is safe to commit. Row Level Security in schema.sql protects the data.
  // NEVER paste the "service_role" key here.
  //
  // Leave both blank to run in on-this-device mode.
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: ""
};
