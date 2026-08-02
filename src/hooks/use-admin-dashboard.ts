/**
 * useAdminDashboard
 * Custom hook: fetches dashboard stats + subscribes to Supabase Realtime.
 * Returns stats, loading state, and a manual refresh function.
 */

'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { DashboardStats } from '@/store/admin-store'

const EMPTY_STATS: DashboardStats = {
  todayOrders: 0,
  pendingOrders: 0,
  acceptedOrders: 0,
  preparingOrders: 0,
  readyOrders: 0,
  completedOrders: 0,
  cancelledOrders: 0,
  upcomingOrders: 0,
}

export function useAdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/dashboard')
      if (res.status === 401) {
        return
      }
      const data = await res.json()
      if (mountedRef.current) {
        if (data.success && data.stats) {
          setStats(data.stats)
          setError(null)
        } else {
          setError('Failed to load stats')
        }
      }
    } catch {
      if (mountedRef.current) setError('Network error')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    fetchStats()
    return () => { mountedRef.current = false }
  }, [fetchStats])

  // Supabase Realtime
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) return

    const supabase = createBrowserClient(supabaseUrl, supabaseKey)
    const channel = supabase
      .channel('admin-dashboard-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => { fetchStats() }
      )
      .subscribe()

    return () => {
      try { supabase.removeChannel(channel) } catch { /* */ }
    }
  }, [fetchStats])

  return { stats, loading, error, refresh: fetchStats }
}
