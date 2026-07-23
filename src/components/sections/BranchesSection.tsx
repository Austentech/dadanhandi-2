import { BRANCHES } from "@/constants/content";

export default function BranchesSection() {
  return (
    <section className="branches-section">
      <div className="container-custom">
        <div className="text-center reveal">
          <div className="section-badge">Our Locations</div>
          <h2 className="section-title" style={{ marginTop: 8 }}>Visit Our <span>Branches</span></h2>
          <div className="section-divider"></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, marginTop: 48 }}>
          {BRANCHES.map((branch, idx) => (
            <div key={idx} className={`branch-card reveal reveal-delay-${(idx % 2) + 1}${branch.comingSoon ? " coming-soon" : ""}`}>
              {branch.comingSoon ? (
                <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--section-deep)" }}>
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: "2rem" }}>🏗️</span>
                    <div style={{ color: "#C46A2E", fontWeight: 700, fontSize: "0.85rem", marginTop: 8 }}>Coming Soon</div>
                  </div>
                </div>
              ) : (
                <div className="branch-map">
                  <iframe
                    src={branch.mapEmbed}
                    title={branch.name}
                    loading="lazy"
                    allowFullScreen
                  ></iframe>
                </div>
              )}
              <div className="branch-info">
                <div className="branch-num">Branch {idx + 1}</div>
                <h5>{branch.name}</h5>
                <address>{branch.address}</address>
                {branch.comingSoon ? (
                  <span className="coming-soon-badge">Coming Soon</span>
                ) : (
                  <a
                    href={branch.mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-sm-red"
                  >
                    <i className="fas fa-directions"></i> Open in Maps
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
