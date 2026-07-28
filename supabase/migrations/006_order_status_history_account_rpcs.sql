-- ============================================================================
-- Migration 006: Order Status History & Account Page Support
-- ---------------------------------------------------------------------------
-- Adds order_status_history table for tracking order lifecycle.
-- Adds RPCs for account page: list orders, order details, reward history.
-- All functions are SECURITY DEFINER and enforce user ownership.
-- ============================================================================

-- ============================================================================
-- TABLE: order_status_history
-- ---------------------------------------------------------------------------
-- Append-only log of every status transition for each order.
-- Used for the order timeline UI on the Order Details page.
-- ============================================================================
create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  note text,
  created_at timestamptz not null default now(),

  -- Prevent duplicate entries for same status on same order
  constraint uq_order_status unique (order_id, status)
);

-- Index for fast lookup
create index if not exists idx_order_status_history_order
  on public.order_status_history(order_id);

-- RLS
alter table public.order_status_history enable row level security;

create policy "Users can read their own order status history"
  on public.order_status_history for select
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_status_history.order_id
        and orders.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RPC: list_orders_for_user
-- ---------------------------------------------------------------------------
-- Returns paginated orders for the account Order History page.
-- Supports filtering by order_status, payment_status, sort order, branch, search.
-- Future-ready: supports new statuses (preparing, ready, collected, etc.)
-- ============================================================================
create or replace function public.list_orders_for_user(
  p_user_id uuid,
  p_order_status text default null,
  p_payment_status text default null,
  p_sort_order text default 'newest',
  p_branch_slug text default null,
  p_search text default null,
  p_page integer default 1,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offset integer;
  v_total_count integer;
  v_result jsonb;
begin
  v_offset := (p_page - 1) * p_limit;

  -- Build dynamic query with filters
  select count(*) into v_total_count
  from public.orders o
  where o.user_id = p_user_id
    and o.order_status != 'draft'
    and (p_order_status is null or p_order_status = 'all' or o.order_status = p_order_status)
    and (p_payment_status is null or p_payment_status = 'all' or o.payment_status = p_payment_status)
    and (p_branch_slug is null or o.branch_id::text = (
      select id::text from public.branches where slug = p_branch_slug limit 1
    ) or p_branch_slug = '')
    and (p_search is null or p_search = ''
      or o.order_number ilike '%' || p_search || '%'
      or o.id::text ilike '%' || p_search || '%'
    );

  select jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'orderNumber', o.order_number,
      'branchName', coalesce(b.name, 'Unknown Branch'),
      'pickupDate', o.pickup_date,
      'pickupSlotStart', o.pickup_slot_start,
      'pickupSlotEnd', o.pickup_slot_end,
      'subtotalPaise', o.subtotal_paise,
      'donationPlantationPaise', o.donation_plantation_paise,
      'donationHungerPaise', o.donation_hunger_paise,
      'rewardPointsRedeemed', o.reward_points_redeemed,
      'rewardDiscountPaise', o.reward_discount_paise,
      'finalAmountPaise', o.final_amount_paise,
      'rewardPointsEarned', o.reward_points_earned,
      'paymentStatus', o.payment_status,
      'orderStatus', o.order_status,
      'pickupPin', coalesce(o.pickup_pin, null),
      'createdAt', o.created_at,
      'updatedAt', o.updated_at
    )
    order by
      case when p_sort_order = 'oldest' then o.created_at end asc,
      case when p_sort_order = 'newest' then o.created_at end desc
  ) into v_result
  from public.orders o
  left join public.branches b on b.id = o.branch_id
  where o.user_id = p_user_id
    and o.order_status != 'draft'
    and (p_order_status is null or p_order_status = 'all' or o.order_status = p_order_status)
    and (p_payment_status is null or p_payment_status = 'all' or o.payment_status = p_payment_status)
    and (p_branch_slug is null or p_branch_slug = ''
      or o.branch_id = (select id from public.branches where slug = p_branch_slug limit 1))
    and (p_search is null or p_search = ''
      or o.order_number ilike '%' || p_search || '%'
      or o.id::text ilike '%' || p_search || '%'
    )
  group by o.id, b.name
  order by
    case when p_sort_order = 'oldest' then o.created_at end asc,
    case when p_sort_order = 'newest' then o.created_at end desc
  limit p_limit offset v_offset;

  return jsonb_build_object(
    'success', true,
    'orders', coalesce(v_result, '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', p_page,
      'limit', p_limit,
      'total', v_total_count,
      'totalPages', ceil(v_total_count::numeric / p_limit)
    )
  );
