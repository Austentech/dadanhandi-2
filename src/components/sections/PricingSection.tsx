export default function PricingSection() {
  return (
    <section className="pricing-section">
      <div className="container-custom">
        <div className="reveal">
          <div className="section-badge" style={{ marginBottom: 24 }}>Pricing</div>
          <h2 className="section-title" style={{ color: "#fff" }}>
            Handi Mutton <span style={{ color: "#F4C430" }}>Rate</span>
          </h2>
          <div className="section-divider"></div>
          <div style={{ marginTop: 40 }}>
            <div className="price-badge">₹1100/kg</div>
            <p style={{ color: "rgba(255,255,255,0.6)", marginTop: 20, fontSize: "0.95rem" }}>
              Traditional clay handi mutton, slow-cooked with whole spices
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
