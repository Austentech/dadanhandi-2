"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { HERO_CONTENT } from "@/constants/content";

export default function HeroSection() {
  const heroBgRef = useRef<HTMLDivElement>(null);
  const smokeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => {
      if (heroBgRef.current) heroBgRef.current.classList.add("loaded");
    }, 100);

    // Generate smoke particles imperatively to avoid hydration mismatch
    const container = smokeContainerRef.current;
    if (container) {
      for (let i = 0; i < 6; i++) {
        const el = document.createElement("div");
        el.className = "smoke-particle";
        const sz = Math.random() * 55 + 88;
        el.style.width = `${sz}px`;
        el.style.height = `${sz}px`;
        el.style.left = `${Math.random() * 100}%`;
        el.style.animationDuration = `${Math.random() * 12 + 10}s`;
        el.style.animationDelay = `${Math.random() * 8}s`;
        container.appendChild(el);
      }
    }

    if (window.innerWidth > 768) {
      const heroH = document.querySelector(".hero-section")?.getBoundingClientRect().height || 0;
      const handleScroll = () => {
        const s = window.scrollY;
        if (s < heroH && heroBgRef.current) {
          heroBgRef.current.style.transform = `scale(1.02) translateY(${s * 0.22}px)`;
        }
      };
      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => window.removeEventListener("scroll", handleScroll);
    }
  }, []);

  return (
    <section className="hero-section">
      <div ref={heroBgRef} className="hero-bg"></div>
      <div className="smoke-overlay"></div>

      <div className="steam-wrap" aria-hidden="true">
        <div className="steam-wisp"></div>
        <div className="steam-wisp"></div>
        <div className="steam-wisp"></div>
        <div className="steam-wisp"></div>
        <div className="steam-wisp"></div>
      </div>

      {/* Smoke particles are injected imperatively in useEffect to avoid hydration mismatch */}
      <div ref={smokeContainerRef} aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2, overflow: "hidden" }}></div>

      <div className="hero-content">
        <div className="hero-since">⚔ Since 1985 · Bihar&apos;s Finest Handi ⚔</div>
        <h1 className="hero-title-hindi" style={{ fontSize: "clamp(2.6rem, 7.5vw, 5.5rem)" }}>
          <b>ददन हांडी</b> <span><b>मटन</b></span>
        </h1>
        <div className="hero-divider"></div>
        <div className="hero-tagline-hindi">
          {HERO_CONTENT.tagline1}
          <span>{HERO_CONTENT.tagline2}</span>
        </div>
        <p className="hero-subtitle">Authentic Bihar · Handi Specialist · Danapur, Patna</p>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14, marginTop: 8 }}>
          <Link href="/menu" className="btn-hero-primary">
            <i className="fas fa-book-open"></i> View Menu & Order
          </Link>
          <a href="tel:8986496574" className="btn-hero-secondary">
            <i className="fas fa-phone"></i> Call Now
          </a>
        </div>
      </div>

      <div className="hero-scroll-indicator" aria-hidden="true">
        <i className="fas fa-chevron-down"></i>
      </div>
    </section>
  );
}
