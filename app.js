/*
  問道錄 — 核心引擎
  =================================================
  資料只存在你這支手機（localStorage），不上傳。
  修為改為「持久累積（state.xp）」：完成任務當下依難度與境界加成給分。
*/

const SAVE_KEY = "summer-quest-v1";   // 沿用舊鍵，既有資料不會不見
const MOODS = ["😀", "🙂", "😐", "😫", "😴"];

const CATEGORIES = {
  learn: { label: "問道（想學）" },
  work:  { label: "勤修（想做）" },
  fun:   { label: "遊歷（想玩）" },
};

// 難度 → 基礎修為（越難越多）
const DIFF = {
  easy: { base: 10, label: "易", star: "★" },
  mid:  { base: 20, label: "中", star: "★★" },
  hard: { base: 35, label: "難", star: "★★★" },
};
function diffOf(d) { return DIFF[d] || DIFF.mid; }

// 境界（每境界內分九重）。門檻遞增＝長期養成
const JINGJIE = ["練氣", "築基", "金丹", "元嬰", "化神", "煉虛", "合體", "大乘", "渡劫", "飛昇"];
const THRESHOLDS = [0, 300, 800, 1600, 3000, 5000, 8000, 12000, 18000, 26000];

// 由累積修為換算境界資訊
function levelInfo(xp) {
  xp = Math.max(0, xp || 0);
  let idx = 0;
  for (let i = 0; i < THRESHOLDS.length; i++) if (xp >= THRESHOLDS[i]) idx = i;
  const lo = THRESHOLDS[idx];
  const hi = (idx + 1 < THRESHOLDS.length)
    ? THRESHOLDS[idx + 1]
    : lo + (THRESHOLDS[idx] - THRESHOLDS[idx - 1] || 8000);   // 飛昇之後的帶寬
  const span = Math.max(1, hi - lo);
  const into = xp - lo;
  const stage = Math.min(9, Math.floor(into / span * 9) + 1);
  const name = idx < JINGJIE.length ? JINGJIE[idx] : "飛昇";
  const nextName = (idx + 1 < JINGJIE.length) ? JINGJIE[idx + 1] : "圓滿";
  return { idx, level: idx + 1, name, stage, lo, hi, span, into, remain: Math.max(0, hi - xp), nextName, isMax: idx >= JINGJIE.length - 1 };
}
// 境界加成：境界越高，每次完成給越多
function multNow() { return 1 + 0.5 * (levelInfo(state.xp).level - 1); }
function awardFor(diffKey) { return Math.round(diffOf(diffKey).base * multNow()); }

// 成就
const BADGES = [
  { id: "first",   icon: "ic-sprout",  name: "初心",     cond: "完成第一項功課",        prog: s => ({ cur: Math.min(totalDoneCount(s), 1), max: 1 }) },
  { id: "streak3", icon: "ic-flame",   name: "三日不輟", cond: "連續修煉 3 日",          prog: s => ({ cur: Math.min(calcStreak(s), 3), max: 3 }) },
  { id: "streak7", icon: "ic-bolt",    name: "七日精進", cond: "連續修煉 7 日",          prog: s => ({ cur: Math.min(calcStreak(s), 7), max: 7 }) },
  { id: "done30",  icon: "ic-medal",   name: "百尺竿頭", cond: "累計完成 30 項任務",      prog: s => ({ cur: Math.min(totalDoneCount(s), 30), max: 30 }) },
  { id: "jindan",  icon: "ic-pill",    name: "金丹之境", cond: "修為晉入金丹境",          prog: s => ({ cur: Math.min(levelInfo(s.xp).level, 3), max: 3 }) },
  { id: "sancai",  icon: "ic-trigram", name: "三才兼修", cond: "三類功課各完成過一項",    prog: s => ({ cur: doneCatCount(s), max: 3 }) },
];

// 獎勵閣：境界解鎖的點綴色（need＝所需境界 level）
const ACCENTS = [
  { id: "default", name: "朱砂", need: 1,  seal: "#b5403a", seal2: "#d4655d", gold: "#b08a43", sealSoft: "rgba(181,64,58,.12)", glow: "rgba(176,138,67,.45)" },
  { id: "mojin",   name: "墨金", need: 3,  seal: "#b8924f", seal2: "#d8b466", gold: "#c2a25a", sealSoft: "rgba(184,146,79,.16)", glow: "rgba(194,162,90,.5)" },
  { id: "qingbi",  name: "青碧", need: 5,  seal: "#2f8f83", seal2: "#56b3a6", gold: "#b08a43", sealSoft: "rgba(47,143,131,.16)", glow: "rgba(86,179,166,.45)" },
  { id: "liujin",  name: "鎏金赤", need: 10, seal: "#c0392b", seal2: "#e0746a", gold: "#d4af37", sealSoft: "rgba(192,57,43,.16)", glow: "rgba(212,175,55,.55)" },
];

