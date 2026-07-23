import { type Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PageLoader from "@/components/ui-custom/PageLoader";
import FloatingButtons from "@/components/ui-custom/FloatingButtons";
import ScrollReveal from "@/components/ui-custom/ScrollReveal";
import HungerPopup from "@/components/ui-custom/HungerPopup";
import { SITE_CONFIG } from "@/constants/site";

export const metadata: Metadata = {
  title: "Blog – Dadan Handi Mutton Hotel | Bihar Food Stories & Recipes",
  description: "Read the Dadan Handi blog – stories about traditional handi cooking, Bihar food culture, and authentic recipes passed down through generations.",
};

export default function BlogPage() {
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
              <span style={{ color: "#F4C430" }}>Blog</span>
            </nav>
            <h1 className="page-hero-title">Food <span>Stories</span></h1>
            <p style={{ color: "#7A5030", fontSize: "1rem", marginTop: 10 }}>Tales from the handi – Bihar&apos;s rich culinary heritage</p>
          </div>
        </section>

        <section className="blog-section">
          <div className="container-custom">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 40 }}>
              {/* Featured Blog Post */}
              <div style={{ gridColumn: "span 1" }}>
                <div className="blog-card reveal">
                  <div className="blog-card-img-wrap">
                    <img
                      src="https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=900&q=80&fm=webp"
                      alt="Why Handi Mutton is Special"
                      className="blog-card-img"
                      loading="lazy"
                    />
                  </div>
                  <div className="blog-card-body">
                    <div className="blog-meta">
                      <span className="blog-cat-tag">Featured</span>
                      <span><i className="far fa-calendar-alt"></i> January 15, 2025</span>
                      <span><i className="far fa-clock"></i> 5 min read</span>
                      <span><i className="fas fa-tag"></i> Traditional Cooking</span>
                    </div>
                    <h2 className="blog-card-title">Why Handi Mutton is Special: The Science &amp; Soul of Slow Cooking</h2>
                    <p>
                      In a world of pressure cookers and instant everything, handi mutton stands as a proud rebel — slow, deliberate, and deeply rewarding. The magic of handi cooking lies not just in the recipe, but in the vessel itself. A traditional clay handi is porous, allowing gentle moisture to circulate during the long cooking process, keeping the meat tender and infusing every fibre with the earthy warmth of the clay.
                    </p>
                    <p>
                      At Dadan Handi Mutton Hotel, we have been honouring this ancient cooking method since 1985. The whole spices — black cardamom, cloves, bay leaves, cinnamon — are never ground; they bloom gently in hot mustard oil before the mutton is added.
                    </p>
                    <p>
                      Bihar&apos;s food culture has always placed patience at the centre of great cooking. Our founders — Army men who valued discipline above all — brought that patience to the kitchen.
                    </p>
                    <p style={{ fontStyle: "italic", color: "#C46A2E", borderLeft: "3px solid #C46A2E", paddingLeft: 16, margin: "24px 0" }}>
                      &ldquo;You cannot rush great food, just like you cannot rush a great life.&rdquo; – Dadan Singh (1993–2012)
                    </p>
                    <p>
                      The next time someone offers you a quick mutton dish, remember: real handi takes time. Real handi has soul.
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: "50%",
                          background: "linear-gradient(135deg,#7A0C0C,#C46A2E)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 700, color: "#fff",
                        }}>A</div>
                        <div>
                          <div style={{ color: "#2C1008", fontSize: "0.85rem", fontWeight: 700 }}>Alok Singh</div>
                          <div style={{ color: "#C46A2E", fontSize: "0.72rem" }}>Owner, Dadan Handi Mutton Hotel</div>
                        </div>
                      </div>
                      <a href="/menu" className="btn-order-now" style={{ borderRadius: 6, padding: "10px 20px", fontSize: "0.85rem" }}>
                        <i className="fas fa-utensils"></i> Try Our Mutton
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div>
                <div className="reveal" style={{
                  background: "linear-gradient(135deg, #1b7a3d, #15622f)",
                  borderRadius: 14, padding: 28, textAlign: "center", marginBottom: 28,
                }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🫕</div>
                  <h5 style={{ fontFamily: "var(--font-playfair)", color: "#fff", marginBottom: 10 }}>Hungry Already?</h5>
                  <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.85rem", marginBottom: 18 }}>Order authentic handi mutton directly on WhatsApp!</p>
                  <a
                    href={SITE_CONFIG.whatsappOrderLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: "#fff", color: "#1b7a3d", padding: "10px 24px", borderRadius: 20,
                      fontWeight: 700, fontSize: "0.88rem", textDecoration: "none", display: "inline-block",
                    }}
                  >
                    <i className="fab fa-whatsapp" style={{ marginRight: 4 }}></i> WhatsApp Order
                  </a>
                </div>

                <div className="reveal" style={{
                  background: "#FFFFFF", border: "1.5px solid #E8C98A", borderRadius: 14, padding: 24, marginBottom: 28,
                }}>
                  <h6 style={{ fontFamily: "var(--font-playfair)", color: "#7A0C0C", marginBottom: 14 }}>About the Restaurant</h6>
                  <p style={{ color: "#7A5030", fontSize: "0.85rem", lineHeight: 1.8 }}>
                    Dadan Handi Mutton Hotel has been serving authentic Bihar non-veg food since 1985. Founded by retired Army man Ram Sakal Singh, our 39-year legacy lives on across 4 branches in Patna.
                  </p>
                  <Link href="/about" className="btn-read-more" style={{ display: "inline-flex", marginTop: 12 }}>
                    Our Story <i className="fas fa-arrow-right"></i>
                  </Link>
                </div>

                <div className="reveal" style={{
                  background: "#FFFFFF", border: "1.5px solid #E8C98A", borderRadius: 14, padding: 24,
                }}>
                  <h6 style={{ fontFamily: "var(--font-playfair)", color: "#7A0C0C", marginBottom: 14 }}>Tags</h6>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {["Handi Cooking", "Bihar Food", "Mutton", "Traditional Recipes", "Patna", "Non-Veg"].map((tag) => (
                      <span key={tag} style={{
                        background: "rgba(196,106,46,0.12)", color: "#C46A2E",
                        border: "1px solid #C46A2E", fontSize: "0.72rem",
                        padding: "3px 12px", borderRadius: 20,
                      }}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Coming Soon */}
            <div className="text-center reveal" style={{ marginTop: 48 }}>
              <div style={{ background: "#FFF8EE", border: "1.5px dashed #E8C98A", borderRadius: 12, padding: 40, maxWidth: 500, margin: "0 auto" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>✍️</div>
                <h5 style={{ fontFamily: "var(--font-playfair)", color: "#7A0C0C", marginBottom: 10 }}>More Stories Coming Soon</h5>
                <p style={{ color: "#7A5030", fontSize: "0.88rem", margin: 0 }}>We&apos;re writing more stories about Bihar&apos;s culinary heritage. Stay tuned!</p>
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
