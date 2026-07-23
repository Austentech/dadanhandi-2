import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import FloatingButtons from "@/components/ui-custom/FloatingButtons";
import { SITE_CONFIG } from "@/constants/site";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main style={{
        minHeight: "60vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center",
        padding: "40px 20px",
        background: "#FDF3E3",
      }}>
        <div style={{ fontSize: "4rem", marginBottom: 24 }}>🫕</div>
        <h1 style={{ fontFamily: "var(--font-playfair)", fontSize: "clamp(2rem, 5vw, 3rem)", color: "#7A0C0C", marginBottom: 12 }}>
          Page Not Found
        </h1>
        <p style={{ color: "#7A5030", fontSize: "1rem", marginBottom: 32, maxWidth: 500 }}>
          Sorry, the page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/" className="btn-hero-primary">
          <i className="fas fa-home"></i> Back to Home
        </Link>
      </main>
      <Footer />
      <FloatingButtons />
    </>
  );
}
