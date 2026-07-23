"use client";

import { type Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PageLoader from "@/components/ui-custom/PageLoader";
import FloatingButtons from "@/components/ui-custom/FloatingButtons";
import ScrollReveal from "@/components/ui-custom/ScrollReveal";
import HungerPopup from "@/components/ui-custom/HungerPopup";
import CTABanner from "@/components/sections/CTABanner";
import { TESTIMONIALS, RATING_SUMMARY, SITE_CONFIG } from "@/constants/content";

export const metadata: Metadata = {
  title: "Customer Reviews – Dadan Handi Mutton Hotel | Patna Bihar",
  description: "Read what customers say about Dadan Handi Mutton Hotel. Authentic handi mutton reviews from loyal customers across Patna, Bihar.",
};

export default function ReviewsPage() {
  return (
    <>
      <PageLoader />
      <Navbar />
      <ScrollReveal />
      <main>
        <section className="page-hero">
          <div className="container-custom" style={{ position: "relative" }}>
            <nav style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)" }}>
              <Link href="/" style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none" }}>Home</Link>
              <span style={{ margin: "0 8px", color: "rgba(255,255,255,0.4)" }}>/</span>
              <span style={{ color: "#F4C430" }}>Reviews</span>
            </nav>
            <h1 className="page-hero-title">Customer <span>Reviews</span></h1>
            <p style={{ color: "#7A5030", fontSize: "1rem", marginTop: 10 }}>What thousands of loyal customers say about us</p>
          </div>
        </section>

        {/* Rating Summary */}
        <div style={{ background: "#120606", borderBottom: "1px solid #3d1a0a", padding: "40px 0" }}>
          <div className="container-custom">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 32, alignItems: "center" }}>
              <div className="text-center">
                <div style={{ fontFamily: "var(--font-playfair)", fontSize: "5rem", fontWeight: 900, color: "#F4C430", lineHeight: 1 }}>{RATING_SUMMARY.overall}</div>
                <div style={{ color: "#F4C430", fontSize: "1.3rem", margin: "6px 0" }}>{RATING_SUMMARY.stars}</div>
                <div style={{ color: "#b5a090", fontSize: "0.82rem" }}>Overall Rating</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {RATING_SUMMARY.breakdown.map((item) => (
                    <div key={item.stars} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ color: "#b5a090", fontSize: "0.82rem", width: 40 }}>{item.stars} ⭐</span>
                      <div style={{ flex: 1, height: 8, background: "#1e0e0e", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${item.percentage}%`,
                          background: item.percentage > 15
                            ? "linear-gradient(90deg, #7A0C0C, #F4C430)"
                            : "#3d1a0a",
                          borderRadius: 4,
                        }}></div>
                      </div>
                      <span style={{ color: "#7A5030", fontSize: "0.8rem", width: 30 }}>{item.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Testimonials Grid */}
        <section className="testimonials-section">
          <div className="container-custom">
            <div className="text-center" style={{ marginBottom: 48 }}>
              <div className="section-badge">Testimonials</div>
              <h2 className="section-title" style={{ marginTop: 8 }}>Voices of Our <span>Community</span></h2>
              <div className="section-divider"></div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
              {TESTIMONIALS.map((t, idx) => (
                <div key={idx} className="testi-card" data-index={idx}>
                  <div className="testi-text">&ldquo;{t.text}&rdquo;</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      className="testi-avatar"
                      style={t.avatarBg ? { background: t.avatarBg } : undefined}
                    >
                      {t.avatarLetter}
                    </div>
                    <div>
                      <div className="testi-name">{t.name}</div>
                      <div className="testi-loc"><i className="fas fa-map-marker-alt" style={{ marginRight: 4 }}></i>{t.location}</div>
                      <div className="star-sm" style={{ marginTop: 4 }}>{"⭐".repeat(t.stars)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Share Your Experience */}
            <div className="text-center" style={{ marginTop: 60 }}>
              <div style={{ background: "#FFFFFF", border: "1.5px solid #E8C98A", borderRadius: 12, padding: 40, maxWidth: 600, margin: "0 auto" }}>
                <div style={{ fontSize: "2rem", marginBottom: 12 }}>⭐</div>
                <h4 style={{ fontFamily: "var(--font-playfair)", color: "#7A0C0C", marginBottom: 12 }}>Share Your Experience</h4>
                <p style={{ color: "#7A5030", fontSize: "0.9rem", marginBottom: 24 }}>Loved your meal? Tell the world about your handi experience.</p>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
                  <a
                    href={SITE_CONFIG.zomatoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-hero-primary"
                    style={{ fontSize: "0.85rem", padding: "10px 22px" }}
                  >
                    <i className="fas fa-star" style={{ marginRight: 4 }}></i> Rate on Zomato
                  </a>
                  <a
                    href={SITE_CONFIG.googleSearchLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-hero-primary"
                    style={{ fontSize: "0.85rem", padding: "10px 22px" }}
                  >
                    <i className="fab fa-google" style={{ marginRight: 4 }}></i> Rate on Google
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <CTABanner />
      </main>
      <Footer />
      <FloatingButtons />
      <HungerPopup />
    </>
  );
}
