import {useEffect,useState} from 'react';
import type {ReactNode} from 'react';
import {Link,NavLink,Navigate,Route,Routes,useLocation} from 'react-router-dom';
import {ShoppingBag,UserRound,Menu,X,ArrowRight,Heart,House,LayoutGrid,LogOut,Truck,MapPin} from 'lucide-react';
import Home from './Home';
import {Catalog,ProductPage} from './Catalog';
import {Auth,Cart,Checkout,ResetPassword} from './ShopFlow';
import Portals from './Portals';
import {ShopProvider,useShop} from './store';
import {I18nProvider,useI18n} from './i18n';
import type {Lang} from './i18n';
import {api,roleHome} from './lib';
import {Logo,Loading,ErrorBox,Ornament,LazyImage} from './ui';
import {PrivacyPolicy,PublicOffer,CookieConsent} from './Legal';

/* ── Language Switcher ────────────────────────────────────────────────── */
function LangSwitcher() {
  const {lang, setLang, t} = useI18n();
  const langs: Lang[] = ['kz','ru','en'];
  const labels: Record<Lang,string> = {kz: t.langKz, ru: t.langRu, en: t.langEn};
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
            <span>{user ? `${user.name} · ${t.navAccount}` : t.accountOrLogin}</span>
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
            <LangSwitcher />
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
        <div className="container footer-top">
          <div>
            <Logo />
            <p>{t.footerTagline}</p>
          </div>
          <div className="footer-links">
            <Link to="/catalog">{t.navCatalog}</Link>
            {!courier && <Link to="/about">{t.footerHistory}</Link>}
            {!courier && <Link to="/delivery">{t.footerDelivery}</Link>}
            {!courier && <Link to="/contacts">{t.navContacts}</Link>}
          </div>
          <div className="footer-note">
            <Heart size={22} strokeWidth={1} aria-hidden="true" />
            <span>{t.footerWarm}</span>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Anasym</span>
          <div className="footer-legal-links">
            <Link to="/privacy">{t.footerPrivacy}</Link>
            <span className="footer-sep">·</span>
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
  return (
    <main className="container page info-page">
      <div className="breadcrumb">
        <Link to="/">{t.breadcrumbHome}</Link><span>/</span>{crumb}
      </div>
      <span className="eyebrow">{t.infoAboutEyebrow}</span>
      <h1>{title}</h1>
      <Ornament />
      {type === 'about' ? (
        <div className="info-two">
          <LazyImage src="/images/baker.webp" alt={t.infoAboutH2} />
          <div>
            <h2>{t.infoAboutH2}</h2>
            <p>{t.infoAboutP1}</p>
            <p>{t.infoAboutP2}</p>
            <Link to="/catalog" className="button button-green">{t.infoAboutButton} <ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
        </div>
      ) : type === 'delivery' ? (
        <div className="info-panels">
          <section>
            <Truck />
            <h2>{t.infoDeliveryH2}</h2>
            <p dangerouslySetInnerHTML={{__html: t.infoDeliveryP1}} />
            <p>{t.infoDeliveryP2}</p>
          </section>
          <section>
            <ShoppingBag />
            <h2>{t.infoPaymentH2}</h2>
            <p>{t.infoPaymentP1}</p>
            <p>{t.infoPaymentP2}</p>
          </section>
        </div>
      ) : type === 'contacts' ? (
        <div className="info-panels">
          <section>
            <MapPin />
            <h2>{t.infoAddressH2}</h2>
            <p>{t.infoAddressP}</p>
          </section>
          <section>
            <Heart />
            <h2>{t.infoOrderH2}</h2>
            <p>{t.infoOrderP}</p>
            <Link to="/catalog" className="button button-green">{t.infoOrderButton} <ArrowRight size={18} aria-hidden="true" /></Link>
          </section>
        </div>
      ) : (
        <div className="prose">
          <p>{t.infoPrivacyP1}</p>
          <p>{t.infoPrivacyP2}</p>
          <p>{t.infoPrivacyP3}</p>
        </div>
      )}
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
      <a className="skip-link" href="#main-content">Перейти к содержимому</a>
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
