export type Role = 'CUSTOMER'|'ADMIN'|'COURIER'|'CASHIER';
const roleRoutes:Record<Role,string> = {CUSTOMER:'/account',ADMIN:'/admin',COURIER:'/courier',CASHIER:'/cashier'};
export const roleHome=(role?:Role|null)=>role?roleRoutes[role]:'/account';
export type PaymentStatus = 'UNPAID'|'PAID';
export type AccountType = 'INDIVIDUAL'|'BUSINESS';
export interface User {id:number;name:string;email:string;phone:string;role:Role;is_active:boolean;account_type?:AccountType;company_name?:string;business_approved?:boolean}
/** Unit price for `quantity` units of this product in one order. The server sends wholesale fields only to approved businesses. */
export function unitPrice(product: Product, quantity: number): number {
  const offer = product.wholesale_price;
  const min = product.wholesale_min_qty;
  if (offer != null && min != null && quantity >= min) return Number(offer);
  return Number(product.price);
}

export interface Category {id:number;name:string;slug:string;description:string;image:string;is_visible:boolean}
export interface Product {id:number;category:number;name:string;description:string;image:string;price:number|string;retail_price?:number|string;wholesale_price?:number|string|null;wholesale_min_qty?:number;weight:string;ingredients:string;allergens:string;is_available:boolean;is_visible:boolean}
export interface Order {id:number;number:string;created_at:string;status:string;recipient_name:string;phone:string;address:string;comment:string;subtotal:number|string;delivery_fee:number|string;total:number|string;courier:number|null;courier_name:string|null;cancellation_reason:string;payment_status?:PaymentStatus;paid_at?:string|null;paid_by?:number|null;paid_by_name?:string|null;items:{id:number;product_id:number;name:string;price:number|string;quantity:number;image:string}[];status_history:{id:number;from_status:string|null;to_status:string;created_at:string;actor_name?:string}[];problems:{id:number;message:string;created_at:string;actor_name?:string}[]}
export interface AdminOverview {new:number;unassigned:number;on_the_way:number;unpaid_delivered:number}
export interface CashierSummary {date:string;currency:'KZT';cash_received:number|string;paid_count:number;unpaid_delivered_total:number|string;unpaid_delivered_count:number}
export interface AvailableOrder {id:number;number:string;status:Order['status'];created_at:string;total:number|string;address:string;items_count:number;items:{name:string;quantity:number}[]}
export const statusSteps = ['NEW','CONFIRMED','PREPARING','READY','HANDED_OVER','IN_TRANSIT','DELIVERED'];
export const statusLabel:Record<string,string> = {NEW:'Новый',CONFIRMED:'Подтверждён',PREPARING:'Готовится',READY:'Готов к выдаче',HANDED_OVER:'Передан курьеру',IN_TRANSIT:'В пути',DELIVERED:'Доставлен',CANCELLED:'Отменён'};
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
  if(!headers.has('Content-Type'))headers.set('Content-Type','application/json');
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
