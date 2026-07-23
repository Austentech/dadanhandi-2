"use client";

import { useEffect } from "react";

export default function ScrollReveal() {
  useEffect(() => {
    const revealElements = () => {
      const wBot = window.scrollY + window.innerHeight;
      document.querySelectorAll(".reveal").forEach((el) => {
        if ((el as HTMLElement).offsetTop < wBot - 50) {
          el.classList.add("revealed");
        }
      });
    };

    revealElements();
    window.addEventListener("scroll", revealElements, { passive: true });
    return () => window.removeEventListener("scroll", revealElements);
  }, []);

  return null;
}
