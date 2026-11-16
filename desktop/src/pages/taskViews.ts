// ─────────────────────────────────────────────────────────────────────────────
// 任务页的另外三种视图：日历 / 列表 / 看板。
//
// 它们和甘特是**同一批任务的四种呈现**，不是四个页面：筛选（状态 / 优先级 /
// 搜索）、分区、排序全部由 tasks.ts 统一算好后把 `Task[]` 传进来，这里只管
// 「怎么摆」。所以切视图不用重新筛选，chips 上的数字四视图通用。
//
// 分页口径：
//  · 列表 = 甘特一样按页（表格一屏装不下）；
//  · 日历 / 看板 = 一次摆全部筛选结果（日历按月翻、看板按状态分栏，
//    再分页反而把「一屏看全」这件事切碎了）。
//
// 所有行/卡片都是**单击开抽屉**，与甘特「单击选中、双击打开」不同 —— 这里没有
// 横向条形要拖，单击没有副作用，没必要多按一下。
// ─────────────────────────────────────────────────────────────────────────────

import { PARTITIONS } from "../data/partitions";
import type { Task, TaskStatus } from "../data/types";
import { el } from "../shell/dom";
import {
  DAY_MS,
  STATUS_LABEL,
  TODAY,
  dayNumber,
  isoDay,
  setTaskStatus,
  statusVar,
  urgencyBadge,
} from "./shared";
import { openTask } from "./taskDrawer";

/** 任务页的四个视图。gantt 留在 tasks.ts 里（拖动窗口那套逻辑跟它绑得太紧）。 */
export type TaskView = "gantt" | "calendar" | "list" | "board";

export const VIEW_OPTIONS: { value: TaskView; label: string }[] = [
  { value: "gantt", label: "甘特" },
  { value: "calendar", label: "日历" },
  { value: "list", label: "列表" },
  { value: "board", label: "看板" },
];

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 某任务截止日落在哪一天（绝对天数）。日历按截止日摆，不看创建/开始日。 */
const dueDay = (task: Task): number => dayNumber(task.end);

const partitionName = (task: Task): string =>
  PARTITIONS.find((p) => p.id === task.partition)?.name ?? "—";

/** 状态圆点：和甘特行首、看板栏头同一套色（statusVar）。 */
function statusDot(status: TaskStatus): HTMLElement {
  const dot = el("span", { class: "tv-dot", title: STATUS_LABEL[status] });
  dot.style.background = statusVar(status);
  return dot;
}

function progressBar(task: Task): HTMLElement {
  const bar = el("div", { class: "tv-prog", title: `进度 ${task.progress}%` });
  const fill = el("i");
  fill.style.width = `${Math.max(0, Math.min(100, task.progress))}%`;
  fill.style.background = statusVar(task.status);
  bar.append(fill);
  return bar;
}

// ─── 日历 ────────────────────────────────────────────────────────────────────

/** 日历当前显示的月份（当月 1 号的绝对天数）。模块级：切走再切回来还停在原月。 */
let calMonth = ((): number => {
  const d = new Date(TODAY * DAY_MS);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / DAY_MS);
})();
/** 首次打开才自动定位到「有任务的月份」——之后尊重用户翻到的那一月。 */
let calFirstRender = true;

/**
 * 日历视图。按**截止日**把任务落到格子里；没有截止日的任务不摆进格子
 * （「摆进哪天」没有依据），在头部单独报个数，免得看起来像任务丢了。
 */
