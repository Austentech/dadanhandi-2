"use client";

import { useState, useEffect } from "react";

export default function PageLoader() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const handleLoad = () => {
      setFading(true);
      setTimeout(() => setVisible(false), 400);
    };

    if (document.readyState === "complete") {
      handleLoad();
    } else {
      window.addEventListener("load", handleLoad);
      return () => window.removeEventListener("load", handleLoad);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className={`page-loader${fading ? " fade-out" : ""}`}>
      <div className="loader-icon">🫕</div>
      <div className="loader-bar-wrap">
        <div className="loader-bar"></div>
      </div>
      <div className="loader-text">हांडी तैयार हो रही है...</div>
    </div>
  );
}
