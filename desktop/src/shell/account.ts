import { getUser, login, register, logout, onAuthChange, type User } from "../data/auth";
import { syncNow } from "../data/sync";

let button:HTMLButtonElement|null=null;
let user:User|null=null;

function esc(s:string){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));}
function panel(){
  if(document.getElementById("account-overlay")) return;
  const el=document.createElement("div");el.id="account-overlay";el.className="account-overlay";
  el.innerHTML=`<div class="account-card">
    <div class="account-head"><b>Tadado 同步</b><button class="account-x" id="account-x">×</button></div>
    <div id="account-body"></div>
  </div>`;
  document.body.append(el);
  el.querySelector("#account-x")!.addEventListener("click",()=>el.remove());
  renderBody();
}
function renderBody(){
  const body=document.getElementById("account-body");if(!body)return;
  if(user){
    body.innerHTML=`<div class="account-user">${esc(user.email)}</div>
      <div class="account-note">登录后，本设备的任务、进度、标签和活动时间线会自动同步。</div>
      <div class="account-actions"><button class="btn-primary" id="sync-now">立即同步</button><button class="btn-plain" id="logout">退出登录</button></div>
      <div class="account-note" id="sync-msg">云端同步已启用。</div>`;
    body.querySelector("#sync-now")!.addEventListener("click",async()=>{
      const m=document.getElementById("sync-msg");if(m)m.textContent="同步中…";
      await syncNow();if(m)m.textContent="已完成同步。";
    });
    body.querySelector("#logout")!.addEventListener("click",async()=>{await logout();renderBody();});
  }else{
    body.innerHTML=`<div class="account-tabs"><button class="active" id="login-tab">登录</button><button id="register-tab">注册</button></div>
      <form id="account-form">
        <label>邮箱<input id="account-email" type="email" autocomplete="email" required placeholder="you@example.com"></label>
        <label>密码<input id="account-password" type="password" minlength="8" autocomplete="current-password" required placeholder="至少 8 位"></label>
        <button class="btn-primary" type="submit" id="account-submit">登录</button>
        <div class="account-error" id="account-error"></div>
      </form>
      <div class="account-note">不登录也可以继续使用本地数据。登录后才会开启跨设备同步。</div>`;
    let mode:"login"|"register"="login";
    const lt=body.querySelector("#login-tab") as HTMLButtonElement,rt=body.querySelector("#register-tab") as HTMLButtonElement;
    const submit=body.querySelector("#account-submit") as HTMLButtonElement;
    const pw=body.querySelector("#account-password") as HTMLInputElement;
    const setMode=(m:"login"|"register")=>{mode=m;lt.classList.toggle("active",m==="login");rt.classList.toggle("active",m==="register");submit.textContent=m==="login"?"登录":"注册";pw.autocomplete=m==="login"?"current-password":"new-password";};
    lt.addEventListener("click",()=>setMode("login"));rt.addEventListener("click",()=>setMode("register"));
    body.querySelector("#account-form")!.addEventListener("submit",async e=>{
      e.preventDefault();const err=body.querySelector("#account-error") as HTMLElement;err.textContent="";
      const email=(body.querySelector("#account-email") as HTMLInputElement).value.trim(), password=pw.value;
      try{user=mode==="login"?await login(email,password):await register(email,password);renderBody();void syncNow();}
      catch(ex){err.textContent=ex instanceof Error?ex.message:"操作失败";}
    });
  }
}
export function mountAccount(){
  if(!location.protocol.startsWith("http")) return; // 当前同步方案针对 Pages 网页端；桌面 SQLite 保持原样
  button=document.createElement("button");button.className="tb-account";button.id="tb-account";button.title="账号与同步";button.textContent="登录";
  const grow=document.querySelector(".tb-grow");grow?.insertAdjacentElement("afterend",button);
  button.addEventListener("click",panel);
  onAuthChange(u=>{user=u;if(button)button.textContent=u?"同步":"登录";});
  void getUser();
}