export function renderCalendar(tasks: Task[], rerender: () => void): HTMLElement {
  const first = new Date(calMonth * DAY_MS);
  const year = first.getUTCFullYear();
  const month = first.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0=周日
  const weeks = Math.ceil((lead + daysInMonth) / 7);

  const placed = tasks.filter((task) => task.due !== null);
  const noDue = tasks.length - placed.length;

  // 首次打开：演示数据的截止日都排在写死的 9 月，而「今天」是真实时钟（现在 11 月）——
  // 停在当月会看到一张空日历，用户以为任务丢了。所以第一次自动落到**离今天最近的
  // 有任务的那个月**；之后用户翻到哪月就是哪月，不再自作主张（「今天」按钮随时可回）。
  if (calFirstRender && placed.length > 0) {
    calFirstRender = false;
    const nearest = placed.reduce((best, task) =>
      Math.abs(dueDay(task) - TODAY) < Math.abs(dueDay(best) - TODAY) ? task : best,
    );
    const d = new Date(dueDay(nearest) * DAY_MS);
    calMonth = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / DAY_MS);
  }
  const byDay = new Map<number, Task[]>();
  for (const task of placed) {
    const day = dueDay(task);
    const list = byDay.get(day);
    if (list) list.push(task);
    else byDay.set(day, [task]);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.urgency - b.urgency);

  const head = el("div", { class: "tv-cal-head" });
  const title = el("span", { class: "tv-cal-title", text: `${year} 年 ${month + 1} 月` });
  const shift = (delta: number): void => {
    calMonth = Math.floor(Date.UTC(year, month + delta, 1) / DAY_MS);
    rerender();
  };
  const prev = el("button", { class: "navbtn", type: "button", text: "‹", title: "上个月" });
  const next = el("button", { class: "navbtn", type: "button", text: "›", title: "下个月" });
  const today = el("button", { class: "btn sm", type: "button", text: "今天" });
  prev.addEventListener("click", () => shift(-1));
  next.addEventListener("click", () => shift(1));
  today.addEventListener("click", () => {
    const d = new Date(TODAY * DAY_MS);
    calMonth = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / DAY_MS);
    rerender();
  });
  head.append(
    prev,
    title,
    next,
    today,
    el("span", { class: "grow" }),
    el("span", {
      class: "dim mono",
      text: `本月 ${placed.filter((t) => {
        const d = new Date(dueDay(t) * DAY_MS);
        return d.getUTCFullYear() === year && d.getUTCMonth() === month;
      }).length} 条${noDue > 0 ? ` · ${noDue} 条无截止未排入` : ""}`,
    }),
  );

  const grid = el("div", { class: "tv-cal-grid" });
  for (const name of WEEKDAYS) grid.append(el("div", { class: "tv-cal-wd", text: name }));

  const start = calMonth - lead * DAY_MS;
  for (let i = 0; i < weeks * 7; i += 1) {
    const day = start + i;
    const date = new Date(day * DAY_MS);
    const inMonth = date.getUTCMonth() === month && date.getUTCFullYear() === year;
    const cell = el("div", {
      class: `tv-cal-cell${inMonth ? "" : " out"}${day === TODAY ? " today" : ""}`,
      "data-day": isoDay(day),
    });
    cell.append(
      el("span", {
        class: "tv-cal-dn",
        text: String(date.getUTCDate()),
        title: isoDay(day),
      }),
    );
    const list = byDay.get(day) ?? [];
    for (const task of list.slice(0, 3)) {
      const chip = el("button", { class: "tv-cal-chip", type: "button", title: task.title }, [
        statusDot(task.status),
        el("span", { class: "tv-cal-ct", text: task.title }),
      ]);
      chip.addEventListener("click", () => openTask(task.id));
      cell.append(chip);
    }
    if (list.length > 3) {
      cell.append(
        el("span", {
          class: "tv-cal-more",
          text: `+${list.length - 3}`,
          title: `这天还有 ${list.length - 3} 条任务`,
        }),
      );
    }
    grid.append(cell);
  }

  return el("div", { class: "tv-cal" }, [head, grid]);
}

// ─── 列表 ────────────────────────────────────────────────────────────────────

/**
 * 紧凑列表：一屏看更多条，列按「状态 / 优先级 / 截止 / 进度 / 分区」固定。
 * 和甘特共用分页（rows 由调用方切好传进来）。
 */
