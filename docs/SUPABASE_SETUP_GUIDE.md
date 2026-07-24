# 🚀 Supabase Setup Guide for Dadan Handi Mutton Hotel

## Current Status
✅ Project URL: `https://vwlsisgiznadspvkwzpv.supabase.co`
✅ Auth system code is fully implemented
✅ Next.js build successful (zero errors)
✅ All API routes working

## 🔧 Steps to Complete Setup (Dashboard Configuration)

### Step 1: Run SQL Migration (CRITICAL — Must Do First)

Go to your **Supabase Dashboard** → **SQL Editor** → **New Query**

Copy and paste the entire contents of this file:
`supabase/migrations/001_create_profiles_table.sql`

Click **Run** to execute.

This creates:
- ✅ `profiles` table with all columns
- ✅ Row Level Security (RLS) policies
- ✅ Auto-create profile trigger on signup
- ✅ Auto-update `updated_at` trigger
- ✅ Indexes for performance

---

### Step 2: Configure Site URL & Redirect URLs

Go to **Authentication** → **URL Configuration**

**Site URL:** `https://dadanhandihotel.com`

**Redirect URLs** (add these):
- `https://dadanhandihotel.com/api/auth/callback`
- `http://localhost:3000/api/auth/callback`

Click **Save**.

---

### Step 3: Configure Email OTP (Already Partially Enabled)

Go to **Authentication** → **Providers**

#### Email Provider Settings:
- **Enable Email provider:** ✅ (already ON)
- **Confirm email:** Set to **OFF** (for OTP/passwordless login)
- **Secure email change:** Set to **ON**
- **Email OTP length:** `6`
- **Email OTP expiry:** `3600` (1 hour)
- **Template:** Customize if desired

The OTP email template can be found under:
**Authentication** → **Email Templates** → **Confirm Signup** or **Magic Link**

For OTP mode, Supabase sends a 6-digit code in the email body automatically.

---

### Step 4: Enable Google OAuth

Go to **Authentication** → **Providers** → **Google**

1. **Enable Google provider:** Toggle **ON**
2. **Client ID:** Get from Google Cloud Console (see below)
3. **Client Secret:** Get from Google Cloud Console (see below)

#### How to get Google OAuth Credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Go to **APIs & Services** → **OAuth consent screen**
   - Set **User Type** to **External**
   - Fill in required fields:
     - App name: `Dadan Handi Mutton Hotel`
     - User support email: your email
     - Developer contact: your email
4. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins:
     - `https://vwlsisgiznadspvkwzpv.supabase.co`
   - Authorized redirect URIs:
     - `https://vwlsisgiznadspvkwzpv.supabase.co/auth/v1/callback`
   - Click **Create**
5. Copy **Client ID** and **Client Secret** into Supabase Google provider settings
6. Click **Save**

---

### Step 5: Get Service Role Key (for server-side operations)

Go to **Settings** → **API**

Copy the **service_role** key (starts with `eyJ...`) and add it to your `.env.local`:

```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

⚠️ **IMPORTANT:** Never expose this key in client-side code or commit it to git.

---

### Step 6: (Optional) Configure Email Templates

Go to **Authentication** → **Email Templates**

For OTP emails, you can customize the **Magic Link** or **Confirm Signup** template:

**Subject:** `Your OTP for Dadan Handi Mutton Hotel`

**Body (use `{{ .Token }}` for OTP code):**
```html
<h2>Welcome to Dadan Handi Mutton Hotel! 🍛</h2>
<p>Your verification code is:</p>
<h1 style="font-size: 32px; letter-spacing: 4px; color: #7A0C0C;">{{ .Token }}</h1>
<p>This code expires in 10 minutes.</p>
<p>If you didn't request this, please ignore this email.</p>
```

---

## ✅ Verification Checklist

After completing all steps:

1. [ ] SQL migration executed successfully
2. [ ] Site URL set to `https://dadanhandihotel.com`
3. [ ] Redirect URLs configured
4. [ ] Email OTP working (test by clicking Login → enter email → check inbox)
5. [ ] Google OAuth enabled with credentials
6. [ ] Service role key added to `.env.local`
7. [ ] Profile completion flow works for Google users
8. [ ] Login button visible in navbar
9. [ ] User drawer shows after login
10. [ ] Account page accessible when logged in

---

## 📁 Architecture Overview

```
src/
├── app/
│   ├── api/auth/
│   │   ├── send-otp/route.ts          # Send email OTP
│   │   ├── verify-otp/route.ts       # Verify OTP + auto-create profile
│   │   ├── register/route.ts          # Register + send OTP
│   │   ├── resend-otp/route.ts        # Resend OTP
│   │   ├── callback/route.ts          # OAuth callback handler
│   │   ├── complete-profile/route.ts  # Google user profile completion
│   │   └── actions.ts                # Server actions (alternative)
│   ├── (auth)/
│   │   └── complete-profile/         # Profile completion page
│   └── account/                       # Protected account page
├── components/
│   ├── auth/
│   │   ├── AuthModal.tsx              # Login/Register/OTP modal
│   │   ├── OTPInput.tsx               # 6-digit OTP input component
│   │   ├── AuthProvider.tsx           # Auth context + modal/drawer state
│   │   ├── ClientProviders.tsx         # Root client provider
│   │   └── UserDrawer.tsx             # Logged-in user menu drawer
│   └── layout/
│       ├── Navbar.tsx                 # Login/User button in nav
│       └── Footer.tsx                 # Footer with Blog/Careers links
├── hooks/
│   └── use-auth.ts                    # Auth state hook (user, profile, signOut, Google)
├── lib/
│   ├── supabase/
│   │   ├── client-browser.ts          # Browser-side Supabase client
│   │   ├── client-server.ts           # Server-side Supabase client
│   │   ├── client-middleware.ts       # Middleware session handler
│   │   ├── admin.ts                   # Admin client (service role)
│   │   └── index.ts                   # Barrel exports
│   ├── validation/
│   │   └── schemas.ts                 # Zod validation schemas
│   └── security/
│       ├── rate-limiter.ts             # Rate limiting (IP + email, exponential backoff)
│       └── utils.ts                   # IP extraction, sanitization
├── services/
│   └── profile-service.ts             # Profile CRUD operations
├── types/
│   └── auth.ts                        # TypeScript interfaces
└── middleware.ts                       # Session refresh + route protection
```

---

## 🔒 Security Features Implemented

- ✅ **Row Level Security (RLS):** Users can only access their own profiles
- ✅ **Rate Limiting:** Per IP + per email, exponential backoff, max 24h block
- ✅ **Input Validation:** Zod schemas on client + server
- ✅ **CSRF Protection:** Supabase SSR cookie-based auth
- ✅ **Session Management:** Middleware auto-refreshes sessions
- ✅ **Route Protection:** `/account` requires authentication
- ✅ **Generic Error Messages:** Never leak specific auth failure reasons
- ✅ **Input Sanitization:** XSS character stripping
