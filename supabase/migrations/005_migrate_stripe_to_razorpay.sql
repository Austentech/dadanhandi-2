-- ============================================================================
-- Migration 005: Migrate Stripe columns/functions → Razorpay (idempotent)
-- ----------------------------------------------------------------------------
-- BACKGROUND:
--   Migration 004 was originally written for Stripe. It created columns like
--   `stripe_payment_intent_id` on `orders` / `payments`, and an RPC named
--   `attach_payment_intent_to_order`. The `mark_order_succeeded` RPC took
--   5 params (no signature column).
--
--   Migration 004 was later rewritten to use Razorpay column names
--   (`razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`) and a
--   new RPC `attach_razorpay_order_to_order`. `mark_order_succeeded` now takes
--   6 params.
--
--   PROBLEM: If you already ran the OLD 004 (Stripe version), your tables
--   have the OLD Stripe columns. Re-running the NEW 004 fails because:
--     - `CREATE TABLE IF NOT EXISTS` is skipped (tables already exist)
--     - `CREATE INDEX ... ON orders(razorpay_order_id)` FAILS because that
--       column does not exist yet.
--
--   This migration (005) bridges the gap. It is FULLY IDEMPOTENT — safe to
--   run on:
--     (a) a DB that still has Stripe columns (performs the rename/drop)
--     (b) a DB that already has Razorpay columns (no-op)
--     (c) a fresh DB (adds Razorpay columns if missing — rare case)
--
--   AFTER running 005, re-run 004. It will now succeed because:
--     - Razorpay columns exist → CREATE INDEX succeeds
--     - Old `attach_payment_intent_to_order` is dropped → no conflict
--     - Old 5-param `mark_order_succeeded` is dropped → new 6-param version
--       can be CREATEd (CREATE OR REPLACE cannot change param count)
--
--   Order of execution for a Stripe-migrated DB:
--     1. Run 005_migrate_stripe_to_razorpay.sql   ← THIS FILE
--     2. Re-run 004_create_checkout_payment_rewards.sql
--        (creates new Razorpay RPCs + any missing indexes/policies)
--
--   A fresh DB that has never seen Stripe should run ONLY 004 (skip 005).
-- ============================================================================

-- ============================================================================
-- STEP 1: MIGRATE `orders` TABLE COLUMNS
-- ============================================================================
-- Rename `stripe_payment_intent_id` → `razorpay_order_id` if the old column
-- exists. Otherwise, add `razorpay_order_id` if it is missing entirely.
-- ============================================================================
do $$
begin
  -- Case A: old Stripe column exists → rename it
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'stripe_payment_intent_id'
  ) then
    -- If razorpay_order_id already exists too (shouldn't happen, but be safe),
    -- drop the old Stripe column instead of renaming (avoids duplicate).
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'razorpay_order_id'
    ) then
      alter table public.orders drop column stripe_payment_intent_id;
    else
      alter table public.orders rename column stripe_payment_intent_id to razorpay_order_id;
      -- The old unique constraint (if any) is preserved by the rename.
    end if;
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'razorpay_order_id'
  ) then
    -- Case B: neither old nor new column exists → add fresh
    alter table public.orders add column razorpay_order_id text unique;
  end if;
  -- Case C: razorpay_order_id already exists → no-op
end $$;

-- ============================================================================
-- STEP 2: MIGRATE `payments` TABLE COLUMNS
-- ============================================================================
-- Rename:
--   stripe_payment_intent_id → razorpay_order_id
--   stripe_charge_id         → razorpay_payment_id
-- Add (if missing):
--   razorpay_signature       text
-- ============================================================================
do $$
begin
  -- --- stripe_payment_intent_id → razorpay_order_id ---
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name = 'stripe_payment_intent_id'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'payments'
        and column_name = 'razorpay_order_id'
    ) then
      alter table public.payments drop column stripe_payment_intent_id;
    else
      alter table public.payments rename column stripe_payment_intent_id to razorpay_order_id;
    end if;
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name = 'razorpay_order_id'
  ) then
    alter table public.payments add column razorpay_order_id text not null default '';
    -- Drop the dangerous default after backfill (empty string is fine for legacy rows)
    alter table public.payments alter column razorpay_order_id drop default;
  end if;

  -- --- stripe_charge_id → razorpay_payment_id ---
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name = 'stripe_charge_id'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'payments'
        and column_name = 'razorpay_payment_id'
    ) then
      alter table public.payments drop column stripe_charge_id;
    else
      alter table public.payments rename column stripe_charge_id to razorpay_payment_id;
    end if;
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name = 'razorpay_payment_id'
  ) then
    alter table public.payments add column razorpay_payment_id text;
  end if;

  -- --- razorpay_signature (new column, no Stripe equivalent) ---
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name = 'razorpay_signature'
  ) then
    alter table public.payments add column razorpay_signature text;
  end if;
