/**
 * Migration 009: Pickup PIN System
 * ---------------------------------------------------------------------------
 * Adds PIN generation audit columns to orders table, creates the
 * pickup_pin_audit_log table for complete audit trail, and updates
 * the get_ongoing_orders_for_user RPC to include new statuses.
 *
 * The orders table already has:
 *   - pickup_pin text  (reserved in migration 004)
 *   - admin_assigned_to uuid  (reserved in migration 004)
 *
 * This migration adds:
 *   - pin_generated_at timestamptz  (when PIN was generated)
 *   - pin_generated_by uuid  (admin who generated it)
 *   - pickup_pin_audit_log table  (full audit trail)
 *   - Index on pickup_pin for active orders (uniqueness enforcement)
 *   - Updated RPC to cover accepted/preparing/ready_for_pickup statuses
 */

-- 1. Add PIN generation audit columns to orders
alter table public.orders
  add column if not exists pin_generated_at timestamptz,
  add column if not exists pin_generated_by uuid;

-- 2. Create pickup PIN audit log table
create table if not exists public.pickup_pin_audit_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  pickup_pin text not null,
  generated_by uuid not null references public.admin_users(id),
  previous_status text not null,
  new_status text not null,
  created_at timestamptz not null default now()
);

-- Index for querying audit logs by order
create index if not exists idx_pin_audit_order
  on public.pickup_pin_audit_log(order_id);

-- Index for querying audit logs by admin
create index if not exists idx_pin_audit_admin
  on public.pickup_pin_audit_log(generated_by);

-- Index for date-range queries on audit logs
create index if not exists idx_pin_audit_created
  on public.pickup_pin_audit_log(created_at);

-- RLS on audit log
alter table public.pickup_pin_audit_log enable row level security;

-- Service role has full access (admin operations)
drop policy if exists "pin_audit_service_role_all" on public.pickup_pin_audit_log;
create policy "pin_audit_service_role_all"
  on public.pickup_pin_audit_log for all
  to service_role
  using (true)
  with check (true);

-- Authenticated users can read their own order's audit logs
drop policy if exists "pin_audit_select_own" on public.pickup_pin_audit_log;
create policy "pin_audit_select_own"
  on public.pickup_pin_audit_log for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = pickup_pin_audit_log.order_id
        and o.user_id = auth.uid()
    )
  );

-- 3. Partial unique index: prevent duplicate active PINs
-- Only enforces uniqueness among orders that are NOT completed/cancelled/failed
create unique index if not exists idx_orders_active_pin_unique
  on public.orders(pickup_pin)
  where pickup_pin is not null
    and order_status not in ('completed', 'cancelled', 'failed');

-- 4. Index for finding orders by PIN (useful for future collection verification)
create index if not exists idx_orders_pickup_pin
  on public.orders(pickup_pin)
  where pickup_pin is not null;

-- 5. Update the get_ongoing_orders_for_user RPC
--    Previously only returned 'confirmed' orders.
--    Now includes: accepted, preparing, ready_for_pickup (all active kitchen statuses)
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
      'pickupPin', o.pickup_pin,
      'pinGeneratedAt', o.pin_generated_at,
      'createdAt', o.created_at,
      'updatedAt', o.updated_at
    )
    order by o.pickup_date desc, o.pickup_slot_start desc
  ) into v_result
  from public.orders o
  left join public.branches b on b.id = o.branch_id
  where o.user_id = p_user_id
    and o.order_status in ('accepted', 'preparing', 'ready_for_pickup');

  return jsonb_build_object(
    'success', true,
    'orders', coalesce(v_result, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_ongoing_orders_for_user(uuid) to authenticated, anon;

-- 6. Update the get_order_detail_for_user RPC to include PIN fields
--    (if it exists — this is a safety update for the order detail page)
create or replace function public.get_order_detail_for_user(
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
  v_history jsonb;
begin
  -- Fetch the order (user can only see their own orders)
  select o.*, b.name as branch_name, b.address_line1 as branch_address, b.city as branch_city
  into v_order
  from public.orders o
  left join public.branches b on b.id = o.branch_id
  where o.id = p_order_id
    and o.user_id = p_user_id;

  if v_order is null then
    return jsonb_build_object('success', false, 'message', 'Order not found');
  end if;

  -- Fetch order items
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
    order by oi.created_at
  ) into v_items
  from public.order_items oi
  where oi.order_id = p_order_id;

  -- Fetch status history
  select jsonb_agg(
    jsonb_build_object(
      'status', osh.status,
      'note', osh.note,
      'createdAt', osh.created_at
    )
    order by osh.created_at
  ) into v_history
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
      'pinGeneratedAt', v_order.pin_generated_at,
      'customerNotes', v_order.customer_notes,
      'branch', jsonb_build_object(
        'name', coalesce(v_order.branch_name, 'Unknown Branch'),
        'addressLine1', coalesce(v_order.branch_address, ''),
        'city', coalesce(v_order.branch_city, '')
      ),
      'items', coalesce(v_items, '[]'::jsonb),
      'statusHistory', coalesce(v_history, '[]'::jsonb),
      'createdAt', v_order.created_at,
      'updatedAt', v_order.updated_at
    )
  );
end;
$$;

grant execute on function public.get_order_detail_for_user(uuid, uuid) to authenticated, anon;

-- 7. Add service_role policy for admin_users (needed for audit log FK reference)
drop policy if exists "admin_users_service_role_select" on public.admin_users;
create policy "admin_users_service_role_select"
  on public.admin_users for select
  to service_role
  using (true);
