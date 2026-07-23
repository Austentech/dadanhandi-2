"use client";

import { useState } from "react";
import { type Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PageLoader from "@/components/ui-custom/PageLoader";
import FloatingButtons from "@/components/ui-custom/FloatingButtons";
import ScrollReveal from "@/components/ui-custom/ScrollReveal";
import HungerPopup from "@/components/ui-custom/HungerPopup";
import { MENU_CATEGORIES, SITE_CONFIG } from "@/constants/content";

export const metadata: Metadata = {
  title: "Menu – Dadan Handi Mutton Hotel | Authentic Bihar Non-Veg Menu Patna",
  description: "Full menu of Dadan Handi Mutton Hotel – Handi Mutton ₹1100/kg, Thali meals, Tandoori, Fish, Egg Curry and more. Order on WhatsApp instantly.",
};

const FILTER_OPTIONS = [
  { id: "all", label: "All" },
  ...MENU_CATEGORIES.map((cat) => ({ id: cat.id, label: cat.title.replace(/<[^>]*>/g, "") })),
];

export default function MenuPage() {
  const [activeFilter, setActiveFilter] = useState("all");

  const filteredCategories = activeFilter === "all"
    ? MENU_CATEGORIES
    : MENU_CATEGORIES.filter((cat) => cat.id === activeFilter);

  const handleOrderNow = (itemName: string) => {
    const url = `https://wa.me/${SITE_CONFIG.whatsapp}?text=${encodeURIComponent("Hi! I want to order: " + itemName)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <PageLoader />
      <Navbar />
      <ScrollReveal />
      <main>
        <section className="page-hero">
          <div className="container-custom" style={{ position: "relative" }}>
            <nav style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)" }}>
              <Link href="/" style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none" }}>Home</Link>
              <span style={{ margin: "0 8px", color: "rgba(255,255,255,0.4)" }}>/</span>
              <span style={{ color: "#F4C430" }}>Menu</span>
            </nav>
            <h1 className="page-hero-title">Our <span>Menu</span></h1>
            <p style={{ color: "#7A5030", fontSize: "1rem", marginTop: 10 }}>Authentic Bihar non-veg food, slow-cooked in traditional handi</p>
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
            {filteredCategories.map((cat, catIdx) => (
              <div key={cat.id} className="menu-section-block" data-cat={cat.id}>
                <div className="menu-cat-heading">
                  <h3 dangerouslySetInnerHTML={{ __html: cat.title }}></h3>
                  <div className="menu-cat-line"></div>
                </div>

                {cat.items.map((item, idx) => (
                  <div key={idx} className="menu-item-card reveal">
                    <div className="menu-item-img-placeholder">{item.emoji}</div>
                    <div className="menu-item-body">
                      <div className="menu-item-name">{item.name}</div>
                      <p className="menu-item-desc">{item.description}</p>
                    </div>
                    <div className="menu-item-right">
                      <div className="menu-item-price">{item.price}</div>
                      {item.quantity && <div className="menu-item-qty">{item.quantity}</div>}
                      <button
                        className="btn-order-now"
                        onClick={() => handleOrderNow(item.name)}
                      >
                        <i className="fab fa-whatsapp"></i> Order Now
                      </button>
                    </div>
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
