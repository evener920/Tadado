export interface User { id:string; email:string }
let cached: User|null|undefined;
const listeners=new Set<(u:User|null)=>void>();

async function request(path:string, init:RequestInit={}) {
  const r=await fetch(`/api/${path}`,{...init,credentials:"same-origin",headers:{"content-type":"application/json",...(init.headers||{})}});
  let body:any={}; try{body=await r.json();}catch{}
  if(!r.ok) throw new Error(body.error||`请求失败 (${r.status})`);
  return body;
}
export async function getUser(force=false):Promise<User|null>{
  if(!force&&cached!==undefined)return cached;
  let result: User|null = null;
  try{const body=await request("auth/me",{headers:{}});result=body.user||null;}catch{result=null;}
  cached=result;
  for(const fn of listeners)fn(result);
  return result;
}
export async function login(email:string,password:string):Promise<User|null>{const body=await request("auth/login",{method:"POST",body:JSON.stringify({email,password})});const result:User|null=body.user||null;cached=result;for(const fn of listeners)fn(result);return result;}
export async function register(email:string,password:string):Promise<User|null>{const body=await request("auth/register",{method:"POST",body:JSON.stringify({email,password})});const result:User|null=body.user||null;cached=result;for(const fn of listeners)fn(result);return result;}
export async function logout(){try{await request("auth/logout",{method:"POST",body:"{}"});}finally{cached=null;for(const fn of listeners)fn(null);}}
export function onAuthChange(fn:(u:User|null)=>void){listeners.add(fn);return()=>listeners.delete(fn);}
