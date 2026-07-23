import { BRANCHES } from "@/constants/content";

export default function BranchesSection() {
  return (
    <section className="branches-section">
      <div className="container-custom">
        <div className="text-center" style={{ marginBottom: 48 }}>
          <div className="section-badge">Our Locations</div>
          <h2 className="section-title" style={{ marginTop: 8 }}>Find Us <span>Near You</span></h2>
          <div className="section-divider"></div>
          <p className="section-desc">4 branches serving authentic handi mutton across Patna region.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          {BRANCHES.map((branch, idx) => (
            <div key={idx} className="branch-card reveal reveal-delay-(idx % 2) + 1">
              <div className="branch-map">
                <iframe
                  src={branch.mapEmbed}
                  title={branch.name}
                  loading="lazy"
                  allowFullScreen
                ></iframe>
              </div>
              <div className="branch-info">
                <div className="branch-num">Branch {String(idx + 1).padStart(2, "0")}{idx === 0 ? " · Main" : ""}</div>
                <h5>{branch.name}</h5>
                <address>{branch.address}</address>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a
                    href={branch.mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-sm-red"
                  >
                    <i className="fas fa-map-marker-alt"></i> View Map
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
