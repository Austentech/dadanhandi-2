import { WHY_CHOOSE_FEATURES } from "@/constants/content";

export default function WhyChooseSection() {
  return (
    <section className="why-section">
      <div className="container-custom">
        <div className="text-center" style={{ marginBottom: 56 }}>
          <div className="section-badge">Why We&apos;re Different</div>
          <h2 className="section-title" style={{ marginTop: 8 }}>Bihar&apos;s True <span>Handi Experience</span></h2>
          <div className="section-divider"></div>
          <p className="section-desc">Slow-cooked in traditional clay handis over wood fire – the way it&apos;s always been done.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 24, marginTop: 16 }}>
          {WHY_CHOOSE_FEATURES.map((feature, idx) => (
            <div key={idx} className={`feature-card reveal reveal-delay-${(idx % 2) + 1}`}>
              <span className="feature-icon">{feature.icon}</span>
              <h4>{feature.title}</h4>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
