"use client";

import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PageLoader from "@/components/ui-custom/PageLoader";
import FloatingButtons from "@/components/ui-custom/FloatingButtons";
import ScrollReveal from "@/components/ui-custom/ScrollReveal";
import HungerPopup from "@/components/ui-custom/HungerPopup";
import { CAREER_PERKS, JOB_LISTINGS, SITE_CONFIG } from "@/constants/content";

export default function CareersPage() {
  const handleApply = (positionName: string) => {
    const url = `https://wa.me/${SITE_CONFIG.whatsapp}?text=${encodeURIComponent("Hi! I want to apply for: " + positionName + " at Dadan Handi Mutton Hotel.")}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

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
              <span style={{ color: "#F4C430" }}>Careers</span>
            </nav>
            <h1 className="page-hero-title">Join Our <span>Team</span></h1>
            <p style={{ color: "#7A5030", fontSize: "1rem", marginTop: 10 }}>Be part of Bihar&apos;s most beloved handi restaurant family</p>
          </div>
        </section>

        <section className="career-section">
          <div className="container-custom">
            {/* Why Join */}
            <div style={{ marginBottom: 48 }}>
              <div className="text-center reveal">
                <div className="section-badge">Why Join Us</div>
                <h2 className="section-title" style={{ marginTop: 8 }}>Work With <span>Pride</span></h2>
                <div className="section-divider"></div>
                <p className="section-desc">Join a team that has been feeding Bihar with pride, discipline, and love since 1985.</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24, marginTop: 32 }}>
                {CAREER_PERKS.map((perk, idx) => (
                  <div key={idx} className={`career-perks-card reveal reveal-delay-${(idx % 2) + 1}`}>
                    <span className="perk-icon">{perk.icon}</span>
                    <h6>{perk.title}</h6>
                    <p>{perk.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="section-sep" style={{ marginBottom: 48 }}></div>

            {/* Job Listings */}
            <div style={{ marginBottom: 48 }}>
              <div className="reveal">
                <div className="section-badge">Open Positions</div>
                <h2 className="section-title" style={{ marginTop: 8 }}>Current <span>Openings</span></h2>
                <div className="section-divider" style={{ margin: "0 0 16px" }}></div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
                {JOB_LISTINGS.map((job, idx) => (
                  <div key={idx} className={`job-card reveal reveal-delay-${(idx % 2) + 1}`}>
                    {job.status === "hiring" && (
                      <span className="job-badge">🟢 Hiring Now</span>
                    )}
                    {job.status === "coming-soon" && (
                      <span className="job-badge" style={{ background: "rgba(196,106,46,0.15)", color: "#C46A2E", borderColor: "#C46A2E" }}>🔶 Coming Soon</span>
                    )}
                    <h3 className="job-title">{job.title}</h3>
                    <div className="job-meta">
                      <span><i className="fas fa-map-marker-alt"></i> {job.location}</span>
                      <span><i className="fas fa-clock"></i> {job.type}</span>
                      <span><i className="fas fa-rupee-sign"></i> {job.salary}</span>
                    </div>
                    <p className="job-desc">{job.description}</p>
                    <ul className="job-requirements">
                      {job.requirements.map((req, rIdx) => (
                        <li key={rIdx}>{req}</li>
                      ))}
                    </ul>
                    {job.status === "hiring" ? (
                      <button className="btn-apply" onClick={() => handleApply(job.positionName)}>
                        <i className="fab fa-whatsapp"></i> Apply Now on WhatsApp
                      </button>
                    ) : (
                      <button className="btn-apply" disabled style={{ opacity: 0.5, cursor: "not-allowed" }} onClick={() => handleApply(job.positionName)}>
                        <i className="fas fa-hourglass-half"></i> Opening Soon
                      </button>
                    )}
                  </div>
                ))}

                {/* Open Application */}
                <div className="job-card reveal" style={{
                  borderStyle: "dashed", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: 280,
                }}>
                  <div style={{ fontSize: "3rem", marginBottom: 16 }}>🤝</div>
                  <h3 className="job-title" style={{ fontSize: "1.3rem" }}>Don&apos;t See a Role That Fits?</h3>
                  <p className="job-desc" style={{ maxWidth: 320 }}>
                    Send us your name, skills and why you&apos;d like to join the Dadan family. We&apos;re always open to talented people.
                  </p>
                  <button className="btn-apply" onClick={() => handleApply("General Application")}>
                    <i className="fab fa-whatsapp"></i> Send Open Application
                  </button>
                </div>
              </div>
            </div>

            <div className="section-sep" style={{ marginBottom: 48 }}></div>

            {/* 3-Step Process */}
            <div className="reveal">
              <div className="text-center" style={{ marginBottom: 32 }}>
                <div className="section-badge">How to Apply</div>
                <h2 className="section-title" style={{ marginTop: 8 }}>Simple <span>3-Step</span> Process</h2>
                <div className="section-divider"></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24 }}>
                {[
                  { num: "1", title: "Click Apply Now", desc: "Hit the Apply Now button on your desired position above." },
                  { num: "2", title: "Chat on WhatsApp", desc: "You'll be connected to us on WhatsApp. Tell us about yourself." },
                  { num: "3", title: "Join the Family", desc: "We'll call you in for a quick meeting and get you started!" },
                ].map((step) => (
                  <div key={step.num} className="text-center reveal">
                    <div style={{
                      width: 64, height: 64, borderRadius: "50%",
                      background: "linear-gradient(135deg,#7A0C0C,#C46A2E)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "var(--font-playfair)", fontSize: "1.5rem", fontWeight: 900, color: "#fff",
                      margin: "0 auto 16px",
                    }}>
                      {step.num}
                    </div>
                    <h5 style={{ fontFamily: "var(--font-playfair)", color: "#fff", marginBottom: 8 }}>{step.title}</h5>
                    <p style={{ color: "#7A5030", fontSize: "0.85rem" }}>{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <FloatingButtons />
      <HungerPopup />
    </>
  );
}
