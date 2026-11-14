import {useEffect,useState} from 'react';
import type {ReactNode} from 'react';
import {Link,NavLink,Navigate,Route,Routes,useLocation} from 'react-router-dom';
import {ShoppingBag,UserRound,Menu,X,ArrowRight,Heart,House,LayoutGrid,LogOut,Truck,MapPin,Clock,Phone} from 'lucide-react';
import Home from './Home';
import {Catalog,ProductPage} from './Catalog';
import {Auth,Cart,Checkout,ResetPassword} from './ShopFlow';
import Portals from './Portals';
import {MAP_URL} from './MapSection';
import AboutPage from './AboutPage';
import DeliveryPage from './DeliveryPage';
import ContactsPage from './ContactsPage';
import {ShopProvider,useShop} from './store';
import {I18nProvider,useI18n} from './i18n';
import type {Lang} from './i18n';
import {api,roleHome} from './lib';
import {Logo,Loading,ErrorBox,Ornament,Branch} from './ui';
import {PrivacyPolicy,PublicOffer,CookieConsent} from './Legal';

/* ── Language Switcher ────────────────────────────────────────────────── */
function LangSwitcher({full = false}: {full?: boolean}) {
  const {lang, setLang, t} = useI18n();
  const langs: Lang[] = ['kz','ru','en'];
  const labels: Record<Lang,string> = {kz: t.langKz, ru: t.langRu, en: t.langEn};
  // Mobile drawer: all three languages side by side, the current one highlighted.
  if (full) {
    const order: Lang[] = ['ru','kz','en'];
    return (
      <div className="lang-switcher lang-switcher-full" role="group" aria-label="Language / Тіл / Язык">
        {order.map(l => (
          <button key={l} type="button" className={`lang-btn${l === lang ? ' lang-active' : ''}`} aria-pressed={l === lang} lang={l === 'kz' ? 'kk' : l} onClick={() => setLang(l)}>
            {labels[l]}
          </button>
        ))}
      </div>
    );
  }
  const next = langs[(langs.indexOf(lang) + 1) % langs.length];
  return (
    <div className="lang-switcher" aria-label="Language / Тіл / Язык">
      <button
        className="lang-btn lang-active"
        onClick={() => setLang(next)}
        title={labels[next]}
      >
        <span key={lang} className="lang-label">{labels[lang]}</span>
      </button>
    </div>
  );
}

