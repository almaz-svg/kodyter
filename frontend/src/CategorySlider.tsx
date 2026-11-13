import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowUpRight} from 'lucide-react';
import type {Category, Product} from './lib';
import {LazyImage} from './ui';
import './category-slider.css';

const fallbackImages = ['/images/croissant.webp', '/images/cake.webp', '/images/tart.webp', '/images/buns.webp', '/images/catering.webp'];
const ROTATE_MS = 4000;

// Photos for a category card: the distinct images of its own products, or the category photo when it has none.
function photosFor(category: Category, products: Product[], fallback: string): string[] {
 const photos = [...new Set(products.filter(p => p.category === category.id && p.image).map(p => p.image))];
 return photos.length ? photos : [category.image || fallback];
}

// Bento grid of categories: the first card is large, the rest fill a mosaic beside it.
export default function CategorySlider({categories, products = []}: {categories: Category[]; products?: Product[]}) {
 const [tick, setTick] = useState(0);

 // Cards cycle through the photos of their own category; reduced-motion users keep the first photo.
 useEffect(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const id = window.setInterval(() => setTick(value => value + 1), ROTATE_MS);
  return () => window.clearInterval(id);
 }, []);

 function currentPhoto(category: Category, index: number) {
  const photos = photosFor(category, products, fallbackImages[index % fallbackImages.length]);
  return photos[(tick + index) % photos.length];
 }

 if (!categories.length) return null;

 return <ul className={`category-bento${categories.length === 5 ? ' category-bento-5' : ''}`} aria-label="Категории изделий">
  {categories.map((category, index) => <li key={category.id}>
   <Link to={`/catalog?category=${category.id}`} className="category-tile">
    <LazyImage src={currentPhoto(category, index)} alt="" width={640} height={480}/>
    <span className="category-tile-title">
     <span className="category-tile-name">{category.name}</span>
     <svg className="category-tile-swoosh" viewBox="0 0 120 8" aria-hidden="true" preserveAspectRatio="none">
      <path d="M1 7C30 2.5 70 0.8 119 1.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
     </svg>
    </span>
    <span className="category-tile-arrow" aria-hidden="true"><ArrowUpRight size={20}/></span>
   </Link>
  </li>)}
 </ul>;
}
