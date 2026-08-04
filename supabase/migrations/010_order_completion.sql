/**
 * Migration 010: Order Completion System
 * ---------------------------------------------------------------------------
 * Adds completion audit columns to orders table, updates the
 * list_orders_for_user RPC to include completion data.
 *
 * This migration supports Phase 3 Module 6: Ready for Pickup,
 * Order Collection & Completed Orders Workflow.
 */

-- 1. Add completion audit columns to orders
alter table public.orders
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid;

-- 2. Index for querying completed orders by date
create index if not exists idx_orders_completed_at
  on public.orders(completed_at)
  where completed_at is not null;

-- 3. Index for querying completed orders by admin
create index if not exists idx_orders_completed_by
  on public.orders(completed_by)
  where completed_by is not null;

-- 4. Update the list_orders_for_user RPC to include completion data
--    This is the customer-facing order history RPC used by /api/account/orders
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
  v_orders jsonb;
  v_total integer;
  v_offset integer;
  v_page_size integer;
begin
  v_page_size := least(greatest(p_limit, 1), 50);
  v_offset := (p_page - 1) * v_page_size;

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
      'pickupPin', o.pickup_pin,
      'completedAt', o.completed_at,
      'createdAt', o.created_at,
      'updatedAt', o.updated_at
    )
  ) into v_orders
  from public.orders o
  left join public.branches b on b.id = o.branch_id
  where o.user_id = p_user_id
    and o.order_status <> 'draft'
    and (p_order_status is null or o.order_status = p_order_status)
    and (p_payment_status is null or o.payment_status = p_payment_status)
    and (p_branch_slug is null or b.slug = p_branch_slug)
    and (p_search is null
         or o.order_number ilike '%' || p_search || '%'
         or o.id::text ilike '%' || p_search || '%')
  order by
    case when p_sort_order = 'oldest' then o.created_at end asc,
    case when p_sort_order <> 'oldest' then o.created_at end desc
  limit v_page_size offset v_offset;

  -- Get total count
  select count(*) into v_total
  from public.orders o
  left join public.branches b on b.id = o.branch_id
  where o.user_id = p_user_id
    and o.order_status <> 'draft'
    and (p_order_status is null or o.order_status = p_order_status)
    and (p_payment_status is null or o.payment_status = p_payment_status)
    and (p_branch_slug is null or b.slug = p_branch_slug)
    and (p_search is null
         or o.order_number ilike '%' || p_search || '%'
         or o.id::text ilike '%' || p_search || '%');

  return jsonb_build_object(
    'success', true,
    'orders', coalesce(v_orders, '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', p_page,
      'limit', v_page_size,
      'total', v_total,
      'totalPages', ceil(v_total::numeric / v_page_size)
    )
  );
end;
$$;

grant execute on function public.list_orders_for_user(
  uuid, text, text, text, text, text, integer, integer
) to authenticated, anon;

-- 5. Update the get_order_detail_for_user RPC to include completion data
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
  select o.*, b.name as branch_name, b.address_line1 as branch_address, b.city as branch_city
  into v_order
  from public.orders o
  left join public.branches b on b.id = o.branch_id
  where o.id = p_order_id
    and o.user_id = p_user_id;

  if v_order is null then
    return jsonb_build_object('success', false, 'message', 'Order not found');
  end if;

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
      'completedAt', v_order.completed_at,
      'completedBy', v_order.completed_by,
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