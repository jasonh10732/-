/*
  暑假大冒險 — 核心引擎
  =================================================
  這個檔負責「資料」與「畫面」：
    1. 從手機本機（localStorage）讀出你的資料
    2. 你按按鈕時更新資料
    3. 重新把畫面畫出來，並把資料存回去
  資料只存在你這支手機，不會上傳到任何地方。
*/

// localStorage 裡用這個名字存資料
const SAVE_KEY = "summer-quest-v1";

// 心情選項
const MOODS = ["😀", "🙂", "😐", "😫", "😴"];

// 目標三大分類（顯示用的標題與圖示）
const CATEGORIES = {
  learn: { label: "📚 想學的", icon: "📚" },
  work:  { label: "💪 想認真做的", icon: "💪" },
  fun:   { label: "🎮 想玩的", icon: "🎮" },
};

// 成就徽章的定義。check(s) 會拿到整份資料，回傳 true 代表解鎖
const BADGES = [
  { id: "first",     icon: "🌱", name: "啟程",     check: s => totalDoneCount(s) >= 1 },
  { id: "streak3",   icon: "🔥", name: "三連發",   check: s => calcStreak(s) >= 3 },
  { id: "streak7",   icon: "⚡", name: "一週連線", check: s => calcStreak(s) >= 7 },
  { id: "done10",    icon: "🏅", name: "完成 10 項", check: s => totalDoneCount(s) >= 10 },
  { id: "level5",    icon: "⭐", name: "等級 5",   check: s => calcLevel(calcXp(s)).level >= 5 },
  { id: "allcat",    icon: "🌈", name: "全才",     check: s => doneAllCategories(s) },
];

// 每完成一項目標得到的經驗值；每天有打卡額外加成
const XP_PER_TASK = 10;
const XP_PER_CHECKIN_DAY = 5;

// -------------------------------------------------
// 資料的讀取與儲存
// -------------------------------------------------

// 預設的空白資料
function emptyState() {
  return {
    goals: [],      // [{ id, category, title }]
    checkins: {},    // { "2026-06-26": { done: [goalId...], mood: "😀", note: "" } }
    seenBadges: [],  // 已經慶祝過的徽章，避免重複跳動畫
    lastLevel: 1,    // 記住上次的等級，用來判斷「剛升等」
  };
}

// 從本機讀資料；讀不到就給一份空白的
function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return emptyState();
    return Object.assign(emptyState(), JSON.parse(raw));
  } catch (e) {
    return emptyState();
  }
}

// 把資料存回本機
function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

// 今天的日期字串，例如 "2026-06-26"
function todayKey() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// 拿到「今天」這筆打卡資料（沒有就建一個空的）
function todayCheckin() {
  const k = todayKey();
  if (!state.checkins[k]) {
    state.checkins[k] = { done: [], mood: "", note: "" };
  }
  return state.checkins[k];
}

// -------------------------------------------------
// 計算：經驗值、等級、連續天數
// -------------------------------------------------

// 全部歷史一共完成過幾項
function totalDoneCount(s) {
  let n = 0;
  for (const k in s.checkins) n += (s.checkins[k].done || []).length;
  return n;
}

// 總經驗值 = 所有完成項目 + 每個有打卡的日子加成
function calcXp(s) {
  let xp = totalDoneCount(s) * XP_PER_TASK;
  for (const k in s.checkins) {
    const c = s.checkins[k];
    const hasActivity = (c.done && c.done.length) || c.mood || (c.note && c.note.trim());
    if (hasActivity) xp += XP_PER_CHECKIN_DAY;
  }
  return xp;
}

// 由經驗值換算等級。每一等需要 100 XP。
// 回傳：目前等級、這一等已累積的 XP、升到下一等需要的 XP
function calcLevel(xp) {
  const perLevel = 100;
  const level = Math.floor(xp / perLevel) + 1;
  const into = xp % perLevel;
  return { level, into, need: perLevel };
}

