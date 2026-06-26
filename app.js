/*
  暑期修煉錄 — 核心引擎
  =================================================
  負責「資料」與「畫面」：從手機本機讀資料、你操作時更新、再重畫並存回。
  資料只存在你這支手機（localStorage），不上傳。
*/

const SAVE_KEY = "summer-quest-v1";   // 沿用舊鍵，既有打卡資料不會不見
const MOODS = ["😀", "🙂", "😐", "😫", "😴"];

// 三類功課
const CATEGORIES = {
  learn: { label: "問道（想學）" },
  work:  { label: "勤修（想做）" },
  fun:   { label: "遊歷（想玩）" },
};

// 境界階梯：每滿 100 修為晉一重
const JINGJIE = ["練氣", "築基", "金丹", "元嬰", "化神", "煉虛", "合體", "大乘", "渡劫", "飛昇"];

const XP_PER_TASK = 10;       // 每完成一項功課
const XP_PER_DAY  = 5;        // 每有修煉的一日

// 成就（道行）：cond＝達成條件文案；prog＝目前進度 {cur,max}
const BADGES = [
  { id: "first",   icon: "ic-sprout",  name: "初心",     cond: "完成第一項功課",        prog: s => ({ cur: Math.min(totalDoneCount(s), 1), max: 1 }) },
  { id: "streak3", icon: "ic-flame",   name: "三日不輟", cond: "連續修煉 3 日",          prog: s => ({ cur: Math.min(calcStreak(s), 3), max: 3 }) },
  { id: "streak7", icon: "ic-bolt",    name: "七日精進", cond: "連續修煉 7 日",          prog: s => ({ cur: Math.min(calcStreak(s), 7), max: 7 }) },
  { id: "done10",  icon: "ic-medal",   name: "百尺竿頭", cond: "累計完成 10 項功課",      prog: s => ({ cur: Math.min(totalDoneCount(s), 10), max: 10 }) },
  { id: "jindan",  icon: "ic-pill",    name: "金丹之境", cond: "修為晉入金丹境（第 3 重）", prog: s => ({ cur: Math.min(calcLevel(calcXp(s)).level, 3), max: 3 }) },
  { id: "sancai",  icon: "ic-trigram", name: "三才兼修", cond: "三類功課各完成過一項",    prog: s => ({ cur: doneCatCount(s), max: 3 }) },
];

// ---------------- 資料 ----------------
function emptyState() {
  return { goals: [], checkins: {}, lastLevel: 1 };
}
function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return emptyState();
    return Object.assign(emptyState(), JSON.parse(raw));
  } catch (e) { return emptyState(); }
}
function saveState() { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }

function dateKey(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function todayKey() { return dateKey(new Date()); }
function todayCheckin() {
  const k = todayKey();
  if (!state.checkins[k]) state.checkins[k] = { done: [], mood: "", note: "" };
  return state.checkins[k];
}
function isActive(c) {
  return c && (((c.done && c.done.length) || c.mood || (c.note && c.note.trim())));
}

// ---------------- 計算 ----------------
function totalDoneCount(s) {
  let n = 0;
  for (const k in s.checkins) n += (s.checkins[k].done || []).length;
  return n;
}
function activeDayCount(s) {
  let n = 0;
  for (const k in s.checkins) if (isActive(s.checkins[k])) n++;
  return n;
}
function calcXp(s) {
  let xp = totalDoneCount(s) * XP_PER_TASK;
  xp += activeDayCount(s) * XP_PER_DAY;
  return xp;
}
function calcLevel(xp) {
  const per = 100;
  return { level: Math.floor(xp / per) + 1, into: xp % per, need: per };
}
function levelToTitle(level) {
  const idx = level - 1;
  if (idx < JINGJIE.length) return JINGJIE[idx];
  return "飛昇·上"; // 超過十重者
}
function calcStreak(s) {
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = dateKey(d);
    if (isActive(s.checkins[key])) {
      streak++;
    } else {
      if (streak === 0 && key === todayKey()) { d.setDate(d.getDate() - 1); continue; }
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
function doneCatCount(s) {
  const cats = new Set();
  for (const k in s.checkins)
    for (const gid of (s.checkins[k].done || [])) {
      const g = s.goals.find(x => x.id === gid);
      if (g) cats.add(g.category);
    }
  return cats.size;
}

// ---------------- 操作 ----------------
function addGoal(category, title) {
  title = title.trim(); if (!title) return;
  state.goals.push({ id: "g" + Date.now(), category, title });
  saveState(); render();
}
function deleteGoal(id) {
  state.goals = state.goals.filter(g => g.id !== id);
  for (const k in state.checkins)
    state.checkins[k].done = (state.checkins[k].done || []).filter(x => x !== id);
  saveState(); render();
}
function toggleTask(id) {
  const c = todayCheckin();
  const i = c.done.indexOf(id);
  if (i >= 0) c.done.splice(i, 1); else c.done.push(id);
  saveState(); render();
}
function setMood(m) { todayCheckin().mood = m; saveState(); render(); }
function setNote(text) { todayCheckin().note = text; saveState(); }
function resetAll() {
  if (confirm("確定清空所有功課與紀錄？此動作無法復原。")) {
    state = emptyState(); saveState(); render();
  }
}

// ---------------- 主題 ----------------
const THEME_KEY = "sq-theme";
function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}
function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = t === "dark" ? "☀ 切換亮色" : "☾ 切換深色";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "dark" ? "#18181d" : "#f3ece0");
}
function toggleTheme() { applyTheme(currentTheme() === "dark" ? "light" : "dark"); }