// ---------------- 資料 ----------------
function emptyState() {
  return { goals: [], checkins: {}, lastLevel: 1, coachName: "", weeks: {},
           shields: 0, shieldDays: [], shieldAwardAt: 0, equipAccent: "default" };
}
// 遷移：若沒有持久修為，由歷史估算補回（舊用戶進度不丟）
function ensureMigrated(s) {
  if (typeof s.xp === "number") return;
  let xp = 0;
  for (const k in s.checkins) {
    const c = s.checkins[k];
    (c.done || []).forEach(id => { xp += diffOf(c.diffs && c.diffs[id]).base; });
    (c.top3 || []).forEach(t => { if (t.done) xp += diffOf(t.diff).base; });
  }
  s.xp = xp;
}
function loadState() {
  let s;
  try { const raw = localStorage.getItem(SAVE_KEY); s = raw ? Object.assign(emptyState(), JSON.parse(raw)) : emptyState(); }
  catch (e) { s = emptyState(); }
  if (!Array.isArray(s.shieldDays)) s.shieldDays = [];
  ensureMigrated(s);
  return s;
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
function todayTop3() { const c = todayCheckin(); if (!c.top3) c.top3 = []; return c.top3; }
function isActive(c) {
  return c && (((c.done && c.done.length) || (c.top3 && c.top3.some(t => t.done)) || c.mood || (c.note && c.note.trim())));
}

// 週界
function mondayOf(d) {
  const x = new Date(d);
  const back = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - back); x.setHours(0, 0, 0, 0);
  return x;
}
function weekKey(d) { return dateKey(mondayOf(d)); }
function currentWeekKey() { return weekKey(new Date()); }
function currentWeekItems() {
  const k = currentWeekKey();
  if (!state.weeks) state.weeks = {};
  if (!state.weeks[k]) state.weeks[k] = [];
  return state.weeks[k];
}
function titleOf(checkin, id) {
  if (checkin && checkin.titles && checkin.titles[id]) return checkin.titles[id];
  const g = state.goals.find(x => x.id === id);
  return g ? g.title : "（已刪除的功課）";
}
function dateKeyOffset(off) { const d = new Date(); d.setDate(d.getDate() - off); return dateKey(d); }
function hasPastActivity() {
  const tk = todayKey();
  for (const k in state.checkins) if (k < tk && isActive(state.checkins[k])) return true;
  return false;
}
function doneTodayCount() {
  const c = todayCheckin();
  const g = state.goals.filter(x => c.done.includes(x.id)).length;
  const t = (c.top3 || []).filter(x => x.done).length;
  return g + t;
}
// 走火入魔：有過往打卡 && 昨日未被覆蓋 && 今日尚未完成任何任務
function isDeviated() {
  return hasPastActivity() && !coveredDay(dateKeyOffset(1)) && doneTodayCount() === 0;
}

// ---------------- 護道符 ----------------
function coveredDay(key) { return isActive(state.checkins[key]) || (state.shieldDays || []).includes(key); }
function applyShields() {
  if (!state.shieldDays) state.shieldDays = [];
  const tk = todayKey();
  let last = null;
  for (const k in state.checkins) if (k < tk && isActive(state.checkins[k]) && (!last || k > last)) last = k;
  if (!last) return;
  const d = new Date(); d.setDate(d.getDate() - 1);
  while (true) {
    const key = dateKey(d);
    if (key <= last) break;
    if (!isActive(state.checkins[key]) && !state.shieldDays.includes(key)) {
      if ((state.shields || 0) > 0) { state.shieldDays.push(key); state.shields--; }
      else break;   // 無符可用，連續在此中斷
    }
    d.setDate(d.getDate() - 1);
  }
}
function awardShields() {
  const milestone = Math.floor(calcStreak(state) / 7);
  const prev = state.shieldAwardAt || 0;
  if (milestone > prev) {
    state.shields = Math.min(3, (state.shields || 0) + (milestone - prev));
    state.shieldAwardAt = milestone;
  }
}
function longestStreak() {
  const set = new Set(state.shieldDays || []);
  for (const k in state.checkins) if (isActive(state.checkins[k])) set.add(k);
  const days = [...set].sort();
  let best = 0, cur = 0, prev = null;
  for (const k of days) {
    if (prev) {
      const diff = Math.round((new Date(k + "T00:00:00") - new Date(prev + "T00:00:00")) / 86400000);
      cur = diff === 1 ? cur + 1 : 1;
    } else cur = 1;
    best = Math.max(best, cur); prev = k;
  }
  return best;
}