// 連續打卡天數：從今天往回數，連續有「活動」的天數
function calcStreak(s) {
  let streak = 0;
  const d = new Date();
  // 如果今天還沒有任何活動，從昨天開始算（今天還來得及補）
  while (true) {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const key = `${d.getFullYear()}-${m}-${day}`;
    const c = s.checkins[key];
    const active = c && (((c.done && c.done.length) || c.mood || (c.note && c.note.trim())));
    if (active) {
      streak++;
    } else {
      // 今天（第一圈）沒活動先跳過，不中斷；其他天沒活動就停
      if (streak === 0 && key === todayKey()) {
        d.setDate(d.getDate() - 1);
        continue;
      }
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// 三個分類是否都至少完成過一項
function doneAllCategories(s) {
  const cats = new Set();
  for (const k in s.checkins) {
    for (const gid of (s.checkins[k].done || [])) {
      const g = s.goals.find(x => x.id === gid);
      if (g) cats.add(g.category);
    }
  }
  return cats.has("learn") && cats.has("work") && cats.has("fun");
}

// -------------------------------------------------
// 操作：新增/刪除目標、打卡、選心情、寫筆記
// -------------------------------------------------

function addGoal(category, title) {
  title = title.trim();
  if (!title) return;
  state.goals.push({ id: "g" + Date.now(), category, title });
  saveState();
  render();
}

function deleteGoal(id) {
  state.goals = state.goals.filter(g => g.id !== id);
  // 也把歷史打卡裡這個目標清掉
  for (const k in state.checkins) {
    state.checkins[k].done = (state.checkins[k].done || []).filter(x => x !== id);
  }
  saveState();
  render();
}

function toggleTask(id) {
  const c = todayCheckin();
  const i = c.done.indexOf(id);
  if (i >= 0) c.done.splice(i, 1);
  else c.done.push(id);
  saveState();
  render();
}

function setMood(m) {
  todayCheckin().mood = m;
  saveState();
  render();
}

function setNote(text) {
  todayCheckin().note = text;
  saveState();
  // 筆記是邊打字邊存，不需要每個字都重畫整個畫面
}

function resetAll() {
  if (confirm("確定要把所有目標和打卡紀錄都清空嗎？此動作無法復原。")) {
    state = emptyState();
    saveState();
    render();
  }
}

// -------------------------------------------------
// 畫面：把資料變成看得到的東西
// -------------------------------------------------

function render() {
  const xp = calcXp(state);
  const lv = calcLevel(xp);
  const streak = calcStreak(state);
  const c = todayCheckin();

  // 判斷是不是「剛升等」（這次等級比上次記住的高）
  const justLeveled = lv.level > (state.lastLevel || 1);

  // --- 頂部：等級、經驗條、連續天數 ---
  const levelNum = document.getElementById("levelNum");
  levelNum.textContent = lv.level;
  document.getElementById("streakNum").textContent = streak;
  document.getElementById("xpFill").style.width = (lv.into / lv.need * 100) + "%";
  document.getElementById("xpText").textContent = `${lv.into} / ${lv.need} XP`;

  // 日期
  const today = new Date();
  const week = ["日", "一", "二", "三", "四", "五", "六"][today.getDay()];
  document.getElementById("dateLabel").textContent =
    `${today.getMonth() + 1}月${today.getDate()}日（週${week}）`;

  // 升等就閃一下慶祝動畫
  if (justLeveled) {
    levelNum.parentElement.classList.add("celebrate");
    setTimeout(() => levelNum.parentElement.classList.remove("celebrate"), 600);
  }

  // --- 心情按鈕 ---
  const moodRow = document.getElementById("moodRow");
  moodRow.innerHTML = "";
  MOODS.forEach(m => {
    const b = document.createElement("button");
    b.className = "mood-btn" + (c.mood === m ? " selected" : "");
    b.textContent = m;
    b.onclick = () => setMood(m);
    moodRow.appendChild(b);
  });

  // --- 今天的任務清單 ---
  const todayList = document.getElementById("todayList");
  todayList.innerHTML = "";
  if (state.goals.length === 0) {
    todayList.innerHTML = '<li class="empty-hint">還沒設定目標，往下滑去新增吧 👇</li>';
  } else {
    state.goals.forEach(g => {
      const done = c.done.includes(g.id);
      const li = document.createElement("li");

      const box = document.createElement("span");
      box.className = "check" + (done ? " done" : "");
      box.textContent = done ? "✓" : "";
      box.onclick = () => toggleTask(g.id);

      const cat = document.createElement("span");
      cat.className = "task-cat";
      cat.textContent = CATEGORIES[g.category].icon;

      const text = document.createElement("span");
      text.className = "task-text";
      text.textContent = g.title;

      li.appendChild(box);
      li.appendChild(cat);
      li.appendChild(text);
      todayList.appendChild(li);
    });
  }

  // --- 筆記 ---
  document.getElementById("noteInput").value = c.note || "";

  // --- 目標管理（依分類分組） ---
  const groups = document.getElementById("goalGroups");
  groups.innerHTML = "";
  for (const catKey in CATEGORIES) {
    const list = state.goals.filter(g => g.category === catKey);
    if (list.length === 0) continue;
    const wrap = document.createElement("div");
    wrap.className = "goal-group";
    wrap.innerHTML = `<h3>${CATEGORIES[catKey].label}</h3>`;
    list.forEach(g => {
      const row = document.createElement("div");
      row.className = "goal-item";
      const t = document.createElement("span");
      t.className = "g-text";
      t.textContent = g.title;
      const del = document.createElement("button");
      del.className = "del-btn";
      del.textContent = "✕";
      del.onclick = () => deleteGoal(g.id);
      row.appendChild(t);
      row.appendChild(del);
      wrap.appendChild(row);
    });
    groups.appendChild(wrap);
  }

  // --- 徽章 ---
  const badgeGrid = document.getElementById("badgeGrid");
  badgeGrid.innerHTML = "";
  BADGES.forEach(b => {
    const unlocked = b.check(state);
    const el = document.createElement("div");
    el.className = "badge" + (unlocked ? " unlocked" : "");
    el.innerHTML = `<div class="badge-icon">${b.icon}</div><div class="badge-name">${b.name}</div>`;
    badgeGrid.appendChild(el);
  });

  // --- AI 夥伴說話 ---
  const msg = getCoachMessage({
    doneCount: c.done.length,
    totalCount: state.goals.length,
    mood: c.mood,
    streak: streak,
    justLeveled: justLeveled,
    newLevel: lv.level,
  });
  document.getElementById("coachMsg").textContent = msg;

  // 記住這次的等級，下次才能判斷有沒有再升等
  state.lastLevel = lv.level;
  saveState();
}

// -------------------------------------------------
// 主題：亮色 / 深色切換
// （資料另外存，跟打卡資料分開）
// -------------------------------------------------

const THEME_KEY = "sq-theme";

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

// 套用主題：改 <html> 的標記、記住選擇、更新按鈕圖示與手機上方列顏色
function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = t === "dark" ? "☀" : "☾";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "dark" ? "#16161a" : "#f6f4ef");
}

function toggleTheme() {
  applyTheme(currentTheme() === "dark" ? "light" : "dark");
}

// -------------------------------------------------
// 啟動：綁定按鈕、畫第一次
// -------------------------------------------------

let state = loadState();

function init() {
  // 新增目標
  const addBtn = document.getElementById("addGoalBtn");
  const goalInput = document.getElementById("goalInput");
  const goalCat = document.getElementById("goalCategory");
  const submit = () => {
    addGoal(goalCat.value, goalInput.value);
    goalInput.value = "";
    goalInput.focus();
  };
  addBtn.onclick = submit;
  goalInput.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });

  // 筆記：邊打邊存
  document.getElementById("noteInput").addEventListener("input", e => setNote(e.target.value));

  // 重設
  document.getElementById("resetBtn").onclick = resetAll;

  // 主題切換鈕：先把圖示設成目前狀態（亮/深色），再綁定點擊
  applyTheme(currentTheme());
  document.getElementById("themeToggle").onclick = toggleTheme;

  render();
}

// 等網頁載入完成再啟動
document.addEventListener("DOMContentLoaded", init);
