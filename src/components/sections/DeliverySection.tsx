import Link from "next/link";
import { SITE_CONFIG } from "@/constants/site";

export default function DeliverySection() {
  return (
    <section className="delivery-section">
      <div className="container-custom">
        <div className="text-center reveal">
          <div className="section-badge" style={{ marginBottom: 12 }}>Order Online</div>
          <h2 className="section-title" style={{ marginBottom: 8 }}>Delivered to <span>Your Door</span></h2>
          <p className="section-desc" style={{ marginBottom: 40 }}>
            Order our authentic handi mutton from the comfort of your home.
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <a href={SITE_CONFIG.zomatoLink} target="_blank" rel="noopener noreferrer" className="delivery-logo reveal">
            <div className="delivery-logo-text zomato-red">zomato</div>
            <div style={{ color: "#b5a090", fontSize: "0.72rem", textAlign: "center" }}>ORDER NOW →</div>
          </a>
          <a href={SITE_CONFIG.swiggyLink} target="_blank" rel="noopener noreferrer" className="delivery-logo reveal">
            <div className="delivery-logo-text swiggy-orange">swiggy</div>
            <div style={{ color: "#b5a090", fontSize: "0.72rem", textAlign: "center" }}>ORDER NOW →</div>
          </a>
        </div>
      </div>
    </section>
  );
}
