/**
 * Reward History Tab
 * Displays reward summary at top, then paginated transaction history.
 */

'use client'

import { useEffect } from 'react'
import { useAccountStore, type RewardTransaction } from '@/store/account-store'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function TransactionRow({ tx }: { tx: RewardTransaction }) {
  const isEarn = tx.type === 'earn' || tx.type === 'adjust'
  return (
    <div className="reward-tx-row">
      <div className="reward-tx-icon">
        <i className={isEarn ? 'fas fa-plus-circle' : 'fas fa-minus-circle'} style={{ color: isEarn ? '#2E7D32' : '#C62828' }}></i>
      </div>
      <div className="reward-tx-info">
        <div className="reward-tx-reason">{tx.reason}</div>
        <div className="reward-tx-date">{formatDate(tx.createdAt)}</div>
      </div>
      <div className="reward-tx-points">
        <span style={{ fontWeight: 700, color: isEarn ? '#2E7D32' : '#C62828', fontSize: '1rem' }}>
          {isEarn ? '+' : ''}{tx.points}
        </span>
        <span style={{ fontSize: '0.75rem', color: '#7A5030' }}> pts</span>
      </div>
      <div className="reward-tx-balance" style={{ display: 'none' }}>
        {tx.balanceAfter}
      </div>
    </div>
  )
}

export default function AccountRewardHistory() {
  const {
    rewardSummary, rewardTransactions, rewardsPagination,
    isLoadingRewards, rewardsError, rewardFilterType,
    setRewardFilterType, fetchRewards,
  } = useAccountStore()

  useEffect(() => {
    fetchRewards(1)
  }, [fetchRewards])

  const handleFilterChange = (type: string) => {
    setRewardFilterType(type)
    fetchRewards(1)
  }

  return (
    <div>
      <div className="account-tab-header">
        <h2 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '1.4rem', fontWeight: 700, color: '#7A0C0C', margin: 0 }}>
          Reward History
        </h2>
      </div>

      {/* Reward Summary Card */}
      {rewardSummary && (
        <div className="account-reward-summary">
          <div className="account-reward-stat">
            <div className="account-reward-stat-label">Current Balance</div>
            <div className="account-reward-stat-value">
              <i className="fas fa-star" style={{ color: '#C46A2E', marginRight: 6, fontSize: '1rem' }}></i>
              {rewardSummary.balancePoints} pts
            </div>
          </div>
          <div className="account-reward-stat-divider"></div>
          <div className="account-reward-stat">
            <div className="account-reward-stat-label">Lifetime Earned</div>
            <div className="account-reward-stat-value">{rewardSummary.totalEarned} pts</div>
          </div>
          <div className="account-reward-stat-divider"></div>
          <div className="account-reward-stat">
            <div className="account-reward-stat-label">Lifetime Redeemed</div>
            <div className="account-reward-stat-value">{rewardSummary.totalRedeemed} pts</div>
          </div>
          <div className="account-reward-stat-divider"></div>
          <div className="account-reward-stat">
            <div className="account-reward-stat-label">Redeemable Value</div>
            <div className="account-reward-stat-value" style={{ color: '#7A0C0C' }}>
              {rewardSummary.redeemableValueDisplay}
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="account-filters" style={{ marginBottom: 0 }}>
        <div className="account-filter-group">
          <label className="account-filter-label">Type</label>
          <select
            className="account-filter-select"
            value={rewardFilterType}
            onChange={(e) => handleFilterChange(e.target.value)}
          >
            <option value="all">All Transactions</option>
            <option value="earn">Earned</option>
            <option value="redeem">Redeemed</option>
          </select>
        </div>
      </div>

      {/* Loading */}
      {isLoadingRewards && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div className="auth-spinner" style={{ margin: '0 auto', width: 28, height: 28 }}></div>
          <p style={{ color: '#7A5030', marginTop: 12, fontSize: '0.9rem' }}>Loading rewards...</p>
        </div>
      )}

      {/* Error */}
      {rewardsError && !isLoadingRewards && (
        <div className="auth-message auth-message-error" style={{ marginTop: 16 }}>{rewardsError}</div>
      )}

      {/* Empty State */}
      {!isLoadingRewards && !rewardsError && rewardTransactions.length === 0 && (
        <div className="account-empty-state">
          <i className="fas fa-award" style={{ fontSize: '2.5rem', color: '#C46A2E', marginBottom: 16 }}></i>
          <h3>No transactions yet</h3>
          <p>Earn reward points by placing orders with a plantation donation.</p>
        </div>
      )}

      {/* Transaction List */}
      {!isLoadingRewards && rewardTransactions.length > 0 && (
        <div className="account-tx-list">
          {rewardTransactions.map((tx: RewardTransaction) => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {rewardsPagination && rewardsPagination.totalPages > 1 && (
        <div className="account-pagination">
          <button
            type="button"
            className="account-pagination-btn"
            disabled={rewardsPagination.page <= 1}
            onClick={() => fetchRewards(rewardsPagination.page - 1)}
          >
            <i className="fas fa-chevron-left"></i> Previous
          </button>
          <span style={{ fontSize: '0.85rem', color: '#7A5030' }}>
            Page {rewardsPagination.page} of {rewardsPagination.totalPages}
          </span>
          <button
            type="button"
            className="account-pagination-btn"
            disabled={rewardsPagination.page >= rewardsPagination.totalPages}
            onClick={() => fetchRewards(rewardsPagination.page + 1)}
          >
            Next <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      )}
    </div>
  )
}
