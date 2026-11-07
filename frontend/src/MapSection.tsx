import {useEffect, useRef} from 'react';
import {MapPin, Clock, Phone} from 'lucide-react';
import {useI18n} from './i18n';

// Taraz, Konaev St 62a — coordinates
const LAT = 42.8925;
const LNG = 71.3679;

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
      L.marker([LAT, LNG])
        .addTo(map)
        .bindPopup(`<strong>Anasym</strong><br/>${t.mapAddress}`)
        .openPopup();
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
                <span className="map-info-label">{t.navContacts}</span>
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
                <p>+7 (727) 000-00-00</p>
              </div>
            </div>
          </div>
          <div className="map-container" ref={mapRef} aria-label={t.mapTitle} />
        </div>
      </div>
    </section>
  );
}
