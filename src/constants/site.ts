export const SITE_CONFIG = {
  name: "Dadan Handi Mutton Hotel",
  tagline: "शेर दिल वाले ही मटन खाते हैं! शेर कभी घास नहीं खाता हैं!",
  shortTagline: "शेर दिल वाले ही मटन खाते हैं!<br/> शेर कभी घास नहीं खाता हैं!",
  since: "1985",
  location: "Patna, Bihar",
  phone: "8986496574",
  phoneFormatted: "tel:8986496574",
  whatsapp: "918986496574",
  whatsappLink: "https://wa.me/918986496574",
  whatsappOrderLink: "https://wa.me/918986496574?text=Hi%20I%20want%20to%20order%20food",
  address: "Saguna Khagaul Road, Kaliket Nagar, Danapur, Patna, Bihar – 801105",
  openingHours: "Sun - Sat (10:00 AM - 10:00 PM)",
  zomatoLink: "https://www.zomato.com/patna/dadan-handi-mutton-hotel-adampur/",
  swiggyLink: "https://www.swiggy.com/city/patna/dadan-handi-mutton-hotel-khajpura-khajpura-rest1331535/",
  googleMapsEmbed: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3597.9737316215424!2d85.04013837453462!3d25.605789115031605!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39ed57a4587f033f%3A0xba50f4f58760036c!2sDadan%20Handi%20Mutton!5e0!3m2!1sen!2sin!4v1775750002323!5m2!1sen!2sin",
  googleMapsLink: "https://maps.google.com/?q=dadan+handi+mutton+hotel+Saguna+Khagaul+Road+Kaliket+Nagar+Danapur+Patna",
  facebookLink: "https://www.facebook.com/share/189QrQxb1q/",
  instagramLink: "https://www.instagram.com/dadan_handi.ofc?igsh=MWh0c245amZyN2hzNw==",
  youtubeLink: "https://youtube.com/@dadanhandimuttonhotel?si=DhuO64OBMpF7cSLJ",
  googleSearchLink: "https://www.google.com/search?q=Dadan+Handi+Mutton+Hotel+Danapur+Patna",
  copyrightYear: "2026",
  craftedBy: "Sankhya Stack",
} as const;

export const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Menu", href: "/menu" },
  { label: "Reviews", href: "/reviews" },
  { label: "Contact", href: "/contact" },
] as const;

export const FOOTER_NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Menu", href: "/menu" },
  { label: "Reviews", href: "/reviews" },
  { label: "Blog", href: "/blog" },
  { label: "Careers", href: "/careers" },
  { label: "Contact", href: "/contact" },
] as const;

export const FOOTER_MENU_LINKS = [
  { label: "Mutton Handi", href: "/menu" },
  { label: "Chicken Handi", href: "/menu" },
  { label: "Fish Curry", href: "/menu" },
  { label: "Thali Meals", href: "/menu" },
  { label: "Tandoori", href: "/menu" },
] as const;

export const SOCIAL_LINKS = [
  { icon: "fab fa-facebook-f", href: SITE_CONFIG.facebookLink, label: "Facebook" },
  { icon: "fab fa-instagram", href: SITE_CONFIG.instagramLink, label: "Instagram" },
  { icon: "fab fa-youtube", href: SITE_CONFIG.youtubeLink, label: "YouTube" },
  { icon: "fas fa-utensils", href: SITE_CONFIG.zomatoLink, label: "Zomato" },
] as const;
