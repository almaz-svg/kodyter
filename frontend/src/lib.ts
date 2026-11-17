export type Role = 'CUSTOMER'|'ADMIN'|'COURIER'|'CASHIER'|'PASTRY';
/** Largest number of units of one product in one order line. The server enforces the same value (MAX_ORDER_ITEM_QUANTITY). */
export const MAX_ORDER_ITEM_QUANTITY = 200;
const roleRoutes:Record<Role,string> = {CUSTOMER:'/account',ADMIN:'/admin',COURIER:'/courier',CASHIER:'/cashier',PASTRY:'/pastry'};
export const roleHome=(role?:Role|null)=>role?roleRoutes[role]:'/account';
export type PaymentStatus = 'UNPAID'|'PAID'|'DEBT';
export type AccountType = 'INDIVIDUAL'|'BUSINESS';
export interface User {wholesale_min_qty?:number|null;id:number;name:string;email:string;phone:string;role:Role;is_active:boolean;account_type?:AccountType;company_name?:string;business_approved?:boolean}
/** Unit price for `quantity` units of this product in one order. The server sends wholesale fields only to approved businesses. */
export function unitPrice(product: Product, quantity: number): number {
  const offer = product.wholesale_price;
  const min = product.wholesale_min_qty;
  if (offer != null && min != null && quantity >= min) return Number(offer);
  return Number(product.price);
}

