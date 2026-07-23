import type { Testimonial, Branch, JobListing, CareerPerk, TimelineEntry, PopupQuestion, FeatureCard, MenuCategory, Review, HomeMenuTab } from "@/types";
export { SITE_CONFIG } from "@/constants/site";

export const HERO_CONTENT = {
  titleHindi: "ददन हांडी मटन",
  titleHighlight: "होटल",
  tagline1: "शेर दिल वाले ही मटन खाते हैं!",
  tagline2: "शेर कभी घास नहीं खाता हैं!",
  since: "EST. 1985",
  subtitle: "Authentic Bihar Handi Mutton • Patna",
  cta1: { label: "View Our Menu", href: "/menu", icon: "fas fa-book-open" },
  cta2: { label: "Order on WhatsApp", href: "https://wa.me/918986496574?text=Hi%20I%20want%20to%20order%20food", icon: "fab fa-whatsapp", isWhatsApp: true },
  cta3: { label: "Find Us", href: "/contact", icon: "fas fa-map-marker-alt" },
} as const;

export const WHY_CHOOSE_FEATURES: FeatureCard[] = [
  { icon: "🫕", title: "Real Handi Mutton", description: "Slow-cooked in clay handis using traditional spices handed down through generations – no shortcuts, ever." },
  { icon: "📅", title: "Since 1985 Legacy", description: "Nearly four decades of feeding Bihar's bravest. Founded by Army Man Ram Sakal Singh with pride." },
  { icon: "🌶️", title: "Authentic Spices", description: "Whole spices, mustard oil, fresh masalas – no artificial flavours, no shortcuts. Pure Bihari cooking." },
  { icon: "❤️", title: "Trusted for Decades", description: "Thousands of loyal customers across Patna trust us every day. Loved by locals, recommended by food lovers." },
];

