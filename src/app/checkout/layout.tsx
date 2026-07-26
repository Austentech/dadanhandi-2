/**
 * Checkout Layout
 * ---------------
 * Wraps the checkout page. Reuses the global layout (Navbar/Footer) via
 * the parent root layout. This layout exists primarily to set metadata
 * and ensure the checkout page is rendered in the standard app shell.
 *
 * Auth gating is handled inside the page component itself (via useAuth)
 * so we can show a friendly "please log in" message with a redirect to
 * the auth modal — rather than a hard redirect that loses context.
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Checkout · Dadan Handi Mutton',
  description: 'Complete your order securely with pickup time selection, donations, rewards, and Stripe payment.',
  robots: { index: false, follow: false },  // checkout should not be indexed
}

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children
}
