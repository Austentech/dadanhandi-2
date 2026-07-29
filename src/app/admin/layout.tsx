import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin Portal - Dadan Handi',
  description: 'Admin management portal for Dadan Handi Mutton Hotel',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-root">
      {children}
    </div>
  )
}
