import { TASKS } from "./mock";
import { PARTITIONS, defaultPartitionId, mergeSyncedPartitions } from "./partitions";
import { loadSetting, saveSetting, saveTasks } from "./db";
import { onDataChange } from "./store";
import type { Task } from "./types";

const STATE_KEY="sync.state.v1";
type State={version:number;tasks:Record<string,{hash:string;at:number}>};
let running=false,suppress=false;
let state:State={version:0,tasks:{}};

function hashText(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}
function taskHash(t:Task){return hashText(JSON.stringify(t))}
function taskMap(tasks:Task[]){const m:Record<string,Task>={};for(const t of tasks)m[t.id]=t;return m}
async function loadState(){const v=await loadSetting<State>(STATE_KEY);if(v&&typeof v.version==="number"&&v.tasks)state=v}
async function saveState(){await saveSetting(STATE_KEY,state)}
async function me(){try{const r=await fetch("/api/auth/me",{credentials:"same-origin"});if(!r.ok)return null;return(await r.json()).user}catch{return null}}

async function push(baseVersion:number){
  const data={tasks:TASKS,partitions:PARTITIONS,defaultPartitionId:defaultPartitionId()};
  return fetch("/api/sync",{method:"PUT",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({baseVersion,data})});
}

export async function syncNow(){
  if(running||suppress)return;
  running=true;
  try{
    if(!(await me()))return;
    for(let attempt=0;attempt<2;attempt++){
      const get=await fetch("/api/sync",{credentials:"same-origin"});
      if(!get.ok)return;
      const cloud=await get.json() as {version:number;data:{tasks:Task[];partitions:any[];defaultPartitionId?:string}|null};
      if(!cloud.data){
        const put=await push(0);
        if(put.ok){const x=await put.json();state={version:x.version,tasks:Object.fromEntries(TASKS.map(t=>[t.id,{hash:taskHash(t),at:Date.now()}]))};await saveState();}
        return;
      }

      // 云端已有数据：同 id 的任务只有在本地自上次同步后发生过变化时才保留本地版本；
      // 否则采用云端版本。两边新增的任务都会保留。
      const local=taskMap(TASKS),remote=taskMap(cloud.data.tasks||[]),merged:Task[]=[];
      const firstSync = state.version === 0;
      const ids=new Set([...Object.keys(local),...Object.keys(remote)]);
      for(const id of ids){
        const l=local[id],r=remote[id];
        if(l&&!r){merged.push(l);continue}
        if(!l&&r){merged.push(r);continue}
        if(l&&r){
          // 第一次在新设备登录时，云端同 id 的记录优先，避免把云端已有任务
          // 被本机刚生成的演示数据覆盖。之后才按「自上次同步以来是否修改」判断。
          if(firstSync){ merged.push(r); continue; }
          const meta=state.tasks[id];
          merged.push(!meta||meta.hash!==taskHash(l)?l:r);
        }
      }

      suppress=true;
      TASKS.length=0;TASKS.push(...merged);
      if(Array.isArray(cloud.data.partitions))mergeSyncedPartitions(cloud.data.partitions);
      saveTasks(TASKS);
      suppress=false;

      const put=await push(cloud.version);
      if(put.status===409)continue;
      if(!put.ok)return;
      const x=await put.json();
      state={version:x.version,tasks:Object.fromEntries(TASKS.map(t=>[t.id,{hash:taskHash(t),at:Date.now()}]))};
      await saveState();
      return;
    }
  }catch(error){console.warn("[tadado] 云同步失败",error)}
  finally{running=false;suppress=false}
}

export async function bootSync(){
  await loadState();
  await syncNow();
  onDataChange(()=>{if(!suppress)void syncNow()});
}
