import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dadan Handi Mutton Hotel – Authentic Bihar Non-Veg Restaurant, Patna Since 1985",
  description: "Dadan Handi Mutton Hotel – Patna's most loved handi mutton restaurant since 1985. Authentic Bihar non-veg food, slow-cooked in traditional handi. Order on Zomato or Swiggy.",
  keywords: "handi mutton patna, non veg restaurant patna, bihar food, dadan handi mutton, handi mutton danapur, best mutton patna",
  robots: "index, follow",
  icons: {
    icon: "/images/logo.png",
  },
  openGraph: {
    title: "Dadan Handi Mutton Hotel – Patna",
    description: "Authentic Bihar Handi Mutton since 1985. Order online or visit us in Danapur, Patna.",
    type: "website",
    url: "https://dadanhandihotel.com/",
    siteName: "Dadan Handi Mutton Hotel",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dadan Handi Mutton Hotel – Patna",
    description: "Authentic Bihar Handi Mutton since 1985. Order online or visit us in Danapur, Patna.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Tiro+Devanagari+Hindi:wght@400;700&family=Nunito:wght@300;400;600;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
        <link rel="preload" as="image" href="/images/hero-handi.webp" type="image/webp" />
        <style>{`
          :root {
            --font-playfair: 'Playfair Display', serif;
            --font-nunito: 'Nunito', sans-serif;
            --font-tiro: 'Tiro Devanagari Hindi', serif;
          }
        `}</style>
      </head>
      <body className="bg-[#FDF3E3] text-[#4A2010]">
        {children}
      </body>
    </html>
  );
}
