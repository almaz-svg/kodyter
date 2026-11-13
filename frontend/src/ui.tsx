import { useState, useEffect, useRef } from 'react';
import type { ImgHTMLAttributes } from 'react';
import { ArrowRight, Minus, Plus, LoaderCircle, ShoppingBag, Croissant } from 'lucide-react';
import { Link } from 'react-router-dom';
import { money, unitPrice, MAX_ORDER_ITEM_QUANTITY } from './lib';
import type { Product } from './lib';
import { useShop } from './store';
import { useI18n } from './i18n';

export function Logo({ small = false }: { small?: boolean }) {
  const { t } = useI18n();
  return (
    <Link to="/" className={`brand ${small ? 'brand-small' : ''}`} aria-label={t.logoHome}>
      <img
        src="/images/Logo.webp"
        alt="Anaşym"
        width={1403}
        height={1069}
        className={`brand-logo-img ${small ? 'brand-logo-img-small' : ''}`}
      />
      <span className="brand-text">
        <span className="brand-name">Anaşym</span>
        <span className="brand-sub" aria-label={t.brandSub}>{Array.from(t.brandSub).map((ch, i) => <span key={i} aria-hidden="true">{ch}</span>)}</span>
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
      <LoaderCircle className="spin" size={24} aria-hidden="true" />
      <span>{text ?? t.loading}</span>
    </div>
  );
}

export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="error-box" role="alert">
      <p>{message}</p>
      {retry && <button type="button" className="text-button" onClick={retry}>{t.retry} <ArrowRight size={16} aria-hidden="true" /></button>}
    </div>
  );
}

export function Qty({ value, onChange, label = 'Количество', increaseDisabled = false, presets }: { value: number; onChange: (n: number) => void; label?: string; increaseDisabled?: boolean; presets?: number[] }) {
  const suffix = label === 'Количество' ? '' : `: ${label}`;
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  function commit() {
    const parsed = parseInt(draft, 10);
    if (Number.isNaN(parsed)) { setDraft(String(value)); return; }
    const next = Math.max(0, Math.min(MAX_ORDER_ITEM_QUANTITY, parsed));
    if (increaseDisabled && next > value) { setDraft(String(value)); return; }
    setDraft(String(next));
    if (next !== value) onChange(next);
  }
  return (
    <div className="qty-wrap">
      {presets && (
        <div className="qty-presets" role="group" aria-label="Популярное количество">
          {presets.map(p => (
            <button key={p} type="button" className={p === value ? 'active' : ''} disabled={increaseDisabled} onClick={() => onChange(p)}>{p}</button>
          ))}
        </div>
      )}
      <div className="qty" role="group" aria-label={label}>
        <button type="button" aria-label={`Уменьшить количество${suffix}`} onClick={() => onChange(value - 1)}><Minus size={15} aria-hidden="true" /></button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={`Количество${suffix}`}
          value={draft}
          onChange={e => setDraft(e.target.value.replace(/\D/g, '').slice(0, 3))}
          onFocus={e => e.target.select()}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') { commit(); e.currentTarget.blur(); } }}
        />
        <button type="button" aria-label={`Увеличить количество${suffix}`} disabled={value >= MAX_ORDER_ITEM_QUANTITY || increaseDisabled} onClick={() => onChange(value + 1)}><Plus size={15} aria-hidden="true" /></button>
      </div>
    </div>
  );
}

/** The price this line pays at `quantity` units. An approved business sees the wholesale offer as a hint next to it. */
export function PriceTag({ product, quantity }: { product: Product; quantity?: number }) {
  const { t } = useI18n();
  const offer = product.wholesale_price;
  const min = product.wholesale_min_qty;
  if (offer == null || min == null) return <strong>{money(product.price)}</strong>;
  const units = quantity ?? 0;
  const hint = units >= min ? t.wholesaleApplied : units > 0 ? t.wholesaleAddMore(min - units, money(offer)) : t.wholesaleFrom(min, money(offer));
  return (
    <span className="price-tag-wrap">
      <strong>{money(unitPrice(product, units))}</strong>
      <small className="price-offer">{hint}</small>
    </span>
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
            <PriceTag product={product} quantity={selected} />
            <span className="product-selected">{selected ? t.inCart(selected) : t.perItem}</span>
          </div>
          {selected > 0 ? (
            <div className="product-purchase">
              <Qty value={selected} label={product.name} increaseDisabled={!product.is_available} onChange={n => n < selected ? quantity(product.id, n) : add(product, n - selected)} />
              <Link to="/cart" className="product-cart-link">{t.toCart} <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          ) : (
            <button type="button" className="button button-green product-buy" onClick={() => add(product)} disabled={!product.is_available} aria-label={product.is_available ? `${t.buy} ${product.name}` : `${product.name} — ${t.outOfStock}`}>
              <ShoppingBag size={17} aria-hidden="true" />
              {product.is_available ? t.buy : t.outOfStock}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// Home-page card: light by default; on hover or keyboard focus it turns into the "featured" look —
// gold frame, green body under a wave, gold weight ribbon and an outlined Buy button.
export function FeaturedCard({ product }: { product: Product }) {
  const { add, cart, quantity } = useShop();
  const { t } = useI18n();
  const selected = cart.find(item => item.product.id === product.id)?.quantity || 0;
  return (
    <article className="feat-card">
      <Link to={`/product/${product.id}`} className="feat-photo" tabIndex={-1} aria-hidden="true">
        <LazyImage src={product.image || '/images/croissant.webp'} alt="" />
        {product.weight && <span className="feat-pill">{product.weight}</span>}
        {product.weight && <span className="feat-ribbon"><Croissant size={22} strokeWidth={1.4} />{product.weight}</span>}
        {!product.is_available && <span className="availability">{t.soonAvail}</span>}
      </Link>
      <div className="feat-body">
        <svg className="feat-wave" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true">
          <path className="feat-wave-fill" d="M0 22C70 4 140 2 210 14S340 36 400 18V40H0Z" />
          <path className="feat-wave-line" d="M0 22C70 4 140 2 210 14S340 36 400 18" />
        </svg>
        <Link to={`/product/${product.id}`}><h3>{product.name}</h3></Link>
        {product.description && <p>{product.description}</p>}
        <div className="feat-bottom">
          <div className="feat-price">
            <PriceTag product={product} quantity={selected} />
            <span>{selected ? t.inCart(selected) : t.perItem}</span>
          </div>
          {selected > 0 ? (
            <div className="product-purchase">
              <Qty value={selected} label={product.name} increaseDisabled={!product.is_available} onChange={n => n < selected ? quantity(product.id, n) : add(product, n - selected)} />
              <Link to="/cart" className="product-cart-link">{t.toCart} <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          ) : (
            <button type="button" className="feat-buy" onClick={() => add(product)} disabled={!product.is_available} aria-label={product.is_available ? `${t.buy} ${product.name}` : `${product.name} — ${t.outOfStock}`}>
              <ShoppingBag size={18} aria-hidden="true" />
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
        <ShoppingBag size={18} aria-hidden="true" />{t.toCartBtn} <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </aside>
  );
}
