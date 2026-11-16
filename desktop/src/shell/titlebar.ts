// ─────────────────────────────────────────────────────────────────────────────
// 标题栏装配：软件名 / 热键提示 / 窗口置顶 / 主题切换 / 窗口按钮
//
// 无边框窗口（decorations:false），拖拽靠 index.html 上的
// data-tauri-drag-region —— 按钮不带该属性，所以点按钮是点击而非拖窗。
// ─────────────────────────────────────────────────────────────────────────────

import { isTauri } from "@tauri-apps/api/core";
import { el, need } from "./dom";
import { HOTKEY_KEYS } from "./hotkey";
import { resolveTheme, setThemeMode, onThemeChange, type ResolvedTheme } from "./theme";
import { toast } from "./toast";
import {
  hideWindow,
  minimizeWindow,
  onMaximizeChange,
  onPinChange,
  toggleMaximizeWindow,
  togglePinned,
} from "./window";

/**
 * 用注册表里的热键常量**动态建**提示节点，避免和实际注册的加速键漂移。
 *
 * 这个节点不能写死在 index.html 里：Ctrl+Shift+Space 是 Tauri 的**全局**热键
 * （shell/hotkey.ts，经 Rust 侧注册），只在桌面端存在。Web 版（2do.201573.xyz）
 * 根本没注册它，按了没反应。以前把提示写死在 HTML、再由这里在 Web 上 remove，
 * 刷新时 JS 执行前会先闪一下「随时唤起」再消失 —— 现在 Web 端压根不建这个节点，
 * 桌面端才插到置顶按钮前面（见 bindPin 用 need 取同一节点）。
 */
function renderHotkeyHint(): void {
  if (!isTauri()) return;

  const hint = el("div", { class: "hint" });
  HOTKEY_KEYS.forEach((key, index) => {
    if (index > 0) hint.append(document.createTextNode("+"));
    hint.append(el("kbd", { text: key }));
  });
  hint.append(document.createTextNode("随时唤起"));

  need("#tb-pin").before(hint);
}

function bindPin(): void {
  const button = need("#tb-pin");
  button.addEventListener("click", () => {
    void togglePinned().then((pinned) => {
      // 说清楚「置顶」是什么：切成别的应用时它还在最上层，不会被盖住
      toast(pinned ? "已窗口置顶 · 切到别的应用也不会被盖住" : "已取消窗口置顶");
    });
  });

  onPinChange((pinned) => button.classList.toggle("on", pinned));
}

function bindTheme(): void {
  const button = need("#tb-theme");
  const sun = need<SVGSVGElement>(".i-sun", button);
  const moon = need<SVGSVGElement>(".i-moon", button);

  onThemeChange((theme: ResolvedTheme) => {
    sun.style.display = theme === "dark" ? "none" : "block";
    moon.style.display = theme === "dark" ? "block" : "none";
  });

  button.addEventListener("click", () => {
    // 按**当前生效**的明暗取反：sys 模式下点一下也要得到肉眼可见的变化，
    // 所以这里写死 light/dark，而不是在 light→sys→dark 之间轮转。
    setThemeMode(resolveTheme() === "dark" ? "light" : "dark");
  });
}

function bindWindowButtons(): void {
  need("#tb-min").addEventListener("click", () => void minimizeWindow());

  const maxButton = need("#tb-max");
  const maxIcon = need<SVGSVGElement>(".i-max", maxButton);
  const restoreIcon = need<SVGSVGElement>(".i-restore", maxButton);

  maxButton.addEventListener("click", () => void toggleMaximizeWindow());
  onMaximizeChange((maximized) => {
    maxIcon.style.display = maximized ? "none" : "block";
    restoreIcon.style.display = maximized ? "block" : "none";
    maxButton.title = maximized ? "还原" : "最大化";
  });

  // 关闭 = 收起常驻。真正退出走托盘菜单，避免误点把常驻应用杀掉。
  need("#tb-close").addEventListener("click", () => {
    void hideWindow().then(() => toast("已收起到托盘，热键可随时唤回"));
  });
}

export function mountTitlebar(): void {
  renderHotkeyHint();
  bindPin();
  bindTheme();
  bindWindowButtons();
}
