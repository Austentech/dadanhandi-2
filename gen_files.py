#!/usr/bin/env python3
import os

base = '/home/z/my-project/src'

def write(path, content):
    full = os.path.join(base, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w') as f:
        f.write(content)
    print(f'  wrote {path}')

# Blog page
write('app/blog/page.tsx', r"""import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ScrollReveal from '@/components/ui-custom/ScrollReveal';
import FloatingButtons from '@/components/ui-custom/FloatingButtons';
import HungerPopup from '@/components/ui-custom/HungerPopup';
import CTABanner from '@/components/sections/CTABanner';
import { SITE_CONFIG } from '@/constants/site';

export default function BlogPage() {
  return (
    <>
      <Navbar />
      <ScrollReveal />
      <section className="page-hero">
        <div className="container-custom">
          <p style={{ color: 'var(--mustard)', fontSize: '0.75rem', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>Blog</p>
          <h1 className="page-hero-title">Food <span>Stories</span></h1>
        </div>
      </section>
      <section className="blog-section">
        <div className="container-custom">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>
            <div className="blog-card reveal">
              <div className="blog-card-img-wrap">
                <img className="blog-card-img" src="https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&q=80" alt="Handi Mutton" loading="lazy" />
              </div>
              <div className="blog-card-body">
                <div className="blog-meta">
                  <span className="blog-cat-tag">Heritage</span>
                  <span><i className="far fa-calendar" /> July 2025</span>
                </div>
                <h2 className="blog-card-title">The Art of Handi Cooking: Why Clay Pots Make All the Difference</h2>
                <p>For centuries, Indian cooking has relied on clay handis to create dishes with unmatched depth of flavour. At Dadan Handi Mutton Hotel, we continue this tradition every single day. The porous nature of clay allows slow, even heat distribution, while the earthy aroma infuses into the meat during the hours-long cooking process. Unlike metal or pressure cookers, a clay handi retains moisture and creates a unique steaming effect that tenderises the meat from the outside in. Combined with whole spices — bay leaves, black cardamom, cloves, and cinnamon — cooked in pure mustard oil, the result is a gravy that is rich, aromatic, and impossible to replicate with modern shortcuts.</p>
              </div>
            </div>
            <div>
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
                <h4 style={{ fontFamily: "var(--font-playfair), serif", color: 'var(--dark-red)', marginBottom: 12 }}>Order Now</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16, lineHeight: 1.6 }}>Craving authentic handi mutton? Order directly on WhatsApp!</p>
                <a href={SITE_CONFIG.whatsappOrderLink} target="_blank" rel="noopener noreferrer" className="btn-order-now" style={{ display: 'inline-flex' }}>
                  <i className="fab fa-whatsapp" /> WhatsApp Order
                </a>
              </div>
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
                <h4 style={{ fontFamily: "var(--font-playfair), serif", color: 'var(--dark-red)', marginBottom: 12 }}>About Us</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.6 }}>Dadan Handi Mutton Hotel has been serving authentic Bihar-style handi mutton since 1985. Three generations of Army men have built this legacy with discipline, honour, and the finest ingredients.</p>
              </div>
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 24 }}>
                <h4 style={{ fontFamily: "var(--font-playfair), serif", color: 'var(--dark-red)', marginBottom: 12 }}>Tags</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['Handi Mutton', 'Bihar Food', 'Patna Restaurant', 'Traditional Cooking', 'Clay Pot', 'Army Legacy'].map((tag) => (
                    <span key={tag} style={{ background: 'var(--section-deep)', color: 'var(--text-muted)', padding: '4px 12px', borderRadius: 20, fontSize: '0.78rem' }}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 60, padding: 40, background: 'var(--section-alt)', borderRadius: 12 }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 12 }}>✍️</span>
            <h3 style={{ fontFamily: "var(--font-playfair), serif", color: 'var(--dark-red)', marginBottom: 8 }}>More Stories Coming Soon</h3>
            <p style={{ color: 'var(--text-muted)' }}>We are working on more food stories, recipes, and behind-the-scenes content. Stay tuned!</p>
          </div>
        </div>
      </section>
      <CTABanner />
      <Footer />
      <FloatingButtons />
      <HungerPopup />
    </>
  );
}
""")

print('blog done')