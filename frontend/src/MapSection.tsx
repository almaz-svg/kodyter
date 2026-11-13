import {useEffect, useRef} from 'react';
import {MapPin, Clock, Phone} from 'lucide-react';
import {useI18n} from './i18n';

// Taraz, Konaev St 62a — coordinates
const LAT = 42.8925;
const LNG = 71.3679;
// Contact phone: shown on the map card and used by the "Позвонить" button.
const CONTACT_PHONE = '+7 778 232 1708';
const CONTACT_PHONE_LINK = 'tel:+77782321708';
// Public 2GIS page for the bakery; the map card and the footer open it in a new tab.
export const MAP_URL = 'https://2gis.kz/taraz/geo/70000001087635808?inv_by=78675e2a2c264b2d8be2b3b70bc9ca96&inv_ts=1794403437';

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
      // Fix leaflet default icon path issues with bundlers
      // @ts-expect-error leaflet internals
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      const map = L.map(container, {
        center: [LAT, LNG],
        zoom: 16,
        scrollWheelZoom: false,
        zoomControl: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      const marker = L.marker([LAT, LNG])
        .addTo(map)
        .bindPopup(`<strong>Anasym</strong><br/>${t.mapAddress}<br/><a class="map-popup-link" href="${MAP_URL}" target="_blank" rel="noopener noreferrer">${t.mapFindOnMap}</a>`, {closeButton: false});
      // On phones the open popup would cover the pin and most of the small map, so it opens on tap instead.
      if (!window.matchMedia('(max-width: 600px)').matches) marker.openPopup();
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
    <section className="map-section section">
      <div className="container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t.mapEyebrow}</span>
            <h2>{t.mapTitle}</h2>
          </div>
        </div>
        <div className="map-layout">
          <div className="map-info">
            <div className="map-info-row">
              <MapPin size={20} className="map-icon" aria-hidden="true" />
              <div>
                <span className="map-info-label">{t.mapAddressLabel}</span>
                <p>{t.mapAddress}</p>
              </div>
            </div>
            <div className="map-info-row">
              <Clock size={20} className="map-icon" aria-hidden="true" />
              <div>
                <span className="map-info-label">{t.mapHours}</span>
                <p>{t.mapHoursValue}</p>
              </div>
            </div>
            <div className="map-info-row">
              <Phone size={20} className="map-icon" aria-hidden="true" />
              <div>
                <span className="map-info-label">{t.mapPhone}</span>
                <p>{CONTACT_PHONE}</p>
              </div>
            </div>
            <div className="map-actions">
              <a className="map-call" href={CONTACT_PHONE_LINK}>
                <Phone size={17} aria-hidden="true" />{t.mapCall}
              </a>
              <a className="map-call" href={MAP_URL} target="_blank" rel="noopener noreferrer">
                <MapPin size={17} aria-hidden="true" />{t.mapFindOnMap}
              </a>
            </div>
          </div>
          <div className="map-container" ref={mapRef} aria-label={t.mapTitle} />
        </div>
      </div>
    </section>
  );
}