// ---------------- 分頁 ----------------
const PAGE_KEY = "sq-page";
function showPage(name) {
  document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === "page-" + name));
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.page === name));
  try { localStorage.setItem(PAGE_KEY, name); } catch (e) {}
  window.scrollTo(0, 0);
  render();
}

// ================= 畫面 =================
function render() {
  renderStatus();
  renderToday();
  renderLog();
  renderStats();
  renderAchv();
  renderMe();
  state.lastLevel = calcLevel(calcXp(state)).level;
  saveState();
}

function renderStatus() {
  const xp = calcXp(state);
  const lv = calcLevel(xp);
  const title = levelToTitle(lv.level);
  const streak = calcStreak(state);
  const justLeveled = lv.level > (state.lastLevel || 1);

  document.getElementById("jingjieChar").textContent = title[0];
  document.getElementById("jingjieName").textContent = title;
  document.getElementById("jingjieLv").textContent = "· 第 " + lv.level + " 重";
  document.getElementById("xpFill").style.width = (lv.into / lv.need * 100) + "%";

  const nextName = lv.level < JINGJIE.length ? "「" + JINGJIE[lv.level] + "」" : "更高之境";
  document.getElementById("xpText").textContent =
    `修為 ${lv.into}/${lv.need}　距${nextName}尚需 ${lv.need - lv.into}`;

  document.getElementById("streakNum").textContent = streak;

  if (justLeveled) {
    const box = document.getElementById("jingjieBox");
    box.classList.add("celebrate");
    setTimeout(() => box.classList.remove("celebrate"), 700);
  }

  // 鶴翁說話
  const c = todayCheckin();
  document.getElementById("coachMsg").textContent = getCoachMessage({
    doneCount: c.done.length, totalCount: state.goals.length,
    mood: c.mood, streak, justLeveled, newTitle: title,
  });
}

function renderToday() {
  const c = todayCheckin();

  const moodRow = document.getElementById("moodRow");
  moodRow.innerHTML = "";
  MOODS.forEach(m => {
    const b = document.createElement("button");
    b.className = "mood-btn" + (c.mood === m ? " selected" : "");
    b.textContent = m;
    b.onclick = () => setMood(m);
    moodRow.appendChild(b);
  });

  const list = document.getElementById("todayList");
  list.innerHTML = "";
  if (state.goals.length === 0) {
    list.innerHTML = '<li class="empty-hint">尚未立下功課，往「我的」分頁新增 ✧</li>';
  } else {
    state.goals.forEach(g => {
      const done = c.done.includes(g.id);
      const li = document.createElement("li");
      const box = document.createElement("span");
      box.className = "check" + (done ? " done" : "");
      box.textContent = done ? "✓" : "";
      box.onclick = () => toggleTask(g.id);
      const text = document.createElement("span");
      text.className = "task-text" + (done ? " done" : "");
      text.textContent = g.title;
      li.appendChild(box); li.appendChild(text);
      list.appendChild(li);
    });
  }

  document.getElementById("noteInput").value = c.note || "";
}