export function renderList(rows: Task[]): HTMLElement {
  const wrap = el("div", { class: "tv-list" });
  wrap.append(
    el("div", { class: "tv-lh" }, [
      el("span", { text: "任务" }),
      el("span", { text: "状态" }),
      el("span", { text: "优先级" }),
      el("span", { text: "截止" }),
      el("span", { text: "进度" }),
      el("span", { text: "分区" }),
    ]),
  );
  if (rows.length === 0) {
    wrap.append(el("div", { class: "empty", text: "当前筛选下没有任务" }));
    return wrap;
  }
  for (const task of rows) {
    const row = el("div", { class: "tv-lr", "data-task": task.id, title: "单击打开任务" }, [
      el("span", { class: "tv-lt" }, [
        el("span", { class: "tv-ltitle", text: task.title, title: task.title }),
        ...task.tags.slice(0, 2).map((tag) => el("span", { class: "tag", text: tag })),
      ]),
      el("span", { class: "tv-ls" }, [statusDot(task.status), el("span", { text: STATUS_LABEL[task.status] })]),
      urgencyBadge(task.urgency),
      el("span", {
        class: "mono",
        style: task.status === "overdue" ? "color:var(--danger)" : "",
        text: task.due ?? "—",
      }),
      el("span", { class: "tv-lp" }, [progressBar(task), el("span", { class: "mono", text: `${task.progress}%` })]),
      el("span", { class: "dim", text: partitionName(task) }),
    ]);
    row.addEventListener("click", () => openTask(task.id));
    wrap.append(row);
  }
  return wrap;
}

// ─── 看板 ────────────────────────────────────────────────────────────────────

const BOARD_COLUMNS: { status: TaskStatus; hint: string }[] = [
  { status: "doing", hint: "正在推进" },
  { status: "overdue", hint: "已过截止日" },
  { status: "done", hint: "已完成" },
];

/**
 * 看板：按状态分三栏。卡片底部那枚按钮做**状态流转**（doing/overdue → done，
 * done → doing）—— 走 `setTaskStatus` 而不是直接改字段，活动记录会留下这一笔。
 * 流转后 `dataChanged()` 广播，tasks.ts 的 onDataChange 会重绘，这里不用自己刷。
 */
export function renderBoard(tasks: Task[]): HTMLElement {
  const board = el("div", { class: "tv-board" });
  for (const column of BOARD_COLUMNS) {
    const list = tasks.filter((task) => task.status === column.status);
    const col = el("div", { class: "tv-bcol", "data-status": column.status });
    const head = el("div", { class: "tv-bhead" }, [
      statusDot(column.status),
      el("span", { class: "tv-bname", text: STATUS_LABEL[column.status] }),
      el("span", { class: "mono dim", text: String(list.length) }),
      el("span", { class: "grow" }),
      el("span", { class: "dim tv-bhint", text: column.hint }),
    ]);
    head.style.setProperty("--col", statusVar(column.status));
    col.append(head);

    const cards = el("div", { class: "tv-bcards" });
    if (list.length === 0) {
      cards.append(el("div", { class: "tv-bempty", text: "空" }));
    }
    for (const task of list) {
      const card = el("div", {
        class: "tv-bcard",
        "data-task": task.id,
        title: "单击打开任务",
      });
      card.addEventListener("click", () => openTask(task.id));
      const title = el("div", { class: "tv-btitle", text: task.title, title: task.title });
      const meta = el("div", { class: "tv-bmeta" }, [
        urgencyBadge(task.urgency),
        el("span", { class: "dim", text: task.due ? `⏰ ${task.due}` : "无截止" }),
        el("span", { class: "grow" }),
        el("span", { class: "dim", text: partitionName(task) }),
      ]);
      const move = el("button", {
        class: "btn sm tv-bmove",
        type: "button",
        text: column.status === "done" ? "↺ 重启" : "✓ 完成",
        // 默认分区是「完成即归档」，点完卡片会当场离开看板 —— 提前说清，
        // 否则看着像「点了没反应/任务蒸发」
        title: column.status === "done" ? "改回进行中" : "标记已完成（该分区若设了完成即归档，卡片会离开看板）",
      });
      move.addEventListener("click", (event) => {
        event.stopPropagation();
        setTaskStatus(task, column.status === "done" ? "doing" : "done");
      });
      card.append(title, meta, progressBar(task), move);
      cards.append(card);
    }
    col.append(cards);
    board.append(col);
  }
  return board;
}
