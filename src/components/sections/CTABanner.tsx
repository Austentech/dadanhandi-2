import Link from "next/link";
import { SITE_CONFIG } from "@/constants/site";

export default function CTABanner() {
  return (
    <section className="cta-banner">
      <div className="container-custom" style={{ position: "relative" }}>
        <div className="cta-hindi">हमारे साथ खाना खाएं! 🫕</div>
        <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "1rem", marginBottom: 32 }}>
          Come taste the legacy. A handi that has been perfected over 39 years awaits you.
        </p>
        <div className="cta-btns-wrap" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14 }}>
          <Link href="/menu" className="btn-hero-primary">
            <i className="fas fa-book-open"></i> View Our Menu
          </Link>
          <Link href="/contact" className="btn-hero-secondary" style={{ borderColor: "#fff", color: "#fff" }}>
            <i className="fas fa-map-marker-alt"></i> Find Us
          </Link>
        </div>
      </div>
    </section>
  );
}
