
export interface Env {
  DB: any;
}

const COOKIE = "tadado_session";
const SESSION_DAYS = 30;

function json(data: unknown, status = 200, headers: Record<string,string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {"content-type":"application/json; charset=utf-8", ...headers},
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function base64ToBytes(s: string): Uint8Array {
  // 兼容 base64url（- _）与缺失的 padding：先归一化为标准 base64 再 atob，
  // 否则 atob 会因 "-"/"_" 直接抛 InvalidCharacterError（randomToken 会产生这类字符）。
  let b = s.replaceAll("-", "+").replaceAll("_", "/").replace(/[^A-Za-z0-9+/]/g, "");
  while (b.length % 4) b += "=";
  const bin = atob(b);
  const out = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i);
  return out;
}
function randomToken(bytes=32): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(bytes)))
    .replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}
async function sha256(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64(new Uint8Array(buf));
}
async function passwordHash(password: string, saltB64: string): Promise<string> {
  const salt = base64ToBytes(saltB64);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {name:"PBKDF2", salt, iterations:100000, hash:"SHA-256"}, key, 256
  );
  return bytesToBase64(new Uint8Array(bits));
}
function safeEqual(a:string,b:string): boolean {
  if (a.length !== b.length) return false;
  let x=0; for(let i=0;i<a.length;i++) x |= a.charCodeAt(i)^b.charCodeAt(i);
  return x===0;
}
function getCookie(request: Request, name: string): string | null {
  const raw=request.headers.get("cookie")||"";
  for(const part of raw.split(";")){
    const [k,...rest]=part.trim().split("=");
    if(k===name) return decodeURIComponent(rest.join("="));
  }
  return null;
}
function sessionCookie(token:string,maxAge=SESSION_DAYS*86400): string {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
export async function currentUser(request:Request, env:Env) {
  const token=getCookie(request,COOKIE);
  if(!token) return null;
  const hash=await sha256(token);
  const row=await env.DB.prepare(
    `SELECT u.id,u.email FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.id_hash=? AND s.expires_at>?`
  ).bind(hash,Date.now()).first<{id:string,email:string}>();
  if(!row) return null;
  return row;
}
export {json,randomToken,sha256,passwordHash,safeEqual,sessionCookie};
