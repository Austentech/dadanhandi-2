import { HOME_DISH_CARDS } from "@/constants/content";

export default function MenuHighlightSection() {
  return (
    <section className="menu-section">
      <div className="container-custom">
        <div className="text-center reveal">
          <div className="section-badge">Our Specialties</div>
          <h2 className="section-title" style={{ marginTop: 8 }}>Popular <span>Dishes</span></h2>
          <div className="section-divider"></div>
          <p className="section-desc">Authentic Bihar non-veg handi dishes, slow-cooked to perfection.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24, marginTop: 48 }}>
          {HOME_DISH_CARDS.map((dish, idx) => (
            <div key={idx} className="dish-card reveal reveal-delay-(idx % 2) + 1">
              <div className="dish-img-wrap">
                <img src={dish.image} alt={dish.name} loading="lazy" />
                <span className="dish-badge">{dish.badge}</span>
              </div>
              <div className="dish-info">
                <h5>{dish.name}</h5>
                <p>{dish.description}</p>
                <span className="dish-price">{dish.price}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
