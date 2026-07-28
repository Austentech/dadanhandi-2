/**
 * My Account Tab
 * Shows profile info, reward points card, and profile update form.
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { Profile } from '@/types/auth'
import type { User } from '@supabase/supabase-js'
import { formatPrice } from '@/lib/pricing'
import { useAccountStore, type ProfileFormData } from '@/store/account-store'

interface Props {
  user: User
  profile: Profile | null
}

export default function AccountMyAccount({ user, profile }: Props) {
  const {
    rewardSummary, isUpdatingProfile, profileUpdateSuccess, profileUpdateError,
    updateProfile, clearProfileMessages, fetchRewards,
  } = useAccountStore()

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<ProfileFormData>({
    whatsapp_number: profile?.whatsapp_number || '',
    mobile_number: profile?.mobile_number || '',
    area: profile?.area || '',
    city: profile?.city || '',
    pincode: profile?.pincode || '',
  })

  // Only sync when NOT editing (to pick up changes from save)
  useEffect(() => {
    if (profile && !isEditing) {
      setForm({
        whatsapp_number: profile.whatsapp_number || '',
        mobile_number: profile.mobile_number || '',
        area: profile.area || '',
        city: profile.city || '',
        pincode: profile.pincode || '',
      })
    }
  }, [profile?.whatsapp_number, profile?.mobile_number, profile?.area, profile?.city, profile?.pincode, isEditing])

  const handleSave = async () => {
    const result = await updateProfile(form)
    if (result.success) {
      setIsEditing(false)
      // Refresh profile from auth hook
      window.location.reload()
    }
  }

  const handleCancel = () => {
    setForm({
      whatsapp_number: profile?.whatsapp_number || '',
      mobile_number: profile?.mobile_number || '',
      area: profile?.area || '',
      city: profile?.city || '',
      pincode: profile?.pincode || '',
    })
    setIsEditing(false)
    clearProfileMessages()
  }

  // Client-side validation helpers
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ProfileFormData, string>>>({})

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof ProfileFormData, string>> = {}
    if (form.whatsapp_number && !/^[6-9]\d{9}$/.test(form.whatsapp_number)) {
      errors.whatsapp_number = 'Enter a valid 10-digit number'
    }
    if (form.mobile_number && !/^\d{10}$/.test(form.mobile_number)) {
      errors.mobile_number = 'Enter a valid 10-digit number'
    }
    if (form.area && form.area.trim().length < 2) {
      errors.area = 'At least 2 characters'
    }
    if (form.city && form.city.trim().length < 2) {
      errors.city = 'At least 2 characters'
    }
    if (form.pincode && !/^\d{6}$/.test(form.pincode)) {
      errors.pincode = 'Enter a valid 6-digit pincode'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSaveWithValidation = async () => {
    if (!validateForm()) return
    await handleSave()
  }

  const createdDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  return (
    <div>
      {/* Header */}
      <div className="account-tab-header">
        <h2 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '1.4rem', fontWeight: 700, color: '#7A0C0C', margin: 0 }}>
          My Account
        </h2>
      </div>

      {/* Reward Points Card */}
      {rewardSummary && (
        <div className="account-reward-card">
          <div className="account-reward-card-icon">
            <i className="fas fa-star"></i>
          </div>
          <div className="account-reward-card-info">
            <div className="account-reward-card-label">Current Reward Points</div>
            <div className="account-reward-card-value">
              {rewardSummary.balancePoints} Points
            </div>
            <div className="account-reward-card-sub">
              Redeemable: {rewardSummary.redeemableValueDisplay}
            </div>
          </div>
        </div>
      )}

      {/* Profile Info */}
      <div className="auth-card auth-card-responsive">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '1.2rem', fontWeight: 700, color: '#7A0C0C', margin: 0 }}>
            Profile Information
          </h3>
          {!isEditing && (
            <button
              type="button"
              className="account-edit-btn"
              onClick={() => { setIsEditing(true); clearProfileMessages() }}
            >
              <i className="fas fa-pen" style={{ marginRight: 6 }}></i>
              Edit
            </button>
          )}
        </div>

        {/* Messages */}
        {profileUpdateSuccess && (
          <div className="auth-message auth-message-success" style={{ marginBottom: 16 }}>
            {profileUpdateSuccess}
          </div>
        )}
        {profileUpdateError && (
          <div className="auth-message auth-message-error" style={{ marginBottom: 16 }}>
            {profileUpdateError}
          </div>
        )}

        {isEditing ? (
          /* Edit Form */
          <div className="account-profile-form">
            {[
              { key: 'whatsapp_number', label: 'WhatsApp Number', placeholder: '9876543210', type: 'tel', required: true },
              { key: 'mobile_number', label: 'Mobile Number', placeholder: '9876543210 (optional)', type: 'tel', required: false },
              { key: 'area', label: 'Area', placeholder: 'Your area', type: 'text', required: false },
              { key: 'city', label: 'City', placeholder: 'Your city', type: 'text', required: false },
              { key: 'pincode', label: 'Pincode', placeholder: '800001', type: 'text', required: false },
            ].map((field) => (
              <div key={field.key} className="account-form-field">
                <label className="account-form-label" htmlFor={`field-${field.key}`}>
                  {field.label}
                  {field.required && <span style={{ color: '#C46A2E', marginLeft: 2 }}>*</span>}
                </label>
                <input
                  id={`field-${field.key}`}
                  type={field.type}
                  className={`account-form-input ${fieldErrors[field.key as keyof ProfileFormData] ? 'error' : ''}`}
                  value={form[field.key as keyof ProfileFormData]}
                  placeholder={field.placeholder}
                  maxLength={field.key === 'pincode' ? 6 : undefined}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  aria-invalid={!!fieldErrors[field.key as keyof ProfileFormData]}
                  aria-describedby={fieldErrors[field.key as keyof ProfileFormData] ? `err-${field.key}` : undefined}
                />
                {fieldErrors[field.key as keyof ProfileFormData] && (
                  <p id={`err-${field.key}`} className="account-form-error" role="alert">
                    {fieldErrors[field.key as keyof ProfileFormData]}
                  </p>
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button
                type="button"
                className="auth-btn-primary"
                onClick={handleSaveWithValidation}
                disabled={isUpdatingProfile}
                style={{ minWidth: 120, opacity: isUpdatingProfile ? 0.7 : 1 }}
              >
                {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                className="account-btn-secondary"
                onClick={handleCancel}
                disabled={isUpdatingProfile}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* Display Mode */
          <>
            <div className="profile-grid">
              {[
                { label: 'Full Name', value: profile?.full_name || '—' },
                { label: 'Email', value: profile?.email || user.email || '—', readOnly: true },
                { label: 'WhatsApp', value: profile?.whatsapp_number || '—' },
                { label: 'Mobile', value: profile?.mobile_number || '—' },
                { label: 'Area', value: profile?.area || '—' },
                { label: 'City', value: profile?.city || '—' },
                { label: 'Pincode', value: profile?.pincode || '—' },
                { label: 'Login Provider', value: (profile?.provider || '—').replace(/^./, (c) => c.toUpperCase()) },
                { label: 'Account Created', value: createdDate },
              ].map((item) => (
                <div key={item.label}>
                  <p className="account-field-label">{item.label}
                    {item.readOnly && <span style={{ opacity: 0.5, marginLeft: 4, fontSize: '0.7rem' }}>(read only)</span>}
                  </p>
                  <p className="account-field-value">{item.value}</p>
                </div>
              ))}
            </div>
            {profile && !profile.profile_completed && (
              <div className="auth-message auth-message-error" style={{ marginTop: 20 }}>
                Your profile is incomplete. Please update your WhatsApp number to place orders.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
