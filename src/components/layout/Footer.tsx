import Link from "next/link";
import { SITE_CONFIG, FOOTER_NAV_LINKS, FOOTER_MENU_LINKS, SOCIAL_LINKS } from "@/constants/site";

export default function Footer() {
  return (
    <footer>
      <div className="container-custom">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 40 }}>
          {/* Column 1: About */}
          <div>
            <div className="footer-logo-text">{SITE_CONFIG.name}</div>
            <div className="footer-tagline" dangerouslySetInnerHTML={{ __html: SITE_CONFIG.shortTagline }} />
            <p style={{ color: "#7A5030", fontSize: "0.82rem", marginTop: 14, lineHeight: 1.8 }}>
              Bihar&apos;s most loved handi mutton restaurant since {SITE_CONFIG.since}. Authentic recipes, traditional cooking, real flavours.
            </p>
            <div className="social-icons" style={{ marginTop: 16 }}>
              {SOCIAL_LINKS.map((s) => (
                <a key={s.label} href={s.href} className="social-icon" target="_blank" rel="noopener noreferrer" aria-label={s.label}>
                  <i className={s.icon}></i>
                </a>
              ))}
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h6>Quick Links</h6>
            <ul className="footer-links">
              {FOOTER_NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Our Menu */}
          <div>
            <h6>Our Menu</h6>
            <ul className="footer-links">
              {FOOTER_MENU_LINKS.map((item) => (
                <li key={item.label}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Contact */}
          <div>
            <h6>Main Branch</h6>
            <address className="footer-address">
              <i className="fas fa-map-marker-alt" style={{ color: "#C46A2E", marginRight: 8 }}></i>
              {SITE_CONFIG.address}
            </address>
            <div style={{ marginTop: 16 }}>
              <a href={SITE_CONFIG.phoneFormatted} style={{ color: "#C46A2E", textDecoration: "none", fontSize: "0.9rem", fontWeight: 700, display: "block" }}>
                <i className="fas fa-phone" style={{ color: "#C46A2E", marginRight: 8 }}></i>{SITE_CONFIG.phone}
                <br />
                <i className="fas fa-clock" style={{ color: "#C46A2E", marginRight: 8 }}></i>{SITE_CONFIG.openingHours}
              </a>
            </div>
            <div style={{ marginTop: 12 }}>
              <a href={SITE_CONFIG.whatsappLink} target="_blank" rel="noopener noreferrer" style={{ color: "#1b7a3d", textDecoration: "none", fontSize: "0.85rem" }}>
                <i className="fab fa-whatsapp" style={{ marginRight: 8 }}></i>WhatsApp
              </a>
            </div>
          </div>
        </div>

        <div className="footer-bottom" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span>&copy; {SITE_CONFIG.copyrightYear} {SITE_CONFIG.name}. All rights reserved.</span>
            <span>Crafted with code and curiosity by <a href="#" target="_blank">{SITE_CONFIG.craftedBy} 💡</a></span>
          </div>
        </div>
      </div>
    </footer>
  );
}
