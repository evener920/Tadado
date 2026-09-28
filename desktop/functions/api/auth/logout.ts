import { json, currentUser, sha256, type Env } from "./_common";
export const onRequestPost = async ({request,env}: {request: Request; env: Env}) => {
  const user=await currentUser(request,env);
  const cookie=request.headers.get("cookie")||"";
  const m=cookie.match(/(?:^|;\s*)tadado_session=([^;]+)/);
  if(m) await env.DB.prepare("DELETE FROM sessions WHERE id_hash=?").bind(await sha256(decodeURIComponent(m[1]))).run();
  return json({ok:true},200,{"set-cookie":"tadado_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"});
};
