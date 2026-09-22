const test = require("node:test");
const assert = require("node:assert");
const Logic = require("../logic.js");
const Ui = require("../ui.js");
const content = require("../base/content.json");

// ui.js 的 renderMapPage/initApp 以全局 Logic 为依赖（浏览器里 index.html 先加载 logic.js）
global.Logic = Logic;

// 最小 DOM 桩（沿用谦灵App tests/nav.test.js 的做法）：
// 只提供三个视图容器，render 函数往里写 innerHTML，测试读回来断言。
// 返回 view-week 容器，方便断言本周页；其余视图经 global.document 取。
function documentStub() {
  const views = {};
  for (const id of ["view-week", "view-day", "view-map"]) {
    views[id] = { id, innerHTML: "", hidden: false };
  }
  global.document = {
    getElementById: id => (id === "app" ? { addEventListener() {} } : views[id] || null)
  };
  return views["view-week"];
}

// initApp 用桩：三视图 + #app 点击捕获 + window.history/scrollTo/localStorage 桩
function appStub() {
  const views = {};
  for (const id of ["view-week", "view-day", "view-map"]) {
    views[id] = { id, innerHTML: "", hidden: false };
  }
  let clickHandler = null;
  global.document = {
    getElementById: id => (id === "app"
      ? { addEventListener: (ev, fn) => { clickHandler = fn; } }
      : views[id] || null)
  };
  const hist = { state: null };
  global.window = {
    scrollTo: () => {},
    addEventListener: () => {},
    history: {
      get state() { return hist.state; },
      pushState: s => { hist.state = s; },
      replaceState: s => { hist.state = s; },
      back: () => {}
    }
  };
  const store = {};
  global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }
  };
  return {
    store: store,
    // 模拟一次点击：#app 的委托处理函数收到 target 后走 closest("[data-action]")
    click: el => clickHandler({ target: { closest: () => el } })
  };
}

// 假按钮元素：getAttribute 按 data-action / data-day 取值
function actionEl(action, day) {
  return {
    getAttribute: k => k === "data-action" ? action : (k === "data-day" && day !== undefined ? String(day) : null)
  };
}

function buyerContent(childName) {
  return Object.assign({}, content, { childName: childName || "豆豆" });
}

const RANGE = { start: "2026-10-12", end: "2026-10-18" };

test("renderWeekPage 用娃名做标题，显示第N周而非课表日期", () => {
  const root = documentStub();
  const state = { content: Object.assign({}, content, { childName: "豆豆" }), week: 2, range: { start: "2026-10-12", end: "2026-10-18" } };
  Ui.renderWeekPage(state.content, state);
  assert.match(root.innerHTML, /豆豆的启蒙/);
  assert.match(root.innerHTML, /第2周/);
  assert.match(root.innerHTML, /2026-10-12/);
  assert.doesNotMatch(root.innerHTML, /6\/29/); // 谦灵课表日期不出现
});

test("本周页有 7 天列表、核心内容和整周打卡键", () => {
  documentStub();
  Ui.renderWeekPage(buyerContent(), { week: 2, range: RANGE, checkins: {} });
  const html = global.document.getElementById("view-week").innerHTML;
  for (const needle of ["动物①", "dog", "狗", "The dog says woof woof!",
    "Old MacDonald", "data-action=\"open-day\"", "data-action=\"toggle-week\"",
    "已完成 0/4 天", "进阶内容（选做）"]) {
    assert.ok(html.includes(needle), "缺: " + needle);
  }
  assert.ok(!html.includes("6/29"), "固定课表日期不该出现");
});

test("打卡状态影响本周页和当天页渲染", () => {
  documentStub();
  const state = { week: 2, range: RANGE, checkins: { "2": [1] } };
  Ui.renderWeekPage(buyerContent(), state);
  const weekHtml = global.document.getElementById("view-week").innerHTML;
  assert.ok(weekHtml.includes("is-done"));
  assert.ok(weekHtml.includes("已完成 1/4 天"));
  Ui.renderDayPage(buyerContent(), Object.assign({}, state, { day: 1 }));
  assert.ok(global.document.getElementById("view-day").innerHTML.includes("is-done"));
});

test("当天页活动日有打卡键和分时块，休息日（3/6/7）没有打卡键", () => {
  documentStub();
  const base = { week: 2, range: RANGE, checkins: {} };
  Ui.renderDayPage(buyerContent(), Object.assign({}, base, { day: 1 }));
  const dayHtml = global.document.getElementById("view-day").innerHTML;
  for (const needle of ["Dog 日", "穿衣服", "Look! A dog on your shirt!", "狗=dog",
    "data-action=\"toggle-checkin\"", "data-day=\"1\"", "data-action=\"go-back\""]) {
    assert.ok(dayHtml.includes(needle), "缺: " + needle);
  }
  assert.ok(!dayHtml.includes("6/29"), "当天页也不该出现固定课表日期");
  Ui.renderDayPage(buyerContent(), Object.assign({}, base, { day: 3 }));
  const restHtml = global.document.getElementById("view-day").innerHTML;
  assert.ok(restHtml.includes("休息"));
  assert.ok(!restHtml.includes("data-action=\"toggle-checkin\""), "休息日不该有打卡键");
});

test("全年地图渲染全部周，细化周可点、未细化周灰化", () => {
  documentStub();
  Ui.renderMapPage(buyerContent(), { startDate: "2026-10-05" });
  const html = global.document.getElementById("view-map").innerHTML;
  assert.ok(html.includes("data-action=\"goto-week\""));
  assert.ok(html.includes("data-week=\"2\""));
  assert.ok(html.includes("第48周"));
  assert.ok(html.includes("内容还没出"));
});

