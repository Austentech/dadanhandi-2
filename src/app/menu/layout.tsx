import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Menu – Dadan Handi Mutton Hotel | Authentic Bihar Non-Veg Menu Patna",
  description: "Full menu of Dadan Handi Mutton Hotel – Handi Mutton ₹1100/kg, Thali meals, Tandoori, Fish, Egg Curry and more. Order online for pickup at our store.",
};

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
