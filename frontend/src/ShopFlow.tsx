import {useEffect,useState} from 'react';
import type {FormEvent} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import {ArrowLeft,ArrowRight,ShoppingBag,Trash2,ShieldCheck,Check,Truck,Croissant,LockKeyhole,UserRound,Store,Eye,EyeOff,Info} from 'lucide-react';
import {api,ApiError,money,roleHome,getCheckoutKey,clearCheckoutKey,unitPrice} from './lib';
import type {Product,Order,User,AccountType} from './lib';
import {useShop} from './store';
import {Qty,ErrorBox,Loading,LazyImage,PriceTag,Branch} from './ui';
import {useI18n} from './i18n';
import {productName} from './productNames';
import './auth.css';

/* ── Cart ─────────────────────────────────────────────────────────────── */
export function Cart() {
  const {cart,quantity,total,settings,settingsError,refreshSettings,storageWarning} = useShop();
  const {t, lang} = useI18n();
  return (
    <main className="container page cart-page">
      <div className="breadcrumb">
        <Link to="/">{t.breadcrumbHome}</Link><span>/</span>{t.cartTitle}
      </div>
      <h1>{t.cartTitle}{cart.length > 0 && <span className="cart-count-badge">{cart.reduce((sum, item) => sum + item.quantity, 0)} {t.cartPieces}</span>}</h1>
      {storageWarning && <p className="error-box" role="status">{storageWarning}</p>}
      {!cart.length ? <EmptyCart /> : (
        <div className="checkout-layout">
          <div className="cart-list">
            {cart.map(({product:p, quantity:n}) => (
              <article className="cart-row" key={p.id}>
                <Link to={`/product/${p.id}`}><LazyImage src={p.image} alt={productName(p, lang)}/></Link>
                <div className="cart-info">
                  <Link to={`/product/${p.id}`}><h3>{productName(p, lang)}</h3></Link>
                  <span><PriceTag product={p} quantity={n}/>{p.weight ? ` · ${p.weight}` : ''}</span>
                  <Qty value={n} onChange={v => quantity(p.id,v)}/>
                </div>
                <div className="cart-row-end">
                  <strong>{money(unitPrice(p,n)*n)}</strong>
                  {n > 1 && <small>{n} × {money(unitPrice(p,n))}</small>}
                  <button className="icon-button remove" aria-label={`Удалить ${productName(p, lang)}`} onClick={() => quantity(p.id,0)}>
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
            <Link to="/catalog" className="back-link"><ArrowLeft size={17} aria-hidden="true" />{t.cartContinue}</Link>
          </div>
          <aside className="order-summary">
            <h2>{t.checkoutOrderTitle}</h2>
            {settingsError && <ErrorBox message={settingsError} retry={() => {refreshSettings().catch(()=>{})}}/>}
            <div className="summary-line"><span>{t.cartItems}</span><span>{money(total)}</span></div>
            <div className="summary-line"><span>{t.cartDelivery}</span><span>{settings ? money(settings.delivery_fee) : t.cartPending}</span></div>
            <div className="summary-total"><span>{t.cartTotal}</span><strong>{settings ? money(total+Number(settings.delivery_fee)) : '—'}</strong></div>
            <Link className="button button-gold full-width" to="/checkout">{t.cartOrder} <ArrowRight size={18} aria-hidden="true" /></Link>
            <p className="summary-note"><ShieldCheck size={17} aria-hidden="true" />{t.cartPayNote}</p>
          </aside>
        </div>
      )}
    </main>
  );
}

function EmptyCart() {
  const {t} = useI18n();
  return (
    <div className="empty-state">
      <ShoppingBag size={44} strokeWidth={1} aria-hidden="true" />
      <h2>{t.cartEmpty}</h2>
      <p>{t.cartEmptyP}</p>
      <Link to="/catalog" className="button button-green">{t.cartToCatalog} <ArrowRight size={17} aria-hidden="true" /></Link>
    </div>
  );
}

/* ── Auth ─────────────────────────────────────────────────────────────── */
export function Auth() {
  const {setUser,user,authLoading,authError} = useShop();
  const {t} = useI18n();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [mode,setMode] = useState<'login'|'register'|'reset'>(params.get('mode')==='register'?'register':'login');
  const [accountType,setAccountType] = useState<AccountType>('INDIVIDUAL');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [sent,setSent] = useState(false);
  const [showPassword,setShowPassword] = useState(false);
  const returnTo = params.get('returnTo')==='/checkout' ? '/checkout' : '/account';

  useEffect(() => {
    if (!authLoading && user) navigate(returnTo==='/checkout' ? returnTo : roleHome(user.role), {replace:true});
  }, [user,authLoading,navigate,returnTo]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (mode === 'reset') {
        await api('/auth/password-reset/', {method:'POST', body:JSON.stringify({email:data.email})});
        setSent(true);
      } else {
        const u = await api<User>(mode==='login' ? '/auth/login/' : '/auth/register/', {method:'POST', body:JSON.stringify(data)});
        setUser(u);
        navigate(returnTo==='/checkout' ? returnTo : roleHome(u.role), {replace:true});
      }
    } catch(e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  if (authLoading) return <Loading text={t.loading}/>;
  if (authError) return <main className="container page"><ErrorBox message={authError} retry={() => window.location.reload()}/></main>;

  return (
    <main className={`auth-page${mode==='register' ? ' auth-page-register' : ''}`}>
      <div className="auth-art">
        <LazyImage key={mode==='register' ? 'cakes' : 'pies'} src={mode==='register' ? '/images/hero-cakes.webp' : '/images/baker.webp'} alt={t.authH2}/>
        <div>
          <span className="eyebrow gold auth-art-eyebrow">{t.authWelcome}<i aria-hidden="true" /></span>
          <h2>{t.authH2}</h2>
        </div>
      </div>
      <div className="auth-content">
        <Branch className="auth-sprig" />
        <Link to="/catalog" className="back-link"><ArrowLeft size={20} aria-hidden="true" />{t.authBack}</Link>
        <div className="auth-form-wrap">
          <span className="eyebrow auth-eyebrow"><i aria-hidden="true" />{t.authEyebrow}<i aria-hidden="true" /></span>
          <h1>{mode==='login' ? t.authLoginTitle : mode==='register' ? t.authRegisterTitle : t.authResetTitle}</h1>
          <p>{returnTo==='/checkout' ? t.authCheckoutSub : mode==='reset' ? t.authResetSub : t.authLoginSub}</p>
          {mode !== 'reset' && (
            <div className="auth-tabs">
              <button className={mode==='login'?'active':''} onClick={() => {setMode('login');setError('')}}>{t.authTabLogin}</button>
              <button className={mode==='register'?'active':''} onClick={() => {setMode('register');setError('')}}>{t.authTabRegister}</button>
            </div>
          )}
          {error && <ErrorBox message={error}/>}
          {sent ? (
            <div className="success-note"><Check size={22} aria-hidden="true" /><p>{t.authSentNote}</p></div>
          ) : (
            <form onSubmit={submit}>
              {mode==='register' && (
                <label>{t.authName}<input name="name" required maxLength={120} autoComplete="name" placeholder={t.authNamePlaceholder}/></label>
              )}
              {mode==='register' && (
                <fieldset className="account-type">
                  <legend>{t.authAccountType}</legend>
                  <div className="account-type-cards">
                    <label className={`account-type-option${accountType==='INDIVIDUAL' ? ' is-selected' : ''}`}>
                      <input type="radio" name="account_type" value="INDIVIDUAL" checked={accountType==='INDIVIDUAL'} onChange={() => setAccountType('INDIVIDUAL')}/>
                      <UserRound className="account-type-icon" strokeWidth={1.4} aria-hidden="true"/>
                      <span className="account-type-text">{t.authAccountIndividual}</span>
                    </label>
                    <label className={`account-type-option${accountType==='BUSINESS' ? ' is-selected' : ''}`}>
                      <input type="radio" name="account_type" value="BUSINESS" checked={accountType==='BUSINESS'} onChange={() => setAccountType('BUSINESS')}/>
                      <Store className="account-type-icon" strokeWidth={1.4} aria-hidden="true"/>
                      <span className="account-type-text">{(() => {
                        const m = t.authAccountBusiness.match(/^(.*?)\s*(\(.*\))$/);
                        return m ? <>{m[1]}<small>{m[2]}</small></> : t.authAccountBusiness;
                      })()}</span>
                    </label>
                  </div>
                  {accountType==='BUSINESS' && (
                    <>
                      <label>{t.authCompanyName}<input name="company_name" required maxLength={160} placeholder={t.authCompanyNamePlaceholder}/></label>
                      <small className="muted">{t.authBusinessNote}</small>
                    </>
                  )}
                </fieldset>
              )}
              <label>{t.authEmail}<input name="email" type="email" autoComplete="email" required placeholder="you@example.com"/></label>
              {mode !== 'reset' && (
                <label>{t.authPassword}
                  <span className="auth-password">
                    <input name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode==='login'?'current-password':'new-password'} required minLength={mode==='register'?10:1} placeholder={mode==='register'?t.authNewPasswordPlaceholder:t.authPasswordPlaceholder}/>
                    <button type="button" className="auth-password-toggle" aria-label={showPassword ? t.authHidePassword : t.authShowPassword} aria-pressed={showPassword} onClick={e => {e.preventDefault(); setShowPassword(v => !v);}}>
                      {showPassword ? <EyeOff size={22} strokeWidth={1.5} aria-hidden="true"/> : <Eye size={22} strokeWidth={1.5} aria-hidden="true"/>}
                    </button>
                  </span>
                </label>
              )}
              {mode==='register' && (
                <>
                  <p className="auth-note"><Info size={20} strokeWidth={1.6} aria-hidden="true"/>{t.authRegisterNote}</p>
                  <p className="auth-legal-consent">
                    {t.authLegalNotice}{' '}
                    <Link to="/terms" target="_blank">{t.footerTerms}</Link>{' '}
                    {t.and}{' '}
                    <Link to="/privacy" target="_blank">{t.footerPrivacy}</Link>.
                  </p>
                </>
              )}
              <button className="button button-green full-width" disabled={busy}>
                {busy ? t.authButtonBusy : mode==='login' ? t.authButtonLogin : mode==='register' ? t.authButtonRegister : t.authButtonReset}
                <ArrowRight size={22} aria-hidden="true" />
              </button>
            </form>
          )}
          {mode !== 'register' && <button className="text-button auth-switch" onClick={() => {setMode(mode==='reset'?'login':'reset');setError('');setSent(false)}}>
            {mode==='reset' ? t.authBackToLogin : t.authForgot}
          </button>}
          <div className="auth-safe"><LockKeyhole size={19} aria-hidden="true" />{t.authSafe}</div>
        </div>
      </div>
    </main>
  );
}

/* ── Reset Password ───────────────────────────────────────────────────── */
export function ResetPassword() {
  const {setUser} = useShop();
  const {t} = useI18n();
  const [params] = useSearchParams();
  const [error,setError] = useState('');
  const [done,setDone] = useState(false);
  const [busy,setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError('');
    const f = new FormData(e.currentTarget);
    try {
      await api('/auth/password-reset-confirm/', {method:'POST', body:JSON.stringify({uid:params.get('uid'),token:params.get('token'),password:f.get('password')})});
      setUser(null); setDone(true);
    } catch(e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <main className="container page narrow-page">
      <h1>{t.newPassword}</h1>
      {done ? (
        <>
          <p>{t.newPasswordDone}</p>
          <Link className="button button-green" to="/login">{t.newPasswordLogin}</Link>
        </>
      ) : (
        <form onSubmit={submit}>
          {error && <ErrorBox message={error}/>}
          <label>{t.newPasswordLabel}<input type="password" name="password" minLength={10} required autoComplete="new-password"/></label>
          <button className="button button-green" disabled={busy}>
            {busy ? t.newPasswordSaving : t.newPasswordSave}
          </button>
        </form>
      )}
    </main>
  );
}

/* ── Checkout ─────────────────────────────────────────────────────────── */
export function Checkout() {
  const {user,cart,total,settings,settingsError,refreshSettings,replaceCart,clear,storageWarning,reportStorageFailure} = useShop();
  const {t, lang} = useI18n();
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [changed,setChanged] = useState(false);
  const [recovery,setRecovery] = useState(false);
  const [success,setSuccess] = useState<Order|null>(null);
  const [refreshing,setRefreshing] = useState(true);
  const [catalogReady,setCatalogReady] = useState(false);
  const [refreshError,setRefreshError] = useState('');
  const [reviewAccepted,setReviewAccepted] = useState(false);
  const [cashAccepted,setCashAccepted] = useState(false);
  const [refreshNotice,setRefreshNotice] = useState('');
  const [recipient,setRecipient] = useState(user?.name||'');
  const [phone,setPhone] = useState(user?.phone||'');
  const [address,setAddress] = useState('');
  const [comment,setComment] = useState('');
  const [attempt,setAttempt] = useState(() => getCheckoutKey());
  const key = attempt.key;

  useEffect(() => { if (!attempt.persisted) reportStorageFailure(); }, [attempt.persisted,reportStorageFailure]);

  async function refreshCheckout(isCurrent: () => boolean = () => true, requireReview = false) {
    setRefreshing(true); setCatalogReady(false); setRefreshError('');
    try {
      const [current,updatedSettings] = await Promise.all([api<Product[]>('/products/'), refreshSettings()]);
      if (!isCurrent()) return;
      const updatedCart = cart.map(item => ({...item, product: current.find(product => product.id===item.product.id) || {...item.product, is_available:false}}));
      const priceChanged = updatedCart.some((item,index) => unitPrice(item.product,item.quantity)!==unitPrice(cart[index].product,cart[index].quantity)) || (settings!==null && Number(updatedSettings.delivery_fee)!==Number(settings.delivery_fee));
      replaceCart(updatedCart); setCatalogReady(true);
      if (priceChanged||requireReview) { setChanged(true); setReviewAccepted(false); setRefreshNotice('Условия заказа изменились. Проверьте цены, доставку и итоговую сумму.'); }
      else if (!changed) setRefreshNotice(updatedCart.some(item => !item.product.is_available) ? 'Некоторые изделия пока недоступны.' : 'Цены и наличие актуальны.');
      if (!recovery) setError('');
    } catch(refreshFailure) { if (isCurrent()) setRefreshError((refreshFailure as Error).message); }
    finally { if (isCurrent()) setRefreshing(false); }
  }

  useEffect(() => { let current = true; void refreshCheckout(() => current); return () => { current = false; }; }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy||refreshing||!catalogReady||recovery||!settings||!cashAccepted||(changed&&!reviewAccepted)||cart.some(item=>!item.product.is_available)) return;
    setBusy(true); setError('');
    try {
      const order = await api<Order>('/orders/', {method:'POST', body:JSON.stringify({recipient_name:recipient,phone,address,comment,items:cart.map(x=>({product_id:x.product.id,quantity:x.quantity,expected_price:unitPrice(x.product,x.quantity).toFixed(2)})),expected_delivery_fee:settings.delivery_fee,idempotency_key:key})});
      setSuccess(order); clear();
      if (!clearCheckoutKey()) reportStorageFailure();
    } catch(e) {
      if (e instanceof ApiError && e.data.code==='IDEMPOTENCY_CONFLICT') {
        setRecovery(true); setError('Предыдущая попытка уже создала заказ. Проверьте свои заказы.');
      } else if (e instanceof ApiError && e.status===409) {
        await refreshCheckout(() => true, true);
      } else { setError((e as Error).message); }
    } finally { setBusy(false); }
  }

  if (success) {
    return (
    <main className="page order-success-page">
      <Branch className="success-bg-branch success-bg-branch-left" />
      <Branch className="success-bg-branch success-bg-branch-right" />
      <div className="container">
        {storageWarning && <p className="error-box" role="status">{storageWarning}</p>}
        <div className="order-success">
          <div className="success-crest">
            <Branch className="success-sprig success-sprig-left" />
            <div className="success-icon"><Check size={34} strokeWidth={2.6} aria-hidden="true" /></div>
            <Branch className="success-sprig success-sprig-right" />
          </div>
          <span className="eyebrow success-eyebrow"><i />{t.successEyebrow}<i /></span>
          <h1>{t.successTitle}</h1>
          <p className="success-number">№ <strong>{success.number}</strong></p>
          <p className="success-text">{t.successP}</p>
          <div className="success-divider" aria-hidden="true"><i /><Croissant size={22} strokeWidth={1.4} /><i /></div>
          <section className="success-receipt" aria-label={t.successDetails}>
            <header><ShoppingBag size={22} strokeWidth={1.6} aria-hidden="true" /><h2>{t.successDetails}</h2><Branch className="success-card-branch" /></header>
            {success.items?.length > 0 && <ul className="success-items">{success.items.map(item => <li key={item.id}><div className="success-item-photo">{item.image ? <LazyImage src={item.image} alt="" /> : <Croissant size={22} strokeWidth={1.4} aria-hidden="true" />}</div><span>{item.name}</span><b>{item.quantity} {t.cartPieces}</b><strong>{money(Number(item.price) * item.quantity)}</strong></li>)}</ul>}
            <div className="success-total"><span>{t.successTotalLabel}</span><strong>{money(success.total)}</strong></div>
            <small className="success-pay"><Truck size={18} strokeWidth={1.6} aria-hidden="true" />{t.successPayNote}</small>
          </section>
          <Link to="/account" className="button success-track">{t.successTrack} <ArrowRight size={18} aria-hidden="true" /></Link>
          <Link to="/catalog" className="success-back">{t.successBack}</Link>
        </div>
      </div>
    </main>
    );
  }

  return (
    <main className="container page checkout-page">
      <Link to="/cart" className="back-link"><ArrowLeft size={16} aria-hidden="true" />{t.checkoutBack}</Link>
      <h1>{t.checkoutTitle}</h1>
      {storageWarning && <p className="error-box" role="status">{storageWarning}</p>}
      {!cart.length ? <EmptyCart/> : (
        <form onSubmit={submit} className="checkout-layout">
          <section className="checkout-form">
            <div className="checkout-card">
            <div className="checkout-step"><span>{t.checkoutStep1}</span><h2>{t.checkoutStep1Title}</h2></div>
            <div className="form-grid">
              <label>{t.checkoutName}<input required name="name" autoComplete="name" maxLength={120} value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder={t.checkoutNamePlaceholder}/></label>
              <label>{t.checkoutPhone}<input type="tel" required name="phone" autoComplete="tel" pattern="[+0-9 \(\)\-]{10,30}" value={phone} onChange={e=>setPhone(e.target.value)} placeholder={t.checkoutPhonePlaceholder}/></label>
            </div>
            </div>
            <div className="checkout-card">
            <div className="checkout-step"><span>{t.checkoutStep2}</span><h2>{t.checkoutStep2Title}</h2></div>
            <label>{t.checkoutAddress}<input required name="address" autoComplete="street-address" minLength={5} maxLength={500} value={address} onChange={e=>setAddress(e.target.value)} placeholder={t.checkoutAddressPl}/></label>
            <label>{t.checkoutComment}<textarea value={comment} maxLength={2000} onChange={e=>setComment(e.target.value)} placeholder={t.checkoutCommentPl} rows={3}/></label>
            <div className="delivery-note">
              <Truck size={22} aria-hidden="true" />
              <div>
                <strong>{t.checkoutDeliveryNote}{settings ? money(settings.delivery_fee) : '…'}</strong>
                <p>{t.checkoutDeliveryDemo}</p>
              </div>
            </div>
            </div>
            <div className="checkout-card">
            <div className="checkout-step"><span>{t.checkoutStep3}</span><h2>{t.checkoutStep3Title}</h2></div>
            <p className="muted">{t.checkoutStep3Note}</p>
            </div>
          </section>
          <aside className="order-summary">
            <h2>{t.checkoutOrderTitle}</h2>
            {(refreshError||settingsError) && <ErrorBox message={refreshError||settingsError}/>}
            <button type="button" className="text-button" disabled={busy||refreshing} onClick={() => {void refreshCheckout()}}>
              {refreshing ? t.checkoutRefreshing : t.checkoutRefreshBtn}
            </button>
            {cart.map(x => (
              <div className="checkout-item" key={x.product.id}>
                <LazyImage src={x.product.image} alt={productName(x.product, lang)}/>
                <div>
                  <span>{productName(x.product, lang)}</span>
                  <small><b>{x.quantity} {t.cartPieces}</b> × {money(unitPrice(x.product,x.quantity))}</small>
                  {!x.product.is_available && <strong className="unavailable-text">Нет в наличии</strong>}
                </div>
                <strong>{money(unitPrice(x.product,x.quantity)*x.quantity)}</strong>
              </div>
            ))}
            <div className="summary-line"><span>{t.checkoutItems}</span><span>{money(total)}</span></div>
            <div className="summary-line"><span>{t.checkoutDelivery}</span><span>{settings ? money(settings.delivery_fee) : '—'}</span></div>
            <div className="summary-total"><span>{t.checkoutTotal}</span><strong>{settings ? money(total+Number(settings.delivery_fee)) : '—'}</strong></div>
            {refreshNotice && <p className="summary-note" role="status">{refreshNotice}</p>}
            {changed && (
              <label className="checkout-review" style={{display:'flex',alignItems:'flex-start',gap:10,margin:'16px 0',fontSize:13,lineHeight:1.5}}>
                <input type="checkbox" checked={reviewAccepted} disabled={refreshing||busy} onChange={e=>setReviewAccepted(e.target.checked)} style={{width:20,minHeight:20,margin:'1px 0 0',flexShrink:0}}/>
                <span>{t.checkoutReviewLabel}</span>
              </label>
            )}
            <label className="checkout-cash-warning">
              <input type="checkbox" checked={cashAccepted} disabled={busy} onChange={e=>setCashAccepted(e.target.checked)}/>
              <span><strong>{t.checkoutCashTitle}{settings ? ` — ${money(total+Number(settings.delivery_fee))}` : ''}</strong>{t.checkoutCashLabel}</span>
            </label>
            {error && <ErrorBox message={error}/>}
            {recovery && (
              <div className="checkout-recovery">
                <Link className="text-link" to="/account">{t.checkoutMyOrders}</Link>
                <button type="button" className="text-button" onClick={() => {setAttempt(getCheckoutKey(true));setRecovery(false);setError('')}}>
                  {t.checkoutNewOrder}
                </button>
              </div>
            )}
            <button className="button button-green full-width" disabled={busy||refreshing||!catalogReady||recovery||!settings||!cashAccepted||(changed&&!reviewAccepted)||cart.some(x=>!x.product.is_available)}>
              {busy ? t.checkoutBtnBusy : refreshing ? t.checkoutBtnChecking : changed ? t.checkoutBtnUpdated : t.checkoutBtnConfirm}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <p className="summary-note"><ShieldCheck size={16} aria-hidden="true" />{t.checkoutPayNote}</p>
            <p className="checkout-legal-consent">
              {t.checkoutLegalNotice}{' '}
              <Link to="/terms" target="_blank">{t.footerTerms}</Link>{' '}
              {t.and}{' '}
              <Link to="/privacy" target="_blank">{t.footerPrivacy}</Link>.
            </p>
          </aside>
        </form>
      )}
    </main>
  );
}
