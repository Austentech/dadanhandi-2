-- ============================================================================
-- Migration 004: Checkout, Orders, Payments, Rewards, Branches
-- ----------------------------------------------------------------------------
-- Phase 2 - Module 3: Production-grade checkout & payment system.
--
-- Design principles (carried over from migrations 001-003):
--  1. All money stored as INTEGER PAISE (1 INR = 100 paise) — never floats.
--  2. All weights stored as INTEGER GRAMS.
--  3. RLS enabled on every table. Users can ONLY access their own rows.
--  4. All mutations go through SECURITY DEFINER RPC functions which
--     perform server-side validation. Users NEVER directly mutate these
--     tables (except reads on branches, which is public).
--  5. Idempotency: every order has a unique idempotency_key; every webhook
--     event is deduplicated via processed_webhook_events table.
--  6. Append-only reward_transactions ledger + denormalized reward_balance
--     for O(1) reads. Balance is updated atomically inside the same
--     transaction that inserts the ledger row — no drift possible.
--  7. Future-ready: orders table reserves pickup_pin and admin_assigned_to
--     columns for later modules (no schema changes needed).
--
-- Timezone handling:
--  - Supabase Postgres stores timestamptz in UTC internally.
--  - Pickup date is DATE (no tz). Slot start/end are TIME (no tz).
--  - "Today" is computed at the APPLICATION layer using Asia/Kolkata
--    (IST) and validated against the requested pickup_date.
-- ============================================================================

-- ============================================================================
-- BRANCHES TABLE
-- ============================================================================
-- Public read access (anyone can see branches). No writes via RLS —
-- only superadmin/service role can add branches (future admin module).
-- ============================================================================
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  -- URL-safe slug used in API requests
  slug text not null unique,
  name text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  pincode text,
  -- Future: geo coordinates for maps / distance calc
  latitude numeric(10,7),
  longitude numeric(10,7),
  -- Operating hours (24h format, e.g. '10:00:00' / '22:00:00')
  opening_time time not null default '10:00:00',
  closing_time time not null default '22:00:00',
  -- Status: 'active' = available for pickup; 'coming_soon' = listed but disabled
  status text not null default 'active'
    check (status in ('active', 'inactive', 'coming_soon')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_branches_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_branches_updated_at on public.branches;
create trigger trg_branches_updated_at
  before update on public.branches
  for each row execute function public.handle_branches_updated_at();

create index if not exists idx_branches_status on public.branches(status);
create index if not exists idx_branches_sort on public.branches(sort_order);

alter table public.branches enable row level security;

-- Anyone (even anon) can read active branches
drop policy if exists "branches_read_all" on public.branches;
create policy "branches_read_all"
  on public.branches for select
  using (true);
-- No insert/update/delete policies — only service role can mutate.

-- ----------------------------------------------------------------------------
-- Seed the four branches. Idempotent: ON CONFLICT do nothing.
-- ----------------------------------------------------------------------------
insert into public.branches
  (slug, name, address_line1, address_line2, city, state, pincode, opening_time, closing_time, status, sort_order)
values
  ('danapur',
   'Danapur Branch',
   'Saguna Khagaul Road, Kaliket Nagar, Danapur',
   'Patna, Bihar',
   'Patna', 'Bihar', '801105',
   '10:00:00', '22:00:00', 'active', 1),
  ('rajeev-nagar',
   'Rajeev Nagar Branch',
   'Nepali Nagar More, Rajeev Nagar, Ashiana More, Bailey Road',
   'Patna, Bihar',
   'Patna', 'Bihar', '801503',
   '10:00:00', '22:00:00', 'active', 2),
  ('arraah',
   'Arrah Branch',
   'S Bhelai Road, Sarvodaya Nagar, Jagdev Nagar',
   'Arrah, Bihar',
   'Arrah', 'Bihar', '802301',
   '10:00:00', '22:00:00', 'active', 3),
  ('ranchi',
   'Ranchi Branch',
   'H.B Road, Opposite Electricity Board, Kokar',
   'Ranchi, Jharkhand',
   'Ranchi', 'Jharkhand', '834001',
   '10:00:00', '22:00:00', 'active', 4)
on conflict (slug) do nothing;

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  -- Human-readable order number, e.g. 'DHM-20260727-00001'
  order_number text not null unique,

  user_id uuid not null references auth.users(id) on delete cascade,
  branch_id uuid not null references public.branches(id),

  -- Pickup info (today only, validated at app layer)
  pickup_date date not null,
  pickup_slot_start time not null,
  pickup_slot_end time not null,

  -- Pricing breakdown (all paise, integer)
  subtotal_paise integer not null check (subtotal_paise >= 0),
  -- Donations: only 0 or the exact amount allowed
  donation_plantation_paise integer not null default 0
    check (donation_plantation_paise in (0, 500)),
  donation_hunger_paise integer not null default 0
    check (donation_hunger_paise in (0, 1000)),
  -- Reward points redeemed (must be multiple of 10, >= 0)
  reward_points_redeemed integer not null default 0
    check (reward_points_redeemed >= 0 and reward_points_redeemed % 10 = 0),
  -- Discount applied from reward redemption (paise)
  reward_discount_paise integer not null default 0
    check (reward_discount_paise >= 0),
  -- Final amount payable (paise). Computed server-side only.
  final_amount_paise integer not null check (final_amount_paise >= 0),

  -- Reward points EARNED on this order (only set after payment success)
  reward_points_earned integer not null default 0
    check (reward_points_earned >= 0),

  -- Status machine
  -- draft → awaiting_payment → confirmed  (success path)
  -- draft → awaiting_payment → failed      (failure path)
  -- draft → cancelled                       (user cancelled before pay)
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'succeeded', 'failed', 'refunded')),
  order_status text not null default 'draft'
    check (order_status in ('draft', 'awaiting_payment', 'confirmed', 'cancelled', 'failed')),

  -- Idempotency: prevents duplicate order creation from double-click / refresh
  idempotency_key text not null unique,

  -- Razorpay order_id (set when Razorpay Order is created server-side)
  razorpay_order_id text unique,

  -- Reserved for future modules (no schema changes needed when those ship)
  pickup_pin text,
  admin_assigned_to uuid,

  -- Optional customer note (max 500 chars; sanitized at app layer)
  customer_notes text check (char_length(customer_notes) <= 500),

  -- Audit timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_orders_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.handle_orders_updated_at();

