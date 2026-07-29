# Admin Panel — Complete Setup & Deployment Guide

## Dadan Handi Mutton Hotel — Admin Portal

---

## 1. Database Setup (Required First)

Before deploying the admin panel, you must create the admin database tables.

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**

### Step 2: Run Migration 007

Copy the entire contents of `supabase/migrations/007_admin_panel_tables.sql` and paste it into the SQL Editor.

Click **Run** to execute.

This creates:
- `admin_users` — admin accounts ( seeded with `admin@dadanhandi.com` )
- `admin_sessions` — secure session management
- `admin_otps` — OTP storage (SHA-256 hashed)
- `admin_login_logs` — full audit trail
- `admin_roles` — reserved for future RBAC
- `admin_permissions` — reserved for future RBAC
- `admin_role_permissions` — junction table for future RBAC

### Step 3: Verify Tables

In Supabase, click **Table Editor** and confirm you see all 7 `admin_*` tables.

### Step 4: Add Your Admin Email

Run this SQL to add yourself as an admin:

```sql
INSERT INTO admin_users (email, name, role)
VALUES ('your-email@example.com', 'Your Name', 'super_admin')
ON CONFLICT (email) DO NOTHING;
```

Replace `your-email@example.com` with your actual email.

---

## 2. Local Development

### Running the Admin Panel Locally

```bash
# Install dependencies
npm install   # or: bun install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
# NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Start development server
npm run dev
# or: bun dev
```

### Accessing the Panels

| Panel | URL | Description |
|-------|-----|-------------|
| Customer Website | http://localhost:3000 | Main restaurant website |
| Admin Portal | http://localhost:3000/admin/login | Admin login (no link from customer site) |
| Admin Dashboard | http://localhost:3000/admin/dashboard | After login |

### Important Notes

- The admin panel uses a **separate authentication system** from the customer login
- Admin auth uses **email OTP** (not Supabase Auth)
- OTPs are logged to the console in development mode
- There is **no link to the admin panel** from the customer website — you must type the URL manually

---

## 3. Vercel Preview Testing

Before buying a custom domain, you can test the admin panel on Vercel's preview domains.

### Deploy to Vercel

```bash
# If using Vercel CLI
vercel --prod

# Or push to GitHub and let Vercel auto-deploy
git add .
git commit -m "feat: add admin panel foundation"
git push origin main
```

### Testing on Preview Domain

After deployment, Vercel gives you a URL like:
```
https://your-project.vercel.app
```

Test both panels:
- **Customer**: `https://your-project.vercel.app` — should work exactly as before
- **Admin**: `https://your-project.vercel.app/admin/login` — should show admin login page

### Verifying Isolation

1. Open the customer website — confirm there is NO admin link anywhere
2. Manually navigate to `/admin/login` — confirm the admin login page loads
3. Log in with your admin email — confirm you reach the dashboard
4. Open a new tab to the customer site — confirm customer auth works independently

---

## 4. Production Subdomain Setup (Step-by-Step)

This guide assumes your domain is `dadanhandi.com` and you want the admin panel at `admin.dadanhandi.com`.

### Step 4.1: Connect Custom Domain to Vercel

1. Go to your Vercel project dashboard
2. Click **Settings** → **Domains**
3. Add your main domain: `dadanhandi.com`
4. Vercel will show DNS records you need to add

### Step 4.2: Configure DNS Records

In your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.), add these records:

```
Type    Name    Value                      TTL
────    ────    ──────                      ───
A       @       76.76.21.21                300    (Vercel's IP)
CNAME   www     cname.vercel-dns.com       300
```

Wait for DNS propagation (can take up to 48 hours, usually 5-30 minutes).

### Step 4.3: Create the Admin Subdomain

In your DNS settings, add:

```
Type    Name    Value                      TTL
────    ────    ──────                      ───
CNAME   admin   cname.vercel-dns.com       300
```

This creates `admin.dadanhandi.com` pointing to your Vercel project.

### Step 4.4: Add Subdomain in Vercel

1. Go to **Settings** → **Domains** in Vercel
2. Click **Add Domain**
3. Enter: `admin.dadanhandi.com`
4. Vercel will automatically detect the CNAME record
5. The domain will show as **Valid Configuration** once DNS propagates

### Step 4.5: Configure Domain Routing

This is the critical step. You need to ensure that:
- `dadanhandi.com` and `www.dadanhandi.com` serve the customer website
- `admin.dadanhandi.com` serves the admin panel

**Both domains point to the same Vercel project**, which is correct. The admin panel lives at the `/admin` path. Vercel will serve the same app for both domains.

### Step 4.6: Test SSL

1. Visit `https://admin.dadanhandi.com` — should show a green padlock
2. If SSL is not active, click **Check Configuration** in Vercel Domains
3. Vercel provisions SSL certificates automatically (can take up to 1 hour)

### Step 4.7: Test Redirects

Test these URLs:
```
https://admin.dadanhandi.com            → redirects to /admin/login
https://admin.dadanhandi.com/admin      → redirects to /admin/dashboard
https://admin.dadanhandi.com/admin/login → shows login page
https://admin.dadanhandi.com/menu       → shows customer menu page (not admin)
```