export interface Category {id:number;name:string;slug:string;description:string;image:string;is_visible:boolean}
export interface Product {id:number;category:number;name:string;description:string;image:string;price:number|string;retail_price?:number|string;wholesale_price?:number|string|null;wholesale_min_qty?:number|null;weight:string;pieces?:number|null;ingredients:string;allergens:string;is_available:boolean;is_visible:boolean}
export interface Order {id:number;number:string;created_at:string;status:string;recipient_name:string;phone:string;address:string;comment:string;subtotal:number|string;delivery_fee:number|string;total:number|string;courier:number|null;courier_name:string|null;courier_is_active?:boolean|null;cancellation_reason:string;payment_status?:PaymentStatus;paid_at?:string|null;paid_by?:number|null;paid_by_name?:string|null;on_credit?:boolean;credit_at?:string|null;credit_by_name?:string;customer_name?:string;customer_company?:string;credit_allowed?:boolean;items:{id:number;product_id:number;name:string;price:number|string;retail_price?:number|string|null;is_wholesale?:boolean;quantity:number;image:string;is_prepared?:boolean;is_missing?:boolean}[];status_history:{id:number;from_status:string|null;to_status:string;created_at:string;actor_name?:string}[];problems:{id:number;message:string;created_at:string;actor_name?:string}[]}
export interface AdminOverview {new:number;unassigned:number;on_the_way:number;unpaid_delivered:number}
export interface DebtOrder {id:number;number:string;created_at:string;credit_at:string|null;total:string;address:string;recipient_name:string;phone:string;courier_name:string;credit_by_name:string;payment_status:'DEBT'|'PAID';paid_at:string|null;paid_by_name:string}
export interface DebtCustomer {id:number;name:string;email:string;phone:string;account_type:string;company_name:string;debt_total:string;debt_count:number;paid_total:string;paid_count:number;orders:DebtOrder[]}
export interface Debts {state:'open'|'paid'|'all';customers:DebtCustomer[];open_total:string;open_count:number;paid_total:string;paid_count:number}
export interface MyDebt {total:string;count:number;orders:{id:number;number:string;total:string;credit_at:string|null}[]}
export interface CashierSummary {date:string;currency:'KZT';cash_received:number|string;paid_count:number;unpaid_delivered_total:number|string;unpaid_delivered_count:number;debt_total?:number|string;debt_count?:number;in_delivery_total?:number|string;in_delivery_count?:number;in_delivery_orders?:{id:number;number:string;status:string;total:string;address:string;courier_name:string}[];orders_total:number|string;orders_count:number;items_count:number;cancelled_count:number;pending_total?:number|string;pending_count?:number;debt_paid_total?:number|string;debt_paid_count?:number}
export interface TeamOrder {customer_company?:string;id:number;number:string;status:Order['status'];created_at:string;total:number|string;address:string;items_count:number;courier:number;courier_name:string}
export interface TeamOrders {orders:TeamOrder[];couriers:{id:number;name:string}[]}
export interface AvailableOrder {customer_company?:string;id:number;number:string;status:Order['status'];created_at:string;total:number|string;address:string;items_count:number;items:{name:string;quantity:number}[]}
export const statusSteps = ['NEW','CONFIRMED','PREPARING','READY','HANDED_OVER','IN_TRANSIT','DELIVERED'];
export const statusLabel:Record<string,string> = {NEW:'Новый',CONFIRMED:'Подтверждён',PREPARING:'Готовится',READY:'Готов к выдаче',HANDED_OVER:'Передан курьеру',IN_TRANSIT:'В пути',DELIVERED:'Доставлен',CANCELLED:'Отменён'};
// Weight as typed in the admin panel; a bare number such as "120" gets the gram unit.
export const formatWeight=(weight:string|null|undefined,unit='г')=>{const value=(weight||'').trim();return /^\d+(?:[.,]\d+)?$/.test(value)?`${value} ${unit}`:value};
// "120 г · 6 шт.": weight and pieces of one item, whichever are set.
export const productSize=(product:{weight?:string;pieces?:number|null},weightUnit='г',piecesUnit='шт.')=>[formatWeight(product.weight,weightUnit),product.pieces?`${product.pieces} ${piecesUnit}`:''].filter(Boolean).join(' · ');
export const money=(value:number|string)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(value))+' ₸';
const fieldNames:Record<string,string>={email:'Почта',password:'Пароль',name:'Имя',recipient_name:'Имя получателя',phone:'Телефон',address:'Адрес',price:'Цена',category:'Категория',image:'Фотография',non_field_errors:''};
function errorText(value:unknown):string {if(Array.isArray(value))return value.map(errorText).join(' ');if(value&&typeof value==='object')return Object.values(value).map(errorText).join(' ');return String(value??'')}
export class ApiError extends Error {status:number;data:Record<string,unknown>;constructor(status:number,data:Record<string,unknown>){const fields=Object.entries(data).filter(([k])=>k!=='detail'&&k!=='code').map(([k,v])=>`${fieldNames[k]??k}${fieldNames[k]===''?'':': '}${errorText(v)}`).join(' ');const details=fields||errorText(data.detail);super(details||'Не удалось выполнить запрос. Попробуйте ещё раз.');this.status=status;this.data=data}}
let csrfToken='';
let authRevision=0;
const expiredListeners=new Set<()=>void>();
export const getAuthRevision=()=>authRevision;
export function markAuthChanged(){authRevision+=1;csrfToken='';}
export function onAuthExpired(listener:()=>void){expiredListeners.add(listener);return()=>{expiredListeners.delete(listener);};}

const REQUEST_TIMEOUT_MS=15000;
let activeAuthRequest:AbortController|null=null;
async function requestJson(url:string,options:RequestInit={}):Promise<unknown>{
 const controller=new AbortController();
 const callerSignal=options.signal;
 if(callerSignal?.aborted)throw new DOMException('Запрос отменён.','AbortError');
 let abortError:Error|null=null;
 let rejectCancellation:(error:Error)=>void=()=>{};
 const cancellation=new Promise<never>((_,reject)=>{rejectCancellation=reject;});
 const cancel=(error:Error)=>{abortError=error;rejectCancellation(error);controller.abort();};
 const abort=()=>cancel(new DOMException('Запрос отменён.','AbortError'));
 callerSignal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>cancel(new Error('Время ожидания ответа истекло. Проверьте подключение и повторите действие.')),REQUEST_TIMEOUT_MS);
 try{
  return await Promise.race([(async()=>{
   let response:Response;
   try{response=await fetch(url,{...options,credentials:'include',signal:controller.signal});}
   catch{throw abortError||new Error('Нет соединения с сервером. Проверьте подключение и повторите попытку.');}
   let data:unknown=null;
   if(response.status!==204){
    try{data=await response.json();}
    catch{throw abortError||new ApiError(response.status,{detail:'Сервер вернул некорректный ответ. Повторите позже.'});}
   }
   if(!response.ok)throw new ApiError(response.status,(data&&typeof data==='object'?data:{detail:'Не удалось выполнить запрос.'}) as Record<string,unknown>);
   return data;
  })(),cancellation]);
 }finally{clearTimeout(timer);callerSignal?.removeEventListener('abort',abort);}
}

