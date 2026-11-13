import {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight, Heart, Leaf, ChefHat, Croissant} from 'lucide-react';
import {api} from './lib';
import type {Category, Product} from './lib';
import {Branch, Ornament, FeaturedCard, ErrorBox, LazyImage} from './ui';
import CategorySlider from './CategorySlider';
import MapSection from './MapSection';
import {useI18n} from './i18n';

/* ── Animated hero text lines ─────────────────────────────────────────── */
function AnimatedHeroText() {
  const {t, lang} = useI18n();
  // Re-animate whenever language changes
  const [visible, setVisible] = useState(false);
  const [key, setKey] = useState(0);
  const prevLang = useRef(lang);

  useEffect(() => {
    if (prevLang.current !== lang) {
      prevLang.current = lang;
      setVisible(false);
      setKey(k => k + 1);
      const timer = setTimeout(() => setVisible(true), 60);
      return () => clearTimeout(timer);
    }
  }, [lang]);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <h1 key={key} className={`hero-h1 ${visible ? 'hero-h1-visible' : ''}`}>
      <span className="hero-h1-line" style={{transitionDelay: '0ms'}}>Anaşym</span>
      <br />
      <span className="hero-h1-sub-group">
        <span className="hero-h1-line hero-h1-sub" style={{transitionDelay: '90ms'}}>{t.heroH1Line2}</span>
        {' '}
        <span className="hero-h1-line hero-h1-brand hero-h1-sub" style={{transitionDelay: '180ms'}}>{t.heroH1Brand}</span>
      </span>
    </h1>
  );
}

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState('');
  const {t} = useI18n();

  const load = () => {
    setError('');
    Promise.all([api<Category[]>('/categories/'), api<Product[]>('/products/')])
      .then(([c, p]) => { setCategories(c); setProducts(p); })
      .catch(e => setError(e.message));
  };
  useEffect(load, []);

  const benefits: [typeof Heart, string, string][] = [
    [Croissant, t.benefit1a, t.benefit1b],
    [Heart,     t.benefit2a, t.benefit2b],
    [Leaf,      t.benefit3a, t.benefit3b],
    [ChefHat,   t.benefit4a, t.benefit4b],
  ];

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="hero">
        <picture className="hero-picture">
          <source media="(max-width: 600px)" srcSet="/images/hero-cakes-mobile.webp" />
          <img className="hero-image" src="/images/hero-cakes.webp" alt="Пирог с клубникой и киви, тарталетка со сливками и песочное печенье"
            fetchPriority="high" width={2367} height={1001} />
        </picture>
        <div className="hero-shade" />
        <div className="container hero-content">
          <div className="hero-stack">
            <div className="hero-ornament" aria-hidden="true">
              <i />
              <svg viewBox="0 0 16 16" width="15" height="15"><path d="M8 0C8.6 5 11 7.4 16 8 11 8.6 8.6 11 8 16 7.4 11 5 8.6 0 8 5 7.4 7.4 5 8 0Z" fill="currentColor" /></svg>
              <i />
            </div>
            <AnimatedHeroText />
            <svg className="hero-swoosh" viewBox="0 0 340 44" fill="none" aria-hidden="true">
              <path d="M3 41C78 14 205 1 337 5C215 6 92 19 3 41Z" fill="currentColor" />
            </svg>
            <Link to="/catalog" className="button button-gold hero-btn-anim">
              {t.heroButton} <ArrowRight size={20} aria-hidden="true" />
            </Link>
            <div className="hero-note">
              <i /><Heart size={11} aria-hidden="true" />{t.heroNote}<i />
            </div>
          </div>
        </div>
        <Branch className="hero-branch hero-branch-top" />
        <Branch className="hero-branch" />
      </section>

      {/* ── Benefits ──────────────────────────────────────────────────── */}
      <section className="benefits">
        <div className="container benefits-grid">
          {benefits.map(([Icon, first, last], i) => {
            const I = Icon as typeof Heart;
            return (
              <div className="benefit" key={i}>
                <span className="benefit-icon"><I strokeWidth={1.15} /></span>
                <span>{String(first)}<br />{String(last)}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Categories ────────────────────────────────────────────────── */}
      <section className="section categories-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t.sectionCategoriesEyebrow}</span>
              <h2>{t.sectionCategoriesTitle}</h2>
            </div>
            <Ornament />
            <Link to="/catalog" className="text-link">{t.sectionCatalogLink} <ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
          {error ? <ErrorBox message={error} retry={load} /> : <CategorySlider categories={categories} products={products} />}
        </div>
      </section>

      {/* ── About ─────────────────────────────────────────────────────── */}
      <section className="about-section about-v2" id="about">
        <picture className="about-photo">
          <source media="(max-width: 820px)" srcSet="/images/about-pies-mobile.webp" />
          <img src="/images/about-pies.webp" alt={t.aboutCaption} loading="lazy" width={1712} height={1332} />
        </picture>
        <img className="about-watermark" src="/images/Logo.webp" alt="" aria-hidden="true" loading="lazy" />
        <svg className="about-wave" viewBox="0 0 600 160" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 158C150 156 260 120 360 70C440 30 520 8 600 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        <div className="about-copy">
          <span className="about-eyebrow"><b>✦</b><i />{t.aboutEyebrow}<i /><b>✦</b></span>
          <h2>{(() => {
            const [lead, accent] = t.aboutTitle.split(/\s*—\s*/);
            return accent ? <>{lead}<br /><em>{accent}</em></> : t.aboutTitle;
          })()}</h2>
          <p>{t.aboutP1}</p>
          <ul className="about-features">
            <li><Leaf aria-hidden="true" /><span>{t.aboutF1a}<br />{t.aboutF1b}</span></li>
            <li><ChefHat aria-hidden="true" /><span>{t.aboutF2a}<br />{t.aboutF2b}</span></li>
            <li><Heart aria-hidden="true" /><span>{t.aboutF3a}<br />{t.aboutF3b}</span></li>
          </ul>
          <Link to="/about" className="button button-gold">{t.aboutButton} <ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
      </section>

      {/* ── Featured products ─────────────────────────────────────────── */}
      <section className="section favorites">
        <div className="container">
          <div className="feat-heading">
            <span className="eyebrow">{t.sectionFavoritesEyebrow}</span>
            <h2>{t.sectionFavoritesTitle}</h2>
            <span className="feat-ornament" aria-hidden="true">
              <i />
              <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.3">
                <path d="M20 27C14 22 9 18 9 12a5 5 0 0 1 9-3l2 3 2-3a5 5 0 0 1 9 3c0 6-5 10-11 15Z" />
                <path d="M20 27C17 21 12 18 4 19c1 5 7 8 16 8Zm0 0c3-6 8-9 16-8-1 5-7 8-16 8Z" />
              </svg>
              <i />
            </span>
            <Link to="/catalog" className="text-link feat-link"><span>{t.sectionFavoritesLink}</span> <ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
          <div className="feat-grid">
            {products.slice(0, 4).map(p => <FeaturedCard key={p.id} product={p} />)}
          </div>
          <Branch className="feat-wheat" />
        </div>
      </section>

      {/* ── Map ───────────────────────────────────────────────────────── */}
      <MapSection />
    </>
  );
}
