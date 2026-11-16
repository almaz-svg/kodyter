import {useEffect, useRef, useState} from 'react';
import {MapPin, Clock, Phone, Navigation, CakeSlice, Leaf, Heart, ChevronLeft, ChevronRight} from 'lucide-react';
import {Branch} from './ui';
import {useI18n} from './i18n';
import './find-section.css';

// Taraz, Konaev St 62a — coordinates
const LAT = 42.8925;
const LNG = 71.3679;
// Contact phone: shown on the contact card; tapping it starts a call.
export const CONTACT_PHONE = '+7 747 224 89 03';
export const CONTACT_PHONE_LINK = 'tel:+77472248903';
// Public 2GIS page for the bakery (it has a route button); the contact card, the map and the footer open it in a new tab.
export const MAP_URL = 'https://2gis.kz/taraz/geo/70000001087635808?inv_by=78675e2a2c264b2d8be2b3b70bc9ca96&inv_ts=1794403437';

// Google Maps embed (no API key needed); the pin sits on the bakery's coordinates.
export const mapEmbedUrl = (lang: string) => `https://maps.google.com/maps?q=${LAT},${LNG}&z=17&hl=${lang === 'kz' ? 'kk' : lang === 'en' ? 'en' : 'ru'}&output=embed`;

// Storefront photos in the tilted frame. The track scrolls with snap points, so a finger swipe works natively;
// arrows and dots scroll it too, and the active dot follows the scroll position.
const STOREFRONT_PHOTOS = [
  {src: '/images/storefront-1.webp', position: 'center 32%'},
  {src: '/images/storefront-2.webp', position: 'center 20%'},
];

function StorefrontGallery({alt}: {alt: string}) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const count = STOREFRONT_PHOTOS.length;

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setActive(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener('scroll', onScroll, {passive: true});
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  function go(index: number) {
    const el = track.current;
    if (!el) return;
    const next = (index + count) % count;
    el.scrollTo({left: next * el.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  }

  return (
    <div className="find-photo" role="region" aria-roledescription="carousel" aria-label={alt}>
      <div className="find-photo-track" ref={track} tabIndex={0}
        onKeyDown={event => {
          if (event.key === 'ArrowRight') { event.preventDefault(); go(active + 1); }
          if (event.key === 'ArrowLeft') { event.preventDefault(); go(active - 1); }
        }}>
        {STOREFRONT_PHOTOS.map((photo, index) => (
          <img key={photo.src} src={photo.src} alt={`${alt} — ${index + 1}/${count}`} loading="lazy" width={1080} height={1434}
            style={{objectPosition: photo.position}} aria-hidden={index !== active} />
        ))}
      </div>
      {/* Controls sit bottom-left: on desktop the contact card covers the photo's right side. */}
      <div className="find-photo-controls">
        <button type="button" className="find-photo-nav" onClick={() => go(active - 1)} aria-label="Предыдущее фото"><ChevronLeft aria-hidden="true" /></button>
        <div className="find-photo-dots">
          {STOREFRONT_PHOTOS.map((photo, index) => (
            <button key={photo.src} type="button" className={index === active ? 'active' : ''} onClick={() => go(index)}
              aria-label={`Фото ${index + 1} из ${count}`} aria-current={index === active} />
          ))}
        </div>
        <button type="button" className="find-photo-nav" onClick={() => go(active + 1)} aria-label="Следующее фото"><ChevronRight aria-hidden="true" /></button>
      </div>
    </div>
  );
}

export default function MapSection() {
  const {t, lang} = useI18n();

  return (
    <section className="find-section" id="contacts">
      <img className="find-leaves" src="/images/leaves-corner.webp" alt="" aria-hidden="true" loading="lazy" />
      <img className="find-leaves find-leaves-bottom" src="/images/leaves-corner.webp" alt="" aria-hidden="true" loading="lazy" />
      <Branch className="find-branch" />
      <Branch className="find-branch find-branch-left" />
      <div className="container">
        <header className="find-heading">
          <span className="find-eyebrow"><i />{t.mapEyebrow}<i /></span>
          <h2>{t.mapTitle}</h2>
          <p>{t.mapSubtitle}</p>
        </header>

        <div className="find-layout">
          <div className="find-visual">
            <svg className="find-orbit" viewBox="0 0 600 420" fill="none" aria-hidden="true" preserveAspectRatio="none">
              <ellipse cx="300" cy="210" rx="296" ry="190" transform="rotate(-8 300 210)" />
            </svg>
            <StorefrontGallery alt={`Anasym — ${t.mapAddress}`} />
          </div>

          <div className="find-card">
            <div className="find-card-brand">
              <img src="/images/Logo.webp" alt="" aria-hidden="true" />
              <div>
                <strong>Anasym</strong>
                <span>{t.brandSub}</span>
              </div>
            </div>
            <ul className="find-card-list">
              <li>
                <span className="find-icon"><MapPin aria-hidden="true" /></span>
                <div><small>{t.mapAddressLabel}</small><span>{t.mapAddress}</span></div>
              </li>
              <li>
                <span className="find-icon"><Clock aria-hidden="true" /></span>
                <div><small>{t.mapHours}</small><span>{t.mapHoursValue}</span></div>
              </li>
              <li>
                <span className="find-icon"><Phone aria-hidden="true" /></span>
                <div><small>{t.mapPhone}</small><a href={CONTACT_PHONE_LINK} aria-label={`${t.mapCall}: ${CONTACT_PHONE}`}>{CONTACT_PHONE}</a></div>
              </li>
            </ul>
            <div className="find-actions">
              <a className="find-btn" href={MAP_URL} target="_blank" rel="noopener noreferrer">
                <MapPin aria-hidden="true" />{t.mapRoute}
              </a>
              <a className="find-btn" href={CONTACT_PHONE_LINK}>
                <Phone aria-hidden="true" />{t.mapCall}
              </a>
            </div>
          </div>

          <div className="find-map-card">
            <iframe className="find-map" src={mapEmbedUrl(lang)} title={`${t.mapTitle} — ${t.mapAddress}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
            <a className="find-locate" href={MAP_URL} target="_blank" rel="noopener noreferrer" aria-label={t.mapRoute}>
              <Navigation aria-hidden="true" />
            </a>
          </div>
          <ul className="find-features">
            <li><CakeSlice aria-hidden="true" /><span>{t.mapF1a}<br />{t.mapF1b}</span></li>
            <li><Leaf aria-hidden="true" /><span>{t.mapF2a}<br />{t.mapF2b}</span></li>
            <li><Heart aria-hidden="true" /><span>{t.mapF3a}<br />{t.mapF3b}</span></li>
          </ul>
        </div>
      </div>
    </section>
  );
}
