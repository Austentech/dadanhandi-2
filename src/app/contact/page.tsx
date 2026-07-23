"use client";

import { useState, type FormEvent } from "react";
import { type Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PageLoader from "@/components/ui-custom/PageLoader";
import FloatingButtons from "@/components/ui-custom/FloatingButtons";
import ScrollReveal from "@/components/ui-custom/ScrollReveal";
import HungerPopup from "@/components/ui-custom/HungerPopup";
import CTABanner from "@/components/sections/CTABanner";
import { SITE_CONFIG } from "@/constants/site";

export const metadata: Metadata = {
  title: "Contact Us – Dadan Handi Mutton Hotel | Danapur, Patna Bihar",
  description: "Contact Dadan Handi Mutton Hotel. Call us at 8986496574, WhatsApp order, or visit us at Saguna Khagaul Road, Kaliket Nagar, Danapur, Patna, Bihar 801105.",
};

export default function ContactPage() {
  const [formMsg, setFormMsg] = useState("");
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const newErrors: Record<string, boolean> = {};
    let valid = true;

    const name = (form.querySelector("#fname") as HTMLInputElement).value.trim();
    const phone = (form.querySelector("#phone") as HTMLInputElement).value.trim();
    const subject = (form.querySelector("#subject") as HTMLSelectElement).value;
    const message = (form.querySelector("#message") as HTMLTextAreaElement).value.trim();

    if (!name) { newErrors.fname = true; valid = false; }
    if (!phone || !/^[6-9]\d{9}$/.test(phone)) { newErrors.phone = true; valid = false; }
    if (!subject) { newErrors.subject = true; valid = false; }
    if (!message) { newErrors.message = true; valid = false; }

    setErrors(newErrors);

    if (valid) {
      setFormMsg(
        '<div style="background:rgba(37,168,78,0.1);border:1px solid #25a84e;color:#25a84e;padding:12px;border-radius:6px;margin-top:16px;">✅ Thank you! We\'ll call you shortly. Or reach us at <a href="tel:' + SITE_CONFIG.phone + '" style="color:#F4C430;">' + SITE_CONFIG.phone + '</a></div>'
      );
      form.reset();
    } else {
      setFormMsg(
        '<div style="background:rgba(122,12,12,0.2);border:1px solid #7A0C0C;color:#F4C430;padding:12px;border-radius:6px;margin-top:16px;">⚠️ Please fill all required fields correctly.</div>'
      );
    }
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
              <span style={{ color: "#F4C430" }}>Contact</span>
            </nav>
            <h1 className="page-hero-title">Get In <span>Touch</span></h1>
            <p style={{ color: "#7A5030", fontSize: "1rem", marginTop: 10 }}>We&apos;d love to hear from you. Call, WhatsApp, or visit us.</p>
          </div>
        </section>

        <section className="contact-section">
          <div className="container-custom">
            {/* Contact Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24, marginBottom: 48 }}>
              <div className="contact-card reveal">
                <span className="icon">📞</span>
                <h5>Call Us</h5>
                <p>Sun–Sat, 10 AM – 10 PM</p>
                <a href={`tel:${SITE_CONFIG.phone}`} style={{ color: "#F4C430", fontWeight: 700, fontSize: "1.05rem", textDecoration: "none" }}>
                  {SITE_CONFIG.phone}
                </a>
              </div>
              <div className="contact-card reveal">
                <span className="icon">💬</span>
                <h5>WhatsApp</h5>
                <p>Quick Chat via WhatsApp</p>
                <a href={SITE_CONFIG.whatsappOrderLink} target="_blank" rel="noopener noreferrer" style={{ color: "#25D366", fontWeight: 700, fontSize: "0.95rem", textDecoration: "none" }}>
                  <i className="fab fa-whatsapp" style={{ marginRight: 4 }}></i>Chat Now
                </a>
              </div>
              <div className="contact-card reveal">
                <span className="icon">📍</span>
                <h5>Main Branch</h5>
                <p>{SITE_CONFIG.address}</p>
              </div>
              <div className="contact-card reveal">
                <span className="icon">🕐</span>
                <h5>Opening Hours</h5>
                <p>Sun-Sat<br /><strong style={{ color: "#F4C430" }}>10:00 AM – 10:00 PM</strong></p>
              </div>
            </div>

            {/* Map + Form */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 48 }}>
              {/* Map */}
              <div>
                <div className="section-badge" style={{ marginBottom: 12 }}>Location</div>
                <h2 className="section-title" style={{ marginBottom: 24 }}>Find <span>Main Branch</span></h2>
                <div className="map-embed" style={{ marginBottom: 24 }}>
                  <iframe
                    src={SITE_CONFIG.googleMapsEmbed}
                    width="100%"
                    height={350}
                    title="Dadan Handi Mutton Hotel Location"
                    loading="lazy"
                    allowFullScreen
                  ></iframe>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <a
                    href={SITE_CONFIG.googleMapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-hero-primary"
                    style={{ fontSize: "0.85rem", padding: "10px 22px" }}
                  >
                    <i className="fas fa-map-marker-alt"></i> Open in Maps
                  </a>
                </div>

                {/* Delivery Links */}
                <div style={{ marginTop: 36, background: "#FFFFFF", border: "1.5px solid #E8C98A", borderRadius: 12, padding: 24 }}>
                  <h5 style={{ fontFamily: "var(--font-playfair)", color: "#7A0C0C", marginBottom: 16 }}>Order Online</h5>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <a href={SITE_CONFIG.zomatoLink} target="_blank" rel="noopener noreferrer" style={{
                      background: "#E23744", color: "#fff", padding: "10px 20px", borderRadius: 6,
                      textDecoration: "none", fontWeight: 700, fontSize: "0.88rem",
                    }}>
                      <i className="fas fa-motorcycle" style={{ marginRight: 4 }}></i> Zomato
                    </a>
                    <a href={SITE_CONFIG.swiggyLink} target="_blank" rel="noopener noreferrer" style={{
                      background: "#FF6A00", color: "#fff", padding: "10px 20px", borderRadius: 6,
                      textDecoration: "none", fontWeight: 700, fontSize: "0.88rem",
                    }}>
                      <i className="fas fa-motorcycle" style={{ marginRight: 4 }}></i> Swiggy
                    </a>
                  </div>
                </div>
              </div>

              {/* Contact Form */}
              <div>
                <div className="section-badge" style={{ marginBottom: 12 }}>Send a Message</div>
                <h2 className="section-title" style={{ marginBottom: 24 }}>Drop Us a <span>Message</span></h2>
                <form onSubmit={handleSubmit} noValidate>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                    <div>
                      <label className="form-label" htmlFor="fname">Full Name *</label>
                      <input type="text" className={`form-control${errors.fname ? " border-danger" : ""}`} id="fname" name="name" placeholder="Your Name" required />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="phone">Phone Number *</label>
                      <input type="tel" className={`form-control${errors.phone ? " border-danger" : ""}`} id="phone" name="phone" placeholder="10-digit mobile" required />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label className="form-label" htmlFor="email">Email Address</label>
                    <input type="email" className="form-control" id="email" name="email" placeholder="your@email.com" />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label className="form-label" htmlFor="subject">Subject *</label>
                    <select className="form-select" id="subject" name="subject" required>
                      <option value="">Select a subject</option>
                      <option>Pre-order / Bulk Order</option>
                      <option>Table Reservation</option>
                      <option>Feedback / Complaint</option>
                      <option>Partnership / Catering</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label className="form-label" htmlFor="message">Message *</label>
                    <textarea className="form-control" id="message" name="message" rows={5} placeholder="Write your message here..." required></textarea>
                  </div>
                  <button type="submit" className="btn-submit" style={{ width: "100%" }}>
                    <i className="fas fa-paper-plane" style={{ marginRight: 8 }}></i> Send Message
                  </button>
                  <div dangerouslySetInnerHTML={{ __html: formMsg }} />
                </form>
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
