import Link from "next/link";
import { SITE_CONFIG } from "@/constants/site";

export default function CTABanner() {
  return (
    <section className="cta-banner">
      <div className="container-custom" style={{ position: "relative" }}>
        <div className="cta-hindi">भूख लगी है? अभी ऑर्डर करें! 🍲</div>
        <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "1rem", marginBottom: 32 }}>
          Real hunger deserves real handi. Don&apos;t settle for less.
        </p>
        <div className="cta-btns-wrap" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14 }}>
          <a href={SITE_CONFIG.zomatoLink} target="_blank" rel="noopener noreferrer" className="btn-hero-primary">
            <i className="fas fa-motorcycle"></i> Order on Zomato
          </a>
          <a href={SITE_CONFIG.swiggyLink} target="_blank" rel="noopener noreferrer" className="btn-hero-primary">
            <i className="fas fa-motorcycle"></i> Order on Swiggy
          </a>
        </div>
      </div>
    </section>
  );
}
