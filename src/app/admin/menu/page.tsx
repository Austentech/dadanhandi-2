'use client'

import { useState } from 'react'
import AdminShell from '@/components/admin/AdminShell'
import { UtensilsCrossed, Search } from 'lucide-react'

// ---------------------------------------------------------------------------
// Menu Management Page (frontend placeholder)
// ---------------------------------------------------------------------------
const CATEGORY_TABS = ['All', 'Starters', 'Main Course', 'Breads', 'Beverages', 'Desserts', 'Add-ons']

export default function MenuPage() {
  const [activeTab, setActiveTab] = useState('All')

  return (
    <AdminShell>
      <h1 className="admin-page-title">Menu Management</h1>
      <p className="admin-page-subtitle">Manage your restaurant menu items, pricing, and availability</p>

      {/* Search + Filters */}
      <div className="admin-filter-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
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
            placeholder="Search menu items..."
            style={{ paddingLeft: 36, width: '100%' }}
            disabled
          />
        </div>
        <select disabled>
          <option>Category: All</option>
        </select>
        <select disabled>
          <option>Availability: All</option>
        </select>
        <select disabled>
          <option>Sort by: Name</option>
        </select>
      </div>

      {/* Category Tabs */}
      <div className="admin-tabs">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab}
            className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Empty State */}
      <div className="admin-card" style={{ padding: 40 }}>
        <div className="admin-empty-state">
          <UtensilsCrossed size={48} className="admin-empty-state-icon" />
          <div className="admin-empty-state-title">Menu management coming soon</div>
          <div className="admin-empty-state-desc">
            Menu management will be available in the next update. You&apos;ll be able to add,
            edit, and organize your restaurant menu items here.
          </div>
        </div>
      </div>

      {/* Placeholder Table Structure */}
      <div className="admin-table-wrapper" style={{ marginTop: 16, opacity: 0.4, pointerEvents: 'none' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Availability</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '32px 16px' }}>
                No items yet
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </AdminShell>
  )
}
