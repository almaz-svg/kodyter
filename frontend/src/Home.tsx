import {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight, Heart, Leaf, ChefHat, Croissant} from 'lucide-react';
import {api} from './lib';
import type {Category, Product} from './lib';
import {Branch, Ornament, ProductCard, ErrorBox, LazyImage} from './ui';
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
      <span className="hero-h1-line" style={{transitionDelay: '0ms'}}>{t.heroH1Line1}</span>
      <br />
      <span className="hero-h1-line" style={{transitionDelay: '90ms'}}>{t.heroH1Line2}</span>
      <br />
      <span className="hero-h1-line hero-h1-brand" style={{transitionDelay: '180ms'}}>
        {t.heroH1Brand}
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
      .then(([c, p]) => { setCategories(c); setProducts(p.slice(0, 4)); })
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
          <source media="(max-width: 600px)" srcSet="/images/croissant.webp" />
          <img className="hero-image" src="/images/hero.webp" alt="Золотистые круассаны на деревянной доске"
            fetchPriority="high" width={1672} height={941} />
        </picture>
        <div className="hero-shade" />
        <div className="container hero-content">
          <AnimatedHeroText />
          <p className="hero-subtitle-anim">{t.heroSubtitle}</p>
          <Link to="/catalog" className="button button-gold hero-btn-anim">
            {t.heroButton} <ArrowRight size={20} aria-hidden="true" />
          </Link>
          <div className="hero-note">
            <span />{t.heroNote}
          </div>
        </div>
        <Branch className="hero-branch" />
        <span className="hero-caption">{t.heroCaption}</span>
        <div className="hero-index"><span>01</span><i />Anasym</div>
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
          {error ? <ErrorBox message={error} retry={load} /> : <CategorySlider categories={categories} />}
        </div>
      </section>

      {/* ── About ─────────────────────────────────────────────────────── */}
      <section className="about-section" id="about">
        <div className="about-photo">
          <LazyImage src="/images/baker.webp" alt={t.photoCaption} />
          <span className="photo-caption">{t.photoCaption}</span>
        </div>
        <div className="about-copy">
          <span className="eyebrow gold">{t.aboutEyebrow}</span>
          <h2>{t.aboutTitle}</h2>
          <p>{t.aboutP1}</p>
          <p>{t.aboutP2}</p>
          <Link to="/about" className="button button-outline">{t.aboutButton} <ArrowRight size={18} aria-hidden="true" /></Link>
          <Branch className="about-branch" />
        </div>
      </section>

      {/* ── Featured products ─────────────────────────────────────────── */}
      <section className="section favorites">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t.sectionFavoritesEyebrow}</span>
              <h2>{t.sectionFavoritesTitle}</h2>
            </div>
            <Link to="/catalog" className="text-link">{t.sectionFavoritesLink} <ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
          <div className="product-grid">
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </section>

      {/* ── Map ───────────────────────────────────────────────────────── */}
      <MapSection />
    </>
  );
}
