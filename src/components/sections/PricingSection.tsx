export default function PricingSection() {
  return (
    <section className="pricing-section">
      <div className="container-custom" style={{ position: "relative" }}>
        <div className="section-badge" style={{ marginBottom: 12 }}>Affordable Pricing</div>
        <h2 className="section-title" style={{ color: "#fff", marginBottom: 16 }}>
          Budget-Friendly <span>Royal Feast</span>
        </h2>
        <div className="price-badge">
          <span> Starting From </span>₹ 300<sup>*</sup> <span> per person</span>
        </div>
      </div>
    </section>
  );
}
