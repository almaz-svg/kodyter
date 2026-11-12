import {useEffect, useId, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft, ArrowRight, ArrowUpRight} from 'lucide-react';
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

export default function CategorySlider({categories, products = []}: {categories: Category[]; products?: Product[]}) {
 const viewport = useRef<HTMLDivElement>(null);
 const list = useRef<HTMLUListElement>(null);
 const viewportId = useId();
 const [position, setPosition] = useState({overflow: false, start: true, end: true});
 const [tick, setTick] = useState(0);

 // Cards cycle through the photos of their own category; reduced-motion users keep the first photo.
 useEffect(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const id = window.setInterval(() => setTick(value => value + 1), ROTATE_MS);
  return () => window.clearInterval(id);
 }, []);

 useEffect(() => {
  const element = viewport.current;
  const content = list.current;
  if (!element || !content) return;
  const update = () => setPosition({
   overflow: element.scrollWidth > element.clientWidth + 2,
   start: element.scrollLeft <= 2,
   end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2,
  });
  update();
  const resize = new ResizeObserver(update);
  resize.observe(element);
  resize.observe(content);
  element.addEventListener('scroll', update, {passive: true});
  return () => {resize.disconnect(); element.removeEventListener('scroll', update);};
 }, [categories]);

 function currentPhoto(category: Category, index: number) {
  const photos = photosFor(category, products, fallbackImages[index % fallbackImages.length]);
  return photos[(tick + index) % photos.length];
 }

 function slide(direction: number) {
  const first = list.current?.firstElementChild as HTMLElement | null;
  const second = first?.nextElementSibling as HTMLElement | null;
  const step = first && second ? second.offsetLeft - first.offsetLeft : first?.offsetWidth || 280;
  viewport.current?.scrollBy({
   left: direction * step,
   behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  });
 }

 if (!categories.length) return null;

 return <div className="category-slider">
  <div className="category-slider-viewport" id={viewportId} ref={viewport}
   role="region" aria-label="Категории изделий" tabIndex={position.overflow ? 0 : undefined}>
   <ul className="category-slide-list" ref={list}>
    {categories.map((category, index) => <li key={category.id}>
     <Link to={`/catalog?category=${category.id}`} className="category-slide" onFocus={event => {
      const visible = viewport.current?.getBoundingClientRect();
      const card = event.currentTarget.getBoundingClientRect();
      if (event.currentTarget.matches(':focus-visible') && visible && (card.left < visible.left || card.right > visible.right)) {
       event.currentTarget.scrollIntoView({block: 'nearest', inline: 'center', behavior: 'instant'});
      }
     }}>
      <LazyImage src={currentPhoto(category, index)} alt={category.name} width={160} height={160}/>
      <span className="category-slide-name">{category.name}</span>
      <ArrowUpRight size={20} aria-hidden="true"/>
     </Link>
    </li>)}
   </ul>
  </div>
  {position.overflow && <div className="category-slider-controls">
   <span>Листайте влево и вправо</span>
   <div>
    <button type="button" aria-label="Предыдущие категории" aria-controls={viewportId}
     disabled={position.start} onClick={() => slide(-1)}><ArrowLeft size={19} aria-hidden="true"/></button>
    <button type="button" aria-label="Следующие категории" aria-controls={viewportId}
     disabled={position.end} onClick={() => slide(1)}><ArrowRight size={19} aria-hidden="true"/></button>
   </div>
  </div>}
 </div>;
}
