import { json, randomToken, passwordHash, sha256, safeEqual, sessionCookie, type Env } from "./_common";

export const onRequestPost = async ({request,env}: {request: Request; env: Env}) => {
  let body:any;
  try { body=await request.json(); } catch { return json({error:"请求格式错误"},400); }
  const email=String(body?.email||"").trim().toLowerCase();
  const password=String(body?.password||"");
  const row=await env.DB.prepare("SELECT id,email,password_hash,salt FROM users WHERE email=?").bind(email)
    .first<{id:string,email:string,password_hash:string,salt:string}>();
  if(!row) return json({error:"邮箱或密码不正确"},401);
  const hash=await passwordHash(password,row.salt);
  if(!safeEqual(hash,row.password_hash)) return json({error:"邮箱或密码不正确"},401);
  const token=randomToken(32), sh=await sha256(token), now=Date.now();
  await env.DB.prepare("INSERT INTO sessions(id_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)")
    .bind(sh,row.id,now+30*86400000,now).run();
  return json({user:{id:row.id,email:row.email}},200,{"set-cookie":sessionCookie(token)});
};
