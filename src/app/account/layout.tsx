import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Account – Dadan Handi Mutton Hotel",
  description: "Manage your account, view order history, and update profile.",
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