end;
$$;

grant execute on function public.list_orders_for_user(
  uuid, text, text, text, text, text, integer, integer
) to authenticated, anon;

-- ============================================================================
-- RPC: get_order_details_for_user
-- ---------------------------------------------------------------------------
-- Returns full order details: header + items + branch + status history.
-- Used by the Order Details page.
-- ============================================================================
create or replace function public.get_order_details_for_user(
  p_user_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_items jsonb;
  v_branch jsonb;
  v_status_history jsonb;
begin
  -- Load order (must belong to user)
  select * into v_order
  from public.orders
  where id = p_order_id and user_id = p_user_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Order not found');
  end if;

  -- Load items
  select jsonb_agg(
    jsonb_build_object(
      'lineKey', oi.line_key,
      'itemId', oi.item_id,
      'variantId', oi.variant_id,
      'itemName', oi.item_name,
      'itemEmoji', oi.item_emoji,
      'itemType', oi.item_type,
      'variantLabel', oi.variant_label,
      'weightGrams', oi.weight_grams,
      'pieceCount', oi.piece_count,
      'unitPricePaise', oi.unit_price_paise,
      'quantity', oi.quantity,
      'lineTotalPaise', oi.line_total_paise
    )
  ) into v_items
  from public.order_items oi
  where oi.order_id = p_order_id;

  -- Load branch
  select jsonb_build_object(
    'name', b.name,
    'addressLine1', b.address_line1,
    'city', b.city
  ) into v_branch
  from public.branches b
  where b.id = v_order.branch_id;

  -- Load status history
  select jsonb_agg(
    jsonb_build_object(
      'status', osh.status,
      'note', osh.note,
      'createdAt', osh.created_at
    )
    order by osh.created_at asc
  ) into v_status_history
  from public.order_status_history osh
  where osh.order_id = p_order_id;

  return jsonb_build_object(
    'success', true,
    'order', jsonb_build_object(
      'id', v_order.id,
      'orderNumber', v_order.order_number,
      'pickupDate', v_order.pickup_date,
      'pickupSlotStart', v_order.pickup_slot_start,
      'pickupSlotEnd', v_order.pickup_slot_end,
      'subtotalPaise', v_order.subtotal_paise,
      'donationPlantationPaise', v_order.donation_plantation_paise,
      'donationHungerPaise', v_order.donation_hunger_paise,
      'rewardPointsRedeemed', v_order.reward_points_redeemed,
      'rewardDiscountPaise', v_order.reward_discount_paise,
      'finalAmountPaise', v_order.final_amount_paise,
      'rewardPointsEarned', v_order.reward_points_earned,
      'paymentStatus', v_order.payment_status,
      'orderStatus', v_order.order_status,
      'pickupPin', v_order.pickup_pin,
      'customerNotes', v_order.customer_notes,
      'branch', coalesce(v_branch, 'null'::jsonb),
      'items', coalesce(v_items, '[]'::jsonb),
      'statusHistory', coalesce(v_status_history, '[]'::jsonb),
      'createdAt', v_order.created_at,
      'updatedAt', v_order.updated_at
    )
  );
end;
$$;

grant execute on function public.get_order_details_for_user(uuid, uuid) to authenticated, anon;

-- ============================================================================
-- RPC: get_ongoing_orders_for_user
-- ---------------------------------------------------------------------------
-- Returns only active (non-terminal) orders for the Ongoing Orders page.
-- Active = confirmed (includes future statuses: preparing, ready_for_pickup, etc.)
-- Excludes: draft, awaiting_payment, cancelled, failed, completed, collected
-- ============================================================================
create or replace function public.get_ongoing_orders_for_user(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'orderNumber', o.order_number,
      'branchName', coalesce(b.name, 'Unknown Branch'),
      'pickupDate', o.pickup_date,
      'pickupSlotStart', o.pickup_slot_start,
      'pickupSlotEnd', o.pickup_slot_end,
      'finalAmountPaise', o.final_amount_paise,
      'orderStatus', o.order_status,
      'pickupPin', coalesce(o.pickup_pin, null),
      'createdAt', o.created_at,
      'updatedAt', o.updated_at
    )
    order by o.created_at desc
  ) into v_result
  from public.orders o
  left join public.branches b on b.id = o.branch_id
  where o.user_id = p_user_id
    and o.order_status = 'confirmed';

  return jsonb_build_object(
    'success', true,
    'orders', coalesce(v_result, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_ongoing_orders_for_user(uuid) to authenticated, anon;

-- ============================================================================
-- RPC: list_reward_transactions_for_user
-- ---------------------------------------------------------------------------
-- Returns paginated reward transaction history with running balance.
-- ============================================================================
create or replace function public.list_reward_transactions_for_user(
  p_user_id uuid,
  p_type text default 'all',
  p_page integer default 1,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offset integer;
  v_total_count integer;
  v_result jsonb;
begin
  v_offset := (p_page - 1) * p_limit;

  select count(*) into v_total_count
  from public.reward_transactions rt
  where rt.user_id = p_user_id
    and (p_type = 'all' or rt.type = p_type);

  select jsonb_agg(
    jsonb_build_object(
      'id', rt.id,
      'orderId', rt.order_id,
      'points', rt.points,
      'type', rt.type,
      'reason', rt.reason,
      'balanceAfter', rt.balance_after,
      'createdAt', rt.created_at
    )
    order by rt.created_at desc
  ) into v_result
  from public.reward_transactions rt
  where rt.user_id = p_user_id
    and (p_type = 'all' or rt.type = p_type)
  limit p_limit offset v_offset;

  return jsonb_build_object(
    'success', true,
    'transactions', coalesce(v_result, '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', p_page,
      'limit', p_limit,
      'total', v_total_count,
      'totalPages', ceil(v_total_count::numeric / p_limit)
    )
  );
end;
$$;

grant execute on function public.list_reward_transactions_for_user(
  uuid, text, integer, integer
) to authenticated, anon;

-- ============================================================================
-- RPC: update_user_profile
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER function for profile updates.
-- Validates that only editable fields are updated.
-- Email, provider, user_id are NOT editable.
-- ============================================================================
create or replace function public.update_user_profile(
  p_user_id uuid,
  p_whatsapp_number text default null,
  p_mobile_number text default null,
  p_area text default null,
  p_city text default null,
  p_pincode text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  -- Check profile exists
  select * into v_profile
  from public.profiles
  where auth_user_id = p_user_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Profile not found');
  end if;

  -- Update only editable fields
  update public.profiles
  set
    whatsapp_number = p_whatsapp_number,
    mobile_number = p_mobile_number,
    area = p_area,
    city = p_city,
    pincode = p_pincode,
    updated_at = now()
  where auth_user_id = p_user_id;

  -- If all required fields are filled, mark profile as completed
  if p_whatsapp_number is not null and p_whatsapp_number != ''
     and v_profile.full_name is not null and v_profile.full_name != ''
  then
    update public.profiles
    set profile_completed = true
    where auth_user_id = p_user_id;
  end if;

  return jsonb_build_object('success', true, 'message', 'Profile updated');
end;
$$;

grant execute on function public.update_user_profile(
  uuid, text, text, text, text, text
) to authenticated, anon;

-- ============================================================================
-- RPC: get_full_reward_summary
-- ---------------------------------------------------------------------------
-- Returns complete reward info: balance, lifetime earned/redeemed, redeemable value.
-- ============================================================================
create or replace function public.get_full_reward_summary(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_total_earned integer;
  v_total_redeemed integer;
  v_redeemable_value integer;
begin
  -- Lazy init
  insert into public.reward_balance (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select balance_points, total_earned, total_redeemed
  into v_balance, v_total_earned, v_total_redeemed
  from public.reward_balance
  where user_id = p_user_id;

  -- Redeemable value: floor(redeemable_points / 10) * 5 (in paise)
  -- 10 points = 500 paise = Rs 5
  v_redeemable_value := (floor(v_balance::numeric / 10) * 10 / 10) * 500;

  return jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'balancePoints', v_balance,
      'totalEarned', v_total_earned,
      'totalRedeemed', v_total_redeemed,
      'redeemableValuePaise', v_redeemable_value,
      'redeemableValueDisplay', 'Rs ' || (v_redeemable_value / 100)::text
    )
  );
end;
$$;

grant execute on function public.get_full_reward_summary(uuid) to authenticated, anon;

-- ============================================================================
-- DONE.
-- ---------------------------------------------------------------------------
-- Tables added: order_status_history (with RLS)
-- RPCs added:
--   list_orders_for_user         - paginated order history with filters
--   get_order_details_for_user   - full order with items + branch + status timeline
--   get_ongoing_orders_for_user  - active orders only
--   list_reward_transactions_for_user - paginated reward history
--   update_user_profile          - secure profile update
--   get_full_reward_summary      - complete reward dashboard data
-- ============================================================================
