-- ============================================================
--  COTTON × MICROCYSTIS TRIAL — FIELD LOG
--  TAMU-CC · Melaram Lab
--
--  Supabase schema. Paste this whole file into:
--    Supabase dashboard -> SQL Editor -> New query -> Run
--  Safe to re-run: uses "if not exists" / "drop policy if exists".
--
--  OPTIONAL. With no Supabase keys in config.js the app runs entirely
--  in the browser (data saved on that one device). Adding Supabase is
--  what makes the log shared across phone + laptop + mentors, backed
--  up off the device, and is what enables file uploads.
-- ============================================================

-- ---------- tables ----------

-- One row per PLANT. Emma adds these herself in the app.
create table if not exists public.plants (
  id           int         primary key,      -- assigned by the app (1, 2, 3 ...)
  label        text        not null,         -- "C-1", "Low-3", whatever she writes on the pot
  treatment    text,                         -- 'Control' | 'Low 2%' | 'High 5%'
  rep          text,
  container    text,                         -- '5-gal', '1-gal', ...
  sown_on      date,                         -- date this plant was started
  seed_depth_in numeric,                     -- how deep it was sown
  seeds_sown   int,
  notes        text,
  active       boolean     not null default true,
  sort         int,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- One row per PLANT per DAY. Every measurement column is nullable
-- because the instruments run on different schedules (height daily,
-- SPAD weekly, ceptometer fortnightly).
create table if not exists public.measurements (
  obs_date     date        not null,
  plant_id     int         not null,
  height_cm    numeric,                      -- soil to top node, cm
  leaves       int,                          -- total leaves ON the plant that day
  internode_cm numeric,                      -- internode length, cm
  spad         numeric,                      -- SPAD value (chlorophyll meter)
  lai          numeric,                      -- leaf area index (ceptometer)
  note         text,
  recorded_by  text,
  updated_at   timestamptz not null default now(),
  primary key (obs_date, plant_id)
);

-- One row per PLANT per DOSING EVENT (the Microcystis exposure).
create table if not exists public.doses (
  id           bigserial   primary key,
  dose_date    date        not null,
  plant_id     int         not null,
  pct          numeric,                      -- 2 = low, 5 = high, 0 = control/water
  volume_ml    numeric,                      -- total volume poured, mL
  stock_ml     numeric,                      -- mL of Microcystis stock in that volume
  method       text,                         -- 'pour-on', ...
  note         text,
  recorded_by  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (dose_date, plant_id)
);

-- One row per DAY: the time she measured plus a day-level note.
create table if not exists public.day_log (
  log_date     date        primary key,
  obs_time     text,                         -- 'HH:MM' local
  notes        text,
  recorded_by  text,
  updated_at   timestamptz not null default now()
);

-- One row per DAY of weather at the plot. Filled automatically by the
-- app from Open-Meteo (no API key needed), or overwritten by importing
-- the OpenWeather pipeline's weather_daily_summary.csv.
create table if not exists public.weather_daily (
  wx_date      date        primary key,
  temp_max_f   numeric,
  temp_min_f   numeric,
  temp_mean_f  numeric,
  rain_in      numeric,
  humidity_pct numeric,
  cloud_pct    numeric,
  wind_max_mph numeric,
  et0_in       numeric,                      -- reference evapotranspiration, in
  solar_mj     numeric,                      -- shortwave radiation sum, MJ/m2
  source       text,                         -- 'open-meteo' | 'openweather'
  updated_at   timestamptz not null default now()
);

-- Working documents: her analysis workbook, protocols, photos.
create table if not exists public.files (
  id           bigserial   primary key,
  path         text        not null unique,  -- object path inside the storage bucket
  name         text        not null,
  kind         text,                         -- 'working' | 'protocol' | 'photo' | 'other'
  size_bytes   bigint,
  note         text,
  uploaded_by  text,
  created_at   timestamptz not null default now()
);

-- Study-wide settings (start date, cadence overrides) as key/value.
create table if not exists public.settings (
  key          text primary key,
  value        text,
  updated_at   timestamptz not null default now()
);

create index if not exists meas_plant_idx on public.measurements (plant_id, obs_date);
create index if not exists meas_date_idx  on public.measurements (obs_date);
create index if not exists doses_date_idx on public.doses (dose_date);

-- ---------- row level security ----------
alter table public.plants        enable row level security;
alter table public.measurements  enable row level security;
alter table public.doses         enable row level security;
alter table public.day_log       enable row level security;
alter table public.weather_daily enable row level security;
alter table public.files         enable row level security;
alter table public.settings      enable row level security;

-- Everyone with the link may READ. The whole point is that Emma, Aidan
-- and the mentors all see the same numbers.
drop policy if exists "plants_read"   on public.plants;
drop policy if exists "meas_read"     on public.measurements;
drop policy if exists "doses_read"    on public.doses;
drop policy if exists "day_read"      on public.day_log;
drop policy if exists "wx_read"       on public.weather_daily;
drop policy if exists "files_read"    on public.files;
drop policy if exists "settings_read" on public.settings;
create policy "plants_read"   on public.plants        for select using (true);
create policy "meas_read"     on public.measurements  for select using (true);
create policy "doses_read"    on public.doses         for select using (true);
create policy "day_read"      on public.day_log       for select using (true);
create policy "wx_read"       on public.weather_daily for select using (true);
create policy "files_read"    on public.files         for select using (true);
create policy "settings_read" on public.settings      for select using (true);

-- Anyone with the link may INSERT + UPDATE (the app upserts as you type).
drop policy if exists "plants_insert"   on public.plants;
drop policy if exists "meas_insert"     on public.measurements;
drop policy if exists "doses_insert"    on public.doses;
drop policy if exists "day_insert"      on public.day_log;
drop policy if exists "wx_insert"       on public.weather_daily;
drop policy if exists "files_insert"    on public.files;
drop policy if exists "settings_insert" on public.settings;
create policy "plants_insert"   on public.plants        for insert with check (true);
create policy "meas_insert"     on public.measurements  for insert with check (true);
create policy "doses_insert"    on public.doses         for insert with check (true);
create policy "day_insert"      on public.day_log       for insert with check (true);
create policy "wx_insert"       on public.weather_daily for insert with check (true);
create policy "files_insert"    on public.files         for insert with check (true);
create policy "settings_insert" on public.settings      for insert with check (true);

drop policy if exists "plants_update"   on public.plants;
drop policy if exists "meas_update"     on public.measurements;
drop policy if exists "doses_update"    on public.doses;
drop policy if exists "day_update"      on public.day_log;
drop policy if exists "wx_update"       on public.weather_daily;
drop policy if exists "settings_update" on public.settings;
create policy "plants_update"   on public.plants        for update using (true) with check (true);
create policy "meas_update"     on public.measurements  for update using (true) with check (true);
create policy "doses_update"    on public.doses         for update using (true) with check (true);
create policy "day_update"      on public.day_log       for update using (true) with check (true);
create policy "wx_update"       on public.weather_daily for update using (true) with check (true);
create policy "settings_update" on public.settings      for update using (true) with check (true);

-- NOTE: there is no blanket DELETE policy, so the public anon key cannot
-- wipe the season through the table API. The three narrow deletes the UI
-- actually needs go through scoped functions instead.
create or replace function public.clear_measurement(p_date date, p_plant int)
returns void language sql security definer set search_path = public as $fn$
  delete from public.measurements where obs_date = p_date and plant_id = p_plant;
$fn$;

create or replace function public.delete_dose(p_id bigint)
returns void language sql security definer set search_path = public as $fn$
  delete from public.doses where id = p_id;
$fn$;

create or replace function public.delete_file(p_id bigint)
returns void language sql security definer set search_path = public as $fn$
  delete from public.files where id = p_id;
$fn$;

-- Retiring a plant is a flag, never a delete — its history stays.
grant execute on function public.clear_measurement(date, int) to anon;
grant execute on function public.delete_dose(bigint) to anon;
grant execute on function public.delete_file(bigint) to anon;

-- ---------- file storage ----------
-- Bucket for her working Excel, protocols and photos. Public read so a
-- mentor can open a download link without an account.
insert into storage.buckets (id, name, public)
values ('files', 'files', true)
on conflict (id) do update set public = true;

drop policy if exists "files_bucket_read"   on storage.objects;
drop policy if exists "files_bucket_write"  on storage.objects;
drop policy if exists "files_bucket_update" on storage.objects;
create policy "files_bucket_read"   on storage.objects for select using (bucket_id = 'files');
create policy "files_bucket_write"  on storage.objects for insert with check (bucket_id = 'files');
create policy "files_bucket_update" on storage.objects for update using (bucket_id = 'files') with check (bucket_id = 'files');

-- ---------- audit trail ----------
-- Every write is recorded server-side by a trigger, so the log cannot be
-- skipped or faked by the browser. This is what gets exported to the repo
-- as data/audit_log.csv: who changed what, and when.
alter table public.plants add column if not exists updated_by text;

create table if not exists public.audit_log (
  id       bigserial   primary key,
  at       timestamptz not null default now(),
  actor    text,                              -- the name selected in "Logging as"
  action   text        not null,              -- insert | update | delete
  tbl      text        not null,
  row_key  text,                              -- human-readable: "2026-09-01 / plant 3"
  changes  jsonb                              -- inserted row, or just the fields that changed
);
create index if not exists audit_at_idx on public.audit_log (at desc);

alter table public.audit_log enable row level security;
drop policy if exists "audit_read" on public.audit_log;
create policy "audit_read" on public.audit_log for select using (true);
-- No insert/update/delete policy on purpose: rows can ONLY arrive via the
-- trigger below, which runs as the table owner and bypasses RLS.

create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  n    jsonb := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
  o    jsonb := case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end;
  diff jsonb := '{}'::jsonb;
  k    text;
begin
  if TG_OP = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      if k <> 'updated_at' and (n -> k) is distinct from (o -> k) then
        diff := diff || jsonb_build_object(k, n -> k);
      end if;
    end loop;
    if diff = '{}'::jsonb then return null; end if;   -- a touch with no real change
  else
    diff := n;
  end if;

  insert into public.audit_log (actor, action, tbl, row_key, changes)
  values (
    coalesce(n ->> 'recorded_by', n ->> 'uploaded_by', n ->> 'updated_by', 'unknown'),
    lower(TG_OP),
    TG_TABLE_NAME,
    case TG_TABLE_NAME
      when 'measurements' then (n ->> 'obs_date') || ' / plant ' || (n ->> 'plant_id')
      when 'doses'        then (n ->> 'dose_date') || ' / plant ' || (n ->> 'plant_id')
      when 'plants'       then 'plant ' || (n ->> 'id') || ' (' || coalesce(n ->> 'label', '') || ')'
      when 'day_log'      then (n ->> 'log_date')
      when 'files'        then coalesce(n ->> 'name', n ->> 'path')
      when 'weather_daily' then (n ->> 'wx_date')
      else coalesce(n ->> 'id', '')
    end,
    diff
  );
  return null;
end
$fn$;

do $do$
declare t text;
begin
  foreach t in array array['plants', 'measurements', 'doses', 'day_log', 'files'] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$s
         for each row execute function public.audit_row()', t);
  end loop;
end
$do$;
-- Weather is machine-fetched, so it is deliberately NOT audited — it would
-- bury the human entries under thousands of automatic rows.

-- ---------- realtime ----------
-- So a second device (or Dr. Melaram watching) updates live.
do $do$
begin
  begin execute 'alter publication supabase_realtime add table public.measurements';  exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.plants';        exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.doses';         exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.day_log';       exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.weather_daily'; exception when others then null; end;
end
$do$;

-- ============================================================
--  Handy checks:
--    select count(*) from public.measurements;
--    select obs_date, count(*) from public.measurements group by 1 order by 1 desc limit 14;
--    select * from public.doses order by dose_date desc;
--  To wipe and start the season over (careful):
--    truncate public.measurements, public.doses, public.day_log, public.plants;
-- ============================================================