export const HOME_MENU_TABS: HomeMenuTab[] = [
  {
    id: "special",
    label: "🍲 Special",
    dishes: [
      { name: "Mutton Handi", description: "Slow-cooked tender mutton in rich masala gravy.", price: "₹ 1,200", quantity: "per kg", badge: "Chef's Pick", image: "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=400&q=75&fm=webp" },
      { name: "Ishtu Mutton", description: "A unique Bihari-style mutton stew with whole spices.", price: "₹ 420", quantity: "per plate (6 pcs)", badge: "Special", image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&q=75&fm=webp" },
      { name: "Chicken Handi", description: "Tender chicken in creamy handi-style masala.", price: "₹ 700", quantity: "per kg", image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&q=75&fm=webp" },
      { name: "Fish Curry", description: "Fresh fish in spicy traditional Bihar gravy.", price: "₹ 420", quantity: "per plate (6 pcs)", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&q=75&fm=webp" },
    ],
  },
  {
    id: "thali",
    label: "🍽 Thali",
    dishes: [
      { name: "Handi Mutton Thali", description: "200g handi mutton + unlimited roti + unlimited rice + salad + pickle", price: "₹ 300", badge: null },
      { name: "Isto Mutton Thali", description: "3 pieces isto mutton + unlimited roti + unlimited rice + salad", price: "₹ 270", badge: null },
      { name: "Handi Chicken Thali", description: "200g handi chicken + unlimited roti + unlimited rice + salad + pickle", price: "₹ 200", badge: "Best Value" },
      { name: "Fish Curry Thali", description: "3 pieces fish curry + unlimited roti + unlimited rice + salad + pickle", price: "₹ 270", badge: null },
    ],
  },
  {
    id: "bread",
    label: "🫓 Bread & Rice",
    dishes: [
      { name: "Fulka (Roti)", description: "Soft whole wheat fulka, made fresh on tawa.", price: "₹ 10", quantity: "per piece" },
      { name: "Steamed Rice", description: "Plain hot steamed rice – perfect with any curry.", price: "₹ 60", quantity: "per plate" },
    ],
  },
  {
    id: "tandoori",
    label: "🔥 Tandoori",
    dishes: [
      { name: "Chicken Tikka", description: "Marinated chicken roasted in tandoor to perfection.", price: "₹ 150", quantity: "per stick", badge: "🔥 Hot" },
    ],
  },
];

export const HOME_REVIEWS: Review[] = [
  { name: "Rahul Verma", location: "Danapur, Patna", text: "The mutton handi here is unlike anything I've had in Patna. Slow-cooked to perfection, the gravy soaks right into every piece. Came here on a friend's recommendation and now I'm a regular. The fulka is buttery soft. Absolutely worth every rupee!", stars: 5 },
  { name: "Priya Sinha", location: "Saguna, Patna", text: "Been eating here since 2010. This is the real deal – no shortcuts, no artificial stuff. The handi mutton reminds me of my nana's cooking. 3 generations of my family visit this hotel. The owner Alok bhai is very warm too. Keep it up!", stars: 5 },
  { name: "Amit Kumar", location: "Patna City", text: "The fish curry here hits different. Came specifically after seeing it on Zomato. Place has a rustic feel, staff is friendly, and portions are very generous. The istu mutton was a revelation – never had anything like it before. Highly recommend!", stars: 4 },
  { name: "Deepak Sharma", location: "New Delhi", text: "Visited from Delhi specially to eat here after my cousin wouldn't stop talking about it. Worth every bit of hype! The mutton handi thali is a complete experience – rich, bold flavours cooked the traditional Bihar way. I'll be back every time I'm in Patna.", stars: 5 },
];

export const BRANCHES: Branch[] = [
  { 
    name: "Danapur Branch", 
    address: "Saguna Khagaul Road, Kaliket Nagar, Danapur, Patna, Bihar",
    mapEmbed: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3597.9737316215424!2d85.04013837453462!3d25.605789115031605!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39ed57a4587f033f%3A0xba50f4f58760036c!2sDadan%20Handi%20Mutton!5e0!3m2!1sen!2sin!4v1775750002323!5m2!1sen!2sin", 
    mapsLink: "https://maps.google.com/?q=dadan+handi+mutton+hotel+Patna" 
  },
  { 
    name: "Gola Road Branch", 
    address: "Gola Road, Danapur, Patna, Bihar",
    mapEmbed: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3597.9737316215424!2d85.053453!3d25.613161!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1sDadan%20Handi%20Mutton%20Hotel%2C%20Gola%20Road!5e0!3m2!1sen!2sin", 
    mapsLink: "https://maps.google.com/?q=dadan+handi+mutton+hotel+Patna" 
  },
  { 
    name: "Rajeev Nagar Branch", 
    address: "Nepali More, Rajeev Nagar, Ashiana more, Bailey Road, Patna, Bihar",
    mapEmbed: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3597.9737316215424!2d85.080809!3d25.622750!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1sDadan%20Handi%20Mutton%20Hotel%2C%20Bailey%20Road!5e0!3m2!1sen!2sin", 
    mapsLink: "https://maps.google.com/?q=dadan+handi+mutton+hotel+Patna" 
  },
  { 
    name: "Arrah Branch", 
    address: "S Bhelai Rd, Sarvodaya Nagar, Jagdev Nagar, Arrah, Bihar",
    mapEmbed: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3597.9737316215424!2d84.644520!3d25.534535!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1sDadan%20Handi%20Mutton%20Hotel%2C%20Arrah!5e0!3m2!1sen!2sin", 
    mapsLink: "https://maps.google.com/?q=dadan+handi+mutton+hotel+arrah" 
  },
];

export const TESTIMONIALS: Testimonial[] = [
  { name: "Rahul Verma", location: "Danapur, Patna", text: "The mutton handi here is unlike anything I've had in Patna. Slow-cooked to perfection, the gravy soaks into every piece. Came here on a friend's recommendation and now I'm a weekly regular. The fulka is buttery soft. Absolutely worth every rupee!", stars: 5, avatarLetter: "R" },
  { name: "Priya Sinha", location: "Saguna, Patna", text: "Been eating here since 2010. This is the real deal — no shortcuts, no artificial stuff. The handi mutton reminds me of my nana's cooking. Three generations of my family visit this hotel. The owner Alok bhai is very warm and welcoming. Keep it up!", stars: 5, avatarBg: "linear-gradient(135deg,#1b7a3d,#25a84e)", avatarLetter: "P" },
  { name: "Amit Kumar", location: "Patna City", text: "The fish curry here hits different. Came specifically after seeing it on Zomato. Place has a rustic feel, staff is friendly, and the portions are very generous. The istu mutton was a revelation — never had anything like it. Highly recommended for non-veg lovers!", stars: 4, avatarBg: "linear-gradient(135deg,#1a3d7a,#2e6ac4)", avatarLetter: "A" },
  { name: "Deepak Sharma", location: "New Delhi", text: "Visited from Delhi specifically to eat here after my cousin wouldn't stop talking about it. Worth every bit of the hype! The mutton handi thali is a complete experience — rich, bold, cooked the traditional Bihar way. I'll be back every time I'm in Patna.", stars: 5, avatarBg: "linear-gradient(135deg,#7a3d1a,#c47a2e)", avatarLetter: "D" },
  { name: "Sunita Pandey", location: "Muzaffarpur, Bihar", text: "I've travelled across Bihar for authentic non-veg food and this is genuinely one of the best. The use of traditional spices and slow-cooking method is evident in the taste. You can literally smell the difference when the handi arrives at your table. Superb!", stars: 5, avatarBg: "linear-gradient(135deg,#3d1a7a,#6a2ec4)", avatarLetter: "S" },
  { name: "Vikash Mishra", location: "Boring Road, Patna", text: "Best value-for-money non-veg in this area. The handi mutton thali at ₹350 is a steal — you get generous mutton, rice, fulka, salad, everything. The chicken tandoori is also outstanding. We order from Zomato regularly. Fast delivery, hot food. 10/10!", stars: 5, avatarBg: "linear-gradient(135deg,#7a5a1a,#c4a42e)", avatarLetter: "V" },
  { name: "Neha Kumari", location: "Rajendra Nagar, Patna", text: "The egg curry and steamed rice combo is one of my go-to comfort meals. Simple, perfectly spiced, and very filling. For the price, the quality is outstanding. This place has been feeding my family for over a decade. Long live Dadan Handi Mutton Hotel!", stars: 4, avatarBg: "linear-gradient(135deg,#1a7a5a,#2ec4a4)", avatarLetter: "N" },
  { name: "Manish Gupta", location: "Food Blogger, Patna", text: "I run a food blog covering Bihar's culinary scene, and Dadan Handi stands out as a genuine gem. Their commitment to traditional cooking methods in a world of shortcuts is admirable. The army legacy behind this restaurant reflects in every bite — discipline and quality.", stars: 5, avatarBg: "linear-gradient(135deg,#7a1a1a,#c42e2e)", avatarLetter: "M" },
  { name: "Kavita Singh", location: "Kankarbagh, Patna", text: "Ordered the seekh tikka and chicken tandoori for a family party via Zomato. Arrived hot, perfectly packed, and absolutely delicious. The tandoori had a beautiful smoky char from the real tandoor. My guests were very impressed. Will definitely order again for next event!", stars: 5, avatarBg: "linear-gradient(135deg,#1a5a7a,#2ea4c4)", avatarLetter: "K" },
];

export const TIMELINE: TimelineEntry[] = [
  { year: "1985–1993", name: "Ram Sakal Singh", role: "Founder · Army Man", description: "A retired Indian Army soldier, Ram Sakal Singh laid the foundation of Dadan Handi Mutton Hotel with nothing but a clay handi, a wood fire, and an Army man's work ethic. The small roadside stall in Danapur became a word-of-mouth legend among locals." },
  { year: "1993–2012", name: "Dadan Singh", role: "2nd Generation · Army Man", description: "Carrying forward his father's mission, Dadan Singh — also an Army veteran — gave the restaurant its current identity and name. His era saw growing popularity among Patna's food lovers. The handi recipes became more refined, and the customer base grew steadily over two decades." },
  { year: "2012–Present", name: "Alok Singh", role: "3rd Generation · Expansion Era", description: "Under Alok Singh's leadership, the restaurant entered the digital age — listing on various platform, expanding to 4 branches, and bringing authentic Bihar handi mutton to thousands more customers. The soul remains unchanged; the reach has grown exponentially." },
];

export const CAREER_PERKS: CareerPerk[] = [
  { icon: "🏅", title: "39-Year Legacy", description: "Be part of an institution. Work where your craft is truly valued." },
  { icon: "💰", title: "Good Pay", description: "Competitive salary + meals + tips. We take care of our people." },
  { icon: "📈", title: "Growth", description: "4 branches and expanding. Grow with us as we grow across Bihar." },
  { icon: "👨‍🍳", title: "Learn the Craft", description: "Learn authentic handi cooking from masters who've done it for decades." },
];

export const JOB_LISTINGS: JobListing[] = [
  {
    title: "Kitchen Staff",
    location: "Danapur, Patna",
    type: "Full Time",
    salary: "Salary Negotiable",
    description: "We are looking for dedicated kitchen staff to join our team at our Danapur main branch. You will assist in preparing authentic Bihar handi dishes under the guidance of our senior chefs. No prior experience required — passion for food and willingness to learn is enough!",
    requirements: ["Ability to work in a fast-paced kitchen environment", "Punctual, disciplined and team-oriented", "Interest in learning traditional handi cooking", "Minimum age: 18 years", "Locals from Patna/Danapur preferred"],
    status: "hiring",
    positionName: "Kitchen Staff at Danapur Branch",
  },
  {
    title: "Delivery Partner",
    location: "Patna (Multiple Branches)",
    type: "Part Time / Full Time",
    salary: "Salary + Incentives",
    description: "We need energetic delivery partners to ensure our hot, fresh handi meals reach customers on time. You will manage delivery orders from our restaurant to customer locations across Patna.",
    requirements: ["Own a two-wheeler (bike/scooter)", "Valid driving licence", "Smartphone with WhatsApp", "Knowledge of Patna roads", "Flexible working hours available"],
    status: "hiring",
    positionName: "Delivery Partner",
  },
  {
    title: "Restaurant Manager",
    location: "Patna, Bihar",
    type: "Full Time",
    salary: "Competitive CTC",
    description: "We will soon be hiring an experienced restaurant manager for our expanding operations. This role requires leadership, customer management, and operational skills.",
    requirements: ["Minimum 2 years restaurant management experience", "Strong communication skills in Hindi", "Experience with online food platforms (Zomato/Swiggy)"],
    status: "coming-soon",
    positionName: "Restaurant Manager",
  },
];

export const MENU_CATEGORIES: MenuCategory[] = [
  {
    id: "mutton",
    title: "Mutton Handi <span>Items</span>",
    items: [
      { name: "Handi Mutton (Full Handi)", description: "Traditional clay handi mutton, slow-cooked with whole spices", price: "₹1100", quantity: "1 kg", emoji: "🍲", category: "mutton" },
      { name: "Handi Mutton (Half)", description: "Half handi portion, same authentic taste", price: "₹600", quantity: "½ kg", emoji: "🫕", category: "mutton" },
      { name: "Mutton Thali", description: "Mutton, rice, fulka, salad, chutney — complete meal", price: "₹350", quantity: "1 plate", emoji: "🍛", category: "mutton" },
      { name: "Mutton Keema", description: "Spiced minced mutton, cooked in handi style", price: "₹250", quantity: "1 plate", emoji: "🍖", category: "mutton" },
      { name: "Istu Mutton", description: "Traditional Bihar-style mutton istu", price: "₹280", quantity: "1 plate", emoji: "🥘", category: "mutton" },
      { name: "Mutton Curry", description: "Classic mutton curry with rich gravy", price: "₹220", quantity: "1 plate", emoji: "🍲", category: "mutton" },
    ],
  },
  {
    id: "chicken",
    title: "Chicken <span>Specials</span>",
    items: [
      { name: "Chicken Handi", description: "Tender chicken in handi gravy with mustard oil", price: "₹800", quantity: "1 kg", emoji: "🍗", category: "chicken" },
      { name: "Chicken Curry", description: "Home-style chicken curry", price: "₹200", quantity: "1 plate", emoji: "🍗", category: "chicken" },
      { name: "Chicken Tandoori", description: "Smoky chargrilled tandoori chicken", price: "₹250", quantity: "4 pcs", emoji: "🔥", category: "chicken" },
      { name: "Chicken Seekh Tikka", description: "Spiced minced chicken skewers", price: "₹220", quantity: "6 pcs", emoji: "🍢", category: "chicken" },
    ],
  },
  {
    id: "fish",
    title: "Fish & <span>Seafood</span>",
    items: [
      { name: "Fish Curry", description: "Traditional Bihar-style fish curry", price: "₹350", quantity: "1 plate", emoji: "🐟", category: "fish" },
      { name: "Fish Fry", description: "Crispy fried fish with masala", price: "₹280", quantity: "4 pcs", emoji: "🐠", category: "fish" },
    ],
  },
  {
    id: "tandoori",
    title: "Tandoori & <span>Starters</span>",
    items: [
      { name: "Chicken Tandoori", description: "Whole chicken marinated and chargrilled", price: "₹350", quantity: "Full", emoji: "🔥", category: "tandoori" },
      { name: "Seekh Tikka", description: "Minced chicken seekh kebabs", price: "₹220", quantity: "6 pcs", emoji: "🍢", category: "tandoori" },
      { name: "Mutton Seekh", description: "Minced mutton seekh kebabs", price: "₹300", quantity: "6 pcs", emoji: "🥩", category: "tandoori" },
    ],
  },
  {
    id: "thali",
    title: "Thali & <span>Meals</span>",
    items: [
      { name: "Mutton Thali", description: "Mutton, rice, fulka, salad, chutney, raita", price: "₹350", quantity: "1 plate", emoji: "🍛", category: "thali" },
      { name: "Chicken Thali", description: "Chicken, rice, fulka, salad, dal", price: "₹280", quantity: "1 plate", emoji: "🍛", category: "thali" },
      { name: "Egg Curry Thali", description: "Egg curry, rice, fulka, salad", price: "₹180", quantity: "1 plate", emoji: "🍳", category: "thali" },
    ],
  },
  {
    id: "sides",
    title: "Sides & <span>Extras</span>",
    items: [
      { name: "Steamed Rice", description: "Fluffy basmati rice", price: "₹60", quantity: "1 plate", emoji: "🍚", category: "sides" },
      { name: "Fulka / Roti", description: "Fresh butter fulka", price: "₹30", quantity: "4 pcs", emoji: "🫓", category: "sides" },
      { name: "Salad", description: "Fresh onion, lemon, green chilli salad", price: "₹30", quantity: "1 plate", emoji: "🥗", category: "sides" },
      { name: "Raita", description: "Curd-based side dish", price: "₹40", quantity: "1 bowl", emoji: "🥣", category: "sides" },
      { name: "Green Salad", description: "Fresh green salad with dressing", price: "₹50", quantity: "1 plate", emoji: "🥬", category: "sides" },
    ],
  },
];

export const POPUP_QUESTIONS: PopupQuestion[] = [
  {
    emoji: "🤤",
    questionText: "भूख लगी है?",
    subText: "Patna ke sabse authentic handi mutton ke liye ready ho jaao!",
    buttons: [
      { label: "Zomato", link: "https://www.zomato.com/patna/dadan-handi-mutton-hotel-adampur/", variant: "zomato" },
      { label: "Swiggy", link: "https://www.swiggy.com/city/patna/dadan-handi-mutton-hotel-khajpura-khajpura-rest1331535/", variant: "swiggy" },
    ],
  },
  {
    emoji: "🫕",
    questionText: "आज हांडी मटन बना है!",
    subText: "Mitti ki handi mein slow-cooked, 1985 se — ekdum asli swaad!",
    buttons: [
      { label: "Zomato", link: "https://www.zomato.com/patna/dadan-handi-mutton-hotel-adampur/", variant: "zomato" },
      { label: "Swiggy", link: "https://www.swiggy.com/city/patna/dadan-handi-mutton-hotel-khajpura-khajpura-rest1331535/", variant: "swiggy" },
    ],
  },
  {
    emoji: "😋",
    questionText: "कौन सा डिश आज आजमाना चाहते हैं?",
    subText: "Choose karo aur seedha order karo WhatsApp par!",
    buttons: [
      { label: "🫕 Mutton Thali", link: "https://www.zomato.com/patna/dadan-handi-mutton-hotel-adampur/", variant: "whatsapp" },
      { label: "🍗 Chicken Handi", link: "https://www.zomato.com/patna/dadan-handi-mutton-hotel-adampur/", variant: "whatsapp" },
      { label: "🐟 Fish Curry", link: "https://www.zomato.com/patna/dadan-handi-mutton-hotel-adampur/", variant: "whatsapp" },
    ],
  },
];

export const ABOUT_STATS = [
  { value: "39+", label: "YEARS LEGACY" },
  { value: "4", label: "BRANCHES" },
  { value: "⭐ 3.7", label: "GENUINE RATING" },
  { value: "10,000+", label: "HAPPY CUSTOMERS" },
];

export const RATING_SUMMARY = {
  overall: "3.7",
  stars: "⭐⭐⭐⭐",
  subtitle: "Based on Zomato & Google Reviews",
  breakdown: [
    { stars: 5, percentage: 42 },
    { stars: 4, percentage: 28 },
    { stars: 3, percentage: 15 },
    { stars: 2, percentage: 8 },
    { stars: 1, percentage: 7 },
  ],
};
