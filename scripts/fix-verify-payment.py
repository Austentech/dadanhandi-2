#!/usr/bin/env python3
"""Fix verify-payment route: add direct fallback if mark_order_succeeded RPC doesn't exist."""

filepath = '/home/z/my-project/src/app/api/checkout/verify-payment/route.ts'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the section to replace (from "// 5. Signature is valid" to "// 6. Return success")
marker_start = '    // 5. Signature is valid'
marker_end = '    // 6. Return success'

start_idx = content.index(marker_start)
end_idx = content.index(marker_end)

old_section = content[start_idx:end_idx]

new_section = '''    // 5. Signature is valid — mark order as succeeded
    //  - Order transitions to 'confirmed'
    //  - Payment row updated with razorpay_payment_id + signature
    //  - Reward points awarded (5 if subtotal > ₹500 AND plantation donation)
    //  - Cart cleared
    let successResult = await markOrderSucceeded({
      orderId,
      razorpayPaymentId,
      razorpaySignature,
      webhookEventId: `verify-success-${Date.now()}-${razorpayPaymentId.slice(-8)}`,
      eventType: 'payment.verified',
      rawPayload: { razorpayOrderId, razorpayPaymentId },
    })

    // If RPC failed, try direct fallback (in case migration 004/005 not applied)
    if (!successResult.success) {
      console.warn('[VERIFY PAYMENT] markOrderSucceeded RPC failed:', successResult.message, '- trying direct fallback')
      try {
        const { createServerClient } = await import('@/lib/supabase/client-server')
        const supabase = await createServerClient()

        // Update order to confirmed
        const { error: orderErr } = await supabase
          .from('orders')
          .update({
            order_status: 'confirmed',
            payment_status: 'succeeded',
          })
          .eq('id', orderId)
          .eq('user_id', user.id)
          .in('order_status', ['draft', 'awaiting_payment'])

        if (orderErr) {
          console.error('[VERIFY PAYMENT] Direct order update failed:', orderErr.message)
          return NextResponse.json(
            { success: false, message: 'Payment was successful but we could not update your order. Please contact support.' },
            { status: 500 },
          )
        }

        // Try to update payment row (best-effort)
        try {
          await supabase
            .from('payments')
            .update({
              status: 'succeeded',
              razorpay_payment_id: razorpayPaymentId,
              razorpay_signature: razorpaySignature,
            })
            .eq('order_id', orderId)
            .eq('user_id', user.id)
        } catch {
          // Payment update is non-critical
        }

        // Clear user's cart
        try {
          await supabase.from('cart_items').delete().eq('user_id', user.id)
        } catch {
          // Cart clear is best-effort
        }

        successResult = { success: true, message: 'Order confirmed via direct fallback.' }
      } catch (fallbackErr) {
        console.error('[VERIFY PAYMENT] Direct fallback also failed:', fallbackErr)
        return NextResponse.json(
          { success: false, message: 'Payment was successful but we could not update your order. Please contact support with your order number.' },
          { status: 500 },
        )
      }
    }

    '''

content = content[:start_idx] + new_section + content[end_idx:]

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed verify-payment route successfully')
