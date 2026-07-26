"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PageLoader from "@/components/ui-custom/PageLoader";
import FloatingButtons from "@/components/ui-custom/FloatingButtons";
import ScrollReveal from "@/components/ui-custom/ScrollReveal";
import HungerPopup from "@/components/ui-custom/HungerPopup";
import MenuNoticeModal from "@/components/menu/MenuNoticeModal";
import MenuItemCard from "@/components/menu/MenuItemCard";
import { MENU_CATALOG } from "@/constants/menu-catalog";

const FILTER_OPTIONS = [
  { id: "all", label: "All" },
  ...MENU_CATALOG.map((cat) => ({ id: cat.id, label: cat.title.replace(/<[^>]*>/g, "") })),
];

export default function MenuPage() {
  const [activeFilter, setActiveFilter] = useState("all");

  const filteredCategories = activeFilter === "all"
    ? MENU_CATALOG
    : MENU_CATALOG.filter((cat) => cat.id === activeFilter);

  return (
    <>
      <PageLoader />
      <Navbar />
      <ScrollReveal />
      <MenuNoticeModal />
      <main>
        <section className="page-hero">
          <div className="container-custom" style={{ position: "relative" }}>
            <nav style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)" }}>
              <Link href="/" style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none" }}>Home</Link>
              <span style={{ margin: "0 8px", color: "rgba(255,255,255,0.4)" }}>/</span>
              <span style={{ color: "#F4C430" }}>Menu</span>
            </nav>
            <h1 className="page-hero-title">Our <span>Menu</span></h1>
            <p style={{ color: "#7A5030", fontSize: "1rem", marginTop: 10 }}>
              Authentic Bihar non-veg food, slow-cooked in traditional handi
            </p>
            <div className="menu-hero-notice">
              <i className="fas fa-info-circle"></i>
              <span>Pickup orders only · Pay online · Order ready at store</span>
            </div>
          </div>
        </section>

        <section className="menu-page">
          <div className="container-custom">
            {/* Filter Tabs */}
            <div className="menu-filter-tabs reveal" style={{ marginBottom: 24 }}>
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  className={`menu-filter-tab${activeFilter === opt.id ? " active" : ""}`}
                  onClick={() => setActiveFilter(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Thali Highlight */}
            <div className="thali-highlight reveal">
              <span className="thali-highlight-icon">🍛</span>
              <p>
                Best Value — <span>Mutton Thali at just ₹350! Complete meal with mutton, rice, fulka, salad &amp; chutney.</span>
              </p>
            </div>

            {/* Menu Categories */}
            {filteredCategories.map((cat) => (
              <div key={cat.id} className="menu-section-block" data-cat={cat.id}>
                <div className="menu-cat-heading">
                  <h3 dangerouslySetInnerHTML={{ __html: cat.title }}></h3>
                  <div className="menu-cat-line"></div>
                </div>

                {cat.items.map((item) => (
                  <div key={item.id} className="reveal">
                    <MenuItemCard item={item} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
      <FloatingButtons />
      <HungerPopup />
    </>
  );
}