end $$;

-- ============================================================================
-- STEP 3: REBUILD INDEXES
-- ============================================================================
-- Drop any old Stripe-named indexes (if they exist) and create the new
-- Razorpay-named indexes. All operations are IF EXISTS / IF NOT EXISTS so
-- this block is safe to re-run.
-- ============================================================================

-- Old Stripe indexes (best-effort drop — they may or may not exist depending
-- on which 004 version was originally applied).
drop index if exists public.idx_orders_payment_intent;
drop index if exists public.idx_orders_stripe_payment_intent;
drop index if exists public.idx_payments_payment_intent;
drop index if exists public.idx_payments_stripe_payment_intent;
drop index if exists public.idx_payments_stripe_charge;

-- New Razorpay indexes (created only if missing).
-- NOTE: These match the index names defined in migration 004, so if 004 has
-- already managed to create them, this is a no-op.
create index if not exists idx_orders_razorpay_order
  on public.orders(razorpay_order_id);
create index if not exists idx_payments_razorpay_order
  on public.payments(razorpay_order_id);

-- ============================================================================
-- STEP 4: DROP OLD STRIPE RPC FUNCTIONS
-- ============================================================================
-- Two old Stripe RPCs must be dropped before re-running 004, otherwise the
-- new 004 cannot CREATE the replacement functions:
--
--   1. `attach_payment_intent_to_order(uuid, uuid, text, integer)`
--      - Old Stripe RPC. Renamed to `attach_razorpay_order_to_order` in new
--        004. Old version is orphaned and must be dropped.
--
--   2. `mark_order_succeeded(uuid, text, text, text, jsonb)` — 5 params
--      - Old Stripe signature (charge_id only, no signature).
--      - New Razorpay signature has 6 params (adds `p_razorpay_signature`).
--      - PostgreSQL CREATE OR REPLACE FUNCTION cannot change param count,
--        so the old function MUST be dropped first.
--
--   3. `mark_order_failed(uuid, text, text, text, jsonb)` — 5 params
--      - Same signature in both Stripe and Razorpay versions.
--      - We drop it here anyway so re-running 004 cleanly recreates it with
--        the Razorpay-aware body (references `razorpay_order_id`).
--
-- All drops use IF EXISTS so they are safe on a fresh DB.
-- ============================================================================

drop function if exists public.attach_payment_intent_to_order(uuid, uuid, text, integer);
drop function if exists public.attach_payment_intent_to_order(uuid, uuid, text, bigint);
drop function if exists public.attach_payment_intent_to_order(uuid, uuid, text, numeric);

-- Old 5-param mark_order_succeeded (Stripe version).
drop function if exists public.mark_order_succeeded(uuid, text, text, text, jsonb);

-- Old mark_order_failed — same param signature as new, but body referenced
-- Stripe columns. Drop so re-running 004 cleanly recreates it.
drop function if exists public.mark_order_failed(uuid, text, text, text, jsonb);

-- ============================================================================
-- STEP 5: VERIFY (optional sanity check, non-fatal)
-- ============================================================================
-- Quick verification that the columns now exist. This is informational only;
-- if it fails, the migration still commits above changes. Run this SELECT
-- manually after the migration to confirm:
--
--   select
--     (select count(*) from information_schema.columns
--        where table_schema='public' and table_name='orders'
--          and column_name='razorpay_order_id') as orders_has_rzp,
--     (select count(*) from information_schema.columns
--        where table_schema='public' and table_name='payments'
--          and column_name='razorpay_order_id') as payments_has_rzp_order,
--     (select count(*) from information_schema.columns
--        where table_schema='public' and table_name='payments'
--          and column_name='razorpay_payment_id') as payments_has_rzp_payment,
--     (select count(*) from information_schema.columns
--        where table_schema='public' and table_name='payments'
--          and column_name='razorpay_signature') as payments_has_rzp_sig;
--
-- Expected: all four columns should return 1.
-- ============================================================================

-- ============================================================================
-- DONE.
-- ----------------------------------------------------------------------------
-- NEXT STEPS:
--   1. ✅ Run this 005 migration (you just did).
--   2. 🔁 Re-run 004_create_checkout_payment_rewards.sql.
--      It will now succeed — creates the new Razorpay RPCs
--      (attach_razorpay_order_to_order, mark_order_succeeded with 6 params,
--       mark_order_failed) and any missing indexes/policies.
--   3. ✅ Done. Your DB is now Razorpay-ready.
-- ============================================================================