/* ── Header ───────────────────────────────────────────────────────────── */
function Header() {
  const {count, user, setUser, notice} = useShop();
  const {t} = useI18n();
  const [menu, setMenu] = useState(false);
  const location = useLocation();

  // Close drawer on page route changes
  useEffect(() => setMenu(false), [location]);

  // Lock body scroll and handle Escape key when mobile drawer is open
  useEffect(() => {
    if (menu) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menu]);

  const account = roleHome(user?.role);
  // Couriers work from the catalog and their own cabinet; shop pages and the cart are not part of their workflow.
  const courier = user?.role === 'COURIER';

  async function logout() {
    try {
      await api('/auth/logout/', {method: 'POST'});
      setUser(null);
      notice(t.loggedOut);
    } catch(e) { notice((e as Error).message); }
  }

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <Logo />
          <nav className="desktop-nav" aria-label={t.navHome}>
            {!courier && <NavLink to="/">{t.navHome}</NavLink>}
            <NavLink to="/catalog">{t.navCatalog}</NavLink>
            {!courier && <NavLink to="/about">{t.navAbout}</NavLink>}
            {!courier && <NavLink to="/delivery">{t.navDelivery}</NavLink>}
            {!courier && <NavLink to="/contacts">{t.navContacts}</NavLink>}
            {courier && <NavLink to={account}>{t.navAccount}</NavLink>}
          </nav>
          <div className="header-actions">
            <Link to={user ? account : '/login'} className="icon-button account-link" aria-label={user ? t.navAccount : t.navLogin}>
              <UserRound size={21} aria-hidden="true" />
            </Link>
            {user && (
              <button className="icon-button logout" onClick={logout} aria-label={t.navLogout}>
                <LogOut size={18} aria-hidden="true" />
              </button>
            )}
            {!courier && (
              <Link to="/cart" className="header-cart" aria-label={t.cartCount(count)}>
                <ShoppingBag size={21} aria-hidden="true" />
                <span className="cart-label">{t.cartLabel}</span>
                {count > 0 && <span className="cart-count">{count}</span>}
              </Link>
            )}
            <LangSwitcher />
            <button
              type="button"
              className={`icon-button menu-toggle ${menu ? 'is-active' : ''}`}
              onClick={() => setMenu(!menu)}
              aria-label={menu ? 'Закрыть меню' : 'Открыть меню'}
              aria-expanded={menu}
            >
              <Menu size={24} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Side Drawer ────────────────────────────────────────── */}
      <div
        className={`mobile-drawer-backdrop ${menu ? 'is-open' : ''}`}
        onClick={() => setMenu(false)}
        aria-hidden="true"
      />
      <aside
        className={`mobile-drawer ${menu ? 'is-open' : ''}`}
        aria-label="Навигация"
        aria-hidden={!menu}
      >
        <div className="mobile-drawer-header">
          <Logo small />
          <button
            type="button"
            className="icon-button mobile-drawer-close"
            onClick={() => setMenu(false)}
            aria-label="Закрыть меню"
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>

        <nav className="mobile-drawer-nav" aria-label="Мобильное меню">
          {!courier && (
            <NavLink to="/" onClick={() => setMenu(false)}>
              <span>{t.navHome}</span>
              <ArrowRight size={17} className="drawer-arrow" aria-hidden="true" />
            </NavLink>
          )}
          <NavLink to="/catalog" onClick={() => setMenu(false)}>
            <span>{t.navCatalog}</span>
            <ArrowRight size={17} className="drawer-arrow" aria-hidden="true" />
          </NavLink>
          {!courier && (
            <NavLink to="/about" onClick={() => setMenu(false)}>
              <span>{t.navAbout}</span>
              <ArrowRight size={17} className="drawer-arrow" aria-hidden="true" />
            </NavLink>
          )}
          {!courier && (
            <NavLink to="/delivery" onClick={() => setMenu(false)}>
              <span>{t.navDelivery}</span>
              <ArrowRight size={17} className="drawer-arrow" aria-hidden="true" />
            </NavLink>
          )}
          {!courier && (
            <NavLink to="/contacts" onClick={() => setMenu(false)}>
              <span>{t.navContacts}</span>
              <ArrowRight size={17} className="drawer-arrow" aria-hidden="true" />
            </NavLink>
          )}

          <div className="mobile-drawer-divider" />

          <NavLink
            to={user ? account : '/login'}
            className="mobile-drawer-account"
            onClick={() => setMenu(false)}
          >
            <UserRound size={19} aria-hidden="true" />
            <span>{user ? t.navAccount : t.accountOrLogin}</span>
          </NavLink>

          {user && (
            <button
              type="button"
              className="mobile-drawer-logout"
              onClick={() => { logout(); setMenu(false); }}
            >
              <LogOut size={18} aria-hidden="true" />
              <span>{t.navLogout}</span>
            </button>
          )}
        </nav>

        <div className="mobile-drawer-footer">
          <div className="mobile-lang-row">
            <LangSwitcher full />
          </div>
          <p className="mobile-drawer-address">{t.mapAddress}</p>
        </div>
      </aside>
    </>
  );
}

