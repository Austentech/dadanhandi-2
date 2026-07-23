"use client";

import { useEffect, useRef, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PageLoader from "@/components/ui-custom/PageLoader";
import HungerPopup from "@/components/ui-custom/HungerPopup";
import FloatingButtons from "@/components/ui-custom/FloatingButtons";
import ScrollReveal from "@/components/ui-custom/ScrollReveal";
import HeroSection from "@/components/sections/HeroSection";
import WhyChooseSection from "@/components/sections/WhyChooseSection";
import MenuHighlightSection from "@/components/sections/MenuHighlightSection";
import PricingSection from "@/components/sections/PricingSection";
import ReviewsSection from "@/components/sections/ReviewsSection";
import BranchesSection from "@/components/sections/BranchesSection";
import DeliverySection from "@/components/sections/DeliverySection";
import CTABanner from "@/components/sections/CTABanner";
import { ABOUT_STATS } from "@/constants/content";

function StatsBar() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const ref = useRef<HTMLDivElement>(null);
  const counted = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !counted.current) {
          counted.current = true;
          const targets: Record<string, number> = {
            "39+": 39,
            "4": 4,
            "10,000+": 10000,
          };
          Object.entries(targets).forEach(([label, target]) => {
            let current = 0;
            const step = Math.max(1, Math.floor(target / 40));
            const interval = setInterval(() => {
              current += step;
              if (current >= target) {
                current = target;
                clearInterval(interval);
              }
              setCounts((prev) => ({ ...prev, [label]: current }));
            }, 30);
          });
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ background: "#F5E6C8", borderTop: "2px solid #E8C98A", borderBottom: "2px solid #E8C98A", padding: "20px 0" }}>
      <div className="container-custom">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, textAlign: "center" }}>
          {ABOUT_STATS.map((stat, idx) => (
            <div key={idx}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "2rem", fontWeight: 900, color: "#7A0C0C", lineHeight: 1 }}>
                {stat.value.startsWith("⭐") ? stat.value : counts[stat.value] != null ? counts[stat.value] >= 10000 ? `${counts[stat.value].toLocaleString()}+` : counts[stat.value] === 39 ? "39+" : counts[stat.value] : stat.value}
              </div>
              <div style={{ fontSize: "0.78rem", color: "#7A5030", letterSpacing: "2px", textTransform: "uppercase", marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <PageLoader />
      <Navbar />
      <ScrollReveal />
      <main>
        <HeroSection />
        <StatsBar />
        <WhyChooseSection />
        <div className="section-sep"></div>
        <MenuHighlightSection />
        <PricingSection />
        <div className="section-sep"></div>
        <ReviewsSection />
        <div className="section-sep"></div>
        <BranchesSection />
        <div className="section-sep"></div>
        <DeliverySection />
        <CTABanner />
      </main>
      <Footer />
      <FloatingButtons />
      <HungerPopup />
    </>
  );
}
