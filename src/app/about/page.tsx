import { type Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PageLoader from "@/components/ui-custom/PageLoader";
import FloatingButtons from "@/components/ui-custom/FloatingButtons";
import ScrollReveal from "@/components/ui-custom/ScrollReveal";
import HungerPopup from "@/components/ui-custom/HungerPopup";
import { ABOUT_STATS, TIMELINE, WHY_CHOOSE_FEATURES } from "@/constants/content";
import CTABanner from "@/components/sections/CTABanner";

export const metadata: Metadata = {
  title: "About Us – Dadan Handi Mutton Hotel | Bihar's Legacy Since 1985",
  description: "Learn the story of Dadan Handi Mutton Hotel – founded in 1985 by Army Man Ram Sakal Singh. A legacy of authentic Bihar handi mutton spanning three generations.",
};

export default function AboutPage() {
  return (
    <>
      <PageLoader />
      <Navbar />
      <ScrollReveal />
      <main>
        {/* Page Hero */}
        <section className="page-hero">
          <div className="container-custom" style={{ position: "relative" }}>
            <nav style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)" }}>
              <Link href="/" style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none" }}>Home</Link>
              <span style={{ margin: "0 8px", color: "rgba(255,255,255,0.4)" }}>/</span>
              <span style={{ color: "#F4C430" }}>About Us</span>
            </nav>
            <h1 className="page-hero-title">Our <span>Story</span></h1>
            <p style={{ color: "#7A5030", fontSize: "1rem", marginTop: 10 }}>A legacy built on fire, spice, and honour since 1985</p>
          </div>
        </section>

        {/* About Story */}
        <section className="about-section">
          <div className="container-custom">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 48, alignItems: "center" }}>
              <div className="reveal">
                <div className="section-badge">Our Heritage</div>
                <h2 className="section-title" style={{ marginTop: 8 }}>Bihar&apos;s <span>Authentic</span><br />Handi Legacy</h2>
                <div className="section-divider" style={{ margin: "0 0 16px" }}></div>
                <p style={{ color: "#b5a090", lineHeight: 1.9, fontSize: "0.98rem", marginBottom: 20 }}>
                  Experience the authentic taste of handi mutton, slow-cooked with traditional spices that preserve the rich culinary heritage of Bihar. Every dish at Dadan Handi Mutton Hotel tells a story — a story of honour, resilience, and an unwavering love for real food.
                </p>
                <p style={{ color: "#b5a090", lineHeight: 1.9, fontSize: "0.98rem", marginBottom: 20 }}>
                  What began as a small roadside eatery in 1985 by a retired Army man has grown into one of Patna&apos;s most trusted non-vegetarian restaurants. We don&apos;t follow trends — we cook the way our forefathers cooked, in clay handis over slow flame, with whole spices and pure mustard oil.
                </p>
                <p style={{ color: "#b5a090", lineHeight: 1.9, fontSize: "0.98rem" }}>
                  Three generations of family. Nearly four decades of flavour. Over ten thousand loyal customers. This is not just a restaurant — it&apos;s a tradition.
                </p>
                <div style={{ display: "flex", gap: 32, marginTop: 24, flexWrap: "wrap" }}>
                  {ABOUT_STATS.map((stat) => (
                    <div key={stat.label} style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: "var(--font-playfair)", fontSize: "2.2rem", fontWeight: 900, color: "#F4C430" }}>{stat.value}</div>
                      <div style={{ fontSize: "0.75rem", color: "#b5a090", letterSpacing: 2, textTransform: "uppercase" }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="reveal">
                <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", border: "2px solid #3d1a0a" }}>
                  <img
                    src="https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=700&q=80&fm=webp"
                    alt="Authentic Bihar handi mutton cooking"
                    style={{ width: "100%", height: 400, objectFit: "cover", display: "block" }}
                    loading="lazy"
                  />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 50%, rgba(10,3,3,0.8))" }}></div>
                  <div style={{ position: "absolute", bottom: 24, left: 24 }}>
                    <div style={{ fontFamily: "var(--font-tiro)", fontSize: "1.2rem", color: "#F4C430", fontWeight: 700 }}>
                      शेर दिल वाले ही मटन खाते हैं!<br />
                      शेर कभी घास नहीं खाता हैं!
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Founder */}
            <div style={{ paddingTop: 60 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 48, alignItems: "start" }}>
                <div className="text-center reveal">
                  <div className="founder-img-wrap">👨‍🍳</div>
                  <h3 style={{ fontFamily: "var(--font-playfair)", color: "#F4C430", fontSize: "1.6rem", marginBottom: 6 }}><b>Alok Singh</b></h3>
                  <div style={{ color: "#C46A2E", fontSize: "0.85rem", letterSpacing: 2, textTransform: "uppercase" }}>Founder</div>
                  <span style={{ color: "#C46A2E", fontSize: "0.85rem", letterSpacing: 2 }}>(Handi Mutton Expert)</span>
                  <p style={{ color: "#7A5030", fontSize: "0.88rem", lineHeight: 1.8 }}>
                    Son of the legendary Dadan Singh, Alok has taken the family legacy forward — expanding from 1 outlet to 4 branches across Patna with passion and commitment to authentic Bihari flavours.
                  </p>
                </div>
                <div>
                  <div className="section-badge">Our Values</div>
                  <h2 className="section-title" style={{ marginTop: 8 }}>What We <span>Stand For</span></h2>
                  <div className="section-divider" style={{ margin: "0 0 16px" }}></div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                    {WHY_CHOOSE_FEATURES.map((f, idx) => (
                      <div key={idx} className="feature-card reveal" style={{ padding: 24 }}>
                        <span className="feature-icon" style={{ fontSize: "2rem" }}>{f.icon}</span>
                        <h4 style={{ fontSize: "1rem" }}>{f.title}</h4>
                        <p style={{ fontSize: "0.82rem" }}>{f.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="section-sep"></div>

        {/* Timeline */}
        <section style={{ padding: "90px 0", background: "#FFF8EE" }}>
          <div className="container-custom">
            <div className="text-center reveal" style={{ marginBottom: 48 }}>
              <div className="section-badge">Our Journey</div>
              <h2 className="section-title" style={{ marginTop: 8 }}>A Legacy of <span>Three Generations</span></h2>
              <div className="section-divider"></div>
            </div>
            <div className="timeline">
              {TIMELINE.map((entry, idx) => (
                <div key={idx} className="timeline-item reveal">
                  <div className="timeline-dot"></div>
                  <div className="timeline-content">
                    <div className="timeline-year">{entry.year}</div>
                    <h5>
                      {entry.name} <span style={{ color: "#C46A2E", fontSize: "0.8rem" }}>({entry.role})</span>
                    </h5>
                    <p>{entry.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="section-sep"></div>
        <CTABanner />
      </main>
      <Footer />
      <FloatingButtons />
      <HungerPopup />
    </>
  );
}