/* ── Footer ───────────────────────────────────────────────────────────── */
function Footer() {
  const {user, count} = useShop();
  const {t} = useI18n();
  const courier = user?.role === 'COURIER';
  return (
    <>
      <footer className="site-footer">
        <svg className="footer-wave" viewBox="0 0 1440 54" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 0H1440V30C1200 44 960 16 720 30C480 44 240 14 0 34Z" fill="var(--cream)" />
          <path d="M0 34C240 14 480 44 720 30C960 16 1200 44 1440 30" fill="none" stroke="#d7b779" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <svg className="footer-knot" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 1C15 5 15 8 12 12C9 8 9 5 12 1ZM12 23C9 19 9 16 12 12C15 16 15 19 12 23ZM1 12C5 9 8 9 12 12C8 15 5 15 1 12ZM23 12C19 15 16 15 12 12C16 9 19 9 23 12Z" />
        </svg>
        <Branch className="footer-branch footer-branch-left" />
        <Branch className="footer-branch footer-branch-right" />
        <div className="container footer-grid">
          <div className="footer-col footer-brand">
            <Logo />
            <p className="footer-slogan">{t.footerSlogan}</p>
            <p className="footer-about">{t.footerAbout}</p>
          </div>
          <nav className="footer-col" aria-label={t.footerNavTitle}>
            <h2>{t.footerNavTitle}</h2>
            <ul>
              {!courier && <li><Link to="/">{t.navHome}</Link></li>}
              <li><Link to="/catalog">{t.navCatalog}</Link></li>
              {!courier && <li><Link to="/about">{t.navAbout}</Link></li>}
              {!courier && <li><Link to="/delivery">{t.navDelivery}</Link></li>}
              {!courier && <li><Link to="/contacts">{t.navContacts}</Link></li>}
            </ul>
          </nav>
          {!courier && (
            <nav className="footer-col footer-icon-list" aria-label={t.footerBuyersTitle}>
              <h2>{t.footerBuyersTitle}</h2>
              <ul>
                <li><Link to="/delivery"><Truck size={24} strokeWidth={1.3} aria-hidden="true" />{t.footerDelivery}</Link></li>
                <li><Link to="/cart"><ShoppingBag size={24} strokeWidth={1.3} aria-hidden="true" />{t.cartLabel}</Link></li>
                <li><Link to={roleHome(user?.role)}><UserRound size={24} strokeWidth={1.3} aria-hidden="true" />{t.navAccount}</Link></li>
                <li><Link to="/about"><Heart size={24} strokeWidth={1.3} aria-hidden="true" />{t.footerHistory}</Link></li>
              </ul>
            </nav>
          )}
          <div className="footer-col footer-icon-list">
            <h2>{t.footerContacts}</h2>
            <ul>
              <li><span><MapPin size={24} strokeWidth={1.3} aria-hidden="true" />{t.mapAddress}</span></li>
              <li><span><Clock size={24} strokeWidth={1.3} aria-hidden="true" />{t.mapHoursValue}</span></li>
              <li><span><Phone size={24} strokeWidth={1.3} aria-hidden="true" />+7 778 232 1708</span></li>
            </ul>
            <a href={MAP_URL} target="_blank" rel="noopener noreferrer" className="footer-map-btn">
              <MapPin size={17} aria-hidden="true" />{t.footerFindOnMap}<ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Anaşym. {t.footerRights}</span>
          <div className="footer-legal-links">
            <Link to="/privacy">{t.footerPrivacy}</Link>
            <span className="footer-sep">|</span>
            <Link to="/terms">{t.footerTerms}</Link>
          </div>
        </div>
      </footer>
      <nav className={`bottom-nav ${courier ? 'bottom-nav-courier' : ''}`} aria-label="Мобильная навигация">
        {!courier && <NavLink to="/"><House size={21} aria-hidden="true" /><span>{t.bottomHome}</span></NavLink>}
        <NavLink to="/catalog"><LayoutGrid size={21} aria-hidden="true" /><span>{t.bottomCatalog}</span></NavLink>
        {!courier && (
          <NavLink to="/cart" aria-label={t.cartCount(count)}>
            <span className="bottom-cart-icon">
              <ShoppingBag size={21} aria-hidden="true" />
              {count > 0 && <b className="bottom-cart-count">{count}</b>}
            </span>
            <span>{t.bottomCart}</span>
          </NavLink>
        )}
        <NavLink to={roleHome(user?.role)}>
          <UserRound size={21} aria-hidden="true" />
          <span>{t.bottomAccount}</span>
        </NavLink>
      </nav>
    </>
  );
}