// —— Task 5: 地图页改动点 + initApp 点击接线（T3 评审裁定补测） ——

test("地图页标题「{娃名}的启蒙·全年地图」，周格子带自家 range 起始日", () => {
  documentStub();
  Ui.renderMapPage(buyerContent(), { startDate: "2026-10-05" });
  const html = global.document.getElementById("view-map").innerHTML;
  assert.ok(html.includes("豆豆的启蒙·全年地图"), "地图标题缺娃名");
  assert.ok(html.includes("2026-10-12"), "第2周格子缺自家起始日 2026-10-12"); // 10-05 + 7 天
});

test("地图格：整周替换的定制周缺 themeEn 不渲染 undefined", () => {
  documentStub();
  const custom = { childName: "小满", weeks: [
    { week: 1, theme: "颜色", emoji: "🎨", coreWords: [], coreSentences: [], detailed: true }
  ]};
  Ui.renderMapPage(custom, { startDate: "2026-10-05" });
  const html = global.document.getElementById("view-map").innerHTML;
  assert.ok(!html.includes("undefined"), "缺 themeEn 的定制周不该出现 undefined");
});

// 用真实 base/content.json 全量回归（参照谦灵App ui.test.js 的写法）：
// 每个细化周的地图格都得渲染出来、可点、带自家 range 起始日。
// 自己搭 document 桩——不依赖前一个测试留下的全局 document（单跑也要能过）。
test("content.json 里每个细化周的地图格都能渲染", () => {
  documentStub();
  const startDate = "2026-10-05";
  const html = Ui.renderMapPage(buyerContent(), { startDate: startDate });
  const detailed = content.weeks.filter(w => w.detailed);
  assert.ok(detailed.length > 0, "一个细化周都没有？");
  for (const w of detailed) {
    assert.ok(html.includes('data-week="' + w.week + '"'), `第${w.week}周格子不可点`);
    const start = Logic.weekDateRange(startDate, w.week).start;
    assert.ok(html.includes(start), `第${w.week}周格子缺起始日 ${start}`);
  }
});

// initApp 的点击委托接线：当天打卡键（data-action="toggle-checkin"，同谦灵App）
// 点下去要调 Logic.toggleDay 且传对 (家庭码, 周号, 天号)。
test("initApp 点击接线：toggle-checkin 调 Logic.toggleDay(code, week, day)", () => {
  const app = appStub();
  Ui.initApp(buyerContent(), { code: "K3F8QA", startDate: "2026-10-05", week: 2, range: RANGE });
  app.click(actionEl("toggle-checkin", 1));
  assert.deepEqual(JSON.parse(app.store["mei-checkins-K3F8QA"]), { 2: [1] });
  app.click(actionEl("toggle-checkin", 1)); // 再点取消
  assert.deepEqual(JSON.parse(app.store["mei-checkins-K3F8QA"]), { 2: [] });
});

test("initApp 点击接线：toggle-week 活动日全勾后再点清空；无 detail 的周不触发", () => {
  const app = appStub();
  Ui.initApp(buyerContent(), { code: "K3F8QA", startDate: "2026-10-05", week: 2, range: RANGE });
  app.click(actionEl("toggle-week"));
  assert.deepEqual(JSON.parse(app.store["mei-checkins-K3F8QA"]), { 2: [1, 2, 4, 5] });
  app.click(actionEl("toggle-week")); // 已全勾 → 清空
  assert.deepEqual(JSON.parse(app.store["mei-checkins-K3F8QA"]), { 2: [] });
  // 没有 detail 的周（第25周）：guard 拦下，不写任何打卡
  const app2 = appStub();
  Ui.initApp(buyerContent(), { code: "K3F8QA", startDate: "2026-10-05", week: 25, range: RANGE });
  app2.click(actionEl("toggle-week"));
  assert.equal(app2.store["mei-checkins-K3F8QA"], undefined);
});

// 复制打卡按钮：点一下把「娃名·第N周·第M天打卡✅」写进剪贴板（群打卡用）。
// Node 的 navigator 是只读的 mock 不掉，走 textarea+execCommand 兜底路径验证。
test("initApp 点击接线：copy-checkin 复制群打卡文案", () => {
  const app = appStub();
  let copied = null;
  global.document.createElement = () => ({
    value: "",
    style: {},
    select() { copied = this.value; }
  });
  global.document.execCommand = () => true;
  global.document.body = { appendChild() {}, removeChild() {} };
  Ui.initApp(buyerContent(), { code: "K3F8QA", startDate: "2026-10-05", week: 2, range: RANGE });
  app.click(actionEl("copy-checkin", 2));
  assert.equal(copied, "「豆豆」第2周·第2天打卡✅");
});

test("当天页活动日有「复制打卡」按钮，休息日没有", () => {
  documentStub();
  const base = { week: 2, range: RANGE, checkins: {} };
  Ui.renderDayPage(buyerContent(), Object.assign({}, base, { day: 1 }));
  assert.ok(global.document.getElementById("view-day").innerHTML.includes("data-action=\"copy-checkin\""));
  Ui.renderDayPage(buyerContent(), Object.assign({}, base, { day: 3 }));
  assert.ok(!global.document.getElementById("view-day").innerHTML.includes("copy-checkin"));
});
