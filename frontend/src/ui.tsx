import { useState, useEffect, useRef } from 'react';
import type { ImgHTMLAttributes } from 'react';
import { ArrowRight, Minus, Plus, LoaderCircle, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { money } from './lib';
import type { Product } from './lib';
import { useShop } from './store';
import { useI18n } from './i18n';

export function Logo({ small = false }: { small?: boolean }) {
  const { t } = useI18n();
  return (
    <Link to="/" className={`brand ${small ? 'brand-small' : ''}`} aria-label="Anasym — на главную">
      <img
        src="/images/Logo.png"
        alt="Anasym"
        className={`brand-logo-img ${small ? 'brand-logo-img-small' : ''}`}
      />
      <span className="brand-text">
        <span className="brand-name">Anasym</span>
        <span className="brand-sub">{t.brandSub}</span>
      </span>
    </Link>
  );
}

const TRANSPARENT_PIXEL = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';

export interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt?: string;
  placeholder?: string;
}

export function LazyImage({
  src,
  alt = '',
  className = '',
  placeholder = TRANSPARENT_PIXEL,
  ...props
}: LazyImageProps) {
  const [inView, setInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.unobserve(entry.target);
            break;
          }
        }
      },
      {
        rootMargin: '250px 0px 250px 0px',
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <img
      ref={imgRef}
      src={inView ? src : placeholder}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`lazy-image ${inView && isLoaded ? 'is-loaded' : 'is-loading'} ${className}`.trim()}
      onLoad={(e) => {
        if (inView && src) {
          setIsLoaded(true);
        }
        props.onLoad?.(e);
      }}
      {...props}
    />
  );
}

export function Ornament() { return <span className="ornament" aria-hidden="true"><span />❖<span /></span> }

export function Branch({ className = '' }: { className?: string }) {
  return (
    <svg className={`branch ${className}`} viewBox="0 0 140 220" fill="none" aria-hidden="true">
      <path d="M16 218Q70 123 104 5M32 184L4 135M45 159L13 103M58 132L31 81M73 100L55 53M88 61L78 23M37 177L97 154M54 146L113 122M70 113L125 85M85 76L131 47" />
      <path d="M5 137q-1 28 27 47Q32 154 5 137Zm9-34q-1 32 31 56Q47 127 14 103Zm17-22q0 30 27 51Q62 102 31 81Zm24-28q-4 28 18 47Q81 69 55 53ZM78 23q-6 24 10 38Q104 33 78 23Zm19 131q-35-1-60 23 37 3 60-23Zm16-32q-39 0-59 24 40 2 59-24Zm12-37q-32 2-55 28 42-2 55-28Zm6-38q-32 1-46 29 38-7 46-29Z" />
    </svg>
  );
}

export function Loading({ text }: { text?: string }) {
  const { t } = useI18n();
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={24} />
      <span>{text ?? t.loading}</span>
    </div>
  );
}

export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="error-box" role="alert">
      <p>{message}</p>
      {retry && <button type="button" className="text-button" onClick={retry}>{t.retry} <ArrowRight size={16} /></button>}
    </div>
  );
}

export function Qty({ value, onChange, label = 'Количество', increaseDisabled = false }: { value: number; onChange: (n: number) => void; label?: string; increaseDisabled?: boolean }) {
  const suffix = label === 'Количество' ? '' : `: ${label}`;
  return (
    <div className="qty" role="group" aria-label={label}>
      <button type="button" aria-label={`Уменьшить количество${suffix}`} onClick={() => onChange(value - 1)}><Minus size={15} /></button>
      <span aria-live="polite" aria-atomic="true">{value}</span>
      <button type="button" aria-label={`Увеличить количество${suffix}`} disabled={value >= 99 || increaseDisabled} onClick={() => onChange(value + 1)}><Plus size={15} /></button>
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const { add, cart, quantity } = useShop();
  const { t } = useI18n();
  const selected = cart.find(item => item.product.id === product.id)?.quantity || 0;
  return (
    <article className="product-card">
      <Link to={`/product/${product.id}`} className="product-image">
        <LazyImage src={product.image || '/images/croissant.webp'} alt={product.name} />
        {!product.is_available && <span className="availability">{t.soonAvail}</span>}
      </Link>
      <div className="product-copy">
        <span className="product-weight">{product.weight || 'Авторский рецепт'}</span>
        <Link to={`/product/${product.id}`}><h3>{product.name}</h3></Link>
        <p>{product.description}</p>
        <div className="product-bottom">
          <div className="product-price-row">
            <strong>{money(product.price)}</strong>
            <span className="product-selected">{selected ? t.inCart(selected) : t.perItem}</span>
          </div>
          {selected > 0 ? (
            <div className="product-purchase">
              <Qty value={selected} label={product.name} increaseDisabled={!product.is_available} onChange={n => n < selected ? quantity(product.id, n) : add(product)} />
              <Link to="/cart" className="product-cart-link">{t.toCart} <ArrowRight size={16} /></Link>
            </div>
          ) : (
            <button type="button" className="button button-green product-buy" onClick={() => add(product)} disabled={!product.is_available} aria-label={product.is_available ? `${t.buy} ${product.name}` : `${product.name} — ${t.outOfStock}`}>
              <ShoppingBag size={17} />
              {product.is_available ? t.buy : t.outOfStock}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function CatalogCartSummary() {
  const { count, total } = useShop();
  const { t } = useI18n();
  if (!count) return null;
  return (
    <aside className="catalog-cart-summary" aria-label={t.selectedItems(count)}>
      <div className="catalog-cart-totals" role="status" aria-live="polite" aria-atomic="true">
        <strong>{t.selectedItems(count)}</strong>
        <span>{money(total)} <small>{t.withoutDelivery}</small></span>
      </div>
      <Link to="/cart" className="button button-green">
        <ShoppingBag size={18} />{t.toCartBtn} <ArrowRight size={16} />
      </Link>
    </aside>
  );
}
