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

  // Create smoke particles
  const smokeParticles = Array.from({ length: 6 }, (_, i) => {
    const sz = Math.random() * 100 + 50;
    const lft = Math.random() * 100;
    const dur = Math.random() * 12 + 10;
    const del = Math.random() * 8;
    return { sz, lft, dur, del, key: i };
  });

  return (
    <section className="hero-section">
      <div ref={heroBgRef} className="hero-bg"></div>
      <div className="smoke-overlay"></div>

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

      <div className="steam-wrap">
        <div className="steam-wisp"></div>
        <div className="steam-wisp"></div>
        <div className="steam-wisp"></div>
        <div className="steam-wisp"></div>
        <div className="steam-wisp"></div>
      </div>

      <div className="hero-content">
        <div className="hero-since">{HERO_CONTENT.since}</div>
        <h1 className="hero-title-hindi">
          {HERO_CONTENT.titleHindi} <span>{HERO_CONTENT.titleHighlight}</span>
        </h1>
        <div className="hero-divider"></div>
        <p className="hero-tagline-hindi">
          {HERO_CONTENT.tagline1}
          <span>{HERO_CONTENT.tagline2}</span>
        </p>
        <p className="hero-subtitle">{HERO_CONTENT.subtitle}</p>

        <div className="hero-btns-wrap" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14 }}>
          <Link href={HERO_CONTENT.cta1.href} className="btn-hero-primary">
            <i className={HERO_CONTENT.cta1.icon}></i> {HERO_CONTENT.cta1.label}
          </Link>
          <a href={HERO_CONTENT.cta2.href} target="_blank" rel="noopener noreferrer" className="btn-hero-whatsapp">
            <i className={HERO_CONTENT.cta2.icon}></i> {HERO_CONTENT.cta2.label}
          </a>
          <Link href={HERO_CONTENT.cta3.href} className="btn-hero-secondary">
            <i className={HERO_CONTENT.cta3.icon}></i> {HERO_CONTENT.cta3.label}
          </Link>
        </div>
      </div>

      <div className="hero-scroll-indicator">
        <i className="fas fa-chevron-down"></i>
      </div>
    </section>
  );
}
