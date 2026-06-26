/*
  AI 夥伴「阿橘」的大腦
  ---------------------------------
  現在這版是「規則式」：我們事先準備好很多句子，
  程式會根據你今天的狀況（完成幾項、心情如何、連續幾天）挑一句最合適的回你。
  它不需要網路、不需要 API 金鑰，完全免費、立刻能用。

  以後想讓阿橘變成「真的 AI」，只要改這個檔案裡的 getCoachMessage()，
  讓它去呼叫 Claude API 就好，App 其他地方都不用動 —— 這就是把它獨立出來的好處。
*/

// 各種情境下的台詞庫。隨機從中挑一句，讓阿橘每次講的話不太一樣。
const COACH_LINES = {
  // 一天還沒完成任何事
  start: [
    "嗨！新的一天～先挑一件最簡單的開始吧 💪",
    "今天想完成哪些事呢？勾一個就有經驗值囉！",
    "別想太多，先動起來。第一步最重要 🌱",
    "暑假的每一天都算數，我們今天也加油吧！",
  ],
  // 完成了一些、但還沒全部
  progress: [
    "不錯喔，已經開始動了！繼續保持 🔥",
    "每勾一個，未來的你就感謝現在的你一次。",
    "穩穩的，再來一項就更接近今天的目標了！",
    "看到你在前進，我也跟著開心 🦊",
  ],
  // 今天全部完成
  allDone: [
    "全部完成！你今天超強的 🎉 好好獎勵自己一下！",
    "清空任務清單的感覺，是不是很爽？做得好！",
    "完美的一天 ✨ 這就是把暑假用好的樣子！",
    "全勾完了！這份堅持會慢慢變成你的實力。",
  ],
  // 連續打卡里程碑
  streak: [
    "連續 {n} 天了！這個節奏超棒，別斷掉喔 🔥",
    "已經 {n} 天沒缺席，習慣正在養成中 💫",
    "{n} 天連續打卡，你比想像中更有毅力！",
  ],
  // 心情不好時的安慰
  comfortLow: [
    "今天累了沒關係，有來打卡就已經很棒了 🫶",
    "狀態低也是正常的，對自己溫柔一點。明天會更好。",
    "不用每天都很拼，休息也是計畫的一部分 😌",
  ],
  // 心情好時
  cheerHigh: [
    "看你心情這麼好，今天一定很順吧！趁勢多做一點 🚀",
    "好心情是最好的燃料，衝吧！",
  ],
  // 升等的時候
  levelUp: [
    "升到等級 {lv} 了！🎊 你正在變強，我看得到！",
    "等級 {lv} 達成！繼續這樣下去不得了 ⭐",
  ],
};

// 從一個陣列裡隨機挑一句
function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/*
  根據今天的情況，回傳一句阿橘要說的話。
  傳進來的 ctx 物件包含：
    doneCount   今天完成幾項
    totalCount  今天總共幾項目標
    mood        今天心情（emoji，可能是空字串）
    streak      連續打卡天數
    justLeveled 是否剛剛升等
    newLevel    升到第幾等
*/
function getCoachMessage(ctx) {
  // 1) 剛升等？先恭喜，這最值得慶祝
  if (ctx.justLeveled) {
    return pickRandom(COACH_LINES.levelUp).replace("{lv}", ctx.newLevel);
  }

  // 2) 連續天數剛好到里程碑（3 / 7 / 14 / 21 / 30 天）
  const milestones = [3, 7, 14, 21, 30];
  if (milestones.includes(ctx.streak)) {
    return pickRandom(COACH_LINES.streak).replace("{n}", ctx.streak);
  }

  // 3) 心情很低落 —— 給安慰，比催進度重要
  if (ctx.mood === "😫" || ctx.mood === "😴") {
    return pickRandom(COACH_LINES.comfortLow);
  }

  // 4) 今天全部完成
  if (ctx.totalCount > 0 && ctx.doneCount === ctx.totalCount) {
    return pickRandom(COACH_LINES.allDone);
  }

  // 5) 完成了一部分
  if (ctx.doneCount > 0) {
    // 心情很好的話，給更有衝勁的話
    if (ctx.mood === "😀") return pickRandom(COACH_LINES.cheerHigh);
    return pickRandom(COACH_LINES.progress);
  }

  // 6) 還沒開始
  return pickRandom(COACH_LINES.start);
}

// 讓 app.js 也能用到這個函式
window.getCoachMessage = getCoachMessage;