// ---- 紀錄：月曆 + 時間軸 ----
function renderLog() {
  const now = new Date();
  const y = now.getFullYear(), mo = now.getMonth();
  document.getElementById("calTitle").textContent = `${y} 年 ${mo + 1} 月`;

  const grid = document.getElementById("calGrid");
  grid.innerHTML = "";
  const firstDay = new Date(y, mo, 1).getDay();
  const days = new Date(y, mo + 1, 0).getDate();
  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement("span");
    blank.className = "cal-cell blank";
    grid.appendChild(blank);
  }
  const tk = todayKey();
  for (let d = 1; d <= days; d++) {
    const key = dateKey(new Date(y, mo, d));
    const c = state.checkins[key];
    const cnt = c && c.done ? c.done.length : 0;
    const cell = document.createElement("span");
    let cls = "cal-cell";
    if (isActive(c)) cls += " lit lit" + Math.min(cnt, 4);
    if (key === tk) cls += " today";
    cell.className = cls;
    cell.textContent = d;
    grid.appendChild(cell);
  }

  const tl = document.getElementById("timeline");
  const keys = Object.keys(state.checkins).filter(k => isActive(state.checkins[k])).sort().reverse();
  if (keys.length === 0) {
    tl.innerHTML = '<p class="empty-hint">還沒有紀錄，從今日開始吧 ✧</p>';
  } else {
    tl.innerHTML = "";
    const wk = ["日", "一", "二", "三", "四", "五", "六"];
    keys.forEach(k => {
      const c = state.checkins[k];
      const dt = new Date(k + "T00:00:00");
      const item = document.createElement("div");
      item.className = "tl-item";
      const dateStr = `${dt.getMonth() + 1}月${dt.getDate()}日 週${wk[dt.getDay()]}`;
      const note = (c.note && c.note.trim()) ? c.note : "（未留言）";
      item.innerHTML =
        `<div class="tl-dot">${c.mood || "·"}</div>` +
        `<div class="tl-body"><div class="tl-date">${dateStr}` +
        `<span class="tl-count">${(c.done || []).length} 課</span></div>` +
        `<div class="tl-note">${escapeHtml(note)}</div></div>`;
      tl.appendChild(item);
    });
  }
}

// ---- 統計：總覽 + 兩張 SVG 圖 ----
function lastNDates(n) {
  const arr = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const dd = new Date(d); dd.setDate(d.getDate() - i);
    arr.push({ key: dateKey(dd), date: dd });
  }
  return arr;
}
function moodValue(m) { return ({ "😀": 5, "🙂": 4, "😐": 3, "😫": 2, "😴": 1 })[m] || 0; }

function renderStats() {
  const xp = calcXp(state);
  const lv = calcLevel(xp);
  const tiles = [
    ["目前境界", levelToTitle(lv.level)],
    ["總修為", xp],
    ["連續修煉", calcStreak(state) + " 日"],
    ["修煉天數", activeDayCount(state) + " 日"],
    ["完成功課", totalDoneCount(state) + " 項"],
    ["立下功課", state.goals.length + " 項"],
  ];
  document.getElementById("statGrid").innerHTML =
    tiles.map(t => `<div class="stat-tile"><div class="stat-val">${t[1]}</div><div class="stat-key">${t[0]}</div></div>`).join("");

  // 近 14 日完成長條
  const days = lastNDates(14);
  const counts = days.map(x => (state.checkins[x.key] && state.checkins[x.key].done ? state.checkins[x.key].done.length : 0));
  const maxC = Math.max(1, ...counts);
  const W = 320, H = 120, pad = 6, bw = (W - pad * 2) / days.length;
  let bars = "";
  counts.forEach((c, i) => {
    const h = c === 0 ? 2 : (H - 24) * (c / maxC);
    const x = pad + i * bw + 2;
    bars += `<rect x="${x.toFixed(1)}" y="${(H - 18 - h).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${h.toFixed(1)}" rx="2" class="bar"></rect>`;
    if (i % 2 === 0) bars += `<text x="${(x + (bw - 4) / 2).toFixed(1)}" y="${H - 5}" class="ax">${days[i].date.getDate()}</text>`;
  });
  document.getElementById("chartBars").innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${bars}</svg>`;

  // 近 14 日心境折線
  const vals = days.map(x => moodValue(state.checkins[x.key] && state.checkins[x.key].mood));
  let pts = [], dots = "";
  vals.forEach((v, i) => {
    if (v === 0) return;
    const x = pad + i * bw + bw / 2;
    const yy = 14 + (H - 36) * (1 - (v - 1) / 4);
    pts.push(`${x.toFixed(1)},${yy.toFixed(1)}`);
    dots += `<circle cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="3" class="dot"></circle>`;
  });
  const line = pts.length > 1 ? `<polyline points="${pts.join(" ")}" class="line" fill="none"></polyline>` : "";
  const empty = pts.length === 0 ? `<text x="${W / 2}" y="${H / 2}" class="ax" text-anchor="middle">尚無心境紀錄</text>` : "";
  document.getElementById("chartMood").innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${line}${dots}${empty}</svg>`;
}

