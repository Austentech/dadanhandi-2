"use client";

import { useState, useEffect } from "react";
import { SITE_CONFIG } from "@/constants/site";

export default function FloatingButtons() {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <a
        href={SITE_CONFIG.whatsappOrderLink}
        target="_blank"
        rel="noopener noreferrer"
        className="floating-whatsapp"
        aria-label="WhatsApp Order"
      >
        <i className="fab fa-whatsapp"></i>
      </a>
      <a href={`tel:${SITE_CONFIG.phone}`} className="floating-call" aria-label="Call Now">
        <i className="fas fa-phone"></i>
      </a>
      <button
        className={`back-to-top-btn${showBackToTop ? " visible" : ""}`}
        onClick={scrollToTop}
        aria-label="Back to top"
      >
        <i className="fas fa-arrow-up"></i>
      </button>
    </>
  );
}