export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
 if(options.signal?.aborted)throw new DOMException('Запрос отменён.','AbortError');
 const method=options.method?.toUpperCase()||'GET';
 const mutation=!['GET','HEAD','OPTIONS'].includes(method);
 const changesIdentity=mutation&&['/auth/login/','/auth/register/','/auth/logout/','/auth/password-reset-confirm/'].includes(path);
 let authController:AbortController|null=null;
 let detachCaller=()=>{};
 if(changesIdentity){
  activeAuthRequest?.abort();
  authController=new AbortController();activeAuthRequest=authController;
  const callerSignal=options.signal,controller=authController;
  const abort=()=>controller.abort();
  callerSignal?.addEventListener('abort',abort,{once:true});
  if(callerSignal?.aborted)controller.abort();
  detachCaller=()=>callerSignal?.removeEventListener('abort',abort);
  options={...options,signal:controller.signal};
  markAuthChanged();
 }
 const revision=authRevision;
 try{
  if(mutation&&!csrfToken){
   const data=await requestJson('/api/auth/csrf/',{signal:options.signal}) as {csrfToken?:unknown};
   if(revision!==authRevision)throw new Error('Аккаунт изменился. Повторите действие после входа.');
   if(typeof data?.csrfToken!=='string'||!data.csrfToken)throw new Error('Не удалось установить защищённое соединение. Повторите попытку.');
   csrfToken=data.csrfToken;
  }
  const headers=new Headers(options.headers);
  // A FormData body (photo upload) sets its own multipart Content-Type; JSON is the default for everything else.
  if(!(options.body instanceof FormData)&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
  if(mutation)headers.set('X-CSRFToken',csrfToken);
  const data=await requestJson(`/api${path}`,{...options,headers});
  if(changesIdentity){
   if(revision!==authRevision)throw new DOMException('Аккаунт изменился.','AbortError');
   markAuthChanged();
  }
  return data as T;
 }catch(error){
  // A response from the previous identity must not sign out a newer login.
  if(error instanceof ApiError&&revision===authRevision){
   if(error.status===403)csrfToken='';
   if(error.status===401){markAuthChanged();expiredListeners.forEach(listener=>listener());}
  }
  throw error;
 }finally{detachCaller();if(authController&&activeAuthRequest===authController)activeAuthRequest=null;}
}

let checkoutKeyLoaded=false;
let checkoutKey:string|null=null;
export function getCheckoutKey(renew=false):{key:string;persisted:boolean}{
 let persisted=true;
 if(!checkoutKeyLoaded&&!renew){try{checkoutKey=sessionStorage.getItem('anasym-checkout-key');}catch{persisted=false;}}
 checkoutKeyLoaded=true;
 if(renew||!checkoutKey)checkoutKey=crypto.randomUUID();
 try{sessionStorage.setItem('anasym-checkout-key',checkoutKey);}catch{persisted=false;}
 return {key:checkoutKey,persisted};
}
export function clearCheckoutKey():boolean{
 checkoutKeyLoaded=true;checkoutKey=null;
 try{sessionStorage.removeItem('anasym-checkout-key');return true;}catch{return false;}
}
