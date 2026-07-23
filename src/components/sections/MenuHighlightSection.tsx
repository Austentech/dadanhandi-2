"use client";

import { useState } from "react";
import Link from "next/link";
import { HOME_MENU_TABS } from "@/constants/content";

export default function MenuHighlightSection() {
  const [activeTab, setActiveTab] = useState("special");

  const activeData = HOME_MENU_TABS.find((t) => t.id === activeTab);

  return (
    <section className="menu-section">
      <div className="container-custom">
        <div className="text-center" style={{ marginBottom: 8 }}>
          <div className="section-badge">Our Menu</div>
          <h2 className="section-title" style={{ marginTop: 8 }}>Signature <span>Dishes</span></h2>
          <div className="section-divider"></div>
        </div>

        {/* Tab Navigation */}
        <div className="menu-tabs" style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", marginBottom: 32 }}>
          {HOME_MENU_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`menu-filter-tab${activeTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content - Dishes */}
        {activeData && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
            {activeData.dishes.map((dish, idx) => (
              <div key={idx} className="dish-card reveal">
                {dish.image && (
                  <div className="dish-img-wrap">
                    <img src={dish.image} alt={dish.name} loading="lazy" />
                    {dish.badge && <span className="dish-badge">{dish.badge}</span>}
                  </div>
                )}
                <div className="dish-info">
                  <h5>{dish.name}</h5>
                  <p>{dish.description}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="dish-price">{dish.price}</span>
                    {dish.quantity && (
                      <span style={{ fontSize: "0.78rem", color: "#7A5030" }}>{dish.quantity}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* View Full Menu Button */}
        <div className="text-center" style={{ marginTop: 48 }}>
          <Link href="/menu" className="btn-hero-primary">
            <i className="fas fa-book-open"></i> View Full Menu
          </Link>
        </div>
      </div>
    </section>
  );
}
