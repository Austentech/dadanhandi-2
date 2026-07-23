"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { HOME_REVIEWS, RATING_SUMMARY } from "@/constants/content";

export default function ReviewsSection() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const next = useCallback(() => setCurrent((p) => (p + 1) % HOME_REVIEWS.length), []);
  const prev = useCallback(() => setCurrent((p) => (p - 1 + HOME_REVIEWS.length) % HOME_REVIEWS.length), []);

  useEffect(() => {
    if (!paused) {
      timerRef.current = setInterval(next, 5000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, next]);

  const review = HOME_REVIEWS[current];

  return (
    <section className="ratings-section">
      <div className="container-custom">
        <div className="text-center" style={{ marginBottom: 48 }}>
          <div className="section-badge">Customer Reviews</div>
          <h2 className="section-title" style={{ marginTop: 8 }}>What People <span>Are Saying</span></h2>
          <div className="section-divider"></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 32, alignItems: "center" }}>
          {/* Rating Summary - Left */}
          <div className="text-center reveal">
            <div className="rating-big">{RATING_SUMMARY.overall}</div>
            <div className="star-display" style={{ color: "#C46A2E", fontSize: "1.5rem", margin: "8px 0" }}>
              {RATING_SUMMARY.stars}
            </div>
            <p style={{ color: "#7A5030", fontSize: "0.82rem" }}>{RATING_SUMMARY.subtitle}</p>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <a href="#" target="_blank" rel="noopener noreferrer" style={{
                color: "#7A0C0C", fontSize: "0.82rem", textDecoration: "none", fontWeight: 600,
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>
                <i className="fas fa-external-link-alt"></i> Rate on Google
              </a>
              <b style={{ color: "#7A5030", fontSize: "0.82rem" }}>   |   </b>
              <a href="#" target="_blank" rel="noopener noreferrer" style={{
                color: "#7A0C0C", fontSize: "0.82rem", textDecoration: "none", fontWeight: 600,
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>
                <i className="fas fa-external-link-alt"></i> Rate on Zomato
              </a>
            </div>
          </div>

          {/* Review Cards - Right */}
          <div
            style={{ position: "relative" }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {HOME_REVIEWS.map((r, idx) => (
              <div key={idx} className={`review-card${idx === current ? " active" : ""}`}>
                <p className="review-text">&ldquo;{r.text}&rdquo;</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div className="reviewer-name">{r.name}</div>
                    <div className="reviewer-location">
                      <i className="fas fa-map-marker-alt" style={{ marginRight: 4 }}></i>{r.location}
                    </div>
                  </div>
                  <div className="star-display" style={{ color: "#C46A2E" }}>
                    {"⭐".repeat(r.stars)}
                  </div>
                </div>
              </div>
            ))}

            <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "center" }}>
              <button onClick={prev} className="btn-sm-red" aria-label="Previous review">
                <i className="fas fa-arrow-left"></i> Prev
              </button>
              <button onClick={next} className="btn-sm-red" aria-label="Next review">
                Next <i className="fas fa-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
