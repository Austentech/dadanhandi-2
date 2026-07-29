'use client'

import AdminShell from '@/components/admin/AdminShell'
import { Truck, Search } from 'lucide-react'

// ---------------------------------------------------------------------------
// Ongoing Orders Page (frontend placeholder)
// ---------------------------------------------------------------------------
export default function OngoingOrdersPage() {
  return (
    <AdminShell>
      <h1 className="admin-page-title">Ongoing Orders</h1>
      <p className="admin-page-subtitle">Orders currently being prepared or out for delivery</p>

      {/* Filter Bar */}
      <div className="admin-filter-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search by order # or customer..."
            style={{ paddingLeft: 36, width: '100%' }}
            disabled
          />
        </div>
        <select disabled>
          <option>Status: All</option>
        </select>
        <select disabled>
          <option>Date: Today</option>
        </select>
        <select disabled>
          <option>Branch: All</option>
        </select>
      </div>

      {/* Empty State */}
      <div className="admin-card" style={{ padding: 40 }}>
        <div className="admin-empty-state">
          <Truck size={48} className="admin-empty-state-icon" />
          <div className="admin-empty-state-title">No ongoing orders</div>
          <div className="admin-empty-state-desc">
            Orders that have been accepted and are being prepared will appear here.
          </div>
        </div>
      </div>

      {/* Table Placeholder */}
      <div className="admin-table-wrapper" style={{ marginTop: 16, opacity: 0.4, pointerEvents: 'none' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Customer</th>
              <th>Branch</th>
              <th>Items</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: '32px 16px' }}>
                No orders to display
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </AdminShell>
  )
}