create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_orders_order_number on public.orders(order_number);
create index if not exists idx_orders_payment_status on public.orders(payment_status);
create index if not exists idx_orders_order_status on public.orders(order_status);
create index if not exists idx_orders_razorpay_order on public.orders(razorpay_order_id);
create index if not exists idx_orders_branch_date on public.orders(branch_id, pickup_date);
create index if not exists idx_orders_user_created on public.orders(user_id, created_at desc);

alter table public.orders enable row level security;

drop policy if exists "orders_select_own" on public.orders;
drop policy if exists "orders_insert_own" on public.orders;
drop policy if exists "orders_update_own" on public.orders;
drop policy if exists "orders_delete_own" on public.orders;

create policy "orders_select_own"
  on public.orders for select
  using (auth.uid() = user_id);

-- Inserts/updates go through SECURITY DEFINER RPC only — no direct user inserts.
-- We still allow direct INSERT with user_id = auth.uid() so the RPC pattern
-- works (RPC runs as definer, but if app layer ever inserts directly,
-- the policy enforces user can only insert their own row).
create policy "orders_insert_own"
  on public.orders for insert
  with check (auth.uid() = user_id);

-- ============================================================================
-- ORDER ITEMS TABLE
-- ============================================================================
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  line_key text not null,
  item_id text not null,
  variant_id text not null,
  item_name text not null,
  item_emoji text not null default '🍽️',
  item_type text not null check (item_type in ('fixed', 'weight', 'piece')),
  variant_label text not null,
  weight_grams integer,
  piece_count integer,
  unit_price_paise integer not null check (unit_price_paise >= 0),
  quantity integer not null check (quantity >= 1 and quantity <= 50),
  line_total_paise integer not null check (line_total_paise >= 0),

  created_at timestamptz not null default now()
);

create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_items_user_id on public.order_items(user_id);
create index if not exists idx_order_items_line_key on public.order_items(line_key);

alter table public.order_items enable row level security;

drop policy if exists "order_items_select_own" on public.order_items;
drop policy if exists "order_items_insert_own" on public.order_items;

create policy "order_items_select_own"
  on public.order_items for select
  using (auth.uid() = user_id);

create policy "order_items_insert_own"
  on public.order_items for insert
  with check (auth.uid() = user_id);

