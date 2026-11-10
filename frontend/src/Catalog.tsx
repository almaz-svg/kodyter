import {useEffect,useState} from 'react';
import {Link,useParams,useSearchParams} from 'react-router-dom';
import {ArrowLeft,ArrowRight,Search,ShoppingBag,Leaf,Truck} from 'lucide-react';
import {api,money} from './lib';
import type {Product,Category} from './lib';
import {useShop} from './store';
import {ProductCard,PriceTag,Loading,ErrorBox,Qty,CatalogCartSummary,LazyImage} from './ui';
import {useI18n} from './i18n';

export function Catalog() {
  const [params,setParams] = useSearchParams();
  const [products,setProducts] = useState<Product[]>([]);
  const [categories,setCategories] = useState<Category[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [search,setSearch] = useState('');
  const {t} = useI18n();
  const category = params.get('category') || '';

  const load = () => {
    setLoading(true); setError('');
    Promise.all([api<Product[]>('/products/'), api<Category[]>('/categories/')])
      .then(([p,c]) => { setProducts(p); setCategories(c); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const visible = products.filter(p =>
    (!category || String(p.category)===category) &&
    `${p.name} ${p.description}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="container page catalog-page">
      <div className="breadcrumb">
        <Link to="/">{t.breadcrumbHome}</Link><span>/</span>{t.navCatalog}
      </div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t.catalogEyebrow}</span>
          <h1>{t.catalogTitle}</h1>
          <p>{t.catalogDesc}</p>
        </div>
      </div>
      <div className="catalog-toolbar">
        <div className="filter-pills">
          <button className={!category?'active':''} onClick={() => setParams({})}>{t.catalogAll}</button>
          {categories.map(c => (
            <button key={c.id} className={category===String(c.id)?'active':''} onClick={() => setParams({category:String(c.id)})}>
              {c.name}
            </button>
          ))}
        </div>
        <label className="search-box">
          <Search size={19} aria-hidden="true" />
          <input name="search" autoComplete="off" value={search} onChange={e => setSearch(e.target.value)} placeholder={t.searchPlaceholder} aria-label={t.searchPlaceholder}/>
        </label>
      </div>
      <CatalogCartSummary/>
      {loading ? <Loading/> : error ? <ErrorBox message={error} retry={load}/> : (
        <>
          <div className="results-count">{t.resultsCount(visible.length)}</div>
          {visible.length ? (
            <div className="product-grid">{visible.map(p => <ProductCard key={p.id} product={p}/>)}</div>
          ) : (
            <div className="empty-state">
              <Search size={36} aria-hidden="true" />
              <h2>{t.noResults}</h2>
              <p>{t.noResultsSub}</p>
              <button className="button button-green" onClick={() => {setSearch('');setParams({})}}>{t.resetFilters}</button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

export function ProductPage() {
  const {id} = useParams();
  const [product,setProduct] = useState<Product|null>(null);
  const [error,setError] = useState('');
  const [n,setN] = useState(1);
  const {add} = useShop();
  const {t} = useI18n();

  useEffect(() => {
    setProduct(null); setError('');
    api<Product>(`/products/${id}/`).then(setProduct).catch(e => setError(e.message));
  }, [id]);

  return (
    <main className="container page">
      <Link to="/catalog" className="back-link"><ArrowLeft size={16} aria-hidden="true" />{t.navCatalog}</Link>
      {error ? <ErrorBox message={error}/> : !product ? <Loading/> : (
        <div className="product-detail">
          <div className="detail-image">
            <LazyImage src={product.image || '/images/croissant.webp'} alt={product.name} />
          </div>
          <div className="detail-copy">
            <span className="eyebrow">{t.catalogEyebrow}</span>
            <h1>{product.name}</h1>
            <span className={`stock ${product.is_available?'in-stock':''}`}>
              {product.is_available ? 'В наличии' : 'Временно недоступно'}{product.weight?` · ${product.weight}`:''}
            </span>
            <p className="detail-description">{product.description}</p>
            <div className="detail-price"><PriceTag product={product} quantity={n} /></div>
            <div className="buy-row">
              <Qty value={n} presets={[10,20,50,70]} onChange={v => setN(Math.max(1,v))}/>
              <button className="button button-green" disabled={!product.is_available} onClick={() => add(product,n)}>
                <ShoppingBag size={18} aria-hidden="true" />{product.is_available ? t.buy : t.outOfStock}
              </button>
            </div>
            <div className="detail-facts">
              {product.ingredients && <div><h3>Состав</h3><p>{product.ingredients}</p></div>}
              {product.allergens && <div><h3>Аллергены</h3><p>{product.allergens}</p></div>}
              <div className="product-promises">
                <span><Leaf size={18} aria-hidden="true" />{t.benefit4a} {t.benefit4b}</span>
                <span><Truck size={18} aria-hidden="true" />{t.cartDelivery} 1 500 ₸</span>
              </div>
            </div>
            <Link to="/cart" className="text-link">{t.toCartBtn} <ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
        </div>
      )}
    </main>
  );
}
