import { currentUser, json, type Env } from "./auth/_common";

function validData(data:any): data is {tasks:any[],partitions:any[],defaultPartitionId?:string} {
  return data && Array.isArray(data.tasks) && Array.isArray(data.partitions) &&
    data.tasks.length <= 50000 && data.partitions.length <= 1000;
}

export const onRequestGet = async ({request,env}: {request: Request; env: Env}) => {
  const user=await currentUser(request,env);
  if(!user)return json({error:"未登录"},401);
  const row=await env.DB.prepare("SELECT version,data,updated_at FROM snapshots WHERE user_id=?")
    .bind(user.id).first<{version:number,data:string,updated_at:number}>();
  return json(row ? {version:row.version,data:JSON.parse(row.data),updatedAt:row.updated_at} : {version:0,data:null});
};

export const onRequestPut = async ({request,env}: {request: Request; env: Env}) => {
  const user=await currentUser(request,env);
  if(!user)return json({error:"未登录"},401);
  let body:any;
  try{body=await request.json();}catch{return json({error:"请求格式错误"},400);}
  const baseVersion=Number(body?.baseVersion);
  if(!Number.isInteger(baseVersion)||baseVersion<0)return json({error:"版本号错误"},400);
  if(!validData(body?.data))return json({error:"同步数据格式错误"},400);
  const now=Date.now();
  const current=await env.DB.prepare("SELECT version FROM snapshots WHERE user_id=?")
    .bind(user.id).first<{version:number}>();
  const actual=current?.version ?? 0;
  if(actual!==baseVersion){
    const row=await env.DB.prepare("SELECT version,data,updated_at FROM snapshots WHERE user_id=?")
      .bind(user.id).first<{version:number,data:string,updated_at:number}>();
    return json({error:"同步版本冲突",version:actual,data:row?JSON.parse(row.data):null},409);
  }
  const version=actual+1;
  const data=JSON.stringify(body.data);
  await env.DB.prepare(`
    INSERT INTO snapshots(user_id,version,data,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET version=excluded.version,data=excluded.data,updated_at=excluded.updated_at
  `).bind(user.id,version,data,now).run();
  return json({ok:true,version,updatedAt:now});
};
