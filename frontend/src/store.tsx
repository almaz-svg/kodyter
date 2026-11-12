import {createContext,useCallback,useContext,useEffect,useState} from 'react';
import type {ReactNode} from 'react';
import {api,ApiError,getAuthRevision,markAuthChanged,MAX_ORDER_ITEM_QUANTITY,onAuthExpired,unitPrice} from './lib';
import type {Product,User} from './lib';
export interface CartItem {product:Product;quantity:number}
interface Settings {currency:string;delivery_fee:number|string;demo_mode:boolean;payment_method:string}
interface ShopContext {user:User|null;setUser:(u:User|null)=>void;authLoading:boolean;authError:string;cart:CartItem[];add:(p:Product,n?:number)=>void;quantity:(id:number,n:number)=>void;replaceCart:(items:CartItem[])=>void;clear:()=>void;count:number;total:number;settings:Settings|null;settingsError:string;refreshSettings:()=>Promise<Settings>;notice:(text:string)=>void;storageWarning:string;reportStorageFailure:()=>void}
const Context=createContext<ShopContext>(null!);
export function ShopProvider({children}:{children:ReactNode}){
 const [user,setUserState]=useState<User|null>(null),[authLoading,setAuthLoading]=useState(true),[authError,setAuthError]=useState('');
 const [cart,setCart]=useState<CartItem[]>(()=>{try{const data=JSON.parse(localStorage.getItem('anasym-cart')||'[]');return Array.isArray(data)?data.filter((x:CartItem)=>x.product?.id&&Number.isInteger(x.quantity)&&x.quantity>0&&x.quantity<=MAX_ORDER_ITEM_QUANTITY):[]}catch{return []}});
 const [settings,setSettings]=useState<Settings|null>(null),[settingsError,setSettingsError]=useState(''),[toast,setToast]=useState('');
 const [storageWarning,setStorageWarning]=useState('');
 const reportStorageFailure=useCallback(()=>setStorageWarning('Браузер не сохраняет данные. Корзина и попытка оформления доступны только до перезагрузки этой страницы.'),[]);
 const setUser=useCallback((value:User|null)=>{markAuthChanged();setUserState(value);setAuthError('');setAuthLoading(false);},[]);
 async function refreshSettings(){setSettingsError('');try{const updated=await api<Settings>('/settings/');setSettings(updated);return updated}catch(e){setSettingsError((e as Error).message);throw e}}
 useEffect(()=>{
  let alive=true;
  const controller=new AbortController(),revision=getAuthRevision();
  const current=()=>alive&&revision===getAuthRevision();
  const unsubscribe=onAuthExpired(()=>{setUserState(null);setAuthError('');setAuthLoading(false);});
  api<User>('/auth/me/',{signal:controller.signal}).then(value=>{if(current())setUserState(value);}).catch(error=>{
   if(current()&&!controller.signal.aborted&&(!(error instanceof ApiError)||![401,403].includes(error.status)))setAuthError(error.message);
  }).finally(()=>{if(alive&&!controller.signal.aborted)setAuthLoading(false);});
  refreshSettings().catch(()=>{});
  return()=>{alive=false;controller.abort();unsubscribe();};
 },[]);
 useEffect(()=>{try{localStorage.setItem('anasym-cart',JSON.stringify(cart));}catch{reportStorageFailure();}},[cart,reportStorageFailure]);
 // Prices depend on the account (retail for guests and individuals, wholesale for approved businesses). When the account
 // changes, re-read the products in the cart so the displayed prices match what the server will charge. Quantities stay.
 const priceKey = user ? `${user.id}:${user.account_type ?? ''}:${user.business_approved ? 'approved' : 'pending'}` : 'guest';
 useEffect(()=>{
  let alive = true;
  const ids = [...new Set(cart.map(item => item.product.id))];
  if (!ids.length) return;
  Promise.all(ids.map(id => api<Product>(`/products/${id}/`).then(product => [id, product] as const, () => null)))
   .then(pairs => {
    if (!alive) return;
    const fresh = new Map(pairs.filter((pair): pair is readonly [number, Product] => pair !== null));
    setCart(current => current.map(item => fresh.has(item.product.id) ? {...item, product: fresh.get(item.product.id)!} : item));
   });
  return () => {alive = false;};
  // The cart is read once per account change; it is not a dependency on purpose.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[priceKey]);
 useEffect(()=>{if(toast){const timer=setTimeout(()=>setToast(''),3500);return()=>clearTimeout(timer)}},[toast]);
 const add=(product:Product,n=1)=>{if(!product.is_available)return;setCart(current=>{const found=current.find(x=>x.product.id===product.id);return found?current.map(x=>x.product.id===product.id?{product,quantity:Math.min(MAX_ORDER_ITEM_QUANTITY,x.quantity+n)}:x):[...current,{product,quantity:Math.min(MAX_ORDER_ITEM_QUANTITY,n)}]});setToast('Добавлено в корзину');};
 const quantity=(id:number,n:number)=>setCart(current=>n<=0?current.filter(x=>x.product.id!==id):current.map(x=>x.product.id===id?{...x,quantity:Math.min(MAX_ORDER_ITEM_QUANTITY,n)}:x));
 return <Context.Provider value={{user,setUser,authLoading,authError,cart,add,quantity,replaceCart:setCart,clear:()=>setCart([]),count:cart.reduce((s,x)=>s+x.quantity,0),total:cart.reduce((s,x)=>s+unitPrice(x.product,x.quantity)*x.quantity,0),settings,settingsError,refreshSettings,notice:setToast,storageWarning,reportStorageFailure}}>{children}{toast&&<div className="toast" role="status">{toast}</div>}</Context.Provider>;
}
export const useShop=()=>useContext(Context);
