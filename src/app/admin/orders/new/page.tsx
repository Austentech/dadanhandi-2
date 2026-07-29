'use client'

import AdminShell from '@/components/admin/AdminShell'
import { Package, Search } from 'lucide-react'

// ---------------------------------------------------------------------------
// New Orders Page (frontend placeholder)
// ---------------------------------------------------------------------------
export default function NewOrdersPage() {
  return (
    <AdminShell>
      <h1 className="admin-page-title">New Orders</h1>
      <p className="admin-page-subtitle">Orders that are awaiting confirmation and acceptance</p>

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
          <Package size={48} className="admin-empty-state-icon" />
          <div className="admin-empty-state-title">No new orders</div>
          <div className="admin-empty-state-desc">
            When customers place orders, they&apos;ll appear here for you to review and accept.
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
              <th>Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: '32px 16px' }}>
                No orders to display
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </AdminShell>
  )
}