### Step 4.8: Test Production Deployment

1. Visit `https://admin.dadanhandi.com/admin/login`
2. Enter your admin email
3. Check your server logs (Vercel → Logs) for the OTP
4. Enter the 6-character OTP
5. You should see the admin dashboard

---

## 5. Environment Variables

Make sure these are set in Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RAZORPAY_KEY_ID=your-razorpay-key
RAZORPAY_KEY_SECRET=your-razorpay-secret
NODE_ENV=production
```

**No additional environment variables are needed for the admin panel.** The admin auth system uses the existing Supabase connection.

---

## 6. How Admin Authentication Works

```
Admin visits /admin/login
        ↓
Enters email address
        ↓
POST /api/admin/auth/send-otp
  → Validates email format
  → Checks rate limits
  → Checks if email exists in admin_users table
  → Generates 6-character alphanumeric OTP (e.g., A65B87)
  → Hashes OTP with SHA-256
  → Stores hash in admin_otps table
  → Sends OTP via email (console.log in dev)
  → Returns generic "If registered, code sent" message
        ↓
Admin enters 6-digit OTP
        ↓
POST /api/admin/auth/verify-otp
  → Validates OTP format
  → Checks rate limits
  → Finds admin user by email
  → Compares OTP hash (constant-time comparison)
  → Creates session token (SHA-256 hashed)
  → Stores session in admin_sessions table
  → Sets httpOnly, Secure, SameSite cookie
  → Logs successful login
        ↓
Redirected to /admin/dashboard
        ↓
Every page request:
  → Middleware checks for admin_session cookie
  → If missing, redirects to /admin/login
  → If present, page validates via /api/admin/auth/session
```

---

## 7. Security Summary

| Feature | Implementation |
|---------|---------------|
| OTP Storage | SHA-256 hashed, never plain text |
| OTP Verification | Constant-time comparison (timing-safe) |
| Session Tokens | 64-byte cryptographically random, SHA-256 hashed |
| Cookies | httpOnly, Secure (prod), SameSite=Lax |
| Rate Limiting | Per-IP and per-email, exponential backoff |
| Account Enumeration | Generic messages regardless of email existence |
| Route Protection | Middleware checks cookie presence |
| Session Validation | Server-side validation on every protected page |
| Login Logs | All attempts logged (success, failure, expired, rate-limited) |

---

## 8. Troubleshooting

### "Admin login shows 500 error"
- Check Vercel function logs for the actual error
- Ensure migration 007 has been applied to Supabase
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set

### "OTP not received"
- In development: check the terminal/console for the OTP
- In production: check server logs for email sending errors
- The email integration uses console.log as a placeholder — integrate Resend or SMTP for production

### "Redirect loop on admin pages"
- Clear browser cookies for `admin_session`
- Check that the middleware is not conflicting with Supabase auth middleware

### "Customer site shows admin link"
- This should not happen — the admin panel has no links from the customer site
- The only way to access admin is by typing `/admin/login` in the URL bar

---

## 9. Folder Structure

```
src/
├── app/
│   ├── admin/                    ← Admin panel (NEW)
│   │   ├── layout.tsx            Admin root layout (noindex)
│   │   ├── page.tsx               Redirects to /admin/dashboard
│   │   ├── login/page.tsx         OTP login page
│   │   ├── dashboard/page.tsx     Dashboard with stats
│   │   ├── account/page.tsx       Admin profile info
│   │   ├── menu/page.tsx          Menu management (placeholder)
│   │   └── orders/                Order pages (placeholder)
│   │       ├── new/page.tsx
│   │       ├── ongoing/page.tsx
│   │       ├── past/page.tsx
│   │       └── cancelled/page.tsx
│   └── api/admin/                 ← Admin API routes (NEW)
│       ├── auth/
│       │   ├── send-otp/route.ts
│       │   ├── verify-otp/route.ts
│       │   ├── logout/route.ts
│       │   ├── session/route.ts
│       │   └── login-logs/route.ts
│       └── dashboard/route.ts
├── components/admin/              ← Admin UI components (NEW)
│   ├── AdminShell.tsx             Main layout with sidebar
│   └── AdminAuthGuard.tsx         Auth check wrapper
├── lib/admin/                     ← Admin config (NEW)
│   └── config.ts
├── services/admin/                ← Admin services (NEW)
│   ├── admin-auth-service.ts      Auth orchestration
│   ├── admin-otp-service.ts       OTP generation & verification
│   └── admin-session-service.ts   Session management
├── store/
│   └── admin-store.ts            ← Admin Zustand store (NEW)
└── types/
    └── admin.ts                  ← Admin TypeScript types (NEW)
```

---

## 10. What's Next (Future Modules)

The following modules are ready for implementation:

- **Module 2**: Menu Management (CRUD for categories, items, pricing, availability)
- **Module 3**: Order Processing (accept, prepare, ready, complete orders)
- **Module 4**: Customer Management (view customer profiles, order history)
- **Module 5**: Analytics & Reports (revenue charts, order trends, peak hours)
- **Module 6**: Coupon Management (create, track, analyze promotions)
- **Module 7**: Notification System (SMS, email, push notifications)
