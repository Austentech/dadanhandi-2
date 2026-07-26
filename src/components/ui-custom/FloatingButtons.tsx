"use client";

import { useState, useEffect } from "react";
import { SITE_CONFIG } from "@/constants/site";
import CartButton from "@/components/cart/CartButton";

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
      {/* Plate / Cart button — replaces WhatsApp order button */}
      <CartButton />
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