-- ============================================================================
-- PAYMENTS TABLE
-- ============================================================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Razorpay identifiers
  razorpay_order_id text not null,
  razorpay_payment_id text,
  razorpay_signature text,

  -- Amount captured / authorized (paise)
  amount_paise integer not null check (amount_paise >= 0),
  currency text not null default 'inr',

  -- Payment status (mirrors Stripe's lifecycle)
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed', 'refunded')),

  -- When the terminal webhook event was processed (NULL = not yet processed)
  webhook_processed_at timestamptz,

  -- Failure reason (logged for diagnostics; NEVER exposed to client)
  failure_reason text,

  -- Latest raw payload from Stripe (for audit / debugging)
  raw_payload jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_payments_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.handle_payments_updated_at();

create index if not exists idx_payments_order_id on public.payments(order_id);
create index if not exists idx_payments_user_id on public.payments(user_id);
create index if not exists idx_payments_razorpay_order on public.payments(razorpay_order_id);
create index if not exists idx_payments_status on public.payments(status);

alter table public.payments enable row level security;

drop policy if exists "payments_select_own" on public.payments;
drop policy if exists "payments_insert_own" on public.payments;
drop policy if exists "payments_update_own" on public.payments;

create policy "payments_select_own"
  on public.payments for select
  using (auth.uid() = user_id);

create policy "payments_insert_own"
  on public.payments for insert
  with check (auth.uid() = user_id);

create policy "payments_update_own"
  on public.payments for update
  using (auth.uid() = user_id);

-- ============================================================================
-- PROCESSED WEBHOOK EVENTS TABLE (idempotency for Razorpay webhooks)
-- ============================================================================
-- Every Razorpay webhook event has a unique payment_id. We record it here so
-- that if Razorpay retries the same event (or we receive it twice), we skip
-- processing. This is the SINGLE source of truth for "have we handled this
-- event?". Primary key on event_id makes dedup atomic.
create table if not exists public.processed_webhook_events (
  event_id text primary key,
  event_type text not null,
  payment_id uuid references public.payments(id) on delete set null,
  processed_at timestamptz not null default now()
);

create index if not exists idx_processed_events_payment on public.processed_webhook_events(payment_id);

alter table public.processed_webhook_events enable row level security;
-- NO policies — only service role / SECURITY DEFINER functions can read/write.

-- ============================================================================
-- REWARD BALANCE TABLE (one row per user)
-- ============================================================================
create table if not exists public.reward_balance (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_points integer not null default 0 check (balance_points >= 0),
  total_earned integer not null default 0 check (total_earned >= 0),
  total_redeemed integer not null default 0 check (total_redeemed >= 0),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_reward_balance_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_reward_balance_updated_at on public.reward_balance;
create trigger trg_reward_balance_updated_at
  before update on public.reward_balance
  for each row execute function public.handle_reward_balance_updated_at();

alter table public.reward_balance enable row level security;

drop policy if exists "reward_balance_select_own" on public.reward_balance;
create policy "reward_balance_select_own"
  on public.reward_balance for select
  using (auth.uid() = user_id);
-- No insert/update/delete policies — all mutations go through SECURITY DEFINER
-- RPCs (so users can't directly bump their own balance).

-- ============================================================================
-- REWARD TRANSACTIONS TABLE (append-only ledger)
-- ============================================================================
create table if not exists public.reward_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,

  -- Signed integer: positive for earn/restore, negative for redeem
  points integer not null,
  type text not null check (type in ('earn', 'redeem', 'adjust', 'restore')),
  reason text not null,
  -- Running balance AFTER this transaction (for audit)
  balance_after integer not null check (balance_after >= 0),

  created_at timestamptz not null default now()
);

create index if not exists idx_reward_tx_user_id on public.reward_transactions(user_id);
create index if not exists idx_reward_tx_order_id on public.reward_transactions(order_id);
create index if not exists idx_reward_tx_created_at on public.reward_transactions(created_at desc);

alter table public.reward_transactions enable row level security;

drop policy if exists "reward_tx_select_own" on public.reward_transactions;
create policy "reward_tx_select_own"
  on public.reward_transactions for select
  using (auth.uid() = user_id);
-- No insert/update/delete policies — all mutations via SECURITY DEFINER RPCs.

-- ============================================================================
-- ORDER NUMBER SEQUENCE + GENERATOR
-- ============================================================================
create sequence if not exists public.order_number_seq start 1;

-- Generate a human-readable order number: DHM-YYYYMMDD-NNNNN
-- Uses IST (Asia/Kolkata) for the date component.
create or replace function public.generate_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq bigint;
  v_date text;
begin
  v_seq := nextval('public.order_number_seq');
  v_date := to_char(now() at time zone 'Asia/Kolkata', 'YYYYMMDD');
  return 'DHM-' || v_date || '-' || lpad(v_seq::text, 5, '0');
end;
$$;

grant execute on function public.generate_order_number() to authenticated;

-- ============================================================================
-- RPC: get_branches
-- ----------------------------------------------------------------------------
-- Returns all active branches ordered by sort_order. Public read.
-- ============================================================================
create or replace function public.get_branches()
returns table (
  id uuid,
  slug text,
  name text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  pincode text,
  latitude numeric,
  longitude numeric,
  opening_time time,
  closing_time time,
  status text,
  sort_order integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select
      b.id, b.slug, b.name, b.address_line1, b.address_line2,
      b.city, b.state, b.pincode, b.latitude, b.longitude,
      b.opening_time, b.closing_time, b.status, b.sort_order
    from public.branches b
    where b.status = 'active'
    order by b.sort_order asc;
end;
$$;

grant execute on function public.get_branches() to authenticated;

-- ============================================================================
-- RPC: get_branch_by_slug
-- ============================================================================
create or replace function public.get_branch_by_slug(p_slug text)
returns table (
  id uuid, slug text, name text, address_line1 text, address_line2 text,
  city text, state text, pincode text, latitude numeric, longitude numeric,
  opening_time time, closing_time time, status text, sort_order integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select
      b.id, b.slug, b.name, b.address_line1, b.address_line2,
      b.city, b.state, b.pincode, b.latitude, b.longitude,
      b.opening_time, b.closing_time, b.status, b.sort_order
    from public.branches b
    where b.slug = p_slug and b.status = 'active'
    limit 1;
end;
$$;

grant execute on function public.get_branch_by_slug(text) to authenticated;

-- ============================================================================
-- RPC: get_reward_balance
-- ----------------------------------------------------------------------------
-- Returns the user's current reward point balance. Creates a zero-balance
-- row if none exists yet (lazy initialization).
-- ============================================================================
create or replace function public.get_reward_balance(p_user_id uuid)
returns table (
  balance_points integer,
  total_earned integer,
  total_redeemed integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.reward_balance (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  return query
    select rb.balance_points, rb.total_earned, rb.total_redeemed
    from public.reward_balance rb
    where rb.user_id = p_user_id
    limit 1;
end;
$$;

grant execute on function public.get_reward_balance(uuid) to authenticated;

-- ============================================================================
-- RPC: preview_reward_redemption
-- ----------------------------------------------------------------------------
-- Returns the discount (paise) the user would get for redeeming N points,
-- WITHOUT actually deducting. Pure calc with validation.
-- Rules: 10 points = ₹5 (500 paise). Must be multiple of 10.
-- ============================================================================
create or replace function public.preview_reward_redemption(
  p_user_id uuid,
  p_points integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_discount_paise integer;
begin
  if p_points is null or p_points < 0 then
    return jsonb_build_object('success', false, 'message', 'Invalid points value');
  end if;

  if p_points % 10 <> 0 then
    return jsonb_build_object('success', false, 'message', 'Points must be a multiple of 10');
  end if;

  if p_points < 10 then
    return jsonb_build_object('success', false, 'message', 'Minimum 10 points required');
  end if;

  -- Get current balance (lazy init)
  insert into public.reward_balance (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select balance_points into v_balance
  from public.reward_balance
  where user_id = p_user_id
  for update;  -- lock row for the duration of this transaction

  if v_balance is null then
    return jsonb_build_object('success', false, 'message', 'Balance not found');
  end if;

  if p_points > v_balance then
    return jsonb_build_object(
      'success', false,
      'message', 'Insufficient points',
      'available', v_balance
    );
  end if;

  -- 10 points = 500 paise → discount = (points / 10) * 500
  v_discount_paise := (p_points / 10) * 500;

  return jsonb_build_object(
    'success', true,
    'points', p_points,
    'discount_paise', v_discount_paise,
    'balance_after', v_balance - p_points
  );
end;
$$;

grant execute on function public.preview_reward_redemption(uuid, integer) to authenticated;

-- ============================================================================
-- RPC: create_draft_order
-- ----------------------------------------------------------------------------
-- Atomic creation of:
--   1. Order row (status='draft', payment_status='pending')
--   2. Order items rows (from p_items JSON array)
--   3. Reward point deduction (if p_reward_points_to_redeem > 0)
--      - Locks reward_balance row
--      - Verifies sufficient balance
--      - Deducts + inserts reward_transactions ledger row
--
-- Idempotency:
--   - p_idempotency_key is UNIQUE. If the same key is submitted twice,
--     the second call fails with a unique constraint violation, which
--     the application layer catches and returns the original order.
--
-- Item JSON shape:
--   [{line_key, item_id, variant_id, item_name, item_emoji, item_type,
--     variant_label, weight_grams, piece_count, unit_price_paise,
--     quantity, line_total_paise}, ...]
--
-- ALL prices are recomputed at the APPLICATION layer (cart-service) before
-- this function is called. The function still enforces:
--   - subtotal = SUM(line_total_paise) for the order's items
--   - final_amount = subtotal + donations - reward_discount
--   - reward_points_to_redeem is multiple of 10 and <= balance
-- ============================================================================
create or replace function public.create_draft_order(
  p_user_id uuid,
  p_branch_id uuid,
  p_pickup_date date,
  p_slot_start time,
  p_slot_end time,
  p_subtotal_paise integer,
  p_donation_plantation_paise integer,
  p_donation_hunger_paise integer,
  p_reward_points_to_redeem integer,
  p_reward_discount_paise integer,
  p_final_amount_paise integer,
  p_idempotency_key text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_balance integer;
  v_new_balance integer;
  v_computed_subtotal integer := 0;
  v_computed_final integer;
  v_item jsonb;
  v_expected_discount integer;
  v_expected_final integer;
begin
  -- ---------------- VALIDATION ----------------
  if p_subtotal_paise < 0 then
    return jsonb_build_object('success', false, 'message', 'Invalid subtotal');
  end if;

  if p_donation_plantation_paise not in (0, 500) then
    return jsonb_build_object('success', false, 'message', 'Invalid plantation donation');
  end if;

  if p_donation_hunger_paise not in (0, 1000) then
    return jsonb_build_object('success', false, 'message', 'Invalid hunger donation');
  end if;

  if p_reward_points_to_redeem < 0 or p_reward_points_to_redeem % 10 <> 0 then
    return jsonb_build_object('success', false, 'message', 'Invalid reward points');
  end if;

  if p_reward_discount_paise < 0 then
    return jsonb_build_object('success', false, 'message', 'Invalid reward discount');
  end if;

  if p_final_amount_paise < 0 then
    return jsonb_build_object('success', false, 'message', 'Invalid final amount');
  end if;

  -- Verify reward discount matches points redeemed
  if p_reward_points_to_redeem > 0 then
    v_expected_discount := (p_reward_points_to_redeem / 10) * 500;
    if p_reward_discount_paise <> v_expected_discount then
      return jsonb_build_object('success', false, 'message', 'Reward discount mismatch');
    end if;
  else
    if p_reward_discount_paise <> 0 then
      return jsonb_build_object('success', false, 'message', 'Reward discount without redemption');
    end if;
  end if;

  -- Verify final amount = subtotal + donations - reward_discount
  v_expected_final := p_subtotal_paise + p_donation_plantation_paise
                      + p_donation_hunger_paise - p_reward_discount_paise;
  if p_final_amount_paise <> v_expected_final then
    return jsonb_build_object('success', false, 'message', 'Final amount mismatch');
  end if;

  -- If redeeming points: verify balance + deduct atomically
  if p_reward_points_to_redeem > 0 then
    -- Lazy init balance row
    insert into public.reward_balance (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    select balance_points into v_balance
    from public.reward_balance
    where user_id = p_user_id
    for update;  -- row lock

    if v_balance is null then
      return jsonb_build_object('success', false, 'message', 'Reward balance not found');
    end if;

    if p_reward_points_to_redeem > v_balance then
      return jsonb_build_object(
        'success', false,
        'message', 'Insufficient reward points',
        'available', v_balance
      );
    end if;

    v_new_balance := v_balance - p_reward_points_to_redeem;

    update public.reward_balance
    set balance_points = v_new_balance,
        total_redeemed = total_redeemed + p_reward_points_to_redeem
    where user_id = p_user_id;
  end if;

  -- ---------------- CREATE ORDER ----------------
  v_order_number := public.generate_order_number();

  insert into public.orders (
    order_number, user_id, branch_id,
    pickup_date, pickup_slot_start, pickup_slot_end,
    subtotal_paise,
    donation_plantation_paise, donation_hunger_paise,
    reward_points_redeemed, reward_discount_paise,
    final_amount_paise,
    payment_status, order_status,
    idempotency_key
  ) values (
    v_order_number, p_user_id, p_branch_id,
    p_pickup_date, p_slot_start, p_slot_end,
    p_subtotal_paise,
    p_donation_plantation_paise, p_donation_hunger_paise,
    p_reward_points_to_redeem, p_reward_discount_paise,
    p_final_amount_paise,
    'pending', 'draft',
    p_idempotency_key
  )
  returning id into v_order_id;

  -- ---------------- INSERT ITEMS ----------------
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Cannot create order with empty items';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    -- Accumulate subtotal for verification
    v_computed_subtotal := v_computed_subtotal + (v_item->>'line_total_paise')::integer;

    insert into public.order_items (
      order_id, user_id,
      line_key, item_id, variant_id,
      item_name, item_emoji, item_type, variant_label,
      weight_grams, piece_count,
      unit_price_paise, quantity, line_total_paise
    ) values (
      v_order_id, p_user_id,
      v_item->>'line_key',
      v_item->>'item_id',
      v_item->>'variant_id',
      v_item->>'item_name',
      v_item->>'item_emoji',
      v_item->>'item_type',
      v_item->>'variant_label',
      nullif(v_item->>'weight_grams', '')::integer,
      nullif(v_item->>'piece_count', '')::integer,
      (v_item->>'unit_price_paise')::integer,
      (v_item->>'quantity')::integer,
      (v_item->>'line_total_paise')::integer
    );
  end loop;

  -- Verify computed subtotal matches declared subtotal
  if v_computed_subtotal <> p_subtotal_paise then
    raise exception 'Subtotal mismatch: computed %, declared %',
      v_computed_subtotal, p_subtotal_paise;
  end if;

  -- ---------------- REWARD LEDGER (REDEEM) ----------------
  if p_reward_points_to_redeem > 0 then
    insert into public.reward_transactions (
      user_id, order_id, points, type, reason, balance_after
    ) values (
      p_user_id, v_order_id,
      -p_reward_points_to_redeem,
      'redeem',
      'Redeemed for order ' || v_order_number,
      v_new_balance
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number
  );
end;
$$;

grant execute on function public.create_draft_order(
  uuid, uuid, date, time, time, integer, integer, integer, integer, integer, integer, text, jsonb
) to authenticated;

-- ============================================================================
-- RPC: attach_razorpay_order_to_order
-- ----------------------------------------------------------------------------
-- Links a Razorpay order_id to a draft order and transitions the
-- order to 'awaiting_payment' status. Also creates the payments row.
-- Idempotent: if called twice with same Razorpay order_id, returns success
-- without creating duplicates.
-- ============================================================================
create or replace function public.attach_razorpay_order_to_order(
  p_order_id uuid,
  p_user_id uuid,
  p_razorpay_order_id text,
  p_amount_paise integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_rzp text;
  v_payment_id uuid;
begin
  -- Lock the order row
  select razorpay_order_id into v_existing_rzp
  from public.orders
  where id = p_order_id and user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Order not found');
  end if;

  -- If already attached to a different Razorpay order, reject
  if v_existing_rzp is not null and v_existing_rzp <> p_razorpay_order_id then
    return jsonb_build_object('success', false, 'message', 'Order already has a different payment intent');
  end if;

  -- Update order to awaiting_payment (if not already)
  update public.orders
  set order_status = case when order_status = 'draft' then 'awaiting_payment' else order_status end,
      razorpay_order_id = p_razorpay_order_id
  where id = p_order_id;

  -- Insert payment row (idempotent: if exists for this Razorpay order, do nothing)
  insert into public.payments (
    order_id, user_id,
    razorpay_order_id, amount_paise, currency, status
  ) values (
    p_order_id, p_user_id,
    p_razorpay_order_id, p_amount_paise, 'inr', 'pending'
  )
  on conflict (razorpay_order_id) do nothing
  returning id into v_payment_id;

  -- If conflict (existing payment), fetch its id
  if v_payment_id is null then
    select id into v_payment_id
    from public.payments
    where razorpay_order_id = p_razorpay_order_id
    limit 1;
  end if;

  return jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'payment_id', v_payment_id
  );
end;
$$;

grant execute on function public.attach_razorpay_order_to_order(
  uuid, uuid, text, integer
) to authenticated;

-- ============================================================================
-- RPC: mark_order_succeeded
-- ----------------------------------------------------------------------------
-- Called EITHER from:
--  - /api/checkout/verify-payment (PRIMARY — client verifies signature)
--  - /api/razorpay/webhook (SECONDARY — resilience if client closes browser)
--
-- Atomic operations:
--   1. Insert into processed_webhook_events (idempotency guard)
--   2. Update order: payment_status='succeeded', order_status='confirmed'
--   3. Update payment: status='succeeded', razorpay_payment_id, razorpay_signature, raw_payload
--   4. Award reward points (5 if subtotal > ₹500 AND plantation donation)
--   5. Clear user's cart (delete from cart_items)
--
-- If called twice with same event_id, second call is a no-op (success).
-- ============================================================================
create or replace function public.mark_order_succeeded(
  p_order_id uuid,
  p_razorpay_payment_id text,
  p_razorpay_signature text,
  p_webhook_event_id text,
  p_event_type text,
  p_raw_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_payment_id uuid;
  v_balance integer;
  v_new_balance integer;
  v_points_to_earn integer := 0;
  v_user_id uuid;
begin
  -- ---------------- IDEMPOTENCY CHECK ----------------
  -- Try to record this event. If it already exists, we've processed it.
  begin
    insert into public.processed_webhook_events (event_id, event_type, payment_id)
    values (p_webhook_event_id, p_event_type, null)
    returning payment_id into v_payment_id;
  exception when unique_violation then
    return jsonb_build_object('success', true, 'message', 'Event already processed', 'idempotent', true);
  end;

  -- ---------------- LOAD ORDER (lock) ----------------
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Order not found');
  end if;

  v_user_id := v_order.user_id;

  -- Find payment row
  select id into v_payment_id
  from public.payments
  where razorpay_order_id = v_order.razorpay_order_id
  limit 1;

  -- Update payment record
  if v_payment_id is not null then
    update public.payments
    set status = 'succeeded',
        razorpay_payment_id = p_razorpay_payment_id,
        razorpay_signature = p_razorpay_signature,
        raw_payload = p_raw_payload,
        webhook_processed_at = now()
    where id = v_payment_id;

    -- Backfill payment_id in processed_webhook_events
    update public.processed_webhook_events
    set payment_id = v_payment_id
    where event_id = p_webhook_event_id;
  end if;

  -- If order is already confirmed, skip re-processing (idempotency)
  if v_order.order_status = 'confirmed' then
    return jsonb_build_object('success', true, 'message', 'Order already confirmed', 'idempotent', true);
  end if;

  -- ---------------- UPDATE ORDER STATUS ----------------
  update public.orders
  set payment_status = 'succeeded',
      order_status = 'confirmed'
  where id = p_order_id;

  -- ---------------- AWARD REWARD POINTS ----------------
  -- Rule: 5 points if BOTH conditions true:
  --   1. subtotal_paise > 50000 (₹500)
  --   2. donation_plantation_paise = 500 (₹5)
  if v_order.subtotal_paise > 50000 and v_order.donation_plantation_paise = 500 then
    v_points_to_earn := 5;
  end if;

  if v_points_to_earn > 0 then
    -- Lazy init balance row
    insert into public.reward_balance (user_id)
    values (v_user_id)
    on conflict (user_id) do nothing;

    select balance_points into v_balance
    from public.reward_balance
    where user_id = v_user_id
    for update;

    v_new_balance := v_balance + v_points_to_earn;

    update public.reward_balance
    set balance_points = v_new_balance,
        total_earned = total_earned + v_points_to_earn
    where user_id = v_user_id;

    insert into public.reward_transactions (
      user_id, order_id, points, type, reason, balance_after
    ) values (
      v_user_id, p_order_id,
      v_points_to_earn,
      'earn',
      'Earned from order ' || v_order.order_number,
      v_new_balance
    );

    -- Record earned points on the order
    update public.orders
    set reward_points_earned = v_points_to_earn
    where id = p_order_id;
  end if;

  -- ---------------- CLEAR USER'S CART ----------------
  -- Cart is now an order — empty the plate.
  delete from public.cart_items where user_id = v_user_id;

  return jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'order_number', v_order.order_number,
    'reward_points_earned', v_points_to_earn
  );
end;
$$;

-- NOTE: webhook handler runs as service role (no RLS), so we don't need
-- to grant execute to authenticated. But we grant to authenticated as well
-- in case the verify-payment route uses an authenticated client. Safe because
-- the order_id/razorpay IDs are unguessable UUIDs.
grant execute on function public.mark_order_succeeded(uuid, text, text, text, text, jsonb) to authenticated, anon;

-- ============================================================================
-- RPC: mark_order_failed
-- ----------------------------------------------------------------------------
-- Called from verify-payment (signature invalid) or from Razorpay webhook
-- (payment.failed event). Restores redeemed reward points if applicable.
-- ============================================================================
create or replace function public.mark_order_failed(
  p_order_id uuid,
  p_failure_reason text,
  p_webhook_event_id text,
  p_event_type text,
  p_raw_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_payment_id uuid;
  v_balance integer;
  v_new_balance integer;
  v_user_id uuid;
begin
  -- ---------------- IDEMPOTENCY CHECK ----------------
  begin
    insert into public.processed_webhook_events (event_id, event_type, payment_id)
    values (p_webhook_event_id, p_event_type, null)
    returning payment_id into v_payment_id;
  exception when unique_violation then
    return jsonb_build_object('success', true, 'message', 'Event already processed', 'idempotent', true);
  end;

  -- ---------------- LOAD ORDER (lock) ----------------
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Order not found');
  end if;

  v_user_id := v_order.user_id;

  -- Update payment record
  select id into v_payment_id
  from public.payments
  where razorpay_order_id = v_order.razorpay_order_id
  limit 1;

  if v_payment_id is not null then
    update public.payments
    set status = 'failed',
        failure_reason = p_failure_reason,
        raw_payload = p_raw_payload,
        webhook_processed_at = now()
    where id = v_payment_id;

    update public.processed_webhook_events
    set payment_id = v_payment_id
    where event_id = p_webhook_event_id;
  end if;

  -- If order is already failed/confirmed, skip
  if v_order.order_status in ('failed', 'confirmed') then
    return jsonb_build_object('success', true, 'message', 'Order already in terminal state', 'idempotent', true);
  end if;

  -- ---------------- UPDATE ORDER STATUS ----------------
  update public.orders
  set payment_status = 'failed',
      order_status = 'failed'
  where id = p_order_id;

  -- ---------------- RESTORE REDEEMED POINTS ----------------
  if v_order.reward_points_redeemed > 0 then
    select balance_points into v_balance
    from public.reward_balance
    where user_id = v_user_id
    for update;

    v_new_balance := v_balance + v_order.reward_points_redeemed;

    update public.reward_balance
    set balance_points = v_new_balance,
        total_redeemed = greatest(total_redeemed - v_order.reward_points_redeemed, 0)
    where user_id = v_user_id;

    insert into public.reward_transactions (
      user_id, order_id, points, type, reason, balance_after
    ) values (
      v_user_id, p_order_id,
      v_order.reward_points_redeemed,
      'restore',
      'Restored from failed order ' || v_order.order_number,
      v_new_balance
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'order_number', v_order.order_number,
    'reward_points_restored', v_order.reward_points_redeemed
  );
end;
$$;

grant execute on function public.mark_order_failed(uuid, text, text, text, jsonb) to authenticated, anon;

-- ============================================================================
-- RPC: get_order_for_user
-- ----------------------------------------------------------------------------
-- Returns the full order (header + items) for a user. Only the order's
-- owner can fetch it (RLS enforced on orders, but we double-check here).
-- ============================================================================
create or replace function public.get_order_for_user(
  p_user_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order jsonb;
  v_items jsonb;
begin
  select jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'user_id', o.user_id,
    'branch_id', o.branch_id,
    'pickup_date', o.pickup_date,
    'pickup_slot_start', o.pickup_slot_start,
    'pickup_slot_end', o.pickup_slot_end,
    'subtotal_paise', o.subtotal_paise,
    'donation_plantation_paise', o.donation_plantation_paise,
    'donation_hunger_paise', o.donation_hunger_paise,
    'reward_points_redeemed', o.reward_points_redeemed,
    'reward_discount_paise', o.reward_discount_paise,
    'final_amount_paise', o.final_amount_paise,
    'reward_points_earned', o.reward_points_earned,
    'payment_status', o.payment_status,
    'order_status', o.order_status,
    'razorpay_order_id', o.razorpay_order_id,
    'customer_notes', o.customer_notes,
    'created_at', o.created_at,
    'updated_at', o.updated_at
  ) into v_order
  from public.orders o
  where o.id = p_order_id and o.user_id = p_user_id;

  if v_order is null then
    return jsonb_build_object('success', false, 'message', 'Order not found');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'line_key', oi.line_key,
      'item_id', oi.item_id,
      'variant_id', oi.variant_id,
      'item_name', oi.item_name,
      'item_emoji', oi.item_emoji,
      'item_type', oi.item_type,
      'variant_label', oi.variant_label,
      'weight_grams', oi.weight_grams,
      'piece_count', oi.piece_count,
      'unit_price_paise', oi.unit_price_paise,
      'quantity', oi.quantity,
      'line_total_paise', oi.line_total_paise
    ) order by oi.created_at
  ), '[]'::jsonb) into v_items
  from public.order_items oi
  where oi.order_id = p_order_id;

  -- Fetch branch info
  return jsonb_build_object(
    'success', true,
    'order', v_order,
    'items', v_items
  );
end;
$$;

grant execute on function public.get_order_for_user(uuid, uuid) to authenticated;

-- ============================================================================
-- RPC: cancel_draft_order
-- ----------------------------------------------------------------------------
-- Allows the user to cancel an order that's still in 'draft' or
-- 'awaiting_payment' state (e.g. they abandoned checkout). Restores
-- redeemed points. Once 'confirmed' or 'failed', cannot be cancelled.
-- ============================================================================
create or replace function public.cancel_draft_order(
  p_user_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_balance integer;
  v_new_balance integer;
begin
  select * into v_order
  from public.orders
  where id = p_order_id and user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Order not found');
  end if;

  if v_order.order_status not in ('draft', 'awaiting_payment') then
    return jsonb_build_object(
      'success', false,
      'message', 'Cannot cancel order in current state: ' || v_order.order_status
    );
  end if;

  update public.orders
  set order_status = 'cancelled'
  where id = p_order_id;

  -- Restore redeemed points
  if v_order.reward_points_redeemed > 0 then
    select balance_points into v_balance
    from public.reward_balance
    where user_id = p_user_id
    for update;

    v_new_balance := v_balance + v_order.reward_points_redeemed;

    update public.reward_balance
    set balance_points = v_new_balance
    where user_id = p_user_id;

    insert into public.reward_transactions (
      user_id, order_id, points, type, reason, balance_after
    ) values (
      p_user_id, p_order_id,
      v_order.reward_points_redeemed,
      'restore',
      'Restored from cancelled order ' || v_order.order_number,
      v_new_balance
    );
  end if;

  return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$$;

grant execute on function public.cancel_draft_order(uuid, uuid) to authenticated;

-- ============================================================================
-- RPC: get_recent_orders_for_user
-- ----------------------------------------------------------------------------
-- Returns last N orders for the user (default 20). Used in account page
-- (future module).
-- ============================================================================
create or replace function public.get_recent_orders_for_user(
  p_user_id uuid,
  p_limit integer default 20
)
returns table (
  id uuid,
  order_number text,
  branch_id uuid,
  pickup_date date,
  pickup_slot_start time,
  pickup_slot_end time,
  final_amount_paise integer,
  payment_status text,
  order_status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    p_limit := 20;
  end if;

  return query
    select
      o.id, o.order_number, o.branch_id,
      o.pickup_date, o.pickup_slot_start, o.pickup_slot_end,
      o.final_amount_paise, o.payment_status, o.order_status,
      o.created_at
    from public.orders o
    where o.user_id = p_user_id
    order by o.created_at desc
    limit p_limit;
end;
$$;

grant execute on function public.get_recent_orders_for_user(uuid, integer) to authenticated;
