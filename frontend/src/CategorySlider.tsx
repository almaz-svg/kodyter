import {useEffect, useState} from 'react';
import type React from 'react';
import {Link} from 'react-router-dom';
import {ArrowUpRight} from 'lucide-react';
import type {Category, Product} from './lib';
import {useI18n,categoryName} from './i18n';
import './category-slider.css';

const fallbackImages = ['/images/croissant.webp', '/images/cake.webp', '/images/tart.webp', '/images/buns.webp', '/images/catering.webp'];
const ROTATE_MS = 5000;

// Photos for a category card: the distinct images of its own products, or the category photo when it has none.
function photosFor(category: Category, products: Product[], fallback: string): string[] {
 const photos = [...new Set(products.filter(p => p.category === category.id && p.image).map(p => p.image))];
 return photos.length ? photos : [category.image || fallback];
}

// Bento grid of categories: the first card is large, the rest fill a mosaic beside it.
export default function CategorySlider({categories, products = []}: {categories: Category[]; products?: Product[]}) {
 const [tick, setTick] = useState(0);
 const {lang} = useI18n();

 // Cards cycle through the photos of their own category; reduced-motion users keep the first photo.
 useEffect(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const id = window.setInterval(() => setTick(value => value + 1), ROTATE_MS);
  return () => window.clearInterval(id);
 }, []);

 const photoSets = categories.map((category, index) => photosFor(category, products, fallbackImages[index % fallbackImages.length]));

 // Warm the browser cache with each card's next photo, so the cross-fade never starts on an empty image.
 useEffect(() => {
  photoSets.forEach((photos, index) => {
   if (photos.length > 1) { const img = new Image(); img.src = photos[(tick + index + 1) % photos.length]; }
  });
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [tick, products, categories]);

 if (!categories.length) return null;

 return <ul className={`category-bento${categories.length === 5 ? ' category-bento-5' : ''}`} aria-label="Категории изделий">
  {categories.map((category, index) => <li key={category.id}>
   <Link to={`/catalog?category=${category.id}`} className="category-tile">
    {/* The previous photo stays underneath while the new one fades in on top; cards change one after another. */}
    <span className="category-tile-media" style={{'--tile-i': index} as React.CSSProperties}>
     {(() => {
      const photos = photoSets[index];
      const current = photos[(tick + index) % photos.length];
      const previous = photos.length > 1 && tick > 0 ? photos[(tick + index - 1) % photos.length] : null;
      return <>
       {previous && previous !== current && <img key={previous} src={previous} alt="" width={640} height={480} decoding="async" />}
       <img key={current} src={current} alt="" width={640} height={480} decoding="async" loading={tick === 0 ? 'lazy' : undefined}
        className={previous && previous !== current ? 'is-entering' : undefined} />
      </>;
     })()}
    </span>
    <span className="category-tile-title">
     <span className="category-tile-name">{categoryName(category, lang)}</span>
     <svg className="category-tile-swoosh" viewBox="0 0 120 8" aria-hidden="true" preserveAspectRatio="none">
      <path d="M1 7C30 2.5 70 0.8 119 1.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
     </svg>
    </span>
    <span className="category-tile-arrow" aria-hidden="true"><ArrowUpRight size={20}/></span>
   </Link>
  </li>)}
 </ul>;
}
