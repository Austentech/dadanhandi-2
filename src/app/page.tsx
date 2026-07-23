"use client";

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

export default function HomePage() {
  return (
    <>
      <PageLoader />
      <Navbar />
      <ScrollReveal />
      <main>
        <HeroSection />
        <WhyChooseSection />
        <MenuHighlightSection />
        <PricingSection />
        <ReviewsSection />
        <BranchesSection />
        <DeliverySection />
        <CTABanner />
      </main>
      <Footer />
      <FloatingButtons />
      <HungerPopup />
    </>
  );
}
