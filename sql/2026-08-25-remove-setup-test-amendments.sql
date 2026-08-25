-- One-off cleanup, 2026-08-25.
--
-- Three rows were written into public.amendments while verifying that the
-- reason-for-change record accepted writes and could not afterwards be
-- edited or deleted through the public key. They are not real corrections,
-- and left in place they would appear on the Corrections sheet of Emma's
-- Excel export as amendments against a record called "connection test".
--
-- Emma's initials are ED, so matching on 'NA' cannot catch a real row; the
-- date bound makes that certain. RETURNING prints exactly what was removed
-- into the workflow log, which is itself a record of the cleanup.
--
-- Safe to re-run: after the first run it deletes nothing.

delete from public.amendments
where initials = 'NA'
  and at < timestamptz '2026-08-26'
returning id, at, initials, actor, row_key, reason;

-- The four 'setup check' rows in public.audit_log are deliberately NOT
-- removed. That table is the tamper-evident record of every write, and
-- those rows are the evidence its trigger fires. Deleting them to make the
-- log look tidy is the opposite of what an audit trail is for.