/* ── Protected route ──────────────────────────────────────────────────── */
function Protected({children, customerOnly=false}: {children: ReactNode; customerOnly?: boolean}) {
  const {user, authLoading, authError} = useShop();
  const {t} = useI18n();
  const location = useLocation();
  if (authLoading) return <Loading text={t.loading} />;
  if (authError) return <main className="container page"><ErrorBox message={authError} retry={() => window.location.reload()} /></main>;
  if (!user) return <Navigate to={`/login${location.pathname === '/checkout' ? '?returnTo=/checkout' : ''}`} replace />;
  if (customerOnly && user.role !== 'CUSTOMER') return (
    <main className="container page"><h1>Оформление для покупателя</h1><p>Войдите в аккаунт покупателя, чтобы оформить заказ.</p></main>
  );
  return children;
}

/* ── Account redirect ─────────────────────────────────────────────────── */
function Account() {
  const {user, setUser} = useShop();
  const location = useLocation();
  if (!user) return null;
  const path = roleHome(user.role);
  if (location.pathname !== path) return <Navigate to={path} replace />;
  return <Portals user={user} onUserChange={setUser} />;
}

/* ── Static info pages ────────────────────────────────────────────────── */
function Info({type}: {type: 'about'|'delivery'|'contacts'|'privacy'}) {
  const {t} = useI18n();
  const crumb = type === 'about' ? t.infoAboutCrumb : type === 'delivery' ? t.infoDeliveryCrumb : type === 'contacts' ? t.infoContactsCrumb : t.infoPrivacyCrumb;
  const title = type === 'about' ? t.infoAboutTitle : type === 'delivery' ? t.infoDeliveryTitle : type === 'contacts' ? t.infoContactsTitle : t.infoPrivacyTitle;
  if (type === 'about') return <AboutPage />;
  if (type === 'delivery') return <DeliveryPage />;
  if (type === 'contacts') return <ContactsPage />;
  return (
    <main className="container page info-page">
      <div className="breadcrumb">
        <Link to="/">{t.breadcrumbHome}</Link><span>/</span>{crumb}
      </div>
      <span className="eyebrow">{t.infoAboutEyebrow}</span>
      <h1>{title}</h1>
      <Ornament />
      <div className="prose">
        <p>{t.infoPrivacyP1}</p>
        <p>{t.infoPrivacyP2}</p>
        <p>{t.infoPrivacyP3}</p>
      </div>
    </main>
  );
}

/* ── Shell (hides Header/Footer on auth pages) ────────────────────────── */
const AUTH_PATHS = ['/login', '/reset-password'];

function Shell() {
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  const {t} = useI18n();
  const isAuthPage = AUTH_PATHS.includes(location.pathname);

  return (
    <>
      <a className="skip-link" href="#main-content">{t.skipToContent}</a>
      {!isAuthPage && <Header />}
      <div id="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/checkout" element={<Protected customerOnly><Checkout /></Protected>} />
          {['/account','/admin','/courier','/cashier'].map(path => (
            <Route key={path} path={path} element={<Protected><Account /></Protected>} />
          ))}
          {(['about','delivery','contacts'] as const).map(type => (
            <Route key={type} path={`/${type}`} element={<Info type={type} />} />
          ))}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<PublicOffer />} />
          <Route path="*" element={
            <main className="container page empty-state">
              <h1>{t.notFound}</h1>
              <Link to="/" className="button button-green">{t.toHome}</Link>
            </main>
          } />
        </Routes>
      </div>
      {!isAuthPage && <Footer />}
      <CookieConsent />
    </>
  );
}

/* ── App root ─────────────────────────────────────────────────────────── */
export default function App() {
  return (
    <I18nProvider>
      <ShopProvider>
        <Shell />
      </ShopProvider>
    </I18nProvider>
  );
}
