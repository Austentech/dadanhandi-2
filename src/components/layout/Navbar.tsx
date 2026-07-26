"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS, SITE_CONFIG } from "@/constants/site";
import { useAuth } from "@/hooks/use-auth";
import { useAuthContext } from "@/components/auth/AuthProvider";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const mobileOpenRef = useRef(false);
  const { isAuthenticated, isLoading, profile, signOut } = useAuth();
  const { openAuthModal, openUserDrawer } = useAuthContext();

  const closeMobile = useCallback(() => {
    mobileOpenRef.current = false;
    setMobileOpen(false);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (mobileOpenRef.current) {
      mobileOpenRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMobileOpen(false);
    }
  }, [pathname]);

  const toggleMobile = useCallback(() => {
    const next = !mobileOpenRef.current;
    mobileOpenRef.current = next;
    setMobileOpen(next);
  }, []);

  const firstName = profile?.full_name?.split(" ")[0] || null;

  return (
    <nav className="navbar" style={scrolled ? { boxShadow: "0 2px 24px rgba(122,12,12,0.25)" } : undefined}>
      <div className="container-custom">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" className="navbar-brand">
            <img src="/images/brand-logo.png" alt="Dadan Handi Mutton Hotel Logo" className="brand-logo" />
            <div className="brand-text-wrap">
              <div className="brand-name"><b>{SITE_CONFIG.name}</b></div>
              <div className="brand-sub">Since {SITE_CONFIG.since} · {SITE_CONFIG.location}</div>
            </div>
          </Link>

          <ul className="navbar-nav" style={{ display: "flex", alignItems: "center" }}>
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`nav-link${pathname === link.href ? " active" : ""}`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {/* Auth button or user greeting */}
            <li>
              {isLoading ? (
                <span className="nav-auth-btn" style={{ opacity: 0.6 }}>...</span>
              ) : isAuthenticated && firstName ? (
                <button
                  className="nav-user-btn"
                  onClick={openUserDrawer}
                  aria-label="Open user menu"
                >
                  <span className="nav-user-icon">
                    <i className="fas fa-user"></i>
                  </span>
                  <span className="nav-user-name">Hello, {firstName}</span>
                </button>
              ) : (
                <button
                  className="nav-login-btn"
                  onClick={() => openAuthModal("login")}
                >
                  <i className="fas fa-user" style={{ marginRight: 6 }}></i> Login
                </button>
              )}
            </li>
          </ul>

          <button className="navbar-toggler" onClick={toggleMobile} aria-label="Toggle navigation">
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      <div className={`mobile-nav-overlay${mobileOpen ? " open" : ""}`} onClick={toggleMobile} />

      {/* Mobile panel */}
      <div className={`mobile-nav-panel${mobileOpen ? " open" : ""}`}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontFamily: "var(--font-playfair)", fontWeight: 700, color: "#7A0C0C", fontSize: "1rem" }}>Menu</span>
          <button onClick={toggleMobile} style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "#7A0C0C" }}>✕</button>
        </div>
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link${pathname === link.href ? " active" : ""}`}
            onClick={toggleMobile}
          >
            {link.label}
          </Link>
        ))}
        {/* Mobile auth section */}
        <div style={{ marginTop: 24, padding: "12px 16px", borderTop: "1px solid rgba(122,12,12,0.15)" }}>
          {isAuthenticated && firstName ? (
            <>
              <Link
                href="/account"
                className="nav-user-btn"
                onClick={toggleMobile}
                style={{ width: "100%", justifyContent: "center", padding: "10px 16px", marginBottom: 10, textDecoration: "none" }}
              >
                <span className="nav-user-icon">
                  <i className="fas fa-user"></i>
                </span>
                <span className="nav-user-name">Hello, {firstName}</span>
              </Link>
              <button
                className="mobile-logout-btn"
                onClick={async () => {
                  toggleMobile()
                  await signOut()
                  window.location.href = "/"
                }}
              >
                <i className="fas fa-sign-out-alt"></i>
                <span>Logout</span>
              </button>
            </>
          ) : (
            <>
              <button
                className="nav-login-btn"
                onClick={() => {
                  toggleMobile()
                  openAuthModal("login")
                }}
                style={{ width: "100%", justifyContent: "center", padding: "10px 16px", marginBottom: 12 }}
              >
                <i className="fas fa-user" style={{ marginRight: 6 }}></i> Login
              </button>
              <Link href="/menu" style={{ color: "#7A0C0C", fontWeight: 700, fontSize: "0.9rem", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
                <i className="fas fa-utensils"></i> Browse Menu & Order
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
