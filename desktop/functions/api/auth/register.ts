import { json, randomToken, passwordHash, sha256, sessionCookie, type Env } from "./_common";

export const onRequestPost = async ({request,env}: {request: Request; env: Env}) => {
  let body:any;
  try { body=await request.json(); } catch { return json({error:"请求格式错误"},400); }
  const email=String(body?.email||"").trim().toLowerCase();
  const password=String(body?.password||"");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({error:"请输入有效邮箱"},400);
  if(password.length<8) return json({error:"密码至少 8 位"},400);
  const exists=await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
  if(exists) return json({error:"该邮箱已经注册"},409);
  const id=crypto.randomUUID();
  const salt=randomToken(16);
  const hash=await passwordHash(password,salt);
  const now=Date.now();
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,salt,created_at) VALUES(?,?,?,?,?)")
    .bind(id,email,hash,salt,now).run();
  const token=randomToken(32), sh=await sha256(token);
  await env.DB.prepare("INSERT INTO sessions(id_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)")
    .bind(sh,id,now+30*86400000,now).run();
  return json({user:{id,email}},200,{"set-cookie":sessionCookie(token)});
};
