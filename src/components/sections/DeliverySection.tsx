import Link from "next/link";
import { SITE_CONFIG } from "@/constants/site";

export default function DeliverySection() {
  return (
    <section className="delivery-section">
      <div className="container-custom">
        <div className="text-center reveal">
          <div className="section-badge">Order Online</div>
          <h2 className="section-title" style={{ marginTop: 8 }}>Get It <span>Delivered</span></h2>
          <div className="section-divider"></div>
          <p className="section-desc" style={{ marginBottom: 40 }}>
            Order authentic handi mutton on your favourite delivery app.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 24 }}>
          <a href={SITE_CONFIG.zomatoLink} target="_blank" rel="noopener noreferrer" className="delivery-logo reveal">
            <span className="delivery-logo-text zomato-red">Zomato</span>
          </a>
          <a href={SITE_CONFIG.swiggyLink} target="_blank" rel="noopener noreferrer" className="delivery-logo reveal">
            <span className="delivery-logo-text swiggy-orange">Swiggy</span>
          </a>
        </div>
      </div>
    </section>
  );
}