// ---------------- 計算 ----------------
function totalDoneCount(s) {
  let n = 0;
  for (const k in s.checkins) {
    const c = s.checkins[k];
    n += (c.done || []).length;
    n += (c.top3 || []).filter(t => t.done).length;
  }
  return n;
}
function activeDayCount(s) {
  let n = 0;
  for (const k in s.checkins) if (isActive(s.checkins[k])) n++;
  return n;
}
function calcStreak(s) {
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = dateKey(d);
    if (coveredDay(key)) streak++;
    else { if (streak === 0 && key === todayKey()) { d.setDate(d.getDate() - 1); continue; } break; }
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
function addGoal(category, title, diff) {
  title = title.trim(); if (!title) return;
  state.goals.push({ id: "g" + Date.now(), category, title, diff: diff || "mid" });
  saveState(); render();
}
function deleteGoal(id) {
  state.goals = state.goals.filter(g => g.id !== id);   // 不動歷史
  saveState(); render();
}
function toggleTask(id, el) {
  const c = todayCheckin();
  const i = c.done.indexOf(id);
  const nowDone = i < 0;
  if (i >= 0) {
    c.done.splice(i, 1);
    const amt = (c.award && c.award[id]) || 0;
    state.xp = Math.max(0, state.xp - amt);
    if (c.award) delete c.award[id];
  } else {
    c.done.push(id);
    const g = state.goals.find(x => x.id === id);
    if (g) {
      c.titles = c.titles || {}; c.titles[id] = g.title;
      c.diffs = c.diffs || {}; c.diffs[id] = g.diff || "mid";
      const amt = awardFor(g.diff); c.award = c.award || {}; c.award[id] = amt; state.xp += amt;
      if (el) burstEffect(el, amt);
    }
  }
  saveState(); render();
  if (nowDone) swordFlash();
}

// 今日三事（每日精選，≤3，當日限定；兼今日臨時任務）
function addTop3(title, diff) {
  title = (title || "").trim(); if (!title) return;
  const t3 = todayTop3(); if (t3.length >= 3) return;
  t3.push({ id: "t" + Date.now(), title, diff: diff || "mid", done: false });
  saveState(); render();
}
function toggleTop3(id, el) {
  const it = todayTop3().find(x => x.id === id); if (!it) return;
  const nowDone = !it.done; it.done = nowDone;
  if (nowDone) { const amt = awardFor(it.diff); it.xp = amt; state.xp += amt; if (el) burstEffect(el, amt); }
  else { state.xp = Math.max(0, state.xp - (it.xp || 0)); it.xp = 0; }
  saveState(); render();
  if (nowDone) swordFlash();
}
function delTop3(id) {
  const c = todayCheckin(); c.top3 = (c.top3 || []).filter(x => x.id !== id);
  saveState(); render();
}

// 週計畫
function addWeekItem(title) {
  title = (title || "").trim(); if (!title) return;
  currentWeekItems().push({ id: "w" + Date.now(), title, done: false });
  saveState(); render();
}
function toggleWeekItem(id) { const it = currentWeekItems().find(x => x.id === id); if (it) it.done = !it.done; saveState(); render(); }
function deleteWeekItem(id) { const k = currentWeekKey(); state.weeks[k] = (state.weeks[k] || []).filter(x => x.id !== id); saveState(); render(); }

function swordFlash() {
  const host = document.getElementById("heartDemon");
  if (!host) return;
  const f = document.createElement("div"); f.className = "sword-flash";
  host.appendChild(f); setTimeout(() => f.remove(), 360);
}

function getCoachName() { return (state.coachName && state.coachName.trim()) || "鶴翁"; }
function setCoachName(v) { state.coachName = (v || "").slice(0, 6); saveState(); render(); }

function burstEffect(el, amt) {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let k = 0; k < 7; k++) {
    const s = document.createElement("span"); s.className = "spark-fx";
    const ang = Math.random() * Math.PI * 2, dist = 16 + Math.random() * 22;
    s.style.left = cx + "px"; s.style.top = cy + "px";
    s.style.setProperty("--dx", (Math.cos(ang) * dist).toFixed(1) + "px");
    s.style.setProperty("--dy", (Math.sin(ang) * dist).toFixed(1) + "px");
    if (k % 2) s.style.background = "var(--seal)";
    document.body.appendChild(s); setTimeout(() => s.remove(), 650);
  }
  const t = document.createElement("div"); t.className = "xp-pop"; t.textContent = "+" + (amt || 0) + " 修為";
  t.style.left = cx + "px"; t.style.top = (cy - 12) + "px";
  document.body.appendChild(t); setTimeout(() => t.remove(), 900);
}
function setMood(m) { todayCheckin().mood = m; saveState(); render(); }
function setNote(text) { todayCheckin().note = text; saveState(); }
function resetAll() {
  if (confirm("確定清空所有功課與紀錄？此動作無法復原。")) {
    state = emptyState(); ensureMigrated(state); applyAccent(state.equipAccent); saveState(); render();
  }
}

// ---------------- 主題 / 點綴色 ----------------
const THEME_KEY = "sq-theme";
function currentTheme() { return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"; }
function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = t === "dark" ? "☀ 切換亮色" : "☾ 切換深色";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "dark" ? "#18181d" : "#f3ece0");
}
function toggleTheme() { applyTheme(currentTheme() === "dark" ? "light" : "dark"); }

function applyAccent(id) {
  const a = ACCENTS.find(x => x.id === id) || ACCENTS[0];
  const root = document.documentElement.style;
  if (a.id === "default") {
    ["--seal", "--seal2", "--gold", "--seal-soft", "--glow"].forEach(v => root.removeProperty(v));
  } else {
    root.setProperty("--seal", a.seal); root.setProperty("--seal2", a.seal2);
    root.setProperty("--gold", a.gold); root.setProperty("--seal-soft", a.sealSoft);
    root.setProperty("--glow", a.glow);
  }
}
function equipAccent(id) {
  const a = ACCENTS.find(x => x.id === id); if (!a) return;
  if (levelInfo(state.xp).level < a.need) return;   // 未達境界不可啟用
  state.equipAccent = id; applyAccent(id); saveState(); render();
}

