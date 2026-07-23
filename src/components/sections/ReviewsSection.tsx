"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { HOME_REVIEWS } from "@/constants/content";

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
        <div className="text-center reveal">
          <div className="section-badge">Testimonials</div>
          <h2 className="section-title" style={{ marginTop: 8 }}>What Customers <span>Say</span></h2>
          <div className="section-divider"></div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 48 }}>
          <div className="rating-big reveal">3.7</div>
          <div style={{ color: "#C46A2E", fontSize: "1.3rem", margin: "8px 0" }}>⭐⭐⭐⭐</div>
          <div style={{ color: "#7A5030", fontSize: "0.82rem" }}>Overall Rating</div>
        </div>

        <div
          style={{ maxWidth: 700, margin: "48px auto 0", position: "relative" }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {HOME_REVIEWS.map((r, idx) => (
            <div key={idx} className={`review-card${idx === current ? " active" : ""}`}>
              <p className="review-text">&ldquo;{r.text}&rdquo;</p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div>
                  <div className="reviewer-name">{r.name}</div>
                  <div className="reviewer-location"><i className="fas fa-map-marker-alt" style={{ marginRight: 4 }}></i>{r.location}</div>
                  <div style={{ color: "#C46A2E", fontSize: "0.8rem", marginTop: 4 }}>
                    {"⭐".repeat(r.stars)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 24 }}>
            <button
              onClick={prev}
              style={{
                background: "var(--dark-red)", color: "var(--mustard)", border: "none",
                padding: "8px 18px", borderRadius: 4, fontWeight: 700, cursor: "pointer", fontSize: "0.82rem",
              }}
              aria-label="Previous review"
            >
              <i className="fas fa-arrow-left"></i>
            </button>
            <button
              id="nextReview"
              onClick={next}
              style={{
                background: "var(--dark-red)", color: "var(--mustard)", border: "none",
                padding: "8px 18px", borderRadius: 4, fontWeight: 700, cursor: "pointer", fontSize: "0.82rem",
              }}
              aria-label="Next review"
            >
              <i className="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
