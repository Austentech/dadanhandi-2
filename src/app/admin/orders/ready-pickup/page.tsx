'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import AdminShell from '@/components/admin/AdminShell'
import { useAdminDashboard } from '@/hooks/use-admin-dashboard'
import { getBranchContact, formatPhoneDisplay } from '@/lib/admin/branch-contacts'
import { Package, XCircle, RefreshCw } from 'lucide-react'
import type { AdminOrderWithItems } from '@/services/admin-order-service'

export default function ReadyForPickupPage() {
  return (
    <AdminShell>
      <h1>Test</h1>
    </AdminShell>
  )
}
