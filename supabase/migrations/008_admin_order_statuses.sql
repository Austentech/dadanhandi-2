/**
 * Migration 008: Extend order statuses for admin workflow.
 * ---------------------------------------------------------------------------
 * Previously: order_status in ('draft','awaiting_payment','confirmed','cancelled','failed')
 * Now adds: 'accepted', 'preparing', 'ready_for_pickup', 'completed'
 *
 * Flow: draft → awaiting_payment → confirmed → accepted → preparing → ready_for_pickup → completed
 *        Any active status → cancelled
 *
 * Also adds service_role bypass for admin operations on orders and order_items.
 */

-- 1. Extend the order_status check constraint
alter table public.orders drop constraint if exists orders_order_status_check;

alter table public.orders add constraint orders_order_status_check
  check (order_status in (
    'draft',
    'awaiting_payment',
    'confirmed',
    'accepted',
    'preparing',
    'ready_for_pickup',
    'completed',
    'cancelled',
    'failed'
  ));

-- 2. Add service_role policy for orders (admin dashboard uses service_role client)
drop policy if exists "orders_service_role_all" on public.orders;
create policy "orders_service_role_all"
  on public.orders for all
  to service_role
  using (true)
  with check (true);

-- 3. Add service_role policy for order_items
drop policy if exists "order_items_service_role_all" on public.order_items;
create policy "order_items_service_role_all"
  on public.order_items for all
  to service_role
  using (true)
  with check (true);

-- 4. Add service_role policy for order_status_history
drop policy if exists "order_status_history_service_role_all" on public.order_status_history;
create policy "order_status_history_service_role_all"
  on public.order_status_history for all
  to service_role
  using (true)
  with check (true);

-- 5. Add service_role policy for profiles (admin needs to read customer names)
drop policy if exists "profiles_service_role_select" on public.profiles;
create policy "profiles_service_role_select"
  on public.profiles for select
  to service_role
  using (true);
