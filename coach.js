/*
  道侶「鶴翁」的話語
  ---------------------------------
  規則式：依你今日的修煉情況（完成幾項、心境、連續幾日、是否晉升境界）
  挑一句古風口吻的話回你。不需網路、不需金鑰、離線即用。
  日後想接真正的 Claude API，只要改 getCoachMessage() 即可。
*/

const COACH_LINES = {
  start: [
    "道友今日來了，且挑一件易事起手，萬事起於足下。",
    "晨起一課，勝過空想百回。先動起來吧。",
    "心若未定，便從最簡單的功課入手，自會漸入佳境。",
    "一日之計在於晨，今日也用心修一修。",
  ],
  progress: [
    "已見起色，勿驕勿怠，再進一步。",
    "點滴皆是修為，今日的你正勝過昨日。",
    "穩住這份心氣，再了一課便更近一重。",
    "老夫在旁看著，你這般精進，甚好。",
  ],
  allDone: [
    "今日功課盡了！火候十足，當賞自己一盞清茶。🍵",
    "圓滿了一日，這份堅持，終會化作你的道行。",
    "了無牽掛，一身輕快——此乃善用光陰之相。",
    "全數修畢，假以時日，飛昇可期。",
  ],
  streak: [
    "已連修 {n} 日！此等心志，難得難得。",
    "{n} 日不輟，習慣已成，道基漸穩。",
    "連續 {n} 日精進，老夫都要刮目相看了。",
  ],
  comfortLow: [
    "今日倦了便緩一緩，肯來打坐已是難得。",
    "潮有起落，心有陰晴，待己寬厚些，明日自晴。",
    "修行非一日之功，歇息亦是功課的一環。",
  ],
  cheerHigh: [
    "見你今日心氣極佳，正好乘勢多修一課！",
    "好心境是最佳的火候，趁此精進，事半功倍。",
  ],
  levelUp: [
    "恭喜晉入「{lv}」之境！🎉 你之精進，老夫盡收眼底。",
    "境界已臻「{lv}」！繼續如此，前程不可限量。",
  ],
};

function pickRandom(list) { return list[Math.floor(Math.random() * list.length)]; }

/*
  ctx：{ doneCount, totalCount, mood, streak, justLeveled, newTitle }
  回傳一句鶴翁要說的話。
*/
function getCoachMessage(ctx) {
  if (ctx.justLeveled) {
    return pickRandom(COACH_LINES.levelUp).replace("{lv}", ctx.newTitle);
  }
  const milestones = [3, 7, 14, 21, 30];
  if (milestones.includes(ctx.streak)) {
    return pickRandom(COACH_LINES.streak).replace("{n}", ctx.streak);
  }
  if (ctx.mood === "😫" || ctx.mood === "😴") {
    return pickRandom(COACH_LINES.comfortLow);
  }
  if (ctx.totalCount > 0 && ctx.doneCount === ctx.totalCount) {
    return pickRandom(COACH_LINES.allDone);
  }
  if (ctx.doneCount > 0) {
    if (ctx.mood === "😀") return pickRandom(COACH_LINES.cheerHigh);
    return pickRandom(COACH_LINES.progress);
  }
  return pickRandom(COACH_LINES.start);
}

window.getCoachMessage = getCoachMessage;