// ---------------- 背景音樂 ----------------
const MUSIC_KEY = "sq-music";
function musicOn() { try { return localStorage.getItem(MUSIC_KEY) === "on"; } catch (e) { return false; } }
function applyMusicUI(on) {
  const a = document.getElementById("musicToggle"), b = document.getElementById("musicToggle2");
  if (a) a.classList.toggle("on", on);
  if (b) b.textContent = on ? "♪ 暫停" : "♪ 播放";
}
function setMusic(on) {
  const bgm = document.getElementById("bgm");
  try { localStorage.setItem(MUSIC_KEY, on ? "on" : "off"); } catch (e) {}
  if (bgm) { if (on) { bgm.volume = 0.35; bgm.play().catch(() => {}); } else bgm.pause(); }
  applyMusicUI(on);
}
function toggleMusic() { setMusic(!musicOn()); }

// ---------------- 匯出 / 匯入 ----------------
function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const a = document.createElement("a");
  a.href = url; a.download = `wendaolu-backup-${ymd}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let obj;
    try { obj = JSON.parse(reader.result); } catch (e) { alert("匯入失敗：檔案不是有效的備份"); return; }
    if (!obj || typeof obj !== "object" || typeof obj.checkins !== "object" || !Array.isArray(obj.goals)) { alert("匯入失敗：備份格式不正確"); return; }
    if (!confirm("匯入將「取代」目前所有資料，確定嗎？")) return;
    state = Object.assign(emptyState(), obj);
    if (!Array.isArray(state.shieldDays)) state.shieldDays = [];
    ensureMigrated(state); applyAccent(state.equipAccent || "default");
    saveState(); render();
    alert("匯入成功！你的修煉紀錄已還原。");
  };
  reader.readAsText(file);
}

// ---------------- 分頁 ----------------
const PAGE_KEY = "sq-page";
function showPage(name) {
  document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === "page-" + name));
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.page === name));
  try { localStorage.setItem(PAGE_KEY, name); } catch (e) {}
  window.scrollTo(0, 0);
  render();
}

// ---------------- 每日箴言 ----------------
const QUOTES = [
  "千里之行，始於足下。", "不積跬步，無以至千里。", "勝人者有力，自勝者強。",
  "鍥而不舍，金石可鏤。", "業精於勤，荒於嬉。", "天行健，君子以自強不息。",
  "靜水流深，行穩致遠。", "今日事，今日畢。", "日拱一卒，功不唐捐。",
  "心之所向，素履以往。", "守得雲開見月明。", "一寸光陰一寸金。",
  "知行合一，方得始終。", "持之以恆，水滴石穿。",
];
function quoteForToday() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const doy = Math.floor((now - start) / 86400000);
  return QUOTES[doy % QUOTES.length];
}

// ================= 畫面 =================
let taskLogPage = 0;

function render() {
  awardShields();
  renderStatus();
  renderToday();
  renderTop3();
  renderHeartDemon();
  renderWeekly();
  renderDeviation();
  renderLog();
  renderTaskLog();
  renderWeekReview();
  renderStats();
  renderStreakWall();
  renderAchv();
  renderRewards();
  renderMe();
  state.lastLevel = levelInfo(state.xp).level;
  saveState();
}

function demonSVG() {
  return `<svg class="demon" viewBox="0 0 80 80" aria-hidden="true">
    <g class="smoke"><circle cx="40" cy="46" r="22"/><circle cx="25" cy="41" r="13"/>
      <circle cx="55" cy="41" r="13"/><circle cx="40" cy="29" r="15"/></g>
    <circle class="eye" cx="33" cy="41" r="3.4"/><circle class="eye" cx="47" cy="41" r="3.4"/>
    <path class="mouth" d="M32 53 q8 6 16 0" fill="none"/></svg>`;
}

function renderStatus() {
  const li = levelInfo(state.xp);
  const streak = calcStreak(state);
  const justLeveled = li.level > (state.lastLevel || 1);

  document.getElementById("jingjieChar").textContent = li.name[0];
  document.getElementById("jingjieName").textContent = li.name;
  document.getElementById("jingjieLv").textContent = "· 第 " + li.stage + " 重";
  document.getElementById("xpFill").style.width = (li.into / li.span * 100) + "%";
  document.getElementById("xpText").textContent = li.isMax
    ? `修為 ${state.xp}（已臻${li.name}）`
    : `修為 ${state.xp}　距「${li.nextName}」尚需 ${li.remain}`;
  document.getElementById("streakNum").textContent = streak;

  if (justLeveled) {
    const box = document.getElementById("jingjieBox");
    box.classList.add("celebrate");
    setTimeout(() => box.classList.remove("celebrate"), 700);
  }

  const c = todayCheckin();
  document.getElementById("coachName").textContent = getCoachName();
  document.getElementById("coachMsg").textContent = getCoachMessage({
    doneCount: doneTodayCount(), totalCount: state.goals.length + (c.top3 || []).length,
    mood: c.mood, streak, justLeveled, newTitle: li.name,
  });
  const q = document.getElementById("dailyQuote");
  if (q) q.textContent = "今日箴言 · " + quoteForToday();
}

function diffTag(d) { return `<span class="diff diff-${d}">${diffOf(d).star}</span>`; }

function renderToday() {
  const c = todayCheckin();
  const moodRow = document.getElementById("moodRow");
  moodRow.innerHTML = "";
  MOODS.forEach(m => {
    const b = document.createElement("button");
    b.className = "mood-btn" + (c.mood === m ? " selected" : "");
    b.textContent = m; b.onclick = () => setMood(m);
    moodRow.appendChild(b);
  });

  const list = document.getElementById("todayList");
  list.innerHTML = "";
  if (state.goals.length === 0) {
    list.innerHTML = '<li class="empty-hint">尚未立下固定功課，往「我的」分頁新增 ✧</li>';
  } else {
    state.goals.forEach(g => {
      const done = c.done.includes(g.id);
      const li = document.createElement("li");
      const box = document.createElement("span");
      box.className = "check" + (done ? " done" : "");
      box.textContent = done ? "✓" : "";
      box.onclick = (e) => toggleTask(g.id, e.currentTarget);
      const text = document.createElement("span");
      text.className = "task-text" + (done ? " done" : "");
      text.innerHTML = escapeHtml(g.title) + " " + diffTag(g.diff || "mid");
      li.appendChild(box); li.appendChild(text);
      list.appendChild(li);
    });
  }
  document.getElementById("noteInput").value = c.note || "";
}

function renderTop3() {
  const t3 = todayTop3();
  const list = document.getElementById("top3List");
  list.innerHTML = "";
  if (t3.length === 0) {
    list.innerHTML = '<li class="empty-hint">今日尚未挑選要事，最多三件 ✧</li>';
  } else {
    t3.forEach(it => {
      const li = document.createElement("li");
      const box = document.createElement("span");
      box.className = "check" + (it.done ? " done" : "");
      box.textContent = it.done ? "✓" : "";
      box.onclick = (e) => toggleTop3(it.id, e.currentTarget);
      const text = document.createElement("span");
      text.className = "task-text" + (it.done ? " done" : "");
      text.innerHTML = escapeHtml(it.title) + " " + diffTag(it.diff);
      const del = document.createElement("button");
      del.className = "del-btn"; del.textContent = "✕"; del.onclick = () => delTop3(it.id);
      li.appendChild(box); li.appendChild(text); li.appendChild(del);
      list.appendChild(li);
    });
  }
  const addBtn = document.getElementById("top3AddBtn");
  const input = document.getElementById("top3Input");
  const full = t3.length >= 3;
  if (addBtn) addBtn.disabled = full;
  if (input) { input.disabled = full; input.placeholder = full ? "今日三事已滿（最多 3）" : "挑一件今日要事…"; }
}

function renderHeartDemon() {
  const host = document.getElementById("heartDemon");
  const c = todayCheckin();
  const max = state.goals.length + (c.top3 || []).length;
  const done = doneTodayCount();
  const remain = Math.max(0, max - done);
  if (max === 0) {
    host.className = "card demon-card dormant";
    host.innerHTML = `<div class="demon-stage">${demonSVG()}</div>
      <div class="demon-info"><div class="demon-name">今日心魔 · 蟄伏</div>
      <div class="demon-hint">今日尚無任務，心魔蟄伏。立下功課或今日三事即可開戰。</div></div>`;
    return;
  }
  if (remain === 0) {
    host.className = "card demon-card slain";
    host.innerHTML = `<div class="demon-stage">${demonSVG()}<div class="slain-mark">心魔已破 ✦</div></div>
      <div class="demon-info"><div class="demon-name">今日心魔 · 已斬</div>
      <div class="demon-hint">今日任務盡數完成，心魔潰散，道心清明。</div></div>`;
    return;
  }
  const pct = Math.round(remain / max * 100);
  host.className = "card demon-card";
  host.innerHTML = `<div class="demon-stage">${demonSVG()}</div>
    <div class="demon-info"><div class="demon-name">今日心魔</div>
      <div class="demon-hpbar"><div class="demon-hp" style="width:${pct}%"></div></div>
      <div class="demon-hint">尚餘氣血 ${remain} / ${max}　完成任務以劍斬之</div></div>`;
}

function renderWeekly() {
  const mon = mondayOf(new Date());
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  document.getElementById("weekRange").textContent =
    `本週 ${mon.getMonth() + 1}/${mon.getDate()}–${sun.getMonth() + 1}/${sun.getDate()}　過去各週可於「紀錄」回顧`;
  const items = currentWeekItems();
  const list = document.getElementById("weekList");
  list.innerHTML = "";
  if (items.length === 0) { list.innerHTML = '<li class="empty-hint">本週還沒立下備忘 ✧</li>'; return; }
  items.forEach(it => {
    const li = document.createElement("li");
    const box = document.createElement("span");
    box.className = "check" + (it.done ? " done" : "");
    box.textContent = it.done ? "✓" : "";
    box.onclick = () => toggleWeekItem(it.id);
    const text = document.createElement("span");
    text.className = "task-text" + (it.done ? " done" : "");
    text.textContent = it.title;
    const del = document.createElement("button");
    del.className = "del-btn"; del.textContent = "✕"; del.onclick = () => deleteWeekItem(it.id);
    li.appendChild(box); li.appendChild(text); li.appendChild(del);
    list.appendChild(li);
  });
}

function renderDeviation() {
  const dev = isDeviated();
  document.body.classList.toggle("deviated", dev);
  const today = document.getElementById("page-today");
  let banner = document.getElementById("devBanner");
  if (dev) {
    if (!banner) { banner = document.createElement("div"); banner.id = "devBanner"; banner.className = "dev-banner"; today.insertBefore(banner, today.firstChild); }
    banner.innerHTML = "⚠ 走火入魔 — 昨日斷了修行，心神紊亂。<b>今日完成任一任務即可歸位。</b>";
  } else if (banner) banner.remove();
}

function renderLog() {
  const now = new Date();
  const y = now.getFullYear(), mo = now.getMonth();
  document.getElementById("calTitle").textContent = `${y} 年 ${mo + 1} 月`;
  const grid = document.getElementById("calGrid");
  grid.innerHTML = "";
  const firstDay = new Date(y, mo, 1).getDay();
  const days = new Date(y, mo + 1, 0).getDate();
  for (let i = 0; i < firstDay; i++) { const b = document.createElement("span"); b.className = "cal-cell blank"; grid.appendChild(b); }
  const tk = todayKey();
  for (let d = 1; d <= days; d++) {
    const key = dateKey(new Date(y, mo, d));
    const c = state.checkins[key];
    const cnt = (c && c.done ? c.done.length : 0) + (c && c.top3 ? c.top3.filter(t => t.done).length : 0);
    const cell = document.createElement("span");
    let cls = "cal-cell";
    if (isActive(c)) cls += " lit lit" + Math.min(cnt, 4);
    else if ((state.shieldDays || []).includes(key)) cls += " shielded";
    if (key === tk) cls += " today";
    cell.className = cls; cell.textContent = d;
    grid.appendChild(cell);
  }

  const tl = document.getElementById("timeline");
  const keys = Object.keys(state.checkins).filter(k => isActive(state.checkins[k])).sort().reverse();
  if (keys.length === 0) { tl.innerHTML = '<p class="empty-hint">還沒有紀錄，從今日開始吧 ✧</p>'; return; }
  tl.innerHTML = "";
  const wk = ["日", "一", "二", "三", "四", "五", "六"];
  keys.forEach(k => {
    const c = state.checkins[k];
    const dt = new Date(k + "T00:00:00");
    const dateStr = `${dt.getMonth() + 1}月${dt.getDate()}日 週${wk[dt.getDay()]}`;
    const note = (c.note && c.note.trim()) ? c.note : "（未留言）";
    const titles = (c.done || []).map(id => titleOf(c, id)).concat((c.top3 || []).filter(t => t.done).map(t => t.title));
    const cnt = titles.length;
    const tasksHtml = titles.length ? `<div class="tl-tasks">${titles.map(t => `<span class="tl-task">${escapeHtml(t)}</span>`).join("")}</div>` : "";
    const item = document.createElement("div"); item.className = "tl-item";
    item.innerHTML =
      `<div class="tl-dot">${c.mood || "·"}</div>` +
      `<div class="tl-body"><div class="tl-date">${dateStr}<span class="tl-count">${cnt} 事</span></div>` +
      tasksHtml + `<div class="tl-note">${escapeHtml(note)}</div></div>`;
    tl.appendChild(item);
  });
}

// 功課錄：所有完成過的任務，可翻頁
function allDoneEntries() {
  const out = [];
  const keys = Object.keys(state.checkins).sort().reverse();
  keys.forEach(k => {
    const c = state.checkins[k];
    (c.done || []).forEach(id => out.push({ date: k, title: titleOf(c, id), diff: (c.diffs && c.diffs[id]) || "mid", xp: (c.award && c.award[id]) || diffOf(c.diffs && c.diffs[id]).base }));
    (c.top3 || []).forEach(t => { if (t.done) out.push({ date: k, title: t.title, diff: t.diff || "mid", xp: t.xp || diffOf(t.diff).base }); });
  });
  return out;
}
function renderTaskLog() {
  const wrap = document.getElementById("taskLog");
  if (!wrap) return;
  const entries = allDoneEntries();
  const perPage = 12;
  const pages = Math.max(1, Math.ceil(entries.length / perPage));
  if (taskLogPage >= pages) taskLogPage = pages - 1;
  if (taskLogPage < 0) taskLogPage = 0;
  if (entries.length === 0) { wrap.innerHTML = '<p class="empty-hint">完成任務後，這裡會逐筆記錄 ✧</p>'; return; }
  const slice = entries.slice(taskLogPage * perPage, taskLogPage * perPage + perPage);
  const rows = slice.map(e => {
    const dt = new Date(e.date + "T00:00:00");
    return `<div class="tlog-row"><span class="tlog-date">${dt.getMonth() + 1}/${dt.getDate()}</span>` +
      `<span class="tlog-title">${escapeHtml(e.title)}</span>` +
      `<span class="diff diff-${e.diff}">${diffOf(e.diff).star}</span>` +
      `<span class="tlog-xp">+${e.xp}</span></div>`;
  }).join("");
  wrap.innerHTML = `<div class="tlog-list">${rows}</div>
    <div class="tlog-nav">
      <button class="pill-btn" id="tlogPrev" ${taskLogPage === 0 ? "disabled" : ""}>‹ 上一頁</button>
      <span class="tlog-page">${taskLogPage + 1} / ${pages}　共 ${entries.length} 筆</span>
      <button class="pill-btn" id="tlogNext" ${taskLogPage >= pages - 1 ? "disabled" : ""}>下一頁 ›</button>
    </div>`;
  const prev = document.getElementById("tlogPrev"), next = document.getElementById("tlogNext");
  if (prev) prev.onclick = () => { taskLogPage--; renderTaskLog(); };
  if (next) next.onclick = () => { taskLogPage++; renderTaskLog(); };
}

function renderWeekReview() {
  const wrap = document.getElementById("weekReview");
  const allWeeks = new Set(Object.keys(state.weeks || {}).filter(k => (state.weeks[k] || []).length > 0));
  for (const dk in state.checkins) if (isActive(state.checkins[dk])) allWeeks.add(weekKey(new Date(dk + "T00:00:00")));
  const sorted = [...allWeeks].sort().reverse();
  if (sorted.length === 0) { wrap.innerHTML = '<p class="empty-hint">本週開始累積後，這裡會逐週封存 ✧</p>'; return; }
  const ck = currentWeekKey();
  wrap.innerHTML = "";
  sorted.forEach(wkk => {
    const mon = new Date(wkk + "T00:00:00"); const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const items = (state.weeks && state.weeks[wkk]) || [];
    let days = 0, doneCount = 0; const tally = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon); d.setDate(mon.getDate() + i);
      const c = state.checkins[dateKey(d)];
      if (isActive(c)) days++;
      ((c && c.done) || []).forEach(id => { doneCount++; const t = titleOf(c, id); tally[t] = (tally[t] || 0) + 1; });
      ((c && c.top3) || []).forEach(t => { if (t.done) { doneCount++; tally[t.title] = (tally[t.title] || 0) + 1; } });
    }
    const tallyStr = Object.keys(tally).map(t => `${t}×${tally[t]}`).join("、") || "（無）";
    const itemsHtml = items.length
      ? `<ul class="wr-items">` + items.map(it => `<li class="${it.done ? "done" : ""}">${it.done ? "✓" : "○"} ${escapeHtml(it.title)}</li>`).join("") + `</ul>`
      : `<div class="wr-empty">（本週未立備忘）</div>`;
    const div = document.createElement("div");
    div.className = "wr-week" + (wkk === ck ? " current" : "");
    div.innerHTML =
      `<div class="wr-head"><span class="wr-range">${mon.getMonth() + 1}/${mon.getDate()}–${sun.getMonth() + 1}/${sun.getDate()}</span>` +
      `${wkk === ck ? '<span class="wr-now">本週</span>' : ""}</div>` +
      `<div class="wr-label">週備忘</div>${itemsHtml}` +
      `<div class="wr-summary">本週修煉 ${days} 日 · 完成任務 ${doneCount} 項<div class="wr-tally">${escapeHtml(tallyStr)}</div></div>`;
    wrap.appendChild(div);
  });
}

function lastNDates(n) {
  const arr = []; const d = new Date();
  for (let i = n - 1; i >= 0; i--) { const dd = new Date(d); dd.setDate(d.getDate() - i); arr.push({ key: dateKey(dd), date: dd }); }
  return arr;
}
function moodValue(m) { return ({ "😀": 5, "🙂": 4, "😐": 3, "😫": 2, "😴": 1 })[m] || 0; }
function dayDoneCount(c) { return (c && c.done ? c.done.length : 0) + (c && c.top3 ? c.top3.filter(t => t.done).length : 0); }

function renderStats() {
  const li = levelInfo(state.xp);
  const tiles = [
    ["目前境界", li.name + " 第" + li.stage + "重"],
    ["總修為", state.xp],
    ["連續修煉", calcStreak(state) + " 日"],
    ["修煉天數", activeDayCount(state) + " 日"],
    ["完成任務", totalDoneCount(state) + " 項"],
    ["護道符", (state.shields || 0) + " 張"],
  ];
  document.getElementById("statGrid").innerHTML =
    tiles.map(t => `<div class="stat-tile"><div class="stat-val">${t[1]}</div><div class="stat-key">${t[0]}</div></div>`).join("");

  const days = lastNDates(14);
  const counts = days.map(x => dayDoneCount(state.checkins[x.key]));
  const maxC = Math.max(1, ...counts);
  const W = 320, H = 120, pad = 6, bw = (W - pad * 2) / days.length;
  let bars = "";
  counts.forEach((cn, i) => {
    const h = cn === 0 ? 2 : (H - 24) * (cn / maxC);
    const x = pad + i * bw + 2;
    bars += `<rect x="${x.toFixed(1)}" y="${(H - 18 - h).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${h.toFixed(1)}" rx="2" class="bar"></rect>`;
    if (i % 2 === 0) bars += `<text x="${(x + (bw - 4) / 2).toFixed(1)}" y="${H - 5}" class="ax">${days[i].date.getDate()}</text>`;
  });
  document.getElementById("chartBars").innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${bars}</svg>`;

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
  document.getElementById("chartMood").innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${line}${dots}${empty}</svg>`;
}

function renderStreakWall() {
  const wrap = document.getElementById("streakWall");
  if (!wrap) return;
  const tiles = [
    ["目前連續", calcStreak(state) + " 日", "🔥"],
    ["歷史最長", longestStreak() + " 日", "🏔"],
    ["護道符", (state.shields || 0) + " / 3", "🛡"],
  ];
  wrap.innerHTML = tiles.map(t => `<div class="wall-tile"><div class="wall-ic">${t[2]}</div><div class="wall-val">${t[1]}</div><div class="wall-key">${t[0]}</div></div>`).join("");
}

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
      `<div class="achv-body"><div class="achv-top"><span class="achv-name">${b.name}</span>` +
      `<span class="achv-state">${unlocked ? "已得 ✦" : p.cur + "/" + p.max}</span></div>` +
      `<div class="achv-cond">${b.cond}</div>` +
      `<div class="achv-bar"><div class="achv-fill" style="width:${pct}%"></div></div></div>`;
    wrap.appendChild(el);
  });

  const lv = levelInfo(state.xp).level;
  const ladder = document.getElementById("ladder");
  ladder.innerHTML = JINGJIE.map((name, i) => {
    const need = THRESHOLDS[i];
    const reached = lv >= i + 1, cur = lv === i + 1;
    return `<div class="ladder-row${reached ? " reached" : ""}${cur ? " current" : ""}">` +
      `<span class="ladder-name">${name}</span><span class="ladder-need">${need} 修為</span>` +
      `<span class="ladder-mark">${cur ? "現在" : reached ? "✓" : ""}</span></div>`;
  }).join("");
}

function renderRewards() {
  const wrap = document.getElementById("rewards");
  if (!wrap) return;
  const lv = levelInfo(state.xp).level;
  wrap.innerHTML = "";
  ACCENTS.forEach(a => {
    const unlocked = lv >= a.need;
    const equipped = (state.equipAccent || "default") === a.id;
    const needName = JINGJIE[a.need - 1] || "更高之境";
    const el = document.createElement("div");
    el.className = "reward" + (unlocked ? "" : " locked");
    el.innerHTML =
      `<span class="reward-dot" style="background:${a.seal}"></span>` +
      `<span class="reward-name">${a.name}</span>` +
      `<span class="reward-state">${equipped ? "使用中" : unlocked ? "" : "需 " + needName}</span>`;
    const btn = document.createElement("button");
    btn.className = "pill-btn reward-btn";
    if (equipped) { btn.textContent = "使用中"; btn.disabled = true; }
    else if (unlocked) { btn.textContent = "啟用"; btn.onclick = () => equipAccent(a.id); }
    else { btn.textContent = "🔒"; btn.disabled = true; }
    el.appendChild(btn);
    wrap.appendChild(el);
  });
}

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
      t.className = "g-text"; t.innerHTML = escapeHtml(g.title) + " " + diffTag(g.diff || "mid");
      const del = document.createElement("button");
      del.className = "del-btn"; del.textContent = "✕"; del.onclick = () => deleteGoal(g.id);
      row.appendChild(t); row.appendChild(del);
      wrap.appendChild(row);
    });
    groups.appendChild(wrap);
  }
  if (!any) groups.innerHTML = '<p class="empty-hint">還沒有固定功課，立一項開始修行吧 ✧</p>';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

// ---------------- 啟動 ----------------
let state = loadState();
applyShields();

function init() {
  // 立固定功課（含難度）
  const goalInput = document.getElementById("goalInput");
  const goalCat = document.getElementById("goalCategory");
  const goalDiff = document.getElementById("goalDiff");
  const submitG = () => { addGoal(goalCat.value, goalInput.value, goalDiff ? goalDiff.value : "mid"); goalInput.value = ""; goalInput.focus(); };
  document.getElementById("addGoalBtn").onclick = submitG;
  goalInput.addEventListener("keydown", e => { if (e.key === "Enter") submitG(); });

  // 今日三事（含難度）
  const t3Input = document.getElementById("top3Input");
  const t3Diff = document.getElementById("top3Diff");
  const submitT = () => { addTop3(t3Input.value, t3Diff ? t3Diff.value : "mid"); t3Input.value = ""; t3Input.focus(); };
  document.getElementById("top3AddBtn").onclick = submitT;
  t3Input.addEventListener("keydown", e => { if (e.key === "Enter") submitT(); });

  // 本週備忘
  const weekInput = document.getElementById("weekInput");
  const subW = () => { addWeekItem(weekInput.value); weekInput.value = ""; weekInput.focus(); };
  document.getElementById("weekAddBtn").onclick = subW;
  weekInput.addEventListener("keydown", e => { if (e.key === "Enter") subW(); });

  document.getElementById("noteInput").addEventListener("input", e => setNote(e.target.value));

  // 偏好
  document.getElementById("resetBtn").onclick = resetAll;
  applyTheme(currentTheme());
  document.getElementById("themeToggle").onclick = toggleTheme;
  applyAccent(state.equipAccent || "default");

  const nameInput = document.getElementById("coachNameInput");
  nameInput.value = state.coachName || "";
  nameInput.addEventListener("input", e => setCoachName(e.target.value));

  // 音樂
  applyMusicUI(musicOn());
  document.getElementById("musicToggle").onclick = toggleMusic;
  document.getElementById("musicToggle2").onclick = toggleMusic;
  if (musicOn()) {
    const tryStart = () => { const bgm = document.getElementById("bgm"); if (bgm) { bgm.volume = 0.35; bgm.play().catch(() => {}); } };
    document.addEventListener("pointerdown", tryStart, { once: true });
  }

  // 匯出/匯入
  document.getElementById("exportBtn").onclick = exportBackup;
  const importFile = document.getElementById("importFile");
  document.getElementById("importBtn").onclick = () => importFile.click();
  importFile.onchange = e => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ""; };

  // 導覽
  document.querySelectorAll(".tab").forEach(t => { t.onclick = () => showPage(t.dataset.page); });

  let last = "today";
  try { const p = localStorage.getItem(PAGE_KEY); if (p) last = p; } catch (e) {}
  showPage(last);
}

document.addEventListener("DOMContentLoaded", init);
