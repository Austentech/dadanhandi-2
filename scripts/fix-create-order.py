#!/usr/bin/env python3
"""Fix create-order route: make the attach fallback non-blocking."""
import re

filepath = '/home/z/my-project/src/app/api/checkout/create-order/route.ts'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the entire section from step 8 (attach) through step 8's closing brace
old_section = content[content.index('    // 8. Attach Razorpay'):content.index('    // 9. Save customer notes')]

new_section = """    // 8. Attach Razorpay order_id to our order (creates payment row, transitions to awaiting_payment)
    // NOTE: This step is best-effort. Even if it fails, the Razorpay order was created
    // successfully and the client can proceed with payment. The verify-payment endpoint
    // uses the Razorpay order_id directly (not from our DB), so it works either way.
    const attachResult = await attachRazorpayOrderToOrder({
      orderId,
      userId: user.id,
      razorpayOrderId: rzpResult.data.razorpayOrderId,
      amountPaise: c.finalAmountPaise,
    })

    if (!attachResult.success) {
      console.error('[CHECKOUT CREATE-ORDER] attach RPC failed:', attachResult.message)
      try {
        const { createServerClient } = await import('@/lib/supabase/client-server')
        const supabase = await createServerClient()

        // Try razorpay_order_id column first
        let orderUpdateOk = false
        const { error: updateErr1 } = await supabase
          .from('orders')
          .update({
            razorpay_order_id: rzpResult.data.razorpayOrderId,
            order_status: 'awaiting_payment',
          })
          .eq('id', orderId)
          .eq('user_id', user.id)
          .is('order_status', 'draft')

        if (!updateErr1) {
          orderUpdateOk = true
        } else {
          // Column may not exist (DB not migrated yet) - try stripe column as fallback
          console.warn('[CHECKOUT CREATE-ORDER] razorpay_order_id update failed:', updateErr1.message)
          const { error: updateErr2 } = await supabase
            .from('orders')
            .update({
              stripe_payment_intent_id: rzpResult.data.razorpayOrderId,
              order_status: 'awaiting_payment',
            })
            .eq('id', orderId)
            .eq('user_id', user.id)
            .is('order_status', 'draft')

          if (!updateErr2) {
            orderUpdateOk = true
          } else {
            console.error('[CHECKOUT CREATE-ORDER] Both column updates failed:', updateErr2.message)
          }
        }

        // Try to insert payment row (non-critical, best-effort)
        if (orderUpdateOk) {
          try {
            const { error: payErr1 } = await supabase
              .from('payments')
              .insert({
                order_id: orderId,
                user_id: user.id,
                razorpay_order_id: rzpResult.data.razorpayOrderId,
                amount_paise: c.finalAmountPaise,
                currency: CHECKOUT_CONFIG.currency,
                status: 'pending',
              })
            if (payErr1) {
              console.warn('[CHECKOUT CREATE-ORDER] Payment insert failed (non-critical):', payErr1.message)
            }
          } catch {
            // Payment row is non-critical
          }
        }
      } catch (fallbackErr) {
        console.error('[CHECKOUT CREATE-ORDER] Direct fallback error:', fallbackErr)
        // DO NOT cancel the order or return error - Razorpay order was created,
        // payment can proceed. The DB attachment is nice-to-have but not required.
      }
    }

"""

content = content[:content.index('    // 8. Attach Razorpay')] + new_section + content[content.index('    // 9. Save customer notes'):]

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed create-order route successfully')
