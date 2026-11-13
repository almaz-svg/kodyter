import {useEffect, useRef} from 'react';
import {MapPin, Clock, Phone, Navigation, ArrowRight, CakeSlice, Leaf, Heart} from 'lucide-react';
import {Branch} from './ui';
import {useI18n} from './i18n';
import './find-section.css';

// Taraz, Konaev St 62a — coordinates
const LAT = 42.8925;
const LNG = 71.3679;
// Contact phone: shown on the contact card; tapping it starts a call.
const CONTACT_PHONE = '+7 778 232 1708';
const CONTACT_PHONE_LINK = 'tel:+77782321708';
// Public 2GIS page for the bakery (it has a route button); the contact card, the map and the footer open it in a new tab.
export const MAP_URL = 'https://2gis.kz/taraz/geo/70000001087635808?inv_by=78675e2a2c264b2d8be2b3b70bc9ca96&inv_ts=1794403437';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch] as string));

export default function MapSection() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<unknown>(null);
  const {t} = useI18n();

  useEffect(() => {
    // React StrictMode runs this effect twice in development. The first run's import can resolve after its cleanup,
    // so a cancelled run must not create a map: two maps on one container throw "Map container is already initialized".
    let cancelled = false;
    import('leaflet').then(mod => {
      const container = mapRef.current;
      if (cancelled || !container || mapInstance.current) return;
      const L = mod.default;
      const map = L.map(container, {
        center: [LAT + 0.0006, LNG],
        zoom: 16,
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      // Branded pin with the logo and a label card above it; the label opens the 2GIS page.
      const icon = L.divIcon({
        className: 'find-marker',
        html: `<a class="find-marker-label" href="${MAP_URL}" target="_blank" rel="noopener noreferrer">`
          + `<span><b>Anasym</b><small>${escapeHtml(t.brandSub.charAt(0) + t.brandSub.slice(1).toLowerCase())}</small></span>`
          + `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></a>`
          + `<span class="find-marker-halo"></span>`
          + `<span class="find-marker-pin"><img src="/images/Logo.webp" alt=""></span>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker([LAT, LNG], {icon, keyboard: false}).addTo(map);
      mapInstance.current = map;
    });
    return () => {
      cancelled = true;
      if (mapInstance.current) {
        (mapInstance.current as {remove: () => void}).remove();
        mapInstance.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="find-section" id="contacts">
      <img className="find-leaves" src="/images/leaves-corner.webp" alt="" aria-hidden="true" loading="lazy" />
      <img className="find-leaves find-leaves-bottom" src="/images/leaves-corner.webp" alt="" aria-hidden="true" loading="lazy" />
      <Branch className="find-branch" />
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
            <div className="find-photo">
              <img src="/images/storefront.webp" alt={`Anasym — ${t.mapAddress}`} loading="lazy" width={935} height={985} />
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
              <a className="find-route" href={MAP_URL} target="_blank" rel="noopener noreferrer">
                <Navigation aria-hidden="true" />{t.mapRoute}<ArrowRight aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="find-side">
            <div className="find-map-card">
              <div className="find-map" ref={mapRef} aria-label={t.mapTitle} />
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
      </div>
    </section>
  );
}