// ---- 成就 + 境界階梯 ----
function renderAchv() {
  const wrap = document.getElementById("achvList");
  wrap.innerHTML = "";
  BADGES.forEach(b => {
    const p = b.prog(state);
    const unlocked = p.cur >= p.max;
    const pct = Math.round(p.cur / p.max * 100);
    const el = document.createElement("div");
    el.className = "achv" + (unlocked ? " unlocked" : "");
    el.innerHTML =
      `<div class="achv-ic"><svg><use href="#${b.icon}"/></svg></div>` +
      `<div class="achv-body">` +
        `<div class="achv-top"><span class="achv-name">${b.name}</span>` +
        `<span class="achv-state">${unlocked ? "已得 ✦" : p.cur + "/" + p.max}</span></div>` +
        `<div class="achv-cond">${b.cond}</div>` +
        `<div class="achv-bar"><div class="achv-fill" style="width:${pct}%"></div></div>` +
      `</div>`;
    wrap.appendChild(el);
  });

  const lv = calcLevel(calcXp(state)).level;
  const ladder = document.getElementById("ladder");
  ladder.innerHTML = JINGJIE.map((name, i) => {
    const need = i * 100;
    const reached = lv >= i + 1;
    const cur = lv === i + 1;
    return `<div class="ladder-row${reached ? " reached" : ""}${cur ? " current" : ""}">` +
      `<span class="ladder-name">${name}</span>` +
      `<span class="ladder-need">${need} 修為</span>` +
      `<span class="ladder-mark">${cur ? "現在" : reached ? "✓" : ""}</span></div>`;
  }).join("");
}

// ---- 我的：功課管理 ----
function renderMe() {
  const groups = document.getElementById("goalGroups");
  groups.innerHTML = "";
  let any = false;
  for (const catKey in CATEGORIES) {
    const list = state.goals.filter(g => g.category === catKey);
    if (list.length === 0) continue;
    any = true;
    const wrap = document.createElement("div");
    wrap.className = "goal-group";
    wrap.innerHTML = `<h3>${CATEGORIES[catKey].label}</h3>`;
    list.forEach(g => {
      const row = document.createElement("div");
      row.className = "goal-item";
      const t = document.createElement("span");
      t.className = "g-text"; t.textContent = g.title;
      const del = document.createElement("button");
      del.className = "del-btn"; del.textContent = "✕";
      del.onclick = () => deleteGoal(g.id);
      row.appendChild(t); row.appendChild(del);
      wrap.appendChild(row);
    });
    groups.appendChild(wrap);
  }
  if (!any) groups.innerHTML = '<p class="empty-hint">還沒有功課，立一項開始修行吧 ✧</p>';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

// ---------------- 啟動 ----------------
let state = loadState();

function init() {
  // 立功課
  const addBtn = document.getElementById("addGoalBtn");
  const goalInput = document.getElementById("goalInput");
  const goalCat = document.getElementById("goalCategory");
  const submit = () => { addGoal(goalCat.value, goalInput.value); goalInput.value = ""; goalInput.focus(); };
  addBtn.onclick = submit;
  goalInput.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });

  // 今日一語：邊打邊存
  document.getElementById("noteInput").addEventListener("input", e => setNote(e.target.value));

  // 偏好
  document.getElementById("resetBtn").onclick = resetAll;
  applyTheme(currentTheme());
  document.getElementById("themeToggle").onclick = toggleTheme;

  // 底部導覽
  document.querySelectorAll(".tab").forEach(t => { t.onclick = () => showPage(t.dataset.page); });

  // 回到上次所在分頁
  let last = "today";
  try { const p = localStorage.getItem(PAGE_KEY); if (p) last = p; } catch (e) {}
  showPage(last);
}

document.addEventListener("DOMContentLoaded", init);
