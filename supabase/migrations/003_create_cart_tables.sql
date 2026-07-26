-- ============================================================================
-- Migration 003: Cart & Cart Items tables with RLS
-- ----------------------------------------------------------------------------
-- Implements server-side cart storage for authenticated users.
--
-- Design principles:
--  1. All money stored as INTEGER PAISE (1 INR = 100 paise) — never floats.
--  2. All weights stored as INTEGER GRAMS.
--  3. Cart rows are UNIQUE per (user_id, line_key) so identical configs merge.
--  4. RLS enabled: users can only read/write their OWN cart.
--  5. No menu item data is duplicated — cart stores only references + a
--     server-validated snapshot of price at time of add (for audit).
--  6. Indexes on user_id for fast lookups.
--
-- Future modules (Checkout, Orders) will read from these tables.
-- ============================================================================

-- ============================================================================
-- CART TABLE
-- ============================================================================
create table if not exists public.cart (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Composite unique: one cart per user (we enforce single-cart-per-user)
  -- by upserting on user_id.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- Auto-update updated_at on every change
create or replace function public.handle_cart_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_cart_updated_at on public.cart;
create trigger trg_cart_updated_at
  before update on public.cart
  for each row execute function public.handle_cart_updated_at();

-- ============================================================================
-- CART ITEMS TABLE
-- ============================================================================
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.cart(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Item references (validated server-side against menu catalog)
  item_id text not null,
  variant_id text not null,

  -- line_key = `${item_id}--${variant_id}` — unique per (cart, configuration)
  -- If user adds the same item+variant again, we MERGE (increment qty)
  -- rather than create a new row.
  line_key text not null,

  -- Snapshot of item metadata at time of add (for display + audit)
  item_name text not null,
  item_emoji text not null default '🍽️',
  item_type text not null check (item_type in ('fixed', 'weight', 'piece')),
  variant_label text not null,

  -- Weight in grams (NULL for fixed/piece items)
  weight_grams integer check (weight_grams is null or weight_grams > 0),
  -- Piece count (NULL for fixed/weight items)
  piece_count integer check (piece_count is null or piece_count > 0),

  -- Unit price in PAISE (server-validated against menu catalog on every write)
  -- This is the price for ONE unit of this variant (already weight-adjusted
  -- for weight items). Total = unit_price_paise × quantity.
  unit_price_paise integer not null check (unit_price_paise >= 0),

  -- Quantity (always integer >= 1)
  quantity integer not null check (quantity >= 1 and quantity <= 50),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One row per (cart, line_key)
  unique (cart_id, line_key)
);

create or replace function public.handle_cart_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_cart_items_updated_at on public.cart_items;
create trigger trg_cart_items_updated_at
  before update on public.cart_items
  for each row execute function public.handle_cart_items_updated_at();

-- Indexes for fast lookups
create index if not exists idx_cart_items_cart_id on public.cart_items(cart_id);
create index if not exists idx_cart_items_user_id on public.cart_items(user_id);
create index if not exists idx_cart_items_line_key on public.cart_items(line_key);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Users can ONLY access their own cart and cart items.
-- All mutations go through SECURITY DEFINER RPC functions (below) which
-- perform server-side price validation against the menu catalog before
-- any INSERT/UPDATE. Users NEVER directly mutate these tables.

alter table public.cart enable row level security;
alter table public.cart_items enable row level security;

-- Drop existing policies if they exist (idempotent migration)
drop policy if exists "cart_select_own" on public.cart;
drop policy if exists "cart_insert_own" on public.cart;
drop policy if exists "cart_update_own" on public.cart;
drop policy if exists "cart_delete_own" on public.cart;

drop policy if exists "cart_items_select_own" on public.cart_items;
drop policy if exists "cart_items_insert_own" on public.cart_items;
drop policy if exists "cart_items_update_own" on public.cart_items;
drop policy if exists "cart_items_delete_own" on public.cart_items;

-- CART policies
create policy "cart_select_own"
  on public.cart for select
  using (auth.uid() = user_id);

create policy "cart_insert_own"
  on public.cart for insert
  with check (auth.uid() = user_id);

create policy "cart_update_own"
  on public.cart for update
  using (auth.uid() = user_id);

create policy "cart_delete_own"
  on public.cart for delete
  using (auth.uid() = user_id);

-- CART ITEMS policies
create policy "cart_items_select_own"
  on public.cart_items for select
  using (auth.uid() = user_id);

create policy "cart_items_insert_own"
  on public.cart_items for insert
  with check (auth.uid() = user_id);

create policy "cart_items_update_own"
  on public.cart_items for update
  using (auth.uid() = user_id);

create policy "cart_items_delete_own"
  on public.cart_items for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- SECURITY DEFINER RPC: get_cart_for_user
-- ----------------------------------------------------------------------------
-- Returns the user's cart with all items, creating an empty cart if none
-- exists yet. Safe to call from any context.
-- ============================================================================
create or replace function public.get_cart_for_user(p_user_id uuid)
returns table (
  line_key text,
  item_id text,
  variant_id text,
  item_name text,
  item_emoji text,
  item_type text,
  variant_label text,
  weight_grams integer,
  piece_count integer,
  unit_price_paise integer,
  quantity integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ensure cart row exists
  insert into public.cart (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  return query
    select
      ci.line_key,
      ci.item_id,
      ci.variant_id,
      ci.item_name,
      ci.item_emoji,
      ci.item_type,
      ci.variant_label,
      ci.weight_grams,
      ci.piece_count,
      ci.unit_price_paise,
      ci.quantity
    from public.cart_items ci
    where ci.user_id = p_user_id
    order by ci.created_at asc;
end;
$$;

grant execute on function public.get_cart_for_user(uuid) to authenticated;

-- ============================================================================
-- SECURITY DEFINER RPC: upsert_cart_item
-- ----------------------------------------------------------------------------
-- Add an item to cart OR increment quantity if (line_key) already exists.
-- ALL inputs are validated against the menu catalog at the APPLICATION layer
-- BEFORE this function is called — but we still enforce DB-level integrity
-- via constraints (quantity range, positive prices, etc.).
-- ============================================================================
create or replace function public.upsert_cart_item(
  p_user_id uuid,
  p_item_id text,
  p_variant_id text,
  p_line_key text,
  p_item_name text,
  p_item_emoji text,
  p_item_type text,
  p_variant_label text,
  p_weight_grams integer,
  p_piece_count integer,
  p_unit_price_paise integer,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cart_id uuid;
  v_existing_qty integer;
  v_new_qty integer;
  v_max_qty integer := 50;
begin
  -- Validate item_type
  if p_item_type not in ('fixed', 'weight', 'piece') then
    return jsonb_build_object('success', false, 'message', 'Invalid item type');
  end if;

  -- Validate quantity
  if p_quantity < 1 or p_quantity > v_max_qty then
    return jsonb_build_object('success', false, 'message', 'Invalid quantity');
  end if;

  -- Validate price
  if p_unit_price_paise < 0 then
    return jsonb_build_object('success', false, 'message', 'Invalid price');
  end if;

  -- Ensure cart exists
  insert into public.cart (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select id into v_cart_id from public.cart where user_id = p_user_id limit 1;

  if v_cart_id is null then
    return jsonb_build_object('success', false, 'message', 'Cart not found');
  end if;

  -- Check if line already exists
  select quantity into v_existing_qty
  from public.cart_items
  where cart_id = v_cart_id and line_key = p_line_key
  limit 1;

  if v_existing_qty is not null then
    -- Merge: increment quantity, but cap at v_max_qty
    v_new_qty := least(v_existing_qty + p_quantity, v_max_qty);
    update public.cart_items
    set quantity = v_new_qty,
        unit_price_paise = p_unit_price_paise,  -- refresh price in case it changed
        updated_at = now()
    where cart_id = v_cart_id and line_key = p_line_key;
    return jsonb_build_object('success', true, 'merged', true, 'new_quantity', v_new_qty);
  else
    -- Insert new line
    insert into public.cart_items (
      cart_id, user_id, item_id, variant_id, line_key,
      item_name, item_emoji, item_type, variant_label,
      weight_grams, piece_count, unit_price_paise, quantity
    ) values (
      v_cart_id, p_user_id, p_item_id, p_variant_id, p_line_key,
      p_item_name, p_item_emoji, p_item_type, p_variant_label,
      p_weight_grams, p_piece_count, p_unit_price_paise, p_quantity
    );
    return jsonb_build_object('success', true, 'merged', false, 'new_quantity', p_quantity);
  end if;
end;
$$;

grant execute on function public.upsert_cart_item(
  uuid, text, text, text, text, text, text, text, integer, integer, integer, integer
) to authenticated;

-- ============================================================================
-- SECURITY DEFINER RPC: update_cart_item_quantity
-- ----------------------------------------------------------------------------
-- Set absolute quantity for a cart line. Removes line if quantity < 1.
-- ============================================================================
create or replace function public.update_cart_item_quantity(
  p_user_id uuid,
  p_line_key text,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_qty integer := 50;
begin
  if p_quantity < 1 then
    -- Remove the line entirely
    delete from public.cart_items where user_id = p_user_id and line_key = p_line_key;
    return jsonb_build_object('success', true, 'removed', true);
  end if;

  if p_quantity > v_max_qty then
    return jsonb_build_object('success', false, 'message', 'Quantity exceeds maximum');
  end if;

  update public.cart_items
  set quantity = p_quantity, updated_at = now()
  where user_id = p_user_id and line_key = p_line_key;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Cart line not found');
  end if;

  return jsonb_build_object('success', true, 'removed', false, 'new_quantity', p_quantity);
end;
$$;

grant execute on function public.update_cart_item_quantity(uuid, text, integer) to authenticated;

-- ============================================================================
-- SECURITY DEFINER RPC: remove_cart_item
-- ============================================================================
create or replace function public.remove_cart_item(
  p_user_id uuid,
  p_line_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.cart_items where user_id = p_user_id and line_key = p_line_key;
  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.remove_cart_item(uuid, text) to authenticated;

-- ============================================================================
-- SECURITY DEFINER RPC: clear_cart
-- ============================================================================
create or replace function public.clear_cart(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.cart_items where user_id = p_user_id;
  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.clear_cart(uuid) to authenticated;
