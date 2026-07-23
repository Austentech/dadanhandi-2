"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { HERO_CONTENT } from "@/constants/content";

export default function HeroSection() {
  const heroBgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => {
      if (heroBgRef.current) heroBgRef.current.classList.add("loaded");
    }, 100);

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

  // Create smoke particles (matching live site JS behavior)
  const smokeParticles = Array.from({ length: 6 }, (_, i) => {
    const sz = Math.random() * 55 + 88;
    const lft = Math.random() * 100;
    const dur = Math.random() * 12 + 10;
    const del = Math.random() * 8;
    return { sz, lft, dur, del, key: i };
  });

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

      {smokeParticles.map((p) => (
        <div
          key={p.key}
          className="smoke-particle"
          style={{
            width: `${p.sz}px`,
            height: `${p.sz}px`,
            left: `${p.lft}%`,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.del}s`,
          }}
        />
      ))}

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
          <Link href={HERO_CONTENT.cta1.href} className="btn-hero-primary">
            <i className="fas fa-utensils"></i> Order on Zomato
          </Link>
          <a href={HERO_CONTENT.cta2.href} target="_blank" rel="noopener noreferrer" className="btn-hero-whatsapp">
            <i className="fab fa-whatsapp"></i> WhatsApp Chat
          </a>
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
