export interface NavItem {
  label: string;
  href: string;
}

export interface SocialLink {
  icon: string;
  href: string;
  label: string;
}

export interface FooterMenuItem {
  label: string;
  href: string;
}

export interface Testimonial {
  name: string;
  location: string;
  text: string;
  stars: number;
  avatarBg?: string;
  avatarLetter: string;
}

export interface MenuItem {
  name: string;
  description: string;
  price: string;
  quantity?: string;
  emoji: string;
  category: string;
}

export interface MenuCategory {
  id: string;
  title: string;
  items: MenuItem[];
}

export interface Review {
  name: string;
  location: string;
  text: string;
  stars: number;
}

export interface Branch {
  name: string;
  address: string;
  mapEmbed: string;
  mapsLink: string;
  comingSoon?: boolean;
}

export interface JobListing {
  title: string;
  location: string;
  type: string;
  salary: string;
  description: string;
  requirements: string[];
  status: "hiring" | "coming-soon" | "open";
  positionName: string;
}

export interface CareerPerk {
  icon: string;
  title: string;
  description: string;
}

export interface TimelineEntry {
  year: string;
  name: string;
  role: string;
  description: string;
}

export interface PopupQuestion {
  emoji: string;
  questionText: string;
  subText: string;
  buttons: { label: string; link: string; variant: "zomato" | "swiggy" | "whatsapp" }[];
}

export interface FeatureCard {
  icon: string;
  title: string;
  description: string;
}

export interface DishCard {
  name: string;
  description: string;
  price: string;
  badge: string;
  image: string;
}
